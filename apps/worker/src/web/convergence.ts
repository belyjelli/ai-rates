/**
 * The arithmetic behind a price-convergence pair (convergence-page.ts): long the cheaper exchange,
 * short the dearer, and wait for the two marks to meet. Pure functions over numbers, so every figure
 * the page prints can be tested without a page.
 *
 * The spread is (short mark - long mark) / long mark, in percent: positive when the short leg is the
 * dearer, which is the side a convergence trade earns from. History is hourly, from the collector's
 * price rollup (market_price_hourly, migration 021): each hour's average mark, so a spike that came
 * and went inside one hour is smoothed away, and the page says so.
 */

export interface PriceHour {
  hourMs: number;
  /** The hour's average mark, or its average index where the venue publishes no mark (HTX, BitMart). */
  price: number | null;
  /** Snapshots folded into the hour; a healthy market reads 60 (one a minute). */
  samples: number;
}

export interface SpreadPoint {
  atMs: number;
  pct: number;
}

/** The hours both legs priced, as the spread between them. An hour either leg missed is left out. */
export function spreadSeries(
  long: readonly PriceHour[],
  short: readonly PriceHour[],
): SpreadPoint[] {
  const shortAt = new Map(short.map((h) => [h.hourMs, h.price]));
  const points: SpreadPoint[] = [];
  for (const l of long) {
    const s = shortAt.get(l.hourMs);
    if (l.price === null || s === null || s === undefined || !(l.price > 0)) continue;
    points.push({ atMs: l.hourMs, pct: ((s - l.price) / l.price) * 100 });
  }
  return points.sort((a, b) => a.atMs - b.atMs);
}

/** The q-quantile (0..1) of sorted values, interpolated between neighbours. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (at - lo);
}

export interface SpreadStats {
  /** Hours with a spread, against the hours the window holds. */
  samples: number;
  expected: number;
  median: number;
  mean: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  std: number;
  /** Share of the window's hours whose spread sat below `current`, 0..1; null without a current. */
  rank: number | null;
}

export function spreadStats(
  points: readonly SpreadPoint[],
  windowHours: number,
  current: number | null,
): SpreadStats | null {
  if (points.length === 0) return null;
  const values = points.map((p) => p.pct);
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return {
    samples: values.length,
    expected: windowHours + 1,
    median: quantile(sorted, 0.5),
    mean,
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    min: sorted[0] as number,
    max: sorted[sorted.length - 1] as number,
    std: Math.sqrt(variance),
    rank: current === null ? null : values.filter((v) => v < current).length / values.length,
  };
}

export interface HoldEstimate {
  /** Times the spread rose to today's width and later fell back to the exit level. */
  episodes: number;
  /** Times it rose to today's width and had not fallen back by the window's end. */
  unfinished: number;
  /** Hours from reaching today's width to reaching the exit level: median and middle half. */
  medianHours: number;
  p25Hours: number;
  p75Hours: number;
}

/**
 * How long a spread this wide has taken to come back, from the window's own history: every time the
 * spread rose to at least `current`, the hours until it next fell to `exit` (the window's median,
 * since full convergence to zero is rare and waiting for it usually makes no sense). Hourly data, so
 * no episode is shorter than an hour. Null when the spread is already at or below the exit level, or
 * there are fewer than three finished episodes to estimate from.
 */
export function holdTime(
  points: readonly SpreadPoint[],
  current: number,
  exit: number,
): HoldEstimate | null {
  if (!(current > exit)) return null;
  const hours: number[] = [];
  let unfinished = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as SpreadPoint;
    const before = points[i - 1];
    if (p.pct < current || (before !== undefined && before.pct >= current)) continue;
    const back = points.slice(i + 1).find((q) => q.pct <= exit);
    if (back) hours.push(Math.max(1, (back.atMs - p.atMs) / 3_600_000));
    else unfinished++;
  }
  if (hours.length < 3) return null;
  const sorted = hours.sort((a, b) => a - b);
  return {
    episodes: sorted.length,
    unfinished,
    medianHours: quantile(sorted, 0.5),
    p25Hours: quantile(sorted, 0.25),
    p75Hours: quantile(sorted, 0.75),
  };
}

export interface Scenario {
  /** The spread the trade is closed at, in percent. */
  target: number;
  gross: number;
  fees: number;
  /** Each venue's bid-ask crossed in and out, from the top of the books; null when either is unknown. */
  crossing: number | null;
  /** Funding over the hold, signed: what the pair is paid (+) or pays (-). */
  funding: number;
  net: number;
}

export interface ScenarioInput {
  sizeUsd: number;
  /** The spread now, percent. */
  current: number;
  /** Taker fees, basis points per fill. */
  longTakerBps: number;
  shortTakerBps: number;
  /** Each venue's own bid-ask spread in basis points; null when not quoted. */
  longBookBps: number | null;
  shortBookBps: number | null;
  /** Funding APRs in percent: positive means that market's longs pay. */
  longApr: number | null;
  shortApr: number | null;
  holdHours: number;
}

/**
 * What closing at each target would make on `sizeUsd` per leg. Gross is the spread given back between
 * now and the target; fees are four taker fills (in and out of both legs); crossing is each venue's
 * bid-ask, half on the way in and half on the way out; funding is the short leg's rate less the long
 * leg's over the hold, since the long pays its rate and the short receives its own.
 */
export function scenarios(input: ScenarioInput, targets: readonly number[]): Scenario[] {
  const fees = (input.sizeUsd * (input.longTakerBps + input.shortTakerBps) * 2) / 10_000;
  const crossing =
    input.longBookBps === null || input.shortBookBps === null
      ? null
      : (input.sizeUsd * (input.longBookBps + input.shortBookBps)) / 10_000;
  const funding =
    input.longApr === null || input.shortApr === null
      ? 0
      : (input.sizeUsd * (input.shortApr - input.longApr) * input.holdHours) / 100 / 8_760;
  return targets.map((target) => {
    const gross = (input.sizeUsd * (input.current - target)) / 100;
    return {
      target,
      gross,
      fees,
      crossing,
      funding,
      net: gross - fees - (crossing ?? 0) + funding,
    };
  });
}

/** The spread move that pays the round trip's costs, in percent of one leg. */
export function breakevenPct(s: Scenario, sizeUsd: number): number {
  return ((s.fees + (s.crossing ?? 0)) / sizeUsd) * 100;
}
