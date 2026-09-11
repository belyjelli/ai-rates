import { describe, expect, test } from "bun:test";
import { hoursBetween, marketRef, mul, num } from "./parse";

describe("num", () => {
  test("parses numbers and numeric strings", () => {
    expect(num("0.00004936")).toBe(0.00004936);
    expect(num(77751.4)).toBe(77751.4);
    expect(num("-1e-5")).toBe(-0.00001);
  });

  test("rejects missing and non-finite values", () => {
    for (const value of [null, undefined, "", "abc", Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(num(value)).toBeNull();
    }
  });
});

describe("mul", () => {
  test("multiplies, propagating null", () => {
    expect(mul(2, 3, 0.5)).toBe(3);
    expect(mul(2, null, 3)).toBeNull();
  });
});

describe("hoursBetween", () => {
  test("returns the span in hours", () => {
    expect(hoursBetween(0, 8 * 3_600_000)).toBe(8);
    expect(hoursBetween(1_000, 1_000 + 14_400_000)).toBe(4);
  });

  test("null for missing or non-positive spans", () => {
    expect(hoursBetween(null, 1)).toBeNull();
    expect(hoursBetween(5, 5)).toBeNull();
    expect(hoursBetween(10, 5)).toBeNull();
  });
});

describe("marketRef", () => {
  test("derives canonical fields from the venue symbol", () => {
    expect(marketRef("kucoin", "XBTUSDTM")).toEqual({
      venueId: "kucoin",
      venueSymbol: "XBTUSDTM",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      dex: null,
    });
  });

  test("lets adapters override reported fields", () => {
    expect(marketRef("hl-xyz", "xyz:XYZ100", { quote: "USDC" })).toMatchObject({
      base: "XYZ100",
      quote: "USDC",
      dex: "xyz",
    });
  });
});
