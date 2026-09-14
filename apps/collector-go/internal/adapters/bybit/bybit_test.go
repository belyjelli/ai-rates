package bybit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// NOW is the same instant bybit.test.ts uses, so the two suites pin identical output.
const NOW int64 = 1_789_147_120_000

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files packages/adapters/src/venues/bybit.test.ts
// reads: the port is verified against the exact bytes the original parser is pinned to, which is
// what makes this a port rather than a plausible rewrite.
// testing.TB rather than *testing.T so the benchmarks can share these loaders.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "bybit")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/bybit above the working directory")
	return ""
}

func fixtureBytes(tb testing.TB, name string) []byte {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	return raw
}

func loadFixture[T any](tb testing.TB, name string, into *T) {
	tb.Helper()
	if err := json.Unmarshal(fixtureBytes(tb, name), into); err != nil {
		tb.Fatalf("decode %s: %v", name, err)
	}
}

func f64(t *testing.T, label string, got *float64) float64 {
	t.Helper()
	if got == nil {
		t.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func str(t *testing.T, label string, got *string) string {
	t.Helper()
	if got == nil {
		t.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func eq[T comparable](t *testing.T, label string, got, want T) {
	t.Helper()
	if got != want {
		t.Errorf("%s: got %v, want %v", label, got, want)
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

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	var tickers Envelope[Ticker]
	var instruments Envelope[Instrument]
	loadFixture(t, "tickers", &tickers)
	loadFixture(t, "instruments", &instruments)

	batch, err := ParseSnapshots(tickers, instruments.Result.List, NOW)
	if err != nil {
		t.Fatalf("ParseSnapshots: %v", err)
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d events, want 0", len(batch.Settled))
	}

	got := snapshotBySymbol(batch.Snapshots, "BTCUSDT")
	if got == nil {
		t.Fatal("BTCUSDT missing from snapshots")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	eq(t, "rate", got.Rate, 0.00004936)
	eq(t, "basisHours", got.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 8.0)
	if got.NextFundingAt == nil || *got.NextFundingAt != 1_789_171_200_000 {
		t.Errorf("nextFundingAt: got %v, want 1789171200000", got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 77766.7)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 77797.59)
	eq(t, "bestBid", f64(t, "bestBid", got.BestBid), 77766.7)
	// Computed the same way bybit.test.ts computes it, so the two agree bit for bit rather than to
	// some tolerance: Bybit sizes are base coin, so depth is size x price with no multiplier.
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", got.BestBidSizeUSD), 0.181*77766.7)
	eq(t, "bestAsk", f64(t, "bestAsk", got.BestAsk), 77766.8)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", got.BestAskSizeUSD), 2.763*77766.8)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), 4142076932.53)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 6285417277.3039)
	eq(t, "maxLeverage", f64(t, "maxLeverage", got.MaxLeverage), 150.0)
}

func TestParseSnapshotsIntervalsCoinsAndDatedFutures(t *testing.T) {
	var tickers Envelope[Ticker]
	var instruments Envelope[Instrument]
	loadFixture(t, "tickers", &tickers)
	loadFixture(t, "instruments", &instruments)

	batch, err := ParseSnapshots(tickers, instruments.Result.List, NOW)
	if err != nil {
		t.Fatalf("ParseSnapshots: %v", err)
	}

	want := []string{"BTCUSDT", "ETHUSDT", "0GUSDT", "1000BONKPERP"}
	if len(batch.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(batch.Snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("snapshot[%d]", i), batch.Snapshots[i].VenueSymbol, symbol)
	}

	zeroG := snapshotBySymbol(batch.Snapshots, "0GUSDT")
	if zeroG == nil {
		t.Fatal("0GUSDT missing")
	}
	eq(t, "0G base", zeroG.Base, "0G")
	eq(t, "0G basisHours", zeroG.BasisHours, 4.0)
	eq(t, "0G intervalHours", f64(t, "0G intervalHours", zeroG.IntervalHours), 4.0)
	if zeroG.NextFundingAt == nil || *zeroG.NextFundingAt != 1_789_156_800_000 {
		t.Errorf("0G nextFundingAt: got %v, want 1789156800000", zeroG.NextFundingAt)
	}

	// A USDC perp whose symbol does not parse cleanly: the coin fields carry the truth, and the
	// 1000x contract scale has to reach the multiplier or every price is off by three orders.
	bonk := snapshotBySymbol(batch.Snapshots, "1000BONKPERP")
	if bonk == nil {
		t.Fatal("1000BONKPERP missing")
	}
	eq(t, "BONK base", bonk.Base, "BONK")
	eq(t, "BONK quote", str(t, "BONK quote", bonk.Quote), "USDC")
	eq(t, "BONK multiplier", bonk.Multiplier, 1000.0)
	eq(t, "BONK assetClass", bonk.AssetClass, core.ClassCrypto)
	eq(t, "BONK rate", bonk.Rate, -0.00022725)
}

func TestParseSnapshotsRejectsErrorEnvelope(t *testing.T) {
	var env Envelope[Ticker]
	env.RetCode = 10001
	env.RetMsg = "bad"

	_, err := ParseSnapshots(env, nil, NOW)
	if err == nil {
		t.Fatal("want an error for retCode 10001, got nil")
	}
	eq(t, "error", err.Error(), "bybit tickers: 10001 bad")
}

func TestParseSnapshotsCarriesDeclaredClass(t *testing.T) {
	// Real instrument rows from 2026-09-14; the tickers are stand-ins, since only the join matters.
	var instruments Envelope[Instrument]
	loadFixture(t, "asset-class", &instruments)

	var tickers Envelope[Ticker]
	for _, i := range instruments.Result.List {
		tickers.Result.List = append(tickers.Result.List, Ticker{
			Symbol:      i.Symbol,
			FundingRate: adaptersNum(0.0001),
			MarkPrice:   adaptersNum(1),
			IndexPrice:  adaptersNum(1),
		})
	}

	batch, err := ParseSnapshots(tickers, instruments.Result.List, NOW)
	if err != nil {
		t.Fatalf("ParseSnapshots: %v", err)
	}

	// Same tickers, different assets: BB is BounceBit, BBX is a stock; XAUT is a token, XAU gold.
	want := map[string]string{
		"BBUSDT":     "crypto:BB",
		"SPXUSDT":    "crypto:SPX",
		"XAUTUSDT":   "crypto:XAUT",
		"AVNTUSDT":   "crypto:AVNT",
		"ONUSDT":     "equity:ON",
		"PURRUSDT":   "equity:PURR",
		"BBXUSDT":    "equity:BBX",
		"SPYUSDT":    "equity:SPY",
		"XAUUSDT":    "commodity:XAU",
		"EURUSDUSDT": "fx:EURUSD",
	}
	if len(batch.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(batch.Snapshots), len(want))
	}
	for _, s := range batch.Snapshots {
		got := fmt.Sprintf("%s:%s", s.AssetClass, s.Base)
		eq(t, s.VenueSymbol, got, want[s.VenueSymbol])
	}
}

func TestAssetClassForUnknownTypeIsStillNotCrypto(t *testing.T) {
	eq(t, "bond/XAU", AssetClassFor("bond", "XAU"), core.ClassCommodity)
	eq(t, "bond/US10Y", AssetClassFor("bond", "US10Y"), core.ClassIndex)
	eq(t, "bond/BB", AssetClassFor("bond", "BB"), core.ClassEquity)
	eq(t, "empty/BTC", AssetClassFor("", "BTC"), core.ClassCrypto)
}

func TestParseRiskLimitBuildsContiguousLadders(t *testing.T) {
	var env Envelope[RiskLimit]
	loadFixture(t, "risk-limit", &env)

	tiers := ParseRiskLimit(env.Result.List)
	if len(tiers) != 60 {
		t.Fatalf("tiers: got %d, want 60", len(tiers))
	}

	symbols := map[string]bool{}
	for _, tier := range tiers {
		symbols[tier.VenueSymbol] = true
	}
	if len(symbols) != 2 || !symbols["0GUSDT"] || !symbols["1000000BABYDOGEUSDT"] {
		t.Fatalf("symbols: got %v, want 0GUSDT and 1000000BABYDOGEUSDT", symbols)
	}

	var ladder []core.LeverageTier
	for _, tier := range tiers {
		if tier.VenueSymbol == "0GUSDT" {
			ladder = append(ladder, tier)
		}
	}
	if len(ladder) == 0 {
		t.Fatal("0GUSDT ladder empty")
	}

	eq(t, "tier1.tier", ladder[0].Tier, 1)
	eq(t, "tier1.lower", ladder[0].LowerNotionalUSD, 0.0)
	eq(t, "tier1.upper", f64(t, "tier1.upper", ladder[0].UpperNotionalUSD), 10_000.0)
	eq(t, "tier1.imr", ladder[0].IMR, 0.02)
	eq(t, "tier1.mmr", f64(t, "tier1.mmr", ladder[0].MMR), 0.015)
	eq(t, "tier1.maxLeverage", ladder[0].MaxLeverage, 50.0)

	// Bybit publishes only an upper bound, so tier 2 has to inherit its floor from tier 1.
	eq(t, "tier2.tier", ladder[1].Tier, 2)
	eq(t, "tier2.lower", ladder[1].LowerNotionalUSD, 10_000.0)
	eq(t, "tier2.upper", f64(t, "tier2.upper", ladder[1].UpperNotionalUSD), 25_000.0)
	eq(t, "tier2.imr", ladder[1].IMR, 0.04)
	eq(t, "tier2.maxLeverage", ladder[1].MaxLeverage, 25.0)

	// The top bound is a real cap, not infinity: Bybit will not open 0GUSDT above $5M at all.
	last := ladder[len(ladder)-1]
	eq(t, "last.tier", last.Tier, 30)
	eq(t, "last.upper", f64(t, "last.upper", last.UpperNotionalUSD), 5_000_000.0)
	eq(t, "last.imr", last.IMR, 1.0)
	eq(t, "last.maxLeverage", last.MaxLeverage, 1.0)
}

func TestParseRiskLimitDropsLadderWholeOnUnreadableTier(t *testing.T) {
	tier := func(id int, symbol, riskLimitValue string) RiskLimit {
		var row RiskLimit
		row.ID = id
		row.Symbol = symbol
		_ = row.RiskLimitValue.UnmarshalJSON([]byte(`"` + riskLimitValue + `"`))
		_ = row.MaintenanceMargin.UnmarshalJSON([]byte(`"0.02"`))
		_ = row.InitialMargin.UnmarshalJSON([]byte(`"0.04"`))
		_ = row.MaxLeverage.UnmarshalJSON([]byte(`"25"`))
		if id == 1 {
			row.IsLowestRisk = 1
		}
		return row
	}

	// Keeping AAA's tier 1 would silently stretch it across the band tier 2 should have covered,
	// quoting confident margin for a range nothing verified.
	tiers := ParseRiskLimit([]RiskLimit{
		tier(1, "AAA", "10000"),
		tier(2, "AAA", ""),
		tier(1, "BBB", "25000"),
	})
	if len(tiers) != 1 || tiers[0].VenueSymbol != "BBB" {
		t.Fatalf("got %d tiers %v, want only BBB", len(tiers), tiers)
	}
}

func TestParseFundingHistoryOldestFirstWithInferredInterval(t *testing.T) {
	var env Envelope[FundingHistoryItem]
	loadFixture(t, "funding-history", &env)

	events, err := ParseFundingHistory(env, 4)
	if err != nil {
		t.Fatalf("ParseFundingHistory: %v", err)
	}

	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
	}{
		{1_789_084_800_000, 0.00005091, 8},
		{1_789_113_600_000, 0.00002005, 8},
		{1_789_142_400_000, 0.00005602, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, w.settledAt)
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, w.rate)
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, w.basisHours)
	}
	eq(t, "event[0].venueId", events[0].VenueID, VenueID)
	eq(t, "event[0].venueSymbol", events[0].VenueSymbol, "BTCUSDT")
	eq(t, "event[0].base", events[0].Base, "BTC")
}

func TestParseFundingHistoryFallsBackForSingleEvent(t *testing.T) {
	var env Envelope[FundingHistoryItem]
	loadFixture(t, "funding-history", &env)
	env.Result.List = env.Result.List[:1]

	events, err := ParseFundingHistory(env, 4)
	if err != nil {
		t.Fatalf("ParseFundingHistory: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}
	eq(t, "basisHours", events[0].BasisHours, 4.0)
}
