package paradex

import (
	"encoding/json"
	"testing"
)

// The first row is a real LIQUIDATION from /v1/trades (2026-09-23); the others are the types that share
// the tape and must not be read as liquidations.
const tradesPageJSON = `[
 {"id":"1","market":"BTC-USD-PERP","side":"SELL","size":"0.00649","price":"83894.04692005321","created_at":1790173872009,"trade_type":"LIQUIDATION"},
 {"id":"2","market":"BTC-USD-PERP","side":"BUY","size":"0.01","price":"84000","created_at":1790173900000,"trade_type":"LIQUIDATION"},
 {"id":"3","market":"BTC-USD-PERP","side":"SELL","size":"0.00528","price":"84313","created_at":1790238038418,"trade_type":"RPI"},
 {"id":"4","market":"BTC-USD-PERP","side":"SELL","size":"1","price":"84313","created_at":1790238038418,"trade_type":"FILL"},
 {"id":"5","market":"BTC-USD-PERP","side":"SELL","size":"1","price":"84313","created_at":1790238038418,"trade_type":"UNWIND_TRANSFER"}
]`

func TestParseLiquidationsReadsTheTakerSideAsTheOppositePosition(t *testing.T) {
	var trades []Trade
	if err := json.Unmarshal([]byte(tradesPageJSON), &trades); err != nil {
		t.Fatal(err)
	}
	got := ParseLiquidations(trades)
	if len(got) != 2 {
		t.Fatalf("liquidations: got %d, want 2 (RPI, FILL and UNWIND_TRANSFER are not)", len(got))
	}
	// A SELL liquidation closed a LONG: 186 of 194 BUYs followed a rise, 18 of 19 SELLs a fall.
	if got[0].Side != "long" || got[0].VenueSymbol != "BTC-USD-PERP" || got[0].SizeContracts != 0.00649 {
		t.Errorf("sell: %+v", got[0])
	}
	if got[0].LiquidatedAt != 1790173872009 || *got[0].NotionalUSD != 0.00649*83894.04692005321 {
		t.Errorf("sell time/notional: %d %v", got[0].LiquidatedAt, *got[0].NotionalUSD)
	}
	if got[1].Side != "short" {
		t.Errorf("a BUY liquidation closed a short: %+v", got[1])
	}
}
