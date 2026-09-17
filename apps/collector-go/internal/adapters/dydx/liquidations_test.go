package dydx

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Fixtures captured live from /v4/trades/perpetualMarket/{ticker}?limit=1000 on 2026-09-17, not
// written from documentation.
const dydxTradesPage = `{"trades":[
	{"id":"064aeb220000000200000005","side":"SELL","size":"660","price":"1.276","type":"LIQUIDATED","createdAt":"2026-09-15T20:19:50.034Z","createdAtHeight":"105573154"},
	{"id":"064f03900000000200000005","side":"SELL","size":"0.0002","price":"76467","type":"LIMIT","createdAt":"2026-09-15T20:19:49.000Z","createdAtHeight":"105573150"},
	{"id":"064a1f5e0000000200000003","side":"BUY","size":"14.7","price":"1.4731","type":"LIQUIDATED","createdAt":"2026-09-14T18:45:14.924Z","createdAtHeight":"105489000"},
	{"id":"064a1f5e0000000200000009","side":"BUY","size":"2.5","price":"1.471","type":"DELEVERAGED","createdAt":"2026-09-14T18:45:14.924Z","createdAtHeight":"105489000"}
]}`

func parsePage(t *testing.T, body string, after time.Time) []liqRow {
	t.Helper()
	var page TradesResponse
	if err := json.Unmarshal([]byte(body), &page); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	parsed := ParseLiquidations("XRP-USD", page.Trades, after)
	rows := make([]liqRow, 0, len(parsed))
	for _, p := range parsed {
		rows = append(rows, liqRow{side: p.Side, size: p.SizeContracts, price: p.FillPrice, at: p.LiquidatedAt, notional: p.NotionalUSD})
	}
	return rows
}

type liqRow struct {
	side     string
	size     float64
	price    float64
	at       int64
	notional *float64
}

// TestParseLiquidationsSideIsThePosition. `side` is the TAKER's, and the liquidation order is the
// taker, so SELL closes a LONG — the same inversion as binance and the opposite of bybit.
//
// Established against the venue's own data rather than from the field's name: over 8,000 trades on
// eight markets, side=BUY printed above the neighbouring tape 6 of 6 times (+91 bps mean) and
// side=SELL printed below it 25 of 32 times. See ParseLiquidations for the full note, including why
// the seven exceptions are an artifact of one LINK-USD cascade.
func TestParseLiquidationsSideIsThePosition(t *testing.T) {
	rows := parsePage(t, dydxTradesPage, time.Time{})
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want 2 (LIMIT and DELEVERAGED must be skipped)", len(rows))
	}
	if rows[0].side != "long" {
		t.Errorf("SELL gave %q, want long — a liquidated long is SOLD", rows[0].side)
	}
	if rows[1].side != "short" {
		t.Errorf("BUY gave %q, want short", rows[1].side)
	}
}

// TestParseLiquidationsIgnoresOtherTradeTypes. DELEVERAGED is a DIFFERENT event — the insurance fund
// closing a profitable counterparty, not a margin call — and folding it in would contaminate the
// regressor migration 012 exists to feed. LIMIT is an ordinary fill.
func TestParseLiquidationsIgnoresOtherTradeTypes(t *testing.T) {
	rows := parsePage(t, dydxTradesPage, time.Time{})
	for _, row := range rows {
		if row.price == 1.471 {
			t.Fatal("a DELEVERAGED trade was ingested as a liquidation")
		}
		if row.price == 76467 {
			t.Fatal("an ordinary LIMIT fill was ingested as a liquidation")
		}
	}
}

// TestParseLiquidationsNotionalIsSizeTimesPrice. v4 has no contract multiplier: size IS the base
// asset, so size_contracts and notional_usd agree without any metadata call.
func TestParseLiquidationsNotionalIsSizeTimesPrice(t *testing.T) {
	rows := parsePage(t, dydxTradesPage, time.Time{})
	want := 660 * 1.276
	if rows[0].notional == nil || math.Abs(*rows[0].notional-want) > 1e-9 {
		t.Fatalf("notional = %v, want %v", rows[0].notional, want)
	}
	if rows[0].size != 660 || rows[0].price != 1.276 {
		t.Fatalf("size/price = %v/%v", rows[0].size, rows[0].price)
	}
}

func TestParseLiquidationsTimestampsAreTheVenuesOwn(t *testing.T) {
	rows := parsePage(t, dydxTradesPage, time.Time{})
	want := time.Date(2026, 9, 15, 20, 19, 50, 34000000, time.UTC).UnixMilli()
	if rows[0].at != want {
		t.Fatalf("at = %d, want %d — a row keyed at 'now' would be re-inserted on every poll",
			rows[0].at, want)
	}
}

// TestParseLiquidationsHonoursTheCursor. The endpoint has no "created after" filter, so the cursor
// is what stops a steady-state poll handing the store the same page over and over.
func TestParseLiquidationsHonoursTheCursor(t *testing.T) {
	after := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	rows := parsePage(t, dydxTradesPage, after)
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want only the one newer than the cursor", len(rows))
	}
	if rows[0].side != "long" {
		t.Fatalf("kept the wrong row: %+v", rows[0])
	}

	// A cursor exactly ON a row keeps it: two trades can share a millisecond, and re-offering one
	// the store already holds costs nothing while dropping one loses it for good.
	onTheRow := time.Date(2026, 9, 15, 20, 19, 50, 34000000, time.UTC)
	if rows := parsePage(t, dydxTradesPage, onTheRow); len(rows) != 1 {
		t.Fatalf("got %d rows, want the row at the cursor kept", len(rows))
	}
}

func TestParseLiquidationsSkipsUnusableRows(t *testing.T) {
	body := `{"trades":[
		{"id":"a","side":"SELL","size":"0","price":"1.2","type":"LIQUIDATED","createdAt":"2026-09-15T20:19:50.034Z"},
		{"id":"b","side":"SELL","size":"5","price":"0","type":"LIQUIDATED","createdAt":"2026-09-15T20:19:50.034Z"},
		{"id":"c","side":"","size":"5","price":"1.2","type":"LIQUIDATED","createdAt":"2026-09-15T20:19:50.034Z"},
		{"id":"d","side":"SELL","size":"5","price":"1.2","type":"LIQUIDATED","createdAt":"not a timestamp"}
	]}`
	if rows := parsePage(t, body, time.Time{}); len(rows) != 0 {
		t.Fatalf("got %d rows, want none — every one of these would break a column or the key", len(rows))
	}
}

// TestLiveFetchLiquidations sweeps the real indexer. Skipped unless DYDX_LIVE=1, for the reason
// internal/adapters/bybit/live_test.go gives.
//
// It checks the two things a fixture cannot: that the endpoint still answers this shape for every
// active market, and that the CURSOR works — the second sweep must ask for the shallow page and
// return far less than the first, or a steady-state poll is re-reading days of history every time.
func TestLiveFetchLiquidations(t *testing.T) {
	if os.Getenv("DYDX_LIVE") != "1" {
		t.Skip("set DYDX_LIVE=1 to run the live liquidation sweep")
	}
	client := httpclient.New(VenueID, httpclient.Options{MinInterval: MinInterval, Timeout: 30 * time.Second})
	adapter := NewAdapter(client)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	first, complete, err := adapter.FetchLiquidations(ctx)
	if err != nil {
		t.Fatalf("FetchLiquidations: %v", err)
	}
	t.Logf("cold sweep: %d liquidations, complete=%v, %d requests", len(first), complete, adapter.RequestCount())
	if !complete {
		t.Error("cold sweep was partial")
	}
	if len(first) == 0 {
		t.Error("no liquidations at all in a deep sweep of every market; the endpoint or the type filter has changed")
	}

	var longs, shorts int
	var oldest, newest int64
	for i, row := range first {
		if row.Side == "long" {
			longs++
		} else {
			shorts++
		}
		if row.NotionalUSD == nil || *row.NotionalUSD <= 0 {
			t.Fatalf("row %d has no notional: %+v", i, row)
		}
		if i == 0 || row.LiquidatedAt < oldest {
			oldest = row.LiquidatedAt
		}
		if row.LiquidatedAt > newest {
			newest = row.LiquidatedAt
		}
	}
	t.Logf("longs=%d shorts=%d, window %s .. %s", longs, shorts,
		time.UnixMilli(oldest).UTC().Format(time.RFC3339), time.UnixMilli(newest).UTC().Format(time.RFC3339))

	// The cursor is the point of the design: a second sweep moments later should find almost nothing.
	second, _, err := adapter.FetchLiquidations(ctx)
	if err != nil {
		t.Fatalf("second FetchLiquidations: %v", err)
	}
	t.Logf("warm sweep: %d liquidations", len(second))
	if len(second) >= len(first) {
		t.Errorf("warm sweep returned %d against the cold sweep's %d; the cursor is not advancing",
			len(second), len(first))
	}
}
