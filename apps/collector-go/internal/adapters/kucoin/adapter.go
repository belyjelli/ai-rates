package kucoin

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://api-futures.kucoin.com"

	// MinInterval is the spacing this venue's client should use.
	MinInterval = 150 * time.Millisecond

	historyPage = 100
	maxPages    = 50

	// Retries and backoff for the per-symbol risk-limit sweep, which makes hundreds of calls in a
	// row and so meets a transient failure sooner or later.
	riskLimitRetries = 1
	riskLimitBackoff = 300 * time.Millisecond
)

// Adapter collects KuCoin Futures' linear perpetuals.
//
// It owns no state beyond its client: the TypeScript adapter keeps no package-level cursor or cache
// either, because every endpoint here is either bulk or swept whole. So one Adapter can serve the
// venue's snapshot, history and tier loops, which is the point of the sharing — KuCoin rate-limits
// by IP, not by caller, and the client is what holds the spacing and the circuit breaker.
type Adapter struct {
	client *httpclient.Client
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots runs one cycle. One bulk call: /contracts/active carries funding, the interval,
// prices, open interest, turnover and the declared asset class for every market at once.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var env Envelope[[]Contract]
	if err := a.client.GetJSON(ctx, baseURL+"/api/v1/contracts/active", &env); err != nil {
		return core.SnapshotBatch{}, err
	}
	return ParseSnapshots(env, now.UnixMilli())
}

// perpSymbols is every collectable symbol in the venue's own order.
func perpSymbols(contracts []Contract) []string {
	symbols := make([]string, 0, len(contracts))
	for _, contract := range contracts {
		if contract.Type == perpetual && !contract.IsInverse && contract.Status == "Open" {
			symbols = append(symbols, contract.Symbol)
		}
	}
	return symbols
}

// FetchLeverageTiers sweeps every market's risk ladder, ONE SYMBOL AT A TIME.
//
// This is the only genuine per-symbol sweep in the collector: KuCoin has no bulk form — asking
// /contracts/risk-limit without a symbol answers 404000 — so a full sweep is ~680 requests at 150ms
// spacing, about 100 seconds once a day. That holds KuCoin's shared client long enough to delay a
// snapshot cycle or two, which is the price of having ladders for this venue at all.
//
// complete is false when any symbol was given up on, so the caller does not prune a ladder it simply
// never read. An open circuit stops the sweep outright: the venue is refusing everything, the
// remaining hundreds of calls would fail too, and continuing would burn the cooldown.
func (a *Adapter) FetchLeverageTiers(ctx context.Context) ([]core.LeverageTier, bool, error) {
	var active Envelope[[]Contract]
	if err := a.client.GetJSON(ctx, baseURL+"/api/v1/contracts/active", &active); err != nil {
		return nil, false, err
	}
	contracts, err := active.unwrap("contracts")
	if err != nil {
		return nil, false, err
	}

	symbols := perpSymbols(contracts)
	rows := make([]RiskLimit, 0, len(symbols)*12)
	complete := true

	for _, symbol := range symbols {
		fetched, stop, got := a.riskLimitFor(ctx, symbol)
		if stop {
			return ParseRiskLimits(rows), false, nil
		}
		if !got {
			complete = false
			continue
		}
		rows = append(rows, fetched...)
	}
	return ParseRiskLimits(rows), complete, nil
}

// riskLimitFor reads one symbol's ladder. stop means the circuit opened and the sweep should end;
// got distinguishes a genuinely empty ladder from one that was never read.
func (a *Adapter) riskLimitFor(ctx context.Context, symbol string) (rows []RiskLimit, stop bool, got bool) {
	endpoint := baseURL + "/api/v1/contracts/risk-limit/" + url.PathEscape(symbol)

	for attempt := 0; attempt <= riskLimitRetries; attempt++ {
		var env Envelope[[]RiskLimit]
		err := a.client.GetJSON(ctx, endpoint, &env)
		if err == nil {
			var data []RiskLimit
			if data, err = env.unwrap("risk limit"); err == nil {
				return data, false, true
			}
		}

		var open *httpclient.CircuitOpenError
		if errors.As(err, &open) {
			return nil, true, false
		}
		if attempt < riskLimitRetries {
			select {
			case <-ctx.Done():
				return nil, true, false
			case <-time.After(riskLimitBackoff << attempt):
			}
		}
	}
	return nil, false, false
}

// FetchFundingHistory returns settled payments for one market in [fromMs, toMs], oldest first.
//
// Paged backwards from toMs, because the endpoint answers newest-first within the window. The
// interval is inferred from the settlements themselves; only when fewer than two came back does it
// cost an extra call to read the market's current granularity as a fallback.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	items := make([]FundingHistoryItem, 0, historyPage)
	to := toMs

	for page := 0; page < maxPages && to >= fromMs; page++ {
		var env Envelope[[]FundingHistoryItem]
		endpoint := fmt.Sprintf("%s/api/v1/contract/funding-rates?symbol=%s&from=%d&to=%d",
			baseURL, url.QueryEscape(venueSymbol), fromMs, to)
		if err := a.client.GetJSON(ctx, endpoint, &env); err != nil {
			return nil, err
		}
		data, err := env.unwrap("funding history")
		if err != nil {
			return nil, err
		}
		items = append(items, data...)
		if len(data) < historyPage {
			break
		}

		oldest := int64(0)
		for _, item := range data {
			at := item.Timepoint.PositiveMs()
			if at == nil {
				continue
			}
			if oldest == 0 || *at < oldest {
				oldest = *at
			}
		}
		// A full page with no readable timestamp gives nothing to page from, so the walk ends rather
		// than re-requesting the same window until maxPages.
		if oldest == 0 {
			break
		}
		to = oldest - 1
	}

	fallbackHours := 8.0
	if len(items) < 2 {
		var env Envelope[Contract]
		endpoint := baseURL + "/api/v1/contracts/" + url.PathEscape(venueSymbol)
		if err := a.client.GetJSON(ctx, endpoint, &env); err == nil {
			if contract, err := env.unwrap("contract"); err == nil {
				if ms := granularityMs(contract); ms != nil {
					fallbackHours = *ms / msPerHour
				}
			}
		}
	}

	// One item per settlement timestamp: the venue can repeat a settlement across page boundaries.
	// A repeat keeps its first position and its LAST value, which is what the TypeScript's Map does.
	at := make(map[adapters.Num]int, len(items))
	unique := make([]FundingHistoryItem, 0, len(items))
	for _, item := range items {
		if i, seen := at[item.Timepoint]; seen {
			unique[i] = item
			continue
		}
		at[item.Timepoint] = len(unique)
		unique = append(unique, item)
	}

	return ParseFundingHistory(Envelope[[]FundingHistoryItem]{Code: ok, Data: unique}, fallbackHours)
}
