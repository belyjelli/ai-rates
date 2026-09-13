import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { marketRef, num, selectRefreshBatch } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Phoenix perpetuals (Ellipsis Labs, Solana), public REST at https://perp-api.phoenix.trade.
 *
 * Measured from this machine on 2026-09-13 22:29–23:01 UTC, against the OpenAPI document at
 * https://docs.phoenix.trade/openapi/phoenix-public-api.json and https://docs.phoenix.trade/llms-full.txt.
 *
 * WHAT IS COLLECTABLE OVER REST. `/v1/view/exchange/markets` (174 KB, 82 markets) lists markets with
 * open interest but no rate and no price. There is no bulk ticker: mark price, candles and stats are
 * per symbol, and live marks are otherwise WebSocket-only. Funding comes from
 * `/v1/funding/overview`, which serves every market's hourly series in one call: the full default
 * week is 1.7 MB, but `startTime`/`endTime` (milliseconds; seconds return an empty series) with
 * `perMarketLimit=1` return only the newest point per market, 14 KB.
 *
 * REQUESTS per cycle: markets + overview, then up to `VOLUME_REFRESH_BUDGET` hourly-candle calls
 * (5.7 KB each) for 24h volume, rotated so each market's volume is at most ~15 minutes old. No limit
 * is published ("authenticated sessions receive higher API limits"; back off on 429). Twelve calls a
 * second apart to one route never limited; five back-to-back calls returned `{"error":"rate_limited"}`
 * on two of them. So requests are spaced 1s, and an `error` body is treated as a failure.
 *
 * FUNDING — what a point is. Each overview point is one hourly accrual, stamped at or just after the
 * hour. Polled every minute from 22:34 to 23:00: the newest point stayed 22:00:01 (BTC 0.42 at
 * 77,334) through 22:59:25, and at 23:00:26 a 23:00:00 point (BTC 0.46 at 76,736) had replaced it. It
 * is therefore the SETTLED rate for the hour just ended, never an estimate: snapshots are
 * `kind: "settled"`, and the same point is also returned as a settled event. Nothing on REST carries
 * the current hour: `statsSnapshot.cumulativeFundingRate` did not move for the whole hour, then stepped
 * at 23:00 by +46 on BTC (100x the 0.46 payment, i.e. cents per unit), so it repeats the overview.
 *
 * FUNDING — the scale. `rate = fundingAmountPerUnit / markPrice`, a fraction per hour:
 * - the schema defines `fundingAmountPerUnit` as "funding amount per base unit in quote units" and
 *   `markPrice` as "quote units per base unit", so their ratio is the hour's fraction of notional;
 * - the independent `/v1/funding/{symbol}/rates` history reports `fundingRatePercentage` equal to
 *   100x that ratio on every market checked (BTC 0.42 / 77,334 = 5.43e-6, rates 0.000543%; AAPL,
 *   ADA and SPY the same);
 * - `fundingRate` on the overview is NOT usable, whatever its schema says ("rate for the interval as
 *   a decimal"): it is 1e4x the ratio on BTC, ETH, GOLD and AAVE (tick size 100) and 100x on AAPL, ADA
 *   and SPY (tick size 10). Read as a decimal, BTC would pay 5.4% an hour.
 * Cross-check with Hyperliquid at 22:39 UTC: BTC 5.43e-6/h here vs 1.25e-5/h, ETH 1.83e-5/h vs
 * 1.25e-5/h. A per-24h reading (x24) or a percent reading (x100) would be two orders of magnitude off.
 *
 * FUNDING — the interval. `fundingIntervalSeconds` is 3600 on all 82 markets; `fundingPeriodSeconds`
 * (86400, or 28800 on seven) is the horizon the premium is spread over, which is why the catalog calls
 * the rate "quoted per 24h". The accrual itself is hourly, so basis and interval are 1h. The docs say
 * accrued funding "settles every 24 hours" into collateral; that is cash movement, not the rate period,
 * and it counts against account health from the hour it accrues. Positive means longs pay ("when mark
 * price > index price: longs pay shorts"). Payments are quantised to the quote tick, so thin-priced
 * markets move in steps (ADA 0.000004 per unit is 1.9e-5/h).
 *
 * PRICES. `markPrice` is the overview point's mark at the settlement, at most about an hour old. No
 * index price is published outside per-symbol calls.
 *
 * UNITS. `openInterestBaseLots` / 10^`baseLotsDecimals` is base units (BTC 29.89, against
 * `/v1/market/BTC/stats` open_interest 30.40 half an hour earlier), times mark for USD. `baseLotsDecimals`
 * can be negative (PUMP -2). Volume is the sum of `volumeQuote` (USDC) over the last 24 closed hourly
 * candles; the current hour is never included in the candle response.
 *
 * CLASS. `commodityMetadata.isCommodity` is Phoenix's real-world flag (43 of 82), and the market's
 * trading calendar says which kind: `us_equities_extended` (39, SPY and QQQ among them) or
 * `cme_commodities` (GOLD, SILVER, COPPER, WTIOIL). Markets without the flag are crypto (39).
 *
 * QUOTE. USDC: "Phoenix perps are currently margined in USDC. Deposits, withdrawals, margin checks,
 * PnL, and funding all resolve against the account's USDC collateral balance."
 *
 * BASE. Symbols are bare tickers and parse as themselves on all 82; GOLD and SILVER reach XAU and XAG
 * through the core alias table.
 *
 * HISTORY. `/v1/funding/{symbol}/rates`, oldest first, `limit` up to 10,000 and a range of at most a
 * year. It carries only the percentage, rounded to six decimals (1e-8 as a fraction).
 */

const VENUE = "phoenix";
export const PHOENIX_API = "https://perp-api.phoenix.trade/v1";
const QUOTE = "USDC";
const HOUR_MS = 3_600_000;
/** How far back to look for each market's newest settled point; older means Phoenix stopped publishing. */
export const OVERVIEW_LOOKBACK_MS = 2 * HOUR_MS;
export const VOLUME_REFRESH_BUDGET = 8;
export const VOLUME_MAX_AGE_MS = 15 * 60_000;
const CANDLE_HOURS = 24;
const HISTORY_PAGE_LIMIT = 10_000;
/** Under the one-year maximum range, and under 10,000 hourly points. */
const HISTORY_WINDOW_MS = 300 * 24 * HOUR_MS;

export interface PhoenixMarket {
  symbol: string;
  marketStatus: string;
  commodityMetadata?: { isCommodity?: boolean } | null;
  metadata?: { calendar?: { id?: string | null } | null } | null;
  baseLotsDecimals: number;
  fundingIntervalSeconds?: number;
  leverageTiers?: { maxLeverage?: number }[];
  statsSnapshot?: {
    openInterestBaseLots?: string;
    /** Unix seconds. */
    fundingStartIntervalTimestamp?: string;
  } | null;
}

export interface PhoenixOverviewPoint {
  /** Unix seconds (the schema says an ISO date-time; the live API sends seconds). */
  timestamp: number | string;
  fundingAmountPerUnit: string;
  markPrice: string;
  /** Inconsistently scaled across markets; never read. */
  fundingRate?: string;
}

export interface PhoenixOverviewSeries {
  marketId: number;
  symbol: string;
  points: PhoenixOverviewPoint[];
}

export interface PhoenixCandle {
  /** Epoch ms of the candle open. */
  time: number;
  /** USDC traded in the candle. */
  volumeQuote?: number | null;
}

export interface PhoenixRatePoint {
  timestamp: number | string;
  /** Percent of notional for the hour. */
  fundingRatePercentage: string;
}

export interface PhoenixVolumeEntry {
  volumeUsd: number | null;
  fetchedAt: number;
}

/** Epoch ms from a Phoenix timestamp: unix seconds as a number or numeric string, or an ISO date-time. */
export function phoenixTimeMs(value: number | string | null | undefined): number | null {
  const n = num(value);
  if (n !== null) return n > 0 ? n * 1000 : null;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The class Phoenix declares: its real-world flag, then the market's trading calendar. */
export function phoenixAssetClass(market: PhoenixMarket, base: string): AssetClass {
  if (market.commodityMetadata?.isCommodity !== true) return "crypto";
  const calendar = market.metadata?.calendar?.id ?? "";
  if (calendar.startsWith("us_equities")) return "equity";
  if (calendar.includes("commodit")) return "commodity";
  return classifyNonCrypto(base);
}

function phoenixRef(market: PhoenixMarket) {
  const parsed = marketRef(VENUE, market.symbol);
  return marketRef(VENUE, market.symbol, {
    quote: QUOTE,
    assetClass: phoenixAssetClass(market, parsed.base),
  });
}

function intervalHours(market: PhoenixMarket): number {
  const seconds = num(market.fundingIntervalSeconds);
  return seconds !== null && seconds > 0 ? seconds / 3600 : 1;
}

/** Hourly fraction from one overview point, or null when the mark is missing. */
export function phoenixPointRate(point: PhoenixOverviewPoint): number | null {
  const amount = num(point.fundingAmountPerUnit);
  const mark = num(point.markPrice);
  return amount === null || mark === null || mark <= 0 ? null : amount / mark;
}

/** USDC volume of the 24 closed hours before the hour containing `now`. */
export function phoenixVolume24h(candles: readonly PhoenixCandle[], now: number): number | null {
  const hourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const from = hourStart - CANDLE_HOURS * HOUR_MS;
  let total = 0;
  for (const candle of candles) {
    const volume = num(candle.volumeQuote);
    if (candle.time >= from && candle.time < hourStart && volume !== null) total += volume;
  }
  return total;
}

export function isPhoenixTradable(market: PhoenixMarket): boolean {
  return market.marketStatus === "active";
}

export function parsePhoenixSnapshots(
  markets: readonly PhoenixMarket[],
  series: readonly PhoenixOverviewSeries[],
  volumes: ReadonlyMap<string, PhoenixVolumeEntry>,
  now: number,
): SnapshotBatch {
  const latest = new Map<string, PhoenixOverviewPoint>();
  for (const s of series) {
    for (const point of s.points ?? []) {
      const at = phoenixTimeMs(point.timestamp);
      const current = latest.get(s.symbol);
      if (at !== null && (!current || at > (phoenixTimeMs(current.timestamp) ?? 0))) {
        latest.set(s.symbol, point);
      }
    }
  }

  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];
  for (const market of markets) {
    const point = latest.get(market.symbol);
    const settledAt = phoenixTimeMs(point?.timestamp);
    const rate = point ? phoenixPointRate(point) : null;
    if (!isPhoenixTradable(market) || !point || settledAt === null || rate === null) continue;

    const ref = phoenixRef(market);
    const hours = intervalHours(market);
    const markPrice = num(point.markPrice);
    const lots = num(market.statsSnapshot?.openInterestBaseLots);
    const openInterest = lots === null ? null : lots / 10 ** market.baseLotsDecimals;
    const intervalStart = phoenixTimeMs(market.statsSnapshot?.fundingStartIntervalTimestamp);
    const maxLeverage = num(market.leverageTiers?.[0]?.maxLeverage);

    snapshots.push({
      ...ref,
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: intervalStart === null ? null : intervalStart + hours * HOUR_MS,
      kind: "settled",
      markPrice,
      indexPrice: null,
      openInterestUsd:
        openInterest !== null && markPrice !== null ? openInterest * markPrice : null,
      volume24hUsd: volumes.get(market.symbol)?.volumeUsd ?? null,
      maxLeverage: maxLeverage !== null && maxLeverage > 0 ? maxLeverage : null,
    });
    settled.push({ ...ref, settledAt, rate, basisHours: hours, markPrice });
  }
  return { snapshots, settled };
}

/** Settled hourly rates within [fromMs, toMs], oldest first. */
export function parsePhoenixRates(
  market: PhoenixMarket,
  rows: readonly PhoenixRatePoint[],
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const ref = phoenixRef(market);
  const hours = intervalHours(market);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = phoenixTimeMs(row.timestamp);
    const percent = num(row.fundingRatePercentage);
    if (settledAt === null || percent === null || settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...ref,
      settledAt,
      rate: percent / 100,
      basisHours: hours,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

/** Phoenix answers a throttled call with `{"error":"rate_limited"}`; never parse that as data. */
function checkBody<T>(body: T, what: string): T {
  const error = (body as { error?: unknown } | null)?.error;
  if (body === null || body === undefined || typeof error === "string") {
    throw new Error(`${VENUE} ${what}: ${typeof error === "string" ? error : "empty response"}`);
  }
  return body;
}

export interface PhoenixAdapterOptions {
  volumeRefreshBudget?: number;
}

export function createPhoenixAdapter(options: PhoenixAdapterOptions = {}): VenueAdapter {
  const budget = options.volumeRefreshBudget ?? VOLUME_REFRESH_BUDGET;
  const volumes = new Map<string, PhoenixVolumeEntry>();
  /** History carries no class or interval, so both are remembered from the markets call. */
  const known = new Map<string, PhoenixMarket>();

  return {
    venueId: VENUE,
    minIntervalMs: 1000,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const markets = checkBody(
        await client.getJson<PhoenixMarket[]>(`${PHOENIX_API}/view/exchange/markets`),
        "markets",
      );
      if (!Array.isArray(markets)) throw new Error(`${VENUE}: unexpected markets response`);
      const overview = checkBody(
        await client.getJson<{ series: PhoenixOverviewSeries[] }>(
          `${PHOENIX_API}/funding/overview?startTime=${now - OVERVIEW_LOOKBACK_MS}&endTime=${now}&perMarketLimit=1`,
        ),
        "funding overview",
      );
      if (!Array.isArray(overview.series))
        throw new Error(`${VENUE}: unexpected overview response`);

      const live = markets.filter(isPhoenixTradable);
      for (const market of markets) known.set(market.symbol, market);
      const liveSymbols = new Set(live.map((m) => m.symbol));
      for (const symbol of volumes.keys()) {
        if (!liveSymbols.has(symbol)) volumes.delete(symbol);
      }

      for (const symbol of selectRefreshBatch(
        [...liveSymbols],
        volumes,
        now,
        budget,
        VOLUME_MAX_AGE_MS,
      )) {
        try {
          const candles = checkBody(
            await client.getJson<PhoenixCandle[]>(
              `${PHOENIX_API}/candles/${encodeURIComponent(symbol)}?timeframe=1h&limit=${CANDLE_HOURS}`,
            ),
            `candles ${symbol}`,
          );
          if (!Array.isArray(candles)) continue;
          volumes.set(symbol, { volumeUsd: phoenixVolume24h(candles, now), fetchedAt: now });
        } catch (error) {
          if (error instanceof CircuitOpenError) break;
          // Volume is secondary: leave this symbol for a later cycle rather than fail the batch.
        }
      }

      return parsePhoenixSnapshots(markets, overview.series, volumes, now);
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      let market = known.get(venueSymbol);
      if (!market) {
        market = checkBody(
          await client.getJson<PhoenixMarket>(
            `${PHOENIX_API}/view/exchange/market/${encodeURIComponent(venueSymbol)}`,
          ),
          "market",
        );
        known.set(venueSymbol, market);
      }
      const rows: PhoenixRatePoint[] = [];
      for (let start = fromMs; start <= toMs; start += HISTORY_WINDOW_MS + 1) {
        const end = Math.min(toMs, start + HISTORY_WINDOW_MS);
        const body = checkBody(
          await client.getJson<{ rates: PhoenixRatePoint[] }>(
            `${PHOENIX_API}/funding/${encodeURIComponent(venueSymbol)}/rates?startTime=${start}&endTime=${end}&limit=${HISTORY_PAGE_LIMIT}`,
          ),
          "funding rates",
        );
        if (!Array.isArray(body.rates)) throw new Error(`${VENUE}: unexpected rates response`);
        rows.push(...body.rates);
      }
      return parsePhoenixRates(market, rows, fromMs, toMs);
    },
  };
}

export const phoenixAdapter: VenueAdapter = createPhoenixAdapter();
