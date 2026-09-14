package edgexv2

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// APIBase is the V2 public API. V1's `pro.edgex.exchange/api/v1` still answers metadata and nothing
// else; see the package doc.
const APIBase = "https://edgex-prod-v2.edgex.exchange/api/v2/public"

const (
	// MinInterval is the spacing this venue's client should use, ported from minIntervalMs: 300.
	//
	// No rate limit is published ("Rate Limits Apply"); 80 sequential `getTicker` calls at ~4.4/s all
	// returned 200 on 2026-09-13, so 300ms leaves headroom.
	MinInterval = 300 * time.Millisecond

	// metaTTL: the contract list and the app's tabs change on listings, not on cycles.
	metaTTL = 60 * time.Minute

	// fundingBatch: `contractId` takes an array with no documented maximum, and all 173 ids
	// comma-joined answered in one 115 KB call. Chunked anyway so a larger listing cannot build one
	// unbounded URL.
	fundingBatch = 200

	// TickerBudget is per-contract `getTicker` calls per cycle. 173 contracts at 15 a cycle is a full
	// sweep every ~12 cycles.
	TickerBudget = 15

	// tickerRefresh is when a cached ticker becomes eligible for a re-read; TickerMaxAge is when it
	// stops being shown, three sweeps later.
	tickerRefresh = 15 * time.Minute

	historyPageSize = 100
	historyMaxPages = 50
)

// ErrUnexpectedMetadata is a metadata body that unwrapped but carried no contract list.
//
// Ported as an ERROR rather than as an empty book: edgeX throws on unexpected metadata instead of
// guessing, and a cycle that read no contracts must not be mistaken for a venue that lists none.
var ErrUnexpectedMetadata = errors.New(VenueID + ": unexpected metadata")

// Adapter collects edgeX V2.
//
// The market index and the ticker rotation live HERE, not at package scope as the TypeScript keeps
// them in its factory closure. In Go the collector runs each venue on its own goroutine against a
// shared process, and FetchFundingHistory reads the same index FetchSnapshots writes, so both are
// mutex-guarded — unsynchronised they are a data race the detector flags immediately, and a silently
// torn cache if it did not.
type Adapter struct {
	client *httpclient.Client

	mu        sync.Mutex
	markets   *Markets
	marketsAt int64
	tickers   map[string]TickerEntry
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, tickers: make(map[string]TickerEntry)}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// fetch reads one endpoint and unwraps its envelope.
func fetch[T any](ctx context.Context, a *Adapter, endpoint, what string) (T, error) {
	var body Response[T]
	if err := a.client.GetJSON(ctx, APIBase+endpoint, &body); err != nil {
		var zero T
		return zero, err
	}
	return body.unwrap(what)
}

// loadMarkets returns the cached market index, reading `getMetaData` and `contract-labels` when it
// is older than metaTTL.
func (a *Adapter) loadMarkets(ctx context.Context, now int64) (Markets, error) {
	a.mu.Lock()
	cached := a.markets
	fresh := cached != nil && now-a.marketsAt < metaTTL.Milliseconds()
	a.mu.Unlock()
	if fresh {
		return *cached, nil
	}

	meta, err := fetch[MetaData](ctx, a, "/meta/getMetaData", "getMetaData")
	if err != nil {
		return Markets{}, err
	}
	labels, err := fetch[[]ContractLabel](ctx, a, "/contract-labels", "contract-labels")
	if err != nil {
		return Markets{}, err
	}
	// The venue's own strictness: a body shaped unlike metadata is refused, not guessed at.
	if meta.ContractList == nil || labels == nil {
		return Markets{}, ErrUnexpectedMetadata
	}

	markets := IndexMarkets(meta, labels)
	a.mu.Lock()
	a.markets = &markets
	a.marketsAt = now
	a.mu.Unlock()
	return markets, nil
}

// FetchSnapshots runs one cycle: the market index once an hour, one funding call carrying every live
// contract id, then a slice of the per-contract ticker sweep.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	markets, err := a.loadMarkets(ctx, nowMs)
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	ids := markets.LiveIDs()

	rates := make([]FundingRate, 0, len(ids))
	for i := 0; i < len(ids); i += fundingBatch {
		end := min(i+fundingBatch, len(ids))
		batch := strings.Join(ids[i:end], ",")
		page, err := fetch[[]FundingRate](ctx, a,
			"/funding/getLatestFundingRate?contractId="+batch, "getLatestFundingRate")
		if err != nil {
			return core.SnapshotBatch{}, err
		}
		rates = append(rates, page...)
	}

	a.mu.Lock()
	fetchedAt := func(id string) (int64, bool) {
		entry, cached := a.tickers[id]
		return entry.FetchedAt, cached
	}
	refresh := adapters.SelectRefreshBatch(ids, fetchedAt, nowMs, TickerBudget, tickerRefresh.Milliseconds())
	a.mu.Unlock()

	// Open interest and volume are auxiliary: a failed ticker keeps its last value, it never costs
	// the cycle its funding rates. Every failure is swallowed, including an open circuit — the call
	// that would have followed is refused without a request anyway, and the contract is simply retried
	// on a later cycle, oldest first.
	for _, id := range refresh {
		rows, err := fetch[[]Ticker](ctx, a, "/quote/getTicker?contractId="+url.QueryEscape(id), "getTicker")
		if err != nil {
			continue
		}
		var ticker *Ticker
		for i := range rows {
			if rows[i].ContractID == id {
				ticker = &rows[i]
				break
			}
		}
		// An answer with no row is cached as nil, so it waits its turn instead of jumping the queue.
		a.mu.Lock()
		a.tickers[id] = TickerEntry{Ticker: ticker, FetchedAt: nowMs}
		a.mu.Unlock()
	}

	a.mu.Lock()
	tickers := maps.Clone(a.tickers)
	a.mu.Unlock()

	return ParseSnapshots(markets, rates, tickers, nowMs), nil
}

// FetchFundingHistory pages `getFundingRatePage` with the venue's own cursor, filtered to
// settlements.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	markets, err := a.loadMarkets(ctx, time.Now().UnixMilli())
	if err != nil {
		return nil, err
	}
	contract, listed := markets.ContractByName(venueSymbol)
	if !listed {
		return []core.FundingEvent{}, nil
	}

	rows := make([]FundingRate, 0, historyPageSize)
	offset := ""
	for page := 0; page < historyMaxPages; page++ {
		cursor := ""
		if offset != "" {
			cursor = "&offsetData=" + url.QueryEscape(offset)
		}
		endpoint := fmt.Sprintf(
			"/funding/getFundingRatePage?contractId=%s&size=%d&filterSettlementFundingRate=true"+
				"&filterBeginTimeInclusive=%d&filterEndTimeExclusive=%d%s",
			url.QueryEscape(contract.ContractID), historyPageSize, fromMs, toMs+1, cursor)

		data, err := fetch[FundingPage](ctx, a, endpoint, "getFundingRatePage")
		if err != nil {
			return nil, err
		}
		rows = append(rows, data.DataList...)
		offset = data.NextPageOffsetData
		if offset == "" || len(data.DataList) == 0 {
			break
		}
	}
	return ParseFundingHistory(rows, contract, markets, fromMs, toMs), nil
}
