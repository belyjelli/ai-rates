package core

import "testing"

func quoteOf(p ParsedSymbol) string {
	if p.Quote == nil {
		return "<nil>"
	}
	return *p.Quote
}

func dexOf(p ParsedSymbol) string {
	if p.Dex == nil {
		return "<nil>"
	}
	return *p.Dex
}

func TestParseVenueSymbol(t *testing.T) {
	cases := []struct {
		raw        string
		base       string
		quote      string
		multiplier float64
		dex        string
	}{
		// The common CEX shapes.
		{"BTCUSDT", "BTC", "USDT", 1, "<nil>"},
		{"BTC-USDT-SWAP", "BTC", "USDT", 1, "<nil>"},
		{"BTC_USDT", "BTC", "USDT", 1, "<nil>"},
		{"BTC-SWAP-USDT", "BTC", "USDT", 1, "<nil>"},
		{"ETH-PERP", "ETH", "<nil>", 1, "<nil>"},
		{"BTC/USDT:USDT", "BTC", "USDT", 1, "<nil>"},
		// KuCoin's trailing M, which must not be read as part of the base.
		{"XBTUSDTM", "BTC", "USDT", 1, "<nil>"},
		// Contract scale has to reach the multiplier, or prices sit 1000x apart across venues for
		// the same asset — migration 004's bug.
		{"1000PEPEUSDT", "PEPE", "USDT", 1000, "<nil>"},
		{"10000CATUSDT", "CAT", "USDT", 10000, "<nil>"},
		// The kilo prefix is a lowercase k against an uppercase ticker, so it is matched before
		// upper-casing; otherwise it is indistinguishable from a base starting with K.
		{"kBONK", "BONK", "<nil>", 1000, "<nil>"},
		// HIP-3 markets carry their dex.
		{"xyz:XYZ100", "XYZ100", "<nil>", 1, "xyz"},
		// Longest quote wins, so FDUSD is not read as USD with a stray FD on the base.
		{"BTCFDUSD", "BTC", "FDUSD", 1, "<nil>"},
		// Aliases join pools that would otherwise never pair.
		{"XBTUSDT", "BTC", "USDT", 1, "<nil>"},
		{"SP500USDT", "US500", "USDT", 1, "<nil>"},
		{"SPX500USDT", "US500", "USDT", 1, "<nil>"},
		// SPX is the SPX6900 token at ~$0.486, NOT the S&P 500 at ~$7,650. It must stay unaliased.
		{"SPXUSDT", "SPX", "USDT", 1, "<nil>"},
	}

	for _, c := range cases {
		got := ParseVenueSymbol(c.raw)
		if got.Base != c.base {
			t.Errorf("%s base: got %q, want %q", c.raw, got.Base, c.base)
		}
		if quoteOf(got) != c.quote {
			t.Errorf("%s quote: got %s, want %s", c.raw, quoteOf(got), c.quote)
		}
		if got.Multiplier != c.multiplier {
			t.Errorf("%s multiplier: got %v, want %v", c.raw, got.Multiplier, c.multiplier)
		}
		if dexOf(got) != c.dex {
			t.Errorf("%s dex: got %s, want %s", c.raw, dexOf(got), c.dex)
		}
	}
}

func TestCanonicalBaseAppliesAliasesToDeclaredBases(t *testing.T) {
	// A venue-declared base never passes through ParseVenueSymbol, so it would miss the alias map
	// and re-split the pools that map exists to join.
	cases := map[string]string{
		"sp500":  "US500",
		"SPX500": "US500",
		"xbt":    "BTC",
		"GOLD":   "XAU",
		" ng ":   "NATGAS",
		"BTC":    "BTC",
		"SPX":    "SPX",
	}
	for in, want := range cases {
		if got := CanonicalBase(in); got != want {
			t.Errorf("CanonicalBase(%q): got %q, want %q", in, got, want)
		}
	}
}

func TestRefineAssetClassNeverOverridesCrypto(t *testing.T) {
	// Every collision the identity work exists to separate is a correctly named crypto ticker, so a
	// venue's word that a market is crypto is final.
	if got := RefineAssetClass(ClassCrypto, "US500"); got != ClassCrypto {
		t.Errorf("crypto US500: got %v, want crypto", got)
	}
	if got := RefineAssetClass(ClassEquity, "US500"); got != ClassIndex {
		t.Errorf("equity US500: got %v, want index", got)
	}
	if got := RefineAssetClass(ClassEquity, "SPY"); got != ClassEquity {
		t.Errorf("equity SPY: got %v, want equity", got)
	}
	// PAXG and XAUT are ERC-20s redeemable for gold; a literal reading would split PAXG from PAXG.
	if got := RefineAssetClass(ClassCommodity, "XAUT"); got != ClassCrypto {
		t.Errorf("commodity XAUT: got %v, want crypto", got)
	}
}

func TestClassifyNonCrypto(t *testing.T) {
	cases := map[string]AssetClass{
		"XAU":    ClassCommodity,
		"CL":     ClassCommodity,
		"WHEAT":  ClassCommodity,
		"EURUSD": ClassFX,
		"JPY":    ClassFX,
		"US500":  ClassIndex,
		"US10Y":  ClassIndex,
		"TSLA":   ClassEquity,
		"XAUT":   ClassCrypto,
	}
	for base, want := range cases {
		if got := ClassifyNonCrypto(base); got != want {
			t.Errorf("ClassifyNonCrypto(%q): got %v, want %v", base, got, want)
		}
	}
}

func TestInferIntervalHoursSnapsToStandardIntervals(t *testing.T) {
	const h = int64(3_600_000)

	// Eight-hourly settlements, with a little clock skew: must snap to 8, not 7.998.
	eight := []int64{0, 8*h + 900, 16 * h, 24*h - 1200}
	if got := InferIntervalHours(eight); got == nil || *got != 8 {
		t.Errorf("8h with skew: got %v, want 8", got)
	}

	// The median ignores one missed settlement, which is the whole reason it is the median.
	withGap := []int64{0, h, 2 * h, 4 * h, 5 * h}
	if got := InferIntervalHours(withGap); got == nil || *got != 1 {
		t.Errorf("1h with a gap: got %v, want 1", got)
	}

	if got := InferIntervalHours([]int64{42}); got != nil {
		t.Errorf("single timestamp: got %v, want nil", got)
	}
	if got := InferIntervalHours(nil); got != nil {
		t.Errorf("no timestamps: got %v, want nil", got)
	}
}

func TestPerUnitPriceRescalesOnlyScaledContracts(t *testing.T) {
	price := 3.27
	if got := PerUnitPrice(&price, 1000); got == nil || *got != 0.00327 {
		t.Errorf("1000x contract: got %v, want 0.00327", got)
	}
	if got := PerUnitPrice(&price, 1); got == nil || *got != 3.27 {
		t.Errorf("unscaled: got %v, want 3.27", got)
	}
	if got := PerUnitPrice(nil, 1000); got != nil {
		t.Errorf("absent price: got %v, want nil", got)
	}
}

func TestAPRPercent(t *testing.T) {
	// 0.01% per 8h is the ordinary case: 0.0001/8 per hour, annualised on 8760 hours.
	perHour, err := RatePerHour(0.0001, 8)
	if err != nil {
		t.Fatalf("RatePerHour: %v", err)
	}
	want := 0.0001 / 8 * 8760 * 100
	if got := APRPercent(perHour); got != want {
		t.Errorf("APRPercent: got %v, want %v", got, want)
	}
	if _, err := RatePerHour(0.0001, 0); err == nil {
		t.Error("RatePerHour with basisHours 0: want an error, got nil")
	}
}
