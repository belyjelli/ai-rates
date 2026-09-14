package ondo

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
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instants ondo.test.ts uses, so both suites pin identical output. NEXT is built rather
// than written out for the same reason the TypeScript side calls Date.parse: the hour it names is
// the fact, and a hand-copied epoch would be a second number to keep in step.
const (
	NOW  int64 = 1_789_337_600_000
	HOUR int64 = 3_600_000
)

var NEXT = time.Date(2026, 9, 13, 23, 0, 0, 0, time.UTC).UnixMilli()

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "ondo")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/ondo above the working directory")
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

// The SAME files packages/adapters/src/venues/ondo.test.ts reads.
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

func contracts(tb testing.TB) []Contract {
	tb.Helper()
	var body response[[]Contract]
	load(tb, "contracts", &body)
	if body.Result == nil {
		tb.Fatal("contracts fixture has no result")
	}
	return *body.Result
}

func markPrices(tb testing.TB) map[string]MarkPrice {
	tb.Helper()
	var body response[map[string]MarkPrice]
	load(tb, "mark_prices", &body)
	if body.Result == nil {
		tb.Fatal("mark_prices fixture has no result")
	}
	return *body.Result
}

func history(tb testing.TB) []FundingRateValue {
	tb.Helper()
	var body response[[]FundingRateValue]
	load(tb, "funding_rate_history_BTC", &body)
	if body.Result == nil {
		tb.Fatal("history fixture has no result")
	}
	return *body.Result
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func contractByMarket(tb testing.TB, rows []Contract, market string) Contract {
	tb.Helper()
	for _, contract := range rows {
		if contract.Market == market {
			return contract
		}
	}
	tb.Fatalf("%s missing from the contracts fixture", market)
	return Contract{}
}

func TestParseSnapshotsNormalizesBTCFully(t *testing.T) {
	got := ParseSnapshots(contracts(t), markPrices(t), NOW)

	btc := snapshotBySymbol(got.Snapshots, "BTC-USD.P")
	if btc == nil {
		t.Fatal("BTC-USD.P missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-USD.P")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	// USDC, not the `quoteCurrency: "USD"` the contract declares: USD is the pricing unit and USDC
	// is what actually moves on settlement.
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, -0.0000359)
	// Hourly, not the 8h convention: reading these as 8h rates would understate every Ondo APR 8x.
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != NEXT {
		t.Errorf("nextFundingAt: got %v, want %d", btc.NextFundingAt, NEXT)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	// The mark comes from /perps/mark_prices; /perps/contracts has none.
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76717.784222)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77281.17631550499899555)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), 4264581.94)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 3500014.55)

	// Everything Ondo does not publish stays absent rather than arriving as a confident zero.
	for label, value := range map[string]*float64{
		"bestBid": btc.BestBid, "bestBidSizeUsd": btc.BestBidSizeUSD,
		"bestAsk": btc.BestAsk, "bestAskSizeUsd": btc.BestAskSizeUSD,
		"maxLeverage": btc.MaxLeverage,
	} {
		if value != nil {
			t.Errorf("%s: got %v, want nil", label, *value)
		}
	}
}

func TestTheLastCompletedIntervalIsASettlementAnHourBeforeTheNextOne(t *testing.T) {
	settled := ParseSnapshots(contracts(t), markPrices(t), NOW).Settled

	var btc *core.FundingEvent
	for i := range settled {
		if settled[i].VenueSymbol == "BTC-USD.P" {
			btc = &settled[i]
			break
		}
	}
	if btc == nil {
		t.Fatal("BTC-USD.P settlement missing")
	}
	eq(t, "settledAt", btc.SettledAt, NEXT-HOUR)
	eq(t, "rate", btc.Rate, -0.0000338)
	eq(t, "basisHours", btc.BasisHours, 1.0)

	// The same figure the history endpoint files at 22:00.
	rows := history(t)
	eq(t, "history[0].market", rows[0].Market, "BTC-USD.P")
	eq(t, "history[0].fundingRate", rows[0].FundingRate.Val, -0.0000338)
	stamped, readable := ParseTime(rows[0].Time)
	if !readable {
		t.Fatal("history[0].time unreadable")
	}
	eq(t, "history[0] stamp", stamped, NEXT-HOUR+37)
}

func TestParseSnapshotsKeepsClosedSessionsAndSkipsDisabledMarkets(t *testing.T) {
	rows := contracts(t)
	snapshots := ParseSnapshots(rows, markPrices(t), NOW).Snapshots

	for _, skipped := range []string{"PUMP-USD.P", "EURUSD-USD.P"} {
		if snapshotBySymbol(snapshots, skipped) != nil {
			t.Errorf("%s: disabled, so it must not be collected", skipped)
		}
	}
	// AAPL is `isClosed` on a Sunday evening yet enabled, and funds every hour through the closure.
	eq(t, "AAPL isClosed", contractByMarket(t, rows, "AAPL-USD.P").IsClosed, true)
	if snapshotBySymbol(snapshots, "AAPL-USD.P") == nil {
		t.Error("AAPL-USD.P missing — a closed underlying session still trades and funds")
	}
	if len(snapshots) != 9 {
		t.Errorf("snapshots: got %d, want 9", len(snapshots))
	}
}

func TestParseSnapshotsLeavesAMissingMarkNullWithoutDroppingTheMarket(t *testing.T) {
	snapshots := ParseSnapshots(contracts(t), map[string]MarkPrice{}, NOW).Snapshots
	if len(snapshots) != 9 {
		t.Fatalf("snapshots: got %d, want 9", len(snapshots))
	}
	for _, snapshot := range snapshots {
		if snapshot.MarkPrice != nil {
			t.Errorf("%s markPrice: got %v, want nil", snapshot.VenueSymbol, *snapshot.MarkPrice)
		}
	}
}

func TestAnHourlyRateAnnualisesOverOneHour(t *testing.T) {
	btc := ParseSnapshots(contracts(t), markPrices(t), NOW).Snapshots[0]
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	// -0.0000359 over one hour is -31.45% APR. Tolerance matches the TypeScript toBeCloseTo(_, 4).
	closeTo(t, "apr", apr, -31.4484, 5e-5)
}

func TestAssetClassComesFromTheDeclaredTagWithBasesSettlingEquityVersusIndex(t *testing.T) {
	want := []struct {
		symbol string
		base   string
		class  core.AssetClass
	}{
		{"BTC-USD.P", "BTC", core.ClassCrypto},
		{"ETH-USD.P", "ETH", core.ClassCrypto},
		{"ZEC-USD.P", "ZEC", core.ClassCrypto},
		{"AAPL-USD.P", "AAPL", core.ClassEquity},
		{"XAU-USD.P", "XAU", core.ClassCommodity},
		// WTI reaches CL through the core alias.
		{"WTI-USD.P", "CL", core.ClassCommodity},
		// Tagged ETF: equity, as five venues file SPY.
		{"SPY-USD.P", "SPY", core.ClassEquity},
		{"US500-USD.P", "US500", core.ClassIndex},
		{"USDJPY-USD.P", "USDJPY", core.ClassFX},
	}

	snapshots := ParseSnapshots(contracts(t), markPrices(t), NOW).Snapshots
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, "venueSymbol", snapshots[i].VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", snapshots[i].Base, w.base)
		eq(t, w.symbol+" assetClass", snapshots[i].AssetClass, w.class)
	}
}

func TestAnUnknownTagIsStillNotCryptoAndNoTagDeclaresNothing(t *testing.T) {
	// A tag we do not know is still a statement that the market is NOT crypto, so the base tables
	// place it rather than it defaulting to crypto.
	eq(t, "Bond/XAG", AssetClassFor([]string{"Bond"}, "XAG"), core.ClassCommodity)
	eq(t, "Bond/TLT", AssetClassFor([]string{"Bond"}, "TLT"), core.ClassEquity)
	// No tag at all declares nothing, which is crypto — even for a base the tables would file as gold.
	eq(t, "empty/XAU", AssetClassFor([]string{}, "XAU"), core.ClassCrypto)
	eq(t, "nil/AAPL", AssetClassFor(nil, "AAPL"), core.ClassCrypto)
	eq(t, "ETF/QQQ", AssetClassFor([]string{"ETF"}, "QQQ"), core.ClassEquity)
	eq(t, "Index/US100", AssetClassFor([]string{"Index"}, "US100"), core.ClassIndex)
	// A list of blanks declares nothing either: the first non-blank tag is the one that speaks.
	eq(t, "blank/AAPL", AssetClassFor([]string{"", "  "}, "AAPL"), core.ClassCrypto)
}

func TestParseTimeAcceptsNanosecondFractionsAndPlainSeconds(t *testing.T) {
	stamped, readable := ParseTime("2026-09-13T22:00:00.037237665Z")
	if !readable {
		t.Fatal("nanosecond stamp unreadable")
	}
	eq(t, "nanoseconds", stamped, NEXT-HOUR+37)

	stamped, readable = ParseTime("2026-09-13T23:00:00Z")
	if !readable {
		t.Fatal("plain-seconds stamp unreadable")
	}
	eq(t, "plain seconds", stamped, NEXT)

	for _, unreadable := range []string{"", "not a time"} {
		if _, ok := ParseTime(unreadable); ok {
			t.Errorf("%q: want unreadable", unreadable)
		}
	}
}

func TestParseFundingHistoryTurnsNewestFirstRowsIntoOldestFirstSettlements(t *testing.T) {
	btc := contractByMarket(t, contracts(t), "BTC-USD.P")
	// The rows are stamped 20:00:00.011, 21:00:00.038 and 22:00:00.037; the window stops short of
	// 22:00, so the floored 22:00 settlement falls outside it.
	events := ParseFundingHistory(history(t), btc.Market, btc.Tags, NEXT-3*HOUR, NEXT-HOUR-1)

	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{NEXT - 3*HOUR, -0.0000177, 1},
		{NEXT - 2*HOUR, -0.000054, 1},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
		eq(t, "quote", str(t, "quote", events[i].Quote), "USDC")
	}
}

func TestHistoryLandsOnTheSameInstantAsTheContractsSettlement(t *testing.T) {
	rows := contracts(t)
	btc := contractByMarket(t, rows, "BTC-USD.P")

	events := ParseFundingHistory(history(t), btc.Market, btc.Tags, 0, NEXT)
	if len(events) == 0 {
		t.Fatal("no history events")
	}
	fromHistory := events[len(events)-1]
	fromContracts := ParseSnapshots(rows, markPrices(t), NOW).Settled[0]

	eq(t, "history settledAt", fromHistory.SettledAt, NEXT-HOUR)
	eq(t, "settledAt agreement", fromHistory.SettledAt, fromContracts.SettledAt)
	eq(t, "rate agreement", fromHistory.Rate, fromContracts.Rate)
}

// fixtureDoer answers each Ondo path with its fixture, recording the URLs asked for. It is the Go
// seam for the fake HttpClient ondo.test.ts builds.
type fixtureDoer struct {
	urls   []string
	bodies map[string][]byte
	fail   map[string]bool
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	path := req.URL.Path

	if d.fail[path] {
		return &http.Response{
			Status:     "502 Bad Gateway",
			StatusCode: http.StatusBadGateway,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{"error":"bad gateway"}`)),
			Request:    req,
		}, nil
	}
	body, known := d.bodies[path]
	if !known {
		return nil, http.ErrNotSupported
	}
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

func newDoer(tb testing.TB) *fixtureDoer {
	tb.Helper()
	return &fixtureDoer{
		bodies: map[string][]byte{
			"/v1/perps/contracts":            fixtureBytes(tb, "contracts"),
			"/v1/perps/mark_prices":          fixtureBytes(tb, "mark_prices"),
			"/v1/perps/funding_rate_history": fixtureBytes(tb, "funding_rate_history_BTC"),
		},
		fail: map[string]bool{},
	}
}

// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
func newAdapter(doer *fixtureDoer) *Adapter {
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsMakesTwoCallsAndKeepsFundingWhenTheMarkReadFails(t *testing.T) {
	doer := newDoer(t)
	batch, err := newAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(batch.Snapshots) != 9 {
		t.Errorf("snapshots: got %d, want 9", len(batch.Snapshots))
	}
	if len(batch.Settled) != 9 {
		t.Errorf("settled: got %d, want 9", len(batch.Settled))
	}

	want := []string{baseURL + "/perps/contracts", baseURL + "/perps/mark_prices"}
	got := append([]string(nil), doer.urls...)
	sort.Strings(got)
	if len(got) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(got), got, len(want))
	}
	for i, url := range want {
		eq(t, "request", got[i], url)
	}

	// A failed mark read leaves marks null for the cycle rather than dropping funding that already
	// arrived.
	degradedDoer := newDoer(t)
	degradedDoer.fail["/v1/perps/mark_prices"] = true
	degraded, err := newAdapter(degradedDoer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots degraded: %v", err)
	}
	if len(degraded.Snapshots) != 9 {
		t.Fatalf("degraded snapshots: got %d, want 9", len(degraded.Snapshots))
	}
	if degraded.Snapshots[0].MarkPrice != nil {
		t.Errorf("degraded markPrice: got %v, want nil", *degraded.Snapshots[0].MarkPrice)
	}
}

func TestFetchFundingHistoryAsksForTheWindowStopsShortAndTakesTheClassFromContracts(t *testing.T) {
	doer := newDoer(t)
	from := NEXT - 3*HOUR
	to := NEXT - HOUR - 1

	events, err := newAdapter(doer).FetchFundingHistory(context.Background(), "BTC-USD.P", from, to)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	// A short page ends the walk, so there is exactly one history call, then the contracts call the
	// class is read from.
	want := []string{
		fmt.Sprintf("%s/perps/funding_rate_history?market=BTC-USD.P&startTime=%d&endTime=%d&limit=1000",
			baseURL, from, to),
		baseURL + "/perps/contracts",
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, url := range want {
		eq(t, "request", doer.urls[i], url)
	}

	if len(events) != 2 {
		t.Fatalf("events: got %d, want 2", len(events))
	}
	eq(t, "events[0].rate", events[0].Rate, -0.0000177)
	eq(t, "events[1].rate", events[1].Rate, -0.000054)
	eq(t, "assetClass", events[0].AssetClass, core.ClassCrypto)
}
