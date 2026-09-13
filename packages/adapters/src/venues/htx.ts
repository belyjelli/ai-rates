import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { VenueAdapter } from "../types";
import { basisHoursFromGaps } from "./aster";

const VENUE_ID = "htx";
export const HTX_API = "https://api.hbdm.com";
/** Contract info is 160 KB and only says which swaps list, their size and their interval. */
export const CONTRACT_INFO_MAX_AGE_MS = 60 * 60_000;
/** `page_size` above 100 is refused; 100 is accepted (measured 2026-09-14). */
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 50;
/** `contract_status`: 1 listing. 3 is suspension (5 swaps on 2026-09-14); the rest are delist/delivery. */
const LISTING = 1;

export interface HtxEnvelope<T> {
  status: string;
  data: T;
  ts?: number;
  err_code?: number;
  err_msg?: string;
}

export interface HtxMergedEnvelope {
  status: string;
  ticks: HtxMergedTick[];
  err_code?: number;
  err_msg?: string;
}

export interface HtxContractInfo {
  /** Declared base, e.g. "BTC". */
  symbol: string;
  contract_code: string;
  /** Base units per contract: 0.001 BTC, 1,000,000 PEPE. */
  contract_size: number;
  contract_status: number;
  /** Settlement interval in hours, as a string: "1", "4" or "8". */
  settlement_period: string;
  /** Free tags. "tradfi" appears on exactly the rows that carry `tradfi_labels`. */
  labels?: string[];
  /** The declared class: Stocks, Indices, Metals, Commodities, or empty for crypto. */
  tradfi_labels?: string[];
  business_type: string;
  contract_type: string;
  /** Margin and settlement currency of the partition the swap trades in ("USDT"). */
  trade_partition: string;
}

export interface HtxFundingRate {
  contract_code: string;
  /** Rate for the funding period now running, paid at `funding_time`. Null on delivery futures. */
  funding_rate: string | null;
  funding_time: string | null;
  /** Deprecated by HTX: null on all 346 rows on 2026-09-14. */
  estimated_rate?: string | null;
  next_funding_time?: string | null;
}

export interface HtxOpenInterest {
  contract_code: string;
  /** Open interest in contracts. */
  volume: number;
  /** Open interest in base units (volume x contract_size). */
  amount: number;
  /** Open interest in the partition's currency (USDT). */
  value: number;
  /** 24h turnover in the partition's currency (USDT). */
  trade_turnover: number;
  business_type?: string;
}

export interface HtxIndex {
  contract_code: string;
  index_price: number;
}

export interface HtxMergedTick {
  contract_code: string;
  /** [price, size in contracts]. */
  ask?: [number, number] | number[] | null;
  bid?: [number, number] | number[] | null;
}

export interface HtxFundingHistoryItem {
  contract_code: string;
  funding_rate: string;
  funding_time: string;
}

export interface HtxFundingHistoryPage {
  total_page: number;
  current_page: number;
  total_size: number;
  data: HtxFundingHistoryItem[];
}

function unwrap<T>(json: HtxEnvelope<T>, what: string): T {
  if (json?.status !== "ok" || json.data === undefined || json.data === null) {
    throw new Error(`htx ${what}: ${json?.err_code ?? ""} ${json?.err_msg ?? json?.status}`);
  }
  return json.data;
}

function positiveMs(value: unknown): number | null {
  const ms = num(value);
  return ms !== null && ms > 0 ? ms : null;
}

/**
 * The class HTX declares for a swap, from `tradfi_labels` and, failing that, `labels`, both in
 * swap_contract_info.
 *
 * HTX declares in two places and fills them unevenly. Live 2026-09-14, 342 USDT swaps:
 * - 223 carry `tradfi_labels` (and "tradfi" in `labels`): ["Stocks"] 179, ["Stocks","Indices"] 27
 *   (ETFs such as TQQQ, SOXX, XBI), ["Indices"] 7 (SPX500, NASDAQ100, and the ETFs SPY, QQQ, EWY,
 *   EWJ, TBT), ["Metals"] 7 (XAU XAG XPT XPD COPPER, and the tokens PAXG and XAUT) and
 *   ["Commodities"] 3 (USOIL BRENTOIL NATGAS).
 * - 12 carry only a lowercase `labels` tag: "stock" on GFS BYD ASX DJT GE FCX XOM CIFR APD MRK, and
 *   "indices" on the ETFs XLU and XLK. Reading `tradfi_labels` alone filed Exxon as a crypto token.
 * - 107 carry neither and are crypto. EURUSD is among them: HTX declares nothing for it.
 *
 * `tradfi_labels` wins where both speak, and Stocks wins over Indices, because every row carrying
 * both is an ETF, which is equity everywhere; `marketRef` then moves the real indices (JP225 is
 * filed under Stocks) to index. A row flagged tradfi with labels this does not know is still not
 * crypto, so the base tables pick the class.
 */
export function htxAssetClass(
  contract: Pick<HtxContractInfo, "labels" | "tradfi_labels">,
  base: string,
): AssetClass {
  const tradfi = contract.tradfi_labels ?? [];
  const labels = contract.labels ?? [];
  if (tradfi.includes("Metals") || tradfi.includes("Commodities")) return "commodity";
  if (tradfi.includes("Stocks")) return "equity";
  if (tradfi.includes("Indices")) return "index";
  if (labels.includes("commodities")) return "commodity";
  if (labels.includes("stock")) return "equity";
  if (labels.includes("indices")) return "index";
  if (tradfi.length > 0 || labels.includes("tradfi")) return classifyNonCrypto(canonicalBase(base));
  return "crypto";
}

/** Listing USDT-margined perpetual swaps, by contract code. Delivery futures and suspended swaps are out. */
export function tradableHtxSwaps(
  contracts: readonly HtxContractInfo[],
): Map<string, HtxContractInfo> {
  return new Map(
    contracts
      .filter(
        (c) =>
          c.business_type === "swap" &&
          c.contract_type === "swap" &&
          c.contract_status === LISTING &&
          (num(c.settlement_period) ?? 0) > 0,
      )
      .map((c) => [c.contract_code, c]),
  );
}

export interface HtxSnapshotInput {
  contracts: ReadonlyMap<string, HtxContractInfo>;
  funding: readonly HtxFundingRate[];
  openInterest: readonly HtxOpenInterest[];
  indices: readonly HtxIndex[];
  ticks: readonly HtxMergedTick[];
}

/**
 * Joins the bulk funding, open interest, index and ticker responses onto listing swaps.
 *
 * Units, checked against the live responses of 2026-09-14 05:01 UTC:
 * - `funding_rate` is the running period's rate and `funding_time` the settlement it is paid at:
 *   BTC-USDT read 0.0000431 and then 0.0000405 two minutes later, both against 00:00 UTC, while
 *   swap_historical_funding_rate filed the previous 16:00 settlement under that time. It is a
 *   fraction per `settlement_period` hours (JP225, a 1h swap, settles 0.00000625 hourly).
 * - `value` is USDT already: BTC-USDT 2,221,334,022 against amount 28,808.125 BTC x index 77,153.6
 *   = 2,222,678,044 (0.06%, mark against index), and PEPE-USDT, at 1,000,000 PEPE a contract,
 *   418,429 against 417,888. So no contract size is applied to it.
 * - `trade_turnover` is USDT: BTC-USDT 145,152,803 against trade_amount 1,884.88 BTC x index.
 * - Ticker sizes are contracts: BTC-USDT's bid of 20 is 20 x 0.001 BTC, about $1,542.
 *
 * HTX publishes mark price only per contract (a mark-price kline), so `markPrice` is null rather
 * than the last trade dressed up as a mark.
 */
export function parseHtxSnapshots(input: HtxSnapshotInput, now: number): FundingSnapshot[] {
  const openInterest = new Map(input.openInterest.map((o) => [o.contract_code, o]));
  const indices = new Map(input.indices.map((i) => [i.contract_code, num(i.index_price)]));
  const ticks = new Map(input.ticks.map((t) => [t.contract_code, t]));
  const snapshots: FundingSnapshot[] = [];

  for (const row of input.funding) {
    const contract = input.contracts.get(row.contract_code);
    const rate = num(row.funding_rate);
    const hours = num(contract?.settlement_period);
    if (!contract || rate === null || hours === null || hours <= 0) continue;

    const { base } = marketRef(VENUE_ID, row.contract_code);
    const oi = openInterest.get(row.contract_code);
    const tick = ticks.get(row.contract_code);
    const size = num(contract.contract_size);
    const bidPrice = num(tick?.bid?.[0]);
    const askPrice = num(tick?.ask?.[0]);
    snapshots.push({
      ...marketRef(VENUE_ID, row.contract_code, {
        quote: contract.trade_partition || null,
        assetClass: htxAssetClass(contract, base),
      }),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: positiveMs(row.funding_time),
      kind: "predicted",
      markPrice: null,
      indexPrice: indices.get(row.contract_code) ?? null,
      bestBid: bidPrice,
      bestBidSizeUsd: mul(num(tick?.bid?.[1]), size, bidPrice),
      bestAsk: askPrice,
      bestAskSizeUsd: mul(num(tick?.ask?.[1]), size, askPrice),
      openInterestUsd: num(oi?.value),
      volume24hUsd: num(oi?.trade_turnover),
    });
  }
  return snapshots;
}

/**
 * Settlements for one swap in [fromMs, toMs], oldest first.
 *
 * Each basis is the gap to the nearest neighbouring settlement, measured over every row fetched and
 * not only those inside the window: the collector usually asks for a window holding one new
 * settlement, and its neighbours just outside are what say how long that period was.
 */
export function parseHtxFundingHistory(
  venueSymbol: string,
  rows: readonly HtxFundingHistoryItem[],
  fromMs: number,
  toMs: number,
  fallbackHours: number | null,
  contract?: HtxContractInfo,
): FundingEvent[] {
  const byTime = new Map<number, number>();
  for (const row of rows) {
    const time = num(row.funding_time);
    const rate = num(row.funding_rate);
    if (time !== null && rate !== null) byTime.set(time, rate);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  const basis = basisHoursFromGaps(times, fallbackHours);
  const { base } = marketRef(VENUE_ID, venueSymbol);
  const ref = marketRef(
    VENUE_ID,
    venueSymbol,
    contract
      ? { quote: contract.trade_partition || null, assetClass: htxAssetClass(contract, base) }
      : {},
  );

  const events: FundingEvent[] = [];
  times.forEach((settledAt, i) => {
    const basisHours = basis[i];
    if (settledAt < fromMs || settledAt > toMs || basisHours === null || basisHours === undefined) {
      return;
    }
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

export function createHtxAdapter(): VenueAdapter {
  let contracts: { fetchedAt: number; bySymbol: Map<string, HtxContractInfo> } | null = null;

  async function loadContracts(client: HttpClient, fetchedAt: number) {
    const info = unwrap(
      await client.getJson<HtxEnvelope<HtxContractInfo[]>>(
        `${HTX_API}/linear-swap-api/v1/swap_contract_info?business_type=swap`,
      ),
      "contract info",
    );
    contracts = { fetchedAt, bySymbol: tradableHtxSwaps(info) };
    return contracts.bySymbol;
  }

  return {
    venueId: VENUE_ID,
    // HTX allows 240 public non-market requests per 3s and 800 market requests per second per IP;
    // a cycle makes four, so 100ms spacing is far inside both.
    minIntervalMs: 100,

    async fetchSnapshots(client, now) {
      const bySymbol =
        contracts && now - contracts.fetchedAt < CONTRACT_INFO_MAX_AGE_MS
          ? contracts.bySymbol
          : await loadContracts(client, now);
      const [funding, openInterest, indices, merged] = await Promise.all([
        client
          .getJson<HtxEnvelope<HtxFundingRate[]>>(
            `${HTX_API}/linear-swap-api/v1/swap_batch_funding_rate`,
          )
          .then((json) => unwrap(json, "batch funding rate")),
        client
          .getJson<HtxEnvelope<HtxOpenInterest[]>>(
            `${HTX_API}/linear-swap-api/v1/swap_open_interest?business_type=swap`,
          )
          .then((json) => unwrap(json, "open interest")),
        client
          .getJson<HtxEnvelope<HtxIndex[]>>(`${HTX_API}/linear-swap-api/v1/swap_index`)
          .then((json) => unwrap(json, "index")),
        client.getJson<HtxMergedEnvelope>(
          `${HTX_API}/linear-swap-ex/market/detail/batch_merged?business_type=swap`,
        ),
      ]);
      if (merged?.status !== "ok" || !Array.isArray(merged.ticks)) {
        throw new Error(`htx batch merged: ${merged?.err_code ?? ""} ${merged?.err_msg ?? ""}`);
      }
      const snapshots = parseHtxSnapshots(
        { contracts: bySymbol, funding, openInterest, indices, ticks: merged.ticks },
        now,
      );
      return { snapshots, settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      // History run before any snapshot cycle still needs the interval and class. fetchedAt 0 keeps
      // that copy due for a refresh on the next cycle.
      const bySymbol = contracts?.bySymbol ?? (await loadContracts(client, 0));
      const contract = bySymbol.get(venueSymbol);

      // Newest first, paged by index with no time filter, so page back until the window is covered.
      const rows: HtxFundingHistoryItem[] = [];
      for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
        const result = unwrap(
          await client.getJson<HtxEnvelope<HtxFundingHistoryPage>>(
            `${HTX_API}/linear-swap-api/v1/swap_historical_funding_rate?contract_code=${encodeURIComponent(venueSymbol)}&page_index=${page}&page_size=${HISTORY_PAGE_SIZE}`,
          ),
          "historical funding rate",
        );
        const list = result.data ?? [];
        rows.push(...list);
        const oldest = Math.min(
          ...list.map((r) => num(r.funding_time) ?? Number.POSITIVE_INFINITY),
        );
        if (list.length < HISTORY_PAGE_SIZE || page >= result.total_page || oldest < fromMs) break;
      }
      return parseHtxFundingHistory(
        venueSymbol,
        rows,
        fromMs,
        toMs,
        num(contract?.settlement_period),
        contract,
      );
    },
  };
}

export const htxAdapter: VenueAdapter = createHtxAdapter();
