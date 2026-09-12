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

  test("a fleet that has never collected says so, rather than only reading ok", () => {
    // The 2026-09-13 deploy returned ok:true with every venue at markets:0 and lastRunAt:null.
    // That is correct -- nothing is stale yet -- but it is indistinguishable from a collector that
    // will never collect, so the snapshot now states which it is.
    const status = new CollectorStatus(["a", "b"], MIN, 0);
    const boot = status.snapshot(2 * MIN);
    expect(boot.starting).toBe(true);
    expect(boot.ok).toBe(true);
    expect(boot.venues.every((v) => v.lastSuccessAt === null && v.markets === 0)).toBe(true);

    // One success anywhere means the fleet is past startup, even while the other venue is silent.
    status.record(run("a", MIN));
    const running = status.snapshot(2 * MIN);
    expect(running.starting).toBe(false);
    expect(running.ok).toBe(true);

    // And a venue going quiet later is still a real failure, not a boot state.
    const stale = status.snapshot(5 * MIN);
    expect(stale.starting).toBe(false);
    expect(stale.ok).toBe(false);
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
