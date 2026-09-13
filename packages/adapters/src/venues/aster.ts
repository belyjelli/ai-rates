import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  parseVenueSymbol,
} from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { marketRef, mul, num, selectRefreshBatch } from "../parse";
import type { VenueAdapter } from "../types";

// Aster's futures API is Binance-compatible, so this module is the whole binance-fapi family: the
// Binance-style helpers below are shared, and `createBinanceStyleAdapter` takes the venue id and
// base URL rather than closing over constants.
//
// On `defaultIntervalHours`, measured against Binance on 2026-09-13 rather than assumed: its
// fundingInfo is NOT an exceptions-only list. It returned 782 entries, 312 of them at the default
// 8h, against 900 symbols in premiumIndex. Re-measured on 2026-09-14, after `tradablePerpetuals`
// began admitting TradFi perpetuals: every one of Binance's 762 collected markets is in fundingInfo,
// and so is every one of Aster's 574. A symbol missing from it is never one we collect, so `null` is
// correct for both, and inventing an 8h default would have been the wrong guess anyway: 466 of
// Binance's 782 symbols settle 4-hourly.

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

/** One exchangeInfo row, with only the fields this family reads. */
export interface BinanceStyleSymbol {
  symbol: string;
  status: string;
  contractType: string;
  baseAsset?: string;
  quoteAsset?: string;
  /**
   * Binance's declared class: COIN, INDEX, EQUITY, HK_EQUITY, KR_EQUITY, CN_EQUITY, PREMARKET or
   * COMMODITY. Aster sends the field too, but as COIN on every row, Apple and gold included.
   */
  underlyingType?: string;
  /** Tags. Aster's carry the class (STOCK, ETF, Commodities); Binance's only say TradFi or Crypto. */
  underlyingSubType?: string[];
  /** Aster only: 1 on exactly the rows its tags mark as stock, ETF or commodity, 0 everywhere else. */
  symbolType?: number;
}

export interface BinanceStyleExchangeInfo {
  symbols: BinanceStyleSymbol[];
}

/**
 * Reads what a family member declares an exchangeInfo row to be. Pluggable because the members
 * share an API and not a declaration: Binance states the class in `underlyingType`, Aster in tags.
 */
export type BinanceStyleClassifier = (symbol: BinanceStyleSymbol) => AssetClass;

export interface BinanceStyleFundingRate {
  symbol: string;
  fundingTime: number;
  fundingRate: string;
  markPrice?: string;
}

export interface TradableSymbol {
  quoteAsset: string | null;
  /** As the venue declares it; `marketRef` settles equity against index and tokenised gold. */
  assetClass: AssetClass;
  /** The venue's declared base where the symbol parser gets it wrong; null keeps the parsed base. */
  base: string | null;
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
 * The canonical base for `classifyNonCrypto`, from the venue's declared `baseAsset` where it sends
 * one. The symbol alone does not always split: Aster's CLUSD1 has a USD1 quote the parser does not
 * know, which would leave `CLUSD1` as the base and file crude oil as a single stock.
 */
export function declaredBase(symbol: BinanceStyleSymbol): string {
  return symbol.baseAsset ? canonicalBase(symbol.baseAsset) : parseVenueSymbol(symbol.symbol).base;
}

/** Settlement assets worth a US dollar, so a market quoted in one belongs in its base's USD pool. */
const DOLLAR_QUOTES: ReadonlySet<string> = new Set([
  "USDT",
  "USDC",
  "USD1",
  "U",
  "USDE",
  "FDUSD",
  "BUSD",
  "USD",
]);

/**
 * The base to override the parsed one with, or null where the parser already agrees with the venue.
 *
 * The parser splits a symbol by the quotes it knows and by hyphens, and 20 of these venues' 1,336
 * TRADING perpetuals on 2026-09-14 defeated it. A quote it does not know left the whole symbol as the
 * base: `BTCUSD1`, `CLUSD1`, `XAUUSD1`, `MUUSD1` and `BTCU`, so a USD1-margined BTC perpetual sat in
 * a pool of its own and never paired with BTC. A hyphen inside the base cut `B-MONEYUSDT` down to `B`,
 * filing a 0.0043 token in the pool of the 0.217 one, a 51× mismatch the gate had to keep excluding.
 * The venue states both halves in `baseAsset` and `quoteAsset`, so it is read here rather than
 * guessed, which is the rule migration 017's comment and the MEXC declared base already follow.
 *
 * Only for dollar quotes. `ETHBTC` also defeats the parser, but it prices ETH in bitcoin, so joining
 * the ETH pool would only swap a lonely market for a permanent mark mismatch.
 */
export function declaredMarketBase(symbol: BinanceStyleSymbol): string | null {
  const declared = symbol.baseAsset?.trim();
  if (!declared || !symbol.quoteAsset || !DOLLAR_QUOTES.has(symbol.quoteAsset)) return null;
  const parsed = parseVenueSymbol(symbol.symbol);
  // A contract-size prefix (1000PEPE) is the parser's to read, and it reads it: not a disagreement.
  if (parsed.multiplier !== 1 || parsed.base === canonicalBase(declared)) return null;
  return declared;
}

/**
 * Aster's declared class, from the `underlyingSubType` tags.
 *
 * Aster's `underlyingType` is COIN on all 574 TRADING perpetuals, stocks and gold included, so the
 * field Binance declares in carries nothing here; the tags do. Over the full exchangeInfo on
 * 2026-09-14, of 574 TRADING perpetuals: 11 tagged Commodities (XAU, XAG, XCU, XPT, XPD, CL, BZ,
 * NATGAS, PAXG, and CLUSD1 and XAUUSD1 on the USD1 quote), 117 tagged STOCK or ETF (OPENAI and
 * ANTHROPIC as ["pre-launch", "STOCK"]), and 446 with neither. PAXG is declared a commodity here and
 * returned to crypto by `marketRef`'s tokenised table, as on every venue.
 *
 * `symbolType` is the cross-check: it is 1 on exactly the 128 rows those tags call tradfi, across
 * all 594 rows, pending and settling included. So a row flagged 1 whose tags are new to us is tradfi
 * of a kind we cannot read, and goes to `classifyNonCrypto` rather than defaulting to crypto. The
 * reverse never happens: a row flagged 0 is crypto whatever its ticker, which is what keeps RTXUSDT
 * (RateX) apart from Raytheon.
 */
export function asterAssetClass(symbol: BinanceStyleSymbol): AssetClass {
  const tags = symbol.underlyingSubType ?? [];
  if (tags.includes("Commodities")) return "commodity";
  if (tags.includes("STOCK") || tags.includes("ETF")) return "equity";
  if (symbol.symbolType === 1) return classifyNonCrypto(declaredBase(symbol));
  return "crypto";
}

/**
 * Contract types collected. TRADIFI_PERPETUAL is Binance's perpetual on a stock, ETF or commodity:
 * 191 TRADING markets on 2026-09-14, XAU, TSLA, SPY and Caterpillar among them, every one in
 * premiumIndex and fundingInfo and funded like any other perpetual. Reading PERPETUAL alone silently
 * dropped all of them. Quarterlies (CURRENT_QUARTER, NEXT_QUARTER) have no funding and stay out.
 * Aster lists no TRADIFI_PERPETUAL, its tradfi markets being plain PERPETUAL, so one set serves both.
 */
export const PERPETUAL_CONTRACT_TYPES: ReadonlySet<string> = new Set([
  "PERPETUAL",
  "TRADIFI_PERPETUAL",
]);

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

/** Perpetual symbols currently TRADING, by symbol, each with the class its venue declares. */
export function tradablePerpetuals(
  info: BinanceStyleExchangeInfo,
  classify: BinanceStyleClassifier,
): Map<string, TradableSymbol> {
  return new Map(
    info.symbols
      .filter((s) => s.status === "TRADING" && PERPETUAL_CONTRACT_TYPES.has(s.contractType))
      .map((s) => [
        s.symbol,
        { quoteAsset: s.quoteAsset ?? null, assetClass: classify(s), base: declaredMarketBase(s) },
      ]),
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
      ...marketRef(venueId, p.symbol, {
        assetClass: tradable.assetClass,
        ...(tradable.quoteAsset ? { quote: tradable.quoteAsset } : {}),
        ...(tradable.base ? { base: tradable.base } : {}),
      }),
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

/** `assetClass` is the venue's declaration for the symbol; omitted, the market is crypto. */
export function parseBinanceStyleFundingHistory(
  venueId: string,
  venueSymbol: string,
  rows: readonly BinanceStyleFundingRate[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
  assetClass?: AssetClass,
): FundingEvent[] {
  const byTime = new Map<number, BinanceStyleFundingRate>();
  for (const row of rows) {
    const time = num(row.fundingTime);
    if (time !== null && time >= fromMs && time <= toMs && num(row.fundingRate) !== null)
      byTime.set(time, row);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  const basis = basisHoursFromGaps(times, fallbackHours);
  const ref = marketRef(venueId, venueSymbol, assetClass ? { assetClass } : {});

  const events: FundingEvent[] = [];
  times.forEach((time, i) => {
    const row = byTime.get(time) as BinanceStyleFundingRate;
    const basisHours = basis[i];
    if (basisHours === null || basisHours === undefined) return;
    events.push({
      ...ref,
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
  assetClass?: AssetClass,
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
  return parseBinanceStyleFundingHistory(
    venueId,
    venueSymbol,
    rows,
    fromMs,
    toMs,
    fallbackHours,
    assetClass,
  );
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
   * How this member declares a market's class. Required, so a new member has to say where its
   * declaration lives instead of inheriting another venue's reading of a field it may not fill.
   */
  classify: BinanceStyleClassifier;
  /**
   * Interval for symbols absent from fundingInfo; `null` skips them. Null for every member measured
   * so far — see the note at the top of this file for why an 8h default would be wrong.
   */
  defaultIntervalHours?: number | null;
  /** Aster allows 100ms between requests; tighter venues override it. */
  minIntervalMs?: number;
}

export function createAsterAdapter(options: AsterAdapterOptions = {}): VenueAdapter {
  return createBinanceStyleAdapter({
    ...options,
    venueId: VENUE,
    baseUrl: BASE,
    classify: asterAssetClass,
  });
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
        exchangeInfo = { fetchedAt: now, tradable: tradablePerpetuals(info, options.classify) };
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

    // The class, like the interval, comes from the last snapshot cycle. History requested before
    // any cycle has run finds neither, and its events default to crypto as its interval does to null.
    fetchFundingHistory: (client, venueSymbol, fromMs, toMs) =>
      fetchBinanceStyleFundingHistory(
        client,
        `${BASE}/fundingRate`,
        VENUE,
        venueSymbol,
        fromMs,
        toMs,
        intervals.get(venueSymbol) ?? null,
        exchangeInfo?.tradable.get(venueSymbol)?.assetClass,
      ),
  };
}

export const asterAdapter = createAsterAdapter();
