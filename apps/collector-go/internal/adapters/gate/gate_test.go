package gate

import (
	"bytes"
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

// The same instant gate.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_147_120_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "gate")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/gate above the working directory")
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

// The SAME files packages/adapters/src/venues/gate.test.ts reads.
func load[T any](tb testing.TB, name string, into *T) {
	tb.Helper()
	if err := json.Unmarshal(fixtureBytes(tb, name), into); err != nil {
		tb.Fatalf("decode %s: %v", name, err)
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

// product multiplies left to right at runtime, exactly as adapters.Mul does. Written as a Go
// constant expression instead, `2776 * 0.0001 * 77763.7` is folded at arbitrary precision and can
// land one ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

// num builds a present Num for tests that construct wire structs directly rather than decoding
// them: adapters.Num has no MarshalJSON, so a struct containing one cannot be round-tripped.
func num(v float64) adapters.Num { return adapters.Num{Val: v, OK: true} }

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
	var contracts []Contract
	var tickers []Ticker
	load(tb, "contracts", &contracts)
	load(tb, "tickers", &tickers)
	return ParseSnapshots(contracts, tickers, NOW)
}

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	got := batch(t)
	if len(got.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(got.Settled))
	}

	btc := snapshotBySymbol(got.Snapshots, "BTC_USDT")
	if btc == nil {
		t.Fatal("BTC_USDT missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.000016)
	// funding_interval is SECONDS: 28,800 of them is 8 hours, not 28,800 minutes.
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_171_200_000 {
		t.Errorf("nextFundingAt: got %v, want 1789171200000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77762.8)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77790.63)
	eq(t, "bestBid", f64(t, "bestBid", btc.BestBid), 77763.7)

	// Book sizes are contracts, so the depth is size x quanto_multiplier x price: 2,776 contracts
	// is 0.2776 BTC, about $21.6k -- not 2,776 dollars and not 2,776 coins.
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", btc.BestBidSizeUSD), product(2776, 0.0001, 77763.7))
	eq(t, "bestAsk", f64(t, "bestAsk", btc.BestAsk), 77765.3)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", btc.BestAskSizeUSD), product(36039, 0.0001, 77765.3))
	// The mark comes from /contracts, not from the ticker's own (77755.8).
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(640887002, 0.0001, 77762.8))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 7031702789)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 200)
}

func TestParseSnapshotsReads4hIntervalsAndSkipsPreMarket(t *testing.T) {
	snapshots := batch(t).Snapshots

	want := []string{"BTC_USDT", "ETH_USDT", "2Z_USDT"}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, symbol)
	}

	z := snapshotBySymbol(snapshots, "2Z_USDT")
	if z == nil {
		t.Fatal("2Z_USDT missing")
	}
	eq(t, "2Z basisHours", z.BasisHours, 4.0)
	eq(t, "2Z intervalHours", f64(t, "2Z intervalHours", z.IntervalHours), 4.0)
	if z.NextFundingAt == nil || *z.NextFundingAt != 1_789_156_800_000 {
		t.Errorf("2Z nextFundingAt: got %v, want 1789156800000", z.NextFundingAt)
	}
	eq(t, "2Z openInterestUsd", f64(t, "2Z openInterestUsd", z.OpenInterestUSD), product(17296, 100, 0.04671))
}

func TestParseSnapshotsSkipsDelistingAndLeavesStatsNullWithoutATicker(t *testing.T) {
	var contracts []Contract
	load(t, "contracts", &contracts)
	btc := contracts[0]

	old := btc
	old.Name = "OLD_USDT"
	old.InDelisting = true
	fresh := btc
	fresh.Name = "NEW_USDT"

	snapshots := ParseSnapshots([]Contract{old, fresh}, nil, NOW).Snapshots
	if len(snapshots) != 1 {
		t.Fatalf("snapshots: got %d, want 1", len(snapshots))
	}
	eq(t, "venueSymbol", snapshots[0].VenueSymbol, "NEW_USDT")
	// Absent, never zero: no ticker means no reading, not a market with no open interest.
	if snapshots[0].OpenInterestUSD != nil {
		t.Errorf("openInterestUsd: got %v, want nil", *snapshots[0].OpenInterestUSD)
	}
	if snapshots[0].Volume24hUSD != nil {
		t.Errorf("volume24hUsd: got %v, want nil", *snapshots[0].Volume24hUSD)
	}
}

func TestParseSnapshotsCarriesTheDeclaredClass(t *testing.T) {
	// Real /contracts rows from 2026-09-14.
	var contracts []Contract
	load(t, "asset-class", &contracts)

	want := map[string]string{
		"BB_USDT":  "crypto:BB",
		"ON_USDT":  "crypto:ON",
		"QNT_USDT": "crypto:QNT",
		"STX_USDT": "crypto:STX",
		// Caterpillar and Raytheon on gate, memecoins elsewhere under the same tickers.
		"CAT_USDT":  "equity:CAT",
		"RTX_USDT":  "equity:RTX",
		"PURR_USDT": "equity:PURR",
		// Declared metals and forex; tokens, so MarketRefFor returns them to crypto.
		"PAXG_USDT":   "crypto:PAXG",
		"XAUT_USDT":   "crypto:XAUT",
		"USDC_USDT":   "crypto:USDC",
		"XAU_USDT":    "commodity:XAU",
		"CL_USDT":     "commodity:CL",
		"EURUSD_USDT": "fx:EURUSD",
		"SPX500_USDT": "index:US500",
	}

	snapshots := ParseSnapshots(contracts, nil, NOW).Snapshots
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for _, s := range snapshots {
		eq(t, s.VenueSymbol, string(s.AssetClass)+":"+s.Base, want[s.VenueSymbol])
	}
}

func TestAssetClassForReadsContractTypeOffRealRows(t *testing.T) {
	var contracts []Contract
	load(t, "asset-class", &contracts)

	// Before MarketRefFor's token refinement, so PAXG and XAUT are still gate's declared metals.
	want := map[string]core.AssetClass{
		"BB_USDT":     core.ClassCrypto,
		"ON_USDT":     core.ClassCrypto,
		"QNT_USDT":    core.ClassCrypto,
		"STX_USDT":    core.ClassCrypto,
		"CAT_USDT":    core.ClassEquity,
		"RTX_USDT":    core.ClassEquity,
		"PURR_USDT":   core.ClassEquity,
		"PAXG_USDT":   core.ClassCommodity,
		"XAUT_USDT":   core.ClassCommodity,
		"USDC_USDT":   core.ClassFX,
		"XAU_USDT":    core.ClassCommodity,
		"CL_USDT":     core.ClassCommodity,
		"EURUSD_USDT": core.ClassFX,
		"SPX500_USDT": core.ClassIndex,
	}
	if len(contracts) != len(want) {
		t.Fatalf("fixture rows: got %d, want %d", len(contracts), len(want))
	}
	for _, contract := range contracts {
		eq(t, contract.Name, AssetClassFor(contract.ContractType, ""), want[contract.Name])
	}
}

func TestAssetClassForUnknownTypeIsStillNotCrypto(t *testing.T) {
	eq(t, "bonds/US10Y", AssetClassFor("bonds", "US10Y"), core.ClassIndex)
	eq(t, "bonds/XAG", AssetClassFor("bonds", "XAG"), core.ClassCommodity)
	eq(t, "bonds/CAT", AssetClassFor("bonds", "CAT"), core.ClassEquity)
	// A missing contract_type is undeclared, so crypto.
	eq(t, "missing/CAT", AssetClassFor("", "CAT"), core.ClassCrypto)
}

func laddersFor(tb testing.TB, tiers []core.LeverageTier, symbol string) []core.LeverageTier {
	tb.Helper()
	var out []core.LeverageTier
	for _, tier := range tiers {
		if tier.VenueSymbol == symbol {
			out = append(out, tier)
		}
	}
	return out
}

func TestParseRiskLimitTiersBuildsACumulativeLadderPerContract(t *testing.T) {
	var rows []RiskLimitTier
	load(t, "risk-limit-tiers", &rows)
	tiers := ParseRiskLimitTiers(rows)

	btc := laddersFor(t, tiers, "BTC_USDT")
	if len(btc) != 19 {
		t.Fatalf("BTC ladder: got %d tiers, want 19", len(btc))
	}

	// risk_limit is quote notional, so unlike OKX there is no contract conversion to get wrong.
	eq(t, "tier1.venueId", btc[0].VenueID, VenueID)
	eq(t, "tier1.venueSymbol", btc[0].VenueSymbol, "BTC_USDT")
	eq(t, "tier1.tier", btc[0].Tier, 1)
	eq(t, "tier1.lower", btc[0].LowerNotionalUSD, 0.0)
	eq(t, "tier1.upper", f64(t, "tier1.upper", btc[0].UpperNotionalUSD), 500_000)
	eq(t, "tier1.imr", btc[0].IMR, 0.005)
	eq(t, "tier1.mmr", f64(t, "tier1.mmr", btc[0].MMR), 0.003)
	eq(t, "tier1.maxLeverage", btc[0].MaxLeverage, 200.0)

	// Gate publishes only the ceiling, so each band inherits its floor from the one below.
	eq(t, "tier2.tier", btc[1].Tier, 2)
	eq(t, "tier2.lower", btc[1].LowerNotionalUSD, 500_000)
	eq(t, "tier2.upper", f64(t, "tier2.upper", btc[1].UpperNotionalUSD), 1_000_000)
	eq(t, "tier2.imr", btc[1].IMR, 0.006666)
	eq(t, "tier2.maxLeverage", btc[1].MaxLeverage, 150.01)

	// The top band's bound is a real cap on position size, as on Bybit.
	last := btc[len(btc)-1]
	eq(t, "top.tier", last.Tier, 19)
	eq(t, "top.upper", f64(t, "top.upper", last.UpperNotionalUSD), 1_500_000_000)
	eq(t, "top.maxLeverage", last.MaxLeverage, 1.05)

	// Every contract keeps its own ladder: ETH's first band ends lower than BTC's.
	eth := laddersFor(t, tiers, "ETH_USDT")
	if len(eth) != 19 {
		t.Fatalf("ETH ladder: got %d tiers, want 19", len(eth))
	}
	eq(t, "eth tier1.tier", eth[0].Tier, 1)
	eq(t, "eth tier1.upper", f64(t, "eth tier1.upper", eth[0].UpperNotionalUSD), 300_000)
}

func TestParseRiskLimitTiersIgnoresRowsWithNoContract(t *testing.T) {
	// Asking Gate for one contract returns the same rows without the `contract` field, leaving
	// every ladder unattributable; those rows are dropped rather than merged under one key.
	got := ParseRiskLimitTiers([]RiskLimitTier{{
		Contract:        "",
		Tier:            1,
		RiskLimit:       num(500000),
		InitialRate:     num(0.005),
		MaintenanceRate: num(0.003),
		LeverageMax:     num(200),
	}})
	if len(got) != 0 {
		t.Errorf("got %d tiers, want none — an unattributable ladder is dropped", len(got))
	}
}

func TestParseFundingHistoryReturnsEventsOldestFirstSnappedToTheMinute(t *testing.T) {
	var items []FundingHistoryItem
	load(t, "funding-history", &items)

	events := ParseFundingHistory("BTC_USDT", items, 4)
	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_084_800_000, 0.000058, 8},
		{1_789_113_600_000, 0.000002, 8},
		{1_789_142_400_000, 0.000024, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTC_USDT")
	eq(t, "base", events[0].Base, "BTC")
}

func TestParseFundingHistoryFallsBackToTheGivenIntervalForASingleEvent(t *testing.T) {
	events := ParseFundingHistory("2Z_USDT", []FundingHistoryItem{{T: 1789142402, R: num(0.00005)}}, 4)
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}
	eq(t, "basisHours", events[0].BasisHours, 4.0)
}

func liquidationMultipliers() map[string]float64 {
	return map[string]float64{"H_USDT": 1, "LSK_USDT": 1}
}

func liquidationBySymbol(rows []core.Liquidation, symbol string) *core.Liquidation {
	for i := range rows {
		if rows[i].VenueSymbol == symbol {
			return &rows[i]
		}
	}
	return nil
}

func TestParseLiquidationsTakesTheSideFromSizeNotOrderSize(t *testing.T) {
	// The two fields are always opposite in sign -- 167 of 167 live records on 2026-09-13 -- so
	// reading the side off `order_size` would invert every long and short in the study.
	var rows []LiquidationRow
	load(t, "liq-orders", &rows)
	parsed := ParseLiquidations(rows, liquidationMultipliers())

	long := liquidationBySymbol(parsed, "H_USDT")
	if long == nil {
		t.Fatal("H_USDT missing")
	}
	eq(t, "H_USDT side", long.Side, "long") // fixture has size:"76", order_size:"-76"
	short := liquidationBySymbol(parsed, "LSK_USDT")
	if short == nil {
		t.Fatal("LSK_USDT missing")
	}
	eq(t, "LSK_USDT side", short.Side, "short") // fixture has size:"-95", order_size:"95"

	// The sign is consumed into `side`, so the stored size is absolute for both.
	eq(t, "H_USDT sizeContracts", long.SizeContracts, 76.0)
	eq(t, "LSK_USDT sizeContracts", short.SizeContracts, 95.0)
	for _, l := range parsed {
		if l.SizeContracts <= 0 {
			t.Errorf("%s: sizeContracts %v, want a positive figure", l.VenueSymbol, l.SizeContracts)
		}
	}
}

func TestParseLiquidationsConvertsContractsAndStoresNullRatherThanAGuess(t *testing.T) {
	var rows []LiquidationRow
	load(t, "liq-orders", &rows)

	// 95 contracts x 1 base unit x 0.2544 = 24.168.
	known := liquidationBySymbol(ParseLiquidations(rows, liquidationMultipliers()), "LSK_USDT")
	if known == nil {
		t.Fatal("LSK_USDT missing")
	}
	closeTo(t, "notionalUsd", f64(t, "notionalUsd", known.NotionalUSD), product(95, 1, 0.2544), 1e-9)

	// A contract with no multiplier gets no invented notional -- the B2 unit trap, one layer down.
	unknown := liquidationBySymbol(ParseLiquidations(rows, map[string]float64{}), "LSK_USDT")
	if unknown == nil {
		t.Fatal("LSK_USDT missing")
	}
	if unknown.NotionalUSD != nil {
		t.Errorf("notionalUsd: got %v, want nil without a multiplier", *unknown.NotionalUSD)
	}
	eq(t, "sizeContracts", unknown.SizeContracts, 95.0) // the raw figure survives either way
}

func TestParseLiquidationsSecondsBecomeMillisecondsAndDegenerateRowsAreDropped(t *testing.T) {
	parsed := ParseLiquidations([]LiquidationRow{
		{Contract: "A_USDT", Size: num(10), OrderSize: num(-10), FillPrice: num(2), Price: num(2), Time: num(1_789_242_803), Left: num(0)},
		// Dropped: no size, no price, no timestamp.
		{Contract: "B_USDT", Size: num(0), OrderSize: num(0), FillPrice: num(2), Price: num(2), Time: num(1_789_242_803), Left: num(0)},
		{Contract: "C_USDT", Size: num(10), OrderSize: num(-10), FillPrice: num(0), Price: num(2), Time: num(1_789_242_803), Left: num(0)},
		{Contract: "D_USDT", Size: num(10), OrderSize: num(-10), FillPrice: num(2), Price: num(2), Time: num(0), Left: num(0)},
	}, map[string]float64{"A_USDT": 1})

	if len(parsed) != 1 {
		t.Fatalf("got %d liquidations, want 1", len(parsed))
	}
	eq(t, "liquidatedAt", parsed[0].LiquidatedAt, int64(1_789_242_803_000))
}

func TestParseLiquidationsKeepsANonASCIIContractName(t *testing.T) {
	var rows []LiquidationRow
	load(t, "liq-orders", &rows)
	parsed := ParseLiquidations(rows, map[string]float64{})

	// Asserted by NAME and by code point, with no character class, exactly as the TypeScript test
	// does: an earlier attempt there wrote escapes that landed as raw NUL and DEL bytes in the file.
	if liquidationBySymbol(parsed, "龙虾_USDT") == nil {
		t.Error("龙虾_USDT missing — a non-ASCII contract name must survive")
	}
	nonASCII := false
	for _, l := range parsed {
		for _, ch := range l.VenueSymbol {
			if ch > 127 {
				nonASCII = true
			}
		}
	}
	if !nonASCII {
		t.Error("no symbol carries a code point above 127")
	}
}

// fixtureDoer answers /tickers with the ticker fixture and everything else with the contract one,
// recording the URLs asked for. It is the Go seam for the fake HttpClient gate.test.ts builds.
type fixtureDoer struct {
	urls      []string
	contracts []byte
	tickers   []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	body := d.contracts
	if strings.HasSuffix(requested, "/tickers") {
		body = d.tickers
	}
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

func TestFetchSnapshotsRequestsContractsAndTickers(t *testing.T) {
	doer := &fixtureDoer{contracts: fixtureBytes(t, "contracts"), tickers: fixtureBytes(t, "tickers")}
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))

	got, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(got.Snapshots) != 3 {
		t.Fatalf("snapshots: got %d, want 3", len(got.Snapshots))
	}

	want := []string{"contracts", "tickers"}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, tail := range want {
		parts := strings.Split(doer.urls[i], "/")
		eq(t, "request path", parts[len(parts)-1], tail)
	}
}
