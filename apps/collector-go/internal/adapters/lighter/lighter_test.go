package lighter

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instants lighter.test.ts uses, so both suites pin identical output.
const (
	// 2026-09-11T16:38:40Z; the next hourly settlement is 17:00:00Z.
	NOW      int64 = 1_789_147_120_000
	nextHour int64 = 1_789_149_600_000
	// 2026-09-13T22:32:02Z, when the Robinhood Chain funding-rates was read; the next is 23:00Z.
	rhNow      int64 = 1_789_338_722_000
	rhNextHour int64 = 1_789_340_400_000
)

func fixtureDir(tb testing.TB, venue string) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", venue)
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatalf("could not find packages/adapters/__fixtures__/%s above the working directory", venue)
	return ""
}

func fixtureBytes(tb testing.TB, venue, name string) []byte {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb, venue), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	return raw
}

// The SAME files packages/adapters/src/venues/lighter.test.ts reads.
func load[T any](tb testing.TB, venue, name string, into *T) {
	tb.Helper()
	if err := json.Unmarshal(fixtureBytes(tb, venue, name), into); err != nil {
		tb.Fatalf("decode %s/%s: %v", venue, name, err)
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

func symbols(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for i := range snapshots {
		out = append(out, snapshots[i].VenueSymbol)
	}
	return out
}

func eqStrings(tb testing.TB, label string, got, want []string) {
	tb.Helper()
	if strings.Join(got, ",") != strings.Join(want, ",") {
		tb.Errorf("%s: got %v, want %v", label, got, want)
	}
}

// num builds a decoded venue number the way the wire does. adapters.Num has no MarshalJSON, so a
// synthetic fixture is raw JSON text and never a marshalled struct.
func num(tb testing.TB, raw string) adapters.Num {
	tb.Helper()
	var n adapters.Num
	if err := n.UnmarshalJSON([]byte(raw)); err != nil {
		tb.Fatalf("decode %q: %v", raw, err)
	}
	return n
}

func mainnetFixtures(tb testing.TB) (FundingRates, OrderBookDetails) {
	tb.Helper()
	var rates FundingRates
	var details OrderBookDetails
	load(tb, "lighter", "funding-rates", &rates)
	load(tb, "lighter", "order-book-details", &details)
	return rates, details
}

func rhFixtures(tb testing.TB) (FundingRates, OrderBookDetails) {
	tb.Helper()
	var rates FundingRates
	var details OrderBookDetails
	load(tb, "lighter-rh", "funding-rates", &rates)
	load(tb, "lighter-rh", "order-book-details", &details)
	return rates, details
}

func TestParseSnapshotsKeepsLightersOwn8hRatesJoinedWithMarketDetails(t *testing.T) {
	rates, details := mainnetFixtures(t)
	snapshots := ParseSnapshots(rates, details, NOW, Mainnet)

	// Relayed binance/bybit/hyperliquid rows are dropped.
	eqStrings(t, "venueSymbols", symbols(snapshots), []string{"ETH", "BTC"})
	btc := snapshots[1]

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "base", btc.Base, "BTC")
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	// Declared by the docs for every perp; the API's perp quote_asset_id is 0 (no asset).
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.00009599999999999999)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != nextHour {
		t.Errorf("nextFundingAt: got %v, want %d", btc.NextFundingAt, nextHour)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77758.9)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77791.3)

	// Open interest is base units, so money needs the mark. The factors are float64 VARIABLES rather
	// than an untyped constant product: Go folds constant expressions at arbitrary precision, where
	// the parser multiplies two already-rounded float64s.
	openInterest, mark := 2092.76507, 77758.9
	closeTo(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), openInterest*mark, 1e-4)
	closeTo(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 850015955.986308, 1e-6)

	// 0.000096 over 8h -> 10.512% simple APR.
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 10.512, 1e-6)
}

func TestParseSnapshotsSkipsMarketsThatArentActive(t *testing.T) {
	rates, details := mainnetFixtures(t)
	// PIPPIN is `inactive` in orderBookDetails, so its rate has no live market to join.
	rates.FundingRates = append(rates.FundingRates, FundingRate{
		MarketID: 135, Exchange: "lighter", Symbol: "PIPPIN", Rate: num(t, "0.0001"),
	})

	for _, symbol := range symbols(ParseSnapshots(rates, details, NOW, Mainnet)) {
		if symbol == "PIPPIN" {
			t.Error("PIPPIN is inactive and must not be published")
		}
	}
}

func TestParseSnapshotsDropsTheRowsLighterRelaysFromOtherVenues(t *testing.T) {
	rates, details := mainnetFixtures(t)

	// The guard this test exists for: `funding-rates` carries binance, bybit and hyperliquid rows on
	// the same market_id and symbol as Lighter's own. Without the exchange filter their rates would
	// be republished under Lighter's venue id, and nothing downstream could tell.
	relayed := map[float64]string{}
	for _, row := range rates.FundingRates {
		if row.Exchange != VenueID {
			relayed[row.Rate.Val] = row.Exchange
		}
	}
	if len(relayed) == 0 {
		t.Fatal("the fixture must carry relayed rows, or this test proves nothing")
	}
	for _, snapshot := range ParseSnapshots(rates, details, NOW, Mainnet) {
		if venue, republished := relayed[snapshot.Rate]; republished {
			t.Errorf("%s: published %s's rate %v as Lighter's own", snapshot.VenueSymbol, venue, snapshot.Rate)
		}
	}
}

func TestAssetClassMarketsTakeTheClassLighterPublishes(t *testing.T) {
	// market_id, symbol and mark_price as orderBookDetails returned them on 2026-09-14.
	markets := []struct {
		marketID  int64
		symbol    string
		markPrice string
	}{
		{190, "QNT", "48.794"},
		{211, "BB", "7.7244"},
		{214, "WEN", "7.6081"},
		{198, "USDHKD", "7.8423"},
		{92, "XAU", "4345.03"},
		{180, "US500", "7610.6"},
		{227, "US10Y", "98.26"},
		{48, "PAXG", "4344.45"},
		{232, "AI", "0.27601"},
		{42, "SPX", "0.49561"},
		{1, "BTC", "77317.8"},
	}

	var rates FundingRates
	var details OrderBookDetails
	for _, market := range markets {
		details.OrderBookDetails = append(details.OrderBookDetails, OrderBookDetail{
			MarketID: market.marketID, Symbol: market.symbol,
			MarketType: "perp", Status: "active", MarkPrice: num(t, `"`+market.markPrice+`"`),
		})
		rates.FundingRates = append(rates.FundingRates, FundingRate{
			MarketID: market.marketID, Exchange: "lighter", Symbol: market.symbol,
			Rate: num(t, "0.000032"),
		})
	}

	snapshots := ParseSnapshots(rates, details, NOW, Mainnet)
	if len(snapshots) != len(markets) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(markets))
	}

	want := map[string]core.AssetClass{
		// Quantinuum stock at 48.79, not the Quant token at 64.3, whatever the app config calls it.
		"QNT": core.ClassEquity,
		// BlackBerry and Wendy's, not BounceBit and the memecoin.
		"BB":  core.ClassEquity,
		"WEN": core.ClassEquity,
		// Typed fx by the docs, although the app config says CRYPTO.
		"USDHKD": core.ClassFX,
		"XAU":    core.ClassCommodity,
		"US500":  core.ClassIndex,
		// A bond, filed with yields as an index.
		"US10Y": core.ClassIndex,
		// A gold token: the config's COMMODITIES label is not taken.
		"PAXG": core.ClassCrypto,
		// Artificial Inu and SPX6900, not tradfi however they are spelt.
		"AI":  core.ClassCrypto,
		"SPX": core.ClassCrypto,
		"BTC": core.ClassCrypto,
	}
	for _, snapshot := range snapshots {
		eq(t, snapshot.VenueSymbol+" class", snapshot.AssetClass, want[snapshot.VenueSymbol])
		// Every market settles in USDC, whatever its class, and a symbol like USDHKD lends it no quote.
		eq(t, snapshot.VenueSymbol+" quote", str(t, "quote", snapshot.Quote), "USDC")
	}
}

func TestAssetClassTablesStaySortedOneEntryPerMarket(t *testing.T) {
	for _, table := range []struct {
		name    string
		entries []AssetClassEntry
	}{{"lighter", AssetClasses}, {"lighter-rh", RhAssetClasses}} {
		keys := make([]string, 0, len(table.entries))
		seen := map[string]bool{}
		for _, entry := range table.entries {
			if seen[entry.Symbol] {
				t.Errorf("%s: %s is listed twice", table.name, entry.Symbol)
			}
			seen[entry.Symbol] = true
			keys = append(keys, entry.Symbol)
		}
		if !sort.StringsAreSorted(keys) {
			t.Errorf("%s: the table is not sorted", table.name)
		}
	}
}

func TestParseFundingsConvertsUnsignedHourlyPercentIntoSignedFractions(t *testing.T) {
	var payload Fundings
	load(t, "lighter", "fundings-btc", &payload)

	// Reversed, plus a later short-paid row, so the ordering is the parser's and not the venue's.
	shuffled := Fundings{}
	for i := len(payload.Fundings) - 1; i >= 0; i-- {
		shuffled.Fundings = append(shuffled.Fundings, payload.Fundings[i])
	}
	shuffled.Fundings = append(shuffled.Fundings, Funding{
		Timestamp: num(t, "1789149600"), Value: "0.08", Rate: num(t, `"0.0001"`), Direction: "short",
	})

	events := ParseFundings("BTC", shuffled, Mainnet)
	wantAt := []int64{
		1_789_135_200_000, 1_789_138_800_000, 1_789_142_400_000, 1_789_146_000_000, 1_789_149_600_000,
	}
	if len(events) != len(wantAt) {
		t.Fatalf("events: got %d, want %d", len(events), len(wantAt))
	}
	for i, at := range wantAt {
		eq(t, fmt.Sprintf("settledAt[%d]", i), events[i].SettledAt, at)
	}

	eq(t, "venueId", events[0].VenueID, VenueID)
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTC")
	eq(t, "base", events[0].Base, "BTC")
	eq(t, "quote", str(t, "quote", events[0].Quote), "USDC")
	eq(t, "basisHours", events[0].BasisHours, 1.0)
	if events[0].MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *events[0].MarkPrice)
	}
	closeTo(t, "rate[0]", events[0].Rate, 0.00001, 1e-12) // 0.0010% paid by longs
	closeTo(t, "rate[1]", events[1].Rate, 0.000001, 1e-12)
	closeTo(t, "rate[4]", events[4].Rate, -0.000001, 1e-12) // shorts paid
}

// fakeDoer answers every request from a handler, recording the URLs so the tests can assert exactly
// what was requested and in what order.
type fakeDoer struct {
	urls   []string
	handle func(url string) string
}

func (f *fakeDoer) Do(req *http.Request) (*http.Response, error) {
	full := req.URL.String()
	f.urls = append(f.urls, full)
	return &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(f.handle(full))),
		Header:     http.Header{},
	}, nil
}

func adapterFor(deployment Deployment, doer *fakeDoer) *Adapter {
	// Sleep is a no-op so the suite never spends real time on this venue's 1.1s spacing.
	client := httpclient.New(deployment.VenueID, httpclient.Options{
		Doer:  doer,
		Sleep: func(context.Context, time.Duration) error { return nil },
	})
	return NewAdapter(client, deployment)
}

func TestAdapterSnapshotsFetchRatesAndDetails(t *testing.T) {
	rates := string(fixtureBytes(t, "lighter", "funding-rates"))
	details := string(fixtureBytes(t, "lighter", "order-book-details"))
	doer := &fakeDoer{handle: func(url string) string {
		if strings.Contains(url, "funding-rates") {
			return rates
		}
		return details
	}}

	batch, err := NewMainnetAdapter(adapterFor(Mainnet, doer).client).FetchSnapshots(
		context.Background(), time.UnixMilli(NOW).UTC())
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	eqStrings(t, "urls", doer.urls, []string{API + "/funding-rates", API + "/orderBookDetails"})
	if len(batch.Snapshots) != 2 {
		t.Fatalf("snapshots: got %d, want 2", len(batch.Snapshots))
	}
	for _, snapshot := range batch.Snapshots {
		eq(t, snapshot.VenueSymbol+" quote", str(t, "quote", snapshot.Quote), "USDC")
	}
}

// fundingsPage builds a `fundings` response as raw JSON text. Synthetic fixtures are never built by
// marshalling the wire structs: adapters.Num decodes but does not encode.
func fundingsPage(fromSec int64, rows int, rate, direction string) string {
	var b strings.Builder
	b.WriteString(`{"fundings":[`)
	for i := 0; i < rows; i++ {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, `{"timestamp":%d,"rate":%q,"direction":%q}`, fromSec+int64(i)*3600, rate, direction)
	}
	b.WriteString(`]}`)
	return b.String()
}

func TestAdapterHistoryResolvesTheMarketIDAndPaginatesInSeconds(t *testing.T) {
	details := string(fixtureBytes(t, "lighter", "order-book-details"))
	const from int64 = 1_789_000_000_000
	fromSec := from / 1000

	fullPage := fundingsPage(fromSec, historyPageSize, "0.0010", "long")
	lastPage := fundingsPage(fromSec+historyPageSize*3600, 1, "0.0002", "short")
	doer := &fakeDoer{handle: func(url string) string {
		if strings.HasSuffix(url, "/orderBookDetails") {
			return details
		}
		if strings.Contains(url, fmt.Sprintf("start_timestamp=%d&", fromSec)) {
			return fullPage
		}
		return lastPage
	}}

	adapter := adapterFor(Mainnet, doer)
	events, err := adapter.FetchFundingHistory(context.Background(), "BTC", from, from+800*3_600_000)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	endSec := fromSec + 800*3600
	eqStrings(t, "urls", doer.urls, []string{
		API + "/orderBookDetails",
		fmt.Sprintf("%s/fundings?market_id=1&resolution=1h&start_timestamp=%d&end_timestamp=%d&count_back=0",
			API, fromSec, endSec),
		fmt.Sprintf("%s/fundings?market_id=1&resolution=1h&start_timestamp=%d&end_timestamp=%d&count_back=0",
			API, fromSec+749*3600+1, endSec),
	})
	if len(events) != 751 {
		t.Fatalf("events: got %d, want 751", len(events))
	}
	closeTo(t, "last rate", events[len(events)-1].Rate, -0.000002, 1e-12)
}

func TestAdapterHistoryForAnUnknownSymbolReturnsNothing(t *testing.T) {
	details := string(fixtureBytes(t, "lighter", "order-book-details"))
	doer := &fakeDoer{handle: func(string) string { return details }}

	events, err := adapterFor(Mainnet, doer).FetchFundingHistory(context.Background(), "NOPE", 0, 1)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("events: got %d, want none for a symbol the venue does not list", len(events))
	}
}

func TestRobinhoodChainNormalizesBTCWithItsOwnVenueIDAndUSDG(t *testing.T) {
	rates, details := rhFixtures(t)
	snapshots := ParseSnapshots(rates, details, rhNow, RH)

	// Relayed binance, bybit and hyperliquid BTC rows are dropped here too.
	eqStrings(t, "venueSymbols", symbols(snapshots),
		[]string{"BTC", "OPENAI", "SPY", "AAPL", "ETH", "XAU"})

	btc := snapshots[0]
	eq(t, "venueId", btc.VenueID, VenueIDRH)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	eq(t, "quote", str(t, "quote", btc.Quote), "USDG")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, rhNow)
	eq(t, "rate", btc.Rate, 0.000023999999999999997)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != rhNextHour {
		t.Errorf("nextFundingAt: got %v, want %d", btc.NextFundingAt, rhNextHour)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76806.1)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76843.5)
	openInterest, mark := 266.23406, 76806.1
	closeTo(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), openInterest*mark, 1e-6)
	closeTo(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 52979592.957577, 1e-6)

	// ETH 0.000096 over 8h is 0.000012/h: its hourly fundings rows read 0.0012% that afternoon.
	for _, snapshot := range snapshots {
		if snapshot.VenueSymbol == "ETH" {
			closeTo(t, "eth per hour", snapshot.Rate/snapshot.BasisHours, 0.000012, 1e-12)
		}
	}
}

func TestRobinhoodChainClassesComeFromItsOwnTable(t *testing.T) {
	rates, details := rhFixtures(t)

	// SPY is typed index by the docs, and core files ETFs as equity.
	want := map[string]core.AssetClass{
		"BTC": core.ClassCrypto, "OPENAI": core.ClassEquity, "SPY": core.ClassEquity,
		"AAPL": core.ClassEquity, "ETH": core.ClassCrypto, "XAU": core.ClassCommodity,
	}
	snapshots := ParseSnapshots(rates, details, rhNow, RH)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for _, snapshot := range snapshots {
		eq(t, snapshot.VenueSymbol+" class", snapshot.AssetClass, want[snapshot.VenueSymbol])
	}

	// RH-only listings nobody has declared stay crypto rather than being guessed from the ticker.
	for _, undeclared := range []string{"SLV", "USO", "SGOV", "SOFI", "USAR"} {
		if _, declared := RH.AssetClasses[undeclared]; declared {
			t.Errorf("%s is undeclared by Lighter and must not be typed here", undeclared)
		}
	}
}

func TestRobinhoodChainHistoryRowsCarryItsVenueIDAndQuote(t *testing.T) {
	var payload Fundings
	load(t, "lighter-rh", "fundings-btc", &payload)

	events := ParseFundings("BTC", payload, RH)
	wantAt := []int64{1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000}
	wantPercent := []float64{0.0010, 0.0011, 0.0005}
	if len(events) != len(wantAt) {
		t.Fatalf("events: got %d, want %d", len(events), len(wantAt))
	}
	for i, at := range wantAt {
		eq(t, fmt.Sprintf("settledAt[%d]", i), events[i].SettledAt, at)
		eq(t, fmt.Sprintf("venueId[%d]", i), events[i].VenueID, VenueIDRH)
		eq(t, fmt.Sprintf("quote[%d]", i), str(t, "quote", events[i].Quote), "USDG")
		closeTo(t, fmt.Sprintf("rate[%d]", i), events[i].Rate, wantPercent[i]/100, 1e-12)
	}
}

func TestRobinhoodChainAdapterPollsItsOwnHostUnderItsOwnVenueID(t *testing.T) {
	rates := string(fixtureBytes(t, "lighter-rh", "funding-rates"))
	details := string(fixtureBytes(t, "lighter-rh", "order-book-details"))
	doer := &fakeDoer{handle: func(url string) string {
		if strings.Contains(url, "funding-rates") {
			return rates
		}
		return details
	}}

	adapter := NewRHAdapter(adapterFor(RH, doer).client)
	batch, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(rhNow).UTC())
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	eq(t, "venueId", adapter.VenueID(), VenueIDRH)
	// Unauthenticated REST is limited to ~60 requests/min.
	eq(t, "minInterval", MinInterval, 1100*time.Millisecond)
	eqStrings(t, "urls", doer.urls, []string{APIRH + "/funding-rates", APIRH + "/orderBookDetails"})
	if len(batch.Snapshots) == 0 {
		t.Fatal("no snapshots")
	}
	for _, snapshot := range batch.Snapshots {
		eq(t, snapshot.VenueSymbol+" quote", str(t, "quote", snapshot.Quote), "USDG")
	}
}

// The two deployments are separate adapters that may run at the same time, and their market ids do
// not agree: RH's market 42 is OPENAI where mainnet's is SPX. Run under -race.
func TestDeploymentsDoNotShareState(t *testing.T) {
	mainnetDoer := &fakeDoer{handle: func(string) string {
		return string(fixtureBytes(t, "lighter", "order-book-details"))
	}}
	rhDoer := &fakeDoer{handle: func(string) string {
		return string(fixtureBytes(t, "lighter-rh", "order-book-details"))
	}}
	mainnet := adapterFor(Mainnet, mainnetDoer)
	rh := adapterFor(RH, rhDoer)

	done := make(chan struct{})
	go func() {
		defer close(done)
		if _, _, err := rh.marketIDFor(context.Background(), "OPENAI"); err != nil {
			t.Errorf("rh marketIDFor: %v", err)
		}
	}()
	if _, _, err := mainnet.marketIDFor(context.Background(), "BTC"); err != nil {
		t.Fatalf("mainnet marketIDFor: %v", err)
	}
	<-done

	// Mainnet has never seen OPENAI, and must not have learned it from the other deployment.
	if _, known := mainnet.lookup("OPENAI"); known {
		t.Error("mainnet knows a Robinhood Chain market: the id cache is shared")
	}
	id, known := rh.lookup("OPENAI")
	if !known || id != 42 {
		t.Errorf("rh OPENAI: got %d (known %v), want 42", id, known)
	}
}
