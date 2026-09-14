package phoenix

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Compile-time proof that the snapshot loop can actually see this adapter: the scheduler finds its
// venues through this interface, so a drifted method signature must be a build failure rather than a
// venue that silently never collects.
var _ collector.Fetcher = (*Adapter)(nil)

const (
	// API is the public REST root.
	API = "https://perp-api.phoenix.trade/v1"

	// MinInterval is the spacing this venue's client should use, ported from minIntervalMs: 1000.
	//
	// No limit is published. Twelve calls a second apart to one route never limited; five
	// back-to-back calls returned `{"error":"rate_limited"}` on two of them.
	MinInterval = 1000 * time.Millisecond

	// OverviewLookbackMs is how far back to look for each market's newest settled point; older means
	// Phoenix stopped publishing. The bounds are MILLISECONDS -- seconds return an empty series.
	OverviewLookbackMs int64 = 2 * 3_600_000

	// VolumeRefreshBudget is how many per-symbol candle calls one cycle may spend.
	VolumeRefreshBudget = 8

	// VolumeMaxAgeMs keeps every market's volume at most ~15 minutes old.
	VolumeMaxAgeMs int64 = 15 * 60_000

	historyPageLimit = 10_000

	// historyWindowMs is under the one-year maximum range, and under 10,000 hourly points.
	historyWindowMs int64 = 300 * 24 * 3_600_000
)

// Options configures the adapter.
//
// VolumeRefreshBudget is a pointer so that an explicit 0 -- no per-symbol candle calls at all -- is
// distinguishable from "unset", exactly as the TypeScript `??` is.
type Options struct {
	VolumeRefreshBudget *int
}

// Adapter collects Phoenix's perpetuals.
//
// The volume and market caches live HERE, not at package scope as the TypeScript closure keeps them.
// In Go the collector runs each venue on its own goroutine against a shared process, so unsynchronised
// shared maps would be a data race the detector flags immediately.
type Adapter struct {
	client *httpclient.Client
	budget int

	mu sync.Mutex
	// volumes is the rotated 24h-volume cache, one entry per live symbol.
	volumes map[string]VolumeEntry
	// known remembers each market from the markets call, because the history endpoints carry
	// neither the class nor the interval and would otherwise cost a lookup call every time.
	known map[string]Market
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return NewAdapterWithOptions(client, Options{})
}

func NewAdapterWithOptions(client *httpclient.Client, opts Options) *Adapter {
	budget := VolumeRefreshBudget
	if opts.VolumeRefreshBudget != nil {
		budget = *opts.VolumeRefreshBudget
	}
	return &Adapter{
		client:  client,
		budget:  budget,
		volumes: map[string]VolumeEntry{},
		known:   map[string]Market{},
	}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// checkBody rejects Phoenix's own refusal, which arrives as a 200 carrying `{"error":"rate_limited"}`.
//
// Parsed as data that body is an empty venue, which is indistinguishable from Phoenix delisting
// everything -- so it fails the call instead.
func checkBody(raw json.RawMessage, what string) (json.RawMessage, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil, fmt.Errorf("%s %s: empty response", VenueID, what)
	}
	if trimmed[0] == '{' {
		var failure struct {
			Error *string `json:"error"`
		}
		// Only a string `error` is a refusal, matching `typeof error === "string"`; a body that
		// happens to carry some other shape under that key is left to the caller to decode.
		if err := json.Unmarshal(trimmed, &failure); err == nil && failure.Error != nil {
			return nil, fmt.Errorf("%s %s: %s", VenueID, what, *failure.Error)
		}
	}
	return trimmed, nil
}

// get fetches one endpoint and screens the body for a refusal before anything decodes it.
func (a *Adapter) get(ctx context.Context, endpoint, what string) (json.RawMessage, error) {
	var raw json.RawMessage
	if err := a.client.GetJSON(ctx, endpoint, &raw); err != nil {
		return nil, err
	}
	return checkBody(raw, what)
}

// asList decodes a JSON array, reporting the venue's shape rather than a decoder's type error.
//
// This is the port of `Array.isArray`: an object decoded into a slice fails with a message that says
// nothing about which response was unexpected.
func asList[T any](raw json.RawMessage, what string) ([]T, error) {
	if len(raw) == 0 || raw[0] != '[' {
		return nil, fmt.Errorf("%s: unexpected %s response", VenueID, what)
	}
	var rows []T
	if err := json.Unmarshal(raw, &rows); err != nil {
		return nil, fmt.Errorf("%s: unexpected %s response", VenueID, what)
	}
	return rows, nil
}

func overviewURL(now int64) string {
	return fmt.Sprintf("%s/funding/overview?startTime=%d&endTime=%d&perMarketLimit=1",
		API, now-OverviewLookbackMs, now)
}

func candlesURL(symbol string) string {
	return fmt.Sprintf("%s/candles/%s?timeframe=1h&limit=%d", API, url.PathEscape(symbol), candleHours)
}

// FetchSnapshots runs one cycle: the markets list and the whole venue's funding overview, then a
// budgeted slice of hourly-candle calls to keep the volume cache fresh.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	nowMs := now.UnixMilli()

	raw, err := a.get(ctx, API+"/view/exchange/markets", "markets")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	markets, err := asList[Market](raw, "markets")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	raw, err = a.get(ctx, overviewURL(nowMs), "funding overview")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	var overview struct {
		Series json.RawMessage `json:"series"`
	}
	if err := json.Unmarshal(raw, &overview); err != nil {
		return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected overview response", VenueID)
	}
	series, err := asList[OverviewSeries](overview.Series, "overview")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	// Live symbols in the venue's own order, deduped, so the rotation sweeps predictably instead of
	// reshuffling per run the way a Go map's iteration would.
	liveSymbols := make([]string, 0, len(markets))
	live := make(map[string]struct{}, len(markets))
	for _, market := range markets {
		if !IsTradable(market) {
			continue
		}
		if _, seen := live[market.Symbol]; seen {
			continue
		}
		live[market.Symbol] = struct{}{}
		liveSymbols = append(liveSymbols, market.Symbol)
	}

	a.mu.Lock()
	for _, market := range markets {
		a.known[market.Symbol] = market
	}
	// A market Phoenix no longer lists is dropped rather than kept alive by the cache.
	for symbol := range a.volumes {
		if _, listed := live[symbol]; !listed {
			delete(a.volumes, symbol)
		}
	}
	batch := adapters.SelectRefreshBatch(liveSymbols, func(symbol string) (int64, bool) {
		entry, known := a.volumes[symbol]
		return entry.FetchedAt, known
	}, nowMs, a.budget, VolumeMaxAgeMs)
	a.mu.Unlock()

	for _, symbol := range batch {
		raw, err := a.get(ctx, candlesURL(symbol), "candles "+symbol)
		if err != nil {
			// An open circuit means the venue is refusing everything; the rest of the batch would
			// only burn the breaker's cooldown.
			var open *httpclient.CircuitOpenError
			if errors.As(err, &open) {
				break
			}
			// Volume is secondary: leave this symbol for a later cycle rather than fail the batch.
			continue
		}
		candles, err := asList[Candle](raw, "candles")
		if err != nil {
			continue
		}
		volume := Volume24h(candles, nowMs)
		a.mu.Lock()
		a.volumes[symbol] = VolumeEntry{VolumeUSD: &volume, FetchedAt: nowMs}
		a.mu.Unlock()
	}

	// Copied under the lock so the parser never reads a map another cycle may be writing.
	a.mu.Lock()
	volumes := make(map[string]VolumeEntry, len(a.volumes))
	for symbol, entry := range a.volumes {
		volumes[symbol] = entry
	}
	a.mu.Unlock()

	return ParseSnapshots(markets, series, volumes, nowMs), nil
}

// FetchFundingHistory reads one market's settled hourly rates across [fromMs, toMs].
//
// The endpoint accepts at most a year per call, so a longer window is walked in slices under that
// bound; the slices meet at their boundaries and the venue serves the shared settlement in both,
// which ParseRates folds back into one event.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	a.mu.Lock()
	market, known := a.known[venueSymbol]
	a.mu.Unlock()

	// The history carries neither class nor interval, so an unseen market costs one lookup -- once,
	// not once per window.
	if !known {
		raw, err := a.get(ctx, API+"/view/exchange/market/"+url.PathEscape(venueSymbol), "market")
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &market); err != nil {
			return nil, fmt.Errorf("%s: unexpected market response", VenueID)
		}
		a.mu.Lock()
		a.known[venueSymbol] = market
		a.mu.Unlock()
	}

	rows := make([]RatePoint, 0, historyPageLimit)
	for start := fromMs; start <= toMs; start += historyWindowMs + 1 {
		end := start + historyWindowMs
		if end > toMs {
			end = toMs
		}
		raw, err := a.get(ctx, fmt.Sprintf("%s/funding/%s/rates?startTime=%d&endTime=%d&limit=%d",
			API, url.PathEscape(venueSymbol), start, end, historyPageLimit), "funding rates")
		if err != nil {
			return nil, err
		}
		var body struct {
			Rates json.RawMessage `json:"rates"`
		}
		if err := json.Unmarshal(raw, &body); err != nil {
			return nil, fmt.Errorf("%s: unexpected rates response", VenueID)
		}
		page, err := asList[RatePoint](body.Rates, "rates")
		if err != nil {
			return nil, err
		}
		rows = append(rows, page...)
	}
	return ParseRates(market, rows, fromMs, toMs), nil
}
