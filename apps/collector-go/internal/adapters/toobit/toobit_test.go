package toobit

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NOW is `t` of BTC-SWAP-USDT's 24h ticker the fixtures were trimmed from (2026-09-13 22:29 UTC),
// the same instant toobit.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_338_570_215

const HOUR int64 = 3_600_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "toobit")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/toobit above the working directory")
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

// The SAME files packages/adapters/src/venues/toobit.test.ts reads.
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
// constant expression instead, `11595 * 0.001 * 76768.5` is folded at arbitrary precision and can
// land one ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func loadInput(tb testing.TB) SnapshotInput {
	tb.Helper()
	var info ExchangeInfo
	var funding []FundingRate
	var tickers []Ticker
	var marks []MarkPrice
	var index Index
	var books []BookTicker
	load(tb, "exchangeInfo", &info)
	load(tb, "fundingRate", &funding)
	load(tb, "ticker24hr", &tickers)
	load(tb, "markPrice", &marks)
	load(tb, "index", &index)
	load(tb, "bookTicker", &books)
	return SnapshotInput{
		Contracts: info.Contracts,
		Funding:   funding,
		Tickers:   tickers,
		Marks:     marks,
		Index:     index.Index,
		Books:     books,
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

func firstContract(tb testing.TB) Contract {
	tb.Helper()
	var info ExchangeInfo
	load(tb, "exchangeInfo", &info)
	if len(info.Contracts) == 0 {
		tb.Fatal("fixture")
	}
	return info.Contracts[0]
}

func TestParseSnapshotsNormalizesBTCSWAPUSDT(t *testing.T) {
	btc := snapshotBySymbol(ParseSnapshots(loadInput(t), NOW), "BTC-SWAP-USDT")
	if btc == nil {
		t.Fatal("BTC-SWAP-USDT missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-SWAP-USDT")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// Binance's own estimate for the 00:00 settlement at the same second.
	eq(t, "rate", btc.Rate, 0.00006548)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_344_000_000 {
		t.Errorf("nextFundingAt: got %v, want 1789344000000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76768.7)
	// Looked up by `indexToken` BTCUSDT, not by the symbol.
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76797.5476087)
	eq(t, "bestBid", f64(t, "bestBid", btc.BestBid), 76768.5)
	// Contracts of 0.001 BTC: 11.6 BTC at the bid, not 11,595.
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", btc.BestBidSizeUSD), product(11595, 0.001, 76768.5))
	eq(t, "bestAsk", f64(t, "bestAsk", btc.BestAsk), 76768.6)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", btc.BestAskSizeUSD), product(91131, 0.001, 76768.6))
	// `op` is contracts: 796.4 BTC, about $61M, matching /quote/v1/openInterest.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(796404.198, 0.001, 76768.7))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 4275918831.73709)
	// Toobit publishes no headline leverage in this request set, so none is claimed.
	if btc.MaxLeverage != nil {
		t.Errorf("maxLeverage: got %v, want nil", *btc.MaxLeverage)
	}
}

func TestThe24hVolumeIsContractsSoTurnoverIsQvAndNotV(t *testing.T) {
	// `v` is not on the Ticker struct -- nothing reads it -- so this decodes it on the side, as the
	// TypeScript test casts to reach it.
	var tickers []struct {
		S  string `json:"s"`
		C  string `json:"c"`
		V  string `json:"v"`
		Qv string `json:"qv"`
	}
	load(t, "ticker24hr", &tickers)
	var info ExchangeInfo
	load(t, "exchangeInfo", &info)

	for _, symbol := range []string{"BTC-SWAP-USDT", "ETH-SWAP-USDT"} {
		var volume, turnover, last float64
		found := false
		for _, ticker := range tickers {
			if ticker.S != symbol {
				continue
			}
			found = true
			volume, _ = strconv.ParseFloat(ticker.V, 64)
			turnover, _ = strconv.ParseFloat(ticker.Qv, 64)
			last, _ = strconv.ParseFloat(ticker.C, 64)
		}
		if !found {
			t.Fatalf("%s: missing from the ticker fixture", symbol)
		}

		multiplier := 0.0
		for _, contract := range info.Contracts {
			if contract.Symbol == symbol {
				multiplier = contract.ContractMultiplier.Val
			}
		}
		impliedPrice := turnover / (volume * multiplier)
		if diff := math.Abs(impliedPrice/last - 1); diff >= 0.01 {
			t.Errorf("%s: qv/(v x multiplier) implies %v against a last price of %v", symbol, impliedPrice, last)
		}
	}
}

func TestParseSnapshotsKeepsListedContractsOnlyInFundingOrder(t *testing.T) {
	want := []string{
		"BTC-SWAP-USDT",
		"ETH-SWAP-USDT",
		"BTC-SWAP-USDC",
		"ID2-SWAP-USDT",
		"1000PEPE-SWAP-USDT",
		"XAU-SWAP-USDT",
		"TSLA-SWAP-USDT",
		"SPX500-SWAP-USDT",
		"EUR-SWAP-USDT",
		"XAUT-SWAP-USDT",
		"IOST-SWAP-USDT",
		"AXS-SWAP-USDT",
		// TBV_BTC-SWAP-TBV_USDT has funding but is not in exchangeInfo.
	}

	snapshots := ParseSnapshots(loadInput(t), NOW)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, symbol)
	}
}

func TestParseSnapshotsEachContractsOwnPeriodIsItsBasis(t *testing.T) {
	all := ParseSnapshots(loadInput(t), NOW)

	iost := snapshotBySymbol(all, "IOST-SWAP-USDT")
	if iost == nil {
		t.Fatal("IOST-SWAP-USDT missing")
	}
	eq(t, "IOST basisHours", iost.BasisHours, 1.0)
	eq(t, "IOST intervalHours", f64(t, "IOST intervalHours", iost.IntervalHours), 1.0)
	if iost.NextFundingAt == nil || *iost.NextFundingAt != 1_789_340_400_000 {
		t.Errorf("IOST nextFundingAt: got %v, want 1789340400000", iost.NextFundingAt)
	}

	axs := snapshotBySymbol(all, "AXS-SWAP-USDT")
	if axs == nil {
		t.Fatal("AXS-SWAP-USDT missing")
	}
	eq(t, "AXS rate", axs.Rate, 0.00005)
	eq(t, "AXS basisHours", axs.BasisHours, 4.0)
}

func TestParseSnapshotsClassFromIsRwaQuoteFromMarginCoinBaseFromUnderlying(t *testing.T) {
	want := map[string]string{
		"BTC-SWAP-USDT": "crypto:BTC:USDT",
		"ETH-SWAP-USDT": "crypto:ETH:USDT",
		"BTC-SWAP-USDC": "crypto:BTC:USDC",
		// The parser reads ID2; Toobit declares underlying ID and index IDUSDT.
		"ID2-SWAP-USDT":      "crypto:ID:USDT",
		"1000PEPE-SWAP-USDT": "crypto:PEPE:USDT",
		// rwaType is STOCK on all four of these; the base tables pick the class.
		"XAU-SWAP-USDT":    "commodity:XAU:USDT",
		"TSLA-SWAP-USDT":   "equity:TSLA:USDT",
		"SPX500-SWAP-USDT": "index:US500:USDT",
		"EUR-SWAP-USDT":    "fx:EUR:USDT",
		// Categorised TradFi but not RWA.
		"XAUT-SWAP-USDT": "crypto:XAUT:USDT",
		"IOST-SWAP-USDT": "crypto:IOST:USDT",
		"AXS-SWAP-USDT":  "crypto:AXS:USDT",
	}

	snapshots := ParseSnapshots(loadInput(t), NOW)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for _, s := range snapshots {
		got := string(s.AssetClass) + ":" + s.Base + ":" + str(t, s.VenueSymbol+" quote", s.Quote)
		eq(t, s.VenueSymbol, got, want[s.VenueSymbol])
	}

	pepe := snapshotBySymbol(snapshots, "1000PEPE-SWAP-USDT")
	if pepe == nil {
		t.Fatal("1000PEPE-SWAP-USDT missing")
	}
	eq(t, "1000PEPE multiplier", pepe.Multiplier, 1000.0)
}

func TestIsTradableTradingLinearAndMarginedInTheDollarCoinItIsQuotedIn(t *testing.T) {
	btc := firstContract(t)
	eq(t, "BTC", IsTradable(btc), true)

	halted := btc
	halted.Status = "HALT"
	eq(t, "halted", IsTradable(halted), false)

	inverse := btc
	inverse.Inverse = true
	eq(t, "inverse", IsTradable(inverse), false)

	coinMargined := btc
	coinMargined.MarginToken = "BTC"
	coinMargined.QuoteAsset = "USD"
	eq(t, "coin-margined", IsTradable(coinMargined), false)
}

func TestAssetClassForIsRwaDecidesCryptoOrNotAndTheBaseDecidesWhichTradfiClass(t *testing.T) {
	btc := firstContract(t)
	eq(t, "BTC", AssetClassFor(btc, "BTC"), core.ClassCrypto)

	// An absent isRwa is not an RWA declaration, so it stays crypto.
	undeclared := btc
	undeclared.IsRwa = false
	eq(t, "isRwa absent", AssetClassFor(undeclared, "BTC"), core.ClassCrypto)

	rwa := btc
	rwa.IsRwa = true
	rwa.RwaType = "STOCK"
	eq(t, "NVDA", AssetClassFor(rwa, "NVDA"), core.ClassEquity)
	eq(t, "XAG", AssetClassFor(rwa, "XAG"), core.ClassCommodity)

	// rwaType is never read, so a value new to us changes nothing: the base still picks the class.
	unknownType := rwa
	unknownType.RwaType = "SOMETHING_NEW"
	eq(t, "US30", AssetClassFor(unknownType, "US30"), core.ClassIndex)
}

func TestPeriodHoursReadsHourPeriodsOnly(t *testing.T) {
	for _, tc := range []struct {
		period string
		want   *float64
	}{
		{"8H", ptr(8)},
		{"4h", ptr(4)},
		{"1H", ptr(1)},
		{"0H", nil},
		{"8", nil},
		{"", nil},
	} {
		got := PeriodHours(tc.period)
		switch {
		case tc.want == nil && got != nil:
			t.Errorf("PeriodHours(%q): got %v, want nil", tc.period, *got)
		case tc.want != nil && got == nil:
			t.Errorf("PeriodHours(%q): got nil, want %v", tc.period, *tc.want)
		case tc.want != nil && *got != *tc.want:
			t.Errorf("PeriodHours(%q): got %v, want %v", tc.period, *got, *tc.want)
		}
	}
}

func ptr(v float64) *float64 { return &v }

func historyRef() core.MarketRef {
	quote := "USDT"
	return adapters.MarketRefFor(VenueID, "BTC-SWAP-USDT", adapters.Overrides{Quote: &quote, HasQuote: true})
}

func TestParseFundingHistoryOldestFirstEachOverItsDeclaredPeriod(t *testing.T) {
	var rows []FundingHistoryRow
	load(t, "historyFundingRate", &rows)

	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_200_000_000, 0.00004368, 8},
		{1_789_228_800_000, 0.00005153, 8},
		{1_789_257_600_000, 0.00004794, 8},
		{1_789_286_400_000, 0.0000539, 8},
		// Binance settled 0.00006450 at the same instant.
		{1_789_315_200_000, 0.0000645, 8},
	}

	events := ParseFundingHistory(historyRef(), rows, 0, NOW, nil)
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTC-SWAP-USDT")
	eq(t, "base", events[0].Base, "BTC")
}

func TestParseFundingHistoryCutsToTheWindowAndFallsBackToTheGaps(t *testing.T) {
	var rows []FundingHistoryRow
	load(t, "historyFundingRate", &rows)

	if got := ParseFundingHistory(historyRef(), rows, 1_789_286_400_000, NOW, nil); len(got) != 2 {
		t.Errorf("windowed events: got %d, want 2", len(got))
	}

	unlabelled := make([]FundingHistoryRow, len(rows))
	copy(unlabelled, rows)
	for i := range unlabelled {
		unlabelled[i].Period = ""
	}
	events := ParseFundingHistory(historyRef(), unlabelled, 0, NOW, nil)
	if len(events) != len(rows) {
		t.Fatalf("unlabelled events: got %d, want %d", len(events), len(rows))
	}
	for _, event := range events {
		eq(t, "basisHours from the gaps", event.BasisHours, 8.0)
	}

	// One unlabelled settlement has no gap to measure and no fallback, so it is dropped rather than
	// given an invented basis.
	if got := ParseFundingHistory(historyRef(), unlabelled[:1], 0, NOW, nil); len(got) != 0 {
		t.Errorf("lone unlabelled event: got %d, want none", len(got))
	}
}

// fixtureDoer answers each path with its fixture, recording the URLs asked for. It is the Go seam
// for the fake HttpClient toobit.test.ts builds.
type fixtureDoer struct {
	urls    []string
	bodies  map[string][]byte
	history func(*url.URL) []byte
}

func newFixtureDoer(tb testing.TB) *fixtureDoer {
	tb.Helper()
	return &fixtureDoer{bodies: map[string][]byte{
		"/api/v1/exchangeInfo":                 fixtureBytes(tb, "exchangeInfo"),
		"/api/v1/futures/fundingRate":          fixtureBytes(tb, "fundingRate"),
		"/quote/v1/contract/ticker/24hr":       fixtureBytes(tb, "ticker24hr"),
		"/quote/v1/markPrice":                  fixtureBytes(tb, "markPrice"),
		"/quote/v1/index":                      fixtureBytes(tb, "index"),
		"/quote/v1/contract/ticker/bookTicker": fixtureBytes(tb, "bookTicker"),
	}}
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	d.urls = append(d.urls, req.URL.String())

	var body []byte
	if req.URL.Path == "/api/v1/futures/historyFundingRate" && d.history != nil {
		body = d.history(req.URL)
	} else if fixture, known := d.bodies[req.URL.Path]; known {
		body = fixture
	} else {
		return &http.Response{
			Status:     "404 Not Found",
			StatusCode: http.StatusNotFound,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{"code":-1,"msg":"unexpected path"}`)),
			Request:    req,
		}, nil
	}

	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

// paths is each recorded URL with the venue's host stripped, so the expectations read as the
// TypeScript's do.
func (d *fixtureDoer) paths() []string {
	out := make([]string, 0, len(d.urls))
	for _, requested := range d.urls {
		out = append(out, strings.TrimPrefix(requested, apiBase))
	}
	return out
}

// newAdapter builds an adapter over the doer. MaxRetries is negative for exactly one attempt per
// call, so the URL count is the cycle's own.
func newAdapter(doer *fixtureDoer) *Adapter {
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func eqPaths(tb testing.TB, got, want []string) {
	tb.Helper()
	if len(got) != len(want) {
		tb.Fatalf("requests: got %d (%v), want %d (%v)", len(got), got, len(want), want)
	}
	for i, path := range want {
		eq(tb, "request", got[i], path)
	}
}

func TestFetchSnapshotsFiveBulkRequestsACycleExchangeInfoHourlyNoPerSymbolCalls(t *testing.T) {
	doer := newFixtureDoer(t)
	adapter := newAdapter(doer)
	eq(t, "venueId", adapter.VenueID(), "toobit")

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	eqPaths(t, doer.paths(), []string{
		"/api/v1/exchangeInfo",
		"/api/v1/futures/fundingRate",
		"/quote/v1/contract/ticker/24hr",
		"/quote/v1/markPrice",
		"/quote/v1/index",
		"/quote/v1/contract/ticker/bookTicker",
	})
	if len(first.Snapshots) != 12 {
		t.Fatalf("snapshots: got %d, want 12", len(first.Snapshots))
	}
	if len(first.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(first.Settled))
	}
	for _, s := range first.Snapshots {
		if s.MarkPrice == nil || s.IndexPrice == nil {
			t.Errorf("%s: markPrice %v, indexPrice %v, want both", s.VenueSymbol, s.MarkPrice, s.IndexPrice)
		}
	}

	// A minute later the cached contract list still stands, so only the five bulk calls go out.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000)); err != nil {
		t.Fatalf("second cycle: %v", err)
	}
	if len(doer.urls) != 5 {
		t.Errorf("second cycle: got %d requests (%v), want 5", len(doer.urls), doer.paths())
	}

	// An hour on it is re-read, and first, since the join needs it.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+HOUR)); err != nil {
		t.Fatalf("third cycle: %v", err)
	}
	if got := doer.paths(); len(got) == 0 || got[0] != "/api/v1/exchangeInfo" {
		t.Errorf("third cycle: got %v, want exchangeInfo first", got)
	}
}

func TestFetchSnapshotsAnErrorObjectWhereAListBelongsFailsTheCycle(t *testing.T) {
	doer := newFixtureDoer(t)
	doer.bodies["/api/v1/futures/fundingRate"] =
		[]byte(`{"code":-1130,"msg":"Data sent for paramter 'limit' is not valid."}`)

	_, err := newAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("want an error, got none")
	}
	if !strings.Contains(err.Error(), "-1130") {
		t.Errorf("error: got %q, want it to carry the venue's code -1130", err)
	}
}

// historyPage is the generator toobit.test.ts uses: 1,000 rows walking back 8 hours a row, with ids
// descending so `fromId` has something to page on.
func historyPage(fromID *int) []byte {
	const T = 1_789_315_200_000
	rows := make([]map[string]string, 0, historyPageSize)
	for i := 0; i < historyPageSize; i++ {
		offset, shift := i, 0
		if fromID != nil {
			offset = (3_000_000 - *fromID) + i
			shift = 1
		}
		rows = append(rows, map[string]string{
			"id":         strconv.Itoa(3_000_000 - offset - shift),
			"symbol":     "BTC-SWAP-USDT",
			"settleTime": strconv.FormatInt(T-int64(offset+shift)*8*HOUR, 10),
			"settleRate": "0.0001",
			"period":     "8H",
		})
	}
	// Built as raw JSON rather than as FundingHistoryRow values: adapters.Num has no MarshalJSON, so
	// a struct carrying one cannot be round-tripped.
	body, err := json.Marshal(rows)
	if err != nil {
		panic(err)
	}
	return body
}

func TestFetchFundingHistoryWalksBackWithFromIdUntilItPassesFromMs(t *testing.T) {
	const T int64 = 1_789_315_200_000

	doer := newFixtureDoer(t)
	doer.history = func(requested *url.URL) []byte {
		raw := requested.Query().Get("fromId")
		if raw == "" {
			return historyPage(nil)
		}
		fromID, err := strconv.Atoi(raw)
		if err != nil {
			t.Errorf("fromId %q: %v", raw, err)
			return historyPage(nil)
		}
		return historyPage(&fromID)
	}

	fromMs := T - 1500*8*HOUR
	events, err := newAdapter(doer).FetchFundingHistory(context.Background(), "BTC-SWAP-USDT", fromMs, T)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	eqPaths(t, doer.paths(), []string{
		"/api/v1/futures/historyFundingRate?symbol=BTC-SWAP-USDT&limit=1000",
		"/api/v1/futures/historyFundingRate?symbol=BTC-SWAP-USDT&limit=1000&fromId=2999001",
	})
	// 2,000 rows fetched; the second page reaches back past fromMs, so paging stops there.
	if len(events) != 1501 {
		t.Fatalf("events: got %d, want 1501", len(events))
	}
	eq(t, "first settledAt", events[0].SettledAt, fromMs)
	eq(t, "last settledAt", events[len(events)-1].SettledAt, T)
}
