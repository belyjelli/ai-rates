import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { hoursBetween, marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

// One adapter for the Orderly network, listed in the catalog as WOOFi Pro. Orderly's brokers
// (WOOFi Pro, and ~100 others) are front ends on one shared order book, so they are not venues of
// their own and are not collected separately.

const VENUE_ID = "orderly";
export const ORDERLY_API = "https://api.orderly.org/v1/public";
/** `/info` carries the funding period and listing status, which change rarely. */
export const INFO_MAX_AGE_MS = 60 * 60_000;
/** The server caps `size` at 500 whatever is asked (measured 2026-09-14). */
const HISTORY_PAGE_SIZE = 500;
const HISTORY_MAX_PAGES = 20;

export interface OrderlyEnvelope<T> {
  success: boolean;
  data: T;
  timestamp?: number;
  code?: number;
  message?: string;
}

export interface OrderlyRows<T> {
  rows: T[];
}

export interface OrderlyInfo {
  symbol: string;
  status: string;
  /** Settlement interval in hours: 8 (80 markets) or 4 (59) on 2026-09-14. */
  funding_period: number;
  /**
   * Set on markets a broker listed through permissionless listing (`_mythos`, `_alpix`, `_fastx`
   * suffixes: 59 of 139 on 2026-09-14). They trade on the same shared book and are collected.
   */
  broker_id?: string | null;
  display_symbol_name?: string;
}

export interface OrderlyFuture {
  symbol: string;
  index_price: number | null;
  mark_price: number | null;
  est_funding_rate: number | null;
  last_funding_rate: number | null;
  next_funding_time: number | null;
  /** Base units. */
  open_interest: number | null;
  /** 24h volume in base units. */
  "24h_volume"?: number | null;
  /** 24h notional in USDC. */
  "24h_amount": number | null;
}

export interface OrderlyFundingRate {
  symbol: string;
  est_funding_rate: number | null;
  last_funding_rate: number | null;
  last_funding_rate_timestamp: number | null;
  next_funding_time: number | null;
}

export interface OrderlyFundingHistoryRow {
  symbol: string;
  funding_rate: number;
  funding_rate_timestamp: number;
  next_funding_time: number | null;
}

export interface OrderlyFundingHistoryPage {
  rows: OrderlyFundingHistoryRow[];
  meta: { total: number; records_per_page: number; current_page: number };
}

function unwrap<T>(json: OrderlyEnvelope<T>, what: string): T {
  if (!json?.success || json.data === undefined || json.data === null) {
    throw new Error(`orderly ${what}: ${json?.code ?? ""} ${json?.message ?? ""}`);
  }
  return json.data;
}

function positiveMs(value: unknown): number | null {
  const ms = num(value);
  return ms !== null && ms > 0 ? ms : null;
}

/** ACTIVE perps with a known funding period, by symbol. */
export function tradableOrderlyPerps(info: readonly OrderlyInfo[]): Map<string, OrderlyInfo> {
  return new Map(
    info
      .filter(
        (m) =>
          m.status === "ACTIVE" && m.symbol.startsWith("PERP_") && (num(m.funding_period) ?? 0) > 0,
      )
      .map((m) => [m.symbol, m]),
  );
}

export interface OrderlySnapshotInput {
  markets: ReadonlyMap<string, OrderlyInfo>;
  futures: readonly OrderlyFuture[];
  fundingRates: readonly OrderlyFundingRate[];
}

/**
 * Normalizes `/futures` onto ACTIVE markets, with the last settlement from `/funding_rates`.
 *
 * WHICH RATE IS PREDICTED. Orderly publishes two: `last_funding_rate`, the rate that settled at
 * `last_funding_rate_timestamp`, and `est_funding_rate`, which its docs call a rolling average of
 * the funding rate over the last 8 hours and which it shows as the upcoming rate. The settled one
 * is not a prediction of anything, so it is emitted as a settlement and `est_funding_rate` is the
 * predicted rate.
 *
 * WHAT PERIOD BOTH ARE OVER. Despite "8 hours" in the docs, both are fractions per the market's own
 * `funding_period`, not normalised to 8h. On 2026-09-14 the resting rate (the 0.01%-per-8h interest
 * component with no premium) read 0.0001 on 8h markets (BTC, ETH, SPX500) and 0.00005 on 4h markets
 * (HYPE, XAU, CL), for both fields, and HYPE's history settled 0.0000499 every 4h.
 * Treating the 4h figures as 8h rates would halve their APR.
 *
 * Units, checked the same day: `open_interest` is base units (BTC 26.43846 x mark 77,090 = $2.04M)
 * and `24h_amount` is USDC notional (BTC 31.94 x ~77,100 = 2,461,419).
 *
 * Orderly declares no asset class in its public API — `/rwa/market_sessions` names trading sessions
 * but maps no symbol to one — so every market is crypto, XAU, SPX500 and AAPL included.
 */
export function parseOrderlySnapshots(input: OrderlySnapshotInput, now: number): SnapshotBatch {
  const lastSettled = new Map(input.fundingRates.map((r) => [r.symbol, r]));
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];

  for (const future of input.futures) {
    const market = input.markets.get(future.symbol);
    const rate = num(future.est_funding_rate);
    const hours = num(market?.funding_period);
    if (!market || rate === null || hours === null || hours <= 0) continue;

    // PERP_BTC_USDC and PERP_AAPL_USDC_mythos both parse to base and USDC quote; the quote is the
    // collateral every Orderly market settles in.
    const ref = marketRef(VENUE_ID, future.symbol);
    const markPrice = num(future.mark_price);
    snapshots.push({
      ...ref,
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: positiveMs(future.next_funding_time),
      kind: "predicted",
      markPrice,
      indexPrice: num(future.index_price),
      openInterestUsd: mul(num(future.open_interest), markPrice),
      volume24hUsd: num(future["24h_amount"]),
    });

    const last = lastSettled.get(future.symbol);
    const lastRate = num(last?.last_funding_rate);
    const settledAt = positiveMs(last?.last_funding_rate_timestamp);
    if (lastRate !== null && settledAt !== null) {
      settled.push({ ...ref, settledAt, rate: lastRate, basisHours: hours, markPrice: null });
    }
  }
  return { snapshots, settled };
}

/**
 * Settlements in [fromMs, toMs], oldest first. Each row states the settlement after it, so its
 * basis is that gap exactly; the market's funding period covers a row without one.
 */
export function parseOrderlyFundingHistory(
  venueSymbol: string,
  rows: readonly OrderlyFundingHistoryRow[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
): FundingEvent[] {
  const ref = marketRef(VENUE_ID, venueSymbol);
  const byTime = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = num(row.funding_rate_timestamp);
    const rate = num(row.funding_rate);
    if (settledAt === null || rate === null || settledAt < fromMs || settledAt > toMs) continue;
    const basisHours = hoursBetween(settledAt, num(row.next_funding_time)) ?? fallbackHours;
    if (basisHours === null || basisHours <= 0) continue;
    byTime.set(settledAt, { ...ref, settledAt, rate, basisHours, markPrice: null });
  }
  return [...byTime.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export function createOrderlyAdapter(): VenueAdapter {
  let markets: { fetchedAt: number; bySymbol: Map<string, OrderlyInfo> } | null = null;

  async function loadMarkets(client: HttpClient, fetchedAt: number) {
    const data = unwrap(
      await client.getJson<OrderlyEnvelope<OrderlyRows<OrderlyInfo>>>(`${ORDERLY_API}/info`),
      "info",
    );
    markets = { fetchedAt, bySymbol: tradableOrderlyPerps(data.rows ?? []) };
    return markets.bySymbol;
  }

  return {
    venueId: VENUE_ID,
    // Public endpoints allow 10 requests per second per IP.
    minIntervalMs: 120,

    async fetchSnapshots(client, now) {
      const bySymbol =
        markets && now - markets.fetchedAt < INFO_MAX_AGE_MS
          ? markets.bySymbol
          : await loadMarkets(client, now);
      const [futures, fundingRates] = await Promise.all([
        client
          .getJson<OrderlyEnvelope<OrderlyRows<OrderlyFuture>>>(`${ORDERLY_API}/futures`)
          .then((json) => unwrap(json, "futures").rows ?? []),
        client
          .getJson<OrderlyEnvelope<OrderlyRows<OrderlyFundingRate>>>(`${ORDERLY_API}/funding_rates`)
          .then((json) => unwrap(json, "funding rates").rows ?? []),
      ]);
      return parseOrderlySnapshots({ markets: bySymbol, futures, fundingRates }, now);
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      // fetchedAt 0 keeps a copy loaded here due for a refresh on the next snapshot cycle.
      const bySymbol = markets?.bySymbol ?? (await loadMarkets(client, 0));
      const rows: OrderlyFundingHistoryRow[] = [];
      // start_t and end_t are 13-digit ms; seconds silently return nothing.
      for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
        const data = unwrap(
          await client.getJson<OrderlyEnvelope<OrderlyFundingHistoryPage>>(
            `${ORDERLY_API}/funding_rate_history?symbol=${encodeURIComponent(venueSymbol)}&start_t=${fromMs}&end_t=${toMs}&page=${page}&size=${HISTORY_PAGE_SIZE}`,
          ),
          "funding rate history",
        );
        const list = data.rows ?? [];
        rows.push(...list);
        const perPage = data.meta?.records_per_page ?? HISTORY_PAGE_SIZE;
        if (list.length < perPage || page * perPage >= (data.meta?.total ?? 0)) break;
      }
      return parseOrderlyFundingHistory(
        venueSymbol,
        rows,
        fromMs,
        toMs,
        num(bySymbol.get(venueSymbol)?.funding_period),
      );
    },
  };
}

export const orderlyAdapter: VenueAdapter = createOrderlyAdapter();
