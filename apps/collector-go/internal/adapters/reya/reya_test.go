package reya

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
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

// NOW is the later summary's updatedAt, the same instant reya.test.ts uses, so the two suites pin
// identical output.
const NOW int64 = 1_789_337_089_204

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files packages/adapters/src/venues/reya.test.ts
// reads: the port is verified against the exact bytes the original parser is pinned to, which is
// what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "reya")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/reya above the working directory")
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

func summaryFixture(tb testing.TB) []MarketSummary {
	tb.Helper()
	var rows []MarketSummary
	loadFixture(tb, "perpMarkets-summary", &rows)
	return rows
}

func earlierFixture(tb testing.TB) []MarketSummary {
	tb.Helper()
	var rows []MarketSummary
	loadFixture(tb, "perpMarkets-summary-earlier", &rows)
	return rows
}

func definitionsFixture(tb testing.TB) []MarketDefinition {
	tb.Helper()
	var rows []MarketDefinition
	loadFixture(tb, "marketDefinitions", &rows)
	return rows
}

func parsedFixture(tb testing.TB) []core.FundingSnapshot {
	tb.Helper()
	return ParseSnapshots(summaryFixture(tb), definitionsFixture(tb), NOW)
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

func rowBySymbol(rows []MarketSummary, symbol string) *MarketSummary {
	for i := range rows {
		if rows[i].Symbol == symbol {
			return &rows[i]
		}
	}
	return nil
}

func TestParseSnapshotsNormalizesBTC(t *testing.T) {
	got := snapshotBySymbol(parsedFixture(t), "BTCRUSDPERP")
	if got == nil {
		t.Fatal("BTCRUSDPERP missing from snapshots")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "venueSymbol", got.VenueSymbol, "BTCRUSDPERP")
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "RUSD")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	// Computed the same way reya.test.ts computes it, so the two agree bit for bit rather than to
	// some tolerance: the venue quotes percent per hour.
	eq(t, "rate", got.Rate, 0.001013625959372885/100)
	eq(t, "basisHours", got.BasisHours, 1.0)
	if got.IntervalHours != nil {
		t.Errorf("intervalHours: got %v, want nil", *got.IntervalHours)
	}
	if got.NextFundingAt != nil {
		t.Errorf("nextFundingAt: got %v, want nil", *got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 77013.0411011947)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 77013.0411011947)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), 39.3619*77013.0411011947)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 91245457.2703056)
	eq(t, "maxLeverage", f64(t, "maxLeverage", got.MaxLeverage), 40.0)

	// Level 1 is not in the summary, so the depth columns stay unknown rather than zero.
	if got.BestBid != nil || got.BestBidSizeUSD != nil || got.BestAsk != nil || got.BestAskSizeUSD != nil {
		t.Errorf("book: got %v/%v %v/%v, want all nil", got.BestBid, got.BestBidSizeUSD, got.BestAsk, got.BestAskSizeUSD)
	}
}

func TestBTCRateAnnualizesLikeEveryOtherVenue(t *testing.T) {
	btc := snapshotBySymbol(parsedFixture(t), "BTCRUSDPERP")
	if btc == nil {
		t.Fatal("BTCRUSDPERP missing from snapshots")
	}

	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	if math.Abs(apr-8.879) >= 0.0005 {
		t.Errorf("apr: got %v, want ~8.879", apr)
	}
}

func TestParseSnapshotsKeepsOnlyDefinedMarkets(t *testing.T) {
	snapshots := parsedFixture(t)

	// MKRRUSDPERP is still in the summary, with zero OI and volume, but no longer defined.
	want := []string{
		"BTCRUSDPERP",
		"ETHRUSDPERP",
		"kPEPERUSDPERP",
		"LINKRUSDPERP",
		"HYPERUSDPERP",
		"PAXGRUSDPERP",
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("snapshot[%d]", i), snapshots[i].VenueSymbol, symbol)
	}
}

func TestParseSnapshotsReadsBasesFromTheSymbolGrammar(t *testing.T) {
	snapshots := parsedFixture(t)

	want := []struct {
		symbol     string
		base       string
		multiplier float64
	}{
		{"BTCRUSDPERP", "BTC", 1},
		{"ETHRUSDPERP", "ETH", 1},
		{"kPEPERUSDPERP", "PEPE", 1000},
		{"LINKRUSDPERP", "LINK", 1},
		{"HYPERUSDPERP", "HYPE", 1},
		{"PAXGRUSDPERP", "PAXG", 1},
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), snapshots[i].VenueSymbol, w.symbol)
		eq(t, fmt.Sprintf("snapshot[%d].base", i), snapshots[i].Base, w.base)
		eq(t, fmt.Sprintf("snapshot[%d].multiplier", i), snapshots[i].Multiplier, w.multiplier)
		eq(t, fmt.Sprintf("snapshot[%d].quote", i), str(t, "quote", snapshots[i].Quote), "RUSD")
		eq(t, fmt.Sprintf("snapshot[%d].assetClass", i), snapshots[i].AssetClass, core.ClassCrypto)
	}
}

func TestParseSnapshotsKeepsANegativeRateNegative(t *testing.T) {
	summary := summaryFixture(t)
	hype := snapshotBySymbol(ParseSnapshots(summary, definitionsFixture(t), NOW), "HYPERUSDPERP")
	if hype == nil {
		t.Fatal("HYPERUSDPERP missing from snapshots")
	}
	row := rowBySymbol(summary, "HYPERUSDPERP")
	if row == nil {
		t.Fatal("HYPERUSDPERP missing from the summary fixture")
	}

	// Shorts pay, and the sign survives the percent conversion untouched.
	eq(t, "rate", hype.Rate, row.FundingRate.Val/100)
	if !(hype.Rate < 0) {
		t.Errorf("rate: got %v, want < 0", hype.Rate)
	}
}

// pair is one market sampled twice, 204s apart on 2026-09-14.
type pair struct {
	a, b  MarketSummary
	dt    float64
	price float64
}

func pairFor(t *testing.T, symbol string) pair {
	t.Helper()
	a := rowBySymbol(earlierFixture(t), symbol)
	b := rowBySymbol(summaryFixture(t), symbol)
	if a == nil || b == nil {
		t.Fatalf("%s missing from a summary fixture", symbol)
	}
	return pair{
		a:     *a,
		b:     *b,
		dt:    (b.UpdatedAt.Val - a.UpdatedAt.Val) / 3_600_000,
		price: b.ThrottledOraclePrice.Val,
	}
}

func TestFundingRateIsPercentAgainstTheLongAccumulator(t *testing.T) {
	p := pairFor(t, "BTCRUSDPERP")
	perDollarHour := (p.b.LongFundingValue.Val - p.a.LongFundingValue.Val) / (p.price * p.dt)
	meanRate := (*HourlyRate(p.a.FundingRate) + *HourlyRate(p.b.FundingRate)) / 2

	// 204s apart on 2026-09-14: 1.0074e-5 against 1.0070e-5. Read as a fraction it would be 100x off.
	ratio := perDollarHour / meanRate
	if !(ratio > 0.98) || !(ratio < 1.02) {
		t.Errorf("perDollarHour / meanRate: got %v, want between 0.98 and 1.02", ratio)
	}
}

func TestLongAndShortValuesAreAccumulatorsThatDriftApart(t *testing.T) {
	p := pairFor(t, "LINKRUSDPERP")
	longMove := p.b.LongFundingValue.Val - p.a.LongFundingValue.Val
	shortMove := p.b.ShortFundingValue.Val - p.a.ShortFundingValue.Val

	// Over the same 204s LINK's shorts were credited about a third of what its longs were charged.
	ratio := shortMove / longMove
	if math.Abs(ratio-0.31) >= 0.005 {
		t.Errorf("shortMove / longMove: got %v, want ~0.31", ratio)
	}
}

func TestStoredRateIsFundingRateAlone(t *testing.T) {
	summary := summaryFixture(t)
	definitions := definitionsFixture(t)

	skewed := make([]MarketSummary, len(summary))
	copy(skewed, summary)
	for i := range skewed {
		skewed[i].LongFundingValue = adapters.Num{Val: 999999, OK: true}
		skewed[i].ShortFundingValue = adapters.Num{Val: -999999, OK: true}
	}

	want := ParseSnapshots(summary, definitions, NOW)
	got := ParseSnapshots(skewed, definitions, NOW)
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got), len(want))
	}
	for i := range want {
		eq(t, fmt.Sprintf("snapshot[%d].rate", i), got[i].Rate, want[i].Rate)
	}
}

func TestHourlyRateConvertsPercentAndRejectsJunk(t *testing.T) {
	decode := func(raw string) adapters.Num {
		t.Helper()
		var n adapters.Num
		if err := n.UnmarshalJSON([]byte(raw)); err != nil {
			t.Fatalf("decode %s: %v", raw, err)
		}
		return n
	}

	if got := HourlyRate(decode(`"0.001"`)); got == nil || math.Abs(*got-0.00001) >= 1e-12 {
		t.Errorf(`HourlyRate("0.001"): got %v, want ~0.00001`, got)
	}
	if got := HourlyRate(decode(`"-0.5"`)); got == nil || *got != -0.005 {
		t.Errorf(`HourlyRate("-0.5"): got %v, want -0.005`, got)
	}
	if got := HourlyRate(decode(`""`)); got != nil {
		t.Errorf(`HourlyRate(""): got %v, want nil`, *got)
	}
	// An absent field, which must not read as a zero rate: zero funding is a legitimate reading.
	if got := HourlyRate(adapters.Num{}); got != nil {
		t.Errorf("HourlyRate(absent): got %v, want nil", *got)
	}
}

func TestPerpBaseReadsTheDocumentedGrammarAndNothingElse(t *testing.T) {
	sonic, ok := PerpBase("SRUSDPERP")
	if !ok || sonic.Base != "S" || sonic.Multiplier != 1 {
		t.Errorf("PerpBase(SRUSDPERP): got %+v ok=%v, want {S 1} ok=true", sonic, ok)
	}
	bonk, ok := PerpBase("kBONKRUSDPERP")
	if !ok || bonk.Base != "BONK" || bonk.Multiplier != 1000 {
		t.Errorf("PerpBase(kBONKRUSDPERP): got %+v ok=%v, want {BONK 1000} ok=true", bonk, ok)
	}
	if got, ok := PerpBase("WETHRUSD"); ok {
		t.Errorf("PerpBase(WETHRUSD): got %+v, want not a perp", got)
	}
	if got, ok := PerpBase("RUSDPERP"); ok {
		t.Errorf("PerpBase(RUSDPERP): got %+v, want not a perp", got)
	}
}

// fakeDoer answers from the fixture files by URL, following the adapters' own dependency injection
// rather than patching a global transport.
type fakeDoer struct {
	definitions []byte
	summary     []byte
	urls        []string
}

func (f *fakeDoer) Do(req *http.Request) (*http.Response, error) {
	url := req.URL.String()
	f.urls = append(f.urls, url)
	body := f.summary
	if strings.HasSuffix(url, "/marketDefinitions") {
		body = f.definitions
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(string(body))),
		Header:     http.Header{},
	}, nil
}

func TestAdapterCachesDefinitionsForAnHour(t *testing.T) {
	doer := &fakeDoer{
		definitions: fixtureBytes(t, "marketDefinitions"),
		summary:     fixtureBytes(t, "perpMarkets-summary"),
	}
	client := httpclient.New(VenueID, httpclient.Options{Doer: doer})
	adapter := NewAdapter(client)

	start := time.UnixMilli(NOW)
	ctx := context.Background()
	if _, err := adapter.FetchSnapshots(ctx, start); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if _, err := adapter.FetchSnapshots(ctx, start.Add(59*time.Minute)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	batch, err := adapter.FetchSnapshots(ctx, start.Add(60*time.Minute))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	defs := API + "/marketDefinitions"
	sum := API + "/perpMarkets/summary"
	want := []string{defs, sum, sum, defs, sum}
	if len(doer.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", doer.urls, want)
	}
	for i, url := range want {
		eq(t, fmt.Sprintf("url[%d]", i), doer.urls[i], url)
	}

	if len(batch.Snapshots) != 6 {
		t.Errorf("snapshots: got %d, want 6", len(batch.Snapshots))
	}
	// Reya publishes no market funding history, so the adapter exposes none.
	var history any = adapter
	if _, ok := history.(interface {
		FetchFundingHistory(context.Context, string, int64, int64) ([]core.FundingEvent, error)
	}); ok {
		t.Error("adapter implements FetchFundingHistory, but Reya publishes no funding history")
	}
	eq(t, "requestCount", adapter.RequestCount(), 5)
	eq(t, "venueId", adapter.VenueID(), "reya")
}

func TestAdapterRejectsANonArrayBody(t *testing.T) {
	doer := &fakeDoer{
		definitions: []byte(`null`),
		summary:     fixtureBytes(t, "perpMarkets-summary"),
	}
	client := httpclient.New(VenueID, httpclient.Options{Doer: doer})

	_, err := NewAdapter(client).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("want an error for a null marketDefinitions body, got nil")
	}
	eq(t, "error", err.Error(), "reya: unexpected marketDefinitions response")
}
