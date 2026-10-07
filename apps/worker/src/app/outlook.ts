/**
 * The odds behind the liquidations "Odds" tab: what an asset's own volatility says about where price
 * can get to in 4 hours, 6 hours, a day and a week, and what the liquidation theories would add.
 *
 * WHAT IS CLAIMED, AND WHAT IS NOT. Every probability this module returns is a driftless random-walk
 * first-passage probability: given how far the asset has actually been moving per hour, how likely is
 * it to touch a level, or to touch one before the other. That is arithmetic on a measured volatility,
 * not a forecast of direction. The probability that price is higher at the close of any horizon is 0.5
 * until a theory earns a weight.
 *
 * THE THEORIES ARE READINGS, NOT INPUTS. Liquidation burst flow, funding crowding and stretch from the
 * EMA are each turned into a signed score in [-1, 1] ("which way the hypothesis leans") and shown
 * beside the odds. They enter the odds only through TILT_WEIGHTS, and every weight is zero. A weight
 * becomes non-zero when its theory clears a pre-registered out-of-sample test (profit factor > 1.1 and
 * Sharpe > 0.5 after costs, with enough trades), and not before: a liquidation heatmap that has not
 * beaten the base rate is a stop location, not a direction. Setting a weight is therefore the single,
 * reviewable act that lets a theory move a number on the page, and a test pins that zero means zero.
 *
 * THE MODEL'S KNOWN WEAKNESSES, stated here so the page can state them too:
 *   - Fat tails. Real returns are heavier-tailed than a normal, so the far levels are reached MORE
 *     often than the table says, and the near ones slightly less.
 *   - Volatility is measured over the window the tab was given, one reference market's closes, and
 *     assumed constant over the horizon. After a quiet week it understates a volatile one.
 *   - The levels are where forced closes HAPPENED, not where open positions would be liquidated. Those
 *     positions are gone. The collector has no open-interest-by-price, so the resting map the
 *     magnet theory needs does not exist yet, and its row says so.
 */

import type { CvdBar, LiquidationAssetCell, LiquidationSidePoint, MarketRow } from "./data";

export const OUTLOOK_HORIZONS = [
  { id: "4h", hours: 4 },
  { id: "6h", hours: 6 },
  { id: "1d", hours: 24 },
  { id: "1w", hours: 168 },
] as const;
export type OutlookHorizonId = (typeof OUTLOOK_HORIZONS)[number]["id"];

/** A week of closes at half-hour bars: what the volatility and the stretch reading are measured over. */
export const OUTLOOK_WINDOW_HOURS = 168;
export const OUTLOOK_BAR_MINUTES = 30;

/** Fixed moves, in percent, whose touch probability the table always shows. */
export const OUTLOOK_MOVES = [1, 2, 5, 10] as const;

export const OUTLOOK_THEORIES = ["burst", "crowding", "stretch"] as const;
export type OutlookTheoryId = (typeof OUTLOOK_THEORIES)[number];

/**
 * How much each theory moves the odds that price is higher at the close, per horizon, in log-odds per
 * unit of score. ALL ZERO. See the header: this is the one place a theory is allowed to matter, and
 * it matters only after it has passed its test.
 */
export const TILT_WEIGHTS: Record<OutlookHorizonId, Record<OutlookTheoryId, number>> = {
  "4h": { burst: 0, crowding: 0, stretch: 0 },
  "6h": { burst: 0, crowding: 0, stretch: 0 },
  "1d": { burst: 0, crowding: 0, stretch: 0 },
  "1w": { burst: 0, crowding: 0, stretch: 0 },
};

// ---------------------------------------------------------------------------------------------
// Normal distribution

/**
 * The upper tail of the standard normal, P(Z > x), by Abramowitz & Stegun 26.2.17 (absolute error
 * under 7.5e-8). Computed as a tail rather than as 1 - Phi so a far level keeps its small
 * probability instead of rounding to zero.
 */
export function normalTail(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  if (x < 0) return 1 - normalTail(-x);
  const t = 1 / (1 + 0.2316419 * x);
  const poly =
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return Math.exp((-x * x) / 2) * 0.3989422804014327 * poly;
}

/** P(a driftless walk touches a level `distance` away, by the time its 1-sigma spread is `sigma`). */
export function touchProbability(distance: number, sigma: number): number {
  if (!(distance > 0)) return 1;
  if (!(sigma > 0)) return 0;
  return Math.min(1, 2 * normalTail(distance / sigma));
}

/**
 * For a driftless walk between a lower barrier `down` and an upper barrier `up` (both positive, in
 * the same log units as `sigma`), the probability that the lower one is hit first within the horizon,
 * that the upper one is, and that neither is.
 *
 * Eigenfunction expansion of the exit flux on (0, L), L = down + up, starting at `down` from the
 * lower wall. Written in its damped form, which converges fast for any spread:
 *
 *   P_lower(T) = (1 - down/L) - sum over n >= 1 of 2/(n pi) * sin(n pi down / L) * exp(-s^2 n^2 pi^2 / (2 L^2))
 *
 * where s is the walk's 1-sigma spread over the horizon. The leading term is the gambler's-ruin
 * answer up/L, which is what it converges to as s grows; with the far barrier pushed out it
 * converges to the one-barrier reflection result 2 * (1 - Phi(down / s)). Both are pinned by tests.
 */
export function firstPassage(
  down: number,
  up: number,
  sigma: number,
): { down: number; up: number; neither: number } {
  if (!(down > 0) || !(up > 0) || !(sigma > 0)) {
    return { down: 0, up: 0, neither: 1 };
  }
  const length = down + up;
  const side = (start: number): number => {
    // A wall further than 9 sigma away is reached with probability under 1e-18: skip the series.
    if (start / sigma > 9) return 0;
    // The damping exp(-s^2 n^2 pi^2 / (2 L^2)) is negligible from n ~ 1.6 L / s.
    const terms = Math.min(50_000, Math.ceil((1.6 * length) / sigma) + 10);
    let sum = 0;
    for (let n = 1; n <= terms; n++) {
      const k = (n * Math.PI) / length;
      sum += (2 / (n * Math.PI)) * Math.sin(k * start) * Math.exp(-(sigma * sigma * k * k) / 2);
    }
    return Math.min(1, Math.max(0, 1 - start / length - sum));
  };
  const lower = side(down);
  const upper = side(up);
  // The two exits are exclusive; any series error that pushes the sum past 1 is trimmed.
  const total = lower + upper;
  const scale = total > 1 ? 1 / total : 1;
  return { down: lower * scale, up: upper * scale, neither: Math.max(0, 1 - total * scale) };
}

// ---------------------------------------------------------------------------------------------
// Volatility

export interface Volatility {
  /** One standard deviation of the log return over one hour: multiply by sqrt(hours) for a horizon. */
  perSqrtHour: number;
  /** Returns behind the figure. */
  returns: number;
  /** Hours of price history those returns span. */
  spanHours: number;
}

/** A single log return this large between two bars is a bad print, not a market. */
const MAX_STEP = 0.5;
const MIN_RETURNS = 24;
const MIN_SPAN_HOURS = 12;

type PricedBar = Pick<CvdBar, "bucket_start" | "price">;

/**
 * Realized volatility per root-hour from consecutive closes: sum of squared log returns over the sum
 * of the hours they span (so unequal spacing does not bias it). No mean is removed, which at these
 * horizons is the same as assuming no drift. A gap much longer than the usual bar spacing is skipped
 * rather than counted as one huge move, and so is an implausible step.
 *
 * Null when there is too little price to say anything: 24 returns across at least 12 hours.
 */
export function realizedVolatility(bars: readonly PricedBar[]): Volatility | null {
  const priced = bars
    .filter((bar) => bar.price !== null && bar.price > 0)
    .map((bar) => ({ t: bar.bucket_start.getTime(), p: bar.price as number }))
    .sort((a, b) => a.t - b.t);
  if (priced.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < priced.length; i++) {
    gaps.push(((priced[i] as { t: number }).t - (priced[i - 1] as { t: number }).t) / 3_600_000);
  }
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] as number;
  const longest = Math.max(median * 3, 1 / 12);

  let squares = 0;
  let hours = 0;
  let returns = 0;
  for (let i = 1; i < priced.length; i++) {
    const gap = gaps[i - 1] as number;
    if (!(gap > 0) || gap > longest) continue;
    const step = Math.log((priced[i] as { p: number }).p / (priced[i - 1] as { p: number }).p);
    if (!Number.isFinite(step) || Math.abs(step) > MAX_STEP) continue;
    squares += step * step;
    hours += gap;
    returns += 1;
  }
  if (returns < MIN_RETURNS || hours < MIN_SPAN_HOURS) return null;
  return { perSqrtHour: Math.sqrt(squares / hours), returns, spanHours: hours };
}

// ---------------------------------------------------------------------------------------------
// Levels: where forced closes clustered

export interface LiquidationLevel {
  /** Below or above the mark. */
  side: "below" | "above";
  /** The band's price distance from the mark, as a fraction (0.021 is 2.1%). A catch-all uses its near edge. */
  distance: number;
  /** The level's price: the band's centre, or the near edge of a catch-all. */
  price: number;
  usd: number;
  /** Share of everything closed in the window, 0..1. */
  share: number;
  /** True when this is an outer catch-all row, so the real level is at least this far out. */
  open: boolean;
}

/**
 * The heaviest price band on each side of the mark, from the same signed band cells the priced grid
 * draws: band b is [b w, (b+1) w) percent of the mark, so -1 is the band just below it and 0 the one
 * just above, and the two outermost bands are catch-alls.
 *
 * "Heaviest" is by dollars closed, both sides summed. It answers "where did the most forced closing
 * happen", which is what a reader means by a liquidation level; it does not say positions remain.
 */
export function heaviestLevels(options: {
  cells: readonly Pick<LiquidationAssetCell, "band" | "notional_usd">[];
  bandPct: number;
  reach: number;
  mark: number;
}): { below: LiquidationLevel | null; above: LiquidationLevel | null } {
  const { cells, bandPct, reach, mark } = options;
  const width = bandPct / 100;
  const byBand = new Map<number, number>();
  let all = 0;
  for (const cell of cells) {
    byBand.set(cell.band, (byBand.get(cell.band) ?? 0) + cell.notional_usd);
    all += cell.notional_usd;
  }
  if (!(all > 0) || !(width > 0) || !(mark > 0)) return { below: null, above: null };

  let below: LiquidationLevel | null = null;
  let above: LiquidationLevel | null = null;
  for (const [band, usd] of byBand) {
    if (!(usd > 0)) continue;
    const side = band < 0 ? "below" : "above";
    const open = band === reach || band === -reach;
    // Distance to the band's near edge for a catch-all (the level is at least that far), and to its
    // centre otherwise. band 0 starts at the mark, band -1 ends at it.
    let distance: number;
    if (band >= 0) distance = open ? reach * width : (band + 0.5) * width;
    else distance = open ? (reach - 1) * width : -(band + 0.5) * width;
    if (!(distance > 0)) continue;
    const level: LiquidationLevel = {
      side,
      distance,
      price: side === "below" ? mark * (1 - distance) : mark * (1 + distance),
      usd,
      share: usd / all,
      open,
    };
    if (side === "below") {
      if (below === null || usd > below.usd) below = level;
    } else if (above === null || usd > above.usd) above = level;
  }
  return { below, above };
}

// ---------------------------------------------------------------------------------------------
// Theory readings

export type TheoryStatus =
  /** Has a pre-registered sign; shown, but weighted zero until it passes its test. */
  | "unvalidated"
  /** Shown for context. Its claim is contemporaneous or conditioning only, so it never leans. */
  | "context"
  /** Cannot be computed from the data the collector keeps. */
  | "unavailable";

export interface TheoryReading {
  id: OutlookTheoryId | "absorption" | "sentiment" | "magnet";
  status: TheoryStatus;
  /** The measured quantity, in the unit the id implies; null when there was not enough to read. */
  value: number | null;
  /** Which way the hypothesis leans, -1 (down) to +1 (up). Null for context rows and missing data. */
  score: number | null;
  /** A second figure some rows carry (price change over the same window, for absorption). */
  detail: number | null;
}

const clamp = (value: number, low = -1, high = 1) => Math.min(high, Math.max(low, value));
const HOUR = 3_600_000;

/** Longs and shorts force-closed over the last `hours`: (longs - shorts) / both, and the event count. */
export function burstImbalance(
  sides: readonly LiquidationSidePoint[],
  now: number,
  hours: number,
): { value: number; events: number; usd: number } | null {
  let long = 0;
  let short = 0;
  let events = 0;
  for (const point of sides) {
    if (point.bucket_start.getTime() + 1 > now - hours * HOUR) {
      long += point.long_usd;
      short += point.short_usd;
      events += point.events;
    }
  }
  const usd = long + short;
  return usd > 0 ? { value: (long - short) / usd, events, usd } : null;
}

/** Fewer forced closes than this in four hours is too thin to call a burst. */
const MIN_BURST_EVENTS = 5;
/** An annualised funding rate this far from zero (percent) saturates the crowding score. Unfitted. */
const CROWDING_SCALE_APR = 50;
/** A stretch this many bar-sigmas from the EMA saturates the stretch score. Unfitted. */
const STRETCH_SCALE = 3;
/** The EMA's span: 50 hours, as the pre-registered stretch row defines it. */
const EMA_HOURS = 50;

export function theoryReadings(input: {
  bars: readonly CvdBar[];
  sides: readonly LiquidationSidePoint[];
  volatility: Volatility | null;
  /** Open-interest-weighted funding for the asset, in percent per year, or null. */
  fundingApr: number | null;
  sentimentScore: number | null;
  now: number;
}): TheoryReading[] {
  const { bars, sides, volatility, fundingApr, sentimentScore, now } = input;

  // Burst: the pre-registered claim is a FADE. Net long liquidations are forced sells into a falling
  // book; once they are done the pressure is exhausted, so the hypothesis leans up (and the reverse).
  const burst = burstImbalance(sides, now, 4);
  const burstReading: TheoryReading = {
    id: "burst",
    status: "unvalidated",
    value: burst && burst.events >= MIN_BURST_EVENTS ? burst.value : null,
    score: burst && burst.events >= MIN_BURST_EVENTS ? clamp(burst.value) : null,
    detail: burst ? burst.usd : null,
  };

  // Crowding: funding fade. Longs paying shorts means the long side is crowded, so it leans down.
  const crowdingReading: TheoryReading = {
    id: "crowding",
    status: "unvalidated",
    value: fundingApr,
    score: fundingApr === null ? null : clamp(-fundingApr / CROWDING_SCALE_APR),
    detail: null,
  };

  // Stretch: close less its 50-hour EMA, in units of one bar's volatility. The pre-registered claim
  // is a fade (negative slope), so a close far above the EMA leans down.
  const priced = bars.filter((bar) => bar.price !== null && bar.price > 0);
  let stretchValue: number | null = null;
  if (priced.length >= 2 && volatility) {
    const first = priced[0] as CvdBar;
    const second = priced[1] as CvdBar;
    const barHours = Math.max(
      (second.bucket_start.getTime() - first.bucket_start.getTime()) / HOUR,
      1 / 60,
    );
    const alpha = 2 / (EMA_HOURS / barHours + 1);
    let ema = first.price as number;
    for (const bar of priced) ema += alpha * ((bar.price as number) - ema);
    const last = (priced[priced.length - 1] as CvdBar).price as number;
    const barSigma = volatility.perSqrtHour * Math.sqrt(barHours);
    if (barSigma > 0 && priced.length * barHours >= EMA_HOURS) {
      stretchValue = (last - ema) / (ema * barSigma);
    }
  }
  const stretchReading: TheoryReading = {
    id: "stretch",
    status: "unvalidated",
    value: stretchValue,
    score: stretchValue === null ? null : clamp(-stretchValue / STRETCH_SCALE),
    detail: null,
  };

  // Absorption: net taker dollars over four hours against how far price moved. Contemporaneous only
  // in the pre-registered claim, so it is context and never leans.
  const recent = bars.filter((bar) => bar.bucket_start.getTime() + 1 > now - 4 * HOUR);
  const buy = recent.reduce((sum, bar) => sum + bar.buy_usd, 0);
  const sell = recent.reduce((sum, bar) => sum + bar.sell_usd, 0);
  const recentPriced = recent.filter((bar) => bar.price !== null && bar.price > 0);
  const change =
    recentPriced.length >= 2
      ? Math.log(
          ((recentPriced[recentPriced.length - 1] as CvdBar).price as number) /
            ((recentPriced[0] as CvdBar).price as number),
        )
      : null;
  const absorption: TheoryReading = {
    id: "absorption",
    status: "context",
    value: buy + sell > 0 ? (buy - sell) / (buy + sell) : null,
    score: null,
    detail: change,
  };

  const sentiment: TheoryReading = {
    id: "sentiment",
    status: "context",
    value: sentimentScore,
    score: null,
    detail: null,
  };

  const magnet: TheoryReading = {
    id: "magnet",
    status: "unavailable",
    value: null,
    score: null,
    detail: null,
  };

  return [burstReading, crowdingReading, stretchReading, absorption, sentiment, magnet];
}

/**
 * P(price is higher at the close of the horizon): 0.5 shifted by the weighted theory scores in
 * log-odds. With every weight at zero this is exactly 0.5, whatever the readings say.
 */
export function probabilityUp(
  horizon: OutlookHorizonId,
  readings: readonly TheoryReading[],
  weights: Record<OutlookHorizonId, Record<OutlookTheoryId, number>> = TILT_WEIGHTS,
): number {
  let logOdds = 0;
  for (const reading of readings) {
    if (reading.score === null || reading.status !== "unvalidated") continue;
    const weight = weights[horizon][reading.id as OutlookTheoryId] ?? 0;
    logOdds += weight * reading.score;
  }
  return 1 / (1 + Math.exp(-logOdds));
}

// ---------------------------------------------------------------------------------------------
// The whole table

export interface HorizonOdds {
  id: OutlookHorizonId;
  hours: number;
  /** One standard deviation of the move over the horizon, as a fraction of price. */
  sigma: number;
  up: number;
  /** Touch probability of the heaviest level on each side, or null where there is none. */
  touchBelow: number | null;
  touchAbove: number | null;
  /** First to be touched, between those two levels. Null unless both exist. */
  first: { below: number; above: number; neither: number } | null;
  /** Touch probability of a fixed move either way. */
  moves: { pct: number; below: number; above: number }[];
}

function orderedFirst(below: number, above: number, sigma: number) {
  const p = firstPassage(below, above, sigma);
  return { below: p.down, above: p.up, neither: p.neither };
}

export interface Outlook {
  volatility: Volatility;
  mark: number;
  levels: { below: LiquidationLevel | null; above: LiquidationLevel | null };
  horizons: HorizonOdds[];
  readings: TheoryReading[];
}

export function buildOutlook(input: {
  mark: number | null;
  bars: readonly CvdBar[];
  cells: readonly Pick<LiquidationAssetCell, "band" | "notional_usd">[];
  sides: readonly LiquidationSidePoint[];
  bandPct: number;
  reach: number;
  fundingApr: number | null;
  sentimentScore: number | null;
  now: number;
}): Outlook | null {
  const { mark, bars, cells, sides, bandPct, reach, fundingApr, sentimentScore, now } = input;
  if (mark === null || !(mark > 0)) return null;
  const volatility = realizedVolatility(bars);
  if (volatility === null) return null;

  const levels = heaviestLevels({ cells, bandPct, reach, mark });
  const readings = theoryReadings({ bars, sides, volatility, fundingApr, sentimentScore, now });
  const logDistance = {
    below: (fraction: number) => -Math.log(1 - fraction),
    above: (fraction: number) => Math.log(1 + fraction),
  };

  const horizons = OUTLOOK_HORIZONS.map((horizon): HorizonOdds => {
    const sigma = volatility.perSqrtHour * Math.sqrt(horizon.hours);
    const below = levels.below ? logDistance.below(levels.below.distance) : null;
    const above = levels.above ? logDistance.above(levels.above.distance) : null;
    return {
      id: horizon.id,
      hours: horizon.hours,
      sigma,
      up: probabilityUp(horizon.id, readings),
      touchBelow: below === null ? null : touchProbability(below, sigma),
      touchAbove: above === null ? null : touchProbability(above, sigma),
      first: below !== null && above !== null ? orderedFirst(below, above, sigma) : null,
      moves: OUTLOOK_MOVES.map((pct) => ({
        pct,
        below: touchProbability(logDistance.below(pct / 100), sigma),
        above: touchProbability(logDistance.above(pct / 100), sigma),
      })),
    };
  });

  return { volatility, mark, levels, horizons, readings };
}

/**
 * The asset's funding across its markets, in percent a year, weighted by open interest. A market
 * with no open interest figure carries no weight, so it cannot pull the average toward a venue
 * nobody is trading on. Null when no market has any.
 */
export function openInterestWeightedApr(
  markets: readonly Pick<MarketRow, "apr" | "open_interest_usd">[],
): number | null {
  let weighted = 0;
  let weight = 0;
  for (const market of markets) {
    const oi = market.open_interest_usd;
    if (oi === null || !(oi > 0) || !Number.isFinite(market.apr)) continue;
    weighted += market.apr * oi;
    weight += oi;
  }
  return weight > 0 ? weighted / weight : null;
}
