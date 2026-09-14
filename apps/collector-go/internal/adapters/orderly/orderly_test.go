package orderly

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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

// NOW is the `timestamp` of the futures response the fixtures were trimmed from, the same instant
// orderly.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_336_872_547

const hourMs int64 = 3_600_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "orderly")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/orderly above the working directory")
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

// The SAME files packages/adapters/src/venues/orderly.test.ts reads.
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

// product multiplies left to right at runtime, exactly as adapters.Mul does. Written as a Go
// constant expression instead, `26.43846 * 77090.2` is folded at arbitrary precision and can land
// one ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

// num builds a present Num for tests that construct wire structs directly rather than decoding them:
// adapters.Num has no MarshalJSON, so a struct containing one cannot be round-tripped.
func num(v float64) adapters.Num { return adapters.Num{Val: v, OK: true} }

type fixtures struct {
	info    Envelope[Rows[Info]]
	futures Envelope[Rows[Future]]
	rates   Envelope[Rows[FundingRate]]
}

func loadFixtures(tb testing.TB) fixtures {
	tb.Helper()
	var f fixtures
	load(tb, "info", &f.info)
	load(tb, "futures", &f.futures)
	load(tb, "funding_rates", &f.rates)
	if f.info.Data == nil || f.futures.Data == nil || f.rates.Data == nil {
		tb.Fatal("a fixture envelope carried no data")
	}
	return f
}

func batch(tb testing.TB) core.SnapshotBatch {
	tb.Helper()
	f := loadFixtures(tb)
	return ParseSnapshots(SnapshotInput{
		Markets:      TradablePerps(f.info.Data.Rows),
		Futures:      f.futures.Data.Rows,
		FundingRates: f.rates.Data.Rows,
	}, NOW)
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

func TestParseSnapshotsNormalizesPERPBTCUSDC(t *testing.T) {
	btc := snapshotBySymbol(batch(t).Snapshots, "PERP_BTC_USDC")
	if btc == nil {
		t.Fatal("PERP_BTC_USDC missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "PERP_BTC_USDC")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// est_funding_rate, the forward-looking one; last_funding_rate (0.00009988) is a settlement.
	eq(t, "rate", btc.Rate, 0.0001)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_344_000_000 {
		t.Errorf("nextFundingAt: got %v, want 1789344000000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77090.2)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77116.1)
	// open_interest is base units: 26.43846 BTC.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(26.43846, 77090.2))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 2461419.108083)
}

func TestParseSnapshotsEmitsTheLastSettlementAtItsOwnTimestamp(t *testing.T) {
	settled := batch(t).Settled

	btc := eventBySymbol(settled, "PERP_BTC_USDC")
	if btc == nil {
		t.Fatal("PERP_BTC_USDC settlement missing")
	}
	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "settledAt", btc.SettledAt, int64(1_789_315_200_000))
	eq(t, "rate", btc.Rate, 0.00009988)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	if btc.MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *btc.MarkPrice)
	}

	// A 4h market settles on its own clock, four hours after BTC's last one.
	hype := eventBySymbol(settled, "PERP_HYPE_USDC")
	if hype == nil {
		t.Fatal("PERP_HYPE_USDC settlement missing")
	}
	eq(t, "hype settledAt", hype.SettledAt, int64(1_789_329_600_000))
	eq(t, "hype rate", hype.Rate, 0.00004991)
	eq(t, "hype basisHours", hype.BasisHours, 4.0)
}

func TestParseSnapshotsRatesOn4hMarketsArePer4hNotPer8h(t *testing.T) {
	hype := snapshotBySymbol(batch(t).Snapshots, "PERP_HYPE_USDC")
	if hype == nil {
		t.Fatal("PERP_HYPE_USDC missing")
	}
	// The resting rate is 0.01% per 8h; a 4h market quotes half of it, so it is a per-period rate.
	eq(t, "rate", hype.Rate, 0.00005)
	eq(t, "basisHours", hype.BasisHours, 4.0)
	eq(t, "intervalHours", f64(t, "intervalHours", hype.IntervalHours), 4.0)

	apr, err := core.APRFromRate(hype.Rate, core.UnitFraction, hype.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 10.95, 1e-6)
}

func TestParseSnapshotsParsesEverySymbolShape(t *testing.T) {
	// Broker suffixes and size prefixes included.
	want := []struct {
		symbol     string
		base       string
		quote      string
		multiplier float64
		class      core.AssetClass
	}{
		{"PERP_BTC_USDC", "BTC", "USDC", 1, core.ClassCrypto},
		{"PERP_ETH_USDC", "ETH", "USDC", 1, core.ClassCrypto},
		{"PERP_1000PEPE_USDC", "PEPE", "USDC", 1000, core.ClassCrypto},
		{"PERP_HYPE_USDC", "HYPE", "USDC", 1, core.ClassCrypto},
		// Orderly's public API declares no class, so these are crypto by the rule, not by choice.
		{"PERP_XAU_USDC", "XAU", "USDC", 1, core.ClassCrypto},
		{"PERP_SPX500_USDC", "US500", "USDC", 1, core.ClassCrypto},
		{"PERP_EURUSD_USDC", "EURUSD", "USDC", 1, core.ClassCrypto},
		// A broker-listed market on the shared book.
		{"PERP_AAPL_USDC_mythos", "AAPL", "USDC", 1, core.ClassCrypto},
	}

	snapshots := batch(t).Snapshots
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		got := snapshots[i]
		eq(t, "venueSymbol", got.VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", got.Base, w.base)
		eq(t, w.symbol+" quote", str(t, w.symbol+" quote", got.Quote), w.quote)
		eq(t, w.symbol+" multiplier", got.Multiplier, w.multiplier)
		eq(t, w.symbol+" assetClass", got.AssetClass, w.class)
	}
}

func TestParseSnapshotsSkipsMarketsThatAreNotActiveOrNotInInfo(t *testing.T) {
	f := loadFixtures(t)

	info := make([]Info, 0, len(f.info.Data.Rows))
	for _, market := range f.info.Data.Rows {
		if market.Symbol == "PERP_XAU_USDC" {
			continue
		}
		if market.Symbol == "PERP_ETH_USDC" {
			market.Status = "SUSPENDED"
		}
		info = append(info, market)
	}

	got := ParseSnapshots(SnapshotInput{
		Markets:      TradablePerps(info),
		Futures:      f.futures.Data.Rows,
		FundingRates: f.rates.Data.Rows,
	}, NOW)

	if len(got.Snapshots) != 6 {
		t.Errorf("snapshots: got %d, want 6", len(got.Snapshots))
	}
	if len(got.Settled) != 6 {
		t.Errorf("settled: got %d, want 6", len(got.Settled))
	}
	for _, symbol := range []string{"PERP_ETH_USDC", "PERP_XAU_USDC"} {
		if snapshotBySymbol(got.Snapshots, symbol) != nil {
			t.Errorf("snapshots still carry %s", symbol)
		}
		if eventBySymbol(got.Settled, symbol) != nil {
			t.Errorf("settled still carries %s", symbol)
		}
	}
}

func TestParseFundingHistoryOldestFirstWithEachBasisFromItsOwnNextFundingTime(t *testing.T) {
	var btcPage Envelope[FundingHistoryPage]
	load(t, "funding_rate_history_PERP_BTC_USDC", &btcPage)
	if btcPage.Data == nil {
		t.Fatal("BTC history envelope carried no data")
	}

	events := ParseFundingHistory("PERP_BTC_USDC", btcPage.Data.Rows, 0, NOW, nil)
	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_200_000_000, 0.00009968, 8},
		{1_789_228_800_000, 0.00009955, 8},
		{1_789_257_600_000, 0.00009966, 8},
		{1_789_286_400_000, 0.00009988, 8},
		{1_789_315_200_000, 0.00009988, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "PERP_BTC_USDC")
	eq(t, "base", events[0].Base, "BTC")

	// The row's own gap wins over the fallback: a 4h market handed 8h still reads 4h.
	var hypePage Envelope[FundingHistoryPage]
	load(t, "funding_rate_history_PERP_HYPE_USDC", &hypePage)
	if hypePage.Data == nil {
		t.Fatal("HYPE history envelope carried no data")
	}
	fallback := 8.0
	hype := ParseFundingHistory("PERP_HYPE_USDC", hypePage.Data.Rows, 0, NOW, &fallback)
	if len(hype) != 4 {
		t.Fatalf("hype events: got %d, want 4", len(hype))
	}
	for i, event := range hype {
		eq(t, fmt.Sprintf("hype[%d] basisHours", i), event.BasisHours, 4.0)
	}
}

func TestParseFundingHistoryFallsBackToTheFundingPeriodWithoutANextFundingTime(t *testing.T) {
	// Built as structs rather than JSON: adapters.Num has no MarshalJSON.
	rows := []FundingHistoryRow{{
		Symbol:               "PERP_HYPE_USDC",
		FundingRate:          num(0.00005),
		FundingRateTimestamp: num(1),
	}}

	fallback := 4.0
	events := ParseFundingHistory("PERP_HYPE_USDC", rows, 0, NOW, &fallback)
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}
	eq(t, "basisHours", events[0].BasisHours, 4.0)

	// No gap and no declared period is no basis at all, and an event with an invented basis would be
	// worse than none.
	if got := ParseFundingHistory("PERP_HYPE_USDC", rows, 0, NOW, nil); len(got) != 0 {
		t.Errorf("events without a fallback: got %d, want none", len(got))
	}
}

// routeDoer answers each URL from a route table and records what was asked for. It is the Go seam for
// the fake HttpClient orderly.test.ts builds.
type routeDoer struct {
	urls  []string
	route func(requested string) []byte
}

func (d *routeDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	body := d.route(requested)
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

func (d *routeDoer) matching(fragment string) []string {
	var out []string
	for _, requested := range d.urls {
		if strings.Contains(requested, fragment) {
			out = append(out, requested)
		}
	}
	return out
}

// newAdapter wires an adapter to a route table. MaxRetries is negative for exactly one attempt per
// call, so the recorded URL count is the walk's own.
func newAdapter(doer *routeDoer) *Adapter {
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func bulkRoute(tb testing.TB) func(string) []byte {
	tb.Helper()
	info := fixtureBytes(tb, "info")
	futures := fixtureBytes(tb, "futures")
	rates := fixtureBytes(tb, "funding_rates")

	return func(requested string) []byte {
		switch {
		case strings.HasSuffix(requested, "/info"):
			return info
		case strings.HasSuffix(requested, "/futures"):
			return futures
		case strings.HasSuffix(requested, "/funding_rates"):
			return rates
		}
		return nil
	}
}

func TestFetchSnapshotsMakesTwoRequestsACycleAndReadsInfoHourly(t *testing.T) {
	doer := &routeDoer{route: bulkRoute(t)}
	adapter := newAdapter(doer)

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(first.Snapshots) != 8 {
		t.Errorf("snapshots: got %d, want 8", len(first.Snapshots))
	}
	if len(first.Settled) != 8 {
		t.Errorf("settled: got %d, want 8", len(first.Settled))
	}

	want := []string{APIBase + "/info", APIBase + "/futures", APIBase + "/funding_rates"}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, requested := range want {
		eq(t, "request", doer.urls[i], requested)
	}

	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+59*60_000)); err != nil {
		t.Fatalf("FetchSnapshots at +59m: %v", err)
	}
	if calls := len(doer.matching("/info")); calls != 1 {
		t.Errorf("info reads at +59m: got %d, want 1", calls)
	}

	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+hourMs)); err != nil {
		t.Fatalf("FetchSnapshots at +1h: %v", err)
	}
	if calls := len(doer.matching("/info")); calls != 2 {
		t.Errorf("info reads at +1h: got %d, want 2", calls)
	}
	// 3 + 2 + 3: /info on the first cycle and again once an hour has passed.
	if len(doer.urls) != 8 {
		t.Errorf("requests: got %d (%v), want 8", len(doer.urls), doer.urls)
	}
}

func TestFetchSnapshotsFailsOnAnUnsuccessfulEnvelope(t *testing.T) {
	// Orderly signals a rate limit as success false inside an HTTP 200, so nothing below the adapter
	// can see it: the cycle must fail rather than read as a venue with nothing listed.
	info := fixtureBytes(t, "info")
	doer := &routeDoer{route: func(requested string) []byte {
		if strings.HasSuffix(requested, "/futures") {
			return []byte(`{"success":false,"code":-1003,"message":"rate limited"}`)
		}
		return info
	}}

	_, err := newAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("FetchSnapshots: want an error, got none")
	}
	if !strings.Contains(err.Error(), "-1003") {
		t.Errorf("error %q does not carry the venue code -1003", err.Error())
	}
}

func TestFetchFundingHistorySendsMsBoundsPagesByMetaAndLoadsInfo(t *testing.T) {
	const settledAt = int64(1_789_315_200_000)
	fromMs := settledAt - 599*4*hourMs

	info := fixtureBytes(t, "info")
	doer := &routeDoer{route: func(requested string) []byte {
		if strings.HasSuffix(requested, "/info") {
			return info
		}
		parsed, err := url.Parse(requested)
		if err != nil {
			return nil
		}
		page, err := strconv.Atoi(parsed.Query().Get("page"))
		if err != nil {
			return nil
		}
		count, offset := 100, 500
		if page == 1 {
			count, offset = 500, 0
		}

		// Synthetic JSON as a raw string: a struct carrying adapters.Num cannot be marshalled back.
		var body strings.Builder
		body.WriteString(`{"success":true,"data":{"rows":[`)
		for i := 0; i < count; i++ {
			if i > 0 {
				body.WriteString(",")
			}
			fmt.Fprintf(&body, `{"symbol":"PERP_HYPE_USDC","funding_rate":0.00005,`+
				`"funding_rate_timestamp":%d,"next_funding_time":null}`,
				settledAt-int64(offset+i)*4*hourMs)
		}
		fmt.Fprintf(&body, `],"meta":{"total":600,"records_per_page":500,"current_page":%d}}}`, page)
		return []byte(body.String())
	}}

	// No cycle has run, so the history call loads /info itself for the declared funding period.
	events, err := newAdapter(doer).FetchFundingHistory(context.Background(), "PERP_HYPE_USDC", fromMs, settledAt)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	want := []string{
		APIBase + "/info",
		fmt.Sprintf("%s/funding_rate_history?symbol=PERP_HYPE_USDC&start_t=%d&end_t=%d&page=1&size=500", APIBase, fromMs, settledAt),
		fmt.Sprintf("%s/funding_rate_history?symbol=PERP_HYPE_USDC&start_t=%d&end_t=%d&page=2&size=500", APIBase, fromMs, settledAt),
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, requested := range want {
		eq(t, "request", doer.urls[i], requested)
	}

	if len(events) != 600 {
		t.Fatalf("events: got %d, want 600", len(events))
	}
	// No next_funding_time on these rows, so every basis is HYPE's declared 4h period.
	for i, event := range events {
		if event.BasisHours != 4 {
			t.Fatalf("events[%d] basisHours: got %v, want 4", i, event.BasisHours)
		}
	}
	eq(t, "oldest settledAt", events[0].SettledAt, fromMs)
}
