import { describe, expect, test } from "bun:test";
import { canonicalBase, parseVenueSymbol } from "./symbols";

describe("parseVenueSymbol", () => {
  const cases: [string, string, string | null, number, string | null][] = [
    ["BTCUSDT", "BTC", "USDT", 1, null],
    ["btcusdt", "BTC", "USDT", 1, null],
    ["BTC-USDT-SWAP", "BTC", "USDT", 1, null],
    ["BTC_USDT", "BTC", "USDT", 1, null],
    ["BTC-SWAP-USDT", "BTC", "USDT", 1, null],
    ["PERP_ETH_USDC", "ETH", "USDC", 1, null],
    ["BTC_USDC_PERP", "BTC", "USDC", 1, null],
    ["BTC-USD", "BTC", "USD", 1, null],
    ["ETH-PERP", "ETH", null, 1, null],
    ["ETH", "ETH", null, 1, null],
    ["XBTUSDTM", "BTC", "USDT", 1, null],
    ["BTC/USDT:USDT", "BTC", "USDT", 1, null],
    ["1000PEPEUSDT", "PEPE", "USDT", 1000, null],
    ["1000000MOGUSDT", "MOG", "USDT", 1_000_000, null],
    ["kBONK", "BONK", null, 1000, null],
    ["KAVAUSDT", "KAVA", "USDT", 1, null],
    ["1INCHUSDT", "1INCH", "USDT", 1, null],
    ["ETHBUSD", "ETH", "BUSD", 1, null],
    ["xyz:XYZ100", "XYZ100", null, 1, "xyz"],
    // Commodity tickers that mean the same underlying on different venues.
    ["NG_USDT", "NATGAS", "USDT", 1, null],
    ["NATGASUSDT", "NATGAS", "USDT", 1, null],
    ["WTI-USD", "CL", "USD", 1, null],
    ["CL-USDT-SWAP", "CL", "USDT", 1, null],
    ["xyz:GOLD", "XAU", null, 1, "xyz"],
    ["SILVERUSDTM", "XAG", "USDT", 1, null],
    // The S&P 500 is listed under three names; they consolidate onto US500, the spelling four
    // venues use. SPX is NOT one of them -- it is the SPX6900 token at ~$0.49 on eight venues, and
    // merging it into a ~$7,620 index would be the worst kind of false pair.
    ["SPXUSDT", "SPX", "USDT", 1, null],
    ["US500-USD-PERP", "US500", "USD", 1, null],
    ["SPX500_USDT", "US500", "USDT", 1, null],
    ["xyz:SP500", "US500", null, 1, "xyz"],
    // One character apart from SPX500, and a different asset entirely.
    ["SPXLUSDT", "SPXL", "USDT", 1, null],
  ];

  for (const [raw, base, quote, multiplier, dex] of cases) {
    test(raw, () => {
      expect(parseVenueSymbol(raw)).toEqual({ base, quote, multiplier, dex });
    });
  }
});

describe("canonicalBase", () => {
  test("applies the alias map to an already-extracted base", () => {
    // The reason this is exported: a venue-declared base never passes through parseVenueSymbol, so
    // without it MEXC would sit on SP500 while gate sat on US500 -- re-splitting the pool.
    expect(canonicalBase("SP500")).toBe("US500");
    expect(canonicalBase("SPX500")).toBe("US500");
    expect(canonicalBase("GOLD")).toBe("XAU");
    expect(canonicalBase("XBT")).toBe("BTC");
  });

  test("passes through anything with no alias, and normalises case", () => {
    expect(canonicalBase("BTC")).toBe("BTC");
    expect(canonicalBase("mu")).toBe("MU");
    expect(canonicalBase(" tsla ")).toBe("TSLA");
  });

  test("never folds the SPX6900 token into the index", () => {
    expect(canonicalBase("SPX")).toBe("SPX");
    expect(canonicalBase("SPXL")).toBe("SPXL");
  });
});
