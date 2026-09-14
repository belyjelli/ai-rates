package ondo

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://api.ondoperps.xyz/v1"

	// MinInterval is this venue's minimum spacing between requests, ported from the TypeScript
	// adapter's minIntervalMs: 250.
	MinInterval = 250 * time.Millisecond

	historyPageSize = 1000
	historyMaxPages = 50
)

// Adapter collects Ondo Perps, measured from this machine on 2026-09-14 and read against
// https://docs.ondoperps.xyz (funding-rates.md, settlement.md, api-reference/rest-spec.json).
//
//   - **Two calls a cycle.** `/perps/contracts` (81 rows, ~52 KB) carries funding, OI, volume, index
//     price and category tags; `/perps/mark_prices` (81 rows) carries the mark, which contracts lacks.
//     `/markets` (~180 KB) adds nothing the snapshot needs, so it is not called. A failed mark read
//     leaves marks null for the cycle rather than dropping funding that already arrived.
//   - **Hourly, and the rates are 1-hour rates.** Docs: "Funding is paid every hour, 24 times per day.
//     Intervals align to UTC hour boundaries", with the interest term "0.0000125 per hour". Live rows
//     agree: every `nextFundingRateTimestamp` was the next UTC hour, history rows are exactly 1h apart
//     (1,000 of 1,000 back to 2026-08-03), and quiet markets (ENA, PUMP) sit at 0.0000125 — the
//     documented hourly interest, which is also Hyperliquid's hourly floor. At 22:13 UTC Hyperliquid's
//     hourly BTC was +0.0000107 and ETH +0.0000125; Ondo's BTC next rate was -0.0000359 — same scale,
//     not 8x or 24x (an 8h reading would put a 0.0000125 floor at 1/8 of Hyperliquid's).
//   - **`fundingIntervalDivisions`** (8 on all 81 markets in `/markets`) is undocumented. With a
//     0.0003 `dailyInterestRate` and the docs' premium "/ 8", it reads as the 8h convention paid in
//     eight hourly slices; nothing here depends on it.
//   - **Which rate is which.** `fundingRate` is "at the last completed funding interval": at 22:13 it
//     was -0.0000338 for BTC, identical to the 22:00 row of `/perps/funding_rate_history`. So it is
//     emitted as a settlement one hour before `nextFundingRateTimestamp`, never as a prediction.
//     `nextFundingRate` is "estimated ... at the end of the current funding interval", and is the
//     snapshot's predicted rate.
//   - **Tradable.** `productType` perpetual and `disabled` false: 61 of 81 (20 disabled: 4 crypto, 14
//     stocks and ETFs, EURUSD). `isClosed` (45 of the 61 on a Sunday) only means the underlying session
//     is shut; history shows AAPL funding every hour through the closure, so those markets are kept.
//   - **Class** from `tags`; see AssetClassFor. **Quote** USDC; see SettlementQuote.
//   - **History**: `/perps/funding_rate_history?market=&startTime=&endTime=&limit=&cursor=`, public,
//     newest first, cursor-paginated.
//   - **Rate limit**: the spec defines a 429 `too_many_requests` response but publishes no quota.
//
// It owns no state beyond its client: the TypeScript adapter keeps no module-level mutable state
// either, so there is nothing here that would have to become mutex-guarded adapter state to survive
// the collector running each venue on its own goroutine.
type Adapter struct {
	client *httpclient.Client
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// expectResult mirrors the TypeScript `expectResult`: an envelope that did not succeed, or that
// lost its payload, fails the call rather than reading as an empty venue.
func expectResult[T any](body response[T], what string) (T, error) {
	if !body.Success || body.Result == nil {
		var zero T
		return zero, fmt.Errorf("%s: unexpected %s response", VenueID, what)
	}
	return *body.Result, nil
}

// FetchSnapshots runs one cycle: the contracts list, which carries funding and every stat but the
// mark, and the mark prices.
//
// A failed mark read degrades to no marks instead of failing the cycle — the funding has already
// arrived, and dropping it to report a missing mark would lose the reading this venue exists to
// give. The TypeScript side issues the two in a Promise.all; here they are sequential, which changes
// nothing observable because the client serialises a venue's requests on MinInterval regardless.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var contractsBody response[[]Contract]
	if err := a.client.GetJSON(ctx, baseURL+"/perps/contracts", &contractsBody); err != nil {
		return core.SnapshotBatch{}, err
	}
	// A `result` that is not an array fails the decode above, which is what the TypeScript
	// Array.isArray guard does by hand.
	contracts, err := expectResult(contractsBody, "perps/contracts")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	markPrices := map[string]MarkPrice{}
	var marksBody response[map[string]MarkPrice]
	if err := a.client.GetJSON(ctx, baseURL+"/perps/mark_prices", &marksBody); err == nil {
		if marks, err := expectResult(marksBody, "perps/mark_prices"); err == nil {
			markPrices = marks
		}
	}
	return ParseSnapshots(contracts, markPrices, now.UnixMilli()), nil
}

// FetchFundingHistory returns settled hourly payments for one market in [fromMs, toMs], oldest
// first.
//
// The endpoint answers newest first and paginates by cursor, so the walk stops as soon as a page is
// short, the cursor runs out, or the window is covered.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingRateValue, 0, historyPageSize)
	cursor := ""

	for page := 0; page < historyMaxPages; page++ {
		endpoint := fmt.Sprintf("%s/perps/funding_rate_history?market=%s&startTime=%d&endTime=%d&limit=%d",
			baseURL, url.QueryEscape(venueSymbol), fromMs, toMs, historyPageSize)
		if cursor != "" {
			endpoint += "&cursor=" + url.QueryEscape(cursor)
		}

		var body response[[]FundingRateValue]
		if err := a.client.GetJSON(ctx, endpoint, &body); err != nil {
			return nil, err
		}
		batch, err := expectResult(body, "perps/funding_rate_history")
		if err != nil {
			return nil, err
		}
		rows = append(rows, batch...)

		oldest, readable := oldestStamp(batch)
		cursor = ""
		if body.PageInfo != nil {
			cursor = body.PageInfo.NextCursor
		}
		if len(batch) < historyPageSize || cursor == "" || (readable && oldest <= fromMs) {
			break
		}
	}

	// History rows carry no tags, so the class comes from the contract list.
	var contractsBody response[[]Contract]
	if err := a.client.GetJSON(ctx, baseURL+"/perps/contracts", &contractsBody); err != nil {
		return nil, err
	}
	contracts, err := expectResult(contractsBody, "perps/contracts")
	if err != nil {
		return nil, err
	}
	// No matching contract leaves tags nil, which declares nothing and so reads as crypto — the same
	// state the TypeScript fallback `{market, tags: null}` produces.
	var tags []string
	for _, contract := range contracts {
		if contract.Market == venueSymbol {
			tags = contract.Tags
			break
		}
	}
	return ParseFundingHistory(rows, venueSymbol, tags, fromMs, toMs), nil
}

// oldestStamp is the earliest readable stamp in a page, and whether the page held one at all.
//
// An unreadable row is skipped rather than failing the page, which is what the TypeScript
// `Math.min(...batch.map(r => parseOndoTime(r.time) ?? Infinity))` does: an unreadable stamp
// contributes Infinity and so never becomes the minimum. A page with no readable stamp at all gives
// Math.min() === Infinity, which never satisfies `oldest <= fromMs`, so the walk keeps its cursor
// rather than stopping on an invented instant.
func oldestStamp(batch []FundingRateValue) (int64, bool) {
	oldest := int64(0)
	found := false
	for _, row := range batch {
		stamped, readable := ParseTime(row.Time)
		if !readable {
			continue
		}
		if !found || stamped < oldest {
			oldest = stamped
			found = true
		}
	}
	return oldest, found
}
