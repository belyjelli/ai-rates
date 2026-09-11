import { type FundingEvent, type FundingSnapshot, inferIntervalHours } from "@ai-rates/core";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "gate";
const BASE_URL = "https://api.gateio.ws/api/v4/futures/usdt";
const HISTORY_PAGE = 1000;
const MAX_PAGES = 20;
const MINUTE_MS = 60_000;

export interface GateContract {
  name: string;
  /** Rate for the current interval, applied at `funding_next_apply`. */
  funding_rate: string;
  /** Seconds. */
  funding_interval: number;
  /** Epoch seconds. */
  funding_next_apply: number;
  mark_price: string;
  index_price: string;
  /** Base units per contract. */
  quanto_multiplier: string;
  in_delisting: boolean;
  status?: string;
  is_pre_market?: boolean;
}

export interface GateTicker {
  contract: string;
  volume_24h_quote: string;
  /** Open interest in contracts. */
  total_size: string;
}

export interface GateFundingHistoryItem {
  /** Epoch seconds; Gate stamps settlements a second or two after the hour. */
  t: number;
  r: string;
}

export function parseGateSnapshots(
  contracts: readonly GateContract[],
  tickers: readonly GateTicker[],
  now: number,
): SnapshotBatch {
  const tickerByContract = new Map(tickers.map((t) => [t.contract, t]));

  const snapshots: FundingSnapshot[] = [];
  for (const contract of contracts) {
    if (contract.in_delisting || contract.is_pre_market) continue;
    if (contract.status !== undefined && contract.status !== "trading") continue;
    const rate = num(contract.funding_rate);
    if (rate === null || !(contract.funding_interval > 0)) continue;

    const hours = contract.funding_interval / 3600;
    const markPrice = num(contract.mark_price);
    const ticker = tickerByContract.get(contract.name);
    snapshots.push({
      ...marketRef(VENUE_ID, contract.name),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: contract.funding_next_apply > 0 ? contract.funding_next_apply * 1000 : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(contract.index_price),
      openInterestUsd: ticker
        ? mul(num(ticker.total_size), num(contract.quanto_multiplier), markPrice)
        : null,
      volume24hUsd: ticker ? num(ticker.volume_24h_quote) : null,
    });
  }
  return { snapshots, settled: [] };
}

/** Settled funding events for one contract, oldest first, with timestamps snapped to the minute. */
export function parseGateFundingHistory(
  contract: string,
  items: readonly GateFundingHistoryItem[],
  fallbackHours: number,
): FundingEvent[] {
  const points = items
    .map((item) => ({
      settledAt: Math.round((item.t * 1000) / MINUTE_MS) * MINUTE_MS,
      rate: num(item.r),
    }))
    .filter((p): p is { settledAt: number; rate: number } => p.rate !== null && p.settledAt > 0)
    .sort((a, b) => a.settledAt - b.settledAt);

  const basisHours = inferIntervalHours(points.map((p) => p.settledAt)) ?? fallbackHours;
  return points.map((p) => ({
    ...marketRef(VENUE_ID, contract),
    settledAt: p.settledAt,
    rate: p.rate,
    basisHours,
    markPrice: null,
  }));
}

export const gateAdapter: VenueAdapter = {
  venueId: VENUE_ID,
  minIntervalMs: 150,

  async fetchSnapshots(client, now) {
    const [contracts, tickers] = await Promise.all([
      client.getJson<GateContract[]>(`${BASE_URL}/contracts`),
      client.getJson<GateTicker[]>(`${BASE_URL}/tickers`),
    ]);
    return parseGateSnapshots(contracts, tickers, now);
  },

  async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
    const items: GateFundingHistoryItem[] = [];
    const from = Math.floor(fromMs / 1000);
    let to = Math.floor(toMs / 1000);
    for (let page = 0; page < MAX_PAGES && to >= from; page++) {
      const data = await client.getJson<GateFundingHistoryItem[]>(
        `${BASE_URL}/funding_rate?contract=${encodeURIComponent(venueSymbol)}&from=${from}&to=${to}&limit=${HISTORY_PAGE}`,
      );
      items.push(...data);
      if (data.length < HISTORY_PAGE) break;
      to = Math.min(...data.map((i) => i.t)) - 1;
    }

    let fallbackHours = 8;
    if (items.length < 2) {
      const contract = await client.getJson<GateContract>(
        `${BASE_URL}/contracts/${encodeURIComponent(venueSymbol)}`,
      );
      if (contract.funding_interval > 0) fallbackHours = contract.funding_interval / 3600;
    }
    const unique = [...new Map(items.map((i) => [i.t, i])).values()];
    return parseGateFundingHistory(venueSymbol, unique, fallbackHours);
  },
};
