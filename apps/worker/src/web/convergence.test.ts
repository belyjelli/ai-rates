import { describe, expect, test } from "bun:test";
import {
  breakevenPct,
  holdTime,
  type PriceHour,
  quantile,
  scenarios,
  spreadSeries,
  spreadStats,
} from "./convergence";

const H = 3_600_000;
const hours = (prices: (number | null)[]): PriceHour[] =>
  prices.map((price, i) => ({ hourMs: i * H, price, samples: 60 }));
const points = (pcts: number[]) => pcts.map((pct, i) => ({ atMs: i * H, pct }));

describe("spreadSeries", () => {
  test("short over long, in percent, only where both legs priced the hour", () => {
    const series = spreadSeries(hours([100, 100, null, 200]), hours([101, null, 100, 202]));
    expect(series.map((p) => p.atMs / H)).toEqual([0, 3]);
    expect(series[0]?.pct).toBeCloseTo(1, 10);
    expect(series[1]?.pct).toBeCloseTo(1, 10);
  });
});

describe("spreadStats", () => {
  test("quantiles interpolate, rank is the share strictly below now", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    const stats = spreadStats(points([1, 2, 3, 4]), 8, 3.5);
    expect(stats).toMatchObject({
      samples: 4,
      expected: 9,
      median: 2.5,
      mean: 2.5,
      min: 1,
      max: 4,
    });
    expect(stats?.rank).toBe(0.75);
    expect(stats?.std).toBeCloseTo(Math.sqrt(1.25), 10);
    expect(spreadStats([], 8, 1)).toBeNull();
  });
});

describe("holdTime", () => {
  test("hours from reaching today's width to the exit level, over finished episodes", () => {
    // Three rises to 2.0 that come back to 1.0 after 2, 1 and 3 hours, then one still open.
    const series = points([1, 2, 1.5, 1, 2.2, 0.9, 1, 2, 2, 1.8, 0.5, 2.1, 1.9]);
    expect(holdTime(series, 2, 1)).toEqual({
      episodes: 3,
      unfinished: 1,
      medianHours: 2,
      p25Hours: 1.5,
      p75Hours: 2.5,
    });
  });

  test("nothing to wait for at or below the exit, and no estimate from fewer than three", () => {
    expect(holdTime(points([1, 2, 1, 2, 1]), 1, 1)).toBeNull();
    expect(holdTime(points([1, 2, 1, 2, 1]), 2, 1)).toBeNull();
  });
});

describe("scenarios", () => {
  const input = {
    sizeUsd: 10_000,
    current: 1.5,
    longTakerBps: 6,
    shortTakerBps: 8,
    longBookBps: 4,
    shortBookBps: 6,
    longApr: 0,
    shortApr: 43.8,
    holdHours: 1,
  };

  test("gross to each target, four taker fills, both books crossed, funding over the hold", () => {
    const [full, half] = scenarios(input, [0, 0.5]);
    expect(full?.gross).toBeCloseTo(150, 10);
    expect(full?.fees).toBeCloseTo(28, 10);
    expect(full?.crossing).toBeCloseTo(10, 10);
    // The short leg receives 43.8% a year for an hour; the long pays nothing.
    expect(full?.funding).toBeCloseTo(0.5, 10);
    expect(full?.net).toBeCloseTo(150 - 28 - 10 + 0.5, 10);
    expect(half?.gross).toBeCloseTo(100, 10);
    expect(breakevenPct(full as NonNullable<typeof full>, 10_000)).toBeCloseTo(0.38, 10);
  });

  test("an unquoted book is unknown, not free", () => {
    const [s] = scenarios({ ...input, shortBookBps: null }, [0]);
    expect(s?.crossing).toBeNull();
    expect(s?.net).toBeCloseTo(150 - 28 + 0.5, 10);
  });
});
