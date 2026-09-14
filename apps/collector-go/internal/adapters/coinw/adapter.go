package coinw

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// API is the base every CoinW endpoint here hangs off.
	API = "https://api.coinw.com/v1"

	// MinInterval is the spacing this venue's client should use.
	//
	// 8 requests a second per IP on the funding endpoint, 5 on tickers; 150ms is 6.7.
	MinInterval = 150 * time.Millisecond

	// InstrumentsMaxAge: instruments are 550 KB; the list and intervals change rarely, so hourly.
	InstrumentsMaxAge = time.Hour

	// FundingRefreshBudget and FundingMaxAge bound the per-contract sweep; see the package header.
	FundingRefreshBudget = 120
	FundingMaxAge        = 10 * time.Minute

	// fundingRetry is how long a contract CoinW doesn't know, or one with nothing settled yet, waits
	// before being asked again.
	fundingRetry = 30 * time.Minute
)

// Options configures one adapter. The zero value takes the package defaults.
type Options struct {
	// FundingRefreshBudget is per-contract funding calls per cycle; zero means FundingRefreshBudget.
	FundingRefreshBudget int
}

// Adapter collects CoinW's USDT-margined perpetuals.
//
// Two bulk requests a cycle at most (instruments once an hour, tickers every cycle) plus up to
// FundingRefreshBudget per-contract funding calls.
//
// The instrument cache and the funding cache live HERE, not at package scope as the TypeScript keeps
// them in its factory closure. In Go the collector runs each venue on its own goroutine against a
// shared process, so a package-level cache would be unsynchronised shared state — a data race the
// detector flags immediately, and a silently torn cache if it did not.
//
// There is no FetchFundingHistory: CoinW publishes none. Each newly seen settlement is returned in
// the batch's Settled instead.
type Adapter struct {
	client *httpclient.Client
	budget int

	mu                   sync.Mutex
	instruments          []Instrument
	instrumentsFetchedAt int64
	hasInstruments       bool
	funding              map[string]FundingEntry
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return NewAdapterWithOptions(client, Options{})
}

func NewAdapterWithOptions(client *httpclient.Client, options Options) *Adapter {
	budget := options.FundingRefreshBudget
	if budget == 0 {
		budget = FundingRefreshBudget
	}
	return &Adapter{
		client:  client,
		budget:  budget,
		funding: make(map[string]FundingEntry),
	}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, API+path, out)
}

// unwrapList reads a bulk envelope. An absent data array is an error rather than an empty book: a
// venue-side failure must never read as "this venue lists nothing".
func unwrapList[T any](env Envelope[[]T], what string) ([]T, error) {
	if env.Code != codeOK || env.Data == nil {
		return nil, fmt.Errorf("coinw %s: %d %s", what, env.Code, env.Msg)
	}
	return env.Data, nil
}

// FetchSnapshots runs one cycle: the instrument list once an hour, the tickers every cycle, then a
// budgeted slice of the per-contract funding sweep.
//
// A contract appears only once its settled rate is known and still current, so a cold start reveals
// the venue over about four cycles rather than publishing stale or empty rows.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()

	a.mu.Lock()
	stale := !a.hasInstruments || nowMs-a.instrumentsFetchedAt >= InstrumentsMaxAge.Milliseconds()
	a.mu.Unlock()

	if stale {
		var env Envelope[[]Instrument]
		if err := a.get(ctx, "/perpum/instruments", &env); err != nil {
			return core.SnapshotBatch{}, err
		}
		rows, err := unwrapList(env, "instruments")
		if err != nil {
			return core.SnapshotBatch{}, err
		}
		a.mu.Lock()
		a.instruments = rows
		a.instrumentsFetchedAt = nowMs
		a.hasInstruments = true
		a.mu.Unlock()
	}

	var tickersEnv Envelope[[]Ticker]
	if err := a.get(ctx, "/perpumPublic/tickers", &tickersEnv); err != nil {
		return core.SnapshotBatch{}, err
	}
	tickers, err := unwrapList(tickersEnv, "tickers")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	a.mu.Lock()
	instruments := a.instruments
	a.mu.Unlock()

	collectable := make([]Instrument, 0, len(instruments))
	names := make([]string, 0, len(instruments))
	periods := make(map[string]float64, len(instruments))
	byName := make(map[string]Instrument, len(instruments))
	for _, instrument := range instruments {
		if !IsCollectable(instrument, nowMs) {
			continue
		}
		collectable = append(collectable, instrument)
		names = append(names, instrument.Name)
		periods[instrument.Name] = instrument.SettledPeriod.Val
		byName[instrument.Name] = instrument
	}

	tickerByContract := make(map[int64]Ticker, len(tickers))
	for _, ticker := range tickers {
		tickerByContract[ticker.ContractID] = ticker
	}

	a.mu.Lock()
	for name := range a.funding {
		if _, listed := periods[name]; !listed {
			delete(a.funding, name)
		}
	}
	// An entry whose settlement period has elapsed counts as never fetched, so it goes first: its
	// rate is no longer the latest, and until a new one lands the market is hidden rather than stale.
	fetchedAt := func(name string) (int64, bool) {
		entry, cached := a.funding[name]
		if !cached || IsEntryOverdue(entry, periods[name], nowMs) {
			return 0, false
		}
		return entry.FetchedAt, true
	}
	batch := adapters.SelectRefreshBatch(names, fetchedAt, nowMs, a.budget, FundingMaxAge.Milliseconds())
	a.mu.Unlock()

	settled := make([]core.FundingEvent, 0, len(batch))
	for _, name := range batch {
		var env Envelope[*FundingRate]
		err := a.get(ctx, "/perpum/fundingRate?instrument="+url.QueryEscape(name), &env)
		var parsed *ParsedFunding
		if err == nil {
			parsed, err = ParseFundingRate(env)
		}
		if err != nil {
			var open *httpclient.CircuitOpenError
			if errors.As(err, &open) {
				break
			}
			// Leave this contract for a later cycle; one bad answer shouldn't fail the batch.
			continue
		}

		a.mu.Lock()
		previous, hadPrevious := a.funding[name]
		if parsed == nil || parsed.Rate == nil || parsed.SettledAt == nil {
			// Held with a fetchedAt far enough in the past that the next sweep skips it and the one
			// after fundingRetry picks it up.
			a.funding[name] = FundingEntry{
				FetchedAt: nowMs - FundingMaxAge.Milliseconds() + fundingRetry.Milliseconds(),
			}
			a.mu.Unlock()
			continue
		}
		a.funding[name] = FundingEntry{Rate: parsed.Rate, SettledAt: parsed.SettledAt, FetchedAt: nowMs}
		a.mu.Unlock()

		instrument, known := byName[name]
		if !known {
			continue
		}
		ticker, hasTicker := tickerByContract[instrument.ID]
		// A settlement already reported is not reported again: only a timestamp we have not seen for
		// this contract becomes an event.
		fresh := !hadPrevious || previous.SettledAt == nil || *previous.SettledAt != *parsed.SettledAt
		if hasTicker && fresh {
			settled = append(settled, core.FundingEvent{
				MarketRef:  RefFor(instrument, ticker.Name),
				SettledAt:  *parsed.SettledAt,
				Rate:       *parsed.Rate,
				BasisHours: periods[name],
				MarkPrice:  nil,
			})
		}
	}

	a.mu.Lock()
	funding := maps.Clone(a.funding)
	a.mu.Unlock()

	snapshots := ParseSnapshots(SnapshotInput{
		Instruments: collectable,
		Tickers:     tickers,
		Funding:     funding,
	}, nowMs)
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}, nil
}
