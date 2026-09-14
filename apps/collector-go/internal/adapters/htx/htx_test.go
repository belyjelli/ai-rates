package htx

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

// NOW is the `ts` of the batch funding response the fixtures were trimmed from, and the same instant
// htx.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_336_869_034

const hourMs int64 = 3_600_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "htx")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/htx above the working directory")
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

// The SAME files packages/adapters/src/venues/htx.test.ts reads.
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
// constant expression instead, `20 * 0.001 * 77105` is folded at arbitrary precision and can land one
// ulp away from the value the parser computes.
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
	info         Envelope[[]ContractInfo]
	funding      Envelope[[]FundingRate]
	openInterest Envelope[[]OpenInterest]
	indices      Envelope[[]Index]
	merged       MergedEnvelope
}

func loadFixtures(tb testing.TB) fixtures {
	tb.Helper()
	var f fixtures
	load(tb, "contract_info", &f.info)
	load(tb, "batch_funding_rate", &f.funding)
	load(tb, "open_interest", &f.openInterest)
	load(tb, "swap_index", &f.indices)
	load(tb, "batch_merged", &f.merged)
	return f
}

func (f fixtures) snapshots(now int64) []core.FundingSnapshot {
	return ParseSnapshots(SnapshotInput{
		Contracts:    TradableSwaps(f.info.Data),
		Funding:      f.funding.Data,
		OpenInterest: f.openInterest.Data,
		Indices:      f.indices.Data,
		Ticks:        f.merged.Ticks,
	}, now)
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func contractByCode(tb testing.TB, contracts []ContractInfo, code string) *ContractInfo {
	tb.Helper()
	for i := range contracts {
		if contracts[i].ContractCode == code {
			return &contracts[i]
		}
	}
	tb.Fatalf("%s missing from the contract_info fixture", code)
	return nil
}

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	btc := snapshotBySymbol(loadFixtures(t).snapshots(NOW), "BTC-USDT")
	if btc == nil {
		t.Fatal("BTC-USDT missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTC-USDT")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.00004317342907712)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_344_000_000 {
		t.Errorf("nextFundingAt: got %v, want 1789344000000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)

	// Published only per contract, so not faked from the last trade. This is the state migration 020
	// taught the identity gate to read the index for.
	if btc.MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil — HTX publishes no mark in any bulk call", *btc.MarkPrice)
	}
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77154.55428571429)

	eq(t, "bestBid", f64(t, "bestBid", btc.BestBid), 77105)
	// Ticker sizes are contracts of 0.001 BTC: a bid of 20 is 0.02 BTC, about $1,542.
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", btc.BestBidSizeUSD), product(20, 0.001, 77105))
	eq(t, "bestAsk", f64(t, "bestAsk", btc.BestAsk), 77105.1)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", btc.BestAskSizeUSD), product(7980, 0.001, 77105.1))
	// `value` is USDT already: 28,808.125 BTC x index 77,154.55 is within 0.06% of it.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), 2221334021.6875)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 145152802.919)
}

func TestParseSnapshotsKeepsListingSwapsOnly(t *testing.T) {
	snapshots := loadFixtures(t).snapshots(NOW)

	want := []string{
		"BTC-USDT", "ETH-USDT", "PEPE-USDT", "BOME-USDT", "XAU-USDT", "PAXG-USDT",
		"USOIL-USDT", "META-USDT", "JP225-USDT", "TQQQ-USDT", "SPX500-USDT", "XOM-USDT",
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, symbol)
	}

	// CYBER-USDT is contract_status 3 (suspended) with a funding_time from January; BTC-USDT-260918
	// is a delivery future; CVX-USDT is a delisted open-interest row with no contract.
	for _, absent := range []string{"CYBER-USDT", "BTC-USDT-260918", "CVX-USDT"} {
		if snapshotBySymbol(snapshots, absent) != nil {
			t.Errorf("%s: present, want dropped", absent)
		}
	}

	// A market with no mark is the NORMAL state on this venue, on every row, not an error.
	for i := range snapshots {
		if snapshots[i].MarkPrice != nil {
			t.Errorf("%s markPrice: got %v, want nil", snapshots[i].VenueSymbol, *snapshots[i].MarkPrice)
		}
	}
}

func TestParseSnapshotsUsesEachSwapsOwnPeriodAndDoesNotRescaleAHugeContract(t *testing.T) {
	f := loadFixtures(t)
	all := f.snapshots(NOW)

	bome := snapshotBySymbol(all, "BOME-USDT")
	if bome == nil {
		t.Fatal("BOME-USDT missing")
	}
	eq(t, "BOME basisHours", bome.BasisHours, 4.0)
	eq(t, "BOME intervalHours", f64(t, "BOME intervalHours", bome.IntervalHours), 4.0)

	jp225 := snapshotBySymbol(all, "JP225-USDT")
	if jp225 == nil {
		t.Fatal("JP225-USDT missing")
	}
	eq(t, "JP225 basisHours", jp225.BasisHours, 1.0)
	eq(t, "JP225 intervalHours", f64(t, "JP225 intervalHours", jp225.IntervalHours), 1.0)

	// PEPE-USDT is 1,000,000 PEPE a contract. The price is per PEPE, the symbol carries no prefix,
	// and `value` is already dollars, so only the book sizes need the contract size.
	pepe := snapshotBySymbol(all, "PEPE-USDT")
	if pepe == nil {
		t.Fatal("PEPE-USDT missing")
	}
	eq(t, "PEPE base", pepe.Base, "PEPE")
	eq(t, "PEPE multiplier", pepe.Multiplier, 1.0)

	var oiValue, bidSize, bidPrice float64
	for _, row := range f.openInterest.Data {
		if row.ContractCode == "PEPE-USDT" {
			oiValue = row.Value.Val
		}
	}
	for _, tick := range f.merged.Ticks {
		if tick.ContractCode == "PEPE-USDT" {
			bidPrice, bidSize = tick.Bid[0].Val, tick.Bid[1].Val
		}
	}
	eq(t, "PEPE openInterestUsd", f64(t, "PEPE openInterestUsd", pepe.OpenInterestUSD), oiValue)
	closeTo(t, "PEPE bestBidSizeUsd", f64(t, "PEPE bestBidSizeUsd", pepe.BestBidSizeUSD),
		product(bidSize, 1_000_000, bidPrice), 1e-6)
}

func TestParseSnapshotsCarriesTheDeclaredClassRefinedByMarketRef(t *testing.T) {
	want := map[string]string{
		"BTC-USDT":    "crypto:BTC",
		"ETH-USDT":    "crypto:ETH",
		"PEPE-USDT":   "crypto:PEPE",
		"BOME-USDT":   "crypto:BOME",
		"XAU-USDT":    "commodity:XAU",   // ["Metals"]
		"PAXG-USDT":   "crypto:PAXG",     // ["Metals"], returned to crypto as a gold token
		"USOIL-USDT":  "commodity:USOIL", // ["Commodities"]
		"META-USDT":   "equity:META",     // ["Stocks"]
		"JP225-USDT":  "index:JP225",     // ["Stocks"], an index by the base table
		"TQQQ-USDT":   "equity:TQQQ",     // ["Stocks","Indices"], an ETF
		"SPX500-USDT": "index:US500",     // ["Indices"]
		"XOM-USDT":    "equity:XOM",      // no tradfi_labels; labels ["stock"]
	}

	snapshots := loadFixtures(t).snapshots(NOW)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i := range snapshots {
		s := &snapshots[i]
		eq(t, s.VenueSymbol, string(s.AssetClass)+":"+s.Base, want[s.VenueSymbol])
		eq(t, s.VenueSymbol+" quote", str(t, "quote", s.Quote), "USDT")
	}
}

func TestAssetClassForReadsTradfiLabelsFirstThenTheLowercaseLabels(t *testing.T) {
	eq(t, "hot/common", AssetClassFor(ContractInfo{Labels: []string{"hot", "common"}}, "BTC"), core.ClassCrypto)
	eq(t, "stock", AssetClassFor(ContractInfo{Labels: []string{"stock"}}, "XOM"), core.ClassEquity)
	eq(t, "indices", AssetClassFor(ContractInfo{Labels: []string{"indices"}}, "XLK"), core.ClassIndex)
	// tradfi_labels wins where both speak, and Stocks wins over Indices.
	eq(t, "tradfi+indices/Stocks", AssetClassFor(
		ContractInfo{Labels: []string{"tradfi", "indices"}, TradfiLabels: []string{"Stocks"}}, "JP225"),
		core.ClassEquity)
}

func TestAssetClassForNeverReadsAClassOffAnUndeclaredTicker(t *testing.T) {
	// EURUSD-USDT carries neither field on HTX.
	eq(t, "EURUSD", AssetClassFor(ContractInfo{Labels: []string{"common"}}, "EURUSD"), core.ClassCrypto)
	eq(t, "XAU undeclared", AssetClassFor(ContractInfo{}, "XAU"), core.ClassCrypto)
}

func TestAssetClassForATradfiFlagWithUnknownLabelsGoesToTheBaseTables(t *testing.T) {
	eq(t, "Bonds/US10Y", AssetClassFor(
		ContractInfo{Labels: []string{"tradfi"}, TradfiLabels: []string{"Bonds"}}, "US10Y"), core.ClassIndex)
	eq(t, "tradfi/XAG", AssetClassFor(
		ContractInfo{Labels: []string{"tradfi"}}, "XAG"), core.ClassCommodity)
	eq(t, "Crypto?/NVDA", AssetClassFor(
		ContractInfo{Labels: []string{"tradfi"}, TradfiLabels: []string{"Crypto?"}}, "NVDA"), core.ClassEquity)
}

// A funding row whose market published no open interest and no book keeps NULLS, never zeros: zero is
// a real reading, and the venue with no bulk mark is the last place to invent one.
func TestParseSnapshotsLeavesStatsNullWithoutAnOpenInterestOrTickerRow(t *testing.T) {
	contract := ContractInfo{
		ContractCode:     "NEW-USDT",
		ContractSize:     num(1),
		ContractStatus:   listing,
		SettlementPeriod: num(8),
		BusinessType:     "swap",
		ContractType:     "swap",
		TradePartition:   "USDT",
	}
	snapshots := ParseSnapshots(SnapshotInput{
		Contracts: TradableSwaps([]ContractInfo{contract}),
		Funding:   []FundingRate{{ContractCode: "NEW-USDT", FundingRate: num(0.0001), FundingTime: num(0)}},
	}, NOW)

	if len(snapshots) != 1 {
		t.Fatalf("snapshots: got %d, want 1", len(snapshots))
	}
	for label, got := range map[string]*float64{
		"openInterestUsd": snapshots[0].OpenInterestUSD,
		"volume24hUsd":    snapshots[0].Volume24hUSD,
		"bestBid":         snapshots[0].BestBid,
		"bestBidSizeUsd":  snapshots[0].BestBidSizeUSD,
		"indexPrice":      snapshots[0].IndexPrice,
		"markPrice":       snapshots[0].MarkPrice,
	} {
		if got != nil {
			t.Errorf("%s: got %v, want nil", label, *got)
		}
	}
	// funding_time 0 is "no next funding", not midnight in 1970.
	if snapshots[0].NextFundingAt != nil {
		t.Errorf("nextFundingAt: got %v, want nil", *snapshots[0].NextFundingAt)
	}
}

func TestParseFundingHistoryReturnsBTCUSDTSettlementsOldestFirst(t *testing.T) {
	var page Envelope[*FundingHistoryPage]
	load(t, "historical_funding_rate_BTC-USDT", &page)

	events := ParseFundingHistory("BTC-USDT", page.Data.Data, 0, 9_007_199_254_740_991, nil, nil)
	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_200_000_000, 0.0001, 8},
		{1_789_228_800_000, 0.000050684203575903, 8},
		{1_789_257_600_000, 0.0001, 8},
		{1_789_286_400_000, 0.0001, 8},
		{1_789_315_200_000, 0.0001, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueId", events[0].VenueID, VenueID)
	eq(t, "base", events[0].Base, "BTC")
	if events[0].MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *events[0].MarkPrice)
	}
}

func TestParseFundingHistoryMeasuresALoneInWindowSettlementAgainstItsNeighbours(t *testing.T) {
	var page Envelope[*FundingHistoryPage]
	load(t, "historical_funding_rate_JP225-USDT", &page)
	var info Envelope[[]ContractInfo]
	load(t, "contract_info", &info)
	jp225 := contractByCode(t, info.Data, "JP225-USDT")

	const at int64 = 1_789_336_800_000
	events := ParseFundingHistory("JP225-USDT", page.Data.Data, at, at, nil, jp225)
	if len(events) != 1 {
		t.Fatalf("events: got %d, want 1", len(events))
	}

	event := events[0]
	eq(t, "venueId", event.VenueID, VenueID)
	eq(t, "venueSymbol", event.VenueSymbol, "JP225-USDT")
	eq(t, "base", event.Base, "JP225")
	eq(t, "quote", str(t, "quote", event.Quote), "USDT")
	eq(t, "multiplier", event.Multiplier, 1.0)
	eq(t, "assetClass", event.AssetClass, core.ClassIndex)
	if event.Dex != nil {
		t.Errorf("dex: got %v, want nil", *event.Dex)
	}
	eq(t, "settledAt", event.SettledAt, at)
	eq(t, "rate", event.Rate, 0.00000625)
	// The neighbours OUTSIDE the window are what say the period was an hour.
	eq(t, "basisHours", event.BasisHours, 1.0)
	if event.MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *event.MarkPrice)
	}
}

// routeDoer answers each URL from a route table and records what was asked for. It is the Go seam for
// the fake HttpClient htx.test.ts builds.
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

func bulkRoute(tb testing.TB) func(string) []byte {
	tb.Helper()
	info := fixtureBytes(tb, "contract_info")
	funding := fixtureBytes(tb, "batch_funding_rate")
	openInterest := fixtureBytes(tb, "open_interest")
	indices := fixtureBytes(tb, "swap_index")
	merged := fixtureBytes(tb, "batch_merged")
	history := fixtureBytes(tb, "historical_funding_rate_BTC-USDT")

	return func(requested string) []byte {
		switch {
		case strings.Contains(requested, "/swap_contract_info"):
			return info
		case strings.Contains(requested, "/swap_batch_funding_rate"):
			return funding
		case strings.Contains(requested, "/swap_open_interest"):
			return openInterest
		case strings.Contains(requested, "/swap_index"):
			return indices
		case strings.Contains(requested, "/batch_merged"):
			return merged
		case strings.Contains(requested, "/swap_historical_funding_rate"):
			return history
		}
		return nil
	}
}

// newAdapter wires an adapter to a route table. MaxRetries is negative for exactly one attempt per
// call, so the recorded URL count is the walk's own.
func newAdapter(doer *routeDoer) *Adapter {
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsMakesFourBulkRequestsACycleAndReadsContractInfoHourly(t *testing.T) {
	doer := &routeDoer{route: bulkRoute(t)}
	adapter := newAdapter(doer)

	batch, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(batch.Snapshots) != 12 {
		t.Fatalf("snapshots: got %d, want 12", len(batch.Snapshots))
	}
	if len(batch.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(batch.Settled))
	}

	want := []string{
		APIBase + "/linear-swap-api/v1/swap_contract_info?business_type=swap",
		APIBase + "/linear-swap-api/v1/swap_batch_funding_rate",
		APIBase + "/linear-swap-api/v1/swap_open_interest?business_type=swap",
		APIBase + "/linear-swap-api/v1/swap_index",
		APIBase + "/linear-swap-ex/market/detail/batch_merged?business_type=swap",
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, url := range want {
		eq(t, "request", doer.urls[i], url)
	}

	contractInfoCalls := func() int {
		calls := 0
		for _, url := range doer.urls {
			if strings.Contains(url, "swap_contract_info") {
				calls++
			}
		}
		return calls
	}

	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+59*60_000)); err != nil {
		t.Fatalf("FetchSnapshots at +59m: %v", err)
	}
	eq(t, "contract info reads at +59m", contractInfoCalls(), 1)

	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+hourMs)); err != nil {
		t.Fatalf("FetchSnapshots at +1h: %v", err)
	}
	eq(t, "contract info reads at +1h", contractInfoCalls(), 2)

	// 5 + 4 + 5: contract info on the first cycle and again once an hour has passed.
	eq(t, "total requests", len(doer.urls), 14)
}

func TestFetchSnapshotsFailsOnAnErrorEnvelope(t *testing.T) {
	bulk := bulkRoute(t)
	doer := &routeDoer{route: func(requested string) []byte {
		if strings.Contains(requested, "/swap_index") {
			return []byte(`{"status":"error","err_code":1017,"err_msg":"Query not supported"}`)
		}
		return bulk(requested)
	}}

	_, err := newAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("FetchSnapshots: got nil, want an error")
	}
	if !strings.Contains(err.Error(), "1017") {
		t.Errorf("error %q does not carry the venue's code 1017", err)
	}
}

// historyPageJSON is one synthetic page of 100 settlements, newest first, 8 hours apart.
//
// Built as a raw JSON string because adapters.Num has no MarshalJSON, so a FundingHistoryPage cannot
// be round-tripped through encoding/json.
func historyPageJSON(index int, newest int64) []byte {
	var b strings.Builder
	fmt.Fprintf(&b, `{"status":"ok","data":{"total_page":65,"current_page":%d,"total_size":6460,"data":[`, index)
	for i := 0; i < historyPageSize; i++ {
		if i > 0 {
			b.WriteString(",")
		}
		at := newest - int64((index-1)*historyPageSize+i)*8*hourMs
		fmt.Fprintf(&b, `{"contract_code":"BTC-USDT","funding_rate":"0.0001","funding_time":"%d"}`, at)
	}
	b.WriteString(`]}}`)
	return []byte(b.String())
}

func TestFetchFundingHistoryLoadsContractInfoWhenNoCycleHasRunAndStopsPagingPastFromMs(t *testing.T) {
	const T int64 = 1_789_315_200_000
	info := fixtureBytes(t, "contract_info")

	doer := &routeDoer{route: func(requested string) []byte {
		if strings.Contains(requested, "/swap_contract_info") {
			return info
		}
		index := pageIndexOf(requested)
		if index <= 0 {
			return nil
		}
		return historyPageJSON(index, T)
	}}

	fromMs := T - 150*8*hourMs
	events, err := newAdapter(doer).FetchFundingHistory(context.Background(), "BTC-USDT", fromMs, T)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	if len(doer.urls) == 0 || !strings.Contains(doer.urls[0], "swap_contract_info") {
		t.Fatalf("first request %v, want swap_contract_info", doer.urls)
	}
	wantPages := []string{
		APIBase + "/linear-swap-api/v1/swap_historical_funding_rate?contract_code=BTC-USDT&page_index=1&page_size=100",
		APIBase + "/linear-swap-api/v1/swap_historical_funding_rate?contract_code=BTC-USDT&page_index=2&page_size=100",
	}
	got := doer.urls[1:]
	if len(got) != len(wantPages) {
		t.Fatalf("history requests: got %d (%v), want %d", len(got), got, len(wantPages))
	}
	for i, url := range wantPages {
		eq(t, "history request", got[i], url)
	}

	if len(events) != 151 {
		t.Fatalf("events: got %d, want 151", len(events))
	}
	eq(t, "first settledAt", events[0].SettledAt, fromMs)
	eq(t, "last settledAt", events[len(events)-1].SettledAt, T)
	for _, event := range events {
		eq(t, "basisHours", event.BasisHours, 8.0)
		eq(t, "quote", str(t, "quote", event.Quote), "USDT")
	}
}

// pageIndexOf is the page_index query parameter of a history URL, or 0 where it carries none.
func pageIndexOf(requested string) int {
	parsed, err := url.Parse(requested)
	if err != nil {
		return 0
	}
	index, err := strconv.Atoi(parsed.Query().Get("page_index"))
	if err != nil {
		return 0
	}
	return index
}
