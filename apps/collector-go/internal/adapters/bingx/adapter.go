package bingx

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
	baseURL = "https://open-api.bingx.com/openApi/swap/v2"

	// MinInterval is the spacing this venue's client should use.
	//
	// BingX answers with `x-ratelimit-requests-remain: 499` and `x-ratelimit-requests-expire: 10000`
	// on public market endpoints: 500 requests per 10 seconds per IP. 10 a second is a fifth of it.
	MinInterval = 100 * time.Millisecond

	// ContractsMaxAge: /quote/contracts is ~580 KB and only says what trades and what it is, so
	// hourly.
	ContractsMaxAge = 60 * time.Minute

	// OpenInterestBudget and OpenInterestMaxAge bound the per-symbol sweep.
	//
	// Open interest is per symbol only: /quote/openInterest rejects a missing symbol, and neither
	// premiumIndex nor ticker carries it. ~1,000 markets at this budget is a full sweep about every
	// ten cycles, well inside the 10-minute age, and 100 calls at 100ms spacing is ten seconds a
	// cycle.
	OpenInterestBudget = 100
	OpenInterestMaxAge = 10 * time.Minute

	// historyLimit: /quote/fundingRate accepts up to 1000 rows; 2000 is rejected.
	historyLimit    = 1000
	historyMaxPages = 20
)

// Options configures one adapter. The zero value takes the package defaults.
type Options struct {
	// OpenInterestBudget is per-symbol open interest calls per cycle; zero means OpenInterestBudget.
	OpenInterestBudget int
}

// knownMarket is what a completed cycle remembers about a market, so a later history call can name
// it the same way the snapshot did.
type knownMarket struct {
	ref           core.MarketRef
	intervalHours *float64
}

// Adapter collects BingX's USDT- and USDC-margined perpetuals.
//
// Two bulk requests a cycle (premiumIndex, ticker), up to OpenInterestBudget per-symbol open
// interest calls, and /quote/contracts once an hour.
//
// The contract cache, the open interest cache and the known-market table live HERE, not at package
// scope as the TypeScript keeps them in its factory closure. In Go the collector runs each venue on
// its own goroutine against a shared process, and FetchFundingHistory reads the same table
// FetchSnapshots writes, so all three are mutex-guarded — unsynchronised they are a data race the
// detector flags immediately, and a silently torn cache if it did not.
type Adapter struct {
	client *httpclient.Client
	budget int

	mu                 sync.Mutex
	contracts          []Contract
	contractsFetchedAt int64
	hasContracts       bool
	openInterest       map[string]OpenInterestEntry
	known              map[string]knownMarket
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return NewAdapterWithOptions(client, Options{})
}

func NewAdapterWithOptions(client *httpclient.Client, options Options) *Adapter {
	budget := options.OpenInterestBudget
	if budget == 0 {
		budget = OpenInterestBudget
	}
	return &Adapter{
		client:       client,
		budget:       budget,
		openInterest: make(map[string]OpenInterestEntry),
		known:        make(map[string]knownMarket),
	}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, baseURL+path, out)
}

// fetchList reads one bulk endpoint and unwraps its envelope.
func fetchList[T any](ctx context.Context, a *Adapter, path, what string) ([]T, error) {
	var env Envelope[[]T]
	if err := a.get(ctx, path, &env); err != nil {
		return nil, err
	}
	return env.unwrap(what)
}

// FetchSnapshots runs one cycle: the contract list once an hour, then the premium index and the
// tickers, then a slice of the per-symbol open interest sweep.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()

	a.mu.Lock()
	stale := !a.hasContracts || nowMs-a.contractsFetchedAt >= ContractsMaxAge.Milliseconds()
	a.mu.Unlock()

	if stale {
		rows, err := fetchList[Contract](ctx, a, "/quote/contracts", "contracts")
		if err != nil {
			return core.SnapshotBatch{}, err
		}
		a.mu.Lock()
		a.contracts = rows
		a.contractsFetchedAt = nowMs
		a.hasContracts = true
		a.mu.Unlock()
	}

	premium, err := fetchList[PremiumIndex](ctx, a, "/quote/premiumIndex", "premiumIndex")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	tickers, err := fetchList[Ticker](ctx, a, "/quote/ticker", "ticker")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	a.mu.Lock()
	contracts := a.contracts
	cache := maps.Clone(a.openInterest)
	a.mu.Unlock()

	// Parsed once to learn which markets are listed this cycle, and again at the end so the snapshots
	// carry the open interest this cycle just read.
	listedSnapshots := ParseSnapshots(contracts, premium, tickers, cache, nowMs)
	symbols := make([]string, 0, len(listedSnapshots))
	listed := make(map[string]bool, len(listedSnapshots))
	for _, snapshot := range listedSnapshots {
		symbols = append(symbols, snapshot.VenueSymbol)
		listed[snapshot.VenueSymbol] = true
	}

	a.mu.Lock()
	for symbol := range a.openInterest {
		if !listed[symbol] {
			delete(a.openInterest, symbol)
		}
	}
	fetchedAt := func(symbol string) (int64, bool) {
		entry, cached := a.openInterest[symbol]
		return entry.FetchedAt, cached
	}
	batch := adapters.SelectRefreshBatch(symbols, fetchedAt, nowMs, a.budget, OpenInterestMaxAge.Milliseconds())
	a.mu.Unlock()

	for _, symbol := range batch {
		var env Envelope[OpenInterest]
		err := a.get(ctx, "/quote/openInterest?symbol="+url.QueryEscape(symbol), &env)
		if err == nil {
			var valueUSD *float64
			if valueUSD, err = ParseOpenInterest(env); err == nil && valueUSD != nil {
				a.mu.Lock()
				a.openInterest[symbol] = OpenInterestEntry{ValueUSD: *valueUSD, FetchedAt: nowMs}
				a.mu.Unlock()
			}
		}
		var open *httpclient.CircuitOpenError
		if errors.As(err, &open) {
			break
		}
		// Any other failure leaves this symbol for a later cycle; one bad symbol shouldn't fail the
		// batch.
	}

	a.mu.Lock()
	cache = maps.Clone(a.openInterest)
	a.mu.Unlock()

	snapshots := ParseSnapshots(contracts, premium, tickers, cache, nowMs)
	known := make(map[string]knownMarket, len(snapshots))
	for _, snapshot := range snapshots {
		known[snapshot.VenueSymbol] = knownMarket{
			ref:           snapshot.MarketRef,
			intervalHours: snapshot.IntervalHours,
		}
	}
	a.mu.Lock()
	a.known = known
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// FetchFundingHistory pages /quote/fundingRate backwards from toMs.
//
// Given a window and a limit BingX returns the NEWEST rows in the window, newest first (a 2026-06
// window with limit=5 answered its last five settlements), so each further page ends just before the
// oldest row already read.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingRate, 0, historyLimit)
	endTime := toMs

	for page := 0; page < historyMaxPages && endTime >= fromMs; page++ {
		list, err := fetchList[FundingRate](ctx, a, fmt.Sprintf(
			"/quote/fundingRate?symbol=%s&startTime=%d&endTime=%d&limit=%d",
			url.QueryEscape(venueSymbol), fromMs, endTime, historyLimit), "funding history")
		// A suspended symbol has nothing to read, which is an answer rather than a failure. The sweep
		// takes its markets from what was seen within a day, so a symbol suspended since then is
		// still asked for, and without this it logged an error every sweep.
		var code *CodeError
		if errors.As(err, &code) && code.Code == codePaused {
			return []core.FundingEvent{}, nil
		}
		if err != nil {
			return nil, err
		}
		rows = append(rows, list...)
		if len(list) < historyLimit {
			break
		}
		oldest := int64(0)
		for i, row := range list {
			at := int64(row.FundingTime.Val)
			if i == 0 || at < oldest {
				oldest = at
			}
		}
		endTime = oldest - 1
	}

	a.mu.Lock()
	market, seen := a.known[venueSymbol]
	a.mu.Unlock()

	ref := adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{})
	var fallbackHours *float64
	if seen {
		ref = market.ref
		fallbackHours = market.intervalHours
	}
	return ParseFundingHistory(ref, rows, fromMs, toMs, fallbackHours), nil
}
