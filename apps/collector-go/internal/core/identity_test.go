package core

import (
	"math"
	"testing"
)

// Vectors from packages/core/src/identity.test.ts.

func idCorr(v float64) *float64 { return &v }

// idObserved is the measured shape of a well-observed market.
func idObserved(over func(*DivergenceEvidence)) DivergenceEvidence {
	e := DivergenceEvidence{PriceRatio: 1, ReturnCorr: idCorr(0.9), SharedMinutes: 358, MemberMoves: 200, AnchorMoves: 200}
	if over != nil {
		over(&e)
	}
	return e
}

func assertPower(t *testing.T, ratio float64, want int, wantOK bool) {
	t.Helper()
	got, ok := NearPowerOfTen(ratio, ScaleTolerance)
	if ok != wantOK || (ok && got != want) {
		t.Errorf("NearPowerOfTen(%v) = %d, %v; want %d, %v", ratio, got, ok, want, wantOK)
	}
}

func assertVerdict(t *testing.T, e DivergenceEvidence, want IdentityVerdict, wantExponent *int) {
	t.Helper()
	got := ClassifyDivergence(e)
	if got.Verdict != want {
		t.Errorf("verdict %q, want %q for %+v", got.Verdict, want, e)
		return
	}
	switch {
	case wantExponent == nil && got.ScaleExponent != nil:
		t.Errorf("scale exponent %d, want nil", *got.ScaleExponent)
	case wantExponent != nil && (got.ScaleExponent == nil || *got.ScaleExponent != *wantExponent):
		t.Errorf("scale exponent %v, want %d", got.ScaleExponent, *wantExponent)
	}
}

func idExp(n int) *int { return &n }

func TestNearPowerOfTen(t *testing.T) {
	// The verified contract-size variants.
	assertPower(t, 0.09988, -1, true)
	assertPower(t, 0.10164, -1, true)
	assertPower(t, 0.10257, -1, true)
	// A ratio near 1 is agreement, not a scale variance.
	assertPower(t, 1, 0, false)
	assertPower(t, 1.02, 0, false)
	assertPower(t, 0.98, 0, false)
	// Near a power of ten by coincidence: this function cannot tell.
	assertPower(t, 104.64991, 2, true)
	assertPower(t, 0.00105, -3, true)
	// Not close enough.
	assertPower(t, 93.64393, 0, false)
	assertPower(t, 0.758, 0, false)
	assertPower(t, 547.89152, 0, false)
	// Not ratios.
	assertPower(t, 0, 0, false)
	assertPower(t, -10, 0, false)
	assertPower(t, math.NaN(), 0, false)
	assertPower(t, math.Inf(1), 0, false)
}

func TestDiverges(t *testing.T) {
	if !Diverges(1.2) || !Diverges(1/1.2) {
		t.Error("symmetric: 1.2 and its reciprocal both diverge")
	}
	if Diverges(1.05) || Diverges(1/1.05) {
		t.Error("5% either way does not diverge")
	}
	if Diverges(0) || Diverges(math.NaN()) {
		t.Error("non-ratios never diverge")
	}
}

func TestClassifyDivergenceScale(t *testing.T) {
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.MemberMoves, e.AnchorMoves = 0.09988, idCorr(0.842), 226, 263
	}), VerdictScale, idExp(-1))
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.MemberMoves, e.AnchorMoves = 0.10164, idCorr(0.855), 314, 357
	}), VerdictScale, idExp(-1))
}

func TestClassifyDivergenceMismatchOnANearPowerOfTen(t *testing.T) {
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.MemberMoves, e.AnchorMoves = 104.64991, idCorr(0.005), 241, 262
	}), VerdictMismatch, nil)
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.MemberMoves, e.AnchorMoves = 0.00105, idCorr(0.03), 321, 185
	}), VerdictMismatch, nil)
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.MemberMoves, e.AnchorMoves = 93.64393, idCorr(-0.002), 282, 281
	}), VerdictMismatch, nil)
}

func TestClassifyDivergenceMismatchNeedNotBeLarge(t *testing.T) {
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.MemberMoves, e.AnchorMoves = 0.758, idCorr(0.183), 109, 280
	}), VerdictMismatch, nil)
}

func TestClassifyDivergenceFrozenPriceIsUnverified(t *testing.T) {
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.MemberMoves, e.AnchorMoves = 0.29526, nil, 0, 20
	}), VerdictUnverified, nil)
}

func TestClassifyDivergenceTooLittleOverlapOrMovement(t *testing.T) {
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) { e.PriceRatio, e.SharedMinutes = 10, 59 }), VerdictUnverified, nil)
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) { e.PriceRatio, e.MemberMoves = 10, 29 }), VerdictUnverified, nil)
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) { e.PriceRatio, e.AnchorMoves = 10, 29 }), VerdictUnverified, nil)
}

func TestClassifyDivergenceQuietMarketStillVerifies(t *testing.T) {
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.MemberMoves, e.AnchorMoves = 0.1, idCorr(0.842), 31, 31
	}), VerdictScale, idExp(-1))
}

func TestClassifyDivergenceTracks(t *testing.T) {
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) {
		e.PriceRatio, e.ReturnCorr, e.SharedMinutes = 0.75871, idCorr(0.603), 67
	}), VerdictTracks, nil)
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) { e.PriceRatio, e.ReturnCorr = 3, idCorr(0.95) }), VerdictTracks, nil)
}

func TestClassifyDivergenceNonRatiosAreUnverified(t *testing.T) {
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) { e.PriceRatio = 0 }), VerdictUnverified, nil)
	assertVerdict(t, idObserved(func(e *DivergenceEvidence) { e.PriceRatio = math.NaN() }), VerdictUnverified, nil)
}
