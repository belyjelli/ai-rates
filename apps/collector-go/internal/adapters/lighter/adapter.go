package lighter

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// MinInterval is the spacing this venue's client should use. Unauthenticated REST is limited to ~60
// requests/min, on both deployments.
const MinInterval = 1100 * time.Millisecond

// Adapter collects one Lighter deployment.
//
// A FACTORY over a Deployment rather than one adapter per venue, as the TypeScript is: mainnet and
// Robinhood Chain run the same API and the same funding engine, and differ only in host, settlement
// currency and listings.
//
// The market-id cache lives HERE, not at package scope as the TypeScript closure keeps it. The two
// deployments are SEPARATE adapters that run concurrently on their own goroutines, and their market
// ids do not even agree — RH's market 42 is OPENAI where mainnet's is SPX — so a shared package-level
// map would be both a data race and a wrong answer.
type Adapter struct {
	client     *httpclient.Client
	deployment Deployment

	mu        sync.Mutex
	marketIDs map[string]int64
}

func NewAdapter(client *httpclient.Client, deployment Deployment) *Adapter {
	return &Adapter{client: client, deployment: deployment, marketIDs: map[string]int64{}}
}

// NewMainnetAdapter is the Lighter (Ethereum) deployment, the TypeScript's `lighterAdapter`.
func NewMainnetAdapter(client *httpclient.Client) *Adapter { return NewAdapter(client, Mainnet) }

// NewRHAdapter is Robinhood Chain Lighter, the TypeScript's `lighterRhAdapter`.
func NewRHAdapter(client *httpclient.Client) *Adapter { return NewAdapter(client, RH) }

func (a *Adapter) VenueID() string   { return a.deployment.VenueID }
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, a.deployment.API+path, out)
}

// FetchSnapshots runs one cycle: the funding rates, then the market details they join against.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var rates FundingRates
	if err := a.get(ctx, "/funding-rates", &rates); err != nil {
		return core.SnapshotBatch{}, err
	}
	var details OrderBookDetails
	if err := a.get(ctx, "/orderBookDetails", &details); err != nil {
		return core.SnapshotBatch{}, err
	}
	a.remember(details)
	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(rates, details, now.UnixMilli(), a.deployment),
	}, nil
}

func (a *Adapter) remember(details OrderBookDetails) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, detail := range details.OrderBookDetails {
		a.marketIDs[detail.Symbol] = detail.MarketID
	}
}

func (a *Adapter) lookup(symbol string) (int64, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	id, known := a.marketIDs[symbol]
	return id, known
}

// marketIDFor resolves a symbol to the numeric id `fundings` is keyed on, reading orderBookDetails
// only when the cache cannot answer.
//
// The fetch happens OUTSIDE the lock: holding a mutex across a network call would stall the snapshot
// loop for the length of a request on a venue spaced at 1.1s. Two callers racing here simply both
// fetch, which costs a request and cannot corrupt the map.
func (a *Adapter) marketIDFor(ctx context.Context, symbol string) (int64, bool, error) {
	if id, known := a.lookup(symbol); known {
		return id, true, nil
	}
	var details OrderBookDetails
	if err := a.get(ctx, "/orderBookDetails", &details); err != nil {
		return 0, false, err
	}
	a.remember(details)
	id, known := a.lookup(symbol)
	return id, known, nil
}

// FetchFundingHistory reads settled hourly payments for one market, paging forward in SECONDS —
// which is the unit this endpoint speaks, unlike every timestamp this collector stores.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	marketID, known, err := a.marketIDFor(ctx, venueSymbol)
	if err != nil {
		return nil, err
	}
	if !known {
		return nil, nil
	}

	rows := make([]Funding, 0, historyPageSize)
	start := fromMs / 1000
	end := toMs / 1000
	for start <= end {
		var page Fundings
		if err := a.get(ctx, fmt.Sprintf(
			"/fundings?market_id=%d&resolution=1h&start_timestamp=%d&end_timestamp=%d&count_back=0",
			marketID, start, end), &page); err != nil {
			return nil, err
		}
		rows = append(rows, page.Fundings...)
		if len(page.Fundings) < historyPageSize {
			break
		}
		last := page.Fundings[len(page.Fundings)-1]
		// A last row with no timestamp cannot advance the cursor. On the TypeScript side the arithmetic
		// produces NaN and the `start <= end` test ends the walk; Go would read the absent value as
		// zero and page the same window forever, so the walk stops here instead.
		if !last.Timestamp.OK {
			break
		}
		next := int64(last.Timestamp.Val) + 1
		if next <= start {
			break
		}
		start = next
	}
	return ParseFundings(venueSymbol, Fundings{Fundings: rows}, a.deployment), nil
}
