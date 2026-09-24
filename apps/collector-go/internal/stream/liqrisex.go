package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters/risex"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// RiseXLiquidations reads forced closes off RISEx's all-markets trade channel.
//
//	-> {"method":"subscribe","params":{"channel":"trades"}}
//	<- {"type":"subscribed","status":"success","message":"Successfully subscribed to trades for all markets",...}
//
// THE MARKER IS THE FEE. A liquidation fill carries a non-zero fee_liquidation (1% of notional); every
// other fill says "0". Captured 2026-09-24 on market 10 (NEAR):
//
//	{"channel":"trades","type":"update","market_id":"10","data":{"maker_side":0,"price":"4.26241",
//	 "size":"199.7","fee_liquidation":"8.51203277",...},"worker_timestamp":"1790229712274938590"}
//
// SIDE: THE LIQUIDATED ACCOUNT IS THE TAKER (partial liquidation sends IoC orders to the book), so the
// taker's side is the closing trade and the maker's the opposite: maker_side 0 (maker bought, taker
// sold) closed a LONG; 1 closed a SHORT. Confirmed on the record above: the account's own public
// trade-history returned side SELL, liquidity TAKER, is_liquidation true, position_side BUY.
//
// WHAT IT MISSES, stated rather than hidden: the docs charge the 1% fee only when the close beats the
// zero price, so a fill exactly at it would read "0"; and a full takeover by the XLP vault may not
// print as a book trade at all.
//
// The server sends protocol pings (4 in 130 s), which the WebSocket library answers; the channel
// carries every market's trades, so it is never idle long enough to need a keepalive of our own.
type RiseXLiquidations struct {
	client *httpclient.Client

	mu       sync.RWMutex
	symbolOf map[string]string
}

// DefaultRiseXLiquidationURL is RISEx's public stream.
const DefaultRiseXLiquidationURL = "wss://ws.rise.trade/ws"

func NewRiseXLiquidations(client *httpclient.Client) *RiseXLiquidations {
	return &RiseXLiquidations{client: client, symbolOf: map[string]string{}}
}

func (*RiseXLiquidations) VenueID() string { return risex.VenueID }

func (*RiseXLiquidations) URL() string { return DefaultRiseXLiquidationURL }

// NeedsSymbols is false: leaving market_ids out subscribes every market.
func (*RiseXLiquidations) NeedsSymbols() bool { return false }

func (*RiseXLiquidations) Frames([]string) [][]byte {
	return [][]byte{[]byte(`{"method":"subscribe","params":{"channel":"trades"}}`)}
}

func (*RiseXLiquidations) FramePause() time.Duration { return 0 }

func (*RiseXLiquidations) Ping() []byte { return nil }

func (*RiseXLiquidations) PingEvery() time.Duration { return 0 }

// Prepare reads /markets for market_id -> config.name, the symbol the funding adapter stores.
func (r *RiseXLiquidations) Prepare(ctx context.Context, _ []string) error {
	var body risex.MarketsResponse
	if err := r.client.GetJSON(ctx, risex.APIBase+"/markets", &body); err != nil {
		return fmt.Errorf("risex markets: %w", err)
	}
	symbolOf := make(map[string]string, len(body.Data.Markets))
	for _, market := range body.Data.Markets {
		if market.MarketID != "" && market.Config.Name != "" {
			symbolOf[market.MarketID] = market.Config.Name
		}
	}
	if len(symbolOf) == 0 {
		return fmt.Errorf("risex markets: none")
	}
	r.mu.Lock()
	r.symbolOf = symbolOf
	r.mu.Unlock()
	return nil
}

// DecodeEvents reads one trades message, keeping only liquidation fills.
func (r *RiseXLiquidations) DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error) {
	var m struct {
		Channel         string `json:"channel"`
		Type            string `json:"type"`
		Status          string `json:"status"`
		Message         string `json:"message"`
		MarketID        string `json:"market_id"`
		WorkerTimestamp string `json:"worker_timestamp"`
		Data            struct {
			MakerSide      *int            `json:"maker_side"`
			Price          json.RawMessage `json:"price"`
			Size           json.RawMessage `json:"size"`
			FeeLiquidation json.RawMessage `json:"fee_liquidation"`
		} `json:"data"`
	}
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("risex: unreadable message: %w", err)
	}
	if m.Type == "error" || m.Status == "error" {
		return nil, fmt.Errorf("risex: %s", m.Message)
	}
	if m.Channel != "trades" || m.Type != "update" || m.Data.MakerSide == nil {
		return nil, nil
	}
	if fee := parseFloat(m.Data.FeeLiquidation); fee == nil || *fee <= 0 {
		return nil, nil // an ordinary fill
	}
	r.mu.RLock()
	symbol, known := r.symbolOf[m.MarketID]
	r.mu.RUnlock()
	size, price := parseFloat(m.Data.Size), parseFloat(m.Data.Price)
	if !known || size == nil || *size <= 0 || price == nil || *price <= 0 {
		return nil, nil
	}
	var side string
	switch *m.Data.MakerSide {
	case 0:
		side = "long" // the maker bought, so the liquidated taker sold
	case 1:
		side = "short"
	default:
		return nil, nil
	}
	at := now
	if ns, err := strconv.ParseInt(m.WorkerTimestamp, 10, 64); err == nil && ns > 0 {
		at = time.Unix(0, ns).UTC()
	}
	notional := *size * *price
	return []LiquidationEvent{{
		VenueSymbol:   symbol,
		At:            at,
		Side:          side,
		SizeContracts: *size,
		FillPrice:     *price,
		NotionalUSD:   &notional,
	}}, nil
}
