import { VENUES } from "@ai-rates/venues";
import type { ScreenerFilters } from "./data";

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
    // Selecting every type is the same as not filtering by type.
    venueTypes: types && types.length === VENUE_TYPES.length ? null : types,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), MAX_LIMIT) : DEFAULT_FILTERS.limit,
  };
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
  if (filters.limit !== DEFAULT_FILTERS.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const HEATMAP_TIMEFRAMES = ["now", "7d", "30d", "60d"] as const;
export type HeatmapTimeframe = (typeof HEATMAP_TIMEFRAMES)[number];
export const DEFAULT_HEATMAP_LIMIT = 150;
/**
 * Equal to the default on purpose. 150 assets x ~14 venues is ~2,100 cells, and the cost is linear
 * in rows, so the plan treats 150 as a ceiling until it has been measured — a limit a caller could
 * raise would quietly step past it. Asking for fewer is always allowed.
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

export const DEFAULT_BACKTEST_DAYS = 30;
/** Backfilled history reaches 90 days, so asking for more would quietly return less. */
export const MAX_BACKTEST_DAYS = 90;
export const DEFAULT_BACKTEST_SIZE_USD = 10_000;
export const MAX_BACKTEST_SIZE_USD = 10_000_000;

export interface BacktestParams {
  longVenueId: string;
  shortVenueId: string;
  /** Notional per leg; capital committed is twice this before leverage. */
  sizeUsd: number;
  days: number;
}

/** Backtest inputs from query params. Null when the two legs don't name two different exchanges. */
export function parseBacktestParams(params: URLSearchParams): BacktestParams | null {
  const longVenueId = (params.get("long") ?? "").trim().toLowerCase();
  const shortVenueId = (params.get("short") ?? "").trim().toLowerCase();
  if (!KNOWN_VENUES.has(longVenueId) || !KNOWN_VENUES.has(shortVenueId)) return null;
  // A spread needs two venues: the same market against itself is always zero.
  if (longVenueId === shortVenueId) return null;

  const size = parseUsd(params.get("size")) ?? DEFAULT_BACKTEST_SIZE_USD;
  const days = Number.parseInt(params.get("days") ?? "", 10);
  return {
    longVenueId,
    shortVenueId,
    sizeUsd: Math.min(Math.max(size, 1), MAX_BACKTEST_SIZE_USD),
    days: Number.isFinite(days)
      ? Math.min(Math.max(days, 1), MAX_BACKTEST_DAYS)
      : DEFAULT_BACKTEST_DAYS,
  };
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
