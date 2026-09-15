package core

// Ranking engine for the carry book: what a pair is worth, whether it is worth switching to a
// better one, and how many dollars it can actually absorb.
//
// Ported from packages/core/src/ranking.ts, which is the authority; the design and the measurements
// behind every constant live in plans/ranking-system-design.md. Everything here is pure. SQL gathers
// the evidence; this decides.
//
// Go has no default arguments, so every function takes its parameters explicitly and the TypeScript
// defaults are exported as constants for callers to pass.

import (
	"math"
	"sort"
)

// PairEvidence is one pair's realised evidence over the scoring window.
type PairEvidence struct {
	// RatePerWeek is realised funding per dollar of notional per week, gross of fees.
	RatePerWeek float64
	// ChargeDays is the charging days behind that figure. A float so a non-finite value can be
	// represented, as the TypeScript number can.
	ChargeDays float64
	// ThinnerLegOiUSD is open interest on the thinner of the two legs. All capacity comes from this.
	ThinnerLegOiUSD float64
}

// ShrinkageK is the shrinkage weight, following migration 009's precedent for stability_30d.
const ShrinkageK = 10.0

// DefaultParticipation is the fraction of the thinner leg's open interest one position may take.
const DefaultParticipation = 0.02

// DefaultHorizonWeeks is how long a position is assumed held, which a switch must pay back over.
const DefaultHorizonWeeks = 4.0

// BandCubeRootC is the coefficient on the no-trade band's cube-root term. Zero until calibrated.
const BandCubeRootC = 0.0

func isFinite(x float64) bool {
	return !math.IsNaN(x) && !math.IsInf(x, 0)
}

// Score is the expected rate per dollar per week, shrunk toward prior by the evidence behind it.
// Pass ShrinkageK for k. NaN in, NaN out.
func Score(evidence PairEvidence, prior, k float64) float64 {
	if !isFinite(evidence.RatePerWeek) || !isFinite(prior) {
		return math.NaN()
	}
	n := 0.0
	if isFinite(evidence.ChargeDays) && evidence.ChargeDays > 0 {
		n = evidence.ChargeDays
	}
	return (n*evidence.RatePerWeek + k*prior) / (n + k)
}

// SwitchBand is how much better a challenger must be before switching pays for the round trip.
// Pass DefaultHorizonWeeks and BandCubeRootC for the TypeScript defaults.
func SwitchBand(costPerDollar, horizonWeeks, c float64) float64 {
	if !(costPerDollar > 0) || !isFinite(costPerDollar) {
		return 0
	}
	weeks := DefaultHorizonWeeks
	if horizonWeeks > 0 {
		weeks = horizonWeeks
	}
	payback := costPerDollar / weeks
	optimal := 0.0
	if c > 0 {
		optimal = c * math.Cbrt(costPerDollar)
	}
	return math.Max(payback, optimal)
}

// ShouldSwitch reports whether to move from the incumbent to a challenger. A tie holds.
func ShouldSwitch(incumbentScore, challengerScore, band float64) bool {
	if !isFinite(incumbentScore) {
		return isFinite(challengerScore)
	}
	if !isFinite(challengerScore) {
		return false
	}
	return challengerScore-incumbentScore > math.Max(0, band)
}

// ShouldExit reports whether to drop the incumbent outright. Easier to leave than to switch.
func ShouldExit(incumbentScore, exitFloor float64) bool {
	if !isFinite(incumbentScore) {
		return true
	}
	return incumbentScore <= exitFloor
}

// DeployableUSD is the dollars one position may take from the thinner leg's depth. Pass
// DefaultParticipation for the TypeScript default; a non-positive or NaN participation falls back
// to it, as in TypeScript.
func DeployableUSD(thinnerLegOiUSD, participation float64) float64 {
	if !(thinnerLegOiUSD > 0) || !isFinite(thinnerLegOiUSD) {
		return 0
	}
	rate := DefaultParticipation
	if participation > 0 {
		rate = participation
	}
	return thinnerLegOiUSD * rate
}

// ExpectedWeeklyUSD is expected dollars per week, which the ranking sorts on. Zero, never NaN.
func ExpectedWeeklyUSD(scorePerWeek, deployable float64) float64 {
	if !isFinite(scorePerWeek) || !isFinite(deployable) {
		return 0
	}
	return scorePerWeek * deployable
}

// RankInput is one row with the evidence to rank it on.
type RankInput[T any] struct {
	Row      T
	Evidence PairEvidence
}

// RankedPair carries everything the ranking needs to order a pair.
type RankedPair[T any] struct {
	Row               T
	Score             float64
	DeployableUSD     float64
	ExpectedWeeklyUSD float64
}

// RankByExpectedDollars ranks by expected dollars per week, then score, then deployable size.
//
// The comparator mirrors `a || b || c` over JavaScript differences: a zero or NaN difference falls
// through to the next key, and a final NaN counts as equal. Sorting is stable, as in TypeScript.
func RankByExpectedDollars[T any](pairs []RankInput[T], prior, participation float64) []RankedPair[T] {
	ranked := make([]RankedPair[T], len(pairs))
	for i, pair := range pairs {
		s := Score(pair.Evidence, prior, ShrinkageK)
		deployable := DeployableUSD(pair.Evidence.ThinnerLegOiUSD, participation)
		ranked[i] = RankedPair[T]{
			Row:               pair.Row,
			Score:             s,
			DeployableUSD:     deployable,
			ExpectedWeeklyUSD: ExpectedWeeklyUSD(s, deployable),
		}
	}
	sort.SliceStable(ranked, func(i, j int) bool {
		a, b := ranked[i], ranked[j]
		for _, diff := range []float64{
			b.ExpectedWeeklyUSD - a.ExpectedWeeklyUSD,
			b.Score - a.Score,
			b.DeployableUSD - a.DeployableUSD,
		} {
			if diff != 0 && !math.IsNaN(diff) {
				return diff < 0
			}
		}
		return false
	})
	return ranked
}
