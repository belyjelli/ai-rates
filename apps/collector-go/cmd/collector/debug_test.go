package main

import (
	"strings"
	"testing"
	"time"
)

func TestStatusStateFollowsTheNewestRun(t *testing.T) {
	now := time.Now()
	ago := func(d time.Duration) *time.Time { at := now.Add(-d); return &at }
	stale := 3 * time.Minute

	for name, tc := range map[string]struct {
		v    venueStatus
		want string
	}{
		"never ran":                 {venueStatus{}, "silent"},
		"newest failed, none since": {venueStatus{lastRun: ago(time.Minute), lastOK: ago(10 * time.Minute), lastRunFailed: true}, "failing"},
		// toobit: one "Too many requests" between successes is flaky, not failing.
		"newest failed, ok recently": {venueStatus{lastRun: ago(30 * time.Second), lastOK: ago(90 * time.Second), lastRunFailed: true}, "flaky"},
		"ok but too long ago":        {venueStatus{lastRun: ago(10 * time.Minute), lastOK: ago(10 * time.Minute)}, "stale"},
		"ran recently and fine":      {venueStatus{lastRun: ago(30 * time.Second), lastOK: ago(30 * time.Second)}, "ok"},
		"runs but never succeeded":   {venueStatus{lastRun: ago(time.Minute)}, "stale"},
	} {
		if got := tc.v.state(now, stale); got != tc.want {
			t.Errorf("%s: got %s, want %s", name, got, tc.want)
		}
	}
}

// TestStatusFlagsAnImplausibleLiquidationAverage is the Binance testnet leak: $85M single rows made
// the venue's average $611k, which is a units bug or a wrong host, never a market.
func TestStatusFlagsAnImplausibleLiquidationAverage(t *testing.T) {
	leak := venueStatus{liq24h: 7886, liqAvgUSD: 611_000}
	if !strings.Contains(leak.note(), "check units or host") {
		t.Errorf("a $611k average must be flagged, note %q", leak.note())
	}
	honest := venueStatus{liq24h: 2225, liqAvgUSD: 1760}
	if honest.note() != "" {
		t.Errorf("a $1,760 average must not be flagged, note %q", honest.note())
	}
}

func TestDebugCommandsRefuseClearly(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	for _, tc := range []struct {
		args []string
		want string
	}{
		{[]string{"status"}, "DATABASE_URL is required"},
		{[]string{"runs", "gate"}, "DATABASE_URL is required"},
		// gate's liquidations are polled, so there is no socket to watch.
		{[]string{"watch", "gate"}, "collector liqs gate"},
		// lighter subscribes per market and there is no database to list them from.
		{[]string{"watch", "lighter"}, "pass --symbols"},
		// lighter's liquidations arrive by socket, not by a polled fetch.
		{[]string{"liqs", "lighter"}, "collector watch lighter"},
		{[]string{"liqs", "nope"}, `no adapter for "nope"`},
		{[]string{"history", "nope", "X"}, `no adapter for "nope"`},
	} {
		code, _, errOut := cli(t, tc.args...)
		if code != 1 || !strings.Contains(errOut, tc.want) {
			t.Errorf("%v: exit %d, stderr %q, want it to mention %q", tc.args, code, errOut, tc.want)
		}
	}
}

func TestDoctorSkipsWhatItCannotReachAndPassesTheRest(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("VENUE_CATALOG", "../../../../packages/venues/catalog.json")
	t.Setenv("HEALTH_PORT", "1") // nothing listens there, so the running-collector check skips
	code, out, errOut := cli(t, "doctor")
	if code != 0 {
		t.Fatalf("doctor exited %d:\n%s%s", code, out, errOut)
	}
	for _, want := range []string{"ok    config", "ok    catalog", "ok    registry", "skip  database", "skip  running collector"} {
		if !strings.Contains(out, want) {
			t.Errorf("doctor output is missing %q:\n%s", want, out)
		}
	}
}
