package hyperliquid

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// fixtureBytes reads a fixture verbatim, for tests that feed it through a fake transport rather
// than decoding it directly.
func fixtureBytes(tb testing.TB, name string) []byte {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb), name+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	return data
}

func raw(tb testing.TB, name string) string { return string(fixtureBytes(tb, name)) }

func at(ms int64) time.Time { return time.UnixMilli(ms).UTC() }

// fakeDoer answers the info endpoint by request TYPE, recording every body so the tests can assert
// exactly which requests were sent — which is the whole point for the shared caches.
type fakeDoer struct {
	mu     sync.Mutex
	bodies []map[string]any
	handle func(kind string) (string, error)
}

func (f *fakeDoer) Do(req *http.Request) (*http.Response, error) {
	payload, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		return nil, err
	}

	f.mu.Lock()
	f.bodies = append(f.bodies, body)
	handle := f.handle
	f.mu.Unlock()

	kind, _ := body["type"].(string)
	answer, handleErr := handle(kind)
	if handleErr != nil {
		return &http.Response{StatusCode: 500, Body: io.NopCloser(strings.NewReader("boom")), Header: http.Header{}}, nil
	}
	return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(answer)), Header: http.Header{}}, nil
}

func (f *fakeDoer) sent(kind string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, body := range f.bodies {
		if body["type"] == kind {
			n++
		}
	}
	return n
}

func (f *fakeDoer) types() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]string, len(f.bodies))
	for i, body := range f.bodies {
		out[i], _ = body["type"].(string)
	}
	return out
}

// testClient never sleeps, so a failing refresh costs the suite no real time.
func testClient(doer *fakeDoer) *httpclient.Client {
	return httpclient.New("hyperliquid", httpclient.Options{
		Doer:  doer,
		Sleep: func(context.Context, time.Duration) error { return nil },
	})
}

func TestCoreAdapterSendsNoDexAndConsultsNoCaches(t *testing.T) {
	doer := &fakeDoer{handle: func(string) (string, error) {
		return raw(t, "meta-and-asset-ctxs"), nil
	}}
	adapter := NewCoreAdapter(testClient(doer))

	batch, err := adapter.FetchSnapshots(context.Background(), at(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	// Exactly one request, with no dex field and no annotations or spotMeta: the core perps are
	// validator-listed crypto, and the quote is fixed rather than looked up.
	sent := doer.types()
	if len(sent) != 1 || sent[0] != "metaAndAssetCtxs" {
		t.Fatalf("requests: got %v, want [metaAndAssetCtxs]", sent)
	}
	doer.mu.Lock()
	_, hasDex := doer.bodies[0]["dex"]
	doer.mu.Unlock()
	if hasDex {
		t.Error("the core dex must send no dex field")
	}
	if len(batch.Snapshots) == 0 {
		t.Fatal("no snapshots")
	}
	eq(t, "quote", str(t, "quote", batch.Snapshots[0].Quote), "USDC")
}

func TestHip3AdapterPassesTheDexAndClassesFromAnnotations(t *testing.T) {
	doer := &fakeDoer{handle: func(kind string) (string, error) {
		switch kind {
		case "perpConciseAnnotations":
			return raw(t, "perp-concise-annotations"), nil
		case "spotMeta":
			return raw(t, "spot-meta"), nil
		default:
			return raw(t, "xyz-meta-and-asset-ctxs"), nil
		}
	}}
	adapter := NewHip3Adapter(testClient(doer), "xyz", NewAnnotationCache(), NewSpotTokenCache())

	batch, err := adapter.FetchSnapshots(context.Background(), at(NOW))
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	eq(t, "venueId", adapter.VenueID(), "hl-xyz")
	// The caches are consulted AFTER the main request, so a sweep that is failing anyway spends
	// nothing on them.
	want := []string{"metaAndAssetCtxs", "perpConciseAnnotations", "spotMeta"}
	got := doer.types()
	if len(got) != len(want) {
		t.Fatalf("requests: got %v, want %v", got, want)
	}
	for i := range want {
		eq(t, "request", got[i], want[i])
	}

	if len(batch.Snapshots) != 2 {
		t.Fatalf("snapshots: got %d, want 2", len(batch.Snapshots))
	}
	for _, s := range batch.Snapshots {
		eq(t, s.VenueSymbol+" venueId", s.VenueID, "hl-xyz")
		eq(t, s.VenueSymbol+" quote", str(t, "quote", s.Quote), "USDC")
	}
	eq(t, "XYZ100 class", string(batch.Snapshots[0].AssetClass), "index")
	eq(t, "AAPL class", string(batch.Snapshots[1].AssetClass), "equity")
}

func TestOneCacheRequestServesEveryCallerUntilDue(t *testing.T) {
	doer := &fakeDoer{handle: func(kind string) (string, error) {
		switch kind {
		case "perpConciseAnnotations":
			return raw(t, "perp-concise-annotations"), nil
		case "spotMeta":
			return raw(t, "spot-meta"), nil
		default:
			return raw(t, "xyz-meta-and-asset-ctxs"), nil
		}
	}}
	client := testClient(doer)
	annotations, spotTokens := NewAnnotationCache(), NewSpotTokenCache()
	ctx := context.Background()

	// Ten HIP-3 dexes sweeping together must not send ten identical requests against a shared
	// per-IP weight limit.
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = NewHip3Adapter(client, "xyz", annotations, spotTokens).FetchSnapshots(ctx, at(NOW))
		}()
	}
	wg.Wait()

	if got := doer.sent("perpConciseAnnotations"); got != 1 {
		t.Errorf("annotations requests: got %d, want 1 for ten concurrent dexes", got)
	}
	if got := doer.sent("spotMeta"); got != 1 {
		t.Errorf("spotMeta requests: got %d, want 1 for ten concurrent dexes", got)
	}

	// Still one just before the copy is due, two once it is.
	_ = annotations.Categories(ctx, client, at(NOW+annotationsMaxAge.Milliseconds()-1))
	if got := doer.sent("perpConciseAnnotations"); got != 1 {
		t.Errorf("inside the max age: got %d requests, want 1", got)
	}
	_ = annotations.Categories(ctx, client, at(NOW+annotationsMaxAge.Milliseconds()))
	if got := doer.sent("perpConciseAnnotations"); got != 2 {
		t.Errorf("once due: got %d requests, want 2", got)
	}
}

func TestAFailedOrEmptyRefreshKeepsTheLastGoodCopy(t *testing.T) {
	var mode struct {
		sync.Mutex
		fail  bool
		empty bool
	}
	doer := &fakeDoer{handle: func(kind string) (string, error) {
		if kind != "perpConciseAnnotations" {
			return raw(t, "xyz-meta-and-asset-ctxs"), nil
		}
		mode.Lock()
		defer mode.Unlock()
		switch {
		case mode.fail:
			return "", errors.New("HTTP 500")
		case mode.empty:
			return "[]", nil
		default:
			return `[["flx:BTC",{"category":"crypto"}]]`, nil
		}
	}}
	client := testClient(doer)
	cache := NewAnnotationCache()
	ctx := context.Background()

	if got := cache.Categories(ctx, client, at(NOW))["flx:BTC"]; got != "crypto" {
		t.Fatalf("first load: got %q, want crypto", got)
	}

	// A failure keeps the copy and retries sooner rather than emptying the map.
	mode.Lock()
	mode.fail = true
	mode.Unlock()
	due := NOW + annotationsMaxAge.Milliseconds()
	if got := cache.Categories(ctx, client, at(due))["flx:BTC"]; got != "crypto" {
		t.Errorf("after a failure: got %q, want the last good copy", got)
	}
	before := doer.sent("perpConciseAnnotations")
	_ = cache.Categories(ctx, client, at(due+annotationsRetry.Milliseconds()-1))
	if got := doer.sent("perpConciseAnnotations"); got != before {
		t.Errorf("inside the retry window: got %d new requests, want 0", got-before)
	}

	// An EMPTY list is a broken response, not a venue with nothing listed, so it is treated the
	// same way.
	mode.Lock()
	mode.fail, mode.empty = false, true
	mode.Unlock()
	if got := cache.Categories(ctx, client, at(due+annotationsRetry.Milliseconds()))["flx:BTC"]; got != "crypto" {
		t.Errorf("after an empty refresh: got %q, want the last good copy", got)
	}
}

func TestACacheFailureNeverFailsTheSweep(t *testing.T) {
	doer := &fakeDoer{handle: func(kind string) (string, error) {
		if kind == "perpConciseAnnotations" || kind == "spotMeta" {
			return "", errors.New("HTTP 500")
		}
		return raw(t, "xyz-meta-and-asset-ctxs"), nil
	}}
	adapter := NewHip3Adapter(testClient(doer), "xyz", NewAnnotationCache(), NewSpotTokenCache())

	batch, err := adapter.FetchSnapshots(context.Background(), at(NOW))
	if err != nil {
		t.Fatalf("a cache failure must not fail the sweep: %v", err)
	}

	// Nothing loaded, so the missing-annotation rule classes both markets and the quote is unknown
	// rather than guessed.
	if len(batch.Snapshots) != 2 {
		t.Fatalf("snapshots: got %d, want 2", len(batch.Snapshots))
	}
	eq(t, "XYZ100 class", string(batch.Snapshots[0].AssetClass), "index")
	eq(t, "AAPL class", string(batch.Snapshots[1].AssetClass), "equity")
	for _, s := range batch.Snapshots {
		if s.Quote != nil {
			t.Errorf("%s quote: got %q, want nil when spotMeta is unreachable", s.VenueSymbol, *s.Quote)
		}
	}
}

func TestFundingHistoryPagesByTheLastRowsTime(t *testing.T) {
	const hour = int64(3_600_000)
	start := int64(1_789_000_000_000) - (1_789_000_000_000 % hour)

	var full, short strings.Builder
	full.WriteByte('[')
	for i := 0; i < historyPageSize; i++ {
		if i > 0 {
			full.WriteByte(',')
		}
		// Stamped a few ms after the hour, as the venue sends them.
		full.WriteString(`{"coin":"BTC","fundingRate":"0.0000125","time":`)
		full.WriteString(strconv.FormatInt(start+int64(i)*hour+47, 10))
		full.WriteByte('}')
	}
	full.WriteByte(']')
	short.WriteString(`[{"coin":"BTC","fundingRate":"0.00001","time":`)
	short.WriteString(strconv.FormatInt(start+int64(historyPageSize)*hour+30, 10))
	short.WriteString(`}]`)

	first := true
	doer := &fakeDoer{handle: func(string) (string, error) {
		if first {
			first = false
			return full.String(), nil
		}
		return short.String(), nil
	}}
	adapter := NewCoreAdapter(testClient(doer))

	events, err := adapter.FetchFundingHistory(context.Background(), "BTC", start, start+600*hour)
	if err != nil {
		t.Fatalf("FetchFundingHistory: %v", err)
	}
	if len(events) != historyPageSize+1 {
		t.Fatalf("events: got %d, want %d", len(events), historyPageSize+1)
	}

	// The walk resumes from the last row's time plus one, not from a page index.
	doer.mu.Lock()
	second := doer.bodies[1]["startTime"]
	doer.mu.Unlock()
	wantResume := float64(start + int64(historyPageSize-1)*hour + 48)
	if second != wantResume {
		t.Errorf("second startTime: got %v, want %v", second, wantResume)
	}

	last := events[len(events)-1]
	eq(t, "last settledAt", last.SettledAt, start+int64(historyPageSize)*hour)
	eq(t, "last rate", last.Rate, 0.00001)
}
