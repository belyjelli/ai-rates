import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

export const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

const HOUR_MS = 3_600_000;
const HISTORY_PAGE_SIZE = 500;

interface HlUniverseAsset {
  name: string;
  isDelisted?: boolean;
  /** Headline leverage. `meta.marginTables` carries the full ladder in this same response (B1). */
  maxLeverage?: number | null;
}

interface HlAssetCtx {
  funding?: string | null;
  openInterest?: string | null;
  markPx?: string | null;
  oraclePx?: string | null;
  dayNtlVlm?: string | null;
}

export type HlMetaAndAssetCtxs = [{ universe: HlUniverseAsset[] }, HlAssetCtx[]];

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
 */
export function parseHyperliquidSnapshots(
  venueId: string,
  payload: HlMetaAndAssetCtxs,
  now: number,
  quote: string | null = null,
): FundingSnapshot[] {
  const [meta, ctxs] = payload;
  const nextFundingAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const snapshots: FundingSnapshot[] = [];

  for (let i = 0; i < meta.universe.length; i++) {
    const asset = meta.universe[i] as HlUniverseAsset;
    const ctx = ctxs[i];
    const rate = num(ctx?.funding);
    if (asset.isDelisted || !ctx || rate === null) continue;

    const markPrice = num(ctx.markPx);
    snapshots.push({
      ...marketRef(venueId, asset.name, quote ? { quote } : {}),
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

function createAdapter(venueId: string, dex: string | null, quote: string | null): VenueAdapter {
  return {
    venueId,
    // Core and every HIP-3 dex share one client: the limit is 1200 weight/min per IP and info
    // requests weigh ~20, so the whole group gets ~55 requests/min.
    rateLimitGroup: "hyperliquid",
    minIntervalMs: 1_100,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const body = dex ? { type: "metaAndAssetCtxs", dex } : { type: "metaAndAssetCtxs" };
      const payload = await client.postJson<HlMetaAndAssetCtxs>(HYPERLIQUID_INFO_URL, body);
      return { snapshots: parseHyperliquidSnapshots(venueId, payload, now, quote), settled: [] };
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

/** Core Hyperliquid perps (USDC collateral). */
export const hyperliquidAdapter: VenueAdapter = createAdapter("hyperliquid", null, "USDC");

/** A HIP-3 builder-deployed dex; venue id `hl-<dex>`, coins named `<dex>:<SYMBOL>`. */
export function createHip3Adapter(dex: string): VenueAdapter {
  return createAdapter(`hl-${dex}`, dex, null);
}
