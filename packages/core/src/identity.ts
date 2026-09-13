/**
 * Price verification: does a market actually track the asset it is filed under?
 *
 * This is Layer 3 of the symbol identity refactor. `screener_pairs` drops any leg sitting further
 * than `DIVERGENCE_TRIGGER` from its asset's anchor, and a silent filter of exactly that kind is
 * how `CAT` (a memecoin and Caterpillar, 387,440,758x apart) survived undetected for so long. So
 * the gate makes ONE call -- listed or not -- and this module supplies the reason behind it, which
 * /status prints. The decision and the explanation share one threshold so they cannot disagree.
 *
 * Every threshold below was measured on live data (2026-09-14, 6h of minute bars, 29 diverging
 * markets across 899 multi-venue pools) and is pre-registered in migration 015 before use.
 */

/**
 * What the evidence says about one market's membership of its asset pool.
 *
 * `scale` and `tracks` both mean "same underlying, different units" and differ only in whether the
 * factor is a standard contract scale. That difference is deliberate: a clean power of ten is
 * mechanically explainable and could drive a `multiplier`, whereas an arbitrary constant is a
 * question for a human. Neither one is ever applied automatically -- see the migration.
 */
export type IdentityVerdict = "scale" | "tracks" | "mismatch" | "unverified";

/** One market's price behaviour measured against its pool's anchor. */
export interface DivergenceEvidence {
  /** The member's latest mark divided by the anchor's, both already per unit of the base asset. */
  priceRatio: number;
  /**
   * Pearson correlation of minute log-returns against the anchor. Null when either series never
   * moved, which is a real state rather than a zero: a frozen price correlates with nothing.
   */
  returnCorr: number | null;
  /** Minute buckets in which both the member and the anchor reported a mark. */
  sharedMinutes: number;
  /** Buckets in which the member's own mark actually changed. */
  memberMoves: number;
  /** Buckets in which the anchor's mark actually changed. */
  anchorMoves: number;
}

export interface IdentityCheck {
  verdict: IdentityVerdict;
  /** `n` where `priceRatio` is approximately 10^n. Null unless the verdict is `scale`. */
  scaleExponent: number | null;
}

/**
 * How far a member's mark may sit from the anchor's before it is worth verifying.
 *
 * Measured across 899 multi-venue pools: 860 agree within 2%, 18 more within 5%, 2 more within
 * 10%, and then nothing at all until QNT at 1.32x. The band is therefore empty either side of this
 * figure, so the exact value is not load-bearing -- 10% simply sits in the middle of the gap.
 *
 * Note this is NOT the screener's 5% mark-agreement guard and must not be conflated with it. That
 * one asks "are these two prices close enough to trade against each other"; this one asks "are
 * these the same asset at all", and a 9% disagreement (okx and lighter on OPENAI) answers yes.
 */
export const DIVERGENCE_TRIGGER = 0.1;

/** Minute buckets both sides must share before a correlation means anything. */
export const MIN_SHARED_MINUTES = 60;

/**
 * Buckets each side must actually MOVE in before a low correlation is read as evidence.
 *
 * The guard is a move count, not a volatility floor, and the difference matters: hl-mkts' US500 is
 * a genuine 10x contract whose anchor had a return sd of 0.000073 -- the second-quietest series in
 * the whole sample -- and it still scored 0.842 because both sides moved on 226 and 263 of 358
 * bars. A volatility floor would have thrown that away. lighter's BYD is the case this actually
 * catches: its mark did not move once in six hours, so its correlation is null, not low.
 */
export const MIN_MOVES = 30;

/**
 * The correlation at which a member is accepted as tracking the anchor.
 *
 * The live separation is wide enough that any value in the middle works: three markets scored
 * 0.823-0.855 (okx ANTHROPIC, hl-mkts US500, okx OPENAI -- all verified 10x contracts) and the
 * next highest of the remaining 26 was 0.183. Nothing has ever been observed in between.
 */
export const TRACKING_CORR = 0.5;

/** How close to a power of ten a ratio must sit to be read as a contract-size variant. */
export const SCALE_TOLERANCE = 0.05;

/**
 * `n` where `ratio` is approximately 10^n, or null if it is not near a power of ten.
 *
 * An exponent of zero is never returned: a ratio near 1 is agreement, not a scale variance.
 */
export function nearPowerOfTen(ratio: number, tolerance = SCALE_TOLERANCE): number | null {
  if (!(ratio > 0) || !Number.isFinite(ratio)) return null;
  const lg = Math.log10(ratio);
  const exponent = Math.round(lg);
  if (exponent === 0) return null;
  return Math.abs(lg - exponent) <= Math.log10(1 + tolerance) ? exponent : null;
}

/**
 * Whether a member sits far enough from the anchor to need verifying.
 *
 * Compared in log space so the test is symmetric. `abs(ratio - 1)` is not: a member at 1.10x the
 * anchor would be flagged while the very same pair viewed from the other side, at 0.909x, would
 * not, and which market happens to be the anchor is an open-interest accident.
 */
export function diverges(priceRatio: number): boolean {
  if (!(priceRatio > 0) || !Number.isFinite(priceRatio)) return false;
  return Math.abs(Math.log(priceRatio)) > Math.log(1 + DIVERGENCE_TRIGGER);
}

/**
 * Classifies one diverging market against its pool's anchor.
 *
 * Correlation decides, and the ratio only refines. That order is the whole finding: a near-10^n
 * ratio is a COINCIDENCE and not evidence. gate's PURR sits at 104.6x (within tolerance of 100x)
 * on a correlation of 0.005, aster's MEME at 93.6x on -0.002, and five BB markets at 0.00105
 * (within tolerance of 1/1000) on 0.019-0.038. Classifying by ratio alone -- which is what the
 * refactor plan originally specified -- would have set a 1000x multiplier and merged BlackBerry
 * into BounceBit, the exact failure this layer exists to prevent.
 */
export function classifyDivergence(evidence: DivergenceEvidence): IdentityCheck {
  const { priceRatio, returnCorr, sharedMinutes, memberMoves, anchorMoves } = evidence;

  const unverified: IdentityCheck = { verdict: "unverified", scaleExponent: null };
  if (!(priceRatio > 0) || !Number.isFinite(priceRatio)) return unverified;
  if (returnCorr === null || !Number.isFinite(returnCorr)) return unverified;
  if (sharedMinutes < MIN_SHARED_MINUTES) return unverified;
  if (memberMoves < MIN_MOVES || anchorMoves < MIN_MOVES) return unverified;

  if (returnCorr < TRACKING_CORR) return { verdict: "mismatch", scaleExponent: null };

  const exponent = nearPowerOfTen(priceRatio);
  return exponent === null
    ? { verdict: "tracks", scaleExponent: null }
    : { verdict: "scale", scaleExponent: exponent };
}
