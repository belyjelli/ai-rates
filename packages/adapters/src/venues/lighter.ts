import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

export const LIGHTER_API = "https://mainnet.zklighter.elliot.ai/api/v1";

const HOUR_MS = 3_600_000;
const HISTORY_PAGE_SIZE = 750;

export interface LighterFundingRate {
  market_id: number;
  exchange: string;
  symbol: string;
  rate: number;
}

export interface LighterOrderBookDetail {
  market_id: number;
  symbol: string;
  market_type: string;
  status: string;
  mark_price?: string | number | null;
  index_price?: string | number | null;
  open_interest?: string | number | null;
  daily_quote_token_volume?: string | number | null;
}

export interface LighterFunding {
  timestamp: number;
  value?: string;
  rate: string;
  direction: string;
}

export interface LighterFundingRates {
  funding_rates: LighterFundingRate[];
}

export interface LighterOrderBookDetails {
  order_book_details: LighterOrderBookDetail[];
}

export interface LighterFundings {
  fundings: LighterFunding[];
}

/**
 * Normalizes `funding-rates` joined with `orderBookDetails`. Lighter pays funding every hour; its
 * formula computes an 8-hour rate and pays 1/8 of it each hour, and `funding-rates` reports that
 * 8-hour rate as a fraction (the same response's relayed rows are 8h too: Binance's row equals
 * Binance's 8h rate and Hyperliquid's is 8x its hourly rate). Relayed rows are dropped.
 */
export function parseLighterSnapshots(
  rates: LighterFundingRates,
  details: LighterOrderBookDetails,
  now: number,
): FundingSnapshot[] {
  const live = new Map(
    details.order_book_details
      .filter((d) => d.market_type === "perp" && d.status === "active")
      .map((d) => [d.market_id, d]),
  );
  const nextFundingAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const snapshots: FundingSnapshot[] = [];

  for (const row of rates.funding_rates) {
    const detail = live.get(row.market_id);
    const rate = num(row.rate);
    if (row.exchange !== "lighter" || !detail || rate === null) continue;

    const markPrice = num(detail.mark_price);
    snapshots.push({
      ...marketRef("lighter", row.symbol),
      observedAt: now,
      rate,
      basisHours: 8,
      intervalHours: 1,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(detail.index_price),
      openInterestUsd: mul(num(detail.open_interest), markPrice),
      volume24hUsd: num(detail.daily_quote_token_volume),
    });
  }
  return snapshots;
}

/**
 * Normalizes `fundings` (1h resolution) into settled hourly payments, oldest first. Unlike
 * `funding-rates`, `rate` here is an unsigned hourly rate in percent, rounded to 4 decimals, with
 * `direction` naming the side that paid ("long" means longs paid, i.e. a positive rate).
 */
export function parseLighterFundings(
  venueSymbol: string,
  payload: LighterFundings,
): FundingEvent[] {
  const events: FundingEvent[] = [];
  for (const row of payload.fundings) {
    const percent = num(row.rate);
    if (percent === null || !Number.isFinite(row.timestamp)) continue;
    const sign = row.direction === "short" ? -1 : 1;
    events.push({
      ...marketRef("lighter", venueSymbol),
      settledAt: row.timestamp * 1000,
      rate: (sign * percent) / 100,
      basisHours: 1,
      markPrice: null,
    });
  }
  return events.sort((a, b) => a.settledAt - b.settledAt);
}

export function createLighterAdapter(): VenueAdapter {
  const marketIds = new Map<string, number>();

  async function marketIdFor(client: HttpClient, symbol: string): Promise<number | undefined> {
    if (!marketIds.has(symbol)) {
      const details = await client.getJson<LighterOrderBookDetails>(
        `${LIGHTER_API}/orderBookDetails`,
      );
      for (const d of details.order_book_details) marketIds.set(d.symbol, d.market_id);
    }
    return marketIds.get(symbol);
  }

  return {
    venueId: "lighter",
    // Unauthenticated REST is limited to ~60 requests/min.
    minIntervalMs: 1100,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const rates = await client.getJson<LighterFundingRates>(`${LIGHTER_API}/funding-rates`);
      const details = await client.getJson<LighterOrderBookDetails>(
        `${LIGHTER_API}/orderBookDetails`,
      );
      for (const d of details.order_book_details) marketIds.set(d.symbol, d.market_id);
      return { snapshots: parseLighterSnapshots(rates, details, now), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const marketId = await marketIdFor(client, venueSymbol);
      if (marketId === undefined) return [];

      const rows: LighterFunding[] = [];
      let start = Math.floor(fromMs / 1000);
      const end = Math.floor(toMs / 1000);
      while (start <= end) {
        const page = await client.getJson<LighterFundings>(
          `${LIGHTER_API}/fundings?market_id=${marketId}&resolution=1h&start_timestamp=${start}&end_timestamp=${end}&count_back=0`,
        );
        rows.push(...page.fundings);
        const last = page.fundings.at(-1);
        if (!last || page.fundings.length < HISTORY_PAGE_SIZE) break;
        start = last.timestamp + 1;
      }
      return parseLighterFundings(venueSymbol, { fundings: rows });
    },
  };
}

export const lighterAdapter: VenueAdapter = createLighterAdapter();
