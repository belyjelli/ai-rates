import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  type MarketRef,
} from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { marketRef, mul, num, selectRefreshBatch } from "../parse";
import type { VenueAdapter } from "../types";

const VENUE_ID = "bingx";
const BASE_URL = "https://open-api.bingx.com/openApi/swap/v2";
const OK = 0;
/** `status` on /quote/contracts: 1 is listed and funded; 25 is suspended (see `isBingxTradable`). */
const LIVE_STATUS = 1;
/** /quote/contracts is ~580 KB and only says what trades and what it is, so hourly. */
export const CONTRACTS_MAX_AGE_MS = 60 * 60_000;
/**
 * Open interest is per symbol only: /quote/openInterest rejects a missing symbol, and neither
 * premiumIndex nor ticker carries it. ~1,000 markets at this budget is a full sweep about every ten
 * cycles, well inside the 10-minute age, and 100 calls at 100ms spacing is ten seconds a cycle.
 */
export const OPEN_INTEREST_BUDGET = 100;
export const OPEN_INTEREST_MAX_AGE_MS = 10 * 60_000;
/** /quote/fundingRate accepts up to 1000 rows; 2000 is rejected. */
const HISTORY_LIMIT = 1000;
const HISTORY_MAX_PAGES = 20;

export interface BingxEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

export interface BingxContract {
  symbol: string;
  /** The contract's base code: `BTC`, or `NCSKTSLA2USD` for a tradfi contract. */
  asset: string;
  /** Settlement coin, USDT or USDC. */
  currency: string;
  status: number;
  /** Display name, e.g. `TSLA-USDT` for `NCSKTSLA2USD-USDT`. Not read; see `bingxAssetClass`. */
  displayName?: string;
}

export interface BingxPremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  /** Estimate for the settlement at `nextFundingTime`, despite the name. */
  lastFundingRate: string;
  nextFundingTime: number;
  fundingIntervalHours: number;
}

export interface BingxTicker {
  symbol: string;
  /** Quote currency. */
  quoteVolume: string;
  /** Top of book. Prices are quote currency; quantities are base coin. */
  bidPrice?: string;
  bidQty?: string;
  askPrice?: string;
  askQty?: string;
}

export interface BingxOpenInterest {
  symbol: string;
  /** Quote-currency VALUE for linear contracts, not contracts or coins. */
  openInterest: string;
  time: number;
}

export interface BingxFundingRate {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice?: string;
}

export interface BingxOpenInterestEntry {
  valueUsd: number;
  fetchedAt: number;
}

function unwrap<T>(json: BingxEnvelope<T>, what: string): T {
  if (json?.code !== OK) throw new Error(`bingx ${what}: ${json?.code} ${json?.msg ?? ""}`);
  return json.data;
}

function unwrapList<T>(json: BingxEnvelope<T[] | null>, what: string): T[] {
  const data = unwrap(json, what);
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) throw new Error(`bingx ${what}: expected a list`);
  return data;
}

/** A tradfi contract code: `NC`, a two-letter namespace, then the underlying. */
const TRADFI_CODE = /^NC([A-Z]{2})[A-Z0-9]+$/;

/**
 * The class BingX declares for a contract, from the namespace of its contract code.
 *
 * BingX has no class field anywhere in /quote/contracts (v2 and v3 carry the same 22 keys). What it
 * does have is a code scheme for every tradfi contract it lists: `NC` then SK (stock), SI (stock
 * index), CO (commodity) or FX (forex), then the underlying and its pricing currency, so Tesla is
 * `NCSKTSLA2USD`, gold `NCCOGOLD2USD`, EUR/USD `NCFXEUR2USD`, the S&P 500 `NCSISP5002USD`. That is a
 * venue-assigned product code rather than a ticker, and it is the only declaration there is.
 *
 * Live 2026-09-14, 1,002 listed contracts: NCSK 323, NCFX 34, NCCO 10, NCSI 8, and 627 without the
 * scheme. No crypto contract's code starts with `NC`. A namespace this does not know counts only
 * when it also carries the scheme's `2XXX` pricing tail, so a future crypto token spelt NC… stays
 * crypto; with the tail it is tradfi of a kind we cannot read, and the base tables pick the class.
 *
 * NOTE the base is not resolved from the display name, so `marketRef` sees `NCSISP5002USD` rather
 * than US500: the SI rows refine to equity, and none of these contracts pools with another venue.
 */
export function bingxAssetClass(asset: string): AssetClass {
  const namespace = TRADFI_CODE.exec(asset)?.[1];
  switch (namespace) {
    case undefined:
      return "crypto";
    case "SK":
      return "equity";
    case "SI":
      return "index";
    case "CO":
      return "commodity";
    case "FX":
      return "fx";
    default:
      return /2[A-Z]{3}$/.test(asset) ? classifyNonCrypto(canonicalBase(asset)) : "crypto";
  }
}

/**
 * Listed USDT- and USDC-margined perpetuals.
 *
 * Live 2026-09-14, 1,216 contracts: status 1 on 1,002 (953 USDT, 49 USDC), exactly the set
 * premiumIndex answers for; status 25 on 214 (coffee, Nikkei, zinc, delisted names), none of them
 * in premiumIndex. BingX lists no delivery or inverse contracts on this API. `apiStateOpen` is
 * false on 169 status-1 contracts -- orders from the API are paused, not the market -- and they
 * keep publishing funding, so they are kept.
 */
export function isBingxTradable(contract: BingxContract): boolean {
  return (
    contract.status === LIVE_STATUS &&
    (contract.currency === "USDT" || contract.currency === "USDC")
  );
}

/** Premium index joined to listed contracts and tickers. Open interest comes from the rotating cache. */
export function parseBingxSnapshots(
  contracts: readonly BingxContract[],
  premium: readonly BingxPremiumIndex[],
  tickers: readonly BingxTicker[],
  openInterest: ReadonlyMap<string, BingxOpenInterestEntry>,
  now: number,
): FundingSnapshot[] {
  const tradable = new Map(contracts.filter(isBingxTradable).map((c) => [c.symbol, c]));
  const tickerBySymbol = new Map(tickers.map((t) => [t.symbol, t]));

  const snapshots: FundingSnapshot[] = [];
  for (const p of premium) {
    const contract = tradable.get(p.symbol);
    const rate = num(p.lastFundingRate);
    const hours = num(p.fundingIntervalHours);
    if (!contract || rate === null || hours === null || hours <= 0) continue;

    const ticker = tickerBySymbol.get(p.symbol);
    const next = num(p.nextFundingTime);
    snapshots.push({
      ...marketRef(VENUE_ID, p.symbol, {
        quote: contract.currency,
        assetClass: bingxAssetClass(contract.asset),
      }),
      observedAt: now,
      // Predicted: at 22:00 UTC on 2026-09-13 BTC-USDT read 0.000094 here, for the 00:00 settlement,
      // while the 16:00 settlement in /quote/fundingRate was 0.000078.
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice: num(p.markPrice),
      indexPrice: num(p.indexPrice),
      // Quantities are base coin: the ticker's 13.84 BTC at the best bid sat beside 19.24 BTC at
      // the same price in /quote/depth moments earlier. Contract counts would be 10,000x that.
      bestBid: ticker ? num(ticker.bidPrice) : null,
      bestBidSizeUsd: ticker ? mul(num(ticker.bidQty), num(ticker.bidPrice)) : null,
      bestAsk: ticker ? num(ticker.askPrice) : null,
      bestAskSizeUsd: ticker ? mul(num(ticker.askQty), num(ticker.askPrice)) : null,
      openInterestUsd: openInterest.get(p.symbol)?.valueUsd ?? null,
      // Quote turnover: BTC-USDT's 337,831,457 is its 4,386.85 BTC volume x a ~77,000 price.
      volume24hUsd: ticker ? num(ticker.quoteVolume) : null,
    });
  }
  return snapshots;
}

/**
 * Reads one /quote/openInterest answer as USD.
 *
 * The figure is already a quote-currency value: BTC-USDT answered 287,039,550.4 at a 77,190 mark,
 * which is 3,719 BTC. Read as coins it would be $22 trillion; as 0.0001-BTC contracts, $2.2bn on a
 * venue that traded $338m of BTC that day. ccxt files it as `openInterestValue` for linear swaps.
 */
export function parseBingxOpenInterest(json: BingxEnvelope<BingxOpenInterest>): number | null {
  return num(unwrap(json, "open interest")?.openInterest);
}

/** Settled funding inside [fromMs, toMs], oldest first, carrying the mark BingX stamps on each. */
export function parseBingxFundingHistory(
  ref: MarketRef,
  rows: readonly BingxFundingRate[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
): FundingEvent[] {
  const byTime = new Map<number, BingxFundingRate>();
  for (const row of rows) {
    const settledAt = num(row.fundingTime);
    if (settledAt !== null && settledAt > 0 && num(row.fundingRate) !== null) {
      byTime.set(settledAt, row);
    }
  }
  const basisHours = inferIntervalHours([...byTime.keys()]) ?? fallbackHours;
  if (basisHours === null) return [];

  return [...byTime]
    .filter(([settledAt]) => settledAt >= fromMs && settledAt <= toMs)
    .sort((a, b) => a[0] - b[0])
    .map(([settledAt, row]) => ({
      ...ref,
      settledAt,
      rate: num(row.fundingRate) as number,
      basisHours,
      markPrice: num(row.markPrice),
    }));
}

function refOf(snapshot: FundingSnapshot): MarketRef {
  const { venueId, venueSymbol, base, assetClass, quote, multiplier, dex } = snapshot;
  return { venueId, venueSymbol, base, assetClass, quote, multiplier, dex };
}

export interface BingxAdapterOptions {
  openInterestBudget?: number;
}

/**
 * BingX's USDT- and USDC-margined perpetuals.
 *
 * Two bulk requests a cycle (premiumIndex, ticker), up to `openInterestBudget` per-symbol open
 * interest calls, and /quote/contracts once an hour.
 */
export function createBingxAdapter(options: BingxAdapterOptions = {}): VenueAdapter {
  const budget = options.openInterestBudget ?? OPEN_INTEREST_BUDGET;
  let contracts: { fetchedAt: number; rows: BingxContract[] } | null = null;
  const openInterest = new Map<string, BingxOpenInterestEntry>();
  let known = new Map<string, { ref: MarketRef; intervalHours: number | null }>();

  return {
    venueId: VENUE_ID,
    // BingX answers with `x-ratelimit-requests-remain: 499` and `x-ratelimit-requests-expire: 10000`
    // on public market endpoints: 500 requests per 10 seconds per IP. 10 a second is a fifth of it.
    minIntervalMs: 100,

    async fetchSnapshots(client: HttpClient, now: number) {
      if (!contracts || now - contracts.fetchedAt >= CONTRACTS_MAX_AGE_MS) {
        const json = await client.getJson<BingxEnvelope<BingxContract[]>>(
          `${BASE_URL}/quote/contracts`,
        );
        contracts = { fetchedAt: now, rows: unwrapList(json, "contracts") };
      }
      const [premium, tickers] = await Promise.all([
        client
          .getJson<BingxEnvelope<BingxPremiumIndex[]>>(`${BASE_URL}/quote/premiumIndex`)
          .then((json) => unwrapList(json, "premiumIndex")),
        client
          .getJson<BingxEnvelope<BingxTicker[]>>(`${BASE_URL}/quote/ticker`)
          .then((json) => unwrapList(json, "ticker")),
      ]);

      const symbols = parseBingxSnapshots(contracts.rows, premium, tickers, openInterest, now).map(
        (s) => s.venueSymbol,
      );
      const listed = new Set(symbols);
      for (const symbol of openInterest.keys()) {
        if (!listed.has(symbol)) openInterest.delete(symbol);
      }
      for (const symbol of selectRefreshBatch(
        symbols,
        openInterest,
        now,
        budget,
        OPEN_INTEREST_MAX_AGE_MS,
      )) {
        try {
          const valueUsd = parseBingxOpenInterest(
            await client.getJson<BingxEnvelope<BingxOpenInterest>>(
              `${BASE_URL}/quote/openInterest?symbol=${encodeURIComponent(symbol)}`,
            ),
          );
          if (valueUsd !== null) openInterest.set(symbol, { valueUsd, fetchedAt: now });
        } catch (error) {
          if (error instanceof CircuitOpenError) break;
          // Leave this symbol for a later cycle; one bad symbol shouldn't fail the batch.
        }
      }

      const snapshots = parseBingxSnapshots(contracts.rows, premium, tickers, openInterest, now);
      known = new Map(
        snapshots.map((s) => [s.venueSymbol, { ref: refOf(s), intervalHours: s.intervalHours }]),
      );
      return { snapshots, settled: [] };
    },

    /**
     * Pages /quote/fundingRate backwards from `toMs`. Given a window and a limit it returns the
     * NEWEST rows in the window, newest first (a 2026-06 window with limit=5 answered its last five
     * settlements), so each further page ends just before the oldest row already read.
     */
    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const rows: BingxFundingRate[] = [];
      let endTime = toMs;
      for (let page = 0; page < HISTORY_MAX_PAGES && endTime >= fromMs; page++) {
        const list = unwrapList(
          await client.getJson<BingxEnvelope<BingxFundingRate[] | null>>(
            `${BASE_URL}/quote/fundingRate?symbol=${encodeURIComponent(venueSymbol)}&startTime=${fromMs}&endTime=${endTime}&limit=${HISTORY_LIMIT}`,
          ),
          "funding history",
        );
        rows.push(...list);
        if (list.length < HISTORY_LIMIT) break;
        endTime = Math.min(...list.map((r) => r.fundingTime)) - 1;
      }
      const market = known.get(venueSymbol);
      return parseBingxFundingHistory(
        market?.ref ?? marketRef(VENUE_ID, venueSymbol),
        rows,
        fromMs,
        toMs,
        market?.intervalHours ?? null,
      );
    },
  };
}

export const bingxAdapter = createBingxAdapter();
