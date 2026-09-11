import { describe, expect, test } from "bun:test";
import { aprFromRate, durationToHours, inferIntervalHours, ratePerHour, toFraction } from "./units";

const HOUR = 3_600_000;

describe("toFraction", () => {
  test("converts percent and bps", () => {
    expect(toFraction(0.01, "percent")).toBeCloseTo(0.0001, 12);
    expect(toFraction(1, "bps")).toBeCloseTo(0.0001, 12);
    expect(toFraction(0.0001, "fraction")).toBe(0.0001);
  });
});

describe("durationToHours", () => {
  test("normalizes venue interval fields", () => {
    expect(durationToHours(480, "min")).toBe(8); // Bybit fundingInterval
    expect(durationToHours(28_800_000, "ms")).toBe(8); // KuCoin fundingRateGranularity
    expect(durationToHours(28_800, "s")).toBe(8); // Gate funding_interval
    expect(durationToHours(4, "h")).toBe(4); // Bitget
  });
});

describe("APR", () => {
  test("0.01% per 8h is 10.95% APR", () => {
    expect(aprFromRate(0.0001, "fraction", 8)).toBeCloseTo(10.95, 6);
  });

  test("hourly 0.00125% is the same 10.95% APR", () => {
    expect(aprFromRate(0.0000125, "fraction", 1)).toBeCloseTo(10.95, 6);
  });

  test("percent-quoted rates annualize identically", () => {
    expect(aprFromRate(0.01, "percent", 8)).toBeCloseTo(10.95, 6);
  });

  test("negative rates keep their sign", () => {
    expect(aprFromRate(-0.0003, "fraction", 4)).toBeCloseTo(-65.7, 6);
  });

  test("rejects a non-positive basis", () => {
    expect(() => ratePerHour(0.0001, 0)).toThrow(RangeError);
    expect(() => ratePerHour(0.0001, Number.NaN)).toThrow(RangeError);
  });
});

describe("inferIntervalHours", () => {
  const series = (start: number, stepH: number, count: number) =>
    Array.from({ length: count }, (_, i) => start + i * stepH * HOUR);

  test("returns null without at least two distinct timestamps", () => {
    expect(inferIntervalHours([])).toBeNull();
    expect(inferIntervalHours([1000])).toBeNull();
    expect(inferIntervalHours([1000, 1000])).toBeNull();
  });

  test("detects a regular 8h cadence regardless of input order", () => {
    expect(inferIntervalHours(series(0, 8, 10).reverse())).toBe(8);
  });

  test("ignores a single missed settlement", () => {
    const ts = series(0, 8, 10).filter((_, i) => i !== 4);
    expect(inferIntervalHours(ts)).toBe(8);
  });

  test("follows the dominant cadence after an 8h -> 1h change", () => {
    const before = series(0, 8, 4);
    const after = series(3 * 8 * HOUR + HOUR, 1, 12);
    expect(inferIntervalHours([...before, ...after])).toBe(1);
  });

  test("snaps small settlement jitter to the standard interval", () => {
    const ts = series(0, 8, 6).map((t, i) => t + (i % 2 === 0 ? 45_000 : -30_000));
    expect(inferIntervalHours(ts)).toBe(8);
  });
});
