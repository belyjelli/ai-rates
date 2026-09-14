// Package aevo parses Aevo's perpetual market data.
//
// Ported from packages/adapters/src/venues/aevo.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/aevo) and the same expected values as aevo.test.ts, so the Go and
// TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: two per cycle, both bulk. `GET /markets?instrument_type=PERPETUAL` (~40 KB: class,
// activity, mark and index for every perp) and `GET /coingecko-statistics` (funding, open interest,
// 24h volume and next funding time for every perp, active or not). The catalog's `/funding` is per
// instrument, and it is not needed: on 2026-09-13 the statistics `funding_rate` equalled `/funding`
// on BTC, ETH, SOL, XAU and USDJPY, and H100 differed by 1e-6 between two calls a second apart.
// The markets list is fetched every cycle rather than hourly because it carries the only mark price.
// Aevo documents that public endpoints are limited per IP with a 429 and `X-RETRY-AFTER`
// (https://api-docs.aevo.xyz/reference/rate-limits-1) but publishes no number; 250ms spacing.
//
// FUNDING: `funding_rate` is a fraction for ONE hour, positive = longs pay, `predicted`. Aevo's
// funding page (https://docs.aevo.xyz/aevo-products/aevo-exchange/technical-architecture/perpetual-futures-funding-rate)
// says "The funding payments are made every 1 hour" and computes "Capped 1H Funding Rate = Capped
// 8H Funding Rate / Funding Interval"; `/funding` is "the current funding rate" for `next_epoch`.
// The per-hour reading checks out live: the resting interest component is 0.01%/8h, i.e. 0.0000125/h,
// and MSTR, USDJPY and MELANIA sat at 0.000013 while BTC read 0.000008 against Hyperliquid's
// 0.0000114/h. Hourly settlements are 3,600s apart in `/funding-history`, and the published value is
// what settles: BTC and ETH both read 0.000008 at 22:59 UTC on 2026-09-13 and both settled 0.000008
// at 23:00.
//
// UNITS: `open_interest` is base units whatever the spec says ("in USDC terms"): BTC 26.2 equals
// `/instrument/BTC-PERP`'s `total_oi` of 26.2 contracts, which is $2.0M at the mark and would be $26
// as dollars; 1000PEPE's 28,270,400 is contracts too. `target_volume` is USD: BTC 1,889,388 against
// `/instrument`'s `daily_volume` 1,894,302 (24.58 contracts x ~77k). `next_funding_rate_timestamp`
// is epoch seconds (the statistics call), where `/funding` and history use nanoseconds.
//
// TRADABILITY: `instrument_type` PERPETUAL and `is_active`. On 2026-09-13 `/markets` listed 99 active
// perps (and 2,522 options); the statistics call listed 239 perps, 140 of them delisted and missing
// `next_funding_rate_timestamp`. Only the 99 are emitted.
//
// CLASS: `market_type` as declared -- crypto 54, equity 32, commodity 5, etf 4, pre_ipo 2, fx 1,
// compute 1. ETFs and pre-IPO shares are equity (MarketRefFor then files index bases as index);
// `compute` (H100, GPU rental) and any future non-crypto value go to ClassifyNonCrypto, and an
// unknown value on a market not flagged `is_rwa` stays crypto.
//
// QUOTE: `quote_asset`, USDC on every perp. BASE: the parser reads every `<base>-PERP` symbol as the
// declared `underlying_asset` (1000PEPE as PEPE x1000, as elsewhere) but finds no quote in it, so the
// quote is passed.
package aevo

import (
	"math/big"
	"regexp"
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "aevo"

// fundingHours is the basis and the settlement interval both: Aevo pays hourly and publishes the
// hourly rate, so the two are the same number rather than an 8h rate over an hourly settlement.
const fundingHours = 1.0

// nsPerMs converts Aevo's nanosecond epochs. Every timestamp on `/funding` and `/funding-history` is
// in NANOSECONDS, and reading one as milliseconds would place a 2026 settlement 56,000 years from
// now while looking entirely plausible.
const nsPerMs int64 = 1_000_000

// integerText is the guard on a nanosecond epoch: Aevo sends it as a decimal string, and anything
// that is not one (an exponent form, a float) is not a timestamp we can convert exactly.
var integerText = regexp.MustCompile(`^\d+$`)

// Market is one row of /markets?instrument_type=PERPETUAL.
//
// IsActive and IsRwa are plain bools rather than pointers because both are flags, not measurements:
// an absent flag reads as false on each side, which is what the TypeScript `!market.is_active` and
// `isRwa ? ... : "crypto"` already do.
type Market struct {
	InstrumentName string `json:"instrument_name"`
	InstrumentType string `json:"instrument_type"`
	// UnderlyingAsset is what the venue declares the base to be. Carried because it is part of the
	// wire shape and because the history fallback below fills it in, but the parser reads the base
	// off the symbol: on this venue the two agree on every perp.
	UnderlyingAsset string       `json:"underlying_asset"`
	QuoteAsset      string       `json:"quote_asset"`
	MarkPrice       adapters.Num `json:"mark_price"`
	IndexPrice      adapters.Num `json:"index_price"`
	IsActive        bool         `json:"is_active"`
	MaxLeverage     adapters.Num `json:"max_leverage"`
	IsRwa           bool         `json:"is_rwa"`
	MarketType      string       `json:"market_type"`
}

// Statistic is one row of /coingecko-statistics, which answers for delisted perps as well as live
// ones. See TRADABILITY: only markets the /markets call still lists are emitted.
type Statistic struct {
	TickerID                 string       `json:"ticker_id"`
	FundingRate              adapters.Num `json:"funding_rate"`
	OpenInterest             adapters.Num `json:"open_interest"`
	IndexPrice               adapters.Num `json:"index_price"`
	TargetVolume             adapters.Num `json:"target_volume"`
	NextFundingRateTimestamp adapters.Num `json:"next_funding_rate_timestamp"`
}

// FundingRow is `[instrument_name, funding time in ns, rate, mark price]`, newest first.
type FundingRow [4]string

// FundingHistoryResponse wraps the history rows.
type FundingHistoryResponse struct {
	FundingHistory []FundingRow `json:"funding_history"`
}

// AssetClassFor is the class Aevo declares for a perp.
//
// `market_type` as declared -- crypto, equity, etf, pre_ipo, commodity, fx, index -- with ETFs and
// pre-IPO shares filed as equity. `compute` (H100, GPU rental) and any future non-crypto value have
// no class of their own, so a market flagged `is_rwa` falls to the base tables; an unknown value on a
// market NOT flagged is crypto, which is what an undeclared market is everywhere else.
func AssetClassFor(marketType string, isRwa bool, base string) core.AssetClass {
	switch strings.ToLower(strings.TrimSpace(marketType)) {
	case "crypto":
		return core.ClassCrypto
	case "equity", "etf", "pre_ipo":
		return core.ClassEquity
	case "commodity":
		return core.ClassCommodity
	case "fx":
		return core.ClassFX
	case "index":
		return core.ClassIndex
	default:
		if isRwa {
			return core.ClassifyNonCrypto(base)
		}
		return core.ClassCrypto
	}
}

// ref builds the market reference for one instrument: the base and multiplier come off the symbol,
// the quote and the class from what the venue declares.
func ref(market Market) core.MarketRef {
	parsed := adapters.MarketRefFor(VenueID, market.InstrumentName, adapters.Overrides{})
	class := AssetClassFor(market.MarketType, market.IsRwa, parsed.Base)
	quote := market.QuoteAsset
	return adapters.MarketRefFor(VenueID, market.InstrumentName, adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// NsToMs converts a nanosecond epoch string to milliseconds, exactly; absent if it isn't an integer.
//
// Exact, via big.Int rather than a float, because a float64 holds only 53 bits and a nanosecond
// epoch needs 61: parsing 1789336800123456789 as a float and dividing would round the millisecond
// away. The division truncates, as the TypeScript BigInt division does.
func NsToMs(ns string) (int64, bool) {
	if !integerText.MatchString(ns) {
		return 0, false
	}
	value, ok := new(big.Int).SetString(ns, 10)
	if !ok {
		return 0, false
	}
	ms := new(big.Int).Quo(value, big.NewInt(nsPerMs))
	// A value past the int64 range is not a timestamp the domain types can carry.
	if !ms.IsInt64() {
		return 0, false
	}
	return ms.Int64(), true
}

// venueNum decodes a number that arrived as text inside a history tuple, through the shared Num
// decoder rather than a second parser of our own, so an empty or malformed field reads as ABSENT
// exactly as it does anywhere else — and never as a zero rate, which is a legitimate reading.
func venueNum(raw string) adapters.Num {
	var n adapters.Num
	// UnmarshalJSON reports no error: a field it cannot read is absent, not a failed cycle.
	_ = n.UnmarshalJSON([]byte(`"` + raw + `"`))
	return n
}

// nsValue reads a nanosecond epoch as int64, for the history pager's own arithmetic. Nanoseconds fit
// int64 until the year 2262, so anything that does not fit is not a settlement time.
func nsValue(ns string) (int64, bool) {
	if !integerText.MatchString(ns) {
		return 0, false
	}
	value, ok := new(big.Int).SetString(ns, 10)
	if !ok || !value.IsInt64() {
		return 0, false
	}
	return value.Int64(), true
}

// ParseSnapshots joins the markets list to the statistics call, keeping the markets list's order.
//
// A market is emitted only when it is a live perp that the statistics call quotes a funding rate
// for: the statistics endpoint answers for delisted perps too, and /markets is what says which of
// them still trade.
func ParseSnapshots(markets []Market, statistics []Statistic, now int64) []core.FundingSnapshot {
	stats := make(map[string]Statistic, len(statistics))
	for _, s := range statistics {
		stats[s.TickerID] = s
	}

	snapshots := make([]core.FundingSnapshot, 0, len(markets))
	for _, market := range markets {
		stat, ok := stats[market.InstrumentName]
		if market.InstrumentType != "PERPETUAL" || !market.IsActive || !ok || !stat.FundingRate.OK {
			continue
		}

		markPrice := market.MarkPrice.Ptr()
		// The statistics call states this one in epoch SECONDS, unlike /funding and the history rows.
		var nextFundingAt *int64
		if stat.NextFundingRateTimestamp.OK && stat.NextFundingRateTimestamp.Val > 0 {
			ms := int64(stat.NextFundingRateTimestamp.Val) * 1000
			nextFundingAt = &ms
		}
		indexPrice := market.IndexPrice.Ptr()
		if indexPrice == nil {
			indexPrice = stat.IndexPrice.Ptr()
		}
		basisHours, intervalHours := fundingHours, fundingHours

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref(market),
			ObservedAt:    now,
			Rate:          stat.FundingRate.Val,
			BasisHours:    basisHours,
			IntervalHours: &intervalHours,
			NextFundingAt: nextFundingAt,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    indexPrice,
			// Open interest is base units, priced at the venue's own mark. See UNITS.
			OpenInterestUSD: adapters.Mul(stat.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    stat.TargetVolume.Ptr(),
			MaxLeverage:     market.MaxLeverage.Ptr(),
		})
	}
	return snapshots
}

// ParseFunding returns the hourly settlements within [fromMs, toMs], oldest first.
//
// One event per settlement time: the pager walks backwards a page at a time and a row can repeat
// across a page boundary.
func ParseFunding(rows []FundingRow, market Market, fromMs, toMs int64) []core.FundingEvent {
	base := ref(market)
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		settledAt, ok := NsToMs(row[1])
		rate := venueNum(row[2])
		if !ok || !rate.OK || settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  settledAt,
			Rate:       rate.Val,
			BasisHours: fundingHours,
			MarkPrice:  venueNum(row[3]).Ptr(),
		}
	}

	events := make([]core.FundingEvent, 0, len(bySettlement))
	for _, event := range bySettlement {
		events = append(events, event)
	}
	sort.Slice(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
