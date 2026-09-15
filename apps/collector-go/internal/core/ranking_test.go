package core

import (
	"math"
	"reflect"
	"testing"
)

// Vectors from packages/core/src/ranking.test.ts.

// rkEvidence is the measured shape of a well-evidenced pair.
func rkEvidence(over func(*PairEvidence)) PairEvidence {
	e := PairEvidence{RatePerWeek: 0.003, ChargeDays: 30, ThinnerLegOiUSD: 25_000_000}
	if over != nil {
		over(&e)
	}
	return e
}

// rkPrior is the measured median of $3.12 per $10k per week.
const rkPrior = 0.000312

func TestScoreShrinksThinSamplesTowardThePrior(t *testing.T) {
	sparse := Score(rkEvidence(func(e *PairEvidence) { e.RatePerWeek = 0.01; e.ChargeDays = 4 }), rkPrior, ShrinkageK)
	thick := Score(rkEvidence(func(e *PairEvidence) { e.RatePerWeek = 0.01; e.ChargeDays = 30 }), rkPrior, ShrinkageK)
	assertClose(t, "sparse", sparse, (4*0.01+10*rkPrior)/14, 8)
	assertClose(t, "thick", thick, (30*0.01+10*rkPrior)/40, 8)
	if !(sparse < thick) {
		t.Errorf("sparse %v should score below thick %v", sparse, thick)
	}
	if !(sparse < 0.01*0.75) {
		t.Errorf("sparse %v should be pulled most of the way to the prior", sparse)
	}
}

func TestScoreWithNoEvidenceIsThePrior(t *testing.T) {
	assertClose(t, "no evidence", Score(rkEvidence(func(e *PairEvidence) { e.ChargeDays = 0 }), rkPrior, ShrinkageK), rkPrior, 10)
}

func TestScorePriorIsTheMedianNotZero(t *testing.T) {
	got := Score(rkEvidence(func(e *PairEvidence) { e.RatePerWeek = 0; e.ChargeDays = 1 }), rkPrior, ShrinkageK)
	if !(got > 0) {
		t.Errorf("score %v, want > 0", got)
	}
}

func TestScoreNaNInNaNOut(t *testing.T) {
	if got := Score(rkEvidence(func(e *PairEvidence) { e.RatePerWeek = math.NaN() }), rkPrior, ShrinkageK); !math.IsNaN(got) {
		t.Errorf("score %v, want NaN", got)
	}
}

func TestSwitchBandPaysForItselfOverTheHold(t *testing.T) {
	assertClose(t, "band", SwitchBand(0.002, 4, BandCubeRootC), 0.0005, 10)
}

func TestSwitchBandIsAMeaningfulFractionOfTheRate(t *testing.T) {
	ratio := SwitchBand(0.002, 4, BandCubeRootC) / 0.003
	if !(ratio > 0.1 && ratio < 0.3) {
		t.Errorf("band/rate %v, want between 0.1 and 0.3", ratio)
	}
}

func TestSwitchBandBetterFeeTierLowersTheBar(t *testing.T) {
	if !(SwitchBand(0.0006, 4, BandCubeRootC) < SwitchBand(0.002, 4, BandCubeRootC)) {
		t.Error("a cheaper round trip should lower the band")
	}
}

func TestSwitchBandCubeRootTermIsOffUntilCalibrated(t *testing.T) {
	if SwitchBand(0.002, 4, BandCubeRootC) != SwitchBand(0.002, 4, 0) {
		t.Error("the default must equal c = 0")
	}
	if !(SwitchBand(0.002, 4, 0.01) > SwitchBand(0.002, 4, 0)) {
		t.Error("a positive c should widen the band")
	}
}

func TestSwitchBandNoCostNoBand(t *testing.T) {
	if SwitchBand(0, DefaultHorizonWeeks, BandCubeRootC) != 0 || SwitchBand(math.NaN(), DefaultHorizonWeeks, BandCubeRootC) != 0 {
		t.Error("zero or NaN cost must give a zero band")
	}
}

func TestShouldSwitch(t *testing.T) {
	band := SwitchBand(0.002, 4, BandCubeRootC)
	if ShouldSwitch(0.003, 0.0034, band) {
		t.Error("holds when the improvement does not clear the round trip")
	}
	if !ShouldSwitch(0.003, 0.004, band) {
		t.Error("switches when it clearly does")
	}
	if ShouldSwitch(0.003, 0.003+band, band) {
		t.Error("a tie holds")
	}
	if !ShouldSwitch(math.NaN(), 0.001, band) {
		t.Error("takes any real challenger when there is no incumbent")
	}
	if ShouldSwitch(math.NaN(), math.NaN(), band) {
		t.Error("no real challenger, no switch")
	}
}

func TestShouldExit(t *testing.T) {
	if !ShouldExit(0.0001, rkPrior) || ShouldExit(0.003, rkPrior) {
		t.Error("leaves a decaying pair and keeps a healthy one")
	}
	band := SwitchBand(0.002, 4, BandCubeRootC)
	decayed := 0.0002
	if ShouldSwitch(decayed, decayed+band/2, band) {
		t.Error("no challenger clears the entry band")
	}
	if !ShouldExit(decayed, rkPrior) {
		t.Error("but the exit floor drops it anyway")
	}
	if !ShouldExit(math.NaN(), rkPrior) {
		t.Error("an unscoreable incumbent is exited")
	}
}

func TestDeployableUSD(t *testing.T) {
	if DeployableUSD(25_000_000, DefaultParticipation) != 500_000 || DeployableUSD(5_000_000, DefaultParticipation) != 100_000 {
		t.Error("2% of the thinner leg")
	}
	if !(DeployableUSD(5_000_000, DefaultParticipation) >= 100_000) || !(DeployableUSD(4_000_000, DefaultParticipation) < 100_000) {
		t.Error("the measured $100k threshold")
	}
	if DeployableUSD(25_000_000, 0.01) != 250_000 || DeployableUSD(25_000_000, 0.05) != 1_250_000 {
		t.Error("participation is per client")
	}
	if DeployableUSD(0, DefaultParticipation) != 0 || DeployableUSD(math.NaN(), DefaultParticipation) != 0 {
		t.Error("no depth deploys nothing")
	}
}

func TestExpectedWeeklyUSD(t *testing.T) {
	assertClose(t, "weekly", ExpectedWeeklyUSD(0.003, 500_000), 1_500, 6)
	if !(ExpectedWeeklyUSD(0.0577, 10_000) < ExpectedWeeklyUSD(0.0027, 600_000)) {
		t.Error("rate alone does not decide")
	}
	if ExpectedWeeklyUSD(math.NaN(), 500_000) != 0 || ExpectedWeeklyUSD(0.003, math.NaN()) != 0 {
		t.Error("zero rather than NaN when either side is unknown")
	}
}

func TestRankByExpectedDollarsDeepModestOutranksShallowSpectacular(t *testing.T) {
	ranked := RankByExpectedDollars([]RankInput[string]{
		{Row: "shallow-spectacular", Evidence: rkEvidence(func(e *PairEvidence) { e.RatePerWeek = 0.0577; e.ThinnerLegOiUSD = 500_000 })},
		{Row: "deep-modest", Evidence: rkEvidence(func(e *PairEvidence) { e.RatePerWeek = 0.0027; e.ThinnerLegOiUSD = 30_000_000 })},
	}, rkPrior, DefaultParticipation)
	if ranked[0].Row != "deep-modest" || ranked[0].DeployableUSD != 600_000 {
		t.Fatalf("top %+v, want deep-modest at $600k", ranked[0])
	}
	if !(ranked[1].Score > ranked[0].Score) {
		t.Error("the rate ordering is the opposite")
	}
}

func TestRankByExpectedDollarsReportsDollarsAndRate(t *testing.T) {
	ranked := RankByExpectedDollars([]RankInput[string]{{Row: "x", Evidence: rkEvidence(nil)}}, rkPrior, DefaultParticipation)
	if ranked[0].DeployableUSD != 500_000 {
		t.Errorf("deployable %v, want 500000", ranked[0].DeployableUSD)
	}
	assertClose(t, "weekly", ranked[0].ExpectedWeeklyUSD, ranked[0].Score*500_000, 6)
}

func TestRankByExpectedDollarsOrderIsStable(t *testing.T) {
	rows := []RankInput[string]{{Row: "a", Evidence: rkEvidence(nil)}, {Row: "b", Evidence: rkEvidence(nil)}, {Row: "c", Evidence: rkEvidence(nil)}}
	values := func() []float64 {
		out := []float64{}
		for _, r := range RankByExpectedDollars(rows, rkPrior, DefaultParticipation) {
			out = append(out, r.ExpectedWeeklyUSD)
		}
		return out
	}
	if first, again := values(), values(); !reflect.DeepEqual(first, again) {
		t.Errorf("order changed between runs: %v then %v", first, again)
	}
	// Stability is also directly visible: equal rows keep their input order.
	ranked := RankByExpectedDollars(rows, rkPrior, DefaultParticipation)
	if ranked[0].Row != "a" || ranked[1].Row != "b" || ranked[2].Row != "c" {
		t.Errorf("tied rows reordered: %v %v %v", ranked[0].Row, ranked[1].Row, ranked[2].Row)
	}
}

func TestRankByExpectedDollarsNoDepthRanksLast(t *testing.T) {
	ranked := RankByExpectedDollars([]RankInput[string]{
		{Row: "no-depth", Evidence: rkEvidence(func(e *PairEvidence) { e.RatePerWeek = 0.05; e.ThinnerLegOiUSD = 0 })},
		{Row: "real", Evidence: rkEvidence(nil)},
	}, rkPrior, DefaultParticipation)
	if ranked[1].Row != "no-depth" || ranked[1].ExpectedWeeklyUSD != 0 {
		t.Errorf("last %+v, want no-depth at 0", ranked[1])
	}
}

func TestChurnArithmetic(t *testing.T) {
	drag := 0.71 * 0.002
	gross := 0.003
	assertClose(t, "drag", drag*52, 0.0738, 4)
	assertClose(t, "gross", gross*52, 0.156, 3)
	if ratio := drag / gross; !(ratio > 0.45 && ratio < 0.5) {
		t.Errorf("drag/gross %v, want between 0.45 and 0.5", ratio)
	}
	if ShouldSwitch(0.003, 0.003*1.1, SwitchBand(0.002, 4, BandCubeRootC)) {
		t.Error("the band blocks a switch of the size that churns")
	}
}
