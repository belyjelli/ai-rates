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
