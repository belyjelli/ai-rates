import {
  type AssetClass,
  canonicalBase,
  type FundingEvent,
  type FundingSnapshot,
  parseVenueSymbol,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE = "pacifica";
export const PACIFICA_API = "https://api.pacifica.fi/api/v1";
const HOUR_MS = 3_600_000;
/** Funding settles every hour and both published rates are 1-hour rates; see the header below. */
const FUNDING_HOURS = 1;
/** `/info` changes on listings and parameter edits only. */
const INFO_TTL_MS = HOUR_MS;
/**
 * Perps margin and settle in USDC: https://docs.pacifica.fi/trading-on-pacifica/unified-margin.md
 * defines cross equity as `usdc_balance + unrealized_pnl`, and the deposits page withdraws USDC. The
 * API itself names no settlement asset (symbols are bare: "BTC").
 */
const SETTLEMENT_QUOTE = "USDC";
/** The documented maximum page. Every history call costs the same 90 credits whatever the limit. */
const HISTORY_PAGE_SIZE = 4000;
const HISTORY_MAX_PAGES = 20;

export interface PacificaPrice {
  symbol: string;
  /** The rate fixed for the settlement at the next top of the hour; see the header. */
  funding?: string | null;
  /** The running estimate for the settlement after that. */
  next_funding?: string | null;
  mark?: string | null;
  oracle?: string | null;
  /** Base units, although the docs say USD; see the header. */
  open_interest?: string | null;
  /** USD. */
  volume_24h?: string | null;
}

export interface PacificaMarketInfo {
  symbol: string;
  base_asset?: string | null;
  /** "perpetual" or "spot". */
  instrument_type: string;
  max_leverage?: number | null;
}

export interface PacificaFundingRecord {
  /** "Last settled funding rate" as of `created_at`. */
  funding_rate: string;
  next_funding_rate?: string | null;
  /** Epoch ms, a few hundred ms after the hour it settled on. */
  created_at: number;
}

interface PacificaResponse<T> {
  success: boolean;
  data: T;
  next_cursor?: string | null;
  has_more?: boolean;
}

/**
 * The non-crypto classes Pacifica declares.
 *
 * WHY A TABLE, when class is meant to be declared: the API declares nothing (`/info` has
 * `instrument_type` and no category). Pacifica's web app does: module 77482 of its bundle at
 * https://app.pacifica.fi ships a symbol-to-tags map behind the market picker's category tabs (New,
 * Majors, L1/L2, DeFi, AI, Meme, Pre-Market, Equities, Commodities, FX). These are its Equities,
 * Commodities and FX entries, copied on 2026-09-14 — 38 of its 184, including symbols not yet listed.
 * Everything else it tags with a crypto sector, and a symbol it does not tag has declared nothing:
 * both are crypto.
 *
 * Of the 76 live perps the map files 14 as Equities, 8 as Commodities and 2 as FX; 10 recent listings
 * (PUMP WLFI ASTER XPL 2Z MON CHIP VVV PONS USELESS) are absent from it. PAXG is filed under
 * Commodities but stays crypto through the tokenised table; SP500 reaches US500 and so `index`. URNM,
 * a uranium-miners ETF, is filed as a commodity because that is what Pacifica says.
 */
export const PACIFICA_TRADFI_TAGS: Readonly<Record<string, "Equities" | "Commodities" | "FX">> = {
  ANTHROPIC: "Equities",
  NVDA: "Equities",
  TSLA: "Equities",
  GOOGL: "Equities",
  MSTR: "Equities",
  PLTR: "Equities",
  MSFT: "Equities",
  AMZN: "Equities",
  COIN: "Equities",
  HOOD: "Equities",
  META: "Equities",
  AAPL: "Equities",
  NFLX: "Equities",
  GME: "Equities",
  CRCL: "Equities",
  SP500: "Equities",
  SPCX: "Equities",
  SKHYNIX: "Equities",
  SAMSUNG: "Equities",
  MU: "Equities",
  DRAM: "Equities",
  SNDK: "Equities",
  PAXG: "Commodities",
  XAU: "Commodities",
  XAG: "Commodities",
  COPPER: "Commodities",
  CL: "Commodities",
  NATGAS: "Commodities",
  URNM: "Commodities",
  PLATINUM: "Commodities",
  EURUSD: "FX",
  USDKRW: "FX",
  NZDUSD: "FX",
  AUDUSD: "FX",
  USDJPY: "FX",
  USDCAD: "FX",
  USDCHF: "FX",
  GBPUSD: "FX",
};

export function pacificaAssetClass(symbol: string): AssetClass {
  switch (PACIFICA_TRADFI_TAGS[symbol]) {
    case "Equities":
      return "equity";
    case "Commodities":
      return "commodity";
    case "FX":
      return "fx";
    default:
      return "crypto";
  }
}

/**
 * The declared `base_asset`, where the symbol parser reads the symbol differently.
 *
 * Checked against all 77 rows on 2026-09-14: 73 agree. kBONK, kPEPE and kSHIB parse as BONK, PEPE and
 * SHIB at x1000, which is right (marks 0.002715, 0.00337, 0.005179 against Hyperliquid's kBONK,
 * kPEPE, kSHIB), so a scaled parse is kept. EURUSD parses as EUR against USD; the venue says the base
 * is EURUSD, which is what it passes.
 */
function pacificaBase(symbol: string, declared: string | null | undefined): string | undefined {
  if (!declared) return undefined;
  const parsed = parseVenueSymbol(symbol);
  return parsed.multiplier === 1 && parsed.base !== canonicalBase(declared) ? declared : undefined;
}

function pacificaRef(symbol: string, info: PacificaMarketInfo | undefined) {
  const base = pacificaBase(symbol, info?.base_asset);
  return marketRef(VENUE, symbol, {
    quote: SETTLEMENT_QUOTE,
    assetClass: pacificaAssetClass(symbol),
    ...(base !== undefined ? { base } : {}),
  });
}

/** Perpetuals from `/info`, by symbol. On 2026-09-14: 76 of 77 (SOL-USDC is spot). */
export function pacificaPerpetuals(
  info: readonly PacificaMarketInfo[],
): Map<string, PacificaMarketInfo> {
  return new Map(info.filter((m) => m.instrument_type === "perpetual").map((m) => [m.symbol, m]));
}

export function parsePacificaSnapshots(
  prices: readonly PacificaPrice[],
  perpetuals: ReadonlyMap<string, PacificaMarketInfo>,
  now: number,
): FundingSnapshot[] {
  const nextFundingAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const snapshots: FundingSnapshot[] = [];
  for (const row of prices) {
    const info = perpetuals.get(row.symbol);
    const rate = num(row.funding);
    if (!info || rate === null) continue;

    const markPrice = num(row.mark);
    const maxLeverage = num(info.max_leverage);
    snapshots.push({
      ...pacificaRef(row.symbol, info),
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(row.oracle),
      // Base units x mark, as Pacifica's own app computes it; see the header.
      openInterestUsd: mul(num(row.open_interest), markPrice),
      volume24hUsd: num(row.volume_24h),
      ...(maxLeverage !== null ? { maxLeverage } : {}),
    });
  }
  return snapshots;
}

/** Settled hourly rates within [fromMs, toMs], oldest first, from newest-first history records. */
export function parsePacificaFundingHistory(
  records: readonly PacificaFundingRecord[],
  venueSymbol: string,
  info: PacificaMarketInfo | undefined,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const ref = pacificaRef(venueSymbol, info);
  const bySettlement = new Map<number, FundingEvent>();
  for (const record of records) {
    const stamped = num(record.created_at);
    const rate = num(record.funding_rate);
    if (stamped === null || rate === null) continue;
    // Stamped ~0.4 s after the hour (1789336800497 is 22:00:00.497); the settlement is the hour.
    const settledAt = Math.floor(stamped / HOUR_MS) * HOUR_MS;
    if (settledAt < fromMs || settledAt > toMs) continue;
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

function expectData<T>(body: PacificaResponse<T> | null | undefined, what: string): T {
  if (!body?.success || !Array.isArray(body.data)) {
    throw new Error(`${VENUE}: unexpected ${what} response`);
  }
  return body.data;
}

/**
 * Pacifica, measured from this machine on 2026-09-14 and read against https://docs.pacifica.fi
 * (api/rest-api/markets get-prices, get-market-info and get-historical-funding; trading-on-pacifica
 * funding-rates; api/rate-limits).
 *
 * - **One call a cycle**, plus `/info` hourly. `/info/prices` answers all 77 markets.
 * - **Hourly, and both rates are 1-hour rates.** Docs: "At the end of each 1-hour interval, the
 *   average funding rate is taken and then applied", the formula divides the 8h premium-plus-interest
 *   by 8, and both API fields say "(hour)". History rows are 1h apart (3,990 of 3,999 gaps back to
 *   2026-03-30; the other 9 are 2h outages). Quiet markets (XPL, XAU, EURUSD) print 0.0000125, the
 *   hourly form of 0.01%/8h and Hyperliquid's hourly floor. Against Hyperliquid at 22:13–22:20 UTC:
 *   BTC 0.00000475 vs 0.0000107–0.0000109, ETH 0.00001202 vs 0.0000125 — same scale, not 8x or 24x.
 * - **Which rate is which.** Docs: the rate applied in hour H "is computed from market conditions in
 *   the previous hour". History records carry `funding_rate` ("last settled") and `next_funding_rate`
 *   ("predicted for next settlement"), and each record's `next_funding_rate` is exactly the following
 *   record's `funding_rate` (3,995 of 3,999 BTC pairs; the 4 exceptions are records written seconds
 *   late or after a missed hour). At 22:13, 22:15 and 22:20 the prices `funding` for BTC
 *   held at 0.00000475 — the 22:00 record's `next_funding_rate` — while `next_funding` moved
 *   (-0.00000336, -0.00000237, -0.00000219). So `funding` is the rate already fixed for the 23:00
 *   settlement, and `next_funding` is the running estimate for 00:00.
 *   **Confirmed across the 23:00 settlement.** Prices read every five minutes from 22:15 to 22:59
 *   held BTC `funding` at 0.00000475; the 23:00 history record then settled exactly 0.00000475, and
 *   the same held for ETH 0.00001202, SOL -0.00000177, NVDA 0.0000125 and kBONK -0.00000345 (5 of 5).
 *   At 23:04 `funding` had become the last estimate, now fixed for 00:00 (BTC 0.00000288 against a
 *   22:59 `next_funding` of 0.00000281; ETH 0.00000199 against 0.0000023), and `next_funding` had
 *   restarted (BTC 0.0000125). The snapshot carries `funding`,
 *   as the rate of the next settlement at the next top of the hour: it has not settled, so it is
 *   `predicted`, and it is the same settlement every other hourly venue's snapshot describes.
 *   The docs' prices page calls `funding` the rate "paid in the past funding epoch"; the history
 *   records contradict that reading (22:00 settled 0.00000383, not 0.00000475).
 * - **Open interest is base units, whatever the docs say.** The prices page calls `open_interest`
 *   USD, but BTC's is 412.34157 beside $158.6M of daily volume; as base units it is $31.7M. Pacifica's
 *   own app renders the Open Interest column as `open_interest x mark`, and so does this.
 * - **Tradable**: `instrument_type` perpetual — 76 of 77 (SOL-USDC is spot). There is no status field.
 * - **Class** from the web app's tag map; see `PACIFICA_TRADFI_TAGS`. **Quote** USDC; see
 *   `SETTLEMENT_QUOTE`. **Bases**: see `pacificaBase`.
 * - **History**: `/funding_rate/history?symbol=&limit=&cursor=`, newest first, no time filter.
 * - **Rate limit**: the docs give unauthenticated IPs 100 credits a minute; this machine is served
 *   `ratelimit-policy: "credits";q=1000;w=60`. Measured costs: `/info/prices` and `/info` 10 credits,
 *   `/funding_rate/history` 90 at any limit. 6 s spacing holds history paging to ~900 credits a minute.
 */
export function createPacificaAdapter(): VenueAdapter {
  let info: { fetchedAt: number; perpetuals: Map<string, PacificaMarketInfo> } | null = null;

  async function loadInfo(client: HttpClient, now: number) {
    if (!info || now - info.fetchedAt >= INFO_TTL_MS) {
      const body = await client.getJson<PacificaResponse<PacificaMarketInfo[]>>(
        `${PACIFICA_API}/info`,
      );
      info = { fetchedAt: now, perpetuals: pacificaPerpetuals(expectData(body, "info")) };
    }
    return info.perpetuals;
  }

  return {
    venueId: VENUE,
    minIntervalMs: 6_000,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const perpetuals = await loadInfo(client, now);
      const body = await client.getJson<PacificaResponse<PacificaPrice[]>>(
        `${PACIFICA_API}/info/prices`,
      );
      return {
        snapshots: parsePacificaSnapshots(expectData(body, "info/prices"), perpetuals, now),
        settled: [],
      };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      // Only the declared base is needed, and any copy of `/info` has it.
      const perpetuals = info?.perpetuals ?? (await loadInfo(client, Date.now()));
      const records: PacificaFundingRecord[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const params = new URLSearchParams({
          symbol: venueSymbol,
          limit: String(HISTORY_PAGE_SIZE),
        });
        if (cursor) params.set("cursor", cursor);
        const body = await client.getJson<PacificaResponse<PacificaFundingRecord[]>>(
          `${PACIFICA_API}/funding_rate/history?${params}`,
        );
        const batch = expectData(body, "funding_rate/history");
        records.push(...batch);
        const oldest = Math.min(...batch.map((r) => r.created_at));
        cursor = body.next_cursor || null;
        if (!body.has_more || !cursor || batch.length < HISTORY_PAGE_SIZE || oldest <= fromMs)
          break;
      }
      return parsePacificaFundingHistory(
        records,
        venueSymbol,
        perpetuals.get(venueSymbol),
        fromMs,
        toMs,
      );
    },
  };
}

export const pacificaAdapter: VenueAdapter = createPacificaAdapter();
