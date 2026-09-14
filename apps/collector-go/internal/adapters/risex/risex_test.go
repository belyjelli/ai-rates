package risex

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instant risex.test.ts uses (2026-09-13T22:26:40Z), so both suites pin identical output.
const NOW int64 = 1_789_338_400_000

// AFTER2300 is the read taken at 23:02, once the 23:00 settlement had landed.
const AFTER2300 int64 = 1_789_340_538_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "risex")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/risex above the working directory")
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

// The SAME files packages/adapters/src/venues/risex.test.ts reads.
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

func i64(tb testing.TB, label string, got *int64) int64 {
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
// constant expression instead, the same factors are folded at arbitrary precision and can land one
// ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func markets(tb testing.TB) MarketsResponse {
	tb.Helper()
	var body MarketsResponse
	load(tb, "markets", &body)
	return body
}

func history(tb testing.TB) FundingHistoryResponse {
	tb.Helper()
	var body FundingHistoryResponse
	load(tb, "funding-rate-history-1", &body)
	return body
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

func TestParseMarketsNormalizesBTCAsTheLastSettledHourlyRate(t *testing.T) {
	got := ParseMarkets(markets(t), NOW)

	btc := snapshotBySymbol(got.Snapshots, "BTC/USDC")
	if btc == nil {
		t.Fatal("BTC/USDC missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC/USDC")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.000004719244490803)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	// funding_interval is NANOSECONDS: 3,600,000,000,000 of them is one hour.
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", btc.NextFundingAt), 1_789_340_400_000)
	// The rate is the LAST SETTLED one, not an estimate for the coming hour.
	eq(t, "kind", btc.Kind, core.KindSettled)

	mark := f64(t, "markPrice", btc.MarkPrice)
	eq(t, "markPrice", mark, 76794.295168791114698431)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76788.95593436477)
	// open_interest is BASE UNITS, valued at mark: 145.39 BTC is about $11.2M, not $145.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(145.390106, mark))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 16693624.8241382)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 25)
}

func TestTheSameRateIsTheSettlementAtNextFundingMinusTheInterval(t *testing.T) {
	got := ParseMarkets(markets(t), NOW)

	btc := eventBySymbol(got.Settled, "BTC/USDC")
	if btc == nil {
		t.Fatal("BTC/USDC settlement missing")
	}
	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC/USDC")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "settledAt", btc.SettledAt, 1_789_336_800_000)
	eq(t, "rate", btc.Rate, 0.000004719244490803)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	if btc.MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *btc.MarkPrice)
	}

	// And it is exactly the newest record of funding-rate-history, whose end_time is 22:00.
	newest := history(t).Data.Records[0]
	if !newest.FundingRate.OK {
		t.Fatal("the newest record has no funding_rate")
	}
	eq(t, "newest record rate", newest.FundingRate.Val, 0.000004719244490803)
	eq(t, "newest record end_time", i64(t, "newest record end_time", NsToMs(newest.EndTime)), 1_789_336_800_000)
}

func TestFundingRate8hIsEightHourlyRates(t *testing.T) {
	body := markets(t)
	var btc Market
	for _, market := range body.Data.Markets {
		if market.MarketID == "1" {
			btc = market
		}
	}
	if btc.MarketID == "" {
		t.Fatal("market 1 missing")
	}

	// toBeCloseTo(x, 18) on the TypeScript side; a tolerance here because the two literals are
	// rounded per factor at runtime rather than folded at arbitrary precision.
	closeTo(t, "funding_rate_8h", btc.FundingRate8h.Val, btc.CurrentFundingRate.Val*8, 5e-19)

	snapshot := snapshotBySymbol(ParseMarkets(body, NOW).Snapshots, "BTC/USDC")
	if snapshot == nil {
		t.Fatal("BTC/USDC missing")
	}
	// So the hourly field is the one on a 1h basis: 4.1% APR, not the 33% a 1h basis on the 8h
	// figure would print.
	apr, err := core.APRFromRate(snapshot.Rate, core.UnitFraction, snapshot.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 4.134, 5e-4)
}

func TestParseMarketsTakesOnlyActiveUnlockedTradableMarkets(t *testing.T) {
	body := markets(t)
	got := ParseMarkets(body, NOW)

	// Skipped: ONDO/USDC (inactive, post-only) and the deprecated DOGE duplicate.
	want := []string{"BTC/USDC", "ETH/USDC", "XAU/USDC", "CL/USDC", "SNDK/USDC", "QQQ/USDC"}
	if len(got.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d (%v), want %d", len(got.Snapshots), symbolsOf(got.Snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", got.Snapshots[i].VenueSymbol, symbol)
	}
	if len(got.Settled) != 6 {
		t.Errorf("settled: got %d, want 6", len(got.Settled))
	}

	btc := body.Data.Markets[0]
	if !IsTradable(btc) {
		t.Error("the BTC fixture row must be tradable")
	}

	reduceOnly := btc
	reduceOnly.ReduceOnly = true
	if IsTradable(reduceOnly) {
		t.Error("a reduce-only market must not be collected")
	}

	locked := btc
	locked.Config.Unlocked = new(bool) // explicit false
	if IsTradable(locked) {
		t.Error("a locked market must not be collected")
	}

	// Absent is not false: only an explicit `unlocked: false` disqualifies.
	undeclared := btc
	undeclared.Config.Unlocked = nil
	if !IsTradable(undeclared) {
		t.Error("an absent `unlocked` must pass, not read as locked")
	}
}

func symbolsOf(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for _, s := range snapshots {
		out = append(out, s.VenueSymbol)
	}
	return out
}

func TestParseMarketsClassFromCategoryAndQuoteFromTheDeclaration(t *testing.T) {
	snapshots := ParseMarkets(markets(t), NOW).Snapshots

	want := []struct {
		symbol string
		base   string
		class  core.AssetClass
	}{
		{"BTC/USDC", "BTC", core.ClassCrypto},
		{"ETH/USDC", "ETH", core.ClassCrypto},
		{"XAU/USDC", "XAU", core.ClassCommodity},
		{"CL/USDC", "CL", core.ClassCommodity},
		// stocks
		{"SNDK/USDC", "SNDK", core.ClassEquity},
		// index_etf is passed as index; core files the QQQ ETF as equity.
		{"QQQ/USDC", "QQQ", core.ClassEquity},
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", snapshots[i].Base, w.base)
		eq(t, w.symbol+" assetClass", snapshots[i].AssetClass, w.class)
		eq(t, w.symbol+" quote", str(t, "quote", snapshots[i].Quote), "USDC")
	}
}

func TestAssetClassForReadsCategory(t *testing.T) {
	eq(t, `""/DOGE`, AssetClassFor("", "DOGE"), core.ClassCrypto)
	eq(t, "crypto/BTC", AssetClassFor("crypto", "BTC"), core.ClassCrypto)
	eq(t, "stocks/TSLA", AssetClassFor("stocks", "TSLA"), core.ClassEquity)
	eq(t, "index_etf/US500", AssetClassFor("index_etf", "US500"), core.ClassIndex)
	// An unknown value is tradfi of an unknown kind, placed by the base tables.
	eq(t, "forex/EURUSD", AssetClassFor("forex", "EURUSD"), core.ClassFX)
}

func TestNsToMsConvertsBeyond2Pow53Exactly(t *testing.T) {
	eq(t, "next_funding_time", i64(t, "next_funding_time", NsToMs("1789340400000000000")), 1_789_340_400_000)
	eq(t, "funding_interval", i64(t, "funding_interval", NsToMs("3600000000000")), 3_600_000)
	for _, absent := range []string{"", "0", "not a number"} {
		if got := NsToMs(absent); got != nil {
			t.Errorf("NsToMs(%q): got %v, want nil", absent, *got)
		}
	}
}

func TestParseFundingHistoryReturnsOldestFirstSettlementsAtEndTime(t *testing.T) {
	body := markets(t)
	events := ParseFundingHistory(history(t).Data.Records, body.Data.Markets[0], 0, math.MaxInt64)

	want := []struct {
		at   int64
		rate float64
	}{
		{1_789_322_400_000, 0.000009333805858142},
		{1_789_326_000_000, 0.000008659095028409},
		{1_789_329_600_000, 0.000008605035537197},
		{1_789_333_200_000, -0.000000339442964322},
		{1_789_336_800_000, 0.000004719244490803},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, 1.0)
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTC/USDC")
	eq(t, "base", events[0].Base, "BTC")
}

// fixtureDoer answers each URL from the callback, recording what was asked for. It is the Go seam
// for the fake HttpClient risex.test.ts builds.
type fixtureDoer struct {
	urls    []string
	respond func(url string) []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(d.respond(requested))),
		Request:    req,
	}, nil
}

// newTestAdapter wires an adapter to a doer. MaxRetries is negative for exactly one attempt per
// call, so the URL list is the walk's own.
func newTestAdapter(doer *fixtureDoer) *Adapter {
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsIsOneRequestPerCycle(t *testing.T) {
	body := fixtureBytes(t, "markets")
	doer := &fixtureDoer{respond: func(string) []byte { return body }}

	got, err := newTestAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(got.Snapshots) != 6 {
		t.Fatalf("snapshots: got %d, want 6", len(got.Snapshots))
	}
	if len(doer.urls) != 1 || doer.urls[0] != marketsURL {
		t.Errorf("requests: got %v, want exactly [%s]", doer.urls, marketsURL)
	}
}

func TestFetchFundingHistoryAddressesTheMarketByIDInNanoseconds(t *testing.T) {
	marketsBody := fixtureBytes(t, "markets")
	historyBody := fixtureBytes(t, "funding-rate-history-1")
	// Built as a raw string: adapters.Num has no MarshalJSON, so a wire struct holding one cannot
	// be round-tripped into a body.
	lastPage := []byte(`{"data":{"market_id":"1","records":[],"page":2,"has_next_page":false}}`)

	doer := &fixtureDoer{respond: func(url string) []byte {
		switch {
		case strings.HasSuffix(url, "/markets"):
			return marketsBody
		case strings.Contains(url, "page=1&"):
			return historyBody
		default:
			return lastPage
		}
	}}

	events, err := newTestAdapter(doer).FetchFundingHistory(
		context.Background(), "BTC/USDC", 1_789_326_000_000, 1_789_337_000_000)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	wantURLs := []string{
		marketsURL,
		APIBase + "/markets/id/1/funding-rate-history?start_time=1789326000000000000&end_time=1789337000001000000&page=1&limit=1000",
		APIBase + "/markets/id/1/funding-rate-history?start_time=1789326000000000000&end_time=1789337000001000000&page=2&limit=1000",
	}
	if len(doer.urls) != len(wantURLs) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(wantURLs))
	}
	for i, want := range wantURLs {
		eq(t, "request", doer.urls[i], want)
	}

	// The window drops the 21:00 settlement, whose end_time is below fromMs.
	wantAt := []int64{1_789_326_000_000, 1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000}
	if len(events) != len(wantAt) {
		t.Fatalf("events: got %d, want %d", len(events), len(wantAt))
	}
	for i, at := range wantAt {
		eq(t, "settledAt", events[i].SettledAt, at)
	}
}

func TestFetchFundingHistoryForAnUnknownMarketReturnsNothing(t *testing.T) {
	body := fixtureBytes(t, "markets")
	doer := &fixtureDoer{respond: func(string) []byte { return body }}

	events, err := newTestAdapter(doer).FetchFundingHistory(context.Background(), "NOPE/USDC", 0, 1)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("events: got %d, want none for a market this venue does not list", len(events))
	}
	// One markets call to look for it, and no history call at all.
	if len(doer.urls) != 1 || doer.urls[0] != marketsURL {
		t.Errorf("requests: got %v, want exactly [%s]", doer.urls, marketsURL)
	}
}

func TestAMarketsResponseWithNoPayloadFailsTheCycle(t *testing.T) {
	doer := &fixtureDoer{respond: func(string) []byte { return []byte(`{"data":{"markets":null}}`) }}
	_, err := newTestAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("a missing markets array must fail the cycle rather than read as an empty book")
	}
	eq(t, "error", err.Error(), ErrUnexpectedMarkets.Error())

	// An empty book, on the other hand, is a real answer and must not be an error.
	empty := &fixtureDoer{respond: func(string) []byte { return []byte(`{"data":{"markets":[]}}`) }}
	got, err := newTestAdapter(empty).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("an empty markets array must parse: %v", err)
	}
	if len(got.Snapshots) != 0 {
		t.Errorf("snapshots: got %d, want none", len(got.Snapshots))
	}
}

func TestAcrossThe2300Settlement(t *testing.T) {
	var after MarketsResponse
	load(t, "markets-after-2300", &after)
	var records21 FundingHistoryResponse
	load(t, "funding-rate-history-21-after-2300", &records21)

	got := ParseMarkets(after, AFTER2300)

	// Before the hour (the markets fixture, read at 22:26, and still at 22:59:33) SNDK read
	// 0.000290564882876973, which is the 22:00 record; after it, the 23:00 record.
	var before Market
	for _, market := range markets(t).Data.Markets {
		if market.MarketID == "21" {
			before = market
		}
	}
	if before.MarketID == "" {
		t.Fatal("market 21 missing from the 22:26 read")
	}
	eq(t, "the 22:26 rate is the 22:00 record",
		before.CurrentFundingRate.Val, records21.Data.Records[1].FundingRate.Val)

	sndk := snapshotBySymbol(got.Snapshots, "SNDK/USDC")
	if sndk == nil {
		t.Fatal("SNDK/USDC missing")
	}
	eq(t, "rate", sndk.Rate, -0.000195857364862654)
	eq(t, "kind", sndk.Kind, core.KindSettled)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", sndk.NextFundingAt), 1_789_344_000_000)

	// The snapshot's own settlement is exactly the newest history record, so current_funding_rate
	// is never an estimate.
	newest := ParseFundingHistory(
		records21.Data.Records[:1],
		Market{Config: MarketConfig{Name: "SNDK/USDC"}, Category: "stocks"},
		0, math.MaxInt64,
	)
	if len(newest) != 1 {
		t.Fatalf("newest: got %d events, want 1", len(newest))
	}
	settled := eventBySymbol(got.Settled, "SNDK/USDC")
	if settled == nil {
		t.Fatal("SNDK/USDC settlement missing")
	}
	if !reflect.DeepEqual(*settled, newest[0]) {
		t.Errorf("settlement: got %+v, want the newest history record %+v", *settled, newest[0])
	}
	eq(t, "settledAt", settled.SettledAt, 1_789_340_400_000)

	btc := snapshotBySymbol(got.Snapshots, "BTC/USDC")
	if btc == nil {
		t.Fatal("BTC/USDC missing")
	}
	eq(t, "btc rate", btc.Rate, 0.000018317170082382)
}

func TestMinIntervalMatchesTheTypeScriptSpacing(t *testing.T) {
	eq(t, "MinInterval", MinInterval, 100*time.Millisecond)
}
