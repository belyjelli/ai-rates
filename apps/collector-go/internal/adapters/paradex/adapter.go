package paradex

import (
	"context"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	apiBase = "https://api.prod.paradex.trade/v1"
	// marketsTTL: /markets is ~4 MB and changes rarely.
	marketsTTL = time.Hour
	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's
	// minIntervalMs of 150. Exported because the spacing lives on the client the caller builds, not
	// on the adapter.
	MinInterval = 150 * time.Millisecond
)

// Adapter fetches Paradex's perpetual market data.
//
// It caches /markets, which is the only mutable state it holds. No lock guards it: unlike the
// binance-fapi family this adapter exposes no second loop — Paradex publishes no settlements to
// sweep — so FetchSnapshots is the only reader and writer, and a venue's cycles never overlap.
type Adapter struct {
	client *httpclient.Client

	markets          *Results[Market]
	marketsFetchedAt time.Time

	// liq is the liquidation poll's cursor, which runs on its own goroutine (see liquidations.go).
	liq liqState
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every live perp.
//
// Two calls, one of them usually cached: the market list carries the funding period, the settlement
// currency and the RWA tag, none of which the summary states, and it is refetched only once an hour.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	if a.markets == nil || now.Sub(a.marketsFetchedAt) >= marketsTTL {
		var markets Results[Market]
		if err := a.client.GetJSON(ctx, apiBase+"/markets", &markets); err != nil {
			return core.SnapshotBatch{}, err
		}
		a.markets = &markets
		a.marketsFetchedAt = now
	}

	var summary Results[Summary]
	if err := a.client.GetJSON(ctx, apiBase+"/markets/summary?market=ALL", &summary); err != nil {
		return core.SnapshotBatch{}, err
	}
	return core.SnapshotBatch{Snapshots: ParseSnapshots(summary, *a.markets, now.UnixMilli())}, nil
}

// No FetchFundingHistory: /v1/funding/data returns continuous accrual samples, not settlements.
