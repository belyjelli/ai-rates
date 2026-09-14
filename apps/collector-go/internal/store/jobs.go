package store

// The collector's scheduled jobs: the settled-funding folds, the stability scores, the verified pair
// backtests, the identity checks and the ranked pair candidates.
//
// Ported from apps/collector/src/store.ts (refreshFundingStats through refreshRankedPairs). The SQL is
// the same SQL, statement for statement, including its deletes, retention and transactions; the
// arithmetic is internal/core's port of packages/core, pinned to the same test vectors. The comments
// that justify each clause live beside the TypeScript and the migrations and are not repeated here
// except where the Go differs.
//
// What does differ, deliberately:
//   - Rows are written through unnest arrays, 2,000 rows a statement as the TypeScript chunks them,
//     rather than as a VALUES list. The parameter count is then per column, not per row, so no
//     candidate count can reach Postgres' 65,535-parameter limit.
//   - The pair backtests read their legs' settlements with an unnest-array IN, not a list of bound
//     row values, for the same reason.

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Defaults, as the TypeScript declares them in its parameter lists.
const (
	DailyFundingLookbackDays       = 70
	HourlyFundingRetainDays        = 8
	PairBacktestSizeUSD            = 10_000.0
	PairBacktestRetainDays         = 30
	IdentityCheckWindowHours       = 6
	RankedPairsSizeUSD             = 10_000.0
	RankedPairsRetainDays          = 30
	RankedPairsSwitchCostPerDollar = 0.002
)

// jobChunkRows matches the TypeScript's CHUNK_ROWS, so a failure lands on the same boundaries.
const jobChunkRows = 2_000

const jobMsPerDay = int64(86_400_000)

type jobExecer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// jobKey joins key parts with NUL, as the TypeScript does, so no symbol can collide across parts.
func jobKey(parts ...string) string { return strings.Join(parts, "\x00") }

func jobChunks(n int, write func(lo, hi int) error) error {
	for lo := 0; lo < n; lo += jobChunkRows {
		if err := write(lo, min(lo+jobChunkRows, n)); err != nil {
			return err
		}
	}
	return nil
}

func jobRunDay(nowMs int64) string {
	return time.UnixMilli(nowMs).UTC().Format("2006-01-02")
}

// jobOrZero is how JavaScript compares a null: `null > x` coerces null to 0.
func jobOrZero(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

// RefreshFundingStats recomputes 24h and 7d time-weighted settled APR per market and drops markets
// not seen for a day from market_latest. Returns the number of markets with stats.
func (s *Store) RefreshFundingStats(ctx context.Context) (int, error) {
	var markets int
	err := s.pool.QueryRow(ctx, `
		WITH upserted AS (
		  INSERT INTO market_funding_stats
		    (venue_id, venue_symbol, apr_24h, apr_7d, settlements_24h, settlements_7d, updated_at)
		  SELECT
		    venue_id,
		    venue_symbol,
		    sum(rate) FILTER (WHERE settled_at > now() - interval '24 hours')
		      / nullif(sum(basis_hours) FILTER (WHERE settled_at > now() - interval '24 hours'), 0) * 876000,
		    sum(rate) / nullif(sum(basis_hours), 0) * 876000,
		    (count(*) FILTER (WHERE settled_at > now() - interval '24 hours'))::integer,
		    count(*)::integer,
		    now()
		  FROM funding_events
		  WHERE settled_at > now() - interval '7 days'
		  GROUP BY venue_id, venue_symbol
		  ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
		    apr_24h = EXCLUDED.apr_24h,
		    apr_7d = EXCLUDED.apr_7d,
		    settlements_24h = EXCLUDED.settlements_24h,
		    settlements_7d = EXCLUDED.settlements_7d,
		    updated_at = EXCLUDED.updated_at
		  RETURNING 1
		)
		SELECT count(*)::integer AS markets FROM upserted`).Scan(&markets)
	if err != nil {
		return 0, fmt.Errorf("refresh funding stats: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `DELETE FROM market_funding_stats WHERE updated_at < now() - interval '1 day'`); err != nil {
		return 0, fmt.Errorf("expire funding stats: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `DELETE FROM market_latest WHERE observed_at < now() - interval '1 day'`); err != nil {
		return 0, fmt.Errorf("expire market_latest: %w", err)
	}
	return markets, nil
}

// RefreshDailyFunding folds settled funding into one row per market per UTC day, over the whole
// lookback every time, so days the backfill fills in later are never skipped. Returns day-rows
// written. Pass DailyFundingLookbackDays for the TypeScript default.
func (s *Store) RefreshDailyFunding(ctx context.Context, maxLookbackDays int) (int, error) {
	var rows int
	err := s.pool.QueryRow(ctx, `
		WITH from_day AS (
		  SELECT (now() - make_interval(days => $1))::date AS d
		), folded AS (
		  INSERT INTO market_funding_daily
		    (venue_id, venue_symbol, day, rate_sum, basis_hours_sum, settlements)
		  SELECT e.venue_id,
		         e.venue_symbol,
		         (e.settled_at AT TIME ZONE 'UTC')::date,
		         sum(e.rate),
		         sum(e.basis_hours),
		         count(*)::integer
		  FROM funding_events e
		  WHERE e.settled_at >= (SELECT d FROM from_day)
		  GROUP BY 1, 2, 3
		  ON CONFLICT (venue_id, venue_symbol, day) DO UPDATE SET
		    rate_sum = EXCLUDED.rate_sum,
		    basis_hours_sum = EXCLUDED.basis_hours_sum,
		    settlements = EXCLUDED.settlements
		  RETURNING 1
		)
		SELECT count(*)::integer AS rows FROM folded`, maxLookbackDays).Scan(&rows)
	if err != nil {
		return 0, fmt.Errorf("refresh daily funding: %w", err)
	}
	// 60 days is the longest window read, so keep a little beyond it and no more.
	if _, err := s.pool.Exec(ctx, `
		DELETE FROM market_funding_daily WHERE day < (now() - interval '70 days')::date`); err != nil {
		return 0, fmt.Errorf("expire daily funding: %w", err)
	}
	return rows, nil
}

// RefreshHourlyFunding folds settled funding into one row per market per UTC hour and drops hours
// past retention. Pass HourlyFundingRetainDays for the TypeScript default.
func (s *Store) RefreshHourlyFunding(ctx context.Context, retainDays int) (int, error) {
	var rows int
	err := s.pool.QueryRow(ctx, `
		WITH from_hour AS (
		  SELECT date_trunc('hour', (now() - make_interval(days => $1)) AT TIME ZONE 'UTC')
		           AT TIME ZONE 'UTC' AS h
		), folded AS (
		  INSERT INTO market_funding_hourly
		    (venue_id, venue_symbol, hour, rate_sum, basis_hours_sum, settlements)
		  SELECT e.venue_id,
		         e.venue_symbol,
		         date_trunc('hour', e.settled_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
		         sum(e.rate),
		         sum(e.basis_hours),
		         count(*)::integer
		  FROM funding_events e
		  WHERE e.settled_at >= (SELECT h FROM from_hour)
		  GROUP BY 1, 2, 3
		  ON CONFLICT (venue_id, venue_symbol, hour) DO UPDATE SET
		    rate_sum = EXCLUDED.rate_sum,
		    basis_hours_sum = EXCLUDED.basis_hours_sum,
		    settlements = EXCLUDED.settlements
		  RETURNING 1
		)
		SELECT count(*)::integer AS rows FROM folded`, retainDays).Scan(&rows)
	if err != nil {
		return 0, fmt.Errorf("refresh hourly funding: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `
		DELETE FROM market_funding_hourly
		WHERE hour < date_trunc('hour', (now() - make_interval(days => $1)) AT TIME ZONE 'UTC')
		               AT TIME ZONE 'UTC'`, retainDays); err != nil {
		return 0, fmt.Errorf("expire hourly funding: %w", err)
	}
	return rows, nil
}

// RefreshLongWindows recomputes the 30d and 60d time-weighted APRs from the daily rollup, touching
// only the long-window columns on conflict.
func (s *Store) RefreshLongWindows(ctx context.Context) (int, error) {
	var markets int
	err := s.pool.QueryRow(ctx, `
		WITH windows AS (
		  SELECT venue_id,
		         venue_symbol,
		         sum(rate_sum) FILTER (WHERE day >= (now() - interval '30 days')::date)
		           / nullif(
		               sum(basis_hours_sum) FILTER (WHERE day >= (now() - interval '30 days')::date),
		               0) * 876000 AS apr_30d,
		         sum(rate_sum) / nullif(sum(basis_hours_sum), 0) * 876000 AS apr_60d
		  FROM market_funding_daily
		  WHERE day >= (now() - interval '60 days')::date
		  GROUP BY venue_id, venue_symbol
		), upserted AS (
		  INSERT INTO market_funding_stats
		    (venue_id, venue_symbol, apr_30d, apr_60d,
		     settlements_24h, settlements_7d, updated_at, long_windows_at)
		  SELECT venue_id, venue_symbol, apr_30d, apr_60d, 0, 0, now(), now() FROM windows
		  ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
		    apr_30d = EXCLUDED.apr_30d,
		    apr_60d = EXCLUDED.apr_60d,
		    long_windows_at = EXCLUDED.long_windows_at
		  RETURNING 1
		)
		SELECT count(*)::integer AS markets FROM upserted`).Scan(&markets)
	if err != nil {
		return 0, fmt.Errorf("refresh long windows: %w", err)
	}
	return markets, nil
}

// RefreshStability recomputes funding stability and momentum from the daily rollup (definition in
// migration 009), touching only the three stability columns on conflict.
func (s *Store) RefreshStability(ctx context.Context) (int, error) {
	var markets int
	err := s.pool.QueryRow(ctx, `
		WITH daily AS (
		  SELECT venue_id, venue_symbol, day, rate_sum,
		         rate_sum / nullif(basis_hours_sum, 0) * 876000 AS apr
		  FROM market_funding_daily
		  WHERE day >= (now() - interval '30 days')::date
		),
		charging AS (SELECT * FROM daily WHERE rate_sum <> 0),
		scored AS (
		  SELECT venue_id,
		         venue_symbol,
		         count(*) AS charge_days,
		         greatest(
		           count(*) FILTER (WHERE apr > 0),
		           count(*) FILTER (WHERE apr < 0)
		         ) AS dominant,
		         avg(apr) FILTER (WHERE day >= (now() - interval '7 days')::date) AS recent,
		         avg(apr) FILTER (WHERE day < (now() - interval '7 days')::date) AS prior
		  FROM charging
		  GROUP BY venue_id, venue_symbol
		),
		upserted AS (
		  INSERT INTO market_funding_stats
		    (venue_id, venue_symbol, stability_30d, stability_days, momentum_30d,
		     settlements_24h, settlements_7d, updated_at)
		  SELECT venue_id,
		         venue_symbol,
		         (dominant + 5)::double precision / (charge_days + 10),
		         charge_days,
		         recent - prior,
		         0, 0, now()
		  FROM scored
		  ON CONFLICT (venue_id, venue_symbol) DO UPDATE SET
		    stability_30d = EXCLUDED.stability_30d,
		    stability_days = EXCLUDED.stability_days,
		    momentum_30d = EXCLUDED.momentum_30d
		  RETURNING 1
		)
		SELECT count(*)::integer AS markets FROM upserted`).Scan(&markets)
	if err != nil {
		return 0, fmt.Errorf("refresh stability: %w", err)
	}
	return markets, nil
}

// jobChargeDays is charging days per market over the last 7 days, from the daily rollup.
func (s *Store) jobChargeDays(ctx context.Context) (map[string]int, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT venue_id, venue_symbol, count(*)::integer AS days
		FROM market_funding_daily
		WHERE day > (now() - interval '7 days')::date AND rate_sum <> 0
		GROUP BY venue_id, venue_symbol`)
	if err != nil {
		return nil, fmt.Errorf("charge days: %w", err)
	}
	defer rows.Close()
	days := map[string]int{}
	for rows.Next() {
		var venueID, symbol string
		var n int
		if err := rows.Scan(&venueID, &symbol, &n); err != nil {
			return nil, fmt.Errorf("charge days: %w", err)
		}
		days[jobKey(venueID, symbol)] = n
	}
	return days, rows.Err()
}

// jobSettlementsByMarket groups settlement rows by market, preserving the query's order.
func jobSettlementsByMarket(rows pgx.Rows) (map[string][]core.BacktestSettlement, error) {
	defer rows.Close()
	byMarket := map[string][]core.BacktestSettlement{}
	for rows.Next() {
		var venueID, symbol string
		var settledAt time.Time
		var rate, basisHours float64
		if err := rows.Scan(&venueID, &symbol, &settledAt, &rate, &basisHours); err != nil {
			return nil, err
		}
		key := jobKey(venueID, symbol)
		byMarket[key] = append(byMarket[key], core.BacktestSettlement{
			SettledAt: settledAt.UnixMilli(), Rate: rate, BasisHours: basisHours,
		})
	}
	return byMarket, rows.Err()
}

// RefreshPairBacktests replays the last 7 days of settled funding for every candidate pair through
// core.BacktestPair and stores the result; both legs must have charged on all 7 days. Returns rows
// written. Pass PairBacktestSizeUSD and PairBacktestRetainDays for the TypeScript defaults.
func (s *Store) RefreshPairBacktests(ctx context.Context, sizeUSD float64, retainDays int) (int, error) {
	type candidate struct {
		asset, assetClass              string
		pairStability                  *float64
		longVenueID, longSymbol        string
		longAPR, longOpenInterestUSD   *float64
		shortVenueID, shortSymbol      string
		shortAPR, shortOpenInterestUSD *float64
	}
	rows, err := s.pool.Query(ctx, `
		SELECT asset, asset_class, pair_stability,
		       long_venue_id, long_symbol, long_apr, long_open_interest_usd,
		       short_venue_id, short_symbol, short_apr, short_open_interest_usd
		FROM screener_pairs($1::float8, $2::float8, NULL, NULL,
		                    $3::text::interval, $4::float8,
		                    $5::float8)`,
		250_000.0, 0.0, "5 minutes", 1000.0, core.DivergenceTrigger)
	if err != nil {
		return 0, fmt.Errorf("pair backtest candidates: %w", err)
	}
	var candidates []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.asset, &c.assetClass, &c.pairStability,
			&c.longVenueID, &c.longSymbol, &c.longAPR, &c.longOpenInterestUSD,
			&c.shortVenueID, &c.shortSymbol, &c.shortAPR, &c.shortOpenInterestUSD); err != nil {
			rows.Close()
			return 0, fmt.Errorf("pair backtest candidates: %w", err)
		}
		candidates = append(candidates, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("pair backtest candidates: %w", err)
	}
	if len(candidates) == 0 {
		return 0, nil
	}

	chargeDays, err := s.jobChargeDays(ctx)
	if err != nil {
		return 0, err
	}

	legVenues := make([]string, 0, 2*len(candidates))
	legSymbols := make([]string, 0, 2*len(candidates))
	for _, c := range candidates {
		legVenues = append(legVenues, c.longVenueID, c.shortVenueID)
		legSymbols = append(legSymbols, c.longSymbol, c.shortSymbol)
	}
	eventRows, err := s.pool.Query(ctx, `
		SELECT venue_id, venue_symbol, settled_at, rate, basis_hours
		FROM funding_events
		WHERE (venue_id, venue_symbol) IN (SELECT * FROM unnest($1::text[], $2::text[]))
		  AND settled_at > now() - interval '7 days'
		ORDER BY settled_at, venue_id, venue_symbol`, legVenues, legSymbols)
	if err != nil {
		return 0, fmt.Errorf("pair backtest settlements: %w", err)
	}
	byMarket, err := jobSettlementsByMarket(eventRows)
	if err != nil {
		return 0, fmt.Errorf("pair backtest settlements: %w", err)
	}

	toMs := time.Now().UnixMilli()
	fromMs := toMs - 7*jobMsPerDay
	runDay := jobRunDay(toMs)

	var (
		runDays, assets, classes, longVenues, longSymbols, shortVenues, shortSymbols []string
		sizes, days, nets, aprs, winRates, avgDaily                                  []float64
		longSettled, shortSettled, missed, longCharge, shortCharge                   []int32
		thinner, worst, stability                                                    []*float64
	)
	for _, c := range candidates {
		longKey := jobKey(c.longVenueID, c.longSymbol)
		shortKey := jobKey(c.shortVenueID, c.shortSymbol)
		longDays := chargeDays[longKey]
		shortDays := chargeDays[shortKey]
		if longDays < 7 || shortDays < 7 {
			continue
		}

		result := core.BacktestPair(core.BacktestInput{
			Long:    core.BacktestLeg{VenueID: c.longVenueID, VenueSymbol: c.longSymbol, Settlements: byMarket[longKey]},
			Short:   core.BacktestLeg{VenueID: c.shortVenueID, VenueSymbol: c.shortSymbol, Settlements: byMarket[shortKey]},
			SizeUSD: sizeUSD,
			FromMs:  fromMs,
			ToMs:    toMs,
		})

		// Risk travels with the row because the ranking does not filter on it.
		var thinnerLeg *float64
		if c.longOpenInterestUSD != nil && c.shortOpenInterestUSD != nil {
			v := math.Min(*c.longOpenInterestUSD, *c.shortOpenInterestUSD)
			thinnerLeg = &v
		}
		// Math.abs(null) is 0 in JavaScript, so a null APR contributes nothing here either.
		worstLeg := math.Max(math.Abs(jobOrZero(c.longAPR)), math.Abs(jobOrZero(c.shortAPR)))

		runDays = append(runDays, runDay)
		assets = append(assets, c.asset)
		classes = append(classes, c.assetClass)
		longVenues = append(longVenues, c.longVenueID)
		longSymbols = append(longSymbols, c.longSymbol)
		shortVenues = append(shortVenues, c.shortVenueID)
		shortSymbols = append(shortSymbols, c.shortSymbol)
		sizes = append(sizes, sizeUSD)
		days = append(days, result.Days)
		nets = append(nets, result.NetFundingUSD)
		aprs = append(aprs, result.NetFundingAPRPercent)
		winRates = append(winRates, result.WinRateDays)
		avgDaily = append(avgDaily, result.AvgDailyUSD)
		longSettled = append(longSettled, int32(result.Long.Settlements))
		shortSettled = append(shortSettled, int32(result.Short.Settlements))
		missed = append(missed, int32(result.Long.MissedSettlements+result.Short.MissedSettlements))
		thinner = append(thinner, thinnerLeg)
		worst = append(worst, &worstLeg)
		stability = append(stability, c.pairStability)
		longCharge = append(longCharge, int32(longDays))
		shortCharge = append(shortCharge, int32(shortDays))
	}
	if len(runDays) == 0 {
		return 0, nil
	}

	err = jobChunks(len(runDays), func(lo, hi int) error {
		_, err := s.pool.Exec(ctx, `
			INSERT INTO market_pair_backtests (
			  run_day, asset, asset_class, long_venue_id, long_symbol, short_venue_id, short_symbol,
			  size_usd, days, net_funding_usd, net_funding_apr_percent, win_rate_days, avg_daily_usd,
			  long_settlements, short_settlements, missed_settlements,
			  thinner_leg_oi_usd, worst_leg_abs_apr, pair_stability, long_charge_days, short_charge_days
			)
			SELECT r.run_day::date, r.asset, r.asset_class, r.long_venue_id, r.long_symbol,
			       r.short_venue_id, r.short_symbol, r.size_usd, r.days, r.net_funding_usd,
			       r.net_funding_apr_percent, r.win_rate_days, r.avg_daily_usd,
			       r.long_settlements, r.short_settlements, r.missed_settlements,
			       r.thinner_leg_oi_usd, r.worst_leg_abs_apr, r.pair_stability,
			       r.long_charge_days, r.short_charge_days
			FROM unnest(
			  $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
			  $8::float8[], $9::float8[], $10::float8[], $11::float8[], $12::float8[], $13::float8[],
			  $14::int4[], $15::int4[], $16::int4[],
			  $17::float8[], $18::float8[], $19::float8[], $20::int4[], $21::int4[]
			) AS r(
			  run_day, asset, asset_class, long_venue_id, long_symbol, short_venue_id, short_symbol,
			  size_usd, days, net_funding_usd, net_funding_apr_percent, win_rate_days, avg_daily_usd,
			  long_settlements, short_settlements, missed_settlements,
			  thinner_leg_oi_usd, worst_leg_abs_apr, pair_stability, long_charge_days, short_charge_days
			)
			ON CONFLICT (run_day, asset_class, asset) DO UPDATE SET
			  long_venue_id = EXCLUDED.long_venue_id,
			  long_symbol = EXCLUDED.long_symbol,
			  short_venue_id = EXCLUDED.short_venue_id,
			  short_symbol = EXCLUDED.short_symbol,
			  size_usd = EXCLUDED.size_usd,
			  days = EXCLUDED.days,
			  net_funding_usd = EXCLUDED.net_funding_usd,
			  net_funding_apr_percent = EXCLUDED.net_funding_apr_percent,
			  win_rate_days = EXCLUDED.win_rate_days,
			  avg_daily_usd = EXCLUDED.avg_daily_usd,
			  long_settlements = EXCLUDED.long_settlements,
			  short_settlements = EXCLUDED.short_settlements,
			  missed_settlements = EXCLUDED.missed_settlements,
			  thinner_leg_oi_usd = EXCLUDED.thinner_leg_oi_usd,
			  worst_leg_abs_apr = EXCLUDED.worst_leg_abs_apr,
			  pair_stability = EXCLUDED.pair_stability,
			  long_charge_days = EXCLUDED.long_charge_days,
			  short_charge_days = EXCLUDED.short_charge_days`,
			runDays[lo:hi], assets[lo:hi], classes[lo:hi], longVenues[lo:hi], longSymbols[lo:hi],
			shortVenues[lo:hi], shortSymbols[lo:hi], sizes[lo:hi], days[lo:hi], nets[lo:hi],
			aprs[lo:hi], winRates[lo:hi], avgDaily[lo:hi], longSettled[lo:hi], shortSettled[lo:hi],
			missed[lo:hi], thinner[lo:hi], worst[lo:hi], stability[lo:hi], longCharge[lo:hi],
			shortCharge[lo:hi])
		return err
	})
	if err != nil {
		return 0, fmt.Errorf("insert market_pair_backtests: %w", err)
	}

	if _, err := s.pool.Exec(ctx, `
		DELETE FROM market_pair_backtests
		WHERE run_day < (now() - make_interval(days => $1))::date`, retainDays); err != nil {
		return 0, fmt.Errorf("expire market_pair_backtests: %w", err)
	}
	return len(runDays), nil
}

// RefreshIdentityChecks checks, by price, that every market is the asset it is filed under, and
// replaces the stored verdicts wholesale in one transaction. SQL gathers the evidence;
// core.ClassifyDivergence judges it. Pass IdentityCheckWindowHours for the TypeScript default.
func (s *Store) RefreshIdentityChecks(ctx context.Context, windowHours int) (int, error) {
	rows, err := s.pool.Query(ctx, `
		WITH pool AS (
		  SELECT asset_class, base, venue_id, venue_symbol, mark_price, open_interest_usd
		  FROM market_latest
		  WHERE observed_at > now() - interval '5 minutes' AND mark_price > 0
		),
		multi AS (SELECT asset_class, base FROM pool GROUP BY asset_class, base HAVING count(*) > 1),
		anchor AS (
		  SELECT DISTINCT ON (asset_class, base) asset_class, base, venue_id, venue_symbol, mark_price,
		         open_interest_usd
		  FROM pool WHERE (asset_class, base) IN (SELECT asset_class, base FROM multi)
		  ORDER BY asset_class, base, open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
		),
		diverging AS (
		  SELECT p.asset_class, p.base, p.venue_id, p.venue_symbol,
		         a.venue_id AS anchor_venue_id, a.venue_symbol AS anchor_venue_symbol,
		         p.mark_price / a.mark_price AS price_ratio,
		         p.open_interest_usd AS member_oi_usd,
		         a.open_interest_usd AS anchor_oi_usd
		  FROM pool p
		  JOIN anchor a ON a.asset_class = p.asset_class AND a.base = p.base
		  WHERE (p.venue_id, p.venue_symbol) <> (a.venue_id, a.venue_symbol)
		    AND abs(ln(p.mark_price / a.mark_price)) > ln(1 + $1::float8)
		),
		bars AS (
		  SELECT s.venue_id, s.venue_symbol, date_trunc('minute', s.observed_at) AS bucket,
		         avg(s.mark_price) AS mark
		  FROM funding_snapshots s
		  WHERE s.observed_at > now() - make_interval(hours => $2)
		    AND s.mark_price > 0
		    AND (s.venue_id, s.venue_symbol) IN (
		      SELECT venue_id, venue_symbol FROM diverging
		      UNION SELECT anchor_venue_id, anchor_venue_symbol FROM diverging)
		  GROUP BY 1, 2, 3
		),
		moved AS (
		  SELECT venue_id, venue_symbol,
		         count(*) FILTER (WHERE step IS NOT NULL AND step <> 0)::integer AS moves
		  FROM (
		    SELECT venue_id, venue_symbol,
		           mark - lag(mark) OVER (PARTITION BY venue_id, venue_symbol ORDER BY bucket) AS step
		    FROM bars
		  ) t
		  GROUP BY 1, 2
		),
		paired AS (
		  SELECT d.venue_id, d.venue_symbol,
		         ln(b.mark / lag(b.mark) OVER w) AS ret,
		         ln(ab.mark / lag(ab.mark) OVER w) AS anchor_ret,
		         log(b.mark / ab.mark) AS log_ratio
		  FROM diverging d
		  JOIN bars b ON b.venue_id = d.venue_id AND b.venue_symbol = d.venue_symbol
		  JOIN bars ab ON ab.venue_id = d.anchor_venue_id
		              AND ab.venue_symbol = d.anchor_venue_symbol
		              AND ab.bucket = b.bucket
		  WHERE ab.mark > 0
		  WINDOW w AS (PARTITION BY d.venue_id, d.venue_symbol ORDER BY b.bucket)
		),
		stats AS (
		  SELECT venue_id, venue_symbol,
		         count(*)::integer AS shared_minutes,
		         corr(ret, anchor_ret) AS return_corr,
		         stddev_samp(log_ratio) AS ratio_sd
		  FROM paired GROUP BY 1, 2
		)
		SELECT d.asset_class, d.base, d.venue_id, d.venue_symbol,
		       d.anchor_venue_id, d.anchor_venue_symbol,
		       d.price_ratio, d.member_oi_usd, d.anchor_oi_usd,
		       coalesce(s.shared_minutes, 0) AS shared_minutes,
		       s.return_corr, s.ratio_sd,
		       coalesce(mm.moves, 0) AS member_moves,
		       coalesce(am.moves, 0) AS anchor_moves
		FROM diverging d
		LEFT JOIN stats s ON s.venue_id = d.venue_id AND s.venue_symbol = d.venue_symbol
		LEFT JOIN moved mm ON mm.venue_id = d.venue_id AND mm.venue_symbol = d.venue_symbol
		LEFT JOIN moved am ON am.venue_id = d.anchor_venue_id
		                  AND am.venue_symbol = d.anchor_venue_symbol`,
		core.DivergenceTrigger, windowHours)
	if err != nil {
		return 0, fmt.Errorf("identity evidence: %w", err)
	}

	checkedAt := time.Now()
	var (
		checked                                                                []time.Time
		bases, classes, venues, symbols, anchorVenues, anchorSymbols, verdicts []string
		ratios                                                                 []float64
		exponents                                                              []*int32
		corrs, ratioSDs, memberOI, anchorOI                                    []*float64
		shared, memberMoves, anchorMoves                                       []int32
	)
	for rows.Next() {
		var (
			assetClass, base, venueID, symbol, anchorVenueID, anchorSymbol string
			priceRatio                                                     float64
			memberOIUSD, anchorOIUSD, returnCorr, ratioSD                  *float64
			sharedMinutes, memberMoved, anchorMoved                        int
		)
		if err := rows.Scan(&assetClass, &base, &venueID, &symbol, &anchorVenueID, &anchorSymbol,
			&priceRatio, &memberOIUSD, &anchorOIUSD, &sharedMinutes, &returnCorr, &ratioSD,
			&memberMoved, &anchorMoved); err != nil {
			rows.Close()
			return 0, fmt.Errorf("identity evidence: %w", err)
		}
		check := core.ClassifyDivergence(core.DivergenceEvidence{
			PriceRatio:    priceRatio,
			ReturnCorr:    returnCorr,
			SharedMinutes: sharedMinutes,
			MemberMoves:   memberMoved,
			AnchorMoves:   anchorMoved,
		})
		var exponent *int32
		if check.ScaleExponent != nil {
			v := int32(*check.ScaleExponent)
			exponent = &v
		}
		checked = append(checked, checkedAt)
		bases = append(bases, base)
		classes = append(classes, assetClass)
		venues = append(venues, venueID)
		symbols = append(symbols, symbol)
		anchorVenues = append(anchorVenues, anchorVenueID)
		anchorSymbols = append(anchorSymbols, anchorSymbol)
		verdicts = append(verdicts, string(check.Verdict))
		ratios = append(ratios, priceRatio)
		exponents = append(exponents, exponent)
		corrs = append(corrs, returnCorr)
		ratioSDs = append(ratioSDs, ratioSD)
		shared = append(shared, int32(sharedMinutes))
		memberMoves = append(memberMoves, int32(memberMoved))
		anchorMoves = append(anchorMoves, int32(anchorMoved))
		memberOI = append(memberOI, memberOIUSD)
		anchorOI = append(anchorOI, anchorOIUSD)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("identity evidence: %w", err)
	}

	// Replaced wholesale rather than upserted, in one transaction so the page never reads an empty
	// table: a market back in line must vanish from the report.
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM market_identity_checks`); err != nil {
			return err
		}
		return jobChunks(len(checked), func(lo, hi int) error {
			_, err := tx.Exec(ctx, `
				INSERT INTO market_identity_checks (
				  checked_at, base, asset_class, venue_id, venue_symbol, anchor_venue_id,
				  anchor_venue_symbol, verdict, price_ratio, scale_exponent, return_corr, ratio_sd,
				  shared_minutes, member_moves, anchor_moves, member_oi_usd, anchor_oi_usd
				)
				SELECT * FROM unnest(
				  $1::timestamptz[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
				  $7::text[], $8::text[], $9::float8[], $10::int4[], $11::float8[], $12::float8[],
				  $13::int4[], $14::int4[], $15::int4[], $16::float8[], $17::float8[]
				)`,
				checked[lo:hi], bases[lo:hi], classes[lo:hi], venues[lo:hi], symbols[lo:hi],
				anchorVenues[lo:hi], anchorSymbols[lo:hi], verdicts[lo:hi], ratios[lo:hi],
				exponents[lo:hi], corrs[lo:hi], ratioSDs[lo:hi], shared[lo:hi], memberMoves[lo:hi],
				anchorMoves[lo:hi], memberOI[lo:hi], anchorOI[lo:hi])
			return err
		})
	})
	if err != nil {
		return 0, fmt.Errorf("replace market_identity_checks: %w", err)
	}
	return len(checked), nil
}

// RefreshRankedPairs records every candidate pair and what each ranking variant would have selected
// (migration 018, plans/ranking-system-design.md). Returns rows written. Pass RankedPairsSizeUSD,
// RankedPairsRetainDays, core.DefaultParticipation and RankedPairsSwitchCostPerDollar for the
// TypeScript defaults.
func (s *Store) RefreshRankedPairs(ctx context.Context, sizeUSD float64, retainDays int, participation, switchCostPerDollar float64) (int, error) {
	type candidate struct {
		assetClass, asset                                  string
		longVenueID, longSymbol, shortVenueID, shortSymbol string
		liveSpreadAPR, thinnerLegOiUSD                     *float64
		ratePerWeek                                        float64
		chargeDays                                         int
		evidenceThinnerOiUSD                               float64
	}
	rows, err := s.pool.Query(ctx, `
		WITH anchors AS (
		  SELECT DISTINCT ON (asset_class, base) asset_class, base,
		         coalesce(mark_price, index_price) AS anchor_mark
		  FROM market_latest
		  WHERE observed_at > now() - interval '5 minutes'
		    AND coalesce(mark_price, index_price) > 0
		  ORDER BY asset_class, base, open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
		),
		legs AS (
		  SELECT m.asset_class, m.base, m.venue_id, m.venue_symbol, m.apr, m.open_interest_usd
		  FROM market_latest m
		  LEFT JOIN anchors a ON a.asset_class = m.asset_class AND a.base = m.base
		  WHERE m.observed_at > now() - interval '5 minutes'
		    AND (a.anchor_mark IS NULL
		      OR coalesce(m.mark_price, m.index_price) IS NULL
		      OR coalesce(m.mark_price, m.index_price)
		           BETWEEN a.anchor_mark / (1 + $1::float8)
		               AND a.anchor_mark * (1 + $1::float8))
		),
		per_venue AS (
		  SELECT DISTINCT ON (asset_class, base, venue_id) *
		  FROM legs
		  ORDER BY asset_class, base, venue_id, open_interest_usd DESC NULLS LAST, venue_symbol
		)
		SELECT a.asset_class, a.base AS asset,
		  CASE WHEN a.apr <= b.apr THEN a.venue_id ELSE b.venue_id END AS long_venue_id,
		  CASE WHEN a.apr <= b.apr THEN a.venue_symbol ELSE b.venue_symbol END AS long_symbol,
		  CASE WHEN a.apr <= b.apr THEN b.venue_id ELSE a.venue_id END AS short_venue_id,
		  CASE WHEN a.apr <= b.apr THEN b.venue_symbol ELSE a.venue_symbol END AS short_symbol,
		  abs(b.apr - a.apr) AS live_spread_apr,
		  CASE
		    WHEN a.open_interest_usd IS NULL OR b.open_interest_usd IS NULL THEN NULL
		    ELSE least(a.open_interest_usd, b.open_interest_usd)
		  END AS thinner_leg_oi_usd
		FROM per_venue a
		JOIN per_venue b
		  ON b.asset_class = a.asset_class AND b.base = a.base AND b.venue_id > a.venue_id`,
		core.DivergenceTrigger)
	if err != nil {
		return 0, fmt.Errorf("ranked pair candidates: %w", err)
	}
	var candidates []*candidate
	for rows.Next() {
		c := &candidate{}
		if err := rows.Scan(&c.assetClass, &c.asset, &c.longVenueID, &c.longSymbol,
			&c.shortVenueID, &c.shortSymbol, &c.liveSpreadAPR, &c.thinnerLegOiUSD); err != nil {
			rows.Close()
			return 0, fmt.Errorf("ranked pair candidates: %w", err)
		}
		candidates = append(candidates, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("ranked pair candidates: %w", err)
	}
	if len(candidates) == 0 {
		return 0, nil
	}

	// Every leg's settled funding in one read, not one read per pair.
	eventRows, err := s.pool.Query(ctx, `
		SELECT venue_id, venue_symbol, settled_at, rate, basis_hours
		FROM funding_events
		WHERE settled_at > now() - interval '7 days'
		  AND (venue_id, venue_symbol) IN (
		    SELECT venue_id, venue_symbol FROM market_latest
		    WHERE observed_at > now() - interval '5 minutes')
		ORDER BY settled_at, venue_id, venue_symbol`)
	if err != nil {
		return 0, fmt.Errorf("ranked pair settlements: %w", err)
	}
	byMarket, err := jobSettlementsByMarket(eventRows)
	if err != nil {
		return 0, fmt.Errorf("ranked pair settlements: %w", err)
	}

	chargeDays, err := s.jobChargeDays(ctx)
	if err != nil {
		return 0, err
	}

	// Last run's hysteresis choice. Path-dependent, so it is read rather than re-derived.
	incumbentRows, err := s.pool.Query(ctx, `
		SELECT asset_class, asset, long_venue_id, long_symbol, short_venue_id, short_symbol
		FROM market_pair_candidates
		WHERE chosen_hysteresis
		  AND run_day = (SELECT max(run_day) FROM market_pair_candidates)`)
	if err != nil {
		return 0, fmt.Errorf("ranked pair incumbents: %w", err)
	}
	pairKey := func(longVenueID, longSymbol, shortVenueID, shortSymbol string) string {
		return jobKey(longVenueID, longSymbol, shortVenueID, shortSymbol)
	}
	incumbentByAsset := map[string]string{}
	for incumbentRows.Next() {
		var assetClass, asset, lv, ls, sv, ss string
		if err := incumbentRows.Scan(&assetClass, &asset, &lv, &ls, &sv, &ss); err != nil {
			incumbentRows.Close()
			return 0, fmt.Errorf("ranked pair incumbents: %w", err)
		}
		// A later row for the same asset replaces an earlier one, as Map construction does.
		incumbentByAsset[jobKey(assetClass, asset)] = pairKey(lv, ls, sv, ss)
	}
	incumbentRows.Close()
	if err := incumbentRows.Err(); err != nil {
		return 0, fmt.Errorf("ranked pair incumbents: %w", err)
	}

	toMs := time.Now().UnixMilli()
	fromMs := toMs - 7*jobMsPerDay
	runDay := jobRunDay(toMs)

	evidence := func(c *candidate) core.PairEvidence {
		return core.PairEvidence{
			RatePerWeek:     c.ratePerWeek,
			ChargeDays:      float64(c.chargeDays),
			ThinnerLegOiUSD: c.evidenceThinnerOiUSD,
		}
	}
	keyOfPair := func(c *candidate) string {
		return pairKey(c.longVenueID, c.longSymbol, c.shortVenueID, c.shortSymbol)
	}

	rates := make([]float64, len(candidates))
	for i, c := range candidates {
		longKey := jobKey(c.longVenueID, c.longSymbol)
		shortKey := jobKey(c.shortVenueID, c.shortSymbol)
		result := core.BacktestPair(core.BacktestInput{
			Long:    core.BacktestLeg{VenueID: c.longVenueID, VenueSymbol: c.longSymbol, Settlements: byMarket[longKey]},
			Short:   core.BacktestLeg{VenueID: c.shortVenueID, VenueSymbol: c.shortSymbol, Settlements: byMarket[shortKey]},
			SizeUSD: sizeUSD,
			FromMs:  fromMs,
			ToMs:    toMs,
		})
		// Per dollar per week, gross: fees cannot separate candidates, the cost of moving can.
		c.ratePerWeek = result.NetFundingUSD / sizeUSD
		c.chargeDays = min(chargeDays[longKey], chargeDays[shortKey])
		// Zero, not null, in the evidence: unknown depth deploys nothing. The row keeps the null.
		c.evidenceThinnerOiUSD = jobOrZero(c.thinnerLegOiUSD)
		rates[i] = c.ratePerWeek
	}

	// The prior every score shrinks toward: the pool median, not zero.
	sort.Float64s(rates)
	mid := len(rates) / 2
	prior := rates[mid]
	if len(rates)%2 == 0 {
		prior = (rates[mid-1] + rates[mid]) / 2
	}

	band := core.SwitchBand(switchCostPerDollar, core.DefaultHorizonWeeks, core.BandCubeRootC)

	var assetOrder []string
	byAsset := map[string][]*candidate{}
	for _, c := range candidates {
		key := jobKey(c.assetClass, c.asset)
		if _, seen := byAsset[key]; !seen {
			assetOrder = append(assetOrder, key)
		}
		byAsset[key] = append(byAsset[key], c)
	}

	type flags struct{ widest, settled, shrunk, hysteresis, capacity bool }
	chosen := map[*candidate]*flags{}
	flagsOf := func(c *candidate) *flags {
		f, ok := chosen[c]
		if !ok {
			f = &flags{}
			chosen[c] = f
		}
		return f
	}
	// The first maximum wins, as `reduce((a, b) => (by(b) > by(a) ? b : a))` keeps it.
	best := func(list []*candidate, by func(*candidate) float64) *candidate {
		winner := list[0]
		for _, c := range list[1:] {
			if by(c) > by(winner) {
				winner = c
			}
		}
		return winner
	}
	score := func(c *candidate) float64 { return core.Score(evidence(c), prior, core.ShrinkageK) }

	for _, key := range assetOrder {
		list := byAsset[key]
		flagsOf(best(list, func(c *candidate) float64 { return jobOrZero(c.liveSpreadAPR) })).widest = true
		flagsOf(best(list, func(c *candidate) float64 { return c.ratePerWeek })).settled = true
		byScore := best(list, score)
		flagsOf(byScore).shrunk = true
		flagsOf(best(list, func(c *candidate) float64 {
			return core.ExpectedWeeklyUSD(score(c), core.DeployableUSD(c.evidenceThinnerOiUSD, participation))
		})).capacity = true

		// Hysteresis: hold the incumbent unless a challenger clears the band, or unless the incumbent
		// has decayed below the exit floor.
		var incumbent *candidate
		if incumbentPair, ok := incumbentByAsset[key]; ok {
			for _, c := range list {
				if keyOfPair(c) == incumbentPair {
					incumbent = c
					break
				}
			}
		}
		if incumbent == nil {
			flagsOf(byScore).hysteresis = true
		} else {
			held := score(incumbent)
			challenger := score(byScore)
			if core.ShouldExit(held, prior) || core.ShouldSwitch(held, challenger, band) {
				flagsOf(byScore).hysteresis = true
			} else {
				flagsOf(incumbent).hysteresis = true
			}
		}
	}

	n := len(candidates)
	var (
		runDays                                                     = make([]string, n)
		classes, assets, longVenues, longSymbols                    = make([]string, n), make([]string, n), make([]string, n), make([]string, n)
		shortVenues, shortSymbols                                   = make([]string, n), make([]string, n)
		ratePerWeek, scores, deployables, expected                  = make([]float64, n), make([]float64, n), make([]float64, n), make([]float64, n)
		chargeDaysCol                                               = make([]int32, n)
		thinner, switchCosts                                        = make([]*float64, n), make([]*float64, n)
		widest, settled, shrunk, hysteresis, capacity, wasIncumbent = make([]bool, n), make([]bool, n), make([]bool, n), make([]bool, n), make([]bool, n), make([]bool, n)
	)
	for i, c := range candidates {
		f := chosen[c]
		if f == nil {
			f = &flags{}
		}
		value := score(c)
		deployable := core.DeployableUSD(c.evidenceThinnerOiUSD, participation)
		incumbentPair, ok := incumbentByAsset[jobKey(c.assetClass, c.asset)]
		held := ok && incumbentPair == keyOfPair(c)

		runDays[i] = runDay
		classes[i] = c.assetClass
		assets[i] = c.asset
		longVenues[i] = c.longVenueID
		longSymbols[i] = c.longSymbol
		shortVenues[i] = c.shortVenueID
		shortSymbols[i] = c.shortSymbol
		ratePerWeek[i] = c.ratePerWeek
		chargeDaysCol[i] = int32(c.chargeDays)
		thinner[i] = c.thinnerLegOiUSD
		scores[i] = value
		deployables[i] = deployable
		expected[i] = core.ExpectedWeeklyUSD(value, deployable)
		widest[i], settled[i], shrunk[i], hysteresis[i], capacity[i] = f.widest, f.settled, f.shrunk, f.hysteresis, f.capacity
		wasIncumbent[i] = held
		// Nil where no switch was contemplated, which is not the same as a switch that was free.
		if !held {
			cost := sizeUSD * switchCostPerDollar
			switchCosts[i] = &cost
		}
	}

	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM market_pair_candidates WHERE run_day = $1::text::date`, runDay); err != nil {
			return err
		}
		return jobChunks(n, func(lo, hi int) error {
			return jobInsertCandidates(ctx, tx, runDays[lo:hi], classes[lo:hi], assets[lo:hi],
				longVenues[lo:hi], longSymbols[lo:hi], shortVenues[lo:hi], shortSymbols[lo:hi],
				ratePerWeek[lo:hi], chargeDaysCol[lo:hi], thinner[lo:hi], scores[lo:hi],
				deployables[lo:hi], expected[lo:hi], widest[lo:hi], settled[lo:hi], shrunk[lo:hi],
				hysteresis[lo:hi], capacity[lo:hi], wasIncumbent[lo:hi], switchCosts[lo:hi])
		})
	})
	if err != nil {
		return 0, fmt.Errorf("replace market_pair_candidates: %w", err)
	}

	// Retention lives here rather than in the migration, which runs once and could never prune.
	if _, err := s.pool.Exec(ctx, `
		DELETE FROM market_pair_candidates
		WHERE run_day < (now() - make_interval(days => $1))::date`, retainDays); err != nil {
		return 0, fmt.Errorf("expire market_pair_candidates: %w", err)
	}
	return n, nil
}

func jobInsertCandidates(ctx context.Context, db jobExecer, args ...any) error {
	_, err := db.Exec(ctx, `
		INSERT INTO market_pair_candidates (
		  run_day, asset_class, asset, long_venue_id, long_symbol, short_venue_id, short_symbol,
		  rate_per_week, charge_days, thinner_leg_oi_usd, score, deployable_usd, expected_weekly_usd,
		  chosen_widest, chosen_settled, chosen_shrunk, chosen_hysteresis, chosen_capacity,
		  was_incumbent, switch_cost_usd
		)
		SELECT r.run_day::date, r.asset_class, r.asset, r.long_venue_id, r.long_symbol,
		       r.short_venue_id, r.short_symbol, r.rate_per_week, r.charge_days,
		       r.thinner_leg_oi_usd, r.score, r.deployable_usd, r.expected_weekly_usd,
		       r.chosen_widest, r.chosen_settled, r.chosen_shrunk, r.chosen_hysteresis,
		       r.chosen_capacity, r.was_incumbent, r.switch_cost_usd
		FROM unnest(
		  $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
		  $8::float8[], $9::int4[], $10::float8[], $11::float8[], $12::float8[], $13::float8[],
		  $14::bool[], $15::bool[], $16::bool[], $17::bool[], $18::bool[], $19::bool[], $20::float8[]
		) AS r(
		  run_day, asset_class, asset, long_venue_id, long_symbol, short_venue_id, short_symbol,
		  rate_per_week, charge_days, thinner_leg_oi_usd, score, deployable_usd, expected_weekly_usd,
		  chosen_widest, chosen_settled, chosen_shrunk, chosen_hysteresis, chosen_capacity,
		  was_incumbent, switch_cost_usd
		)`, args...)
	return err
}
