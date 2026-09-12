import { describe, expect, test } from "bun:test";
import type { HttpClient, VenueAdapter } from "@ai-rates/adapters";
import type { LeverageTier } from "@ai-rates/core";
import { type LeverageTierStore, refreshVenueLeverageTiers } from "./tiers";

// The sweep never touches the client itself; the adapter's hook owns every request.
const client = {} as HttpClient;

const tier = (venueSymbol: string, index: number): LeverageTier => ({
  venueId: "bybit",
  venueSymbol,
  tier: index,
  lowerNotionalUsd: 0,
  upperNotionalUsd: 10_000,
  imr: 0.02,
  mmr: 0.01,
  maxLeverage: 50,
});

const adapter = (fetchLeverageTiers?: VenueAdapter["fetchLeverageTiers"]): VenueAdapter => ({
  venueId: "bybit",
  minIntervalMs: 100,
  fetchSnapshots: async () => ({ snapshots: [], settled: [] }),
  fetchLeverageTiers,
});

function fakeStore() {
  const calls: { venueId: string; tiers: readonly LeverageTier[] }[] = [];
  const store: LeverageTierStore = {
    async replaceLeverageTiers(venueId, tiers) {
      calls.push({ venueId, tiers });
      return tiers.length;
    },
  };
  return { store, calls };
}

describe("refreshVenueLeverageTiers", () => {
  test("stores the sweep and reports the markets it covered", async () => {
    const { store, calls } = fakeStore();
    const sweep = await refreshVenueLeverageTiers(
      adapter(async () => [tier("BTCUSDT", 1), tier("BTCUSDT", 2), tier("ETHUSDT", 1)]),
      client,
      store,
    );

    // Three tiers, but two markets: the count the log line reports is distinct symbols.
    expect(sweep).toEqual({ markets: 2, tiers: 3 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.venueId).toBe("bybit");
  });

  test("a venue that publishes no ladder is skipped without a write", async () => {
    const { store, calls } = fakeStore();
    expect(await refreshVenueLeverageTiers(adapter(undefined), client, store)).toEqual({
      markets: 0,
      tiers: 0,
    });
    expect(calls).toEqual([]);
  });

  test("an empty sweep never reaches the store, so a failed request cannot prune good ladders", async () => {
    const { store, calls } = fakeStore();
    expect(
      await refreshVenueLeverageTiers(
        adapter(async () => []),
        client,
        store,
      ),
    ).toEqual({ markets: 0, tiers: 0 });
    expect(calls).toEqual([]);
  });
});
