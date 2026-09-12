import type postgres from "postgres";

/** Markets whose latest snapshot is older than this are treated as not live. */
export const FRESH_INTERVAL = "5 minutes";

/**
 * How the screener is ordered. Only these three exist because only these three are backed by a
 * column `screener_pairs` actually returns.
 *
 * The original plan also wanted "stability" and "OI". Stability is a py-analytics deliverable that
 * does not exist yet, and the function returns open interest only per *leg* — summing the two would
 * rank assets by whichever pair happened to win the spread rather than by the asset's depth, which
 * is a number we would be inventing. Both are left out rather than shipped as headers that sort by
 * nothing or by an artefact.
 */
export const SCREENER_SORTS = ["spread", "settled_7d", "venues"] as const;
export type ScreenerSort = (typeof SCREENER_SORTS)[number];

export interface ScreenerFilters {
  minOpenInterestUsd: number;
  minVolume24hUsd: number;
  venueIds: string[] | null;
  venueTypes: string[] | null;
  /** Drops legs beyond this absolute APR; null keeps distressed markets in. */
  maxAbsApr: number | null;
  sort: ScreenerSort;
  limit: number;
}

export interface ScreenerPair {
  asset: string;
  venue_count: number;
  spread_apr: number;
  spread_apr_7d: number | null;
  long_venue_id: string;
  long_symbol: string;
  long_apr: number;
  long_apr_7d: number | null;
  long_interval_hours: number | null;
  long_open_interest_usd: number | null;
  long_volume_24h_usd: number | null;
  short_venue_id: string;
  short_symbol: string;
  short_apr: number;
  short_apr_7d: number | null;
  short_interval_hours: number | null;
  short_open_interest_usd: number | null;
  short_volume_24h_usd: number | null;
  oldest_observed_at: Date;
}

export interface Overview {
  markets: number;
  venues: number;
  assets: number;
  open_interest_usd: number;
  updated_at: Date | null;
}

export interface HeatmapOptions {
  /** Assets per page. The grid is rendered as HTML strings under a 10ms CPU budget, so it pages. */
  limit: number;
  offset: number;
  /** An asset on a single venue has no cross-venue story, so the grid needs at least this many. */
  minVenues: number;
}

/** One asset-on-one-venue cell. Absent combinations simply have no row; they are never zero. */
export interface HeatmapCell {
  base: string;
  venue_id: string;
  venue_symbol: string;
  apr: number;
  apr_7d: number | null;
  apr_30d: number | null;
  apr_60d: number | null;
  open_interest_usd: number | null;
  /** Summed open interest for the whole asset, carried so row order survives the pivot. */
  asset_oi_usd: number | null;
}

export interface MarketRow {
  venue_id: string;
  venue_symbol: string;
  base: string;
  quote: string | null;
  apr: number;
  apr_24h: number | null;
  apr_7d: number | null;
  interval_hours: number | null;
  next_funding_at: Date | null;
  mark_price: number | null;
  open_interest_usd: number | null;
  volume_24h_usd: number | null;
  observed_at: Date;
  /** Headline max leverage, null where the venue doesn't publish one. Holds only at small size. */
  max_leverage: number | null;
}

export interface ExchangeSummary {
  id: string;
  name: string;
  type: string;
  markets: number;
  open_interest_usd: number;
  volume_24h_usd: number;
  updated_at: Date;
}

/** Identifies one venue's market, as stored. */
export interface MarketKey {
  venue_id: string;
  venue_symbol: string;
}

/** One step of a venue's risk-limit ladder, as stored. Bounds are half-open [lower, upper). */
export interface LeverageTierRow extends MarketKey {
  tier: number;
  lower_notional_usd: number;
  upper_notional_usd: number | null;
  imr: number;
  mmr: number | null;
  max_leverage: number;
}

export interface SettlementRow extends MarketKey {
  settled_at: Date;
  rate: number;
  basis_hours: number;
}

export interface DataSource {
  overview(): Promise<Overview>;
  screener(filters: ScreenerFilters): Promise<ScreenerPair[]>;
  asset(base: string): Promise<MarketRow[]>;
  exchanges(): Promise<ExchangeSummary[]>;
  exchange(venueId: string): Promise<MarketRow[]>;
  /** Every venue's funding for the top assets by open interest, one row per populated cell. */
  heatmap(options: HeatmapOptions): Promise<HeatmapCell[]>;
  /** Risk-limit ladders for the given markets, ascending by tier; empty where a venue publishes none. */
  leverageTiers(markets: readonly MarketKey[]): Promise<LeverageTierRow[]>;
  /** Settled funding for the given markets within a window, oldest first, ties broken by market. */
  settlements(
    markets: readonly MarketKey[],
    fromMs: number,
    toMs: number,
  ): Promise<SettlementRow[]>;
}

const EMPTY_OVERVIEW: Overview = {
  markets: 0,
  venues: 0,
  assets: 0,
  open_interest_usd: 0,
  updated_at: null,
};

/**
 * Read queries against the collector's read models (packages/db/migrations/002_screener.sql).
 * `connect` is called lazily so routes that don't touch the database never open a connection.
 */
export function createDataSource(connect: () => postgres.Sql): DataSource {
  return {
    async overview() {
      const [row] = await connect()<Overview[]>`
        SELECT count(*)::int AS markets,
               count(DISTINCT venue_id)::int AS venues,
               count(DISTINCT base)::int AS assets,
               coalesce(sum(open_interest_usd), 0)::float8 AS open_interest_usd,
               max(observed_at) AS updated_at
        FROM market_latest
        WHERE observed_at > now() - ${FRESH_INTERVAL}::interval`;
      return row ?? EMPTY_OVERVIEW;
    },

    async screener(f) {
      const sql = connect();
      // The sort key indexes a fixed set of fragments; it is never interpolated. Every fragment
      // ends with `asset` because LIMIT over a partial order drops and repeats rows between
      // requests, and carries NULLS LAST because spread_apr_7d is a difference of two per-leg
      // stats and goes null the moment either leg has none.
      const order = {
        spread: sql`spread_apr DESC NULLS LAST, asset`,
        settled_7d: sql`spread_apr_7d DESC NULLS LAST, asset`,
        venues: sql`venue_count DESC NULLS LAST, spread_apr DESC NULLS LAST, asset`,
      }[f.sort];

      const rows = await sql<ScreenerPair[]>`
        SELECT * FROM screener_pairs(
          ${f.minOpenInterestUsd}::float8,
          ${f.minVolume24hUsd}::float8,
          string_to_array(${f.venueIds?.join(",") ?? null}::text, ','),
          string_to_array(${f.venueTypes?.join(",") ?? null}::text, ','),
          ${FRESH_INTERVAL}::interval,
          ${f.maxAbsApr}::float8)
        ORDER BY ${order}
        LIMIT ${f.limit}`;
      return [...rows];
    },

    async asset(base) {
      const rows = await connect()<MarketRow[]>`
        SELECT m.venue_id, m.venue_symbol, m.base, m.quote, m.apr, s.apr_24h, s.apr_7d, m.interval_hours,
               m.next_funding_at, m.mark_price, m.open_interest_usd, m.volume_24h_usd, m.observed_at,
               k.max_leverage
        FROM market_latest m
        LEFT JOIN market_funding_stats s ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
        LEFT JOIN markets k ON k.venue_id = m.venue_id AND k.venue_symbol = m.venue_symbol
        WHERE m.base = ${base} AND m.observed_at > now() - ${FRESH_INTERVAL}::interval
        ORDER BY m.apr`;
      return [...rows];
    },

    async exchanges() {
      const rows = await connect()<ExchangeSummary[]>`
        SELECT v.id, v.name, v.type,
               count(*)::int AS markets,
               coalesce(sum(m.open_interest_usd), 0)::float8 AS open_interest_usd,
               coalesce(sum(m.volume_24h_usd), 0)::float8 AS volume_24h_usd,
               max(m.observed_at) AS updated_at
        FROM venues v
        JOIN market_latest m ON m.venue_id = v.id AND m.observed_at > now() - ${FRESH_INTERVAL}::interval
        GROUP BY v.id, v.name, v.type
        ORDER BY open_interest_usd DESC`;
      return [...rows];
    },

    async heatmap({ limit, offset, minVenues }) {
      // Rank assets by depth first, then fetch every cell for just that page of assets. The order
      // is total (depth, then base, then venue) because LIMIT/OFFSET over a partial order silently
      // drops and repeats rows between pages -- the same trap as the settled_at tie below.
      const rows = await connect()<HeatmapCell[]>`
        WITH ranked AS (
          SELECT base, sum(open_interest_usd) AS asset_oi_usd
          FROM market_latest
          WHERE observed_at > now() - ${FRESH_INTERVAL}::interval
          GROUP BY base
          HAVING count(DISTINCT venue_id) >= ${minVenues}
          ORDER BY sum(open_interest_usd) DESC NULLS LAST, base
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT m.base, m.venue_id, m.venue_symbol, m.apr,
               s.apr_7d, s.apr_30d, s.apr_60d,
               m.open_interest_usd, r.asset_oi_usd
        FROM ranked r
        JOIN market_latest m ON m.base = r.base
        LEFT JOIN market_funding_stats s
          ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
        WHERE m.observed_at > now() - ${FRESH_INTERVAL}::interval
        ORDER BY r.asset_oi_usd DESC NULLS LAST, m.base, m.venue_id`;
      return [...rows];
    },

    async leverageTiers(markets) {
      if (markets.length === 0) return [];
      const sql = connect();
      // Row-value tuples for the same reason as settlements() below: a text[] parameter is not
      // usable with fetch_types: false, and string_to_array splits symbols containing a comma.
      const keys = markets
        .map((market) => sql`(${market.venue_id}, ${market.venue_symbol})`)
        .reduce((all, one) => sql`${all}, ${one}`);
      const rows = await sql<LeverageTierRow[]>`
        SELECT venue_id, venue_symbol, tier, lower_notional_usd, upper_notional_usd, imr, mmr, max_leverage
        FROM market_leverage_tiers
        WHERE (venue_id, venue_symbol) IN (${keys})
        ORDER BY venue_id, venue_symbol, tier`;
      return [...rows];
    },

    async settlements(markets, fromMs, toMs) {
      if (markets.length === 0) return [];
      const sql = connect();
      // One bound (venue_id, venue_symbol) tuple per market. Array parameters are not an option
      // here: Hyperdrive needs fetch_types: false, and with type introspection off postgres.js
      // sends a text[] as the bare string "a,b", which Postgres rejects as a malformed array
      // literal. string_to_array would work but splits any symbol that contains a comma.
      const keys = markets
        .map((market) => sql`(${market.venue_id}, ${market.venue_symbol})`)
        .reduce((all, one) => sql`${all}, ${one}`);
      const rows = await sql<SettlementRow[]>`
        SELECT e.venue_id, e.venue_symbol, e.settled_at, e.rate, e.basis_hours
        FROM funding_events e
        WHERE (e.venue_id, e.venue_symbol) IN (${keys})
          AND e.settled_at >= ${new Date(fromMs)} AND e.settled_at <= ${new Date(toMs)}
        -- Markets settling on the same tick tie on settled_at alone, and the planner is then free to
        -- return them in any order. The market breaks the tie so the sequence is reproducible.
        ORDER BY e.settled_at, e.venue_id, e.venue_symbol`;
      return [...rows];
    },

    async exchange(venueId) {
      const rows = await connect()<MarketRow[]>`
        SELECT m.venue_id, m.venue_symbol, m.base, m.quote, m.apr, s.apr_24h, s.apr_7d, m.interval_hours,
               m.next_funding_at, m.mark_price, m.open_interest_usd, m.volume_24h_usd, m.observed_at,
               k.max_leverage
        FROM market_latest m
        LEFT JOIN market_funding_stats s ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
        LEFT JOIN markets k ON k.venue_id = m.venue_id AND k.venue_symbol = m.venue_symbol
        WHERE m.venue_id = ${venueId} AND m.observed_at > now() - ${FRESH_INTERVAL}::interval
        ORDER BY m.open_interest_usd DESC NULLS LAST
        LIMIT 2000`;
      return [...rows];
    },
  };
}
