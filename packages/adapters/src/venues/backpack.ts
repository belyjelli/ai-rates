import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Backpack Exchange perpetuals.
 *
 * REQUESTS: three per cycle, all bulk: `GET /api/v1/markPrices` (funding, mark, index, next funding
 * for every perp), `GET /api/v1/openInterest` (every perp) and `GET /api/v1/tickers` (24h volume, spot
 * rows included), plus `GET /api/v1/markets` once an hour for type, order-book state, class and
 * interval. No per-symbol call exists or is needed. Limits are "2000 requests per minute across
 * standard REST endpoints" and "30 requests per minute" for historical market data
 * (https://support.backpack.exchange/exchange/api-and-developer-docs/faqs). Funding history is
 * time-range data, so the client is spaced at 2s: a cycle costs ~6s, and a history backfill cannot
 * breach the 30/minute bucket.
 *
 * FUNDING: hourly, as a fraction, positive means longs pay. All perps moved to hourly settlement on
 * 2025-08-20 and the daily rate is divided "by 24 instead of 3"
 * (https://support.backpack.exchange/technical-docs/trading/futures-specs,
 * https://learn.backpack.exchange/articles/hourly-funding-and-real-time-yield); `fundingInterval` is
 * 3,600,000 ms on every live perp. `markPrices.fundingRate` is the rate accruing for the current hour,
 * so `predicted`: BTC read 0.00000080694 at 22:28 and 0.00000089745 at 22:33, and the history row for
 * the 23:00 interval, already present at 22:28, moved from 0.000000724 to 0.000001254 before it ended.
 * The last `markPrices` reading before the hour (22:59:33) against the settled 23:00 row: BTC
 * 0.00000214 against 0.00000216, ETH 0.00001238 against 0.000012403, KMNO -0.00025959 against
 * -0.000259381. By 23:02 the history's newest row was already the 00:00 interval.
 * The rates are hourly and not 8- or 24-hour: quiet perps sit on 0.0000125 (the 0.01%/8h floor, per
 * hour) and equities on 0.00000625; ETH 0.0000121/h matched Hyperliquid's 0.0000125 the same minute,
 * BTC's 0.0000008 was below Hyperliquid's 0.0000116 while its 22:00 settlement was 0.0000083.
 *
 * UNITS, checked live 2026-09-13: `openInterest` is base units (BTC 412.67 x mark 76,746 = $31.7M; ETH
 * 4,989.66 x 2,478 = $12.4M), so OI USD = OI x mark. `tickers.quoteVolume` is 24h volume in USDC (BTC
 * $126.0M = 1,634.9 BTC x ~$77k). `nextFundingTimestamp` is epoch ms.
 *
 * TRADABILITY: `marketType` PERP and `orderBookState` Open. On 2026-09-13, of 102 perps: 89 Open, 11
 * Closed (IP, TON, FLOCK, ...) and 2 PostOnly (AMZN.US, AMD.US, which the specs say "use the index
 * price as the mark price" and which are not visible). `/openInterest` also returns 6
 * `*_USDC_PREDICTION` rows (FDVEXTD1B, ...): prediction contracts with no market entry, never collected.
 *
 * CLASS, declared by `rwaMarketType`: null on the 74 Open crypto perps, STOCK on 12 and INDEX on 3
 * (QQQ.US, SPY.US, DRAM.US). INDEX goes to `marketRef` as index and core's table files those three ETFs
 * as equity. Any other non-null value is tradfi of an unknown kind, placed by `classifyNonCrypto`.
 *
 * QUOTE: USDC. `quoteSymbol` is USDC on every perp, and "markets are denominated and settled in USDC"
 * (futures specs).
 *
 * BASE: the parser agrees with `baseSymbol` on all 102 perps. It reads `kPEPE`, `kBONK` and `kSHIB` as
 * x1000 contracts, which is what they are. Equities keep the venue's `.US` suffix (`MU.US`), as declared
 * in both the symbol and `baseSymbol`; they therefore do not pool with MU elsewhere until core aliases
 * them, which is core's decision and not this adapter's.
 */

const VENUE = "backpack";
export const BACKPACK_API = "https://api.backpack.exchange/api/v1";
const HOUR_MS = 3_600_000;
const FUNDING_BASIS_HOURS = 1;
const QUOTE = "USDC";
const MARKETS_TTL_MS = HOUR_MS;
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 50;

export interface BackpackMarket {
  symbol: string;
  baseSymbol?: string;
  quoteSymbol?: string;
  marketType: string;
  orderBookState: string;
  /** Milliseconds. */
  fundingInterval?: number | null;
  rwaMarketType?: string | null;
  visible?: boolean;
}

export interface BackpackMarkPrice {
  symbol: string;
  fundingRate?: string | null;
  indexPrice?: string | null;
  markPrice?: string | null;
  /** Epoch ms. */
  nextFundingTimestamp?: number | null;
}

export interface BackpackOpenInterest {
  symbol: string;
  /** Base units. */
  openInterest?: string | null;
}

export interface BackpackTicker {
  symbol: string;
  /** 24h volume in the quote asset. */
  quoteVolume?: string | null;
}

export interface BackpackFundingRate {
  symbol: string;
  fundingRate: string;
  /** UTC without a zone designator, e.g. "2026-09-13T22:00:00". */
  intervalEndTimestamp: string;
}

/** The class Backpack declares in `rwaMarketType`: null for crypto, STOCK or INDEX otherwise. */
export function backpackAssetClass(
  rwaMarketType: string | null | undefined,
  base: string,
): AssetClass {
  const declared = rwaMarketType?.trim().toUpperCase() ?? "";
  if (declared === "") return "crypto";
  if (declared === "STOCK") return "equity";
  if (declared === "INDEX") return "index";
  return classifyNonCrypto(base);
}

/** A perp with an Open order book. */
export function isBackpackTradable(market: BackpackMarket): boolean {
  return market.marketType === "PERP" && market.orderBookState === "Open";
}

function ref(market: Pick<BackpackMarket, "symbol" | "rwaMarketType">) {
  const parsed = marketRef(VENUE, market.symbol);
  return marketRef(VENUE, market.symbol, {
    quote: QUOTE,
    assetClass: backpackAssetClass(market.rwaMarketType, parsed.base),
  });
}

/** Backpack's zone-less UTC timestamp as epoch ms, or null. */
export function backpackTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function parseBackpackSnapshots(
  markets: readonly BackpackMarket[],
  markPrices: readonly BackpackMarkPrice[],
  openInterest: readonly BackpackOpenInterest[],
  tickers: readonly BackpackTicker[],
  now: number,
): FundingSnapshot[] {
  const bySymbol = new Map(markets.map((m) => [m.symbol, m]));
  const oi = new Map(openInterest.map((r) => [r.symbol, num(r.openInterest)]));
  const volume = new Map(tickers.map((t) => [t.symbol, num(t.quoteVolume)]));
  const snapshots: FundingSnapshot[] = [];
  for (const row of markPrices) {
    const market = bySymbol.get(row.symbol);
    const rate = num(row.fundingRate);
    if (!market || !isBackpackTradable(market) || rate === null) continue;

    const markPrice = num(row.markPrice);
    const intervalMs = num(market.fundingInterval);
    const next = num(row.nextFundingTimestamp);
    snapshots.push({
      ...ref(market),
      observedAt: now,
      rate,
      basisHours: FUNDING_BASIS_HOURS,
      intervalHours: intervalMs !== null && intervalMs > 0 ? intervalMs / HOUR_MS : null,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(row.indexPrice),
      openInterestUsd: mul(oi.get(row.symbol) ?? null, markPrice),
      volume24hUsd: volume.get(row.symbol) ?? null,
    });
  }
  return snapshots;
}

/**
 * Settled hourly payments within [fromMs, toMs], oldest first.
 *
 * The newest row is the interval still accruing (its `intervalEndTimestamp` is in the future and its
 * rate moves until then), so rows ending after `now` are not settlements and are dropped.
 */
export function parseBackpackFundingRates(
  rows: readonly BackpackFundingRate[],
  market: Pick<BackpackMarket, "symbol" | "rwaMarketType">,
  fromMs: number,
  toMs: number,
  now: number,
): FundingEvent[] {
  const base = ref(market);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = backpackTimestamp(row.intervalEndTimestamp);
    const rate = num(row.fundingRate);
    if (settledAt === null || rate === null || settledAt > now) continue;
    if (settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate,
      basisHours: FUNDING_BASIS_HOURS,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export function createBackpackAdapter(): VenueAdapter {
  let markets: BackpackMarket[] | null = null;
  let marketsFetchedAt = 0;

  async function loadMarkets(client: HttpClient, now: number): Promise<BackpackMarket[]> {
    if (!markets || now - marketsFetchedAt >= MARKETS_TTL_MS) {
      const body = await client.getJson<BackpackMarket[]>(`${BACKPACK_API}/markets`);
      if (!Array.isArray(body)) throw new Error(`${VENUE}: unexpected markets response`);
      markets = body;
      marketsFetchedAt = now;
    }
    return markets;
  }

  async function getArray<T>(client: HttpClient, path: string): Promise<T[]> {
    const body = await client.getJson<T[]>(`${BACKPACK_API}/${path}`);
    if (!Array.isArray(body)) throw new Error(`${VENUE}: unexpected ${path} response`);
    return body;
  }

  return {
    venueId: VENUE,
    minIntervalMs: 2000,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const listed = await loadMarkets(client, now);
      const markPrices = await getArray<BackpackMarkPrice>(client, "markPrices");
      const openInterest = await getArray<BackpackOpenInterest>(client, "openInterest");
      const tickers = await getArray<BackpackTicker>(client, "tickers");
      return {
        snapshots: parseBackpackSnapshots(listed, markPrices, openInterest, tickers, now),
        settled: [],
      };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const now = Date.now();
      const market = (await loadMarkets(client, now)).find((m) => m.symbol === venueSymbol) ?? {
        symbol: venueSymbol,
        rwaMarketType: null,
      };
      const rows: BackpackFundingRate[] = [];
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const path = `fundingRates?symbol=${encodeURIComponent(venueSymbol)}&limit=${HISTORY_PAGE_SIZE}&offset=${page * HISTORY_PAGE_SIZE}`;
        const batch = await getArray<BackpackFundingRate>(client, path);
        rows.push(...batch);
        // Newest first: stop once a page is short or reaches back past the window.
        const oldest = Math.min(
          ...batch.map(
            (r) => backpackTimestamp(r.intervalEndTimestamp) ?? Number.POSITIVE_INFINITY,
          ),
        );
        if (batch.length < HISTORY_PAGE_SIZE || oldest < fromMs) break;
      }
      return parseBackpackFundingRates(rows, market, fromMs, toMs, now);
    },
  };
}

export const backpackAdapter: VenueAdapter = createBackpackAdapter();
