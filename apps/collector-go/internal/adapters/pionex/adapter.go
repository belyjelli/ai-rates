package pionex

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Compile-time proof that the warm-up phase can actually see this adapter.
//
// The phase finds its adapters with a type assertion, so a method set that stops matching — a
// reverted alias, a renamed field, a changed parameter — would not fail anywhere: pionex would
// simply never be seeded, and the venue would just look slow to fill after a restart, which is the
// original bug wearing a different hat. This line makes that a build failure instead.
var _ collector.WarmUpper = (*Adapter)(nil)

// MinInterval is the spacing this venue's client should use: 10 weight per second per IP, shared by
// every endpoint, and the symbol list alone weighs 5.
const MinInterval = 150 * time.Millisecond

// KnownMarket is the shared type, ALIASED rather than redeclared.
//
// It must be an alias. Go method sets are nominal, so a WarmUp([]pionex.KnownMarket) does not
// satisfy WarmUp([]collector.KnownMarket) even though the two structs are field-for-field
// identical — the warm-up phase's type assertion would skip this adapter and pionex would never be
// seeded, compiling cleanly while doing nothing. Identical shape makes that harder to notice, not
// easier.
//
// (An earlier revision declared its own struct here, noting that the collector carried no warm-up
// hook. That is no longer true: internal/collector now defines KnownMarket and WarmUpper, and
// cmd/collector seeds every adapter that implements them before the first cycle.)
type KnownMarket = collector.KnownMarket

// Options configures the adapter.
//
// IntervalRefreshBudget is a pointer so that an explicit 0 -- no per-symbol calls at all, which the
// warm-up test relies on -- is distinguishable from "unset", exactly as the TypeScript `??` is.
type Options struct {
	IntervalRefreshBudget *int
}

// Adapter collects Pionex's perpetuals.
//
// The symbol and interval caches live HERE, not at package scope as the TypeScript keeps them. In Go
// the collector runs each venue on its own goroutine against a shared process, so package-level maps
// would be unsynchronised shared state -- a data race the detector flags immediately, and a cache
// silently interleaved between venues if it did not.
type Adapter struct {
	client *httpclient.Client
	budget int

	mu sync.Mutex
	// symbols is replaced wholesale rather than mutated, so a reader holding the previous map is
	// never racing a refresh.
	symbols          map[string]Symbol
	symbolsLoaded    bool
	symbolsFetchedAt int64
	intervals        map[string]IntervalEntry
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

// WarmUp seeds the interval cache from markets the collector already has stored. Call it once before
// the first cycle.
//
// The interval is the gate on emitting a market at all, and refilling ~570 of them at
// IntervalRefreshBudget a cycle takes about 19 cycles, during which most of Pionex is missing from
// the screener. The stored interval is what the history would say again, so a restart can start from
// it; FetchedAt 0 keeps every warmed entry due for a real re-read.
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
		warmed := *hours
		a.intervals[market.VenueSymbol] = IntervalEntry{Hours: &warmed, FetchedAt: 0}
	}
}

// fundingRatesURL builds the one endpoint that is asked per symbol. `endTime` is omitted entirely
// rather than sent empty, since the interval read wants the newest page.
func fundingRatesURL(symbol string, limit int, endTime *int64) string {
	window := ""
	if endTime != nil {
		window = fmt.Sprintf("&endTime=%d", *endTime)
	}
	return fmt.Sprintf("%s/market/fundingRates?symbol=%s%s&limit=%d", API, url.QueryEscape(symbol), window, limit)
}

// get fetches one envelope and unwraps it, so a `result: false` body fails the call rather than
// reading as an empty venue.
func get[T any](ctx context.Context, a *Adapter, endpoint, what string) (T, error) {
	var env Envelope[T]
	if err := a.client.GetJSON(ctx, endpoint, &env); err != nil {
		var zero T
		return zero, err
	}
	return env.unwrap(what)
}

// FetchSnapshots runs one cycle: the hourly-cached symbol list, four bulk responses, then a budgeted
// slice of per-symbol fundingRates calls to fill the interval cache.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()

	a.mu.Lock()
	stale := !a.symbolsLoaded || nowMs-a.symbolsFetchedAt >= SymbolsMaxAgeMs
	a.mu.Unlock()

	if stale {
		data, err := get[SymbolList](ctx, a, API+"/common/symbols?type=PERP", "symbols")
		if err != nil {
			return core.SnapshotBatch{}, err
		}
		a.mu.Lock()
		a.symbols = TradablePerps(data.Symbols)
		a.symbolsLoaded = true
		a.symbolsFetchedAt = nowMs
		a.mu.Unlock()
	}

	indexes, err := get[IndexList](ctx, a, API+"/market/indexes", "indexes")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	tickers, err := get[TickerList](ctx, a, API+"/market/tickers?type=PERP", "tickers")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	openInterests, err := get[OpenInterestList](ctx, a, API+"/market/openInterests?type=PERP", "open interests")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	bookTickers, err := get[BookTickerList](ctx, a, API+"/market/bookTickers?type=PERP", "book tickers")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	nextFunding := make(map[string]*int64, len(indexes.Indexes))
	for _, index := range indexes.Indexes {
		nextFunding[index.Symbol] = index.NextFundingTime.PositiveMs()
	}

	a.mu.Lock()
	live := a.symbols
	// A market Pionex no longer lists is dropped rather than kept alive by the cache.
	for symbol := range a.intervals {
		if _, listed := live[symbol]; !listed {
			delete(a.intervals, symbol)
		}
	}
	liveSymbols := make([]string, 0, len(indexes.Indexes))
	for _, index := range indexes.Indexes {
		if _, listed := live[index.Symbol]; listed {
			liveSymbols = append(liveSymbols, index.Symbol)
		}
	}
	batch := adapters.SelectRefreshBatch(liveSymbols, func(symbol string) (int64, bool) {
		entry, known := a.intervals[symbol]
		return entry.FetchedAt, known
	}, nowMs, a.budget, IntervalMaxAgeMs)
	a.mu.Unlock()

	for _, symbol := range batch {
		data, err := get[FundingRateList](ctx, a, fundingRatesURL(symbol, intervalSample, nil), "funding rates "+symbol)
		if err != nil {
			// An open circuit means the venue is refusing everything; the rest of the batch would only
			// burn the breaker's cooldown.
			var open *httpclient.CircuitOpenError
			if errors.As(err, &open) {
				break
			}
			// Leave this symbol for a later cycle; one bad symbol shouldn't fail the batch.
			continue
		}

		hours := IntervalHours(data.Rates, nextFunding[symbol])
		a.mu.Lock()
		if hours != nil && *hours > 0 {
			a.intervals[symbol] = IntervalEntry{Hours: hours, FetchedAt: nowMs}
		} else {
			// Nothing settled yet. Keep any interval already known, and come back sooner than the full
			// max age by back-dating the entry.
			a.intervals[symbol] = IntervalEntry{
				Hours:     a.intervals[symbol].Hours,
				FetchedAt: nowMs - IntervalMaxAgeMs + intervalRetryMs,
			}
		}
		a.mu.Unlock()
	}

	a.mu.Lock()
	intervals := make(map[string]IntervalEntry, len(a.intervals))
	for symbol, entry := range a.intervals {
		intervals[symbol] = entry
	}
	a.mu.Unlock()

	snapshots := ParseSnapshots(SnapshotInput{
		Symbols:       live,
		Indexes:       indexes.Indexes,
		Tickers:       tickers.Tickers,
		OpenInterests: openInterests.OpenInterests,
		BookTickers:   bookTickers.Tickers,
		Intervals:     intervals,
	}, nowMs)
	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// FetchFundingHistory pages backwards from toMs for one perp.
//
// Pionex serves newest first, `endTime` is inclusive and `startTime` is ignored outright, so the
// only way through a window is to walk it back one page at a time.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingRate, 0, historyPageSize)
	endTime := toMs

	for page := 0; page < historyMaxPages && endTime >= fromMs; page++ {
		data, err := get[FundingRateList](ctx, a, fundingRatesURL(venueSymbol, historyPageSize, &endTime), "funding rates")
		if err != nil {
			return nil, err
		}
		rows = append(rows, data.Rates...)
		if len(data.Rates) < historyPageSize {
			break
		}

		// An unreadable fundingTime makes the minimum NaN, as Math.min does over a NaN, so the walk
		// stops rather than paging from a timestamp it could not read.
		oldest := math.Inf(1)
		for _, row := range data.Rates {
			if !row.FundingTime.OK {
				oldest = math.NaN()
				break
			}
			oldest = math.Min(oldest, row.FundingTime.Val)
		}
		if math.IsNaN(oldest) || math.IsInf(oldest, 1) {
			break
		}
		endTime = int64(oldest) - 1
	}

	a.mu.Lock()
	fallbackHours := a.intervals[venueSymbol].Hours
	var quote *string
	if symbol, listed := a.symbols[venueSymbol]; listed {
		declared := symbol.QuoteCurrency
		quote = &declared
	}
	a.mu.Unlock()

	return ParseFundingHistory(venueSymbol, rows, fromMs, toMs, fallbackHours, quote), nil
}
