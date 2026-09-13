import { describe, expect, test } from "bun:test";
import { STALE_MS, type VenueStatus, venueState } from "./data";

const NOW = Date.parse("2026-09-13T12:00:00Z");

const status = (overrides: Partial<VenueStatus> = {}): VenueStatus => ({
  venue_id: "gate",
  name: "Gate",
  type: "cex",
  last_run_at: new Date(NOW - 30_000),
  last_success_at: new Date(NOW - 30_000),
  duration_ms: 306,
  requests: 2,
  last_run_markets: 970,
  last_error: null,
  runs_24h: 1440,
  failures_24h: 0,
  live_markets: 970,
  freshest: new Date(NOW - 20_000),
  ...overrides,
});

describe("venueState", () => {
  test("a venue delivering current markets is live", () => {
    expect(venueState(status(), NOW)).toBe("live");
  });

  test("running cleanly while returning nothing is empty, not live", () => {
    // The state that earns the status page: no error, a recent run, and zero markets. Six
    // Hyperliquid sub-dexes sit here, and a pass/fail reading calls them healthy.
    expect(venueState(status({ live_markets: 0 }), NOW)).toBe("empty");
  });

  test("an error outranks staleness, because it is the cause rather than the symptom", () => {
    const broken = status({
      last_error: "HTTP 429",
      freshest: new Date(NOW - 60 * 60_000),
      live_markets: 0,
    });
    expect(venueState(broken, NOW)).toBe("failing");
  });

  test("stale is decided by the shared threshold, not a second definition", () => {
    expect(venueState(status({ freshest: new Date(NOW - STALE_MS + 1_000) }), NOW)).toBe("live");
    expect(venueState(status({ freshest: new Date(NOW - STALE_MS - 1_000) }), NOW)).toBe("stale");
    // No market has ever been seen, so there is nothing to be fresh.
    expect(venueState(status({ freshest: null }), NOW)).toBe("stale");
  });

  test("a venue that has not run at all is silent, which no other state implies", () => {
    // Driven from the venues table rather than the runs, so silence is visible instead of absent.
    expect(venueState(status({ last_run_at: null, freshest: null }), NOW)).toBe("silent");
  });
});
