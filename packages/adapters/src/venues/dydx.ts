import type { FundingEvent, FundingSnapshot, LeverageTier } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { VenueAdapter } from "../types";

const VENUE = "dydx";
const BASE = "https://indexer.dydx.trade/v4";
const HOUR_MS = 3_600_000;
/** dYdX v4 charges funding every hour and quotes a 1-hour rate. */
const FUNDING_HOURS = 1;
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 100;

export interface DydxPerpetualMarket {
  ticker: string;
  status: string;
  oraclePrice: string;
  /** Predicted 1-hour rate for the upcoming settlement. */
  nextFundingRate: string;
  /** Open interest in base units. */
  openInterest: string;
  /** 24h volume in USD. */
  volume24H: string;
  /** Initial margin as a fraction of notional: 0.02 is 50x. Flat per market, not tiered. */
  initialMarginFraction?: string;
  maintenanceMarginFraction?: string;
}

export interface DydxHistoricalFunding {
  ticker: string;
  rate: string;
  price: string;
  effectiveAt: string;
}

export function parseDydxMarkets(
  body: { markets: Record<string, DydxPerpetualMarket> },
  now: number,
): FundingSnapshot[] {
  const nextFundingAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const snapshots: FundingSnapshot[] = [];
  for (const market of Object.values(body.markets)) {
    const rate = num(market.nextFundingRate);
    if (market.status !== "ACTIVE" || rate === null) continue;

    // dYdX has no separate mark price in the indexer; positions are marked to the oracle price.
    const oracle = num(market.oraclePrice);
    snapshots.push({
      ...marketRef(VENUE, market.ticker),
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt,
      kind: "predicted",
      markPrice: oracle,
      indexPrice: oracle,
      openInterestUsd: mul(num(market.openInterest), oracle),
      volume24hUsd: num(market.volume24H),
    });
  }
  return snapshots;
}

/**
 * dYdX margins flat: one rate for a market at any size, so each market gets a single unbounded
 * tier rather than a ladder. The rate is not uniform across markets though — majors run at 0.02
 * (50x) while smaller markets sit at 0.1 (10x), so it is read per market, never assumed.
 */
export function parseDydxLeverageTiers(body: {
  markets: Record<string, DydxPerpetualMarket>;
}): LeverageTier[] {
  const tiers: LeverageTier[] = [];
  for (const market of Object.values(body.markets)) {
    const imr = num(market.initialMarginFraction);
    if (market.status !== "ACTIVE" || imr === null || imr <= 0 || imr > 1) continue;
    tiers.push({
      venueId: VENUE,
      venueSymbol: market.ticker,
      tier: 1,
      lowerNotionalUsd: 0,
      // dYdX publishes no maximum position size.
      upperNotionalUsd: null,
      imr,
      mmr: num(market.maintenanceMarginFraction),
      maxLeverage: 1 / imr,
    });
  }
  return tiers;
}

/** Settled hourly payments within [fromMs, toMs], oldest first. */
export function parseDydxHistoricalFunding(
  items: readonly DydxHistoricalFunding[],
  venueSymbol: string,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const bySettlement = new Map<number, FundingEvent>();
  for (const item of items) {
    const settledAt = Date.parse(item.effectiveAt);
    const rate = num(item.rate);
    if (!Number.isFinite(settledAt) || rate === null || settledAt < fromMs || settledAt > toMs)
      continue;
    bySettlement.set(settledAt, {
      ...marketRef(VENUE, venueSymbol),
      settledAt,
      rate,
      basisHours: FUNDING_HOURS,
      markPrice: num(item.price),
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export const dydxAdapter: VenueAdapter = {
  venueId: VENUE,
  minIntervalMs: 100,

  async fetchSnapshots(client: HttpClient, now: number) {
    const body = await client.getJson<{ markets: Record<string, DydxPerpetualMarket> }>(
      `${BASE}/perpetualMarkets`,
    );
    if (!body?.markets || typeof body.markets !== "object") {
      throw new Error(`${VENUE}: unexpected perpetualMarkets response`);
    }
    return { snapshots: parseDydxMarkets(body, now), settled: [] };
  },

  /** The margin fractions ride along in `perpetualMarkets`, so this is one request for the venue. */
  async fetchLeverageTiers(client: HttpClient) {
    const body = await client.getJson<{ markets: Record<string, DydxPerpetualMarket> }>(
      `${BASE}/perpetualMarkets`,
    );
    if (!body?.markets || typeof body.markets !== "object") {
      throw new Error(`${VENUE}: unexpected perpetualMarkets response`);
    }
    return { tiers: parseDydxLeverageTiers(body), complete: true };
  },

  async fetchFundingHistory(client: HttpClient, venueSymbol: string, fromMs: number, toMs: number) {
    const items: DydxHistoricalFunding[] = [];
    let before = toMs;
    for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
      const url = `${BASE}/historicalFunding/${encodeURIComponent(venueSymbol)}?limit=${HISTORY_PAGE_SIZE}&effectiveBeforeOrAt=${new Date(before).toISOString()}`;
      const body = await client.getJson<{ historicalFunding: DydxHistoricalFunding[] }>(url);
      const batch = body?.historicalFunding;
      if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected historicalFunding response`);
      items.push(...batch);
      // Newest first: step back past the oldest row until the window is covered.
      const oldest = Math.min(...batch.map((f) => Date.parse(f.effectiveAt)));
      if (batch.length < HISTORY_PAGE_SIZE || !Number.isFinite(oldest) || oldest <= fromMs) break;
      before = oldest - 1;
    }
    return parseDydxHistoricalFunding(items, venueSymbol, fromMs, toMs);
  },
};
