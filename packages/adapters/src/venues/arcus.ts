import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Arcus (dYdX Labs, Robinhood Chain).
 *
 * REQUESTS: one per cycle, `GET /v1/markets`. Every public call draws from a per-IP bucket of 1,500
 * weight refilling at 1,500/minute; `markets` and `fundingRates` cost 20 plus floor(rows / 20)
 * (https://docs.arcus.xyz/api-reference/rate-limits.md). A full 1,000-row history page is 70, so 3s
 * spacing (20 calls/minute, 1,400 weight at worst) cannot exhaust the bucket.
 *
 * FUNDING: hourly, as a fraction, positive means longs pay
 * (https://docs.arcus.xyz/concepts/perpetuals/funding.md: "charged once an hour", capped at ±4%/h).
 * The markets doc defines `fundingRate` as the "most recently applied funding rate" and
 * `nextFundingRate` as the "forecast for the next funding rate", so:
 * - the snapshot's rate is `nextFundingRate`, `predicted`, due at `nextFundingAt` (unix SECONDS);
 * - `fundingRate` is also returned as a `settled` event one hour before `nextFundingAt`. Verified live
 *   2026-09-14: `/v1/fundingRates` for BTC-USD and AMD-USD had its newest row at exactly
 *   `nextFundingAt - 3600s`, with the same rate as `fundingRate` (0.0000125 and 0.000004768518518518).
 * Checked against other venues: BTC 0.0000125/h is 10.95% APR, Extended 11.4% the same afternoon.
 *
 * UNITS, per the markets doc and checked live: `openInterest` is "total size of all open long
 * positions ... in base asset units" (BTC 60.06 x 77,119.6 = $4.63M, a tenth of Extended's $44.8M for
 * a venue launched in May), and `volume24hNotional` is USD (BTC $18.09M, and 229.32 BTC x mark agrees).
 *
 * TRADABILITY: `type` PERPETUAL and `status` ONLINE. On 2026-09-14: 58 ONLINE, 6 OFFLINE (F, BAC, CCL,
 * RVI, VT, SGOV, all at zero price). Equities outside regular hours stay ONLINE: "RWA perps trade 24/7"
 * with funding locked to SOFR + 0.5% off-hours, so they are kept.
 *
 * QUOTE: USDG. `quoteAsset` is "USD" on every market, the price unit, but "Arcus settles in USDG, a
 * regulated stablecoin issued by Paxos" (https://docs.arcus.xyz/concepts/onboarding.md).
 *
 * BASE: `baseAsset` agreed with the parsed `marketDisplayName` on all 58 live markets, so the parser
 * is used as for every other venue.
 */

const VENUE = "arcus";
export const ARCUS_API = "https://api.arcus.xyz/v1";
const HOUR_MS = 3_600_000;
const FUNDING_HOURS = 1;
const QUOTE = "USDG";
/** `fundingRates` default and maximum page size, newest first. */
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 50;

export interface ArcusMarket {
  marketDisplayName: string;
  status: string;
  type: string;
  category?: string | null;
  baseAsset?: string;
  quoteAsset?: string;
  markPrice?: string | null;
  oraclePrice?: string | null;
  /** Most recently applied hourly rate. */
  fundingRate?: string | null;
  /** Forecast for the next hourly payment. */
  nextFundingRate?: string | null;
  /** Unix seconds. */
  nextFundingAt?: number | null;
  /** Base units, long side. */
  openInterest?: string | null;
  volume24hNotional?: string | null;
  initialMarginFraction?: string | null;
}

export interface ArcusFundingRate {
  marketDisplayName: string;
  fundingRate: string;
  /** Epoch microseconds. */
  time: number;
}

/**
 * The class Arcus declares in `category`: CRYPTO, EQUITIES, INDICES, FOREX or COMMODITIES.
 *
 * On 2026-09-14 the 58 live perps were CRYPTO 22, EQUITIES 30, COMMODITIES 4 and INDICES 2.
 *
 * COMMODITIES is not taken literally. Its four markets are GLD, SLV, USO and CPER, which the RWA doc
 * describes as "commodity ETFs" (https://docs.arcus.xyz/concepts/perpetuals/real-world-assets.md),
 * and core files ETFs as equity whatever a venue calls them. So the category says "not crypto" and
 * the base tables say which kind: the four ETFs become equity, while a spot-gold XAU perp listed
 * there later would still become commodity. INDICES (SPY, QQQ, also ETFs) is passed as index for
 * `marketRef` to settle the same way. Anything unrecognised that is not CRYPTO is tradfi of an
 * unknown kind.
 */
export function arcusAssetClass(category: string | null | undefined, base: string): AssetClass {
  const declared = category?.trim().toUpperCase() ?? "";
  switch (declared) {
    case "":
    case "CRYPTO":
      return "crypto";
    case "EQUITIES":
      return "equity";
    case "INDICES":
      return "index";
    case "FOREX":
      return "fx";
    default:
      return classifyNonCrypto(base);
  }
}

function ref(venueSymbol: string, category: string | null | undefined) {
  const parsed = marketRef(VENUE, venueSymbol);
  return marketRef(VENUE, venueSymbol, {
    quote: QUOTE,
    assetClass: arcusAssetClass(category, parsed.base),
  });
}

export function parseArcusMarkets(body: { markets: ArcusMarket[] }, now: number): SnapshotBatch {
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];
  for (const market of body.markets) {
    const rate = num(market.nextFundingRate);
    if (market.type !== "PERPETUAL" || market.status !== "ONLINE" || rate === null) continue;

    const base = ref(market.marketDisplayName, market.category);
    const nextSeconds = num(market.nextFundingAt);
    const nextFundingAt = nextSeconds !== null && nextSeconds > 0 ? nextSeconds * 1000 : null;
    const markPrice = num(market.markPrice);
    const openInterest = num(market.openInterest);
    const imf = num(market.initialMarginFraction);

    snapshots.push({
      ...base,
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(market.oraclePrice),
      openInterestUsd:
        openInterest !== null && markPrice !== null ? openInterest * markPrice : null,
      volume24hUsd: num(market.volume24hNotional),
      maxLeverage: imf !== null && imf > 0 && imf <= 1 ? 1 / imf : null,
    });

    const applied = num(market.fundingRate);
    if (applied !== null && nextFundingAt !== null) {
      settled.push({
        ...base,
        settledAt: nextFundingAt - HOUR_MS,
        rate: applied,
        basisHours: FUNDING_HOURS,
        markPrice: null,
      });
    }
  }
  return { snapshots, settled };
}

/** Hourly settlements within [fromMs, toMs], oldest first. */
export function parseArcusFundingRates(
  rows: readonly ArcusFundingRate[],
  venueSymbol: string,
  category: string | null | undefined,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(venueSymbol, category);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const micros = num(row.time);
    const rate = num(row.fundingRate);
    if (micros === null || rate === null) continue;
    const settledAt = Math.floor(micros / 1000);
    if (settledAt < fromMs || settledAt > toMs) continue;
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

export function createArcusAdapter(): VenueAdapter {
  /** History carries no category, so class is remembered from the markets call. */
  const categories = new Map<string, string | null | undefined>();

  return {
    venueId: VENUE,
    minIntervalMs: 3000,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const body = await client.getJson<{ markets: ArcusMarket[] }>(`${ARCUS_API}/markets`);
      if (!Array.isArray(body?.markets)) throw new Error(`${VENUE}: unexpected markets response`);
      for (const m of body.markets) categories.set(m.marketDisplayName, m.category);
      return parseArcusMarkets(body, now);
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const rows: ArcusFundingRate[] = [];
      let toMicros = toMs * 1000;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const url = `${ARCUS_API}/fundingRates?market=${encodeURIComponent(venueSymbol)}&from=${fromMs * 1000}&to=${toMicros}&limit=${HISTORY_PAGE_SIZE}`;
        const body = await client.getJson<{ fundingRates: ArcusFundingRate[] }>(url);
        const batch = body?.fundingRates;
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected fundingRates response`);
        rows.push(...batch);
        const oldest = Math.min(...batch.map((r) => r.time));
        if (
          batch.length < HISTORY_PAGE_SIZE ||
          !Number.isFinite(oldest) ||
          oldest <= fromMs * 1000
        ) {
          break;
        }
        toMicros = oldest - 1;
      }
      return parseArcusFundingRates(rows, venueSymbol, categories.get(venueSymbol), fromMs, toMs);
    },
  };
}

export const arcusAdapter: VenueAdapter = createArcusAdapter();
