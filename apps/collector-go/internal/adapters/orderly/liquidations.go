package orderly

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Liquidations come from /liquidated_positions, a public list of forced closes across the whole
// network, windowed by start_t/end_t in milliseconds. Probed 2026-09-24: about 100 a day, the list
// reaching back about ten days; `page` beyond 1 answered empty, so a poll pages by WINDOW instead.
//
// SIDE IS THE POSITION. `position_qty` is the liquidated position, signed: negative a short,
// positive a long. The docs do not define the sign, so this rests on evidence: of 268 rows checked
// against the price move in the 30 minutes before, 257 agreed (short liquidated into a rise, long
// into a fall). A row with position_qty 0 is an insurance-fund or bad-debt follow-up, not a close.
const (
	// liqWindowFirst is how far back the first poll reads, ~100 rows at today's rate.
	liqWindowFirst = 24 * time.Hour
	// liqOverlap re-reads the tail of the last window: rows can land a little after their timestamp,
	// and the store's key absorbs a repeat.
	liqOverlap  = 2 * time.Minute
	liqPageSize = 500
)

type LiquidatedPosition struct {
	Symbol string `json:"symbol"`
	// PositionQty is the liquidated position in base units, signed: negative short, positive long.
	PositionQty          adapters.Num `json:"position_qty"`
	TransferPrice        adapters.Num `json:"transfer_price"`
	MarkPrice            adapters.Num `json:"mark_price"`
	CostPositionTransfer adapters.Num `json:"cost_position_transfer"`
}

type LiquidatedRow struct {
	Timestamp     int64                `json:"timestamp"`
	LiquidationID int64                `json:"liquidation_id"`
	Positions     []LiquidatedPosition `json:"positions_by_perp"`
}

// ParseLiquidations flattens each liquidation into one close per perp it touched.
func ParseLiquidations(rows []LiquidatedRow) []core.Liquidation {
	out := make([]core.Liquidation, 0, len(rows))
	for _, row := range rows {
		if row.Timestamp <= 0 {
			continue // a row keyed at "now" would be re-inserted on every poll
		}
		for _, position := range row.Positions {
			if position.Symbol == "" || !position.PositionQty.OK || position.PositionQty.Val == 0 {
				continue
			}
			side := "long"
			if position.PositionQty.Val < 0 {
				side = "short"
			}
			price := position.TransferPrice
			if !price.OK || price.Val <= 0 {
				price = position.MarkPrice
			}
			if !price.OK || price.Val <= 0 {
				continue
			}
			size := math.Abs(position.PositionQty.Val)
			// Quantities are base units and prices USDC, so dollars are the product; the venue's own
			// cost_position_transfer is that product signed, and is preferred when present.
			notional := size * price.Val
			if position.CostPositionTransfer.OK && position.CostPositionTransfer.Val != 0 {
				notional = math.Abs(position.CostPositionTransfer.Val)
			}
			out = append(out, core.Liquidation{
				MarketRef:     adapters.MarketRefFor(VenueID, position.Symbol, adapters.Overrides{}),
				LiquidatedAt:  row.Timestamp,
				Side:          side,
				SizeContracts: size,
				FillPrice:     price.Val,
				NotionalUSD:   &notional,
			})
		}
	}
	return out
}

// FetchLiquidations reads the network's forced closes since the last poll.
//
// complete is false when a window came back full: at ~100 a day a 500-row window means something
// unusual, and the rows beyond it were not read.
func (a *Adapter) FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error) {
	end := time.Now()
	a.mu.Lock()
	since := a.liqSince
	a.mu.Unlock()
	start := end.Add(-liqWindowFirst)
	if !since.IsZero() {
		start = since.Add(-liqOverlap)
	}

	var env Envelope[Rows[LiquidatedRow]]
	if err := a.get(ctx, fmt.Sprintf("/liquidated_positions?start_t=%d&end_t=%d&size=%d",
		start.UnixMilli(), end.UnixMilli(), liqPageSize), &env); err != nil {
		return nil, false, err
	}
	data, err := env.unwrap("liquidated positions")
	if err != nil {
		return nil, false, err
	}

	a.mu.Lock()
	a.liqSince = end
	a.mu.Unlock()
	return ParseLiquidations(data.Rows), len(data.Rows) < liqPageSize, nil
}
