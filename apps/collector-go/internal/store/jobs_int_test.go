package store

import (
	"context"
	"math"
	"sort"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Integration tests for the scheduled jobs, ported from apps/collector/src/store.int.test.ts and
// screener.int.test.ts. Same skip rule as store_int_test.go: set AIRATES_TEST_DSN to a throwaway
// database with the migrations applied. Each test truncates what it touches, so the TypeScript's
// ">=" floors (needed there because its schema is shared) are kept but would hold as equalities.

const (
	jobHour = int64(3_600_000)
	jobDay  = int64(86_400_000)
)

// jobFresh truncates every table the jobs read or write and seeds the given venues.
func jobFresh(t *testing.T, venues ...string) (*Store, *pgxpool.Pool) {
	t.Helper()
	pool := testPool(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		TRUNCATE market_latest, funding_snapshots, funding_events, collector_runs, markets,
		         market_funding_stats, market_funding_daily, market_funding_hourly,
		         market_price_hourly, market_pair_backtests, market_identity_checks,
		         market_pair_candidates, venues CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	for _, id := range venues {
		if _, err := pool.Exec(ctx, `INSERT INTO venues (id, name, type) VALUES ($1, $1, 'cex')`, id); err != nil {
			t.Fatalf("seed venue %s: %v", id, err)
		}
	}
	return New(pool, map[string]float64{}), pool
}

func jobExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("%v\n%s", err, sql)
	}
}

func jobMarket(t *testing.T, pool *pgxpool.Pool, venue, symbol, base, class string) {
	t.Helper()
	jobExec(t, pool, `
		INSERT INTO markets (venue_id, venue_symbol, base, asset_class, quote, multiplier, dex,
		                     interval_hours, max_leverage, last_seen)
		VALUES ($1, $2, $3, $4, 'USDT', 1, NULL, 8, NULL, now())
		ON CONFLICT DO NOTHING`, venue, symbol, base, class)
}

func jobLatest(t *testing.T, pool *pgxpool.Pool, venue, symbol, base, class string, observedAt time.Time,
	rate, apr, mark float64, openInterest *float64, volume *float64) {
	t.Helper()
	jobExec(t, pool, `
		INSERT INTO market_latest (venue_id, venue_symbol, base, asset_class, quote, observed_at, rate,
		                           basis_hours, apr, interval_hours, next_funding_at, kind, mark_price,
		                           index_price, open_interest_usd, volume_24h_usd)
		VALUES ($1, $2, $3, $4, 'USDT', $5, $6, 8, $7, 8, NULL, 'predicted', $8, $8, $9, $10)`,
		venue, symbol, base, class, observedAt, rate, apr, mark, openInterest, volume)
}

func jobEvent(t *testing.T, pool *pgxpool.Pool, venue, symbol string, settledAtMs int64, rate float64) {
	t.Helper()
	jobExec(t, pool, `
		INSERT INTO funding_events (settled_at, venue_id, venue_symbol, rate, basis_hours, mark_price, source)
		VALUES ($1, $2, $3, $4, 8, NULL, 'history')
		ON CONFLICT DO NOTHING`, time.UnixMilli(settledAtMs).UTC(), venue, symbol, rate)
}

// jobSnapshot seeds one funding_snapshots row. mark, index and openInterest are pointers because
// their coverage genuinely differs per venue: HTX and BitMart publish no mark in any bulk call, so
// a null mark is a real shape the price rollup has to fold rather than an invalid input.
func jobSnapshot(t *testing.T, pool *pgxpool.Pool, venue, symbol string, observedAtMs int64,
	mark, index, openInterest *float64) {
	t.Helper()
	jobExec(t, pool, `
		INSERT INTO funding_snapshots (observed_at, venue_id, venue_symbol, rate, basis_hours,
		                               interval_hours, next_funding_at, kind, mark_price, index_price,
		                               open_interest_usd, volume_24h_usd)
		VALUES ($1, $2, $3, 0.0001, 8, 8, NULL, 'predicted', $4, $5, $6, NULL)`,
		time.UnixMilli(observedAtMs).UTC(), venue, symbol, mark, index, openInterest)
}

func jobNull(t *testing.T, label string, got *float64) {
	t.Helper()
	if got != nil {
		t.Errorf("%s: got %v, want NULL", label, *got)
	}
}

func jobCount(t *testing.T, label string, got int, err error, floor int) {
	t.Helper()
	if err != nil {
		t.Fatalf("%s: %v", label, err)
	}
	if got < floor {
		t.Fatalf("%s returned %d, want at least %d", label, got, floor)
	}
}

func jobClose(t *testing.T, label string, got *float64, want float64, digits int) {
	t.Helper()
	if got == nil {
		t.Errorf("%s: got NULL, want %v", label, want)
		return
	}
	if !(math.Abs(*got-want) < math.Pow(10, -float64(digits))/2) {
		t.Errorf("%s: got %.15g, want %.15g", label, *got, want)
	}
}

func jobF(v float64) *float64 { return &v }

func jobNow() int64 { return time.Now().UnixMilli() }

func TestRefreshFundingStatsTimeWeightedWindows(t *testing.T) {
	store, pool := jobFresh(t, "it-a")
	ctx := context.Background()
	symbol := "SCRUSDT"
	jobMarket(t, pool, "it-a", symbol, "SCR", "crypto")
	settledNow := jobNow() / jobHour * jobHour
	jobEvent(t, pool, "it-a", symbol, settledNow-8*jobHour, 0.0001)
	jobEvent(t, pool, "it-a", symbol, settledNow-16*jobHour, 0.0001)
	jobEvent(t, pool, "it-a", symbol, settledNow-3*24*jobHour, 0.0004)

	n, err := store.RefreshFundingStats(ctx)
	jobCount(t, "RefreshFundingStats", n, err, 1)

	var apr24, apr7 *float64
	var s24, s7 int
	if err := pool.QueryRow(ctx, `
		SELECT apr_24h, apr_7d, settlements_24h, settlements_7d FROM market_funding_stats
		WHERE venue_id = 'it-a' AND venue_symbol = $1`, symbol).Scan(&apr24, &apr7, &s24, &s7); err != nil {
		t.Fatal(err)
	}
	if s24 != 2 || s7 != 3 {
		t.Errorf("settlements %d/%d, want 2/3", s24, s7)
	}
	jobClose(t, "apr_24h", apr24, 0.0001/8*876000, 6)
	jobClose(t, "apr_7d", apr7, 0.0006/24*876000, 6)
}

func TestRefreshDailyFundingFeedsTheLongWindows(t *testing.T) {
	store, pool := jobFresh(t, "it-a")
	ctx := context.Background()
	symbol := "ITDAILY"
	jobMarket(t, pool, "it-a", symbol, "IT", "crypto")
	now := jobNow()
	jobEvent(t, pool, "it-a", symbol, now-5*jobDay, 0.0003)
	jobEvent(t, pool, "it-a", symbol, now-20*jobDay, 0.0001)
	// Inside 60 days but outside 30, so it must move only one of the two windows.
	jobEvent(t, pool, "it-a", symbol, now-45*jobDay, 0.0008)

	n, err := store.RefreshDailyFunding(ctx, DailyFundingLookbackDays)
	jobCount(t, "RefreshDailyFunding", n, err, 3)
	n, err = store.RefreshLongWindows(ctx)
	jobCount(t, "RefreshLongWindows", n, err, 1)

	var apr30, apr60 *float64
	var at *time.Time
	if err := pool.QueryRow(ctx, `
		SELECT apr_30d, apr_60d, long_windows_at FROM market_funding_stats
		WHERE venue_id = 'it-a' AND venue_symbol = $1`, symbol).Scan(&apr30, &apr60, &at); err != nil {
		t.Fatal(err)
	}
	jobClose(t, "apr_30d", apr30, (0.0003+0.0001)/16*876_000, 6)
	jobClose(t, "apr_60d", apr60, (0.0003+0.0001+0.0008)/24*876_000, 6)
	if at == nil {
		t.Error("long_windows_at is NULL")
	}

	rows, err := pool.Query(ctx, `
		SELECT rate_sum, basis_hours_sum, settlements FROM market_funding_daily
		WHERE venue_id = 'it-a' AND venue_symbol = $1 ORDER BY day`, symbol)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var days []struct {
		rate, hours float64
		settlements int
	}
	for rows.Next() {
		var d struct {
			rate, hours float64
			settlements int
		}
		if err := rows.Scan(&d.rate, &d.hours, &d.settlements); err != nil {
			t.Fatal(err)
		}
		days = append(days, d)
	}
	if len(days) != 3 {
		t.Fatalf("%d day rows, want 3", len(days))
	}
	if days[0].rate != 0.0008 || days[0].hours != 8 || days[0].settlements != 1 {
		t.Errorf("oldest day %+v, want rate 0.0008, 8 hours, 1 settlement", days[0])
	}
}

func TestRefreshHourlyFundingKeepsOnlyTheRetainedWindow(t *testing.T) {
	store, pool := jobFresh(t, "it-a")
	ctx := context.Background()
	symbol := "ITHOURLY"
	jobMarket(t, pool, "it-a", symbol, "IT", "crypto")
	hour := jobNow()/jobHour*jobHour - 2*jobHour
	jobEvent(t, pool, "it-a", symbol, hour+5*60_000, 0.0001)
	jobEvent(t, pool, "it-a", symbol, hour+50*60_000, 0.0002)
	jobEvent(t, pool, "it-a", symbol, hour-8*jobHour, -0.0003)
	// Past the 8-day retention, so it must never be folded in.
	jobEvent(t, pool, "it-a", symbol, hour-9*jobDay, 0.009)

	n, err := store.RefreshHourlyFunding(ctx, HourlyFundingRetainDays)
	jobCount(t, "RefreshHourlyFunding", n, err, 2)

	rows, err := pool.Query(ctx, `
		SELECT hour, rate_sum, basis_hours_sum, settlements FROM market_funding_hourly
		WHERE venue_id = 'it-a' AND venue_symbol = $1 ORDER BY hour`, symbol)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	type hourRow struct {
		at          time.Time
		rate, hours float64
		settlements int
	}
	var hours []hourRow
	for rows.Next() {
		var h hourRow
		if err := rows.Scan(&h.at, &h.rate, &h.hours, &h.settlements); err != nil {
			t.Fatal(err)
		}
		hours = append(hours, h)
	}
	if len(hours) != 2 {
		t.Fatalf("%d hour rows, want 2", len(hours))
	}
	if hours[0].rate != -0.0003 || hours[0].hours != 8 || hours[0].settlements != 1 {
		t.Errorf("first hour %+v", hours[0])
	}
	if hours[1].at.UnixMilli() != hour {
		t.Errorf("second hour keyed %v, want %v", hours[1].at.UnixMilli(), hour)
	}
	jobClose(t, "summed rate", &hours[1].rate, 0.0003, 12)
	if hours[1].hours != 16 || hours[1].settlements != 2 {
		t.Errorf("second hour %+v, want 16 hours and 2 settlements", hours[1])
	}
}

func TestRefreshPriceHourlyFoldsMeansEndpointsAndCoverage(t *testing.T) {
	store, pool := jobFresh(t, "it-a")
	ctx := context.Background()
	symbol := "ITPRICE"
	jobMarket(t, pool, "it-a", symbol, "IT", "crypto")
	// The previous whole hour, so every sample sits inside it and inside the lookback.
	hour := jobNow()/jobHour*jobHour - jobHour
	// Three reads: mark rises, index flat, open interest rises. The last read is at +50m.
	jobSnapshot(t, pool, "it-a", symbol, hour+10*60_000, jobF(100), jobF(100), jobF(1000))
	jobSnapshot(t, pool, "it-a", symbol, hour+30*60_000, jobF(102), jobF(100), jobF(2000))
	jobSnapshot(t, pool, "it-a", symbol, hour+50*60_000, jobF(104), jobF(100), jobF(3000))

	n, err := store.RefreshPriceHourly(ctx, PriceHourlyLookbackHours, PriceHourlyRetainDays)
	jobCount(t, "RefreshPriceHourly", n, err, 1)

	var samples, markSamples, indexSamples, oiSamples, basisSamples int
	var markAvg, markLast, indexAvg, oiAvg, oiLast, basisAvg *float64
	if err := pool.QueryRow(ctx, `
		SELECT samples, mark_samples, index_samples, oi_samples, basis_samples,
		       mark_avg, mark_last, index_avg, oi_avg, oi_last, basis_avg
		FROM market_price_hourly
		WHERE venue_id = 'it-a' AND venue_symbol = $1 AND hour = $2`,
		symbol, time.UnixMilli(hour).UTC()).Scan(&samples, &markSamples, &indexSamples, &oiSamples,
		&basisSamples, &markAvg, &markLast, &indexAvg, &oiAvg, &oiLast, &basisAvg); err != nil {
		t.Fatal(err)
	}
	if samples != 3 || markSamples != 3 || indexSamples != 3 || oiSamples != 3 || basisSamples != 3 {
		t.Errorf("samples=%d mark=%d index=%d oi=%d basis=%d, want 3 each",
			samples, markSamples, indexSamples, oiSamples, basisSamples)
	}
	jobClose(t, "mark_avg", markAvg, 102, 9)
	jobClose(t, "index_avg", indexAvg, 100, 9)
	jobClose(t, "oi_avg", oiAvg, 2000, 6)
	// The endpoints are the hour's edge, not its mean: flow and price change need them, and neither
	// is recoverable from an average.
	jobClose(t, "mark_last", markLast, 104, 9)
	jobClose(t, "oi_last", oiLast, 3000, 6)
	// avg(mark - index) per sample, which here equals avg(mark) - avg(index) only because coverage
	// happens to be complete. The next test is the case where it is not.
	jobClose(t, "basis_avg", basisAvg, 2, 9)
}

func TestRefreshPriceHourlyLeavesBasisNullWhereTheVenuePublishesNoMark(t *testing.T) {
	store, pool := jobFresh(t, "it-a")
	ctx := context.Background()
	symbol := "ITNOMARK"
	jobMarket(t, pool, "it-a", symbol, "IT", "crypto")
	hour := jobNow()/jobHour*jobHour - jobHour
	// The HTX and BitMart shape: an index in every bulk call and never a mark.
	jobSnapshot(t, pool, "it-a", symbol, hour+10*60_000, nil, jobF(50), jobF(500))
	jobSnapshot(t, pool, "it-a", symbol, hour+40*60_000, nil, jobF(52), jobF(700))

	n, err := store.RefreshPriceHourly(ctx, PriceHourlyLookbackHours, PriceHourlyRetainDays)
	jobCount(t, "RefreshPriceHourly", n, err, 1)

	var samples, markSamples, indexSamples, basisSamples int
	var markAvg, markLast, indexAvg, indexLast, basisAvg *float64
	if err := pool.QueryRow(ctx, `
		SELECT samples, mark_samples, index_samples, basis_samples,
		       mark_avg, mark_last, index_avg, index_last, basis_avg
		FROM market_price_hourly
		WHERE venue_id = 'it-a' AND venue_symbol = $1 AND hour = $2`,
		symbol, time.UnixMilli(hour).UTC()).Scan(&samples, &markSamples, &indexSamples, &basisSamples,
		&markAvg, &markLast, &indexAvg, &indexLast, &basisAvg); err != nil {
		t.Fatal(err)
	}
	// The hour is folded and its index history kept; only the mark-derived columns are absent, and
	// they are absent rather than zero, so a chart can say "uncomputable here" instead of drawing a
	// flat zero basis.
	if samples != 2 || indexSamples != 2 {
		t.Errorf("samples=%d index_samples=%d, want 2 each", samples, indexSamples)
	}
	if markSamples != 0 || basisSamples != 0 {
		t.Errorf("mark_samples=%d basis_samples=%d, want 0 each", markSamples, basisSamples)
	}
	jobNull(t, "mark_avg", markAvg)
	jobNull(t, "mark_last", markLast)
	jobNull(t, "basis_avg", basisAvg)
	jobClose(t, "index_avg", indexAvg, 51, 9)
	jobClose(t, "index_last", indexLast, 52, 9)
}

func TestRefreshPriceHourlyFoldsOnlyTheLookbackAndExpiresPastRetention(t *testing.T) {
	store, pool := jobFresh(t, "it-a")
	ctx := context.Background()
	symbol := "ITRETAIN"
	jobMarket(t, pool, "it-a", symbol, "IT", "crypto")
	hour := jobNow()/jobHour*jobHour - jobHour

	// Already stored, and older than retention: it must be swept.
	jobExec(t, pool, `
		INSERT INTO market_price_hourly (venue_id, venue_symbol, hour, samples, mark_samples,
		                                 index_samples, oi_samples, basis_samples, mark_avg)
		VALUES ('it-a', $1, now() - interval '401 days', 60, 60, 60, 60, 60, 7)`, symbol)
	// Ten hours back is outside a three-hour lookback, so this must NOT be folded -- a wider window
	// would scan tens of millions of snapshot rows every hour for no new information.
	jobSnapshot(t, pool, "it-a", symbol, hour-10*jobHour, jobF(1), jobF(1), jobF(10))
	jobSnapshot(t, pool, "it-a", symbol, hour+60_000, jobF(5), jobF(5), jobF(50))

	n, err := store.RefreshPriceHourly(ctx, PriceHourlyLookbackHours, PriceHourlyRetainDays)
	jobCount(t, "RefreshPriceHourly", n, err, 1)

	rows, err := pool.Query(ctx, `
		SELECT hour, mark_avg FROM market_price_hourly
		WHERE venue_id = 'it-a' AND venue_symbol = $1 ORDER BY hour`, symbol)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	type priceRow struct {
		at   time.Time
		mark *float64
	}
	var kept []priceRow
	for rows.Next() {
		var r priceRow
		if err := rows.Scan(&r.at, &r.mark); err != nil {
			t.Fatal(err)
		}
		kept = append(kept, r)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if len(kept) != 1 {
		t.Fatalf("%d rows kept, want 1 (the expired row swept, the pre-lookback hour never folded)", len(kept))
	}
	if kept[0].at.UnixMilli() != hour {
		t.Errorf("kept hour %v, want %v", kept[0].at.UnixMilli(), hour)
	}
	jobClose(t, "mark_avg", kept[0].mark, 5, 9)
}

func TestRefreshStabilityScoresChargingDaysShrunkBySampleSize(t *testing.T) {
	store, pool := jobFresh(t, "it-a")
	ctx := context.Background()
	now := jobNow()
	steady, flippy, sparse, negative, dead := "ITSTEADY", "ITFLIPPY", "ITSPARSE", "ITNEG", "ITDEAD"
	for _, sym := range []string{steady, flippy, sparse, negative, dead} {
		jobMarket(t, pool, "it-a", sym, "IT", "crypto")
	}
	for i := int64(1); i <= 20; i++ {
		jobEvent(t, pool, "it-a", steady, now-i*jobDay, 0.0001)
		rate := -0.0001
		if i%2 == 0 {
			rate = 0.0001
		}
		jobEvent(t, pool, "it-a", flippy, now-i*jobDay, rate)
		jobEvent(t, pool, "it-a", negative, now-i*jobDay, -0.0002)
		jobEvent(t, pool, "it-a", dead, now-i*jobDay, 0)
	}
	for i := int64(1); i <= 3; i++ {
		jobEvent(t, pool, "it-a", sparse, now-i*jobDay, 0.0005)
	}

	n, err := store.RefreshDailyFunding(ctx, DailyFundingLookbackDays)
	jobCount(t, "RefreshDailyFunding", n, err, 83)
	n, err = store.RefreshStability(ctx)
	jobCount(t, "RefreshStability", n, err, 4)

	rows, err := pool.Query(ctx, `
		SELECT venue_symbol, stability_30d, stability_days FROM market_funding_stats
		WHERE venue_id = 'it-a'`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	type stab struct {
		score *float64
		days  *int
	}
	by := map[string]stab{}
	for rows.Next() {
		var sym string
		var r stab
		if err := rows.Scan(&sym, &r.score, &r.days); err != nil {
			t.Fatal(err)
		}
		by[sym] = r
	}

	// A market that charges nothing has no persistence to measure.
	if _, ok := by[dead]; ok {
		t.Error("a market that never charges must get no stability row")
	}
	jobClose(t, "steady", by[steady].score, 25.0/30, 6)
	if by[steady].days == nil || *by[steady].days != 20 {
		t.Errorf("steady stability_days %v, want 20", by[steady].days)
	}
	jobClose(t, "negative", by[negative].score, 25.0/30, 6)
	jobClose(t, "flippy", by[flippy].score, 15.0/30, 6)
	jobClose(t, "sparse", by[sparse].score, 8.0/13, 6)
	if by[sparse].score != nil && by[steady].score != nil && !(*by[sparse].score < *by[steady].score) {
		t.Error("three consistent days must not outrank twenty")
	}
}

func TestRefreshIdentityChecksScaleMismatchAndUnverified(t *testing.T) {
	store, pool := jobFresh(t, "it-a")
	ctx := context.Background()
	// Timestamps come from the database clock: the job compares against now() server-side.
	var dbNow time.Time
	if err := pool.QueryRow(ctx, `SELECT now()`).Scan(&dbNow); err != nil {
		t.Fatal(err)
	}

	base := "ITID"
	anchorSym, scaleSym, missSym, frozenSym := base+"-ANCHOR", base+"-SCALE", base+"-MISS", base+"-FROZEN"
	const bars = 90
	anchorAt := func(i int) float64 { return 100 + math.Floor(float64(i)/2)*0.05 }
	missAt := func(i int) float64 { return 10_000 + math.Floor(float64(i+1)/2)*7 }

	for _, sym := range []string{anchorSym, scaleSym, missSym, frozenSym} {
		jobMarket(t, pool, "it-a", sym, base, "crypto")
	}
	for i := 0; i < bars; i++ {
		observedAt := dbNow.Add(-time.Duration(bars-i) * time.Minute)
		for _, bar := range []struct {
			sym  string
			mark float64
		}{
			{anchorSym, anchorAt(i)},
			{scaleSym, anchorAt(i) / 10},
			{missSym, missAt(i)},
			{frozenSym, 1022},
		} {
			jobExec(t, pool, `
				INSERT INTO funding_snapshots (observed_at, venue_id, venue_symbol, rate, basis_hours,
				                               interval_hours, next_funding_at, kind, mark_price,
				                               index_price, open_interest_usd, volume_24h_usd)
				VALUES ($1, 'it-a', $2, 0.0001, 8, 8, NULL, 'predicted', $3, $3, NULL, NULL)`,
				observedAt, bar.sym, bar.mark)
		}
	}
	last := bars - 1
	latestAt := dbNow.Add(-30 * time.Second)
	jobLatest(t, pool, "it-a", anchorSym, base, "crypto", latestAt, 0.0001, 10.95, anchorAt(last), jobF(10_000_000), nil)
	jobLatest(t, pool, "it-a", scaleSym, base, "crypto", latestAt, 0.0001, 10.95, anchorAt(last)/10, jobF(1_000_000), nil)
	jobLatest(t, pool, "it-a", missSym, base, "crypto", latestAt, 0.0001, 10.95, missAt(last), jobF(500_000), nil)
	jobLatest(t, pool, "it-a", frozenSym, base, "crypto", latestAt, 0.0001, 10.95, 1022, jobF(100_000), nil)

	n, err := store.RefreshIdentityChecks(ctx, IdentityCheckWindowHours)
	jobCount(t, "RefreshIdentityChecks", n, err, 3)

	type check struct {
		anchor   string
		verdict  string
		ratio    float64
		exponent *int
		corr     *float64
		shared   int
		moves    int
	}
	read := func() map[string]check {
		rows, err := pool.Query(ctx, `
			SELECT venue_symbol, anchor_venue_symbol, verdict, price_ratio, scale_exponent,
			       return_corr, shared_minutes, member_moves
			FROM market_identity_checks WHERE base = $1`, base)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		by := map[string]check{}
		for rows.Next() {
			var sym string
			var c check
			if err := rows.Scan(&sym, &c.anchor, &c.verdict, &c.ratio, &c.exponent, &c.corr, &c.shared, &c.moves); err != nil {
				t.Fatal(err)
			}
			by[sym] = c
		}
		return by
	}
	by := read()

	if _, ok := by[anchorSym]; ok {
		t.Error("the anchor is never reported as diverging from itself")
	}
	scale := by[scaleSym]
	if scale.anchor != anchorSym || scale.shared != bars || scale.verdict != "scale" ||
		scale.exponent == nil || *scale.exponent != -1 {
		t.Errorf("scale row %+v, want scale at -1 against %s over %d minutes", scale, anchorSym, bars)
	}
	jobClose(t, "scale corr", scale.corr, 1, 6)

	miss := by[missSym]
	if miss.verdict != "mismatch" || miss.exponent != nil || !(miss.ratio > 100) || miss.corr == nil || !(*miss.corr < 0.5) {
		t.Errorf("miss row %+v, want a mismatch above 100x with corr below 0.5", miss)
	}

	frozen := by[frozenSym]
	if frozen.verdict != "unverified" || frozen.corr != nil || frozen.moves != 0 {
		t.Errorf("frozen row %+v, want unverified with NULL corr and 0 moves", frozen)
	}

	// Replaced wholesale: a market that comes back into line vanishes from the report.
	jobExec(t, pool, `UPDATE market_latest SET mark_price = $1 WHERE venue_id = 'it-a' AND venue_symbol = $2`,
		anchorAt(last), missSym)
	if _, err := store.RefreshIdentityChecks(ctx, IdentityCheckWindowHours); err != nil {
		t.Fatal(err)
	}
	after := read()
	if _, ok := after[missSym]; ok {
		t.Error("a market back in line must vanish from the report")
	}
	if _, ok := after[scaleSym]; !ok {
		t.Error("the scale row must survive the replace")
	}
}

func TestRefreshPairBacktestsReplaysBothLegsAndStoresTheRisk(t *testing.T) {
	store, pool := jobFresh(t, "it-a", "it-b")
	ctx := context.Background()
	now := jobNow()
	base := "SCRB"
	longSym, shortSym := base+"USDT", base+"-PERP"
	jobMarket(t, pool, "it-a", longSym, base, "crypto")
	jobMarket(t, pool, "it-b", shortSym, base, "crypto")
	observed := time.UnixMilli(now)
	jobLatest(t, pool, "it-a", longSym, base, "crypto", observed, -0.0001, -0.0001/8*876000, 10, jobF(5_000_000), jobF(1_000_000))
	jobLatest(t, pool, "it-b", shortSym, base, "crypto", observed, 0.0001, 0.0001/8*876000, 10, jobF(500_000), jobF(1_000_000))

	for i := int64(0); i < 21; i++ {
		settledAt := now - (i/3)*jobDay - (i%3)*8*jobHour - 60_000
		jobEvent(t, pool, "it-a", longSym, settledAt, -0.0001)
		jobEvent(t, pool, "it-b", shortSym, settledAt, 0.0001)
	}
	if _, err := store.RefreshDailyFunding(ctx, DailyFundingLookbackDays); err != nil {
		t.Fatal(err)
	}

	n, err := store.RefreshPairBacktests(ctx, PairBacktestSizeUSD, PairBacktestRetainDays)
	jobCount(t, "RefreshPairBacktests", n, err, 1)

	var longVenue, shortVenue string
	var net float64
	var longSettled, shortSettled, longCharge, shortCharge int
	var thinner, worst *float64
	if err := pool.QueryRow(ctx, `
		SELECT long_venue_id, short_venue_id, net_funding_usd, long_settlements, short_settlements,
		       long_charge_days, short_charge_days, thinner_leg_oi_usd, worst_leg_abs_apr
		FROM market_pair_backtests
		WHERE asset = $1 AND run_day = (SELECT max(run_day) FROM market_pair_backtests)`, base).
		Scan(&longVenue, &shortVenue, &net, &longSettled, &shortSettled, &longCharge, &shortCharge, &thinner, &worst); err != nil {
		t.Fatal(err)
	}
	if longVenue != "it-a" || shortVenue != "it-b" {
		t.Errorf("legs %s/%s, want it-a/it-b", longVenue, shortVenue)
	}
	// 21 settlements a leg at 0.01% on $10,000 pays $1 each, both legs, so $42 over the window.
	jobClose(t, "net funding", &net, 42, 6)
	if longSettled != 21 || shortSettled != 21 {
		t.Errorf("settlements %d/%d, want 21/21", longSettled, shortSettled)
	}
	if longCharge < 7 || shortCharge < 7 {
		t.Errorf("charge days %d/%d, want at least 7 each", longCharge, shortCharge)
	}
	jobClose(t, "thinner leg", thinner, 500_000, 6)
	if worst == nil || !(*worst > 0) {
		t.Errorf("worst leg APR %v, want > 0", worst)
	}
}

func TestRefreshRankedPairsPerAssetClassAndHysteresisHolds(t *testing.T) {
	crypto := []string{"it-c1", "it-c2", "it-c3"}
	equity := []string{"it-e1", "it-e2"}
	store, pool := jobFresh(t, append(append([]string{}, crypto...), equity...)...)
	ctx := context.Background()
	rankBase := "ITRANK"
	symbolOf := func(v string) string { return rankBase + "-" + v[len(v)-2:] }
	aprOf := map[string]float64{"it-c1": -20, "it-c2": 5, "it-c3": 40, "it-e1": -3, "it-e2": 9}
	type leg struct {
		venue, class string
		mark         float64
	}
	var legs []leg
	for _, v := range crypto {
		legs = append(legs, leg{v, "crypto", 100})
	}
	for _, v := range equity {
		legs = append(legs, leg{v, "equity", 7_000})
	}

	settledAt := jobNow() / jobHour * jobHour
	observed := time.Now().Add(-30 * time.Second)
	for _, l := range legs {
		sym := symbolOf(l.venue)
		jobMarket(t, pool, l.venue, sym, rankBase, l.class)
		oi := 2_000_000.0
		if l.venue == "it-c2" {
			oi = 50_000_000
		}
		jobLatest(t, pool, l.venue, sym, rankBase, l.class, observed, 0.0001, aprOf[l.venue], l.mark, &oi, nil)
		for i := int64(0); i < 21; i++ {
			jobEvent(t, pool, l.venue, sym, settledAt-i*8*jobHour, aprOf[l.venue]/876000*8)
		}
		for d := int64(0); d < 7; d++ {
			day := time.UnixMilli(jobNow() - d*jobDay).UTC().Format("2006-01-02")
			jobExec(t, pool, `
				INSERT INTO market_funding_daily (venue_id, venue_symbol, day, rate_sum, basis_hours_sum, settlements)
				VALUES ($1, $2, $3::text::date, $4, 24, 3) ON CONFLICT DO NOTHING`,
				l.venue, sym, day, aprOf[l.venue]/876000*24)
		}
	}

	run := func() {
		t.Helper()
		n, err := store.RefreshRankedPairs(ctx, RankedPairsSizeUSD, RankedPairsRetainDays, core.DefaultParticipation, RankedPairsSwitchCostPerDollar)
		jobCount(t, "RefreshRankedPairs", n, err, 4)
	}
	type row struct {
		class, long, short                   string
		widest, hysteresis, capacity, wasInc bool
		switchCost                           *float64
	}
	read := func() []row {
		rows, err := pool.Query(ctx, `
			SELECT asset_class, long_venue_id, short_venue_id, chosen_widest, chosen_hysteresis,
			       chosen_capacity, was_incumbent, switch_cost_usd
			FROM market_pair_candidates WHERE asset = $1`, rankBase)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		var out []row
		for rows.Next() {
			var r row
			if err := rows.Scan(&r.class, &r.long, &r.short, &r.widest, &r.hysteresis, &r.capacity, &r.wasInc, &r.switchCost); err != nil {
				t.Fatal(err)
			}
			out = append(out, r)
		}
		return out
	}
	inClass := func(v, class string) bool {
		list := crypto
		if class == "equity" {
			list = equity
		}
		for _, x := range list {
			if x == v {
				return true
			}
		}
		return false
	}

	run()
	first := read()
	// Four candidates, not ten: the two classes never pair with one another.
	if len(first) != 4 {
		t.Fatalf("%d candidates, want 4", len(first))
	}
	counts := map[string]int{}
	for _, r := range first {
		counts[r.class]++
		if !inClass(r.long, r.class) || !inClass(r.short, r.class) {
			t.Errorf("row %+v pairs across asset classes", r)
		}
		if r.wasInc {
			t.Errorf("row %+v is an incumbent on the first run", r)
		}
	}
	if counts["crypto"] != 3 || counts["equity"] != 1 {
		t.Errorf("per class %v, want crypto 3 and equity 1", counts)
	}
	for _, class := range []string{"crypto", "equity"} {
		w, h, c := 0, 0, 0
		for _, r := range first {
			if r.class != class {
				continue
			}
			if r.widest {
				w++
			}
			if r.hysteresis {
				h++
			}
			if r.capacity {
				c++
			}
		}
		if w != 1 || h != 1 || c != 1 {
			t.Errorf("%s winners widest %d hysteresis %d capacity %d, want exactly one each", class, w, h, c)
		}
	}
	var heldBefore row
	for _, r := range first {
		if r.class == "crypto" && r.widest {
			got := []string{r.long, r.short}
			sort.Strings(got)
			if got[0] != "it-c1" || got[1] != "it-c3" {
				t.Errorf("widest crypto legs %v, want it-c1 and it-c3", got)
			}
		}
		if r.class == "crypto" && r.hysteresis {
			heldBefore = r
		}
	}

	// Second run over unchanged evidence: hysteresis must HOLD the same pair as the incumbent.
	run()
	for _, r := range read() {
		if r.class != "crypto" || !r.hysteresis {
			continue
		}
		if r.long != heldBefore.long || r.short != heldBefore.short {
			t.Errorf("held %s/%s, want %s/%s", r.long, r.short, heldBefore.long, heldBefore.short)
		}
		if !r.wasInc {
			t.Error("the held pair must be marked as the incumbent")
		}
		if r.switchCost != nil {
			t.Errorf("switch cost %v, want NULL for a pair that was held", *r.switchCost)
		}
	}
}
