package bluefin

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
	// infoTTL: exchange info only says which markets are ACTIVE, which changes on listings rather
	// than on trades, so it is cached instead of fetched every cycle.
	infoTTL = time.Hour

	historyPageSize = 1000
	historyMaxPages = 50
)

// Adapter fetches Bluefin Pro's perp market data.
//
// The info cache is guarded because a venue's loops share one adapter: VenueLoop guarantees its own
// cycles never overlap, but it makes no such promise against anything running beside it.
type Adapter struct {
	client *httpclient.Client

	mu      sync.Mutex
	info    []MarketInfo
	infoAt  time.Time
	hasInfo bool
	// liqSince is where the last liquidation poll's window ended; zero before the first.
	liqSince time.Time
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every ACTIVE Bluefin perp.
//
// The hourly exchange-info call comes first because it is what says a market is tradable at all: the
// ticker list carries no status of its own.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	if err := a.refreshInfo(ctx, now); err != nil {
		return core.SnapshotBatch{}, err
	}

	var tickers []Ticker
	if err := a.client.GetJSON(ctx, API+"/exchange/tickers", &tickers); err != nil {
		return core.SnapshotBatch{}, err
	}
	if tickers == nil {
		return core.SnapshotBatch{}, fmt.Errorf("%s: unexpected exchange/tickers", VenueID)
	}

	a.mu.Lock()
	info := a.info
	a.mu.Unlock()

	return ParseTickers(tickers, info, now.UnixMilli()), nil
}

func (a *Adapter) refreshInfo(ctx context.Context, now time.Time) error {
	a.mu.Lock()
	fresh := a.hasInfo && now.Sub(a.infoAt) < infoTTL
	a.mu.Unlock()
	if fresh {
		return nil
	}

	var body ExchangeInfo
	if err := a.client.GetJSON(ctx, API+"/exchange/info", &body); err != nil {
		return err
	}
	if body.Markets == nil {
		return fmt.Errorf("%s: unexpected exchange/info", VenueID)
	}

	a.mu.Lock()
	a.info = body.Markets
	a.infoAt = now
	a.hasInfo = true
	a.mu.Unlock()
	return nil
}

// FetchFundingHistory returns settled hourly payments for one market in [fromMs, toMs], oldest
// first.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingRow, 0, historyPageSize)
	// startTimeAtMillis is exclusive, endTimeAtMillis inclusive; rows come newest first. The
	// window is widened by an hour at the start so a row stamped just past the hour is not lost.
	start := fromMs - hourMs
	if start < 0 {
		start = 0
	}
	for page := 1; page <= historyMaxPages; page++ {
		endpoint := fmt.Sprintf(
			"%s/exchange/fundingRateHistory?symbol=%s&startTimeAtMillis=%d&endTimeAtMillis=%d&limit=%d&page=%d",
			API, url.QueryEscape(venueSymbol), start, toMs+hourMs, historyPageSize, page,
		)
		var batch []FundingRow
		if err := a.client.GetJSON(ctx, endpoint, &batch); err != nil {
			return nil, err
		}
		if batch == nil {
			return nil, fmt.Errorf("%s: unexpected fundingRateHistory", VenueID)
		}
		rows = append(rows, batch...)
		if len(batch) < historyPageSize {
			break
		}
	}
	return ParseFundingHistory(rows, venueSymbol, fromMs, toMs), nil
}
