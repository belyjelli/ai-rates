package mexc

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instant mexc.test.ts uses -- shortly after the fixtures were recorded -- so both suites
// pin identical output.
const NOW int64 = 1_789_147_709_400

const HOUR int64 = 3_600_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "mexc")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/mexc above the working directory")
	return ""
}

// rawFixture is one of the SAME files packages/adapters/src/venues/mexc.test.ts reads.
func rawFixture(tb testing.TB, name string) string {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	return string(raw)
}

func load[T any](tb testing.TB, name string, into *T) {
	tb.Helper()
	if err := json.Unmarshal([]byte(rawFixture(tb, name)), into); err != nil {
		tb.Fatalf("decode %s: %v", name, err)
	}
}

func detailFixture(tb testing.TB) []ContractDetail {
	tb.Helper()
	var env Envelope[[]ContractDetail]
	load(tb, "detail", &env)
	data, err := env.unwrap("contract detail")
	if err != nil {
		tb.Fatal(err)
	}
	return data
}

func tickerFixture(tb testing.TB) []Ticker {
	tb.Helper()
	var env Envelope[[]Ticker]
	load(tb, "ticker", &env)
	data, err := env.unwrap("ticker")
	if err != nil {
		tb.Fatal(err)
	}
	return data
}

func rateFixture(tb testing.TB, symbol string) FundingRate {
	tb.Helper()
	var env Envelope[FundingRate]
	load(tb, "funding_rate_"+symbol, &env)
	data, err := env.unwrap("funding rate")
	if err != nil {
		tb.Fatal(err)
	}
	return data
}

func historyFixture(tb testing.TB) FundingHistoryPage {
	tb.Helper()
	var env Envelope[FundingHistoryPage]
	load(tb, "funding_rate_history_BTC_USDT", &env)
	data, err := env.unwrap("funding history")
	if err != nil {
		tb.Fatal(err)
	}
	return data
}

func intervalsFor(tb testing.TB, symbols ...string) map[string]IntervalEntry {
	tb.Helper()
	intervals := make(map[string]IntervalEntry, len(symbols))
	for _, symbol := range symbols {
		entry := ParseFundingRate(rateFixture(tb, symbol), NOW)
		if entry == nil {
			tb.Fatalf("%s: no interval parsed from the fixture", symbol)
		}
		intervals[symbol] = *entry
	}
	return intervals
}

// num builds a present numeric the way the wire decode would. adapters.Num has no MarshalJSON, so
// synthetic inputs are constructed as values rather than round-tripped through JSON.
func num(v float64) adapters.Num { return adapters.Num{Val: v, OK: true} }

func eq[T comparable](tb testing.TB, label string, got, want T) {
	tb.Helper()
	if got != want {
		tb.Errorf("%s: got %v, want %v", label, got, want)
	}
}

func f64(tb testing.TB, label string, got *float64) float64 {
	tb.Helper()
	if got == nil {
		tb.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func i64(tb testing.TB, label string, got *int64) int64 {
	tb.Helper()
	if got == nil {
		tb.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func str(tb testing.TB, label string, got *string) string {
	tb.Helper()
	if got == nil {
		tb.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func closeTo(tb testing.TB, label string, got, want, tolerance float64) {
	tb.Helper()
	if diff := got - want; diff > tolerance || diff < -tolerance {
		tb.Errorf("%s: got %v, want %v (within %v)", label, got, want, tolerance)
	}
}

func find(tb testing.TB, snapshots []core.FundingSnapshot, symbol string) core.FundingSnapshot {
	tb.Helper()
	for _, snapshot := range snapshots {
		if snapshot.VenueSymbol == symbol {
			return snapshot
		}
	}
	tb.Fatalf("no snapshot for %s", symbol)
	return core.FundingSnapshot{}
}

func symbolsOf(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for _, snapshot := range snapshots {
		out = append(out, snapshot.VenueSymbol)
	}
	return out
}

func syntheticTicker(symbol string) Ticker {
	return Ticker{
		Symbol:      symbol,
		FundingRate: num(0.0001),
		FairPrice:   num(100),
		IndexPrice:  num(100),
		HoldVol:     num(1000),
		Amount24:    num(5000),
	}
}

func fixtureSnapshots(tb testing.TB) []core.FundingSnapshot {
	tb.Helper()
	return ParseSnapshots(
		tickerFixture(tb),
		ParseContracts(detailFixture(tb)),
		intervalsFor(tb, "BTC_USDT", "ETH_USDT", "XAU_USDT"),
		NOW,
	)
}

func TestParseSnapshotsNormalizesBTC(t *testing.T) {
	got := find(t, fixtureSnapshots(t), "BTC_USDT")

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "venueSymbol", got.VenueSymbol, "BTC_USDT")
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %v, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	eq(t, "rate", got.Rate, 0.000029)
	eq(t, "basisHours", got.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 8.0)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", got.NextFundingAt), int64(1_789_171_200_000))
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 77825.6)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 77863.3)

	// Computed from runtime float64s, in the same order adapters.Mul accumulates: a constant
	// expression here would be folded at arbitrary precision and could differ in the last ulp.
	holdVol, contractSize, mark := 417583841.0, 0.0001, 77825.6
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), holdVol*contractSize*mark)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 4750304885.22576)
}

func TestParseSnapshotsUsesPerSymbolIntervalForXAU(t *testing.T) {
	got := find(t, fixtureSnapshots(t), "XAU_USDT")

	eq(t, "rate", got.Rate, 0.000147)
	eq(t, "basisHours", got.BasisHours, 4.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 4.0)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", got.NextFundingAt), int64(1_789_156_800_000))

	holdVol, contractSize, mark := 63412274.0, 0.001, 4372.15
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), holdVol*contractSize*mark)
}

func TestParseSnapshotsSkipsUnlistedAndUnknownInterval(t *testing.T) {
	// TON_USDT is in the ticker but not in contract detail, so it has no live contract.
	got := symbolsOf(fixtureSnapshots(t))
	want := []string{"BTC_USDT", "ETH_USDT", "XAU_USDT"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("symbols: got %v, want %v", got, want)
	}

	partial := ParseSnapshots(
		tickerFixture(t),
		ParseContracts(detailFixture(t)),
		intervalsFor(t, "BTC_USDT"),
		NOW,
	)
	if got := symbolsOf(partial); strings.Join(got, ",") != "BTC_USDT" {
		t.Errorf("partial symbols: got %v, want [BTC_USDT]", got)
	}
}

func TestParseContractsSkipsNonLiveState(t *testing.T) {
	details := detailFixture(t)
	kept := make([]ContractDetail, 0, len(details))
	for _, detail := range details {
		if detail.Symbol != "ETH_USDT" {
			kept = append(kept, detail)
		}
	}
	offline := details[1]
	eq(t, "fixture[1]", offline.Symbol, "ETH_USDT")
	offline.State = 3
	kept = append(kept, offline)

	if _, live := ParseContracts(kept)["ETH_USDT"]; live {
		t.Error("ETH_USDT: state 3 should not be live")
	}
}

func TestParseSnapshotsSizesCoinSettledContractsInUSD(t *testing.T) {
	// Values from the live BTC_USD contract: 100 USD per contract, settles and reports turnover in
	// BTC.
	snapshots := ParseSnapshots(
		[]Ticker{{
			Symbol:      "BTC_USD",
			FundingRate: num(0.0001),
			FairPrice:   num(77736.9),
			IndexPrice:  num(77740),
			HoldVol:     num(972359),
			Amount24:    num(226.0459835749633),
		}},
		map[string]ContractDetail{"BTC_USD": {
			Symbol:       "BTC_USD",
			BaseCoin:     "BTC",
			QuoteCoin:    "USD",
			SettleCoin:   "BTC",
			ContractSize: num(100),
			State:        0,
		}},
		map[string]IntervalEntry{"BTC_USD": {Hours: 8, NextSettleTime: nil, FetchedAt: NOW}},
		NOW,
	)
	if len(snapshots) != 1 {
		t.Fatalf("snapshots: got %d, want 1", len(snapshots))
	}

	holdVol, contractSize := 972359.0, 100.0
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", snapshots[0].OpenInterestUSD), holdVol*contractSize)

	amount24, mark := 226.0459835749633, 77736.9
	closeTo(t, "volume24hUsd", f64(t, "volume24hUsd", snapshots[0].Volume24hUSD), amount24*mark, 1e-6)
}

// ParseSnapshots iterates TICKERS, so the fixture contracts need tickers to be reachable. Without
// this the resolver is only unit-tested and the wiring at the MarketRefFor call is not.
func TestDeclaredBaseReachesTheSnapshot(t *testing.T) {
	declared := []string{"MUSTOCK_USDT", "CATSTOCK_USDT", "LONGXIA_USDT", "SPX500_USDT", "XAU_USDT"}
	synthetic := make([]Ticker, 0, len(declared))
	intervals := make(map[string]IntervalEntry, len(declared))
	next := NOW + HOUR
	for _, symbol := range declared {
		synthetic = append(synthetic, syntheticTicker(symbol))
		intervals[symbol] = IntervalEntry{Hours: 8, NextSettleTime: &next, FetchedAt: NOW}
	}

	snapshots := ParseSnapshots(synthetic, ParseContracts(detailFixture(t)), intervals, NOW)
	bases := make(map[string]string, len(snapshots))
	classes := make(map[string]core.AssetClass, len(snapshots))
	for _, snapshot := range snapshots {
		bases[snapshot.VenueSymbol] = snapshot.Base
		classes[snapshot.VenueSymbol] = snapshot.AssetClass
	}

	// MEXC's own UI shows MUSTOCK_USDT as MU; 356 contracts rename this way.
	eq(t, "MUSTOCK_USDT base", bases["MUSTOCK_USDT"], "MU")
	// MEXC declares SP500; the alias map carries it to US500, where four venues already are.
	eq(t, "SPX500_USDT base", bases["SPX500_USDT"], "US500")
	// CAT is a memecoin AND Caterpillar, 387,440,758x apart. MEXC withholds the rename on exactly
	// these, and the adapter never strips the suffix. The alias table then maps CATSTOCK to CAT on
	// same-class price evidence; asset class (equity, not crypto) is what keeps it from the memecoin.
	eq(t, "CATSTOCK_USDT base", bases["CATSTOCK_USDT"], "CAT")
	// A display name that is not a ticker falls back to the contract code.
	eq(t, "LONGXIA_USDT base", bases["LONGXIA_USDT"], "LONGXIA")
	// Live MEXC returns GOLD(XAU) here, and XAU is where eight venues already quote gold.
	eq(t, "XAU_USDT base", bases["XAU_USDT"], "XAU")

	eq(t, "MUSTOCK_USDT class", classes["MUSTOCK_USDT"], core.ClassEquity)
	eq(t, "CATSTOCK_USDT class", classes["CATSTOCK_USDT"], core.ClassEquity)
	eq(t, "LONGXIA_USDT class", classes["LONGXIA_USDT"], core.ClassCrypto)
	eq(t, "SPX500_USDT class", classes["SPX500_USDT"], core.ClassIndex)
	eq(t, "XAU_USDT class", classes["XAU_USDT"], core.ClassCommodity)
}

// Identity fields exactly as contract/detail returned them on 2026-09-14; sizing is not under test.
func TestAssetClassFromPlates(t *testing.T) {
	live := []ContractDetail{
		{Symbol: "XAU_USDT", BaseCoin: "XAU", BaseCoinName: "GOLD(XAU)", Type: 1, ConceptPlate: []string{
			"mc-trade-zone-metals", "mc-trade-zone-tradfi", "mc-trade-zone-metalsfutures",
			"mc-trade-zone-Commodities"}},
		{Symbol: "USOIL_USDT", BaseCoin: "USOIL", BaseCoinName: "OIL(WTI)", Type: 2, ConceptPlate: []string{
			"mc-trade-zone-0fees", "mc-trade-zone-OIL", "mc-trade-zone-tradfi"}},
		{Symbol: "NGAS_USDT", BaseCoin: "NGAS", BaseCoinName: "GAS(NG)", Type: 2, ConceptPlate: []string{
			"mc-trade-zone-0fees", "mc-trade-zone-tradfi", "mc-trade-zone-Commodities"}},
		{Symbol: "EUR_USDT", BaseCoin: "EUR", BaseCoinName: "EUR", Type: 1, ConceptPlate: []string{
			"mc-trade-zone-web3", "mc-trade-zone-tradfi", "mc-trade-zone-Forex"}},
		{Symbol: "SPX500_USDT", BaseCoin: "SPX500", BaseCoinName: "SP500", Type: 2, ConceptPlate: []string{
			"mc-trade-zone-Stock", "mc-trade-zone-0fees", "mc-trade-zone-tradfi",
			"mc-trade-zone-stockindex"}},
		{Symbol: "QQQSTOCK_USDT", BaseCoin: "QQQSTOCK", BaseCoinName: "QQQ", Type: 2, ConceptPlate: []string{
			"mc-trade-zone-Stock", "mc-trade-zone-0fees", "mc-trade-zone-tradfi",
			"mc-trade-zone-stockindex"}},
		{Symbol: "MUSTOCK_USDT", BaseCoin: "MUSTOCK", BaseCoinName: "MU", Type: 2, ConceptPlate: []string{
			"mc-trade-zone-Stock", "mc-trade-zone-0fees", "mc-trade-zone-tradfi",
			"mc-trade-zone-semiconductors", "mc-trade-zone-AICompute", "mc-trade-zone-aistorage",
			"mc-trade-zone-aisemiconductors"}},
		{Symbol: "CATSTOCK_USDT", BaseCoin: "CATSTOCK", BaseCoinName: "CATSTOCK", Type: 2, ConceptPlate: []string{
			"mc-trade-zone-Stock", "mc-trade-zone-0fees", "mc-trade-zone-tradfi"}},
		{Symbol: "STXSTOCK_USDT", BaseCoin: "STXSTOCK", BaseCoinName: "STXSTOCK", Type: 2, ConceptPlate: []string{
			"mc-trade-zone-Stock", "mc-trade-zone-0fees", "mc-trade-zone-tradfi",
			"mc-trade-zone-AICompute", "mc-trade-zone-aistorage"}},
		{Symbol: "BBSTOCK_USDT", BaseCoin: "BBSTOCK", BaseCoinName: "BBSTOCK", Type: 2, ConceptPlate: []string{
			"mc-trade-zone-Stock", "mc-trade-zone-0fees", "mc-trade-zone-tradfi",
			"mc-trade-zone-aiapplicationlayer"}},
		{Symbol: "KIMISTOCK_USDT", BaseCoin: "KIMISTOCK", BaseCoinName: "MOONSHOT", Type: 1, ConceptPlate: []string{
			"mc-trade-zone-Stock", "mc-trade-zone-preipo", "mc-trade-zone-0fees",
			"mc-trade-zone-tradfi"}},
		{Symbol: "PAXG_USDT", BaseCoin: "PAXG", BaseCoinName: "GOLD(PAXG)", Type: 1, ConceptPlate: []string{
			"mc-trade-zone-metals", "mc-trade-zone-tradfi", "mc-trade-zone-metalsfutures",
			"mc-trade-zone-Commodities"}},
		{Symbol: "BB_USDT", BaseCoin: "BB", BaseCoinName: "BB", Type: 1, ConceptPlate: []string{}},
		{Symbol: "PONS_USDT", BaseCoin: "PONS", BaseCoinName: "PONS", Type: 1, ConceptPlate: []string{
			"mc-trade-zone-robinhood", "mc-trade-zone-MEME", "mc-trade-zone-0fees"}},
	}

	tickers := make([]Ticker, 0, len(live))
	intervals := make(map[string]IntervalEntry, len(live))
	for i := range live {
		live[i].QuoteCoin = "USDT"
		live[i].SettleCoin = "USDT"
		live[i].ContractSize = num(1)
		live[i].State = 0
		tickers = append(tickers, syntheticTicker(live[i].Symbol))
		intervals[live[i].Symbol] = IntervalEntry{Hours: 8, NextSettleTime: nil, FetchedAt: NOW}
	}

	type row struct {
		symbol string
		base   string
		class  core.AssetClass
	}
	want := []row{
		{"XAU_USDT", "XAU", core.ClassCommodity},
		{"USOIL_USDT", "CL", core.ClassCommodity},
		{"NGAS_USDT", "NATGAS", core.ClassCommodity},
		{"EUR_USDT", "EUR", core.ClassFX},
		// Stock and stockindex both: the index plate wins, and the alias reaches US500.
		{"SPX500_USDT", "US500", core.ClassIndex},
		// MEXC calls QQQ an index; the tables file ETFs as equity, as five other venues do.
		{"QQQSTOCK_USDT", "QQQ", core.ClassEquity},
		{"MUSTOCK_USDT", "MU", core.ClassEquity},
		// The withheld renames stay withheld, and are equity whatever crypto ticker hides inside.
		{"CATSTOCK_USDT", "CAT", core.ClassEquity},
		{"STXSTOCK_USDT", "STXSTOCK", core.ClassEquity},
		{"BBSTOCK_USDT", "BBSTOCK", core.ClassEquity},
		// Pre-IPO, and type 1 despite being tradfi: the plates are the signal, not the type.
		{"KIMISTOCK_USDT", "MOONSHOT", core.ClassEquity},
		// Plated as a commodity, but a gold token, crypto on every venue.
		{"PAXG_USDT", "PAXG", core.ClassCrypto},
		// BounceBit: no plates at all.
		{"BB_USDT", "BB", core.ClassCrypto},
		// The robinhood plate holds memecoins, not stocks.
		{"PONS_USDT", "PONS", core.ClassCrypto},
	}

	snapshots := ParseSnapshots(tickers, ParseContracts(live), intervals, NOW)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, expected := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, expected.symbol)
		eq(t, expected.symbol+" base", snapshots[i].Base, expected.base)
		eq(t, expected.symbol+" class", snapshots[i].AssetClass, expected.class)
	}
}

func TestDeclaredClassMatchesPlatesWithoutCase(t *testing.T) {
	eq(t, "STOCK", DeclaredClass(ContractDetail{ConceptPlate: []string{"MC-TRADE-ZONE-STOCK"}}, "AAPL"),
		core.ClassEquity)
	eq(t, "stockindex+ETF",
		DeclaredClass(ContractDetail{ConceptPlate: []string{"mc-trade-zone-stockindex", "mc-trade-zone-ETF"}}, "SPY"),
		core.ClassEquity)
	// A bare not-crypto declaration defers to the base tables.
	eq(t, "tradfi XAG", DeclaredClass(ContractDetail{ConceptPlate: []string{"mc-trade-zone-tradfi"}}, "XAG"),
		core.ClassCommodity)
	eq(t, "tradfi NEWCO", DeclaredClass(ContractDetail{ConceptPlate: []string{"mc-trade-zone-tradfi"}}, "NEWCO"),
		core.ClassEquity)
	eq(t, "type 2", DeclaredClass(ContractDetail{Type: 2}, "JP225"), core.ClassIndex)
	eq(t, "RWA", DeclaredClass(ContractDetail{ConceptPlate: []string{"mc-trade-zone-RWA"}, Type: 1}, "ONDO"),
		core.ClassCrypto)
	eq(t, "no plates", DeclaredClass(ContractDetail{}, "XAU"), core.ClassCrypto)
}

func tiersFor(tiers []core.LeverageTier, symbol string) []core.LeverageTier {
	out := make([]core.LeverageTier, 0, len(tiers))
	for _, tier := range tiers {
		if tier.VenueSymbol == symbol {
			out = append(out, tier)
		}
	}
	return out
}

func TestParseLeverageTiersReadsRiskLimitCustom(t *testing.T) {
	btc := tiersFor(ParseLeverageTiers(detailFixture(t)), "BTC_USDT")
	if len(btc) != 6 {
		t.Fatalf("BTC_USDT tiers: got %d, want 6", len(btc))
	}

	// "BY_VOLUME" names the field, not the unit: read as contracts this first band would be ~$386k
	// at 500x, and the top one a $147m position cap, neither of which MEXC offers.
	eq(t, "tier1 venueId", btc[0].VenueID, VenueID)
	eq(t, "tier1 venueSymbol", btc[0].VenueSymbol, "BTC_USDT")
	eq(t, "tier1 tier", btc[0].Tier, 1)
	eq(t, "tier1 lower", btc[0].LowerNotionalUSD, 0.0)
	eq(t, "tier1 upper", f64(t, "tier1 upper", btc[0].UpperNotionalUSD), 50_000.0)
	eq(t, "tier1 imr", btc[0].IMR, 0.002)
	eq(t, "tier1 mmr", f64(t, "tier1 mmr", btc[0].MMR), 0.001)
	eq(t, "tier1 maxLeverage", btc[0].MaxLeverage, 500.0)

	eq(t, "tier2 tier", btc[1].Tier, 2)
	eq(t, "tier2 lower", btc[1].LowerNotionalUSD, 50_000.0)
	eq(t, "tier2 upper", f64(t, "tier2 upper", btc[1].UpperNotionalUSD), 310_000.0)
	eq(t, "tier2 imr", btc[1].IMR, 0.005)
	eq(t, "tier2 maxLeverage", btc[1].MaxLeverage, 200.0)

	// The last band's ceiling is the contract's riskBaseVol: the largest position MEXC carries.
	last := btc[len(btc)-1]
	eq(t, "last tier", last.Tier, 6)
	eq(t, "last upper", f64(t, "last upper", last.UpperNotionalUSD), 19_000_000.0)
	eq(t, "last maxLeverage", last.MaxLeverage, 10.0)
}

// 1035 of MEXC's 1192 live contracts use this form: no enumerated ladder, just a base rate and
// riskBaseVol, with riskLevelLimit 1 confirming there is only one band. riskBaseVol is quote
// notional because on every CUSTOM contract it equals the top maxVol.
func TestParseLeverageTiersIncreaseContractIsOneBand(t *testing.T) {
	tiers := ParseLeverageTiers([]ContractDetail{{
		Symbol:                "ZEC_USDT",
		BaseCoin:              "ZEC",
		QuoteCoin:             "USDT",
		SettleCoin:            "USDT",
		ContractSize:          num(0.01),
		State:                 0,
		RiskLimitMode:         "INCREASE",
		RiskBaseVol:           num(75_000),
		InitialMarginRate:     num(0.01),
		MaintenanceMarginRate: num(0.005),
		MaxLeverage:           num(100),
	}})
	if len(tiers) != 1 {
		t.Fatalf("tiers: got %d, want 1", len(tiers))
	}
	eq(t, "venueId", tiers[0].VenueID, VenueID)
	eq(t, "venueSymbol", tiers[0].VenueSymbol, "ZEC_USDT")
	eq(t, "tier", tiers[0].Tier, 1)
	eq(t, "lower", tiers[0].LowerNotionalUSD, 0.0)
	eq(t, "upper", f64(t, "upper", tiers[0].UpperNotionalUSD), 75_000.0)
	eq(t, "imr", tiers[0].IMR, 0.01)
	eq(t, "mmr", f64(t, "mmr", tiers[0].MMR), 0.005)
	eq(t, "maxLeverage", tiers[0].MaxLeverage, 100.0)
}

func TestParseLeverageTiersKeepsEachLadderLength(t *testing.T) {
	tiers := ParseLeverageTiers(detailFixture(t))
	if got := len(tiersFor(tiers, "ETH_USDT")); got != 6 {
		t.Errorf("ETH_USDT tiers: got %d, want 6", got)
	}
	xau := tiersFor(tiers, "XAU_USDT")
	if len(xau) != 5 {
		t.Fatalf("XAU_USDT tiers: got %d, want 5", len(xau))
	}
	eq(t, "xau tier1 upper", f64(t, "xau tier1 upper", xau[0].UpperNotionalUSD), 80_000.0)
	eq(t, "xau tier1 imr", xau[0].IMR, 0.001)
	eq(t, "xau tier1 maxLeverage", xau[0].MaxLeverage, 1000.0)
}

func TestParseFundingRateReadsCollectCycle(t *testing.T) {
	entry := ParseFundingRate(rateFixture(t, "XAU_USDT"), NOW)
	if entry == nil {
		t.Fatal("XAU_USDT: want an interval entry, got nil")
	}
	eq(t, "hours", entry.Hours, 4.0)
	eq(t, "nextSettleTime", i64(t, "nextSettleTime", entry.NextSettleTime), int64(1_789_156_800_000))
	eq(t, "fetchedAt", entry.FetchedAt, NOW)

	zeroed := rateFixture(t, "XAU_USDT")
	zeroed.CollectCycle = num(0)
	if got := ParseFundingRate(zeroed, NOW); got != nil {
		t.Errorf("collectCycle 0: got %+v, want nil", *got)
	}
}

func TestSelectIntervalRefreshes(t *testing.T) {
	cache := map[string]IntervalEntry{
		"A": {Hours: 8, FetchedAt: NOW - 7*HOUR},
		"B": {Hours: 8, FetchedAt: NOW - 9*HOUR},
		"C": {Hours: 8, FetchedAt: NOW - HOUR},
	}
	symbols := []string{"A", "B", "C", "D", "E"}

	for _, tc := range []struct {
		budget int
		want   string
	}{
		{3, "D,E,B"},
		{10, "D,E,B,A"},
		{0, ""},
	} {
		got := SelectIntervalRefreshes(symbols, cache, NOW, tc.budget, IntervalMaxAgeMs)
		if strings.Join(got, ",") != tc.want {
			t.Errorf("budget %d: got %v, want %q", tc.budget, got, tc.want)
		}
	}
}

func TestNextSettlementAfterRollsForward(t *testing.T) {
	ahead := NOW + HOUR
	eq(t, "future", i64(t, "future", NextSettlementAfter(&ahead, 8, NOW)), NOW+HOUR)

	behind := NOW - HOUR
	eq(t, "one interval", i64(t, "one interval", NextSettlementAfter(&behind, 4, NOW)), NOW+3*HOUR)

	stale := NOW - 9*HOUR
	eq(t, "many intervals", i64(t, "many intervals", NextSettlementAfter(&stale, 4, NOW)), NOW+3*HOUR)

	if got := NextSettlementAfter(nil, 8, NOW); got != nil {
		t.Errorf("nil settlement: got %v, want nil", *got)
	}
}

func TestParseFundingHistoryFiltersAndDedupes(t *testing.T) {
	rows := historyFixture(t).ResultList
	events := ParseFundingHistory(append(append([]FundingHistoryRow(nil), rows...), rows[0]),
		"BTC_USDT", 0, 1<<53)
	if len(events) != 5 {
		t.Fatalf("events: got %d, want 5", len(events))
	}
	eq(t, "venueId", events[0].VenueID, VenueID)
	eq(t, "base", events[0].Base, "BTC")
	eq(t, "settledAt", events[0].SettledAt, int64(1_789_027_200_000))
	eq(t, "rate", events[0].Rate, 0.000079)
}

// ---- adapter ----

// fakeDoer answers from the fixture files by endpoint, recording every URL so the tests can assert
// what was actually requested -- which is the whole point for the detail cache and the interval
// rotation.
type fakeDoer struct {
	bodies map[string]string
	urls   []string
}

func (f *fakeDoer) Do(req *http.Request) (*http.Response, error) {
	f.urls = append(f.urls, req.URL.String())
	path := req.URL.Path

	var body string
	switch {
	case strings.HasSuffix(path, "/detail"):
		body = f.bodies["detail"]
	case strings.HasSuffix(path, "/ticker"):
		body = f.bodies["ticker"]
	case strings.Contains(path, "/funding_rate/history"):
		body = f.bodies["history"]
	case strings.Contains(path, "/funding_rate/"):
		body = f.bodies["rate_"+path[strings.LastIndex(path, "/")+1:]]
	}
	if body == "" {
		return &http.Response{
			StatusCode: 404,
			Body:       io.NopCloser(strings.NewReader("no fixture for " + req.URL.String())),
			Header:     http.Header{},
		}, nil
	}
	return &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{},
	}, nil
}

func (f *fakeDoer) count(substr string) int {
	n := 0
	for _, u := range f.urls {
		if strings.Contains(u, substr) {
			n++
		}
	}
	return n
}

func mexcDoer(tb testing.TB) *fakeDoer {
	tb.Helper()
	return &fakeDoer{bodies: map[string]string{
		"detail":        rawFixture(tb, "detail"),
		"ticker":        rawFixture(tb, "ticker"),
		"history":       rawFixture(tb, "funding_rate_history_BTC_USDT"),
		"rate_BTC_USDT": rawFixture(tb, "funding_rate_BTC_USDT"),
		"rate_ETH_USDT": rawFixture(tb, "funding_rate_ETH_USDT"),
		"rate_XAU_USDT": rawFixture(tb, "funding_rate_XAU_USDT"),
	}}
}

func mexcAdapter(doer *fakeDoer, budget *int) *Adapter {
	// Sleep is a no-op so the suite never spends real time on retry backoff.
	client := httpclient.New(VenueID, httpclient.Options{
		Doer:  doer,
		Sleep: func(context.Context, time.Duration) error { return nil },
	})
	return NewAdapterWithOptions(client, Options{IntervalRefreshBudget: budget})
}

func TestMinIntervalMatchesTypeScript(t *testing.T) {
	eq(t, "MinInterval", MinInterval, 110*time.Millisecond)
}

func TestAdapterFillsIntervalsWithinBudgetAndCachesDetail(t *testing.T) {
	budget := 2
	doer := mexcDoer(t)
	adapter := mexcAdapter(doer, &budget)
	ctx := context.Background()

	first, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("first cycle: %v", err)
	}
	if got := strings.Join(symbolsOf(first.Snapshots), ","); got != "BTC_USDT,ETH_USDT" {
		t.Errorf("first cycle symbols: got %v, want [BTC_USDT ETH_USDT]", got)
	}
	eq(t, "first cycle funding_rate calls", doer.count("/funding_rate/"), 2)

	second, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+60_000))
	if err != nil {
		t.Fatalf("second cycle: %v", err)
	}
	if got := strings.Join(symbolsOf(second.Snapshots), ","); got != "BTC_USDT,ETH_USDT,XAU_USDT" {
		t.Errorf("second cycle symbols: got %v, want all three", got)
	}
	eq(t, "detail calls after two cycles", doer.count("/detail"), 1)

	doer.urls = nil
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+7*HOUR)); err != nil {
		t.Fatalf("third cycle: %v", err)
	}
	// Details older than 1h are refetched, and the two stalest intervals are refreshed.
	eq(t, "third cycle detail calls", doer.count("/detail"), 1)
	eq(t, "third cycle funding_rate calls", doer.count("/funding_rate/"), 2)
}

func TestAdapterWarmUpEmitsKnownMarketsWithoutSpendingBudget(t *testing.T) {
	budget := 0
	doer := mexcDoer(t)
	adapter := mexcAdapter(doer, &budget)

	eight, four := 8.0, 4.0
	adapter.WarmUp([]KnownMarket{
		{VenueSymbol: "BTC_USDT", IntervalHours: &eight},
		{VenueSymbol: "ETH_USDT", IntervalHours: &eight},
		{VenueSymbol: "XAU_USDT", IntervalHours: &four},
		{VenueSymbol: "DELISTED_USDT", IntervalHours: &eight},
		{VenueSymbol: "NO_INTERVAL_USDT", IntervalHours: nil},
	})

	batch, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("cycle: %v", err)
	}

	// All three live markets appear immediately, with no per-symbol funding_rate calls at all.
	if got := strings.Join(symbolsOf(batch.Snapshots), ","); got != "BTC_USDT,ETH_USDT,XAU_USDT" {
		t.Errorf("symbols: got %v, want all three", got)
	}
	eq(t, "funding_rate calls", doer.count("/funding_rate/"), 0)
	// The warmed interval is used, not a guess.
	eq(t, "XAU_USDT basisHours", find(t, batch.Snapshots, "XAU_USDT").BasisHours, 4.0)
	// A market MEXC no longer lists is dropped rather than kept alive by the warm-up.
	for _, symbol := range symbolsOf(batch.Snapshots) {
		if symbol == "DELISTED_USDT" {
			t.Error("DELISTED_USDT: warm-up should not keep an unlisted market alive")
		}
	}
}

func TestAdapterFetchFundingHistoryReturnsOldestFirst(t *testing.T) {
	doer := mexcDoer(t)
	events, err := mexcAdapter(doer, nil).FetchFundingHistory(
		context.Background(), "BTC_USDT", 1_789_056_000_000, 1_789_142_400_000)
	if err != nil {
		t.Fatalf("history: %v", err)
	}

	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
	}{
		{1_789_056_000_000, 0.000071, 8},
		{1_789_084_800_000, 0.00003, 8},
		{1_789_113_600_000, 0.000061, 8},
		{1_789_142_400_000, 0.000036, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, expected := range want {
		eq(t, "settledAt", events[i].SettledAt, expected.settledAt)
		eq(t, "rate", events[i].Rate, expected.rate)
		eq(t, "basisHours", events[i].BasisHours, expected.basisHours)
	}
}

func TestAdapterFetchLeverageTiersIsComplete(t *testing.T) {
	tiers, complete, err := mexcAdapter(mexcDoer(t), nil).FetchLeverageTiers(context.Background())
	if err != nil {
		t.Fatalf("tiers: %v", err)
	}
	if !complete {
		t.Error("complete: got false, want true for a one-call sweep")
	}
	if got := len(tiersFor(tiers, "BTC_USDT")); got != 6 {
		t.Errorf("BTC_USDT tiers: got %d, want 6", got)
	}
}
