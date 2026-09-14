package extended

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

// NOW is the same instant extended.test.ts uses (2026-09-13T22:03:20Z), so the two suites pin
// identical output.
const NOW int64 = 1_789_337_000_000

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files
// packages/adapters/src/venues/extended.test.ts reads: the port is verified against the exact bytes
// the original parser is pinned to, which is what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "extended")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/extended above the working directory")
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

func markets(tb testing.TB) Response[[]Market] {
	tb.Helper()
	var body Response[[]Market]
	loadFixture(tb, "info-markets", &body)
	return body
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

func symbols(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for i := range snapshots {
		out = append(out, snapshots[i].VenueSymbol)
	}
	return out
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

func TestParseSnapshotsNormalizesBTCAsAnHourlyRateSettlingInUSDC(t *testing.T) {
	btc := find(t, ParseSnapshots(markets(t), NOW), "BTC-USD")

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-USD")
	eq(t, "base", btc.Base, "BTC")
	// USDC, not the symbol's or collateralAssetName's USD: PnL is paid in USDC.
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %q, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.000013)
	// Extended quotes funding per hour and settles hourly, so basis and interval are both 1.
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	// nextFundingRate is the epoch ms of the next payment, whatever its name says.
	if btc.NextFundingAt == nil {
		t.Fatal("nextFundingAt: want a value, got nil")
	}
	eq(t, "nextFundingAt", *btc.NextFundingAt, int64(1_789_340_400_000))
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77060.427881750001)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77100.406683774985)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), 44808704.907173)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 72466662.2649)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 50.0)
}

func TestHourlyRateAnnualizesToTheVenuesElevenPercentAPR(t *testing.T) {
	btc := find(t, ParseSnapshots(markets(t), NOW), "BTC-USD")

	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 11.388, 3)
}

func TestOpenInterestIsAlreadyUSD(t *testing.T) {
	btc := find(t, ParseSnapshots(markets(t), NOW), "BTC-USD")

	// Base OI times the venue's own mark lands within the mark's drift between the two fields'
	// snapshots. Computed from the parsed mark rather than a folded literal, so the comparison sees
	// the same rounding the runtime does.
	mark := f64(t, "markPrice", btc.MarkPrice)
	ratio := f64(t, "openInterestUsd", btc.OpenInterestUSD) / (579.7751 * mark)
	closeTo(t, "openInterestUsd/baseOI*mark", ratio, 1, 2)
}

func TestParseSnapshotsKeepsOnlyActivePerpetuals(t *testing.T) {
	// Skipped from the fixture: GILD (PRELISTED), MKR (REDUCE_ONLY), NOW_24_5 (DELISTED), BTCSPOT (SPOT).
	want := []string{
		"BTC-USD", "ETH-USD", "1000PEPE-USD", "PAXG-USD", "XAU-USD",
		"MU_24_5-USD", "SPX500m-USD", "JP225-USD", "EUR-USD", "OPENAI-USD",
	}
	got := symbols(ParseSnapshots(markets(t), NOW))
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %v, want %v", got, want)
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("snapshot[%d]", i), got[i], symbol)
	}
}

func TestClassComesFromCategoryAndSubCategoryAndBaseFromTheParser(t *testing.T) {
	want := []struct {
		symbol     string
		base       string
		multiplier float64
		class      core.AssetClass
	}{
		{"BTC-USD", "BTC", 1, core.ClassCrypto},
		{"ETH-USD", "ETH", 1, core.ClassCrypto},
		{"1000PEPE-USD", "PEPE", 1000, core.ClassCrypto},
		// Crypto / Commodity: a gold token, crypto on the venue's own word.
		{"PAXG-USD", "PAXG", 1, core.ClassCrypto},
		{"XAU-USD", "XAU", 1, core.ClassCommodity},
		// assetName is MU_24_5; uiName MU-USD and the parser agree on MU.
		{"MU_24_5-USD", "MU", 1, core.ClassEquity},
		// Declared ETF/Index; aliased SPX500M -> US500 on price evidence, which the index table keeps index.
		{"SPX500m-USD", "US500", 1, core.ClassIndex},
		{"JP225-USD", "JP225", 1, core.ClassIndex},
		{"EUR-USD", "EUR", 1, core.ClassFX},
		// Pre-market is pre-IPO shares.
		{"OPENAI-USD", "OPENAI", 1, core.ClassEquity},
	}

	snapshots := ParseSnapshots(markets(t), NOW)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("snapshot[%d].venueSymbol", i), snapshots[i].VenueSymbol, w.symbol)
		eq(t, fmt.Sprintf("snapshot[%d].base", i), snapshots[i].Base, w.base)
		eq(t, fmt.Sprintf("snapshot[%d].multiplier", i), snapshots[i].Multiplier, w.multiplier)
		eq(t, fmt.Sprintf("snapshot[%d].assetClass", i), snapshots[i].AssetClass, w.class)
	}
}

func TestEveryMarketQuotesUSDCWhateverCollateralAssetNameSays(t *testing.T) {
	body := markets(t)
	for _, m := range body.Data {
		eq(t, "collateralAssetName/"+m.Name, m.CollateralAssetName, "USD")
	}
	for _, s := range ParseSnapshots(body, NOW) {
		eq(t, "quote/"+s.VenueSymbol, str(t, "quote", s.Quote), "USDC")
	}
}

func TestDeclaredClassIsCryptoUnlessTheCategoryIsRWA(t *testing.T) {
	eq(t, "Crypto/Commodity/XAUT", DeclaredClass("Crypto", "Commodity", "XAUT"), core.ClassCrypto)
	eq(t, "L1/L1/FTM", DeclaredClass("L1", "L1", "FTM"), core.ClassCrypto)
	// The absent category, which TypeScript spells undefined.
	eq(t, "absent/XAU", DeclaredClass("", "", "XAU"), core.ClassCrypto)
}

func TestDeclaredClassFallsToTheBaseTablesForAnUnknownRWASubCategory(t *testing.T) {
	eq(t, "RWA/TradFi/USDJPY", DeclaredClass("RWA", "TradFi", "USDJPY"), core.ClassFX)
	eq(t, "RWA/Something New/XAG", DeclaredClass("RWA", "Something New", "XAG"), core.ClassCommodity)
	// null sub-category, which reaches Go as the empty string.
	eq(t, "RWA/null/NVDA", DeclaredClass("RWA", "", "NVDA"), core.ClassEquity)
}

func TestParseFundingTurnsNewestFirstRowsIntoOldestFirstSettlements(t *testing.T) {
	var body Response[[]FundingRow]
	loadFixture(t, "funding-BTC-USD", &body)

	events := ParseFunding(body.Data, "BTC-USD",
		Declared{Category: "Crypto", SubCategory: "L1"}, 0, math.MaxInt64)

	want := []int64{
		1_789_326_000_772, 1_789_329_600_932, 1_789_333_200_772, 1_789_336_801_693,
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, settledAt := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, settledAt)
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, 0.000013)
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, 1.0)
	}
	eq(t, "event[0].venueId", events[0].VenueID, VenueID)
	eq(t, "event[0].base", events[0].Base, "BTC")
	eq(t, "event[0].quote", str(t, "quote", events[0].Quote), "USDC")
	if events[0].MarkPrice != nil {
		t.Errorf("event[0].markPrice: got %v, want nil", *events[0].MarkPrice)
	}
}

// stubDoer answers every request from respond, recording the URLs and the User-Agent each carried.
type stubDoer struct {
	urls       []string
	userAgents []string
	respond    func(url string, n int) []byte
}

func (d *stubDoer) Do(req *http.Request) (*http.Response, error) {
	d.urls = append(d.urls, req.URL.String())
	d.userAgents = append(d.userAgents, req.Header.Get("User-Agent"))
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader(d.respond(req.URL.String(), len(d.urls)))),
	}, nil
}

func newAdapter(doer *stubDoer) *Adapter {
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer}))
}

func TestFetchFundingHistoryMakesOneRequestForAShortWindowAndCarriesTheLearnedClass(t *testing.T) {
	marketsBody := fixtureBytes(t, "info-markets")
	fundingBody := fixtureBytes(t, "funding-BTC-USD")
	doer := &stubDoer{respond: func(url string, _ int) []byte {
		if strings.HasSuffix(url, "/info/markets") {
			return marketsBody
		}
		return fundingBody
	}}
	adapter := newAdapter(doer)
	ctx := context.Background()

	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	events, err := adapter.FetchFundingHistory(ctx, "XAU-USD", 1_789_329_000_000, 1_789_337_000_000)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	want := []string{
		API + "/info/markets",
		API + "/info/XAU-USD/funding?startTime=1789329000000&endTime=1789337000000",
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", doer.urls, want)
	}
	for i, url := range want {
		eq(t, fmt.Sprintf("url[%d]", i), doer.urls[i], url)
	}

	// The window drops the oldest fixture row.
	wantSettled := []int64{1_789_329_600_932, 1_789_333_200_772, 1_789_336_801_693}
	if len(events) != len(wantSettled) {
		t.Fatalf("events: got %d, want %d", len(events), len(wantSettled))
	}
	for i, settledAt := range wantSettled {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, settledAt)
		// XAU-USD is declared RWA / Commodity by the markets call, which history never states.
		eq(t, fmt.Sprintf("event[%d].assetClass", i), events[i].AssetClass, core.ClassCommodity)
	}
}

func TestFetchFundingHistoryPagesBackByEndTimeWhenAPageIsFull(t *testing.T) {
	const hour int64 = 3_600_000
	const top int64 = 1_789_336_800_000

	// Raw JSON, never json.Marshal of the wire struct: adapters.Num has no MarshalJSON, so a
	// marshalled row would decode back as absent.
	page := func(newest int64, count int) []byte {
		var b strings.Builder
		b.WriteString(`{"status":"OK","data":[`)
		for i := 0; i < count; i++ {
			if i > 0 {
				b.WriteByte(',')
			}
			fmt.Fprintf(&b, `{"m":"BTC-USD","f":"0.00001","T":%d}`, newest-int64(i)*hour)
		}
		b.WriteString(`]}`)
		return []byte(b.String())
	}
	doer := &stubDoer{respond: func(_ string, n int) []byte {
		if n == 1 {
			return page(top, 1000)
		}
		return page(top-1000*hour, 3)
	}}

	from := top - 1002*hour
	events, err := newAdapter(doer).FetchFundingHistory(context.Background(), "BTC-USD", from, top)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	if len(doer.urls) != 2 {
		t.Fatalf("urls: got %v, want 2 requests", doer.urls)
	}
	wantEndTime := fmt.Sprintf("endTime=%d", top-999*hour-1)
	if !strings.Contains(doer.urls[1], wantEndTime) {
		t.Errorf("url[1]: got %q, want it to contain %q", doer.urls[1], wantEndTime)
	}
	if len(events) != 1003 {
		t.Errorf("events: got %d, want 1003", len(events))
	}
}

func TestFetchSnapshotsMakesExactlyOneRequestCarryingTheDefaultUserAgent(t *testing.T) {
	marketsBody := fixtureBytes(t, "info-markets")
	doer := &stubDoer{respond: func(_ string, _ int) []byte { return marketsBody }}

	batch, err := newAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	if len(doer.urls) != 1 || doer.urls[0] != API+"/info/markets" {
		t.Fatalf("urls: got %v, want [%s/info/markets]", doer.urls, API)
	}
	// Extended answers 403 without a User-Agent. The adapter sets no headers of its own; the shared
	// client's default is what satisfies the requirement.
	eq(t, "user-agent", doer.userAgents[0], httpclient.UserAgent)
	if len(batch.Snapshots) != 10 {
		t.Errorf("snapshots: got %d, want 10", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d events, want 0", len(batch.Settled))
	}
}
