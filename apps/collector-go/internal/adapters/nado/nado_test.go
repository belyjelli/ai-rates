package nado

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

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instant nado.test.ts uses (2026-09-13T22:26:40Z), so both suites pin identical output.
const NOW int64 = 1_789_338_400_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "nado")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/nado above the working directory")
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

// The SAME files packages/adapters/src/venues/nado.test.ts reads.
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

// product multiplies left to right at runtime. Written as a Go constant expression instead,
// `215.3981 * 76805.68219579448` is folded at arbitrary precision and can land one ulp away from the
// value a runtime multiplication produces.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func fixtureContracts(tb testing.TB) Contracts {
	tb.Helper()
	var contracts Contracts
	load(tb, "contracts", &contracts)
	return contracts
}

func fixtureSymbols(tb testing.TB) map[string]Symbol {
	tb.Helper()
	var body SymbolsResponse
	load(tb, "symbols", &body)
	if body.Data.Symbols == nil {
		tb.Fatal("symbols fixture carries no data.symbols")
	}
	return *body.Data.Symbols
}

func fixtureHistory(tb testing.TB) []FundingHistoryRow {
	tb.Helper()
	var body FundingHistoryResponse
	load(tb, "funding_rate_history-2", &body)
	if body.FundingRates == nil {
		tb.Fatal("history fixture carries no funding_rates")
	}
	return *body.FundingRates
}

func fixtureSnapshots(tb testing.TB) []core.FundingSnapshot {
	tb.Helper()
	return ParseSnapshots(fixtureContracts(tb), fixtureSymbols(tb), NOW)
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func contractByTicker(tb testing.TB, contracts Contracts, ticker string) Contract {
	tb.Helper()
	for _, contract := range contracts {
		if contract.TickerID == ticker {
			return contract
		}
	}
	tb.Fatalf("%s missing from the contracts fixture", ticker)
	return Contract{}
}

func TestParseSnapshotsNormalizesBTCAsAPredicted24HourRateSettledHourly(t *testing.T) {
	btc := snapshotBySymbol(fixtureSnapshots(t), "BTC-PERP_USDT0")
	if btc == nil {
		t.Fatal("BTC-PERP_USDT0 missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-PERP_USDT0")
	eq(t, "base", btc.Base, "BTC")
	// USDT0 is declared by the venue; the symbol parser does not know the quote, so it is overridden.
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT0")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.00010991167139984)
	eq(t, "basisHours", btc.BasisHours, 24.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	// next_funding_rate_timestamp is unix SECONDS.
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_340_400_000 {
		t.Errorf("nextFundingAt: got %v, want 1789340400000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76805.68219579448)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76796.975)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), 16540430.868905)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 88844499.99528772)

	// Nothing the venue does not publish in this call is invented.
	for label, value := range map[string]*float64{
		"bestBid": btc.BestBid, "bestAsk": btc.BestAsk,
		"bestBidSizeUsd": btc.BestBidSizeUSD, "bestAskSizeUsd": btc.BestAskSizeUSD,
		"maxLeverage": btc.MaxLeverage,
	} {
		if value != nil {
			t.Errorf("%s: got %v, want nil", label, *value)
		}
	}
}

func TestThe24hBasisAnnualizesBTCToAbout4PercentNotThe96AnHourlyReadingWouldGive(t *testing.T) {
	btc := snapshotBySymbol(fixtureSnapshots(t), "BTC-PERP_USDT0")
	if btc == nil {
		t.Fatal("BTC-PERP_USDT0 missing")
	}
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 4.012, 0.5e-3)
}

func TestAQuietMarketsDailyRateIsTheHourlyFloor(t *testing.T) {
	// 0.0003 a day is 3 x 0.0001, i.e. 0.0000125/h -- Hyperliquid's own floor, which Nado's formula
	// pins quiet markets to.
	kpepe := snapshotBySymbol(fixtureSnapshots(t), "kPEPE-PERP_USDT0")
	if kpepe == nil {
		t.Fatal("kPEPE-PERP_USDT0 missing")
	}
	closeTo(t, "hourly rate", kpepe.Rate/24, 0.0000125, 0.5e-12)
}

func TestOpenInterestIsAlreadyUSD(t *testing.T) {
	// Base OI times mark, so it is stored as published rather than re-priced.
	btc := snapshotBySymbol(fixtureSnapshots(t), "BTC-PERP_USDT0")
	if btc == nil {
		t.Fatal("BTC-PERP_USDT0 missing")
	}
	ratio := f64(t, "openInterestUsd", btc.OpenInterestUSD) / product(215.3981, 76805.68219579448)
	closeTo(t, "openInterestUsd / (base OI x mark)", ratio, 1, 0.5e-3)
}

func TestOnlyLivePerpsAreCollected(t *testing.T) {
	// Skipped from the fixture: USELESS (post_only), ADA (not_tradable), PENG (soft_reduce_only).
	want := []string{
		"kPEPE-PERP_USDT0",
		"XAUT-PERP_USDT0",
		"WTI-PERP_USDT0",
		"EURUSD-PERP_USDT0",
		"SPY-PERP_USDT0",
		"ETH-PERP_USDT0",
		"BTC-PERP_USDT0",
		"XAG-PERP_USDT0",
		"ZHIPU-PERP_USDT0",
		"AAPL-PERP_USDT0",
	}
	snapshots := fixtureSnapshots(t)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	// The order is the contracts document's own, which a Go map would have reshuffled per run.
	for i, symbol := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, symbol)
	}
}

func TestAMarketMissingFromSymbolsIsNotCollected(t *testing.T) {
	// contracts lists every perp, halted or not; the gateway's trading_status is the only signal
	// that separates them, so an unlisted market is not collected at all.
	got := ParseSnapshots(fixtureContracts(t), map[string]Symbol{}, NOW)
	if len(got) != 0 {
		t.Errorf("snapshots: got %d, want none", len(got))
	}
}

func TestClassFromTheDocumentedFeedReferenceAndBaseFromTheParser(t *testing.T) {
	want := []struct {
		symbol     string
		base       string
		multiplier float64
		class      core.AssetClass
	}{
		{"kPEPE-PERP_USDT0", "PEPE", 1000, core.ClassCrypto},
		// Documented Crypto: the gold token.
		{"XAUT-PERP_USDT0", "XAUT", 1, core.ClassCrypto},
		// Energy; WTI reaches CL through core's alias.
		{"WTI-PERP_USDT0", "CL", 1, core.ClassCommodity},
		{"EURUSD-PERP_USDT0", "EURUSD", 1, core.ClassFX},
		// US Equity.
		{"SPY-PERP_USDT0", "SPY", 1, core.ClassEquity},
		{"ETH-PERP_USDT0", "ETH", 1, core.ClassCrypto},
		{"BTC-PERP_USDT0", "BTC", 1, core.ClassCrypto},
		// Metals.
		{"XAG-PERP_USDT0", "XAG", 1, core.ClassCommodity},
		// HK Equity.
		{"ZHIPU-PERP_USDT0", "ZHIPU", 1, core.ClassEquity},
		{"AAPL-PERP_USDT0", "AAPL", 1, core.ClassEquity},
	}

	snapshots := fixtureSnapshots(t)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		got := snapshots[i]
		eq(t, "symbol", got.VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", got.Base, w.base)
		eq(t, w.symbol+" multiplier", got.Multiplier, w.multiplier)
		eq(t, w.symbol+" assetClass", got.AssetClass, w.class)
		eq(t, w.symbol+" quote", str(t, "quote", got.Quote), "USDT0")
	}
}

func TestAssetClassForAMarketTheDocsDoNotList(t *testing.T) {
	// A market the table does not list declares nothing, so crypto -- as every other venue's
	// undeclared listing is.
	eq(t, "BTC-PERP", AssetClassFor("BTC-PERP"), core.ClassCrypto)
	eq(t, "NEWTHING-PERP", AssetClassFor("NEWTHING-PERP"), core.ClassCrypto)
	eq(t, "GBPUSD-PERP", AssetClassFor("GBPUSD-PERP"), core.ClassFX)
}

func TestParseFundingHistoryReadsX18HourlyRatesWithUnixSecondTimestamps(t *testing.T) {
	btc := contractByTicker(t, fixtureContracts(t), "BTC-PERP_USDT0")
	events := ParseFundingHistory(fixtureHistory(t), btc, 0, math.MaxInt64)

	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_318_800_000, 0.000010519664719234, 1},
		{1_789_322_400_000, 0.000012504446974278, 1},
		{1_789_326_000_000, 0.00001250493289169, 1},
		{1_789_329_600_000, 0.00001241919134208, 1},
		{1_789_333_200_000, 0.000003274864692546, 1},
		{1_789_336_800_000, 0.000006943496312518, 1},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		// History is realized HOURLY, unlike the snapshot's 24-hour published figure.
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueId", events[0].VenueID, VenueID)
	eq(t, "base", events[0].Base, "BTC")
	eq(t, "quote", str(t, "quote", events[0].Quote), "USDT0")
}

// call is one request a fake Doer saw.
type call struct {
	method string
	url    string
	body   []byte
	// acceptEncoding is whatever the client set explicitly. The TypeScript adapter sends
	// `accept-encoding: gzip` because Bun's fetch otherwise omits it; Go's transport adds it to every
	// request that leaves the header unset, so this port sets nothing and the assertion pins that.
	acceptEncoding string
}

// fixtureDoer answers symbols, contracts and history from the same fixtures nado.test.ts uses,
// recording every request. It is the Go seam for the fake HttpClient that test builds.
type fixtureDoer struct {
	calls     []call
	symbols   []byte
	contracts []byte
	// history answers one POST; the count is 1 for the first.
	history func(post int) []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	recorded := call{
		method:         req.Method,
		url:            requested,
		acceptEncoding: req.Header.Get("accept-encoding"),
	}

	var body []byte
	switch {
	case strings.Contains(requested, "type=symbols"):
		body = d.symbols
	case strings.Contains(requested, "/v2/contracts"):
		body = d.contracts
	case req.Method == http.MethodPost:
		if req.Body != nil {
			raw, err := io.ReadAll(req.Body)
			if err != nil {
				return nil, err
			}
			recorded.body = raw
		}
		posts := 1
		for _, c := range d.calls {
			if c.method == http.MethodPost {
				posts++
			}
		}
		body = d.history(posts)
	default:
		return nil, fmt.Errorf("unexpected %s %s", req.Method, requested)
	}

	d.calls = append(d.calls, recorded)
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

// MaxRetries is negative for exactly one attempt per call, so the recorded requests are the walk's
// own.
func newTestAdapter(doer *fixtureDoer) *Adapter {
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsReadsSymbolsOnceAnHourAndContractsEveryCycle(t *testing.T) {
	doer := &fixtureDoer{symbols: fixtureBytes(t, "symbols"), contracts: fixtureBytes(t, "contracts")}
	adapter := newTestAdapter(doer)

	batch, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000)); err != nil {
		t.Fatalf("second FetchSnapshots: %v", err)
	}

	want := []call{
		{method: http.MethodGet, url: GatewayURL + "/query?type=symbols"},
		{method: http.MethodGet, url: ArchiveURL + "/v2/contracts?edge=false"},
		{method: http.MethodGet, url: ArchiveURL + "/v2/contracts?edge=false"},
	}
	if len(doer.calls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.calls), doer.calls, len(want))
	}
	for i, w := range want {
		eq(t, "method", doer.calls[i].method, w.method)
		eq(t, "url", doer.calls[i].url, w.url)
		// Nothing explicit: net/http asks for gzip itself and decompresses the reply, which is what
		// the TypeScript header exists to restore under Bun.
		eq(t, "accept-encoding", doer.calls[i].acceptEncoding, "")
	}

	if len(batch.Snapshots) != 10 {
		t.Errorf("snapshots: got %d, want 10", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(batch.Settled))
	}
}

func TestFetchFundingHistoryPostsByProductIDInSecondsLoadingContractsWhenCold(t *testing.T) {
	doer := &fixtureDoer{
		symbols:   fixtureBytes(t, "symbols"),
		contracts: fixtureBytes(t, "contracts"),
		history:   func(int) []byte { return fixtureBytes(t, "funding_rate_history-2") },
	}

	events, err := newTestAdapter(doer).FetchFundingHistory(
		context.Background(), "BTC-PERP_USDT0", 1_789_322_000_000, 1_789_337_000_000)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	if len(doer.calls) != 2 {
		t.Fatalf("requests: got %d (%v), want 2", len(doer.calls), doer.calls)
	}
	eq(t, "contracts method", doer.calls[0].method, http.MethodGet)
	eq(t, "contracts url", doer.calls[0].url, ArchiveURL+"/v2/contracts?edge=false")
	eq(t, "history method", doer.calls[1].method, http.MethodPost)
	eq(t, "history url", doer.calls[1].url, ArchiveURL+"/v1")

	var sent historyRequest
	if err := json.Unmarshal(doer.calls[1].body, &sent); err != nil {
		t.Fatalf("decode request body: %v", err)
	}
	// Addressed by product_id, and the window is unix SECONDS.
	eq(t, "product_id", sent.FundingRateHistory.ProductID, 2)
	eq(t, "start_time", sent.FundingRateHistory.StartTime, int64(1_789_322_000))
	eq(t, "end_time", sent.FundingRateHistory.EndTime, int64(1_789_337_000))
	eq(t, "limit", sent.FundingRateHistory.Limit, 1000)

	// The window drops the 17:00 settlement.
	want := []int64{
		1_789_322_400_000, 1_789_326_000_000, 1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000,
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, at := range want {
		eq(t, "settledAt", events[i].SettledAt, at)
	}
}

// historyPage builds a synthetic page as RAW JSON. adapters.Num has no MarshalJSON, so a struct
// holding one cannot be round-tripped through json.Marshal.
func historyPage(first int64, count int, hour int64) []byte {
	var out strings.Builder
	out.WriteString(`{"funding_rates":[`)
	for i := 0; i < count; i++ {
		if i > 0 {
			out.WriteString(",")
		}
		fmt.Fprintf(&out, `{"product_id":2,"timestamp":"%d","funding_rate_x18":"12500000000000"}`,
			first+int64(i)*hour)
	}
	out.WriteString(`]}`)
	return []byte(out.String())
}

func TestFetchFundingHistoryPagesForwardFromTheNewestTimestampPlusOne(t *testing.T) {
	const hour int64 = 3600
	const start int64 = 1_785_000_000

	doer := &fixtureDoer{
		contracts: fixtureBytes(t, "contracts"),
		history: func(post int) []byte {
			if post == 1 {
				return historyPage(start, historyPageSize, hour)
			}
			return historyPage(start+int64(historyPageSize)*hour, 2, hour)
		},
	}

	events, err := newTestAdapter(doer).FetchFundingHistory(
		context.Background(), "BTC-PERP_USDT0", start*1000, (start+1001*hour)*1000)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	var posts []call
	for _, c := range doer.calls {
		if c.method == http.MethodPost {
			posts = append(posts, c)
		}
	}
	if len(posts) != 2 {
		t.Fatalf("POSTs: got %d, want 2", len(posts))
	}

	var second historyRequest
	if err := json.Unmarshal(posts[1].body, &second); err != nil {
		t.Fatalf("decode second request body: %v", err)
	}
	// One second past the newest row of a full page, as the docs prescribe.
	eq(t, "start_time", second.FundingRateHistory.StartTime, start+999*hour+1)

	if len(events) != 1002 {
		t.Errorf("events: got %d, want 1002", len(events))
	}
}

func TestFetchSnapshotsFailsTheCycleOnAnUnexpectedSymbolsResponse(t *testing.T) {
	// Read as an empty map, a payload-less response would say every market on the venue has stopped
	// trading, which is indistinguishable from a real delisting.
	doer := &fixtureDoer{
		symbols:   []byte(`{"status":"failure"}`),
		contracts: fixtureBytes(t, "contracts"),
	}
	_, err := newTestAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("want an error, got none")
	}
	eq(t, "error", err.Error(), ErrUnexpectedSymbols.Error())
}

func TestContractsRejectAnArrayWhereTheObjectBelongs(t *testing.T) {
	var contracts Contracts
	if err := json.Unmarshal([]byte(`[{"ticker_id":"BTC-PERP_USDT0"}]`), &contracts); err == nil {
		t.Fatal("want an error for an array-shaped contracts response, got none")
	}
}
