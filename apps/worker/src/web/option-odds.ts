import type { OptionChainRead } from "../app/data";

/**
 * What Deribit's option chain implies for Bitcoin being above a price at a moment: the risk-neutral
 * probability, for setting beside a prediction market's ladder (web/crowd.ts).
 *
 * THE MODEL. Deribit marks its options with Black-76 at a zero rate on each expiry's forward, which
 * is how the chain is stored (collector migration 049). Under it the chance of finishing above K is
 * minus the call price's slope in K:
 *
 *   P(S > K) = N(d2) − K·φ(d2)·√τ·∂σ/∂K,   d2 = (ln(F/K) − σ²τ/2) / (σ√τ)
 *
 * The second term is the smile: with puts dearer than calls (the usual skew) it lowers the chance of
 * the upside against a flat-volatility reading. σ at K is read off each expiry's smile from its
 * out-of-the-money options (calls at and above the forward, puts below), linearly in strike and flat
 * beyond the last strike listed.
 *
 * BETWEEN EXPIRIES. A prediction market settles at its own hour (Polymarket's Bitcoin ladders at
 * noon New York), between Deribit's 08:00 UTC expiries. Total variance σ²τ is interpolated linearly
 * in time between the expiries either side, and so is the forward; before the first expiry its
 * volatility is used for the shorter time.
 */

const YEAR_MS = 365.25 * 86_400_000;

interface Smile {
  expiry: number;
  forward: number;
  /** [strike, iv], ascending strike. */
  points: [number, number][];
}

/** Each expiry's forward and out-of-the-money smile, soonest first. */
export function smiles(chain: OptionChainRead): Smile[] {
  const byExpiry = new Map<number, [number, number, boolean, number, number][]>();
  for (const o of chain.options) {
    const list = byExpiry.get(o[0]) ?? [];
    list.push(o);
    byExpiry.set(o[0], list);
  }
  const out: Smile[] = [];
  for (const [expiry, list] of byExpiry) {
    const forwards = list.map((o) => o[4]).sort((a, b) => a - b);
    const forward = forwards[Math.floor(forwards.length / 2)] as number;
    const byStrike = new Map<number, number[]>();
    for (const [, strike, isCall, iv] of list) {
      const otm = isCall ? strike >= forward : strike < forward;
      if (!otm || !(iv > 0)) continue;
      const ivs = byStrike.get(strike) ?? [];
      ivs.push(iv);
      byStrike.set(strike, ivs);
    }
    const points = [...byStrike]
      .map(([k, ivs]) => [k, ivs.reduce((a, b) => a + b, 0) / ivs.length] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    if (points.length >= 2) out.push({ expiry, forward, points });
  }
  return out.sort((a, b) => a.expiry - b.expiry);
}

/** The smile's volatility at a strike: linear between listed strikes, flat beyond them. */
export function ivAt(points: readonly [number, number][], strike: number): number {
  const first = points[0] as [number, number];
  const last = points[points.length - 1] as [number, number];
  if (strike <= first[0]) return first[1];
  if (strike >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const b = points[i] as [number, number];
    if (strike <= b[0]) {
      const a = points[i - 1] as [number, number];
      return a[1] + ((strike - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    }
  }
  return last[1];
}

/** The standard normal's density and distribution (Abramowitz–Stegun 7.1.26 for erf, 1.5e-7). */
const phi = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
export function normCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** The forward and total variance at a strike for a moment, from the smiles either side of it. */
function varianceAt(
  list: readonly Smile[],
  at: number,
  now: number,
  strike: number,
): { forward: number; w: number; tau: number } | null {
  const tau = (at - now) / YEAR_MS;
  if (!(tau > 0)) return null;
  const after = list.find((s) => s.expiry >= at);
  if (!after) return null;
  const before = [...list].reverse().find((s) => s.expiry < at && s.expiry > now);
  const tauAfter = (after.expiry - now) / YEAR_MS;
  const wAfter = ivAt(after.points, strike) ** 2 * tauAfter;
  if (!before) {
    // Before the first expiry: its volatility over the shorter time.
    return { forward: after.forward, w: ivAt(after.points, strike) ** 2 * tau, tau };
  }
  const tauBefore = (before.expiry - now) / YEAR_MS;
  const wBefore = ivAt(before.points, strike) ** 2 * tauBefore;
  const f = (tau - tauBefore) / (tauAfter - tauBefore);
  return {
    forward: before.forward + f * (after.forward - before.forward),
    w: wBefore + f * (wAfter - wBefore),
    tau,
  };
}

/**
 * The options' probability that Bitcoin is above `strike` at `at` (epoch ms), from the smiles; null
 * when the chain does not reach that far or has no smile.
 */
export function optionsAbove(
  list: readonly Smile[],
  at: number,
  strike: number,
  now: number,
): number | null {
  const v = varianceAt(list, at, now, strike);
  if (!v || !(v.w > 0) || !(strike > 0)) return null;
  const sd = Math.sqrt(v.w);
  const sigma = sd / Math.sqrt(v.tau);
  const d2 = (Math.log(v.forward / strike) - v.w / 2) / sd;
  // The smile's slope at the strike, by a central difference on the interpolated volatility.
  const h = strike * 0.005;
  const up = varianceAt(list, at, now, strike + h);
  const down = varianceAt(list, at, now, strike - h);
  const slope = up && down ? (Math.sqrt(up.w / v.tau) - Math.sqrt(down.w / v.tau)) / (2 * h) : 0;
  const p = normCdf(d2) - strike * phi(d2) * Math.sqrt(v.tau) * slope;
  return Number.isFinite(p) && sigma > 0 ? Math.min(1, Math.max(0, p)) : null;
}

/** The price the options give even odds of being above at `at`: the risk-neutral median. */
export function optionsMedian(list: readonly Smile[], at: number, now: number): number | null {
  const v = varianceAt(list, at, now, list[0]?.forward ?? 0);
  if (!v) return null;
  let lo = v.forward * 0.5;
  let hi = v.forward * 1.5;
  const pLo = optionsAbove(list, at, lo, now);
  const pHi = optionsAbove(list, at, hi, now);
  if (pLo === null || pHi === null || pLo < 0.5 || pHi > 0.5) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const p = optionsAbove(list, at, mid, now) ?? 0.5;
    if (p > 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Where a ladder of "above K" probabilities crosses even odds, the probabilities first made
 * non-increasing in strike (a thin market can price a higher strike above a lower one). Null when
 * every rung is on one side.
 */
export function ladderMedian(rungs: readonly { strike: number; p: number }[]): number | null {
  const sorted = [...rungs].sort((a, b) => a.strike - b.strike);
  let held = 1;
  const mono = sorted.map((r) => {
    held = Math.min(held, r.p);
    return { strike: r.strike, p: held };
  });
  for (let i = 1; i < mono.length; i++) {
    const a = mono[i - 1] as { strike: number; p: number };
    const b = mono[i] as { strike: number; p: number };
    if (a.p >= 0.5 && b.p < 0.5) {
      const t = a.p === b.p ? 0.5 : (a.p - 0.5) / (a.p - b.p);
      return a.strike + t * (b.strike - a.strike);
    }
  }
  return null;
}
