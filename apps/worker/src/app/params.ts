import { ASSET_CLASSES, type AssetClass } from "@ai-rates/core";
import { DEFAULT_VENUE_IDS, LISTED_VENUES, VENUES } from "@ai-rates/venues";
import {
  RATE_UNITS,
  type RateUnit,
  SCREENER_CLASSES,
  SCREENER_INTERVALS,
  SCREENER_SORTS,
  type ScreenerClass,
  type ScreenerFilters,
  type ScreenerInterval,
  type ScreenerSort,
} from "./data";

export const VENUE_TYPES = ["cex", "dex", "hip3"] as const;
export const MAX_LIMIT = 500;

export const DEFAULT_FILTERS: ScreenerFilters = {
  // Hides thin markets whose funding swings wildly; ?min_oi=0 shows everything.
  minOpenInterestUsd: 250_000,
  minVolume24hUsd: 0,
  venueIds: null,
  venueTypes: null,
  // Distressed listings run to ±2700% APR and swamp the ranking; ?extremes=1 puts them back.
  maxAbsApr: 1000,
  // Mixed quotes stay in and are marked; ?quote=same pairs only within one settlement currency.
  sameQuote: false,
  assetClass: null,
  minSpreadApr: null,
  maxSpreadApr: null,
  intervalHours: null,
  query: null,
  unit: "apr",
  // The widest spread first, which is what the page is for. The homepage relies on this default.
  sort: "spread",
  limit: 100,
};

/**
 * The spread bands the screener offers, by the id its address carries. Each runs from its floor to
 * below its ceiling, so a pair falls in exactly one.
 */
export const SPREAD_BANDS = {
  "1-10": [1, 10],
  "10-50": [10, 50],
  "50-200": [50, 200],
  "200-": [200, null],
} as const satisfies Record<string, readonly [number, number | null]>;
export type SpreadBand = keyof typeof SPREAD_BANDS;

/** The band a filter's spread range is, or null when it is none of them (the default, or by hand). */
export function spreadBand(
  f: Pick<ScreenerFilters, "minSpreadApr" | "maxSpreadApr">,
): SpreadBand | null {
  for (const [id, [min, max]] of Object.entries(SPREAD_BANDS)) {
    if (f.minSpreadApr === min && f.maxSpreadApr === max) return id as SpreadBand;
  }
  return null;
}

/** Letters, digits and the few marks asset names use ("xyz:SPY", "1000PEPE", "BRK.B"); at most 24. */
const QUERY_PATTERN = /^[a-z0-9:._-]{1,24}$/i;

const KNOWN_VENUES = new Set(VENUES.map((v) => v.id));
/**
 * The listed exchanges left out of the default rankings: still collected and shown, but ranked only
 * when the reader names them (packages/venues `quarantined`).
 */
const QUARANTINED_VENUES = LISTED_VENUES.filter((v) => v.quarantined).map((v) => v.id);
const KNOWN_TYPES = new Set<string>(VENUE_TYPES);
const USD_SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

/** Parses "250000", "250k", "1.5m" or "2b" into dollars; null when missing or malformed. */
export function parseUsd(value: string | null): number | null {
  const match = value ? /^(\d+(?:\.\d+)?)([kmb])?$/i.exec(value.trim()) : null;
  if (!match) return null;
  return Number(match[1]) * (USD_SUFFIX[(match[2] ?? "").toLowerCase()] ?? 1);
}

/** Screener filters from query params. Unknown venues and types are dropped; values are clamped. */
export function parseScreenerFilters(params: URLSearchParams): ScreenerFilters {
  const limit = Number.parseInt(params.get("limit") ?? "", 10);
  const types = listParam(params, "types", KNOWN_TYPES);
  return {
    minOpenInterestUsd: parseUsd(params.get("min_oi")) ?? DEFAULT_FILTERS.minOpenInterestUsd,
    minVolume24hUsd: parseUsd(params.get("min_vol")) ?? DEFAULT_FILTERS.minVolume24hUsd,
    venueIds: everyListed(listParam(params, "venues", KNOWN_VENUES)),
    maxAbsApr: isTruthyParam(params.get("extremes")) ? null : DEFAULT_FILTERS.maxAbsApr,
    sameQuote: (params.get("quote") ?? "").trim().toLowerCase() === "same",
    // Selecting every type is the same as not filtering by type.
    venueTypes: types && types.length === VENUE_TYPES.length ? null : types,
    assetClass: oneOf(params.get("class"), SCREENER_CLASSES) as ScreenerClass | null,
    ...parseSpread(params.get("spread")),
    intervalHours: parseInterval(params.get("interval")),
    query: parseQuery(params.get("q")),
    unit: (oneOf(params.get("unit"), RATE_UNITS) as RateUnit | null) ?? DEFAULT_FILTERS.unit,
    sort: parseScreenerSort(params.get("sort")),
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), MAX_LIMIT) : DEFAULT_FILTERS.limit,
  };
}

/** The windows a convergence pair's statistics and charts span, in days. */
export const CONVERGENCE_WINDOWS = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "15d": 15,
  "30d": 30,
  "90d": 90,
} as const;
export type ConvergenceWindow = keyof typeof CONVERGENCE_WINDOWS;
export const DEFAULT_CONVERGENCE_SIZE = 10_000;

/** One price-convergence pair: long the cheaper exchange, short the dearer (/price-pair/:asset). */
export interface ConvergenceParams {
  longVenueId: string;
  shortVenueId: string;
  /** Notional per leg. */
  sizeUsd: number;
  window: ConvergenceWindow;
}

/** The pair from ?long=&short=, or null unless they name two different known exchanges. */
export function parseConvergenceParams(params: URLSearchParams): ConvergenceParams | null {
  const longVenueId = (params.get("long") ?? "").trim().toLowerCase();
  const shortVenueId = (params.get("short") ?? "").trim().toLowerCase();
  if (!KNOWN_VENUES.has(longVenueId) || !KNOWN_VENUES.has(shortVenueId)) return null;
  if (longVenueId === shortVenueId) return null;
  const size = parseUsd(params.get("size"));
  const window = (params.get("w") ?? "").trim().toLowerCase();
  return {
    longVenueId,
    shortVenueId,
    sizeUsd:
      size === null
        ? DEFAULT_CONVERGENCE_SIZE
        : Math.min(Math.max(Math.round(size), 100), 10_000_000),
    window: window in CONVERGENCE_WINDOWS ? (window as ConvergenceWindow) : "7d",
  };
}

/** The pair's address query: the legs always, size and window only when not the defaults. */
export function convergenceToQuery(p: ConvergenceParams): string {
  const query = new URLSearchParams({ long: p.longVenueId, short: p.shortVenueId });
  if (p.sizeUsd !== DEFAULT_CONVERGENCE_SIZE) query.set("size", String(p.sizeUsd));
  if (p.window !== "7d") query.set("w", p.window);
  return `?${query.toString()}`;
}

/**
 * Null for a list naming exactly the default exchanges, which the picker's form sends when it is left
 * as it opened: every listed exchange ticked but the quarantined ones. A list that names a
 * quarantined exchange stays explicit, so "every exchange, quarantined too" can be asked for.
 */
function everyListed(ids: string[] | null): string[] | null {
  if (!ids) return null;
  const defaultSet = DEFAULT_VENUE_IDS.every((id) => ids.includes(id));
  return defaultSet && !QUARANTINED_VENUES.some((id) => ids.includes(id)) ? null : ids;
}

/** The value when it is one of `allowed` (case-insensitive), else null. */
function oneOf(value: string | null, allowed: readonly string[]): string | null {
  const v = (value ?? "").trim().toLowerCase();
  return allowed.includes(v) ? v : null;
}

/** A band id ("10-50") into its range; anything else leaves the spread unfiltered. */
function parseSpread(value: string | null): Pick<ScreenerFilters, "minSpreadApr" | "maxSpreadApr"> {
  const band = SPREAD_BANDS[(value ?? "").trim() as SpreadBand];
  return band
    ? { minSpreadApr: band[0], maxSpreadApr: band[1] }
    : { minSpreadApr: null, maxSpreadApr: null };
}

/** "1h", "4h" or "8h" as a funding interval; anything else is none. */
function parseInterval(value: string | null): ScreenerInterval | null {
  return (SCREENER_INTERVALS.find((h) => `${h}h` === (value ?? "").trim().toLowerCase()) ??
    null) as ScreenerInterval | null;
}

/** An asset search, or null when empty or holding anything an asset name never does. */
function parseQuery(value: string | null): string | null {
  const q = (value ?? "").trim();
  return QUERY_PATTERN.test(q) ? q : null;
}

/** Exact match against the allowlist: the sort key chooses an ORDER BY fragment. */
function parseScreenerSort(value: string | null): ScreenerSort {
  const sort = (value ?? "").trim().toLowerCase();
  return (SCREENER_SORTS as readonly string[]).includes(sort)
    ? (sort as ScreenerSort)
    : DEFAULT_FILTERS.sort;
}

/** Canonical query string (non-default values only, stable order) for links and cache keys. */
export function filtersToQuery(filters: ScreenerFilters): string {
  const params = new URLSearchParams();
  if (filters.minOpenInterestUsd !== DEFAULT_FILTERS.minOpenInterestUsd) {
    params.set("min_oi", String(filters.minOpenInterestUsd));
  }
  if (filters.minVolume24hUsd !== DEFAULT_FILTERS.minVolume24hUsd) {
    params.set("min_vol", String(filters.minVolume24hUsd));
  }
  if (filters.maxAbsApr !== DEFAULT_FILTERS.maxAbsApr) params.set("extremes", "1");
  if (filters.venueTypes) params.set("types", filters.venueTypes.join(","));
  if (filters.venueIds) params.set("venues", filters.venueIds.join(","));
  if (filters.sameQuote) params.set("quote", "same");
  if (filters.assetClass) params.set("class", filters.assetClass);
  const band = spreadBand(filters);
  if (band) params.set("spread", band);
  if (filters.intervalHours) params.set("interval", `${filters.intervalHours}h`);
  if (filters.query) params.set("q", filters.query);
  if (filters.unit !== DEFAULT_FILTERS.unit) params.set("unit", filters.unit);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.limit !== DEFAULT_FILTERS.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const HEATMAP_TIMEFRAMES = ["now", "7d", "30d", "60d"] as const;
export type HeatmapTimeframe = (typeof HEATMAP_TIMEFRAMES)[number];
/** Fifty assets a page: a screenful to scan, and a light page for the live refresh to re-poll. */
export const DEFAULT_HEATMAP_LIMIT = 50;
/**
 * Equal to the default on purpose, so a page is always at most fifty rows. The cost is linear in
 * rows, and a limit a caller could raise would quietly undo the page size. Asking for fewer is
 * always allowed.
 */
export const MAX_HEATMAP_LIMIT = DEFAULT_HEATMAP_LIMIT;
/** A grid of one-venue assets would be a column of single cells. */
export const HEATMAP_MIN_VENUES = 2;

export interface HeatmapParams {
  tf: HeatmapTimeframe;
  limit: number;
  offset: number;
}

export function parseHeatmapParams(params: URLSearchParams): HeatmapParams {
  const tf = (params.get("tf") ?? "").trim().toLowerCase();
  const limit = Number.parseInt(params.get("limit") ?? "", 10);
  const offset = Number.parseInt(params.get("offset") ?? "", 10);
  return {
    // Exact match against the allowlist. The timeframe selects which column is read, so it is
    // never interpolated from what arrived in the query string.
    tf: (HEATMAP_TIMEFRAMES as readonly string[]).includes(tf) ? (tf as HeatmapTimeframe) : "now",
    limit: Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), MAX_HEATMAP_LIMIT)
      : DEFAULT_HEATMAP_LIMIT,
    offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  };
}

/**
 * Canonical query string, so timeframe and paging links round-trip and stay cache-keyed.
 *
 * The Gamma Exposure tab's links pass `gamma` and so keep the grid's timeframe and page: they swap
 * the tab in place and push their address, and live.ts polls the page at that address, so a link
 * that dropped `tf` would quietly turn the grid beside it back to "now" on the next poll. The grid's
 * own links leave the tab's choices out, since a choice in the address opens the page on that tab.
 */
export function heatmapToQuery(params: HeatmapParams, gamma?: GammaParams): string {
  const query = new URLSearchParams();
  if (params.tf !== "now") query.set("tf", params.tf);
  if (params.limit !== DEFAULT_HEATMAP_LIMIT) query.set("limit", String(params.limit));
  if (params.offset !== 0) query.set("offset", String(params.offset));
  // Always named, BTC too: a choice in the address is what has the server fill that tab, which a
  // reader without JavaScript needs, since nothing else would load it.
  if (gamma) query.set("gex", gamma.currency);
  if (gamma && gamma.scope !== GAMMA_SCOPES[0]) query.set("gexp", gamma.scope);
  if (gamma?.basis === "week") query.set("lvb", "week");
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * The Rates page's Gamma Exposure tab: which option book, and which expiries. The books are whatever
 * the collector has stored (internal/gamma: Deribit's BTC and ETH, Cboe's US chains, and index options
 * from HKEX, CFFEX, TAIFEX, JPX, ASX, NSE, BSE and Eurex), so the tab's picker lists them from the
 * table rather than from here, and a book the collector adds appears without a site change. BTC is the default.
 * The scopes are the collector's own: every expiry, within 30 days, within 7, the nearest alone.
 */
export const GAMMA_DEFAULT_BOOK = "BTC";
/** A book's key as the collector stores it ("SPX", "HSI", "CSI1000", "BANKNIFTY"). */
const GAMMA_BOOK = /^[A-Z0-9]{1,12}$/;
export const GAMMA_SCOPES = ["all", "30d", "7d", "next"] as const;
export type GammaScope = (typeof GAMMA_SCOPES)[number];

export interface GammaParams {
  currency: string;
  scope: GammaScope;
  /** The Ceiling & Floor tab's basis (`lvb`): the day's levels, or the week's expiry's. */
  basis?: LevelBasis;
}

export const LEVEL_BASES = ["day", "week"] as const;
export type LevelBasis = (typeof LEVEL_BASES)[number];

export function parseGammaParams(params: URLSearchParams): GammaParams {
  const currency = (params.get("gex") ?? "").trim().toUpperCase();
  const scope = (params.get("gexp") ?? "").trim().toLowerCase();
  return {
    // The book by its shape, the scope against its allowlist: both go into the query as values, never
    // as SQL, and a book with no rows says so in the tab.
    currency: GAMMA_BOOK.test(currency) ? currency : GAMMA_DEFAULT_BOOK,
    scope: (GAMMA_SCOPES as readonly string[]).includes(scope)
      ? (scope as GammaScope)
      : GAMMA_SCOPES[0],
    // Named only for the week, so a day's choices read as they always have.
    ...(params.get("lvb") === "week" ? { basis: "week" as const } : {}),
  };
}

/** Whether the address names the Gamma Exposure tab's choices, which opens the page on that tab. */
export function asksForGamma(params: URLSearchParams): boolean {
  return params.has("gex") || params.has("gexp");
}

/** Rows a page of the arbitrage table shows. Same reasoning as the rates grid: one screenful. */
export const DEFAULT_ARBITRAGE_LIMIT = 50;
export const MAX_ARBITRAGE_LIMIT = 200;
/**
 * Rows below this quoted gap are hidden by default.
 *
 * Measured before choosing it: of 432 comparable assets only 177 show any positive gap and the
 * median is 0.0 bps, so an unfiltered table is mostly zeros. One basis point is the smallest floor
 * that removes the noise without asserting a tradeable threshold — `?min_bps=0` shows everything.
 */
export const DEFAULT_MIN_GAP_BPS = 1;
export const MAX_MIN_GAP_BPS = 10_000;

export interface ArbitrageParams {
  minGapBps: number;
  /** Hides gaps at or above this; null keeps every gap. Set with minGapBps by a gap band. */
  maxGapBps: number | null;
  /** Hides rows whose thinner side rests less than this in USD; 0 keeps every quote. */
  minDepthUsd: number;
  /** The exchanges both legs come from; null for the default set (every one but the quarantined). */
  venueIds: string[] | null;
  assetClass: ScreenerClass | null;
  /** Each leg's floors; 0 for none. */
  minOpenInterestUsd: number;
  minVolume24hUsd: number;
  /** Both legs settle at this interval; null for any. */
  intervalHours: ScreenerInterval | null;
  limit: number;
  offset: number;
}

/**
 * Arbitrage table inputs. Every value is clamped rather than rejected, matching the other parsers:
 * a nonsense query yields the default page instead of an error.
 */
/** Price-gap bands the arbitrage filters offer, in basis points, floor inclusive to ceiling exclusive. */
export const GAP_BANDS = {
  "1-10": [1, 10],
  "10-50": [10, 50],
  "50-200": [50, 200],
  "200-": [200, null],
} as const satisfies Record<string, readonly [number, number | null]>;
export type GapBand = keyof typeof GAP_BANDS;

/** The band a gap range is, or null when it is none of them. */
export function gapBand(p: Pick<ArbitrageParams, "minGapBps" | "maxGapBps">): GapBand | null {
  for (const [id, [min, max]] of Object.entries(GAP_BANDS)) {
    if (p.minGapBps === min && p.maxGapBps === max) return id as GapBand;
  }
  return null;
}

export function parseArbitrageParams(params: URLSearchParams): ArbitrageParams {
  // Number("") is 0, not NaN, so an absent parameter would parse as an explicit zero floor and the
  // default would never apply. parseTakerBps guards the same way, for the same reason.
  const rawBps = params.get("min_bps");
  const minBps = rawBps === null || rawBps.trim() === "" ? Number.NaN : Number(rawBps);
  const limit = Number.parseInt(params.get("limit") ?? "", 10);
  const offset = Number.parseInt(params.get("offset") ?? "", 10);
  // A gap band ("10-50", "200-") sets both ends and wins over a bare floor.
  const band = GAP_BANDS[(params.get("gap") ?? "").trim() as GapBand];
  return {
    minGapBps: band
      ? band[0]
      : Number.isFinite(minBps)
        ? Math.min(Math.max(minBps, 0), MAX_MIN_GAP_BPS)
        : DEFAULT_MIN_GAP_BPS,
    maxGapBps: band ? band[1] : null,
    minDepthUsd: parseUsd(params.get("min_depth")) ?? 0,
    venueIds: everyListed(listParam(params, "venues", KNOWN_VENUES)),
    assetClass: oneOf(params.get("class"), SCREENER_CLASSES) as ScreenerClass | null,
    minOpenInterestUsd: parseUsd(params.get("min_oi")) ?? 0,
    minVolume24hUsd: parseUsd(params.get("min_vol")) ?? 0,
    intervalHours: parseInterval(params.get("interval")),
    limit: Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), MAX_ARBITRAGE_LIMIT)
      : DEFAULT_ARBITRAGE_LIMIT,
    offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  };
}

/** Canonical query, so paging and filter links round-trip and stay cache-keyed. */
export function arbitrageToQuery(params: ArbitrageParams): string {
  const query = new URLSearchParams();
  const band = gapBand(params);
  if (band) query.set("gap", band);
  else if (params.minGapBps !== DEFAULT_MIN_GAP_BPS) query.set("min_bps", String(params.minGapBps));
  if (params.minDepthUsd !== 0) query.set("min_depth", String(params.minDepthUsd));
  if (params.assetClass) query.set("class", params.assetClass);
  if (params.minOpenInterestUsd !== 0) query.set("min_oi", String(params.minOpenInterestUsd));
  if (params.minVolume24hUsd !== 0) query.set("min_vol", String(params.minVolume24hUsd));
  if (params.intervalHours) query.set("interval", `${params.intervalHours}h`);
  if (params.venueIds) query.set("venues", params.venueIds.join(","));
  if (params.limit !== DEFAULT_ARBITRAGE_LIMIT) query.set("limit", String(params.limit));
  if (params.offset !== 0) query.set("offset", String(params.offset));
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export const DEFAULT_BACKTEST_DAYS = 30;
/**
 * Backtests read the collector's daily rollup, which keeps 70 days (market_funding_daily). 60 is
 * the longest window it serves whole, so asking for more would quietly return less.
 */
export const MAX_BACKTEST_DAYS = 60;
/** The windows the page offers. Any whole number of days up to the maximum still parses. */
export const BACKTEST_WINDOWS = [1, 3, 7, 15, 30, 60] as const;
export const DEFAULT_BACKTEST_SIZE_USD = 10_000;
export const MAX_BACKTEST_SIZE_USD = 10_000_000;
/**
 * Taker fees are per account, not per venue: CEX VIP levels key off 30-day volume, Hyperliquid
 * tiers off 14-day volume, and staking or referral discounts move them again. So the reader supplies
 * them and nothing is assumed. 100 bps is far above any real taker fee and exists only to stop a
 * typo producing a nonsense figure.
 */
export const MAX_TAKER_FEE_BPS = 100;

export interface BacktestParams {
  longVenueId: string;
  shortVenueId: string;
  /** Notional per leg; capital committed is twice this before leverage. */
  sizeUsd: number;
  days: number;
  /**
   * Taker fee in basis points for each leg, or null when the reader gave none. Null is not zero:
   * zero asserts trading is free, while null keeps the engine's "costs unknown" path, which reports
   * no net-of-costs figure at all rather than a flattering one.
   */
  longTakerBps: number | null;
  shortTakerBps: number | null;
}

/**
 * The window from `days`, clamped to what the rollup serves; the default when missing or unreadable.
 * Read on its own too, because the pair page charts a window before any legs are chosen.
 */
export function parseBacktestDays(params: URLSearchParams): number {
  const days = Number.parseInt(params.get("days") ?? "", 10);
  return Number.isFinite(days)
    ? Math.min(Math.max(days, 1), MAX_BACKTEST_DAYS)
    : DEFAULT_BACKTEST_DAYS;
}

/** Backtest inputs from query params. Null when the two legs don't name two different exchanges. */
export function parseBacktestParams(params: URLSearchParams): BacktestParams | null {
  const longVenueId = (params.get("long") ?? "").trim().toLowerCase();
  const shortVenueId = (params.get("short") ?? "").trim().toLowerCase();
  if (!KNOWN_VENUES.has(longVenueId) || !KNOWN_VENUES.has(shortVenueId)) return null;
  // A spread needs two venues: the same market against itself is always zero.
  if (longVenueId === shortVenueId) return null;

  const size = parseUsd(params.get("size")) ?? DEFAULT_BACKTEST_SIZE_USD;
  return {
    longVenueId,
    shortVenueId,
    sizeUsd: Math.min(Math.max(size, 1), MAX_BACKTEST_SIZE_USD),
    days: parseBacktestDays(params),
    longTakerBps: parseTakerBps(params.get("fee_long")),
    shortTakerBps: parseTakerBps(params.get("fee_short")),
  };
}

/**
 * Canonical query for a backtest, mirroring `filtersToQuery` and `heatmapToQuery`, so every link the
 * page builds to a pair lands on the same cache key a shared link would produce.
 */
export function backtestToQuery(params: BacktestParams): string {
  const query = new URLSearchParams();
  query.set("long", params.longVenueId);
  query.set("short", params.shortVenueId);
  if (params.sizeUsd !== DEFAULT_BACKTEST_SIZE_USD) query.set("size", String(params.sizeUsd));
  if (params.days !== DEFAULT_BACKTEST_DAYS) query.set("days", String(params.days));
  if (params.longTakerBps !== null) query.set("fee_long", String(params.longTakerBps));
  if (params.shortTakerBps !== null) query.set("fee_short", String(params.shortTakerBps));
  return `?${query.toString()}`;
}

/**
 * A taker fee in basis points, clamped to a sane band. Null for anything missing or unparseable,
 * so a malformed fee reads as "not supplied" rather than as free trading. An explicit 0 is kept:
 * some venues genuinely rebate takers, and that is the reader's claim to make.
 */
export function parseTakerBps(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const bps = Number(value.trim());
  if (!Number.isFinite(bps) || bps < 0) return null;
  return Math.min(bps, MAX_TAKER_FEE_BPS);
}

/** A present checkbox param counts as on unless it explicitly says otherwise. */
function isTruthyParam(value: string | null): boolean {
  return value !== null && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

/** Accepts both `?types=cex,dex` and repeated `?types=cex&types=dex` (what an HTML form submits). */
function listParam(params: URLSearchParams, name: string, allowed: Set<string>): string[] | null {
  const values = params
    .getAll(name)
    .flatMap((v) => v.split(","))
    .map((v) => v.trim().toLowerCase())
    .filter((v) => allowed.has(v));
  const unique = [...new Set(values)].sort();
  return unique.length > 0 ? unique : null;
}

/**
 * Windows the liquidation map offers, and the column width each one uses.
 *
 * Bucket width is not a separate control because the two are not independent: 24 hours in 2-hour
 * columns is twelve columns, and the same 2 hours over a week would be eighty-four. One choice sets
 * both, so every window renders a grid of roughly the same shape and a reader cannot construct one
 * that is unreadable.
 *
 * MEASURED before choosing (production, 2026-09-17): 24,058 liquidations over 24 hours across 724
 * markets and two venues, $88.4M of notional. At 2-hour columns that is a median cell of $1,466 and
 * a busiest of $12.9M -- populated enough to read, sparse enough that the empty cells mean
 * something.
 *
 * `sideMinutes` is the bar width of the longs-vs-shorts chart, which is finer than a grid column on
 * purpose: a chart has no text in its bars, so it can afford ~90 of them, and a two-hour column
 * hides whether a flush was one violent quarter hour or a slow bleed. Each window lands between 84
 * and 96 bars.
 */
export const LIQUIDATION_WINDOWS = {
  "24h": { hours: 24, bucketHours: 2, sideMinutes: 15 },
  "48h": { hours: 48, bucketHours: 4, sideMinutes: 30 },
  "7d": { hours: 168, bucketHours: 12, sideMinutes: 120 },
} as const;

export type LiquidationWindow = keyof typeof LIQUIDATION_WINDOWS;
export const LIQUIDATION_WINDOW_KEYS = Object.keys(LIQUIDATION_WINDOWS) as LiquidationWindow[];

/**
 * Asset rows per venue panel. Twelve is what fits beside a second panel without either scrolling
 * on its own, and the tail is not dropped: the page carries an "other markets" row so the rows plus
 * the tail add up to the total, which is what makes the total checkable rather than decorative.
 */
export const DEFAULT_LIQUIDATION_ASSETS = 12;
export const MAX_LIQUIDATION_ASSETS = 40;

/**
 * Which venues the map tab adds up, as one control.
 *
 * "all" sums every feed into one grid and is the default. Otherwise it is a SET of venue ids, any
 * combination of them, summed into that same one grid: "what happened on Binance and OKX together"
 * is a question the reader can now ask directly. The old "each" view, a panel per venue, went with
 * the venue headings that told its panels apart (2026-10-08); an old link to it reads as "all".
 */
export const LIQUIDATION_VENUE_ALL = "all";
/** How many venues one selection may name; more than the fleet has, and a bound on the query. */
const MAX_LIQUIDATION_VENUES = 24;

export interface LiquidationParams {
  window: LiquidationWindow;
  assets: number;
  /**
   * "all", or the selected venue ids, sorted, unique and comma-joined ("binance,okx"), so one
   * selection is one address and one cache key whatever order it was clicked in. Never
   * interpolated into SQL; the page matches the ids against data.
   */
  venue: string;
}

/**
 * The canonical `venue` for a set of ids: "all" when the set is empty, sorted and comma-joined
 * otherwise. The one place a selection becomes a string, for the parser and the strip's links alike.
 */
export function liquidationVenueParam(ids: Iterable<string>): string {
  const unique = [...new Set(ids)].sort();
  return unique.length === 0 ? LIQUIDATION_VENUE_ALL : unique.join(",");
}

/** The venues a liquidation view is narrowed to, or null for every feed. */
export function liquidationVenues(params: Pick<LiquidationParams, "venue">): string[] | null {
  return params.venue === LIQUIDATION_VENUE_ALL ? null : params.venue.split(",");
}

/**
 * A query string with the venue list's commas left readable: URLSearchParams writes them as %2C,
 * which is legal but turns "?venue=binance,okx" into something nobody would type or recognise.
 */
export function readableQuery(query: URLSearchParams): string {
  return query.toString().replace(/%2C/g, ",");
}

export function parseLiquidationParams(params: URLSearchParams): LiquidationParams {
  const window = (params.get("window") ?? "").trim().toLowerCase();
  const assets = Number.parseInt(params.get("assets") ?? "", 10);
  // Venue ids are lowercase words with dashes (see packages/venues); anything else is dropped
  // rather than carried into the page as a selector nothing matches, and "all" anywhere in the list
  // means every feed. So does "each", the retired side-by-side view.
  const named = (params.get("venue") ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => /^[a-z0-9-]{1,24}$/.test(id));
  const venue =
    named.includes(LIQUIDATION_VENUE_ALL) || named.includes("each")
      ? LIQUIDATION_VENUE_ALL
      : liquidationVenueParam(named.slice(0, MAX_LIQUIDATION_VENUES));
  return {
    // Exact match against the allowlist: the window decides an interval and a bucket width, so it is
    // never interpolated from what arrived in the query string.
    window: (LIQUIDATION_WINDOW_KEYS as readonly string[]).includes(window)
      ? (window as LiquidationWindow)
      : "24h",
    assets: Number.isFinite(assets)
      ? Math.min(Math.max(assets, 1), MAX_LIQUIDATION_ASSETS)
      : DEFAULT_LIQUIDATION_ASSETS,
    venue,
  };
}

/** Canonical query string, so the window strip and the row count round-trip and stay cache-keyed. */
export function liquidationsToQuery(params: LiquidationParams): string {
  const query = new URLSearchParams();
  if (params.window !== "24h") query.set("window", params.window);
  if (params.assets !== DEFAULT_LIQUIDATION_ASSETS) query.set("assets", String(params.assets));
  if (params.venue !== LIQUIDATION_VENUE_ALL) query.set("venue", params.venue);
  const encoded = readableQuery(query);
  return encoded ? `?${encoded}` : "";
}

/**
 * Price-band width for one asset's liquidation grid, as a percentage of its mark.
 *
 * The reference this page's layout comes from carries the same control, and it needs one: assets
 * disagree about what "near the price" means. Measured over 24 hours on 2026-09-17, the spread of
 * liquidation fill prices ran from 2.88% (XAU) to 43.24% (ZEC) of the mark, so a single fixed band
 * would give gold one populated row and Zcash a grid that runs off the page.
 */
export const LIQUIDATION_BANDS = [0.25, 0.5, 1, 2, 5] as const;
export type LiquidationBand = (typeof LIQUIDATION_BANDS)[number];

/**
 * Bands either side of the mark before a row becomes a catch-all.
 *
 * Four each way plus the two tails is nine rows, which is the reference layout's own row count and
 * about what fits beside a second panel. The tails are what keep the grid honest at any band width:
 * ETH's widest fill in that window was 12.9% from the mark, and a grid that simply dropped it would
 * be hiding the most interesting liquidation of the day.
 */
export const LIQUIDATION_BAND_REACH = 4;

export interface LiquidationAssetParams {
  window: LiquidationWindow;
  /**
   * Null means "fit it to this asset", which is the default.
   *
   * A fixed default cannot serve every asset: at 1% bands and four rows either way the grid spans
   * 4% of the mark, which is right for ETH's quiet day and leaves gold's entire day in one row and
   * Zcash's outside the tails. The data layer picks from the asset's own spread when this is null,
   * and the page says which width it chose -- a reader who wants a different one clicks it.
   */
  band: LiquidationBand | null;
  /** Whether the sides chart draws the modeled pending-by-price panel. On unless the address says 0. */
  pending: boolean;
  /** The pending strip's range: ±10% ("near"), or zoomed out to ±50%. */
  zoom: "near" | "wide";
  /** The whale map's smallest position: $1M, as whale trackers count them, or $100k. */
  whale: WhaleFloor;
  /** How far either side of the mark the whale map's price axis reaches, in percent. */
  wzoom: WhaleZoom;
}

/**
 * The whale map's price ranges. Fixed rather than fitted: most of a whale book sits far from its
 * liquidation (BTC on 2026-10-14: 85% of it beyond ±30%), so a fit stretched to ±50% and crushed the
 * levels near the price, which are the ones a trader acts on. The chart says what lies beyond.
 */
export const WHALE_ZOOMS = [10, 25, 50] as const;
export type WhaleZoom = (typeof WHALE_ZOOMS)[number];
export const DEFAULT_WHALE_ZOOM: WhaleZoom = 25;

/** The whale map's position floors, in dollars by their query value. The collector stores $100k up. */
export const WHALE_FLOORS = { "1m": 1_000_000, "100k": 100_000 } as const;
export type WhaleFloor = keyof typeof WHALE_FLOORS;

export function parseLiquidationAssetParams(params: URLSearchParams): LiquidationAssetParams {
  const window = (params.get("window") ?? "").trim().toLowerCase();
  const band = Number(params.get("band") ?? "");
  return {
    window: (LIQUIDATION_WINDOW_KEYS as readonly string[]).includes(window)
      ? (window as LiquidationWindow)
      : "24h",
    // Exact match against the allowlist: the band becomes arithmetic inside the query, so an
    // unrecognised one falls back to fitting rather than reaching it.
    band: (LIQUIDATION_BANDS as readonly number[]).includes(band)
      ? (band as LiquidationBand)
      : null,
    pending: params.get("pending") !== "0",
    zoom: params.get("zoom") === "out" ? "wide" : "near",
    whale: params.get("whale") === "100k" ? "100k" : "1m",
    wzoom: (WHALE_ZOOMS as readonly number[]).includes(Number(params.get("wzoom")))
      ? (Number(params.get("wzoom")) as WhaleZoom)
      : DEFAULT_WHALE_ZOOM,
  };
}

export function liquidationAssetToQuery(params: LiquidationAssetParams): string {
  const query = new URLSearchParams();
  if (params.window !== "24h") query.set("window", params.window);
  if (params.band !== null) query.set("band", String(params.band));
  if (!params.pending) query.set("pending", "0");
  if (params.zoom === "wide") query.set("zoom", "out");
  if (params.whale !== "1m") query.set("whale", params.whale);
  if (params.wzoom !== DEFAULT_WHALE_ZOOM) query.set("wzoom", String(params.wzoom));
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * Bar intervals the CVD page offers, and the span each one charts.
 *
 * THE READER PICKS THE BAR, NOT THE WINDOW (2026-10-07). The control used to be a window (1h, 4h,
 * 24h, 7d) with the bar width derived from it; traders think in candles, so it now names the bar
 * and the span follows: about 96 bars each, the density the longs-vs-shorts chart settled on. The
 * table and the tiles sum the same span the chart draws, so everything on the page covers one
 * stretch of time.
 *
 * The floor is 5 minutes because that is the grain the venues publish taker flow at (migration 023).
 * The ceiling is history: taker_flow keeps 35 days (and held 27 when this was written), so 24-hour
 * bars chart 30 days, and a 7-day bar -- offered, but locked -- would be four or five bars.
 *
 * Measured on production with the web role, 2026-10-07: the per-market sum over taker_flow took
 * 0.2-0.9 s for 7, 16 and 30 days, so the long spans need no rollup yet.
 */
export const CVD_INTERVALS = {
  "5m": { barMinutes: 5, hours: 8, span: "8h" },
  "15m": { barMinutes: 15, hours: 24, span: "24h" },
  "1h": { barMinutes: 60, hours: 96, span: "4d" },
  "4h": { barMinutes: 240, hours: 384, span: "16d" },
  "24h": { barMinutes: 1440, hours: 720, span: "30d" },
} as const;

export type CvdInterval = keyof typeof CVD_INTERVALS;
export const CVD_INTERVAL_KEYS = Object.keys(CVD_INTERVALS) as CvdInterval[];
/**
 * Shown on the strip with a lock, and never selectable: `?interval=` naming one falls back to the
 * default like any unknown value, so a pasted address cannot reach a chart the page does not offer.
 * 7d is locked because there is not enough history yet to draw it; 2h is planned but not offered yet.
 */
export const CVD_LOCKED_INTERVALS = ["2h", "7d"] as const;
export type CvdLockedInterval = (typeof CVD_LOCKED_INTERVALS)[number];
export const CVD_DEFAULT_INTERVAL: CvdInterval = "15m";

/**
 * The strip, shortest bar first, with each locked interval where its duration puts it rather than
 * trailing at the end: a reader scanning for a bar size finds it in its place, open or not.
 */
export const CVD_STRIP: readonly (CvdInterval | CvdLockedInterval)[] = [
  "5m",
  "15m",
  "1h",
  "2h",
  "4h",
  "24h",
  "7d",
];

export function isCvdLockedInterval(
  key: CvdInterval | CvdLockedInterval,
): key is CvdLockedInterval {
  return (CVD_LOCKED_INTERVALS as readonly string[]).includes(key);
}

/**
 * The old `?window=` addresses, kept working: each lands on the interval that draws the closest
 * chart. 24h was 15-minute bars over a day, which is exactly the 15m interval.
 */
const CVD_LEGACY_WINDOWS: Record<string, CvdInterval> = {
  "1h": "5m",
  "4h": "5m",
  "24h": "15m",
  "7d": "1h",
};

export const CVD_SORTS = ["volume", "cvd", "ratio", "change"] as const;
export type CvdSort = (typeof CVD_SORTS)[number];

/**
 * What the page shows under its controls: the chart with the all-asset tiles, or the charted asset's
 * Detail in their place (owner, 2026-10-29). `?view=detail`; the chart is the bare address.
 */
export const CVD_VIEWS = ["chart", "detail"] as const;
export type CvdView = (typeof CVD_VIEWS)[number];

export interface CvdParams {
  interval: CvdInterval;
  sort: CvdSort;
  /** Ascending instead of the default descending, so the heaviest selling can be put on top. */
  asc: boolean;
  /** A case-insensitive substring of the asset name, or "" for every asset. */
  q: string;
  view: CvdView;
}

export function parseCvdParams(params: URLSearchParams): CvdParams {
  const interval = (params.get("interval") ?? "").trim().toLowerCase();
  const legacy = CVD_LEGACY_WINDOWS[(params.get("window") ?? "").trim().toLowerCase()];
  const sort = (params.get("sort") ?? "").trim().toLowerCase();
  return {
    // Exact match against the allowlist: the interval becomes arithmetic inside the query.
    interval: (CVD_INTERVAL_KEYS as readonly string[]).includes(interval)
      ? (interval as CvdInterval)
      : (legacy ?? CVD_DEFAULT_INTERVAL),
    sort: (CVD_SORTS as readonly string[]).includes(sort) ? (sort as CvdSort) : "volume",
    asc: params.get("dir") === "asc",
    // Matched in the page, never in SQL, and bounded so a pasted paragraph cannot become the key.
    q: (params.get("q") ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9._-]/g, "")
      .slice(0, 20),
    view: params.get("view") === "detail" ? "detail" : "chart",
  };
}

export function cvdToQuery(params: CvdParams): string {
  const query = new URLSearchParams();
  if (params.interval !== CVD_DEFAULT_INTERVAL) query.set("interval", params.interval);
  if (params.sort !== "volume") query.set("sort", params.sort);
  if (params.asc) query.set("dir", "asc");
  if (params.q) query.set("q", params.q);
  if (params.view === "detail") query.set("view", "detail");
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

/** Bars in one page of the CVD chart's history: about 41 hours of 5-minute bars, 21 days of hourly. */
export const KC_PAGE_BARS = 500;
/** How long taker_flow keeps a bucket (collector migration 023): nothing older can be asked for. */
export const TAKER_FLOW_DAYS = 35;

/** One page of the Chart page's history, as `/data/chart` is asked for it (web/kchart.ts). */
export interface CvdHistoryParams {
  asset: string;
  assetClass: AssetClass;
  barMinutes: number;
  /** The page: bars starting in [fromMs, toMs). */
  fromMs: number;
  toMs: number;
  ref: { venue: string; symbol: string } | null;
  /** `spot=1`: the chart draws a spot line, so the page carries the spot book's flow too. */
  spot: boolean;
}

const HISTORY_ASSET = /^[\p{L}\p{N}._-]{1,40}$/u;
const HISTORY_REF = /^([a-z0-9-]{1,32}):([\p{L}\p{N}._-]{1,48})$/u;

/**
 * `/data/chart`'s query, or null when any part is not one the chart would send. Strict on purpose:
 * every page is cached by its address, so `before` must sit on the page grid (a multiple of
 * KC_PAGE_BARS bars) and inside the retention, and the bar must be one of the intervals' -- an
 * address the chart never makes would only ever be a cache miss sent to the database.
 */
export function parseCvdHistoryParams(
  params: URLSearchParams,
  now: number,
): CvdHistoryParams | null {
  const asset = params.get("asset") ?? "";
  const assetClass = ASSET_CLASSES.find((c) => c === params.get("class"));
  const barMinutes = Number(params.get("bar"));
  const before = Number(params.get("before"));
  const ref = HISTORY_REF.exec(params.get("ref") ?? "");
  if (!HISTORY_ASSET.test(asset) || !assetClass) return null;
  if (!Object.values(CVD_INTERVALS).some((interval) => interval.barMinutes === barMinutes)) {
    return null;
  }
  const page = KC_PAGE_BARS * barMinutes * 60_000;
  if (!Number.isSafeInteger(before) || before % page !== 0) return null;
  // From the page holding the oldest kept bucket to the page holding now.
  if (before <= now - TAKER_FLOW_DAYS * 86_400_000 || before > now + page) return null;
  if (params.has("ref") && !ref) return null;
  if (params.has("spot") && params.get("spot") !== "1") return null;
  return {
    asset: asset.toUpperCase(),
    assetClass,
    barMinutes,
    fromMs: before - page,
    toMs: before,
    ref: ref?.[1] && ref[2] ? { venue: ref[1], symbol: ref[2] } : null,
    spot: params.get("spot") === "1",
  };
}

/**
 * Windows the sentiment chart offers. market_sentiment (migration 026) keeps 90 days and writes
 * every 30 minutes, so 7d is ~336 points and 90d is ~4,320 -- both fine for one SVG polyline -- and
 * the default is 7d, wide enough to show the score moving without drowning a single day's reading.
 */
export const SENTIMENT_WINDOWS = {
  "24h": { hours: 24 },
  "7d": { hours: 24 * 7 },
  "30d": { hours: 24 * 30 },
  "90d": { hours: 24 * 90 },
} as const;

export type SentimentWindow = keyof typeof SENTIMENT_WINDOWS;
export const SENTIMENT_WINDOW_KEYS = Object.keys(SENTIMENT_WINDOWS) as SentimentWindow[];

export interface SentimentParams {
  window: SentimentWindow;
}

export function parseSentimentParams(params: URLSearchParams): SentimentParams {
  const window = (params.get("window") ?? "").trim().toLowerCase();
  return {
    window: (SENTIMENT_WINDOW_KEYS as readonly string[]).includes(window)
      ? (window as SentimentWindow)
      : "7d",
  };
}

export function sentimentToQuery(params: SentimentParams): string {
  const query = new URLSearchParams();
  if (params.window !== "7d") query.set("window", params.window);
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * /whales candle intervals, as on /cvd: each folds the collector's 5-minute candles into bars of
 * its length and shows about a hundred of them, the walls drawn over the same span. The 4-hour view
 * reaches the 14 days the collector keeps candles and walls for (pulled walls: 4 days).
 */
export const WHALE_INTERVALS = {
  "5m": { hours: 8, barMinutes: 5, span: "8h" },
  "15m": { hours: 24, barMinutes: 15, span: "24h" },
  "1h": { hours: 96, barMinutes: 60, span: "4d" },
  "4h": { hours: 336, barMinutes: 240, span: "14d" },
} as const;
export type WhaleInterval = keyof typeof WHALE_INTERVALS;
export const WHALE_INTERVAL_KEYS = Object.keys(WHALE_INTERVALS) as WhaleInterval[];
export const WHALE_DEFAULT_INTERVAL: WhaleInterval = "15m";
/** The window strip this replaced (2026-10-16), each address landing on the interval nearest it. */
const WHALE_OLD_WINDOWS: Record<string, WhaleInterval> = { "6h": "5m", "24h": "15m", "3d": "1h" };

/** The venues whose books the collector reads for /whales, the default first. */
export const WHALE_VENUES = ["binance", "hyperliquid"] as const;
export type WhaleVenue = (typeof WHALE_VENUES)[number];

export interface WhaleParams {
  interval: WhaleInterval;
  /** Draw walls that were pulled (cancelled) too. Off by default: they are most of the noise. */
  pulled: boolean;
  venue: WhaleVenue;
}

export function parseWhaleParams(params: URLSearchParams): WhaleParams {
  const asked = params.get("interval") ?? "";
  const interval = (WHALE_INTERVAL_KEYS as string[]).includes(asked)
    ? (asked as WhaleInterval)
    : (WHALE_OLD_WINDOWS[params.get("window") ?? ""] ?? WHALE_DEFAULT_INTERVAL);
  const venue = (WHALE_VENUES as readonly string[]).includes(params.get("venue") ?? "")
    ? (params.get("venue") as WhaleVenue)
    : WHALE_VENUES[0];
  return { interval, pulled: params.get("pulled") === "1", venue };
}

/** The query for params, defaults left out so the bare address is the canonical one. */
export function whaleToQuery(params: WhaleParams): string {
  const query = new URLSearchParams();
  if (params.venue !== WHALE_VENUES[0]) query.set("venue", params.venue);
  if (params.interval !== WHALE_DEFAULT_INTERVAL) query.set("interval", params.interval);
  if (params.pulled) query.set("pulled", "1");
  const text = query.toString();
  return text ? `?${text}` : "";
}

/** The Chart page's fund-flow tables ask /data/fund-flow for one asset: ?asset=BTC&class=crypto. */
export function parseFundFlowParams(
  params: URLSearchParams,
): { asset: string; assetClass: AssetClass } | null {
  const asset = params.get("asset") ?? "";
  const assetClass = ASSET_CLASSES.find((c) => c === params.get("class"));
  if (!HISTORY_ASSET.test(asset) || !assetClass) return null;
  return { asset: asset.toUpperCase(), assetClass };
}
