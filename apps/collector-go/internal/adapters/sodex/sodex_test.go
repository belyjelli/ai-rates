package sodex

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

// NOW and NEXT are the same instants sodex.test.ts uses, so the two suites pin identical output.
const (
	NOW  int64 = 1_789_337_554_584
	NEXT int64 = 1_789_340_400_000
)

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files
// packages/adapters/src/venues/sodex.test.ts reads — real responses from SoDEX on 2026-09-14 (22:12
// UTC), trimmed to nine markets, two of them HALT — so the port is verified against the exact bytes
// the original parser is pinned to.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "sodex")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/sodex above the working directory")
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

// fixtures decodes both responses the adapter joins.
func fixtures(tb testing.TB) ([]Ticker, []Symbol) {
	tb.Helper()
	var tickers Response[Ticker]
	var symbols Response[Symbol]
	loadFixture(tb, "markets_tickers", &tickers)
	loadFixture(tb, "markets_symbols", &symbols)
	return tickers.Data, symbols.Data
}

func f64(t *testing.T, label string, got *float64) float64 {
	t.Helper()
	if got == nil {
		t.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func i64(t *testing.T, label string, got *int64) int64 {
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

func eq[T comparable](t *testing.T, label string, got, want T) {
	t.Helper()
	if got != want {
		t.Errorf("%s: got %v, want %v", label, got, want)
	}
}

// closeTo is bun:test's toBeCloseTo: equal to within half a unit in the given decimal place.
func closeTo(t *testing.T, label string, got, want float64, decimals int) {
	t.Helper()
	if math.Abs(got-want) >= 0.5*math.Pow(10, -float64(decimals)) {
		t.Errorf("%s: got %v, want %v to %d decimals", label, got, want, decimals)
	}
}

// product multiplies at RUNTIME in the same order and with the same per-factor rounding as
// adapters.Mul. Written as a function rather than as a literal product because Go folds a constant
// expression at arbitrary precision and rounds once, which can differ from the runtime result by an
// ulp — the two figures sodex.test.ts compares with toEqual have to be computed the same way here.
func product(factors ...float64) float64 {
	p := 1.0
	for _, f := range factors {
		p *= f
	}
	return p
}

func venueSymbols(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for i := range snapshots {
		out = append(out, snapshots[i].VenueSymbol)
	}
	return out
}

func requireSymbols(t *testing.T, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %v, want %v", got, want)
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("snapshot[%d]", i), got[i], symbol)
	}
}

func find(t *testing.T, snapshots []core.FundingSnapshot, venueSymbol string) core.FundingSnapshot {
	t.Helper()
	for i := range snapshots {
		if snapshots[i].VenueSymbol == venueSymbol {
			return snapshots[i]
		}
	}
	t.Fatalf("no snapshot for %s", venueSymbol)
	return core.FundingSnapshot{}
}

func TestParseSnapshotsNormalizesBTCFully(t *testing.T) {
	tickers, symbols := fixtures(t)

	btc := find(t, ParseSnapshots(tickers, Tradable(symbols), NOW), "BTC-USD")

	eq(t, "venueId", btc.VenueID, "sodex")
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-USD")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	// SoDEX's own USDC on ValueChain, kept as the venue spells it rather than folded to USDC.
	eq(t, "quote", str(t, "quote", btc.Quote), "vUSDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	if btc.Dex != nil {
		t.Errorf("dex: got %q, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.0000074662435927)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", btc.NextFundingAt), NEXT)
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76922)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76955)
	// Open interest is base units, priced at the venue's own mark.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(772.14798, 76922))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 108497684.26855)
	eq(t, "bestBid", f64(t, "bestBid", btc.BestBid), 76929)
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", btc.BestBidSizeUSD), product(1.87019, 76929))
	eq(t, "bestAsk", f64(t, "bestAsk", btc.BestAsk), 76930)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", btc.BestAskSizeUSD), product(1.92897, 76930))
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 40)
}

func TestAnHourlyRateAnnualisesOverOneHour(t *testing.T) {
	tickers, symbols := fixtures(t)

	btc := find(t, ParseSnapshots(tickers, Tradable(symbols), NOW), "BTC-USD")

	// 0.0000074662 over 1h -> 6.54% simple APR.
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 6.54043, 5)
}

func TestSkipsHALTMarketsEvenThoseStillInTickers(t *testing.T) {
	tickers, symbols := fixtures(t)

	// TON and BASED are HALT, yet still carry a stale June funding time in tickers — which is why
	// tradability is read from markets/symbols and never inferred from a ticker being present.
	wantStale := []int64{1_781_769_600_000, 1_782_576_000_000}
	stale := make([]int64, 0, len(wantStale))
	for _, row := range tickers {
		if row.Symbol == "TON-USD" || row.Symbol == "BASED-USD" {
			stale = append(stale, i64(t, row.Symbol+" nextFundingTime", row.NextFundingTime.PositiveMs()))
		}
	}
	if len(stale) != len(wantStale) {
		t.Fatalf("halted nextFundingTime: got %v, want %v", stale, wantStale)
	}
	for i, want := range wantStale {
		eq(t, fmt.Sprintf("halted[%d].nextFundingTime", i), stale[i], want)
	}

	requireSymbols(t, venueSymbols(ParseSnapshots(tickers, Tradable(symbols), NOW)), []string{
		"ENA-USD",
		"BTC-USD",
		"1000PEPE-USD",
		"XAUT-USD",
		"SILVER-USD",
		"TSLA-USD",
		"ETH-USD",
	})
}

func TestMarketOffTheHourlyIntervalIsNotCollected(t *testing.T) {
	tickers, symbols := fixtures(t)

	// The schema allows any multiple of 3600, but only the hourly basis has ever been observable, so
	// a 4h market is dropped rather than given a guessed basis.
	fourHourly := make([]Symbol, 0, len(symbols))
	for _, s := range symbols {
		if s.Name == "BTC-USD" {
			s.FundingInterval = adapters.Num{Val: 14_400, OK: true}
		}
		fourHourly = append(fourHourly, s)
	}

	collected := ParseSnapshots(tickers, Tradable(fourHourly), NOW)
	for _, symbol := range venueSymbols(collected) {
		if symbol == "BTC-USD" {
			t.Fatalf("collected BTC-USD off the hourly interval: %v", venueSymbols(collected))
		}
	}
	if len(collected) != 6 {
		t.Errorf("snapshots: got %d, want 6", len(collected))
	}
}

func TestBasesComeFromTheParser(t *testing.T) {
	tickers, symbols := fixtures(t)

	want := []struct {
		venueSymbol string
		base        string
		multiplier  float64
		class       core.AssetClass
	}{
		{"ENA-USD", "ENA", 1, core.ClassCrypto},
		{"BTC-USD", "BTC", 1, core.ClassCrypto},
		// Declared `baseCoin` is "1000PEPE"; the mark 0.003369 is Hyperliquid's kPEPE, so x1000 is
		// right.
		{"1000PEPE-USD", "PEPE", 1000, core.ClassCrypto},
		// Declared "XAUt".
		{"XAUT-USD", "XAUT", 1, core.ClassCrypto},
		{"SILVER-USD", "XAG", 1, core.ClassCrypto},
		// SoDEX declares no class anywhere, so its tradfi listings are crypto.
		{"TSLA-USD", "TSLA", 1, core.ClassCrypto},
		{"ETH-USD", "ETH", 1, core.ClassCrypto},
	}

	snapshots := ParseSnapshots(tickers, Tradable(symbols), NOW)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), snapshots[i].VenueSymbol, w.venueSymbol)
		eq(t, fmt.Sprintf("snapshot[%d].base", i), snapshots[i].Base, w.base)
		eq(t, fmt.Sprintf("snapshot[%d].multiplier", i), snapshots[i].Multiplier, w.multiplier)
		eq(t, fmt.Sprintf("snapshot[%d].assetClass", i), snapshots[i].AssetClass, w.class)
	}

	// The scaled contract's open interest is the raw figure the venue published, in its own units.
	for _, row := range tickers {
		if row.Symbol == "1000PEPE-USD" {
			eq(t, "1000PEPE openInterest", f64(t, "1000PEPE openInterest", row.OpenInterest.Ptr()), 240000)
		}
	}
}

// recordingDoer answers markets/symbols with the symbols fixture and everything else with the
// tickers fixture, recording every URL so the cache can be observed from outside the adapter.
type recordingDoer struct {
	urls    []string
	symbols []byte
	tickers []byte
}

func (d *recordingDoer) Do(req *http.Request) (*http.Response, error) {
	url := req.URL.String()
	d.urls = append(d.urls, url)
	body := d.tickers
	if strings.HasSuffix(url, "/markets/symbols") {
		body = d.symbols
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader(body)),
	}, nil
}

// fundingHistoryFetcher is the history half of the collector's venue interface. The TypeScript
// adapter omits fetchFundingHistory outright; the Go equivalent of that absence is *Adapter not
// satisfying this.
type fundingHistoryFetcher interface {
	FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error)
}

func TestAdapterFetchesTickersEveryCycleAndSymbolsHourly(t *testing.T) {
	doer := &recordingDoer{
		symbols: fixtureBytes(t, "markets_symbols"),
		tickers: fixtureBytes(t, "markets_tickers"),
	}
	client := httpclient.New(VenueID, httpclient.Options{Doer: doer})
	adapter := NewAdapter(client)
	ctx := context.Background()

	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+59*60_000)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	batch, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+60*60_000))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	sym := apiBase + "/markets/symbols"
	tick := apiBase + "/markets/tickers"
	want := []string{sym, tick, tick, sym, tick}
	if len(doer.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", doer.urls, want)
	}
	for i, url := range want {
		eq(t, fmt.Sprintf("url[%d]", i), doer.urls[i], url)
	}

	eq(t, "venueId", adapter.VenueID(), "sodex")
	if len(batch.Snapshots) != 7 {
		t.Errorf("snapshots: got %d, want 7", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d events, want 0", len(batch.Settled))
	}
	if _, ok := any(adapter).(fundingHistoryFetcher); ok {
		t.Error("*Adapter implements FetchFundingHistory; SoDEX publishes no settled funding")
	}
}
