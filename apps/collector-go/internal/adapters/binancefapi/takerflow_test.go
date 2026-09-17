package binancefapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// klines_btcusdt_5m.json is GET /fapi/v1/klines?symbol=BTCUSDT&interval=5m&startTime=1789658100000
// &limit=6, captured 2026-09-17 15:48Z. The last bar had closed by then.
func loadKlines(t *testing.T) []KlineRow {
	t.Helper()
	raw, err := os.ReadFile("testdata/klines_btcusdt_5m.json")
	if err != nil {
		t.Fatal(err)
	}
	var rows []KlineRow
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatalf("decode klines: %v", err)
	}
	return rows
}

func near(a, b float64) bool { return math.Abs(a-b) < 1e-6*math.Max(1, math.Abs(b)) }

func TestParseKlineTakerFlowFromTheLiveResponse(t *testing.T) {
	rows := loadKlines(t)
	flows := ParseKlineTakerFlow("binance", "BTCUSDT", rows, 1789658100000, 1789659600000)
	if len(flows) != 6 {
		t.Fatalf("flows = %d, want 6", len(flows))
	}

	first := flows[0]
	// openTime IS the bucket start; nothing is shifted.
	if first.BucketStart != 1789658100000 || first.VenueID != "binance" || first.VenueSymbol != "BTCUSDT" {
		t.Errorf("first = %+v", first)
	}
	// Taker buy is takerBuyQuote; taker sell is the rest of quoteVolume.
	if !near(first.BuyUSD, 32084057.0119) || !near(first.SellUSD, 55778532.9802-32084057.0119) {
		t.Errorf("first buy/sell = %v / %v", first.BuyUSD, first.SellUSD)
	}
	if first.ClosePrice == nil || *first.ClosePrice != 76358.70 {
		t.Errorf("first close = %v, want 76358.70", first.ClosePrice)
	}
	for i, flow := range flows {
		if flow.BucketStart != 1789658100000+int64(i)*core.TakerFlowBucketMs {
			t.Errorf("flow %d starts %d, off the 5-minute grid", i, flow.BucketStart)
		}
	}
	// The 15:35Z spike bucket, the one the stamping comparison against the other venues keys on.
	if !near(flows[4].BuyUSD+flows[4].SellUSD, 72849278.5687) {
		t.Errorf("15:35 total = %v, want 72849278.5687", flows[4].BuyUSD+flows[4].SellUSD)
	}
}

func TestParseKlineTakerFlowWindowClampAndGaps(t *testing.T) {
	rows := loadKlines(t)
	// Only buckets starting inside [from, to] survive; a from inside a bucket keeps that bucket.
	flows := ParseKlineTakerFlow("binance", "BTCUSDT", rows, 1789658400000+1, 1789658700000)
	if len(flows) != 2 || flows[0].BucketStart != 1789658400000 || flows[1].BucketStart != 1789658700000 {
		t.Errorf("windowed = %+v", flows)
	}

	var odd []KlineRow
	if err := json.Unmarshal([]byte(`[
		[1789658100000,"1","1","1","100","1",1789658399999,"10.0",1,"1","10.0000001","0"],
		[1789658400000,"1","1","1","100","1",1789658699999,"",1,"1","5","0"],
		[1789658700000,"1","1","1","","1",1789658999999,"8",1]
	]`), &odd); err != nil {
		t.Fatal(err)
	}
	flows = ParseKlineTakerFlow("binance", "BTCUSDT", odd, 0, 1789659000000)
	// Row 1: taker buy a rounding hair above the total must not become a negative sell the table's
	// CHECK would reject. Row 2: no quote volume, skipped rather than zero. Row 3: truncated before
	// takerBuyQuote, skipped.
	if len(flows) != 1 || flows[0].SellUSD != 0 || flows[0].BuyUSD != 10.0000001 {
		t.Errorf("odd rows = %+v", flows)
	}
}

// klineDoer serves synthetic bars for whatever startTime and limit are asked, up to lastBar, the way
// Binance does.
type klineDoer struct {
	lastBar int64
	asked   []string
}

func (d *klineDoer) Do(req *http.Request) (*http.Response, error) {
	q := req.URL.Query()
	d.asked = append(d.asked, q.Get("startTime")+"/"+q.Get("limit"))
	start, _ := strconv.ParseInt(q.Get("startTime"), 10, 64)
	limit, _ := strconv.Atoi(q.Get("limit"))
	var bars []string
	for at := start; at <= d.lastBar && len(bars) < limit; at += core.TakerFlowBucketMs {
		bars = append(bars, fmt.Sprintf(`[%d,"1","1","1","2","1",%d,"30","1","1","10","0"]`, at, at+299_999))
	}
	body := "[" + strings.Join(bars, ",") + "]"
	return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body))}, nil
}

func TestFetchTakerFlowBackfillsSevenDaysInPagesOfAThousand(t *testing.T) {
	now := int64(1789659690000) // 90 seconds into the 15:40Z bucket
	current := core.TakerFlowBucketStart(now)
	from := current - 7*24*12*core.TakerFlowBucketMs
	doer := &klineDoer{lastBar: current}
	adapter := Binance(httpclient.New("binance", httpclient.Options{Doer: doer, MaxRetries: -1}))
	adapter.takerPacer = nil // pacing is real time; the arithmetic is what is under test

	flows, err := adapter.FetchTakerFlow(context.Background(), "BTCUSDT", from, now)
	if err != nil {
		t.Fatal(err)
	}
	// 2,016 closed buckets plus the one in progress. Pages of 1000 weigh 5 each; the tail asks for
	// exactly what is left.
	if len(flows) != 2017 {
		t.Errorf("flows = %d, want 2017", len(flows))
	}
	want := []string{
		fmt.Sprintf("%d/1000", from),
		fmt.Sprintf("%d/1000", from+1000*core.TakerFlowBucketMs),
		fmt.Sprintf("%d/17", from+2000*core.TakerFlowBucketMs),
	}
	if strings.Join(doer.asked, " ") != strings.Join(want, " ") {
		t.Errorf("asked %v\nwant  %v", doer.asked, want)
	}
	if flows[0].BucketStart != from || flows[len(flows)-1].BucketStart != current {
		t.Errorf("span %d..%d, want %d..%d", flows[0].BucketStart, flows[len(flows)-1].BucketStart, from, current)
	}
	if flows[0].BuyUSD != 10 || flows[0].SellUSD != 20 {
		t.Errorf("first = %+v", flows[0])
	}
}

func TestFetchTakerFlowSteadyStateIsOneLightRequest(t *testing.T) {
	now := int64(1789659690000)
	current := core.TakerFlowBucketStart(now)
	doer := &klineDoer{lastBar: current}
	adapter := Binance(httpclient.New("binance", httpclient.Options{Doer: doer, MaxRetries: -1}))
	adapter.takerPacer = nil

	flows, err := adapter.FetchTakerFlow(context.Background(), "BTCUSDT", current-2*core.TakerFlowBucketMs, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(flows) != 3 || len(doer.asked) != 1 || doer.asked[0] != fmt.Sprintf("%d/3", current-600_000) {
		t.Errorf("flows = %d, asked = %v; want 3 flows from one limit=3 request", len(flows), doer.asked)
	}
}
