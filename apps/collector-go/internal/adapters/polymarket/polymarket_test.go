package polymarket

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

// The same instant polymarket.test.ts uses -- 2026-09-13T22:26:38Z, the tickers' own timestamp -- so
// both suites pin identical output.
const NOW int64 = 1_789_338_398_739

// maxSafeInteger is JavaScript's Number.MAX_SAFE_INTEGER, the open upper bound the TypeScript history
// test passes. Written out so the Go window is the same window.
const maxSafeInteger int64 = 9_007_199_254_740_991

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "polymarket")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/polymarket above the working directory")
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

// The SAME files packages/adapters/src/venues/polymarket.test.ts reads.
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

// product multiplies left to right at runtime, exactly as adapters.Mul does. Written as a Go constant
// expression instead, `114.13806 * 76770` is folded at arbitrary precision and can land one ulp away
// from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func fixtures(tb testing.TB) ([]Instrument, []Ticker, []Statistic) {
	tb.Helper()
	var instruments []Instrument
	var tickers []Ticker
	var statistics []Statistic
	load(tb, "instruments", &instruments)
	load(tb, "tickers", &tickers)
	load(tb, "statistics", &statistics)
	return instruments, tickers, statistics
}

func snapshots(tb testing.TB) []core.FundingSnapshot {
	tb.Helper()
	instruments, tickers, statistics := fixtures(tb)
	return ParseSnapshots(instruments, tickers, statistics, NOW)
}

func snapshotBySymbol(all []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range all {
		if all[i].VenueSymbol == symbol {
			return &all[i]
		}
	}
	return nil
}

func instrumentBySymbol(tb testing.TB, instruments []Instrument, symbol string) Instrument {
	tb.Helper()
	for _, instrument := range instruments {
		if instrument.Symbol == symbol {
			return instrument
		}
	}
	tb.Fatalf("%s missing from the instrument fixture", symbol)
	return Instrument{}
}

func TestParseSnapshotsNormalizesBTCUSDAsAPredictedHourlyRateSettlingInPUSD(t *testing.T) {
	btc := snapshotBySymbol(snapshots(t), "BTC-USD")
	if btc == nil {
		t.Fatal("BTC-USD missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-USD")
	eq(t, "base", btc.Base, "BTC")
	// pUSD, uppercased: the venue's sole collateral, stated rather than parsed off the "-USD" suffix.
	eq(t, "quote", str(t, "quote", btc.Quote), "PUSD")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.0000125)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_340_400_000 {
		t.Errorf("nextFundingAt: got %v, want 1789340400000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76770)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76793)
	// open_interest is contracts of one BTC each, valued at mark.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(114.13806, 76770))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 1853965.1945999996)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 20)

	// Nothing settled arrives with a snapshot: the ticker rate is the OPEN window's rolling figure.
	if btc.BestBid != nil || btc.BestAsk != nil {
		t.Error("the venue publishes no top of book on these endpoints")
	}
}

func TestBTCAtTheFloorPerHourIsAboutTenPointNineFivePercentAPR(t *testing.T) {
	btc := snapshotBySymbol(snapshots(t), "BTC-USD")
	if btc == nil {
		t.Fatal("BTC-USD missing")
	}
	// 0.01%/8h is 0.0000125 an hour. Hyperliquid read 10.1% the same minute; a 24x basis error would
	// show as 263% APR on a flat book.
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 10.95, 0.005)
}

func TestEveryInstrumentInBothListsIsCollected(t *testing.T) {
	instruments, tickers, statistics := fixtures(t)
	parsed := ParseSnapshots(instruments, tickers, statistics, NOW)

	if len(parsed) != len(tickers) {
		t.Fatalf("snapshots: got %d, want %d", len(parsed), len(tickers))
	}
	// Same order as the tickers, which is what the parser iterates.
	for i, ticker := range tickers {
		eq(t, "venueSymbol", parsed[i].VenueSymbol, ticker.Symbol)
	}
}

func TestAnInstrumentThatIsNotAPerpetualOrHasNoTickerIsSkipped(t *testing.T) {
	instruments, tickers, statistics := fixtures(t)

	notPerp := instrumentBySymbol(t, instruments, "BTC-USD")
	notPerp.InstrumentType = "future"
	if got := ParseSnapshots([]Instrument{notPerp}, tickers, statistics, NOW); len(got) != 0 {
		t.Errorf("a non-perpetual: got %d snapshots, want none", len(got))
	}
	if got := ParseSnapshots(instruments, nil, statistics, NOW); len(got) != 0 {
		t.Errorf("no tickers: got %d snapshots, want none", len(got))
	}
}

func TestClassFromCategoryBaseFromTheDeclarationWhereTheParserDisagrees(t *testing.T) {
	want := []struct {
		symbol, base string
		class        core.AssetClass
	}{
		// index: core's table keeps SP500 (aliased to US500) an index.
		{"SP500-USD", "US500", core.ClassIndex},
		// GOLD reaches XAU through core's alias.
		{"GOLD-USD", "XAU", core.ClassCommodity},
		{"WTIOIL-USD", "CL", core.ClassCommodity},
		{"BTC-USD", "BTC", core.ClassCrypto},
		{"ETH-USD", "ETH", core.ClassCrypto},
		// Declared base_asset GOOGL, parsed GOOG: the declaration wins.
		{"GOOG-USD", "GOOGL", core.ClassEquity},
		// Declared index; DRAM is an ETF, so core's table files it as equity.
		{"DRAM-USD", "DRAM", core.ClassEquity},
		// Uppercase K is not a multiplier to the parser, and the venue declares none.
		{"KPEPE-USD", "KPEPE", core.ClassCrypto},
		{"MSTR-USD", "MSTR", core.ClassEquity},
		// A memecoin Polymarket declares as equity; the declaration is kept (see the package header).
		{"PONS-USD", "PONS", core.ClassEquity},
	}

	parsed := snapshots(t)
	if len(parsed) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(parsed), len(want))
	}
	for i, w := range want {
		eq(t, "venueSymbol", parsed[i].VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", parsed[i].Base, w.base)
		eq(t, w.symbol+" assetClass", parsed[i].AssetClass, w.class)
		eq(t, w.symbol+" quote", str(t, w.symbol+" quote", parsed[i].Quote), "PUSD")
		// Uppercase K is not read as a multiplier, here or anywhere.
		eq(t, w.symbol+" multiplier", parsed[i].Multiplier, 1.0)
	}
}

func TestNonCryptoQuietMarketsSitOnHalfTheCryptoFloor(t *testing.T) {
	gold := snapshotBySymbol(snapshots(t), "GOLD-USD")
	if gold == nil {
		t.Fatal("GOLD-USD missing")
	}
	// The formula's floor is 0.0001/8 = 0.0000125; non-crypto runs at scale 0.5.
	eq(t, "rate", gold.Rate, 0.00000625)
}

func TestAssetClassForUnknownNonCryptoCategoriesFallToTheBaseTables(t *testing.T) {
	eq(t, "crypto/BTC", AssetClassFor("crypto", "BTC"), core.ClassCrypto)
	// An absent category is undeclared, so crypto -- the same branch an empty string takes.
	eq(t, "absent/BTC", AssetClassFor("", "BTC"), core.ClassCrypto)
	eq(t, "forex/EURUSD", AssetClassFor("forex", "EURUSD"), core.ClassFX)
	eq(t, "something-new/XAG", AssetClassFor("something-new", "XAG"), core.ClassCommodity)
	// The declared four, read case- and space-insensitively as the TypeScript trim/lowercase does.
	eq(t, " Equity /MSTR", AssetClassFor(" Equity ", "MSTR"), core.ClassEquity)
	eq(t, "index/US500", AssetClassFor("index", "US500"), core.ClassIndex)
	eq(t, "commodity/XAU", AssetClassFor("commodity", "XAU"), core.ClassCommodity)
}

func TestIntervalHoursReadsFundingIntervalStrings(t *testing.T) {
	eq(t, "1h", f64(t, "1h", IntervalHours("1h")), 1)
	eq(t, "8h", f64(t, "8h", IntervalHours("8h")), 8)
	if got := IntervalHours("30m"); got != nil {
		t.Errorf("30m: got %v, want nil", *got)
	}
	// The absent case: `undefined` on the TypeScript side, the empty string here.
	if got := IntervalHours(""); got != nil {
		t.Errorf("absent: got %v, want nil", *got)
	}
	if got := IntervalHours("0h"); got != nil {
		t.Errorf("0h: got %v, want nil -- a zero interval is not an interval", *got)
	}
}

func TestParseFundingHistoryNewestFirstRowsBecomeOldestFirstHourlySettlements(t *testing.T) {
	instruments, _, _ := fixtures(t)
	btc := instrumentBySymbol(t, instruments, "BTC-USD")

	var page FundingPage
	load(t, "funding-6", &page)
	if page.Data == nil {
		t.Fatal("funding-6 fixture has no data array")
	}

	events := ParseFundingHistory(*page.Data, btc, 0, maxSafeInteger)
	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_322_400_060, 0.0000125, 1},
		{1_789_326_000_052, 0.0000125, 1},
		{1_789_329_600_027, 0.0000125, 1},
		{1_789_333_200_084, 0.0000125, 1},
		{1_789_336_800_106, 0.0000125, 1},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		// The ~100ms settlement-run jitter is kept, not snapped to the hour.
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueId", events[0].VenueID, VenueID)
	eq(t, "base", events[0].Base, "BTC")
	eq(t, "quote", str(t, "quote", events[0].Quote), "PUSD")
	if events[0].MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil -- the funding endpoint publishes no mark", *events[0].MarkPrice)
	}
}

func TestParseFundingHistoryCutsToTheWindow(t *testing.T) {
	instruments, _, _ := fixtures(t)
	btc := instrumentBySymbol(t, instruments, "BTC-USD")

	var page FundingPage
	load(t, "funding-6", &page)

	// Bounds are inclusive on both ends, so the two edge settlements survive and the three between
	// them are all that the narrower window drops.
	events := ParseFundingHistory(*page.Data, btc, 1_789_326_000_052, 1_789_329_600_027)
	if len(events) != 2 {
		t.Fatalf("events: got %d, want 2", len(events))
	}
	eq(t, "first", events[0].SettledAt, int64(1_789_326_000_052))
	eq(t, "last", events[1].SettledAt, int64(1_789_329_600_027))
}

// routeDoer answers each URL from a routing function, recording what was asked for. It is the Go seam
// for the fake HttpClient polymarket.test.ts builds.
type routeDoer struct {
	urls   []string
	handle func(url string) []byte
}

func (d *routeDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	body := d.handle(requested)
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

// newAdapter builds an adapter over a routing doer. MaxRetries is negative for exactly one attempt per
// call, so the URL count is the walk's own.
func newAdapter(handle func(url string) []byte) (*Adapter, *routeDoer) {
	doer := &routeDoer{handle: handle}
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1})), doer
}

func fixtureRouter(tb testing.TB) func(string) []byte {
	tb.Helper()
	instruments := fixtureBytes(tb, "instruments")
	tickers := fixtureBytes(tb, "tickers")
	statistics := fixtureBytes(tb, "statistics")
	funding := fixtureBytes(tb, "funding-6")
	return func(url string) []byte {
		switch {
		case strings.HasSuffix(url, "/instruments"):
			return instruments
		case strings.HasSuffix(url, "/tickers"):
			return tickers
		case strings.HasSuffix(url, "/statistics"):
			return statistics
		case strings.Contains(url, "/funding?"):
			return funding
		}
		return nil
	}
}

func eqURLs(tb testing.TB, got, want []string) {
	tb.Helper()
	if len(got) != len(want) {
		tb.Fatalf("requests: got %d (%v), want %d (%v)", len(got), got, len(want), want)
	}
	for i := range want {
		eq(tb, fmt.Sprintf("request %d", i), got[i], want[i])
	}
}

func TestFetchSnapshotsAsksForInstrumentsOnceAnHourTickersAndStatisticsEveryCycle(t *testing.T) {
	adapter, doer := newAdapter(fixtureRouter(t))

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000)); err != nil {
		t.Fatalf("FetchSnapshots (second cycle): %v", err)
	}

	eqURLs(t, doer.urls, []string{
		API + "/instruments",
		API + "/tickers",
		API + "/statistics",
		API + "/tickers",
		API + "/statistics",
	})
	if len(first.Snapshots) != 10 {
		t.Errorf("snapshots: got %d, want 10", len(first.Snapshots))
	}
	if len(first.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(first.Settled))
	}
}

func TestFetchFundingHistoryAddressesTheInstrumentByIDAndStopsWhenMoreIsFalse(t *testing.T) {
	adapter, doer := newAdapter(fixtureRouter(t))

	events, err := adapter.FetchFundingHistory(context.Background(), "BTC-USD", 1_789_322_000_000, 1_789_337_000_000)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	eqURLs(t, doer.urls, []string{
		API + "/instruments",
		API + "/funding?instrument_id=6&start_timestamp=1789322000000&end_timestamp=1789337000000",
	})
	if len(events) != 5 {
		t.Errorf("events: got %d, want 5", len(events))
	}
}

func TestFetchFundingHistoryPagesBackByEndTimestampWhileMoreIsTrue(t *testing.T) {
	const hour int64 = 3_600_000
	const top int64 = 1_789_336_800_000

	// Built as raw JSON: adapters.Num has no MarshalJSON, so a struct holding one cannot be
	// round-tripped into a synthetic response.
	page := func(newest int64, count int, more bool) []byte {
		rows := make([]string, 0, count)
		for i := 0; i < count; i++ {
			rows = append(rows, fmt.Sprintf(`{"funding_rate":"0.00001","timestamp":%d}`, newest-int64(i)*hour))
		}
		return []byte(fmt.Sprintf(`{"data":[%s],"more":%t}`, strings.Join(rows, ","), more))
	}

	instruments := fixtureBytes(t, "instruments")
	calls := 0
	adapter, doer := newAdapter(func(url string) []byte {
		if strings.HasSuffix(url, "/instruments") {
			return instruments
		}
		calls++
		if calls == 1 {
			return page(top, 100, true)
		}
		return page(top-100*hour, 3, false)
	})

	events, err := adapter.FetchFundingHistory(context.Background(), "BTC-USD", top-102*hour, top)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	if len(doer.urls) != 3 {
		t.Fatalf("requests: got %d (%v), want 3", len(doer.urls), doer.urls)
	}
	// The walk steps end_timestamp back past the oldest row of the full page it just read.
	wantTail := fmt.Sprintf("end_timestamp=%d", top-99*hour-1)
	if !strings.Contains(doer.urls[2], wantTail) {
		t.Errorf("second funding page: %q does not contain %q", doer.urls[2], wantTail)
	}
	if len(events) != 103 {
		t.Errorf("events: got %d, want 103", len(events))
	}
}

func TestFetchFundingHistoryForAnUnknownSymbolReturnsNoHistory(t *testing.T) {
	adapter, doer := newAdapter(fixtureRouter(t))

	events, err := adapter.FetchFundingHistory(context.Background(), "NOPE-USD", 0, 1)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("events: got %d, want none", len(events))
	}
	// A symbol the venue does not list costs the instrument call and nothing more.
	eqURLs(t, doer.urls, []string{API + "/instruments"})
}

func TestUnexpectedResponsesFailTheCycle(t *testing.T) {
	// A null body is "not the list we asked for": it must fail the venue's cycle rather than read as a
	// venue with nothing listed.
	adapter, _ := newAdapter(func(url string) []byte { return []byte("null") })
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW)); err == nil {
		t.Error("a null instruments body must fail the cycle")
	}

	instruments := fixtureBytes(t, "instruments")
	tickerless, _ := newAdapter(func(url string) []byte {
		if strings.HasSuffix(url, "/instruments") {
			return instruments
		}
		return []byte("null")
	})
	if _, err := tickerless.FetchSnapshots(context.Background(), time.UnixMilli(NOW)); err == nil {
		t.Error("a null tickers body must fail the cycle")
	}

	noData, _ := newAdapter(func(url string) []byte {
		if strings.HasSuffix(url, "/instruments") {
			return instruments
		}
		return []byte(`{"more":false}`)
	})
	if _, err := noData.FetchFundingHistory(context.Background(), "BTC-USD", 0, maxSafeInteger); err == nil {
		t.Error("a funding page with no data array must fail the call")
	}
}
