package collector

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Fetcher is the slice of a venue adapter the snapshot loop needs.
type Fetcher interface {
	VenueID() string
	FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error)
	RequestCount() int
}

// KnownMarket is a market the collector already has stored, for seeding an adapter's caches after a
// restart.
type KnownMarket struct {
	VenueSymbol string
	// IntervalHours is nil where the venue has never reported one.
	IntervalHours *float64
}

// WarmUpper is an adapter that can be seeded from what the collector already knows.
//
// Optional, and most venues do not implement it. It exists because some venues only emit a market
// once the adapter has learned something about it that no bulk call returns. MEXC is the measured
// case: it emits a market only once it knows the settlement interval, and that cache refilled at
// exactly 40 per cycle — 160 markets after 4 cycles, 400 after 10, 480 of 1191 after 12 — so for
// about half an hour after every restart most of the venue was missing from the screener.
//
// Seeded once, before the first cycle, from markets seen recently enough to still be listed.
type WarmUpper interface {
	WarmUp(markets []KnownMarket)
}

// BatchStore is the slice of the store the snapshot loop needs. Narrow on purpose: the loop's tests
// fake this, and a fake that has to implement the whole store stops being written.
type BatchStore interface {
	RecordBatch(ctx context.Context, venueID string, batch core.SnapshotBatch, observedAt time.Time) error
	RecordRun(ctx context.Context, run Run) error
}

// LoopOptions configures one venue's snapshot loop.
type LoopOptions struct {
	Interval time.Duration
	// Offset within each interval, so venues do not all fire on the same second.
	Offset time.Duration
	// Timeout after which a cycle is recorded as failed and the loop moves on. A cycle that hangs
	// must not hold the next one: the venue's next tick is more useful than this one's answer.
	Timeout time.Duration
	Now     func() time.Time
	OnRun   func(Run)
	Log     func(string)
}

// VenueLoop collects one venue on a fixed wall-clock cadence. Cycles never overlap and never panic.
type VenueLoop struct {
	fetcher Fetcher
	store   BatchStore
	opts    LoopOptions

	mu      sync.Mutex
	running bool

	cancel context.CancelFunc
	done   chan struct{}
}

func NewVenueLoop(fetcher Fetcher, store BatchStore, opts LoopOptions) *VenueLoop {
	if opts.Timeout <= 0 {
		opts.Timeout = 45 * time.Second
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	return &VenueLoop{fetcher: fetcher, store: store, opts: opts}
}

func (l *VenueLoop) VenueID() string { return l.fetcher.VenueID() }

// RunOnce runs one collection cycle, returning nil if the previous cycle is still running.
//
// It never returns an adapter error: a failed cycle is RECORDED, not propagated, because the loop's
// job is to keep collecting and the failure's home is collector_runs and /status. That is what lets
// one broken venue leave the other 55 untouched.
func (l *VenueLoop) RunOnce(ctx context.Context) *Run {
	l.mu.Lock()
	if l.running {
		l.mu.Unlock()
		return nil
	}
	l.running = true
	l.mu.Unlock()
	defer func() {
		l.mu.Lock()
		l.running = false
		l.mu.Unlock()
	}()

	venueID := l.fetcher.VenueID()
	startedAt := l.opts.Now()
	requestsBefore := l.fetcher.RequestCount()

	run := Run{VenueID: venueID, StartedAt: startedAt}

	cycleCtx, cancel := context.WithTimeout(ctx, l.opts.Timeout)
	batch, err := l.fetchGuarded(cycleCtx, startedAt)
	cancel()

	if err == nil {
		run.Markets = len(batch.Snapshots)
		if storeErr := l.store.RecordBatch(ctx, venueID, batch, startedAt); storeErr != nil {
			err = storeErr
			run.Markets = 0
		}
	}

	run.Err = err
	run.Duration = l.opts.Now().Sub(startedAt)
	run.Requests = l.fetcher.RequestCount() - requestsBefore

	if recordErr := l.store.RecordRun(ctx, run); recordErr != nil {
		l.logf("%s: failed to record run: %s", venueID, DescribeError(recordErr))
	}
	if l.opts.OnRun != nil {
		l.opts.OnRun(run)
	}
	if run.Err != nil {
		l.logf("%s: %s", venueID, DescribeError(run.Err))
	}
	return &run
}

// fetchGuarded turns a panicking adapter into a failed cycle. A parser that panics on one venue's
// unexpected payload must not take the process down with it — 55 other venues are collecting in the
// same binary, and the Bun collector's equivalent lesson was that an unhandled rejection exits.
func (l *VenueLoop) fetchGuarded(ctx context.Context, now time.Time) (batch core.SnapshotBatch, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic in %s adapter: %v", l.fetcher.VenueID(), r)
		}
	}()
	return l.fetcher.FetchSnapshots(ctx, now)
}

// logf writes through the caller-supplied logger, if there is one. Nil-tolerant on purpose: the
// tests construct loops without a logger, and a loop must never fail because nobody is listening.
func (l *VenueLoop) logf(format string, args ...any) {
	if l.opts.Log == nil {
		return
	}
	l.opts.Log(fmt.Sprintf(format, args...))
}

// Start begins the loop. It returns immediately; Stop waits for any in-flight cycle.
func (l *VenueLoop) Start(ctx context.Context) {
	loopCtx, cancel := context.WithCancel(ctx)
	l.cancel = cancel
	l.done = make(chan struct{})

	go func() {
		defer close(l.done)
		timer := time.NewTimer(MsUntilNextTick(l.opts.Now(), l.opts.Interval, l.opts.Offset))
		defer timer.Stop()
		for {
			select {
			case <-loopCtx.Done():
				return
			case <-timer.C:
				l.RunOnce(loopCtx)
				timer.Reset(MsUntilNextTick(l.opts.Now(), l.opts.Interval, l.opts.Offset))
			}
		}
	}()
}

// Stop stops scheduling and waits for an in-flight cycle to finish, bounded by ctx.
func (l *VenueLoop) Stop(ctx context.Context) error {
	if l.cancel == nil {
		return nil
	}
	l.cancel()
	select {
	case <-l.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// MsUntilNextTick is the time until the next `k*interval + offset` strictly after now.
//
// Phase is computed in UNIX nanoseconds, not as a duration since the zero Time. time.Duration is
// int64 nanoseconds and tops out around 292 years, so `now.Sub(time.Time{})` — two millennia —
// overflows and yields a garbage phase. Epoch nanoseconds are ~1.79e18 today, comfortably inside
// the range, and match the epoch-milliseconds arithmetic the TypeScript scheduler uses.
func MsUntilNextTick(now time.Time, interval, offset time.Duration) time.Duration {
	if interval <= 0 {
		return 0
	}
	phase := (now.UnixNano() - int64(offset)) % int64(interval)
	if phase < 0 {
		phase += int64(interval)
	}
	return time.Duration(int64(interval) - phase)
}

// PeriodicTask runs a job repeatedly with a fixed pause between runs. It never overlaps and never
// panics out of the goroutine.
type PeriodicTask struct {
	name  string
	pause time.Duration
	job   func(context.Context) error
	log   func(string)

	cancel context.CancelFunc
	done   chan struct{}
}

func NewPeriodicTask(name string, pause time.Duration, job func(context.Context) error, log func(string)) *PeriodicTask {
	return &PeriodicTask{name: name, pause: pause, job: job, log: log}
}

func (p *PeriodicTask) Start(ctx context.Context, initialDelay time.Duration) {
	taskCtx, cancel := context.WithCancel(ctx)
	p.cancel = cancel
	p.done = make(chan struct{})

	go func() {
		defer close(p.done)
		timer := time.NewTimer(initialDelay)
		defer timer.Stop()
		for {
			select {
			case <-taskCtx.Done():
				return
			case <-timer.C:
				p.runGuarded(taskCtx)
				timer.Reset(p.pause)
			}
		}
	}()
}

func (p *PeriodicTask) runGuarded(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil && p.log != nil {
			p.log(fmt.Sprintf("%s panicked: %v", p.name, r))
		}
	}()
	if err := p.job(ctx); err != nil && p.log != nil {
		p.log(fmt.Sprintf("%s failed: %s", p.name, DescribeError(err)))
	}
}

func (p *PeriodicTask) Stop(ctx context.Context) error {
	if p.cancel == nil {
		return nil
	}
	p.cancel()
	select {
	case <-p.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
