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
 */
const ALIASES: Record<string, string> = {
  XBT: "BTC",
  NG: "NATGAS",
  WTI: "CL",
  GOLD: "XAU",
  SILVER: "XAG",
};

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
