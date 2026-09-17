package stream

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// BybitLiquidations speaks v5 public linear, channel allLiquidation.{symbol}.
//
// MEASURED 2026-09-18, this box: 805 linear USDT symbols subscribed on ONE connection in 5 frames,
// the largest 5,358 characters — a quarter of bybit's documented 21,000-character per-REQUEST args
// budget, and well inside the ~850-1,000 topics W0 measured per connection. 49 events in 22 minutes
// (2.2/min) on a quiet afternoon.
//
// NO ALL-SYMBOLS FORM EXISTS, unlike binance, okx, gate and htx: bybit needs one topic per market,
// which is why NeedsSymbols is true and this is the only liquidation feed whose subscription set has
// to be kept in step with the catalog. The older `liquidation.{symbol}` channel is deprecated;
// allLiquidation replaces it.
type BybitLiquidations struct{}

func (BybitLiquidations) VenueID() string { return "bybit" }

func (BybitLiquidations) URL() string { return "wss://stream.bybit.com/v5/public/linear" }

// NeedsSymbols: see the type comment. One topic per market, or nothing arrives.
func (BybitLiquidations) NeedsSymbols() bool { return true }

// Frames chunks at the same 200 topics the quote feed uses, for the same reason: the 21,000-character
// cap is on a REQUEST, not on the connection, so five small frames cost nothing over one large one —
// and a venue that rejects one frame then rejects a fifth of the book rather than all of it.
// Measured at 5,358 characters for a 200-topic frame on 2026-09-18.
func (BybitLiquidations) Frames(symbols []string) [][]byte {
	frames := make([][]byte, 0, (len(symbols)+topicsPerFrame-1)/topicsPerFrame)
	for start := 0; start < len(symbols); start += topicsPerFrame {
		end := start + topicsPerFrame
		if end > len(symbols) {
			end = len(symbols)
		}
		args := make([]string, 0, end-start)
		for _, symbol := range symbols[start:end] {
			args = append(args, "allLiquidation."+symbol)
		}
		frame, err := json.Marshal(map[string]any{"op": "subscribe", "args": args})
		if err != nil {
			continue
		}
		frames = append(frames, frame)
	}
	return frames
}

func (BybitLiquidations) FramePause() time.Duration { return 350 * time.Millisecond }

func (BybitLiquidations) Ping() []byte { return []byte(`{"op":"ping"}`) }

func (BybitLiquidations) PingEvery() time.Duration { return 20 * time.Second }

// The allLiquidation envelope, captured live 2026-09-18:
//
//	{"topic":"allLiquidation.COTIUSDT","type":"snapshot","ts":1789669871912,
//	 "data":[{"T":1789669871606,"s":"COTIUSDT","S":"Sell","v":"6666","p":"0.021436"}]}
//
// `v` is volume in the BASE COIN and `p` the fill price; see DecodeEvents for both.

// DecodeEvents reads one liquidation message.
//
// SIDE, SETTLED BY MEASUREMENT RATHER THAN BY READING THE DOCS. Bybit's `S` is the one genuinely
// ambiguous field in this whole package: the deprecated `liquidation` channel and the current
// `allLiquidation` channel have been documented with opposite meanings at different times, and a
// cross-venue vote against okx and gate over 49 events split only 21 to 9 — suggestive, not proof.
//
// So it was settled physically, on 2026-09-18, by holding bybit's OWN orderbook.1 for all 805
// symbols on a second connection and comparing each liquidation's print price to the book at that
// instant. A liquidation is a market order swept through the book, so the print names the aggressor:
//
//	S="Buy"   21 of 21 events printed BELOW the best bid (-337 to -502 bps)  -> an aggressive SELL
//	S="Sell"   9 of  9 events printed ABOVE the best ask (+50 to +63 bps)    -> an aggressive BUY
//
// 30 of 30, no overlap. A SELL closes a LONG, so S="Buy" means a LONG was liquidated. Corroborated
// independently by the direction of the tape: the S="Buy" cluster was 4STOCKUSDT ticking down from
// 0.00786 to 0.00760 across the window, which is what a run of long liquidations looks like.
//
// Note this is INVERTED relative to binance, where `o.S` is the order's own side. Bybit's `S` names
// the POSITION. Pinned in TestBybitLiquidationsSide.
func (BybitLiquidations) DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error) {
	var m struct {
		Topic   string `json:"topic"`
		Success *bool  `json:"success"`
		RetMsg  string `json:"ret_msg"`
		Op      string `json:"op"`
		Data    []struct {
			TradeMs int64           `json:"T"`
			Symbol  string          `json:"s"`
			Side    string          `json:"S"`
			Volume  json.RawMessage `json:"v"`
			Price   json.RawMessage `json:"p"`
		} `json:"data"`
	}
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("bybit: unreadable message: %w", err)
	}
	if m.Success != nil && !*m.Success {
		return nil, fmt.Errorf("bybit: %s rejected: %s", m.Op, m.RetMsg)
	}
	if !strings.HasPrefix(m.Topic, "allLiquidation.") {
		return nil, nil // acks, pongs, anything else
	}

	events := make([]LiquidationEvent, 0, len(m.Data))
	for _, row := range m.Data {
		symbol := row.Symbol
		if symbol == "" {
			symbol = strings.TrimPrefix(m.Topic, "allLiquidation.")
		}
		var side string
		switch row.Side {
		case "Buy":
			side = "long"
		case "Sell":
			side = "short"
		default:
			continue
		}
		volume := parseFloat(row.Volume)
		price := parseFloat(row.Price)
		if volume == nil || *volume <= 0 || price == nil || *price <= 0 {
			continue
		}
		at := now
		if row.TradeMs > 0 {
			at = time.UnixMilli(row.TradeMs).UTC()
		}
		// NOTIONAL. Bybit quotes size in the BASE COIN, not in contracts — the same fact the quote
		// feed's SizeUSD relies on (bybit.go) — so money is price times quantity, with no metadata
		// and no contract multiplier. It stays right for a scaled listing, where a quantity of
		// 1000PEPE meets a price per 1000PEPE and the scale cancels.
		notional := *volume * *price
		events = append(events, LiquidationEvent{
			VenueSymbol:   symbol,
			At:            at,
			Side:          side,
			SizeContracts: *volume,
			FillPrice:     *price,
			NotionalUSD:   &notional,
		})
	}
	return events, nil
}
