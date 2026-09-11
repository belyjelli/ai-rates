import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import { migrate } from "@ai-rates/db";
import { SQL } from "bun";
import { PgStore } from "./store";

// Runs only with a database: `bun --env-file=.env.test.local test apps/collector`.
const url = process.env.DATABASE_URL;
const TEST_SCHEMA = "airates_it";
const MIN = 60_000;

describe.skipIf(!url)("screener read models (integration)", () => {
  const tag = crypto.randomUUID().slice(0, 6);
  const [v1, v2, v3] = ["a", "b", "c"].map((s) => `it-${tag}-${s}`) as [string, string, string];
  const asset = `SCR${tag.toUpperCase()}`;
  let sql: SQL;
  let store: PgStore;

  const snap = (
    venueId: string,
    venueSymbol: string,
    rate: number,
    observedAt: number,
    openInterestUsd: number | null = 5_000_000,
  ): FundingSnapshot => ({
    venueId,
    venueSymbol,
    base: asset,
    quote: "USDT",
    multiplier: 1,
    dex: null,
    observedAt,
    rate,
    basisHours: 8,
    intervalHours: 8,
    nextFundingAt: null,
    kind: "predicted",
    markPrice: 10,
    indexPrice: 10,
    openInterestUsd,
    volume24hUsd: 1_000_000,
  });

  const apr = (rate: number) => (rate / 8) * 876000;

  const pairsFor = async (args = "0, 0, NULL, NULL, interval '5 minutes'") =>
    (await sql.unsafe(`SELECT * FROM screener_pairs(${args}) WHERE asset = '${asset}'`)) as Record<
      string,
      unknown
    >[];

  beforeAll(async () => {
    sql = new SQL({ url: url as string, max: 1 });
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
    await sql.unsafe(`SET search_path TO ${TEST_SCHEMA}, public`);
    const [{ schema }] = await sql`SELECT current_schema() AS schema`;
    if (schema !== TEST_SCHEMA)
      throw new Error(`refusing to run outside ${TEST_SCHEMA} (got ${schema})`);
    await migrate(sql);
    store = new PgStore(sql);
    await store.upsertVenues([
      { id: v1, name: "Venue A", type: "cex" },
      { id: v2, name: "Venue B", type: "dex" },
      { id: v3, name: "Venue C", type: "cex" },
    ]);
  });

  afterAll(async () => {
    for (const table of [
      "funding_snapshots",
      "funding_events",
      "collector_runs",
      "market_latest",
      "market_funding_stats",
      "markets",
    ]) {
      await sql.unsafe(`DELETE FROM ${table} WHERE venue_id IN ('${v1}', '${v2}', '${v3}')`);
    }
    await sql.unsafe(`DELETE FROM venues WHERE id IN ('${v1}', '${v2}', '${v3}')`);
    await sql.close();
  });

  test("pairs the cheapest and richest markets on different venues, ignoring stale ones", async () => {
    const now = Date.now();
    // v1 lists two markets for the asset: the cheapest overall and a rich one that can't pair with itself.
    await store.recordBatch(
      v1,
      {
        snapshots: [snap(v1, `${asset}USDT`, -0.0001, now), snap(v1, `${asset}USDC`, 0.0003, now)],
        settled: [],
      },
      now,
    );
    await store.recordBatch(
      v2,
      { snapshots: [snap(v2, `${asset}-PERP`, 0.0002, now, 500_000)], settled: [] },
      now,
    );
    // v3 has the richest rate but its data is 10 minutes old.
    await store.recordBatch(
      v3,
      { snapshots: [snap(v3, `${asset}_USDT`, 0.001, now - 10 * MIN)], settled: [] },
      now - 10 * MIN,
    );

    const [pair] = await pairsFor();

    expect(pair).toMatchObject({
      asset,
      venue_count: 2,
      long_venue_id: v1,
      long_symbol: `${asset}USDT`,
      short_venue_id: v2,
      short_symbol: `${asset}-PERP`,
    });
    expect(pair?.spread_apr as number).toBeCloseTo(apr(0.0002) - apr(-0.0001), 6);
  });

  test("applies open interest, venue and venue type filters to each leg", async () => {
    expect(await pairsFor("1000000, 0, NULL, NULL, interval '5 minutes'")).toEqual([]); // v2 has only $0.5M OI
    expect(await pairsFor(`0, 0, ARRAY['${v1}'], NULL, interval '5 minutes'`)).toEqual([]);
    expect(await pairsFor("0, 0, NULL, ARRAY['cex'], interval '5 minutes'")).toEqual([]); // v3 stale, v2 is a dex
    const widened = await pairsFor("0, 0, NULL, NULL, interval '15 minutes'");
    expect(widened).toHaveLength(1);
    expect(widened[0]).toMatchObject({ long_venue_id: v1, short_venue_id: v3, venue_count: 3 });
  });

  test("the latest row per market only moves forward in time", async () => {
    const [{ observed_at: before }] =
      await sql`SELECT observed_at FROM market_latest WHERE venue_id = ${v2}`;
    const older = Date.now() - 30 * MIN;
    await store.recordBatch(
      v2,
      { snapshots: [snap(v2, `${asset}-PERP`, 0.05, older)], settled: [] },
      older,
    );
    const [row] = await sql`SELECT observed_at, rate FROM market_latest WHERE venue_id = ${v2}`;
    expect(row).toEqual({ observed_at: before, rate: 0.0002 });
  });

  test("refreshFundingStats computes time-weighted settled APR windows", async () => {
    const hour = 3_600_000;
    const settledNow = Math.floor(Date.now() / hour) * hour;
    const event = (settledAt: number, rate: number): FundingEvent => ({
      venueId: v1,
      venueSymbol: `${asset}USDT`,
      base: asset,
      quote: "USDT",
      multiplier: 1,
      dex: null,
      settledAt,
      rate,
      basisHours: 8,
      markPrice: null,
    });
    await store.recordHistory(v1, [
      event(settledNow - 8 * hour, 0.0001),
      event(settledNow - 16 * hour, 0.0001),
      event(settledNow - 3 * 24 * hour, 0.0004),
    ]);

    expect(await store.refreshFundingStats()).toBeGreaterThanOrEqual(1);

    const [stats] = await sql`
      SELECT apr_24h, apr_7d, settlements_24h, settlements_7d FROM market_funding_stats
      WHERE venue_id = ${v1} AND venue_symbol = ${`${asset}USDT`}`;
    expect(stats?.settlements_24h).toBe(2);
    expect(stats?.settlements_7d).toBe(3);
    expect(stats?.apr_24h as number).toBeCloseTo(apr(0.0001), 6);
    expect(stats?.apr_7d as number).toBeCloseTo((0.0006 / 24) * 876000, 6);
  });
});
