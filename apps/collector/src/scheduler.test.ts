import { describe, expect, test } from "bun:test";
import type { HttpClient, SnapshotBatch, VenueAdapter } from "@ai-rates/adapters";
import type { FundingSnapshot } from "@ai-rates/core";
import {
  type CollectorRun,
  type CollectorStore,
  msUntilNextTick,
  VenueLoop,
  withTimeout,
} from "./scheduler";

const snapshot = (venueSymbol: string): FundingSnapshot => ({
  venueId: "demo",
  venueSymbol,
  base: venueSymbol,
  quote: "USDT",
  multiplier: 1,
  assetClass: "crypto",
  dex: null,
  observedAt: 0,
  rate: 0.0001,
  basisHours: 8,
  intervalHours: 8,
  nextFundingAt: null,
  kind: "predicted",
  markPrice: 1,
  indexPrice: 1,
  openInterestUsd: null,
  volume24hUsd: null,
});

function fakeClient(): HttpClient & { hit(): void } {
  let requests = 0;
  return {
    venueId: "demo",
    getJson: async () => ({}) as never,
    postJson: async () => ({}) as never,
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => requests,
    hit: () => {
      requests++;
    },
  };
}

function fakeStore(overrides: Partial<CollectorStore> = {}) {
  const batches: { venueId: string; batch: SnapshotBatch; observedAt: number }[] = [];
  const runs: CollectorRun[] = [];
  const store: CollectorStore = {
    recordBatch: async (venueId, batch, observedAt) => {
      batches.push({ venueId, batch, observedAt });
    },
    recordRun: async (run) => {
      runs.push(run);
    },
    ...overrides,
  };
  return { store, batches, runs };
}

const adapter = (fetchSnapshots: VenueAdapter["fetchSnapshots"]): VenueAdapter => ({
  venueId: "demo",
  minIntervalMs: 0,
  fetchSnapshots,
});

describe("VenueLoop.runOnce", () => {
  test("stores the batch and records a run with market and request counts", async () => {
    const client = fakeClient();
    const { store, batches, runs } = fakeStore();
    let clock = 1_000;
    const loop = new VenueLoop(
      adapter(async () => {
        client.hit();
        client.hit();
        clock += 250;
        return { snapshots: [snapshot("BTC"), snapshot("ETH")], settled: [] };
      }),
      client,
      store,
      { intervalMs: 60_000, now: () => clock },
    );

    const run = await loop.runOnce();

    expect(run).toEqual({
      venueId: "demo",
      startedAt: 1_000,
      durationMs: 250,
      markets: 2,
      requests: 2,
      error: null,
    });
    expect(batches).toHaveLength(1);
    expect(batches[0]?.observedAt).toBe(1_000);
    expect(runs).toEqual([run as CollectorRun]);
  });

  test("records adapter failures without storing a batch", async () => {
    const { store, batches, runs } = fakeStore();
    const loop = new VenueLoop(
      adapter(async () => {
        throw new Error("HTTP 403 blocked");
      }),
      fakeClient(),
      store,
      { intervalMs: 60_000 },
    );

    const run = await loop.runOnce();

    expect(run?.error).toBe("HTTP 403 blocked");
    expect(run?.markets).toBe(0);
    expect(batches).toHaveLength(0);
    expect(runs).toHaveLength(1);
  });

  test("times out slow cycles", async () => {
    const { store } = fakeStore();
    const loop = new VenueLoop(
      adapter(() => new Promise(() => {})),
      fakeClient(),
      store,
      {
        intervalMs: 60_000,
        timeoutMs: 20,
      },
    );
    expect((await loop.runOnce())?.error).toBe("timed out after 20ms");
  });

  test("skips a cycle while the previous one is still running", async () => {
    const { store } = fakeStore();
    let release: () => void = () => {};
    const loop = new VenueLoop(
      adapter(
        () =>
          new Promise<SnapshotBatch>((resolve) => {
            release = () => resolve({ snapshots: [], settled: [] });
          }),
      ),
      fakeClient(),
      store,
      { intervalMs: 60_000 },
    );

    const first = loop.runOnce();
    expect(await loop.runOnce()).toBeNull();
    release();
    expect((await first)?.error).toBeNull();
  });

  test("a failing run log write doesn't throw", async () => {
    const logs: string[] = [];
    const { store } = fakeStore({
      recordRun: async () => {
        throw new Error("db down");
      },
    });
    const loop = new VenueLoop(
      adapter(async () => ({ snapshots: [], settled: [] })),
      fakeClient(),
      store,
      {
        intervalMs: 60_000,
        log: (m) => logs.push(m),
      },
    );
    expect((await loop.runOnce())?.error).toBeNull();
    expect(logs).toEqual(["demo: failed to record run: db down"]);
  });
});

describe("VenueLoop.stop", () => {
  test("waits for the in-flight cycle to finish", async () => {
    let release: () => void = () => {};
    let finished = false;
    const { store } = fakeStore();
    const loop = new VenueLoop(
      adapter(
        () =>
          new Promise<SnapshotBatch>((resolve) => {
            release = () => resolve({ snapshots: [], settled: [] });
          }),
      ),
      fakeClient(),
      store,
      {
        intervalMs: 60_000,
        now: () => 59_990, // first tick fires 10ms after start()
        onRun: () => {
          finished = true;
        },
      },
    );

    loop.start();
    await Bun.sleep(30);
    const stopping = loop.stop().then(() => "stopped");
    await Bun.sleep(10);
    expect(finished).toBe(false);

    release();
    expect(await stopping).toBe("stopped");
    expect(finished).toBe(true);
  });
});

describe("msUntilNextTick", () => {
  test("aligns to interval plus offset", () => {
    expect(msUntilNextTick(130_000, 60_000, 5_000)).toBe(55_000);
    expect(msUntilNextTick(125_000, 60_000, 5_000)).toBe(60_000);
    expect(msUntilNextTick(1_000, 60_000, 5_000)).toBe(4_000);
  });
});

describe("withTimeout", () => {
  test("resolves fast promises and rejects slow ones", async () => {
    expect(await withTimeout(Promise.resolve(7), 50)).toBe(7);
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow("timed out after 10ms");
  });
});
