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
