package collector

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func texts(payloads []AlertPayload) []string {
	out := make([]string, len(payloads))
	for i, p := range payloads {
		out[i] = p.Text
	}
	return out
}

func TestJobWatchReportsAFailureOnceAndItsRecoveryOnce(t *testing.T) {
	boot := time.Date(2026, 9, 15, 7, 0, 0, 0, time.UTC)
	w := NewJobWatch(boot)
	w.Expect("identity checks", 7*time.Minute, time.Hour)

	w.Record("identity checks", boot.Add(7*time.Minute), errors.New("deadlock detected"))
	w.Record("identity checks", boot.Add(67*time.Minute), errors.New("deadlock detected"))
	got := w.Check(boot.Add(68 * time.Minute))
	if len(got) != 1 || got[0].OK || !strings.Contains(got[0].Text, `"identity checks" failed: deadlock detected`) {
		t.Fatalf("after two failures got %q, want one failure message", texts(got))
	}

	w.Record("identity checks", boot.Add(127*time.Minute), nil)
	w.Record("identity checks", boot.Add(187*time.Minute), nil)
	got = w.Check(boot.Add(188 * time.Minute))
	if len(got) != 1 || !got[0].OK || !strings.Contains(got[0].Text, "ran successfully again") {
		t.Fatalf("after recovering got %q, want one recovery message", texts(got))
	}
}

func TestJobWatchReportsAJobThatNeverRuns(t *testing.T) {
	// The 2026-09-15 failure: nothing errors, the job simply never happens.
	boot := time.Date(2026, 9, 15, 7, 0, 0, 0, time.UTC)
	w := NewJobWatch(boot)
	w.Expect("funding stats refresh", 3*time.Minute, 10*time.Minute)

	if got := w.Check(boot.Add(12 * time.Minute)); len(got) != 0 {
		t.Fatalf("inside the first period got %q, want nothing", texts(got))
	}
	got := w.Check(boot.Add(14 * time.Minute))
	if len(got) != 1 || !strings.Contains(got[0].Text, "has not succeeded since boot") {
		t.Fatalf("past first run plus a period got %q, want an overdue message", texts(got))
	}
	if got := w.Check(boot.Add(40 * time.Minute)); len(got) != 0 {
		t.Fatalf("still overdue got %q, want no repeat", texts(got))
	}

	w.Record("funding stats refresh", boot.Add(41*time.Minute), nil)
	if got := w.Check(boot.Add(42 * time.Minute)); len(got) != 1 || !got[0].OK {
		t.Fatalf("after the late success got %q, want one recovery", texts(got))
	}
}

func TestJobWatchAllowsTwoPeriodsAfterASuccessBeforeCallingItOverdue(t *testing.T) {
	boot := time.Date(2026, 9, 15, 7, 0, 0, 0, time.UTC)
	w := NewJobWatch(boot)
	w.Expect("ranked pair candidates", 68*time.Minute, 24*time.Hour)
	last := boot.Add(68 * time.Minute)
	w.Record("ranked pair candidates", last, nil)

	if got := w.Check(last.Add(47 * time.Hour)); len(got) != 0 {
		t.Fatalf("a slow nightly run got %q, want nothing", texts(got))
	}
	if got := w.Check(last.Add(49 * time.Hour)); len(got) != 1 {
		t.Fatalf("two missed nights got %q, want an overdue message", texts(got))
	}
}

func TestJobWatchIgnoresUnregisteredJobs(t *testing.T) {
	w := NewJobWatch(time.Now())
	w.Record("not watched", time.Now(), errors.New("boom"))
	if got := w.Check(time.Now()); len(got) != 0 {
		t.Fatalf("got %q, want nothing for a job nobody registered", texts(got))
	}
}
