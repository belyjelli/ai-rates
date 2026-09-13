import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import { migrate } from "@ai-rates/db";
import { SQL } from "bun";
import { PgStore } from "./store";

// Runs only with a database, e.g. `bun --env-file=.env.test.local test apps/collector`.
// Tables go in their own schema so the test can share a database with production data.
const url = process.env.DATABASE_URL;
const TEST_SCHEMA = "airates_it";

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
    maxLeverage?: number | null,
  ): FundingSnapshot => ({
    maxLeverage,
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
    // A single connection, so the search_path set below applies to every query in this file.
    sql = new SQL({ url: url as string, max: 1 });
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
    await sql.unsafe(`SET search_path TO ${TEST_SCHEMA}, public`);
    const [{ schema }] = await sql`SELECT current_schema() AS schema`;
    if (schema !== TEST_SCHEMA)
      throw new Error(`refusing to run outside ${TEST_SCHEMA} (got ${schema})`);
    await migrate(sql);
    store = new PgStore(sql);
    await store.upsertVenues([{ id: venueId, name: "Integration test", type: "cex" }]);
  });

  afterAll(async () => {
    await sql`DELETE FROM funding_snapshots WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM funding_events WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM collector_runs WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM market_leverage_tiers WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM liquidations WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM market_funding_daily WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM market_funding_hourly WHERE venue_id = ${venueId}`;
    await sql`DELETE FROM market_funding_stats WHERE venue_id = ${venueId}`;
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
        snapshots: [
          snap(`${base}USDT`, 0.0001, 8, t0, 50),
          // The venue publishes no leverage for this one; it must stay null, not inherit 50.
          snap(`${base}USDC`, -0.0002, 4, t0),
        ],
        settled: [event(0.00009, settledAt)],
      },
      t0,
    );
    // Second cycle: interval and leverage missing this time (must keep the known ones), rate changed.
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
      await sql`SELECT venue_symbol, interval_hours, max_leverage FROM markets WHERE venue_id = ${venueId} ORDER BY venue_symbol`;
    expect(markets).toEqual([
      { venue_symbol: `${base}USDC`, interval_hours: 4, max_leverage: null },
      { venue_symbol: `${base}USDT`, interval_hours: 8, max_leverage: 50 },
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

  test("replaces leverage tiers, pruning ladders the venue stopped reporting", async () => {
    const tier = (venueSymbol: string, index: number, upper: number | null) => ({
      venueId,
      venueSymbol,
      tier: index,
      lowerNotionalUsd: index === 1 ? 0 : 10_000,
      upperNotionalUsd: upper,
      imr: 0.02 * index,
      mmr: 0.01 * index,
      maxLeverage: 50 / index,
    });
    const read = () =>
      sql`SELECT venue_symbol, tier, upper_notional_usd, imr FROM market_leverage_tiers
          WHERE venue_id = ${venueId} ORDER BY venue_symbol, tier`;

    const first = new Date();
    await store.replaceLeverageTiers(
      venueId,
      [tier(`${base}USDT`, 1, 10_000), tier(`${base}USDT`, 2, null), tier(`${base}GONE`, 1, 5_000)],
      first,
    );
    expect(await read()).toEqual([
      { venue_symbol: `${base}GONE`, tier: 1, upper_notional_usd: 5_000, imr: 0.02 },
      { venue_symbol: `${base}USDT`, tier: 1, upper_notional_usd: 10_000, imr: 0.02 },
      { venue_symbol: `${base}USDT`, tier: 2, upper_notional_usd: null, imr: 0.04 },
    ]);

    // A later sweep rewrites what it reports and drops what it no longer does: the delisted market
    // and the tier that vanished from the ladder both go, so no stale band can be read back.
    const second = new Date(first.getTime() + 1_000);
    await store.replaceLeverageTiers(venueId, [tier(`${base}USDT`, 1, 20_000)], second);
    expect(await read()).toEqual([
      { venue_symbol: `${base}USDT`, tier: 1, upper_notional_usd: 20_000, imr: 0.02 },
    ]);

    // An empty sweep is a failed request, not a venue that withdrew every ladder.
    await store.replaceLeverageTiers(venueId, [], new Date(second.getTime() + 1_000));
    expect(await read()).toHaveLength(1);

    // A partial sweep upserts what it got but prunes nothing: the markets it never reached keep
    // their ladders. Pruning here would delete data because one batch was rate-limited.
    const third = new Date(second.getTime() + 2_000);
    await store.replaceLeverageTiers(venueId, [tier(`${base}OTHER`, 1, 7_000)], third, false);
    expect(await read()).toEqual([
      { venue_symbol: `${base}OTHER`, tier: 1, upper_notional_usd: 7_000, imr: 0.02 },
      { venue_symbol: `${base}USDT`, tier: 1, upper_notional_usd: 20_000, imr: 0.02 },
    ]);
  });

  test("folds funding into daily rows and sums them into the 30d and 60d windows", async () => {
    const DAY = 86_400_000;
    const symbol = `${base}DAILY`;
    // Its own symbol, so the other tests' events cannot drift into these sums.
    const daily = (rate: number, settledAt: number): FundingEvent => ({
      venueId,
      venueSymbol: symbol,
      base,
      quote: "USDT",
      multiplier: 1,
      dex: null,
      settledAt,
      rate,
      basisHours: 8,
      markPrice: null,
    });

    const now = Date.now();
    await store.recordHistory(venueId, [
      daily(0.0003, now - 5 * DAY),
      daily(0.0001, now - 20 * DAY),
      // Inside 60 days but outside 30, so it must move only one of the two windows.
      daily(0.0008, now - 45 * DAY),
    ]);

    expect(await store.refreshDailyFunding()).toBeGreaterThanOrEqual(3);
    expect(await store.refreshLongWindows()).toBeGreaterThanOrEqual(1);

    const [row] = await sql`
      SELECT apr_30d, apr_60d, long_windows_at FROM market_funding_stats
      WHERE venue_id = ${venueId} AND venue_symbol = ${symbol}`;

    // Time-weighted: sum(rate) / sum(basis_hours) x 876000. Averaging the three daily APRs instead
    // would weight a single settlement the same as a day full of them.
    expect(row.apr_30d).toBeCloseTo(((0.0003 + 0.0001) / 16) * 876_000, 6);
    expect(row.apr_60d).toBeCloseTo(((0.0003 + 0.0001 + 0.0008) / 24) * 876_000, 6);
    expect(row.long_windows_at).toBeInstanceOf(Date);

    const days = await sql`
      SELECT day, rate_sum, basis_hours_sum, settlements FROM market_funding_daily
      WHERE venue_id = ${venueId} AND venue_symbol = ${symbol} ORDER BY day`;
    expect(days).toHaveLength(3);
    expect(days[0]).toMatchObject({ rate_sum: 0.0008, basis_hours_sum: 8, settlements: 1 });
  });

  test("folds funding into UTC hours and keeps only the retained window", async () => {
    const HOUR = 3_600_000;
    const DAY = 86_400_000;
    const symbol = `${base}HOURLY`;
    // Its own symbol, so the other tests' events cannot drift into these sums.
    const hourly = (rate: number, settledAt: number): FundingEvent => ({
      venueId,
      venueSymbol: symbol,
      base,
      quote: "USDT",
      multiplier: 1,
      dex: null,
      settledAt,
      rate,
      basisHours: 8,
      markPrice: null,
    });

    const hour = Math.floor(Date.now() / HOUR) * HOUR - 2 * HOUR;
    await store.recordHistory(venueId, [
      // Two settlements inside one hour sum into that hour's single row.
      hourly(0.0001, hour + 5 * 60_000),
      hourly(0.0002, hour + 50 * 60_000),
      hourly(-0.0003, hour - 8 * HOUR),
      // Past the 8-day retention, so it must never be folded in.
      hourly(0.009, hour - 9 * DAY),
    ]);

    expect(await store.refreshHourlyFunding()).toBeGreaterThanOrEqual(2);

    const hours = await sql`
      SELECT hour, rate_sum, basis_hours_sum, settlements FROM market_funding_hourly
      WHERE venue_id = ${venueId} AND venue_symbol = ${symbol} ORDER BY hour`;
    expect(hours).toHaveLength(2);
    expect(hours[0]).toMatchObject({ rate_sum: -0.0003, basis_hours_sum: 8, settlements: 1 });
    // Keyed on the top of the hour, whatever minute the settlements carried.
    expect(new Date(hours[1].hour).getTime()).toBe(hour);
    expect(hours[1].rate_sum).toBeCloseTo(0.0003, 12);
    expect(hours[1]).toMatchObject({ basis_hours_sum: 16, settlements: 2 });
  });

  test("scores stability on charging days, shrunk by sample size", async () => {
    const DAY = 86_400_000;
    const now = Date.now();
    const day = (n: number) => now - n * DAY;

    // Four markets chosen to pin the three definitions that were tried and rejected.
    const ev = (venueSymbol: string, rate: number, settledAt: number): FundingEvent => ({
      venueId,
      venueSymbol,
      base,
      quote: "USDT",
      multiplier: 1,
      dex: null,
      settledAt,
      rate,
      basisHours: 8,
      markPrice: null,
    });

    const steady = `${base}STEADY`; // 20 charging days, always positive
    const flippy = `${base}FLIPPY`; // 20 charging days, sign alternates
    const sparse = `${base}SPARSE`; // 3 charging days, perfectly consistent
    const negative = `${base}NEG`; // 20 charging days, always negative
    const dead = `${base}DEAD`; // 20 days that charge exactly nothing

    const events: FundingEvent[] = [];
    for (let i = 1; i <= 20; i++) {
      events.push(ev(steady, 0.0001, day(i)));
      events.push(ev(flippy, i % 2 === 0 ? 0.0001 : -0.0001, day(i)));
      events.push(ev(negative, -0.0002, day(i)));
      events.push(ev(dead, 0, day(i)));
    }
    for (let i = 1; i <= 3; i++) events.push(ev(sparse, 0.0005, day(i)));

    await store.recordHistory(venueId, events);
    expect(await store.refreshDailyFunding()).toBeGreaterThanOrEqual(83);
    expect(await store.refreshStability()).toBeGreaterThanOrEqual(4);

    type StabilityRow = {
      venue_symbol: string;
      stability_30d: number | null;
      stability_days: number | null;
      momentum_30d: number | null;
    };
    const rows: StabilityRow[] = await sql`
      SELECT venue_symbol, stability_30d, stability_days, momentum_30d
      FROM market_funding_stats
      WHERE venue_id = ${venueId}
        AND venue_symbol IN (${steady}, ${flippy}, ${sparse}, ${negative}, ${dead})`;
    const by = new Map(rows.map((r) => [r.venue_symbol, r]));

    // A market that charges nothing has no persistence to measure. Under a naive sign test its
    // mean is 0, every day "agrees", and it scores a perfect 1.00 -- a dead instrument ranked top.
    expect(by.get(dead)).toBeUndefined();

    // Always-positive: 20 of 20 agree, shrunk to (20+5)/(20+10).
    expect(by.get(steady)?.stability_30d).toBeCloseTo(25 / 30, 6);
    expect(by.get(steady)?.stability_days).toBe(20);

    // Persistently negative funding is just as persistent. Symmetry against the window mean is
    // why this scores like `steady` rather than being punished for its sign.
    expect(by.get(negative)?.stability_30d).toBeCloseTo(25 / 30, 6);

    // Alternating signs: half agree, which shrinks to almost exactly 0.5.
    expect(by.get(flippy)?.stability_30d).toBeCloseTo(15 / 30, 6);

    // Three charging days, all agreeing: a raw ratio would be a perfect 1.00 and outrank `steady`.
    // Shrinkage gives (3 + 5) / (3 + 10), putting it below, which is the whole reason k exists.
    const sparseScore = by.get(sparse)?.stability_30d as number;
    expect(sparseScore).toBeCloseTo(8 / 13, 6);
    expect(sparseScore).toBeLessThan(by.get(steady)?.stability_30d as number);
  });

  test("recordLiquidations is insert-only and absorbs a re-read page", async () => {
    // The load-bearing behaviour of the whole design: Gate ignores from/to, so every poll returns
    // the same page and the composite primary key is what stops the regressor being inflated.
    const at = Date.UTC(2026, 8, 13, 12, 0, 0);
    const rows = [
      {
        venueId,
        venueSymbol: `${base}_USDT`,
        base,
        quote: "USDT",
        multiplier: 1,
        dex: null,
        liquidatedAt: at,
        side: "long" as const,
        sizeContracts: 76,
        fillPrice: 0.0812,
        notionalUsd: 6.17,
      },
      {
        venueId,
        venueSymbol: `${base}_USDT`,
        base,
        quote: "USDT",
        multiplier: 1,
        dex: null,
        liquidatedAt: at + 1000,
        side: "short" as const,
        sizeContracts: 95,
        fillPrice: 0.2544,
        notionalUsd: 24.168,
      },
    ];

    expect(await store.recordLiquidations(venueId, rows)).toBe(2);
    // The same page again: nothing new, rather than four rows.
    expect(await store.recordLiquidations(venueId, rows)).toBe(0);
    // And a duplicate within a single call cannot break the statement either.
    expect(await store.recordLiquidations(venueId, [...rows, ...rows])).toBe(0);

    const stored: { side: string; size_contracts: number; notional_usd: number | null }[] =
      await sql`
        SELECT side, size_contracts, notional_usd FROM liquidations
        WHERE venue_id = ${venueId} ORDER BY liquidated_at`;
    expect(stored).toHaveLength(2);
    // The sign lives in `side`; the stored size is absolute for both directions.
    expect(stored.map((r) => r.side)).toEqual(["long", "short"]);
    expect(stored.every((r) => r.size_contracts > 0)).toBe(true);
    expect(stored[1]?.notional_usd).toBeCloseTo(24.168, 6);

    // A row for another venue is ignored, as recordBatch does.
    expect(await store.recordLiquidations(venueId, [{ ...rows[0], venueId: "someone-else" }])).toBe(
      0,
    );
  });

  test("uses the catalog's curated leverage only where the venue reports none", async () => {
    // Aster, Paradex and Lighter publish no leverage, so the catalog carries a conservative
    // figure for them. It must never override a venue that does publish one.
    const curated = new PgStore(sql, new Map([[venueId, 10]]));
    const t = Date.now() - 10_000;
    await curated.recordBatch(
      venueId,
      {
        snapshots: [
          snap(`${base}CURATED`, 0.0001, 8, t),
          snap(`${base}REPORTED`, 0.0001, 8, t, 50),
        ],
        settled: [],
      },
      t,
    );

    const rows = await sql`
      SELECT venue_symbol, max_leverage FROM markets
      WHERE venue_id = ${venueId}
        AND venue_symbol IN (${`${base}CURATED`}, ${`${base}REPORTED`})
      ORDER BY venue_symbol`;
    expect(rows).toEqual([
      { venue_symbol: `${base}CURATED`, max_leverage: 10 },
      { venue_symbol: `${base}REPORTED`, max_leverage: 50 },
    ]);
  });

  test("stores prices per unit of the base asset, leaving open interest alone", async () => {
    const t1 = Date.now() - 20_000;
    const settledAt = Math.floor((t1 - 60_000) / 3_600_000) * 3_600_000;
    const symbol = `1000${base}USDT`;
    // A 1000x contract, as Aster/Bybit/Hyperliquid list one: the venue quotes the price of 1000 units.
    const scaled: FundingSnapshot = {
      ...snap(symbol, 0.0001, 8, t1),
      multiplier: 1000,
      markPrice: 0.0032709,
      indexPrice: 0.0032808,
    };

    await store.recordBatch(
      venueId,
      {
        snapshots: [scaled],
        settled: [
          {
            ...event(0.0001, settledAt),
            venueSymbol: symbol,
            multiplier: 1000,
            markPrice: 0.0032709,
          },
        ],
      },
      t1,
    );

    const [snapshot] = await sql`
      SELECT mark_price, index_price, open_interest_usd FROM funding_snapshots
      WHERE venue_id = ${venueId} AND venue_symbol = ${symbol}`;
    expect(snapshot?.mark_price).toBeCloseTo(0.0000032709, 12);
    expect(snapshot?.index_price).toBeCloseTo(0.0000032808, 12);
    // Adapters derive open interest from the venue's own contract price, so it must not be rescaled.
    expect(snapshot?.open_interest_usd).toBe(1_000_000);

    const [settled] = await sql`
      SELECT mark_price FROM funding_events WHERE venue_id = ${venueId} AND venue_symbol = ${symbol}`;
    expect(settled?.mark_price).toBeCloseTo(0.0000032709, 12);

    const [latest] = await sql`
      SELECT mark_price, open_interest_usd FROM market_latest
      WHERE venue_id = ${venueId} AND venue_symbol = ${symbol}`;
    expect(latest?.mark_price).toBeCloseTo(0.0000032709, 12);
    expect(latest?.open_interest_usd).toBe(1_000_000);
  });
});
