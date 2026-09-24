package phoenix

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"sort"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Liquidations come from each market's public fills, where a forced close is a fill whose
// instructionType is LiquidateViaMarketOrder (every other fill says PlaceMarketOrder, UncrossCrank,
// ExecuteStopLoss and the like). Captured 2026-09-23:
//
//	{"marketSymbol":"ETH","baseQty":"-0.067","quoteQty":"179.8548","price":"2684.4",
//	 "timestamp":"2026-09-23T14:10:53Z","transactionSignature":"3F9EU7jd...","instructionType":
//	 "LiquidateViaMarketOrder"}
//
// SIDE: baseQty IS THE LIQUIDATED ACCOUNT'S CLOSING TRADE, signed, so the position is its opposite:
// negative (it sold) closed a LONG, positive closed a SHORT. Confirmed against the Solana program log
// for three transactions, which reads "Position side for trader ... Long/Short": ETH -0.067 Long,
// HYPE -9.46 Long, SOL +1.77 Short.
//
// ONE LIQUIDATION, SEVERAL FILLS. A close that crosses several resting orders is one row per maker,
// all under one transactionSignature. They are summed into one liquidation, priced at the average,
// so the count is of forced closes and not of the makers who happened to fill them.
//
// startTime is MILLISECONDS; seconds are silently ignored and the newest 1,000 fills come back.
const (
	instructionLiquidate = "LiquidateViaMarketOrder"
	// liqLookback is the first poll's window: a busy market's 1,000-fill page spans about ten hours.
	liqLookback = 6 * time.Hour
	liqOverlap  = 2 * time.Minute
	fillsPage   = 1000
)

type Fill struct {
	MarketSymbol         string       `json:"marketSymbol"`
	BaseQty              adapters.Num `json:"baseQty"`
	QuoteQty             adapters.Num `json:"quoteQty"`
	Price                adapters.Num `json:"price"`
	Timestamp            string       `json:"timestamp"`
	TransactionSignature string       `json:"transactionSignature"`
	InstructionType      string       `json:"instructionType"`
}

type FillsPage struct {
	Data    []Fill `json:"data"`
	HasMore bool   `json:"hasMore"`
}

// ParseLiquidations folds one market's liquidation fills into one liquidation per transaction.
func ParseLiquidations(market Market, fills []Fill) []core.Liquidation {
	type agg struct {
		at          int64
		base, quote float64
		signed      float64
	}
	byTx := map[string]*agg{}
	order := []string{}
	for _, fill := range fills {
		if fill.InstructionType != instructionLiquidate || !fill.BaseQty.OK || fill.BaseQty.Val == 0 {
			continue
		}
		at, err := time.Parse(time.RFC3339Nano, fill.Timestamp)
		if err != nil {
			continue // a row keyed at "now" would be re-inserted on every poll
		}
		key := fill.TransactionSignature
		if key == "" {
			key = fmt.Sprintf("%s|%v", fill.Timestamp, fill.BaseQty.Val)
		}
		a, seen := byTx[key]
		if !seen {
			a = &agg{at: at.UnixMilli()}
			byTx[key] = a
			order = append(order, key)
		}
		a.base += math.Abs(fill.BaseQty.Val)
		a.signed += fill.BaseQty.Val
		quote := math.Abs(fill.QuoteQty.Val)
		if !fill.QuoteQty.OK && fill.Price.OK {
			quote = math.Abs(fill.BaseQty.Val) * fill.Price.Val
		}
		a.quote += quote
	}

	ref := refFor(market)
	out := make([]core.Liquidation, 0, len(order))
	for _, key := range order {
		a := byTx[key]
		if a.base <= 0 || a.quote <= 0 {
			continue
		}
		side := "long" // the liquidated account sold
		if a.signed > 0 {
			side = "short"
		}
		notional := a.quote
		out = append(out, core.Liquidation{
			MarketRef:     ref,
			LiquidatedAt:  a.at,
			Side:          side,
			SizeContracts: a.base,
			FillPrice:     a.quote / a.base,
			NotionalUSD:   &notional,
		})
	}
	return out
}

// FetchLiquidations reads every active market's fills since the last poll.
//
// complete is false when a market failed, or its page came back full so older fills were not read.
func (a *Adapter) FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error) {
	end := time.Now()
	raw, err := a.get(ctx, API+"/view/exchange/markets", "markets")
	if err != nil {
		return nil, false, err
	}
	markets, err := asList[Market](raw, "markets")
	if err != nil {
		return nil, false, err
	}
	a.mu.Lock()
	since := a.liqSince
	a.mu.Unlock()
	start := end.Add(-liqLookback)
	if !since.IsZero() {
		start = since.Add(-liqOverlap)
	}

	sort.Slice(markets, func(i, j int) bool { return markets[i].Symbol < markets[j].Symbol })
	out := make([]core.Liquidation, 0, 8)
	complete := true
	for _, market := range markets {
		if !IsTradable(market) || market.Symbol == "" {
			continue
		}
		if ctx.Err() != nil {
			return out, false, nil
		}
		var page FillsPage
		endpoint := fmt.Sprintf("%s/trades/%s/fills?limit=%d&startTime=%d", API, url.PathEscape(market.Symbol), fillsPage, start.UnixMilli())
		if err := a.client.GetJSON(ctx, endpoint, &page); err != nil {
			complete = false
			continue
		}
		if len(page.Data) >= fillsPage {
			complete = false
		}
		out = append(out, ParseLiquidations(market, page.Data)...)
	}

	a.mu.Lock()
	a.liqSince = end
	a.mu.Unlock()
	return out, complete, nil
}
