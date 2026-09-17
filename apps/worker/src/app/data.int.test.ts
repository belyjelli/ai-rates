import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { migrate } from "@ai-rates/db";
import { SQL } from "bun";
import postgres from "postgres";
import { createDataSource, type ScreenerFilters, type ScreenerSort, venueState } from "./data";

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
  // A second asset, so the sort tests have something to order against.
  const base2 = `IT2${tag.toUpperCase()}`;
  const symbolA2 = `${base2}-A`;
  const symbolB2 = `${base2}-B`;
  // A third asset with no stats row at all, so the "windows are null, never zero" assertions own
  // their own data instead of depending on another fixture not seeding stats.
  const base3 = `IT3${tag.toUpperCase()}`;
  const symbolA3 = `${base3}-A`;
  const symbolB3 = `${base3}-B`;
  const settledAt = Math.floor(Date.now() / HOUR) * HOUR;
  /** The UTC date `msAgo` before settledAt, as the daily rollup keys its rows. */
  const dayOf = (msAgo: number) => new Date(settledAt - msAgo).toISOString().slice(0, 10);

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

    // The daily rollup the backtest reads. Written directly rather than folded from funding_events:
    // folding is the collector's job, and this checks the read.
    const dayRow = (
      venue_id: string,
      venue_symbol: string,
      msAgo: number,
      rate_sum: number,
      settlements: number,
    ) => ({
      venue_id,
      venue_symbol,
      day: dayOf(msAgo),
      rate_sum,
      basis_hours_sum: settlements * 8,
      settlements,
    });
    await admin`
      INSERT INTO market_funding_daily ${admin([
        dayRow(venueA, symbolA, 24 * HOUR, 0.0003, 2),
        dayRow(venueA, symbolA, 0, 0.0001, 1),
        dayRow(venueA, symbolA, 10 * 24 * HOUR, 0.0009, 3), // outside a 7-day window
        dayRow(venueB, symbolB, 24 * HOUR, -0.0001, 1),
        dayRow(venueB, "OTHER-PERP", 24 * HOUR, 0.005, 3), // same venue, market not asked for
      ])}`;

    // The hourly rollup the pair chart reads over its short windows, written directly for the same
    // reason as the daily rows above.
    const hourRow = (venue_id: string, venue_symbol: string, msAgo: number, rate_sum: number) => ({
      venue_id,
      venue_symbol,
      hour: new Date(settledAt - msAgo),
      rate_sum,
      basis_hours_sum: 8,
      settlements: 1,
    });
    await admin`
      INSERT INTO market_funding_hourly ${admin([
        hourRow(venueA, symbolA, 2 * HOUR, 0.0001),
        hourRow(venueA, symbolA, 9 * 24 * HOUR, 0.0009), // before the window asked for
        hourRow(venueB, symbolB, 2 * HOUR, -0.0002),
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

    // A second asset whose live spread is wider than the first's, but whose 7d settled spread is
    // narrower. The two sorts must therefore disagree — if they agreed, an ordering test would
    // pass whichever ORDER BY fragment actually ran.
    await admin`
      INSERT INTO markets ${admin([
        {
          venue_id: venueA,
          venue_symbol: symbolA2,
          base: base2,
          quote: "USDT",
          multiplier: 1,
          dex: null,
          interval_hours: 8,
          max_leverage: null,
          last_seen: now,
        },
        {
          venue_id: venueB,
          venue_symbol: symbolB2,
          base: base2,
          quote: null,
          multiplier: 1,
          dex: null,
          interval_hours: 8,
          max_leverage: null,
          last_seen: now,
        },
      ])}`;
    await admin`
      INSERT INTO market_latest ${admin([
        { ...latest(venueA, symbolA2, "USDT", 0.0003), base: base2 },
        { ...latest(venueB, symbolB2, null, -0.0003), base: base2 },
      ])}`;

    // spread_apr_7d is richest-leg minus cheapest-leg 7d APR, so these give base a 100-point 7d
    // spread against base2's 5.
    const stat = (
      venue_id: string,
      venue_symbol: string,
      apr7d: number,
      stability: number | null = null,
      stabilityDays: number | null = null,
    ) => ({
      venue_id,
      venue_symbol,
      apr_24h: apr7d,
      apr_7d: apr7d,
      settlements_24h: 3,
      settlements_7d: 21,
      stability_30d: stability,
      stability_days: stabilityDays,
      momentum_30d: null,
      updated_at: now,
    });
    // base is scored on BOTH legs, so it gets a pair figure: the weaker leg, 0.60, not 0.80.
    //
    // base2 is scored on ONE leg only, at 0.87 -- higher than anything base has. That asymmetry is
    // the point: least() skips nulls rather than propagating them (verified: least(0.7, NULL) =
    // 0.7), so a bare least() would hand base2 a 0.87 and rank it FIRST, flattering the pair whose
    // data is incomplete. screener_pairs uses a CASE instead, so base2's pair figure is null and
    // NULLS LAST puts it behind base. 127 live assets have exactly this shape.
    await admin`
      INSERT INTO market_funding_stats ${admin([
        stat(venueA, symbolA, 50, 0.8, 30),
        stat(venueB, symbolB, -50, 0.6, 12),
        stat(venueA, symbolA2, 5, 0.87, 31),
        stat(venueB, symbolB2, 0, null, null),
      ])} ON CONFLICT (venue_id, venue_symbol) DO NOTHING`;

    // base3 deliberately gets markets but no stats, so a heatmap cell for it has null windows.
    await admin`
      INSERT INTO markets ${admin([
        {
          venue_id: venueA,
          venue_symbol: symbolA3,
          base: base3,
          quote: "USDT",
          multiplier: 1,
          dex: null,
          interval_hours: 8,
          max_leverage: null,
          last_seen: now,
        },
        {
          venue_id: venueB,
          venue_symbol: symbolB3,
          base: base3,
          quote: null,
          multiplier: 1,
          dex: null,
          interval_hours: 8,
          max_leverage: null,
          last_seen: now,
        },
      ])}`;
    await admin`
      INSERT INTO market_latest ${admin([
        { ...latest(venueA, symbolA3, "USDT", 0.0002), base: base3 },
        { ...latest(venueB, symbolB3, null, -0.0002), base: base3 },
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
    await admin`DELETE FROM market_funding_daily WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM market_funding_hourly WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM market_latest WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM market_leverage_tiers WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM market_identity_checks WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM market_pair_backtests WHERE long_venue_id IN (${venueA}, ${venueB})`;
    // collector_runs was not cleaned before venueStatus seeded it; without this the rows outlive
    // the run in the shared airates_it schema, which is the leak screener.int.test.ts warns about.
    await admin`DELETE FROM collector_runs WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM market_funding_stats WHERE venue_id IN (${venueA}, ${venueB})`;
    // liquidations.venue_id references venues(id), so it has to go before the venue does -- the
    // liquidationMap fixtures are the first rows this suite ever put in that table.
    await admin`DELETE FROM liquidations WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM markets WHERE venue_id IN (${venueA}, ${venueB})`;
    await admin`DELETE FROM venues WHERE id IN (${venueA}, ${venueB})`;
    await admin.close();
    await client.end();
  });

  test("reads identity verdicts, keeping 'not applicable' distinct from zero", async () => {
    await admin`
      INSERT INTO market_identity_checks ${admin([
        {
          checked_at: new Date(settledAt),
          base,
          venue_id: venueB,
          venue_symbol: symbolB,
          // The anchor's symbol contains a comma, so this also proves the round trip is not
          // splitting a delimited list anywhere along the way.
          anchor_venue_id: venueA,
          anchor_venue_symbol: symbolA,
          verdict: "mismatch",
          price_ratio: 104.64991,
          scale_exponent: null,
          return_corr: 0.005,
          ratio_sd: 0.00176,
          shared_minutes: 360,
          member_moves: 241,
          anchor_moves: 262,
          member_oi_usd: 20_000,
          anchor_oi_usd: 11_140_000,
        },
      ])}`;

    const rows = await data.identityChecks();
    const row = rows.find((r) => r.venue_id === venueB && r.venue_symbol === symbolB);
    expect(row?.base).toBe(base);
    expect(row?.verdict).toBe("mismatch");
    expect(row?.anchor_venue_symbol).toBe(symbolA);
    expect(row?.price_ratio).toBeCloseTo(104.64991, 5);
    expect(row?.return_corr).toBeCloseTo(0.005, 6);
    expect(row?.shared_minutes).toBe(360);
    // Null has to survive as null. A scale exponent of 0 would mean "10^0, no scaling", and a
    // correlation of 0 would read as positive evidence of a mismatch — both are different claims
    // from "this does not apply", which is what the column actually says here.
    expect(row?.scale_exponent).toBeNull();
    expect(row?.checked_at).toBeInstanceOf(Date);
  });

  test("reads the daily rollup for the given markets from the first day, oldest first", async () => {
    const rows = await data.dailyFunding(
      [
        { venue_id: venueA, venue_symbol: symbolA },
        { venue_id: venueB, venue_symbol: symbolB },
      ],
      dayOf(7 * 24 * HOUR),
    );

    expect(rows.map((r) => [r.venue_id, r.venue_symbol, r.day, r.rate_sum, r.settlements])).toEqual(
      [
        [venueA, symbolA, dayOf(24 * HOUR), 0.0003, 2],
        [venueB, symbolB, dayOf(24 * HOUR), -0.0001, 1],
        [venueA, symbolA, dayOf(0), 0.0001, 1],
      ],
    );
    // A plain date string, so no time zone between Postgres and the Worker can shift a day.
    expect(typeof rows[0]?.day).toBe("string");
    expect(rows[0]?.basis_hours_sum).toBe(16);
  });

  test("matches a symbol containing a comma exactly", async () => {
    const rows = await data.dailyFunding(
      [{ venue_id: venueA, venue_symbol: symbolA }],
      dayOf(7 * 24 * HOUR),
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.venue_symbol))).toEqual(new Set([symbolA]));
  });

  test("asking for no markets queries nothing", async () => {
    expect(await data.dailyFunding([], dayOf(0))).toEqual([]);
    expect(await data.hourlyFunding([], settledAt)).toEqual([]);
  });

  test("reads the hourly rollup from the window's start, with the hour as epoch milliseconds", async () => {
    const rows = await data.hourlyFunding(
      [
        { venue_id: venueA, venue_symbol: symbolA },
        { venue_id: venueB, venue_symbol: symbolB },
      ],
      settledAt - 7 * 24 * HOUR,
    );

    expect(rows.map((r) => [r.venue_id, r.venue_symbol, r.hour_ms, r.rate_sum])).toEqual([
      [venueA, symbolA, settledAt - 2 * HOUR, 0.0001],
      [venueB, symbolB, settledAt - 2 * HOUR, -0.0002],
    ]);
    expect(typeof rows[0]?.hour_ms).toBe("number");
    expect(rows[0]?.basis_hours_sum).toBe(8);
  });

  /**
   * The mark-agreement guard and the depth handling, against the real schema.
   *
   * This is the only place either actually executes: the unit tests fake the DataSource, and a
   * naive symbol join is exactly what produced gaps of 13,660,780 bps on KR200 — a market quoting
   * 1096.67 on one venue against 0.7973 on another. So the fixture plants that same shape and
   * asserts it is dropped rather than ranked.
   */
  describe("arbitrage", () => {
    const base4 = `IT4${tag.toUpperCase()}`;
    const symbolA4 = `${base4}-A`;
    const symbolB4 = `${base4}-B`;
    // A mismatched instrument on a venue that also lists the real one. market_latest keys on
    // (venue_id, venue_symbol), so it needs its own symbol rather than a duplicate row.
    const symbolA4Bad = `${base4}-MISMATCH`;
    const quoted = (
      venue_id: string,
      venue_symbol: string,
      mark: number,
      bid: number,
      ask: number,
      bidSize: number | null,
      askSize: number | null,
    ) => ({
      venue_id,
      venue_symbol,
      base: base4,
      quote: "USDT",
      observed_at: new Date(),
      rate: 0.0001,
      basis_hours: 8,
      apr: 10.95,
      interval_hours: 8,
      next_funding_at: new Date(settledAt + HOUR),
      kind: "predicted",
      mark_price: mark,
      index_price: mark,
      open_interest_usd: 1_000_000,
      volume_24h_usd: 2_000_000,
      best_bid: bid,
      best_ask: ask,
      best_bid_size_usd: bidSize,
      best_ask_size_usd: askSize,
      // Migration 022: a row carrying a book carries the time its book was seen, and arbitrage()
      // gates the quote columns on THAT rather than on observed_at. A fixture that fills best_bid
      // and leaves quotes_at null is a row the collector cannot produce, and the query is right to
      // ignore it.
      quotes_at: new Date(),
    });

    beforeAll(async () => {
      await admin`
        INSERT INTO market_latest ${admin([
          // The honest pair: buy at 100.00 on A, sell at 100.50 on B — a 50 bps gap.
          quoted(venueA, symbolA4, 100, 99.9, 100, 50_000, 20_000),
          quoted(venueB, symbolB4, 100, 100.5, 100.6, 80_000, 90_000),
          // 1375x out, quoting an ask of 0.07. Ungated, this would be venue A's cheapest ask and
          // would manufacture a gap of roughly 1.4 million bps.
          quoted(venueA, symbolA4Bad, 137_550, 0.0697, 0.07, 10_000, 10_000),
        ])} ON CONFLICT (venue_id, venue_symbol) DO NOTHING`;
    });

    const mine = async (options = {}) =>
      (
        await data.arbitrage({ minGapBps: 0, minDepthUsd: 0, limit: 50, offset: 0, ...options })
      ).filter((r) => r.asset === base4);

    test("drops a mismatched instrument instead of quoting a fictional gap", async () => {
      const [row] = await mine();

      expect(row?.asset).toBe(base4);
      // 100.5 against 100.0 — the real pair, not the 1.4M bps the mismatch would have produced.
      expect(row?.gap_bps).toBeCloseTo(50, 6);
      expect(row?.buy_venue_id).toBe(venueA);
      expect(row?.buy_symbol).toBe(symbolA4);
      expect(row?.sell_venue_id).toBe(venueB);
      expect(row?.venue_count).toBe(2);
    });

    test("reports the thinner of the two resting sizes", async () => {
      const [row] = await mine();
      // Buying takes A's ask ($20k), selling hits B's bid ($80k). The gap is good for the smaller.
      expect(row?.buy_depth_usd).toBeCloseTo(20_000, 6);
      expect(row?.sell_depth_usd).toBeCloseTo(80_000, 6);
      expect(row?.thinner_depth_usd).toBeCloseTo(20_000, 6);
    });

    test("a depth floor excludes a quote whose size is unknown", async () => {
      const base5 = `IT5${tag.toUpperCase()}`;
      await admin`
        INSERT INTO market_latest ${admin([
          { ...quoted(venueA, `${base5}-A`, 100, 99.9, 100, 50_000, null), base: base5 },
          { ...quoted(venueB, `${base5}-B`, 100, 100.5, 100.6, 80_000, 90_000), base: base5 },
        ])} ON CONFLICT (venue_id, venue_symbol) DO NOTHING`;

      const all = await data.arbitrage({
        minGapBps: 0,
        minDepthUsd: 0,
        limit: 50,
        offset: 0,
      });
      const unknown = all.find((r) => r.asset === base5);
      // least() would have skipped the null and reported $80k as the size this gap is good for.
      expect(unknown?.thinner_depth_usd).toBeNull();

      const floored = await data.arbitrage({
        minGapBps: 0,
        minDepthUsd: 1_000,
        limit: 50,
        offset: 0,
      });
      expect(floored.some((r) => r.asset === base5)).toBe(false);
    });

    // Migration 022 split the row's freshness in two, and these are the two halves of that split.
    // Before it, the second of these tests could not be written at all: one timestamp cannot say
    // that a book is live and the funding row behind it is not.
    test("a venue whose funding poll died keeps quoting, with its mark withheld", async () => {
      const base6 = `ITQ1${tag.toUpperCase()}`;
      const stale = new Date(Date.now() - 30 * 60_000);
      await admin`
        INSERT INTO market_latest ${admin([
          // A's funding row is half an hour old — dead, by the 5-minute window — but its feed is
          // still delivering a book. Its mark must stop gating and its quote must keep counting.
          {
            ...quoted(venueA, `${base6}-A`, 100, 99.9, 100, 50_000, 20_000),
            base: base6,
            observed_at: stale,
          },
          { ...quoted(venueB, `${base6}-B`, 100, 100.5, 100.6, 80_000, 90_000), base: base6 },
        ])} ON CONFLICT (venue_id, venue_symbol) DO NOTHING`;

      const [row] = (
        await data.arbitrage({ minGapBps: 0, minDepthUsd: 0, limit: 50, offset: 0 })
      ).filter((r) => r.asset === base6);
      expect(row?.gap_bps).toBeCloseTo(50, 6);
      expect(row?.buy_venue_id).toBe(venueA);
      // The prices are current even though one leg's funding row is not, and the row says both.
      expect(row?.oldest_quoted_at.getTime()).toBeGreaterThan(stale.getTime());
      expect(row?.oldest_observed_at.getTime()).toBeCloseTo(stale.getTime(), -3);

      const quotes = await data.priceQuotes(base6, "crypto");
      const legA = quotes.find((q) => q.venue_id === venueA);
      // Withheld, not stale: the page can say why rather than printing a half-hour-old mark.
      expect(legA?.mark_price).toBeNull();
      expect(legA?.mark_agrees).toBe(true);
      expect(legA?.best_bid).toBeCloseTo(99.9, 6);
    });

    test("a fresh funding row does not keep a stale quote on the page", async () => {
      const base7 = `ITQ2${tag.toUpperCase()}`;
      const stale = new Date(Date.now() - 30 * 60_000);
      await admin`
        INSERT INTO market_latest ${admin([
          // The mirror image: the poll is current, the book is half an hour old. Gating on
          // observed_at alone would print these prices as if they were live.
          {
            ...quoted(venueA, `${base7}-A`, 100, 99.9, 100, 50_000, 20_000),
            base: base7,
            quotes_at: stale,
          },
          { ...quoted(venueB, `${base7}-B`, 100, 100.5, 100.6, 80_000, 90_000), base: base7 },
        ])} ON CONFLICT (venue_id, venue_symbol) DO NOTHING`;

      const rows = (
        await data.arbitrage({ minGapBps: 0, minDepthUsd: 0, limit: 50, offset: 0 })
      ).filter((r) => r.asset === base7);
      // One leg left, and a gap needs two: the asset drops out entirely rather than pairing a live
      // quote against a stale one.
      expect(rows).toEqual([]);
      const quotes = await data.priceQuotes(base7, "crypto");
      expect(quotes.map((q) => q.venue_id)).toEqual([venueB]);
    });

    test("the gap floor keeps only rows at or above it", async () => {
      expect((await mine({ minGapBps: 49 })).length).toBe(1);
      expect((await mine({ minGapBps: 51 })).length).toBe(0);
    });

    test("priceQuotes flags the mismatched instrument instead of dropping it", async () => {
      const quotes = await data.priceQuotes(base4, null);
      // All three, including the 1375x mismatch the list query excludes: the detail page shows it.
      expect(quotes).toHaveLength(3);

      const bySymbol = new Map(quotes.map((q) => [q.venue_symbol, q]));
      expect(bySymbol.get(symbolA4)?.mark_agrees).toBe(true);
      expect(bySymbol.get(symbolB4)?.mark_agrees).toBe(true);
      expect(bySymbol.get(symbolA4Bad)?.mark_agrees).toBe(false);
      // The reference the guard measures against travels with every row.
      expect(bySymbol.get(symbolA4Bad)?.anchor_mark).toBeCloseTo(100, 6);
      // Cheapest ask first: the mismatch quotes 0.07, so it leads despite being excluded.
      expect(quotes[0]?.venue_symbol).toBe(symbolA4Bad);
    });
  });

  describe("venueStatus", () => {
    beforeAll(async () => {
      const run = (venue_id: string, minutesAgo: number, error: string | null) => ({
        started_at: new Date(Date.now() - minutesAgo * 60_000),
        venue_id,
        duration_ms: 306,
        markets: 12,
        requests: 2,
        error,
      });
      // venueA: three runs, one of which failed, with the newest clean.
      // venueB: deliberately none, so the "silent" path has real data behind it.
      await admin`
        INSERT INTO collector_runs ${admin([
          run(venueA, 3, null),
          run(venueA, 4, "HTTP 429 rate limited"),
          run(venueA, 5, null),
        ])}`;
    });

    const mine = async () =>
      new Map((await data.venueStatus()).map((v) => [v.venue_id, v] as const));

    test("counts failures over the window rather than only the last run", async () => {
      const a = (await mine()).get(venueA);
      expect(a?.runs_24h).toBe(3);
      // One blip and a venue that is down are indistinguishable without this.
      expect(a?.failures_24h).toBe(1);
      // The newest run is clean, so the venue is not currently failing.
      expect(a?.last_error).toBeNull();
      expect(a?.last_success_at).toBeInstanceOf(Date);
    });

    test("a venue with no runs still appears, rather than vanishing from the join", async () => {
      const b = (await mine()).get(venueB);
      expect(b).toBeDefined();
      expect(b?.last_run_at).toBeNull();
      expect(b?.runs_24h).toBe(0);
      // venueB has never run at all, so it is a venue nobody built an adapter for -- `planned` --
      // rather than one that was running and stopped, which is what `silent` means.
      expect(b?.last_run_ever).toBeNull();
      expect(venueState(b as NonNullable<typeof b>, Date.now())).toBe("planned");
    });

    test("a venue that ran inside retention but not today is silent, not planned", async () => {
      // The distinction the page exists to make: stopping is an alarm, never starting is a backlog
      // item. Driven off last_run_ever, which is bounded by the 30-day retention policy.
      const a = (await mine()).get(venueA);
      expect(a?.last_run_ever).toBeInstanceOf(Date);
      const stopped = { ...(a as NonNullable<typeof a>), last_run_at: null };
      expect(venueState(stopped, Date.now())).toBe("silent");
    });

    test("live market counts come from market_latest, not from the run's own figure", async () => {
      const a = (await mine()).get(venueA);
      // The seeded run claims 12 markets; what is actually live is whatever market_latest holds.
      expect(a?.last_run_markets).toBe(12);
      expect(a?.live_markets).toBeGreaterThan(0);
      expect(a?.live_markets).not.toBe(12);
    });
  });

  test("verifiedPairs reads the newest run only, against the real schema", async () => {
    // The unit tests fake the DataSource, so this is the only place the query actually runs with
    // production client options — the header above explains why that matters.
    const row = (runDay: string, asset: string, net: number) => ({
      run_day: runDay,
      asset,
      long_venue_id: venueA,
      long_symbol: symbolA,
      short_venue_id: venueB,
      short_symbol: symbolB,
      size_usd: 10_000,
      days: 7,
      net_funding_usd: net,
      net_funding_apr_percent: net / 10,
      win_rate_days: 1,
      avg_daily_usd: net / 7,
      long_settlements: 21,
      short_settlements: 21,
      missed_settlements: 0,
      thinner_leg_oi_usd: 500_000,
      worst_leg_abs_apr: 120,
      pair_stability: 0.8,
      long_charge_days: 7,
      short_charge_days: 7,
    });
    await admin`
      INSERT INTO market_pair_backtests ${admin([
        // Yesterday's run must not be mixed into today's ranking, even though it pays more.
        row("2026-09-11", `${base}OLD`, 999),
        row("2026-09-12", `${base}HI`, 500),
        row("2026-09-12", `${base}LO`, 100),
      ])} ON CONFLICT (run_day, asset_class, asset) DO NOTHING`;

    const pairs = await data.verifiedPairs(10);
    const mine = pairs.filter((p) => p.asset.startsWith(base));
    // Newest run only, ordered by what settled.
    expect(mine.map((p) => p.asset)).toEqual([`${base}HI`, `${base}LO`]);
    expect(mine[0]?.net_funding_usd).toBeCloseTo(500, 6);
    // The risk columns survive the round trip rather than arriving undefined.
    expect(mine[0]?.thinner_leg_oi_usd).toBeCloseTo(500_000, 6);
    expect(mine[0]?.pair_stability).toBeCloseTo(0.8, 6);
    expect(mine[0]?.run_day).toBeInstanceOf(Date);
    expect(await data.verifiedPairs(1)).toHaveLength(1);
  });

  test("bestVerifiedPair heads the page only with a pair someone could hold", async () => {
    // Its own prefix, so the ranking test above still sees only its two rows under `base`.
    const prefix = `BV${tag.toUpperCase()}`;
    const row = (asset: string, overrides: Record<string, number | null> = {}) => ({
      // The same run as the test above: a newer day would retire that test's rows on a re-run.
      run_day: "2026-09-12",
      asset: `${prefix}${asset}`,
      long_venue_id: venueA,
      long_symbol: symbolA,
      short_venue_id: venueB,
      short_symbol: symbolB,
      size_usd: 10_000,
      days: 7,
      // Far above anything a real row pays, so a leftover from another run cannot outrank these.
      net_funding_usd: 900_000,
      net_funding_apr_percent: 50,
      win_rate_days: 1,
      avg_daily_usd: 100,
      long_settlements: 21,
      short_settlements: 21,
      missed_settlements: 0,
      thinner_leg_oi_usd: 5_000_000,
      worst_leg_abs_apr: 60,
      pair_stability: 0.8,
      long_charge_days: 7,
      short_charge_days: 7,
      ...overrides,
    });
    await admin`
      INSERT INTO market_pair_backtests ${admin([
        // Each misses exactly one part of the bar, and each pays more than the pair that clears it.
        row("THIN", { net_funding_usd: 990_000, thinner_leg_oi_usd: 900_000 }),
        row("HOT", { net_funding_usd: 980_000, worst_leg_abs_apr: 250 }),
        row("FLIP", { net_funding_usd: 970_000, pair_stability: 0.6 }),
        row("GAPS", { net_funding_usd: 960_000, missed_settlements: 2 }),
        row("NOSCORE", { net_funding_usd: 950_000, pair_stability: null }),
        row("OK"),
      ])} ON CONFLICT (run_day, asset_class, asset) DO NOTHING`;

    const best = await data.bestVerifiedPair();
    expect(best?.asset).toBe(`${prefix}OK`);
    expect(best?.run_day).toBeInstanceOf(Date);
  });

  /**
   * Migration 017: one ticker, two assets. BlackBerry (equity) is the deeper market here on purpose,
   * so a class-less read that picked the deepest class would land on it; the rule is crypto first.
   */
  describe("asset class", () => {
    const shared = `IT6${tag.toUpperCase()}`;
    const stockOnly = `IT7${tag.toUpperCase()}`;
    const row = (
      venue_id: string,
      venue_symbol: string,
      rowBase: string,
      asset_class: string,
      mark: number,
      openInterest: number,
    ) => ({
      venue_id,
      venue_symbol,
      base: rowBase,
      asset_class,
      quote: "USDT",
      observed_at: new Date(),
      rate: 0.0001,
      basis_hours: 8,
      apr: 10.95,
      interval_hours: 8,
      next_funding_at: new Date(settledAt + HOUR),
      kind: "predicted",
      mark_price: mark,
      index_price: mark,
      open_interest_usd: openInterest,
      volume_24h_usd: 2_000_000,
      best_bid: mark * 0.999,
      best_ask: mark * 1.001,
      best_bid_size_usd: 10_000,
      best_ask_size_usd: 10_000,
      quotes_at: new Date(),
    });

    beforeAll(async () => {
      await admin`
        INSERT INTO market_latest ${admin([
          row(venueA, `${shared}-STOCK`, shared, "equity", 7.72, 90_000_000),
          row(venueB, `${shared}-STOCK`, shared, "equity", 7.73, 5_000_000),
          row(venueB, `${shared}-TOKEN`, shared, "crypto", 0.008, 800_000),
          row(venueA, `${stockOnly}-STOCK`, stockOnly, "equity", 250, 1_000_000),
        ])} ON CONFLICT (venue_id, venue_symbol) DO NOTHING`;
    });

    test("a class-less read is crypto when the ticker has a crypto market, however deep the other", async () => {
      const rows = await data.asset(shared, null);
      expect(rows.map((r) => [r.venue_symbol, r.asset_class])).toEqual([
        [`${shared}-TOKEN`, "crypto"],
      ]);
    });

    test("an explicit class reads only that asset's markets", async () => {
      const rows = await data.asset(shared, "equity");
      expect(rows.map((r) => r.asset_class)).toEqual(["equity", "equity"]);
      const quotes = await data.priceQuotes(shared, "equity");
      expect(quotes.map((q) => q.venue_symbol).sort()).toEqual([
        `${shared}-STOCK`,
        `${shared}-STOCK`,
      ]);
      // BounceBit's 0.008 mark never becomes BlackBerry's anchor, so both stock quotes agree.
      expect(quotes.every((q) => q.mark_agrees && q.asset_class === "equity")).toBe(true);
    });

    test("a ticker with no crypto market resolves to the class it has", async () => {
      const rows = await data.asset(stockOnly, null);
      expect(rows.map((r) => r.asset_class)).toEqual(["equity"]);
      expect(await data.asset(stockOnly, "crypto")).toEqual([]);
    });
  });

  test("asset and exchange carry max_leverage across from markets", async () => {
    const rows = await data.asset(base, null);
    expect(rows.map((r) => [r.venue_id, r.max_leverage])).toEqual([
      [venueB, null],
      [venueA, 25],
    ]);
    // Same join on the other read path, and a symbol with a comma still matches exactly. Scoped to
    // this symbol because other fixtures in this file also list markets on venueA.
    expect(
      (await data.exchange(venueA))
        .filter((r) => r.venue_symbol === symbolA)
        .map((r) => [r.venue_symbol, r.max_leverage]),
    ).toEqual([[symbolA, 25]]);
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
    // base3 has markets but no stats row, so its windows are null rather than zero. A market that
    // simply has no settled history must never read as "funding was flat".
    const noStats = cells.filter((c) => c.base === base3);
    expect(noStats).not.toHaveLength(0);
    expect(noStats[0]?.apr_7d).toBeNull();
    expect(noStats[0]?.apr_30d).toBeNull();
    expect(noStats[0]?.apr_60d).toBeNull();

    // minVenues excludes an asset that cannot show a cross-venue comparison.
    const strict = await data.heatmap({ limit: 50, offset: 0, minVenues: 3 });
    expect(strict.some((c) => c.base === base)).toBe(false);
  });

  test("screener honours each sort key, against the real ORDER BY", async () => {
    const forSort = (sort: ScreenerSort): ScreenerFilters => ({
      minOpenInterestUsd: 0,
      minVolume24hUsd: 0,
      venueIds: null,
      venueTypes: null,
      maxAbsApr: null,
      sameQuote: false,
      sort,
      limit: 200,
    });
    // Other suites share this schema, so only the two assets seeded here are compared.
    const mine = async (sort: ScreenerSort) =>
      (await data.screener(forSort(sort)))
        .map((p) => p.asset)
        .filter((asset) => asset === base || asset === base2);

    // base2's live spread is the wider one; base's 7d settled spread is. The orders invert, which
    // is the only way to prove the sort key reached the query rather than being ignored.
    expect(await mine("spread")).toEqual([base2, base]);
    expect(await mine("settled_7d")).toEqual([base, base2]);
    // Both assets sit on two venues, so `venues` falls through to its spread secondary key.
    expect(await mine("venues")).toEqual([base2, base]);
    // base2's single scored leg (0.87) beats both of base's, but one leg is unscored, so its pair
    // figure is null and it sorts last. A bare least() would have ranked it first.
    expect(await mine("stability")).toEqual([base, base2]);
  });

  test("pair stability is the weaker leg, and null when either leg is unscored", async () => {
    const rows = await data.screener({
      minOpenInterestUsd: 0,
      minVolume24hUsd: 0,
      venueIds: null,
      venueTypes: null,
      maxAbsApr: null,
      sameQuote: false,
      sort: "stability",
      limit: 200,
    });
    const scored = rows.find((p) => p.asset === base);
    // 0.60 is venueB's leg; 0.80 is venueA's and 0.70 their mean. Neither may appear.
    expect(scored?.pair_stability).toBeCloseTo(0.6, 6);
    expect(scored?.long_stability_days).not.toBe(scored?.short_stability_days);

    // One leg scored at 0.87, the other not scored at all: the pair figure must be null rather
    // than inheriting the scored leg, which is what least() alone would have produced.
    const mixed = rows.find((p) => p.asset === base2);
    expect(mixed).toBeDefined();
    expect(mixed?.pair_stability).toBeNull();
    expect([mixed?.long_stability, mixed?.short_stability]).toContain(null);

    // base3 has no stats row at all, so both legs are unscored.
    const none = rows.find((p) => p.asset === base3);
    expect(none?.pair_stability).toBeNull();
    expect(none?.long_stability).toBeNull();
    expect(none?.short_stability).toBeNull();
  });

  describe("liquidationMap", () => {
    const liqAsset = `ITL${tag.toUpperCase()}`;
    const liqSymbolA = `${liqAsset}_USDT`;
    const liqSymbolB = `${liqAsset}-USDT-SWAP`;
    // Aligned to a 2-hour boundary so the bucket a row lands in is not a function of when the test
    // happens to run.
    const bucketMs = 2 * 3_600_000;
    const bucket = Math.floor((Date.now() - bucketMs) / bucketMs) * bucketMs;

    beforeAll(async () => {
      await admin`
        INSERT INTO market_latest ${admin([
          {
            venue_id: venueA,
            venue_symbol: liqSymbolA,
            base: liqAsset,
            asset_class: "crypto",
            quote: "USDT",
            observed_at: new Date(),
            rate: 0.0001,
            basis_hours: 8,
            apr: 10.95,
            interval_hours: 8,
            next_funding_at: new Date(settledAt + HOUR),
            kind: "predicted",
            mark_price: 100,
            index_price: 100,
            open_interest_usd: 1_000_000,
            volume_24h_usd: 2_000_000,
          },
        ])} ON CONFLICT (venue_id, venue_symbol) DO NOTHING`;
      await admin`
        INSERT INTO liquidations ${admin([
          // Two closes in the same bucket on one venue: they must fold into one cell.
          {
            venue_id: venueA,
            venue_symbol: liqSymbolA,
            liquidated_at: new Date(bucket + 60_000),
            side: "long",
            size_contracts: 10,
            fill_price: 100,
            notional_usd: 1_000,
          },
          {
            venue_id: venueA,
            venue_symbol: liqSymbolA,
            liquidated_at: new Date(bucket + 120_000),
            side: "short",
            size_contracts: 4,
            fill_price: 100,
            notional_usd: 400,
          },
          // A second venue, and a symbol market_latest has never seen: it must still appear, under
          // its raw symbol, because a forced close is a fact whether or not we can name the asset.
          {
            venue_id: venueB,
            venue_symbol: liqSymbolB,
            liquidated_at: new Date(bucket + 60_000),
            side: "short",
            size_contracts: 2,
            fill_price: 100,
            notional_usd: 200,
          },
        ])} ON CONFLICT DO NOTHING`;
    });

    const mine = async () =>
      await data.liquidationMap({ windowHours: 24, bucketHours: 2, assets: 40 });

    test("folds a bucket per venue and keeps the two sides apart", async () => {
      const map = await mine();
      const cell = map.cells.find(
        (c) => c.venue_id === venueA && c.asset === liqAsset && c.notional_usd === 1_400,
      );
      expect(cell).toBeDefined();
      expect(cell?.events).toBe(2);
      // The side of the POSITION closed, which is the reading the colour encodes.
      expect(cell?.long_usd).toBe(1_000);
      expect(cell?.short_usd).toBe(400);
      expect(cell?.bucket_start.getTime()).toBe(bucket);
    });

    test("names the asset from market_latest, and falls back to the raw symbol", async () => {
      const map = await mine();
      // venueA's row is named by its market; venueB's symbol was never collected, so it keeps it.
      expect(map.cells.some((c) => c.venue_id === venueA && c.asset === liqAsset)).toBe(true);
      expect(map.cells.some((c) => c.venue_id === venueB && c.asset === liqSymbolB)).toBe(true);
    });

    test("totals cover every asset, so the page's total is not the sum of what it shows", async () => {
      const map = await mine();
      const totalA = map.totals.find((t) => t.venue_id === venueA);
      expect(totalA).toBeDefined();
      expect(totalA?.notional_usd).toBeGreaterThanOrEqual(1_400);
      expect(totalA?.events).toBeGreaterThanOrEqual(2);
      const column = map.columnTotals.find(
        (c) => c.venue_id === venueA && c.bucket_start.getTime() === bucket,
      );
      expect(column?.notional_usd).toBeGreaterThanOrEqual(1_400);
    });

    test("the asset limit bounds the rows without bounding the totals", async () => {
      const one = await data.liquidationMap({ windowHours: 24, bucketHours: 2, assets: 1 });
      expect(one.assets.length).toBe(1);
      // The cells are limited to those assets, and the totals are not.
      expect(new Set(one.cells.map((c) => `${c.asset}|${c.asset_class}`)).size).toBeLessThanOrEqual(
        1,
      );
      expect(one.totals.length).toBeGreaterThan(0);
    });
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
        sameQuote: false,
        sort: "spread",
        limit: 1,
      }),
    ).resolves.toBeDefined();
  });
});
