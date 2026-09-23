package bingx

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Real rows captured 2026-09-13 ~22:00 UTC. The same instant bingx.test.ts uses, so both suites pin
// identical output.
const NOW int64 = 1_789_336_846_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "bingx")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/bingx above the working directory")
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

// The SAME files packages/adapters/src/venues/bingx.test.ts reads.
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

func nilF64(tb testing.TB, label string, got *float64) {
	tb.Helper()
	if got != nil {
		tb.Errorf("%s: got %v, want nil", label, *got)
	}
}

// product multiplies left to right at runtime, exactly as adapters.Mul does. Written as a Go
// constant expression instead, `14.7593 * 77186.1` is folded at arbitrary precision and can land one
// ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func contractsFixture(tb testing.TB) []Contract {
	tb.Helper()
	var env Envelope[[]Contract]
	load(tb, "contracts", &env)
	return env.Data
}

func premiumFixture(tb testing.TB) []PremiumIndex {
	tb.Helper()
	var env Envelope[[]PremiumIndex]
	load(tb, "premiumIndex", &env)
	return env.Data
}

func tickerFixture(tb testing.TB) []Ticker {
	tb.Helper()
	var env Envelope[[]Ticker]
	load(tb, "ticker", &env)
	return env.Data
}

func fundingRateFixture(tb testing.TB) []FundingRate {
	tb.Helper()
	var env Envelope[[]FundingRate]
	load(tb, "fundingRate", &env)
	return env.Data
}

func openInterestFixture(tb testing.TB) Envelope[OpenInterest] {
	tb.Helper()
	var env Envelope[OpenInterest]
	load(tb, "openInterest", &env)
	return env
}

func snapshotsWith(tb testing.TB, openInterest map[string]OpenInterestEntry) []core.FundingSnapshot {
	tb.Helper()
	return ParseSnapshots(contractsFixture(tb), premiumFixture(tb), tickerFixture(tb), openInterest, NOW)
}

func snapshotBySymbol(snapshots []core.FundingSnapshot, symbol string) *core.FundingSnapshot {
	for i := range snapshots {
		if snapshots[i].VenueSymbol == symbol {
			return &snapshots[i]
		}
	}
	return nil
}

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	valueUSD, err := ParseOpenInterest(openInterestFixture(t))
	if err != nil {
		t.Fatalf("ParseOpenInterest: %v", err)
	}
	if valueUSD == nil {
		t.Fatal("fixture")
	}
	snapshots := snapshotsWith(t, map[string]OpenInterestEntry{
		"BTC-USDT": {ValueUSD: *valueUSD, FetchedAt: NOW},
	})

	btc := snapshotBySymbol(snapshots, "BTC-USDT")
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
	eq(t, "rate", btc.Rate, 0.000094)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_344_000_000 {
		t.Errorf("nextFundingAt: got %v, want 1789344000000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77190.5)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77225.4)
	eq(t, "bestBid", f64(t, "bestBid", btc.BestBid), 77186.1)
	// Quantities are base coin: 14.76 BTC, about $1.14m.
	eq(t, "bestBidSizeUsd", f64(t, "bestBidSizeUsd", btc.BestBidSizeUSD), product(14.7593, 77186.1))
	eq(t, "bestAsk", f64(t, "bestAsk", btc.BestAsk), 77186.2)
	eq(t, "bestAskSizeUsd", f64(t, "bestAskSizeUsd", btc.BestAskSizeUSD), product(52.3119, 77186.2))
	// Already USD: 287m is 3,719 BTC at this mark.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), 287039550.4)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 337831456.71)
}

func TestParseSnapshotsKeepsListedContractsOnlyInPremiumIndexOrder(t *testing.T) {
	snapshots := snapshotsWith(t, nil)

	want := []string{
		"BTC-USDT",
		"ETH-USDT",
		"1000PEPE-USDT",
		"BTC-USDC",
		"NCSKTSLA2USD-USDT",
		"NCCOGOLD2USD-USDT",
		"NCFXEUR2USD-USDT",
		"NCSISP5002USD-USDT",
		"PAXG-USDT",
		"IOST-USDT",
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, symbol)
	}
	// Without a cached open interest the field is nil, never a guess.
	for _, snapshot := range snapshots {
		nilF64(t, snapshot.VenueSymbol+" openInterestUsd", snapshot.OpenInterestUSD)
	}
}

func TestParseSnapshotsSkipsAPremiumRowWhoseContractIsSuspended(t *testing.T) {
	contracts := contractsFixture(t)
	for i := range contracts {
		if contracts[i].Symbol == "ETH-USDT" {
			contracts[i].Status = 25
		}
	}

	snapshots := ParseSnapshots(contracts, premiumFixture(t), nil, nil, NOW)
	if snapshotBySymbol(snapshots, "ETH-USDT") != nil {
		t.Error("ETH-USDT: a suspended contract must not produce a snapshot")
	}
	btc := snapshotBySymbol(snapshots, "BTC-USDT")
	if btc == nil {
		t.Fatal("BTC-USDT missing")
	}
	// Absent, never zero: no ticker means no reading, not a market that traded nothing.
	nilF64(t, "volume24hUsd", btc.Volume24hUSD)
}

func TestParseSnapshotsCarriesClassAndSettlementCoin(t *testing.T) {
	want := map[string]string{
		"BTC-USDT":          "crypto:BTC:USDT",
		"ETH-USDT":          "crypto:ETH:USDT",
		"1000PEPE-USDT":     "crypto:PEPE:USDT",
		"BTC-USDC":          "crypto:BTC:USDC",
		"NCSKTSLA2USD-USDT": "equity:NCSKTSLA2USD:USDT",
		"NCCOGOLD2USD-USDT": "commodity:NCCOGOLD2USD:USDT",
		"NCFXEUR2USD-USDT":  "fx:NCFXEUR2USD:USDT",
		// Declared index, but its base is not a canonical index ticker, so MarketRefFor refines it.
		"NCSISP5002USD-USDT": "equity:NCSISP5002USD:USDT",
		// Displayed as PAXG(GOLD); declared crypto by having no tradfi code.
		"PAXG-USDT": "crypto:PAXG:USDT",
		"IOST-USDT": "crypto:IOST:USDT",
	}

	snapshots := snapshotsWith(t, nil)
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for _, snapshot := range snapshots {
		got := string(snapshot.AssetClass) + ":" + snapshot.Base + ":" +
			str(t, snapshot.VenueSymbol+" quote", snapshot.Quote)
		eq(t, snapshot.VenueSymbol, got, want[snapshot.VenueSymbol])
	}
}

func TestParseSnapshotsReadsHourlyIntervalsAndContractSizePrefixes(t *testing.T) {
	snapshots := snapshotsWith(t, nil)

	iost := snapshotBySymbol(snapshots, "IOST-USDT")
	if iost == nil {
		t.Fatal("IOST-USDT missing")
	}
	eq(t, "IOST rate", iost.Rate, -0.000529)
	eq(t, "IOST basisHours", iost.BasisHours, 1.0)
	eq(t, "IOST intervalHours", f64(t, "IOST intervalHours", iost.IntervalHours), 1.0)
	if iost.NextFundingAt == nil || *iost.NextFundingAt != 1_789_340_400_000 {
		t.Errorf("IOST nextFundingAt: got %v, want 1789340400000", iost.NextFundingAt)
	}

	pepe := snapshotBySymbol(snapshots, "1000PEPE-USDT")
	if pepe == nil {
		t.Fatal("1000PEPE-USDT missing")
	}
	eq(t, "PEPE base", pepe.Base, "PEPE")
	eq(t, "PEPE multiplier", pepe.Multiplier, 1000.0)
	// Base-coin depth: 7,586 PEPE at the best bid, not 7,586 contracts.
	eq(t, "PEPE bestBidSizeUsd", f64(t, "PEPE bestBidSizeUsd", pepe.BestBidSizeUSD), product(7586, 0.003403))
	eq(t, "PEPE volume24hUsd", f64(t, "PEPE volume24hUsd", pepe.Volume24hUSD), 14962111.26)
}

func TestIsTradableWantsStatus1AndAUSDTOrUSDCSettlement(t *testing.T) {
	contracts := contractsFixture(t)
	var btc, coffee *Contract
	for i := range contracts {
		switch contracts[i].Symbol {
		case "BTC-USDT":
			btc = &contracts[i]
		case "NCCOCOFFEE2USD-USDT":
			coffee = &contracts[i]
		}
	}
	if btc == nil || coffee == nil {
		t.Fatal("fixture")
	}

	eq(t, "BTC-USDT", IsTradable(*btc), true)
	eq(t, "NCCOCOFFEE2USD-USDT", IsTradable(*coffee), false) // status 25

	settledInUSD := *btc
	settledInUSD.Currency = "USD"
	eq(t, "BTC settled in USD", IsTradable(settledInUSD), false)
}

func TestAssetClassForReadsTheTradfiNamespaceOfTheContractCode(t *testing.T) {
	eq(t, "BTC", AssetClassFor("BTC"), core.ClassCrypto)
	eq(t, "NCSKTSLA2USD", AssetClassFor("NCSKTSLA2USD"), core.ClassEquity)
	eq(t, "NCSKTMFUSDT", AssetClassFor("NCSKTMFUSDT"), core.ClassEquity)
	eq(t, "NCSISP5002USD", AssetClassFor("NCSISP5002USD"), core.ClassIndex)
	eq(t, "NCCOGOLD2USD", AssetClassFor("NCCOGOLD2USD"), core.ClassCommodity)
	eq(t, "NCFXEUR2USD", AssetClassFor("NCFXEUR2USD"), core.ClassFX)
}

func TestAssetClassForUnknownNamespaceIsTradfiOnlyWithThePricingTail(t *testing.T) {
	eq(t, "NCBDUS10Y2USD", AssetClassFor("NCBDUS10Y2USD"), core.ClassEquity)
	eq(t, "NCT", AssetClassFor("NCT"), core.ClassCrypto)
	eq(t, "NCASH", AssetClassFor("NCASH"), core.ClassCrypto)
}

func TestParseOpenInterestReturnsTheQuoteValueAndFailsOnAnErrorEnvelope(t *testing.T) {
	valueUSD, err := ParseOpenInterest(openInterestFixture(t))
	if err != nil {
		t.Fatalf("ParseOpenInterest: %v", err)
	}
	eq(t, "openInterest", f64(t, "openInterest", valueUSD), 287039550.4)

	// Built as a struct rather than decoded: adapters.Num has no MarshalJSON, so a wire struct
	// holding one cannot be round-tripped through JSON in a test.
	_, err = ParseOpenInterest(Envelope[OpenInterest]{
		Code: 109400,
		Msg:  "bad symbol",
		Data: OpenInterest{Symbol: "", Time: 0},
	})
	if err == nil {
		t.Fatal("an error envelope must fail rather than read as absent")
	}
	if !strings.Contains(err.Error(), "109400") {
		t.Errorf("error: got %q, want it to carry 109400", err.Error())
	}
}

func TestParseFundingHistoryReturnsEventsOldestFirstWithTheInferredIntervalAndEachMark(t *testing.T) {
	ref := adapters.MarketRefFor(VenueID, "BTC-USDT", adapters.Overrides{})
	events := ParseFundingHistory(ref, fundingRateFixture(t), 0, NOW, nil)

	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		{1_789_257_600_000, 0.000092, 8},
		{1_789_286_400_000, 0.000082, 8},
		{1_789_315_200_000, 0.000078, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}

	last := events[len(events)-1]
	eq(t, "base", last.Base, "BTC")
	eq(t, "quote", str(t, "quote", last.Quote), "USDT")
	eq(t, "markPrice", f64(t, "markPrice", last.MarkPrice), 77100.3)
}

func TestParseFundingHistoryCutsToTheWindowAndALoneSettlementNeedsAFallback(t *testing.T) {
	ref := adapters.MarketRefFor(VenueID, "BTC-USDT", adapters.Overrides{})
	rows := fundingRateFixture(t)

	windowed := ParseFundingHistory(ref, rows, 1_789_286_400_000, NOW, nil)
	if len(windowed) != 2 {
		t.Fatalf("windowed events: got %d, want 2", len(windowed))
	}

	// One settlement infers nothing, and with no fallback there is no basis to weight it by.
	lone := ParseFundingHistory(ref, rows[:1], 0, NOW, nil)
	if len(lone) != 0 {
		t.Fatalf("lone settlement without a fallback: got %d events, want none", len(lone))
	}

	fallback := 4.0
	withFallback := ParseFundingHistory(ref, rows[:1], 0, NOW, &fallback)
	if len(withFallback) != 1 {
		t.Fatalf("lone settlement with a fallback: got %d events, want 1", len(withFallback))
	}
	eq(t, "basisHours", withFallback[0].BasisHours, 4.0)
}

// fixtureDoer answers each endpoint with its fixture, recording the URLs asked for. It is the Go
// seam for the fake HttpClient bingx.test.ts builds. The routes are a SLICE rather than a map, so
// the first match is the venue's own order rather than Go's map iteration order.
type fixtureDoer struct {
	urls    []string
	routes  []route
	history func(url string) []byte
}

type route struct {
	path string
	body []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)

	var body []byte
	if strings.Contains(requested, "/quote/fundingRate") && d.history != nil {
		body = d.history(requested)
	} else {
		for _, r := range d.routes {
			if strings.Contains(requested, r.path) {
				body = r.body
				break
			}
		}
	}
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

func (d *fixtureDoer) paths() []string {
	out := make([]string, 0, len(d.urls))
	for _, u := range d.urls {
		out = append(out, strings.TrimPrefix(u, baseURL))
	}
	return out
}

func newFixtureDoer(tb testing.TB) *fixtureDoer {
	tb.Helper()
	return &fixtureDoer{routes: []route{
		{"/quote/contracts", fixtureBytes(tb, "contracts")},
		{"/quote/premiumIndex", fixtureBytes(tb, "premiumIndex")},
		{"/quote/ticker", fixtureBytes(tb, "ticker")},
		{"/quote/openInterest", fixtureBytes(tb, "openInterest")},
	}}
}

// oneAttempt is a client that makes exactly one request per call, so the URL count is the walk's own.
func oneAttempt(doer *fixtureDoer) *httpclient.Client {
	return httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1})
}

func eqPaths(tb testing.TB, got, want []string) {
	tb.Helper()
	if len(got) != len(want) {
		tb.Fatalf("requests: got %d %v, want %d %v", len(got), got, len(want), want)
	}
	for i := range want {
		eq(tb, "request path", got[i], want[i])
	}
}

func withOpenInterest(snapshots []core.FundingSnapshot) int {
	n := 0
	for _, snapshot := range snapshots {
		if snapshot.OpenInterestUSD != nil {
			n++
		}
	}
	return n
}

func TestFetchSnapshotsBulkThenOpenInterestASliceAtATimeContractsHourly(t *testing.T) {
	doer := newFixtureDoer(t)
	adapter := NewAdapterWithOptions(oneAttempt(doer), Options{OpenInterestBudget: 2})
	eq(t, "venueId", adapter.VenueID(), "bingx")

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	eqPaths(t, doer.paths(), []string{
		"/quote/contracts",
		"/quote/premiumIndex",
		"/quote/ticker",
		"/quote/openInterest?symbol=BTC-USDT",
		"/quote/openInterest?symbol=ETH-USDT",
	})
	if len(first.Snapshots) != 10 {
		t.Fatalf("snapshots: got %d, want 10", len(first.Snapshots))
	}
	eq(t, "first cycle open interest", withOpenInterest(first.Snapshots), 2)

	doer.urls = nil
	second, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+60_000))
	if err != nil {
		t.Fatalf("FetchSnapshots (second): %v", err)
	}
	eqPaths(t, doer.paths(), []string{
		"/quote/premiumIndex",
		"/quote/ticker",
		"/quote/openInterest?symbol=1000PEPE-USDT",
		"/quote/openInterest?symbol=BTC-USDC",
	})
	// The first slice is still cached, so four markets carry open interest now.
	eq(t, "second cycle open interest", withOpenInterest(second.Snapshots), 4)
}

// historyPage builds a full page of settlements as raw JSON. adapters.Num has no MarshalJSON, so a
// slice of FundingRate cannot be encoded back to the wire shape the client decodes.
func historyPage(count int, newest, stepMs int64) []byte {
	var b strings.Builder
	b.WriteString(`{"code":0,"msg":"","data":[`)
	for i := 0; i < count; i++ {
		if i > 0 {
			b.WriteString(",")
		}
		fmt.Fprintf(&b, `{"symbol":"BTC-USDT","fundingRate":"0.0001","fundingTime":%d}`,
			newest-int64(i)*stepMs)
	}
	b.WriteString("]}")
	return []byte(b.String())
}

// TestASuspendedSymbolNeitherFailsHistoryNorOpensTheCircuit is the 2026-09-24 BingX outage. The
// history sweep met six suspended NCSK symbols in a row; each answered HTTP 200 with `data` as an
// OBJECT, which decoded as "invalid JSON", counted toward the shared circuit, and opened it -- taking
// the funding snapshots down for five minutes out of every sweep. The body is the live reply.
func TestASuspendedSymbolNeitherFailsHistoryNorOpensTheCircuit(t *testing.T) {
	doer := newFixtureDoer(t)
	doer.history = func(string) []byte {
		return []byte(`{"code":109415,"msg":"NCSKHIVE2USD-USDT is pause currently,all validted symbols in api:/openApi/swap/v2/quote/contracts, please verify it","data":{}}`)
	}
	client := oneAttempt(doer)
	adapter := NewAdapter(client)

	// More than the circuit's threshold of five, which is what the sweep did.
	for i := range 8 {
		events, err := adapter.FetchFundingHistory(context.Background(), "NCSKHIVE2USD-USDT", 0, NOW)
		if err != nil {
			t.Fatalf("call %d: a suspended symbol is no history, not a failure: %v", i, err)
		}
		if len(events) != 0 {
			t.Fatalf("call %d: got %d events from a suspended symbol", i, len(events))
		}
	}
	if state := client.Circuit(); state.Open || state.ConsecutiveFailures != 0 {
		t.Fatalf("circuit after suspended replies: %+v", state)
	}
}

// TestAnErrorEnvelopeIsACodeErrorWhateverShapeDataTakes: any other non-zero code still fails, as the
// venue's error rather than as a decoding failure, and still without touching the circuit.
func TestAnErrorEnvelopeIsACodeErrorWhateverShapeDataTakes(t *testing.T) {
	for _, body := range []string{
		`{"code":100400,"msg":"bad symbol","data":{}}`,
		`{"code":100400,"msg":"bad symbol","data":"nope"}`,
		`{"code":100400,"msg":"bad symbol"}`,
	} {
		doer := newFixtureDoer(t)
		doer.history = func(string) []byte { return []byte(body) }
		client := oneAttempt(doer)

		_, err := NewAdapter(client).FetchFundingHistory(context.Background(), "BTC-USDT", 0, NOW)
		var code *CodeError
		if !errors.As(err, &code) || code.Code != 100400 {
			t.Errorf("%s: got %v, want CodeError 100400", body, err)
		}
		if state := client.Circuit(); state.ConsecutiveFailures != 0 {
			t.Errorf("%s: a clean venue error counted toward the circuit: %+v", body, state)
		}
	}
}

func TestFetchFundingHistoryPagesBackwardsFromTheEndOfTheWindow(t *testing.T) {
	const newest int64 = 1_789_315_200_000
	const step int64 = 28_800_000
	oldest := newest - int64(historyLimit-1)*step
	page := historyPage(historyLimit, newest, step)

	doer := newFixtureDoer(t)
	doer.history = func(requested string) []byte {
		if strings.Contains(requested, fmt.Sprintf("endTime=%d", NOW)) {
			return page
		}
		// An empty window answers `data: null`, which is an empty page, not an error.
		return []byte(`{"code":0,"msg":"","data":null}`)
	}
	adapter := NewAdapter(oneAttempt(doer))

	events, err := adapter.FetchFundingHistory(context.Background(), "BTC-USDT", 0, NOW)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}

	eqPaths(t, doer.paths(), []string{
		fmt.Sprintf("/quote/fundingRate?symbol=BTC-USDT&startTime=0&endTime=%d&limit=1000", NOW),
		fmt.Sprintf("/quote/fundingRate?symbol=BTC-USDT&startTime=0&endTime=%d&limit=1000", oldest-1),
	})
	if len(events) != historyLimit {
		t.Fatalf("events: got %d, want %d", len(events), historyLimit)
	}
	eq(t, "oldest first", events[0].SettledAt, oldest)
	eq(t, "basisHours", events[0].BasisHours, 8.0)
	// No history call names a market the adapter has seen, so the ref is parsed from the symbol.
	eq(t, "base", events[0].Base, "BTC")

	if rows := fundingRateFixture(t); len(rows) != 3 {
		t.Errorf("fundingRate fixture: got %d rows, want 3", len(rows))
	}
}
