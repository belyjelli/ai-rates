package binancefapi

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// NOW is the instant aster.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_147_709_400

const hour = int64(3_600_000)

func fixtureDir(tb testing.TB, venue string) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", venue)
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatalf("could not find packages/adapters/__fixtures__/%s above the working directory", venue)
	return ""
}

// fixtureBytes reads a fixture verbatim, for tests that feed it through a fake transport rather
// than decoding it directly.
func fixtureBytes(tb testing.TB, venue, name string) []byte {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb, venue), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	return raw
}

// These are the SAME files packages/adapters/src/venues/aster.test.ts reads.
func load[T any](tb testing.TB, venue, name string, into *T) {
	tb.Helper()
	if err := json.Unmarshal(fixtureBytes(tb, venue, name), into); err != nil {
		tb.Fatalf("decode %s/%s: %v", venue, name, err)
	}
}

func f64(tb testing.TB, label string, got *float64) float64 {
	tb.Helper()
	if got == nil {
		tb.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func eq[T comparable](tb testing.TB, label string, got, want T) {
	tb.Helper()
	if got != want {
		tb.Errorf("%s: got %v, want %v", label, got, want)
	}
}

func bySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func asterInput(tb testing.TB) SnapshotInput {
	tb.Helper()
	var info ExchangeInfo
	var premium []PremiumIndex
	var fundingInfo []FundingInfo
	var tickers []Ticker24h
	load(tb, "aster", "exchangeInfo", &info)
	load(tb, "aster", "premiumIndex", &premium)
	load(tb, "aster", "fundingInfo", &fundingInfo)
	load(tb, "aster", "ticker24hr", &tickers)

	return SnapshotInput{
		Premium:     premium,
		FundingInfo: fundingInfo,
		Tickers:     tickers,
		Tradable:    TradablePerpetuals(info, AsterAssetClass, nil),
	}
}

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	snapshots := ParseSnapshots("aster", asterInput(t), NOW)

	got := bySymbol(snapshots, "BTCUSDT")
	if got == nil {
		t.Fatal("BTCUSDT missing")
	}
	eq(t, "venueId", got.VenueID, "aster")
	eq(t, "base", got.Base, "BTC")
	if got.Quote == nil || *got.Quote != "USDT" {
		t.Errorf("quote: got %v, want USDT", got.Quote)
	}
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %v, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	eq(t, "rate", got.Rate, 0.00003274)
	eq(t, "basisHours", got.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 8.0)
	if got.NextFundingAt == nil || *got.NextFundingAt != 1_789_171_200_000 {
		t.Errorf("nextFundingAt: got %v, want 1789171200000", got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 77852.06061232)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 77866.89217391)
	// Binance-style APIs expose open interest only per symbol, so the bulk cycle leaves it null.
	if got.OpenInterestUSD != nil {
		t.Errorf("openInterestUsd: got %v, want nil", *got.OpenInterestUSD)
	}
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 1059790811.37)
}

func TestParseSnapshotsUsesFundingInfoInterval(t *testing.T) {
	snapshots := ParseSnapshots("aster", asterInput(t), NOW)

	sushi := bySymbol(snapshots, "SUSHIUSDT")
	if sushi == nil {
		t.Fatal("SUSHIUSDT missing")
	}
	eq(t, "rate", sushi.Rate, -0.00000112)
	eq(t, "basisHours", sushi.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", sushi.IntervalHours), 1.0)
	if sushi.NextFundingAt == nil || *sushi.NextFundingAt != 1_789_149_600_000 {
		t.Errorf("nextFundingAt: got %v, want 1789149600000", sushi.NextFundingAt)
	}
	eq(t, "volume24hUsd", f64(t, "volume", sushi.Volume24hUSD), 12455.67)
}

func TestParseSnapshotsSkipsNonTradingPerpetuals(t *testing.T) {
	snapshots := ParseSnapshots("aster", asterInput(t), NOW)

	symbols := make([]string, 0, len(snapshots))
	for _, s := range snapshots {
		symbols = append(symbols, s.VenueSymbol)
	}
	sort.Strings(symbols)
	want := []string{"BTCUSDT", "ETHUSDT", "SUSHIUSDT"}
	if len(symbols) != len(want) {
		t.Fatalf("got %v, want %v", symbols, want)
	}
	for i := range want {
		eq(t, "symbol", symbols[i], want[i])
	}

	// A SETTLING market is not collected.
	settling := "SETTLING"
	info := ExchangeInfo{Symbols: []Symbol{
		{Symbol: "TONUSDT", Status: &settling, ContractType: "PERPETUAL"},
	}}
	if got := TradablePerpetuals(info, AsterAssetClass, nil); len(got) != 0 {
		t.Errorf("settling: got %d tradable, want 0", len(got))
	}
}

func TestParseSnapshotsSkipsSymbolsMissingFromFundingInfo(t *testing.T) {
	input := asterInput(t)
	filtered := make([]FundingInfo, 0, len(input.FundingInfo))
	for _, info := range input.FundingInfo {
		if info.Symbol != "ETHUSDT" {
			filtered = append(filtered, info)
		}
	}
	input.FundingInfo = filtered

	if bySymbol(ParseSnapshots("aster", input, NOW), "ETHUSDT") != nil {
		t.Error("a symbol with no interval must be skipped, not guessed")
	}

	// Unless a member declares a default, which none measured so far does.
	eight := 8.0
	input.DefaultIntervalHours = &eight
	eth := bySymbol(ParseSnapshots("binance", input, NOW), "ETHUSDT")
	if eth == nil {
		t.Fatal("ETHUSDT missing with a default interval")
	}
	eq(t, "venueId", eth.VenueID, "binance")
	eq(t, "basisHours", eth.BasisHours, 8.0)
}

func TestAsterAssetClassReadsTagsNotUnderlyingType(t *testing.T) {
	var info ExchangeInfo
	load(t, "aster", "exchangeInfo_tradfi", &info)

	row := func(symbol string) Symbol {
		for _, s := range info.Symbols {
			if s.Symbol == symbol {
				return s
			}
		}
		t.Fatalf("%s missing from the tradfi fixture", symbol)
		return Symbol{}
	}

	// underlyingType is COIN even on gold, so the tags are the declaration.
	gold := row("XAUUSDT")
	if gold.UnderlyingType == nil || *gold.UnderlyingType != "COIN" {
		t.Errorf("XAUUSDT underlyingType: got %v, want COIN", gold.UnderlyingType)
	}
	eq(t, "XAUUSDT", AsterAssetClass(gold), core.ClassCommodity)
	eq(t, "CLUSD1", AsterAssetClass(row("CLUSD1")), core.ClassCommodity)
	eq(t, "OPENAIUSDT", AsterAssetClass(row("OPENAIUSDT")), core.ClassEquity)
	eq(t, "BBXUSDT", AsterAssetClass(row("BBXUSDT")), core.ClassEquity)
	eq(t, "STXXUSDT", AsterAssetClass(row("STXXUSDT")), core.ClassEquity)
	eq(t, "SPYUSDT", AsterAssetClass(row("SPYUSDT")), core.ClassEquity)
	// RateX, symbolType 0. Raytheon is RTX on gate; here it is a token.
	eq(t, "RTXUSDT", AsterAssetClass(row("RTXUSDT")), core.ClassCrypto)

	// symbolType 1 marks exactly the rows the tags call tradfi, across every row.
	for _, s := range info.Symbols {
		isTradfi := AsterAssetClass(s) != core.ClassCrypto
		if isTradfi != (s.SymbolType == 1) {
			t.Errorf("%s: class says tradfi=%v, symbolType says %d", s.Symbol, isTradfi, s.SymbolType)
		}
	}

	// A row flagged tradfi with tags new to us is not defaulted to crypto.
	unknownTags := row("XAUUSDT")
	unknownTags.UnderlyingSubType = []string{"Metals"}
	eq(t, "unknown tags", AsterAssetClass(unknownTags), core.ClassCommodity)
}

func TestDeclaredMarketBase(t *testing.T) {
	sym := func(symbol, base, quote string) Symbol {
		status, b, q := "TRADING", base, quote
		return Symbol{Symbol: symbol, Status: &status, ContractType: "PERPETUAL", BaseAsset: &b, QuoteAsset: &q}
	}
	got := func(s Symbol) string {
		if b := DeclaredMarketBase(s); b != nil {
			return *b
		}
		return "<nil>"
	}

	// Quotes the parser does not know left the whole symbol as the base.
	eq(t, "BTCUSD1", got(sym("BTCUSD1", "BTC", "USD1")), "BTC")
	eq(t, "XAUUSD1", got(sym("XAUUSD1", "XAU", "USD1")), "XAU")
	eq(t, "BTCU", got(sym("BTCU", "BTC", "U")), "BTC")
	// A hyphen inside the base cut it to B: a 0.0043 token filed in the 0.217 token's pool.
	eq(t, "B-MONEYUSDT", got(sym("B-MONEYUSDT", "B-MONEY", "USDT")), "B-MONEY")

	// Left alone where the parser already agrees, or reads a contract size.
	eq(t, "BTCUSDT", got(sym("BTCUSDT", "BTC", "USDT")), "<nil>")
	eq(t, "1000PEPEUSDT", got(sym("1000PEPEUSDT", "1000PEPE", "USDT")), "<nil>")
	eq(t, "XBTUSDT", got(sym("XBTUSDT", "XBT", "USDT")), "<nil>")

	// Never moves a market priced in something other than dollars into a dollar pool.
	eq(t, "ETHBTC", got(sym("ETHBTC", "ETH", "BTC")), "<nil>")
	noBase := sym("BTCUSD1", "BTC", "USD1")
	noBase.BaseAsset = nil
	eq(t, "no declared base", got(noBase), "<nil>")
}

// TestBasisHoursFromGaps moved with the function it covers, to internal/adapters. Its four pinned
// cases went with it unchanged.

func TestParseFundingHistory(t *testing.T) {
	var rows []FundingRate
	load(t, "aster", "fundingRate_BTCUSDT", &rows)

	// Reversed on the way in: the parser sorts, so wire order must not matter.
	shuffled := make([]FundingRate, 0, len(rows))
	for i := len(rows) - 1; i >= 0; i-- {
		shuffled = append(shuffled, rows[i])
	}

	events := ParseFundingHistory("aster", "BTCUSDT", shuffled, 0, 1<<62, nil, nil, HistoryOptions{})
	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_027_200_000, 0.00008093, 8},
		{1_789_056_000_000, 0.00006482, 8},
		{1_789_084_800_000, 0.00004447, 8},
		{1_789_113_600_000, 0.00004761, 8},
		{1_789_142_400_000, 0.00002863, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("got %d events, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueId", events[0].VenueID, "aster")
	eq(t, "base", events[0].Base, "BTC")
	eq(t, "assetClass", events[0].AssetClass, core.ClassCrypto)

	// History carries the class it is given, so a commodity's settlements never read as crypto.
	commodity := core.ClassCommodity
	gold := ParseFundingHistory("aster", "XAUUSDT", rows, 0, 1<<62, nil, &commodity, HistoryOptions{})
	if len(gold) == 0 {
		t.Fatal("no events for XAUUSDT")
	}
	for _, e := range gold {
		eq(t, "XAU class", e.AssetClass, core.ClassCommodity)
		eq(t, "XAU base", e.Base, "XAU")
	}
}

func TestAttachOpenInterestPricesContractsWithTheVenuesOwnMark(t *testing.T) {
	snapshots := ParseSnapshots("aster", asterInput(t), NOW)
	cache := map[string]OpenInterestEntry{"BTCUSDT": {Contracts: 6052.531, FetchedAt: NOW}}

	attached := AttachOpenInterest(snapshots, cache)

	btc := bySymbol(attached, "BTCUSDT")
	if btc == nil {
		t.Fatal("BTCUSDT missing")
	}
	// Compared within a tolerance, as the TypeScript test does with toBeCloseTo, and for the same
	// reason: a Go constant expression is evaluated in arbitrary precision and rounded ONCE, while
	// the runtime path rounds the decoded mark price and then rounds the product. Exact equality
	// here fails by one ulp and says nothing about whether the arithmetic is right.
	got := f64(t, "oi", btc.OpenInterestUSD)
	want := 6052.531 * 77852.06061232
	if diff := got - want; diff > 1e-4 || diff < -1e-4 {
		t.Errorf("openInterestUsd: got %v, want %v", got, want)
	}

	// Symbols not yet in the rotation keep a null rather than a wrong number.
	eth := bySymbol(attached, "ETHUSDT")
	if eth == nil {
		t.Fatal("ETHUSDT missing")
	}
	if eth.OpenInterestUSD != nil {
		t.Errorf("ETHUSDT open interest: got %v, want nil", *eth.OpenInterestUSD)
	}
}
