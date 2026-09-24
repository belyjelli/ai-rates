package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters/nado"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// NadoLiquidations reads Nado's public liquidation stream: ONE subscription, every product.
//
//	-> {"method":"subscribe","stream":{"type":"liquidation","product_id":null},"id":1}
//	<- {"result":null,"id":1}
//
// The docs call it "a public event — all subscribers receive it", with the payload
//
//	{"type":"liquidation","timestamp":"<ns>","product_ids":[2],"liquidator":"0x..",
//	 "liquidatee":"0x..","amount":"<x18>","price":"<x18>"}
//
// NOT YET SEEN LIVE. A 10-minute probe on 2026-09-24 had the subscription acknowledged and a trade
// control delivering 268 messages, but no liquidation arrived (the archive shows ~100 per 12 h). The
// shape above is the documented one; every field is decoded defensively and an unexpected message is
// skipped rather than stored.
//
// SIDE: THE SIGN OF amount IS THE POSITION. Docs: "Positive = long position liquidated, negative =
// short position liquidated." Checked against the archive's liquidate_subaccount transactions: in 50
// of 50, the liquidatee's position before had the sign of amount and moved by exactly -amount.
//
// A SPREAD liquidation lists two products, [spot, perp]. Only a product this feed can name as a perp
// is stored, so the spot leg is dropped rather than filed under the perp's symbol.
//
// COMPRESSION IS REQUIRED: without permessage-deflate the handshake is 403 Forbidden (see Compresses).
type NadoLiquidations struct {
	client *httpclient.Client

	mu       sync.RWMutex
	symbolOf map[int]string
}

// DefaultNadoLiquidationURL is the gateway's subscription endpoint.
const DefaultNadoLiquidationURL = "wss://gateway.prod.nado.xyz/v1/subscribe"

func NewNadoLiquidations(client *httpclient.Client) *NadoLiquidations {
	return &NadoLiquidations{client: client, symbolOf: map[int]string{}}
}

func (*NadoLiquidations) VenueID() string { return nado.VenueID }

func (*NadoLiquidations) URL() string { return DefaultNadoLiquidationURL }

// Compresses: Nado answers 403 to a handshake that does not offer permessage-deflate.
func (*NadoLiquidations) Compresses() bool { return true }

// NeedsSymbols is false: product_id null subscribes every product.
func (*NadoLiquidations) NeedsSymbols() bool { return false }

func (*NadoLiquidations) Frames([]string) [][]byte {
	return [][]byte{[]byte(`{"method":"subscribe","stream":{"type":"liquidation","product_id":null},"id":1}`)}
}

func (*NadoLiquidations) FramePause() time.Duration { return 0 }

// Ping asks for the subscription list purely so the gateway ANSWERS ({"result":...,"id":0}): a
// liquidation stream is silent for minutes at a time, and a reply is what resets the read deadline,
// for the reason given on BinanceLiquidations.Ping.
func (*NadoLiquidations) Ping() []byte { return []byte(`{"method":"list","id":0}`) }

// PingEvery is short because the gateway hangs up on an idle client. With only the liquidation
// stream subscribed and a 3-minute keepalive, a 150 s live run lost its connection once ("failed to
// read frame header: EOF"); the probe that also carried a trade stream had held 600 s.
func (*NadoLiquidations) PingEvery() time.Duration { return 30 * time.Second }

// Prepare reads /v2/contracts, the call the funding adapter makes, for product_id -> ticker_id: the
// ticker is the symbol stored for this venue, so a liquidation joins the rest of the site.
func (n *NadoLiquidations) Prepare(ctx context.Context, _ []string) error {
	var contracts nado.Contracts
	if err := n.client.GetJSON(ctx, nado.ArchiveURL+"/v2/contracts?edge=false", &contracts); err != nil {
		return fmt.Errorf("nado contracts: %w", err)
	}
	symbolOf := make(map[int]string, len(contracts))
	for _, contract := range contracts {
		if contract.TickerID != "" {
			symbolOf[contract.ProductID] = contract.TickerID
		}
	}
	if len(symbolOf) == 0 {
		return fmt.Errorf("nado contracts: no perps")
	}
	n.mu.Lock()
	n.symbolOf = symbolOf
	n.mu.Unlock()
	return nil
}

// DecodeEvents reads one liquidation event.
func (n *NadoLiquidations) DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error) {
	var m struct {
		Type       string `json:"type"`
		Error      string `json:"error"`
		Timestamp  string `json:"timestamp"`
		ProductIDs []int  `json:"product_ids"`
		Amount     string `json:"amount"`
		Price      string `json:"price"`
	}
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("nado: unreadable message: %w", err)
	}
	if m.Error != "" {
		return nil, fmt.Errorf("nado: %s", m.Error)
	}
	if m.Type != "liquidation" {
		return nil, nil // an ack, a list reply
	}
	amount, price := x18(m.Amount), x18(m.Price)
	if amount == 0 || price <= 0 {
		return nil, nil
	}
	side := "long"
	if amount < 0 {
		side = "short"
	}
	at := now
	if ns, err := strconv.ParseInt(m.Timestamp, 10, 64); err == nil && ns > 0 {
		at = time.Unix(0, ns).UTC()
	}

	n.mu.RLock()
	symbolOf := n.symbolOf
	n.mu.RUnlock()

	size := math.Abs(amount)
	events := make([]LiquidationEvent, 0, 1)
	for _, product := range m.ProductIDs {
		symbol, perp := symbolOf[product]
		if !perp {
			continue
		}
		notional := size * price
		events = append(events, LiquidationEvent{
			VenueSymbol:   symbol,
			At:            at,
			Side:          side,
			SizeContracts: size,
			FillPrice:     price,
			NotionalUSD:   &notional,
		})
	}
	return events, nil
}

// x18 reads Nado's 1e18 fixed-point decimal string. Parsed as a big integer first: amounts run to
// 1e24 and beyond, past what a float64 holds exactly as an integer, and the division is where the
// precision is spent.
func x18(raw string) float64 {
	value, ok := new(big.Float).SetPrec(128).SetString(raw)
	if !ok {
		return 0
	}
	out, _ := new(big.Float).Quo(value, big.NewFloat(1e18)).Float64()
	return out
}
