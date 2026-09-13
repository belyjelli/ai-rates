import type { AssetClass, FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

export const LIGHTER_API = "https://mainnet.zklighter.elliot.ai/api/v1";
/** The Robinhood Chain deployment: the same API, its own markets, book and settlement currency. */
export const LIGHTER_RH_API = "https://api.rh.lighter.xyz/api/v1";

const HOUR_MS = 3_600_000;
const HISTORY_PAGE_SIZE = 750;

/**
 * What every Lighter perp settles in. The API declares no per-perp quote: `orderBookDetails` gives
 * every perp `quote_asset_id` 0, which names no asset (`assetDetails` numbers USDC 3, and spot
 * markets do carry 3). The docs name one settlement currency for all perps, as read on 2026-09-14:
 *
 * - https://docs.lighter.xyz/trading/pnl-and-total-account-value -- realized PnL is "the difference
 *   in USDC value" between entry and exit, and funding payments are applied to realized PnL.
 * - https://docs.lighter.xyz/trading/multi-asset-margin -- "USDC (Lighter) and USDG (Robinhood Chain
 *   Lighter) remain the base collateral". ETH and XAUT can back margin, discounted, but PnL and
 *   funding still land in USDC.
 *
 * LIGHTER_API is the Lighter (Ethereum) deployment, so USDC. The Robinhood Chain deployment quotes
 * USDG instead; see LIGHTER_RH.
 */
const LIGHTER_QUOTE = "USDC";

/**
 * The class Lighter declares for each non-crypto market, by Lighter symbol. Absent means crypto.
 *
 * Lighter's API declares no class, so this is transcribed from what the venue publishes elsewhere,
 * as it stood on 2026-09-14:
 *
 * 1. The RWA market-specifications table, whose per-market Type is authoritative for the 73 markets
 *    it lists: https://docs.lighter.xyz/trading/real-world-assets-rwas/market-specifications
 *    `bond` is filed as index and `pre-ipo equity` as equity.
 * 2. For the 34 order-book markets that table omits, the token config bundled in the web app at
 *    https://app.lighter.xyz: `asset_type` RWA, then its categories in this order -- STOCK, PRE_IPO
 *    and ETF are equity, COMMODITIES commodity, FX and KRW fx, BONDS and COMPUTE index, and an RWA
 *    with no category beyond NEW is equity.
 *
 * Decisions beyond those sources: QNT is Quantinuum stock, whatever the config's name "Quant" says --
 * it marked 48.79, against OKX's Quantinuum at 48.85 and the Quant token at 64.3. BB is BlackBerry
 * (7.72) and WEN is Wendy's. USDHKD is fx per the docs, though the config calls it CRYPTO. PAXG is
 * absent although the config files it under COMMODITIES: it is a gold token, crypto on every venue.
 * AI (Artificial Inu) and SPX (SPX6900) are crypto and absent.
 *
 * A new RWA listing is crypto until it is added here. Meanwhile migration 016's mark gate still keeps
 * it out of a crypto pool whose price it does not share.
 */
export const LIGHTER_ASSET_CLASSES: ReadonlyMap<string, AssetClass> = new Map([
  ["AAOI", "equity"],
  ["AAPL", "equity"],
  ["AMD", "equity"],
  ["AMZN", "equity"],
  ["ANTHROPIC", "equity"],
  ["ARM", "equity"],
  ["ASML", "equity"],
  ["AUDUSD", "fx"],
  ["AVGO", "equity"],
  ["AXTI", "equity"],
  ["BABA", "equity"],
  ["BB", "equity"],
  ["BE", "equity"],
  ["BMNR", "equity"],
  ["BOT", "equity"],
  ["BOTZ", "index"],
  ["BRENTOIL", "commodity"],
  ["BYD", "equity"],
  ["CBRS", "equity"],
  ["COIN", "equity"],
  ["CRCL", "equity"],
  ["CRWV", "equity"],
  ["CXMT", "equity"],
  ["DELL", "equity"],
  ["DIA", "index"],
  ["DRAM", "index"],
  ["EURUSD", "fx"],
  ["EWY", "index"],
  ["GBPUSD", "fx"],
  ["GEV", "equity"],
  ["GME", "equity"],
  ["GOOGL", "equity"],
  ["H100", "index"],
  ["HANMI", "equity"],
  ["HOOD", "equity"],
  ["HYUNDAI", "equity"],
  ["HYUNDAIUSD", "equity"],
  ["IBM", "equity"],
  ["INTC", "equity"],
  ["IWM", "index"],
  ["KIOXIA", "equity"],
  ["KORU", "equity"],
  ["KRCOMP", "equity"],
  ["LITE", "equity"],
  ["MAGS", "index"],
  ["META", "equity"],
  ["MINIMAX", "equity"],
  ["MRNA", "equity"],
  ["MRVL", "equity"],
  ["MSFT", "equity"],
  ["MSTR", "equity"],
  ["MU", "equity"],
  ["NATGAS", "commodity"],
  ["NBIS", "equity"],
  ["NOK", "equity"],
  ["NOW", "equity"],
  ["NVDA", "equity"],
  ["NZDUSD", "fx"],
  ["OPENAI", "equity"],
  ["ORCL", "equity"],
  ["PLTR", "equity"],
  ["POPMART", "equity"],
  ["QCOM", "equity"],
  ["QNT", "equity"],
  ["QQQ", "index"],
  ["RKLB", "equity"],
  ["SAMSUNG", "equity"],
  ["SAMSUNGUSD", "equity"],
  ["SHEIN", "equity"],
  ["SKHY", "equity"],
  ["SKHYNIX", "equity"],
  ["SKHYNIXUSD", "equity"],
  ["SMIC", "equity"],
  ["SNDK", "equity"],
  ["SOXL", "index"],
  ["SOXS", "equity"],
  ["SOXX", "equity"],
  ["SPACEX", "equity"],
  ["SPCX", "equity"],
  ["SPY", "index"],
  ["STABLECOINX", "equity"],
  ["STRC", "equity"],
  ["TENCENT", "equity"],
  ["TSLA", "equity"],
  ["TSM", "equity"],
  ["TTWO", "equity"],
  ["UNITREE", "equity"],
  ["URA", "equity"],
  ["US100", "index"],
  ["US10Y", "index"],
  ["US500", "index"],
  ["USDCAD", "fx"],
  ["USDCHF", "fx"],
  ["USDHKD", "fx"],
  ["USDJPY", "fx"],
  ["USDKRW", "fx"],
  ["WDC", "equity"],
  ["WEN", "equity"],
  ["WHEAT", "commodity"],
  ["WTI", "commodity"],
  ["XAG", "commodity"],
  ["XAU", "commodity"],
  ["XCU", "commodity"],
  ["XIAOMI", "equity"],
  ["XPD", "commodity"],
  ["XPT", "commodity"],
  ["ZHIPU", "equity"],
]);

/** One Lighter deployment: the same API and funding engine, its own book, currency and listings. */
export interface LighterDeployment {
  venueId: string;
  api: string;
  /** Settlement currency of every perp on the deployment. */
  quote: string;
  /** Declared class by Lighter symbol; absent means crypto. */
  assetClasses: ReadonlyMap<string, AssetClass>;
}

export const LIGHTER_MAINNET: LighterDeployment = {
  venueId: "lighter",
  api: LIGHTER_API,
  quote: LIGHTER_QUOTE,
  assetClasses: LIGHTER_ASSET_CLASSES,
};

/**
 * The class declared for each non-crypto market on Robinhood Chain Lighter, by symbol. Absent means
 * crypto, or undeclared.
 *
 * Built for this deployment rather than borrowed from LIGHTER_ASSET_CLASSES: it lists 57 perps of its
 * own (14 of them not on mainnet), and its API declares no class either. Sources, as read 2026-09-14:
 *
 * 1. The token config bundled in https://app.lighter.xyz, which is also the Robinhood Chain front end
 *    (its `robinhood_chain` network switch). It declares 43 of the 57: 29 `asset_type` RWA and 14
 *    CRYPTO. Categories map as for mainnet -- STOCK and PRE_IPO equity, COMMODITIES commodity.
 * 2. Where https://docs.lighter.xyz/trading/real-world-assets-rwas/market-specifications types the
 *    same ticker, its Type is used: SPY, QQQ and SOXL are `index` there (core files them as equity).
 *
 * The shared tickers are the same underlyings on both deployments: of 43 symbols listed on both, marks
 * agreed within 0.6% on 2026-09-14, except the internally priced pre-IPO OPENAI (2.7%) and ANTHROPIC
 * (1.9%) and BE (5.2%, both Bloom Energy).
 *
 * UNDECLARED, so crypto here until Lighter publishes them: ASTS, AMC, CLSK, IREN, LUNR, QBTS, RGTI,
 * SGOV, SLV, SMCI, SOFI, USAR, USO and WULF. They are RH-only listings, absent from both the token
 * config and the RWA docs. Migration 016's mark gate keeps each out of any crypto pool it does not
 * price like.
 */
export const LIGHTER_RH_ASSET_CLASSES: ReadonlyMap<string, AssetClass> = new Map([
  ["AAPL", "equity"],
  ["AMD", "equity"],
  ["AMZN", "equity"],
  ["ANTHROPIC", "equity"],
  ["BABA", "equity"],
  ["BE", "equity"],
  ["COIN", "equity"],
  ["CRCL", "equity"],
  ["CRWV", "equity"],
  ["GOOGL", "equity"],
  ["INTC", "equity"],
  ["META", "equity"],
  ["MSFT", "equity"],
  ["MU", "equity"],
  ["NVDA", "equity"],
  ["OPENAI", "equity"],
  ["ORCL", "equity"],
  ["PLTR", "equity"],
  ["QQQ", "index"],
  ["SHEIN", "equity"],
  ["SKHY", "equity"],
  ["SNDK", "equity"],
  ["SOXL", "index"],
  ["SPCX", "equity"],
  ["SPY", "index"],
  ["TSLA", "equity"],
  ["TSM", "equity"],
  ["XAG", "commodity"],
  ["XAU", "commodity"],
]);

/**
 * Robinhood Chain Lighter (catalog id `lighter-rh`): the same API, funding engine and rate limit.
 *
 * FUNDING is mainnet's: an 8-hour rate paid 1/8 hourly. The per-market funding parameters are
 * identical (BTC and ETH `funding_premium_multiplier` 100, clamps 0.05/4.0, `base_interest_rate` 0.01;
 * AAPL 50 and 0.0032), and the units check out live: ETH's `funding-rates` 0.000096 / 8 = 0.000012/h
 * equals its hourly `fundings` rows of 0.0012%. Against Hyperliquid, same minute: ETH 0.000012/h here,
 * 0.0000125/h there; an hourly misreading would be 8x. BTC read 0.000024-0.000032 (0.000003-0.000004/h)
 * while Hyperliquid's BTC was 0.0000117/h -- a lower premium, not a basis factor.
 *
 * TRADABILITY: 57 perps, all `active`, on 2026-09-14; its 27 spot books (`AAPL/USDG`...) are not perps.
 *
 * RATE LIMIT: 60 requests per rolling minute for standard accounts
 * (https://apidocs.rh.lighter.xyz/docs/rate-limits), as on mainnet.
 *
 * QUOTE: USDG. "USDC (Lighter) and USDG (Robinhood Chain Lighter) remain the base collateral"
 * (https://docs.lighter.xyz/trading/multi-asset-margin), its `assetDetails` lists USDG and no USDC,
 * and every spot book is quoted in USDG. Perps again declare `quote_asset_id` 0.
 *
 * BASE: every symbol is a bare ticker that the parser returns unchanged.
 */
export const LIGHTER_RH: LighterDeployment = {
  venueId: "lighter-rh",
  api: LIGHTER_RH_API,
  quote: "USDG",
  assetClasses: LIGHTER_RH_ASSET_CLASSES,
};

export interface LighterFundingRate {
  market_id: number;
  exchange: string;
  symbol: string;
  rate: number;
}

export interface LighterOrderBookDetail {
  market_id: number;
  symbol: string;
  market_type: string;
  status: string;
  mark_price?: string | number | null;
  index_price?: string | number | null;
  open_interest?: string | number | null;
  daily_quote_token_volume?: string | number | null;
}

export interface LighterFunding {
  timestamp: number;
  value?: string;
  rate: string;
  direction: string;
}

export interface LighterFundingRates {
  funding_rates: LighterFundingRate[];
}

export interface LighterOrderBookDetails {
  order_book_details: LighterOrderBookDetail[];
}

export interface LighterFundings {
  fundings: LighterFunding[];
}

/**
 * Normalizes `funding-rates` joined with `orderBookDetails`. Lighter pays funding every hour; its
 * formula computes an 8-hour rate and pays 1/8 of it each hour, and `funding-rates` reports that
 * 8-hour rate as a fraction (the same response's relayed rows are 8h too: Binance's row equals
 * Binance's 8h rate and Hyperliquid's is 8x its hourly rate). Relayed rows are dropped.
 */
export function parseLighterSnapshots(
  rates: LighterFundingRates,
  details: LighterOrderBookDetails,
  now: number,
  deployment: LighterDeployment = LIGHTER_MAINNET,
): FundingSnapshot[] {
  const live = new Map(
    details.order_book_details
      .filter((d) => d.market_type === "perp" && d.status === "active")
      .map((d) => [d.market_id, d]),
  );
  const nextFundingAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const snapshots: FundingSnapshot[] = [];

  for (const row of rates.funding_rates) {
    const detail = live.get(row.market_id);
    const rate = num(row.rate);
    if (row.exchange !== "lighter" || !detail || rate === null) continue;

    const markPrice = num(detail.mark_price);
    snapshots.push({
      ...marketRef(deployment.venueId, row.symbol, {
        quote: deployment.quote,
        assetClass: deployment.assetClasses.get(row.symbol) ?? "crypto",
      }),
      observedAt: now,
      rate,
      basisHours: 8,
      intervalHours: 1,
      nextFundingAt,
      kind: "predicted",
      markPrice,
      indexPrice: num(detail.index_price),
      openInterestUsd: mul(num(detail.open_interest), markPrice),
      volume24hUsd: num(detail.daily_quote_token_volume),
    });
  }
  return snapshots;
}

/**
 * Normalizes `fundings` (1h resolution) into settled hourly payments, oldest first. Unlike
 * `funding-rates`, `rate` here is an unsigned hourly rate in percent, rounded to 4 decimals, with
 * `direction` naming the side that paid ("long" means longs paid, i.e. a positive rate).
 */
export function parseLighterFundings(
  venueSymbol: string,
  payload: LighterFundings,
  deployment: LighterDeployment = LIGHTER_MAINNET,
): FundingEvent[] {
  const events: FundingEvent[] = [];
  for (const row of payload.fundings) {
    const percent = num(row.rate);
    if (percent === null || !Number.isFinite(row.timestamp)) continue;
    const sign = row.direction === "short" ? -1 : 1;
    events.push({
      ...marketRef(deployment.venueId, venueSymbol, { quote: deployment.quote }),
      settledAt: row.timestamp * 1000,
      rate: (sign * percent) / 100,
      basisHours: 1,
      markPrice: null,
    });
  }
  return events.sort((a, b) => a.settledAt - b.settledAt);
}

export function createLighterAdapter(
  deployment: LighterDeployment = LIGHTER_MAINNET,
): VenueAdapter {
  const api = deployment.api;
  const marketIds = new Map<string, number>();

  async function marketIdFor(client: HttpClient, symbol: string): Promise<number | undefined> {
    if (!marketIds.has(symbol)) {
      const details = await client.getJson<LighterOrderBookDetails>(`${api}/orderBookDetails`);
      for (const d of details.order_book_details) marketIds.set(d.symbol, d.market_id);
    }
    return marketIds.get(symbol);
  }

  return {
    venueId: deployment.venueId,
    // Unauthenticated REST is limited to ~60 requests/min.
    minIntervalMs: 1100,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const rates = await client.getJson<LighterFundingRates>(`${api}/funding-rates`);
      const details = await client.getJson<LighterOrderBookDetails>(`${api}/orderBookDetails`);
      for (const d of details.order_book_details) marketIds.set(d.symbol, d.market_id);
      return { snapshots: parseLighterSnapshots(rates, details, now, deployment), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const marketId = await marketIdFor(client, venueSymbol);
      if (marketId === undefined) return [];

      const rows: LighterFunding[] = [];
      let start = Math.floor(fromMs / 1000);
      const end = Math.floor(toMs / 1000);
      while (start <= end) {
        const page = await client.getJson<LighterFundings>(
          `${api}/fundings?market_id=${marketId}&resolution=1h&start_timestamp=${start}&end_timestamp=${end}&count_back=0`,
        );
        rows.push(...page.fundings);
        const last = page.fundings.at(-1);
        if (!last || page.fundings.length < HISTORY_PAGE_SIZE) break;
        start = last.timestamp + 1;
      }
      return parseLighterFundings(venueSymbol, { fundings: rows }, deployment);
    },
  };
}

export const lighterAdapter: VenueAdapter = createLighterAdapter();

export const lighterRhAdapter: VenueAdapter = createLighterAdapter(LIGHTER_RH);
