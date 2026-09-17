package collector

// Ported case for case from apps/collector/src/history.test.ts and tiers.test.ts. The TypeScript
// side has no liquidation sweep test; the liquidation cases here mirror the tier ones.

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const sweepHour = int64(3_600_000)

var sweepNow = time.UnixMilli(1_000 * sweepHour)

func sweepEvent(symbol string, settledAt int64) core.FundingEvent {
	quote := "USDT"
	return core.FundingEvent{
		MarketRef: core.MarketRef{
			VenueID: "demo", VenueSymbol: symbol, Base: symbol, Quote: &quote,
			Multiplier: 1, AssetClass: core.ClassCrypto,
		},
		SettledAt:  settledAt,
		Rate:       0.0001,
		BasisHours: 8,
	}
}

func hours(h float64) *float64 { return &h }

type historyCall struct {
	symbol   string
	from, to int64
}

type fakeHistoryFetcher struct {
	fetch func(ctx context.Context, symbol string, from, to int64) ([]core.FundingEvent, error)
}

func (f *fakeHistoryFetcher) VenueID() string { return "demo" }

func (f *fakeHistoryFetcher) FetchFundingHistory(ctx context.Context, symbol string, from, to int64) ([]core.FundingEvent, error) {
	return f.fetch(ctx, symbol, from, to)
}

type fakeHistoryStore struct {
	markets  []KnownMarket
	latest   map[string]int64
	oldest   map[string]int64
	recorded [][]core.FundingEvent
}

func (s *fakeHistoryStore) ActiveMarkets(context.Context, string, time.Time) ([]KnownMarket, error) {
	return s.markets, nil
}

func (s *fakeHistoryStore) LatestSettledByMarket(context.Context, string) (map[string]int64, error) {
	return s.latest, nil
}

func (s *fakeHistoryStore) OldestSettledByMarket(context.Context, string) (map[string]int64, error) {
	return s.oldest, nil
}

func (s *fakeHistoryStore) RecordHistory(_ context.Context, _ string, events []core.FundingEvent) error {
	s.recorded = append(s.recorded, append([]core.FundingEvent(nil), events...))
	return nil
}

func fixedNow() time.Time { return sweepNow }

func TestSweepFetchesOnlyDueMarketsResumingAfterTheLastStored(t *testing.T) {
	var calls []historyCall
	fetcher := &fakeHistoryFetcher{fetch: func(_ context.Context, symbol string, from, to int64) ([]core.FundingEvent, error) {
		calls = append(calls, historyCall{symbol, from, to})
		return []core.FundingEvent{sweepEvent(symbol, to-sweepHour)}, nil
	}}
	now := sweepNow.UnixMilli()
	store := &fakeHistoryStore{
		markets: []KnownMarket{
			{VenueSymbol: "NEW", IntervalHours: hours(8)},   // never stored: initial lookback
			{VenueSymbol: "DUE", IntervalHours: hours(8)},   // last settlement 9h ago: due
			{VenueSymbol: "FRESH", IntervalHours: hours(8)}, // last settlement 2h ago: not due
			{VenueSymbol: "HOURLY"},                         // unknown interval treated as hourly
		},
		latest: map[string]int64{"DUE": now - 9*sweepHour, "FRESH": now - 2*sweepHour, "HOURLY": now - 2*sweepHour},
	}

	result, err := SweepVenueHistory(context.Background(), fetcher, store, HistorySweepOptions{
		Now: fixedNow, InitialLookback: 24 * time.Hour,
	})
	if err != nil {
		t.Fatal(err)
	}

	want := []historyCall{
		{"NEW", now - 24*sweepHour, now},
		{"DUE", now - 9*sweepHour + 1, now},
		{"HOURLY", now - 2*sweepHour + 1, now},
	}
	if !reflect.DeepEqual(calls, want) {
		t.Errorf("calls = %v, want %v", calls, want)
	}
	if result != (HistorySweepResult{Markets: 4, Fetched: 3, Events: 3, Errors: 0}) {
		t.Errorf("result = %+v", result)
	}
	if len(store.recorded) != 3 {
		t.Errorf("recorded %d batches, want 3", len(store.recorded))
	}
}

func TestSweepCountsFailuresAndKeepsGoing(t *testing.T) {
	fetcher := &fakeHistoryFetcher{fetch: func(_ context.Context, symbol string, _, _ int64) ([]core.FundingEvent, error) {
		if symbol == "BAD" {
			return nil, errors.New("HTTP 400")
		}
		return nil, nil
	}}
	var logs []string
	store := &fakeHistoryStore{markets: []KnownMarket{
		{VenueSymbol: "BAD", IntervalHours: hours(1)},
		{VenueSymbol: "OK", IntervalHours: hours(1)},
	}}

	result, err := SweepVenueHistory(context.Background(), fetcher, store, HistorySweepOptions{
		Now: fixedNow, Log: func(m string) { logs = append(logs, m) },
	})
	if err != nil {
		t.Fatal(err)
	}
	if result != (HistorySweepResult{Markets: 2, Fetched: 1, Events: 0, Errors: 1}) {
		t.Errorf("result = %+v", result)
	}
	if !reflect.DeepEqual(logs, []string{"demo BAD: history failed: HTTP 400"}) {
		t.Errorf("logs = %q", logs)
	}
}

func TestSweepStopsWhenTheVenuesCircuitIsOpen(t *testing.T) {
	calls := 0
	fetcher := &fakeHistoryFetcher{fetch: func(context.Context, string, int64, int64) ([]core.FundingEvent, error) {
		calls++
		return nil, nil
	}}
	store := &fakeHistoryStore{markets: []KnownMarket{{VenueSymbol: "A", IntervalHours: hours(1)}}}

	if _, err := SweepVenueHistory(context.Background(), fetcher, store, HistorySweepOptions{
		Now: fixedNow, CircuitOpen: func() bool { return true },
	}); err != nil {
		t.Fatal(err)
	}
	if calls != 0 {
		t.Errorf("calls = %d, want 0", calls)
	}
}

func TestSweepEndsEarlyWhenCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	calls := 0
	fetcher := &fakeHistoryFetcher{fetch: func(context.Context, string, int64, int64) ([]core.FundingEvent, error) {
		calls++
		cancel()
		return nil, nil
	}}
	store := &fakeHistoryStore{markets: []KnownMarket{
		{VenueSymbol: "A", IntervalHours: hours(1)},
		{VenueSymbol: "B", IntervalHours: hours(1)},
	}}

	result, err := SweepVenueHistory(ctx, fetcher, store, HistorySweepOptions{Now: fixedNow})
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 || result.Fetched != 1 {
		t.Errorf("calls = %d, fetched = %d, want 1 and 1", calls, result.Fetched)
	}
}

func TestBackfillReachesBackFromTheOldestStoredSettlementWithinBudget(t *testing.T) {
	var calls []historyCall
	fetcher := &fakeHistoryFetcher{fetch: func(_ context.Context, symbol string, from, to int64) ([]core.FundingEvent, error) {
		calls = append(calls, historyCall{symbol, from, to})
		if symbol == "EMPTY" {
			return nil, nil
		}
		return []core.FundingEvent{sweepEvent(symbol, to)}, nil
	}}
	now := sweepNow.UnixMilli()
	store := &fakeHistoryStore{
		markets: []KnownMarket{
			{VenueSymbol: "DEEP", IntervalHours: hours(8)},   // stored back to 100h: still far from target
			{VenueSymbol: "DONE", IntervalHours: hours(8)},   // already at the target
			{VenueSymbol: "EMPTY", IntervalHours: hours(8)},  // venue has nothing older
			{VenueSymbol: "UNSEEN", IntervalHours: hours(8)}, // nothing stored: the forward sweep anchors it
		},
		oldest: map[string]int64{"DEEP": now - 100*sweepHour, "DONE": now - 199*sweepHour, "EMPTY": now - 100*sweepHour},
	}
	exhausted := map[string]bool{}
	budget := 10
	opts := HistoryBackfillOptions{Now: fixedNow, TargetLookback: 200 * time.Hour, Budget: &budget, Exhausted: exhausted}

	first, err := BackfillVenueHistory(context.Background(), fetcher, store, opts)
	if err != nil {
		t.Fatal(err)
	}

	// DONE is within one interval of the target, and UNSEEN has no anchor to reach back from.
	want := []historyCall{
		{"DEEP", now - 200*sweepHour, now - 100*sweepHour - 1},
		{"EMPTY", now - 200*sweepHour, now - 100*sweepHour - 1},
	}
	if !reflect.DeepEqual(calls, want) {
		t.Errorf("calls = %v, want %v", calls, want)
	}
	if first.Fetched != 2 || first.Events != 1 || first.Errors != 0 || first.Exhausted != 1 {
		t.Errorf("first = %+v", first)
	}
	if len(store.recorded) != 1 {
		t.Errorf("recorded %d batches, want 1", len(store.recorded))
	}

	// A market with nothing older is not asked again.
	calls = nil
	if _, err := BackfillVenueHistory(context.Background(), fetcher, store, opts); err != nil {
		t.Fatal(err)
	}
	if len(calls) != 1 || calls[0].symbol != "DEEP" {
		t.Errorf("second pass calls = %v, want only DEEP", calls)
	}
}

func TestBackfillSpendsOnlyItsBudgetPerPass(t *testing.T) {
	var calls []string
	fetcher := &fakeHistoryFetcher{fetch: func(_ context.Context, symbol string, _, to int64) ([]core.FundingEvent, error) {
		calls = append(calls, symbol)
		return []core.FundingEvent{sweepEvent(symbol, to)}, nil
	}}
	now := sweepNow.UnixMilli()
	store := &fakeHistoryStore{oldest: map[string]int64{}}
	for _, symbol := range []string{"A", "B", "C", "D"} {
		store.markets = append(store.markets, KnownMarket{VenueSymbol: symbol, IntervalHours: hours(8)})
		store.oldest[symbol] = now - 10*sweepHour
	}
	budget := 2

	result, err := BackfillVenueHistory(context.Background(), fetcher, store, HistoryBackfillOptions{
		Now: fixedNow, TargetLookback: 200 * time.Hour, Budget: &budget,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(calls, []string{"A", "B"}) {
		t.Errorf("calls = %v, want [A B]", calls)
	}
	if result.Pending != 2 { // four short of the target, two filled this pass
		t.Errorf("pending = %d, want 2", result.Pending)
	}
}

func TestHistorySweepsDoNothingWithoutAHistoryEndpoint(t *testing.T) {
	store := &fakeHistoryStore{markets: []KnownMarket{{VenueSymbol: "A", IntervalHours: hours(1)}}}
	result, err := SweepVenueHistory(context.Background(), nil, store, HistorySweepOptions{})
	if err != nil || result != (HistorySweepResult{}) {
		t.Errorf("sweep = %+v, %v; want zero result", result, err)
	}
	backfill, err := BackfillVenueHistory(context.Background(), nil, store, HistoryBackfillOptions{})
	if err != nil || backfill != (HistoryBackfillResult{}) {
		t.Errorf("backfill = %+v, %v; want zero result", backfill, err)
	}
}

func sweepTier(symbol string, index int) core.LeverageTier {
	upper, mmr := 10_000.0, 0.01
	return core.LeverageTier{
		VenueID: "bybit", VenueSymbol: symbol, Tier: index, LowerNotionalUSD: 0,
		UpperNotionalUSD: &upper, IMR: 0.02, MMR: &mmr, MaxLeverage: 50,
	}
}

type fakeTierFetcher struct {
	tiers    []core.LeverageTier
	complete bool
}

func (f *fakeTierFetcher) VenueID() string { return "bybit" }

func (f *fakeTierFetcher) FetchLeverageTiers(context.Context) ([]core.LeverageTier, bool, error) {
	return f.tiers, f.complete, nil
}

type tierWrite struct {
	venueID string
	tiers   int
	prune   bool
}

type fakeTierStore struct{ calls []tierWrite }

func (s *fakeTierStore) ReplaceLeverageTiers(_ context.Context, venueID string, tiers []core.LeverageTier, _ time.Time, prune bool) (int, error) {
	s.calls = append(s.calls, tierWrite{venueID, len(tiers), prune})
	return len(tiers), nil
}

func TestTierSweepStoresACompleteSweepAndReportsItsMarkets(t *testing.T) {
	store := &fakeTierStore{}
	sweep, err := RefreshVenueLeverageTiers(context.Background(), &fakeTierFetcher{
		tiers:    []core.LeverageTier{sweepTier("BTCUSDT", 1), sweepTier("BTCUSDT", 2), sweepTier("ETHUSDT", 1)},
		complete: true,
	}, store, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	// Three tiers, but two markets: the count the log line reports is distinct symbols.
	if sweep != (LeverageTierSweep{Markets: 2, Tiers: 3, Complete: true}) {
		t.Errorf("sweep = %+v", sweep)
	}
	if !reflect.DeepEqual(store.calls, []tierWrite{{"bybit", 3, true}}) {
		t.Errorf("calls = %+v", store.calls)
	}
}

func TestTierSweepPartialIsStoredButNeverPrunes(t *testing.T) {
	store := &fakeTierStore{}
	sweep, err := RefreshVenueLeverageTiers(context.Background(), &fakeTierFetcher{
		tiers: []core.LeverageTier{sweepTier("BTCUSDT", 1)}, complete: false,
	}, store, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	// The markets a rate-limited batch never reached still hold ladders. Pruning on their absence
	// would turn one failed request into deleted data.
	if sweep != (LeverageTierSweep{Markets: 1, Tiers: 1, Complete: false}) {
		t.Errorf("sweep = %+v", sweep)
	}
	if len(store.calls) != 1 || store.calls[0].prune {
		t.Errorf("calls = %+v, want one non-pruning write", store.calls)
	}
}

func TestTierSweepSkipsAVenueWithoutALadder(t *testing.T) {
	store := &fakeTierStore{}
	sweep, err := RefreshVenueLeverageTiers(context.Background(), nil, store, fixedNow)
	if err != nil || sweep != (LeverageTierSweep{Complete: true}) || len(store.calls) != 0 {
		t.Errorf("sweep = %+v, err = %v, calls = %+v", sweep, err, store.calls)
	}
}

func TestTierSweepEmptyNeverReachesTheStore(t *testing.T) {
	store := &fakeTierStore{}
	sweep, err := RefreshVenueLeverageTiers(context.Background(), &fakeTierFetcher{complete: true}, store, fixedNow)
	if err != nil || sweep != (LeverageTierSweep{Complete: true}) || len(store.calls) != 0 {
		t.Errorf("sweep = %+v, err = %v, calls = %+v", sweep, err, store.calls)
	}
}

func TestTierSweepPassesTheSweepTimeToTheStore(t *testing.T) {
	var got time.Time
	store := tierStoreFunc(func(_ context.Context, _ string, _ []core.LeverageTier, fetchedAt time.Time, _ bool) (int, error) {
		got = fetchedAt
		return 0, nil
	})
	if _, err := RefreshVenueLeverageTiers(context.Background(), &fakeTierFetcher{
		tiers: []core.LeverageTier{sweepTier("BTCUSDT", 1)}, complete: true,
	}, store, fixedNow); err != nil {
		t.Fatal(err)
	}
	if !got.Equal(sweepNow) {
		t.Errorf("fetchedAt = %v, want %v", got, sweepNow)
	}
}

type tierStoreFunc func(ctx context.Context, venueID string, tiers []core.LeverageTier, fetchedAt time.Time, prune bool) (int, error)

func (f tierStoreFunc) ReplaceLeverageTiers(ctx context.Context, venueID string, tiers []core.LeverageTier, fetchedAt time.Time, prune bool) (int, error) {
	return f(ctx, venueID, tiers, fetchedAt, prune)
}

func sweepLiquidation(symbol string, at int64) core.Liquidation {
	return core.Liquidation{
		MarketRef:    core.MarketRef{VenueID: "gate", VenueSymbol: symbol, Base: symbol, Multiplier: 1, AssetClass: core.ClassCrypto},
		LiquidatedAt: at, Side: "long", SizeContracts: 3, FillPrice: 100,
	}
}

type fakeLiquidationFetcher struct {
	liquidations []core.Liquidation
	complete     bool
	err          error
}

func (f *fakeLiquidationFetcher) VenueID() string { return "gate" }

func (f *fakeLiquidationFetcher) FetchLiquidations(context.Context) ([]core.Liquidation, bool, error) {
	return f.liquidations, f.complete, f.err
}

type fakeLiquidationStore struct {
	calls  int
	stored int
}

func (s *fakeLiquidationStore) RecordLiquidations(_ context.Context, _ string, _ []core.Liquidation) (int, error) {
	s.calls++
	return s.stored, nil
}

func TestLiquidationSweepReportsFetchedStoredAndMarkets(t *testing.T) {
	// Stored below fetched is the steady state: most of each page repeats and the key absorbs it.
	store := &fakeLiquidationStore{stored: 1}
	sweep, err := RefreshVenueLiquidations(context.Background(), &fakeLiquidationFetcher{
		liquidations: []core.Liquidation{sweepLiquidation("BTC_USDT", 1), sweepLiquidation("BTC_USDT", 2), sweepLiquidation("ETH_USDT", 1)},
		complete:     false,
	}, store)
	if err != nil {
		t.Fatal(err)
	}
	if sweep != (LiquidationSweep{Fetched: 3, Stored: 1, Markets: 2, Complete: false}) {
		t.Errorf("sweep = %+v", sweep)
	}
	if store.calls != 1 {
		t.Errorf("store calls = %d, want 1", store.calls)
	}
}

func TestLiquidationSweepSkipsEmptyAndMissingEndpoints(t *testing.T) {
	store := &fakeLiquidationStore{}
	sweep, err := RefreshVenueLiquidations(context.Background(), nil, store)
	if err != nil || sweep != (LiquidationSweep{Complete: true}) {
		t.Errorf("nil fetcher: sweep = %+v, err = %v", sweep, err)
	}
	sweep, err = RefreshVenueLiquidations(context.Background(), &fakeLiquidationFetcher{complete: true}, store)
	if err != nil || sweep != (LiquidationSweep{Complete: true}) {
		t.Errorf("empty page: sweep = %+v, err = %v", sweep, err)
	}
	if store.calls != 0 {
		t.Errorf("store calls = %d, want 0", store.calls)
	}
}

func TestLiquidationSweepReturnsAFetchError(t *testing.T) {
	store := &fakeLiquidationStore{}
	_, err := RefreshVenueLiquidations(context.Background(), &fakeLiquidationFetcher{err: errors.New("HTTP 503")}, store)
	if err == nil || store.calls != 0 {
		t.Errorf("err = %v, store calls = %d; want the error and no write", err, store.calls)
	}
}

const sweepBucket = int64(300_000)

type takerFlowCall struct {
	symbol   string
	from, to int64
}

type fakeTakerFlowFetcher struct {
	calls []takerFlowCall
	fetch func(ctx context.Context, symbol string, from, to int64) ([]core.TakerFlow, error)
}

func (f *fakeTakerFlowFetcher) VenueID() string { return "okx" }

func (f *fakeTakerFlowFetcher) FetchTakerFlow(ctx context.Context, symbol string, from, to int64) ([]core.TakerFlow, error) {
	f.calls = append(f.calls, takerFlowCall{symbol, from, to})
	return f.fetch(ctx, symbol, from, to)
}

type fakeTakerFlowStore struct {
	subjects []string
	latest   map[string]int64
	recorded [][]core.TakerFlow
}

func (s *fakeTakerFlowStore) TakerFlowSubjects(context.Context, string) ([]string, error) {
	return s.subjects, nil
}

func (s *fakeTakerFlowStore) LatestTakerFlowByMarket(context.Context, string) (map[string]int64, error) {
	return s.latest, nil
}

func (s *fakeTakerFlowStore) RecordTakerFlow(_ context.Context, _ string, flows []core.TakerFlow) (int, error) {
	s.recorded = append(s.recorded, append([]core.TakerFlow(nil), flows...))
	return len(flows), nil
}

func sweepFlow(symbol string, bucket int64) core.TakerFlow {
	return core.TakerFlow{VenueID: "okx", VenueSymbol: symbol, BucketStart: bucket, BuyUSD: 2, SellUSD: 1}
}

// sweepNow is exactly on an hour, so a moment 90 seconds past a bucket boundary is built explicitly.
var takerNow = sweepNow.Add(90 * time.Second)

func TestTakerFlowSweepRereadsTheNewestBucketsAndBackfillsNewMarkets(t *testing.T) {
	now := takerNow.UnixMilli()
	current := now - 90_000 // the bucket in progress
	fetcher := &fakeTakerFlowFetcher{fetch: func(_ context.Context, symbol string, from, _ int64) ([]core.TakerFlow, error) {
		return []core.TakerFlow{sweepFlow(symbol, from), sweepFlow(symbol, current)}, nil
	}}
	store := &fakeTakerFlowStore{
		subjects: []string{"BTC-USDT-SWAP", "NEW-USDT-SWAP", "STALE-USDT-SWAP"},
		latest: map[string]int64{
			"BTC-USDT-SWAP": current, // stored up to the bucket still filling
			// A stored value off the grid still resumes on it.
			"STALE-USDT-SWAP": current - 12*sweepBucket + 7,
		},
	}

	result, err := SweepVenueTakerFlow(context.Background(), fetcher, store, TakerFlowSweepOptions{
		Now: func() time.Time { return takerNow }, Lookback: 24 * time.Hour,
	})
	if err != nil {
		t.Fatal(err)
	}

	want := []takerFlowCall{
		// Two buckets behind the newest stored: the one still filling is overwritten with its final
		// figure, and a late publisher's rewrite of the bucket before it is picked up.
		{"BTC-USDT-SWAP", current - 2*sweepBucket, now},
		// Nothing stored: the whole lookback, from a bucket boundary.
		{"NEW-USDT-SWAP", current - 24*12*sweepBucket, now},
		{"STALE-USDT-SWAP", current - 14*sweepBucket, now},
	}
	if !reflect.DeepEqual(fetcher.calls, want) {
		t.Errorf("calls = %v\nwant    %v", fetcher.calls, want)
	}
	if result != (TakerFlowSweep{Markets: 3, Fetched: 3, Backfilled: 1, Buckets: 6}) {
		t.Errorf("result = %+v", result)
	}
	if len(store.recorded) != 3 {
		t.Errorf("recorded %d batches, want 3", len(store.recorded))
	}
}

func TestTakerFlowSweepCountsFailuresAndDeclinedMarkets(t *testing.T) {
	fetcher := &fakeTakerFlowFetcher{fetch: func(_ context.Context, symbol string, _, _ int64) ([]core.TakerFlow, error) {
		switch symbol {
		case "BAD-USDT-SWAP":
			return nil, errors.New("HTTP 400")
		case "BTC-USDC-SWAP":
			return nil, nil // declined by the adapter: no rubik data for USDC swaps
		}
		return []core.TakerFlow{sweepFlow(symbol, 0)}, nil
	}}
	var logs []string
	store := &fakeTakerFlowStore{subjects: []string{"BAD-USDT-SWAP", "BTC-USDC-SWAP", "OK-USDT-SWAP"}}

	result, err := SweepVenueTakerFlow(context.Background(), fetcher, store, TakerFlowSweepOptions{
		Now: func() time.Time { return takerNow }, Log: func(m string) { logs = append(logs, m) },
	})
	if err != nil {
		t.Fatal(err)
	}
	// The declined USDC market is fetched-and-empty, not an error and not a backfill, and never
	// reaches the store.
	if result != (TakerFlowSweep{Markets: 3, Fetched: 2, Backfilled: 1, Buckets: 1, Errors: 1}) {
		t.Errorf("result = %+v", result)
	}
	if !reflect.DeepEqual(logs, []string{"okx BAD-USDT-SWAP: taker flow failed: HTTP 400"}) {
		t.Errorf("logs = %q", logs)
	}
	if len(store.recorded) != 1 {
		t.Errorf("recorded %d batches, want 1", len(store.recorded))
	}
}

func TestTakerFlowSweepDefaultsToASevenDayBackfill(t *testing.T) {
	fetcher := &fakeTakerFlowFetcher{fetch: func(context.Context, string, int64, int64) ([]core.TakerFlow, error) {
		return nil, nil
	}}
	store := &fakeTakerFlowStore{subjects: []string{"BTCUSDT"}}
	if _, err := SweepVenueTakerFlow(context.Background(), fetcher, store, TakerFlowSweepOptions{
		Now: func() time.Time { return takerNow },
	}); err != nil {
		t.Fatal(err)
	}
	now := takerNow.UnixMilli()
	if len(fetcher.calls) != 1 || fetcher.calls[0].from != now-90_000-7*24*12*sweepBucket {
		t.Errorf("calls = %v, want one from exactly 7 days of buckets back", fetcher.calls)
	}
}

func TestTakerFlowSweepStopsOnAnOpenCircuitOrCancellation(t *testing.T) {
	fetcher := &fakeTakerFlowFetcher{fetch: func(context.Context, string, int64, int64) ([]core.TakerFlow, error) {
		return nil, nil
	}}
	store := &fakeTakerFlowStore{subjects: []string{"A", "B"}}
	if _, err := SweepVenueTakerFlow(context.Background(), fetcher, store, TakerFlowSweepOptions{
		Now: fixedNow, CircuitOpen: func() bool { return true },
	}); err != nil {
		t.Fatal(err)
	}
	if len(fetcher.calls) != 0 {
		t.Errorf("open circuit: calls = %v, want none", fetcher.calls)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var logs []string
	cancelling := &fakeTakerFlowFetcher{fetch: func(context.Context, string, int64, int64) ([]core.TakerFlow, error) {
		cancel()
		return nil, context.Canceled
	}}
	result, err := SweepVenueTakerFlow(ctx, cancelling, store, TakerFlowSweepOptions{
		Now: fixedNow, Log: func(m string) { logs = append(logs, m) },
	})
	if err != nil {
		t.Fatal(err)
	}
	// Shutdown mid-request is not a venue fault: no error counted, nothing logged, no second market.
	if len(cancelling.calls) != 1 || result.Errors != 0 || len(logs) != 0 {
		t.Errorf("cancelled: calls = %v, result = %+v, logs = %q", cancelling.calls, result, logs)
	}
}

func TestTakerFlowSweepDoesNothingWithoutAnEndpoint(t *testing.T) {
	store := &fakeTakerFlowStore{subjects: []string{"A"}}
	result, err := SweepVenueTakerFlow(context.Background(), nil, store, TakerFlowSweepOptions{})
	if err != nil || result != (TakerFlowSweep{}) {
		t.Errorf("sweep = %+v, %v; want zero result", result, err)
	}
}
