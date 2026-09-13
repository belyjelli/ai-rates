import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  type LeverageTier,
  parseVenueSymbol,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

export const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

const HOUR_MS = 3_600_000;
const HISTORY_PAGE_SIZE = 500;
/** Annotations change only when a deployer lists or relabels a market; a quarter-hour lag is harmless. */
export const ANNOTATIONS_MAX_AGE_MS = 15 * 60_000;
/** After a failed annotations refresh, the wait before the next attempt. */
export const ANNOTATIONS_RETRY_MS = 60_000;

interface HlUniverseAsset {
  name: string;
  isDelisted?: boolean;
  /** Headline leverage. `meta.marginTables` carries the full ladder in this same response (B1). */
  maxLeverage?: number | null;
  /** Which entry of `marginTables` this asset uses; tables are shared across many assets. */
  marginTableId?: number;
}

export interface HlMarginTier {
  /** Position notional in USD at which this step begins. */
  lowerBound: string;
  maxLeverage: number;
}

/** `[id, table]`, as Hyperliquid serialises its shared margin tables. */
export type HlMarginTable = [number, { description?: string; marginTiers: HlMarginTier[] }];

export interface HlMeta {
  universe: HlUniverseAsset[];
  marginTables?: HlMarginTable[];
}

interface HlAssetCtx {
  funding?: string | null;
  openInterest?: string | null;
  markPx?: string | null;
  oraclePx?: string | null;
  dayNtlVlm?: string | null;
}

export type HlMetaAndAssetCtxs = [HlMeta, HlAssetCtx[]];

/**
 * `perpConciseAnnotations`: `[coin, annotation]` for every annotated HIP-3 market on every dex, with
 * the coin spelt exactly as `meta.universe[].name` spells it (`xyz:BB`).
 */
export type HlPerpConciseAnnotations = [string, { category?: string | null }][];

/**
 * What a HIP-3 deployer's `category` annotation declares.
 *
 * On 2026-09-14 one response covered 200 markets across seven dexes: stocks 131, indices 26,
 * commodities 23, crypto 7, preipo 5 and fx 5, plus one each of `FX` (km:EUR), `stock` (para:AAOI)
 * and `rates` (para:10Y). Deployers spell freely, so matching ignores case.
 */
const HL_CATEGORY_CLASSES: ReadonlyMap<string, AssetClass> = new Map([
  ["commodities", "commodity"],
  ["crypto", "crypto"],
  ["fx", "fx"],
  ["indices", "index"],
  ["preipo", "equity"],
  ["stock", "equity"],
  ["stocks", "equity"],
]);

/**
 * The declared class of a HIP-3 market, from its `perpConciseAnnotations` category.
 *
 * A category outside the table (`rates`) still says "not crypto" -- a deployer that meant crypto
 * writes `crypto`, as flx does for flx:BTC -- so the base tables settle it: para:10Y lands on index.
 * A missing annotation is read the same way. HIP-3 dexes exist to list tradfi, and on 2026-09-14
 * every live HIP-3 market was annotated; only delisted ones lacked an entry. Defaulting those to
 * crypto would put xyz:BB (BlackBerry) in BounceBit's pool.
 *
 * The core dex never comes here: its perps are validator-listed crypto and carry no annotations.
 */
export function hip3DeclaredClass(category: string | null | undefined, base: string): AssetClass {
  const declared = category ? HL_CATEGORY_CLASSES.get(category.trim().toLowerCase()) : undefined;
  return declared ?? classifyNonCrypto(base);
}

/** Coin to category. Throws on a payload that is not a list, so the caller keeps its last copy. */
export function parsePerpAnnotations(payload: HlPerpConciseAnnotations): Map<string, string> {
  if (!Array.isArray(payload)) {
    throw new Error("hyperliquid: perpConciseAnnotations is not a list");
  }
  const categories = new Map<string, string>();
  for (const entry of payload) {
    if (!Array.isArray(entry)) continue;
    const [coin, annotation] = entry;
    const category = annotation?.category;
    if (typeof coin === "string" && typeof category === "string") categories.set(coin, category);
  }
  return categories;
}

export interface HlAnnotationCache {
  /** Coin to category: the last good copy, refreshed first when due. Never throws. */
  categories(client: HttpClient, now: number): Promise<ReadonlyMap<string, string>>;
}

/**
 * One `perpConciseAnnotations` response covers every HIP-3 dex, so all HIP-3 adapters share one of
 * these: a single request per ANNOTATIONS_MAX_AGE_MS for the whole group, not one per dex per sweep.
 *
 * A failed or empty refresh keeps the last good copy and tries again after ANNOTATIONS_RETRY_MS. It
 * never fails the sweep: before any copy has loaded, every HIP-3 market falls back to the
 * missing-annotation rule in `hip3DeclaredClass`.
 */
export function createAnnotationCache(): HlAnnotationCache {
  let current: ReadonlyMap<string, string> = new Map();
  let refreshAt = 0;
  let pending: Promise<void> | null = null;

  async function refresh(client: HttpClient, now: number): Promise<void> {
    try {
      const parsed = parsePerpAnnotations(
        await client.postJson<HlPerpConciseAnnotations>(HYPERLIQUID_INFO_URL, {
          type: "perpConciseAnnotations",
        }),
      );
      // An empty list is a broken response, not a venue with no markets.
      if (parsed.size === 0) throw new Error("hyperliquid: perpConciseAnnotations is empty");
      current = parsed;
      refreshAt = now + ANNOTATIONS_MAX_AGE_MS;
    } catch {
      refreshAt = now + ANNOTATIONS_RETRY_MS;
    }
  }

  return {
    async categories(client, now) {
      if (now >= refreshAt) {
        // Adapters in the group can overlap; they wait on the same request rather than each sending one.
        pending ??= refresh(client, now).finally(() => {
          pending = null;
        });
        await pending;
      }
      return current;
    },
  };
}

/**
 * Risk ladders from `meta.marginTables`, which arrives in a call the collector already makes.
 *
 * Hyperliquid shares a handful of tables across every asset (seven cover 234 coins), so an asset
 * points at one by `marginTableId`. A tier gives only a `lowerBound` in USD notional and a max
 * leverage, so each band ends where the next begins and the top one is genuinely unbounded —
 * Hyperliquid publishes no maximum position size, unlike Bybit and OKX.
 *
 * There is no published margin rate, so `imr` is the reciprocal of the leverage cap.
 */
export function parseHyperliquidMarginTables(venueId: string, meta: HlMeta): LeverageTier[] {
  const tables = new Map(meta.marginTables ?? []);
  const ladders: LeverageTier[] = [];

  for (const asset of meta.universe) {
    if (asset.isDelisted || asset.marginTableId === undefined) continue;
    const table = tables.get(asset.marginTableId);
    // An asset can name a table the response didn't carry; it gets no ladder rather than a guess.
    if (!table || table.marginTiers.length === 0) continue;

    const sorted = [...table.marginTiers].sort(
      (a, b) => Number(a.lowerBound) - Number(b.lowerBound),
    );
    const ladder: LeverageTier[] = [];
    let usable = true;

    for (let i = 0; i < sorted.length; i++) {
      const step = sorted[i] as HlMarginTier;
      const lower = num(step.lowerBound);
      const maxLeverage = num(step.maxLeverage);
      const upper = i + 1 < sorted.length ? num(sorted[i + 1]?.lowerBound) : null;

      if (
        lower === null ||
        maxLeverage === null ||
        maxLeverage <= 0 ||
        (upper !== null && upper <= lower)
      ) {
        usable = false;
        break;
      }
      ladder.push({
        venueId,
        venueSymbol: asset.name,
        tier: i + 1,
        lowerNotionalUsd: lower,
        upperNotionalUsd: upper,
        imr: 1 / maxLeverage,
        mmr: null,
        maxLeverage,
      });
    }
    if (usable) ladders.push(...ladder);
  }
  return ladders;
}

export interface HlFundingHistoryRow {
  coin: string;
  fundingRate: string;
  premium?: string;
  time: number;
}

export type HlPerpDexs = ({ name: string; fullName?: string } | null)[];

/**
 * Normalizes `metaAndAssetCtxs`. Hyperliquid funding is an hourly rate paid every hour, so both the
 * basis and the interval are 1h. For HIP-3 dexes `funding` already includes the dex's per-asset
 * funding multiplier (`perpDexs.assetToFundingMultiplier`): with a 0.5 multiplier xyz:XYZ100 reports
 * 0.00000625, half the 0.0000125 hourly baseline, and assets with a 0.0 multiplier report 0.0.
 *
 * `categories` is the HIP-3 annotation map (see `hip3DeclaredClass`); null for the core dex, whose
 * perps are all crypto.
 */
export function parseHyperliquidSnapshots(
  venueId: string,
  payload: HlMetaAndAssetCtxs,
  now: number,
  quote: string | null = null,
  categories: ReadonlyMap<string, string> | null = null,
): FundingSnapshot[] {
  const [meta, ctxs] = payload;
  const nextFundingAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const snapshots: FundingSnapshot[] = [];

  for (let i = 0; i < meta.universe.length; i++) {
    const asset = meta.universe[i] as HlUniverseAsset;
    const ctx = ctxs[i];
    const rate = num(ctx?.funding);
    if (asset.isDelisted || !ctx || rate === null) continue;

    const assetClass = categories
      ? hip3DeclaredClass(categories.get(asset.name), parseVenueSymbol(asset.name).base)
      : "crypto";
    const markPrice = num(ctx.markPx);
    snapshots.push({
      ...marketRef(venueId, asset.name, quote ? { quote, assetClass } : { assetClass }),
      observedAt: now,
      rate,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(ctx.oraclePx),
      openInterestUsd: mul(num(ctx.openInterest), markPrice),
      volume24hUsd: num(ctx.dayNtlVlm),
      maxLeverage: num(asset.maxLeverage),
    });
  }
  return snapshots;
}

/** Names of the HIP-3 dexes listed by `perpDexs` (the first entry is the core dex, reported as null). */
export function parsePerpDexs(payload: HlPerpDexs): string[] {
  return payload.flatMap((dex) => (dex?.name ? [dex.name] : []));
}

/** Normalizes `fundingHistory` rows into settled hourly payments, oldest first. */
export function parseHyperliquidFundingHistory(
  venueId: string,
  rows: readonly HlFundingHistoryRow[],
  quote: string | null = null,
): FundingEvent[] {
  const byHour = new Map<number, FundingEvent>();
  for (const row of rows) {
    const rate = num(row.fundingRate);
    if (rate === null || !Number.isFinite(row.time)) continue;
    // Settlements are stamped a few ms after the hour; snap so repeated fetches share a key.
    const settledAt = Math.floor(row.time / HOUR_MS) * HOUR_MS;
    byHour.set(settledAt, {
      ...marketRef(venueId, row.coin, quote ? { quote } : {}),
      settledAt,
      rate,
      basisHours: 1,
      markPrice: null,
    });
  }
  return [...byHour.values()].sort((a, b) => a.settledAt - b.settledAt);
}

function createAdapter(
  venueId: string,
  dex: string | null,
  quote: string | null,
  annotations: HlAnnotationCache | null,
): VenueAdapter {
  return {
    venueId,
    // Core and every HIP-3 dex share one client: the limit is 1200 weight/min per IP and info
    // requests weigh ~20, so the whole group gets ~55 requests/min.
    rateLimitGroup: "hyperliquid",
    minIntervalMs: 1_100,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const body = dex ? { type: "metaAndAssetCtxs", dex } : { type: "metaAndAssetCtxs" };
      const payload = await client.postJson<HlMetaAndAssetCtxs>(HYPERLIQUID_INFO_URL, body);
      // After the main request, so a sweep that is failing anyway spends nothing on annotations.
      const categories = annotations ? await annotations.categories(client, now) : null;
      return {
        snapshots: parseHyperliquidSnapshots(venueId, payload, now, quote, categories),
        settled: [],
      };
    },

    async fetchLeverageTiers(client) {
      // `meta` is the same payload as the first half of metaAndAssetCtxs, so one request covers
      // the whole dex and nothing here is per-symbol.
      const body = dex ? { type: "meta", dex } : { type: "meta" };
      const meta = await client.postJson<HlMeta>(HYPERLIQUID_INFO_URL, body);
      return { tiers: parseHyperliquidMarginTables(venueId, meta), complete: true };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const rows: HlFundingHistoryRow[] = [];
      let startTime = fromMs;
      while (startTime <= toMs) {
        const page = await client.postJson<HlFundingHistoryRow[]>(HYPERLIQUID_INFO_URL, {
          type: "fundingHistory",
          coin: venueSymbol,
          startTime,
          endTime: toMs,
        });
        rows.push(...page);
        const last = page.at(-1);
        if (!last || page.length < HISTORY_PAGE_SIZE) break;
        startTime = last.time + 1;
      }
      return parseHyperliquidFundingHistory(venueId, rows, quote);
    },
  };
}

/** Core Hyperliquid perps (USDC collateral). Validator-listed crypto, so no annotations are fetched. */
export const hyperliquidAdapter: VenueAdapter = createAdapter("hyperliquid", null, "USDC", null);

/** Shared by every HIP-3 adapter: one annotations response covers all dexes. */
const hip3Annotations = createAnnotationCache();

/** A HIP-3 builder-deployed dex; venue id `hl-<dex>`, coins named `<dex>:<SYMBOL>`. */
export function createHip3Adapter(
  dex: string,
  annotations: HlAnnotationCache = hip3Annotations,
): VenueAdapter {
  return createAdapter(`hl-${dex}`, dex, null, annotations);
}
