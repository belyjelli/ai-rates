package collector

import (
	"context"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// cancelFetcher cancels the sweep's context on its first call and fails that call with the context's
// error, as an HTTP request interrupted by shutdown does.
type cancelFetcher struct {
	cancel context.CancelFunc
	calls  int
}

func (f *cancelFetcher) VenueID() string { return "bybit" }

func (f *cancelFetcher) FetchFundingHistory(ctx context.Context, _ string, _, _ int64) ([]core.FundingEvent, error) {
	f.calls++
	f.cancel()
	return nil, ctx.Err()
}

// cancelStore has two markets: one never settled (swept forward) and one with an old anchor
// (backfilled).
type cancelStore struct{ now time.Time }

func (s cancelStore) ActiveMarkets(context.Context, string, time.Time) ([]KnownMarket, error) {
	return []KnownMarket{{VenueSymbol: "AAAUSDT"}, {VenueSymbol: "BBBUSDT"}}, nil
}

func (s cancelStore) LatestSettledByMarket(context.Context, string) (map[string]int64, error) {
	return map[string]int64{}, nil
}

func (s cancelStore) OldestSettledByMarket(context.Context, string) (map[string]int64, error) {
	old := s.now.Add(-24 * time.Hour).UnixMilli()
	return map[string]int64{"AAAUSDT": old, "BBBUSDT": old}, nil
}

func (s cancelStore) RecordHistory(context.Context, string, []core.FundingEvent) error { return nil }

func TestShutdownMidSweepStopsWithoutCountingAnError(t *testing.T) {
	now := time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	var logged []string
	logf := func(message string) { logged = append(logged, message) }

	t.Run("forward sweep", func(t *testing.T) {
		logged = nil
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		fetcher := &cancelFetcher{cancel: cancel}
		result, err := SweepVenueHistory(ctx, fetcher, cancelStore{now}, HistorySweepOptions{Now: clock, Log: logf})
		if err != nil {
			t.Fatal(err)
		}
		if result.Errors != 0 || len(logged) != 0 || fetcher.calls != 1 {
			t.Fatalf("errors=%d logged=%q calls=%d; want a silent stop after the interrupted market", result.Errors, logged, fetcher.calls)
		}
	})

	t.Run("backfill", func(t *testing.T) {
		logged = nil
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		fetcher := &cancelFetcher{cancel: cancel}
		exhausted := map[string]bool{}
		result, err := BackfillVenueHistory(ctx, fetcher, cancelStore{now}, HistoryBackfillOptions{Now: clock, Exhausted: exhausted, Log: logf})
		if err != nil {
			t.Fatal(err)
		}
		if result.Errors != 0 || len(logged) != 0 || fetcher.calls != 1 || len(exhausted) != 0 {
			t.Fatalf("errors=%d logged=%q calls=%d exhausted=%v; want a silent stop that marks nothing exhausted",
				result.Errors, logged, fetcher.calls, exhausted)
		}
	})
}
