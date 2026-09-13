import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { marketRef, mul, num, selectRefreshBatch } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * GRVT (Gravity Markets).
 *
 * REQUESTS: GRVT's market data API answers per instrument only -- `POST /full/v1/ticker` takes one
 * `instrument` and there is no all-tickers call -- so each cycle refreshes a rotating slice:
 * `POST /full/v1/all_instruments` once an hour, plus `TICKER_BUDGET` tickers, the least recently
 * fetched first. With 194 perps on 2026-09-13 that is 100 requests a cycle and every perp is
 * re-read every 2 cycles (~2 minutes), inside the screener's 5-minute freshness window. Responses
 * carry `x-ratelimit-limit: 1500` (the window is not documented and the docs site answers 403 to
 * non-browsers); 100 a minute is far inside any reading of it. Tickers answered in ~130ms from here.
 *
 * WHY ONLY THIS CYCLE'S SLICE IS EMITTED: the collector appends every snapshot to
 * `funding_snapshots` without a conflict key, so re-emitting a ticker read two minutes ago would
 * write the same observation twice. An instrument shows up in the cycles that refresh it, which
 * keeps it in `market_latest` because the sweep is shorter than the 5-minute window. `warmUp` has
 * nothing to seed: the rate itself is the per-instrument read, and a stored market stays visible
 * for those five minutes after a restart while the first sweep runs.
 *
 * FUNDING -- units. `funding_rate` (equal to `funding_rate_8h_curr` on every ticker read) is in
 * PERCENT: the SDK's schema says "The current funding rate of the instrument, expressed in
 * percentage points" (https://github.com/gravity-technologies/grvt-pysdk, `grvt_raw_types.py`).
 * Checked against Binance, whose BTC settlement at 2026-09-13 16:00 UTC was 0.0000645 per 8h:
 * GRVT settled 0.0061 at the same instant, i.e. 0.000061 as a fraction. Read as a fraction it
 * would be 100x every other venue (Hyperliquid 0.0000114/h, i.e. 0.000091 per 8h, that evening).
 *
 * FUNDING -- period. Despite the `8h` in the field name, the rate is per the instrument's own
 * `funding_interval_hours` (8 on 125 perps, 4 on 69). The resting rate shows it: 8h perps that
 * are not trading away from index sit at 0.01 (SOL, every settlement), and 4h perps sit at 0.005
 * (ENA, HYPE, every settlement) -- exactly the 0.01%-per-8h interest floor paid over four hours.
 * An 8h-normalised field would read 0.01 on both. So `basisHours` = `funding_interval_hours`, and
 * 0.005 per 4h is 0.0000125/h, Hyperliquid's own resting rate.
 *
 * FUNDING -- kind. The ticker rate is the running estimate for `next_funding_time`: at 22:29 UTC
 * BTC read 0.0031 while its last settlement (16:00) was 0.0061, so it is `predicted`.
 *
 * UNITS: `open_interest` is "expressed in base asset decimal units" (BTC 2,523 x 76,747 = $194M);
 * `buy_volume_24h_q` and `sell_volume_24h_q` are the 24h TAKER buy and sell volume in quote, so
 * their sum is total volume (BTC $98.6M, which matches 637 + 643 BTC base volume at ~77k). Book
 * sizes are base units. Timestamps are unix nanoseconds, converted exactly with BigInt.
 *
 * TRADABILITY: `all_instruments` with `is_active: true`, `kind` PERPETUAL. On 2026-09-13 that was
 * 194 instruments, all perpetual and all quoted in USDT; the request without the flag returned the
 * same 194.
 *
 * CLASS: every instrument declares `asset_class: "UNSPECIFIED"` -- AAPL, XAU and NATGAS included --
 * so all are crypto, as the rule for a venue that declares nothing requires. Should GRVT fill the
 * field, a crypto value stays crypto and any other value goes to `classifyNonCrypto`.
 *
 * QUOTE: the instrument's `quote` (USDT). BASE: the parser agrees with the declared `base` on all
 * 194 symbols (`BTC_USDT_Perp`). One disagreement with other venues remains: GRVT spells its
 * thousand-unit contracts with a capital K, which the parser does not read as a multiplier. Measured
 * 2026-09-13, KPEPE marked 0.003348 against Binance 1000PEPE 0.003349, KBONK 0.002696 against
 * 0.002694 and KSHIB 0.005130 against 0.005131. They stay under the declared bases KPEPE, KBONK and
 * KSHIB (multiplier 1, so they pool with nothing rather than with PEPE at a 1000x price); reading
 * `K` as a multiplier is the parser's decision, not this adapter's.
 */

const VENUE = "grvt";
export const GRVT_API = "https://market-data.grvt.io/full/v1";
export const INSTRUMENTS_MAX_AGE_MS = 60 * 60_000;
/** Tickers per cycle; see REQUESTS. */
export const TICKER_BUDGET = 100;
/** `limit` "Defaults to 500; Max 1000" for the funding history. */
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 20;
const NS_PER_MS = 1_000_000n;

export interface GrvtInstrument {
  instrument: string;
  base: string;
  quote: string;
  kind: string;
  funding_interval_hours?: number;
  asset_class?: string;
}

export interface GrvtTicker {
  event_time?: string;
  instrument: string;
  mark_price?: string;
  index_price?: string;
  best_bid_price?: string;
  best_bid_size?: string;
  best_ask_price?: string;
  best_ask_size?: string;
  /** Percent, per `funding_interval_hours`. */
  funding_rate?: string;
  funding_rate_8h_curr?: string;
  buy_volume_24h_q?: string;
  sell_volume_24h_q?: string;
  open_interest?: string;
  next_funding_time?: string;
}

export interface GrvtFundingRow {
  instrument: string;
  funding_rate: string;
  funding_time: string;
  mark_price?: string;
  funding_interval_hours?: number;
}

/** Nanosecond epoch string to milliseconds, exactly; null if it isn't a positive integer. */
function nsToMs(ns: string | undefined): number | null {
  if (!ns || !/^\d+$/.test(ns) || /^0+$/.test(ns)) return null;
  return Number(BigInt(ns) / NS_PER_MS);
}

/** GRVT's percentage-point rate as a fraction. */
export function grvtRate(percent: unknown): number | null {
  const value = num(percent);
  return value === null ? null : value / 100;
}

export function grvtAssetClass(assetClass: string | undefined, base: string): AssetClass {
  const declared = assetClass?.trim().toUpperCase() ?? "";
  if (declared === "" || declared === "UNSPECIFIED" || declared === "CRYPTO") return "crypto";
  switch (declared) {
    case "EQUITY":
    case "STOCK":
      return "equity";
    case "COMMODITY":
      return "commodity";
    case "FX":
    case "FOREX":
      return "fx";
    case "INDEX":
      return "index";
    default:
      return classifyNonCrypto(base);
  }
}

/** Active perpetuals with a funding interval, by instrument name. */
export function tradableGrvtPerps(
  instruments: readonly GrvtInstrument[],
): Map<string, GrvtInstrument> {
  return new Map(
    instruments
      .filter((i) => i.kind === "PERPETUAL" && (i.funding_interval_hours ?? 0) > 0)
      .map((i) => [i.instrument, i]),
  );
}

function ref(instrument: GrvtInstrument) {
  const parsed = marketRef(VENUE, instrument.instrument);
  return marketRef(VENUE, instrument.instrument, {
    quote: instrument.quote,
    assetClass: grvtAssetClass(instrument.asset_class, parsed.base),
  });
}

export function parseGrvtTicker(
  instrument: GrvtInstrument,
  ticker: GrvtTicker | null | undefined,
  now: number,
): FundingSnapshot | null {
  const hours = instrument.funding_interval_hours ?? null;
  const rate = grvtRate(ticker?.funding_rate ?? ticker?.funding_rate_8h_curr);
  const markPrice = num(ticker?.mark_price);
  if (!ticker || ticker.instrument !== instrument.instrument || rate === null) return null;
  if (hours === null || hours <= 0 || markPrice === null) return null;

  const buy = num(ticker.buy_volume_24h_q);
  const sell = num(ticker.sell_volume_24h_q);
  const bestBid = num(ticker.best_bid_price);
  const bestAsk = num(ticker.best_ask_price);
  return {
    ...ref(instrument),
    observedAt: now,
    rate,
    basisHours: hours,
    intervalHours: hours,
    nextFundingAt: nsToMs(ticker.next_funding_time),
    kind: "predicted",
    markPrice,
    indexPrice: num(ticker.index_price),
    bestBid,
    bestBidSizeUsd: mul(num(ticker.best_bid_size), bestBid),
    bestAsk,
    bestAskSizeUsd: mul(num(ticker.best_ask_size), bestAsk),
    openInterestUsd: mul(num(ticker.open_interest), markPrice),
    volume24hUsd: buy === null && sell === null ? null : (buy ?? 0) + (sell ?? 0),
  };
}

/** Settlements within [fromMs, toMs], oldest first, each over its own interval. */
export function parseGrvtFunding(
  rows: readonly GrvtFundingRow[],
  instrument: GrvtInstrument,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(instrument);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = nsToMs(row.funding_time);
    const rate = grvtRate(row.funding_rate);
    const basisHours = row.funding_interval_hours ?? instrument.funding_interval_hours ?? null;
    if (settledAt === null || rate === null || basisHours === null || basisHours <= 0) continue;
    if (settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate,
      basisHours,
      markPrice: num(row.mark_price),
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export interface GrvtAdapterOptions {
  tickerBudget?: number;
}

export function createGrvtAdapter(options: GrvtAdapterOptions = {}): VenueAdapter {
  const budget = options.tickerBudget ?? TICKER_BUDGET;
  let instruments: { fetchedAt: number; byName: Map<string, GrvtInstrument> } | null = null;
  /** When each instrument's ticker was last requested, for the rotation. */
  const lastFetched = new Map<string, { fetchedAt: number }>();

  async function loadInstruments(client: HttpClient, now: number) {
    if (instruments && now - instruments.fetchedAt < INSTRUMENTS_MAX_AGE_MS) {
      return instruments.byName;
    }
    const body = await client.postJson<{ result: GrvtInstrument[] }>(
      `${GRVT_API}/all_instruments`,
      {
        is_active: true,
      },
    );
    if (!Array.isArray(body?.result))
      throw new Error(`${VENUE}: unexpected all_instruments response`);
    instruments = { fetchedAt: now, byName: tradableGrvtPerps(body.result) };
    return instruments.byName;
  }

  return {
    venueId: VENUE,
    // Undocumented window on `x-ratelimit-limit: 1500`; 100 tickers start over 10s.
    minIntervalMs: 100,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const live = await loadInstruments(client, now);
      for (const name of lastFetched.keys()) {
        if (!live.has(name)) lastFetched.delete(name);
      }
      // maxAge 0: pure rotation, never-fetched first, then oldest first.
      const batch = selectRefreshBatch([...live.keys()], lastFetched, now, budget, 0);
      for (const name of batch) lastFetched.set(name, { fetchedAt: now });

      const errors: unknown[] = [];
      // The client spaces request starts, so these queue rather than burst.
      const results = await Promise.all(
        batch.map(async (name) => {
          try {
            const body = await client.postJson<{ result?: GrvtTicker }>(`${GRVT_API}/ticker`, {
              instrument: name,
            });
            return parseGrvtTicker(live.get(name) as GrvtInstrument, body?.result, now);
          } catch (error) {
            errors.push(error);
            return null;
          }
        }),
      );
      const snapshots = results.filter((s): s is FundingSnapshot => s !== null);
      // A slice where every call failed is a failed cycle, not a venue with nothing to report.
      if (snapshots.length === 0 && errors.length > 0) {
        throw errors.find((e) => e instanceof CircuitOpenError) ?? errors[0];
      }
      return { snapshots, settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const live = await loadInstruments(client, Date.now());
      const instrument = live.get(venueSymbol);
      if (!instrument) return [];
      // Newest first; the cursor walks back through [start_time, end_time].
      const rows: GrvtFundingRow[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const body: { result?: GrvtFundingRow[]; next?: string } = await client.postJson(
          `${GRVT_API}/funding`,
          {
            instrument: venueSymbol,
            start_time: `${BigInt(Math.max(0, fromMs)) * NS_PER_MS}`,
            end_time: `${BigInt(Math.max(0, toMs)) * NS_PER_MS}`,
            limit: HISTORY_PAGE_SIZE,
            ...(cursor ? { cursor } : {}),
          },
        );
        const batch = body?.result;
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected funding response`);
        rows.push(...batch);
        if (batch.length < HISTORY_PAGE_SIZE || !body.next) break;
        cursor = body.next;
      }
      return parseGrvtFunding(rows, instrument, fromMs, toMs);
    },
  };
}

export const grvtAdapter: VenueAdapter = createGrvtAdapter();
