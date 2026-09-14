package arcus

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
	// API is the REST base. Exported so a caller can point a probe at the same base the adapter uses.
	API = "https://api.arcus.xyz/v1"

	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's
	// minIntervalMs of 3000. The bucket is 1,500 weight per IP refilling at 1,500/minute and the
	// dearest call is 70, so 20 calls a minute cannot exhaust it.
	MinInterval = 3 * time.Second

	// historyPageSize is the `fundingRates` default and maximum page size, newest first.
	historyPageSize = 1000
	historyMaxPages = 50
)

// Adapter collects Arcus's perpetuals.
//
// The category cache is guarded because a venue's loops share one adapter: the snapshot loop writes
// it and the history loop reads it, and nothing promises those never overlap. The TypeScript side
// keeps the same map in the closure createArcusAdapter returns, where the single-threaded runtime
// makes the guard unnecessary.
type Adapter struct {
	client *httpclient.Client

	// mu guards categories: the history endpoint carries no category, so the class is remembered
	// from the markets call.
	mu         sync.Mutex
	categories map[string]string
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, categories: make(map[string]string)}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots runs one cycle: a single `/markets` call, which carries funding, prices, open
// interest, volume and the margin fraction for every market.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var body MarketsResponse
	if err := a.client.GetJSON(ctx, API+"/markets", &body); err != nil {
		return core.SnapshotBatch{}, err
	}
	if body.Markets == nil {
		return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected markets response", VenueID)
	}
	markets := *body.Markets

	a.mu.Lock()
	for _, market := range markets {
		a.categories[market.MarketDisplayName] = market.Category
	}
	a.mu.Unlock()

	return ParseMarkets(markets, now.UnixMilli()), nil
}

// FetchFundingHistory returns settled hourly payments for one market in [fromMs, toMs], oldest
// first.
//
// Paged backwards from toMs, because the endpoint answers newest-first and bounds each window in
// MICROSECONDS — the window given in milliseconds is a thousand times too narrow and returns
// nothing.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingRate, 0, historyPageSize)
	fromMicros := fromMs * 1000
	toMicros := toMs * 1000

	for page := 0; page < historyMaxPages; page++ {
		endpoint := fmt.Sprintf("%s/fundingRates?market=%s&from=%d&to=%d&limit=%d",
			API, url.QueryEscape(venueSymbol), fromMicros, toMicros, historyPageSize)
		var body FundingRatesResponse
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		if body.FundingRates == nil {
			return nil, fmt.Errorf("%s: unexpected fundingRates response", VenueID)
		}
		batch := *body.FundingRates
		rows = append(rows, batch...)

		// Math.min over the page's timestamps: a row without a readable one makes the minimum
		// non-finite, which ends the walk rather than stepping back from a guess.
		oldest, readable := oldestMicros(batch)
		if len(batch) < historyPageSize || !readable || oldest <= fromMicros {
			break
		}
		toMicros = oldest - 1
	}

	a.mu.Lock()
	category := a.categories[venueSymbol]
	a.mu.Unlock()

	return ParseFundingRates(rows, venueSymbol, category, fromMs, toMs), nil
}

// oldestMicros is the earliest readable stamp in a page, and whether the page gave one at all. An
// empty page, or one holding a timestamp the parser cannot read, is not readable — which is what
// the TypeScript side gets from Math.min() over an empty or NaN-bearing list and then rejects with
// Number.isFinite.
func oldestMicros(batch []FundingRate) (int64, bool) {
	oldest := 0.0
	found := false
	for _, row := range batch {
		if !row.Time.OK {
			return 0, false
		}
		if !found || row.Time.Val < oldest {
			oldest = row.Time.Val
			found = true
		}
	}
	return int64(oldest), found
}
