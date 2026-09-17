package httpclient

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

// fakeDoer answers from a queue of canned responses, following the adapters' own dependency
// injection rather than patching a global transport.
type fakeDoer struct {
	responses []func() (*http.Response, error)
	calls     int
}

func (f *fakeDoer) Do(*http.Request) (*http.Response, error) {
	if f.calls >= len(f.responses) {
		return nil, errors.New("fakeDoer: no response queued")
	}
	next := f.responses[f.calls]
	f.calls++
	return next()
}

func respond(status int, body string, headers map[string]string) func() (*http.Response, error) {
	return func() (*http.Response, error) {
		h := http.Header{}
		for k, v := range headers {
			h.Set(k, v)
		}
		return &http.Response{
			StatusCode: status,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     h,
		}, nil
	}
}

func fail(err error) func() (*http.Response, error) {
	return func() (*http.Response, error) { return nil, err }
}

// testClient fixes the clock, records sleeps instead of taking them, and removes jitter, so every
// assertion below is about behaviour rather than timing.
func testClient(t *testing.T, doer *fakeDoer, tune func(*Options)) (*Client, *[]time.Duration, *time.Time) {
	t.Helper()
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	var slept []time.Duration

	opts := Options{
		Doer: doer,
		Now:  func() time.Time { return now },
		Sleep: func(_ context.Context, d time.Duration) error {
			slept = append(slept, d)
			return nil
		},
		Rand: func() float64 { return 1 },
	}
	if tune != nil {
		tune(&opts)
	}
	return New("bybit", opts), &slept, &now
}

type payload struct {
	RetCode int    `json:"retCode"`
	Name    string `json:"name"`
}

func TestGetJSONStreamsBodyIntoTarget(t *testing.T) {
	doer := &fakeDoer{responses: []func() (*http.Response, error){
		respond(200, `{"retCode":0,"name":"bybit"}`, nil),
	}}
	client, _, _ := testClient(t, doer, nil)

	var got payload
	if err := client.GetJSON(context.Background(), "https://example.test/v5", &got); err != nil {
		t.Fatalf("GetJSON: %v", err)
	}
	if got.Name != "bybit" || got.RetCode != 0 {
		t.Errorf("decoded %+v, want {0 bybit}", got)
	}
	if client.RequestCount() != 1 {
		t.Errorf("requests: got %d, want 1", client.RequestCount())
	}
}

func TestGetJSONRetriesTransientAndCountsEveryAttempt(t *testing.T) {
	doer := &fakeDoer{responses: []func() (*http.Response, error){
		respond(503, "upstream down", nil),
		fail(errors.New("connection reset")),
		respond(200, `{"retCode":0,"name":"ok"}`, nil),
	}}
	client, slept, _ := testClient(t, doer, nil)

	var got payload
	if err := client.GetJSON(context.Background(), "https://example.test/v5", &got); err != nil {
		t.Fatalf("GetJSON: %v", err)
	}
	if got.Name != "ok" {
		t.Errorf("name: got %q, want ok", got.Name)
	}
	// Retries are attempts: a venue whose retries climb is visible in the cycle's request count
	// before it starts failing outright.
	if client.RequestCount() != 3 {
		t.Errorf("requests: got %d, want 3", client.RequestCount())
	}
	// Jitter is pinned to 1, so the backoff is the full 500ms then 1s.
	want := []time.Duration{500 * time.Millisecond, time.Second}
	if len(*slept) != len(want) {
		t.Fatalf("sleeps: got %v, want %v", *slept, want)
	}
	for i, w := range want {
		if (*slept)[i] != w {
			t.Errorf("sleep[%d]: got %v, want %v", i, (*slept)[i], w)
		}
	}
	if client.Circuit().ConsecutiveFailures != 0 {
		t.Errorf("a success must clear the failure count, got %d", client.Circuit().ConsecutiveFailures)
	}
}

func TestGetJSONHonoursRetryAfterOverBackoff(t *testing.T) {
	doer := &fakeDoer{responses: []func() (*http.Response, error){
		respond(429, "slow down", map[string]string{"retry-after": "2"}),
		respond(200, `{"retCode":0,"name":"ok"}`, nil),
	}}
	client, slept, _ := testClient(t, doer, nil)

	var got payload
	if err := client.GetJSON(context.Background(), "https://example.test/v5", &got); err != nil {
		t.Fatalf("GetJSON: %v", err)
	}
	if len(*slept) != 1 || (*slept)[0] != 2*time.Second {
		t.Errorf("sleeps: got %v, want [2s] from Retry-After", *slept)
	}
}

func TestGetJSONDoesNotRetryPermanentFailures(t *testing.T) {
	doer := &fakeDoer{responses: []func() (*http.Response, error){
		respond(400, "bad symbol", nil),
		respond(200, `{"retCode":0,"name":"unreachable"}`, nil),
	}}
	client, slept, _ := testClient(t, doer, nil)

	var got payload
	err := client.GetJSON(context.Background(), "https://example.test/v5", &got)
	if err == nil {
		t.Fatal("want an error for HTTP 400, got nil")
	}
	var httpErr *Error
	if !errors.As(err, &httpErr) || httpErr.Status != 400 {
		t.Fatalf("want an *Error with status 400, got %#v", err)
	}
	if client.RequestCount() != 1 {
		t.Errorf("requests: got %d, want 1 — a 400 must not be retried", client.RequestCount())
	}
	if len(*slept) != 0 {
		t.Errorf("sleeps: got %v, want none", *slept)
	}
}

func TestInvalidJSONIsNotRetried(t *testing.T) {
	doer := &fakeDoer{responses: []func() (*http.Response, error){
		respond(200, `<html>maintenance</html>`, nil),
	}}
	client, _, _ := testClient(t, doer, nil)

	var got payload
	err := client.GetJSON(context.Background(), "https://example.test/v5", &got)
	if err == nil || !strings.Contains(err.Error(), "invalid JSON") {
		t.Fatalf("want an invalid JSON error, got %v", err)
	}
	if client.RequestCount() != 1 {
		t.Errorf("requests: got %d, want 1", client.RequestCount())
	}
}

func TestOversizedBodyIsRefusedAndNotRetried(t *testing.T) {
	// The cap is the only bound on what one response may cost a container limited to 1 GB. Without
	// it a venue answering something enormous pages in unbounded memory, which is the failure this
	// whole rewrite exists to stop happening again.
	doer := &fakeDoer{responses: []func() (*http.Response, error){
		respond(200, strings.Repeat("x", 128), nil),
		respond(200, `{"retCode":0,"name":"unreachable"}`, nil),
	}}
	client, _, _ := testClient(t, doer, func(o *Options) { o.MaxBodyBytes = 32 })

	var got payload
	err := client.GetJSON(context.Background(), "https://example.test/v5", &got)
	if err == nil || !strings.Contains(err.Error(), "exceeds 32 bytes") {
		t.Fatalf("want an oversize error naming the limit, got %v", err)
	}
	// Refusing is permanent, not transient: retrying would re-download the same oversized body.
	if client.RequestCount() != 1 {
		t.Errorf("requests: got %d, want 1", client.RequestCount())
	}
}

func TestBodyExactlyAtTheLimitIsAccepted(t *testing.T) {
	// An off-by-one here would reject legitimate responses, so the boundary is pinned: the limit is
	// inclusive, and only a body strictly larger than it is refused.
	body := `{"retCode":0,"name":"ok"}`
	doer := &fakeDoer{responses: []func() (*http.Response, error){respond(200, body, nil)}}
	client, _, _ := testClient(t, doer, func(o *Options) { o.MaxBodyBytes = int64(len(body)) })

	var got payload
	if err := client.GetJSON(context.Background(), "https://example.test/v5", &got); err != nil {
		t.Fatalf("a body exactly at the limit must be accepted: %v", err)
	}
	if got.Name != "ok" {
		t.Errorf("name: got %q, want ok", got.Name)
	}
}

func TestCircuitOpensAfterThresholdAndRefusesWithoutRequesting(t *testing.T) {
	// Five calls that each exhaust their retries. With MaxRetries 0 that is one attempt apiece.
	responses := make([]func() (*http.Response, error), 0, 5)
	for i := 0; i < 5; i++ {
		responses = append(responses, respond(500, "boom", nil))
	}
	doer := &fakeDoer{responses: responses}
	client, _, _ := testClient(t, doer, func(o *Options) { o.MaxRetries = -1 })

	for i := 0; i < 5; i++ {
		var got payload
		if err := client.GetJSON(context.Background(), "https://example.test/v5", &got); err == nil {
			t.Fatalf("call %d: want an error", i)
		}
	}

	state := client.Circuit()
	if !state.Open || state.ConsecutiveFailures != 5 {
		t.Fatalf("circuit: got %+v, want open after 5 failures", state)
	}

	// The sixth call must not reach the transport at all: an open circuit exists to stop a broken
	// venue burning its rate limit.
	before := doer.calls
	var got payload
	err := client.GetJSON(context.Background(), "https://example.test/v5", &got)
	var openErr *CircuitOpenError
	if !errors.As(err, &openErr) {
		t.Fatalf("want CircuitOpenError, got %v", err)
	}
	if doer.calls != before {
		t.Errorf("transport calls: got %d, want %d — an open circuit must not request", doer.calls, before)
	}
}

func TestCircuitHalfOpensAfterCooldown(t *testing.T) {
	doer := &fakeDoer{responses: []func() (*http.Response, error){
		respond(500, "boom", nil),
		respond(200, `{"retCode":0,"name":"recovered"}`, nil),
	}}
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	client := New("bybit", Options{
		Doer:             doer,
		MaxRetries:       -1,
		FailureThreshold: 1,
		Cooldown:         time.Minute,
		Now:              func() time.Time { return now },
		Sleep:            func(context.Context, time.Duration) error { return nil },
		Rand:             func() float64 { return 1 },
	})

	var got payload
	if err := client.GetJSON(context.Background(), "https://example.test/v5", &got); err == nil {
		t.Fatal("want the first call to fail")
	}
	if !client.Circuit().Open {
		t.Fatal("want the circuit open after one failure at threshold 1")
	}

	now = now.Add(2 * time.Minute)
	if err := client.GetJSON(context.Background(), "https://example.test/v5", &got); err != nil {
		t.Fatalf("half-open probe should be allowed through: %v", err)
	}
	if got.Name != "recovered" {
		t.Errorf("name: got %q, want recovered", got.Name)
	}
	if client.Circuit().Open {
		t.Error("a successful probe must close the circuit")
	}
}

func TestMinIntervalReservesSlotsForConcurrentCallers(t *testing.T) {
	doer := &fakeDoer{responses: []func() (*http.Response, error){
		respond(200, `{"retCode":0}`, nil),
		respond(200, `{"retCode":0}`, nil),
		respond(200, `{"retCode":0}`, nil),
	}}
	client, slept, _ := testClient(t, doer, func(o *Options) { o.MinInterval = 100 * time.Millisecond })

	for i := 0; i < 3; i++ {
		var got payload
		if err := client.GetJSON(context.Background(), "https://example.test/v5", &got); err != nil {
			t.Fatalf("call %d: %v", i, err)
		}
	}

	// The clock is frozen, so each reservation stacks on the last: 0, then 100ms, then 200ms.
	want := []time.Duration{100 * time.Millisecond, 200 * time.Millisecond}
	if len(*slept) != len(want) {
		t.Fatalf("sleeps: got %v, want %v", *slept, want)
	}
	for i, w := range want {
		if (*slept)[i] != w {
			t.Errorf("sleep[%d]: got %v, want %v", i, (*slept)[i], w)
		}
	}
}

func TestRetryAfter(t *testing.T) {
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)

	if got := RetryAfter("", now); got != nil {
		t.Errorf("absent: got %v, want nil", got)
	}
	if got := RetryAfter("not-a-date", now); got != nil {
		t.Errorf("unparseable: got %v, want nil", got)
	}
	if got := RetryAfter("3", now); got == nil || *got != 3*time.Second {
		t.Errorf("delta-seconds: got %v, want 3s", got)
	}
	// Capped, so a venue cannot park the collector for an hour.
	if got := RetryAfter("3600", now); got == nil || *got != maxRetryAfter {
		t.Errorf("cap: got %v, want %v", got, maxRetryAfter)
	}
	// A date in the past floors at zero rather than going negative.
	past := now.Add(-time.Hour).Format(http.TimeFormat)
	if got := RetryAfter(past, now); got == nil || *got != 0 {
		t.Errorf("past date: got %v, want 0", got)
	}
	future := now.Add(5 * time.Second).Format(http.TimeFormat)
	if got := RetryAfter(future, now); got == nil || *got != 5*time.Second {
		t.Errorf("future date: got %v, want 5s", got)
	}
}

// A market a venue keeps no statistics for answers a permanent 4xx. Fetched as optional, that must
// not open the circuit the funding loop shares -- the 2026-09-17 bitget incident, where eleven
// 40054s in one taker-flow sweep paused funding collection -- while a 429 still counts.
func TestOptionalAbsentResponsesDoNotOpenTheCircuit(t *testing.T) {
	responses := make([]func() (*http.Response, error), 0, 8)
	for i := 0; i < 7; i++ {
		responses = append(responses, respond(400, `{"code":"40054","msg":"The data fetched by DOGEUSDT is empty"}`, nil))
	}
	responses = append(responses, respond(429, "slow down", nil))
	doer := &fakeDoer{responses: responses}
	client, _, _ := testClient(t, doer, func(o *Options) { o.MaxRetries = -1 })

	for i := 0; i < 7; i++ {
		var got payload
		if err := client.GetJSONOptional(context.Background(), "https://example.test/taker", &got); err == nil {
			t.Fatalf("call %d: want the 400 returned as an error", i)
		}
	}
	if state := client.Circuit(); state.Open || state.ConsecutiveFailures != 0 {
		t.Fatalf("circuit after absent responses: got %+v, want closed with no failures", state)
	}

	var got payload
	_ = client.GetJSONOptional(context.Background(), "https://example.test/taker", &got)
	if state := client.Circuit(); state.ConsecutiveFailures != 1 {
		t.Fatalf("a 429 is throttling, not absence: got %+v, want one failure counted", state)
	}
}
