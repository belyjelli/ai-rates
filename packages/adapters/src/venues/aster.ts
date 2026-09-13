import { type FundingEvent, type FundingSnapshot, inferIntervalHours } from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { marketRef, mul, num, selectRefreshBatch } from "../parse";
import type { VenueAdapter } from "../types";

// Aster's futures API is Binance-compatible, so this module is the whole binance-fapi family: the
// Binance-style helpers below are shared, and `createBinanceStyleAdapter` takes the venue id and
// base URL rather than closing over constants.
//
// On `defaultIntervalHours`, measured against Binance on 2026-09-13 rather than assumed: its
// fundingInfo is NOT an exceptions-only list. It returned 782 entries, 312 of them at the default
// 8h, against 900 symbols in premiumIndex. Of the 138 symbols missing from fundingInfo, **zero**
// are TRADING perpetuals, so `tradablePerpetuals` drops every one of them before the interval
// lookup matters. `null` is therefore correct for Binance as well as Aster, and inventing an 8h
// default would have been the wrong guess anyway: 466 of 782 symbols settle 4-hourly.

const VENUE = "aster";
const BASE = "https://fapi.asterdex.com/fapi/v1";
/** exchangeInfo only says which symbols trade, and it is large (Binance's is 1.1 MB), so hourly. */
export const EXCHANGE_INFO_MAX_AGE_MS = 60 * 60_000;
const HISTORY_LIMIT = 1000;
const HISTORY_MAX_PAGES = 20;
/**
 * Binance-style APIs expose open interest one symbol at a time (`openInterest` rejects a missing
 * symbol and `ticker/24hr` carries none), so a full sweep of Aster's ~570 perps cannot fit in one
 * cycle. Each cycle refreshes a slice; at this budget every symbol is re-read about every 5 minutes,
 * which open interest changes far more slowly than. Each call costs request weight 1 of ~2400/min.
 */
export const OPEN_INTEREST_BUDGET = 120;
export const OPEN_INTEREST_MAX_AGE_MS = 5 * 60_000;

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

export interface BinanceStyleOpenInterest {
  symbol: string;
  /** Open interest in contracts. */
  openInterest: string;
  time: number;
}

export interface OpenInterestEntry {
  contracts: number;
  fetchedAt: number;
}

/**
 * Fills in open interest from the rotating cache. A contract covers `multiplier` units of the base
 * asset and the venue quotes its price per contract, so contracts x that price is USD either way.
 * This runs before the collector rescales prices per base unit, so `markPrice` is still the venue's.
 */
export function attachOpenInterest(
  snapshots: readonly FundingSnapshot[],
  cache: ReadonlyMap<string, OpenInterestEntry>,
): FundingSnapshot[] {
  return snapshots.map((snapshot) => {
    const entry = cache.get(snapshot.venueSymbol);
    const openInterestUsd = entry ? mul(entry.contracts, snapshot.markPrice) : null;
    return openInterestUsd === null ? snapshot : { ...snapshot, openInterestUsd };
  });
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

/**
 * Takes the venue rather than closing over the module constant. It used to read `${VENUE}`, which
 * was correct while this file served one venue and silently wrong the moment it served the family:
 * a malformed Binance response reported "aster: unexpected premiumIndex response" and sent the
 * reader to the wrong adapter.
 */
function expectArray<T>(venueId: string, value: unknown, what: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${venueId}: unexpected ${what} response`);
  return value as T[];
}

export interface AsterAdapterOptions {
  openInterestBudget?: number;
}

/**
 * Every venue in the binance-fapi family: Aster, Binance, and any other exchange serving the same
 * `/fapi/v1` surface. The venue id and base URL are parameters rather than module constants, so a
 * new member is a configuration rather than a copied adapter.
 */
export interface BinanceStyleAdapterOptions extends AsterAdapterOptions {
  venueId: string;
  /** Base URL up to and including `/fapi/v1`, with no trailing slash. */
  baseUrl: string;
  /**
   * Interval for symbols absent from fundingInfo; `null` skips them. Null for every member measured
   * so far — see the note at the top of this file for why an 8h default would be wrong.
   */
  defaultIntervalHours?: number | null;
  /** Aster allows 100ms between requests; tighter venues override it. */
  minIntervalMs?: number;
}

export function createAsterAdapter(options: AsterAdapterOptions = {}): VenueAdapter {
  return createBinanceStyleAdapter({ ...options, venueId: VENUE, baseUrl: BASE });
}

export function createBinanceStyleAdapter(options: BinanceStyleAdapterOptions): VenueAdapter {
  const VENUE = options.venueId;
  const BASE = options.baseUrl;
  const defaultIntervalHours = options.defaultIntervalHours ?? null;
  const openInterestBudget = options.openInterestBudget ?? OPEN_INTEREST_BUDGET;
  let exchangeInfo: { fetchedAt: number; tradable: Map<string, TradableSymbol> } | null = null;
  let intervals = new Map<string, number>();
  const openInterest = new Map<string, OpenInterestEntry>();

  return {
    venueId: VENUE,
    minIntervalMs: options.minIntervalMs ?? 100,

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
          .then((v) => expectArray<BinanceStylePremiumIndex>(VENUE, v, "premiumIndex")),
        client
          .getJson(`${BASE}/fundingInfo`)
          .then((v) => expectArray<BinanceStyleFundingInfo>(VENUE, v, "fundingInfo")),
        client
          .getJson(`${BASE}/ticker/24hr`)
          .then((v) => expectArray<BinanceStyleTicker24h>(VENUE, v, "ticker/24hr")),
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
          defaultIntervalHours,
        },
        now,
      );

      for (const symbol of openInterest.keys()) {
        if (!exchangeInfo.tradable.has(symbol)) openInterest.delete(symbol);
      }
      const symbols = snapshots.map((s) => s.venueSymbol);
      for (const symbol of selectRefreshBatch(
        symbols,
        openInterest,
        now,
        openInterestBudget,
        OPEN_INTEREST_MAX_AGE_MS,
      )) {
        try {
          const data = await client.getJson<BinanceStyleOpenInterest>(
            `${BASE}/openInterest?symbol=${encodeURIComponent(symbol)}`,
          );
          const contracts = num(data?.openInterest);
          if (contracts !== null) openInterest.set(symbol, { contracts, fetchedAt: now });
        } catch (error) {
          if (error instanceof CircuitOpenError) break;
          // Leave this symbol for a later cycle; one bad symbol shouldn't fail the batch.
        }
      }

      return { snapshots: attachOpenInterest(snapshots, openInterest), settled: [] };
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
