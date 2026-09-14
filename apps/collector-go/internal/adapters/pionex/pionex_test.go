package pionex

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

// NOW is the `timestamp` of the indexes response the fixtures were trimmed from, which is the same
// instant pionex.test.ts uses -- so both suites pin identical output.
const NOW int64 = 1_789_336_871_681

const HOUR int64 = 3_600_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "pionex")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/pionex above the working directory")
	return ""
}

// fixtureBytes is one of the SAME files packages/adapters/src/venues/pionex.test.ts reads.
func fixtureBytes(tb testing.TB, name string) []byte {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	return raw
}

func load[T any](tb testing.TB, name string, into *Envelope[T]) T {
	tb.Helper()
	if err := json.Unmarshal(fixtureBytes(tb, name), into); err != nil {
		tb.Fatalf("decode %s: %v", name, err)
	}
	data, err := into.unwrap(name)
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

func i64(tb testing.TB, label string, got *int64) int64 {
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
// constant expression instead, `10.416 * 77102.8` is folded at arbitrary precision and can land one
// ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func hours(v float64) *float64 { return &v }

func symbolsFixture(tb testing.TB) []Symbol {
	tb.Helper()
	var env Envelope[SymbolList]
	return load(tb, "symbols", &env).Symbols
}

func indexesFixture(tb testing.TB) []Index {
	tb.Helper()
	var env Envelope[IndexList]
	return load(tb, "indexes", &env).Indexes
}

func tickersFixture(tb testing.TB) []Ticker {
	tb.Helper()
	var env Envelope[TickerList]
	return load(tb, "tickers", &env).Tickers
}

func openInterestsFixture(tb testing.TB) []OpenInterest {
	tb.Helper()
	var env Envelope[OpenInterestList]
	return load(tb, "openInterests", &env).OpenInterests
}

func bookTickersFixture(tb testing.TB) []BookTicker {
	tb.Helper()
	var env Envelope[BookTickerList]
	return load(tb, "bookTickers", &env).Tickers
}

func ratesFixture(tb testing.TB, symbol string) []FundingRate {
	tb.Helper()
	var env Envelope[FundingRateList]
	return load(tb, "fundingRates_"+symbol, &env).Rates
}

// intervalsFixture is every fixture symbol at a stand-in 8h, except the three whose interval the
// history fixtures show.
func intervalsFixture(tb testing.TB) map[string]IntervalEntry {
	tb.Helper()
	intervals := make(map[string]IntervalEntry)
	for _, symbol := range symbolsFixture(tb) {
		intervals[symbol.Symbol] = IntervalEntry{Hours: hours(8), FetchedAt: NOW}
	}
	for _, symbol := range []string{"BTC_USDT_PERP", "ACT_USDT_PERP", "AAX_USDT_PERP"} {
		measured := IntervalHours(ratesFixture(tb, symbol), nil)
		if measured == nil {
			tb.Fatalf("%s: no interval read from the fixture", symbol)
		}
		intervals[symbol] = IntervalEntry{Hours: measured, FetchedAt: NOW}
	}
	return intervals
}

func snapshotsWith(tb testing.TB, intervals map[string]IntervalEntry) []core.FundingSnapshot {
	tb.Helper()
	return ParseSnapshots(SnapshotInput{
		Symbols:       TradablePerps(symbolsFixture(tb)),
		Indexes:       indexesFixture(tb),
		Tickers:       tickersFixture(tb),
		OpenInterests: openInterestsFixture(tb),
		BookTickers:   bookTickersFixture(tb),
		Intervals:     intervals,
	}, NOW)
}

func find(tb testing.TB, snapshots []core.FundingSnapshot, symbol string) core.FundingSnapshot {
	tb.Helper()
	for _, snapshot := range snapshots {
		if snapshot.VenueSymbol == symbol {
			return snapshot
		}
	}
	tb.Fatalf("no snapshot for %s", symbol)
	return core.FundingSnapshot{}
}

func symbolsOf(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for _, snapshot := range snapshots {
		out = append(out, snapshot.VenueSymbol)
	}
	return out
}

func TestParseSnapshotsNormalizesBTC(t *testing.T) {
	btc := find(t, snapshotsWith(t, intervalsFixture(t)), "BTC_USDT_PERP")

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC_USDT_PERP")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.0000807965)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", btc.NextFundingAt), int64(1_789_344_000_000))
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77096.44639)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77137.4575)

	// Book sizes are BASE units, so the depth is size x price with no contract conversion anywhere.
	eq(t, "bestBid", f64(t, "bestBid", btc.BestBid), 77102.8)
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", btc.BestBidSizeUSD), product(10.416, 77102.8))
	eq(t, "bestAsk", f64(t, "bestAsk", btc.BestAsk), 77102.9)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", btc.BestAskSizeUSD), product(10.6274, 77102.9))
	// Open interest is base units: 1,335 BTC is $102.9M. Read as dollars it would be $1,335.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(1335.1442, 77096.44639))
	// "1989264906.36774611" as served; a double holds it to 1989264906.367746.
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 1989264906.36774611)

	// 0.0000807965 per 8h is 8.85% simple APR.
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("aprFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 8.8472, 0.0005)
}

func TestParseSnapshotsDollarQuotesOnlyAndOnlyOnceTheIntervalIsKnown(t *testing.T) {
	known := intervalsFixture(t)

	want := []string{
		"BTC_USDT_PERP",
		"ETH_USDT_PERP",
		"0G_USDT_PERP",
		"ACT_USDT_PERP",
		"AAX_USDT_PERP",
		"AAPLX_USDT_PERP",
		"XAU_USDT_PERP",
		// BTC_ETH_PERP prices bitcoin in ether: its open interest is not dollars.
	}
	if got := strings.Join(symbolsOf(snapshotsWith(t, known)), ","); got != strings.Join(want, ",") {
		t.Errorf("symbols: got %v, want %v", got, want)
	}

	// No entry at all and an entry whose interval was never learnt both withhold the market.
	delete(known, "ETH_USDT_PERP")
	known["XAU_USDT_PERP"] = IntervalEntry{Hours: nil, FetchedAt: NOW}
	for _, symbol := range symbolsOf(snapshotsWith(t, known)) {
		if symbol == "ETH_USDT_PERP" || symbol == "XAU_USDT_PERP" {
			t.Errorf("%s: emitted without a known interval", symbol)
		}
	}
}

func TestParseSnapshotsRatesArePerPerpsOwnInterval(t *testing.T) {
	all := snapshotsWith(t, intervalsFixture(t))

	act := find(t, all, "ACT_USDT_PERP")
	eq(t, "ACT rate", act.Rate, 0.00005)
	eq(t, "ACT basisHours", act.BasisHours, 4.0)
	eq(t, "ACT nextFundingAt", i64(t, "ACT nextFundingAt", act.NextFundingAt), int64(1_789_344_000_000))
	eq(t, "ACT openInterestUsd", f64(t, "ACT openInterestUsd", act.OpenInterestUSD), product(377367, 0.009585))

	aax := find(t, all, "AAX_USDT_PERP")
	eq(t, "AAX rate", aax.Rate, 0.0)
	eq(t, "AAX basisHours", aax.BasisHours, 1.0)
	eq(t, "AAX nextFundingAt", i64(t, "AAX nextFundingAt", aax.NextFundingAt), int64(1_789_340_400_000))
	// An empty bidPrice is absent, never zero, and a depth with no price behind it is absent too.
	if aax.BestBid != nil {
		t.Errorf("AAX bestBid: got %v, want nil", *aax.BestBid)
	}
	if aax.BestBidSizeUSD != nil {
		t.Errorf("AAX bestBidSizeUsd: got %v, want nil", *aax.BestBidSizeUSD)
	}
}

func TestParseSnapshotsDeclaresNoClassSoEverythingIsCrypto(t *testing.T) {
	all := snapshotsWith(t, intervalsFixture(t))
	for _, snapshot := range all {
		eq(t, snapshot.VenueSymbol+" assetClass", snapshot.AssetClass, core.ClassCrypto)
	}

	// baseCurrency is ZEROG, Pionex's internal code; every other venue lists 0G, and the symbol's own
	// base is what pairs with them.
	zero := find(t, all, "0G_USDT_PERP")
	eq(t, "0G base", zero.Base, "0G")
	eq(t, "0G quote", str(t, "0G quote", zero.Quote), "USDT")
	eq(t, "AAPLX base", find(t, all, "AAPLX_USDT_PERP").Base, "AAPLX")
}

func TestIntervalHoursReadsTheSpacingOfRecentSettlements(t *testing.T) {
	eq(t, "BTC", f64(t, "BTC", IntervalHours(ratesFixture(t, "BTC_USDT_PERP"), nil)), 8.0)
	eq(t, "ACT", f64(t, "ACT", IntervalHours(ratesFixture(t, "ACT_USDT_PERP"), nil)), 4.0)
	eq(t, "AAX", f64(t, "AAX", IntervalHours(ratesFixture(t, "AAX_USDT_PERP"), nil)), 1.0)
}

func TestIntervalHoursMeasuresALoneSettlementAgainstTheNext(t *testing.T) {
	latest := ratesFixture(t, "BTC_USDT_PERP")[:1]
	next := int64(1_789_344_000_000)

	eq(t, "against the next settlement", f64(t, "lone", IntervalHours(latest, &next)), 8.0)
	if got := IntervalHours(latest, nil); got != nil {
		t.Errorf("lone with no next funding time: got %v, want nil", *got)
	}
	if got := IntervalHours(nil, &next); got != nil {
		t.Errorf("no settlements: got %v, want nil", *got)
	}
}

func TestParseFundingHistoryOldestFirstWithBasisFromNeighbours(t *testing.T) {
	quote := "USDT"
	events := ParseFundingHistory("BTC_USDT_PERP", ratesFixture(t, "BTC_USDT_PERP"), 0, NOW, nil, &quote)

	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
	}{
		{1_789_228_800_000, 0.0000540647, 8},
		{1_789_257_600_000, 0.0000630832, 8},
		{1_789_286_400_000, 0.0000536681, 8},
		{1_789_315_200_000, 0.0000675156, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, expected := range want {
		eq(t, "settledAt", events[i].SettledAt, expected.settledAt)
		eq(t, "rate", events[i].Rate, expected.rate)
		eq(t, "basisHours", events[i].BasisHours, expected.basisHours)
	}

	// One settlement inside the window, with its basis read from the neighbours just outside it.
	lone := ParseFundingHistory(
		"AAX_USDT_PERP", ratesFixture(t, "AAX_USDT_PERP"), 1_789_336_800_000, NOW, nil, nil)
	if len(lone) != 1 {
		t.Fatalf("lone events: got %d, want 1", len(lone))
	}
	eq(t, "lone venueId", lone[0].VenueID, VenueID)
	eq(t, "lone venueSymbol", lone[0].VenueSymbol, "AAX_USDT_PERP")
	eq(t, "lone base", lone[0].Base, "AAX")
	eq(t, "lone quote", str(t, "lone quote", lone[0].Quote), "USDT")
	eq(t, "lone multiplier", lone[0].Multiplier, 1.0)
	eq(t, "lone assetClass", lone[0].AssetClass, core.ClassCrypto)
	if lone[0].Dex != nil {
		t.Errorf("lone dex: got %v, want nil", *lone[0].Dex)
	}
	eq(t, "lone settledAt", lone[0].SettledAt, int64(1_789_336_800_000))
	eq(t, "lone rate", lone[0].Rate, 0.0)
	eq(t, "lone basisHours", lone[0].BasisHours, 1.0)
	if lone[0].MarkPrice != nil {
		t.Errorf("lone markPrice: got %v, want nil", *lone[0].MarkPrice)
	}
}

// routeDoer answers each URL from a route function and records what was asked for, the Go seam for
// the fake HttpClient pionex.test.ts builds.
type routeDoer struct {
	urls  []string
	route func(string) []byte
}

func (d *routeDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(d.route(requested))),
		Request:    req,
	}, nil
}

func (d *routeDoer) matching(substring string) []string {
	var out []string
	for _, requested := range d.urls {
		if strings.Contains(requested, substring) {
			out = append(out, requested)
		}
	}
	return out
}

// bulkRoute serves the five bulk fixtures, and history for the three symbols that have a fixture.
// Everything else answers as a listing that has not settled yet.
func bulkRoute(tb testing.TB) func(string) []byte {
	tb.Helper()
	history := map[string][]byte{}
	for _, symbol := range []string{"BTC_USDT_PERP", "ACT_USDT_PERP", "AAX_USDT_PERP"} {
		history[symbol] = fixtureBytes(tb, "fundingRates_"+symbol)
	}
	bulk := map[string][]byte{
		"/common/symbols":       fixtureBytes(tb, "symbols"),
		"/market/indexes":       fixtureBytes(tb, "indexes"),
		"/market/tickers":       fixtureBytes(tb, "tickers"),
		"/market/openInterests": fixtureBytes(tb, "openInterests"),
		"/market/bookTickers":   fixtureBytes(tb, "bookTickers"),
	}

	return func(requested string) []byte {
		parsed, err := url.Parse(requested)
		if err != nil {
			tb.Fatalf("parse %s: %v", requested, err)
		}
		path := strings.TrimPrefix(parsed.Path, "/api/v1")
		if body, known := bulk[path]; known {
			return body
		}
		if path == "/market/fundingRates" {
			symbol := parsed.Query().Get("symbol")
			if body, known := history[symbol]; known {
				return body
			}
			return []byte(`{"result":true,"data":{"symbol":"` + symbol + `","rates":[]}}`)
		}
		tb.Fatalf("unexpected %s", requested)
		return nil
	}
}

// MaxRetries is negative for exactly one attempt per call, so the URL count is the cycle's own.
func newTestAdapter(doer *routeDoer, budget *int) *Adapter {
	return NewAdapterWithOptions(
		httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}),
		Options{IntervalRefreshBudget: budget},
	)
}

func TestAdapterFourBulkRequestsACycleSymbolsHourlyIntervalsBudgeted(t *testing.T) {
	ctx := context.Background()
	doer := &routeDoer{route: bulkRoute(t)}
	adapter := newTestAdapter(doer, nil)

	first, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("first cycle: %v", err)
	}

	wantBulk := []string{
		API + "/common/symbols?type=PERP",
		API + "/market/indexes",
		API + "/market/tickers?type=PERP",
		API + "/market/openInterests?type=PERP",
		API + "/market/bookTickers?type=PERP",
	}
	if len(doer.urls) < len(wantBulk) {
		t.Fatalf("requests: got %d (%v), want at least %d", len(doer.urls), doer.urls, len(wantBulk))
	}
	for i, want := range wantBulk {
		eq(t, "bulk request", doer.urls[i], want)
	}

	// Every tradable symbol lacks an interval, and BTC_ETH_PERP is never asked about.
	var wantHistory []string
	for _, symbol := range []string{
		"BTC_USDT_PERP", "ETH_USDT_PERP", "0G_USDT_PERP", "ACT_USDT_PERP",
		"AAX_USDT_PERP", "AAPLX_USDT_PERP", "XAU_USDT_PERP",
	} {
		wantHistory = append(wantHistory, API+"/market/fundingRates?symbol="+symbol+"&limit=4")
	}
	if got := strings.Join(doer.urls[len(wantBulk):], "\n"); got != strings.Join(wantHistory, "\n") {
		t.Errorf("interval requests:\ngot\n%v\nwant\n%v", got, strings.Join(wantHistory, "\n"))
	}

	// Only the three with a settlement history are emitted, each at its own measured interval.
	wantSnapshots := []struct {
		symbol     string
		basisHours float64
	}{
		{"BTC_USDT_PERP", 8},
		{"ACT_USDT_PERP", 4},
		{"AAX_USDT_PERP", 1},
	}
	if len(first.Snapshots) != len(wantSnapshots) {
		t.Fatalf("snapshots: got %v, want %d", symbolsOf(first.Snapshots), len(wantSnapshots))
	}
	for i, want := range wantSnapshots {
		eq(t, "snapshot symbol", first.Snapshots[i].VenueSymbol, want.symbol)
		eq(t, want.symbol+" basisHours", first.Snapshots[i].BasisHours, want.basisHours)
	}

	// Known intervals are not re-read within six hours, and the symbol list not within the hour.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+60_000)); err != nil {
		t.Fatalf("second cycle: %v", err)
	}
	eq(t, "second cycle requests", len(doer.urls), 4)

	// The four that had not settled yet are back-dated, so they are retried after 30 minutes rather
	// than after the full six hours.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+31*60_000)); err != nil {
		t.Fatalf("third cycle: %v", err)
	}
	eq(t, "third cycle interval requests", len(doer.matching("fundingRates")), 4)
	eq(t, "third cycle symbol requests", len(doer.matching("common/symbols")), 0)
}

func TestAdapterWarmUpShowsStoredMarketsBeforeTheirIntervalIsReRead(t *testing.T) {
	doer := &routeDoer{route: bulkRoute(t)}
	budget := 1
	adapter := newTestAdapter(doer, &budget)

	adapter.WarmUp([]KnownMarket{
		{VenueSymbol: "ETH_USDT_PERP", IntervalHours: hours(8)},
		// Never learnt, so nothing to warm: it stays absent rather than being emitted at a guess.
		{VenueSymbol: "XAU_USDT_PERP", IntervalHours: nil},
	})

	batch, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("cycle: %v", err)
	}

	// The budget of one is spent on the first symbol with no interval at all, not on the warmed one.
	wantHistory := []string{API + "/market/fundingRates?symbol=BTC_USDT_PERP&limit=4"}
	if got := doer.matching("fundingRates"); strings.Join(got, ",") != strings.Join(wantHistory, ",") {
		t.Errorf("interval requests: got %v, want %v", got, wantHistory)
	}
	if got := strings.Join(symbolsOf(batch.Snapshots), ","); got != "BTC_USDT_PERP,ETH_USDT_PERP" {
		t.Errorf("symbols: got %v, want BTC_USDT_PERP,ETH_USDT_PERP", got)
	}
	// The warmed interval is used, not a guess.
	eq(t, "ETH basisHours", find(t, batch.Snapshots, "ETH_USDT_PERP").BasisHours, 8.0)
}

func TestAdapterFundingHistoryPagesBackwardsByEndTime(t *testing.T) {
	const T int64 = 1_789_315_200_000

	// A first page at the cap and a short second one, both newest first, as Pionex serves them.
	doer := &routeDoer{route: func(requested string) []byte {
		parsed, err := url.Parse(requested)
		if err != nil {
			t.Fatalf("parse %s: %v", requested, err)
		}
		endTime, err := strconv.ParseInt(parsed.Query().Get("endTime"), 10, 64)
		if err != nil {
			t.Fatalf("endTime in %s: %v", requested, err)
		}
		count, newest := 3, endTime+1-8*HOUR
		if endTime >= T {
			count, newest = 100, T
		}
		rows := make([]string, 0, count)
		for i := 0; i < count; i++ {
			rows = append(rows, fmt.Sprintf(`{"fundingRate":"0.0001","fundingTime":%d}`,
				newest-int64(i)*8*HOUR))
		}
		return []byte(`{"result":true,"data":{"rates":[` + strings.Join(rows, ",") + `]}}`)
	}}

	events, err := newTestAdapter(doer, nil).FetchFundingHistory(context.Background(), "BTC_USDT_PERP", 0, T)
	if err != nil {
		t.Fatalf("history: %v", err)
	}

	oldestOfFirstPage := T - 99*8*HOUR
	want := []string{
		fmt.Sprintf("%s/market/fundingRates?symbol=BTC_USDT_PERP&endTime=%d&limit=100", API, T),
		fmt.Sprintf("%s/market/fundingRates?symbol=BTC_USDT_PERP&endTime=%d&limit=100", API, oldestOfFirstPage-1),
	}
	if got := strings.Join(doer.urls, "\n"); got != strings.Join(want, "\n") {
		t.Errorf("requests:\ngot\n%v\nwant\n%v", got, strings.Join(want, "\n"))
	}

	if len(events) != 103 {
		t.Fatalf("events: got %d, want 103", len(events))
	}
	for i := 1; i < len(events); i++ {
		if events[i-1].SettledAt >= events[i].SettledAt {
			t.Fatalf("events are not oldest first at %d: %d then %d",
				i, events[i-1].SettledAt, events[i].SettledAt)
		}
	}
	for _, event := range events {
		eq(t, "basisHours", event.BasisHours, 8.0)
	}
}
