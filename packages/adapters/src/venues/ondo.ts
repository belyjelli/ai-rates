import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  parseVenueSymbol,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE = "ondo";
export const ONDO_API = "https://api.ondoperps.xyz/v1";
const HOUR_MS = 3_600_000;
/** Funding settles every hour and the published rates are 1-hour rates; see the header below. */
const FUNDING_HOURS = 1;
/**
 * Perps settle in USDC. The contracts endpoint says `quoteCurrency: "USD"`, which is the pricing
 * unit; https://docs.ondoperps.xyz/settlement.md says losses, fees and funding move the USDC balance,
 * and the funding-fee schema describes `amount` as "the actual amount of USDC transferred".
 */
const SETTLEMENT_QUOTE = "USDC";
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 50;

export interface OndoContract {
  market: string;
  productType: string;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  /** "If true, the market is currently unavailable for trading." */
  disabled: boolean;
  /** The underlying's session is closed (equities outside hours); the perp still trades and funds. */
  isClosed?: boolean;
  indexPrice?: string | null;
  /** Open interest in base currency. */
  openInterest?: string | null;
  openInterestUsd?: string | null;
  usdVolume?: string | null;
  /** "Funding rate at the last completed funding interval." */
  fundingRate?: string | null;
  /** "Estimated funding rate at the end of the current funding interval." */
  nextFundingRate?: string | null;
  /** ISO-8601; when the next funding payment occurs. */
  nextFundingRateTimestamp?: string | null;
  /** Category labels: Crypto, Stock, ETF, Commodity, Index, FX. */
  tags?: string[] | null;
}

export interface OndoMarkPrice {
  market: string;
  markPrice?: string | null;
}

export interface OndoFundingRateValue {
  market: string;
  /** ISO-8601 with nanoseconds: "The time funding was paid". */
  time: string;
  fundingRate: string;
}

interface OndoResponse<T> {
  success: boolean;
  result: T;
  pageInfo?: { nextCursor?: string | null };
}

/**
 * Epoch ms from Ondo's ISO timestamps, which carry nanoseconds ("2026-09-13T22:00:00.037237665Z").
 * The fraction is cut to milliseconds first rather than trusting every runtime to accept nine digits.
 */
export function parseOndoTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The class Ondo declares in `tags`.
 *
 * On 2026-09-14 every one of the 81 contracts carried exactly one tag: Stock 51, Crypto 11, ETF 9,
 * Commodity 6, Index 2, FX 2. ETFs are equity (see `INDEX_BASES`: QQQ, SPY and friends are filed as
 * equity by five venues against two), and `marketRef` still lifts an index-listed base to `index`.
 * A tag we do not know is still a statement that the market is not crypto, so `classifyNonCrypto`
 * places it rather than defaulting it to crypto; no tag at all declares nothing, which is crypto.
 */
export function ondoAssetClass(
  tags: readonly string[] | null | undefined,
  base: string,
): AssetClass {
  const tag = tags
    ?.find((t) => t.trim() !== "")
    ?.trim()
    .toLowerCase();
  switch (tag) {
    case undefined:
    case "crypto":
      return "crypto";
    case "stock":
    case "etf":
      return "equity";
    case "commodity":
      return "commodity";
    case "index":
      return "index";
    case "fx":
      return "fx";
    default:
      return classifyNonCrypto(base);
  }
}

/** A perpetual Ondo has not disabled. Closed-session equities stay in: they trade and fund hourly. */
export function isOndoTradable(contract: OndoContract): boolean {
  return contract.productType === "perpetual" && contract.disabled === false;
}

function ondoRef(contract: Pick<OndoContract, "market" | "tags">) {
  // `baseCurrency` matched the parsed symbol on all 81 contracts (BTC-USD.P -> BTC, WTI-USD.P -> CL
  // through the alias), so the parser is used and the declared base is not needed.
  const base = parseVenueSymbol(contract.market).base;
  return marketRef(VENUE, contract.market, {
    quote: SETTLEMENT_QUOTE,
    assetClass: ondoAssetClass(contract.tags, base),
  });
}

/**
 * Snapshots from `/perps/contracts` and `/perps/mark_prices`, plus the settlement each contract
 * reports as its last completed interval.
 */
export function parseOndoSnapshots(
  contracts: readonly OndoContract[],
  markPrices: Readonly<Record<string, OndoMarkPrice>>,
  now: number,
): SnapshotBatch {
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];

  for (const contract of contracts) {
    const rate = num(contract.nextFundingRate);
    if (!isOndoTradable(contract) || rate === null) continue;

    const ref = ondoRef(contract);
    const nextFundingAt = parseOndoTime(contract.nextFundingRateTimestamp);
    const markPrice = num(markPrices[contract.market]?.markPrice);
    snapshots.push({
      ...ref,
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(contract.indexPrice),
      // Ondo reports both; the USD figure is used as given. Checked on BTC: 55.4663 x 76,886 =
      // 4,264,582 against openInterestUsd 4,264,581.94.
      openInterestUsd: num(contract.openInterestUsd),
      volume24hUsd: num(contract.usdVolume),
    });

    const lastRate = num(contract.fundingRate);
    if (lastRate !== null && nextFundingAt !== null) {
      settled.push({
        ...ref,
        settledAt: nextFundingAt - FUNDING_HOURS * HOUR_MS,
        rate: lastRate,
        basisHours: FUNDING_HOURS,
        markPrice: null,
      });
    }
  }
  return { snapshots, settled };
}

/** Settled hourly payments within [fromMs, toMs], oldest first, from newest-first history rows. */
export function parseOndoFundingHistory(
  rows: readonly OndoFundingRateValue[],
  contract: Pick<OndoContract, "market" | "tags">,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const ref = ondoRef(contract);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    // Rows are stamped a few ms to tens of ms after the hour ("22:00:00.037237665Z"). Settlements align
    // to UTC hours per the docs, and the contracts endpoint's settlement is derived on the hour, so the
    // stamp is floored: otherwise one payment would be stored twice, 37 ms apart.
    const stamped = parseOndoTime(row.time);
    const settledAt = stamped === null ? null : Math.floor(stamped / HOUR_MS) * HOUR_MS;
    const rate = num(row.fundingRate);
    if (settledAt === null || rate === null || settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...ref,
      settledAt,
      rate,
      basisHours: FUNDING_HOURS,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

function expectResult<T>(body: OndoResponse<T> | null | undefined, what: string): T {
  if (!body?.success || body.result === null || body.result === undefined) {
    throw new Error(`${VENUE}: unexpected ${what} response`);
  }
  return body.result;
}

/**
 * Ondo Perps, measured from this machine on 2026-09-14 and read against
 * https://docs.ondoperps.xyz (funding-rates.md, settlement.md, api-reference/rest-spec.json).
 *
 * - **Two calls a cycle.** `/perps/contracts` (81 rows, ~52 KB) carries funding, OI, volume, index
 *   price and category tags; `/perps/mark_prices` (81 rows) carries the mark, which contracts lacks.
 *   `/markets` (~180 KB) adds nothing the snapshot needs, so it is not called. A failed mark read
 *   leaves marks null for the cycle rather than dropping funding that already arrived.
 * - **Hourly, and the rates are 1-hour rates.** Docs: "Funding is paid every hour, 24 times per day.
 *   Intervals align to UTC hour boundaries", with the interest term "0.0000125 per hour". Live rows
 *   agree: every `nextFundingRateTimestamp` was the next UTC hour, history rows are exactly 1h apart
 *   (1,000 of 1,000 back to 2026-08-03), and quiet markets (ENA, PUMP) sit at 0.0000125 — the documented
 *   hourly interest, which is also Hyperliquid's hourly floor. At 22:13 UTC Hyperliquid's hourly BTC
 *   was +0.0000107 and ETH +0.0000125; Ondo's BTC next rate was -0.0000359 — same scale, not 8x or 24x
 *   (an 8h reading would put a 0.0000125 floor at 1/8 of Hyperliquid's).
 * - **`fundingIntervalDivisions`** (8 on all 81 markets in `/markets`) is undocumented. With a
 *   0.0003 `dailyInterestRate` and the docs' premium "/ 8", it reads as the 8h convention paid in
 *   eight hourly slices; nothing here depends on it.
 * - **Which rate is which.** `fundingRate` is "at the last completed funding interval": at 22:13 it was
 *   -0.0000338 for BTC, identical to the 22:00 row of `/perps/funding_rate_history`. So it is emitted as
 *   a settlement one hour before `nextFundingRateTimestamp`, never as a prediction. `nextFundingRate`
 *   is "estimated ... at the end of the current funding interval", and is the snapshot's predicted rate.
 * - **Tradable.** `productType` perpetual and `disabled` false: 61 of 81 (20 disabled: 4 crypto, 14
 *   stocks and ETFs, EURUSD). `isClosed` (45 of the 61 on a Sunday) only means the underlying session
 *   is shut; history shows AAPL funding every hour through the closure, so those markets are kept.
 * - **Class** from `tags`; see `ondoAssetClass`. **Quote** USDC; see `SETTLEMENT_QUOTE`.
 * - **History**: `/perps/funding_rate_history?market=&startTime=&endTime=&limit=&cursor=`, public,
 *   newest first, cursor-paginated.
 * - **Rate limit**: the spec defines a 429 `too_many_requests` response but publishes no quota.
 */
export function createOndoAdapter(): VenueAdapter {
  return {
    venueId: VENUE,
    minIntervalMs: 250,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const [contracts, markPrices] = await Promise.all([
        client
          .getJson<OndoResponse<OndoContract[]>>(`${ONDO_API}/perps/contracts`)
          .then((body) => expectResult(body, "perps/contracts")),
        client
          .getJson<OndoResponse<Record<string, OndoMarkPrice>>>(`${ONDO_API}/perps/mark_prices`)
          .then((body) => expectResult(body, "perps/mark_prices"))
          .catch(() => ({}) as Record<string, OndoMarkPrice>),
      ]);
      if (!Array.isArray(contracts))
        throw new Error(`${VENUE}: unexpected perps/contracts response`);
      return parseOndoSnapshots(contracts, markPrices, now);
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const rows: OndoFundingRateValue[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const params = new URLSearchParams({
          market: venueSymbol,
          startTime: String(fromMs),
          endTime: String(toMs),
          limit: String(HISTORY_PAGE_SIZE),
        });
        if (cursor) params.set("cursor", cursor);
        const body = await client.getJson<OndoResponse<OndoFundingRateValue[]>>(
          `${ONDO_API}/perps/funding_rate_history?${params}`,
        );
        const batch = expectResult(body, "perps/funding_rate_history");
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected funding history response`);
        rows.push(...batch);
        const oldest = Math.min(
          ...batch.map((r) => parseOndoTime(r.time) ?? Number.POSITIVE_INFINITY),
        );
        cursor = body.pageInfo?.nextCursor || null;
        if (batch.length < HISTORY_PAGE_SIZE || !cursor || oldest <= fromMs) break;
      }
      // History rows carry no tags, so the class comes from the contract list.
      const contracts = await client
        .getJson<OndoResponse<OndoContract[]>>(`${ONDO_API}/perps/contracts`)
        .then((body) => expectResult(body, "perps/contracts"));
      const contract = contracts.find((c) => c.market === venueSymbol) ?? {
        market: venueSymbol,
        tags: null,
      };
      return parseOndoFundingHistory(rows, contract, fromMs, toMs);
    },
  };
}

export const ondoAdapter: VenueAdapter = createOndoAdapter();
