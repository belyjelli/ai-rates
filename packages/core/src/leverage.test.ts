import { describe, expect, test } from "bun:test";
import { pairCapitalUsd, tierForSize } from "./leverage";
import type { LeverageTier } from "./market";

const tier = (
  index: number,
  lowerNotionalUsd: number,
  upperNotionalUsd: number | null,
  imr: number,
): LeverageTier => ({
  venueId: "bybit",
  venueSymbol: "BTCUSDT",
  tier: index,
  lowerNotionalUsd,
  upperNotionalUsd,
  imr,
  mmr: imr / 2,
  maxLeverage: 1 / imr,
});

// Bybit's real first three bands on BTCUSDT: 150x to $300k, 100x to $2M, 90x to $2.6M.
const ladder = [tier(1, 0, 300_000, 1 / 150), tier(2, 300_000, 2_000_000, 0.01)];

describe("tierForSize", () => {
  test("picks the band the size falls in", () => {
    expect(tierForSize(ladder, 10_000)?.tier).toBe(1);
    expect(tierForSize(ladder, 1_000_000)?.tier).toBe(2);
  });

  test("a size exactly on a boundary belongs to the higher tier", () => {
    // Bounds are half-open, so $300k is the first size that can no longer use 150x.
    expect(tierForSize(ladder, 299_999)?.tier).toBe(1);
    expect(tierForSize(ladder, 300_000)?.tier).toBe(2);
  });

  test("returns null above the top tier rather than rounding into it", () => {
    // Bybit will not open the position at all, so quoting the top tier's margin would imply a
    // capital figure for a trade that cannot exist.
    expect(tierForSize(ladder, 5_000_000)).toBeNull();
  });

  test("a null upper bound is unbounded", () => {
    expect(tierForSize([tier(1, 0, null, 0.1)], 1e12)?.tier).toBe(1);
  });

  test("does not require the ladder to arrive sorted", () => {
    expect(tierForSize([...ladder].reverse(), 10_000)?.tier).toBe(1);
  });
});

describe("pairCapitalUsd", () => {
  test("posts both legs' margin, not the larger of the two", () => {
    // The bug this replaces took max(0.01, 0.02) and reported half the real requirement.
    expect(pairCapitalUsd(10_000, 0.01, 0.02)).toBeCloseTo(300, 6);
  });

  test("symmetric leverage reduces to 2 x size / L", () => {
    const imr = 1 / 150;
    expect(pairCapitalUsd(10_000, imr, imr)).toBeCloseTo((2 * 10_000) / 150, 6);
  });
});
