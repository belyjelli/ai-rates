import { describe, expect, test } from "bun:test";
import type { GammaExpiry } from "../app/data";
import { expectedMoves, horizonIv, moveFor, termStructure, YEAR_MS } from "./expected-move";

const NO_GREEKS = {
  call_delta: null,
  put_delta: null,
  call_vega: null,
  put_vega: null,
  call_theta: null,
  put_theta: null,
};

const AT = Date.parse("2026-10-20T16:00:00Z");
const DAY = 86_400_000;

const expiry = (days: number, atm_iv: number | null): GammaExpiry => ({
  ...NO_GREEKS,
  expiry: new Date(AT + days * DAY),
  options: 10,
  call_oi: 1,
  put_oi: 1,
  call_gex_usd: 1,
  put_gex_usd: -1,
  atm_iv,
  forward: atm_iv === null ? null : 82_600,
  premium: null,
  max_pain: null,
  be_low: null,
  be_high: null,
});

describe("term structure", () => {
  test("keeps the expiries ahead with an IV, nearest first, in years", () => {
    const points = termStructure(
      [expiry(30, 0.36), expiry(-1, 0.2), expiry(2, null), expiry(0.5, 0.23)],
      AT,
    );
    expect(points.map((p) => p.iv)).toEqual([0.23, 0.36]);
    expect(points[0]?.t).toBeCloseTo(0.5 / 365, 12);
  });

  test("a horizon between two expiries reads their total variance interpolated", () => {
    const points = [
      { t: 1 / 365, iv: 0.3 },
      { t: 10 / 365, iv: 0.4 },
    ];
    const t = 4 / 365;
    const w = 0.09 / 365 + ((1.6 / 365 - 0.09 / 365) * 3) / 9;
    expect(horizonIv(points, t)).toBeCloseTo(Math.sqrt(w / t), 12);
    // On an expiry, its own IV; before the first or past the last, theirs.
    expect(horizonIv(points, 10 / 365)).toBeCloseTo(0.4, 12);
    expect(horizonIv(points, 0.1 / 365)).toBe(0.3);
    expect(horizonIv(points, 2)).toBe(0.4);
    expect(horizonIv([], 1)).toBeNull();
    expect(horizonIv(points, 0)).toBeNull();
  });
});

describe("the move", () => {
  test("is price x IV x sqrt(days/365), with walls at one and two deviations", () => {
    const m = moveFor(80_000, 0.365, 7 * DAY);
    expect(m.pct).toBeCloseTo(0.365 * Math.sqrt(7 / 365), 12);
    expect(m.move).toBeCloseTo(80_000 * m.pct, 9);
    expect([m.low1, m.high1]).toEqual([80_000 - m.move, 80_000 + m.move]);
    expect([m.low2, m.high2]).toEqual([80_000 - 2 * m.move, 80_000 + 2 * m.move]);
    expect(YEAR_MS).toBe(365 * DAY);
  });

  test("a wall never goes below zero", () => {
    expect(moveFor(10, 3, 365 * DAY).low2).toBe(0);
  });

  test("a book gives its next expiry and a day, a week and 30 days ahead, with the band check", () => {
    const moves = expectedMoves({
      expiries: [expiry(0.67, 0.233), expiry(10, 0.32), expiry(37, 0.36)],
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
      spot: 82_600,
      at: new Date(AT),
      nextExpiry: new Date(AT + 0.67 * DAY),
    });
    expect(moves.map((m) => m.horizon)).toEqual(["next", "1d", "7d", "30d"]);
    expect(moves[0]?.iv).toBe(0.233);
    expect(moves[0]?.expiry?.getTime()).toBe(AT + 0.67 * DAY);
    expect(moves[1]?.hits?.inside_1s).toBe(1634);
    expect(moves[2]?.hits).toBeNull();
    // Further out, more of the term structure's higher IV, and a wider move.
    expect(moves[3]?.move).toBeGreaterThan(moves[2]?.move as number);
  });

  test("a book with no IV, or a next expiry already past, gives what it can", () => {
    const common = { bands: [], spot: 100, at: new Date(AT) };
    expect(expectedMoves({ ...common, expiries: [expiry(5, null)], nextExpiry: null })).toEqual([]);
    const moves = expectedMoves({
      ...common,
      expiries: [expiry(5, 0.2)],
      nextExpiry: new Date(AT - DAY),
    });
    expect(moves.map((m) => m.horizon)).toEqual(["1d", "7d", "30d"]);
  });
});
