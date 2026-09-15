package store

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Integration tests against a real PostgreSQL instance carrying the real migrations.
//
// WHY THESE EXIST AT ALL. Every other package here is covered by unit tests, and this one was not:
// it compiled, and no assertion had ever executed its SQL. This repository has the cautionary tale
// written down — /v1/pairs/:asset/backtest "shipped green on 60 tests and failed on every production
// call", because the tests faked the data source and nothing ever ran the query. A store verified by
// reading is a store not verified.
//
// Skipped unless AIRATES_TEST_DSN is set, so the ordinary suite still runs with no database. Point
// it at a throwaway instance with the migrations applied:
//
//	AIRATES_TEST_DSN='postgres://postgres@127.0.0.1:55433/airates_it?sslmode=disable' go test ./internal/store/
//
// WHAT THEY DO NOT COVER: the production schema is TimescaleDB, and a stock server cannot create
// hypertables, compression or retention policies. Those four statements are skipped when the
// migrations are applied here, so partitioning, compression and retention remain unverified. What
// is verified is everything the store's SQL actually touches: column lists, types, conflict targets,
// the observed_at guard, unnest arity, and NULL versus zero.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("AIRATES_TEST_DSN")
	if dsn == "" {
		t.Skip("set AIRATES_TEST_DSN to run store integration tests")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("parse AIRATES_TEST_DSN: %v", err)
	}
	// The same UTC session the collector pins in main.go. Without it the job tests depend on the test
	// server's time zone: at +07 the 7-day charging floor sees six days and the pair backtest test fails.
	cfg.ConnConfig.RuntimeParams["timezone"] = "UTC"
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// freshStore truncates the tables this package writes, so each test starts from a known state and
// tests cannot leak into one another. The TypeScript side learned this the hard way: its shared
// integration schema accumulated fixtures until "two assertions broke today purely because a later
// fixture seeded rows an earlier test assumed absent".
func freshStore(t *testing.T) *Store {
	t.Helper()
	pool := testPool(t)
	_, err := pool.Exec(context.Background(),
		`TRUNCATE market_latest, funding_snapshots, funding_events, collector_runs, markets, venues CASCADE`)
	if err != nil {
		t.Fatalf("truncate: %v", err)
	}
	// markets.venue_id references venues(id), so the venue has to exist before any market does.
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO venues (id, name, type) VALUES ('bybit','Bybit','cex'), ('okx','OKX','cex')`); err != nil {
		t.Fatalf("seed venues: %v", err)
	}
	return New(pool, map[string]float64{})
}

func f(v float64) *float64 { return &v }
func s(v string) *string   { return &v }

func snapshot(symbol string, observedAt int64, rate float64, opts ...func(*core.FundingSnapshot)) core.FundingSnapshot {
	snap := core.FundingSnapshot{
		MarketRef: core.MarketRef{
			VenueID: "bybit", VenueSymbol: symbol, Base: "BTC",
			AssetClass: core.ClassCrypto, Quote: s("USDT"), Multiplier: 1,
		},
		ObservedAt: observedAt,
		Rate:       rate,
		BasisHours: 8,
		Kind:       core.KindPredicted,
		MarkPrice:  f(77766.7),
	}
	for _, opt := range opts {
		opt(&snap)
	}
	return snap
}

func TestRecordBatchWritesEveryTableInOneTransaction(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.UnixMilli(1_789_147_120_000).UTC()

	batch := core.SnapshotBatch{
		Snapshots: []core.FundingSnapshot{
			snapshot("BTCUSDT", at.UnixMilli(), 0.00004936, func(sn *core.FundingSnapshot) {
				sn.IntervalHours = f(8)
				sn.OpenInterestUSD = f(4142076932.53)
				sn.BestBid = f(77766.7)
				sn.BestBidSizeUSD = f(14075.77)
			}),
		},
		Settled: []core.FundingEvent{{
			MarketRef: core.MarketRef{
				VenueID: "bybit", VenueSymbol: "BTCUSDT", Base: "BTC",
				AssetClass: core.ClassCrypto, Quote: s("USDT"), Multiplier: 1,
			},
			SettledAt: at.UnixMilli() - 8*3_600_000, Rate: 0.00002005, BasisHours: 8,
		}},
	}

	if err := db.RecordBatch(ctx, "bybit", batch, at); err != nil {
		t.Fatalf("RecordBatch: %v", err)
	}

	pool := testPool(t)
	for _, c := range []struct {
		table string
		want  int
	}{
		{"markets", 1}, {"funding_snapshots", 1}, {"market_latest", 1}, {"funding_events", 1},
	} {
		var n int
		if err := pool.QueryRow(ctx, "select count(*) from "+c.table).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", c.table, err)
		}
		if n != c.want {
			t.Errorf("%s: got %d rows, want %d", c.table, n, c.want)
		}
	}

	// The derived column: apr must be the annualised rate, not the raw one. A unit test cannot
	// catch a mistake here because nothing but the database computes it.
	var apr, rate float64
	var assetClass string
	var bidSize *float64
	if err := pool.QueryRow(ctx,
		`select apr, rate, asset_class, best_bid_size_usd from market_latest`).
		Scan(&apr, &rate, &assetClass, &bidSize); err != nil {
		t.Fatalf("read market_latest: %v", err)
	}
	wantAPR := 0.00004936 / 8 * 8760 * 100
	if diff := apr - wantAPR; diff > 1e-9 || diff < -1e-9 {
		t.Errorf("apr: got %v, want %v", apr, wantAPR)
	}
	if assetClass != "crypto" {
		t.Errorf("asset_class: got %q, want crypto", assetClass)
	}
	if bidSize == nil || *bidSize != 14075.77 {
		t.Errorf("best_bid_size_usd: got %v, want 14075.77", bidSize)
	}
}

func TestMarketLatestGuardRejectsAnOlderRow(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	newer := time.UnixMilli(1_789_147_120_000).UTC()
	older := newer.Add(-time.Hour)

	// The guard is `WHERE EXCLUDED.observed_at >= market_latest.observed_at`. It exists so a slow
	// cycle landing out of order cannot overwrite fresher numbers with staler ones — and it fails
	// silently if wrong, because both writes succeed either way.
	if err := db.RecordBatch(ctx, "bybit",
		core.SnapshotBatch{Snapshots: []core.FundingSnapshot{snapshot("BTCUSDT", newer.UnixMilli(), 0.001)}},
		newer); err != nil {
		t.Fatalf("newer write: %v", err)
	}
	if err := db.RecordBatch(ctx, "bybit",
		core.SnapshotBatch{Snapshots: []core.FundingSnapshot{snapshot("BTCUSDT", older.UnixMilli(), 0.999)}},
		older); err != nil {
		t.Fatalf("older write: %v", err)
	}

	var rate float64
	if err := testPool(t).QueryRow(ctx, `select rate from market_latest`).Scan(&rate); err != nil {
		t.Fatalf("read: %v", err)
	}
	if rate != 0.001 {
		t.Errorf("rate: got %v, want 0.001 — the older cycle overwrote a newer row", rate)
	}

	// The snapshot history is append-only, so BOTH cycles are still recorded there.
	var snaps int
	if err := testPool(t).QueryRow(ctx, `select count(*) from funding_snapshots`).Scan(&snaps); err != nil {
		t.Fatalf("count snapshots: %v", err)
	}
	if snaps != 2 {
		t.Errorf("funding_snapshots: got %d, want 2 — history must keep both cycles", snaps)
	}
}

func TestAbsentNumericsLandAsNullNotZero(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.UnixMilli(1_789_147_120_000).UTC()

	// A market with no open interest, no book and no index price. Every one of these must be SQL
	// NULL: zero would read as "this market has no open interest" rather than "the venue did not
	// say", which is the distinction that once hid an entire venue behind the default OI filter.
	bare := snapshot("ETHUSDT", at.UnixMilli(), 0)
	bare.MarkPrice = nil

	if err := db.RecordBatch(ctx, "bybit",
		core.SnapshotBatch{Snapshots: []core.FundingSnapshot{bare}}, at); err != nil {
		t.Fatalf("RecordBatch: %v", err)
	}

	var oi, mark, index, bid *float64
	var rate float64
	if err := testPool(t).QueryRow(ctx,
		`select open_interest_usd, mark_price, index_price, best_bid, rate from market_latest`).
		Scan(&oi, &mark, &index, &bid, &rate); err != nil {
		t.Fatalf("read: %v", err)
	}
	for name, got := range map[string]*float64{
		"open_interest_usd": oi, "mark_price": mark, "index_price": index, "best_bid": bid,
	} {
		if got != nil {
			t.Errorf("%s: got %v, want NULL", name, *got)
		}
	}
	// But a REAL zero rate is a legitimate reading and must survive as 0, not become NULL.
	if rate != 0 {
		t.Errorf("rate: got %v, want a stored zero", rate)
	}
}

func TestRecordBatchIsIdempotentOnRepeatedSymbols(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.UnixMilli(1_789_147_120_000).UTC()

	// A venue repeating a symbol within one response must not make the statement touch the same
	// conflict key twice, which PostgreSQL rejects outright.
	batch := core.SnapshotBatch{Snapshots: []core.FundingSnapshot{
		snapshot("BTCUSDT", at.UnixMilli(), 0.001),
		snapshot("BTCUSDT", at.UnixMilli(), 0.002),
	}}
	if err := db.RecordBatch(ctx, "bybit", batch, at); err != nil {
		t.Fatalf("RecordBatch with a repeated symbol: %v", err)
	}

	var latest, snaps int
	pool := testPool(t)
	if err := pool.QueryRow(ctx, `select count(*) from market_latest`).Scan(&latest); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `select count(*) from funding_snapshots`).Scan(&snaps); err != nil {
		t.Fatal(err)
	}
	if latest != 1 {
		t.Errorf("market_latest: got %d rows, want 1", latest)
	}
	// funding_snapshots is append-only and unkeyed, so both readings are kept.
	if snaps != 2 {
		t.Errorf("funding_snapshots: got %d, want 2", snaps)
	}
}

func TestRecordBatchIgnoresOtherVenuesRows(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.UnixMilli(1_789_147_120_000).UTC()

	foreign := snapshot("BTC-USDT-SWAP", at.UnixMilli(), 0.5)
	foreign.VenueID = "okx"

	if err := db.RecordBatch(ctx, "bybit", core.SnapshotBatch{Snapshots: []core.FundingSnapshot{
		snapshot("BTCUSDT", at.UnixMilli(), 0.001),
		foreign,
	}}, at); err != nil {
		t.Fatalf("RecordBatch: %v", err)
	}

	var venues []string
	rows, err := testPool(t).Query(ctx, `select distinct venue_id from market_latest`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			t.Fatal(err)
		}
		venues = append(venues, v)
	}
	if len(venues) != 1 || venues[0] != "bybit" {
		t.Errorf("venues: got %v, want only bybit — a cycle must not write another venue's rows", venues)
	}
}

func TestFundingEventsDedupeOnTheirKey(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.UnixMilli(1_789_147_120_000).UTC()
	settledAt := at.UnixMilli() - 8*3_600_000

	event := func(rate float64) core.FundingEvent {
		return core.FundingEvent{
			MarketRef: core.MarketRef{
				VenueID: "bybit", VenueSymbol: "BTCUSDT", Base: "BTC",
				AssetClass: core.ClassCrypto, Quote: s("USDT"), Multiplier: 1,
			},
			SettledAt: settledAt, Rate: rate, BasisHours: 8,
		}
	}

	// Two cycles reporting the same settlement: the primary key is
	// (venue_id, venue_symbol, settled_at), and observed events are insert-only, so the first wins
	// and the second is absorbed rather than erroring.
	for _, rate := range []float64{0.00002005, 0.00009999} {
		if err := db.RecordBatch(ctx, "bybit", core.SnapshotBatch{
			Snapshots: []core.FundingSnapshot{snapshot("BTCUSDT", at.UnixMilli(), 0.001)},
			Settled:   []core.FundingEvent{event(rate)},
		}, at); err != nil {
			t.Fatalf("RecordBatch: %v", err)
		}
	}

	var n int
	var rate float64
	var source string
	pool := testPool(t)
	if err := pool.QueryRow(ctx, `select count(*) from funding_events`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `select rate, source from funding_events`).Scan(&rate, &source); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("funding_events: got %d rows, want 1", n)
	}
	if rate != 0.00002005 {
		t.Errorf("rate: got %v, want the first write to stand", rate)
	}
	if source != "observed" {
		t.Errorf("source: got %q, want observed", source)
	}
}

func TestActiveMarketsFeedsTheWarmUpPhase(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.UnixMilli(1_789_147_120_000).UTC()

	withInterval := snapshot("BTCUSDT", at.UnixMilli(), 0.001)
	withInterval.IntervalHours = f(8)
	withoutInterval := snapshot("ETHUSDT", at.UnixMilli(), 0.002)

	if err := db.RecordBatch(ctx, "bybit", core.SnapshotBatch{
		Snapshots: []core.FundingSnapshot{withInterval, withoutInterval},
	}, at); err != nil {
		t.Fatalf("RecordBatch: %v", err)
	}

	// This is what MEXC and pionex are seeded from before their first cycle. Bounded by last_seen,
	// so a long-delisted market cannot be seeded back into an adapter that would then publish it.
	known, err := db.ActiveMarkets(ctx, "bybit", at.Add(-time.Hour))
	if err != nil {
		t.Fatalf("ActiveMarkets: %v", err)
	}
	if len(known) != 2 {
		t.Fatalf("got %d markets, want 2", len(known))
	}
	bySymbol := map[string]collector.KnownMarket{}
	for _, m := range known {
		bySymbol[m.VenueSymbol] = m
	}
	if got := bySymbol["BTCUSDT"].IntervalHours; got == nil || *got != 8 {
		t.Errorf("BTCUSDT interval: got %v, want 8", got)
	}
	// A market whose interval was never learned seeds as absent, not as zero — seeding 0 would tell
	// the adapter it settles infinitely often.
	if got := bySymbol["ETHUSDT"].IntervalHours; got != nil {
		t.Errorf("ETHUSDT interval: got %v, want nil", *got)
	}

	// The window is what makes this safe: nothing seen before it is returned.
	none, err := db.ActiveMarkets(ctx, "bybit", at.Add(time.Hour))
	if err != nil {
		t.Fatalf("ActiveMarkets (future window): %v", err)
	}
	if len(none) != 0 {
		t.Errorf("got %d markets from a future window, want 0", len(none))
	}
}

func TestRecordRunStoresACycleOutcome(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.UnixMilli(1_789_147_120_000).UTC()

	if err := db.RecordRun(ctx, collector.Run{
		VenueID: "bybit", StartedAt: at, Duration: 1234 * time.Millisecond,
		Markets: 829, Requests: 2,
	}); err != nil {
		t.Fatalf("RecordRun: %v", err)
	}
	if err := db.RecordRun(ctx, collector.Run{
		VenueID: "okx", StartedAt: at, Duration: 500 * time.Millisecond,
		Err: context.DeadlineExceeded,
	}); err != nil {
		t.Fatalf("RecordRun (failed cycle): %v", err)
	}

	var durationMs, markets, requests int
	var failure *string
	pool := testPool(t)
	if err := pool.QueryRow(ctx,
		`select duration_ms, markets, requests, error from collector_runs where venue_id='bybit'`).
		Scan(&durationMs, &markets, &requests, &failure); err != nil {
		t.Fatalf("read ok run: %v", err)
	}
	if durationMs != 1234 || markets != 829 || requests != 2 {
		t.Errorf("got duration=%d markets=%d requests=%d, want 1234/829/2", durationMs, markets, requests)
	}
	if failure != nil {
		t.Errorf("error: got %q, want NULL for a successful cycle", *failure)
	}

	if err := pool.QueryRow(ctx,
		`select error from collector_runs where venue_id='okx'`).Scan(&failure); err != nil {
		t.Fatalf("read failed run: %v", err)
	}
	if failure == nil || *failure == "" {
		t.Error("a failed cycle must record its error text")
	}
}
