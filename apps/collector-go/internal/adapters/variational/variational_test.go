package variational

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// NOW is the same instant variational.test.ts uses, so the two suites pin identical output.
const NOW int64 = 1_789_337_000_000 // 2026-09-13T22:03:20Z

// fixturePath walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. This is the SAME file
// packages/adapters/src/venues/variational.test.ts reads: the port is verified against the exact
// bytes the original parser is pinned to, which is what makes this a port rather than a plausible
// rewrite.
func fixturePath(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "variational")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return filepath.Join(candidate, "metadata-stats.json")
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/variational above the working directory")
	return ""
}

func loadStats(tb testing.TB) Stats {
	tb.Helper()
	raw, err := os.ReadFile(fixturePath(tb))
	if err != nil {
		tb.Fatalf("read fixture: %v", err)
	}
	var stats Stats
	if err := json.Unmarshal(raw, &stats); err != nil {
		tb.Fatalf("decode fixture: %v", err)
	}
	return stats
}

// rawListing reads one listing back off the fixture as generic JSON, so the round-trip test can
// compare against the published `funding_rate` string rather than against the parser's own reading
// of it.
func rawListings(tb testing.TB) map[string]map[string]any {
	tb.Helper()
	raw, err := os.ReadFile(fixturePath(tb))
	if err != nil {
		tb.Fatalf("read fixture: %v", err)
	}
	var body struct {
		Listings []map[string]any `json:"listings"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		tb.Fatalf("decode fixture: %v", err)
	}
	byTicker := make(map[string]map[string]any, len(body.Listings))
	for _, listing := range body.Listings {
		ticker, _ := listing["ticker"].(string)
		byTicker[ticker] = listing
	}
	return byTicker
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

// closeTo mirrors bun's toBeCloseTo(want, digits): the difference must be under 0.5 x 10^-digits.
// Used where the TypeScript test uses it, and only there — Go folds constant expressions at
// arbitrary precision while the runtime rounds per factor, so a computed product can differ by one
// ulp from the same expression written as a literal.
func closeTo(t *testing.T, label string, got, want float64, digits int) {
	t.Helper()
	tolerance := 0.5 * math.Pow(10, -float64(digits))
	if math.Abs(got-want) >= tolerance {
		t.Errorf("%s: got %v, want %v (within %v)", label, got, want, tolerance)
	}
}

// mustFloat parses a fixture string exactly as Number() does on the TypeScript side, so the
// expected open interest is the sum of the same two float64s the parser added.
func mustFloat(t *testing.T, s string) float64 {
	t.Helper()
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		t.Fatalf("parse %q: %v", s, err)
	}
	return v
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func TestParseStatsNormalizesBTC(t *testing.T) {
	snapshots := ParseStats(loadStats(t), NOW)

	got := snapshotBySymbol(snapshots, "BTC")
	if got == nil {
		t.Fatal("BTC missing from snapshots")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "venueSymbol", got.VenueSymbol, "BTC")
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDC")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)

	// The annualised rate becomes the rate for one 8h payment. Computed through variables rather
	// than as a literal expression, so Go performs the same float64 operations in the same order
	// the parser does instead of folding the whole thing at arbitrary precision.
	annualised, hours := 0.091241, 8.0
	eq(t, "rate", got.Rate, annualised*hours/8760)

	eq(t, "basisHours", got.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 8.0)
	if got.NextFundingAt != nil {
		t.Errorf("nextFundingAt: got %v, want nil", *got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 77229.3565140889)
	if got.IndexPrice != nil {
		t.Errorf("indexPrice: got %v, want nil", *got.IndexPrice)
	}

	// Open interest is long + short: every position faces OLP, so each side is a separate contract.
	long := mustFloat(t, "79488330.90156663078909270000")
	short := mustFloat(t, "70056049.647245814573357420000")
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), long+short)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 245987215.191356)

	// The RFQ quotes have no resting size, so no depth is claimed for them.
	if got.BestBid != nil || got.BestAsk != nil || got.BestBidSizeUSD != nil || got.BestAskSizeUSD != nil {
		t.Errorf("book: got bid %v/%v ask %v/%v, want all nil",
			got.BestBid, got.BestBidSizeUSD, got.BestAsk, got.BestAskSizeUSD)
	}
}

func TestParseStatsRoundTripsToThePublishedAnnualFigure(t *testing.T) {
	snapshots := ParseStats(loadStats(t), NOW)
	listings := rawListings(t)

	for _, s := range snapshots {
		listing, ok := listings[s.VenueSymbol]
		if !ok {
			t.Fatalf("%s: no fixture listing", s.VenueSymbol)
		}
		published, _ := listing["funding_rate"].(string)
		apr, err := core.APRFromRate(s.Rate, core.UnitFraction, s.BasisHours)
		if err != nil {
			t.Fatalf("%s: APRFromRate: %v", s.VenueSymbol, err)
		}
		closeTo(t, s.VenueSymbol+" apr", apr, mustFloat(t, published)*100, 8)
	}
}

func TestDocumentedConstantsPinTheUnitAsAnnual(t *testing.T) {
	snapshots := ParseStats(loadStats(t), NOW)

	// Interest component 0.00125%/h, the crypto default: 0.1095 annualised.
	closeTo(t, "interest component", IntervalRate(0.1095, 1), 0.0000125, 12)

	// Pre-IPO is "fixed at 0.005% every 8 hours"; OPENAI publishes 0.05475.
	openai := snapshotBySymbol(snapshots, "OPENAI")
	if openai == nil {
		t.Fatal("OPENAI missing")
	}
	closeTo(t, "OPENAI rate", openai.Rate, 0.00005, 12)

	// STORJ's -85.54 on a 1h interval is -0.98%/h annualised, inside the 2%/h cap.
	storj := snapshotBySymbol(snapshots, "STORJ")
	if storj == nil {
		t.Fatal("STORJ missing")
	}
	eq(t, "STORJ basisHours", storj.BasisHours, 1.0)
	eq(t, "STORJ intervalHours", f64(t, "STORJ intervalHours", storj.IntervalHours), 1.0)
	closeTo(t, "STORJ rate", storj.Rate, -0.0097644547, 9)
}

func TestEachListingKeepsItsOwnInterval(t *testing.T) {
	snapshots := ParseStats(loadStats(t), NOW)

	want := []struct {
		symbol string
		hours  float64
	}{
		{"BTC", 8},
		{"ETH", 8},
		{"HYPER", 4},
		{"STORJ", 1},
		{"1000PEPE", 8},
		{"OPN_OPINION", 4},
		{"OPENAI", 8},
		{"TSLA", 8},
		{"CAT", 8},
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), snapshots[i].VenueSymbol, w.symbol)
		eq(t, w.symbol+" intervalHours", f64(t, w.symbol+" intervalHours", snapshots[i].IntervalHours), w.hours)
	}
}

func TestSwapsWithNoFundingIntervalAreSkipped(t *testing.T) {
	stats := loadStats(t)

	var xaus *Listing
	for i := range stats.Listings {
		if stats.Listings[i].Ticker == "XAUS" {
			xaus = &stats.Listings[i]
		}
	}
	if xaus == nil {
		t.Fatal("XAUS missing from the fixture")
	}
	// Present and zero, not absent: the fixture really publishes 0 for a swap, and the skip has to
	// be driven by that zero rather than by a missing field.
	if !xaus.FundingIntervalS.OK || xaus.FundingIntervalS.Val != 0 {
		t.Fatalf("XAUS funding_interval_s: got %+v, want a present 0", xaus.FundingIntervalS)
	}

	if snapshotBySymbol(ParseStats(stats, NOW), "XAUS") != nil {
		t.Error("XAUS: got a snapshot, want the swap skipped")
	}
}

func TestDeclaredTickerIsTheBaseWhereTheParserDisagrees(t *testing.T) {
	snapshots := ParseStats(loadStats(t), NOW)

	want := []struct {
		symbol     string
		base       string
		multiplier float64
	}{
		{"BTC", "BTC", 1},
		{"ETH", "ETH", 1},
		{"HYPER", "HYPER", 1},
		{"STORJ", "STORJ", 1},
		{"1000PEPE", "PEPE", 1000},
		{"OPN_OPINION", "OPN_OPINION", 1},
		{"OPENAI", "OPENAI", 1},
		{"TSLA", "TSLA", 1},
		{"CAT", "CAT", 1},
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), snapshots[i].VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", snapshots[i].Base, w.base)
		eq(t, w.symbol+" multiplier", snapshots[i].Multiplier, w.multiplier)
	}

	// The prefixes stay multipliers rather than being read as a disagreement.
	eq(t, `DeclaredBase("RE_ETH")`, DeclaredBase("RE_ETH"), "RE_ETH")
	eq(t, `DeclaredBase("1000000MOG")`, DeclaredBase("1000000MOG"), "")
	eq(t, `DeclaredBase("BTC")`, DeclaredBase("BTC"), "")
}

func TestVariationalDeclaresNoClassSoEverythingIsCrypto(t *testing.T) {
	// Tradfi names included: TSLA and CAT are Tesla and Caterpillar here, and still land in crypto.
	for _, s := range ParseStats(loadStats(t), NOW) {
		eq(t, s.VenueSymbol+" assetClass", s.AssetClass, core.ClassCrypto)
		eq(t, s.VenueSymbol+" quote", str(t, s.VenueSymbol+" quote", s.Quote), "USDC")
	}
}

func TestAdapterSpacingAndNoFundingHistory(t *testing.T) {
	eq(t, "MinIntervalMs", MinIntervalMs, 1000)

	// Variational publishes no funding history, so the adapter must not offer to fetch any: the
	// TypeScript twin asserts `adapter.fetchFundingHistory` is undefined, and this is the Go
	// equivalent — a history loop that type-asserts for the capability must not find one here.
	type fundingHistoryFetcher interface {
		FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error)
	}
	if _, ok := any(&Adapter{}).(fundingHistoryFetcher); ok {
		t.Error("Adapter implements FetchFundingHistory, but Variational publishes no history")
	}
}
