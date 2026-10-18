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
  /**
   * When and why the venue's numbers stopped being trusted, as "YYYY-MM-DD: evidence": funding
   * copied from another venue, volume or open interest far beyond what its reserves could back.
   * A quarantined venue is still collected and still shown, but it is left out of the default
   * Screener and Arbitrage rankings (pages and API); a reader adds it back by naming it in the
   * exchange picker or `venues=`. The weekly venue review re-checks it (collector
   * docs/venue-review-sop.md 4.4). Clear it to release the venue.
   */
  quarantined?: string;
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
    // Published standard taker fee, checked 2026-10-17: USDⓈ-M regular user, 0.05% taker.
    takerBps: 5,
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
    // Published standard taker fee, checked 2026-10-17: Bybit's fee table, VIP 0 USDT perpetual 0.055%.
    takerBps: 5.5,
    ccxt: "bybit",
    verified: true,
    probes: [get("tickers", "https://api.bybit.com/v5/market/tickers?category=linear")],
    notes: "CloudFront 403 on many cloud IP ranges; fundingInterval in minutes.",
  },
  {
    id: "okx",
    name: "OKX",
    type: "cex",
    // Published standard taker fee, checked 2026-10-17: regular Lv1 perpetual, 0.05% taker.
    takerBps: 5,
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
    notes:
      "Retired 2026-09-27 on counterparty risk (about $388M drained from hot and warm wallets on 2026-09-24, withdrawals suspended); reinstated 2026-10-18 by the venue review: withdrawals reopened 09-28 to 10-02 (4,648 of 5,111 chains withdrawable), proof of reserves 131%, $5.5B clean reserves on DefiLlama with -$9.7M net over a month, volume 0.45x open interest, funding identical to Binance on 0 of 651 shared markets.",
  },
  {
    id: "mexc",
    name: "MEXC",
    type: "cex",
    // Published standard taker fee, checked 2026-10-17: web/app USDT-M 0.02% taker (third-party guides; MEXC changes it by region and promotion).
    takerBps: 2,
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
    // Published standard taker fee, checked 2026-10-17: KuCoin's futures fee guide, VIP 0 0.06% taker.
    takerBps: 6,
    ccxt: "kucoinfutures",
    verified: true,
    probes: [get("contracts/active", "https://api-futures.kucoin.com/api/v1/contracts/active")],
    notes: "fundingRateGranularity in ms; XBT = BTC.",
  },
  {
    id: "gate",
    name: "Gate",
    type: "cex",
    // Published standard taker fee, checked 2026-10-17: Gate's fee guide, VIP 0 futures 0.05% taker.
    takerBps: 5,
    ccxt: "gate",
    verified: true,
    probes: [get("contracts", "https://api.gateio.ws/api/v4/futures/usdt/contracts")],
    notes: "funding_interval in seconds; funding_rate_indicative is predicted.",
  },
  {
    id: "htx",
    name: "HTX",
    type: "cex",
    // Published standard taker fee, checked 2026-10-17: HTX's USDT-M fee page example, 0.06% taker.
    takerBps: 6,
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
    // Published standard taker fee, checked 2026-10-17: BingX's perpetual fee article, 0.050% taker.
    takerBps: 5,
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
    id: "deribit",
    name: "Deribit",
    type: "cex",
    // Published standard taker fee, checked 2026-10-17: perpetual 0.05% taker.
    takerBps: 5,
    ccxt: "deribit",
    verified: true,
    probes: [
      get(
        "book-summary",
        "https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=USDC&kind=future",
      ),
    ],
    notes:
      "Added 2026-10-16. Coinbase International stopped trading 2026-10-01 and moved its perps here (drb.coinbase.com is the same book, never a second venue). USDC linear perps plus the BTC/ETH inverse perps; continuous funding, current_funding on an 8h basis; hourly history.",
  },
  {
    id: "coinbase",
    name: "Coinbase",
    type: "cex",
    ccxt: "coinbase",
    verified: true,
    probes: [
      get(
        "products",
        "https://api.coinbase.com/api/v3/brokerage/market/products?product_type=FUTURE",
      ),
    ],
    notes:
      "Added 2026-10-16. Coinbase Derivatives Exchange (US) perpetual-style futures: one bulk call, funding per hour and final for its hour, OI and volume in contracts. No public funding history (it accrues from snapshots). Coinbase's offshore perps moved to Deribit on 2026-10-01 -- see deribit.",
  },
  {
    id: "kraken",
    name: "Kraken",
    type: "cex",
    ccxt: "krakenfutures",
    verified: true,
    takerBps: 5,
    probes: [get("tickers", "https://futures.kraken.com/derivatives/api/v3/tickers")],
    notes:
      "Added 2026-10-18. Kraken Futures' multi-collateral USD perps (PF_); the inverse PI_ ones are left out (thin, delisting 2026-10-30). One ticker call; instruments hourly declare a category (Equities, Pre-IPO, Commodities, Forex, Indices, xStocks, crypto). Funding hourly: relativeFundingRate is final for the hour in progress, and each hour is recorded as it ends; v4 history is a year of hourly rows per call, for backfill. Taker 0.05% at Tier 1 (kraken.com/features/fee-schedule, 2026-10-18).",
  },
  {
    id: "bitunix",
    name: "Bitunix",
    type: "cex",
    verified: true,
    takerBps: 6,
    probes: [
      get("funding-batch", "https://fapi.bitunix.com/api/v1/futures/market/funding_rate/batch"),
    ],
    notes:
      "Added 2026-10-18. USDT/USDC linear perps plus 15 inverse USD perps: one funding batch (rate in PERCENT, each contract's own 1/4/8h interval) and one ticker call, listing hourly. Stocks and commodities are classed from Bitunix's coin tags on api.bitunix.com, which refuses Hong Kong (HTTP 469), so the venue is collected through VENUE_PROXIES. No public open interest. History newest first, 200 a page, back to launch. Taker 0.06% (takerFeeRate in Bitunix's symbol API, 2026-10-18).",
  },
  {
    id: "kalshi",
    name: "Kalshi",
    type: "cex",
    verified: true,
    probes: [get("markets", "https://external-api.kalshi.com/trade-api/v2/margin/markets")],
    notes:
      "Added 2026-10-18. Kalshi's CFTC-regulated US perpetuals (the API calls them margin markets): one listing call plus one funding estimate per market, no bulk estimate. Prices are per contract and divided by contract_size. Funding is a fraction of the period: crypto 8h (04/12/20 UTC); metals, indices and WTI daily, measured from settlements because the schedule endpoint is clearing-member only. US500 and US Tech 100 track Kalshi's own MQ5CT and MQBUSTQT indices (1.77x and 1.25x the S&P 500 and Nasdaq-100), never those pools. Public funding history since launch (2026-06-03) in one call. Taker fee left unknown: the June 2026 CFTC filing's 12 bps base tier was revised in September and not confirmed.",
  },
  {
    id: "qfex",
    name: "QFEX",
    type: "cex",
    verified: true,
    takerBps: 10,
    probes: [get("contracts", "https://api.qfex.com/md/contracts")],
    notes:
      "Added 2026-10-18. Equities (incl. pre-IPO), country ETFs, metals, oil and two US index levels; no crypto. Custodial (BitGo, KYC, ACH) although DefiLlama files it as a DEX. One bulk call (/md/contracts) plus /refdata hourly. Funding hourly, 0 outside each symbol's market_hours; next_funding_rate is the live rate. open_interest counts both sides (long side used). The 8 markets quoted in KRW, JPY, CNY or SEK are left out: they would pool with dollar twins at ~1,000x. History /funding/{symbol}, forward-filled, kept from 2026-04-01. Taker 10 bps single stocks, 5 bps commodities/indices (docs.qfex.com/qfex/fees, 2026-10-18).",
  },
  {
    id: "bitmart",
    name: "BitMart",
    type: "cex",
    retired:
      "2026-09-27: retired on counterparty risk (hot wallets drained December 2021). Re-checked 2026-10-18: the exchange has wound down -- trading ended 2026-08-26 01:00 UTC, the platform closes 2027-01-31, and its API hosts no longer resolve.",
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
    quarantined:
      "2026-10-18: relays Binance's funding (live rate identical on 35.8% of 763 shared markets off the clamp values); a day's volume $9.5B is 50.9x its open interest and 131.9x its $72.3M clean reserves",
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
    quarantined: "2026-10-18: open interest 1,243x and volume 2,157x its $1.7M clean reserves",
    verified: true,
    probes: [get("perpetual/public", "https://api-ct.hotcoin.fit/api/v1/perpetual/public")],
    notes: "Bulk (~750KB): data[] fund (rate), markPrice, indexPrice, amount24.",
  },
  {
    id: "weex",
    name: "WEEX",
    type: "cex",
    ccxt: "weex",
    quarantined:
      "2026-10-18: live funding equals Toobit's on 30% of 725 shared markets (Binance's on 30% of 766); no open interest on any of 1,040 markets against $5.8B of volume, 31.5x its clean reserves",
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
    quarantined:
      "2026-10-18: live funding equals Hotcoin's on 34% of 261 shared markets (88 off the clamp values)",
    verified: true,
    probes: [get("fundingRate", "https://api.coinw.com/v1/perpum/fundingRate?instrument=BTC")],
    notes: "Returns last settled rate; 8 req/s.",
  },
  {
    id: "lbank",
    name: "LBank",
    type: "cex",
    ccxt: "lbank",
    quarantined:
      "2026-10-18: live funding equals Binance's on 20% of 481 shared markets; no open interest on any of 834 markets; volume $4.2B is 448.5x its $9.3M clean reserves",
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
    quarantined:
      "2026-10-18: a day's volume $4.8B is 12.7x its open interest and 38.8x its $124.2M clean reserves",
    verified: true,
    probes: [get("indexes", "https://api.pionex.com/api/v1/market/indexes")],
  },
];

const dex: Venue[] = [
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    type: "dex",
    // Published standard taker fee, checked 2026-10-17: docs fee table, tier 0 perps 0.045% taker.
    takerBps: 4.5,
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
    // Published standard taker fee, checked 2026-10-17: Pro mode 0.035% taker.
    takerBps: 3.5,
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
    // Published standard taker fee, checked 2026-10-17: standard accounts: its own orderBooks API lists taker_fee 0.0000.
    takerBps: 0,
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
    // Published standard taker fee, checked 2026-10-17: about 0.04% taker (third-party guide).
    takerBps: 4,
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
    // Published standard taker fee, checked 2026-10-17: 0.025% taker (third-party profile).
    takerBps: 2.5,
    ccxt: "extended",
    verified: true,
    probes: [get("info/markets", "https://api.starknet.extended.exchange/api/v1/info/markets")],
    notes: "User-Agent header required.",
  },
  {
    id: "grvt",
    name: "GRVT",
    type: "dex",
    // Published standard taker fee, checked 2026-10-17: entry tier 0.045% taker.
    takerBps: 4.5,
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
    verified: true,
    probes: [
      {
        label: "perpMeta",
        url: "https://api.txflow.com/info",
        method: "POST",
        body: { type: "perpMeta", dex: "" },
      },
    ],
    notes:
      "Collected from 2026-10-18 through the proxy: Hong Kong gets 'not available in your region'. perpMeta lists 235 USDC perps; live funding, marks and open interest come from the wss://api.txflow.com/ws allAssetCtxs snapshot, 24h volume from marketTicker per instrument. Funding is in PERCENT per hour. fundingHistory answers 403, so there is no settled history.",
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
    // Published standard taker fee, checked 2026-10-17: tier 1 0.05% taker.
    takerBps: 5,
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
      "2026-09-15: superseded by edgeX V2 (`edgex-v2`), which is collected; the V1 endpoint answered 200 with an empty `data` array. Re-checked 2026-10-18: every V1 route answers 503; V2 is 200.",
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
      "2026-09-15: /v1/product lists 18 markets, all DELISTED, with zero open interest and 24h volume; funding last updated 2026-08-26T01:00Z. Re-checked 2026-10-18: unchanged, 18 of 18 DELISTED, no relaunch announced.",
    verified: true,
    probes: [get("product", "https://api.ethereal.trade/v1/product")],
    notes: "Funding history ~1 month max.",
  },
  // Not on ORBIT's list, found during research.
  {
    id: "bitkub",
    name: "Bitkub",
    type: "cex",
    retired:
      "2026-09-30: spot only -- /api/v3/market/symbols lists 474 markets, all `market_segment: SPOT`; no futures, funding or liquidation endpoints exist (404) and the official API docs cover none. Re-checked 2026-10-18: still 474 of 474 markets SPOT; Thailand's SEC consulted on licensed derivatives (closed 2026-05-20), no Bitkub futures yet.",
    verified: true,
    probes: [get("symbols", "https://api.bitkub.com/api/v3/market/symbols")],
    notes: "Thai spot exchange (THB pairs). Revisit only if it launches derivatives.",
  },
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

/** The venues the site lists: still collected (not retired), with markets of their own (not an alias). */
export const LISTED_VENUES: readonly Venue[] = VENUES.filter((v) => !v.retired && !v.aliasOf);

/**
 * The exchanges the Screener and Arbitrage rank when the reader names none: every listed venue that
 * is not quarantined. A quarantined venue joins only when it is named.
 */
export const DEFAULT_VENUE_IDS: readonly string[] = LISTED_VENUES.filter((v) => !v.quarantined).map(
  (v) => v.id,
);
