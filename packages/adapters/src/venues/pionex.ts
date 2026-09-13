import { type FundingEvent, type FundingSnapshot, inferIntervalHours } from "@ai-rates/core";
import { CircuitOpenError } from "../http";
import { hoursBetween, marketRef, mul, num, selectRefreshBatch } from "../parse";
import type { VenueAdapter } from "../types";
import { basisHoursFromGaps } from "./aster";

const VENUE_ID = "pionex";
export const PIONEX_API = "https://api.pionex.com/api/v1";
/** The PERP symbol list is 250 KB and weight 5 of a 10-per-second budget, so hourly. */
export const SYMBOLS_MAX_AGE_MS = 60 * 60_000;
/**
 * Pionex publishes no settlement interval in any bulk response, and the interval varies (1h, 4h
 * and 8h all trade), so it is read per symbol from the spacing of its last settlements. At this
 * budget a cold start covers the ~570 dollar perps in about 19 cycles; `warmUp` skips that.
 */
export const INTERVAL_REFRESH_BUDGET = 30;
export const INTERVAL_MAX_AGE_MS = 6 * 60 * 60_000;
/** A symbol with no settlement yet has no interval to read; look again after this long. */
const INTERVAL_RETRY_MS = 30 * 60_000;
const INTERVAL_SAMPLE = 4;
/** `limit` above 100 is refused with MARKET_PARAMETER_ERROR (measured 2026-09-14). */
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 50;
/**
 * Quotes collected. 43 of Pionex's 610 perps on 2026-09-14 price one coin in another (BTC_ETH_PERP,
 * PAXG_BTC_PERP, QQQX_SPYX_PERP), so their open interest and volume are not dollars and their mark
 * belongs in no USD pool.
 */
const DOLLAR_QUOTES: ReadonlySet<string> = new Set(["USDT", "USDC"]);

export interface PionexEnvelope<T> {
  result: boolean;
  data: T;
  code?: string;
  message?: string;
  timestamp?: number;
}

export interface PionexSymbol {
  symbol: string;
  type: string;
  /** Pionex's own coin code, which is not always the ticker: ZEROG for 0G, LIGHTER for LIT. */
  baseCurrency: string;
  quoteCurrency: string;
  status: string;
}

export interface PionexIndex {
  symbol: string;
  indexPrice: string;
  markPrice: string;
  /** Rate to be paid at `nextFundingTime`, per settlement interval. */
  nextFundingRate: string;
  nextFundingTime: number;
}

export interface PionexTicker {
  symbol: string;
  /** 24h volume in base units. */
  volume: string;
  /** 24h turnover in the quote currency. */
  amount: string;
}

export interface PionexOpenInterest {
  symbol: string;
  /** Base units. */
  openInterest: string;
}

export interface PionexBookTicker {
  symbol: string;
  bidPrice: string;
  /** Base units. */
  bidSize: string;
  askPrice: string;
  askSize: string;
}

export interface PionexFundingRate {
  fundingRate: string;
  fundingTime: number;
}

export interface PionexIntervalEntry {
  hours: number | null;
  fetchedAt: number;
}

function unwrap<T>(json: PionexEnvelope<T>, what: string): T {
  if (!json?.result || json.data === undefined || json.data === null) {
    throw new Error(`pionex ${what}: ${json?.code ?? ""} ${json?.message ?? ""}`);
  }
  return json.data;
}

/** Dollar-quoted perps Pionex lists as TRADING, by symbol. */
export function tradablePionexPerps(symbols: readonly PionexSymbol[]): Map<string, PionexSymbol> {
  return new Map(
    symbols
      .filter(
        (s) => s.type === "PERP" && s.status === "TRADING" && DOLLAR_QUOTES.has(s.quoteCurrency),
      )
      .map((s) => [s.symbol, s]),
  );
}

/**
 * Settlement interval from a symbol's most recent settlements (newest first, as served).
 *
 * The median gap when there are two or more: ACT_USDT_PERP settled every 4h, ACH_USDT_PERP every 8h
 * and AAX_USDT_PERP every hour on 2026-09-14. A listing with a single settlement so far is measured
 * against its next one instead.
 */
export function pionexIntervalHours(
  rates: readonly PionexFundingRate[],
  nextFundingTime: number | null,
): number | null {
  const times = rates.map((r) => num(r.fundingTime)).filter((t): t is number => t !== null);
  if (times.length >= 2) return inferIntervalHours(times);
  if (times.length === 1) return hoursBetween(times[0] as number, nextFundingTime);
  return null;
}

export interface PionexSnapshotInput {
  symbols: ReadonlyMap<string, PionexSymbol>;
  indexes: readonly PionexIndex[];
  tickers: readonly PionexTicker[];
  openInterests: readonly PionexOpenInterest[];
  bookTickers: readonly PionexBookTicker[];
  intervals: ReadonlyMap<string, PionexIntervalEntry>;
}

/**
 * Joins the bulk index, ticker, open-interest and book responses onto tradable perps whose interval
 * is known. A perp appears once its interval has been read.
 *
 * Units, checked against the live responses of 2026-09-14 22:01 UTC:
 * - `nextFundingRate` is a fraction per settlement interval: the resting rate is 0.0001 on 8h perps
 *   (ACH), 0.00005 on 4h perps (ACT), and each of those settled at exactly that in the history.
 * - `openInterest` is base units: BTC_USDT_PERP 1,335.1442 x mark 77,096 = $102.9M, against 24h
 *   turnover of $1.99bn. Read as dollars it would be $1,335 of BTC open interest.
 * - `amount` is quote turnover: BTC volume 25,822.66 x the day's range 76,463-77,423 brackets
 *   1,989,264,906 (average 77,036).
 * - Book sizes are base units, like order sizes (`minSizeLimit` 0.0001 BTC).
 *
 * Pionex declares no asset class anywhere in its public API, so every perp is crypto. Its AAPLX,
 * TSLAX and friends are xStocks tokens in any case.
 */
export function parsePionexSnapshots(input: PionexSnapshotInput, now: number): FundingSnapshot[] {
  const tickers = new Map(input.tickers.map((t) => [t.symbol, t]));
  const openInterest = new Map(input.openInterests.map((o) => [o.symbol, num(o.openInterest)]));
  const books = new Map(input.bookTickers.map((b) => [b.symbol, b]));
  const snapshots: FundingSnapshot[] = [];

  for (const index of input.indexes) {
    const symbol = input.symbols.get(index.symbol);
    const rate = num(index.nextFundingRate);
    const hours = input.intervals.get(index.symbol)?.hours ?? null;
    if (!symbol || rate === null || hours === null || hours <= 0) continue;

    const markPrice = num(index.markPrice);
    const next = num(index.nextFundingTime);
    const book = books.get(index.symbol);
    const bestBid = num(book?.bidPrice);
    const bestAsk = num(book?.askPrice);
    snapshots.push({
      ...marketRef(VENUE_ID, index.symbol, { quote: symbol.quoteCurrency }),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(index.indexPrice),
      bestBid,
      bestBidSizeUsd: mul(num(book?.bidSize), bestBid),
      bestAsk,
      bestAskSizeUsd: mul(num(book?.askSize), bestAsk),
      openInterestUsd: mul(openInterest.get(index.symbol) ?? null, markPrice),
      volume24hUsd: num(tickers.get(index.symbol)?.amount),
    });
  }
  return snapshots;
}

/**
 * Settlements for one perp in [fromMs, toMs], oldest first. Basis hours come from the gaps between
 * every fetched settlement, including the neighbours just outside the window.
 */
export function parsePionexFundingHistory(
  venueSymbol: string,
  rows: readonly PionexFundingRate[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
  quote?: string,
): FundingEvent[] {
  const byTime = new Map<number, number>();
  for (const row of rows) {
    const time = num(row.fundingTime);
    const rate = num(row.fundingRate);
    if (time !== null && rate !== null) byTime.set(time, rate);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  const basis = basisHoursFromGaps(times, fallbackHours);
  const ref = marketRef(VENUE_ID, venueSymbol, quote ? { quote } : {});

  const events: FundingEvent[] = [];
  times.forEach((settledAt, i) => {
    const basisHours = basis[i];
    if (settledAt < fromMs || settledAt > toMs || basisHours === null || basisHours === undefined) {
      return;
    }
    events.push({
      ...ref,
      settledAt,
      rate: byTime.get(settledAt) as number,
      basisHours,
      markPrice: null,
    });
  });
  return events;
}

export interface PionexAdapterOptions {
  intervalRefreshBudget?: number;
}

export function createPionexAdapter(options: PionexAdapterOptions = {}): VenueAdapter {
  const budget = options.intervalRefreshBudget ?? INTERVAL_REFRESH_BUDGET;
  let symbols: { fetchedAt: number; bySymbol: Map<string, PionexSymbol> } | null = null;
  const intervals = new Map<string, PionexIntervalEntry>();

  const fundingRatesUrl = (symbol: string, limit: number, endTime?: number) =>
    `${PIONEX_API}/market/fundingRates?symbol=${encodeURIComponent(symbol)}${endTime === undefined ? "" : `&endTime=${endTime}`}&limit=${limit}`;

  return {
    venueId: VENUE_ID,
    // 10 weight per second per IP, shared by every endpoint; the symbol list alone weighs 5.
    minIntervalMs: 150,

    /** The stored interval is what the history would say again; fetchedAt 0 keeps it due for a re-read. */
    warmUp(markets) {
      for (const market of markets) {
        const hours = market.intervalHours;
        if (hours !== null && hours > 0 && !intervals.has(market.venueSymbol)) {
          intervals.set(market.venueSymbol, { hours, fetchedAt: 0 });
        }
      }
    },

    async fetchSnapshots(client, now) {
      if (!symbols || now - symbols.fetchedAt >= SYMBOLS_MAX_AGE_MS) {
        const data = unwrap(
          await client.getJson<PionexEnvelope<{ symbols: PionexSymbol[] }>>(
            `${PIONEX_API}/common/symbols?type=PERP`,
          ),
          "symbols",
        );
        symbols = { fetchedAt: now, bySymbol: tradablePionexPerps(data.symbols ?? []) };
      }
      const live = symbols.bySymbol;

      const [indexes, tickers, openInterests, bookTickers] = await Promise.all([
        client
          .getJson<PionexEnvelope<{ indexes: PionexIndex[] }>>(`${PIONEX_API}/market/indexes`)
          .then((json) => unwrap(json, "indexes").indexes ?? []),
        client
          .getJson<PionexEnvelope<{ tickers: PionexTicker[] }>>(
            `${PIONEX_API}/market/tickers?type=PERP`,
          )
          .then((json) => unwrap(json, "tickers").tickers ?? []),
        client
          .getJson<PionexEnvelope<{ openInterests: PionexOpenInterest[] }>>(
            `${PIONEX_API}/market/openInterests?type=PERP`,
          )
          .then((json) => unwrap(json, "open interests").openInterests ?? []),
        client
          .getJson<PionexEnvelope<{ tickers: PionexBookTicker[] }>>(
            `${PIONEX_API}/market/bookTickers?type=PERP`,
          )
          .then((json) => unwrap(json, "book tickers").tickers ?? []),
      ]);

      for (const symbol of intervals.keys()) {
        if (!live.has(symbol)) intervals.delete(symbol);
      }
      const nextFunding = new Map(indexes.map((i) => [i.symbol, num(i.nextFundingTime)]));
      const liveSymbols = indexes.map((i) => i.symbol).filter((s) => live.has(s));
      for (const symbol of selectRefreshBatch(
        liveSymbols,
        intervals,
        now,
        budget,
        INTERVAL_MAX_AGE_MS,
      )) {
        try {
          const data = unwrap(
            await client.getJson<PionexEnvelope<{ rates: PionexFundingRate[] }>>(
              fundingRatesUrl(symbol, INTERVAL_SAMPLE),
            ),
            `funding rates ${symbol}`,
          );
          const hours = pionexIntervalHours(data.rates ?? [], nextFunding.get(symbol) ?? null);
          if (hours !== null && hours > 0) {
            intervals.set(symbol, { hours, fetchedAt: now });
          } else {
            // Nothing settled yet. Keep any interval already known, and come back sooner than the
            // full max age by back-dating the entry.
            const known = intervals.get(symbol)?.hours ?? null;
            intervals.set(symbol, {
              hours: known,
              fetchedAt: now - INTERVAL_MAX_AGE_MS + INTERVAL_RETRY_MS,
            });
          }
        } catch (error) {
          if (error instanceof CircuitOpenError) break;
          // Leave this symbol for a later cycle; one bad symbol shouldn't fail the batch.
        }
      }

      const snapshots = parsePionexSnapshots(
        { symbols: live, indexes, tickers, openInterests, bookTickers, intervals },
        now,
      );
      return { snapshots, settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      // Newest first; `endTime` is inclusive and `startTime` is ignored, so page backwards from toMs.
      const rows: PionexFundingRate[] = [];
      let endTime = toMs;
      for (let page = 0; page < HISTORY_MAX_PAGES && endTime >= fromMs; page++) {
        const list =
          unwrap(
            await client.getJson<PionexEnvelope<{ rates: PionexFundingRate[] }>>(
              fundingRatesUrl(venueSymbol, HISTORY_PAGE_SIZE, endTime),
            ),
            "funding rates",
          ).rates ?? [];
        rows.push(...list);
        if (list.length < HISTORY_PAGE_SIZE) break;
        endTime = Math.min(...list.map((r) => Number(r.fundingTime))) - 1;
      }
      return parsePionexFundingHistory(
        venueSymbol,
        rows,
        fromMs,
        toMs,
        intervals.get(venueSymbol)?.hours ?? null,
        symbols?.bySymbol.get(venueSymbol)?.quoteCurrency,
      );
    },
  };
}

export const pionexAdapter: VenueAdapter = createPionexAdapter();
