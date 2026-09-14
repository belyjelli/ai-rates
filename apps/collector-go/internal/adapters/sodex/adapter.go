package sodex

import (
	"context"
	"fmt"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	apiBase = "https://mainnet-gw.sodex.dev/api/v1/perps"
	// symbolsTTL: `markets/symbols` is ~106 KB and changes on listings and halts.
	symbolsTTL = time.Hour
	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's
	// minIntervalMs of 100. Exported because the spacing lives on the client the caller builds, not
	// on the adapter.
	MinInterval = 100 * time.Millisecond
)

// Adapter fetches SoDEX perps, measured from this machine on 2026-09-14 and read against
// https://sodex.com/documentation (trading-api/rest-v1: perps API and schema;
// trading-mechanics/funding; trading-api/api-rate-limits).
//
//   - One call a cycle, plus `markets/symbols` hourly. `markets/tickers` answers every market with
//     funding, next funding time, mark, index, OI, quote volume and top of book.
//   - Hourly, and the rate is a 1-hour rate. Docs: "Funding payments occur every hour", the 8-hour
//     formula "is then divided by 8 to determine the hourly rate", and `interestRate` is the "8h
//     interest rate; always 0.0001". `fundingInterval` is 3600 s on all 98 symbols and
//     `nextFundingTime` was the next UTC hour on every TRADING market. Against Hyperliquid's hourly
//     rates at 22:13-22:20 UTC: BTC 0.0000075-0.0000092 vs 0.0000107-0.0000109, ETH
//     0.0000071-0.0000079 vs 0.0000125, ENA 0.0000104 vs 0.0000125 — same scale, not 8x or 24x.
//     The schema allows any multiple of 3600. Whether a 4h market would quote per hour or per
//     interval has never been observable, so a non-hourly market is not collected rather than given
//     a guessed basis.
//   - Predicted. Docs call `fundingRate` the "current funding rate", and it moves inside the hour:
//     BTC read 0.0000074662 at 22:12, 0.0000081299 at 22:15 and 0.0000092374 at 22:20, all with the
//     same `nextFundingTime`. No settled rate appears anywhere public.
//   - Tradable: status TRADING — 91 of 98 (HALT: BASED, BREV, NATGAS, TAO, TON, KIOXIA, SOSO; BASED
//     and TON still appear in tickers with a stale June `nextFundingTime`).
//   - Class: none declared, so crypto. Checked on 2026-09-14: `markets/symbols`, `markets/coins` and
//     the documented schema carry no category, and the web app's bundles hold no market-category map
//     (unlike StandX's). About 30 of the 91 are tradfi listings (TSLA, AAPL, NVDA, US500, USTECH100,
//     CL, SILVER, COPPER, EWY, ...) and are filed crypto for want of a declaration; migration 016's
//     mark gate is what keeps them out of crypto pools they disagree with.
//   - Quote `quoteCoin`, vUSDC on all 98.
//   - No funding history: the documented public market endpoints are symbols, coins, tickers,
//     miniTickers, mark-prices, bookTickers, orderbook, klines and trades; guessed funding paths 404.
//   - Rate limit: 1,200 weight per minute per IP; tickers and symbols weigh 2. 100 ms is ample.
//
// The symbols cache is the only mutable state the adapter holds. No lock guards it: SoDEX publishes
// no settlements to sweep, so this adapter exposes no second loop — FetchSnapshots is the only
// reader and writer, and a venue's cycles never overlap.
type Adapter struct {
	client *httpclient.Client

	tradable          map[string]Symbol
	tradableFetchedAt time.Time
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every live SoDEX perp.
//
// The hourly symbols call is what says a market is tradable at all, and carries the funding
// interval, the quote coin and the headline leverage — none of which the tickers response states.
// Halted markets keep appearing in tickers with a stale funding time, so a ticker alone cannot be
// trusted to mean a market is live.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	if a.tradable == nil || now.Sub(a.tradableFetchedAt) >= symbolsTTL {
		var body Response[Symbol]
		if err := a.client.GetJSON(ctx, apiBase+"/markets/symbols", &body); err != nil {
			return core.SnapshotBatch{}, err
		}
		if body.Code != 0 || body.Data == nil {
			return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected markets/symbols response", VenueID)
		}
		a.tradable = Tradable(body.Data)
		a.tradableFetchedAt = now
	}

	var tickers Response[Ticker]
	if err := a.client.GetJSON(ctx, apiBase+"/markets/tickers", &tickers); err != nil {
		return core.SnapshotBatch{}, err
	}
	if tickers.Code != 0 || tickers.Data == nil {
		return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected markets/tickers response", VenueID)
	}
	return core.SnapshotBatch{Snapshots: ParseSnapshots(tickers.Data, a.tradable, now.UnixMilli())}, nil
}

// No FetchFundingHistory: SoDEX publishes no settled funding anywhere public.
