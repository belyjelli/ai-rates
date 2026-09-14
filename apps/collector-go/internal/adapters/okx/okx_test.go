package okx

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// The same instant okx.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_147_120_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "okx")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/okx above the working directory")
	return ""
}

// The SAME files packages/adapters/src/venues/okx.test.ts reads.
func load[T any](tb testing.TB, name string, into *T) {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	if err := json.Unmarshal(raw, into); err != nil {
		tb.Fatalf("decode %s: %v", path, err)
	}
}

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

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func batch(tb testing.TB) core.SnapshotBatch {
	tb.Helper()
	var funding Envelope[FundingRate]
	var tickers Envelope[Ticker]
	var openInterest Envelope[OpenInterest]
	var marks Envelope[MarkPrice]
	var instruments Envelope[Instrument]
	load(tb, "funding-rate", &funding)
	load(tb, "tickers", &tickers)
	load(tb, "open-interest", &openInterest)
	load(tb, "mark-price", &marks)
	load(tb, "instruments", &instruments)

	got, err := ParseSnapshots(funding, tickers, openInterest, marks, instruments, NOW)
	if err != nil {
		tb.Fatalf("ParseSnapshots: %v", err)
	}
	return got
}

func TestParseSnapshotsNormalizesBTCUSDTSwap(t *testing.T) {
	got := snapshotBySymbol(batch(t).Snapshots, "BTC-USDT-SWAP")
	if got == nil {
		t.Fatal("BTC-USDT-SWAP missing")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %v, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	eq(t, "rate", got.Rate, 0.0000593556502673)
	eq(t, "basisHours", got.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 8.0)
	if got.NextFundingAt == nil || *got.NextFundingAt != 1_789_171_200_000 {
		t.Errorf("nextFundingAt: got %v, want 1789171200000", got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 77760.9)
	// OKX publishes no index price on these endpoints; absent, never zero.
	if got.IndexPrice != nil {
		t.Errorf("indexPrice: got %v, want nil", *got.IndexPrice)
	}

	// THE UNIT THAT MATTERS. OKX books are in CONTRACTS, and a contract is ctVal (0.01 BTC) x
	// ctMult, valued at the mark. So 504.48 contracts is 5.04 BTC, about $392k — reading it as 504
	// of anything would be four orders of magnitude out.
	eq(t, "bestBid", f64(t, "bestBid", got.BestBid), 77769.4)
	closeTo(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", got.BestBidSizeUSD), 504.48*(0.01*77760.9), 1e-6)
	eq(t, "bestAsk", f64(t, "bestAsk", got.BestAsk), 77769.5)
	closeTo(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", got.BestAskSizeUSD), 28.23*(0.01*77760.9), 1e-6)

	// The fixture carries more precision than a float64 holds, so the expectation is parsed the
	// same way the decoder parses it rather than written as a literal.
	wantOI, err := strconv.ParseFloat("2146320021.55324936285784", 64)
	if err != nil {
		t.Fatal(err)
	}
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), wantOI)

	// volCcy24h is in the BASE currency, so money needs the last price applied.
	closeTo(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 110381.4949*77769.5, 1e-3)
}

func TestParseSnapshotsKeepsPerpsSkipsOthersAndReads4hIntervals(t *testing.T) {
	snapshots := batch(t).Snapshots

	want := []string{"BTC-USDT-SWAP", "ETH-USDT-SWAP", "CHIP-USDT-SWAP", "BTC-USD-SWAP"}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, symbol)
	}

	chip := snapshotBySymbol(snapshots, "CHIP-USDT-SWAP")
	if chip == nil {
		t.Fatal("CHIP-USDT-SWAP missing")
	}
	// The interval is derived from the gap between this settlement and the next, not assumed.
	eq(t, "CHIP basisHours", chip.BasisHours, 4.0)
	eq(t, "CHIP intervalHours", f64(t, "CHIP intervalHours", chip.IntervalHours), 4.0)
	if chip.NextFundingAt == nil || *chip.NextFundingAt != 1_789_156_800_000 {
		t.Errorf("CHIP nextFundingAt: got %v, want 1789156800000", chip.NextFundingAt)
	}

	inverse := snapshotBySymbol(snapshots, "BTC-USD-SWAP")
	if inverse == nil {
		t.Fatal("BTC-USD-SWAP missing")
	}
	eq(t, "inverse quote", str(t, "quote", inverse.Quote), "USD")
	closeTo(t, "inverse volume", f64(t, "vol", inverse.Volume24hUSD), 7598.9792*77748.5, 1e-3)
}

func TestParseSnapshotsEmitsTheLastSettledPaymentPerMarket(t *testing.T) {
	settled := batch(t).Settled
	if len(settled) != 4 {
		t.Fatalf("settled: got %d, want 4", len(settled))
	}

	var btc, chip *core.FundingEvent
	for i := range settled {
		switch settled[i].VenueSymbol {
		case "BTC-USDT-SWAP":
			btc = &settled[i]
		case "CHIP-USDT-SWAP":
			chip = &settled[i]
		}
	}
	if btc == nil || chip == nil {
		t.Fatal("expected settled events for BTC-USDT-SWAP and CHIP-USDT-SWAP")
	}
	eq(t, "BTC settledAt", btc.SettledAt, int64(1_789_142_400_000))
	eq(t, "BTC rate", btc.Rate, 0.0000599316422609)
	eq(t, "BTC basisHours", btc.BasisHours, 8.0)
	// The settled basis is measured from the previous settlement to this one, so a 4h market
	// reports 4 even though the snapshot beside it also reports 4.
	eq(t, "CHIP basisHours", chip.BasisHours, 4.0)
}

func TestParseSnapshotsRejectsAnErrorEnvelope(t *testing.T) {
	var ok Envelope[Ticker]
	load(t, "tickers", &ok)

	// A rate limit arrives as a code inside an HTTP 200, so the parser is the first thing that can
	// notice it.
	bad := Envelope[FundingRate]{Code: "50011", Msg: "rate limited"}
	_, err := ParseSnapshots(bad, ok, Envelope[OpenInterest]{Code: "0"},
		Envelope[MarkPrice]{Code: "0"}, Envelope[Instrument]{Code: "0"}, NOW)
	if err == nil {
		t.Fatal("want an error for code 50011, got nil")
	}
	eq(t, "error", err.Error(), "okx funding rate: 50011 rate limited")
}

func TestParseSnapshotsCarriesTheDeclaredClass(t *testing.T) {
	// Real instrument rows from 2026-09-14; the funding rows are stand-ins, since only the join on
	// instId matters here.
	var instruments Envelope[Instrument]
	load(t, "asset-class", &instruments)

	funding := Envelope[FundingRate]{Code: "0"}
	for _, instrument := range instruments.Data {
		var row FundingRate
		row.InstID = instrument.InstID
		_ = row.FundingRate.UnmarshalJSON([]byte(`"0.0001"`))
		_ = row.FundingTime.UnmarshalJSON([]byte(`"1789142400000"`))
		_ = row.NextFundingTime.UnmarshalJSON([]byte(`"1789171200000"`))
		funding.Data = append(funding.Data, row)
	}

	empty := func() Envelope[Ticker] { return Envelope[Ticker]{Code: "0"} }
	got, err := ParseSnapshots(funding, empty(), Envelope[OpenInterest]{Code: "0"},
		Envelope[MarkPrice]{Code: "0"}, instruments, NOW)
	if err != nil {
		t.Fatalf("ParseSnapshots: %v", err)
	}

	want := map[string]string{
		"STX-USDT-SWAP": "crypto:STX",
		"AI-USDT-SWAP":  "crypto:AI",
		"SPX-USDT-SWAP": "crypto:SPX",
		// Quantinuum and BlackBerry, not Quant and BounceBit: the symbol cannot tell them apart.
		"QNT-USDT-SWAP":  "equity:QNT",
		"BB-USDT-SWAP":   "equity:BB",
		"ON-USDT-SWAP":   "equity:ON",
		"PURR-USDT-SWAP": "equity:PURR",
		// Declared "3" (stocks) by OKX, refined to index by MarketRefFor.
		"US500-USDT-SWAP": "index:US500",
		"JP225-USDT-SWAP": "index:JP225",
		"XAU-USDT-SWAP":   "commodity:XAU",
	}
	if len(got.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got.Snapshots), len(want))
	}
	for _, s := range got.Snapshots {
		eq(t, s.VenueSymbol, string(s.AssetClass)+":"+s.Base, want[s.VenueSymbol])
	}
}

func TestAssetClassForReadsInstCategory(t *testing.T) {
	eq(t, "forex", AssetClassFor("5", "EUR"), core.ClassFX)
	// Bonds have no class of their own; the base tables decide.
	eq(t, "bonds", AssetClassFor("6", "US10Y"), core.ClassIndex)
	eq(t, "unknown/XAG", AssetClassFor("9", "XAG"), core.ClassCommodity)
	eq(t, "unknown/TSLA", AssetClassFor("9", "TSLA"), core.ClassEquity)
	// The field predates OKX's tradfi listings, so absence is crypto.
	eq(t, "empty", AssetClassFor("", "BTC"), core.ClassCrypto)
}

func ladders(tb testing.TB) []core.LeverageTier {
	tb.Helper()
	var instruments Envelope[Instrument]
	var tiers Envelope[PositionTier]
	var marks Envelope[MarkPrice]
	load(tb, "instruments", &instruments)
	load(tb, "position-tiers", &tiers)
	load(tb, "mark-price", &marks)

	got, err := ParsePositionTiers(instruments, tiers, marks)
	if err != nil {
		tb.Fatalf("ParsePositionTiers: %v", err)
	}
	return got
}

func TestParsePositionTiersConvertsContractBoundsToUSD(t *testing.T) {
	// BTC-USDT-SWAP is 0.01 BTC a contract, marked at 77,760.9 in the fixture.
	const btcContractUSD = 0.01 * 1 * 77760.9

	var btc []core.LeverageTier
	for _, tier := range ladders(t) {
		if tier.VenueSymbol == "BTC-USDT-SWAP" {
			btc = append(btc, tier)
		}
	}
	if len(btc) != 99 {
		t.Fatalf("BTC ladder: got %d tiers, want 99", len(btc))
	}

	eq(t, "tier1.lower", btc[0].LowerNotionalUSD, 0.0)
	closeTo(t, "tier1.upper", f64(t, "tier1.upper", btc[0].UpperNotionalUSD), 1000.01*btcContractUSD, 1e-6)
	eq(t, "tier1.imr", btc[0].IMR, 0.01)
	eq(t, "tier1.mmr", f64(t, "tier1.mmr", btc[0].MMR), 0.004)
	eq(t, "tier1.maxLeverage", btc[0].MaxLeverage, 100.0)

	// THE WHOLE POINT OF THIS SLICE: tier 1 ends near $780k. Reading OKX's maxSz of 1000 as dollars
	// would have put the first leverage step at $1,000, off by the contract value.
	upper := f64(t, "tier1.upper", btc[0].UpperNotionalUSD)
	if upper <= 770_000 || upper >= 790_000 {
		t.Errorf("tier1 upper: got %v, want between 770k and 790k", upper)
	}

	// Bands are contiguous. OKX publishes inclusive [0,1000] then [1000.01,5000]; carrying that gap
	// through would leave a ~$7.78 hole that resolves to no tier at all.
	closeTo(t, "tier2.lower", btc[1].LowerNotionalUSD, 1000.01*btcContractUSD, 1e-6)
	closeTo(t, "tier2.upper", f64(t, "tier2.upper", btc[1].UpperNotionalUSD), 5000.01*btcContractUSD, 1e-6)

	// The top band keeps OKX's own maxSz, which is a real cap on position size, as on Bybit.
	last := btc[len(btc)-1]
	closeTo(t, "top.upper", f64(t, "top.upper", last.UpperNotionalUSD), 1_940_000*btcContractUSD, 1e-3)
}

func TestParsePositionTiersLeavesInverseContractsInDollars(t *testing.T) {
	var inverse []core.LeverageTier
	for _, tier := range ladders(t) {
		if tier.VenueSymbol == "BTC-USD-SWAP" {
			inverse = append(inverse, tier)
		}
	}
	if len(inverse) != 99 {
		t.Fatalf("inverse ladder: got %d tiers, want 99", len(inverse))
	}
	// ctVal is 100 USD a contract, so tier 1 ends at 2000.1 contracts = $200,010. Multiplying by
	// the ~$77.7k mark, as a linear market needs, would overstate the band ~77,000-fold.
	closeTo(t, "inverse tier1.upper", f64(t, "upper", inverse[0].UpperNotionalUSD), 2000.1*100, 1e-9)
	eq(t, "inverse tier1.maxLeverage", inverse[0].MaxLeverage, 100.0)
}

func TestParsePositionTiersDropsALinearLadderWithNoMark(t *testing.T) {
	// DOGE-USDT-SWAP has both tiers and an instrument in the fixtures, but no mark price, so it
	// cannot be converted and is dropped rather than guessed at.
	symbols := map[string]bool{}
	for _, tier := range ladders(t) {
		symbols[tier.VenueSymbol] = true
	}
	if len(symbols) != 2 || !symbols["BTC-USDT-SWAP"] || !symbols["BTC-USD-SWAP"] {
		t.Errorf("symbols: got %v, want only the two BTC swaps", symbols)
	}
}

func TestParseFundingHistoryPrefersRealizedRates(t *testing.T) {
	var env Envelope[FundingHistoryItem]
	load(t, "funding-history", &env)

	events, err := ParseFundingHistory(env, 4)
	if err != nil {
		t.Fatalf("ParseFundingHistory: %v", err)
	}
	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_084_800_000, 0.0000876022471315, 8},
		{1_789_113_600_000, 0.0000402928520367, 8},
		{1_789_142_400_000, 0.0000599316422609, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
}

func TestParseFundingHistoryFallsBackWhenRealizedRateIsEmpty(t *testing.T) {
	env := Envelope[FundingHistoryItem]{Code: "0"}
	var item FundingHistoryItem
	item.InstID = "BTC-USDT-SWAP"
	_ = item.FundingRate.UnmarshalJSON([]byte(`"0.0001"`))
	_ = item.RealizedRate.UnmarshalJSON([]byte(`""`))
	_ = item.FundingTime.UnmarshalJSON([]byte(`"1789142400000"`))
	env.Data = append(env.Data, item)

	events, err := ParseFundingHistory(env, 8)
	if err != nil {
		t.Fatalf("ParseFundingHistory: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}
	eq(t, "rate", events[0].Rate, 0.0001)
	eq(t, "basisHours", events[0].BasisHours, 8.0)
}

// liquidationFixtures mirrors the typed maps okx.test.ts builds rather than casting, so a field
// rename between the parser and the API surfaces instead of being silenced.
func liquidationFixtures() (map[string]Instrument, map[string]MarkPrice) {
	num := func(raw string) adapters.Num {
		var n adapters.Num
		_ = n.UnmarshalJSON([]byte(`"` + raw + `"`))
		return n
	}
	instruments := map[string]Instrument{
		"BTC-USDT-SWAP": {
			InstID: "BTC-USDT-SWAP", InstFamily: "BTC-USDT",
			CtVal: num("0.01"), CtValCcy: "BTC", CtMult: num("1"),
		},
		"BTC-USD-SWAP": {
			InstID: "BTC-USD-SWAP", InstFamily: "BTC-USD",
			CtVal: num("100"), CtValCcy: "USD", CtMult: num("1"),
		},
	}
	marks := map[string]MarkPrice{
		"BTC-USDT-SWAP": {InstID: "BTC-USDT-SWAP", MarkPx: num("77760.9")},
		"BTC-USD-SWAP":  {InstID: "BTC-USD-SWAP", MarkPx: num("77741.7")},
	}
	return instruments, marks
}

func detail(posSide, sz, bkPx, ts string) LiquidationDetail {
	var d LiquidationDetail
	d.PosSide = posSide
	d.Side = "sell"
	_ = d.Sz.UnmarshalJSON([]byte(`"` + sz + `"`))
	_ = d.BkPx.UnmarshalJSON([]byte(`"` + bkPx + `"`))
	_ = d.Ts.UnmarshalJSON([]byte(`"` + ts + `"`))
	return d
}

func TestParseLiquidationsTakesPosSideAndKeepsMilliseconds(t *testing.T) {
	var env Envelope[LiquidationRow]
	load(t, "liquidation-orders", &env)
	instruments, marks := liquidationFixtures()

	parsed := ParseLiquidations(env.Data, instruments, marks)
	if len(parsed) == 0 {
		t.Fatal("no liquidations parsed")
	}

	// OKX names the closed position outright, unlike Gate where the side is a sign on the size.
	eq(t, "first side", parsed[0].Side, "long")
	var longs, shorts int
	for _, l := range parsed {
		switch l.Side {
		case "long":
			longs++
		case "short":
			shorts++
		}
	}
	eq(t, "longs", longs, 16)
	eq(t, "shorts", shorts, 4)

	// `ts` is ALREADY epoch milliseconds. Copying Gate's x1000 would land every record in the year
	// 58,000 and drop it silently from every window the study asks for.
	eq(t, "liquidatedAt", parsed[0].LiquidatedAt, int64(1_789_241_986_046))
}

func TestParseLiquidationsConvertsLinearWithTheMarkAndInverseWithout(t *testing.T) {
	instruments, marks := liquidationFixtures()

	linear := ParseLiquidations([]LiquidationRow{{
		InstID: "BTC-USDT-SWAP", InstType: "SWAP",
		Details: []LiquidationDetail{detail("long", "3.56", "77032.6", "1789241986046")},
	}}, instruments, marks)
	if len(linear) != 1 {
		t.Fatalf("linear: got %d, want 1", len(linear))
	}
	// 3.56 contracts x 0.01 BTC x 77760.9 mark.
	closeTo(t, "linear notional", f64(t, "notional", linear[0].NotionalUSD), 2768.28804, 1e-6)

	inverse := ParseLiquidations([]LiquidationRow{{
		InstID: "BTC-USD-SWAP", InstType: "SWAP",
		Details: []LiquidationDetail{detail("short", "1", "77032.6", "1789241986046")},
	}}, instruments, marks)
	if len(inverse) != 1 {
		t.Fatalf("inverse: got %d, want 1", len(inverse))
	}
	// ctValCcy is USD, so the contract is already dollars: 1 x 100. Applying the mark as well would
	// read $7,774,170 — 77,742x too big. Inverse families do liquidate, so this branch is live.
	closeTo(t, "inverse notional", f64(t, "notional", inverse[0].NotionalUSD), 100, 1e-9)
}

func TestParseLiquidationsDropsRowsItCannotTrust(t *testing.T) {
	instruments, marks := liquidationFixtures()

	parsed := ParseLiquidations([]LiquidationRow{{
		InstID: "BTC-USDT-SWAP", InstType: "SWAP",
		Details: []LiquidationDetail{
			detail("long", "0", "77032.6", "1789241986046"), // zero size
			detail("long", "1", "0", "1789241986046"),       // zero price
			detail("long", "1", "77032.6", "0"),             // no timestamp
			detail("net", "1", "77032.6", "1789241986046"),  // neither long nor short
		},
	}}, instruments, marks)

	if len(parsed) != 0 {
		t.Errorf("got %d liquidations, want none — every row here is untrustworthy", len(parsed))
	}
}

func TestParseLiquidationsKeepsRawSizeWhenTheInstrumentIsUnknown(t *testing.T) {
	instruments, marks := liquidationFixtures()

	parsed := ParseLiquidations([]LiquidationRow{{
		InstID: "MYSTERY-USDT-SWAP", InstType: "SWAP",
		Details: []LiquidationDetail{detail("long", "7", "1.5", "1789241986046")},
	}}, instruments, marks)

	if len(parsed) != 1 {
		t.Fatalf("got %d, want 1", len(parsed))
	}
	// The raw figure is kept so a later conversion stays possible; the notional is absent rather
	// than guessed.
	eq(t, "sizeContracts", parsed[0].SizeContracts, 7.0)
	if parsed[0].NotionalUSD != nil {
		t.Errorf("notionalUsd: got %v, want nil for an unknown instrument", *parsed[0].NotionalUSD)
	}
}
