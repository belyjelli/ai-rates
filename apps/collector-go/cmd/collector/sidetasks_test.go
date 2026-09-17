package main

import (
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// TestSideLoopsAttachToTheSameVenuesAsTypeScript pins which venues get a history sweep and backfill,
// a tier sweep and a liquidation poll, by building every registered fetcher and applying the type
// assertions startSideTasks uses.
//
// The expected sets are what the TypeScript collector attached on 2026-09-15, read from
// createAdapters(VENUES) at runtime rather than grepped: 49 history, 17 tiers, 2 liquidations, and
// the Go registry matched them exactly. The seven collected venues without history (coinw, lbank,
// paradex, perpl, reya, sodex, variational) publish none; each adapter says so on both sides.
//
// A port that loses an optional method still compiles and still collects snapshots, so without this
// a venue would silently stop accruing settled funding. Change a set only alongside the adapter.
func TestSideLoopsAttachToTheSameVenuesAsTypeScript(t *testing.T) {
	hip3 := []string{"hl-abcd", "hl-cash", "hl-flx", "hl-hyna", "hl-io", "hl-km", "hl-mkts", "hl-para", "hl-vntl", "hl-xyz"}
	wantHistory := sorted(append([]string{
		"aevo", "apex", "arcus", "aster", "backpack", "binance", "bingx", "bitget", "bitmart", "bluefin",
		"bullet", "bybit", "dydx", "edgex-v2", "extended", "gate", "grvt", "hibachi", "hotcoin", "htx",
		"hyperliquid", "kucoin", "lighter", "lighter-rh", "mexc", "nado", "okx", "ondo", "orderly",
		"pacifica", "phoenix", "pionex", "polymarket", "risex", "standx", "toobit", "velocity", "weex",
		"zero1",
	}, hip3...))
	wantTiers := sorted(append([]string{"bybit", "dydx", "gate", "hyperliquid", "kucoin", "mexc", "okx"}, hip3...))
	// dydx joined gate and okx on 2026-09-18. It is polled rather than streamed because its
	// WebSocket refuses more than 32 subscriptions per connection and pushed nothing live in 24
	// minutes, while one REST trade page reaches back days — see dydx.Adapter.FetchLiquidations.
	wantLiquidations := []string{"dydx", "gate", "okx"}

	var history, tiers, liquidations []string
	for _, c := range registry() {
		fetcher := c.build(httpclient.New(c.id, httpclient.Options{MinInterval: time.Millisecond}))
		if _, ok := fetcher.(collector.HistoryFetcher); ok {
			history = append(history, c.id)
		}
		if _, ok := fetcher.(collector.TierFetcher); ok {
			tiers = append(tiers, c.id)
		}
		if _, ok := fetcher.(collector.LiquidationFetcher); ok {
			liquidations = append(liquidations, c.id)
		}
	}

	for _, check := range []struct {
		name      string
		got, want []string
	}{
		{"history", sorted(history), wantHistory},
		{"leverage tiers", sorted(tiers), wantTiers},
		{"liquidations", sorted(liquidations), wantLiquidations},
	} {
		if !reflect.DeepEqual(check.got, check.want) {
			t.Errorf("%s: got %d %q\nwant %d %q", check.name, len(check.got), check.got, len(check.want), check.want)
		}
	}
}

func sorted(values []string) []string {
	out := append([]string(nil), values...)
	sort.Strings(out)
	return out
}
