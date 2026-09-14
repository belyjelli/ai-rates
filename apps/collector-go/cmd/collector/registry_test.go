package main

import (
	"strings"
	"testing"
	"time"
)

// The registry is hand-maintained wiring, and three ways of getting it wrong all compile cleanly and
// pass every adapter's own tests. These guard that seam, because nothing else does.

// TestRegistryIsAtParityWithTypeScript pins the venue count.
//
// 56 is what the TypeScript collector runs, and the number the migration exists to reach. `blofin`
// is excluded from BOTH sides deliberately — it returns HTTP 403 to the collector's host — so 56 is
// parity, not a shortfall. Change this number only alongside a venue actually being added or
// removed on both sides, never to make a failing test pass.
func TestRegistryIsAtParityWithTypeScript(t *testing.T) {
	const want = 56
	got := registry()
	if len(got) != want {
		t.Fatalf("registry has %d venues, want %d — a venue was added or dropped without updating parity", len(got), want)
	}
}

// TestVenueIdsAreUniqueAndNonEmpty catches the failure that is invisible at runtime.
//
// Two candidates sharing an id start two loops against one venue. Both write market_latest and
// funding_snapshots, both writes succeed, and the observed_at guard arbitrates which survives — so
// the loser is silent. Nothing logs, nothing errors, and the rows are simply wrong.
func TestVenueIdsAreUniqueAndNonEmpty(t *testing.T) {
	seen := make(map[string]int, 64)
	for i, c := range registry() {
		if strings.TrimSpace(c.id) == "" {
			t.Errorf("candidate %d has an empty id", i)
			continue
		}
		if first, dup := seen[c.id]; dup {
			t.Errorf("venue id %q appears at both %d and %d — two loops would write one venue", c.id, first, i)
			continue
		}
		seen[c.id] = i
	}
}

// TestSpacingIsAPlausibleDuration guards the untyped-constant trap.
//
// A venue package declaring `MinInterval = 120` instead of `120 * time.Millisecond` yields an
// UNTYPED constant, and `spacing: pkg.MinInterval` then compiles happily as 120 NANOSECONDS. The
// binary builds, every adapter test passes, and the venue hammers its endpoint at ~8M requests a
// second until it is banned. Nothing in the type system catches it, so this does.
//
// The bounds are deliberately loose: the point is to catch a units error of six orders of
// magnitude, not to police a venue's documented rate limit.
func TestSpacingIsAPlausibleDuration(t *testing.T) {
	const (
		floor   = time.Millisecond
		ceiling = 30 * time.Second
	)
	for _, c := range registry() {
		switch {
		case c.spacing < floor:
			t.Errorf("%s: spacing %v is below %v — almost certainly an untyped constant read as nanoseconds", c.id, c.spacing, floor)
		case c.spacing > ceiling:
			t.Errorf("%s: spacing %v exceeds %v — a venue this slow would not finish a cycle", c.id, c.spacing, ceiling)
		}
	}
}

// TestEveryCandidateCanBuild pins that each entry actually wires a constructor. A nil build would
// panic at startup, after the pool is open and the migrations have run.
func TestEveryCandidateCanBuild(t *testing.T) {
	for _, c := range registry() {
		if c.build == nil {
			t.Errorf("%s: no build function", c.id)
		}
	}
}

// TestHyperliquidVenuesShareOneRateLimitGroup pins the invariant the group field exists for.
//
// Hyperliquid rate-limits by IP, not by venue: the core dex and all ten HIP-3 dexes draw on one
// budget of 1200 weight a minute. Eleven separate clients would each think they had the whole
// allowance and spend eleven times the intended rate. Contrast lighter, whose two deployments are
// on separate hosts and deliberately do NOT share a group.
func TestHyperliquidVenuesShareOneRateLimitGroup(t *testing.T) {
	var groups []string
	for _, c := range registry() {
		if c.id != "hyperliquid" && !strings.HasPrefix(c.id, "hl-") {
			continue
		}
		if c.group == "" {
			t.Errorf("%s: no rate-limit group — it would get its own client and its own budget", c.id)
			continue
		}
		groups = append(groups, c.group)
	}
	if len(groups) != 11 {
		t.Fatalf("found %d hyperliquid venues, want 11 (core plus ten HIP-3 dexes)", len(groups))
	}
	for _, g := range groups[1:] {
		if g != groups[0] {
			t.Fatalf("hyperliquid venues span more than one group (%q and %q)", groups[0], g)
		}
	}
}

// TestNonHyperliquidVenuesAreUngrouped pins the other half of that rule: a venue accidentally given
// hyperliquid's group would share its client, and inherit a circuit breaker tripped by a venue it
// has nothing to do with.
func TestNonHyperliquidVenuesAreUngrouped(t *testing.T) {
	for _, c := range registry() {
		if c.id == "hyperliquid" || strings.HasPrefix(c.id, "hl-") {
			continue
		}
		if c.group != "" {
			t.Errorf("%s: unexpected rate-limit group %q — it would share a client with another venue", c.id, c.group)
		}
	}
}
