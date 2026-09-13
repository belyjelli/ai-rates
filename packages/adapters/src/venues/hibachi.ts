import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Hibachi.
 *
 * REQUESTS: one per cycle, `GET /market/inventory` (~60 KB). The catalog's probe is the per-symbol
 * `/market/data/prices`, but inventory carries every market's contract spec together with its live
 * `info` (estimated funding, mark, spot, open interest, 24h volume), so nothing here is per symbol.
 * Hibachi publishes no REST rate limit (https://api-doc.hibachi.xyz, and none in the SDK); at one
 * request a minute that does not matter, and 250ms spacing covers history paging.
 *
 * FUNDING: `info.estimatedFundingRate` is a fraction for ONE hour, positive = longs pay, and
 * `predicted` -- it is the same number `/market/data/prices` names `fundingRateEstimation`, for the
 * settlement at its `nextFundingTimestamp` (the next top of the hour). Evidence, 2026-09-13:
 * - Settlements in `/market/data/funding-rates` are exactly 3,600s apart.
 * - BTC estimated 0.000006-0.000008 against Hyperliquid's 0.0000114/h the same minute, and ETH
 *   -0.000008 against 0.0000125/h. Read as 8h rates they would be 8-12x below every other venue.
 * - Sampled every minute from 22:35 UTC, the inventory value moved with the prices value
 *   (0.000007 -> 0.000013 on BTC) -- one estimate, not a settled figure -- and the last reading
 *   before the hour is what settled: BTC 0.000013 and ETH -0.000017 at 22:59, and exactly those two
 *   rates in `/market/data/funding-rates` for 23:00.
 * Inventory has no next-funding time, so `nextFundingAt` is null rather than a guessed hour.
 *
 * UNITS: `openInterestQuantity` is base units (BTC 9.11 x 76,764 = $699k). `volume24h` is USDT
 * notional: the 24 hourly `volumeNotional` klines summed to 7,566,008 for BTC against 7,503,062
 * reported, and 1,027.68 for XAG against 1,017.89 (read as base units XAG would be $65k).
 * `spotPrice` is the underlying's spot reference, published as the index.
 *
 * TRADABILITY: `contract.status` LIVE. On 2026-09-13 inventory listed 67 markets: 15 LIVE (8 CRYPTO,
 * 7 FX) and 52 CLOSED delistings. FX markets close at weekends (`nextCloseTimestamp`) but stay LIVE
 * and are kept, like other venues' off-hours equities.
 *
 * CLASS: `contract.category` is CRYPTO or FX. Hibachi files silver under FX but tags it `commodity`,
 * so FX becomes fx unless tagged commodity. Anything else not CRYPTO goes to `classifyNonCrypto`.
 *
 * QUOTE: `contract.settlementSymbol` (USDT on every market). BASE: the parser reads every one of the
 * 67 symbols (`BTC/USDT-P`) as the declared `underlyingSymbol`, so it is used unchanged.
 */

const VENUE = "hibachi";
export const HIBACHI_API = "https://data-api.hibachi.xyz";
const FUNDING_HOURS = 1;
/** `limit` above 100 is served as 100 (measured 2026-09-13). */
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 50;

export interface HibachiContract {
  symbol: string;
  category: string;
  status: string;
  settlementSymbol: string;
  underlyingSymbol: string;
}

export interface HibachiMarketInfo {
  category?: string | null;
  estimatedFundingRate?: string;
  markPrice?: string;
  spotPrice?: string;
  openInterestQuantity?: string;
  volume24h?: string;
  tags?: string[];
}

export interface HibachiInventory {
  markets: { contract: HibachiContract; info?: HibachiMarketInfo }[];
}

export interface HibachiFundingRow {
  fundingTimestamp: number;
  fundingRate: string;
  indexPrice?: string;
}

export function hibachiAssetClass(
  category: string | undefined,
  tags: readonly string[] | undefined,
  base: string,
): AssetClass {
  switch (category?.trim().toUpperCase()) {
    case "CRYPTO":
      return "crypto";
    case "FX":
      return tags?.some((t) => t.toLowerCase() === "commodity") ? "commodity" : "fx";
    default:
      return classifyNonCrypto(base);
  }
}

function ref(contract: HibachiContract, tags: readonly string[] | undefined) {
  const parsed = marketRef(VENUE, contract.symbol);
  return marketRef(VENUE, contract.symbol, {
    quote: contract.settlementSymbol,
    assetClass: hibachiAssetClass(contract.category, tags, parsed.base),
  });
}

export function parseHibachiInventory(body: HibachiInventory, now: number): FundingSnapshot[] {
  const snapshots: FundingSnapshot[] = [];
  for (const { contract, info } of body.markets) {
    const rate = num(info?.estimatedFundingRate);
    const markPrice = num(info?.markPrice);
    if (contract.status !== "LIVE" || !info || rate === null || markPrice === null) continue;
    snapshots.push({
      ...ref(contract, info.tags),
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt: null,
      kind: "predicted",
      markPrice,
      indexPrice: num(info.spotPrice),
      openInterestUsd: mul(num(info.openInterestQuantity), markPrice),
      volume24hUsd: num(info.volume24h),
    });
  }
  return snapshots;
}

/** Hourly settlements within [fromMs, toMs], oldest first. `fundingTimestamp` is epoch seconds. */
export function parseHibachiFunding(
  rows: readonly HibachiFundingRow[],
  contract: HibachiContract,
  tags: readonly string[] | undefined,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(contract, tags);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const seconds = num(row.fundingTimestamp);
    const rate = num(row.fundingRate);
    if (seconds === null || rate === null) continue;
    const settledAt = Math.round(seconds * 1000);
    if (settledAt < fromMs || settledAt > toMs) continue;
    // The row's price is the index, not the mark, so it is not stored as one.
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate,
      basisHours: FUNDING_HOURS,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export function createHibachiAdapter(): VenueAdapter {
  /** Contract and tags for history, remembered from the last inventory. */
  const contracts = new Map<string, { contract: HibachiContract; tags?: string[] }>();

  return {
    venueId: VENUE,
    minIntervalMs: 250,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const body = await client.getJson<HibachiInventory>(`${HIBACHI_API}/market/inventory`);
      if (!Array.isArray(body?.markets)) throw new Error(`${VENUE}: unexpected inventory response`);
      for (const m of body.markets) {
        contracts.set(m.contract.symbol, { contract: m.contract, tags: m.info?.tags });
      }
      return { snapshots: parseHibachiInventory(body, now), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      // Oldest first within [startTime, endTime] (both epoch seconds, inclusive), paged by offset.
      const rows: HibachiFundingRow[] = [];
      const window = `startTime=${Math.floor(fromMs / 1000)}&endTime=${Math.floor(toMs / 1000)}`;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const url = `${HIBACHI_API}/market/data/funding-rates?symbol=${encodeURIComponent(venueSymbol)}&${window}&limit=${HISTORY_PAGE_SIZE}&offset=${page * HISTORY_PAGE_SIZE}`;
        const body = await client.getJson<{ data: HibachiFundingRow[] }>(url);
        if (!Array.isArray(body?.data)) throw new Error(`${VENUE}: unexpected funding response`);
        rows.push(...body.data);
        if (body.data.length < HISTORY_PAGE_SIZE) break;
      }
      const known = contracts.get(venueSymbol);
      const contract: HibachiContract = known?.contract ?? {
        symbol: venueSymbol,
        category: "CRYPTO",
        status: "LIVE",
        settlementSymbol: "USDT",
        underlyingSymbol: marketRef(VENUE, venueSymbol).base,
      };
      return parseHibachiFunding(rows, contract, known?.tags, fromMs, toMs);
    },
  };
}

export const hibachiAdapter: VenueAdapter = createHibachiAdapter();
