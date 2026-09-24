package bluefin

import (
	"context"
	"strings"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// trades_liquidation.json is real ETH-PERP rows captured 2026-09-24 from /exchange/trades: one
// LIQUIDATION with side LONG, one with side SHORT, and one ordinary ORDER trade.

func TestParseLiquidationsReadsTheOrderSideAsTheOppositePosition(t *testing.T) {
	var trades []Trade
	loadFixture(t, "trades_liquidation", &trades)
	got := ParseLiquidations(trades)

	if len(got) != 2 {
		t.Fatalf("liquidations: got %d, want 2 (the ORDER trade is not one)", len(got))
	}
	// side LONG is the liquidation's BUY, which closed a SHORT position.
	eq(t, "LONG order closed", got[0].Side, "short")
	eq(t, "size", got[0].SizeContracts, 1.2)
	eq(t, "price", got[0].FillPrice, 2731.65)
	eq(t, "notional is the venue's own quote amount", *got[0].NotionalUSD, 3277.98)
	eq(t, "at", got[0].LiquidatedAt, int64(1789979927610))
	eq(t, "symbol", got[0].VenueSymbol, "ETH-PERP")
	eq(t, "base", got[0].Base, "ETH")

	// side SHORT is the liquidation's SELL, which closed a LONG position.
	eq(t, "SHORT order closed", got[1].Side, "long")
	eq(t, "size", got[1].SizeContracts, 0.25)
}

func TestFetchLiquidationsAsksEachActiveMarketForLiquidationsOnly(t *testing.T) {
	info := fixtureBytes(t, "exchange-info")
	liquidations := fixtureBytes(t, "trades_liquidation")
	doer := &fakeDoer{body: func(url string) []byte {
		switch {
		case strings.HasSuffix(url, "/exchange/info"):
			return info
		case strings.Contains(url, "/exchange/trades"):
			return liquidations
		}
		return nil
	}}
	adapter := NewAdapter(httpclient.New(VenueID, httpclient.Options{Doer: doer, MaxRetries: -1}))

	got, complete, err := adapter.FetchLiquidations(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !complete {
		t.Error("every market answered with a short page, so the sweep is complete")
	}

	var asked []string
	for _, u := range doer.urls {
		if strings.Contains(u, "/exchange/trades") {
			asked = append(asked, u)
			// The default tradeType is ORDER, so leaving it off would return no liquidations at all.
			if !strings.Contains(u, "tradeType=LIQUIDATION") {
				t.Errorf("trades asked without tradeType=LIQUIDATION: %s", u)
			}
		}
	}
	if len(asked) == 0 {
		t.Fatal("no market was asked for liquidations")
	}
	// Every active market returned the same fixture, so two liquidations each.
	if len(got) != 2*len(asked) {
		t.Errorf("liquidations: got %d from %d markets", len(got), len(asked))
	}
}
