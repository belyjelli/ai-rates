package grvt

import (
	"context"
	"errors"
	"math/big"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// API is GRVT's market data base. Every endpoint here is a POST with a JSON body; there is no GET
// form, which is why this adapter uses PostJSON throughout.
const API = "https://market-data.grvt.io/full/v1"

const (
	// MinInterval is this venue's minimum spacing between requests, ported from the TypeScript
	// adapter's minIntervalMs: 100. Undocumented window on `x-ratelimit-limit: 1500`; 100 tickers
	// start over 10s.
	MinInterval = 100 * time.Millisecond

	// InstrumentsMaxAge is how long a listing stays good. Instruments change when GRVT lists
	// something, so hourly.
	InstrumentsMaxAge = 60 * time.Minute

	// TickerBudget is tickers per cycle; see the package comment's REQUESTS note.
	TickerBudget = 100

	// historyPageSize: `limit` "Defaults to 500; Max 1000" for the funding history.
	historyPageSize = 1000
	historyMaxPages = 20
)

// Options configures one adapter.
//
// TickerBudget is a pointer so that an explicit 0 -- no ticker calls at all -- is distinguishable
// from "unset", exactly as the TypeScript `??` is.
type Options struct {
	TickerBudget *int
}

// Adapter collects GRVT.
//
// The instrument listing and the rotation cursor live HERE, not at package scope as the TypeScript
// keeps them in its factory closure. In Go the collector runs each venue on its own goroutine
// against a shared process, and FetchFundingHistory reads the same listing FetchSnapshots writes,
// so both are mutex-guarded -- unsynchronised they are a data race the detector flags immediately,
// and a silently torn cache if it did not.
type Adapter struct {
	client *httpclient.Client
	budget int

	mu                   sync.Mutex
	instruments          Perps
	instrumentsLoaded    bool
	instrumentsFetchedAt int64
	// lastFetched is when each instrument's ticker was last requested, for the rotation.
	lastFetched map[string]int64
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return NewAdapterWithOptions(client, Options{})
}

func NewAdapterWithOptions(client *httpclient.Client, options Options) *Adapter {
	budget := TickerBudget
	if options.TickerBudget != nil {
		budget = *options.TickerBudget
	}
	return &Adapter{client: client, budget: budget, lastFetched: map[string]int64{}}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

type instrumentsResponse struct {
	// Result is a pointer so an absent or null `result` is distinguishable from an empty listing,
	// which is what the TypeScript `!Array.isArray(body?.result)` guard turns into a thrown error.
	Result *[]Instrument `json:"result"`
}

type tickerResponse struct {
	Result *Ticker `json:"result"`
}

type fundingResponse struct {
	Result *[]FundingRow `json:"result"`
	Next   string        `json:"next"`
}

// loadInstruments returns the cached listing, refreshing it once an hour.
func (a *Adapter) loadInstruments(ctx context.Context, nowMs int64) (Perps, error) {
	a.mu.Lock()
	fresh := a.instrumentsLoaded && nowMs-a.instrumentsFetchedAt < InstrumentsMaxAge.Milliseconds()
	live := a.instruments
	a.mu.Unlock()
	if fresh {
		return live, nil
	}

	var body instrumentsResponse
	if err := a.client.PostJSON(ctx, API+"/all_instruments", map[string]any{"is_active": true}, &body); err != nil {
		return Perps{}, err
	}
	if body.Result == nil {
		return Perps{}, ErrUnexpectedInstruments
	}
	perps := TradablePerps(*body.Result)

	a.mu.Lock()
	a.instruments = perps
	a.instrumentsLoaded = true
	a.instrumentsFetchedAt = nowMs
	a.mu.Unlock()
	return perps, nil
}

// FetchSnapshots runs one cycle: the hourly-cached instrument list, then a rotating slice of
// per-instrument ticker reads.
//
// Only the slice this cycle actually read is emitted. The collector appends every snapshot without
// a conflict key, so re-emitting a ticker read two minutes ago would write the same observation
// twice; the sweep is shorter than the screener's freshness window, so nothing drops out.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	live, err := a.loadInstruments(ctx, nowMs)
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	a.mu.Lock()
	// An instrument GRVT no longer lists is dropped rather than kept alive by the cursor.
	for name := range a.lastFetched {
		if _, listed := live.Get(name); !listed {
			delete(a.lastFetched, name)
		}
	}
	// maxAge 0: pure rotation, never-fetched first, then oldest first.
	batch := adapters.SelectRefreshBatch(live.Names, func(name string) (int64, bool) {
		at, known := a.lastFetched[name]
		return at, known
	}, nowMs, a.budget, 0)
	for _, name := range batch {
		a.lastFetched[name] = nowMs
	}
	a.mu.Unlock()

	snapshots := make([]core.FundingSnapshot, 0, len(batch))
	var firstErr, circuitErr error
	for _, name := range batch {
		var body tickerResponse
		if err := a.client.PostJSON(ctx, API+"/ticker", map[string]any{"instrument": name}, &body); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			var open *httpclient.CircuitOpenError
			if circuitErr == nil && errors.As(err, &open) {
				circuitErr = err
			}
			continue
		}
		instrument, listed := live.Get(name)
		if !listed {
			continue
		}
		if snapshot := ParseTicker(instrument, body.Result, nowMs); snapshot != nil {
			snapshots = append(snapshots, *snapshot)
		}
	}

	// A slice where every call failed is a failed cycle, not a venue with nothing to report. An open
	// circuit is reported ahead of whatever failed first, since it is the reason the rest failed.
	if len(snapshots) == 0 && firstErr != nil {
		if circuitErr != nil {
			return core.SnapshotBatch{}, circuitErr
		}
		return core.SnapshotBatch{}, firstErr
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// nsString is an epoch-millisecond instant as the nanosecond string GRVT's window bounds take,
// floored at zero.
//
// big.Int rather than ms*1_000_000, which is what BigInt is doing on the TypeScript side: a caller
// passing an open upper bound (the TypeScript history tests pass Number.MAX_SAFE_INTEGER) would
// overflow an int64 multiply silently and send the venue a negative window.
func nsString(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	return new(big.Int).Mul(big.NewInt(ms), nsPerMs).String()
}

// FetchFundingHistory returns settled payments for one instrument in [fromMs, toMs], oldest first.
//
// GRVT serves newest first and the cursor walks back through [start_time, end_time], so the window
// is covered by following `next` until a short page.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	// The listing is keyed to the wall clock, not to the window being asked about: it decides what
	// is listed NOW, exactly as the TypeScript side's Date.now() does.
	live, err := a.loadInstruments(ctx, time.Now().UnixMilli())
	if err != nil {
		return nil, err
	}
	instrument, listed := live.Get(venueSymbol)
	if !listed {
		return nil, nil
	}

	rows := make([]FundingRow, 0, historyPageSize)
	cursor := ""
	for page := 0; page < historyMaxPages; page++ {
		request := map[string]any{
			"instrument": venueSymbol,
			"start_time": nsString(fromMs),
			"end_time":   nsString(toMs),
			"limit":      historyPageSize,
		}
		if cursor != "" {
			request["cursor"] = cursor
		}
		var body fundingResponse
		if err := a.client.PostJSON(ctx, API+"/funding", request, &body); err != nil {
			return nil, err
		}
		if body.Result == nil {
			return nil, ErrUnexpectedFunding
		}
		batch := *body.Result
		rows = append(rows, batch...)
		if len(batch) < historyPageSize || body.Next == "" {
			break
		}
		cursor = body.Next
	}
	return ParseFunding(rows, instrument, fromMs, toMs), nil
}
