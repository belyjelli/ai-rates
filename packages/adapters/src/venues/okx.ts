import {
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  type LeverageTier,
} from "@ai-rates/core";
import { CircuitOpenError } from "../http";
import { hoursBetween, marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "okx";
const BASE_URL = "https://www.okx.com";
const HISTORY_PAGE = 100;
const MAX_PAGES = 50;
/** OKX rejects more than this per call: "Parameter instFamily count exceeds the limit 5". */
const POSITION_TIERS_PER_CALL = 5;

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

export interface OkxInstrument {
  instId: string;
  /** Tier ladders are published per family ("BTC-USDT"), not per instrument. */
  instFamily: string;
  /** Size of one contract, denominated in `ctValCcy`. */
  ctVal: string;
  /** Base coin for linear swaps; "USD" for inverse ones, which are already quoted in dollars. */
  ctValCcy: string;
  ctMult: string;
}

export interface OkxPositionTier {
  instFamily: string;
  tier: string;
  /** Contracts, not notional. Inclusive lower bound of the band. */
  minSz: string;
  /** Contracts. Inclusive upper bound; the next tier starts just above it. */
  maxSz: string;
  imr: string;
  mmr: string;
  maxLever: string;
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

/**
 * USD notional of a single contract, or null when it cannot be established.
 *
 * Inverse swaps (`ctValCcy` "USD", settled in the base coin) already size a contract in dollars,
 * so the mark plays no part. Linear swaps size it in the base coin and need the mark to reach USD;
 * without one the ladder cannot be converted at all, and a guess would be worse than nothing.
 */
function contractNotionalUsd(
  instrument: OkxInstrument,
  markById: ReadonlyMap<string, OkxMarkPrice>,
): number | null {
  const ctVal = num(instrument.ctVal);
  const ctMult = num(instrument.ctMult) ?? 1;
  if (ctVal === null || ctVal <= 0) return null;
  if (instrument.ctValCcy === "USD") return ctVal * ctMult;

  const mark = num(markById.get(instrument.instId)?.markPx);
  return mark === null || mark <= 0 ? null : ctVal * ctMult * mark;
}

/**
 * Converts OKX position tiers into USD-bounded ladders, one per instrument.
 *
 * **OKX bounds tiers in contracts, not notional.** BTC-USDT-SWAP is 0.01 BTC a contract, so tier
 * 1's `maxSz` of 1000 is 10 BTC — about $780k — and not $1,000. Reading those numbers as dollars
 * would put the first leverage step three orders of magnitude too low.
 *
 * Ladders are published per family, so every instrument in a family shares one ladder but converts
 * it with its own contract value. Bounds become half-open: each band ends where the next begins,
 * since OKX's inclusive `[0, 1000]` then `[1000.01, 5000]` would otherwise leave a gap that
 * resolves to no tier. The last band keeps its own `maxSz`, a real cap on position size.
 */
export function parseOkxPositionTiers(
  instruments: OkxEnvelope<OkxInstrument>,
  tiers: OkxEnvelope<OkxPositionTier>,
  markPrices: OkxEnvelope<OkxMarkPrice>,
): LeverageTier[] {
  const markById = byInstId(unwrap(markPrices, "mark price"));

  const rowsByFamily = new Map<string, OkxPositionTier[]>();
  for (const row of unwrap(tiers, "position tiers")) {
    const existing = rowsByFamily.get(row.instFamily);
    if (existing) existing.push(row);
    else rowsByFamily.set(row.instFamily, [row]);
  }

  const ladders: LeverageTier[] = [];
  for (const instrument of unwrap(instruments, "instruments")) {
    if (!PERP_INST_ID.test(instrument.instId)) continue;
    const rows = rowsByFamily.get(instrument.instFamily);
    if (!rows || rows.length === 0) continue;

    const contractUsd = contractNotionalUsd(instrument, markById);
    if (contractUsd === null) continue;

    const sorted = [...rows].sort((a, b) => Number(a.tier) - Number(b.tier));
    const ladder: LeverageTier[] = [];
    let usable = true;

    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i] as OkxPositionTier;
      const tier = num(row.tier);
      const lower = num(row.minSz);
      const imr = num(row.imr);
      const maxLeverage = num(row.maxLever);
      // The band ends where the next begins; the top band keeps the venue's own cap.
      const upper = i + 1 < sorted.length ? num(sorted[i + 1]?.minSz) : num(row.maxSz);

      if (
        tier === null ||
        lower === null ||
        upper === null ||
        upper <= lower ||
        imr === null ||
        imr <= 0 ||
        maxLeverage === null ||
        maxLeverage <= 0
      ) {
        // As on Bybit, an unreadable tier drops the whole ladder: keeping the rest would stretch a
        // neighbouring band across the gap and quote confident margin for an unverified range.
        usable = false;
        break;
      }

      ladder.push({
        venueId: VENUE_ID,
        venueSymbol: instrument.instId,
        tier,
        lowerNotionalUsd: lower * contractUsd,
        upperNotionalUsd: upper * contractUsd,
        imr,
        mmr: num(row.mmr),
        maxLeverage,
      });
    }
    if (usable) ladders.push(...ladder);
  }
  return ladders;
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

  /**
   * The whole venue's ladders: instruments and marks in bulk, then families five at a time (OKX's
   * own limit), so a full sweep is about 98 requests once a day rather than one per market.
   */
  async fetchLeverageTiers(client) {
    const [instruments, markPrices] = await Promise.all([
      client.getJson<OkxEnvelope<OkxInstrument>>(
        `${BASE_URL}/api/v5/public/instruments?instType=SWAP`,
      ),
      client.getJson<OkxEnvelope<OkxMarkPrice>>(
        `${BASE_URL}/api/v5/public/mark-price?instType=SWAP`,
      ),
    ]);

    const families = [
      ...new Set(
        unwrap(instruments, "instruments")
          .filter((instrument) => PERP_INST_ID.test(instrument.instId) && instrument.instFamily)
          .map((instrument) => instrument.instFamily),
      ),
    ];

    const rows: OkxPositionTier[] = [];
    for (let i = 0; i < families.length; i += POSITION_TIERS_PER_CALL) {
      const batch = families.slice(i, i + POSITION_TIERS_PER_CALL).join(",");
      try {
        rows.push(
          ...unwrap(
            await client.getJson<OkxEnvelope<OkxPositionTier>>(
              `${BASE_URL}/api/v5/public/position-tiers?instType=SWAP&tdMode=cross&instFamily=${encodeURIComponent(batch)}`,
            ),
            "position tiers",
          ),
        );
      } catch (error) {
        if (error instanceof CircuitOpenError) break;
        // One rejected batch shouldn't cost the venue's other 94; those families keep their
        // stored ladders, since the store only prunes markets this sweep did report.
      }
    }
    return parseOkxPositionTiers(instruments, { code: "0", data: rows }, markPrices);
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
