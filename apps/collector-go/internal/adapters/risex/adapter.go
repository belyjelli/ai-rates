package risex

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
	// MinInterval is the spacing this venue's client should use, ported from the TypeScript
	// adapter's minIntervalMs: 100. The documented limit is "REST: 500 requests/10s" per IP, i.e.
	// 50 a second, so 100ms is far inside it.
	MinInterval = 100 * time.Millisecond

	marketsURL = APIBase + "/markets"

	historyPageSize = 1000
	historyMaxPages = 50
)

// Adapter collects RISEx's USDC-quoted perpetuals.
//
// One request a cycle: /markets carries funding, prices, OI, volume and leverage for the whole book.
//
// The name index lives HERE, not at package scope as the TypeScript keeps it in a closure. In Go the
// collector runs each venue on its own goroutine against a shared process, so a package-level map
// would be unsynchronised shared state — a data race the detector flags immediately. It exists
// because funding history is addressed by NUMERIC market id while the collector asks by
// `config.name`, so the pair has to be remembered from the markets call.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// byName maps `config.name` -> market, for history, which is addressed by numeric id.
	byName map[string]Market
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, byName: make(map[string]Market)}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// market is the remembered row for one `config.name`, and whether it has been seen at all.
func (a *Adapter) market(venueSymbol string) (Market, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	market, known := a.byName[venueSymbol]
	return market, known
}

// fetchMarkets reads /markets and remembers every row by name.
//
// A response whose `markets` is absent or null fails the cycle rather than reading as a venue with
// nothing listed: a nil slice is what a missing payload decodes to, while `[]` decodes to an empty
// non-nil one, which is the same distinction `Array.isArray` draws on the TypeScript side.
func (a *Adapter) fetchMarkets(ctx context.Context) (MarketsResponse, error) {
	var body MarketsResponse
	if err := a.client.GetJSON(ctx, marketsURL, &body); err != nil {
		return MarketsResponse{}, err
	}
	if body.Data.Markets == nil {
		return MarketsResponse{}, ErrUnexpectedMarkets
	}

	a.mu.Lock()
	for _, market := range body.Data.Markets {
		if market.Config.Name != "" {
			a.byName[market.Config.Name] = market
		}
	}
	a.mu.Unlock()
	return body, nil
}

// FetchSnapshots runs one cycle: the whole book in a single /markets call.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	body, err := a.fetchMarkets(ctx)
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	return ParseMarkets(body, now.UnixMilli()), nil
}

// FetchFundingHistory returns settled hourly payments for one market in [fromMs, toMs], oldest
// first.
//
// The endpoint is addressed by NUMERIC market id, so an unseen symbol costs one /markets call to
// learn the pairing; a symbol this venue does not list returns nothing rather than an error, since
// the collector asks about every market it has ever stored.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	market, known := a.market(venueSymbol)
	if !known {
		if _, err := a.fetchMarkets(ctx); err != nil {
			return nil, err
		}
		market, known = a.market(venueSymbol)
	}
	if !known {
		return []core.FundingEvent{}, nil
	}

	records := make([]FundingRecord, 0, historyPageSize)
	// end_time is EXCLUSIVE, start_time inclusive. Both nanoseconds, which int64 holds to the year
	// 2262 even after the 1e6 scaling.
	window := fmt.Sprintf("start_time=%d&end_time=%d", fromMs*nsPerMs, (toMs+1)*nsPerMs)

	for page := 1; page <= historyMaxPages; page++ {
		endpoint := fmt.Sprintf("%s/markets/id/%s/funding-rate-history?%s&page=%d&limit=%d",
			APIBase, url.PathEscape(market.MarketID), window, page, historyPageSize)
		var body FundingHistoryResponse
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		if body.Data.Records == nil {
			return nil, ErrUnexpectedHistory
		}
		records = append(records, body.Data.Records...)
		if !body.Data.HasNextPage || len(body.Data.Records) == 0 {
			break
		}
	}
	return ParseFundingHistory(records, market, fromMs, toMs), nil
}
