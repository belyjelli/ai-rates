import type { FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

const VENUE = "sodex";
export const SODEX_API = "https://mainnet-gw.sodex.dev/api/v1/perps";
const HOUR_MS = 3_600_000;
/** The only interval whose rate basis has been observed; see the header. */
const HOURLY_INTERVAL_SECONDS = 3600;
/** `markets/symbols` is ~106 KB and changes on listings and halts. */
const SYMBOLS_TTL_MS = HOUR_MS;

export interface SodexTicker {
  symbol: string;
  /** "Current funding rate": the running 1-hour estimate for `nextFundingTime`. */
  fundingRate?: string | null;
  /** Epoch ms. */
  nextFundingTime?: number | null;
  markPrice?: string | null;
  indexPrice?: string | null;
  /** Base units (the symbol's `stepSize` unit). */
  openInterest?: string | null;
  /** 24h volume in the quote coin (vUSDC). */
  quoteVolume?: string | null;
  bidPx?: string | null;
  /** Base units. */
  bidSz?: string | null;
  askPx?: string | null;
  askSz?: string | null;
}

export interface SodexSymbol {
  name: string;
  baseCoin?: string | null;
  quoteCoin?: string | null;
  /** "TRADING" or "HALT". */
  status: string;
  /** Seconds; "must be a multiple of 3600". */
  fundingInterval?: number | null;
  maxLeverage?: number | null;
}

interface SodexResponse<T> {
  code: number;
  data: T;
}

/** TRADING symbols on an hourly funding interval, by name. */
export function sodexTradable(symbols: readonly SodexSymbol[]): Map<string, SodexSymbol> {
  return new Map(
    symbols
      .filter((s) => s.status === "TRADING" && s.fundingInterval === HOURLY_INTERVAL_SECONDS)
      .map((s) => [s.name, s]),
  );
}

export function parseSodexSnapshots(
  tickers: readonly SodexTicker[],
  tradable: ReadonlyMap<string, SodexSymbol>,
  now: number,
): FundingSnapshot[] {
  const snapshots: FundingSnapshot[] = [];
  for (const row of tickers) {
    const symbol = tradable.get(row.symbol);
    const rate = num(row.fundingRate);
    if (!symbol || rate === null) continue;

    const markPrice = num(row.markPrice);
    const bestBid = num(row.bidPx);
    const bestAsk = num(row.askPx);
    const maxLeverage = num(symbol.maxLeverage);
    snapshots.push({
      // Parsed, not declared: `baseCoin` is the contract code, so 1000PEPE-USD declares "1000PEPE"
      // while the parser gives PEPE x1000, which is right — its mark 0.003369 equals Hyperliquid's
      // kPEPE. XAUt and SILVER reach XAUT and XAG either way.
      ...marketRef(VENUE, row.symbol, {
        // Every symbol declares `quoteCoin` vUSDC, SoDEX's own USDC on ValueChain. Kept as spelt.
        quote: symbol.quoteCoin ?? null,
      }),
      observedAt: now,
      rate,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: num(row.nextFundingTime),
      kind: "predicted",
      markPrice,
      indexPrice: num(row.indexPrice),
      // Base units x mark. BTC 772.14798 x 76,922 = $59.4M, inside its $100M `openInterestCapUSD`.
      openInterestUsd: mul(num(row.openInterest), markPrice),
      // Quote volume: BTC 1,410.21104 base x vwap 76,937.1968 = 108,497,684, as reported.
      volume24hUsd: num(row.quoteVolume),
      bestBid,
      bestBidSizeUsd: mul(num(row.bidSz), bestBid),
      bestAsk,
      bestAskSizeUsd: mul(num(row.askSz), bestAsk),
      ...(maxLeverage !== null ? { maxLeverage } : {}),
    });
  }
  return snapshots;
}

/**
 * SoDEX perps, measured from this machine on 2026-09-14 and read against
 * https://sodex.com/documentation (trading-api/rest-v1: perps API and schema; trading-mechanics/funding;
 * trading-api/api-rate-limits).
 *
 * - **One call a cycle**, plus `markets/symbols` hourly. `markets/tickers` answers every market with
 *   funding, next funding time, mark, index, OI, quote volume and top of book.
 * - **Hourly, and the rate is a 1-hour rate.** Docs: "Funding payments occur every hour", the 8-hour
 *   formula "is then divided by 8 to determine the hourly rate", and `interestRate` is the "8h interest
 *   rate; always 0.0001". `fundingInterval` is 3600 s on all 98 symbols and `nextFundingTime` was the
 *   next UTC hour on every TRADING market. Against Hyperliquid's hourly rates at 22:13–22:20 UTC: BTC
 *   0.0000075–0.0000092 vs 0.0000107–0.0000109, ETH 0.0000071–0.0000079 vs 0.0000125, ENA 0.0000104 vs
 *   0.0000125 — same scale, not 8x or 24x.
 *   The schema allows any multiple of 3600. Whether a 4h market would quote per hour or per interval
 *   has never been observable, so a non-hourly market is not collected rather than given a guessed
 *   basis.
 * - **Predicted.** Docs call `fundingRate` the "current funding rate", and it moves inside the hour:
 *   BTC read 0.0000074662 at 22:12, 0.0000081299 at 22:15 and 0.0000092374 at 22:20, all with the same
 *   `nextFundingTime`. No settled rate appears anywhere public.
 * - **Tradable**: status TRADING — 91 of 98 (HALT: BASED, BREV, NATGAS, TAO, TON, KIOXIA, SOSO; BASED
 *   and TON still appear in tickers with a stale June `nextFundingTime`).
 * - **Class: none declared, so crypto.** Checked on 2026-09-14: `markets/symbols`, `markets/coins` and
 *   the documented schema carry no category, and the web app's bundles hold no market-category map
 *   (unlike StandX's). About 30 of the 91 are tradfi listings (TSLA, AAPL, NVDA, US500, USTECH100, CL,
 *   SILVER, COPPER, EWY, ...) and are filed crypto for want of a declaration; migration 016's mark gate
 *   is what keeps them out of crypto pools they disagree with.
 * - **Quote** `quoteCoin`, vUSDC on all 98.
 * - **No funding history**: the documented public market endpoints are symbols, coins, tickers,
 *   miniTickers, mark-prices, bookTickers, orderbook, klines and trades; guessed funding paths 404.
 * - **Rate limit**: 1,200 weight per minute per IP; tickers and symbols weigh 2. 100 ms is ample.
 */
export function createSodexAdapter(): VenueAdapter {
  let symbols: { fetchedAt: number; tradable: Map<string, SodexSymbol> } | null = null;

  return {
    venueId: VENUE,
    minIntervalMs: 100,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      if (!symbols || now - symbols.fetchedAt >= SYMBOLS_TTL_MS) {
        const body = await client.getJson<SodexResponse<SodexSymbol[]>>(
          `${SODEX_API}/markets/symbols`,
        );
        if (body?.code !== 0 || !Array.isArray(body.data)) {
          throw new Error(`${VENUE}: unexpected markets/symbols response`);
        }
        symbols = { fetchedAt: now, tradable: sodexTradable(body.data) };
      }
      const tickers = await client.getJson<SodexResponse<SodexTicker[]>>(
        `${SODEX_API}/markets/tickers`,
      );
      if (tickers?.code !== 0 || !Array.isArray(tickers.data)) {
        throw new Error(`${VENUE}: unexpected markets/tickers response`);
      }
      return { snapshots: parseSodexSnapshots(tickers.data, symbols.tradable, now), settled: [] };
    },
  };
}

export const sodexAdapter: VenueAdapter = createSodexAdapter();
