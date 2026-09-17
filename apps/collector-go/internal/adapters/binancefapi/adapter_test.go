package binancefapi

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// fakeDoer answers from the fixture files by endpoint, recording every URL so the tests can assert
// what was actually requested — which is the whole point for the exchangeInfo cache and the
// open-interest rotation.
type fakeDoer struct {
	bodies map[string]string
	urls   []string
	// openInterestFails makes the per-symbol read return 500, to prove a failed read never fails a
	// cycle whose funding already arrived.
	openInterestFails bool
}

func (f *fakeDoer) Do(req *http.Request) (*http.Response, error) {
	full := req.URL.String()
	f.urls = append(f.urls, full)

	// The endpoint is the last path segment, minus any query.
	path := req.URL.Path
	endpoint := path[strings.LastIndex(path, "/")+1:]

	if endpoint == "openInterest" {
		if f.openInterestFails {
			return &http.Response{StatusCode: 500, Body: io.NopCloser(strings.NewReader("boom")), Header: http.Header{}}, nil
		}
		symbol := req.URL.Query().Get("symbol")
		body := `{"symbol":"` + symbol + `","openInterest":"1000","time":1}`
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
	}

	body, known := f.bodies[endpoint]
	if !known {
		return &http.Response{StatusCode: 404, Body: io.NopCloser(strings.NewReader("no fixture for " + endpoint)), Header: http.Header{}}, nil
	}
	return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
}

func (f *fakeDoer) calls(endpoint string) []string {
	var out []string
	for _, u := range f.urls {
		parsed, err := url.Parse(u)
		if err != nil {
			continue
		}
		if parsed.Path[strings.LastIndex(parsed.Path, "/")+1:] == endpoint {
			out = append(out, u)
		}
	}
	return out
}

func rawFixture(tb testing.TB, venue, name string) string {
	tb.Helper()
	return string(fixtureBytes(tb, venue, name))
}

func asterDoer(tb testing.TB) *fakeDoer {
	tb.Helper()
	return &fakeDoer{bodies: map[string]string{
		"exchangeInfo": rawFixture(tb, "aster", "exchangeInfo"),
		"premiumIndex": rawFixture(tb, "aster", "premiumIndex"),
		"fundingInfo":  rawFixture(tb, "aster", "fundingInfo"),
		"24hr":         rawFixture(tb, "aster", "ticker24hr"),
		"fundingRate":  rawFixture(tb, "aster", "fundingRate_BTCUSDT"),
	}}
}

func asterAdapter(doer *fakeDoer, budget int) *Adapter {
	// Sleep is a no-op so the suite never spends real time on retry backoff: a failing 5xx would
	// otherwise cost ~3.5 seconds per symbol, which is the production hazard the phase bound exists
	// for and not something a unit test should sit through.
	client := httpclient.New("aster", httpclient.Options{
		Doer:  doer,
		Sleep: func(context.Context, time.Duration) error { return nil },
	})
	return NewAdapter(client, Options{
		VenueID:            "aster",
		BaseURL:            "https://fapi.asterdex.com/fapi/v1",
		Classify:           AsterAssetClass,
		OpenInterestBudget: budget,
	})
}

func at(ms int64) time.Time { return time.UnixMilli(ms).UTC() }

func TestAdapterFetchesBulkEndpointsAndCachesExchangeInfoForAnHour(t *testing.T) {
	doer := asterDoer(t)
	adapter := asterAdapter(doer, 1)
	ctx := context.Background()

	batch, err := adapter.FetchSnapshots(ctx, at(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(batch.Snapshots) != 3 {
		t.Fatalf("snapshots: got %d, want 3", len(batch.Snapshots))
	}

	// exchangeInfo is 1.1 MB on Binance, so it is cached rather than fetched every cycle.
	if got := len(doer.calls("exchangeInfo")); got != 1 {
		t.Errorf("exchangeInfo calls: got %d, want 1", got)
	}
	if _, err := adapter.FetchSnapshots(ctx, at(NOW+30*60_000)); err != nil {
		t.Fatalf("second cycle: %v", err)
	}
	if got := len(doer.calls("exchangeInfo")); got != 1 {
		t.Errorf("within the hour: got %d exchangeInfo calls, want 1", got)
	}
	if _, err := adapter.FetchSnapshots(ctx, at(NOW+int64(time.Hour/time.Millisecond))); err != nil {
		t.Fatalf("third cycle: %v", err)
	}
	if got := len(doer.calls("exchangeInfo")); got != 2 {
		t.Errorf("past the hour: got %d exchangeInfo calls, want 2", got)
	}
}

func TestAdapterRotatesOpenInterestASliceAtATime(t *testing.T) {
	doer := asterDoer(t)
	// Budget 1, so the rotation's order is observable one symbol per cycle.
	adapter := asterAdapter(doer, 1)
	ctx := context.Background()

	withOI := func(t *testing.T, ms int64) []string {
		t.Helper()
		batch, err := adapter.FetchSnapshots(ctx, at(ms))
		if err != nil {
			t.Fatalf("FetchSnapshots: %v", err)
		}
		var filled []string
		for i := range batch.Snapshots {
			if batch.Snapshots[i].OpenInterestUSD != nil {
				filled = append(filled, batch.Snapshots[i].VenueSymbol)
			}
		}
		return filled
	}

	// One symbol per cycle, and what is already known is kept rather than re-read.
	if got := withOI(t, NOW); len(got) != 1 {
		t.Fatalf("first cycle: got %v filled, want 1", got)
	}
	if got := withOI(t, NOW+60_000); len(got) != 2 {
		t.Fatalf("second cycle: got %v filled, want 2", got)
	}
	if got := withOI(t, NOW+2*60_000); len(got) != 3 {
		t.Fatalf("third cycle: got %v filled, want 3", got)
	}
	if got := len(doer.calls("openInterest")); got != 3 {
		t.Errorf("openInterest calls: got %d, want 3", got)
	}

	// Nothing is re-read inside the max age: all three are fresh, so the cycle spends no requests.
	before := len(doer.calls("openInterest"))
	if got := withOI(t, NOW+3*60_000); len(got) != 3 {
		t.Errorf("fourth cycle: got %v filled, want all 3 kept", got)
	}
	if got := len(doer.calls("openInterest")); got != before {
		t.Errorf("inside the max age: got %d new calls, want 0", got-before)
	}

	// Past it, the stalest goes first.
	if got := withOI(t, NOW+6*60_000); len(got) != 3 {
		t.Errorf("after the max age: got %v filled, want 3", got)
	}
	if got := len(doer.calls("openInterest")); got != before+1 {
		t.Errorf("after the max age: got %d new calls, want 1", got-before)
	}
}

func TestAdapterOpenInterestFailureDoesNotFailTheCycle(t *testing.T) {
	doer := asterDoer(t)
	doer.openInterestFails = true
	adapter := asterAdapter(doer, 10)

	// Funding has already arrived by the time open interest is read, and a missing figure renders
	// as unknown rather than as zero — so losing it is strictly better than discarding the cycle.
	batch, err := adapter.FetchSnapshots(context.Background(), at(NOW))
	if err != nil {
		t.Fatalf("a failed open-interest read must not fail the cycle: %v", err)
	}
	if len(batch.Snapshots) != 3 {
		t.Fatalf("snapshots: got %d, want 3", len(batch.Snapshots))
	}
	for i := range batch.Snapshots {
		if batch.Snapshots[i].OpenInterestUSD != nil {
			t.Errorf("%s: got open interest %v, want nil when the read failed",
				batch.Snapshots[i].VenueSymbol, *batch.Snapshots[i].OpenInterestUSD)
		}
	}
}

// syntheticBook builds a venue with n tradable symbols, so a test can observe a sweep giving up
// EARLY. The aster fixture has three, against which "stopped after three" is true whether or not any
// cutoff exists — a test that cannot fail is worse than no test.
func syntheticBook(n int) map[string]string {
	var exchangeInfo, premium, fundingInfo, tickers strings.Builder
	exchangeInfo.WriteString(`{"symbols":[`)
	premium.WriteString(`[`)
	fundingInfo.WriteString(`[`)
	tickers.WriteString(`[`)

	for i := 0; i < n; i++ {
		if i > 0 {
			exchangeInfo.WriteByte(',')
			premium.WriteByte(',')
			fundingInfo.WriteByte(',')
			tickers.WriteByte(',')
		}
		symbol := fmt.Sprintf("SYM%03dUSDT", i)
		base := fmt.Sprintf("SYM%03d", i)
		fmt.Fprintf(&exchangeInfo, `{"symbol":%q,"status":"TRADING","contractType":"PERPETUAL","baseAsset":%q,"quoteAsset":"USDT"}`, symbol, base)
		fmt.Fprintf(&premium, `{"symbol":%q,"markPrice":"100","indexPrice":"100","lastFundingRate":"0.0001","nextFundingTime":1789171200000}`, symbol)
		fmt.Fprintf(&fundingInfo, `{"symbol":%q,"fundingIntervalHours":8}`, symbol)
		fmt.Fprintf(&tickers, `{"symbol":%q,"quoteVolume":"1000"}`, symbol)
	}

	exchangeInfo.WriteString(`]}`)
	premium.WriteString(`]`)
	fundingInfo.WriteString(`]`)
	tickers.WriteString(`]`)

	return map[string]string{
		"exchangeInfo": exchangeInfo.String(),
		"premiumIndex": premium.String(),
		"fundingInfo":  fundingInfo.String(),
		"24hr":         tickers.String(),
	}
}

func TestAdapterAbandonsOpenInterestWhenTheEndpointIsDown(t *testing.T) {
	const symbols = 20
	doer := &fakeDoer{bodies: syntheticBook(symbols), openInterestFails: true}
	// A budget far larger than the book, so only the failure cutoff can stop the sweep.
	adapter := asterAdapter(doer, 500)

	batch, err := adapter.FetchSnapshots(context.Background(), at(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	// The whole point: funding still lands even though open interest is unreachable.
	if len(batch.Snapshots) != symbols {
		t.Fatalf("snapshots: got %d, want %d", len(batch.Snapshots), symbols)
	}

	// Counted in SYMBOLS, not transport calls: each failed read costs 1 try plus 3 retries, so the
	// call count is four times the symbol count and would compare against the wrong unit.
	attempted := map[string]bool{}
	for _, raw := range doer.calls("openInterest") {
		parsed, parseErr := url.Parse(raw)
		if parseErr != nil {
			t.Fatalf("parse %q: %v", raw, parseErr)
		}
		attempted[parsed.Query().Get("symbol")] = true
	}

	// Without a cutoff this would walk all 20 at ~3.5s of backoff each — over a minute inside a
	// 60-second cycle, killed by the 45-second loop timeout, discarding funding that had arrived.
	if len(attempted) > openInterestMaxFailures {
		t.Errorf("attempted %d symbols against a dead endpoint, want at most %d",
			len(attempted), openInterestMaxFailures)
	}
	if len(attempted) == 0 {
		t.Error("want the sweep to try before giving up")
	}
}

func TestAdapterHistoryCarriesTheIntervalAndClassFromTheLastCycle(t *testing.T) {
	doer := asterDoer(t)
	adapter := asterAdapter(doer, 1)
	ctx := context.Background()

	// Before any cycle there is no interval and no declared class, so the basis comes from the gaps
	// and the class defaults to crypto — the same fallback the TypeScript relies on.
	events, err := adapter.FetchFundingHistory(ctx, "BTCUSDT", 1_789_027_200_000, 1_789_142_400_000)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	if len(events) != 5 {
		t.Fatalf("events: got %d, want 5", len(events))
	}
	eq(t, "settledAt[0]", events[0].SettledAt, int64(1_789_027_200_000))
	eq(t, "basisHours", events[0].BasisHours, 8.0)
	eq(t, "base", events[0].Base, "BTC")

	// After a cycle the declared class is known and travels onto the events.
	if _, err := adapter.FetchSnapshots(ctx, at(NOW)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	events, err = adapter.FetchFundingHistory(ctx, "BTCUSDT", 1_789_027_200_000, 1_789_142_400_000)
	if err != nil {
		t.Fatalf("FetchFundingHistory after a cycle: %v", err)
	}
	if len(events) == 0 {
		t.Fatal("no events after a cycle")
	}
	eq(t, "assetClass", string(events[0].AssetClass), "crypto")
}

func TestMembersCarryTheirOwnReadingOfTheVenue(t *testing.T) {
	client := httpclient.New("x", httpclient.Options{Doer: &fakeDoer{bodies: map[string]string{}}})

	// Each member is a configuration, not a copied adapter. These are the differences that matter:
	// WEEX has no fundingInfo and does not publish a usable open interest; Bullet quotes settled
	// rates over a fixed 8h basis and reports history in microseconds.
	weex := Weex(client)
	eq(t, "weex venue", weex.VenueID(), "weex")
	eq(t, "weex open interest", string(weex.opts.OpenInterest), string(None))
	if weex.opts.IntervalSource == nil || weex.opts.IntervalSource.FromPremiumIndex == nil {
		t.Error("weex must read its interval from premiumIndex, having no fundingInfo")
	}

	bullet := Bullet(client)
	eq(t, "bullet open interest", string(bullet.opts.OpenInterest), string(Bulk))
	eq(t, "bullet history unit", string(bullet.opts.FundingRateTimeUnit), string(UnitUs))
	if bullet.opts.HistoryBasisHours == nil || *bullet.opts.HistoryBasisHours != 8 {
		t.Errorf("bullet history basis: got %v, want a fixed 8h", bullet.opts.HistoryBasisHours)
	}

	// Aster and Binance take the defaults: fundingInfo, per-symbol rotation, millisecond stamps.
	for _, member := range []*Adapter{Aster(client), Binance(client).Adapter} {
		eq(t, member.VenueID()+" open interest", string(member.opts.OpenInterest), string(PerSymbol))
		if member.opts.IntervalSource != nil {
			t.Errorf("%s: want the fundingInfo endpoint, not premiumIndex", member.VenueID())
		}
		if member.opts.DefaultIntervalHours != nil {
			t.Errorf("%s: default interval must be nil — an 8h guess is wrong for 466 of 782 symbols",
				member.VenueID())
		}
	}
}
