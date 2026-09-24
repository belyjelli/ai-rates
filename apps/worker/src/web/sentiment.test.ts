import { describe, expect, test } from "bun:test";
import type { Overview, SentimentPoint } from "../app/data";
import type { SentimentParams } from "../app/params";
import { sentiment } from "./sentiment";

const NOW = Date.parse("2026-09-24T14:30:00Z");
const overview: Overview = {
  markets: 5402,
  venues: 14,
  assets: 1200,
  open_interest_usd: 1e10,
  updated_at: new Date(NOW - 10_000),
  sentiment_score: 62,
  sentiment_label: "greed",
};

const point = (over: Partial<SentimentPoint>): SentimentPoint => ({
  computed_at: new Date(NOW - 60 * 60_000),
  score: 50,
  label: "neutral",
  funding_raw: 5.03,
  funding_component: 64.3,
  oi_raw: 1.2e11,
  oi_component: 57.1,
  liquidation_raw: 35.86,
  liquidation_component: 43.3,
  taker_flow_raw: -1.18,
  taker_flow_component: 33.3,
  ...over,
});

describe("sentiment", () => {
  test("the headline reads the newest point's score and label, toned by band", () => {
    const html = sentiment({
      overview,
      history: [point({ score: 62, label: "greed" })],
      params: { window: "7d" },
      now: NOW,
    });
    expect(html).toContain('<div class="hero-asset sent-long">62');
    expect(html).toContain('<span class="sent-label">greed</span>');
  });

  test("extreme fear and fear both tone as short, neutral as ink, greed and extreme greed as long", () => {
    const cases: [number, string, string][] = [
      [10, "extreme fear", "sent-short"],
      [40, "fear", "sent-short"],
      [50, "neutral", "sent-ink"],
      [60, "greed", "sent-long"],
      [90, "extreme greed", "sent-long"],
    ];
    for (const [score, label, tone] of cases) {
      const html = sentiment({
        overview,
        history: [point({ score, label })],
        params: { window: "7d" },
        now: NOW,
      });
      expect(html).toContain(`<div class="hero-asset ${tone}">${score}`);
    }
  });

  test("with no history the page says so and shows no headline number", () => {
    const html = sentiment({ overview, history: [], params: { window: "7d" }, now: NOW });
    expect(html).toContain("No readings yet in this window");
    expect(html).toContain('<div class="hero-asset">–</div>');
    expect(html).not.toContain("<table");
  });

  test("a component with no data in the window is shown as absent, not a fabricated reading", () => {
    const html = sentiment({
      overview,
      history: [point({ liquidation_raw: null, liquidation_component: null })],
      params: { window: "7d" },
      now: NOW,
    });
    expect(html).toContain(
      '<td>liquidation skew (24h)</td><td class="muted">no data in window</td>',
    );
  });

  test("the window strip marks the active window and links the others by query string", () => {
    const params: SentimentParams = { window: "30d" };
    const html = sentiment({ overview, history: [point({})], params, now: NOW });
    expect(html).toContain(
      '<a class="on" href="/sentiment?window=30d" aria-current="page">30d</a>',
    );
    expect(html).toContain('<a href="/sentiment">7d</a>');
    expect(html).toContain('<a href="/sentiment?window=24h">24h</a>');
    expect(html).toContain('<a href="/sentiment?window=90d">90d</a>');
  });

  test("raw values are formatted per component, not printed bare", () => {
    const html = sentiment({
      overview,
      history: [
        point({
          funding_raw: 5.032,
          oi_raw: 125_864_382_922.61,
          liquidation_raw: 35.86,
          taker_flow_raw: -1.18,
        }),
      ],
      params: { window: "7d" },
      now: NOW,
    });
    expect(html).toContain("+5.03%");
    expect(html).toContain("$125.86B");
    expect(html).toContain("+35.9% long-heavy");
    // The site's minus is U+2212, not a hyphen, everywhere a number can go negative (format.ts).
    expect(html).toContain("−1.18% net buy");
  });
});
