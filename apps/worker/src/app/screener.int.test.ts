import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { migrate } from "@ai-rates/db";
import { SQL } from "bun";

// Runs only with a database: `bun --env-file=.env.test.local test apps/worker`.
//
// The pairing rules of `screener_pairs`, which every screener read goes through. These lived in the
// Bun collector's tests until that collector was removed (2026-09-24); they test the SQL function,
// not the writer, so rows are inserted into market_latest directly. The writer's own guarantees --
// market_latest only moving forward, the refresh jobs -- are covered by collector-go's store tests.
const url = process.env.DATABASE_URL;
const TEST_SCHEMA = "airates_it";
const MIN = 60_000;

describe.skipIf(!url)("screener_pairs (integration)", () => {
  const tag = crypto.randomUUID().slice(0, 6);
  const [v1, v2, v3] = ["a", "b", "c"].map((s) => `it-${tag}-${s}`) as [string, string, string];
  const asset = `SCR${tag.toUpperCase()}`;
  let sql: SQL;

  interface Leg {
    venue: string;
    symbol: string;
    rate: number;
    at?: number;
    base?: string;
    quote?: string | null;
    assetClass?: string;
    mark?: number | null;
    index?: number | null;
    oi?: number | null;
  }

  /** One market_latest row, shaped as the collector writes it: apr is rate per 8h basis, annualised. */
  const put = async (...legs: Leg[]) => {
    for (const leg of legs) {
      const row = {
        venue_id: leg.venue,
        venue_symbol: leg.symbol,
        base: leg.base ?? asset,
        quote: leg.quote === undefined ? "USDT" : leg.quote,
        asset_class: leg.assetClass ?? "crypto",
        observed_at: new Date(leg.at ?? Date.now()),
        rate: leg.rate,
        basis_hours: 8,
        apr: apr(leg.rate),
        interval_hours: 8,
        kind: "predicted",
        mark_price: leg.mark === undefined ? 10 : leg.mark,
        index_price: leg.index === undefined ? (leg.mark === undefined ? 10 : leg.mark) : leg.index,
        open_interest_usd: leg.oi === undefined ? 5_000_000 : leg.oi,
        volume_24h_usd: 1_000_000,
      };
      await sql`INSERT INTO market_latest ${sql(row)}`;
    }
  };

  const apr = (rate: number) => (rate / 8) * 876000;

  const pairsFor = async (args = "0, 0, NULL, NULL, interval '5 minutes'", base = asset) =>
    (await sql.unsafe(`SELECT * FROM screener_pairs(${args}) WHERE asset = '${base}'`)) as Record<
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
    await sql`
      INSERT INTO venues ${sql([
        { id: v1, name: "Venue A", type: "cex" },
        { id: v2, name: "Venue B", type: "dex" },
        { id: v3, name: "Venue C", type: "cex" },
      ])} ON CONFLICT (id) DO NOTHING`;

    // The base fixture the first four tests share. v1 lists two markets for the asset: the cheapest
    // overall and a rich one that can't pair with itself. v3 has the richest rate but is 10 minutes old.
    const now = Date.now();
    await put(
      { venue: v1, symbol: `${asset}USDT`, rate: -0.0001, at: now },
      { venue: v1, symbol: `${asset}USDC`, rate: 0.0003, at: now },
      { venue: v2, symbol: `${asset}-PERP`, rate: 0.0002, at: now, oi: 500_000 },
      { venue: v3, symbol: `${asset}_USDT`, rate: 0.001, at: now - 10 * MIN },
    );
  });

  afterAll(async () => {
    await sql.unsafe(`DELETE FROM market_latest WHERE venue_id IN ('${v1}', '${v2}', '${v3}')`);
    await sql.unsafe(`DELETE FROM venues WHERE id IN ('${v1}', '${v2}', '${v3}')`);
    await sql.close();
  });

  test("pairs the cheapest and richest markets on different venues, ignoring stale ones", async () => {
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

  test("caps absolute APR per leg", async () => {
    // Live legs: v1 at -10.95% and +32.85% APR, v2 at +21.9%.
    const age = "interval '5 minutes'";
    expect(await pairsFor(`0, 0, NULL, NULL, ${age}, 100`)).toHaveLength(1);
    // Only v1's -10.95% leg survives a 15% cap, and one venue can't make a pair.
    expect(await pairsFor(`0, 0, NULL, NULL, ${age}, 15`)).toEqual([]);
    expect(await pairsFor(`0, 0, NULL, NULL, ${age}, NULL`)).toHaveLength(1);
  });

  test("drops legs whose mark price disagrees with the rest of the asset", async () => {
    const odd = `${asset}-ODD`;
    // Same asset, but priced like something else entirely (gate's CAT vs the CAT memecoin).
    await put({ venue: v3, symbol: odd, rate: 0.002, mark: 10_000 });
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
    const deep = `${asset}DEEP`;
    await put(
      { venue: v1, symbol: `${deep}-A`, base: deep, rate: 0.0001, mark: 10, oi: 100_000 },
      { venue: v2, symbol: `${deep}-B`, base: deep, rate: 0.0009, mark: 10, oi: 100_000 },
      // Ninety times the open interest of the two combined, and priced like a different instrument.
      { venue: v3, symbol: `${deep}-C`, base: deep, rate: 0.0005, mark: 1000, oi: 9_000_000 },
    );
    // One market agrees with the anchor, so there is no pair -- and no pair is the honest answer.
    expect(await pairsFor(undefined, deep)).toHaveLength(0);
  });

  test("one ticker in two asset classes pairs as two assets, neither anchoring the other", async () => {
    // The BB shape from migration 017: BlackBerry marks ~7.7 on two venues while BounceBit marks
    // ~0.008 on two others. Keyed on (asset_class, base), each side is a complete pool of its own.
    const ticker = `${asset}BB`;
    const leg = (venue: string, assetClass: string, mark: number, rate: number, oi: number) => ({
      venue,
      symbol: `${ticker}-${assetClass}`,
      base: ticker,
      assetClass,
      mark,
      rate,
      oi,
    });
    await put(
      leg(v1, "equity", 7.72, 0.0001, 90_000_000),
      leg(v2, "equity", 7.73, 0.0004, 1_000_000),
      leg(v2, "crypto", 0.0081, -0.0002, 800_000),
      leg(v3, "crypto", 0.008, 0.0003, 900_000),
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
    const ticker = `${asset}Q`;
    const leg = (venue: string, quote: string | null, rate: number) => ({
      venue,
      symbol: `${ticker}-${quote ?? "none"}`,
      base: ticker,
      quote,
      rate,
    });
    await put(
      leg(v1, "USDT", -0.0003),
      leg(v2, "USDC", 0.0005),
      leg(v2, null, 0.0009),
      leg(v3, "USDT", 0.0002),
    );

    const read = async (sameQuote: boolean) =>
      (await sql.unsafe(
        `SELECT long_venue_id, short_venue_id, long_quote, short_quote, venue_count
         FROM screener_pairs(0, 0, NULL, NULL, interval '5 minutes', NULL, 0.10, ${sameQuote})
         WHERE asset = '${ticker}'`,
      )) as Record<string, unknown>[];

    // Default: pairs across quotes, saying so. The unknown-quote leg is the richest, so it is the short.
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
    // The seven-argument call still resolves.
    const [legacy] = (await sql.unsafe(
      `SELECT long_venue_id FROM screener_pairs(0, 0, NULL, NULL, interval '5 minutes', NULL, 0.10)
       WHERE asset = '${ticker}'`,
    )) as Record<string, unknown>[];
    expect(legacy?.long_venue_id).toBe(v1);
  });

  test("a venue that publishes no mark is gated on its index price instead of waved through", async () => {
    // Migration 020. HTX and BitMart publish no bulk mark price. Under 016's null escape their
    // markets agreed with any anchor by default, so a same-named token 50x away would have paired.
    const ticker = `${asset}IX`;
    await put(
      {
        venue: v1,
        symbol: `${ticker}-A`,
        base: ticker,
        rate: 0.0001,
        mark: 10,
        index: 10,
        oi: 90_000_000,
      },
      // No mark and an index 50x away: a different asset under the same ticker.
      {
        venue: v2,
        symbol: `${ticker}-B`,
        base: ticker,
        rate: 0.0009,
        mark: null,
        index: 500,
        oi: 1_000_000,
      },
      // No mark but an index that agrees: the same asset, and it must still pair.
      {
        venue: v3,
        symbol: `${ticker}-C`,
        base: ticker,
        rate: 0.0004,
        mark: null,
        index: 10.1,
        oi: 1_000_000,
      },
    );
    expect(
      (await sql.unsafe(
        `SELECT long_venue_id, short_venue_id, venue_count FROM screener_pairs(0, 0, NULL, NULL, interval '5 minutes')
         WHERE asset = '${ticker}'`,
      )) as Record<string, unknown>[],
    ).toEqual([{ long_venue_id: v1, short_venue_id: v3, venue_count: 2 }]);
  });
});
