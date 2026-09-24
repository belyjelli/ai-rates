package httpclient

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

// slowDoer answers after a delay, or gives up when the request's context does.
type slowDoer struct{ delay time.Duration }

func (d slowDoer) Do(req *http.Request) (*http.Response, error) {
	select {
	case <-time.After(d.delay):
		return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(`{"ok":true}`)), Request: req}, nil
	case <-req.Context().Done():
		return nil, req.Context().Err()
	}
}

// TestWithRequestTimeoutLetsOneCallOutwaitTheClient: the override is what lets Gate's 1.3 MB list and
// Extended's 1 MB markets finish over a slow link, without raising every other call's limit.
func TestWithRequestTimeoutLetsOneCallOutwaitTheClient(t *testing.T) {
	client := New("test", Options{Doer: slowDoer{delay: 80 * time.Millisecond}, Timeout: 20 * time.Millisecond, MaxRetries: -1})
	var out struct{ OK bool }

	if err := client.GetJSON(context.Background(), "https://example.test/x", &out); err == nil {
		t.Fatal("an 80 ms response under a 20 ms client timeout should fail")
	}
	if err := client.GetJSON(WithRequestTimeout(context.Background(), time.Second), "https://example.test/x", &out); err != nil || !out.OK {
		t.Fatalf("with a 1 s override it should succeed: %v", err)
	}
}
