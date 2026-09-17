package gate

// Taker flow for Gate, from /futures/usdt/contract_stats at interval=5m.
//
// Each row is a statistics snapshot carrying long_taker_size and short_taker_size in CONTRACTS, the
// same unit as its open_interest, so dollars are size x quanto_multiplier x mark_price for that row.
//
// Measured 2026-09-17 against the live API, BTC_USDT:
//
//   - UNITS ARE CONTRACTS. The last 288 rows' (long + short) x 0.0001 x mark_price summed to
//     $6,050M against the ticker's volume_24h_quote of $6,005M, within 0.7%. Read as base coin
//     instead, the same rows would be $60 trillion.
//   - STAMPED AT THE START. Over 996 buckets, per-bucket total volume correlated with Binance kline
//     volume at 0.904 when `time` is aligned with openTime, against 0.836 and 0.651 shifted a bucket
//     either way; mark_price sat a mean $29 from Binance's close of the bucket starting at `time`
//     against $64 and $75 a bucket off. Buy imbalance correlates positively only at zero shift
//     (+0.23, against +0.04 and -0.01), which is also what says long_taker_size is the taker BUY.
//   - IT PUBLISHES A PARTIAL ROW, THEN REWRITES IT. At 15:43:52Z the 15:40 row held 636,731
//     contracts and did not change for four minutes; at ~15:47:48Z it was rewritten to 5,102,857
//     and a new, equally partial 15:45 row appeared. So the newest row is an early reading of its
//     bucket, finalised about 2.5 minutes after the bucket closes. The sweep's re-read of the newest
//     buckets is what replaces it.
//   - LIMIT IS 2000. limit=2016 and 3000 answer INVALID_PARAM_VALUE. `from` is inclusive, and with
//     it set the page runs a row or two PAST limit (limit=10 returned 11 rows, limit=2000 returned
//     2,002, limit=5 returned 7), so a page is full at >= limit rather than == limit. `to` is IGNORED
//     once `from` is set (the same 31 rows came back with and without it), so paging goes forward
//     from the newest row seen. Rows are oldest first.
//   - DEPTH is at least 60 days (a `from` 60 days back answered), far past the 7-day backfill, which
//     takes two pages.
//   - RATE LIMIT 200 requests per 10 seconds per endpoint, from the x-gate-ratelimit-limit and
//     -requests-remain headers.

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	// contractStatsPage is the venue's largest accepted limit.
	contractStatsPage = 2000
	// contractStatsMaxPages bounds one market: seven days is two pages.
	contractStatsMaxPages = 8

	// TakerFlowPace spaces contract_stats requests at 4 a second, a fifth of the 20 a second the
	// endpoint allows. A cold backfill of ~100 markets x 2 pages is under a minute.
	TakerFlowPace = 250 * time.Millisecond

	// quantoMaxAge: contract sizes change only on a relisting, so the whole contract list is read at
	// most hourly rather than once per market.
	quantoMaxAge = time.Hour
)

// ContractStat is one /contract_stats row, with only the fields taker flow reads.
type ContractStat struct {
	// Time is epoch SECONDS, the START of the bucket.
	Time int64 `json:"time"`
	// LongTakerSize and ShortTakerSize are CONTRACTS bought and sold by takers.
	LongTakerSize  adapters.Num `json:"long_taker_size"`
	ShortTakerSize adapters.Num `json:"short_taker_size"`
	MarkPrice      adapters.Num `json:"mark_price"`
}

// takerState is the adapter's taker-flow cache and pacing, guarded because the sweep runs on its
// own goroutine beside the snapshot loop.
type takerState struct {
	pace *adapters.Pacer

	mu       sync.Mutex
	quanto   map[string]float64
	quantoAt time.Time
}

// quantoMultipliers returns base units per contract for every contract, from /contracts, the same
// source FetchLiquidations and the gate stream use.
func (a *Adapter) quantoMultipliers(ctx context.Context) (map[string]float64, error) {
	a.taker.mu.Lock()
	cached, at := a.taker.quanto, a.taker.quantoAt
	a.taker.mu.Unlock()
	if cached != nil && time.Since(at) < quantoMaxAge {
		return cached, nil
	}

	var contracts []Contract
	if err := a.get(ctx, "/contracts", &contracts); err != nil {
		return nil, err
	}
	fresh := make(map[string]float64, len(contracts))
	for _, contract := range contracts {
		if contract.QuantoMultiplier.OK && contract.QuantoMultiplier.Val > 0 {
			fresh[contract.Name] = contract.QuantoMultiplier.Val
		}
	}
	if len(fresh) == 0 {
		return nil, fmt.Errorf("gate contracts: no quanto multipliers in %d contracts", len(contracts))
	}

	a.taker.mu.Lock()
	a.taker.quanto, a.taker.quantoAt = fresh, time.Now()
	a.taker.mu.Unlock()
	return fresh, nil
}

// FetchTakerFlow returns taker buy and sell per 5-minute bucket for buckets starting in
// [fromMs, toMs], paging forward.
//
// A contract with no known multiplier is an error, not a guess: a raw contract count read as dollars
// is off by the multiplier, 10,000x on BTC_USDT.
func (a *Adapter) FetchTakerFlow(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.TakerFlow, error) {
	quanto, err := a.quantoMultipliers(ctx)
	if err != nil {
		return nil, err
	}
	multiplier, known := quanto[venueSymbol]
	if !known {
		return nil, fmt.Errorf("gate %s: no quanto multiplier", venueSymbol)
	}

	from := core.TakerFlowBucketStart(fromMs) / 1000
	flows := make([]core.TakerFlow, 0, 16)
	for page := 0; page < contractStatsMaxPages && from*1000 <= toMs; page++ {
		if err := a.taker.pace.Wait(ctx); err != nil {
			return nil, err
		}
		var rows []ContractStat
		if err := a.getOptional(ctx, fmt.Sprintf("/contract_stats?contract=%s&interval=5m&from=%d&limit=%d",
			url.QueryEscape(venueSymbol), from, contractStatsPage), &rows); err != nil {
			return nil, err
		}
		flows = append(flows, ParseContractStats(venueSymbol, rows, multiplier, fromMs, toMs)...)
		// A full page runs a row or two past limit; anything shorter reached the newest bucket.
		if len(rows) < contractStatsPage {
			break
		}
		newest := int64(0)
		for _, row := range rows {
			newest = max(newest, row.Time)
		}
		if newest < from {
			break // a page that does not advance would loop forever
		}
		from = newest + core.TakerFlowBucketMs/1000
	}
	return flows, nil
}

// ParseContractStats converts contract_stats rows to taker flow for buckets starting in
// [fromMs, toMs]: contracts x multiplier x the row's mark price.
//
// A row without a positive mark price is skipped. Its sizes cannot become dollars, and substituting
// another bucket's price would put a number in the table the venue never implied.
func ParseContractStats(venueSymbol string, rows []ContractStat, multiplier float64, fromMs, toMs int64) []core.TakerFlow {
	flows := make([]core.TakerFlow, 0, len(rows))
	if !(multiplier > 0) {
		return flows
	}
	for _, row := range rows {
		if row.Time <= 0 || !row.LongTakerSize.OK || !row.ShortTakerSize.OK ||
			row.LongTakerSize.Val < 0 || row.ShortTakerSize.Val < 0 ||
			!row.MarkPrice.OK || row.MarkPrice.Val <= 0 {
			continue
		}
		bucket := core.TakerFlowBucketStart(row.Time * 1000)
		if bucket < core.TakerFlowBucketStart(fromMs) || bucket > toMs {
			continue
		}
		price := row.MarkPrice.Val
		flows = append(flows, core.TakerFlow{
			VenueID:     VenueID,
			VenueSymbol: venueSymbol,
			BucketStart: bucket,
			BuyUSD:      row.LongTakerSize.Val * multiplier * price,
			SellUSD:     row.ShortTakerSize.Val * multiplier * price,
			ClosePrice:  &price,
		})
	}
	return flows
}
