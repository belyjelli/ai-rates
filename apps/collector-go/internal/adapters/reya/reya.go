// Package reya parses Reya DEX's v2 perp market data.
//
// Ported from packages/adapters/src/venues/reya.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/reya) and the same expected values as reya.test.ts, so the Go and
// TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: `GET /v2/perpMarkets/summary` every cycle, plus `GET /v2/marketDefinitions` once an hour.
// Rate limit is 1,000 requests per 60s per IP across all REST endpoints
// (https://docs.reya.xyz/developers/rate-limits.md), so 100ms spacing.
//
// FUNDING -- the rate. `fundingRate` is the "current hourly funding rate"
// (https://github.com/Reya-Labs/reya-api-specs, `MarketSummary`), and it is quoted in PERCENT: BTC read
// 0.00100, which as a fraction would be 876% APR against ~11% on every other venue. Verified from the
// funding accumulators rather than assumed: across two summaries 204s apart on 2026-09-14, BTC's
// `longFundingValue` rose by 1.0074e-5 x oracle price per hour, and `fundingRate` averaged 1.0070e-3
// (i.e. 1.0070e-5 as a fraction). So `rate = fundingRate / 100` over 1 hour.
//
// FUNDING -- the sign. Positive means longs pay, as on every other venue. `fundingRateVelocity` had
// the sign of (long OI - short OI) on 44 of 44 live markets with any skew: the rate climbs while longs
// outnumber shorts, which only makes sense if longs pay a positive rate. BTC at +0.0010%/h (8.8% APR)
// matched Extended +11.4%, Arcus +10.95% and Variational +9.1% the same afternoon.
//
// FUNDING -- long and short values. `longFundingValue` and `shortFundingValue` are NOT rates. The spec
// defines each as the "reference value of funding accrued by one unit of exposure; there is one
// funding value per market and per direction, with short v long funding values differing possibly due
// to Auto-Deleveraging (ADL)". They are cumulative indices, so neither is stored and they are never
// averaged. They do say something the single rate does not: over the same 204s, BTC's two values moved
// almost together (1.007e-5 vs 0.999e-5 per $/h) but SOL's long value rose 1.97e-5 against the short
// value's 1.07e-5, and LINK's 2.90e-5 against 0.90e-5. Where they differ, shorts are credited less than
// longs are charged. `fundingRate` is the one number Reya publishes for the market and is what every
// other venue reports, so it is the rate; that shorts may receive less is a Reya-specific haircut this
// row cannot carry.
//
// INTERVAL: none. Both accumulators moved in proportion to elapsed time between samples minutes apart,
// so funding accrues continuously, like Paradex: `intervalHours` and `nextFundingAt` are null, and the
// rate is `predicted` since it drifts with `fundingRateVelocity`. No history endpoint exists.
//
// UNITS: `oiQty` is base units ("lots"; BTC 39.36 x 77,071 = $3.03M), `volume24h` is "24-hour trading
// volume in USD" (BTC $91.2M, 30x its OI: Reya's AMM pool is the counterparty to every trade, so
// turnover runs high). Mark is the oracle price: "used both as the peg price for prices on Reya, as well as
// Mark Prices" (https://docs.reya.xyz/llms-full.txt, `Price.oraclePrice`). `throttledPoolPrice` is the
// AMM's zero-size quote, not the mark.
//
// TRADABILITY: a market is live when `marketDefinitions` lists it. On 2026-09-14 the summary had 75
// rows and definitions 52; the 23 missing (MKR, DOT, TON, FTMUSD, ...) had zero volume and near-zero
// OI. Of the 52, 32 carried `oiCap` "0", which the spec defines only as "maximum one-sided open
// interest in units" without saying what zero means; they are kept, not guessed at.
//
// QUOTE: RUSD. "All settlement amounts on Reya Network are denominated in rUSD, which is a wrapped
// version of USDC" (https://docs.reya.xyz/native-stablecoin/srusd.md). `RUSD` is how
// `/v2/assetDefinitions` spells it, and it is the quote inside every perp symbol.
//
// BASE: every symbol defeats the parser -- `BTCRUSDPERP` has no separator, so it parses whole. Reya
// declares no base field; its symbols follow the grammar the spec's examples show (`BTCRUSDPERP` for
// perps, `WETHRUSD` for spot, and `/v2/assetDefinitions` pairs each asset with `<asset>RUSD`). The part
// before `RUSDPERP` is that declared base, and it goes through the parser only so `kPEPE` reads as PEPE
// x1000. Checked on all 75 symbols: every one ends in `RUSDPERP`, and `SRUSDPERP` is Sonic (S).
package reya

import (
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	VenueID = "reya"
	API     = "https://api.reya.xyz/v2"

	perpSuffix = "RUSDPERP"
	quote      = "RUSD"
)

type MarketSummary struct {
	Symbol     string       `json:"symbol"`
	UpdatedAt  adapters.Num `json:"updatedAt"`
	OiQty      adapters.Num `json:"oiQty"`
	LongOiQty  adapters.Num `json:"longOiQty"`
	ShortOiQty adapters.Num `json:"shortOiQty"`
	// FundingRate is hourly, in percent.
	FundingRate adapters.Num `json:"fundingRate"`
	// LongFundingValue is cumulative funding per unit of long exposure -- not a rate.
	LongFundingValue adapters.Num `json:"longFundingValue"`
	// ShortFundingValue is cumulative funding per unit of short exposure -- not a rate.
	ShortFundingValue    adapters.Num `json:"shortFundingValue"`
	FundingRateVelocity  adapters.Num `json:"fundingRateVelocity"`
	Volume24h            adapters.Num `json:"volume24h"`
	ThrottledOraclePrice adapters.Num `json:"throttledOraclePrice"`
	ThrottledPoolPrice   adapters.Num `json:"throttledPoolPrice"`
}

type MarketDefinition struct {
	Symbol      string       `json:"symbol"`
	MaxLeverage adapters.Num `json:"maxLeverage"`
	OiCap       adapters.Num `json:"oiCap"`
}

// DeclaredBase is the base and contract multiplier a Reya perp symbol declares.
type DeclaredBase struct {
	Base       string
	Multiplier float64
}

// PerpBase reads the base and contract multiplier off a Reya perp symbol, or reports false if the
// symbol is not one.
func PerpBase(symbol string) (DeclaredBase, bool) {
	if !strings.HasSuffix(symbol, perpSuffix) || len(symbol) <= len(perpSuffix) {
		return DeclaredBase{}, false
	}
	parsed := core.ParseVenueSymbol(symbol[:len(symbol)-len(perpSuffix)])
	return DeclaredBase{Base: parsed.Base, Multiplier: parsed.Multiplier}, true
}

// HourlyRate is Reya's percent-per-hour `fundingRate` as the fraction-per-hour core stores.
func HourlyRate(fundingRate adapters.Num) *float64 {
	if !fundingRate.OK {
		return nil
	}
	rate := fundingRate.Val / 100
	return &rate
}

// ParseSnapshots joins the summary rows with the market definitions that say which of them are live.
func ParseSnapshots(summaries []MarketSummary, definitions []MarketDefinition, now int64) []core.FundingSnapshot {
	defined := make(map[string]MarketDefinition, len(definitions))
	for _, d := range definitions {
		defined[d.Symbol] = d
	}

	snapshots := make([]core.FundingSnapshot, 0, len(summaries))
	for _, row := range summaries {
		definition, isDefined := defined[row.Symbol]
		declared, isPerp := PerpBase(row.Symbol)
		rate := HourlyRate(row.FundingRate)
		if !isDefined || !isPerp || rate == nil {
			continue
		}

		oracle := row.ThrottledOraclePrice
		oi := row.OiQty
		basisHours := 1.0
		snapshots = append(snapshots, core.FundingSnapshot{
			// Reya declares no class; every market it lists is crypto (PAXG is the gold token).
			MarketRef: adapters.MarketRefFor(VenueID, row.Symbol, adapters.Overrides{
				Base:       &declared.Base,
				Multiplier: &declared.Multiplier,
				Quote:      quotePtr(),
				HasQuote:   true,
			}),
			ObservedAt:      now,
			Rate:            *rate,
			BasisHours:      basisHours,
			IntervalHours:   nil,
			NextFundingAt:   nil,
			Kind:            core.KindPredicted,
			MarkPrice:       oracle.Ptr(),
			IndexPrice:      oracle.Ptr(),
			OpenInterestUSD: adapters.Mul(oi.Ptr(), oracle.Ptr()),
			Volume24hUSD:    row.Volume24h.Ptr(),
			MaxLeverage:     definition.MaxLeverage.Ptr(),
		})
	}
	return snapshots
}

func quotePtr() *string {
	q := quote
	return &q
}
