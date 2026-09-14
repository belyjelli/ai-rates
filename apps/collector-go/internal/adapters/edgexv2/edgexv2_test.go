package edgexv2

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instants edgex.test.ts uses, so both suites pin identical output.
const (
	NOW          int64 = 1_789_339_200_000 // 2026-09-13T22:40:00Z, minutes after the fixtures were read
	FUNDING_TIME int64 = 1_789_329_600_000 // 20:00Z, the latest settlement
	NEXT_FUNDING int64 = 1_789_344_000_000 // 00:00Z, as the ticker's nextFundingTime says
)

// liveIDs is the live contract ids in the venue's own listing order, which is the order the funding
// call's comma-joined id list is built in.
const liveIDs = "30000001,30000002,30000005,30000010,30000046,30000169"

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "edgex-v2")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/edgex-v2 above the working directory")
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

// The SAME files packages/adapters/src/venues/edgex.test.ts reads.
func load[T any](tb testing.TB, name string, into *T) {
	tb.Helper()
	if err := json.Unmarshal(fixtureBytes(tb, name), into); err != nil {
		tb.Fatalf("decode %s: %v", name, err)
	}
}

// unwrapped decodes one fixture's envelope and unwraps it, as the TypeScript test reads `.data`.
func unwrapped[T any](tb testing.TB, name, what string) T {
	tb.Helper()
	var body Response[T]
	load(tb, name, &body)
	data, err := body.unwrap(what)
	if err != nil {
		tb.Fatalf("unwrap %s: %v", name, err)
	}
	return data
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
// constant expression instead, the same factors are folded at arbitrary precision and can land one
// ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func markets(tb testing.TB) Markets {
	tb.Helper()
	meta := unwrapped[MetaData](tb, "getMetaData", "getMetaData")
	labels := unwrapped[[]ContractLabel](tb, "contract-labels", "contract-labels")
	return IndexMarkets(meta, labels)
}

func rates(tb testing.TB) []FundingRate {
	tb.Helper()
	return unwrapped[[]FundingRate](tb, "getLatestFundingRate", "getLatestFundingRate")
}

func btcTicker(tb testing.TB) *Ticker {
	tb.Helper()
	rows := unwrapped[[]Ticker](tb, "getTicker-30000001", "getTicker")
	if len(rows) == 0 {
		tb.Fatal("getTicker-30000001 fixture carries no row")
	}
	return &rows[0]
}

func historyPage(tb testing.TB) FundingPage {
	tb.Helper()
	return unwrapped[FundingPage](tb, "getFundingRatePage-30000001", "getFundingRatePage")
}

func batch(tb testing.TB) core.SnapshotBatch {
	tb.Helper()
	tickers := map[string]TickerEntry{"30000001": {Ticker: btcTicker(tb), FetchedAt: NOW}}
	return ParseSnapshots(markets(tb), rates(tb), tickers, NOW)
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

func symbols(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for _, snapshot := range snapshots {
		out = append(out, snapshot.VenueSymbol)
	}
	sort.Strings(out)
	return out
}

func TestParseSnapshotsNormalizesBTCUSDC(t *testing.T) {
	btc := snapshotBySymbol(batch(t).Snapshots, "BTCUSDC")
	if btc == nil {
		t.Fatal("BTCUSDC missing")
	}

	// Parsed at runtime from the fixture's own digits: the mark has more precision than a float64
	// holds, so the product below must be built from the value the parser actually produced.
	mark, err := strconv.ParseFloat("76767.044808407373464849", 64)
	if err != nil {
		t.Fatalf("parse mark: %v", err)
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTCUSDC")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// The forecast, not the settlement beside it.
	eq(t, "rate", btc.Rate, -0.00005592)
	eq(t, "basisHours", btc.BasisHours, 4.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 4.0)
	// fundingTime + 240 minutes, which is the ticker's own nextFundingTime.
	if btc.NextFundingAt == nil || *btc.NextFundingAt != NEXT_FUNDING {
		t.Errorf("nextFundingAt: got %v, want %v", btc.NextFundingAt, NEXT_FUNDING)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), mark)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76799.6329068953)
	// `openInterest` is BASE UNITS, so the notional is size x mark -- 3,284.957 BTC is $252M, not
	// 3,284 dollars.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(3284.957, mark))
	// `value` is already the 24h quote volume; `size` beside it is the base volume.
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 210414016.4312)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 100)
}

func TestParseSnapshotsPublishesAPer4hRate(t *testing.T) {
	eth := snapshotBySymbol(batch(t).Snapshots, "ETHUSDC")
	if eth == nil {
		t.Fatal("ETHUSDC missing")
	}

	// 0.00005 over 4h is 0.0000125/h, the 10.95% floor Hyperliquid's ETH read the same minute. Read
	// as hourly it would be 43.8%.
	eq(t, "rate", eth.Rate, 0.00005)
	closeTo(t, "rate per hour", eth.Rate/eth.BasisHours, 0.0000125, 0.5e-12)
	apr, err := core.APRFromRate(eth.Rate, core.UnitFraction, eth.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 10.95, 0.005)
}

func TestParseSnapshotsEmitsTheSettlementAtFundingTime(t *testing.T) {
	btc := eventBySymbol(batch(t).Settled, "BTCUSDC")
	if btc == nil {
		t.Fatal("BTCUSDC settlement missing")
	}
	eq(t, "settledAt", btc.SettledAt, FUNDING_TIME)
	eq(t, "rate", btc.Rate, -0.00005067)
	eq(t, "basisHours", btc.BasisHours, 4.0)

	// The same figure the history's flagged settlement row carries, which is what settles the docs'
	// ambiguity about paying a rate one interval later.
	newest := historyPage(t).DataList[0]
	if !newest.IsSettlement {
		t.Error("newest history row: want isSettlement true")
	}
	eq(t, "history rate", newest.FundingRate.Val, -0.00005067)
	eq(t, "history fundingTime", int64(newest.FundingTime.Val), FUNDING_TIME)
}

func TestParseSnapshotsKeepsDisplayedTradeableContracts(t *testing.T) {
	got := batch(t)
	// ZROUSDC and EURUSDC are tradeable but hidden (enableDisplay false), so they are dropped.
	want := []string{"1000PEPEUSDC", "BTCUSDC", "ETHUSDC", "SPYUSDC", "XAUUSDC", "哈基米USDC"}
	have := symbols(got.Snapshots)
	if len(have) != len(want) {
		t.Fatalf("snapshots: got %d %v, want %d %v", len(have), have, len(want), want)
	}
	for i := range want {
		eq(t, "symbol", have[i], want[i])
	}
	if len(got.Settled) != 6 {
		t.Errorf("settled: got %d, want 6", len(got.Settled))
	}
}

func TestParseSnapshotsDropsATickerTooOldToTrust(t *testing.T) {
	old := map[string]TickerEntry{
		"30000001": {Ticker: btcTicker(t), FetchedAt: NOW - 46*60_000},
	}
	btc := snapshotBySymbol(ParseSnapshots(markets(t), rates(t), old, NOW).Snapshots, "BTCUSDC")
	if btc == nil {
		t.Fatal("BTCUSDC missing")
	}
	// Absent, never stale: a reading from 46 minutes ago is a different hour's book.
	if btc.OpenInterestUSD != nil {
		t.Errorf("openInterestUsd: got %v, want nil", *btc.OpenInterestUSD)
	}
	if btc.Volume24hUSD != nil {
		t.Errorf("volume24hUsd: got %v, want nil", *btc.Volume24hUSD)
	}
}

func TestParseSnapshotsCarriesTheDeclaredClassBaseAndQuote(t *testing.T) {
	type row struct {
		base       string
		multiplier float64
		class      core.AssetClass
		quote      string
	}
	want := map[string]row{
		"1000PEPEUSDC": {"PEPE", 1000, core.ClassCrypto, "USDC"},
		"BTCUSDC":      {"BTC", 1, core.ClassCrypto, "USDC"},
		"ETHUSDC":      {"ETH", 1, core.ClassCrypto, "USDC"},
		// isStock: an ETF, which core files as equity.
		"SPYUSDC": {"SPY", 1, core.ClassEquity, "USDC"},
		// No flag; the Commodities V2 tab is the declaration.
		"XAUUSDC": {"XAU", 1, core.ClassCommodity, "USDC"},
		// The parser would keep the CJK name; the declared base coin is HAJIMI.
		"哈基米USDC": {"HAJIMI", 1, core.ClassCrypto, "USDC"},
	}

	snapshots := batch(t).Snapshots
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for _, snapshot := range snapshots {
		expected, listed := want[snapshot.VenueSymbol]
		if !listed {
			t.Errorf("unexpected symbol %s", snapshot.VenueSymbol)
			continue
		}
		eq(t, snapshot.VenueSymbol+" base", snapshot.Base, expected.base)
		eq(t, snapshot.VenueSymbol+" multiplier", snapshot.Multiplier, expected.multiplier)
		eq(t, snapshot.VenueSymbol+" assetClass", snapshot.AssetClass, expected.class)
		eq(t, snapshot.VenueSymbol+" quote", str(t, "quote", snapshot.Quote), expected.quote)
	}
}

func TestLabelClassesReadsOnlyTheV2TradfiTabs(t *testing.T) {
	labels := unwrapped[[]ContractLabel](t, "contract-labels", "contract-labels")
	classes := LabelClasses(labels)

	want := map[string]core.AssetClass{
		"30000005": core.ClassCommodity, // XAUUSDC
		"30000006": core.ClassCommodity, // XAGUSDC
		"30000010": core.ClassEquity,    // SPYUSDC
		"30000011": core.ClassEquity,    // QQQUSDC
	}
	if len(classes) != len(want) {
		t.Fatalf("classes: got %d %v, want %d", len(classes), classes, len(want))
	}
	for id, class := range want {
		eq(t, id, classes[id], class)
	}
	// The AppTradFi tabs file JPM under Commodities; they are not this app's, and are ignored.
	if _, declared := classes["30000128"]; declared {
		t.Error("30000128 (JPMUSDC): AppTradFi's tab must not declare a class")
	}
}

func TestAssetClassForFlagsWinOverTabs(t *testing.T) {
	eq(t, "isFx", AssetClassFor(false, true, ""), core.ClassFX)
	eq(t, "isStock over a tab", AssetClassFor(true, false, core.ClassCommodity), core.ClassEquity)
	eq(t, "no flag, a tab", AssetClassFor(false, false, core.ClassCommodity), core.ClassCommodity)
	eq(t, "nothing declared", AssetClassFor(false, false, ""), core.ClassCrypto)
}

func TestParseFundingHistoryReturnsOldestFirst4hEvents(t *testing.T) {
	index := markets(t)
	btc, listed := index.Contract("30000001")
	if !listed {
		t.Fatal("fixture changed: 30000001 missing")
	}

	events := ParseFundingHistory(historyPage(t).DataList, btc, index, 0, NOW)
	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_300_800_000, -0.00005842, 4},
		{1_789_315_200_000, -0.0000522, 4},
		{FUNDING_TIME, -0.00005067, 4},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}

	newest := events[len(events)-1]
	eq(t, "base", newest.Base, "BTC")
	eq(t, "quote", str(t, "quote", newest.Quote), "USDC")
	eq(t, "assetClass", newest.AssetClass, core.ClassCrypto)
	// The mark recorded at settlement, not the current one.
	if mark := f64(t, "markPrice", newest.MarkPrice); mark <= 70_000 {
		t.Errorf("markPrice: got %v, want a mark above 70000", mark)
	}
}

func TestUnwrapRefusesAnErrorEnvelope(t *testing.T) {
	// Built as a raw string rather than by marshalling a struct: adapters.Num has no MarshalJSON, so
	// the wire shapes in this package cannot be round-tripped.
	decode := func(raw string) Response[[]Ticker] {
		var body Response[[]Ticker]
		if err := json.Unmarshal([]byte(raw), &body); err != nil {
			t.Fatalf("decode %s: %v", raw, err)
		}
		return body
	}

	_, err := decode(`{"code":"FAILED","msg":"boom","data":null}`).unwrap("getTicker")
	if err == nil {
		t.Fatal("an error envelope must not unwrap")
	}
	eq(t, "message", err.Error(), "edgex-v2: getTicker failed: FAILED boom")

	// An absent code reads as "no body", never as a zero that could pass for a success code.
	_, err = decode(`{"data":[]}`).unwrap("getTicker")
	if err == nil || !strings.Contains(err.Error(), "no body") {
		t.Errorf("absent code: got %v, want a \"no body\" failure", err)
	}

	// A success envelope carrying an empty list is an answer, not a failure.
	rows, err := decode(`{"code":"SUCCESS","data":[],"msg":null}`).unwrap("getTicker")
	if err != nil || len(rows) != 0 {
		t.Errorf("empty success: got %v rows, err %v", len(rows), err)
	}
}

// fixtureDoer answers each endpoint with its fixture, recording the URLs asked for. It is the Go
// seam for the fake HttpClient edgex.test.ts builds. The routes are a SLICE rather than a map, so
// the first match is the venue's own order rather than Go's map iteration order.
type fixtureDoer struct {
	urls   []string
	routes []route
	fail   func(url string) bool
}

type route struct {
	path string
	body []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	if d.fail != nil && d.fail(requested) {
		return nil, fmt.Errorf("HTTP 500")
	}

	var body []byte
	for _, r := range d.routes {
		if strings.Contains(requested, r.path) {
			body = r.body
			break
		}
	}
	if body == nil {
		return nil, fmt.Errorf("unexpected %s", requested)
	}
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

func (d *fixtureDoer) paths() []string {
	out := make([]string, 0, len(d.urls))
	for _, u := range d.urls {
		out = append(out, strings.TrimPrefix(u, APIBase))
	}
	return out
}

func newFixtureDoer(tb testing.TB) *fixtureDoer {
	tb.Helper()
	page2 := []byte(`{"code":"SUCCESS","data":{"dataList":[],"nextPageOffsetData":""}}`)
	return &fixtureDoer{routes: []route{
		// Most specific first: every other contract's ticker answers with an empty list, exactly as
		// the live endpoint does for a contract it has no row for.
		{"getTicker?contractId=30000001", fixtureBytes(tb, "getTicker-30000001")},
		{"/quote/getTicker", []byte(`{"code":"SUCCESS","data":[]}`)},
		{"/meta/getMetaData", fixtureBytes(tb, "getMetaData")},
		{"/contract-labels", fixtureBytes(tb, "contract-labels")},
		{"/funding/getLatestFundingRate", fixtureBytes(tb, "getLatestFundingRate")},
		{"offsetData=", page2},
		{"getFundingRatePage", fixtureBytes(tb, "getFundingRatePage-30000001")},
	}}
}

// oneAttempt is a client that makes exactly one request per call, so the URL count is the walk's own.
func oneAttempt(doer *fixtureDoer) *httpclient.Client {
	return httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1})
}

func eqPaths(tb testing.TB, got, want []string) {
	tb.Helper()
	if len(got) != len(want) {
		tb.Fatalf("requests: got %d %v, want %d %v", len(got), got, len(want), want)
	}
	for i := range want {
		eq(tb, "request path", got[i], want[i])
	}
}

func TestFetchSnapshotsMakesOneFundingCallAndCachesMetadataAndTickers(t *testing.T) {
	doer := newFixtureDoer(t)
	adapter := NewAdapter(oneAttempt(doer))

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	want := []string{
		"/meta/getMetaData",
		"/contract-labels",
		"/funding/getLatestFundingRate?contractId=" + liveIDs,
	}
	for _, id := range strings.Split(liveIDs, ",") {
		want = append(want, "/quote/getTicker?contractId="+id)
	}
	eqPaths(t, doer.paths(), want)

	if len(first.Snapshots) != 6 {
		t.Fatalf("snapshots: got %d, want 6", len(first.Snapshots))
	}
	btc := snapshotBySymbol(first.Snapshots, "BTCUSDC")
	if btc == nil {
		t.Fatal("BTCUSDC missing")
	}
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 210414016.4312)

	// A minute later: the metadata is inside its hour and every ticker inside its refresh window, so
	// the cycle costs one call.
	doer.urls = nil
	second, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000))
	if err != nil {
		t.Fatalf("second FetchSnapshots: %v", err)
	}
	eqPaths(t, doer.paths(), []string{"/funding/getLatestFundingRate?contractId=" + liveIDs})

	btc = snapshotBySymbol(second.Snapshots, "BTCUSDC")
	if btc == nil {
		t.Fatal("BTCUSDC missing on the second cycle")
	}
	if btc.OpenInterestUSD == nil {
		t.Error("openInterestUsd: the ticker fetched a minute ago still stands")
	}
}

func TestFetchSnapshotsSurvivesAFailingTicker(t *testing.T) {
	doer := newFixtureDoer(t)
	doer.fail = func(url string) bool { return strings.Contains(url, "/quote/getTicker") }

	got, err := NewAdapter(oneAttempt(doer)).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	// Open interest and volume are auxiliary: a failed ticker never costs the cycle its funding rates.
	if len(got.Snapshots) != 6 {
		t.Fatalf("snapshots: got %d, want 6", len(got.Snapshots))
	}
	for _, snapshot := range got.Snapshots {
		if snapshot.OpenInterestUSD != nil {
			t.Errorf("%s openInterestUsd: got %v, want nil", snapshot.VenueSymbol, *snapshot.OpenInterestUSD)
		}
	}
}

func TestFetchFundingHistoryResolvesTheContractIdAndPages(t *testing.T) {
	doer := newFixtureDoer(t)
	from := int64(1_789_200_000_000)

	events, err := NewAdapter(oneAttempt(doer)).FetchFundingHistory(
		context.Background(), "BTCUSDC", from, NOW)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	base := fmt.Sprintf(
		"/funding/getFundingRatePage?contractId=30000001&size=100&filterSettlementFundingRate=true"+
			"&filterBeginTimeInclusive=%d&filterEndTimeExclusive=%d", from, NOW+1)
	// The first two calls are the market index; the walk itself is the two pages.
	eqPaths(t, doer.paths()[2:], []string{base, base + "&offsetData=0880F48DD58934"})

	if len(events) != 3 {
		t.Fatalf("events: got %d, want 3", len(events))
	}
}

func TestFetchFundingHistoryForAnUnknownContractReturnsNothing(t *testing.T) {
	events, err := NewAdapter(oneAttempt(newFixtureDoer(t))).FetchFundingHistory(
		context.Background(), "NOPEUSDC", 0, 1)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("events: got %d, want none", len(events))
	}
}

func TestFetchSnapshotsRefusesUnexpectedMetadata(t *testing.T) {
	doer := newFixtureDoer(t)
	// A success envelope whose payload carries no contractList. edgeX throws here rather than
	// guessing, and a cycle that read no contracts must not pass for a venue that lists none.
	doer.routes[2].body = []byte(`{"code":"SUCCESS","data":{"coinList":[]},"msg":null}`)

	_, err := NewAdapter(oneAttempt(doer)).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("metadata with no contractList must fail the cycle")
	}
	if !strings.Contains(err.Error(), "unexpected metadata") {
		t.Errorf("error: got %v, want an unexpected-metadata failure", err)
	}
}
