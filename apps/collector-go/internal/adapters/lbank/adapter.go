package lbank

import (
	"context"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// MinInterval is the spacing this venue's client should use. LBank documents no rate limit;
	// ccxt costs these endpoints 2.5 against a 20ms unit, i.e. 20 requests a second. Two requests a
	// cycle at 100ms apart is well inside that.
	MinInterval = 100 * time.Millisecond

	instrumentURL = APIBase + "/instrument?productGroup=" + productGroup
	marketDataURL = APIBase + "/marketData?productGroup=" + productGroup
)

// Adapter collects LBank's USDT-margined perpetuals.
//
// Two requests a cycle at most: `marketData` always, and `instrument` only once an hour. There is
// deliberately NO FetchFundingHistory -- LBank publishes no funding-history endpoint, so the only
// history that can ever exist for this venue is what the collector records live.
//
// The instrument cache lives HERE, not at package scope as the TypeScript keeps it in a closure. In
// Go the collector runs each venue on its own goroutine against a shared process, so a package-level
// cache would be unsynchronised shared state -- a data race the detector flags immediately.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// tradable is replaced wholesale rather than mutated, so a reader holding the previous map is
	// never racing a refresh.
	tradable  map[string]Tradable
	loaded    bool
	fetchedAt int64
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// instruments returns the tradable list, refreshing it when the cache is older than
// InstrumentsMaxAgeMs.
func (a *Adapter) instruments(ctx context.Context, nowMs int64) (map[string]Tradable, error) {
	a.mu.Lock()
	loaded, fetchedAt, cached := a.loaded, a.fetchedAt, a.tradable
	a.mu.Unlock()

	if loaded && nowMs-fetchedAt < InstrumentsMaxAgeMs {
		return cached, nil
	}

	var env Envelope[Instrument]
	if err := a.client.GetJSON(ctx, instrumentURL, &env); err != nil {
		return nil, err
	}
	rows, err := env.unwrap("instrument")
	if err != nil {
		return nil, err
	}
	fresh := TradableInstruments(rows)

	a.mu.Lock()
	a.tradable = fresh
	a.loaded = true
	a.fetchedAt = nowMs
	a.mu.Unlock()
	return fresh, nil
}

// FetchSnapshots runs one cycle: the hourly instrument list for identity and tradability, then
// `marketData` for funding, prices and volume.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	tradable, err := a.instruments(ctx, nowMs)
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var env Envelope[MarketData]
	if err := a.client.GetJSON(ctx, marketDataURL, &env); err != nil {
		return core.SnapshotBatch{}, err
	}
	rows, err := env.unwrap("marketData")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	// Nothing settled arrives with the snapshot call: `fundingRate` is the running estimate, and
	// LBank publishes no settled figure anywhere.
	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(rows, tradable, nowMs),
		Settled:   []core.FundingEvent{},
	}, nil
}
