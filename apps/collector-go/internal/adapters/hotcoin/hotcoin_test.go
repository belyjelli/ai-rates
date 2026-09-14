package hotcoin

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
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// AT is the instant hotcoin.test.ts uses, so both suites pin identical output.
const AT int64 = 1_789_337_577_000

const HOUR int64 = 3_600_000

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "hotcoin")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/hotcoin above the working directory")
	return ""
}

// fixtureBytes is one of the SAME files packages/adapters/src/venues/hotcoin.test.ts reads.
func fixtureBytes(tb testing.TB, name string) []byte {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	return raw
}

func load[T any](tb testing.TB, name string) T {
	tb.Helper()
	var env Envelope[T]
	if err := json.Unmarshal(fixtureBytes(tb, name), &env); err != nil {
		tb.Fatalf("decode %s: %v", name, err)
	}
	data, err := env.unwrap(name)
	if err != nil {
		tb.Fatalf("unwrap %s: %v", name, err)
	}
	return data
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

func i64(tb testing.TB, label string, got *int64) int64 {
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
// constant expression instead, `7262189 * 0.001 * 76911.7` is folded at arbitrary precision and can
// land one ulp away from the value the parser computes.
func product(factors ...float64) float64 {
	out := 1.0
	for _, f := range factors {
		out *= f
	}
	return out
}

func hours(v float64) *float64 { return &v }

func ptr(s string) *string { return &s }

// num builds a present Num for the tests that construct wire structs directly rather than decoding
// them: adapters.Num has no MarshalJSON, so a struct containing one cannot be round-tripped.
func num(v float64) adapters.Num { return adapters.Num{Val: v, OK: true} }

// Real rows from Hotcoin on 2026-09-13 22:12 UTC: BTC, ETH, a small cap, a 1h market, USDC, tradfi,
// inverse.
func publicRows(tb testing.TB) []Ticker {
	tb.Helper()
	return load[[]Ticker](tb, "perpetual_public")
}

func feeRateRows(tb testing.TB, name string) []FeeRate {
	tb.Helper()
	return load[FeeRatePage](tb, name).Rows
}

func row(tb testing.TB, code string) Ticker {
	tb.Helper()
	for _, r := range publicRows(tb) {
		if r.Code == code {
			return r
		}
	}
	tb.Fatalf("no fixture row for %s", code)
	return Ticker{}
}

// everyEightHourly is every collected contract at 8h, except IOSTUSDT at the 1h its history shows.
func everyEightHourly(tb testing.TB) map[string]IntervalEntry {
	tb.Helper()
	codes, _ := TradableTickers(publicRows(tb))
	intervals := make(map[string]IntervalEntry, len(codes))
	for _, code := range codes {
		intervals[code] = IntervalEntry{Hours: hours(8), FetchedAt: AT}
	}
	intervals["iostusdt"] = IntervalEntry{Hours: hours(1), FetchedAt: AT}
	return intervals
}

func snapshotsFixture(tb testing.TB) []core.FundingSnapshot {
	tb.Helper()
	return ParseSnapshots(publicRows(tb), everyEightHourly(tb), AT)
}

func find(tb testing.TB, snapshots []core.FundingSnapshot, symbol string) core.FundingSnapshot {
	tb.Helper()
	for _, snapshot := range snapshots {
		if snapshot.VenueSymbol == symbol {
			return snapshot
		}
	}
	tb.Fatalf("no snapshot for %s", symbol)
	return core.FundingSnapshot{}
}

func symbolsOf(snapshots []core.FundingSnapshot) []string {
	out := make([]string, 0, len(snapshots))
	for _, snapshot := range snapshots {
		out = append(out, snapshot.VenueSymbol)
	}
	return out
}

func TestMinIntervalMatchesTypeScript(t *testing.T) {
	eq(t, "MinInterval", MinInterval, 150*time.Millisecond)
}

func TestParseSnapshotsNormalizesBTCUSDT(t *testing.T) {
	btc := find(t, snapshotsFixture(t), "btcusdt")

	eq(t, "venueId", btc.VenueID, VenueID)
	eq(t, "venueSymbol", btc.VenueSymbol, "btcusdt")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDT")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, AT)
	eq(t, "rate", btc.Rate, 0.0000645)
	eq(t, "basisHours", btc.BasisHours, 8.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 8.0)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", btc.NextFundingAt), int64(1_789_344_000_000))
	eq(t, "kind", btc.Kind, core.KindSettled)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 76911.7)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 76918.8)
	// 7,262,189 contracts of 0.001 BTC at the mark: $559M, against Binance's $8.04bn.
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", btc.OpenInterestUSD), product(7262189, 0.001, 76911.7))
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", btc.Volume24hUSD), 1537797191)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 200)
}

func TestFundIsTheSettledRateTheNewestFeeRateRowStampedAt160053(t *testing.T) {
	newest := feeRateRows(t, "fee-rate_btcusdt")[0]
	snapshots := snapshotsFixture(t)

	eq(t, "rate", find(t, snapshots, "btcusdt").Rate, newest.FeeRate.Val)
	eq(t, "settlementTime", SettlementTime(int64(newest.CreatedDate.Val)), int64(1_789_315_200_000))
	for _, snapshot := range snapshots {
		eq(t, snapshot.VenueSymbol+" kind", snapshot.Kind, core.KindSettled)
	}
}

func TestOpenInterestIsContractsTimesUnitAmountTimesMark(t *testing.T) {
	// 1000PEPE: 1,371,559 contracts of 1,000 "1000PEPE" at 0.003369 each.
	pepe := find(t, snapshotsFixture(t), "1000pepeusdt")
	eq(t, "base", pepe.Base, "PEPE")
	eq(t, "multiplier", pepe.Multiplier, 1000.0)
	eq(t, "openInterestUsd", f64(t, "openInterestUsd", pepe.OpenInterestUSD), product(1371559, 1000, 0.003369))
}

func TestAnOpenInterestOfZeroIsUnreportedNotZero(t *testing.T) {
	// BTCUSDC turned over $126.6M in the same 24h, so a zero is Hotcoin declining to say.
	eq(t, "totalPosition", row(t, "btcusdc").TotalPosition.Val, 0.0)

	usdc := find(t, snapshotsFixture(t), "btcusdc")
	eq(t, "quote", str(t, "quote", usdc.Quote), "USDC")
	if usdc.OpenInterestUSD != nil {
		t.Errorf("openInterestUsd: got %v, want nil", *usdc.OpenInterestUSD)
	}
	eq(t, "volume24hUsd", f64(t, "volume24hUsd", usdc.Volume24hUSD), 126554683)
}

func TestAContractWhoseIntervalIsNotKnownYetIsLeftOut(t *testing.T) {
	partial := ParseSnapshots(publicRows(t), map[string]IntervalEntry{
		"btcusdt": {Hours: hours(8), FetchedAt: AT},
	}, AT)
	if got := strings.Join(symbolsOf(partial), ","); got != "btcusdt" {
		t.Errorf("symbols: got %v, want [btcusdt]", got)
	}
}

func TestEachBasisIsTheContractsOwnInterval(t *testing.T) {
	iost := find(t, snapshotsFixture(t), "iostusdt")
	eq(t, "basisHours", iost.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", iost.IntervalHours), 1.0)
	eq(t, "nextFundingAt", i64(t, "nextFundingAt", iost.NextFundingAt), int64(1_789_340_400_000))
}

func TestLinearDollarContractsOnlyAndInverseBTCUSDIsDropped(t *testing.T) {
	codes, _ := TradableTickers(publicRows(t))
	want := []string{
		"btcusdt",
		"ethusdt",
		"sophusdt",
		"iostusdt",
		"1000pepeusdt",
		"btcusdc",
		"nas100usdt",
		"skhynixusdt",
	}
	if got := strings.Join(codes, ","); got != strings.Join(want, ",") {
		t.Errorf("tradable codes: got %v, want %v", got, want)
	}

	// The inverse row is margined in the coin and quoted in USD, so it never joins a USD pool.
	inverse := row(t, "btcusd")
	eq(t, "btcusd direction", inverse.Direction.Val, 1.0)
	eq(t, "btcusd base", inverse.Base, "btc")
	eq(t, "btcusd quote", inverse.Quote, "usd")

	if got := len(snapshotsFixture(t)); got != 8 {
		t.Errorf("snapshots: got %d, want 8", got)
	}
}

func TestTestingNonTradingAndMismatchedMarginRowsAreDropped(t *testing.T) {
	btc := row(t, "btcusdt")

	testing1 := btc
	testing1.Code = "a"
	testing1.Env = num(1)

	halted := btc
	halted.Code = "b"
	halted.TradeStatus = num(1)

	// The margin coin is `baseDisplayName`, despite the name: a row whose margin is not its quote is
	// not the linear contract it looks like.
	mismatched := btc
	mismatched.Code = "c"
	mismatched.BaseDisplayName = ptr("BTC")

	// A margin coin we do not collect, matched on both sides.
	unknownCoin := btc
	unknownCoin.Code = "d"
	unknownCoin.BaseDisplayName = ptr("USDE")
	unknownCoin.QuoteDisplayName = ptr("USDE")

	codes, byCode := TradableTickers([]Ticker{testing1, halted, mismatched, unknownCoin})
	if len(codes) != 0 || len(byCode) != 0 {
		t.Errorf("tradable: got %v, want none", codes)
	}
}

func TestEveryQuoteIsTheDeclaredMarginCoin(t *testing.T) {
	for _, snapshot := range snapshotsFixture(t) {
		quote := str(t, snapshot.VenueSymbol+" quote", snapshot.Quote)
		if quote != "USDT" && quote != "USDC" {
			t.Errorf("%s quote: got %v, want USDT or USDC", snapshot.VenueSymbol, quote)
		}
	}
}

func TestHotcoinDeclaresNothingSoNAS100AndSKHynixAreCryptoAsListed(t *testing.T) {
	snapshots := snapshotsFixture(t)

	nas := find(t, snapshots, "nas100usdt")
	eq(t, "nas100 base", nas.Base, "NAS100")
	eq(t, "nas100 assetClass", nas.AssetClass, core.ClassCrypto)

	hynix := find(t, snapshots, "skhynixusdt")
	eq(t, "skhynix base", hynix.Base, "SKHYNIX")
	eq(t, "skhynix assetClass", hynix.AssetClass, core.ClassCrypto)

	for _, snapshot := range snapshots {
		eq(t, snapshot.VenueSymbol+" assetClass", snapshot.AssetClass, core.ClassCrypto)
	}
}

func TestAnyFilledTradfiFieldIsANotCryptoDeclaration(t *testing.T) {
	// The base tables pick WHICH class; the venue only says it is not crypto.
	pushed := row(t, "nas100usdt")
	pushed.IsPushTradfi = num(1)
	eq(t, "isPushTradfi/NAS100", AssetClassFor(pushed, "NAS100"), core.ClassIndex)

	tagged := row(t, "skhynixusdt")
	tagged.TradfiTagNameEn = "Stocks"
	eq(t, "tradfiTagNameEn/SKHYNIX", AssetClassFor(tagged, "SKHYNIX"), core.ClassEquity)

	categorised := row(t, "btcusdt")
	categorised.AssetCategory = num(3)
	eq(t, "assetCategory/COPPER", AssetClassFor(categorised, "COPPER"), core.ClassCommodity)
}

func TestSettlementTimeSnapsStampsWrittenMinutesAfterTheHourBackOntoIt(t *testing.T) {
	eq(t, "16:02:48", SettlementTime(1_789_228_968_000), int64(1_789_228_800_000))
	eq(t, "21:02:17", SettlementTime(1_789_333_337_000), int64(1_789_333_200_000))
	// 20:40:30 is twenty minutes from any hour, so it is kept, to the minute.
	eq(t, "20:40:30", SettlementTime(1_789_332_030_000), int64(1_789_332_060_000))
}

func TestIntervalHoursReads8hForBTCUSDTAnd1hForIOSTUSDT(t *testing.T) {
	eq(t, "btcusdt", f64(t, "btcusdt", IntervalHours(feeRateRows(t, "fee-rate_btcusdt"), nil)), 8.0)
	eq(t, "iostusdt", f64(t, "iostusdt", IntervalHours(feeRateRows(t, "fee-rate_iostusdt"), nil)), 1.0)
}

func TestASingleSettlementIsMeasuredAgainstTheNextOne(t *testing.T) {
	newest := feeRateRows(t, "fee-rate_iostusdt")[0]
	next := int64(1_789_340_400_000)

	eq(t, "one settlement", f64(t, "one settlement", IntervalHours([]FeeRate{newest}, &next)), 1.0)
	if got := IntervalHours(nil, &next); got != nil {
		t.Errorf("no settlement: got %v, want nil", *got)
	}
}

func TestParseFundingHistoryOldestFirstOnTheHourWithTheBasisFromTheGaps(t *testing.T) {
	events := ParseFundingHistory("btcusdt", feeRateRows(t, "fee-rate_btcusdt"), 0, AT, nil, nil)

	want := []struct {
		settledAt  int64
		rate       float64
		basisHours float64
	}{
		{1_789_200_000_000, 0.0001290088921301, 8},
		{1_789_228_800_000, 0.0001087301061988, 8},
		{1_789_257_600_000, 0.00004794, 8},
		{1_789_286_400_000, 0.000110132201253, 8},
		{1_789_315_200_000, 0.0000645, 8},
	}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, expected := range want {
		eq(t, "settledAt", events[i].SettledAt, expected.settledAt)
		eq(t, "rate", events[i].Rate, expected.rate)
		eq(t, "basisHours", events[i].BasisHours, expected.basisHours)
	}
	eq(t, "venueId", events[0].VenueID, VenueID)
	eq(t, "base", events[0].Base, "BTC")
	if events[0].MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *events[0].MarkPrice)
	}
}

// routeDoer answers each URL from a route function and records what was asked for, the Go seam for
// the fake HttpClient hotcoin.test.ts builds.
type routeDoer struct {
	urls  []string
	route func(string) []byte
}

func (d *routeDoer) Do(req *http.Request) (*http.Response, error) {
	requested := req.URL.String()
	d.urls = append(d.urls, requested)
	return &http.Response{
		Status:     "200 OK",
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(d.route(requested))),
		Request:    req,
	}, nil
}

func (d *routeDoer) matching(substring string) []string {
	var out []string
	for _, requested := range d.urls {
		if strings.Contains(requested, substring) {
			out = append(out, requested)
		}
	}
	return out
}

var feeRatePath = regexp.MustCompile(`/perpetual/public/([^/]+)/fee-rate$`)

// fixtureRoute serves the bulk list, and the two fee-rate fixtures for every contract asked about:
// IOSTUSDT's 1h history for IOSTUSDT, BTCUSDT's 8h history for everything else.
func fixtureRoute(tb testing.TB) func(string) []byte {
	tb.Helper()
	public := fixtureBytes(tb, "perpetual_public")
	btc := fixtureBytes(tb, "fee-rate_btcusdt")
	iost := fixtureBytes(tb, "fee-rate_iostusdt")

	return func(requested string) []byte {
		if requested == API {
			return public
		}
		parsed, err := url.Parse(requested)
		if err != nil {
			tb.Fatalf("parse %s: %v", requested, err)
		}
		match := feeRatePath.FindStringSubmatch(parsed.Path)
		if match == nil {
			tb.Fatalf("unexpected %s", requested)
			return nil
		}
		code, err := url.PathUnescape(match[1])
		if err != nil {
			tb.Fatalf("unescape %s: %v", match[1], err)
		}
		if code == "iostusdt" {
			return iost
		}
		return btc
	}
}

// MaxRetries is negative for exactly one attempt per call, so the URL count is the cycle's own.
func newTestAdapter(doer *routeDoer, budget *int) *Adapter {
	return NewAdapterWithOptions(
		httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}),
		Options{IntervalRefreshBudget: budget},
	)
}

func TestAdapterOneBulkCallThenFeeRateSamplesWithinBudget(t *testing.T) {
	doer := &routeDoer{route: fixtureRoute(t)}
	budget := 3
	adapter := newTestAdapter(doer, &budget)
	eq(t, "venueId", adapter.VenueID(), "hotcoin")

	first, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(AT))
	if err != nil {
		t.Fatalf("cycle: %v", err)
	}

	want := []string{
		API,
		API + "/btcusdt/fee-rate?page=1&pageSize=4",
		API + "/ethusdt/fee-rate?page=1&pageSize=4",
		API + "/sophusdt/fee-rate?page=1&pageSize=4",
	}
	if got := strings.Join(doer.urls, "\n"); got != strings.Join(want, "\n") {
		t.Errorf("requests:\ngot\n%v\nwant\n%v", got, strings.Join(want, "\n"))
	}
	// Only the three whose interval the budget paid for are emitted.
	if got := strings.Join(symbolsOf(first.Snapshots), ","); got != "btcusdt,ethusdt,sophusdt" {
		t.Errorf("symbols: got %v, want btcusdt,ethusdt,sophusdt", got)
	}
	if len(first.Settled) != 0 {
		t.Errorf("settled: got %d, want none", len(first.Settled))
	}
}

func TestAdapterCoversEveryContractThenOnlyRereadsTheBulkList(t *testing.T) {
	doer := &routeDoer{route: fixtureRoute(t)}
	adapter := newTestAdapter(doer, nil)
	ctx := context.Background()

	first, err := adapter.FetchSnapshots(ctx, time.UnixMilli(AT))
	if err != nil {
		t.Fatalf("first cycle: %v", err)
	}
	// One bulk call plus one fee-rate call per collected contract, inside the default budget of 40.
	eq(t, "first cycle requests", len(doer.urls), 9)
	if got := len(first.Snapshots); got != 8 {
		t.Fatalf("snapshots: got %d, want 8", got)
	}
	// Each contract's own measured interval, not a shared guess.
	eq(t, "iostusdt basisHours", find(t, first.Snapshots, "iostusdt").BasisHours, 1.0)
	eq(t, "btcusdt basisHours", find(t, first.Snapshots, "btcusdt").BasisHours, 8.0)

	doer.urls = nil
	if _, err := adapter.FetchSnapshots(ctx, time.UnixMilli(AT+60_000)); err != nil {
		t.Fatalf("second cycle: %v", err)
	}
	if got := strings.Join(doer.urls, ","); got != API {
		t.Errorf("second cycle requests: got %v, want just the bulk list", doer.urls)
	}
}

func TestAdapterWarmUpSeedsIntervalsSoARestartCollectsEverythingFromTheFirstCycle(t *testing.T) {
	doer := &routeDoer{route: fixtureRoute(t)}
	budget := 0
	adapter := newTestAdapter(doer, &budget)

	codes, _ := TradableTickers(publicRows(t))
	warmed := make([]KnownMarket, 0, len(codes))
	for _, code := range codes {
		warmed = append(warmed, KnownMarket{VenueSymbol: code, IntervalHours: hours(8)})
	}
	adapter.WarmUp(warmed)

	batch, err := adapter.FetchSnapshots(context.Background(), time.UnixMilli(AT))
	if err != nil {
		t.Fatalf("cycle: %v", err)
	}
	if got := strings.Join(doer.urls, ","); got != API {
		t.Errorf("requests: got %v, want just the bulk list", doer.urls)
	}
	if got := len(batch.Snapshots); got != 8 {
		t.Errorf("snapshots: got %d, want 8", got)
	}
}

func TestAdapterANon200EnvelopeFailsTheCycle(t *testing.T) {
	doer := &routeDoer{route: func(string) []byte {
		return []byte(`{"code":500,"data":null,"msg":"服务器内部错误"}`)
	}}

	_, err := newTestAdapter(doer, nil).FetchSnapshots(context.Background(), time.UnixMilli(AT))
	if err == nil {
		t.Fatal("want an error for a non-200 envelope, got nil")
	}
	if !strings.Contains(err.Error(), "hotcoin") {
		t.Errorf("error: got %q, want it to name the venue", err)
	}
}

// historyPage renders one page of settlements, newest first, as raw JSON: adapters.Num has no
// MarshalJSON, so a FeeRatePage cannot be marshalled back out.
func historyPage(page, count int, newest int64) []byte {
	var body strings.Builder
	body.WriteString(`{"code":200,"msg":"success","data":{"total":110,"rows":[`)
	for i := 0; i < count; i++ {
		if i > 0 {
			body.WriteString(",")
		}
		createdDate := newest - int64((page-1)*100+i)*8*HOUR
		fmt.Fprintf(&body, `{"contractCode":"btcusdt","feeRate":0.0001,"createdDate":%d}`, createdDate)
	}
	body.WriteString(`]}}`)
	return []byte(body.String())
}

func TestAdapterHistoryPagesBackUntilAShortPage(t *testing.T) {
	const newest int64 = 1_789_315_253_000
	doer := &routeDoer{route: func(requested string) []byte {
		parsed, err := url.Parse(requested)
		if err != nil {
			t.Fatalf("parse %s: %v", requested, err)
		}
		page, err := strconv.Atoi(parsed.Query().Get("page"))
		if err != nil {
			t.Fatalf("page in %s: %v", requested, err)
		}
		if page == 1 {
			return historyPage(1, 100, newest)
		}
		return historyPage(2, 10, newest)
	}}

	events, err := newTestAdapter(doer, nil).FetchFundingHistory(context.Background(), "btcusdt", 0, AT)
	if err != nil {
		t.Fatalf("history: %v", err)
	}

	want := []string{
		API + "/btcusdt/fee-rate?page=1&pageSize=100",
		API + "/btcusdt/fee-rate?page=2&pageSize=100",
	}
	if got := strings.Join(doer.urls, "\n"); got != strings.Join(want, "\n") {
		t.Errorf("requests:\ngot\n%v\nwant\n%v", got, strings.Join(want, "\n"))
	}
	if len(events) != 110 {
		t.Fatalf("events: got %d, want 110", len(events))
	}
	// Oldest first, whatever order the venue served them in.
	if events[0].SettledAt >= events[len(events)-1].SettledAt {
		t.Errorf("events: got %d first and %d last, want oldest first",
			events[0].SettledAt, events[len(events)-1].SettledAt)
	}
}

func TestAdapterHistoryStopsPagingOnceAPageReachesPastTheWindow(t *testing.T) {
	const newest int64 = 1_789_315_253_000
	doer := &routeDoer{route: func(string) []byte { return historyPage(1, 100, newest) }}

	from := 1_789_315_200_000 - 3*24*HOUR
	events, err := newTestAdapter(doer, nil).FetchFundingHistory(context.Background(), "btcusdt", from, AT)
	if err != nil {
		t.Fatalf("history: %v", err)
	}
	if got := len(doer.matching("fee-rate")); got != 1 {
		t.Errorf("requests: got %d, want 1 — the first page already reaches past the window", got)
	}
	// Three days of 8-hourly settlements, inclusive of the boundary.
	if len(events) != 10 {
		t.Errorf("events: got %d, want 10", len(events))
	}
}
