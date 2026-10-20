import type { GammaBandHit, GammaExpiry } from "../app/data";

/**
 * The expected move (the "IV walls"): the range one and two standard deviations either side of the
 * price that a book's options have priced in, for a few horizons. Pure: the Gamma Exposure tab
 * (gamma.ts) draws it as a mind map and the whale chart's GEX switch (whales.ts) as bands.
 *
 * THE FORMULA. move = price x IV x sqrt(T), with T in 365-day years: every source here quotes its IV
 * per calendar year (Deribit and Cboe do; the exchanges' settlement-implied ones are backed out the
 * same way), so a day is 1/365 of one whatever the market's trading hours. The walls are the price
 * plus and minus one move and two.
 *
 * WHICH IV. Each expiry's at-the-money IV at its forward (collector gamma.AtmIV). A horizon between
 * two expiries takes the total variance (IV squared times T) interpolated linearly between them, the
 * standard way to read a term structure at a date it does not list; before the first expiry or past
 * the last, that expiry's IV.
 *
 * WHAT IT IS NOT. A normal distribution's 68% and 95%: real moves have fat tails and IV usually runs
 * above the volatility that follows. The band check (collector bands.go) measures how often BTC and
 * ETH really ended inside, and the tab shows that beside the textbook figure. The walls are centred on
 * the spot and symmetric: the skew (puts dearer than calls) is not read into them.
 */

export const YEAR_MS = 365 * 86_400_000;

export type MoveHorizon = "next" | "1d" | "7d" | "30d";

/** The fixed horizons, with the band check's horizon in days that matches each. */
export const FIXED_HORIZONS: readonly [MoveHorizon, number][] = [
  ["1d", 1],
  ["7d", 7],
  ["30d", 30],
];

export interface ExpectedMove {
  horizon: MoveHorizon;
  /** How far ahead, from the book's as-of time. */
  ms: number;
  /** For "next", the expiry it runs to. */
  expiry: Date | null;
  /** The IV the move is drawn from, a fraction a year. */
  iv: number;
  /** One standard deviation, as a fraction of the price and in the price's units. */
  pct: number;
  move: number;
  /** The walls: one and two deviations below and above the price. */
  low1: number;
  high1: number;
  low2: number;
  high2: number;
  /** The band check at the same horizon, when the book has one. */
  hits: GammaBandHit | null;
}

interface Point {
  /** Years to expiry. */
  t: number;
  iv: number;
}

/** The expiries still ahead of `at` that have an IV, as (years, IV), nearest first. */
export function termStructure(expiries: readonly GammaExpiry[], at: number): Point[] {
  return expiries
    .filter((x) => x.atm_iv !== null && x.atm_iv > 0 && x.expiry.getTime() > at)
    .map((x) => ({ t: (x.expiry.getTime() - at) / YEAR_MS, iv: x.atm_iv as number }))
    .sort((a, b) => a.t - b.t);
}

/** The IV for a horizon of `t` years: total variance interpolated between the expiries either side. */
export function horizonIv(points: readonly Point[], t: number): number | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || !(t > 0)) return null;
  if (t <= first.t) return first.iv;
  if (t >= last.t) return last.iv;
  for (let i = 1; i < points.length; i++) {
    const b = points[i] as Point;
    if (b.t < t) continue;
    const a = points[i - 1] as Point;
    const wa = a.iv * a.iv * a.t;
    const wb = b.iv * b.iv * b.t;
    const w = wa + ((wb - wa) * (t - a.t)) / (b.t - a.t);
    return Math.sqrt(Math.max(0, w) / t);
  }
  return last.iv;
}

/** The move and walls for `iv` over `ms`, around `price`. */
export function moveFor(
  price: number,
  iv: number,
  ms: number,
): Pick<ExpectedMove, "pct" | "move" | "low1" | "high1" | "low2" | "high2"> {
  const pct = iv * Math.sqrt(ms / YEAR_MS);
  const move = price * pct;
  return {
    pct,
    move,
    low1: price - move,
    high1: price + move,
    low2: Math.max(0, price - 2 * move),
    high2: price + 2 * move,
  };
}

/**
 * A book's expected moves: to its next expiry, then one day, one week and 30 days. Empty when no
 * expiry has an IV (a book read before the collector kept them, or one with no strike near its
 * forward).
 */
export function expectedMoves(input: {
  expiries: readonly GammaExpiry[];
  bands: readonly GammaBandHit[];
  spot: number;
  /** The book's as-of time: the read, or the close of its end-of-day file. */
  at: Date;
  nextExpiry: Date | null;
}): ExpectedMove[] {
  const at = input.at.getTime();
  const points = termStructure(input.expiries, at);
  if (points.length === 0 || !(input.spot > 0)) return [];
  const out: ExpectedMove[] = [];
  const next = input.nextExpiry;
  if (next !== null && next.getTime() > at) {
    const ms = next.getTime() - at;
    const iv = horizonIv(points, ms / YEAR_MS);
    if (iv !== null) {
      out.push({
        horizon: "next",
        ms,
        expiry: next,
        iv,
        ...moveFor(input.spot, iv, ms),
        hits: null,
      });
    }
  }
  for (const [horizon, days] of FIXED_HORIZONS) {
    const ms = days * 86_400_000;
    const iv = horizonIv(points, ms / YEAR_MS);
    if (iv === null) continue;
    out.push({
      horizon,
      ms,
      expiry: null,
      iv,
      ...moveFor(input.spot, iv, ms),
      hits: input.bands.find((b) => b.horizon_days === days) ?? null,
    });
  }
  return out;
}
