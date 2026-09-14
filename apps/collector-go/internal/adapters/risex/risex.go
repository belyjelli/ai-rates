// Package risex parses RISEx (RiseX), on RISE Chain.
//
// Ported from packages/adapters/src/venues/risex.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/risex) and the same expected values as risex.test.ts, so the Go
// and TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: one per cycle, `GET /v1/markets`, every market with funding, prices, OI and volume
// inline (the server caches it for 5 minutes; `cached_at` moved between reads 5 minutes apart). The
// limit is "REST: 500 requests/10s" per IP (https://developer.rise.trade/reference/general-information),
// so 100ms spacing is far inside it.
//
// NANOSECONDS: "All time and timestamp related fields are in nanoseconds unless explicitly defined
// otherwise" (same page). `funding_interval` "3600000000000" is one hour; `next_funding_time`
// "1789340400000000000" is 2026-09-13T23:00:00Z. Both exceed 2^53, which is why the TypeScript side
// converts them through BigInt and this one parses the decimal digits into an int64 rather than
// through a float. Num would silently round them: it decodes to float64, whose integers stop being
// exact at 9.0e15, and these stamps are 1.8e18.
//
// FUNDING: hourly, as a fraction, positive means longs pay. "Funding is paid every hour, and
// computed on an 8-hour rate", F = clamp((P + interest) / 8, +/-4%)
// (https://docs.risechain.com/docs/risex/trading/funding). `current_funding_rate` is that hourly F,
// and `funding_rate_8h` is documented as "current_funding_rate x 8" (checked: BTC
// 0.000004719244490803 x 8 = 0.000037753955926424). `predicted_funding_rate` is "Deprecated" and
// read "0" on all 32 markets. The quiet-market floor is 0.0000125 per hour (ONDO), the 0.01%/8h
// interest leg.
//
// KIND: `current_funding_rate` is the LAST SETTLED rate, not an estimate, so snapshots are settled.
// Measured 2026-09-13: at 22:28 and 22:33 BTC read 0.000004719244490803 in both, AERO and SNDK were
// likewise unchanged, and that is exactly the `funding_rate` of the 22:00 settlement record in
// `/v1/markets/id/1/funding-rate-history` (period 21:00-22:00, `end_time` 22:00). Polled every
// minute to the hour, it still read 0.000004719244490803 at 22:59:33 (SNDK 0.000290564882876973);
// at 23:00:30 BTC read 0.000018317170082382 and SNDK -0.000195857364862654, and at 23:02 the
// history's new 23:00 records held exactly those two values while `next_funding_time` had advanced
// to 00:00. The rate therefore changes only at settlement and always equals the latest record. It is
// also returned as a settled event at `next_funding_time - funding_interval`, which is that record's
// `end_time` exactly. Cross-checked against Hyperliquid the same minute: BTC 0.0000047/h (4.1% APR)
// against 0.0000116/h, ETH 0.0000167/h against 0.0000125/h. A factor of 8 would put ETH at 117% APR.
//
// UNITS, checked live: `open_interest` is base units (BTC 145.39 x mark 76,794 = $11.2M; ETH 2,456.0
// x 2,479.6 = $6.1M), so OI USD = OI x mark. `quote_volume_24h` is USDC (BTC $16.7M). `mark_price`
// and `index_price` are both "from oracle" and both published.
//
// TRADABILITY: `active` ("when false the market is disabled off-chain ... its orders rejected"),
// `config.unlocked`, and neither `reduce_only` nor `post_only`. On 2026-09-13, 30 of 32 qualified:
// ONDO (inactive, post-only) and a deprecated duplicate `DOGE/USDC [deprecated-1779958099]` are not
// collected.
//
// CLASS, declared by `category`: crypto 15, stocks 7, commodity 4 (XAU, XAG, CL, BZ), index_etf 4
// among the 30 live markets (the deprecated DOGE row has ""). `stocks` is equity; `index_etf` (DRAM,
// QQQ, SPY, KORU) is passed as index for core's table, which files those four ETFs as equity, so
// snapshots carry crypto 15, equity 11, commodity 4. An unknown value is tradfi of an unknown kind,
// placed by ClassifyNonCrypto; "" is crypto.
//
// QUOTE: USDC, the declared `quote_asset_symbol` on every market (`config.quote` is the USDC token
// address, "usually USDC" per the schema).
//
// BASE: the parser reads `config.name` (`BTC/USDC`) and agrees with every live market's pair. There
// is no bare declared base: `base_asset_symbol` and `underlying` both hold the pair ("BTC/USDC"),
// despite the schema's example of "BTC". XAU and CL are already canonical; SNDK, MSTR and friends
// parse as named.
package risex

import (
	"errors"
	"sort"
	"strconv"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "risex"

// APIBase is the venue's REST root, exported so the tests can pin the exact URLs a cycle asks for.
const APIBase = "https://api.rise.trade/v1"

const (
	nsPerMs = 1_000_000
	hourMs  = 3_600_000
	// FundingBasisHours: the rate is quoted over one hour, which is also the settlement interval.
	FundingBasisHours = 1.0
	// quoteAsset is `quote_asset_symbol` on every market; `config.quote` is the USDC token address.
	quoteAsset = "USDC"
)

// ErrUnexpectedMarkets and ErrUnexpectedHistory mirror the TypeScript adapter's throws when
// `data.markets` or `data.records` is not an array. A response that lost its payload has to fail the
// venue's cycle rather than read as a venue with nothing listed and no funding ever settled.
var (
	ErrUnexpectedMarkets = errors.New("risex: unexpected markets response")
	ErrUnexpectedHistory = errors.New("risex: unexpected funding-rate-history")
)

type MarketConfig struct {
	Name        string       `json:"name"`
	MaxLeverage adapters.Num `json:"max_leverage"`
	// Unlocked is a POINTER because an absent flag is not a locked market: tradability reads
	// `unlocked !== false`, so only an explicit false disqualifies and a missing field passes.
	Unlocked *bool `json:"unlocked"`
}

type Market struct {
	MarketID         string       `json:"market_id"`
	Config           MarketConfig `json:"config"`
	QuoteAssetSymbol string       `json:"quote_asset_symbol"`
	Category         string       `json:"category"`
	MarkPrice        adapters.Num `json:"mark_price"`
	IndexPrice       adapters.Num `json:"index_price"`
	// OpenInterest is BASE UNITS, so the USD figure needs the mark.
	OpenInterest   adapters.Num `json:"open_interest"`
	QuoteVolume24h adapters.Num `json:"quote_volume_24h"`
	// FundingInterval is NANOSECONDS, as a decimal string: "3600000000000" is one hour.
	FundingInterval string `json:"funding_interval"`
	// NextFundingTime is unix NANOSECONDS, as a decimal string, past 2^53.
	NextFundingTime string `json:"next_funding_time"`
	// CurrentFundingRate is the LAST SETTLED hourly rate, not an estimate.
	CurrentFundingRate adapters.Num `json:"current_funding_rate"`
	// FundingRate8h is documented as CurrentFundingRate x 8, so it is the same reading on a
	// different basis rather than a second one.
	FundingRate8h adapters.Num `json:"funding_rate_8h"`
	Active        bool         `json:"active"`
	PostOnly      bool         `json:"post_only"`
	ReduceOnly    bool         `json:"reduce_only"`
}

type MarketsData struct {
	// Markets is nil when the field is absent or null, and an empty non-nil slice for `[]`, which
	// is the distinction `Array.isArray` draws on the TypeScript side.
	Markets  []Market `json:"markets"`
	CachedAt string   `json:"cached_at"`
}

type MarketsResponse struct {
	Data MarketsData `json:"data"`
}

type FundingRecord struct {
	FundingRate adapters.Num `json:"funding_rate"`
	// StartTime is unix NANOSECONDS: the period's open.
	StartTime string `json:"start_time"`
	// EndTime is unix NANOSECONDS: the settlement itself.
	EndTime string `json:"end_time"`
}

type FundingHistoryData struct {
	MarketID    string          `json:"market_id"`
	Records     []FundingRecord `json:"records"`
	Page        int             `json:"page"`
	HasNextPage bool            `json:"has_next_page"`
}

type FundingHistoryResponse struct {
	Data FundingHistoryData `json:"data"`
}

// NsToMs converts a decimal nanosecond string to whole milliseconds, or nil.
//
// Parsed as an integer rather than through a float: these stamps are ~1.8e18, and float64 integers
// stop being exact at 9.0e15, so decoding one as a number would move the settlement by microseconds
// to milliseconds. int64 holds nanoseconds to the year 2262. Zero and negative are absent, as they
// are on the TypeScript side, where the venue uses "0" for "no next funding" rather than omitting
// the field; an unparseable value is absent too, which is what BigInt's throw becomes there.
func NsToMs(value string) *int64 {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	ns, err := strconv.ParseInt(trimmed, 10, 64)
	if err != nil || ns <= 0 {
		return nil
	}
	ms := ns / nsPerMs
	return &ms
}

// AssetClassFor is the class RiseX declares in `category`: crypto, stocks, commodity or index_etf.
//
// index_etf is passed on as index for core's table, which files QQQ, SPY and friends as equity —
// five venues to two. An unknown value still says not-crypto, so the base tables settle which class;
// "" is crypto, since that is what the venue leaves on rows it declares nothing for.
func AssetClassFor(category, base string) core.AssetClass {
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "", "crypto":
		return core.ClassCrypto
	case "stocks":
		return core.ClassEquity
	case "commodity":
		return core.ClassCommodity
	case "index_etf":
		return core.ClassIndex
	default:
		return core.ClassifyNonCrypto(base)
	}
}

// IsTradable is `active`, `config.unlocked` and neither post-only nor reduce-only.
//
// Only an explicit `unlocked: false` disqualifies, while `active` must be explicitly true: that is
// the asymmetry the TypeScript draws with `active === true && config?.unlocked !== false`, and it is
// what keeps a market the venue simply did not flag from being dropped.
func IsTradable(market Market) bool {
	unlocked := market.Config.Unlocked == nil || *market.Config.Unlocked
	return market.Active && unlocked && !market.PostOnly && !market.ReduceOnly
}

// refFor identifies a market from `config.name`, with USDC as the declared quote and the class the
// venue declares in `category`.
//
// Parsed once for the base, then rebuilt with the overrides, exactly as the TypeScript does: the
// class table is keyed on the canonical base, which only ParseVenueSymbol produces.
func refFor(market Market) core.MarketRef {
	base := adapters.MarketRefFor(VenueID, market.Config.Name, adapters.Overrides{}).Base
	class := AssetClassFor(market.Category, base)
	quote := quoteAsset
	return adapters.MarketRefFor(VenueID, market.Config.Name, adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseMarkets normalises one cycle's /markets response.
//
// Every snapshot is settled, and each one also yields the settlement it came from: the rate changes
// only at the hour and always equals the newest funding-rate-history record, whose `end_time` is
// `next_funding_time - funding_interval` exactly.
func ParseMarkets(body MarketsResponse, now int64) core.SnapshotBatch {
	markets := body.Data.Markets
	snapshots := make([]core.FundingSnapshot, 0, len(markets))
	settled := make([]core.FundingEvent, 0, len(markets))

	for _, market := range markets {
		rate := market.CurrentFundingRate
		if market.Config.Name == "" || !IsTradable(market) || !rate.OK {
			continue
		}

		ref := refFor(market)
		intervalMs := NsToMs(market.FundingInterval)
		nextFundingAt := NsToMs(market.NextFundingTime)
		markPrice := market.MarkPrice.Ptr()

		var intervalHours *float64
		if intervalMs != nil {
			hours := float64(*intervalMs) / hourMs
			intervalHours = &hours
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          rate.Val,
			BasisHours:    FundingBasisHours,
			IntervalHours: intervalHours,
			NextFundingAt: nextFundingAt,
			Kind:          core.KindSettled,
			MarkPrice:     markPrice,
			IndexPrice:    market.IndexPrice.Ptr(),
			// open_interest is BASE UNITS, so the USD figure is OI x mark. Reading it as USD
			// would price BTC's book at 145 dollars.
			OpenInterestUSD: adapters.Mul(market.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    market.QuoteVolume24h.Ptr(),
			MaxLeverage:     market.Config.MaxLeverage.Ptr(),
		})

		if nextFundingAt != nil && intervalMs != nil {
			settled = append(settled, core.FundingEvent{
				MarketRef:  ref,
				SettledAt:  *nextFundingAt - *intervalMs,
				Rate:       rate.Val,
				BasisHours: FundingBasisHours,
				MarkPrice:  nil,
			})
		}
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}
}

// ParseFundingHistory returns settlements within [fromMs, toMs], oldest first, stamped at each
// period's `end_time`.
//
// One event per settlement timestamp, last occurrence winning, as the TypeScript Map does. The
// output is then sorted by that same timestamp, so the map's insertion order never reaches the
// result and Go's map iteration order cannot reshuffle it.
func ParseFundingHistory(records []FundingRecord, market Market, fromMs, toMs int64) []core.FundingEvent {
	ref := refFor(market)
	bySettlement := make(map[int64]core.FundingEvent, len(records))

	for _, record := range records {
		settledAt := NsToMs(record.EndTime)
		rate := record.FundingRate
		if settledAt == nil || !rate.OK || *settledAt < fromMs || *settledAt > toMs {
			continue
		}
		bySettlement[*settledAt] = core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  *settledAt,
			Rate:       rate.Val,
			BasisHours: FundingBasisHours,
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
