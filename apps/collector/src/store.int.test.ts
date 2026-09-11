import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import { migrate } from "@ai-rates/db";
import { SQL } from "bun";
import { PgStore } from "./store";

// Runs only with a database, e.g. `bun --env-file=.env.test.local test apps/collector`.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("PgStore (integration)", () => {
  const venueId = `it-${crypto.randomUUID().slice(0, 8)}`;
  const base = `IT${venueId.slice(3).toUpperCase()}`;
  let sql: SQL;
  let store: PgStore;

  const snap = (
    symbol: string,
    rate: number,
    intervalHours: number | null,
    observedAt: number,
  ): FundingSnapshot => ({
    venueId,
    venueSymbol: symbol,
    base,
    quote: "USDT",
    multiplier: 1,
    dex: null,
    observedAt,
    rate,
    basisHours: 8,
    intervalHours,
    nextFundingAt: observedAt + 3_600_000,
    kind: "predicted",
    markPrice: 100,
    indexPrice: 100.5,
    openInterestUsd: 1_000_000,
    volume24hUsd: null,
  });

  const event = (rate: number, settledAt: number): FundingEvent => ({
    venueId,
    venueSymbol: `${base}USDT`,
    base,
    quote: "USDT",
    multiplier: 1,
    dex: null,
    settledAt,
    rate,
    basisHours: 8,
    markPrice: null,
  });

  beforeAll(async () => {
    sql = new SQL(url as string);
    await migrate(sql);
    store = new PgStore(sql);
    await store.upsertVenues([{ id: venueId, name: "Integration test", type: "cex" }]);
  });

  afterAll(async () => {
    await sql`DELETE FROM funding_snapshots WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM funding_events WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM collector_runs WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM markets WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM venues WHERE id = ${venueId}`;
    await sql.close();
  });

  test("records markets, snapshots, observed and history events, and runs", async () => {
    const t0 = Date.now() - 60_000;
    const settledAt = Math.floor(t0 / 3_600_000) * 3_600_000;

    await store.recordBatch(
      venueId,
      {
        snapshots: [snap(`${base}USDT`, 0.0001, 8, t0), snap(`${base}USDC`, -0.0002, 4, t0)],
        settled: [event(0.00009, settledAt)],
      },
      t0,
    );
    // Second cycle: interval missing this time (must keep the known one), rate changed.
    await store.recordBatch(
      venueId,
      { snapshots: [snap(`${base}USDT`, 0.0002, null, t0 + 30_000)], settled: [] },
      t0 + 30_000,
    );
    await store.recordHistory(venueId, [event(0.0000912, settledAt)]);
    await store.recordRun({
      venueId,
      startedAt: t0,
      durationMs: 120,
      markets: 2,
      requests: 3,
      error: null,
    });

    const markets =
      await sql`SELECT venue_symbol, interval_hours FROM markets WHERE venue_id = ${venueId} ORDER BY venue_symbol`;
    expect(markets).toEqual([
      { venue_symbol: `${base}USDC`, interval_hours: 4 },
      { venue_symbol: `${base}USDT`, interval_hours: 8 },
    ]);

    const [{ count }] =
      await sql`SELECT count(*)::int AS count FROM funding_snapshots WHERE venue_id = ${venueId}`;
    expect(count).toBe(3);

    const events = await sql`SELECT rate, source FROM funding_events WHERE venue_id = ${venueId}`;
    expect(events).toEqual([{ rate: 0.0000912, source: "history" }]);

    const latest = await store.latestByBase(base);
    const usdt = latest.find((row) => row.venue_symbol === `${base}USDT`);
    expect(latest).toHaveLength(2);
    expect(usdt?.rate).toBe(0.0002);
    expect(usdt?.apr).toBeCloseTo(21.9, 6);

    const [run] =
      await sql`SELECT markets, requests, error FROM collector_runs WHERE venue_id = ${venueId}`;
    expect(run).toEqual({ markets: 2, requests: 3, error: null });

    expect(await store.activeMarkets(venueId, t0)).toEqual([
      { venueSymbol: `${base}USDC`, intervalHours: 4 },
      { venueSymbol: `${base}USDT`, intervalHours: 8 },
    ]);
    expect(await store.latestSettledByMarket(venueId)).toEqual(
      new Map([[`${base}USDT`, settledAt]]),
    );
  });
});
