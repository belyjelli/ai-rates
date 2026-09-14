package aevo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NOW is the instant aevo.test.ts uses, around when the fixtures were fetched: 2026-09-13 22:30 UTC.
const NOW int64 = 1_789_338_600_000

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files packages/adapters/src/venues/aevo.test.ts
// reads: the port is verified against the exact bytes the original parser is pinned to, which is
// what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "aevo")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/aevo above the working directory")
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

func loadMarkets(tb testing.TB) []Market {
	tb.Helper()
	var markets []Market
	loadFixture(tb, "markets", &markets)
	return markets
}

func loadStatistics(tb testing.TB) []Statistic {
	tb.Helper()
	var statistics []Statistic
	loadFixture(tb, "coingecko-statistics", &statistics)
	return statistics
}

func eq[T comparable](t *testing.T, label string, got, want T) {
	t.Helper()
	if got != want {
		t.Errorf("%s: got %v, want %v", label, got, want)
	}
}

func f64(t *testing.T, label string, got *float64) float64 {
	t.Helper()
	if got == nil {
		t.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func i64(t *testing.T, label string, got *int64) int64 {
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

func symbols(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for i := range snapshots {
		out = append(out, snapshots[i].VenueSymbol)
	}
	return out
}

func contains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}

func findSnapshot(t *testing.T, snapshots []core.FundingSnapshot, symbol string) core.FundingSnapshot {
	t.Helper()
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return snapshots[i]
		}
	}
	t.Fatalf("%s missing from %v", symbol, symbols(snapshots))
	return core.FundingSnapshot{}
}

func TestParseSnapshotsNormalizesBTCPerp(t *testing.T) {
	btc := findSnapshot(t, ParseSnapshots(loadMarkets(t), loadStatistics(t), NOW), "BTC-PERP")

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %q, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// One hour: the 8h formula divided by the funding interval. 0.000008/h is 7.0% APR.
	eq(t, "rate", btc.Rate, 0.000008)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	// Epoch seconds in the statistics call.
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", btc.NextFundingAt), 1_789_340_400_000)
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76729.48536)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76759.462906)
	// Contracts, whatever the spec says: 26.2 BTC is $2.0M. The expectation is multiplied at RUNTIME
	// from the same two figures aevo.test.ts multiplies, in the same order Mul uses: the compiler
	// folds an untyped literal product at arbitrary precision, so a folded constant would differ from
	// the collector's own answer in the last ulp.
	openInterest, markPrice := 26.235999, 76729.48536
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), openInterest*markPrice)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 1889388.228)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 20.0)

	// 0.000008/h over 24*365 hours is 7.0% simple APR.
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	if apr < 6.99 || apr > 7.01 {
		t.Errorf("apr: got %v, want about 7.0", apr)
	}
}

func TestParseSnapshotsEmitsActivePerpsOnly(t *testing.T) {
	all := symbols(ParseSnapshots(loadMarkets(t), loadStatistics(t), NOW))
	// BEAMX-PERP is in the statistics (delisted) but not among active markets.
	if contains(all, "BEAMX-PERP") {
		t.Errorf("snapshots: got %v, want no BEAMX-PERP", all)
	}
	if len(all) != 9 {
		t.Fatalf("snapshots: got %d (%v), want 9", len(all), all)
	}

	rows := loadMarkets(t)
	rows[0].IsActive = false
	rows[1].InstrumentType = "OPTION"
	got := symbols(ParseSnapshots(rows, loadStatistics(t), NOW))
	if contains(got, "BTC-PERP") || contains(got, "ETH-PERP") {
		t.Errorf("snapshots: got %v, want neither BTC-PERP nor ETH-PERP", got)
	}

	// An empty funding rate is ABSENT, not zero, so the market is skipped rather than published at 0.
	stats := loadStatistics(t)
	for i := range stats {
		if stats[i].TickerID == "MSTR-PERP" {
			stats[i].FundingRate = venueNum("")
		}
	}
	got = symbols(ParseSnapshots(loadMarkets(t), stats, NOW))
	if contains(got, "MSTR-PERP") {
		t.Errorf("snapshots: got %v, want no MSTR-PERP", got)
	}
}

func TestParseSnapshotsClassFromMarketTypeQuoteFromQuoteAsset(t *testing.T) {
	want := []struct {
		symbol     string
		base       string
		multiplier float64
		class      core.AssetClass
		quote      string
	}{
		{"BTC-PERP", "BTC", 1, core.ClassCrypto, "USDC"},
		{"ETH-PERP", "ETH", 1, core.ClassCrypto, "USDC"},
		{"MSTR-PERP", "MSTR", 1, core.ClassEquity, "USDC"},
		{"XAU-PERP", "XAU", 1, core.ClassCommodity, "USDC"},
		{"USDJPY-PERP", "USDJPY", 1, core.ClassFX, "USDC"},
		// `compute` has no class of its own; H100 is in the index table.
		{"H100-PERP", "H100", 1, core.ClassIndex, "USDC"},
		{"ANTHROPIC-PERP", "ANTHROPIC", 1, core.ClassEquity, "USDC"},
		{"SPY-PERP", "SPY", 1, core.ClassEquity, "USDC"},
		{"1000PEPE-PERP", "PEPE", 1000, core.ClassCrypto, "USDC"},
	}

	snapshots := ParseSnapshots(loadMarkets(t), loadStatistics(t), NOW)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %v, want %d rows", symbols(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), snapshots[i].VenueSymbol, w.symbol)
		eq(t, fmt.Sprintf("snapshot[%d].base", i), snapshots[i].Base, w.base)
		eq(t, fmt.Sprintf("snapshot[%d].multiplier", i), snapshots[i].Multiplier, w.multiplier)
		eq(t, fmt.Sprintf("snapshot[%d].assetClass", i), snapshots[i].AssetClass, w.class)
		eq(t, fmt.Sprintf("snapshot[%d].quote", i), str(t, "quote", snapshots[i].Quote), w.quote)
	}

	eq(t, "unknown type, not rwa", AssetClassFor("something_new", false, "FOO"), core.ClassCrypto)
	eq(t, "unknown type, rwa", AssetClassFor("something_new", true, "XAG"), core.ClassCommodity)
	// The TypeScript passes undefined here; an absent market_type is the empty string in Go.
	eq(t, "no type, rwa", AssetClassFor("", true, "NVDA"), core.ClassEquity)
}

func TestParseFundingNanosecondTimesOldestFirst(t *testing.T) {
	var body FundingHistoryResponse
	loadFixture(t, "funding-history_BTC-PERP", &body)

	events := ParseFunding(body.FundingHistory, loadMarkets(t)[0], 1_789_329_600_000, NOW)

	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
		markPrice  float64
	}{
		{1_789_329_600_000, 0.00001, 1, 77264.648569},
		{1_789_333_200_000, 0.000012, 1, 77326.214489},
		{1_789_336_800_000, 0.00001, 1, 77294.556299},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, w.settledAt)
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, w.rate)
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, w.basisHours)
		eq(t, fmt.Sprintf("event[%d].markPrice", i), f64(t, "markPrice", events[i].MarkPrice), w.markPrice)
	}
	eq(t, "event[0].base", events[0].Base, "BTC")
	eq(t, "event[0].quote", str(t, "quote", events[0].Quote), "USDC")
	eq(t, "event[0].assetClass", events[0].AssetClass, core.ClassCrypto)
}

func TestNsToMsIsExactAndRejectsNonIntegers(t *testing.T) {
	cases := []struct {
		ns   string
		want int64
		ok   bool
	}{
		{"1789336800000000000", 1_789_336_800_000, true},
		// Exact to the millisecond: the 123 survives, and the sub-millisecond digits truncate.
		{"1789336800123456789", 1_789_336_800_123, true},
		{"1.5e18", 0, false},
		// The TypeScript passes undefined; an absent field is the empty string in Go.
		{"", 0, false},
	}
	for _, c := range cases {
		got, ok := NsToMs(c.ns)
		eq(t, fmt.Sprintf("nsToMs(%q) ok", c.ns), ok, c.ok)
		eq(t, fmt.Sprintf("nsToMs(%q)", c.ns), got, c.want)
	}
}

// routingDoer answers each request from a body chosen by URL, recording every URL asked for. It is
// the Go seam for the fake HttpClient aevo.test.ts builds: the point of both adapter tests is which
// URLs the cycle asks for, and how many.
type routingDoer struct {
	urls []string
	body func(*url.URL) []byte
}

func (d *routingDoer) Do(req *http.Request) (*http.Response, error) {
	d.urls = append(d.urls, req.URL.String())
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(d.body(req.URL))),
		Request:    req,
	}, nil
}

func newTestAdapter(doer *routingDoer) *Adapter {
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the cycle's own.
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsMakesTwoBulkRequestsACycle(t *testing.T) {
	markets := fixtureBytes(t, "markets")
	statistics := fixtureBytes(t, "coingecko-statistics")
	doer := &routingDoer{body: func(u *url.URL) []byte {
		if strings.Contains(u.String(), "/markets") {
			return markets
		}
		return statistics
	}}

	batch, err := newTestAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	want := []string{
		APIBase + "/markets?instrument_type=PERPETUAL",
		APIBase + "/coingecko-statistics",
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", doer.urls, want)
	}
	for i, u := range want {
		eq(t, fmt.Sprintf("url[%d]", i), doer.urls[i], u)
	}
	if len(batch.Snapshots) != 9 {
		t.Errorf("snapshots: got %d, want 9", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d events, want 0", len(batch.Settled))
	}
}

func TestFetchFundingHistoryPagesFiftyAtATime(t *testing.T) {
	const hour int64 = 3_600_000
	const newest int64 = 1_789_336_800_000
	ns := func(ms int64) int64 { return ms * nsPerMs }

	// A full page of 50 for the first request and a short page of 4 for the second, so the walk
	// stops on the short page. The rows are built as RAW JSON: marshalling the wire struct would
	// emit Num as an object and decode back as absent.
	doer := &routingDoer{body: func(u *url.URL) []byte {
		end, err := strconv.ParseInt(u.Query().Get("end_time"), 10, 64)
		if err != nil {
			t.Fatalf("end_time: %v", err)
		}
		newestMs := (end / nsPerMs / hour) * hour
		count := 4
		if newestMs == newest {
			count = HistoryPageSize
		}
		var body strings.Builder
		body.WriteString(`{"funding_history":[`)
		for i := 0; i < count; i++ {
			if i > 0 {
				body.WriteString(",")
			}
			fmt.Fprintf(&body, `["ETH-PERP","%d","0.000012","2480.5"]`, ns(newestMs-int64(i)*hour))
		}
		body.WriteString("]}")
		return []byte(body.String())
	}}

	events, err := newTestAdapter(doer).FetchFundingHistory(context.Background(), "ETH-PERP", 0, newest)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	oldestFirstPage := ns(newest - 49*hour)
	want := []string{
		fmt.Sprintf("%s/funding-history?instrument_name=ETH-PERP&start_time=0&end_time=%d&limit=%d",
			APIBase, ns(newest)+nsPerMs-1, HistoryPageSize),
		fmt.Sprintf("%s/funding-history?instrument_name=ETH-PERP&start_time=0&end_time=%d&limit=%d",
			APIBase, oldestFirstPage-1, HistoryPageSize),
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", doer.urls, want)
	}
	for i, u := range want {
		eq(t, fmt.Sprintf("url[%d]", i), doer.urls[i], u)
	}

	if len(events) != 54 {
		t.Fatalf("events: got %d, want 54", len(events))
	}
	eq(t, "event[0].settledAt", events[0].SettledAt, newest-53*hour)
	for i := range events {
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, 1.0)
		eq(t, fmt.Sprintf("event[%d].quote", i), str(t, "quote", events[i].Quote), "USDC")
	}
}
