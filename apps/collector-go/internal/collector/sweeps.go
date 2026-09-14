package collector

// The per-venue side loops: settled funding history (forward sweep and backfill), risk-limit
// ladders, and forced closes.
//
// Ported from apps/collector/src/{history,tiers,liquidations}.ts. The arithmetic is deliberately
// identical — which markets are due, where a request's window starts, what counts as exhausted,
// when a ladder may be pruned — because the stored history every backtest reads is the product of
// exactly these rules, and a port that drifted would change the numbers without failing anything.
//
// These are plain functions, not loops. The caller schedules them: the forward sweep and the
// backfill each run inside one PeriodicTask per venue, the tier and liquidation sweeps likewise.

import (
	"context"
	"fmt"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	hourMs = int64(time.Hour / time.Millisecond)

	// DefaultHistoryLookback is how far back the forward sweep reaches for a market with nothing
	// stored yet.
	DefaultHistoryLookback = 7 * 24 * time.Hour
	// DefaultSettleGrace is how long past an expected settlement the sweep waits before asking.
	DefaultSettleGrace = 5 * time.Minute
	// DefaultBackfillLookback is how far back the backfill eventually reaches.
	DefaultBackfillLookback = 90 * 24 * time.Hour
	// DefaultBackfillBudget is markets per backfill pass, so filling the past never crowds out the
	// present.
	DefaultBackfillBudget = 20

	// activeMarketsWindow bounds which markets count as listed: seen by the snapshot loop recently.
	activeMarketsWindow = 2 * time.Hour
)

// HistoryFetcher is an adapter with a funding-history endpoint. Every adapter pages within a
// [from, to] window in epoch milliseconds, which is what lets the backfill ask for the span between
// the target and the oldest settlement already stored.
type HistoryFetcher interface {
	VenueID() string
	FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error)
}

// TierFetcher is an adapter that publishes a risk-limit ladder. The bool reports whether the whole
// venue was swept.
type TierFetcher interface {
	VenueID() string
	FetchLeverageTiers(ctx context.Context) ([]core.LeverageTier, bool, error)
}

// LiquidationFetcher is an adapter that publishes forced closes. The bool reports whether the whole
// venue was swept.
type LiquidationFetcher interface {
	VenueID() string
	FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error)
}

// HistoryStore is the slice of the store the history sweeps need.
type HistoryStore interface {
	// ActiveMarkets is the markets seen by the snapshot loop since `since`.
	ActiveMarkets(ctx context.Context, venueID string, since time.Time) ([]KnownMarket, error)
	// LatestSettledByMarket is the newest stored settlement per market, epoch ms, recent window only.
	LatestSettledByMarket(ctx context.Context, venueID string) (map[string]int64, error)
	// OldestSettledByMarket is the oldest stored settlement per market, the anchor the backfill
	// reaches back from.
	OldestSettledByMarket(ctx context.Context, venueID string) (map[string]int64, error)
	RecordHistory(ctx context.Context, venueID string, events []core.FundingEvent) error
}

// TierStore is the slice of the store the tier sweep needs.
type TierStore interface {
	ReplaceLeverageTiers(ctx context.Context, venueID string, tiers []core.LeverageTier, fetchedAt time.Time, prune bool) (int, error)
}

// LiquidationStore is the slice of the store the liquidation sweep needs.
type LiquidationStore interface {
	RecordLiquidations(ctx context.Context, venueID string, liquidations []core.Liquidation) (int, error)
}

// HistorySweepOptions configures SweepVenueHistory. Zero durations take their defaults.
//
// There is no stop flag: cancel ctx. It is checked before each market, so a long sweep ends early
// on shutdown after finishing the market it is on.
type HistorySweepOptions struct {
	Now func() time.Time
	// InitialLookback is how far back to fetch for a market with no stored settlements.
	InitialLookback time.Duration
	// SettleGrace is how long past an expected settlement to wait before asking for it.
	SettleGrace time.Duration
	// CircuitOpen reports the venue's circuit breaker, typically func() bool { return client.Circuit().Open }.
	CircuitOpen func() bool
	Log         func(string)
}

// HistorySweepResult is one forward sweep's outcome.
type HistorySweepResult struct {
	Markets int
	Fetched int
	Events  int
	Errors  int
}

// SweepVenueHistory pulls settled funding for every active market that is due a new settlement.
// Requests go through the venue's shared HTTP client, so its spacing and circuit breaker also cover
// the snapshot loop.
//
// A nil fetcher — a venue without a history endpoint — does nothing. A failed store read is
// returned; a failed market is counted, logged and skipped.
func SweepVenueHistory(ctx context.Context, fetcher HistoryFetcher, store HistoryStore, opts HistorySweepOptions) (HistorySweepResult, error) {
	var result HistorySweepResult
	if fetcher == nil {
		return result, nil
	}

	now := nowOrDefault(opts.Now)
	lookbackMs := durationMs(opts.InitialLookback, DefaultHistoryLookback)
	graceMs := durationMs(opts.SettleGrace, DefaultSettleGrace)
	venueID := fetcher.VenueID()

	markets, err := store.ActiveMarkets(ctx, venueID, now().Add(-activeMarketsWindow))
	if err != nil {
		return result, err
	}
	latest, err := store.LatestSettledByMarket(ctx, venueID)
	if err != nil {
		return result, err
	}
	result.Markets = len(markets)

	for _, market := range markets {
		if ctx.Err() != nil || circuitOpen(opts.CircuitOpen) {
			break
		}
		last, stored := latest[market.VenueSymbol]
		at := now().UnixMilli()
		if stored && float64(at-last) < intervalMs(market.IntervalHours)+float64(graceMs) {
			continue
		}

		from := at - lookbackMs
		if stored {
			from = last + 1
		}
		events, err := fetcher.FetchFundingHistory(ctx, market.VenueSymbol, from, at)
		if err == nil {
			result.Fetched++
			if len(events) > 0 {
				err = store.RecordHistory(ctx, venueID, events)
				if err == nil {
					result.Events += len(events)
				}
			}
		}
		if err != nil {
			result.Errors++
			logf(opts.Log, "%s %s: history failed: %s", venueID, market.VenueSymbol, DescribeError(err))
		}
	}
	return result, nil
}

// HistoryBackfillOptions configures BackfillVenueHistory. A zero TargetLookback takes its default;
// a nil Budget takes DefaultBackfillBudget, and an explicit 0 fetches nothing.
type HistoryBackfillOptions struct {
	Now func() time.Time
	// TargetLookback is how far back history should eventually reach.
	TargetLookback time.Duration
	// Budget is markets per pass.
	Budget *int
	// Exhausted holds markets already known to have nothing older, so they are not asked again. It
	// is mutated as they are discovered and should persist across passes: process lifetime is the
	// right scope for "this venue has no more". Not safe for concurrent use — the backfill for a
	// venue runs inside a single PeriodicTask, so one goroutine owns it. Nil means a fresh set for
	// this pass only.
	Exhausted   map[string]bool
	CircuitOpen func() bool
	Log         func(string)
}

// HistoryBackfillResult is one backfill pass's outcome.
type HistoryBackfillResult struct {
	// Pending is markets still short of the target after this pass.
	Pending   int
	Fetched   int
	Events    int
	Errors    int
	Exhausted int
}

// BackfillVenueHistory extends stored history backwards, a slice of markets at a time.
//
// The forward sweep only ever resumes from the newest stored settlement, so history starts where
// collection started and never deepens. Each pass asks the venue for the span between the target
// and the oldest settlement already stored. A market with nothing stored yet is left to the forward
// sweep, which anchors it first. A market that returns nothing older has reached the venue's limit
// and is remembered, so the next pass spends its budget elsewhere.
func BackfillVenueHistory(ctx context.Context, fetcher HistoryFetcher, store HistoryStore, opts HistoryBackfillOptions) (HistoryBackfillResult, error) {
	var result HistoryBackfillResult
	if fetcher == nil {
		return result, nil
	}

	now := nowOrDefault(opts.Now)
	target := now().UnixMilli() - durationMs(opts.TargetLookback, DefaultBackfillLookback)
	budget := DefaultBackfillBudget
	if opts.Budget != nil {
		budget = max(0, *opts.Budget)
	}
	exhausted := opts.Exhausted
	if exhausted == nil {
		exhausted = map[string]bool{}
	}
	venueID := fetcher.VenueID()

	markets, err := store.ActiveMarkets(ctx, venueID, now().Add(-activeMarketsWindow))
	if err != nil {
		return result, err
	}
	oldest, err := store.OldestSettledByMarket(ctx, venueID)
	if err != nil {
		return result, err
	}

	pending := make([]KnownMarket, 0, len(markets))
	for _, market := range markets {
		if exhausted[market.VenueSymbol] {
			continue
		}
		anchor, stored := oldest[market.VenueSymbol]
		if !stored {
			continue
		}
		if float64(anchor-target) > intervalMs(market.IntervalHours) {
			pending = append(pending, market)
		}
	}
	result.Pending = len(pending)
	result.Exhausted = len(exhausted)

	for _, market := range pending[:min(budget, len(pending))] {
		if ctx.Err() != nil || circuitOpen(opts.CircuitOpen) {
			break
		}
		anchor := oldest[market.VenueSymbol]

		events, err := fetcher.FetchFundingHistory(ctx, market.VenueSymbol, target, anchor-1)
		if err == nil {
			result.Fetched++
			if len(events) == 0 {
				exhausted[market.VenueSymbol] = true
				result.Exhausted = len(exhausted)
				continue
			}
			err = store.RecordHistory(ctx, venueID, events)
			if err == nil {
				result.Events += len(events)
				result.Pending--
			}
		}
		if err != nil {
			result.Errors++
			logf(opts.Log, "%s %s: backfill failed: %s", venueID, market.VenueSymbol, DescribeError(err))
		}
	}
	return result, nil
}

// LeverageTierSweep is one tier sweep's outcome.
type LeverageTierSweep struct {
	Markets int
	Tiers   int
	// Complete is false when part of the venue was missed, in which case nothing was pruned.
	Complete bool
}

// RefreshVenueLeverageTiers pulls a venue's entire risk-limit ladder and replaces what is stored for
// it.
//
// A whole-venue sweep, not a budgeted per-symbol rotation: ladders change only when a venue relists
// or rebalances risk, so this runs daily. It prunes only when the sweep saw the whole venue;
// otherwise a rate-limited batch would delete the ladders of markets it never asked about, which is
// worse than letting them go a day stale. An empty sweep never reaches the store at all, so a
// failed request cannot prune good ladders. A nil fetcher or now takes no action / time.Now.
func RefreshVenueLeverageTiers(ctx context.Context, fetcher TierFetcher, store TierStore, now func() time.Time) (LeverageTierSweep, error) {
	if fetcher == nil {
		return LeverageTierSweep{Complete: true}, nil
	}
	tiers, complete, err := fetcher.FetchLeverageTiers(ctx)
	if err != nil {
		return LeverageTierSweep{}, err
	}
	if len(tiers) == 0 {
		return LeverageTierSweep{Complete: complete}, nil
	}

	if _, err := store.ReplaceLeverageTiers(ctx, fetcher.VenueID(), tiers, nowOrDefault(now)(), complete); err != nil {
		return LeverageTierSweep{}, err
	}
	markets := make(map[string]struct{}, len(tiers))
	for _, tier := range tiers {
		markets[tier.VenueSymbol] = struct{}{}
	}
	return LeverageTierSweep{Markets: len(markets), Tiers: len(tiers), Complete: complete}, nil
}

// LiquidationSweep is one liquidation poll's outcome.
type LiquidationSweep struct {
	// Fetched is records the venue returned, before de-duplication.
	Fetched int
	// Stored is rows actually new to the database. Most of a page repeats on every poll.
	Stored  int
	Markets int
	// Complete is false when part of the venue was missed. Nothing is ever deleted, so this is lost
	// coverage rather than a guard on a prune.
	Complete bool
}

// RefreshVenueLiquidations polls one venue's forced closes and stores whatever is new.
//
// Re-reading is normal, not waste: Gate accepts from/to and ignores them, so each poll returns the
// same page and the store's composite primary key absorbs the repeats. Stored far below Fetched is
// the expected steady state.
func RefreshVenueLiquidations(ctx context.Context, fetcher LiquidationFetcher, store LiquidationStore) (LiquidationSweep, error) {
	if fetcher == nil {
		return LiquidationSweep{Complete: true}, nil
	}
	liquidations, complete, err := fetcher.FetchLiquidations(ctx)
	if err != nil {
		return LiquidationSweep{}, err
	}
	if len(liquidations) == 0 {
		return LiquidationSweep{Complete: complete}, nil
	}

	stored, err := store.RecordLiquidations(ctx, fetcher.VenueID(), liquidations)
	if err != nil {
		return LiquidationSweep{}, err
	}
	markets := make(map[string]struct{}, len(liquidations))
	for _, liquidation := range liquidations {
		markets[liquidation.VenueSymbol] = struct{}{}
	}
	return LiquidationSweep{Fetched: len(liquidations), Stored: stored, Markets: len(markets), Complete: complete}, nil
}

// intervalMs is a market's settlement interval in milliseconds, treating an unknown interval as
// hourly. Float, as the TypeScript arithmetic is, because intervals need not be whole hours.
func intervalMs(hours *float64) float64 {
	h := 1.0
	if hours != nil {
		h = *hours
	}
	return h * float64(hourMs)
}

func durationMs(value, fallback time.Duration) int64 {
	if value <= 0 {
		value = fallback
	}
	return value.Milliseconds()
}

func nowOrDefault(now func() time.Time) func() time.Time {
	if now == nil {
		return time.Now
	}
	return now
}

func circuitOpen(open func() bool) bool {
	return open != nil && open()
}

func logf(log func(string), format string, args ...any) {
	if log != nil {
		log(fmt.Sprintf(format, args...))
	}
}
