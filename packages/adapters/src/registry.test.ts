import { describe, expect, test } from "bun:test";
import { createAdapters, FIXED_ADAPTERS } from "./registry";

describe("createAdapters", () => {
  test("returns fixed adapters and one adapter per HIP-3 dex, skipping venues without adapters", () => {
    const adapters = createAdapters([
      // `txflow` stands in for "catalogued, no adapter yet". This slot was `binance`, then `weex`,
      // and each stopped being an example the moment it was built -- the test said so by failing.
      // txflow has no adapter today, so whoever builds it gets the same warning rather than a
      // silently weakened assertion.
      { id: "txflow", type: "dex" },
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
      "arcus",
      "aster",
      "binance",
      "bingx",
      "bitget",
      "bitmart",
      "blofin",
      "bullet",
      "bybit",
      "coinw",
      "dydx",
      "edgex-v2",
      "extended",
      "gate",
      "hotcoin",
      "htx",
      "hyperliquid",
      "kucoin",
      "lbank",
      "lighter",
      "lighter-rh",
      "mexc",
      "okx",
      "ondo",
      "orderly",
      "paradex",
      "pionex",
      "reya",
      "sodex",
      "standx",
      "toobit",
      "variational",
      "velocity",
      "weex",
    ]);
  });
});
