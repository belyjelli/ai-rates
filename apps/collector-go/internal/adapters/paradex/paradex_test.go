package paradex

import (
	"bytes"
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

// NOW is the same instant paradex.test.ts uses, so the two suites pin identical output.
const NOW int64 = 1_789_147_120_000

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files
// packages/adapters/src/venues/paradex.test.ts reads: the port is verified against the exact bytes
// the original parser is pinned to, which is what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "paradex")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/paradex above the working directory")
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

// venueNum decodes a venue number the way a response body would, so a test row carries the exact
// string Paradex returned rather than a float retyped by hand.
func venueNum(tb testing.TB, raw string) adapters.Num {
	tb.Helper()
	var n adapters.Num
	if err := n.UnmarshalJSON([]byte(`"` + raw + `"`)); err != nil {
		tb.Fatalf("decode %q: %v", raw, err)
	}
	return n
}

// closeTo is bun:test's toBeCloseTo: equal to within half a unit in the given decimal place.
func closeTo(t *testing.T, label string, got, want float64, decimals int) {
	t.Helper()
	if math.Abs(got-want) >= 0.5*math.Pow(10, -float64(decimals)) {
		t.Errorf("%s: got %v, want %v to %d decimals", label, got, want, decimals)
	}
}

func symbols(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for i := range snapshots {
		out = append(out, snapshots[i].VenueSymbol)
	}
	return out
}

func TestParseSnapshotsNormalizesBTCPerpsAndSkipsOptions(t *testing.T) {
	var summary Results[Summary]
	var markets Results[Market]
	loadFixture(t, "markets-summary", &summary)
	loadFixture(t, "markets", &markets)

	snapshots := ParseSnapshots(summary, markets, NOW)

	want := []string{"BTC-USD-PERP", "ETH-USD-PERP"}
	got := symbols(snapshots)
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %v, want %v", got, want)
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("snapshot[%d]", i), got[i], symbol)
	}

	btc := snapshots[0]
	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "base", btc.Base, "BTC")
	// The settlement currency, not the symbol's USD: funding and PnL settle in USDC.
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %q, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.00007688102642)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	// Paradex accrues funding every second, so it publishes neither a settlement interval nor a next
	// settlement time. Absent, never zero.
	if btc.IntervalHours != nil {
		t.Errorf("intervalHours: got %v, want nil", *btc.IntervalHours)
	}
	if btc.NextFundingAt != nil {
		t.Errorf("nextFundingAt: got %v, want nil", *btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77804.85141726)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77788.24195927)
	// Open interest is base units, priced at the venue's own mark. Computed from the same two
	// figures paradex.test.ts multiplies, to the same tolerance it uses: Mul rounds once per factor
	// at runtime while the compiler folds the literal product at arbitrary precision, so the two
	// differ in the last ulp and only a tolerance can compare them.
	closeTo(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), 50.4599*77804.85141726, 4)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 4273947.632803999)

	// 0.00007688102642 over 8h -> 8.4185% simple APR.
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	if math.Abs(apr-8.418472393) > 5e-7 {
		t.Errorf("apr: got %v, want 8.418472393", apr)
	}
}

func TestParseSnapshotsSkipsPerpsWithoutAKnownFundingPeriod(t *testing.T) {
	var summary Results[Summary]
	var markets Results[Market]
	loadFixture(t, "markets-summary", &summary)
	loadFixture(t, "markets", &markets)

	withoutPeriod := Results[Market]{Results: make([]Market, 0, len(markets.Results))}
	for _, m := range markets.Results {
		if m.Symbol == "ETH-USD-PERP" {
			m.FundingPeriodHours = adapters.Num{Val: 0, OK: true}
		}
		withoutPeriod.Results = append(withoutPeriod.Results, m)
	}

	got := symbols(ParseSnapshots(summary, withoutPeriod, NOW))
	if len(got) != 1 || got[0] != "BTC-USD-PERP" {
		t.Fatalf("snapshots: got %v, want [BTC-USD-PERP]", got)
	}
}

func TestRWATagDeclaresNotCryptoAndTheBaseTablesSettleWhichKind(t *testing.T) {
	// Symbol, tags, mark and funding rate as /v1/markets and its summary returned them on 2026-09-14.
	rows := []struct {
		symbol      string
		tags        []string
		markPrice   string
		fundingRate string
	}{
		{"XAU-USD-PERP", []string{"RWA"}, "4347.40965101", "0.00008486771875"},
		{"NG-USD-PERP", []string{"RWA"}, "2.96534246", "0.00003794032754"},
		{"US500-USD-PERP", []string{"RWA"}, "7613.60043367", "0.00004992814582"},
		{"MSTR-USD-PERP", []string{"RWA"}, "130.06003982", "-0.00005212287882"},
		{"DRAM-USD-PERP", []string{"RWA"}, "56.72746065", "0.00001660279227"},
		{"PAXG-USD-PERP", []string{"DEFI"}, "4344.66416924", "0.0000866282175"},
		{"BTC-USD-PERP", []string{"LAYER-1"}, "77352.23249441", "0.000088284432"},
	}

	usd, usdc := "USD", "USDC"
	var markets Results[Market]
	var summary Results[Summary]
	for _, row := range rows {
		markets.Results = append(markets.Results, Market{
			Symbol:             row.symbol,
			AssetKind:          "PERP",
			FundingPeriodHours: adapters.Num{Val: 8, OK: true},
			QuoteCurrency:      &usd,
			SettlementCurrency: &usdc,
			Tags:               row.tags,
		})
		summary.Results = append(summary.Results, Summary{
			Symbol:      row.symbol,
			MarkPrice:   venueNum(t, row.markPrice),
			FundingRate: venueNum(t, row.fundingRate),
		})
	}

	want := []struct {
		symbol string
		base   string
		class  core.AssetClass
	}{
		{"XAU-USD-PERP", "XAU", core.ClassCommodity},
		// The alias reaches NATGAS before the commodity table is consulted.
		{"NG-USD-PERP", "NATGAS", core.ClassCommodity},
		{"US500-USD-PERP", "US500", core.ClassIndex},
		{"MSTR-USD-PERP", "MSTR", core.ClassEquity},
		// An ETF, which the tables file as equity.
		{"DRAM-USD-PERP", "DRAM", core.ClassEquity},
		// Tagged DEFI by Paradex: a gold token, and crypto on the venue's own word.
		{"PAXG-USD-PERP", "PAXG", core.ClassCrypto},
		{"BTC-USD-PERP", "BTC", core.ClassCrypto},
	}

	snapshots := ParseSnapshots(summary, markets, NOW)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), snapshots[i].VenueSymbol, w.symbol)
		eq(t, fmt.Sprintf("snapshot[%d].base", i), snapshots[i].Base, w.base)
		eq(t, fmt.Sprintf("snapshot[%d].assetClass", i), snapshots[i].AssetClass, w.class)
	}
}

func TestDeclaredClassNeverReadsAClassOffAnUntaggedTicker(t *testing.T) {
	eq(t, "nil/XAU", DeclaredClass(nil, "XAU"), core.ClassCrypto)
	eq(t, "empty/US500", DeclaredClass([]string{}, "US500"), core.ClassCrypto)
	eq(t, "rwa/XAG", DeclaredClass([]string{"rwa"}, "XAG"), core.ClassCommodity)
}

// recordingDoer answers /markets with the markets fixture and everything else with the summary,
// recording every URL so the cache can be observed from outside the adapter.
type recordingDoer struct {
	urls    []string
	markets []byte
	summary []byte
}

func (d *recordingDoer) Do(req *http.Request) (*http.Response, error) {
	url := req.URL.String()
	d.urls = append(d.urls, url)
	body := d.summary
	if strings.HasSuffix(url, "/markets") {
		body = d.markets
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader(body)),
	}, nil
}

// fundingHistoryFetcher is the history half of the collector's venue interface. The TypeScript
// adapter omits fetchFundingHistory outright; the Go equivalent of that absence is *Adapter not
// satisfying this.
type fundingHistoryFetcher interface {
	FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error)
}

func TestAdapterCachesMarketsForAnHourAndHasNoFundingHistory(t *testing.T) {
	doer := &recordingDoer{
		markets: fixtureBytes(t, "markets"),
		summary: fixtureBytes(t, "markets-summary"),
	}
	client := httpclient.New(VenueID, httpclient.Options{Doer: doer})
	adapter := NewAdapter(client)
	ctx := context.Background()

	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+59*60_000)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	batch, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+60*60_000))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	marketsURL := apiBase + "/markets"
	summaryURL := apiBase + "/markets/summary?market=ALL"
	want := []string{marketsURL, summaryURL, summaryURL, marketsURL, summaryURL}
	if len(doer.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", doer.urls, want)
	}
	for i, url := range want {
		eq(t, fmt.Sprintf("url[%d]", i), doer.urls[i], url)
	}

	if len(batch.Snapshots) != 2 {
		t.Errorf("snapshots: got %d, want 2", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d events, want 0", len(batch.Settled))
	}
	if _, ok := any(adapter).(fundingHistoryFetcher); ok {
		t.Error("*Adapter implements FetchFundingHistory; /v1/funding/data is accrual, not settlements")
	}
}
