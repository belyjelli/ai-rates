package velocity

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

// NOW is the instant velocity.test.ts pins: 2026-09-13T22:31:54Z, when the fixture was read. NEXT
// is the settlement it counts down to, 23:00Z, since Velocity funds on the top of every hour.
const (
	NOW  int64 = 1_789_338_714_000
	NEXT int64 = 1_789_340_400_000
)

// maxSafeInteger is Number.MAX_SAFE_INTEGER, the open upper bound the TypeScript history test passes.
const maxSafeInteger int64 = 9_007_199_254_740_991

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files
// packages/adapters/src/venues/velocity.test.ts reads: the port is verified against the exact bytes
// the original parser is pinned to, which is what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "velocity")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/velocity above the working directory")
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

func loadMarkets(tb testing.TB) []Market {
	tb.Helper()
	var body MarketsResponse
	loadFixture(tb, "stats-markets", &body)
	if body.Markets == nil {
		tb.Fatal("stats-markets: no markets array")
	}
	return *body.Markets
}

func loadFunding(tb testing.TB) FundingRatesResponse {
	tb.Helper()
	var body FundingRatesResponse
	loadFixture(tb, "fundingRates-BTC-PERP", &body)
	if body.Records == nil {
		tb.Fatal("fundingRates-BTC-PERP: no records array")
	}
	return body
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

// closeTo is Bun's toBeCloseTo(value, digits): the difference has to be under half a unit in the
// last asserted place.
func closeTo(tb testing.TB, label string, got, want, tolerance float64) {
	tb.Helper()
	if diff := got - want; diff > tolerance || diff < -tolerance {
		tb.Errorf("%s: got %v, want %v (within %v)", label, got, want, tolerance)
	}
}

// product multiplies left to right at runtime, exactly as adapters.Mul does. Written as a Go
// constant expression instead, `0.335 * 76908.6` is folded at arbitrary precision and can land one
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

func TestParseMarketsNormalizesBTCPERP(t *testing.T) {
	got := snapshotBySymbol(ParseMarkets(loadMarkets(t), NOW), "BTC-PERP")
	if got == nil {
		t.Fatal("BTC-PERP missing from snapshots")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "venueSymbol", got.VenueSymbol, "BTC-PERP")
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)

	// `fundingRate` {long: "-0.008181", short: "0.008181"}: longs pay 0.008181% an hour, and the
	// stored rate is what longs pay as a fraction. Divided at runtime, not folded as a constant.
	percent := 0.008181
	eq(t, "rate", got.Rate, percent/100)
	eq(t, "basisHours", got.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 1.0)
	if got.NextFundingAt == nil || *got.NextFundingAt != NEXT {
		t.Errorf("nextFundingAt: got %v, want %d", got.NextFundingAt, NEXT)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 76908.6)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 76753.471975)
	// The larger side in base units (0.335 long against -0.0206 short; the AMM holds the rest).
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), product(0.335, 76908.6))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 354.474212)
	eq(t, "maxLeverage", f64(t, "maxLeverage", got.MaxLeverage), 20)

	// /stats/markets carries no book, so these stay absent rather than reading as zero — which is
	// what the TypeScript object's missing keys mean.
	for _, absent := range []struct {
		label string
		got   *float64
	}{
		{"bestBid", got.BestBid},
		{"bestBidSizeUsd", got.BestBidSizeUSD},
		{"bestAsk", got.BestAsk},
		{"bestAskSizeUsd", got.BestAskSizeUSD},
	} {
		if absent.got != nil {
			t.Errorf("%s: got %v, want nil", absent.label, *absent.got)
		}
	}
}

func TestParseMarketsHourlyBasisMatchesThePremiumNotABasisError(t *testing.T) {
	btc := snapshotBySymbol(ParseMarkets(loadMarkets(t), NOW), "BTC-PERP")
	if btc == nil {
		t.Fatal("BTC-PERP missing from snapshots")
	}

	// 0.008181% an hour is 71.7% APR. The mark sat 0.20% over the oracle, and the docs charge that
	// gap / 24 an hour -- 0.0084% -- so this is premium. An 8h or 24h misreading would be 9% or 3%.
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 71.67, 0.05)

	mark := f64(t, "markPrice", btc.MarkPrice)
	index := f64(t, "indexPrice", btc.IndexPrice)
	premium := (mark - index) / index
	closeTo(t, "premium/24", premium/24, btc.Rate, 0.5e-5)
}

func TestParseMarketsKeepsOnlyActiveVisiblePerps(t *testing.T) {
	markets := loadMarkets(t)
	snapshots := ParseMarkets(markets, NOW)

	// The four spot rows (USDT, SOL, wBTC, wETH) never reach a snapshot.
	want := []string{"SOL-PERP", "BTC-PERP", "ETH-PERP"}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("symbol[%d]", i), snapshots[i].VenueSymbol, symbol)
	}

	// A closing market goes ReduceOnly then Settlement, and new positions are refused from the
	// first of those; a hidden one is off the interface entirely. Copied from the decoded rows
	// rather than rebuilt as JSON: adapters.Num has no MarshalJSON.
	var eth, sol *Market
	for i := range markets {
		switch markets[i].Symbol {
		case "ETH-PERP":
			eth = &markets[i]
		case "SOL-PERP":
			sol = &markets[i]
		}
	}
	if eth == nil || sol == nil {
		t.Fatal("fixture changed")
	}
	closingETH := *eth
	closingETH.Status = "reduceonly"
	hiddenSOL := *sol
	hiddenSOL.UIStatus = "hidden"

	if closing := ParseMarkets([]Market{closingETH, hiddenSOL}, NOW); len(closing) != 0 {
		t.Errorf("closing markets: got %d snapshots, want none", len(closing))
	}
}

func TestParseMarketsEverySettlesInUSDTAndTheAPIDeclaresNoClass(t *testing.T) {
	snapshots := ParseMarkets(loadMarkets(t), NOW)

	want := []string{"SOL|crypto|USDT", "BTC|crypto|USDT", "ETH|crypto|USDT"}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		got := fmt.Sprintf("%s|%s|%s", snapshots[i].Base, snapshots[i].AssetClass,
			str(t, "quote", snapshots[i].Quote))
		eq(t, fmt.Sprintf("snapshot[%d]", i), got, w)
	}
}

func TestParseFundingRatesQuotePerUnitBecomesAFractionOverTheOracleTwap(t *testing.T) {
	events := ParseFundingRates(*loadFunding(t).Records, "BTC-PERP", 0, maxSafeInteger)

	want := []int64{1_789_329_660_000, 1_789_333_259_000, 1_789_336_860_000}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, settledAt := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, settledAt)
	}

	newest := events[2]
	eq(t, "venueId", newest.VenueID, VenueID)
	eq(t, "venueSymbol", newest.VenueSymbol, "BTC-PERP")
	eq(t, "base", newest.Base, "BTC")
	eq(t, "quote", str(t, "quote", newest.Quote), "USDT")
	eq(t, "multiplier", newest.Multiplier, 1.0)
	eq(t, "assetClass", newest.AssetClass, core.ClassCrypto)
	if newest.Dex != nil {
		t.Errorf("dex: got %q, want nil", *newest.Dex)
	}
	eq(t, "settledAt", newest.SettledAt, int64(1_789_336_860_000))
	// Quote per base unit over the oracle TWAP, divided at runtime so the two suites agree bit for
	// bit rather than to whatever a folded constant expression rounds to.
	perUnit, oracleTwap := 6.399237833, 77333.726817
	eq(t, "rate", newest.Rate, perUnit/oracleTwap)
	eq(t, "basisHours", newest.BasisHours, 1.0)
	if newest.MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *newest.MarkPrice)
	}
	// 0.0083% an hour, the same order as the live estimate above.
	closeTo(t, "rate magnitude", newest.Rate, 0.0000827, 0.5e-7)
}

func TestParseFundingRatesDropsRowsOutsideTheWindow(t *testing.T) {
	events := ParseFundingRates(*loadFunding(t).Records, "BTC-PERP", 1_789_333_000_000, 1_789_336_000_000)
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}
	eq(t, "settledAt", events[0].SettledAt, int64(1_789_333_259_000))
}

// fixtureDoer answers the cursor-bearing request with an older page and everything else with the
// recorded body, recording the URLs asked for. It is the Go seam for the fake HttpClient
// velocity.test.ts builds: the point of the history test is which URLs the paging walk asks for.
type fixtureDoer struct {
	urls  []string
	body  []byte
	older []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	body := d.body
	if d.older != nil && strings.Contains(requested, "page=") {
		body = d.older
	}
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

// newAdapter builds an adapter whose client makes exactly one attempt per call, so a URL count is
// the walk's own rather than the retry policy's.
func newAdapter(doer *fixtureDoer) *Adapter {
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsTakesOneRequest(t *testing.T) {
	doer := &fixtureDoer{body: fixtureBytes(t, "stats-markets")}

	got, err := newAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(got.Snapshots) != 3 {
		t.Fatalf("snapshots: got %d, want 3", len(got.Snapshots))
	}
	if len(got.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(got.Settled))
	}
	if len(doer.urls) != 1 {
		t.Fatalf("urls: got %d (%v), want 1", len(doer.urls), doer.urls)
	}
	eq(t, "url", doer.urls[0], baseURL+"/stats/markets")
}

func TestFetchFundingHistoryPagesWithTheCursorUntilItPassesTheWindowStart(t *testing.T) {
	funding := loadFunding(t)
	if funding.Meta == nil || funding.Meta.NextPage == nil {
		t.Fatal("fixture carries no nextPage cursor")
	}
	token := *funding.Meta.NextPage
	newest := (*funding.Records)[2]

	// A second page whose single row sits before the window start, so the walk stops there. Built as
	// raw JSON because adapters.Num has no MarshalJSON: a struct holding one cannot be round-tripped.
	older := fmt.Sprintf(`{"success":true,"meta":{"nextPage":"more"},"records":[{
		"ts":1789300000,"symbol":%q,"fundingRate":"6.206000708","fundingRateLong":"6.206000708",
		"fundingRateShort":"6.206000708","oraclePriceTwap":"77262.392462","markPriceTwap":"77426.786640"}]}`,
		newest.Symbol)

	doer := &fixtureDoer{
		body:  fixtureBytes(t, "fundingRates-BTC-PERP"),
		older: []byte(older),
	}

	from := int64(1_789_310_000_000)
	events, err := newAdapter(doer).FetchFundingHistory(context.Background(), "BTC-PERP", from, NOW)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	// The token is base64: alphanumerics plus trailing padding, so encodeURIComponent and Go's query
	// escaping agree on it character for character.
	want := []string{
		baseURL + "/market/BTC-PERP/fundingRates?limit=750",
		baseURL + "/market/BTC-PERP/fundingRates?limit=750&page=" + strings.ReplaceAll(token, "=", "%3D"),
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("urls: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, u := range want {
		eq(t, fmt.Sprintf("url[%d]", i), doer.urls[i], u)
	}

	// The older page's row falls before `from`, so only the first page's three survive.
	if len(events) != 3 {
		t.Fatalf("events: got %d, want 3", len(events))
	}
}

func TestFetchSnapshotsRejectsAResponseWithNoMarketsArray(t *testing.T) {
	// A response that lost its payload fails the cycle rather than reading as a venue with nothing
	// listed, which is what the TypeScript `!Array.isArray(body?.markets)` throw is for.
	doer := &fixtureDoer{body: []byte(`{"success":true}`)}
	if _, err := newAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW)); err == nil {
		t.Fatal("want an error for a response with no markets array, got nil")
	}
}
