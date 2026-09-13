import type { AssetClass } from "./market";

/**
 * Canonical bases (after `canonicalBase`) that are market indices rather than single names.
 *
 * WHY A TABLE AT ALL, when class is meant to be declared: venues agree on crypto versus not-crypto,
 * and disagree on where equity ends and index begins. OKX files US500, US100, JP225 and KR200 under
 * instCategory 3 (Stocks); gate calls the same markets `indices`; MEXC's `stockindex` plate covers
 * both the S&P 500 and sixty ETFs. Taking each label literally would split US500 -- a pool that pairs
 * today across okx, lighter, paradex, gate, mexc and hl-xyz -- into an equity half and an index half.
 *
 * So the venue's declaration is always the authority on WHETHER a market is tradfi, and this table
 * only settles WHICH tradfi class, between two that venues use interchangeably. It is never applied
 * to a market its venue declared crypto: SPX stays SPX6900 however it is spelt.
 *
 * ETFs are equity, whatever the venue calls them: that is how Binance, Aster, Bybit, KuCoin and OKX
 * all file SPY and QQQ, against WEEX and MEXC calling them indices. Five venues to two.
 *
 * Built from every index a venue declared on 2026-09-14 -- gate `indices`, MEXC `stockindex` without
 * the ETF plate, Hyperliquid HIP-3 `indices` that are not sector baskets, OKX's four -- plus yields
 * and volatility indices, which have no class of their own and are closer to an index level than to
 * a share price.
 */
export const INDEX_BASES: ReadonlySet<string> = new Set([
  // United States
  "US500",
  "US100",
  "NAS100",
  "USTECH",
  "XYZ100",
  "US30",
  "US2000",
  "SMALL2000",
  // Europe and Asia-Pacific
  "GER40",
  "UK100",
  "JP225",
  "JPN225",
  "HK50",
  "HSCHKD",
  "AUS200",
  "KR200",
  "KOSPI",
  "TW88",
  "NIFTY",
  "IBOV",
  // Volatility, rates and other benchmarks
  "VIX",
  "VOL",
  "VOLX",
  "GVZ",
  "BVOL",
  "EVOL",
  "B200",
  "H100",
  "10Y",
  "US10Y",
  // HTX's declared index, marking 29,044; Extended's TECH100m aliases here in symbols.ts. Not merged
  // with NAS100, US100 or XYZ100: that pool is fragmented four ways and wants return correlation,
  // not price proximity, before any merge (USTECH at ~707 is a 41x scale variant).
  "NASDAQ100",
]);

/**
 * Canonical bases that are tokens tracking something off-chain, and so crypto whatever a venue
 * files them under.
 *
 * PAXG and XAUT are ERC-20s redeemable for gold. Bybit, Binance and dYdX call them crypto; gate and
 * KuCoin call them metals; Aster calls them commodities. Their marks sit near XAU but they never
 * share its base, so the only effect of a literal reading would be to split PAXG against PAXG. USDC
 * is gate's `forex` stablecoin.
 */
export const TOKENISED_BASES: ReadonlySet<string> = new Set(["PAXG", "XAUT", "USDC"]);

/**
 * Canonical bases for commodities and currencies, for the venues that declare only "this is not
 * crypto" -- Paradex's `RWA` tag, Lighter's RWA listing, dYdX's two non-crypto markets. Whatever is
 * in neither table and not an index is a single name, which is what most tradfi listings are.
 */
export const COMMODITY_BASES: ReadonlySet<string> = new Set([
  "XAU",
  "XAG",
  "XPT",
  "XPD",
  "XCU",
  "COPPER",
  "XAL",
  "XNI",
  "XPB",
  "CL",
  "BZ",
  "BRENTOIL",
  "USOIL",
  "OIL",
  "NATGAS",
  "URANIUM",
  // Measured 2026-09-13 ~23:15Z. Toobit's crude contracts mark with their pools: XTI 98.78 against
  // CL's 98.74, XBR 103.15 against BZ's 103.10. Toobit flags them isRwa with rwaType STOCK, so
  // without these rows they fell through to equity.
  "XTI",
  "XBR",
  // LBank's soft commodities, the instruments it suspends out of hours (needSuspend). They fell
  // through to equity; WHEAT already sits under commodity on Lighter at 7.227 against LBank's 7.259.
  "SUGAR",
  "COCOA",
  "COTTON",
  "SOYBEAN",
  "WHEAT",
]);

export const FX_BASES: ReadonlySet<string> = new Set([
  "EUR",
  "EURUSD",
  "GBP",
  "GBPUSD",
  "JPY",
  "USDJPY",
  "AUD",
  "AUDUSD",
  "USDCAD",
  "USDHKD",
  "USDKRW",
  "TRY",
]);

/**
 * The class a market ends up with, given what its venue declared and its canonical base.
 *
 * Crypto is final: a venue's word that a market is crypto is never overridden from the ticker, since
 * every collision this exists to separate (STX, BB, CAT, ON) is a correctly named crypto ticker.
 */
export function refineAssetClass(declared: AssetClass, base: string): AssetClass {
  if (declared === "crypto" || TOKENISED_BASES.has(base)) return "crypto";
  if (declared === "equity" || declared === "index") {
    return INDEX_BASES.has(base) ? "index" : "equity";
  }
  return declared;
}

/**
 * The class of a market whose venue declares only that it is NOT crypto.
 *
 * Commodity and currency tables first, then the index table, then equity. Only for venues with a
 * real not-crypto signal; applying it to an undeclared market would read the class off the ticker.
 */
export function classifyNonCrypto(base: string): AssetClass {
  if (TOKENISED_BASES.has(base)) return "crypto";
  if (COMMODITY_BASES.has(base)) return "commodity";
  if (FX_BASES.has(base)) return "fx";
  return INDEX_BASES.has(base) ? "index" : "equity";
}
