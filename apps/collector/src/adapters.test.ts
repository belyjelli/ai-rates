import { describe, expect, test } from "bun:test";
import { createAdapters, FIXED_ADAPTERS } from "@ai-rates/adapters";
import { VENUES } from "@ai-rates/venues";

describe("collector adapters", () => {
  const adapters = createAdapters(VENUES);
  const catalogIds = new Set(VENUES.map((v) => v.id));

  test("every fixed adapter maps to a catalog venue (the venues table foreign key needs it)", () => {
    for (const adapter of FIXED_ADAPTERS) expect(catalogIds.has(adapter.venueId)).toBe(true);
  });

  test("collects the 10 Phase 1 venues plus every catalog HIP-3 dex", () => {
    const hip3 = VENUES.filter((v) => v.type === "hip3").length;
    expect(adapters).toHaveLength(FIXED_ADAPTERS.length + hip3);
    expect(new Set(adapters.map((a) => a.venueId)).size).toBe(adapters.length);
  });

  test("still-deferred venues are not collected", () => {
    // Binance came off this list in Phase 5. The deferral was Phase 1 SCOPING -- "KuCoin and Aster
    // replace Binance and Bitget" -- not a policy about Binance itself, and Phase 5's own venue
    // list names it. The remaining three stay deferred until they are actually built.
    const ids = adapters.map((a) => a.venueId);
    for (const deferred of ["bitget", "blofin", "pionex"]) expect(ids).not.toContain(deferred);
    expect(ids).toContain("binance");
    // WEEX and Bullet joined in Phase 5 as binance-fapi family members; their catalog ids must match.
    expect(ids).toContain("weex");
    expect(ids).toContain("bullet");
  });
});
