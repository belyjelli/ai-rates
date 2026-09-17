package adapters

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestPacerSpacesCallStartsAcrossGoroutines(t *testing.T) {
	const every = 20 * time.Millisecond
	pacer := NewPacer(every)
	starts := make([]time.Time, 0, 4)
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := pacer.Wait(context.Background()); err != nil {
				t.Error(err)
			}
			mu.Lock()
			starts = append(starts, time.Now())
			mu.Unlock()
		}()
	}
	wg.Wait()

	first, last := starts[0], starts[0]
	for _, at := range starts {
		if at.Before(first) {
			first = at
		}
		if at.After(last) {
			last = at
		}
	}
	// Four slots are three gaps. Concurrent callers queue for them rather than all waking together.
	if gap := last.Sub(first); gap < 3*every-2*time.Millisecond {
		t.Errorf("four calls spanned %v, want at least %v", gap, 3*every)
	}
}

func TestPacerStopsWaitingWhenCancelled(t *testing.T) {
	pacer := NewPacer(time.Hour)
	if err := pacer.Wait(context.Background()); err != nil {
		t.Fatalf("first slot is immediate, got %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if err := pacer.Wait(ctx); err == nil {
		t.Error("second slot is an hour away; want the context's error, not a wait")
	}
}

func TestNilPacerNeverWaits(t *testing.T) {
	var pacer *Pacer
	if err := pacer.Wait(context.Background()); err != nil {
		t.Error(err)
	}
}
