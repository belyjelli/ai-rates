package stream

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
)

// Wire is the part of a venue's WebSocket protocol that is about the CONNECTION rather than about
// what travels over it: where to dial, what to subscribe with, how to stay alive.
//
// WHY IT IS ITS OWN INTERFACE. Phase 6 / W2 built this package around top of book, where a message
// is STATE — the latest one per market wins and the rest can be collapsed. Liquidations are EVENTS:
// every one matters, none supersedes another, and none is worth keeping in memory once written. The
// two need completely different message handling and exactly the same connection handling — the
// jittered backoff, the circuit breaker, the read timeout that catches a connected-but-silent
// socket, the resubscribe-by-reconnect. Splitting Wire out is what lets both share the second
// without pretending an event is a quote.
//
// Protocol (quotes) and EventProtocol (liquidations) each embed it, so every existing venue
// implementation satisfies Protocol exactly as it did before this split.
type Wire interface {
	// VenueID is the venue this protocol speaks for, as the catalog and market_latest key it.
	VenueID() string
	URL() string
	// Frames are the subscribe messages for these symbols, already chunked to the venue's documented
	// per-request limits. One frame per message; the feed paces them.
	Frames(symbols []string) [][]byte
	// FramePause is the gap the feed leaves between subscribe frames, honouring the venue's
	// requests-per-second limit on the control channel.
	FramePause() time.Duration
	// Ping is the keepalive frame, or nil where the venue needs none.
	Ping() []byte
	// PingEvery is how often to send it.
	PingEvery() time.Duration
}

// Responder is a Wire that must ANSWER something the venue sends it, rather than only speaking on
// its own schedule.
//
// Optional, and htx is the only implementer here: it sends {"op":"ping","ts":...} and drops a
// connection that does not reply {"op":"pong","ts":...}. A Decode cannot do that — it has no
// connection — and a keepalive ticker cannot either, because the reply has to echo the venue's own
// timestamp. Returning nil means "nothing to say", which is every message on every other venue.
type Responder interface {
	Respond(msg []byte) []byte
}

// connector owns one socket's whole life: dial, prepare, subscribe, read until it breaks, back off,
// dial again, and open a circuit breaker when a venue is refusing us.
//
// It is deliberately ignorant of what a message MEANS. Everything venue-shaped reaches it through
// three funcs — what to subscribe to, what to do before subscribing, what to do with a message —
// so Feed and EventFeed share this code rather than each keeping a 150-line copy that would drift
// the first time one of them fixed a reconnect bug.
type connector struct {
	wire Wire
	dial Dialer
	opts Options
	// id is what this connection reports health under: the venue id plus a suffix naming the feed.
	id string
	// requireSubjects is false for a venue whose subscription needs no symbol list at all — an
	// all-symbols topic like binance's !forceOrder@arr. For those an empty subject set is normal and
	// must not be mistaken for a cold start (see errNoSubjects).
	requireSubjects bool

	// subjects is the current subscription set, sorted. Read once per connection, never held across
	// one, because the set is replaced from another goroutine.
	subjects func() []string
	// prepare fetches whatever venue metadata the decode needs, before subscribing. Nil where none
	// is needed.
	prepare func(ctx context.Context, symbols []string) error
	// handle is called for every message read. An error is reported and logged but does NOT drop the
	// connection: a venue rejecting one subscription is still delivering the others.
	handle func(msg []byte, now time.Time) error

	// mu guards lastErr only. Feed and EventFeed each keep their own lock over their own buffer.
	mu      sync.Mutex
	lastErr error

	// refresh carries a request to re-subscribe, from SetSubjects to whichever connection is live.
	// Buffered by one: a request that arrives while the feed is between connections is not lost, and
	// two requests in a row are one re-subscribe.
	refresh chan struct{}
}

func newConnector(wire Wire, dial Dialer, opts Options, id string, requireSubjects bool) *connector {
	return &connector{
		wire: wire, dial: dial, opts: opts, id: id, requireSubjects: requireSubjects,
		refresh: make(chan struct{}, 1),
	}
}

func (c *connector) logf(format string, args ...any) {
	if c.opts.Log != nil {
		c.opts.Log(fmt.Sprintf(format, args...))
	}
}

func (c *connector) setErr(err error) {
	c.mu.Lock()
	c.lastErr = err
	c.mu.Unlock()
}

func (c *connector) err() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lastErr
}

// signalRefresh asks the live connection to cycle so a changed subscription set takes effect.
func (c *connector) signalRefresh() {
	select {
	case c.refresh <- struct{}{}:
	default:
	}
}

// connectLoop dials, subscribes, reads until the connection fails, and dials again. It never
// returns an error and never panics out of the goroutine: a feed that dies silently is worse than
// one that keeps failing visibly, and /status is where the failure belongs.
func (c *connector) connectLoop(ctx context.Context) {
	failures := 0
	for {
		if ctx.Err() != nil {
			return
		}
		err := c.runGuarded(ctx)
		if ctx.Err() != nil {
			return
		}
		if errors.Is(err, errNoSubjects) {
			// Nothing to subscribe to yet: a fresh database, or a venue whose funding loop has not
			// landed a cycle. Wait for the refresh task to hand over a set rather than dialling a
			// venue we would have nothing to say to. The feed still goes stale on /status, which is
			// the truth — it is not delivering — but it recovers on its own when the subjects
			// appear, with no restart and no page.
			c.setErr(err)
			// Interruptible, and that is the point: SetSubjects signals refresh, so a feed that was
			// waiting on a cold start connects the moment it has something to ask for instead of
			// sitting out the rest of the retry. The timer is only the fallback for a subject set
			// that arrives some other way.
			idle := time.NewTimer(idleRetry)
			select {
			case <-ctx.Done():
				idle.Stop()
				return
			case <-c.refresh:
			case <-idle.C:
			}
			idle.Stop()
			continue
		}
		if errors.Is(err, errResubscribe) {
			// Not a fault: the subscription set changed and the connection was cycled to take it.
			// No backoff, no failure count, and the counter is left where it was so a genuinely
			// flaky venue cannot be talked out of its circuit breaker by a well-timed refresh.
			c.setErr(nil)
			continue
		}
		failures++
		c.setErr(err)
		c.logf("%s: connection ended (%d consecutive): %s", c.id, failures, collector.DescribeError(err))

		wait := c.backoff(failures)
		if failures >= c.opts.FailureThreshold {
			// Open the circuit: stop dialling for a cooldown, then try exactly once. A venue that
			// is refusing us is not helped by being dialled every fifteen seconds forever.
			wait = c.opts.Cooldown
			failures = 0
			c.logf("%s: %d consecutive failures, pausing for %s", c.id, c.opts.FailureThreshold, wait)
		}
		if !sleep(ctx, wait) {
			return
		}
	}
}

// backoff mirrors httpclient's: exponential from 500ms, capped at 15s, multiplied by a random
// factor so a fleet of feeds does not reconnect in lockstep.
func (c *connector) backoff(failures int) time.Duration {
	shift := failures - 1
	if shift > 16 {
		shift = 16
	}
	wait := baseBackoff * (1 << shift)
	if wait > maxBackoff {
		wait = maxBackoff
	}
	return time.Duration(float64(wait) * c.opts.Rand())
}

func (c *connector) runGuarded(ctx context.Context) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic: %v", r)
		}
	}()
	return c.run(ctx)
}

// run holds one connection for as long as it lives, and returns the error that ended it.
func (c *connector) run(ctx context.Context) error {
	// The subject set is read once and the connection is built from that snapshot. The set may be
	// replaced at any moment — it is written from the refresh task's goroutine — and a map ranged
	// over while another goroutine writes it is a crash, not a race to shrug at.
	symbols := c.subjects()
	if c.requireSubjects && len(symbols) == 0 {
		return errNoSubjects
	}
	dialCtx, cancel := context.WithTimeout(ctx, c.opts.DialTimeout)
	conn, err := c.dial(dialCtx, c.wire.URL())
	cancel()
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	// Metadata before subscribing: a venue whose sizes cannot be converted yet would stream a book
	// whose depth column is null, or a liquidation whose notional is null, and in both cases the
	// number is the point.
	if c.prepare != nil {
		prepCtx, cancelPrep := context.WithTimeout(ctx, c.opts.DialTimeout)
		err := c.prepare(prepCtx, symbols)
		cancelPrep()
		if err != nil {
			return fmt.Errorf("prepare: %w", err)
		}
	}

	frames := c.wire.Frames(symbols)
	for i, frame := range frames {
		if err := conn.Write(ctx, frame); err != nil {
			return fmt.Errorf("subscribe frame %d/%d: %w", i+1, len(frames), err)
		}
		if pause := c.wire.FramePause(); pause > 0 && i < len(frames)-1 {
			if !sleep(ctx, pause) {
				return ctx.Err()
			}
		}
	}
	c.setErr(nil)

	readCtx, cancelRead := context.WithCancel(ctx)
	defer cancelRead()

	// A refresh that arrived while this feed was between connections is already satisfied: the
	// frames above were built from the current set. Drop it rather than cycling a connection that
	// is one second old.
	select {
	case <-c.refresh:
	default:
	}

	// A refresh from here on ends this connection, and connectLoop dials again immediately. The
	// alternative — sending subscribe and unsubscribe frames on the live socket — needs an
	// unsubscribe frame per venue, a partially-subscribed state to reason about, and its own path
	// for re-running prepare so a newly listed contract gets its size metadata. A reconnect gets all
	// three from code that already runs on every drop, at the cost of a sub-second gap on a refresh
	// that happens a few times an hour.
	//
	// FOR AN EVENT FEED THAT GAP IS A REAL LOSS, unlike for a book: a liquidation that fires during
	// the reconnect is gone, because nothing republishes it. That is why EventFeed refreshes its
	// subjects far less often than Feed does — see eventSubjectsRefresh in main.go.
	cycled := make(chan struct{})
	go func() {
		select {
		case <-readCtx.Done():
		case <-c.refresh:
			close(cycled)
			cancelRead()
		}
	}()

	// Keepalive on its own goroutine: okx disconnects after 30 seconds of silence and bybit after
	// ten minutes, and neither can be satisfied from inside a blocking read.
	if ping := c.wire.Ping(); ping != nil && c.wire.PingEvery() > 0 {
		go func() {
			ticker := time.NewTicker(c.wire.PingEvery())
			defer ticker.Stop()
			for {
				select {
				case <-readCtx.Done():
					return
				case <-ticker.C:
					if err := conn.Write(readCtx, ping); err != nil {
						// The read side will fail too and own the reconnect; this goroutine just
						// stops rather than racing it.
						return
					}
				}
			}
		}()
	}

	for {
		msgCtx, cancelMsg := context.WithTimeout(readCtx, c.opts.ReadTimeout)
		msg, err := conn.Read(msgCtx)
		cancelMsg()
		if err != nil {
			select {
			case <-cycled:
				return errResubscribe
			default:
			}
			return fmt.Errorf("read: %w", err)
		}
		if responder, answers := c.wire.(Responder); answers {
			if reply := responder.Respond(msg); reply != nil {
				if err := conn.Write(readCtx, reply); err != nil {
					return fmt.Errorf("respond: %w", err)
				}
			}
		}
		if err := c.handle(msg, c.opts.Now()); err != nil {
			// A venue rejecting a subscription is a fault worth surfacing, but not worth dropping a
			// connection that is otherwise delivering: the other topics keep flowing and the error
			// shows up on the next flush.
			c.setErr(err)
			c.logf("%s: %s", c.id, collector.DescribeError(err))
		}
	}
}

// sortedKeys is the subject snapshot helper both feeds use. Sorted so a reconnect sends the same
// frames in the same order, which makes a venue's own logs and ours line up when a subscription is
// rejected.
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for name := range m {
		keys = append(keys, name)
	}
	sort.Strings(keys)
	return keys
}
