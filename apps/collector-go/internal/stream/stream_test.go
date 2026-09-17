package stream

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/store"
)

// A scripted connection, which is the whole reason Conn and Dialer are interfaces. No server, no
// network, no sleeping on a real clock: the test writes the messages a venue would send and reads
// back what the feed wrote.
type fakeConn struct {
	mu       sync.Mutex
	messages chan []byte
	written  [][]byte
	closed   bool
	// failAfter ends the read loop with this error once the scripted messages run out. Nil means the
	// connection blocks instead, which is what a healthy socket does between messages.
	failAfter error
}

func newConn(msgs ...string) *fakeConn {
	c := &fakeConn{messages: make(chan []byte, len(msgs)+8)}
	for _, m := range msgs {
		c.messages <- []byte(m)
	}
	return c
}

func (c *fakeConn) Read(ctx context.Context) ([]byte, error) {
	select {
	case msg := <-c.messages:
		return msg, nil
	case <-ctx.Done():
		if c.failAfter != nil {
			return nil, c.failAfter
		}
		return nil, ctx.Err()
	}
}

func (c *fakeConn) Write(_ context.Context, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.written = append(c.written, append([]byte(nil), data...))
	return nil
}

func (c *fakeConn) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.closed = true
	return nil
}

func (c *fakeConn) writes() [][]byte {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([][]byte, len(c.written))
	copy(out, c.written)
	return out
}

type fakeSink struct {
	mu      sync.Mutex
	batches [][]store.Quote
	err     error
	unknown int
}

func (s *fakeSink) WriteQuotes(_ context.Context, quotes []store.Quote) (int, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.batches = append(s.batches, quotes)
	if s.err != nil {
		return 0, 0, s.err
	}
	return len(quotes) - s.unknown, s.unknown, nil
}

func (s *fakeSink) all() []store.Quote {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []store.Quote
	for _, batch := range s.batches {
		out = append(out, batch...)
	}
	return out
}

const ts = 1_789_147_120_000

func bookMsg(symbol string, bid, bidQty, ask, askQty string) string {
	sides := ""
	if bid != "" {
		sides += `"b":[["` + bid + `","` + bidQty + `"]],`
	} else {
		sides += `"b":[],`
	}
	if ask != "" {
		sides += `"a":[["` + ask + `","` + askQty + `"]]`
	} else {
		sides += `"a":[]`
	}
	return `{"topic":"orderbook.1.` + symbol + `","type":"delta","ts":` + itoa(ts) +
		`,"data":{"s":"` + symbol + `",` + sides + `}}`
}

func itoa(v int64) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// feedFor wires a feed to one scripted connection and returns both. The dialer hands out the same
// connection every time, so a reconnect is observable as a second subscribe.
func feedFor(t *testing.T, conn *fakeConn, sink Sink, subjects []Subject, opts Options) *Feed {
	t.Helper()
	if opts.Now == nil {
		opts.Now = func() time.Time { return time.UnixMilli(ts).UTC() }
	}
	if opts.Rand == nil {
		opts.Rand = func() float64 { return 1 }
	}
	dial := func(context.Context, string) (Conn, error) { return conn, nil }
	return New(Bybit{}, dial, sink, subjects, opts)
}

// waitFor polls until cond holds or the deadline passes. The feed is genuinely concurrent — a read
// goroutine, a flush goroutine and a keepalive — and a sleep-then-assert test on that is a flake
// waiting to happen.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(2 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func TestFeedSubscribesFlushesAndConverts(t *testing.T) {
	conn := newConn(bookMsg("BTCUSDT", "77766.7", "0.5", "77767.1", "0.25"))
	sink := &fakeSink{}
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: 5 * time.Millisecond})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "a flush", func() bool { return len(sink.all()) > 0 })
	_ = feed.Stop(context.Background())

	writes := conn.writes()
	if len(writes) == 0 {
		t.Fatal("nothing was sent: the feed must subscribe before it can receive")
	}
	var sub struct {
		Op   string   `json:"op"`
		Args []string `json:"args"`
	}
	if err := json.Unmarshal(writes[0], &sub); err != nil {
		t.Fatalf("first frame is not JSON: %v", err)
	}
	if sub.Op != "subscribe" || len(sub.Args) != 1 || sub.Args[0] != "orderbook.1.BTCUSDT" {
		t.Fatalf("first frame = %s, want a subscribe to orderbook.1.BTCUSDT", writes[0])
	}

	q := sink.all()[0]
	if q.VenueID != "bybit" || q.VenueSymbol != "BTCUSDT" {
		t.Fatalf("quote keyed %s/%s", q.VenueID, q.VenueSymbol)
	}
	if *q.BestBid != 77766.7 || *q.BestAsk != 77767.1 {
		t.Fatalf("prices = %v/%v", *q.BestBid, *q.BestAsk)
	}
	// Sizes are price x quantity, in USD: bybit quotes size in base coin.
	if *q.BestBidSize != 77766.7*0.5 || *q.BestAskSize != 77767.1*0.25 {
		t.Fatalf("sizes = %v/%v, want price x qty", *q.BestBidSize, *q.BestAskSize)
	}
	// The venue's publish time, not ours: quotes_at should say how old the BOOK is.
	if !q.At.Equal(time.UnixMilli(ts).UTC()) {
		t.Fatalf("At = %v, want the message's own ts", q.At)
	}
}

// The trap migration 013 documents for these exact three venues: the same book read at contract
// scale is a 10,000x error. A scaled contract's price must be divided by the multiplier; its size,
// already money, must not be.
func TestFeedRescalesPriceButNotSize(t *testing.T) {
	conn := newConn(bookMsg("1000PEPEUSDT", "0.00654", "1000", "0.00655", "2000"))
	sink := &fakeSink{}
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "1000PEPEUSDT", Multiplier: 1000}},
		Options{FlushEvery: 5 * time.Millisecond})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "a flush", func() bool { return len(sink.all()) > 0 })
	_ = feed.Stop(context.Background())

	q := sink.all()[0]
	if *q.BestBid != 0.00654/1000 {
		t.Fatalf("bid = %v, want the per-unit 0.00000654", *q.BestBid)
	}
	if *q.BestBidSize != 0.00654*1000 {
		t.Fatalf("bid size = %v, want price x qty in USD, unrescaled", *q.BestBidSize)
	}
}

// A delta carrying one side must leave the other alone. Bybit's orderbook.1 sends "b":[] for "the
// bid did not change", and treating that as "there is no bid" would erase half the book on most
// messages.
func TestADeltaLeavesTheUnchangedSideAlone(t *testing.T) {
	conn := newConn(
		bookMsg("BTCUSDT", "100", "1", "101", "1"),
		bookMsg("BTCUSDT", "", "", "102", "3"),
	)
	sink := &fakeSink{}
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: 5 * time.Millisecond})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "the second quote", func() bool {
		all := sink.all()
		return len(all) > 0 && all[len(all)-1].BestAsk != nil && *all[len(all)-1].BestAsk == 102
	})
	_ = feed.Stop(context.Background())

	last := sink.all()[len(sink.all())-1]
	if last.BestBid == nil || *last.BestBid != 100 {
		t.Fatalf("bid = %v, want the unchanged 100", last.BestBid)
	}
}

// A quantity of zero is a deletion, not a quote of zero size. Storing it as a price with no size
// would print a market as quoting where nobody is offering.
func TestAZeroQuantityClearsTheSide(t *testing.T) {
	conn := newConn(
		bookMsg("BTCUSDT", "100", "1", "101", "1"),
		bookMsg("BTCUSDT", "100", "0", "", ""),
	)
	sink := &fakeSink{}
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: 5 * time.Millisecond})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "the cleared bid", func() bool {
		all := sink.all()
		return len(all) > 0 && all[len(all)-1].BestBid == nil
	})
	_ = feed.Stop(context.Background())

	last := sink.all()[len(sink.all())-1]
	if last.BestBidSize != nil {
		t.Fatalf("bid size = %v, want null beside the cleared price", *last.BestBidSize)
	}
	if last.BestAsk == nil || *last.BestAsk != 101 {
		t.Fatalf("ask = %v, want the untouched 101", last.BestAsk)
	}
}

// Nothing changed, nothing written. A venue pushing heartbeats and repeats must not cost a write per
// flush window on a database shared with sixteen other tenants.
func TestAnUnchangedBookIsNotRewritten(t *testing.T) {
	conn := newConn(
		bookMsg("BTCUSDT", "100", "1", "101", "1"),
		bookMsg("BTCUSDT", "100", "1", "101", "1"),
	)
	sink := &fakeSink{}
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: 5 * time.Millisecond})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "the first flush", func() bool { return len(sink.all()) > 0 })
	time.Sleep(50 * time.Millisecond) // several flush windows, with nothing new to say
	_ = feed.Stop(context.Background())

	if got := len(sink.all()); got != 1 {
		t.Fatalf("%d quotes written, want exactly 1 for one distinct book", got)
	}
}

// A market nobody subscribed to is not stored. The feed's map is its allowlist, so a venue sending
// an unexpected topic cannot grow memory without bound.
func TestQuotesForUnsubscribedMarketsAreDropped(t *testing.T) {
	conn := newConn(bookMsg("ETHUSDT", "3000", "1", "3001", "1"))
	sink := &fakeSink{}
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: 5 * time.Millisecond})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	time.Sleep(30 * time.Millisecond)
	_ = feed.Stop(context.Background())

	if got := len(sink.all()); got != 0 {
		t.Fatalf("%d quotes written for an unsubscribed market", got)
	}
}

// The health story: a flush IS a run, so /health, /status and the stale-venue alerter keep working
// without learning what a socket is.
func TestEachFlushSynthesizesARun(t *testing.T) {
	conn := newConn(bookMsg("BTCUSDT", "100", "1", "101", "1"))
	sink := &fakeSink{}
	var mu sync.Mutex
	var runs []collector.Run
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}}, Options{
		FlushEvery: 5 * time.Millisecond,
		OnFlush: func(r collector.Run) {
			mu.Lock()
			runs = append(runs, r)
			mu.Unlock()
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "a run", func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(runs) > 0
	})
	_ = feed.Stop(context.Background())

	mu.Lock()
	defer mu.Unlock()
	first := runs[0]
	// The feed's own id, NOT the venue's: a live socket must not satisfy the staleness check for a
	// venue whose funding poll has died.
	if first.VenueID != "bybit:ws" {
		t.Fatalf("run recorded under %q, want bybit:ws", first.VenueID)
	}
	if first.Markets != 1 {
		t.Fatalf("markets = %d, want the 1 quote written", first.Markets)
	}
	// Nothing was requested. Zero is the honest number for a push feed and makes one legible as such
	// on /status, where every polled venue reports a request count.
	if first.Requests != 0 {
		t.Fatalf("requests = %d, want 0", first.Requests)
	}
	if first.Err != nil {
		t.Fatalf("err = %v, want nil on a healthy flush", first.Err)
	}
}

// A connected-but-silent socket is the failure a reconnect cannot see: nothing errors, nothing
// arrives. It must flush zero markets so the ordinary staleness machinery catches it.
func TestASilentFeedFlushesZeroMarkets(t *testing.T) {
	conn := newConn()
	sink := &fakeSink{}
	var mu sync.Mutex
	var runs []collector.Run
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}}, Options{
		FlushEvery: 5 * time.Millisecond,
		OnFlush: func(r collector.Run) {
			mu.Lock()
			runs = append(runs, r)
			mu.Unlock()
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "a run", func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(runs) > 0
	})
	_ = feed.Stop(context.Background())

	mu.Lock()
	defer mu.Unlock()
	if runs[0].Markets != 0 {
		t.Fatalf("markets = %d, want 0 from a silent connection", runs[0].Markets)
	}
	if len(sink.all()) != 0 {
		t.Fatal("a silent feed wrote quotes")
	}
}

// A rejected subscription is reported without dropping a connection that is otherwise delivering:
// the other topics keep flowing, and the fault appears on the next flush.
func TestARejectedSubscriptionSurfacesWithoutKillingTheConnection(t *testing.T) {
	conn := newConn(
		`{"success":false,"ret_msg":"Invalid symbol","op":"subscribe"}`,
		bookMsg("BTCUSDT", "100", "1", "101", "1"),
	)
	sink := &fakeSink{}
	var mu sync.Mutex
	var runs []collector.Run
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}}, Options{
		FlushEvery: 5 * time.Millisecond,
		OnFlush: func(r collector.Run) {
			mu.Lock()
			runs = append(runs, r)
			mu.Unlock()
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "the quote that followed the rejection", func() bool { return len(sink.all()) > 0 })
	waitFor(t, "a run carrying the rejection", func() bool {
		mu.Lock()
		defer mu.Unlock()
		for _, r := range runs {
			if r.Err != nil {
				return true
			}
		}
		return false
	})
	_ = feed.Stop(context.Background())
}

// A write failure must not be swallowed by the connection's own health: a feed that cannot write is
// broken whatever the socket is doing.
func TestAFailedFlushIsReportedAsTheRunsError(t *testing.T) {
	conn := newConn(bookMsg("BTCUSDT", "100", "1", "101", "1"))
	sink := &fakeSink{err: errors.New("pool exhausted")}
	var mu sync.Mutex
	var runs []collector.Run
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}}, Options{
		FlushEvery: 5 * time.Millisecond,
		OnFlush: func(r collector.Run) {
			mu.Lock()
			runs = append(runs, r)
			mu.Unlock()
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "a failed run", func() bool {
		mu.Lock()
		defer mu.Unlock()
		for _, r := range runs {
			if r.Err != nil && r.Markets == 0 {
				return true
			}
		}
		return false
	})
	_ = feed.Stop(context.Background())
}

// Stop closes the socket and flushes what is in hand. A deploy should not throw away quotes already
// received, and it must return inside the shutdown grace period.
func TestStopFlushesAndClosesTheConnection(t *testing.T) {
	conn := newConn(bookMsg("BTCUSDT", "100", "1", "101", "1"))
	sink := &fakeSink{}
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: time.Hour}) // never fires on its own: only the shutdown flush can write

	ctx, cancel := context.WithCancel(context.Background())
	feed.Start(ctx)
	waitFor(t, "the message to be read", func() bool { return len(conn.writes()) > 0 })
	time.Sleep(20 * time.Millisecond)
	cancel()

	stopCtx, stopCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer stopCancel()
	if err := feed.Stop(stopCtx); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	if len(sink.all()) != 1 {
		t.Fatalf("%d quotes written on shutdown, want the 1 held in memory", len(sink.all()))
	}
	conn.mu.Lock()
	defer conn.mu.Unlock()
	if !conn.closed {
		t.Fatal("the connection was left open")
	}
}

func TestBybitFramesChunkUnderTheDocumentedCap(t *testing.T) {
	symbols := make([]string, 833) // the whole book, as W0 measured it
	for i := range symbols {
		symbols[i] = "SYMBOL" + itoa(int64(i)) + "USDT"
	}
	frames := Bybit{}.Frames(symbols)
	if len(frames) != 5 {
		t.Fatalf("%d frames for 833 topics at %d per frame", len(frames), topicsPerFrame)
	}
	total := 0
	for _, frame := range frames {
		// The cap is 21,000 characters of `args`; measuring the whole frame is the conservative
		// reading and still leaves three quarters of the budget.
		if len(frame) > 21_000 {
			t.Fatalf("a frame is %d bytes, over bybit's 21,000-character args cap", len(frame))
		}
		var sub struct {
			Args []string `json:"args"`
		}
		if err := json.Unmarshal(frame, &sub); err != nil {
			t.Fatalf("frame is not JSON: %v", err)
		}
		total += len(sub.Args)
	}
	if total != len(symbols) {
		t.Fatalf("%d topics across the frames, want every one of %d", total, len(symbols))
	}
}

func TestBybitDecodeIgnoresWhatIsNotABook(t *testing.T) {
	for _, msg := range []string{
		`{"op":"pong","success":true}`,
		`{"topic":"tickers.BTCUSDT","data":{"s":"BTCUSDT"}}`,
		`{"topic":"orderbook.1.BTCUSDT","type":"delta","ts":1,"data":{"s":"BTCUSDT","b":[],"a":[]}}`,
	} {
		updates, err := Bybit{}.Decode([]byte(msg), time.Now())
		if err != nil {
			t.Fatalf("Decode(%s) errored: %v", msg, err)
		}
		if len(updates) != 0 {
			t.Fatalf("Decode(%s) produced %d updates, want none", msg, len(updates))
		}
	}
}

// --- W4: the subscription set changes while the feed is running ---------------------------------

// A market listed after the feed started must join without a process restart, and one that leaves
// must stop holding a topic and a book.
func TestSetSubjectsAddsAndRemovesWithoutARestart(t *testing.T) {
	conn := newConn(bookMsg("BTCUSDT", "100", "1", "101", "1"))
	sink := &fakeSink{}
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: 5 * time.Millisecond})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "the first subscribe", func() bool { return len(conn.writes()) > 0 })

	added, removed := feed.SetSubjects([]Subject{
		{VenueSymbol: "ETHUSDT", Multiplier: 1},
		{VenueSymbol: "SOLUSDT", Multiplier: 1},
	})
	if added != 2 || removed != 1 {
		t.Fatalf("added=%d removed=%d, want 2 and 1", added, removed)
	}
	if feed.Subjects() != 2 {
		t.Fatalf("Subjects() = %d, want 2", feed.Subjects())
	}

	// The connection is cycled so the new set takes effect: a second subscribe frame, naming the
	// markets that were not there before.
	waitFor(t, "the re-subscribe", func() bool {
		for _, frame := range conn.writes() {
			if strings.Contains(string(frame), "orderbook.1.SOLUSDT") {
				return true
			}
		}
		return false
	})

	// A quote for the market that left is no longer stored.
	conn.messages <- []byte(bookMsg("BTCUSDT", "200", "1", "201", "1"))
	conn.messages <- []byte(bookMsg("ETHUSDT", "3000", "1", "3001", "1"))
	waitFor(t, "a quote for the added market", func() bool {
		for _, q := range sink.all() {
			if q.VenueSymbol == "ETHUSDT" {
				return true
			}
		}
		return false
	})
	_ = feed.Stop(context.Background())

	for _, q := range sink.all() {
		if q.VenueSymbol == "BTCUSDT" && q.BestBid != nil && *q.BestBid == 200 {
			t.Fatal("a quote was stored for a market that had been removed")
		}
	}
}

// A re-subscribe is not a fault. Counting it towards the circuit breaker would let a refresh every
// fifteen minutes eventually trip a feed that had never actually failed.
func TestARefreshIsNotCountedAsAConnectionFailure(t *testing.T) {
	conn := newConn()
	sink := &fakeSink{}
	var logs []string
	var mu sync.Mutex
	feed := feedFor(t, conn, sink, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}}, Options{
		FlushEvery: 5 * time.Millisecond,
		Log: func(message string) {
			mu.Lock()
			logs = append(logs, message)
			mu.Unlock()
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "the first subscribe", func() bool { return len(conn.writes()) > 0 })

	for i := 0; i < 6; i++ { // more than FailureThreshold, which is 5
		feed.SetSubjects([]Subject{{VenueSymbol: "SYM" + itoa(int64(i)) + "USDT", Multiplier: 1}})
		waitFor(t, "the re-subscribe to land", func() bool {
			for _, frame := range conn.writes() {
				if strings.Contains(string(frame), "orderbook.1.SYM"+itoa(int64(i))+"USDT") {
					return true
				}
			}
			return false
		})
	}
	_ = feed.Stop(context.Background())

	mu.Lock()
	defer mu.Unlock()
	for _, message := range logs {
		if strings.Contains(message, "consecutive failures") || strings.Contains(message, "connection ended") {
			t.Fatalf("a refresh was reported as a connection failure: %q", message)
		}
	}
}

// An empty set is refused. A collector cycle that has not landed, or a venue mid-outage, would
// otherwise unsubscribe the whole feed and leave it connected to nothing — which reads on /status
// as a healthy feed with no markets.
func TestAnEmptySubjectSetIsRefused(t *testing.T) {
	conn := newConn()
	feed := feedFor(t, conn, &fakeSink{}, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: time.Hour})

	if added, removed := feed.SetSubjects(nil); added != 0 || removed != 0 {
		t.Fatalf("added=%d removed=%d for an empty set", added, removed)
	}
	if feed.Subjects() != 1 {
		t.Fatalf("Subjects() = %d, want the previous set kept", feed.Subjects())
	}
}

// An unchanged set must not cycle the connection: the refresh task runs every fifteen minutes and
// almost always finds nothing new.
func TestAnUnchangedSubjectSetDoesNotReconnect(t *testing.T) {
	conn := newConn()
	feed := feedFor(t, conn, &fakeSink{}, []Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}},
		Options{FlushEvery: time.Hour})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	feed.Start(ctx)
	waitFor(t, "the first subscribe", func() bool { return len(conn.writes()) > 0 })
	before := len(conn.writes())

	if added, removed := feed.SetSubjects([]Subject{{VenueSymbol: "BTCUSDT", Multiplier: 1}}); added != 0 || removed != 0 {
		t.Fatalf("added=%d removed=%d for an identical set", added, removed)
	}
	time.Sleep(50 * time.Millisecond)
	_ = feed.Stop(context.Background())

	if got := len(conn.writes()); got != before {
		t.Fatalf("%d frames sent after an identical set, was %d -- the connection was cycled for nothing", got, before)
	}
}
