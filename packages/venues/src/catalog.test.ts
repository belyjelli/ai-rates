import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VENUES } from "./catalog";
import { catalogJson } from "./catalog-json";

describe("catalog.json", () => {
  test("matches the catalog, so the Go collector reads what TypeScript defines", () => {
    // Stale means the Go collector writes old venue names, misses a new venue's row (every market
    // table's foreign key needs it), or applies old curated leverage. Fix by regenerating:
    //   bun packages/venues/scripts/emit-catalog-json.ts
    const onDisk = readFileSync(join(import.meta.dir, "..", "catalog.json"), "utf8");
    expect(onDisk).toBe(catalogJson());
  });
});

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

  test("retired venues say when and on what evidence", () => {
    for (const venue of VENUES.filter((v) => v.retired !== undefined)) {
      expect(venue.retired).toMatch(/^\d{4}-\d{2}-\d{2}: \S/);
    }
  });

  test("verified venues have at least one probe", () => {
    for (const venue of VENUES.filter((v) => v.verified)) {
      expect(venue.probes.length).toBeGreaterThan(0);
    }
  });

  test("aliases point at a real venue and have no probes of their own", () => {
    const ids = new Set(VENUES.map((v) => v.id));
    for (const venue of VENUES.filter((v) => v.aliasOf)) {
      expect(ids.has(venue.aliasOf as string)).toBe(true);
      expect(venue.probes).toEqual([]);
    }
  });

  test("probes with a JSON body are explicit POSTs", () => {
    for (const probe of VENUES.flatMap((v) => v.probes).filter((p) => p.body !== undefined)) {
      expect(probe.method).toBe("POST");
    }
  });
});
