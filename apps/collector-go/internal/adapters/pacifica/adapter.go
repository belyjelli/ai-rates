package pacifica

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
	API = "https://api.pacifica.fi/api/v1"

	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's minIntervalMs
	// of 6000. Exported because the spacing lives on the client the caller builds, not on the adapter.
	// The docs give unauthenticated IPs 100 credits a minute and this machine is served 1000; a
	// history call costs 90 at any limit, so 6 s holds paging to ~900 credits a minute.
	MinInterval = 6 * time.Second

	// infoTTL: `/info` changes on listings and parameter edits only.
	infoTTL = time.Hour

	// historyPageSize is the documented maximum page. Every history call costs the same 90 credits
	// whatever the limit, so asking for fewer buys nothing.
	historyPageSize = 4000
	historyMaxPages = 20
)

// Adapter collects Pacifica's USDC-margined perpetuals.
//
// The `/info` cache is mutex-guarded because it is package-level `let` state on the TypeScript side
// and both FetchSnapshots and FetchFundingHistory load it — the venue's snapshot and history loops
// can be inside it at once, and nothing promises they never overlap.
type Adapter struct {
	client *httpclient.Client

	mu            sync.Mutex
	perpetuals    map[string]MarketInfo
	hasInfo       bool
	infoFetchedAt time.Time
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// loadInfo returns the perpetual list, refetching it only once the cache is an hour old.
func (a *Adapter) loadInfo(ctx context.Context, now time.Time) (map[string]MarketInfo, error) {
	a.mu.Lock()
	cached, fetchedAt, has := a.perpetuals, a.infoFetchedAt, a.hasInfo
	a.mu.Unlock()

	if has && now.Sub(fetchedAt) < infoTTL {
		return cached, nil
	}

	var body Response[MarketInfo]
	if err := a.client.GetJSON(ctx, API+"/info", &body); err != nil {
		return nil, err
	}
	info, err := ExpectData(body, "info")
	if err != nil {
		return nil, err
	}
	perpetuals := Perpetuals(info)

	a.mu.Lock()
	a.perpetuals, a.infoFetchedAt, a.hasInfo = perpetuals, now, true
	a.mu.Unlock()
	return perpetuals, nil
}

// FetchSnapshots runs one cycle: `/info/prices`, which answers for the whole book, against the
// hourly `/info`.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	perpetuals, err := a.loadInfo(ctx, now)
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var body Response[Price]
	if err := a.client.GetJSON(ctx, API+"/info/prices", &body); err != nil {
		return core.SnapshotBatch{}, err
	}
	prices, err := ExpectData(body, "info/prices")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(prices, perpetuals, now.UnixMilli()),
		Settled:   []core.FundingEvent{},
	}, nil
}

// FetchFundingHistory returns settled hourly payments for one market in [fromMs, toMs], oldest
// first.
//
// The endpoint answers newest first with no time filter, so the walk pages by cursor until a page is
// short, the venue says there is no more, or a page has reached back past the window.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	// Only the declared base is needed, and any copy of `/info` has it — so an existing cache is used
	// at any age rather than being refreshed for a backfill.
	perpetuals, err := a.cachedPerpetuals(ctx)
	if err != nil {
		return nil, err
	}

	records := make([]FundingRecord, 0, historyPageSize)
	cursor := ""
	for page := 0; page < historyMaxPages; page++ {
		endpoint := fmt.Sprintf("%s/funding_rate/history?symbol=%s&limit=%d",
			API, url.QueryEscape(venueSymbol), historyPageSize)
		if cursor != "" {
			endpoint += "&cursor=" + url.QueryEscape(cursor)
		}

		var body Response[FundingRecord]
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		batch, err := ExpectData(body, "funding_rate/history")
		if err != nil {
			return nil, err
		}
		records = append(records, batch...)

		cursor = ""
		if body.NextCursor != nil {
			cursor = *body.NextCursor
		}
		oldest, readable := oldestCreatedAt(batch)
		if !body.HasMore || cursor == "" || len(batch) < historyPageSize || (readable && oldest <= fromMs) {
			break
		}
	}

	var info *MarketInfo
	if market, listed := perpetuals[venueSymbol]; listed {
		info = &market
	}
	return ParseFundingHistory(records, venueSymbol, info, fromMs, toMs), nil
}

// cachedPerpetuals is the `/info` cache at any age, loading it only when there is none. This is the
// TypeScript `info?.perpetuals ?? (await loadInfo(client, Date.now()))`: a backfill must not pay for
// a refresh it does not need, and it must not be the call that resets the hourly clock either.
func (a *Adapter) cachedPerpetuals(ctx context.Context) (map[string]MarketInfo, error) {
	a.mu.Lock()
	cached, has := a.perpetuals, a.hasInfo
	a.mu.Unlock()
	if has {
		return cached, nil
	}
	return a.loadInfo(ctx, time.Now())
}

// oldestCreatedAt is the earliest stamp in a page, and whether the page gave one at all.
//
// An empty page, or one carrying a stamp the parser cannot read, is not readable — which is what the
// TypeScript side gets from Math.min() over an empty or NaN-bearing list, where the `oldest <= fromMs`
// test is then false. It stops the walk on the page-length test rather than on an invented bound.
func oldestCreatedAt(batch []FundingRecord) (int64, bool) {
	oldest := int64(0)
	found := false
	for _, record := range batch {
		if !record.CreatedAt.OK {
			return 0, false
		}
		stamped := int64(record.CreatedAt.Val)
		if !found || stamped < oldest {
			oldest = stamped
			found = true
		}
	}
	return oldest, found
}
