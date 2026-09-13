import type { AssetClass, FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Nado (Vertex successor on Ink).
 *
 * REQUESTS: one per cycle, `GET archive /v2/contracts?edge=false` (every perp with funding, mark,
 * index, OI and volume inline), plus `GET gateway /v1/query?type=symbols` once an hour for each
 * market's `trading_status`. Queries draw on a per-IP budget of 2,400 weight a minute or 400 every 10s
 * (https://docs.nado.xyz/developer-resources/api/rate-limits); symbols weighs 2, funding history
 * 2 + limit/100. 100ms spacing cannot approach it. `edge=false` keeps volume and OI to this chain
 * ("when turned off, it only returns metrics for the current chain"); on 2026-09-13 both settings
 * returned identical BTC figures.
 *
 * ACCEPT-ENCODING: the gateway answers 403 `{"reason": "Invalid compression headers: 'Accept-Encoding'
 * must include 'gzip', 'br' or 'deflate'"}` without it (curl, 2026-09-13); the archive did not care.
 * `http.ts` already lets an adapter pass headers, and Bun's fetch still decompresses when the header is
 * set explicitly (measured: 200, `content-encoding: gzip`, JSON body). So every request sends
 * `accept-encoding: gzip` rather than relying on the runtime's default. No change to http.ts is needed.
 *
 * FUNDING: the contracts `funding_rate` is a 24-HOUR rate, and positive means longs pay. The field doc
 * (https://docs.nado.xyz/developer-resources/api/v2/contracts) says "Current 24hr funding rate. Can
 * compute hourly funding rate dividing by 24"; the funding doc (https://docs.nado.xyz/core/funding-rates)
 * computes an 8-hour F, settles F/8 every hour on the hour, and reports "the equivalent 24-hour rate --
 * three times the 8-hour rate (3F)"; non-crypto markets settle 1/24 of the same reported daily figure.
 * So the published number is kept over `basisHours` 24 and `intervalHours` is 1. It is `predicted`:
 * the archive's `funding_rate` query calls it "the latest predicted 24hr rate", and BTC moved from
 * 0.000110094 at 22:28 to 0.000103965 at 22:33 inside one hour. Checked live on 2026-09-13:
 * - quiet markets pin to the formula floor, NEAR and kPEPE 0.0003 = 3 x 0.0001, i.e. 0.0000125/h,
 *   Hyperliquid's own floor;
 * - BTC 0.000110/24 = 0.0000046/h (4.0% APR) against Hyperliquid 0.0000116/h (10.1%), ETH
 *   0.000145/24 = 0.0000060/h against 0.0000125; read as hourly it would be 96% APR for BTC;
 * - realized hourly settlements from `funding_rate_history` were 0.0000069 (22:00) and 0.0000033
 *   (21:00) for BTC, the same order as the predicted figure divided by 24;
 * - predicted against realized across the 23:00 settlement: the last reading at 22:59:33, divided by
 *   24, was BTC 0.00000490 against a realized 0.00000495, WTI -0.000135175 against -0.000134580 and
 *   ETH 0.00000212 against 0.00000193. At 23:00:30 the predicted figure had restarted for the next
 *   hour (BTC -0.000235 per day), so early-hour readings are the noisiest.
 *
 * UNITS, checked live: `open_interest_usd` is USD and equals `open_interest` (base) x mark
 * (BTC 215.3981 x 76,805.68 = $16.54M against 16,540,431). `quote_volume` is 24h volume in the quote
 * asset USDT0 (BTC $88.9M = 1,153.8 BTC x ~$77k). `next_funding_rate_timestamp` is unix SECONDS.
 *
 * TRADABILITY: contracts lists every perp, halted or not (82 on 2026-09-13). The gateway's
 * `trading_status` decides: 71 `live` are collected; 5 `post_only` (ANSEM, ARB, CASHCAT, PONS, USELESS),
 * 5 `not_tradable` (ADA, AXS, BERA, SKR, VIRTUAL) and 1 `soft_reduce_only` (PENG) are not.
 *
 * CLASS: the API declares none (contracts, symbols, all_products and v2 assets carry no category), but
 * Nado's documentation declares one per market, in the "Feed Reference" table of its oracle page
 * (https://docs.nado.xyz/llms-full.txt, "Type: Crypto, FX, Metals, Energy, US Equity, HK Equity,
 * xStock"). That declaration is copied into `NADO_DOCUMENTED_CLASSES` as it stood on 2026-09-13. A
 * market the table does not list declares nothing and is crypto, like every other venue's undeclared
 * listing, so a newly listed equity reads crypto until the table is refreshed. Of the 71 live markets on
 * 2026-09-13: crypto 40, equity 26 (25 US Equity with SPY and QQQ among them, plus HK Equity ZHIPU),
 * fx 3 (EURUSD, GBPUSD, USDJPY), commodity 2 (XAG Metals, WTI Energy). `premium_x18` is NOT a class
 * signal: it is absent on 34 markets, including crypto WLD, MEGA, SKR and CHIP, and present on HK
 * equity ZHIPU.
 *
 * QUOTE: USDT0, the `quote_currency` of every contract and the collateral funding is paid in
 * ("impacting a user's unsettled USDT0", https://docs.nado.xyz/core/funding-rates).
 *
 * BASE: the parser reads `BTC-PERP_USDT0` as BTC and agrees with `base_currency` minus `-PERP` on all
 * 82, except that it reads `kPEPE` and `kBONK` as PEPE and BONK x1000, which is what they are ("Thousand
 * Pepe Perp" in v2 assets). WTI reaches CL through core's alias, as it does for every venue.
 */

const VENUE = "nado";
export const NADO_ARCHIVE = "https://archive.prod.nado.xyz";
export const NADO_GATEWAY = "https://gateway.prod.nado.xyz/v1";
export const NADO_HEADERS: Record<string, string> = { "accept-encoding": "gzip" };
const QUOTE = "USDT0";
const RATE_BASIS_HOURS = 24;
const INTERVAL_HOURS = 1;
const SYMBOLS_TTL_MS = 3_600_000;
const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 50;

export interface NadoContract {
  product_id: number;
  ticker_id: string;
  base_currency: string;
  quote_currency?: string;
  product_type: string;
  mark_price?: number | null;
  index_price?: number | null;
  /** Base units. */
  open_interest?: number | null;
  open_interest_usd?: number | null;
  /** 24h volume in the quote asset (USDT0). */
  quote_volume?: number | null;
  /** Predicted 24-hour rate. */
  funding_rate?: number | null;
  /** Unix seconds. */
  next_funding_rate_timestamp?: number | null;
}

export interface NadoSymbol {
  type: string;
  product_id: number;
  symbol: string;
  trading_status: string;
}

export interface NadoSymbolsResponse {
  status: string;
  data: { symbols: Record<string, NadoSymbol> };
}

export interface NadoFundingHistoryResponse {
  funding_rates: { product_id: number; timestamp: string; funding_rate_x18: string }[];
}

/**
 * Per-market Type from Nado's oracle Feed Reference (https://docs.nado.xyz/llms-full.txt), 2026-09-13.
 * Only non-crypto rows are listed; the 50 Crypto perps (XAUT among them) need no entry.
 */
export const NADO_DOCUMENTED_CLASSES: Readonly<Record<string, AssetClass>> = {
  // US Equity (26)
  "AAPL-PERP": "equity",
  "AMD-PERP": "equity",
  "AMZN-PERP": "equity",
  "AVGO-PERP": "equity",
  "BBX-PERP": "equity",
  "CRCL-PERP": "equity",
  "DELL-PERP": "equity",
  "GOOGL-PERP": "equity",
  "HIMS-PERP": "equity",
  "INTC-PERP": "equity",
  "LLY-PERP": "equity",
  "META-PERP": "equity",
  "MRVL-PERP": "equity",
  "MSFT-PERP": "equity",
  "MSTR-PERP": "equity",
  "MU-PERP": "equity",
  "NBIS-PERP": "equity",
  "NVDA-PERP": "equity",
  "ORCL-PERP": "equity",
  "PENG-PERP": "equity",
  "QQQ-PERP": "equity",
  "SKHY-PERP": "equity",
  "SNDK-PERP": "equity",
  "SPCX-PERP": "equity",
  "SPY-PERP": "equity",
  "TSLA-PERP": "equity",
  // HK Equity (1)
  "ZHIPU-PERP": "equity",
  // FX (3)
  "EURUSD-PERP": "fx",
  "GBPUSD-PERP": "fx",
  "USDJPY-PERP": "fx",
  // Metals (1) and Energy (1)
  "XAG-PERP": "commodity",
  "WTI-PERP": "commodity",
};

/** The class Nado's docs declare for a perp symbol (`AAPL-PERP`); crypto when undeclared. */
export function nadoAssetClass(symbol: string): AssetClass {
  return NADO_DOCUMENTED_CLASSES[symbol] ?? "crypto";
}

function ref(contract: Pick<NadoContract, "ticker_id" | "base_currency">) {
  return marketRef(VENUE, contract.ticker_id, {
    quote: QUOTE,
    assetClass: nadoAssetClass(contract.base_currency),
  });
}

export function parseNadoSnapshots(
  contracts: Readonly<Record<string, NadoContract>>,
  symbols: Readonly<Record<string, NadoSymbol>>,
  now: number,
): FundingSnapshot[] {
  const snapshots: FundingSnapshot[] = [];
  for (const contract of Object.values(contracts)) {
    const status = symbols[contract.base_currency];
    const rate = num(contract.funding_rate);
    if (
      contract.product_type !== "perpetual" ||
      status?.type !== "perp" ||
      status.trading_status !== "live" ||
      rate === null
    ) {
      continue;
    }
    const nextSeconds = num(contract.next_funding_rate_timestamp);
    snapshots.push({
      ...ref(contract),
      observedAt: now,
      rate,
      basisHours: RATE_BASIS_HOURS,
      intervalHours: INTERVAL_HOURS,
      nextFundingAt: nextSeconds !== null && nextSeconds > 0 ? nextSeconds * 1000 : null,
      kind: "predicted",
      markPrice: num(contract.mark_price),
      indexPrice: num(contract.index_price),
      openInterestUsd: num(contract.open_interest_usd),
      volume24hUsd: num(contract.quote_volume),
    });
  }
  return snapshots;
}

/** Realized HOURLY settlements (x18 fixed point, unix seconds) within [fromMs, toMs], oldest first. */
export function parseNadoFundingHistory(
  rows: NadoFundingHistoryResponse["funding_rates"],
  contract: Pick<NadoContract, "ticker_id" | "base_currency">,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(contract);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const seconds = num(row.timestamp);
    const x18 = num(row.funding_rate_x18);
    if (seconds === null || x18 === null) continue;
    const settledAt = seconds * 1000;
    if (settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      // The docs call history "realized hourly rates ... multiply by 24 for the daily equivalent".
      rate: x18 / 1e18,
      basisHours: INTERVAL_HOURS,
      markPrice: null,
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export function createNadoAdapter(): VenueAdapter {
  let symbols: Record<string, NadoSymbol> | null = null;
  let symbolsFetchedAt = 0;
  /** ticker_id -> contract, for history, which is addressed by product_id. */
  const contractsByTicker = new Map<string, NadoContract>();

  async function fetchContracts(client: HttpClient): Promise<Record<string, NadoContract>> {
    const body = await client.getJson<Record<string, NadoContract>>(
      `${NADO_ARCHIVE}/v2/contracts?edge=false`,
      NADO_HEADERS,
    );
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error(`${VENUE}: unexpected contracts response`);
    }
    for (const contract of Object.values(body)) contractsByTicker.set(contract.ticker_id, contract);
    return body;
  }

  return {
    venueId: VENUE,
    minIntervalMs: 100,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      if (!symbols || now - symbolsFetchedAt >= SYMBOLS_TTL_MS) {
        const body = await client.getJson<NadoSymbolsResponse>(
          `${NADO_GATEWAY}/query?type=symbols`,
          NADO_HEADERS,
        );
        if (body?.status !== "success" || typeof body.data?.symbols !== "object") {
          throw new Error(`${VENUE}: unexpected symbols response`);
        }
        symbols = body.data.symbols;
        symbolsFetchedAt = now;
      }
      const contracts = await fetchContracts(client);
      return { snapshots: parseNadoSnapshots(contracts, symbols, now), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      if (!contractsByTicker.has(venueSymbol)) await fetchContracts(client);
      const contract = contractsByTicker.get(venueSymbol);
      if (!contract) return [];
      const rows: NadoFundingHistoryResponse["funding_rates"] = [];
      let startSeconds = Math.floor(fromMs / 1000);
      const endSeconds = Math.floor(toMs / 1000);
      for (let page = 0; page < HISTORY_MAX_PAGES && startSeconds <= endSeconds; page++) {
        const body = await client.postJson<NadoFundingHistoryResponse>(
          `${NADO_ARCHIVE}/v1`,
          {
            funding_rate_history: {
              product_id: contract.product_id,
              start_time: startSeconds,
              end_time: endSeconds,
              limit: HISTORY_PAGE_SIZE,
            },
          },
          NADO_HEADERS,
        );
        const batch = body?.funding_rates;
        if (!Array.isArray(batch)) throw new Error(`${VENUE}: unexpected funding_rate_history`);
        rows.push(...batch);
        if (batch.length < HISTORY_PAGE_SIZE) break;
        // Ascending: continue from one second past the newest row, as the docs prescribe.
        const newest = Math.max(...batch.map((r) => Number(r.timestamp)));
        if (!Number.isFinite(newest)) break;
        startSeconds = newest + 1;
      }
      return parseNadoFundingHistory(rows, contract, fromMs, toMs);
    },
  };
}

export const nadoAdapter: VenueAdapter = createNadoAdapter();
