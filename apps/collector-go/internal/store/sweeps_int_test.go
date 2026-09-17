package store

// Integration tests for sweeps.go, on the same AIRATES_TEST_DSN harness as store_int_test.go.
// freshStore's TRUNCATE ... venues CASCADE also empties market_leverage_tiers and liquidations,
// since both reference venues(id).

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

func sweepFundingEvent(symbol string, settledAt time.Time, rate float64, mark *float64) core.FundingEvent {
	return core.FundingEvent{
		MarketRef: core.MarketRef{
			VenueID: "bybit", VenueSymbol: symbol, Base: "BTC",
			AssetClass: core.ClassCrypto, Quote: s("USDT"), Multiplier: 1,
		},
		SettledAt: settledAt.UnixMilli(), Rate: rate, BasisHours: 8, MarkPrice: mark,
	}
}

func TestRecordHistoryReplacesObservedButNeverFetchedValues(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	pool := testPool(t)
	at := time.Now().Add(-8 * time.Hour).Truncate(time.Hour).UTC()

	// Observed while collecting, with a mark.
	if err := db.RecordBatch(ctx, "bybit", core.SnapshotBatch{
		Settled: []core.FundingEvent{sweepFundingEvent("BTCUSDT", at, 0.0001, f(77000))},
	}, time.Now()); err != nil {
		t.Fatalf("RecordBatch: %v", err)
	}

	// The history API's value replaces it, and a missing mark keeps the observed one.
	if err := db.RecordHistory(ctx, "bybit", []core.FundingEvent{
		sweepFundingEvent("BTCUSDT", at, 0.0002, nil),
		sweepFundingEvent("BTCUSDT", at, 0.0002, nil), // a duplicate in one call must not error
	}); err != nil {
		t.Fatalf("RecordHistory: %v", err)
	}
	var rate float64
	var mark *float64
	var source string
	if err := pool.QueryRow(ctx, `select rate, mark_price, source from funding_events`).Scan(&rate, &mark, &source); err != nil {
		t.Fatalf("read: %v", err)
	}
	if rate != 0.0002 || source != "history" || mark == nil || *mark != 77000 {
		t.Errorf("after history: rate %v, mark %v, source %q; want 0.0002, 77000, history", rate, mark, source)
	}

	// A second fetched value does not overwrite the first.
	if err := db.RecordHistory(ctx, "bybit", []core.FundingEvent{sweepFundingEvent("BTCUSDT", at, 0.0009, nil)}); err != nil {
		t.Fatalf("RecordHistory again: %v", err)
	}
	if err := pool.QueryRow(ctx, `select rate from funding_events`).Scan(&rate); err != nil {
		t.Fatalf("read: %v", err)
	}
	if rate != 0.0002 {
		t.Errorf("rate = %v after a second history write, want the first fetched 0.0002", rate)
	}

	// Another venue's events are ignored rather than written under this venue.
	other := sweepFundingEvent("ETHUSDT", at, 0.0003, nil)
	other.VenueID = "okx"
	if err := db.RecordHistory(ctx, "bybit", []core.FundingEvent{other}); err != nil {
		t.Fatalf("RecordHistory other venue: %v", err)
	}
	var n int
	if err := pool.QueryRow(ctx, `select count(*) from funding_events`).Scan(&n); err != nil || n != 1 {
		t.Errorf("funding_events rows = %d (%v), want 1", n, err)
	}
}

func TestSettledByMarketLatestIsBoundedOldestIsNot(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Millisecond)
	recent := now.Add(-2 * time.Hour)
	old := now.Add(-40 * 24 * time.Hour)

	if err := db.RecordHistory(ctx, "bybit", []core.FundingEvent{
		sweepFundingEvent("BTCUSDT", recent, 0.0001, nil),
		sweepFundingEvent("BTCUSDT", old, 0.0001, nil),
		sweepFundingEvent("STALEUSDT", old, 0.0001, nil),
	}); err != nil {
		t.Fatalf("RecordHistory: %v", err)
	}

	latest, err := db.LatestSettledByMarket(ctx, "bybit")
	if err != nil {
		t.Fatalf("LatestSettledByMarket: %v", err)
	}
	if len(latest) != 1 || latest["BTCUSDT"] != recent.UnixMilli() {
		t.Errorf("latest = %v, want only BTCUSDT at %d (STALEUSDT is outside 30 days)", latest, recent.UnixMilli())
	}

	oldest, err := db.OldestSettledByMarket(ctx, "bybit")
	if err != nil {
		t.Fatalf("OldestSettledByMarket: %v", err)
	}
	if len(oldest) != 2 || oldest["BTCUSDT"] != old.UnixMilli() || oldest["STALEUSDT"] != old.UnixMilli() {
		t.Errorf("oldest = %v, want both markets at %d", oldest, old.UnixMilli())
	}
}

func sweepStoreTier(symbol string, number int, maxLeverage float64) core.LeverageTier {
	return core.LeverageTier{
		VenueID: "bybit", VenueSymbol: symbol, Tier: number, LowerNotionalUSD: 0,
		UpperNotionalUSD: f(10_000), IMR: 0.02, MMR: nil, MaxLeverage: maxLeverage,
	}
}

func TestReplaceLeverageTiersUpsertsAndPrunesOnlyWhenComplete(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	pool := testPool(t)
	first := time.Now().Add(-time.Hour)

	if _, err := db.ReplaceLeverageTiers(ctx, "bybit", []core.LeverageTier{
		sweepStoreTier("BTCUSDT", 1, 50), sweepStoreTier("ETHUSDT", 1, 50),
	}, first, true); err != nil {
		t.Fatalf("first sweep: %v", err)
	}

	count := func() int {
		var n int
		if err := pool.QueryRow(ctx, `select count(*) from market_leverage_tiers`).Scan(&n); err != nil {
			t.Fatalf("count: %v", err)
		}
		return n
	}

	// A partial sweep that missed ETHUSDT updates BTCUSDT and leaves ETHUSDT alone.
	if _, err := db.ReplaceLeverageTiers(ctx, "bybit", []core.LeverageTier{sweepStoreTier("BTCUSDT", 1, 25)}, first.Add(time.Minute), false); err != nil {
		t.Fatalf("partial sweep: %v", err)
	}
	if n := count(); n != 2 {
		t.Errorf("after partial sweep: %d tiers, want 2", n)
	}
	var leverage float64
	var mmr *float64
	if err := pool.QueryRow(ctx, `select max_leverage, mmr from market_leverage_tiers where venue_symbol = 'BTCUSDT'`).
		Scan(&leverage, &mmr); err != nil {
		t.Fatalf("read: %v", err)
	}
	if leverage != 25 || mmr != nil {
		t.Errorf("BTCUSDT max_leverage %v, mmr %v; want 25 and NULL", leverage, mmr)
	}

	// A complete sweep prunes what it did not report, and keeps the rows it just wrote.
	written, err := db.ReplaceLeverageTiers(ctx, "bybit", []core.LeverageTier{sweepStoreTier("BTCUSDT", 1, 25)}, time.Now(), true)
	if err != nil {
		t.Fatalf("complete sweep: %v", err)
	}
	if written != 1 || count() != 1 {
		t.Errorf("complete sweep wrote %d, table holds %d; want 1 and 1", written, count())
	}

	// An empty sweep is a failure, not a venue with no ladders: nothing is pruned.
	if written, err := db.ReplaceLeverageTiers(ctx, "bybit", nil, time.Now().Add(time.Hour), true); err != nil || written != 0 {
		t.Fatalf("empty sweep: %d, %v", written, err)
	}
	if n := count(); n != 1 {
		t.Errorf("after empty sweep: %d tiers, want 1", n)
	}
}

func sweepStoreLiquidation(venueID, symbol string, at time.Time, size float64) core.Liquidation {
	return core.Liquidation{
		MarketRef:    core.MarketRef{VenueID: venueID, VenueSymbol: symbol, Base: "BTC", AssetClass: core.ClassCrypto, Multiplier: 1},
		LiquidatedAt: at.UnixMilli(), Side: "long", SizeContracts: size, FillPrice: 77000, NotionalUSD: nil,
	}
}

func TestRecordLiquidationsCountsOnlyNewRows(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.Now().Add(-10 * time.Minute).UTC()

	page := []core.Liquidation{
		sweepStoreLiquidation("bybit", "BTCUSDT", at, 3),
		sweepStoreLiquidation("bybit", "BTCUSDT", at, 3), // the same record twice in one page
		sweepStoreLiquidation("bybit", "BTCUSDT", at, 4),
		sweepStoreLiquidation("okx", "BTC-USDT-SWAP", at, 5), // another venue's row: ignored
	}
	stored, err := db.RecordLiquidations(ctx, "bybit", page)
	if err != nil {
		t.Fatalf("first poll: %v", err)
	}
	if stored != 2 {
		t.Errorf("first poll stored %d, want 2", stored)
	}

	// The next poll re-reads the same page, which is the steady state: nothing new.
	stored, err = db.RecordLiquidations(ctx, "bybit", page)
	if err != nil {
		t.Fatalf("second poll: %v", err)
	}
	if stored != 0 {
		t.Errorf("repeat poll stored %d, want 0", stored)
	}
}

func sweepStoreFlow(venueID, symbol string, bucket time.Time, buy, sell float64, closePrice *float64) core.TakerFlow {
	return core.TakerFlow{
		VenueID: venueID, VenueSymbol: symbol, BucketStart: bucket.UnixMilli(),
		BuyUSD: buy, SellUSD: sell, ClosePrice: closePrice,
	}
}

func TestRecordTakerFlowUpsertsTheBucketStillFilling(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	pool := testPool(t)
	bucket := time.UnixMilli(core.TakerFlowBucketStart(time.Now().UnixMilli())).UTC()
	earlier := bucket.Add(-5 * time.Minute)

	written, err := db.RecordTakerFlow(ctx, "okx", []core.TakerFlow{
		sweepStoreFlow("okx", "BTC-USDT-SWAP", earlier, 10, 20, f(77000)),
		sweepStoreFlow("okx", "BTC-USDT-SWAP", bucket, 1, 2, nil),
		sweepStoreFlow("okx", "BTC-USDT-SWAP", bucket, 1, 2, nil),  // twice in one batch must not error
		sweepStoreFlow("okx", "BAD-USDT-SWAP", bucket, -1, 2, nil), // would fail the CHECK: dropped
		sweepStoreFlow("bybit", "BTCUSDT", bucket, 1, 2, nil),      // another venue's row: ignored
	})
	if err != nil {
		t.Fatalf("first write: %v", err)
	}
	if written != 2 {
		t.Errorf("first write = %d rows, want 2", written)
	}

	// The re-read: the filling bucket has grown, and a response with no price keeps the stored one.
	if _, err := db.RecordTakerFlow(ctx, "okx", []core.TakerFlow{
		sweepStoreFlow("okx", "BTC-USDT-SWAP", earlier, 11, 21, nil),
		sweepStoreFlow("okx", "BTC-USDT-SWAP", bucket, 5, 6, f(78000)),
	}); err != nil {
		t.Fatalf("re-read: %v", err)
	}
	var buy, sell float64
	var closePrice *float64
	if err := pool.QueryRow(ctx, `select buy_usd, sell_usd, close_price from taker_flow
		where venue_symbol = 'BTC-USDT-SWAP' and bucket_start = $1`, earlier).Scan(&buy, &sell, &closePrice); err != nil {
		t.Fatalf("read earlier: %v", err)
	}
	if buy != 11 || sell != 21 || closePrice == nil || *closePrice != 77000 {
		t.Errorf("earlier bucket = %v / %v / %v, want 11 / 21 / 77000", buy, sell, closePrice)
	}
	if err := pool.QueryRow(ctx, `select buy_usd, sell_usd, close_price from taker_flow
		where venue_symbol = 'BTC-USDT-SWAP' and bucket_start = $1`, bucket).Scan(&buy, &sell, &closePrice); err != nil {
		t.Fatalf("read bucket: %v", err)
	}
	if buy != 5 || sell != 6 || closePrice == nil || *closePrice != 78000 {
		t.Errorf("filling bucket = %v / %v / %v, want 5 / 6 / 78000", buy, sell, closePrice)
	}

	latest, err := db.LatestTakerFlowByMarket(ctx, "okx")
	if err != nil {
		t.Fatalf("LatestTakerFlowByMarket: %v", err)
	}
	if len(latest) != 1 || latest["BTC-USDT-SWAP"] != bucket.UnixMilli() {
		t.Errorf("latest = %v, want BTC-USDT-SWAP at %d", latest, bucket.UnixMilli())
	}
}

func TestTakerFlowSubjectsRankAssetsAcrossTheFourVenues(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	pool := testPool(t)
	if _, err := pool.Exec(ctx, `INSERT INTO venues (id, name, type) VALUES
		('binance','Binance','cex'), ('gate','Gate','cex'), ('bitget','Bitget','cex')`); err != nil {
		t.Fatalf("seed venues: %v", err)
	}
	at := time.Now().UTC() // the freshness window is five minutes, so these fixtures must be now

	market := func(venue, symbol, base, quote string, oi float64) core.FundingSnapshot {
		return core.FundingSnapshot{
			MarketRef: core.MarketRef{
				VenueID: venue, VenueSymbol: symbol, Base: base,
				AssetClass: core.ClassCrypto, Quote: s(quote), Multiplier: 1,
			},
			ObservedAt: at.UnixMilli(), Rate: 0.0001, BasisHours: 8, Kind: core.KindPredicted,
			MarkPrice: f(1), OpenInterestUSD: &oi,
		}
	}
	record := func(venue string, observed time.Time, snaps ...core.FundingSnapshot) {
		t.Helper()
		if err := db.RecordBatch(ctx, venue, core.SnapshotBatch{Snapshots: snaps}, observed); err != nil {
			t.Fatalf("RecordBatch(%s): %v", venue, err)
		}
	}

	record("okx", at,
		market("okx", "BTC-USDT-SWAP", "BTC", "USDT", 5e9),
		market("okx", "BTC-USDC-SWAP", "BTC", "USDC", 1e8),
		// Inverse: neither polled nor counted toward BTC's rank.
		market("okx", "BTC-USD-SWAP", "BTC", "USD", 9e12),
		// Large only on OKX, but summed across venues it is still the smallest.
		market("okx", "SOLO-USDT-SWAP", "SOLO", "USDT", 3e9),
	)
	record("binance", at,
		market("binance", "BTCUSDT", "BTC", "USDT", 8e9),
		market("binance", "ETHUSDT", "ETH", "USDT", 4e9),
		market("binance", "ETHUSDC", "ETH", "USDC", 1e9),
	)
	// Collected on a venue outside the four: its open interest must not lift an asset.
	record("bybit", at, market("bybit", "SOLOUSDT", "SOLO", "USDT", 9e10))
	// Stale on gate: last seen an hour ago, so it neither ranks nor gets polled.
	stale := market("gate", "SOLO_USDT", "SOLO", "USDT", 9e10)
	stale.ObservedAt = at.Add(-time.Hour).UnixMilli()
	record("gate", at.Add(-time.Hour), stale)

	subjects, err := db.TakerFlowSubjects(ctx, "okx")
	if err != nil {
		t.Fatalf("TakerFlowSubjects: %v", err)
	}
	want := []string{"BTC-USDT-SWAP", "BTC-USDC-SWAP", "SOLO-USDT-SWAP"}
	if strings.Join(subjects, " ") != strings.Join(want, " ") {
		t.Errorf("okx subjects = %v, want %v (largest asset first)", subjects, want)
	}

	// A venue polls every linear book on a ranked asset, USDC included, in rank order: BTC ($13.1B
	// summed) before ETH ($5B).
	subjects, err = db.TakerFlowSubjects(ctx, "binance")
	if err != nil {
		t.Fatalf("TakerFlowSubjects: %v", err)
	}
	want = []string{"BTCUSDT", "ETHUSDT", "ETHUSDC"}
	if strings.Join(subjects, " ") != strings.Join(want, " ") {
		t.Errorf("binance subjects = %v, want %v", subjects, want)
	}
}
