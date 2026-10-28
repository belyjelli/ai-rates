import { describe, expect, test } from "bun:test";
import type { OptionChainRead } from "../app/data";
import { ivAt, ladderMedian, normCdf, optionsAbove, optionsMedian, smiles } from "./option-odds";

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;
const NOW = Date.UTC(2026, 9, 28, 12);

/** A chain of calls and puts at every strike, its volatility a function of strike. */
function chain(expiries: number[], forward: number, vol: (k: number) => number): OptionChainRead {
  const options: OptionChainRead["options"] = [];
  for (const e of expiries)
    for (let k = forward * 0.6; k <= forward * 1.4; k += forward * 0.02) {
      options.push([e, k, true, vol(k), forward], [e, k, false, vol(k), forward]);
    }
  return { taken_at: new Date(NOW), spot: forward, options };
}

describe("option odds", () => {
  test("the normal distribution is right to the sixth decimal", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975002, 5);
    expect(normCdf(-1)).toBeCloseTo(0.158655, 5);
  });

  test("a flat smile gives Black-76's N(d2) exactly at an expiry", () => {
    const at = NOW + 7 * DAY;
    const list = smiles(chain([at], 80_000, () => 0.5));
    const tau = (at - NOW) / YEAR;
    for (const k of [70_000, 80_000, 90_000]) {
      const d2 = (Math.log(80_000 / k) - (0.25 * tau) / 2) / (0.5 * Math.sqrt(tau));
      expect(optionsAbove(list, at, k, NOW) as number).toBeCloseTo(normCdf(d2), 6);
    }
    // The median sits at F·exp(−σ²τ/2).
    expect(optionsMedian(list, at, NOW) as number).toBeCloseTo(
      80_000 * Math.exp((-0.25 * tau) / 2),
      0,
    );
  });

  test("with a smile, the chance is minus the slope of Black-76 call prices in strike", () => {
    const at = NOW + 7 * DAY;
    const tau = (at - NOW) / YEAR;
    const F = 80_000;
    const vol = (k: number) => 0.5 - 0.3 * (k / F - 1);
    const list = smiles(chain([at], F, vol));
    // Black-76 at a zero rate, each strike at its own volatility.
    const call = (k: number) => {
      const s = ivAt(list[0]?.points ?? [], k) * Math.sqrt(tau);
      const d1 = (Math.log(F / k) + (s * s) / 2) / s;
      return F * normCdf(d1) - k * normCdf(d1 - s);
    };
    for (const k of [70_000, 78_000, 84_000, 90_000]) {
      const h = 1;
      const slope = -(call(k + h) - call(k - h)) / (2 * h);
      expect(optionsAbove(list, at, k, NOW) as number).toBeCloseTo(slope, 4);
    }
  });

  test("between two expiries the total variance is interpolated in time", () => {
    const e1 = NOW + 1 * DAY;
    const e2 = NOW + 3 * DAY;
    const list = smiles({
      taken_at: new Date(NOW),
      spot: 80_000,
      options: [
        ...chain([e1], 80_000, () => 0.4).options,
        ...chain([e2], 80_000, () => 0.6).options,
      ],
    });
    const at = NOW + 2 * DAY;
    const w = 0.4 ** 2 * (1 / 365.25) + (0.6 ** 2 * (3 / 365.25) - 0.4 ** 2 * (1 / 365.25)) / 2;
    const d2 = -w / 2 / Math.sqrt(w);
    expect(optionsAbove(list, at, 80_000, NOW) as number).toBeCloseTo(normCdf(d2), 6);
    // Past the last expiry there is nothing to read.
    expect(optionsAbove(list, NOW + 5 * DAY, 80_000, NOW)).toBeNull();
  });

  test("the smile reads out-of-the-money options and is flat beyond its strikes", () => {
    const list = smiles(chain([NOW + DAY], 80_000, (k) => k / 160_000));
    const points = list[0]?.points ?? [];
    expect(ivAt(points, 1)).toBeCloseTo(points[0]?.[1] as number, 9);
    expect(ivAt(points, 80_000)).toBeCloseTo(0.5, 2);
  });

  test("a ladder's median is where its non-increasing chances cross one half", () => {
    expect(
      ladderMedian([
        { strike: 78_000, p: 0.99 },
        { strike: 80_000, p: 0.86 },
        { strike: 82_000, p: 0.04 },
      ]),
    ).toBeCloseTo(80_000 + (0.36 / 0.82) * 2_000, 3);
    // A thin market pricing the higher strike above the lower one is held to the lower one's chance.
    expect(
      ladderMedian([
        { strike: 1, p: 0.6 },
        { strike: 2, p: 0.7 },
        { strike: 3, p: 0.4 },
      ]),
    ).toBeCloseTo(2.5, 6);
    expect(
      ladderMedian([
        { strike: 1, p: 0.9 },
        { strike: 2, p: 0.8 },
      ]),
    ).toBeNull();
  });
});
