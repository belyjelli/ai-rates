import { canonicalBase, type MarketRef, parseVenueSymbol, refineAssetClass } from "@ai-rates/core";
import { scaleOverride } from "./scale";

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

/**
 * The base a venue declares for a contract, or null to fall back to parsing the symbol.
 *
 * MEXC states both: `baseCoin` is the contract code (`MUSTOCK`) and `baseCoinName` the underlying
 * (`MU`). Reading the declaration beats any suffix rule — 356 of its contracts rename, landing on
 * pools six to nine venues deep at a price ratio of 1.0 — and it cannot be replaced by stripping
 * "STOCK", because MEXC deliberately withholds the rename on exactly the 13 contracts whose
 * stripped name would collide with a crypto ticker: CATSTOCK, STXSTOCK, RTXSTOCK, BBSTOCK,
 * PURRSTOCK and friends. Those tickers differ by 387,440,758x, 2,963x, 139x and 955x respectively.
 * The venue is protecting us there, and a regex would override it.
 *
 * `baseCoinName` is a DISPLAY name, so it is a candidate rather than an answer. Of 383 that differ,
 * 356 are clean tickers and 27 are prose: `GOLD(XAU)`, `OIL(WTI)`, `SILVER(XAG)`, `COPPER(XCU)`,
 * plus CJK names like `龙虾`. The parenthetical holds the canonical ticker we already use, so it is
 * preferred; anything else that is not a plain ticker falls back to `baseCoin`.
 */
export function resolveDeclaredBase(
  baseCoin: string | undefined,
  baseCoinName: string | undefined,
): string | undefined {
  const code = baseCoin?.trim();
  const declared = baseCoinName?.trim();
  if (!declared || declared === code) return code || undefined;

  const parenthesised = /^[A-Za-z][A-Za-z0-9 .&-]*\(([A-Z0-9]{1,15})\)$/.exec(declared);
  if (parenthesised) return parenthesised[1];
  return /^[A-Z0-9]{1,15}$/.test(declared) ? declared : code || undefined;
}

/** Builds a MarketRef from a venue symbol, letting adapters override fields the venue reports explicitly. */
export function marketRef(
  venueId: string,
  venueSymbol: string,
  overrides: Partial<Omit<MarketRef, "venueId" | "venueSymbol">> = {},
): MarketRef {
  const parsed = parseVenueSymbol(venueSymbol);
  const ref: MarketRef = {
    venueId,
    venueSymbol,
    base: parsed.base,
    // Crypto unless the adapter passes what its venue declares. Never read off the symbol: CAT is
    // a memecoin on five venues and Caterpillar on gate, under the same correct ticker.
    assetClass: "crypto",
    quote: parsed.quote,
    multiplier: parsed.multiplier,
    dex: parsed.dex,
    ...overrides,
  };
  // A declared base skips parseVenueSymbol entirely, so it would also skip the alias map and
  // re-split the pools that map exists to join: MEXC declares the S&P 500 as SP500, which has to
  // reach US500 the same way gate's SPX500 does. Only the base is canonicalised -- `quote` is a
  // settlement currency, not an asset, and has no alias table.
  // `parsed.base`, not `ref.base`: an adapter passing `base: undefined` explicitly (MEXC, when
  // `baseCoin` is empty) spreads that undefined over the parsed base above.
  const base = overrides.base === undefined ? parsed.base : canonicalBase(overrides.base);
  // On top of whatever the symbol or the venue said: a scale override exists precisely because
  // neither reports this market's contract size (see scale.ts).
  const multiplier = ref.multiplier * (scaleOverride(venueId, venueSymbol) ?? 1);
  // Refined here rather than in each adapter so that every venue settles equity-versus-index and
  // tokenised gold by the same table; a venue's crypto declaration passes through untouched.
  return { ...ref, base, multiplier, assetClass: refineAssetClass(ref.assetClass, base) };
}
