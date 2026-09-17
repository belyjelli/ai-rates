import { type AssetClass, DIVERGENCE_TRIGGER, type IdentityVerdict } from "@ai-rates/core";
import type postgres from "postgres";
import { RETAIL_TAKER_BPS } from "./retail-fees";

/** Markets whose latest snapshot is older than this are treated as not live. */
export const FRESH_INTERVAL = "5 minutes";
/** The same threshold in milliseconds, for code that compares timestamps rather than writing SQL. */
export const STALE_MS = 5 * 60_000;

/**
 * What a venue is actually doing, as one word.
 *
 * Not ok/error: the interesting state is the third one. Six Hyperliquid sub-dexes run clean, report
 * no error, and return zero markets — working and useless at once, which a pass/fail reading calls
 * healthy. `/probe` cannot express this at all, since a venue can answer its endpoint and still
 * serve nothing.
 *
 * Order matters. A venue that errored is `failing` even if it is also stale, because the error is
 * the cause and staleness is the symptom.
 */
export type VenueState = "failing" | "stale" | "silent" | "empty" | "live" | "planned";

export function venueState(status: VenueStatus, now: number): VenueState {
  // `planned` before everything else. Without it, a venue the collector has never run reads as
  // `silent` -- an alarm for something that was never wired up. Phase 5 closed most of that gap:
  // 56 venues are collected and retired ones are filtered by the page, so this catches the backlog.
  if (status.last_run_ever === null) return "planned";
  // Ran at some point inside retention, but not in the last 24 hours: it stopped, and that is real.
  if (status.last_run_at === null) return "silent";
  if (status.last_error !== null) return "failing";
  // Decided before staleness, or it is unreachable: a venue listing nothing has no freshest market,
  // so the stale check below claimed it. The six empty Hyperliquid sub-dexes read `stale` on /status
  // for exactly that reason, which says "stopped updating" about a venue that is running fine.
  if (status.last_run_markets === 0 && status.live_markets === 0) return "empty";
  const freshest = status.freshest?.getTime() ?? null;
  if (freshest === null || now - freshest > STALE_MS) return "stale";
  return status.live_markets === 0 ? "empty" : "live";
}

/**
 * One venue's collecting health. Answers "are we getting data", which is a different question from
 * the geo-probe's "can Cloudflare reach this venue".
 */
export interface VenueStatus {
  venue_id: string;
  name: string;
  type: string;
  /** Null when the venue has not run at all in the window: configured but silent. */
  last_run_at: Date | null;
  /**
   * The newest run ever recorded, bounded by the 30-day retention policy. Null means the collector
   * has never run this venue, which is how a catalogued-but-unbuilt venue is told apart from one
   * that was running and stopped.
   */
  last_run_ever: Date | null;
  last_success_at: Date | null;
  duration_ms: number | null;
  requests: number | null;
  /** Markets the last run reported, which is not the same as markets currently live. */
  last_run_markets: number | null;
  last_error: string | null;
  runs_24h: number;
  /** A single blip and a venue that is down look identical without this. */
  failures_24h: number;
  live_markets: number;
  freshest: Date | null;
}

/**
 * How the screener is ordered. Every key here is backed by a column `screener_pairs` actually
 * returns; anything else falls back rather than travelling further.
 *
 * The original plan wanted "stability" and "OI" alongside these. **Stability now exists** —
 * migration 009 scores each market and 010 projects the pair figure as `pair_stability` — so it is
 * a real key. **OI is still omitted on purpose:** the function returns open interest only per
 * *leg*, and summing the winning pair's two legs ranks assets by pair-selection artefact rather
 * than by depth (龙虾 shows $20.8M across two venues, above FLOCK's $6.8M across six). That
 * remains a number we would be inventing.
 */
export const SCREENER_SORTS = ["spread", "settled_7d", "venues", "stability"] as const;
export type ScreenerSort = (typeof SCREENER_SORTS)[number];

export interface ScreenerFilters {
  minOpenInterestUsd: number;
  minVolume24hUsd: number;
  venueIds: string[] | null;
  venueTypes: string[] | null;
  /** Drops legs beyond this absolute APR; null keeps distressed markets in. */
  maxAbsApr: number | null;
  /**
   * Pairs only legs that settle in the same quote currency, chosen before the widest pair is picked
   * (migration 019), so an asset keeps its best same-quote pair rather than vanishing.
   */
  sameQuote: boolean;
  sort: ScreenerSort;
  limit: number;
}

export interface ScreenerPair {
  asset: string;
  /** Half of the asset's identity: BB is BlackBerry under `equity` and BounceBit under `crypto`. */
  asset_class: AssetClass;
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
  long_stability: number | null;
  long_stability_days: number | null;
  short_venue_id: string;
  short_symbol: string;
  short_apr: number;
  short_apr_7d: number | null;
  short_interval_hours: number | null;
  short_open_interest_usd: number | null;
  short_volume_24h_usd: number | null;
  short_stability: number | null;
  short_stability_days: number | null;
  /**
   * The weaker leg's stability, or null when either leg is unscored. Runs 0.5–0.878, never 0–1:
   * dominant-sign cannot fall below half, and shrinkage caps a 31-day window at (31+5)/(31+10).
   */
  pair_stability: number | null;
  oldest_observed_at: Date;
  /** Settlement currency of each leg; null where the venue does not declare one. */
  long_quote: string | null;
  short_quote: string | null;
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
  asset_class: AssetClass;
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

/**
 * How far a market's mark may sit from its asset's ANCHOR — the deepest market in the pool by open
 * interest — before it is treated as a different instrument and dropped from any comparison.
 *
 * This is an identity test, not a tradability one: it asks whether two venues are quoting the same
 * asset at all. Joining by symbol alone produced gaps of 13,660,780 bps on KR200, which quotes
 * 1096.67 on one venue against 0.7973 on another — a 1375× instrument mismatch, not a trade.
 *
 * It is the core's `DIVERGENCE_TRIGGER` rather than a local number so that the gate and migration
 * 015's report cannot drift apart: every market this drops is a market /status explains. Migration
 * 016 carries the measurements behind replacing the old 5% median — which was dropping
 * Hyperliquid's own $11.15M PURR market in favour of three thin venues quoting something else.
 */
export const MARK_DEVIATION = DIVERGENCE_TRIGGER;

/**
 * One market that disagrees on price with the deepest market in its asset pool, and what the
 * evidence says about why.
 *
 * The verdict is the collector's, refreshed hourly; the page only renders it. The definition and
 * the measurements behind every threshold are pre-registered in migration 015. In short:
 * correlation of minute returns decides, and the price ratio only refines, because landing near a
 * clean power of ten is a coincidence — gate's PURR sits at 104.6× on a correlation of 0.005.
 */
export interface IdentityCheckRow {
  base: string;
  asset_class: AssetClass;
  venue_id: string;
  venue_symbol: string;
  anchor_venue_id: string;
  anchor_venue_symbol: string;
  verdict: IdentityVerdict;
  price_ratio: number;
  /** `n` where the ratio is about 10^n; null unless the verdict is `scale`. */
  scale_exponent: number | null;
  /** Null when either side never moved, which is not the same as a correlation of zero. */
  return_corr: number | null;
  ratio_sd: number | null;
  shared_minutes: number;
  member_moves: number;
  anchor_moves: number;
  member_oi_usd: number | null;
  anchor_oi_usd: number | null;
  checked_at: Date;
}

export interface ArbitrageOptions {
  /** Rows below this quoted gap are dropped; 0 keeps the mostly-zero tail. */
  minGapBps: number;
  /** Rows whose thinner side rests less than this are dropped; 0 keeps every quote. */
  minDepthUsd: number;
  limit: number;
  offset: number;
}

/**
 * One asset's widest quotable price gap: buy where the ask is lowest, sell where the bid is
 * highest, on two different venues.
 *
 * This is a *quotable* gap at the size shown, not a fillable trade. It says nothing about the book
 * below level 1, so every row carries the money resting on each side — `ONE` once quoted 269.6 bps
 * against an ask of two units, and a gap without its depth beside it is a number that invites a
 * loss.
 */
export interface ArbitrageRow {
  asset: string;
  asset_class: AssetClass;
  venue_count: number;
  gap_bps: number;
  buy_venue_id: string;
  buy_symbol: string;
  /** The lowest ask: what buying costs. */
  buy_price: number;
  buy_depth_usd: number | null;
  sell_venue_id: string;
  sell_symbol: string;
  /** The highest bid: what selling fetches. */
  sell_price: number;
  sell_depth_usd: number | null;
  /** The smaller of the two sides, or null when either is unknown. The size the gap is good for. */
  thinner_depth_usd: number | null;
  /** The older leg's funding-row age: when the mark, rate and open interest were last fetched. */
  oldest_observed_at: Date;
  /**
   * The older leg's QUOTE age: when the two prices above were last seen. Distinct from
   * `oldest_observed_at` since migration 022, and the one a reader of these prices wants — a
   * streamed leg is seconds old while its funding row is a minute old, and a leg whose funding poll
   * has died can still be quoting live.
   */
  oldest_quoted_at: Date;
}

/**
 * One venue's top of book for a single asset, including the venues the mark-agreement guard
 * rejects.
 *
 * The list page must drop a mismatched instrument — a 1375× disagreement produces a gap of
 * 13,660,780 bps and would top every ranking. The detail page should do the opposite and *show*
 * it: `mark_agrees` is false and `anchor_mark` is carried alongside, so the page can say how far
 * out the quote is rather than silently omitting a venue the reader can see listed elsewhere.
 */
export interface PriceQuote {
  venue_id: string;
  asset_class: AssetClass;
  venue_symbol: string;
  best_bid: number;
  best_ask: number;
  best_bid_size_usd: number | null;
  best_ask_size_usd: number | null;
  mark_price: number | null;
  /** The asset's anchor mark — its deepest market by open interest — which the gate measures against. */
  anchor_mark: number | null;
  mark_agrees: boolean;
  /** When the funding row behind this quote was last fetched. Null `mark_price` means it is stale. */
  observed_at: Date;
  /** When these two prices were last seen. The age the quote should be rendered with. */
  quotes_at: Date;
}

export interface MarketRow {
  venue_id: string;
  venue_symbol: string;
  base: string;
  asset_class: AssetClass;
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
  /**
   * How often this market held its funding direction over 30 days, 0.5 (a coin flip) to 0.878 (the
   * most a full month can score). Null where it has no charging days at all.
   */
  stability_30d: number | null;
  /** Charging days behind that score: 0.69 over 6 days is not 0.69 over 30. */
  stability_days: number | null;
  /**
   * Last 7 days' mean APR minus the days before them, in APR points. Positive means funding is
   * widening in the direction it already had. Null when either side of the split is empty.
   */
  momentum_30d: number | null;
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

/** One market's funding for one UTC hour, from the collector's `market_funding_hourly` rollup. */
export interface HourlyFundingRow extends MarketKey {
  /** Start of the hour, epoch milliseconds: a number rather than a Date, so nothing re-zones it. */
  hour_ms: number;
  rate_sum: number;
  basis_hours_sum: number;
  settlements: number;
}

/** One market's funding for one UTC day, from the collector's `market_funding_daily` rollup. */
export interface DailyFundingRow extends MarketKey {
  /** UTC date, YYYY-MM-DD. Cast to text in SQL, so no time zone can move a row across midnight. */
  day: string;
  rate_sum: number;
  basis_hours_sum: number;
  settlements: number;
}

/**
 * One night's replay of a candidate pair over the last 7 days, as the collector stored it.
 *
 * The ranking is deliberately ungated, so every row carries what makes it risky: a $0.28M thinner
 * leg or a 305% worst leg is exactly what a reader needs to see beside a big net figure.
 */
/**
 * The bar a verified pair must clear to head the homepage, drawn from the funnel in
 * plans/product-market-fit.md §1: deep enough to size into, neither leg distressed, a weaker leg that
 * holds its direction, no missed settlements, and paying more than a retail round trip costs.
 */
export const HEADLINE_BAR = {
  minThinnerLegOiUsd: 1_000_000,
  maxWorstLegAbsApr: 200,
  minPairStability: 0.7,
  /** A retail taker fee, charged on every fill. One figure, so the hero and /arbitrage cannot drift. */
  retailTakerBps: RETAIL_TAKER_BPS,
  /** Open and close, on both legs. */
  roundTripFills: 4,
} as const;

export interface VerifiedPair {
  run_day: Date;
  asset: string;
  asset_class: AssetClass;
  long_venue_id: string;
  long_symbol: string;
  short_venue_id: string;
  short_symbol: string;
  size_usd: number;
  days: number;
  net_funding_usd: number;
  net_funding_apr_percent: number;
  win_rate_days: number;
  avg_daily_usd: number;
  long_settlements: number;
  short_settlements: number;
  /** Gaps beyond a 50% cadence tolerance, never counted as zero funding. */
  missed_settlements: number;
  thinner_leg_oi_usd: number | null;
  worst_leg_abs_apr: number | null;
  pair_stability: number | null;
  long_charge_days: number;
  short_charge_days: number;
}

export interface DataSource {
  overview(): Promise<Overview>;
  screener(filters: ScreenerFilters): Promise<ScreenerPair[]>;
  /** The newest nightly ranking of pairs by what they actually settled. Empty until a run lands. */
  verifiedPairs(limit: number): Promise<VerifiedPair[]>;
  /**
   * The newest run's best pair that clears HEADLINE_BAR. Null when none does, which is a real answer
   * about the market rather than a fault.
   */
  bestVerifiedPair(): Promise<VerifiedPair | null>;
  /**
   * One asset's live markets. A null class resolves to crypto when the base has a crypto market and
   * otherwise to its deepest class, so /markets/asset/TSLA still finds the equity without a class in
   * the URL, while /markets/asset/BB stays BounceBit however deep BlackBerry gets.
   */
  asset(base: string, assetClass: AssetClass | null): Promise<MarketRow[]>;
  exchanges(): Promise<ExchangeSummary[]>;
  exchange(venueId: string): Promise<MarketRow[]>;
  /** Every venue's funding for the top assets by open interest, one row per populated cell. */
  heatmap(options: HeatmapOptions): Promise<HeatmapCell[]>;
  /** Widest quotable price gap per asset, behind the same mark-agreement guard the screener uses. */
  arbitrage(options: ArbitrageOptions): Promise<ArbitrageRow[]>;
  /** Every venue's top of book for one asset, mismatched instruments flagged rather than dropped. */
  priceQuotes(base: string, assetClass: AssetClass | null): Promise<PriceQuote[]>;
  /** Per-venue collecting health: are we getting data, and what went wrong if not. */
  venueStatus(): Promise<VenueStatus[]>;
  /** Markets whose price disagrees with their asset pool's deepest market, and the verdict on why. */
  identityChecks(): Promise<IdentityCheckRow[]>;
  /** Risk-limit ladders for the given markets, ascending by tier; empty where a venue publishes none. */
  leverageTiers(markets: readonly MarketKey[]): Promise<LeverageTierRow[]>;
  /**
   * Each market's daily funding from `fromDay` (a UTC date, YYYY-MM-DD) onward, oldest first, ties
   * broken by market. The collector refreshes the rollup hourly and keeps 70 days of it.
   */
  dailyFunding(markets: readonly MarketKey[], fromDay: string): Promise<DailyFundingRow[]>;
  /**
   * Each market's hourly funding from `fromMs` onward, oldest first, ties broken by market. The
   * collector keeps 8 days of it (migration 014), which bounds the windows the pair chart reads.
   */
  hourlyFunding(markets: readonly MarketKey[], fromMs: number): Promise<HourlyFundingRow[]>;
}

const EMPTY_OVERVIEW: Overview = {
  markets: 0,
  venues: 0,
  assets: 0,
  open_interest_usd: 0,
  updated_at: null,
};

/**
 * The one class an asset page reads, as a subquery: the class asked for, or with none asked for,
 * crypto when the base has a crypto market and its deepest class otherwise.
 *
 * Crypto first rather than deepest first so that a class-less URL means the same asset tomorrow as
 * today. The site links every non-crypto asset with its class in the path, so the class-less form
 * only has to be stable for crypto, and for bookmarks to a ticker that was only ever one thing.
 */
function chosenClass(sql: postgres.Sql, base: string, assetClass: AssetClass | null) {
  return sql`
    SELECT asset_class FROM market_latest
    WHERE base = ${base}
      AND observed_at > now() - ${FRESH_INTERVAL}::interval
      AND (${assetClass}::text IS NULL OR asset_class = ${assetClass}::text)
    GROUP BY asset_class
    ORDER BY (asset_class = 'crypto') DESC, sum(open_interest_usd) DESC NULLS LAST, asset_class
    LIMIT 1`;
}

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
      // ends with `asset, asset_class` because LIMIT over a partial order drops and repeats rows between
      // requests, and carries NULLS LAST because spread_apr_7d is a difference of two per-leg
      // stats and goes null the moment either leg has none.
      const order = {
        spread: sql`spread_apr DESC NULLS LAST, asset, asset_class`,
        settled_7d: sql`spread_apr_7d DESC NULLS LAST, asset, asset_class`,
        venues: sql`venue_count DESC NULLS LAST, spread_apr DESC NULLS LAST, asset, asset_class`,
        // pair_stability is already null when either leg is unscored -- the function uses a CASE
        // rather than least(), which skips nulls instead of propagating them. So NULLS LAST has a
        // real null to act on here, and a half-scored pair cannot sort by its scored leg alone.
        stability: sql`pair_stability DESC NULLS LAST, spread_apr DESC NULLS LAST, asset, asset_class`,
      }[f.sort];

      const rows = await sql<ScreenerPair[]>`
        SELECT * FROM screener_pairs(
          ${f.minOpenInterestUsd}::float8,
          ${f.minVolume24hUsd}::float8,
          string_to_array(${f.venueIds?.join(",") ?? null}::text, ','),
          string_to_array(${f.venueTypes?.join(",") ?? null}::text, ','),
          ${FRESH_INTERVAL}::interval,
          ${f.maxAbsApr}::float8,
          ${MARK_DEVIATION}::float8,
          ${f.sameQuote}::boolean)
        ORDER BY ${order}
        LIMIT ${f.limit}`;
      return [...rows];
    },

    async verifiedPairs(limit) {
      // Only the newest run: mixing nights would rank a pair's Tuesday against another's Friday.
      // A failed run therefore leaves last night's ranking standing rather than emptying the page.
      const rows = await connect()<VerifiedPair[]>`
        SELECT * FROM market_pair_backtests
        WHERE run_day = (SELECT max(run_day) FROM market_pair_backtests)
        -- Total order: LIMIT over a partial one drops and repeats rows between requests.
        ORDER BY net_funding_usd DESC, asset, asset_class
        LIMIT ${limit}`;
      return [...rows];
    },

    async bestVerifiedPair() {
      const bar = HEADLINE_BAR;
      // A NULL risk column fails its comparison, so a pair we cannot vouch for never heads the page.
      const [row] = await connect()<VerifiedPair[]>`
        SELECT * FROM market_pair_backtests
        WHERE run_day = (SELECT max(run_day) FROM market_pair_backtests)
          AND thinner_leg_oi_usd >= ${bar.minThinnerLegOiUsd}::float8
          AND worst_leg_abs_apr < ${bar.maxWorstLegAbsApr}::float8
          AND pair_stability >= ${bar.minPairStability}::float8
          AND missed_settlements = 0
          -- Pays more than the round trip costs at the retail taker fee.
          AND net_funding_usd > size_usd * ${(bar.roundTripFills * bar.retailTakerBps) / 10_000}::float8
        ORDER BY net_funding_usd DESC, asset, asset_class
        LIMIT 1`;
      return row ?? null;
    },

    async asset(base, assetClass) {
      const rows = await connect()<MarketRow[]>`
        WITH chosen AS (${chosenClass(connect(), base, assetClass)})
        SELECT m.venue_id, m.venue_symbol, m.base, m.asset_class, m.quote, m.apr, s.apr_24h, s.apr_7d, m.interval_hours,
               m.next_funding_at, m.mark_price, m.open_interest_usd, m.volume_24h_usd, m.observed_at,
               k.max_leverage,
               -- Free: market_funding_stats is already joined for the settled windows.
               s.stability_30d, s.stability_days, s.momentum_30d
        FROM market_latest m
        LEFT JOIN market_funding_stats s ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
        LEFT JOIN markets k ON k.venue_id = m.venue_id AND k.venue_symbol = m.venue_symbol
        WHERE m.base = ${base}
          AND m.asset_class = (SELECT asset_class FROM chosen)
          AND m.observed_at > now() - ${FRESH_INTERVAL}::interval
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
          SELECT asset_class, base, sum(open_interest_usd) AS asset_oi_usd
          FROM market_latest
          WHERE observed_at > now() - ${FRESH_INTERVAL}::interval
          GROUP BY asset_class, base
          HAVING count(DISTINCT venue_id) >= ${minVenues}
          ORDER BY sum(open_interest_usd) DESC NULLS LAST, base, asset_class
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT m.base, m.asset_class, m.venue_id, m.venue_symbol, m.apr,
               s.apr_7d, s.apr_30d, s.apr_60d,
               m.open_interest_usd, r.asset_oi_usd
        FROM ranked r
        JOIN market_latest m ON m.asset_class = r.asset_class AND m.base = r.base
        LEFT JOIN market_funding_stats s
          ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
        WHERE m.observed_at > now() - ${FRESH_INTERVAL}::interval
        ORDER BY r.asset_oi_usd DESC NULLS LAST, m.base, m.asset_class, m.venue_id`;
      return [...rows];
    },

    async arbitrage({ minGapBps, minDepthUsd, limit, offset }) {
      // The shape mirrors screener_pairs deliberately -- median mark, deviation guard, best-per-
      // venue, then pair across two different venues -- because a price view that skipped the
      // guard would reprint the mismatched-instrument gaps migration 005 already fixed for funding.
      // It is inlined rather than a SQL function only because it reads different columns.
      const rows = await connect()<ArbitrageRow[]>`
        WITH candidates AS (
          SELECT venue_id, venue_symbol, asset_class, base, observed_at, quotes_at,
                 best_bid, best_ask, best_bid_size_usd, best_ask_size_usd,
                 -- The row now carries two ages (migration 022) and each column is gated by the one
                 -- that describes it. A quote is admitted on quotes_at; the MARK it is guarded
                 -- against is a funding-path value, so a row whose poll has died contributes no
                 -- mark rather than an hours-old one. Null marks already agree by default -- the
                 -- guard's own escape, since a missing mark is not evidence of a mismatch -- so a
                 -- venue that is streaming while its poll is dead keeps quoting and stops gating,
                 -- which is exactly the pair of behaviours this split exists to separate.
                 CASE WHEN observed_at > now() - ${FRESH_INTERVAL}::interval THEN mark_price END AS mark_price
          FROM market_latest
          WHERE quotes_at > now() - ${FRESH_INTERVAL}::interval
            AND best_bid > 0 AND best_ask > 0
        ),
        -- The anchor is the asset's deepest market by open interest, read from every fresh market
        -- rather than from the filtered candidates, so a reader's filters cannot move the
        -- reference. No backticks in this string: it is a JS template literal and one would end it.
        -- The median
        -- this replaced named the biggest CLUSTER as correct, which is not the same thing: on live
        -- data it drops Hyperliquid's $11.15M PURR leg in favour of three thin venues (migration 016).
        anchors AS (
          SELECT DISTINCT ON (asset_class, base) asset_class, base, mark_price AS anchor_mark
          FROM market_latest
          WHERE observed_at > now() - ${FRESH_INTERVAL}::interval AND mark_price > 0
          ORDER BY asset_class, base, open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
        ),
        legs AS (
          SELECT c.* FROM candidates c
          LEFT JOIN anchors a ON a.asset_class = c.asset_class AND a.base = c.base
          -- A band, so the test is symmetric in the ratio: which market holds the most open interest
          -- is an accident, and it must not decide whether two prices are judged to agree.
          WHERE a.anchor_mark IS NULL
             OR c.mark_price IS NULL
             OR c.mark_price BETWEEN a.anchor_mark / (1 + ${MARK_DEVIATION}::float8)
                                 AND a.anchor_mark * (1 + ${MARK_DEVIATION}::float8)
        ),
        counts AS (
          SELECT asset_class, base, count(DISTINCT venue_id)::integer AS n
          FROM legs GROUP BY asset_class, base HAVING count(DISTINCT venue_id) >= 2
        ),
        cheapest AS (
          SELECT DISTINCT ON (asset_class, base, venue_id) * FROM legs
          ORDER BY asset_class, base, venue_id, best_ask ASC
        ),
        richest AS (
          SELECT DISTINCT ON (asset_class, base, venue_id) * FROM legs
          ORDER BY asset_class, base, venue_id, best_bid DESC
        ),
        paired AS (
          SELECT DISTINCT ON (a.asset_class, a.base)
            a.base AS asset,
            a.asset_class,
            c.n AS venue_count,
            (b.best_bid - a.best_ask) / a.best_ask * 10000 AS gap_bps,
            a.venue_id AS buy_venue_id, a.venue_symbol AS buy_symbol,
            a.best_ask AS buy_price, a.best_ask_size_usd AS buy_depth_usd,
            b.venue_id AS sell_venue_id, b.venue_symbol AS sell_symbol,
            b.best_bid AS sell_price, b.best_bid_size_usd AS sell_depth_usd,
            -- NOT least(): it SKIPS nulls, so a row with one unknown side would report the known
            -- side as the size the gap is good for. The same trap migration 010 documents for
            -- pair_stability, and the same CASE is the fix.
            CASE
              WHEN a.best_ask_size_usd IS NULL OR b.best_bid_size_usd IS NULL THEN NULL
              ELSE least(a.best_ask_size_usd, b.best_bid_size_usd)
            END AS thinner_depth_usd,
            least(a.observed_at, b.observed_at) AS oldest_observed_at,
            -- The age of the PRICES in this row, which is not the age of the row. Both are carried
            -- because after migration 022 they genuinely differ: a streamed leg quotes every few
            -- milliseconds while its funding row is refreshed once a minute, and a leg whose poll
            -- has died can still be quoting. The page reads this one, because these are the numbers
            -- it prints.
            least(a.quotes_at, b.quotes_at) AS oldest_quoted_at
          FROM cheapest a
          JOIN counts c ON c.asset_class = a.asset_class AND c.base = a.base
          JOIN richest b ON b.asset_class = a.asset_class AND b.base = a.base AND b.venue_id <> a.venue_id
          ORDER BY a.asset_class, a.base, (b.best_bid - a.best_ask) / a.best_ask DESC
        )
        SELECT * FROM paired
        WHERE gap_bps >= ${minGapBps}::float8
          -- An unknown depth fails a depth floor rather than passing it: null >= x is null, which
          -- is not true. A reader who asked for $25k of resting size must not be shown a quote
          -- whose size we could not determine.
          AND (${minDepthUsd}::float8 <= 0 OR thinner_depth_usd >= ${minDepthUsd}::float8)
        -- Total order: LIMIT/OFFSET over a partial one drops and repeats rows between pages.
        ORDER BY gap_bps DESC, asset, asset_class
        LIMIT ${limit} OFFSET ${offset}`;
      return [...rows];
    },

    async priceQuotes(base, assetClass) {
      // The same anchor the list query gates on, but here the deviation is reported instead of
      // applied: a venue that fails the gate still appears, flagged, because "why is this exchange
      // missing" is exactly the question a detail page exists to answer. The gate makes one call
      // and this page shows its working.
      const rows = await connect()<PriceQuote[]>`
        WITH chosen AS (${chosenClass(connect(), base, assetClass)}),
        candidates AS (
          SELECT venue_id, venue_symbol, asset_class, observed_at, quotes_at,
                 best_bid, best_ask, best_bid_size_usd, best_ask_size_usd,
                 -- Same split as arbitrage(): the quote is admitted on quotes_at, and a mark whose
                 -- funding poll has gone stale is withheld from the gate rather than used. Here the
                 -- withheld mark is also VISIBLE as a null in the output, which is the point of a
                 -- detail page -- "why is this exchange flagged" is answerable when the reason is
                 -- on the row.
                 CASE WHEN observed_at > now() - ${FRESH_INTERVAL}::interval THEN mark_price END AS mark_price
          FROM market_latest
          WHERE base = ${base}
            AND asset_class = (SELECT asset_class FROM chosen)
            AND quotes_at > now() - ${FRESH_INTERVAL}::interval
            AND best_bid > 0 AND best_ask > 0
        ),
        -- Read from every fresh market for this asset, not only from the ones publishing a book:
        -- the deepest market is the reference whether or not it happens to quote top of book.
        anchor AS (
          SELECT mark_price AS anchor_mark
          FROM market_latest
          WHERE base = ${base}
            AND asset_class = (SELECT asset_class FROM chosen)
            AND observed_at > now() - ${FRESH_INTERVAL}::interval
            AND mark_price > 0
          ORDER BY open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
          LIMIT 1
        )
        SELECT c.venue_id, c.venue_symbol, c.asset_class, c.best_bid, c.best_ask,
               c.best_bid_size_usd, c.best_ask_size_usd, c.mark_price, c.observed_at, c.quotes_at,
               a.anchor_mark,
               -- Unknown marks agree by default, matching the gate's own null escapes: a missing
               -- mark is not evidence of a mismatch, and excluding it would punish a venue for a
               -- field it simply does not publish.
               CASE
                 WHEN a.anchor_mark IS NULL OR c.mark_price IS NULL THEN true
                 ELSE c.mark_price BETWEEN a.anchor_mark / (1 + ${MARK_DEVIATION}::float8)
                                       AND a.anchor_mark * (1 + ${MARK_DEVIATION}::float8)
               END AS mark_agrees
        -- LEFT JOIN, never CROSS JOIN: an asset with no anchor row would otherwise return no
        -- quotes at all rather than returning them all unflagged.
        FROM candidates c LEFT JOIN anchor a ON true
        -- Cheapest to buy first, which is the order the page reads in.
        ORDER BY c.best_ask, c.venue_id`;
      return [...rows];
    },

    async identityChecks() {
      // A plain read of verdicts the collector already reached. The judging needs six hours of
      // minute bars and a correlation per market, which is not something a 10ms request budget can
      // do -- so it is precomputed hourly, exactly as the verified backtests are. Tens of rows.
      const rows = await connect()<IdentityCheckRow[]>`
        SELECT base, asset_class, venue_id, venue_symbol, anchor_venue_id, anchor_venue_symbol,
               verdict, price_ratio, scale_exponent, return_corr, ratio_sd,
               shared_minutes, member_moves, anchor_moves, member_oi_usd, anchor_oi_usd, checked_at
        FROM market_identity_checks
        ORDER BY base, asset_class, venue_id, venue_symbol`;
      return [...rows];
    },

    async venueStatus() {
      // Driven from `venues` rather than from the runs, so a venue that stopped running entirely
      // still appears -- silence is the failure most worth seeing, and an inner join would hide it.
      //
      // The 24h window is bounded by the retention policy anyway (30 days), and
      // collector_runs_venue (venue_id, started_at DESC) serves both the DISTINCT ON and the counts.
      const rows = await connect()<VenueStatus[]>`
        WITH recent AS (
          SELECT venue_id, started_at, duration_ms, markets, requests, error,
                 row_number() OVER (PARTITION BY venue_id ORDER BY started_at DESC) AS rn,
                 count(*) OVER (PARTITION BY venue_id) AS runs_24h,
                 count(*) FILTER (WHERE error IS NOT NULL)
                   OVER (PARTITION BY venue_id) AS failures_24h,
                 max(started_at) FILTER (WHERE error IS NULL)
                   OVER (PARTITION BY venue_id) AS last_success_at
          FROM collector_runs
          WHERE started_at > now() - interval '24 hours'
        ),
        -- Bounded at 30 days to match the retention policy, so "never" is a statement about the
        -- whole history we keep rather than an unbounded scan that means the same thing.
        ever AS (
          SELECT venue_id, max(started_at) AS last_run_ever
          FROM collector_runs
          WHERE started_at > now() - interval '30 days'
          GROUP BY venue_id
        ),
        live AS (
          SELECT venue_id, count(*)::int AS live_markets, max(observed_at) AS freshest
          FROM market_latest
          WHERE observed_at > now() - ${FRESH_INTERVAL}::interval
          GROUP BY venue_id
        )
        SELECT v.id AS venue_id, v.name, v.type,
               r.started_at AS last_run_at,
               e.last_run_ever,
               r.last_success_at,
               r.duration_ms,
               r.requests,
               r.markets AS last_run_markets,
               r.error AS last_error,
               coalesce(r.runs_24h, 0)::int AS runs_24h,
               coalesce(r.failures_24h, 0)::int AS failures_24h,
               coalesce(l.live_markets, 0)::int AS live_markets,
               l.freshest
        FROM venues v
        LEFT JOIN recent r ON r.venue_id = v.id AND r.rn = 1
        LEFT JOIN ever e ON e.venue_id = v.id
        LEFT JOIN live l ON l.venue_id = v.id
        ORDER BY v.name`;
      return [...rows];
    },

    async leverageTiers(markets) {
      if (markets.length === 0) return [];
      const sql = connect();
      // Row-value tuples for the same reason as dailyFunding() below: a text[] parameter is not
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

    async dailyFunding(markets, fromDay) {
      if (markets.length === 0) return [];
      const sql = connect();
      // One bound (venue_id, venue_symbol) tuple per market. Array parameters are not an option
      // here: Hyperdrive needs fetch_types: false, and with type introspection off postgres.js
      // sends a text[] as the bare string "a,b", which Postgres rejects as a malformed array
      // literal. string_to_array would work but splits any symbol that contains a comma.
      const keys = markets
        .map((market) => sql`(${market.venue_id}, ${market.venue_symbol})`)
        .reduce((all, one) => sql`${all}, ${one}`);
      // The primary key leads with the market, so this is an index range per market: at most 60
      // rows each, where the replay it replaces read every settlement in the window.
      const rows = await sql<DailyFundingRow[]>`
        SELECT d.venue_id, d.venue_symbol, d.day::text AS day, d.rate_sum, d.basis_hours_sum,
               d.settlements
        FROM market_funding_daily d
        WHERE (d.venue_id, d.venue_symbol) IN (${keys})
          AND d.day >= ${fromDay}::date
        -- Two markets share every day, so the market breaks the tie and the order is reproducible.
        ORDER BY d.day, d.venue_id, d.venue_symbol`;
      return [...rows];
    },

    async hourlyFunding(markets, fromMs) {
      if (markets.length === 0) return [];
      const sql = connect();
      // Row-value tuples, for the reason dailyFunding() gives.
      const keys = markets
        .map((market) => sql`(${market.venue_id}, ${market.venue_symbol})`)
        .reduce((all, one) => sql`${all}, ${one}`);
      // One asset's markets through the primary key: at most 8 days of hours each.
      const rows = await sql<HourlyFundingRow[]>`
        SELECT h.venue_id, h.venue_symbol, (extract(epoch FROM h.hour) * 1000)::float8 AS hour_ms,
               h.rate_sum, h.basis_hours_sum, h.settlements
        FROM market_funding_hourly h
        WHERE (h.venue_id, h.venue_symbol) IN (${keys})
          AND h.hour >= ${new Date(fromMs)}
        ORDER BY h.hour, h.venue_id, h.venue_symbol`;
      return [...rows];
    },

    async exchange(venueId) {
      const rows = await connect()<MarketRow[]>`
        SELECT m.venue_id, m.venue_symbol, m.base, m.asset_class, m.quote, m.apr, s.apr_24h, s.apr_7d, m.interval_hours,
               m.next_funding_at, m.mark_price, m.open_interest_usd, m.volume_24h_usd, m.observed_at,
               k.max_leverage,
               -- Selected but not rendered here: the exchange table is already ten columns wide and
               -- answers "what does this venue list", not "which venue holds its direction". They
               -- are selected anyway because MarketRow declares them, and a query that returned
               -- undefined for a field the type promises would typecheck while lying.
               s.stability_30d, s.stability_days, s.momentum_30d
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
