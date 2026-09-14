package perpl

import (
	"bytes"
	"context"
	"encoding/json"
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

// The same instant perpl.test.ts uses, so both suites pin identical output.
const NOW int64 = 1_789_338_600_000 // 2026-09-13T22:30:00Z

// EVENT is funding.at.t on every fixture market.
const EVENT int64 = 1_789_336_368_000

// micros is read at runtime rather than folded into each expectation: Go folds a constant
// expression at arbitrary precision while the parser rounds per multiply, so `40 * 1e-6` written as
// constants can land an ulp away from what ParseContext computes.
var (
	microsAtRuntime    = 1e-6
	intervalHours      = 2580.0 / 3600.0
	ratePerEvent40     = 40 * microsAtRuntime
	ratePerEventMinus4 = -40 * microsAtRuntime
)

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "perpl")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/perpl above the working directory")
	return ""
}

// fixtureBytes reads the SAME file packages/adapters/src/venues/perpl.test.ts imports.
func fixtureBytes(tb testing.TB, name string) []byte {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	return raw
}

func loadContext(tb testing.TB) Context {
	tb.Helper()
	var ctx Context
	if err := json.Unmarshal(fixtureBytes(tb, "context"), &ctx); err != nil {
		tb.Fatalf("decode context: %v", err)
	}
	return ctx
}

// withMarket re-decodes the fixture and mutates one market, standing in for the TypeScript test's
// structuredClone.
func withMarket(tb testing.TB, name string, change func(*Market)) Context {
	tb.Helper()
	ctx := loadContext(tb)
	for i := range *ctx.Markets {
		if (*ctx.Markets)[i].Name == name {
			change(&(*ctx.Markets)[i])
		}
	}
	return ctx
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

func symbols[T any](items []T, of func(T) string) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		out = append(out, of(item))
	}
	return out
}

func snapshotSymbols(snapshots []core.FundingSnapshot) []string {
	return symbols(snapshots, func(s core.FundingSnapshot) string { return s.VenueSymbol })
}

func settledSymbols(events []core.FundingEvent) []string {
	return symbols(events, func(e core.FundingEvent) string { return e.VenueSymbol })
}

func eqList(tb testing.TB, label string, got, want []string) {
	tb.Helper()
	if strings.Join(got, ",") != strings.Join(want, ",") {
		tb.Errorf("%s: got %v, want %v", label, got, want)
	}
}

func TestParseContextNormalizesBTC(t *testing.T) {
	batch := ParseContext(loadContext(t), NOW)

	btc := snapshotBySymbol(batch.Snapshots, "BTC")
	if btc == nil {
		t.Fatal("BTC missing")
	}
	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "base", btc.Base, "BTC")
	// The quote is the instance's collateral token, not anything in the market name.
	eq(t, "quote", str(t, "quote", btc.Quote), "AUSD")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	// Micros of the index per event, not a fraction.
	eq(t, "rate", btc.Rate, ratePerEvent40)
	eq(t, "basisHours", btc.BasisHours, intervalHours)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), intervalHours)
	// One declared 2580s interval after the last event.
	if btc.NextFundingAt == nil || *btc.NextFundingAt != EVENT+2_580_000 {
		t.Errorf("nextFundingAt: got %v, want %d", btc.NextFundingAt, EVENT+2_580_000)
	}
	eq(t, "kind", btc.Kind, core.KindSettled)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76773.1)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76768)

	// Size decimals are BTC's own 5, and the mark is price-scaled by 1.
	openInterest := 1_086_858 / math.Pow(10, 5)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), openInterest*76773.1)
	// Volume is in AUSD's six decimals, not this market's.
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 291_977_473_222_361/math.Pow(10, 6))

	// The same event is also returned as a settled payment: REST publishes the applied rate.
	settled := eventBySymbol(batch.Settled, "BTC")
	if settled == nil {
		t.Fatal("settled BTC missing")
	}
	eq(t, "settled venueId", settled.VenueID, VenueID)
	eq(t, "settled base", settled.Base, "BTC")
	eq(t, "settled quote", str(t, "settled quote", settled.Quote), "AUSD")
	eq(t, "settled multiplier", settled.Multiplier, 1.0)
	eq(t, "settled assetClass", settled.AssetClass, core.ClassCrypto)
	if settled.Dex != nil {
		t.Errorf("settled dex: got %v, want nil", *settled.Dex)
	}
	eq(t, "settledAt", settled.SettledAt, EVENT)
	eq(t, "settled rate", settled.Rate, ratePerEvent40)
	eq(t, "settled basisHours", settled.BasisHours, intervalHours)
	if settled.MarkPrice != nil {
		t.Errorf("settled markPrice: got %v, want nil", *settled.MarkPrice)
	}
}

// fundingEvidence reads the fields the parser does not use but the scale rests on. The TypeScript
// test casts to them for the same reason: `ppl` is the venue's own payment, and it is what proves
// `rate` is micros rather than a fraction.
type fundingEvidence struct {
	Markets []struct {
		Name    string `json:"name"`
		Funding *struct {
			Rate float64 `json:"rate"`
			Idx  float64 `json:"idx"`
			Ppl  float64 `json:"ppl"`
			Div  float64 `json:"div"`
		} `json:"funding"`
	} `json:"markets"`
}

func TestRateIsMicrosOfTheIndex(t *testing.T) {
	var evidence fundingEvidence
	if err := json.Unmarshal(fixtureBytes(t, "context"), &evidence); err != nil {
		t.Fatalf("decode context: %v", err)
	}
	if len(evidence.Markets) != 3 {
		t.Fatalf("fixture markets: got %d, want 3", len(evidence.Markets))
	}
	for _, market := range evidence.Markets {
		f := market.Funding
		if f == nil {
			t.Fatalf("%s: fixture market has no funding", market.Name)
		}
		// The venue's own payment, truncated toward zero on-chain. Multiplied left to right at
		// runtime, exactly as the claim in the header is written.
		eq(t, market.Name+" ppl", math.Trunc(f.Idx*f.Rate*1e-6*f.Div), f.Ppl)
	}

	snapshots := ParseContext(loadContext(t), NOW).Snapshots
	eth := snapshotBySymbol(snapshots, "ETH")
	if eth == nil {
		t.Fatal("ETH missing")
	}
	eq(t, "ETH rate", eth.Rate, ratePerEventMinus4)

	// Per hour: 5.6e-5, the same order as Hyperliquid's 1.25e-5 -- not 1e6 away from it.
	btc := snapshotBySymbol(snapshots, "BTC")
	if btc == nil {
		t.Fatal("BTC missing")
	}
	closeTo(t, "BTC rate per hour", btc.Rate/btc.BasisHours, 5.58e-5, 5e-8)
}

func TestParseContextUsesPerMarketDecimalsAndCollateralDecimalsForVolume(t *testing.T) {
	snapshots := ParseContext(loadContext(t), NOW).Snapshots

	// MON prices are over 1e6 and its sizes over 1e0, where BTC's are 1e1 and 1e5.
	mon := snapshotBySymbol(snapshots, "MON")
	if mon == nil {
		t.Fatal("MON missing")
	}
	eq(t, "MON markPrice", f64(t, "MON markPrice", mon.MarkPrice), 0.022618)
	eq(t, "MON indexPrice", f64(t, "MON indexPrice", mon.IndexPrice), 0.022633)
	monOpenInterest := 5_386_209.0
	closeTo(t, "MON openInterestUsd", f64(t, "MON openInterestUsd", mon.OpenInterestUSD), monOpenInterest*0.022618, 5e-7)
	closeTo(t, "MON volume24hUsd", f64(t, "MON volume24hUsd", mon.Volume24hUSD), 212_988.830788, 5e-7)

	eth := snapshotBySymbol(snapshots, "ETH")
	if eth == nil {
		t.Fatal("ETH missing")
	}
	eq(t, "ETH markPrice", f64(t, "ETH markPrice", eth.MarkPrice), 2479.12)
	closeTo(t, "ETH volume24hUsd", f64(t, "ETH volume24hUsd", eth.Volume24hUSD), 2_335_278.22149, 5e-7)
}

func TestParseContextDeclaresNoClassSoAllCryptoAndQuotesTheCollateralToken(t *testing.T) {
	batch := ParseContext(loadContext(t), NOW)

	want := []struct {
		symbol, base string
		class        core.AssetClass
		quote        string
	}{
		{"BTC", "BTC", core.ClassCrypto, "AUSD"},
		{"MON", "MON", core.ClassCrypto, "AUSD"},
		{"ETH", "ETH", core.ClassCrypto, "AUSD"},
	}
	if len(batch.Snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(batch.Snapshots), len(want))
	}
	for i, w := range want {
		got := batch.Snapshots[i]
		eq(t, "venueSymbol", got.VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", got.Base, w.base)
		eq(t, w.symbol+" assetClass", got.AssetClass, w.class)
		eq(t, w.symbol+" quote", str(t, w.symbol+" quote", got.Quote), w.quote)
	}
	if len(batch.Settled) != 3 {
		t.Errorf("settled: got %d, want 3", len(batch.Settled))
	}
}

func TestParseContextSkipsClosedAndUnfundedMarkets(t *testing.T) {
	closed := withMarket(t, "MON", func(m *Market) { m.Config.IsOpen = false })
	eqList(t, "closed", snapshotSymbols(ParseContext(closed, NOW).Snapshots), []string{"BTC", "ETH"})

	unfunded := withMarket(t, "ETH", func(m *Market) { m.Funding = nil })
	eqList(t, "unfunded", settledSymbols(ParseContext(unfunded, NOW).Settled), []string{"BTC", "MON"})
}

func TestAnEventWithMillisecondsSettlesAtTheSameSecondAsOneWithout(t *testing.T) {
	// The venue served 1789339000946 once and 1789339000000 afterwards for the SAME event; without
	// the floor that one event would be stored twice.
	withMs := withMarket(t, "BTC", func(m *Market) {
		m.Funding.At.T.Val, m.Funding.At.T.OK = 1_789_339_000_946, true
	})
	withoutMs := withMarket(t, "BTC", func(m *Market) {
		m.Funding.At.T.Val, m.Funding.At.T.OK = 1_789_339_000_000, true
	})

	a := ParseContext(withMs, NOW)
	b := ParseContext(withoutMs, NOW)
	eq(t, "settledAt", a.Settled[0].SettledAt, int64(1_789_339_000_000))
	eq(t, "settledAt matches", a.Settled[0].SettledAt, b.Settled[0].SettledAt)
	eq(t, "rate matches", a.Settled[0].Rate, b.Settled[0].Rate)
	eq(t, "basisHours matches", a.Settled[0].BasisHours, b.Settled[0].BasisHours)
	if a.Snapshots[0].NextFundingAt == nil || *a.Snapshots[0].NextFundingAt != 1_789_339_000_000+2_580_000 {
		t.Errorf("nextFundingAt: got %v, want %d", a.Snapshots[0].NextFundingAt, int64(1_789_339_000_000+2_580_000))
	}
}

// fixtureDoer answers every request with one body, recording the URLs asked for. It is the Go seam
// for the fake HttpClient perpl.test.ts builds.
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

func TestFetchSnapshotsMakesOnePubContextRequestPerCycle(t *testing.T) {
	doer := &fixtureDoer{body: fixtureBytes(t, "context")}
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))

	for cycle := 0; cycle < 3; cycle++ {
		batch, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW+int64(cycle)*60_000))
		if err != nil {
			t.Fatalf("FetchSnapshots: %v", err)
		}
		if len(batch.Snapshots) != 3 {
			t.Fatalf("cycle %d snapshots: got %d, want 3", cycle, len(batch.Snapshots))
		}
	}

	want := []string{baseURL + "/pub/context", baseURL + "/pub/context", baseURL + "/pub/context"}
	eqList(t, "requests", doer.urls, want)
	// ~100 public requests a minute, and one per cycle is used.
	if MinInterval < 600*time.Millisecond {
		t.Errorf("MinInterval: got %v, want at least 600ms", MinInterval)
	}
	// Perpl publishes no public market funding history, so the adapter must not offer one: history
	// accrues forward from the settled events instead.
	type historyFetcher interface {
		FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error)
	}
	if _, offers := any(adapter).(historyFetcher); offers {
		t.Error("adapter offers FetchFundingHistory, but perpl publishes no public funding history")
	}
}

func TestFetchSnapshotsFailsTheCycleOnAnUnexpectedBody(t *testing.T) {
	doer := &fixtureDoer{body: []byte(`{"error":"rate limited"}`)}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))

	_, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(NOW))
	if err == nil {
		t.Fatal("want an error, got none — emitting nothing would look like a delisted venue")
	}
	if !strings.Contains(err.Error(), VenueID) {
		t.Errorf("error %q does not name the venue", err)
	}
}
