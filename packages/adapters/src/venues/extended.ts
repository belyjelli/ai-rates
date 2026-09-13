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
 * Extended (Starknet deployment).
 *
 * REQUESTS: one per cycle, `GET /api/v1/info/markets` (~1 MB, every market with its stats inline).
 * Rate limit is 1,000 requests/minute per IP (https://api.docs.extended.exchange/), so 100ms spacing.
 *
 * USER-AGENT: the docs say "the `User-Agent` header is required". Measured 2026-09-14 from this
 * machine: 200 with `ai-rates-collector/0.1`, 403 Forbidden with the header removed. `http.ts` already
 * sends its `USER_AGENT` on every request, so nothing extra is passed here.
 *
 * FUNDING: `marketStats.fundingRate` is a 1-hour rate, as a fraction, and positive means longs pay.
 * The funding-payments doc (https://docs.extended.exchange/extended-resources/trading/funding-payments)
 * says payments "are charged every hour" and gives the rate as `(premium + clamp(...)) / 8`, and the
 * API docs call the history "the 1-hour rates that were applied". It is recalculated every minute and
 * paid at the top of the hour, so the live value is `predicted`. `marketStats.nextFundingRate` is,
 * despite its name, the epoch-ms timestamp of the next payment. Checked live: BTC 0.000013/h (11.4%
 * APR) against Arcus 0.0000125/h (10.95%) and Variational 9.1% on the same afternoon.
 *
 * UNITS, checked live 2026-09-14: `openInterest` is "in collateral asset" (USD) and equals
 * `openInterestBase` x mark (BTC 579.775 x 77,060.43 = $44.68M against $44.81M reported; the mark
 * moves between the two fields' snapshots). `dailyVolume` is also collateral, BTC $72.5M.
 *
 * TRADABILITY: `type` PERPETUAL and `status` ACTIVE only. Of 399 markets on 2026-09-14: 323 active
 * perps, 60 DELISTED, 12 PRELISTED, 1 REDUCE_ONLY (MKR) and 3 SPOT (BTCSPOT, ETHSPOT, USDTSPOT).
 * Off-hours equities (`isOffHours`) stay ACTIVE and keep accruing funding, so they are kept.
 *
 * QUOTE: USDC. The API's `collateralAssetName` says "USD" on every market, but that is the unit of
 * account: "All Extended markets are settled in USDC (i.e., PnL is paid in USDC)", per
 * https://docs.extended.exchange/extended-resources/trading/unified-margin-and-balances
 *
 * BASE: the parser's reading of `name` is kept on every live market, because it always agrees with
 * one of the venue's two declarations. Checked against all 323 on 2026-09-14:
 * - 26 `*_24_5` equities (`MU_24_5-USD`): `assetName` is the session-coded contract `MU_24_5`, while
 *   `uiName` and the parser both say MU. Passing `assetName` would file Micron in a pool of its own.
 * - 9 `k`/`1000` prefixes (`1000PEPE`, `kNOT`): the parser reads the multiplier, as for every venue.
 * - Parser and `assetName` agree, `uiName` differs: XNG (ui NATGAS), ANTHROP (ui ANTHROPIC), SPX
 *   (ui SPX6900, the memecoin), TECH100m (ui NDX, parsed TECH100M) and SPX500m (ui SPX, the S&P 500,
 *   parsed SPX500M). These do not pool with the same underlying elsewhere; fixing that needs aliases,
 *   which are core's decision, not this adapter's.
 */

const VENUE = "extended";
export const EXTENDED_API = "https://api.starknet.extended.exchange/api/v1";
const HOUR_MS = 3_600_000;
const FUNDING_HOURS = 1;
const QUOTE = "USDC";
/** History answers at most 1,000 rows per call, newest first (measured: a 500-day window gave 1,000). */
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 50;

export interface ExtendedMarket {
  name: string;
  type: string;
  status: string;
  uiName?: string;
  assetName?: string;
  category?: string | null;
  subCategory?: string | null;
  collateralAssetName?: string;
  marketStats?: {
    dailyVolume?: string;
    markPrice?: string;
    indexPrice?: string;
    fundingRate?: string;
    /** Epoch ms of the next funding payment, whatever the name says. */
    nextFundingRate?: number | string;
    openInterest?: string;
    openInterestBase?: string;
  };
  tradingConfig?: { maxLeverage?: string };
}

export interface ExtendedResponse<T> {
  status: string;
  data: T;
}

export interface ExtendedFundingRow {
  m: string;
  f: string;
  T: number;
}

/**
 * The class Extended declares: `category` says whether a market is RWA, `subCategory` says which kind.
 *
 * On 2026-09-14 the 323 active perps split into Crypto 196 (L1 46, DeFi 38, Meme 37, Infra 35, AI 25,
 * L2 13, and Commodity 2 -- PAXG and XAUT, gold tokens filed under Crypto) and RWA 127 (Equity 109,
 * Commodity 7, ETF/Index 7, Pre-market 2, FX 2). `Pre-market` is OpenAI and Anthropic, pre-IPO
 * shares, so equity. `ETF/Index` is passed as index and `marketRef`'s table decides which of the two
 * it is: JP225 stays index, EWY and DRAM become equity. Delisted `TradFi` rows (PLACE_JPY) and any
 * future RWA value fall to `classifyNonCrypto`. Legacy categories L1, L2 and Infra are crypto.
 */
export function extendedAssetClass(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  base: string,
): AssetClass {
  if (category?.trim().toUpperCase() !== "RWA") return "crypto";
  switch (subCategory?.trim().toUpperCase()) {
    case "EQUITY":
    case "PRE-MARKET":
      return "equity";
    case "COMMODITY":
      return "commodity";
    case "FX":
      return "fx";
    case "ETF/INDEX":
      return "index";
    default:
      return classifyNonCrypto(base);
  }
}

function ref(market: Pick<ExtendedMarket, "name" | "category" | "subCategory">) {
  const parsed = marketRef(VENUE, market.name);
  return marketRef(VENUE, market.name, {
    quote: QUOTE,
    assetClass: extendedAssetClass(market.category, market.subCategory, parsed.base),
  });
}

export function parseExtendedMarkets(
  body: ExtendedResponse<ExtendedMarket[]>,
  now: number,
): FundingSnapshot[] {
  const snapshots: FundingSnapshot[] = [];
  for (const market of body.data) {
    const stats = market.marketStats;
    const rate = num(stats?.fundingRate);
    if (market.type !== "PERPETUAL" || market.status !== "ACTIVE" || !stats || rate === null) {
      continue;
    }
    const nextFundingAt = num(stats.nextFundingRate);
    snapshots.push({
      ...ref(market),
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt: nextFundingAt !== null && nextFundingAt > 0 ? nextFundingAt : null,
      kind: "predicted",
      markPrice: num(stats.markPrice),
      indexPrice: num(stats.indexPrice),
      openInterestUsd: num(stats.openInterest),
      volume24hUsd: num(stats.dailyVolume),
      maxLeverage: num(market.tradingConfig?.maxLeverage),
    });
  }
  return snapshots;
}

/**
 * Hourly settlements for one market within [fromMs, toMs], oldest first.
 *
 * `T` carries the settlement run's own jitter (`1789336801693`, 1.7s past the hour); it is kept as
 * published rather than rounded, as dYdX's `effectiveAt` is.
 */
export function parseExtendedFunding(
  rows: readonly ExtendedFundingRow[],
  market: Pick<ExtendedMarket, "name" | "category" | "subCategory">,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(market);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = num(row.T);
    const rate = num(row.f);
    if (settledAt === null || rate === null || settledAt < fromMs || settledAt > toMs) continue;
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

export function createExtendedAdapter(): VenueAdapter {
  /** Class depends on the category, which only the markets call carries; remembered from snapshots. */
  const categories = new Map<string, Pick<ExtendedMarket, "category" | "subCategory">>();

  return {
    venueId: VENUE,
    minIntervalMs: 100,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const body = await client.getJson<ExtendedResponse<ExtendedMarket[]>>(
        `${EXTENDED_API}/info/markets`,
      );
      if (!Array.isArray(body?.data)) throw new Error(`${VENUE}: unexpected info/markets response`);
      for (const m of body.data) {
        categories.set(m.name, { category: m.category, subCategory: m.subCategory });
      }
      return { snapshots: parseExtendedMarkets(body, now), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const rows: ExtendedFundingRow[] = [];
      let endTime = toMs;
      for (let page = 0; page < HISTORY_MAX_PAGES && endTime >= fromMs; page++) {
        const url = `${EXTENDED_API}/info/${encodeURIComponent(venueSymbol)}/funding?startTime=${fromMs}&endTime=${endTime}`;
        const body = await client.getJson<ExtendedResponse<ExtendedFundingRow[]>>(url);
        const batch = body?.data;
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected funding response`);
        rows.push(...batch);
        const oldest = Math.min(...batch.map((r) => r.T));
        if (batch.length < HISTORY_PAGE_SIZE || !Number.isFinite(oldest)) break;
        // Newest first: step back past the oldest row. An hour is far wider than any row's jitter.
        endTime = Math.min(oldest - 1, endTime - HOUR_MS);
      }
      const declared = categories.get(venueSymbol) ?? {};
      return parseExtendedFunding(rows, { name: venueSymbol, ...declared }, fromMs, toMs);
    },
  };
}

export const extendedAdapter: VenueAdapter = createExtendedAdapter();
