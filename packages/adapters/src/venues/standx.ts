import type { AssetClass, FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE = "standx";
export const STANDX_API = "https://perps.standx.com/api";
const HOUR_MS = 3_600_000;
/** Funding settles every hour and `funding_rate` is a 1-hour rate; see the header below. */
const FUNDING_HOURS = 1;
/** `query_symbol_info` changes on listings and parameter edits only. */
const SYMBOL_INFO_TTL_MS = HOUR_MS;
/**
 * History is requested in windows of this size. One call answered 960 hourly rows for 40 days, so a
 * 30-day window (720 rows) stays inside anything the endpoint has been seen to return.
 */
const HISTORY_WINDOW_MS = 30 * 24 * HOUR_MS;

export interface StandxOverviewSymbol {
  symbol: string;
  base?: string | null;
  quote?: string | null;
  funding_rate?: string | null;
  mark_price?: string | null;
  /** Base units. */
  open_interest?: string | null;
  /** open_interest x mark, in the quote (DUSD). */
  open_interest_notional?: string | null;
  /** 24h volume in the quote (DUSD). */
  volume_quote_24h?: string | null;
}

export interface StandxOverview {
  symbols: StandxOverviewSymbol[];
}

export interface StandxSymbolInfo {
  symbol: string;
  base_asset?: string | null;
  quote_asset?: string | null;
  status: string;
  max_leverage?: string | null;
}

export interface StandxFundingRate {
  symbol: string;
  funding_rate: string;
  mark_price?: string | null;
  /** ISO-8601 settlement time, on the hour. */
  time: string;
}

/**
 * The class StandX declares for each market.
 *
 * WHY A TABLE, when class is meant to be declared: the API declares nothing (`query_symbol_info` and
 * `query_market_overview` carry no category). The venue's own web app does: its bundle at
 * https://standx.com/perps ships `SymbolAssetTag`, which labels each market Crypto, Commodities or
 * Stocks for the "All Assets / Crypto / Stocks / Commodities" filter, beside a `SymbolKind` that
 * calls the same six non-crypto markets "TradFi Perpetual". This is that map, copied on 2026-09-14,
 * covering all 13 listed markets: Crypto 7, Commodities 3, Stocks 3.
 *
 * A market missing from it is crypto — the venue has declared nothing about it — until it is added,
 * the same direction dYdX's list takes.
 */
export const STANDX_ASSET_TAGS: Readonly<Record<string, "Crypto" | "Commodities" | "Stocks">> = {
  "BTC-USD": "Crypto",
  "ETH-USD": "Crypto",
  "HYPE-USD": "Crypto",
  "BNB-USD": "Crypto",
  "SOL-USD": "Crypto",
  "ZEC-USD": "Crypto",
  "UNI-USD": "Crypto",
  "XAU-USD": "Commodities",
  "XAG-USD": "Commodities",
  "CL-USD": "Commodities",
  "TSLA-USD": "Stocks",
  "MU-USD": "Stocks",
  "SPCX-USD": "Stocks",
};

export function standxAssetClass(symbol: string): AssetClass {
  switch (STANDX_ASSET_TAGS[symbol]) {
    case "Commodities":
      return "commodity";
    case "Stocks":
      return "equity";
    default:
      return "crypto";
  }
}

function standxRef(symbol: string, quote: string | null | undefined) {
  // The declared `base` matched the parsed symbol on all 13 markets, so the parser is used.
  return marketRef(VENUE, symbol, {
    // Margin, PnL and funding are DUSD, StandX's own dollar; kept as the venue spells it.
    quote: quote ?? null,
    assetClass: standxAssetClass(symbol),
  });
}

/** Status `trading` in `query_symbol_info`; a market absent from it is not collected. */
export function standxTradable(info: readonly StandxSymbolInfo[]): Map<string, StandxSymbolInfo> {
  return new Map(info.filter((s) => s.status === "trading").map((s) => [s.symbol, s]));
}

export function parseStandxSnapshots(
  overview: StandxOverview,
  tradable: ReadonlyMap<string, StandxSymbolInfo>,
  now: number,
): FundingSnapshot[] {
  // Every market settles on the UTC hour (see the header); the overview omits the time itself.
  const nextFundingAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const snapshots: FundingSnapshot[] = [];
  for (const row of overview.symbols) {
    const info = tradable.get(row.symbol);
    const rate = num(row.funding_rate);
    if (!info || rate === null) continue;
    const maxLeverage = num(info.max_leverage);
    snapshots.push({
      ...standxRef(row.symbol, info.quote_asset ?? row.quote),
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt,
      kind: "predicted",
      markPrice: num(row.mark_price),
      // Only the per-symbol `query_symbol_price` carries an index price.
      indexPrice: null,
      // Already notional: BTC 384.2412 x 76,938.01 = 29,562,754 against 29,562,753.29 reported.
      openInterestUsd: num(row.open_interest_notional),
      // Quote volume: BTC 3,423.82 base at ~77,000 = 263.6M against 264.0M reported.
      volume24hUsd: num(row.volume_quote_24h),
      ...(maxLeverage !== null ? { maxLeverage } : {}),
    });
  }
  return snapshots;
}

/** Settled hourly rates within [fromMs, toMs], oldest first. */
export function parseStandxFundingHistory(
  rows: readonly StandxFundingRate[],
  venueSymbol: string,
  quote: string | null,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const ref = standxRef(venueSymbol, quote);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = Date.parse(row.time);
    const rate = num(row.funding_rate);
    if (row.symbol !== venueSymbol || !Number.isFinite(settledAt) || rate === null) continue;
    if (settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...ref,
      settledAt,
      rate,
      basisHours: FUNDING_HOURS,
      markPrice: num(row.mark_price),
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

/**
 * StandX perps, measured from this machine on 2026-09-14 and read against
 * https://docs.standx.com (standx-api/perps-http, standx-api/rate-limits, the funding-rate page).
 *
 * - **One call a cycle**, plus `query_symbol_info` hourly. `query_market_overview` answers all 13
 *   markets with funding, mark, notional OI and quote volume.
 * - **The interval is one hour, established three ways.** (1) `query_funding_rates` returned 960 rows
 *   for 40 days of BTC-USD, every one exactly 1h after the last, on the hour; XAU-USD the same over
 *   3 days. (2) `query_symbol_market` gives `next_funding_time` "2026-09-13T23:00:00Z" at 22:13.
 *   (3) The docs: interest is "settled on an hourly basis ... 0.00125% per hour (equivalent to 0.01%
 *   per 8-hour funding period)", and `funding_interest_rate` is 0.0000125 on six markets.
 * - **The rate is a 1-hour rate.** Quiet markets (SOL, HYPE, ZEC, UNI) print 0.00001250, the
 *   documented hourly interest. Against Hyperliquid's hourly rates at 22:13 UTC: BTC 0.00000838 vs
 *   0.0000107, ETH 0.00000428 vs 0.0000125, HYPE 0.0000125 vs 0.0000125 — same scale, not 8x or 24x.
 * - **Predicted, not settled.** Docs call `funding_rate` the "current funding rate", and it moves
 *   inside the hour: BTC read 0.00000838 at 22:12, 0.00000862 at 22:13 and 0.00000696 at 22:19, while
 *   the settled 22:00 row was 0.00000873. It is the running estimate for the next hour.
 * - **Tradable**: status `trading` — all 13 on 2026-09-14.
 * - **Class** from the web app's declaration; see `STANDX_ASSET_TAGS`. **Quote** `quote_asset` DUSD.
 * - **History**: `query_funding_rates?symbol=&start_time=&end_time=`, both required, in milliseconds
 *   (an ISO time is rejected, seconds return nothing).
 * - **Rate limit**: 50 requests/s per IP; 100 ms spacing is far inside it.
 */
export function createStandxAdapter(): VenueAdapter {
  let symbolInfo: { fetchedAt: number; tradable: Map<string, StandxSymbolInfo> } | null = null;

  async function loadSymbolInfo(client: HttpClient, now: number) {
    if (!symbolInfo || now - symbolInfo.fetchedAt >= SYMBOL_INFO_TTL_MS) {
      const info = await client.getJson<StandxSymbolInfo[]>(`${STANDX_API}/query_symbol_info`);
      if (!Array.isArray(info)) throw new Error(`${VENUE}: unexpected query_symbol_info response`);
      symbolInfo = { fetchedAt: now, tradable: standxTradable(info) };
    }
    return symbolInfo.tradable;
  }

  return {
    venueId: VENUE,
    minIntervalMs: 100,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const tradable = await loadSymbolInfo(client, now);
      const overview = await client.getJson<StandxOverview>(`${STANDX_API}/query_market_overview`);
      if (!Array.isArray(overview?.symbols)) {
        throw new Error(`${VENUE}: unexpected query_market_overview response`);
      }
      return { snapshots: parseStandxSnapshots(overview, tradable, now), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      // The quote only needs some copy of the symbol list, however old: DUSD on every market.
      const tradable = symbolInfo?.tradable ?? (await loadSymbolInfo(client, Date.now()));
      const quote = tradable.get(venueSymbol)?.quote_asset ?? null;
      const rows: StandxFundingRate[] = [];
      for (let start = fromMs; start <= toMs; start += HISTORY_WINDOW_MS) {
        const end = Math.min(toMs, start + HISTORY_WINDOW_MS - 1);
        const params = new URLSearchParams({
          symbol: venueSymbol,
          start_time: String(start),
          end_time: String(end),
        });
        const batch = await client.getJson<StandxFundingRate[]>(
          `${STANDX_API}/query_funding_rates?${params}`,
        );
        if (!Array.isArray(batch))
          throw new Error(`${VENUE}: unexpected query_funding_rates response`);
        rows.push(...batch);
      }
      return parseStandxFundingHistory(rows, venueSymbol, quote, fromMs, toMs);
    },
  };
}

export const standxAdapter: VenueAdapter = createStandxAdapter();
