import { describe, expect, test } from "bun:test";
import type { GammaBook, GammaData, GammaExpiry, GammaExposure, GammaStrike } from "../app/data";
import type { GammaParams, HeatmapParams } from "../app/params";
import {
  bandStrikes,
  curveAt,
  expiryTicks,
  fitRange,
  freshness,
  GAMMA_DAYS_REFUSE_MS,
  GAMMA_DAYS_STALE_MS,
  GAMMA_REFUSE_MS,
  GAMMA_SESSION_STALE_MS,
  GAMMA_STALE_MS,
  GX_SWAP_SCRIPT,
  GX_VIEW_SCRIPT,
  GXX_VIEW_SCRIPT,
  gammaFragment,
  gammaPanel,
  gammaZones,
  inScope,
  ivScale,
  niceStep,
  sortBooks,
  strikeSpacing,
} from "./gamma";
import { withLocale } from "./i18n";
import { PICK_SCRIPT } from "./picker";
import {
  type ExpirySlots,
  expiryText,
  type GammaSlots,
  gammaText,
  SLOT_FORMAT,
} from "./slot-chart";

const NO_GREEKS = {
  call_delta: null,
  put_delta: null,
  call_vega: null,
  put_vega: null,
  call_theta: null,
  put_theta: null,
};

const NOW = Date.parse("2026-10-15T14:30:00Z");
const HEATMAP: HeatmapParams = { tf: "now", limit: 50, offset: 0 };
const BTC_ALL: GammaParams = { currency: "BTC", scope: "all" };

const strike = (k: number, call: number, put: number): GammaStrike => ({
  ...NO_GREEKS,
  strike: k,
  call_oi: call / 1000,
  put_oi: -put / 1000,
  call_gex_usd: call,
  put_gex_usd: put,
});

function exposure(overrides: Partial<GammaExposure> = {}): GammaExposure {
  return {
    ...NO_GREEKS,
    scope: "all",
    computed_at: new Date(NOW - 3 * 60_000),
    source: "deribit",
    unit: "USD",
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

const book = (currency: string, source: string, unit: string, over: Partial<GammaBook> = {}) => ({
  currency,
  source,
  unit,
  computed_at: new Date(NOW - 3 * 60_000),
  spot: 80_000,
  call_gex_usd: 312e6,
  put_gex_usd: -282.1e6,
  net_gex_usd: 29.9e6,
  flip_price: 79_512.4,
  ...over,
});

/** Every region, out of order, and a book the site has no name for. */
const BOOKS: GammaBook[] = [
  book("SX5E", "eurex", "EUR", { spot: 6_165.3, net_gex_usd: -6.5e9, flip_price: null }),
  book("HSI", "hkex", "HKD", {
    spot: 24_062,
    net_gex_usd: -223e6,
    computed_at: new Date("2026-10-14T08:10:00Z"),
  }),
  book("ETH", "deribit", "USD", { spot: 2_461.9, net_gex_usd: 13e6 }),
  book("SPX", "cboe", "USD", { spot: 7_744.06, net_gex_usd: -7.1e9, flip_price: 7_749 }),
  book("BTC", "deribit", "USD"),
  book("ZZZ", "cboe", "USD", { spot: 12.5 }),
];

function gammaData(overrides: Partial<GammaData> = {}): GammaData {
  const all = exposure();
  return {
    currency: "BTC",
    books: BOOKS,
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
        ...NO_GREEKS,
        expiry: new Date("2026-10-16T08:00:00Z"),
        options: 48,
        call_oi: 7_756,
        put_oi: 10_336,
        call_gex_usd: 21e6,
        put_gex_usd: -75.9e6,
        atm_iv: null,
        forward: null,
        premium: null,
        max_pain: null,
        be_low: null,
        be_high: null,
      },
      {
        ...NO_GREEKS,
        expiry: new Date("2026-12-25T08:00:00Z"),
        options: 112,
        call_oi: 81_312,
        put_oi: 40_000,
        call_gex_usd: 90e6,
        put_gex_usd: -60e6,
        atm_iv: null,
        forward: null,
        premium: null,
        max_pain: null,
        be_low: null,
        be_high: null,
      },
    ],
    bands: [],
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
    expect(html).toContain('href="/rates?tf=7d&amp;gex=ETH#gamma" data-gx-swap data-q="eth ');
    expect(html).toContain(
      'class="wh-pick-row on" href="/rates?tf=7d&amp;gex=BTC#gamma" data-gx-swap data-q="btc bitcoin bitcoin deribit usd" aria-current="true">',
    );
    expect(html).toContain(
      'href="/rates?tf=7d&amp;gex=BTC&amp;gexp=next#gamma" data-gx-swap>Next: Oct 16<',
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
    expect(panel(gammaData({ exposure: null, scopes: [] }))).toContain(
      "No gamma exposure has been computed for BTC yet.",
    );
    const stale = exposure({ computed_at: new Date(NOW - GAMMA_STALE_MS - 60_000) });
    expect(panel(gammaData({ exposure: stale }))).toContain("Not updated since 21m ago");
    const dead = exposure({ computed_at: new Date(NOW - GAMMA_REFUSE_MS - 60_000) });
    const html = panel(gammaData({ exposure: dead }));
    expect(html).toContain("Deribit's BTC options were last read 6h 01m ago");
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

describe("expected move", () => {
  // The fixture's two expiries with IVs: 23.3% to the next (17h30 ahead), 36% at Christmas.
  const withIv = () =>
    gammaData({
      expiries: gammaData().expiries.map((x, i) => ({
        ...x,
        atm_iv: i === 0 ? 0.233 : 0.36,
        forward: 80_000,
        premium: null,
        max_pain: null,
        be_low: null,
        be_high: null,
      })),
      bands: [
        {
          horizon_days: 1,
          samples: 2035,
          inside_1s: 1634,
          inside_2s: 1960,
          first_day: "2021-03-24",
          last_day: "2026-10-18",
        },
      ],
    });

  test("one mind map: the book at the centre, a branch per horizon, the walls as leaves", () => {
    const html = panel(withIv());
    const map = html.slice(html.indexOf('<section class="em"'), html.indexOf("</section>"));
    expect(map).toContain('<span class="em-cur">BTC</span>');
    expect(map).toContain("em-has-l em-has-r");
    expect([...map.matchAll(/class="em-branch" data-k="([a-z0-9]+)"/g)].map((m) => m[1])).toEqual([
      "next",
      "1d",
      "7d",
      "30d",
    ]);
    // The next expiry's IV, and its 1σ walls: 80,000 x 23.3% x sqrt(17.55h / 8760h).
    expect(map).toContain("IV 23.3%");
    const move =
      80_000 *
      0.233 *
      Math.sqrt((Date.parse("2026-10-16T08:00:00Z") - (NOW - 3 * 60_000)) / (365 * 86_400_000));
    expect(map).toContain(
      `1σ ${Math.round(80_000 - move).toLocaleString("en-US")} – ${Math.round(80_000 + move).toLocaleString("en-US")}`,
    );
    // The band check on the day-ahead branch only.
    expect(map.match(/class="em-hits"/g)?.length).toBe(1);
    expect(map).toContain("closed inside 1σ on <b>80%</b> and 2σ on <b>96%</b> of days since 2021");
  });

  test("the chart draws the walls for the chosen expiries, 30 days ahead for all of them", () => {
    const all = panel(withIv());
    expect(all).toContain("expected move, 1σ and 2σ, 30 days ahead");
    expect(all.match(/class="gx-em1"/g)?.length).toBe(2);
    const next = panel(withIv(), { currency: "BTC", scope: "next" });
    expect(next).toContain("expected move, 1σ and 2σ, to the Oct 16 expiry");
  });

  test("the expiry table gives each expiry's IV", () => {
    const html = panel(withIv());
    expect(html).toContain('<th class="num" title=');
    expect(html).toContain("23.3%</td>");
    expect(html).toContain("36.0%</td>");
  });

  test("a book read before the IVs were kept shows no map and no walls", () => {
    const html = panel(gammaData());
    expect(html).not.toContain('class="em"');
    expect(html).not.toContain("gx-em1");
    expect(html).toContain('<span class="dim">–</span></td>');
  });

  test("every language has the map's words", () => {
    for (const locale of ["zh", "ja", "ko", "ru"] as const) {
      const html = withLocale(locale, () => panel(withIv()));
      expect(html).not.toContain("Expected price move");
      expect(html).not.toContain("days ahead");
    }
  });
});

describe("book picker", () => {
  test("every stored book, by region and then the collector's order, each row a reading", () => {
    const html = panel(gammaData());
    const at = (text: string) => html.indexOf(text);
    // Regions in order, each with its count; a ticker the site has no name for after the named ones.
    expect(at(">Crypto <")).toBeLessThan(at(">United States <"));
    expect(at(">United States <")).toBeLessThan(at(">Asia-Pacific <"));
    expect(at(">Asia-Pacific <")).toBeLessThan(at(">Europe <"));
    expect(html).toContain('<p class="wh-pick-group">United States <span class="dim">2</span></p>');
    expect(html).not.toContain(">Other <");
    expect(at("gex=BTC#gamma")).toBeLessThan(at("gex=ETH#gamma"));
    expect(at("gex=SPX#gamma")).toBeLessThan(at("gex=ZZZ#gamma"));
    expect(html).toContain("<b>ZZZ</b><small>ZZZ</small>");
    // The button: the charted book, its name, its net, and how many books there are.
    expect(html).toContain(
      '<b>BTC</b><span class="gx-pick-name">Bitcoin</span><span class="num lq-ink-l">+$29.9M</span><span class="wh-pick-more dim">6 books</span>',
    );
    // A row: spot, net in its own currency, the calls/puts split, the flip from the spot, the age.
    expect(html).toContain("<b>SPX</b><small>S&amp;P 500</small>");
    expect(html).toContain('<span class="num lq-ink-s">−€6.5B</span>');
    expect(html).toContain('<span class="num lq-ink-s">−HK$223M</span>');
    expect(html).toContain('<i class="wh-pick-bid" style="width:52.5%"></i>');
    expect(html).toContain('<span class="num">+0.1%</span>');
    expect(html).toContain('<span class="gx-pick-when dim">Deribit · 3m ago</span>');
    expect(html).toContain('<span class="gx-pick-when dim">HKEX · close Oct 14</span>');
    // Found by its name in the page's language too, and grouped headings hide with their rows.
    expect(html).toContain('data-q="hsi hang seng hang seng hkex hkd"');
    expect(() => new Function(PICK_SCRIPT)).not.toThrow();
    expect(PICK_SCRIPT).toContain(".wh-pick-group");
  });

  test("in Chinese, the names and regions are translated and still found in English", () => {
    const html = withLocale("zh", () => panel(gammaData()));
    expect(html).toContain("<b>HSI</b><small>恒生指数</small>");
    expect(html).toContain('data-q="hsi hang seng 恒生指数 hkex hkd"');
    expect(html).toContain('<p class="wh-pick-group">亚太 <span class="dim">1</span></p>');
  });

  test("chip and memory books get a group of their own after the United States", () => {
    const books = [
      book("HSI", "hkex", "HKD"),
      book("SKHY", "cboe", "USD"),
      book("TSLA", "cboe", "USD"),
      book("NVDA", "cboe", "USD"),
      book("SPX", "cboe", "USD"),
    ];
    expect(sortBooks(books).map((b) => b.currency)).toEqual(["SPX", "TSLA", "NVDA", "SKHY", "HSI"]);
    const html = panel(gammaData({ books }));
    const at = (text: string) => html.indexOf(text);
    expect(html).toContain('<p class="wh-pick-group">United States <span class="dim">2</span></p>');
    expect(html).toContain(
      '<p class="wh-pick-group">Chips and memory <span class="dim">2</span></p>',
    );
    expect(at(">United States <")).toBeLessThan(at(">Chips and memory <"));
    expect(at(">Chips and memory <")).toBeLessThan(at("gex=SKHY#gamma"));
    expect(at("gex=SKHY#gamma")).toBeLessThan(at(">Asia-Pacific <"));
    expect(html).toContain("<b>SKHY</b><small>SK hynix (ADR)</small>");
    const ko = withLocale("ko", () => panel(gammaData({ books })));
    expect(ko).toContain('<p class="wh-pick-group">반도체·메모리 <span class="dim">2</span></p>');
    expect(ko).toContain("<b>SKHY</b><small>SK하이닉스(ADR)</small>");
  });

  test("biotech and metals books get groups of their own, gold and silver with the miners", () => {
    const books = [
      book("GLD", "cboe", "USD"),
      book("LLY", "cboe", "USD"),
      book("FCX", "cboe", "USD"),
      book("NVDA", "cboe", "USD"),
      book("SPX", "cboe", "USD"),
    ];
    expect(sortBooks(books).map((b) => b.currency)).toEqual(["SPX", "NVDA", "LLY", "GLD", "FCX"]);
    const html = panel(gammaData({ books }));
    const at = (text: string) => html.indexOf(text);
    expect(at(">Chips and memory <")).toBeLessThan(at(">Biotech and health <"));
    expect(at(">Biotech and health <")).toBeLessThan(at(">Metals and mining <"));
    expect(html).toContain(
      '<p class="wh-pick-group">Metals and mining <span class="dim">2</span></p>',
    );
    expect(html).toContain("<b>LLY</b><small>Eli Lilly</small>");
    const zh = withLocale("zh", () => panel(gammaData({ books })));
    expect(zh).toContain('<p class="wh-pick-group">金属与矿业 <span class="dim">2</span></p>');
    expect(zh).toContain("<b>FCX</b><small>自由港麦克莫兰</small>");
  });

  test("an unknown publisher's book goes under Other, and an order holds without a name", () => {
    const sorted = sortBooks([
      book("NEW", "sgx", "SGD"),
      book("AAA", "cboe", "USD"),
      book("SPX", "cboe", "USD"),
      book("ETH", "deribit", "USD"),
    ]).map((b) => b.currency);
    expect(sorted).toEqual(["ETH", "SPX", "AAA", "NEW"]);
    const html = panel(gammaData({ books: [book("NEW", "sgx", "SGD")] }));
    expect(html).toContain(">Other <");
    expect(html).toContain('<span class="num lq-ink-l">+SGD 29.9M</span>');
  });

  test("before any book is stored, the asked one stands alone", () => {
    const html = panel(gammaData({ books: [], exposure: null, scopes: [] }));
    expect(html).not.toContain("wh-pick");
    expect(html).toContain('data-gx-swap aria-current="true">BTC</a>');
  });
});

describe("other publishers", () => {
  const CLOSE = new Date("2026-10-14T08:10:00Z");
  const hsi = (over: Partial<GammaExposure> = {}) =>
    exposure({
      source: "hkex",
      unit: "HKD",
      computed_at: CLOSE,
      spot: 24_062,
      call_oi: 40_000,
      put_oi: 52_000,
      call_gex_usd: 1.2e9,
      put_gex_usd: -1.42e9,
      net_gex_usd: -223e6,
      flip_price: 24_400,
      call_wall: 26_000,
      put_wall: 23_000,
      next_expiry: new Date("2026-10-15T08:00:00Z"),
      ...over,
    });
  const hsiData = (over: Partial<GammaData> = {}) =>
    gammaData({
      currency: "HSI",
      scopes: [hsi()],
      exposure: hsi(),
      strikes: [
        {
          ...NO_GREEKS,
          strike: 23_000,
          call_oi: 100,
          put_oi: 4_000,
          call_gex_usd: 1e6,
          put_gex_usd: -300e6,
        },
        {
          ...NO_GREEKS,
          strike: 24_000,
          call_oi: 3_000,
          put_oi: 3_000,
          call_gex_usd: 250e6,
          put_gex_usd: -260e6,
        },
        {
          ...NO_GREEKS,
          strike: 26_000,
          call_oi: 5_000,
          put_oi: 10,
          call_gex_usd: 400e6,
          put_gex_usd: -1e6,
        },
      ],
      curve: [
        { price: 21_000, net_gex_usd: -900e6 },
        { price: 24_062, net_gex_usd: -223e6 },
        { price: 27_000, net_gex_usd: 600e6 },
      ],
      expiries: [
        {
          ...NO_GREEKS,
          expiry: new Date("2026-10-15T08:00:00Z"),
          options: 120,
          call_oi: 8_000,
          put_oi: 9_000,
          call_gex_usd: 300e6,
          put_gex_usd: -500e6,
          atm_iv: null,
          forward: null,
          premium: null,
          max_pain: null,
          be_low: null,
          be_high: null,
        },
        {
          ...NO_GREEKS,
          expiry: new Date("2026-10-29T08:00:00Z"),
          options: 400,
          call_oi: 32_000,
          put_oi: 43_000,
          call_gex_usd: 900e6,
          put_gex_usd: -920e6,
          atm_iv: null,
          forward: null,
          premium: null,
          max_pain: null,
          be_low: null,
          be_high: null,
        },
      ],
      ...over,
    });
  const HSI_ALL: GammaParams = { currency: "HSI", scope: "all" };

  test("an index book reads in its own currency, from its exchange's file", () => {
    const html = panel(hsiData(), HSI_ALL);
    expect(html).toContain("HSI · HKEX options · gamma exposure by strike · All expiries");
    expect(html).toContain('data-u="net">−HK$223M<');
    expect(html).toContain('data-u="call-oi">HK$962M<');
    expect(html).toContain(
      'HKEX options, <span data-live="gamma-asof">from the end-of-day file for Oct 14</span>.',
    );
    // A day old and fresh: an end-of-day file is read once a day.
    expect(html).not.toContain("gx-stale");
    // Open interest by value at the spot; the expiry the file's evening read already passed.
    expect(html).toContain('<th class="num">Call OI</th>');
    expect(html).toContain('<td class="num">HK$192M</td>');
    expect(html).toContain('<td class="num dim">expired</td>');
    expect(html).toContain("Exposure in HKD per 1% move; open interest at its value at the spot.");
    expect(html).not.toContain("Every Deribit option");
    // The axis labels and the hover payload carry the symbol, and open interest by value.
    expect(html).toContain('"cur":"HK$"');
    expect(html).toContain('"unit":""');
    expect(html).toContain('<span class="cvd-yl" style="top:25%">+HK$');
    const json = /<script type="application\/json" class="slot-data">(.*?)<\/script>/.exec(
      html,
    )?.[1];
    const d = JSON.parse(json ?? "null") as GammaSlots;
    const i = Math.floor((24_000 - d.low) / d.step);
    const text = gammaText(d, i, SLOT_FORMAT);
    expect(text).toContain('calls <b class="lq-ink-l">+HK$250M</b> (HK$72.2M open)');
  });

  test("a US book says it is delayed, and is late only when the session should have read it", () => {
    const at = Date.parse("2026-10-15T18:00:00Z"); // a Thursday, in the session
    const spx = (minutes: number) =>
      exposure({ source: "cboe", computed_at: new Date(at - minutes * 60_000), spot: 7_744 });
    const html = panel(
      gammaData({ currency: "SPX", exposure: spx(10) }),
      { currency: "SPX", scope: "all" },
      at,
    );
    expect(html).toContain(
      'Cboe options, <span data-live="gamma-asof">15-minute delayed, read 10m ago</span>.',
    );
    expect(html).toContain('<th class="num">Call OI</th>');
    const late = panel(
      gammaData({ currency: "SPX", exposure: spx(60) }),
      { currency: "SPX", scope: "all" },
      at,
    );
    expect(late).toContain("nothing newer has been read from Cboe, a holiday or a failed read");
  });

  test("freshness follows each publisher's rhythm", () => {
    const ago = (ms: number) => new Date(NOW - ms);
    expect(freshness("deribit", ago(GAMMA_STALE_MS - 1), NOW)).toBe("fresh");
    expect(freshness("deribit", ago(GAMMA_STALE_MS + 1), NOW)).toBe("late");
    expect(freshness("deribit", ago(GAMMA_REFUSE_MS + 1), NOW)).toBe("dead");
    // NOW is a Thursday at 14:30 UTC, the session's first core minute.
    expect(freshness("cboe", ago(GAMMA_SESSION_STALE_MS + 1), NOW)).toBe("late");
    const saturday = Date.parse("2026-10-17T15:00:00Z");
    expect(freshness("cboe", new Date(saturday - 40 * 3600_000), saturday)).toBe("fresh");
    expect(freshness("cboe", new Date(saturday - GAMMA_DAYS_STALE_MS - 1), saturday)).toBe("late");
    expect(freshness("hkex", ago(3 * 86_400_000), NOW)).toBe("fresh");
    expect(freshness("hkex", ago(GAMMA_DAYS_STALE_MS + 1), NOW)).toBe("late");
    expect(freshness("cffex", ago(GAMMA_DAYS_REFUSE_MS + 1), NOW)).toBe("dead");
    expect(freshness("sgx", ago(3 * 86_400_000), NOW)).toBe("fresh");
  });

  test("a late file says so, and a dead one names its exchange", () => {
    const late = panel(
      hsiData({ exposure: hsi({ computed_at: new Date(NOW - 5 * 86_400_000) }) }),
      HSI_ALL,
    );
    expect(late).toContain("nothing newer has been read from HKEX");
    const dead = panel(
      hsiData({ exposure: hsi({ computed_at: new Date(NOW - 15 * 86_400_000) }) }),
      HSI_ALL,
    );
    expect(dead).toContain("HKEX's HSI options were last read 15d 0h ago");
    expect(dead).toContain("too long ago to show as current positioning");
    expect(dead).not.toContain("gx-chart");
  });

  test("a range with no expiry in it says when the nearest is, not that nothing was computed", () => {
    const html = panel(hsiData({ exposure: null }), { currency: "HSI", scope: "7d" });
    expect(html).toContain("No HSI option expires in this range; the nearest expires Oct 15.");
    // Only "all" is stored here, so the other three ranges are dimmed, "all" is not.
    expect(html).toContain(
      'href="/rates?gex=HSI&amp;gexp=7d#gamma" class="gx-none" title="No expiry in this range" data-gx-swap aria-current="true">',
    );
    expect(html).toContain('href="/rates?gex=HSI#gamma" data-gx-swap>All expiries<');
    expect(html).not.toContain("has been computed");
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

describe("by expiry chart", () => {
  const expiry = (iso: string, over: Partial<GammaExpiry> = {}): GammaExpiry => ({
    ...NO_GREEKS,
    expiry: new Date(iso),
    options: 40,
    call_oi: 1_000,
    put_oi: 500,
    call_gex_usd: 2e6,
    put_gex_usd: -1e6,
    atm_iv: 0.3,
    forward: 80_000,
    premium: 50e6,
    max_pain: 79_000,
    be_low: 76_000,
    be_high: 83_000,
    ...over,
  });
  const expiries = [
    expiry("2026-10-16T08:00:00Z", { atm_iv: 0.25 }),
    expiry("2026-10-23T08:00:00Z", { call_oi: 4_000, put_oi: 2_000, atm_iv: null }),
    expiry("2026-12-25T08:00:00Z", { atm_iv: 0.4, premium: null, max_pain: null }),
  ];
  const slots = (html: string) => {
    const all = [
      ...html.matchAll(/<script type="application\/json" class="slot-data">(.*?)<\/script>/g),
    ];
    return JSON.parse(all.at(-1)?.[1] ?? "null") as ExpirySlots;
  };

  test("ticks and the IV scale", () => {
    expect(expiryTicks(11)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(expiryTicks(3)).toEqual([0, 1, 2]);
    expect(expiryTicks(54).length).toBe(7);
    const [lo, quarter] = ivScale([0.194, 0.272, 0.389]);
    expect([lo, quarter]).toEqual([0.1, 0.1]);
    const [lo2, q2] = ivScale([0.114, 0.16]);
    expect(lo2).toBeCloseTo(0.1, 9);
    expect(q2).toBeCloseTo(0.02, 9);
    expect(lo2 + 4 * q2).toBeGreaterThanOrEqual(0.16);
  });

  test("one bar per expiry for each reading, the IV line broken where an expiry has none", () => {
    const html = panel(gammaData({ expiries }), { currency: "BTC", scope: "7d" });
    const figure = html.slice(html.indexOf('<figure class="fchart cvd-chart gxx-chart"'));
    expect(figure).toContain("BTC · Deribit options · by expiry");
    const oi = /<g class="gxx-v gxx-v-oi">(.*?)<\/g>/.exec(figure)?.[1] ?? "";
    expect(oi.match(/<rect/g)?.length).toBe(6);
    // The second expiry's 4,000 calls are the peak: its bar fills the top half.
    expect(oi).toContain('y="0.0" width');
    // Read Oct 15 14:27, the 7-day range ends Oct 22: Oct 23 and December are dimmed, both bars each.
    expect(oi.match(/gxx-out/g)?.length).toBe(4);
    // Two IV points either side of a gap: no line can join them, only dots.
    const iv = /<g class="gxx-v gxx-v-iv">(.*?)<\/g>/.exec(figure)?.[1] ?? "";
    expect(iv).not.toContain("<polyline");
    expect(iv.match(/gxx-dot/g)?.length).toBe(2);
    expect(figure).toContain("3 expiries · open interest");
    expect(figure).toContain("not to scale");
    const d = slots(html);
    expect(d.kind).toBe("gexx");
    expect(d.coin).toBe("BTC");
    expect(d.slots.length).toBe(3);
    expect(d.slots[2]?.[8]).toBeNull();
  });

  test("the readout gives an expiry in full, leaving out what the book lacks", () => {
    const d = slots(panel(gammaData({ expiries }), BTC_ALL));
    const first = expiryText(d, 0, SLOT_FORMAT);
    expect(first).toContain("Oct 16 2026");
    expect(first).toContain("40 options");
    expect(first).toContain("calls 1,000 BTC ($80.0M) open");
    expect(first).toContain("put/call 0.50");
    expect(first).toContain(
      'gamma <b class="lq-ink-l">+$2.0M</b> / <b class="lq-ink-s">−$1.0M</b>',
    );
    expect(first).toContain("ATM IV 25.0%");
    expect(first).toContain("max pain 79,000");
    expect(first).toContain("dealer range 76,000 – 83,000");
    expect(first).toContain("premium $50.0M");
    const last = expiryText(d, 2, SLOT_FORMAT);
    expect(last).not.toContain("max pain");
    expect(last).not.toContain("premium");
    expect(expiryText(d, 1, SLOT_FORMAT)).not.toContain("ATM IV");
  });

  test("the view switch keeps the reader's choice on <html>", () => {
    expect(GXX_VIEW_SCRIPT).toContain('localStorage.getItem("gamma-expiry-view")');
    expect(GXX_VIEW_SCRIPT).toContain("document.documentElement.dataset.gxx = view");
    expect(() => new Function(GXX_VIEW_SCRIPT)).not.toThrow();
  });
});
