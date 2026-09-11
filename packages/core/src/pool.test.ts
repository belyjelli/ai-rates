import { describe, expect, test } from "bun:test";
import { mapPool } from "./pool";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mapPool", () => {
  test("preserves input order", async () => {
    const out = await mapPool([30, 5, 15, 0], 2, async (ms, i) => {
      await sleep(ms);
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3]);
  });

  test("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapPool(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await sleep(2);
        inFlight--;
      },
    );
    expect(peak).toBe(3);
  });

  test("handles empty input", async () => {
    expect(await mapPool([], 5, async () => 1)).toEqual([]);
  });

  test("rejects a limit below 1", async () => {
    expect(mapPool([1], 0, async () => 1)).rejects.toThrow(RangeError);
  });
});
