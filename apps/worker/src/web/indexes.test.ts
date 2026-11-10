import { describe, expect, test } from "bun:test";
import type { IndexLevelRow } from "../app/data";
import { withLocale } from "./i18n";
import { IX_VIEW_SCRIPT, indexesPanel } from "./indexes";
import { axis, type ChartIndex, defaultWindow, indexMove } from "./indexes-charts";

const NOW = Date.parse("2026-11-10T08:00:00Z");

/** A level whose closes rise by `step` a session from 100, `n` of them, ending at the price. */
const level = (ticker: string, n: number, step: number, over: Partial<IndexLevelRow> = {}) => {
  const closes = Array.from({ length: n }, (_, i) => 100 + i * step);
  const price = closes.at(-1) ?? 100;
  return {
    ticker,
    name: ticker,
    source: "tv",
    price,
    prev_close: closes.at(-2) ?? null,
    day_high: null,
    day_low: null,
    at_ms: NOW - 60_000,
    closes,
    ...over,
  } satisfies IndexLevelRow;
};

const entry = (row: IndexLevelRow): ChartIndex => ({
  ticker: row.ticker,
  name: row.ticker,
  market: "Somewhere",
  group: "am",
  row,
});

describe("indexMove", () => {
  test("the return over N sessions, the latest session and the typical daily move", () => {
    const move = indexMove(level("X", 6, 2), 5);
    // 110 against 100 five sessions back; 110 against 108; daily moves 2/100, 2/102 ... 2/108.
    expect(move?.ret).toBeCloseTo(10, 9);
    expect(move?.day).toBeCloseTo((110 / 108 - 1) * 100, 9);
    expect(move?.swing).toBeCloseTo(
      ([100, 102, 104, 106, 108].reduce((s, b) => s + 2 / b, 0) / 5) * 100,
      9,
    );
  });

  test("too little history is no move at all, and no previous close is no latest session", () => {
    expect(indexMove(level("X", 5, 1), 5)).toBeNull();
    expect(indexMove(level("X", 6, 1, { prev_close: null }), 5)?.day).toBeNull();
  });
});

describe("defaultWindow", () => {
  test("the month once three equity indexes in four have one, volatility indexes not counted", () => {
    const month = (t: string) => entry(level(t, 22, 1));
    const week = (t: string) => entry(level(t, 9, 1));
    expect(defaultWindow([month("A"), month("B"), month("C"), week("D")])).toBe("1m");
    expect(defaultWindow([month("A"), month("B"), week("C"), week("D")])).toBe("5d");
    expect(defaultWindow([month("A"), month("B"), month("C"), entry(level("VIX", 9, 1))])).toBe(
      "1m",
    );
  });
});

describe("axis", () => {
  test("always holds zero and every value, on round steps", () => {
    const a = axis([1.2, 3.7, 0.4]);
    expect(a.from).toBe(0);
    expect(a.to).toBeGreaterThanOrEqual(3.7);
    expect(a.ticks).toContain(0);
    const b = axis([-6.4, 10.3]);
    expect(b.from).toBeLessThan(-6.4);
    expect(b.to).toBeGreaterThan(10.3);
    expect(b.ticks).toContain(0);
    // -5.8% to +8.9% takes 2.5-point steps from -7.5% rather than 5-point ones from -10%.
    expect(axis([-5.8, 8.9])).toEqual({
      from: -7.5,
      to: 10,
      ticks: [-7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10],
    });
  });
});

describe("the World indexes tab's views", () => {
  const rows: IndexLevelRow[] = [
    level("SPX", 9, 1),
    level("NDX", 9, -1, { price: 92 }),
    level("VIX", 9, 3),
    level("DAX", 9, 0.5),
    level("UKX", 4, 1),
    level("TASI", 9, -0.5),
    level("NK225", 9, -2),
    level("TOPIX", 22, 0.3),
    level("NIFTY", 9, 1.5),
    level("SENSEX", 9, 1.4),
  ];
  const html = indexesPanel(rows, NOW);
  const pane = (id: string) => {
    const from = html.indexOf(`<div class="ix-pane ix-pane-${id}">`);
    expect(from).toBeGreaterThan(-1);
    return html.slice(from, html.indexOf('<div class="ix-pane', from + 10) >>> 0 || undefined);
  };

  test("a switch for the table, the return map and by country, and the window", () => {
    expect(html).toContain('<div class="ix-views" data-def-win="5d" hidden>');
    for (const id of ["table", "map", "countries"]) expect(html).toContain(`data-ix-view="${id}"`);
    expect(html).toContain('data-ix-win="5d" aria-pressed="true"');
    expect(html).toContain('data-ix-win="1m" aria-pressed="false"');
    // The table is still the table.
    expect(pane("table")).toContain('<table class="sheet mc-table ix-table">');
  });

  test("the map is one bubble per market, volatility indexes out, coloured by region", () => {
    const map = pane("map");
    const fiveDays = map.slice(map.indexOf("ix-w-5d"), map.indexOf("ix-w-1m"));
    const bubbles = [...fiveDays.matchAll(/class="ixm-b ix-(am|eu|ap)"/g)].map((m) => m[1]);
    // United States (SPX, not NDX too), Germany, Saudi Arabia (with Europe), Japan, India. The
    // FTSE 100 has four closes, too few for five sessions; the VIX is not a return.
    expect(bubbles.sort()).toEqual(["am", "ap", "ap", "eu", "eu"]);
    expect(fiveDays).toContain(">United States</span>");
    expect(fiveDays).toContain(">Saudi Arabia</span>");
    expect(fiveDays).not.toContain("VIX ");
    expect(fiveDays).toContain("Markets with too little history for this window yet, left out: 1.");
    // The S&P 500 at 108 against 103 five sessions back: +4.9%; its latest session 108 against 107.
    expect(fiveDays).toContain(
      "United States · S&amp;P 500: +4.9% over the last 5 sessions, +0.93% in the latest session",
    );
  });

  test("by country: the headline as a bar, the market's other indexes as dots, best first", () => {
    const countries = pane("countries");
    const fiveDays = countries.slice(countries.indexOf("ix-w-5d"), countries.indexOf("ix-w-1m"));
    const names = [...fiveDays.matchAll(/<span class="ixc-name">([^<]+)<\/span>/g)].map(
      (m) => m[1],
    );
    expect(names).toEqual(["India", "United States", "Germany", "Saudi Arabia", "Japan"]);
    // India's Sensex rides as a dot beside the Nifty 50's bar; the US its Nasdaq-100; Japan TOPIX.
    const india = fiveDays.slice(fiveDays.indexOf(">India<"), fiveDays.indexOf(">United States<"));
    expect(india.match(/class="ixc-dot"/g)?.length).toBe(1);
    expect(india).toContain('class="ixc-bar ix-ap"');
    const japan = fiveDays.slice(fiveDays.indexOf(">Japan<"));
    expect(japan).toContain("ixc-bar ix-ap ixc-neg");
  });

  test("the month leaves out what has no month yet, and says how many", () => {
    const map = pane("map");
    const month = map.slice(map.indexOf("ix-w-1m"));
    // Only TOPIX has 22 closes: too few markets for a map.
    expect(month).toContain("Too little history for this window yet.");
  });

  test("renders in Chinese, and the script ships the windows it switches", () => {
    const zh = withLocale("zh", () => indexesPanel(rows, NOW));
    expect(zh).toContain("回报分布图");
    expect(zh).toContain("最近 5 个交易日");
    expect(IX_VIEW_SCRIPT).toContain('const WINS = ["5d","1m"]');
  });
});
