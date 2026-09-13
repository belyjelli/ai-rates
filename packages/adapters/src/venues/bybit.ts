import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  type LeverageTier,
  parseVenueSymbol,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "bybit";
const BASE_URL = "https://api.bybit.com";
const HISTORY_PAGE = 200;
const MAX_PAGES = 50;
// The risk-limit endpoint ignores `limit` and returns ~15 symbols a page whatever you ask for, so
// the whole linear book (~830 symbols) needs far more pages than any other sweep here.
const RISK_LIMIT_MAX_PAGES = 200;

export interface BybitEnvelope<T> {
  retCode: number;
  retMsg: string;
  result: { list: T[]; nextPageCursor?: string };
}

export interface BybitTicker {
  symbol: string;
  fundingRate: string;
  nextFundingTime: string;
  markPrice: string;
  indexPrice: string;
  openInterestValue: string;
  turnover24h: string;
  /** Top of book. Prices are quote currency; the paired sizes are contracts. */
  bid1Price?: string;
  bid1Size?: string;
  ask1Price?: string;
  ask1Size?: string;
}

export interface BybitInstrument {
  symbol: string;
  contractType: string;
  status: string;
  baseCoin: string;
  quoteCoin: string;
  /** Minutes; 0 for dated futures. */
  fundingInterval: number;
  /** Headline leverage; the tiered ladder in /v5/market/risk-limit is the precise source. */
  leverageFilter?: { maxLeverage?: string };
  /** What the contract tracks: "" or "innovation" for crypto, else "stock", "ETF", "commodity", "forex". */
  symbolType?: string;
}

/**
 * The class Bybit declares for a linear contract, from `symbolType` on /v5/market/instruments-info.
 *
 * Live 2026-09-14, 869 linear instruments: "" 503 and "innovation" 124 (crypto, the latter Bybit's
 * new-listing zone), "stock" 186 and "ETF" 49 (equity), "commodity" 4, "forex" 3. The field is what
 * separates BBXUSDT, ONUSDT and PURRUSDT (stocks) from BBUSDT (BounceBit), and XAUUSDT (commodity)
 * from XAUTUSDT (Tether Gold, declared crypto). A value this does not know is still a declaration
 * that the contract is not crypto, so the base tables settle which class rather than defaulting.
 */
export function bybitAssetClass(symbolType: string | undefined, base: string): AssetClass {
  switch (symbolType ?? "") {
    case "":
    case "innovation":
      return "crypto";
    case "stock":
    case "ETF":
      return "equity";
    case "commodity":
      return "commodity";
    case "forex":
      return "fx";
    default:
      return classifyNonCrypto(canonicalBase(base));
  }
}

export interface BybitRiskLimit {
  /** Tier number, 1-based and ascending with position value. */
  id: number;
  symbol: string;
  /** Upper bound of this tier's position value, in the quote currency. */
  riskLimitValue: string;
  maintenanceMargin: string;
  initialMargin: string;
  isLowestRisk: number;
  maxLeverage: string;
}

export interface BybitFundingHistoryItem {
  symbol: string;
  fundingRate: string;
  fundingRateTimestamp: string;
}

function unwrap<T>(json: BybitEnvelope<T>, what: string): BybitEnvelope<T>["result"] {
  if (json.retCode !== 0) throw new Error(`bybit ${what}: ${json.retCode} ${json.retMsg}`);
  return json.result;
}

function positiveMs(value: unknown): number | null {
  const ms = num(value);
  return ms !== null && ms > 0 ? ms : null;
}

/** Joins tickers with perpetual instrument metadata; `fundingRate` is the rate for the current interval. */
export function parseBybitSnapshots(
  tickers: BybitEnvelope<BybitTicker>,
  instruments: readonly BybitInstrument[],
  now: number,
): SnapshotBatch {
  const perps = new Map(
    instruments
      .filter(
        (i) =>
          i.contractType === "LinearPerpetual" && i.status === "Trading" && i.fundingInterval > 0,
      )
      .map((i) => [i.symbol, i]),
  );

  const snapshots: FundingSnapshot[] = [];
  for (const ticker of unwrap(tickers, "tickers").list) {
    const instrument = perps.get(ticker.symbol);
    const rate = num(ticker.fundingRate);
    if (!instrument || rate === null) continue;

    // Symbols like "1000BONKPERP" don't parse cleanly; baseCoin/quoteCoin do.
    const coin = parseVenueSymbol(`${instrument.baseCoin}-${instrument.quoteCoin}`);
    const hours = instrument.fundingInterval / 60;
    snapshots.push({
      ...marketRef(VENUE_ID, ticker.symbol, {
        base: coin.base,
        quote: coin.quote,
        multiplier: coin.multiplier,
        assetClass: bybitAssetClass(instrument.symbolType, coin.base),
      }),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: positiveMs(ticker.nextFundingTime),
      kind: "predicted",
      markPrice: num(ticker.markPrice),
      indexPrice: num(ticker.indexPrice),
      bestBid: num(ticker.bid1Price),
      // Bybit sizes are base coin already, not contracts: `openInterestValue / openInterest` comes
      // out at exactly the mark price. So the conversion is just size x price, no multiplier.
      bestBidSizeUsd: mul(num(ticker.bid1Size), num(ticker.bid1Price)),
      bestAsk: num(ticker.ask1Price),
      bestAskSizeUsd: mul(num(ticker.ask1Size), num(ticker.ask1Price)),
      openInterestUsd: num(ticker.openInterestValue),
      volume24hUsd: num(ticker.turnover24h),
      maxLeverage: num(instrument.leverageFilter?.maxLeverage),
    });
  }
  return { snapshots, settled: [] };
}

/**
 * Settled funding events, oldest first. Each rate is per settlement interval, which is inferred
 * from the spacing of the events (falling back to `fallbackHours` when there are fewer than two).
 */
export function parseBybitFundingHistory(
  json: BybitEnvelope<BybitFundingHistoryItem>,
  fallbackHours: number,
): FundingEvent[] {
  const points = unwrap(json, "funding history")
    .list.map((item) => ({
      symbol: item.symbol,
      settledAt: num(item.fundingRateTimestamp),
      rate: num(item.fundingRate),
    }))
    .filter(
      (p): p is { symbol: string; settledAt: number; rate: number } =>
        p.settledAt !== null && p.rate !== null,
    )
    .sort((a, b) => a.settledAt - b.settledAt);

  const basisHours = inferIntervalHours(points.map((p) => p.settledAt)) ?? fallbackHours;
  return points.map((p) => ({
    ...marketRef(VENUE_ID, p.symbol),
    settledAt: p.settledAt,
    rate: p.rate,
    basisHours,
    markPrice: null,
  }));
}

/**
 * Normalizes `/v5/market/risk-limit` rows into one ladder per symbol.
 *
 * Bybit gives each tier an upper bound (`riskLimitValue`) in the quote currency and numbers them
 * from 1, so a tier's lower bound is the previous tier's upper bound. Linear perps quote in USDT,
 * which is treated as USD throughout, as open interest already is.
 *
 * A ladder with an unreadable row is dropped whole rather than in part: skipping one tier would
 * silently stretch its neighbour across the gap and quote confident margin for a band nobody
 * verified.
 */
export function parseBybitRiskLimit(rows: readonly BybitRiskLimit[]): LeverageTier[] {
  const bySymbol = new Map<string, BybitRiskLimit[]>();
  for (const row of rows) {
    const existing = bySymbol.get(row.symbol);
    if (existing) existing.push(row);
    else bySymbol.set(row.symbol, [row]);
  }

  const tiers: LeverageTier[] = [];
  for (const [symbol, symbolRows] of bySymbol) {
    const ladder: LeverageTier[] = [];
    let lowerNotionalUsd = 0;
    let usable = true;

    for (const row of [...symbolRows].sort((a, b) => a.id - b.id)) {
      const upper = num(row.riskLimitValue);
      const imr = num(row.initialMargin);
      const maxLeverage = num(row.maxLeverage);
      if (upper === null || upper <= lowerNotionalUsd || imr === null || imr <= 0) {
        usable = false;
        break;
      }
      if (maxLeverage === null || maxLeverage <= 0) {
        usable = false;
        break;
      }
      ladder.push({
        venueId: VENUE_ID,
        venueSymbol: symbol,
        tier: row.id,
        lowerNotionalUsd,
        upperNotionalUsd: upper,
        imr,
        mmr: num(row.maintenanceMargin),
        maxLeverage,
      });
      lowerNotionalUsd = upper;
    }
    if (usable) tiers.push(...ladder);
  }
  return tiers;
}

async function fetchInstruments(client: HttpClient): Promise<BybitInstrument[]> {
  const all: BybitInstrument[] = [];
  let cursor = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const result = unwrap(
      await client.getJson<BybitEnvelope<BybitInstrument>>(
        `${BASE_URL}/v5/market/instruments-info?category=linear&limit=1000${query}`,
      ),
      "instruments",
    );
    all.push(...result.list);
    cursor = result.nextPageCursor ?? "";
    if (!cursor) break;
  }
  return all;
}

export const bybitAdapter: VenueAdapter = {
  venueId: VENUE_ID,
  minIntervalMs: 100,

  async fetchSnapshots(client, now) {
    const [tickers, instruments] = await Promise.all([
      client.getJson<BybitEnvelope<BybitTicker>>(`${BASE_URL}/v5/market/tickers?category=linear`),
      fetchInstruments(client),
    ]);
    return parseBybitSnapshots(tickers, instruments, now);
  },

  async fetchLeverageTiers(client) {
    const rows: BybitRiskLimit[] = [];
    let cursor = "";
    for (let page = 0; page < RISK_LIMIT_MAX_PAGES; page++) {
      const query = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const result = unwrap(
        await client.getJson<BybitEnvelope<BybitRiskLimit>>(
          `${BASE_URL}/v5/market/risk-limit?category=linear${query}`,
        ),
        "risk limit",
      );
      rows.push(...result.list);
      cursor = result.nextPageCursor ?? "";
      if (!cursor) break;
    }
    // A failed page throws out of this loop rather than being skipped, so reaching here means the
    // whole book was read and pruning stale ladders is safe.
    return { tiers: parseBybitRiskLimit(rows), complete: true };
  },

  async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
    const items: BybitFundingHistoryItem[] = [];
    let endTime = toMs;
    for (let page = 0; page < MAX_PAGES && endTime >= fromMs; page++) {
      const json = await client.getJson<BybitEnvelope<BybitFundingHistoryItem>>(
        `${BASE_URL}/v5/market/funding/history?category=linear&symbol=${encodeURIComponent(venueSymbol)}&startTime=${fromMs}&endTime=${endTime}&limit=${HISTORY_PAGE}`,
      );
      const list = unwrap(json, "funding history").list;
      items.push(...list);
      if (list.length < HISTORY_PAGE) break;
      const oldest = Math.min(...list.map((i) => Number(i.fundingRateTimestamp)));
      endTime = oldest - 1;
    }

    let fallbackHours = 8;
    if (items.length < 2) {
      const info = unwrap(
        await client.getJson<BybitEnvelope<BybitInstrument>>(
          `${BASE_URL}/v5/market/instruments-info?category=linear&symbol=${encodeURIComponent(venueSymbol)}`,
        ),
        "instrument",
      ).list[0];
      if (info && info.fundingInterval > 0) fallbackHours = info.fundingInterval / 60;
    }

    const unique = [...new Map(items.map((i) => [i.fundingRateTimestamp, i])).values()];
    return parseBybitFundingHistory(
      { retCode: 0, retMsg: "OK", result: { list: unique } },
      fallbackHours,
    );
  },
};
