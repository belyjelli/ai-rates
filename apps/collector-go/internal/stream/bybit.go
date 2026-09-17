package stream

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Bybit speaks v5 public linear.
//
// WHY BYBIT IS THE FIRST VENUE. It is the only one of the three with a documented hard limit —
// 21,000 characters of `args` per request — so the chunking is written against a real constraint
// rather than a guess. Gate and okx document no per-connection cap at all, and W0 found neither
// enforcing one, which makes them the wrong venues to design the sharding logic against.
//
// MEASURED (W0, 2026-09-17, hklab): 833 topics requested, 833 delivering, on ONE connection, at
// 1,104 messages a second. At roughly 21 characters per topic including JSON quoting, the whole book
// is about 17.5k characters — inside the cap, but not by much, which is why Frames chunks at all.
type Bybit struct{}

func (Bybit) VenueID() string { return "bybit" }

func (Bybit) URL() string { return "wss://stream.bybit.com/v5/public/linear" }

// topicsPerFrame is deliberately far below the 21,000-character cap.
//
// 200 topics is roughly 4,200 characters, a quarter of the budget. The cap is on a REQUEST, not on
// the connection, so nothing is lost by sending five small frames instead of one large one — and a
// venue that rejects one frame then rejects a fifth of the book rather than all of it.
const topicsPerFrame = 200

func (Bybit) Frames(symbols []string) [][]byte {
	frames := make([][]byte, 0, (len(symbols)+topicsPerFrame-1)/topicsPerFrame)
	for start := 0; start < len(symbols); start += topicsPerFrame {
		end := start + topicsPerFrame
		if end > len(symbols) {
			end = len(symbols)
		}
		args := make([]string, 0, end-start)
		for _, symbol := range symbols[start:end] {
			args = append(args, "orderbook.1."+symbol)
		}
		frame, err := json.Marshal(map[string]any{"op": "subscribe", "args": args})
		if err != nil {
			continue // unreachable for []string, and a dropped frame is better than a panic here
		}
		frames = append(frames, frame)
	}
	return frames
}

// FramePause paces the subscribe frames. Bybit documents no requests-per-second limit on the
// control channel, but W0 sent them 350ms apart and every topic was accepted; keeping that spacing
// costs under two seconds for the whole book and is one fewer thing changed from a measured run.
func (Bybit) FramePause() time.Duration { return 350 * time.Millisecond }

// Ping every 20 seconds. Bybit closes a connection that has been silent for 10 minutes; 20 seconds
// is the interval its own documentation asks for, and it doubles as a liveness check that costs
// nothing.
func (Bybit) Ping() []byte { return []byte(`{"op":"ping"}`) }

func (Bybit) PingEvery() time.Duration { return 20 * time.Second }

// bybitMessage is the envelope, of which three shapes matter: a book update, a subscription result,
// and everything else (pongs, which we ignore).
type bybitMessage struct {
	Topic   string `json:"topic"`
	Type    string `json:"type"`
	TS      int64  `json:"ts"`
	Success *bool  `json:"success"`
	RetMsg  string `json:"ret_msg"`
	Op      string `json:"op"`
	Data    struct {
		Symbol string              `json:"s"`
		Bids   [][]json.RawMessage `json:"b"`
		Asks   [][]json.RawMessage `json:"a"`
	} `json:"data"`
}

// Decode reads one message.
//
// DELTAS, WHICH THE PLAN SAID WOULD NOT MATTER. Section 8 records the decision to use orderbook.1
// rather than the `tickers` channel precisely because tickers is delta for linear — but orderbook.1
// is itself snapshot-then-delta: the first message per topic carries type "snapshot" and later ones
// carry "delta" with only the side that changed. At depth 1 that needs no U/u resync machinery, and
// this is the whole of the handling:
//
//   - an absent or empty side means "unchanged", and yields no update for that side;
//   - a level with quantity 0 means the best level was REMOVED, which the feed stores as a cleared
//     side rather than as a quote of zero (see (*book).apply);
//   - anything else replaces that side.
//
// A "snapshot" needs no special case: at depth 1 it is a delta that happens to carry both sides.
func (Bybit) Decode(msg []byte, now time.Time) ([]Update, error) {
	var m bybitMessage
	if err := json.Unmarshal(msg, &m); err != nil {
		// Not JSON we understand. Bybit does not send such messages, so this is a wire-level
		// surprise worth naming rather than a routine event.
		return nil, fmt.Errorf("bybit: unreadable message: %w", err)
	}
	if m.Success != nil && !*m.Success {
		return nil, fmt.Errorf("bybit: %s rejected: %s", m.Op, m.RetMsg)
	}
	if !strings.HasPrefix(m.Topic, "orderbook.1.") {
		return nil, nil // acks, pongs, anything else
	}
	symbol := m.Data.Symbol
	if symbol == "" {
		symbol = strings.TrimPrefix(m.Topic, "orderbook.1.")
	}
	at := now
	if m.TS > 0 {
		// The venue's own publish time, not ours. It is what quotes_at should carry: the age a
		// reader cares about is the book's, and our receive time hides transit and queueing.
		at = time.UnixMilli(m.TS).UTC()
	}
	update := Update{Symbol: symbol, At: at}
	if len(m.Data.Bids) > 0 && len(m.Data.Bids[0]) >= 2 {
		update.Bid = parseFloat(m.Data.Bids[0][0])
		update.BidQty = parseFloat(m.Data.Bids[0][1])
	}
	if len(m.Data.Asks) > 0 && len(m.Data.Asks[0]) >= 2 {
		update.Ask = parseFloat(m.Data.Asks[0][0])
		update.AskQty = parseFloat(m.Data.Asks[0][1])
	}
	if update.Bid == nil && update.Ask == nil {
		return nil, nil
	}
	return []Update{update}, nil
}
