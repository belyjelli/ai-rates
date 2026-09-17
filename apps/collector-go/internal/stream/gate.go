package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters/gate"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Gate speaks v4 USDT futures, channel futures.book_ticker.
//
// MEASURED (W0, 2026-09-17, hklab): 977 topics requested, 843 delivering within a 64-second window
// on ONE connection, at 1,036 messages a second. The 134 that said nothing are illiquid contracts
// that had not ticked — the same run showed 522 at 8 seconds and 843 at 64 — not topics refused.
// Gate documents no per-connection cap and enforced none.
//
// `!all` exists on this venue but only for futures.public_liquidates and futures.adl_warning, so
// there is no all-symbols form for the book and topics scale with the market count.
type Gate struct {
	client *httpclient.Client

	// mu guards quanto, which Prepare replaces wholesale on every (re)connect and the read loop
	// reads on every message.
	mu sync.RWMutex
	// quanto is base units per contract, per symbol. Gate sizes a book in CONTRACTS.
	quanto map[string]float64
}

func NewGate(client *httpclient.Client) *Gate {
	return &Gate{client: client, quanto: map[string]float64{}}
}

func (*Gate) VenueID() string { return "gate" }

func (*Gate) URL() string { return "wss://fx-ws.gateio.ws/v4/ws/usdt" }

// gateTopicsPerFrame: gate documents no cap on a subscribe payload, and W0 sent 100 at a time for
// the whole book without a rejection. Kept at the measured value rather than raised on the strength
// of an undocumented limit holding.
const gateTopicsPerFrame = 100

func (*Gate) Frames(symbols []string) [][]byte {
	frames := make([][]byte, 0, (len(symbols)+gateTopicsPerFrame-1)/gateTopicsPerFrame)
	for start := 0; start < len(symbols); start += gateTopicsPerFrame {
		end := start + gateTopicsPerFrame
		if end > len(symbols) {
			end = len(symbols)
		}
		frame, err := json.Marshal(map[string]any{
			"time":    time.Now().Unix(),
			"channel": "futures.book_ticker",
			"event":   "subscribe",
			"payload": symbols[start:end],
		})
		if err != nil {
			continue
		}
		frames = append(frames, frame)
	}
	return frames
}

func (*Gate) FramePause() time.Duration { return 350 * time.Millisecond }

// Gate answers protocol pings, and futures.ping is its application-level equivalent. Sent on the
// same 20-second cadence as the other two venues so one constant governs the fleet's liveness.
func (*Gate) Ping() []byte {
	frame, _ := json.Marshal(map[string]any{
		"time":    time.Now().Unix(),
		"channel": "futures.ping",
	})
	return frame
}

func (*Gate) PingEvery() time.Duration { return 20 * time.Second }

// Prepare reads the contract list for quanto_multiplier — base units per contract.
//
// The same call the REST adapter makes every cycle, for the same field. It is re-read on every
// reconnect rather than cached for the process's life: a contract listed while the feed was running
// would otherwise stream a book with no depth beside it.
func (g *Gate) Prepare(ctx context.Context, _ []string) error {
	var contracts []gate.Contract
	if err := g.client.GetJSON(ctx, "https://api.gateio.ws/api/v4/futures/usdt/contracts", &contracts); err != nil {
		return fmt.Errorf("gate contracts: %w", err)
	}
	quanto := make(map[string]float64, len(contracts))
	for _, contract := range contracts {
		if contract.QuantoMultiplier.OK && contract.QuantoMultiplier.Val > 0 {
			quanto[contract.Name] = contract.QuantoMultiplier.Val
		}
	}
	if len(quanto) == 0 {
		return fmt.Errorf("gate contracts: no quanto multipliers in %d contracts", len(contracts))
	}
	g.mu.Lock()
	g.quanto = quanto
	g.mu.Unlock()
	return nil
}

// SizeUSD: gate quotes sizes in CONTRACTS, and quanto_multiplier says what a contract holds —
// BTC_USDT is 0.0001 BTC. So money is contracts x base-per-contract x price, exactly as the REST
// adapter computes it (gate.go:131) and exactly as open_interest_usd is computed from total_size.
//
// A symbol whose multiplier is unknown returns nil rather than a raw contract count, which would be
// a number four orders of magnitude wrong on BTC and read as dollars.
func (g *Gate) SizeUSD(symbol string, price, qty float64) *float64 {
	g.mu.RLock()
	multiplier, known := g.quanto[symbol]
	g.mu.RUnlock()
	if !known {
		return nil
	}
	usd := qty * multiplier * price
	return &usd
}

// gateMessage is the book_ticker envelope. The `result` object is flat: one market per message.
type gateMessage struct {
	Channel string          `json:"channel"`
	Event   string          `json:"event"`
	Error   json.RawMessage `json:"error"`
	Result  struct {
		TimeMs int64           `json:"t"`
		Symbol string          `json:"s"`
		Bid    json.RawMessage `json:"b"`
		BidQty json.RawMessage `json:"B"`
		Ask    json.RawMessage `json:"a"`
		AskQty json.RawMessage `json:"A"`
	} `json:"result"`
}

// Decode reads one message.
//
// book_ticker is a SNAPSHOT channel: every message carries both sides, so there is no unchanged-side
// case to handle as there is on bybit. A size of zero is still treated as a removal by the shared
// book logic, which costs nothing and keeps the three venues' semantics identical.
func (*Gate) Decode(msg []byte, now time.Time) ([]Update, error) {
	var m gateMessage
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("gate: unreadable message: %w", err)
	}
	// Gate reports a failed subscribe as an `error` object on the subscribe ack, and null otherwise.
	if len(m.Error) > 0 && string(m.Error) != "null" {
		return nil, fmt.Errorf("gate: %s %s failed: %s", m.Channel, m.Event, m.Error)
	}
	if m.Channel != "futures.book_ticker" || m.Event != "update" || m.Result.Symbol == "" {
		return nil, nil
	}
	at := now
	if m.Result.TimeMs > 0 {
		at = time.UnixMilli(m.Result.TimeMs).UTC()
	}
	update := Update{
		Symbol: m.Result.Symbol,
		At:     at,
		Bid:    parseFloat(m.Result.Bid),
		BidQty: parseFloat(m.Result.BidQty),
		Ask:    parseFloat(m.Result.Ask),
		AskQty: parseFloat(m.Result.AskQty),
	}
	if update.Bid == nil && update.Ask == nil {
		return nil, nil
	}
	return []Update{update}, nil
}
