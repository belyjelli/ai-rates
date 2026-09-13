import { type AssetClass, classifyNonCrypto } from "@ai-rates/core";
import type { VenueAdapter } from "../types";
import { type BinanceStyleSymbol, createBinanceStyleAdapter, declaredBase } from "./aster";

/**
 * Binance's `underlyingType` values, and the class each declares.
 *
 * Over the full exchangeInfo on 2026-09-14, the 762 TRADING perpetuals split: COIN 569, INDEX 2,
 * EQUITY 156, HK_EQUITY 15, KR_EQUITY 8, CN_EQUITY 2, PREMARKET 2, COMMODITY 8. Every COIN and INDEX
 * row is a PERPETUAL; every other row is a TRADIFI_PERPETUAL.
 *
 * - INDEX is crypto. Its rows are BTCDOMUSDT and ALLUSDT (DEFIUSDT too, not trading): baskets of
 *   coins, not stock indices.
 * - PREMARKET is equity: OPENAI and ANTHROPIC, pre-IPO company shares.
 * - COMMODITY is XAU, XAG, XPT, XPD, COPPER, CL, BZ and NATGAS. PAXG is COIN, a token.
 */
const UNDERLYING_TYPES: ReadonlyMap<string, AssetClass> = new Map([
  ["COIN", "crypto"],
  ["INDEX", "crypto"],
  ["EQUITY", "equity"],
  ["HK_EQUITY", "equity"],
  ["KR_EQUITY", "equity"],
  ["CN_EQUITY", "equity"],
  ["PREMARKET", "equity"],
  ["COMMODITY", "commodity"],
]);

/**
 * Binance's declared class for an exchangeInfo row, from `underlyingType`.
 *
 * Two declarations are read, and the second can only move a market away from crypto:
 *
 * - `underlyingType`, mapped by the table above. A value not in the table is new, and every value
 *   Binance has added beyond COIN has been tradfi, so it goes to `classifyNonCrypto` rather than
 *   defaulting to crypto. A row without the field declares nothing and is crypto.
 * - `contractType` TRADIFI_PERPETUAL, which is Binance saying the market is not crypto. A TradFi row
 *   whose `underlyingType` reads as crypto (none do today) is taken as tradfi of the kind the tables
 *   say, so that a stock index filed as INDEX cannot land in a crypto pool.
 *
 * This is how CATUSDT (EQUITY, Caterpillar at 817) and 1000CATUSDT (COIN, a memecoin) stay apart
 * under the same CAT base, and how BBUSDT stays BounceBit.
 */
export function binanceAssetClass(symbol: BinanceStyleSymbol): AssetClass {
  const declared =
    symbol.underlyingType === undefined ? "crypto" : UNDERLYING_TYPES.get(symbol.underlyingType);
  const tradfi = symbol.contractType === "TRADIFI_PERPETUAL";
  if (declared !== undefined && !(tradfi && declared === "crypto")) return declared;
  return classifyNonCrypto(declaredBase(symbol));
}

/**
 * Binance USDⓈ-M futures: the first member of the binance-fapi family that is not Aster.
 *
 * Everything here is configuration. The parsing, the hourly exchangeInfo cache, the rotating
 * open-interest sweep and the paged funding history all live in `aster.ts`, which is the family
 * base; adding Binance required generalising two constants, not a second adapter.
 *
 * Measured from the collector host on 2026-09-13 before any of this was written:
 *
 * - **Reachable.** premiumIndex, fundingInfo, exchangeInfo and ticker/24hr all returned HTTP 200 in
 *   0.12–0.21s. The catalog's warning is "HTTP 451 from US IPs"; hklab is not one, so the documented
 *   blocker does not apply to where the collector actually runs. It would apply to a US-hosted
 *   collector, which is why this is written down rather than assumed stable.
 * - **762 tradable perpetuals** as of 2026-09-14: 571 PERPETUAL and 191 TRADIFI_PERPETUAL. The
 *   TradFi ones (gold, TSLA, SPY, ...) were dropped until `tradablePerpetuals` admitted that type.
 * - **`defaultIntervalHours` is null.** fundingInfo is not the exceptions-only list the catalog note
 *   claims: 782 entries, 312 of them at the default 8h, against 900 symbols in premiumIndex. All 762
 *   tradable markets are among them, so `tradablePerpetuals` filters the missing before the interval
 *   lookup matters. An 8h default would also have been the wrong guess: 466 of 782 settle 4-hourly.
 * - **Weight fits.** A symbol-less premiumIndex reported `x-mbx-used-weight-1m: 50` against a
 *   2400/min ceiling, so the bulk trio plus a 120-symbol open-interest slice has ample headroom.
 *   `exchangeInfo` is 1.1 MB, which is why it is cached hourly rather than fetched per cycle.
 */
export const binanceAdapter: VenueAdapter = createBinanceStyleAdapter({
  venueId: "binance",
  baseUrl: "https://fapi.binance.com/fapi/v1",
  classify: binanceAssetClass,
  defaultIntervalHours: null,
});
