// Package collector holds the runtime: the per-venue loops, the periodic jobs, and the in-memory
// health view they feed.
//
// Ported from apps/collector/src/{scheduler,periodic,health}.ts. The scheduling SHAPE is the same —
// fixed wall-clock cadence per venue, offset so venues never fire on the same second, cycles that
// never overlap and never panic — because that shape was tuned against real venue rate limits.
//
// What changes is the machinery. The Bun collector holds roughly 250 live timer closures (56 venues
// times snapshot, history, backfill, tiers and liquidation loops), each retaining its captured
// scope. Here each loop is a goroutine parked on a timer: about 2 KB of stack apiece, so the whole
// fleet is around half a megabyte, and cancellation is a context rather than a flag checked at the
// top of every callback.
package collector

import (
	"sync"
	"time"
)

// Run is one collection cycle's outcome, and the row written to collector_runs.
type Run struct {
	VenueID   string
	StartedAt time.Time
	Duration  time.Duration
	Markets   int
	Requests  int
	// Err is nil on success. It is stored truncated; see DescribeError.
	Err error
}

// VenueHealth is one venue's latest state, as /health and /status render it.
type VenueHealth struct {
	VenueID       string     `json:"venueId"`
	LastRunAt     *time.Time `json:"lastRunAt"`
	LastSuccessAt *time.Time `json:"lastSuccessAt"`
	Markets       int        `json:"markets"`
	Error         *string    `json:"error"`
	Stale         bool       `json:"stale"`
}

// Snapshot is the whole fleet's state at one instant.
type Snapshot struct {
	OK bool `json:"ok"`
	// Starting means no venue has ever reported a successful cycle.
	Starting bool          `json:"starting"`
	Venues   []VenueHealth `json:"venues"`
}

// Status is the in-memory view of each venue's latest cycle.
//
// A venue is stale when it has not SUCCEEDED within staleAfterIntervals intervals, counted from
// startup until its first success.
type Status struct {
	mu          sync.RWMutex
	venueIDs    []string
	interval    time.Duration
	startedAt   time.Time
	staleAfter  int
	last        map[string]Run
	lastSuccess map[string]Run
}

func NewStatus(venueIDs []string, interval time.Duration, startedAt time.Time, staleAfterIntervals int) *Status {
	if staleAfterIntervals <= 0 {
		staleAfterIntervals = 3
	}
	ids := make([]string, len(venueIDs))
	copy(ids, venueIDs)
	return &Status{
		venueIDs:    ids,
		interval:    interval,
		startedAt:   startedAt,
		staleAfter:  staleAfterIntervals,
		last:        make(map[string]Run, len(ids)),
		lastSuccess: make(map[string]Run, len(ids)),
	}
}

func (s *Status) Record(run Run) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.last[run.VenueID] = run
	if run.Err == nil {
		s.lastSuccess[run.VenueID] = run
	}
}

// Snapshot reports the fleet's health.
//
// OK stays true through the startup grace period on purpose: a venue that has never succeeded is
// measured from startedAt, so a restart does not page anyone. But that window is indistinguishable
// from a collector that will NEVER collect — the state the 2026-09-13 deploy showed, where every
// venue read markets 0 and lastRunAt null while /health still answered 200. Starting says which of
// the two it is, so a monitor can treat "not yet" differently from "healthy".
func (s *Status) Snapshot(now time.Time) Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	staleAfter := time.Duration(s.staleAfter) * s.interval
	venues := make([]VenueHealth, 0, len(s.venueIDs))
	allFresh := true

	for _, venueID := range s.venueIDs {
		health := VenueHealth{VenueID: venueID}
		reference := s.startedAt

		if run, ok := s.last[venueID]; ok {
			startedAt := run.StartedAt
			health.LastRunAt = &startedAt
			if run.Err != nil {
				message := DescribeError(run.Err)
				health.Error = &message
			}
		}
		if run, ok := s.lastSuccess[venueID]; ok {
			startedAt := run.StartedAt
			health.LastSuccessAt = &startedAt
			health.Markets = run.Markets
			reference = run.StartedAt
		}

		health.Stale = now.Sub(reference) > staleAfter
		if health.Stale {
			allFresh = false
		}
		venues = append(venues, health)
	}

	return Snapshot{OK: allFresh, Starting: len(s.lastSuccess) == 0, Venues: venues}
}

// DescribeError renders an error for storage and for /health, truncated the same way the TypeScript
// collector truncates it so a venue returning a megabyte of HTML cannot write a megabyte row.
func DescribeError(err error) string {
	if err == nil {
		return ""
	}
	message := err.Error()
	if len(message) > 500 {
		return message[:500]
	}
	return message
}
