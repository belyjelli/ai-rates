package polymarket

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// API is the REST base. Exported so a caller can point a probe at the same base the adapter uses.
	API = "https://api.perpetuals.polymarket.com/v1/info"

	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's minIntervalMs
	// of 250. The OpenAPI document weighs tickers, statistics and instruments at 2 and funding history
	// at 10 against a per-IP token bucket whose size it does not publish, so 250ms keeps a cycle well
	// under any sane bucket. Exported because the spacing lives on the client the caller builds, not
	// on the adapter.
	MinInterval = 250 * time.Millisecond

	// instrumentsTTL: /instruments states the type, category, base, quote and interval, none of which
	// move within an hour.
	instrumentsTTL = time.Hour

	// historyPageSize: /v1/info/funding returns at most 100 rows per call, newest first, with a `more`
	// flag.
	historyPageSize = 100
	historyMaxPages = 100
)

// Adapter collects Polymarket Perps: two bulk calls a cycle plus the hourly instrument list.
//
// The instrument cache is mutex-guarded ADAPTER state, where the TypeScript keeps it in a closure over
// the module's single adapter instance. In Go the collector runs each venue on its own goroutine
// against a shared process, and both FetchSnapshots and FetchFundingHistory load the list, so an
// unsynchronised field would be a data race the detector flags immediately: a backfill reads it while
// a snapshot cycle is replacing it.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// instruments is replaced wholesale rather than mutated, so a reader holding the previous slice is
	// never racing a refresh.
	instruments          []Instrument
	instrumentsFetchedAt time.Time
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// loadInstruments reads /instruments at most once an hour.
//
// A null body decodes to a nil slice, which is this venue's shape of "not the list we asked for" --
// the same rejection the TypeScript side makes with Array.isArray. An empty list decodes non-nil and
// is a legitimate answer, so it is cached rather than refetched every cycle.
func (a *Adapter) loadInstruments(ctx context.Context, now time.Time) ([]Instrument, error) {
	a.mu.Lock()
	cached, fetchedAt := a.instruments, a.instrumentsFetchedAt
	a.mu.Unlock()

	if cached != nil && now.Sub(fetchedAt) < instrumentsTTL {
		return cached, nil
	}

	var body []Instrument
	if err := a.client.GetJSON(ctx, API+"/instruments", &body); err != nil {
		return nil, err
	}
	if body == nil {
		return nil, ErrUnexpectedInstruments
	}

	a.mu.Lock()
	a.instruments, a.instrumentsFetchedAt = body, now
	a.mu.Unlock()
	return body, nil
}

// FetchSnapshots runs one cycle: the hourly instrument list for type, category, base and quote, the
// tickers for funding, mark, index and open interest, and the statistics for 24h volume.
//
// Settled is always empty: the tickers carry the rolling rate for the OPEN charge window, which is a
// prediction, and realized settlements live only behind the per-instrument funding endpoint.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	listed, err := a.loadInstruments(ctx, now)
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var tickers []Ticker
	if err := a.client.GetJSON(ctx, API+"/tickers", &tickers); err != nil {
		return core.SnapshotBatch{}, err
	}
	if tickers == nil {
		return core.SnapshotBatch{}, ErrUnexpectedTickers
	}

	var statistics []Statistic
	if err := a.client.GetJSON(ctx, API+"/statistics", &statistics); err != nil {
		return core.SnapshotBatch{}, err
	}
	if statistics == nil {
		return core.SnapshotBatch{}, ErrUnexpectedStatistics
	}

	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(listed, tickers, statistics, now.UnixMilli()),
		Settled:   []core.FundingEvent{},
	}, nil
}

// FetchFundingHistory pages backwards from toMs for one instrument.
//
// The endpoint addresses an instrument by NUMERIC ID, not by symbol, so the instrument list has to be
// loaded first; a symbol the venue does not list has no history rather than an error. Each page is at
// most 100 rows, newest first, so the walk steps end_timestamp back past the oldest row it read.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	listed, err := a.loadInstruments(ctx, time.Now())
	if err != nil {
		return nil, err
	}
	var instrument Instrument
	found := false
	for _, candidate := range listed {
		if candidate.Symbol == venueSymbol {
			instrument, found = candidate, true
			break
		}
	}
	if !found {
		return []core.FundingEvent{}, nil
	}

	rows := make([]FundingRow, 0, historyPageSize)
	endMs := toMs
	for page := 0; page < historyMaxPages && endMs >= fromMs; page++ {
		var body FundingPage
		if err := a.client.GetJSON(ctx, fmt.Sprintf(
			"%s/funding?instrument_id=%d&start_timestamp=%d&end_timestamp=%d",
			API, instrument.InstrumentID, fromMs, endMs), &body); err != nil {
			return nil, err
		}
		if body.Data == nil {
			return nil, ErrUnexpectedFunding
		}
		data := *body.Data
		rows = append(rows, data...)

		oldest, readable := oldestTimestamp(data)
		if !body.More || len(data) < historyPageSize || !readable {
			break
		}
		endMs = oldest - 1
	}
	return ParseFundingHistory(rows, instrument, fromMs, toMs), nil
}
