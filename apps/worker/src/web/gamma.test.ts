import { describe, expect, test } from "bun:test";
import type { GammaData, GammaExposure, GammaStrike } from "../app/data";
import type { GammaParams, HeatmapParams } from "../app/params";
import {
  bandStrikes,
  curveAt,
  fitRange,
  GAMMA_REFUSE_MS,
  GAMMA_STALE_MS,
  GX_SWAP_SCRIPT,
  GX_VIEW_SCRIPT,
  gammaFragment,
  gammaPanel,
  gammaZones,
  inScope,
  niceStep,
  strikeSpacing,
} from "./gamma";
import { withLocale } from "./i18n";
import { type GammaSlots, gammaText, SLOT_FORMAT } from "./slot-chart";

const NOW = Date.parse("2026-10-15T14:30:00Z");
const HEATMAP: HeatmapParams = { tf: "now", limit: 50, offset: 0 };
const BTC_ALL: GammaParams = { currency: "BTC", scope: "all" };

const strike = (k: number, call: number, put: number): GammaStrike => ({
  strike: k,
  call_oi: call / 1000,
  put_oi: -put / 1000,
  call_gex_usd: call,
  put_gex_usd: put,
});

function exposure(overrides: Partial<GammaExposure> = {}): GammaExposure {
  return {
    scope: "all",
    computed_at: new Date(NOW - 3 * 60_000),
    source: "deribit",
    spot: 80_000,
    options: 778,
    expiries: 12,
    first_expiry: new Date("2026-10-16T08:00:00Z"),
    last_expiry: new Date("2027-09-24T08:00:00Z"),
    next_expiry: new Date("2026-10-16T08:00:00Z"),
    call_oi: 246_697,
    put_oi: 152_229,
    call_gex_usd: 312e6,
    put_gex_usd: -282.1e6,
    net_gex_usd: 29.9e6,
    flip_price: 79_512.4,
    call_wall: 90_000,
    put_wall: 78_000,
    ...overrides,
  };
}

function gammaData(overrides: Partial<GammaData> = {}): GammaData {
  const all = exposure();
  return {
    currency: "BTC",
    scopes: [all, exposure({ scope: "next", options: 48, expiries: 1, net_gex_usd: -54.9e6 })],
    exposure: all,
    strikes: [
      strike(40_000, 1e3, -2e5),
      strike(78_000, 6e6, -32e6),
      strike(79_500, 1e6, -9e6),
      strike(80_000, 29e6, -60e6),
      strike(80_500, 9e6, -8e6),
      strike(82_000, 20e6, -16e6),
      strike(90_000, 44e6, -1e6),
    ],
    curve: [
      { price: 72_000, net_gex_usd: -40e6 },
      { price: 80_000, net_gex_usd: 29.9e6 },
      { price: 88_000, net_gex_usd: 200e6 },
    ],
    expiries: [
      {
        expiry: new Date("2026-10-16T08:00:00Z"),
        options: 48,
        call_oi: 7_756,
        put_oi: 10_336,
        call_gex_usd: 21e6,
        put_gex_usd: -75.9e6,
      },
      {
        expiry: new Date("2026-12-25T08:00:00Z"),
        options: 112,
        call_oi: 81_312,
        put_oi: 40_000,
        call_gex_usd: 90e6,
        put_gex_usd: -60e6,
      },
    ],
    ...overrides,
  };
}

const panel = (data: GammaData | null, params = BTC_ALL, now = NOW) =>
  gammaPanel({ data, params, heatmap: HEATMAP, now });

describe("binning", () => {
  test("niceStep rounds up to 1, 2, 2.5 or 5 times a power of ten", () => {
    expect([1, 3, 21, 405, 540, 2500, 7000].map(niceStep)).toEqual([
      1, 5, 25, 500, 1000, 2500, 10000,
    ]);
  });

  test("strikeSpacing is the most common gap, the smaller on a tie", () => {
    expect(strikeSpacing([78_000, 78_500, 79_000, 79_500, 80_000, 81_000, 82_000])).toBe(500);
    expect(strikeSpacing([2240, 2250, 2260, 2280, 2300, 2320])).toBe(20);
    expect(strikeSpacing([1, 2, 4])).toBe(1);
    expect(strikeSpacing([100])).toBe(0);
  });

  test("fitRange takes the narrowest reach holding 90% of the exposure", () => {
    const near = [strike(100, 50, -50), strike(103, 40, 0), strike(150, 5, 0)];
    expect(fitRange(near, 100)).toBe(0.05);
    expect(fitRange([...near, strike(118, 30, 0)], 100)).toBe(0.2);
    expect(fitRange([], 100)).toBe(0.3);
  });

  test("bands start on multiples of the step and name the strikes they hold", () => {
    const b = bandStrikes(gammaData().strikes, 80_000);
    expect(b.range).toBe(0.15);
    expect(b.step).toBe(500);
    expect(b.low).toBe(68_000);
    expect(b.count).toBe(48);
    const at = (price: number) => Math.floor((price - b.low) / b.step);
    expect(b.labels[at(80_000)]).toBe("80,000");
    expect(b.calls[at(80_000)]).toBe(29e6);
    expect(b.puts[at(90_000)]).toBe(-1e6);
    // 40,000 is off the axis, and counted as beyond it.
    expect(b.beyond).toBe(2.01e5);
    // A band holding two strikes names both.
    const wide = bandStrikes([strike(2240, 1, -1), strike(2250, 1, -1), strike(2260, 1, -1)], 2250);
    expect(wide.step).toBe(10);
    const coarse = bandStrikes(
      [
        strike(2240, 1, -1),
        strike(2250, 1, -1),
        strike(2260, 1, -1),
        strike(2280, 1, -1),
        strike(2300, 1, -1),
        strike(2320, 1, -1),
        strike(2340, 1, -1),
      ],
      2290,
    );
    expect(coarse.step).toBe(20);
    expect(coarse.labels).toContain("2,240–2,250");
  });

  test("curveAt interpolates and is null beyond the curve", () => {
    const curve = gammaData().curve;
    expect(curveAt(curve, 76_000)).toBe(-5.05e6);
    expect(curveAt(curve, 80_000)).toBe(29.9e6);
    expect(curveAt(curve, 70_000)).toBeNull();
  });

  test("inScope follows the collector's rule", () => {
    const at = new Date("2026-10-15T14:00:00Z");
    const next = new Date("2026-10-16T08:00:00Z");
    const week = new Date("2026-10-22T08:00:00Z");
    const later = new Date("2026-10-23T08:00:00Z");
    expect(inScope("next", next, next, at)).toBe(true);
    expect(inScope("next", week, next, at)).toBe(false);
    expect(inScope("7d", week, next, at)).toBe(true);
    expect(inScope("7d", later, next, at)).toBe(false);
    expect(inScope("30d", later, next, at)).toBe(true);
    expect(inScope("all", new Date("2027-09-24T08:00:00Z"), next, at)).toBe(true);
  });
});

describe("zones", () => {
  const p = (price: number, net_gex_usd: number) => ({ price, net_gex_usd });

  test("split where the line crosses zero, interpolated, and clipped to the axis", () => {
    const curve = [p(70_000, -30), p(75_000, -10), p(80_000, 10), p(85_000, 30), p(90_000, -10)];
    expect(gammaZones(curve, 72_000, 88_000)).toEqual([
      { from: 72_000, to: 77_500, short: true },
      { from: 77_500, to: 88_000, short: false },
    ]);
    const whole = gammaZones(curve, 60_000, 100_000);
    expect(whole.map((z) => [z.from, z.to, z.short])).toEqual([
      [70_000, 77_500, true],
      [77_500, 88_750, false],
      [88_750, 90_000, true],
    ]);
  });

  test("none beyond the line's reach, and one sign is one zone", () => {
    expect(gammaZones([], 0, 1)).toEqual([]);
    expect(gammaZones([p(80_000, 5)], 0, 100_000)).toEqual([]);
    expect(gammaZones([p(80_000, 5), p(90_000, 1)], 85_000, 100_000)).toEqual([
      { from: 85_000, to: 90_000, short: false },
    ]);
  });
});

describe("panel", () => {
  test("tiles, chart and expiries, every switch keeping the grid's timeframe", () => {
    const html = gammaPanel({
      data: gammaData(),
      params: BTC_ALL,
      heatmap: { ...HEATMAP, tf: "7d" },
      now: NOW,
    });
    expect(html).toContain('data-u="net">+$29.9M<');
    expect(html).toContain("dealers long gamma: their hedging damps moves");
    expect(html).toContain('data-u="flip">79,512<');
    expect(html).toContain("−0.6% from spot; net gamma changes sign here");
    expect(html).toContain('class="lq-ink-l" data-u="call-wall">90,000<');
    expect(html).toContain('class="lq-ink-s" data-u="put-wall">78,000<');
    expect(html).toContain('data-u="call-oi">$19.7B<');
    expect(html).toContain("put/call 0.62 · 778 options, 12 expiries");
    // The chart: a hover payload of kind gex, the crosshair, and the flip in the key.
    expect(html).toContain(
      'class="fchart cvd-chart gx-chart" data-live="gamma-chart" data-cursors',
    );
    expect(html).toContain('"kind":"gex"');
    expect(html).toContain("flip 79,512");
    expect(html).toContain('class="gx-flip"');
    // Ticks on round prices.
    expect(html).toContain(">68,000 <");
    expect(html).toContain(">92,000 <");
    // The switches: in place, keeping tf, naming the book; the next expiry by its date.
    expect(html).toContain('href="/rates?tf=7d&gex=ETH#gamma" data-gx-swap>ETH<');
    expect(html).toContain(
      'href="/rates?tf=7d&gex=BTC#gamma" data-gx-swap aria-current="true">BTC<',
    );
    expect(html).toContain(
      'href="/rates?tf=7d&gex=BTC&gexp=next#gamma" data-gx-swap>Next: Oct 16<',
    );
    // Both expiries in the table, neither dimmed in the all-expiry view.
    expect(html).toContain('<tr data-k="1792137600000">');
    expect(html).not.toContain("gx-out");
    expect(html).toContain("17h 30m");
    expect(html).toContain("70d 17h");
  });

  test("draws all three views, opening on calls/puts, behind a switch the script shows", () => {
    const html = panel(gammaData());
    expect(html).toContain('class="slot-modes gx-views" role="group" aria-label="View" hidden>');
    expect(html).toContain('data-gx-view="split" aria-pressed="true"');
    expect(html).toContain('data-gx-view="net" aria-pressed="false"');
    expect(html).toContain('data-gx-view="zones" aria-pressed="false"');
    // The switch sits before the cursor's, in the same row.
    expect(html.indexOf("gx-views")).toBeLessThan(html.indexOf('data-cursor="bar"'));
    expect(html).toContain('<g class="gx-v gx-v-split"><rect class="gx-call"');
    expect(html).toContain('<g class="gx-v gx-v-net"><rect class=');
    expect(html).toMatch(/<g class="gx-v gx-v-zone"><rect class="gx-zone-(short|long)"/);
    expect(html).toContain('<span class="gx-v gx-v-split">bars are each strike');
    expect(() => new Function(GX_VIEW_SCRIPT)).not.toThrow();
  });

  test("a narrower scope dims the expiries it leaves out", () => {
    const next = exposure({ scope: "next", net_gex_usd: -54.9e6, expiries: 1, options: 48 });
    const html = panel(gammaData({ exposure: next }), { currency: "BTC", scope: "next" });
    expect(html).toContain('<tr data-k="1798185600000" class="gx-out">');
    expect(html).toContain("dealers short gamma: their hedging adds to moves");
    expect(html).toContain("48 options, one expiry");
    expect(html).toContain("· Next: Oct 16</p>");
  });

  test("no flip within reach, and no put wall, read as such", () => {
    const html = panel(gammaData({ exposure: exposure({ flip_price: null, put_wall: null }) }));
    expect(html).toContain("net gamma keeps one sign within ±30% of the spot");
    expect(html).not.toContain('class="gx-flip"');
    expect(html).toContain('<span class="dim">–</span></p>');
  });

  test("a failed read, an empty book, a stale one and a dead one", () => {
    expect(panel(null)).toContain("The options data could not be read right now.");
    expect(panel(gammaData({ exposure: null }))).toContain(
      "No gamma exposure has been computed for BTC yet.",
    );
    const stale = exposure({ computed_at: new Date(NOW - GAMMA_STALE_MS - 60_000) });
    expect(panel(gammaData({ exposure: stale }))).toContain("Not updated since 21m ago");
    const dead = exposure({ computed_at: new Date(NOW - GAMMA_REFUSE_MS - 60_000) });
    const html = panel(gammaData({ exposure: dead }));
    expect(html).toContain("too long ago to show as current positioning");
    expect(html).not.toContain("gx-chart");
    // The controls stay, so a reader can still switch.
    expect(html).toContain("data-gx-swap");
  });

  test("the fragment is a bare lazy body, stamped for live.ts", () => {
    const html = gammaFragment({ data: gammaData(), params: BTC_ALL, heatmap: HEATMAP, now: NOW });
    expect(html.startsWith(`<div class="lazy-body" data-rendered="${NOW}">`)).toBe(true);
    expect(html).not.toContain("<html");
  });

  test("it reads in Chinese", () => {
    const html = withLocale("zh", () => panel(gammaData()));
    expect(html).toContain("净 Gamma 敞口");
    expect(html).toContain("最近：10月16日");
    expect(html).not.toContain("Net gamma exposure");
  });
});

describe("readout", () => {
  const slots = (): GammaSlots => {
    const html = panel(gammaData());
    const json = /<script type="application\/json" class="slot-data">(.*?)<\/script>/.exec(
      html,
    )?.[1];
    return JSON.parse(json ?? "null") as GammaSlots;
  };

  test("a band names its strike, its calls and puts, the net and the curve there", () => {
    const d = slots();
    const i = Math.floor((80_000 - d.low) / d.step);
    const text = gammaText(d, i, SLOT_FORMAT);
    expect(text).toContain("strike 80,000 (+0.3% from spot)");
    expect(text).toContain('calls <b class="lq-ink-l">+$29.0M</b> (29,000 BTC open)');
    expect(text).toContain('puts <b class="lq-ink-s">−$60.0M</b>');
    expect(text).toContain('net <b class="lq-ink-s">−$31.0M</b>');
    expect(text).toContain("if the spot were here: net");
  });

  test("an empty band gives its range", () => {
    const d = slots();
    const text = gammaText(d, 0, SLOT_FORMAT);
    expect(text).toContain("68,000 – 68,500");
    expect(text).toContain("no open interest here");
  });
});

test("the swap script parses", () => {
  expect(() => new Function(GX_SWAP_SCRIPT)).not.toThrow();
});
