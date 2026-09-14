package lbank

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

// The same instant lbank.test.ts uses, so both suites pin identical output.
const AT int64 = 1_789_337_579_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "lbank")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/lbank above the working directory")
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

// The SAME files packages/adapters/src/venues/lbank.test.ts reads.
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

// Real rows from LBank on 2026-09-13 22:12 UTC: BTC, ETH, 4h and 1h small caps, tradfi, and a dead
// market.
func instruments(tb testing.TB) []Instrument {
	tb.Helper()
	var env Envelope[Instrument]
	load(tb, "instrument", &env)
	return env.Data
}

func marketRows(tb testing.TB) []MarketData {
	tb.Helper()
	var env Envelope[MarketData]
	load(tb, "marketData", &env)
	return env.Data
}

func instrument(tb testing.TB, symbol string) Instrument {
	tb.Helper()
	for _, i := range instruments(tb) {
		if i.Symbol == symbol {
			return i
		}
	}
	tb.Fatalf("instrument %s missing from the fixture", symbol)
	return Instrument{}
}

func marketRow(tb testing.TB, symbol string) MarketData {
	tb.Helper()
	for _, row := range marketRows(tb) {
		if row.Symbol == symbol {
			return row
		}
	}
	tb.Fatalf("marketData row %s missing from the fixture", symbol)
	return MarketData{}
}

func parsed(tb testing.TB) []core.FundingSnapshot {
	tb.Helper()
	return ParseSnapshots(marketRows(tb), TradableInstruments(instruments(tb)), AT)
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
	btc := snapshotBySymbol(parsed(t), "BTCUSDT")
	if btc == nil {
		t.Fatal("BTCUSDT missing")
	}

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "BTCUSDT")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, AT)
	eq(t, "rate", btc.Rate, 0.00007709)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != 1_789_344_000_000 {
		t.Errorf("nextFundingAt: got %v, want 1789344000000", btc.NextFundingAt)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76926.6)
	// The index, not the mark: `underlyingPrice` sits 0.0bp from instrument.indexPrice.
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76955.1)
	if btc.OpenInterestUSD != nil {
		t.Errorf("openInterestUsd: got %v, want nil -- LBank publishes none", *btc.OpenInterestUSD)
	}
	// "240366999.20357918" as served.
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 240366999.2035792)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 200)
}

func TestPositionFeeTimeIsSeconds(t *testing.T) {
	// 28800 is 8h, 14400 is 4h, 3600 is 1h.
	snapshots := parsed(t)
	want := []struct {
		symbol string
		hours  float64
		next   int64
	}{
		{"BTCUSDT", 8, 1_789_344_000_000},
		{"PUMPUSDT", 4, 1_789_344_000_000},
		// The only hourly markets are the ones settling at 23:00 rather than 00:00.
		{"VRTUSDT", 1, 1_789_340_400_000},
	}
	for _, w := range want {
		got := snapshotBySymbol(snapshots, w.symbol)
		if got == nil {
			t.Fatalf("%s missing", w.symbol)
		}
		eq(t, w.symbol+" basisHours", got.BasisHours, w.hours)
		eq(t, w.symbol+" intervalHours", f64(t, w.symbol+" intervalHours", got.IntervalHours), w.hours)
		if got.NextFundingAt == nil || *got.NextFundingAt != w.next {
			t.Errorf("%s nextFundingAt: got %v, want %d", w.symbol, got.NextFundingAt, w.next)
		}
	}
}

func TestRateIsTheRunningEstimateAndVolumeIsQuoteTurnover(t *testing.T) {
	snapshots := parsed(t)
	for _, s := range snapshots {
		eq(t, s.VenueSymbol+" kind", s.Kind, core.KindPredicted)
		if s.OpenInterestUSD != nil {
			t.Errorf("%s openInterestUsd: got %v, want nil", s.VenueSymbol, *s.OpenInterestUSD)
		}
	}

	// `volume` is base units and is NOT what is collected; `turnover` is its quote value.
	var raw struct {
		Data []struct {
			Symbol string `json:"symbol"`
			Volume string `json:"volume"`
		} `json:"data"`
	}
	load(t, "marketData", &raw)
	for _, row := range raw.Data {
		if row.Symbol == "ETHUSDT" {
			eq(t, "ETHUSDT volume (base units, unused)", row.Volume, "67957.612")
		}
	}

	eth := snapshotBySymbol(snapshots, "ETHUSDT")
	if eth == nil {
		t.Fatal("ETHUSDT missing")
	}
	eq(t, "ETHUSDT rate", eth.Rate, 0.00006659)
	// "169322755.99390147" as served.
	eq(t, "ETHUSDT volume24hUsd", f64(t, "ETHUSDT volume24hUsd", eth.Volume24hUSD), 169322755.99390146)
}

func TestReadsTheContractSizePrefixAsAMultiplier(t *testing.T) {
	bttc := snapshotBySymbol(parsed(t), "1000BTTCUSDT")
	if bttc == nil {
		t.Fatal("1000BTTCUSDT missing")
	}
	eq(t, "base", bttc.Base, "BTTC")
	eq(t, "multiplier", bttc.Multiplier, 1000.0)
}

func TestRowWithNoFundingRateAtAllIsSkipped(t *testing.T) {
	// 10TAUSDT, untraded for 24h, sends neither fundingRate nor positionFeeRate.
	snapshots := parsed(t)
	if snapshotBySymbol(snapshots, "10TAUSDT") != nil {
		t.Error("10TAUSDT: a row with no rate of either kind must be skipped, not collected at zero")
	}
	if len(snapshots) != 9 {
		t.Errorf("snapshots: got %d, want 9", len(snapshots))
	}
}

func TestOnlyStatus2OnlyListedInstrumentsAndOnlyDollarSettlement(t *testing.T) {
	tradable := TradableInstruments(instruments(t))

	notTrading := marketRow(t, "BTCUSDT")
	notTrading.InstrumentStatus = "1"
	if got := ParseSnapshots([]MarketData{notTrading}, tradable, AT); len(got) != 0 {
		t.Errorf("instrumentStatus 1: got %d snapshots, want none", len(got))
	}

	unlisted := marketRow(t, "BTCUSDT")
	unlisted.Symbol = "NEWUSDT"
	if got := ParseSnapshots([]MarketData{unlisted}, tradable, AT); len(got) != 0 {
		t.Errorf("unlisted symbol: got %d snapshots, want none", len(got))
	}

	coinSettled := instrument(t, "BTCUSDT")
	coinSettled.ClearCurrency = "BTC"
	if got := TradableInstruments([]Instrument{coinSettled}); len(got) != 0 {
		t.Errorf("coin-settled: got %d tradable instruments, want none", len(got))
	}
}

func TestQuoteIsTheDeclaredClearCurrency(t *testing.T) {
	usdc := instrument(t, "BTCUSDT")
	usdc.ClearCurrency = "USDC"
	got := ParseSnapshots(marketRows(t), TradableInstruments([]Instrument{usdc}), AT)
	if len(got) == 0 {
		t.Fatal("no snapshots")
	}
	eq(t, "quote", str(t, "quote", got[0].Quote), "USDC")

	for _, s := range parsed(t) {
		eq(t, s.VenueSymbol+" quote", str(t, "quote", s.Quote), "USDT")
	}
}

func TestADeclaredMaxLeverageOfZeroIsNoFigure(t *testing.T) {
	tradable := TradableInstruments(instruments(t))
	if got := tradable["10TAUSDT"].MaxLeverage; got != nil {
		t.Errorf("10TAUSDT maxLeverage: got %v, want nil -- a declared 0 is no figure", *got)
	}
	eq(t, "GOLDUSDT maxLeverage", f64(t, "GOLDUSDT maxLeverage", tradable["GOLDUSDT"].MaxLeverage), 500)
}

func TestNeedSuspendOneIsNotCryptoAndTheBaseTablesPickTheClass(t *testing.T) {
	ceg := instrument(t, "CEGUSDT")
	if !ceg.NeedSuspend.OK || ceg.NeedSuspend.Val != 1 {
		t.Fatalf("CEGUSDT needSuspend: got %v, want 1", ceg.NeedSuspend)
	}
	eq(t, "CEGUSDT class", AssetClassFor(ceg), core.ClassEquity)

	// SUGAR is in core's commodity table, so the suspended soft commodities are no longer filed as
	// equity.
	sugar := snapshotBySymbol(parsed(t), "SUGARUSDT")
	if sugar == nil {
		t.Fatal("SUGARUSDT missing")
	}
	eq(t, "SUGARUSDT class", sugar.AssetClass, core.ClassCommodity)

	aluminium := ceg
	aluminium.BaseCurrency = "XAL"
	eq(t, "XAL class", AssetClassFor(aluminium), core.ClassCommodity)
}

func TestEverythingElseDeclaresNothingAndIsCryptoGoldAndMicronIncluded(t *testing.T) {
	snapshots := parsed(t)

	// The alias table files GOLD under XAU; the class stays LBank's, so it never meets commodity:XAU.
	gold := snapshotBySymbol(snapshots, "GOLDUSDT")
	if gold == nil {
		t.Fatal("GOLDUSDT missing")
	}
	eq(t, "GOLDUSDT base", gold.Base, "XAU")
	eq(t, "GOLDUSDT class", gold.AssetClass, core.ClassCrypto)

	micron := snapshotBySymbol(snapshots, "MUSTOCKUSDT")
	if micron == nil {
		t.Fatal("MUSTOCKUSDT missing")
	}
	eq(t, "MUSTOCKUSDT base", micron.Base, "MUSTOCK")
	eq(t, "MUSTOCKUSDT class", micron.AssetClass, core.ClassCrypto)

	counts := map[core.AssetClass]int{}
	for _, s := range snapshots {
		counts[s.AssetClass]++
	}
	// SUGAR moved to commodity with the base-table row, leaving one equity.
	eq(t, "crypto", counts[core.ClassCrypto], 7)
	eq(t, "equity", counts[core.ClassEquity], 1)
	eq(t, "commodity", counts[core.ClassCommodity], 1)
}

// fixtureDoer answers each URL with the fixture whose path it carries, recording what was asked for.
// It is the Go seam for the fake HttpClient lbank.test.ts builds.
type fixtureDoer struct {
	urls       []string
	instrument []byte
	marketData []byte
	// body, when set, answers every request instead of the fixtures.
	body []byte
}

func (d *fixtureDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	body := d.body
	if body == nil {
		body = d.instrument
		if strings.Contains(requested, "/marketData") {
			body = d.marketData
		}
	}
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

func newTestAdapter(doer *fixtureDoer) *Adapter {
	// MaxRetries is negative for exactly one attempt per call, so the URL count is the walk's own.
	return NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
}

func TestFetchSnapshotsReadsInstrumentHourlyAndMarketDataEveryCycle(t *testing.T) {
	doer := &fixtureDoer{instrument: fixtureBytes(t, "instrument"), marketData: fixtureBytes(t, "marketData")}
	adapter := newTestAdapter(doer)
	eq(t, "venueId", adapter.VenueID(), VenueID)

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(AT))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}
	if len(first.Snapshots) != 9 {
		t.Fatalf("snapshots: got %d, want 9", len(first.Snapshots))
	}
	if len(first.Settled) != 0 {
		t.Errorf("settled: got %d, want none -- LBank publishes no settled figure", len(first.Settled))
	}

	want := []string{instrumentURL, marketDataURL}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, url := range want {
		eq(t, "request", doer.urls[i], url)
	}

	// The instrument list only says what trades, so it is re-read hourly, not per cycle.
	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(AT+60_000)); err != nil {
		t.Fatalf("FetchSnapshots at +60s: %v", err)
	}
	if len(doer.urls) != 1 || doer.urls[0] != marketDataURL {
		t.Errorf("requests at +60s: got %v, want exactly [%s]", doer.urls, marketDataURL)
	}

	doer.urls = nil
	if _, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(AT+60*60_000)); err != nil {
		t.Fatalf("FetchSnapshots at +1h: %v", err)
	}
	if len(doer.urls) != len(want) {
		t.Fatalf("requests at +1h: got %d (%v), want %d", len(doer.urls), doer.urls, len(want))
	}
	for i, url := range want {
		eq(t, "request at +1h", doer.urls[i], url)
	}
}

func TestAnErrorEnvelopeFailsTheCycle(t *testing.T) {
	// Built as a raw string: adapters.Num has no MarshalJSON, so a wire struct cannot be
	// round-tripped into a body.
	doer := &fixtureDoer{body: []byte(`{"data":null,"error_code":10004,"msg":"limit","success":false}`)}
	_, err := newTestAdapter(doer).FetchSnapshots(context.Background(), time.UnixMilli(AT))
	if err == nil {
		t.Fatal("an error envelope must fail the cycle rather than read as an empty book")
	}
	if !strings.Contains(err.Error(), "lbank") {
		t.Errorf("error: got %q, want it to name the venue", err.Error())
	}
	eq(t, "error", err.Error(), "lbank: unexpected instrument response: 10004 limit")
}

// fundingHistoryFetcher is the shape an adapter with a history endpoint would have.
//
// LBank publishes NO funding-history API -- everything under /pub but getTime, instrument,
// marketData and marketOrder answers 403 -- so history for this venue is only ever what the
// collector records live. The TypeScript pins this with `expect(adapter.fetchFundingHistory)
// .toBeUndefined()`; in Go the equivalent is that *Adapter must not satisfy this interface.
type fundingHistoryFetcher interface {
	FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error)
}

func TestAdapterPublishesNoFundingHistory(t *testing.T) {
	var adapter any = NewAdapter(httpclient.New(VenueID, httpclient.Options{}))
	if _, offers := adapter.(fundingHistoryFetcher); offers {
		t.Error("lbank has no funding-history API: an adapter must not invent one")
	}
}
