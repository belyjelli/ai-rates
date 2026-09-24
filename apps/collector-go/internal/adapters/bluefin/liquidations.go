package bluefin

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Liquidations come from /exchange/trades with tradeType=LIQUIDATION, one market per call. The
// parameter defaults to ORDER ("we only show order trades on our recent trades UI"), which is why a
// plain trades read never showed one. Probed 2026-09-24: the full history is there, BTC-PERP back to
// 2025-07-09 (843 rows), about ten a day across the venue.
//
// SIDE IS THE ORDER, not the position: the spec calls `side` the "trade side based on the user order
// in this trade", and the liquidation's order closes the position. So LONG (a buy) closed a SHORT,
// and SHORT closed a LONG. Checked against the price move in the 30 minutes before each: 146 of 150
// agreed (buys into a rise, sells into a fall).
const (
	// liqBackfill is how far back the first poll reads. The venue keeps it all and the table keeps
	// 120 days, so a month is a useful start at no real cost: 8 markets, ten-odd rows a day.
	liqBackfill = 30 * 24 * time.Hour
	liqOverlap  = 2 * time.Minute
	liqPage     = 1000
)

type Trade struct {
	ID               string       `json:"id"`
	Symbol           string       `json:"symbol"`
	Side             string       `json:"side"`
	TradeType        string       `json:"tradeType"`
	PriceE9          adapters.Num `json:"priceE9"`
	QuantityE9       adapters.Num `json:"quantityE9"`
	QuoteQuantityE9  adapters.Num `json:"quoteQuantityE9"`
	ExecutedAtMillis int64        `json:"executedAtMillis"`
}

// ParseLiquidations keeps the LIQUIDATION rows, reading the order side as the opposite position.
func ParseLiquidations(trades []Trade) []core.Liquidation {
	out := make([]core.Liquidation, 0, len(trades))
	for _, trade := range trades {
		if !strings.EqualFold(trade.TradeType, "LIQUIDATION") || trade.Symbol == "" || trade.ExecutedAtMillis <= 0 {
			continue
		}
		var side string
		switch strings.ToUpper(trade.Side) {
		case "SHORT":
			side = "long"
		case "LONG":
			side = "short"
		default:
			continue
		}
		size, price := E9(trade.QuantityE9), E9(trade.PriceE9)
		if size == nil || *size <= 0 || price == nil || *price <= 0 {
			continue
		}
		notional := *size * *price
		if quote := E9(trade.QuoteQuantityE9); quote != nil && *quote > 0 {
			notional = *quote
		}
		out = append(out, core.Liquidation{
			MarketRef:     ref(trade.Symbol),
			LiquidatedAt:  trade.ExecutedAtMillis,
			Side:          side,
			SizeContracts: *size,
			FillPrice:     *price,
			NotionalUSD:   &notional,
		})
	}
	return out
}

// FetchLiquidations reads each ACTIVE market's liquidations since the last poll.
//
// complete is false when a market failed or came back with a full page, whose older rows were not
// read.
func (a *Adapter) FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error) {
	end := time.Now()
	if err := a.refreshInfo(ctx, end); err != nil {
		return nil, false, err
	}
	a.mu.Lock()
	info, since := a.info, a.liqSince
	a.mu.Unlock()
	start := end.Add(-liqBackfill)
	if !since.IsZero() {
		start = since.Add(-liqOverlap)
	}

	out := make([]core.Liquidation, 0, 16)
	complete := true
	for _, market := range info {
		if market.Status != "ACTIVE" || market.Symbol == "" {
			continue
		}
		if ctx.Err() != nil {
			return out, false, nil
		}
		var trades []Trade
		endpoint := fmt.Sprintf("%s/exchange/trades?symbol=%s&tradeType=LIQUIDATION&limit=%d&startTimeAtMillis=%d&endTimeAtMillis=%d",
			API, url.QueryEscape(market.Symbol), liqPage, start.UnixMilli(), end.UnixMilli())
		if err := a.client.GetJSON(ctx, endpoint, &trades); err != nil {
			complete = false
			continue
		}
		if len(trades) >= liqPage {
			complete = false
		}
		out = append(out, ParseLiquidations(trades)...)
	}

	a.mu.Lock()
	a.liqSince = end
	a.mu.Unlock()
	return out, complete, nil
}
