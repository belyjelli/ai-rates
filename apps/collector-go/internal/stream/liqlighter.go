package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters/lighter"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// LighterLiquidations reads forced closes off Lighter's per-market trade channel.
//
// A SEPARATE ARRAY, NOT A MARKER TO FILTER FOR. Every `trade/{market_id}` message carries
// `liquidation_trades` beside `trades`, and the reply to a subscribe replays the market's recent
// ones, so a reconnect backfills what it missed and the store's key absorbs the overlap. Captured
// live 2026-09-24 on market 0 (ETH):
//
//	{"channel":"trade:0","type":"subscribed/trade","liquidation_trades":[{"type":"liquidation",
//	 "market_id":0,"size":"0.0394","price":"2703.94","usd_amount":"106.535236","is_maker_ask":true,
//	 "timestamp":1790226496534,"taker_fee":10000,"taker_position_size_before":"-0.0394",...}], ...}
//
// SIDE: THE LIQUIDATED ACCOUNT IS ALWAYS THE TAKER. Lighter's docs say the engine "sends IoC limit
// orders on behalf of the margin called user", and an IoC order takes. So is_maker_ask false (the
// taker sold) closed a LONG, and true (the taker bought) closed a SHORT. Checked on 15 liquidations
// of both directions, 7 long and 8 short, 2026-09-24: in every one the taker paid the 1% liquidation
// fee (taker_fee 10000), its client id was 0 (a system order), and the sign of
// taker_position_size_before was opposite to its trade. The 2026-09-18 probe had seen only longs,
// which is why this venue stayed unbuilt until both directions were observed.
//
// KEEPALIVE IS REQUIRED: with nothing sent, the server closed the socket at 120 s ("i/o timeout").
// {"type":"ping"} every 50 s held one open for 200 s, each answered with {"type":"pong"}.
type LighterLiquidations struct {
	client *httpclient.Client

	mu       sync.RWMutex
	idOf     map[string]int64
	symbolOf map[int64]string
}

// DefaultLighterLiquidationURL is the Ethereum deployment's stream, the venue "lighter".
const DefaultLighterLiquidationURL = "wss://mainnet.zklighter.elliot.ai/stream"

func NewLighterLiquidations(client *httpclient.Client) *LighterLiquidations {
	return &LighterLiquidations{client: client, idOf: map[string]int64{}, symbolOf: map[int64]string{}}
}

func (*LighterLiquidations) VenueID() string { return lighter.VenueID }

func (*LighterLiquidations) URL() string { return DefaultLighterLiquidationURL }

// NeedsSymbols is true: there is no all-markets trade channel, so each market is its own topic.
func (*LighterLiquidations) NeedsSymbols() bool { return true }

// Frames is one subscribe per market, the only form the channel takes.
func (l *LighterLiquidations) Frames(symbols []string) [][]byte {
	l.mu.RLock()
	defer l.mu.RUnlock()
	frames := make([][]byte, 0, len(symbols))
	for _, symbol := range symbols {
		id, known := l.idOf[symbol]
		if !known {
			continue
		}
		frames = append(frames, []byte(`{"type":"subscribe","channel":"trade/`+strconv.FormatInt(id, 10)+`"}`))
	}
	return frames
}

// FramePause keeps subscribing under the documented 200 client messages a minute per IP.
func (*LighterLiquidations) FramePause() time.Duration { return 350 * time.Millisecond }

func (*LighterLiquidations) Ping() []byte { return []byte(`{"type":"ping"}`) }

func (*LighterLiquidations) PingEvery() time.Duration { return 50 * time.Second }

// Prepare reads orderBookDetails for the market ids the channel is keyed on, and the symbols the
// funding adapter stores, so a liquidation joins the rest of the site. Re-read on every reconnect so
// a market listed while the feed ran gets a name.
func (l *LighterLiquidations) Prepare(ctx context.Context, _ []string) error {
	var details lighter.OrderBookDetails
	if err := l.client.GetJSON(ctx, lighter.API+"/orderBookDetails", &details); err != nil {
		return fmt.Errorf("lighter orderBookDetails: %w", err)
	}
	idOf := make(map[string]int64, len(details.OrderBookDetails))
	symbolOf := make(map[int64]string, len(details.OrderBookDetails))
	for _, detail := range details.OrderBookDetails {
		if detail.Symbol == "" {
			continue
		}
		idOf[detail.Symbol] = detail.MarketID
		symbolOf[detail.MarketID] = detail.Symbol
	}
	if len(idOf) == 0 {
		return fmt.Errorf("lighter orderBookDetails: no markets")
	}
	l.mu.Lock()
	l.idOf, l.symbolOf = idOf, symbolOf
	l.mu.Unlock()
	return nil
}

type lighterTrade struct {
	Type       string          `json:"type"`
	MarketID   int64           `json:"market_id"`
	Size       json.RawMessage `json:"size"`
	Price      json.RawMessage `json:"price"`
	USDAmount  json.RawMessage `json:"usd_amount"`
	IsMakerAsk *bool           `json:"is_maker_ask"`
	Timestamp  int64           `json:"timestamp"`
}

// DecodeEvents reads one trade-channel message's liquidation_trades.
func (l *LighterLiquidations) DecodeEvents(msg []byte, now time.Time) ([]LiquidationEvent, error) {
	var m struct {
		Type         string         `json:"type"`
		Error        any            `json:"error"`
		Liquidations []lighterTrade `json:"liquidation_trades"`
	}
	if err := json.Unmarshal(msg, &m); err != nil {
		return nil, fmt.Errorf("lighter: unreadable message: %w", err)
	}
	if m.Error != nil {
		return nil, fmt.Errorf("lighter: %v", m.Error)
	}
	if len(m.Liquidations) == 0 {
		return nil, nil // connected, pong, or a trade update with none
	}

	l.mu.RLock()
	symbolOf := l.symbolOf
	l.mu.RUnlock()

	events := make([]LiquidationEvent, 0, len(m.Liquidations))
	for _, trade := range m.Liquidations {
		symbol, known := symbolOf[trade.MarketID]
		if trade.Type != "liquidation" || !known || trade.IsMakerAsk == nil {
			continue
		}
		side := "long" // the taker sold
		if *trade.IsMakerAsk {
			side = "short" // the taker bought
		}
		size, price := parseFloat(trade.Size), parseFloat(trade.Price)
		if size == nil || *size <= 0 || price == nil || *price <= 0 {
			continue
		}
		at := now
		if trade.Timestamp > 0 {
			at = time.UnixMilli(trade.Timestamp).UTC()
		}
		// size is BASE units and price USDC, so the product is dollars; the venue's own usd_amount
		// is that product and is used when present.
		notional := *size * *price
		if usd := parseFloat(trade.USDAmount); usd != nil && *usd > 0 {
			notional = *usd
		}
		events = append(events, LiquidationEvent{
			VenueSymbol:   symbol,
			At:            at,
			Side:          side,
			SizeContracts: *size,
			FillPrice:     *price,
			NotionalUSD:   &notional,
		})
	}
	return events, nil
}
