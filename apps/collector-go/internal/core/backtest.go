package core

// Funding-carry backtest for one asset held long on one venue and short on another.
//
// Ported from packages/core/src/backtest.ts (backtestPair only; backtestDaily serves the Worker and
// has no caller here). The TypeScript engine is the authority and both are pinned to the same test
// vectors, because this is the arithmetic the project treats as correctness-critical.
//
// What this measures: the funding actually settled on both legs over a window, summed at each leg's
// own settlement times. Legs rarely share a cadence -- Hyperliquid settles BTC hourly while Bybit
// settles it 8-hourly -- so nothing is resampled or forward-filled onto a common grid.
//
// Notional is held constant at SizeUSD per leg. Venue funding-history APIs return a rate and a
// timestamp and nothing else, so this assumes a position rebalanced to SizeUSD, which is what the
// funding rate is charged against. Price drift between settlements and basis PnL are not modelled.

import (
	"math"
	"sort"
	"time"
)

const (
	backtestMsPerDay    = 86_400_000.0
	backtestMsPerHour   = 3_600_000.0
	backtestDaysPerYear = 365.0
	backtestHoursPerYr  = 8_760.0
	// A gap longer than this multiple of the expected interval counts as missed settlements.
	backtestGapTolerance = 1.5
)

// BacktestSettlement is one settled payment. Rate is a fraction over BasisHours; positive means
// longs pay shorts.
type BacktestSettlement struct {
	SettledAt  int64
	Rate       float64
	BasisHours float64
}

// BacktestLeg is one side of the pair. Settlements may be in any order.
type BacktestLeg struct {
	VenueID     string
	VenueSymbol string
	Settlements []BacktestSettlement
}

// BacktestFees are taker fees in basis points, charged on entry and exit of each leg.
type BacktestFees struct {
	LongTakerBps  float64
	ShortTakerBps float64
}

type BacktestInput struct {
	Long  BacktestLeg
	Short BacktestLeg
	// SizeUSD is notional per leg. Capital committed is 2x this, before leverage.
	SizeUSD float64
	FromMs  int64
	ToMs    int64
	// Fees is nil when unknown, which leaves every cost figure nil rather than assumed.
	Fees *BacktestFees
}

type LegResult struct {
	VenueID     string
	VenueSymbol string
	Settlements int
	// FundingUSD is this leg's cashflow: negative when the position pays.
	FundingUSD float64
	// APRPercent is this leg's own funding annualized over the window.
	APRPercent float64
	// AverageAPRPercent is the market's time-weighted rate in its own sign, nil when nothing settled.
	AverageAPRPercent *float64
	MissedSettlements int
	MissedHours       float64
}

type BacktestDay struct {
	// Date is the UTC date, YYYY-MM-DD.
	Date   string
	NetUSD float64
}

type BacktestResult struct {
	FromMs               int64
	ToMs                 int64
	SizeUSD              float64
	Days                 float64
	Long                 LegResult
	Short                LegResult
	NetFundingUSD        float64
	NetFundingAPRPercent float64
	// PerDay is never nil; an empty window yields an empty slice, as the TypeScript yields [].
	PerDay []BacktestDay
	// WinRateDays is days with positive net funding, as a share of days that had any settlement.
	WinRateDays float64
	// BestDay and WorstDay are nil with no days.
	BestDay  *BacktestDay
	WorstDay *BacktestDay
	// MaxDrawdownUSD is the largest fall in cumulative net funding from a previous high, measured
	// from a start of zero and before costs.
	MaxDrawdownUSD float64
	AvgDailyUSD    float64
	// CostsUSD is four taker fills; nil when fees were not supplied.
	CostsUSD         *float64
	NetAfterCostsUSD *float64
	// PaybackDays is nil when costs are unknown or funding never repays them.
	PaybackDays *float64
}

func backtestUTCDate(ms int64) string {
	return time.UnixMilli(ms).UTC().Format("2006-01-02")
}

// jsRound is JavaScript's Math.round: nearest integer, ties toward +Inf. Go's math.Round sends ties
// away from zero, which differs for negative halves (-2.5 is -2 in JS, -3 in Go).
func jsRound(x float64) float64 {
	r := math.Floor(x)
	if x-r >= 0.5 {
		r++
	}
	return r
}

// backtestCashflow: the long leg pays when the rate is positive; the short leg is the mirror.
func backtestCashflow(sizeUSD, rate float64, long bool) float64 {
	if long {
		return -sizeUSD * rate
	}
	return sizeUSD * rate
}

// backtestFindGaps counts settlements the cadence implies are missing. A gap is never zero funding.
func backtestFindGaps(settlements []BacktestSettlement) (int, float64) {
	missedSettlements := 0
	missedHours := 0.0
	for i := 1; i < len(settlements); i++ {
		previous := settlements[i-1]
		current := settlements[i]
		expectedMs := previous.BasisHours * backtestMsPerHour
		if !(expectedMs > 0) {
			continue
		}
		actualMs := float64(current.SettledAt - previous.SettledAt)
		if actualMs <= expectedMs*backtestGapTolerance {
			continue
		}
		missedSettlements += int(jsRound(actualMs/expectedMs)) - 1
		missedHours += (actualMs - expectedMs) / backtestMsPerHour
	}
	return missedSettlements, missedHours
}

func backtestLegResult(leg BacktestLeg, long bool, sizeUSD, days float64, daily map[string]float64) LegResult {
	settlements := make([]BacktestSettlement, len(leg.Settlements))
	copy(settlements, leg.Settlements)
	// Stable, as Array.prototype.sort is.
	sort.SliceStable(settlements, func(i, j int) bool {
		return settlements[i].SettledAt < settlements[j].SettledAt
	})

	fundingUSD := 0.0
	rateSum := 0.0
	hours := 0.0
	for _, settlement := range settlements {
		amount := backtestCashflow(sizeUSD, settlement.Rate, long)
		fundingUSD += amount
		rateSum += settlement.Rate
		hours += settlement.BasisHours
		date := backtestUTCDate(settlement.SettledAt)
		daily[date] += amount
	}

	result := LegResult{
		VenueID:     leg.VenueID,
		VenueSymbol: leg.VenueSymbol,
		Settlements: len(settlements),
		FundingUSD:  fundingUSD,
	}
	if days > 0 {
		result.APRPercent = fundingUSD / sizeUSD / days * backtestDaysPerYear * 100
	}
	if hours > 0 {
		average := rateSum / hours * backtestHoursPerYr * 100
		result.AverageAPRPercent = &average
	}
	result.MissedSettlements, result.MissedHours = backtestFindGaps(settlements)
	return result
}

// BacktestPair replays both legs' settled funding over the window. Costs are only included when
// Fees is supplied: an assumed fee would be worse than an absent one.
func BacktestPair(input BacktestInput) BacktestResult {
	days := math.Max(0, float64(input.ToMs-input.FromMs)/backtestMsPerDay)
	daily := map[string]float64{}

	longResult := backtestLegResult(input.Long, true, input.SizeUSD, days, daily)
	shortResult := backtestLegResult(input.Short, false, input.SizeUSD, days, daily)
	return backtestSummarize(input, days, longResult, shortResult, daily)
}

func backtestSummarize(input BacktestInput, days float64, longResult, shortResult LegResult, daily map[string]float64) BacktestResult {
	sizeUSD := input.SizeUSD
	netFundingUSD := longResult.FundingUSD + shortResult.FundingUSD

	perDay := make([]BacktestDay, 0, len(daily))
	for date, netUSD := range daily {
		perDay = append(perDay, BacktestDay{Date: date, NetUSD: netUSD})
	}
	// Dates are unique, so ordering by the string alone is total.
	sort.Slice(perDay, func(i, j int) bool { return perDay[i].Date < perDay[j].Date })

	winningDays := 0
	for _, day := range perDay {
		if day.NetUSD > 0 {
			winningDays++
		}
	}
	avgDailyUSD := 0.0
	if days > 0 {
		avgDailyUSD = netFundingUSD / days
	}

	var bestDay, worstDay *BacktestDay
	running := 0.0
	peak := 0.0
	maxDrawdownUSD := 0.0
	for i := range perDay {
		day := perDay[i]
		if bestDay == nil || day.NetUSD > bestDay.NetUSD {
			best := day
			bestDay = &best
		}
		if worstDay == nil || day.NetUSD < worstDay.NetUSD {
			worst := day
			worstDay = &worst
		}
		running += day.NetUSD
		peak = math.Max(peak, running)
		maxDrawdownUSD = math.Max(maxDrawdownUSD, peak-running)
	}

	result := BacktestResult{
		FromMs:         input.FromMs,
		ToMs:           input.ToMs,
		SizeUSD:        sizeUSD,
		Days:           days,
		Long:           longResult,
		Short:          shortResult,
		NetFundingUSD:  netFundingUSD,
		PerDay:         perDay,
		BestDay:        bestDay,
		WorstDay:       worstDay,
		MaxDrawdownUSD: maxDrawdownUSD,
		AvgDailyUSD:    avgDailyUSD,
	}
	if days > 0 {
		result.NetFundingAPRPercent = netFundingUSD / sizeUSD / days * backtestDaysPerYear * 100
	}
	if len(perDay) > 0 {
		result.WinRateDays = float64(winningDays) / float64(len(perDay))
	}

	// Four fills: in and out of both legs.
	if input.Fees != nil {
		costs := sizeUSD * (input.Fees.LongTakerBps + input.Fees.ShortTakerBps) * 2 / 10_000
		net := netFundingUSD - costs
		result.CostsUSD = &costs
		result.NetAfterCostsUSD = &net
		// `avgDailyUsd <= 0` is false for NaN in both languages, so NaN reaches the division as in TS.
		if !(avgDailyUSD <= 0) {
			payback := costs / avgDailyUSD
			result.PaybackDays = &payback
		}
	}
	return result
}
