import { type AssetClass, classifyNonCrypto } from "@ai-rates/core";
import type { VenueAdapter } from "../types";
import {
  type BinanceStyleSymbol,
  createBinanceStyleAdapter,
  declaredBase,
  PERPETUAL_CONTRACT_TYPES,
} from "./aster";

/**
 * WEEX's `underlyingType` values, and the class each declares.
 *
 * Over the full exchangeInfo on 2026-09-14, the 1,016 rows split: COIN 578, Stocks 371, Indices 40,
 * Metals 13, Forex 7, Commodities 4, Pre-IPO 3. Every COIN row is a PERPETUAL and every other row a
 * TRADIFI_PERPETUAL.
 *
 * - Pre-IPO is equity: ANTHROPIC, OPENAI and MOONSHOT, company shares before listing.
 * - Indices is WEEX's word for index AND ETF: SP500, NAS100, HK50 and KOSPI sit beside SPY, QQQ,
 *   SOXL and USO. `marketRef`'s refine settles which is which, by the same table as every venue.
 * - Metals holds PAXG and XAUT too, which the refine returns to crypto as tokens. It also holds SLV,
 *   an ETF, which stays a commodity because the refine only arbitrates equity against index.
 */
const UNDERLYING_TYPES: ReadonlyMap<string, AssetClass> = new Map([
  ["COIN", "crypto"],
  ["Stocks", "equity"],
  ["Pre-IPO", "equity"],
  ["Indices", "index"],
  ["Metals", "commodity"],
  ["Commodities", "commodity"],
  ["Forex", "fx"],
]);

/**
 * WEEX's declared class for an exchangeInfo row, read the way Binance's is.
 *
 * A value missing from the table is new, and goes to `classifyNonCrypto` rather than defaulting to
 * crypto; a row without the field declares nothing and is crypto; and a TRADIFI_PERPETUAL is never
 * crypto whatever its `underlyingType` says. CATUSDT (COIN) and CATSTOCKUSDT (Stocks) are how the
 * memecoin and Caterpillar stay apart.
 *
 * JP225USDT is declared COIN on a PERPETUAL, so it is crypto here. That is WEEX's declaration, and
 * crypto is final: correcting it from the ticker is exactly the inference this project refuses.
 */
export function weexAssetClass(symbol: BinanceStyleSymbol): AssetClass {
  const declared =
    symbol.underlyingType === undefined ? "crypto" : UNDERLYING_TYPES.get(symbol.underlyingType);
  const tradfi = symbol.contractType === "TRADIFI_PERPETUAL";
  if (declared !== undefined && !(tradfi && declared === "crypto")) return declared;
  return classifyNonCrypto(declaredBase(symbol));
}

/**
 * WEEX lists no `status`: the key is absent on all 1,016 rows, so Binance's TRADING test collects
 * nothing. Nothing else in a row says a market is halted either -- `forwardContractFlag` is true on
 * every row and no size or leverage field is zeroed -- so the contract type is the whole rule. A
 * `status` WEEX starts sending later is still honoured.
 */
export function isWeexTradable(symbol: BinanceStyleSymbol): boolean {
  return (
    PERPETUAL_CONTRACT_TYPES.has(symbol.contractType) &&
    (symbol.status === undefined || symbol.status === "TRADING")
  );
}

/**
 * WEEX futures: a binance-fapi family member under `/capi/v3/market` instead of `/fapi/v1`.
 *
 * Measured from this machine on 2026-09-14 (endpoints under https://api-contract.weex.com/capi/v3/market):
 *
 * - **Answers.** exchangeInfo (0.7 MB), premiumIndex, ticker/24hr, openInterest?symbol= and
 *   fundingRate all 200 in 0.18–0.49s. **fundingInfo is 404.**
 * - **Interval is premiumIndex `collectCycle`, in minutes**: {480: 517, 240: 493, 60: 6}. It agrees
 *   with the length of each row's `delivery` schedule on all 1,016 symbols, so it is the settlement
 *   interval and not a sampling cadence.
 * - **`lastFundingRate` is the LAST SETTLED rate**, equal to the newest fundingRate row on every
 *   symbol checked (BTC, ETH, SOL, XAU, TSLA, DOGE). The estimate is `forecastFundingRate`, which is
 *   what a predicted snapshot must carry. The two coincide on 337 of 1,016 rows, mostly at the floor.
 * - **History windows are capped**: "Time range cannot exceed 7 days", and startTime must be within
 *   365 days. Rows come newest first; a 7-day window of an 8h market is 21 rows.
 * - **Weight**: 500 per 10s. premiumIndex and exchangeInfo cost 1, ticker/24hr 40, openInterest 2,
 *   fundingRate 5. At 250ms spacing a history sweep spends at most 20/s.
 * - **Open interest is not collected.** `openInterest` needs a symbol, and its figure fits neither
 *   reading: as base units BTCUSDT is $10.8B, above Binance's $8B, with a median OI/volume of 13.7x
 *   over 26 symbols; as `contractVal` contracts the ratio swings from 0.0004 to 1,609. A number we
 *   cannot put a unit on would mislead the capital figures that read it.
 * - **Symbols**: `symbol` is the venue symbol; `displaySymbol` is prose on 15 rows (OIL(CL)USDT,
 *   GOLD(XAUT)USDT, TONUSDT shown as GRAMUSDT). The parser agrees with `baseAsset` on every row but
 *   the 1000-prefixed ones, which it reads as contract size. Eleven Stocks bases keep a STOCK suffix
 *   (CATSTOCK, ONSTOCK, RTXSTOCK, QNTSTOCK, CVXSTOCK, OPENSTOCK, TGTSTOCK, CSTOCK, ADVANTESTSTOCK,
 *   TOKYOELSTOCK, LGSTOCKS) and are left as declared: stripping is not ours to do without evidence.
 */
export function createWeexAdapter(): VenueAdapter {
  return createBinanceStyleAdapter({
    venueId: "weex",
    baseUrl: "https://api-contract.weex.com/capi/v3/market",
    classify: weexAssetClass,
    defaultIntervalHours: null,
    isTradable: isWeexTradable,
    intervalSource: {
      from: "premiumIndex",
      hours: (row) => (row.collectCycle && row.collectCycle > 0 ? row.collectCycle / 60 : null),
    },
    predictedRate: (row) => row.forecastFundingRate,
    historyMaxWindowMs: 7 * 24 * 60 * 60_000,
    openInterest: "none",
    minIntervalMs: 250,
  });
}

export const weexAdapter: VenueAdapter = createWeexAdapter();
