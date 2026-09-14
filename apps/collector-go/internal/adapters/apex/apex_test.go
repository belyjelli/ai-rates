package apex

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NOW is around when the ticker fixtures were fetched, 2026-09-13 22:29 UTC. The same instant
// apex.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_338_543_000

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files packages/adapters/src/venues/apex.test.ts
// reads: the port is verified against the exact bytes the original parser is pinned to, which is
// what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "apex")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/apex above the working directory")
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
// constant expression instead, `1578.334 * 76737.49` is folded at arbitrary precision and can land
// one ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func symbolsBody(tb testing.TB) SymbolsResponse {
	tb.Helper()
	var body SymbolsResponse
	load(tb, "symbols", &body)
	if body.Data == nil || body.Data.ContractConfig == nil {
		tb.Fatal("symbols fixture has no contractConfig")
	}
	return body
}

func book(tb testing.TB) Book {
	tb.Helper()
	return TradableContracts(symbolsBody(tb).Data.ContractConfig)
}

func market(tb testing.TB, symbol string) Market {
	tb.Helper()
	m, listed := book(tb).Markets[symbol]
	if !listed {
		tb.Fatalf("%s is not in the tradable book", symbol)
	}
	return m
}

func tickerFixture(tb testing.TB, cross string) Ticker {
	tb.Helper()
	var body TickerResponse
	load(tb, "ticker_"+cross, &body)
	if len(body.Data) == 0 {
		tb.Fatalf("ticker_%s has no rows", cross)
	}
	return body.Data[0]
}

func TestParseTickerNormalizesBTCUSDT(t *testing.T) {
	btc := tickerFixture(t, "BTCUSDT")
	got := ParseTicker(market(t, "BTC-USDT"), &btc, NOW)
	if got == nil {
		t.Fatal("BTC-USDT: want a snapshot, got nil")
	}

	eq(t, "venueId", got.VenueID, "apex")
	eq(t, "venueSymbol", got.VenueSymbol, "BTC-USDT")
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	// ApeX is a DEX but declares no sub-dex id, so the field stays absent rather than empty.
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	// `fundingRate`, the running estimate; `predictedFundingRate` (0.0000125) is interest alone.
	eq(t, "rate", got.Rate, -0.00002065)
	eq(t, "basisHours", got.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 1.0)
	// Date.parse("2026-09-13T23:00:00Z").
	if got.NextFundingAt == nil || *got.NextFundingAt != 1_789_340_400_000 {
		t.Errorf("nextFundingAt: got %v, want 1789340400000", got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 76737.49)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 76776.58)
	// Base units: 1,578 BTC is $121M.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), product(1578.334, 76737.49))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 565416965.9734)
	eq(t, "maxLeverage", f64(t, "maxLeverage", got.MaxLeverage), 100)
}

func TestParseTickerReadsFundingRateNeverPredictedFundingRate(t *testing.T) {
	eth := tickerFixture(t, "ETHUSDT")
	// The interest component alone, identical on BTC, ETH and SPCX, and never what settles.
	eq(t, "predictedFundingRate", eth.PredictedFundingRate.Val, 0.0000125)

	got := ParseTicker(market(t, "ETH-USDT"), &eth, NOW)
	if got == nil {
		t.Fatal("ETH-USDT: want a snapshot, got nil")
	}
	eq(t, "rate", got.Rate, -0.0000148)
}

func TestParseTickerEmitsNothingWithoutARateAMarkOrTheTickerItAskedFor(t *testing.T) {
	btc := market(t, "BTC-USDT")
	base := tickerFixture(t, "BTCUSDT")

	noRate := base
	noRate.FundingRate = adapters.Num{} // `fundingRate: ""` on the wire
	if got := ParseTicker(btc, &noRate, NOW); got != nil {
		t.Errorf("no rate: got %+v, want nil", got)
	}

	noMark := base
	noMark.MarkPrice = adapters.Num{}
	if got := ParseTicker(btc, &noMark, NOW); got != nil {
		t.Errorf("no mark: got %+v, want nil", got)
	}

	otherSymbol := base
	otherSymbol.Symbol = "ETHUSDT"
	if got := ParseTicker(btc, &otherSymbol, NOW); got != nil {
		t.Errorf("another symbol's row: got %+v, want nil", got)
	}

	if got := ParseTicker(btc, nil, NOW); got != nil {
		t.Errorf("no ticker: got %+v, want nil", got)
	}
}

func TestTradableContractsLivePerpetualAndStockOnlyNeverPredictions(t *testing.T) {
	want := []string{
		"BTC-USDT",
		"ETH-USDT",
		"1000PEPE-USDT",
		"PAXG-USDT",
		// TON-USDT is delisted.
		"SPCX-USDT",
		"XAU-USDT",
		"SPY-USDT",
		"SOXL-USDT",
		// IWM-USDT is delisted; Donald_Trump_win_Presidential_Election_2028-USDT is a prediction
		// contract, live on ApeX but not a perpetual on an asset.
	}
	got := book(t).Order
	if len(got) != len(want) {
		t.Fatalf("symbols: got %v, want %v", got, want)
	}
	for i := range want {
		eq(t, fmt.Sprintf("symbol[%d]", i), got[i], want[i])
	}

	// All three flags are required: withdrawing any one delists the contract.
	body := symbolsBody(t)
	body.Data.ContractConfig.PerpetualContract[0].EnableOpenPosition = false
	if _, listed := TradableContracts(body.Data.ContractConfig).Markets["BTC-USDT"]; listed {
		t.Error("BTC-USDT is still listed with enableOpenPosition false")
	}
}

func TestClassComesFromTheListAndTheStockCategory(t *testing.T) {
	live := book(t)
	btc := tickerFixture(t, "BTCUSDT")

	want := []string{
		"BTC-USDT|BTC|1|crypto|USDT",
		"ETH-USDT|ETH|1|crypto|USDT",
		"1000PEPE-USDT|PEPE|1000|crypto|USDT",
		"PAXG-USDT|PAXG|1|crypto|USDT",
		"SPCX-USDT|SPCX|1|equity|USDT",
		"XAU-USDT|XAU|1|commodity|USDT",
		// Declared INDEX; SPY is an ETF, which core files as equity.
		"SPY-USDT|SPY|1|equity|USDT",
		// No category at all: ClassifyNonCrypto.
		"SOXL-USDT|SOXL|1|equity|USDT",
	}

	got := make([]string, 0, len(live.Order))
	for _, symbol := range live.Order {
		m := live.Markets[symbol]
		ticker := btc
		ticker.Symbol = m.Contract.CrossSymbolName
		snapshot := ParseTicker(m, &ticker, NOW)
		if snapshot == nil {
			t.Fatalf("%s: want a snapshot, got nil", symbol)
		}
		got = append(got, fmt.Sprintf("%s|%s|%g|%s|%s",
			snapshot.VenueSymbol, snapshot.Base, snapshot.Multiplier, snapshot.AssetClass,
			str(t, symbol+" quote", snapshot.Quote)))
	}
	if len(got) != len(want) {
		t.Fatalf("rows: got %v, want %v", got, want)
	}
	for i := range want {
		eq(t, fmt.Sprintf("row[%d]", i), got[i], want[i])
	}

	spcxTicker := tickerFixture(t, "SPCXUSDT")
	spcx := market(t, "SPCX-USDT")
	snapshot := ParseTicker(spcx, &spcxTicker, NOW)
	if snapshot == nil {
		t.Fatal("SPCX-USDT: want a snapshot, got nil")
	}
	eq(t, "SPCX assetClass", snapshot.AssetClass, core.ClassEquity)

	declaredIndex := spcx
	declaredIndex.Contract.Category = "INDEX"
	eq(t, "INDEX/US500", AssetClassFor(declaredIndex, "US500"), core.ClassIndex)

	unknownCategory := spcx
	unknownCategory.Contract.Category = "NEW"
	eq(t, "NEW/XAG", AssetClassFor(unknownCategory, "XAG"), core.ClassCommodity)
}

func TestParseFundingIsHourlyOldestFirstAndCarriesNoMark(t *testing.T) {
	var body HistoryResponse
	load(t, "history-funding_BTC-USDT", &body)

	events := ParseFunding(body.Data.HistoryFunds, market(t, "BTC-USDT"), 1_789_329_600_000, NOW)

	want := []struct {
		settledAt int64
		rate      float64
	}{
		{1_789_329_600_000, 0.00000991},
		{1_789_333_200_000, 0.00000779},
		{1_789_336_800_000, 0.00000748},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, w.settledAt)
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, w.rate)
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, 1.0)
		if events[i].MarkPrice != nil {
			t.Errorf("event[%d].markPrice: got %v, want nil — `price` is not documented as the mark",
				i, *events[i].MarkPrice)
		}
	}
	eq(t, "event[0].venueSymbol", events[0].VenueSymbol, "BTC-USDT")
	eq(t, "event[0].base", events[0].Base, "BTC")
	eq(t, "event[0].quote", str(t, "quote", events[0].Quote), "USDT")
}

// fixtureDoer answers each URL from a routing function, recording the URLs asked for. It is the Go
// seam for the fake HttpClient apex.test.ts builds: the point of these tests is which URLs a cycle
// asks for, in what order. A nil body answers HTTP 500, which is how a failing venue is staged.
type fixtureDoer struct {
	urls  []string
	route func(url string) []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)

	body := d.route(requested)
	if body == nil {
		return &http.Response{
			Status:     "500 Internal Server Error",
			StatusCode: http.StatusInternalServerError,
			Header:     http.Header{"Content-Type": []string{"text/plain"}},
			Body:       io.NopCloser(strings.NewReader("boom")),
			Request:    req,
		}, nil
	}
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

// oneAttempt makes exactly one request per call, so the URL count is the walk's own.
func oneAttempt(doer *fixtureDoer) *httpclient.Client {
	return httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1})
}

func queryParam(tb testing.TB, raw, key string) string {
	tb.Helper()
	parsed, err := url.Parse(raw)
	if err != nil {
		tb.Fatalf("parse %s: %v", raw, err)
	}
	return parsed.Query().Get(key)
}

// venueRoutes answers /symbols with the fixture and each /ticker with its own, or with the empty
// array the venue returns for a symbol it does not know.
func venueRoutes(tb testing.TB) func(string) []byte {
	tb.Helper()
	symbols := fixtureBytes(tb, "symbols")
	tickers := map[string][]byte{
		"BTCUSDT":  fixtureBytes(tb, "ticker_BTCUSDT"),
		"ETHUSDT":  fixtureBytes(tb, "ticker_ETHUSDT"),
		"SPCXUSDT": fixtureBytes(tb, "ticker_SPCXUSDT"),
	}
	return func(requested string) []byte {
		if requested == API+"/symbols" {
			return symbols
		}
		if strings.HasPrefix(requested, API+"/ticker?") {
			if body, known := tickers[queryParam(tb, requested, "symbol")]; known {
				return body
			}
			return []byte(`{"data":[]}`)
		}
		tb.Fatalf("unexpected %s", requested)
		return nil
	}
}

func tickerURL(cross string) string { return API + "/ticker?symbol=" + cross }

func eqURLs(tb testing.TB, got, want []string) {
	tb.Helper()
	if len(got) != len(want) {
		tb.Fatalf("requests: got %d %v, want %d %v", len(got), got, len(want), want)
	}
	for i := range want {
		eq(tb, fmt.Sprintf("url[%d]", i), got[i], want[i])
	}
}

func symbolsOf(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for _, snapshot := range snapshots {
		out = append(out, snapshot.VenueSymbol)
	}
	return out
}

func TestFetchSnapshotsSymbolsHourlyAndARotatingSliceOfTickers(t *testing.T) {
	doer := &fixtureDoer{route: venueRoutes(t)}
	budget := 3
	adapter := NewAdapterWithOptions(oneAttempt(doer), Options{TickerBudget: &budget})
	eq(t, "venueId", adapter.VenueID(), "apex")

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	eqURLs(t, doer.urls, []string{
		API + "/symbols",
		tickerURL("BTCUSDT"),
		tickerURL("ETHUSDT"),
		tickerURL("1000PEPEUSDT"),
	})
	// Only what this cycle read is emitted; 1000PEPE has no ticker fixture, so it answers empty.
	eqURLs(t, symbolsOf(first.Snapshots), []string{"BTC-USDT", "ETH-USDT"})

	doer.urls = nil
	second, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000))
	if err != nil {
		t.Fatalf("FetchSnapshots (second): %v", err)
	}
	eqURLs(t, doer.urls, []string{
		tickerURL("PAXGUSDT"),
		tickerURL("SPCXUSDT"),
		tickerURL("XAUUSDT"),
	})
	eqURLs(t, symbolsOf(second.Snapshots), []string{"SPCX-USDT"})
	eq(t, "observedAt", second.Snapshots[0].ObservedAt, NOW+60_000)

	// Eight contracts at three a cycle: the third cycle finishes the sweep and wraps to BTC.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+120_000)); err != nil {
		t.Fatalf("FetchSnapshots (third): %v", err)
	}
	eqURLs(t, doer.urls, []string{
		tickerURL("SPYUSDT"),
		tickerURL("SOXLUSDT"),
		tickerURL("BTCUSDT"),
	})

	// An hour on, the symbol list is re-read before anything else.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60*60_000)); err != nil {
		t.Fatalf("FetchSnapshots (hourly): %v", err)
	}
	if len(doer.urls) == 0 || doer.urls[0] != API+"/symbols" {
		t.Fatalf("urls[0]: got %v, want %s", doer.urls, API+"/symbols")
	}
}

// syntheticSymbols is a /v3/symbols body with n live perpetuals. Built as raw JSON because
// adapters.Num has no MarshalJSON, so a Contract cannot be encoded back to the wire shape.
func syntheticSymbols(n int) []byte {
	var b strings.Builder
	b.WriteString(`{"data":{"contractConfig":{"perpetualContract":[`)
	for i := 0; i < n; i++ {
		if i > 0 {
			b.WriteString(",")
		}
		fmt.Fprintf(&b, `{"symbol":"C%d-USDT","crossSymbolName":"C%dUSDT","baseTokenId":"C%d",`+
			`"settleAssetId":"USDT","enableTrade":true,"enableDisplay":true,"enableOpenPosition":true}`,
			i, i, i)
	}
	b.WriteString(`]}}}`)
	return []byte(b.String())
}

func TestTheDefaultBudgetSweeps125ContractsInTwoCycles(t *testing.T) {
	symbols := syntheticSymbols(125)
	doer := &fixtureDoer{route: func(requested string) []byte {
		if strings.HasSuffix(requested, "/symbols") {
			return symbols
		}
		return []byte(`{"data":[]}`)
	}}
	adapter := NewAdapter(oneAttempt(doer))

	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000)); err != nil {
		t.Fatalf("FetchSnapshots (second): %v", err)
	}

	tickers := make([]string, 0, 128)
	for _, requested := range doer.urls {
		if strings.Contains(requested, "/ticker?") {
			tickers = append(tickers, requested)
		}
	}
	if len(tickers) != 2*TickerBudget {
		t.Fatalf("ticker requests: got %d, want %d", len(tickers), 2*TickerBudget)
	}
	// The first 125 cover every contract before any is read twice.
	unique := map[string]bool{}
	for _, requested := range tickers[:125] {
		unique[requested] = true
	}
	if len(unique) != 125 {
		t.Errorf("distinct symbols in the first 125 reads: got %d, want 125", len(unique))
	}
}

func TestACycleWhoseEveryTickerFailsIsAnErrorNotAnEmptyVenue(t *testing.T) {
	symbols := fixtureBytes(t, "symbols")
	doer := &fixtureDoer{route: func(requested string) []byte {
		if strings.HasSuffix(requested, "/symbols") {
			return symbols
		}
		return nil // HTTP 500
	}}
	// One failure opens the circuit, so the first ticker fails outright and the rest are refused
	// without a request -- which is what makes the open circuit the error worth reporting.
	client := httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1, FailureThreshold: 1})
	adapter := NewAdapter(client)

	_, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("want an error, got nil")
	}
	// The open circuit is reported in preference to the first ticker's own 500: it is the failure
	// that explains all the others.
	var open *httpclient.CircuitOpenError
	if !errors.As(err, &open) {
		t.Fatalf("want a CircuitOpenError, got %T: %v", err, err)
	}
}

func TestFetchFundingHistoryPagesBack100AtATimeByEndTimeExclusive(t *testing.T) {
	const hour int64 = 3_600_000
	const newestSettlement int64 = 1_789_336_800_000

	symbols := fixtureBytes(t, "symbols")
	doer := &fixtureDoer{}
	doer.route = func(requested string) []byte {
		if strings.HasSuffix(requested, "/symbols") {
			return symbols
		}
		end, err := strconv.ParseInt(queryParam(t, requested, "endTimeExclusive"), 10, 64)
		if err != nil {
			t.Fatalf("endTimeExclusive in %s: %v", requested, err)
		}
		newest := (end - 1) / hour * hour
		count := 3
		if newest == newestSettlement {
			count = historyPageSize
		}
		var b strings.Builder
		b.WriteString(`{"data":{"historyFunds":[`)
		for i := 0; i < count; i++ {
			if i > 0 {
				b.WriteString(",")
			}
			fmt.Fprintf(&b, `{"symbol":"BTC-USDT","rate":"0.0000125","price":"77000","fundingTime":%d}`,
				newest-int64(i)*hour)
		}
		b.WriteString(`]}}`)
		return []byte(b.String())
	}

	adapter := NewAdapter(oneAttempt(doer))
	events, err := adapter.FetchFundingHistory(context.Background(), "BTC-USDT", 0, newestSettlement)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	oldestFirstPage := newestSettlement - 99*hour
	eqURLs(t, doer.urls[1:], []string{
		fmt.Sprintf("%s/history-funding?symbol=BTC-USDT&limit=100&beginTimeInclusive=0&endTimeExclusive=%d",
			API, newestSettlement+1),
		fmt.Sprintf("%s/history-funding?symbol=BTC-USDT&limit=100&beginTimeInclusive=0&endTimeExclusive=%d",
			API, oldestFirstPage),
	})
	if len(events) != 103 {
		t.Fatalf("events: got %d, want 103", len(events))
	}
	for i, event := range events {
		eq(t, fmt.Sprintf("event[%d].basisHours", i), event.BasisHours, 1.0)
		if event.MarkPrice != nil {
			t.Errorf("event[%d].markPrice: got %v, want nil", i, *event.MarkPrice)
		}
	}

	// A contract ApeX does not list has no history to ask for.
	fresh := NewAdapter(oneAttempt(&fixtureDoer{route: doer.route}))
	unlisted, err := fresh.FetchFundingHistory(context.Background(), "NOPE-USDT", 0, newestSettlement)
	if err != nil {
		t.Fatalf("FetchFundingHistory (unlisted): %v", err)
	}
	if len(unlisted) != 0 {
		t.Errorf("unlisted contract: got %d events, want none", len(unlisted))
	}
}
