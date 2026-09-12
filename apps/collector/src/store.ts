import type { SnapshotBatch } from "@ai-rates/adapters";
import {
  aprPercent,
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
  constructor(private readonly sql: SQL) {}

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
      for (const chunk of chunks(markets.map((s) => marketRow(s, lastSeen)))) {
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
      await tx`
        DELETE FROM market_leverage_tiers
        WHERE venue_id = ${venueId} AND fetched_at < ${fetchedAt}`;
    });
    return tiers.length;
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

function marketRow(s: FundingSnapshot, lastSeen: Date) {
  return {
    venue_id: s.venueId,
    venue_symbol: s.venueSymbol,
    base: s.base,
    quote: s.quote,
    multiplier: s.multiplier,
    dex: s.dex,
    interval_hours: s.intervalHours,
    max_leverage: s.maxLeverage ?? null,
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
    if (e.venueId === venueId) byKey.set(`${e.venueSymbol} ${e.settledAt}`, e);
  }
  return [...byKey.values()];
}

function* chunks<T>(rows: readonly T[], size = CHUNK_ROWS): Generator<T[]> {
  for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
}
