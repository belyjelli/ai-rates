import { describe, expect, test } from "bun:test";
import {
  addDays,
  CONTROL,
  type DailyRate,
  decide,
  evaluateWindow,
  type Pick,
  VARIANTS,
  type Variant,
  type VariantResult,
  type WindowResult,
} from "./ranking-eval";

// Hand-computed synthetic cases only. The pre-registration forbids tuning anything on real data.

const START = "2026-09-14";
const nights = Array.from({ length: 7 }, (_, i) => addDays(START, i));
const heldDays = nights.map((d) => addDays(d, 1));

const P1 = { longVenueId: "a", longSymbol: "X-A", shortVenueId: "b", shortSymbol: "X-B" };
const P2 = { longVenueId: "c", longSymbol: "X-C", shortVenueId: "b", shortSymbol: "X-B" };
const Q = { longVenueId: "d", longSymbol: "Y-D", shortVenueId: "e", shortSymbol: "Y-E" };

const pick = (
  runDay: string,
  pair: typeof P1,
  variants: readonly Variant[] = VARIANTS,
  asset = "X",
  deployableUsd = 100_000,
): Pick => ({ runDay, assetClass: "crypto", asset, variants, deployableUsd, ...pair });

const daily = (
  venueId: string,
  venueSymbol: string,
  rateSum: number,
  days = heldDays,
): DailyRate[] => days.map((day) => ({ venueId, venueSymbol, day, rateSum }));

const baseRates = [
  ...daily("a", "X-A", -0.0001),
  ...daily("b", "X-B", 0.0002),
  ...daily("c", "X-C", -0.0003),
  ...daily("d", "Y-D", -0.0001),
  ...daily("e", "Y-E", 0.0001),
];

const steady = nights.map((day) => pick(day, P1));

describe("evaluateWindow", () => {
  test("a held pair earns short minus long, from the day after it was picked", () => {
    const result = evaluateWindow(START, steady, baseRates);
    expect(result.heldDays[0]).toBe("2026-09-15");
    for (const variant of VARIANTS) {
      const r = result.variants[variant];
      // 7 held days x $100k x (0.0002 - -0.0001) = $210.
      expect(r.grossUsd).toBeCloseTo(210, 9);
      expect(r.costUsd).toBe(0);
      expect(r.meanDeployedUsd).toBeCloseTo(100_000, 9);
      expect(r.netPerMillion).toBeCloseTo(2_100, 6);
      expect(r.turnover).toBe(0);
      expect(r.positionDays).toBe(7);
    }
  });

  test("a pair switch costs a half trip on each side and counts as turnover", () => {
    // A alternates P1 / P2 every night; the others hold P1.
    const others: Variant[] = VARIANTS.filter((v) => v !== CONTROL);
    const picks = nights.flatMap((day, i) => [
      pick(day, i % 2 === 0 ? P1 : P2, [CONTROL]),
      pick(day, P1, others),
    ]);
    const result = evaluateWindow(START, picks, baseRates);
    const control = result.variants[CONTROL];
    // 6 transitions x (0.001 x 100k + 0.001 x 100k) = $1,200.
    expect(control.costUsd).toBeCloseTo(1_200, 9);
    expect(control.turnover).toBe(1);
    // P1 on 4 nights at $30, P2 on 3 nights at $50.
    expect(control.grossUsd).toBeCloseTo(270, 9);
    expect(control.netUsd).toBeCloseTo(-930, 9);
    expect(result.variants.hysteresis.costUsd).toBe(0);
    expect(result.variants.hysteresis.turnover).toBe(0);
  });

  test("an asset entering or leaving the book pays a half trip, and the formation night pays nothing", () => {
    const picks = [
      ...steady,
      // Y is held on nights 2, 3 and 4 only, at $50k.
      ...[2, 3, 4].map((i) => pick(nights[i] as string, Q, VARIANTS, "Y", 50_000)),
    ];
    const result = evaluateWindow(START, picks, baseRates);
    const r = result.variants.shrunk;
    // Enter on night 2 and exit on night 5: 0.001 x 50k twice.
    expect(r.costUsd).toBeCloseTo(100, 9);
    // X $210, plus Y 3 days x $50k x 0.0002.
    expect(r.grossUsd).toBeCloseTo(240, 9);
    const capital = (7 * 100_000 + 3 * 50_000) / 7;
    expect(r.meanDeployedUsd).toBeCloseTo(capital, 6);
    expect(r.netPerMillion).toBeCloseTo((140 / capital) * 1_000_000, 6);
    // Y continues unchanged on nights 3 and 4, so turnover stays 0.
    expect(r.turnover).toBe(0);
  });

  test("a missing leg-day counts as zero and is reported, never imputed", () => {
    const rates = baseRates.filter((r) => !(r.venueId === "b" && r.day === "2026-09-17"));
    const r = evaluateWindow(START, steady, rates).variants.settled;
    // That day the short leg pays nothing: $100k x (0 - -0.0001) = $10 instead of $30.
    expect(r.grossUsd).toBeCloseTo(190, 9);
    expect(r.missingLegDays).toBe(1);
  });

  test("unknown depth holds nothing", () => {
    const picks = nights.map((day) => ({ ...pick(day, P1), deployableUsd: Number.NaN }));
    const r = evaluateWindow(START, picks, baseRates).variants[CONTROL];
    expect(r.grossUsd).toBe(0);
    expect(Number.isNaN(r.netPerMillion)).toBe(true);
  });

  describe("invalid windows are refused, not estimated", () => {
    test("a duplicate pick", () => {
      expect(() =>
        evaluateWindow(START, [...steady, pick(nights[3] as string, P2, ["capacity"])], baseRates),
      ).toThrow("duplicate capacity pick");
    });

    test("a missed nightly run", () => {
      const picks = steady.filter((p) => p.runDay !== nights[3]);
      expect(() => evaluateWindow(START, picks, baseRates)).toThrow("has no picks");
    });

    test("variants picking for different assets", () => {
      const picks = [...steady, pick(nights[1] as string, Q, ["widest"], "Z")];
      expect(() => evaluateWindow(START, picks, baseRates)).toThrow("same assets");
    });

    test("an incomplete fold", () => {
      const rates = baseRates.filter((r) => r.day !== heldDays[6]);
      expect(() => evaluateWindow(START, steady, rates)).toThrow("fold is incomplete");
    });
  });
});

describe("decide", () => {
  type Figures = { net: number; gross: number; turnover: number; deployed?: number };
  const result = (variant: Variant, f: Figures): VariantResult => ({
    variant,
    meanDeployedUsd: f.deployed ?? 1_000_000,
    grossUsd: f.gross,
    costUsd: f.gross - f.net,
    netUsd: f.net,
    grossPerMillion: f.gross,
    netPerMillion: f.net,
    turnover: f.turnover,
    missingLegDays: 0,
    positionDays: 7,
  });
  const window = (figures: Record<Variant, Figures>): WindowResult => ({
    runDays: [],
    heldDays: [],
    variants: Object.fromEntries(VARIANTS.map((v) => [v, result(v, figures[v])])) as Record<
      Variant,
      VariantResult
    >,
  });
  const standard: Record<Variant, Figures> = {
    widest: { net: 1_000, gross: 1_500, turnover: 0.7 },
    settled: { net: 900, gross: 1_300, turnover: 0.5 }, // fails: does not beat the control
    shrunk: { net: 1_200, gross: 1_000, turnover: 0.2 }, // fails: gross below 1,500 - 375
    hysteresis: { net: 1_400, gross: 1_400, turnover: 0.2 }, // passes
    capacity: { net: 1_500, gross: 1_600, turnover: 0.35 }, // fails: turnover
  };

  test("the winner must pass all three criteria, and the best net among those that do wins", () => {
    const decision = decide([window(standard), window(standard)]);
    expect(decision.winner).toBe("hysteresis");
    const byVariant = Object.fromEntries(decision.verdicts.map((v) => [v.variant, v]));
    expect(byVariant.settled?.beatsControl).toEqual([false, false]);
    expect(byVariant.shrunk?.grossOk).toEqual([false, false]);
    expect(byVariant.capacity?.turnoverOk).toEqual([false, false]);
  });

  test("passing one window is not enough: every window must pass", () => {
    const second = { ...standard, hysteresis: { net: 950, gross: 1_400, turnover: 0.2 } };
    expect(decide([window(standard), window(second)]).winner).toBeNull();
  });

  test("an exact tie goes to more capital, then to the earlier and simpler variant", () => {
    const tied = {
      ...standard,
      shrunk: { net: 1_400, gross: 1_400, turnover: 0.2, deployed: 900_000 },
      hysteresis: { net: 1_400, gross: 1_400, turnover: 0.2, deployed: 1_100_000 },
    };
    expect(decide([window(tied), window(tied)]).winner).toBe("hysteresis");
    const allEqual = { ...tied, hysteresis: { ...tied.shrunk } };
    expect(decide([window(allEqual), window(allEqual)]).winner).toBe("shrunk");
  });

  test("the yield floor stays meaningful when the control's gross is negative", () => {
    const negative = {
      ...standard,
      widest: { net: -2_000, gross: -1_000, turnover: 0.7 },
      shrunk: { net: 1_200, gross: -1_300, turnover: 0.2 }, // below the -1,250 floor
      hysteresis: { net: -1_100, gross: -1_200, turnover: 0.2 }, // above it
    };
    expect(decide([window(negative), window(negative)]).winner).toBe("hysteresis");
  });

  test("fewer than two windows cannot decide", () => {
    expect(() => decide([window(standard)])).toThrow("two non-overlapping windows");
  });
});
