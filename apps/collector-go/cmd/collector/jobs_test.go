package main

import (
	"context"
	"io"
	"log/slog"
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
)

// TestEveryScheduledJobIsWatched pins that each job startJobs schedules is registered with the job
// watch, and that jobWatchNames — which the boot message counts — names exactly those.
//
// A job added to startJobs without its watch would be the 2026-09-15 failure again: it could stop
// running and nothing would say so.
func TestEveryScheduledJobIsWatched(t *testing.T) {
	// A cancelled context stops every task before its first run, so the nil store is never touched.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	watch := collector.NewJobWatch(time.Now())
	tasks := startJobs(ctx, config{interval: time.Minute}, nil, slog.New(slog.NewTextHandler(io.Discard, nil)), watch)

	grace, done := context.WithTimeout(context.Background(), time.Second)
	defer done()
	for _, task := range tasks {
		if err := task.Stop(grace); err != nil {
			t.Fatalf("task did not stop: %v", err)
		}
	}

	want := append([]string(nil), jobWatchNames...)
	sort.Strings(want)
	if got := watch.Names(); !reflect.DeepEqual(got, want) {
		t.Fatalf("watched %q\nwant %q (jobWatchNames)", got, want)
	}
	if len(tasks) != len(want) {
		t.Fatalf("started %d tasks, watching %d jobs", len(tasks), len(want))
	}
}
