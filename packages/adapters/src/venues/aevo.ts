import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Aevo.
 *
 * REQUESTS: two per cycle, both bulk. `GET /markets?instrument_type=PERPETUAL` (~40 KB: class,
 * activity, mark and index for every perp) and `GET /coingecko-statistics` (funding, open interest,
 * 24h volume and next funding time for every perp, active or not). The catalog's `/funding` is per
 * instrument, and it is not needed: on 2026-09-13 the statistics `funding_rate` equalled `/funding`
 * on BTC, ETH, SOL, XAU and USDJPY, and H100 differed by 1e-6 between two calls a second apart.
 * The markets list is fetched every cycle rather than hourly because it carries the only mark price.
 * Aevo documents that public endpoints are limited per IP with a 429 and `X-RETRY-AFTER`
 * (https://api-docs.aevo.xyz/reference/rate-limits-1) but publishes no number; 250ms spacing.
 *
 * FUNDING: `funding_rate` is a fraction for ONE hour, positive = longs pay, `predicted`. Aevo's
 * funding page (https://docs.aevo.xyz/aevo-products/aevo-exchange/technical-architecture/perpetual-futures-funding-rate)
 * says "The funding payments are made every 1 hour" and computes "Capped 1H Funding Rate = Capped
 * 8H Funding Rate / Funding Interval"; `/funding` is "the current funding rate" for `next_epoch`.
 * The per-hour reading checks out live: the resting interest component is 0.01%/8h, i.e. 0.0000125/h,
 * and MSTR, USDJPY and MELANIA sat at 0.000013 while BTC read 0.000008 against Hyperliquid's
 * 0.0000114/h. Hourly settlements are 3,600s apart in `/funding-history`, and the published value is
 * what settles: BTC and ETH both read 0.000008 at 22:59 UTC on 2026-09-13 and both settled 0.000008
 * at 23:00.
 *
 * UNITS: `open_interest` is base units whatever the spec says ("in USDC terms"): BTC 26.2 equals
 * `/instrument/BTC-PERP`'s `total_oi` of 26.2 contracts, which is $2.0M at the mark and would be $26
 * as dollars; 1000PEPE's 28,270,400 is contracts too. `target_volume` is USD: BTC 1,889,388 against
 * `/instrument`'s `daily_volume` 1,894,302 (24.58 contracts x ~77k). `next_funding_rate_timestamp`
 * is epoch seconds (the statistics call), where `/funding` and history use nanoseconds.
 *
 * TRADABILITY: `instrument_type` PERPETUAL and `is_active`. On 2026-09-13 `/markets` listed 99 active
 * perps (and 2,522 options); the statistics call listed 239 perps, 140 of them delisted and missing
 * `next_funding_rate_timestamp`. Only the 99 are emitted.
 *
 * CLASS: `market_type` as declared -- crypto 54, equity 32, commodity 5, etf 4, pre_ipo 2, fx 1,
 * compute 1. ETFs and pre-IPO shares are equity (`marketRef` then files index bases as index);
 * `compute` (H100, GPU rental) and any future non-crypto value go to `classifyNonCrypto`, and an
 * unknown value on a market not flagged `is_rwa` stays crypto.
 *
 * QUOTE: `quote_asset`, USDC on every perp. BASE: the parser reads every `<base>-PERP` symbol as the
 * declared `underlying_asset` (1000PEPE as PEPE x1000, as elsewhere) but finds no quote in it, so the
 * quote is passed.
 */

const VENUE = "aevo";
export const AEVO_API = "https://api.aevo.xyz";
const FUNDING_HOURS = 1;
/** `/funding-history` answers at most 50 rows whatever `limit` asks for (measured with 51 and 100). */
export const HISTORY_PAGE_SIZE = 50;
const HISTORY_MAX_PAGES = 400;
const NS_PER_MS = 1_000_000n;

export interface AevoMarket {
  instrument_name: string;
  instrument_type: string;
  underlying_asset: string;
  quote_asset: string;
  mark_price?: string;
  index_price?: string;
  is_active: boolean;
  max_leverage?: string;
  is_rwa?: boolean;
  market_type?: string;
}

export interface AevoStatistic {
  ticker_id: string;
  funding_rate?: string;
  open_interest?: string;
  index_price?: string;
  target_volume?: string;
  next_funding_rate_timestamp?: string;
}

/** `[instrument_name, funding time in ns, rate, mark price]`, newest first. */
export type AevoFundingRow = [string, string, string, string];

export function aevoAssetClass(
  marketType: string | undefined,
  isRwa: boolean | undefined,
  base: string,
): AssetClass {
  switch (marketType?.trim().toLowerCase()) {
    case "crypto":
      return "crypto";
    case "equity":
    case "etf":
    case "pre_ipo":
      return "equity";
    case "commodity":
      return "commodity";
    case "fx":
      return "fx";
    case "index":
      return "index";
    default:
      return isRwa ? classifyNonCrypto(base) : "crypto";
  }
}

function ref(market: AevoMarket) {
  const parsed = marketRef(VENUE, market.instrument_name);
  return marketRef(VENUE, market.instrument_name, {
    quote: market.quote_asset,
    assetClass: aevoAssetClass(market.market_type, market.is_rwa, parsed.base),
  });
}

/** Nanosecond epoch string to milliseconds, exactly; null if it isn't an integer. */
export function nsToMs(ns: string | undefined): number | null {
  if (!ns || !/^\d+$/.test(ns)) return null;
  return Number(BigInt(ns) / NS_PER_MS);
}

export function parseAevoSnapshots(
  markets: readonly AevoMarket[],
  statistics: readonly AevoStatistic[],
  now: number,
): FundingSnapshot[] {
  const stats = new Map(statistics.map((s) => [s.ticker_id, s]));
  const snapshots: FundingSnapshot[] = [];
  for (const market of markets) {
    const stat = stats.get(market.instrument_name);
    const rate = num(stat?.funding_rate);
    if (market.instrument_type !== "PERPETUAL" || !market.is_active || !stat || rate === null) {
      continue;
    }
    const markPrice = num(market.mark_price);
    const next = num(stat.next_funding_rate_timestamp);
    snapshots.push({
      ...ref(market),
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt: next !== null && next > 0 ? next * 1000 : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(market.index_price) ?? num(stat.index_price),
      openInterestUsd: mul(num(stat.open_interest), markPrice),
      volume24hUsd: num(stat.target_volume),
      maxLeverage: num(market.max_leverage),
    });
  }
  return snapshots;
}

/** Hourly settlements within [fromMs, toMs], oldest first. */
export function parseAevoFunding(
  rows: readonly AevoFundingRow[],
  market: AevoMarket,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(market);
  const bySettlement = new Map<number, FundingEvent>();
  for (const [, time, rateText, mark] of rows) {
    const settledAt = nsToMs(time);
    const rate = num(rateText);
    if (settledAt === null || rate === null || settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate,
      basisHours: FUNDING_HOURS,
      markPrice: num(mark),
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export function createAevoAdapter(): VenueAdapter {
  /** Declarations for history, remembered from the last markets list. */
  const known = new Map<string, AevoMarket>();

  return {
    venueId: VENUE,
    minIntervalMs: 250,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const markets = await client.getJson<AevoMarket[]>(
        `${AEVO_API}/markets?instrument_type=PERPETUAL`,
      );
      if (!Array.isArray(markets)) throw new Error(`${VENUE}: unexpected markets response`);
      const statistics = await client.getJson<AevoStatistic[]>(`${AEVO_API}/coingecko-statistics`);
      if (!Array.isArray(statistics)) throw new Error(`${VENUE}: unexpected statistics response`);
      for (const m of markets) known.set(m.instrument_name, m);
      return { snapshots: parseAevoSnapshots(markets, statistics, now), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      // Newest first, 50 a page: step `end_time` back past the oldest row of each page.
      const rows: AevoFundingRow[] = [];
      const start = BigInt(Math.max(0, fromMs)) * NS_PER_MS;
      let end = BigInt(Math.max(0, toMs)) * NS_PER_MS + (NS_PER_MS - 1n);
      for (let page = 0; page < HISTORY_MAX_PAGES && end >= start; page++) {
        const url = `${AEVO_API}/funding-history?instrument_name=${encodeURIComponent(venueSymbol)}&start_time=${start}&end_time=${end}&limit=${HISTORY_PAGE_SIZE}`;
        const body = await client.getJson<{ funding_history?: AevoFundingRow[] }>(url);
        const batch = body?.funding_history ?? [];
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected funding-history response`);
        rows.push(...batch);
        if (batch.length < HISTORY_PAGE_SIZE) break;
        const oldest = batch.reduce((min, r) => {
          const t = /^\d+$/.test(r[1]) ? BigInt(r[1]) : min;
          return t < min ? t : min;
        }, end);
        if (oldest >= end) break;
        end = oldest - 1n;
      }
      const market = known.get(venueSymbol) ?? {
        instrument_name: venueSymbol,
        instrument_type: "PERPETUAL",
        underlying_asset: marketRef(VENUE, venueSymbol).base,
        quote_asset: "USDC",
        is_active: true,
      };
      return parseAevoFunding(rows, market, fromMs, toMs);
    },
  };
}

export const aevoAdapter: VenueAdapter = createAevoAdapter();
