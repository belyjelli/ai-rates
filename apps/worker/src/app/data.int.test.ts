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
