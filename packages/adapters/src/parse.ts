import { type MarketRef, parseVenueSymbol } from "@ai-rates/core";

const MS_PER_HOUR = 3_600_000;

/** Parses a venue number given as a number or string; null for missing, empty or non-finite values. */
export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Product of nullable factors; null if any factor is null. */
export function mul(...factors: (number | null)[]): number | null {
  let product = 1;
  for (const factor of factors) {
    if (factor === null) return null;
    product *= factor;
  }
  return product;
}

/** Whole-ish hours between two epoch-ms instants, or null if the span isn't positive. */
export function hoursBetween(fromMs: number | null, toMs: number | null): number | null {
  if (fromMs === null || toMs === null || toMs <= fromMs) return null;
  return Math.round(((toMs - fromMs) / MS_PER_HOUR) * 1e6) / 1e6;
}

/**
 * Which symbols to refresh this cycle when a venue exposes something only per symbol: never-fetched
 * symbols first (in the given order), then entries older than `maxAgeMs`, oldest first, capped at
 * `budget`. Spreads an expensive sweep across cycles instead of stalling one on hundreds of calls.
 */
export function selectRefreshBatch(
  symbols: readonly string[],
  cache: ReadonlyMap<string, { fetchedAt: number }>,
  now: number,
  budget: number,
  maxAgeMs: number,
): string[] {
  const missing = symbols.filter((s) => !cache.has(s));
  const stale = symbols
    .filter((s) => {
      const entry = cache.get(s);
      return entry !== undefined && now - entry.fetchedAt >= maxAgeMs;
    })
    .sort((a, b) => (cache.get(a)?.fetchedAt ?? 0) - (cache.get(b)?.fetchedAt ?? 0));
  return [...missing, ...stale].slice(0, Math.max(0, budget));
}

/** Builds a MarketRef from a venue symbol, letting adapters override fields the venue reports explicitly. */
export function marketRef(
  venueId: string,
  venueSymbol: string,
  overrides: Partial<Omit<MarketRef, "venueId" | "venueSymbol">> = {},
): MarketRef {
  const parsed = parseVenueSymbol(venueSymbol);
  return {
    venueId,
    venueSymbol,
    base: parsed.base,
    quote: parsed.quote,
    multiplier: parsed.multiplier,
    dex: parsed.dex,
    ...overrides,
  };
}
