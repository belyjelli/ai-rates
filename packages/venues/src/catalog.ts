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
  /** True when the probe URLs were checked against the venue's docs during research. */
  verified: boolean;
  /** Public endpoints hit by the Phase 0 geo-probe. Empty means "not researched yet". */
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
  probes: [{ label: "metaAndAssetCtxs", url: HL_INFO, body: { type: "metaAndAssetCtxs", dex } }],
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
    notes: "HTTP 451 from US IPs. fundingInfo lists only symbols with adjusted interval/cap.",
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
    verified: false,
    probes: [get("details", "https://api-cloud-v2.bitmart.com/contract/public/details")],
    notes: "Host unverified.",
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
    verified: false,
    probes: [
      get(
        "premiumIndex",
        "https://api-ct.hotcoin.fit/api/v1/perpetual/public/btcusdt/premiumIndex",
      ),
    ],
    notes: "Per-symbol calls; contract code format unverified.",
  },
  {
    id: "weex",
    name: "WEEX",
    type: "cex",
    ccxt: "weex",
    verified: false,
    probes: [
      get(
        "premiumIndex",
        "https://api-contract.weex.com/capi/v3/market/premiumIndex?symbol=BTCUSDT",
      ),
    ],
    notes: "Binance-like API shape.",
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
    verified: false,
    probes: [
      get(
        "marketData",
        "https://lbkperp.lbank.com/cfd/openApi/v1/pub/marketData?productGroup=SwapU",
      ),
    ],
    notes: "No funding history API; record settlements ourselves.",
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
      { label: "metaAndAssetCtxs", url: HL_INFO, body: { type: "metaAndAssetCtxs" } },
      { label: "perpDexs", url: HL_INFO, body: { type: "perpDexs" } },
      { label: "predictedFundings", url: HL_INFO, body: { type: "predictedFundings" } },
    ],
    notes: "Hourly funding. predictedFundings also relays Binance/Bybit rates (fallback rung 3).",
  },
  {
    id: "bullpen",
    name: "Bullpen",
    type: "dex",
    verified: false,
    probes: [],
    notes: "Not researched; possibly a Hyperliquid front-end.",
  },
  hip3("xyz", "trade[XYZ]"),
  {
    id: "aster",
    name: "Aster",
    type: "dex",
    ccxt: "aster",
    verified: true,
    probes: [get("premiumIndex", "https://fapi.asterdex.com/fapi/v1/premiumIndex")],
    notes: "Binance-compatible API.",
  },
  {
    id: "edgex-v2",
    name: "edgeX V2",
    type: "dex",
    verified: false,
    probes: [],
    notes:
      "V2 path /api/v2/public/funding/getLatestFundingRate returned 404 on pro.edgex.exchange (the V1 path works); find the V2 host.",
  },
  {
    id: "lighter",
    name: "Lighter",
    type: "dex",
    ccxt: "lighter",
    verified: true,
    probes: [get("funding-rates", "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates")],
    notes: "60 req/min unauthenticated; response also relays other venues' rates.",
  },
  {
    id: "pacifica",
    name: "Pacifica",
    type: "dex",
    verified: false,
    probes: [get("prices", "https://api.pacifica.fi/api/v1/info/prices")],
  },
  {
    id: "apex",
    name: "ApeX",
    type: "dex",
    ccxt: "apex",
    verified: false,
    probes: [get("ticker", "https://omni.apex.exchange/api/v3/ticker?symbol=BTCUSDT")],
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
    verified: false,
    probes: [
      {
        label: "ticker",
        url: "https://market-data.grvt.io/full/v1/ticker",
        body: { instrument: "BTC_USDT_Perp" },
      },
    ],
    notes: "funding_rate_8h_curr is 8h-normalized.",
  },
  { id: "standx", name: "StandX", type: "dex", verified: false, probes: [] },
  { id: "lighter-rh", name: "Lighter Robinhood", type: "dex", verified: false, probes: [] },
  { id: "sodex", name: "SoDEX", type: "dex", verified: false, probes: [] },
  {
    id: "nado",
    name: "Nado",
    type: "dex",
    verified: false,
    probes: [],
    notes:
      "Vertex successor on Ink; archive indexer at archive.prod.nado.xyz/v2 (funding_rate_x18).",
  },
  { id: "ondo", name: "Ondo", type: "dex", verified: false, probes: [] },
  { id: "risex", name: "RiseX", type: "dex", verified: false, probes: [] },
  {
    id: "reya",
    name: "Reya",
    type: "dex",
    verified: true,
    probes: [get("perpMarkets/summary", "https://api.reya.xyz/v2/perpMarkets/summary")],
    notes: "Hourly rate; separate long/short funding values; no history API.",
  },
  { id: "arcus", name: "Arcus", type: "dex", verified: false, probes: [] },
  { id: "txflow", name: "TxFlow", type: "dex", verified: false, probes: [] },
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
    verified: false,
    probes: [get("pub/context", "https://app.perpl.xyz/api/v1/pub/context")],
    notes: "WS limits: 10 req/min, 16 subscriptions.",
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
    verified: false,
    probes: [get("exchange-info", "https://data-api.hibachi.xyz/market/exchange-info")],
  },
  {
    id: "paradex",
    name: "Paradex",
    type: "dex",
    ccxt: "paradex",
    verified: true,
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
    verified: false,
    probes: [get("info", "https://zo-mainnet.n1.xyz/info")],
  },
  {
    id: "bullet",
    name: "Bullet",
    type: "dex",
    verified: false,
    probes: [get("premiumIndex", "https://tradingapi.bullet.xyz/fapi/v1/premiumIndex")],
    notes: "Binance FAPI-compatible per docs; base URL unverified.",
  },
  {
    id: "polymarket",
    name: "Polymarket",
    type: "dex",
    verified: false,
    probes: [],
    notes: "Listed by ORBIT; confirm it exposes perp funding.",
  },
  {
    id: "phoenix",
    name: "Phoenix",
    type: "dex",
    verified: false,
    probes: [],
    notes:
      "WebSocket-first (wss://perp-api.phoenix.trade/v1/ws); rate quoted per 24h, paid hourly.",
  },
  hip3("cash", "dreamcash"),
  hip3("flx", "Felix Exchange"),
  hip3("hyna", "HyENA", "USDe collateral."),
  hip3("vntl", "Ventuals"),
  hip3("km", "Kinetiq (legacy)"),
  {
    id: "edgex",
    name: "edgeX V1",
    type: "dex",
    verified: false,
    probes: [
      get(
        "getLatestFundingRate",
        "https://pro.edgex.exchange/api/v1/public/funding/getLatestFundingRate",
      ),
    ],
    notes: "Host unverified.",
  },
  {
    id: "ethereal",
    name: "Ethereal",
    type: "dex",
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
