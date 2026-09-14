package aevo

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	APIBase = "https://api.aevo.xyz"
	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's
	// minIntervalMs of 250. Aevo documents that public endpoints are limited per IP with a 429 and
	// `X-RETRY-AFTER` (https://api-docs.aevo.xyz/reference/rate-limits-1) but publishes no number.
	// Exported because the spacing lives on the client the caller builds, not on the adapter.
	MinInterval = 250 * time.Millisecond
	// HistoryPageSize: `/funding-history` answers at most 50 rows whatever `limit` asks for
	// (measured with 51 and 100).
	HistoryPageSize = 50
	// historyMaxPages bounds the backwards walk, so a venue that keeps answering full pages cannot
	// spin a sweep forever.
	historyMaxPages = 400
)

// Adapter fetches Aevo's perpetual market data.
//
// It remembers the last markets list so that history can be attributed to the right base, quote and
// class without a second call. The map is guarded because a venue's snapshot loop and its history
// loop share one adapter: VenueLoop guarantees its own cycles never overlap, but it makes no such
// promise against the history sweep running beside it.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// known holds the declarations for history, remembered from the last markets list.
	known map[string]Market
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, known: make(map[string]Market, 128)}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every live perp.
//
// Two bulk calls, both every cycle: the markets list carries the class, the activity flag and the
// only mark price, and the statistics call carries funding, open interest, volume and the next
// funding time. A response that is not a JSON array fails to decode into the slice, which is this
// port's equivalent of the TypeScript Array.isArray guard.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var markets []Market
	if err := a.client.GetJSON(ctx, APIBase+"/markets?instrument_type=PERPETUAL", &markets); err != nil {
		return core.SnapshotBatch{}, err
	}

	var statistics []Statistic
	if err := a.client.GetJSON(ctx, APIBase+"/coingecko-statistics", &statistics); err != nil {
		return core.SnapshotBatch{}, err
	}

	a.mu.Lock()
	for _, market := range markets {
		a.known[market.InstrumentName] = market
	}
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: ParseSnapshots(markets, statistics, now.UnixMilli())}, nil
}

// FetchFundingHistory returns settled payments for one market in [fromMs, toMs], oldest first.
//
// Newest first, 50 a page: step `end_time` back past the oldest row of each page. The window bounds
// are nanoseconds — `end_time` carries the last nanosecond of the requested millisecond so the
// settlement landing on toMs is included rather than cut off.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingRow, 0, HistoryPageSize)
	start := max(int64(0), fromMs) * nsPerMs
	end := max(int64(0), toMs)*nsPerMs + (nsPerMs - 1)

	for page := 0; page < historyMaxPages && end >= start; page++ {
		endpoint := fmt.Sprintf(
			"%s/funding-history?instrument_name=%s&start_time=%d&end_time=%d&limit=%d",
			APIBase, url.QueryEscape(venueSymbol), start, end, HistoryPageSize,
		)
		var body FundingHistoryResponse
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		batch := body.FundingHistory
		rows = append(rows, batch...)
		if len(batch) < HistoryPageSize {
			break
		}
		oldest := end
		for _, row := range batch {
			if t, ok := nsValue(row[1]); ok && t < oldest {
				oldest = t
			}
		}
		if oldest >= end {
			break
		}
		end = oldest - 1
	}

	return ParseFunding(rows, a.declaration(venueSymbol), fromMs, toMs), nil
}

// declaration is the remembered markets row for a symbol, or the shape every Aevo perp has: a live
// perpetual quoted in USDC, based on its own symbol. The fallback exists for a history sweep that
// runs before the first snapshot cycle has filled the map.
func (a *Adapter) declaration(venueSymbol string) Market {
	a.mu.Lock()
	market, known := a.known[venueSymbol]
	a.mu.Unlock()
	if known {
		return market
	}
	return Market{
		InstrumentName:  venueSymbol,
		InstrumentType:  "PERPETUAL",
		UnderlyingAsset: adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{}).Base,
		QuoteAsset:      "USDC",
		IsActive:        true,
	}
}
