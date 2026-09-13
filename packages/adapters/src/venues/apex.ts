import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { marketRef, mul, num, selectRefreshBatch } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * ApeX Omni.
 *
 * REQUESTS: `GET /v3/ticker` answers one symbol at a time (without `symbol` it returns `[]`, and no
 * all-tickers route exists: `/v3/tickers`, `/v3/all-ticker` and `/v3/ticker/all` are 404, `/v3/funding`
 * needs API-key headers). So each cycle is `GET /v3/symbols` once an hour (~750 KB) plus
 * `TICKER_BUDGET` tickers, least recently fetched first. With 125 tradable contracts on 2026-09-13
 * that is 64 requests a cycle and every contract re-read every 2 cycles (~2 minutes), inside the
 * screener's 5-minute window. The limit is "600 requests per 60 secs Per IP"
 * (https://api-docs.omni.apex.exchange/); 150ms spacing puts a cycle's 64 starts in ~10s.
 *
 * WHY ONLY THIS CYCLE'S SLICE IS EMITTED: the collector appends snapshots to `funding_snapshots`
 * with no conflict key, so repeating a ticker read in a later cycle would store it twice. A contract
 * appears in the cycles that read it, and the 2-minute sweep keeps it in `market_latest`. There is
 * nothing for `warmUp` to seed, since the rate is the per-symbol read.
 *
 * FUNDING -- which field. `fundingRate` is the running estimate for the settlement at
 * `nextFundingTime`, so it is `predicted`. The docs only call it "Funding rate" and its neighbour
 * "Predicted funding rate", so this was measured: sampled every minute on 2026-09-13, BTC's
 * `fundingRate` read -0.00001042 at 22:59:31 and `/v3/history-funding` recorded -0.00001020 for the
 * 23:00 settlement; ETH read -0.00000722 and settled -0.00000698. `predictedFundingRate` is NOT
 * the prediction, whatever its name: it read 0.0000125 on BTC, ETH and SPCX every minute, which is
 * the contracts' `fundingInterestRate` of 0.0003 a day over 24 hours -- the interest component
 * alone -- and neither settlement was anywhere near it.
 *
 * FUNDING -- units and period. A fraction for ONE hour, positive = longs pay. "Funding fees will be
 * exchanged between long and short position holders every 1 hour" and "Funding Fees = Position
 * Value * Index Price * Funding Rate" (https://api-docs.omni.apex.exchange/); history rows are
 * exactly 3,600,000ms apart. Against Hyperliquid's 0.0000125/h the same hour BTC read -0.0000103/h:
 * the same order of magnitude (a percent reading would be 100x off, an 8h one 8x), with the
 * opposite sign because ApeX's BTC was marking 4bp under its index (76,761.71 vs 76,794.20).
 *
 * UNITS, checked 2026-09-13: `openInterest` is base units (BTC 1,578 x 76,737 = $121M), `turnover24h`
 * is quote (BTC $565M against `volume24h` 7,337 BTC at ~77k). `nextFundingTime` is ISO-8601.
 *
 * TRADABILITY: `/v3/symbols` has three lists under `contractConfig`. Kept: `perpetualContract` and
 * `stockContract` rows with `enableTrade`, `enableDisplay` and `enableOpenPosition` all true -- 86 of
 * 138 and 39 of 47 on 2026-09-13; the rest are delisted (TON, MKR, IWM ...: all three false) or
 * close-only (IO: tradable but not displayed or openable). `predictionContract` (184 rows, e.g.
 * `Donald_Trump_win_Presidential_Election_2028`) is left out: those are event contracts priced on
 * an outcome, not perpetuals on an asset, and 178 of them are not even displayed.
 *
 * CLASS: `perpetualContract` rows are crypto (their `category` is a sector: L1, DEFI, MEME ...;
 * PAXG has none). `stockContract` rows declare `category` STOCK 28, COMMODITY 6, INDEX 4 or nothing
 * (SOXL). INDEX is passed as index and `marketRef` settles SPY, QQQ, EWY and DRAM as equity; a missing
 * or unknown category goes to `classifyNonCrypto`.
 *
 * QUOTE: `settleAssetId`, USDT on every contract.
 *
 * BASE: `symbol` (`BTC-USDT`) is the venue symbol, because the funding history is keyed by it; the
 * ticker is asked for `crossSymbolName` (`BTCUSDT`). The parser agrees with the declared
 * `baseTokenId` on all 185 perpetual and stock contracts except the four thousand-unit ones
 * (1000PEPE, 1000BONK, 1000SHIB, 1000000MOG), which it reads as PEPE x1000 and so on -- the same
 * reading as every other venue's 1000PEPE, so it is kept.
 */

const VENUE = "apex";
export const APEX_API = "https://omni.apex.exchange/api/v3";
export const SYMBOLS_MAX_AGE_MS = 60 * 60_000;
/** Tickers per cycle; see REQUESTS. */
export const TICKER_BUDGET = 64;
const FUNDING_HOURS = 1;
/** `limit` above 100 is refused with "invalid get page size" (measured with 500). */
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 50;

export interface ApexContract {
  symbol: string;
  crossSymbolName: string;
  baseTokenId: string;
  settleAssetId: string;
  enableTrade: boolean;
  enableDisplay: boolean;
  enableOpenPosition: boolean;
  isPrelaunch?: boolean;
  category?: string;
  displayMaxLeverage?: string;
}

export interface ApexSymbols {
  data: {
    contractConfig: {
      perpetualContract?: ApexContract[];
      stockContract?: ApexContract[];
      predictionContract?: ApexContract[];
    };
  };
}

export interface ApexTicker {
  symbol: string;
  fundingRate?: string;
  predictedFundingRate?: string;
  nextFundingTime?: string;
  markPrice?: string;
  indexPrice?: string;
  openInterest?: string;
  turnover24h?: string;
}

export interface ApexFundingRow {
  symbol: string;
  rate: string;
  price?: string;
  fundingTime: number;
}

/** A tradable contract with the list it came from, which is what decides its class. */
export interface ApexMarket {
  contract: ApexContract;
  list: "perpetual" | "stock";
}

export function apexAssetClass(market: ApexMarket, base: string): AssetClass {
  if (market.list === "perpetual") return "crypto";
  switch (market.contract.category?.trim().toUpperCase()) {
    case "STOCK":
      return "equity";
    case "COMMODITY":
      return "commodity";
    case "INDEX":
      return "index";
    default:
      return classifyNonCrypto(base);
  }
}

const isLive = (c: ApexContract) =>
  c.enableTrade && c.enableDisplay && c.enableOpenPosition && !c.isPrelaunch;

/** Tradable perpetual and stock contracts, by `symbol`. */
export function tradableApexContracts(body: ApexSymbols): Map<string, ApexMarket> {
  const config = body.data.contractConfig;
  const markets: [string, ApexMarket][] = [
    ...(config.perpetualContract ?? [])
      .filter(isLive)
      .map((contract): [string, ApexMarket] => [contract.symbol, { contract, list: "perpetual" }]),
    ...(config.stockContract ?? [])
      .filter(isLive)
      .map((contract): [string, ApexMarket] => [contract.symbol, { contract, list: "stock" }]),
  ];
  return new Map(markets);
}

function ref(market: ApexMarket) {
  const parsed = marketRef(VENUE, market.contract.symbol);
  return marketRef(VENUE, market.contract.symbol, {
    quote: market.contract.settleAssetId,
    assetClass: apexAssetClass(market, parsed.base),
  });
}

export function parseApexTicker(
  market: ApexMarket,
  ticker: ApexTicker | null | undefined,
  now: number,
): FundingSnapshot | null {
  const rate = num(ticker?.fundingRate);
  const markPrice = num(ticker?.markPrice);
  if (!ticker || ticker.symbol !== market.contract.crossSymbolName || rate === null) return null;
  if (markPrice === null) return null;
  const next = ticker.nextFundingTime ? Date.parse(ticker.nextFundingTime) : Number.NaN;
  return {
    ...ref(market),
    observedAt: now,
    rate,
    basisHours: FUNDING_HOURS,
    intervalHours: FUNDING_HOURS,
    nextFundingAt: Number.isFinite(next) ? next : null,
    kind: "predicted",
    markPrice,
    indexPrice: num(ticker.indexPrice),
    openInterestUsd: mul(num(ticker.openInterest), markPrice),
    volume24hUsd: num(ticker.turnover24h),
    maxLeverage: num(market.contract.displayMaxLeverage),
  };
}

/** Hourly settlements within [fromMs, toMs], oldest first. */
export function parseApexFunding(
  rows: readonly ApexFundingRow[],
  market: ApexMarket,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(market);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = num(row.fundingTime);
    const rate = num(row.rate);
    if (settledAt === null || rate === null || settledAt < fromMs || settledAt > toMs) continue;
    // `price` is not documented as the mark (the docs' example gives it no description), so it is
    // not stored as one.
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate,
      basisHours: FUNDING_HOURS,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export interface ApexAdapterOptions {
  tickerBudget?: number;
}

export function createApexAdapter(options: ApexAdapterOptions = {}): VenueAdapter {
  const budget = options.tickerBudget ?? TICKER_BUDGET;
  let symbols: { fetchedAt: number; bySymbol: Map<string, ApexMarket> } | null = null;
  const lastFetched = new Map<string, { fetchedAt: number }>();

  async function loadSymbols(client: HttpClient, now: number) {
    if (symbols && now - symbols.fetchedAt < SYMBOLS_MAX_AGE_MS) return symbols.bySymbol;
    const body = await client.getJson<ApexSymbols>(`${APEX_API}/symbols`);
    if (!body?.data?.contractConfig) throw new Error(`${VENUE}: unexpected symbols response`);
    symbols = { fetchedAt: now, bySymbol: tradableApexContracts(body) };
    return symbols.bySymbol;
  }

  return {
    venueId: VENUE,
    // 600 requests per 60s per IP.
    minIntervalMs: 150,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const live = await loadSymbols(client, now);
      for (const symbol of lastFetched.keys()) {
        if (!live.has(symbol)) lastFetched.delete(symbol);
      }
      const batch = selectRefreshBatch([...live.keys()], lastFetched, now, budget, 0);
      for (const symbol of batch) lastFetched.set(symbol, { fetchedAt: now });

      const errors: unknown[] = [];
      // The client spaces request starts, so these queue rather than burst.
      const results = await Promise.all(
        batch.map(async (symbol) => {
          const market = live.get(symbol) as ApexMarket;
          try {
            const body = await client.getJson<{ data?: ApexTicker[] }>(
              `${APEX_API}/ticker?symbol=${encodeURIComponent(market.contract.crossSymbolName)}`,
            );
            return parseApexTicker(market, body?.data?.[0], now);
          } catch (error) {
            errors.push(error);
            return null;
          }
        }),
      );
      const snapshots = results.filter((s): s is FundingSnapshot => s !== null);
      if (snapshots.length === 0 && errors.length > 0) {
        throw errors.find((e) => e instanceof CircuitOpenError) ?? errors[0];
      }
      return { snapshots, settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const live = await loadSymbols(client, Date.now());
      const market = live.get(venueSymbol);
      if (!market) return [];
      // Newest first; step `endTimeExclusive` back to the oldest row of each page.
      const rows: ApexFundingRow[] = [];
      let end = toMs + 1;
      for (let page = 0; page < HISTORY_MAX_PAGES && end > fromMs; page++) {
        const url = `${APEX_API}/history-funding?symbol=${encodeURIComponent(venueSymbol)}&limit=${HISTORY_PAGE_SIZE}&beginTimeInclusive=${fromMs}&endTimeExclusive=${end}`;
        const body = await client.getJson<{ data?: { historyFunds?: ApexFundingRow[] | null } }>(
          url,
        );
        const batch = body?.data?.historyFunds ?? [];
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected history-funding response`);
        rows.push(...batch);
        if (batch.length < HISTORY_PAGE_SIZE) break;
        const oldest = Math.min(...batch.map((r) => Number(r.fundingTime)));
        if (!Number.isFinite(oldest) || oldest >= end) break;
        end = oldest;
      }
      return parseApexFunding(rows, market, fromMs, toMs);
    },
  };
}

export const apexAdapter: VenueAdapter = createApexAdapter();
