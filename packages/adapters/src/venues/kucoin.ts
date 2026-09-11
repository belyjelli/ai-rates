import { type FundingEvent, type FundingSnapshot, inferIntervalHours } from "@ai-rates/core";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "kucoin";
const BASE_URL = "https://api-futures.kucoin.com";
const MS_PER_HOUR = 3_600_000;
const HISTORY_PAGE = 100;
const MAX_PAGES = 50;
const OK = "200000";

/** KuCoin's type code for perpetual swaps; "FFICSX" is dated futures. */
const PERPETUAL = "FFWCSX";

export interface KucoinEnvelope<T> {
  code: string;
  msg?: string;
  data: T;
}

export interface KucoinContract {
  symbol: string;
  type: string;
  status: string;
  isInverse: boolean;
  /** Rate for the current funding period. */
  fundingFeeRate: number | null;
  /** ms; null on some symbols, where `fundingRateGranularity` still holds the interval. */
  currentFundingRateGranularity: number | null;
  fundingRateGranularity: number | null;
  nextFundingRateDateTime: number | null;
  /** Rate settled at the previous funding time. */
  lastTimeFundingRate: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  /** Lots, as a string. */
  openInterest: string;
  /** Base units per lot for linear contracts. */
  multiplier: number;
  turnoverOf24h: number | null;
}

export interface KucoinFundingHistoryItem {
  symbol: string;
  fundingRate: number;
  timepoint: number;
}

function unwrap<T>(json: KucoinEnvelope<T>, what: string): T {
  if (json.code !== OK) throw new Error(`kucoin ${what}: ${json.code} ${json.msg ?? ""}`);
  return json.data;
}

function granularityMs(contract: KucoinContract): number | null {
  const ms = contract.currentFundingRateGranularity ?? contract.fundingRateGranularity;
  return ms !== null && ms > 0 ? ms : null;
}

export function parseKucoinSnapshots(
  json: KucoinEnvelope<KucoinContract[]>,
  now: number,
): SnapshotBatch {
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];

  for (const contract of unwrap(json, "contracts")) {
    if (contract.type !== PERPETUAL || contract.isInverse || contract.status !== "Open") continue;
    const intervalMs = granularityMs(contract);
    const rate = num(contract.fundingFeeRate);
    if (intervalMs === null || rate === null) continue;

    const hours = intervalMs / MS_PER_HOUR;
    const ref = marketRef(VENUE_ID, contract.symbol);
    const nextFundingAt = num(contract.nextFundingRateDateTime);
    const markPrice = num(contract.markPrice);
    snapshots.push({
      ...ref,
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(contract.indexPrice),
      openInterestUsd: mul(num(contract.openInterest), num(contract.multiplier), markPrice),
      volume24hUsd: num(contract.turnoverOf24h),
    });

    const lastRate = num(contract.lastTimeFundingRate);
    if (lastRate !== null && nextFundingAt !== null) {
      settled.push({
        ...ref,
        settledAt: nextFundingAt - intervalMs,
        rate: lastRate,
        basisHours: hours,
        markPrice: null,
      });
    }
  }
  return { snapshots, settled };
}

/** Settled funding events for one symbol, oldest first. */
export function parseKucoinFundingHistory(
  json: KucoinEnvelope<KucoinFundingHistoryItem[]>,
  fallbackHours: number,
): FundingEvent[] {
  const points = unwrap(json, "funding history")
    .map((item) => ({
      symbol: item.symbol,
      settledAt: num(item.timepoint),
      rate: num(item.fundingRate),
    }))
    .filter(
      (p): p is { symbol: string; settledAt: number; rate: number } =>
        p.settledAt !== null && p.rate !== null,
    )
    .sort((a, b) => a.settledAt - b.settledAt);

  const basisHours = inferIntervalHours(points.map((p) => p.settledAt)) ?? fallbackHours;
  return points.map((p) => ({
    ...marketRef(VENUE_ID, p.symbol),
    settledAt: p.settledAt,
    rate: p.rate,
    basisHours,
    markPrice: null,
  }));
}

export const kucoinAdapter: VenueAdapter = {
  venueId: VENUE_ID,
  minIntervalMs: 150,

  async fetchSnapshots(client, now) {
    const json = await client.getJson<KucoinEnvelope<KucoinContract[]>>(
      `${BASE_URL}/api/v1/contracts/active`,
    );
    return parseKucoinSnapshots(json, now);
  },

  async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
    const items: KucoinFundingHistoryItem[] = [];
    let to = toMs;
    for (let page = 0; page < MAX_PAGES && to >= fromMs; page++) {
      const data = unwrap(
        await client.getJson<KucoinEnvelope<KucoinFundingHistoryItem[]>>(
          `${BASE_URL}/api/v1/contract/funding-rates?symbol=${encodeURIComponent(venueSymbol)}&from=${fromMs}&to=${to}`,
        ),
        "funding history",
      );
      items.push(...data);
      if (data.length < HISTORY_PAGE) break;
      to = Math.min(...data.map((i) => i.timepoint)) - 1;
    }

    let fallbackHours = 8;
    if (items.length < 2) {
      const contract = unwrap(
        await client.getJson<KucoinEnvelope<KucoinContract>>(
          `${BASE_URL}/api/v1/contracts/${encodeURIComponent(venueSymbol)}`,
        ),
        "contract",
      );
      const ms = granularityMs(contract);
      if (ms !== null) fallbackHours = ms / MS_PER_HOUR;
    }
    const unique = [...new Map(items.map((i) => [i.timepoint, i])).values()];
    return parseKucoinFundingHistory({ code: OK, data: unique }, fallbackHours);
  },
};
