// Package store writes what the adapters collected into TimescaleDB.
//
// Ported from apps/collector/src/store.ts, column for column, and this is where the CPU half of the
// rewrite lives.
//
// WHY THE WRITE PATH IS SHAPED LIKE THIS. The TypeScript store sends every table as chunked
// multi-row INSERTs of up to 2,000 rows. Each one builds a SQL string with thousands of
// placeholders, allocates a parameter array per row, and makes the server parse a statement it has
// never seen before — per venue, per cycle, 56 times a minute against an instance shared with 16
// other tenants.
//
// Here:
//   - funding_snapshots, which is append-only and by far the largest table (~4.8k rows a cycle,
//     ~324k rows an hour), goes through pgx.CopyFrom: the binary COPY protocol, no SQL text per
//     row, no placeholder parsing.
//   - The upserts go through unnest() over column-oriented arrays: ONE statement with a fixed
//     number of parameters whatever the row count, so the planner sees the same query every cycle
//     and the client allocates one slice per column rather than one per row.
//
// Everything still happens in a single transaction per venue cycle, exactly as before: a cycle that
// half-lands would leave market_latest describing markets that funding_snapshots never recorded.
package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Store writes collected data. One per process; the pool is safe for concurrent use, which is what
// lets 56 venue loops share it.
type Store struct {
	pool *pgxpool.Pool
	// curatedMaxLeverage is the catalog's hand-curated fallback for venues that publish none
	// (Aster, Paradex, Lighter). A figure a venue reports itself always wins.
	curatedMaxLeverage map[string]float64
}

func New(pool *pgxpool.Pool, curatedMaxLeverage map[string]float64) *Store {
	return &Store{pool: pool, curatedMaxLeverage: curatedMaxLeverage}
}

var snapshotColumns = []string{
	"observed_at", "venue_id", "venue_symbol", "rate", "basis_hours", "interval_hours",
	"next_funding_at", "kind", "mark_price", "index_price", "open_interest_usd", "volume_24h_usd",
}

// RecordBatch stores one venue cycle: the markets seen, the raw snapshots, the latest row per
// market, and any settled payments that arrived with them.
func (s *Store) RecordBatch(ctx context.Context, venueID string, batch core.SnapshotBatch, observedAt time.Time) error {
	// Only this venue's rows, and one row per symbol: a single INSERT cannot touch the same
	// conflict key twice, and venues do occasionally repeat a symbol within one response.
	latest := make(map[string]core.FundingSnapshot, len(batch.Snapshots))
	own := make([]core.FundingSnapshot, 0, len(batch.Snapshots))
	for _, snap := range batch.Snapshots {
		if snap.VenueID != venueID {
			continue
		}
		own = append(own, snap)
		latest[snap.VenueSymbol] = snap
	}

	markets := make([]core.FundingSnapshot, 0, len(latest))
	for _, snap := range latest {
		markets = append(markets, snap)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := s.upsertMarkets(ctx, tx, venueID, markets, observedAt); err != nil {
		return err
	}
	if err := s.copySnapshots(ctx, tx, own, observedAt); err != nil {
		return err
	}
	if err := s.upsertLatest(ctx, tx, markets); err != nil {
		return err
	}
	if err := s.insertEvents(ctx, tx, venueID, batch.Settled, "observed"); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// copySnapshots streams the cycle's raw rows over the binary COPY protocol.
func (s *Store) copySnapshots(ctx context.Context, tx pgx.Tx, snaps []core.FundingSnapshot, observedAt time.Time) error {
	if len(snaps) == 0 {
		return nil
	}
	source := pgx.CopyFromSlice(len(snaps), func(i int) ([]any, error) {
		snap := snaps[i]
		return []any{
			observedAt,
			snap.VenueID,
			snap.VenueSymbol,
			snap.Rate,
			snap.BasisHours,
			snap.IntervalHours,
			msToTime(snap.NextFundingAt),
			string(snap.Kind),
			// Per unit of base, not per contract: adapters already derived open_interest_usd from
			// the venue's own contract price, so only the stored prices are rescaled.
			core.PerUnitPrice(snap.MarkPrice, snap.Multiplier),
			core.PerUnitPrice(snap.IndexPrice, snap.Multiplier),
			snap.OpenInterestUSD,
			snap.Volume24hUSD,
		}, nil
	})
	if _, err := tx.CopyFrom(ctx, pgx.Identifier{"funding_snapshots"}, snapshotColumns, source); err != nil {
		return fmt.Errorf("copy funding_snapshots: %w", err)
	}
	return nil
}

func (s *Store) upsertMarkets(ctx context.Context, tx pgx.Tx, venueID string, snaps []core.FundingSnapshot, lastSeen time.Time) error {
	if len(snaps) == 0 {
		return nil
	}
	n := len(snaps)
	venueIDs := make([]string, n)
	symbols := make([]string, n)
	bases := make([]string, n)
	classes := make([]string, n)
	quotes := make([]*string, n)
	multipliers := make([]float64, n)
	dexes := make([]*string, n)
	intervals := make([]*float64, n)
	maxLeverages := make([]*float64, n)

	curated, hasCurated := s.curatedMaxLeverage[venueID]
	for i, snap := range snaps {
		venueIDs[i] = snap.VenueID
		symbols[i] = snap.VenueSymbol
		bases[i] = snap.Base
		classes[i] = string(snap.AssetClass)
		quotes[i] = snap.Quote
		multipliers[i] = snap.Multiplier
		dexes[i] = snap.Dex
		intervals[i] = snap.IntervalHours
		maxLeverages[i] = snap.MaxLeverage
		if maxLeverages[i] == nil && hasCurated {
			value := curated
			maxLeverages[i] = &value
		}
	}

	// interval_hours and max_leverage COALESCE against the stored value so a response that
	// transiently omits a field does not erase a known one.
	const sql = `
		INSERT INTO markets (
			venue_id, venue_symbol, base, asset_class, quote, multiplier, dex, interval_hours,
			max_leverage, last_seen
		)
		SELECT *, $10::timestamptz FROM unnest(
			$1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::float8[], $7::text[],
			$8::float8[], $9::float8[]
		)
		ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
			base = EXCLUDED.base,
			asset_class = EXCLUDED.asset_class,
			quote = EXCLUDED.quote,
			multiplier = EXCLUDED.multiplier,
			dex = EXCLUDED.dex,
			interval_hours = COALESCE(EXCLUDED.interval_hours, markets.interval_hours),
			max_leverage = COALESCE(EXCLUDED.max_leverage, markets.max_leverage),
			last_seen = EXCLUDED.last_seen`

	if _, err := tx.Exec(ctx, sql, venueIDs, symbols, bases, classes, quotes, multipliers, dexes,
		intervals, maxLeverages, lastSeen); err != nil {
		return fmt.Errorf("upsert markets: %w", err)
	}
	return nil
}

// quoteIsNewer decides whether an incoming cycle's book may replace the stored one. It is repeated
// across five assignments rather than computed once because ON CONFLICT DO UPDATE has nowhere to put
// a shared expression, and spelling it out five times is better than five chances to spell it
// differently.
//
// NULL semantics carry the two cases that matter. EXCLUDED.quotes_at is null when this cycle carried
// no book at all: the comparison is then null, the CASE takes its ELSE branch, and the stored book
// survives with the timestamp it already had. That is a deliberate change from the pre-Phase-6
// behaviour, where a bookless cycle nulled the stored quote — a venue that drops its book for one
// cycle no longer flaps the page, and the reader cannot be misled by the retained value because it
// gates on quotes_at and a quote that stops being refreshed ages out of the gate on its own. The
// other case is a row that has never held a quote, where market_latest.quotes_at is null and the
// coalesce to -infinity lets the first book through.
const quoteIsNewer = `EXCLUDED.quotes_at >= coalesce(market_latest.quotes_at, '-infinity'::timestamptz)`

func (s *Store) upsertLatest(ctx context.Context, tx pgx.Tx, snaps []core.FundingSnapshot) error {
	// basis_hours > 0 is required to derive an APR at all, and a market with none has nothing to
	// say on the screener.
	usable := make([]core.FundingSnapshot, 0, len(snaps))
	for _, snap := range snaps {
		if snap.BasisHours > 0 {
			usable = append(usable, snap)
		}
	}
	if len(usable) == 0 {
		return nil
	}

	n := len(usable)
	venueIDs := make([]string, n)
	symbols := make([]string, n)
	bases := make([]string, n)
	classes := make([]string, n)
	quotes := make([]*string, n)
	observedAt := make([]time.Time, n)
	rates := make([]float64, n)
	basisHours := make([]float64, n)
	aprs := make([]float64, n)
	intervals := make([]*float64, n)
	nextFunding := make([]*time.Time, n)
	kinds := make([]string, n)
	marks := make([]*float64, n)
	indexes := make([]*float64, n)
	openInterest := make([]*float64, n)
	volumes := make([]*float64, n)
	bestBids := make([]*float64, n)
	bestBidSizes := make([]*float64, n)
	bestAsks := make([]*float64, n)
	bestAskSizes := make([]*float64, n)

	for i, snap := range usable {
		perHour, err := core.RatePerHour(snap.Rate, snap.BasisHours)
		if err != nil {
			return fmt.Errorf("apr for %s/%s: %w", snap.VenueID, snap.VenueSymbol, err)
		}
		venueIDs[i] = snap.VenueID
		symbols[i] = snap.VenueSymbol
		bases[i] = snap.Base
		classes[i] = string(snap.AssetClass)
		quotes[i] = snap.Quote
		observedAt[i] = time.UnixMilli(snap.ObservedAt).UTC()
		rates[i] = snap.Rate
		basisHours[i] = snap.BasisHours
		aprs[i] = core.APRPercent(perHour)
		intervals[i] = snap.IntervalHours
		nextFunding[i] = msToTime(snap.NextFundingAt)
		kinds[i] = string(snap.Kind)
		marks[i] = core.PerUnitPrice(snap.MarkPrice, snap.Multiplier)
		indexes[i] = core.PerUnitPrice(snap.IndexPrice, snap.Multiplier)
		openInterest[i] = snap.OpenInterestUSD
		volumes[i] = snap.Volume24hUSD
		// Prices get the same per-unit rescale as mark and index; the sizes arrive as USD from the
		// adapter, and money is never rescaled.
		bestBids[i] = core.PerUnitPrice(snap.BestBid, snap.Multiplier)
		bestBidSizes[i] = snap.BestBidSizeUSD
		bestAsks[i] = core.PerUnitPrice(snap.BestAsk, snap.Multiplier)
		bestAskSizes[i] = snap.BestAskSizeUSD
	}

	// The observed_at guard keeps a slow cycle that lands out of order from overwriting a newer
	// row with older numbers.
	//
	// The quote columns need a SECOND guard of their own, because from Phase 6 they have a second
	// writer and the outer guard cannot see it. A cycle observed at t+60 can commit at t+66, after a
	// streamed quote observed at t+65 has already landed: the cycle is genuinely newer by
	// observed_at, so the outer guard admits it, and the older book then wins on arrival order. So
	// the four quote columns and quotes_at move together, gated on the timestamp that describes
	// THEM. Neither writer needs to know which venues the other covers -- they are ordered by when
	// the book was seen, which is the only thing that actually matters.
	//
	// This is NOT a claim that a polled book is stale. At the instant a poll lands it is exactly as
	// current as the stream, and it wins, as it should. What the guard refuses is time going
	// backwards on a live row.
	//
	// quotes_at is stamped only where this cycle really carries a book. A venue that publishes none
	// keeps null, as it keeps a null best_bid; 46 of the 56 venues never publish one.
	const sql = `
		INSERT INTO market_latest (
			venue_id, venue_symbol, base, asset_class, quote, observed_at, rate, basis_hours, apr,
			interval_hours, next_funding_at, kind, mark_price, index_price, open_interest_usd,
			volume_24h_usd, best_bid, best_bid_size_usd, best_ask, best_ask_size_usd, quotes_at
		)
		SELECT *, CASE WHEN best_bid IS NOT NULL OR best_ask IS NOT NULL THEN observed_at END
		FROM unnest(
			$1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::timestamptz[],
			$7::float8[], $8::float8[], $9::float8[], $10::float8[], $11::timestamptz[],
			$12::text[], $13::float8[], $14::float8[], $15::float8[], $16::float8[], $17::float8[],
			$18::float8[], $19::float8[], $20::float8[]
		) AS t(
			venue_id, venue_symbol, base, asset_class, quote, observed_at, rate, basis_hours, apr,
			interval_hours, next_funding_at, kind, mark_price, index_price, open_interest_usd,
			volume_24h_usd, best_bid, best_bid_size_usd, best_ask, best_ask_size_usd
		)
		ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
			base = EXCLUDED.base,
			asset_class = EXCLUDED.asset_class,
			quote = EXCLUDED.quote,
			observed_at = EXCLUDED.observed_at,
			rate = EXCLUDED.rate,
			basis_hours = EXCLUDED.basis_hours,
			apr = EXCLUDED.apr,
			interval_hours = COALESCE(EXCLUDED.interval_hours, market_latest.interval_hours),
			next_funding_at = EXCLUDED.next_funding_at,
			kind = EXCLUDED.kind,
			mark_price = EXCLUDED.mark_price,
			index_price = EXCLUDED.index_price,
			open_interest_usd = EXCLUDED.open_interest_usd,
			volume_24h_usd = EXCLUDED.volume_24h_usd,
			best_bid = CASE WHEN ` + quoteIsNewer + ` THEN EXCLUDED.best_bid ELSE market_latest.best_bid END,
			best_bid_size_usd = CASE WHEN ` + quoteIsNewer + ` THEN EXCLUDED.best_bid_size_usd ELSE market_latest.best_bid_size_usd END,
			best_ask = CASE WHEN ` + quoteIsNewer + ` THEN EXCLUDED.best_ask ELSE market_latest.best_ask END,
			best_ask_size_usd = CASE WHEN ` + quoteIsNewer + ` THEN EXCLUDED.best_ask_size_usd ELSE market_latest.best_ask_size_usd END,
			quotes_at = CASE WHEN ` + quoteIsNewer + ` THEN EXCLUDED.quotes_at ELSE market_latest.quotes_at END
		WHERE EXCLUDED.observed_at >= market_latest.observed_at`

	if _, err := tx.Exec(ctx, sql, venueIDs, symbols, bases, classes, quotes, observedAt, rates,
		basisHours, aprs, intervals, nextFunding, kinds, marks, indexes, openInterest, volumes,
		bestBids, bestBidSizes, bestAsks, bestAskSizes); err != nil {
		return fmt.Errorf("upsert market_latest: %w", err)
	}
	return nil
}

// insertEvents stores settled payments. Observed events never overwrite a value fetched from a
// venue's own history API, which is why the caller passes the source.
func (s *Store) insertEvents(ctx context.Context, tx pgx.Tx, venueID string, events []core.FundingEvent, source string) error {
	// One event per (market, settlement time): a single INSERT cannot touch the same conflict key
	// twice.
	unique := make(map[string]core.FundingEvent, len(events))
	for _, event := range events {
		if event.VenueID != venueID {
			continue
		}
		unique[fmt.Sprintf("%s\x00%d", event.VenueSymbol, event.SettledAt)] = event
	}
	if len(unique) == 0 {
		return nil
	}

	n := len(unique)
	settledAt := make([]time.Time, 0, n)
	venueIDs := make([]string, 0, n)
	symbols := make([]string, 0, n)
	rates := make([]float64, 0, n)
	basisHours := make([]float64, 0, n)
	marks := make([]*float64, 0, n)
	sources := make([]string, 0, n)

	for _, event := range unique {
		settledAt = append(settledAt, time.UnixMilli(event.SettledAt).UTC())
		venueIDs = append(venueIDs, event.VenueID)
		symbols = append(symbols, event.VenueSymbol)
		rates = append(rates, event.Rate)
		basisHours = append(basisHours, event.BasisHours)
		marks = append(marks, core.PerUnitPrice(event.MarkPrice, event.Multiplier))
		sources = append(sources, source)
	}

	const sql = `
		INSERT INTO funding_events (settled_at, venue_id, venue_symbol, rate, basis_hours, mark_price, source)
		SELECT * FROM unnest(
			$1::timestamptz[], $2::text[], $3::text[], $4::float8[], $5::float8[], $6::float8[], $7::text[]
		)
		ON CONFLICT DO NOTHING`

	if _, err := tx.Exec(ctx, sql, settledAt, venueIDs, symbols, rates, basisHours, marks, sources); err != nil {
		return fmt.Errorf("insert funding_events: %w", err)
	}
	return nil
}

// ActiveMarkets is the markets this venue has been seen listing since `since`, for warming an
// adapter's caches before its first cycle.
//
// Bounded by last_seen rather than returning everything ever stored: a market delisted months ago
// should not be seeded back into an adapter that would then publish it.
func (s *Store) ActiveMarkets(ctx context.Context, venueID string, since time.Time) ([]collector.KnownMarket, error) {
	const sql = `
		SELECT venue_symbol, interval_hours
		FROM markets
		WHERE venue_id = $1 AND last_seen >= $2
		ORDER BY venue_symbol`

	rows, err := s.pool.Query(ctx, sql, venueID, since.UTC())
	if err != nil {
		return nil, fmt.Errorf("active markets for %s: %w", venueID, err)
	}
	defer rows.Close()

	markets := make([]collector.KnownMarket, 0, 1024)
	for rows.Next() {
		var market collector.KnownMarket
		if err := rows.Scan(&market.VenueSymbol, &market.IntervalHours); err != nil {
			return nil, fmt.Errorf("active markets for %s: %w", venueID, err)
		}
		markets = append(markets, market)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("active markets for %s: %w", venueID, err)
	}
	return markets, nil
}

// RecordRun writes one cycle's outcome to collector_runs.
func (s *Store) RecordRun(ctx context.Context, run collector.Run) error {
	var message *string
	if run.Err != nil {
		text := collector.DescribeError(run.Err)
		message = &text
	}
	const sql = `
		INSERT INTO collector_runs (started_at, venue_id, duration_ms, markets, requests, error)
		VALUES ($1, $2, $3, $4, $5, $6)`
	if _, err := s.pool.Exec(ctx, sql, run.StartedAt.UTC(), run.VenueID,
		int32(run.Duration.Milliseconds()), int32(run.Markets), int32(run.Requests), message); err != nil {
		return fmt.Errorf("insert collector_runs: %w", err)
	}
	return nil
}

func msToTime(ms *int64) *time.Time {
	if ms == nil {
		return nil
	}
	at := time.UnixMilli(*ms).UTC()
	return &at
}
