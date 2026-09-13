import { type AssetClass, classifyNonCrypto } from "@ai-rates/core";
import type { VenueAdapter } from "../types";
import { type BinanceStyleSymbol, createBinanceStyleAdapter, declaredBase } from "./aster";

/**
 * Bullet's declared class, from `contractType`.
 *
 * `underlyingType` is COIN on all 19 rows, TSLA and GOLD included, so it declares nothing; the
 * contract type does. On 2026-09-14: CryptoPerp 8, RwaPerpUsEquity 4, RwaPerpCommodities 3,
 * RwaPerpUsEquityIndices 2, RwaPerpKrEquity 1, RwaPerpCnEquity 1.
 *
 * An RwaPerp type not listed is real-world of a kind we cannot read, so `classifyNonCrypto` places it
 * rather than defaulting to crypto. Anything else is not collected (see `isBulletTradable`).
 */
export function bulletAssetClass(symbol: BinanceStyleSymbol): AssetClass {
  const type = symbol.contractType;
  if (type === "CryptoPerp") return "crypto";
  if (type === "RwaPerpUsEquityIndices") return "index";
  if (type === "RwaPerpCommodities") return "commodity";
  if (/^RwaPerp[A-Za-z]*Equity$/.test(type)) return "equity";
  if (type.startsWith("RwaPerp")) return classifyNonCrypto(declaredBase(symbol));
  return "crypto";
}

/** A TRADING perpetual. Bullet's contract types are never PERPETUAL, only CryptoPerp and RwaPerp*. */
export function isBulletTradable(symbol: BinanceStyleSymbol): boolean {
  return (
    symbol.status === "TRADING" &&
    (symbol.contractType === "CryptoPerp" || symbol.contractType.startsWith("RwaPerp"))
  );
}

/**
 * Bullet: a binance-fapi family member at https://tradingapi.bullet.xyz/fapi/v1.
 *
 * Measured from this machine on 2026-09-14, and read against the OpenAPI document at
 * https://tradingapi.bullet.xyz/docs/rest and https://docs.bullet.xyz/exchange/trading/funding:
 *
 * - **Answers.** exchangeInfo, premiumIndex, fundingInfo, ticker/24hr, openInterest and fundingRate
 *   all 200 in 0.15–0.63s. exchangeInfo publishes no `rateLimits`.
 * - **Rates are 8h rates, settled hourly at one-eighth.** The docs say so, and the schema describes
 *   `lastFundingRate` and fundingRate history as "8h" rates and `estimatedFundingRate` as "estimated
 *   1h funding rate (dampened 8h rate ÷ 8)". `lastFundingRate` equals the newest settlement on all 19
 *   markets, so it is not a prediction. Snapshots carry `estimatedFundingRate` over its 1h interval,
 *   which matched Hyperliquid's hourly BTC, ETH, HYPE and ZEC rates exactly; history carries each
 *   settled 8h rate at an 8h basis, never the 1h gap between settlements.
 * - **fundingInfo works**: `fundingIntervalHours` 1 on all 19.
 * - **Microseconds.** fundingRate `fundingTime` (1789333200020994) and openInterest `time` are
 *   microseconds; premiumIndex `nextFundingTime` and `time` are milliseconds.
 * - **fundingRate is the latest settlement only.** The schema takes `symbol` and nothing else, and
 *   startTime, endTime and limit are ignored in either unit, so each call returns one row per market.
 *   History accrues forward as the hourly sweep collects it; the backfill finds nothing older.
 * - **openInterest ignores `?symbol=`** and returns all 19 markets, so it is one bulk call per cycle.
 * - **Bases.** GOLD and SILVER reach XAU and XAG through the core aliases. WTIOIL does not reach CL:
 *   no alias is added without price evidence.
 */
export function createBulletAdapter(): VenueAdapter {
  return createBinanceStyleAdapter({
    venueId: "bullet",
    baseUrl: "https://tradingapi.bullet.xyz/fapi/v1",
    classify: bulletAssetClass,
    defaultIntervalHours: null,
    isTradable: isBulletTradable,
    predictedRate: (row) => row.estimatedFundingRate,
    timeUnits: { premiumIndex: "ms", fundingRate: "us" },
    historyBasisHours: 8,
    openInterest: "bulk",
  });
}

export const bulletAdapter: VenueAdapter = createBulletAdapter();
