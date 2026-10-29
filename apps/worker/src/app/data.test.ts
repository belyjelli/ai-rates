import { describe, expect, test } from "bun:test";
import { cvdSpans, STALE_MS, type VenueStatus, venueState } from "./data";

const NOW = Date.parse("2026-09-13T12:00:00Z");

const status = (overrides: Partial<VenueStatus> = {}): VenueStatus => ({
  venue_id: "gate",
  name: "Gate",
  type: "cex",
  last_run_at: new Date(NOW - 30_000),
  last_run_ever: new Date(NOW - 30_000),
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

  test("a clean run listing nothing is empty even with no freshest market, never stale", () => {
    // The shape production actually has: `freshest` comes from the same live markets that number
    // zero, so it is null. This read `stale` until empty was decided first.
    const hollow = status({ last_run_markets: 0, live_markets: 0, freshest: null });
    expect(venueState(hollow, NOW)).toBe("empty");
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
    // The last run reported markets, yet none of them is fresh: that is stale, not empty.
    expect(venueState(status({ freshest: null }), NOW)).toBe("stale");
  });

  test("a venue that ran inside retention but not today is silent", () => {
    // Driven from the venues table rather than the runs, so silence is visible instead of absent.
    const stopped = status({
      last_run_at: null,
      last_run_ever: new Date(NOW - 3 * 24 * 60 * 60_000),
      freshest: null,
    });
    expect(venueState(stopped, NOW)).toBe("silent");
  });

  test("a venue that has never run is planned, not a fault", () => {
    // The catalog holds 61 venues and the collector runs 20. Without this the other 41 read as
    // alarms, and a page meant to surface faults becomes a wall of phantom ones.
    const unbuilt = status({ last_run_at: null, last_run_ever: null, freshest: null });
    expect(venueState(unbuilt, NOW)).toBe("planned");
  });

  test("planned outranks every other signal, including an old error", () => {
    // A venue with no adapter can still carry a stale error row; never having run wins.
    const unbuilt = status({
      last_run_at: null,
      last_run_ever: null,
      last_error: "HTTP 500",
      freshest: null,
      live_markets: 0,
    });
    expect(venueState(unbuilt, NOW)).toBe("planned");
  });
});

describe("cvdSpans", () => {
  const row = (over: Partial<Parameters<typeof cvdSpans>[1][number]>) => ({
    hours: 24,
    venue_id: "binance",
    venue_symbol: "ETHUSDT",
    buy_usd: 10,
    sell_usd: 5,
    priced_usd: 15,
    closes: 288,
    first_price: 2000,
    last_price: 2100,
    ...over,
  });

  test("sums each span and reads its change on the busiest priced market", () => {
    const [day, month] = cvdSpans(
      [24, 720],
      [
        row({}),
        // Busier, but without a close: it adds flow and sets no price.
        row({
          venue_id: "okx",
          buy_usd: 100,
          sell_usd: 50,
          priced_usd: 0,
          closes: 0,
          first_price: null,
          last_price: null,
        }),
        row({
          venue_id: "gate",
          venue_symbol: "ETH_USDT",
          priced_usd: 12,
          first_price: 1000,
          last_price: 900,
        }),
        row({ hours: 720, closes: 1, first_price: 2100, last_price: 2100 }),
      ],
      [{ hours: 24, venue_id: "coinbase", buy_usd: 3, sell_usd: 1 }],
    );
    expect(day).toEqual({
      hours: 24,
      buy_usd: 120,
      sell_usd: 60,
      venues: 3,
      price: 2100,
      change_pct: 5.000000000000004,
      price_venue: "binance",
      price_symbol: "ETHUSDT",
      spot_buy_usd: 3,
      spot_sell_usd: 1,
    });
    // One close is a price but not a change; no spot rows is no spot book.
    expect(month).toMatchObject({
      price: 2100,
      change_pct: null,
      spot_buy_usd: null,
      spot_sell_usd: null,
    });
  });
});
