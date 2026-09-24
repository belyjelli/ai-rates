package stream

import (
	"math"
	"testing"
	"time"
)

func nadoWithProducts() *NadoLiquidations {
	n := NewNadoLiquidations(nil)
	// 2 and 4 are perps (BTC, ETH); 3 is a spot product the contracts list does not carry.
	n.symbolOf = map[int]string{2: "BTC-PERP_USDT0", 4: "ETH-PERP_USDT0"}
	return n
}

func TestNadoAmountSignIsThePosition(t *testing.T) {
	n := nadoWithProducts()
	// The documented shape. amount +0.5 ETH at $2,700: a LONG liquidated.
	long := `{"type":"liquidation","timestamp":"1790201277000000000","product_ids":[4],"liquidator":"0xa","liquidatee":"0xb","amount":"500000000000000000","price":"2700000000000000000000"}`
	events, err := n.DecodeEvents([]byte(long), time.Unix(0, 0))
	if err != nil || len(events) != 1 {
		t.Fatalf("long: %v %v", events, err)
	}
	e := events[0]
	if e.Side != "long" || e.VenueSymbol != "ETH-PERP_USDT0" || e.SizeContracts != 0.5 || e.FillPrice != 2700 {
		t.Errorf("long: %+v", e)
	}
	if *e.NotionalUSD != 1350 || !e.At.Equal(time.Unix(0, 1790201277000000000)) {
		t.Errorf("long notional/time: %v %v", *e.NotionalUSD, e.At)
	}

	// -0.145 ETH, the archive transaction that took a short from -0.291 to -0.146: a SHORT.
	short := `{"type":"liquidation","timestamp":"1790201277000000000","product_ids":[4],"amount":"-145000000000000000","price":"2700000000000000000000"}`
	events, err = n.DecodeEvents([]byte(short), time.Unix(0, 0))
	if err != nil || len(events) != 1 || events[0].Side != "short" || math.Abs(events[0].SizeContracts-0.145) > 1e-12 {
		t.Fatalf("short: %+v %v", events, err)
	}
}

func TestNadoKeepsOnlyThePerpLegOfASpread(t *testing.T) {
	n := nadoWithProducts()
	spread := `{"type":"liquidation","timestamp":"1790201277000000000","product_ids":[3,2],"amount":"10000000000000000","price":"84000000000000000000000"}`
	events, err := n.DecodeEvents([]byte(spread), time.Unix(0, 0))
	if err != nil || len(events) != 1 || events[0].VenueSymbol != "BTC-PERP_USDT0" {
		t.Fatalf("spread: %+v %v", events, err)
	}
}

func TestNadoIgnoresAcksAndListReplies(t *testing.T) {
	n := nadoWithProducts()
	for _, msg := range []string{`{"result":null,"id":1}`, `{"result":[],"id":0}`,
		`{"type":"trade","product_id":2,"price":"84046000000000000000000","taker_qty":"1","maker_qty":"1","is_taker_buyer":true}`} {
		if events, err := n.DecodeEvents([]byte(msg), time.Unix(0, 0)); err != nil || len(events) != 0 {
			t.Errorf("%s: %v %v", msg, events, err)
		}
	}
}

// TestOnlyNadoIsDialedWithCompression: the extension is opt-in, so no venue that works today is
// offered something it never negotiated.
func TestOnlyNadoIsDialedWithCompression(t *testing.T) {
	if !NewNadoLiquidations(nil).Compresses() {
		t.Error("nado must ask for permessage-deflate: its gateway answers 403 without it")
	}
	for _, proto := range []Wire{NewLighterLiquidations(nil), BybitLiquidations{}, HTXLiquidations{}, NewBinanceLiquidations("")} {
		if _, compresses := proto.(Compressor); compresses {
			t.Errorf("%s asks for compression", proto.VenueID())
		}
	}
}
