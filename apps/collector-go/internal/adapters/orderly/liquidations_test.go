package orderly

import (
	"context"
	"strings"
	"testing"
)

// The fixture is four real rows from /liquidated_positions, captured 2026-09-24: a short, a long,
// and two insurance-fund follow-ups with position_qty 0 (one of them across three perps).

func TestParseLiquidationsReadsTheSignAsThePositionAndSkipsFollowUps(t *testing.T) {
	var env Envelope[Rows[LiquidatedRow]]
	load(t, "liquidated_positions", &env)
	got := ParseLiquidations(env.Data.Rows)

	if len(got) != 2 {
		t.Fatalf("liquidations: got %d, want 2 (the two position_qty 0 follow-ups are not closes)", len(got))
	}
	short, long := got[0], got[1]

	// position_qty -0.0059 is a SHORT position that was closed.
	eq(t, "short side", short.Side, "short")
	eq(t, "short symbol", short.VenueSymbol, "PERP_ETH_USDC")
	eq(t, "short size", short.SizeContracts, 0.0059)
	eq(t, "short price", short.FillPrice, 2703.82)
	eq(t, "short at", short.LiquidatedAt, int64(1790226493142))
	eq(t, "short notional", *short.NotionalUSD, 15.952538)

	// +3.7482 is a LONG: the venue's own signed cost, made positive, is the notional.
	eq(t, "long side", long.Side, "long")
	eq(t, "long size", long.SizeContracts, 3.7482)
	eq(t, "long notional", *long.NotionalUSD, 10016.539752)
	eq(t, "base", long.Base, "ETH")
}

func TestFetchLiquidationsWindowsFromTheLastPoll(t *testing.T) {
	doer := &routeDoer{route: func(requested string) []byte {
		if strings.Contains(requested, "/liquidated_positions") {
			return fixtureBytes(t, "liquidated_positions")
		}
		return nil
	}}
	adapter := newAdapter(doer)

	first, complete, err := adapter.FetchLiquidations(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !complete || len(first) != 2 {
		t.Fatalf("first poll: %d liquidations, complete=%v", len(first), complete)
	}
	if _, _, err := adapter.FetchLiquidations(context.Background()); err != nil {
		t.Fatal(err)
	}

	asked := doer.matching("/liquidated_positions")
	if len(asked) != 2 {
		t.Fatalf("requests: %v", asked)
	}
	startOf := func(u string) string { return strings.SplitN(strings.SplitN(u, "start_t=", 2)[1], "&", 2)[0] }
	endOf := func(u string) string { return strings.SplitN(strings.SplitN(u, "end_t=", 2)[1], "&", 2)[0] }
	// The second window starts before the first one ended (the overlap), not 24 hours back again.
	if startOf(asked[1]) >= endOf(asked[0]) {
		t.Errorf("second window should overlap the first: start %s, previous end %s", startOf(asked[1]), endOf(asked[0]))
	}
	if startOf(asked[1]) <= startOf(asked[0]) {
		t.Errorf("second window should start after the first's 24-hour lookback")
	}
}
