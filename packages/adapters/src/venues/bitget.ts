import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  type MarketRef,
  parseVenueSymbol,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "bitget";
const BASE_URL = "https://api.bitget.com";
const OK = "00000";

/**
 * The two linear perpetual books. COIN-FUTURES is inverse -- 9 perpetuals and 2 deliveries on
 * 2026-09-14, margined in the base coin -- and is not collected.
 */
export const BITGET_CATEGORIES = ["USDT-FUTURES", "USDC-FUTURES"] as const;
export type BitgetCategory = (typeof BITGET_CATEGORIES)[number];

/** Instruments only say what trades and what it is, and weigh ~660 KB for both books, so hourly. */
export const INSTRUMENTS_MAX_AGE_MS = 60 * 60_000;
/** `history-fund-rate` caps `pageSize` at 100 and pages newest first by `pageNo`. */
const HISTORY_PAGE = 100;
/** 90 days of 1h settlements is 22 pages; the loop stops as soon as a page reaches `fromMs`. */
const HISTORY_MAX_PAGES = 30;

export interface BitgetEnvelope<T> {
  code: string;
  msg: string;
  data: T;
}

/** One row of `/api/v3/market/instruments`, which declares class where v2 `/contracts` does not. */
export interface BitgetInstrument {
  symbol: string;
  baseCoin: string;
  /** The settlement coin: USDT on every USDT-FUTURES row, USDC on every USDC-FUTURES row. */
  quoteCoin: string;
  /** "crypto", "stock", "metal" or "commodity" on 2026-09-14. */
  symbolType?: string;
  /** "YES" on every real-world asset, including FX pairs and indices `symbolType` calls crypto. */
  isRwa?: string;
  /** "perpetual" on all 836 rows of both books. */
  type: string;
  /** "online" on all 836 rows of both books. */
  status: string;
  /** Hours. */
  fundInterval: string;
  /** Headline leverage; the tiered ladder is the precise source. */
  maxLeverage?: string;
}

export interface BitgetTicker {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  /** Base coin, not contracts. */
  openInterest: string;
  /** Quote currency. */
  turnover24h: string;
  /** Top of book. Prices are quote currency; the paired sizes are base coin. */
  bid1Price?: string;
  bid1Size?: string;
  ask1Price?: string;
  ask1Size?: string;
}

export interface BitgetCurrentFundRate {
  symbol: string;
  /** Estimate for the settlement at `nextUpdate`, over `fundingRateInterval` hours. */
  fundingRate: string;
  fundingRateInterval: string;
  /** Epoch ms. */
  nextUpdate: string;
}

export interface BitgetFundingHistoryItem {
  symbol: string;
  fundingRate: string;
  /** Epoch ms of the settlement. */
  fundingTime: string;
}

function unwrap<T>(json: BitgetEnvelope<T[]>, what: string): T[] {
  if (json?.code !== OK || !Array.isArray(json.data)) {
    throw new Error(`bitget ${what}: ${json?.code} ${json?.msg ?? ""}`);
  }
  return json.data;
}

/**
 * The class Bitget declares for a contract, from `symbolType` and `isRwa` on v3 instruments.
 *
 * Neither field is enough alone. Live 2026-09-14, 787 USDT-FUTURES perpetuals: `symbolType` crypto
 * 477, stock 300, metal 7 (PAXG, XAUT, XAU, XAG, XPT, XPD, COPPER), commodity 3 (CL, BZ, NATGAS);
 * `isRwa` YES on 321. The 11 rows that are `isRwa` YES yet `symbolType` crypto are EURUSD, USDJPY,
 * GBPUSD, H100, B200, KUAISHOU, HPQ, FCX, BHP, RIO and VALE -- currencies, indices and shares with
 * no class of their own in `symbolType` -- so `isRwa` says whether, and the base tables say which.
 * No row is `isRwa` NO with a non-crypto `symbolType`. All 49 USDC-FUTURES rows are crypto and NO.
 *
 * PAXG and XAUT arrive as metal and leave `marketRef` as crypto, as on every venue. A `symbolType`
 * this does not know is still a declaration that the contract is not crypto.
 */
export function bitgetAssetClass(
  instrument: Pick<BitgetInstrument, "symbolType" | "isRwa">,
  base: string,
): AssetClass {
  const type = instrument.symbolType ?? "";
  if (instrument.isRwa !== "YES" && (type === "" || type === "crypto")) return "crypto";
  switch (type) {
    case "stock":
      return "equity";
    case "metal":
    case "commodity":
      return "commodity";
    default:
      return classifyNonCrypto(canonicalBase(base));
  }
}

/**
 * The market identity for an instrument: the parser's reading of the symbol, unless the declared
 * `baseCoin` disagrees with it.
 *
 * Checked across all 836 live instruments on 2026-09-14: the parser agrees on every USDT-FUTURES
 * row (STXSTOCK, NOKSTOCK and friends included -- the venue declares those bases too) and on none
 * of the 49 USDC-FUTURES rows, which are named `BTCPERP`, `1000BONKPERP`: with no quote in the
 * symbol the whole name became the base. The declaration is read through the parser as
 * `BASE-QUOTE`, so `1000BONK` still becomes BONK at a 1000x multiplier.
 */
export function bitgetMarketRef(instrument: BitgetInstrument): MarketRef {
  const parsed = parseVenueSymbol(instrument.symbol);
  const declared = instrument.baseCoin
    ? parseVenueSymbol(`${instrument.baseCoin}-${instrument.quoteCoin}`)
    : parsed;
  const agrees = parsed.base === declared.base && parsed.multiplier === declared.multiplier;
  return marketRef(VENUE_ID, instrument.symbol, {
    ...(agrees ? {} : { base: declared.base, multiplier: declared.multiplier }),
    quote: instrument.quoteCoin,
    assetClass: bitgetAssetClass(instrument, declared.base),
  });
}

/**
 * Online linear perpetuals. On 2026-09-14 every instrument in both books passes (787 USDT, 49 USDC):
 * the filter is for the statuses Bitget documents but was not using -- `listed`, `limit_open`,
 * `limit_close`, `offline` -- and for the delivery contracts it lists only in COIN-FUTURES.
 * `current-fund-rate` also answers for 11 symbols with no instrument (BGTESTMEUSDT, RWATESTMEUSDT
 * and pre-launch names); the join through instruments drops them.
 */
export function isBitgetTradable(instrument: BitgetInstrument): boolean {
  return (
    instrument.type === "perpetual" &&
    instrument.status === "online" &&
    (instrument.quoteCoin === "USDT" || instrument.quoteCoin === "USDC")
  );
}

/** One book's snapshots: instruments joined to tickers (prices, stats) and current funding. */
export function parseBitgetSnapshots(
  instruments: readonly BitgetInstrument[],
  tickers: BitgetEnvelope<BitgetTicker[]>,
  fundRates: BitgetEnvelope<BitgetCurrentFundRate[]>,
  now: number,
): SnapshotBatch {
  const tickerBySymbol = new Map(unwrap(tickers, "tickers").map((t) => [t.symbol, t]));
  const fundingBySymbol = new Map(unwrap(fundRates, "current-fund-rate").map((f) => [f.symbol, f]));

  const snapshots: FundingSnapshot[] = [];
  for (const instrument of instruments) {
    if (!isBitgetTradable(instrument)) continue;
    const funding = fundingBySymbol.get(instrument.symbol);
    const rate = num(funding?.fundingRate);
    const hours = num(funding?.fundingRateInterval) ?? num(instrument.fundInterval);
    if (!funding || rate === null || hours === null || hours <= 0) continue;

    const ticker = tickerBySymbol.get(instrument.symbol);
    const markPrice = ticker ? num(ticker.markPrice) : null;
    const next = num(funding.nextUpdate);
    snapshots.push({
      ...bitgetMarketRef(instrument),
      observedAt: now,
      // Predicted, not settled: at 22:06 UTC on 2026-09-13 BTCUSDT read 0.00005 here, for the 00:00
      // settlement, while the 16:00 settlement in history-fund-rate was 0.000076.
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice,
      indexPrice: ticker ? num(ticker.indexPrice) : null,
      // Sizes are base coin, the same unit as open interest below, so depth is size x price.
      bestBid: ticker ? num(ticker.bid1Price) : null,
      bestBidSizeUsd: ticker ? mul(num(ticker.bid1Size), num(ticker.bid1Price)) : null,
      bestAsk: ticker ? num(ticker.ask1Price) : null,
      bestAskSizeUsd: ticker ? mul(num(ticker.ask1Size), num(ticker.ask1Price)) : null,
      // `openInterest` is base coin, not contracts, whatever the contract size: BTCUSDT's 35,917 at
      // a 76,968 mark is $2.76bn, and SHIBUSDT's 1.86e12 at 0.000005184 is $9.6m -- read as
      // contracts at its 10,000 `quantityMultiplier` it would be $96bn. It matches v2
      // `open-interest` `size`, which ccxt reads as an amount in base coin.
      openInterestUsd: ticker ? mul(num(ticker.openInterest), markPrice) : null,
      // Quote turnover: BTCUSDT's 1,051,194,917 is its 13,655.88 BTC volume x the last price.
      volume24hUsd: ticker ? num(ticker.turnover24h) : null,
      maxLeverage: num(instrument.maxLeverage),
    });
  }
  return { snapshots, settled: [] };
}

/**
 * Settled funding for one market inside [fromMs, toMs], oldest first. The interval is inferred from
 * every row fetched, including those outside the window, so a one-event window still gets a basis;
 * `fallbackHours` covers a market with a single settlement ever.
 */
export function parseBitgetFundingHistory(
  ref: MarketRef,
  items: readonly BitgetFundingHistoryItem[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
): FundingEvent[] {
  const rates = new Map<number, number>();
  for (const item of items) {
    const settledAt = num(item.fundingTime);
    const rate = num(item.fundingRate);
    if (settledAt !== null && settledAt > 0 && rate !== null) rates.set(settledAt, rate);
  }
  const basisHours = inferIntervalHours([...rates.keys()]) ?? fallbackHours;
  if (basisHours === null) return [];

  return [...rates]
    .filter(([settledAt]) => settledAt >= fromMs && settledAt <= toMs)
    .sort((a, b) => a[0] - b[0])
    .map(([settledAt, rate]) => ({ ...ref, settledAt, rate, basisHours, markPrice: null }));
}

function refOf(snapshot: FundingSnapshot): MarketRef {
  const { venueId, venueSymbol, base, assetClass, quote, multiplier, dex } = snapshot;
  return { venueId, venueSymbol, base, assetClass, quote, multiplier, dex };
}

interface KnownMarket {
  category: BitgetCategory;
  ref: MarketRef;
  intervalHours: number | null;
}

/**
 * Bitget's USDT- and USDC-margined perpetuals.
 *
 * Four requests a cycle -- `tickers` and `current-fund-rate` for each book -- plus the two
 * `instruments` calls once an hour. Every figure the snapshot needs is in those bulk responses;
 * nothing is fetched per symbol.
 */
export function createBitgetAdapter(): VenueAdapter {
  let instruments: {
    fetchedAt: number;
    byCategory: Map<BitgetCategory, BitgetInstrument[]>;
  } | null = null;
  let known = new Map<string, KnownMarket>();

  return {
    venueId: VENUE_ID,
    // Bitget allows 20 requests a second per IP on each public market endpoint (the response
    // header `x-mbx-used-remain-limit` counts down from 19); 10 a second leaves half of it spare.
    minIntervalMs: 100,

    async fetchSnapshots(client: HttpClient, now: number) {
      if (!instruments || now - instruments.fetchedAt >= INSTRUMENTS_MAX_AGE_MS) {
        const fetched = await Promise.all(
          BITGET_CATEGORIES.map(async (category) => {
            const json = await client.getJson<BitgetEnvelope<BitgetInstrument[]>>(
              `${BASE_URL}/api/v3/market/instruments?category=${category}`,
            );
            return [category, unwrap(json, "instruments")] as const;
          }),
        );
        instruments = { fetchedAt: now, byCategory: new Map(fetched) };
      }
      const byCategory = instruments.byCategory;

      const books = await Promise.all(
        BITGET_CATEGORIES.map(async (category) => {
          const [tickers, fundRates] = await Promise.all([
            client.getJson<BitgetEnvelope<BitgetTicker[]>>(
              `${BASE_URL}/api/v3/market/tickers?category=${category}`,
            ),
            client.getJson<BitgetEnvelope<BitgetCurrentFundRate[]>>(
              `${BASE_URL}/api/v3/market/current-fund-rate?category=${category}`,
            ),
          ]);
          const rows = byCategory.get(category) ?? [];
          return { category, ...parseBitgetSnapshots(rows, tickers, fundRates, now) };
        }),
      );

      const next = new Map<string, KnownMarket>();
      for (const book of books) {
        for (const snapshot of book.snapshots) {
          next.set(snapshot.venueSymbol, {
            category: book.category,
            ref: refOf(snapshot),
            intervalHours: snapshot.intervalHours,
          });
        }
      }
      known = next;
      return { snapshots: books.flatMap((b) => b.snapshots), settled: [] };
    },

    /**
     * Pages `history-fund-rate` from the newest settlement back until a page reaches `fromMs`. It
     * takes no time bounds (the v2 endpoint ignores `startTime`/`endTime`), only `pageNo`.
     *
     * The book and identity come from the last snapshot cycle. History asked for before any cycle
     * has run falls back to the symbol: USDC books are the ones named `…PERP`, and their base is
     * then the parser's.
     */
    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const market = known.get(venueSymbol);
      const category: BitgetCategory =
        market?.category ?? (venueSymbol.endsWith("PERP") ? "USDC-FUTURES" : "USDT-FUTURES");

      const items: BitgetFundingHistoryItem[] = [];
      for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
        const json = await client.getJson<BitgetEnvelope<BitgetFundingHistoryItem[]>>(
          `${BASE_URL}/api/v2/mix/market/history-fund-rate?symbol=${encodeURIComponent(venueSymbol)}&productType=${category.toLowerCase()}&pageSize=${HISTORY_PAGE}&pageNo=${page}`,
        );
        const list = unwrap(json, "funding history");
        items.push(...list);
        if (list.length < HISTORY_PAGE) break;
        if (Math.min(...list.map((i) => Number(i.fundingTime))) < fromMs) break;
      }

      return parseBitgetFundingHistory(
        market?.ref ?? marketRef(VENUE_ID, venueSymbol),
        items,
        fromMs,
        toMs,
        market?.intervalHours ?? null,
      );
    },
  };
}

export const bitgetAdapter = createBitgetAdapter();
