package bitmart

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

// Real rows captured 2026-09-13 ~22:00 UTC — the same instant bitmart.test.ts uses, so both suites
// pin identical output.
const NOW int64 = 1_789_336_847_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "bitmart")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/bitmart above the working directory")
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

// The SAME files packages/adapters/src/venues/bitmart.test.ts reads.
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

// product multiplies left to right at runtime, exactly as adapters.Mul does. Written as a Go
// constant expression instead, `2056722 * 0.001 * 77296.0726087` is folded at arbitrary precision
// and can land one ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func details(tb testing.TB) Envelope[Details] {
	tb.Helper()
	var env Envelope[Details]
	load(tb, "details", &env)
	return env
}

func history(tb testing.TB) []FundingHistoryItem {
	tb.Helper()
	var env Envelope[FundingHistory]
	load(tb, "funding-rate-history", &env)
	if env.Data == nil {
		tb.Fatal("funding-rate-history fixture has no data")
	}
	return env.Data.List
}

func snapshots(tb testing.TB) []core.FundingSnapshot {
	tb.Helper()
	batch, err := ParseSnapshots(details(tb), NOW)
	if err != nil {
		tb.Fatalf("ParseSnapshots: %v", err)
	}
	return batch.Snapshots
}

func snapshotBySymbol(tb testing.TB, all []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	tb.Helper()
	for i := range all {
		if all[i].VenueSymbol == symbol {
			return &all[i]
		}
	}
	tb.Fatalf("%s missing", symbol)
	return nil
}

func contractBySymbol(tb testing.TB, env Envelope[Details], symbol string) Contract {
	tb.Helper()
	for _, contract := range env.Data.Symbols {
		if contract.Symbol == symbol {
			return contract
		}
	}
	tb.Fatalf("%s missing from the fixture", symbol)
	return Contract{}
}

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	batch, err := ParseSnapshots(details(t), NOW)
	if err != nil {
		t.Fatalf("ParseSnapshots: %v", err)
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(batch.Settled))
	}

	btc := snapshotBySymbol(t, batch.Snapshots, "BTCUSDT")
	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTCUSDT")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// expected_funding_rate, not funding_rate ("0.0000778" on this row).
	eq(t, "rate", btc.Rate, 0.0000929)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_344_000_000 {
		t.Errorf("nextFundingAt: got %v, want 1789344000000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	// No mark price in the bulk response — nil, never 0. BitMart publishes none anywhere in bulk, so
	// this is the venue's routine state and migration 020 falls the identity gate back to the index.
	if btc.MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *btc.MarkPrice)
	}
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77296.0726087)
	// Contracts x 0.001 BTC x index: $159.0m, not open_interest_value's entry notional.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(2056722, 0.001, 77296.0726087))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 1544041296.4726)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 200)
}

func TestParseSnapshotsSkipsDelistedDeadTradingRowsAndInverseContracts(t *testing.T) {
	// Dropped: BTCUSD (coin-margined, USD-quoted), THETAUSDT (Trading, delist_time 2026-07-25,
	// empty book), CKBUSDT (Delisted).
	want := []string{
		"BTCUSDT",
		"ETHUSDT",
		"1000PEPEUSDT",
		"BTCUSDC",
		"ESPORTSUSDT",
		"XAUUSDT",
		"SPX500USDT",
		"OPENAIUSDT",
		"EURUSDT",
		"XCUUSDT",
		"JPN225USDT",
		"KIOXIAUSDT",
		"MEITUANUSDT",
	}
	got := snapshots(t)
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", got[i].VenueSymbol, symbol)
	}
}

func TestParseSnapshotsCarriesTheDeclaredClassAndSettlementCoin(t *testing.T) {
	want := map[string]string{
		"BTCUSDT":      "crypto:BTC:USDT",
		"ETHUSDT":      "crypto:ETH:USDT",
		"1000PEPEUSDT": "crypto:PEPE:USDT",
		"BTCUSDC":      "crypto:BTC:USDC",
		"ESPORTSUSDT":  "crypto:ESPORTS:USDT",
		// No tradfi_info on BitMart's gold, so it is crypto by the venue's own declaration.
		"XAUUSDT": "crypto:XAU:USDT",
		// US_MARKET, refined to index by the shared table.
		"SPX500USDT": "index:US500:USDT",
		"OPENAIUSDT": "equity:OPENAI:USDT",
		"EURUSDT":    "fx:EUR:USDT",
		"XCUUSDT":    "commodity:XCU:USDT",
		"JPN225USDT": "index:JPN225:USDT",
		// INDEX_JP on a single share, refined back to equity.
		"KIOXIAUSDT":  "equity:KIOXIA:USDT",
		"MEITUANUSDT": "equity:MEITUAN:USDT",
	}

	got := snapshots(t)
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got), len(want))
	}
	for i := range got {
		s := got[i]
		eq(t, s.VenueSymbol, string(s.AssetClass)+":"+s.Base+":"+str(t, "quote", s.Quote), want[s.VenueSymbol])
	}
}

func TestParseSnapshotsConvertsContractsThroughContractSizeAndReadsHourlyIntervals(t *testing.T) {
	all := snapshots(t)

	// One contract is one "1000PEPE" unit, priced per 1000PEPE, so no further scaling.
	pepe := snapshotBySymbol(t, all, "1000PEPEUSDT")
	eq(t, "1000PEPE multiplier", pepe.Multiplier, 1000.0)
	eq(t, "1000PEPE openInterestUsd", f64(t, "1000PEPE openInterestUsd", pepe.OpenInterestUSD),
		product(8941543290, 1, 0.0034103))
	eq(t, "1000PEPE volume24hUsd", f64(t, "1000PEPE volume24hUsd", pepe.Volume24hUSD), 13021377.393464)

	esports := snapshotBySymbol(t, all, "ESPORTSUSDT")
	eq(t, "ESPORTS rate", esports.Rate, 0.0001089)
	eq(t, "ESPORTS basisHours", esports.BasisHours, 1.0)
	eq(t, "ESPORTS intervalHours", f64(t, "ESPORTS intervalHours", esports.IntervalHours), 1.0)
	if esports.NextFundingAt == nil || *esports.NextFundingAt != 1_789_340_400_000 {
		t.Errorf("ESPORTS nextFundingAt: got %v, want 1789340400000", esports.NextFundingAt)
	}
}

func TestParseSnapshotsFailsOnAnErrorEnvelope(t *testing.T) {
	// Built as raw JSON rather than as a struct literal: adapters.Num has no MarshalJSON, so an
	// Envelope holding one cannot be round-tripped.
	var env Envelope[Details]
	if err := json.Unmarshal([]byte(`{"code":30000,"message":"Not found","data":null}`), &env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	_, err := ParseSnapshots(env, NOW)
	if err == nil {
		t.Fatal("want an error for an error envelope, got none")
	}
	if !strings.Contains(err.Error(), "30000") {
		t.Errorf("error %q does not carry the venue's code 30000", err)
	}
}

func TestIsTradableKeepsAScheduledDelistingUntilItArrives(t *testing.T) {
	theta := contractBySymbol(t, details(t), "THETAUSDT")
	eq(t, "delist_time in the past", IsTradable(theta, NOW), false)

	future := theta
	future.DelistTime = NOW/1000 + 3600
	eq(t, "delist_time in the future", IsTradable(future, NOW), true)

	dated := theta
	dated.DelistTime = 0
	dated.ProductType = 2
	eq(t, "product_type 2 is a dated future", IsTradable(dated, NOW), false)
}

func TestAssetClassForReadsMarketGroupAndAnUnknownGroupIsStillTradfi(t *testing.T) {
	eq(t, "nil/BTC", AssetClassFor(nil, "BTC"), core.ClassCrypto)
	// No tradfi_info at all, so gold is crypto by the venue's own declaration.
	eq(t, "nil/XAU", AssetClassFor(nil, "XAU"), core.ClassCrypto)
	eq(t, "HK_STOCK/TENCENT", AssetClassFor(&TradfiInfo{MarketGroup: "HK_STOCK"}, "TENCENT"), core.ClassEquity)
	eq(t, "INDEX_DE/GER40", AssetClassFor(&TradfiInfo{MarketGroup: "INDEX_DE"}, "GER40"), core.ClassIndex)
	eq(t, "COMMODITY_CME/XTI", AssetClassFor(&TradfiInfo{MarketGroup: "COMMODITY_CME"}, "XTI"), core.ClassCommodity)
	// A group this does not know is still tradfi, so the base tables settle which class.
	eq(t, "PRE_LIST/ANDURIL", AssetClassFor(&TradfiInfo{MarketGroup: "PRE_LIST"}, "ANDURIL"), core.ClassEquity)
	eq(t, "BONDS/US10Y", AssetClassFor(&TradfiInfo{MarketGroup: "BONDS"}, "US10Y"), core.ClassIndex)
	eq(t, "no group/XAG", AssetClassFor(&TradfiInfo{}, "XAG"), core.ClassCommodity)
}

func TestParseFundingHistoryReturnsEventsOldestFirstWithTheInferredInterval(t *testing.T) {
	ref := adapters.MarketRefFor(VenueID, "BTCUSDT", adapters.Overrides{})
	events := ParseFundingHistory(ref, history(t), 0, NOW, nil)

	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_257_600_000, 0.000057618, 8},
		{1_789_286_400_000, 0.000068508, 8},
		{1_789_315_200_000, 0.000077802419, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTCUSDT")
	eq(t, "base", events[0].Base, "BTC")
	if events[0].MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil — BitMart publishes none", *events[0].MarkPrice)
	}
}

func TestParseFundingHistoryWindowOlderThanThePageIsEmpty(t *testing.T) {
	ref := adapters.MarketRefFor(VenueID, "BTCUSDT", adapters.Overrides{})
	items := history(t)

	// The backfill reads an empty answer as the venue's limit rather than as a gap.
	if got := ParseFundingHistory(ref, items, 0, 1_789_200_000_000, nil); len(got) != 0 {
		t.Errorf("events: got %d, want none", len(got))
	}

	// A single settlement has no gap to infer from, so the caller's interval is the basis.
	fallback := 4.0
	single := ParseFundingHistory(ref, items[:1], 0, NOW, &fallback)
	if len(single) != 1 {
		t.Fatalf("events: got %d, want 1", len(single))
	}
	eq(t, "basisHours", single[0].BasisHours, 4.0)
}

func TestParseFundingHistoryDropsEventsWithNoBasisAtAll(t *testing.T) {
	// Nothing has ever reported an interval for the market and one settlement cannot imply one, so
	// the event is dropped rather than given an invented basis.
	ref := adapters.MarketRefFor(VenueID, "BTCUSDT", adapters.Overrides{})
	if got := ParseFundingHistory(ref, history(t)[:1], 0, NOW, nil); len(got) != 0 {
		t.Errorf("events: got %d, want none without a basis", len(got))
	}
}

// fixtureDoer answers /funding-rate-history with the history fixture and everything else with
// /details, recording the URLs asked for. It is the Go seam for the fake HttpClient bitmart.test.ts
// builds.
type fixtureDoer struct {
	urls    []string
	details []byte
	history []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	body := d.details
	if strings.Contains(requested, "/funding-rate-history") {
		body = d.history
	}
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

func TestAdapterMakesOneRequestACycleAndHistoryCarriesTheClassSeenInIt(t *testing.T) {
	doer := &fixtureDoer{
		details: fixtureBytes(t, "details"),
		history: fixtureBytes(t, "funding-rate-history"),
	}
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	eq(t, "venueId", adapter.VenueID(), "bitmart")

	batch, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(batch.Snapshots) != 13 {
		t.Fatalf("snapshots: got %d, want 13", len(batch.Snapshots))
	}
	wantURLs := []string{"https://api-cloud-v2.bitmart.com/contract/public/details"}
	if len(doer.urls) != len(wantURLs) || doer.urls[0] != wantURLs[0] {
		t.Fatalf("requests: got %v, want %v", doer.urls, wantURLs)
	}

	doer.urls = nil
	events, err := adapter.FetchFundingHistory(context.Background(), "SPX500USDT", 0, NOW)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	wantURLs = []string{
		"https://api-cloud-v2.bitmart.com/contract/public/funding-rate-history?symbol=SPX500USDT&limit=100",
	}
	if len(doer.urls) != len(wantURLs) || doer.urls[0] != wantURLs[0] {
		t.Fatalf("requests: got %v, want %v", doer.urls, wantURLs)
	}
	if len(events) == 0 {
		t.Fatal("events: got none")
	}
	// The class comes from the cycle that has already run, not from the history rows.
	eq(t, "venueSymbol", events[0].VenueSymbol, "SPX500USDT")
	eq(t, "assetClass", events[0].AssetClass, core.ClassIndex)
}
