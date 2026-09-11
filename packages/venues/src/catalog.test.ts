import { describe, expect, test } from "bun:test";
import { VENUES } from "./catalog";

describe("venue catalog", () => {
  test("ids are unique", () => {
    const ids = VENUES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("covers at least the ~57 venues in the plan", () => {
    expect(VENUES.length).toBeGreaterThanOrEqual(57);
  });

  test("probe URLs are absolute https", () => {
    for (const venue of VENUES) {
      for (const probe of venue.probes) {
        expect(new URL(probe.url).protocol).toBe("https:");
      }
    }
  });

  test("HIP-3 venues carry their dex id in id and probe body", () => {
    for (const venue of VENUES.filter((v) => v.type === "hip3")) {
      expect(venue.hip3Dex).toBeDefined();
      expect(venue.id).toBe(`hl-${venue.hip3Dex}`);
      expect(venue.probes[0]?.body).toEqual({ type: "metaAndAssetCtxs", dex: venue.hip3Dex });
    }
  });

  test("verified venues have at least one probe", () => {
    for (const venue of VENUES.filter((v) => v.verified)) {
      expect(venue.probes.length).toBeGreaterThan(0);
    }
  });
});
