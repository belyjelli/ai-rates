package stream

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// DydxLiquidations reads forced closes off the dYdX v4 indexer's public trades channel.
//
// THERE IS NO LIQUIDATION CHANNEL ON THIS VENUE, and that is fine here because the trades feed
// carries an unambiguous per-trade `type`. MEASURED 2026-09-18, this box: 6,012 trades across six
// markets in two minutes, of which 78 were type "LIQUIDATED" and 5,934 "LIMIT" — two distinct
// values, one of which names a forced close outright. A live record:
//
//	{"id":"064dd4bd0000000200000002","side":"BUY","size":"5","price":"99.92","type":"LIQUIDATED",
//	 "createdAt":"2026-09-17T05:00:57.925Z","createdAtHeight":"105764029"}
//
// A FLAG ON A TRADE COUNTS AS A LIQUIDATION SOURCE only because this flag is explicit and its own
// value; it is not inferred from a zero hash, a missing field or a heuristic. Where a venue offers
// nothing better than a heuristic, this package records no feed at all — see the hyperliquid note in
// events.go.
//
// "DELEVERAGED" IS DELIBERATELY NOT INGESTED. dYdX also emits that type, and it is a different event:
// deleveraging closes a PROFITABLE counterparty's position to absorb a loss the insurance fund could
// not, rather than a position whose own margin ran out. Migration 012's table is the regressor for
// margin-driven forced selling, and folding in the other kind would contaminate exactly the tail the
// study cares about. If it is ever wanted it belongs in its own column, not silently in this one.
type DydxLiquidations struct{}

func (DydxLiquidations) VenueID() string { return "dydx" }

func (DydxLiquidations) URL() string { return "wss://indexer.dydx.trade/v4/ws" }

// NeedsSymbols is true: v4_trades is subscribed per market, with no all-markets form.
func (DydxLiquidations) NeedsSymbols() bool { return true }

// Frames is one subscribe per market. dYdX takes one channel and one id per message, so the count of
// frames is the count of markets — roughly 78 active on 2026-09-14 by the adapter's own census.
func (DydxLiquidations) Frames(symbols []string) [][]byte {
	frames := make([][]byte, 0, len(symbols))
	for _, symbol := range symbols {
		frame, err := json.Marshal(map[string]any{
			"type": "subscribe", "channel": "v4_trades", "id": symbol,
		})
		if err != nil {
			continue
		}
		frames = append(frames, frame)
	}
	return frames
}

// FramePause is short but non-zero. The indexer documents no control-channel rate limit and accepted
// six subscriptions back to back in the probe, but ~78 frames in one burst is a different ask, and
// 50ms spreads them over four seconds for no cost worth measuring.
func (DydxLiquidations) FramePause() time.Duration { return 50 * time.Millisecond }

func (DydxLiquidations) Ping() []byte { return []byte(`{"type":"ping"}`) }

func (DydxLiquidations) PingEvery() time.Duration { return 25 * time.Second }

// DecodeEvents reads one trades message.
//
// THE SUBSCRIBE SNAPSHOT IS KEPT, NOT SKIPPED, and on this venue it is most of the value. dYdX
// answers a subscription with a page of recent trades before it starts pushing live ones, so every
// reconnect re-delivers history — including liquidations that fired while the socket was down, which
// is the one gap a push-only feed otherwise cannot close. They arrive with their own createdAt, so
// they land on their real timestamps, and the liquidations primary key collapses the ones already
// stored, which makes the repetition free and the backfill genuine.
//
// MEASURED 2026-09-18: subscribing to six markets returned 78 LIQUIDATED trades in the first second,
// spanning the whole trading day, and then not one live liquidation in the following 24 minutes. So
// on current volumes this feed is effectively a poller that happens to be shaped like a socket.
//
// SIDE. `side` is the side of the TAKER order, and on a liquidation the taker is the liquidation
// order itself: it SELLS to close a long and BUYS to close a short. So SELL -> "long", as on binance
// and htx, and opposite to bybit's `S`.
//
// HOW CONFIDENT: WEAKEST IN THE PACKAGE, and deliberately labelled so. This is REASONED FROM THE
// FIELD'S DEFINITION, not measured. The book test that settled bybit was run against dYdX too, over
// 60 markets for 20 minutes on 2026-09-18, and compared exactly ZERO events: every LIQUIDATED trade
// seen in that window arrived in the subscribe snapshot, which has no contemporaneous book to
// compare against, and not one fired live. Re-check this against a real cascade before leaning on
// dYdX's long/short split.
//
// NOTIONAL. dYdX quotes `size` in the BASE asset and `price` in USD, with no contract multiplier
// anywhere in the v4 indexer, so dollars are size times price.
func (DydxLiquidations) DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error) {
	var m struct {
		Type     string `json:"type"`
		Channel  string `json:"channel"`
		ID       string `json:"id"`
		Message  string `json:"message"`
		Contents struct {
			Trades []struct {
				Side      string `json:"side"`
				Size      string `json:"size"`
				Price     string `json:"price"`
				Type      string `json:"type"`
				CreatedAt string `json:"createdAt"`
			} `json:"trades"`
		} `json:"contents"`
	}
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("dydx: unreadable message: %w", err)
	}
	if m.Type == "error" {
		return nil, fmt.Errorf("dydx: %s", m.Message)
	}
	if m.Channel != "v4_trades" || m.ID == "" || len(m.Contents.Trades) == 0 {
		return nil, nil
	}

	events := make([]LiquidationEvent, 0, 4)
	for _, trade := range m.Contents.Trades {
		if !strings.EqualFold(trade.Type, "LIQUIDATED") {
			continue // LIMIT is an ordinary fill; DELEVERAGED is a different event, see the type doc
		}
		var side string
		switch strings.ToUpper(trade.Side) {
		case "SELL":
			side = "long"
		case "BUY":
			side = "short"
		default:
			continue
		}
		size := parseFloat(json.RawMessage(strconvQuote(trade.Size)))
		price := parseFloat(json.RawMessage(strconvQuote(trade.Price)))
		if size == nil || *size <= 0 || price == nil || *price <= 0 {
			continue
		}
		at, err := time.Parse(time.RFC3339Nano, trade.CreatedAt)
		if err != nil {
			// An unparseable timestamp would key the row at "now" and defeat the primary key's whole
			// purpose, letting the same trade in again on the next reconnect's snapshot. Drop it.
			continue
		}
		notional := *size * *price
		events = append(events, LiquidationEvent{
			VenueSymbol: m.ID,
			At:          at.UTC(),
			Side:        side,
			// No contract multiplier exists on v4: size IS the base asset, so this column and the
			// notional are consistent with each other without one.
			SizeContracts: *size,
			FillPrice:     *price,
			NotionalUSD:   &notional,
		})
	}
	return events, nil
}

// strconvQuote re-wraps a Go string as a JSON string so parseFloat — which every other venue here
// feeds raw JSON — can be reused rather than duplicated. dYdX is the only venue whose numbers are
// decoded into strings before they reach a conversion.
func strconvQuote(s string) string {
	if s == "" {
		return `""`
	}
	return `"` + s + `"`
}
