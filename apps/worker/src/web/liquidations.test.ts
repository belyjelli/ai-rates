import { describe, expect, test } from "bun:test";
import { sidesScale } from "./liquidations";

describe("sidesScale (the longs vs shorts axis)", () => {
  test("a handful of bars keeps the one straight scale, ending at the tallest", () => {
    expect(sidesScale([7_974_000, 1_516_000, 12_000])).toEqual({ top: 7_974_000, knee: null });
    expect(sidesScale([])).toEqual({ top: 1_000, knee: null });
  });

  test("bars of a kind keep the straight scale: squeezing would only distort", () => {
    const even = Array.from({ length: 30 }, (_, i) => 1_000_000 + i * 20_000);
    expect(sidesScale(even).knee).toBeNull();
  });

  test("one tower breaks the axis at the round amount nine bars in ten stay under", () => {
    // The live 24h shape on 2026-11-10: most bars under $1M, one $22M flush.
    const bars = [...Array.from({ length: 30 }, (_, i) => 20_000 + i * 23_000), 22_350_767];
    const { top, knee } = sidesScale(bars);
    expect(top).toBe(22_350_767);
    // The 28th of 31 is $641k, rounded up to the next of 1-2-3-4-5-6-8 x 10^n.
    expect(knee).toBe(800_000);
    const under = bars.filter((usd) => usd <= (knee ?? 0)).length;
    expect(under / bars.length).toBeGreaterThanOrEqual(0.9);
  });

  test("both sides rank together and an empty side is not a bar", () => {
    const longs = Array.from({ length: 12 }, () => 300_000);
    const shorts = [...Array.from({ length: 12 }, () => 0), 9_000_000];
    expect(sidesScale([...longs, ...shorts])).toEqual({ top: 9_000_000, knee: 300_000 });
  });
});
