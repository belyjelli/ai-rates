package adapters

import (
	"context"
	"sync"
	"time"
)

// Pacer spaces calls to ONE endpoint more widely than the venue's client spaces everything.
//
// The client's MinInterval is tuned for the snapshot loop's handful of bulk calls, and some
// per-market endpoints are limited far more tightly than the venue as a whole: OKX's rubik taker
// volume allows 5 requests per 2 seconds (measured 2026-09-17: the sixth request of a burst answered
// HTTP 429, code 50011) against the 120ms the OKX client uses. A second client would give the venue
// two circuit breakers with partial views, so the tighter limit is enforced here instead and the
// request still goes through the shared client, whose spacing and breaker apply on top.
//
// Safe for concurrent use. A nil *Pacer never waits.
type Pacer struct {
	every time.Duration

	mu   sync.Mutex
	next time.Time
}

// NewPacer spaces call starts at least `every` apart.
func NewPacer(every time.Duration) *Pacer {
	return &Pacer{every: every}
}

// Wait blocks until the next slot, or returns ctx's error if it ends first. A slot is claimed
// before sleeping, so concurrent callers queue rather than all waking at the same instant.
func (p *Pacer) Wait(ctx context.Context) error {
	if p == nil || p.every <= 0 {
		return ctx.Err()
	}
	p.mu.Lock()
	now := time.Now()
	slot := p.next
	if slot.Before(now) {
		slot = now
	}
	p.next = slot.Add(p.every)
	p.mu.Unlock()

	wait := time.Until(slot)
	if wait <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
