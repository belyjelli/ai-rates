import type { AssetClass } from "@ai-rates/core";
import { msg } from "./i18n";

/**
 * The sectors a reader follows across pages: chip, memory and hardware names; drug makers, health
 * care and biotech funds; and metals and mining (gold, silver and copper miners and their funds, gold
 * and silver themselves, and the lithium, nickel and rare-earth producers batteries need).
 *
 * One table for two pickers. The option tabs' book picker (gamma.ts) groups the US books by it, and
 * the liquidations page's asset picker groups every liquidated asset by it, so a ticker sits under
 * the same heading on both. The lists hold option-book tickers (SKHY, the ADR) and perp-only names
 * (SKHYNIX, a Seoul share; SAMSUNG) alike: a name only one page has costs the other nothing.
 */
export type Sector = "chips" | "bio" | "metals";

const SECTOR_TICKERS: readonly [Sector, string][] = [
  [
    "chips",
    "NVDA MU SKHY SNDK WDC STX DRAM AMD AVGO TSM INTC MRVL ARM QCOM ASML AMAT LRCX KLAC DELL " +
      "SMCI LITE COHR AAOI GLW SMH SOXX SOXL EWY SOXS MUU KORU SKHYNIX SAMSUNG SKHX KIOXIA CXMT " +
      "AXTI TSEM LASERTEC HANMI ZHONGJI CSOPSKHYNIX2L CRDO ALAB TSMC SMIC HUAHONG ADVANTEST ON " +
      "TXN ADI NXPI MCHP ANET",
  ],
  [
    "bio",
    "LLY UNH MRNA XLV JNJ XBI ABBV MRK PFE NVO ISRG AMGN TMO REGN GILD TEM VRTX AZN HIMS BIIB " +
      "IBB VKTX CRSP BEAM NTLA LABU DHR ABT CVS HCA BNTX",
  ],
  [
    "metals",
    "GLD SLV IAU GDX NEM B AEM GDXJ WPM KGC AG SILJ HL PAAS SIL CDE FCX COPX BHP RIO SCCO VALE " +
      "ALB MP USAR SQM LIT LAC TECK CPER FNV",
  ],
];
const SECTOR_OF: ReadonlyMap<string, Sector> = new Map(
  SECTOR_TICKERS.flatMap(([sector, tickers]) =>
    tickers.split(" ").map((t) => [t, sector] as const),
  ),
);

/** A ticker's sector, or null. By ticker alone: the caller decides which asset classes it applies to. */
export const sectorOf = (ticker: string): Sector | null => SECTOR_OF.get(ticker) ?? null;

/** The sectors' headings, in the order the pickers show them. */
export const SECTOR_LABELS: readonly [Sector, string][] = [
  ["chips", msg("Chips and memory")],
  ["bio", msg("Biotech and health")],
  ["metals", msg("Metals and mining")],
];

/**
 * The liquidations picker's groups: every asset class, with the sectors cut out of the stocks and
 * the metals out of the commodities. Gold and silver tokens (XAUT, PAXG) go with the metals they
 * hold rather than with the coins.
 */
export type AssetGroup = "crypto" | "index" | Sector | "equity" | "commodity" | "fx";

export const ASSET_GROUPS: readonly [AssetGroup, string][] = [
  ["crypto", msg("Crypto")],
  ["index", msg("Indexes")],
  ...SECTOR_LABELS,
  ["equity", msg("Other stocks")],
  ["commodity", msg("Energy and other commodities")],
  ["fx", msg("FX")],
];

const METAL_TOKENS = new Set(["XAUT", "PAXG"]);
// Commodity perps that are metals, by the names venues give them: XAU, XAG, XPT, XPD, XCU, XAL,
// XNI, XZN, XPB, COPPER, PLATINUM, and gold's crosses (XAUAUD, XAUEUR ...). BingX's NCCO*GOLD/ZINC/...
// codes are filed under these tickers since 2026-10-29. XTI is WTI crude, not titanium.
const METAL_COMMODITY =
  /^(XAU|XAG|XPT|XPD|XCU|XAL|XNI|XZN|XPB)|GOLD|SILVER|COPPER|PLATINUM|PALLADIUM|ALUMIN|NICKEL|ZINC|LEAD/;

/** The picker group an asset of a class goes under. */
export function assetGroup(asset: string, assetClass: AssetClass): AssetGroup {
  if (assetClass === "crypto") return METAL_TOKENS.has(asset) ? "metals" : "crypto";
  if (assetClass === "index" || assetClass === "fx") return assetClass;
  if (assetClass === "commodity") {
    return sectorOf(asset) === "metals" || METAL_COMMODITY.test(asset) ? "metals" : "commodity";
  }
  return sectorOf(asset) ?? "equity";
}
