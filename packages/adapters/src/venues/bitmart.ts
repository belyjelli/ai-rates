import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  type MarketRef,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "bitmart";
const BASE_URL = "https://api-cloud-v2.bitmart.com/contract/public";
const OK = 1000;
/** `product_type` 1 is a perpetual (2 would be a dated future); every row was 1 on 2026-09-14. */
const PERPETUAL = 1;
/** `funding-rate-history` caps `limit` at 100 (1000 answers 100) and has no way to page further. */
const HISTORY_LIMIT = 100;

export interface BitmartEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface BitmartTradfiInfo {
  /**
   * The market a tradfi contract follows: US_MARKET, HK_STOCK, FOREX, INDEX_{JP,HK,KR,UK,AU,TW,DE},
   * METAL_LME, COMMODITY_{CME,ICE} and PRE_LIST on 2026-09-14.
   */
  market_group?: string;
}

export interface BitmartContract {
  symbol: string;
  product_type: number;
  base_currency: string;
  /** Settlement currency: USDT, USDC, or USD on the coin-margined inverse contracts. */
  quote_currency: string;
  index_price: string;
  /** Base units per contract. */
  contract_size: string;
  /** Open interest in contracts. */
  open_interest: string;
  /** Quote currency. */
  turnover_24h: string;
  /** Estimate for the settlement at `funding_time`. */
  expected_funding_rate: string;
  /** Epoch ms of the next settlement. */
  funding_time: number;
  funding_interval_hours: number;
  max_leverage?: string;
  status: string;
  /** Epoch SECONDS; 0 when none is scheduled. */
  delist_time: number;
  /** Null on crypto contracts. */
  tradfi_info?: BitmartTradfiInfo | null;
}

export interface BitmartFundingHistoryItem {
  symbol: string;
  funding_rate: string;
  /** Epoch ms of the settlement. */
  funding_time: string;
}

function unwrap<T>(json: BitmartEnvelope<T>, what: string): T {
  if (json?.code !== OK || json.data === null || typeof json.data !== "object") {
    throw new Error(`bitmart ${what}: ${json?.code} ${json?.message ?? ""}`);
  }
  return json.data;
}

/**
 * The class BitMart declares for a contract, from `tradfi_info.market_group` on /details.
 *
 * `tradfi_info` is null on every crypto contract and set on every tradfi one. Live 2026-09-14, of
 * 228 tradable contracts: none on 151; US_MARKET 49 (shares, ETFs, and SPX500, NAS100, US30 and
 * US2000, which `marketRef` refines to index); HK_STOCK 14; FOREX 5 (EUR, JPY, GBP, TRY, BRL);
 * INDEX_JP 2, INDEX_KR 2, INDEX_HK 1, INDEX_TW 1 (JPN225 and TW88 stay index; KIOXIA, SKHYNIX, HPSP
 * and TRAHK are single names and refine to equity); METAL_LME 3 (XNI, XCU, XAL). That comes out as
 * crypto 151, equity 63, index 6, fx 5, commodity 3.
 *
 * BitMart attaches no tradfi_info to XAUUSDT, XAGUSDT, PAXGUSDT, XAUTUSDT or CLUSDT, so gold, silver
 * and crude are crypto here, by the venue's own declaration. A group this does not know is still
 * tradfi.
 */
export function bitmartAssetClass(
  tradfi: BitmartTradfiInfo | null | undefined,
  base: string,
): AssetClass {
  if (!tradfi) return "crypto";
  const group = tradfi.market_group ?? "";
  if (group === "US_MARKET" || group === "HK_STOCK") return "equity";
  if (group === "FOREX") return "fx";
  if (group.startsWith("INDEX_")) return "index";
  if (group.startsWith("METAL_") || group.startsWith("COMMODITY_")) return "commodity";
  return classifyNonCrypto(canonicalBase(base));
}

/**
 * Live USDT- and USDC-margined perpetuals.
 *
 * Live 2026-09-14, 1,215 rows: 856 Delisted and 359 Trading. Of the Trading ones, 127 carry a
 * `delist_time` in the past (all 2026-07-25) and are dead: zero turnover on every one, and empty
 * books on THETAUSDT, ARBUSDT, HK50USDT and TENCENTUSDT. Four more are coin-margined inverse
 * contracts quoted in USD (BTCUSD, ETHUSD, XRPUSD, SOLUSD, 10-100 USD a contract). That leaves 228:
 * 227 USDT and BTCUSDC. A future `delist_time` is still trading and stays in.
 */
export function isBitmartTradable(contract: BitmartContract, now: number): boolean {
  return (
    contract.status === "Trading" &&
    contract.product_type === PERPETUAL &&
    (contract.quote_currency === "USDT" || contract.quote_currency === "USDC") &&
    !(contract.delist_time > 0 && contract.delist_time * 1000 <= now)
  );
}

/**
 * Every tradable contract from the one bulk /details response.
 *
 * The rate is `expected_funding_rate`, the estimate for `funding_time`. The row's `funding_rate` is
 * not used: it is neither that estimate nor the last settlement. Measured 2026-09-14 against the
 * per-symbol /funding-rate, whose `expected_rate` matches `expected_funding_rate` (SOL 0.0000725,
 * DOGE 0.0000631, AXS 0.00005) and whose `rate_value` matches the newest /funding-rate-history row
 * (SOL 0.0001, DOGE 0.0004), `funding_rate` read -0.0000111 for SOL and -0.0000034 for DOGE.
 *
 * /details carries no mark price and there is no bulk endpoint that does (only a per-symbol mark
 * kline), so `markPrice` is null and open interest is priced at the index.
 */
export function parseBitmartSnapshots(
  json: BitmartEnvelope<{ symbols: BitmartContract[] }>,
  now: number,
): SnapshotBatch {
  const { symbols } = unwrap(json, "details");
  if (!Array.isArray(symbols)) throw new Error("bitmart details: expected a symbol list");

  const snapshots: FundingSnapshot[] = [];
  for (const contract of symbols) {
    if (!isBitmartTradable(contract, now)) continue;
    const rate = num(contract.expected_funding_rate);
    const hours = num(contract.funding_interval_hours);
    if (rate === null || hours === null || hours <= 0) continue;

    const { base } = marketRef(VENUE_ID, contract.symbol);
    const indexPrice = num(contract.index_price);
    const next = num(contract.funding_time);
    snapshots.push({
      ...marketRef(VENUE_ID, contract.symbol, {
        quote: contract.quote_currency,
        assetClass: bitmartAssetClass(contract.tradfi_info, base),
      }),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice: null,
      indexPrice,
      // Contracts x base units per contract x price. BTCUSDT: 2,056,722 x 0.001 BTC x 77,296 =
      // $159.0m. `open_interest_value` ($155.0m there) is not used: on 179 contracts it sits 0.68x
      // to 1.55x off contracts x size x price -- BCHUSDT implies $329 a coin at a $224 price -- which
      // reads as entry notional, not the value of the open positions now.
      openInterestUsd: mul(num(contract.open_interest), num(contract.contract_size), indexPrice),
      // Quote turnover: BTCUSDT's 1,544,041,296 is 20,047,458 contracts x 0.001 x ~77,250.
      volume24hUsd: num(contract.turnover_24h),
      maxLeverage: num(contract.max_leverage),
    });
  }
  return { snapshots, settled: [] };
}

/**
 * Settled funding inside [fromMs, toMs], oldest first, with the interval inferred from every row
 * fetched so a one-event window still gets a basis.
 */
export function parseBitmartFundingHistory(
  ref: MarketRef,
  items: readonly BitmartFundingHistoryItem[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
): FundingEvent[] {
  const rates = new Map<number, number>();
  for (const item of items) {
    const settledAt = num(item.funding_time);
    const rate = num(item.funding_rate);
    if (settledAt !== null && settledAt > 0 && rate !== null) rates.set(settledAt, rate);
  }
  const basisHours = inferIntervalHours([...rates.keys()]) ?? fallbackHours;
  if (basisHours === null) return [];

  return [...rates]
    .filter(([settledAt]) => settledAt >= fromMs && settledAt <= toMs)
    .sort((a, b) => a[0] - b[0])
    .map(([settledAt, rate]) => ({ ...ref, settledAt, rate, basisHours, markPrice: null }));
}

function refOf(snapshot: FundingSnapshot): MarketRef {
  const { venueId, venueSymbol, base, assetClass, quote, multiplier, dex } = snapshot;
  return { venueId, venueSymbol, base, assetClass, quote, multiplier, dex };
}

/** BitMart's USDT- and USDC-margined perpetuals: one request a cycle. */
export function createBitmartAdapter(): VenueAdapter {
  let known = new Map<string, { ref: MarketRef; intervalHours: number | null }>();

  return {
    venueId: VENUE_ID,
    // Public contract endpoints answer `x-bm-ratelimit-limit: 12`, `x-bm-ratelimit-reset: 2`,
    // mode IP: 12 requests per 2 seconds. One request each 200ms is 10 per 2 seconds.
    minIntervalMs: 200,

    async fetchSnapshots(client: HttpClient, now: number) {
      const batch = parseBitmartSnapshots(
        await client.getJson<BitmartEnvelope<{ symbols: BitmartContract[] }>>(
          `${BASE_URL}/details`,
        ),
        now,
      );
      known = new Map(
        batch.snapshots.map((s) => [
          s.venueSymbol,
          { ref: refOf(s), intervalHours: s.intervalHours },
        ]),
      );
      return batch;
    },

    /**
     * The newest 100 settlements, cut to the window. `start_time` and `end_time` are ignored (a
     * 2026-06 window answered with the latest five) and `limit` stops at 100, so this reaches back
     * 100 intervals -- 33 days at 8h, four at 1h -- and a backfill older than that gets nothing,
     * which the collector records as the venue's limit. Coverage can also be stale: ESPORTSUSDT,
     * settling hourly on 2026-09-14, had no history row after 2026-07-30.
     */
    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const json = await client.getJson<BitmartEnvelope<{ list: BitmartFundingHistoryItem[] }>>(
        `${BASE_URL}/funding-rate-history?symbol=${encodeURIComponent(venueSymbol)}&limit=${HISTORY_LIMIT}`,
      );
      const list = unwrap(json, "funding history").list ?? [];
      const market = known.get(venueSymbol);
      return parseBitmartFundingHistory(
        market?.ref ?? marketRef(VENUE_ID, venueSymbol),
        list,
        fromMs,
        toMs,
        market?.intervalHours ?? null,
      );
    },
  };
}

export const bitmartAdapter = createBitmartAdapter();
