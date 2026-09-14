package arcus

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instants arcus.test.ts uses, so both suites pin identical output.
const (
	NOW         int64 = 1_789_337_000_000 // 2026-09-13T22:03:20Z
	nextFunding int64 = 1_789_340_400_000 // 23:00Z
)

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "arcus")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/arcus above the working directory")
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

// The SAME files packages/adapters/src/venues/arcus.test.ts reads.
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
// constant expression instead, `60.0595314 * 77119.6` is folded at arbitrary precision and can land
// one ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func marketFixture(tb testing.TB) []Market {
	tb.Helper()
	var body MarketsResponse
	load(tb, "markets", &body)
	if body.Markets == nil {
		tb.Fatal("markets fixture has no markets array")
	}
	return *body.Markets
}

func fundingFixture(tb testing.TB) []FundingRate {
	tb.Helper()
	var body FundingRatesResponse
	load(tb, "fundingRates-BTC-USD", &body)
	if body.FundingRates == nil {
		tb.Fatal("fundingRates fixture has no fundingRates array")
	}
	return *body.FundingRates
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func eventBySymbol(events []core.FundingEvent, symbol string) *core.FundingEvent {
	for i := range events {
		if events[i].VenueSymbol == symbol {
			return &events[i]
		}
	}
	return nil
}

func TestParseMarketsNormalizesBTCUSD(t *testing.T) {
	got := ParseMarkets(marketFixture(t), NOW)

	btc := snapshotBySymbol(got.Snapshots, "BTC-USD")
	if btc == nil {
		t.Fatal("BTC-USD missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-USD")
	eq(t, "base", btc.Base, "BTC")
	// Arcus prices in USD and settles in USDG.
	eq(t, "quote", str(t, "quote", btc.Quote), "USDG")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// The forecast is the snapshot, not the applied rate.
	eq(t, "rate", btc.Rate, 0.0000125)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	// nextFundingAt is unix SECONDS on the wire.
	if btc.NextFundingAt == nil || *btc.NextFundingAt != nextFunding {
		t.Errorf("nextFundingAt: got %v, want %d", btc.NextFundingAt, nextFunding)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77119.6)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77101.9)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(60.0595314, 77119.6))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 18092181.61)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 1/0.025)
}

func TestParseMarketsSplitsTheForecastFromTheAppliedRate(t *testing.T) {
	got := ParseMarkets(marketFixture(t), NOW)

	// CASHCAT is the fixture's one market where the two differ.
	cashcat := snapshotBySymbol(got.Snapshots, "CASHCAT-USD")
	if cashcat == nil {
		t.Fatal("CASHCAT-USD missing")
	}
	eq(t, "CASHCAT rate", cashcat.Rate, 0.00009867686245265627)

	settled := eventBySymbol(got.Settled, "CASHCAT-USD")
	if settled == nil {
		t.Fatal("CASHCAT-USD settlement missing")
	}
	eq(t, "CASHCAT settledAt", settled.SettledAt, nextFunding-3_600_000)
	eq(t, "CASHCAT settled rate", settled.Rate, 0.000101068592527558)
	eq(t, "CASHCAT settled basisHours", settled.BasisHours, 1.0)
	if settled.MarkPrice != nil {
		t.Errorf("CASHCAT settled markPrice: got %v, want nil", *settled.MarkPrice)
	}

	// The live history's newest BTC row is exactly that settlement.
	rows := fundingFixture(t)
	if len(rows) == 0 {
		t.Fatal("funding fixture is empty")
	}
	eq(t, "newest history row", int64(rows[0].Time.Val), (nextFunding-3_600_000)*1000)
	btc := eventBySymbol(got.Settled, "BTC-USD")
	if btc == nil {
		t.Fatal("BTC-USD settlement missing")
	}
	eq(t, "BTC settled rate", btc.Rate, rows[0].FundingRate.Val)
}

func TestParseMarketsConvertsOpenInterestAtTheMark(t *testing.T) {
	eth := snapshotBySymbol(ParseMarkets(marketFixture(t), NOW).Snapshots, "ETH-USD")
	if eth == nil {
		t.Fatal("ETH-USD missing")
	}
	// Base units, long side: 709.14 ETH at 2,499.44 is $1.77M, not 709.
	closeTo(t, "openInterestUsd", f64(t, "openInterestUsd", eth.OpenInterestUSD), product(709.1385169, 2499.44), 5e-7)
	eq(t, "maxLeverage", f64(t, "maxLeverage", eth.MaxLeverage), 1/0.04)
}

func TestParseMarketsKeepsOnlyOnlinePerpetuals(t *testing.T) {
	got := ParseMarkets(marketFixture(t), NOW)

	want := []string{"BTC-USD", "ETH-USD", "CASHCAT-USD", "AMD-USD", "GLD-USD", "SPY-USD"}
	if len(got.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got.Snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("snapshot[%d]", i), got.Snapshots[i].VenueSymbol, symbol)
	}
	// F-USD is OFFLINE, so neither a snapshot nor a settlement.
	if len(got.Settled) != len(want) {
		t.Fatalf("settled: got %d, want %d", len(got.Settled), len(want))
	}
}

func TestParseMarketsCarriesTheDeclaredClass(t *testing.T) {
	got := ParseMarkets(marketFixture(t), NOW)

	want := []struct {
		symbol string
		base   string
		class  core.AssetClass
	}{
		{"BTC-USD", "BTC", core.ClassCrypto},
		{"ETH-USD", "ETH", core.ClassCrypto},
		{"CASHCAT-USD", "CASHCAT", core.ClassCrypto},
		{"AMD-USD", "AMD", core.ClassEquity},
		// COMMODITIES holds commodity ETFs, which core files as equity.
		{"GLD-USD", "GLD", core.ClassEquity},
		// INDICES holds index ETFs.
		{"SPY-USD", "SPY", core.ClassEquity},
	}
	if len(got.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got.Snapshots), len(want))
	}
	for i, w := range want {
		s := got.Snapshots[i]
		eq(t, "venueSymbol", s.VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", s.Base, w.base)
		eq(t, w.symbol+" assetClass", s.AssetClass, w.class)
		eq(t, w.symbol+" quote", str(t, "quote", s.Quote), "USDG")
	}
}

func TestAssetClassForReadsEveryDeclaredCategory(t *testing.T) {
	eq(t, "CRYPTO/BTC", AssetClassFor("CRYPTO", "BTC"), core.ClassCrypto)
	// An undeclared category is crypto, never read off the ticker.
	eq(t, "missing/XAU", AssetClassFor("", "XAU"), core.ClassCrypto)
	eq(t, "EQUITIES/AMD", AssetClassFor("EQUITIES", "AMD"), core.ClassEquity)
	eq(t, "INDICES/SPY", AssetClassFor("INDICES", "SPY"), core.ClassIndex)
	eq(t, "FOREX/EUR", AssetClassFor("FOREX", "EUR"), core.ClassFX)
	// COMMODITIES says only "not crypto"; the base tables say which kind.
	eq(t, "COMMODITIES/XAU", AssetClassFor("COMMODITIES", "XAU"), core.ClassCommodity)
	eq(t, "COMMODITIES/GLD", AssetClassFor("COMMODITIES", "GLD"), core.ClassEquity)
	// An unrecognised category never throws, and is still not crypto.
	eq(t, "BONDS/US10Y", AssetClassFor("BONDS", "US10Y"), core.ClassIndex)
}

func TestParseFundingRatesTurnsMicrosecondRowsIntoOldestFirstSettlements(t *testing.T) {
	events := ParseFundingRates(fundingFixture(t), "BTC-USD", "CRYPTO", 0, 9_007_199_254_740_991)

	want := []int64{
		1_789_322_400_000,
		1_789_326_000_000,
		1_789_329_600_000,
		1_789_333_200_000,
		1_789_336_800_000,
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, settledAt := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, settledAt)
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, 0.0000125)
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, 1.0)
	}
	eq(t, "event[0].base", events[0].Base, "BTC")
	eq(t, "event[0].quote", str(t, "quote", events[0].Quote), "USDG")
	eq(t, "event[0].assetClass", events[0].AssetClass, core.ClassCrypto)
}

func TestParseFundingRatesDropsRowsOutsideTheWindow(t *testing.T) {
	rows := fundingFixture(t)
	events := ParseFundingRates(rows, "BTC-USD", "CRYPTO", 1_789_329_600_000, 1_789_333_200_000)

	want := []int64{1_789_329_600_000, 1_789_333_200_000}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, settledAt := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, settledAt)
	}
}

// stubDoer answers every request from respond, recording the URLs asked for. It is the Go seam for
// the fake HttpClient arcus.test.ts builds.
type stubDoer struct {
	urls    []string
	respond func(url string, n int) []byte
}

func (d *stubDoer) Do(req *http.Request) (*http.Response, error) {
	d.urls = append(d.urls, req.URL.String())
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(d.respond(req.URL.String(), len(d.urls)))),
		Request:    req,
	}, nil
}

// historyRows builds a page of `count` hourly AMD-USD rows counting back from `top` microseconds.
//
// Written as raw JSON rather than as []FundingRate: adapters.Num has no MarshalJSON, so a struct
// holding one cannot be round-tripped through encoding/json.
func historyRows(top, hourUs int64, count int) []byte {
	var b strings.Builder
	b.WriteString(`{"fundingRates":[`)
	for i := 0; i < count; i++ {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, `{"marketId":11,"marketDisplayName":"AMD-USD",`+
			`"fundingRate":"0.000004768518518518","time":%d}`, top-int64(i)*hourUs)
	}
	b.WriteString("]}")
	return []byte(b.String())
}

func TestFetchSnapshotsTakesOneRequestAndHistoryPagesByTo(t *testing.T) {
	const (
		hourUs int64 = 3_600_000_000
		newest int64 = 1_789_336_800_000_000
	)
	markets := fixtureBytes(t, "markets")
	doer := &stubDoer{respond: func(url string, n int) []byte {
		if strings.HasSuffix(url, "/markets") {
			return markets
		}
		// The first history page is full, so the walk asks for a second.
		if n == 2 {
			return historyRows(newest, hourUs, historyPageSize)
		}
		return historyRows(newest-int64(historyPageSize)*hourUs, hourUs, 2)
	}}
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	ctx := context.Background()

	batch, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(doer.urls) != 1 || doer.urls[0] != API+"/markets" {
		t.Fatalf("snapshot urls: got %v, want [%s/markets]", doer.urls, API)
	}
	if len(batch.Snapshots) != 6 {
		t.Fatalf("snapshots: got %d, want 6", len(batch.Snapshots))
	}

	fromMs := (newest - 1001*hourUs) / 1000
	toMs := newest / 1000
	events, err := adapter.FetchFundingHistory(ctx, "AMD-USD", fromMs, toMs)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	// The window is asked for in MICROSECONDS, and the second page steps `to` past the oldest row.
	want := []string{
		fmt.Sprintf("%s/fundingRates?market=AMD-USD&from=%d&to=%d&limit=1000", API, fromMs*1000, toMs*1000),
		fmt.Sprintf("%s/fundingRates?market=AMD-USD&from=%d&to=%d&limit=1000", API, fromMs*1000, newest-999*hourUs-1),
	}
	got := doer.urls[1:]
	if len(got) != len(want) {
		t.Fatalf("history urls: got %v, want %v", got, want)
	}
	for i, url := range want {
		eq(t, fmt.Sprintf("history url[%d]", i), got[i], url)
	}

	if len(events) != 1002 {
		t.Fatalf("events: got %d, want 1002", len(events))
	}
	// History carries the class the markets call declared: AMD-USD is EQUITIES.
	for _, event := range events {
		if event.AssetClass != core.ClassEquity {
			t.Fatalf("%s: assetClass %q, want equity from the remembered category", event.VenueSymbol, event.AssetClass)
		}
	}
}

func TestFetchSnapshotsRejectsABodyWithoutMarkets(t *testing.T) {
	doer := &stubDoer{respond: func(string, int) []byte { return []byte(`{}`) }}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))

	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW)); err == nil {
		t.Fatal("want an error for a body with no markets array")
	}
}
