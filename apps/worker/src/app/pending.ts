/**
 * A model of the liquidations still waiting to happen, by price.
 *
 * NOT REPORTED BY ANY VENUE. No feed publishes per-position liquidation prices, and the collector
 * holds no order-book depth, so this is arithmetic over what it does hold: an asset's open interest.
 * The page says so beside the chart, and every assumption is a constant below so a reader can check
 * them against the numbers.
 *
 * THE ASSUMPTIONS, in the order they matter:
 *  - Open interest is split evenly between longs and shorts. Every position has a counterparty, so
 *    neither side can be the whole of it; which venues quote one side and which both is not
 *    published, and the even split is the one that never overstates either.
 *  - Leverage follows `LEVERAGE_MIX`: most of the money sits at 5-20x, a thin tail at 50-100x.
 *  - Entries are spread evenly across ±`ENTRY_SPREAD` around the current price, standing in for the
 *    positions opened over the last day or so. Entering at the mark exactly would pile every tier
 *    onto one band and draw a comb, not a shape.
 *  - A long is liquidated when the price falls to entry × (1 − 1/leverage + maintenance), a short
 *    when it rises to entry × (1 + 1/leverage − maintenance). Funding, fees and cross-margin are
 *    ignored.
 *
 * A position whose liquidation price is already past the mark would have been closed, so it is
 * dropped rather than counted: this is what is pending, not what has happened.
 */

/** [leverage, share of the side's open interest]. Shares sum to 1. */
export const LEVERAGE_MIX: readonly (readonly [number, number])[] = [
  [2, 0.05],
  [3, 0.1],
  [5, 0.15],
  [10, 0.25],
  [20, 0.2],
  [50, 0.17],
  [100, 0.08],
];

/** Maintenance margin as a fraction of notional. */
export const MAINTENANCE = 0.005;

/** Entries are placed evenly over ± this fraction of the mark. */
export const ENTRY_SPREAD = 0.05;

/** Entry points per tier. Odd, so one of them is the mark itself. */
const ENTRY_STEPS = 21;

/** Rows each side of the mark, one percent each. */
export const PENDING_ROWS = 10;

export interface PendingBands {
  /** Dollars of longs that fall into each 1% row below the mark; index 0 is the row nearest it. */
  longs: number[];
  /** Dollars of shorts in each 1% row above the mark; index 0 is the row nearest it. */
  shorts: number[];
  longTotal: number;
  shortTotal: number;
}

export function pendingBands(openInterestUsd: number | null): PendingBands {
  const longs = new Array<number>(PENDING_ROWS).fill(0);
  const shorts = new Array<number>(PENDING_ROWS).fill(0);
  if (openInterestUsd !== null && openInterestUsd > 0) {
    const side = openInterestUsd / 2;
    for (const [leverage, share] of LEVERAGE_MIX) {
      const each = (side * share) / ENTRY_STEPS;
      for (let i = 0; i < ENTRY_STEPS; i++) {
        const entry = 1 + ENTRY_SPREAD * ((2 * i) / (ENTRY_STEPS - 1) - 1);
        const below = (1 - entry * (1 - 1 / leverage + MAINTENANCE)) * 100;
        const above = (entry * (1 + 1 / leverage - MAINTENANCE) - 1) * 100;
        if (below > 0 && below < PENDING_ROWS) longs[Math.floor(below)] += each;
        if (above > 0 && above < PENDING_ROWS) shorts[Math.floor(above)] += each;
      }
    }
  }
  return {
    longs,
    shorts,
    longTotal: longs.reduce((sum, usd) => sum + usd, 0),
    shortTotal: shorts.reduce((sum, usd) => sum + usd, 0),
  };
}
