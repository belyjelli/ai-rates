import { describe, expect, test } from "bun:test";
import type { Overview } from "../app/data";
import { glossary } from "./glossary";
import { withLocale } from "./i18n";

const overview = {
  markets: 1,
  venues: 1,
  updated_at: new Date(0),
  sentiment_score: null,
  sentiment_label: null,
} as unknown as Overview;
const html = glossary({ overview, now: 0 });
const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));

describe("/glossary", () => {
  const ids = [...main.matchAll(/<div class="gl-term" id="([^"]+)"/g)].map((m) => m[1]);

  test("every term has its own link, and the first terms keep theirs", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["delta", "cvd", "imbalance", "absorption", "vpoc", "value-area", "lvn"]) {
      expect(ids).toContain(id);
    }
    // The owner's first eight, Initiative and Taker flow beside them, and the 21 of 2026-11-10's groups.
    expect(ids.length).toBe(31);
  });

  test("the two deltas say which each is", () => {
    expect(main).toContain(">Delta (order flow)</a>");
    expect(main).toContain(">Delta (options)</a>");
  });

  test("every Rates link opens a tab the page has", () => {
    const tabs = new Set(["gamma", "delta", "vega", "theta", "ivwalls", "levels"]);
    const hashes = [...main.matchAll(/href="\/rates#([a-z]+)"/g)].map((m) => m[1]);
    expect(hashes.length).toBeGreaterThan(0);
    for (const hash of hashes) expect(tabs.has(hash ?? "")).toBe(true);
  });

  test("renders in Chinese with the new groups translated", () => {
    const zh = withLocale("zh", () => glossary({ overview, now: 0 }));
    expect(zh).toContain("期权与 Gamma");
    expect(zh).toContain("资金费率与永续合约");
    expect(zh).toContain("爆仓与巨鲸");
  });
});
