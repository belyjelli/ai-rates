package standx

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
	// MinInterval is this venue's minimum spacing between requests, ported from the TypeScript
	// adapter's minIntervalMs of 100. StandX documents 50 requests/s per IP, which 100 ms is far
	// inside.
	MinInterval = 100 * time.Millisecond

	// symbolInfoTTL: `query_symbol_info` changes on listings and parameter edits only.
	symbolInfoTTL = int64(hourMs)

	// historyWindowMs: history is requested in windows of this size. One call answered 960 hourly
	// rows for 40 days, so a 30-day window (720 rows) stays inside anything the endpoint has been
	// seen to return.
	historyWindowMs = int64(30 * 24 * hourMs)
)

// Adapter collects StandX perps, measured from this machine on 2026-09-14 and read against
// https://docs.standx.com (standx-api/perps-http, standx-api/rate-limits, the funding-rate page).
//
//   - **One call a cycle**, plus `query_symbol_info` hourly. `query_market_overview` answers all 13
//     markets with funding, mark, notional OI and quote volume.
//   - **The interval is one hour, established three ways.** (1) `query_funding_rates` returned 960
//     rows for 40 days of BTC-USD, every one exactly 1h after the last, on the hour; XAU-USD the same
//     over 3 days. (2) `query_symbol_market` gives `next_funding_time` "2026-09-13T23:00:00Z" at
//     22:13. (3) The docs: interest is "settled on an hourly basis ... 0.00125% per hour (equivalent
//     to 0.01% per 8-hour funding period)", and `funding_interest_rate` is 0.0000125 on six markets.
//   - **The rate is a 1-hour rate.** Quiet markets (SOL, HYPE, ZEC, UNI) print 0.00001250, the
//     documented hourly interest. Against Hyperliquid's hourly rates at 22:13 UTC: BTC 0.00000838 vs
//     0.0000107, ETH 0.00000428 vs 0.0000125, HYPE 0.0000125 vs 0.0000125 — same scale, not 8x or
//     24x.
//   - **Predicted, not settled.** Docs call `funding_rate` the "current funding rate", and it moves
//     inside the hour: BTC read 0.00000838 at 22:12, 0.00000862 at 22:13 and 0.00000696 at 22:19,
//     while the settled 22:00 row was 0.00000873. It is the running estimate for the next hour.
//   - **Tradable**: status `trading` — all 13 on 2026-09-14.
//   - **Class** from the web app's declaration; see AssetTags. **Quote** `quote_asset` DUSD.
//   - **History**: `query_funding_rates?symbol=&start_time=&end_time=`, both required, in
//     milliseconds (an ISO time is rejected, seconds return nothing).
//   - **Rate limit**: 50 requests/s per IP; 100 ms spacing is far inside it.
//
// The symbol-info cache is mutex-guarded because it is package-level mutable state on the
// TypeScript side, where one event loop serialises every read: here a venue's snapshot loop and its
// history loop share one Adapter, and VenueLoop only promises that its own cycles do not overlap.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// symbolInfoAt is when the cached list was fetched, epoch ms; zero means nothing cached yet.
	symbolInfoAt int64
	tradable     map[string]SymbolInfo
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots runs one cycle: the hourly symbol list, which says what is trading and carries the
// quote and the headline leverage, and the overview, which carries everything else.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	tradable, err := a.loadSymbolInfo(ctx, nowMs)
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var overview Overview
	if err := a.client.GetJSON(ctx, APIBase+"/query_market_overview", &overview); err != nil {
		return core.SnapshotBatch{}, err
	}
	if overview.Symbols == nil {
		return core.SnapshotBatch{}, ErrUnexpectedOverview
	}

	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(*overview.Symbols, tradable, nowMs),
		Settled:   []core.FundingEvent{},
	}, nil
}

// FetchFundingHistory walks [fromMs, toMs] in 30-day windows, both bounds in milliseconds.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	// The quote only needs some copy of the symbol list, however old: DUSD on every market.
	tradable, cached := a.cachedSymbolInfo()
	if !cached {
		var err error
		if tradable, err = a.loadSymbolInfo(ctx, time.Now().UnixMilli()); err != nil {
			return nil, err
		}
	}
	var quote *string
	if info, known := tradable[venueSymbol]; known {
		quote = info.QuoteAsset
	}

	rows := make([]FundingRateRow, 0, 1024)
	for start := fromMs; start <= toMs; start += historyWindowMs {
		end := min(toMs, start+historyWindowMs-1)
		endpoint := fmt.Sprintf("%s/query_funding_rates?symbol=%s&start_time=%d&end_time=%d",
			APIBase, url.QueryEscape(venueSymbol), start, end)

		var batch []FundingRateRow
		if err := a.client.GetJSON(ctx, endpoint, &batch); err != nil {
			return nil, err
		}
		// A JSON `null` decodes into a nil slice, which is the shape the TypeScript Array.isArray
		// guard rejects; any other non-array fails the decode itself.
		if batch == nil {
			return nil, ErrUnexpectedHistory
		}
		rows = append(rows, batch...)
	}
	return ParseFundingHistory(rows, venueSymbol, quote, fromMs, toMs), nil
}

// loadSymbolInfo returns the tradable markets, refetching once the cached copy is an hour old.
//
// The request runs outside the lock, so a history sweep starting beside a cycle is never blocked on
// the network; the worst case is two calls whose results are identical.
func (a *Adapter) loadSymbolInfo(ctx context.Context, now int64) (map[string]SymbolInfo, error) {
	a.mu.Lock()
	fresh := a.tradable != nil && now-a.symbolInfoAt < symbolInfoTTL
	tradable := a.tradable
	a.mu.Unlock()
	if fresh {
		return tradable, nil
	}

	var info []SymbolInfo
	if err := a.client.GetJSON(ctx, APIBase+"/query_symbol_info", &info); err != nil {
		return nil, err
	}
	// As above: a `null` body decodes to a nil slice rather than failing, and must not read as a
	// venue with nothing listed.
	if info == nil {
		return nil, ErrUnexpectedSymbolInfo
	}

	loaded := Tradable(info)
	a.mu.Lock()
	a.symbolInfoAt = now
	a.tradable = loaded
	a.mu.Unlock()
	return loaded, nil
}

// cachedSymbolInfo is the remembered list at any age, and whether there is one at all.
func (a *Adapter) cachedSymbolInfo() (map[string]SymbolInfo, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.tradable, a.tradable != nil
}
