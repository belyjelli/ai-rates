package hibachi

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// API is the data host. Exported so a caller can point a probe at the same base the adapter uses.
	API = "https://data-api.hibachi.xyz"
	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's
	// minIntervalMs of 250. Exported because the spacing lives on the client the caller builds, not
	// on the adapter. Hibachi publishes no REST rate limit (https://api-doc.hibachi.xyz, and none in
	// the SDK); at one request a minute that does not matter, and 250ms spacing covers history paging.
	MinInterval = 250 * time.Millisecond
	// historyPageSize: `limit` above 100 is served as 100 (measured 2026-09-13).
	historyPageSize = 100
	historyMaxPages = 50
)

// knownContract is the contract and tags history needs, remembered from the last inventory.
type knownContract struct {
	contract Contract
	tags     []string
}

// Adapter fetches Hibachi's perp market data.
//
// The contract cache is guarded because a venue's loops share one adapter: the snapshot loop writes
// it and the history loop reads it, and nothing promises those never overlap.
type Adapter struct {
	client *httpclient.Client

	mu        sync.Mutex
	contracts map[string]knownContract
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, contracts: make(map[string]knownContract)}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every LIVE market, in one request.
//
// Inventory carries every market's contract spec together with its live info, so nothing here is
// per symbol. The contracts are remembered on the way past, because funding history needs the
// declared quote and class that only inventory states.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var body Inventory
	if err := a.client.GetJSON(ctx, API+"/market/inventory", &body); err != nil {
		return core.SnapshotBatch{}, err
	}
	if body.Markets == nil {
		return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected inventory response", VenueID)
	}

	a.mu.Lock()
	for _, market := range body.Markets {
		known := knownContract{contract: market.Contract}
		if market.Info != nil {
			known.tags = market.Info.Tags
		}
		a.contracts[market.Contract.Symbol] = known
	}
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: ParseInventory(body, now.UnixMilli()), Settled: nil}, nil
}

// FetchFundingHistory returns settled hourly payments for one market in [fromMs, toMs], oldest
// first.
//
// Oldest first within [startTime, endTime] (both epoch seconds, inclusive), paged by offset: a short
// page is the last one.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingRow, 0, historyPageSize)
	window := fmt.Sprintf("startTime=%d&endTime=%d", fromMs/1000, toMs/1000)

	for page := 0; page < historyMaxPages; page++ {
		endpoint := fmt.Sprintf(
			"%s/market/data/funding-rates?symbol=%s&%s&limit=%d&offset=%d",
			API, url.QueryEscape(venueSymbol), window, historyPageSize, page*historyPageSize,
		)
		var body struct {
			Data []FundingRow `json:"data"`
		}
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		if body.Data == nil {
			return nil, fmt.Errorf("%s: unexpected funding response", VenueID)
		}
		rows = append(rows, body.Data...)
		if len(body.Data) < historyPageSize {
			break
		}
	}

	a.mu.Lock()
	known, remembered := a.contracts[venueSymbol]
	a.mu.Unlock()

	contract := known.contract
	if !remembered {
		// No inventory seen yet for this symbol: Hibachi settles every market in USDT, and a market
		// being asked for history is one that trades, so the fallback states what the venue states
		// about all of them rather than leaving the quote and class unset.
		contract = Contract{
			Symbol:           venueSymbol,
			Category:         "CRYPTO",
			Status:           "LIVE",
			SettlementSymbol: "USDT",
			UnderlyingSymbol: adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{}).Base,
		}
	}
	return ParseFunding(rows, contract, known.tags, fromMs, toMs), nil
}
