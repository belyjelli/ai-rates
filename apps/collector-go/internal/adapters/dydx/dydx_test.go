package dydx

import (
	"bytes"
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

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NOW is the same instant dydx.test.ts uses, so the two suites pin identical output.
const NOW int64 = 1_789_147_709_400 // 2026-09-11T17:28:29.400Z

// maxSafeInteger is Number.MAX_SAFE_INTEGER, the open upper bound the TypeScript history tests pass.
const maxSafeInteger int64 = 9_007_199_254_740_991

// nextHour is the settlement NOW is counting down to: dYdX funds on the top of every hour.
var nextHour = time.Date(2026, 9, 11, 18, 0, 0, 0, time.UTC).UnixMilli()

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files packages/adapters/src/venues/dydx.test.ts
// reads: the port is verified against the exact bytes the original parser is pinned to, which is
// what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "dydx")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/dydx above the working directory")
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

func loadMarkets(tb testing.TB, name string) MarketList {
	tb.Helper()
	var body MarketsResponse
	loadFixture(tb, name, &body)
	if body.Markets == nil {
		tb.Fatalf("%s: no markets object", name)
	}
	return *body.Markets
}

func loadHistory(tb testing.TB, name string) []HistoricalFunding {
	tb.Helper()
	var body HistoricalFundingResponse
	loadFixture(tb, name, &body)
	if body.HistoricalFunding == nil {
		tb.Fatalf("%s: no historicalFunding array", name)
	}
	return *body.HistoricalFunding
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

func nilPtr(t *testing.T, label string, got *float64) {
	t.Helper()
	if got != nil {
		t.Errorf("%s: got %v, want nil", label, *got)
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

func tierBySymbol(tiers []core.LeverageTier, symbol string) *core.LeverageTier {
	for i := range tiers {
		if tiers[i].VenueSymbol == symbol {
			return &tiers[i]
		}
	}
	return nil
}

func TestParseMarketsNormalizesLINKUSD(t *testing.T) {
	snapshots := ParseMarkets(loadMarkets(t, "perpetualMarkets"), NOW)

	got := snapshotBySymbol(snapshots, "LINK-USD")
	if got == nil {
		t.Fatal("LINK-USD missing from snapshots")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "base", got.Base, "LINK")
	eq(t, "quote", str(t, "quote", got.Quote), "USD")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	eq(t, "rate", got.Rate, 0.00001665625)
	eq(t, "basisHours", got.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 1.0)
	if got.NextFundingAt == nil || *got.NextFundingAt != nextHour {
		t.Errorf("nextFundingAt: got %v, want %d", got.NextFundingAt, nextHour)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	// dYdX publishes no mark of its own: the oracle price is both the mark and the index.
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 11.775911208)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 11.775911208)
	// Computed the same way dydx.test.ts computes it, so the two agree bit for bit rather than to
	// some tolerance: open interest is base units, priced at the oracle.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), 28956*11.775911208)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 26888.834)

	// The indexer's market rows carry no book and no headline leverage, so these stay absent rather
	// than reading as zero — which is what the TypeScript object's missing keys mean.
	nilPtr(t, "bestBid", got.BestBid)
	nilPtr(t, "bestBidSizeUsd", got.BestBidSizeUSD)
	nilPtr(t, "bestAsk", got.BestAsk)
	nilPtr(t, "bestAskSizeUsd", got.BestAskSizeUSD)
	nilPtr(t, "maxLeverage", got.MaxLeverage)
}

func TestParseMarketsNormalizesBTCAndETH(t *testing.T) {
	snapshots := ParseMarkets(loadMarkets(t, "perpetualMarkets"), NOW)

	btc := snapshotBySymbol(snapshots, "BTC-USD")
	if btc == nil {
		t.Fatal("BTC-USD missing from snapshots")
	}
	eq(t, "BTC base", btc.Base, "BTC")
	eq(t, "BTC assetClass", btc.AssetClass, core.ClassCrypto)
	// Exactly zero within dYdX's clamp band is a real reading, not an absent one.
	eq(t, "BTC rate", btc.Rate, 0.0)
	eq(t, "BTC openInterestUsd", f64(t, "BTC openInterestUsd", btc.OpenInterestUSD), 194.239*77862.55687)
	eq(t, "BTC volume24hUsd", f64(t, "BTC volume24hUsd", btc.Volume24hUSD), 3889329.2462)

	eth := snapshotBySymbol(snapshots, "ETH-USD")
	if eth == nil {
		t.Fatal("ETH-USD missing from snapshots")
	}
	eq(t, "ETH rate", eth.Rate, -0.00000022767857142857)
}

func TestParseMarketsSkipsMarketsThatArentActive(t *testing.T) {
	snapshots := ParseMarkets(loadMarkets(t, "perpetualMarkets"), NOW)

	symbols := make([]string, 0, len(snapshots))
	for _, s := range snapshots {
		symbols = append(symbols, s.VenueSymbol)
	}
	sort.Strings(symbols)

	want := []string{"BTC-USD", "ETH-USD", "LINK-USD"}
	if len(symbols) != len(want) {
		t.Fatalf("symbols: got %v, want %v", symbols, want)
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("symbol[%d]", i), symbols[i], symbol)
	}
}

func TestParseMarketsNextFundingIsTheNextTopOfTheHour(t *testing.T) {
	snapshots := ParseMarkets(loadMarkets(t, "perpetualMarkets"), nextHour)
	if len(snapshots) == 0 {
		t.Fatal("no snapshots")
	}
	// On the hour exactly, the next settlement is a whole hour away, never this same instant.
	if snapshots[0].NextFundingAt == nil || *snapshots[0].NextFundingAt != nextHour+3_600_000 {
		t.Errorf("nextFundingAt: got %v, want %d", snapshots[0].NextFundingAt, nextHour+3_600_000)
	}
}

func TestAssetClassForAnnouncedTradfiTakesItsKindFromTheTables(t *testing.T) {
	eq(t, "XAG-USD", AssetClassFor("XAG-USD"), core.ClassCommodity)
	eq(t, "WTI-USD", AssetClassFor("WTI-USD"), core.ClassCommodity)
	eq(t, "EUR-USD", AssetClassFor("EUR-USD"), core.ClassFX)
	eq(t, "TRY-USD", AssetClassFor("TRY-USD"), core.ClassFX)
}

func TestAssetClassForEverythingElseIsCrypto(t *testing.T) {
	// Tokens that track tradfi included: they are tokens, whatever their marks follow.
	for _, ticker := range []string{"BTC-USD", "PAXG-USD", "XAUT-USD", "TSLAX-USD"} {
		eq(t, ticker, AssetClassFor(ticker), core.ClassCrypto)
	}
}

func TestParseMarketsCarriesAssetClass(t *testing.T) {
	// Real rows of the indexer response. EUR-USD is in FINAL_SETTLEMENT and skipped like any other
	// settled market.
	snapshots := ParseMarkets(loadMarkets(t, "perpetualMarkets_tradfi"), NOW)

	got := make([]string, 0, len(snapshots))
	for _, s := range snapshots {
		got = append(got, fmt.Sprintf("%s|%s|%s", s.VenueSymbol, s.Base, s.AssetClass))
	}
	sort.Strings(got)

	want := []string{
		"PAXG-USD|PAXG|crypto",
		"WTI-USD|CL|commodity",
		"XAG-USD|XAG|commodity",
	}
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %v, want %v", got, want)
	}
	for i := range want {
		eq(t, fmt.Sprintf("snapshot[%d]", i), got[i], want[i])
	}
}

func TestParseHistoricalFundingCarriesAssetClass(t *testing.T) {
	// LINK rows stand in for WTI's: only the class of the events is under test here.
	events := ParseHistoricalFunding(loadHistory(t, "historicalFunding_LINK-USD"), "WTI-USD", 0, maxSafeInteger)
	if len(events) == 0 {
		t.Fatal("no events")
	}
	for i, event := range events {
		eq(t, fmt.Sprintf("event[%d].assetClass", i), event.AssetClass, core.ClassCommodity)
		eq(t, fmt.Sprintf("event[%d].base", i), event.Base, "CL")
	}
}

func TestParseLeverageTiersOneUnboundedTierPerActiveMarket(t *testing.T) {
	tiers := ParseLeverageTiers(loadMarkets(t, "perpetualMarkets"))

	// MATIC-USD is in FINAL_SETTLEMENT and drops out, exactly as it does for snapshots.
	want := []string{"BTC-USD", "ETH-USD", "LINK-USD"}
	if len(tiers) != len(want) {
		t.Fatalf("tiers: got %d, want %d", len(tiers), len(want))
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("tier[%d].venueSymbol", i), tiers[i].VenueSymbol, symbol)
	}

	eq(t, "tier[0].venueId", tiers[0].VenueID, VenueID)
	eq(t, "tier[0].tier", tiers[0].Tier, 1)
	eq(t, "tier[0].lowerNotionalUsd", tiers[0].LowerNotionalUSD, 0.0)
	if tiers[0].UpperNotionalUSD != nil {
		t.Errorf("tier[0].upperNotionalUsd: got %v, want nil", *tiers[0].UpperNotionalUSD)
	}
	eq(t, "tier[0].imr", tiers[0].IMR, 0.02)
	eq(t, "tier[0].mmr", f64(t, "tier[0].mmr", tiers[0].MMR), 0.012)
	eq(t, "tier[0].maxLeverage", tiers[0].MaxLeverage, 50.0)
}

func TestParseLeverageTiersReadsTheMarginFractionPerMarket(t *testing.T) {
	// The majors run at 0.02 (50x), but LINK margins at 0.1, which is 10x. Treating dYdX as a flat
	// 50x venue would overstate its leverage fivefold on every smaller market.
	link := tierBySymbol(ParseLeverageTiers(loadMarkets(t, "perpetualMarkets")), "LINK-USD")
	if link == nil {
		t.Fatal("LINK-USD missing from tiers")
	}
	eq(t, "LINK imr", link.IMR, 0.1)
	eq(t, "LINK mmr", f64(t, "LINK mmr", link.MMR), 0.05)
	eq(t, "LINK maxLeverage", link.MaxLeverage, 10.0)
}

func TestParseHistoricalFundingOldestFirst(t *testing.T) {
	events := ParseHistoricalFunding(loadHistory(t, "historicalFunding_LINK-USD"), "LINK-USD", 0, maxSafeInteger)

	want := []struct {
		settledAt  string
		rate       float64
		basisHours float64
		markPrice  float64
	}{
		{"2026-09-11T13:00:00.792Z", 0, 1, 11.682189541},
		{"2026-09-11T14:00:00.541Z", 0, 1, 12.062931827},
		{"2026-09-11T15:00:00.494Z", 0, 1, 11.928672676},
		{"2026-09-11T16:00:00.622Z", 0.000114, 1, 11.709829134},
		{"2026-09-11T17:00:00.234Z", 0.000004125, 1, 11.792210428},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		settledAt := time.UnixMilli(events[i].SettledAt).UTC().Format(isoMillis)
		eq(t, fmt.Sprintf("event[%d].settledAt", i), settledAt, w.settledAt)
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, w.rate)
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, w.basisHours)
		eq(t, fmt.Sprintf("event[%d].markPrice", i), f64(t, "markPrice", events[i].MarkPrice), w.markPrice)
	}
	eq(t, "event[0].assetClass", events[0].AssetClass, core.ClassCrypto)
	eq(t, "event[0].venueId", events[0].VenueID, VenueID)
	eq(t, "event[0].venueSymbol", events[0].VenueSymbol, "LINK-USD")
}

// fixtureDoer answers every request with the same recorded body, recording the URLs asked for. It is
// the Go seam for the fake HttpClient dydx.test.ts builds: the point of the test is which URLs the
// paging walk asks for, and how many.
type fixtureDoer struct {
	urls []string
	body []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	d.urls = append(d.urls, req.URL.String())
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(d.body)),
		Request:    req,
	}, nil
}

func TestFetchFundingHistoryFiltersToTheWindowAndStopsOnAShortPage(t *testing.T) {
	doer := &fixtureDoer{body: fixtureBytes(t, "historicalFunding_LINK-USD")}
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))

	from := time.Date(2026, 9, 11, 14, 30, 0, 0, time.UTC).UnixMilli()
	to := time.Date(2026, 9, 11, 17, 30, 0, 0, time.UTC).UnixMilli()
	events, err := adapter.FetchFundingHistory(context.Background(), "LINK-USD", from, to)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	want := []float64{0, 0.000114, 0.000004125}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, rate := range want {
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, rate)
	}

	// Five rows is a short page against a limit of 100, so the walk stops after one request.
	if len(doer.urls) != 1 {
		t.Fatalf("urls: got %d (%v), want 1", len(doer.urls), doer.urls)
	}
	if !strings.Contains(doer.urls[0], "effectiveBeforeOrAt=2026-09-11T17:30:00.000Z") {
		t.Errorf("url: got %q, want it to carry effectiveBeforeOrAt=2026-09-11T17:30:00.000Z", doer.urls[0])
	}
}

func TestUnmarshalRejectsMarketsThatAreNotAnObject(t *testing.T) {
	var body MarketsResponse
	if err := json.Unmarshal([]byte(`{"markets":"nope"}`), &body); err == nil {
		t.Fatal("want an error for a non-object markets field, got nil")
	}

	// A response with no markets field at all is the other half of the TypeScript `!body?.markets`
	// guard: absent, not empty. Decoded into its own value, since the failed decode above still left
	// the pointer allocated.
	var empty MarketsResponse
	if err := json.Unmarshal([]byte(`{}`), &empty); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if empty.Markets != nil {
		t.Errorf("markets: got %v, want nil", *empty.Markets)
	}
}
