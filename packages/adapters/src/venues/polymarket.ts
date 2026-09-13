import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Polymarket Perps (https://docs.polymarket.com/perps/overview).
 *
 * REQUESTS: two per cycle, `GET /v1/info/tickers` (funding, mark, index, open interest) and
 * `GET /v1/info/statistics` (24h volume, ~115 KB with its hourly klines), plus
 * `GET /v1/info/instruments` once an hour for type, category, base and quote. The OpenAPI document
 * (https://docs.polymarket.com/api-spec/perps-openapi.json) weighs tickers, statistics and instruments
 * at 2 and funding history at 10 against a per-IP token bucket whose size it does not publish; 429s
 * carry Retry-After, which `http.ts` honours. 250ms spacing keeps a cycle well under any sane bucket.
 *
 * FUNDING: hourly, as a fraction, positive means longs pay. The funding doc
 * (https://docs.polymarket.com/perps/learn-about-trading/funding) samples a premium every 5s, averages
 * it over the 1-hour charge window, runs it through an 8-hour formula and divides by 8: "FR_hour =
 * clamp(F_8h / 8, +/-0.04)", settled "once at the end" of the hour. The ticker's `funding_rate` is the
 * rolling rate for the open window, so it is `predicted` over a 1-hour basis. Measured 2026-09-13:
 * WTIOIL read -0.00012782 at 22:28 and -0.00012987 at 22:33 (SOL -0.00001224 then -0.00001029), while
 * the 22:00 settlement in `/v1/info/funding` was -0.000006. Quiet crypto markets sit on the formula's
 * floor, 0.0001 / 8 = 0.0000125, and non-crypto on half of it (scale 0.5): 0.00000625, exactly what
 * SP500, GOLD and MSFT read. Across the 23:00 settlement the last ticker reading (22:59:33) against the
 * realized 23:00 row: WTIOIL -0.00012019 against -0.00011994, MSTR -0.00029609 against -0.00029526,
 * SOL -0.00000513 against -0.00000512. Cross-checked against Hyperliquid the same minute: BTC 0.0000125/h
 * (10.95% APR) against 0.0000115667, ETH 0.0000125 against 0.0000125. A 24x basis error would show
 * as 263% APR on a flat book.
 *
 * INTERVAL: `funding_interval` is "1h" on all 83 instruments, and `next_funding` (epoch ms) was the
 * top of the next hour on every ticker.
 *
 * UNITS: `open_interest` is in contracts ("Open interest in number of contracts", OpenAPI; the prose
 * doc's "total notional" is wrong, BTC reads 114.138), and a contract is one unit of base: the hourly
 * kline quantities in `statistics` times their prices sum to the reported USD volume (SILVER 11,396.5
 * x ~$64.1 = $730k against 730,943; ETH 2,677.6 x ~$2,500 against $6.97M). So OI USD = contracts x
 * mark (BTC 114.138 x 76,770 = $8.76M). `statistics.volume` is described as "volume in contracts" but
 * is USD notional by that same check (BTC 1,853,965 against 20.0 BTC traded), so it is taken as USD.
 * Tickers carry no volume field despite the prose doc listing an optional `volume_24h`.
 *
 * WHAT INSTRUMENTS TRACK: every instrument is `instrument_type` "perpetual" with category crypto,
 * index, equity or commodity. The FAQ is explicit that perps are not prediction markets: "there is no
 * event resolution and no $0/$1 settlement ... your position's value moves with the underlying asset's
 * price". None of the 83 is an event contract, so none is excluded on that ground. `/v1/info/index`
 * publishes no constituents (empty for all 18 assets queried), so the tracked asset is read from the
 * instrument and the price: SPCX (SpaceX, pre-IPO), CXMT, KIOXIA are private or foreign equities.
 *
 * CLASS, declared by `category`. On 2026-09-13 the 83 declared crypto 37, equity 39, commodity 4 (GOLD,
 * SILVER, WTIOIL, BRENTOIL) and index 3 (SP500, NAS100, DRAM); after core's index table files the DRAM
 * ETF as equity, snapshots carry crypto 37, equity 40, commodity 4, index 2. Three of the "equity" rows
 * are memecoins:
 * PONS (Pons launchpad token) at 0.5553, CASHCAT (Cash Cat) at 0.1624 and USELESS (Useless Coin) at
 * 0.2167, matching their Robinhood Chain / Solana DEX prices and listed as crypto by Hyperliquid and by
 * Nado's own oracle table. They are kept with the class Polymarket declares, because the rule is the
 * declaration and not the ticker; the consequence is that they do not pool with crypto PONS elsewhere.
 *
 * TRADABILITY: `instrument_type` perpetual, present in both instruments and tickers, with a numeric
 * rate. Polymarket publishes no status; `ui_live_time` is documented as "advisory display timestamp".
 * On 2026-09-13 all 83 instruments had a ticker and all were collected.
 *
 * QUOTE: PUSD. Every instrument declares `quote_asset` "pUSD", `/v1/info/assets` lists pUSD as the sole
 * collateral, and fees and funding settle in it (https://docs.polymarket.com/perps/fund-your-account).
 *
 * BASE: `base_asset` is declared. The parser agrees with it on 82 of 83; GOOG-USD declares GOOGL
 * (index 337.62, the Class A line), so the declaration is passed there. KPEPE-USD and KSHIB-USD are
 * thousand-unit contracts (0.003347 against PEPE ~0.0000033) whose uppercase K the parser does not read
 * as a multiplier and the venue does not declare as one; they are left as KPEPE and KSHIB.
 */

const VENUE = "polymarket";
export const POLYMARKET_API = "https://api.perpetuals.polymarket.com/v1/info";
const FUNDING_BASIS_HOURS = 1;
const QUOTE = "PUSD";
const INSTRUMENTS_TTL_MS = 3_600_000;
/** `/v1/info/funding` returns at most 100 rows per call, newest first, with a `more` flag. */
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 100;

export interface PolymarketInstrument {
  instrument_id: number;
  instrument_type: string;
  category?: string | null;
  symbol: string;
  base_asset?: string | null;
  quote_asset?: string | null;
  /** e.g. "1h". */
  funding_interval?: string | null;
  max_leverage?: number | null;
  ui_live_time?: number | null;
}

export interface PolymarketTicker {
  instrument_id: number;
  symbol: string;
  index_price?: string | null;
  mark_price?: string | null;
  /** Contracts, one base unit each. */
  open_interest?: string | null;
  /** Rolling hourly rate for the open charge window. */
  funding_rate?: string | null;
  /** Epoch ms of the next settlement. */
  next_funding?: number | null;
}

export interface PolymarketStatistic {
  instrument_id: number;
  symbol: string;
  /** 24h USD notional (the schema says contracts; see header). */
  volume?: string | null;
}

export interface PolymarketFundingPage {
  data: { funding_rate: string; timestamp: number }[];
  more: boolean;
}

/**
 * The class Polymarket declares in `category`: crypto, index, equity or commodity (OpenAPI enum).
 *
 * `index` is passed as index for `marketRef` to settle against core's table, so DRAM (an ETF) lands on
 * equity while SP500 and NAS100 stay index. A future non-crypto value falls to `classifyNonCrypto`.
 */
export function polymarketAssetClass(
  category: string | null | undefined,
  base: string,
): AssetClass {
  switch (category?.trim().toLowerCase() ?? "") {
    case "":
    case "crypto":
      return "crypto";
    case "equity":
      return "equity";
    case "index":
      return "index";
    case "commodity":
      return "commodity";
    default:
      return classifyNonCrypto(base);
  }
}

/** "1h" -> 1, "8h" -> 8; null for anything else. */
export function polymarketIntervalHours(interval: string | null | undefined): number | null {
  const match = /^(\d+)h$/.exec(interval?.trim() ?? "");
  const hours = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

function ref(instrument: PolymarketInstrument) {
  const parsed = marketRef(VENUE, instrument.symbol);
  const declared = instrument.base_asset?.trim();
  const base = declared && canonicalBase(declared) !== parsed.base ? declared : parsed.base;
  const resolved = marketRef(VENUE, instrument.symbol, { base });
  return marketRef(VENUE, instrument.symbol, {
    base,
    quote: QUOTE,
    assetClass: polymarketAssetClass(instrument.category, resolved.base),
  });
}

export function parsePolymarketSnapshots(
  instruments: readonly PolymarketInstrument[],
  tickers: readonly PolymarketTicker[],
  statistics: readonly PolymarketStatistic[],
  now: number,
): FundingSnapshot[] {
  const byId = new Map(instruments.map((i) => [i.instrument_id, i]));
  const volumes = new Map(statistics.map((s) => [s.instrument_id, num(s.volume)]));
  const snapshots: FundingSnapshot[] = [];
  for (const ticker of tickers) {
    const instrument = byId.get(ticker.instrument_id);
    const rate = num(ticker.funding_rate);
    if (instrument?.instrument_type !== "perpetual" || rate === null) continue;

    const markPrice = num(ticker.mark_price);
    const next = num(ticker.next_funding);
    snapshots.push({
      ...ref(instrument),
      observedAt: now,
      rate,
      basisHours: FUNDING_BASIS_HOURS,
      intervalHours: polymarketIntervalHours(instrument.funding_interval),
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(ticker.index_price),
      openInterestUsd: mul(num(ticker.open_interest), markPrice),
      volume24hUsd: volumes.get(ticker.instrument_id) ?? null,
      maxLeverage: num(instrument.max_leverage),
    });
  }
  return snapshots;
}

/** Hourly settlements within [fromMs, toMs], oldest first. Timestamps keep their ~100ms run jitter. */
export function parsePolymarketFunding(
  rows: readonly { funding_rate: string; timestamp: number }[],
  instrument: PolymarketInstrument,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(instrument);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = num(row.timestamp);
    const rate = num(row.funding_rate);
    if (settledAt === null || rate === null || settledAt < fromMs || settledAt > toMs) continue;
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

export function createPolymarketAdapter(): VenueAdapter {
  let instruments: PolymarketInstrument[] | null = null;
  let instrumentsFetchedAt = 0;

  async function loadInstruments(client: HttpClient, now: number): Promise<PolymarketInstrument[]> {
    if (!instruments || now - instrumentsFetchedAt >= INSTRUMENTS_TTL_MS) {
      const body = await client.getJson<PolymarketInstrument[]>(`${POLYMARKET_API}/instruments`);
      if (!Array.isArray(body)) throw new Error(`${VENUE}: unexpected instruments response`);
      instruments = body;
      instrumentsFetchedAt = now;
    }
    return instruments;
  }

  return {
    venueId: VENUE,
    minIntervalMs: 250,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const listed = await loadInstruments(client, now);
      const tickers = await client.getJson<PolymarketTicker[]>(`${POLYMARKET_API}/tickers`);
      if (!Array.isArray(tickers)) throw new Error(`${VENUE}: unexpected tickers response`);
      const statistics = await client.getJson<PolymarketStatistic[]>(
        `${POLYMARKET_API}/statistics`,
      );
      if (!Array.isArray(statistics)) throw new Error(`${VENUE}: unexpected statistics response`);
      return {
        snapshots: parsePolymarketSnapshots(listed, tickers, statistics, now),
        settled: [],
      };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const listed = await loadInstruments(client, Date.now());
      const instrument = listed.find((i) => i.symbol === venueSymbol);
      if (!instrument) return [];
      const rows: PolymarketFundingPage["data"] = [];
      let endMs = toMs;
      for (let page = 0; page < HISTORY_MAX_PAGES && endMs >= fromMs; page++) {
        const url = `${POLYMARKET_API}/funding?instrument_id=${instrument.instrument_id}&start_timestamp=${fromMs}&end_timestamp=${endMs}`;
        const body = await client.getJson<PolymarketFundingPage>(url);
        if (!Array.isArray(body?.data)) throw new Error(`${VENUE}: unexpected funding response`);
        rows.push(...body.data);
        const oldest = Math.min(...body.data.map((r) => r.timestamp));
        if (!body.more || body.data.length < HISTORY_PAGE_SIZE || !Number.isFinite(oldest)) break;
        endMs = oldest - 1;
      }
      return parsePolymarketFunding(rows, instrument, fromMs, toMs);
    },
  };
}

export const polymarketAdapter: VenueAdapter = createPolymarketAdapter();
