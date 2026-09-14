// Package paradex parses Paradex's perpetual market data.
//
// Ported from packages/adapters/src/venues/paradex.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/paradex) and the same expected values as paradex.test.ts, so the
// Go and TypeScript parsers cannot drift apart while both are collecting.
package paradex

import (
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "paradex"

// Summary is one row of /v1/markets/summary?market=ALL. The endpoint answers for options as well as
// perps, which is why the parser filters on the symbol suffix and on the market's asset_kind.
type Summary struct {
	Symbol          string       `json:"symbol"`
	FundingRate     adapters.Num `json:"funding_rate"`
	MarkPrice       adapters.Num `json:"mark_price"`
	UnderlyingPrice adapters.Num `json:"underlying_price"`
	OpenInterest    adapters.Num `json:"open_interest"`
	Volume24h       adapters.Num `json:"volume_24h"`
}

// Market is one row of /v1/markets.
//
// QuoteCurrency and SettlementCurrency are pointers because absent is a distinct state from the
// empty string: the TypeScript side chooses between them with `??`, which falls through on null and
// undefined only, and collapsing the two here would change which one is chosen.
type Market struct {
	Symbol             string       `json:"symbol"`
	AssetKind          string       `json:"asset_kind"`
	FundingPeriodHours adapters.Num `json:"funding_period_hours"`
	QuoteCurrency      *string      `json:"quote_currency"`
	SettlementCurrency *string      `json:"settlement_currency"`
	// Tags are sector tags. `RWA` marks the tradfi listings; see DeclaredClass.
	Tags []string `json:"tags"`
}

// Results is Paradex's uniform list wrapper.
type Results[T any] struct {
	Results []T `json:"results"`
}

// DeclaredClass is the class Paradex declares for a perp: the `RWA` tag in /v1/markets, or crypto.
//
// `RWA` says "not crypto" without saying which kind, so the base tables settle that. On 2026-09-14
// 21 of 63 perps carried it: XAU XAG XPT XCU CL BZ NG (commodity; NG reaches NATGAS by alias), US500
// US100 (index), and twelve single names and ETFs such as MSTR, DRAM and EWY (equity). The other 42
// carried a crypto sector tag (LAYER-1, DEFI, MEME, AI, LAYER-2) or none. PAXG is tagged DEFI.
func DeclaredClass(tags []string, base string) core.AssetClass {
	for _, tag := range tags {
		if strings.ToUpper(strings.TrimSpace(tag)) == "RWA" {
			return core.ClassifyNonCrypto(base)
		}
	}
	return core.ClassCrypto
}

// ParseSnapshots normalizes the markets summary. Paradex accrues funding continuously (every second)
// rather than at discrete settlements, so there is no interval or next funding time. The summary
// funding_rate is the raw rate over the market's own funding_period_hours (8h for most perps; docs:
// "not a normalized 8h funding rate") and already includes the market's funding multiplier.
func ParseSnapshots(summary Results[Summary], markets Results[Market], now int64) []core.FundingSnapshot {
	perps := make(map[string]Market, len(markets.Results))
	for _, m := range markets.Results {
		if m.AssetKind == "PERP" {
			perps[m.Symbol] = m
		}
	}

	snapshots := make([]core.FundingSnapshot, 0, len(summary.Results))
	for _, row := range summary.Results {
		market, ok := perps[row.Symbol]
		basisHours := market.FundingPeriodHours
		if !strings.HasSuffix(row.Symbol, "-PERP") || !ok || !row.FundingRate.OK ||
			!basisHours.OK || basisHours.Val <= 0 {
			continue
		}

		// Funding and PnL settle in the settlement currency (USDC), so that is the collateral quote.
		quote := market.SettlementCurrency
		if quote == nil {
			quote = market.QuoteCurrency
		}
		class := DeclaredClass(market.Tags, core.ParseVenueSymbol(row.Symbol).Base)
		markPrice := row.MarkPrice.Ptr()

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef: adapters.MarketRefFor(VenueID, row.Symbol, adapters.Overrides{
				Quote:      quote,
				HasQuote:   true,
				AssetClass: &class,
			}),
			ObservedAt:      now,
			Rate:            row.FundingRate.Val,
			BasisHours:      basisHours.Val,
			IntervalHours:   nil,
			NextFundingAt:   nil,
			Kind:            core.KindPredicted,
			MarkPrice:       markPrice,
			IndexPrice:      row.UnderlyingPrice.Ptr(),
			OpenInterestUSD: adapters.Mul(row.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    row.Volume24h.Ptr(),
		})
	}
	return snapshots
}
