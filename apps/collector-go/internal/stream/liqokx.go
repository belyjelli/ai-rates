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

// OKXLiquidations speaks v5 public, channel liquidation-orders with instType SWAP: ONE topic for
// every swap on the venue.
//
// MEASURED 2026-09-18, this box: 100 events in 22 minutes (4.5/min) — the busiest liquidation feed
// of the ten venues probed — on a single subscription.
//
// WHY THIS RUNS ALONGSIDE THE EXISTING REST POLL RATHER THAN REPLACING IT. Migration 012 chose REST
// for okx and recorded its cost: one call per instFamily (479 of them) and a BTC feed once seen 69
// minutes stale. The socket is fresher by minutes and costs one topic. But the REST path is kept,
// because the socket's weakness is the mirror of REST's: a liquidation that fires during a reconnect
// is gone, since nothing republishes it, while the poll re-reads a page and would pick it up.
//
// THE TWO PATHS CANNOT DOUBLE-COUNT, and that is a property of the data rather than a hope. The
// liquidations primary key is (venue_id, venue_symbol, liquidated_at, size_contracts, fill_price),
// and this channel's payload carries the SAME FIELDS, with the same names and units, that the REST
// endpoint returns and that okx.ParseLiquidations already reads: ts (epoch ms), instId, sz
// (contracts), bkPx, posSide. So one event reaches the table with a byte-identical key by either
// road, and RecordLiquidations' ON CONFLICT DO NOTHING collapses the second arrival. Verified
// against a live socket capture on 2026-09-18:
//
//	{"arg":{"channel":"liquidation-orders","instType":"SWAP"},"data":[{"instId":"CNPY-USDT-SWAP",
//	 "instFamily":"CNPY-USDT","instType":"SWAP","details":[{"bkLoss":"0","bkPx":"0.4162","ccy":"",
//	 "posSide":"short","side":"buy","sz":"2137","ts":"1789669898955"}]}]}
//
// Gate deliberately does NOT get the same treatment — see liqgate.go for why its two paths would
// not agree on a key.
type OKXLiquidations struct {
	client *httpclient.Client

	mu sync.RWMutex
	// contract is dollars per contract per instrument, already folding in ctVal, ctMult and the
	// inverse/linear distinction. Same map the REST adapter builds, for the same reason.
	contract map[string]float64
}

func NewOKXLiquidations(client *httpclient.Client) *OKXLiquidations {
	return &OKXLiquidations{client: client, contract: map[string]float64{}}
}

func (*OKXLiquidations) VenueID() string { return "okx" }

func (*OKXLiquidations) URL() string { return "wss://ws.okx.com:8443/ws/v5/public" }

// NeedsSymbols is false: instType SWAP selects every swap, so there is no per-market topic and no
// subject set to keep in step.
func (*OKXLiquidations) NeedsSymbols() bool { return false }

func (*OKXLiquidations) Frames([]string) [][]byte {
	frame, err := json.Marshal(map[string]any{
		"op":   "subscribe",
		"args": []map[string]string{{"channel": "liquidation-orders", "instType": "SWAP"}},
	})
	if err != nil {
		return nil
	}
	return [][]byte{frame}
}

func (*OKXLiquidations) FramePause() time.Duration { return 0 }

// Ping is the literal string okx expects, on the tight cadence it demands: okx disconnects after 30
// SECONDS of silence, and a liquidation feed is silent most of the time by nature, so the keepalive
// is the only thing holding this connection open.
func (*OKXLiquidations) Ping() []byte { return []byte("ping") }

func (*OKXLiquidations) PingEvery() time.Duration { return 20 * time.Second }

// Prepare reads /public/instruments for ctVal, ctMult and ctValCcy, exactly as the quote feed and
// the REST adapter do. Re-read on every reconnect so a contract listed while the feed was running
// gets a real notional rather than a null one.
func (o *OKXLiquidations) Prepare(ctx context.Context, _ []string) error {
	var env okx.Envelope[okx.Instrument]
	if err := o.client.GetJSON(ctx, "https://www.okx.com/api/v5/public/instruments?instType=SWAP", &env); err != nil {
		return fmt.Errorf("okx instruments: %w", err)
	}
	contracts := make(map[string]float64, len(env.Data))
	for _, instrument := range env.Data {
		if !instrument.CtVal.OK || instrument.CtVal.Val <= 0 {
			continue
		}
		ctMult := 1.0
		if instrument.CtMult.OK && instrument.CtMult.Val > 0 {
			ctMult = instrument.CtMult.Val
		}
		contracts[instrument.InstID] = instrument.CtVal.Val * ctMult
		if instrument.CtValCcy == "USD" {
			// An INVERSE swap's contract is already denominated in dollars. Marked by storing it as
			// a negative, so one map can carry both cases without a second lookup on the hot path;
			// DecodeEvents reads the sign. See SizeUSD in okx.go for the same distinction spelled
			// out, and why conflating them inflates a number by the price of the coin.
			contracts[instrument.InstID] = -(instrument.CtVal.Val * ctMult)
		}
	}
	if len(contracts) == 0 {
		return fmt.Errorf("okx instruments: no contract sizes in %d instruments", len(env.Data))
	}
	o.mu.Lock()
	o.contract = contracts
	o.mu.Unlock()
	return nil
}

// DecodeEvents reads one liquidation-orders message.
//
// SIDE IS FREE HERE, and okx is the only venue in this package where it is: `posSide` names the
// liquidated POSITION outright ("long"/"short"), so there is no order side to invert and no sign to
// interpret. The `side` field beside it is the closing order and is consistently its opposite —
// 64 of 64 ("sell","long") and 36 of 36 ("buy","short") in the 2026-09-18 capture — which is a
// useful cross-check on every other venue's mapping in this package.
//
// NOTIONAL. `sz` is CONTRACTS, converted by ctVal x ctMult, with the inverse swaps' contracts
// already in dollars and therefore NOT multiplied by the price. An instrument missing from the
// metadata stores a nil notional rather than a raw contract count, which on BTC-USDT-SWAP would be
// wrong by four orders of magnitude.
func (o *OKXLiquidations) DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error) {
	// okx answers a ping with the literal string "pong", which is not JSON.
	if len(msg) == 4 && string(msg) == "pong" {
		return nil, nil
	}
	var m struct {
		Event string `json:"event"`
		Code  string `json:"code"`
		Msg   string `json:"msg"`
		Arg   struct {
			Channel string `json:"channel"`
		} `json:"arg"`
		Data []struct {
			InstID  string `json:"instId"`
			Details []struct {
				BkPx    json.RawMessage `json:"bkPx"`
				Sz      json.RawMessage `json:"sz"`
				PosSide string          `json:"posSide"`
				TS      json.RawMessage `json:"ts"`
			} `json:"details"`
		} `json:"data"`
	}
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("okx: unreadable message: %w", err)
	}
	if m.Event == "error" {
		return nil, fmt.Errorf("okx: %s: %s", m.Code, m.Msg)
	}
	if m.Arg.Channel != "liquidation-orders" || len(m.Data) == 0 {
		return nil, nil
	}

	o.mu.RLock()
	contracts := o.contract
	o.mu.RUnlock()

	events := make([]LiquidationEvent, 0, len(m.Data))
	for _, row := range m.Data {
		if row.InstID == "" {
			continue
		}
		size, known := contracts[row.InstID]
		for _, detail := range row.Details {
			if detail.PosSide != "long" && detail.PosSide != "short" {
				continue
			}
			sz := parseFloat(detail.Sz)
			price := parseFloat(detail.BkPx)
			if sz == nil || *sz <= 0 || price == nil || *price <= 0 {
				continue
			}
			at := now
			if ms := parseFloat(detail.TS); ms != nil && *ms > 0 {
				at = time.UnixMilli(int64(*ms)).UTC()
			}
			var notional *float64
			if known {
				var usd float64
				if size < 0 {
					usd = *sz * -size // inverse: contracts are already dollars
				} else {
					usd = *sz * size * *price
				}
				notional = &usd
			}
			events = append(events, LiquidationEvent{
				VenueSymbol:   row.InstID,
				At:            at,
				Side:          detail.PosSide,
				SizeContracts: *sz,
				FillPrice:     *price,
				NotionalUSD:   notional,
			})
		}
	}
	return events, nil
}
