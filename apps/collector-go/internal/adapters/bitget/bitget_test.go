package bitget

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

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Real rows captured 2026-09-13 ~22:06 UTC -- the same instant bitget.test.ts uses, so both suites
// pin identical output.
const NOW int64 = 1_789_337_181_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "bitget")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/bitget above the working directory")
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

// The SAME files packages/adapters/src/venues/bitget.test.ts reads.
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
// constant expression instead, `1.5424 * 76945.7` is folded at arbitrary precision and can land one
// ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

// book parses one of the two fixture books, exactly as the TypeScript `book()` helper does.
func book(tb testing.TB, category string) core.SnapshotBatch {
	tb.Helper()
	var instruments Envelope[Instrument]
	var tickers Envelope[Ticker]
	var fundRates Envelope[CurrentFundRate]
	load(tb, "instruments-"+category, &instruments)
	load(tb, "tickers-"+category, &tickers)
	load(tb, "current-fund-rate-"+category, &fundRates)

	batch, err := ParseSnapshots(instruments.Data, tickers, fundRates, NOW)
	if err != nil {
		tb.Fatalf("ParseSnapshots(%s): %v", category, err)
	}
	return batch
}

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	got := book(t, "usdt")
	if len(got.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(got.Settled))
	}

	btc := snapshotBySymbol(got.Snapshots, "BTCUSDT")
	if btc == nil {
		t.Fatal("BTCUSDT missing")
	}

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
	eq(t, "rate", btc.Rate, 0.00005)
	// HOURS, not seconds or minutes: `fundingRateInterval` is a plain 8.
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_344_000_000 {
		t.Errorf("nextFundingAt: got %v, want 1789344000000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76967.7)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76999.899)
	eq(t, "bestBid", f64(t, "bestBid", btc.BestBid), 76945.7)
	// Sizes are base coin, so depth is size x price: 1.5424 BTC is about $119k.
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", btc.BestBidSizeUSD), product(1.5424, 76945.7))
	eq(t, "bestAsk", f64(t, "bestAsk", btc.BestAsk), 76945.8)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", btc.BestAskSizeUSD), product(2.2675, 76945.8))
	// Base coin x mark: 35,917 BTC is $2.76bn.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(35917.05359999992, 76967.7))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 1051194916.75318)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 150)
}

func TestParseSnapshotsKeepsOnlinePerpetualsWithAFundingRowAndNothingElse(t *testing.T) {
	snapshots := book(t, "usdt").Snapshots

	// BGTESTMEUSDT is in current-fund-rate but has no instrument, so it never appears.
	want := []string{
		"BTCUSDT", "ETHUSDT", "SHIBUSDT", "PKXUSDT", "TSLAUSDT", "SP500USDT",
		"XAUUSDT", "PAXGUSDT", "CLUSDT", "EURUSDUSDT", "H100USDT",
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, symbol)
	}
}

func TestParseSnapshotsOpenInterestIsBaseCoinWhateverTheContractSize(t *testing.T) {
	// SHIBUSDT's quantityMultiplier is 10,000. Read as contracts this would be $96bn, not $9.6m.
	shib := snapshotBySymbol(book(t, "usdt").Snapshots, "SHIBUSDT")
	if shib == nil {
		t.Fatal("SHIBUSDT missing")
	}
	eq(t, "multiplier", shib.Multiplier, 1.0)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", shib.OpenInterestUSD),
		product(1860174806655, 0.000005184))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", shib.Volume24hUSD), 5659113.22571)
}

func TestParseSnapshotsReadsTheUSDCBooksDeclaration(t *testing.T) {
	snapshots := book(t, "usdc").Snapshots

	btc := snapshotBySymbol(snapshots, "BTCPERP")
	if btc == nil {
		t.Fatal("BTCPERP missing")
	}
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "rate", btc.Rate, 0.00004)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD),
		product(1361.4079000000003, 77015.2))

	bonk := snapshotBySymbol(snapshots, "1000BONKPERP")
	if bonk == nil {
		t.Fatal("1000BONKPERP missing")
	}
	eq(t, "base", bonk.Base, "BONK")
	eq(t, "quote", str(t, "quote", bonk.Quote), "USDC")
	eq(t, "multiplier", bonk.Multiplier, 1000.0)
	eq(t, "rate", bonk.Rate, -0.000015)
	eq(t, "basisHours", bonk.BasisHours, 4.0)
	eq(t, "intervalHours", f64(t, "intervalHours", bonk.IntervalHours), 4.0)
}

func TestParseSnapshotsCarriesEachInstrumentsDeclaredClass(t *testing.T) {
	want := map[string]string{
		"BTCUSDT":  "crypto:BTC",
		"ETHUSDT":  "crypto:ETH",
		"SHIBUSDT": "crypto:SHIB",
		"PKXUSDT":  "equity:PKX",
		"TSLAUSDT": "equity:TSLA",
		// Declared stock; the S&P 500 is an index by the shared table.
		"SP500USDT": "index:US500",
		"XAUUSDT":   "commodity:XAU",
		// Declared metal; a token, so MarketRefFor returns it to crypto.
		"PAXGUSDT": "crypto:PAXG",
		"CLUSDT":   "commodity:CL",
		// symbolType says crypto, isRwa says otherwise: the base tables settle which.
		"EURUSDUSDT": "fx:EURUSD",
		"H100USDT":   "index:H100",
	}

	snapshots := book(t, "usdt").Snapshots
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for _, s := range snapshots {
		eq(t, s.VenueSymbol, string(s.AssetClass)+":"+s.Base, want[s.VenueSymbol])
	}
}

func TestParseSnapshotsRejectsAnErrorEnvelope(t *testing.T) {
	_, err := ParseSnapshots(
		nil,
		Envelope[Ticker]{Code: "40034", Msg: "bad", Data: []Ticker{}},
		Envelope[CurrentFundRate]{Code: okCode, Msg: "success", Data: []CurrentFundRate{}},
		NOW,
	)
	if err == nil || !strings.Contains(err.Error(), "40034") {
		t.Errorf("error: got %v, want one naming 40034", err)
	}
}

func TestIsTradableRejectsAnythingThatIsNotAnOnlineLinearPerpetual(t *testing.T) {
	var instruments Envelope[Instrument]
	load(t, "instruments-usdt", &instruments)
	if len(instruments.Data) == 0 {
		t.Fatal("fixture")
	}
	btc := instruments.Data[0]

	eq(t, "online perpetual", IsTradable(btc), true)
	for _, c := range []struct {
		label  string
		mutate func(Instrument) Instrument
	}{
		{"status offline", func(i Instrument) Instrument { i.Status = "offline"; return i }},
		{"status limit_open", func(i Instrument) Instrument { i.Status = "limit_open"; return i }},
		{"type delivery", func(i Instrument) Instrument { i.Type = "delivery"; return i }},
		{"quote USD", func(i Instrument) Instrument { i.QuoteCoin = "USD"; return i }},
	} {
		eq(t, c.label, IsTradable(c.mutate(btc)), false)
	}
}

func TestAssetClassForIsRwaDecidesWhetherAndTheBaseTablesDecideWhich(t *testing.T) {
	eq(t, "crypto/NO/STX", AssetClassFor("crypto", "NO", "STX"), core.ClassCrypto)
	// Both fields absent: undeclared is crypto.
	eq(t, "absent/BTC", AssetClassFor("", "", "BTC"), core.ClassCrypto)
	eq(t, "stock/YES/CAT", AssetClassFor("stock", "YES", "CAT"), core.ClassEquity)
	eq(t, "metal/YES/XAU", AssetClassFor("metal", "YES", "XAU"), core.ClassCommodity)
	eq(t, "crypto/YES/USDJPY", AssetClassFor("crypto", "YES", "USDJPY"), core.ClassFX)
	eq(t, "crypto/YES/BHP", AssetClassFor("crypto", "YES", "BHP"), core.ClassEquity)
}

func TestAssetClassForUnknownSymbolTypeIsStillNotCrypto(t *testing.T) {
	eq(t, "bond/YES/US10Y", AssetClassFor("bond", "YES", "US10Y"), core.ClassIndex)
	eq(t, "forex/NO/EURUSD", AssetClassFor("forex", "NO", "EURUSD"), core.ClassFX)
}

func TestMarketRefForKeepsTheParsersReadingWhereItAgreesWithTheDeclaredBase(t *testing.T) {
	var instruments Envelope[Instrument]
	load(t, "instruments-usdt", &instruments)
	if len(instruments.Data) == 0 {
		t.Fatal("fixture")
	}

	for _, row := range instruments.Data {
		got := MarketRefFor(row)
		parsed := adapters.MarketRefFor(VenueID, row.Symbol, adapters.Overrides{})
		eq(t, row.Symbol+" venueId", got.VenueID, VenueID)
		eq(t, row.Symbol+" venueSymbol", got.VenueSymbol, row.Symbol)
		eq(t, row.Symbol+" base", got.Base, parsed.Base)
		eq(t, row.Symbol+" multiplier", got.Multiplier, parsed.Multiplier)
		if got.Dex != nil {
			t.Errorf("%s dex: got %v, want nil", row.Symbol, *got.Dex)
		}
	}
}

func historyItems(tb testing.TB) []FundingHistoryItem {
	tb.Helper()
	var env Envelope[FundingHistoryItem]
	load(tb, "history-fund-rate", &env)
	return env.Data
}

func historyRef() core.MarketRef {
	return adapters.MarketRefFor(VenueID, "BTCUSDT", adapters.Overrides{})
}

func TestParseFundingHistoryReturnsEventsOldestFirstWithTheInferredInterval(t *testing.T) {
	events := ParseFundingHistory(historyRef(), historyItems(t), 0, NOW, nil)

	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_257_600_000, 0.000091, 8},
		{1_789_286_400_000, 0.000082, 8},
		{1_789_315_200_000, 0.000076, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
}

func TestParseFundingHistoryCutsToTheWindowButInfersFromEveryRow(t *testing.T) {
	events := ParseFundingHistory(historyRef(), historyItems(t), 1_789_315_200_000, NOW, nil)
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTCUSDT")
	eq(t, "base", events[0].Base, "BTC")
	eq(t, "basisHours", events[0].BasisHours, 8.0)
}

func TestParseFundingHistoryALoneSettlementNeedsAFallbackInterval(t *testing.T) {
	one := historyItems(t)[:1]

	if events := ParseFundingHistory(historyRef(), one, 0, NOW, nil); len(events) != 0 {
		t.Errorf("events: got %d, want none without an interval to stand on", len(events))
	}

	fallback := 4.0
	events := ParseFundingHistory(historyRef(), one, 0, NOW, &fallback)
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}
	eq(t, "basisHours", events[0].BasisHours, 4.0)
}

// fixtureDoer answers each URL with the fixture whose key it contains, recording what was asked
// for. It is the Go seam for the fake HttpClient bitget.test.ts builds.
type fixtureDoer struct {
	urls      []string
	responses []struct {
		key  string
		body []byte
	}
}

func newFixtureDoer(tb testing.TB) *fixtureDoer {
	tb.Helper()
	doer := &fixtureDoer{}
	for _, r := range []struct{ key, fixture string }{
		{"instruments?category=USDT-FUTURES", "instruments-usdt"},
		{"instruments?category=USDC-FUTURES", "instruments-usdc"},
		{"tickers?category=USDT-FUTURES", "tickers-usdt"},
		{"tickers?category=USDC-FUTURES", "tickers-usdc"},
		{"current-fund-rate?category=USDT-FUTURES", "current-fund-rate-usdt"},
		{"current-fund-rate?category=USDC-FUTURES", "current-fund-rate-usdc"},
		{"history-fund-rate", "history-fund-rate"},
	} {
		doer.responses = append(doer.responses, struct {
			key  string
			body []byte
		}{r.key, fixtureBytes(tb, r.fixture)})
	}
	return doer
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	for _, r := range d.responses {
		if strings.Contains(requested, r.key) {
			return &http.Response{
				Status:     "200 OK",
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(bytes.NewReader(r.body)),
				Request:    req,
			}, nil
		}
	}
	return nil, fmt.Errorf("unexpected %s", requested)
}

func (d *fixtureDoer) matching(fragment string) []string {
	var out []string
	for _, u := range d.urls {
		if strings.Contains(u, fragment) {
			out = append(out, u)
		}
	}
	return out
}

func newTestAdapter(doer *fixtureDoer) *Adapter {
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsReadsBothBooksInBulkAndRefreshesInstrumentsHourly(t *testing.T) {
	doer := newFixtureDoer(t)
	adapter := newTestAdapter(doer)
	eq(t, "venueId", adapter.VenueID(), VenueID)

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(first.Snapshots) != 13 {
		t.Fatalf("snapshots: got %d, want 13", len(first.Snapshots))
	}

	want := []string{
		"https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES",
		"https://api.bitget.com/api/v3/market/instruments?category=USDC-FUTURES",
		"https://api.bitget.com/api/v3/market/tickers?category=USDT-FUTURES",
		"https://api.bitget.com/api/v3/market/current-fund-rate?category=USDT-FUTURES",
		"https://api.bitget.com/api/v3/market/tickers?category=USDC-FUTURES",
		"https://api.bitget.com/api/v3/market/current-fund-rate?category=USDC-FUTURES",
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, url := range want {
		eq(t, "request", doer.urls[i], url)
	}

	// Instruments only say what trades and what it is, so they are re-read hourly, not per cycle.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+59*60_000)); err != nil {
		t.Fatalf("FetchSnapshots at +59m: %v", err)
	}
	if got := doer.matching("instruments"); len(got) != 0 {
		t.Errorf("instruments requests at +59m: got %d, want none", len(got))
	}
	if len(doer.urls) != 4 {
		t.Errorf("requests at +59m: got %d (%v), want 4", len(doer.urls), doer.urls)
	}

	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60*60_000)); err != nil {
		t.Fatalf("FetchSnapshots at +60m: %v", err)
	}
	if got := doer.matching("instruments"); len(got) != 2 {
		t.Errorf("instruments requests at +60m: got %d, want 2", len(got))
	}
}

func TestFetchFundingHistoryAsksTheBookTheMarketWasSeenInAndCarriesItsIdentity(t *testing.T) {
	doer := newFixtureDoer(t)
	adapter := newTestAdapter(doer)
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	doer.urls = nil

	events, err := adapter.FetchFundingHistory(context.Background(), "BTCPERP", 0, NOW)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	// A short page is the last page.
	want := "https://api.bitget.com/api/v2/mix/market/history-fund-rate?symbol=BTCPERP&productType=usdc-futures&pageSize=100&pageNo=1"
	if len(doer.urls) != 1 || doer.urls[0] != want {
		t.Fatalf("requests: got %v, want exactly [%s]", doer.urls, want)
	}

	// The fixture rows are BTCUSDT's; the identity comes from the snapshot cycle, not the parser.
	if len(events) == 0 {
		t.Fatal("no events")
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTCPERP")
	eq(t, "base", events[0].Base, "BTC")
	eq(t, "quote", str(t, "quote", events[0].Quote), "USDC")
}
