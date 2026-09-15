package collector

import (
	"fmt"
	"sort"
	"sync"
	"time"
)

// JobWatch turns the fleet-wide jobs' outcomes into alerts: a job that starts failing, one that has
// not succeeded when it should have, and each recovery.
//
// It exists because of 2026-09-15. The Go cutover dropped every scheduled job, snapshots kept flowing,
// /status stayed green, and the site served frozen figures for ten hours with nothing reporting it —
// a stale-venue alert cannot see a job that never runs. Overdue is judged against the job's own
// cadence, so a job that silently stops, hangs, or was never wired is reported like one that errors.
//
// Transitions only: one message when a job goes wrong, one when it recovers, never one per run.
type JobWatch struct {
	mu      sync.Mutex
	started time.Time
	jobs    map[string]*watchedJob
	pending []AlertPayload
}

type watchedJob struct {
	firstRunBy time.Duration
	every      time.Duration
	lastOK     time.Time
	failing    bool
	overdue    bool
}

// NewJobWatch starts watching from the collector's boot time.
func NewJobWatch(started time.Time) *JobWatch {
	return &JobWatch{started: started, jobs: map[string]*watchedJob{}}
}

// Expect registers a job that first runs firstRunBy after boot and then every `every`.
//
// A job is overdue when it has not succeeded by its first run plus one full period, or, once it has,
// by two periods after its last success. The slack is deliberate: a slow run is not an outage.
func (w *JobWatch) Expect(name string, firstRunBy, every time.Duration) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.jobs[name] = &watchedJob{firstRunBy: firstRunBy, every: every}
}

// Names lists the watched jobs, sorted.
func (w *JobWatch) Names() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	names := make([]string, 0, len(w.jobs))
	for name := range w.jobs {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// Record notes one run's outcome.
func (w *JobWatch) Record(name string, at time.Time, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	job, ok := w.jobs[name]
	if !ok {
		return
	}
	if err != nil {
		if !job.failing {
			job.failing = true
			w.pending = append(w.pending, AlertPayload{
				Text: fmt.Sprintf("airates: job %q failed: %s", name, DescribeError(err)),
			})
		}
		return
	}
	if job.failing || job.overdue {
		w.pending = append(w.pending, AlertPayload{
			Text: fmt.Sprintf("airates: job %q ran successfully again", name),
			OK:   true,
		})
	}
	job.lastOK, job.failing, job.overdue = at, false, false
}

// Check returns every transition since the last call, including jobs that became overdue by now.
func (w *JobWatch) Check(now time.Time) []AlertPayload {
	w.mu.Lock()
	defer w.mu.Unlock()

	names := make([]string, 0, len(w.jobs))
	for name := range w.jobs {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		job := w.jobs[name]
		deadline := w.started.Add(job.firstRunBy + job.every)
		since := "boot at " + w.started.UTC().Format(time.RFC3339)
		if !job.lastOK.IsZero() {
			deadline = job.lastOK.Add(2 * job.every)
			since = job.lastOK.UTC().Format(time.RFC3339)
		}
		// Overdue is for a job that has gone quiet. One already reported as failing has had its
		// message: it has not succeeded either, and saying so again would be two alerts for one fault.
		if !job.overdue && !job.failing && now.After(deadline) {
			job.overdue = true
			w.pending = append(w.pending, AlertPayload{
				Text: fmt.Sprintf("airates: job %q has not succeeded since %s (runs every %s)", name, since, job.every),
			})
		}
	}

	out := w.pending
	w.pending = nil
	return out
}
