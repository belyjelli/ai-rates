import { describe, expect, test } from "bun:test";
import type { CvdBar, LiquidationSidePoint } from "./data";
import {
  buildOutlook,
  burstImbalance,
  firstPassage,
  heaviestLevels,
  normalTail,
  OUTLOOK_HORIZONS,
  openInterestWeightedApr,
  probabilityUp,
  realizedVolatility,
  TILT_WEIGHTS,
  theoryReadings,
  touchProbability,
} from "./outlook";

/** A small deterministic generator, so a Monte Carlo check cannot flake. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function gaussian(next: () => number) {
  return () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
}

const HOUR = 3_600_000;

/** A price path with a known volatility per root-hour, as half-hour bars ending at `end`. */
function path(options: {
  hours: number;
  sigmaHour: number;
  end: number;
  seed?: number;
  start?: number;
}) {
  const normal = gaussian(rng(options.seed ?? 7));
  const barHours = 0.5;
  const count = Math.round(options.hours / barHours);
  const bars: CvdBar[] = [];
  let price = options.start ?? 100;
  for (let i = 0; i < count; i++) {
    price *= Math.exp(options.sigmaHour * Math.sqrt(barHours) * normal());
    bars.push({
      bucket_start: new Date(options.end - (count - i) * barHours * HOUR),
      buy_usd: 1_000,
      sell_usd: 1_000,
      price,
    });
  }
  return bars;
}

describe("normalTail", () => {
  test("matches the standard table", () => {
    expect(normalTail(0)).toBeCloseTo(0.5, 7);
    expect(normalTail(1)).toBeCloseTo(0.158655, 5);
    expect(normalTail(1.96)).toBeCloseTo(0.0249979, 5);
    expect(normalTail(3)).toBeCloseTo(0.0013499, 6);
    expect(normalTail(-1)).toBeCloseTo(1 - 0.158655, 5);
  });
});

describe("touchProbability", () => {
  test("is the reflection result: twice the tail", () => {
    expect(touchProbability(1, 1)).toBeCloseTo(2 * 0.158655, 5);
    expect(touchProbability(0.02, 0.01)).toBeCloseTo(2 * normalTail(2), 9);
  });
  test("is certain at the mark and impossible with no movement", () => {
    expect(touchProbability(0, 1)).toBe(1);
    expect(touchProbability(1, 0)).toBe(0);
  });
});

describe("firstPassage", () => {
  test("probabilities add to one and the two exits are symmetric for equal barriers", () => {
    const p = firstPassage(0.02, 0.02, 0.015);
    expect(p.down).toBeCloseTo(p.up, 10);
    expect(p.down + p.up + p.neither).toBeCloseTo(1, 10);
  });

  test("with the far barrier pushed out it is the one-barrier touch probability", () => {
    const p = firstPassage(0.01, 5, 0.01);
    expect(p.down).toBeCloseTo(touchProbability(0.01, 0.01), 3);
    expect(p.up).toBeCloseTo(0, 6);
  });

  test("given unlimited time it is gambler's ruin: the nearer wall wins in proportion", () => {
    const p = firstPassage(0.01, 0.03, 5);
    expect(p.down).toBeCloseTo(0.75, 3);
    expect(p.up).toBeCloseTo(0.25, 3);
    expect(p.neither).toBeLessThan(1e-3);
  });

  test("agrees with a simulated walk", () => {
    const next = rng(42);
    const normal = gaussian(next);
    const steps = 400;
    const down = 0.8;
    const up = 1.5;
    const sigma = 1; // spread over the whole horizon
    let lower = 0;
    let upper = 0;
    const runs = 6_000;
    for (let run = 0; run < runs; run++) {
      let x = 0;
      for (let i = 0; i < steps; i++) {
        x += (sigma / Math.sqrt(steps)) * normal();
        if (x <= -down) {
          lower++;
          break;
        }
        if (x >= up) {
          upper++;
          break;
        }
      }
    }
    const p = firstPassage(down, up, sigma);
    // The discrete walk misses crossings between steps, so it runs slightly under the continuous one.
    expect(Math.abs(p.down - lower / runs)).toBeLessThan(0.04);
    expect(Math.abs(p.up - upper / runs)).toBeLessThan(0.03);
  });

  test("a level far beyond reach is zero, and degenerate input is 'neither'", () => {
    expect(firstPassage(1, 1, 0.01).down).toBe(0);
    expect(firstPassage(0, 1, 1)).toEqual({ down: 0, up: 0, neither: 1 });
    expect(firstPassage(1, 1, 0)).toEqual({ down: 0, up: 0, neither: 1 });
  });
});

describe("realizedVolatility", () => {
  test("recovers the volatility a path was built with", () => {
    const now = Date.UTC(2026, 9, 7);
    const v = realizedVolatility(path({ hours: 24 * 7, sigmaHour: 0.01, end: now }));
    expect(v).not.toBeNull();
    expect(v?.perSqrtHour).toBeGreaterThan(0.009);
    expect(v?.perSqrtHour).toBeLessThan(0.011);
  });

  test("needs enough history to say anything", () => {
    const now = Date.UTC(2026, 9, 7);
    expect(realizedVolatility(path({ hours: 6, sigmaHour: 0.01, end: now }))).toBeNull();
    expect(realizedVolatility([])).toBeNull();
  });

  test("ignores a bad print and a long gap instead of counting them as moves", () => {
    const now = Date.UTC(2026, 9, 7);
    const clean = path({ hours: 72, sigmaHour: 0.01, end: now });
    const dirty = clean.map((bar, i) =>
      i === 40 ? { ...bar, price: (bar.price ?? 1) * 50 } : bar,
    );
    const gapped = dirty.filter((_, i) => i < 60 || i > 90);
    const base = realizedVolatility(clean)?.perSqrtHour ?? 0;
    const robust = realizedVolatility(gapped)?.perSqrtHour ?? 0;
    expect(Math.abs(robust - base) / base).toBeLessThan(0.15);
  });

  test("bars with no price are skipped, not read as zero", () => {
    const now = Date.UTC(2026, 9, 7);
    const bars = path({ hours: 72, sigmaHour: 0.01, end: now }).map((bar, i) =>
      i % 5 === 0 ? { ...bar, price: null } : bar,
    );
    expect(realizedVolatility(bars)).not.toBeNull();
  });
});

describe("heaviestLevels", () => {
  const reach = 4;
  test("picks the heaviest band on each side and puts it at the band's centre", () => {
    const levels = heaviestLevels({
      mark: 100,
      bandPct: 1,
      reach,
      cells: [
        { band: -1, notional_usd: 100 },
        { band: -3, notional_usd: 900 },
        { band: -3, notional_usd: 100 },
        { band: 0, notional_usd: 50 },
        { band: 2, notional_usd: 400 },
      ],
    });
    expect(levels.below?.distance).toBeCloseTo(0.025, 10); // band -3 is 2% to 3% below
    expect(levels.below?.price).toBeCloseTo(97.5, 10);
    expect(levels.below?.usd).toBe(1000);
    expect(levels.above?.distance).toBeCloseTo(0.025, 10); // band 2 is 2% to 3% above
    expect(levels.above?.share).toBeCloseTo(400 / 1550, 10);
    expect(levels.below?.open).toBe(false);
  });

  test("a catch-all is placed at its near edge and flagged open", () => {
    const levels = heaviestLevels({
      mark: 100,
      bandPct: 1,
      reach,
      cells: [
        { band: -4, notional_usd: 10 },
        { band: 4, notional_usd: 10 },
      ],
    });
    expect(levels.below?.distance).toBeCloseTo(0.03, 10); // everything past -3%
    expect(levels.above?.distance).toBeCloseTo(0.04, 10); // everything from +4%
    expect(levels.below?.open).toBe(true);
    expect(levels.above?.open).toBe(true);
  });

  test("bands closer than the minimum distance are not levels, even when they are the heaviest", () => {
    const levels = heaviestLevels({
      mark: 100,
      bandPct: 1,
      reach,
      minDistance: 0.02,
      cells: [
        { band: -1, notional_usd: 9_000 }, // 0.5% below: inside the floor
        { band: 0, notional_usd: 9_000 }, // 0.5% above: inside the floor
        { band: -3, notional_usd: 100 },
        { band: 2, notional_usd: 50 },
      ],
    });
    expect(levels.below?.usd).toBe(100);
    expect(levels.above?.usd).toBe(50);
    // Share is still of everything closed, so a level's weight is not inflated by the ones dropped.
    expect(levels.below?.share).toBeCloseTo(100 / 18_150, 10);
  });

  test("nothing closed means no level, not a level at the mark", () => {
    expect(heaviestLevels({ mark: 100, bandPct: 1, reach, cells: [] })).toEqual({
      below: null,
      above: null,
    });
  });
});

describe("theory readings", () => {
  const now = Date.UTC(2026, 9, 7, 12);
  const side = (
    hoursAgo: number,
    long: number,
    short: number,
    events = 3,
  ): LiquidationSidePoint => ({
    bucket_start: new Date(now - hoursAgo * HOUR),
    long_usd: long,
    short_usd: short,
    events,
  });

  test("burstImbalance reads only the window asked for", () => {
    const result = burstImbalance([side(10, 1_000, 0), side(1, 100, 300)], now, 4);
    expect(result?.value).toBeCloseTo(-0.5, 10);
    expect(result?.usd).toBe(400);
  });

  test("a long-liquidation burst leans up (the fade), and a thin one does not lean at all", () => {
    const bars = path({ hours: 96, sigmaHour: 0.01, end: now });
    const vol = realizedVolatility(bars);
    const heavy = theoryReadings({
      bars,
      sides: [side(1, 900, 100, 6)],
      volatility: vol,
      fundingApr: null,
      sentimentScore: null,
      now,
    });
    expect(heavy.find((r) => r.id === "burst")?.score).toBeCloseTo(0.8, 10);
    const thin = theoryReadings({
      bars,
      sides: [side(1, 900, 100, 2)],
      volatility: vol,
      fundingApr: null,
      sentimentScore: null,
      now,
    });
    expect(thin.find((r) => r.id === "burst")?.score).toBeNull();
  });

  test("positive funding leans down and is capped", () => {
    const rows = theoryReadings({
      bars: [],
      sides: [],
      volatility: null,
      fundingApr: 200,
      sentimentScore: 80,
      now,
    });
    expect(rows.find((r) => r.id === "crowding")?.score).toBe(-1);
    expect(rows.find((r) => r.id === "sentiment")?.score).toBeNull();
    expect(rows.find((r) => r.id === "magnet")?.status).toBe("unavailable");
  });

  test("a close stretched far above its EMA leans down", () => {
    const calm = path({ hours: 120, sigmaHour: 0.002, end: now, start: 100 });
    const last = calm[calm.length - 1] as CvdBar;
    const stretched = [...calm.slice(0, -1), { ...last, price: (last.price ?? 100) * 1.1 }];
    const vol = realizedVolatility(calm);
    const rows = theoryReadings({
      bars: stretched,
      sides: [],
      volatility: vol,
      fundingApr: null,
      sentimentScore: null,
      now,
    });
    const stretch = rows.find((r) => r.id === "stretch");
    expect(stretch?.value).toBeGreaterThan(3);
    expect(stretch?.score).toBe(-1);
  });
});

describe("probabilityUp", () => {
  const extreme = (id: "burst" | "crowding" | "stretch", score: number) => ({
    id,
    status: "unvalidated" as const,
    value: score,
    score,
    detail: null,
  });

  test("with every weight at zero no reading can move the odds", () => {
    for (const horizon of OUTLOOK_HORIZONS) {
      expect(
        probabilityUp(horizon.id, [
          extreme("burst", 1),
          extreme("crowding", -1),
          extreme("stretch", 1),
        ]),
      ).toBe(0.5);
    }
  });

  test("the shipped weights are all zero", () => {
    for (const horizon of OUTLOOK_HORIZONS) {
      for (const weight of Object.values(TILT_WEIGHTS[horizon.id])) expect(weight).toBe(0);
    }
  });

  test("a non-zero weight shifts the odds the way the score leans", () => {
    const weights = {
      ...TILT_WEIGHTS,
      "4h": { burst: 0.5, crowding: 0, stretch: 0 },
    };
    expect(probabilityUp("4h", [extreme("burst", 1)], weights)).toBeGreaterThan(0.5);
    expect(probabilityUp("4h", [extreme("burst", -1)], weights)).toBeLessThan(0.5);
    // Another horizon's weights are untouched.
    expect(probabilityUp("6h", [extreme("burst", 1)], weights)).toBe(0.5);
  });

  test("context and unavailable rows never count, whatever their weight", () => {
    const weights = { ...TILT_WEIGHTS, "4h": { burst: 1, crowding: 1, stretch: 1 } };
    const context = {
      id: "burst" as const,
      status: "context" as const,
      value: 1,
      score: 1,
      detail: null,
    };
    expect(probabilityUp("4h", [context], weights)).toBe(0.5);
  });
});

describe("buildOutlook", () => {
  const now = Date.UTC(2026, 9, 7, 12);
  const bars = path({ hours: 24 * 7, sigmaHour: 0.01, end: now });
  const input = {
    mark: 100,
    bars,
    cells: [
      { band: -2, notional_usd: 5_000_000 },
      { band: 1, notional_usd: 3_000_000 },
    ],
    sides: [] as LiquidationSidePoint[],
    bandPct: 2,
    reach: 4,
    fundingApr: 10,
    sentimentScore: 55,
    now,
  };

  test("has no answer without a mark or without enough price", () => {
    expect(buildOutlook({ ...input, mark: null })).toBeNull();
    expect(buildOutlook({ ...input, bars: bars.slice(0, 8) })).toBeNull();
  });

  test("spread grows with the square root of the horizon, and so does the chance of a touch", () => {
    const outlook = buildOutlook(input);
    if (!outlook) throw new Error("expected an outlook");
    const [h4, h6, d1, w1] = outlook.horizons;
    expect(h4?.sigma).toBeCloseTo(outlook.volatility.perSqrtHour * 2, 10);
    expect(w1?.sigma).toBeCloseTo((h4?.sigma ?? 0) * Math.sqrt(42), 8);
    for (const key of ["touchBelow", "touchAbove"] as const) {
      expect(h4?.[key] ?? 0).toBeLessThan(h6?.[key] ?? 0);
      expect(h6?.[key] ?? 0).toBeLessThan(d1?.[key] ?? 0);
      expect(d1?.[key] ?? 0).toBeLessThan(w1?.[key] ?? 0);
    }
    expect(h4?.first?.below).toBeGreaterThan(0);
  });

  test("direction is a coin flip while the weights are zero", () => {
    const outlook = buildOutlook(input);
    for (const horizon of outlook?.horizons ?? []) expect(horizon.up).toBe(0.5);
  });

  test("levels inside the shortest horizon's typical move are left out of the odds", () => {
    const outlook = buildOutlook({
      ...input,
      bandPct: 0.25,
      cells: [
        { band: 0, notional_usd: 9_000_000 },
        { band: -1, notional_usd: 9_000_000 },
      ],
    });
    expect(outlook?.minLevelDistance).toBeCloseTo((outlook?.volatility.perSqrtHour ?? 0) * 2, 10);
    expect(outlook?.levels).toEqual({ below: null, above: null });
  });

  test("a level that does not exist leaves its cells empty, not zero", () => {
    const outlook = buildOutlook({ ...input, cells: [{ band: -2, notional_usd: 1 }] });
    expect(outlook?.horizons[0]?.touchAbove).toBeNull();
    expect(outlook?.horizons[0]?.first).toBeNull();
    expect(outlook?.horizons[0]?.touchBelow).not.toBeNull();
  });
});

describe("openInterestWeightedApr", () => {
  test("weights each market's funding by its open interest", () => {
    expect(
      openInterestWeightedApr([
        { apr: 10, open_interest_usd: 3e9 },
        { apr: -10, open_interest_usd: 1e9 },
      ]),
    ).toBeCloseTo(5, 10);
  });
  test("a market with no open interest carries no weight, and none at all is null", () => {
    expect(
      openInterestWeightedApr([
        { apr: 10, open_interest_usd: 1e9 },
        { apr: 900, open_interest_usd: null },
        { apr: 900, open_interest_usd: 0 },
      ]),
    ).toBe(10);
    expect(openInterestWeightedApr([])).toBeNull();
  });
});
