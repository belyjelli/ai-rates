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
 * Toobit USDT- and USDC-margined perpetuals.
 *
 * Measured from this machine on 2026-09-13 22:28–22:36 UTC (docs: api-docs.toobit.com):
 *
 * - **Funding is NOT per-symbol only.** `/api/v1/futures/fundingRate` without `symbol` answers for
 *   all 804 perpetuals in one call (358 at 8H, 441 at 4H, 5 at 1H), 45 of them `TBV_` shadow books
 *   that exchangeInfo does not list. Mark (`/quote/v1/markPrice`), index (`/quote/v1/index`, keyed
 *   by the contract's `indexToken`), 24h ticker and book ticker are bulk too, so a cycle is five
 *   requests and exchangeInfo once an hour. Nothing is budgeted per symbol.
 * - **`rate` is the estimate for the next settlement, per `period`.** BTC-SWAP-USDT read 0.00006548
 *   and ETH 0.00006435 for the 00:00 UTC settlement: Binance's own estimates at the same second, to
 *   every digit. The 16:00 settlements in history, 0.0000645 and -0.00004585 (from coinw's matching
 *   feed), are Binance's 16:00 settlements. So Toobit mirrors Binance's funding; the basis is the
 *   declared period, as Binance's is.
 * - **Units.** `contractMultiplier` is base coin per contract. The bulk ticker's `v` is CONTRACTS
 *   despite the docs' "base asset volume": BTC's `qv` 4,275,918,831 / `v` 55,588,153.5 = 76.92,
 *   which is price x 0.001, and ETH's gives 2,493 x 0.01. `qv` is quote turnover. `op` is open
 *   interest in contracts: BTC's 797,290.398 x 0.001 is exactly the 797.290398 BTC that
 *   `/quote/v1/openInterest?symbol=` returned in the same second, $61M at a 76,805 mark. Book
 *   quantities are contracts too (BTC 11,595 at the bid is 11.6 BTC, not $890M).
 * - **Tradability.** 759 contracts in exchangeInfo, all TRADING and none inverse: 749 margined in
 *   USDT and 10 in USDC, all collected. The ticker also serves 242 books exchangeInfo does not list
 *   (`TBV_` duplicates, delisted REN and WAVES); only listed contracts are joined.
 * - **Class.** `isRwa` is true on 237 contracts, and their `rwaType` is `STOCK` on every one of
 *   them, gold, EUR, VIX and the Dow included. So `rwaType` says "not crypto" rather than which
 *   class, and the class comes from `classifyNonCrypto`. XAUT carries the `TradFi` category but not
 *   `isRwa`, so it stays crypto, as does everything else.
 * - **Base.** `underlying` is declared. Checked against the parser on all 759: they agree except
 *   eleven contract-size prefixes (1000PEPE, 1000000MOG...), which the parser reads as multipliers,
 *   SPX500 and NG, which both sides canonicalise to US500 and NATGAS, and ID2-SWAP-USDT, whose
 *   underlying and index are ID. That one takes the declared base.
 * - **History**: `/api/v1/futures/historyFundingRate?symbol=&limit=&fromId=`, newest first, `limit`
 *   at most 1,000 (1,500 is rejected). `endTime` is ignored; `fromId` returns rows with a smaller id.
 * - **Rate limit**: 3,000 request weight a minute per IP (exchangeInfo `rateLimits`). The bulk 24h
 *   ticker weighs 40 and the rest 1, so a cycle is about 45.
 */

const VENUE_ID = "toobit";
export const TOOBIT_API = "https://api.toobit.com";
/** exchangeInfo is 2.5 MB, mostly risk-limit ladders and spot coins, so hourly. */
export const EXCHANGE_INFO_MAX_AGE_MS = 60 * 60_000;
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 20;
const DOLLAR_QUOTES: ReadonlySet<string> = new Set(["USDT", "USDC"]);

export interface ToobitContract {
  symbol: string;
  status: string;
  inverse: boolean;
  /** The base asset Toobit declares: `ID` for ID2-SWAP-USDT. */
  underlying: string;
  /** Key into `/quote/v1/index`. */
  indexToken: string;
  marginToken: string;
  quoteAsset: string;
  /** Base coin per contract. */
  contractMultiplier: string;
  isRwa?: boolean;
  /** `STOCK` on every RWA contract, commodities and currencies included. */
  rwaType?: string;
  categories?: string[];
}

export interface ToobitExchangeInfo {
  contracts: ToobitContract[];
}

export interface ToobitFundingRate {
  symbol: string;
  /** Estimate for the settlement at `nextFundingTime`, per `period`. */
  rate: string;
  period: string;
  nextFundingTime: string;
}

export interface ToobitTicker {
  s: string;
  /** Last price. */
  c: string;
  /** Quote turnover. */
  qv: string;
  /** Open interest, contracts. */
  op: string;
}

export interface ToobitMarkPrice {
  symbolId: string;
  price: string;
}

export interface ToobitIndex {
  index: Record<string, string>;
}

export interface ToobitBookTicker {
  s: string;
  b: string;
  /** Contracts. */
  bq: string;
  a: string;
  aq: string;
}

export interface ToobitFundingHistoryRow {
  id: string;
  symbol: string;
  settleTime: string;
  settleRate: string;
  period: string;
}

interface ToobitError {
  code?: number;
  msg?: string;
}

function unwrapList<T>(json: T[] | ToobitError, what: string): T[] {
  if (!Array.isArray(json)) throw new Error(`toobit ${what}: ${json?.code} ${json?.msg ?? ""}`);
  return json;
}

/** Listed, trading, linear perpetuals margined and quoted in USDT or USDC. */
export function isToobitTradable(contract: ToobitContract): boolean {
  return (
    contract.status === "TRADING" &&
    contract.inverse === false &&
    DOLLAR_QUOTES.has(contract.marginToken) &&
    contract.quoteAsset === contract.marginToken
  );
}

/** `isRwa` is Toobit's only class signal; its `rwaType` is STOCK even for gold, so it can't pick the class. */
export function toobitAssetClass(contract: ToobitContract, base: string): AssetClass {
  return contract.isRwa === true ? classifyNonCrypto(base) : "crypto";
}

/** `8H`, `4H`, `1H` as hours; null for anything else. */
export function toobitPeriodHours(period: string | undefined): number | null {
  const match = /^(\d+(?:\.\d+)?)H$/i.exec(period?.trim() ?? "");
  const hours = match ? Number(match[1]) : null;
  return hours !== null && hours > 0 ? hours : null;
}

export function toobitRef(contract: ToobitContract): MarketRef {
  const declared = declaredMarketBase({
    symbol: contract.symbol,
    contractType: "",
    baseAsset: contract.underlying,
    quoteAsset: contract.marginToken,
  });
  const overrides = { quote: contract.marginToken, ...(declared ? { base: declared } : {}) };
  const { base } = marketRef(VENUE_ID, contract.symbol, overrides);
  return marketRef(VENUE_ID, contract.symbol, {
    ...overrides,
    assetClass: toobitAssetClass(contract, base),
  });
}

export interface ToobitSnapshotInput {
  contracts: readonly ToobitContract[];
  funding: readonly ToobitFundingRate[];
  tickers: readonly ToobitTicker[];
  marks: readonly ToobitMarkPrice[];
  index: Readonly<Record<string, string>>;
  books: readonly ToobitBookTicker[];
}

/** Joins the bulk responses onto listed contracts, in funding-rate order. */
export function parseToobitSnapshots(input: ToobitSnapshotInput, now: number): FundingSnapshot[] {
  const tradable = new Map(input.contracts.filter(isToobitTradable).map((c) => [c.symbol, c]));
  const tickers = new Map(input.tickers.map((t) => [t.s, t]));
  const marks = new Map(input.marks.map((m) => [m.symbolId, num(m.price)]));
  const books = new Map(input.books.map((b) => [b.s, b]));

  const snapshots: FundingSnapshot[] = [];
  for (const row of input.funding) {
    const contract = tradable.get(row.symbol);
    const rate = num(row.rate);
    const hours = toobitPeriodHours(row.period);
    if (!contract || rate === null || hours === null) continue;

    const ticker = tickers.get(row.symbol);
    const book = books.get(row.symbol);
    const multiplier = num(contract.contractMultiplier);
    const markPrice = marks.get(row.symbol) ?? null;
    const next = num(row.nextFundingTime);
    const bestBid = num(book?.b);
    const bestAsk = num(book?.a);
    snapshots.push({
      ...toobitRef(contract),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(input.index[contract.indexToken]),
      bestBid,
      bestBidSizeUsd: mul(num(book?.bq), multiplier, bestBid),
      bestAsk,
      bestAskSizeUsd: mul(num(book?.aq), multiplier, bestAsk),
      openInterestUsd: mul(num(ticker?.op), multiplier, markPrice),
      volume24hUsd: num(ticker?.qv),
    });
  }
  return snapshots;
}

/** Settlements in [fromMs, toMs], oldest first, each over its declared period. */
export function parseToobitFundingHistory(
  ref: MarketRef,
  rows: readonly ToobitFundingHistoryRow[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
): FundingEvent[] {
  const byTime = new Map<number, ToobitFundingHistoryRow>();
  for (const row of rows) {
    const time = num(row.settleTime);
    if (time !== null && time > 0 && num(row.settleRate) !== null) byTime.set(time, row);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  const gaps = basisHoursFromGaps(times, fallbackHours);

  const events: FundingEvent[] = [];
  times.forEach((settledAt, i) => {
    const row = byTime.get(settledAt) as ToobitFundingHistoryRow;
    const basisHours = toobitPeriodHours(row.period) ?? gaps[i] ?? null;
    if (settledAt < fromMs || settledAt > toMs || basisHours === null) return;
    events.push({
      ...ref,
      settledAt,
      rate: num(row.settleRate) as number,
      basisHours,
      markPrice: null,
    });
  });
  return events;
}

export function createToobitAdapter(): VenueAdapter {
  let exchangeInfo: { fetchedAt: number; contracts: ToobitContract[] } | null = null;
  let known = new Map<string, { ref: MarketRef; intervalHours: number | null }>();

  const list = <T>(client: HttpClient, path: string, what: string) =>
    client
      .getJson<T[] | ToobitError>(`${TOOBIT_API}${path}`)
      .then((json) => unwrapList(json, what));

  return {
    venueId: VENUE_ID,
    // 3,000 weight a minute per IP; a cycle weighs ~45 and a full history page 1.
    minIntervalMs: 100,

    async fetchSnapshots(client, now) {
      if (!exchangeInfo || now - exchangeInfo.fetchedAt >= EXCHANGE_INFO_MAX_AGE_MS) {
        const json = await client.getJson<ToobitExchangeInfo>(`${TOOBIT_API}/api/v1/exchangeInfo`);
        if (!Array.isArray(json?.contracts)) throw new Error("toobit exchangeInfo: no contracts");
        exchangeInfo = { fetchedAt: now, contracts: json.contracts };
      }
      const [funding, tickers, marks, index, books] = await Promise.all([
        list<ToobitFundingRate>(client, "/api/v1/futures/fundingRate", "funding rate"),
        list<ToobitTicker>(client, "/quote/v1/contract/ticker/24hr", "ticker"),
        list<ToobitMarkPrice>(client, "/quote/v1/markPrice", "mark price"),
        client.getJson<ToobitIndex>(`${TOOBIT_API}/quote/v1/index`).then((json) => {
          if (!json?.index || typeof json.index !== "object") throw new Error("toobit index");
          return json.index;
        }),
        list<ToobitBookTicker>(client, "/quote/v1/contract/ticker/bookTicker", "book ticker"),
      ]);
      const snapshots = parseToobitSnapshots(
        { contracts: exchangeInfo.contracts, funding, tickers, marks, index, books },
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

    /** Newest first; `endTime` is ignored, so pages walk back with `fromId` until they pass `fromMs`. */
    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const rows: ToobitFundingHistoryRow[] = [];
      let fromId: string | null = null;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const cursor: string = fromId === null ? "" : `&fromId=${fromId}`;
        const batch = await list<ToobitFundingHistoryRow>(
          client,
          `/api/v1/futures/historyFundingRate?symbol=${encodeURIComponent(venueSymbol)}&limit=${HISTORY_PAGE_SIZE}${cursor}`,
          "funding history",
        );
        rows.push(...batch);
        if (batch.length < HISTORY_PAGE_SIZE) break;
        const oldest = batch.reduce((a, b) => (Number(b.id) < Number(a.id) ? b : a));
        if (Number(oldest.settleTime) < fromMs) break;
        fromId = oldest.id;
      }
      const market = known.get(venueSymbol);
      return parseToobitFundingHistory(
        market?.ref ?? marketRef(VENUE_ID, venueSymbol),
        rows,
        fromMs,
        toMs,
        market?.intervalHours ?? null,
      );
    },
  };
}

export const toobitAdapter: VenueAdapter = createToobitAdapter();
