import { describe, expect, test } from "bun:test";
import { createAdapters, FIXED_ADAPTERS } from "./registry";

describe("createAdapters", () => {
  test("returns fixed adapters and one adapter per HIP-3 dex, skipping venues without adapters", () => {
    const adapters = createAdapters([
      // `weex` stands in for "catalogued, no adapter yet". This slot used to be `binance`, which
      // stopped being an example the moment Binance was built -- and the test said so by failing.
      // weex is the next member of the same binance-fapi family, so whoever builds it gets the
      // same warning here rather than a silently weakened assertion.
      { id: "weex", type: "cex" },
      { id: "okx", type: "cex" },
      { id: "hl-xyz", type: "hip3", hip3Dex: "xyz" },
      { id: "hyperliquid", type: "dex" },
      { id: "hl-broken", type: "hip3" },
    ]);
    expect(adapters.map((a) => a.venueId)).toEqual(["okx", "hl-xyz", "hyperliquid"]);
  });

  test("fixed adapters have unique venue ids", () => {
    const ids = FIXED_ADAPTERS.map((a) => a.venueId);
    expect(new Set(ids).size).toBe(ids.length);
    // The set rather than a bare count: a count tells you the number changed, not which adapter
    // went missing, and dropping one silently is the failure worth catching.
    expect([...ids].sort()).toEqual([
      "aster",
      "binance",
      "bybit",
      "dydx",
      "gate",
      "hyperliquid",
      "kucoin",
      "lighter",
      "mexc",
      "okx",
      "paradex",
    ]);
  });
});
