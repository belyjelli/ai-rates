package velocity

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://data.velocity.exchange"

	// MinInterval is this venue's minimum spacing between requests, ported from the TypeScript
	// adapter's minIntervalMs: 1000. The Data API (https://data.velocity.exchange/playground)
	// documents no rate limit, so this keeps to one request a second rather than inventing a budget.
	MinInterval = 1000 * time.Millisecond

	// historyPageSize is `fundingRates`' maximum page size; the endpoint keeps the last 31 days,
	// 744 hourly rows, newest first.
	historyPageSize = 750
	historyMaxPages = 5
)

// Adapter collects Velocity's Solana perpetuals.
//
// It owns no state beyond its client. One call answers for the whole book, so unlike the venues that
// rotate a per-symbol cursor there is nothing here that would have to become mutex-guarded adapter
// state to survive the collector running each venue on its own goroutine.
type Adapter struct {
	client *httpclient.Client
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots runs one cycle: a single /stats/markets read (~5 KB) carrying spot and perp markets
// with their stats inline.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var body MarketsResponse
	if err := a.client.GetJSON(ctx, baseURL+"/stats/markets", &body); err != nil {
		return core.SnapshotBatch{}, err
	}
	if body.Markets == nil {
		return core.SnapshotBatch{}, ErrUnexpectedMarkets
	}
	// Velocity publishes settlements only on its own endpoint, so a cycle carries none for free.
	return core.SnapshotBatch{
		Snapshots: ParseMarkets(*body.Markets, now.UnixMilli()),
		Settled:   []core.FundingEvent{},
	}, nil
}

// FetchFundingHistory pages one market's hourly settlements, newest first, following the response's
// own cursor until a page reaches back past the window start.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	records := make([]FundingRecord, 0, historyPageSize)
	page := ""

	for i := 0; i < historyMaxPages; i++ {
		endpoint := fmt.Sprintf("%s/market/%s/fundingRates?limit=%d",
			baseURL, url.PathEscape(venueSymbol), historyPageSize)
		if page != "" {
			endpoint += "&page=" + url.QueryEscape(page)
		}

		var body FundingRatesResponse
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		if body.Records == nil {
			return nil, ErrUnexpectedHistory
		}
		batch := *body.Records
		records = append(records, batch...)

		oldest, readable := oldestTimestamp(batch)
		page = ""
		if body.Meta != nil && body.Meta.NextPage != nil {
			page = *body.Meta.NextPage
		}
		if page == "" || len(batch) == 0 || (readable && int64(oldest*1000) <= fromMs) {
			break
		}
	}
	return ParseFundingRates(records, venueSymbol, fromMs, toMs), nil
}

// oldestTimestamp is the earliest `ts` in a page, in seconds, and whether the page gave a readable
// one at all. A page holding a timestamp the parser cannot read is not readable — which is what the
// TypeScript side gets from Math.min() over a list carrying an undefined, and a NaN there fails the
// window comparison rather than ending the walk early on an invented instant.
func oldestTimestamp(batch []FundingRecord) (float64, bool) {
	oldest := 0.0
	found := false
	for _, record := range batch {
		if !record.Ts.OK {
			return 0, false
		}
		if !found || record.Ts.Val < oldest {
			oldest = record.Ts.Val
			found = true
		}
	}
	return oldest, found
}
