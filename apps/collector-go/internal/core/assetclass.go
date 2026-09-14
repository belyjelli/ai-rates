package core

// indexBases are canonical bases (after CanonicalBase) that are market indices rather than single
// names.
//
// WHY A TABLE AT ALL, when class is meant to be declared: venues agree on crypto versus not-crypto,
// and disagree on where equity ends and index begins. OKX files US500, US100, JP225 and KR200 under
// instCategory 3 (Stocks); gate calls the same markets `indices`; MEXC's `stockindex` plate covers
// both the S&P 500 and sixty ETFs. Taking each label literally would split US500 — a pool that
// pairs today across okx, lighter, paradex, gate, mexc and hl-xyz — into an equity half and an
// index half.
//
// So the venue's declaration is always the authority on WHETHER a market is tradfi, and this table
// only settles WHICH tradfi class, between two that venues use interchangeably. It is never applied
// to a market its venue declared crypto: SPX stays SPX6900 however it is spelt.
//
// ETFs are equity, whatever the venue calls them: Binance, Aster, Bybit, KuCoin and OKX all file
// SPY and QQQ that way, against WEEX and MEXC calling them indices. Five venues to two.
var indexBases = map[string]struct{}{
	// United States
	"US500": {}, "US100": {}, "NAS100": {}, "USTECH": {}, "XYZ100": {},
	"US30": {}, "US2000": {}, "SMALL2000": {},
	// Europe and Asia-Pacific
	"GER40": {}, "UK100": {}, "JP225": {}, "JPN225": {}, "HK50": {}, "HSCHKD": {},
	"AUS200": {}, "KR200": {}, "KOSPI": {}, "TW88": {}, "NIFTY": {}, "IBOV": {},
	// Volatility, rates and other benchmarks
	"VIX": {}, "VOL": {}, "VOLX": {}, "GVZ": {}, "BVOL": {}, "EVOL": {},
	"B200": {}, "H100": {}, "10Y": {}, "US10Y": {},
	// HTX's declared index, marking 29,044; Extended's TECH100M aliases here. Not merged with
	// NAS100, US100 or XYZ100: that pool is fragmented four ways and wants return correlation, not
	// price proximity, before any merge (USTECH at ~707 is a 41x scale variant).
	"NASDAQ100": {},
}

// tokenisedBases are canonical bases that are tokens tracking something off-chain, and so crypto
// whatever a venue files them under.
//
// PAXG and XAUT are ERC-20s redeemable for gold. Bybit, Binance and dYdX call them crypto; gate and
// KuCoin call them metals; Aster calls them commodities. Their marks sit near XAU but they never
// share its base, so the only effect of a literal reading would be to split PAXG against PAXG.
// USDC is gate's `forex` stablecoin.
var tokenisedBases = map[string]struct{}{"PAXG": {}, "XAUT": {}, "USDC": {}}

// commodityBases covers venues that declare only "this is not crypto" — Paradex's RWA tag,
// Lighter's RWA listing, dYdX's two non-crypto markets.
var commodityBases = map[string]struct{}{
	"XAU": {}, "XAG": {}, "XPT": {}, "XPD": {}, "XCU": {}, "COPPER": {},
	"XAL": {}, "XNI": {}, "XPB": {},
	"CL": {}, "BZ": {}, "BRENTOIL": {}, "USOIL": {}, "OIL": {}, "NATGAS": {}, "URANIUM": {},
	// Measured 2026-09-13. Toobit's crude contracts mark with their pools: XTI 98.78 against CL's
	// 98.74, XBR 103.15 against BZ's 103.10. Toobit flags them isRwa with rwaType STOCK, so without
	// these rows they fell through to equity.
	"XTI": {}, "XBR": {},
	// LBank's soft commodities, the instruments it suspends out of hours. They fell through to
	// equity; WHEAT already sits under commodity on Lighter at 7.227 against LBank's 7.259.
	"SUGAR": {}, "COCOA": {}, "COTTON": {}, "SOYBEAN": {}, "WHEAT": {},
}

var fxBases = map[string]struct{}{
	"EUR": {}, "EURUSD": {}, "GBP": {}, "GBPUSD": {}, "JPY": {}, "USDJPY": {},
	"AUD": {}, "AUDUSD": {}, "USDCAD": {}, "USDHKD": {}, "USDKRW": {}, "TRY": {},
}

// RefineAssetClass is the class a market ends up with, given what its venue declared and its
// canonical base.
//
// Crypto is final: a venue's word that a market is crypto is never overridden from the ticker,
// since every collision this exists to separate (STX, BB, CAT, ON) is a correctly named crypto
// ticker.
func RefineAssetClass(declared AssetClass, base string) AssetClass {
	if declared == ClassCrypto {
		return ClassCrypto
	}
	if _, tokenised := tokenisedBases[base]; tokenised {
		return ClassCrypto
	}
	if declared == ClassEquity || declared == ClassIndex {
		if _, isIndex := indexBases[base]; isIndex {
			return ClassIndex
		}
		return ClassEquity
	}
	return declared
}

// ClassifyNonCrypto is the class of a market whose venue declares only that it is NOT crypto.
//
// Commodity and currency tables first, then the index table, then equity. Only for venues with a
// real not-crypto signal; applying it to an undeclared market would read the class off the ticker,
// which is exactly what the identity work exists to stop.
func ClassifyNonCrypto(base string) AssetClass {
	if _, tokenised := tokenisedBases[base]; tokenised {
		return ClassCrypto
	}
	if _, isCommodity := commodityBases[base]; isCommodity {
		return ClassCommodity
	}
	if _, isFX := fxBases[base]; isFX {
		return ClassFX
	}
	if _, isIndex := indexBases[base]; isIndex {
		return ClassIndex
	}
	return ClassEquity
}
