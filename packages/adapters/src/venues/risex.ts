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
 * RISEx (RiseX), on RISE Chain.
 *
 * REQUESTS: one per cycle, `GET /v1/markets`, every market with funding, prices, OI and volume inline
 * (the server caches it for 5 minutes; `cached_at` moved between reads 5 minutes apart). The limit is
 * "REST: 500 requests/10s" per IP (https://developer.rise.trade/reference/general-information), so
 * 100ms spacing is far inside it.
 *
 * NANOSECONDS: "All time and timestamp related fields are in nanoseconds unless explicitly defined
 * otherwise" (same page). `funding_interval` "3600000000000" is one hour; `next_funding_time`
 * "1789340400000000000" is 2026-09-13T23:00:00Z. Both exceed 2^53, so they are converted through BigInt.
 *
 * FUNDING: hourly, as a fraction, positive means longs pay. "Funding is paid every hour, and computed on
 * an 8-hour rate", F = clamp((P + interest) / 8, +/-4%) (https://docs.risechain.com/docs/risex/trading/funding).
 * `current_funding_rate` is that hourly F, and `funding_rate_8h` is documented as "current_funding_rate
 * x 8" (checked: BTC 0.000004719244490803 x 8 = 0.000037753955926424). `predicted_funding_rate` is
 * "Deprecated" and read "0" on all 32 markets. The quiet-market floor is 0.0000125 per hour (ONDO), the
 * 0.01%/8h interest leg.
 *
 * KIND: `current_funding_rate` is the LAST SETTLED rate, not an estimate, so snapshots are `settled`.
 * Measured 2026-09-13: at 22:28 and 22:33 BTC read 0.000004719244490803 in both, AERO and SNDK were
 * likewise unchanged, and that is exactly the `funding_rate` of the 22:00 settlement record in
 * `/v1/markets/id/1/funding-rate-history` (period 21:00-22:00, `end_time` 22:00). Polled every minute to
 * the hour, it still read 0.000004719244490803 at 22:59:33 (SNDK 0.000290564882876973); at 23:00:30 BTC
 * read 0.000018317170082382 and SNDK -0.000195857364862654, and at 23:02 the history's new 23:00 records
 * held exactly those two values while `next_funding_time` had advanced to 00:00. The rate therefore
 * changes only at settlement and always equals the latest record. It is also returned as a `settled`
 * event at `next_funding_time - funding_interval`, which is that record's `end_time` exactly.
 * Cross-checked against Hyperliquid the same minute: BTC 0.0000047/h (4.1% APR) against 0.0000116/h,
 * ETH 0.0000167/h against 0.0000125/h. A factor of 8 would put ETH at 117% APR.
 *
 * UNITS, checked live: `open_interest` is base units (BTC 145.39 x mark 76,794 = $11.2M; ETH 2,456.0 x
 * 2,479.6 = $6.1M), so OI USD = OI x mark. `quote_volume_24h` is USDC (BTC $16.7M). `mark_price` and
 * `index_price` are both "from oracle" and both published.
 *
 * TRADABILITY: `active` ("when false the market is disabled off-chain ... its orders rejected"),
 * `config.unlocked`, and neither `reduce_only` nor `post_only`. On 2026-09-13, 30 of 32 qualified: ONDO
 * (inactive, post-only) and a deprecated duplicate `DOGE/USDC [deprecated-1779958099]` are not collected.
 *
 * CLASS, declared by `category`: crypto 15, stocks 7, commodity 4 (XAU, XAG, CL, BZ), index_etf 4 among
 * the 30 live markets (the deprecated DOGE row has ""). `stocks` is equity; `index_etf` (DRAM, QQQ,
 * SPY, KORU) is passed as index for core's table, which files those four ETFs as equity, so snapshots
 * carry crypto 15, equity 11, commodity 4. An unknown value is tradfi of an unknown kind, placed by
 * `classifyNonCrypto`; "" is crypto.
 *
 * QUOTE: USDC, the declared `quote_asset_symbol` on every market (`config.quote` is the USDC token
 * address, "usually USDC" per the schema).
 *
 * BASE: the parser reads `config.name` (`BTC/USDC`) and agrees with every live market's pair. There is no
 * bare declared base: `base_asset_symbol` and `underlying` both hold the pair ("BTC/USDC"), despite the
 * schema's example of "BTC". XAU and CL are already canonical; SNDK, MSTR and friends parse as named.
 */

const VENUE = "risex";
export const RISEX_API = "https://api.rise.trade/v1";
const NS_PER_MS = 1_000_000n;
const HOUR_MS = 3_600_000;
const FUNDING_BASIS_HOURS = 1;
const QUOTE = "USDC";
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 50;

export interface RisexMarket {
  market_id: string;
  config: {
    name: string;
    max_leverage?: string;
    unlocked?: boolean;
  };
  quote_asset_symbol?: string;
  category?: string;
  mark_price?: string;
  index_price?: string;
  /** Base units. */
  open_interest?: string;
  quote_volume_24h?: string;
  /** Nanoseconds. */
  funding_interval?: string;
  /** Unix nanoseconds. */
  next_funding_time?: string;
  /** Last settled hourly rate. */
  current_funding_rate?: string;
  funding_rate_8h?: string;
  active?: boolean;
  post_only?: boolean;
  reduce_only?: boolean;
}

export interface RisexMarketsResponse {
  data: { markets: RisexMarket[]; cached_at?: string };
}

export interface RisexFundingRecord {
  funding_rate: string;
  /** Unix nanoseconds. */
  start_time: string;
  /** Unix nanoseconds: the settlement. */
  end_time: string;
}

export interface RisexFundingHistoryResponse {
  data: { market_id: string; records: RisexFundingRecord[]; page: number; has_next_page: boolean };
}

/** Nanoseconds (as a decimal string or number) to whole milliseconds, or null. */
export function nsToMs(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const ns = BigInt(typeof value === "number" ? Math.trunc(value) : value.trim());
    return ns > 0n ? Number(ns / NS_PER_MS) : null;
  } catch {
    return null;
  }
}

/** The class RiseX declares in `category`: crypto, stocks, commodity or index_etf. */
export function risexAssetClass(category: string | null | undefined, base: string): AssetClass {
  switch (category?.trim().toLowerCase() ?? "") {
    case "":
    case "crypto":
      return "crypto";
    case "stocks":
      return "equity";
    case "commodity":
      return "commodity";
    case "index_etf":
      return "index";
    default:
      return classifyNonCrypto(base);
  }
}

export function isRisexTradable(market: RisexMarket): boolean {
  return (
    market.active === true &&
    market.config?.unlocked !== false &&
    market.post_only !== true &&
    market.reduce_only !== true
  );
}

function ref(market: Pick<RisexMarket, "config" | "category">) {
  const parsed = marketRef(VENUE, market.config.name);
  return marketRef(VENUE, market.config.name, {
    quote: QUOTE,
    assetClass: risexAssetClass(market.category, parsed.base),
  });
}

export function parseRisexMarkets(body: RisexMarketsResponse, now: number): SnapshotBatch {
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];
  for (const market of body.data.markets) {
    const rate = num(market.current_funding_rate);
    if (!market.config?.name || !isRisexTradable(market) || rate === null) continue;

    const base = ref(market);
    const intervalMs = nsToMs(market.funding_interval);
    const nextFundingAt = nsToMs(market.next_funding_time);
    const markPrice = num(market.mark_price);
    snapshots.push({
      ...base,
      observedAt: now,
      rate,
      basisHours: FUNDING_BASIS_HOURS,
      intervalHours: intervalMs !== null ? intervalMs / HOUR_MS : null,
      nextFundingAt,
      kind: "settled",
      markPrice,
      indexPrice: num(market.index_price),
      openInterestUsd: mul(num(market.open_interest), markPrice),
      volume24hUsd: num(market.quote_volume_24h),
      maxLeverage: num(market.config.max_leverage),
    });
    if (nextFundingAt !== null && intervalMs !== null) {
      settled.push({
        ...base,
        settledAt: nextFundingAt - intervalMs,
        rate,
        basisHours: FUNDING_BASIS_HOURS,
        markPrice: null,
      });
    }
  }
  return { snapshots, settled };
}

/** Settlements within [fromMs, toMs], oldest first, stamped at each period's `end_time`. */
export function parseRisexFundingHistory(
  records: readonly RisexFundingRecord[],
  market: Pick<RisexMarket, "config" | "category">,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(market);
  const bySettlement = new Map<number, FundingEvent>();
  for (const record of records) {
    const settledAt = nsToMs(record.end_time);
    const rate = num(record.funding_rate);
    if (settledAt === null || rate === null || settledAt < fromMs || settledAt > toMs) continue;
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

export function createRisexAdapter(): VenueAdapter {
  /** config.name -> market, for history, which is addressed by numeric id. */
  const byName = new Map<string, RisexMarket>();

  async function fetchMarkets(client: HttpClient): Promise<RisexMarketsResponse> {
    const body = await client.getJson<RisexMarketsResponse>(`${RISEX_API}/markets`);
    if (!Array.isArray(body?.data?.markets))
      throw new Error(`${VENUE}: unexpected markets response`);
    for (const market of body.data.markets) {
      if (market.config?.name) byName.set(market.config.name, market);
    }
    return body;
  }

  return {
    venueId: VENUE,
    minIntervalMs: 100,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      return parseRisexMarkets(await fetchMarkets(client), now);
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      if (!byName.has(venueSymbol)) await fetchMarkets(client);
      const market = byName.get(venueSymbol);
      if (!market) return [];
      const records: RisexFundingRecord[] = [];
      // end_time is exclusive; start_time inclusive. Both nanoseconds.
      const range = `start_time=${BigInt(fromMs) * NS_PER_MS}&end_time=${(BigInt(toMs) + 1n) * NS_PER_MS}`;
      for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
        const url = `${RISEX_API}/markets/id/${encodeURIComponent(market.market_id)}/funding-rate-history?${range}&page=${page}&limit=${HISTORY_PAGE_SIZE}`;
        const body = await client.getJson<RisexFundingHistoryResponse>(url);
        const batch = body?.data?.records;
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected funding-rate-history`);
        records.push(...batch);
        if (!body.data.has_next_page || batch.length === 0) break;
      }
      return parseRisexFundingHistory(records, market, fromMs, toMs);
    },
  };
}

export const risexAdapter: VenueAdapter = createRisexAdapter();
