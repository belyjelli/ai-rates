package htx

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// APIBase is HTX's linear-swap host, exported as htx.ts exports HTX_API so a test can pin the
	// URLs a cycle asks for.
	APIBase = "https://api.hbdm.com"

	// ContractInfoMaxAge: contract info is 160 KB and only says which swaps list, their size and
	// their interval, so it is cached rather than fetched every cycle.
	ContractInfoMaxAge = 60 * time.Minute

	// MinInterval is the spacing this venue's client should use. HTX allows 240 public non-market
	// requests per 3s and 800 market requests per second per IP; a cycle makes four, so 100ms is far
	// inside both.
	MinInterval = 100 * time.Millisecond

	// historyPageSize: `page_size` above 100 is refused; 100 is accepted (measured 2026-09-14).
	historyPageSize = 100
	historyMaxPages = 50
)

// Adapter collects HTX's USDT-margined perpetual swaps.
//
// The cached contract list lives HERE, guarded, not in a closure at package scope as the TypeScript
// keeps it. In Go the collector runs each venue on its own goroutine, and a venue's snapshot loop and
// its history loop share one adapter — VenueLoop guarantees its own cycles never overlap, but makes
// no such promise against the history sweep running beside it. Unsynchronised, the cache would be a
// data race the detector flags immediately.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// contracts is the listing swap set by contract code, nil until the first load. It is REPLACED
	// wholesale on every load and never mutated in place, so handing the reference to a caller under
	// the lock is safe: a concurrent reload cannot alter the map that caller is reading.
	contracts map[string]ContractInfo
	// contractsAt is when that copy was read, in epoch milliseconds. Zero means a history call loaded
	// it, which keeps it due for a refresh on the next cycle.
	contractsAt int64
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, APIBase+path, out)
}

// freshContracts is the cached list while it is inside ContractInfoMaxAge, else nil.
func (a *Adapter) freshContracts(nowMs int64) map[string]ContractInfo {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.contracts == nil || nowMs-a.contractsAt >= ContractInfoMaxAge.Milliseconds() {
		return nil
	}
	return a.contracts
}

// cachedContracts is the cached list whatever its age, or nil if none was ever read.
func (a *Adapter) cachedContracts() map[string]ContractInfo {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.contracts
}

func (a *Adapter) loadContracts(ctx context.Context, fetchedAt int64) (map[string]ContractInfo, error) {
	var envelope Envelope[[]ContractInfo]
	if err := a.get(ctx, "/linear-swap-api/v1/swap_contract_info?business_type=swap", &envelope); err != nil {
		return nil, err
	}
	info, err := unwrapList(envelope, "contract info")
	if err != nil {
		return nil, err
	}

	bySymbol := TradableSwaps(info)
	a.mu.Lock()
	a.contracts = bySymbol
	a.contractsAt = fetchedAt
	a.mu.Unlock()
	return bySymbol, nil
}

// FetchSnapshots runs one cycle: the hourly contract list, then the four bulk responses that carry
// funding, open interest, the index and the book.
//
// The four run in sequence where the TypeScript runs them in Promise.all. Nothing is lost: the HTTP
// client spaces this venue's requests at MinInterval regardless, so concurrent calls would only queue
// against each other — and in sequence the request order is the venue's own, which is what the pinned
// URL order in both test suites checks.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	bySymbol := a.freshContracts(nowMs)
	if bySymbol == nil {
		var err error
		if bySymbol, err = a.loadContracts(ctx, nowMs); err != nil {
			return core.SnapshotBatch{}, err
		}
	}

	var fundingEnvelope Envelope[[]FundingRate]
	if err := a.get(ctx, "/linear-swap-api/v1/swap_batch_funding_rate", &fundingEnvelope); err != nil {
		return core.SnapshotBatch{}, err
	}
	funding, err := unwrapList(fundingEnvelope, "batch funding rate")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var openInterestEnvelope Envelope[[]OpenInterest]
	if err := a.get(ctx, "/linear-swap-api/v1/swap_open_interest?business_type=swap", &openInterestEnvelope); err != nil {
		return core.SnapshotBatch{}, err
	}
	openInterest, err := unwrapList(openInterestEnvelope, "open interest")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var indexEnvelope Envelope[[]Index]
	if err := a.get(ctx, "/linear-swap-api/v1/swap_index", &indexEnvelope); err != nil {
		return core.SnapshotBatch{}, err
	}
	indices, err := unwrapList(indexEnvelope, "index")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	var merged MergedEnvelope
	if err := a.get(ctx, "/linear-swap-ex/market/detail/batch_merged?business_type=swap", &merged); err != nil {
		return core.SnapshotBatch{}, err
	}
	if merged.Status != "ok" || merged.Ticks == nil {
		return core.SnapshotBatch{}, merged.errorFor()
	}

	snapshots := ParseSnapshots(SnapshotInput{
		Contracts:    bySymbol,
		Funding:      funding,
		OpenInterest: openInterest,
		Indices:      indices,
		Ticks:        merged.Ticks,
	}, nowMs)
	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// FetchFundingHistory reads one swap's settlements. They come newest first, paged by index with no
// time filter, so it pages back until the window is covered.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	// History run before any snapshot cycle still needs the interval and class. fetchedAt 0 keeps
	// that copy due for a refresh on the next cycle.
	bySymbol := a.cachedContracts()
	if bySymbol == nil {
		var err error
		if bySymbol, err = a.loadContracts(ctx, 0); err != nil {
			return nil, err
		}
	}
	var contract *ContractInfo
	if found, known := bySymbol[venueSymbol]; known {
		contract = &found
	}

	rows := make([]FundingHistoryItem, 0, historyPageSize)
	for page := 1; page <= historyMaxPages; page++ {
		var envelope Envelope[*FundingHistoryPage]
		if err := a.get(ctx, fmt.Sprintf(
			"/linear-swap-api/v1/swap_historical_funding_rate?contract_code=%s&page_index=%d&page_size=%d",
			url.QueryEscape(venueSymbol), page, historyPageSize), &envelope); err != nil {
			return nil, err
		}
		result, err := unwrapPage(envelope, "historical funding rate")
		if err != nil {
			return nil, err
		}

		list := result.Data
		rows = append(rows, list...)
		// Infinity for an empty page, matching Math.min() of no arguments: the page-size check below
		// is what stops the walk there, not a stamp older than the window.
		oldest := math.Inf(1)
		for _, row := range list {
			at := math.Inf(1)
			if row.FundingTime.OK {
				at = row.FundingTime.Val
			}
			if at < oldest {
				oldest = at
			}
		}
		if len(list) < historyPageSize || page >= result.TotalPage || oldest < float64(fromMs) {
			break
		}
	}

	var fallbackHours *float64
	if contract != nil {
		fallbackHours = contract.SettlementPeriod.Ptr()
	}
	return ParseFundingHistory(venueSymbol, rows, fromMs, toMs, fallbackHours, contract), nil
}
