import { describe, expect, test } from "bun:test";
import type { Overview } from "../app/data";
import { about, CHANGELOG } from "./about";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const overview: Overview = {
  markets: 5402,
  venues: 14,
  assets: 1200,
  open_interest_usd: 1e10,
  updated_at: new Date(NOW - 10_000),
};

describe("about", () => {
  test("a stamped build names its commit, links it, and escapes the subject", () => {
    const html = about({
      overview,
      now: NOW,
      build: {
        commit: "59c71fe0123456789abcdef0123456789abcdef0",
        subject: "Pair page: <b>range</b> & a link",
        committedAt: "2026-09-14T00:40:00+07:00",
        builtAt: "2026-09-13T17:43:10.000Z",
      },
    });

    expect(html).toContain(
      '<a href="https://github.com/belyjelli/ai-rates/commit/59c71fe0123456789abcdef0123456789abcdef0">59c71fe</a>',
    );
    expect(html).toContain("Pair page: &lt;b&gt;range&lt;/b&gt; &amp; a link");
    // Times are shown in UTC, whatever offset the commit carried.
    expect(html).toContain("committed <b>Sep 13, 2026 17:40 UTC</b>");
    expect(html).toContain("deployed <b>Sep 13, 2026 17:43 UTC</b>");
  });

  test("an unstamped build says so rather than naming a commit it cannot know", () => {
    const html = about({
      overview,
      now: NOW,
      build: { commit: null, subject: null, committedAt: null, builtAt: null },
    });
    expect(html).toContain("commit <b>not recorded</b>");
    expect(html).not.toContain("/commit/");
  });

  test("the changelog is newest first, every entry has a date and at least one change", () => {
    const dates = CHANGELOG.map((release) => release.date);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const release of CHANGELOG) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.changes.length).toBeGreaterThan(0);
    }
    const html = about({ overview, now: NOW });
    expect(html).toContain("<h1>About airrates</h1>");
    expect(html).toContain('<p class="eyebrow">Sep 14, 2026</p>');
  });
});
