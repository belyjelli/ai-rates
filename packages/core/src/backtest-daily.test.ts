import { describe, expect, test } from "bun:test";
import {
  type BacktestSettlement,
  backtestDaily,
  backtestPair,
  type DailyFunding,
  dailyWindowStart,
} from "./backtest";

const HOUR = 3_600_000;
const DAY = 86_400_000;
// 2026-09-01T00:00:00Z, so dates are readable.
const START = Date.UTC(2026, 8, 1);

const series = (
  startMs: number,
  everyHours: number,
  count: number,
  rateAt: (i: number) => number,
): BacktestSettlement[] =>
  Array.from({ length: count }, (_, i) => ({
    settledAt: startMs + i * everyHours * HOUR,
    rate: rateAt(i),
    basisHours: everyHours,
  }));

/** Folds settlements the way the collector's refreshDailyFunding does: one row per UTC day. */
const fold = (settlements: readonly BacktestSettlement[]): DailyFunding[] => {
  const days = new Map<string, DailyFunding>();
  for (const settlement of settlements) {
    const date = new Date(settlement.settledAt).toISOString().slice(0, 10);
    const day = days.get(date) ?? { date, rateSum: 0, basisHoursSum: 0, settlements: 0 };
    day.rateSum += settlement.rate;
    day.basisHoursSum += settlement.basisHours;
    day.settlements += 1;
    days.set(date, day);
  }
  return [...days.values()];
};

/** Both engines over the same settlements and window, for side-by-side assertions. */
const both = (
  long: BacktestSettlement[],
  short: BacktestSettlement[],
  window: { fromMs: number; toMs: number },
  fees?: { longTakerBps: number; shortTakerBps: number },
) => {
  const common = { sizeUsd: 10_000, ...window, ...(fees ? { fees } : {}) };
  return {
    replay: backtestPair({
      long: { venueId: "hyperliquid", venueSymbol: "BTC", settlements: long },
      short: { venueId: "bybit", venueSymbol: "BTCUSDT", settlements: short },
      ...common,
    }),
    daily: backtestDaily({
      long: { venueId: "hyperliquid", venueSymbol: "BTC", days: fold(long) },
      short: { venueId: "bybit", venueSymbol: "BTCUSDT", days: fold(short) },
      ...common,
    }),
  };
};

describe("dailyWindowStart", () => {
  test("an N-day window is N calendar days ending with today", () => {
    const noon = START + 6 * DAY + 12 * HOUR; // 2026-09-07T12:00Z
    expect(dailyWindowStart(noon, 7)).toBe(START);
    expect(dailyWindowStart(noon, 1)).toBe(START + 6 * DAY);
    // Exactly midnight is already the new day.
    expect(dailyWindowStart(START + DAY, 1)).toBe(START + DAY);
  });
});

describe("backtestDaily", () => {
  test("settles exactly what the replay settles over the same whole days", () => {
    // Five days of an hourly leg that flips sign every seventh hour, against an 8-hourly leg that
    // alternates, so the per-day nets differ in size and sign.
    const long = series(START, 1, 24 * 5, (i) => (i % 7 === 0 ? -0.00003 : 0.00001));
    const short = series(START, 8, 3 * 5, (i) => (i % 2 ? 0.0001 : -0.00005));
    const { replay, daily } = both(
      long,
      short,
      { fromMs: START, toMs: START + 5 * DAY },
      { longTakerBps: 4.5, shortTakerBps: 5 },
    );

    expect(daily.long.fundingUsd).toBeCloseTo(replay.long.fundingUsd, 9);
    expect(daily.short.fundingUsd).toBeCloseTo(replay.short.fundingUsd, 9);
    expect(daily.netFundingUsd).toBeCloseTo(replay.netFundingUsd, 9);
    expect(daily.netFundingAprPercent).toBeCloseTo(replay.netFundingAprPercent, 9);
    expect(daily.long.settlements).toBe(replay.long.settlements);
    expect(daily.short.settlements).toBe(replay.short.settlements);
    expect(daily.perDay.map((day) => day.date)).toEqual(replay.perDay.map((day) => day.date));
    daily.perDay.forEach((day, i) => {
      expect(day.netUsd).toBeCloseTo(replay.perDay[i]?.netUsd ?? Number.NaN, 9);
    });
    expect(daily.winRateDays).toBe(replay.winRateDays);
    expect(daily.costsUsd).toBeCloseTo(replay.costsUsd ?? Number.NaN, 9);
    expect(daily.paybackDays).toEqual(replay.paybackDays);
    expect(daily.long.missedSettlements).toBe(0);
    expect(daily.short.missedSettlements).toBe(0);
    expect(daily.long.averageAprPercent).toBeCloseTo(
      replay.long.averageAprPercent ?? Number.NaN,
      9,
    );
    expect(daily.short.averageAprPercent).toBeCloseTo(
      replay.short.averageAprPercent ?? Number.NaN,
      9,
    );
    expect(daily.bestDay?.date).toBe(replay.bestDay?.date as string);
    expect(daily.worstDay?.date).toBe(replay.worstDay?.date as string);
    expect(daily.maxDrawdownUsd).toBeCloseTo(replay.maxDrawdownUsd, 9);
  });

  test("a day short of coverage counts the same missed settlements the replay finds", () => {
    // 8-hourly for five days, with 2026-09-03 00:00 and 08:00 never recorded.
    const short = series(START, 8, 15, () => 0.0001).filter(
      (settlement) =>
        settlement.settledAt !== START + 2 * DAY &&
        settlement.settledAt !== START + 2 * DAY + 8 * HOUR,
    );
    const long = series(START, 8, 15, () => 0.00002);
    const { replay, daily } = both(long, short, {
      fromMs: START,
      toMs: START + 5 * DAY + 12 * HOUR,
    });

    expect(replay.short.missedSettlements).toBe(2);
    expect(daily.short.missedSettlements).toBe(2);
    expect(daily.short.missedHours).toBe(16);
    // Never counted as zero funding: the two absent settlements simply contribute nothing.
    expect(daily.short.fundingUsd).toBeCloseTo(13 * 10_000 * 0.0001, 9);
  });

  test("a whole missing day inside the record is missed, not a zero day", () => {
    const short = series(START, 8, 15, () => 0.0001).filter(
      (settlement) => new Date(settlement.settledAt).toISOString().slice(0, 10) !== "2026-09-03",
    );
    const daily = backtestDaily({
      long: { venueId: "okx", venueSymbol: "BTC-USDT-SWAP", days: [] },
      short: { venueId: "bybit", venueSymbol: "BTCUSDT", days: fold(short) },
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + 5 * DAY + 12 * HOUR,
    });

    expect(daily.short.missedSettlements).toBe(3);
    expect(daily.short.missedHours).toBe(24);
    // The gap is absent from the per-day series, and the win rate counts only days that settled.
    expect(daily.perDay.map((day) => day.date)).not.toContain("2026-09-03");
    expect(daily.perDay).toHaveLength(4);
  });

  test("history that starts inside the window, and today's unfinished day, are not gaps", () => {
    // Listed at 16:00 on 2026-09-03, so that first day holds one settlement; complete on the 4th
    // and 5th; and today, the 6th, has reached only 00:00.
    const listed = START + 2 * DAY + 16 * HOUR;
    const short = series(listed, 8, 8, () => 0.0001);
    const daily = backtestDaily({
      long: { venueId: "okx", venueSymbol: "BTC-USDT-SWAP", days: [] },
      short: { venueId: "bybit", venueSymbol: "BTCUSDT", days: fold(short) },
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + 5 * DAY + 12 * HOUR,
    });

    expect(daily.short.settlements).toBe(8);
    expect(daily.short.missedSettlements).toBe(0);
  });

  test("rows outside the window are ignored", () => {
    const early = series(START - 5 * DAY, 8, 3, () => 0.01); // 2026-08-27, before the window
    const inside = series(START, 8, 3, () => 0.0001);
    const daily = backtestDaily({
      long: { venueId: "okx", venueSymbol: "BTC-USDT-SWAP", days: [] },
      short: { venueId: "bybit", venueSymbol: "BTCUSDT", days: fold([...early, ...inside]) },
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + DAY,
    });

    expect(daily.short.settlements).toBe(3);
    expect(daily.short.fundingUsd).toBeCloseTo(3, 9);
  });
});

describe("summary figures", () => {
  /** A short leg that nets `usd` on each successive day, one 8-hour settlement a day, on $10,000. */
  const dailyNets = (nets: number[]) =>
    backtestPair({
      long: { venueId: "okx", venueSymbol: "BTC-USDT-SWAP", settlements: [] },
      short: {
        venueId: "bybit",
        venueSymbol: "BTCUSDT",
        settlements: nets.map((usd, i) => ({
          settledAt: START + i * DAY,
          rate: usd / 10_000,
          basisHours: 8,
        })),
      },
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + nets.length * DAY,
    });

  test("best and worst day, and the largest fall from a previous high", () => {
    // Cumulative: 5, -3, -1, -2, 4. The high of 5 falls to -3, a drawdown of 8; the later dip
    // from -1 to -2 is smaller, and the recovery to 4 never passes the old high.
    const result = dailyNets([5, -8, 2, -1, 6]);

    expect(result.bestDay?.date).toBe("2026-09-05");
    expect(result.bestDay?.netUsd).toBeCloseTo(6, 9);
    expect(result.worstDay?.date).toBe("2026-09-02");
    expect(result.worstDay?.netUsd).toBeCloseTo(-8, 9);
    expect(result.maxDrawdownUsd).toBeCloseTo(8, 9);
  });

  test("a pair that opens with a loss draws down from zero", () => {
    expect(dailyNets([-3, 1]).maxDrawdownUsd).toBeCloseTo(3, 9);
    expect(dailyNets([1, 2, 3]).maxDrawdownUsd).toBe(0);
    const empty = dailyNets([]);
    expect(empty.bestDay).toBeNull();
    expect(empty.maxDrawdownUsd).toBe(0);
  });

  test("a leg's average rate is time-weighted and ignores which side it holds", () => {
    // Sixteen hours at 0.001% an hour and one 8-hour settlement at 0.008%: 0.024% over 24 hours,
    // 0.001% an hour, 8.76% a year. The leg is long, so it pays, but the rate is still positive.
    const settlements = [
      ...Array.from({ length: 16 }, (_, i) => ({
        settledAt: START + i * HOUR,
        rate: 0.00001,
        basisHours: 1,
      })),
      { settledAt: START + 16 * HOUR, rate: 0.00008, basisHours: 8 },
    ];
    const result = backtestPair({
      long: { venueId: "okx", venueSymbol: "BTC-USDT-SWAP", settlements },
      short: { venueId: "bybit", venueSymbol: "BTCUSDT", settlements: [] },
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + DAY,
    });

    expect(result.long.fundingUsd).toBeLessThan(0);
    expect(result.long.averageAprPercent).toBeCloseTo(8.76, 9);
    expect(result.short.averageAprPercent).toBeNull();
  });
});
