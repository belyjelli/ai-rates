// Package orderly parses the Orderly network's shared perpetual order book.
//
// Ported from packages/adapters/src/venues/orderly.ts.
//
// ONE ADAPTER FOR THE WHOLE NETWORK, listed in the catalog as WOOFi Pro. Orderly's brokers (WOOFi
// Pro, and ~100 others) are front ends on one shared order book, so they are not venues of their own
// and are not collected separately. A broker-listed market is deduplicated by carrying its
// `broker_id` suffix in the venue symbol (PERP_AAPL_USDC_mythos) on this one venue, rather than
// being listed again under each broker that fronts it.
package orderly

import (
	"fmt"
	"sort"
	"strconv"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "orderly"

// Envelope is Orderly's uniform response wrapper.
//
// Data is a pointer so that an absent or null `data` is distinguishable from an empty one, which is
// what the TypeScript `data === undefined || data === null` guard turns into a thrown error: a
// response that lost its payload must fail the cycle rather than read as a venue with nothing
// listed. Orderly also signals a rate limit this way — success false with code -1003 inside an
// HTTP 200 — so this is the only place such a response is caught.
type Envelope[T any] struct {
	Success   bool         `json:"success"`
	Data      *T           `json:"data"`
	Timestamp adapters.Num `json:"timestamp"`
	// Code arrives as a JSON number (-1003), so it is decoded as a Num rather than an int: an absent
	// code must not read as 0, which is a code Orderly could plausibly use.
	Code    adapters.Num `json:"code"`
	Message string       `json:"message"`
}

func (e Envelope[T]) unwrap(what string) (T, error) {
	if !e.Success || e.Data == nil {
		var zero T
		code := ""
		if e.Code.OK {
			code = strconv.FormatFloat(e.Code.Val, 'f', -1, 64)
		}
		return zero, fmt.Errorf("orderly %s: %s %s", what, code, e.Message)
	}
	return *e.Data, nil
}

// Rows is the `{rows: [...]}` payload the bulk endpoints wrap their lists in.
type Rows[T any] struct {
	Rows []T `json:"rows"`
}

type Info struct {
	Symbol string `json:"symbol"`
	Status string `json:"status"`
	// FundingPeriod is the settlement interval in hours: 8 (80 markets) or 4 (59) on 2026-09-14.
	FundingPeriod adapters.Num `json:"funding_period"`
	// BrokerID is set on markets a broker listed through permissionless listing (`_mythos`, `_alpix`,
	// `_fastx` suffixes: 59 of 139 on 2026-09-14). They trade on the same shared book and are
	// collected. A pointer, because "no broker" and "broker not stated" are different answers.
	BrokerID          *string `json:"broker_id"`
	DisplaySymbolName string  `json:"display_symbol_name"`
}

type Future struct {
	Symbol          string       `json:"symbol"`
	IndexPrice      adapters.Num `json:"index_price"`
	MarkPrice       adapters.Num `json:"mark_price"`
	EstFundingRate  adapters.Num `json:"est_funding_rate"`
	LastFundingRate adapters.Num `json:"last_funding_rate"`
	NextFundingTime adapters.Num `json:"next_funding_time"`
	// OpenInterest is BASE units.
	OpenInterest adapters.Num `json:"open_interest"`
	// Volume24h is 24h volume in BASE units.
	Volume24h adapters.Num `json:"24h_volume"`
	// Amount24h is 24h notional in USDC.
	Amount24h adapters.Num `json:"24h_amount"`
}

type FundingRate struct {
	Symbol                   string       `json:"symbol"`
	EstFundingRate           adapters.Num `json:"est_funding_rate"`
	LastFundingRate          adapters.Num `json:"last_funding_rate"`
	LastFundingRateTimestamp adapters.Num `json:"last_funding_rate_timestamp"`
	NextFundingTime          adapters.Num `json:"next_funding_time"`
}

type FundingHistoryRow struct {
	Symbol               string       `json:"symbol"`
	FundingRate          adapters.Num `json:"funding_rate"`
	FundingRateTimestamp adapters.Num `json:"funding_rate_timestamp"`
	NextFundingTime      adapters.Num `json:"next_funding_time"`
}

// HistoryMeta is the paging block. Its fields are Num rather than int so an absent one falls back to
// the page size asked for, exactly as the TypeScript `?? HISTORY_PAGE_SIZE` does, instead of reading
// as a page of zero rows.
type HistoryMeta struct {
	Total          adapters.Num `json:"total"`
	RecordsPerPage adapters.Num `json:"records_per_page"`
	CurrentPage    adapters.Num `json:"current_page"`
}

// FundingHistoryPage carries Meta as a pointer for the same reason Envelope carries Data as one: a
// response with no meta at all is not a response claiming zero records.
type FundingHistoryPage struct {
	Rows []FundingHistoryRow `json:"rows"`
	Meta *HistoryMeta        `json:"meta"`
}

// msOf is a millisecond timestamp for adapters.HoursBetween, present whenever the field decoded.
//
// Deliberately NOT Num.PositiveMs: the TypeScript reads `next_funding_time` through plain `num()`
// there and lets hoursBetween reject a stamp that is not after the settlement, so a zero must reach
// the comparison rather than be filtered out before it.
func msOf(n adapters.Num) *int64 {
	if !n.OK {
		return nil
	}
	ms := int64(n.Val)
	return &ms
}

// TradablePerps is the ACTIVE perps with a known funding period, by symbol.
//
// A map rather than an ordered structure because it is only ever read by symbol; the snapshot order
// comes from /futures, which is a list.
func TradablePerps(info []Info) map[string]Info {
	out := make(map[string]Info, len(info))
	for _, market := range info {
		if market.Status != "ACTIVE" || len(market.Symbol) < 5 || market.Symbol[:5] != "PERP_" {
			continue
		}
		if !market.FundingPeriod.OK || market.FundingPeriod.Val <= 0 {
			continue
		}
		out[market.Symbol] = market
	}
	return out
}

// SnapshotInput is one cycle's three responses, already unwrapped.
type SnapshotInput struct {
	Markets      map[string]Info
	Futures      []Future
	FundingRates []FundingRate
}

// ParseSnapshots normalises /futures onto ACTIVE markets, with the last settlement from
// /funding_rates.
//
// WHICH RATE IS PREDICTED. Orderly publishes two: `last_funding_rate`, the rate that settled at
// `last_funding_rate_timestamp`, and `est_funding_rate`, which its docs call a rolling average of
// the funding rate over the last 8 hours and which it shows as the upcoming rate. The settled one is
// not a prediction of anything, so it is emitted as a settlement and `est_funding_rate` is the
// predicted rate. The rolling average is therefore never emitted as a settled event, however
// backward-looking the window it averages over is.
//
// WHAT PERIOD BOTH ARE OVER. Despite "8 hours" in the docs, both are fractions per the market's own
// `funding_period`, not normalised to 8h. On 2026-09-14 the resting rate (the 0.01%-per-8h interest
// component with no premium) read 0.0001 on 8h markets (BTC, ETH, SPX500) and 0.00005 on 4h markets
// (HYPE, XAU, CL), for both fields, and HYPE's history settled 0.0000499 every 4h. Treating the 4h
// figures as 8h rates would halve their APR.
//
// Units, checked the same day: `open_interest` is base units (BTC 26.43846 x mark 77,090 = $2.04M)
// and `24h_amount` is USDC notional (BTC 31.94 x ~77,100 = 2,461,419).
//
// Orderly declares no asset class in its public API — `/rwa/market_sessions` names trading sessions
// but maps no symbol to one — so every market is crypto, XAU, SPX500 and AAPL included.
func ParseSnapshots(input SnapshotInput, now int64) core.SnapshotBatch {
	lastSettled := make(map[string]FundingRate, len(input.FundingRates))
	for _, rate := range input.FundingRates {
		lastSettled[rate.Symbol] = rate
	}

	snapshots := make([]core.FundingSnapshot, 0, len(input.Futures))
	settled := make([]core.FundingEvent, 0, len(input.Futures))

	for _, future := range input.Futures {
		market, listed := input.Markets[future.Symbol]
		rate := future.EstFundingRate
		hours := market.FundingPeriod
		if !listed || !rate.OK || !hours.OK || hours.Val <= 0 {
			continue
		}

		// PERP_BTC_USDC and PERP_AAPL_USDC_mythos both parse to base and USDC quote; the quote is the
		// collateral every Orderly market settles in.
		ref := adapters.MarketRefFor(VenueID, future.Symbol, adapters.Overrides{})
		markPrice := future.MarkPrice.Ptr()
		interval := hours.Val
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          rate.Val,
			BasisHours:    hours.Val,
			IntervalHours: &interval,
			NextFundingAt: future.NextFundingTime.PositiveMs(),
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    future.IndexPrice.Ptr(),
			// Base units x mark, not a notional the venue published.
			OpenInterestUSD: adapters.Mul(future.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    future.Amount24h.Ptr(),
		})

		last, known := lastSettled[future.Symbol]
		settledAt := last.LastFundingRateTimestamp.PositiveMs()
		if known && last.LastFundingRate.OK && settledAt != nil {
			settled = append(settled, core.FundingEvent{
				MarketRef:  ref,
				SettledAt:  *settledAt,
				Rate:       last.LastFundingRate.Val,
				BasisHours: hours.Val,
				MarkPrice:  nil,
			})
		}
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}
}

// ParseFundingHistory returns settlements in [fromMs, toMs], oldest first. Each row states the
// settlement after it, so its basis is that gap exactly; the market's funding period covers a row
// without one.
func ParseFundingHistory(
	venueSymbol string,
	rows []FundingHistoryRow,
	fromMs, toMs int64,
	fallbackHours *float64,
) []core.FundingEvent {
	ref := adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{})

	// One event per settlement timestamp, last wins, as the TypeScript Map does. The order is the
	// sort below rather than insertion order, so a Go map costs nothing here.
	byTime := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		if !row.FundingRateTimestamp.OK || !row.FundingRate.OK {
			continue
		}
		settledAt := int64(row.FundingRateTimestamp.Val)
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		basisHours := adapters.HoursBetween(&settledAt, msOf(row.NextFundingTime))
		if basisHours == nil {
			basisHours = fallbackHours
		}
		if basisHours == nil || *basisHours <= 0 {
			continue
		}
		byTime[settledAt] = core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       row.FundingRate.Val,
			BasisHours: *basisHours,
			MarkPrice:  nil,
		}
	}

	events := make([]core.FundingEvent, 0, len(byTime))
	for _, event := range byTime {
		events = append(events, event)
	}
	sort.Slice(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
