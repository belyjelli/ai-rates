package standx

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instants standx.test.ts uses, so both suites pin identical output: the overview was read
// at 2026-09-13T22:12:33Z and the hour it predicts settles at 23:00:00Z. TestPinnedInstants checks
// the arithmetic against the ISO strings themselves.
const (
	NOW  int64 = 1_789_337_553_000
	NEXT int64 = 1_789_340_400_000
	HOUR int64 = 3_600_000
)

func TestPinnedInstants(t *testing.T) {
	for _, c := range []struct {
		iso  string
		want int64
	}{
		{"2026-09-13T22:12:33Z", NOW},
		{"2026-09-13T23:00:00Z", NEXT},
	} {
		parsed, err := time.Parse(time.RFC3339, c.iso)
		if err != nil {
			t.Fatalf("parse %s: %v", c.iso, err)
		}
		eq(t, c.iso, parsed.UnixMilli(), c.want)
	}
}

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "standx")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/standx above the working directory")
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

// The SAME files packages/adapters/src/venues/standx.test.ts reads.
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

// decimal reads an expectation the venue publishes as a long decimal string, the same way the
// parser reads it. Written as a Go literal instead, a 29-digit figure is folded at arbitrary
// precision before it becomes a float64.
func decimal(tb testing.TB, raw string) float64 {
	tb.Helper()
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		tb.Fatalf("parse %s: %v", raw, err)
	}
	return v
}

func overviewSymbols(tb testing.TB) []OverviewSymbol {
	tb.Helper()
	var overview Overview
	load(tb, "query_market_overview", &overview)
	if overview.Symbols == nil {
		tb.Fatal("query_market_overview fixture carries no symbols")
	}
	return *overview.Symbols
}

func symbolInfo(tb testing.TB) []SymbolInfo {
	tb.Helper()
	var info []SymbolInfo
	load(tb, "query_symbol_info", &info)
	return info
}

func snapshots(tb testing.TB, now int64) []core.FundingSnapshot {
	tb.Helper()
	return ParseSnapshots(overviewSymbols(tb), Tradable(symbolInfo(tb)), now)
}

func TestParseSnapshotsNormalizesBTCFully(t *testing.T) {
	got := snapshots(t, NOW)
	if len(got) == 0 {
		t.Fatal("no snapshots")
	}
	btc := got[0]

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-USD")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	// DUSD, StandX's own dollar, not the USD the symbol parses to.
	eq(t, "quote", str(t, "quote", btc.Quote), "DUSD")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.00000838)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	eq(t, "nextFundingAt", *btc.NextFundingAt, NEXT)
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76938.01)
	// Only the per-symbol query_symbol_price carries an index price.
	if btc.IndexPrice != nil {
		t.Errorf("indexPrice: got %v, want nil", *btc.IndexPrice)
	}
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), 29562753.288012)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD),
		decimal(t, "264001802.08615624904632568357"))
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 40)
}

func TestNotionalOpenInterestIsBaseTimesMarkSoNoConversionIsApplied(t *testing.T) {
	btc := overviewSymbols(t)[0]
	// Multiplied at runtime rather than folded as a constant expression, so the comparison is the
	// one the parser would make.
	computed := btc.OpenInterest.Val * btc.MarkPrice.Val
	closeTo(t, "open_interest x mark", computed, btc.OpenInterestNotional.Val, 0.5)
}

func TestHourlyRateAnnualisesOverOneHour(t *testing.T) {
	btc := snapshots(t, NOW)[0]
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	// 0.00000838 an hour is 7.34% a year, not 0.9% (8h) or 0.3% (24h).
	closeTo(t, "apr", apr, 7.34088, 0.5e-5)
}

func TestNextFundingIsTheNextTopOfTheHourEvenExactlyOnOne(t *testing.T) {
	eq(t, "one ms before the hour", *snapshots(t, NEXT-1)[0].NextFundingAt, NEXT)
	eq(t, "exactly on the hour", *snapshots(t, NEXT)[0].NextFundingAt, NEXT+HOUR)
}

func TestOnlyMarketsSymbolInfoListsAsTrading(t *testing.T) {
	var kept []SymbolInfo
	for _, s := range symbolInfo(t) {
		if s.Symbol == "ETH-USD" {
			continue
		}
		if s.Symbol == "UNI-USD" {
			s.Status = "halted"
		}
		kept = append(kept, s)
	}

	got := ParseSnapshots(overviewSymbols(t), Tradable(kept), NOW)
	want := []string{"BTC-USD", "XAU-USD", "CL-USD", "TSLA-USD"}
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got), len(want))
	}
	for i, symbol := range want {
		eq(t, "venueSymbol", got[i].VenueSymbol, symbol)
	}
}

func TestAssetClassComesFromTheWebAppsDeclaration(t *testing.T) {
	got := snapshots(t, NOW)
	want := []struct {
		symbol string
		base   string
		class  core.AssetClass
	}{
		{"BTC-USD", "BTC", core.ClassCrypto},
		{"ETH-USD", "ETH", core.ClassCrypto},
		{"XAU-USD", "XAU", core.ClassCommodity},
		{"UNI-USD", "UNI", core.ClassCrypto},
		{"CL-USD", "CL", core.ClassCommodity},
		{"TSLA-USD", "TSLA", core.ClassEquity},
	}
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got), len(want))
	}
	for i, w := range want {
		eq(t, "venueSymbol", got[i].VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", got[i].Base, w.base)
		eq(t, w.symbol+" class", got[i].AssetClass, w.class)
	}
}

func TestAssetTagsCoverAllThirteenMarketsAndAnUnlistedMarketDeclaresNothing(t *testing.T) {
	counts := map[AssetTag]int{}
	for _, tag := range AssetTags {
		counts[tag]++
	}
	eq(t, "Crypto", counts[TagCrypto], 7)
	eq(t, "Commodities", counts[TagCommodities], 3)
	eq(t, "Stocks", counts[TagStocks], 3)
	eq(t, "listed markets", len(AssetTags), 13)

	eq(t, "MU-USD", AssetClassFor("MU-USD"), core.ClassEquity)
	// Undeclared, so crypto rather than a class read off the ticker.
	eq(t, "NVDA-USD", AssetClassFor("NVDA-USD"), core.ClassCrypto)
}

func TestParseFundingHistoryReturnsHourlySettlementsOldestFirst(t *testing.T) {
	var rows []FundingRateRow
	load(t, "query_funding_rates_BTC-USD", &rows)

	dusd := "DUSD"
	events := ParseFundingHistory(rows, "BTC-USD", &dusd, NEXT-3*HOUR, NEXT-2*HOUR)
	want := []struct {
		settledAt int64
		rate      float64
		basis     float64
		mark      float64
	}{
		{NEXT - 3*HOUR, 0.00001222, 1, 77244.46},
		{NEXT - 2*HOUR, 0.0000125, 1, 77324.79},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.settledAt)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
		eq(t, "markPrice", f64(t, "markPrice", events[i].MarkPrice), w.mark)
		eq(t, "quote", str(t, "quote", events[i].Quote), "DUSD")
	}
}

func TestTheSettled22hRateDiffersFromTheLiveEstimateTwelveMinutesLater(t *testing.T) {
	var rows []FundingRateRow
	load(t, "query_funding_rates_BTC-USD", &rows)
	eq(t, "settled 22:00", rows[len(rows)-1].FundingRate.Val, 0.00000873)
	eq(t, "estimate at 22:12", overviewSymbols(t)[0].FundingRate.Val, 0.00000838)
}

// fixtureDoer answers each StandX endpoint with its fixture, recording the URLs asked for. It is the
// Go seam for the fake HttpClient standx.test.ts builds.
type fixtureDoer struct {
	urls    []string
	info    []byte
	summary []byte
	history []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)

	var body []byte
	switch {
	case strings.Contains(requested, "/query_symbol_info"):
		body = d.info
	case strings.Contains(requested, "/query_market_overview"):
		body = d.summary
	case strings.Contains(requested, "/query_funding_rates"):
		body = d.history
	default:
		return nil, io.ErrUnexpectedEOF
	}
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

func newFixtureDoer(tb testing.TB) *fixtureDoer {
	tb.Helper()
	return &fixtureDoer{
		info:    fixtureBytes(tb, "query_symbol_info"),
		summary: fixtureBytes(tb, "query_market_overview"),
		history: fixtureBytes(tb, "query_funding_rates_BTC-USD"),
	}
}

func newAdapter(doer *fixtureDoer) *Adapter {
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func eqURLs(tb testing.TB, got, want []string) {
	tb.Helper()
	if len(got) != len(want) {
		tb.Fatalf("requests: got %d (%v), want %d (%v)", len(got), got, len(want), want)
	}
	for i := range want {
		eq(tb, "request", got[i], want[i])
	}
}

func TestFetchSnapshotsIsOneCallACycleWithSymbolInfoRefreshedHourly(t *testing.T) {
	doer := newFixtureDoer(t)
	adapter := newAdapter(doer)
	ctx := context.Background()

	// Under the hour the cached list is reused; at exactly an hour it is re-read.
	for _, at := range []int64{NOW, NOW + 59*60_000} {
		if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(at)); err != nil {
			t.Fatalf("FetchSnapshots at %d: %v", at, err)
		}
	}
	batch, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+HOUR))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	info := APIBase + "/query_symbol_info"
	overview := APIBase + "/query_market_overview"
	eqURLs(t, doer.urls, []string{info, overview, overview, info, overview})

	eq(t, "venueId", adapter.VenueID(), VenueID)
	eq(t, "snapshots", len(batch.Snapshots), 6)
	eq(t, "settled", len(batch.Settled), 0)
}

func TestFetchFundingHistoryWalksTheRangeInThirtyDayWindowsOfMillisecondBounds(t *testing.T) {
	doer := newFixtureDoer(t)
	adapter := newAdapter(doer)

	from := NEXT - 45*24*HOUR
	to := NEXT - HOUR
	events, err := adapter.FetchFundingHistory(context.Background(), "BTC-USD", from, to)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	windowEnd := from + 30*24*HOUR - 1
	eqURLs(t, doer.urls, []string{
		APIBase + "/query_symbol_info",
		APIBase + "/query_funding_rates?symbol=BTC-USD&start_time=" +
			strconv.FormatInt(from, 10) + "&end_time=" + strconv.FormatInt(windowEnd, 10),
		APIBase + "/query_funding_rates?symbol=BTC-USD&start_time=" +
			strconv.FormatInt(windowEnd+1, 10) + "&end_time=" + strconv.FormatInt(to, 10),
	})

	// Both windows answered the same three rows; each settlement is kept once.
	want := []int64{NEXT - 3*HOUR, NEXT - 2*HOUR, NEXT - HOUR}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, at := range want {
		eq(t, "settledAt", events[i].SettledAt, at)
	}
	eq(t, "quote", str(t, "quote", events[0].Quote), "DUSD")
}
