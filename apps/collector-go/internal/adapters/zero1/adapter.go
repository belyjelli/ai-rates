package zero1

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// MinInterval is the spacing this venue's client should use, ported from the TypeScript
	// adapter's minIntervalMs: 250. N1 documents no rate limit; two requests a minute at this
	// spacing is far below anything the per-market `/market/{id}/stats` route would have needed
	// (39 calls a cycle).
	MinInterval = 250 * time.Millisecond

	// InfoMaxAgeMs is how long the catalog is reused. `/info` only says what is listed and what the
	// tokens are called, so it is re-read hourly rather than every cycle.
	InfoMaxAgeMs int64 = 60 * 60_000

	infoURL = APIBase + "/info"
	liveURL = APIBase + "/markets/live"

	// historyPageSize: `pageSize` is a uint8, so 255 is the most a page holds (measured).
	historyPageSize = 255
	historyMaxPages = 40
)

// Adapter collects N1 / 01 Exchange.
//
// Two requests a cycle at most: `/markets/live` always, and `/info` only once an hour.
//
// The catalog cache lives HERE, not at package scope as the TypeScript keeps it in a closure. In Go
// the collector runs each venue on its own goroutine against a shared process, so a package-level
// cache would be unsynchronised shared state -- a data race the detector flags immediately.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// info is replaced wholesale rather than mutated, so a reader holding the previous catalog is
	// never racing a refresh.
	info      Info
	loaded    bool
	fetchedAt int64
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// loadInfo returns the catalog, refreshing it when the cache is older than InfoMaxAgeMs.
func (a *Adapter) loadInfo(ctx context.Context, nowMs int64) (Info, error) {
	a.mu.Lock()
	loaded, fetchedAt, cached := a.loaded, a.fetchedAt, a.info
	a.mu.Unlock()

	if loaded && nowMs-fetchedAt < InfoMaxAgeMs {
		return cached, nil
	}

	var body Info
	if err := a.client.GetJSON(ctx, infoURL, &body); err != nil {
		return Info{}, err
	}
	// Absent, not empty: a response that lost its catalog must fail the cycle rather than read as a
	// venue with nothing listed.
	if body.Markets == nil || body.Tokens == nil {
		return Info{}, ErrUnexpectedInfo
	}

	a.mu.Lock()
	a.info = body
	a.loaded = true
	a.fetchedAt = nowMs
	a.mu.Unlock()
	return body, nil
}

// FetchSnapshots runs one cycle: the hourly catalog for identity and quote, then `/markets/live`
// for funding, prices and volume.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	info, err := a.loadInfo(ctx, nowMs)
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var live MarketsLiveResponse
	if err := a.client.GetJSON(ctx, liveURL, &live); err != nil {
		return core.SnapshotBatch{}, err
	}
	if live.Markets == nil {
		return core.SnapshotBatch{}, ErrUnexpectedMarketsLive
	}

	// Nothing settled arrives with the snapshot call: `lastSettledFundingRate` is a single trailing
	// figure with no timestamp of its own, so it cannot be filed as an event.
	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(info, *live.Markets, nowMs),
		Settled:   []core.FundingEvent{},
	}, nil
}

// FetchFundingHistory walks one market's hourly settlements back from newest, following the action
// id cursor until a page reaches past fromMs.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	// The catalog is what turns a symbol into the numeric market id the history route is keyed by,
	// so history pays the same hourly cache as the snapshot cycle.
	info, err := a.loadInfo(ctx, time.Now().UnixMilli())
	if err != nil {
		return nil, err
	}
	var market MarketInfo
	listed := false
	for _, candidate := range info.MarketList() {
		if candidate.Symbol == venueSymbol {
			market, listed = candidate, true
			break
		}
	}
	if !listed {
		// A symbol this venue does not list has no history, which is not an error.
		return nil, nil
	}

	rows := make([]HistoryRow, 0, historyPageSize)
	cursor := int64(0)
	hasCursor := false

	for page := 0; page < historyMaxPages; page++ {
		url := fmt.Sprintf("%s/market/%d/history/PT1H?pageSize=%d", APIBase, market.MarketID, historyPageSize)
		if hasCursor {
			url += fmt.Sprintf("&startInclusive=%d", cursor)
		}
		var result HistoryPage
		if err := a.client.GetJSON(ctx, url, &result); err != nil {
			return nil, err
		}
		if result.Items == nil {
			return nil, ErrUnexpectedHistory
		}
		items := *result.Items
		rows = append(rows, items...)

		// Newest first, so the walk ends once a page has reached back past the window. A page whose
		// timestamps cannot be read ends it too rather than stepping to an invented cursor.
		oldest, readable := oldestSettlement(items)
		if result.NextStartInclusive == nil || len(items) == 0 || (readable && oldest < fromMs) {
			break
		}
		cursor, hasCursor = *result.NextStartInclusive, true
	}
	return ParseFunding(rows, market, info, fromMs, toMs), nil
}
