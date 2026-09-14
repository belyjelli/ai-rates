package perpl

import (
	"context"
	"errors"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://app.perpl.xyz/api/v1"

	// MinInterval is the spacing this venue's client should use, ported from the TypeScript
	// adapter's minIntervalMs: 1000. The public budget is ~100 requests a minute and one call per
	// cycle is used, so this is a hundredth of it.
	MinInterval = 1000 * time.Millisecond
)

// ErrUnexpectedContext is returned when /pub/context answers with something that is not the context
// document — an error envelope, say. Failing the cycle is deliberate: emitting nothing would look
// like a venue that had delisted every market.
var ErrUnexpectedContext = errors.New("perpl: unexpected pub/context response")

// Adapter collects Perpl's Monad perpetuals.
//
// It owns no state beyond its client: one `/pub/context` call carries every market's config, live
// state and latest funding event, so there is no rotation cursor or cache that would have to become
// mutex-guarded adapter state once the collector runs each venue on its own goroutine.
type Adapter struct {
	client *httpclient.Client
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots runs one cycle: a single GET /pub/context (11.6 KB), which carries everything.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var body Context
	if err := a.client.GetJSON(ctx, baseURL+"/pub/context", &body); err != nil {
		return core.SnapshotBatch{}, err
	}
	if body.Markets == nil || body.Tokens == nil || body.Instances == nil {
		return core.SnapshotBatch{}, ErrUnexpectedContext
	}
	return ParseContext(body, now.UnixMilli()), nil
}

// No FetchFundingHistory: Perpl publishes no public market funding history, so history accrues
// forward from the settled events FetchSnapshots returns.
