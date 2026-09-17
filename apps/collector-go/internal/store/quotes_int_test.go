package store

import (
	"context"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Integration tests for the Phase 6 quote path: migration 022's quotes_at, the funding path's new
// quote-scoped guard, and WriteQuotes.
//
// These run the real SQL against the real schema for the reason store_int_test.go states — a store
// verified by reading is a store not verified — and they exist because W1 ships a schema change that
// two writers share. Every test below is a way the two can corrupt each other's work.

type latestQuote struct {
	bid, bidSize, ask, askSize *float64
	quotesAt                   *time.Time
	observedAt                 time.Time
}

func readQuote(t *testing.T, db *Store, symbol string) latestQuote {
	t.Helper()
	var got latestQuote
	err := db.pool.QueryRow(context.Background(),
		`SELECT best_bid, best_bid_size_usd, best_ask, best_ask_size_usd, quotes_at, observed_at
		 FROM market_latest WHERE venue_id = 'bybit' AND venue_symbol = $1`, symbol).
		Scan(&got.bid, &got.bidSize, &got.ask, &got.askSize, &got.quotesAt, &got.observedAt)
	if err != nil {
		t.Fatalf("read %s: %v", symbol, err)
	}
	return got
}

func withBook(bid, ask float64) func(*core.FundingSnapshot) {
	return func(sn *core.FundingSnapshot) {
		sn.BestBid = f(bid)
		sn.BestBidSizeUSD = f(10_000)
		sn.BestAsk = f(ask)
		sn.BestAskSizeUSD = f(12_000)
	}
}

func record(t *testing.T, db *Store, at time.Time, snaps ...core.FundingSnapshot) {
	t.Helper()
	if err := db.RecordBatch(context.Background(), "bybit", core.SnapshotBatch{Snapshots: snaps}, at); err != nil {
		t.Fatalf("RecordBatch: %v", err)
	}
}

// The funding path stamps quotes_at only where it actually carried a book. 46 of 56 venues publish
// none, and a null there is the honest value — not a gap for something else to fill in.
func TestFundingPathStampsQuotesAtOnlyWhereItCarriedABook(t *testing.T) {
	db := freshStore(t)
	at := time.UnixMilli(1_789_147_120_000).UTC()

	record(t, db, at,
		snapshot("BTCUSDT", at.UnixMilli(), 0.0001, withBook(77_766.7, 77_767.1)),
		snapshot("ETHUSDT", at.UnixMilli(), 0.0001),
	)

	quoted := readQuote(t, db, "BTCUSDT")
	if quoted.quotesAt == nil || !quoted.quotesAt.Equal(at) {
		t.Fatalf("quoted market: quotes_at = %v, want %v", quoted.quotesAt, at)
	}
	bookless := readQuote(t, db, "ETHUSDT")
	if bookless.quotesAt != nil {
		t.Fatalf("bookless market: quotes_at = %v, want null", bookless.quotesAt)
	}
	if !bookless.observedAt.Equal(at) {
		t.Fatalf("bookless market: observed_at = %v, want %v -- the funding half must still land",
			bookless.observedAt, at)
	}
}

// The failure the quote-scoped guard exists to prevent, stated precisely, because the first version
// of this test asserted something that is not true.
//
// It is NOT "a polled book is older than a streamed one". A REST response describes the book as of
// the moment it was answered, and stamping it with the cycle's observed_at is honest: at the instant
// a poll lands, the poll and the stream are equally current, and the poll overwriting the stream is
// correct. What is not honest is letting ARRIVAL order decide. The two writers run at different
// latencies against the same row: a cycle observed at t+60 can be committed at t+66, after a
// streamed quote observed at t+65 has already landed. Then the older book arrives last, and without
// this guard it wins — a quote going backwards in time on a live row.
//
// The outer observed_at guard cannot catch it: the cycle's observed_at is genuinely newer than the
// row's (the stream never writes observed_at), so the row update is admitted and only the quote
// columns are wrong.
func TestALatePollCannotOverwriteAQuoteObservedAfterIt(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	t0 := time.UnixMilli(1_789_147_120_000).UTC()

	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001, withBook(77_766.7, 77_767.1)))

	// A streamed quote observed at t0+65s lands first.
	streamedAt := t0.Add(65 * time.Second)
	written, _, err := db.WriteQuotes(ctx, []Quote{{
		VenueID: "bybit", VenueSymbol: "BTCUSDT", At: streamedAt,
		BestBid: f(80_000), BestBidSize: f(1), BestAsk: f(80_001), BestAskSize: f(2),
	}})
	if err != nil || written != 1 {
		t.Fatalf("WriteQuotes: written=%d err=%v", written, err)
	}

	// Then the poll cycle observed at t0+60s commits — five seconds of request latency later.
	polledAt := t0.Add(60 * time.Second)
	record(t, db, polledAt, snapshot("BTCUSDT", polledAt.UnixMilli(), 0.0002, withBook(70_000, 70_001)))

	got := readQuote(t, db, "BTCUSDT")
	if *got.bid != 80_000 || *got.ask != 80_001 {
		t.Fatalf("the later-arriving older book won: bid=%v ask=%v, want 80000/80001", *got.bid, *got.ask)
	}
	if got.quotesAt == nil || !got.quotesAt.Equal(streamedAt) {
		t.Fatalf("quotes_at = %v, want the streamed time %v", got.quotesAt, streamedAt)
	}
	// And the funding half of the same row must have taken the cycle regardless: the quote guard
	// governs four columns, not the row.
	if !got.observedAt.Equal(polledAt) {
		t.Fatalf("observed_at = %v, want %v -- the quote guard must not block the funding columns",
			got.observedAt, polledAt)
	}
}

// The other half of the same rule: when the poll IS the newest observation, it wins outright,
// including on a market the feed is actively streaming. Otherwise every streamed venue would drift
// away from the book its own REST endpoint reports.
func TestAnOnTimePollOverwritesAnOlderStreamedQuote(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	t0 := time.UnixMilli(1_789_147_120_000).UTC()

	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001, withBook(77_766.7, 77_767.1)))
	if _, _, err := db.WriteQuotes(ctx, []Quote{{
		VenueID: "bybit", VenueSymbol: "BTCUSDT", At: t0.Add(30 * time.Second), BestBid: f(80_000),
	}}); err != nil {
		t.Fatalf("WriteQuotes: %v", err)
	}

	polledAt := t0.Add(60 * time.Second)
	record(t, db, polledAt, snapshot("BTCUSDT", polledAt.UnixMilli(), 0.0002, withBook(70_000, 70_001)))

	got := readQuote(t, db, "BTCUSDT")
	if *got.bid != 70_000 {
		t.Fatalf("bid = %v, want the newer polled 70000", *got.bid)
	}
	if got.quotesAt == nil || !got.quotesAt.Equal(polledAt) {
		t.Fatalf("quotes_at = %v, want %v", got.quotesAt, polledAt)
	}
}

// The symmetric case: a poll cycle whose book IS newer must win, or a venue that stops streaming
// would freeze on its last streamed quote forever.
func TestAPollCycleReplacesAnOlderQuote(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	t0 := time.UnixMilli(1_789_147_120_000).UTC()

	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001, withBook(77_766.7, 77_767.1)))
	if _, _, err := db.WriteQuotes(ctx, []Quote{{
		VenueID: "bybit", VenueSymbol: "BTCUSDT", At: t0.Add(10 * time.Second),
		BestBid: f(80_000), BestAsk: f(80_001),
	}}); err != nil {
		t.Fatalf("WriteQuotes: %v", err)
	}

	later := t0.Add(5 * time.Minute)
	record(t, db, later, snapshot("BTCUSDT", later.UnixMilli(), 0.0002, withBook(90_000, 90_001)))

	got := readQuote(t, db, "BTCUSDT")
	if *got.bid != 90_000 {
		t.Fatalf("bid = %v, want the newer polled 90000", *got.bid)
	}
	if got.quotesAt == nil || !got.quotesAt.Equal(later) {
		t.Fatalf("quotes_at = %v, want %v", got.quotesAt, later)
	}
}

// A cycle carrying no book leaves the stored one alone. Pre-Phase-6 it nulled it; the change is
// deliberate and the reader is protected by the freshness gate rather than by erasure.
func TestABooklessCycleLeavesAStoredQuoteAlone(t *testing.T) {
	db := freshStore(t)
	t0 := time.UnixMilli(1_789_147_120_000).UTC()

	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001, withBook(77_766.7, 77_767.1)))
	later := t0.Add(time.Minute)
	record(t, db, later, snapshot("BTCUSDT", later.UnixMilli(), 0.0002))

	got := readQuote(t, db, "BTCUSDT")
	if got.bid == nil || *got.bid != 77_766.7 {
		t.Fatalf("bid = %v, want the retained 77766.7", got.bid)
	}
	if got.quotesAt == nil || !got.quotesAt.Equal(t0) {
		t.Fatalf("quotes_at = %v, want the ORIGINAL %v -- a retained quote must keep its own age",
			got.quotesAt, t0)
	}
	if !got.observedAt.Equal(later) {
		t.Fatalf("observed_at = %v, want %v", got.observedAt, later)
	}
}

// WriteQuotes writes five columns and nothing else. Every other column on the row is a funding
// observation, and a quote is not one.
func TestWriteQuotesTouchesNothingButTheBook(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	t0 := time.UnixMilli(1_789_147_120_000).UTC()

	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001, func(sn *core.FundingSnapshot) {
		sn.OpenInterestUSD = f(4_142_076_932.53)
	}))
	before := readQuote(t, db, "BTCUSDT")

	streamedAt := t0.Add(time.Second)
	if _, _, err := db.WriteQuotes(ctx, []Quote{{
		VenueID: "bybit", VenueSymbol: "BTCUSDT", At: streamedAt,
		BestBid: f(80_000), BestBidSize: f(1_000), BestAsk: f(80_001), BestAskSize: f(2_000),
	}}); err != nil {
		t.Fatalf("WriteQuotes: %v", err)
	}

	var rate, oi float64
	var observedAt time.Time
	if err := db.pool.QueryRow(ctx,
		`SELECT rate, open_interest_usd, observed_at FROM market_latest
		 WHERE venue_id = 'bybit' AND venue_symbol = 'BTCUSDT'`).Scan(&rate, &oi, &observedAt); err != nil {
		t.Fatalf("read: %v", err)
	}
	if rate != 0.0001 || oi != 4_142_076_932.53 {
		t.Fatalf("funding columns moved: rate=%v oi=%v", rate, oi)
	}
	if !observedAt.Equal(before.observedAt) {
		t.Fatalf("observed_at moved to %v -- a quote must never resurrect a dead venue's funding row",
			observedAt)
	}
	got := readQuote(t, db, "BTCUSDT")
	if *got.bid != 80_000 || *got.askSize != 2_000 {
		t.Fatalf("book did not land: bid=%v askSize=%v", *got.bid, *got.askSize)
	}
}

// A feed subscribed to a symbol the collector has never recorded must not create a row: it could not
// satisfy market_latest's NOT NULLs, and a row with no base or asset_class is invisible to every
// query that matters. It is counted instead, so a caller can see a feed drifting from the catalog.
func TestWriteQuotesDoesNotInventMarkets(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	t0 := time.UnixMilli(1_789_147_120_000).UTC()
	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001))

	written, unknown, err := db.WriteQuotes(ctx, []Quote{
		{VenueID: "bybit", VenueSymbol: "BTCUSDT", At: t0.Add(time.Second), BestBid: f(80_000)},
		{VenueID: "bybit", VenueSymbol: "NOTAMARKETUSDT", At: t0.Add(time.Second), BestBid: f(1)},
	})
	if err != nil {
		t.Fatalf("WriteQuotes: %v", err)
	}
	if written != 1 || unknown != 1 {
		t.Fatalf("written=%d unknown=%d, want 1 and 1", written, unknown)
	}
	var rows int
	if err := db.pool.QueryRow(ctx,
		`SELECT count(*) FROM market_latest WHERE venue_symbol = 'NOTAMARKETUSDT'`).Scan(&rows); err != nil {
		t.Fatalf("count: %v", err)
	}
	if rows != 0 {
		t.Fatalf("WriteQuotes invented %d market rows", rows)
	}
}

// One flush can hold the same market twice — two feeds merged, or a reconnect replaying inside the
// window. A single statement cannot touch the same key twice, so the newest must win before the SQL
// ever sees it.
func TestWriteQuotesCollapsesRepeatsNewestWins(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	t0 := time.UnixMilli(1_789_147_120_000).UTC()
	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001))

	written, _, err := db.WriteQuotes(ctx, []Quote{
		{VenueID: "bybit", VenueSymbol: "BTCUSDT", At: t0.Add(2 * time.Second), BestBid: f(80_002)},
		{VenueID: "bybit", VenueSymbol: "BTCUSDT", At: t0.Add(time.Second), BestBid: f(80_001)},
	})
	if err != nil || written != 1 {
		t.Fatalf("WriteQuotes: written=%d err=%v", written, err)
	}
	got := readQuote(t, db, "BTCUSDT")
	if *got.bid != 80_002 {
		t.Fatalf("bid = %v, want the newer 80002", *got.bid)
	}
}

// A reconnect can replay a snapshot older than what arrived while it was reconnecting. The same
// guard that stops the poll cycle stops this, and the write reports itself as not written.
func TestWriteQuotesRejectsAStaleReplay(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	t0 := time.UnixMilli(1_789_147_120_000).UTC()
	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001))

	if _, _, err := db.WriteQuotes(ctx, []Quote{{
		VenueID: "bybit", VenueSymbol: "BTCUSDT", At: t0.Add(10 * time.Second), BestBid: f(80_010),
	}}); err != nil {
		t.Fatalf("WriteQuotes: %v", err)
	}
	written, unknown, err := db.WriteQuotes(ctx, []Quote{{
		VenueID: "bybit", VenueSymbol: "BTCUSDT", At: t0.Add(5 * time.Second), BestBid: f(80_005),
	}})
	if err != nil {
		t.Fatalf("WriteQuotes: %v", err)
	}
	if written != 0 || unknown != 1 {
		t.Fatalf("written=%d unknown=%d, want 0 and 1", written, unknown)
	}
	got := readQuote(t, db, "BTCUSDT")
	if *got.bid != 80_010 {
		t.Fatalf("bid = %v, want the newer 80010 to have survived the replay", *got.bid)
	}
}

// Sizes are nullable and null is not zero: a market quoting a price with no published size must
// fail a depth floor rather than pass it at $0. The same pointer discipline the funding path has.
func TestWriteQuotesKeepsAbsentSizesNull(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	t0 := time.UnixMilli(1_789_147_120_000).UTC()
	record(t, db, t0, snapshot("BTCUSDT", t0.UnixMilli(), 0.0001))

	if _, _, err := db.WriteQuotes(ctx, []Quote{{
		VenueID: "bybit", VenueSymbol: "BTCUSDT", At: t0.Add(time.Second),
		BestBid: f(80_000), BestAsk: f(80_001),
	}}); err != nil {
		t.Fatalf("WriteQuotes: %v", err)
	}
	got := readQuote(t, db, "BTCUSDT")
	if got.bidSize != nil || got.askSize != nil {
		t.Fatalf("sizes = %v/%v, want null", got.bidSize, got.askSize)
	}
}

// StreamSubjects is the subscription list, and it must be the same filter the reader applies:
// subscribing to a market /arbitrage can never pair is bandwidth and writes spent on a row nobody
// will see.
func TestStreamSubjectsPicksOnlyPairableMarkets(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.Now().UTC() // the freshness window is five minutes, so these fixtures must be now

	quoted := func(venue, symbol, base string, mark, oi float64) core.FundingSnapshot {
		return core.FundingSnapshot{
			MarketRef: core.MarketRef{
				VenueID: venue, VenueSymbol: symbol, Base: base,
				AssetClass: core.ClassCrypto, Quote: s("USDT"), Multiplier: 1,
			},
			ObservedAt: at.UnixMilli(), Rate: 0.0001, BasisHours: 8, Kind: core.KindPredicted,
			MarkPrice: &mark, OpenInterestUSD: &oi,
			BestBid: f(mark * 0.999), BestBidSizeUSD: f(10_000),
			BestAsk: f(mark * 1.001), BestAskSizeUSD: f(10_000),
		}
	}
	record := func(venue string, snaps ...core.FundingSnapshot) {
		t.Helper()
		if err := db.RecordBatch(ctx, venue, core.SnapshotBatch{Snapshots: snaps}, at); err != nil {
			t.Fatalf("RecordBatch(%s): %v", venue, err)
		}
	}

	record("bybit",
		// Pairable: okx quotes SOL too.
		quoted("bybit", "SOLUSDT", "SOL", 200, 5_000_000),
		// Quoted on bybit alone — nothing to compare it against, so nothing to stream it for.
		quoted("bybit", "LONELYUSDT", "LONELY", 5, 5_000_000),
		// Pairable but thin, for the open-interest floor below.
		quoted("bybit", "THINUSDT", "THIN", 1, 50_000),
		// Marked 1375x out: the mismatched-instrument case migration 005 exists for. It pairs on
		// paper and must not be subscribed to.
		quoted("bybit", "WRONGUSDT", "WRONG", 137_550, 5_000_000),
	)
	record("okx",
		quoted("okx", "SOL-USDT-SWAP", "SOL", 200.1, 9_000_000),
		quoted("okx", "THIN-USDT-SWAP", "THIN", 1.001, 8_000_000),
		quoted("okx", "WRONG-USDT-SWAP", "WRONG", 100, 9_000_000),
	)

	subjects, err := db.StreamSubjects(ctx, "bybit", 0)
	if err != nil {
		t.Fatalf("StreamSubjects: %v", err)
	}
	got := make([]string, len(subjects))
	for i, s := range subjects {
		got[i] = s.VenueSymbol
	}
	want := []string{"SOLUSDT", "THINUSDT"}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("subjects = %v, want %v", got, want)
	}

	floored, err := db.StreamSubjects(ctx, "bybit", 1_000_000)
	if err != nil {
		t.Fatalf("StreamSubjects with a floor: %v", err)
	}
	if len(floored) != 1 || floored[0].VenueSymbol != "SOLUSDT" {
		t.Fatalf("floored subjects = %v, want SOLUSDT alone", floored)
	}
}

// The multiplier travels with the subject because every quote needs it and the feed must not look
// it up per message. A market with no markets row still streams, at scale 1.
func TestStreamSubjectsCarryTheContractScale(t *testing.T) {
	db := freshStore(t)
	ctx := context.Background()
	at := time.Now().UTC() // the freshness window is five minutes, so these fixtures must be now

	scaled := func(venue, symbol string, multiplier float64) core.FundingSnapshot {
		return core.FundingSnapshot{
			MarketRef: core.MarketRef{
				VenueID: venue, VenueSymbol: symbol, Base: "PEPE",
				AssetClass: core.ClassCrypto, Quote: s("USDT"), Multiplier: multiplier,
			},
			ObservedAt: at.UnixMilli(), Rate: 0.0001, BasisHours: 8, Kind: core.KindPredicted,
			MarkPrice: f(0.00654 / multiplier * multiplier), OpenInterestUSD: f(5_000_000),
			BestBid: f(0.00653), BestBidSizeUSD: f(10_000),
			BestAsk: f(0.00655), BestAskSizeUSD: f(10_000),
		}
	}
	if err := db.RecordBatch(ctx, "bybit",
		core.SnapshotBatch{Snapshots: []core.FundingSnapshot{scaled("bybit", "1000PEPEUSDT", 1000)}}, at); err != nil {
		t.Fatalf("RecordBatch: %v", err)
	}
	if err := db.RecordBatch(ctx, "okx",
		core.SnapshotBatch{Snapshots: []core.FundingSnapshot{scaled("okx", "PEPE-USDT-SWAP", 1000)}}, at); err != nil {
		t.Fatalf("RecordBatch: %v", err)
	}

	subjects, err := db.StreamSubjects(ctx, "bybit", 0)
	if err != nil {
		t.Fatalf("StreamSubjects: %v", err)
	}
	if len(subjects) != 1 || subjects[0].Multiplier != 1000 {
		t.Fatalf("subjects = %+v, want one at multiplier 1000", subjects)
	}
}

func TestWriteQuotesOnAnEmptyFlushDoesNothing(t *testing.T) {
	db := freshStore(t)
	written, unknown, err := db.WriteQuotes(context.Background(), nil)
	if err != nil || written != 0 || unknown != 0 {
		t.Fatalf("written=%d unknown=%d err=%v", written, unknown, err)
	}
}
