// Package extended parses Extended's (Starknet deployment) perpetual market data.
//
// Ported from packages/adapters/src/venues/extended.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/extended) and the same expected values as extended.test.ts, so the
// Go and TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: one per cycle, `GET /api/v1/info/markets` (~1 MB, every market with its stats inline).
// Rate limit is 1,000 requests/minute per IP (https://api.docs.extended.exchange/), so 100ms spacing.
//
// USER-AGENT: the docs say "the `User-Agent` header is required". Measured 2026-09-14 from this
// machine: 200 with `ai-rates-collector/0.1`, 403 Forbidden with the header removed. The shared
// client already sends its `UserAgent` on every request, so nothing extra is passed here.
//
// FUNDING: `marketStats.fundingRate` is a 1-hour rate, as a fraction, and positive means longs pay.
// The funding-payments doc (https://docs.extended.exchange/extended-resources/trading/funding-payments)
// says payments "are charged every hour" and gives the rate as `(premium + clamp(...)) / 8`, and the
// API docs call the history "the 1-hour rates that were applied". It is recalculated every minute and
// paid at the top of the hour, so the live value is `predicted`. `marketStats.nextFundingRate` is,
// despite its name, the epoch-ms timestamp of the next payment. Checked live: BTC 0.000013/h (11.4%
// APR) against Arcus 0.0000125/h (10.95%) and Variational 9.1% on the same afternoon.
//
// UNITS, checked live 2026-09-14: `openInterest` is "in collateral asset" (USD) and equals
// `openInterestBase` x mark (BTC 579.775 x 77,060.43 = $44.68M against $44.81M reported; the mark
// moves between the two fields' snapshots). `dailyVolume` is also collateral, BTC $72.5M.
//
// TRADABILITY: `type` PERPETUAL and `status` ACTIVE only. Of 399 markets on 2026-09-14: 323 active
// perps, 60 DELISTED, 12 PRELISTED, 1 REDUCE_ONLY (MKR) and 3 SPOT (BTCSPOT, ETHSPOT, USDTSPOT).
// Off-hours equities (`isOffHours`) stay ACTIVE and keep accruing funding, so they are kept.
//
// QUOTE: USDC. The API's `collateralAssetName` says "USD" on every market, but that is the unit of
// account: "All Extended markets are settled in USDC (i.e., PnL is paid in USDC)", per
// https://docs.extended.exchange/extended-resources/trading/unified-margin-and-balances
//
// BASE: the parser's reading of `name` is kept on every live market, because it always agrees with
// one of the venue's two declarations. Checked against all 323 on 2026-09-14:
//   - 26 `*_24_5` equities (`MU_24_5-USD`): `assetName` is the session-coded contract `MU_24_5`, while
//     `uiName` and the parser both say MU. Passing `assetName` would file Micron in a pool of its own.
//   - 9 `k`/`1000` prefixes (`1000PEPE`, `kNOT`): the parser reads the multiplier, as for every venue.
//   - Parser and `assetName` agree, `uiName` differs: XNG (ui NATGAS), ANTHROP (ui ANTHROPIC), SPX
//     (ui SPX6900, the memecoin), TECH100m (ui NDX, parsed TECH100M) and SPX500m (ui SPX, the S&P 500,
//     parsed SPX500M). These do not pool with the same underlying elsewhere; fixing that needs aliases,
//     which are core's decision, not this adapter's.
package extended

import (
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "extended"

const (
	hourMs = 3_600_000
	// fundingHours: Extended quotes funding per HOUR, not per settlement interval, and settles
	// hourly, so the basis and the interval are the same one hour.
	fundingHours = 1.0
	quoteAsset   = "USDC"
	// historyPageSize: history answers at most 1,000 rows per call, newest first (measured: a
	// 500-day window gave 1,000).
	historyPageSize = 1000
	historyMaxPages = 50
)

// MarketStats is the live stats block Extended inlines into every market.
type MarketStats struct {
	DailyVolume adapters.Num `json:"dailyVolume"`
	MarkPrice   adapters.Num `json:"markPrice"`
	IndexPrice  adapters.Num `json:"indexPrice"`
	FundingRate adapters.Num `json:"fundingRate"`
	// NextFundingRate is the epoch ms of the next funding payment, whatever the name says.
	NextFundingRate  adapters.Num `json:"nextFundingRate"`
	OpenInterest     adapters.Num `json:"openInterest"`
	OpenInterestBase adapters.Num `json:"openInterestBase"`
}

// TradingConfig is the per-market limits block; only the headline leverage is read.
type TradingConfig struct {
	MaxLeverage adapters.Num `json:"maxLeverage"`
}

// Market is one row of /info/markets.
//
// MarketStats is a pointer because a market without a stats block is a distinct state from one whose
// stats are all absent, and the parser skips the former outright — as the TypeScript `!stats` check
// does. Category and SubCategory are plain strings: the TypeScript reads them through
// `?.trim().toUpperCase()`, under which null, undefined and "" all take the same branch.
type Market struct {
	Name                string         `json:"name"`
	Type                string         `json:"type"`
	Status              string         `json:"status"`
	UIName              string         `json:"uiName"`
	AssetName           string         `json:"assetName"`
	Category            string         `json:"category"`
	SubCategory         string         `json:"subCategory"`
	CollateralAssetName string         `json:"collateralAssetName"`
	MarketStats         *MarketStats   `json:"marketStats"`
	TradingConfig       *TradingConfig `json:"tradingConfig"`
}

// Response is Extended's uniform envelope.
type Response[T any] struct {
	Status string `json:"status"`
	Data   T      `json:"data"`
}

// FundingRow is one settled hourly payment from /info/{market}/funding.
type FundingRow struct {
	Market    string       `json:"m"`
	Rate      adapters.Num `json:"f"`
	SettledAt adapters.Num `json:"T"`
}

// Declared is the class Extended declares for a market. Funding history states neither field, so the
// adapter remembers them from the markets call.
type Declared struct {
	Category    string
	SubCategory string
}

// DeclaredClass is the class Extended declares: `category` says whether a market is RWA,
// `subCategory` says which kind.
//
// On 2026-09-14 the 323 active perps split into Crypto 196 (L1 46, DeFi 38, Meme 37, Infra 35, AI 25,
// L2 13, and Commodity 2 -- PAXG and XAUT, gold tokens filed under Crypto) and RWA 127 (Equity 109,
// Commodity 7, ETF/Index 7, Pre-market 2, FX 2). `Pre-market` is OpenAI and Anthropic, pre-IPO
// shares, so equity. `ETF/Index` is passed as index and MarketRefFor's table decides which of the two
// it is: JP225 stays index, EWY and DRAM become equity. Delisted `TradFi` rows (PLACE_JPY) and any
// future RWA value fall to ClassifyNonCrypto. Legacy categories L1, L2 and Infra are crypto.
func DeclaredClass(category, subCategory, base string) core.AssetClass {
	if strings.ToUpper(strings.TrimSpace(category)) != "RWA" {
		return core.ClassCrypto
	}
	switch strings.ToUpper(strings.TrimSpace(subCategory)) {
	case "EQUITY", "PRE-MARKET":
		return core.ClassEquity
	case "COMMODITY":
		return core.ClassCommodity
	case "FX":
		return core.ClassFX
	case "ETF/INDEX":
		return core.ClassIndex
	default:
		return core.ClassifyNonCrypto(base)
	}
}

// ref builds the market reference: the base as the symbol parser reads it, USDC as the quote, and
// the class from the venue's own two declarations, which needs the parsed base to settle an RWA
// sub-category it does not know.
func ref(name string, declared Declared) core.MarketRef {
	class := DeclaredClass(declared.Category, declared.SubCategory, core.ParseVenueSymbol(name).Base)
	quote := quoteAsset
	return adapters.MarketRefFor(VenueID, name, adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseSnapshots normalizes /info/markets into one snapshot per live perp.
func ParseSnapshots(body Response[[]Market], now int64) []core.FundingSnapshot {
	snapshots := make([]core.FundingSnapshot, 0, len(body.Data))
	for _, market := range body.Data {
		stats := market.MarketStats
		if market.Type != "PERPETUAL" || market.Status != "ACTIVE" || stats == nil || !stats.FundingRate.OK {
			continue
		}

		var maxLeverage adapters.Num
		if market.TradingConfig != nil {
			maxLeverage = market.TradingConfig.MaxLeverage
		}
		// A fresh variable per snapshot: one shared pointer would make every market's interval
		// alias the same float.
		intervalHours := fundingHours

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       ref(market.Name, Declared{Category: market.Category, SubCategory: market.SubCategory}),
			ObservedAt:      now,
			Rate:            stats.FundingRate.Val,
			BasisHours:      fundingHours,
			IntervalHours:   &intervalHours,
			NextFundingAt:   stats.NextFundingRate.PositiveMs(),
			Kind:            core.KindPredicted,
			MarkPrice:       stats.MarkPrice.Ptr(),
			IndexPrice:      stats.IndexPrice.Ptr(),
			OpenInterestUSD: stats.OpenInterest.Ptr(),
			Volume24hUSD:    stats.DailyVolume.Ptr(),
			MaxLeverage:     maxLeverage.Ptr(),
		})
	}
	return snapshots
}

// ParseFunding returns hourly settlements for one market within [fromMs, toMs], oldest first.
//
// `T` carries the settlement run's own jitter (`1789336801693`, 1.7s past the hour); it is kept as
// published rather than rounded, as dYdX's `effectiveAt` is.
func ParseFunding(rows []FundingRow, venueSymbol string, declared Declared, fromMs, toMs int64) []core.FundingEvent {
	base := ref(venueSymbol, declared)
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		if !row.SettledAt.OK || !row.Rate.OK {
			continue
		}
		settledAt := int64(row.SettledAt.Val)
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  settledAt,
			Rate:       row.Rate.Val,
			BasisHours: fundingHours,
			MarkPrice:  nil,
		}
	}

	events := make([]core.FundingEvent, 0, len(bySettlement))
	for _, event := range bySettlement {
		events = append(events, event)
	}
	// Keys are unique settlement times, so ordering by them is a total order: the map's randomised
	// iteration cannot reach the result.
	sort.Slice(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
