package stream

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// BinanceLiquidations speaks the USD-M futures !forceOrder@arr stream: ONE topic, every symbol.
//
// MEASURED 2026-09-18 from this box. Binance's own REST allForceOrders is still gone (404, the same
// verdict migration 012 recorded on 2026-09-13), but the socket is alive — with a host caveat that
// is the whole reason DefaultBinanceLiquidationURL is not the documented endpoint:
//
//	wss://fstream.binance.com        OPENS, then delivers NOTHING. Not one forceOrder in 20 minutes,
//	                                 and — decisively — not one btcusdt@aggTrade either, on a stream
//	                                 that ticks several times a second. A silent accept, i.e. a
//	                                 geo/IP block, NOT a quiet market.
//	wss://fstream.binancefuture.com  Same production data, and it delivers: 166 aggTrade control
//	                                 messages and 3 forceOrder events inside the first two minutes.
//
// Both hosts were run side by side, each with the aggTrade control alongside, precisely so "the
// venue is quiet" could be told apart from "this host sends us nothing". REST fapi.binance.com
// answers fine from the same box, so the block is on the stream host alone.
//
// The default is therefore the host PROVEN to deliver, not the one in the documentation: an
// all-symbols feed that silently delivers nothing is the worst possible failure here, because
// nothing about it looks broken. An operator whose server reaches the primary host can set
// BINANCE_LIQUIDATION_WS_URL back to it.
//
// UNDERCOUNTING, WHICH IS INHERENT AND NOT A BUG. Binance documents that this stream pushes at most
// ONE order per symbol per SECOND. A violent minute on a busy symbol is therefore reported short,
// and no setting changes that. Counts from this venue are a floor; notional from it is a floor too.
//
// ASTER RIDES THIS SAME DECODER. Aster is the same code path, for the reason the collector's REST side already treats it as the
// binancefapi FAMILY (internal/adapters/binancefapi/adapter.go, base https://fapi.asterdex.com):
// aster mirrors Binance's futures API, down to the stream names. MEASURED 2026-09-18: 71 aggTrade
// control messages and one forceOrder inside two minutes on
// wss://fstream.asterdex.com/stream?streams=!forceOrder@arr/btcusdt@aggTrade, payload identical in
// shape to Binance's, S="SELL". So one decoder serves both, and only the venue id and host differ.
type BinanceLiquidations struct {
	venueID string
	url     string
}

const (
	// DefaultBinanceLiquidationURL — see the type comment for why this is not fstream.binance.com.
	DefaultBinanceLiquidationURL = "wss://fstream.binancefuture.com/ws/!forceOrder@arr"
	// DefaultAsterLiquidationURL. Aster's own host, reached directly: no block was observed here.
	DefaultAsterLiquidationURL = "wss://fstream.asterdex.com/ws/!forceOrder@arr"
)

func NewBinanceLiquidations(url string) *BinanceLiquidations {
	if strings.TrimSpace(url) == "" {
		url = DefaultBinanceLiquidationURL
	}
	return &BinanceLiquidations{venueID: "binance", url: url}
}

func NewAsterLiquidations(url string) *BinanceLiquidations {
	if strings.TrimSpace(url) == "" {
		url = DefaultAsterLiquidationURL
	}
	return &BinanceLiquidations{venueID: "aster", url: url}
}

func (b *BinanceLiquidations) VenueID() string { return b.venueID }

func (b *BinanceLiquidations) URL() string { return b.url }

// NeedsSymbols is false: the stream name selects every symbol, so there is nothing to subscribe to
// and no subject set to keep in step with the catalog.
func (*BinanceLiquidations) NeedsSymbols() bool { return false }

// Frames is empty. The stream is chosen by the URL path; binance takes no subscribe message on a
// raw /ws/<stream> connection.
func (*BinanceLiquidations) Frames([]string) [][]byte { return nil }

func (*BinanceLiquidations) FramePause() time.Duration { return 0 }

// Ping asks the venue to list our subscriptions, purely so that it ANSWERS.
//
// WHY NOT nil, which is what this was. Binance sends a protocol-level ping every few minutes and the
// WebSocket library answers it inside itself, so it never surfaces as a read. Every other venue here
// hands us a pong or a heartbeat as an ordinary message, which keeps resetting the read deadline;
// this family gave us nothing but liquidations. That is survivable on binance, which produced 2.7
// events a minute when measured, and NOT survivable on aster, which produced 2 events in 24 minutes
// — it would trip the 15-minute read timeout in any ordinary quiet spell, reconnect, and trip it
// again, which the churn rule in connector.health would then quite rightly report as a broken feed.
// A feed that is working perfectly must not look broken because the market is calm.
//
// LIST_SUBSCRIPTIONS is the cheapest control message that produces a reply, and the reply is the
// whole point. Verified live on both hosts, 2026-09-18:
//
//	-> {"method":"LIST_SUBSCRIPTIONS","id":1}
//	<- {"result":["!forceOrder@arr"],"id":1}
//
// DecodeEvents ignores it, because it carries no "e":"forceOrder". Binance allows five incoming
// control messages a second; one every three minutes is not a rate-limit concern.
func (*BinanceLiquidations) Ping() []byte {
	return []byte(`{"method":"LIST_SUBSCRIPTIONS","id":1}`)
}

// PingEvery is well inside the 15-minute read timeout, so several keepalives have to be missed
// before the connection is judged dead.
func (*BinanceLiquidations) PingEvery() time.Duration { return 3 * time.Minute }

// binanceForceOrder is the !forceOrder@arr payload. Captured live 2026-09-18:
//
//	{"e":"forceOrder","E":1789672236702,"o":{"s":"COTIUSDT","S":"BUY","o":"LIMIT","f":"IOC",
//	 "q":"288183","p":"0.0220482","ap":"0.0219120","X":"FILLED","l":"288183","z":"288183",
//	 "T":1789672235690}}
type binanceForceOrder struct {
	Event string `json:"e"`
	// EventMs is declared ONLY so that it binds. encoding/json matches an unmatched key
	// case-insensitively, so without this field binance's "E" (a number) falls through onto "e" (a
	// string) and EVERY message fails to decode with "cannot unmarshal number into field e". Caught
	// by TestLiquidationSidesAreThePositionNotTheOrder against a live capture; the value itself is
	// unused, because the trade time below is the one that belongs in liquidated_at.
	EventMs int64 `json:"E"`
	Order   struct {
		Symbol string `json:"s"`
		// Side is the side of the ORDER that closed the position. See DecodeEvents.
		Side string `json:"S"`
		// Quantity is in the BASE asset on USD-M futures, not in contracts.
		Quantity json.RawMessage `json:"q"`
		// Price is the order's limit price; AvgPrice is what it actually filled at.
		Price    json.RawMessage `json:"p"`
		AvgPrice json.RawMessage `json:"ap"`
		Status   string          `json:"X"`
		TradeMs  int64           `json:"T"`
	} `json:"o"`
}

// DecodeEvents reads one forced close.
//
// SIDE. `o.S` is the side of the LIQUIDATION ORDER, not of the position, and the two are always
// opposite: the engine SELLS to close a long and BUYS to close a short. So SELL -> "long" and
// BUY -> "short". This is inverted relative to okx's posSide, which names the position directly,
// and getting it backwards would flip every long and short this venue contributes — it is the
// single most consequential line in the file, and it is pinned in TestBinanceLiquidationsSide.
//
// PRICE. `ap` (average fill price) is used, falling back to `p` (the order's limit price) only when
// `ap` is absent or zero, which happens on an order that has not filled yet. `ap` is what the
// position actually closed at, which is what fill_price means.
func (*BinanceLiquidations) DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error) {
	var m binanceForceOrder
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("binance: unreadable message: %w", err)
	}
	if m.Event != "forceOrder" || m.Order.Symbol == "" {
		return nil, nil
	}
	// COIN-MARGINED SYMBOLS ARE NOT THIS VENUE, and letting them through was wrong by ~1000x.
	// Measured in production 2026-09-18: the stream carried BTCUSD_PERP, whose quantity is a count of
	// $100 CONTRACTS rather than a quantity of BTC, so 2,304 contracts ($230k of notional) was stored
	// as 2,304 x $76,986 = $177M. Two such rows put binance's 24-hour notional at $1.5B against okx's
	// $54.9M on seven times the events, which is what made it obvious on /status.
	//
	// They are dropped rather than converted, because the collector does not carry this book at all:
	// the binance venue here is the USD-M one (762 markets), a coin-margined symbol has no row in
	// market_latest, and a liquidation the rest of the site cannot join to a market is noise in every
	// figure it reaches. Inverse symbols are BASEUSD_PERP or BASEUSD_<expiry>; a USD-M symbol never
	// carries an underscore.
	if strings.Contains(m.Order.Symbol, "_") {
		return nil, nil
	}

	var side string
	switch strings.ToUpper(m.Order.Side) {
	case "SELL":
		side = "long"
	case "BUY":
		side = "short"
	default:
		return nil, nil
	}

	qty := parseFloat(m.Order.Quantity)
	if qty == nil || *qty <= 0 {
		return nil, nil
	}
	price := parseFloat(m.Order.AvgPrice)
	if price == nil || *price <= 0 {
		price = parseFloat(m.Order.Price)
	}
	if price == nil || *price <= 0 {
		return nil, nil
	}

	at := now
	if m.Order.TradeMs > 0 {
		at = time.UnixMilli(m.Order.TradeMs).UTC()
	}

	// NOTIONAL NEEDS NO METADATA HERE, unlike gate, okx and htx, now that the inverse book is filtered
	// out above. A USD-M futures quantity is in the
	// BASE ASSET, so dollars are simply quantity times price — and that stays right for a scaled
	// listing such as 1000PEPEUSDT, where a quantity of 1000PEPE meets a price quoted per 1000PEPE
	// and the scale cancels. No contract multiplier is involved and none must be applied.
	notional := *qty * *price

	return []LiquidationEvent{{
		VenueSymbol:   m.Order.Symbol,
		At:            at,
		Side:          side,
		SizeContracts: *qty,
		FillPrice:     *price,
		NotionalUSD:   &notional,
	}}, nil
}
