package toobit

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	apiBase = "https://api.toobit.com"

	// MinInterval is the spacing this venue's client should use. 3,000 request weight a minute per
	// IP; a cycle weighs about 45 and a full history page 1.
	MinInterval = 100 * time.Millisecond

	// exchangeInfoMaxAge: exchangeInfo is 2.5 MB, mostly risk-limit ladders and spot coins, so it is
	// read hourly rather than every cycle.
	exchangeInfoMaxAge = time.Hour

	historyPageSize = 1000
	historyMaxPages = 20
)

// knownMarket is what a completed cycle learned about a market, so the history sweep can label its
// settlements without re-reading exchangeInfo.
type knownMarket struct {
	ref core.MarketRef
	// intervalHours is nil where the venue stated no usable period.
	intervalHours *float64
}

// Adapter collects Toobit's USDT- and USDC-margined perpetuals.
//
// The exchangeInfo cache and the known-market map are MUTEX-GUARDED ADAPTER STATE, where the
// TypeScript keeps them as closure variables of a single-threaded runtime. In Go the collector runs
// each venue on its own goroutine and the history sweep runs beside the snapshot loop, so both maps
// are genuinely shared -- unsynchronised they are a data race the detector flags immediately.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// contractsAt is epoch milliseconds. hasContracts is separate because "never fetched" and
	// "fetched at the epoch" must not collapse into one state, which is what the TypeScript's null
	// exchangeInfo says.
	hasContracts bool
	contractsAt  int64
	contracts    []Contract
	known        map[string]knownMarket
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, known: map[string]knownMarket{}}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// errorBody is what Toobit sends where a list belongs: `{"code":-1130,"msg":"..."}` rather than an
// HTTP error, so the transport sees a clean 200 and only the shape of the payload gives it away.
type errorBody struct {
	Code adapters.Num `json:"code"`
	Msg  string       `json:"msg"`
}

func (e errorBody) code() string {
	if !e.Code.OK {
		return "unknown"
	}
	return strconv.FormatFloat(e.Code.Val, 'f', -1, 64)
}

// unwrapList returns a bulk endpoint's rows, or the venue's own refusal.
//
// The array check is the port of `Array.isArray`: an error object decoded into a slice would fail
// with a JSON type error that says nothing about which limit Toobit rejected, so the code and
// message are read out and reported instead.
func unwrapList[T any](raw json.RawMessage, what string) ([]T, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		var rows []T
		if err := json.Unmarshal(trimmed, &rows); err != nil {
			return nil, fmt.Errorf("toobit %s: %w", what, err)
		}
		return rows, nil
	}
	var failure errorBody
	_ = json.Unmarshal(trimmed, &failure)
	return nil, fmt.Errorf("toobit %s: %s %s", what, failure.code(), failure.Msg)
}

// fetchList reads one bulk endpoint. A free function rather than a method because Go methods take no
// type parameters.
func fetchList[T any](ctx context.Context, a *Adapter, path, what string) ([]T, error) {
	var raw json.RawMessage
	if err := a.client.GetJSON(ctx, apiBase+path, &raw); err != nil {
		return nil, err
	}
	return unwrapList[T](raw, what)
}

// refreshExchangeInfo re-reads the contract list when the cached one has aged out.
func (a *Adapter) refreshExchangeInfo(ctx context.Context, nowMs int64) error {
	a.mu.Lock()
	fresh := a.hasContracts && nowMs-a.contractsAt < exchangeInfoMaxAge.Milliseconds()
	a.mu.Unlock()
	if fresh {
		return nil
	}

	var info ExchangeInfo
	if err := a.client.GetJSON(ctx, apiBase+"/api/v1/exchangeInfo", &info); err != nil {
		return err
	}
	// A nil slice is an absent or null `contracts`; an empty JSON array decodes non-nil and is a
	// venue that listed nothing, not a malformed response.
	if info.Contracts == nil {
		return errors.New("toobit exchangeInfo: no contracts")
	}

	a.mu.Lock()
	a.contracts = info.Contracts
	a.contractsAt = nowMs
	a.hasContracts = true
	a.mu.Unlock()
	return nil
}

// FetchSnapshots runs one cycle: the cached contract list, then five bulk responses.
//
// Nothing here is budgeted per symbol -- funding, mark, index, ticker and book each answer for the
// whole venue -- so a cycle is five requests however many perpetuals Toobit lists.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()
	if err := a.refreshExchangeInfo(ctx, nowMs); err != nil {
		return core.SnapshotBatch{}, err
	}

	funding, err := fetchList[FundingRate](ctx, a, "/api/v1/futures/fundingRate", "funding rate")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	tickers, err := fetchList[Ticker](ctx, a, "/quote/v1/contract/ticker/24hr", "ticker")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	marks, err := fetchList[MarkPrice](ctx, a, "/quote/v1/markPrice", "mark price")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	var index Index
	if err := a.client.GetJSON(ctx, apiBase+"/quote/v1/index", &index); err != nil {
		return core.SnapshotBatch{}, err
	}
	if index.Index == nil {
		return core.SnapshotBatch{}, errors.New("toobit index")
	}
	books, err := fetchList[BookTicker](ctx, a, "/quote/v1/contract/ticker/bookTicker", "book ticker")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	a.mu.Lock()
	contracts := a.contracts
	a.mu.Unlock()

	snapshots := ParseSnapshots(SnapshotInput{
		Contracts: contracts,
		Funding:   funding,
		Tickers:   tickers,
		Marks:     marks,
		Index:     index.Index,
		Books:     books,
	}, nowMs)

	known := make(map[string]knownMarket, len(snapshots))
	for _, snapshot := range snapshots {
		known[snapshot.VenueSymbol] = knownMarket{
			ref:           snapshot.MarketRef,
			intervalHours: snapshot.IntervalHours,
		}
	}
	a.mu.Lock()
	a.known = known
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// idValue is JavaScript's Number() over a row id, which is how the TypeScript compares them. An
// unparseable id is NaN and loses every comparison, in both languages alike; an empty one is zero,
// as Number("") is.
func idValue(id string) float64 {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return 0
	}
	value, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return math.NaN()
	}
	return value
}

// FetchFundingHistory reads one market's settlements, newest first.
//
// `endTime` is IGNORED by the venue, so the window cannot be asked for: pages walk back with
// `fromId`, which returns rows with a smaller id, until one reaches past fromMs. The rows are cut to
// the window on parse.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingHistoryRow, 0, historyPageSize)
	var fromID *string

	for page := 0; page < historyMaxPages; page++ {
		cursor := ""
		if fromID != nil {
			cursor = "&fromId=" + *fromID
		}
		batch, err := fetchList[FundingHistoryRow](ctx, a, fmt.Sprintf(
			"/api/v1/futures/historyFundingRate?symbol=%s&limit=%d%s",
			url.QueryEscape(venueSymbol), historyPageSize, cursor), "funding history")
		if err != nil {
			return nil, err
		}
		rows = append(rows, batch...)
		if len(batch) < historyPageSize {
			break
		}

		oldest := batch[0]
		for _, row := range batch[1:] {
			if idValue(row.ID) < idValue(oldest.ID) {
				oldest = row
			}
		}
		// Only a stated settle time can end the walk. An absent one is not an old one, and reading it
		// as zero would stop the sweep on its first page.
		if oldest.SettleTime.OK && oldest.SettleTime.Val < float64(fromMs) {
			break
		}
		id := oldest.ID
		fromID = &id
	}

	a.mu.Lock()
	market, seen := a.known[venueSymbol]
	a.mu.Unlock()

	ref := adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{})
	var fallbackHours *float64
	if seen {
		ref = market.ref
		fallbackHours = market.intervalHours
	}
	return ParseFundingHistory(ref, rows, fromMs, toMs, fallbackHours), nil
}
