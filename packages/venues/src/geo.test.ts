import { describe, expect, test } from "bun:test";
import { VENUES } from "./catalog";
import { GEO_FINDINGS } from "./geo";

describe("geo findings", () => {
  const ids = new Set(VENUES.map((v) => v.id));

  for (const [venueId, finding] of Object.entries(GEO_FINDINGS)) {
    test(venueId, () => {
      expect(ids.has(venueId)).toBe(true);
      expect(finding.blockedFrom.length).toBeGreaterThan(0);
      if (finding.recommendedHint) {
        expect(finding.blockedFrom).not.toContain(finding.recommendedHint);
        expect(finding.rung).toBe("direct");
      } else {
        expect(finding.rung).not.toBe("direct");
      }
    });
  }
});
