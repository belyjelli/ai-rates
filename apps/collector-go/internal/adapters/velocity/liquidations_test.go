package velocity

import (
	"encoding/json"
	"testing"
)

// The first record is real (2026-09-23): its fill shows the liquidated user taking a "short", from a
// long entry, so -15.74 closed a LONG. The rest exercise what must be skipped.
const liquidationRecords = `[
 {"ts":1790172693,"liquidationType":"liquidatePerp","liquidatePerp_marketIndex":0,"liquidatePerp_oraclePrice":"114.594873","liquidatePerp_baseAssetAmount":"-15.740000000","liquidatePerp_quoteAssetAmount":"1803.723301"},
 {"ts":1790170000,"liquidationType":"liquidatePerp","liquidatePerp_marketIndex":1,"liquidatePerp_oraclePrice":"86487.655","liquidatePerp_baseAssetAmount":"0.000200000","liquidatePerp_quoteAssetAmount":"17.297531"},
 {"ts":1790160000,"liquidationType":"liquidateSpot","liquidatePerp_marketIndex":0},
 {"ts":1790150000,"liquidationType":"liquidatePerp","liquidatePerp_marketIndex":9,"liquidatePerp_baseAssetAmount":"-1","liquidatePerp_quoteAssetAmount":"10"}
]`

func TestParseLiquidationsReadsTheSignAsTheClosingTrade(t *testing.T) {
	var records []LiquidationRecord
	if err := json.Unmarshal([]byte(liquidationRecords), &records); err != nil {
		t.Fatal(err)
	}
	// Perp index 0 is SOL; the spot market at index 0 must not name it.
	markets := []Market{
		{Symbol: "SOL-PERP", MarketIndex: 0, MarketType: "perp"},
		{Symbol: "BTC-PERP", MarketIndex: 1, MarketType: "perp"},
		{Symbol: "USDC", MarketIndex: 0, MarketType: "spot"},
	}
	got := ParseLiquidations(records, markets)
	if len(got) != 2 {
		t.Fatalf("liquidations: got %d, want 2 (a spot liquidation and an unknown index are skipped)", len(got))
	}
	sol, btc := got[0], got[1]
	if sol.Side != "long" || sol.VenueSymbol != "SOL-PERP" || sol.SizeContracts != 15.74 || *sol.NotionalUSD != 1803.723301 {
		t.Errorf("sol: %+v", sol)
	}
	if sol.LiquidatedAt != 1790172693000 {
		t.Errorf("seconds must become milliseconds: %d", sol.LiquidatedAt)
	}
	if btc.Side != "short" || btc.VenueSymbol != "BTC-PERP" {
		t.Errorf("btc: %+v", btc)
	}
}
