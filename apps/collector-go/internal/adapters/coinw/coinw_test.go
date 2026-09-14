package coinw

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NOW is `ts` of BTCUSDT in the tickers response the fixtures were trimmed from (2026-09-13 22:29
// UTC) — the same instant coinw.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_338_572_228

const hour int64 = 3_600_000

// MIDNIGHT is the 00:00 UTC settlement every fixture contract is next due at.
const MIDNIGHT int64 = 1_789_344_000_000

// FUNDED is the contracts the fixtures carry a funding answer for, in the venue's own order.
var FUNDED = []string{"BTC", "ETH", "TRB", "ORDER", "1000PEPE", "SP500"}

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "coinw")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/coinw above the working directory")
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

// The SAME files packages/adapters/src/venues/coinw.test.ts reads.
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

func i64(tb testing.TB, label string, got *int64) int64 {
	tb.Helper()
	if got == nil {
		tb.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func fixtureMarkets(tb testing.TB) ([]Instrument, []Ticker) {
	tb.Helper()
	var instruments Envelope[[]Instrument]
	var tickers Envelope[[]Ticker]
	load(tb, "instruments", &instruments)
	load(tb, "tickers", &tickers)
	return instruments.Data, tickers.Data
}

func fundingFixture(tb testing.TB, name string) Envelope[*FundingRate] {
	tb.Helper()
	var env Envelope[*FundingRate]
	load(tb, "fundingRate_"+name, &env)
	return env
}

// fundingMap is every fixture contract's parsed settlement, as a completed sweep would leave it.
func fundingMap(tb testing.TB, fetchedAt int64) map[string]FundingEntry {
	tb.Helper()
	out := make(map[string]FundingEntry, len(FUNDED))
	for _, name := range FUNDED {
		parsed, err := ParseFundingRate(fundingFixture(tb, name))
		if err != nil {
			tb.Fatalf("parse %s: %v", name, err)
		}
		if parsed != nil {
			out[name] = FundingEntry{Rate: parsed.Rate, SettledAt: parsed.SettledAt, FetchedAt: fetchedAt}
		}
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

func symbolsOf(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for _, s := range snapshots {
		out = append(out, s.VenueSymbol)
	}
	return out
}

func instrumentByName(tb testing.TB, instruments []Instrument, name string) Instrument {
	tb.Helper()
	for _, instrument := range instruments {
		if instrument.Name == name {
			return instrument
		}
	}
	tb.Fatalf("fixture instrument %s missing", name)
	return Instrument{}
}

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	instruments, tickers := fixtureMarkets(t)
	snapshots := ParseSnapshots(SnapshotInput{instruments, tickers, fundingMap(t, NOW)}, NOW)

	btc := snapshotBySymbol(snapshots, "BTCUSDT")
	if btc == nil {
		t.Fatal("BTCUSDT missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// The 16:00 UTC settlement: Binance settled 0.00006450 at the same instant.
	eq(t, "rate", btc.Rate, 0.0000645)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", btc.NextFundingAt), MIDNIGHT)
	eq(t, "kind", btc.Kind, core.KindSettled)
	// fair_price; see the package header for why it is a mark.
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76768.6)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 200)

	// Absent, never zero: CoinW publishes no index, no open interest, and total_volume is not 24h.
	for label, got := range map[string]*float64{
		"indexPrice":      btc.IndexPrice,
		"openInterestUsd": btc.OpenInterestUSD,
		"volume24hUsd":    btc.Volume24hUSD,
	} {
		if got != nil {
			t.Errorf("%s: got %v, want nil", label, *got)
		}
	}
}

func TestParseSnapshotsKeepsUSDTWithACurrentSettlementAndDropsUSDCAndPROPW(t *testing.T) {
	instruments, tickers := fixtureMarkets(t)
	snapshots := ParseSnapshots(SnapshotInput{instruments, tickers, fundingMap(t, NOW)}, NOW)

	type market struct {
		class      core.AssetClass
		base       string
		quote      string
		multiplier float64
		rate       float64
		basisHours float64
	}
	want := map[string]market{
		"BTCUSDT": {core.ClassCrypto, "BTC", "USDT", 1, 0.0000645, 8},
		"ETHUSDT": {core.ClassCrypto, "ETH", "USDT", 1, -0.00004585, 8},
		// 4h: the 20:00 settlement, Binance's 0.00000463.
		"TRBUSDT": {core.ClassCrypto, "TRB", "USDT", 1, 0.00000463, 4},
		// preOffline, but trading until closeTime.
		"ORDERUSDT":    {core.ClassCrypto, "ORDER", "USDT", 1, 0.00005, 4},
		"1000PEPEUSDT": {core.ClassCrypto, "PEPE", "USDT", 1000, 0.0001, 8},
		// CoinW declares nothing, so its S&P 500 contract is crypto by rule.
		"SP500USDT": {core.ClassCrypto, "US500", "USDT", 1, 0, 8},
	}

	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d (%v), want %d", len(snapshots), symbolsOf(snapshots), len(want))
	}
	for _, s := range snapshots {
		expected, listed := want[s.VenueSymbol]
		if !listed {
			t.Errorf("unexpected market %s", s.VenueSymbol)
			continue
		}
		eq(t, s.VenueSymbol+" assetClass", s.AssetClass, expected.class)
		eq(t, s.VenueSymbol+" base", s.Base, expected.base)
		eq(t, s.VenueSymbol+" quote", str(t, "quote", s.Quote), expected.quote)
		eq(t, s.VenueSymbol+" multiplier", s.Multiplier, expected.multiplier)
		eq(t, s.VenueSymbol+" rate", s.Rate, expected.rate)
		eq(t, s.VenueSymbol+" basisHours", s.BasisHours, expected.basisHours)
		eq(t, s.VenueSymbol+" nextFundingAt", i64(t, "nextFundingAt", s.NextFundingAt), MIDNIGHT)
		if s.MarkPrice == nil {
			t.Errorf("%s: markPrice nil, want a price", s.VenueSymbol)
		}
	}
}

func TestParseSnapshotsHidesAMarketWhoseRateIsMissingOrSuperseded(t *testing.T) {
	instruments, tickers := fixtureMarkets(t)
	funding := fundingMap(t, NOW)
	delete(funding, "ETH")
	funding["TRB"] = FundingEntry{FetchedAt: NOW}

	symbols := symbolsOf(ParseSnapshots(SnapshotInput{instruments, tickers, funding}, NOW))
	for _, hidden := range []string{"ETHUSDT", "TRBUSDT"} {
		if slicesContains(symbols, hidden) {
			t.Errorf("%s: present, want hidden while its rate is unknown", hidden)
		}
	}

	// After 00:00 every cached rate is the previous period's.
	if overdue := ParseSnapshots(SnapshotInput{instruments, tickers, funding}, MIDNIGHT); len(overdue) != 0 {
		t.Errorf("at midnight: got %v, want none — every cached rate is superseded", symbolsOf(overdue))
	}

	// And without a ticker there is no price for the identity gate.
	noBTC := make([]Ticker, 0, len(tickers))
	for _, ticker := range tickers {
		if ticker.Name != "BTCUSDT" {
			noBTC = append(noBTC, ticker)
		}
	}
	if got := symbolsOf(ParseSnapshots(SnapshotInput{instruments, noBTC, funding}, NOW)); slicesContains(got, "BTCUSDT") {
		t.Error("BTCUSDT: present, want hidden without a ticker")
	}
}

func slicesContains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}

func TestIsCollectableTakesUSDTOnlineOrBeforeItsCloseWithAnInterval(t *testing.T) {
	instruments, _ := fixtureMarkets(t)
	btc := instrumentByName(t, instruments, "BTC")
	order := instrumentByName(t, instruments, "ORDER")

	eq(t, "BTC", IsCollectable(btc, NOW), true)
	// The USDC contract has no public funding endpoint at all.
	eq(t, "BTC_USDC", IsCollectable(instrumentByName(t, instruments, "BTC_USDC"), NOW), false)
	eq(t, "ORDER", IsCollectable(order, NOW), true)
	eq(t, "ORDER at closeTime", IsCollectable(order, int64(order.CloseTime.Val)), false)

	noCloseTime := order
	noCloseTime.CloseTime = adapters.Num{}
	eq(t, "ORDER without closeTime", IsCollectable(noCloseTime, NOW), false)

	offline := btc
	offline.Status = "offline"
	eq(t, "BTC offline", IsCollectable(offline, NOW), false)

	noPeriod := btc
	noPeriod.SettledPeriod = adapters.Num{}
	eq(t, "BTC without settledPeriod", IsCollectable(noPeriod, NOW), false)
}

func TestAssetClassForIsCryptoUnlessATradfiTagAppears(t *testing.T) {
	instruments, _ := fixtureMarkets(t)
	btc := instrumentByName(t, instruments, "BTC")

	eq(t, "tagged \"\"", AssetClassFor(btc, "BTC"), core.ClassCrypto)

	untagged := btc
	untagged.TradfiTag = ""
	eq(t, "untagged", AssetClassFor(untagged, "BTC"), core.ClassCrypto)

	// A tag would be tradfi of a kind we can't read, so the base tables decide which kind.
	stocks := btc
	stocks.TradfiTag = "Stocks"
	eq(t, "Stocks/AAPL", AssetClassFor(stocks, "AAPL"), core.ClassEquity)

	cjk := btc
	cjk.TradfiTag = "美股"
	eq(t, "美股/XAU", AssetClassFor(cjk, "XAU"), core.ClassCommodity)
}

func TestParseFundingRateReadsTheSettlementAndNamesAnUnknownContract(t *testing.T) {
	parsed, err := ParseFundingRate(fundingFixture(t, "BTC"))
	if err != nil {
		t.Fatalf("BTC: %v", err)
	}
	if parsed == nil {
		t.Fatal("BTC: got nil, want a settlement")
	}
	eq(t, "rate", f64(t, "rate", parsed.Rate), 0.0000645)
	eq(t, "settledAt", i64(t, "settledAt", parsed.SettledAt), 1_789_315_200_000)

	// A contract CoinW doesn't know is nil, not an error: it is held and retried, not fatal.
	notFound, err := ParseFundingRate(fundingFixture(t, "notfound"))
	if err != nil || notFound != nil {
		t.Errorf("notfound: got (%v, %v), want (nil, nil)", notFound, err)
	}

	// Any other code is a venue failure and must not read as an empty answer.
	// Built as a struct rather than JSON: adapters.Num has no MarshalJSON.
	_, err = ParseFundingRate(Envelope[*FundingRate]{Code: 500, Msg: "Internal", Data: nil})
	if err == nil || !strings.Contains(err.Error(), "500") {
		t.Errorf("code 500: got %v, want an error naming 500", err)
	}
}

func TestIsEntryOverdueExactlyWhenTheNextSettlementHasArrived(t *testing.T) {
	settledAt := int64(1_789_315_200_000)
	rate := 0.0000645
	entry := FundingEntry{Rate: &rate, SettledAt: &settledAt, FetchedAt: NOW}

	eq(t, "8h a millisecond early", IsEntryOverdue(entry, 8, MIDNIGHT-1), false)
	eq(t, "8h on the settlement", IsEntryOverdue(entry, 8, MIDNIGHT), true)
	eq(t, "4h at NOW", IsEntryOverdue(entry, 4, NOW), true)

	unknown := FundingEntry{FetchedAt: NOW}
	eq(t, "nothing settled yet", IsEntryOverdue(unknown, 8, MIDNIGHT), false)
}

// routeDoer answers each URL from the fixtures and records what was asked for. It is the Go seam for
// the fake HttpClient coinw.test.ts builds.
type routeDoer struct {
	tb        testing.TB
	urls      []string
	responses map[string][]byte
	funding   map[string][]byte
	notFound  []byte
	// overrides replaces one contract's funding answer mid-test, as the TypeScript's override map does.
	overrides map[string][]byte
}

func newRouteDoer(tb testing.TB) *routeDoer {
	tb.Helper()
	funding := make(map[string][]byte, len(FUNDED))
	for _, name := range FUNDED {
		funding[name] = fixtureBytes(tb, "fundingRate_"+name)
	}
	return &routeDoer{
		tb: tb,
		responses: map[string][]byte{
			"/perpum/instruments":   fixtureBytes(tb, "instruments"),
			"/perpumPublic/tickers": fixtureBytes(tb, "tickers"),
		},
		funding:   funding,
		notFound:  fixtureBytes(tb, "fundingRate_notfound"),
		overrides: map[string][]byte{},
	}
}

func (d *routeDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)

	path := strings.TrimPrefix(req.URL.Path, "/v1")
	body, known := d.responses[path]
	if path == "/perpum/fundingRate" {
		name := req.URL.Query().Get("instrument")
		switch {
		case d.overrides[name] != nil:
			body = d.overrides[name]
		case d.funding[name] != nil:
			body = d.funding[name]
		default:
			body = d.notFound
		}
	} else if !known {
		d.tb.Fatalf("unexpected %s", requested)
	}

	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

// paths is every URL asked for since the last reset, with the API prefix stripped.
func (d *routeDoer) paths() []string {
	out := make([]string, 0, len(d.urls))
	for _, u := range d.urls {
		out = append(out, strings.TrimPrefix(u, API))
	}
	return out
}

// fundingCalls is the contract named by each funding request since the last reset.
func (d *routeDoer) fundingCalls() []string {
	out := []string{}
	for _, raw := range d.urls {
		if !strings.Contains(raw, "/perpum/fundingRate") {
			continue
		}
		parsed, err := url.Parse(raw)
		if err != nil {
			d.tb.Fatalf("parse %s: %v", raw, err)
		}
		out = append(out, parsed.Query().Get("instrument"))
	}
	return out
}

func (d *routeDoer) reset() { d.urls = nil }

// MaxRetries is negative for exactly one attempt per call, so the URL count is the cycle's own.
func newTestAdapter(doer *routeDoer, budget int) *Adapter {
	return NewAdapterWithOptions(
		httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}),
		Options{FundingRefreshBudget: budget},
	)
}

func joined(values []string) string { return strings.Join(values, ",") }

func TestFetchSnapshotsReadsTickersEachCycleThenABudgetedFundingSlice(t *testing.T) {
	doer := newRouteDoer(t)
	adapter := newTestAdapter(doer, 3)
	eq(t, "venueId", adapter.VenueID(), VenueID)

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("first cycle: %v", err)
	}
	wantPaths := []string{
		"/perpum/instruments",
		"/perpumPublic/tickers",
		"/perpum/fundingRate?instrument=BTC",
		"/perpum/fundingRate?instrument=ETH",
		"/perpum/fundingRate?instrument=TRB",
	}
	if got := joined(doer.paths()); got != joined(wantPaths) {
		t.Errorf("first cycle requests: got %v, want %v", got, joined(wantPaths))
	}
	// A market appears once its rate is known, never before.
	if got := joined(symbolsOf(first.Snapshots)); got != "BTCUSDT,ETHUSDT,TRBUSDT" {
		t.Errorf("first cycle snapshots: got %v, want BTCUSDT,ETHUSDT,TRBUSDT", got)
	}

	var btc *core.FundingEvent
	for i := range first.Settled {
		if first.Settled[i].VenueSymbol == "BTCUSDT" {
			btc = &first.Settled[i]
		}
	}
	if btc == nil {
		t.Fatal("BTCUSDT settlement missing")
	}
	eq(t, "settled venueId", btc.VenueID, VenueID)
	eq(t, "settled base", btc.Base, "BTC")
	eq(t, "settled quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "settled multiplier", btc.Multiplier, 1.0)
	eq(t, "settled assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("settled dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "settled settledAt", btc.SettledAt, int64(1_789_315_200_000))
	eq(t, "settled rate", btc.Rate, 0.0000645)
	eq(t, "settled basisHours", btc.BasisHours, 8.0)
	if btc.MarkPrice != nil {
		t.Errorf("settled markPrice: got %v, want nil", *btc.MarkPrice)
	}

	doer.reset()
	second, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000))
	if err != nil {
		t.Fatalf("second cycle: %v", err)
	}
	if got := joined(doer.fundingCalls()); got != "ORDER,1000PEPE,SP500" {
		t.Errorf("second cycle funding: got %v, want ORDER,1000PEPE,SP500", got)
	}
	eq(t, "second cycle snapshots", len(second.Snapshots), 6)
	eq(t, "second cycle settled", len(second.Settled), 3)

	// Everything is fresh: one request, and settlements already reported are not reported again.
	doer.reset()
	third, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+120_000))
	if err != nil {
		t.Fatalf("third cycle: %v", err)
	}
	eq(t, "third cycle requests", len(doer.urls), 1)
	eq(t, "third cycle snapshots", len(third.Snapshots), 6)
	eq(t, "third cycle settled", len(third.Settled), 0)

	// After the max age the oldest slice is re-read, and an unchanged settlement stays unreported.
	doer.reset()
	fourth, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+FundingMaxAge.Milliseconds()))
	if err != nil {
		t.Fatalf("fourth cycle: %v", err)
	}
	if got := joined(doer.fundingCalls()); got != "BTC,ETH,TRB" {
		t.Errorf("fourth cycle funding: got %v, want BTC,ETH,TRB", got)
	}
	eq(t, "fourth cycle settled", len(fourth.Settled), 0)
}

func TestFetchSnapshotsRefreshesOverdueContractsFirstAndHidesThemUntilTheNewRateLands(t *testing.T) {
	doer := newRouteDoer(t)
	adapter := newTestAdapter(doer, 6)
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW)); err != nil {
		t.Fatalf("first cycle: %v", err)
	}

	// 00:00 has passed but CoinW still serves the 16:00 settlement: nothing is emitted stale.
	doer.reset()
	lagging, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(MIDNIGHT+30_000))
	if err != nil {
		t.Fatalf("lagging cycle: %v", err)
	}
	if got := joined(doer.fundingCalls()); got != joined(FUNDED) {
		t.Errorf("lagging funding: got %v, want %v", got, joined(FUNDED))
	}
	if len(lagging.Snapshots) != 0 {
		t.Errorf("lagging snapshots: got %v, want none", symbolsOf(lagging.Snapshots))
	}

	// adapters.Num has no MarshalJSON, so the new answer is a raw JSON string.
	doer.overrides["BTC"] = []byte(`{"code":0,"data":{"ts":1789344000000,"value":0.000071},"msg":""}`)
	doer.reset()
	landed, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(MIDNIGHT+90_000))
	if err != nil {
		t.Fatalf("landed cycle: %v", err)
	}
	if got := joined(doer.fundingCalls()); got != joined(FUNDED) {
		t.Errorf("landed funding: got %v, want %v", got, joined(FUNDED))
	}
	if len(landed.Snapshots) != 1 {
		t.Fatalf("landed snapshots: got %v, want BTCUSDT alone", symbolsOf(landed.Snapshots))
	}
	eq(t, "landed symbol", landed.Snapshots[0].VenueSymbol, "BTCUSDT")
	eq(t, "landed rate", landed.Snapshots[0].Rate, 0.000071)
	eq(t, "landed nextFundingAt", i64(t, "nextFundingAt", landed.Snapshots[0].NextFundingAt), MIDNIGHT+8*hour)

	if len(landed.Settled) != 1 {
		t.Fatalf("landed settled: got %d, want 1", len(landed.Settled))
	}
	eq(t, "landed settled symbol", landed.Settled[0].VenueSymbol, "BTCUSDT")
	eq(t, "landed settled settledAt", landed.Settled[0].SettledAt, MIDNIGHT)
	eq(t, "landed settled rate", landed.Settled[0].Rate, 0.000071)
}

func TestFetchSnapshotsRetriesAnUnknownContractAfterThirtyMinutesNotEveryCycle(t *testing.T) {
	doer := newRouteDoer(t)
	doer.overrides["TRB"] = fixtureBytes(t, "fundingRate_notfound")
	adapter := newTestAdapter(doer, 50)

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("first cycle: %v", err)
	}
	if slicesContains(symbolsOf(first.Snapshots), "TRBUSDT") {
		t.Error("TRBUSDT: present, want hidden while CoinW knows no rate for it")
	}

	doer.reset()
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000)); err != nil {
		t.Fatalf("second cycle: %v", err)
	}
	if got := doer.fundingCalls(); len(got) != 0 {
		t.Errorf("second cycle funding: got %v, want none — the retry is held for 30 minutes", got)
	}

	doer.reset()
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+30*60_000)); err != nil {
		t.Fatalf("third cycle: %v", err)
	}
	if got := doer.fundingCalls(); !slicesContains(got, "TRB") {
		t.Errorf("third cycle funding: got %v, want TRB re-read after 30 minutes", got)
	}
}
