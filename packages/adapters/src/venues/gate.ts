import {
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  type LeverageTier,
} from "@ai-rates/core";
import { CircuitOpenError } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "gate";
const BASE_URL = "https://api.gateio.ws/api/v4/futures/usdt";
const HISTORY_PAGE = 1000;
const MAX_PAGES = 20;
const MINUTE_MS = 60_000;
/** `offset` on risk_limit_tiers counts contracts, not rows, and a page answers with 100 of them. */
const RISK_TIERS_PER_PAGE = 100;
/** ~981 contracts today, so ten pages; the cap is headroom, not an expectation. */
const RISK_TIERS_MAX_PAGES = 40;
const RISK_TIERS_RETRIES = 2;
const RISK_TIERS_BACKOFF_MS = 400;

export interface GateContract {
  name: string;
  /** Rate for the current interval, applied at `funding_next_apply`. */
  funding_rate: string;
  /** Seconds. */
  funding_interval: number;
  /** Epoch seconds. */
  funding_next_apply: number;
  mark_price: string;
  index_price: string;
  /** Base units per contract. */
  quanto_multiplier: string;
  /** Headline leverage; /risk_limit_tiers is the precise, size-aware source. */
  leverage_max?: string;
  in_delisting: boolean;
  status?: string;
  is_pre_market?: boolean;
}

export interface GateTicker {
  contract: string;
  volume_24h_quote: string;
  /** Open interest in contracts. */
  total_size: string;
}

export interface GateFundingHistoryItem {
  /** Epoch seconds; Gate stamps settlements a second or two after the hour. */
  t: number;
  r: string;
}

export function parseGateSnapshots(
  contracts: readonly GateContract[],
  tickers: readonly GateTicker[],
  now: number,
): SnapshotBatch {
  const tickerByContract = new Map(tickers.map((t) => [t.contract, t]));

  const snapshots: FundingSnapshot[] = [];
  for (const contract of contracts) {
    if (contract.in_delisting || contract.is_pre_market) continue;
    if (contract.status !== undefined && contract.status !== "trading") continue;
    const rate = num(contract.funding_rate);
    if (rate === null || !(contract.funding_interval > 0)) continue;

    const hours = contract.funding_interval / 3600;
    const markPrice = num(contract.mark_price);
    const ticker = tickerByContract.get(contract.name);
    snapshots.push({
      ...marketRef(VENUE_ID, contract.name),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: contract.funding_next_apply > 0 ? contract.funding_next_apply * 1000 : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(contract.index_price),
      openInterestUsd: ticker
        ? mul(num(ticker.total_size), num(contract.quanto_multiplier), markPrice)
        : null,
      volume24hUsd: ticker ? num(ticker.volume_24h_quote) : null,
      maxLeverage: num(contract.leverage_max),
    });
  }
  return { snapshots, settled: [] };
}

/** Settled funding events for one contract, oldest first, with timestamps snapped to the minute. */
export function parseGateFundingHistory(
  contract: string,
  items: readonly GateFundingHistoryItem[],
  fallbackHours: number,
): FundingEvent[] {
  const points = items
    .map((item) => ({
      settledAt: Math.round((item.t * 1000) / MINUTE_MS) * MINUTE_MS,
      rate: num(item.r),
    }))
    .filter((p): p is { settledAt: number; rate: number } => p.rate !== null && p.settledAt > 0)
    .sort((a, b) => a.settledAt - b.settledAt);

  const basisHours = inferIntervalHours(points.map((p) => p.settledAt)) ?? fallbackHours;
  return points.map((p) => ({
    ...marketRef(VENUE_ID, contract),
    settledAt: p.settledAt,
    rate: p.rate,
    basisHours,
    markPrice: null,
  }));
}

export interface GateRiskLimitTier {
  /** Only the bulk form of the endpoint carries this; the per-contract form omits it. */
  contract: string;
  tier: number;
  /** Cumulative upper bound of the band, in quote notional. */
  risk_limit: string;
  initial_rate: string;
  maintenance_rate: string;
  leverage_max: string;
}

/**
 * Gate's risk ladders, one per contract.
 *
 * `risk_limit` is a cumulative upper bound in quote notional — no contract conversion, unlike OKX
 * — so each band starts where the previous ended and the top band's bound is a real cap. This
 * parses the **bulk** response shape: asking per contract returns the same rows without the
 * `contract` field, which would leave every ladder unattributable.
 */
export function parseGateRiskLimitTiers(rows: readonly GateRiskLimitTier[]): LeverageTier[] {
  const byContract = new Map<string, GateRiskLimitTier[]>();
  for (const row of rows) {
    if (!row.contract) continue;
    const existing = byContract.get(row.contract);
    if (existing) existing.push(row);
    else byContract.set(row.contract, [row]);
  }

  const ladders: LeverageTier[] = [];
  for (const [contract, contractRows] of byContract) {
    const ladder: LeverageTier[] = [];
    let lowerNotionalUsd = 0;
    let usable = true;

    for (const row of [...contractRows].sort((a, b) => a.tier - b.tier)) {
      const upper = num(row.risk_limit);
      const imr = num(row.initial_rate);
      const maxLeverage = num(row.leverage_max);
      if (
        upper === null ||
        upper <= lowerNotionalUsd ||
        imr === null ||
        imr <= 0 ||
        maxLeverage === null ||
        maxLeverage <= 0
      ) {
        usable = false;
        break;
      }
      ladder.push({
        venueId: VENUE_ID,
        venueSymbol: contract,
        tier: row.tier,
        lowerNotionalUsd,
        upperNotionalUsd: upper,
        imr,
        mmr: num(row.maintenance_rate),
        maxLeverage,
      });
      lowerNotionalUsd = upper;
    }
    if (usable) ladders.push(...ladder);
  }
  return ladders;
}

export const gateAdapter: VenueAdapter = {
  venueId: VENUE_ID,
  minIntervalMs: 150,

  async fetchSnapshots(client, now) {
    const [contracts, tickers] = await Promise.all([
      client.getJson<GateContract[]>(`${BASE_URL}/contracts`),
      client.getJson<GateTicker[]>(`${BASE_URL}/tickers`),
    ]);
    return parseGateSnapshots(contracts, tickers, now);
  },

  /** Ten-ish pages for the whole venue, since `offset` advances by contract rather than by row. */
  async fetchLeverageTiers(client) {
    const rows: GateRiskLimitTier[] = [];
    let complete = true;

    for (let page = 0; page < RISK_TIERS_MAX_PAGES; page++) {
      const offset = page * RISK_TIERS_PER_PAGE;
      let fetched: GateRiskLimitTier[] | null = null;

      for (let attempt = 0; fetched === null && attempt <= RISK_TIERS_RETRIES; attempt++) {
        try {
          fetched = await client.getJson<GateRiskLimitTier[]>(
            `${BASE_URL}/risk_limit_tiers?limit=1000&offset=${offset}`,
          );
        } catch (error) {
          if (error instanceof CircuitOpenError) {
            return { tiers: parseGateRiskLimitTiers(rows), complete: false };
          }
          if (attempt < RISK_TIERS_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RISK_TIERS_BACKOFF_MS << attempt));
          }
        }
      }

      // A page given up on costs 100 contracts, so the sweep says so and nothing is pruned. Later
      // offsets are independent of this one, so the pass continues rather than stopping short.
      if (fetched === null) {
        complete = false;
        continue;
      }
      if (fetched.length === 0) break;
      rows.push(...fetched);
    }
    return { tiers: parseGateRiskLimitTiers(rows), complete };
  },

  async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
    const items: GateFundingHistoryItem[] = [];
    const from = Math.floor(fromMs / 1000);
    let to = Math.floor(toMs / 1000);
    for (let page = 0; page < MAX_PAGES && to >= from; page++) {
      const data = await client.getJson<GateFundingHistoryItem[]>(
        `${BASE_URL}/funding_rate?contract=${encodeURIComponent(venueSymbol)}&from=${from}&to=${to}&limit=${HISTORY_PAGE}`,
      );
      items.push(...data);
      if (data.length < HISTORY_PAGE) break;
      to = Math.min(...data.map((i) => i.t)) - 1;
    }

    let fallbackHours = 8;
    if (items.length < 2) {
      const contract = await client.getJson<GateContract>(
        `${BASE_URL}/contracts/${encodeURIComponent(venueSymbol)}`,
      );
      if (contract.funding_interval > 0) fallbackHours = contract.funding_interval / 3600;
    }
    const unique = [...new Map(items.map((i) => [i.t, i])).values()];
    return parseGateFundingHistory(venueSymbol, unique, fallbackHours);
  },
};
