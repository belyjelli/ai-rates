import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  type MarketRef,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { VenueAdapter } from "../types";
import { basisHoursFromGaps, declaredMarketBase } from "./aster";

/**
 * BloFin USDT- and USDC-margined perpetuals.
 *
 * Measured from this machine on 2026-09-13 22:28–22:35 UTC (docs: docs.blofin.com):
 *
 * - **Funding is NOT per-symbol only.** `/market/funding-rate` without `instId` answers for all 488
 *   instruments in one call, with the interval on every row (293 at 4h, 192 at 8h, 3 at 1h). So is
 *   `/market/mark-price` (mark and index), `/market/tickers` and `/market/open-interest`. A cycle
 *   is four bulk requests and instruments once an hour; nothing is budgeted per symbol.
 * - **`fundingRate` is the estimate for the next settlement, per interval.** BTC-USDT read
 *   0.00018548 and six minutes later 0.00018424, both stamped `fundingTime` 00:00 UTC (the next
 *   settlement), while the 16:00 settlement in history was 0.000184. Binance's estimate for the same
 *   00:00 settlement was 0.00006548: BloFin is 2.8x, not 8x, and its own settled history sits at
 *   0.000146–0.000184 every 8h all week, so this is BloFin's premium rather than a basis error. ETH
 *   read -0.0000252 against Binance's 0.0000644.
 * - **Units.** `contractValue` is base coin per contract (BTC-USDT 0.001, PNUT-USDT 10).
 *   `openInterest` is contracts: BTC-USDT 4,455,385 x 0.001 = 4,455.385, exactly its
 *   `openInterestCurrency`, and PNUT 595,376 x 10 = 5,953,760 likewise; at a 76,750 mark BTC is
 *   $342M. `vol24h` is contracts and `volCurrency24h` base coin (1,879,621.3 x 0.001 = 1,879.6213),
 *   so turnover is base volume x last, $144M for BTC. Book sizes are contracts like order sizes.
 * - **Tradability.** 488 instruments, all `live`: 474 linear SWAP settled in USDT (464) or USDC
 *   (10), collected; 14 inverse coin-margined BTC-USD, ETH-USD... dropped.
 * - **Class** is declared in `assetClass`: Crypto 462, Stocks 22, Commodities 2 (CL, NG), Indices 2
 *   (SPY, QQQ, which `marketRef` refines to equity as every ETF is). BloFin files XAU-USDT,
 *   XAG-USDT, WTIOIL-USDT and NATGAS-USDT as Crypto, and that declaration is kept.
 * - **Base.** `baseCurrency` agrees with the parser on all 474 except contract-size prefixes
 *   (1000BONK, 1000000MOG...), which the parser reads as multipliers, and NG, which both sides
 *   canonicalise to NATGAS. No base override fires on today's list.
 * - **History**: `/market/funding-rate-history?instId=&limit=100&after=<ms>`, newest first, `after`
 *   exclusive and older-than; `limit` above 100 answers 100.
 * - **Rate limit**: 500 requests a minute per IP (5-minute ban) and 1,500 per five minutes (1-hour
 *   ban), so 300 a minute sustained; 250ms spacing keeps a history backfill under it.
 */

const VENUE_ID = "blofin";
export const BLOFIN_API = "https://openapi.blofin.com/api/v1";
/** Instruments are 214 KB and only say what trades and what it is, so hourly. */
export const INSTRUMENTS_MAX_AGE_MS = 60 * 60_000;
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 50;
const DOLLAR_QUOTES: ReadonlySet<string> = new Set(["USDT", "USDC"]);

export interface BlofinEnvelope<T> {
  code: string;
  msg: string;
  data: T;
}

export interface BlofinInstrument {
  instId: string;
  baseCurrency: string;
  quoteCurrency: string;
  /** Base coin per contract. */
  contractValue: string;
  maxLeverage?: string;
  /** Crypto, Stocks, Commodities or Indices. */
  assetClass?: string;
  instType: string;
  contractType: string;
  state: string;
  settleCurrency: string;
}

export interface BlofinFundingRate {
  instId: string;
  /** Estimate for the settlement at `fundingTime`, as a fraction per interval. */
  fundingRate: string;
  fundingTime: string;
  fundingInterval: string;
  fundingIntervalUnit: string;
}

export interface BlofinMarkPrice {
  instId: string;
  indexPrice: string;
  markPrice: string;
}

export interface BlofinTicker {
  instId: string;
  last: string;
  /** Contracts. */
  askSize: string;
  askPrice: string;
  bidSize: string;
  bidPrice: string;
  /** Base coin. */
  volCurrency24h: string;
}

export interface BlofinOpenInterest {
  instId: string;
  /** Contracts. */
  openInterest: string;
}

export interface BlofinFundingHistoryRow {
  instId: string;
  fundingRate: string;
  fundingTime: string;
}

function unwrap<T>(json: BlofinEnvelope<T>, what: string): T {
  if (json?.code !== "0" || json.data === null || json.data === undefined) {
    throw new Error(`blofin ${what}: ${json?.code} ${json?.msg ?? ""}`);
  }
  return json.data;
}

/** Live linear perpetuals settled in USDT or USDC, in the currency they are quoted in. */
export function isBlofinTradable(instrument: BlofinInstrument): boolean {
  return (
    instrument.instType === "SWAP" &&
    instrument.contractType === "linear" &&
    instrument.state === "live" &&
    DOLLAR_QUOTES.has(instrument.settleCurrency) &&
    instrument.quoteCurrency === instrument.settleCurrency
  );
}

/** BloFin's declared class. An empty declaration is crypto; a label we don't know is tradfi of some kind. */
export function blofinAssetClass(declared: string | undefined, base: string): AssetClass {
  switch (declared) {
    case undefined:
    case "":
    case "Crypto":
      return "crypto";
    case "Stocks":
      return "equity";
    case "Indices":
      return "index";
    case "Commodities":
      return "commodity";
    default:
      return classifyNonCrypto(base);
  }
}

/** `fundingInterval` in its declared unit, as hours; null for a unit BloFin has not used. */
export function blofinIntervalHours(interval: string, unit: string): number | null {
  const n = num(interval);
  if (n === null || n <= 0) return null;
  switch (unit) {
    case "hour":
      return n;
    case "minute":
      return n / 60;
    case "day":
      return n * 24;
    default:
      return null;
  }
}

function blofinRef(instrument: BlofinInstrument): MarketRef {
  const declared = declaredMarketBase({
    symbol: instrument.instId,
    contractType: "",
    baseAsset: instrument.baseCurrency,
    quoteAsset: instrument.settleCurrency,
  });
  const overrides = { quote: instrument.settleCurrency, ...(declared ? { base: declared } : {}) };
  const { base } = marketRef(VENUE_ID, instrument.instId, overrides);
  return marketRef(VENUE_ID, instrument.instId, {
    ...overrides,
    assetClass: blofinAssetClass(instrument.assetClass, base),
  });
}

export interface BlofinSnapshotInput {
  instruments: readonly BlofinInstrument[];
  funding: readonly BlofinFundingRate[];
  marks: readonly BlofinMarkPrice[];
  tickers: readonly BlofinTicker[];
  openInterest: readonly BlofinOpenInterest[];
}

/** Joins the four bulk responses onto tradable instruments, in funding-rate order. */
export function parseBlofinSnapshots(input: BlofinSnapshotInput, now: number): FundingSnapshot[] {
  const tradable = new Map(input.instruments.filter(isBlofinTradable).map((i) => [i.instId, i]));
  const marks = new Map(input.marks.map((m) => [m.instId, m]));
  const tickers = new Map(input.tickers.map((t) => [t.instId, t]));
  const openInterest = new Map(input.openInterest.map((o) => [o.instId, num(o.openInterest)]));

  const snapshots: FundingSnapshot[] = [];
  for (const row of input.funding) {
    const instrument = tradable.get(row.instId);
    const rate = num(row.fundingRate);
    const hours = blofinIntervalHours(row.fundingInterval, row.fundingIntervalUnit);
    if (!instrument || rate === null || hours === null) continue;

    const mark = marks.get(row.instId);
    const ticker = tickers.get(row.instId);
    const markPrice = num(mark?.markPrice);
    const contractValue = num(instrument.contractValue);
    const next = num(row.fundingTime);
    const bestBid = num(ticker?.bidPrice);
    const bestAsk = num(ticker?.askPrice);
    snapshots.push({
      ...blofinRef(instrument),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(mark?.indexPrice),
      bestBid,
      bestBidSizeUsd: mul(num(ticker?.bidSize), contractValue, bestBid),
      bestAsk,
      bestAskSizeUsd: mul(num(ticker?.askSize), contractValue, bestAsk),
      openInterestUsd: mul(openInterest.get(row.instId) ?? null, contractValue, markPrice),
      volume24hUsd: mul(num(ticker?.volCurrency24h), num(ticker?.last) ?? markPrice),
      maxLeverage: num(instrument.maxLeverage),
    });
  }
  return snapshots;
}

/**
 * Settlements for one instrument in [fromMs, toMs], oldest first. BloFin's history carries no
 * interval, so each basis is the gap to its nearest neighbour, or the instrument's current interval
 * for a lone row.
 */
export function parseBlofinFundingHistory(
  ref: MarketRef,
  rows: readonly BlofinFundingHistoryRow[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
): FundingEvent[] {
  const byTime = new Map<number, number>();
  for (const row of rows) {
    const time = num(row.fundingTime);
    const rate = num(row.fundingRate);
    if (time !== null && time > 0 && rate !== null) byTime.set(time, rate);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  const basis = basisHoursFromGaps(times, fallbackHours);

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

export function createBlofinAdapter(): VenueAdapter {
  let instruments: { fetchedAt: number; rows: BlofinInstrument[] } | null = null;
  let known = new Map<string, { ref: MarketRef; intervalHours: number | null }>();

  const get = <T>(client: HttpClient, path: string, what: string) =>
    client.getJson<BlofinEnvelope<T>>(`${BLOFIN_API}${path}`).then((json) => unwrap(json, what));

  return {
    venueId: VENUE_ID,
    // 1,500 requests per 5 minutes per IP is the binding limit: 300 a minute. 250ms is 240.
    minIntervalMs: 250,

    async fetchSnapshots(client, now) {
      if (!instruments || now - instruments.fetchedAt >= INSTRUMENTS_MAX_AGE_MS) {
        const rows = await get<BlofinInstrument[]>(client, "/market/instruments", "instruments");
        instruments = { fetchedAt: now, rows };
      }
      const [funding, marks, tickers, openInterest] = await Promise.all([
        get<BlofinFundingRate[]>(client, "/market/funding-rate", "funding rate"),
        get<BlofinMarkPrice[]>(client, "/market/mark-price", "mark price"),
        get<BlofinTicker[]>(client, "/market/tickers", "tickers"),
        get<BlofinOpenInterest[]>(client, "/market/open-interest", "open interest"),
      ]);
      const snapshots = parseBlofinSnapshots(
        { instruments: instruments.rows, funding, marks, tickers, openInterest },
        now,
      );
      known = new Map(
        snapshots.map((s) => [
          s.venueSymbol,
          {
            ref: {
              venueId: s.venueId,
              venueSymbol: s.venueSymbol,
              base: s.base,
              assetClass: s.assetClass,
              quote: s.quote,
              multiplier: s.multiplier,
              dex: s.dex,
            },
            intervalHours: s.intervalHours,
          },
        ]),
      );
      return { snapshots, settled: [] };
    },

    /** Pages backwards with `after`, which returns rows strictly older than the given time. */
    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const rows: BlofinFundingHistoryRow[] = [];
      let after = toMs + 1;
      for (let page = 0; page < HISTORY_MAX_PAGES && after > fromMs; page++) {
        const list = await get<BlofinFundingHistoryRow[]>(
          client,
          `/market/funding-rate-history?instId=${encodeURIComponent(venueSymbol)}&limit=${HISTORY_PAGE_SIZE}&after=${after}`,
          "funding history",
        );
        rows.push(...list);
        if (list.length < HISTORY_PAGE_SIZE) break;
        after = Math.min(...list.map((r) => Number(r.fundingTime)));
      }
      const market = known.get(venueSymbol);
      return parseBlofinFundingHistory(
        market?.ref ?? marketRef(VENUE_ID, venueSymbol),
        rows,
        fromMs,
        toMs,
        market?.intervalHours ?? null,
      );
    },
  };
}

export const blofinAdapter: VenueAdapter = createBlofinAdapter();
