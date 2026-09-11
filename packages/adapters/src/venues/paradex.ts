import type { FundingSnapshot } from "@ai-rates/core";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

export const PARADEX_API = "https://api.prod.paradex.trade/v1";

/** `/markets` is ~4 MB and changes rarely. */
const MARKETS_TTL_MS = 3_600_000;

export interface ParadexSummary {
  symbol: string;
  funding_rate?: string | null;
  mark_price?: string | null;
  underlying_price?: string | null;
  open_interest?: string | null;
  volume_24h?: string | null;
}

export interface ParadexMarket {
  symbol: string;
  asset_kind: string;
  funding_period_hours?: number | null;
  quote_currency?: string | null;
  settlement_currency?: string | null;
}

export interface ParadexResults<T> {
  results: T[];
}

/**
 * Normalizes the markets summary. Paradex accrues funding continuously (every second) rather than at
 * discrete settlements, so there is no interval or next funding time. The summary `funding_rate` is
 * the raw rate over the market's own `funding_period_hours` (8h for most perps; docs: "not a
 * normalized 8h funding rate") and already includes the market's funding multiplier.
 */
export function parseParadexSnapshots(
  summary: ParadexResults<ParadexSummary>,
  markets: ParadexResults<ParadexMarket>,
  now: number,
): FundingSnapshot[] {
  const perps = new Map(
    markets.results.filter((m) => m.asset_kind === "PERP").map((m) => [m.symbol, m]),
  );
  const snapshots: FundingSnapshot[] = [];

  for (const row of summary.results) {
    const market = perps.get(row.symbol);
    const rate = num(row.funding_rate);
    const basisHours = num(market?.funding_period_hours);
    if (
      !row.symbol.endsWith("-PERP") ||
      !market ||
      rate === null ||
      !basisHours ||
      basisHours <= 0
    ) {
      continue;
    }

    const markPrice = num(row.mark_price);
    snapshots.push({
      // Funding and PnL settle in the settlement currency (USDC), so that is the collateral quote.
      ...marketRef("paradex", row.symbol, {
        quote: market.settlement_currency ?? market.quote_currency ?? null,
      }),
      observedAt: now,
      rate,
      basisHours,
      intervalHours: null,
      nextFundingAt: null,
      kind: "predicted",
      markPrice,
      indexPrice: num(row.underlying_price),
      openInterestUsd: mul(num(row.open_interest), markPrice),
      volume24hUsd: num(row.volume_24h),
    });
  }
  return snapshots;
}

export function createParadexAdapter(): VenueAdapter {
  let markets: ParadexResults<ParadexMarket> | null = null;
  let marketsFetchedAt = 0;

  return {
    venueId: "paradex",
    minIntervalMs: 150,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      if (!markets || now - marketsFetchedAt >= MARKETS_TTL_MS) {
        markets = await client.getJson<ParadexResults<ParadexMarket>>(`${PARADEX_API}/markets`);
        marketsFetchedAt = now;
      }
      const summary = await client.getJson<ParadexResults<ParadexSummary>>(
        `${PARADEX_API}/markets/summary?market=ALL`,
      );
      return { snapshots: parseParadexSnapshots(summary, markets, now), settled: [] };
    },

    // No fetchFundingHistory: /v1/funding/data returns continuous accrual samples, not settlements.
  };
}

export const paradexAdapter: VenueAdapter = createParadexAdapter();
