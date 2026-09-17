import { VENUES } from "@ai-rates/venues";
import { SCREENER_SORTS, type ScreenerFilters, type ScreenerSort } from "./data";

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
  // The widest spread first, which is what the page is for. The homepage relies on this default.
  sort: "spread",
  limit: 100,
};

const KNOWN_VENUES = new Set(VENUES.map((v) => v.id));
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
    venueIds: listParam(params, "venues", KNOWN_VENUES),
    maxAbsApr: isTruthyParam(params.get("extremes")) ? null : DEFAULT_FILTERS.maxAbsApr,
    sameQuote: (params.get("quote") ?? "").trim().toLowerCase() === "same",
    // Selecting every type is the same as not filtering by type.
    venueTypes: types && types.length === VENUE_TYPES.length ? null : types,
    sort: parseScreenerSort(params.get("sort")),
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), MAX_LIMIT) : DEFAULT_FILTERS.limit,
  };
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

/** Canonical query string, so timeframe and paging links round-trip and stay cache-keyed. */
export function heatmapToQuery(params: HeatmapParams): string {
  const query = new URLSearchParams();
  if (params.tf !== "now") query.set("tf", params.tf);
  if (params.limit !== DEFAULT_HEATMAP_LIMIT) query.set("limit", String(params.limit));
  if (params.offset !== 0) query.set("offset", String(params.offset));
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
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
  /** Hides rows whose thinner side rests less than this in USD; 0 keeps every quote. */
  minDepthUsd: number;
  limit: number;
  offset: number;
}

/**
 * Arbitrage table inputs. Every value is clamped rather than rejected, matching the other parsers:
 * a nonsense query yields the default page instead of an error.
 */
export function parseArbitrageParams(params: URLSearchParams): ArbitrageParams {
  // Number("") is 0, not NaN, so an absent parameter would parse as an explicit zero floor and the
  // default would never apply. parseTakerBps guards the same way, for the same reason.
  const rawBps = params.get("min_bps");
  const minBps = rawBps === null || rawBps.trim() === "" ? Number.NaN : Number(rawBps);
  const limit = Number.parseInt(params.get("limit") ?? "", 10);
  const offset = Number.parseInt(params.get("offset") ?? "", 10);
  return {
    minGapBps: Number.isFinite(minBps)
      ? Math.min(Math.max(minBps, 0), MAX_MIN_GAP_BPS)
      : DEFAULT_MIN_GAP_BPS,
    minDepthUsd: parseUsd(params.get("min_depth")) ?? 0,
    limit: Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), MAX_ARBITRAGE_LIMIT)
      : DEFAULT_ARBITRAGE_LIMIT,
    offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  };
}

/** Canonical query, so paging and filter links round-trip and stay cache-keyed. */
export function arbitrageToQuery(params: ArbitrageParams): string {
  const query = new URLSearchParams();
  if (params.minGapBps !== DEFAULT_MIN_GAP_BPS) query.set("min_bps", String(params.minGapBps));
  if (params.minDepthUsd !== 0) query.set("min_depth", String(params.minDepthUsd));
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
 * Which venues the map tab draws, as one control.
 *
 * "all" sums every venue into one grid and is the default: with two feeds the side-by-side panels
 * were the point, but the liquidation fleet is growing past that, and "what happened to this asset"
 * is the question a reader brings. "each" is the old side-by-side view, which answers the narrower
 * and better question of whether two books broke in the same hour. Anything else is one venue's id.
 */
export const LIQUIDATION_VENUE_ALL = "all";
export const LIQUIDATION_VENUE_EACH = "each";

export interface LiquidationParams {
  window: LiquidationWindow;
  assets: number;
  /** "all", "each", or a venue id. Never interpolated into SQL; the page matches it against data. */
  venue: string;
}

export function parseLiquidationParams(params: URLSearchParams): LiquidationParams {
  const window = (params.get("window") ?? "").trim().toLowerCase();
  const assets = Number.parseInt(params.get("assets") ?? "", 10);
  const venue = (params.get("venue") ?? LIQUIDATION_VENUE_ALL).trim().toLowerCase();
  return {
    // Exact match against the allowlist: the window decides an interval and a bucket width, so it is
    // never interpolated from what arrived in the query string.
    window: (LIQUIDATION_WINDOW_KEYS as readonly string[]).includes(window)
      ? (window as LiquidationWindow)
      : "24h",
    assets: Number.isFinite(assets)
      ? Math.min(Math.max(assets, 1), MAX_LIQUIDATION_ASSETS)
      : DEFAULT_LIQUIDATION_ASSETS,
    // Venue ids are lowercase words with dashes (see packages/venues); anything else falls back to
    // the combined view rather than being carried into the page as a selector nothing matches.
    venue: /^[a-z0-9-]{1,24}$/.test(venue) ? venue : LIQUIDATION_VENUE_ALL,
  };
}

/** Canonical query string, so the window strip and the row count round-trip and stay cache-keyed. */
export function liquidationsToQuery(params: LiquidationParams): string {
  const query = new URLSearchParams();
  if (params.window !== "24h") query.set("window", params.window);
  if (params.assets !== DEFAULT_LIQUIDATION_ASSETS) query.set("assets", String(params.assets));
  if (params.venue !== LIQUIDATION_VENUE_ALL) query.set("venue", params.venue);
  const encoded = query.toString();
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
}

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
  };
}

export function liquidationAssetToQuery(params: LiquidationAssetParams): string {
  const query = new URLSearchParams();
  if (params.window !== "24h") query.set("window", params.window);
  if (params.band !== null) query.set("band", String(params.band));
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * Windows the CVD page offers, and the bar width each one draws at.
 *
 * The floor is 5 minutes because that is the grain the venues publish taker flow at (migration 023),
 * so a 1-hour window is twelve bars and cannot be finer. Longer windows re-bucket to keep each chart
 * near a hundred bars, the same density the longs-vs-shorts chart settled on.
 */
export const CVD_WINDOWS = {
  "1h": { hours: 1, barMinutes: 5 },
  "4h": { hours: 4, barMinutes: 5 },
  "24h": { hours: 24, barMinutes: 15 },
  "7d": { hours: 168, barMinutes: 120 },
} as const;

export type CvdWindow = keyof typeof CVD_WINDOWS;
export const CVD_WINDOW_KEYS = Object.keys(CVD_WINDOWS) as CvdWindow[];

export const CVD_SORTS = ["volume", "cvd", "ratio", "change"] as const;
export type CvdSort = (typeof CVD_SORTS)[number];

export interface CvdParams {
  window: CvdWindow;
  sort: CvdSort;
  /** Ascending instead of the default descending, so the heaviest selling can be put on top. */
  asc: boolean;
  /** A case-insensitive substring of the asset name, or "" for every asset. */
  q: string;
}

export function parseCvdParams(params: URLSearchParams): CvdParams {
  const window = (params.get("window") ?? "").trim().toLowerCase();
  const sort = (params.get("sort") ?? "").trim().toLowerCase();
  return {
    window: (CVD_WINDOW_KEYS as readonly string[]).includes(window) ? (window as CvdWindow) : "24h",
    sort: (CVD_SORTS as readonly string[]).includes(sort) ? (sort as CvdSort) : "volume",
    asc: params.get("dir") === "asc",
    // Matched in the page, never in SQL, and bounded so a pasted paragraph cannot become the key.
    q: (params.get("q") ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9._-]/g, "")
      .slice(0, 20),
  };
}

export function cvdToQuery(params: CvdParams): string {
  const query = new URLSearchParams();
  if (params.window !== "24h") query.set("window", params.window);
  if (params.sort !== "volume") query.set("sort", params.sort);
  if (params.asc) query.set("dir", "asc");
  if (params.q) query.set("q", params.q);
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}
