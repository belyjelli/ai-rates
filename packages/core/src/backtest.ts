/**
 * Funding-carry backtest for one asset held long on one venue and short on another.
 *
 * What this measures: the funding actually settled on both legs over a window, summed at each leg's
 * own settlement times. Legs rarely share a cadence -- Hyperliquid settles BTC hourly while Bybit
 * settles it 8-hourly -- so nothing is resampled or forward-filled onto a common grid.
 *
 * Notional is held constant at `sizeUsd` per leg. The exact rule is qty x mark-at-settlement x rate,
 * but venue funding-history APIs return a rate and a timestamp and nothing else: of 371,170 stored
 * settlements only dydx's carry a mark. Rather than imply a precision the data cannot support, this
 * assumes a position rebalanced to `sizeUsd`, which is what the funding rate is charged against.
 * Price drift between settlements is therefore not modelled, and neither is basis PnL, which would
 * need mark history this project does not collect.
 */

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const DAYS_PER_YEAR = 365;
/** A gap longer than this multiple of the expected interval counts as missed settlements. */
const GAP_TOLERANCE = 1.5;

export interface BacktestSettlement {
  settledAt: number;
  /** Fraction over `basisHours`. Positive means longs pay shorts. */
  rate: number;
  basisHours: number;
}

export interface BacktestLeg {
  venueId: string;
  venueSymbol: string;
  /** Settled funding within the window, any order. */
  settlements: readonly BacktestSettlement[];
}

/** Taker fees in basis points, charged on entry and exit of each leg. */
export interface BacktestFees {
  longTakerBps: number;
  shortTakerBps: number;
}

export interface BacktestInput {
  long: BacktestLeg;
  short: BacktestLeg;
  /** Notional per leg. Capital committed is 2 x this, before leverage. */
  sizeUsd: number;
  fromMs: number;
  toMs: number;
  fees?: BacktestFees;
}

export interface LegResult {
  venueId: string;
  venueSymbol: string;
  settlements: number;
  /** Funding cashflow for this leg: negative when the position pays. */
  fundingUsd: number;
  /** This leg's own funding annualized over the window. */
  aprPercent: number;
  /** Settlements the cadence implies are missing, and the hours they span. */
  missedSettlements: number;
  missedHours: number;
}

export interface BacktestDay {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  netUsd: number;
}

export interface BacktestResult {
  fromMs: number;
  toMs: number;
  sizeUsd: number;
  days: number;
  long: LegResult;
  short: LegResult;
  /** Funding across both legs, before costs. */
  netFundingUsd: number;
  netFundingAprPercent: number;
  perDay: BacktestDay[];
  /** Days with positive net funding, as a share of days that had any settlement. */
  winRateDays: number;
  avgDailyUsd: number;
  /** Four taker fills: entry and exit on both legs. Null when fees weren't supplied. */
  costsUsd: number | null;
  netAfterCostsUsd: number | null;
  /** Days of average net funding needed to repay costs; null when it never repays. */
  paybackDays: number | null;
}

function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Cashflow for one settlement. The long leg pays when the rate is positive and is paid when it is
 * negative; the short leg is the mirror.
 */
function cashflow(sizeUsd: number, rate: number, side: "long" | "short"): number {
  return side === "long" ? -sizeUsd * rate : sizeUsd * rate;
}

/** Settlements the cadence implies are missing. A gap is never counted as zero funding. */
function findGaps(settlements: readonly BacktestSettlement[]): {
  missedSettlements: number;
  missedHours: number;
} {
  let missedSettlements = 0;
  let missedHours = 0;
  for (let i = 1; i < settlements.length; i++) {
    const previous = settlements[i - 1] as BacktestSettlement;
    const current = settlements[i] as BacktestSettlement;
    const expectedMs = previous.basisHours * MS_PER_HOUR;
    if (!(expectedMs > 0)) continue;
    const actualMs = current.settledAt - previous.settledAt;
    if (actualMs <= expectedMs * GAP_TOLERANCE) continue;
    missedSettlements += Math.round(actualMs / expectedMs) - 1;
    missedHours += (actualMs - expectedMs) / MS_PER_HOUR;
  }
  return { missedSettlements, missedHours };
}

function legResult(
  leg: BacktestLeg,
  side: "long" | "short",
  sizeUsd: number,
  days: number,
  daily: Map<string, number>,
): LegResult {
  const settlements = [...leg.settlements].sort((a, b) => a.settledAt - b.settledAt);
  let fundingUsd = 0;
  for (const settlement of settlements) {
    const amount = cashflow(sizeUsd, settlement.rate, side);
    fundingUsd += amount;
    const date = utcDate(settlement.settledAt);
    daily.set(date, (daily.get(date) ?? 0) + amount);
  }

  return {
    venueId: leg.venueId,
    venueSymbol: leg.venueSymbol,
    settlements: settlements.length,
    fundingUsd,
    aprPercent: days > 0 ? (fundingUsd / sizeUsd / days) * DAYS_PER_YEAR * 100 : 0,
    ...findGaps(settlements),
  };
}

/**
 * Replays both legs' settled funding over the window. Costs are only included when `fees` are
 * supplied: taker fees vary per venue and are not published consistently, so an assumed number
 * would be worse than an absent one.
 */
export function backtestPair(input: BacktestInput): BacktestResult {
  const { long, short, sizeUsd, fromMs, toMs, fees } = input;
  const days = Math.max(0, (toMs - fromMs) / MS_PER_DAY);
  const daily = new Map<string, number>();

  const longResult = legResult(long, "long", sizeUsd, days, daily);
  const shortResult = legResult(short, "short", sizeUsd, days, daily);
  return summarize({ fromMs, toMs, sizeUsd, days, fees }, longResult, shortResult, daily);
}

/** One market's funding for one UTC day, as the collector's `market_funding_daily` rollup holds it. */
export interface DailyFunding {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  /** The day's settled rates summed, each a fraction over its own basis. */
  rateSum: number;
  /** Hours the day's settlements cover: 24 when every one of them landed. */
  basisHoursSum: number;
  settlements: number;
}

export interface DailyLeg {
  venueId: string;
  venueSymbol: string;
  /** The market's rollup rows, any order. Rows outside the window are ignored. */
  days: readonly DailyFunding[];
}

export interface DailyBacktestInput {
  long: DailyLeg;
  short: DailyLeg;
  sizeUsd: number;
  /** Start of the window's first UTC day; see `dailyWindowStart`. */
  fromMs: number;
  toMs: number;
  fees?: BacktestFees;
}

/**
 * Start of an N-day window that ends with today: N calendar days, the last one still running. Whole
 * days, because that is the rollup's grain; a rolling 168 hours would need the raw settlements.
 */
export function dailyWindowStart(nowMs: number, days: number): number {
  const today = Math.floor(nowMs / MS_PER_DAY) * MS_PER_DAY;
  return today - (Math.max(1, Math.round(days)) - 1) * MS_PER_DAY;
}

/**
 * Settlements a leg is missing, read from its daily rollup rather than from gaps between individual
 * settlements. A complete day's settlements cover 24 hours, so a day's shortfall is missing
 * coverage, counted in settlements of the leg's typical interval.
 *
 * Only days the leg could have filled count. A day before its first record is not a gap -- a new
 * listing, or a backfill still arriving -- and neither is that first day when it starts inside the
 * window, since the listing may have begun partway through it. Days after its last record are not
 * counted either, matching the replay, which only sees gaps between settlements. And the window's
 * final day is still running, so it is never short.
 */
function dailyGaps(
  days: readonly DailyFunding[],
  firstDate: string,
  lastDate: string,
): { missedSettlements: number; missedHours: number } {
  const none = { missedSettlements: 0, missedHours: 0 };
  const recorded = days
    .filter((day) => day.settlements > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const settlements = recorded.reduce((sum, day) => sum + day.settlements, 0);
  const hours = recorded.reduce((sum, day) => sum + day.basisHoursSum, 0);
  const typical = settlements > 0 ? hours / settlements : 0;
  const first = recorded[0]?.date;
  const last = recorded.at(-1)?.date;
  if (!first || !last || !(typical > 0)) return none;

  const covered = new Map(recorded.map((day) => [day.date, day.basisHoursSum]));
  let missedSettlements = 0;
  let missedHours = 0;
  for (let ms = Date.parse(`${first}T00:00:00Z`); ; ms += MS_PER_DAY) {
    const date = utcDate(ms);
    if (date > last || date >= lastDate) break;
    if (date === first && first !== firstDate) continue;
    const shortfall = 24 - (covered.get(date) ?? 0);
    // Rounded to whole settlements, so float noise in the hour sums never reads as a gap.
    const missing = Math.round(shortfall / typical);
    if (missing <= 0) continue;
    missedSettlements += missing;
    missedHours += shortfall;
  }
  return { missedSettlements, missedHours };
}

function dailyLegResult(
  leg: DailyLeg,
  side: "long" | "short",
  sizeUsd: number,
  days: number,
  window: { firstDate: string; lastDate: string },
  daily: Map<string, number>,
): LegResult {
  const inWindow = leg.days.filter(
    (day) => day.date >= window.firstDate && day.date <= window.lastDate,
  );
  let fundingUsd = 0;
  let settlements = 0;
  for (const day of inWindow) {
    // Funding is linear in the rate, so a day's summed rate settles exactly what its settlements
    // would have one by one.
    const amount = cashflow(sizeUsd, day.rateSum, side);
    fundingUsd += amount;
    settlements += day.settlements;
    if (day.settlements > 0) daily.set(day.date, (daily.get(day.date) ?? 0) + amount);
  }

  return {
    venueId: leg.venueId,
    venueSymbol: leg.venueSymbol,
    settlements,
    fundingUsd,
    aprPercent: days > 0 ? (fundingUsd / sizeUsd / days) * DAYS_PER_YEAR * 100 : 0,
    ...dailyGaps(inWindow, window.firstDate, window.lastDate),
  };
}

/**
 * The same backtest as `backtestPair`, read from each market's daily rollup instead of replaying
 * every settlement: two markets times at most 60 small rows, which is what lets a request compute
 * it inside a Worker's CPU budget. The result has the same shape and the same funding, per-day and
 * cost figures; what differs is the window, which is whole UTC days, and gap detection, which works
 * from each day's covered hours rather than from the spacing of individual settlements.
 */
export function backtestDaily(input: DailyBacktestInput): BacktestResult {
  const { long, short, sizeUsd, fromMs, toMs, fees } = input;
  const days = Math.max(0, (toMs - fromMs) / MS_PER_DAY);
  const window = { firstDate: utcDate(fromMs), lastDate: utcDate(toMs) };
  const daily = new Map<string, number>();

  const longResult = dailyLegResult(long, "long", sizeUsd, days, window, daily);
  const shortResult = dailyLegResult(short, "short", sizeUsd, days, window, daily);
  return summarize({ fromMs, toMs, sizeUsd, days, fees }, longResult, shortResult, daily);
}

/** Everything both engines derive from the two legs and the per-day net, so they cannot drift. */
function summarize(
  window: { fromMs: number; toMs: number; sizeUsd: number; days: number; fees?: BacktestFees },
  longResult: LegResult,
  shortResult: LegResult,
  daily: Map<string, number>,
): BacktestResult {
  const { fromMs, toMs, sizeUsd, days, fees } = window;
  const netFundingUsd = longResult.fundingUsd + shortResult.fundingUsd;
  const perDay = [...daily.entries()]
    .map(([date, netUsd]) => ({ date, netUsd }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const winningDays = perDay.filter((day) => day.netUsd > 0).length;
  const avgDailyUsd = days > 0 ? netFundingUsd / days : 0;

  // Four fills: in and out of both legs.
  const costsUsd = fees ? (sizeUsd * (fees.longTakerBps + fees.shortTakerBps) * 2) / 10_000 : null;
  const netAfterCostsUsd = costsUsd === null ? null : netFundingUsd - costsUsd;
  const paybackDays = costsUsd === null || avgDailyUsd <= 0 ? null : costsUsd / avgDailyUsd;

  return {
    fromMs,
    toMs,
    sizeUsd,
    days,
    long: longResult,
    short: shortResult,
    netFundingUsd,
    netFundingAprPercent: days > 0 ? (netFundingUsd / sizeUsd / days) * DAYS_PER_YEAR * 100 : 0,
    perDay,
    winRateDays: perDay.length > 0 ? winningDays / perDay.length : 0,
    avgDailyUsd,
    costsUsd,
    netAfterCostsUsd,
    paybackDays,
  };
}
