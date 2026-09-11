import { type FundingEvent, type FundingSnapshot, inferIntervalHours } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { VenueAdapter } from "../types";

// Aster's futures API is Binance-compatible, so the parsing lives in Binance-style helpers that a
// Binance adapter can reuse (pass defaultIntervalHours: 8, since Binance's fundingInfo only lists
// symbols with a non-default interval).

const VENUE = "aster";
const BASE = "https://fapi.asterdex.com/fapi/v1";
/** exchangeInfo is ~800 KB and only needed to know which symbols trade, so refresh it hourly. */
export const EXCHANGE_INFO_MAX_AGE_MS = 60 * 60_000;
const HISTORY_LIMIT = 1000;
const HISTORY_MAX_PAGES = 20;

export interface BinanceStylePremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  /** Current-period funding estimate (not the last settled rate, despite the name). */
  lastFundingRate: string;
  nextFundingTime: number;
}

export interface BinanceStyleFundingInfo {
  symbol: string;
  fundingIntervalHours: number;
}

export interface BinanceStyleTicker24h {
  symbol: string;
  quoteVolume: string;
}

export interface BinanceStyleExchangeInfo {
  symbols: { symbol: string; status: string; contractType: string; quoteAsset?: string }[];
}

export interface BinanceStyleFundingRate {
  symbol: string;
  fundingTime: number;
  fundingRate: string;
  markPrice?: string;
}

export interface TradableSymbol {
  quoteAsset: string | null;
}

/** Perpetual symbols currently TRADING, by symbol. */
export function tradablePerpetuals(info: BinanceStyleExchangeInfo): Map<string, TradableSymbol> {
  return new Map(
    info.symbols
      .filter((s) => s.status === "TRADING" && s.contractType === "PERPETUAL")
      .map((s) => [s.symbol, { quoteAsset: s.quoteAsset ?? null }]),
  );
}

export interface BinanceStyleSnapshotInput {
  premium: readonly BinanceStylePremiumIndex[];
  fundingInfo: readonly BinanceStyleFundingInfo[];
  tickers: readonly BinanceStyleTicker24h[];
  tradable: ReadonlyMap<string, TradableSymbol>;
  /** Interval for symbols missing from fundingInfo; null skips them. */
  defaultIntervalHours: number | null;
}

export function parseBinanceStyleSnapshots(
  venueId: string,
  input: BinanceStyleSnapshotInput,
  now: number,
): FundingSnapshot[] {
  const intervals = new Map(input.fundingInfo.map((i) => [i.symbol, num(i.fundingIntervalHours)]));
  const volumes = new Map(input.tickers.map((t) => [t.symbol, num(t.quoteVolume)]));
  const snapshots: FundingSnapshot[] = [];

  for (const p of input.premium) {
    const tradable = input.tradable.get(p.symbol);
    const rate = num(p.lastFundingRate);
    const interval = intervals.get(p.symbol) ?? input.defaultIntervalHours;
    if (!tradable || rate === null || interval === null || interval <= 0) continue;

    const next = num(p.nextFundingTime);
    snapshots.push({
      ...marketRef(venueId, p.symbol, tradable.quoteAsset ? { quote: tradable.quoteAsset } : {}),
      observedAt: now,
      rate,
      basisHours: interval,
      intervalHours: interval,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice: num(p.markPrice),
      indexPrice: num(p.indexPrice),
      // Binance-style APIs only expose open interest per symbol; not fetched in the bulk cycle.
      openInterestUsd: null,
      volume24hUsd: volumes.get(p.symbol) ?? null,
    });
  }
  return snapshots;
}

/**
 * Basis hours for each settlement from the gap to its nearest neighbour, snapped to standard
 * intervals. Using the smaller gap means one missed settlement doesn't double a neighbour's basis.
 * A lone settlement falls back to `fallbackHours`.
 */
export function basisHoursFromGaps(
  times: readonly number[],
  fallbackHours: number | null,
): (number | null)[] {
  return times.map((t, i) => {
    const gaps = [
      i > 0 ? t - (times[i - 1] as number) : 0,
      i < times.length - 1 ? (times[i + 1] as number) - t : 0,
    ].filter((g) => g > 0);
    if (gaps.length === 0) return fallbackHours;
    return inferIntervalHours([t, t + Math.min(...gaps)]);
  });
}

export function parseBinanceStyleFundingHistory(
  venueId: string,
  venueSymbol: string,
  rows: readonly BinanceStyleFundingRate[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
): FundingEvent[] {
  const byTime = new Map<number, BinanceStyleFundingRate>();
  for (const row of rows) {
    const time = num(row.fundingTime);
    if (time !== null && time >= fromMs && time <= toMs && num(row.fundingRate) !== null)
      byTime.set(time, row);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  const basis = basisHoursFromGaps(times, fallbackHours);

  const events: FundingEvent[] = [];
  times.forEach((time, i) => {
    const row = byTime.get(time) as BinanceStyleFundingRate;
    const basisHours = basis[i];
    if (basisHours === null || basisHours === undefined) return;
    events.push({
      ...marketRef(venueId, venueSymbol),
      settledAt: time,
      rate: num(row.fundingRate) as number,
      basisHours,
      markPrice: num(row.markPrice),
    });
  });
  return events;
}

/** Pages GET {fundingRateUrl}?symbol=&startTime=&endTime=&limit= forward from fromMs. */
export async function fetchBinanceStyleFundingHistory(
  client: HttpClient,
  fundingRateUrl: string,
  venueId: string,
  venueSymbol: string,
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
): Promise<FundingEvent[]> {
  const rows: BinanceStyleFundingRate[] = [];
  let startTime = fromMs;
  for (let page = 0; page < HISTORY_MAX_PAGES && startTime <= toMs; page++) {
    const url = `${fundingRateUrl}?symbol=${encodeURIComponent(venueSymbol)}&startTime=${startTime}&endTime=${toMs}&limit=${HISTORY_LIMIT}`;
    const batch = await client.getJson<BinanceStyleFundingRate[]>(url);
    if (!Array.isArray(batch)) throw new Error(`${venueId}: unexpected fundingRate response`);
    rows.push(...batch);
    if (batch.length < HISTORY_LIMIT) break;
    startTime = Math.max(...batch.map((r) => r.fundingTime)) + 1;
  }
  return parseBinanceStyleFundingHistory(venueId, venueSymbol, rows, fromMs, toMs, fallbackHours);
}

function expectArray<T>(value: unknown, what: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${VENUE}: unexpected ${what} response`);
  return value as T[];
}

export function createAsterAdapter(): VenueAdapter {
  let exchangeInfo: { fetchedAt: number; tradable: Map<string, TradableSymbol> } | null = null;
  let intervals = new Map<string, number>();

  return {
    venueId: VENUE,
    minIntervalMs: 100,

    async fetchSnapshots(client: HttpClient, now: number) {
      if (!exchangeInfo || now - exchangeInfo.fetchedAt >= EXCHANGE_INFO_MAX_AGE_MS) {
        const info = await client.getJson<BinanceStyleExchangeInfo>(`${BASE}/exchangeInfo`);
        if (!Array.isArray(info?.symbols))
          throw new Error(`${VENUE}: unexpected exchangeInfo response`);
        exchangeInfo = { fetchedAt: now, tradable: tradablePerpetuals(info) };
      }
      const [premium, fundingInfo, tickers] = await Promise.all([
        client
          .getJson(`${BASE}/premiumIndex`)
          .then((v) => expectArray<BinanceStylePremiumIndex>(v, "premiumIndex")),
        client
          .getJson(`${BASE}/fundingInfo`)
          .then((v) => expectArray<BinanceStyleFundingInfo>(v, "fundingInfo")),
        client
          .getJson(`${BASE}/ticker/24hr`)
          .then((v) => expectArray<BinanceStyleTicker24h>(v, "ticker/24hr")),
      ]);
      intervals = new Map(
        fundingInfo.flatMap((i) => {
          const hours = num(i.fundingIntervalHours);
          return hours !== null && hours > 0 ? [[i.symbol, hours] as const] : [];
        }),
      );

      const snapshots = parseBinanceStyleSnapshots(
        VENUE,
        {
          premium,
          fundingInfo,
          tickers,
          tradable: exchangeInfo.tradable,
          defaultIntervalHours: null,
        },
        now,
      );
      return { snapshots, settled: [] };
    },

    fetchFundingHistory: (client, venueSymbol, fromMs, toMs) =>
      fetchBinanceStyleFundingHistory(
        client,
        `${BASE}/fundingRate`,
        VENUE,
        venueSymbol,
        fromMs,
        toMs,
        intervals.get(venueSymbol) ?? null,
      ),
  };
}

export const asterAdapter = createAsterAdapter();
