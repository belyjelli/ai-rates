import { describe, expect, test } from "bun:test";
import { PENDING_ROWS, pendingBands } from "./pending";

describe("pendingBands", () => {
  test("no open interest, no pending", () => {
    for (const oi of [null, 0, -5]) {
      const model = pendingBands(oi);
      expect(model.longTotal).toBe(0);
      expect(model.shortTotal).toBe(0);
      expect(model.longs).toHaveLength(PENDING_ROWS);
    }
  });

  test("never more than half the open interest on a side, and both sides see money", () => {
    const model = pendingBands(1_000_000_000);
    expect(model.longTotal).toBeGreaterThan(0);
    expect(model.shortTotal).toBeGreaterThan(0);
    expect(model.longTotal).toBeLessThanOrEqual(500_000_000);
    expect(model.shortTotal).toBeLessThanOrEqual(500_000_000);
    expect(model.longTotal).toBeCloseTo(
      model.longs.reduce((a, b) => a + b, 0),
      3,
    );
  });

  test("scales linearly with open interest", () => {
    const one = pendingBands(1_000_000);
    const ten = pendingBands(10_000_000);
    for (let i = 0; i < PENDING_ROWS; i++) {
      expect(ten.longs[i]).toBeCloseTo((one.longs[i] as number) * 10, 6);
      expect(ten.shorts[i]).toBeCloseTo((one.shorts[i] as number) * 10, 6);
    }
  });
});
