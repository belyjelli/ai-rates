import { describe, expect, test } from "bun:test";
import { type BacktestLeg, type BacktestSettlement, backtestPair } from "./backtest";

const HOUR = 3_600_000;
const DAY = 86_400_000;
// 2026-09-01T00:00:00Z, so bucket dates are readable.
const START = Date.UTC(2026, 8, 1);

const series = (
  startMs: number,
  everyHours: number,
  count: number,
  rate: number,
): BacktestSettlement[] =>
  Array.from({ length: count }, (_, i) => ({
    settledAt: startMs + i * everyHours * HOUR,
    rate,
    basisHours: everyHours,
  }));

const leg = (
  venueId: string,
  venueSymbol: string,
  settlements: BacktestSettlement[],
): BacktestLeg => ({ venueId, venueSymbol, settlements });

describe("backtestPair", () => {
  test("sums each leg at its own cadence, and gets the signs the right way round", () => {
    // One day: hourly long leg paying 0.001% an hour, 8-hourly short leg receiving 0.01%.
    const result = backtestPair({
      long: leg("hyperliquid", "BTC", series(START, 1, 24, 0.00001)),
      short: leg("bybit", "BTCUSDT", series(START, 8, 3, 0.0001)),
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + DAY,
    });

    // Long pays 10000 * 0.00001 * 24 = 2.40; short receives 10000 * 0.0001 * 3 = 3.00.
    expect(result.long.fundingUsd).toBeCloseTo(-2.4, 9);
    expect(result.short.fundingUsd).toBeCloseTo(3, 9);
    expect(result.netFundingUsd).toBeCloseTo(0.6, 9);
    expect(result.long.settlements).toBe(24);
    expect(result.short.settlements).toBe(3);
    // 0.60 a day on 10k of notional is 0.006% a day, so 2.19% a year.
    expect(result.netFundingAprPercent).toBeCloseTo(2.19, 6);
  });

  test("a negative rate pays the long and charges the short", () => {
    const result = backtestPair({
      long: leg("gate", "X_USDT", series(START, 8, 3, -0.0002)),
      short: leg("okx", "X-USDT-SWAP", series(START, 8, 3, -0.0001)),
      sizeUsd: 1_000,
      fromMs: START,
      toMs: START + DAY,
    });

    expect(result.long.fundingUsd).toBeCloseTo(0.6, 9); // paid to hold the long
    expect(result.short.fundingUsd).toBeCloseTo(-0.3, 9); // charged to hold the short
    expect(result.netFundingUsd).toBeCloseTo(0.3, 9);
  });

  test("buckets by UTC day and counts winning days only among days that settled", () => {
    const long = [
      ...series(START, 8, 3, 0.0001), // day 1: long pays 3.00
      ...series(START + 2 * DAY, 8, 3, -0.0001), // day 3: long receives 3.00
    ];
    const result = backtestPair({
      long: leg("gate", "X_USDT", long),
      short: leg("okx", "X-USDT-SWAP", []),
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + 3 * DAY,
    });

    expect(result.perDay.map((day) => day.date)).toEqual(["2026-09-01", "2026-09-03"]);
    expect(result.perDay[0]?.netUsd).toBeCloseTo(-3, 9);
    expect(result.perDay[1]?.netUsd).toBeCloseTo(3, 9);
    // Day 2 had no settlement at all, so it is not counted either way.
    expect(result.winRateDays).toBeCloseTo(0.5, 9);
    expect(result.avgDailyUsd).toBeCloseTo(0, 9);
  });

  test("flags missing settlements instead of treating the gap as zero funding", () => {
    const withHole = [
      ...series(START, 8, 2, 0.0001),
      // 24h later: two settlements skipped.
      ...series(START + 32 * HOUR, 8, 2, 0.0001),
    ];
    const result = backtestPair({
      long: leg("gate", "X_USDT", withHole),
      short: leg("okx", "X-USDT-SWAP", series(START, 8, 4, 0.0001)),
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + 2 * DAY,
    });

    expect(result.long.missedSettlements).toBe(2);
    expect(result.long.missedHours).toBeCloseTo(16, 9);
    expect(result.short.missedSettlements).toBe(0);
  });

  test("survives an interval change mid-window without inventing settlements", () => {
    const changed = [
      ...series(START, 8, 3, 0.0001), // 8-hourly for a day
      ...series(START + DAY, 1, 24, 0.0000125), // then hourly
    ];
    const result = backtestPair({
      long: leg("bybit", "X", changed),
      short: leg("okx", "X", []),
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + 2 * DAY,
    });

    expect(result.long.settlements).toBe(27);
    expect(result.long.missedSettlements).toBe(0);
    expect(result.long.fundingUsd).toBeCloseTo(-(3 * 1 + 24 * 0.125), 9);
  });

  test("charges four taker fills and reports payback only when it repays", () => {
    const profitable = backtestPair({
      long: leg("a", "X", series(START, 8, 3, -0.0001)),
      short: leg("b", "X", series(START, 8, 3, 0.0001)),
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + DAY,
      fees: { longTakerBps: 5, shortTakerBps: 5 },
    });

    // 10000 * (5 + 5) / 10000 * 2 fills-per-leg = 20.
    expect(profitable.costsUsd).toBeCloseTo(20, 9);
    expect(profitable.netFundingUsd).toBeCloseTo(6, 9);
    expect(profitable.netAfterCostsUsd).toBeCloseTo(-14, 9);
    // 6/day against 20 of costs repays in 3 1/3 days.
    expect(profitable.paybackDays).toBeCloseTo(20 / 6, 9);

    const losing = backtestPair({
      long: leg("a", "X", series(START, 8, 3, 0.0001)),
      short: leg("b", "X", series(START, 8, 3, -0.0001)),
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + DAY,
      fees: { longTakerBps: 5, shortTakerBps: 5 },
    });
    expect(losing.paybackDays).toBeNull();
  });

  test("leaves costs null when fees are unknown, rather than assuming a number", () => {
    const result = backtestPair({
      long: leg("a", "X", series(START, 8, 3, -0.0001)),
      short: leg("b", "X", series(START, 8, 3, 0.0001)),
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START + DAY,
    });

    expect(result.costsUsd).toBeNull();
    expect(result.netAfterCostsUsd).toBeNull();
    expect(result.paybackDays).toBeNull();
  });

  test("an empty window reports nothing rather than dividing by zero", () => {
    const result = backtestPair({
      long: leg("a", "X", []),
      short: leg("b", "X", []),
      sizeUsd: 10_000,
      fromMs: START,
      toMs: START,
    });

    expect(result.netFundingUsd).toBe(0);
    expect(result.netFundingAprPercent).toBe(0);
    expect(result.winRateDays).toBe(0);
    expect(result.perDay).toEqual([]);
  });
});
