import { describe, expect, test } from "bun:test";
import { createAdapters, FIXED_ADAPTERS } from "./registry";

describe("createAdapters", () => {
  test("returns fixed adapters and one adapter per HIP-3 dex, skipping venues without adapters", () => {
    const adapters = createAdapters([
      { id: "binance", type: "cex" },
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
    expect(ids).toHaveLength(10);
  });
});
