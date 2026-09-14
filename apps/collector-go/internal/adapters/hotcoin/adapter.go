package hotcoin

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
// The phase finds its adapters with a type assertion, so a method set that stops matching -- a
// reverted alias, a renamed field, a changed parameter -- would not fail anywhere: hotcoin would
// simply never be seeded, and the venue would just look slow to fill after a restart. This line
// makes that a build failure instead.
var _ collector.WarmUpper = (*Adapter)(nil)

// MinInterval is the spacing this venue's client should use. Public market endpoints are documented
// at 10 requests/s per IP, with 429s and an IP ban for continued violation.
const MinInterval = 150 * time.Millisecond

// KnownMarket is the shared type, ALIASED rather than redeclared.
//
// It must be an alias. Go method sets are nominal, so a WarmUp([]hotcoin.KnownMarket) does not
// satisfy WarmUp([]collector.KnownMarket) even though the two structs are field-for-field identical
// -- the warm-up phase's type assertion would skip this adapter and hotcoin would never be seeded,
// compiling cleanly while doing nothing. Identical shape makes that harder to notice, not easier.
type KnownMarket = collector.KnownMarket

// Options configures the adapter.
//
// IntervalRefreshBudget is a pointer so that an explicit 0 -- no per-contract calls at all, which
// the warm-up test relies on -- is distinguishable from "unset", exactly as the TypeScript `??` is.
type Options struct {
	IntervalRefreshBudget *int
}

// Adapter collects Hotcoin's perpetuals.
//
// One bulk call a cycle, plus a budgeted slice of per-contract fee-rate calls to fill the interval
// cache, which is the gate on emitting a market at all.
//
// The interval and class caches live HERE, not at package scope as the TypeScript keeps them in a
// closure. In Go the collector runs each venue on its own goroutine against a shared process, so
// package-level maps would be unsynchronised shared state -- a data race the detector flags
// immediately, and a cache silently interleaved between venues if it did not.
type Adapter struct {
	client *httpclient.Client
	budget int

	mu        sync.Mutex
	intervals map[string]IntervalEntry
	// classes carries the class a snapshot settled on into the history fetcher, which has only a
	// symbol to go on.
	classes map[string]core.AssetClass
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
		classes:   map[string]core.AssetClass{},
	}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// feeRateURL is the one endpoint asked per contract, for both the interval read and the history
// walk.
func feeRateURL(code string, page, pageSize int) string {
	return fmt.Sprintf("%s/%s/fee-rate?page=%d&pageSize=%d", API, url.PathEscape(code), page, pageSize)
}

// get fetches one envelope and unwraps it, so a non-200 body fails the call rather than reading as
// an empty venue.
func get[T any](ctx context.Context, a *Adapter, endpoint, what string) (T, error) {
	var env Envelope[T]
	if err := a.client.GetJSON(ctx, endpoint, &env); err != nil {
		var zero T
		return zero, err
	}
	return env.unwrap(what)
}

// WarmUp seeds the interval cache from markets the collector already has stored. Call it once before
// the first cycle.
//
// The interval is the gate on emitting a market at all, and refilling 549 of them at
// IntervalRefreshBudget a cycle takes 14 cycles, during which most of Hotcoin is missing from the
// screener. The stored interval is what the history would say again, so a restart can start from it;
// FetchedAt 0 keeps every warmed entry due for a real re-read.
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

// FetchSnapshots runs one cycle: the bulk list, then a budgeted slice of per-contract fee-rate calls
// to fill the interval cache.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()

	rows, err := get[[]Ticker](ctx, a, API, "perpetual/public")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	codes, live := TradableTickers(rows)

	a.mu.Lock()
	// A contract Hotcoin no longer lists is dropped rather than kept alive by the cache.
	for code := range a.intervals {
		if _, listed := live[code]; !listed {
			delete(a.intervals, code)
		}
	}
	batch := adapters.SelectRefreshBatch(codes, func(code string) (int64, bool) {
		entry, known := a.intervals[code]
		return entry.FetchedAt, known
	}, nowMs, a.budget, IntervalMaxAgeMs)
	a.mu.Unlock()

	for _, code := range batch {
		page, err := get[FeeRatePage](ctx, a, feeRateURL(code, 1, intervalSample), "fee-rate "+code)
		if err != nil {
			// An open circuit means the venue is refusing everything; the rest of the batch would only
			// burn the breaker's cooldown.
			var open *httpclient.CircuitOpenError
			if errors.As(err, &open) {
				break
			}
			// Leave this contract for a later cycle; one bad contract shouldn't fail the batch.
			continue
		}

		hours := IntervalHours(page.Rows, live[code].LiquidationTime.PositiveMs())
		a.mu.Lock()
		if hours != nil && *hours > 0 {
			a.intervals[code] = IntervalEntry{Hours: hours, FetchedAt: nowMs}
		} else {
			// Nothing settled yet. Keep any interval already known, and come back sooner than the full
			// max age by back-dating the entry.
			a.intervals[code] = IntervalEntry{
				Hours:     a.intervals[code].Hours,
				FetchedAt: nowMs - IntervalMaxAgeMs + intervalRetryMs,
			}
		}
		a.mu.Unlock()
	}

	a.mu.Lock()
	intervals := make(map[string]IntervalEntry, len(a.intervals))
	for code, entry := range a.intervals {
		intervals[code] = entry
	}
	a.mu.Unlock()

	// Ranged over the ORDER SLICE, so the snapshots keep the venue's own order rather than a Go
	// map's randomised one.
	ordered := make([]Ticker, 0, len(codes))
	for _, code := range codes {
		ordered = append(ordered, live[code])
	}
	snapshots := ParseSnapshots(ordered, intervals, nowMs)

	classes := make(map[string]core.AssetClass, len(snapshots))
	for _, snapshot := range snapshots {
		classes[snapshot.VenueSymbol] = snapshot.AssetClass
	}
	a.mu.Lock()
	a.classes = classes
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// FetchFundingHistory pages back through one contract's settlements.
//
// `/{code}/fee-rate` is newest first with no time filter, so the only way through a window is to
// page back until a page reaches past fromMs or runs short.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FeeRate, 0, HistoryPageSize)

	for page := 1; page <= historyMaxPages; page++ {
		data, err := get[FeeRatePage](ctx, a, feeRateURL(venueSymbol, page, HistoryPageSize), "fee-rate "+venueSymbol)
		if err != nil {
			return nil, err
		}
		rows = append(rows, data.Rows...)

		// An unreadable stamp counts as +Inf rather than poisoning the minimum, exactly as the
		// TypeScript's `?? Number.POSITIVE_INFINITY` does, so one bad row cannot stop the walk.
		oldest := math.Inf(1)
		for _, row := range data.Rows {
			if row.CreatedDate.OK {
				oldest = math.Min(oldest, row.CreatedDate.Val)
			}
		}
		if len(data.Rows) < HistoryPageSize || oldest < float64(fromMs) {
			break
		}
	}

	a.mu.Lock()
	fallbackHours := a.intervals[venueSymbol].Hours
	var assetClass *core.AssetClass
	if class, known := a.classes[venueSymbol]; known {
		assetClass = &class
	}
	a.mu.Unlock()

	return ParseFundingHistory(venueSymbol, rows, fromMs, toMs, fallbackHours, assetClass), nil
}
