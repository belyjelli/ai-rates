/**
 * Ranking engine for the carry book: what a pair is worth, whether it is worth switching to a
 * better one, and how many dollars it can actually absorb.
 *
 * The design and the measurements behind every constant live in `plans/ranking-system-design.md`.
 * The short version, because it is the reason this module exists at all: the shipped ranking picks
 * each asset's WIDEST spread, which selects outliers by construction, and the recommended venue
 * pair then changes for 71% of assets overnight. At ~$20 per $10k round trip that is
 * 0.71 x 52 x $20 = $738 per $10k per year -- 7.4% of capital against a 15.6% size-weighted gross.
 * The ranking would destroy roughly half the return it advertises.
 *
 * Three separable jobs, in the order they run:
 *
 *   1. SCORE a pair from settled history, shrunk by sample size.
 *   2. DECIDE whether to leave the incumbent, using a no-trade band sized by what switching costs.
 *   3. SIZE the position from the thinner leg's depth, and rank by DOLLARS rather than by rate.
 *
 * Everything here is pure. SQL gathers the evidence; this decides -- the same split `backtestPair`
 * and `classifyDivergence` already follow, so there is one implementation of the arithmetic rather
 * than a second one in SQL that has to be kept in step.
 *
 * NOTHING HERE IS CALIBRATED TO AN OUTCOME YET. The constants are pre-registered defaults, set from
 * the figures in the design before any variant was compared, precisely so the evaluation is a test
 * rather than a search for confirmation.
 */

/** One pair's realised evidence over the scoring window. */
export interface PairEvidence {
  /** Realised funding over the window, per dollar of notional, per week. Gross of fees -- see `score`. */
  ratePerWeek: number;
  /** Charging days behind that figure. Four days must not outrank a month; see `score`. */
  chargeDays: number;
  /** Open interest on the THINNER of the two legs, in USD. All capacity comes from this. */
  thinnerLegOiUsd: number;
}

/**
 * Shrinkage weight, following the precedent migration 009 set for `stability_30d`.
 *
 * A pair that charged four times and got lucky must not outrank one with a month of evidence. With
 * k = 10 a 4-day pair observed at 1%/week against a 0.3% pool prior scores 0.5%, while a 30-day
 * pair with the same observation scores 0.83% -- the sparse one keeps a usable figure instead of
 * being discarded, and still loses to the well-evidenced one.
 */
export const SHRINKAGE_K = 10;

/**
 * Fraction of the thinner leg's open interest a single position may take.
 *
 * 2% is the pre-registered default. Measured 2026-09-13, the whole viable set absorbs $7.96M at
 * this rate: 13 pairs support a $100k position, 7 support $250k, 3 support $500k, and none has a
 * thinner leg above $50M. So $1M deploys comfortably, $5M is the edge, and $10M does not fit
 * without pushing to 4-5% and moving the book being traded. Per client: a patient book runs 1%, an
 * aggressive one 5% and accepts the impact.
 */
export const DEFAULT_PARTICIPATION = 0.02;

/** Weeks a position is assumed to be held, which is what a switch has to pay itself back over. */
export const DEFAULT_HORIZON_WEEKS = 4;

/**
 * Coefficient on the cube-root term of the no-trade band. **Zero until calibrated.**
 *
 * Corridor-rebalancing theory gives the optimal no-trade width as proportional to the cube root of
 * transaction costs. That shape is borrowed deliberately rather than invented -- but its constant
 * is not knowable before the shadow evaluation, and shipping an uncalibrated one would be exactly
 * the fitting the design forbids. At 0 the band reduces to the payback floor, which needs no
 * calibration because it is arithmetic: a switch must at least pay for itself.
 */
export const BAND_CUBE_ROOT_C = 0;

/**
 * Expected rate per dollar per week, shrunk toward a prior by how much evidence stands behind it.
 *
 * `prior` is the pool median rather than zero. Zero would be a claim that an unobserved pair pays
 * nothing, which is not what ignorance means here; the median says "absent evidence, assume this
 * pair is ordinary".
 *
 * Gross, not net. Entry fees are paid once whichever pair is chosen, so they cannot separate two
 * candidates -- what separates them is the cost of MOVING, and that belongs in the band rather than
 * the score. (The design's prose said "net of fees" here; that was imprecise, and charging a
 * one-off cost as a recurring drag would understate every pair equally while changing no ordering.)
 */
export function score(evidence: PairEvidence, prior: number, k: number = SHRINKAGE_K): number {
  const { ratePerWeek, chargeDays } = evidence;
  if (!Number.isFinite(ratePerWeek) || !Number.isFinite(prior)) return Number.NaN;
  const n = Number.isFinite(chargeDays) && chargeDays > 0 ? chargeDays : 0;
  return (n * ratePerWeek + k * prior) / (n + k);
}

/**
 * How much better a challenger must be before switching to it is worth the round trip.
 *
 * `costPerDollar` is the whole switch: exiting the incumbent and entering the challenger, four
 * fills, at the client's own fee tier. The floor is pure payback -- over `horizonWeeks` the
 * improvement must cover the cost, so it must exceed `cost / horizon` per week. At 20 bps and a
 * four-week hold that is 5 bps/week, against a measured 15.6% APR (~30 bps/week): a band worth
 * about a sixth of the weekly rate, which is real hysteresis rather than a rounding error.
 */
export function switchBand(
  costPerDollar: number,
  horizonWeeks: number = DEFAULT_HORIZON_WEEKS,
  c: number = BAND_CUBE_ROOT_C,
): number {
  if (!(costPerDollar > 0) || !Number.isFinite(costPerDollar)) return 0;
  const weeks = horizonWeeks > 0 ? horizonWeeks : DEFAULT_HORIZON_WEEKS;
  const payback = costPerDollar / weeks;
  const optimal = c > 0 ? c * Math.cbrt(costPerDollar) : 0;
  return Math.max(payback, optimal);
}

/**
 * Whether to move from the incumbent pair to a challenger.
 *
 * Strictly greater than the band, so a tie holds. Holding is the cheaper error: a switch that is
 * merely even costs the round trip and buys nothing.
 */
export function shouldSwitch(
  incumbentScore: number,
  challengerScore: number,
  band: number,
): boolean {
  if (!Number.isFinite(incumbentScore)) return Number.isFinite(challengerScore);
  if (!Number.isFinite(challengerScore)) return false;
  return challengerScore - incumbentScore > Math.max(0, band);
}

/**
 * Whether to drop the incumbent outright, with no challenger involved.
 *
 * Deliberately asymmetric: it is EASIER TO LEAVE THAN TO SWITCH. Without this, hysteresis happily
 * holds a decaying position forever, because no challenger ever clears the entry band on a pair
 * whose own score is collapsing. The exit floor is a level, not a comparison.
 */
export function shouldExit(incumbentScore: number, exitFloor: number): boolean {
  if (!Number.isFinite(incumbentScore)) return true;
  return incumbentScore <= exitFloor;
}

/** Dollars a single position may take, from the thinner leg's depth. */
export function deployableUsd(
  thinnerLegOiUsd: number,
  participation: number = DEFAULT_PARTICIPATION,
): number {
  if (!(thinnerLegOiUsd > 0) || !Number.isFinite(thinnerLegOiUsd)) return 0;
  const rate = participation > 0 ? participation : DEFAULT_PARTICIPATION;
  return thinnerLegOiUsd * rate;
}

/** Expected dollars per week from a pair, which is what the ranking sorts on. */
export function expectedWeeklyUsd(scorePerWeek: number, deployable: number): number {
  if (!Number.isFinite(scorePerWeek) || !Number.isFinite(deployable)) return 0;
  return scorePerWeek * deployable;
}

/** A pair carrying everything the ranking needs to order it. */
export interface RankedPair<T> {
  row: T;
  score: number;
  deployableUsd: number;
  expectedWeeklyUsd: number;
}

/**
 * Ranks pairs by EXPECTED DOLLARS PER WEEK, not by rate.
 *
 * This is the inversion the $1M-$10M book needs. A 300% APR pair good for $10k is noise to that
 * reader; a 14% pair good for $600k is the business. It costs almost nothing in rate to do this:
 * the measured correlation between depth and payout is 0.090, so selecting for capacity is close to
 * free -- which is the finding that makes capacity-first ranking cheap rather than a trade-off.
 *
 * Ties break on score, then on deployable size, so the order is total and stable across runs. An
 * unstable sort would reintroduce churn through the back door.
 */
export function rankByExpectedDollars<T>(
  pairs: readonly { row: T; evidence: PairEvidence }[],
  prior: number,
  participation: number = DEFAULT_PARTICIPATION,
): RankedPair<T>[] {
  return pairs
    .map(({ row, evidence }) => {
      const s = score(evidence, prior);
      const deployable = deployableUsd(evidence.thinnerLegOiUsd, participation);
      return {
        row,
        score: s,
        deployableUsd: deployable,
        expectedWeeklyUsd: expectedWeeklyUsd(s, deployable),
      };
    })
    .sort(
      (a, b) =>
        b.expectedWeeklyUsd - a.expectedWeeklyUsd ||
        b.score - a.score ||
        b.deployableUsd - a.deployableUsd,
    );
}
