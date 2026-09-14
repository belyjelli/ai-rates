package backpack

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
	API = "https://api.backpack.exchange/api/v1"
	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's
	// minIntervalMs of 2000. Exported because the spacing lives on the client the caller builds, not
	// on the adapter. Standard REST allows 2000 requests a minute, but historical market data allows
	// only 30; at 2s a cycle costs ~6s and a history backfill cannot breach the smaller bucket.
	MinInterval = 2 * time.Second
	// marketsTTL: /markets states the type, order-book state, class and interval, none of which move
	// within an hour.
	marketsTTL      = time.Hour
	historyPageSize = 1000
	historyMaxPages = 50
)

// Adapter fetches Backpack's perpetual market data.
//
// The markets cache is guarded, unlike Paradex's: both FetchSnapshots and FetchFundingHistory load
// it, so the venue's snapshot and history loops can be in it at once and nothing promises they never
// overlap.
type Adapter struct {
	client *httpclient.Client

	mu               sync.Mutex
	markets          []Market
	marketsFetchedAt time.Time
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// getArray fetches one of the venue's bulk lists.
//
// A null body decodes to a nil slice, which is this venue's shape of "not the list we asked for" —
// the same rejection the TypeScript side makes with Array.isArray. An empty list decodes non-nil and
// is a legitimate answer.
func getArray[T any](ctx context.Context, client *httpclient.Client, path string) ([]T, error) {
	var body []T
	if err := client.GetJSON(ctx, API+"/"+path, &body); err != nil {
		return nil, err
	}
	if body == nil {
		return nil, fmt.Errorf("%s: unexpected %s response", VenueID, path)
	}
	return body, nil
}

func (a *Adapter) loadMarkets(ctx context.Context, now time.Time) ([]Market, error) {
	a.mu.Lock()
	cached, fetchedAt := a.markets, a.marketsFetchedAt
	a.mu.Unlock()

	if cached != nil && now.Sub(fetchedAt) < marketsTTL {
		return cached, nil
	}

	markets, err := getArray[Market](ctx, a.client, "markets")
	if err != nil {
		return nil, err
	}

	a.mu.Lock()
	a.markets, a.marketsFetchedAt = markets, now
	a.mu.Unlock()
	return markets, nil
}

// FetchSnapshots returns current funding and market stats for every tradable perp.
//
// Three bulk calls a cycle plus the hourly market list. No per-symbol call exists or is needed:
// markPrices carries funding, mark, index and next funding for the whole book at once.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	listed, err := a.loadMarkets(ctx, now)
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	markPrices, err := getArray[MarkPrice](ctx, a.client, "markPrices")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	openInterest, err := getArray[OpenInterest](ctx, a.client, "openInterest")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	tickers, err := getArray[Ticker](ctx, a.client, "tickers")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(listed, markPrices, openInterest, tickers, now.UnixMilli()),
		Settled:   nil,
	}, nil
}

// FetchFundingHistory returns settled payments for one market in [fromMs, toMs], oldest first.
//
// Paged by offset, newest first, stopping as soon as a page is short or has reached back past the
// window. The market list is loaded for the declared class: a backfill of an equity perp must not
// file its settlements under crypto because history alone never says which it is.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	now := time.Now()
	listed, err := a.loadMarkets(ctx, now)
	if err != nil {
		return nil, err
	}
	// Fallback for a symbol the venue no longer lists: crypto, which is what an undeclared
	// rwaMarketType means.
	market := Market{Symbol: venueSymbol}
	for _, m := range listed {
		if m.Symbol == venueSymbol {
			market = m
			break
		}
	}

	rows := make([]FundingRate, 0, historyPageSize)
	for page := 0; page < historyMaxPages; page++ {
		path := fmt.Sprintf(
			"fundingRates?symbol=%s&limit=%d&offset=%d",
			url.QueryEscape(venueSymbol), historyPageSize, page*historyPageSize,
		)
		batch, err := getArray[FundingRate](ctx, a.client, path)
		if err != nil {
			return nil, err
		}
		rows = append(rows, batch...)

		var oldest *int64
		for _, r := range batch {
			if ms := ParseTimestamp(r.IntervalEndTimestamp); ms != nil && (oldest == nil || *ms < *oldest) {
				oldest = ms
			}
		}
		if len(batch) < historyPageSize || (oldest != nil && *oldest < fromMs) {
			break
		}
	}
	return ParseFundingRates(rows, market, fromMs, toMs, now.UnixMilli()), nil
}
