package store

// Store methods for the per-venue side loops: funding history, risk-limit ladders, forced closes,
// and taker flow. The taker-flow methods have no TypeScript twin; they were written for the Go
// collector on 2026-09-17 against migration 023.
// Ported from apps/collector/src/store.ts (recordHistory, recordLiquidations, latestSettledByMarket,
// oldestSettledByMarket, replaceLeverageTiers); the SQL keeps the same conflict targets and the same
// merge rules.

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// sweepTierChunkRows matches the TypeScript store's CHUNK_ROWS for the one write that does not
// de-duplicate first. unnest binds a fixed number of array parameters however many rows it carries,
// so this is not about Postgres' parameter limit: an upsert cannot touch one conflict key twice in a
// statement, and chunking the same way keeps a duplicate spanning two chunks behaving as it does in
// TypeScript.
const sweepTierChunkRows = 2_000

// LatestSettledByMarket is the newest stored settlement per market, as epoch milliseconds. The
// 30-day bound keeps the scan on recent, uncompressed chunks.
func (s *Store) LatestSettledByMarket(ctx context.Context, venueID string) (map[string]int64, error) {
	const sql = `
		SELECT venue_symbol, max(settled_at) FROM funding_events
		WHERE venue_id = $1 AND settled_at > now() - interval '30 days'
		GROUP BY venue_symbol`
	return s.sweepSettledByMarket(ctx, sql, venueID, "latest")
}

// OldestSettledByMarket is the oldest stored settlement per market, as epoch milliseconds: the anchor
// the backfill reaches back from. Unbounded on purpose — the backfill's job is the far past.
func (s *Store) OldestSettledByMarket(ctx context.Context, venueID string) (map[string]int64, error) {
	const sql = `
		SELECT venue_symbol, min(settled_at) FROM funding_events
		WHERE venue_id = $1
		GROUP BY venue_symbol`
	return s.sweepSettledByMarket(ctx, sql, venueID, "oldest")
}

func (s *Store) sweepSettledByMarket(ctx context.Context, sql, venueID, which string) (map[string]int64, error) {
	rows, err := s.pool.Query(ctx, sql, venueID)
	if err != nil {
		return nil, fmt.Errorf("%s settled for %s: %w", which, venueID, err)
	}
	defer rows.Close()

	settled := make(map[string]int64)
	for rows.Next() {
		var symbol string
		var at time.Time
		if err := rows.Scan(&symbol, &at); err != nil {
			return nil, fmt.Errorf("%s settled for %s: %w", which, venueID, err)
		}
		settled[symbol] = at.UnixMilli()
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("%s settled for %s: %w", which, venueID, err)
	}
	return settled, nil
}

// RecordHistory stores settled payments from a venue's history API.
//
// A fetched value replaces one observed while collecting, but never another fetched value: the
// conflict update is guarded on source = 'observed'. The mark is kept when the history response
// omits one, since a history endpoint that publishes no mark should not erase the one the snapshot
// saw.
func (s *Store) RecordHistory(ctx context.Context, venueID string, events []core.FundingEvent) error {
	// One event per (market, settlement time): a single INSERT cannot touch the same conflict key
	// twice. Later duplicates win, as the TypeScript store's Map does.
	unique := make(map[sweepEventKey]core.FundingEvent, len(events))
	for _, event := range events {
		if event.VenueID != venueID {
			continue
		}
		unique[sweepEventKey{event.VenueSymbol, event.SettledAt}] = event
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
		sources = append(sources, "history")
	}

	const sql = `
		INSERT INTO funding_events (settled_at, venue_id, venue_symbol, rate, basis_hours, mark_price, source)
		SELECT * FROM unnest(
			$1::timestamptz[], $2::text[], $3::text[], $4::float8[], $5::float8[], $6::float8[], $7::text[]
		)
		ON CONFLICT (venue_id, venue_symbol, settled_at) DO UPDATE SET
			rate = EXCLUDED.rate,
			basis_hours = EXCLUDED.basis_hours,
			mark_price = COALESCE(EXCLUDED.mark_price, funding_events.mark_price),
			source = EXCLUDED.source
		WHERE funding_events.source = 'observed'`
	if _, err := s.pool.Exec(ctx, sql, settledAt, venueIDs, symbols, rates, basisHours, marks, sources); err != nil {
		return fmt.Errorf("record history for %s: %w", venueID, err)
	}
	return nil
}

type sweepEventKey struct {
	symbol    string
	settledAt int64
}

// ReplaceLeverageTiers replaces a venue's risk-limit ladders with the sweep just fetched, and returns
// the number of tiers written.
//
// Upsert then prune, in one transaction, rather than delete then insert: the worker reads this table
// continuously, and a delete-first transaction would leave a window with no ladder at all. Rows this
// venue kept last time but did not report now are stale — a market delisted, or a ladder that lost
// its top tier — so they go once the new rows are in, but only when prune is set: a partial sweep's
// missing rows may belong to markets it never reached.
//
// An empty sweep is a failed sweep, not a venue that dropped every ladder, so it writes nothing.
func (s *Store) ReplaceLeverageTiers(ctx context.Context, venueID string, tiers []core.LeverageTier, fetchedAt time.Time, prune bool) (int, error) {
	if len(tiers) == 0 {
		return 0, nil
	}
	// Postgres keeps microseconds. Truncating here makes the value written and the prune bound the
	// same instant, so the prune can never catch the rows this very sweep just wrote.
	fetchedAt = fetchedAt.UTC().Truncate(time.Microsecond)

	const upsert = `
		INSERT INTO market_leverage_tiers (
			venue_id, venue_symbol, tier, lower_notional_usd, upper_notional_usd, imr, mmr, max_leverage,
			fetched_at
		)
		SELECT *, $9::timestamptz FROM unnest(
			$1::text[], $2::text[], $3::int4[], $4::float8[], $5::float8[], $6::float8[], $7::float8[],
			$8::float8[]
		)
		ON CONFLICT (venue_id, venue_symbol, tier) DO UPDATE SET
			lower_notional_usd = EXCLUDED.lower_notional_usd,
			upper_notional_usd = EXCLUDED.upper_notional_usd,
			imr = EXCLUDED.imr,
			mmr = EXCLUDED.mmr,
			max_leverage = EXCLUDED.max_leverage,
			fetched_at = EXCLUDED.fetched_at`

	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		for start := 0; start < len(tiers); start += sweepTierChunkRows {
			chunk := tiers[start:min(start+sweepTierChunkRows, len(tiers))]
			n := len(chunk)
			venueIDs := make([]string, n)
			symbols := make([]string, n)
			numbers := make([]int32, n)
			lowers := make([]float64, n)
			uppers := make([]*float64, n)
			imrs := make([]float64, n)
			mmrs := make([]*float64, n)
			leverages := make([]float64, n)
			for i, tier := range chunk {
				venueIDs[i] = tier.VenueID
				symbols[i] = tier.VenueSymbol
				numbers[i] = int32(tier.Tier)
				lowers[i] = tier.LowerNotionalUSD
				uppers[i] = tier.UpperNotionalUSD
				imrs[i] = tier.IMR
				mmrs[i] = tier.MMR
				leverages[i] = tier.MaxLeverage
			}
			if _, err := tx.Exec(ctx, upsert, venueIDs, symbols, numbers, lowers, uppers, imrs, mmrs,
				leverages, fetchedAt); err != nil {
				return fmt.Errorf("upsert market_leverage_tiers: %w", err)
			}
		}
		if prune {
			if _, err := tx.Exec(ctx,
				`DELETE FROM market_leverage_tiers WHERE venue_id = $1 AND fetched_at < $2`,
				venueID, fetchedAt); err != nil {
				return fmt.Errorf("prune market_leverage_tiers: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("replace leverage tiers for %s: %w", venueID, err)
	}
	return len(tiers), nil
}

// RecordLiquidations stores forced closes and returns how many rows were new.
//
// Insert-only: a liquidation is immutable once reported, so there is nothing to merge on conflict.
// The conflict is expected on almost every poll rather than exceptional — Gate ignores from/to, so
// each sweep re-reads the same page, and the primary key (venue_id, venue_symbol, liquidated_at,
// size_contracts, fill_price) absorbs the repeats. See migration 012 for why the key has to be the
// event's own content.
func (s *Store) RecordLiquidations(ctx context.Context, venueID string, liquidations []core.Liquidation) (int, error) {
	// One row per key within a single INSERT: a statement cannot touch the same conflict key twice.
	unique := make(map[sweepLiquidationKey]core.Liquidation, len(liquidations))
	for _, liquidation := range liquidations {
		if liquidation.VenueID != venueID {
			continue
		}
		unique[sweepLiquidationKey{
			symbol: liquidation.VenueSymbol, at: liquidation.LiquidatedAt,
			size: liquidation.SizeContracts, price: liquidation.FillPrice,
		}] = liquidation
	}
	if len(unique) == 0 {
		return 0, nil
	}

	n := len(unique)
	venueIDs := make([]string, 0, n)
	symbols := make([]string, 0, n)
	liquidatedAt := make([]time.Time, 0, n)
	sides := make([]string, 0, n)
	sizes := make([]float64, 0, n)
	prices := make([]float64, 0, n)
	notionals := make([]*float64, 0, n)
	for _, liquidation := range unique {
		venueIDs = append(venueIDs, liquidation.VenueID)
		symbols = append(symbols, liquidation.VenueSymbol)
		liquidatedAt = append(liquidatedAt, time.UnixMilli(liquidation.LiquidatedAt).UTC())
		sides = append(sides, liquidation.Side)
		sizes = append(sizes, liquidation.SizeContracts)
		prices = append(prices, liquidation.FillPrice)
		notionals = append(notionals, liquidation.NotionalUSD)
	}

	const sql = `
		WITH new_rows AS (
			INSERT INTO liquidations (
				venue_id, venue_symbol, liquidated_at, side, size_contracts, fill_price, notional_usd
			)
			SELECT * FROM unnest(
				$1::text[], $2::text[], $3::timestamptz[], $4::text[], $5::float8[], $6::float8[], $7::float8[]
			)
			ON CONFLICT DO NOTHING
			RETURNING 1
		)
		SELECT count(*)::int FROM new_rows`
	var inserted int
	if err := s.pool.QueryRow(ctx, sql, venueIDs, symbols, liquidatedAt, sides, sizes, prices, notionals).
		Scan(&inserted); err != nil {
		return 0, fmt.Errorf("record liquidations for %s: %w", venueID, err)
	}
	return inserted, nil
}

type sweepLiquidationKey struct {
	symbol string
	at     int64
	size   float64
	price  float64
}

// TakerFlowSubjects is the markets on one venue that taker flow is polled for, largest asset first.
//
// An asset qualifies by its open interest summed across collector.TakerFlowVenues, the four venues
// that publish taker volume, and the top collector.TakerFlowTopAssets assets are taken. The venue then
// polls every one of its markets on those assets. Ranked on the four together rather than per venue,
// so the /cvd page compares the same assets on every venue instead of four overlapping lists.
//
// Linear USDT and USDC books only. Inverse contracts are margined in the coin and are out of scope,
// and they are excluded from the ranking too, so an asset's slot is earned on the books that get
// polled. market_latest is filtered by the same five-minute freshness window every other reader of
// it uses (StreamSubjects, the identity and ranking jobs): a market the snapshot loop has stopped
// seeing is delisted or failing, and its open interest is not a current figure.
//
// Ordered by the asset's summed open interest, so a sweep cut short by shutdown or an open circuit
// has spent its requests on the assets that matter most.
func (s *Store) TakerFlowSubjects(ctx context.Context, venueID string) ([]string, error) {
	const sql = `
		WITH fresh AS (
			SELECT venue_id, venue_symbol, asset_class, base, open_interest_usd
			FROM market_latest
			WHERE observed_at > now() - interval '5 minutes'
			  AND venue_id = ANY($2::text[])
			  AND quote IN ('USDT', 'USDC')
		),
		top_assets AS (
			SELECT asset_class, base, sum(open_interest_usd) AS open_interest_usd
			FROM fresh
			GROUP BY asset_class, base
			HAVING sum(open_interest_usd) > 0
			ORDER BY sum(open_interest_usd) DESC, asset_class, base
			LIMIT $3
		)
		SELECT f.venue_symbol
		FROM fresh f
		JOIN top_assets t ON t.asset_class = f.asset_class AND t.base = f.base
		WHERE f.venue_id = $1
		ORDER BY t.open_interest_usd DESC, f.open_interest_usd DESC NULLS LAST, f.venue_symbol`

	rows, err := s.pool.Query(ctx, sql, venueID, collector.TakerFlowVenues, collector.TakerFlowTopAssets)
	if err != nil {
		return nil, fmt.Errorf("taker flow subjects for %s: %w", venueID, err)
	}
	defer rows.Close()

	var subjects []string
	for rows.Next() {
		var symbol string
		if err := rows.Scan(&symbol); err != nil {
			return nil, fmt.Errorf("taker flow subjects for %s: %w", venueID, err)
		}
		subjects = append(subjects, symbol)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("taker flow subjects for %s: %w", venueID, err)
	}
	return subjects, nil
}

// LatestTakerFlowByMarket is the newest stored bucket_start per market, as epoch milliseconds.
//
// Bounded to eight days: past the 7-day lookback a market is backfilled from scratch anyway, and the
// bound keeps the scan on the recent chunks of the hypertable.
func (s *Store) LatestTakerFlowByMarket(ctx context.Context, venueID string) (map[string]int64, error) {
	const sql = `
		SELECT venue_symbol, max(bucket_start) FROM taker_flow
		WHERE venue_id = $1 AND bucket_start > now() - interval '8 days'
		GROUP BY venue_symbol`
	rows, err := s.pool.Query(ctx, sql, venueID)
	if err != nil {
		return nil, fmt.Errorf("latest taker flow for %s: %w", venueID, err)
	}
	defer rows.Close()

	latest := make(map[string]int64)
	for rows.Next() {
		var symbol string
		var at time.Time
		if err := rows.Scan(&symbol, &at); err != nil {
			return nil, fmt.Errorf("latest taker flow for %s: %w", venueID, err)
		}
		latest[symbol] = at.UnixMilli()
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("latest taker flow for %s: %w", venueID, err)
	}
	return latest, nil
}

// RecordTakerFlow upserts taker buy and sell per bucket and returns the rows written.
//
// An UPDATE on conflict, unlike RecordLiquidations: a bucket is not immutable. The newest one is
// still filling when first read, and Gate publishes an early partial row it rewrites minutes later,
// so a re-read must replace what was stored. close_price keeps the stored value when a re-read
// carries none, so a price is never erased by a response that simply lacks one.
//
// Rows that would violate the table's CHECKs (a negative or non-finite volume) are dropped here
// rather than sent: one bad row would otherwise fail the statement and lose the whole market's batch.
func (s *Store) RecordTakerFlow(ctx context.Context, venueID string, flows []core.TakerFlow) (int, error) {
	// One row per key within a single INSERT: a statement cannot touch the same conflict key twice.
	unique := make(map[sweepTakerFlowKey]core.TakerFlow, len(flows))
	for _, flow := range flows {
		if flow.VenueID != venueID || !validVolume(flow.BuyUSD) || !validVolume(flow.SellUSD) {
			continue
		}
		unique[sweepTakerFlowKey{symbol: flow.VenueSymbol, bucket: flow.BucketStart}] = flow
	}
	if len(unique) == 0 {
		return 0, nil
	}

	n := len(unique)
	venueIDs := make([]string, 0, n)
	symbols := make([]string, 0, n)
	buckets := make([]time.Time, 0, n)
	buys := make([]float64, 0, n)
	sells := make([]float64, 0, n)
	closes := make([]*float64, 0, n)
	for _, flow := range unique {
		venueIDs = append(venueIDs, flow.VenueID)
		symbols = append(symbols, flow.VenueSymbol)
		buckets = append(buckets, time.UnixMilli(flow.BucketStart).UTC())
		buys = append(buys, flow.BuyUSD)
		sells = append(sells, flow.SellUSD)
		var closePrice *float64
		if flow.ClosePrice != nil && validVolume(*flow.ClosePrice) && *flow.ClosePrice > 0 {
			closePrice = flow.ClosePrice
		}
		closes = append(closes, closePrice)
	}

	const sql = `
		INSERT INTO taker_flow (venue_id, venue_symbol, bucket_start, buy_usd, sell_usd, close_price)
		SELECT * FROM unnest(
			$1::text[], $2::text[], $3::timestamptz[], $4::float8[], $5::float8[], $6::float8[]
		)
		ON CONFLICT (venue_id, venue_symbol, bucket_start) DO UPDATE SET
			buy_usd = EXCLUDED.buy_usd,
			sell_usd = EXCLUDED.sell_usd,
			close_price = COALESCE(EXCLUDED.close_price, taker_flow.close_price)`
	tag, err := s.pool.Exec(ctx, sql, venueIDs, symbols, buckets, buys, sells, closes)
	if err != nil {
		return 0, fmt.Errorf("record taker flow for %s: %w", venueID, err)
	}
	return int(tag.RowsAffected()), nil
}

type sweepTakerFlowKey struct {
	symbol string
	bucket int64
}

// validVolume is a finite, non-negative figure: what taker_flow's CHECKs accept.
func validVolume(v float64) bool {
	return v >= 0 && !math.IsInf(v, 0) && !math.IsNaN(v)
}
