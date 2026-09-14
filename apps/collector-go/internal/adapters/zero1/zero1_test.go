package zero1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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

// NOW is when markets_live.json was fetched, 2026-09-13 22:33:55 UTC -- the same instant
// zero1.test.ts uses, so the two suites pin identical output.
const NOW int64 = 1_789_338_835_000

const hourMs int64 = 3_600_000

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files packages/adapters/src/venues/zero1.test.ts
// reads: the port is verified against the exact bytes the original parser is pinned to, which is
// what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "zero1")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/zero1 above the working directory")
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

func info(tb testing.TB) Info {
	tb.Helper()
	var body Info
	load(tb, "info", &body)
	return body
}

func liveMarkets(tb testing.TB) []MarketLive {
	tb.Helper()
	var body MarketsLiveResponse
	load(tb, "markets_live", &body)
	if body.Markets == nil {
		tb.Fatal("markets_live.json has no markets array")
	}
	return *body.Markets
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
// constant expression instead, `3.8737 * 76795.1` is folded at arbitrary precision and can land one
// ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func at(tb testing.TB, iso string) int64 {
	tb.Helper()
	parsed, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		tb.Fatalf("parse %s: %v", iso, err)
	}
	return parsed.UnixMilli()
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

func TestParseSnapshotsNormalizesBTCUSD(t *testing.T) {
	btc := snapshotBySymbol(ParseSnapshots(info(t), liveMarkets(t), NOW), "BTCUSD")
	if btc == nil {
		t.Fatal("BTCUSD missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTCUSD")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// The projection, not `lastSettledFundingRate` (-0.000001), which is what perpStats reports.
	eq(t, "rate", btc.Rate, 0.000001)
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != at(t, "2026-09-13T23:00:00Z") {
		t.Errorf("nextFundingAt: got %v, want %d", btc.NextFundingAt, at(t, "2026-09-13T23:00:00Z"))
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76795.1)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76788.81150574)
	// openInterest is BASE units, so the notional is size x mark.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(3.8737, 76795.1))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 1449689.884611)
	// Level 1 is published as clob/rfq bids and asks the TypeScript adapter does not read either.
	if btc.BestBid != nil || btc.BestAsk != nil {
		t.Error("best bid/ask: got a figure, want nil -- the adapter reads no book")
	}
}

func TestParseSnapshotsSkipsFrozenAndUnprojectedMarketsAndKeepsRFQ(t *testing.T) {
	want := []string{
		"BTCUSD",
		"ETHUSD",
		// IPUSD (8) is frozen.
		"SUSD",
		"ARBUSD",
		"TAOUSD",
		"BNBUSD",
		"kPEPEUSD",
	}
	got := symbolsOf(ParseSnapshots(info(t), liveMarkets(t), NOW))
	if len(got) != len(want) {
		t.Fatalf("symbols: got %v, want %v", got, want)
	}
	for i, symbol := range want {
		eq(t, "symbol", got[i], symbol)
	}

	// A market caught in the gap where the projection is null between settlements is skipped for
	// the cycle rather than shown with its settled rate under a predicted label.
	rows := liveMarkets(t)
	for i := range rows {
		if rows[i].MarketID == 1 && rows[i].Perpetuals != nil {
			rows[i].Perpetuals.ProjectedFundingRate = adapters.Num{}
		}
	}
	for _, symbol := range symbolsOf(ParseSnapshots(info(t), rows, NOW)) {
		if symbol == "ETHUSD" {
			t.Error("ETHUSD: a null projection must be skipped")
		}
	}
}

func TestBaseComesFromTheSymbolGrammarWhereTheParserSplitsOnBUSD(t *testing.T) {
	// What the parser alone would say.
	arb := adapters.MarketRefFor(VenueID, "ARBUSD", adapters.Overrides{})
	eq(t, "parser ARBUSD base", arb.Base, "AR")
	eq(t, "parser ARBUSD quote", str(t, "parser ARBUSD quote", arb.Quote), "BUSD")
	bnb := adapters.MarketRefFor(VenueID, "BNBUSD", adapters.Overrides{})
	eq(t, "parser BNBUSD base", bnb.Base, "BN")
	eq(t, "parser BNBUSD quote", str(t, "parser BNBUSD quote", bnb.Quote), "BUSD")

	want := []struct {
		symbol     string
		base       string
		multiplier float64
		quote      string
		class      core.AssetClass
	}{
		{"BTCUSD", "BTC", 1, "USDC", core.ClassCrypto},
		{"ETHUSD", "ETH", 1, "USDC", core.ClassCrypto},
		{"SUSD", "S", 1, "USDC", core.ClassCrypto},
		{"ARBUSD", "ARB", 1, "USDC", core.ClassCrypto},
		{"TAOUSD", "TAO", 1, "USDC", core.ClassCrypto},
		{"BNBUSD", "BNB", 1, "USDC", core.ClassCrypto},
		// The remainder still goes through the parser, so kPEPE reads as PEPE x1000.
		{"kPEPEUSD", "PEPE", 1000, "USDC", core.ClassCrypto},
	}
	all := ParseSnapshots(info(t), liveMarkets(t), NOW)
	if len(all) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(all), len(want))
	}
	for i, w := range want {
		eq(t, "symbol", all[i].VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", all[i].Base, w.base)
		eq(t, w.symbol+" multiplier", all[i].Multiplier, w.multiplier)
		eq(t, w.symbol+" quote", str(t, w.symbol+" quote", all[i].Quote), w.quote)
		eq(t, w.symbol+" assetClass", all[i].AssetClass, w.class)
	}

	if _, _, ok := BaseFor("BTC-PERP"); ok {
		t.Error("BTC-PERP: a symbol outside the <base>USD grammar has no declared base")
	}
	if _, _, ok := BaseFor("USD"); ok {
		t.Error("USD: the suffix alone leaves no base")
	}
}

func TestParseFundingReturnsHourlySettlementsOldestFirstWithJitterAndMark(t *testing.T) {
	var page HistoryPage
	load(t, "history_PT1H_0", &page)
	if page.Items == nil {
		t.Fatal("history_PT1H_0.json has no items array")
	}
	body := info(t)
	markets := body.MarketList()
	if len(markets) == 0 {
		t.Fatal("info.json has no markets")
	}

	events := ParseFunding(*page.Items, markets[0], body, 0, NOW)
	want := []struct {
		iso  string
		rate float64
		mark float64
	}{
		// The settlement run's jitter is kept as published, as Extended's and dYdX's are.
		{"2026-09-13T19:00:00.522Z", -0.000007, 77314.6},
		{"2026-09-13T20:00:00.292Z", 0.000004, 77297.3},
		{"2026-09-13T21:00:00.266Z", 0, 77313.4},
		{"2026-09-13T22:00:00.333Z", -0.000001, 77285},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, at(t, w.iso))
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, 1.0)
		eq(t, "markPrice", f64(t, "markPrice", events[i].MarkPrice), w.mark)
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTCUSD")
	eq(t, "base", events[0].Base, "BTC")
	eq(t, "quote", str(t, "quote", events[0].Quote), "USDC")
}

func jsonResponse(req *http.Request, body []byte) (*http.Response, error) {
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

// fixtureDoer answers /info and /markets/live with the fixtures, recording what was asked for. It is
// the Go seam for the fake HttpClient zero1.test.ts builds.
type fixtureDoer struct {
	urls []string
	info []byte
	live []byte
	// body, when set, answers every request instead of the fixtures.
	body []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	body := d.body
	if body == nil {
		body = d.info
		if !strings.HasSuffix(requested, "/info") {
			body = d.live
		}
	}
	return jsonResponse(req, body)
}

func newTestAdapter(doer httpclient.Doer) *Adapter {
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsReadsMarketsLiveEveryCycleAndInfoHourly(t *testing.T) {
	doer := &fixtureDoer{info: fixtureBytes(t, "info"), live: fixtureBytes(t, "markets_live")}
	adapter := newTestAdapter(doer)
	eq(t, "venueId", adapter.VenueID(), VenueID)

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(first.Snapshots) != 7 {
		t.Fatalf("snapshots: got %d, want 7", len(first.Snapshots))
	}
	if len(first.Settled) != 0 {
		t.Errorf("settled: got %d, want none -- the snapshot call carries no timestamped settlement", len(first.Settled))
	}

	want := []string{infoURL, liveURL}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, url := range want {
		eq(t, "request", doer.urls[i], url)
	}

	// The catalog only says what is listed and what the tokens are called, so it is re-read hourly.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+59*60_000)); err != nil {
		t.Fatalf("FetchSnapshots at +59m: %v", err)
	}
	if len(doer.urls) != 1 || doer.urls[0] != liveURL {
		t.Errorf("requests at +59m: got %v, want exactly [%s]", doer.urls, liveURL)
	}

	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60*60_000)); err != nil {
		t.Fatalf("FetchSnapshots at +1h: %v", err)
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests at +1h: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, url := range want {
		eq(t, "request at +1h", doer.urls[i], url)
	}
}

func TestACatalogWithoutItsArraysFailsTheCycle(t *testing.T) {
	// Built as a raw string: adapters.Num has no MarshalJSON, so a wire struct cannot be
	// round-tripped into a body.
	doer := &fixtureDoer{body: []byte(`{"markets":null,"tokens":[]}`)}
	_, err := newTestAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("a catalog that lost its markets must fail the cycle rather than read as an empty venue")
	}
	eq(t, "error", err.Error(), ErrUnexpectedInfo.Error())
}

// historyDoer answers /info from the fixture and every history page with 255 synthetic hourly rows
// counted back from top, cursored the way N1 cursors: `startInclusive` counts rows, not hours.
type historyDoer struct {
	urls []string
	info []byte
	top  int64
}

func (d *historyDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	if strings.HasSuffix(requested, "/info") {
		return jsonResponse(req, d.info)
	}

	start := int64(0)
	if cursor := req.URL.Query().Get("startInclusive"); cursor != "" {
		parsed, err := strconv.ParseInt(cursor, 10, 64)
		if err != nil {
			return nil, err
		}
		start = parsed
	}

	var page strings.Builder
	page.WriteString(`{"items":[`)
	for k := int64(0); k < historyPageSize; k++ {
		if k > 0 {
			page.WriteByte(',')
		}
		stamp := time.UnixMilli(d.top - (start+k)*hourMs).UTC().Format("2006-01-02T15:04:05.000Z")
		fmt.Fprintf(&page, `{"marketId":1,"time":%q,"actionId":%d,"fundingRate":0.00001,"markPrice":2500}`,
			stamp, 1_000_000-start-k)
	}
	fmt.Fprintf(&page, `],"nextStartInclusive":%d}`, start+historyPageSize)
	return jsonResponse(req, []byte(page.String()))
}

func TestFetchFundingHistoryFollowsTheCursorBackUntilAPagePassesFromMs(t *testing.T) {
	top := at(t, "2026-09-13T22:00:00Z")
	doer := &historyDoer{info: fixtureBytes(t, "info"), top: top}
	adapter := newTestAdapter(doer)

	events, err := adapter.FetchFundingHistory(context.Background(), "ETHUSD", top-300*hourMs, top)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	want := []string{
		infoURL,
		APIBase + "/market/1/history/PT1H?pageSize=255",
		APIBase + "/market/1/history/PT1H?pageSize=255&startInclusive=255",
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, url := range want {
		eq(t, "request", doer.urls[i], url)
	}

	// 301 hourly settlements inclusive of both bounds; the second page reaches past fromMs, so a
	// third is never asked for.
	if len(events) != 301 {
		t.Fatalf("events: got %d, want 301", len(events))
	}
	eq(t, "first settledAt", events[0].SettledAt, top-300*hourMs)
	eq(t, "last settledAt", events[len(events)-1].SettledAt, top)
	eq(t, "venueSymbol", events[0].VenueSymbol, "ETHUSD")
	eq(t, "base", events[0].Base, "ETH")

	doer.urls = nil
	unlisted, err := adapter.FetchFundingHistory(context.Background(), "NOPEUSD", 0, top)
	if err != nil {
		t.Fatalf("FetchFundingHistory for an unlisted symbol: %v", err)
	}
	if len(unlisted) != 0 {
		t.Errorf("events for an unlisted symbol: got %d, want none", len(unlisted))
	}
	if len(doer.urls) != 0 {
		t.Errorf("requests for an unlisted symbol: got %v, want none -- the catalog is still cached", doer.urls)
	}
}

// fundingHistoryFetcher is the shape an adapter with a history endpoint has.
//
// N1 publishes one: `/market/{id}/history/PT1H` pages hourly settlements back by action id. Go
// method sets are nominal, so this assertion is what proves the method is actually reachable through
// the interface the history backfill calls it by, rather than merely being spelt the same way.
type fundingHistoryFetcher interface {
	FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error)
}

var _ fundingHistoryFetcher = (*Adapter)(nil)

func TestAdapterPublishesFundingHistory(t *testing.T) {
	var adapter any = NewAdapter(httpclient.New(VenueID, httpclient.Options{}))
	if _, offers := adapter.(fundingHistoryFetcher); !offers {
		t.Error("zero1 has a funding-history API: the adapter must expose it")
	}
}
