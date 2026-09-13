import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Velocity (formerly Drift, rebranded 2026-07-01; Solana).
 *
 * LIVE, BUT SMALL: on 2026-09-13 the relaunch listed 4 perps (SOL, BTC, ETH, HYPE), all `active`,
 * funding updated on the hour (`fundingRateUpdateTs` 22:01:00Z read at 22:31Z), oracle prices current,
 * but 24h volume of $354 on BTC, $135 on ETH and $0 on HYPE, with BTC OI of 0.335 BTC. Worth
 * collecting because it is live and funds hourly; not yet a venue whose rates move a pool.
 *
 * REQUESTS: one per cycle, `GET /stats/markets` (~5 KB, spot and perp markets with stats inline).
 * The Data API (https://data.velocity.exchange/playground, spec at /openapi.json) documents no rate
 * limit, so this keeps to one request a second.
 *
 * FUNDING: hourly. https://docs.velocity.exchange/protocol/trading/funding-rates -- "once an hour,
 * whichever side is holding the contract away from the oracle pays the other side", with
 * `hourly_rate = (1/24) * (market_twap - oracle_twap) / oracle_twap` plus a 10.95%-APR floor. The
 * update is lazy ("updates when someone opens or closes a position, and independently when enough
 * time has passed"), so `nextFundingAt` is the next top of the hour, the earliest it can happen.
 *
 * `stats/markets` `fundingRate` is a PERCENT per hour, and it is the live estimate, not the last
 * settlement. Verified 2026-09-13:
 * - Units: the mean of the last 24 BTC-PERP records' `fundingRateLong / oraclePriceTwap` is
 *   0.0000790517 as a fraction, and the same response's `fundingRate24h` reads 0.007905 -- percent.
 *   `/stats/fundingRates` gives 0.007905172 for the same 24h window.
 * - Live: two reads at 22:27Z and 22:31Z gave BTC 0.008175 then 0.008181 with `fundingRateUpdateTs`
 *   unchanged at 22:01Z, whose record was 6.399237833 / 77333.73 = 0.008275%. So `predicted`.
 * - Sign: records' `fundingRateLong` is "Funding paid by long positions" (Data API glossary,
 *   https://docs.velocity.exchange/developers/data-api/glossary) and was +6.399 with the mark TWAP
 *   above the oracle TWAP. `stats` gave `long` -0.008181 and `short` +0.008181 at the same time, so
 *   `stats` states each side's P&L: longs paying shows as a negative `long`. The rate is therefore
 *   `-long / 100`, what longs pay, which also stays right if the AMM caps one side asymmetrically.
 * Cross-check against Hyperliquid, same minute: BTC 0.0000818/h here (71.7% APR) against HL
 * 0.0000117/h (10.2%), a factor of 7 that is premium, not basis -- Velocity's BTC mark 76,908.6 sat
 * 0.20% over its oracle 76,753.5, and 0.20% / 24 = 0.0084%/h is what the formula charges. ETH:
 * 0.0000891/h (mark 0.16% over oracle) against HL 0.0000125/h. A basis error would be 24x.
 *
 * UNITS, checked live: `openInterest.long` / `.short` are base units per side (BTC 0.335 long,
 * -0.0206 short); the AMM holds the difference (the history's `baseAssetAmountWithAmm` 0.3144 =
 * 0.335 - 0.0206), so OI is the larger side times mark: $25.8k on BTC. `quoteVolume` is USDT over 24h
 * (BTC `baseVolume` 0.0046 x ~77,060 = 354.47, as reported).
 *
 * TRADABILITY: `marketType` perp, `status` active and `uiStatus` not hidden. The delisting doc
 * (https://docs.velocity.exchange/protocol/risk-and-safety/delisting-process) puts a closing market in
 * ReduceOnly then Settlement, and new positions are refused from the first of those. On 2026-09-13:
 * 4 perps, all active and visible; the other 4 rows are spot markets (USDT, SOL, wBTC, wETH).
 *
 * QUOTE: USDT, which the API also declares as `quoteAsset`. "On Velocity mainnet-beta it is USDT ...
 * deposits, withdrawals, ATA derivation, collateral, and settlement all reference the USDT mint"
 * (https://docs.velocity.exchange/developers/migrate-from-drift). Drift settled in USDC.
 *
 * CLASS: the API declares none and all four markets are crypto, so crypto.
 *
 * BASE: the parser's reading of `symbol` (`BTC-PERP` -> BTC) matched `baseAsset` on all 4 markets.
 */

const VENUE = "velocity";
export const VELOCITY_API = "https://data.velocity.exchange";
const HOUR_MS = 3_600_000;
const FUNDING_HOURS = 1;
const QUOTE = "USDT";
/** `fundingRates` maximum page size; it keeps the last 31 days, 744 hourly rows, newest first. */
const HISTORY_PAGE_SIZE = 750;
const HISTORY_MAX_PAGES = 5;

export interface VelocityMarket {
  symbol: string;
  marketIndex: number;
  marketType: string;
  status: string;
  uiStatus?: string;
  baseAsset?: string;
  quoteAsset?: string;
  limits?: { leverage?: { min?: number; max?: number } };
  oraclePrice?: string;
  markPrice?: string;
  baseVolume?: string;
  quoteVolume?: string;
  /** Base units per side; `short` is negative. */
  openInterest?: { long?: string; short?: string };
  /** Percent per hour, as each side's P&L: longs paying reads as a negative `long`. */
  fundingRate?: { long?: string; short?: string };
  fundingRateUpdateTs?: number;
}

export interface VelocityMarketsResponse {
  success: boolean;
  markets: VelocityMarket[];
}

export interface VelocityFundingRecord {
  /** Unix seconds of the on-chain update. */
  ts: number;
  symbol: string;
  /** Quote per base unit for the hour, not a fraction. */
  fundingRate: string;
  fundingRateLong: string;
  fundingRateShort: string;
  oraclePriceTwap: string;
  markPriceTwap: string;
}

export interface VelocityFundingRatesResponse {
  success: boolean;
  records: VelocityFundingRecord[];
  meta?: { nextPage?: string | null };
}

function ref(venueSymbol: string) {
  return marketRef(VENUE, venueSymbol, { quote: QUOTE });
}

export function parseVelocityMarkets(
  body: VelocityMarketsResponse,
  now: number,
): FundingSnapshot[] {
  const nextFundingAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const snapshots: FundingSnapshot[] = [];
  for (const market of body.markets) {
    if (
      market.marketType !== "perp" ||
      market.status !== "active" ||
      market.uiStatus === "hidden"
    ) {
      continue;
    }
    const longPercent = num(market.fundingRate?.long);
    if (longPercent === null) continue;

    const markPrice = num(market.markPrice);
    const long = num(market.openInterest?.long);
    const short = num(market.openInterest?.short);
    const openInterest =
      long === null && short === null ? null : Math.max(Math.abs(long ?? 0), Math.abs(short ?? 0));

    snapshots.push({
      ...ref(market.symbol),
      observedAt: now,
      // `-0` would survive as a distinct value in toEqual; a flat market is plain zero.
      rate: longPercent === 0 ? 0 : -longPercent / 100,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(market.oraclePrice),
      openInterestUsd:
        openInterest !== null && markPrice !== null ? openInterest * markPrice : null,
      volume24hUsd: num(market.quoteVolume),
      maxLeverage: num(market.limits?.leverage?.max),
    });
  }
  return snapshots;
}

/**
 * Hourly settlements within [fromMs, toMs], oldest first.
 *
 * A record's rate is quote per base unit, so the fraction is `fundingRateLong / oraclePriceTwap`, the
 * docs' `(market_twap - oracle_twap) / oracle_twap` form -- checked above against `fundingRate24h`.
 * `ts` is the lazy on-chain update (22:01:00Z, 21:00:59Z) and is kept as published.
 */
export function parseVelocityFundingRates(
  records: readonly VelocityFundingRecord[],
  venueSymbol: string,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(venueSymbol);
  const bySettlement = new Map<number, FundingEvent>();
  for (const record of records) {
    const seconds = num(record.ts);
    const perUnit = num(record.fundingRateLong);
    const oracleTwap = num(record.oraclePriceTwap);
    if (seconds === null || perUnit === null || oracleTwap === null || oracleTwap <= 0) continue;
    const settledAt = seconds * 1000;
    if (settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate: perUnit / oracleTwap,
      basisHours: FUNDING_HOURS,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export function createVelocityAdapter(): VenueAdapter {
  return {
    venueId: VENUE,
    minIntervalMs: 1000,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const body = await client.getJson<VelocityMarketsResponse>(`${VELOCITY_API}/stats/markets`);
      if (!Array.isArray(body?.markets))
        throw new Error(`${VENUE}: unexpected stats/markets response`);
      return { snapshots: parseVelocityMarkets(body, now), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const records: VelocityFundingRecord[] = [];
      let page: string | undefined;
      for (let i = 0; i < HISTORY_MAX_PAGES; i++) {
        const cursor = page ? `&page=${encodeURIComponent(page)}` : "";
        const url = `${VELOCITY_API}/market/${encodeURIComponent(venueSymbol)}/fundingRates?limit=${HISTORY_PAGE_SIZE}${cursor}`;
        const body = await client.getJson<VelocityFundingRatesResponse>(url);
        if (!Array.isArray(body?.records))
          throw new Error(`${VENUE}: unexpected fundingRates response`);
        records.push(...body.records);
        const oldest = Math.min(...body.records.map((r) => r.ts));
        page = body.meta?.nextPage ?? undefined;
        if (!page || body.records.length === 0 || oldest * 1000 <= fromMs) break;
      }
      return parseVelocityFundingRates(records, venueSymbol, fromMs, toMs);
    },
  };
}

export const velocityAdapter: VenueAdapter = createVelocityAdapter();
