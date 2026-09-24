package stream

import (
	"strings"
	"testing"
	"time"
)

// The NEAR liquidation captured 2026-09-24 (market 10), which the account's own trade-history confirmed
// as a SELL by the TAKER closing a long.
const risexLiquidation = `{"channel":"trades","type":"update","market_id":"10","data":{"id":"x","maker":"0x36dc","taker":"0x78d4","maker_side":0,"price":"4.26241","size":"199.7","fee_maker":"-0.04256016385","fee_taker":"0.2553609831","fee_liquidation":"8.51203277"},"tx_hash":"0x69a7","block_number":22623955,"log_index":296,"worker_timestamp":"1790229712274938590"}`

func risexWithMarkets() *RiseXLiquidations {
	r := NewRiseXLiquidations(nil)
	r.symbolOf = map[string]string{"10": "NEAR/USDC", "1": "BTC/USDC"}
	return r
}

func TestRiseXLiquidationIsTheFeeAndTheTakerSide(t *testing.T) {
	r := risexWithMarkets()
	events, err := r.DecodeEvents([]byte(risexLiquidation), time.Unix(0, 0))
	if err != nil || len(events) != 1 {
		t.Fatalf("events: %v %v", events, err)
	}
	e := events[0]
	// maker_side 0: the maker bought, so the liquidated taker SOLD a long.
	if e.Side != "long" || e.VenueSymbol != "NEAR/USDC" || e.SizeContracts != 199.7 || e.FillPrice != 4.26241 {
		t.Errorf("event: %+v", e)
	}
	if !e.At.Equal(time.Unix(0, 1790229712274938590)) {
		t.Errorf("at: %v", e.At)
	}

	short := strings.Replace(risexLiquidation, `"maker_side":0`, `"maker_side":1`, 1)
	events, _ = r.DecodeEvents([]byte(short), time.Unix(0, 0))
	if len(events) != 1 || events[0].Side != "short" {
		t.Errorf("maker_side 1 closes a short: %+v", events)
	}
}

func TestRiseXIgnoresOrdinaryFillsAndAcks(t *testing.T) {
	r := risexWithMarkets()
	for _, msg := range []string{
		`{"type":"subscribed","method":"subscribe","status":"success","channel":"trades","data":{}}`,
		strings.Replace(risexLiquidation, `"fee_liquidation":"8.51203277"`, `"fee_liquidation":"0"`, 1),
		strings.Replace(risexLiquidation, `"market_id":"10"`, `"market_id":"99"`, 1),
	} {
		if events, err := r.DecodeEvents([]byte(msg), time.Unix(0, 0)); err != nil || len(events) != 0 {
			t.Errorf("%.80s: %v %v", msg, events, err)
		}
	}
}
