export interface ParsedSymbol {
  /** Canonical base asset, e.g. "BTC" for "XBTUSDTM" or "PEPE" for "1000PEPEUSDT". */
  base: string;
  quote: string | null;
  /** Contracts per unit of `base` implied by the symbol (1000 for "1000PEPE" / "kBONK"). */
  multiplier: number;
  /** Hyperliquid HIP-3 dex id for "dex:SYMBOL" markets. */
  dex: string | null;
}

/** Longest first so "FDUSD" and "BUSD" win over "USD". */
const QUOTES = ["FDUSD", "USDT", "USDC", "USDE", "BUSD", "USD"];
const CONTRACT_TOKENS = new Set(["SWAP", "PERP", "PERPETUAL", "FUTURES", "FUT"]);
/**
 * Tickers different venues use for the same underlying, mapped to the spelling most venues use.
 * The commodity entries were confirmed on 2026-09-12 by mark price: NG marked 2.937–2.944 against
 * NATGAS at 2.942–2.946, WTI 96.122–96.125 against CL 96.146–96.409, GOLD 4353.30 against XAU
 * 4355.79–4359.35, and SILVER 64.39–64.55 against XAG 64.52–64.58. Without these, the same asset
 * splits into two pools and never pairs.
 *
 * Deliberately absent: SPX is the SPX6900 token at ~$0.486, not the S&P 500 index that venues list
 * as US500 at ~$7,650. Aliasing them would merge unrelated markets.
 *
 * The S&P 500 entries were confirmed on 2026-09-13 by mark price: SPX500 marked 7,616.70–7,630.00
 * on gate and mexc, SP500 7,616.10 on hl-xyz, against US500 7,620.60–7,630.00 on lighter, okx and
 * paradex — all inside 0.2%. `US500` is the target because four venues use it against two and one,
 * which is this map's stated rule. Left unconsolidated, the deepest liquidity could not pair at all:
 * SP500 alone held $413M of open interest and SPX500 $129M, while US500 held $4.4M.
 *
 * NOTE: `hl-mkts:US500` marks ~760 against ~7,620 — a tenth-size contract inside this pool.
 * Consolidation does not cause that and does not fix it. Since 2026-09-15 a per-market scale override
 * stores it at multiplier 0.1, on the identity check's evidence; see packages/adapters/src/scale.ts.
 */
const ALIASES: Record<string, string> = {
  XBT: "BTC",
  NG: "NATGAS",
  WTI: "CL",
  GOLD: "XAU",
  SILVER: "XAG",
  SPX500: "US500",
  SP500: "US500",
  // Confirmed 2026-09-13 ~23:15Z by median mark within the same asset class (017 keys pools on
  // (asset_class, base), so a comparison across classes means nothing -- across them CATSTOCK reads as
  // 393,957,426x the CAT memecoin). First measured by the ranking session, then re-measured here.
  WTIOIL: "CL", // commodity: 98.69 on aevo, bullet, phoenix, polymarket vs 98.74 on 20 venues (0.9996)
  BRENT: "BZ", // commodity: 103.13 on mexc, ondo vs 103.10 on 12 venues (1.0003)
  SMSN: "SAMSUNG", // equity: 190.42 on aevo, hl-xyz, ondo vs 190.56 on 16 venues (0.9992)
  XNG: "NATGAS", // commodity: 2.979 on extended vs 2.983 on 16 venues (0.9986)
  ANTHROP: "ANTHROPIC", // equity: 2078.5 on extended vs 2079.8 on 12 venues (0.9994)
  // Extended's S&P 500 and Nasdaq 100 minis, declared equity; INDEX_BASES refines both to index. The
  // S&P entry is SPX500M only -- SPX stays unaliased, it is the SPX6900 token (see above).
  SPX500M: "US500", // 7615.2 against the ~7619 US500 cluster
  TECH100M: "NASDAQ100", // 29040.4 vs htx 29044.0 (0.9999)
  // WEEX's STOCK-suffixed equities, each checked against the same-named equity pool. Aliased, not
  // stripped: MEXC's withheld renames (CATSTOCK, RTXSTOCK...) land on these too, which is right now
  // that the class keeps Caterpillar out of crypto:CAT. CSTOCK, CVXSTOCK and OPENSTOCK have no
  // same-class market to join and are deliberately absent; 4STOCK is declared crypto.
  TGTSTOCK: "TGT", // 157.43 vs 157.43 (1.0000)
  TOKYOELSTOCK: "TOKYOEL", // 331.02 vs 331.11 (0.9997)
  ADVANTESTSTOCK: "ADVANTEST", // 205.58 vs 205.26 (1.0016)
  ONSTOCK: "ON", // 73.87 on mexc, weex vs 74.31 on 3 venues (0.9941)
  CATSTOCK: "CAT", // equity: 816.8 on bybit, htx, mexc, weex vs 815.1 on 3 venues (1.0021)
  RTXSTOCK: "RTX", // 199.47 on bitget, mexc, weex vs 199.13 (1.0017)
  QNTSTOCK: "QNT", // Quantinuum, equity: 48.76 on bitget, mexc, weex vs 48.49 on 5 venues (1.0057)
};

/**
 * The canonical spelling for an already-extracted base.
 *
 * Exported because a venue-declared base never passes through `parseVenueSymbol`, so it would miss
 * the alias map and re-split the very pools this exists to join: MEXC declares the S&P 500 as
 * `SP500`, which has to reach `US500` the same way gate's `SPX500` does.
 */
export function canonicalBase(base: string): string {
  const upper = base.trim().toUpperCase();
  return ALIASES[upper] ?? upper;
}

/**
 * Parses a venue-native perp symbol into its canonical parts. Handles the common shapes:
 * BTCUSDT, BTC-USDT-SWAP, BTC_USDT, BTC-SWAP-USDT, PERP_ETH_USDC, BTC_USDC_PERP, ETH-PERP,
 * XBTUSDTM (KuCoin), BTC/USDT:USDT (ccxt), 1000PEPEUSDT, kBONK and xyz:XYZ100 (HIP-3).
 */
export function parseVenueSymbol(raw: string): ParsedSymbol {
  let symbol = raw.trim();

  const slash = symbol.indexOf("/");
  if (slash > 0) {
    const quote =
      symbol
        .slice(slash + 1)
        .split(":")[0]
        ?.toUpperCase() ?? "";
    return finish(symbol.slice(0, slash), quote || null, null);
  }

  let dex: string | null = null;
  const colon = symbol.indexOf(":");
  if (colon > 0) {
    dex = symbol.slice(0, colon).toLowerCase();
    symbol = symbol.slice(colon + 1);
  }

  const tokens = symbol.split(/[-_ ]+/).filter((t) => t && !CONTRACT_TOKENS.has(t.toUpperCase()));
  const [first = symbol, second] = tokens;
  if (second !== undefined) {
    const quote = second.toUpperCase();
    return finish(first, QUOTES.includes(quote) ? quote : null, dex);
  }

  const upper = first.toUpperCase();
  const kucoin = /^(.+?)(USDT|USDC|USD)M$/.exec(upper);
  if (kucoin) {
    return finish(first.slice(0, (kucoin[1] as string).length), kucoin[2] as string, dex);
  }
  for (const quote of QUOTES) {
    if (upper.length > quote.length && upper.endsWith(quote)) {
      return finish(first.slice(0, -quote.length), quote, dex);
    }
  }
  return finish(first, null, dex);
}

function finish(rawBase: string, quote: string | null, dex: string | null): ParsedSymbol {
  let base = rawBase;
  let multiplier = 1;

  const kilo = /^k([A-Z0-9]{2,})$/.exec(base);
  if (kilo) {
    base = kilo[1] as string;
    multiplier = 1000;
  }

  base = base.toUpperCase();
  const scaled = /^(1000000|100000|10000|1000|100)([A-Z].*)$/.exec(base);
  if (scaled) {
    multiplier *= Number(scaled[1]);
    base = scaled[2] as string;
  }

  return { base: ALIASES[base] ?? base, quote, multiplier, dex };
}
