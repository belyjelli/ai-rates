package bitget

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://api.bitget.com"

	// MinInterval is the spacing this venue's client should use. Bitget allows 20 requests a second
	// per IP on each public market endpoint (the response header `x-mbx-used-remain-limit` counts
	// down from 19); 10 a second leaves half of it spare.
	MinInterval = 100 * time.Millisecond

	// InstrumentsMaxAgeMs: instruments only say what trades and what it is, and weigh ~660 KB for
	// both books, so hourly.
	InstrumentsMaxAgeMs int64 = 60 * 60_000

	// historyPage: `history-fund-rate` caps `pageSize` at 100 and pages newest first by `pageNo`.
	historyPage = 100
	// historyMaxPages: 90 days of 1h settlements is 22 pages; the loop stops as soon as a page
	// reaches fromMs.
	historyMaxPages = 30
)

// knownMarket is what the last snapshot cycle learned about one market: which book answers for it,
// the identity it was normalised to, and the settlement gap it reported.
type knownMarket struct {
	category      Category
	ref           core.MarketRef
	intervalHours *float64
}

// Adapter collects Bitget's USDT- and USDC-margined perpetuals.
//
// Four requests a cycle -- `tickers` and `current-fund-rate` for each book -- plus the two
// `instruments` calls once an hour. Every figure the snapshot needs is in those bulk responses;
// nothing is fetched per symbol.
//
// The instrument cache and the known-market table live HERE, not at package scope as the TypeScript
// keeps them. In Go the collector runs each venue on its own goroutine against a shared process, so
// package-level maps would be unsynchronised shared state -- a data race the detector flags
// immediately.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// instrumentsByCategory and known are replaced wholesale rather than mutated, so a reader
	// holding the previous map is never racing a refresh.
	instrumentsByCategory map[Category][]Instrument
	instrumentsLoaded     bool
	instrumentsFetchedAt  int64
	known                 map[string]knownMarket

	// takerPace holds taker-buy-sell to its own, tighter limit; see takerflow.go.
	takerPace *adapters.Pacer
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, known: map[string]knownMarket{}, takerPace: adapters.NewPacer(TakerFlowPace)}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, baseURL+path, out)
}

// getOptional is get for a per-market statistic the venue may not publish for every market: a
// permanent 4xx is returned but does not open the circuit the funding loop shares. See
// httpclient.GetJSONOptional.
func (a *Adapter) getOptional(ctx context.Context, path string, out any) error {
	return a.client.GetJSONOptional(ctx, baseURL+path, out)
}

// instruments returns both books' instrument lists, refreshing them when the cache is older than
// InstrumentsMaxAgeMs.
func (a *Adapter) instruments(ctx context.Context, nowMs int64) (map[Category][]Instrument, error) {
	a.mu.Lock()
	loaded, fetchedAt, cached := a.instrumentsLoaded, a.instrumentsFetchedAt, a.instrumentsByCategory
	a.mu.Unlock()

	if loaded && nowMs-fetchedAt < InstrumentsMaxAgeMs {
		return cached, nil
	}

	fresh := make(map[Category][]Instrument, len(Categories))
	for _, category := range Categories {
		var env Envelope[Instrument]
		if err := a.get(ctx, "/api/v3/market/instruments?category="+string(category), &env); err != nil {
			return nil, err
		}
		rows, err := env.unwrap("instruments")
		if err != nil {
			return nil, err
		}
		fresh[category] = rows
	}

	a.mu.Lock()
	a.instrumentsByCategory = fresh
	a.instrumentsLoaded = true
	a.instrumentsFetchedAt = nowMs
	a.mu.Unlock()
	return fresh, nil
}

// FetchSnapshots runs one cycle over both books.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	byCategory, err := a.instruments(ctx, nowMs)
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	snapshots := make([]core.FundingSnapshot, 0, 1024)
	next := make(map[string]knownMarket, 1024)

	for _, category := range Categories {
		var tickers Envelope[Ticker]
		if err := a.get(ctx, "/api/v3/market/tickers?category="+string(category), &tickers); err != nil {
			return core.SnapshotBatch{}, err
		}
		var fundRates Envelope[CurrentFundRate]
		if err := a.get(ctx, "/api/v3/market/current-fund-rate?category="+string(category), &fundRates); err != nil {
			return core.SnapshotBatch{}, err
		}

		batch, err := ParseSnapshots(byCategory[category], tickers, fundRates, nowMs)
		if err != nil {
			return core.SnapshotBatch{}, err
		}
		for _, snapshot := range batch.Snapshots {
			next[snapshot.VenueSymbol] = knownMarket{
				category:      category,
				ref:           snapshot.MarketRef,
				intervalHours: snapshot.IntervalHours,
			}
		}
		snapshots = append(snapshots, batch.Snapshots...)
	}

	a.mu.Lock()
	a.known = next
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// FetchFundingHistory pages `history-fund-rate` from the newest settlement back until a page reaches
// fromMs. It takes no time bounds (the v2 endpoint ignores `startTime`/`endTime`), only `pageNo`.
//
// The book and identity come from the last snapshot cycle. History asked for before any cycle has
// run falls back to the symbol: USDC books are the ones named `…PERP`, and their base is then the
// parser's.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	a.mu.Lock()
	market, seen := a.known[venueSymbol]
	a.mu.Unlock()

	category := CategoryUSDT
	switch {
	case seen:
		category = market.category
	case strings.HasSuffix(venueSymbol, "PERP"):
		category = CategoryUSDC
	}

	items := make([]FundingHistoryItem, 0, historyPage)
	for page := 1; page <= historyMaxPages; page++ {
		var env Envelope[FundingHistoryItem]
		if err := a.get(ctx, fmt.Sprintf(
			"/api/v2/mix/market/history-fund-rate?symbol=%s&productType=%s&pageSize=%d&pageNo=%d",
			url.QueryEscape(venueSymbol), strings.ToLower(string(category)), historyPage, page,
		), &env); err != nil {
			return nil, err
		}
		list, err := env.unwrap("funding history")
		if err != nil {
			return nil, err
		}
		items = append(items, list...)
		if len(list) < historyPage {
			break
		}
		// NaN for a row with no readable timestamp, so the minimum goes NaN and the comparison is
		// false -- the paging keeps going rather than stopping on an unreadable page, which is what
		// Math.min over a NaN does on the TypeScript side.
		oldest := math.Inf(1)
		for _, item := range list {
			at := math.NaN()
			if item.FundingTime.OK {
				at = item.FundingTime.Val
			}
			oldest = math.Min(oldest, at)
		}
		if oldest < float64(fromMs) {
			break
		}
	}

	ref := adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{})
	var fallbackHours *float64
	if seen {
		ref = market.ref
		fallbackHours = market.intervalHours
	}
	return ParseFundingHistory(ref, items, fromMs, toMs, fallbackHours), nil
}
