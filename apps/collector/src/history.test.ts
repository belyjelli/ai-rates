import { describe, expect, test } from "bun:test";
import type { HttpClient, VenueAdapter } from "@ai-rates/adapters";
import type { FundingEvent } from "@ai-rates/core";
import { type HistoryStore, sweepVenueHistory } from "./history";

const HOUR = 3_600_000;
const NOW = 1_000 * HOUR;

const event = (venueSymbol: string, settledAt: number): FundingEvent => ({
  venueId: "demo",
  venueSymbol,
  base: venueSymbol,
  quote: "USDT",
  multiplier: 1,
  dex: null,
  settledAt,
  rate: 0.0001,
  basisHours: 8,
  markPrice: null,
});

function client(open = () => false): HttpClient {
  return {
    venueId: "demo",
    getJson: async () => ({}) as never,
    postJson: async () => ({}) as never,
    circuit: () => ({ open: open(), consecutiveFailures: 0, retryAt: null }),
    requestCount: () => 0,
  };
}

function store(
  markets: { venueSymbol: string; intervalHours: number | null }[],
  latest: Record<string, number>,
) {
  const recorded: FundingEvent[][] = [];
  const s: HistoryStore = {
    activeMarkets: async () => markets,
    latestSettledByMarket: async () => new Map(Object.entries(latest)),
    recordHistory: async (_venueId, events) => {
      recorded.push([...events]);
    },
  };
  return { s, recorded };
}

describe("sweepVenueHistory", () => {
  test("fetches only markets due a settlement, resuming after the last stored one", async () => {
    const calls: [string, number, number][] = [];
    const adapter: VenueAdapter = {
      venueId: "demo",
      minIntervalMs: 0,
      fetchSnapshots: async () => ({ snapshots: [], settled: [] }),
      fetchFundingHistory: async (_c, symbol, from, to) => {
        calls.push([symbol, from, to]);
        return [event(symbol, to - HOUR)];
      },
    };
    const { s, recorded } = store(
      [
        { venueSymbol: "NEW", intervalHours: 8 }, // never stored: initial lookback
        { venueSymbol: "DUE", intervalHours: 8 }, // last settlement 9h ago: due
        { venueSymbol: "FRESH", intervalHours: 8 }, // last settlement 2h ago: not due
        { venueSymbol: "HOURLY", intervalHours: null }, // unknown interval treated as hourly
      ],
      { DUE: NOW - 9 * HOUR, FRESH: NOW - 2 * HOUR, HOURLY: NOW - 2 * HOUR },
    );

    const result = await sweepVenueHistory(adapter, client(), s, {
      now: () => NOW,
      initialLookbackMs: 24 * HOUR,
    });

    expect(calls).toEqual([
      ["NEW", NOW - 24 * HOUR, NOW],
      ["DUE", NOW - 9 * HOUR + 1, NOW],
      ["HOURLY", NOW - 2 * HOUR + 1, NOW],
    ]);
    expect(result).toEqual({ markets: 4, fetched: 3, events: 3, errors: 0 });
    expect(recorded).toHaveLength(3);
  });

  test("counts failures and keeps going", async () => {
    const adapter: VenueAdapter = {
      venueId: "demo",
      minIntervalMs: 0,
      fetchSnapshots: async () => ({ snapshots: [], settled: [] }),
      fetchFundingHistory: async (_c, symbol) => {
        if (symbol === "BAD") throw new Error("HTTP 400");
        return [];
      },
    };
    const logs: string[] = [];
    const { s } = store(
      [
        { venueSymbol: "BAD", intervalHours: 1 },
        { venueSymbol: "OK", intervalHours: 1 },
      ],
      {},
    );

    const result = await sweepVenueHistory(adapter, client(), s, {
      now: () => NOW,
      log: (m) => logs.push(m),
    });

    expect(result).toEqual({ markets: 2, fetched: 1, events: 0, errors: 1 });
    expect(logs).toEqual(["demo BAD: history failed: HTTP 400"]);
  });

  test("stops when the venue's circuit is open", async () => {
    let calls = 0;
    const adapter: VenueAdapter = {
      venueId: "demo",
      minIntervalMs: 0,
      fetchSnapshots: async () => ({ snapshots: [], settled: [] }),
      fetchFundingHistory: async () => {
        calls++;
        return [];
      },
    };
    const { s } = store([{ venueSymbol: "A", intervalHours: 1 }], {});
    await sweepVenueHistory(
      adapter,
      client(() => true),
      s,
      { now: () => NOW },
    );
    expect(calls).toBe(0);
  });

  test("ends a sweep early when asked to stop", async () => {
    let calls = 0;
    let stopRequested = false;
    const adapter: VenueAdapter = {
      venueId: "demo",
      minIntervalMs: 0,
      fetchSnapshots: async () => ({ snapshots: [], settled: [] }),
      fetchFundingHistory: async () => {
        calls++;
        stopRequested = true;
        return [];
      },
    };
    const { s } = store(
      [
        { venueSymbol: "A", intervalHours: 1 },
        { venueSymbol: "B", intervalHours: 1 },
      ],
      {},
    );

    const result = await sweepVenueHistory(adapter, client(), s, {
      now: () => NOW,
      shouldStop: () => stopRequested,
    });

    expect(calls).toBe(1);
    expect(result.fetched).toBe(1);
  });

  test("does nothing for adapters without a history endpoint", async () => {
    const adapter: VenueAdapter = {
      venueId: "demo",
      minIntervalMs: 0,
      fetchSnapshots: async () => ({ snapshots: [], settled: [] }),
    };
    const { s } = store([{ venueSymbol: "A", intervalHours: 1 }], {});
    expect(await sweepVenueHistory(adapter, client(), s)).toEqual({
      markets: 0,
      fetched: 0,
      events: 0,
      errors: 0,
    });
  });
});
