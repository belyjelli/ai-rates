import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Bluefin Pro (Sui).
 *
 * REQUESTS: one per cycle, `GET /v1/exchange/tickers` (every market), plus `GET /v1/exchange/info`
 * once an hour for each market's `status`. The public API host allows 300 requests per minute per IP
 * (https://bluefin-exchange.readme.io/reference/rate-limits), 429 with Retry-After beyond it, so 250ms.
 *
 * FIXED POINT: "All numeric quantities are represented as string in e9 format" (tickers reference).
 * Every `...E9` field is divided by 1e9: BTC `markPriceE9` 76784500000000 is $76,784.50, and
 * `volume24hrE9` 2948000000 (2.948 BTC) x ~$76.8k matches `quoteVolume24hrE9` 226540583600000
 * ($226,540.58). All raw integers seen are below 2^53, so Number() is exact before the division.
 *
 * FUNDING: hourly, as a fraction, positive means longs pay. "Funding Rate = (TWA(P_market) /
 * TWA(P_index) - 1) / 24", an average of the last hour's 60 one-minute samples, with "an absolute value
 * hourly cap of 0.1%" (https://learn.bluefin.io/bluefin/bluefin-perps-exchange/trading/funding);
 * `maxFundingRateE9` is 1000000 (0.1%) on every market. The ticker carries two rates:
 * - `lastFundingRateE9`, the rate settled at the top of the last hour: BTC 12500 (0.0000125) equalled
 *   the 22:00 row of `/exchange/fundingRateHistory` and did not move between 22:28 and 22:38;
 * - `estimatedFundingRateE9`, the running estimate for the hour in progress: BTC 60249 at 22:27,
 *   55861 at 22:28, 30194 at 22:33, 14466 at 22:37, converging as minutes accumulate.
 * The estimate is what gets settled. Polled each minute to the hour, the 22:59:33 estimates against the
 * 23:00 settlements (ticker `lastFundingRateE9` at 23:00:30, and history rows at 23:00:00-23:00:02):
 * ETH 143739 against 142061, DEEP 428114 against 426068, GOLD 241585 against 238732, BTC 12500 against
 * 12500. The estimate restarts each hour (ETH read 12500 at 23:00:30 after 143739 at 22:59), so it is
 * noisiest in the first minutes: BTC read 60249 at 22:27 on its way to settling at 12500.
 * So the snapshot carries the estimate as `predicted`, due at `nextFundingTimeAtMillis`, and the last
 * rate rides along as a `settled` event at the top of the previous hour. Checked against Hyperliquid:
 * BTC's settled 0.0000125/h is 10.95% APR against 0.0000116/h (10.1%); 24x would read 263%.
 * `avgFundingRate8hrE9` is an average of settled hourly rates, not an 8-hour rate (BTC 12500 after eight
 * settlements of 12500), and is not collected.
 *
 * SETTLEMENT TIME: history rows are stamped a few ms past the hour (1789336800051 = 22:00:00.051), and
 * the ticker's settled event is derived as `nextFundingTimeAtMillis - 1h`, exactly on the hour. Both are
 * snapped to the hour so that the same settlement, seen from either source, is one row and not two.
 *
 * UNITS: `openInterestE9` is USD notional, not base units. Evidence: BTC 101969.816 as BTC would be
 * $7.8bn on a venue trading $0.23M a day, and ETH 15721 as ETH $39M; as USD, the eight markets sum to
 * $767k on 2026-09-13 against DefiLlama's "Bluefin Pro" open interest of $774,785 the same hour.
 * `quoteVolume24hrE9` is "volume in last 24hrs in USDC". `oraclePriceE9` is the spot index the funding
 * formula compares against, so it is `indexPrice`.
 *
 * TRADABILITY: `status` ACTIVE in exchange info. All 8 markets were ACTIVE on 2026-09-13; a market with
 * any other status, or missing from info, is not collected.
 *
 * CLASS: Bluefin declares none (exchange info has `baseAssetName` "Gold" for GOLD-PERP, and no category
 * anywhere), so all 8 are crypto. GOLD-PERP reaches base XAU through core's alias and stays crypto,
 * which keeps it out of the commodity XAU pool until Bluefin declares a class.
 *
 * QUOTE: USDC, the only margin asset in exchange info `assets` and the currency of `quoteVolume24hrE9`.
 *
 * BASE: `baseAssetSymbol` agreed with the parser on all 8 symbols (`BTC-PERP` -> BTC).
 */

const VENUE = "bluefin";
export const BLUEFIN_API = "https://api.sui-prod.bluefin.io/v1";
const HOUR_MS = 3_600_000;
const FUNDING_BASIS_HOURS = 1;
const QUOTE = "USDC";
const INFO_TTL_MS = HOUR_MS;
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 50;

export interface BluefinMarketInfo {
  symbol: string;
  status: string;
  baseAssetSymbol?: string;
}

export interface BluefinExchangeInfo {
  markets: BluefinMarketInfo[];
}

export interface BluefinTicker {
  symbol: string;
  lastFundingRateE9?: string | null;
  estimatedFundingRateE9?: string | null;
  nextFundingTimeAtMillis?: number | null;
  markPriceE9?: string | null;
  oraclePriceE9?: string | null;
  /** USD notional, e9. */
  openInterestE9?: string | null;
  quoteVolume24hrE9?: string | null;
}

export interface BluefinFundingRow {
  symbol: string;
  fundingRateE9: string;
  fundingTimeAtMillis: number;
}

/** An e9 fixed-point string as a number, or null. */
export function e9(value: string | number | null | undefined): number | null {
  const raw = num(value);
  return raw === null ? null : raw / 1e9;
}

function hourFloor(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

function ref(symbol: string) {
  // Bluefin declares no asset class: crypto.
  return marketRef(VENUE, symbol, { quote: QUOTE });
}

export function parseBluefinTickers(
  tickers: readonly BluefinTicker[],
  info: readonly BluefinMarketInfo[],
  now: number,
): SnapshotBatch {
  const active = new Set(info.filter((m) => m.status === "ACTIVE").map((m) => m.symbol));
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];
  for (const ticker of tickers) {
    const rate = e9(ticker.estimatedFundingRateE9);
    if (!active.has(ticker.symbol) || rate === null) continue;

    const base = ref(ticker.symbol);
    const next = num(ticker.nextFundingTimeAtMillis);
    const nextFundingAt = next !== null && next > 0 ? next : null;
    snapshots.push({
      ...base,
      observedAt: now,
      rate,
      basisHours: FUNDING_BASIS_HOURS,
      intervalHours: 1,
      nextFundingAt,
      kind: "predicted",
      markPrice: e9(ticker.markPriceE9),
      indexPrice: e9(ticker.oraclePriceE9),
      openInterestUsd: e9(ticker.openInterestE9),
      volume24hUsd: e9(ticker.quoteVolume24hrE9),
    });

    const last = e9(ticker.lastFundingRateE9);
    if (last !== null && nextFundingAt !== null) {
      settled.push({
        ...base,
        settledAt: hourFloor(nextFundingAt - HOUR_MS),
        rate: last,
        basisHours: FUNDING_BASIS_HOURS,
        markPrice: null,
      });
    }
  }
  return { snapshots, settled };
}

/** Hourly settlements within [fromMs, toMs], oldest first, snapped to the hour. */
export function parseBluefinFundingHistory(
  rows: readonly BluefinFundingRow[],
  symbol: string,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(symbol);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const at = num(row.fundingTimeAtMillis);
    const rate = e9(row.fundingRateE9);
    if (at === null || rate === null) continue;
    const settledAt = hourFloor(at);
    if (settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate,
      basisHours: FUNDING_BASIS_HOURS,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export function createBluefinAdapter(): VenueAdapter {
  let info: BluefinMarketInfo[] | null = null;
  let infoFetchedAt = 0;

  return {
    venueId: VENUE,
    minIntervalMs: 250,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      if (!info || now - infoFetchedAt >= INFO_TTL_MS) {
        const body = await client.getJson<BluefinExchangeInfo>(`${BLUEFIN_API}/exchange/info`);
        if (!Array.isArray(body?.markets)) throw new Error(`${VENUE}: unexpected exchange/info`);
        info = body.markets;
        infoFetchedAt = now;
      }
      const tickers = await client.getJson<BluefinTicker[]>(`${BLUEFIN_API}/exchange/tickers`);
      if (!Array.isArray(tickers)) throw new Error(`${VENUE}: unexpected exchange/tickers`);
      return parseBluefinTickers(tickers, info, now);
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const rows: BluefinFundingRow[] = [];
      // startTimeAtMillis is exclusive, endTimeAtMillis inclusive; rows come newest first. The
      // window is widened by an hour at the start so a row stamped just past the hour is not lost.
      const start = Math.max(0, fromMs - HOUR_MS);
      for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
        const url = `${BLUEFIN_API}/exchange/fundingRateHistory?symbol=${encodeURIComponent(venueSymbol)}&startTimeAtMillis=${start}&endTimeAtMillis=${toMs + HOUR_MS}&limit=${HISTORY_PAGE_SIZE}&page=${page}`;
        const batch = await client.getJson<BluefinFundingRow[]>(url);
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected fundingRateHistory`);
        rows.push(...batch);
        if (batch.length < HISTORY_PAGE_SIZE) break;
      }
      return parseBluefinFundingHistory(rows, venueSymbol, fromMs, toMs);
    },
  };
}

export const bluefinAdapter: VenueAdapter = createBluefinAdapter();
