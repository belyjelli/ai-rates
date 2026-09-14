// Package bluefin parses Bluefin Pro's (Sui) perp market data.
//
// Ported from packages/adapters/src/venues/bluefin.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/bluefin) and the same expected values as bluefin.test.ts, so the
// Go and TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: one per cycle, `GET /v1/exchange/tickers` (every market), plus `GET /v1/exchange/info`
// once an hour for each market's `status`. The public API host allows 300 requests per minute per IP
// (https://bluefin-exchange.readme.io/reference/rate-limits), 429 with Retry-After beyond it, so 250ms.
//
// FIXED POINT: "All numeric quantities are represented as string in e9 format" (tickers reference).
// Every `...E9` field is divided by 1e9: BTC `markPriceE9` 76784500000000 is $76,784.50, and
// `volume24hrE9` 2948000000 (2.948 BTC) x ~$76.8k matches `quoteVolume24hrE9` 226540583600000
// ($226,540.58). All raw integers seen are below 2^53, so the decoded float is exact before the
// division.
//
// FUNDING: hourly, as a fraction, positive means longs pay. "Funding Rate = (TWA(P_market) /
// TWA(P_index) - 1) / 24", an average of the last hour's 60 one-minute samples, with "an absolute value
// hourly cap of 0.1%" (https://learn.bluefin.io/bluefin/bluefin-perps-exchange/trading/funding);
// `maxFundingRateE9` is 1000000 (0.1%) on every market. The ticker carries two rates:
//   - `lastFundingRateE9`, the rate settled at the top of the last hour: BTC 12500 (0.0000125) equalled
//     the 22:00 row of `/exchange/fundingRateHistory` and did not move between 22:28 and 22:38;
//   - `estimatedFundingRateE9`, the running estimate for the hour in progress: BTC 60249 at 22:27,
//     55861 at 22:28, 30194 at 22:33, 14466 at 22:37, converging as minutes accumulate.
//
// The estimate is what gets settled. Polled each minute to the hour, the 22:59:33 estimates against the
// 23:00 settlements (ticker `lastFundingRateE9` at 23:00:30, and history rows at 23:00:00-23:00:02):
// ETH 143739 against 142061, DEEP 428114 against 426068, GOLD 241585 against 238732, BTC 12500 against
// 12500. The estimate restarts each hour (ETH read 12500 at 23:00:30 after 143739 at 22:59), so it is
// noisiest in the first minutes: BTC read 60249 at 22:27 on its way to settling at 12500.
// So the snapshot carries the estimate as `predicted`, due at `nextFundingTimeAtMillis`, and the last
// rate rides along as a `settled` event at the top of the previous hour. Checked against Hyperliquid:
// BTC's settled 0.0000125/h is 10.95% APR against 0.0000116/h (10.1%); 24x would read 263%.
// `avgFundingRate8hrE9` is an average of settled hourly rates, not an 8-hour rate (BTC 12500 after eight
// settlements of 12500), and is not collected.
//
// SETTLEMENT TIME: history rows are stamped a few ms past the hour (1789336800051 = 22:00:00.051), and
// the ticker's settled event is derived as `nextFundingTimeAtMillis - 1h`, exactly on the hour. Both are
// snapped to the hour so that the same settlement, seen from either source, is one row and not two.
//
// UNITS: `openInterestE9` is USD notional, not base units. Evidence: BTC 101969.816 as BTC would be
// $7.8bn on a venue trading $0.23M a day, and ETH 15721 as ETH $39M; as USD, the eight markets sum to
// $767k on 2026-09-13 against DefiLlama's "Bluefin Pro" open interest of $774,785 the same hour.
// `quoteVolume24hrE9` is "volume in last 24hrs in USDC". `oraclePriceE9` is the spot index the funding
// formula compares against, so it is `indexPrice`.
//
// TRADABILITY: `status` ACTIVE in exchange info. All 8 markets were ACTIVE on 2026-09-13; a market with
// any other status, or missing from info, is not collected.
//
// CLASS: Bluefin declares none (exchange info has `baseAssetName` "Gold" for GOLD-PERP, and no category
// anywhere), so all 8 are crypto. GOLD-PERP reaches base XAU through core's alias and stays crypto,
// which keeps it out of the commodity XAU pool until Bluefin declares a class.
//
// QUOTE: USDC, the only margin asset in exchange info `assets` and the currency of `quoteVolume24hrE9`.
//
// BASE: `baseAssetSymbol` agreed with the parser on all 8 symbols (`BTC-PERP` -> BTC).
package bluefin

import (
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	VenueID = "bluefin"
	API     = "https://api.sui-prod.bluefin.io/v1"

	// MinIntervalMs is the request spacing the venue is collected at, from the TypeScript adapter's
	// `minIntervalMs`: 300 requests per minute per IP, so 250ms.
	MinIntervalMs = 250

	hourMs            = 3_600_000
	fundingBasisHours = 1
	quoteCurrency     = "USDC"
)

// MarketInfo is one market's row in exchange info. `status` is the tradability signal; anything but
// ACTIVE, or absent from the list entirely, is not collected.
type MarketInfo struct {
	Symbol          string `json:"symbol"`
	Status          string `json:"status"`
	BaseAssetSymbol string `json:"baseAssetSymbol"`
}

type ExchangeInfo struct {
	Markets []MarketInfo `json:"markets"`
}

// Ticker is one market's row from /exchange/tickers. Every `...E9` field is e9 fixed point; see E9.
type Ticker struct {
	Symbol string `json:"symbol"`
	// LastFundingRateE9 is the rate settled at the top of the last hour; EstimatedFundingRateE9 is
	// the running estimate for the hour in progress, and is what will settle.
	LastFundingRateE9       adapters.Num `json:"lastFundingRateE9"`
	EstimatedFundingRateE9  adapters.Num `json:"estimatedFundingRateE9"`
	NextFundingTimeAtMillis adapters.Num `json:"nextFundingTimeAtMillis"`
	MarkPriceE9             adapters.Num `json:"markPriceE9"`
	OraclePriceE9           adapters.Num `json:"oraclePriceE9"`
	// OpenInterestE9 is USD notional, e9 — not base units.
	OpenInterestE9    adapters.Num `json:"openInterestE9"`
	QuoteVolume24hrE9 adapters.Num `json:"quoteVolume24hrE9"`
}

type FundingRow struct {
	Symbol              string       `json:"symbol"`
	FundingRateE9       adapters.Num `json:"fundingRateE9"`
	FundingTimeAtMillis adapters.Num `json:"fundingTimeAtMillis"`
}

// E9 is an e9 fixed-point quantity as a plain number, or nil when the field is absent.
//
// Absent stays absent rather than becoming zero: a zero funding rate is a legitimate reading, and
// dividing a defaulted zero would publish it as one.
func E9(n adapters.Num) *float64 {
	if !n.OK {
		return nil
	}
	value := n.Val / 1e9
	return &value
}

// hourFloor snaps an epoch-ms instant down to the top of its hour, so the same settlement seen from
// the ticker (exactly on the hour) and from history (a few ms past it) is one row and not two.
func hourFloor(ms int64) int64 {
	floored := ms / hourMs * hourMs
	if ms < 0 && floored != ms {
		floored -= hourMs
	}
	return floored
}

func ref(symbol string) core.MarketRef {
	quote := quoteCurrency
	// Bluefin declares no asset class: crypto.
	return adapters.MarketRefFor(VenueID, symbol, adapters.Overrides{Quote: &quote, HasQuote: true})
}

// ParseTickers turns the bulk ticker list into this cycle's snapshots, plus the settled events that
// ride along on it.
//
// The predicted rate is the running estimate for the hour in progress, because that is what settles;
// `lastFundingRateE9` is the previous hour's settlement, dated from `nextFundingTimeAtMillis - 1h`
// rather than from the clock, so it lands on the hour the venue actually paid.
func ParseTickers(tickers []Ticker, info []MarketInfo, now int64) core.SnapshotBatch {
	active := make(map[string]struct{}, len(info))
	for _, market := range info {
		if market.Status == "ACTIVE" {
			active[market.Symbol] = struct{}{}
		}
	}

	snapshots := make([]core.FundingSnapshot, 0, len(tickers))
	settled := make([]core.FundingEvent, 0, len(tickers))
	for _, ticker := range tickers {
		rate := E9(ticker.EstimatedFundingRateE9)
		if _, live := active[ticker.Symbol]; !live || rate == nil {
			continue
		}

		base := ref(ticker.Symbol)
		nextFundingAt := ticker.NextFundingTimeAtMillis.PositiveMs()
		intervalHours := float64(fundingBasisHours)
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     base,
			ObservedAt:    now,
			Rate:          *rate,
			BasisHours:    fundingBasisHours,
			IntervalHours: &intervalHours,
			NextFundingAt: nextFundingAt,
			Kind:          core.KindPredicted,
			MarkPrice:     E9(ticker.MarkPriceE9),
			IndexPrice:    E9(ticker.OraclePriceE9),
			// openInterestE9 is USD notional already.
			OpenInterestUSD: E9(ticker.OpenInterestE9),
			Volume24hUSD:    E9(ticker.QuoteVolume24hrE9),
		})

		last := E9(ticker.LastFundingRateE9)
		if last != nil && nextFundingAt != nil {
			settled = append(settled, core.FundingEvent{
				MarketRef:  base,
				SettledAt:  hourFloor(*nextFundingAt - hourMs),
				Rate:       *last,
				BasisHours: fundingBasisHours,
				MarkPrice:  nil,
			})
		}
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}
}

// ParseFundingHistory returns hourly settlements within [fromMs, toMs], oldest first, snapped to the
// hour.
//
// Keyed by the snapped timestamp, so a row the venue repeats across page boundaries — or one that
// also arrived on a ticker — collapses to a single settlement.
func ParseFundingHistory(rows []FundingRow, symbol string, fromMs, toMs int64) []core.FundingEvent {
	base := ref(symbol)
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		rate := E9(row.FundingRateE9)
		if !row.FundingTimeAtMillis.OK || rate == nil {
			continue
		}
		settledAt := hourFloor(int64(row.FundingTimeAtMillis.Val))
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  settledAt,
			Rate:       *rate,
			BasisHours: fundingBasisHours,
			MarkPrice:  nil,
		}
	}

	events := make([]core.FundingEvent, 0, len(bySettlement))
	for _, event := range bySettlement {
		events = append(events, event)
	}
	sort.Slice(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
