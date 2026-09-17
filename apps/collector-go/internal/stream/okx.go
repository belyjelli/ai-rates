package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters/okx"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// OKX speaks v5 public, channel bbo-tbt.
//
// MEASURED (W0, 2026-09-17, hklab): 483 topics requested, 483 delivering on ONE connection, at 787
// messages a second. OKX documents a 64 KB limit per REQUEST and no per-connection topic cap, and
// enforced none.
//
// REGION. OKX splits its endpoints, and this is the EEA/global one. W0 ran from hklab and every
// subscription was accepted; a feed run from somewhere else may need a different host, which is one
// of the reasons the plan requires these measurements to come from the box that will run them.
type OKX struct {
	client *httpclient.Client

	mu sync.RWMutex
	// contract is what one contract is worth, per instrument. See SizeUSD for why it is two numbers.
	contract map[string]okxContract
}

// okxContract is one instrument's size metadata, reduced to what a book conversion needs.
type okxContract struct {
	// base is base units per contract (ctVal x ctMult) for a LINEAR swap, and zero for an inverse.
	base float64
	// usd is dollars per contract for an INVERSE swap (ctValCcy "USD"), and zero for a linear one.
	usd float64
}

func NewOKX(client *httpclient.Client) *OKX {
	return &OKX{client: client, contract: map[string]okxContract{}}
}

func (*OKX) VenueID() string { return "okx" }

func (*OKX) URL() string { return "wss://ws.okx.com:8443/ws/v5/public" }

// okxTopicsPerFrame: at roughly 60 bytes per arg object, 200 is about 12 KB against a documented
// 64 KB per-request limit, and it is what W0 sent.
const okxTopicsPerFrame = 200

func (*OKX) Frames(symbols []string) [][]byte {
	frames := make([][]byte, 0, (len(symbols)+okxTopicsPerFrame-1)/okxTopicsPerFrame)
	for start := 0; start < len(symbols); start += okxTopicsPerFrame {
		end := start + okxTopicsPerFrame
		if end > len(symbols) {
			end = len(symbols)
		}
		args := make([]map[string]string, 0, end-start)
		for _, symbol := range symbols[start:end] {
			args = append(args, map[string]string{"channel": "bbo-tbt", "instId": symbol})
		}
		frame, err := json.Marshal(map[string]any{"op": "subscribe", "args": args})
		if err != nil {
			continue
		}
		frames = append(frames, frame)
	}
	return frames
}

// FramePause honours okx's documented 3 requests per second on a connection. 350ms is under it with
// room to spare, and is the spacing W0 measured at.
func (*OKX) FramePause() time.Duration { return 350 * time.Millisecond }

// Ping is a literal string, not JSON — okx's own convention — and the interval is the tightest in
// the fleet because okx disconnects after 30 SECONDS of silence. A venue that cuts the connection
// twice a minute would otherwise look like a venue with a network problem.
func (*OKX) Ping() []byte { return []byte("ping") }

func (*OKX) PingEvery() time.Duration { return 20 * time.Second }

// Prepare reads /public/instruments for ctVal, ctMult and ctValCcy — the same call the REST adapter
// makes every cycle, for the same three fields.
func (o *OKX) Prepare(ctx context.Context, _ []string) error {
	var env okx.Envelope[okx.Instrument]
	if err := o.client.GetJSON(ctx, "https://www.okx.com/api/v5/public/instruments?instType=SWAP", &env); err != nil {
		return fmt.Errorf("okx instruments: %w", err)
	}
	contracts := make(map[string]okxContract, len(env.Data))
	for _, instrument := range env.Data {
		if !instrument.CtVal.OK || instrument.CtVal.Val <= 0 {
			continue
		}
		ctMult := 1.0
		if instrument.CtMult.OK && instrument.CtMult.Val > 0 {
			ctMult = instrument.CtMult.Val
		}
		size := instrument.CtVal.Val * ctMult
		if instrument.CtValCcy == "USD" {
			contracts[instrument.InstID] = okxContract{usd: size}
			continue
		}
		contracts[instrument.InstID] = okxContract{base: size}
	}
	if len(contracts) == 0 {
		return fmt.Errorf("okx instruments: no contract sizes in %d instruments", len(env.Data))
	}
	o.mu.Lock()
	o.contract = contracts
	o.mu.Unlock()
	return nil
}

// SizeUSD: okx quotes sizes in CONTRACTS, and ctVal says what a contract holds.
//
// TWO CASES, and conflating them is the bug okx.go:453 already documents for the liquidation feed.
// A linear swap's contract is denominated in the base coin, so money needs the price. An INVERSE
// swap's contract (ctValCcy "USD" — fifteen of them) is already denominated in dollars, and
// multiplying by the price would inflate it by the price of the coin.
//
// Note which price this uses: the venue-quoted one, unrescaled. The feed's multiplier rescale is for
// symbols that name a scaled unit; okx expresses contract scale in ctVal instead, and applying both
// would count it twice.
func (o *OKX) SizeUSD(symbol string, price, qty float64) *float64 {
	o.mu.RLock()
	contract, known := o.contract[symbol]
	o.mu.RUnlock()
	if !known {
		return nil
	}
	if contract.usd > 0 {
		usd := qty * contract.usd
		return &usd
	}
	usd := qty * contract.base * price
	return &usd
}

// okxMessage is the envelope: an event (subscribe ack, or error) or a data push.
type okxMessage struct {
	Event string `json:"event"`
	Code  string `json:"code"`
	Msg   string `json:"msg"`
	Arg   struct {
		Channel string `json:"channel"`
		InstID  string `json:"instId"`
	} `json:"arg"`
	Data []struct {
		// Each level is [price, size, liquidatedOrders, orderCount].
		Asks [][]json.RawMessage `json:"asks"`
		Bids [][]json.RawMessage `json:"bids"`
		TS   json.RawMessage     `json:"ts"`
	} `json:"data"`
}

// Decode reads one message.
//
// bbo-tbt is a SNAPSHOT channel at depth 1 — "tick by tick best bid and offer" — so both sides
// arrive together and there is no unchanged-side case. A side that is genuinely empty (no resting
// order at all) arrives as an empty array and leaves that side alone; the shared book logic treats a
// zero size as a removal, as on the other two venues.
func (*OKX) Decode(msg []byte, now time.Time) ([]Update, error) {
	// okx answers a ping with the literal string "pong", which is not JSON and must not be reported
	// as an unreadable message.
	if len(msg) == 4 && string(msg) == "pong" {
		return nil, nil
	}
	var m okxMessage
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("okx: unreadable message: %w", err)
	}
	if m.Event == "error" {
		return nil, fmt.Errorf("okx: %s: %s", m.Code, m.Msg)
	}
	if m.Arg.Channel != "bbo-tbt" || len(m.Data) == 0 {
		return nil, nil
	}
	updates := make([]Update, 0, len(m.Data))
	for _, level := range m.Data {
		at := now
		if ms := parseFloat(level.TS); ms != nil && *ms > 0 {
			at = time.UnixMilli(int64(*ms)).UTC()
		}
		update := Update{Symbol: m.Arg.InstID, At: at}
		if len(level.Bids) > 0 && len(level.Bids[0]) >= 2 {
			update.Bid = parseFloat(level.Bids[0][0])
			update.BidQty = parseFloat(level.Bids[0][1])
		}
		if len(level.Asks) > 0 && len(level.Asks[0]) >= 2 {
			update.Ask = parseFloat(level.Asks[0][0])
			update.AskQty = parseFloat(level.Asks[0][1])
		}
		if update.Bid == nil && update.Ask == nil {
			continue
		}
		updates = append(updates, update)
	}
	return updates, nil
}
