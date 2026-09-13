import type { BacktestFees } from "./backtest";

/**
 * What one venue costs a particular account.
 *
 * Fees are per ACCOUNT, not per venue: CEX VIP levels key off 30-day volume, Hyperliquid tiers off
 * 14-day volume, and staking or referral discounts move them again. So nothing here carries a
 * default. A venue the schedule does not mention is **unknown**, which is not the same as free, and
 * every function below returns null rather than inventing a number — the same discipline that makes
 * `backtestPair` report `costsUsd: null` instead of a flattering figure.
 */
export interface VenueFees {
  /** Taker fee in basis points. Zero is a real answer: some venues rebate takers. */
  takerBps: number;
  /**
   * Cost of moving the asset off this venue, in USD.
   *
   * Optional because it is paid only when a position has to be rebalanced afterwards, and because
   * most accounts have never configured it. Null means unknown, not zero.
   */
  withdrawalUsd?: number | null;
}

/** A member's fee schedule, keyed by venue id. An absent venue is unknown, never free. */
export type FeeSchedule = Readonly<Record<string, VenueFees>>;

/** One venue's fees, or null when the schedule does not cover it with a usable number. */
export function venueFees(
  schedule: FeeSchedule | null | undefined,
  venueId: string,
): VenueFees | null {
  const fees = schedule?.[venueId];
  return fees && Number.isFinite(fees.takerBps) ? fees : null;
}

export interface GapCost {
  /** The quoted gap, before any cost. */
  gapBps: number;
  /** The two taker fees added together, or null when either venue is unconfigured. */
  takerBps: number | null;
  /** A fixed transfer cost as basis points of `sizeUsd`; null when the cost or the size is unknown. */
  transferBps: number | null;
  /**
   * `gapBps - takerBps - (transferBps ?? 0)`, or null when the taker fees are unknown.
   *
   * The asymmetry is deliberate. Taker fees are unconditional — both fills happen — so a missing one
   * makes the whole figure meaningless and it goes null. A transfer is conditional: it is paid only
   * to rebalance afterwards, so an unconfigured withdrawal cost leaves `netBps` computed WITHOUT it
   * and reports `transferBps: null` alongside.
   *
   * **Anything rendering `netBps` while `transferBps` is null must say the transfer is not counted.**
   * A net figure that silently omits a cost is exactly the flattering number this codebase refuses
   * everywhere else.
   */
  netBps: number | null;
}

/**
 * What a quoted price gap is worth after costs.
 *
 * **Two fills, not four.** `backtestPair` charges four because a funding carry opens *and closes*
 * both legs. A price gap is captured by buying on one venue and selling on the other, once. And the
 * gap itself is already computed bid-to-ask, so both venues' own spreads are crossed inside
 * `gapBps` and must not be charged a second time. Reusing the four-fill model here would roughly
 * double the cost and understate every row.
 */
export function gapCost(input: {
  gapBps: number;
  buyVenueId: string;
  sellVenueId: string;
  fees: FeeSchedule | null | undefined;
  /** Notional of the trade. Needed only to express a fixed transfer cost in basis points. */
  sizeUsd?: number;
}): GapCost {
  const buy = venueFees(input.fees, input.buyVenueId);
  const sell = venueFees(input.fees, input.sellVenueId);
  const takerBps = buy === null || sell === null ? null : buy.takerBps + sell.takerBps;

  // The asset sits on the venue it was bought at, so that is the withdrawal actually paid.
  const withdrawalUsd = buy?.withdrawalUsd ?? null;
  const size = input.sizeUsd;
  const transferBps =
    withdrawalUsd === null || size === undefined || !(size > 0)
      ? null
      : (withdrawalUsd / size) * 10_000;

  return {
    gapBps: input.gapBps,
    takerBps,
    transferBps,
    netBps: takerBps === null ? null : input.gapBps - takerBps - (transferBps ?? 0),
  };
}

/**
 * The two-leg shape `backtestPair` takes, drawn from a member's schedule.
 *
 * Here so the lookup and the "unknown is not zero" rule live in ONE place: the pair page, the price
 * views and the execution worker all resolve fees identically, while `backtestPair` keeps its own
 * four-fill model and stays ignorant of where the numbers came from.
 */
export function backtestFeesFrom(
  schedule: FeeSchedule | null | undefined,
  longVenueId: string,
  shortVenueId: string,
): BacktestFees | null {
  const long = venueFees(schedule, longVenueId);
  const short = venueFees(schedule, shortVenueId);
  return long === null || short === null
    ? null
    : { longTakerBps: long.takerBps, shortTakerBps: short.takerBps };
}
