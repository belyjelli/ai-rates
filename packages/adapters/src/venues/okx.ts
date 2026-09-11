import { type FundingEvent, type FundingSnapshot, inferIntervalHours } from "@ai-rates/core";
import { hoursBetween, marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "okx";
const BASE_URL = "https://www.okx.com";
const HISTORY_PAGE = 100;
const MAX_PAGES = 50;

/** Perpetual swaps margined in USDT, USDC or coin (USD). Excludes e.g. "XAU-USD_UM_XPERP-310502". */
const PERP_INST_ID = /^[A-Z0-9]+-(USDT|USDC|USD)-SWAP$/;

export interface OkxEnvelope<T> {
  code: string;
  msg?: string;
  data: T[];
}

export interface OkxFundingRate {
  instId: string;
  /** Rate for the current period, charged at `fundingTime`. */
  fundingRate: string;
  fundingTime: string;
  nextFundingTime: string;
  /** Rate actually settled at `prevFundingTime`. */
  settFundingRate: string;
  prevFundingTime: string;
  settState?: string;
}

export interface OkxTicker {
  instId: string;
  last: string;
  /** 24h volume in the base currency. */
  volCcy24h: string;
}

export interface OkxOpenInterest {
  instId: string;
  oiUsd: string;
}

export interface OkxMarkPrice {
  instId: string;
  markPx: string;
}

export interface OkxFundingHistoryItem {
  instId: string;
  fundingRate: string;
  realizedRate?: string;
  fundingTime: string;
}

function unwrap<T>(json: OkxEnvelope<T>, what: string): T[] {
  if (json.code !== "0") throw new Error(`okx ${what}: ${json.code} ${json.msg ?? ""}`);
  return json.data;
}

function byInstId<T extends { instId: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.instId, row]));
}

export function parseOkxSnapshots(
  funding: OkxEnvelope<OkxFundingRate>,
  tickers: OkxEnvelope<OkxTicker>,
  openInterest: OkxEnvelope<OkxOpenInterest>,
  markPrices: OkxEnvelope<OkxMarkPrice>,
  now: number,
): SnapshotBatch {
  const tickerById = byInstId(unwrap(tickers, "tickers"));
  const oiById = byInstId(unwrap(openInterest, "open interest"));
  const markById = byInstId(unwrap(markPrices, "mark price"));

  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];
  for (const row of unwrap(funding, "funding rate")) {
    if (!PERP_INST_ID.test(row.instId)) continue;
    const fundingTime = num(row.fundingTime);
    const intervalHours = hoursBetween(fundingTime, num(row.nextFundingTime));
    const rate = num(row.fundingRate);
    if (intervalHours === null || rate === null) continue;

    const ref = marketRef(VENUE_ID, row.instId);
    const ticker = tickerById.get(row.instId);
    snapshots.push({
      ...ref,
      observedAt: now,
      rate,
      basisHours: intervalHours,
      intervalHours,
      nextFundingAt: fundingTime,
      kind: "predicted",
      markPrice: num(markById.get(row.instId)?.markPx),
      indexPrice: null,
      openInterestUsd: num(oiById.get(row.instId)?.oiUsd),
      volume24hUsd: ticker ? mul(num(ticker.volCcy24h), num(ticker.last)) : null,
    });

    const settledAt = num(row.prevFundingTime);
    const settledRate = num(row.settFundingRate);
    if (settledAt !== null && settledRate !== null && (row.settState ?? "settled") === "settled") {
      settled.push({
        ...ref,
        settledAt,
        rate: settledRate,
        basisHours: hoursBetween(settledAt, fundingTime) ?? intervalHours,
        markPrice: null,
      });
    }
  }
  return { snapshots, settled };
}

/** Settled funding events, oldest first; prefers `realizedRate` (what was actually charged). */
export function parseOkxFundingHistory(
  json: OkxEnvelope<OkxFundingHistoryItem>,
  fallbackHours: number,
): FundingEvent[] {
  const points = unwrap(json, "funding history")
    .map((item) => ({
      instId: item.instId,
      settledAt: num(item.fundingTime),
      rate: num(item.realizedRate) ?? num(item.fundingRate),
    }))
    .filter(
      (p): p is { instId: string; settledAt: number; rate: number } =>
        p.settledAt !== null && p.rate !== null,
    )
    .sort((a, b) => a.settledAt - b.settledAt);

  const basisHours = inferIntervalHours(points.map((p) => p.settledAt)) ?? fallbackHours;
  return points.map((p) => ({
    ...marketRef(VENUE_ID, p.instId),
    settledAt: p.settledAt,
    rate: p.rate,
    basisHours,
    markPrice: null,
  }));
}

export const okxAdapter: VenueAdapter = {
  venueId: VENUE_ID,
  minIntervalMs: 120,

  async fetchSnapshots(client, now) {
    const [funding, tickers, openInterest, markPrices] = await Promise.all([
      client.getJson<OkxEnvelope<OkxFundingRate>>(
        `${BASE_URL}/api/v5/public/funding-rate?instId=ANY`,
      ),
      client.getJson<OkxEnvelope<OkxTicker>>(`${BASE_URL}/api/v5/market/tickers?instType=SWAP`),
      client.getJson<OkxEnvelope<OkxOpenInterest>>(
        `${BASE_URL}/api/v5/public/open-interest?instType=SWAP`,
      ),
      client.getJson<OkxEnvelope<OkxMarkPrice>>(
        `${BASE_URL}/api/v5/public/mark-price?instType=SWAP`,
      ),
    ]);
    return parseOkxSnapshots(funding, tickers, openInterest, markPrices, now);
  },

  async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
    const items: OkxFundingHistoryItem[] = [];
    // `after` returns records strictly older than the given fundingTime.
    let after = toMs + 1;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = unwrap(
        await client.getJson<OkxEnvelope<OkxFundingHistoryItem>>(
          `${BASE_URL}/api/v5/public/funding-rate-history?instId=${encodeURIComponent(venueSymbol)}&after=${after}&limit=${HISTORY_PAGE}`,
        ),
        "funding history",
      );
      items.push(...data.filter((i) => Number(i.fundingTime) >= fromMs));
      if (data.length < HISTORY_PAGE) break;
      const oldest = Math.min(...data.map((i) => Number(i.fundingTime)));
      if (oldest < fromMs) break;
      after = oldest;
    }

    let fallbackHours = 8;
    if (items.length < 2) {
      const current = unwrap(
        await client.getJson<OkxEnvelope<OkxFundingRate>>(
          `${BASE_URL}/api/v5/public/funding-rate?instId=${encodeURIComponent(venueSymbol)}`,
        ),
        "funding rate",
      )[0];
      fallbackHours =
        hoursBetween(num(current?.fundingTime), num(current?.nextFundingTime)) ?? fallbackHours;
    }
    return parseOkxFundingHistory({ code: "0", data: items }, fallbackHours);
  },
};
