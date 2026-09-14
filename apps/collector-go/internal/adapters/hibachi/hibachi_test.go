package hibachi

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

// NOW is the same instant hibachi.test.ts uses: around when the inventory fixture was fetched,
// 2026-09-13 22:29 UTC.
const NOW int64 = 1_789_338_544_000

// fixtureDir walks up from the test's working directory looking for the TypeScript fixture tree,
// rather than hardcoding a depth. These are the SAME files
// packages/adapters/src/venues/hibachi.test.ts reads: the port is verified against the exact bytes
// the original parser is pinned to, which is what makes this a port rather than a plausible rewrite.
func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "hibachi")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/hibachi above the working directory")
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

func inventory(tb testing.TB) Inventory {
	tb.Helper()
	var body Inventory
	loadFixture(tb, "inventory", &body)
	return body
}

func fundingRows(tb testing.TB) []FundingRow {
	tb.Helper()
	var body struct {
		Data []FundingRow `json:"data"`
	}
	loadFixture(tb, "funding-rates_BTC", &body)
	return body.Data
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

func symbols(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for i := range snapshots {
		out = append(out, snapshots[i].VenueSymbol)
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

func TestParseInventoryNormalizesBTC(t *testing.T) {
	got := snapshotBySymbol(ParseInventory(inventory(t), NOW), "BTC/USDT-P")
	if got == nil {
		t.Fatal("BTC/USDT-P missing from snapshots")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	if got.Dex != nil {
		t.Errorf("dex: got %q, want nil", *got.Dex)
	}
	eq(t, "observedAt", got.ObservedAt, NOW)
	// A one-hour fraction: 0.000006/h is 5.3% APR, beside Hyperliquid's 0.0000114/h that minute.
	eq(t, "rate", got.Rate, 0.000006)
	eq(t, "basisHours", got.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 1.0)
	if got.NextFundingAt != nil {
		t.Errorf("nextFundingAt: got %v, want nil", *got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 76763.73316)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 76758.93936)

	// Base units: 9.11 BTC is $699k. Multiplied through float64 variables rather than written as a
	// constant expression, so the product is the one the runtime computes: Go folds constants at
	// arbitrary precision, and the folded value can differ from the parser's by an ulp.
	quantity, mark := 9.1104214497, 76763.73316
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), quantity*mark)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 7503062.407919)

	if got.BestBid != nil || got.BestAsk != nil || got.BestBidSizeUSD != nil || got.BestAskSizeUSD != nil {
		t.Error("depth: inventory publishes best bid/ask without sizes, so neither side is stored")
	}
	if got.MaxLeverage != nil {
		t.Errorf("maxLeverage: got %v, want nil", *got.MaxLeverage)
	}
}

func TestParseInventoryKeepsLiveContractsOnly(t *testing.T) {
	want := []string{
		"BTC/USDT-P",
		"ETH/USDT-P",
		"XAG/USDT-P",
		"EUR/USDT-P",
		"PAXG/USDT-P",
		// FARTCOIN/USDT-P is CLOSED.
	}
	got := symbols(ParseInventory(inventory(t), NOW))
	if len(got) != len(want) {
		t.Fatalf("symbols: got %v, want %v", got, want)
	}
	for i, symbol := range want {
		eq(t, fmt.Sprintf("symbol[%d]", i), got[i], symbol)
	}
}

func TestParseInventorySkipsMarketWithoutAnEstimateOrAMark(t *testing.T) {
	body := inventory(t)
	if len(body.Markets) < 2 || body.Markets[0].Info == nil || body.Markets[1].Info == nil {
		t.Fatal("fixture: want BTC and ETH with info")
	}
	// An empty string and an absent field are both absent, and neither is a zero rate.
	body.Markets[0].Info.EstimatedFundingRate = adapters.Num{}
	body.Markets[1].Info.MarkPrice = adapters.Num{}

	for _, symbol := range symbols(ParseInventory(body, NOW)) {
		if symbol == "BTC/USDT-P" || symbol == "ETH/USDT-P" {
			t.Errorf("%s: emitted without an estimate or a mark", symbol)
		}
	}
}

func TestParseInventoryTakesClassFromTheDeclaredCategoryAndQuoteFromSettlement(t *testing.T) {
	want := [][4]string{
		{"BTC/USDT-P", "BTC", "crypto", "USDT"},
		{"ETH/USDT-P", "ETH", "crypto", "USDT"},
		// Hibachi files silver under FX and tags it commodity.
		{"XAG/USDT-P", "XAG", "commodity", "USDT"},
		{"EUR/USDT-P", "EUR", "fx", "USDT"},
		{"PAXG/USDT-P", "PAXG", "crypto", "USDT"},
	}
	got := ParseInventory(inventory(t), NOW)
	if len(got) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(got), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("symbol[%d]", i), got[i].VenueSymbol, w[0])
		eq(t, fmt.Sprintf("base[%d]", i), got[i].Base, w[1])
		eq(t, fmt.Sprintf("assetClass[%d]", i), string(got[i].AssetClass), w[2])
		eq(t, fmt.Sprintf("quote[%d]", i), str(t, "quote", got[i].Quote), w[3])
	}

	eq(t, "FX/major", AssetClassFor("FX", []string{"major"}, "NZD"), core.ClassFX)
	eq(t, "STOCK/AAPL", AssetClassFor("STOCK", []string{}, "AAPL"), core.ClassEquity)
	eq(t, "undeclared/XAU", AssetClassFor("", nil, "XAU"), core.ClassCommodity)
}

func TestParseFundingIsHourlyOldestFirstSecondsToMsWindowInclusive(t *testing.T) {
	btc := inventory(t).Markets[0]
	events := ParseFunding(fundingRows(t), btc.Contract, nil, 1_789_329_600_000, 1_789_336_800_000)

	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
	}{
		// The fixture's 1789326000 row is below the window and is dropped; both bounds are inclusive.
		{1_789_329_600_000, 0.00001, 1},
		{1_789_333_200_000, 0.000008, 1},
		{1_789_336_800_000, 0.000019, 1},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, fmt.Sprintf("event[%d].settledAt", i), events[i].SettledAt, w.settledAt)
		eq(t, fmt.Sprintf("event[%d].rate", i), events[i].Rate, w.rate)
		eq(t, fmt.Sprintf("event[%d].basisHours", i), events[i].BasisHours, w.basisHours)
	}
	eq(t, "event[0].base", events[0].Base, "BTC")
	eq(t, "event[0].quote", str(t, "quote", events[0].Quote), "USDT")
	if events[0].MarkPrice != nil {
		// The row's price is the index, not the mark.
		t.Errorf("event[0].markPrice: got %v, want nil", *events[0].MarkPrice)
	}
}

// routingDoer answers every request from route, recording the URLs so the adapter's request pattern
// can be observed from outside it.
type routingDoer struct {
	urls  []string
	route func(url string) []byte
}

func (d *routingDoer) Do(req *http.Request) (*http.Response, error) {
	url := req.URL.String()
	d.urls = append(d.urls, url)
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader(d.route(url))),
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

func TestAdapterMakesOneInventoryRequestACycle(t *testing.T) {
	body := fixtureBytes(t, "inventory")
	doer := &routingDoer{route: func(string) []byte { return body }}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer}))
	ctx := context.Background()

	batch, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(NOW+60_000)); err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	doer.wantURLs(t, API+"/market/inventory", API+"/market/inventory")
	if len(batch.Snapshots) != 5 {
		t.Errorf("snapshots: got %d, want 5", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d events, want 0", len(batch.Settled))
	}
}

func TestAdapterPagesHistoryByOffsetWithinTheWindow(t *testing.T) {
	const t0 int64 = 1_789_000_000_000
	toMs := t0 + 200*3_600_000

	// A full page means there may be more; the short page ends the walk.
	doer := &routingDoer{route: func(raw string) []byte {
		parsed, err := url.Parse(raw)
		if err != nil {
			t.Fatalf("parse %s: %v", raw, err)
		}
		offset, err := strconv.Atoi(parsed.Query().Get("offset"))
		if err != nil {
			t.Fatalf("offset in %s: %v", raw, err)
		}
		count := 3
		if offset == 0 {
			count = 100
		}
		rows := make([]string, 0, count)
		for i := 0; i < count; i++ {
			rows = append(rows, fmt.Sprintf(
				`{"fundingTimestamp":%d,"fundingRate":"0.00001","indexPrice":"77000"}`,
				t0/1000+int64(offset+i)*3600,
			))
		}
		return []byte(`{"data":[` + strings.Join(rows, ",") + `]}`)
	}}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer}))

	events, err := adapter.FetchFundingHistory(context.Background(), "BTC/USDT-P", t0, toMs)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	page := fmt.Sprintf(
		"%s/market/data/funding-rates?symbol=BTC%%2FUSDT-P&startTime=%d&endTime=%d&limit=100&offset=",
		API, t0/1000, toMs/1000,
	)
	doer.wantURLs(t, page+"0", page+"100")

	if len(events) != 103 {
		t.Fatalf("events: got %d, want 103", len(events))
	}
	// No inventory seen, so the fallback contract supplies the quote and the class.
	eq(t, "event[0].base", events[0].Base, "BTC")
	eq(t, "event[0].quote", str(t, "quote", events[0].Quote), "USDT")
	eq(t, "event[0].assetClass", events[0].AssetClass, core.ClassCrypto)
}
