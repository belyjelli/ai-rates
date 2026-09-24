package phoenix

import (
	"encoding/json"
	"math"
	"testing"
)

// Real fills from /trades/{symbol}/fills, 2026-09-23/24. The HYPE -9.46 was checked against the Solana
// program log ("Position side ... Long"); the SOL +1.77 against its log ("Short").
const liquidationFills = `[
 {"marketSymbol":"HYPE","baseQty":"-9.46","quoteQty":"865.0224","price":"91.44","timestamp":"2026-09-24T04:03:43Z","transactionSignature":"sigA","instructionType":"LiquidateViaMarketOrder"},
 {"marketSymbol":"HYPE","baseQty":"1.77","quoteQty":"162.0","price":"91.52","timestamp":"2026-09-24T04:05:00Z","transactionSignature":"sigB","instructionType":"LiquidateViaMarketOrder"},
 {"marketSymbol":"HYPE","baseQty":"0.50","quoteQty":"45.8","price":"91.6","timestamp":"2026-09-24T04:05:00Z","transactionSignature":"sigB","instructionType":"LiquidateViaMarketOrder"},
 {"marketSymbol":"HYPE","baseQty":"-3.0","quoteQty":"274.5","price":"91.5","timestamp":"2026-09-24T04:06:00Z","transactionSignature":"sigC","instructionType":"PlaceMarketOrder"}
]`

func TestParseLiquidationsReadsTheClosingTradeAndFoldsATransaction(t *testing.T) {
	var fills []Fill
	if err := json.Unmarshal([]byte(liquidationFills), &fills); err != nil {
		t.Fatal(err)
	}
	got := ParseLiquidations(Market{Symbol: "HYPE", MarketStatus: "active"}, fills)
	if len(got) != 2 {
		t.Fatalf("liquidations: got %d, want 2 (sigB's two fills are one close; sigC is not a liquidation)", len(got))
	}

	// -9.46: the liquidated account SOLD, so its position was LONG.
	long := got[0]
	if long.Side != "long" || long.SizeContracts != 9.46 || *long.NotionalUSD != 865.0224 || long.VenueSymbol != "HYPE" {
		t.Errorf("long: %+v", long)
	}
	if long.LiquidatedAt != 1790222623000 {
		t.Errorf("at: got %d", long.LiquidatedAt)
	}

	// sigB: two fills of one buy, a SHORT closed, summed and priced at their average.
	short := got[1]
	if short.Side != "short" || math.Abs(short.SizeContracts-2.27) > 1e-9 || math.Abs(*short.NotionalUSD-207.8) > 1e-9 {
		t.Errorf("short: %+v notional %v", short, *short.NotionalUSD)
	}
	if math.Abs(short.FillPrice-207.8/2.27) > 1e-9 {
		t.Errorf("average price: got %v", short.FillPrice)
	}
}
