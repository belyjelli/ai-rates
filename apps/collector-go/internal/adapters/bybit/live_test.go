package bybit

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// TestLiveFetchSnapshots exercises the adapter against bybit's real public endpoints.
//
// Skipped unless BYBIT_LIVE=1, because a test that reaches the internet must never run in an
// ordinary `go test ./...` — it would make the suite fail on a plane, and it puts load on someone
// else's API on every commit.
//
// It exists because everything else in this package is pinned to recorded fixtures, which prove the
// PARSER is faithful and prove nothing about whether the endpoints still answer the shape we parse.
// Fixtures go stale silently; that is what the TypeScript side's nightly live smoke test is for.
//
// Read-only, unauthenticated, two requests. Note that bybit returns 403 to IPs in the US and
// mainland China, so a failure here may be geography rather than a defect — the error says which.
func TestLiveFetchSnapshots(t *testing.T) {
	if os.Getenv("BYBIT_LIVE") != "1" {
		t.Skip("set BYBIT_LIVE=1 to run the live endpoint check")
	}

	client := httpclient.New(VenueID, httpclient.Options{
		MinInterval: 100 * time.Millisecond,
		Timeout:     20 * time.Second,
	})
	adapter := NewAdapter(client)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	batch, err := adapter.FetchSnapshots(ctx, time.Now())
	if err != nil {
		t.Fatalf("FetchSnapshots: %v", err)
	}

	// bybit lists on the order of 800 linear perps. A handful would mean the instrument join
	// silently dropped nearly everything, which is the failure a count check catches and a
	// parse-without-error check does not.
	if len(batch.Snapshots) < 100 {
		t.Fatalf("got %d snapshots, want at least 100 — the instrument join looks broken", len(batch.Snapshots))
	}

	btc := snapshotBySymbol(batch.Snapshots, "BTCUSDT")
	if btc == nil {
		t.Fatal("BTCUSDT missing from a live bybit response")
	}
	if btc.Base != "BTC" {
		t.Errorf("BTCUSDT base: got %q, want BTC", btc.Base)
	}
	if btc.MarkPrice == nil || *btc.MarkPrice < 1000 {
		t.Errorf("BTCUSDT mark: got %v, want a plausible price", btc.MarkPrice)
	}
	if btc.BasisHours <= 0 {
		t.Errorf("BTCUSDT basisHours: got %v, want > 0", btc.BasisHours)
	}
	if btc.OpenInterestUSD == nil || *btc.OpenInterestUSD <= 0 {
		t.Errorf("BTCUSDT open interest: got %v, want > 0", btc.OpenInterestUSD)
	}

	// Sanity across the book rather than on one symbol: every market must carry the fields the
	// screener depends on, or a whole venue reads as empty downstream.
	var missingBasis, missingMark int
	for i := range batch.Snapshots {
		if batch.Snapshots[i].BasisHours <= 0 {
			missingBasis++
		}
		if batch.Snapshots[i].MarkPrice == nil {
			missingMark++
		}
	}
	if missingBasis > 0 {
		t.Errorf("%d of %d live markets have no basis hours", missingBasis, len(batch.Snapshots))
	}
	if missingMark > 0 {
		t.Errorf("%d of %d live markets have no mark price", missingMark, len(batch.Snapshots))
	}

	t.Logf("live: %d markets, BTCUSDT mark %.2f, basis %.1fh, requests %d",
		len(batch.Snapshots), *btc.MarkPrice, btc.BasisHours, adapter.RequestCount())
}
