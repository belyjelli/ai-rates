package dydx

import (
	"math"
	"strings"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Trade is one fill from /v4/trades/perpetualMarket/{ticker}. Captured live 2026-09-17:
//
//	{"id":"064e89330000000200000002","side":"SELL","size":"0.0004","price":"75974",
//	 "type":"LIQUIDATED","createdAt":"2026-09-17T13:39:47.542Z","createdAtHeight":"105810227"}
//
// `type` took exactly two values across 8,000 trades on eight markets: LIMIT and LIQUIDATED.
type Trade struct {
	ID              string       `json:"id"`
	Side            string       `json:"side"`
	Size            adapters.Num `json:"size"`
	Price           adapters.Num `json:"price"`
	Type            string       `json:"type"`
	CreatedAt       string       `json:"createdAt"`
	CreatedAtHeight string       `json:"createdAtHeight"`
}

type TradesResponse struct {
	Trades []Trade `json:"trades"`
}

// liquidatedType is the only trade type this ingests.
//
// dYdX also emits DELEVERAGED elsewhere in its API, and that is a DIFFERENT EVENT: deleveraging
// closes a PROFITABLE counterparty to absorb a loss the insurance fund could not, rather than a
// position whose own margin ran out. Migration 012's table is the regressor for margin-driven
// forced selling, so mixing the two would contaminate exactly the tail the study cares about. It
// never appeared in the 8,000 trades sampled, but the filter is explicit rather than incidental.
const liquidatedType = "LIQUIDATED"

// ParseLiquidations turns one market's trade page into forced closes, keeping only those newer than
// `after` (zero for a cold start, which keeps the whole page).
//
// SIDE: `side` is the TAKER's, and on a liquidation the taker is the liquidation order, which SELLS
// to close a long and BUYS to close a short. So SELL -> "long". Same inversion as binance, opposite
// to bybit's allLiquidation.
//
// HOW THAT WAS ESTABLISHED, because this venue publishes no book alongside its trade history and the
// field's definition alone is not evidence. Measured 2026-09-17 over 8,000 trades on eight markets,
// comparing each liquidation's price to the VWAP of the ordinary trades immediately around it — a
// liquidation is a market order, so it prints on the far side of the surrounding tape:
//
//	side=BUY   n=6   mean +91.1 bps, 6 of 6 ABOVE the neighbouring trades  -> an aggressive buy
//	side=SELL  n=32  mean  -5.3 bps, 25 of 32 BELOW                        -> an aggressive sell
//
// BUY is unambiguous. The seven SELLs that printed above their neighbours are all one LINK-USD
// cascade at 2026-09-10T12:34, where prices were collapsing fast enough that the trades AFTER each
// liquidation were far lower — an artifact of using neighbours instead of a live book, not a
// counterexample. Pinned in TestParseLiquidationsSideIsThePosition.
func ParseLiquidations(ticker string, trades []Trade, after time.Time) []core.Liquidation {
	out := make([]core.Liquidation, 0, 8)
	for _, trade := range trades {
		if !strings.EqualFold(trade.Type, liquidatedType) {
			continue
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
		if !trade.Size.OK || trade.Size.Val <= 0 || !trade.Price.OK || trade.Price.Val <= 0 {
			continue
		}
		at, err := time.Parse(time.RFC3339Nano, trade.CreatedAt)
		if err != nil {
			// A row keyed at "now" would defeat the primary key and be re-inserted on every poll.
			continue
		}
		at = at.UTC()
		// The cursor is not-older-than rather than strictly-after: two trades can share a
		// millisecond, and re-offering one the store already holds costs nothing (the key absorbs
		// it) while dropping one would lose it for good.
		if !after.IsZero() && at.Before(after) {
			continue
		}
		size := math.Abs(trade.Size.Val)
		price := trade.Price.Val
		// NOTIONAL: v4 has no contract multiplier anywhere — `size` IS the base asset and `price` is
		// USD — so dollars are simply the product, and size_contracts and notional_usd stay
		// consistent with each other without any metadata call.
		notional := size * price
		out = append(out, core.Liquidation{
			MarketRef:     adapters.MarketRefFor(VenueID, ticker, adapters.Overrides{}),
			LiquidatedAt:  at.UnixMilli(),
			Side:          side,
			SizeContracts: size,
			FillPrice:     price,
			NotionalUSD:   &notional,
		})
	}
	return out
}
