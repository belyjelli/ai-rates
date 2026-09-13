import {
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  type LeverageTier,
  type Liquidation,
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
/**
 * Families visited per liquidations run. 479 families at 40 a run, every five minutes, revisits
 * each about hourly -- well inside the ~21.8-hour page each family answers with.
 */
const LIQUIDATION_FAMILIES_PER_RUN = 40;
const LIQUIDATION_PAGE = 100;
const LIQUIDATION_RETRIES = 2;
const LIQUIDATION_BACKOFF_MS = 400;
/** Where the next rotation resumes. Module state: a restart simply starts the cycle again. */
let liquidationCursor = 0;
const POSITION_TIERS_RETRIES = 2;
const POSITION_TIERS_BACKOFF_MS = 400;

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
  /** Top of book. Prices are quote currency; the paired sizes are contracts. */
  bidPx?: string;
  bidSz?: string;
  askPx?: string;
  askSz?: string;
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

export interface OkxLiquidationDetail {
  /** The side of the POSITION that was closed. OKX states it directly, unlike Gate. */
  posSide: "long" | "short" | string;
  /** The closing order's side; "sell" closes a long. Not used -- posSide is authoritative. */
  side: string;
  /** Size in CONTRACTS, as everywhere else in this API. */
  sz: string;
  /** Bankruptcy price: the price the forced close filled at. */
  bkPx: string;
  bkLoss: string;
  ccy: string;
  /** Epoch MILLISECONDS -- unlike Gate's seconds. */
  ts: string;
  time: number;
}

export interface OkxLiquidationRow {
  instId: string;
  instType: string;
  instFamily?: string;
  details: OkxLiquidationDetail[];
}

/**
 * OKX's forced closes, normalised.
 *
 * Three differences from Gate, each of which would be a bug if carried across:
 *   - `posSide` names the liquidated position outright, so there is no sign to interpret.
 *   - `ts` is already epoch MILLISECONDS; multiplying by 1000 would place every record in the year
 *     58,000 and silently drop it from every window the study asks for.
 *   - `sz` is contracts, converted with the instrument's own `ctVal` -- and for inverse swaps
 *     (`ctValCcy === "USD"`) the contract is already dollars, so the mark must NOT be applied.
 *     Inverse families do produce liquidations (ETH-USD returns records), so that branch is live.
 */
export function parseOkxLiquidations(
  rows: readonly OkxLiquidationRow[],
  instrumentById: ReadonlyMap<string, OkxInstrument>,
  markById: ReadonlyMap<string, OkxMarkPrice>,
): Liquidation[] {
  const out: Liquidation[] = [];
  for (const row of rows) {
    const instrument = instrumentById.get(row.instId);
    const contractUsd = instrument ? contractNotionalUsd(instrument, markById) : null;

    for (const detail of row.details ?? []) {
      const size = num(detail.sz);
      const fillPrice = num(detail.bkPx);
      const at = num(detail.ts);
      if (size === null || size <= 0 || fillPrice === null || fillPrice <= 0) continue;
      if (at === null || at <= 0) continue;
      if (detail.posSide !== "long" && detail.posSide !== "short") continue;

      out.push({
        ...marketRef(VENUE_ID, row.instId),
        liquidatedAt: at,
        side: detail.posSide,
        sizeContracts: size,
        fillPrice,
        // contractUsd already folds in ctVal, ctMult and the inverse/linear distinction.
        notionalUsd: contractUsd === null ? null : size * contractUsd,
      });
    }
  }
  return out;
}

export function parseOkxSnapshots(
  funding: OkxEnvelope<OkxFundingRate>,
  tickers: OkxEnvelope<OkxTicker>,
  openInterest: OkxEnvelope<OkxOpenInterest>,
  markPrices: OkxEnvelope<OkxMarkPrice>,
  instruments: OkxEnvelope<OkxInstrument>,
  now: number,
): SnapshotBatch {
  const tickerById = byInstId(unwrap(tickers, "tickers"));
  const oiById = byInstId(unwrap(openInterest, "open interest"));
  const markById = byInstId(unwrap(markPrices, "mark price"));
  // Only for turning book sizes into money: OKX quotes them in contracts, and `ctVal` is the only
  // thing that says what a contract is worth. Fifteen swaps are inverse (`ctValCcy: "USD"`), which
  // `contractNotionalUsd` already handles -- reading those as coin was a 77,742x error once.
  const instrumentById = byInstId(unwrap(instruments, "instruments"));

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
    const instrument = instrumentById.get(row.instId);
    const contractUsd = instrument ? contractNotionalUsd(instrument, markById) : null;
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
      bestBid: num(ticker?.bidPx),
      bestBidSizeUsd: mul(num(ticker?.bidSz), contractUsd),
      bestAsk: num(ticker?.askPx),
      bestAskSizeUsd: mul(num(ticker?.askSz), contractUsd),
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
    const [funding, tickers, openInterest, markPrices, instruments] = await Promise.all([
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
      // One bulk call for all 479 swaps, not one per market: `ctVal` is what turns a book size in
      // contracts into a USD depth, and nothing else in this request set carries it.
      client.getJson<OkxEnvelope<OkxInstrument>>(
        `${BASE_URL}/api/v5/public/instruments?instType=SWAP`,
      ),
    ]);
    return parseOkxSnapshots(funding, tickers, openInterest, markPrices, instruments, now);
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
    let complete = true;

    for (let i = 0; i < families.length; i += POSITION_TIERS_PER_CALL) {
      const batch = families.slice(i, i + POSITION_TIERS_PER_CALL).join(",");
      let fetched: OkxPositionTier[] | null = null;

      // OKX signals a rate limit as code 50011 inside an HTTP 200, so the transport's retry and
      // circuit breaker never see it and the adapter has to back off itself.
      for (let attempt = 0; fetched === null && attempt <= POSITION_TIERS_RETRIES; attempt++) {
        try {
          fetched = unwrap(
            await client.getJson<OkxEnvelope<OkxPositionTier>>(
              `${BASE_URL}/api/v5/public/position-tiers?instType=SWAP&tdMode=cross&instFamily=${encodeURIComponent(batch)}`,
            ),
            "position tiers",
          );
        } catch (error) {
          if (error instanceof CircuitOpenError) {
            // The venue is down; the rest of the sweep would fail too.
            return {
              tiers: parseOkxPositionTiers(instruments, { code: "0", data: rows }, markPrices),
              complete: false,
            };
          }
          if (attempt < POSITION_TIERS_RETRIES) {
            await new Promise((resolve) =>
              setTimeout(resolve, POSITION_TIERS_BACKOFF_MS << attempt),
            );
          }
        }
      }

      // Five families ride on every call, so a batch given up on costs five ladders. Saying so
      // keeps the sweep from pruning them, and makes the loss visible in the collector log.
      if (fetched === null) complete = false;
      else rows.push(...fetched);
    }

    return {
      tiers: parseOkxPositionTiers(instruments, { code: "0", data: rows }, markPrices),
      complete,
    };
  },

  /**
   * Forced closes, as a ROTATION rather than a full sweep.
   *
   * OKX answers per `instFamily` and every one of its 479 perps is its own family, so a whole-venue
   * pass costs 479 calls -- against Gate's one. What makes a rotation safe rather than lossy is the
   * page depth: measured 2026-09-13, a 100-record page on BTC-USDT spans **21.8 hours** at 0.03
   * records/min, with the newest record ~92 minutes old. A slice of 40 families every five minutes
   * therefore revisits each family about hourly and still reads far inside its own page.
   *
   * Worth collecting despite the cost: a sampled census of 29 families found 8 active with 252
   * records, which extrapolates to ~132 active families and ~4,200 records per full rotation.
   *
   * The cursor lives in module state so successive calls continue where the last stopped; a restart
   * simply begins again at zero, which costs nothing because the pages are so deep.
   */
  async fetchLiquidations(client) {
    const [instruments, markPrices] = await Promise.all([
      client.getJson<OkxEnvelope<OkxInstrument>>(
        `${BASE_URL}/api/v5/public/instruments?instType=SWAP`,
      ),
      client.getJson<OkxEnvelope<OkxMarkPrice>>(
        `${BASE_URL}/api/v5/public/mark-price?instType=SWAP`,
      ),
    ]);

    const perps = unwrap(instruments, "instruments").filter(
      (instrument) => PERP_INST_ID.test(instrument.instId) && instrument.instFamily,
    );
    const instrumentById = byInstId(perps);
    const markById = byInstId(unwrap(markPrices, "mark price"));
    const families = [...new Set(perps.map((instrument) => instrument.instFamily))];
    if (families.length === 0) return { liquidations: [], complete: true };

    const rows: OkxLiquidationRow[] = [];
    let complete = true;
    const start = liquidationCursor % families.length;

    // Clamped, so a book smaller than the budget is not re-read on a loop. In production 479
    // families makes this a no-op; without it a 5-family venue would fetch each page eight times
    // in one run, burning a rate-limited venue's budget on pages it already has.
    const visits = Math.min(LIQUIDATION_FAMILIES_PER_RUN, families.length);
    for (let i = 0; i < visits; i++) {
      const family = families[(start + i) % families.length] as string;
      let fetched: OkxLiquidationRow[] | null = null;

      // As with position tiers: a rate limit arrives as code 50011 inside an HTTP 200, so the
      // transport's retry never sees it and the adapter backs off itself.
      for (let attempt = 0; fetched === null && attempt <= LIQUIDATION_RETRIES; attempt++) {
        try {
          fetched = unwrap(
            await client.getJson<OkxEnvelope<OkxLiquidationRow>>(
              `${BASE_URL}/api/v5/public/liquidation-orders?instType=SWAP&state=filled&limit=${LIQUIDATION_PAGE}&instFamily=${encodeURIComponent(family)}`,
            ),
            "liquidations",
          );
        } catch (error) {
          if (error instanceof CircuitOpenError) {
            // The venue is down; the rest of the rotation would fail too. Nothing is pruned, so
            // this is lost coverage rather than lost data -- but it is still reported.
            liquidationCursor = (start + i) % families.length;
            return {
              liquidations: parseOkxLiquidations(rows, instrumentById, markById),
              complete: false,
            };
          }
          if (attempt < LIQUIDATION_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, LIQUIDATION_BACKOFF_MS << attempt));
          }
        }
      }

      if (fetched === null) complete = false;
      else rows.push(...fetched);
    }

    liquidationCursor = (start + visits) % families.length;
    return { liquidations: parseOkxLiquidations(rows, instrumentById, markById), complete };
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
