package store

import (
	"context"
	"fmt"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Quote is one market's top of book as a feed saw it, already converted into the units market_latest
// stores: prices per unit of the base asset, sizes in USD.
//
// The conversion belongs to whoever builds this struct, not here, because it needs the market's
// multiplier and the venue's own notion of what a size is — gate quotes contracts times a quanto
// multiplier, okx quotes contracts against ctVal with fifteen inverse USD-denominated swaps, and
// bybit quotes base coin. Their raw numbers for one BTC book read 2776, 504.48 and 0.181, which is
// a 10,000x error if compared as printed (migration 013). WriteQuotes takes them already correct and
// says so loudly rather than converting values it cannot see the metadata for.
type Quote struct {
	VenueID     string
	VenueSymbol string
	// At is when the venue published this book, not when we flushed it. A flush of 400 quotes writes
	// 400 different timestamps.
	At          time.Time
	BestBid     *float64
	BestBidSize *float64
	BestAsk     *float64
	BestAskSize *float64
}

// StreamSubject is one market a feed should subscribe to, with the contract scale its prices need.
type StreamSubject struct {
	VenueSymbol string
	Multiplier  float64
}

// StreamSubjects picks the markets on one venue that a quote feed is worth running for.
//
// NOT EVERY MARKET, and the filter is the same one the reader applies. /arbitrage compares an asset
// only where two venues quote it and the marks agree, so a market nothing can pair with contributes
// no row however fast its book is streamed. Measured on 2026-09-17, the three WebSocket venues carry
// 2,297 markets between them of which 2,105 are pairable — 92%, so this is not the dramatic
// reduction the plan expected. The open-interest floor is what actually moves the number: 1,690
// markets at $100k and 764 at $1M.
//
// The floor is a parameter rather than a constant because the right value is a judgement about what
// a reader would trade, not a fact about the venues, and because W0 measured that the whole book
// fits on one connection either way — this is about write volume and usefulness, not about capacity.
//
// Deliberately reads market_latest rather than markets: a market that has not been collected within
// the freshness window has nothing to pair with and no multiplier we would trust.
func (s *Store) StreamSubjects(ctx context.Context, venueID string, minOpenInterestUSD float64) ([]StreamSubject, error) {
	const sql = `
		WITH fresh AS (
			SELECT venue_id, venue_symbol, asset_class, base, mark_price, open_interest_usd,
			       (best_bid > 0 AND best_ask > 0) AS quoting
			FROM market_latest
			WHERE observed_at > now() - interval '5 minutes'
		),
		anchors AS (
			SELECT DISTINCT ON (asset_class, base) asset_class, base, mark_price AS anchor_mark
			FROM fresh WHERE mark_price > 0
			ORDER BY asset_class, base, open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
		),
		-- The mark-agreement band, mirroring arbitrage(): a market whose mark is a different
		-- instrument's is not a leg, and subscribing to it would stream a book nothing may use.
		legs AS (
			SELECT f.* FROM fresh f
			LEFT JOIN anchors a ON a.asset_class = f.asset_class AND a.base = f.base
			WHERE f.quoting
			  AND (a.anchor_mark IS NULL OR f.mark_price IS NULL
			       OR f.mark_price BETWEEN a.anchor_mark / (1 + $2::float8)
			                           AND a.anchor_mark * (1 + $2::float8))
		),
		pairable AS (
			SELECT asset_class, base FROM legs GROUP BY 1, 2 HAVING count(DISTINCT venue_id) >= 2
		)
		SELECT l.venue_symbol, coalesce(m.multiplier, 1)::float8
		FROM legs l
		JOIN pairable p ON p.asset_class = l.asset_class AND p.base = l.base
		LEFT JOIN markets m ON m.venue_id = l.venue_id AND m.venue_symbol = l.venue_symbol
		WHERE l.venue_id = $1 AND coalesce(l.open_interest_usd, 0) >= $3::float8
		ORDER BY l.venue_symbol`

	rows, err := s.pool.Query(ctx, sql, venueID, core.DivergenceTrigger, minOpenInterestUSD)
	if err != nil {
		return nil, fmt.Errorf("stream subjects for %s: %w", venueID, err)
	}
	defer rows.Close()

	var out []StreamSubject
	for rows.Next() {
		var subject StreamSubject
		if err := rows.Scan(&subject.VenueSymbol, &subject.Multiplier); err != nil {
			return nil, fmt.Errorf("scan stream subject: %w", err)
		}
		out = append(out, subject)
	}
	return out, rows.Err()
}

// WriteQuotes stores top of book for markets that already exist in market_latest.
//
// PARTIAL BY DESIGN, and this is the whole point of the function. It touches five columns —
// best_bid, best_bid_size_usd, best_ask, best_ask_size_usd, quotes_at — and NOTHING else. It never
// writes observed_at, because a quote is not a funding observation and stamping one would resurrect
// a dead venue's rate as fresh. It never writes funding_snapshots, because that table already takes
// ~324k rows an hour at 60-second polling and per-tick inserts on an instance shared with 16 other
// tenants is the obvious mistake. And it never INSERTs: a market that the funding path has not yet
// recorded has no base, asset_class, rate or basis_hours, so a row created here could not satisfy
// market_latest's NOT NULLs and would be invisible to every query anyway. Quotes for an unknown
// market are counted and dropped, and the count is returned so a caller can notice a feed
// subscribed to symbols the collector does not have.
//
// The ordering guard is the same one the funding path uses (quoteIsNewer): a quote may only replace
// a quote that is older. That is what lets both writers run on the same row without coordinating.
// It is about arrival order, not about polled books being stale — a cycle observed at t+60 can
// commit after a streamed quote observed at t+65 — and it makes a reconnect's replayed snapshot a
// no-op for free.
func (s *Store) WriteQuotes(ctx context.Context, quotes []Quote) (written int, unknown int, err error) {
	if len(quotes) == 0 {
		return 0, 0, nil
	}

	// One row per market, newest wins. The in-memory map upstream already collapses per market, but
	// a flush that merged two feeds — or a single feed reconnecting mid-window — can still present
	// the same key twice, and one INSERT cannot touch the same conflict key twice.
	newest := make(map[string]Quote, len(quotes))
	for _, q := range quotes {
		key := q.VenueID + "\x00" + q.VenueSymbol
		if prev, ok := newest[key]; ok && prev.At.After(q.At) {
			continue
		}
		newest[key] = q
	}

	n := len(newest)
	venueIDs := make([]string, 0, n)
	symbols := make([]string, 0, n)
	at := make([]time.Time, 0, n)
	bids := make([]*float64, 0, n)
	bidSizes := make([]*float64, 0, n)
	asks := make([]*float64, 0, n)
	askSizes := make([]*float64, 0, n)
	for _, q := range newest {
		venueIDs = append(venueIDs, q.VenueID)
		symbols = append(symbols, q.VenueSymbol)
		at = append(at, q.At.UTC())
		bids = append(bids, q.BestBid)
		bidSizes = append(bidSizes, q.BestBidSize)
		asks = append(asks, q.BestAsk)
		askSizes = append(askSizes, q.BestAskSize)
	}

	const sql = `
		UPDATE market_latest m SET
			best_bid = q.best_bid,
			best_bid_size_usd = q.best_bid_size_usd,
			best_ask = q.best_ask,
			best_ask_size_usd = q.best_ask_size_usd,
			quotes_at = q.quotes_at
		FROM (
			SELECT * FROM unnest(
				$1::text[], $2::text[], $3::timestamptz[], $4::float8[], $5::float8[], $6::float8[],
				$7::float8[]
			) AS t(venue_id, venue_symbol, quotes_at, best_bid, best_bid_size_usd, best_ask,
			       best_ask_size_usd)
		) q
		WHERE m.venue_id = q.venue_id AND m.venue_symbol = q.venue_symbol
		  AND q.quotes_at >= coalesce(m.quotes_at, '-infinity'::timestamptz)`

	tag, err := s.pool.Exec(ctx, sql, venueIDs, symbols, at, bids, bidSizes, asks, askSizes)
	if err != nil {
		return 0, 0, fmt.Errorf("write quotes: %w", err)
	}
	written = int(tag.RowsAffected())
	// Rows that matched no market and rows the guard rejected are indistinguishable from the tag
	// alone. Both are "not written", and a caller watching this number is watching for a feed that
	// is producing nothing useful, which either one is.
	return written, n - written, nil
}
