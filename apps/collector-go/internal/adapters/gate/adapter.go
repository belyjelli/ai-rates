package gate

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	baseURL = "https://api.gateio.ws/api/v4/futures/usdt"

	// MinInterval is the spacing this venue's client should use.
	MinInterval = 150 * time.Millisecond

	historyPage = 1000
	maxPages    = 20

	// riskTiersPerPage: `offset` on risk_limit_tiers counts contracts, not rows, and a page answers
	// with 100 of them.
	riskTiersPerPage = 100
	// riskTiersMaxPages: ~981 contracts today, so ten pages; the cap is headroom, not an expectation.
	riskTiersMaxPages = 40
	riskTiersRetries  = 2
	riskTiersBackoff  = 400 * time.Millisecond

	// liquidationPage: a page this deep covers ~58 minutes of forced closes, so a 5-minute poll
	// cannot overflow it.
	liquidationPage = 1000
)

// ContractsMaxAge is how long a fetched /contracts list is reused before it is read again.
//
// The list is 1.3 MB and changes on a listing or a delisting; the fields that move every cycle (the
// funding rate, mark and index) come from /tickers instead, see withLiveFunding. Measured
// 2026-09-24 from hklab, the same 1.3 MB took 0.65 s on one request and 31-43 s on the next, and
// the HTTP client allows 15 s: Gate did not complete one cycle for the first eight minutes after a
// restart, and every cycle then was a coin toss. Reading it hourly leaves the 480 KB tickers as the
// only large download a cycle makes.
const ContractsMaxAge = time.Hour

const (
	// contractsRequestTimeout replaces the client's 15 s for this one download, which is worth waiting
	// for: the slowest measured was 43 s.
	contractsRequestTimeout = 2 * time.Minute
	// contractsRefreshBudget bounds one background refresh, retries included.
	contractsRefreshBudget = 5 * time.Minute
	// staleWait is how long a cycle holding a cached list waits for a refresh before using the cache.
	staleWait = 5 * time.Second
)

// Adapter collects Gate's USDT-margined futures.
//
// Gate answers for its whole book in one liquidations call, so unlike OKX there is no rotation cursor
// to keep. Its state is the cached contract list (below) and taker flow's multipliers and pacing
// (takerState), each mutex-guarded, because the collector runs each venue's loops on their own
// goroutines.
type Adapter struct {
	client *httpclient.Client
	taker  takerState

	mu                 sync.Mutex
	contracts          []Contract
	contractsFetchedAt int64
	// refreshing is the in-flight /contracts download, closed when it ends; nil when none is running.
	refreshing chan struct{}
	refreshErr error
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client, taker: takerState{pace: adapters.NewPacer(TakerFlowPace)}}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
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

// FetchSnapshots runs one cycle: the tickers, which carry funding, the prices, the book and the
// volumes, over the contract list, which carries the multipliers and intervals and is read at most
// once per ContractsMaxAge.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	contracts, err := a.contractList(ctx, now.UnixMilli())
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	var tickers []Ticker
	if err := a.get(ctx, "/tickers", &tickers); err != nil {
		return core.SnapshotBatch{}, err
	}
	return ParseSnapshots(withLiveFunding(contracts, tickers, now.UnixMilli()), tickers, now.UnixMilli()), nil
}

// contractList returns the cached /contracts, refreshing it once it is ContractsMaxAge old.
//
// THE DOWNLOAD RUNS ON ITS OWN, not inside the cycle that asked for it. Deployed first as a plain
// in-cycle read, the cache never filled: the 1.3 MB took longer than the 15 s request limit, so the
// first read failed, and every later cycle started it again from nothing. Now a refresh runs in the
// background with a 2-minute request limit, one at a time, and outlives the cycle that began it.
//
// A cycle with nothing cached waits for it for as long as its own deadline allows, and fails if it
// is not done; the next cycle waits on the SAME download rather than starting another. A cycle with
// a list in hand waits at most staleWait, then uses the old list: a listing an hour late costs far
// less than a lost cycle. A failed refresh leaves the old list, and the next stale cycle retries.
func (a *Adapter) contractList(ctx context.Context, nowMs int64) ([]Contract, error) {
	a.mu.Lock()
	cached, fetchedAt := a.contracts, a.contractsFetchedAt
	if cached != nil && nowMs-fetchedAt < ContractsMaxAge.Milliseconds() {
		a.mu.Unlock()
		return cached, nil
	}
	done := a.refreshing
	if done == nil {
		done = make(chan struct{})
		a.refreshing = done
		go a.refreshContracts(done, nowMs)
	}
	a.mu.Unlock()

	wait := ctx.Done()
	if cached != nil {
		timer := time.NewTimer(staleWait)
		defer timer.Stop()
		select {
		case <-done:
		case <-timer.C:
			return cached, nil
		case <-wait:
			return cached, nil
		}
	} else {
		select {
		case <-done:
		case <-wait:
			return nil, fmt.Errorf("gate contract list still downloading: %w", ctx.Err())
		}
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	if a.contracts != nil {
		return a.contracts, nil
	}
	return nil, a.refreshErr
}

// refreshContracts downloads /contracts once and stores it, then clears the in-flight marker.
func (a *Adapter) refreshContracts(done chan struct{}, nowMs int64) {
	ctx, cancel := context.WithTimeout(context.Background(), contractsRefreshBudget)
	defer cancel()
	var fresh []Contract
	err := a.get(httpclient.WithRequestTimeout(ctx, contractsRequestTimeout), "/contracts", &fresh)

	a.mu.Lock()
	if err == nil {
		a.contracts, a.contractsFetchedAt = fresh, nowMs
	}
	a.refreshErr = err
	a.refreshing = nil
	a.mu.Unlock()
	close(done)
}

// FetchLeverageTiers sweeps the whole venue's ladders in ten-ish pages, since `offset` advances by
// contract rather than by row.
//
// complete is false when any page was given up on. A page costs 100 contracts, so saying so is what
// keeps the collector from pruning ladders it simply never read.
func (a *Adapter) FetchLeverageTiers(ctx context.Context) ([]core.LeverageTier, bool, error) {
	rows := make([]RiskLimitTier, 0, riskTiersPerPage*10)
	complete := true

	for page := 0; page < riskTiersMaxPages; page++ {
		fetched, stop, ok := a.riskLimitTierPage(ctx, page*riskTiersPerPage)
		if stop {
			return ParseRiskLimitTiers(rows), false, nil
		}
		// A page given up on costs 100 contracts, so the sweep says so and nothing is pruned. Later
		// offsets are independent of this one, so the pass continues rather than stopping short.
		if !ok {
			complete = false
			continue
		}
		if len(fetched) == 0 {
			break
		}
		rows = append(rows, fetched...)
	}
	return ParseRiskLimitTiers(rows), complete, nil
}

// riskLimitTierPage reads one offset, retrying transient failures. stop means the circuit is open,
// so the venue is refusing everything and the rest of the sweep would fail too.
func (a *Adapter) riskLimitTierPage(ctx context.Context, offset int) (rows []RiskLimitTier, stop, ok bool) {
	for attempt := 0; attempt <= riskTiersRetries; attempt++ {
		var page []RiskLimitTier
		err := a.get(ctx, fmt.Sprintf("/risk_limit_tiers?limit=1000&offset=%d", offset), &page)
		if err == nil {
			return page, false, true
		}
		var open *httpclient.CircuitOpenError
		if errors.As(err, &open) {
			return nil, true, false
		}
		if attempt < riskTiersRetries {
			select {
			case <-ctx.Done():
				return nil, true, false
			case <-time.After(riskTiersBackoff << attempt):
			}
		}
	}
	return nil, false, false
}

// FetchLiquidations reads the whole venue's recent forced closes in one call, plus `/contracts` for
// the multipliers.
//
// Two requests for ~981 contracts, against OKX needing one per instFamily (479). Measured
// 2026-09-13: a 1000-row request returns ~173 records spanning 58 minutes at 3 records/min, with
// the newest 0.1 min old — so the collector's 5-minute poll has a 12x margin against overflowing
// the page. `from`/`to` are accepted and SILENTLY IGNORED (a bogus-parameter control returned the
// identical first record), so there is no resumable window: every poll re-reads the page and the
// store's composite key absorbs the repeats.
func (a *Adapter) FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error) {
	var rows []LiquidationRow
	if err := a.get(ctx, fmt.Sprintf("/liq_orders?limit=%d", liquidationPage), &rows); err != nil {
		return nil, false, err
	}
	// The multipliers only, so the snapshot loop's hourly cache serves: re-reading 1.3 MB every five
	// minutes for them was the same slow download that was failing the snapshot cycles.
	contracts, err := a.contractList(ctx, time.Now().UnixMilli())
	if err != nil {
		return nil, false, err
	}

	multipliers := make(map[string]float64, len(contracts))
	for _, contract := range contracts {
		if contract.QuantoMultiplier.OK && contract.QuantoMultiplier.Val > 0 {
			multipliers[contract.Name] = contract.QuantoMultiplier.Val
		}
	}
	// One call covers the venue, so a response that arrived at all is complete by construction.
	return ParseLiquidations(rows, multipliers), true, nil
}

// FetchFundingHistory pages backwards from toMs for one contract.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	items := make([]FundingHistoryItem, 0, historyPage)
	from := fromMs / 1000
	to := toMs / 1000

	for page := 0; page < maxPages && to >= from; page++ {
		var data []FundingHistoryItem
		if err := a.get(ctx, fmt.Sprintf("/funding_rate?contract=%s&from=%d&to=%d&limit=%d",
			url.QueryEscape(venueSymbol), from, to, historyPage), &data); err != nil {
			return nil, err
		}
		items = append(items, data...)
		if len(data) < historyPage {
			break
		}
		oldest := data[0].T
		for _, item := range data {
			if item.T < oldest {
				oldest = item.T
			}
		}
		to = oldest - 1
	}

	// The interval is inferred from the settlements themselves; only when fewer than two came back
	// does it cost an extra call to read the contract's declared gap as a fallback.
	fallbackHours := 8.0
	if len(items) < 2 {
		var contract Contract
		if err := a.get(ctx, "/contracts/"+url.PathEscape(venueSymbol), &contract); err != nil {
			return nil, err
		}
		if contract.FundingInterval > 0 {
			fallbackHours = float64(contract.FundingInterval) / 3600
		}
	}

	// One item per settlement timestamp: the venue can repeat a settlement across page boundaries.
	// The first occurrence keeps its position and the last wins on value, as a JS Map does.
	position := make(map[int64]int, len(items))
	unique := make([]FundingHistoryItem, 0, len(items))
	for _, item := range items {
		if at, seen := position[item.T]; seen {
			unique[at] = item
			continue
		}
		position[item.T] = len(unique)
		unique = append(unique, item)
	}
	return ParseFundingHistory(venueSymbol, unique, fallbackHours), nil
}
