package store

import (
	"context"
	"fmt"
	"time"
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
// a quote that is older. That is what lets both writers run on the same row without coordinating —
// a poll cycle carrying a 60-second-old book cannot overwrite a 1-second-old streamed one, and a
// reconnect replaying an old snapshot cannot overwrite what arrived while it was reconnecting.
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
