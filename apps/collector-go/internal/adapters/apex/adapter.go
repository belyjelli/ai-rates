package apex

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// MinInterval is the spacing this venue's client should use. The limit is "600 requests per 60
	// secs Per IP" (https://api-docs.omni.apex.exchange/); 150ms puts a cycle's 64 starts in ~10s.
	MinInterval = 150 * time.Millisecond

	// SymbolsMaxAge: `/v3/symbols` is ~750 KB and only says what trades and what it is, so hourly.
	SymbolsMaxAge = 60 * time.Minute

	// TickerBudget is tickers per cycle; see the Adapter doc.
	TickerBudget = 64

	// historyPageSize: `limit` above 100 is refused with "invalid get page size" (measured with 500).
	historyPageSize = 100
	historyMaxPages = 50
)

// ErrUnexpectedSymbols mirrors the TypeScript adapter's throw when `/v3/symbols` comes back without
// a `contractConfig`. A response that lost its payload has to fail the venue's cycle rather than
// read as a venue with nothing listed.
var ErrUnexpectedSymbols = errors.New("apex: unexpected symbols response")

// Options configures one adapter.
//
// TickerBudget is a pointer so that an explicit 0 -- no ticker calls at all -- is distinguishable
// from "unset", exactly as the TypeScript `??` is.
type Options struct {
	TickerBudget *int
}

// Adapter collects ApeX Omni.
//
// REQUESTS: `GET /v3/ticker` answers one symbol at a time (without `symbol` it returns `[]`, and no
// all-tickers route exists: `/v3/tickers`, `/v3/all-ticker` and `/v3/ticker/all` are 404, `/v3/funding`
// needs API-key headers). So each cycle is `GET /v3/symbols` once an hour (~750 KB) plus
// TickerBudget tickers, least recently fetched first. With 125 tradable contracts on 2026-09-13
// that is 64 requests a cycle and every contract re-read every 2 cycles (~2 minutes), inside the
// screener's 5-minute window.
//
// WHY ONLY THIS CYCLE'S SLICE IS EMITTED: the collector appends snapshots to `funding_snapshots`
// with no conflict key, so repeating a ticker read in a later cycle would store it twice. A contract
// appears in the cycles that read it, and the 2-minute sweep keeps it in `market_latest`. There is
// nothing for a warm-up hook to seed, since the rate is the per-symbol read -- which is why this
// adapter deliberately implements no WarmUp.
//
// The symbol book and the rotation cursor live HERE, not at package scope as the TypeScript keeps
// them in its factory closure. In Go the collector runs each venue on its own goroutine against a
// shared process, and FetchFundingHistory reads the same book FetchSnapshots writes, so both are
// mutex-guarded -- unsynchronised they are a data race the detector flags immediately, and a
// silently torn cache if it did not.
type Adapter struct {
	client *httpclient.Client
	budget int

	mu sync.Mutex
	// book is replaced wholesale rather than mutated, so a reader holding the previous one is never
	// racing a refresh.
	book          Book
	bookLoaded    bool
	bookFetchedAt int64
	lastFetched   map[string]int64
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return NewAdapterWithOptions(client, Options{})
}

func NewAdapterWithOptions(client *httpclient.Client, opts Options) *Adapter {
	budget := TickerBudget
	if opts.TickerBudget != nil {
		budget = *opts.TickerBudget
	}
	return &Adapter{client: client, budget: budget, lastFetched: map[string]int64{}}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// loadSymbols returns the tradable book, re-reading `/v3/symbols` only once it is an hour old.
func (a *Adapter) loadSymbols(ctx context.Context, nowMs int64) (Book, error) {
	a.mu.Lock()
	if a.bookLoaded && nowMs-a.bookFetchedAt < SymbolsMaxAge.Milliseconds() {
		book := a.book
		a.mu.Unlock()
		return book, nil
	}
	a.mu.Unlock()

	var body SymbolsResponse
	if err := a.client.GetJSON(ctx, API+"/symbols", &body); err != nil {
		return Book{}, err
	}
	if body.Data == nil || body.Data.ContractConfig == nil {
		return Book{}, ErrUnexpectedSymbols
	}

	book := TradableContracts(body.Data.ContractConfig)
	a.mu.Lock()
	a.book = book
	a.bookLoaded = true
	a.bookFetchedAt = nowMs
	a.mu.Unlock()
	return book, nil
}

// FetchSnapshots runs one cycle: the hourly-cached symbol list, then a rotating slice of per-symbol
// tickers, emitting only the contracts this cycle actually read.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()

	live, err := a.loadSymbols(ctx, nowMs)
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	a.mu.Lock()
	// A contract ApeX no longer lists is dropped rather than kept alive by the cursor.
	for symbol := range a.lastFetched {
		if _, listed := live.Markets[symbol]; !listed {
			delete(a.lastFetched, symbol)
		}
	}
	// maxAge 0: every contract is due every cycle, so the rotation is purely least-recently-read.
	batch := adapters.SelectRefreshBatch(live.Order, func(symbol string) (int64, bool) {
		at, known := a.lastFetched[symbol]
		return at, known
	}, nowMs, a.budget, 0)
	for _, symbol := range batch {
		a.lastFetched[symbol] = nowMs
	}
	a.mu.Unlock()

	snapshots := make([]core.FundingSnapshot, 0, len(batch))
	// The first failure, and the first open circuit, kept separately: a cycle that emitted nothing
	// reports the open circuit if there was one, since that is the failure that explains all the
	// others.
	var firstErr, circuitErr error

	for _, symbol := range batch {
		market := live.Markets[symbol]
		var body TickerResponse
		endpoint := API + "/ticker?symbol=" + url.QueryEscape(market.Contract.CrossSymbolName)
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			// The batch is walked to the end even with the circuit open, as the TypeScript Promise.all
			// does: a refused call costs no request, and stopping early would leave this cycle's
			// rotation cursor claiming reads that never happened.
			var open *httpclient.CircuitOpenError
			if errors.As(err, &open) && circuitErr == nil {
				circuitErr = err
			}
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		var ticker *Ticker
		if len(body.Data) > 0 {
			ticker = &body.Data[0]
		}
		if snapshot := ParseTicker(market, ticker, nowMs); snapshot != nil {
			snapshots = append(snapshots, *snapshot)
		}
	}

	// A cycle whose every ticker failed is an error, not an empty venue: reporting no markets would
	// have the collector record a successful run that collected nothing.
	if len(snapshots) == 0 && firstErr != nil {
		if circuitErr != nil {
			return core.SnapshotBatch{}, circuitErr
		}
		return core.SnapshotBatch{}, firstErr
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// FetchFundingHistory returns settled hourly payments for one contract in [fromMs, toMs], oldest
// first.
//
// Newest first from the venue, so `endTimeExclusive` steps back to the oldest row of each page.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	live, err := a.loadSymbols(ctx, time.Now().UnixMilli())
	if err != nil {
		return nil, err
	}
	market, listed := live.Markets[venueSymbol]
	if !listed {
		return []core.FundingEvent{}, nil
	}

	rows := make([]FundingRow, 0, historyPageSize)
	end := toMs + 1

	for page := 0; page < historyMaxPages && end > fromMs; page++ {
		endpoint := fmt.Sprintf(
			"%s/history-funding?symbol=%s&limit=%d&beginTimeInclusive=%d&endTimeExclusive=%d",
			API, url.QueryEscape(venueSymbol), historyPageSize, fromMs, end)
		var body HistoryResponse
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		batch := body.Data.HistoryFunds
		rows = append(rows, batch...)
		if len(batch) < historyPageSize {
			break
		}

		// An unreadable fundingTime makes the minimum NaN, as Math.min does over a NaN, so the walk
		// stops rather than paging from a timestamp it could not read.
		oldest := math.Inf(1)
		for _, row := range batch {
			if !row.FundingTime.OK {
				oldest = math.NaN()
				break
			}
			oldest = math.Min(oldest, row.FundingTime.Val)
		}
		if math.IsNaN(oldest) || math.IsInf(oldest, 1) || int64(oldest) >= end {
			break
		}
		end = int64(oldest)
	}

	return ParseFunding(rows, market, fromMs, toMs), nil
}
