import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { VenueAdapter } from "../types";

const VENUE = "mexc";
const BASE = "https://contract.mexc.com/api/v1/contract";
const HOUR_MS = 3_600_000;

/** Contract details are ~2 MB, so they're refreshed at most hourly. */
export const CONTRACTS_MAX_AGE_MS = HOUR_MS;
/** Per-symbol funding_rate calls allowed per fetchSnapshots (MEXC allows 20 requests / 2s). */
export const INTERVAL_REFRESH_BUDGET = 40;
/** Settlement intervals rarely change; re-check each symbol this often. */
export const INTERVAL_MAX_AGE_MS = 6 * HOUR_MS;
/** `state` in contract details: 0 = enabled (1 delivery, 2 delivered, 3 offline, 4 paused). */
const LIVE_STATE = 0;
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 50;

interface MexcEnvelope<T> {
  success: boolean;
  code: number;
  data: T;
}

export interface MexcTicker {
  symbol: string;
  fundingRate: number;
  fairPrice: number;
  indexPrice: number;
  /** Open interest in contracts. */
  holdVol: number;
  /** 24h turnover in quote currency. */
  amount24: number;
}

export interface MexcContractDetail {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  settleCoin: string;
  /** Base units per contract; USD per contract for coin-settled (inverse) contracts. */
  contractSize: number;
  state: number;
}

export interface MexcFundingRate {
  symbol: string;
  fundingRate: number;
  /** Settlement interval in hours. */
  collectCycle: number;
  nextSettleTime: number;
}

export interface MexcFundingHistoryPage {
  currentPage: number;
  totalPage: number;
  resultList: { symbol: string; fundingRate: number; settleTime: number; collectCycle: number }[];
}

export interface IntervalEntry {
  hours: number;
  nextSettleTime: number | null;
  fetchedAt: number;
}

function unwrap<T>(envelope: MexcEnvelope<T>, what: string): T {
  if (!envelope?.success || envelope.data === undefined || envelope.data === null) {
    throw new Error(`${VENUE}: ${what} failed (code ${envelope?.code})`);
  }
  return envelope.data;
}

/** Live contracts by symbol. */
export function parseMexcContracts(
  details: readonly MexcContractDetail[],
): Map<string, MexcContractDetail> {
  return new Map(details.filter((d) => d.state === LIVE_STATE).map((d) => [d.symbol, d]));
}

export function parseMexcFundingRate(data: MexcFundingRate, now: number): IntervalEntry | null {
  const hours = num(data.collectCycle);
  if (hours === null || hours <= 0) return null;
  return { hours, nextSettleTime: num(data.nextSettleTime), fetchedAt: now };
}

/**
 * Which symbols to fetch funding_rate for this cycle: never-fetched symbols first (in the given order),
 * then entries older than `maxAgeMs`, oldest first, capped at `budget`.
 */
export function selectIntervalRefreshes(
  symbols: readonly string[],
  cache: ReadonlyMap<string, IntervalEntry>,
  now: number,
  budget = INTERVAL_REFRESH_BUDGET,
  maxAgeMs = INTERVAL_MAX_AGE_MS,
): string[] {
  const missing = symbols.filter((s) => !cache.has(s));
  const stale = symbols
    .filter((s) => {
      const entry = cache.get(s);
      return entry !== undefined && now - entry.fetchedAt >= maxAgeMs;
    })
    .sort((a, b) => (cache.get(a)?.fetchedAt ?? 0) - (cache.get(b)?.fetchedAt ?? 0));
  return [...missing, ...stale].slice(0, Math.max(0, budget));
}

/** A cached next settlement time rolled forward past `now` by whole intervals. */
export function nextSettlementAfter(
  nextSettleTime: number | null,
  hours: number,
  now: number,
): number | null {
  if (nextSettleTime === null) return null;
  if (nextSettleTime > now) return nextSettleTime;
  const step = hours * HOUR_MS;
  return nextSettleTime + (Math.floor((now - nextSettleTime) / step) + 1) * step;
}

/** Snapshots for tickers that are live contracts with a known settlement interval. */
export function parseMexcSnapshots(
  tickers: readonly MexcTicker[],
  contracts: ReadonlyMap<string, MexcContractDetail>,
  intervals: ReadonlyMap<string, IntervalEntry>,
  now: number,
): FundingSnapshot[] {
  const snapshots: FundingSnapshot[] = [];
  for (const ticker of tickers) {
    const contract = contracts.get(ticker.symbol);
    const interval = intervals.get(ticker.symbol);
    const rate = num(ticker.fundingRate);
    if (!contract || !interval || rate === null) continue;

    const mark = num(ticker.fairPrice);
    // Coin-settled contracts (BTC_USD settles in BTC) are sized in USD and report turnover in the coin.
    const coinSettled = Boolean(contract.settleCoin) && contract.settleCoin === contract.baseCoin;
    snapshots.push({
      ...marketRef(VENUE, ticker.symbol, { quote: contract.quoteCoin }),
      observedAt: now,
      rate,
      basisHours: interval.hours,
      intervalHours: interval.hours,
      nextFundingAt: nextSettlementAfter(interval.nextSettleTime, interval.hours, now),
      kind: "predicted",
      markPrice: mark,
      indexPrice: num(ticker.indexPrice),
      openInterestUsd: coinSettled
        ? mul(num(ticker.holdVol), num(contract.contractSize))
        : mul(num(ticker.holdVol), num(contract.contractSize), mark),
      volume24hUsd: coinSettled ? mul(num(ticker.amount24), mark) : num(ticker.amount24),
    });
  }
  return snapshots;
}

/** Settled payments within [fromMs, toMs], oldest first, one per settlement time. */
export function parseMexcFundingHistory(
  items: MexcFundingHistoryPage["resultList"],
  venueSymbol: string,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const bySettlement = new Map<number, FundingEvent>();
  for (const item of items) {
    const settledAt = num(item.settleTime);
    const rate = num(item.fundingRate);
    const hours = num(item.collectCycle);
    if (settledAt === null || rate === null || hours === null || hours <= 0) continue;
    if (settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...marketRef(VENUE, venueSymbol),
      settledAt,
      rate,
      basisHours: hours,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export interface MexcAdapterOptions {
  intervalRefreshBudget?: number;
}

/**
 * MEXC's bulk ticker has no funding interval, so intervals come from per-symbol funding_rate calls,
 * cached and filled a budgeted batch per cycle. Symbols appear once their interval is known.
 */
export function createMexcAdapter(options: MexcAdapterOptions = {}): VenueAdapter {
  const budget = options.intervalRefreshBudget ?? INTERVAL_REFRESH_BUDGET;
  let contracts: { fetchedAt: number; bySymbol: Map<string, MexcContractDetail> } | null = null;
  const intervals = new Map<string, IntervalEntry>();

  return {
    venueId: VENUE,
    minIntervalMs: 110,

    async fetchSnapshots(client: HttpClient, now: number) {
      if (!contracts || now - contracts.fetchedAt >= CONTRACTS_MAX_AGE_MS) {
        const details = await client.getJson<MexcEnvelope<MexcContractDetail[]>>(`${BASE}/detail`);
        contracts = {
          fetchedAt: now,
          bySymbol: parseMexcContracts(unwrap(details, "contract detail")),
        };
      }
      const live = contracts.bySymbol;
      const tickers = unwrap(
        await client.getJson<MexcEnvelope<MexcTicker[]>>(`${BASE}/ticker`),
        "ticker",
      );
      const liveSymbols = tickers.map((t) => t.symbol).filter((s) => live.has(s));

      for (const symbol of intervals.keys()) {
        if (!live.has(symbol)) intervals.delete(symbol);
      }
      for (const symbol of selectIntervalRefreshes(liveSymbols, intervals, now, budget)) {
        try {
          const data = unwrap(
            await client.getJson<MexcEnvelope<MexcFundingRate>>(
              `${BASE}/funding_rate/${encodeURIComponent(symbol)}`,
            ),
            `funding_rate ${symbol}`,
          );
          const entry = parseMexcFundingRate(data, now);
          if (entry) intervals.set(symbol, entry);
        } catch (error) {
          if (error instanceof CircuitOpenError) break;
          // Leave this symbol for a later cycle; one bad symbol shouldn't fail the batch.
        }
      }

      return { snapshots: parseMexcSnapshots(tickers, live, intervals, now), settled: [] };
    },

    async fetchFundingHistory(
      client: HttpClient,
      venueSymbol: string,
      fromMs: number,
      toMs: number,
    ) {
      const items: MexcFundingHistoryPage["resultList"] = [];
      for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
        const url = `${BASE}/funding_rate/history?symbol=${encodeURIComponent(venueSymbol)}&page_num=${page}&page_size=${HISTORY_PAGE_SIZE}`;
        const data = unwrap(
          await client.getJson<MexcEnvelope<MexcFundingHistoryPage>>(url),
          "funding history",
        );
        items.push(...data.resultList);
        // Pages are newest first: stop once a page reaches back past the window or runs out.
        const oldest = Math.min(...data.resultList.map((r) => r.settleTime));
        if (data.resultList.length === 0 || oldest < fromMs || data.currentPage >= data.totalPage)
          break;
      }
      return parseMexcFundingHistory(items, venueSymbol, fromMs, toMs);
    },
  };
}

export const mexcAdapter = createMexcAdapter();
