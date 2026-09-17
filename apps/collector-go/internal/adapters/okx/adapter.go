package okx

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://www.okx.com"

	// MinInterval is the spacing this venue's client should use.
	MinInterval = 120 * time.Millisecond

	historyPage = 100
	maxPages    = 50

	// positionTiersPerCall: OKX rejects more than this per call — "Parameter instFamily count
	// exceeds the limit 5".
	positionTiersPerCall = 5

	// liquidationFamiliesPerRun: 479 families at 40 a run, every five minutes, revisits each about
	// hourly — well inside the ~21.8-hour page each family answers with.
	liquidationFamiliesPerRun = 40
	liquidationPage           = 100

	// Retries and backoff for the two endpoints that signal rate limits INSIDE an HTTP 200; see
	// retryCode50011 below.
	inBandRetries = 2
	inBandBackoff = 400 * time.Millisecond
)

// Adapter collects OKX's SWAP markets.
//
// The liquidation rotation cursor lives HERE, not at package scope as the TypeScript keeps it. In
// Go the collector runs each venue on its own goroutine against a shared process, so a package-level
// counter would be unsynchronised shared state — a data race the detector flags immediately, and a
// silently interleaved rotation if it did not.
type Adapter struct {
	client *httpclient.Client

	mu sync.Mutex
	// liquidationCursor is where the next rotation resumes. A restart simply starts the cycle again.
	liquidationCursor int

	// takerPace holds rubik to its own 5-per-2-seconds limit; see takerflow.go.
	takerPace *adapters.Pacer
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, takerPace: adapters.NewPacer(TakerFlowPace)}
}

func (a *Adapter) VenueID() string   { return VenueID }
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, baseURL+path, out)
}

// getOptional is get for a per-market statistic the venue may not publish for every market: a
// permanent 4xx is returned but does not open the circuit the funding loop shares. See
// httpclient.GetJSONOptional.
func (a *Adapter) getOptional(ctx context.Context, path string, out any) error {
	return a.client.GetJSONOptional(ctx, baseURL+path, out)
}

// FetchSnapshots runs one cycle.
//
// FIVE endpoints, and the count is deliberate: /instruments is here only because `ctVal` is the one
// field that turns a book size in contracts into money, and nothing else in this request set carries
// it. This runs against every SWAP every minute, so a sixth per-cycle request has to be argued for.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var (
		funding      Envelope[FundingRate]
		tickers      Envelope[Ticker]
		openInterest Envelope[OpenInterest]
		markPrices   Envelope[MarkPrice]
		instruments  Envelope[Instrument]
	)
	for _, call := range []struct {
		path string
		out  any
	}{
		{"/api/v5/public/funding-rate?instId=ANY", &funding},
		{"/api/v5/market/tickers?instType=SWAP", &tickers},
		{"/api/v5/public/open-interest?instType=SWAP", &openInterest},
		{"/api/v5/public/mark-price?instType=SWAP", &markPrices},
		{"/api/v5/public/instruments?instType=SWAP", &instruments},
	} {
		if err := a.get(ctx, call.path, call.out); err != nil {
			return core.SnapshotBatch{}, err
		}
	}
	return ParseSnapshots(funding, tickers, openInterest, markPrices, instruments, now.UnixMilli())
}

// retryCode50011 runs fetch, retrying when OKX reports a rate limit.
//
// OKX signals one as code 50011 inside an HTTP 200, so the transport's retry and circuit breaker
// never see it and the adapter has to back off itself. An open circuit means the venue is refusing
// everything and the rest of the sweep would fail too, so it stops rather than burning the cooldown.
func (a *Adapter) retryCode50011(ctx context.Context, fetch func() error) (stop bool, ok bool) {
	for attempt := 0; attempt <= inBandRetries; attempt++ {
		err := fetch()
		if err == nil {
			return false, true
		}
		var open *httpclient.CircuitOpenError
		if errors.As(err, &open) {
			return true, false
		}
		if attempt < inBandRetries {
			select {
			case <-ctx.Done():
				return true, false
			case <-time.After(inBandBackoff << attempt):
			}
		}
	}
	return false, false
}

func (a *Adapter) instrumentsAndMarks(ctx context.Context) (Envelope[Instrument], Envelope[MarkPrice], error) {
	var instruments Envelope[Instrument]
	var marks Envelope[MarkPrice]
	if err := a.get(ctx, "/api/v5/public/instruments?instType=SWAP", &instruments); err != nil {
		return instruments, marks, err
	}
	err := a.get(ctx, "/api/v5/public/mark-price?instType=SWAP", &marks)
	return instruments, marks, err
}

// perpFamilies is the distinct instFamily of every collectable perp, in instrument order.
func perpFamilies(instruments []Instrument) []string {
	seen := make(map[string]bool, len(instruments))
	families := make([]string, 0, len(instruments))
	for _, instrument := range instruments {
		if !perpInstID.MatchString(instrument.InstID) || instrument.InstFamily == "" {
			continue
		}
		if !seen[instrument.InstFamily] {
			seen[instrument.InstFamily] = true
			families = append(families, instrument.InstFamily)
		}
	}
	return families
}

// FetchLeverageTiers sweeps the whole venue's ladders: instruments and marks in bulk, then families
// five at a time (OKX's own limit), so a full sweep is about 98 requests once a day rather than one
// per market.
//
// complete is false when any batch was given up on. Five families ride on every call, so a batch
// abandoned costs five ladders — saying so is what keeps the collector from pruning them.
func (a *Adapter) FetchLeverageTiers(ctx context.Context) ([]core.LeverageTier, bool, error) {
	instruments, marks, err := a.instrumentsAndMarks(ctx)
	if err != nil {
		return nil, false, err
	}
	instrumentRows, err := instruments.unwrap("instruments")
	if err != nil {
		return nil, false, err
	}

	families := perpFamilies(instrumentRows)
	rows := make([]PositionTier, 0, len(families)*100)
	complete := true

	for i := 0; i < len(families); i += positionTiersPerCall {
		end := min(i+positionTiersPerCall, len(families))
		batch := strings.Join(families[i:end], ",")

		var fetched []PositionTier
		stop, ok := a.retryCode50011(ctx, func() error {
			var env Envelope[PositionTier]
			if err := a.get(ctx, "/api/v5/public/position-tiers?instType=SWAP&tdMode=cross&instFamily="+
				url.QueryEscape(batch), &env); err != nil {
				return err
			}
			data, err := env.unwrap("position tiers")
			if err != nil {
				return err
			}
			fetched = data
			return nil
		})

		if stop {
			tiers, parseErr := ParsePositionTiers(instruments, Envelope[PositionTier]{Code: "0", Data: rows}, marks)
			return tiers, false, parseErr
		}
		if !ok {
			complete = false
			continue
		}
		rows = append(rows, fetched...)
	}

	tiers, err := ParsePositionTiers(instruments, Envelope[PositionTier]{Code: "0", Data: rows}, marks)
	return tiers, complete, err
}

// FetchLiquidations reads forced closes as a ROTATION rather than a full sweep.
//
// OKX answers per instFamily and every one of its 479 perps is its own family, so a whole-venue pass
// costs 479 calls — against Gate's one. What makes a rotation safe rather than lossy is the page
// depth: measured 2026-09-13, a 100-record page on BTC-USDT spans 21.8 hours at 0.03 records/min,
// with the newest record ~92 minutes old. A slice of 40 families every five minutes therefore
// revisits each family about hourly and still reads far inside its own page.
//
// A ROTATING SAMPLE, NOT A SWEEP, AND NOT COMPARABLE WITH GATE'S TOTALS. Measured 2026-09-13 across
// ~2,527 visit windows: the 100-record page is a CEILING (11 windows hit it, max 197); the feed runs
// about 69 minutes behind, so the newest bucket is always incomplete; and the cursor resets on every
// restart, so families early in the list are re-read more often than the tail. On assets both venues
// cover, the OKX-to-Gate notional ratio spanned 0.10x to 16.4x in one 24 hours. Nothing in the data
// separates real venue difference from sampling artefact, so never sum the two venues or rank assets
// across them.
func (a *Adapter) FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error) {
	instruments, marks, err := a.instrumentsAndMarks(ctx)
	if err != nil {
		return nil, false, err
	}
	instrumentRows, err := instruments.unwrap("instruments")
	if err != nil {
		return nil, false, err
	}
	markRows, err := marks.unwrap("mark price")
	if err != nil {
		return nil, false, err
	}

	perps := make([]Instrument, 0, len(instrumentRows))
	for _, instrument := range instrumentRows {
		if perpInstID.MatchString(instrument.InstID) && instrument.InstFamily != "" {
			perps = append(perps, instrument)
		}
	}
	families := perpFamilies(perps)
	if len(families) == 0 {
		return nil, true, nil
	}

	instrumentByID := byInstID(perps, func(i Instrument) string { return i.InstID })
	markByID := byInstID(markRows, func(m MarkPrice) string { return m.InstID })

	a.mu.Lock()
	start := a.liquidationCursor % len(families)
	a.mu.Unlock()

	// Clamped, so a book smaller than the budget is not re-read on a loop. In production 479
	// families makes this a no-op; without it a 5-family venue would fetch each page eight times in
	// one run, burning a rate-limited venue's budget on pages it already has.
	visits := min(liquidationFamiliesPerRun, len(families))
	rows := make([]LiquidationRow, 0, visits*liquidationPage)
	complete := true

	for i := 0; i < visits; i++ {
		family := families[(start+i)%len(families)]

		var fetched []LiquidationRow
		stop, ok := a.retryCode50011(ctx, func() error {
			var env Envelope[LiquidationRow]
			if err := a.get(ctx, fmt.Sprintf(
				"/api/v5/public/liquidation-orders?instType=SWAP&state=filled&limit=%d&instFamily=%s",
				liquidationPage, url.QueryEscape(family)), &env); err != nil {
				return err
			}
			data, err := env.unwrap("liquidations")
			if err != nil {
				return err
			}
			fetched = data
			return nil
		})

		if stop {
			// Nothing is pruned, so this is lost coverage rather than lost data — but it is still
			// reported, and the cursor stays where the rotation actually stopped.
			a.mu.Lock()
			a.liquidationCursor = (start + i) % len(families)
			a.mu.Unlock()
			return ParseLiquidations(rows, instrumentByID, markByID), false, nil
		}
		if !ok {
			complete = false
			continue
		}
		rows = append(rows, fetched...)
	}

	a.mu.Lock()
	a.liquidationCursor = (start + visits) % len(families)
	a.mu.Unlock()

	return ParseLiquidations(rows, instrumentByID, markByID), complete, nil
}

// FetchFundingHistory pages backwards from toMs; `after` returns records strictly older than the
// given fundingTime.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	items := make([]FundingHistoryItem, 0, historyPage)
	after := toMs + 1

	for page := 0; page < maxPages; page++ {
		var env Envelope[FundingHistoryItem]
		if err := a.get(ctx, fmt.Sprintf(
			"/api/v5/public/funding-rate-history?instId=%s&after=%d&limit=%d",
			url.QueryEscape(venueSymbol), after, historyPage), &env); err != nil {
			return nil, err
		}
		data, err := env.unwrap("funding history")
		if err != nil {
			return nil, err
		}

		oldest := int64(0)
		for _, item := range data {
			at := item.FundingTime.PositiveMs()
			if at == nil {
				continue
			}
			if *at >= fromMs {
				items = append(items, item)
			}
			if oldest == 0 || *at < oldest {
				oldest = *at
			}
		}
		if len(data) < historyPage || oldest == 0 || oldest < fromMs {
			break
		}
		after = oldest
	}

	// The interval is inferred from the settlements themselves; only when fewer than two came back
	// does it cost an extra call to read the market's current gap as a fallback.
	fallbackHours := 8.0
	if len(items) < 2 {
		var env Envelope[FundingRate]
		if err := a.get(ctx, "/api/v5/public/funding-rate?instId="+url.QueryEscape(venueSymbol), &env); err == nil {
			if rows, err := env.unwrap("funding rate"); err == nil && len(rows) > 0 {
				measured := adapters.HoursBetween(
					rows[0].FundingTime.PositiveMs(),
					rows[0].NextFundingTime.PositiveMs(),
				)
				if measured != nil {
					fallbackHours = *measured
				}
			}
		}
	}
	return ParseFundingHistory(Envelope[FundingHistoryItem]{Code: "0", Data: items}, fallbackHours)
}
