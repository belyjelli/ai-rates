package extended

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

type slowMarkets struct{ delay time.Duration }

func (d slowMarkets) Do(req *http.Request) (*http.Response, error) {
	select {
	case <-time.After(d.delay):
		return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(`{"status":"OK","data":[]}`)), Request: req}, nil
	case <-req.Context().Done():
		return nil, req.Context().Err()
	}
}

// TestTheSnapshotCallOutwaitsTheClientTimeout: /info/markets took 28-30 s at times from hklab, and a
// read cut off at the client's own limit failed 266 of 1,434 cycles in a day. The snapshot call
// carries its own longer limit, so a response slower than the client's still lands.
func TestTheSnapshotCallOutwaitsTheClientTimeout(t *testing.T) {
	client := httpclient.New(VenueID, httpclient.Options{Doer: slowMarkets{delay: 80 * time.Millisecond}, Timeout: 20 * time.Millisecond, MaxRetries: -1})
	if _, err := NewAdapter(client).FetchSnapshots(context.Background(), time.Now()); err != nil {
		t.Fatalf("a response slower than the client timeout but within marketsTimeout should succeed: %v", err)
	}
}
