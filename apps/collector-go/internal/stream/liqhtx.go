package stream

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"time"
)

// HTXLiquidations speaks HTX's USDT-margined swap notification endpoint, topic
// public.*.liquidation_orders — ONE wildcard topic covering every contract.
//
// MEASURED 2026-09-18, this box. The subscribe was accepted WITHOUT authentication ("err-code":0),
// and the per-contract form public.BTC-USDT.liquidation_orders then came back "err-code":2014
// "Repeated subscription", which confirms the wildcard already covers it. 5 events in 22 minutes
// (0.23/min) — the thinnest feed here, but a real one. Its REST sibling
// /linear-swap-api/v3/swap_liquidation_orders also works publicly (the v1 endpoint is retired:
// "The interface is offline"), but it is per-contract and returns a single record a call, so the
// socket is strictly better and no REST path is wired up for this venue.
//
// TWO WIRE QUIRKS, both unique to htx in this package:
//   - Every frame is GZIPPED. Decode has to inflate before it can parse.
//   - The venue drives the keepalive: it sends {"op":"ping","ts":...} and drops a connection that
//     does not answer {"op":"pong","ts":...} echoing that timestamp. That is why this type
//     implements Responder — a decoder has no connection to answer on, and a keepalive ticker
//     cannot echo a timestamp it has not seen.
type HTXLiquidations struct{}

func (HTXLiquidations) VenueID() string { return "htx" }

func (HTXLiquidations) URL() string { return "wss://api.hbdm.com/linear-swap-notification" }

// NeedsSymbols is false: public.* is the wildcard over every contract.
func (HTXLiquidations) NeedsSymbols() bool { return false }

// Frames subscribes once to the wildcard. trade_type is not a parameter on the push channel — the
// wildcard delivers every contract's forced closes, both directions.
func (HTXLiquidations) Frames([]string) [][]byte {
	frame, err := json.Marshal(map[string]any{
		"op":    "sub",
		"topic": "public.*.liquidation_orders",
		"cid":   "airates-liq",
	})
	if err != nil {
		return nil
	}
	return [][]byte{frame}
}

func (HTXLiquidations) FramePause() time.Duration { return 0 }

// Ping is nil because htx pings US; see Respond.
func (HTXLiquidations) Ping() []byte { return nil }

func (HTXLiquidations) PingEvery() time.Duration { return 0 }

// Respond answers htx's server-initiated ping by echoing its timestamp back VERBATIM.
//
// THE TIMESTAMP IS ECHOED AS RAW JSON, NOT PARSED AND REFORMATTED, and that is the fix for a bug
// that reached production on 2026-09-18. htx is INCONSISTENT about the type of `ts` between its own
// message kinds, on one connection, seconds apart:
//
//	{"op":"sub","cid":"airates-liq","topic":"...","ts":1789676350590,"err-code":0}   <- number
//	{"op":"ping","ts":"1789676355591"}                                               <- STRING
//
// Declaring ts as an int64 therefore made json.Unmarshal fail on every ping, Respond return nil, and
// the pong never go out. htx sent five unanswered pings five seconds apart, then {"op":"close"} and
// a close frame reading "Bye", at almost exactly 30 seconds — forever, on a feed that /health showed
// as a healthy quiet venue. It was diagnosed by logging the inflated frames rather than by reading
// the docs, which say ts is a number.
//
// Echoing the raw bytes sidesteps the question entirely: whatever shape htx used, it gets back. A
// value that is neither a number nor a string is not echoed, so a malformed frame cannot be
// reflected into the connection.
func (HTXLiquidations) Respond(msg []byte) []byte {
	body, err := gunzip(msg)
	if err != nil {
		return nil
	}
	var m struct {
		Op string          `json:"op"`
		TS json.RawMessage `json:"ts"`
		// The market endpoints use a bare {"ping": <ts>} instead of {"op":"ping"}; answering both
		// costs one branch and means a change of endpoint cannot silently kill the connection.
		Ping json.RawMessage `json:"ping"`
	}
	if err := json.Unmarshal(body, &m); err != nil {
		return nil
	}
	if m.Op == "ping" && isJSONScalar(m.TS) {
		return append(append([]byte(`{"op":"pong","ts":`), m.TS...), '}')
	}
	if isJSONScalar(m.Ping) {
		return append(append([]byte(`{"pong":`), m.Ping...), '}')
	}
	return nil
}

// isJSONScalar reports whether raw is a JSON number or string — the only two shapes htx has been
// seen to use for a timestamp, and the only two safe to echo back into the connection.
func isJSONScalar(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	if raw[0] == '"' {
		return len(raw) >= 2 && raw[len(raw)-1] == '"'
	}
	return (raw[0] >= '0' && raw[0] <= '9') || raw[0] == '-'
}

// gunzip inflates one htx frame. Every frame htx sends is gzipped, including its acks and pings.
func gunzip(msg []byte) ([]byte, error) {
	reader, err := gzip.NewReader(bytes.NewReader(msg))
	if err != nil {
		return nil, fmt.Errorf("htx: not gzip: %w", err)
	}
	defer reader.Close()
	// Bounded for the reason dial.go caps the read limit: a compressed frame can inflate to far more
	// than it arrived as, and one connection must not be able to page in unbounded memory.
	body, err := io.ReadAll(io.LimitReader(reader, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("htx: inflate: %w", err)
	}
	return body, nil
}

// htxLiquidation is one record. Captured live 2026-09-18:
//
//	{"op":"notify","topic":"public.ETH-USDT.liquidation_orders","ts":1789670297217,
//	 "data":[{"symbol":"ETH","contract_code":"ETH-USDT","direction":"buy","offset":"close",
//	          "volume":500,"price":2446.26,"created_at":1789670297212,"amount":5,
//	          "trade_turnover":12231.3,"contract_type":"swap","pair":"ETH-USDT",
//	          "business_type":"swap","trade_partition":"USDT"}]}
//
// Note the three size fields and what each means: volume 500 is CONTRACTS, amount 5 is the base coin
// (ETH-USDT is 0.01 ETH per contract, and 500 x 0.01 = 5), and trade_turnover 12,231.3 is already
// USDT (5 x 2446.26 = 12231.3, reconciled exactly on this record).
// Every number is json.RawMessage and goes through parseFloat, which reads a quoted and an unquoted
// number alike. NOT defensive habit — htx demonstrably quotes some numbers and not others (see
// Respond), and a decoder that assumes one shape here would fail exactly as the ping handler did,
// only silently: the events would simply stop appearing.
type htxLiquidation struct {
	ContractCode  string          `json:"contract_code"`
	Direction     string          `json:"direction"`
	Offset        string          `json:"offset"`
	Volume        json.RawMessage `json:"volume"`
	Price         json.RawMessage `json:"price"`
	CreatedAt     json.RawMessage `json:"created_at"`
	Amount        json.RawMessage `json:"amount"`
	TradeTurnover json.RawMessage `json:"trade_turnover"`
}

// DecodeEvents reads one liquidation notification.
//
// SIDE. `direction` is the side of the liquidation ORDER and `offset` is always "close" on this
// channel, so the pair reads directly: a "close" that BUYS is closing a SHORT, a "close" that SELLS
// is closing a LONG. Same inversion as binance, opposite to bybit. The live ETH-USDT record above is
// direction "buy" / offset "close", i.e. a short was liquidated.
//
// This mapping is REASONED FROM THE FIELDS, not measured against the book the way bybit's was: htx
// produced 5 events in 22 minutes, too few to separate from the book with any confidence. The
// reasoning is unambiguous — "close" plus a direction can only mean one thing — but it is worth
// knowing which venues here are measured and which are argued.
//
// NOTIONAL IS FREE, uniquely on this venue: trade_turnover is already USDT and needs no contract
// multiplier, no mark price and no metadata fetch. It is preferred over any computation; only when
// the venue omits it does this fall back to amount (base coin) x price, and if neither is usable the
// notional stays nil rather than multiplying a CONTRACT count by a price, which would be wrong by
// the contract size — 100x on ETH-USDT.
func (HTXLiquidations) DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error) {
	body, err := gunzip(msg)
	if err != nil {
		return nil, err
	}
	var m struct {
		Op      string           `json:"op"`
		Topic   string           `json:"topic"`
		ErrCode *int             `json:"err-code"`
		ErrMsg  string           `json:"err-msg"`
		Data    []htxLiquidation `json:"data"`
	}
	if err := json.Unmarshal(body, &m); err != nil {
		return nil, fmt.Errorf("htx: unreadable message: %w", err)
	}
	// A failed subscribe. err-code 0 is the success ack, and 2014 "Repeated subscription" is what the
	// per-contract form returns once the wildcard is up — neither is a fault.
	if m.ErrCode != nil && *m.ErrCode != 0 && *m.ErrCode != 2014 {
		return nil, fmt.Errorf("htx: %s rejected: %d %s", m.Topic, *m.ErrCode, m.ErrMsg)
	}
	if m.Op != "notify" || len(m.Data) == 0 {
		return nil, nil
	}

	events := make([]LiquidationEvent, 0, len(m.Data))
	for _, row := range m.Data {
		volume, price := parseFloat(row.Volume), parseFloat(row.Price)
		if row.ContractCode == "" || volume == nil || *volume <= 0 || price == nil || *price <= 0 {
			continue
		}
		var side string
		switch row.Direction {
		case "sell":
			side = "long"
		case "buy":
			side = "short"
		default:
			continue
		}
		at := now
		if ms := parseFloat(row.CreatedAt); ms != nil && *ms > 0 {
			at = time.UnixMilli(int64(*ms)).UTC()
		}
		var notional *float64
		if turnover := parseFloat(row.TradeTurnover); turnover != nil && *turnover > 0 {
			usd := *turnover
			notional = &usd
		} else if amount := parseFloat(row.Amount); amount != nil && *amount > 0 {
			usd := *amount * *price
			notional = &usd
		}
		events = append(events, LiquidationEvent{
			VenueSymbol: row.ContractCode,
			At:          at,
			Side:        side,
			// The venue's own contract count, kept raw exactly as migration 012 asks: the notional
			// beside it came from trade_turnover, so a later question about the multiplier is still
			// answerable from what was stored.
			SizeContracts: *volume,
			FillPrice:     *price,
			NotionalUSD:   notional,
		})
	}
	return events, nil
}
