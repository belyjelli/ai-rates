package orderly

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// APIBase is Orderly's public REST root, shared by every broker on the network.
	APIBase = "https://api.orderly.org/v1/public"

	// MinInterval is the spacing this venue's client should use. Public endpoints allow 10 requests
	// per second per IP.
	MinInterval = 120 * time.Millisecond

	// InfoMaxAge: /info carries the funding period and listing status, which change rarely.
	InfoMaxAge = 60 * time.Minute

	// historyPageSize: the server caps `size` at 500 whatever is asked (measured 2026-09-14).
	historyPageSize = 500
	historyMaxPages = 20
)

// Adapter collects the Orderly network's shared book.
//
// Two requests a cycle — /futures and /funding_rates — plus /info once an hour.
//
// The market cache lives HERE, not at package scope as the TypeScript keeps it. In Go the collector
// runs each venue on its own goroutine against a shared process, so a package-level map would be
// unsynchronised shared state: a data race the detector flags immediately, and a torn read of the
// listing table if it did not. The map is replaced wholesale rather than mutated, so a reader
// holding the previous one is never racing a refresh.
type Adapter struct {
	client *httpclient.Client

	mu               sync.Mutex
	markets          map[string]Info
	marketsLoaded    bool
	marketsFetchedAt int64
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, APIBase+path, out)
}

// loadMarkets reads /info and replaces the cache, stamping it with the given time.
func (a *Adapter) loadMarkets(ctx context.Context, fetchedAt int64) (map[string]Info, error) {
	var env Envelope[Rows[Info]]
	if err := a.get(ctx, "/info", &env); err != nil {
		return nil, err
	}
	data, err := env.unwrap("info")
	if err != nil {
		return nil, err
	}
	bySymbol := TradablePerps(data.Rows)

	a.mu.Lock()
	a.markets = bySymbol
	a.marketsLoaded = true
	a.marketsFetchedAt = fetchedAt
	a.mu.Unlock()
	return bySymbol, nil
}

// FetchSnapshots runs one cycle: the futures book and the funding rates, over the hourly listing.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()

	a.mu.Lock()
	loaded, fetchedAt, cached := a.marketsLoaded, a.marketsFetchedAt, a.markets
	a.mu.Unlock()

	bySymbol := cached
	if !loaded || nowMs-fetchedAt >= InfoMaxAge.Milliseconds() {
		fresh, err := a.loadMarkets(ctx, nowMs)
		if err != nil {
			return core.SnapshotBatch{}, err
		}
		bySymbol = fresh
	}

	// Sequential where the TypeScript runs the two in Promise.all: the client spaces requests per
	// venue anyway, so concurrency here would buy nothing but a second goroutine.
	var futures Envelope[Rows[Future]]
	if err := a.get(ctx, "/futures", &futures); err != nil {
		return core.SnapshotBatch{}, err
	}
	futureRows, err := futures.unwrap("futures")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var rates Envelope[Rows[FundingRate]]
	if err := a.get(ctx, "/funding_rates", &rates); err != nil {
		return core.SnapshotBatch{}, err
	}
	rateRows, err := rates.unwrap("funding rates")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	return ParseSnapshots(SnapshotInput{
		Markets:      bySymbol,
		Futures:      futureRows.Rows,
		FundingRates: rateRows.Rows,
	}, nowMs), nil
}

// FetchFundingHistory pages one market's settlements forward from page 1.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	a.mu.Lock()
	loaded, cached := a.marketsLoaded, a.markets
	a.mu.Unlock()

	bySymbol := cached
	if !loaded {
		// fetchedAt 0 keeps a copy loaded here due for a refresh on the next snapshot cycle.
		fresh, err := a.loadMarkets(ctx, 0)
		if err != nil {
			return nil, err
		}
		bySymbol = fresh
	}

	rows := make([]FundingHistoryRow, 0, historyPageSize)
	for page := 1; page <= historyMaxPages; page++ {
		var env Envelope[FundingHistoryPage]
		// start_t and end_t are 13-digit ms; seconds silently return nothing.
		if err := a.get(ctx, fmt.Sprintf("/funding_rate_history?symbol=%s&start_t=%d&end_t=%d&page=%d&size=%d",
			url.QueryEscape(venueSymbol), fromMs, toMs, page, historyPageSize), &env); err != nil {
			return nil, err
		}
		data, err := env.unwrap("funding rate history")
		if err != nil {
			return nil, err
		}
		rows = append(rows, data.Rows...)

		perPage := historyPageSize
		total := 0
		if data.Meta != nil {
			if data.Meta.RecordsPerPage.OK {
				perPage = int(data.Meta.RecordsPerPage.Val)
			}
			if data.Meta.Total.OK {
				total = int(data.Meta.Total.Val)
			}
		}
		if len(data.Rows) < perPage || page*perPage >= total {
			break
		}
	}

	var fallbackHours *float64
	if market, known := bySymbol[venueSymbol]; known {
		fallbackHours = market.FundingPeriod.Ptr()
	}
	return ParseFundingHistory(venueSymbol, rows, fromMs, toMs, fallbackHours), nil
}
