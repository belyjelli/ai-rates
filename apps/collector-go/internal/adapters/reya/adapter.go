package reya

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// definitionsTTL: marketDefinitions only says which markets are live and what leverage they carry,
// which changes on listings rather than on trades, so it is cached instead of fetched every cycle.
const definitionsTTL = time.Hour

// Adapter fetches Reya's perp market data.
//
// The definitions cache is guarded because a venue's loops share one adapter: VenueLoop guarantees
// its own cycles never overlap, but it makes no such promise against anything running beside it.
type Adapter struct {
	client *httpclient.Client

	mu             sync.Mutex
	definitions    []MarketDefinition
	definitionsAt  time.Time
	hasDefinitions bool
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every live Reya perp.
//
// The hourly definitions call comes first because it is what says a market is live at all: a summary
// row without one is a delisted market Reya still reports with zero volume.
//
// No FetchFundingHistory: Reya publishes no market funding history.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	if err := a.refreshDefinitions(ctx, now); err != nil {
		return core.SnapshotBatch{}, err
	}

	var summaries []MarketSummary
	if err := a.client.GetJSON(ctx, API+"/perpMarkets/summary", &summaries); err != nil {
		return core.SnapshotBatch{}, err
	}
	if summaries == nil {
		return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected perpMarkets/summary response", VenueID)
	}

	a.mu.Lock()
	definitions := a.definitions
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: ParseSnapshots(summaries, definitions, now.UnixMilli())}, nil
}

func (a *Adapter) refreshDefinitions(ctx context.Context, now time.Time) error {
	a.mu.Lock()
	fresh := a.hasDefinitions && now.Sub(a.definitionsAt) < definitionsTTL
	a.mu.Unlock()
	if fresh {
		return nil
	}

	var body []MarketDefinition
	if err := a.client.GetJSON(ctx, API+"/marketDefinitions", &body); err != nil {
		return err
	}
	if body == nil {
		return fmt.Errorf("%s: unexpected marketDefinitions response", VenueID)
	}

	a.mu.Lock()
	a.definitions = body
	a.definitionsAt = now
	a.hasDefinitions = true
	a.mu.Unlock()
	return nil
}
