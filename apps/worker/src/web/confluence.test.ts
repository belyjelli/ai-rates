import { describe, expect, test } from "bun:test";
import type { GammaExposure, GammaWallDay, GammaWallStats } from "../app/data";
import { reactionStrip, reactionZones, zoneRecord, zoneShades } from "./confluence";
import type { DayRecord, Levels } from "./levels";

// BTC's day of 2026-10-20 as stored: IV walls ±1,092 around 81,470, the 90% wall at 1.97σ.
const levels = (overrides: Partial<Levels> = {}): Levels => ({
  period: "day",
  basis: "day",
  day: "2026-10-20",
  source: "deribit",
  ref: 81_470,
  iv: 0.256,
  move1: 1_092,
  upper1: 82_562,
  lower1: 80_378,
  k90: 1.97,
  method: "dvol",
  sigma90: 0.26,
  move90: 1_796,
  upper90: 83_266,
  lower90: 79_674,
  expiry: new Date("2026-10-21T08:00:00Z"),
  gammaCeiling: 84_000,
  gammaFloor: 81_500,
  beCeiling: 83_076,
  beFloor: 80_901,
  maxPain: 82_000,
  high: 83_375,
  low: 81_216,
  last: 82_677,
  ...overrides,
});

const exposure = (overrides: Partial<GammaExposure> = {}) =>
  ({
    scope: "all",
    computed_at: new Date("2026-10-20T20:40:00Z"),
    source: "deribit",
    unit: "USD",
    spot: 82_646,
    net_gex_usd: 177e6,
    flip_price: 79_728,
    ...overrides,
  }) as GammaExposure;

const STATS = {
  period: "day",
  method: "dvol",
  first_day: "2021-03-25",
  touch1: 858,
  rev1: 458,
  touch90: 205,
  rev90: 126,
} as GammaWallStats;

describe("reaction zones", () => {
  test("an IV wall and a dealer level within a quarter of σ make a zone; one far apart does not", () => {
    const zones = reactionZones(levels());
    // The dealer ceiling 83,076 is 190 from the 90% wall 83,266, under 273 (a quarter of 1,092).
    expect(zones).toEqual([
      {
        side: 1,
        from: 83_076,
        to: 83_266,
        marks: [
          { kind: "iv90", price: 83_266 },
          { kind: "dealer", price: 83_076 },
        ],
      },
    ]);
  });

  test("pairs that overlap on one side merge into one zone, naming each level once", () => {
    const zones = reactionZones(levels({ beCeiling: 82_700, gammaCeiling: 82_600 }));
    const above = zones.filter((z) => z.side === 1);
    expect(above).toHaveLength(1);
    expect(above[0]?.from).toBe(82_562);
    expect(above[0]?.to).toBe(82_700);
    expect(above[0]?.marks.map((m) => m.kind).sort()).toEqual(["dealer", "gamma", "iv"]);
  });

  test("a floor lined up below is a zone of its own, highest first", () => {
    const zones = reactionZones(levels({ gammaFloor: 80_400 }));
    expect(zones.map((z) => [z.side, z.from, z.to])).toEqual([
      [1, 83_076, 83_266],
      [-1, 80_378, 80_400],
    ]);
  });

  test("no 1σ move, no zones: alignment is measured in it", () => {
    expect(reactionZones(levels({ move1: null }))).toEqual([]);
  });

  test("the chart's shading clips a zone to the plotted range and keeps a sliver visible", () => {
    const x = (p: number) => p - 80_000;
    const svg = zoneShades(reactionZones(levels()), x, 80_000, 83_100);
    expect(svg).toBe('<rect class="gx-cz" x="3076.0" y="0" width="24.0" height="1000"></rect>');
    expect(zoneShades(reactionZones(levels()), x, 70_000, 75_000)).toBe("");
  });
});

describe("reaction strip", () => {
  const html = reactionStrip({
    l: levels(),
    spot: 82_646,
    regime: exposure(),
    stats: STATS,
    live: "gamma-zones",
  });

  test("names the zone above with its distance in points, percent and the day's σ", () => {
    expect(html).toContain(
      '<p class="cz-zone"><b>83,076 – 83,266</b> <span>90% wall + dealer break-even</span></p>',
    );
    expect(html).toContain("+430 (+0.52%) away, 0.39σ of the day's move");
    expect(html).toContain("No zone below");
  });

  test("sorts each level to the side of the spot it is on now, nearest first", () => {
    const below = html.slice(html.indexOf("Below the spot"));
    // The upper IV wall, 82,562, is under the spot once price has run past it.
    expect(below.indexOf("82,562")).toBeGreaterThan(-1);
    expect(below.indexOf("82,562")).toBeLessThan(below.indexOf("81,500"));
    expect(below).toContain(
      '<b class="cz-flip"><i class="cz-sw cz-flip" aria-hidden="true"></i>gamma flip</b><span class="num">79,728</span>',
    );
  });

  test("says the regime and quotes the measured record, not 90%", () => {
    expect(html).toContain("Dealers long gamma");
    expect(html).toContain("Flip 79,728, −3.53% (2.67σ).");
    expect(html).toContain("closed back inside 53% of 858 times, of its 90% wall 61% of 205");
    const short = reactionStrip({
      l: levels(),
      spot: 82_646,
      regime: exposure({ net_gex_usd: -5e6 }),
      stats: null,
      record: null,
      live: "x",
    });
    expect(short).toContain("Dealers short gamma");
    expect(short).not.toContain("closed back inside");
  });

  test("draws nothing without a 1σ move to measure in", () => {
    expect(
      reactionStrip({
        l: levels({ move1: null }),
        spot: 1,
        regime: null,
        stats: null,
        record: null,
        live: "x",
      }),
    ).toBe("");
    expect(
      reactionStrip({ l: null, spot: 1, regime: null, stats: null, record: null, live: "x" }),
    ).toBe("");
  });
});

// A finished day: its walls (as levels.ts walls() gives them) and its candle.
const finished = (day: string, high: number, low: number, close: number): DayRecord => ({
  day,
  row: {
    day,
    gamma_ceiling: 84_000,
    gamma_floor: 81_500,
    be_ceiling: 83_076,
    be_floor: 80_901,
    day_high: high,
    day_low: low,
    last_price: close,
  } as GammaWallDay,
  w: {
    move1: 1_092,
    upper1: 82_562,
    lower1: 80_378,
    move90: 1_796,
    upper90: 83_266,
    lower90: 79_674,
  },
});

describe("zone record", () => {
  test("counts each zone reached at its near edge and held when the day closed back below it", () => {
    const r = zoneRecord(
      [
        // Up into the zone (83,076 – 83,266) and back: reached and held; the IV wall too.
        finished("2026-10-23", 83_100, 81_900, 82_400),
        // Through it and closed above: reached, broke; the IV wall broke as well.
        finished("2026-10-22", 83_500, 82_000, 83_400),
        // Never near it, nor either wall.
        finished("2026-10-21", 82_000, 81_000, 81_500),
      ],
      "day",
    );
    expect(r).toEqual({
      period: "day",
      days: 3,
      since: "2026-10-21",
      zones: 3,
      reached: 2,
      held: 1,
      wallReached: 2,
      wallHeld: 1,
    });
  });

  test("the strip says it in a sentence, or that it starts today", () => {
    const strip = (record: ReturnType<typeof zoneRecord>) =>
      reactionStrip({
        l: levels(),
        spot: 82_646,
        regime: exposure(),
        stats: null,
        record,
        live: "x",
      });
    expect(strip(zoneRecord([], "day"))).toContain("zone record starts with today");
    expect(strip(zoneRecord([finished("2026-10-21", 83_100, 81_900, 82_400)], "day"))).toContain(
      "1 finished days since Oct 21: 1 zones, price reached 1 and closed back on the near side of 1",
    );
  });
});

describe("folded strip", () => {
  const html = reactionStrip({
    l: levels(),
    spot: 82_646,
    regime: exposure(),
    stats: STATS,
    record: null,
    live: "gamma-zones",
    fold: true,
  });

  test("is one line that opens into the rest, the line and the body refreshed apart", () => {
    expect(html.startsWith('<details class="cz cz-fold">')).toBe(true);
    expect(html).toContain('<span class="cz-brief" data-live="gamma-zones-brief">');
    expect(html).toContain("zone above 83,076 – 83,266, 0.39σ away");
    expect(html).toContain("no zone below");
    expect(html).toContain("dealers long gamma");
    expect(html).toContain('<div class="cz-body" data-live="gamma-zones">');
    // live.ts swaps [data-live] regions, never the <details> that holds them.
    expect(html).not.toMatch(/<details[^>]*data-live/);
  });
});
