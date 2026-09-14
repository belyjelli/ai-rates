package core

import (
	"math"
	"testing"
	"time"
)

// Vectors from packages/core/src/backtest.test.ts and the backtestPair cases of
// backtest-daily.test.ts. The side-by-side backtestDaily cases are not ported: there is no Go
// backtestDaily, because nothing in the collector calls it.

const (
	btHour = int64(3_600_000)
	btDay  = int64(86_400_000)
)

// 2026-09-01T00:00:00Z, so bucket dates are readable.
var btStart = time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC).UnixMilli()

// assertClose mirrors bun's toBeCloseTo(want, digits): |got - want| < 10^-digits / 2.
func assertClose(t *testing.T, label string, got, want float64, digits int) {
	t.Helper()
	if !(math.Abs(got-want) < math.Pow(10, -float64(digits))/2) {
		t.Errorf("%s: got %.15g, want %.15g (to %d digits)", label, got, want, digits)
	}
}

func btSeries(startMs int64, everyHours int64, count int, rate float64) []BacktestSettlement {
	out := make([]BacktestSettlement, count)
	for i := range out {
		out[i] = BacktestSettlement{
			SettledAt:  startMs + int64(i)*everyHours*btHour,
			Rate:       rate,
			BasisHours: float64(everyHours),
		}
	}
	return out
}

func btLeg(venueID, symbol string, settlements []BacktestSettlement) BacktestLeg {
	return BacktestLeg{VenueID: venueID, VenueSymbol: symbol, Settlements: settlements}
}

func TestBacktestSumsEachLegAtItsOwnCadence(t *testing.T) {
	result := BacktestPair(BacktestInput{
		Long:    btLeg("hyperliquid", "BTC", btSeries(btStart, 1, 24, 0.00001)),
		Short:   btLeg("bybit", "BTCUSDT", btSeries(btStart, 8, 3, 0.0001)),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + btDay,
	})
	// Long pays 10000 * 0.00001 * 24 = 2.40; short receives 10000 * 0.0001 * 3 = 3.00.
	assertClose(t, "long funding", result.Long.FundingUSD, -2.4, 9)
	assertClose(t, "short funding", result.Short.FundingUSD, 3, 9)
	assertClose(t, "net funding", result.NetFundingUSD, 0.6, 9)
	if result.Long.Settlements != 24 || result.Short.Settlements != 3 {
		t.Errorf("settlements %d/%d, want 24/3", result.Long.Settlements, result.Short.Settlements)
	}
	assertClose(t, "net APR", result.NetFundingAPRPercent, 2.19, 6)
}

func TestBacktestNegativeRatePaysTheLong(t *testing.T) {
	result := BacktestPair(BacktestInput{
		Long:    btLeg("gate", "X_USDT", btSeries(btStart, 8, 3, -0.0002)),
		Short:   btLeg("okx", "X-USDT-SWAP", btSeries(btStart, 8, 3, -0.0001)),
		SizeUSD: 1_000,
		FromMs:  btStart,
		ToMs:    btStart + btDay,
	})
	assertClose(t, "long funding", result.Long.FundingUSD, 0.6, 9)
	assertClose(t, "short funding", result.Short.FundingUSD, -0.3, 9)
	assertClose(t, "net funding", result.NetFundingUSD, 0.3, 9)
}

func TestBacktestBucketsByUTCDayAndCountsOnlySettledDays(t *testing.T) {
	long := append(btSeries(btStart, 8, 3, 0.0001), btSeries(btStart+2*btDay, 8, 3, -0.0001)...)
	result := BacktestPair(BacktestInput{
		Long:    btLeg("gate", "X_USDT", long),
		Short:   btLeg("okx", "X-USDT-SWAP", nil),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + 3*btDay,
	})
	if len(result.PerDay) != 2 || result.PerDay[0].Date != "2026-09-01" || result.PerDay[1].Date != "2026-09-03" {
		t.Fatalf("per day %+v, want 2026-09-01 and 2026-09-03", result.PerDay)
	}
	assertClose(t, "day 1", result.PerDay[0].NetUSD, -3, 9)
	assertClose(t, "day 3", result.PerDay[1].NetUSD, 3, 9)
	assertClose(t, "win rate", result.WinRateDays, 0.5, 9)
	assertClose(t, "avg daily", result.AvgDailyUSD, 0, 9)
}

func TestBacktestFlagsMissingSettlements(t *testing.T) {
	withHole := append(btSeries(btStart, 8, 2, 0.0001), btSeries(btStart+32*btHour, 8, 2, 0.0001)...)
	result := BacktestPair(BacktestInput{
		Long:    btLeg("gate", "X_USDT", withHole),
		Short:   btLeg("okx", "X-USDT-SWAP", btSeries(btStart, 8, 4, 0.0001)),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + 2*btDay,
	})
	if result.Long.MissedSettlements != 2 {
		t.Errorf("long missed %d, want 2", result.Long.MissedSettlements)
	}
	assertClose(t, "long missed hours", result.Long.MissedHours, 16, 9)
	if result.Short.MissedSettlements != 0 {
		t.Errorf("short missed %d, want 0", result.Short.MissedSettlements)
	}
}

func TestBacktestSurvivesAnIntervalChange(t *testing.T) {
	changed := append(btSeries(btStart, 8, 3, 0.0001), btSeries(btStart+btDay, 1, 24, 0.0000125)...)
	result := BacktestPair(BacktestInput{
		Long:    btLeg("bybit", "X", changed),
		Short:   btLeg("okx", "X", nil),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + 2*btDay,
	})
	if result.Long.Settlements != 27 || result.Long.MissedSettlements != 0 {
		t.Errorf("settlements %d missed %d, want 27 and 0", result.Long.Settlements, result.Long.MissedSettlements)
	}
	assertClose(t, "long funding", result.Long.FundingUSD, -(3*1 + 24*0.125), 9)
}

func TestBacktestChargesFourFillsAndPaybackOnlyWhenItRepays(t *testing.T) {
	fees := &BacktestFees{LongTakerBps: 5, ShortTakerBps: 5}
	profitable := BacktestPair(BacktestInput{
		Long:    btLeg("a", "X", btSeries(btStart, 8, 3, -0.0001)),
		Short:   btLeg("b", "X", btSeries(btStart, 8, 3, 0.0001)),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + btDay,
		Fees:    fees,
	})
	if profitable.CostsUSD == nil || profitable.NetAfterCostsUSD == nil || profitable.PaybackDays == nil {
		t.Fatal("costs, net after costs and payback must all be set when fees are known")
	}
	assertClose(t, "costs", *profitable.CostsUSD, 20, 9)
	assertClose(t, "net funding", profitable.NetFundingUSD, 6, 9)
	assertClose(t, "net after costs", *profitable.NetAfterCostsUSD, -14, 9)
	assertClose(t, "payback", *profitable.PaybackDays, 20.0/6, 9)

	losing := BacktestPair(BacktestInput{
		Long:    btLeg("a", "X", btSeries(btStart, 8, 3, 0.0001)),
		Short:   btLeg("b", "X", btSeries(btStart, 8, 3, -0.0001)),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + btDay,
		Fees:    fees,
	})
	if losing.PaybackDays != nil {
		t.Errorf("payback %v, want nil for a pair that never repays", *losing.PaybackDays)
	}
}

func TestBacktestLeavesCostsNilWhenFeesAreUnknown(t *testing.T) {
	result := BacktestPair(BacktestInput{
		Long:    btLeg("a", "X", btSeries(btStart, 8, 3, -0.0001)),
		Short:   btLeg("b", "X", btSeries(btStart, 8, 3, 0.0001)),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + btDay,
	})
	if result.CostsUSD != nil || result.NetAfterCostsUSD != nil || result.PaybackDays != nil {
		t.Error("costs must stay nil when fees are unknown")
	}
}

func TestBacktestEmptyWindowReportsNothing(t *testing.T) {
	result := BacktestPair(BacktestInput{
		Long:    btLeg("a", "X", nil),
		Short:   btLeg("b", "X", nil),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart,
	})
	if result.NetFundingUSD != 0 || result.NetFundingAPRPercent != 0 || result.WinRateDays != 0 {
		t.Errorf("got net %v APR %v win %v, want all 0", result.NetFundingUSD, result.NetFundingAPRPercent, result.WinRateDays)
	}
	if result.PerDay == nil || len(result.PerDay) != 0 {
		t.Errorf("per day %#v, want an empty non-nil slice", result.PerDay)
	}
}

// dailyNets is a short leg netting `usd` on each successive day, one 8-hour settlement a day.
func dailyNets(nets []float64) BacktestResult {
	settlements := make([]BacktestSettlement, len(nets))
	for i, usd := range nets {
		settlements[i] = BacktestSettlement{SettledAt: btStart + int64(i)*btDay, Rate: usd / 10_000, BasisHours: 8}
	}
	return BacktestPair(BacktestInput{
		Long:    btLeg("okx", "BTC-USDT-SWAP", nil),
		Short:   btLeg("bybit", "BTCUSDT", settlements),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + int64(len(nets))*btDay,
	})
}

func TestBacktestBestWorstDayAndLargestFallFromAHigh(t *testing.T) {
	result := dailyNets([]float64{5, -8, 2, -1, 6})
	if result.BestDay == nil || result.BestDay.Date != "2026-09-05" {
		t.Fatalf("best day %+v, want 2026-09-05", result.BestDay)
	}
	assertClose(t, "best", result.BestDay.NetUSD, 6, 9)
	if result.WorstDay == nil || result.WorstDay.Date != "2026-09-02" {
		t.Fatalf("worst day %+v, want 2026-09-02", result.WorstDay)
	}
	assertClose(t, "worst", result.WorstDay.NetUSD, -8, 9)
	assertClose(t, "drawdown", result.MaxDrawdownUSD, 8, 9)
}

func TestBacktestOpeningLossDrawsDownFromZero(t *testing.T) {
	assertClose(t, "opening loss", dailyNets([]float64{-3, 1}).MaxDrawdownUSD, 3, 9)
	if got := dailyNets([]float64{1, 2, 3}).MaxDrawdownUSD; got != 0 {
		t.Errorf("rising drawdown %v, want 0", got)
	}
	empty := dailyNets(nil)
	if empty.BestDay != nil || empty.MaxDrawdownUSD != 0 {
		t.Errorf("empty best %+v drawdown %v, want nil and 0", empty.BestDay, empty.MaxDrawdownUSD)
	}
}

func TestBacktestAverageRateIsTimeWeightedAndSideless(t *testing.T) {
	settlements := make([]BacktestSettlement, 0, 17)
	for i := int64(0); i < 16; i++ {
		settlements = append(settlements, BacktestSettlement{SettledAt: btStart + i*btHour, Rate: 0.00001, BasisHours: 1})
	}
	settlements = append(settlements, BacktestSettlement{SettledAt: btStart + 16*btHour, Rate: 0.00008, BasisHours: 8})
	result := BacktestPair(BacktestInput{
		Long:    btLeg("okx", "BTC-USDT-SWAP", settlements),
		Short:   btLeg("bybit", "BTCUSDT", nil),
		SizeUSD: 10_000,
		FromMs:  btStart,
		ToMs:    btStart + btDay,
	})
	if !(result.Long.FundingUSD < 0) {
		t.Errorf("long funding %v, want negative", result.Long.FundingUSD)
	}
	if result.Long.AverageAPRPercent == nil {
		t.Fatal("long average APR is nil")
	}
	assertClose(t, "average APR", *result.Long.AverageAPRPercent, 8.76, 9)
	if result.Short.AverageAPRPercent != nil {
		t.Errorf("short average APR %v, want nil", *result.Short.AverageAPRPercent)
	}
}

func TestJSRoundTiesTowardPositiveInfinity(t *testing.T) {
	for _, c := range []struct{ in, want float64 }{
		{2.5, 3}, {-2.5, -2}, {1.4999, 1}, {-0.3, 0}, {-0.5, 0}, {-0.51, -1},
	} {
		if got := jsRound(c.in); got != c.want {
			t.Errorf("jsRound(%v) = %v, want %v", c.in, got, c.want)
		}
	}
}
