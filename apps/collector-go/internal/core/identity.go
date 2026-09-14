package core

// Price verification: does a market actually track the asset it is filed under?
//
// Ported from packages/core/src/identity.ts, which is the authority and carries the measurements
// behind every threshold (pre-registered in migration 015). Correlation decides and the price ratio
// only refines: a near-10^n ratio is a coincidence, not evidence.

import "math"

// IdentityVerdict is what the evidence says about one market's membership of its asset pool.
type IdentityVerdict string

const (
	VerdictScale      IdentityVerdict = "scale"
	VerdictTracks     IdentityVerdict = "tracks"
	VerdictMismatch   IdentityVerdict = "mismatch"
	VerdictUnverified IdentityVerdict = "unverified"
)

// DivergenceEvidence is one market's price behaviour measured against its pool's anchor.
type DivergenceEvidence struct {
	// PriceRatio is the member's latest mark divided by the anchor's, both per unit of the base.
	PriceRatio float64
	// ReturnCorr is the Pearson correlation of minute log-returns, nil when either series never
	// moved: a frozen price correlates with nothing, which is not a correlation of zero.
	ReturnCorr *float64
	// SharedMinutes is minute buckets in which both sides reported a mark.
	SharedMinutes int
	MemberMoves   int
	AnchorMoves   int
}

type IdentityCheck struct {
	Verdict IdentityVerdict
	// ScaleExponent is n where PriceRatio is about 10^n. Nil unless the verdict is scale.
	ScaleExponent *int
}

// DivergenceTrigger is how far a member's mark may sit from the anchor's before it is verified.
// Not the screener's 5% mark-agreement guard.
const DivergenceTrigger = 0.1

// MinSharedMinutes is the minute buckets both sides must share before a correlation means anything.
const MinSharedMinutes = 60

// MinMoves is the buckets each side must actually move in before a low correlation is evidence.
const MinMoves = 30

// TrackingCorr is the correlation at which a member is accepted as tracking the anchor.
const TrackingCorr = 0.5

// ScaleTolerance is how close to a power of ten a ratio must sit to read as a contract-size variant.
const ScaleTolerance = 0.05

// NearPowerOfTen returns n where ratio is about 10^n. ok is false when it is not near one, and an
// exponent of zero is never returned: a ratio near 1 is agreement. Pass ScaleTolerance for tolerance.
func NearPowerOfTen(ratio, tolerance float64) (exponent int, ok bool) {
	if !(ratio > 0) || !isFinite(ratio) {
		return 0, false
	}
	lg := math.Log10(ratio)
	rounded := jsRound(lg)
	if rounded == 0 {
		return 0, false
	}
	if math.Abs(lg-rounded) <= math.Log10(1+tolerance) {
		return int(rounded), true
	}
	return 0, false
}

// Diverges reports whether a member sits far enough from the anchor to need verifying, compared in
// log space so which market is the anchor cannot change the answer.
func Diverges(priceRatio float64) bool {
	if !(priceRatio > 0) || !isFinite(priceRatio) {
		return false
	}
	return math.Abs(math.Log(priceRatio)) > math.Log(1+DivergenceTrigger)
}

// ClassifyDivergence classifies one diverging market against its pool's anchor.
func ClassifyDivergence(evidence DivergenceEvidence) IdentityCheck {
	unverified := IdentityCheck{Verdict: VerdictUnverified}
	if !(evidence.PriceRatio > 0) || !isFinite(evidence.PriceRatio) {
		return unverified
	}
	if evidence.ReturnCorr == nil || !isFinite(*evidence.ReturnCorr) {
		return unverified
	}
	if evidence.SharedMinutes < MinSharedMinutes {
		return unverified
	}
	if evidence.MemberMoves < MinMoves || evidence.AnchorMoves < MinMoves {
		return unverified
	}

	if *evidence.ReturnCorr < TrackingCorr {
		return IdentityCheck{Verdict: VerdictMismatch}
	}

	exponent, ok := NearPowerOfTen(evidence.PriceRatio, ScaleTolerance)
	if !ok {
		return IdentityCheck{Verdict: VerdictTracks}
	}
	return IdentityCheck{Verdict: VerdictScale, ScaleExponent: &exponent}
}
