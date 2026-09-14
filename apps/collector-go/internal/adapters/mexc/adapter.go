package mexc

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Compile-time proof that this adapter is actually seen by the warm-up phase.
//
// Worth more than the alias it guards. The phase finds its adapters with a type assertion, so if the
// method set ever stops matching — a renamed field, a reverted alias, a changed parameter — MEXC
// simply stops being warmed, with no error anywhere: the venue would just look slow to fill after a
// restart, which is the original bug wearing a different hat. This line turns that into a build
// failure.
var _ collector.WarmUpper = (*Adapter)(nil)

const (
	baseURL = "https://contract.mexc.com/api/v1/contract"

	// MinInterval is the spacing this venue's client should use.
	MinInterval = 110 * time.Millisecond

	historyPageSize = 100
	historyMaxPages = 50
)

// KnownMarket is a market the collector already has stored, for warming the interval cache after a
// restart.
//
// Declared here rather than shared because the Go collector's Fetcher interface carries no warm-up
// hook yet; MEXC is the first venue in this port that needs one.
// KnownMarket is the shared type, aliased rather than redeclared.
//
// This MUST be an alias, not a lookalike struct. Go method sets are nominal: a
// WarmUp([]mexc.KnownMarket) does not satisfy WarmUp([]collector.KnownMarket) even when the two
// structs are field-for-field identical, so the warm-up phase's type assertion would silently skip
// this adapter and MEXC would never be seeded — compiling cleanly while doing nothing. Identical
// shape makes that failure harder to spot, not easier.
type KnownMarket = collector.KnownMarket

// Options configures the adapter.
//
// IntervalRefreshBudget is a pointer so that an explicit 0 -- no per-symbol calls at all, which the
// warm-up test relies on -- is distinguishable from "unset", exactly as the TypeScript `??` is.
type Options struct {
	IntervalRefreshBudget *int
}

// Adapter collects MEXC's contract markets.
//
// MEXC's bulk ticker has no funding interval, so intervals come from per-symbol funding_rate calls,
// cached and filled a budgeted batch per cycle. Symbols appear once their interval is known.
//
// The contract and interval caches live HERE, not at package scope as the TypeScript keeps them. In
// Go the collector runs each venue on its own goroutine against a shared process, so package-level
// maps would be unsynchronised shared state -- a data race the detector flags immediately.
type Adapter struct {
	client *httpclient.Client
	budget int

	mu sync.Mutex
	// contracts is replaced wholesale rather than mutated, so a reader holding the previous map is
	// never racing a refresh.
	contracts          map[string]ContractDetail
	contractsLoaded    bool
	contractsFetchedAt int64
	intervals          map[string]IntervalEntry
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return NewAdapterWithOptions(client, Options{})
}

func NewAdapterWithOptions(client *httpclient.Client, opts Options) *Adapter {
	budget := IntervalRefreshBudget
	if opts.IntervalRefreshBudget != nil {
		budget = *opts.IntervalRefreshBudget
	}
	return &Adapter{
		client:    client,
		budget:    budget,
		intervals: map[string]IntervalEntry{},
	}
}

func (a *Adapter) VenueID() string   { return VenueID }
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, baseURL+path, out)
}

// WarmUp seeds the interval cache from markets the collector already has stored.
//
// Intervals are the gate on emitting a market at all, and refilling ~1200 of them at
// IntervalRefreshBudget per cycle takes about half an hour, during which most of MEXC is missing
// from the screener. The stored interval is the same number the API would return, so a restart can
// start from it. FetchedAt 0 keeps every warmed entry due for a real refresh.
func (a *Adapter) WarmUp(markets []KnownMarket) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, market := range markets {
		hours := market.IntervalHours
		if hours == nil || *hours <= 0 {
			continue
		}
		if _, seen := a.intervals[market.VenueSymbol]; seen {
			continue
		}
		a.intervals[market.VenueSymbol] = IntervalEntry{Hours: *hours, NextSettleTime: nil, FetchedAt: 0}
	}
}

// FetchSnapshots runs one cycle: the hourly-cached contract detail, the bulk ticker, then a budgeted
// slice of per-symbol funding_rate calls to fill the interval cache.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()

	a.mu.Lock()
	stale := !a.contractsLoaded || nowMs-a.contractsFetchedAt >= ContractsMaxAgeMs
	a.mu.Unlock()

	if stale {
		var env Envelope[[]ContractDetail]
		if err := a.get(ctx, "/detail", &env); err != nil {
			return core.SnapshotBatch{}, err
		}
		details, err := env.unwrap("contract detail")
		if err != nil {
			return core.SnapshotBatch{}, err
		}
		a.mu.Lock()
		a.contracts = ParseContracts(details)
		a.contractsLoaded = true
		a.contractsFetchedAt = nowMs
		a.mu.Unlock()
	}

	var tickerEnv Envelope[[]Ticker]
	if err := a.get(ctx, "/ticker", &tickerEnv); err != nil {
		return core.SnapshotBatch{}, err
	}
	tickers, err := tickerEnv.unwrap("ticker")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	a.mu.Lock()
	live := a.contracts
	liveSymbols := make([]string, 0, len(tickers))
	for _, ticker := range tickers {
		if _, ok := live[ticker.Symbol]; ok {
			liveSymbols = append(liveSymbols, ticker.Symbol)
		}
	}
	// A market MEXC no longer lists is dropped rather than kept alive by the cache.
	for symbol := range a.intervals {
		if _, ok := live[symbol]; !ok {
			delete(a.intervals, symbol)
		}
	}
	batch := SelectIntervalRefreshes(liveSymbols, a.intervals, nowMs, a.budget, IntervalMaxAgeMs)
	a.mu.Unlock()

	for _, symbol := range batch {
		var env Envelope[FundingRate]
		if err := a.get(ctx, "/funding_rate/"+url.PathEscape(symbol), &env); err != nil {
			// An open circuit means the venue is refusing everything; the rest of the batch would
			// only burn the breaker's cooldown.
			var open *httpclient.CircuitOpenError
			if errors.As(err, &open) {
				break
			}
			// Leave this symbol for a later cycle; one bad symbol shouldn't fail the batch.
			continue
		}
		data, err := env.unwrap("funding_rate " + symbol)
		if err != nil {
			continue
		}
		if entry := ParseFundingRate(data, nowMs); entry != nil {
			a.mu.Lock()
			a.intervals[symbol] = *entry
			a.mu.Unlock()
		}
	}

	a.mu.Lock()
	intervals := make(map[string]IntervalEntry, len(a.intervals))
	for symbol, entry := range a.intervals {
		intervals[symbol] = entry
	}
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: ParseSnapshots(tickers, live, intervals, nowMs), Settled: nil}, nil
}

// FetchLeverageTiers is one bulk call: the ladders sit in the same contract detail the snapshot loop
// uses.
func (a *Adapter) FetchLeverageTiers(ctx context.Context) ([]core.LeverageTier, bool, error) {
	var env Envelope[[]ContractDetail]
	if err := a.get(ctx, "/detail", &env); err != nil {
		return nil, false, err
	}
	details, err := env.unwrap("contract detail")
	if err != nil {
		return nil, false, err
	}
	return ParseLeverageTiers(details), true, nil
}

// FetchFundingHistory pages newest-first until a page reaches back past the window or runs out.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	items := make([]FundingHistoryRow, 0, historyPageSize)

	for page := 1; page <= historyMaxPages; page++ {
		endpoint := fmt.Sprintf("/funding_rate/history?symbol=%s&page_num=%d&page_size=%d",
			url.QueryEscape(venueSymbol), page, historyPageSize)
		var env Envelope[FundingHistoryPage]
		if err := a.get(ctx, endpoint, &env); err != nil {
			return nil, err
		}
		data, err := env.unwrap("funding history")
		if err != nil {
			return nil, err
		}
		items = append(items, data.ResultList...)

		// Pages are newest first: stop once a page reaches back past the window or runs out. An
		// unreadable settleTime makes the minimum NaN, as Math.min does, so the walk continues rather
		// than stopping on a row it could not read.
		oldest := math.Inf(1)
		for _, row := range data.ResultList {
			if !row.SettleTime.OK {
				oldest = math.NaN()
				break
			}
			oldest = math.Min(oldest, row.SettleTime.Val)
		}
		if len(data.ResultList) == 0 || oldest < float64(fromMs) || data.CurrentPage >= data.TotalPage {
			break
		}
	}
	return ParseFundingHistory(items, venueSymbol, fromMs, toMs), nil
}
