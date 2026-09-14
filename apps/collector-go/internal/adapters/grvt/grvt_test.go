package grvt

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NOW is `event_time` of the BTC ticker fixture, 2026-09-13 22:29:03 UTC — the same instant
// grvt.test.ts uses, so the two suites pin identical output.
const NOW int64 = 1_789_338_543_560

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files packages/adapters/src/venues/grvt.test.ts
// reads: the port is verified against the exact bytes the original parser is pinned to, which is
// what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "grvt")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/grvt above the working directory")
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

func loadInstrumentRows(tb testing.TB) []Instrument {
	tb.Helper()
	var body instrumentsResponse
	if err := json.Unmarshal(fixtureBytes(tb, "all_instruments"), &body); err != nil {
		tb.Fatalf("decode all_instruments: %v", err)
	}
	if body.Result == nil {
		tb.Fatal("all_instruments: no result array")
	}
	return *body.Result
}

func livePerps(tb testing.TB) Perps {
	tb.Helper()
	return TradablePerps(loadInstrumentRows(tb))
}

func instrumentNamed(tb testing.TB, name string) Instrument {
	tb.Helper()
	instrument, listed := livePerps(tb).Get(name)
	if !listed {
		tb.Fatalf("%s is not a tradable perp in the fixture", name)
	}
	return instrument
}

func loadTicker(tb testing.TB, name string) *Ticker {
	tb.Helper()
	var body tickerResponse
	if err := json.Unmarshal(fixtureBytes(tb, "ticker_"+name), &body); err != nil {
		tb.Fatalf("decode ticker_%s: %v", name, err)
	}
	if body.Result == nil {
		tb.Fatalf("ticker_%s: no result", name)
	}
	return body.Result
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

func nilPtr(tb testing.TB, label string, got *float64) {
	tb.Helper()
	if got != nil {
		tb.Errorf("%s: got %v, want nil", label, *got)
	}
}

func closeTo(tb testing.TB, label string, got, want, tolerance float64) {
	tb.Helper()
	if diff := got - want; diff > tolerance || diff < -tolerance {
		tb.Errorf("%s: got %v, want %v (within %v)", label, got, want, tolerance)
	}
}

// pct converts at RUNTIME, exactly as Rate does. Written as a Go constant expression instead,
// `0.0031 / 100` is folded at arbitrary precision and can land one ulp away from what the parser
// computes.
func pct(percent float64) float64 { return percent / 100 }

// product multiplies left to right at runtime, exactly as adapters.Mul does; same reason as pct.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

// sum adds left to right from zero, exactly as ParseTicker accumulates taker buy and sell volume.
func sum(terms ...float64) float64 {
	out := 0.0
	for _, t := range terms {
		out += t
	}
	return out
}

// decodeNum builds a Num the way the wire does: adapters.Num has no MarshalJSON, so a synthetic
// value is written as raw JSON rather than round-tripped through a struct.
func decodeNum(tb testing.TB, raw string) adapters.Num {
	tb.Helper()
	var n adapters.Num
	if err := json.Unmarshal([]byte(raw), &n); err != nil {
		tb.Fatalf("decode %s: %v", raw, err)
	}
	return n
}

func TestParseTickerNormalizesBTC(t *testing.T) {
	btc := instrumentNamed(t, "BTC_USDT_Perp")
	got := ParseTicker(btc, loadTicker(t, "BTC_USDT_Perp"), NOW)
	if got == nil {
		t.Fatal("BTC_USDT_Perp: want a snapshot, got nil")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "venueSymbol", got.VenueSymbol, "BTC_USDT_Perp")
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	// "0.0031" percentage points per 8h: 0.000031 as a fraction.
	eq(t, "rate", got.Rate, pct(0.0031))
	eq(t, "basisHours", got.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 8.0)
	// Unix nanoseconds 1789344000000000000.
	if got.NextFundingAt == nil || *got.NextFundingAt != 1_789_344_000_000 {
		t.Errorf("nextFundingAt: got %v, want 1789344000000", got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 76747.199999999)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 76786.925652169)
	eq(t, "bestBid", f64(t, "bestBid", got.BestBid), 76737.6)
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", got.BestBidSizeUSD), product(3.311, 76737.6))
	eq(t, "bestAsk", f64(t, "bestAsk", got.BestAsk), 76737.7)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", got.BestAskSizeUSD), product(7.319, 76737.7))
	// Base units: 2,523 BTC is $194M.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), product(2523.388873277, 76747.199999999))
	// Taker buy plus taker sell, both in quote.
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), sum(49048179.0772, 49518153.3347))
	// GRVT's ticker carries no headline leverage, so this stays absent rather than reading as zero.
	nilPtr(t, "maxLeverage", got.MaxLeverage)
}

func TestParseTicker4hPerpRateIsOverItsOwnFourHours(t *testing.T) {
	ena := instrumentNamed(t, "ENA_USDT_Perp")
	got := ParseTicker(ena, loadTicker(t, "ENA_USDT_Perp"), NOW)
	if got == nil {
		t.Fatal("ENA_USDT_Perp: want a snapshot, got nil")
	}

	eq(t, "rate", got.Rate, pct(0.005))
	eq(t, "basisHours", got.BasisHours, 4.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 4.0)
	// The resting 0.005 on a 4h perp is the 0.01%-per-8h floor over four hours: 0.0000125 an hour.
	closeTo(t, "rate per hour", got.Rate/got.BasisHours, 0.0000125, 0.5e-12)
}

func TestParseTickerEmitsNothingWithoutARateMarkIntervalOrMatchingInstrument(t *testing.T) {
	btc := instrumentNamed(t, "BTC_USDT_Perp")
	base := loadTicker(t, "BTC_USDT_Perp")

	noRate := *base
	empty := adapters.Num{}
	noRate.FundingRate = &empty
	noRate.FundingRate8hCurr = &empty
	if got := ParseTicker(btc, &noRate, NOW); got != nil {
		t.Errorf("no rate: got %+v, want nil", got)
	}

	noMark := *base
	noMark.MarkPrice = adapters.Num{}
	if got := ParseTicker(btc, &noMark, NOW); got != nil {
		t.Errorf("no mark: got %+v, want nil", got)
	}

	otherInstrument := *base
	otherInstrument.Instrument = "ETH_USDT_Perp"
	if got := ParseTicker(btc, &otherInstrument, NOW); got != nil {
		t.Errorf("mismatched instrument: got %+v, want nil", got)
	}

	noInterval := btc
	noInterval.FundingIntervalHours = decodeNum(t, "0")
	if got := ParseTicker(noInterval, base, NOW); got != nil {
		t.Errorf("zero interval: got %+v, want nil", got)
	}

	if got := ParseTicker(btc, nil, NOW); got != nil {
		t.Errorf("no ticker: got %+v, want nil", got)
	}

	closeTo(t, "Rate(0.0061)", f64(t, "Rate(0.0061)", Rate(decodeNum(t, `"0.0061"`))), 0.000061, 0.5e-12)
	if Rate(adapters.Num{}) != nil {
		t.Error("Rate(absent): want nil")
	}
}

// An EMPTY funding_rate is a present-but-unreadable value and an ABSENT one is not there at all,
// which is the whole reason the two rate fields are pointers. `funding_rate ?? funding_rate_8h_curr`
// falls back only on the second, and collapsing them would invent a rate for a ticker that
// published an empty one.
func TestFundingPercentFallsBackOnlyWhenTheFieldIsAbsentOrNull(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		ok   bool
		val  float64
	}{
		{"empty does not fall back", `{"funding_rate":"","funding_rate_8h_curr":"0.01"}`, false, 0},
		{"absent falls back", `{"funding_rate_8h_curr":"0.01"}`, true, 0.01},
		{"null falls back", `{"funding_rate":null,"funding_rate_8h_curr":"0.01"}`, true, 0.01},
		{"present wins", `{"funding_rate":"0.0031","funding_rate_8h_curr":"0.01"}`, true, 0.0031},
		{"neither", `{}`, false, 0},
	}
	for _, c := range cases {
		var ticker Ticker
		if err := json.Unmarshal([]byte(c.raw), &ticker); err != nil {
			t.Fatalf("%s: decode: %v", c.name, err)
		}
		got := ticker.FundingPercent()
		eq(t, c.name+" ok", got.OK, c.ok)
		if c.ok {
			eq(t, c.name+" value", got.Val, c.val)
		}
	}
}

func TestTradablePerpsKeepsPerpetualsWithAnIntervalInTheVenuesOrder(t *testing.T) {
	rows := loadInstrumentRows(t)
	want := []string{
		"BTC_USDT_Perp",
		"ETH_USDT_Perp",
		"ENA_USDT_Perp",
		"XAU_USDT_Perp",
		"AAPL_USDT_Perp",
		"KBONK_USDT_Perp",
	}
	got := TradablePerps(rows).Names
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("names: got %v, want %v", got, want)
	}

	// A future, and a perpetual with no interval, are both untradable here.
	future := rows[0]
	future.Kind = "FUTURE"
	noInterval := rows[1]
	noInterval.FundingIntervalHours = adapters.Num{}
	if filtered := TradablePerps([]Instrument{future, noInterval}); filtered.Len() != 0 {
		t.Errorf("filtered: got %v, want none", filtered.Names)
	}
}

func TestAssetClassUnspecifiedIsCryptoEvenForAAPL(t *testing.T) {
	aapl := instrumentNamed(t, "AAPL_USDT_Perp")
	got := ParseTicker(aapl, loadTicker(t, "AAPL_USDT_Perp"), NOW)
	if got == nil {
		t.Fatal("AAPL_USDT_Perp: want a snapshot, got nil")
	}
	eq(t, "base", got.Base, "AAPL")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	// Exactly zero is a real reading, not an absent one.
	eq(t, "rate", got.Rate, 0.0)
	eq(t, "basisHours", got.BasisHours, 8.0)

	// Declared values would be honoured, should GRVT ever fill the field.
	eq(t, "UNSPECIFIED/AAPL", AssetClassFor("UNSPECIFIED", "AAPL"), core.ClassCrypto)
	eq(t, "absent/XAU", AssetClassFor("", "XAU"), core.ClassCrypto)
	eq(t, "EQUITY/AAPL", AssetClassFor("EQUITY", "AAPL"), core.ClassEquity)
	eq(t, "SOMETHING_NEW/XAU", AssetClassFor("SOMETHING_NEW", "XAU"), core.ClassCommodity)
}

func TestTheKPrefixIsNotReadAsAMultiplier(t *testing.T) {
	kbonk := instrumentNamed(t, "KBONK_USDT_Perp")
	ticker := *loadTicker(t, "BTC_USDT_Perp")
	ticker.Instrument = "KBONK_USDT_Perp"

	got := ParseTicker(kbonk, &ticker, NOW)
	if got == nil {
		t.Fatal("KBONK_USDT_Perp: want a snapshot, got nil")
	}
	// A capital K is not the kilo prefix the parser reads (that is a lowercase k), so KBONK stays
	// KBONK at multiplier 1 rather than pooling with BONK at a 1000x price.
	eq(t, "base", got.Base, "KBONK")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "basisHours", got.BasisHours, 4.0)
}

func TestParseFundingOldestFirstPercentToFractionNanosecondsToMs(t *testing.T) {
	var body fundingResponse
	if err := json.Unmarshal(fixtureBytes(t, "funding_BTC_USDT_Perp"), &body); err != nil {
		t.Fatalf("decode funding: %v", err)
	}
	if body.Result == nil {
		t.Fatal("funding: no result array")
	}

	btc := instrumentNamed(t, "BTC_USDT_Perp")
	events := ParseFunding(*body.Result, btc, 1_789_257_600_000, NOW)

	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
		markPrice  float64
	}{
		{1_789_257_600_000, pct(0.0066), 8, 77255.165038271},
		{1_789_286_400_000, pct(0.0077), 8, 77094.330596662},
		// Binance settled BTCUSDT at 0.0000645 at this instant.
		{1_789_315_200_000, pct(0.0061), 8, 77098.400057842},
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
	eq(t, "event[0].quote", str(t, "quote", events[0].Quote), "USDT")
	eq(t, "event[0].assetClass", events[0].AssetClass, core.ClassCrypto)
	eq(t, "event[0].venueId", events[0].VenueID, VenueID)
}

type post struct {
	url  string
	body map[string]any
}

// fixtureDoer answers every POST from a routing function and records what was asked for, which is
// the Go seam for the fake HttpClient grvt.test.ts builds. GRVT's API is POST-only, so the request
// BODY — not the URL — is what says which instrument was asked about.
type fixtureDoer struct {
	route func(url string, body map[string]any) (int, []byte)

	mu    sync.Mutex
	posts []post
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	raw, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	body := map[string]any{}
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	url := req.URL.String()

	d.mu.Lock()
	d.posts = append(d.posts, post{url: url, body: body})
	d.mu.Unlock()

	status, payload := d.route(url, body)
	return &http.Response{
		Status:     http.StatusText(status),
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(payload)),
		Request:    req,
	}, nil
}

func (d *fixtureDoer) taken() []post {
	d.mu.Lock()
	defer d.mu.Unlock()
	taken := d.posts
	d.posts = nil
	return taken
}

func tickerNames(posts []post) []string {
	names := make([]string, 0, len(posts))
	for _, p := range posts {
		if strings.HasSuffix(p.url, "/ticker") {
			name, _ := p.body["instrument"].(string)
			names = append(names, name)
		}
	}
	return names
}

func snapshotSymbols(snapshots []core.FundingSnapshot) []string {
	symbols := make([]string, 0, len(snapshots))
	for _, s := range snapshots {
		symbols = append(symbols, s.VenueSymbol)
	}
	return symbols
}

// newAdapter wires an adapter to a doer. MaxRetries is negative for exactly one attempt per call,
// so the post count is the adapter's own.
func newAdapter(doer *fixtureDoer, options httpclient.Options, budget *int) *Adapter {
	options.Doer = doer
	options.MaxRetries = -1
	return NewAdapterWithOptions(httpclient.New(VenueID, options), Options{TickerBudget: budget})
}

func TestFetchSnapshotsRotatesTickersAndRefreshesInstrumentsHourly(t *testing.T) {
	instruments := fixtureBytes(t, "all_instruments")
	tickers := map[string][]byte{
		"BTC_USDT_Perp":  fixtureBytes(t, "ticker_BTC_USDT_Perp"),
		"ENA_USDT_Perp":  fixtureBytes(t, "ticker_ENA_USDT_Perp"),
		"AAPL_USDT_Perp": fixtureBytes(t, "ticker_AAPL_USDT_Perp"),
	}
	doer := &fixtureDoer{route: func(url string, body map[string]any) (int, []byte) {
		if strings.HasSuffix(url, "/all_instruments") {
			return http.StatusOK, instruments
		}
		name, _ := body["instrument"].(string)
		// Instruments without a ticker fixture answer with no result.
		if payload, known := tickers[name]; known {
			return http.StatusOK, payload
		}
		return http.StatusOK, []byte(`{"result":null}`)
	}}
	budget := 2
	adapter := newAdapter(doer, httpclient.Options{}, &budget)

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("cycle 1: %v", err)
	}
	posts := doer.taken()
	if len(posts) != 3 {
		t.Fatalf("cycle 1 posts: got %d (%v), want 3", len(posts), posts)
	}
	eq(t, "cycle 1 post[0].url", posts[0].url, API+"/all_instruments")
	if !reflect.DeepEqual(posts[0].body, map[string]any{"is_active": true}) {
		t.Errorf("cycle 1 post[0].body: got %v, want {is_active:true}", posts[0].body)
	}
	eq(t, "cycle 1 post[1].url", posts[1].url, API+"/ticker")
	if got := tickerNames(posts); !reflect.DeepEqual(got, []string{"BTC_USDT_Perp", "ETH_USDT_Perp"}) {
		t.Errorf("cycle 1 tickers: got %v", got)
	}
	// Only what this cycle read is emitted, and ETH answered with no result.
	if got := snapshotSymbols(first.Snapshots); !reflect.DeepEqual(got, []string{"BTC_USDT_Perp"}) {
		t.Errorf("cycle 1 snapshots: got %v, want [BTC_USDT_Perp]", got)
	}

	second, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000))
	if err != nil {
		t.Fatalf("cycle 2: %v", err)
	}
	posts = doer.taken()
	for _, p := range posts {
		if strings.HasSuffix(p.url, "/all_instruments") {
			t.Error("cycle 2: the listing is cached for an hour, so it must not be re-read")
		}
	}
	if got := tickerNames(posts); !reflect.DeepEqual(got, []string{"ENA_USDT_Perp", "XAU_USDT_Perp"}) {
		t.Errorf("cycle 2 tickers: got %v", got)
	}
	if got := snapshotSymbols(second.Snapshots); !reflect.DeepEqual(got, []string{"ENA_USDT_Perp"}) {
		t.Errorf("cycle 2 snapshots: got %v, want [ENA_USDT_Perp]", got)
	}
	eq(t, "cycle 2 observedAt", second.Snapshots[0].ObservedAt, NOW+60_000)

	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+120_000)); err != nil {
		t.Fatalf("cycle 3: %v", err)
	}
	if got := tickerNames(doer.taken()); !reflect.DeepEqual(got, []string{"AAPL_USDT_Perp", "KBONK_USDT_Perp"}) {
		t.Errorf("cycle 3 tickers: got %v", got)
	}

	// A full sweep of six took three cycles; the fourth starts over with the oldest.
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+180_000)); err != nil {
		t.Fatalf("cycle 4: %v", err)
	}
	if got := tickerNames(doer.taken()); !reflect.DeepEqual(got, []string{"BTC_USDT_Perp", "ETH_USDT_Perp"}) {
		t.Errorf("cycle 4 tickers: got %v", got)
	}

	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60*60_000)); err != nil {
		t.Fatalf("hourly cycle: %v", err)
	}
	posts = doer.taken()
	if len(posts) == 0 || posts[0].url != API+"/all_instruments" {
		t.Errorf("hourly cycle: want the listing re-read first, got %v", posts)
	}
}

func TestFetchSnapshotsDefaultBudgetSweeps194PerpsInTwoCyclesThenWraps(t *testing.T) {
	names := make([]string, 194)
	rows := make([]string, 194)
	for i := range names {
		names[i] = fmt.Sprintf("C%d_USDT_Perp", i)
		rows[i] = fmt.Sprintf(
			`{"instrument":%q,"base":"C%d","quote":"USDT","kind":"PERPETUAL","funding_interval_hours":8}`,
			names[i], i)
	}
	// Raw JSON rather than a marshalled struct: adapters.Num has no MarshalJSON, so an Instrument
	// cannot be round-tripped through encoding/json.
	instruments := []byte(`{"result":[` + strings.Join(rows, ",") + `]}`)

	doer := &fixtureDoer{route: func(url string, _ map[string]any) (int, []byte) {
		if strings.HasSuffix(url, "/all_instruments") {
			return http.StatusOK, instruments
		}
		return http.StatusOK, []byte(`{"result":null}`)
	}}
	adapter := newAdapter(doer, httpclient.Options{}, nil)

	for cycle, at := range []int64{NOW, NOW + 60_000} {
		if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(at)); err != nil {
			t.Fatalf("cycle %d: %v", cycle+1, err)
		}
	}

	seen := tickerNames(doer.taken())
	// 100 then 100: the last 94 unseen, then the 6 read longest ago.
	if len(seen) != 200 {
		t.Fatalf("tickers: got %d, want 200", len(seen))
	}
	unique := map[string]bool{}
	for _, name := range seen[:194] {
		unique[name] = true
	}
	if len(unique) != 194 {
		t.Errorf("first 194 tickers: got %d distinct, want 194", len(unique))
	}
	if !reflect.DeepEqual(seen[194:], names[:6]) {
		t.Errorf("wrap: got %v, want %v", seen[194:], names[:6])
	}
}

func TestFetchSnapshotsACycleWhoseEveryTickerFailsIsAnError(t *testing.T) {
	instruments := fixtureBytes(t, "all_instruments")
	doer := &fixtureDoer{route: func(url string, _ map[string]any) (int, []byte) {
		if strings.HasSuffix(url, "/all_instruments") {
			return http.StatusOK, instruments
		}
		return http.StatusInternalServerError, []byte(`{"error":"nope"}`)
	}}
	// One failure opens the circuit, so every later ticker in the slice is refused outright — which
	// is what makes the CircuitOpenError, not the 500 that came first, the error worth reporting.
	adapter := newAdapter(doer, httpclient.Options{FailureThreshold: 1}, nil)

	got, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatalf("want an error, got %d snapshots", len(got.Snapshots))
	}
	var open *httpclient.CircuitOpenError
	if !errors.As(err, &open) {
		t.Fatalf("want a CircuitOpenError, got %T: %v", err, err)
	}
}

func TestFetchFundingHistoryPagesByCursorInNanoseconds(t *testing.T) {
	const T int64 = 1_789_315_200_000
	const hourMs int64 = 3_600_000
	instruments := fixtureBytes(t, "all_instruments")

	page := func(count int, offset int64, next string) []byte {
		rows := make([]string, count)
		for i := range rows {
			settledAt := T - (offset+int64(i))*8*hourMs
			rows[i] = fmt.Sprintf(
				`{"instrument":"BTC_USDT_Perp","funding_rate":"0.01","funding_time":"%s","mark_price":"77000","funding_interval_hours":8}`,
				strconv.FormatInt(settledAt, 10)+"000000")
		}
		body := `{"result":[` + strings.Join(rows, ",") + `]`
		if next != "" {
			body += `,"next":` + strconv.Quote(next)
		}
		return []byte(body + "}")
	}

	doer := &fixtureDoer{route: func(url string, body map[string]any) (int, []byte) {
		if strings.HasSuffix(url, "/all_instruments") {
			return http.StatusOK, instruments
		}
		if _, paging := body["cursor"]; paging {
			return http.StatusOK, page(3, 1000, "")
		}
		return http.StatusOK, page(historyPageSize, 0, "c1")
	}}
	adapter := newAdapter(doer, httpclient.Options{}, nil)

	events, err := adapter.FetchFundingHistory(context.Background(), "BTC_USDT_Perp", 0, T)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	posts := doer.taken()
	if len(posts) != 3 {
		t.Fatalf("posts: got %d (%v), want 3", len(posts), posts)
	}
	want := []map[string]any{
		{
			"instrument": "BTC_USDT_Perp",
			"start_time": "0",
			"end_time":   nsString(T),
			"limit":      float64(historyPageSize),
		},
		{
			"instrument": "BTC_USDT_Perp",
			"start_time": "0",
			"end_time":   nsString(T),
			"limit":      float64(historyPageSize),
			"cursor":     "c1",
		},
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("post[%d].url", i+1), posts[i+1].url, API+"/funding")
		if !reflect.DeepEqual(posts[i+1].body, w) {
			t.Errorf("post[%d].body: got %v, want %v", i+1, posts[i+1].body, w)
		}
	}

	if len(events) != 1003 {
		t.Fatalf("events: got %d, want 1003", len(events))
	}
	for i, event := range events {
		if event.Rate != pct(0.01) || event.BasisHours != 8 {
			t.Fatalf("event[%d]: got rate %v basis %v, want %v and 8", i, event.Rate, event.BasisHours, pct(0.01))
		}
		if i > 0 && events[i-1].SettledAt >= event.SettledAt {
			t.Fatalf("event[%d]: settlements must be oldest first", i)
		}
	}

	// An instrument GRVT does not list has no history to page.
	unlisted, err := adapter.FetchFundingHistory(context.Background(), "NOPE_USDT_Perp", 0, T)
	if err != nil {
		t.Fatalf("FetchFundingHistory(unlisted): %v", err)
	}
	if len(unlisted) != 0 {
		t.Errorf("unlisted: got %d events, want none", len(unlisted))
	}
}

func TestNsStringIsExactPastTheFloat64Limit(t *testing.T) {
	// Number.MAX_SAFE_INTEGER, the open upper bound the TypeScript history tests pass. An int64
	// multiply would overflow here and send the venue a negative window.
	eq(t, "max safe integer", nsString(9_007_199_254_740_991), "9007199254740991000000")
	eq(t, "negative is floored", nsString(-5), "0")
	eq(t, "zero", nsString(0), "0")
}

func TestNsToMsIsExactAndRejectsWhatIsNotAPositiveInteger(t *testing.T) {
	if got := nsToMs("1789344000000000000"); got == nil || *got != 1_789_344_000_000 {
		t.Errorf("nanoseconds: got %v, want 1789344000000", got)
	}
	for _, raw := range []string{"", "0", "000", "-1789344000000000000", "1.5e18", "abc"} {
		if got := nsToMs(raw); got != nil {
			t.Errorf("nsToMs(%q): got %v, want nil", raw, *got)
		}
	}
}
