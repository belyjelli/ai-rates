package okx

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// taker_volume_btc_usdt_swap_5m.json is GET /api/v5/rubik/stat/taker-volume-contract
// ?instId=BTC-USDT-SWAP&period=5m&unit=2&begin=1789658099999&end=1789659600001, captured 2026-09-17
// 15:48Z: six buckets, 15:15Z to 15:40Z, newest first.
func TestParseTakerVolumeFromTheLiveResponse(t *testing.T) {
	raw, err := os.ReadFile("testdata/taker_volume_btc_usdt_swap_5m.json")
	if err != nil {
		t.Fatal(err)
	}
	var env Envelope[TakerVolumeRow]
	if err := json.Unmarshal(raw, &env); err != nil {
		t.Fatal(err)
	}
	rows, err := env.unwrap("taker volume")
	if err != nil {
		t.Fatal(err)
	}

	flows := ParseTakerVolume("BTC-USDT-SWAP", rows, 1789658100000, 1789659600000)
	if len(flows) != 6 {
		t.Fatalf("flows = %d, want 6", len(flows))
	}
	newest := flows[0]
	// ts is the bucket START; the columns are [ts, SELL, BUY].
	if newest.BucketStart != 1789659600000 || newest.VenueID != "okx" {
		t.Errorf("newest = %+v", newest)
	}
	if newest.SellUSD != 30042511.27575 || newest.BuyUSD != 20515873.0071200021 {
		t.Errorf("newest sell/buy = %v / %v, want 30042511.27575 / 20515873.00712", newest.SellUSD, newest.BuyUSD)
	}
	if newest.ClosePrice != nil {
		t.Errorf("close = %v; OKX carries no price and must store NULL, never zero", *newest.ClosePrice)
	}
	oldest := flows[5]
	if oldest.BucketStart != 1789658100000 || oldest.BuyUSD != 19698717.9366500005 {
		t.Errorf("oldest = %+v", oldest)
	}
}

func TestParseTakerVolumeSkipsUnreadableRows(t *testing.T) {
	var rows []TakerVolumeRow
	if err := json.Unmarshal([]byte(`[["1789659600000","",""],["1789659300000","-1","2"],["0","1","2"],["1789659000000","1"],["1789658700000","3","4"]]`), &rows); err != nil {
		t.Fatal(err)
	}
	flows := ParseTakerVolume("BTC-USDT-SWAP", rows, 0, 1789659600000)
	if len(flows) != 1 || flows[0].BucketStart != 1789658700000 || flows[0].SellUSD != 3 || flows[0].BuyUSD != 4 {
		t.Errorf("flows = %+v, want only the complete 15:25Z row", flows)
	}
}

// rubikDoer serves synthetic rows the way the live endpoint does: newest first, at most 100, strictly
// inside (begin, end), and nothing older than `oldest`, the five-day depth.
type rubikDoer struct {
	oldest, newest int64
	asked          []string
}

func (d *rubikDoer) Do(req *http.Request) (*http.Response, error) {
	q := req.URL.Query()
	d.asked = append(d.asked, q.Get("begin")+"-"+q.Get("end"))
	begin, _ := strconv.ParseInt(q.Get("begin"), 10, 64)
	end, _ := strconv.ParseInt(q.Get("end"), 10, 64)
	var rows []string
	for at := d.newest; at >= d.oldest && len(rows) < takerVolumePage; at -= core.TakerFlowBucketMs {
		if at > begin && at < end {
			rows = append(rows, fmt.Sprintf(`["%d","1.5","2.5"]`, at))
		}
	}
	body := `{"code":"0","msg":"","data":[` + strings.Join(rows, ",") + `]}`
	return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body))}, nil
}

func TestFetchTakerFlowPagesBackwardsToTheVenuesFiveDayDepth(t *testing.T) {
	now := int64(1789659690000)
	current := core.TakerFlowBucketStart(now)
	doer := &rubikDoer{newest: current, oldest: current - 5*24*12*core.TakerFlowBucketMs}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	adapter.takerPace = nil // pacing is real time; the paging is what is under test

	from := current - 7*24*12*core.TakerFlowBucketMs
	flows, err := adapter.FetchTakerFlow(context.Background(), "BTC-USDT-SWAP", from, now)
	if err != nil {
		t.Fatal(err)
	}
	// Five days of buckets plus the one in progress, each exactly once: exclusive bounds stepped
	// correctly neither drop nor repeat the row at a page edge.
	if len(flows) != 5*24*12+1 {
		t.Errorf("flows = %d, want %d", len(flows), 5*24*12+1)
	}
	seen := map[int64]bool{}
	for _, flow := range flows {
		if seen[flow.BucketStart] {
			t.Fatalf("bucket %d returned twice", flow.BucketStart)
		}
		seen[flow.BucketStart] = true
	}
	if len(doer.asked) != 15 {
		t.Errorf("requests = %d, want 15 (1,441 rows at 100 a page, the last one short)", len(doer.asked))
	}
	if doer.asked[0] != fmt.Sprintf("%d-%d", from-1, now+1) {
		t.Errorf("first request = %s", doer.asked[0])
	}
	if flows[0].BuyUSD != 2.5 || flows[0].SellUSD != 1.5 {
		t.Errorf("first = %+v", flows[0])
	}
}

func TestFetchTakerFlowAsksOnlyForUSDTSwaps(t *testing.T) {
	doer := &rubikDoer{newest: 1789659600000, oldest: 1789659600000}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	adapter.takerPace = nil
	for _, symbol := range []string{"BTC-USDC-SWAP", "BTC-USD-SWAP"} {
		flows, err := adapter.FetchTakerFlow(context.Background(), symbol, 0, 1789659690000)
		if err != nil || flows != nil {
			t.Errorf("%s: flows = %v, err = %v; want nothing", symbol, flows, err)
		}
	}
	if len(doer.asked) != 0 {
		t.Errorf("requests = %v, want none", doer.asked)
	}
}

func TestFetchTakerFlowReportsARateLimitEnvelope(t *testing.T) {
	doer := doerFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: http.Header{},
			Body: io.NopCloser(strings.NewReader(`{"msg":"Too Many Requests","code":"50011"}`))}, nil
	})
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	adapter.takerPace = nil
	if _, err := adapter.FetchTakerFlow(context.Background(), "BTC-USDT-SWAP", 0, 1789659690000); err == nil ||
		!strings.Contains(err.Error(), "50011") {
		t.Errorf("err = %v, want the 50011 envelope surfaced", err)
	}
}

type doerFunc func(*http.Request) (*http.Response, error)

func (f doerFunc) Do(req *http.Request) (*http.Response, error) { return f(req) }
