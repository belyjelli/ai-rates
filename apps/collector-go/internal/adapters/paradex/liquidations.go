package paradex

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Liquidations are public trades with trade_type LIQUIDATION, read per market from REST /v1/trades.
// The 2026-09-18 probe watched 24 minutes of the socket and saw only FILL and RPI; they are simply
// rare — about one every two hours per market, clustered — and the REST history, back to January,
// holds hundreds per market. Captured 2026-09-24:
//
//	{"market":"BTC-USD-PERP","side":"SELL","size":"0.00649","price":"83894.04692005321",
//	 "created_at":1790173872009,"trade_type":"LIQUIDATION"}
//
// SIDE IS THE CLOSING ORDER: the docs call it the taker side, and the liquidation takes. SELL closed a
// LONG. Checked against the price move over the five minutes before each: on BTC 186 of 194 BUY
// liquidations followed a rise and 18 of 19 SELLs a fall; on ETH 118 of 132 and 43 of 60.
//
// REST, not the socket: since 2026-09-21 the public channels speak SBE binary only (plain JSON is
// refused with 40301), and a five-minute poll of a quiet feed needs none of that. The type cannot be
// filtered server-side, so a page of every trade is read and filtered here; a busy market's page of
// 1,000 spans about six hours, far wider than the poll. UNWIND_TRANSFER, SETTLE_MARKET and
// BLOCK_TRADE are not liquidations and are skipped with every other type.
//
// The market list comes from /markets/summary rather than the snapshot loop's cached /markets: that
// cache is unlocked because the snapshot loop was its only reader, and this poll runs beside it.
const (
	liqLookback = 6 * time.Hour
	liqOverlap  = 2 * time.Minute
	tradesPage  = 1000
)

type Trade struct {
	Market    string       `json:"market"`
	Side      string       `json:"side"`
	Size      adapters.Num `json:"size"`
	Price     adapters.Num `json:"price"`
	CreatedAt int64        `json:"created_at"`
	TradeType string       `json:"trade_type"`
}

// ParseLiquidations keeps the LIQUIDATION trades, reading the taker side as the opposite position.
func ParseLiquidations(trades []Trade) []core.Liquidation {
	out := make([]core.Liquidation, 0, 4)
	for _, trade := range trades {
		if trade.TradeType != "LIQUIDATION" || trade.Market == "" || trade.CreatedAt <= 0 {
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
		// size is base units and price USD, so the product is dollars.
		notional := trade.Size.Val * trade.Price.Val
		out = append(out, core.Liquidation{
			MarketRef:     adapters.MarketRefFor(VenueID, trade.Market, adapters.Overrides{}),
			LiquidatedAt:  trade.CreatedAt,
			Side:          side,
			SizeContracts: trade.Size.Val,
			FillPrice:     trade.Price.Val,
			NotionalUSD:   &notional,
		})
	}
	return out
}

// liqState is the poll's own cursor, locked because it is written from the liquidation goroutine.
type liqState struct {
	mu    sync.Mutex
	since time.Time
}

// FetchLiquidations reads every perp's trades since the last poll and keeps the liquidations.
func (a *Adapter) FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error) {
	end := time.Now()
	var summary Results[Summary]
	if err := a.client.GetJSON(ctx, apiBase+"/markets/summary?market=ALL", &summary); err != nil {
		return nil, false, err
	}
	a.liq.mu.Lock()
	since := a.liq.since
	a.liq.mu.Unlock()
	start := end.Add(-liqLookback)
	if !since.IsZero() {
		start = since.Add(-liqOverlap)
	}

	out := make([]core.Liquidation, 0, 4)
	complete := true
	for _, row := range summary.Results {
		if !strings.HasSuffix(row.Symbol, "-PERP") {
			continue // options share the summary
		}
		if ctx.Err() != nil {
			return out, false, nil
		}
		var page Results[Trade]
		endpoint := fmt.Sprintf("%s/trades?market=%s&page_size=%d&start_at=%d", apiBase,
			url.QueryEscape(row.Symbol), tradesPage, start.UnixMilli())
		if err := a.client.GetJSON(ctx, endpoint, &page); err != nil {
			complete = false
			continue
		}
		if len(page.Results) >= tradesPage {
			complete = false
		}
		out = append(out, ParseLiquidations(page.Results)...)
	}

	a.liq.mu.Lock()
	a.liq.since = end
	a.liq.mu.Unlock()
	return out, complete, nil
}
