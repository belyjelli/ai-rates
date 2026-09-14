package collector

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

type fakeFetcher struct {
	venueID  string
	batch    core.SnapshotBatch
	err      error
	panicMsg string
	requests int
	// gate, when non-nil, blocks the fetch until it is closed, so a second caller can observe the
	// no-overlap guard. entered is closed from INSIDE the fetch, which is the only point at which
	// the cycle provably holds the guard — signalling before the call is racy, and the second
	// RunOnce could win instead.
	gate    chan struct{}
	entered chan struct{}
}

func (f *fakeFetcher) VenueID() string { return f.venueID }

func (f *fakeFetcher) RequestCount() int { return f.requests }

func (f *fakeFetcher) FetchSnapshots(ctx context.Context, _ time.Time) (core.SnapshotBatch, error) {
	if f.entered != nil {
		close(f.entered)
		f.entered = nil
	}
	if f.gate != nil {
		select {
		case <-f.gate:
		case <-ctx.Done():
			return core.SnapshotBatch{}, ctx.Err()
		}
	}
	f.requests++
	if f.panicMsg != "" {
		panic(f.panicMsg)
	}
	if f.err != nil {
		return core.SnapshotBatch{}, f.err
	}
	return f.batch, nil
}

type fakeStore struct {
	batches  int
	runs     []Run
	batchErr error
	runErr   error
}

func (s *fakeStore) RecordBatch(context.Context, string, core.SnapshotBatch, time.Time) error {
	s.batches++
	return s.batchErr
}

func (s *fakeStore) RecordRun(_ context.Context, run Run) error {
	s.runs = append(s.runs, run)
	return s.runErr
}

func snapshots(n int) core.SnapshotBatch {
	batch := core.SnapshotBatch{Snapshots: make([]core.FundingSnapshot, n)}
	return batch
}

func TestMsUntilNextTickAlignsToTheInterval(t *testing.T) {
	base := time.Unix(0, 0).UTC()

	// On a boundary the next tick is a whole interval away: STRICTLY after, never zero, or a loop
	// would spin.
	if got := MsUntilNextTick(base, time.Minute, 0); got != time.Minute {
		t.Errorf("on boundary: got %v, want 1m", got)
	}
	if got := MsUntilNextTick(base.Add(90*time.Second), time.Minute, 0); got != 30*time.Second {
		t.Errorf("90s in: got %v, want 30s", got)
	}
	// The offset is what keeps 56 venues off the same second.
	if got := MsUntilNextTick(base.Add(90*time.Second), time.Minute, 10*time.Second); got != 40*time.Second {
		t.Errorf("90s in with 10s offset: got %v, want 40s", got)
	}

	// The overflow this function had: a real wall-clock time must still produce a sane tick, not a
	// garbage phase from a duration that does not fit in int64 nanoseconds.
	realNow := time.Date(2026, 9, 14, 12, 34, 56, 0, time.UTC)
	got := MsUntilNextTick(realNow, time.Minute, 0)
	if got <= 0 || got > time.Minute {
		t.Errorf("real clock: got %v, want a value in (0, 1m]", got)
	}
	if got != 4*time.Second {
		t.Errorf("real clock: got %v, want 4s (56s past the minute)", got)
	}
}

func TestRunOnceRecordsASuccessfulCycle(t *testing.T) {
	fetcher := &fakeFetcher{venueID: "bybit", batch: snapshots(3)}
	store := &fakeStore{}
	loop := NewVenueLoop(fetcher, store, LoopOptions{Interval: time.Minute})

	run := loop.RunOnce(context.Background())
	if run == nil {
		t.Fatal("RunOnce returned nil")
	}
	if run.Err != nil {
		t.Errorf("err: got %v, want nil", run.Err)
	}
	if run.Markets != 3 {
		t.Errorf("markets: got %d, want 3", run.Markets)
	}
	if run.Requests != 1 {
		t.Errorf("requests: got %d, want 1", run.Requests)
	}
	if store.batches != 1 || len(store.runs) != 1 {
		t.Errorf("store: got %d batches and %d runs, want 1 and 1", store.batches, len(store.runs))
	}
}

func TestRunOnceRecordsAdapterFailureRatherThanPropagatingIt(t *testing.T) {
	// One broken venue must leave the other 55 collecting, so a failed cycle's home is
	// collector_runs and /status — not an error returned up the stack.
	fetcher := &fakeFetcher{venueID: "gate", err: errors.New("HTTP 503 upstream down")}
	store := &fakeStore{}
	loop := NewVenueLoop(fetcher, store, LoopOptions{Interval: time.Minute})

	run := loop.RunOnce(context.Background())
	if run == nil || run.Err == nil {
		t.Fatalf("want a recorded failure, got %+v", run)
	}
	if run.Markets != 0 {
		t.Errorf("markets: got %d, want 0", run.Markets)
	}
	if store.batches != 0 {
		t.Errorf("batches: got %d, want 0 — a failed fetch must not write", store.batches)
	}
	if len(store.runs) != 1 || store.runs[0].Err == nil {
		t.Errorf("the failure must still be recorded as a run: %+v", store.runs)
	}
}

func TestRunOncePanicInAnAdapterBecomesAFailedCycle(t *testing.T) {
	// A parser that panics on one venue's unexpected payload must not take down a process
	// collecting 55 others.
	fetcher := &fakeFetcher{venueID: "mexc", panicMsg: "index out of range"}
	store := &fakeStore{}
	loop := NewVenueLoop(fetcher, store, LoopOptions{Interval: time.Minute})

	run := loop.RunOnce(context.Background())
	if run == nil || run.Err == nil {
		t.Fatalf("want a recorded failure from the panic, got %+v", run)
	}
	if !strings.Contains(run.Err.Error(), "panic in mexc adapter") {
		t.Errorf("error: got %q, want it to name the panicking venue", run.Err)
	}
}

func TestRunOnceTreatsAStoreFailureAsAFailedCycle(t *testing.T) {
	fetcher := &fakeFetcher{venueID: "okx", batch: snapshots(5)}
	store := &fakeStore{batchErr: errors.New("connection closed")}
	loop := NewVenueLoop(fetcher, store, LoopOptions{Interval: time.Minute})

	run := loop.RunOnce(context.Background())
	if run == nil || run.Err == nil {
		t.Fatalf("want a failed run, got %+v", run)
	}
	// Markets is reset: reporting 5 collected when none were stored would make /status claim a
	// healthy venue whose rows never landed.
	if run.Markets != 0 {
		t.Errorf("markets: got %d, want 0 when the write failed", run.Markets)
	}
}

func TestRunOnceDoesNotOverlap(t *testing.T) {
	gate := make(chan struct{})
	entered := make(chan struct{})
	fetcher := &fakeFetcher{venueID: "bybit", batch: snapshots(1), gate: gate, entered: entered}
	store := &fakeStore{}
	loop := NewVenueLoop(fetcher, store, LoopOptions{Interval: time.Minute})

	finished := make(chan *Run, 1)
	go func() { finished <- loop.RunOnce(context.Background()) }()

	// Wait until the first cycle is provably inside the fetch and holding the guard. Only then is a
	// second call's refusal evidence of the guard rather than of scheduling luck.
	<-entered

	// Overlapping cycles would double a venue's request rate against its own rate limit.
	if second := loop.RunOnce(context.Background()); second != nil {
		t.Fatalf("a concurrent RunOnce was allowed to run: %+v", second)
	}

	close(gate)
	if run := <-finished; run == nil || run.Err != nil {
		t.Fatalf("first cycle: %+v", run)
	}
}

func TestStatusStalenessAndStartup(t *testing.T) {
	start := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	status := NewStatus([]string{"bybit", "gate"}, time.Minute, start, 3)

	// Before any run, the fleet is "starting": ok stays true so a restart does not page anyone, but
	// starting says this is not yet evidence of health.
	snap := status.Snapshot(start.Add(time.Second))
	if !snap.OK || !snap.Starting {
		t.Errorf("fresh fleet: got ok=%v starting=%v, want true/true", snap.OK, snap.Starting)
	}

	status.Record(Run{VenueID: "bybit", StartedAt: start.Add(time.Minute), Markets: 800})
	snap = status.Snapshot(start.Add(2 * time.Minute))
	if snap.Starting {
		t.Error("after one success the fleet is past startup")
	}
	if !snap.OK {
		t.Error("both venues are inside the stale window")
	}

	// Four minutes with no success is past 3 intervals: gate has never succeeded and is measured
	// from startup, so it goes stale and the fleet stops being ok.
	snap = status.Snapshot(start.Add(4 * time.Minute))
	if snap.OK {
		t.Error("want the fleet not ok once a venue passes the stale window")
	}
	byID := map[string]VenueHealth{}
	for _, v := range snap.Venues {
		byID[v.VenueID] = v
	}
	if byID["gate"].Stale != true {
		t.Error("gate never succeeded and must read stale")
	}
	if byID["bybit"].Markets != 800 {
		t.Errorf("bybit markets: got %d, want 800", byID["bybit"].Markets)
	}
}

func TestStatusReportsTheLastError(t *testing.T) {
	start := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	status := NewStatus([]string{"bybit"}, time.Minute, start, 3)
	status.Record(Run{VenueID: "bybit", StartedAt: start, Err: errors.New("HTTP 451 blocked")})

	snap := status.Snapshot(start.Add(time.Second))
	if snap.Venues[0].Error == nil || !strings.Contains(*snap.Venues[0].Error, "451") {
		t.Errorf("error: got %v, want it to carry the venue's message", snap.Venues[0].Error)
	}
}

func TestDescribeErrorTruncates(t *testing.T) {
	if got := DescribeError(nil); got != "" {
		t.Errorf("nil: got %q, want empty", got)
	}
	// A venue answering a megabyte of HTML must not write a megabyte row.
	long := errors.New(strings.Repeat("x", 900))
	if got := DescribeError(long); len(got) != 500 {
		t.Errorf("length: got %d, want 500", len(got))
	}
}
