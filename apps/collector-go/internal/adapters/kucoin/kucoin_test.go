package kucoin

import (
	"bytes"
	"context"
	"encoding/json"
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

// The same instant kucoin.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_147_120_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "kucoin")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/kucoin above the working directory")
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

// The SAME files packages/adapters/src/venues/kucoin.test.ts reads.
func load[T any](tb testing.TB, name string, into *T) {
	tb.Helper()
	if err := json.Unmarshal(fixtureBytes(tb, name), into); err != nil {
		tb.Fatalf("decode %s: %v", name, err)
	}
}

func decode[T any](tb testing.TB, raw string, into *T) {
	tb.Helper()
	if err := json.Unmarshal([]byte(raw), into); err != nil {
		tb.Fatalf("decode %s: %v", raw, err)
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

func nilPtr[T any](tb testing.TB, label string, got *T) {
	tb.Helper()
	if got != nil {
		tb.Errorf("%s: got %v, want nil", label, *got)
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

func eventBySymbol(events []core.FundingEvent, symbol string) *core.FundingEvent {
	for i := range events {
		if events[i].VenueSymbol == symbol {
			return &events[i]
		}
	}
	return nil
}

func batch(tb testing.TB, name string) core.SnapshotBatch {
	tb.Helper()
	var env Envelope[[]Contract]
	load(tb, name, &env)
	got, err := ParseSnapshots(env, NOW)
	if err != nil {
		tb.Fatalf("ParseSnapshots: %v", err)
	}
	return got
}

func TestParseSnapshotsNormalizesXBTUSDTM(t *testing.T) {
	got := snapshotBySymbol(batch(t, "contracts-active").Snapshots, "XBTUSDTM")
	if got == nil {
		t.Fatal("XBTUSDTM missing")
	}

	eq(t, "venueId", got.VenueID, VenueID)
	// The trailing M is KuCoin's, and XBT is its spelling of BTC; both are handled by the shared
	// symbol parser, so the pool joins every other venue's BTC/USDT.
	eq(t, "base", got.Base, "BTC")
	eq(t, "quote", str(t, "quote", got.Quote), "USDT")
	eq(t, "multiplier", got.Multiplier, 1.0)
	eq(t, "assetClass", got.AssetClass, core.ClassCrypto)
	nilPtr(t, "dex", got.Dex)
	eq(t, "observedAt", got.ObservedAt, NOW)
	eq(t, "rate", got.Rate, 0.000037)
	// 28,800,000 MILLISECONDS is 8 hours. Reading KuCoin's granularity as minutes or seconds would
	// misweight every payment on the venue.
	eq(t, "basisHours", got.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", got.IntervalHours), 8.0)
	if got.NextFundingAt == nil || *got.NextFundingAt != 1_789_171_200_000 {
		t.Errorf("nextFundingAt: got %v, want 1789171200000", got.NextFundingAt)
	}
	eq(t, "kind", got.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", got.MarkPrice), 77754.7)
	eq(t, "indexPrice", f64(t, "indexPrice", got.IndexPrice), 77783.14)

	// Open interest is LOTS, and `multiplier` is what a lot is worth in base units: 11,784,994 lots
	// x 0.001 BTC x the mark. Computed from variables rather than written as a constant expression,
	// because Go folds constant arithmetic at arbitrary precision and the runtime rounds per factor.
	lots, perLot, mark := 11784994.0, 0.001, 77754.7
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", got.OpenInterestUSD), lots*perLot*mark)
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", got.Volume24hUSD), 511004312.1306)
	eq(t, "maxLeverage", f64(t, "maxLeverage", got.MaxLeverage), 125.0)

	// KuCoin publishes no book on this endpoint; absent, never zero.
	nilPtr(t, "bestBid", got.BestBid)
	nilPtr(t, "bestBidSizeUsd", got.BestBidSizeUSD)
	nilPtr(t, "bestAsk", got.BestAsk)
	nilPtr(t, "bestAskSizeUsd", got.BestAskSizeUSD)
}

func TestParseSnapshotsSkipsInverseAndDatedContracts(t *testing.T) {
	snapshots := batch(t, "contracts-active").Snapshots

	// XBTUSDM is inverse and XBTMU26 is a dated future (type FFICSX); neither belongs in a perp
	// screener.
	want := []string{"XBTUSDTM", "ETHUSDTM", "WIFUSDTM", "DOGEUSDTM"}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, symbol := range want {
		eq(t, "symbol", snapshots[i].VenueSymbol, symbol)
	}

	wif := snapshotBySymbol(snapshots, "WIFUSDTM")
	if wif == nil {
		t.Fatal("WIFUSDTM missing")
	}
	eq(t, "WIF basisHours", wif.BasisHours, 4.0)
	if wif.NextFundingAt == nil || *wif.NextFundingAt != 1_789_156_800_000 {
		t.Errorf("WIF nextFundingAt: got %v, want 1789156800000", wif.NextFundingAt)
	}
	lots, perLot, mark := 1858612.0, 10.0, 0.1946
	eq(t, "WIF openInterestUsd", f64(t, "WIF openInterestUsd", wif.OpenInterestUSD), lots*perLot*mark)

	// DOGEUSDTM publishes no currentFundingRateGranularity, so the interval falls back to
	// fundingRateGranularity rather than the market being dropped.
	doge := snapshotBySymbol(snapshots, "DOGEUSDTM")
	if doge == nil {
		t.Fatal("DOGEUSDTM missing")
	}
	eq(t, "DOGE basisHours", doge.BasisHours, 8.0)
}

func TestParseSnapshotsEmitsThePreviousSettlement(t *testing.T) {
	settled := batch(t, "contracts-active").Settled

	// lastTimeFundingRate is what was actually charged at the previous funding time, which is one
	// interval before the next one.
	xbt := eventBySymbol(settled, "XBTUSDTM")
	if xbt == nil {
		t.Fatal("XBTUSDTM settlement missing")
	}
	eq(t, "XBT settledAt", xbt.SettledAt, int64(1_789_142_400_000))
	eq(t, "XBT rate", xbt.Rate, 0.000044)
	eq(t, "XBT basisHours", xbt.BasisHours, 8.0)

	wif := eventBySymbol(settled, "WIFUSDTM")
	if wif == nil {
		t.Fatal("WIFUSDTM settlement missing")
	}
	eq(t, "WIF settledAt", wif.SettledAt, int64(1_789_142_400_000))
	eq(t, "WIF basisHours", wif.BasisHours, 4.0)
}

func TestParseSnapshotsRejectsAnErrorEnvelope(t *testing.T) {
	var env Envelope[[]Contract]
	// A rate limit arrives as a code inside an HTTP 200, so the parser is the first thing that can
	// notice it.
	decode(t, `{"code":"429000","msg":"too many","data":[]}`, &env)

	_, err := ParseSnapshots(env, NOW)
	if err == nil {
		t.Fatal("want an error for code 429000, got nil")
	}
	if !strings.Contains(err.Error(), "429000") {
		t.Errorf("error: got %q, want it to mention 429000", err.Error())
	}
}

func TestParseSnapshotsReadsANullPayloadAsNoContracts(t *testing.T) {
	var env Envelope[[]Contract]
	decode(t, `{"code":"200000","data":null}`, &env)

	got, err := ParseSnapshots(env, NOW)
	if err != nil {
		t.Fatalf("ParseSnapshots: %v", err)
	}
	eq(t, "snapshots", len(got.Snapshots), 0)
	eq(t, "settled", len(got.Settled), 0)
}

// The declared class each of these real rows should end up with, on both the snapshot and the
// settlement that travels with it.
var wantDeclared = map[string]string{
	"BBUSDTM":  "crypto:BB",
	"ONUSDTM":  "crypto:ON",
	"QNTUSDTM": "crypto:QNT",
	"STXUSDTM": "crypto:STX",
	// Quantinuum and BlackBerry's ticker-alikes, which KuCoin lists under separate symbols.
	"BBXUSDTM":  "equity:BBX",
	"QNTXUSDTM": "equity:QNTX",
	// Declared METAL; tokens, so MarketRefFor returns them to crypto.
	"XAUTUSDTM":   "crypto:XAUT",
	"PAXGUSDTM":   "crypto:PAXG",
	"XAGUSDTM":    "commodity:XAG",
	"CLUSDTM":     "commodity:CL",
	"NATGASUSDTM": "commodity:NATGAS",
}

func TestParseSnapshotsCarriesTheDeclaredClass(t *testing.T) {
	// Real /contracts/active rows from 2026-09-14.
	got := batch(t, "asset-class")

	if len(got.Snapshots) != len(wantDeclared) {
		t.Fatalf("snapshots: got %d, want %d", len(got.Snapshots), len(wantDeclared))
	}
	for _, s := range got.Snapshots {
		eq(t, s.VenueSymbol, string(s.AssetClass)+":"+s.Base, wantDeclared[s.VenueSymbol])
	}
	if len(got.Settled) != len(wantDeclared) {
		t.Fatalf("settled: got %d, want %d", len(got.Settled), len(wantDeclared))
	}
	for _, e := range got.Settled {
		eq(t, e.VenueSymbol, string(e.AssetClass)+":"+e.Base, wantDeclared[e.VenueSymbol])
	}
}

// declaredRow is the fixture read as the raw wire fields this test needs, including `marketType`,
// which the parser deliberately ignores.
type declaredRow struct {
	Symbol     string `json:"symbol"`
	AssetClass string `json:"assetClass"`
	MarketType string `json:"marketType"`
}

func TestAssetClassForReadsTheDeclaredField(t *testing.T) {
	var env Envelope[[]declaredRow]
	load(t, "asset-class", &env)

	// WHY `marketType` CANNOT BE USED: every METAL and COMMODITY row calls itself CRYPTO there.
	var metalsAndCommodities []string
	for _, row := range env.Data {
		if row.AssetClass == "METAL" || row.AssetClass == "COMMODITY" {
			metalsAndCommodities = append(metalsAndCommodities, row.MarketType)
		}
	}
	eq(t, "metal/commodity rows", len(metalsAndCommodities), 5)
	for _, marketType := range metalsAndCommodities {
		eq(t, "marketType", marketType, "CRYPTO")
	}

	want := map[string]core.AssetClass{
		"BBUSDTM":     core.ClassCrypto,
		"ONUSDTM":     core.ClassCrypto,
		"QNTUSDTM":    core.ClassCrypto,
		"STXUSDTM":    core.ClassCrypto,
		"BBXUSDTM":    core.ClassEquity,
		"QNTXUSDTM":   core.ClassEquity,
		"XAUTUSDTM":   core.ClassCommodity,
		"PAXGUSDTM":   core.ClassCommodity,
		"XAGUSDTM":    core.ClassCommodity,
		"CLUSDTM":     core.ClassCommodity,
		"NATGASUSDTM": core.ClassCommodity,
	}
	eq(t, "rows", len(env.Data), len(want))
	for _, row := range env.Data {
		eq(t, row.Symbol, AssetClassFor(row.AssetClass, ""), want[row.Symbol])
	}
}

func TestAssetClassForTreatsAnUnknownValueAsNotCrypto(t *testing.T) {
	eq(t, "FOREX", AssetClassFor("FOREX", "EURUSD"), core.ClassFX)
	eq(t, "INDEX", AssetClassFor("INDEX", "US500"), core.ClassIndex)
	eq(t, "ETF", AssetClassFor("ETF", "SPY"), core.ClassEquity)
	// A missing declaration is crypto, like every other undeclared market.
	eq(t, "absent", AssetClassFor("", "XBT"), core.ClassCrypto)
}

func TestParseRiskLimitsUsesThePublishedFloorAndCeiling(t *testing.T) {
	var env Envelope[[]RiskLimit]
	load(t, "risk-limit", &env)
	tiers := ParseRiskLimits(env.Data)

	var btc []core.LeverageTier
	for _, tier := range tiers {
		if tier.VenueSymbol == "XBTUSDTM" {
			btc = append(btc, tier)
		}
	}
	if len(btc) != 12 {
		t.Fatalf("XBT ladder: got %d tiers, want 12", len(btc))
	}

	// initialMargin 0.008 is exactly 1/125, which is how the bounds are known to be quote notional
	// rather than lots: as lots this first band would be a $19m position at 125x.
	eq(t, "tier1.venueId", btc[0].VenueID, VenueID)
	eq(t, "tier1.tier", btc[0].Tier, 1)
	eq(t, "tier1.lower", btc[0].LowerNotionalUSD, 0.0)
	eq(t, "tier1.upper", f64(t, "tier1.upper", btc[0].UpperNotionalUSD), 250_000.0)
	eq(t, "tier1.imr", btc[0].IMR, 0.008)
	eq(t, "tier1.mmr", f64(t, "tier1.mmr", btc[0].MMR), 0.004)
	eq(t, "tier1.maxLeverage", btc[0].MaxLeverage, 125.0)

	// Unlike Bybit and Gate, KuCoin gives minRiskLimit, so no floor is ever inferred.
	eq(t, "tier2.tier", btc[1].Tier, 2)
	eq(t, "tier2.lower", btc[1].LowerNotionalUSD, 250_000.0)
	eq(t, "tier2.upper", f64(t, "tier2.upper", btc[1].UpperNotionalUSD), 600_000.0)
	eq(t, "tier2.imr", btc[1].IMR, 0.01)
	eq(t, "tier2.maxLeverage", btc[1].MaxLeverage, 100.0)

	var doge []core.LeverageTier
	for _, tier := range tiers {
		if tier.VenueSymbol == "DOGEUSDTM" {
			doge = append(doge, tier)
		}
	}
	if len(doge) != 8 {
		t.Fatalf("DOGE ladder: got %d tiers, want 8", len(doge))
	}
	eq(t, "DOGE tier1.tier", doge[0].Tier, 1)
	eq(t, "DOGE tier1.upper", f64(t, "DOGE tier1.upper", doge[0].UpperNotionalUSD), 60_000.0)
	eq(t, "DOGE tier1.maxLeverage", doge[0].MaxLeverage, 75.0)
}

func TestParseFundingHistoryReturnsEventsOldestFirst(t *testing.T) {
	var env Envelope[[]FundingHistoryItem]
	load(t, "funding-history", &env)

	events, err := ParseFundingHistory(env, 4)
	if err != nil {
		t.Fatalf("ParseFundingHistory: %v", err)
	}
	want := []struct {
		at    int64
		rate  float64
		basis float64
	}{
		// The fixture arrives newest-first; the interval is inferred from the settlements themselves,
		// so the fallback of 4 never applies.
		{1_789_084_800_000, 0.000072, 8},
		{1_789_113_600_000, 0.00005, 8},
		{1_789_142_400_000, 0.000044, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, w := range want {
		eq(t, "settledAt", events[i].SettledAt, w.at)
		eq(t, "rate", events[i].Rate, w.rate)
		eq(t, "basisHours", events[i].BasisHours, w.basis)
	}
	eq(t, "venueSymbol", events[0].VenueSymbol, "XBTUSDTM")
	eq(t, "base", events[0].Base, "BTC")
}

func TestParseFundingHistoryReadsANullPayloadAsNoSettlements(t *testing.T) {
	var env Envelope[[]FundingHistoryItem]
	decode(t, `{"code":"200000","data":null}`, &env)

	events, err := ParseFundingHistory(env, 8)
	if err != nil {
		t.Fatalf("ParseFundingHistory: %v", err)
	}
	eq(t, "events", len(events), 0)
}

// routingDoer answers every request from route, recording the URLs so the adapter's request pattern
// can be observed from outside it.
type routingDoer struct {
	urls  []string
	route func(url string) (int, string)
}

func (d *routingDoer) Do(req *http.Request) (*http.Response, error) {
	url := req.URL.String()
	d.urls = append(d.urls, url)
	status, body := d.route(url)
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte(body))),
	}, nil
}

func testAdapter(doer *routingDoer) *Adapter {
	// Sleep is a no-op so the suite never spends real time on the transport's retry backoff.
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{
		Doer:  doer,
		Sleep: func(context.Context, time.Duration) error { return nil },
	}))
}

func TestAdapterFetchSnapshotsMakesOneBulkRequest(t *testing.T) {
	active := string(fixtureBytes(t, "contracts-active"))
	doer := &routingDoer{route: func(string) (int, string) { return http.StatusOK, active }}

	got, err := testAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	eq(t, "snapshots", len(got.Snapshots), 4)

	if len(doer.urls) != 1 || doer.urls[0] != baseURL+"/api/v1/contracts/active" {
		t.Errorf("urls: got %v, want one call to /api/v1/contracts/active", doer.urls)
	}
}

func TestAdapterFundingHistorySurvivesTheNullPayload(t *testing.T) {
	doer := &routingDoer{route: func(url string) (int, string) {
		// KuCoin returns data: null for a window predating the listing, which is most symbols when
		// the backfill reaches 90 days back.
		if strings.Contains(url, "/funding-rates") {
			return http.StatusOK, `{"code":"200000","data":null}`
		}
		return http.StatusOK, `{"code":"200000","data":{"symbol":"NEWUSDTM","fundingRateGranularity":28800000}}`
	}}

	// The TypeScript threw "Spread syntax requires ...iterable" here in production, so the market
	// errored every sweep instead of being marked exhausted and left alone.
	events, err := testAdapter(doer).FetchFundingHistory(
		context.Background(), "NEWUSDTM", NOW-90*86_400_000, NOW)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	eq(t, "events", len(events), 0)

	var askedForRates bool
	for _, url := range doer.urls {
		if strings.Contains(url, "/funding-rates") {
			askedForRates = true
		}
	}
	if !askedForRates {
		t.Errorf("urls: got %v, want a /funding-rates call", doer.urls)
	}
}

// riskLimitBySymbol splits the recorded ladder fixture per symbol, so the per-symbol sweep is
// answered the way KuCoin answers it. Re-encoded from generic maps rather than from the wire
// structs, which carry no marshaller.
func riskLimitBySymbol(tb testing.TB) map[string]string {
	tb.Helper()
	var env struct {
		Data []map[string]any `json:"data"`
	}
	if err := json.Unmarshal(fixtureBytes(tb, "risk-limit"), &env); err != nil {
		tb.Fatalf("decode risk-limit: %v", err)
	}

	rows := make(map[string][]map[string]any)
	for _, row := range env.Data {
		symbol, _ := row["symbol"].(string)
		rows[symbol] = append(rows[symbol], row)
	}
	bodies := make(map[string]string, len(rows))
	for symbol, symbolRows := range rows {
		encoded, err := json.Marshal(map[string]any{"code": ok, "data": symbolRows})
		if err != nil {
			tb.Fatalf("encode %s: %v", symbol, err)
		}
		bodies[symbol] = string(encoded)
	}
	return bodies
}

func TestAdapterSweepsLaddersOneSymbolAtATime(t *testing.T) {
	active := string(fixtureBytes(t, "contracts-active"))
	ladders := riskLimitBySymbol(t)

	doer := &routingDoer{route: func(url string) (int, string) {
		if !strings.Contains(url, "/risk-limit/") {
			return http.StatusOK, active
		}
		symbol := url[strings.LastIndex(url, "/")+1:]
		switch {
		case symbol == "WIFUSDTM":
			// One symbol refusing must cost only its own ladder.
			return http.StatusInternalServerError, "boom"
		case ladders[symbol] != "":
			return http.StatusOK, ladders[symbol]
		default:
			// KuCoin answers data: null where it publishes no ladder.
			return http.StatusOK, `{"code":"200000","data":null}`
		}
	}}

	tiers, complete, err := testAdapter(doer).FetchLeverageTiers(context.Background())
	if err != nil {
		t.Fatalf("FetchLeverageTiers: %v", err)
	}
	if complete {
		t.Error("complete: got true, want false — WIFUSDTM was never read")
	}

	counts := map[string]int{}
	for _, tier := range tiers {
		counts[tier.VenueSymbol]++
	}
	eq(t, "XBT tiers", counts["XBTUSDTM"], 12)
	eq(t, "DOGE tiers", counts["DOGEUSDTM"], 8)
	eq(t, "ladders", len(counts), 2)

	// One call per perp, not a bulk form: KuCoin answers 404000 to /risk-limit without a symbol.
	// The inverse and dated contracts are not swept at all.
	asked := map[string]bool{}
	for _, url := range doer.urls {
		if i := strings.Index(url, "/risk-limit/"); i >= 0 {
			asked[url[i+len("/risk-limit/"):]] = true
		}
	}
	for _, symbol := range []string{"XBTUSDTM", "ETHUSDTM", "WIFUSDTM", "DOGEUSDTM"} {
		if !asked[symbol] {
			t.Errorf("no risk-limit call for %s", symbol)
		}
	}
	eq(t, "symbols swept", len(asked), 4)
}
