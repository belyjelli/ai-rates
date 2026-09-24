package stream

import (
	"strings"
	"testing"
	"time"
)

// Two real liquidation trades captured from Lighter 2026-09-24, one of each direction, wrapped in the
// trade-channel shape the socket delivers them in.
const (
	// WIF: is_maker_ask false, so the taker SOLD; taker_position_size_before +1172.0, a long.
	lighterLongLiq = `{"trade_id":31787102386,"type":"liquidation","market_id":5,"market_kind":"perps","size":"1172.0","price":"0.24087","usd_amount":"282.299640","ask_client_id":0,"bid_client_id":12007779301,"ask_account_id":281474976620776,"bid_account_id":7684,"is_maker_ask":false,"timestamp":1790221085387,"taker_fee":10000,"taker_position_size_before":"1172.0","taker_position_sign_changed":true,"maker_fee":28}`
	// DOGE: is_maker_ask true, so the taker BOUGHT; taker_position_size_before -3349, a short.
	lighterShortLiq = `{"trade_id":31795317844,"type":"liquidation","market_id":3,"market_kind":"perps","size":"3349","price":"0.095169","usd_amount":"318.720981","ask_client_id":41232660,"bid_client_id":0,"ask_account_id":415333,"bid_account_id":281474976513961,"is_maker_ask":true,"timestamp":1790226477516,"taker_fee":10000,"taker_position_size_before":"-3349","taker_position_sign_changed":true,"maker_fee":28}`
)

func lighterWithMarkets() *LighterLiquidations {
	l := NewLighterLiquidations(nil)
	l.idOf = map[string]int64{"WIF": 5, "DOGE": 3, "BTC": 1}
	l.symbolOf = map[int64]string{5: "WIF", 3: "DOGE", 1: "BTC"}
	return l
}

func TestLighterLiquidationSideIsTheTakerAndBothDirectionsMap(t *testing.T) {
	l := lighterWithMarkets()
	msg := `{"channel":"trade:5","type":"update/trade","liquidation_trades":[` + lighterLongLiq + `,` + lighterShortLiq + `],"trades":[]}`
	events, err := l.DecodeEvents([]byte(msg), time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 2 {
		t.Fatalf("events: got %d, want 2", len(events))
	}
	long, short := events[0], events[1]
	if long.Side != "long" || long.VenueSymbol != "WIF" || long.SizeContracts != 1172.0 || long.FillPrice != 0.24087 {
		t.Errorf("long: %+v", long)
	}
	if *long.NotionalUSD != 282.299640 || !long.At.Equal(time.UnixMilli(1790221085387)) {
		t.Errorf("long notional/time: %v %v", *long.NotionalUSD, long.At)
	}
	if short.Side != "short" || short.VenueSymbol != "DOGE" || *short.NotionalUSD != 318.720981 {
		t.Errorf("short: %+v", short)
	}
}

func TestLighterIgnoresOrdinaryTradesPongsAndUnknownMarkets(t *testing.T) {
	l := lighterWithMarkets()
	for _, msg := range []string{
		`{"type":"pong"}`,
		`{"session_id":"x","type":"connected"}`,
		`{"channel":"trade:1","type":"update/trade","liquidation_trades":[],"trades":[{"type":"trade","market_id":1,"size":"1","price":"1"}]}`,
		// A market Prepare has not named is dropped rather than stored under a bare number.
		`{"channel":"trade:99","liquidation_trades":[` + strings.Replace(lighterLongLiq, `"market_id":5`, `"market_id":99`, 1) + `]}`,
	} {
		events, err := l.DecodeEvents([]byte(msg), time.Unix(0, 0))
		if err != nil || len(events) != 0 {
			t.Errorf("%s: %d events, err %v", msg, len(events), err)
		}
	}
}

func TestLighterSubscribesOneMarketPerFrameByID(t *testing.T) {
	frames := lighterWithMarkets().Frames([]string{"BTC", "DOGE", "UNLISTED"})
	if len(frames) != 2 {
		t.Fatalf("frames: got %d, want 2 (an unknown symbol has no id to subscribe to)", len(frames))
	}
	if string(frames[0]) != `{"type":"subscribe","channel":"trade/1"}` || string(frames[1]) != `{"type":"subscribe","channel":"trade/3"}` {
		t.Errorf("frames: %s %s", frames[0], frames[1])
	}
}
