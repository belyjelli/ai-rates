package gate

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// snapshotDoer serves /contracts and /tickers, counts the contract reads, and can fail /contracts.
type snapshotDoer struct {
	contractReads int
	failContracts bool
	fundingRate   string
}

func (d *snapshotDoer) Do(req *http.Request) (*http.Response, error) {
	var body string
	switch {
	case strings.HasSuffix(req.URL.Path, "/contracts"):
		d.contractReads++
		if d.failContracts {
			return nil, errors.New("slow link")
		}
		// funding_next_apply is 2026-09-24 08:00Z; the interval is 8h.
		body = `[{"name":"BTC_USDT","funding_rate":"0.0001","funding_interval":28800,"funding_next_apply":1790236800,` +
			`"mark_price":"80000","index_price":"80000","quanto_multiplier":"0.0001"}]`
	case strings.HasSuffix(req.URL.Path, "/tickers"):
		body = `[{"contract":"BTC_USDT","funding_rate":"` + d.fundingRate + `","mark_price":"84000","index_price":"84010",` +
			`"total_size":"1000","volume_24h_quote":"5000000","highest_bid":"83999","highest_size":"10","lowest_ask":"84001","lowest_size":"12"}]`
	default:
		return nil, errors.New("unexpected " + req.URL.Path)
	}
	return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body)), Request: req}, nil
}

// TestTheContractListIsReadHourlyAndFundingComesFromTheTickers is the 2026-09-24 fix: the 1.3 MB list
// was read every cycle and timed out over a slow link, so it is cached, and the per-cycle fields are
// taken from the tickers instead of going stale with it.
func TestTheContractListIsReadHourlyAndFundingComesFromTheTickers(t *testing.T) {
	doer := &snapshotDoer{fundingRate: "0.0002"}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	start := time.Unix(1790222400, 0) // 04:00Z, before the 08:00Z settlement

	first, err := adapter.FetchSnapshots(context.Background(), start)
	if err != nil {
		t.Fatal(err)
	}
	btc := snapshotBySymbol(first.Snapshots, "BTC_USDT")
	if btc == nil {
		t.Fatal("BTC_USDT missing")
	}
	// The ticker's rate and mark, not the contract list's.
	eq(t, "rate", btc.Rate, 0.0002)
	eq(t, "mark", f64(t, "mark", btc.MarkPrice), 84000.0)

	// Two more cycles inside the hour, the funding rate having moved: one list read, live rates.
	doer.fundingRate = "0.0003"
	for _, later := range []time.Duration{time.Minute, 59 * time.Minute} {
		batch, err := adapter.FetchSnapshots(context.Background(), start.Add(later))
		if err != nil {
			t.Fatal(err)
		}
		eq(t, "rate after "+later.String(), snapshotBySymbol(batch.Snapshots, "BTC_USDT").Rate, 0.0003)
	}
	eq(t, "contract reads within the hour", doer.contractReads, 1)

	// Past the hour the list is read again.
	if _, err := adapter.FetchSnapshots(context.Background(), start.Add(61*time.Minute)); err != nil {
		t.Fatal(err)
	}
	eq(t, "contract reads after the hour", doer.contractReads, 2)
}

// TestTheNextSettlementRollsForwardFromTheCachedList: the tickers do not carry it, and a cached value
// would otherwise point into the past after the settlement it named.
func TestTheNextSettlementRollsForwardFromTheCachedList(t *testing.T) {
	doer := &snapshotDoer{fundingRate: "0.0001"}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	start := time.Unix(1790222400, 0) // 04:00Z
	if _, err := adapter.FetchSnapshots(context.Background(), start); err != nil {
		t.Fatal(err)
	}
	// 08:30Z: the list still names 08:00Z, which has passed; the snapshot must say 16:00Z. (4.5 h on,
	// so the list is re-read, but the fake serves the same 08:00Z: the roll is what fixes it.)
	batch, err := adapter.FetchSnapshots(context.Background(), time.Unix(1790238600, 0))
	if err != nil {
		t.Fatal(err)
	}
	next := snapshotBySymbol(batch.Snapshots, "BTC_USDT").NextFundingAt
	if next == nil || *next != 1790265600*1000 {
		t.Errorf("next funding: got %v, want 16:00Z (1790265600000)", next)
	}

	rolled := withLiveFunding([]Contract{{Name: "X", FundingInterval: 28800, FundingNextApply: 1790236800}}, nil, 1790238600*1000)
	eq(t, "rolled forward one interval", rolled[0].FundingNextApply, int64(1790265600))
	rolled = withLiveFunding([]Contract{{Name: "X", FundingInterval: 28800, FundingNextApply: 1790236800}}, nil, (1790236800+3*28800+5)*1000)
	eq(t, "rolled forward four intervals", rolled[0].FundingNextApply, int64(1790236800+4*28800))
}

// TestAFailedRefreshKeepsTheCachedList: once a list is in hand, a slow download costs an hour-late
// listing, not a lost cycle. With nothing cached the cycle still fails.
func TestAFailedRefreshKeepsTheCachedList(t *testing.T) {
	doer := &snapshotDoer{fundingRate: "0.0001", failContracts: true}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))
	start := time.Unix(1790222400, 0)
	if _, err := adapter.FetchSnapshots(context.Background(), start); err == nil {
		t.Fatal("first cycle with no list and a failing /contracts should fail")
	}

	doer.failContracts = false
	if _, err := adapter.FetchSnapshots(context.Background(), start); err != nil {
		t.Fatal(err)
	}
	doer.failContracts = true
	batch, err := adapter.FetchSnapshots(context.Background(), start.Add(2*time.Hour))
	if err != nil {
		t.Fatalf("a failed refresh with a cached list should not fail the cycle: %v", err)
	}
	if len(batch.Snapshots) != 1 {
		t.Errorf("snapshots: got %d, want 1 from the cached list", len(batch.Snapshots))
	}
}
