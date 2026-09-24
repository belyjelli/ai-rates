package extended

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// API is the Starknet deployment's REST base. Exported so a caller can point a probe at the same
	// base the adapter uses.
	API = "https://api.starknet.extended.exchange/api/v1"
	// MinInterval is this venue's request spacing, ported from the TypeScript adapter's
	// minIntervalMs of 100. Exported because the spacing lives on the client the caller builds, not
	// on the adapter. The published limit is 1,000 requests/minute per IP.
	MinInterval = 100 * time.Millisecond

	// marketsTimeout is how long the one snapshot request may take; see FetchSnapshots. Under the
	// collector's 45 s cycle, so a read that never finishes still fails the cycle it belongs to.
	marketsTimeout = 40 * time.Second
)

// Adapter fetches Extended's perpetual market data.
//
// The category cache is guarded because a venue's loops share one adapter: the snapshot loop writes
// it and the history loop reads it, and nothing promises those never overlap.
type Adapter struct {
	client *httpclient.Client

	// mu guards categories: class depends on the category, which only the markets call carries.
	mu         sync.Mutex
	categories map[string]Declared
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, categories: make(map[string]Declared)}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every live perp, in one request.
//
// The one call carries every market with its stats inline, and the declared category and
// sub-category are remembered on the way past, because funding history needs the class that only
// this call states. No extra headers: the shared client sends the User-Agent Extended requires.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var body Response[[]Market]
	// ONE REQUEST, GIVEN THE CYCLE'S TIME. /info/markets is ~1 MB, uncompressed whatever is asked, and
	// 54% of it is tradingConfig -- static risk tiers -- but no bulk endpoint leaves that out and the
	// per-market stats call would be 326 requests a cycle. From hklab on 2026-09-24 it took 0.66-1.6 s
	// usually and 28-30 s at times; under the client's 15 s each slow read failed three attempts in a
	// row and the 45 s cycle with them, 266 of 1,434 runs in a day. 40 s lets a slow read finish.
	if err := a.client.GetJSON(httpclient.WithRequestTimeout(ctx, marketsTimeout), API+"/info/markets", &body); err != nil {
		return core.SnapshotBatch{}, err
	}
	if body.Data == nil {
		return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected info/markets response", VenueID)
	}

	a.mu.Lock()
	for _, m := range body.Data {
		a.categories[m.Name] = Declared{Category: m.Category, SubCategory: m.SubCategory}
	}
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: ParseSnapshots(body, now.UnixMilli())}, nil
}

// FetchFundingHistory returns settled hourly payments for one market in [fromMs, toMs], oldest first.
//
// Paged backwards from toMs, because the endpoint answers newest-first and at most
// historyPageSize rows a call.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingRow, 0, historyPageSize)
	endTime := toMs

	for page := 0; page < historyMaxPages && endTime >= fromMs; page++ {
		endpoint := fmt.Sprintf("%s/info/%s/funding?startTime=%d&endTime=%d",
			API, url.PathEscape(venueSymbol), fromMs, endTime)
		var body Response[[]FundingRow]
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		if body.Data == nil {
			return nil, fmt.Errorf("%s: unexpected funding response", VenueID)
		}
		batch := body.Data
		rows = append(rows, batch...)

		// Math.min over the page's timestamps: a row without a numeric one makes the minimum
		// non-finite, which ends the walk rather than stepping back from a guess.
		oldest := int64(0)
		finite := len(batch) > 0
		for i, row := range batch {
			if !row.SettledAt.OK {
				finite = false
				break
			}
			if ms := int64(row.SettledAt.Val); i == 0 || ms < oldest {
				oldest = ms
			}
		}
		if len(batch) < historyPageSize || !finite {
			break
		}
		// Newest first: step back past the oldest row. An hour is far wider than any row's jitter.
		if stepped := endTime - hourMs; oldest-1 < stepped {
			endTime = oldest - 1
		} else {
			endTime = stepped
		}
	}

	a.mu.Lock()
	declared := a.categories[venueSymbol]
	a.mu.Unlock()

	return ParseFunding(rows, venueSymbol, declared, fromMs, toMs), nil
}
