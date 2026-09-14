package pacifica

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
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// The same instants pacifica.test.ts uses, so both suites pin identical output. NOW is the
// `timestamp` every prices row carries.
const (
	NOW  int64 = 1_789_337_551_583
	HOUR int64 = 3_600_000
	NEXT int64 = 1_789_340_400_000
)

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files
// packages/adapters/src/venues/pacifica.test.ts reads: the port is verified against the exact bytes
// the original parser is pinned to, which is what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "pacifica")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/pacifica above the working directory")
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
// constant expression instead, `412.34157 * 76922.3` is folded at arbitrary precision and can land
// one ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

// fixtures returns the decoded prices, perpetuals and history the TypeScript suite works from:
// real responses from Pacifica on 2026-09-14 (22:12 UTC), trimmed to ten markets, one of them spot.
func fixtures(tb testing.TB) ([]Price, map[string]MarketInfo, []FundingRecord) {
	tb.Helper()
	var prices Response[Price]
	var info Response[MarketInfo]
	var history Response[FundingRecord]
	load(tb, "info_prices", &prices)
	load(tb, "info", &info)
	load(tb, "funding_rate_history_BTC", &history)

	priceRows, err := ExpectData(prices, "info/prices")
	if err != nil {
		tb.Fatalf("prices fixture: %v", err)
	}
	infoRows, err := ExpectData(info, "info")
	if err != nil {
		tb.Fatalf("info fixture: %v", err)
	}
	historyRows, err := ExpectData(history, "funding_rate/history")
	if err != nil {
		tb.Fatalf("history fixture: %v", err)
	}
	return priceRows, Perpetuals(infoRows), historyRows
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func TestParseSnapshotsNormalizesBTCFully(t *testing.T) {
	prices, perpetuals, _ := fixtures(t)
	btc := snapshotBySymbol(ParseSnapshots(prices, perpetuals, NOW), "BTC")
	if btc == nil {
		t.Fatal("BTC missing")
	}

	eq(t, "venueId", btc.VenueID, "pacifica")
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	// The API names no settlement asset; perps margin and settle in USDC.
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// `funding` is the rate already FIXED for the next top of the hour, not the one just paid.
	eq(t, "rate", btc.Rate, 0.00000475)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != NEXT {
		t.Errorf("nextFundingAt: got %v, want %d", btc.NextFundingAt, NEXT)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76922.3)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76956.945987)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(412.34157, 76922.3))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 158617298.66148)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 50)
}

func TestFundingIsTheRateTheLatestHistoryRecordPredicted(t *testing.T) {
	prices, _, history := fixtures(t)

	var btc *Price
	for i := range prices {
		if prices[i].Symbol == "BTC" {
			btc = &prices[i]
		}
	}
	if btc == nil {
		t.Fatal("BTC price row missing")
	}

	// The 22:00 record settled 0.00000383 and fixed 0.00000475 for 23:00; prices carry the latter.
	eq(t, "history[0].funding_rate", history[0].FundingRate.Val, 0.00000383)
	eq(t, "history[0].next_funding_rate", history[0].NextFundingRate.Val, 0.00000475)
	eq(t, "prices funding", btc.Funding.Val, history[0].NextFundingRate.Val)
	// Each record's prediction is the next record's settlement.
	eq(t, "history[1] predicts history[0]", history[1].NextFundingRate.Val, history[0].FundingRate.Val)
	eq(t, "history[2] predicts history[1]", history[2].NextFundingRate.Val, history[1].FundingRate.Val)
}

func TestAcrossThe2300SettlementTheFixedFundingIsWhatSettled(t *testing.T) {
	// Read live on 2026-09-14: prices at 22:59:08 UTC, then prices and each market's newest history
	// record at 23:04 UTC. Recorded evidence, pinned here so the decision cannot drift from what was
	// observed.
	roll := []struct {
		symbol         string
		before         string
		estimateBefore string
		settled        string
		fundingAfter   string
	}{
		{"BTC", "0.00000475", "0.00000281", "0.00000475", "0.00000288"},
		{"ETH", "0.00001202", "0.0000023", "0.00001202", "0.00000199"},
		{"SOL", "-0.00000177", "-0.00002731", "-0.00000177", "-0.00002716"},
		{"NVDA", "0.0000125", "-0.00001397", "0.0000125", "-0.00001297"},
		{"kBONK", "-0.00000345", "0.0000068", "-0.00000345", "0.00000633"},
	}

	number := func(label, raw string) float64 {
		t.Helper()
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			t.Fatalf("%s: %v", label, err)
		}
		return v
	}

	// The rate a snapshot carried all hour is the rate the settlement it pointed at paid: 5 of 5.
	matched := 0
	for _, r := range roll {
		if r.before == r.settled {
			matched++
		}
		// `next_funding` kept moving until the roll and became the new fixed `funding` within one
		// final minute of averaging: never more than 0.0000011 from its last pre-roll read.
		drift := math.Abs(number(r.symbol+" after", r.fundingAfter) - number(r.symbol+" estimate", r.estimateBefore))
		if drift >= 0.0000011 {
			t.Errorf("%s: estimate moved %v across the roll, want < 0.0000011", r.symbol, drift)
		}
	}
	eq(t, "snapshots whose rate is what settled", matched, len(roll))
}

func TestOpenInterestIsBaseUnits(t *testing.T) {
	prices, perpetuals, _ := fixtures(t)
	btc := snapshotBySymbol(ParseSnapshots(prices, perpetuals, NOW), "BTC")
	if btc == nil {
		t.Fatal("BTC missing")
	}

	// 412 contracts is $31.7M, not $412: the docs call open_interest USD, and the venue's own app
	// does not.
	closeTo(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), 31_718_262, 0.5)
	if volume := f64(t, "volume24hUsd", btc.Volume24hUSD); volume <= 100_000_000 {
		t.Errorf("volume24hUsd: got %v, want more than 100000000", volume)
	}
}

func TestAnHourlyRateAnnualisesOverOneHour(t *testing.T) {
	prices, perpetuals, _ := fixtures(t)
	btc := snapshotBySymbol(ParseSnapshots(prices, perpetuals, NOW), "BTC")
	if btc == nil {
		t.Fatal("BTC missing")
	}

	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	// 0.00000475 over one hour is 4.161% APR — an 8h reading of the same figure would be 8x out.
	closeTo(t, "apr", apr, 4.161, 0.0005)
}

func TestPerpetualsOnlyTheSpotRowIsSkipped(t *testing.T) {
	prices, perpetuals, _ := fixtures(t)
	snapshots := ParseSnapshots(prices, perpetuals, NOW)

	want := []string{"XPL", "XAU", "ETH", "EURUSD", "NVDA", "kBONK", "BTC", "PAXG", "SP500"}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	// The prices list's own order, which is what the TypeScript iteration preserves too.
	for i, symbol := range want {
		eq(t, fmt.Sprintf("symbol[%d]", i), snapshots[i].VenueSymbol, symbol)
	}
	if snapshotBySymbol(snapshots, "SOL-USDC") != nil {
		t.Error("SOL-USDC is spot and must not become a snapshot")
	}
}

func TestClassesFromTheTagMapAndBasesFromTheParserExceptWhereTheVenueDiffers(t *testing.T) {
	prices, perpetuals, _ := fixtures(t)
	snapshots := ParseSnapshots(prices, perpetuals, NOW)

	want := []struct {
		symbol     string
		base       string
		multiplier float64
		class      core.AssetClass
		why        string
	}{
		{"XPL", "XPL", 1, core.ClassCrypto, "absent from the tag map: declared nothing, so crypto"},
		{"XAU", "XAU", 1, core.ClassCommodity, ""},
		{"ETH", "ETH", 1, core.ClassCrypto, ""},
		{"EURUSD", "EURUSD", 1, core.ClassFX, "the parser would read EUR against USD; the declared base is EURUSD"},
		{"NVDA", "NVDA", 1, core.ClassEquity, ""},
		{"kBONK", "BONK", 1000, core.ClassCrypto, `declared "kBONK"; the parsed x1000 is right, so it is kept`},
		{"BTC", "BTC", 1, core.ClassCrypto, ""},
		{"PAXG", "PAXG", 1, core.ClassCrypto, "tagged Commodities, but a gold token stays crypto"},
		{"SP500", "US500", 1, core.ClassIndex, "tagged Equities; the alias reaches US500, which is an index"},
	}

	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		got := snapshots[i]
		eq(t, fmt.Sprintf("row[%d].venueSymbol", i), got.VenueSymbol, w.symbol)
		eq(t, w.symbol+".base", got.Base, w.base)
		eq(t, w.symbol+".multiplier", got.Multiplier, w.multiplier)
		eq(t, w.symbol+".assetClass", got.AssetClass, w.class)
	}
}

func TestTheTableHoldsTheBundles38TradfiEntriesAndAnythingElseIsCrypto(t *testing.T) {
	counts := map[TradfiTag]int{}
	for _, tag := range TradfiTags {
		counts[tag]++
	}
	eq(t, "Equities", counts[TagEquities], 22)
	eq(t, "Commodities", counts[TagCommodities], 8)
	eq(t, "FX", counts[TagFX], 8)
	eq(t, "entries", len(TradfiTags), 38)

	eq(t, "USDJPY", AssetClassFor("USDJPY"), core.ClassFX)
	// A recent listing the bundle does not tag has declared nothing, so crypto.
	eq(t, "CHIP", AssetClassFor("CHIP"), core.ClassCrypto)
}

func TestParseFundingHistoryRecordsBecomeHourlySettlementsOnTheHour(t *testing.T) {
	_, perpetuals, history := fixtures(t)
	btc := perpetuals["BTC"]

	events := ParseFundingHistory(history, "BTC", &btc, NEXT-3*HOUR, NEXT-HOUR-1)

	want := []struct {
		at   int64
		rate float64
	}{
		{NEXT - 3*HOUR, 0.00000466},
		{NEXT - 2*HOUR, 0.00000632},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	// Oldest first, and the record stamped 22:00:00.497 is outside a window ending a millisecond
	// before 22:00.
	for i, w := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, w.at)
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, w.rate)
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, 1.0)
		eq(t, fmt.Sprintf("event[%d].quote", i), str(t, "quote", events[i].Quote), "USDC")
		if events[i].MarkPrice != nil {
			t.Errorf("event[%d].markPrice: got %v, want nil", i, *events[i].MarkPrice)
		}
	}
	eq(t, "event[0].venueId", events[0].VenueID, VenueID)
	eq(t, "event[0].base", events[0].Base, "BTC")
}

// routingDoer answers every request from route, recording the URLs so the adapter's request pattern
// can be observed from outside it. It is the Go seam for the fake HttpClient pacifica.test.ts builds.
type routingDoer struct {
	urls  []string
	route func(url string) []byte
}

func (d *routingDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader(d.route(requested))),
	}, nil
}

func (d *routingDoer) wantURLs(t *testing.T, want ...string) {
	t.Helper()
	if len(d.urls) != len(want) {
		t.Fatalf("urls: got %v, want %v", d.urls, want)
	}
	for i, url := range want {
		eq(t, fmt.Sprintf("url[%d]", i), d.urls[i], url)
	}
}

// fixtureDoer answers each endpoint with the fixture the TypeScript test answers it with.
func fixtureDoer(tb testing.TB) *routingDoer {
	tb.Helper()
	info := fixtureBytes(tb, "info")
	prices := fixtureBytes(tb, "info_prices")
	history := fixtureBytes(tb, "funding_rate_history_BTC")
	return &routingDoer{route: func(url string) []byte {
		path, _, _ := strings.Cut(strings.TrimPrefix(url, API), "?")
		switch path {
		case "/info":
			return info
		case "/info/prices":
			return prices
		case "/funding_rate/history":
			return history
		}
		tb.Errorf("unexpected %s", url)
		return []byte(`{"success":true,"data":[]}`)
	}}
}

func newTestAdapter(doer httpclient.Doer) *Adapter {
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestAdapterAsksPricesEveryCycleAndInfoHourly(t *testing.T) {
	doer := fixtureDoer(t)
	adapter := newTestAdapter(doer)
	ctx := context.Background()

	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW)); err != nil {
		t.Fatalf("first cycle: %v", err)
	}
	// 59 minutes on, the cache still holds; an hour on exactly, it does not.
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+59*60_000)); err != nil {
		t.Fatalf("second cycle: %v", err)
	}
	batch, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+HOUR))
	if err != nil {
		t.Fatalf("third cycle: %v", err)
	}

	doer.wantURLs(t,
		API+"/info",
		API+"/info/prices",
		API+"/info/prices",
		API+"/info",
		API+"/info/prices",
	)
	eq(t, "venueId", adapter.VenueID(), "pacifica")
	eq(t, "requestCount", adapter.RequestCount(), 5)
	if len(batch.Snapshots) != 9 {
		t.Errorf("snapshots: got %d, want 9", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d events, want 0", len(batch.Settled))
	}
}

func TestHistoryAsksForTheLargestPageAndStopsOnAShortOne(t *testing.T) {
	doer := fixtureDoer(t)
	adapter := newTestAdapter(doer)

	events, err := adapter.FetchFundingHistory(context.Background(), "BTC", NEXT-3*HOUR, NEXT-HOUR)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	// `/info` first, for the declared base; then one history page, which is short and so final even
	// though the body carries a cursor and has_more.
	doer.wantURLs(t,
		API+"/info",
		API+"/funding_rate/history?symbol=BTC&limit=4000",
	)

	want := []float64{0.00000466, 0.00000632, 0.00000383}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, rate := range want {
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, rate)
	}
}

func TestHistoryPagesByCursorWhilePagesAreFullAndNewerThanTheWindow(t *testing.T) {
	const newest = int64(1_789_336_800_000)

	// Built as raw JSON rather than by marshalling FundingRecord: adapters.Num has no MarshalJSON, so
	// a marshalled row would emit {"Val":...,"OK":true} and decode back as ABSENT. These rows travel
	// the same decode path the venue's own bytes do, hourly and newest first.
	page := func(top int64, count int, cursor string) []byte {
		rows := make([]string, 0, count)
		for i := 0; i < count; i++ {
			rows = append(rows, fmt.Sprintf(
				`{"funding_rate":"0.00001","next_funding_rate":"0.00001","created_at":%d}`,
				top-int64(i)*HOUR+497,
			))
		}
		more := "false"
		if cursor != "" {
			more = "true"
		}
		return []byte(fmt.Sprintf(`{"success":true,"data":[%s],"next_cursor":%q,"has_more":%s}`,
			strings.Join(rows, ","), cursor, more))
	}

	info := fixtureBytes(t, "info")
	full := page(newest, historyPageSize, "PAGE2")
	tail := page(newest-int64(historyPageSize)*HOUR, 5, "")
	calls := 0
	doer := &routingDoer{route: func(url string) []byte {
		if strings.HasSuffix(url, "/info") {
			return info
		}
		calls++
		if calls == 1 {
			return full
		}
		return tail
	}}
	adapter := newTestAdapter(doer)

	events, err := adapter.FetchFundingHistory(
		context.Background(), "BTC", newest-int64(historyPageSize+2)*HOUR, newest,
	)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	if len(doer.urls) != 3 {
		t.Fatalf("urls: got %v, want 3", doer.urls)
	}
	// The cursor the first page returned is carried into the second, after symbol and limit.
	eq(t, "url[2]", doer.urls[2], API+"/funding_rate/history?symbol=BTC&limit=4000&cursor=PAGE2")
	// 4,000 from the full page plus the three of the short page that fall inside the window.
	if len(events) != historyPageSize+3 {
		t.Errorf("events: got %d, want %d", len(events), historyPageSize+3)
	}
}

func TestExpectDataRejectsAResponseThatLostItsPayload(t *testing.T) {
	// Synthetic bodies as raw strings, for the same reason the paging test builds rows that way.
	for _, tc := range []struct {
		name string
		body string
	}{
		{"success false", `{"success":false,"data":[]}`},
		{"no data", `{"success":true}`},
		{"null data", `{"success":true,"data":null}`},
	} {
		var decoded Response[Price]
		if err := json.Unmarshal([]byte(tc.body), &decoded); err != nil {
			t.Fatalf("%s: decode: %v", tc.name, err)
		}
		if _, err := ExpectData(decoded, "info/prices"); err == nil {
			t.Errorf("%s: want an error, got none — a lost payload must fail the cycle rather than "+
				"read as a venue with nothing listed", tc.name)
		}
	}

	// An empty list is a legitimate answer, not a broken response.
	var empty Response[Price]
	if err := json.Unmarshal([]byte(`{"success":true,"data":[]}`), &empty); err != nil {
		t.Fatalf("decode: %v", err)
	}
	rows, err := ExpectData(empty, "info/prices")
	if err != nil {
		t.Fatalf("empty data: %v", err)
	}
	eq(t, "rows", len(rows), 0)
}

// The adapter is a snapshot Fetcher, and — unlike lbank — it publishes funding history, so both are
// pinned. Go method sets are nominal: a lookalike signature compiles but fails the assertion, which
// is exactly what would silently drop this venue out of the backfill.
var (
	_ collector.Fetcher = (*Adapter)(nil)
	_ interface {
		FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error)
	} = (*Adapter)(nil)
)

// Pacifica has no warmUp hook on the TypeScript side, so it deliberately does NOT implement
// collector.WarmUpper: nothing here needs seeding from stored markets, since `/info` answers for the
// whole book in one call.
func TestAdapterIsNotAWarmUpper(t *testing.T) {
	if _, warms := any((*Adapter)(nil)).(collector.WarmUpper); warms {
		t.Error("Adapter implements WarmUpper, which the TypeScript adapter has no hook for")
	}
}
