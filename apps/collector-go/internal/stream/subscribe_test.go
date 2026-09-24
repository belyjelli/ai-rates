package stream

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

// replyingConn answers every subscribe frame with a reply and drops the connection once more than
// maxUnread replies are waiting, which is what Lighter did to a client that subscribed to 211 markets
// before reading any of the answers (2026-09-24).
type replyingConn struct {
	mu        sync.Mutex
	replies   chan []byte
	maxUnread int
	written   int
	dropped   bool
}

func (c *replyingConn) Read(ctx context.Context) ([]byte, error) {
	select {
	case msg := <-c.replies:
		return msg, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (c *replyingConn) Write(_ context.Context, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.dropped || len(c.replies) >= c.maxUnread {
		c.dropped = true
		return errors.New("connection dropped: slow reader")
	}
	if strings.Contains(string(data), "subscribe") {
		c.written++
		c.replies <- []byte(`{"type":"subscribed"}`)
	}
	return nil
}

func (c *replyingConn) Close() error { return nil }

// manyFrames is a wire with twenty paced subscribe frames and no keepalive.
type manyFrames struct{}

func (manyFrames) VenueID() string { return "test" }
func (manyFrames) URL() string     { return "wss://test" }
func (manyFrames) Frames(symbols []string) [][]byte {
	frames := make([][]byte, len(symbols))
	for i, symbol := range symbols {
		frames[i] = []byte(`{"type":"subscribe","channel":"` + symbol + `"}`)
	}
	return frames
}
func (manyFrames) FramePause() time.Duration { return time.Millisecond }
func (manyFrames) Ping() []byte              { return nil }
func (manyFrames) PingEvery() time.Duration  { return 0 }

func TestSubscribeRepliesAreReadWhileSubscribing(t *testing.T) {
	conn := &replyingConn{replies: make(chan []byte, 64), maxUnread: 3}
	symbols := make([]string, 20)
	for i := range symbols {
		symbols[i] = "m" + string(rune('a'+i))
	}
	c := newConnector(manyFrames{}, func(context.Context, string) (Conn, error) { return conn, nil },
		Options{DialTimeout: time.Second, ReadTimeout: time.Minute, Now: time.Now}, "test", true)
	c.subjects = func() []string { return symbols }
	var read int
	c.handle = func([]byte, time.Time) error { read++; return nil }

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	err := c.run(ctx)

	if strings.Contains(err.Error(), "subscribe frame") {
		t.Fatalf("the venue dropped us mid-subscribe, so replies were not read while subscribing: %v", err)
	}
	conn.mu.Lock()
	defer conn.mu.Unlock()
	if conn.written != 20 {
		t.Errorf("subscribe frames sent: got %d, want 20", conn.written)
	}
}
