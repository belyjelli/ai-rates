package variational

import (
	"context"
	"fmt"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// MinIntervalMs is the minimum spacing between requests to Variational, in milliseconds. The API
// allows 10 requests per 10s per IP (https://docs.variational.io/technical-documentation/api), so
// 1s spacing. This is `minIntervalMs` on the TypeScript adapter.
const MinIntervalMs = 1000

// Adapter fetches Variational Omni's market stats.
//
// It owns no state beyond its client, so every loop for this venue can share one Adapter and
// therefore one set of request spacing and one circuit breaker — which is the point of the sharing,
// since Variational rate-limits by IP and not by caller.
type Adapter struct {
	client *httpclient.Client
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every live listing.
//
// One call: /metadata/stats carries every listing, so there is no join and no pagination.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var body Stats
	if err := a.client.GetJSON(ctx, APIBase+"/metadata/stats", &body); err != nil {
		return core.SnapshotBatch{}, err
	}
	// An absent or null `listings` is a shape change, not an empty venue, and must fail loudly
	// rather than report that Variational delisted everything.
	if body.Listings == nil {
		return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected metadata/stats response", VenueID)
	}
	return core.SnapshotBatch{Snapshots: ParseStats(body, now.UnixMilli()), Settled: nil}, nil
}

// No FetchFundingHistory: Variational publishes no funding history.
