// Liquidation ingestion over the same sockets the quote feeds use.
//
// WHY THIS IS NOT A Feed. Phase 6's Feed keeps STATE: the newest top of book per market, collapsed
// in a map, flushed to market_latest. A liquidation is an EVENT — every one counts, none supersedes
// another, and the table it lands in (migration 012) is insert-only with a five-field composite
// primary key standing in for the unique id no venue publishes. Folding events into a book-shaped
// map would silently discard every liquidation after the first in a flush window, which is exactly
// the busiest moment anyone would be reading the table for. So: the same connection machinery
// (conn.go), a different buffer and a different write.
//
// MEASURED BEFORE BUILDING (2026-09-18, this box, one 22-minute probe per venue unless noted).
// Counts are EVENTS, not messages:
//
//	okx      liquidation-orders, instType SWAP, ONE topic, all swaps        100 events  4.5/min
//	bybit    allLiquidation.{symbol} x 805 linear USDT symbols               49 events  2.2/min
//	gate     futures.public_liquidates with the !all payload                 40 events  1.8/min
//	htx      public.*.liquidation_orders, ONE wildcard topic                  5 events  0.23/min
//	binance  !forceOrder@arr   production host blocked; the one that delivered was the TESTNET  OFF
//	bitget   channel "liquidation", instType USDT-FUTURES          see the bitget file
//	dydx     v4_trades type "LIQUIDATED"           78 in the subscribe snapshot, 0 live in 24 min
//	aster    !forceOrder@arr on its own host                                  2 events  0.08/min
//	kucoin   every liquidation topic tried: "404 topic does not exist"       NO FEED
//	mexc     1,624 messages on the deal stream, no liquidation method exists NO FEED
//	bingx    "80015 dataType not support" for every liquidation dataType,
//	         while BTC-USDT@trade was accepted as a control                  NO FEED
//	hyperliquid  no liquidations subscription ("Error parsing JSON into valid websocket request"),
//	         and its trades carry no liquidation marker. The one lead — trades with a zero tx hash —
//	         was chased to its end: eight of them were looked up through the public userFills
//	         endpoint and every one came back an ordinary fill ("Close Long", "Open Short"), with no
//	         `liquidation` field present on the object at all.                     NO FEED.
//	         trade[XYZ] is a HIP-3 deployment on the same API, so it has none either.
//	lighter  trades carry type "liquidation" (4 of 19,755 in 24 min) with size, price AND a
//	         usd_amount. A REAL FEED, deliberately NOT implemented here: its market_id is numeric
//	         and needs a mapping this package does not have, and the side would have to be derived
//	         from is_maker_ask plus the sign of taker_position_size_before — self-consistent on both
//	         captured records, but both were long liquidations, so the short direction is
//	         unobserved. Shipping it would mean guessing half the mapping.       PROVEN, NOT BUILT.
//	paradex  trades.{market} works and its trade_type took two values in 24 minutes, FILL (71) and
//	         RPI (25). The documented LIQUIDATION value never appeared, so whether it fires is
//	         UNRESOLVED rather than absent — 96 trades is too thin to conclude from.
//	pacifica trades deliver (648 in 24 min) but carry no type, event_type or cause field at all, so
//	         there is nothing on them that could mark a forced close.          NO MARKER FOUND.
//
// The rates are a QUIET AFTERNOON, not a cap. Liquidations are bursty by nature: a venue at
// 0.23/min here can do hundreds in the minute a leveraged market breaks.
//
// WHY GATE IS NOT HERE, although its socket demonstrably works (40 events in 22 minutes on
// futures.public_liquidates with the !all payload, the one channel gate gives an all-symbols form).
// Gate is ALREADY ingested over REST, and the two paths would not agree on a primary key. The REST
// record carries `time` in whole SECONDS and a `fill_price`; the socket record carries `time_ms`
// AND `time`, and a `price` whose relationship to the REST `fill_price` is unverified — gate's REST
// row has both fill_price and order_price, and the socket row has only one number. Since the key is
// (venue_id, venue_symbol, liquidated_at, size_contracts, fill_price), a millisecond of extra
// precision or a different price field means the SAME liquidation stored TWICE, which is the one
// failure that would silently inflate the regressor. okx is added alongside its REST poll precisely
// because its socket payload is field-for-field the same as its REST payload (see liqokx.go); gate's
// is not, so gate keeps the single REST path until someone reconciles the two shapes on live data.
package stream

import (
	"context"
	"math/rand/v2"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// LiquidationEvent is one forced close, in the shape every venue is normalised into.
//
// SIDE IS THE POSITION THAT WAS CLOSED, never the order that closed it — a liquidated long is SOLD.
// That is what the `liquidations.side` column means (migration 012) and what "longs were liquidated"
// claims, and the venues express it four different ways: okx names the position outright, gate
// signs it, binance and htx report the ORDER and must be inverted, bybit reports the taker side of
// the trade. Each venue's file carries its own evidence for which.
type LiquidationEvent struct {
	VenueSymbol   string
	At            time.Time
	Side          string // "long" or "short"
	SizeContracts float64
	FillPrice     float64
	// NotionalUSD is real dollars, or nil where the venue's metadata does not say what a size means.
	// NIL RATHER THAN A GUESS: migration 012 keeps size_contracts precisely so a missing conversion
	// stays recoverable, while a fabricated notional is a wrong number nobody can tell from a right
	// one. The venues disagree about the unit — base coin on binance and bybit, contracts against a
	// multiplier on gate, okx and htx — so there is no shared formula to fall back on.
	NotionalUSD *float64
}

// EventProtocol is one venue's liquidation wire format. The connection half is Wire, shared with
// the quote feeds.
type EventProtocol interface {
	Wire
	// NeedsSymbols reports whether Frames needs a symbol list at all.
	//
	// Four of the five venues here publish EVERY market's liquidations on one all-symbols topic:
	// binance's !forceOrder@arr, okx's instType SWAP, gate's !all payload, htx's public.* wildcard.
	// Bybit and bitget have no such form and need one topic per market. For the all-symbols venues
	// an empty subject set is normal rather than a cold start, and must not be mistaken for one.
	NeedsSymbols() bool
	// DecodeEvents turns one raw message into liquidations, and returns an error only for a message
	// the venue itself reports as a failure. An ack, a pong or a heartbeat yields neither.
	DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error)
}

// EventSink is the slice of the store a liquidation feed writes through. Store.RecordLiquidations
// is insert-only with ON CONFLICT DO NOTHING, which is what makes running a socket alongside a REST
// poll for the same venue safe — see the note on double counting in main.go's startEventFeeds.
type EventSink interface {
	RecordLiquidations(ctx context.Context, venueID string, liquidations []core.Liquidation) (int, error)
}

// eventBufferCap is how many events may pile up between flushes before new ones are dropped.
//
// A BOUND IS NOT OPTIONAL. The flush is the only thing that empties this slice, so a database that
// is slow or unreachable during a cascade would otherwise let one goroutine grow it without limit
// on a 1 GB container. At 200 bytes an event this caps the buffer near 4 MB. 20,000 is roughly
// four hundred times the busiest window any of these venues produced while being probed, and the
// count of what was dropped is logged rather than swallowed: under-reporting a cascade is the one
// failure that would bias the study, so it has to be visible when it happens.
const eventBufferCap = 20_000

// EventFeed is one venue's liquidation socket, its in-memory buffer and its flush timer.
//
// Implements the { Stop(ctx) error } shape the venue loops and periodic tasks have, so it joins the
// SIGTERM path in main.go without a special case.
type EventFeed struct {
	proto EventProtocol
	sink  EventSink
	opts  Options
	conn  *connector

	mu sync.Mutex
	// buf holds what has arrived since the last flush. A slice, not a map: collapsing by market is
	// what Feed does and what an event feed must never do.
	buf []LiquidationEvent
	// subjects is the subscription set, empty and unused on an all-symbols venue.
	subjects map[string]struct{}
	// dropped counts events refused by the buffer cap since the last flush.
	dropped int

	cancel context.CancelFunc
	done   chan struct{}
}

// NewEventFeed builds a liquidation feed. Subjects are ignored by a protocol whose NeedsSymbols is
// false, which is every venue with an all-symbols topic.
func NewEventFeed(proto EventProtocol, dial Dialer, sink EventSink, symbols []string, opts Options) *EventFeed {
	if opts.FlushEvery <= 0 {
		opts.FlushEvery = defaultEventFlush
	}
	if opts.FailureThreshold <= 0 {
		opts.FailureThreshold = defaultFailureThreshold
	}
	if opts.Cooldown <= 0 {
		opts.Cooldown = defaultCooldown
	}
	if opts.DialTimeout <= 0 {
		opts.DialTimeout = defaultDialTimeout
	}
	if opts.ReadTimeout <= 0 {
		// A liquidation feed is SILENT for long stretches by design, so the quote feeds' 90-second
		// read timeout would tear down a perfectly healthy connection all afternoon. Every venue
		// here answers pings, so liveness rides on the keepalive rather than on traffic.
		opts.ReadTimeout = defaultEventReadTimeout
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Rand == nil {
		opts.Rand = rand.Float64
	}

	feed := &EventFeed{proto: proto, sink: sink, opts: opts, subjects: map[string]struct{}{}}
	for _, symbol := range symbols {
		if symbol != "" {
			feed.subjects[symbol] = struct{}{}
		}
	}
	feed.conn = newConnector(proto, dial, opts, proto.VenueID()+":liq", proto.NeedsSymbols())
	feed.conn.subjects = feed.symbolsSnapshot
	feed.conn.handle = feed.handle
	if preparer, needs := proto.(Preparer); needs {
		feed.conn.prepare = preparer.Prepare
	}
	return feed
}

// VenueID is the id this feed records health under: the venue's id suffixed with ":liq".
//
// A SEPARATE ID, for the reason Feed uses ":ws". A live liquidation socket must not satisfy the
// staleness check for a venue whose funding poll has died, and a quiet liquidation feed must not
// make the venue's quote feed look broken. Three ids means /status shows the poll, the book and the
// liquidations failing independently, which is what they do.
func (f *EventFeed) VenueID() string { return f.conn.id }

// Subjects is how many markets this feed subscribes to. Zero on an all-symbols venue, where one
// topic covers the whole book.
func (f *EventFeed) Subjects() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.subjects)
}

// SetSubjects replaces the subscription set, cycling the connection if it actually changed.
//
// A NO-OP on an all-symbols venue: there is nothing per-market to change, and cycling the
// connection would drop events for nothing. On bybit and bitget it works as Feed.SetSubjects does,
// with one difference that matters — a reconnect LOSES whatever fires during it, because no venue
// republishes a liquidation. That is why main.go refreshes these far less often than the quote
// feeds' subjects.
func (f *EventFeed) SetSubjects(symbols []string) (added, removed int) {
	if !f.proto.NeedsSymbols() {
		return 0, 0
	}
	next := make(map[string]struct{}, len(symbols))
	for _, symbol := range symbols {
		if symbol != "" {
			next[symbol] = struct{}{}
		}
	}
	if len(next) == 0 {
		// Refusing an empty set, exactly as Feed does: a query that returns nothing — a collection
		// cycle that has not landed, a venue mid-outage — would otherwise unsubscribe the feed and
		// leave it connected to nothing, which reads on /status as healthy.
		return 0, 0
	}

	f.mu.Lock()
	for symbol := range next {
		if _, held := f.subjects[symbol]; !held {
			added++
		}
	}
	for symbol := range f.subjects {
		if _, kept := next[symbol]; !kept {
			removed++
		}
	}
	f.subjects = next
	f.mu.Unlock()

	if added == 0 && removed == 0 {
		return 0, 0
	}
	f.conn.signalRefresh()
	return added, removed
}

// Start connects and begins flushing. It returns immediately; Stop waits for both goroutines.
func (f *EventFeed) Start(ctx context.Context) {
	feedCtx, cancel := context.WithCancel(ctx)
	f.cancel = cancel
	f.done = make(chan struct{})

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		f.conn.connectLoop(feedCtx)
	}()
	go func() {
		defer wg.Done()
		f.flushLoop(feedCtx)
	}()
	go func() {
		wg.Wait()
		close(f.done)
	}()
}

// Stop closes the socket and resolves once both goroutines have returned, bounded by ctx.
func (f *EventFeed) Stop(ctx context.Context) error {
	if f.cancel == nil {
		return nil
	}
	f.cancel()
	select {
	case <-f.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (f *EventFeed) symbolsSnapshot() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return sortedKeys(f.subjects)
}

// handle buffers one message's events. Called by the connector for every message read.
func (f *EventFeed) handle(msg []byte, now time.Time) error {
	events, err := f.proto.DecodeEvents(msg, now)
	if err != nil {
		return err
	}
	if len(events) == 0 {
		return nil
	}
	f.mu.Lock()
	for _, event := range events {
		if len(f.buf) >= eventBufferCap {
			f.dropped++
			continue
		}
		f.buf = append(f.buf, event)
	}
	f.mu.Unlock()
	return nil
}

// requeue puts a failed batch back at the FRONT of the buffer, so the oldest events keep priority
// and a long outage sheds the newest rather than the ones nearest to being lost for good.
func (f *EventFeed) requeue(failed []LiquidationEvent) {
	f.mu.Lock()
	defer f.mu.Unlock()
	room := eventBufferCap - len(f.buf)
	if room <= 0 {
		f.dropped += len(failed)
		return
	}
	if len(failed) > room {
		f.dropped += len(failed) - room
		failed = failed[:room]
	}
	f.buf = append(failed, f.buf...)
}

func (f *EventFeed) flushLoop(ctx context.Context) {
	ticker := time.NewTicker(f.opts.FlushEvery)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			// One last flush on the way out, with a budget of its own. Unlike a quote, a buffered
			// liquidation is GONE if it is not written: nothing republishes it and no later poll
			// re-reads it on the venues that only push.
			final, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			f.Flush(final)
			cancel()
			return
		case <-ticker.C:
			f.Flush(ctx)
		}
	}
}

// Flush writes everything buffered since the last flush and synthesizes a collector run.
//
// A FLUSH WITH NOTHING TO WRITE IS STILL A RUN, and that is the opposite of Feed's rule. A quote
// feed that goes silent is broken, so Feed lets it go stale. A liquidation feed that goes silent is
// an ordinary calm market — the probe measured htx at one event every four minutes — so recording
// the run keeps a healthy, connected, empty feed off /status's stale list.
//
// THAT RULE HAD A HOLE, and htx fell through it in production on 2026-09-18: the venue hung up every
// ~30 seconds, each reconnect cleared the error, and /status showed a healthy feed that had never
// delivered a row. So what is reported is connector.health() rather than its last error — a feed
// that keeps LOSING connections is reported as faulty even while it is between them, because
// "connected, delivering nothing" and "reconnecting forever, delivering nothing" are not the same
// thing and must not look the same.
func (f *EventFeed) Flush(ctx context.Context) {
	startedAt := f.opts.Now()

	f.mu.Lock()
	buffered := f.buf
	f.buf = nil
	dropped := f.dropped
	f.dropped = 0
	f.mu.Unlock()

	venueID := f.proto.VenueID()
	if dropped > 0 {
		f.conn.logf("%s: buffer full, DROPPED %d liquidations (cap %d)", f.conn.id, dropped, eventBufferCap)
	}

	stored := 0
	var err error
	if len(buffered) > 0 {
		liquidations := make([]core.Liquidation, 0, len(buffered))
		for _, event := range buffered {
			if event.Side != "long" && event.Side != "short" {
				continue // the CHECK constraint on liquidations.side would reject the whole batch
			}
			if !(event.SizeContracts > 0) || !(event.FillPrice > 0) || event.At.IsZero() {
				continue
			}
			liquidations = append(liquidations, core.Liquidation{
				MarketRef:     adapters.MarketRefFor(venueID, event.VenueSymbol, adapters.Overrides{}),
				LiquidatedAt:  event.At.UnixMilli(),
				Side:          event.Side,
				SizeContracts: event.SizeContracts,
				FillPrice:     event.FillPrice,
				NotionalUSD:   event.NotionalUSD,
			})
		}
		if len(liquidations) > 0 {
			// ONE statement for the window, not one per event. A per-event INSERT would be a round
			// trip per liquidation on a database shared with sixteen other tenants, and a cascade is
			// precisely when that is least affordable.
			stored, err = f.sink.RecordLiquidations(ctx, venueID, liquidations)
			if err != nil {
				// PUT THEM BACK rather than dropping them. A quote that fails to write is replaced
				// by the next tick, so Feed can afford to lose one; a liquidation has no next tick
				// and no poll behind it on four of these six venues, so a momentary database blip
				// would otherwise be permanent data loss. Retrying is safe because the write is
				// insert-only under a content-addressed primary key: re-sending rows that did land
				// stores them once. Bounded by the same cap as anything else, so a database that
				// stays down degrades to dropping the oldest work rather than to growing without
				// limit.
				f.conn.logf("%s: flush failed, %d liquidations requeued: %s",
					f.conn.id, len(liquidations), collector.DescribeError(err))
				f.requeue(buffered)
			}
		}
	}

	if f.opts.OnFlush == nil {
		return
	}
	reported := err
	if reported == nil {
		// health(), not err(): a feed the venue keeps hanging up on clears lastErr on every
		// reconnect and would otherwise look like a calm market. See connector.health.
		reported = f.conn.health()
	}
	f.opts.OnFlush(collector.Run{
		VenueID:   f.VenueID(),
		StartedAt: startedAt,
		Duration:  f.opts.Now().Sub(startedAt),
		// Rows actually new, which on a venue also polled over REST is below the number received:
		// the composite primary key absorbs whatever both paths saw.
		Markets:  stored,
		Requests: 0,
		Err:      reported,
	})
}
