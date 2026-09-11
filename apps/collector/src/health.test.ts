import { describe, expect, test } from "bun:test";
import { CollectorStatus } from "./health";

const run = (venueId: string, startedAt: number, error: string | null = null, markets = 10) => ({
  venueId,
  startedAt,
  durationMs: 100,
  markets,
  requests: 2,
  error,
});

describe("CollectorStatus", () => {
  const MIN = 60_000;

  test("venues are fresh during the startup grace period", () => {
    const status = new CollectorStatus(["a", "b"], MIN, 0);
    expect(status.snapshot(2 * MIN)).toMatchObject({ ok: true });
  });

  test("a venue without a success for 3 intervals is stale, and the last error is surfaced", () => {
    const status = new CollectorStatus(["a", "b"], MIN, 0);
    status.record(run("a", 3 * MIN));
    status.record(run("b", MIN));
    status.record(run("b", 3 * MIN, "HTTP 403"));

    const { ok, venues } = status.snapshot(4.5 * MIN);

    expect(ok).toBe(false);
    expect(venues).toEqual([
      {
        venueId: "a",
        lastRunAt: 3 * MIN,
        lastSuccessAt: 3 * MIN,
        markets: 10,
        error: null,
        stale: false,
      },
      {
        venueId: "b",
        lastRunAt: 3 * MIN,
        lastSuccessAt: MIN,
        markets: 10,
        error: "HTTP 403",
        stale: true,
      },
    ]);
  });
});
