import { describe, expect, test } from "bun:test";
import { classifyDivergence, type DivergenceEvidence, diverges, nearPowerOfTen } from "./identity";

/** The measured shape of a well-observed market, so each test varies only what it is about. */
const observed = (over: Partial<DivergenceEvidence>): DivergenceEvidence => ({
  priceRatio: 1,
  returnCorr: 0.9,
  sharedMinutes: 358,
  memberMoves: 200,
  anchorMoves: 200,
  ...over,
});

describe("nearPowerOfTen", () => {
  test("recognises the verified contract-size variants", () => {
    expect(nearPowerOfTen(0.09988)).toBe(-1); // hl-mkts US500 against lighter
    expect(nearPowerOfTen(0.10164)).toBe(-1); // okx ANTHROPIC against mexc
    expect(nearPowerOfTen(0.10257)).toBe(-1); // okx OPENAI against mexc
  });

  test("a ratio near 1 is agreement, not a scale variance", () => {
    expect(nearPowerOfTen(1)).toBeNull();
    expect(nearPowerOfTen(1.02)).toBeNull();
    expect(nearPowerOfTen(0.98)).toBeNull();
  });

  test("accepts ratios that are near a power of ten BY COINCIDENCE", () => {
    // These are unrelated assets, and this function cannot tell. That is the point of it being
    // only a refinement: gate's PURR clears the ratio test and is rejected on correlation alone.
    expect(nearPowerOfTen(104.64991)).toBe(2);
    expect(nearPowerOfTen(0.00105)).toBe(-3);
  });

  test("rejects ratios that are not close enough", () => {
    expect(nearPowerOfTen(93.64393)).toBeNull(); // aster MEME, 6.4% off 100x
    expect(nearPowerOfTen(0.758)).toBeNull(); // okx QNT
    expect(nearPowerOfTen(547.89152)).toBeNull(); // bybit ON
  });

  test("null for values that are not ratios", () => {
    expect(nearPowerOfTen(0)).toBeNull();
    expect(nearPowerOfTen(-10)).toBeNull();
    expect(nearPowerOfTen(Number.NaN)).toBeNull();
    expect(nearPowerOfTen(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("diverges", () => {
  test("is symmetric, so which side is the anchor cannot change the answer", () => {
    expect(diverges(1.2)).toBe(true);
    expect(diverges(1 / 1.2)).toBe(true);
    // abs(ratio - 1) would have said false for this one and true for its reciprocal.
    expect(diverges(1.05)).toBe(false);
    expect(diverges(1 / 1.05)).toBe(false);
  });

  test("ignores values that are not ratios", () => {
    expect(diverges(0)).toBe(false);
    expect(diverges(Number.NaN)).toBe(false);
  });
});

describe("classifyDivergence", () => {
  test("scale: tracks the anchor at a clean power of ten", () => {
    // hl-mkts US500 -- the case the refactor plan set out to resolve.
    expect(
      classifyDivergence(
        observed({ priceRatio: 0.09988, returnCorr: 0.842, memberMoves: 226, anchorMoves: 263 }),
      ),
    ).toEqual({ verdict: "scale", scaleExponent: -1 });
    // okx ANTHROPIC and OPENAI, the same 10x contract on the same venue.
    expect(
      classifyDivergence(
        observed({ priceRatio: 0.10164, returnCorr: 0.855, memberMoves: 314, anchorMoves: 357 }),
      ).verdict,
    ).toBe("scale");
  });

  test("mismatch: a near-power-of-ten ratio with no correlation is a DIFFERENT ASSET", () => {
    // The core finding. Each of these clears nearPowerOfTen and is caught only by correlation;
    // classifying on the ratio would merge BlackBerry into BounceBit at 1000x.
    expect(
      classifyDivergence(
        observed({ priceRatio: 104.64991, returnCorr: 0.005, memberMoves: 241, anchorMoves: 262 }),
      ),
    ).toEqual({ verdict: "mismatch", scaleExponent: null });
    expect(
      classifyDivergence(
        observed({ priceRatio: 0.00105, returnCorr: 0.03, memberMoves: 321, anchorMoves: 185 }),
      ).verdict,
    ).toBe("mismatch");
    expect(
      classifyDivergence(
        observed({ priceRatio: 93.64393, returnCorr: -0.002, memberMoves: 282, anchorMoves: 281 }),
      ).verdict,
    ).toBe("mismatch");
  });

  test("mismatch: a collision does not have to be large", () => {
    // okx QNT is only 1.32x off its anchor, and its anchor moved on 280 of 358 bars -- more than
    // US500's did -- so 0.183 is a real answer and not a quiet market.
    expect(
      classifyDivergence(
        observed({ priceRatio: 0.758, returnCorr: 0.183, memberMoves: 109, anchorMoves: 280 }),
      ).verdict,
    ).toBe("mismatch");
  });

  test("unverified: a frozen price correlates with nothing", () => {
    // lighter BYD did not move once in six hours, so corr came back null.
    expect(
      classifyDivergence(
        observed({ priceRatio: 0.29526, returnCorr: null, memberMoves: 0, anchorMoves: 20 }),
      ),
    ).toEqual({ verdict: "unverified", scaleExponent: null });
  });

  test("unverified: too little overlap or movement to judge either way", () => {
    expect(classifyDivergence(observed({ priceRatio: 10, sharedMinutes: 59 })).verdict).toBe(
      "unverified",
    );
    expect(classifyDivergence(observed({ priceRatio: 10, memberMoves: 29 })).verdict).toBe(
      "unverified",
    );
    expect(classifyDivergence(observed({ priceRatio: 10, anchorMoves: 29 })).verdict).toBe(
      "unverified",
    );
  });

  test("a quiet market still verifies, so long as both sides moved", () => {
    // US500's anchor had the second-lowest return sd in the sample and still scored 0.842. This is
    // why the floor counts moves rather than volatility.
    expect(
      classifyDivergence(
        observed({ priceRatio: 0.1, returnCorr: 0.842, memberMoves: 31, anchorMoves: 31 }),
      ).verdict,
    ).toBe("scale");
  });

  test("tracks: same underlying, but the factor is not a contract scale", () => {
    // This had no live instance when it was written, then briefly had one, and now has none again.
    // okx QNT scored 0.603 against a binance anchor at a ratio of 0.759 on 2026-09-13 -- the first
    // `tracks` verdict in production -- and migration 017 then dissolved it: QNT was Quant and
    // Quantinuum in one pool, and keying on (asset_class, base) split them into two consistent
    // pools that no longer diverge at all.
    //
    // The case is kept because the branch earned its place by catching that. An unexplained
    // constant was reported as `tracks` rather than silently as a power-of-ten multiplier a caller
    // might have acted on, and the thing it was really pointing at was a bad key.
    expect(
      classifyDivergence(observed({ priceRatio: 0.75871, returnCorr: 0.603, sharedMinutes: 67 })),
    ).toEqual({ verdict: "tracks", scaleExponent: null });
    expect(classifyDivergence(observed({ priceRatio: 3, returnCorr: 0.95 }))).toEqual({
      verdict: "tracks",
      scaleExponent: null,
    });
  });

  test("unverified for values that are not ratios", () => {
    expect(classifyDivergence(observed({ priceRatio: 0 })).verdict).toBe("unverified");
    expect(classifyDivergence(observed({ priceRatio: Number.NaN })).verdict).toBe("unverified");
  });
});
