import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  inferIntervalHours,
} from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { hoursBetween, marketRef, mul, num, selectRefreshBatch } from "../parse";
import type { VenueAdapter } from "../types";
import { basisHoursFromGaps, declaredMarketBase } from "./aster";

/**
 * Hotcoin perpetuals. ONLY THE LAST SETTLED RATE IS AVAILABLE IN BULK, so every snapshot is
 * `kind: "settled"`.
 *
 * Measured from this machine on 2026-09-13 22:10–22:20 UTC (docs: hotcoinex.github.io/en/swap):
 *
 * - **`fund` on the bulk `/perpetual/public` is the last settled rate.** It equals
 *   `premiumIndex.lastFeeRate` for every contract checked (BTC 0.0000645, ETH 0.00004585, BTCUSDC
 *   0.00003907), and the newest row of `fee-rate` history, stamped 16:00:53 for BTCUSDT. It equals
 *   Binance's own 16:00 settled rate on 173 of 316 shared symbols, and not one of 558 values moved
 *   between reads a minute apart. The estimate lives only in per-contract
 *   `/{code}/premiumIndex.estimateFeeRate` (BTC 0.00007737 at the same moment), and 549 of those per
 *   minute would blow the 10/s budget, so it is not collected.
 * - **No interval anywhere in bulk.** `nextLiquidationInterval` is 0 and `countDownTimeInterval` ""
 *   on every row, and `liquidationTime` (the next settlement, epoch ms) was 00:00 UTC on 557 rows,
 *   which a 1h, 4h and 8h market all share. The interval is therefore read per contract from the
 *   spacing of its last settlements in `/{code}/fee-rate`, a few per cycle, cached for six hours.
 *   A full sweep of all 549 (550 requests in 101s, no 429) read 8h on 291, 4h on 257 and 1h on one,
 *   IOSTUSDT, the one row whose `liquidationTime` was 23:00. `warmUp` skips the cold-start sweep.
 * - **History**: `/{code}/fee-rate?page=&pageSize=`, newest first, `pageSize` capped at 100 (500
 *   returns 100), `total` 7,139 for BTCUSDT. Rows are stamped up to three minutes after the hour
 *   (16:02:48, 21:02:17), so settlement times are snapped back to the hour; see
 *   `hotcoinSettlementTime`.
 * - **Units**: `unitAmount` is base units per contract (BTCUSDT 0.001). `size24` is quote turnover:
 *   `amount24` contracts × `unitAmount` × mark gives it to a median ratio of 1.009 over all linear
 *   rows (1st–99th percentile 0.97–1.07). BTCUSDT: $1.54bn volume against Binance's $4.71bn, and
 *   `totalPosition` 7,262,189 contracts = $559M open interest against Binance's $8.04bn. Rates are
 *   fractions per interval: BTCUSDT 0.0000645 over 8h is 7.1% APR, Binance settled the same.
 * - **Open interest of "0" is not reported, not zero.** 70 of 558 rows say 0, all nine USDC
 *   markets among them: BTCUSDC turned over $126.6M in the same 24h. A book that trades that much
 *   with nothing open is not a figure, so zero becomes null.
 * - **Tradability**: 558 rows. 9 are inverse (`direction` 1, margined in the coin, quoted in USD:
 *   BTCUSD, ETHUSD…) and are dropped; the rest are linear with `base` (the MARGIN coin, despite the
 *   name) equal to `quote`: 540 USDT and 9 USDC, 549 collected. Every row has `env` 0 ("listing";
 *   1 is testing) and `tradeStatus` 0, both required.
 * - **Class**: Hotcoin lists tradfi (NAS100, US30, KR200, SKHYNIX, SAMSUNG, COPPER, SOFTBANK,
 *   HYUNDAI) but DECLARES NOTHING: `assetCategory` 0, `isPushTradfi` 0, `tradfiTagName` and
 *   `tradfiTagNameEn` "", `tags` [] on all 558 rows, and query parameters on those names change
 *   nothing. So all 549 are crypto today; see `hotcoinAssetClass` for when those fields fill.
 * - **Base**: `indexBaseDisplayName` is declared. The parser agrees with it on all 558 symbols except
 *   seven contract-size prefixes (1000PEPE, 1000000MOG, 10000NEX…), which it reads as multipliers.
 * - **Rate limit**: public market endpoints are documented at 10 requests/s per IP, 429 beyond it
 *   and an IP ban for continued violation, hence 150ms spacing.
 */

const VENUE_ID = "hotcoin";
export const HOTCOIN_API = "https://api-ct.hotcoin.fit/api/v1/perpetual/public";
/** At this budget a cold start covers the 549 collected contracts in 14 cycles. */
export const INTERVAL_REFRESH_BUDGET = 40;
export const INTERVAL_MAX_AGE_MS = 6 * 60 * 60_000;
/** A contract with no settlement yet has no interval to read; look again after this long. */
const INTERVAL_RETRY_MS = 30 * 60_000;
/** Four settlements give three gaps, so one missed or late settlement cannot move the median. */
const INTERVAL_SAMPLE = 4;
/** `pageSize` above 100 is served as 100 (measured 2026-09-13). */
export const HISTORY_PAGE_SIZE = 100;
/** BTCUSDT's 7,139 settlements are 72 pages; the collector asks for far shorter windows. */
const HISTORY_MAX_PAGES = 80;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
/** Settlement stamps land this far after the hour at most; anything later is kept to the minute. */
const SETTLEMENT_LAG_MS = 10 * MINUTE_MS;
const MARGIN_COINS: ReadonlySet<string> = new Set(["USDT", "USDC"]);

export interface HotcoinEnvelope<T> {
  code: number;
  data: T;
  msg: string;
}

/** One `/perpetual/public` row, with only the fields this adapter reads. */
export interface HotcoinTicker {
  /** Lowercase contract code, the identifier every per-contract path takes: `btcusdt`. */
  code: string;
  codeDisplayName: string;
  /** The MARGIN coin, lowercase: `usdt` on linear contracts, the coin itself on inverse ones. */
  base: string;
  baseDisplayName: string;
  quote: string;
  quoteDisplayName: string;
  /** The underlying as declared: `BTC`, `1000PEPE`, `NAS100`. */
  indexBaseDisplayName?: string;
  /** 0 linear, 1 inverse. */
  direction: number;
  /** 0 listing, 1 testing. */
  env: number;
  tradeStatus: number;
  /** Last SETTLED rate, a fraction per settlement interval. */
  fund: string;
  markPrice: string;
  indexPrice: string;
  /** Next settlement, epoch ms. */
  liquidationTime: number;
  /** Open interest in contracts; "0" where Hotcoin does not report it. */
  totalPosition: string;
  /** 24h turnover in the margin coin. */
  size24: string;
  /** Base units per contract. */
  unitAmount: number;
  maxLever?: number;
  assetCategory?: number;
  isPushTradfi?: number;
  tradfiTagName?: string;
  tradfiTagNameEn?: string;
}

export interface HotcoinFeeRate {
  contractCode?: string;
  /** The settled rate, a fraction per interval. Served as a JSON number. */
  feeRate: number | string;
  /** Epoch ms, up to a few minutes after the settlement it records. */
  createdDate: number;
}

export interface HotcoinFeeRatePage {
  rows: HotcoinFeeRate[];
  total?: number;
}

export interface HotcoinIntervalEntry {
  hours: number | null;
  fetchedAt: number;
}

function unwrap<T>(body: HotcoinEnvelope<T> | null | undefined, what: string): T {
  if (body?.code !== 200 || body.data === null || body.data === undefined) {
    throw new Error(`hotcoin: unexpected ${what} response: ${body?.code ?? ""} ${body?.msg ?? ""}`);
  }
  return body.data;
}

/** The margin coin, upper-cased, for a linear USDT or USDC contract Hotcoin lists as live; else null. */
export function hotcoinMarginCoin(ticker: HotcoinTicker): string | null {
  if (ticker.direction !== 0 || ticker.env !== 0 || ticker.tradeStatus !== 0) return null;
  const margin = ticker.baseDisplayName?.toUpperCase() ?? ticker.base?.toUpperCase();
  const quote = ticker.quoteDisplayName?.toUpperCase() ?? ticker.quote?.toUpperCase();
  return margin && margin === quote && MARGIN_COINS.has(margin) ? margin : null;
}

/** Collected contracts by code. */
export function tradableHotcoinTickers(rows: readonly HotcoinTicker[]): Map<string, HotcoinTicker> {
  return new Map(rows.filter((r) => hotcoinMarginCoin(r) !== null).map((r) => [r.code, r]));
}

/**
 * Hotcoin's declared class. It declares nothing today (see the header), so every market is crypto.
 * Its payload does carry tradfi fields -- `assetCategory`, `isPushTradfi`, `tradfiTagName` -- and a
 * row that fills any of them is saying "not crypto" in a vocabulary we have never seen, so the base
 * tables settle which class rather than a guess at what the tag means.
 */
export function hotcoinAssetClass(ticker: HotcoinTicker, base: string): AssetClass {
  const flagged =
    (ticker.assetCategory ?? 0) !== 0 ||
    (ticker.isPushTradfi ?? 0) !== 0 ||
    Boolean(ticker.tradfiTagName) ||
    Boolean(ticker.tradfiTagNameEn);
  return flagged ? classifyNonCrypto(base) : "crypto";
}

/**
 * When a settlement happened, from the stamp on its history row. Hotcoin writes the row up to three
 * minutes after the hour (BTCUSDT 16:02:48, IOSTUSDT 21:02:17), and every interval it runs is whole
 * hours, so a stamp within ten minutes of an hour is that hour. Anything else is kept to the minute
 * rather than forced onto a boundary it may not belong to.
 */
export function hotcoinSettlementTime(createdDate: number): number {
  const hour = Math.round(createdDate / HOUR_MS) * HOUR_MS;
  return Math.abs(createdDate - hour) <= SETTLEMENT_LAG_MS
    ? hour
    : Math.round(createdDate / MINUTE_MS) * MINUTE_MS;
}

/** Settlement interval from a contract's newest settlements, or from its only one and the next. */
export function hotcoinIntervalHours(
  rows: readonly HotcoinFeeRate[],
  nextFundingAt: number | null,
): number | null {
  const times = [
    ...new Set(
      rows
        .map((r) => num(r.createdDate))
        .filter((t): t is number => t !== null && t > 0)
        .map(hotcoinSettlementTime),
    ),
  ];
  if (times.length >= 2) return inferIntervalHours(times);
  if (times.length === 1) return hoursBetween(times[0] as number, nextFundingAt);
  return null;
}

/** A contract appears once its interval is known: a settled rate means nothing without its basis. */
export function parseHotcoinSnapshots(
  rows: readonly HotcoinTicker[],
  intervals: ReadonlyMap<string, HotcoinIntervalEntry>,
  now: number,
): FundingSnapshot[] {
  const snapshots: FundingSnapshot[] = [];
  for (const row of rows) {
    const margin = hotcoinMarginCoin(row);
    const rate = num(row.fund);
    const hours = intervals.get(row.code)?.hours ?? null;
    if (margin === null || rate === null || hours === null || !(hours > 0)) continue;

    const declared = declaredMarketBase({
      symbol: row.codeDisplayName || row.code,
      contractType: "",
      baseAsset: row.indexBaseDisplayName,
      quoteAsset: margin,
    });
    const overrides = { quote: margin, ...(declared ? { base: declared } : {}) };
    const { base } = marketRef(VENUE_ID, row.code, overrides);
    const markPrice = num(row.markPrice);
    const contracts = num(row.totalPosition);
    snapshots.push({
      ...marketRef(VENUE_ID, row.code, { ...overrides, assetClass: hotcoinAssetClass(row, base) }),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: row.liquidationTime > 0 ? row.liquidationTime : null,
      kind: "settled",
      markPrice,
      indexPrice: num(row.indexPrice),
      openInterestUsd:
        contracts === null || contracts === 0
          ? null
          : mul(contracts, num(row.unitAmount), markPrice),
      volume24hUsd: num(row.size24),
      maxLeverage: num(row.maxLever),
    });
  }
  return snapshots;
}

/** Settled events in [fromMs, toMs], oldest first, one per settlement time. */
export function parseHotcoinFundingHistory(
  venueSymbol: string,
  rows: readonly HotcoinFeeRate[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
  assetClass?: AssetClass,
): FundingEvent[] {
  const byTime = new Map<number, number>();
  for (const row of rows) {
    const stamp = num(row.createdDate);
    const rate = num(row.feeRate);
    if (stamp === null || stamp <= 0 || rate === null) continue;
    const time = hotcoinSettlementTime(stamp);
    if (time >= fromMs && time <= toMs && !byTime.has(time)) byTime.set(time, rate);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  const basis = basisHoursFromGaps(times, fallbackHours);
  const ref = marketRef(VENUE_ID, venueSymbol, assetClass ? { assetClass } : {});
  const events: FundingEvent[] = [];
  times.forEach((settledAt, i) => {
    const basisHours = basis[i];
    if (basisHours === null || basisHours === undefined) return;
    events.push({
      ...ref,
      settledAt,
      rate: byTime.get(settledAt) as number,
      basisHours,
      markPrice: null,
    });
  });
  return events;
}

export interface HotcoinAdapterOptions {
  intervalRefreshBudget?: number;
}

export function createHotcoinAdapter(options: HotcoinAdapterOptions = {}): VenueAdapter {
  const budget = options.intervalRefreshBudget ?? INTERVAL_REFRESH_BUDGET;
  const intervals = new Map<string, HotcoinIntervalEntry>();
  let classes = new Map<string, AssetClass>();

  const feeRateUrl = (code: string, page: number, pageSize: number) =>
    `${HOTCOIN_API}/${encodeURIComponent(code)}/fee-rate?page=${page}&pageSize=${pageSize}`;

  return {
    venueId: VENUE_ID,
    // Documented at 10 requests/s per IP, with an IP ban for repeated 429s.
    minIntervalMs: 150,

    /** The stored interval is what the history would say again; fetchedAt 0 keeps it due a re-read. */
    warmUp(markets) {
      for (const market of markets) {
        const hours = market.intervalHours;
        if (hours !== null && hours > 0 && !intervals.has(market.venueSymbol)) {
          intervals.set(market.venueSymbol, { hours, fetchedAt: 0 });
        }
      }
    },

    async fetchSnapshots(client: HttpClient, now: number) {
      const rows = unwrap(
        await client.getJson<HotcoinEnvelope<HotcoinTicker[]>>(HOTCOIN_API),
        "perpetual/public",
      );
      if (!Array.isArray(rows)) throw new Error("hotcoin: unexpected perpetual/public response");
      const live = tradableHotcoinTickers(rows);

      for (const code of intervals.keys()) {
        if (!live.has(code)) intervals.delete(code);
      }
      for (const code of selectRefreshBatch(
        [...live.keys()],
        intervals,
        now,
        budget,
        INTERVAL_MAX_AGE_MS,
      )) {
        try {
          const page = unwrap(
            await client.getJson<HotcoinEnvelope<HotcoinFeeRatePage>>(
              feeRateUrl(code, 1, INTERVAL_SAMPLE),
            ),
            `fee-rate ${code}`,
          );
          const next = live.get(code)?.liquidationTime ?? 0;
          const hours = hotcoinIntervalHours(page.rows ?? [], next > 0 ? next : null);
          if (hours !== null && hours > 0) {
            intervals.set(code, { hours, fetchedAt: now });
          } else {
            // Nothing settled yet. Keep any interval already known and come back sooner.
            intervals.set(code, {
              hours: intervals.get(code)?.hours ?? null,
              fetchedAt: now - INTERVAL_MAX_AGE_MS + INTERVAL_RETRY_MS,
            });
          }
        } catch (error) {
          if (error instanceof CircuitOpenError) break;
          // Leave this contract for a later cycle; one bad contract shouldn't fail the batch.
        }
      }

      const snapshots = parseHotcoinSnapshots([...live.values()], intervals, now);
      classes = new Map(snapshots.map((s) => [s.venueSymbol, s.assetClass]));
      return { snapshots, settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      // Newest first with no time filter, so page back until a page reaches past fromMs.
      const rows: HotcoinFeeRate[] = [];
      for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
        const data = unwrap(
          await client.getJson<HotcoinEnvelope<HotcoinFeeRatePage>>(
            feeRateUrl(venueSymbol, page, HISTORY_PAGE_SIZE),
          ),
          `fee-rate ${venueSymbol}`,
        );
        const batch = Array.isArray(data.rows) ? data.rows : [];
        rows.push(...batch);
        const oldest = Math.min(
          ...batch.map((r) => num(r.createdDate) ?? Number.POSITIVE_INFINITY),
        );
        if (batch.length < HISTORY_PAGE_SIZE || oldest < fromMs) break;
      }
      return parseHotcoinFundingHistory(
        venueSymbol,
        rows,
        fromMs,
        toMs,
        intervals.get(venueSymbol)?.hours ?? null,
        classes.get(venueSymbol),
      );
    },
  };
}

export const hotcoinAdapter: VenueAdapter = createHotcoinAdapter();
