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
    assetClass: "crypto",
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
      "market_funding_daily",
      "markets",
    ]) {
      await sql.unsafe(`DELETE FROM ${table} WHERE venue_id IN ('${v1}', '${v2}', '${v3}')`);
    }
    // market_pair_backtests keys legs as long_venue_id/short_venue_id, so it cannot join the loop
    // above. Without this its rows outlive the run in the shared airates_it schema.
    await sql.unsafe(
      `DELETE FROM market_pair_backtests WHERE long_venue_id IN ('${v1}', '${v2}', '${v3}') OR short_venue_id IN ('${v1}', '${v2}', '${v3}')`,
    );
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

  test("caps absolute APR per leg", async () => {
    // Live legs: v1 at -10.95% and +32.85% APR, v2 at +21.9%.
    const age = "interval '5 minutes'";
    expect(await pairsFor(`0, 0, NULL, NULL, ${age}, 100`)).toHaveLength(1);
    // Only v1's -10.95% leg survives a 15% cap, and one venue can't make a pair.
    expect(await pairsFor(`0, 0, NULL, NULL, ${age}, 15`)).toEqual([]);
    expect(await pairsFor(`0, 0, NULL, NULL, ${age}, NULL`)).toHaveLength(1);
  });

  test("drops legs whose mark price disagrees with the rest of the asset", async () => {
    const now = Date.now();
    const odd = `${asset}-ODD`;
    // Same asset, but priced like something else entirely (gate's CAT vs the CAT memecoin).
    await store.recordBatch(
      v3,
      { snapshots: [{ ...snap(v3, odd, 0.002, now), markPrice: 10_000 }], settled: [] },
      now,
    );
    const age = "interval '5 minutes'";

    // Without the guard the mispriced leg wins, because its rate is the richest on offer.
    const unguarded = await pairsFor(`0, 0, NULL, NULL, ${age}, NULL, NULL`);
    expect(unguarded[0]).toMatchObject({ short_venue_id: v3, short_symbol: odd });

    // Every other leg marks 10 and they all hold the same open interest, so the anchor ties to the
    // lowest venue id at 10 and the band excludes the odd leg; the honest pair returns.
    const guarded = await pairsFor(`0, 0, NULL, NULL, ${age}, NULL, 0.05`);
    expect(guarded[0]?.short_symbol).not.toBe(odd);
    expect(guarded[0]).toMatchObject({ long_venue_id: v1, short_venue_id: v2 });
  });

  test("the anchor is the deepest market, not the biggest cluster", async () => {
    // The PURR shape, and the reason migration 016 replaced the median. Two thin venues agree with
    // each other while a far deeper one disagrees. A median calls the deep market the outlier and
    // publishes the thin pair; the anchor calls the thin pair the outliers and publishes nothing.
    // On live data the median was dropping Hyperliquid's $11.15M PURR leg in favour of three
    // venues holding $0.91M between them.
    const now = Date.now();
    const deepAsset = `${asset}DEEP`;
    const leg = (venueId: string, rate: number, mark: number, oi: number): FundingSnapshot => ({
      ...snap(venueId, `${deepAsset}-${venueId.slice(-1).toUpperCase()}`, rate, now, oi),
      base: deepAsset,
      markPrice: mark,
      indexPrice: mark,
    });
    await store.recordBatch(v1, { snapshots: [leg(v1, 0.0001, 10, 100_000)], settled: [] }, now);
    await store.recordBatch(v2, { snapshots: [leg(v2, 0.0009, 10, 100_000)], settled: [] }, now);
    // Ninety times the open interest of the two combined, and priced like a different instrument.
    await store.recordBatch(
      v3,
      { snapshots: [leg(v3, 0.0005, 1000, 9_000_000)], settled: [] },
      now,
    );

    const rows = (await sql.unsafe(
      `SELECT * FROM screener_pairs(0, 0, NULL, NULL, interval '5 minutes') WHERE asset = '${deepAsset}'`,
    )) as Record<string, unknown>[];

    // One market agrees with the anchor, so there is no pair -- and no pair is the honest answer.
    // Two thin venues agreeing with each other is not evidence that they are the asset.
    expect(rows).toHaveLength(0);
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
      assetClass: "crypto",
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

  test("refreshPairBacktests replays both legs and stores the risk beside the figure", async () => {
    const DAY = 24 * 60 * 60_000;
    const now = Date.now();
    // Its OWN asset and symbols. An earlier test in this file seeds three extra settlements on
    // `${asset}USDT`, which summed into the long leg and made this read $36 rather than $42 -- the
    // fixture coupling the plan already records as debt in data.int.test.ts. A separate asset is
    // the fix; changing the expected figure would have been fitting the assertion to the output.
    const base = `${asset}B`;
    const longSymbol = `${base}USDT`;
    const shortSymbol = `${base}-PERP`;

    // Fresh market_latest rows, or screener_pairs has no candidate to replay. $5M against $0.5M so
    // the thinner leg is unambiguous, and both are above the $250k candidate floor.
    await store.recordBatch(
      v1,
      { snapshots: [{ ...snap(v1, longSymbol, -0.0001, now, 5_000_000), base }], settled: [] },
      now,
    );
    await store.recordBatch(
      v2,
      { snapshots: [{ ...snap(v2, shortSymbol, 0.0001, now, 500_000), base }], settled: [] },
      now,
    );

    // Both legs must have charged on all 7 days or the floor rejects the pair and this test would
    // pass vacuously on zero rows. Three settlements a day on each leg, for 7 days.
    const leg = (venueId: string, venueSymbol: string, rate: number): FundingEvent[] =>
      Array.from({ length: 21 }, (_, i) => ({
        venueId,
        venueSymbol,
        base,
        quote: "USDT",
        multiplier: 1,
        assetClass: "crypto",
        dex: null,
        // Spread across the last 7 days, newest first, staying inside the window.
        settledAt: now - Math.floor(i / 3) * DAY - (i % 3) * 8 * 60 * 60_000 - 60_000,
        rate,
        basisHours: 8,
        markPrice: null,
      }));

    // The long leg is paid by a negative rate and the short leg by a positive one, so the pair
    // earns on both sides.
    await store.recordHistory(v1, leg(v1, longSymbol, -0.0001));
    await store.recordHistory(v2, leg(v2, shortSymbol, 0.0001));
    // The charging-day floor reads the daily rollup, so it has to be folded first.
    await store.refreshDailyFunding();

    const replayed = await store.refreshPairBacktests();
    expect(replayed).toBeGreaterThanOrEqual(1);

    const [row] = await sql`
      SELECT * FROM market_pair_backtests
      WHERE asset = ${base} AND run_day = (SELECT max(run_day) FROM market_pair_backtests)`;
    expect(row).toBeDefined();
    expect(row?.long_venue_id).toBe(v1);
    expect(row?.short_venue_id).toBe(v2);

    // 21 settlements a leg at 0.01% on $10,000 pays $1 each, both legs, so $42 over the window.
    expect(row?.net_funding_usd as number).toBeCloseTo(42, 6);
    expect(row?.long_settlements).toBe(21);
    expect(row?.short_settlements).toBe(21);
    // Seven days of charging on both legs is what let it through the floor.
    expect(row?.long_charge_days).toBeGreaterThanOrEqual(7);
    expect(row?.short_charge_days).toBeGreaterThanOrEqual(7);

    // The ranking is ungated, so the risk travels with the row: the $0.5M leg is the thinner one.
    expect(row?.thinner_leg_oi_usd as number).toBeCloseTo(500_000, 6);
    expect(row?.worst_leg_abs_apr as number).toBeGreaterThan(0);
  });

  test("one ticker in two asset classes pairs as two assets, neither anchoring the other", async () => {
    // The BB shape from migration 017: BlackBerry marks ~7.7 on two venues while BounceBit marks
    // ~0.008 on two others. Keyed on base alone, the deepest market anchored both and the gate
    // threw one side away. Keyed on (asset_class, base), each side is a complete pool of its own.
    const now = Date.now();
    const ticker = `${asset}BB`;
    const leg = (
      venueId: string,
      assetClass: "equity" | "crypto",
      markPrice: number,
      rate: number,
      openInterestUsd: number,
    ): FundingSnapshot => ({
      ...snap(venueId, `${ticker}-${assetClass}`, rate, now, openInterestUsd),
      base: ticker,
      assetClass,
      markPrice,
      indexPrice: markPrice,
    });
    await store.recordBatch(
      v1,
      { snapshots: [leg(v1, "equity", 7.72, 0.0001, 90_000_000)], settled: [] },
      now,
    );
    await store.recordBatch(
      v2,
      {
        snapshots: [
          leg(v2, "equity", 7.73, 0.0004, 1_000_000),
          leg(v2, "crypto", 0.0081, -0.0002, 800_000),
        ],
        settled: [],
      },
      now,
    );
    await store.recordBatch(
      v3,
      { snapshots: [leg(v3, "crypto", 0.008, 0.0003, 900_000)], settled: [] },
      now,
    );

    const rows = (await sql.unsafe(
      `SELECT asset, asset_class, venue_count, long_venue_id, short_venue_id
       FROM screener_pairs(0, 0, NULL, NULL, interval '5 minutes')
       WHERE asset = '${ticker}' ORDER BY asset_class`,
    )) as Record<string, unknown>[];

    expect(rows).toEqual([
      {
        asset: ticker,
        asset_class: "crypto",
        venue_count: 2,
        long_venue_id: v2,
        short_venue_id: v3,
      },
      {
        asset: ticker,
        asset_class: "equity",
        venue_count: 2,
        long_venue_id: v1,
        short_venue_id: v2,
      },
    ]);
  });

  test("same-quote pairing chooses legs within one settlement currency, before picking the widest", async () => {
    // Migration 019. The widest pair is USDT against USDC; a reader who asked for one quote must get
    // the narrower USDT/USDT pair for the SAME asset, not lose the asset because its widest was mixed.
    const now = Date.now();
    const ticker = `${asset}Q`;
    const leg = (venueId: string, quote: string | null, rate: number): FundingSnapshot => ({
      ...snap(venueId, `${ticker}-${quote ?? "none"}`, rate, now),
      base: ticker,
      quote,
    });
    await store.recordBatch(v1, { snapshots: [leg(v1, "USDT", -0.0003)], settled: [] }, now);
    await store.recordBatch(
      v2,
      { snapshots: [leg(v2, "USDC", 0.0005), leg(v2, null, 0.0009)], settled: [] },
      now,
    );
    await store.recordBatch(v3, { snapshots: [leg(v3, "USDT", 0.0002)], settled: [] }, now);

    const read = async (sameQuote: boolean) =>
      (await sql.unsafe(
        `SELECT long_venue_id, short_venue_id, long_quote, short_quote, venue_count
         FROM screener_pairs(0, 0, NULL, NULL, interval '5 minutes', NULL, 0.10, ${sameQuote})
         WHERE asset = '${ticker}'`,
      )) as Record<string, unknown>[];

    // Default: pairs across quotes exactly as before, now saying so. The unknown-quote leg is the
    // richest, so it is the short.
    expect(await read(false)).toEqual([
      {
        long_venue_id: v1,
        short_venue_id: v2,
        long_quote: "USDT",
        short_quote: null,
        venue_count: 3,
      },
    ]);
    // Same quote: the unknown leg sits out, USDC has no partner, and USDT pairs with USDT.
    expect(await read(true)).toEqual([
      {
        long_venue_id: v1,
        short_venue_id: v3,
        long_quote: "USDT",
        short_quote: "USDT",
        venue_count: 2,
      },
    ]);
    // The seven-argument call the collector and worker already make still resolves.
    const [legacy] = (await sql.unsafe(
      `SELECT long_venue_id FROM screener_pairs(0, 0, NULL, NULL, interval '5 minutes', NULL, 0.10)
       WHERE asset = '${ticker}'`,
    )) as Record<string, unknown>[];
    expect(legacy?.long_venue_id).toBe(v1);
  });
});
