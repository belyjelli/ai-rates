package bitget

import (
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Both captured 2026-09-17 15:48Z, BTCUSDT:
//   - taker_buy_sell_btcusdt_5m.json is GET /api/v2/mix/market/taker-buy-sell?symbol=BTCUSDT&period=5m,
//     the 30 buckets the endpoint always returns, 13:20Z to 15:45Z, oldest first.
//   - candles_btcusdt_5m.json is GET /api/v2/mix/market/candles?symbol=BTCUSDT&productType=usdt-futures
//     &granularity=5m&startTime=1789651199999&endTime=1789659900000&limit=100, fetched right after,
//     covering the same 30 buckets.
func loadTakerFixtures(t *testing.T) ([]TakerBuySell, []Candle) {
	t.Helper()
	var taker Envelope[TakerBuySell]
	var candles Envelope[Candle]
	for name, into := range map[string]any{"taker_buy_sell_btcusdt_5m": &taker, "candles_btcusdt_5m": &candles} {
		raw, err := os.ReadFile("testdata/" + name + ".json")
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(raw, into); err != nil {
			t.Fatalf("decode %s: %v", name, err)
		}
	}
	rows, err := taker.unwrap("taker buy sell")
	if err != nil {
		t.Fatal(err)
	}
	candleRows, err := candles.unwrap("candles")
	if err != nil {
		t.Fatal(err)
	}
	return rows, candleRows
}

func TestParseTakerBuySellPricesEachBucketWithItsOwnCandle(t *testing.T) {
	rows, candles := loadTakerFixtures(t)
	if len(rows) != 30 || len(candles) != 30 {
		t.Fatalf("fixture rows = %d taker, %d candles; want 30 and 30", len(rows), len(candles))
	}

	flows := ParseTakerBuySell("BTCUSDT", rows, candles, 0, math.MaxInt64)
	if len(flows) != 30 {
		t.Fatalf("flows = %d, want 30", len(flows))
	}
	first := flows[0]
	// ts is the bucket START, the same stamp as the candle it is priced by.
	if first.BucketStart != 1789651200000 || first.VenueID != "bitget" {
		t.Errorf("first = %+v", first)
	}
	// BASE coin x that bucket's close: 40.2701 BTC x $76,586.20 bought.
	if math.Abs(first.BuyUSD-40.2701*76586.2) > 1e-6 || math.Abs(first.SellUSD-70.6678*76586.2) > 1e-6 {
		t.Errorf("first buy/sell = %v / %v", first.BuyUSD, first.SellUSD)
	}
	if first.ClosePrice == nil || *first.ClosePrice != 76586.2 {
		t.Errorf("first close = %v", first.ClosePrice)
	}

	// The stamping evidence, pinned: taker buy + sell is the candle's baseVol for the same ts, to the
	// venue's four decimals, on every bucket but the one still filling (fetched a moment apart).
	byTS := map[float64]float64{}
	for _, candle := range candles {
		byTS[candle.field(candleTS).Val] = candle.field(5).Val
	}
	for _, row := range rows[:len(rows)-1] {
		if math.Abs(row.BuyVolume.Val+row.SellVolume.Val-byTS[row.TS.Val]) > 1e-3 {
			t.Errorf("ts %.0f: buy+sell %v != candle baseVol %v", row.TS.Val, row.BuyVolume.Val+row.SellVolume.Val, byTS[row.TS.Val])
		}
	}
}

func TestParseTakerBuySellSkipsBucketsWithNoPrice(t *testing.T) {
	rows, candles := loadTakerFixtures(t)
	// Drop the 13:25Z candle and zero the 13:30Z close: neither bucket may be priced from a neighbour.
	pruned := append([]Candle(nil), candles[:1]...)
	pruned = append(pruned, candles[2:]...)
	var zeroed Candle
	if err := json.Unmarshal([]byte(`["1789651800000","1","1","1","0","1","1"]`), &zeroed); err != nil {
		t.Fatal(err)
	}
	pruned[1] = zeroed

	flows := ParseTakerBuySell("BTCUSDT", rows, pruned, 0, math.MaxInt64)
	if len(flows) != 28 {
		t.Errorf("flows = %d, want 28", len(flows))
	}
	for _, flow := range flows {
		if flow.BucketStart == 1789651500000 || flow.BucketStart == 1789651800000 {
			t.Errorf("bucket %d was priced without its own candle", flow.BucketStart)
		}
	}

	// And the window: only buckets starting in [from, to].
	windowed := ParseTakerBuySell("BTCUSDT", rows, candles, 1789659300000, 1789659600000)
	if len(windowed) != 2 || windowed[0].BucketStart != 1789659300000 {
		t.Errorf("windowed = %+v", windowed)
	}
}

type takerDoer struct {
	taker, candles []byte
	asked          []string
}

func (d *takerDoer) Do(req *http.Request) (*http.Response, error) {
	d.asked = append(d.asked, req.URL.Path+"?"+req.URL.RawQuery)
	body := d.taker
	if strings.HasSuffix(req.URL.Path, "/candles") {
		body = d.candles
	}
	return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(string(body)))}, nil
}

func TestFetchTakerFlowAsksForCandlesCoveringOnlyTheBucketsWanted(t *testing.T) {
	taker, _ := os.ReadFile("testdata/taker_buy_sell_btcusdt_5m.json")
	candles, _ := os.ReadFile("testdata/candles_btcusdt_5m.json")
	doer := &takerDoer{taker: taker, candles: candles}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	adapter.takerPace = nil // pacing is real time; the requests are what is under test

	// The steady state: two buckets behind the newest stored, which the venue's 30 rows cover.
	flows, err := adapter.FetchTakerFlow(context.Background(), "BTCUSDT", 1789659300000, 1789659990000)
	if err != nil {
		t.Fatal(err)
	}
	if len(flows) != 3 {
		t.Errorf("flows = %d, want 3", len(flows))
	}
	want := []string{
		"/api/v2/mix/market/taker-buy-sell?symbol=BTCUSDT&period=5m",
		// startTime is exclusive of a bucket stamped exactly on it, so one millisecond before.
		"/api/v2/mix/market/candles?symbol=BTCUSDT&productType=usdt-futures&granularity=5m&startTime=1789659299999&endTime=1789659900000&limit=100",
	}
	if strings.Join(doer.asked, "\n") != strings.Join(want, "\n") {
		t.Errorf("asked\n%s\nwant\n%s", strings.Join(doer.asked, "\n"), strings.Join(want, "\n"))
	}

	// A USDC book has no taker data at Bitget, so it costs no request.
	doer.asked = nil
	if flows, err := adapter.FetchTakerFlow(context.Background(), "BTCPERP", 0, 1789659990000); err != nil || flows != nil || len(doer.asked) != 0 {
		t.Errorf("BTCPERP: flows = %v, err = %v, asked = %v; want nothing", flows, err, doer.asked)
	}
}
