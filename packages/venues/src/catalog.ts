export type VenueType = "cex" | "dex" | "hip3";

export interface VenueProbe {
  label: string;
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
}

export interface Venue {
  /** Stable id; matches the orbitperpscreener.com exchange slug where one exists. */
  id: string;
  name: string;
  type: VenueType;
  /** ccxt exchange id when ccxt supports the venue (Python backfill only; Workers use thin adapters). */
  ccxt?: string;
  /** Hyperliquid HIP-3 dex id (`metaAndAssetCtxs` `dex` param). */
  hip3Dex?: string;
  /** Set when the venue has no markets of its own and trades on another catalog venue. */
  aliasOf?: string;
  /**
   * Hand-curated maximum leverage, for the venues that publish none at all (B4).
   *
   * This is a judgement call, not measured data, so it lands in `markets.max_leverage` — where the
   * pair page labels it "(small size)" — and never in `market_leverage_tiers`, which is reserved
   * for ladders a venue actually publishes. Erring low is the safe direction: capital is
   * `2 × size / L`, so too small a figure overstates what a pair must post rather than flattering
   * it. Every venue here really offers more than the value set.
   */
  maxLeverage?: number;
  /**
   * The venue's published standard taker fee in basis points, for an account with no VIP tier and no
   * discounts, hand-verified from the venue's own fee schedule with the date in `notes`.
   *
   * Absent means **unknown, never free** — the rule `packages/core/src/fees.ts` holds everywhere. A
   * venue without one falls back to the site's retail assumption, which the page names in words; a
   * venue with one overrides it. Fees are per account, so this is a published baseline and never a
   * member's real rate: a signed-in member's own schedule supersedes it (plans/member-fee-settings.md).
   */
  takerBps?: number;
  /**
   * When and why the venue stopped being worth collecting, as "YYYY-MM-DD: evidence". A retired
   * venue is not collected, not probed and not listed as backlog -- but it stays in the catalog,
   * because `venues` rows and anything keyed on its id must keep resolving. Clear it to reinstate.
   */
  retired?: string;
  /** True when the probe URLs were checked live (2xx JSON) during research. */
  verified: boolean;
  /** Public endpoints hit by the Phase 0 geo-probe. Empty means no public REST endpoint found yet. */
  probes: VenueProbe[];
  notes?: string;
}

const HL_INFO = "https://api.hyperliquid.xyz/info";

const get = (label: string, url: string, headers?: Record<string, string>): VenueProbe =>
  headers ? { label, url, headers } : { label, url };

const hip3 = (dex: string, name: string, notes?: string): Venue => ({
  id: `hl-${dex}`,
  name,
  type: "hip3",
  hip3Dex: dex,
  verified: true,
  probes: [
    {
      label: "metaAndAssetCtxs",
      url: HL_INFO,
      method: "POST",
      body: { type: "metaAndAssetCtxs", dex },
    },
  ],
  ...(notes ? { notes } : {}),
});

const cex: Venue[] = [
  {
    id: "binance",
    name: "Binance",
    type: "cex",
    ccxt: "binanceusdm",
    verified: true,
    probes: [
      get("premiumIndex", "https://fapi.binance.com/fapi/v1/premiumIndex"),
      get("fundingInfo", "https://fapi.binance.com/fapi/v1/fundingInfo"),
    ],
    // Corrected 2026-09-13 by measuring: fundingInfo is NOT an exceptions-only list. It returned
    // 782 entries, 312 of them at the default 8h, against 900 symbols in premiumIndex. The 138
    // missing are all non-TRADING, so they are filtered before any interval default would apply.
    notes: "HTTP 451 from US IPs. fundingInfo covers most symbols; 466 of 782 settle 4-hourly.",
  },
  {
    id: "bybit",
    name: "Bybit",
    type: "cex",
    ccxt: "bybit",
    verified: true,
    probes: [get("tickers", "https://api.bybit.com/v5/market/tickers?category=linear")],
    notes: "CloudFront 403 on many cloud IP ranges; fundingInterval in minutes.",
  },
  {
    id: "okx",
    name: "OKX",
    type: "cex",
    ccxt: "okx",
    verified: true,
    probes: [
      get("funding-rate", "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP"),
      get("open-interest", "https://www.okx.com/api/v5/public/open-interest?instType=SWAP"),
    ],
    notes: "Funding is per instId; check whether instId=ANY returns all markets.",
  },
  {
    id: "bitget",
    name: "Bitget",
    type: "cex",
    ccxt: "bitget",
    verified: true,
    probes: [
      get(
        "current-fund-rate",
        "https://api.bitget.com/api/v2/mix/market/current-fund-rate?productType=usdt-futures",
      ),
    ],
  },
  {
    id: "mexc",
    name: "MEXC",
    type: "cex",
    ccxt: "mexc",
    verified: true,
    probes: [
      get("funding_rate", "https://contract.mexc.com/api/v1/contract/funding_rate/BTC_USDT"),
    ],
    notes: "Per-symbol funding only.",
  },
  {
    id: "kucoin",
    name: "KuCoin",
    type: "cex",
    ccxt: "kucoinfutures",
    verified: true,
    probes: [get("contracts/active", "https://api-futures.kucoin.com/api/v1/contracts/active")],
    notes: "fundingRateGranularity in ms; XBT = BTC.",
  },
  {
    id: "gate",
    name: "Gate",
    type: "cex",
    ccxt: "gate",
    verified: true,
    probes: [get("contracts", "https://api.gateio.ws/api/v4/futures/usdt/contracts")],
    notes: "funding_interval in seconds; funding_rate_indicative is predicted.",
  },
  {
    id: "htx",
    name: "HTX",
    type: "cex",
    ccxt: "htx",
    verified: true,
    probes: [
      get("batch_funding_rate", "https://api.hbdm.com/linear-swap-api/v1/swap_batch_funding_rate"),
    ],
  },
  {
    id: "bingx",
    name: "BingX",
    type: "cex",
    ccxt: "bingx",
    verified: true,
    probes: [get("premiumIndex", "https://open-api.bingx.com/openApi/swap/v2/quote/premiumIndex")],
  },
  {
    id: "blofin",
    name: "BloFin",
    type: "cex",
    ccxt: "blofin",
    verified: true,
    probes: [
      get("funding-rate", "https://openapi.blofin.com/api/v1/market/funding-rate?instId=BTC-USDT"),
    ],
    notes: "Per-symbol funding only.",
  },
  {
    id: "bitmart",
    name: "BitMart",
    type: "cex",
    ccxt: "bitmart",
    verified: true,
    probes: [get("details", "https://api-cloud-v2.bitmart.com/contract/public/details")],
    notes:
      "Bulk: data.symbols[] funding_rate, expected_funding_rate, funding_interval_hours, open_interest, volume_24h.",
  },
  {
    id: "toobit",
    name: "Toobit",
    type: "cex",
    ccxt: "toobit",
    verified: true,
    probes: [
      get("fundingRate", "https://api.toobit.com/api/v1/futures/fundingRate?symbol=BTC-SWAP-USDT"),
    ],
    notes: "Symbols are BTC-SWAP-USDT; spot-style symbols return empty.",
  },
  {
    id: "hotcoin",
    name: "Hotcoin",
    type: "cex",
    verified: true,
    probes: [get("perpetual/public", "https://api-ct.hotcoin.fit/api/v1/perpetual/public")],
    notes: "Bulk (~750KB): data[] fund (rate), markPrice, indexPrice, amount24.",
  },
  {
    id: "weex",
    name: "WEEX",
    type: "cex",
    ccxt: "weex",
    verified: true,
    probes: [get("premiumIndex", "https://api-contract.weex.com/capi/v3/market/premiumIndex")],
    // Confirmed 2026-09-14: collectCycle matches each symbol's `delivery` schedule on all 1,016 rows.
    notes:
      "Bulk without ?symbol=. lastFundingRate is the last settled rate; forecastFundingRate is the estimate. collectCycle is the interval in minutes; fundingInfo 404s.",
  },
  {
    id: "coinw",
    name: "CoinW",
    type: "cex",
    verified: true,
    probes: [get("fundingRate", "https://api.coinw.com/v1/perpum/fundingRate?instrument=BTC")],
    notes: "Returns last settled rate; 8 req/s.",
  },
  {
    id: "lbank",
    name: "LBank",
    type: "cex",
    ccxt: "lbank",
    verified: true,
    probes: [
      get(
        "marketData",
        "https://lbkperp.lbank.com/cfd/openApi/v1/pub/marketData?productGroup=SwapU",
      ),
    ],
    notes:
      "Bulk: fundingRate, positionFeeTime (interval in seconds), markedPrice, volume. No funding history API.",
  },
  {
    id: "pionex",
    name: "Pionex",
    type: "cex",
    verified: true,
    probes: [get("indexes", "https://api.pionex.com/api/v1/market/indexes")],
  },
];

const dex: Venue[] = [
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    type: "dex",
    ccxt: "hyperliquid",
    verified: true,
    probes: [
      {
        label: "metaAndAssetCtxs",
        url: HL_INFO,
        method: "POST",
        body: { type: "metaAndAssetCtxs" },
      },
      { label: "perpDexs", url: HL_INFO, method: "POST", body: { type: "perpDexs" } },
      {
        label: "predictedFundings",
        url: HL_INFO,
        method: "POST",
        body: { type: "predictedFundings" },
      },
    ],
    notes: "Hourly funding. predictedFundings also relays Binance/Bybit rates (fallback rung 3).",
  },
  {
    id: "bullpen",
    name: "Bullpen",
    type: "dex",
    aliasOf: "hyperliquid",
    verified: false,
    probes: [],
    notes:
      "Hyperliquid front-end (builder codes); orders execute on Hyperliquid and it has no HIP-3 dex.",
  },
  hip3("xyz", "trade[XYZ]"),
  {
    id: "aster",
    name: "Aster",
    type: "dex",
    ccxt: "aster",
    verified: true,
    maxLeverage: 10,
    probes: [get("premiumIndex", "https://fapi.asterdex.com/fapi/v1/premiumIndex")],
    notes: "Binance-compatible API.",
  },
  {
    id: "edgex-v2",
    name: "edgeX V2",
    type: "dex",
    verified: true,
    probes: [
      get("getMetaData", "https://edgex-prod-v2.edgex.exchange/api/v2/public/meta/getMetaData"),
    ],
    notes:
      "Funding: /api/v2/public/funding/getLatestFundingRate?contractId=<ids comma-joined> (returns [] without ids; ids from getMetaData contractList).",
  },
  {
    id: "lighter",
    name: "Lighter",
    type: "dex",
    ccxt: "lighter",
    verified: true,
    maxLeverage: 10,
    probes: [get("funding-rates", "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates")],
    notes: "60 req/min unauthenticated; response also relays other venues' rates.",
  },
  {
    id: "pacifica",
    name: "Pacifica",
    type: "dex",
    verified: true,
    probes: [get("prices", "https://api.pacifica.fi/api/v1/info/prices")],
    notes: "Bulk: data[] funding, next_funding, mark, oracle, open_interest, volume_24h.",
  },
  {
    id: "apex",
    name: "ApeX",
    type: "dex",
    ccxt: "apex",
    verified: true,
    probes: [get("ticker", "https://omni.apex.exchange/api/v3/ticker?symbol=BTCUSDT")],
    notes:
      "Per-symbol only (no symbol returns []): fundingRate, predictedFundingRate, openInterest.",
  },
  {
    id: "variational",
    name: "Variational",
    type: "dex",
    verified: true,
    probes: [
      get(
        "metadata/stats",
        "https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats",
      ),
    ],
    notes: "RFQ quotes instead of a book; no funding history API; 10 req/10s.",
  },
  {
    id: "extended",
    name: "Extended",
    type: "dex",
    ccxt: "extended",
    verified: true,
    probes: [get("info/markets", "https://api.starknet.extended.exchange/api/v1/info/markets")],
    notes: "User-Agent header required.",
  },
  {
    id: "grvt",
    name: "GRVT",
    type: "dex",
    ccxt: "grvt",
    verified: true,
    probes: [
      {
        label: "ticker",
        url: "https://market-data.grvt.io/full/v1/ticker",
        method: "POST",
        body: { instrument: "BTC_USDT_Perp" },
      },
    ],
    notes:
      "Per instrument. funding_rate_8h_curr is 8h-normalized and looks like percent (unconfirmed).",
  },
  {
    id: "standx",
    name: "StandX",
    type: "dex",
    verified: true,
    probes: [get("query_market_overview", "https://perps.standx.com/api/query_market_overview")],
    notes:
      "symbols[] funding_rate, mark_price, open_interest_notional, volume_quote_24h. Interval unconfirmed.",
  },
  {
    id: "lighter-rh",
    name: "Lighter Robinhood",
    type: "dex",
    verified: true,
    probes: [
      get("funding-rates", "https://api.rh.lighter.xyz/api/v1/funding-rates"),
      get("orderBookDetails", "https://api.rh.lighter.xyz/api/v1/orderBookDetails"),
    ],
    notes:
      "Lighter API on another instance; funding-rates relays other venues, keep exchange=lighter.",
  },
  {
    id: "sodex",
    name: "SoDEX",
    type: "dex",
    verified: true,
    probes: [
      get("perps/markets/tickers", "https://mainnet-gw.sodex.dev/api/v1/perps/markets/tickers"),
    ],
    notes: "data[] fundingRate, nextFundingTime, markPrice, openInterest, quoteVolume.",
  },
  {
    id: "nado",
    name: "Nado",
    type: "dex",
    verified: true,
    probes: [get("archive/v2/contracts", "https://archive.prod.nado.xyz/v2/contracts")],
    notes:
      "Vertex successor on Ink. funding_rate is a 24h rate settled hourly (1/24). Gateway returns 403 without Accept-Encoding.",
  },
  {
    id: "ondo",
    name: "Ondo",
    type: "dex",
    verified: true,
    probes: [get("perps/contracts", "https://api.ondoperps.xyz/v1/perps/contracts")],
    notes:
      "result[] fundingRate, nextFundingRate, openInterestUsd, usdVolume. /v1/markets has fundingIntervalDivisions.",
  },
  {
    id: "risex",
    name: "RiseX",
    type: "dex",
    verified: true,
    probes: [get("markets", "https://api.rise.trade/v1/markets")],
    notes:
      "Hourly current_funding_rate plus funding_rate_8h; timestamps and funding_interval in ns.",
  },
  {
    id: "reya",
    name: "Reya",
    type: "dex",
    verified: true,
    probes: [get("perpMarkets/summary", "https://api.reya.xyz/v2/perpMarkets/summary")],
    notes: "Hourly rate; separate long/short funding values; no history API.",
  },
  {
    id: "arcus",
    name: "Arcus",
    type: "dex",
    verified: true,
    probes: [get("markets", "https://api.arcus.xyz/v1/markets")],
    notes: "Hourly: fundingRate, nextFundingRate, markPrice, openInterest, volume24hNotional.",
  },
  {
    id: "txflow",
    name: "TxFlow",
    type: "dex",
    verified: false,
    probes: [],
    notes:
      "Platform API 'coming soon'; api.txflow.com/info (Hyperliquid-style) returns 403 to public POSTs. Possibly WS-only.",
  },
  {
    id: "orderly",
    name: "WOOFi Pro",
    type: "dex",
    ccxt: "woofipro",
    verified: true,
    probes: [get("funding_rates", "https://api.orderly.org/v1/public/funding_rates")],
    notes:
      "Orderly network; brokers share one book, so dedupe. est_funding_rate is an 8h rolling estimate.",
  },
  hip3("io", "Entropy"),
  {
    id: "perpl",
    name: "Perpl",
    type: "dex",
    verified: true,
    probes: [get("pub/context", "https://app.perpl.xyz/api/v1/pub/context")],
    notes:
      "funding.rate in micros (1e-6) per funding_interval_sec; state values are scaled ints. WS: 10 req/min.",
  },
  hip3("mkts", "Kinetiq"),
  {
    id: "dydx",
    name: "dYdX",
    type: "dex",
    ccxt: "dydx",
    verified: true,
    probes: [get("perpetualMarkets", "https://indexer.dydx.trade/v4/perpetualMarkets")],
    notes: "Indexer geoblocks restricted jurisdictions.",
  },
  {
    id: "hibachi",
    name: "Hibachi",
    type: "dex",
    verified: true,
    probes: [get("prices", "https://data-api.hibachi.xyz/market/data/prices?symbol=BTC/USDT-P")],
    notes:
      "Per symbol: fundingRateEstimation.estimatedFundingRate, markPrice; volume via /market/data/stats.",
  },
  {
    id: "paradex",
    name: "Paradex",
    type: "dex",
    ccxt: "paradex",
    verified: true,
    maxLeverage: 10,
    probes: [
      get("markets/summary", "https://api.prod.paradex.trade/v1/markets/summary?market=ALL"),
    ],
    notes: "funding/data is continuous samples, not settlements; funding_period_hours varies.",
  },
  hip3("para", "Paragon"),
  {
    id: "zero1",
    name: "N1 (01)",
    type: "dex",
    verified: true,
    probes: [
      get("info", "https://zo-mainnet.n1.xyz/info"),
      get("market/0/stats", "https://zo-mainnet.n1.xyz/market/0/stats"),
    ],
    notes: "Per market: perpStats.funding_rate, mark_price, open_interest; market ids from /info.",
  },
  {
    id: "bullet",
    name: "Bullet",
    type: "dex",
    verified: true,
    probes: [get("premiumIndex", "https://tradingapi.bullet.xyz/fapi/v1/premiumIndex")],
    notes: "Binance FAPI-compatible bulk premiumIndex.",
  },
  {
    id: "polymarket",
    name: "Polymarket",
    type: "dex",
    verified: true,
    probes: [
      get("info/tickers", "https://api.perpetuals.polymarket.com/v1/info/tickers"),
      get("info/instruments", "https://api.perpetuals.polymarket.com/v1/info/instruments"),
    ],
    notes:
      "Polymarket perpetuals: hourly funding_rate, mark_price, open_interest; no volume field.",
  },
  {
    id: "phoenix",
    name: "Phoenix",
    type: "dex",
    verified: true,
    probes: [get("exchange/markets", "https://perp-api.phoenix.trade/v1/view/exchange/markets")],
    notes:
      "No current rate in markets; hourly rates via /v1/funding/overview (~1.7MB, supports startTime/endTime). Quoted per 24h, paid hourly.",
  },
  hip3("cash", "dreamcash"),
  hip3("flx", "Felix Exchange"),
  hip3("hyna", "HyENA", "USDe collateral."),
  hip3("vntl", "Ventuals"),
  hip3("km", "Kinetiq (legacy)"),
  hip3("abcd", "HIP-3 abcd", "Listed by perpDexs but not by ORBIT; identify the operator."),
  {
    id: "edgex",
    name: "edgeX V1",
    type: "dex",
    retired:
      "2026-09-15: superseded by edgeX V2 (`edgex-v2`), which is collected; the V1 endpoint answers 200 with an empty `data` array.",
    verified: true,
    probes: [
      get(
        "getLatestFundingRate",
        "https://pro.edgex.exchange/api/v1/public/funding/getLatestFundingRate",
      ),
    ],
  },
  {
    id: "ethereal",
    name: "Ethereal",
    type: "dex",
    retired:
      "2026-09-15: /v1/product lists 18 markets, all DELISTED, with zero open interest and 24h volume; funding last updated 2026-08-26T01:00Z.",
    verified: true,
    probes: [get("product", "https://api.ethereal.trade/v1/product")],
    notes: "Funding history ~1 month max.",
  },
  // Not on ORBIT's list, found during research.
  {
    id: "aevo",
    name: "Aevo",
    type: "dex",
    verified: true,
    probes: [get("funding", "https://api.aevo.xyz/funding?instrument_name=BTC-PERP")],
    notes: "Nanosecond timestamps; history limit 50 per page.",
  },
  {
    id: "backpack",
    name: "Backpack",
    type: "dex",
    ccxt: "backpack",
    verified: true,
    probes: [get("markPrices", "https://api.backpack.exchange/api/v1/markPrices")],
  },
  {
    id: "bluefin",
    name: "Bluefin",
    type: "dex",
    verified: true,
    probes: [get("exchange/info", "https://api.sui-prod.bluefin.io/v1/exchange/info")],
    notes: "e9 fixed-point values.",
  },
  {
    id: "velocity",
    name: "Velocity (ex-Drift)",
    type: "dex",
    verified: true,
    probes: [get("stats/markets", "https://data.velocity.exchange/stats/markets")],
    notes: "Drift rebranded 2026-07-01; relaunch in progress; 30-day funding history.",
  },
];

export const VENUES: readonly Venue[] = [...cex, ...dex];
