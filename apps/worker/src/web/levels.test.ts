import { describe, expect, test } from "bun:test";
import type { GammaExposure, GammaWallDay, GammaWallStats, LevelsData } from "../app/data";
import { withLocale } from "./i18n";
import {
  ALIGN_SHARE,
  finishedDays,
  finishedWeeks,
  ivWallsPanel,
  levelsFragment,
  levelsPanel,
  linedUp,
  outcome,
  tally,
  todayLevels,
  weekEnd,
  weekExpiry,
  weekKey,
  weekLevels,
} from "./levels";

const NOW = Date.parse("2026-10-20T17:45:00Z");
const DAY = Math.sqrt(1 / 365);

const exposure = (overrides: Partial<GammaExposure> = {}): GammaExposure => ({
  scope: "next",
  computed_at: new Date(NOW - 2 * 60_000),
  source: "deribit",
  unit: "USD",
  spot: 82_600,
  options: 33,
  expiries: 1,
  first_expiry: new Date("2026-10-21T08:00:00Z"),
  last_expiry: new Date("2026-10-21T08:00:00Z"),
  next_expiry: new Date("2026-10-21T08:00:00Z"),
  call_oi: 1_838,
  put_oi: 1_723,
  call_gex_usd: 20e6,
  put_gex_usd: -9e6,
  net_gex_usd: 11e6,
  flip_price: null,
  call_wall: 84_000,
  put_wall: 81_500,
  ...overrides,
});

const row = (overrides: Partial<GammaWallDay> = {}): GammaWallDay => ({
  day: "2026-10-20",
  source: "deribit",
  set_at: new Date("2026-10-20T08:02:00Z"),
  ref_price: 81_470,
  iv_day: 0.256,
  hist_sigma: 0.373,
  k90: 1.97,
  method: "dvol",
  expiry: new Date("2026-10-21T08:00:00Z"),
  gamma_ceiling: 84_000,
  gamma_floor: 81_500,
  be_ceiling: 83_010,
  be_floor: 80_959,
  max_pain: 82_000,
  day_open: 81_468,
  day_high: 83_375,
  day_low: 81_216,
  last_price: 82_662,
  updated_at: new Date(NOW - 60_000),
  wk_expiry: new Date("2026-10-23T08:00:00Z"),
  wk_iv: 0.298,
  wk_years: 3 / 365,
  wk_hist_sigma: 0.373,
  wk_k90: 2.07,
  wk_method: "dvol",
  wk_gamma_ceiling: 83_000,
  wk_gamma_floor: 82_000,
  wk_be_ceiling: 84_451,
  wk_be_floor: 80_207,
  wk_max_pain: 82_000,
  ...overrides,
});

const STATS: GammaWallStats = {
  period: "day",
  method: "dvol",
  first_day: "2021-03-25",
  last_day: "2026-10-19",
  days: 2035,
  k90: 1.97,
  k90_close: 1.42,
  inside1_close: 1634,
  inside1_range: 1197,
  inside90: 1832,
  touch1: 858,
  rev1: 458,
  touch90: 205,
  rev90: 126,
  sigma: 0.373,
  sigma_for: "2026-10-20",
};

function levelsData(
  overrides: Partial<LevelsData> = {},
  e: GammaExposure | null = exposure(),
): LevelsData {
  return {
    gamma: {
      currency: "BTC",
      books: [
        {
          currency: "BTC",
          source: "deribit",
          unit: "USD",
          computed_at: new Date(NOW - 120_000),
          spot: 82_600,
          call_gex_usd: 1,
          put_gex_usd: -1,
          net_gex_usd: 0,
          flip_price: null,
        },
        {
          currency: "ETH",
          source: "deribit",
          unit: "USD",
          computed_at: new Date(NOW - 120_000),
          spot: 2_444,
          call_gex_usd: 1,
          put_gex_usd: -1,
          net_gex_usd: 0,
          flip_price: null,
        },
      ],
      scopes: e ? [e] : [],
      exposure: e,
      strikes: [
        { strike: 81_000, call_oi: 0, put_oi: 10, call_gex_usd: 0, put_gex_usd: -4e6 },
        { strike: 82_000, call_oi: 5, put_oi: 5, call_gex_usd: 9e6, put_gex_usd: -2e6 },
        { strike: 84_000, call_oi: 10, put_oi: 0, call_gex_usd: 6e6, put_gex_usd: 0 },
      ],
      curve: [],
      expiries: [
        {
          expiry: new Date("2026-10-21T08:00:00Z"),
          options: 33,
          call_oi: 1_838,
          put_oi: 1_723,
          call_gex_usd: 20e6,
          put_gex_usd: -9e6,
          atm_iv: 0.23,
          forward: 82_610,
          premium: 385_000,
          max_pain: 82_000,
          be_low: 80_959,
          be_high: 83_010,
        },
      ],
      bands: [],
    },
    days: [row()],
    stats: STATS,
    weekStats: { ...STATS, period: "week", days: 290, k90: 2.07 },
    weekStrikes: [
      { strike: 80_000, call_oi: 0, put_oi: 20, call_gex_usd: 0, put_gex_usd: -7e6 },
      { strike: 85_000, call_oi: 20, put_oi: 0, call_gex_usd: 8e6, put_gex_usd: 0 },
    ],
    ...overrides,
  };
}

const view = (data: LevelsData | null) => ({
  data,
  params: { currency: "BTC", scope: "next" as const },
  heatmap: { tf: "now" as const, limit: 50, offset: 0 },
  now: NOW,
});

describe("today's levels", () => {
  test("a current day row fixes the walls: 1σ from the options' IV, 90% from the history IV", () => {
    const l = todayLevels(levelsData(), NOW);
    expect(l?.basis).toBe("day");
    const move1 = 81_470 * 0.256 * DAY;
    expect(l?.upper1).toBeCloseTo(81_470 + move1, 6);
    expect(l?.lower1).toBeCloseTo(81_470 - move1, 6);
    expect(l?.upper90).toBeCloseTo(81_470 + 81_470 * 0.373 * DAY * 1.97, 6);
    expect([l?.gammaCeiling, l?.beFloor, l?.high, l?.last]).toEqual([
      84_000, 80_959, 83_375, 82_662,
    ]);
  });

  test("no row (an end-of-day book): the next session from the latest close, gamma levels from its strikes", () => {
    const l = todayLevels(levelsData({ days: [] }), NOW);
    expect(l?.basis).toBe("next");
    expect(l?.ref).toBe(82_600);
    expect(l?.method).toBe("theory");
    expect(l?.iv).toBe(0.23);
    // The biggest call gamma above the spot (82,000's is bigger, but below it) and put gamma below it.
    expect([l?.gammaCeiling, l?.gammaFloor, l?.beCeiling, l?.maxPain]).toEqual([
      84_000, 81_000, 83_010, 82_000,
    ]);
    expect(l?.upper90).toBeCloseTo(82_600 + 82_600 * 0.23 * DAY * 1.6448536269514722, 6);
  });

  test("a row four days old is not today's", () => {
    const old = row({ set_at: new Date(NOW - 5 * 86_400_000) });
    expect(todayLevels(levelsData({ days: [old] }), NOW)?.basis).toBe("next");
    expect(todayLevels(levelsData({ days: [] }, null), NOW)).toBeNull();
  });
});

describe("outcomes", () => {
  test("a level is clear, held (reached and closed back inside) or broke", () => {
    expect(outcome(1, 100, 99, 95, 98)).toBe("clear");
    expect(outcome(1, 100, 100, 95, 98)).toBe("held");
    expect(outcome(1, 100, 103, 95, 101)).toBe("broke");
    expect(outcome(-1, 90, 99, 89, 92)).toBe("held");
    expect(outcome(-1, 90, 99, 85, 90)).toBe("broke");
    expect(outcome(1, null, 99, 95, 98)).toBeNull();
  });

  test("lined up: within a quarter of the day's move", () => {
    expect(linedUp(1_025, 1_000, 100)).toBe(true);
    expect(linedUp(1_000 + 100 * ALIGN_SHARE + 0.01, 1_000, 100)).toBe(false);
    expect(linedUp(null, 1_000, 100)).toBe(false);
  });

  test("the record tallies finished days only, both sides", () => {
    const data = levelsData({
      days: [
        row(),
        row({
          day: "2026-10-19",
          ref_price: 80_000,
          day_high: 81_500,
          day_low: 79_000,
          last_price: 80_500,
        }),
        row({
          day: "2026-10-18",
          ref_price: 80_000,
          day_high: 80_200,
          day_low: 79_900,
          last_price: 80_000,
        }),
        row({ day: "2026-10-17", day_high: null, day_low: null }),
      ],
    });
    const days = finishedDays(data, todayLevels(data, NOW));
    expect(days.map((d) => d.day)).toEqual(["2026-10-19", "2026-10-18"]);
    // Oct 19's 1σ move is 80,000 x 25.6% x sqrt(1/365) = 1,072: its high reached the wall above
    // (81,072) and it closed back under; Oct 18 stayed inside.
    expect(tally(days, (d) => [d.w.upper1, d.w.lower1])).toEqual({ days: 2, reached: 1, held: 1 });
    // Both days fell through the 81,500 gamma floor and closed below it.
    expect(tally(days, (d) => [d.row.gamma_ceiling, d.row.gamma_floor])).toEqual({
      days: 2,
      reached: 2,
      held: 0,
    });
  });
});

describe("the IV Walls tab", () => {
  test("tiles, a ladder with every wall and the measured history", () => {
    const html = ivWallsPanel(view(levelsData()));
    expect(html).toContain("data-gx-swap");
    expect(html).toMatch(/href="\/rates\?[^"]*gex=ETH[^"]*#ivwalls"/);
    expect(html).toContain("IV wall, 1σ");
    expect(html).toContain("1.97 standard deviations of DVOL 37.3%, measured");
    expect(html.match(/class="lv-line lv-iv"/g)).toHaveLength(2);
    expect(html.match(/class="lv-line lv-90"/g)).toHaveLength(2);
    expect(html).toContain("last 82,662");
    expect(html).toContain("A touch of the 1σ wall closed back inside 53% of 858 times");
    expect(html).toContain("BTC's own record starts with today");
  }, 10_000);

  test("a book with no history says its 90% wall is the normal distribution's", () => {
    const html = ivWallsPanel(
      view(
        levelsData({
          stats: null,
          days: [row({ method: "theory", k90: 1.6448536269514722, hist_sigma: null })],
        }),
      ),
    );
    expect(html).toContain("1.645 standard deviations of the options' IV (normal distribution)");
    expect(html).toContain("No history is kept for this book's walls yet");
  });

  test("an end-of-day book draws the next session's walls and keeps no record", () => {
    const html = ivWallsPanel(
      view(levelsData({ days: [], stats: null }, exposure({ source: "hkex", unit: "HKD" }))),
    );
    expect(html).toContain("the latest close, for the next session");
    expect(html).toContain("comes from an end-of-day file");
  });

  test("a failed read, an empty book and an old one say so", () => {
    expect(ivWallsPanel(view(null))).toContain("could not be read right now");
    expect(ivWallsPanel(view(levelsData({ days: [] }, null)))).toContain(
      "No gamma exposure has been computed for BTC yet",
    );
    const old = exposure({ computed_at: new Date(NOW - 7 * 3600_000) });
    expect(ivWallsPanel(view(levelsData({ days: [] }, old)))).toContain("too long ago");
  });
});

describe("the Ceiling & Floor tab", () => {
  test("both readings, max pain, the dealer range by expiry, and what lines up with a wall", () => {
    // Move the dealer ceiling onto the IV wall above: 81,470 + 1,092 = 82,562.
    const data = levelsData({ days: [row({ be_ceiling: 82_600 })] });
    const html = levelsPanel(view(data));
    expect(html).toContain(
      '<span class="lq-ink-l">84,000</span> / <span class="lq-ink-s">81,500</span>',
    );
    expect(html).toContain("max pain 82,000");
    expect(html).toContain('class="cvd-big lv-span lv-ink-on">dealer ceiling</p>');
    expect(html).toContain("lv-be-t lv-on");
    expect(html).toContain("Dealer range by expiry");
    expect(html).toContain("$385k");
  });

  test("with finished days, a record table per level", () => {
    const data = levelsData({
      days: [
        row(),
        row({
          day: "2026-10-19",
          ref_price: 80_000,
          day_high: 84_100,
          day_low: 80_900,
          last_price: 83_000,
        }),
      ],
    });
    const html = levelsPanel(view(data));
    expect(html).toContain("Over 1 finished days since Oct 19");
    // Oct 19 reached the 84,000 gamma ceiling and closed under it, and the 81,500 floor and closed above.
    expect(html).toMatch(
      /Gamma ceiling \/ floor<\/td><td class="num">1<\/td><td class="num">2<\/td><td class="num">2 /,
    );
  });

  test("the fragment, and every language", () => {
    expect(levelsFragment("levels", view(levelsData()))).toContain(`data-rendered="${NOW}"`);
    for (const locale of ["zh", "ja", "ko", "ru"] as const) {
      const html = withLocale(
        locale,
        () => levelsPanel(view(levelsData())) + ivWallsPanel(view(levelsData())),
      );
      expect(html).not.toContain("gamma ceiling");
      expect(html).not.toContain("IV wall, 1σ");
    }
  });
});

describe("the week", () => {
  test("a week's key: Deribit's Friday, a US week's Monday", () => {
    expect(weekKey("2026-10-20", "deribit")).toBe("2026-10-16");
    expect(weekKey("2026-10-23", "deribit")).toBe("2026-10-23");
    expect(weekKey("2026-10-22", "deribit")).toBe("2026-10-16");
    expect(weekKey("2026-10-20", "cboe")).toBe("2026-10-19");
    expect(weekKey("2026-10-19", "cboe")).toBe("2026-10-19");
  });

  test("the week ends at Deribit's next Friday 08:00, or a US week's Friday", () => {
    const tue = Date.parse("2026-10-20T17:00:00Z");
    expect(new Date(weekEnd(tue, "deribit")).toISOString()).toBe("2026-10-23T08:00:00.000Z");
    expect(new Date(weekEnd(Date.parse("2026-10-23T09:00:00Z"), "deribit")).toISOString()).toBe(
      "2026-10-30T08:00:00.000Z",
    );
    expect(new Date(weekEnd(tue, "cboe")).toISOString()).toBe("2026-10-23T23:59:59.000Z");
    expect(new Date(weekEnd(Date.parse("2026-10-24T12:00:00Z"), "cboe")).toISOString()).toBe(
      "2026-10-30T23:59:59.000Z",
    );
    const x = (iso: string) =>
      ({
        ...levelsData().gamma.expiries[0],
        expiry: new Date(iso),
      }) as LevelsData["gamma"]["expiries"][number];
    const list = [x("2026-10-21T08:00:00Z"), x("2026-10-23T08:00:00Z"), x("2026-10-30T08:00:00Z")];
    expect(weekExpiry(list, tue, weekEnd(tue, "deribit"))?.expiry.toISOString()).toBe(
      "2026-10-23T08:00:00.000Z",
    );
  });

  test("the week's levels come off its first row that holds them, its range off all of them", () => {
    const data = levelsData({
      days: [
        row({ day: "2026-10-20", day_high: 83_375, day_low: 81_216, last_price: 82_662 }),
        row({
          day: "2026-10-19",
          set_at: new Date("2026-10-19T08:02:00Z"),
          ref_price: 80_900,
          wk_gamma_ceiling: 84_500,
          day_high: 82_000,
          day_low: 80_100,
          last_price: 81_470,
        }),
        row({
          day: "2026-10-16",
          set_at: new Date("2026-10-16T08:02:00Z"),
          ref_price: 80_000,
          wk_expiry: null,
          day_high: 81_000,
          day_low: 79_500,
          last_price: 80_900,
        }),
      ],
    });
    const l = weekLevels(data, NOW);
    // Oct 16 (Friday) holds no week levels (written before them), so Oct 19's fix the week.
    expect(l?.basis).toBe("day");
    expect(l?.day).toBe("2026-10-19");
    expect([l?.ref, l?.gammaCeiling, l?.beCeiling, l?.high, l?.low, l?.last]).toEqual([
      80_900, 84_500, 84_451, 83_375, 79_500, 82_662,
    ]);
    expect(l?.upper1).toBeCloseTo(80_900 + 80_900 * 0.298 * Math.sqrt(3 / 365), 6);
    expect(l?.upper90).toBeCloseTo(80_900 + 80_900 * 0.373 * Math.sqrt(3 / 365) * 2.07, 6);
  });

  test("a week no row holds yet is read from the book now: its expiry, the seven-day strikes, the week's stats", () => {
    const data = levelsData({ days: [row({ wk_expiry: null })] });
    data.gamma.expiries.push({
      ...data.gamma.expiries[0],
      expiry: new Date("2026-10-23T08:00:00Z"),
      atm_iv: 0.3,
      be_high: 84_400,
      be_low: 80_200,
      max_pain: 82_500,
    } as LevelsData["gamma"]["expiries"][number]);
    const l = weekLevels(data, NOW);
    expect(l?.basis).toBe("next");
    expect(l?.expiry?.toISOString()).toBe("2026-10-23T08:00:00.000Z");
    expect([
      l?.ref,
      l?.iv,
      l?.gammaCeiling,
      l?.gammaFloor,
      l?.beCeiling,
      l?.maxPain,
      l?.k90,
    ]).toEqual([82_600, 0.3, 85_000, 80_000, 84_400, 82_500, 2.07]);
    // The week's range so far still comes from the day rows it has.
    expect([l?.high, l?.low]).toEqual([83_375, 81_216]);
  });

  test("the switch, and a week view's words", () => {
    const day = levelsPanel(view(levelsData()));
    expect(day).toContain(
      '<nav class="tf" aria-label="Levels for"><a href="/rates?gex=BTC&amp;gexp=next#levels" data-gx-swap aria-current="true">Day</a><a href="/rates?gex=BTC&amp;gexp=next&amp;lvb=week#levels" data-gx-swap>Week</a></nav>',
    );
    const week = levelsPanel({
      ...view(levelsData()),
      params: { currency: "BTC", scope: "next", basis: "week" },
    });
    expect(week).toContain('lvb=week#levels" data-gx-swap aria-current="true">Week</a>');
    expect(week).toContain("The week so far");
    expect(week).toContain("in everything expiring by Oct 23");
    expect(week).toContain(
      '<span class="lq-ink-l">83,000</span> / <span class="lq-ink-s">82,000</span>',
    );
    expect(week).toContain("BTC's weekly record starts with this week");
  });

  test("finished weeks are judged by their own levels and range", () => {
    const data = levelsData({
      days: [
        row(),
        row({
          day: "2026-10-15",
          set_at: new Date("2026-10-15T08:02:00Z"),
          day_high: 84_600,
          day_low: 80_000,
          last_price: 83_000,
        }),
        row({
          day: "2026-10-09",
          set_at: new Date("2026-10-09T08:02:00Z"),
          day_high: 82_100,
          day_low: 81_000,
          last_price: 81_500,
        }),
      ],
    });
    const weeks = finishedWeeks(data, weekLevels(data, NOW));
    expect(weeks.map((w) => w.day)).toEqual(["2026-10-09"]);
    // Oct 15 is a Thursday: with Oct 9 (a Friday) it makes the week of Oct 9; this week's is left out.
    expect([weeks[0]?.row.day_high, weeks[0]?.row.day_low, weeks[0]?.row.last_price]).toEqual([
      84_600, 80_000, 83_000,
    ]);
    const html = levelsPanel({
      ...view(data),
      params: { currency: "BTC", scope: "next", basis: "week" },
    });
    expect(html).toContain("Over 1 finished weeks since Oct 9");
  });
});
