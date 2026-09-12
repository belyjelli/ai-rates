import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { migrate } from "@ai-rates/db";
import { SQL } from "bun";
import postgres from "postgres";
import { createDataSource } from "./data";

// Runs only with a database: `bun --env-file=.env.test.local test apps/worker`.
//
// The unit tests fake the DataSource, so nothing there ever executes its SQL. That is how a query
// using an array parameter reached production and failed on every call: Hyperdrive requires
// fetch_types: false, and without type introspection postgres.js sends text[] as the bare string
// "a,b". These tests drive the real queries with the real client options.
const url = process.env.DATABASE_URL;
const TEST_SCHEMA = "airates_it";
const HOUR = 3_600_000;

describe.skipIf(!url)("createDataSource (integration)", () => {
  const tag = crypto.randomUUID().slice(0, 6);
  const venueA = `it-${tag}-a`;
  const venueB = `it-${tag}-b`;
  // Deliberately contains a comma: splitting a delimited list would match the wrong rows.
  const symbolA = `IT,${tag.toUpperCase()}-USDT`;
  const symbolB = `IT-${tag.toUpperCase()}-PERP`;
  const base = `IT${tag.toUpperCase()}`;
  const settledAt = Math.floor(Date.now() / HOUR) * HOUR;

  let admin: SQL;
  let client: postgres.Sql;
  let data: ReturnType<typeof createDataSource>;

  beforeAll(async () => {
    admin = new SQL({ url: url as string, max: 1 });
    await admin.unsafe(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
    await admin.unsafe(`SET search_path TO ${TEST_SCHEMA}, public`);
    const [{ schema }] = await admin`SELECT current_schema() AS schema`;
    if (schema !== TEST_SCHEMA)
      throw new Error(`refusing to run outside ${TEST_SCHEMA} (got ${schema})`);
    await migrate(admin);

    await admin`
      INSERT INTO venues ${admin([
        { id: venueA, name: "IT A", type: "cex" },
        { id: venueB, name: "IT B", type: "dex" },
      ])} ON CONFLICT (id) DO NOTHING`;

    const event = (venue_id: string, venue_symbol: string, hoursAgo: number, rate: number) => ({
      settled_at: new Date(settledAt - hoursAgo * HOUR),
      venue_id,
      venue_symbol,
      rate,
      basis_hours: 8,
      source: "history",
    });
    await admin`
      INSERT INTO funding_events ${admin([
        event(venueA, symbolA, 8, 0.0001),
        event(venueA, symbolA, 16, 0.0002),
        event(venueA, symbolA, 240, 0.0009), // outside a 7-day window
        event(venueB, symbolB, 8, -0.0001),
        event(venueB, "OTHER-PERP", 8, 0.005), // same venue, market not asked for
      ])}`;

    // max_leverage lives on `markets`, but asset()/exchange() read `market_latest` and join across
    // for it. Seed both so the join is exercised, with one venue publishing a figure and one silent.
    const now = new Date();
    await admin`
      INSERT INTO markets ${admin([
        {
          venue_id: venueA,
          venue_symbol: symbolA,
          base,
          quote: "USDT",
          multiplier: 1,
          dex: null,
          interval_hours: 8,
          max_leverage: 25,
          last_seen: now,
        },
        {
          venue_id: venueB,
          venue_symbol: symbolB,
          base,
          quote: null,
          multiplier: 1,
          dex: null,
          interval_hours: 8,
          max_leverage: null,
          last_seen: now,
        },
      ])}`;
    const latest = (
      venue_id: string,
      venue_symbol: string,
      quote: string | null,
      rate: number,
    ) => ({
      venue_id,
      venue_symbol,
      base,
      quote,
      observed_at: now,
      rate,
      basis_hours: 8,
      apr: (rate / 8) * 876000,
      interval_hours: 8,
      next_funding_at: new Date(settledAt + HOUR),
      kind: "predicted",
      mark_price: 100,
      index_price: 100,
      open_interest_usd: 1_000_000,
      volume_24h_usd: 2_000_000,
    });
    await admin`
      INSERT INTO market_latest ${admin([
        latest(venueA, symbolA, "USDT", 0.0001),
        latest(venueB, symbolB, null, -0.0001),
      ])}`;

    // One venue has a ladder and the other none, which is the realistic case for a pair.
    const ladder = (tier: number, lower: number, upper: number | null, imr: number) => ({
      venue_id: venueA,
      venue_symbol: symbolA,
      tier,
      lower_notional_usd: lower,
      upper_notional_usd: upper,
      imr,
      mmr: imr / 2,
      max_leverage: 1 / imr,
      fetched_at: now,
    });
    await admin`
      INSERT INTO market_leverage_tiers ${admin([
        ladder(1, 0, 300_000, 0.0066),
        ladder(2, 300_000, null, 0.01),
      ])}`;

    // Production options: no type introspection, exactly as the Worker runs behind Hyperdrive.
    client = postgres(url as string, {
      max: 1,
      fetch_types: false,
      prepare: true,
      connection: { search_path: `${TEST_SCHEMA},public` },
    });
    data = createDataSource(() => client);
  });

  afterAll(async () => {
    await admin`DELETE FROM funding_events WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM market_latest WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM market_leverage_tiers WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM markets WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM venues WHERE id IN (${venueA}, ${venueB})`;
    await admin.close();
    await client.end();
  });

  test("reads settlements for the given markets, in the window, oldest first", async () => {
    const rows = await data.settlements(
      [
        { venue_id: venueA, venue_symbol: symbolA },
        { venue_id: venueB, venue_symbol: symbolB },
      ],
      settledAt - 7 * 24 * HOUR,
      settledAt,
    );

    expect(rows.map((r) => [r.venue_id, r.venue_symbol, r.rate])).toEqual([
      [venueA, symbolA, 0.0002],
      [venueA, symbolA, 0.0001],
      [venueB, symbolB, -0.0001],
    ]);
    expect(rows[0]?.settled_at).toBeInstanceOf(Date);
    expect(rows[0]?.basis_hours).toBe(8);
  });

  test("matches a symbol containing a comma exactly", async () => {
    const rows = await data.settlements(
      [{ venue_id: venueA, venue_symbol: symbolA }],
      settledAt - 7 * 24 * HOUR,
      settledAt,
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.venue_symbol))).toEqual(new Set([symbolA]));
  });

  test("asking for no markets queries nothing", async () => {
    expect(await data.settlements([], settledAt - HOUR, settledAt)).toEqual([]);
  });

  test("asset and exchange carry max_leverage across from markets", async () => {
    const rows = await data.asset(base);
    expect(rows.map((r) => [r.venue_id, r.max_leverage])).toEqual([
      [venueB, null],
      [venueA, 25],
    ]);
    // Same join on the other read path, and a symbol with a comma still matches exactly.
    expect((await data.exchange(venueA)).map((r) => [r.venue_symbol, r.max_leverage])).toEqual([
      [symbolA, 25],
    ]);
  });

  test("leverageTiers reads ladders for the markets asked for", async () => {
    const rows = await data.leverageTiers([
      { venue_id: venueA, venue_symbol: symbolA },
      { venue_id: venueB, venue_symbol: symbolB },
    ]);
    // venueB publishes no ladder, so it contributes no rows rather than an empty placeholder.
    expect(rows.map((r) => [r.tier, r.lower_notional_usd, r.upper_notional_usd, r.imr])).toEqual([
      [1, 0, 300_000, 0.0066],
      [2, 300_000, null, 0.01],
    ]);
    expect(await data.leverageTiers([])).toEqual([]);
  });

  test("heatmap returns one row per populated cell, with the asset total on each", async () => {
    const cells = await data.heatmap({ limit: 50, offset: 0, minVenues: 2 });
    const mine = cells.filter((c) => c.base === base);

    // Both venues list this asset, so both appear; a missing combination has no row at all.
    expect(mine.map((c) => c.venue_id).sort()).toEqual([venueA, venueB].sort());
    // The asset's summed open interest rides on every cell, so the pivot can order rows without a
    // second query.
    expect(new Set(mine.map((c) => c.asset_oi_usd))).toEqual(new Set([2_000_000]));
    // No stats row exists for these markets, so the trailing windows are null rather than zero.
    expect(mine[0]?.apr_7d).toBeNull();
    expect(mine[0]?.apr_30d).toBeNull();
    expect(mine[0]?.apr_60d).toBeNull();

    // minVenues excludes an asset that cannot show a cross-venue comparison.
    const strict = await data.heatmap({ limit: 50, offset: 0, minVenues: 3 });
    expect(strict.some((c) => c.base === base)).toBe(false);
  });

  test("overview and screener run against the real schema", async () => {
    // They take no market arguments, so this is purely that the SQL is valid under fetch_types: false.
    await expect(data.overview()).resolves.toBeDefined();
    await expect(
      data.screener({
        minOpenInterestUsd: 0,
        minVolume24hUsd: 0,
        venueIds: null,
        venueTypes: null,
        maxAbsApr: 1000,
        limit: 1,
      }),
    ).resolves.toBeDefined();
  });
});
