package core

import (
	"fmt"
	"math"
	"sort"
)

// RateUnit is how a venue expresses a funding rate value.
type RateUnit string

const (
	UnitFraction RateUnit = "fraction"
	UnitPercent  RateUnit = "percent"
	UnitBps      RateUnit = "bps"
)

// DurationUnit is how a venue expresses a funding interval. Venues genuinely differ: Bybit reports
// minutes, KuCoin milliseconds, Gate seconds, Bitget hours.
type DurationUnit string

const (
	DurationMs  DurationUnit = "ms"
	DurationS   DurationUnit = "s"
	DurationMin DurationUnit = "min"
	DurationH   DurationUnit = "h"
)

const (
	hoursPerYear = 24 * 365
	msPerHour    = 3_600_000.0
)

// standardIntervalsH are the settlement intervals seen in the wild; an inferred interval within 5%
// snaps to one of these, so a couple of seconds of clock skew does not produce 7.998 hours.
var standardIntervalsH = []float64{0.5, 1, 2, 4, 8, 12, 24}

func ToFraction(value float64, unit RateUnit) float64 {
	switch unit {
	case UnitPercent:
		return value / 100
	case UnitBps:
		return value / 10_000
	default:
		return value
	}
}

func DurationToHours(value float64, unit DurationUnit) float64 {
	switch unit {
	case DurationMs:
		return value / msPerHour
	case DurationS:
		return value / 3_600
	case DurationMin:
		return value / 60
	default:
		return value
	}
}

// RatePerHour converts a rate quoted over basisHours into a rate per hour.
//
// The basis is the period the rate is quoted over, which is not always the settlement interval:
// GRVT and Paradex quote an 8h-normalised rate for markets that settle hourly.
func RatePerHour(rateFraction, basisHours float64) (float64, error) {
	if !(basisHours > 0) {
		return 0, fmt.Errorf("basisHours must be > 0, got %v", basisHours)
	}
	return rateFraction / basisHours, nil
}

// APRPercent is the simple (non-compounded) annualised rate in percent. Positive means longs pay.
//
// This formula is the one class of bug every internal test would happily agree with, since they all
// share it — so it is cross-checked against Hyperliquid's own predictedFundings, which publishes
// Binance and Bybit rates independently. Worst divergence measured 2026-09-13 was 0.0859 APR points
// against a 0.5 tolerance, with three of six comparisons exactly zero to ten decimal places.
func APRPercent(ratePerHourFraction float64) float64 {
	return ratePerHourFraction * hoursPerYear * 100
}

func APRFromRate(value float64, unit RateUnit, basisHours float64) (float64, error) {
	perHour, err := RatePerHour(ToFraction(value, unit), basisHours)
	if err != nil {
		return 0, err
	}
	return APRPercent(perHour), nil
}

// PerUnitPrice converts a venue-quoted contract price into a price per unit of the base asset.
//
// Venues list scaled contracts (1000PEPE, kPEPE, 10000CAT) whose quoted price covers `multiplier`
// units, while Base is canonicalised to the unscaled asset. Without this the same asset appears at
// two scales across venues and cross-venue comparison is meaningless: PEPE marked 0.00000327 on
// eight venues and 0.00327 on six before migration 004 fixed it. Funding rates are fractions and
// need no such conversion.
func PerUnitPrice(price *float64, multiplier float64) *float64 {
	if price == nil || !(multiplier > 0) || multiplier == 1 {
		return price
	}
	scaled := *price / multiplier
	return &scaled
}

// InferIntervalHours infers the settlement interval in hours from settlement timestamps (epoch ms),
// using the MEDIAN gap so that a single missed settlement, or an interval change early in the
// window, does not skew it. Returns nil when there are fewer than two distinct timestamps.
//
// Intervals must be inferred rather than read from current metadata: Binance, Bybit, OKX and Pionex
// shorten 8h to 4h to 1h when funding hits the cap, so a backtest that used today's metadata for
// last month's settlements would mis-weight every payment in the window.
func InferIntervalHours(timestampsMs []int64) *float64 {
	if len(timestampsMs) < 2 {
		return nil
	}
	sorted := make([]int64, len(timestampsMs))
	copy(sorted, timestampsMs)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

	gaps := make([]float64, 0, len(sorted)-1)
	for i := 1; i < len(sorted); i++ {
		if gap := sorted[i] - sorted[i-1]; gap > 0 {
			gaps = append(gaps, float64(gap))
		}
	}
	if len(gaps) == 0 {
		return nil
	}

	sort.Float64s(gaps)
	mid := len(gaps) / 2
	medianMs := gaps[mid]
	if len(gaps)%2 == 0 {
		medianMs = (gaps[mid-1] + gaps[mid]) / 2
	}

	hours := medianMs / msPerHour
	for _, standard := range standardIntervalsH {
		if math.Abs(hours-standard)/standard < 0.05 {
			snapped := standard
			return &snapped
		}
	}
	return &hours
}
