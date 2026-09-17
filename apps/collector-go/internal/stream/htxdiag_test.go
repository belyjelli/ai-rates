package stream

import (
	"context"
	"os"
	"testing"
	"time"
)

// A frame-level trace of one htx connection: every inflated message in, every reply out.
//
// WHY IT IS KEPT rather than deleted with the bug it found. On 2026-09-18 htx accepted the
// subscribe and then hung up with "Bye" every ~30 seconds. No unit test could see why, because the
// cause was a message the decoder silently declined to parse — htx quotes its ping's `ts` and does
// not quote the subscribe ack's, so an int64 field made Unmarshal fail and the pong never went out.
// Printing the actual frames is what found it in one run, and it is the only tool that can answer
// "what is this venue waiting for" the next time one of these feeds is dropped without an error.
//
// Read it as a trace, not as a pass/fail: a healthy run shows a RECV ping answered by a SENT pong
// every ~5 seconds and no close. TestLiveLiquidationFeed is the one that actually asserts.
//
//	LIQ_DIAG=1 go test ./internal/stream/ -run TestHTXDiagnostic -v -timeout 3m
func TestHTXDiagnostic(t *testing.T) {
	if os.Getenv("LIQ_DIAG") != "1" {
		t.Skip("set LIQ_DIAG=1 to trace one htx connection")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 70*time.Second)
	defer cancel()

	proto := HTXLiquidations{}
	conn, err := Dial(ctx, proto.URL())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	for _, frame := range proto.Frames(nil) {
		if err := conn.Write(ctx, frame); err != nil {
			t.Fatalf("subscribe: %v", err)
		}
		t.Logf("SENT %s", frame)
	}

	start := time.Now()
	pings, pongs := 0, 0
	for {
		msg, err := conn.Read(ctx)
		if err != nil {
			// The close is the interesting part: how long the venue tolerated us, and after how
			// many unanswered pings.
			t.Logf("CLOSED after %s (%d pings seen, %d answered): %v",
				time.Since(start).Round(time.Second), pings, pongs, err)
			return
		}
		body, gzErr := gunzip(msg)
		if gzErr != nil {
			t.Logf("RECV (not gzip, %d bytes) %q", len(msg), string(msg[:minInt(len(msg), 120)]))
			continue
		}
		t.Logf("RECV %s", string(body[:minInt(len(body), 160)]))
		if len(body) > 12 && string(body[:12]) == `{"op":"ping"` {
			pings++
		}

		reply := proto.Respond(msg)
		if reply == nil {
			continue
		}
		if err := conn.Write(ctx, reply); err != nil {
			t.Logf("WRITE FAILED: %v", err)
			return
		}
		pongs++
		t.Logf("SENT %s", reply)
	}
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
