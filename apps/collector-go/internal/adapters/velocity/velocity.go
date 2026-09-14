// Package velocity parses Velocity's Solana perpetuals (formerly Drift, rebranded 2026-07-01).
//
// Ported from packages/adapters/src/venues/velocity.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/velocity) and the same expected values as velocity.test.ts, so the
// Go and TypeScript parsers cannot drift apart while both are collecting.
//
// LIVE, BUT SMALL: on 2026-09-13 the relaunch listed 4 perps (SOL, BTC, ETH, HYPE), all `active`,
// funding updated on the hour (`fundingRateUpdateTs` 22:01:00Z read at 22:31Z), oracle prices
// current, but 24h volume of $354 on BTC, $135 on ETH and $0 on HYPE, with BTC OI of 0.335 BTC.
// Worth collecting because it is live and funds hourly; not yet a venue whose rates move a pool.
//
// REQUESTS: one per cycle, `GET /stats/markets` (~5 KB, spot and perp markets with stats inline).
// The Data API (https://data.velocity.exchange/playground, spec at /openapi.json) documents no rate
// limit, so this keeps to one request a second.
//
// FUNDING: hourly. https://docs.velocity.exchange/protocol/trading/funding-rates -- "once an hour,
// whichever side is holding the contract away from the oracle pays the other side", with
// `hourly_rate = (1/24) * (market_twap - oracle_twap) / oracle_twap` plus a 10.95%-APR floor. The
// update is lazy ("updates when someone opens or closes a position, and independently when enough
// time has passed"), so NextFundingAt is the next top of the hour, the earliest it can happen.
//
// `stats/markets` `fundingRate` is a PERCENT per hour, and it is the live estimate, not the last
// settlement. Verified 2026-09-13:
//   - Units: the mean of the last 24 BTC-PERP records' `fundingRateLong / oraclePriceTwap` is
//     0.0000790517 as a fraction, and the same response's `fundingRate24h` reads 0.007905 --
//     percent. `/stats/fundingRates` gives 0.007905172 for the same 24h window.
//   - Live: two reads at 22:27Z and 22:31Z gave BTC 0.008175 then 0.008181 with
//     `fundingRateUpdateTs` unchanged at 22:01Z, whose record was 6.399237833 / 77333.73 =
//     0.008275%. So `predicted`.
//   - Sign: records' `fundingRateLong` is "Funding paid by long positions" (Data API glossary,
//     https://docs.velocity.exchange/developers/data-api/glossary) and was +6.399 with the mark TWAP
//     above the oracle TWAP. `stats` gave `long` -0.008181 and `short` +0.008181 at the same time,
//     so `stats` states each side's P&L: longs paying shows as a negative `long`. The rate is
//     therefore `-long / 100`, what longs pay, which also stays right if the AMM caps one side
//     asymmetrically.
//
// Cross-check against Hyperliquid, same minute: BTC 0.0000818/h here (71.7% APR) against HL
// 0.0000117/h (10.2%), a factor of 7 that is premium, not basis -- Velocity's BTC mark 76,908.6 sat
// 0.20% over its oracle 76,753.5, and 0.20% / 24 = 0.0084%/h is what the formula charges. ETH:
// 0.0000891/h (mark 0.16% over oracle) against HL 0.0000125/h. A basis error would be 24x.
//
// UNITS, checked live: `openInterest.long` / `.short` are base units per side (BTC 0.335 long,
// -0.0206 short); the AMM holds the difference (the history's `baseAssetAmountWithAmm` 0.3144 =
// 0.335 - 0.0206), so OI is the larger side times mark: $25.8k on BTC. `quoteVolume` is USDT over
// 24h (BTC `baseVolume` 0.0046 x ~77,060 = 354.47, as reported).
//
// TRADABILITY: `marketType` perp, `status` active and `uiStatus` not hidden. The delisting doc
// (https://docs.velocity.exchange/protocol/risk-and-safety/delisting-process) puts a closing market
// in ReduceOnly then Settlement, and new positions are refused from the first of those. On
// 2026-09-13: 4 perps, all active and visible; the other 4 rows are spot markets (USDT, SOL, wBTC,
// wETH).
//
// QUOTE: USDT, which the API also declares as `quoteAsset`. "On Velocity mainnet-beta it is USDT ...
// deposits, withdrawals, ATA derivation, collateral, and settlement all reference the USDT mint"
// (https://docs.velocity.exchange/developers/migrate-from-drift). Drift settled in USDC.
//
// CLASS: the API declares none and all four markets are crypto, so crypto.
//
// BASE: the parser's reading of `symbol` (`BTC-PERP` -> BTC) matched `baseAsset` on all 4 markets.
package velocity

import (
	"errors"
	"math"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "velocity"

const (
	hourMs = 3_600_000
	// FundingHours: Velocity charges funding every hour and quotes an hourly rate.
	FundingHours = 1.0
	// quote is the settlement currency for every market; the API declares it as `quoteAsset` too.
	quote = "USDT"
)

// ErrUnexpectedMarkets and ErrUnexpectedHistory mirror the TypeScript adapter's throws when
// `markets` or `records` is missing or is not an array. A response that lost its payload has to fail
// the venue's cycle rather than read as a venue with nothing listed and no funding ever settled.
var (
	ErrUnexpectedMarkets = errors.New("velocity: unexpected stats/markets response")
	ErrUnexpectedHistory = errors.New("velocity: unexpected fundingRates response")
)

// Leverage is the `limits.leverage` object. Absent limits leave the Nums absent, never zero, so a
// market that publishes no cap reports no maximum leverage rather than a cap of nothing.
type Leverage struct {
	Min adapters.Num `json:"min"`
	Max adapters.Num `json:"max"`
}

type Limits struct {
	Leverage Leverage `json:"leverage"`
}

// Sides is one figure per side of the book. Used for both `openInterest` (base units, `short`
// negative) and `fundingRate` (percent per hour, as each side's P&L).
type Sides struct {
	Long  adapters.Num `json:"long"`
	Short adapters.Num `json:"short"`
}

type Market struct {
	Symbol      string `json:"symbol"`
	MarketIndex int    `json:"marketIndex"`
	MarketType  string `json:"marketType"`
	Status      string `json:"status"`
	UIStatus    string `json:"uiStatus"`
	BaseAsset   string `json:"baseAsset"`
	QuoteAsset  string `json:"quoteAsset"`
	Limits      Limits `json:"limits"`

	OraclePrice adapters.Num `json:"oraclePrice"`
	MarkPrice   adapters.Num `json:"markPrice"`
	BaseVolume  adapters.Num `json:"baseVolume"`
	QuoteVolume adapters.Num `json:"quoteVolume"`
	// OpenInterest is base units per side; `short` is negative.
	OpenInterest Sides `json:"openInterest"`
	// FundingRate is PERCENT per hour, as each side's P&L: longs paying reads as a negative `long`.
	FundingRate         Sides `json:"fundingRate"`
	FundingRateUpdateTs int64 `json:"fundingRateUpdateTs"`
}

// MarketsResponse is the /stats/markets body. Markets is a pointer so that an absent or null
// `markets` is distinguishable from an empty one, which is what the TypeScript `!Array.isArray`
// guard turns into a thrown error.
type MarketsResponse struct {
	Success bool      `json:"success"`
	Markets *[]Market `json:"markets"`
}

type FundingRecord struct {
	// Ts is unix SECONDS of the on-chain update.
	Ts     adapters.Num `json:"ts"`
	Symbol string       `json:"symbol"`
	// FundingRate and the per-side figures are quote per base unit for the hour, not a fraction.
	FundingRate      adapters.Num `json:"fundingRate"`
	FundingRateLong  adapters.Num `json:"fundingRateLong"`
	FundingRateShort adapters.Num `json:"fundingRateShort"`
	OraclePriceTwap  adapters.Num `json:"oraclePriceTwap"`
	MarkPriceTwap    adapters.Num `json:"markPriceTwap"`
}

type FundingRatesMeta struct {
	// NextPage is a cursor, null on the last page.
	NextPage *string `json:"nextPage"`
}

// FundingRatesResponse is the /market/{symbol}/fundingRates body. Records is a pointer for the same
// reason MarketsResponse.Markets is: a missing array is a broken response, not an empty page.
type FundingRatesResponse struct {
	Success bool              `json:"success"`
	Records *[]FundingRecord  `json:"records"`
	Meta    *FundingRatesMeta `json:"meta"`
}

// ref builds the market reference. The quote is declared rather than parsed: `BTC-PERP` carries no
// quote at all, and every Velocity market settles in USDT.
func ref(venueSymbol string) core.MarketRef {
	q := quote
	return adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{Quote: &q, HasQuote: true})
}

// ParseMarkets normalises one /stats/markets response into snapshots, dropping the spot rows and
// anything that is closing.
func ParseMarkets(markets []Market, now int64) []core.FundingSnapshot {
	nextFundingAt := now/hourMs*hourMs + hourMs
	basisHours := FundingHours

	snapshots := make([]core.FundingSnapshot, 0, len(markets))
	for _, market := range markets {
		if market.MarketType != "perp" || market.Status != "active" || market.UIStatus == "hidden" {
			continue
		}
		longPercent := market.FundingRate.Long
		if !longPercent.OK {
			continue
		}

		markPrice := market.MarkPrice.Ptr()
		long := market.OpenInterest.Long
		short := market.OpenInterest.Short

		// The larger side in base units: the AMM holds the difference between them, so neither side
		// alone is the book. Absent stays absent — a market that publishes no open interest is not a
		// market with none.
		var openInterest *float64
		if long.OK || short.OK {
			largest := math.Max(math.Abs(long.Val), math.Abs(short.Val))
			openInterest = &largest
		}

		// `-0` would survive as a distinct value in a comparison; a flat market is plain zero.
		rate := 0.0
		if longPercent.Val != 0 {
			rate = -longPercent.Val / 100
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       ref(market.Symbol),
			ObservedAt:      now,
			Rate:            rate,
			BasisHours:      basisHours,
			IntervalHours:   &basisHours,
			NextFundingAt:   &nextFundingAt,
			Kind:            core.KindPredicted,
			MarkPrice:       markPrice,
			IndexPrice:      market.OraclePrice.Ptr(),
			OpenInterestUSD: adapters.Mul(openInterest, markPrice),
			Volume24hUSD:    market.QuoteVolume.Ptr(),
			MaxLeverage:     market.Limits.Leverage.Max.Ptr(),
		})
	}
	return snapshots
}

// ParseFundingRates returns hourly settlements within [fromMs, toMs], oldest first.
//
// A record's rate is quote per base unit, so the fraction is `fundingRateLong / oraclePriceTwap`,
// the docs' `(market_twap - oracle_twap) / oracle_twap` form -- checked above against
// `fundingRate24h`. `ts` is the lazy on-chain update (22:01:00Z, 21:00:59Z) and is kept as
// published.
func ParseFundingRates(records []FundingRecord, venueSymbol string, fromMs, toMs int64) []core.FundingEvent {
	base := ref(venueSymbol)

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(records))
	for _, record := range records {
		seconds := record.Ts
		perUnit := record.FundingRateLong
		oracleTwap := record.OraclePriceTwap
		if !seconds.OK || !perUnit.OK || !oracleTwap.OK || oracleTwap.Val <= 0 {
			continue
		}
		settledAt := int64(seconds.Val * 1000)
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  settledAt,
			Rate:       perUnit.Val / oracleTwap.Val,
			BasisHours: FundingHours,
			MarkPrice:  nil,
		}
	}

	settlements := make([]int64, 0, len(bySettlement))
	for settledAt := range bySettlement {
		settlements = append(settlements, settledAt)
	}
	sort.Slice(settlements, func(i, j int) bool { return settlements[i] < settlements[j] })

	events := make([]core.FundingEvent, 0, len(settlements))
	for _, settledAt := range settlements {
		events = append(events, bySettlement[settledAt])
	}
	return events
}
