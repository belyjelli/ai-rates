package nado

import (
	"context"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// ArchiveURL carries contracts and funding history; GatewayURL carries the trading statuses.
	ArchiveURL = "https://archive.prod.nado.xyz"
	GatewayURL = "https://gateway.prod.nado.xyz/v1"

	// MinInterval is the spacing this venue's client should use, ported from the TypeScript
	// adapter's minIntervalMs: 100. The per-IP budget is 2,400 weight a minute or 400 every 10s,
	// against a cycle weighing 2 for symbols and one contracts call, so 100ms cannot approach it.
	MinInterval = 100 * time.Millisecond

	// symbolsTTLMs: `trading_status` changes with listings, not with the tape, so it is read once an
	// hour rather than every cycle.
	symbolsTTLMs = 3_600_000

	historyPageSize = 1000
	historyMaxPages = 50
)

// Adapter collects Nado's perpetuals.
//
// The symbols cache and the ticker->contract map are MUTEX-GUARDED ADAPTER STATE, where the
// TypeScript keeps them as closure variables of a single-threaded runtime. In Go the collector runs
// each venue on its own goroutine and the history sweep runs beside the snapshot loop, so both are
// genuinely shared -- unsynchronised they are a data race the detector flags immediately.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// hasSymbols is separate from symbolsAt because "never fetched" and "fetched at the epoch" must
	// not collapse into one state, which is what the TypeScript's null symbols says.
	hasSymbols bool
	symbolsAt  int64
	symbols    map[string]Symbol
	// contractsByTicker serves history, which is addressed by product_id while the collector asks by
	// ticker.
	contractsByTicker map[string]Contract
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, contractsByTicker: map[string]Contract{}}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// fetchContracts reads every perp with funding, mark, index, OI and volume inline, and refreshes the
// ticker index history is looked up through.
func (a *Adapter) fetchContracts(ctx context.Context) (Contracts, error) {
	var contracts Contracts
	if err := a.client.GetJSON(ctx, ArchiveURL+"/v2/contracts?edge=false", &contracts); err != nil {
		return nil, err
	}

	a.mu.Lock()
	for _, contract := range contracts {
		a.contractsByTicker[contract.TickerID] = contract
	}
	a.mu.Unlock()
	return contracts, nil
}

// fetchSymbols reads the gateway's trading statuses, at most once an hour.
func (a *Adapter) fetchSymbols(ctx context.Context, now int64) (map[string]Symbol, error) {
	a.mu.Lock()
	cached, fresh := a.symbols, a.hasSymbols && now-a.symbolsAt < symbolsTTLMs
	a.mu.Unlock()
	if fresh {
		return cached, nil
	}

	var body SymbolsResponse
	if err := a.client.GetJSON(ctx, GatewayURL+"/query?type=symbols", &body); err != nil {
		return nil, err
	}
	// A response that lost its payload fails the cycle: read as an empty map it would say every
	// market on the venue has stopped trading.
	if body.Status != "success" || body.Data.Symbols == nil {
		return nil, ErrUnexpectedSymbols
	}

	symbols := *body.Data.Symbols
	a.mu.Lock()
	a.symbols, a.symbolsAt, a.hasSymbols = symbols, now, true
	a.mu.Unlock()
	return symbols, nil
}

// FetchSnapshots runs one cycle: the hourly symbols read, then the contracts call that carries
// funding and every stat inline.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	symbols, err := a.fetchSymbols(ctx, nowMs)
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	contracts, err := a.fetchContracts(ctx)
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(contracts, symbols, nowMs),
		Settled:   []core.FundingEvent{},
	}, nil
}

// FetchFundingHistory returns realized hourly settlements for one market in [fromMs, toMs], oldest
// first.
//
// Paged FORWARD, because the archive answers oldest-first inside the window and the docs prescribe
// continuing from one second past the newest row returned. The endpoint is addressed by product_id,
// so a cold adapter reads /contracts first to learn the ticker's id.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	contract, known := a.contract(venueSymbol)
	if !known {
		if _, err := a.fetchContracts(ctx); err != nil {
			return nil, err
		}
		contract, known = a.contract(venueSymbol)
	}
	if !known {
		return nil, nil
	}

	rows := make([]FundingHistoryRow, 0, historyPageSize)
	startSeconds := fromMs / 1000
	endSeconds := toMs / 1000

	for page := 0; page < historyMaxPages && startSeconds <= endSeconds; page++ {
		var body FundingHistoryResponse
		request := historyRequest{FundingRateHistory: historyQuery{
			ProductID: contract.ProductID,
			StartTime: startSeconds,
			EndTime:   endSeconds,
			Limit:     historyPageSize,
		}}
		if err := a.client.PostJSON(ctx, ArchiveURL+"/v1", request, &body); err != nil {
			return nil, err
		}
		if body.FundingRates == nil {
			return nil, ErrUnexpectedHistory
		}
		batch := *body.FundingRates
		rows = append(rows, batch...)
		if len(batch) < historyPageSize {
			break
		}
		// Ascending: continue from one second past the newest row, as the docs prescribe. An
		// unreadable timestamp stops the walk rather than stepping to an invented start -- which is
		// what the TypeScript gets from Math.max returning NaN and then failing Number.isFinite.
		newest, readable := newestSettlement(batch)
		if !readable {
			break
		}
		startSeconds = newest + 1
	}
	return ParseFundingHistory(rows, contract, fromMs, toMs), nil
}

func (a *Adapter) contract(venueSymbol string) (Contract, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	contract, known := a.contractsByTicker[venueSymbol]
	return contract, known
}

// historyRequest is the archive's POST body. A struct rather than a map so the field names are
// pinned in one place and cannot be misspelt per call site.
type historyRequest struct {
	FundingRateHistory historyQuery `json:"funding_rate_history"`
}

type historyQuery struct {
	ProductID int `json:"product_id"`
	// StartTime and EndTime are unix SECONDS.
	StartTime int64 `json:"start_time"`
	EndTime   int64 `json:"end_time"`
	Limit     int   `json:"limit"`
}

// newestSettlement is the latest readable timestamp (unix seconds) in a page, and whether the page
// gave one at all. A page holding a timestamp the parser cannot read is not readable, mirroring
// Math.max over a NaN-bearing list.
func newestSettlement(batch []FundingHistoryRow) (int64, bool) {
	newest := int64(0)
	found := false
	for _, row := range batch {
		if !row.Timestamp.OK {
			return 0, false
		}
		seconds := int64(row.Timestamp.Val)
		if !found || seconds > newest {
			newest = seconds
			found = true
		}
	}
	return newest, found
}
