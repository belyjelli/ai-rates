package stream

import (
	"context"
	"net/http"
	"time"

	"github.com/coder/websocket"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Dial is the production Dialer: coder/websocket, with the collector's own User-Agent.
//
// The library is the one profitlock-worker's internal/relay/client.go already runs in production —
// chosen there for a context-aware Read and a Close that does not require a separate goroutine, and
// the same two properties are what let Feed.run be an ordinary loop here.
func Dial(ctx context.Context, url string) (Conn, error) {
	conn, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{
		HTTPHeader: http.Header{"User-Agent": []string{httpclient.UserAgent}},
	})
	if err != nil {
		return nil, err
	}
	// Bybit's whole book at depth 1 is small per message — a few hundred bytes — but a venue is free
	// to send a large snapshot, and the default limit is 32 KiB. 1 MiB is generous without letting
	// one connection page in unbounded memory on a 1 GB container, matching httpclient's reasoning
	// about its own body cap.
	conn.SetReadLimit(1 << 20)
	return &coderConn{conn: conn}, nil
}

type coderConn struct{ conn *websocket.Conn }

func (c *coderConn) Read(ctx context.Context) ([]byte, error) {
	_, data, err := c.conn.Read(ctx)
	return data, err
}

func (c *coderConn) Write(ctx context.Context, data []byte) error {
	// A write that cannot complete in ten seconds is a connection that is gone; without a deadline
	// of its own a blocked write would hold the keepalive goroutine forever.
	writeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return c.conn.Write(writeCtx, websocket.MessageText, data)
}

func (c *coderConn) Close() error {
	// StatusNormalClosure so the venue sees a clean goodbye on shutdown rather than a dropped TCP
	// connection it has to time out.
	return c.conn.Close(websocket.StatusNormalClosure, "")
}
