package dydx

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://indexer.dydx.trade/v4"
	// MinInterval is this venue's minimum spacing between requests, ported from the TypeScript
	// adapter's minIntervalMs: 100.
	MinInterval     = 100 * time.Millisecond
	historyPageSize = 100
	historyMaxPages = 100
	// isoMillis is the layout `new Date(ms).toISOString()` produces, which is the shape the
	// indexer's effectiveBeforeOrAt filter is given on the TypeScript side.
	isoMillis = "2006-01-02T15:04:05.000Z"
)

// Adapter fetches dYdX v4 indexer market data.
//
// It owns no state beyond its client, so the venue's snapshot, history and tier loops can share one
// Adapter and therefore one set of request spacing and one circuit breaker.
type Adapter struct {
	client *httpclient.Client
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every ACTIVE market, in one request.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	markets, err := a.fetchMarkets(ctx)
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	return core.SnapshotBatch{Snapshots: ParseMarkets(markets, now.UnixMilli()), Settled: nil}, nil
}

// FetchLeverageTiers reads the margin fractions, which ride along in `perpetualMarkets`, so this is
// one request for the venue.
//
// complete is always true when the request succeeds: the endpoint answers for the whole book at
// once, so there is no partial sweep the caller could prune stale ladders against.
func (a *Adapter) FetchLeverageTiers(ctx context.Context) ([]core.LeverageTier, bool, error) {
	markets, err := a.fetchMarkets(ctx)
	if err != nil {
		return nil, false, err
	}
	return ParseLeverageTiers(markets), true, nil
}

func (a *Adapter) fetchMarkets(ctx context.Context) (MarketList, error) {
	var body MarketsResponse
	if err := a.client.GetJSON(ctx, baseURL+"/perpetualMarkets", &body); err != nil {
		return nil, err
	}
	if body.Markets == nil {
		return nil, ErrUnexpectedMarkets
	}
	return *body.Markets, nil
}

// FetchFundingHistory returns settled hourly payments for one market in [fromMs, toMs], oldest
// first.
//
// Paged backwards from toMs, because the endpoint answers newest-first and bounds each window with
// effectiveBeforeOrAt.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	items := make([]HistoricalFunding, 0, historyPageSize)
	before := toMs

	for page := 0; page < historyMaxPages; page++ {
		endpoint := fmt.Sprintf(
			"%s/historicalFunding/%s?limit=%d&effectiveBeforeOrAt=%s",
			baseURL, url.PathEscape(venueSymbol), historyPageSize,
			time.UnixMilli(before).UTC().Format(isoMillis),
		)
		var body HistoricalFundingResponse
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		if body.HistoricalFunding == nil {
			return nil, ErrUnexpectedHistory
		}
		batch := *body.HistoricalFunding
		items = append(items, batch...)

		// Newest first: step back past the oldest row until the window is covered.
		oldest, readable := oldestSettlement(batch)
		if len(batch) < historyPageSize || !readable || oldest <= fromMs {
			break
		}
		before = oldest - 1
	}
	return ParseHistoricalFunding(items, venueSymbol, fromMs, toMs), nil
}

// oldestSettlement is the earliest readable settlement in a page, and whether the page gave one at
// all. An empty page, or one holding a timestamp the parser cannot read, is not readable — which is
// what the TypeScript side gets from Math.min() over an empty or NaN-bearing list and then rejects
// with Number.isFinite, and it stops the walk rather than stepping to an invented `before`.
func oldestSettlement(batch []HistoricalFunding) (int64, bool) {
	oldest := int64(0)
	found := false
	for _, item := range batch {
		settledAt, ok := parseEffectiveAt(item.EffectiveAt)
		if !ok {
			return 0, false
		}
		if !found || settledAt < oldest {
			oldest = settledAt
			found = true
		}
	}
	return oldest, found
}
