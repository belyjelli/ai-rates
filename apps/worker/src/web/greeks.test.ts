import { describe, expect, test } from "bun:test";
import type { GammaData, GammaExpiry, GammaExposure, GammaStrike, OptionGreeks } from "../app/data";
import type { GammaParams, HeatmapParams } from "../app/params";
import { greekFragment, greekPanel, greekPanelHref, isGreek } from "./greeks";
import { withLocale } from "./i18n";

const NOW = Date.parse("2026-10-20T20:30:00Z");
const HEATMAP: HeatmapParams = { tf: "now", limit: 50, offset: 0 };
const BTC_ALL: GammaParams = { currency: "BTC", scope: "all" };
const NEXT = new Date("2026-10-21T08:00:00Z");
const NOV = new Date("2026-11-27T08:00:00Z");

const greeks = (scale: number): OptionGreeks => ({
  call_delta: 4e9 * scale,
  put_delta: -1.5e9 * scale,
  call_vega: 12e6 * scale,
  put_vega: 6e6 * scale,
  call_theta: -5e6 * scale,
  put_theta: -3e6 * scale,
});

const strike = (k: number, g: OptionGreeks): GammaStrike => ({
  ...g,
  strike: k,
  call_oi: 100,
  put_oi: 100,
  call_gex_usd: 1e6,
  put_gex_usd: -1e6,
});

function exposure(overrides: Partial<GammaExposure> = {}): GammaExposure {
  return {
    ...greeks(1),
    scope: "all",
    computed_at: new Date(NOW - 3 * 60_000),
    source: "deribit",
    unit: "USD",
    spot: 80_000,
    options: 800,
    expiries: 2,
    first_expiry: NEXT,
    last_expiry: NOV,
    next_expiry: NEXT,
    call_oi: 250_000,
    put_oi: 150_000,
    call_gex_usd: 300e6,
    put_gex_usd: -280e6,
    net_gex_usd: 20e6,
    flip_price: 79_000,
    call_wall: 90_000,
    put_wall: 76_000,
    ...overrides,
  };
}

const expiry = (at: Date, g: OptionGreeks, premium: number): GammaExpiry => ({
  ...g,
  expiry: at,
  options: 100,
  call_oi: 1,
  put_oi: 1,
  call_gex_usd: 1,
  put_gex_usd: -1,
  atm_iv: 0.35,
  forward: 80_000,
  premium,
  max_pain: null,
  be_low: null,
  be_high: null,
});

function data(overrides: Partial<GammaData> = {}): GammaData {
  const all = exposure();
  return {
    currency: "BTC",
    books: [],
    scopes: [all],
    exposure: all,
    // Half the Greeks at the spot, a quarter either side of it.
    strikes: [
      strike(77_000, greeks(0.25)),
      strike(80_000, greeks(0.5)),
      strike(83_000, greeks(0.25)),
    ],
    curve: [],
    expiries: [expiry(NEXT, greeks(0.2), 100e6), expiry(NOV, greeks(0.8), 400e6)],
    bands: [],
    ...overrides,
  };
}

const render = (greek: "delta" | "vega" | "theta", d: GammaData | null = data()) =>
  withLocale("en", () =>
    greekPanel(greek, { data: d, params: BTC_ALL, heatmap: HEATMAP, now: NOW }),
  );

/** Each bar the chart draws, as [class, y, height]. */
const bars = (html: string) =>
  [
    ...html.matchAll(
      /<rect class="(gx-call|gx-put)" x="[^"]+" y="([^"]+)" width="[^"]+" height="([^"]+)"/g,
    ),
  ].map((m) => [m[1], Number(m[2]), Number(m[3])] as const);

describe("greek tabs", () => {
  test("only the three Greeks are tabs", () => {
    expect(["delta", "vega", "theta"].every(isGreek)).toBe(true);
    expect(isGreek("gamma")).toBe(false);
    expect(isGreek(null)).toBe(false);
    expect(greekPanelHref(HEATMAP, BTC_ALL, "vega")).toContain("&panel=vega");
  });

  test("delta draws calls above the middle and puts below it, and reads its net", () => {
    const html = render("delta");
    // The strike chart's bars; the By expiry chart under it draws its own.
    const drawn = bars(html.slice(0, html.indexOf('class="fchart cvd-chart gxx-chart"')));
    // The tallest side is the spot's calls: half of 4B against at most half of 1.5B.
    const calls = drawn.filter(([cls]) => cls === "gx-call");
    const puts = drawn.filter(([cls]) => cls === "gx-put");
    expect(calls.length).toBe(3);
    expect(puts.length).toBe(3);
    for (const [, y, h] of calls) expect(y + h).toBeCloseTo(500, 0);
    for (const [, y] of puts) expect(y).toBe(500);
    expect(Math.max(...calls.map(([, , h]) => h))).toBeCloseTo(500, 0);
    expect(html).toContain("Net delta");
    expect(html).toContain("+$2.5B");
    // Deribit's book in coins too: 2.5B over a spot of 80,000.
    expect(html).toContain("≈ 31,250 BTC at the spot");
    // The expiry holding most of it: November, 80%.
    expect(html).toContain("80% of it in that expiry");
    expect(html).toContain('href="/rates?gex=BTC&amp;gexp=7d#delta"');
  });

  test("vega stacks each strike's calls and puts up from the floor", () => {
    const html = render("vega");
    const drawn = bars(html);
    const spot = drawn.filter(([, y]) => y < 1000 && y >= 0);
    // At the spot: calls 6M from the floor, puts 3M on top of them, the pair the chart's peak.
    const call = spot.find(([cls, , h]) => cls === "gx-call" && h > 600);
    const put = spot.find(([cls, , h]) => cls === "gx-put" && h > 300);
    expect(call?.[1]).toBeCloseTo(1000 - (call?.[2] ?? 0), 0);
    expect(put?.[1]).toBeCloseTo(0, 0);
    expect(html).toContain("gk-stack");
    expect(html).toContain("$18.0M");
    // The readout calls a band's sum its total, since vega has one sign.
    expect(html).toContain('"gexNet":"total {usd}"');
  });

  test("theta hangs from the top and gives the decay rate against the premium", () => {
    const html = render("theta");
    const drawn = bars(html);
    const calls = drawn.filter(([cls]) => cls === "gx-call");
    for (const [, y] of calls) expect(y).toBe(0);
    expect(html).toContain("−$8.0M");
    // 8M a day against 500M of premium.
    expect(html).toContain("1.60%");
    expect(html).toContain("Decay rate");
  });

  test("a book read before the collector kept the Greeks says so", () => {
    const old = exposure({
      call_delta: null,
      put_delta: null,
      call_vega: null,
      put_vega: null,
      call_theta: null,
      put_theta: null,
    });
    const html = render("vega", data({ scopes: [old], exposure: old }));
    expect(html).toContain("have not been computed for BTC yet");
    expect(html).not.toContain("<figure");
  });

  test("a failed read and a dead book keep the controls", () => {
    expect(render("delta", null)).toContain("could not be read right now");
    const dead = exposure({ computed_at: new Date(NOW - 7 * 3600_000) });
    expect(render("theta", data({ scopes: [dead], exposure: dead }))).toContain(
      "too long ago to show as current positioning",
    );
  });

  test("the fragment is a lazy body", () => {
    const html = withLocale("en", () =>
      greekFragment("delta", { data: data(), params: BTC_ALL, heatmap: HEATMAP, now: NOW }),
    );
    expect(html.startsWith(`<div class="lazy-body" data-rendered="${NOW}">`)).toBe(true);
  });

  test("each Greek tab has the shared By expiry chart, opening on its own Greek", () => {
    for (const greek of ["delta", "vega", "theta"] as const) {
      const html = render(greek);
      expect(html).toContain(`data-live="${greek}-expiry-chart"`);
      expect(html).toContain(`data-gxx-view="greek" aria-pressed="true"`);
      expect(html).toContain(`>${greek}</button>`);
      expect(html).not.toContain("gk-share");
    }
    // The readout names the tab's Greek in place of gamma.
    expect(render("vega")).toContain('"xpGamma":"vega {calls} / {puts}, total {net}"');
  });
});
