// Package phoenix parses Phoenix perpetuals (Ellipsis Labs, Solana), public REST at
// https://perp-api.phoenix.trade.
//
// Ported from packages/adapters/src/venues/phoenix.ts. Measured from that machine on 2026-09-13
// 22:29–23:01 UTC, against the OpenAPI document at
// https://docs.phoenix.trade/openapi/phoenix-public-api.json and https://docs.phoenix.trade/llms-full.txt.
//
// WHAT IS COLLECTABLE OVER REST. `/v1/view/exchange/markets` (174 KB, 82 markets) lists markets with
// open interest but no rate and no price. There is no bulk ticker: mark price, candles and stats are
// per symbol, and live marks are otherwise WebSocket-only. Funding comes from
// `/v1/funding/overview`, which serves every market's hourly series in one call: the full default
// week is 1.7 MB, but `startTime`/`endTime` (milliseconds; seconds return an empty series) with
// `perMarketLimit=1` return only the newest point per market, 14 KB.
//
// REQUESTS per cycle: markets + overview, then up to VolumeRefreshBudget hourly-candle calls
// (5.7 KB each) for 24h volume, rotated so each market's volume is at most ~15 minutes old. No limit
// is published ("authenticated sessions receive higher API limits"; back off on 429). Twelve calls a
// second apart to one route never limited; five back-to-back calls returned `{"error":"rate_limited"}`
// on two of them. So requests are spaced 1s, and an `error` body is treated as a failure.
//
// FUNDING — what a point is. Each overview point is one hourly accrual, stamped at or just after the
// hour. Polled every minute from 22:34 to 23:00: the newest point stayed 22:00:01 (BTC 0.42 at
// 77,334) through 22:59:25, and at 23:00:26 a 23:00:00 point (BTC 0.46 at 76,736) had replaced it. It
// is therefore the SETTLED rate for the hour just ended, never an estimate: snapshots are
// core.KindSettled, and the same point is also returned as a settled event. Nothing on REST carries
// the current hour: `statsSnapshot.cumulativeFundingRate` did not move for the whole hour, then stepped
// at 23:00 by +46 on BTC (100x the 0.46 payment, i.e. cents per unit), so it repeats the overview.
//
// FUNDING — the scale. `rate = fundingAmountPerUnit / markPrice`, a fraction per hour:
//   - the schema defines `fundingAmountPerUnit` as "funding amount per base unit in quote units" and
//     `markPrice` as "quote units per base unit", so their ratio is the hour's fraction of notional;
//   - the independent `/v1/funding/{symbol}/rates` history reports `fundingRatePercentage` equal to
//     100x that ratio on every market checked (BTC 0.42 / 77,334 = 5.43e-6, rates 0.000543%; AAPL,
//     ADA and SPY the same);
//   - `fundingRate` on the overview is NOT usable, whatever its schema says ("rate for the interval as
//     a decimal"): it is 1e4x the ratio on BTC, ETH, GOLD and AAVE (tick size 100) and 100x on AAPL, ADA
//     and SPY (tick size 10). Read as a decimal, BTC would pay 5.4% an hour.
//
// Cross-check with Hyperliquid at 22:39 UTC: BTC 5.43e-6/h here vs 1.25e-5/h, ETH 1.83e-5/h vs
// 1.25e-5/h. A per-24h reading (x24) or a percent reading (x100) would be two orders of magnitude off.
//
// FUNDING — the interval. `fundingIntervalSeconds` is 3600 on all 82 markets; `fundingPeriodSeconds`
// (86400, or 28800 on seven) is the horizon the premium is spread over, which is why the catalog calls
// the rate "quoted per 24h". The accrual itself is hourly, so basis and interval are 1h. The docs say
// accrued funding "settles every 24 hours" into collateral; that is cash movement, not the rate period,
// and it counts against account health from the hour it accrues. Positive means longs pay ("when mark
// price > index price: longs pay shorts"). Payments are quantised to the quote tick, so thin-priced
// markets move in steps (ADA 0.000004 per unit is 1.9e-5/h).
//
// PRICES. `markPrice` is the overview point's mark at the settlement, at most about an hour old. No
// index price is published outside per-symbol calls.
//
// UNITS. `openInterestBaseLots` / 10^`baseLotsDecimals` is base units (BTC 29.89, against
// `/v1/market/BTC/stats` open_interest 30.40 half an hour earlier), times mark for USD. `baseLotsDecimals`
// can be negative (PUMP -2). Volume is the sum of `volumeQuote` (USDC) over the last 24 closed hourly
// candles; the current hour is never included in the candle response.
//
// CLASS. `commodityMetadata.isCommodity` is Phoenix's real-world flag (43 of 82), and the market's
// trading calendar says which kind: `us_equities_extended` (39, SPY and QQQ among them) or
// `cme_commodities` (GOLD, SILVER, COPPER, WTIOIL). Markets without the flag are crypto (39).
//
// QUOTE. USDC: "Phoenix perps are currently margined in USDC. Deposits, withdrawals, margin checks,
// PnL, and funding all resolve against the account's USDC collateral balance."
//
// BASE. Symbols are bare tickers and parse as themselves on all 82; GOLD and SILVER reach XAU and XAG
// through the core alias table.
//
// HISTORY. `/v1/funding/{symbol}/rates`, oldest first, `limit` up to 10,000 and a range of at most a
// year. It carries only the percentage, rounded to six decimals (1e-8 as a fraction).
package phoenix

import (
	"bytes"
	"encoding/json"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "phoenix"

// quoteCurrency is what every Phoenix perp is margined in; the venue symbols are bare tickers and
// carry no quote of their own, so it is declared rather than parsed.
const quoteCurrency = "USDC"

const hourMs int64 = 3_600_000

// candleHours is how many closed hours make up the 24h volume figure.
const candleHours int64 = 24

// Timestamp is a Phoenix instant: unix SECONDS as a JSON number or a numeric string, or — per the
// schema, though the live API never sent one — an ISO date-time.
//
// It keeps the raw text beside the decoded number because the two readings are mutually exclusive
// and a Num alone cannot tell "2026-09-13T22:00:01Z" from a field that was simply absent: both leave
// Num.OK false, and only one of them is a readable instant.
type Timestamp struct {
	Num adapters.Num
	// Text is the string form, set only when the JSON value was a string.
	Text   string
	IsText bool
}

// UnmarshalJSON accepts 1789336801, "1789336801", "2026-09-13T22:00:01Z" and null.
func (t *Timestamp) UnmarshalJSON(data []byte) error {
	*t = Timestamp{}
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) >= 2 && trimmed[0] == '"' {
		var text string
		if err := json.Unmarshal(trimmed, &text); err == nil {
			t.Text = text
			t.IsText = true
		}
	}
	// Num never fails: an unreadable value is absent, not an error, so one malformed stamp cannot
	// fail the venue's cycle.
	return t.Num.UnmarshalJSON(trimmed)
}

// TimeMs is epoch milliseconds from a Phoenix timestamp, or nil when it is unreadable.
//
// A numeric reading wins outright and a non-positive one is absent rather than falling through to
// the date parser, exactly as the TypeScript `n > 0 ? n * 1000 : null` does. time.RFC3339 is
// stricter than Date.parse, which also accepts a bare date and other loose shapes; the live API
// sends seconds on every market, so the ISO branch exists for the schema's sake alone.
func TimeMs(ts Timestamp) *int64 {
	if ts.Num.OK {
		if ts.Num.Val <= 0 {
			return nil
		}
		ms := int64(ts.Num.Val * 1000)
		return &ms
	}
	if !ts.IsText {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, ts.Text)
	if err != nil {
		return nil
	}
	ms := parsed.UnixMilli()
	return &ms
}

// CommodityMetadata carries Phoenix's real-world flag.
//
// IsCommodity is a plain bool because the TypeScript tests `isCommodity !== true`: an absent flag and
// a false one are the same answer — crypto — so there is no third state to preserve here.
type CommodityMetadata struct {
	IsCommodity bool `json:"isCommodity"`
}

// Calendar is the market's trading calendar, which says WHICH kind of real-world asset it is.
type Calendar struct {
	ID string `json:"id"`
}

type Metadata struct {
	Calendar Calendar `json:"calendar"`
}

// StatsSnapshot is the per-market stats block riding along on the markets call.
//
// A value struct rather than a pointer: an absent block leaves every Num absent, which is what
// `num(market.statsSnapshot?.openInterestBaseLots)` yields for a missing chain.
type StatsSnapshot struct {
	// OpenInterestBaseLots is base LOTS, converted by 10^BaseLotsDecimals.
	OpenInterestBaseLots adapters.Num `json:"openInterestBaseLots"`
	// FundingStartIntervalTimestamp is unix seconds, as a quoted string.
	FundingStartIntervalTimestamp Timestamp `json:"fundingStartIntervalTimestamp"`
}

type LeverageTierRow struct {
	MaxLeverage adapters.Num `json:"maxLeverage"`
}

type Market struct {
	Symbol            string            `json:"symbol"`
	MarketStatus      string            `json:"marketStatus"`
	CommodityMetadata CommodityMetadata `json:"commodityMetadata"`
	Metadata          Metadata          `json:"metadata"`
	// BaseLotsDecimals is the power of ten converting base lots to base units. It can be NEGATIVE
	// (PUMP is -2), so it multiplies as readily as it divides.
	BaseLotsDecimals float64 `json:"baseLotsDecimals"`
	// FundingIntervalSeconds is 3600 on all 82 markets. Not fundingPeriodSeconds, which is the
	// horizon the premium is spread over rather than the accrual period.
	FundingIntervalSeconds adapters.Num      `json:"fundingIntervalSeconds"`
	LeverageTiers          []LeverageTierRow `json:"leverageTiers"`
	StatsSnapshot          StatsSnapshot     `json:"statsSnapshot"`
}

type OverviewPoint struct {
	Timestamp Timestamp `json:"timestamp"`
	// FundingAmountPerUnit is quote units per base unit for the hour; over MarkPrice it is the
	// hour's fraction of notional.
	FundingAmountPerUnit adapters.Num `json:"fundingAmountPerUnit"`
	MarkPrice            adapters.Num `json:"markPrice"`
	// FundingRate is inconsistently scaled across markets — 1e4x the ratio on tick-100 markets and
	// 100x on tick-10 ones — and is NEVER read. Declared only so its absence from the parse is a
	// stated decision rather than an oversight.
	FundingRate adapters.Num `json:"fundingRate"`
}

type OverviewSeries struct {
	MarketID int64           `json:"marketId"`
	Symbol   string          `json:"symbol"`
	Points   []OverviewPoint `json:"points"`
}

type Candle struct {
	// Time is epoch ms of the candle open.
	Time int64 `json:"time"`
	// VolumeQuote is USDC traded in the candle.
	VolumeQuote adapters.Num `json:"volumeQuote"`
}

type RatePoint struct {
	Timestamp Timestamp `json:"timestamp"`
	// FundingRatePercentage is percent of notional for the hour.
	FundingRatePercentage adapters.Num `json:"fundingRatePercentage"`
}

// VolumeEntry is one market's cached 24h volume and when it was read.
type VolumeEntry struct {
	VolumeUSD *float64
	FetchedAt int64
}

// AssetClassFor is the class Phoenix declares: its real-world flag, then the market's trading
// calendar.
//
// The flag covers 43 of 82 markets; the calendar splits them into `us_equities_extended` (39, SPY
// and QQQ among them) and `cme_commodities` (GOLD, SILVER, COPPER, WTIOIL). A flagged market whose
// calendar this does not recognise falls to the shared base tables rather than guessing.
func AssetClassFor(market Market, base string) core.AssetClass {
	if !market.CommodityMetadata.IsCommodity {
		return core.ClassCrypto
	}
	calendar := market.Metadata.Calendar.ID
	if strings.HasPrefix(calendar, "us_equities") {
		return core.ClassEquity
	}
	if strings.Contains(calendar, "commodit") {
		return core.ClassCommodity
	}
	return core.ClassifyNonCrypto(base)
}

// refFor builds the market reference, declaring the quote Phoenix margins in and the class it flags.
//
// Parsed once first to learn the base, because the class tables key off the canonical base and the
// symbol is the only place it is stated.
func refFor(market Market) core.MarketRef {
	parsed := adapters.MarketRefFor(VenueID, market.Symbol, adapters.Overrides{})
	class := AssetClassFor(market, parsed.Base)
	quote := quoteCurrency
	return adapters.MarketRefFor(VenueID, market.Symbol, adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// intervalHours is the accrual period: hourly on every market, with the venue's own figure preferred
// where it states one.
func intervalHours(market Market) float64 {
	if market.FundingIntervalSeconds.OK && market.FundingIntervalSeconds.Val > 0 {
		return market.FundingIntervalSeconds.Val / 3600
	}
	return 1
}

// PointRate is the hourly fraction from one overview point, or nil when the mark is missing.
//
// `fundingAmountPerUnit / markPrice` is the hour's fraction of notional, cross-checked against the
// independent rates history at 100x on every market measured. A zero payment is a zero rate, not a
// missing one — only a missing or non-positive mark makes the reading unusable.
func PointRate(point OverviewPoint) *float64 {
	if !point.FundingAmountPerUnit.OK || !point.MarkPrice.OK || point.MarkPrice.Val <= 0 {
		return nil
	}
	rate := point.FundingAmountPerUnit.Val / point.MarkPrice.Val
	return &rate
}

// Volume24h is the USDC volume of the 24 closed hours before the hour containing now.
//
// The hour in progress is excluded deliberately: Phoenix never includes it in the candle response,
// so counting a partial hour would make volume sag and recover once an hour on every market.
func Volume24h(candles []Candle, now int64) float64 {
	hourStart := now / hourMs * hourMs
	from := hourStart - candleHours*hourMs
	total := 0.0
	for _, candle := range candles {
		if candle.Time >= from && candle.Time < hourStart && candle.VolumeQuote.OK {
			total += candle.VolumeQuote.Val
		}
	}
	return total
}

// IsTradable reports whether Phoenix is currently running the market.
func IsTradable(market Market) bool {
	return market.MarketStatus == "active"
}

// ParseSnapshots normalises one cycle's markets, funding overview and cached volumes.
//
// Every snapshot is core.KindSettled and is echoed as a settled event: the newest overview point is
// the rate for the hour JUST ENDED, measured holding still for a whole hour before stepping, so
// nothing here is an estimate of the hour to come.
func ParseSnapshots(markets []Market, series []OverviewSeries, volumes map[string]VolumeEntry, now int64) core.SnapshotBatch {
	// Newest point per market. Keyed lookup only — the OUTPUT order comes from the markets slice
	// below, so a Go map's per-run iteration order never reaches the batch.
	latest := make(map[string]OverviewPoint, len(series))
	for _, s := range series {
		for _, point := range s.Points {
			at := TimeMs(point.Timestamp)
			if at == nil {
				continue
			}
			current, seen := latest[s.Symbol]
			if !seen {
				latest[s.Symbol] = point
				continue
			}
			currentAt := int64(0)
			if c := TimeMs(current.Timestamp); c != nil {
				currentAt = *c
			}
			if *at > currentAt {
				latest[s.Symbol] = point
			}
		}
	}

	snapshots := make([]core.FundingSnapshot, 0, len(markets))
	settled := make([]core.FundingEvent, 0, len(markets))
	for _, market := range markets {
		point, hasPoint := latest[market.Symbol]
		if !IsTradable(market) || !hasPoint {
			continue
		}
		settledAt := TimeMs(point.Timestamp)
		rate := PointRate(point)
		if settledAt == nil || rate == nil {
			continue
		}

		ref := refFor(market)
		hours := intervalHours(market)
		markPrice := point.MarkPrice.Ptr()

		// Base LOTS to base units. The exponent is negative on some markets, so this multiplies
		// there rather than dividing -- PUMP's -2 turns 298,911 lots into 29,891,100 units.
		var openInterest *float64
		if market.StatsSnapshot.OpenInterestBaseLots.OK {
			units := market.StatsSnapshot.OpenInterestBaseLots.Val / math.Pow(10, market.BaseLotsDecimals)
			openInterest = &units
		}

		var nextFundingAt *int64
		if intervalStart := TimeMs(market.StatsSnapshot.FundingStartIntervalTimestamp); intervalStart != nil {
			at := *intervalStart + int64(hours*float64(hourMs))
			nextFundingAt = &at
		}

		var maxLeverage *float64
		if len(market.LeverageTiers) > 0 {
			if declared := market.LeverageTiers[0].MaxLeverage; declared.OK && declared.Val > 0 {
				maxLeverage = declared.Ptr()
			}
		}

		var volume24hUSD *float64
		if entry, cached := volumes[market.Symbol]; cached {
			volume24hUSD = entry.VolumeUSD
		}

		interval := hours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          *rate,
			BasisHours:    hours,
			IntervalHours: &interval,
			NextFundingAt: nextFundingAt,
			Kind:          core.KindSettled,
			MarkPrice:     markPrice,
			// No index price is published outside the per-symbol calls this adapter does not make.
			IndexPrice:      nil,
			OpenInterestUSD: adapters.Mul(openInterest, markPrice),
			Volume24hUSD:    volume24hUSD,
			MaxLeverage:     maxLeverage,
		})
		settled = append(settled, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  *settledAt,
			Rate:       *rate,
			BasisHours: hours,
			MarkPrice:  markPrice,
		})
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}
}

// ParseRates returns settled hourly rates within [fromMs, toMs], oldest first.
//
// The history carries only the percentage, so the fraction is percent/100 -- the same scale the
// overview's amount-over-mark produces, which is what pins the two independent readings together.
// One event per settlement: the windows the caller walks overlap at their boundaries, and the venue
// serves the same point in both.
func ParseRates(market Market, rows []RatePoint, fromMs, toMs int64) []core.FundingEvent {
	ref := refFor(market)
	hours := intervalHours(market)

	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		settledAt := TimeMs(row.Timestamp)
		if settledAt == nil || !row.FundingRatePercentage.OK || *settledAt < fromMs || *settledAt > toMs {
			continue
		}
		bySettlement[*settledAt] = core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  *settledAt,
			Rate:       row.FundingRatePercentage.Val / 100,
			BasisHours: hours,
			// The history publishes no mark; an invented one would be worse than none.
			MarkPrice: nil,
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
