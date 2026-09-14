package bluefin

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

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NOW is 2026-09-13T22:37:20Z, just after the tickers' updatedAtMillis, the same instant
// bluefin.test.ts uses, so the two suites pin identical output.
const NOW int64 = 1_789_339_040_000

// maxSafeInteger is JavaScript's Number.MAX_SAFE_INTEGER, the open-ended upper bound the TypeScript
// history test passes.
const maxSafeInteger int64 = 9_007_199_254_740_991

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files
// packages/adapters/src/venues/bluefin.test.ts reads: the port is verified against the exact bytes
// the original parser is pinned to, which is what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "bluefin")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/bluefin above the working directory")
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

func tickersFixture(tb testing.TB, name string) []Ticker {
	tb.Helper()
	var rows []Ticker
	loadFixture(tb, name, &rows)
	return rows
}

func historyFixture(tb testing.TB, name string) []FundingRow {
	tb.Helper()
	var rows []FundingRow
	loadFixture(tb, name, &rows)
	return rows
}

func infoFixture(tb testing.TB) ExchangeInfo {
	tb.Helper()
	var info ExchangeInfo
	loadFixture(tb, "exchange-info", &info)
	return info
}

func eq[T comparable](t *testing.T, label string, got, want T) {
	t.Helper()
	if got != want {
		t.Errorf("%s: got %v, want %v", label, got, want)
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

func nilf(t *testing.T, label string, got *float64) {
	t.Helper()
	if got != nil {
		t.Errorf("%s: got %v, want nil", label, *got)
	}
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

// num decodes a raw JSON token the way a venue field arrives, so E9 is exercised on exactly what the
// decoder produces rather than on a hand-built value.
func num(tb testing.TB, raw string) adapters.Num {
	tb.Helper()
	var n adapters.Num
	if err := n.UnmarshalJSON([]byte(raw)); err != nil {
		tb.Fatalf("decode %s: %v", raw, err)
	}
	return n
}

func TestParseTickersNormalizesBTCPERPFromE9FixedPoint(t *testing.T) {
	batch := ParseTickers(tickersFixture(t, "tickers"), infoFixture(t).Markets, NOW)

	got := snapshotBySymbol(batch.Snapshots, "BTC-PERP")
	if got == nil {
		t.Fatal("BTC-PERP missing from snapshots")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "venueSymbol", got.VenueSymbol, "BTC-PERP")
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDC")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	// The running estimate for the hour in progress, which is what settles.
	eq(t, "rate", got.Rate, 0.000014466)
	eq(t, "basisHours", got.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 1.0)
	if got.NextFundingAt == nil || *got.NextFundingAt != 1_789_340_400_000 {
		t.Errorf("nextFundingAt: got %v, want 1789340400000", got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 76784.5)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 76813.3)
	// openInterestE9 is USD notional already.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), 101969.816)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 226540.5836)

	// Bluefin's tickers publish no top of book in the shape this row carries, and no leverage.
	nilf(t, "bestBid", got.BestBid)
	nilf(t, "bestBidSizeUsd", got.BestBidSizeUSD)
	nilf(t, "bestAsk", got.BestAsk)
	nilf(t, "bestAskSizeUsd", got.BestAskSizeUSD)
	nilf(t, "maxLeverage", got.MaxLeverage)
}

func TestParseTickersCarriesTheLastSettledRateAtTheTopOfThePreviousHour(t *testing.T) {
	batch := ParseTickers(tickersFixture(t, "tickers"), infoFixture(t).Markets, NOW)

	got := eventBySymbol(batch.Settled, "BTC-PERP")
	if got == nil {
		t.Fatal("BTC-PERP missing from settled events")
	}
	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "venueSymbol", got.VenueSymbol, "BTC-PERP")
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDC")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "settledAt", got.SettledAt, int64(1_789_336_800_000))
	eq(t, "rate", got.Rate, 0.0000125)
	eq(t, "basisHours", got.BasisHours, 1.0)
	nilf(t, "markPrice", got.MarkPrice)

	// The same settlement as history's newest row, stamped 51ms past the hour.
	history := historyFixture(t, "fundingRateHistory-BTC-PERP")
	eq(t, "history[0].fundingRateE9", history[0].FundingRateE9.Val, 12500.0)
	eq(t, "history[0].fundingTimeAtMillis", int64(history[0].FundingTimeAtMillis.Val), int64(1_789_336_800_051))
}

func TestAnHourlySettlementIsAnnualisedAtHyperliquidsFloor(t *testing.T) {
	batch := ParseTickers(tickersFixture(t, "tickers"), infoFixture(t).Markets, NOW)
	btc := eventBySymbol(batch.Settled, "BTC-PERP")
	if btc == nil {
		t.Fatal("BTC-PERP missing from settled events")
	}

	// An hourly 0.0000125 settlement is 10.95% APR, Hyperliquid's floor. Tolerance rather than
	// equality: the TypeScript assertion is toBeCloseTo(10.95, 2).
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	if math.Abs(apr-10.95) > 0.005 {
		t.Errorf("apr: got %v, want 10.95", apr)
	}
}

func TestParseTickersKeepsOnlyActiveMarketsAndDeclaresThemCrypto(t *testing.T) {
	tickers := tickersFixture(t, "tickers")
	info := infoFixture(t)

	batch := ParseTickers(tickers, info.Markets, NOW)
	want := [][3]string{
		{"BTC-PERP", "BTC", "crypto"},
		{"DEEP-PERP", "DEEP", "crypto"},
		{"ETH-PERP", "ETH", "crypto"},
		// Bluefin declares no class, so GOLD stays crypto (and out of the commodity XAU pool).
		{"GOLD-PERP", "XAU", "crypto"},
	}
	if len(batch.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(batch.Snapshots), len(want))
	}
	for i, w := range want {
		got := batch.Snapshots[i]
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), got.VenueSymbol, w[0])
		eq(t, fmt.Sprintf("snapshot[%d].base", i), got.Base, w[1])
		eq(t, fmt.Sprintf("snapshot[%d].assetClass", i), string(got.AssetClass), w[2])
	}

	halted := make([]MarketInfo, 0, len(info.Markets))
	for _, market := range info.Markets {
		if market.Symbol == "DEEP-PERP" {
			market.Status = "DELISTED"
		}
		halted = append(halted, market)
	}
	if snapshotBySymbol(ParseTickers(tickers, halted, NOW).Snapshots, "DEEP-PERP") != nil {
		t.Error("DEEP-PERP is DELISTED but was collected")
	}

	if got := ParseTickers(tickers, nil, NOW); len(got.Snapshots) != 0 {
		t.Errorf("with no exchange info: got %d snapshots, want 0", len(got.Snapshots))
	}
}

func TestE9FixedPoint(t *testing.T) {
	eq(t, `e9("76784500000000")`, f64(t, "mark", E9(num(t, `"76784500000000"`))), 76784.5)
	eq(t, `e9("-17938")`, f64(t, "rate", E9(num(t, `"-17938"`))), -0.000017938)
	nilf(t, "e9(null)", E9(num(t, `null`)))
}

func TestParseFundingHistoryOldestFirstSnappedToTheHour(t *testing.T) {
	events := ParseFundingHistory(
		historyFixture(t, "fundingRateHistory-BTC-PERP"), "BTC-PERP", 0, maxSafeInteger,
	)

	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
	}{
		{1_789_322_400_000, 0.0000125, 1},
		{1_789_326_000_000, 0.0000125, 1},
		{1_789_329_600_000, 0.0000125, 1},
		{1_789_333_200_000, 0.0000125, 1},
		{1_789_336_800_000, 0.0000125, 1},
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
	eq(t, "event[0].venueSymbol", events[0].VenueSymbol, "BTC-PERP")
	eq(t, "event[0].base", events[0].Base, "BTC")
}

// fakeDoer answers by URL, recording every request so the tests can assert what was actually asked
// for — which is the whole point for the hourly info cache and for the history window.
type fakeDoer struct {
	body func(url string) []byte
	urls []string
}

func (f *fakeDoer) Do(req *http.Request) (*http.Response, error) {
	full := req.URL.String()
	f.urls = append(f.urls, full)
	body := f.body(full)
	if body == nil {
		return &http.Response{
			StatusCode: http.StatusNotFound,
			Body:       io.NopCloser(strings.NewReader("no fixture for " + full)),
			Header:     http.Header{},
		}, nil
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     http.Header{},
	}, nil
}

func fixtureDoer(tb testing.TB) *fakeDoer {
	tb.Helper()
	info := fixtureBytes(tb, "exchange-info")
	tickers := fixtureBytes(tb, "tickers")
	history := fixtureBytes(tb, "fundingRateHistory-BTC-PERP")
	return &fakeDoer{body: func(url string) []byte {
		switch {
		case strings.HasSuffix(url, "/exchange/info"):
			return info
		case strings.HasSuffix(url, "/exchange/tickers"):
			return tickers
		case strings.Contains(url, "/exchange/fundingRateHistory?"):
			return history
		}
		return nil
	}}
}

func TestAdapterFetchesExchangeInfoOnceAnHourAndTickersEveryCycle(t *testing.T) {
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

	want := []string{
		API + "/exchange/info",
		API + "/exchange/tickers",
		API + "/exchange/tickers",
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", doer.urls, want)
	}
	for i, url := range want {
		eq(t, fmt.Sprintf("url[%d]", i), doer.urls[i], url)
	}

	if len(batch.Snapshots) != 4 {
		t.Errorf("snapshots: got %d, want 4", len(batch.Snapshots))
	}
	if len(batch.Settled) != 4 {
		t.Errorf("settled: got %d, want 4", len(batch.Settled))
	}
	eq(t, "requestCount", adapter.RequestCount(), 3)
	eq(t, "venueId", adapter.VenueID(), "bluefin")
}

func TestAdapterRejectsANonListBody(t *testing.T) {
	doer := &fakeDoer{body: func(url string) []byte {
		if strings.HasSuffix(url, "/exchange/info") {
			return []byte(`{}`)
		}
		return []byte(`[]`)
	}}
	_, err := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer})).
		FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("want an error for an exchange/info body with no markets, got nil")
	}
	eq(t, "error", err.Error(), "bluefin: unexpected exchange/info")
}

func TestAdapterWidensTheHistoryWindowByAnHourEachSideAndFiltersBackToIt(t *testing.T) {
	doer := fixtureDoer(t)
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer}))

	events, err := adapter.FetchFundingHistory(
		context.Background(), "BTC-PERP", 1_789_326_000_000, 1_789_337_000_000,
	)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	want := API + "/exchange/fundingRateHistory?symbol=BTC-PERP" +
		"&startTimeAtMillis=1789322400000&endTimeAtMillis=1789340600000&limit=1000&page=1"
	if len(doer.urls) != 1 || doer.urls[0] != want {
		t.Fatalf("urls: got %v, want [%s]", doer.urls, want)
	}

	wantSettled := []int64{
		1_789_326_000_000, 1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000,
	}
	if len(events) != len(wantSettled) {
		t.Fatalf("events: got %d, want %d", len(events), len(wantSettled))
	}
	for i, at := range wantSettled {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, at)
	}
}

func TestAdapterPagesHistoryWhilePagesAreFull(t *testing.T) {
	const hour = int64(3_600_000)
	const top = int64(1_789_336_800_000)

	// Built as raw JSON rather than by marshalling FundingRow: the rows have to travel the same
	// decode path the venue's own bytes do, hourly and newest first, 51ms past each hour.
	page := func(newest int64, count int) []byte {
		rows := make([]string, 0, count)
		for i := 0; i < count; i++ {
			rows = append(rows, fmt.Sprintf(
				`{"symbol":"BTC-PERP","fundingRateE9":"12500","fundingTimeAtMillis":%d}`,
				newest-int64(i)*hour+51,
			))
		}
		return []byte("[" + strings.Join(rows, ",") + "]")
	}

	full := page(top, historyPageSize)
	tail := page(top-int64(historyPageSize)*hour, 4)
	doer := &fakeDoer{body: func(url string) []byte {
		if strings.HasSuffix(url, "page=1") {
			return full
		}
		return tail
	}}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer}))

	events, err := adapter.FetchFundingHistory(
		context.Background(), "BTC-PERP", top-1003*hour, top,
	)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	if len(doer.urls) != 2 {
		t.Fatalf("urls: got %d, want 2", len(doer.urls))
	}
	if !strings.Contains(doer.urls[1], "page=2") {
		t.Errorf("url[1]: got %s, want page=2", doer.urls[1])
	}
	if len(events) != 1004 {
		t.Errorf("events: got %d, want 1004", len(events))
	}
}

// The 23:00 settlement on 2026-09-13: what settles is the estimate, so the estimate is the predicted
// rate. estimatedFundingRateE9 read at 22:59:33, the last poll before the hour.
var estimateAt2259 = map[string]float64{"ETH-PERP": 143739, "DEEP-PERP": 428114, "GOLD-PERP": 241585}

func TestWhatSettlesIsTheEstimate(t *testing.T) {
	batch := ParseTickers(
		tickersFixture(t, "tickers-after-2300"), infoFixture(t).Markets, 1_789_340_538_000,
	)

	for symbol, estimate := range estimateAt2259 {
		event := eventBySymbol(batch.Settled, symbol)
		if event == nil {
			t.Fatalf("%s missing from settled events", symbol)
		}
		eq(t, symbol+".settledAt", event.SettledAt, int64(1_789_340_400_000))
		// Within 2% of the estimate one minute earlier: ETH 142061, DEEP 426068, GOLD 238732.
		if drift := math.Abs(event.Rate*1e9-estimate) / estimate; drift >= 0.02 {
			t.Errorf("%s: settled %v drifted %v from the 22:59 estimate %v",
				symbol, event.Rate, drift, estimate)
		}
	}
}

func TestTheTickersSettledEventAndHistorysRowAreOneSettlement(t *testing.T) {
	batch := ParseTickers(
		tickersFixture(t, "tickers-after-2300"), infoFixture(t).Markets, 1_789_340_538_000,
	)
	fromTicker := eventBySymbol(batch.Settled, "ETH-PERP")
	if fromTicker == nil {
		t.Fatal("ETH-PERP missing from settled events")
	}

	// History's row is stamped 2.48s past the hour; both snap to 23:00:00.000, so the settlement is
	// one row and not two.
	fromHistory := ParseFundingHistory(
		historyFixture(t, "fundingRateHistory-ETH-PERP-after-2300"), "ETH-PERP",
		1_789_340_000_000, 1_789_341_000_000,
	)
	if len(fromHistory) != 1 {
		t.Fatalf("history events: got %d, want 1", len(fromHistory))
	}

	got := fromHistory[0]
	eq(t, "venueId", got.VenueID, fromTicker.VenueID)
	eq(t, "venueSymbol", got.VenueSymbol, fromTicker.VenueSymbol)
	eq(t, "base", got.Base, fromTicker.Base)
	eq(t, "quote", str(t, "quote", got.Quote), str(t, "quote", fromTicker.Quote))
	eq(t, "multiplier", got.Multiplier, fromTicker.Multiplier)
	eq(t, "assetClass", got.AssetClass, fromTicker.AssetClass)
	eq(t, "settledAt", got.SettledAt, fromTicker.SettledAt)
	eq(t, "rate", got.Rate, fromTicker.Rate)
	eq(t, "basisHours", got.BasisHours, fromTicker.BasisHours)
	nilf(t, "markPrice", got.MarkPrice)
	eq(t, "rate", got.Rate, 0.000142061)
}
