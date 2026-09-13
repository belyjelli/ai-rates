import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
  type LeverageTier,
} from "@ai-rates/core";
import { CircuitOpenError } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE_ID = "kucoin";
const BASE_URL = "https://api-futures.kucoin.com";
const MS_PER_HOUR = 3_600_000;
const HISTORY_PAGE = 100;
const MAX_PAGES = 50;
const RISK_LIMIT_RETRIES = 1;
const RISK_LIMIT_BACKOFF_MS = 300;
const OK = "200000";

/** KuCoin's type code for perpetual swaps; "FFICSX" is dated futures. */
const PERPETUAL = "FFWCSX";

export interface KucoinEnvelope<T> {
  code: string;
  msg?: string;
  data: T;
}

export interface KucoinContract {
  symbol: string;
  type: string;
  status: string;
  isInverse: boolean;
  /** Rate for the current funding period. */
  fundingFeeRate: number | null;
  /** ms; null on some symbols, where `fundingRateGranularity` still holds the interval. */
  currentFundingRateGranularity: number | null;
  fundingRateGranularity: number | null;
  nextFundingRateDateTime: number | null;
  /** Rate settled at the previous funding time. */
  lastTimeFundingRate: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  /** Lots, as a string. */
  openInterest: string;
  /** Base units per lot for linear contracts. */
  multiplier: number;
  /** Headline leverage; /contracts/risk-limit/{symbol} is the precise, size-aware source. */
  maxLeverage?: number | null;
  turnoverOf24h: number | null;
  /** What the contract tracks: "CRYPTO", "STOCK", "METAL" or "COMMODITY". */
  assetClass?: string;
}

/**
 * The class KuCoin declares for a contract, from `assetClass` on /api/v1/contracts/active.
 *
 * Live 2026-09-14, 687 contracts: CRYPTO 532, STOCK 146, METAL 6, COMMODITY 3. It separates
 * BBXUSDTM and QNTXUSDTM (stocks) from BBUSDTM and QNTUSDTM (crypto), and files CL, BZ and NATGAS
 * as commodities. `marketType` is NOT a substitute: it reads CRYPTO on every METAL and COMMODITY
 * row. PAXG and XAUT are declared METAL and returned to crypto by `marketRef`. A missing field is
 * undeclared, so crypto; a value this does not know still says not-crypto, so the base tables
 * settle which class.
 */
export function kucoinAssetClass(assetClass: string | undefined, base: string): AssetClass {
  switch (assetClass ?? "CRYPTO") {
    case "CRYPTO":
      return "crypto";
    case "STOCK":
      return "equity";
    case "METAL":
    case "COMMODITY":
      return "commodity";
    default:
      return classifyNonCrypto(canonicalBase(base));
  }
}

export interface KucoinRiskLimit {
  symbol: string;
  level: number;
  /** Quote notional, inclusive upper bound of the band. */
  maxRiskLimit: number;
  /** Quote notional; equals the previous level's `maxRiskLimit`, so bands are already contiguous. */
  minRiskLimit: number;
  maxLeverage: number;
  initialMargin: number;
  maintainMargin: number;
}

export interface KucoinFundingHistoryItem {
  symbol: string;
  fundingRate: number;
  timepoint: number;
}

function unwrap<T>(json: KucoinEnvelope<T>, what: string): T {
  if (json.code !== OK) throw new Error(`kucoin ${what}: ${json.code} ${json.msg ?? ""}`);
  return json.data;
}

/**
 * KuCoin answers `data: null` rather than `[]` when a window holds no rows, which the backfill hits
 * constantly: a symbol listed last week has nothing 90 days back. That is an empty result, not a
 * failure, and returning [] lets the caller mark the market exhausted instead of retrying forever.
 */
function unwrapList<T>(json: KucoinEnvelope<T[] | null>, what: string): T[] {
  return unwrap(json, what) ?? [];
}

function granularityMs(contract: KucoinContract): number | null {
  const ms = contract.currentFundingRateGranularity ?? contract.fundingRateGranularity;
  return ms !== null && ms > 0 ? ms : null;
}

export function parseKucoinSnapshots(
  json: KucoinEnvelope<KucoinContract[] | null>,
  now: number,
): SnapshotBatch {
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];

  for (const contract of unwrapList(json, "contracts")) {
    if (contract.type !== PERPETUAL || contract.isInverse || contract.status !== "Open") continue;
    const intervalMs = granularityMs(contract);
    const rate = num(contract.fundingFeeRate);
    if (intervalMs === null || rate === null) continue;

    const hours = intervalMs / MS_PER_HOUR;
    const { base } = marketRef(VENUE_ID, contract.symbol);
    const ref = marketRef(VENUE_ID, contract.symbol, {
      assetClass: kucoinAssetClass(contract.assetClass, base),
    });
    const nextFundingAt = num(contract.nextFundingRateDateTime);
    const markPrice = num(contract.markPrice);
    snapshots.push({
      ...ref,
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(contract.indexPrice),
      openInterestUsd: mul(num(contract.openInterest), num(contract.multiplier), markPrice),
      volume24hUsd: num(contract.turnoverOf24h),
      maxLeverage: num(contract.maxLeverage),
    });

    const lastRate = num(contract.lastTimeFundingRate);
    if (lastRate !== null && nextFundingAt !== null) {
      settled.push({
        ...ref,
        settledAt: nextFundingAt - intervalMs,
        rate: lastRate,
        basisHours: hours,
        markPrice: null,
      });
    }
  }
  return { snapshots, settled };
}

/**
 * KuCoin's risk ladders, one per symbol.
 *
 * It publishes both bounds, and level n's `minRiskLimit` equals level n-1's `maxRiskLimit`, so no
 * floor has to be inferred the way Bybit's and Gate's do. Bounds are quote notional, not lots:
 * `initialMargin` 0.008 is exactly 1/125 matching `maxLeverage`, and read as lots XBTUSDTM's first
 * band would be a $19m position at 125x, which no venue offers.
 */
export function parseKucoinRiskLimits(rows: readonly KucoinRiskLimit[]): LeverageTier[] {
  const bySymbol = new Map<string, KucoinRiskLimit[]>();
  for (const row of rows) {
    const existing = bySymbol.get(row.symbol);
    if (existing) existing.push(row);
    else bySymbol.set(row.symbol, [row]);
  }

  const ladders: LeverageTier[] = [];
  for (const [symbol, symbolRows] of bySymbol) {
    const ladder: LeverageTier[] = [];
    let usable = true;

    for (const row of [...symbolRows].sort((a, b) => a.level - b.level)) {
      const lower = num(row.minRiskLimit);
      const upper = num(row.maxRiskLimit);
      const imr = num(row.initialMargin);
      const maxLeverage = num(row.maxLeverage);
      if (
        lower === null ||
        upper === null ||
        upper <= lower ||
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
        venueSymbol: symbol,
        tier: row.level,
        lowerNotionalUsd: lower,
        upperNotionalUsd: upper,
        imr,
        mmr: num(row.maintainMargin),
        maxLeverage,
      });
    }
    if (usable) ladders.push(...ladder);
  }
  return ladders;
}

/** Settled funding events for one symbol, oldest first. */
export function parseKucoinFundingHistory(
  json: KucoinEnvelope<KucoinFundingHistoryItem[] | null>,
  fallbackHours: number,
): FundingEvent[] {
  const points = unwrapList(json, "funding history")
    .map((item) => ({
      symbol: item.symbol,
      settledAt: num(item.timepoint),
      rate: num(item.fundingRate),
    }))
    .filter(
      (p): p is { symbol: string; settledAt: number; rate: number } =>
        p.settledAt !== null && p.rate !== null,
    )
    .sort((a, b) => a.settledAt - b.settledAt);

  const basisHours = inferIntervalHours(points.map((p) => p.settledAt)) ?? fallbackHours;
  return points.map((p) => ({
    ...marketRef(VENUE_ID, p.symbol),
    settledAt: p.settledAt,
    rate: p.rate,
    basisHours,
    markPrice: null,
  }));
}

export const kucoinAdapter: VenueAdapter = {
  venueId: VENUE_ID,
  minIntervalMs: 150,

  async fetchSnapshots(client, now) {
    const json = await client.getJson<KucoinEnvelope<KucoinContract[]>>(
      `${BASE_URL}/api/v1/contracts/active`,
    );
    return parseKucoinSnapshots(json, now);
  },

  /**
   * The only venue here with no bulk form — asking without a symbol answers 404000 — so this is
   * one call per market: ~680 requests at 150ms spacing, about 100 seconds once a day. That holds
   * KuCoin's shared client long enough to delay a snapshot cycle or two, which is the price of
   * having ladders at all for this venue.
   */
  async fetchLeverageTiers(client) {
    const contracts = unwrapList(
      await client.getJson<KucoinEnvelope<KucoinContract[] | null>>(
        `${BASE_URL}/api/v1/contracts/active`,
      ),
      "contracts",
    );
    const symbols = contracts
      .filter((c) => c.type === PERPETUAL && !c.isInverse && c.status === "Open")
      .map((c) => c.symbol);

    const rows: KucoinRiskLimit[] = [];
    let complete = true;

    for (const symbol of symbols) {
      let fetched: KucoinRiskLimit[] | null = null;
      for (let attempt = 0; fetched === null && attempt <= RISK_LIMIT_RETRIES; attempt++) {
        try {
          fetched = unwrapList(
            await client.getJson<KucoinEnvelope<KucoinRiskLimit[] | null>>(
              `${BASE_URL}/api/v1/contracts/risk-limit/${encodeURIComponent(symbol)}`,
            ),
            "risk limit",
          );
        } catch (error) {
          if (error instanceof CircuitOpenError) {
            return { tiers: parseKucoinRiskLimits(rows), complete: false };
          }
          if (attempt < RISK_LIMIT_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RISK_LIMIT_BACKOFF_MS << attempt));
          }
        }
      }
      if (fetched === null) complete = false;
      else rows.push(...fetched);
    }
    return { tiers: parseKucoinRiskLimits(rows), complete };
  },

  async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
    const items: KucoinFundingHistoryItem[] = [];
    let to = toMs;
    for (let page = 0; page < MAX_PAGES && to >= fromMs; page++) {
      const data = unwrapList(
        await client.getJson<KucoinEnvelope<KucoinFundingHistoryItem[] | null>>(
          `${BASE_URL}/api/v1/contract/funding-rates?symbol=${encodeURIComponent(venueSymbol)}&from=${fromMs}&to=${to}`,
        ),
        "funding history",
      );
      items.push(...data);
      if (data.length < HISTORY_PAGE) break;
      to = Math.min(...data.map((i) => i.timepoint)) - 1;
    }

    let fallbackHours = 8;
    if (items.length < 2) {
      const contract = unwrap(
        await client.getJson<KucoinEnvelope<KucoinContract>>(
          `${BASE_URL}/api/v1/contracts/${encodeURIComponent(venueSymbol)}`,
        ),
        "contract",
      );
      const ms = granularityMs(contract);
      if (ms !== null) fallbackHours = ms / MS_PER_HOUR;
    }
    const unique = [...new Map(items.map((i) => [i.timepoint, i])).values()];
    return parseKucoinFundingHistory({ code: OK, data: unique }, fallbackHours);
  },
};
