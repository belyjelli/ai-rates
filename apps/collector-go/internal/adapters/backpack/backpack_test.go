package backpack

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

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NOW is the same instant backpack.test.ts uses: 2026-09-13T22:26:41Z, the openInterest timestamp.
const NOW int64 = 1_789_338_401_070

// historyReadAt is when the funding fixture was read: 22:38:55, while the 23:00 interval was still
// accruing.
const historyReadAt int64 = 1_789_339_135_000

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files
// packages/adapters/src/venues/backpack.test.ts reads: the port is verified against the exact bytes
// the original parser is pinned to, which is what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "backpack")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/backpack above the working directory")
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

// closeTo is bun:test's toBeCloseTo: equal to within half a unit in the given decimal place.
func closeTo(t *testing.T, label string, got, want float64, decimals int) {
	t.Helper()
	if math.Abs(got-want) >= 0.5*math.Pow(10, -float64(decimals)) {
		t.Errorf("%s: got %v, want %v to %d decimals", label, got, want, decimals)
	}
}

// bulk loads the four fixtures every snapshot test needs, in the shapes the endpoints return.
func bulk(tb testing.TB) ([]Market, []MarkPrice, []OpenInterest, []Ticker) {
	tb.Helper()
	var markets []Market
	var markPrices []MarkPrice
	var openInterest []OpenInterest
	var tickers []Ticker
	loadFixture(tb, "markets", &markets)
	loadFixture(tb, "markPrices", &markPrices)
	loadFixture(tb, "openInterest", &openInterest)
	loadFixture(tb, "tickers", &tickers)
	return markets, markPrices, openInterest, tickers
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func TestParseSnapshotsNormalizesBTCAsAPredictedHourlyRate(t *testing.T) {
	markets, markPrices, openInterest, tickers := bulk(t)
	snapshots := ParseSnapshots(markets, markPrices, openInterest, tickers, NOW)

	got := snapshotBySymbol(snapshots, "BTC_USDC_PERP")
	if got == nil {
		t.Fatal("BTC_USDC_PERP missing from snapshots")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDC")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	eq(t, "rate", got.Rate, 0.0000007945965277712049003927)
	// The rate accruing for the current hour, so the basis is one hour and not eight.
	eq(t, "basisHours", got.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 1.0)
	if got.NextFundingAt == nil || *got.NextFundingAt != 1_789_340_400_000 {
		t.Errorf("nextFundingAt: got %v, want 1789340400000", got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 76746.5)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 76785.99441873)
	// openInterest is base units, valued at mark. Computed from runtime variables in Mul's own order
	// rather than from a folded literal product: the compiler folds constants at arbitrary precision
	// while Mul rounds once per factor, and the two differ in the last ulp.
	oi, mark := 412.67346, 76746.5
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), oi*mark)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 126024537.212937)
}

func TestETHsHourlyRateAnnualizesNearHyperliquidsTheSameMinute(t *testing.T) {
	markets, markPrices, openInterest, tickers := bulk(t)
	snapshots := ParseSnapshots(markets, markPrices, openInterest, tickers, NOW)

	eth := snapshotBySymbol(snapshots, "ETH_USDC_PERP")
	if eth == nil {
		t.Fatal("ETH_USDC_PERP missing from snapshots")
	}
	apr, err := core.APRFromRate(eth.Rate, core.UnitFraction, eth.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	// Hyperliquid read 10.95% the same minute; reading the rate as 8-hourly would give 1.32%.
	closeTo(t, "apr", apr, 10.57, 2)
}

func TestOnlyOpenPerpsAreCollected(t *testing.T) {
	markets, markPrices, openInterest, tickers := bulk(t)
	snapshots := ParseSnapshots(markets, markPrices, openInterest, tickers, NOW)

	// Skipped: AMZN.US (PostOnly), IP (Closed, absent from markPrices), SOL_USDC (spot), and the
	// FDVEXTD1B prediction row in openInterest, which has no market.
	want := []string{
		"QQQ.US_USDC_PERP",
		"PAXG_USDC_PERP",
		"ETH_USDC_PERP",
		"DRAM.US_USDC_PERP",
		"BTC_USDC_PERP",
		"MU.US_USDC_PERP",
		"kPEPE_USDC_PERP",
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("snapshot[%d]", i), snapshots[i].VenueSymbol, symbol)
	}

	eq(t, "postOnly is not tradable",
		IsTradable(Market{Symbol: "X", MarketType: "PERP", OrderBookState: "PostOnly"}), false)
}

func TestClassFromRwaMarketTypeBaseFromTheParser(t *testing.T) {
	markets, markPrices, openInterest, tickers := bulk(t)
	snapshots := ParseSnapshots(markets, markPrices, openInterest, tickers, NOW)

	want := []struct {
		symbol     string
		base       string
		multiplier float64
		class      core.AssetClass
	}{
		// INDEX is passed as index; QQQ.US is not in core's index table, so it lands on equity.
		{"QQQ.US_USDC_PERP", "QQQ.US", 1, core.ClassEquity},
		{"PAXG_USDC_PERP", "PAXG", 1, core.ClassCrypto},
		{"ETH_USDC_PERP", "ETH", 1, core.ClassCrypto},
		{"DRAM.US_USDC_PERP", "DRAM.US", 1, core.ClassEquity},
		{"BTC_USDC_PERP", "BTC", 1, core.ClassCrypto},
		// STOCK. The venue's .US suffix is kept, as declared.
		{"MU.US_USDC_PERP", "MU.US", 1, core.ClassEquity},
		{"kPEPE_USDC_PERP", "PEPE", 1000, core.ClassCrypto},
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), snapshots[i].VenueSymbol, w.symbol)
		eq(t, fmt.Sprintf("snapshot[%d].base", i), snapshots[i].Base, w.base)
		eq(t, fmt.Sprintf("snapshot[%d].multiplier", i), snapshots[i].Multiplier, w.multiplier)
		eq(t, fmt.Sprintf("snapshot[%d].assetClass", i), snapshots[i].AssetClass, w.class)
		eq(t, fmt.Sprintf("snapshot[%d].quote", i),
			str(t, "quote", snapshots[i].Quote), "USDC")
	}
}

func TestAssetClassForNullIsCryptoAndAnUnknownRWATypeFallsToTheBaseTables(t *testing.T) {
	declared := func(s string) *string { return &s }

	eq(t, "null/BTC", AssetClassFor(nil, "BTC"), core.ClassCrypto)
	eq(t, "STOCK/NVDA.US", AssetClassFor(declared("STOCK"), "NVDA.US"), core.ClassEquity)
	eq(t, "INDEX/SPY.US", AssetClassFor(declared("INDEX"), "SPY.US"), core.ClassIndex)
	eq(t, "COMMODITY/XAU", AssetClassFor(declared("COMMODITY"), "XAU"), core.ClassCommodity)
	eq(t, "SOMETHING/EURUSD", AssetClassFor(declared("SOMETHING"), "EURUSD"), core.ClassFX)
	// An empty declaration is no declaration: crypto, never read off the ticker.
	eq(t, "empty/XAU", AssetClassFor(declared("  "), "XAU"), core.ClassCrypto)
}

func TestZoneLessTimestampsAreUTC(t *testing.T) {
	naive := ParseTimestamp("2026-09-13T22:00:00")
	if naive == nil || *naive != 1_789_336_800_000 {
		t.Errorf("zone-less: got %v, want 1789336800000", naive)
	}
	zoned := ParseTimestamp("2026-09-13T22:00:00Z")
	if zoned == nil || *zoned != 1_789_336_800_000 {
		t.Errorf("zoned: got %v, want 1789336800000", zoned)
	}
	if empty := ParseTimestamp(""); empty != nil {
		t.Errorf("empty: got %v, want nil", *empty)
	}
}

func TestTheStillAccruingIntervalIsNotASettlement(t *testing.T) {
	var markets []Market
	var funding []FundingRate
	loadFixture(t, "markets", &markets)
	loadFixture(t, "fundingRates-BTC_USDC_PERP", &funding)

	var btc Market
	for _, m := range markets {
		if m.Symbol == "BTC_USDC_PERP" {
			btc = m
		}
	}

	events := ParseFundingRates(funding, btc, 0, math.MaxInt64, historyReadAt)

	// The 23:00 row (0.000001254) was read at 22:38 and is dropped.
	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
	}{
		{1_789_322_400_000, 0.00001213, 1},
		{1_789_326_000_000, 0.000007819, 1},
		{1_789_329_600_000, 0.000008029, 1},
		{1_789_333_200_000, 0.000009713, 1},
		{1_789_336_800_000, 0.000008311, 1},
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
	eq(t, "event[0].base", events[0].Base, "BTC")
	eq(t, "event[0].quote", str(t, "quote", events[0].Quote), "USDC")
	if events[0].MarkPrice != nil {
		t.Errorf("event[0].markPrice: got %v, want nil", *events[0].MarkPrice)
	}
}

// routingDoer answers every request from route, recording the URLs so the adapter's request pattern
// can be observed from outside it.
type routingDoer struct {
	urls  []string
	route func(url string) []byte
}

func (d *routingDoer) Do(req *http.Request) (*http.Response, error) {
	url := req.URL.String()
	d.urls = append(d.urls, url)
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader(d.route(url))),
	}, nil
}

func (d *routingDoer) wantURLs(t *testing.T, want ...string) {
	t.Helper()
	if len(d.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", d.urls, want)
	}
	for i, url := range want {
		eq(t, fmt.Sprintf("url[%d]", i), d.urls[i], url)
	}
}

// fixtureDoer answers each endpoint with the fixture the TypeScript test answers it with.
func fixtureDoer(tb testing.TB) *routingDoer {
	tb.Helper()
	markets := fixtureBytes(tb, "markets")
	markPrices := fixtureBytes(tb, "markPrices")
	openInterest := fixtureBytes(tb, "openInterest")
	tickers := fixtureBytes(tb, "tickers")
	funding := fixtureBytes(tb, "fundingRates-BTC_USDC_PERP")
	return &routingDoer{route: func(url string) []byte {
		switch {
		case strings.HasSuffix(url, "/markets"):
			return markets
		case strings.HasSuffix(url, "/markPrices"):
			return markPrices
		case strings.HasSuffix(url, "/openInterest"):
			return openInterest
		case strings.HasSuffix(url, "/tickers"):
			return tickers
		case strings.Contains(url, "/fundingRates?"):
			return funding
		}
		tb.Errorf("unexpected %s", url)
		return []byte("[]")
	}}
}

func TestAdapterFetchesMarketsOnceAnHourAndThreeBulkCallsEveryCycle(t *testing.T) {
	doer := fixtureDoer(t)
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer}))
	ctx := context.Background()

	batch, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+60_000)); err != nil {
		t.Fatalf("second cycle: %v", err)
	}

	doer.wantURLs(t,
		API+"/markets",
		API+"/markPrices",
		API+"/openInterest",
		API+"/tickers",
		API+"/markPrices",
		API+"/openInterest",
		API+"/tickers",
	)
	if len(batch.Snapshots) != 7 {
		t.Errorf("snapshots: got %d, want 7", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d events, want 0", len(batch.Settled))
	}
	eq(t, "venueId", adapter.VenueID(), "backpack")
	eq(t, "requestCount", adapter.RequestCount(), 7)
}

func TestHistoryIsOnePageForAShortWindowWithTheClassLearnedFromMarkets(t *testing.T) {
	doer := fixtureDoer(t)
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer}))

	events, err := adapter.FetchFundingHistory(
		context.Background(), "BTC_USDC_PERP", 1_789_329_000_000, 1_789_337_000_000,
	)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	doer.wantURLs(t,
		API+"/markets",
		API+"/fundingRates?symbol=BTC_USDC_PERP&limit=1000&offset=0",
	)

	want := []int64{1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, at := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, at)
	}
	eq(t, "event[0].assetClass", events[0].AssetClass, core.ClassCrypto)
}

func TestPagesByOffsetWhilePagesAreFullAndNewerThanTheWindow(t *testing.T) {
	const hour = int64(3_600_000)
	const top = int64(1_789_336_800_000)

	// Built as raw JSON rather than by marshalling FundingRate: adapters.Num has no MarshalJSON, so a
	// marshalled row would emit {"Val":...,"OK":true} and decode back as ABSENT. These rows travel
	// the same decode path the venue's own bytes do, hourly and newest first.
	page := func(newest int64, count int) []byte {
		rows := make([]string, 0, count)
		for i := 0; i < count; i++ {
			rows = append(rows, fmt.Sprintf(
				`{"symbol":"BTC_USDC_PERP","fundingRate":"0.00001","intervalEndTimestamp":"%s"}`,
				time.UnixMilli(newest-int64(i)*hour).UTC().Format("2006-01-02T15:04:05"),
			))
		}
		return []byte("[" + strings.Join(rows, ",") + "]")
	}

	markets := fixtureBytes(t, "markets")
	full := page(top, historyPageSize)
	tail := page(top-int64(historyPageSize)*hour, 5)
	calls := 0
	doer := &routingDoer{route: func(url string) []byte {
		if strings.HasSuffix(url, "/markets") {
			return markets
		}
		calls++
		if calls == 1 {
			return full
		}
		return tail
	}}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer}))

	events, err := adapter.FetchFundingHistory(
		context.Background(), "BTC_USDC_PERP", top-1002*hour, top,
	)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	if len(doer.urls) != 3 {
		t.Fatalf("urls: got %v, want 3", doer.urls)
	}
	eq(t, "url[2]", doer.urls[2], API+"/fundingRates?symbol=BTC_USDC_PERP&limit=1000&offset=1000")
	// 1000 from the full page plus the three of the short page that fall inside the window.
	if len(events) != 1003 {
		t.Errorf("events: got %d, want 1003", len(events))
	}
}
