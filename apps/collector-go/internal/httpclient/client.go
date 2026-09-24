// Package httpclient is the per-venue JSON client: it spaces requests, retries transient failures
// with jittered exponential backoff honouring Retry-After, and opens a circuit after repeated
// failures so a broken venue does not burn its rate limit or stall the collector.
//
// Ported from packages/adapters/src/http.ts with the same constants and the same behaviour.
//
// WHERE THE MEMORY WIN ACTUALLY COMES FROM — and a correction. An earlier version of this comment
// claimed the win was json.Decoder streaming off resp.Body instead of the TypeScript client's
// `await response.text()` + `JSON.parse(text)`. Benchmarked against the bybit fixture and against
// synthetic bodies at production scale, that claim is FALSE at every size measured:
//
//	                       time/op    bytes/op   allocs/op
//	5.6 KB    streaming    61.6 µs     17,937        27
//	          buffered     60.7 µs     15,776        29
//	~240 KB   streaming     3.58 ms    896,433       864    (830 markets, a bybit linear book)
//	          buffered      3.39 ms    872,529       871
//	~1.4 MB   streaming    22.6 ms   8,196,708     5,043    (5,000 markets, past MEXC's 1,192)
//	          buffered     22.9 ms   7,198,842     5,053
//
// Buffered is leaner at every size and never meaningfully slower: json.Decoder carries its own
// growing internal read buffer, which costs about a megabyte extra on a 1.4 MB body. It earns its
// keep on streams of many values, which a venue response is not.
//
// The real advantage over the Bun collector is the language, not the decoder: Go holds a body as
// []byte at one byte per ASCII character where JavaScript holds a UTF-16 string at two, and the
// decoded structs are far smaller than the equivalent JS object graph. That is what the 537 MB peak
// against a 512 MB cap was made of, not the choice between Decode and Unmarshal.
//
// So GetJSON reads the body and unmarshals it, following the measurement. The read is bounded by
// maxBodyBytes — a cap neither approach had before, and the property that actually protects the
// process from a venue answering something enormous.
package httpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	UserAgent = "ai-rates-collector/0.1"

	baseBackoff    = 500 * time.Millisecond
	maxBackoff     = 15 * time.Second
	maxRetryAfter  = 60 * time.Second
	defaultTimeout = 15 * time.Second
	defaultRetries = 3

	// errSnippetBytes bounds what an error body may cost us. A venue that answers an HTML error
	// page to a JSON endpoint must not be able to allocate megabytes on the failure path.
	errSnippetBytes = 512

	// maxBodyBytes caps a successful response. MEXC's ~1,192-market body is the largest this
	// collector sees, at roughly 1.5 MB, so 64 MB is orders of magnitude of headroom while still
	// refusing a venue that answers something absurd. Without a cap, one bad response can page in
	// unbounded memory on a container limited to 1 GB.
	maxBodyBytes = 64 << 20
)

// Doer is the seam tests use instead of patching a global, mirroring FetchLike on the TypeScript
// side. http.Client satisfies it.
type Doer interface {
	Do(req *http.Request) (*http.Response, error)
}

// Error is a failed request against one venue.
type Error struct {
	VenueID string
	URL     string
	// Status is 0 for a transport failure or timeout, where no response arrived.
	Status  int
	Message string
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s: %s (%s)", e.VenueID, e.Message, e.URL)
}

// CircuitOpenError is returned while a venue's circuit is open, without making a request.
type CircuitOpenError struct {
	VenueID string
	RetryAt time.Time
}

func (e *CircuitOpenError) Error() string {
	return fmt.Sprintf("%s: circuit open until %s", e.VenueID, e.RetryAt.UTC().Format(time.RFC3339))
}

type Options struct {
	Doer      Doer
	UserAgent string
	Timeout   time.Duration
	// MaxRetries is retries AFTER the first attempt, for transport errors, timeouts, 429/418 and
	// 5xx. Zero means "use the default of 3", so a caller that wants exactly one attempt and no
	// retries passes a negative value; either way at least one request is always made.
	MaxRetries int
	// MinInterval is the minimum spacing between request STARTS for this venue.
	MinInterval time.Duration
	// FailureThreshold is consecutive failed calls (after retries) before the circuit opens.
	FailureThreshold int
	Cooldown         time.Duration
	// MaxBodyBytes caps a successful response; zero means the package default. Configurable so the
	// cap itself can be tested without constructing a 64 MB body.
	MaxBodyBytes int64

	// Seams for deterministic tests.
	Now   func() time.Time
	Sleep func(context.Context, time.Duration) error
	Rand  func() float64
}

// Client is one venue's JSON client. Safe for concurrent use: a venue's snapshot and history loops
// share one, which is what makes the spacing and the breaker apply per venue rather than per loop.
type Client struct {
	venueID string
	opts    Options

	mu                  sync.Mutex
	nextSlot            time.Time
	requests            int
	consecutiveFailures int
	openUntil           time.Time
}

func New(venueID string, opts Options) *Client {
	if opts.Doer == nil {
		// No shared DefaultClient: a per-venue transport keeps one venue's idle connections and
		// timeouts from being tuned by another's.
		opts.Doer = &http.Client{}
	}
	if opts.UserAgent == "" {
		opts.UserAgent = UserAgent
	}
	if opts.Timeout <= 0 {
		opts.Timeout = defaultTimeout
	}
	if opts.MaxRetries == 0 {
		opts.MaxRetries = defaultRetries
	}
	if opts.FailureThreshold <= 0 {
		opts.FailureThreshold = 5
	}
	if opts.Cooldown <= 0 {
		opts.Cooldown = 5 * time.Minute
	}
	if opts.MaxBodyBytes <= 0 {
		opts.MaxBodyBytes = maxBodyBytes
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Sleep == nil {
		opts.Sleep = func(ctx context.Context, d time.Duration) error {
			timer := time.NewTimer(d)
			defer timer.Stop()
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-timer.C:
				return nil
			}
		}
	}
	if opts.Rand == nil {
		opts.Rand = rand.Float64
	}
	return &Client{venueID: venueID, opts: opts}
}

func (c *Client) VenueID() string { return c.venueID }

// RequestCount is fetch attempts made so far, including retries. The scheduler records it per cycle,
// so a venue whose retries are climbing is visible before it starts failing outright.
func (c *Client) RequestCount() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.requests
}

type CircuitState struct {
	Open                bool
	ConsecutiveFailures int
	RetryAt             *time.Time
}

func (c *Client) Circuit() CircuitState {
	c.mu.Lock()
	defer c.mu.Unlock()
	state := CircuitState{ConsecutiveFailures: c.consecutiveFailures}
	if !c.openUntil.IsZero() {
		retryAt := c.openUntil
		state.RetryAt = &retryAt
		state.Open = c.opts.Now().Before(c.openUntil)
	}
	return state
}

type requestTimeoutKey struct{}

// WithRequestTimeout returns a context under which each request this client makes may take up to d,
// instead of the client's Timeout. For the rare large response that is worth waiting for: Gate's
// 1.3 MB contract list, read hourly, took 31-43 s over a slow link against the default 15 s.
func WithRequestTimeout(ctx context.Context, d time.Duration) context.Context {
	return context.WithValue(ctx, requestTimeoutKey{}, d)
}

// GetJSON fetches url and decodes the response body into out, streaming rather than buffering.
func (c *Client) GetJSON(ctx context.Context, url string, out any) error {
	return c.do(ctx, http.MethodGet, url, nil, out, nil, false)
}

// GetJSONOptional is GetJSON for a per-market resource the venue may simply not have, where a
// permanent 4xx means "nothing here for this market" rather than "this venue is broken".
//
// Such a response is still returned as an error, but it does not count towards the circuit. The
// circuit is shared with the venue's funding loop, and measured on 2026-09-17 bitget answers HTTP 400
// code 40054 ("The data fetched by DOGEUSDT is empty") for taker statistics on DOGE, BNB, LINK, ADA,
// PEPE and more: eleven of those in one taker-flow sweep opened bitget's circuit and paused its
// funding snapshots for five minutes, every five minutes. 429, 418, 5xx and transport failures are
// not "nothing here" and still count, so real throttling and outages still open the circuit.
func (c *Client) GetJSONOptional(ctx context.Context, url string, out any) error {
	return c.do(ctx, http.MethodGet, url, nil, out, nil, true)
}

// PostJSON posts body as JSON and decodes the response into out.
func (c *Client) PostJSON(ctx context.Context, url string, body any, out any) error {
	encoded, err := json.Marshal(body)
	if err != nil {
		return &Error{VenueID: c.venueID, URL: url, Message: "encode request: " + err.Error()}
	}
	return c.do(ctx, http.MethodPost, url, encoded, out, map[string]string{"content-type": "application/json"}, false)
}

func (c *Client) do(ctx context.Context, method, url string, body []byte, out any, headers map[string]string, optional bool) error {
	if err := c.checkCircuit(); err != nil {
		return err
	}

	// Clamped so the loop can never run zero times. An unclamped `try <= MaxRetries` with a
	// negative MaxRetries made no request at all and returned nil — reporting SUCCESS for a call
	// that never happened, which a caller cannot distinguish from a real empty response. A
	// misconfigured client must fail loudly, not silently claim to have collected.
	retries := c.opts.MaxRetries
	if retries < 0 {
		retries = 0
	}

	var lastErr error
	for try := 0; try <= retries; try++ {
		retryIn, err := c.attempt(ctx, method, url, body, out, headers)
		if err == nil {
			c.mu.Lock()
			c.consecutiveFailures = 0
			c.mu.Unlock()
			return nil
		}
		lastErr = err
		// retryIn < 0 means "transient, back off"; nil means "permanent, do not retry".
		if retryIn == nil || try == retries {
			break
		}
		wait := *retryIn
		if wait < 0 {
			backoff := baseBackoff * (1 << try)
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			wait = time.Duration(float64(backoff) * c.opts.Rand())
		}
		if err := c.opts.Sleep(ctx, wait); err != nil {
			return err
		}
	}

	if lastErr == nil {
		// Unreachable while the clamp above holds, and kept precisely so that if it ever stops
		// holding the result is a loud error rather than a fabricated success.
		lastErr = &Error{VenueID: c.venueID, URL: url, Message: "no request attempted"}
	}

	if optional && isAbsent(lastErr) {
		return lastErr
	}

	c.mu.Lock()
	c.consecutiveFailures++
	if c.consecutiveFailures >= c.opts.FailureThreshold {
		c.openUntil = c.opts.Now().Add(c.opts.Cooldown)
	}
	c.mu.Unlock()
	return lastErr
}

// isAbsent is a permanent client error: a 4xx other than the throttling statuses 429 and 418.
func isAbsent(err error) bool {
	httpErr, ok := err.(*Error)
	return ok && httpErr.Status >= 400 && httpErr.Status < 500 &&
		httpErr.Status != 429 && httpErr.Status != 418
}

func (c *Client) checkCircuit() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.openUntil.IsZero() {
		return nil
	}
	if c.opts.Now().Before(c.openUntil) {
		return &CircuitOpenError{VenueID: c.venueID, RetryAt: c.openUntil}
	}
	// Half-open: let this call through. A success clears the failure count; a failure re-opens.
	c.openUntil = time.Time{}
	return nil
}

// attempt makes one request. The returned duration is nil when the failure is permanent, negative
// when the caller should back off on its own schedule, and non-negative when the venue told us how
// long to wait via Retry-After.
func (c *Client) attempt(ctx context.Context, method, url string, body []byte, out any, headers map[string]string) (*time.Duration, error) {
	if err := c.waitForSlot(ctx); err != nil {
		return nil, err
	}

	timeout := c.opts.Timeout
	if override, ok := ctx.Value(requestTimeoutKey{}).(time.Duration); ok && override > 0 {
		timeout = override
	}
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var reader io.Reader
	if body != nil {
		// bytes.NewReader, not strings.NewReader(string(body)): the string conversion would copy
		// the whole body, in the one file whose purpose is not copying bodies.
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(reqCtx, method, url, reader)
	if err != nil {
		return nil, &Error{VenueID: c.venueID, URL: url, Message: "bad request: " + err.Error()}
	}
	req.Header.Set("accept", "application/json")
	req.Header.Set("user-agent", c.opts.UserAgent)
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	c.mu.Lock()
	c.requests++
	c.mu.Unlock()

	resp, err := c.opts.Doer.Do(req)
	if err != nil {
		reason := "network error"
		if errors.Is(err, context.DeadlineExceeded) {
			reason = "timeout"
		}
		transient := time.Duration(-1)
		return &transient, &Error{VenueID: c.venueID, URL: url, Message: reason}
	}
	defer func() {
		// Drain a little before closing so the connection can be reused; bounded, so a huge body on
		// a path we are abandoning cannot cost us.
		_, _ = io.CopyN(io.Discard, resp.Body, errSnippetBytes)
		_ = resp.Body.Close()
	}()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		// Read then unmarshal, which the benchmarks in the package doc show is leaner than
		// json.Decoder at every size this collector sees. LimitReader is the part that matters:
		// it is the only bound on what one response may cost.
		limit := c.opts.MaxBodyBytes
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, limit+1))
		if readErr != nil {
			transient := time.Duration(-1)
			return &transient, &Error{
				VenueID: c.venueID, URL: url, Status: resp.StatusCode,
				Message: "reading body: " + readErr.Error(),
			}
		}
		if int64(len(body)) > limit {
			return nil, &Error{
				VenueID: c.venueID, URL: url, Status: resp.StatusCode,
				Message: fmt.Sprintf("response exceeds %d bytes", limit),
			}
		}
		if err := json.Unmarshal(body, out); err != nil {
			return nil, &Error{
				VenueID: c.venueID, URL: url, Status: resp.StatusCode,
				Message: "invalid JSON: " + err.Error(),
			}
		}
		return nil, nil
	}

	snippet, _ := io.ReadAll(io.LimitReader(resp.Body, errSnippetBytes))
	httpErr := &Error{
		VenueID: c.venueID, URL: url, Status: resp.StatusCode,
		Message: fmt.Sprintf("HTTP %d %s", resp.StatusCode, strings.TrimSpace(string(snippet))),
	}
	if resp.StatusCode != 429 && resp.StatusCode != 418 && resp.StatusCode < 500 {
		return nil, httpErr
	}
	if after := RetryAfter(resp.Header.Get("retry-after"), c.opts.Now()); after != nil {
		return after, httpErr
	}
	transient := time.Duration(-1)
	return &transient, httpErr
}

// waitForSlot enforces the venue's minimum request spacing. The slot is reserved before sleeping,
// so concurrent callers queue rather than all waking into the same instant.
func (c *Client) waitForSlot(ctx context.Context) error {
	if c.opts.MinInterval <= 0 {
		return nil
	}
	c.mu.Lock()
	now := c.opts.Now()
	start := now
	if c.nextSlot.After(start) {
		start = c.nextSlot
	}
	c.nextSlot = start.Add(c.opts.MinInterval)
	wait := start.Sub(now)
	c.mu.Unlock()

	if wait > 0 {
		return c.opts.Sleep(ctx, wait)
	}
	return nil
}

// RetryAfter parses a Retry-After header (delta-seconds or an HTTP date) into a duration from now,
// capped at 60s and floored at zero. Returns nil when the header is absent or unparseable.
func RetryAfter(header string, now time.Time) *time.Duration {
	header = strings.TrimSpace(header)
	if header == "" {
		return nil
	}
	var d time.Duration
	if seconds, err := strconv.ParseFloat(header, 64); err == nil {
		d = time.Duration(seconds * float64(time.Second))
	} else if at, err := http.ParseTime(header); err == nil {
		d = at.Sub(now)
	} else {
		return nil
	}
	if d < 0 {
		d = 0
	}
	if d > maxRetryAfter {
		d = maxRetryAfter
	}
	return &d
}
