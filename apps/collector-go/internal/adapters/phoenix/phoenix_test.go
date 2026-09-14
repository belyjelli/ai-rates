package phoenix

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

// The same instants phoenix.test.ts uses, so both suites pin identical output.
const (
	NOW       int64 = 1_789_338_960_000 // 2026-09-13T22:36:00Z
	SettledAt int64 = 1_789_336_801_000 // 22:00:01Z, the newest hourly point
	day       int64 = 24 * 3_600_000
)

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "phoenix")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/phoenix above the working directory")
	return ""
}

// fixtureBytes is one of the SAME files packages/adapters/src/venues/phoenix.test.ts reads.
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
// constant expression instead, the same factors are folded at arbitrary precision and can land one
// ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

// quotient divides at runtime, for the same reason: `0.42 / 77334` as a constant expression is not
// the float64 division the parser performs.
func quotient(numerator, denominator float64) float64 {
	return numerator / denominator
}

func markets(tb testing.TB) []Market {
	tb.Helper()
	var out []Market
	load(tb, "markets", &out)
	return out
}

func overviewSeries(tb testing.TB) []OverviewSeries {
	tb.Helper()
	var body struct {
		Series []OverviewSeries `json:"series"`
	}
	load(tb, "funding-overview", &body)
	return body.Series
}

func candles(tb testing.TB) []Candle {
	tb.Helper()
	var out []Candle
	load(tb, "candles-BTC-1h", &out)
	return out
}

func ratePoints(tb testing.TB) []RatePoint {
	tb.Helper()
	var body struct {
		Rates []RatePoint `json:"rates"`
	}
	load(tb, "rates-BTC", &body)
	return body.Rates
}

func marketNamed(tb testing.TB, symbol string) Market {
	tb.Helper()
	for _, market := range markets(tb) {
		if market.Symbol == symbol {
			return market
		}
	}
	tb.Fatalf("market %s missing from the fixture", symbol)
	return Market{}
}

func seriesNamed(tb testing.TB, series []OverviewSeries, symbol string) OverviewSeries {
	tb.Helper()
	for _, s := range series {
		if s.Symbol == symbol {
			return s
		}
	}
	tb.Fatalf("series %s missing from the fixture", symbol)
	return OverviewSeries{}
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

// decodeJSON builds wire structs from raw JSON text. adapters.Num and Timestamp have no
// MarshalJSON, so a struct holding one cannot be round-tripped and synthetic cases must be written
// as JSON in the first place.
func decodeJSON[T any](tb testing.TB, raw string) T {
	tb.Helper()
	var out T
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		tb.Fatalf("decode %s: %v", raw, err)
	}
	return out
}

func btcVolumes() map[string]VolumeEntry {
	volume := 1_721_084.7171
	return map[string]VolumeEntry{"BTC": {VolumeUSD: &volume, FetchedAt: NOW}}
}

func TestParseSnapshotsNormalizesBTC(t *testing.T) {
	batch := ParseSnapshots(markets(t), overviewSeries(t), btcVolumes(), NOW)

	btc := snapshotBySymbol(batch.Snapshots, "BTC")
	if btc == nil {
		t.Fatal("BTC missing")
	}

	// The hour just settled, amount over mark, OI from base lots.
	wantRate := quotient(0.42, 77334)
	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, wantRate)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	// 23:00Z, one interval after fundingStartIntervalTimestamp.
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", btc.NextFundingAt), 1_789_340_400_000)
	eq(t, "kind", btc.Kind, core.KindSettled)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77334.0)
	if btc.IndexPrice != nil {
		t.Errorf("indexPrice: got %v, want nil", *btc.IndexPrice)
	}
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD),
		product(quotient(298_911, 10_000), 77334))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 1_721_084.7171)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 40.0)

	// The same point is also returned as a settled event, because it IS the settlement.
	event := eventBySymbol(batch.Settled, "BTC")
	if event == nil {
		t.Fatal("BTC settled event missing")
	}
	eq(t, "settled venueId", event.VenueID, VenueID)
	eq(t, "settled base", event.Base, "BTC")
	eq(t, "settled quote", str(t, "settled quote", event.Quote), "USDC")
	eq(t, "settled multiplier", event.Multiplier, 1.0)
	eq(t, "settled assetClass", event.AssetClass, core.ClassCrypto)
	if event.Dex != nil {
		t.Errorf("settled dex: got %v, want nil", *event.Dex)
	}
	eq(t, "settledAt", event.SettledAt, SettledAt)
	eq(t, "settled rate", event.Rate, wantRate)
	eq(t, "settled basisHours", event.BasisHours, 1.0)
	eq(t, "settled markPrice", f64(t, "settled markPrice", event.MarkPrice), 77334.0)
}

func TestParseSnapshotsScaleIsOneHundredthOfTheHistoryPercentage(t *testing.T) {
	series := overviewSeries(t)
	batch := ParseSnapshots(markets(t), series, btcVolumes(), NOW)

	btc := snapshotBySymbol(batch.Snapshots, "BTC")
	if btc == nil {
		t.Fatal("BTC missing")
	}

	// The independent rates history reports 100x the amount-over-mark ratio.
	var history *RatePoint
	rows := ratePoints(t)
	for i := range rows {
		if at := TimeMs(rows[i].Timestamp); at != nil && *at == SettledAt {
			history = &rows[i]
		}
	}
	if history == nil {
		t.Fatal("no history row at the settlement")
	}
	closeTo(t, "rate against the history percentage", btc.Rate, quotient(history.FundingRatePercentage.Val, 100), 5e-9)

	// fundingRate is 1e4x the rate here (tick 100) and 100x on AAPL (tick 10), which is why it is
	// never read.
	btcPoint := seriesNamed(t, series, "BTC").Points[0]
	closeTo(t, "BTC fundingRate ratio", quotient(btcPoint.FundingRate.Val, btc.Rate), 1e4, 0.5)

	aapl := snapshotBySymbol(batch.Snapshots, "AAPL")
	if aapl == nil {
		t.Fatal("AAPL missing")
	}
	aaplPoint := seriesNamed(t, series, "AAPL").Points[0]
	closeTo(t, "AAPL fundingRate ratio", quotient(aaplPoint.FundingRate.Val, aapl.Rate), 100, 0.05)

	// Hourly, and the same order as Hyperliquid's 1.25e-5/h for BTC that hour.
	if !(btc.Rate > 1e-6) || !(btc.Rate < 1e-4) {
		t.Errorf("rate %v: want between 1e-6 and 1e-4", btc.Rate)
	}
}

func TestParseSnapshotsCarriesTheDeclaredClassAndQuote(t *testing.T) {
	batch := ParseSnapshots(markets(t), overviewSeries(t), btcVolumes(), NOW)

	// Markets order, class from the real-world flag and trading calendar, GOLD reaching XAU.
	want := [][4]string{
		{"AAPL", "AAPL", "equity", "USDC"},
		{"XRP", "XRP", "crypto", "USDC"},
		{"SPY", "SPY", "equity", "USDC"},
		{"ETH", "ETH", "crypto", "USDC"},
		{"BTC", "BTC", "crypto", "USDC"},
		{"GOLD", "XAU", "commodity", "USDC"},
	}
	if len(batch.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(batch.Snapshots), len(want))
	}
	for i, w := range want {
		got := batch.Snapshots[i]
		eq(t, "venueSymbol", got.VenueSymbol, w[0])
		eq(t, w[0]+" base", got.Base, w[1])
		eq(t, w[0]+" assetClass", string(got.AssetClass), w[2])
		eq(t, w[0]+" quote", str(t, w[0]+" quote", got.Quote), w[3])
	}
	if len(batch.Settled) != 6 {
		t.Errorf("settled: got %d, want 6", len(batch.Settled))
	}

	// Every market publishes a mark for the identity gate.
	for _, s := range batch.Snapshots {
		if s.MarkPrice == nil || *s.MarkPrice <= 0 {
			t.Errorf("%s: want a positive mark", s.VenueSymbol)
		}
	}

	// A zero payment is a zero rate, not a missing one.
	xrp := snapshotBySymbol(batch.Snapshots, "XRP")
	if xrp == nil {
		t.Fatal("XRP missing")
	}
	eq(t, "XRP rate", xrp.Rate, 0.0)
}

func TestParseSnapshotsSkipsInactiveMissingAndZeroMarkMarkets(t *testing.T) {
	series := overviewSeries(t)

	symbols := func(m []Market, s []OverviewSeries) []string {
		var out []string
		for _, snapshot := range ParseSnapshots(m, s, map[string]VolumeEntry{}, NOW).Snapshots {
			out = append(out, snapshot.VenueSymbol)
		}
		return out
	}
	contains := func(list []string, symbol string) bool {
		for _, s := range list {
			if s == symbol {
				return true
			}
		}
		return false
	}

	paused := markets(t)
	for i := range paused {
		if paused[i].Symbol == "ETH" {
			paused[i].MarketStatus = "paused"
		}
	}
	if contains(symbols(paused, series), "ETH") {
		t.Error("a paused market must not be emitted")
	}

	var noPoint []OverviewSeries
	for _, s := range series {
		if s.Symbol != "SPY" {
			noPoint = append(noPoint, s)
		}
	}
	if contains(symbols(markets(t), noPoint), "SPY") {
		t.Error("a market with no recent point must not be emitted")
	}

	zeroMark := make([]OverviewSeries, len(series))
	copy(zeroMark, series)
	for i := range zeroMark {
		if zeroMark[i].Symbol == "AAPL" {
			// The fixture's own AAPL point with its mark replaced by zero. Written as raw JSON
			// because adapters.Num and Timestamp have no MarshalJSON to round-trip through.
			zeroMark[i].Points = []OverviewPoint{decodeJSON[OverviewPoint](t,
				`{"timestamp":1789336801,"fundingAmountPerUnit":"-0.001000000000","markPrice":"0"}`)}
		}
	}
	if contains(symbols(markets(t), zeroMark), "AAPL") {
		t.Error("a market whose mark is zero must not be emitted")
	}
}

func TestParseSnapshotsNegativeBaseLotDecimalsMultiply(t *testing.T) {
	// PUMP's -2: the exponent multiplies rather than divides.
	pumpLike := marketNamed(t, "BTC")
	pumpLike.BaseLotsDecimals = -2

	batch := ParseSnapshots([]Market{pumpLike}, overviewSeries(t), map[string]VolumeEntry{}, NOW)
	if len(batch.Snapshots) != 1 {
		t.Fatalf("snapshots: got %d, want 1", len(batch.Snapshots))
	}
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", batch.Snapshots[0].OpenInterestUSD),
		product(298_911, 100, 77334))
	if batch.Snapshots[0].Volume24hUSD != nil {
		t.Errorf("volume24hUsd: got %v, want nil with no cached volume", *batch.Snapshots[0].Volume24hUSD)
	}
}

func TestTimeMsReadsSecondsStringsAndISO(t *testing.T) {
	timestampOf := func(raw string) Timestamp {
		return decodeJSON[Timestamp](t, raw)
	}

	eq(t, "unix seconds", i64(t, "unix seconds", TimeMs(timestampOf("1789336801"))), SettledAt)
	eq(t, "numeric string", i64(t, "numeric string", TimeMs(timestampOf(`"1789336800"`))), 1_789_336_800_000)
	eq(t, "ISO date-time", i64(t, "ISO date-time", TimeMs(timestampOf(`"2026-09-13T22:00:01Z"`))), SettledAt)
	if got := TimeMs(timestampOf("null")); got != nil {
		t.Errorf("null: got %v, want nil", *got)
	}
	if got := TimeMs(timestampOf(`"not a time"`)); got != nil {
		t.Errorf("unparseable: got %v, want nil", *got)
	}
}

func TestPointRateNeedsAPositiveMark(t *testing.T) {
	negative := decodeJSON[OverviewPoint](t,
		`{"timestamp":1,"fundingAmountPerUnit":"-0.041","markPrice":"4345.8"}`)
	eq(t, "negative rate", f64(t, "negative rate", PointRate(negative)), quotient(-0.041, 4345.8))

	zeroMark := decodeJSON[OverviewPoint](t,
		`{"timestamp":1,"fundingAmountPerUnit":"1","markPrice":"0"}`)
	if got := PointRate(zeroMark); got != nil {
		t.Errorf("zero mark: got %v, want nil", *got)
	}
}

func TestVolume24hSumsTheClosedHoursBeforeTheCurrentOne(t *testing.T) {
	rows := candles(t)
	closeTo(t, "24h volume", Volume24h(rows, NOW), 1_721_084.7171, 5e-4)

	// An hour later the oldest candle falls out and nothing replaces it in this response.
	oldest := rows[0].VolumeQuote.Val
	closeTo(t, "an hour later", Volume24h(rows, NOW+3_600_000), 1_721_084.7171-oldest, 5e-4)

	eq(t, "no candles", Volume24h(nil, NOW), 0.0)
}

func TestAssetClassForReadsTheFlagThenTheCalendar(t *testing.T) {
	btc := marketNamed(t, "BTC")
	rwa := func(calendar string, hasCalendar bool) Market {
		market := btc
		market.CommodityMetadata = CommodityMetadata{IsCommodity: true}
		market.Metadata = Metadata{}
		if hasCalendar {
			market.Metadata.Calendar.ID = calendar
		}
		return market
	}

	// No flag is crypto, whether the flag is absent or explicitly false.
	eq(t, "unflagged", AssetClassFor(btc, "BTC"), core.ClassCrypto)
	notCommodity := btc
	notCommodity.CommodityMetadata = CommodityMetadata{IsCommodity: false}
	eq(t, "flag false", AssetClassFor(notCommodity, "X"), core.ClassCrypto)

	// The calendar decides which kind of real-world asset it is.
	eq(t, "us_equities_extended", AssetClassFor(rwa("us_equities_extended", true), "AAPL"), core.ClassEquity)
	eq(t, "cme_commodities", AssetClassFor(rwa("cme_commodities", true), "WTIOIL"), core.ClassCommodity)
	// An unknown or absent calendar falls to the shared base tables.
	eq(t, "fx_24_5", AssetClassFor(rwa("fx_24_5", true), "EUR"), core.ClassFX)
	eq(t, "no calendar", AssetClassFor(rwa("", false), "US500"), core.ClassIndex)
}

func TestParseRatesTurnsPercentPerHourIntoAFractionOldestFirst(t *testing.T) {
	rows := ratePoints(t)
	// Reversed on the way in, to prove the ordering is the parser's and not the venue's.
	reversed := make([]RatePoint, len(rows))
	for i, row := range rows {
		reversed[len(rows)-1-i] = row
	}

	from := int64(1_789_322_400_000)
	events := ParseRates(marketNamed(t, "BTC"), reversed, from, SettledAt)

	type want struct {
		at    int64
		rate  float64
		basis float64
	}
	var expected []want
	for _, row := range rows {
		at := TimeMs(row.Timestamp)
		if at == nil || *at < from {
			continue
		}
		expected = append(expected, want{at: *at, rate: quotient(row.FundingRatePercentage.Val, 100), basis: 1})
	}
	if len(events) != len(expected) {
		t.Fatalf("events: got %d, want %d", len(events), len(expected))
	}
	for i, w := range expected {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}

	eq(t, "base", events[0].Base, "BTC")
	eq(t, "quote", str(t, "quote", events[0].Quote), "USDC")
	eq(t, "assetClass", events[0].AssetClass, core.ClassCrypto)
}

// routeDoer answers each URL from a route function and records what was asked for, the Go seam for
// the fake HttpClient phoenix.test.ts builds.
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

// bulkRoute serves the markets, overview and candle fixtures, which is every call a cycle makes.
func bulkRoute(tb testing.TB) func(string) []byte {
	tb.Helper()
	marketsBody := fixtureBytes(tb, "markets")
	overviewBody := fixtureBytes(tb, "funding-overview")
	candlesBody := fixtureBytes(tb, "candles-BTC-1h")
	return func(requested string) []byte {
		switch {
		case strings.HasSuffix(requested, "/view/exchange/markets"):
			return marketsBody
		case strings.Contains(requested, "/funding/overview"):
			return overviewBody
		case strings.Contains(requested, "/candles/"):
			return candlesBody
		}
		tb.Fatalf("unexpected %s", requested)
		return nil
	}
}

// newTestAdapter wires an adapter to a route. MaxRetries is negative for exactly one attempt per
// call, so the recorded URLs are the cycle's own.
func newTestAdapter(doer *routeDoer, budget int) *Adapter {
	return NewAdapterWithOptions(
		httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}),
		Options{VolumeRefreshBudget: &budget},
	)
}

func wantURLs(tb testing.TB, label string, got, want []string) {
	tb.Helper()
	if len(got) != len(want) {
		tb.Fatalf("%s: got %d urls %v, want %d %v", label, len(got), got, len(want), want)
	}
	for i := range want {
		eq(tb, label, got[i], want[i])
	}
}

func TestFetchSnapshotsRotatesABudgetedSliceOfCandles(t *testing.T) {
	doer := &routeDoer{route: bulkRoute(t)}
	adapter := newTestAdapter(doer, 4)
	ctx := context.Background()

	// Two bulk calls a cycle, then a budgeted slice of candles.
	first, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	wantURLs(t, "first cycle", doer.urls, []string{
		API + "/view/exchange/markets",
		overviewURL(NOW),
		candlesURL("AAPL"),
		candlesURL("XRP"),
		candlesURL("SPY"),
		candlesURL("ETH"),
	})
	if len(first.Snapshots) != 6 {
		t.Fatalf("snapshots: got %d, want 6", len(first.Snapshots))
	}
	eth := snapshotBySymbol(first.Snapshots, "ETH")
	if eth == nil {
		t.Fatal("ETH missing")
	}
	closeTo(t, "ETH volume", f64(t, "ETH volume", eth.Volume24hUSD), 1_721_084.7171, 5e-4)
	btc := snapshotBySymbol(first.Snapshots, "BTC")
	if btc == nil {
		t.Fatal("BTC missing")
	}
	if btc.Volume24hUSD != nil {
		t.Errorf("BTC volume: got %v, want nil before its turn", *btc.Volume24hUSD)
	}

	// The next cycle picks up where the rotation left off.
	doer.urls = nil
	next := NOW + 60_000
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(next)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	wantURLs(t, "second cycle", doer.urls, []string{
		API + "/view/exchange/markets",
		overviewURL(next),
		candlesURL("BTC"),
		candlesURL("GOLD"),
	})

	// Every volume is fresh, so a cycle costs the two bulk calls and nothing else.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+120_000)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(doer.urls) != 2 {
		t.Fatalf("third cycle: got %d urls %v, want 2", len(doer.urls), doer.urls)
	}

	// At the max age the first four fall due again, oldest first.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+VolumeMaxAgeMs)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	wantURLs(t, "fourth cycle", doer.urls[2:], []string{
		candlesURL("AAPL"),
		candlesURL("XRP"),
		candlesURL("SPY"),
		candlesURL("ETH"),
	})

	if MinInterval < 1000*time.Millisecond {
		t.Errorf("MinInterval %v: want at least 1s", MinInterval)
	}
}

func TestFetchSnapshotsFailsOnAThrottledBulkCallButNotAThrottledCandle(t *testing.T) {
	ctx := context.Background()
	bulk := bulkRoute(t)
	throttled := []byte(`{"error":"rate_limited"}`)

	// A throttled bulk call fails the cycle: parsed as data it is an empty venue.
	overviewThrottled := &routeDoer{route: func(requested string) []byte {
		if strings.Contains(requested, "/funding/overview") {
			return throttled
		}
		return bulk(requested)
	}}
	_, err := newTestAdapter(overviewThrottled, VolumeRefreshBudget).FetchSnapshots(ctx, time.UnixMilli(NOW))
	if err == nil || !strings.Contains(err.Error(), "rate_limited") {
		t.Fatalf("overview: got %v, want a rate_limited failure", err)
	}

	// A failed candle call only loses that volume.
	candlesThrottled := &routeDoer{route: func(requested string) []byte {
		if strings.Contains(requested, "/candles/") {
			return throttled
		}
		return bulk(requested)
	}}
	batch, err := newTestAdapter(candlesThrottled, VolumeRefreshBudget).FetchSnapshots(ctx, time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(batch.Snapshots) != 6 {
		t.Fatalf("snapshots: got %d, want 6", len(batch.Snapshots))
	}
	for _, s := range batch.Snapshots {
		if s.Volume24hUSD != nil {
			t.Errorf("%s volume: got %v, want nil", s.VenueSymbol, *s.Volume24hUSD)
		}
	}
}

func TestFetchFundingHistoryReadsTheMarketOnceThenWalksWindowsUnderAYear(t *testing.T) {
	// The venue answers the per-market lookup with the market object itself, so the fixture's own
	// GOLD row is served verbatim.
	marketBody := func() []byte {
		var raw []json.RawMessage
		load(t, "markets", &raw)
		for _, row := range raw {
			var named struct {
				Symbol string `json:"symbol"`
			}
			if err := json.Unmarshal(row, &named); err == nil && named.Symbol == "GOLD" {
				return row
			}
		}
		t.Fatal("GOLD missing from the markets fixture")
		return nil
	}()
	ratesBody := []byte(`{"marketId":65556,"symbol":"GOLD","rates":[{"timestamp":1789336801,"fundingRatePercentage":"-0.000943"}]}`)

	doer := &routeDoer{route: func(requested string) []byte {
		if strings.Contains(requested, "/view/exchange/market/") {
			return marketBody
		}
		return ratesBody
	}}
	adapter := newTestAdapter(doer, VolumeRefreshBudget)
	ctx := context.Background()

	from := SettledAt - 400*day
	events, err := adapter.FetchFundingHistory(ctx, "GOLD", from, SettledAt)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	split := from + 300*day
	wantURLs(t, "history", doer.urls, []string{
		API + "/view/exchange/market/GOLD",
		fmt.Sprintf("%s/funding/GOLD/rates?startTime=%d&endTime=%d&limit=10000", API, from, split),
		fmt.Sprintf("%s/funding/GOLD/rates?startTime=%d&endTime=%d&limit=10000", API, split+1, SettledAt),
	})

	// The same settlement served by both windows is one event.
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "GOLD")
	eq(t, "base", events[0].Base, "XAU")
	eq(t, "assetClass", events[0].AssetClass, core.ClassCommodity)
	eq(t, "quote", str(t, "quote", events[0].Quote), "USDC")
	eq(t, "settledAt", events[0].SettledAt, SettledAt)
	eq(t, "basisHours", events[0].BasisHours, 1.0)
	if events[0].MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *events[0].MarkPrice)
	}
	closeTo(t, "rate", events[0].Rate, quotient(-0.000943, 100), 5e-13)

	// The market is remembered, so a second window costs only the rates call.
	doer.urls = nil
	if _, err := adapter.FetchFundingHistory(ctx, "GOLD", SettledAt-day, SettledAt); err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	wantURLs(t, "second history", doer.urls, []string{
		fmt.Sprintf("%s/funding/GOLD/rates?startTime=%d&endTime=%d&limit=10000", API, SettledAt-day, SettledAt),
	})
}
