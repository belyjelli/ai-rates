package core

import (
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// ParsedSymbol is a venue-native perp symbol broken into its canonical parts.
type ParsedSymbol struct {
	// Base is the canonical asset, e.g. "BTC" for "XBTUSDTM" or "PEPE" for "1000PEPEUSDT".
	Base  string
	Quote *string
	// Multiplier is contracts per unit of Base implied by the symbol (1000 for "1000PEPE"/"kBONK").
	Multiplier float64
	// Dex is the Hyperliquid HIP-3 dex id for "dex:SYMBOL" markets.
	Dex *string
}

// quotes is longest first so "FDUSD" and "BUSD" win over "USD". Order is load-bearing: the suffix
// loop below takes the first match.
var quotes = []string{"FDUSD", "USDT", "USDC", "USDE", "BUSD", "USD"}

var contractTokens = map[string]struct{}{
	"SWAP": {}, "PERP": {}, "PERPETUAL": {}, "FUTURES": {}, "FUT": {},
}

// aliases maps tickers different venues use for the same underlying onto the spelling most venues
// use. Without these, one asset splits into two pools and never pairs.
//
// The commodity entries were confirmed 2026-09-12 by mark price: NG marked 2.937-2.944 against
// NATGAS at 2.942-2.946, WTI 96.122-96.125 against CL 96.146-96.409, GOLD 4353.30 against XAU
// 4355.79-4359.35, SILVER 64.39-64.55 against XAG 64.52-64.58.
//
// The S&P 500 entries were confirmed 2026-09-13: SPX500 marked 7,616.70-7,630.00 on gate and mexc,
// SP500 7,616.10 on hl-xyz, against US500 7,620.60-7,630.00 on lighter, okx and paradex — all
// inside 0.2%. US500 is the target because four venues use it against two and one. Left
// unconsolidated the deepest liquidity could not pair at all: SP500 alone held $413M of open
// interest and SPX500 $129M, while US500 held $4.4M.
//
// DELIBERATELY ABSENT: SPX is the SPX6900 token at ~$0.486, not the S&P 500 index that venues list
// as US500 at ~$7,650. Aliasing them would merge unrelated markets.
var aliases = map[string]string{
	"XBT":    "BTC",
	"NG":     "NATGAS",
	"WTI":    "CL",
	"GOLD":   "XAU",
	"SILVER": "XAG",
	"SPX500": "US500",
	"SP500":  "US500",
	// Confirmed 2026-09-13 by median mark within the same asset class. Comparing across classes
	// means nothing: across them CATSTOCK reads as 393,957,426x the CAT memecoin.
	"WTIOIL":  "CL",        // 98.69 on aevo, bullet, phoenix, polymarket vs 98.74 on 20 venues
	"BRENT":   "BZ",        // 103.13 on mexc, ondo vs 103.10 on 12 venues
	"SMSN":    "SAMSUNG",   // 190.42 on aevo, hl-xyz, ondo vs 190.56 on 16 venues
	"XNG":     "NATGAS",    // 2.979 on extended vs 2.983 on 16 venues
	"ANTHROP": "ANTHROPIC", // 2078.5 on extended vs 2079.8 on 12 venues
	// Extended's S&P 500 and Nasdaq 100 minis. SPX stays unaliased — it is the SPX6900 token.
	"SPX500M":  "US500",
	"TECH100M": "NASDAQ100",
	// WEEX's STOCK-suffixed equities, each checked against the same-named equity pool. Aliased, not
	// stripped: MEXC's withheld renames (CATSTOCK, RTXSTOCK...) land on these too, which is right
	// now that the class keeps Caterpillar out of crypto:CAT.
	"TGTSTOCK":       "TGT",
	"TOKYOELSTOCK":   "TOKYOEL",
	"ADVANTESTSTOCK": "ADVANTEST",
	"ONSTOCK":        "ON",
	"CATSTOCK":       "CAT",
	"RTXSTOCK":       "RTX",
	"QNTSTOCK":       "QNT",
}

var (
	tokenSplit  = regexp.MustCompile(`[-_ ]+`)
	kucoinQuote = regexp.MustCompile(`^(.+?)(USDT|USDC|USD)M$`)
	kiloPrefix  = regexp.MustCompile(`^k([A-Z0-9]{2,})$`)
	scaledBase  = regexp.MustCompile(`^(1000000|100000|10000|1000|100)([A-Z].*)$`)
)

// CanonicalBase is the canonical spelling for an already-extracted base.
//
// Exported because a venue-declared base never passes through ParseVenueSymbol, so it would miss
// the alias map and re-split the very pools that map exists to join: MEXC declares the S&P 500 as
// SP500, which has to reach US500 the same way gate's SPX500 does.
func CanonicalBase(base string) string {
	upper := strings.ToUpper(strings.TrimSpace(base))
	if alias, ok := aliases[upper]; ok {
		return alias
	}
	return upper
}

// ParseVenueSymbol parses a venue-native perp symbol into its canonical parts. It handles the
// common shapes: BTCUSDT, BTC-USDT-SWAP, BTC_USDT, BTC-SWAP-USDT, PERP_ETH_USDC, BTC_USDC_PERP,
// ETH-PERP, XBTUSDTM (KuCoin), BTC/USDT:USDT (ccxt), 1000PEPEUSDT, kBONK and xyz:XYZ100 (HIP-3).
func ParseVenueSymbol(raw string) ParsedSymbol {
	symbol := strings.TrimSpace(raw)

	if slash := strings.Index(symbol, "/"); slash > 0 {
		rest := symbol[slash+1:]
		if colon := strings.Index(rest, ":"); colon >= 0 {
			rest = rest[:colon]
		}
		quote := strings.ToUpper(rest)
		return finish(symbol[:slash], nilIfEmpty(quote), nil)
	}

	var dex *string
	if colon := strings.Index(symbol, ":"); colon > 0 {
		d := strings.ToLower(symbol[:colon])
		dex = &d
		symbol = symbol[colon+1:]
	}

	var tokens []string
	for _, t := range tokenSplit.Split(symbol, -1) {
		if t == "" {
			continue
		}
		if _, isContract := contractTokens[strings.ToUpper(t)]; isContract {
			continue
		}
		tokens = append(tokens, t)
	}

	first := symbol
	if len(tokens) > 0 {
		first = tokens[0]
	}
	if len(tokens) > 1 {
		quote := strings.ToUpper(tokens[1])
		if !slices.Contains(quotes, quote) {
			return finish(first, nil, dex)
		}
		return finish(first, &quote, dex)
	}

	upper := strings.ToUpper(first)
	if m := kucoinQuote.FindStringSubmatch(upper); m != nil {
		return finish(first[:len(m[1])], &m[2], dex)
	}
	for _, quote := range quotes {
		if len(upper) > len(quote) && strings.HasSuffix(upper, quote) {
			q := quote
			return finish(first[:len(first)-len(quote)], &q, dex)
		}
	}
	return finish(first, nil, dex)
}

// finish extracts the contract multiplier the symbol implies and canonicalises the base.
//
// The kilo rule runs BEFORE upper-casing on purpose: "kBONK" is a lowercase k against an uppercase
// ticker, and upper-casing first would make it indistinguishable from a base that merely starts
// with K.
func finish(rawBase string, quote *string, dex *string) ParsedSymbol {
	base := rawBase
	multiplier := 1.0

	if m := kiloPrefix.FindStringSubmatch(base); m != nil {
		base = m[1]
		multiplier = 1000
	}

	base = strings.ToUpper(base)
	if m := scaledBase.FindStringSubmatch(base); m != nil {
		scale, _ := strconv.ParseFloat(m[1], 64)
		multiplier *= scale
		base = m[2]
	}

	if alias, ok := aliases[base]; ok {
		base = alias
	}
	return ParsedSymbol{Base: base, Quote: quote, Multiplier: multiplier, Dex: dex}
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
