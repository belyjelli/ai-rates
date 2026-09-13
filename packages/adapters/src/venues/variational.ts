import { canonicalBase, type FundingSnapshot, parseVenueSymbol } from "@ai-rates/core";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Variational Omni.
 *
 * REQUESTS: one per cycle, `GET /metadata/stats`, which carries every listing. The API allows 10
 * requests per 10s per IP (https://docs.variational.io/technical-documentation/api), so 1s spacing.
 * There is no funding history endpoint.
 *
 * RFQ: Omni has no order book; every trade is quoted by its single maker, OLP. The stats still publish
 * one funding rate, interval, mark and open interest PER LISTING, so this is a per-market rate like any
 * other venue's, and the adapter can be built honestly. The RFQ quotes ($1k/$100k/$1m) have no resting
 * size, so they are not mapped to `bestBid`/`bestAsk`.
 *
 * FUNDING: `funding_rate` is an ANNUALISED fraction ("decimal; multiply by 100 for percentage"), not
 * the rate per `funding_interval_s`. The docs never say "annual", so this was established from values:
 * - Crypto perps default to 0.1095, and the docs fix the interest component at 0.00125% per hour:
 *   0.0000125 x 8760 = 0.1095 exactly (286 listings read 0.1095 on 2026-09-14).
 * - Pre-IPO funding "is fixed at 0.005% every 8 hours"; OPENAI and ANTHROPIC read 0.05475, which is
 *   0.00005 x 1095 intervals a year.
 * - STORJ read -85.54 on a 1h interval. Per interval that is -8,554% an hour; annualised it is -0.98%
 *   an hour, inside the documented 2%/h cap.
 * - BTC read 0.0912 (9.1% APR) against Extended's 11.4% and Arcus's 10.95% the same afternoon.
 * So the stored rate is `funding_rate x intervalHours / 8760` over `intervalHours`: the per-payment
 * rate, like every other adapter's. Positive means longs pay (docs, Funding Rates). The interval is
 * per market, copied from Bybit or Binance where the asset lists there, else 1h: on 2026-09-14, 304 at
 * 4h, 238 at 8h, 5 at 1h. No next funding time is published. The rate is "current", so `predicted`.
 *
 * SWAPS are skipped: the 6 `funding_interval_s` 0 listings (XAUS, XAGS, USOILP, UKOILP, US500S,
 * US100S, all named "Swap on ..."). Swaps "accrue funding once per day" at the 17:00 ET close, with
 * "long and short rates published separately and generally asymmetric" -- and neither is in the stats,
 * which read 0 for all six. There is no rate here to store.
 *
 * UNITS: "prices and volumes are denominated in USDC", and the per-listing open interest is quoted
 * per side. OI is long + short: every position faces OLP, so each user long and each user short is a
 * separate open contract, the order-book meaning of open interest. (The top-level `open_interest`,
 * $1.61B, is exactly twice the listings' long + short sum of $806M, i.e. it counts OLP's side too.)
 * Checked live: BTC $79.5M long + $70.1M short = $149.5M, against Extended's $44.8M; ETH long is
 * $96.3M, 38.4k ETH at mark.
 *
 * TRADABILITY: the stats have no status field, and `num_markets` equals the listing count (553).
 * Every listing had a quote under 20 minutes old. All 547 non-swap listings are kept.
 *
 * ASSET CLASS: Variational declares none. A listing has only `ticker` and a prose `name`, and the
 * docs' TradFi page lists underlyings for 11 special symbols, not a class for every market. So every
 * listing is crypto, which WILL mislabel tradfi here: TSLA "Tesla, Inc.", XAU "Gold", and CAT
 * "Caterpillar Inc." at $817.81, which as crypto:CAT shares a base with the CAT memecoin on other
 * venues. Migration 016's mark gate is what keeps those apart until Variational declares a class.
 *
 * QUOTE: USDC, the "Settlement Asset" for both perpetuals and swaps
 * (the Swaps comparison table in https://docs.variational.io/llms-full.txt).
 *
 * BASE: `ticker` is the declared base. The parser agreed on 551 of 553 (the `1000`/`1000000` prefixes
 * are its multiplier, not a disagreement); it cut `OPN_OPINION` to OPN and `RE_ETH` to RE, so those two
 * pass the ticker as declared.
 */

const VENUE = "variational";
export const VARIATIONAL_API = "https://omni-client-api.prod.ap-northeast-1.variational.io";
const QUOTE = "USDC";
const HOURS_PER_YEAR = 8760;

export interface VariationalListing {
  ticker: string;
  name?: string;
  mark_price?: string;
  /** USDC. */
  volume_24h?: string;
  /** USDC notional per side. */
  open_interest?: { long_open_interest?: string; short_open_interest?: string };
  /** Annualised fraction. */
  funding_rate?: string;
  /** 0 for swaps, which have no perp funding. */
  funding_interval_s?: number;
}

export interface VariationalStats {
  num_markets?: number;
  listings: VariationalListing[];
}

/** The ticker to pass as base where the parser reads it differently, else null. */
export function variationalDeclaredBase(ticker: string): string | null {
  const parsed = parseVenueSymbol(ticker);
  if (parsed.multiplier !== 1 || parsed.base === canonicalBase(ticker)) return null;
  return ticker;
}

/** An annualised `funding_rate` as the rate for one payment of `intervalHours`. */
export function variationalIntervalRate(annualised: number, intervalHours: number): number {
  return (annualised * intervalHours) / HOURS_PER_YEAR;
}

export function parseVariationalStats(body: VariationalStats, now: number): FundingSnapshot[] {
  const snapshots: FundingSnapshot[] = [];
  for (const listing of body.listings) {
    const annualised = num(listing.funding_rate);
    const intervalSeconds = num(listing.funding_interval_s);
    if (annualised === null || intervalSeconds === null || intervalSeconds <= 0) continue;

    const intervalHours = intervalSeconds / 3600;
    const long = num(listing.open_interest?.long_open_interest);
    const short = num(listing.open_interest?.short_open_interest);
    const declared = variationalDeclaredBase(listing.ticker);
    snapshots.push({
      ...marketRef(VENUE, listing.ticker, {
        quote: QUOTE,
        ...(declared ? { base: declared } : {}),
      }),
      observedAt: now,
      rate: variationalIntervalRate(annualised, intervalHours),
      basisHours: intervalHours,
      intervalHours,
      nextFundingAt: null,
      kind: "predicted",
      markPrice: num(listing.mark_price),
      indexPrice: null,
      openInterestUsd: long !== null && short !== null ? long + short : null,
      volume24hUsd: num(listing.volume_24h),
    });
  }
  return snapshots;
}

export function createVariationalAdapter(): VenueAdapter {
  return {
    venueId: VENUE,
    minIntervalMs: 1000,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const body = await client.getJson<VariationalStats>(`${VARIATIONAL_API}/metadata/stats`);
      if (!Array.isArray(body?.listings))
        throw new Error(`${VENUE}: unexpected metadata/stats response`);
      return { snapshots: parseVariationalStats(body, now), settled: [] };
    },

    // No fetchFundingHistory: Variational publishes no funding history.
  };
}

export const variationalAdapter: VenueAdapter = createVariationalAdapter();
