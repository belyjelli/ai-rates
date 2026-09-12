import type { SnapshotBatch } from "@ai-rates/adapters";
import {
  aprPercent,
  backtestPair,
  type FundingEvent,
  type FundingSnapshot,
  type LeverageTier,
  perUnitPrice,
  ratePerHour,
} from "@ai-rates/core";
import type { SQL } from "bun";
import type { HistoryStore } from "./history";
import type { CollectorRun, CollectorStore } from "./scheduler";

/** Rows per INSERT; keeps bound parameters well under Postgres' 65,535 limit. */
const CHUNK_ROWS = 2_000;

export interface LatestFunding {
  venue_id: string;
  venue_symbol: string;
  base: string;
  quote: string | null;
  observed_at: Date;
  rate: number;
  basis_hours: number;
  apr: number;
  interval_hours: number | null;
  next_funding_at: Date | null;
  mark_price: number | null;
  open_interest_usd: number | null;
  volume_24h_usd: number | null;
}

export class PgStore implements CollectorStore, HistoryStore {
  constructor(
    private readonly sql: SQL,
    /**
     * Headline leverage for venues that publish none, hand-curated in the venue catalog (B4).
     * Only ever a fallback: a figure the venue reports itself always wins.
     */
    private readonly curatedMaxLeverage: ReadonlyMap<string, number> = new Map(),
  ) {}

  async upsertVenues(venues: readonly { id: string; name: string; type: string }[]): Promise<void> {
    const rows = venues.map(({ id, name, type }) => ({ id, name, type }));
    for (const chunk of chunks(rows)) {
      await this.sql`
        INSERT INTO venues ${this.sql(chunk)}
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type`;
    }
  }

  async recordBatch(venueId: string, batch: SnapshotBatch, observedAt: number): Promise<void> {
    const snapshots = batch.snapshots.filter((s) => s.venueId === venueId);
    const markets = [...new Map(snapshots.map((s) => [s.venueSymbol, s])).values()];
    const lastSeen = new Date(observedAt);

    await this.sql.begin(async (tx) => {
      const curated = this.curatedMaxLeverage.get(venueId) ?? null;
      for (const chunk of chunks(markets.map((s) => marketRow(s, lastSeen, curated)))) {
        await tx`
          INSERT INTO markets ${tx(chunk)}
          ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
            base = EXCLUDED.base,
            quote = EXCLUDED.quote,
            multiplier = EXCLUDED.multiplier,
            dex = EXCLUDED.dex,
            interval_hours = COALESCE(EXCLUDED.interval_hours, markets.interval_hours),
            -- Keep the last known figure if a response transiently omits it, as with interval_hours.
            max_leverage = COALESCE(EXCLUDED.max_leverage, markets.max_leverage),
            last_seen = EXCLUDED.last_seen`;
      }
      for (const chunk of chunks(snapshots.map(snapshotRow))) {
        await tx`INSERT INTO funding_snapshots ${tx(chunk)}`;
      }
      for (const chunk of chunks(markets.filter((s) => s.basisHours > 0).map(latestRow))) {
        await tx`
          INSERT INTO market_latest ${tx(chunk)}
          ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
            base = EXCLUDED.base,
            quote = EXCLUDED.quote,
            observed_at = EXCLUDED.observed_at,
            rate = EXCLUDED.rate,
            basis_hours = EXCLUDED.basis_hours,
            apr = EXCLUDED.apr,
            interval_hours = COALESCE(EXCLUDED.interval_hours, market_latest.interval_hours),
            next_funding_at = EXCLUDED.next_funding_at,
            kind = EXCLUDED.kind,
            mark_price = EXCLUDED.mark_price,
            index_price = EXCLUDED.index_price,
            open_interest_usd = EXCLUDED.open_interest_usd,
            volume_24h_usd = EXCLUDED.volume_24h_usd
          WHERE EXCLUDED.observed_at >= market_latest.observed_at`;
      }
      for (const chunk of chunks(
        uniqueEvents(batch.settled, venueId).map((e) => eventRow(e, "observed")),
      )) {
        await tx`INSERT INTO funding_events ${tx(chunk)} ON CONFLICT DO NOTHING`;
      }
    });
  }

  /** Stores settled payments from a venue's history API; these replace values observed while collecting. */
  async recordHistory(venueId: string, events: readonly FundingEvent[]): Promise<void> {
    for (const chunk of chunks(uniqueEvents(events, venueId).map((e) => eventRow(e, "history")))) {
      await this.sql`
        INSERT INTO funding_events ${this.sql(chunk)}
        ON CONFLICT (venue_id, venue_symbol, settled_at) DO UPDATE SET
          rate = EXCLUDED.rate,
          basis_hours = EXCLUDED.basis_hours,
          mark_price = COALESCE(EXCLUDED.mark_price, funding_events.mark_price),
          source = EXCLUDED.source
        WHERE funding_events.source = 'observed'`;
    }
  }

  async activeMarkets(
    venueId: string,
    seenSince: number,
  ): Promise<{ venueSymbol: string; intervalHours: number | null }[]> {
    const rows: { venue_symbol: string; interval_hours: number | null }[] = await this.sql`
      SELECT venue_symbol, interval_hours FROM markets
      WHERE venue_id = ${venueId} AND last_seen >= ${new Date(seenSince)}
      ORDER BY venue_symbol`;
    return rows.map((r) => ({ venueSymbol: r.venue_symbol, intervalHours: r.interval_hours }));
  }

  async latestSettledByMarket(venueId: string): Promise<Map<string, number>> {
    // The time bound keeps the scan on recent, uncompressed chunks.
    const rows: { venue_symbol: string; at: Date }[] = await this.sql`
      SELECT venue_symbol, max(settled_at) AS at FROM funding_events
      WHERE venue_id = ${venueId} AND settled_at > now() - interval '30 days'
      GROUP BY venue_symbol`;
    return new Map(rows.map((r) => [r.venue_symbol, r.at.getTime()]));
  }

  /** Oldest stored settlement per market, the anchor the backfill reaches back from. */
  async oldestSettledByMarket(venueId: string): Promise<Map<string, number>> {
    const rows: { venue_symbol: string; at: Date }[] = await this.sql`
      SELECT venue_symbol, min(settled_at) AS at FROM funding_events
      WHERE venue_id = ${venueId}
      GROUP BY venue_symbol`;
    return new Map(rows.map((r) => [r.venue_symbol, r.at.getTime()]));
  }

  /**
   * Recomputes 24h and 7d time-weighted settled APR per market and drops markets not seen for a day
   * from market_latest. Returns the number of markets with stats.
   */
  async refreshFundingStats(): Promise<number> {
    const [{ markets }] = await this.sql`
      WITH upserted AS (
        INSERT INTO market_funding_stats
          (venue_id, venue_symbol, apr_24h, apr_7d, settlements_24h, settlements_7d, updated_at)
        SELECT
          venue_id,
          venue_symbol,
          sum(rate) FILTER (WHERE settled_at > now() - interval '24 hours')
            / nullif(sum(basis_hours) FILTER (WHERE settled_at > now() - interval '24 hours'), 0) * 876000,
          sum(rate) / nullif(sum(basis_hours), 0) * 876000,
          (count(*) FILTER (WHERE settled_at > now() - interval '24 hours'))::integer,
          count(*)::integer,
          now()
        FROM funding_events
        WHERE settled_at > now() - interval '7 days'
        GROUP BY venue_id, venue_symbol
        ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
          apr_24h = EXCLUDED.apr_24h,
          apr_7d = EXCLUDED.apr_7d,
          settlements_24h = EXCLUDED.settlements_24h,
          settlements_7d = EXCLUDED.settlements_7d,
          updated_at = EXCLUDED.updated_at
        RETURNING 1
      )
      SELECT count(*)::integer AS markets FROM upserted`;
    await this.sql`DELETE FROM market_funding_stats WHERE updated_at < now() - interval '1 day'`;
    await this.sql`DELETE FROM market_latest WHERE observed_at < now() - interval '1 day'`;
    return markets;
  }

  /**
   * Replaces a venue's risk-limit ladders with the sweep just fetched.
   *
   * Upsert then prune, rather than delete then insert: the worker reads this table continuously,
   * and a delete-first transaction would leave a window with no ladder at all. Rows this venue
   * kept last time but did not report now are stale -- a market delisted, or a ladder that lost
   * its top tier -- so they go once the new rows are in.
   */
  async replaceLeverageTiers(
    venueId: string,
    tiers: readonly LeverageTier[],
    fetchedAt = new Date(),
    prune = true,
  ): Promise<number> {
    // An empty sweep is a failed sweep, not a venue that dropped every ladder. Pruning on it would
    // erase good data because one request timed out.
    if (tiers.length === 0) return 0;

    await this.sql.begin(async (tx) => {
      for (const chunk of chunks(tiers.map((tier) => tierRow(tier, fetchedAt)))) {
        await tx`
          INSERT INTO market_leverage_tiers ${tx(chunk)}
          ON CONFLICT (venue_id, venue_symbol, tier) DO UPDATE SET
            lower_notional_usd = EXCLUDED.lower_notional_usd,
            upper_notional_usd = EXCLUDED.upper_notional_usd,
            imr = EXCLUDED.imr,
            mmr = EXCLUDED.mmr,
            max_leverage = EXCLUDED.max_leverage,
            fetched_at = EXCLUDED.fetched_at`;
      }
      // Skipped when the sweep was partial: those rows may belong to markets this run never
      // reached, and deleting them would turn a transient error into lost data.
      if (prune) {
        await tx`
          DELETE FROM market_leverage_tiers
          WHERE venue_id = ${venueId} AND fetched_at < ${fetchedAt}`;
      }
    });
    return tiers.length;
  }

  /**
   * Folds settled funding into one row per market per UTC day, over the whole lookback every time.
   *
   * It deliberately does NOT resume from the newest stored day, which is what it did first. That
   * only ever rebuilds *forward*, and `backfillVenueHistory` reaches history *backwards* -- that is
   * its whole purpose, and it took coverage from 7.1 days to 89.9. Once `max(day)` has advanced,
   * every day the backfill later fills in would be skipped for good, so the 30d/60d windows and
   * the stability scores would quietly rest on a rollup that had stopped absorbing history.
   *
   * The full fold is affordable: the first one wrote 344,596 day-rows and finished inside a single
   * scheduling tick, so resuming saved little and cost correctness.
   *
   * Returns the number of day-rows written.
   */
  async refreshDailyFunding(maxLookbackDays = 70): Promise<number> {
    const [{ rows }] = await this.sql`
      WITH from_day AS (
        SELECT (now() - make_interval(days => ${maxLookbackDays}))::date AS d
      ), folded AS (
        INSERT INTO market_funding_daily
          (venue_id, venue_symbol, day, rate_sum, basis_hours_sum, settlements)
        SELECT e.venue_id,
               e.venue_symbol,
               (e.settled_at AT TIME ZONE 'UTC')::date,
               sum(e.rate),
               sum(e.basis_hours),
               count(*)::integer
        FROM funding_events e
        WHERE e.settled_at >= (SELECT d FROM from_day)
        GROUP BY 1, 2, 3
        ON CONFLICT (venue_id, venue_symbol, day) DO UPDATE SET
          rate_sum = EXCLUDED.rate_sum,
          basis_hours_sum = EXCLUDED.basis_hours_sum,
          settlements = EXCLUDED.settlements
        RETURNING 1
      )
      SELECT count(*)::integer AS rows FROM folded`;

    // 60 days is the longest window read, so keep a little beyond it and no more.
    await this.sql`
      DELETE FROM market_funding_daily WHERE day < (now() - interval '70 days')::date`;
    return rows;
  }

  /**
   * Recomputes the 30d and 60d time-weighted APRs from the daily rollup.
   *
   * Each window is a sum over at most 60 small rows per market, so this reads a few hundred
   * thousand rows rather than rescanning millions of settlements. Only the long-window columns are
   * touched on conflict: `apr_24h`, `apr_7d` and `updated_at` belong to refreshFundingStats, whose
   * staleness sweep must keep deciding when a market's stats expire.
   */
  async refreshLongWindows(): Promise<number> {
    const [{ markets }] = await this.sql`
      WITH windows AS (
        SELECT venue_id,
               venue_symbol,
               sum(rate_sum) FILTER (WHERE day >= (now() - interval '30 days')::date)
                 / nullif(
                     sum(basis_hours_sum) FILTER (WHERE day >= (now() - interval '30 days')::date),
                     0) * 876000 AS apr_30d,
               sum(rate_sum) / nullif(sum(basis_hours_sum), 0) * 876000 AS apr_60d
        FROM market_funding_daily
        WHERE day >= (now() - interval '60 days')::date
        GROUP BY venue_id, venue_symbol
      ), upserted AS (
        INSERT INTO market_funding_stats
          (venue_id, venue_symbol, apr_30d, apr_60d,
           settlements_24h, settlements_7d, updated_at, long_windows_at)
        SELECT venue_id, venue_symbol, apr_30d, apr_60d, 0, 0, now(), now() FROM windows
        ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
          apr_30d = EXCLUDED.apr_30d,
          apr_60d = EXCLUDED.apr_60d,
          long_windows_at = EXCLUDED.long_windows_at
        RETURNING 1
      )
      SELECT count(*)::integer AS markets FROM upserted`;
    return markets;
  }

  /**
   * Recomputes funding stability and momentum from the daily rollup.
   *
   * The definition and the reasoning behind every clause live in migration 009; the short version
   * is the fraction of *charging* days whose APR carries the sign of the 30-day mean, shrunk toward
   * 0.5 by sample size so a market that charged six times cannot outrank one with a month of
   * evidence.
   *
   * Only the three stability columns are touched on conflict: `apr_24h`, `apr_7d` and `updated_at`
   * belong to refreshFundingStats, whose staleness sweep has to keep owning when stats expire.
   */
  async refreshStability(): Promise<number> {
    const [{ markets }] = await this.sql`
      WITH daily AS (
        SELECT venue_id, venue_symbol, day, rate_sum,
               rate_sum / nullif(basis_hours_sum, 0) * 876000 AS apr
        FROM market_funding_daily
        WHERE day >= (now() - interval '30 days')::date
      ),
      -- A day that charged nothing carries no information about persistence, so it is excluded
      -- from the numerator and the denominator alike. Every remaining day has a strictly non-zero
      -- APR, so positive and negative days partition the window exactly.
      charging AS (SELECT * FROM daily WHERE rate_sum <> 0),
      scored AS (
        SELECT venue_id,
               venue_symbol,
               count(*) AS charge_days,
               -- Days in the market's DOMINANT direction, not days agreeing with the sign of the
               -- mean. The latter has a knife-edge: a perfectly balanced market has a mean of
               -- exactly 0, sign(0) matches neither direction, and it scores the floor -- while the
               -- same market with a mean of +epsilon would score 0.5.
               greatest(
                 count(*) FILTER (WHERE apr > 0),
                 count(*) FILTER (WHERE apr < 0)
               ) AS dominant,
               avg(apr) FILTER (WHERE day >= (now() - interval '7 days')::date) AS recent,
               avg(apr) FILTER (WHERE day < (now() - interval '7 days')::date) AS prior
        FROM charging
        GROUP BY venue_id, venue_symbol
      ),
      upserted AS (
        INSERT INTO market_funding_stats
          (venue_id, venue_symbol, stability_30d, stability_days, momentum_30d,
           settlements_24h, settlements_7d, updated_at)
        SELECT venue_id,
               venue_symbol,
               -- k = 10, shrinking toward 0.5; see migration 009 for why a hard day floor is worse.
               (dominant + 5)::double precision / (charge_days + 10),
               charge_days,
               recent - prior,
               0, 0, now()
        FROM scored
        ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
          stability_30d = EXCLUDED.stability_30d,
          stability_days = EXCLUDED.stability_days,
          momentum_30d = EXCLUDED.momentum_30d
        RETURNING 1
      )
      SELECT count(*)::integer AS markets FROM upserted`;
    return markets;
  }

  /**
   * Replays the last 7 days of settled funding for every candidate pair and stores the result, so
   * the homepage can rank "what actually paid" without doing it per request.
   *
   * The replay uses `backtestPair`, the same engine the pair page and the API use. That is the
   * point: it sums each leg at its OWN settlement times (Hyperliquid settles hourly against
   * Bybit's 8-hourly) and reports gaps as missed settlements rather than as zero funding. Writing
   * this in SQL would be a second implementation of the one calculation this project treats as
   * correctness-critical.
   *
   * The candidate set mirrors the site's own defaults -- $250k open interest, |APR| <= 1000,
   * 5-minute freshness, 5% mark agreement -- so the ranking covers the same pairs a reader sees on
   * the screener. Those are the existing defaults, NOT extra floors: the ranking is deliberately
   * ungated, and each row instead stores what makes it risky (see migration 011).
   *
   * The one floor: both legs must have charged on all 7 days, or a market with a handful of
   * settlements can top the table.
   */
  async refreshPairBacktests(sizeUsd = 10_000, retainDays = 30): Promise<number> {
    type Candidate = {
      asset: string;
      pair_stability: number | null;
      long_venue_id: string;
      long_symbol: string;
      long_apr: number;
      long_open_interest_usd: number | null;
      short_venue_id: string;
      short_symbol: string;
      short_apr: number;
      short_open_interest_usd: number | null;
    };
    const candidates: Candidate[] = await this.sql`
      SELECT asset, pair_stability,
             long_venue_id, long_symbol, long_apr, long_open_interest_usd,
             short_venue_id, short_symbol, short_apr, short_open_interest_usd
      FROM screener_pairs(${250_000}::float8, ${0}::float8, NULL, NULL,
                          ${"5 minutes"}::interval, ${1000}::float8, ${0.05}::float8)`;
    if (candidates.length === 0) return 0;

    // Charging days per market over the window. market_funding_daily already holds them, so the
    // 7-of-7 floor costs no extra scan of funding_events.
    const chargeRows: { venue_id: string; venue_symbol: string; days: number }[] = await this.sql`
      SELECT venue_id, venue_symbol, count(*)::integer AS days
      FROM market_funding_daily
      WHERE day > (now() - interval '7 days')::date AND rate_sum <> 0
      GROUP BY venue_id, venue_symbol`;
    const chargeDays = new Map(chargeRows.map((r) => [`${r.venue_id} ${r.venue_symbol}`, r.days]));

    // One read for every leg of every candidate, rather than a query per pair: measured at 74ms
    // for 1,304 legs against 281,930 settlements, all buffers shared hit.
    const legKeys = candidates
      .flatMap((c) => [
        this.sql`(${c.long_venue_id}, ${c.long_symbol})`,
        this.sql`(${c.short_venue_id}, ${c.short_symbol})`,
      ])
      .reduce((all, one) => this.sql`${all}, ${one}`);
    const events: {
      venue_id: string;
      venue_symbol: string;
      settled_at: Date;
      rate: number;
      basis_hours: number;
    }[] = await this.sql`
        SELECT venue_id, venue_symbol, settled_at, rate, basis_hours
        FROM funding_events
        WHERE (venue_id, venue_symbol) IN (${legKeys})
          AND settled_at > now() - interval '7 days'
        ORDER BY settled_at, venue_id, venue_symbol`;

    const byMarket = new Map<string, { settledAt: number; rate: number; basisHours: number }[]>();
    for (const e of events) {
      const key = `${e.venue_id} ${e.venue_symbol}`;
      const list = byMarket.get(key) ?? [];
      list.push({ settledAt: e.settled_at.getTime(), rate: e.rate, basisHours: e.basis_hours });
      byMarket.set(key, list);
    }

    const toMs = Date.now();
    const fromMs = toMs - 7 * 86_400_000;
    const runDay = new Date(toMs).toISOString().slice(0, 10);
    const rows = [];
    for (const c of candidates) {
      const longKey = `${c.long_venue_id} ${c.long_symbol}`;
      const shortKey = `${c.short_venue_id} ${c.short_symbol}`;
      const longDays = chargeDays.get(longKey) ?? 0;
      const shortDays = chargeDays.get(shortKey) ?? 0;
      if (longDays < 7 || shortDays < 7) continue;

      const result = backtestPair({
        long: {
          venueId: c.long_venue_id,
          venueSymbol: c.long_symbol,
          settlements: byMarket.get(longKey) ?? [],
        },
        short: {
          venueId: c.short_venue_id,
          venueSymbol: c.short_symbol,
          settlements: byMarket.get(shortKey) ?? [],
        },
        sizeUsd,
        fromMs,
        toMs,
      });

      rows.push({
        run_day: runDay,
        asset: c.asset,
        long_venue_id: c.long_venue_id,
        long_symbol: c.long_symbol,
        short_venue_id: c.short_venue_id,
        short_symbol: c.short_symbol,
        size_usd: sizeUsd,
        days: result.days,
        net_funding_usd: result.netFundingUsd,
        net_funding_apr_percent: result.netFundingAprPercent,
        win_rate_days: result.winRateDays,
        avg_daily_usd: result.avgDailyUsd,
        long_settlements: result.long.settlements,
        short_settlements: result.short.settlements,
        missed_settlements: result.long.missedSettlements + result.short.missedSettlements,
        // Risk travels with the row because the ranking does not filter on it.
        thinner_leg_oi_usd:
          c.long_open_interest_usd === null || c.short_open_interest_usd === null
            ? null
            : Math.min(c.long_open_interest_usd, c.short_open_interest_usd),
        worst_leg_abs_apr: Math.max(Math.abs(c.long_apr), Math.abs(c.short_apr)),
        pair_stability: c.pair_stability,
        long_charge_days: longDays,
        short_charge_days: shortDays,
      });
    }
    if (rows.length === 0) return 0;

    for (const chunk of chunks(rows)) {
      await this.sql`
        INSERT INTO market_pair_backtests ${this.sql(chunk)}
        ON CONFLICT (run_day, asset) DO UPDATE SET
          long_venue_id = EXCLUDED.long_venue_id,
          long_symbol = EXCLUDED.long_symbol,
          short_venue_id = EXCLUDED.short_venue_id,
          short_symbol = EXCLUDED.short_symbol,
          size_usd = EXCLUDED.size_usd,
          days = EXCLUDED.days,
          net_funding_usd = EXCLUDED.net_funding_usd,
          net_funding_apr_percent = EXCLUDED.net_funding_apr_percent,
          win_rate_days = EXCLUDED.win_rate_days,
          avg_daily_usd = EXCLUDED.avg_daily_usd,
          long_settlements = EXCLUDED.long_settlements,
          short_settlements = EXCLUDED.short_settlements,
          missed_settlements = EXCLUDED.missed_settlements,
          thinner_leg_oi_usd = EXCLUDED.thinner_leg_oi_usd,
          worst_leg_abs_apr = EXCLUDED.worst_leg_abs_apr,
          pair_stability = EXCLUDED.pair_stability,
          long_charge_days = EXCLUDED.long_charge_days,
          short_charge_days = EXCLUDED.short_charge_days`;
    }

    // A month of nightly rankings is plenty to serve and to look back over; the same shape as the
    // daily rollup's own retention rule.
    await this.sql`
      DELETE FROM market_pair_backtests
      WHERE run_day < (now() - make_interval(days => ${retainDays}))::date`;
    return rows.length;
  }

  async recordRun(run: CollectorRun): Promise<void> {
    await this.sql`
      INSERT INTO collector_runs (started_at, venue_id, duration_ms, markets, requests, error)
      VALUES (${new Date(run.startedAt)}, ${run.venueId}, ${run.durationMs}, ${run.markets}, ${run.requests}, ${run.error})`;
  }

  /** Most recent snapshot per market for one base asset, within the last 15 minutes. */
  async latestByBase(base: string): Promise<LatestFunding[]> {
    return this.sql`
      SELECT DISTINCT ON (s.venue_id, s.venue_symbol)
        s.venue_id, s.venue_symbol, m.base, m.quote, s.observed_at, s.rate, s.basis_hours,
        s.rate / s.basis_hours * 876000 AS apr,
        s.interval_hours, s.next_funding_at, s.mark_price, s.open_interest_usd, s.volume_24h_usd
      FROM funding_snapshots s
      JOIN markets m ON m.venue_id = s.venue_id AND m.venue_symbol = s.venue_symbol
      WHERE m.base = ${base} AND s.observed_at > now() - interval '15 minutes'
      ORDER BY s.venue_id, s.venue_symbol, s.observed_at DESC`;
  }
}

function marketRow(s: FundingSnapshot, lastSeen: Date, curatedMaxLeverage: number | null = null) {
  return {
    venue_id: s.venueId,
    venue_symbol: s.venueSymbol,
    base: s.base,
    quote: s.quote,
    multiplier: s.multiplier,
    dex: s.dex,
    interval_hours: s.intervalHours,
    max_leverage: s.maxLeverage ?? curatedMaxLeverage,
    last_seen: lastSeen,
  };
}

function tierRow(tier: LeverageTier, fetchedAt: Date) {
  return {
    venue_id: tier.venueId,
    venue_symbol: tier.venueSymbol,
    tier: tier.tier,
    lower_notional_usd: tier.lowerNotionalUsd,
    upper_notional_usd: tier.upperNotionalUsd,
    imr: tier.imr,
    mmr: tier.mmr,
    max_leverage: tier.maxLeverage,
    fetched_at: fetchedAt,
  };
}

function snapshotRow(s: FundingSnapshot) {
  return {
    observed_at: new Date(s.observedAt),
    venue_id: s.venueId,
    venue_symbol: s.venueSymbol,
    rate: s.rate,
    basis_hours: s.basisHours,
    interval_hours: s.intervalHours,
    next_funding_at: s.nextFundingAt === null ? null : new Date(s.nextFundingAt),
    kind: s.kind,
    // Per unit of `base`, not per contract: adapters have already derived open_interest_usd from the
    // venue's own contract price, so only the stored prices are rescaled.
    mark_price: perUnitPrice(s.markPrice, s.multiplier),
    index_price: perUnitPrice(s.indexPrice, s.multiplier),
    open_interest_usd: s.openInterestUsd,
    volume_24h_usd: s.volume24hUsd,
  };
}

function latestRow(s: FundingSnapshot) {
  return {
    ...snapshotRow(s),
    base: s.base,
    quote: s.quote,
    apr: aprPercent(ratePerHour(s.rate, s.basisHours)),
  };
}

function eventRow(e: FundingEvent, source: "history" | "observed") {
  return {
    settled_at: new Date(e.settledAt),
    venue_id: e.venueId,
    venue_symbol: e.venueSymbol,
    rate: e.rate,
    basis_hours: e.basisHours,
    mark_price: perUnitPrice(e.markPrice, e.multiplier),
    source,
  };
}

/** One event per (market, settlement time); a single INSERT can't touch the same conflict key twice. */
function uniqueEvents(events: readonly FundingEvent[], venueId: string): FundingEvent[] {
  const byKey = new Map<string, FundingEvent>();
  for (const e of events) {
    if (e.venueId === venueId) byKey.set(`${e.venueSymbol} ${e.settledAt}`, e);
  }
  return [...byKey.values()];
}

function* chunks<T>(rows: readonly T[], size = CHUNK_ROWS): Generator<T[]> {
  for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
}
