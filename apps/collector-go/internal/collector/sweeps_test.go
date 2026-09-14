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
