import { describe, expect, test } from "bun:test";
import { hoursBetween, marketRef, mul, num, resolveDeclaredBase } from "./parse";

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
      assetClass: "crypto",
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

  test("a declared base still goes through the alias map", () => {
    // The whole point of the consolidation: MEXC declares SP500, gate parses SPX500, and both have
    // to land on US500. Without canonicalising the override, the declared one would not.
    expect(marketRef("mexc", "SPX500_USDT", { base: "SP500" }).base).toBe("US500");
    expect(marketRef("gate", "SPX500_USDT").base).toBe("US500");
  });

  test("a declared base is normalised but otherwise respected", () => {
    expect(marketRef("mexc", "MUSTOCK_USDT", { base: "MU" }).base).toBe("MU");
    expect(marketRef("mexc", "MUSTOCK_USDT", { base: "mu" }).base).toBe("MU");
    // The symbol still parses to MUSTOCK; the declaration is what wins.
    expect(marketRef("mexc", "MUSTOCK_USDT").base).toBe("MUSTOCK");
  });

  test("the quote override is left alone -- it is a currency, not an asset", () => {
    expect(marketRef("mexc", "BTC_USD1", { quote: "USD1" }).quote).toBe("USD1");
  });
});

describe("resolveDeclaredBase", () => {
  test("prefers a clean declared ticker over the contract code", () => {
    expect(resolveDeclaredBase("MUSTOCK", "MU")).toBe("MU");
    expect(resolveDeclaredBase("NVIDIA", "NVDA")).toBe("NVDA");
  });

  test("takes the ticker out of a display name", () => {
    expect(resolveDeclaredBase("XAU", "GOLD(XAU)")).toBe("XAU");
    expect(resolveDeclaredBase("USOIL", "OIL(WTI)")).toBe("WTI");
    expect(resolveDeclaredBase("ALUMINUM", "ALUMINIUM(XAL)")).toBe("XAL");
  });

  test("falls back when the venue withholds a rename", () => {
    // MEXC leaves these equal on exactly the contracts whose stripped name would collide with a
    // crypto ticker. Honouring that is why this never strips a suffix itself.
    expect(resolveDeclaredBase("CATSTOCK", "CATSTOCK")).toBe("CATSTOCK");
    expect(resolveDeclaredBase("STXSTOCK", "STXSTOCK")).toBe("STXSTOCK");
  });

  test("falls back on names that are not tickers", () => {
    expect(resolveDeclaredBase("LONGXIA", "龙虾")).toBe("LONGXIA");
    expect(resolveDeclaredBase("NIULAI", "牛来")).toBe("NIULAI");
    expect(resolveDeclaredBase("FOO", "some long prose name")).toBe("FOO");
  });

  test("undefined when the venue declares nothing usable", () => {
    expect(resolveDeclaredBase(undefined, undefined)).toBeUndefined();
    expect(resolveDeclaredBase("", "")).toBeUndefined();
    expect(resolveDeclaredBase("BTC", undefined)).toBe("BTC");
  });
});
