package collector

// The per-venue side loops: settled funding history (forward sweep and backfill), risk-limit
// ladders, forced closes, and taker flow.
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

// TakerFlowFetcher is an adapter that publishes per-market taker buy and sell volume at a 5-minute
// grain (migration 023). It returns every bucket STARTING in [fromMs, toMs] that the venue still
// holds, in dollars, stamped at the bucket start whatever the venue stamps. Implemented by binance,
// okx, gate and bitget; the TakerFlowVenues list below is the same four and must stay in step.
type TakerFlowFetcher interface {
	VenueID() string
	FetchTakerFlow(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.TakerFlow, error)
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

// TakerFlowStore is the slice of the store the taker-flow sweep needs.
type TakerFlowStore interface {
	// TakerFlowSubjects is the venue's markets to poll, largest asset first; see
	// store.TakerFlowSubjects for the selection.
	TakerFlowSubjects(ctx context.Context, venueID string) ([]string, error)
	// LatestTakerFlowByMarket is the newest stored bucket_start per market, epoch ms.
	LatestTakerFlowByMarket(ctx context.Context, venueID string) (map[string]int64, error)
	RecordTakerFlow(ctx context.Context, venueID string, flows []core.TakerFlow) (int, error)
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
		// Shutdown cancelling an in-flight request is the stop the TypeScript `shouldStop` made, not a
		// venue fault. Counting it logged a false "history failed" for every venue on every deploy.
		if err != nil && ctx.Err() != nil {
			break
		}
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
		// As in the forward sweep: a cancelled request is shutdown, not a failure to count.
		if err != nil && ctx.Err() != nil {
			break
		}
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

// TakerFlowVenues are the venues whose open interest ranks the taker-flow assets, and the venues
// that poll them: the four measured on 2026-09-17 to publish taker buy and sell per 5 minutes
// (migration 023). Ranking across exactly these four, rather than every venue collected, keeps the
// set tied to where the data comes from -- an asset large only on a venue with no taker endpoint
// would take a slot and yield nothing.
var TakerFlowVenues = []string{"binance", "okx", "gate", "bitget"}

const (
	// TakerFlowTopAssets is how many assets, ranked by open interest summed across TakerFlowVenues,
	// taker flow is collected for. Each costs one request a market a sweep on up to four venues, and
	// the /cvd page reads assets someone would trade, so the long tail is left out.
	TakerFlowTopAssets = 100

	// DefaultTakerFlowLookback is how far back a market with nothing stored is backfilled. The page's
	// longest window is 7 days. Venues that keep less return what they have: OKX five days, Bitget
	// two and a half hours.
	DefaultTakerFlowLookback = 7 * 24 * time.Hour

	// TakerFlowReread is how many buckets behind the newest stored one each sweep starts. The newest
	// bucket was still filling when it was stored, and two venues publish late: OKX's row appears
	// ~2.5 minutes into its bucket, and Gate's newest row is an early partial it rewrites ~2.5 minutes
	// after the bucket closes (both measured 2026-09-17). Two buckets back covers both.
	TakerFlowReread = 2
)

// TakerFlowSweepOptions configures SweepVenueTakerFlow. A zero Lookback takes its default.
//
// There is no stop flag: cancel ctx. It is checked before each market.
type TakerFlowSweepOptions struct {
	Now      func() time.Time
	Lookback time.Duration
	// CircuitOpen reports the venue's circuit breaker, typically func() bool { return client.Circuit().Open }.
	CircuitOpen func() bool
	Log         func(string)
}

// TakerFlowSweep is one taker-flow sweep's outcome.
type TakerFlowSweep struct {
	// Markets is subjects selected for the venue.
	Markets int
	// Fetched is markets whose fetch succeeded, including those that returned nothing.
	Fetched int
	// Backfilled is markets that had nothing stored and got buckets back from the lookback. A market
	// the adapter declines without a request (an OKX or Bitget USDC book) is not one.
	Backfilled int
	// Buckets is rows written, re-reads included.
	Buckets int
	Errors  int
}

// SweepVenueTakerFlow polls taker flow for the venue's top assets and upserts it.
//
// Incremental by the store, not by memory: each market resumes TakerFlowReread buckets before its
// newest stored bucket, so a restart costs nothing and the buckets that were still filling are
// always overwritten with their final figures. A market with nothing stored reads the whole
// lookback, which the adapter pages and paces. Requests go through the venue's shared HTTP client,
// so its spacing and circuit breaker also cover the snapshot loop.
//
// A nil fetcher does nothing. A failed store read is returned; a failed market is counted, logged
// and skipped.
func SweepVenueTakerFlow(ctx context.Context, fetcher TakerFlowFetcher, store TakerFlowStore, opts TakerFlowSweepOptions) (TakerFlowSweep, error) {
	var result TakerFlowSweep
	if fetcher == nil {
		return result, nil
	}

	now := nowOrDefault(opts.Now)
	lookbackMs := durationMs(opts.Lookback, DefaultTakerFlowLookback)
	venueID := fetcher.VenueID()

	subjects, err := store.TakerFlowSubjects(ctx, venueID)
	if err != nil {
		return result, err
	}
	latest, err := store.LatestTakerFlowByMarket(ctx, venueID)
	if err != nil {
		return result, err
	}
	result.Markets = len(subjects)

	for _, symbol := range subjects {
		if ctx.Err() != nil || circuitOpen(opts.CircuitOpen) {
			break
		}
		at := now().UnixMilli()
		newest, stored := latest[symbol]
		from := core.TakerFlowBucketStart(at - lookbackMs)
		if stored {
			from = core.TakerFlowBucketStart(newest) - TakerFlowReread*core.TakerFlowBucketMs
		}

		flows, err := fetcher.FetchTakerFlow(ctx, symbol, from, at)
		// As in the history sweep: a request cancelled by shutdown is not a venue fault.
		if err != nil && ctx.Err() != nil {
			break
		}
		if err == nil {
			result.Fetched++
			if len(flows) > 0 {
				if !stored {
					result.Backfilled++
				}
				var written int
				written, err = store.RecordTakerFlow(ctx, venueID, flows)
				result.Buckets += written
			}
		}
		if err != nil {
			result.Errors++
			logf(opts.Log, "%s %s: taker flow failed: %s", venueID, symbol, DescribeError(err))
		}
	}
	return result, nil
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
