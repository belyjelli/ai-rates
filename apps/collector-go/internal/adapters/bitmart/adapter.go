package bitmart

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
	baseURL = "https://api-cloud-v2.bitmart.com/contract/public"

	// MinInterval is the spacing this venue's client should use. Public contract endpoints answer
	// `x-bm-ratelimit-limit: 12`, `x-bm-ratelimit-reset: 2`, mode IP: 12 requests per 2 seconds. One
	// request each 200ms is 10 per 2 seconds.
	MinInterval = 200 * time.Millisecond

	// historyLimit: `funding-rate-history` caps `limit` at 100 (1000 answers 100) and has no way to
	// page further.
	historyLimit = 100
)

// knownMarket is what the last snapshot cycle learned about a market, so a later history call can
// carry the class and the interval the bulk response stated rather than re-deriving them.
type knownMarket struct {
	ref           core.MarketRef
	intervalHours *float64
}

// Adapter collects BitMart's USDT- and USDC-margined perpetuals: one request a cycle.
//
// The known-market cache lives HERE, mutex-guarded, rather than at package scope as the TypeScript
// keeps it. In Go the collector runs each venue on its own goroutine against a shared process, so a
// package-level map would be unsynchronised shared state — a data race the detector flags
// immediately, because a backfill reads it while a snapshot cycle is replacing it.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// known is replaced wholesale rather than mutated, so a reader holding the previous map is never
	// racing a refresh.
	known map[string]knownMarket
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, known: map[string]knownMarket{}}
}

func (a *Adapter) VenueID() string   { return VenueID }
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, baseURL+path, out)
}

// FetchSnapshots runs one cycle: the single bulk /details call, which carries funding, the index, the
// sizes and the classes for the whole book.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var env Envelope[Details]
	if err := a.get(ctx, "/details", &env); err != nil {
		return core.SnapshotBatch{}, err
	}
	batch, err := ParseSnapshots(env, now.UnixMilli())
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	known := make(map[string]knownMarket, len(batch.Snapshots))
	for _, snapshot := range batch.Snapshots {
		known[snapshot.VenueSymbol] = knownMarket{
			ref:           snapshot.MarketRef,
			intervalHours: snapshot.IntervalHours,
		}
	}
	a.mu.Lock()
	a.known = known
	a.mu.Unlock()

	return batch, nil
}

// FetchFundingHistory reads the newest 100 settlements and cuts them to the window.
//
// `start_time` and `end_time` are ignored (a 2026-06 window answered with the latest five) and
// `limit` stops at 100, so this reaches back 100 intervals — 33 days at 8h, four at 1h — and a
// backfill older than that gets nothing, which the collector records as the venue's limit. Coverage
// can also be stale: ESPORTSUSDT, settling hourly on 2026-09-14, had no history row after
// 2026-07-30.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	var env Envelope[FundingHistory]
	if err := a.get(ctx, fmt.Sprintf("/funding-rate-history?symbol=%s&limit=%d",
		url.QueryEscape(venueSymbol), historyLimit), &env); err != nil {
		return nil, err
	}
	history, err := env.unwrap("funding history")
	if err != nil {
		return nil, err
	}

	a.mu.Lock()
	market, seen := a.known[venueSymbol]
	a.mu.Unlock()

	ref := market.ref
	var fallbackHours *float64
	if seen {
		fallbackHours = market.intervalHours
	} else {
		// Nothing learned about this symbol yet, so the reference is parsed off the symbol and the
		// basis has to come from the settlements themselves.
		ref = adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{})
	}
	return ParseFundingHistory(ref, history.List, fromMs, toMs, fallbackHours), nil
}
