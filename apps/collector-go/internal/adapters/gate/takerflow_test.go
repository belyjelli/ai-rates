package gate

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

// contract_stats_btc_usdt_5m.json is GET /futures/usdt/contract_stats?contract=BTC_USDT&interval=5m
// &from=1789658100&limit=5, captured 2026-09-17 15:48Z: seven rows, 15:15Z to 15:45Z, the last an
// early partial reading of its bucket (see takerflow.go).
func loadContractStats(t *testing.T) []ContractStat {
	t.Helper()
	raw, err := os.ReadFile("testdata/contract_stats_btc_usdt_5m.json")
	if err != nil {
		t.Fatal(err)
	}
	var rows []ContractStat
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatal(err)
	}
	return rows
}

func sameUSD(a, b float64) bool { return math.Abs(a-b) < 1e-6*math.Max(1, math.Abs(b)) }

func TestParseContractStatsConvertsContractsToDollars(t *testing.T) {
	rows := loadContractStats(t)
	flows := ParseContractStats("BTC_USDT", rows, 0.0001, 1789658100000, 1789659900000)
	if len(flows) != 7 {
		t.Fatalf("flows = %d, want 7", len(flows))
	}

	first := flows[0]
	// `time` is SECONDS and the bucket START.
	if first.BucketStart != 1789658100000 || first.VenueID != "gate" || first.VenueSymbol != "BTC_USDT" {
		t.Errorf("first = %+v", first)
	}
	// 1,534,950 contracts x 0.0001 BTC x $76,419.90 = $11.73M. Without the multiplier it would read
	// $117 billion for five minutes of one market.
	if !sameUSD(first.BuyUSD, 1534950*0.0001*76419.9) || !sameUSD(first.SellUSD, 1065594*0.0001*76419.9) {
		t.Errorf("first buy/sell = %v / %v", first.BuyUSD, first.SellUSD)
	}
	if first.ClosePrice == nil || *first.ClosePrice != 76419.9 {
		t.Errorf("first close = %v, want the row's mark 76419.9", first.ClosePrice)
	}
	// The 15:40Z bucket, rewritten from 636,731 to 5,102,857 contracts ~2.5 minutes after it closed.
	if flows[5].BucketStart != 1789659600000 || !sameUSD(flows[5].BuyUSD, 2849254*0.0001*76754) {
		t.Errorf("15:40 = %+v", flows[5])
	}
}

func TestParseContractStatsRefusesWhatItCannotPrice(t *testing.T) {
	rows := loadContractStats(t)
	if flows := ParseContractStats("BTC_USDT", rows, 0, 0, math.MaxInt64); len(flows) != 0 {
		t.Errorf("no multiplier: %d flows, want none", len(flows))
	}

	var odd []ContractStat
	if err := json.Unmarshal([]byte(`[
		{"time":1789658100,"long_taker_size":10,"short_taker_size":5,"mark_price":0},
		{"time":1789658400,"long_taker_size":10,"short_taker_size":5},
		{"time":1789658700,"long_taker_size":-1,"short_taker_size":5,"mark_price":100},
		{"time":1789659000,"long_taker_size":10,"short_taker_size":5,"mark_price":"100"}
	]`), &odd); err != nil {
		t.Fatal(err)
	}
	flows := ParseContractStats("X_USDT", odd, 2, 0, math.MaxInt64)
	if len(flows) != 1 || flows[0].BucketStart != 1789659000000 || flows[0].BuyUSD != 2000 || flows[0].SellUSD != 1000 {
		t.Errorf("flows = %+v, want only the priced 15:30Z row", flows)
	}
}

// statsDoer answers /contracts with one multiplier and /contract_stats the way Gate does: from
// `from`, running a row past limit, up to lastBar.
type statsDoer struct {
	lastBar   int64 // seconds
	contracts int
	asked     []string
}

func (d *statsDoer) Do(req *http.Request) (*http.Response, error) {
	body := ""
	if strings.HasSuffix(req.URL.Path, "/contracts") {
		d.contracts++
		body = `[{"name":"BTC_USDT","quanto_multiplier":"0.0001"},{"name":"ETH_USDT","quanto_multiplier":"0.01"}]`
	} else {
		q := req.URL.Query()
		d.asked = append(d.asked, q.Get("from"))
		from, _ := strconv.ParseInt(q.Get("from"), 10, 64)
		limit, _ := strconv.Atoi(q.Get("limit"))
		var rows []string
		for at := from; at <= d.lastBar && len(rows) < limit+1; at += 300 {
			rows = append(rows, fmt.Sprintf(`{"time":%d,"long_taker_size":100,"short_taker_size":50,"mark_price":10}`, at))
		}
		body = "[" + strings.Join(rows, ",") + "]"
	}
	return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body))}, nil
}

func TestFetchTakerFlowBackfillsInTwoPagesAndCachesMultipliers(t *testing.T) {
	now := int64(1789659690000)
	current := core.TakerFlowBucketStart(now)
	from := current - 7*24*12*core.TakerFlowBucketMs
	doer := &statsDoer{lastBar: current / 1000}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	adapter.taker.pace = nil // pacing is real time; the paging is what is under test

	flows, err := adapter.FetchTakerFlow(context.Background(), "ETH_USDT", from, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(flows) != 2017 {
		t.Errorf("flows = %d, want 2017", len(flows))
	}
	seen := map[int64]bool{}
	for _, flow := range flows {
		if seen[flow.BucketStart] {
			t.Fatalf("bucket %d returned twice", flow.BucketStart)
		}
		seen[flow.BucketStart] = true
	}
	want := []string{strconv.FormatInt(from/1000, 10), strconv.FormatInt(from/1000+2001*300, 10)}
	if strings.Join(doer.asked, " ") != strings.Join(want, " ") {
		t.Errorf("asked from %v, want %v", doer.asked, want)
	}
	// 100 contracts x 0.01 ETH x $10.
	if flows[0].BuyUSD != 10 || flows[0].SellUSD != 5 {
		t.Errorf("first = %+v", flows[0])
	}

	// A second market reuses the contract list rather than re-reading ~981 contracts.
	if _, err := adapter.FetchTakerFlow(context.Background(), "BTC_USDT", current, now); err != nil {
		t.Fatal(err)
	}
	if doer.contracts != 1 {
		t.Errorf("contract list read %d times, want 1", doer.contracts)
	}

	// A contract with no multiplier is an error, never a raw contract count.
	if _, err := adapter.FetchTakerFlow(context.Background(), "NEW_USDT", current, now); err == nil {
		t.Error("NEW_USDT with no multiplier: want an error")
	}
}
