package bybit

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://api.bybit.com"
	// maxPages bounds every cursor walk. A venue that keeps handing back a cursor must not be able
	// to spin a cycle forever; the loop's own timeout would eventually cut it, but a bounded walk
	// fails with a clear reason instead of a timeout.
	maxPages = 50
	// riskLimitMaxPages is far larger because /v5/market/risk-limit ignores `limit` and returns
	// about 15 symbols a page whatever you ask for, so the whole linear book (~830 symbols) needs
	// many more pages than any other sweep here.
	riskLimitMaxPages = 200
	historyPage       = 200
)

// Adapter fetches bybit's linear perpetual market data.
//
// It owns no state beyond its client, so the venue's snapshot, history and tier loops can share one
// Adapter and therefore one set of request spacing and one circuit breaker — which is the point of
// the sharing, since bybit rate-limits by IP and not by caller.
type Adapter struct {
	client *httpclient.Client
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

// FetchSnapshots returns current funding and market stats for every live linear perp.
//
// Two calls: the bulk tickers endpoint, and the paginated instrument list that carries the funding
// interval, the declared asset class and the headline leverage. The instruments are what make the
// join meaningful — a ticker alone cannot say whether BBUSDT is BounceBit or a stock.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var tickers Envelope[Ticker]
	if err := a.client.GetJSON(ctx, baseURL+"/v5/market/tickers?category=linear", &tickers); err != nil {
		return core.SnapshotBatch{}, err
	}

	instruments, err := a.fetchInstruments(ctx)
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	return ParseSnapshots(tickers, instruments, now.UnixMilli())
}

func (a *Adapter) fetchInstruments(ctx context.Context) ([]Instrument, error) {
	all := make([]Instrument, 0, 1024)
	cursor := ""
	for page := 0; page < maxPages; page++ {
		endpoint := baseURL + "/v5/market/instruments-info?category=linear&limit=1000"
		if cursor != "" {
			endpoint += "&cursor=" + url.QueryEscape(cursor)
		}
		var env Envelope[Instrument]
		if err := a.client.GetJSON(ctx, endpoint, &env); err != nil {
			return nil, err
		}
		if err := env.unwrap("instruments"); err != nil {
			return nil, err
		}
		all = append(all, env.Result.List...)
		cursor = env.Result.NextPageCursor
		if cursor == "" {
			return all, nil
		}
	}
	return nil, fmt.Errorf("bybit instruments: cursor did not terminate within %d pages", maxPages)
}

// FetchLeverageTiers sweeps the whole venue's risk-limit ladders in one pass.
//
// Whole-venue rather than per-symbol because the endpoint answers for every symbol from one
// paginated call, so the full ladder costs tens of requests rather than one per market. Tiers move
// only when a venue relists or rebalances risk, so the caller runs this daily.
//
// complete is true only when the cursor walk finished. A failed page returns an error rather than a
// partial sweep, because the caller prunes stale ladders on a complete sweep — and pruning against
// a partial read would delete the ladders of markets it simply never saw.
func (a *Adapter) FetchLeverageTiers(ctx context.Context) ([]core.LeverageTier, bool, error) {
	rows := make([]RiskLimit, 0, 4096)
	cursor := ""
	for page := 0; page < riskLimitMaxPages; page++ {
		endpoint := baseURL + "/v5/market/risk-limit?category=linear"
		if cursor != "" {
			endpoint += "&cursor=" + url.QueryEscape(cursor)
		}
		var env Envelope[RiskLimit]
		if err := a.client.GetJSON(ctx, endpoint, &env); err != nil {
			return nil, false, err
		}
		if err := env.unwrap("risk limit"); err != nil {
			return nil, false, err
		}
		rows = append(rows, env.Result.List...)
		cursor = env.Result.NextPageCursor
		if cursor == "" {
			return ParseRiskLimit(rows), true, nil
		}
	}
	return nil, false, fmt.Errorf("bybit risk limit: cursor did not terminate within %d pages", riskLimitMaxPages)
}

// FetchFundingHistory returns settled payments for one market in [fromMs, toMs], oldest first.
//
// Paged backwards from toMs, because the endpoint answers newest-first and bounds each window. The
// interval is inferred from the settlements themselves; only when fewer than two came back does it
// cost an extra call to read the instrument's declared interval as a fallback.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	items := make([]FundingHistoryItem, 0, historyPage)
	endTime := toMs

	for page := 0; page < maxPages && endTime >= fromMs; page++ {
		endpoint := fmt.Sprintf(
			"%s/v5/market/funding/history?category=linear&symbol=%s&startTime=%d&endTime=%d&limit=%d",
			baseURL, url.QueryEscape(venueSymbol), fromMs, endTime, historyPage,
		)
		var env Envelope[FundingHistoryItem]
		if err := a.client.GetJSON(ctx, endpoint, &env); err != nil {
			return nil, err
		}
		if err := env.unwrap("funding history"); err != nil {
			return nil, err
		}
		list := env.Result.List
		items = append(items, list...)
		if len(list) < historyPage {
			break
		}
		oldest := int64(0)
		for i, item := range list {
			if !item.FundingRateTimestamp.OK {
				continue
			}
			ms := int64(item.FundingRateTimestamp.Val)
			if i == 0 || ms < oldest {
				oldest = ms
			}
		}
		if oldest == 0 {
			break
		}
		endTime = oldest - 1
	}

	fallbackHours := 8.0
	if len(items) < 2 {
		var env Envelope[Instrument]
		endpoint := baseURL + "/v5/market/instruments-info?category=linear&symbol=" + url.QueryEscape(venueSymbol)
		if err := a.client.GetJSON(ctx, endpoint, &env); err == nil && len(env.Result.List) > 0 {
			if interval := env.Result.List[0].FundingInterval; interval > 0 {
				fallbackHours = float64(interval) / 60
			}
		}
	}

	// One item per settlement timestamp: the venue can repeat a settlement across page boundaries.
	unique := make(map[int64]FundingHistoryItem, len(items))
	ordered := make([]FundingHistoryItem, 0, len(items))
	for _, item := range items {
		if !item.FundingRateTimestamp.OK {
			continue
		}
		key := int64(item.FundingRateTimestamp.Val)
		if _, seen := unique[key]; seen {
			continue
		}
		unique[key] = item
		ordered = append(ordered, item)
	}

	var env Envelope[FundingHistoryItem]
	env.Result.List = ordered
	return ParseFundingHistory(env, fallbackHours)
}
