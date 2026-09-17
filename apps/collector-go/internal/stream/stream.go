// Package stream keeps top of book current between polls.
//
// Phase 6 / W2. The funding loops fetch every market on a 60-second cadence, which is right for a
// funding rate that settles every one to eight hours and wrong for a bid-ask spread: /arbitrage
// prints a gap and the size it is good for, and both are stale the moment the book moves. This
// package holds a socket to a venue, keeps the latest book per market in memory, and flushes it to
// market_latest on a timer.
//
// WHAT IT DELIBERATELY IS NOT.
//
//   - It is not a second collector. It writes five columns through store.WriteQuotes and nothing
//     else: no funding_snapshots (a quote is not a funding observation, and that table already takes
//     ~324k rows an hour), no observed_at (which would resurrect a dead venue's rate as fresh), and
//     no INSERTs (a market the funding path has not recorded is not this package's to invent).
//   - It is not a per-message writer. An in-memory map collapses however many updates arrive into
//     one row per market per flush window, so a venue pushing 900 messages a second costs one
//     statement every few seconds rather than 900 round trips.
//   - It is not a live feed for the site. web/live.ts already polls the page's own URL every 30s and
//     swaps the changed regions; this is about ingestion, and the page gets fresher numbers from it
//     without knowing it exists.
//
// MEASURED BEFORE BUILDING (W0, 2026-09-17, on hklab). Bybit delivers its whole book — 833 markets —
// on ONE connection; the three-venue fleet runs at 2,320 messages a second; parsing that costs 1.0%
// of one core and servicing it 18%, in Bun, against a collector container idling at 2.57% of the
// same core. The numbers are in plans/phase6-websocket-streams.md section 0, and they are why this
// runs in-process rather than as a separate service.
package stream

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand/v2"
	"strconv"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/store"
)

const (
	// Mirrors httpclient: jittered exponential from 500ms, capped at 15s. A venue that drops every
	// connection must not be reconnected to in a tight loop, and a fleet of feeds must not all come
	// back on the same millisecond after a network blip.
	baseBackoff = 500 * time.Millisecond
	maxBackoff  = 15 * time.Second

	defaultFailureThreshold = 5
	defaultCooldown         = 5 * time.Minute
	defaultFlush            = 5 * time.Second
	defaultDialTimeout      = 20 * time.Second
	// readTimeout is how long a connection may be silent before it is considered dead. Every venue
	// here pushes continuously and answers pings, so silence is a failure rather than a quiet market.
	defaultReadTimeout = 90 * time.Second

	// The liquidation feeds' equivalents (events.go). Both differ from the quote feeds' on purpose.
	//
	// defaultEventFlush is longer because there is nothing to gain from writing sooner: the
	// liquidations table is read by a study over weeks, not by a page refreshing every 30 seconds,
	// and a wider window means fewer, larger INSERTs for the same rows.
	defaultEventFlush = 10 * time.Second
	// defaultEventReadTimeout is far longer because SILENCE IS THE NORMAL STATE. The busiest feed
	// measured on 2026-09-18 produced 4.5 events a minute and the quietest one every four minutes,
	// so a 90-second timeout would tear down healthy connections all afternoon. Every venue here
	// answers pings, so liveness rides on the keepalive instead of on traffic.
	defaultEventReadTimeout = 15 * time.Minute
)

// Conn is the slice of a WebSocket connection a feed needs.
//
// An interface rather than *websocket.Conn for the reason httpclient takes a Doer and the TypeScript
// adapters take a FetchLike: the tests drive a real feed through a scripted connection instead of
// patching a global or standing up a server.
type Conn interface {
	Read(ctx context.Context) ([]byte, error)
	Write(ctx context.Context, data []byte) error
	Close() error
}

// Dialer opens one connection. Injected for the same reason Conn is.
type Dialer func(ctx context.Context, url string) (Conn, error)

// Sink is the slice of the store a feed writes through.
type Sink interface {
	WriteQuotes(ctx context.Context, quotes []store.Quote) (written int, unknown int, err error)
}

// Subject is one market the feed subscribes to.
//
// Multiplier comes from the markets table and is the venue's contract scale — 1000 for 1000PEPEUSDT
// and so on. It is carried here rather than looked up at flush time because every quote needs it and
// looking it up per message would put a map read on the hot path for a value that changes when a
// market is listed, which is to say almost never.
type Subject struct {
	VenueSymbol string
	Multiplier  float64
}

// Update is one market's top of book as a venue published it, in the venue's own units.
//
// Nil means "this side did not change in this message", which is how every level-1 channel here
// expresses an unchanged side. A side that was DELETED arrives as a quantity of zero and is stored
// as a cleared side, not as a zero quote — see (*book).apply.
type Update struct {
	Symbol string
	At     time.Time
	Bid    *float64
	BidQty *float64
	Ask    *float64
	AskQty *float64
}

// Protocol is one venue's top-of-book wire format. The feed owns connection lifetime, backoff, the
// in-memory book and the flush; a Protocol only says what to send and how to read what comes back.
//
// The connection half lives in Wire, which EventProtocol shares — see conn.go. Embedding it leaves
// the method set exactly as it was, so every venue implementation here is unchanged.
type Protocol interface {
	Wire
	// Decode turns one raw message into book updates, and returns an error only for a message the
	// venue itself reports as a failure (a rejected subscription, say). A message that is simply not
	// a book update — an ack, a pong, a heartbeat — yields no updates and no error.
	Decode(msg []byte, now time.Time) ([]Update, error)
	// SizeUSD turns a venue-quoted resting size at a venue-quoted price into money, or nil when the
	// venue's metadata does not say what that size means.
	//
	// THIS IS THE 10,000x TRAP, and it is per-venue because the venues genuinely disagree about what
	// a size IS. Migration 013 measured all three on one BTC book: gate said 2776, okx 504.48 and
	// bybit 0.181, for depths of roughly $21.6k, $392k and $14k. Bybit quotes base coin, so money is
	// price times quantity; gate quotes contracts against a quanto multiplier; okx quotes contracts
	// against ctVal, with fifteen inverse swaps whose contracts are already denominated in dollars
	// and must NOT be multiplied by a price. A single shared formula would be wrong on two venues.
	//
	// Nil rather than a guess: an unknown size fails the depth floor on /arbitrage, which is the
	// safe direction, while a fabricated one invites a loss.
	SizeUSD(symbol string, price, qty float64) *float64
}

// Preparer is a Protocol that needs venue metadata before it can convert what it receives — the
// contract scales that turn a resting size into money.
//
// Optional, because bybit needs none. Called before every subscribe, INCLUDING on reconnect, so a
// contract listed while the feed was running gets its real scale rather than being dropped until
// the next restart.
type Preparer interface {
	Prepare(ctx context.Context, symbols []string) error
}

// Options configures one feed.
type Options struct {
	// FlushEvery is how often the in-memory book is written. The floor on quote age: at 5 seconds a
	// reader sees a book at most five seconds old, against sixty from polling alone.
	FlushEvery time.Duration
	// FailureThreshold is consecutive connection failures before the feed stops dialling for
	// Cooldown, then tries once (half-open), exactly as httpclient's breaker does.
	FailureThreshold int
	Cooldown         time.Duration
	DialTimeout      time.Duration
	// ReadTimeout is how long a connection may go without delivering anything before it is dropped
	// and redialled. A connected-but-silent socket is the failure mode a reconnect cannot see.
	ReadTimeout time.Duration

	// OnFlush receives a synthesized collector run per flush window; see Feed.flush.
	OnFlush func(collector.Run)
	Log     func(string)

	// Seams for deterministic tests.
	Now  func() time.Time
	Rand func() float64
}

// Feed is one venue's socket, its in-memory book and its flush timer.
//
// Implements the { Stop(ctx) error } shape the venue loops and periodic tasks have, so it joins
// loops[] and the SIGTERM path in main.go without a special case.
type Feed struct {
	proto    Protocol
	sink     Sink
	subjects map[string]Subject
	opts     Options
	// conn owns dialling, subscribing, backoff, the circuit breaker and the reconnect. Shared with
	// EventFeed; its most recent fault is reported on the next flush, so a feed that is
	// connected-but-empty and a feed that cannot connect are distinguishable on /status.
	conn *connector

	mu    sync.Mutex
	books map[string]*book

	cancel context.CancelFunc
	done   chan struct{}
}

// errResubscribe ends a connection on purpose, so connectLoop can tell a deliberate cycle from a
// fault: a re-subscribe must not count towards the circuit breaker or wait out a backoff.
var errResubscribe = errors.New("subscription set changed")

// errNoSubjects means there is nothing to subscribe to yet. Also not a fault — it is what a feed
// sees on a database whose funding loops have not landed a cycle for this venue — so it waits
// quietly instead of backing off towards a circuit breaker over a condition the venue has no part
// in. SetSubjects is what ends the wait.
var errNoSubjects = errors.New("no subjects to subscribe to")

// idleRetry is how often a feed with no subjects looks again. Short enough that a cold start costs
// seconds rather than a refresh interval, long enough to be invisible.
const idleRetry = 30 * time.Second

// book is one market's current top of book, in venue units, plus whether it has changed since the
// last flush.
type book struct {
	multiplier float64
	at         time.Time
	bid        *float64
	bidQty     *float64
	ask        *float64
	askQty     *float64
	dirty      bool
}

// apply folds one update into the book and reports whether anything changed.
//
// A quantity of zero is a DELETION, not a quote of zero size. Bybit's orderbook.1 expresses "the
// best bid just went away" that way, and storing it as a zero would print a market as quoting at a
// price nobody is offering. A deleted side becomes unknown, which drops the market from /arbitrage —
// the query requires best_bid > 0 AND best_ask > 0 — until the next level arrives, usually within
// milliseconds on the markets this feed subscribes to.
func (b *book) apply(u Update) bool {
	changed := false
	if u.Bid != nil {
		if u.BidQty != nil && *u.BidQty == 0 {
			if b.bid != nil {
				b.bid, b.bidQty, changed = nil, nil, true
			}
		} else if b.bid == nil || *b.bid != *u.Bid || !sameQty(b.bidQty, u.BidQty) {
			b.bid, b.bidQty, changed = u.Bid, u.BidQty, true
		}
	}
	if u.Ask != nil {
		if u.AskQty != nil && *u.AskQty == 0 {
			if b.ask != nil {
				b.ask, b.askQty, changed = nil, nil, true
			}
		} else if b.ask == nil || *b.ask != *u.Ask || !sameQty(b.askQty, u.AskQty) {
			b.ask, b.askQty, changed = u.Ask, u.AskQty, true
		}
	}
	if changed {
		b.at = u.At
		b.dirty = true
	}
	return changed
}

func sameQty(a, b *float64) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

// New builds a feed. The subjects are fixed for the feed's lifetime; refreshing them without a
// restart is W4.
func New(proto Protocol, dial Dialer, sink Sink, subjects []Subject, opts Options) *Feed {
	if opts.FlushEvery <= 0 {
		opts.FlushEvery = defaultFlush
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
		opts.ReadTimeout = defaultReadTimeout
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Rand == nil {
		opts.Rand = rand.Float64
	}
	byName := make(map[string]Subject, len(subjects))
	books := make(map[string]*book, len(subjects))
	for _, s := range subjects {
		if s.VenueSymbol == "" {
			continue
		}
		multiplier := s.Multiplier
		if !(multiplier > 0) {
			multiplier = 1
		}
		byName[s.VenueSymbol] = s
		books[s.VenueSymbol] = &book{multiplier: multiplier}
	}
	feed := &Feed{proto: proto, sink: sink, subjects: byName, opts: opts, books: books}
	feed.conn = newConnector(proto, dial, opts, proto.VenueID()+":ws", true)
	feed.conn.subjects = feed.symbolsSnapshot
	feed.conn.handle = feed.handle
	// Optional: bybit needs no metadata to convert a size, so it implements no Preparer.
	if preparer, needs := proto.(Preparer); needs {
		feed.conn.prepare = preparer.Prepare
	}
	return feed
}

// VenueID is the id this feed records health under. It is the VENUE's id suffixed with ":ws", and
// the suffix is load-bearing rather than cosmetic.
//
// Recording flushes as runs for "bybit" would let a live socket satisfy the staleness check for a
// venue whose funding poll had died — the same silent resurrection migration 022 exists to prevent,
// reappearing in the health model instead of in the row. Two ids means /status shows the poll and
// the feed failing independently, which is what they do.
func (f *Feed) VenueID() string { return f.conn.id }

// Subjects is how many markets this feed subscribes to.
func (f *Feed) Subjects() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.subjects)
}

// SetSubjects replaces the subscription set and, if it actually changed, cycles the connection so
// the new set takes effect. It reports what moved.
//
// WHY THIS EXISTS. Markets are listed and delisted continuously, and a set fixed at boot goes stale
// in both directions: a newly listed pairable market streams nothing until the next deploy, and a
// delisted one holds a topic and a book forever. Neither is visible on /status — the feed keeps
// flushing, just not the markets a reader is looking at.
//
// A market that survives the change keeps its book. Only the ones entering start empty, so a refresh
// costs a reconnect and nothing else: the quotes already held are flushed by the timer as usual and
// the guard in WriteQuotes means even a replayed snapshot cannot move anything backwards.
func (f *Feed) SetSubjects(subjects []Subject) (added, removed int) {
	next := make(map[string]Subject, len(subjects))
	for _, s := range subjects {
		if s.VenueSymbol == "" {
			continue
		}
		if !(s.Multiplier > 0) {
			s.Multiplier = 1
		}
		next[s.VenueSymbol] = s
	}
	if len(next) == 0 {
		// Refusing an empty set is deliberate. A query that returns nothing — a collector cycle that
		// has not landed yet, a venue mid-outage — would otherwise unsubscribe the whole feed and
		// leave it connected to nothing, which reads on /status as a healthy feed with no markets.
		// Keeping the previous set costs staleness; taking the empty one costs the venue.
		return 0, 0
	}

	f.mu.Lock()
	for symbol, subject := range next {
		if _, held := f.subjects[symbol]; held {
			// Keep the existing book, but take the new scale: a venue can change a contract's
			// multiplier, and the book in memory is quoted in whatever the venue is sending now.
			f.books[symbol].multiplier = subject.Multiplier
			continue
		}
		added++
		f.books[symbol] = &book{multiplier: subject.Multiplier}
	}
	for symbol := range f.subjects {
		if _, kept := next[symbol]; !kept {
			removed++
			delete(f.books, symbol)
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
func (f *Feed) Start(ctx context.Context) {
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

// Stop closes the socket and resolves once both goroutines have returned, bounded by ctx — the
// contract main.go's shutdown path expects, inside SHUTDOWN_GRACE_MS.
func (f *Feed) Stop(ctx context.Context) error {
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

// handle folds one decoded message into the in-memory book. The connector calls it for every
// message; an error is the venue reporting a failure, which is surfaced without dropping a
// connection that is otherwise delivering.
func (f *Feed) handle(msg []byte, now time.Time) error {
	updates, err := f.proto.Decode(msg, now)
	if err != nil {
		return err
	}
	if len(updates) == 0 {
		return nil
	}
	f.mu.Lock()
	for _, u := range updates {
		if b := f.books[u.Symbol]; b != nil {
			b.apply(u)
		}
	}
	f.mu.Unlock()
	return nil
}

// symbolsSnapshot is the current subscription set, sorted. Sorted so a reconnect sends the same
// frames in the same order, which makes a venue's own logs and ours line up when a subscription is
// rejected.
func (f *Feed) symbolsSnapshot() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return sortedKeys(f.subjects)
}

func (f *Feed) flushLoop(ctx context.Context) {
	ticker := time.NewTicker(f.opts.FlushEvery)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			// One last flush on the way out, with a short budget of its own: the quotes already in
			// memory cost nothing to write and would otherwise be thrown away on every deploy.
			final, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			f.Flush(final)
			cancel()
			return
		case <-ticker.C:
			f.Flush(ctx)
		}
	}
}

// Flush writes every book that has changed since the last flush, and synthesizes a collector run
// describing the window.
//
// WHY A RUN. VenueHealth is {lastRunAt, lastSuccessAt, markets, error, stale} and staleness derives
// from an interval times a count — polling concepts. A connected-but-silent socket has no run to
// record, so rather than teach /health, /status, the planned/silent/stale states and the
// stale-venue alerter about sockets, the flush window IS the run: markets = quotes written,
// requests = 0 (nothing was requested, which is the honest number for a push feed and makes a
// streamed venue legible as one), duration = the flush's own wall time, error = the connection's
// last fault. A feed that is connected but receiving nothing flushes zero quotes and goes stale on
// its own, which is the correct reading.
func (f *Feed) Flush(ctx context.Context) {
	startedAt := f.opts.Now()

	f.mu.Lock()
	quotes := make([]store.Quote, 0, len(f.books))
	for symbol, b := range f.books {
		if !b.dirty {
			continue
		}
		b.dirty = false
		quotes = append(quotes, store.Quote{
			VenueID:     f.proto.VenueID(),
			VenueSymbol: symbol,
			At:          b.at,
			// Per unit of base, the same rescale mark and index go through: a venue listing
			// 1000PEPE quotes a price covering a thousand units, and a book stored at contract
			// scale would read a thousand times the price of the same asset elsewhere.
			BestBid: core.PerUnitPrice(b.bid, b.multiplier),
			BestAsk: core.PerUnitPrice(b.ask, b.multiplier),
			// Sizes are money, and what turns a venue's size into money is the venue's business:
			// see Protocol.SizeUSD. They are never rescaled by the multiplier — that would be
			// applying a contract scale twice.
			BestBidSize: f.sizeUSD(symbol, b.bid, b.bidQty),
			BestAskSize: f.sizeUSD(symbol, b.ask, b.askQty),
		})
	}
	f.mu.Unlock()
	lastErr := f.conn.err()

	written := 0
	var err error
	if len(quotes) > 0 {
		var unknown int
		written, unknown, err = f.sink.WriteQuotes(ctx, quotes)
		if err != nil {
			f.conn.logf("%s: flush failed: %s", f.VenueID(), collector.DescribeError(err))
		} else if unknown > 0 {
			// Markets the funding path does not have, or quotes an older write already beat. Worth
			// logging because a feed drifting away from the catalog shows up here first.
			f.conn.logf("%s: %d of %d quotes not written", f.VenueID(), unknown, len(quotes))
		}
	}

	if f.opts.OnFlush == nil {
		return
	}
	// The connection's fault outranks a write failure in the reported error only when there is no
	// write failure: a feed that cannot write is broken whatever the socket is doing.
	reported := err
	if reported == nil {
		reported = lastErr
	}
	f.opts.OnFlush(collector.Run{
		VenueID:   f.VenueID(),
		StartedAt: startedAt,
		Duration:  f.opts.Now().Sub(startedAt),
		Markets:   written,
		Requests:  0,
		Err:       reported,
	})
}

// sizeUSD asks the protocol what this resting size is worth, once both halves are known.
//
// A size without a price is not money, and a null must stay null rather than become a zero: the
// depth floor on /arbitrage treats an unknown size as failing the floor, while a zero would pass a
// "$0 or more" filter and claim a quote is good for nothing.
func (f *Feed) sizeUSD(symbol string, price, qty *float64) *float64 {
	if price == nil || qty == nil {
		return nil
	}
	return f.proto.SizeUSD(symbol, *price, *qty)
}

func sleep(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

// parseFloat reads a venue's number, which arrives as a JSON string on every venue here: they
// quote "77766.70" rather than 77766.7 so a client cannot lose digits to float64 in transit.
//
// strconv rather than Sscanf, and on purpose. This runs four times per message at roughly 900
// messages a second per venue; Sscanf parses a format string and allocates on every call, which is
// a tenth of a millisecond nobody should be spending here. A value that will not parse is dropped
// rather than guessed at.
func parseFloat(raw json.RawMessage) *float64 {
	if len(raw) == 0 {
		return nil
	}
	text := string(raw)
	if text[0] == '"' {
		var asString string
		if err := json.Unmarshal(raw, &asString); err != nil {
			return nil
		}
		text = asString
	}
	v, err := strconv.ParseFloat(text, 64)
	if err != nil {
		return nil
	}
	return &v
}
