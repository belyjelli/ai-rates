package dydx

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"sync"
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
// Its only state is the liquidation cursor, so the venue's snapshot, history and tier loops can
// still share one Adapter and therefore one set of request spacing and one circuit breaker.
type Adapter struct {
	client *httpclient.Client

	// mu guards liqCursor, which the liquidation poll writes and reads. The side loops run on their
	// own goroutines, so this map must not be touched unlocked.
	mu sync.Mutex
	// liqCursor is the newest liquidation timestamp seen per market, kept for the process's life.
	// See FetchLiquidations for why it is memory rather than a stored high-water mark.
	liqCursor map[string]time.Time
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, liqCursor: map[string]time.Time{}}
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

// Liquidation sweep tuning.
const (
	// liqDeepPage is what a market is asked for the FIRST time it is polled in this process, and it
	// is the whole reason this is a poll rather than the WebSocket feed it started as.
	//
	// 1,000 trades reaches back a long way, because these books are thin: measured 2026-09-17, one
	// page spanned 8 hours on BTC-USD, 31 on SOL-USD, 82 on AVAX-USD and 179 on DOGE-USD. So a cold
	// start — a deploy, a crash, an outage — backfills days of forced closes that a socket could
	// only have caught live. The v4_trades socket, by contrast, delivered 78 liquidations in its
	// subscribe snapshot and then NOTHING in 24 minutes, and refused the subscription set outright
	// past 32 markets on one connection.
	liqDeepPage = 1000
	// liqTailPage is what every later poll asks for. The endpoint offers no "created after" filter —
	// only limit, page and createdBeforeOrAt — so the cursor cannot make the venue send less; it can
	// only bound what is parsed and handed to the store. A smaller page is how the request itself
	// gets cheaper, and 100 is a wide margin: BTC-USD's busiest measured stretch was ~2 trades a
	// minute, so 100 covers roughly fifty minutes against a poll that runs every five.
	liqTailPage = 100
)

// FetchLiquidations sweeps every active market's recent trades and keeps the forced closes.
//
// WHY A POLL AND NOT A SOCKET. dYdX has no liquidation channel; the only public marker is a `type`
// on a trade, and it is available both ways. The socket was tried first and failed twice over: it
// rejects more than 32 subscriptions per connection (which is 78 markets over three connections for
// a venue that produces a handful of liquidations a day), and in 24 minutes of live listening it
// pushed none at all. The REST window carries real history instead, so one pass catches what a
// restart missed. There is no market-wide endpoint, so this is one request per market.
//
// WHY THE CURSOR IS IN MEMORY rather than read back from the database. The LiquidationFetcher
// contract is FetchLiquidations(ctx) with no store handle, and threading one through for this would
// widen an interface five other venues implement. The cost of losing the cursor on restart is
// exactly one deep page per market, which is the backfill this venue wants on a cold start anyway —
// and everything in it that was already stored is absorbed by the table's primary key.
//
// MEASURED 2026-09-18 against the live indexer, every active market: the cold sweep returned 475
// liquidations in 79 requests (33 seconds at this venue's 100ms spacing), spanning 2026-04-15 to
// 2026-09-17 — five MONTHS of backfill that the socket could never have replayed — and 405 of them
// were long liquidations against 70 short. The sweep immediately after returned 2, which is the
// cursor doing its job; without it every poll would hand the store those 475 rows again.
//
// complete is true only when every market answered, so a partial sweep is visible as such.
func (a *Adapter) FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error) {
	markets, err := a.fetchMarkets(ctx)
	if err != nil {
		return nil, false, err
	}

	out := make([]core.Liquidation, 0, 64)
	complete := true
	for _, market := range markets {
		// The market list comes from the venue's own catalog call, so a listing or delisting is
		// picked up on the next sweep with nothing hardcoded.
		if market.Ticker == "" || !strings.EqualFold(market.Status, "ACTIVE") {
			continue
		}
		// Shutdown mid-sweep is a stop, not a venue fault: return what was gathered and say it is
		// partial, rather than reporting an error the circuit breaker would count.
		if ctx.Err() != nil {
			return out, false, nil
		}

		a.mu.Lock()
		cursor, seen := a.liqCursor[market.Ticker]
		a.mu.Unlock()

		limit := liqDeepPage
		if seen {
			limit = liqTailPage
		}

		var body TradesResponse
		endpoint := fmt.Sprintf("%s/trades/perpetualMarket/%s?limit=%d", baseURL, url.PathEscape(market.Ticker), limit)
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			// One market failing must not lose the rest of the sweep; the venue's own circuit
			// breaker inside the client handles a venue that is failing wholesale.
			complete = false
			continue
		}

		liquidations := ParseLiquidations(market.Ticker, body.Trades, cursor)
		out = append(out, liquidations...)

		// Advance the cursor from the whole page, not only from the liquidations: the newest trade
		// seen bounds what a later poll needs to reconsider, and a market with no liquidations at
		// all must still stop asking for a deep page.
		newest := cursor
		for _, trade := range body.Trades {
			at, err := time.Parse(time.RFC3339Nano, trade.CreatedAt)
			if err != nil {
				continue
			}
			if at = at.UTC(); at.After(newest) {
				newest = at
			}
		}
		a.mu.Lock()
		// Marked as seen even when the page was empty, so an idle market drops to the tail page.
		a.liqCursor[market.Ticker] = newest
		a.mu.Unlock()
	}
	return out, complete, nil
}
