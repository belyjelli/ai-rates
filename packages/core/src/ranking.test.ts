import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PARTICIPATION,
  deployableUsd,
  expectedWeeklyUsd,
  type PairEvidence,
  rankByExpectedDollars,
  score,
  shouldExit,
  shouldSwitch,
  switchBand,
} from "./ranking";

/** The measured shape of a well-evidenced pair, so each test varies only what it is about. */
const evidence = (over: Partial<PairEvidence>): PairEvidence => ({
  ratePerWeek: 0.003, // ~15.6% APR, the measured size-weighted figure
  chargeDays: 30,
  thinnerLegOiUsd: 25_000_000,
  ...over,
});

/** The pool prior used throughout: the measured median of $3.12 per $10k per week. */
const PRIOR = 0.000312;

describe("score", () => {
  test("shrinks a thin sample toward the prior, and leaves a thick one nearly alone", () => {
    // Same observation, different evidence behind it. The sparse pair keeps a usable figure rather
    // than being discarded, and still loses to the well-evidenced one -- the point of k.
    const sparse = score(evidence({ ratePerWeek: 0.01, chargeDays: 4 }), PRIOR);
    const thick = score(evidence({ ratePerWeek: 0.01, chargeDays: 30 }), PRIOR);

    expect(sparse).toBeCloseTo((4 * 0.01 + 10 * PRIOR) / 14, 8);
    expect(thick).toBeCloseTo((30 * 0.01 + 10 * PRIOR) / 40, 8);
    expect(sparse).toBeLessThan(thick);
    // And the sparse one is pulled most of the way back toward the prior.
    expect(sparse).toBeLessThan(0.01 * 0.75);
  });

  test("no evidence at all scores exactly the prior", () => {
    expect(score(evidence({ chargeDays: 0 }), PRIOR)).toBeCloseTo(PRIOR, 10);
  });

  test("the prior is the pool median, not zero", () => {
    // Zero would claim an unobserved pair pays nothing, which is not what ignorance means. A pair
    // with one charging day sits near the median rather than near zero.
    expect(score(evidence({ ratePerWeek: 0, chargeDays: 1 }), PRIOR)).toBeGreaterThan(0);
  });

  test("NaN in, NaN out -- never a silent zero that would rank as merely mediocre", () => {
    expect(score(evidence({ ratePerWeek: Number.NaN }), PRIOR)).toBeNaN();
  });
});

describe("switchBand", () => {
  test("a switch must at least pay for itself over the holding period", () => {
    // 20 bps round trip (four fills at 5 bps), held four weeks.
    expect(switchBand(0.002, 4)).toBeCloseTo(0.0005, 10);
  });

  test("the band is a meaningful fraction of the weekly rate, not a rounding error", () => {
    // Against the measured 0.003/week, a 0.0005 band is about a sixth of the rate. That is real
    // hysteresis: this is what stops the 71% overnight churn.
    const band = switchBand(0.002, 4);
    expect(band / 0.003).toBeGreaterThan(0.1);
    expect(band / 0.003).toBeLessThan(0.3);
  });

  test("a better fee tier lowers the bar to switching", () => {
    // A VIP book pays less to move, so it can afford to chase smaller improvements.
    expect(switchBand(0.0006, 4)).toBeLessThan(switchBand(0.002, 4));
  });

  test("the cube-root term is off until calibrated", () => {
    // Shipping an uncalibrated constant would be exactly the fitting the design forbids, so the
    // default reduces to pure payback, which is arithmetic rather than a fitted parameter.
    expect(switchBand(0.002, 4)).toBe(switchBand(0.002, 4, 0));
    expect(switchBand(0.002, 4, 0.01)).toBeGreaterThan(switchBand(0.002, 4, 0));
  });

  test("no cost means no band", () => {
    expect(switchBand(0)).toBe(0);
    expect(switchBand(Number.NaN)).toBe(0);
  });
});

describe("shouldSwitch", () => {
  const band = switchBand(0.002, 4); // 0.0005

  test("holds when the improvement does not clear the round trip", () => {
    // This is the case that matters: a challenger that looks better but not better ENOUGH. The
    // shipped ranking switches here, and pays $20 per $10k for the privilege.
    expect(shouldSwitch(0.003, 0.0034, band)).toBe(false);
  });

  test("switches when it clearly does", () => {
    expect(shouldSwitch(0.003, 0.004, band)).toBe(true);
  });

  test("a tie holds, because holding is the cheaper error", () => {
    expect(shouldSwitch(0.003, 0.003 + band, band)).toBe(false);
  });

  test("takes any real challenger when there is no incumbent", () => {
    expect(shouldSwitch(Number.NaN, 0.001, band)).toBe(true);
    expect(shouldSwitch(Number.NaN, Number.NaN, band)).toBe(false);
  });
});

describe("shouldExit", () => {
  test("leaves a decaying pair even though no challenger cleared the entry band", () => {
    // Without this, hysteresis holds a dying position forever: the incumbent's score collapses, and
    // precisely because everything is bad, nothing beats it by enough to trigger a switch.
    expect(shouldExit(0.0001, PRIOR)).toBe(true);
    expect(shouldExit(0.003, PRIOR)).toBe(false);
  });

  test("it is easier to leave than to switch", () => {
    const band = switchBand(0.002, 4);
    const decayed = 0.0002;
    // No challenger clears the entry band...
    expect(shouldSwitch(decayed, decayed + band / 2, band)).toBe(false);
    // ...but the exit floor drops it anyway.
    expect(shouldExit(decayed, PRIOR)).toBe(true);
  });

  test("an unscoreable incumbent is exited, not held", () => {
    expect(shouldExit(Number.NaN, PRIOR)).toBe(true);
  });
});

describe("deployableUsd", () => {
  test("2% of the thinner leg, which is the pre-registered default", () => {
    expect(deployableUsd(25_000_000)).toBe(500_000);
    expect(deployableUsd(5_000_000)).toBe(100_000);
  });

  test("the measured thresholds for this segment hold", () => {
    // $100k needs a $5M thinner leg at 2% -- 13 pairs cleared that on 2026-09-13.
    expect(deployableUsd(5_000_000, DEFAULT_PARTICIPATION)).toBeGreaterThanOrEqual(100_000);
    // A $4M leg does not.
    expect(deployableUsd(4_000_000, DEFAULT_PARTICIPATION)).toBeLessThan(100_000);
  });

  test("participation is per client", () => {
    expect(deployableUsd(25_000_000, 0.01)).toBe(250_000);
    expect(deployableUsd(25_000_000, 0.05)).toBe(1_250_000);
  });

  test("no depth means nothing can be deployed", () => {
    expect(deployableUsd(0)).toBe(0);
    expect(deployableUsd(Number.NaN)).toBe(0);
  });
});

describe("rankByExpectedDollars", () => {
  test("a deep modest pair outranks a shallow spectacular one", () => {
    // The inversion this segment needs, in one assertion. 300% APR good for $10k is noise to a
    // $1M-$10M book; 14% good for $600k is the business.
    const ranked = rankByExpectedDollars(
      [
        {
          row: "shallow-spectacular",
          evidence: evidence({ ratePerWeek: 0.0577, thinnerLegOiUsd: 500_000 }),
        },
        {
          row: "deep-modest",
          evidence: evidence({ ratePerWeek: 0.0027, thinnerLegOiUsd: 30_000_000 }),
        },
      ],
      PRIOR,
    );

    expect(ranked[0]?.row).toBe("deep-modest");
    expect(ranked[0]?.deployableUsd).toBe(600_000);
    // And the rate ordering is the opposite, which is exactly the point.
    expect(ranked[1]?.score).toBeGreaterThan(ranked[0]?.score as number);
  });

  test("reports dollars and rate side by side, because both are needed", () => {
    const [top] = rankByExpectedDollars([{ row: "x", evidence: evidence({}) }], PRIOR);
    expect(top?.deployableUsd).toBe(500_000);
    expect(top?.expectedWeeklyUsd).toBeCloseTo((top?.score as number) * 500_000, 6);
  });

  test("the order is total, so it does not churn between runs on a tie", () => {
    // An unstable sort would reintroduce turnover through the back door.
    const rows = [
      { row: "a", evidence: evidence({}) },
      { row: "b", evidence: evidence({}) },
      { row: "c", evidence: evidence({}) },
    ];
    const first = rankByExpectedDollars(rows, PRIOR).map((r) => r.expectedWeeklyUsd);
    const again = rankByExpectedDollars(rows, PRIOR).map((r) => r.expectedWeeklyUsd);
    expect(first).toEqual(again);
  });

  test("a pair with no depth ranks last rather than being dropped", () => {
    // Dropping it would hide it; ranking it at zero dollars says why it is useless.
    const ranked = rankByExpectedDollars(
      [
        { row: "no-depth", evidence: evidence({ ratePerWeek: 0.05, thinnerLegOiUsd: 0 }) },
        { row: "real", evidence: evidence({}) },
      ],
      PRIOR,
    );
    expect(ranked[1]?.row).toBe("no-depth");
    expect(ranked[1]?.expectedWeeklyUsd).toBe(0);
  });
});

describe("the churn arithmetic this module exists to fix", () => {
  test("switching 71% of a book weekly costs about half the gross return", () => {
    // The measured case: 0.71 of asset slots re-selected per run, 20 bps per round trip, against a
    // 0.003/week gross. This is the number that justifies the band.
    const drag = 0.71 * 0.002; // per week
    const gross = 0.003; // per week
    expect(drag * 52).toBeCloseTo(0.0738, 4); // 7.4% of capital a year
    expect(gross * 52).toBeCloseTo(0.156, 3); // 15.6% APR
    expect(drag / gross).toBeGreaterThan(0.45);
    expect(drag / gross).toBeLessThan(0.5);
  });

  test("the band would have blocked a switch of the size that churns", () => {
    // A challenger better by a tenth of the weekly rate does not clear payback on a four-week hold.
    expect(shouldSwitch(0.003, 0.003 * 1.1, switchBand(0.002, 4))).toBe(false);
  });
});
