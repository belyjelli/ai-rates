package gate

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

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

// Adapter collects Gate's USDT-margined futures.
//
// It owns no state beyond its client. Gate answers for its whole book in one liquidations call, so
// unlike OKX there is no rotation cursor to keep — nothing here would have to become mutex-guarded
// adapter state to survive the collector running each venue on its own goroutine.
type Adapter struct {
	client *httpclient.Client
}

func NewAdapter(client *httpclient.Client) *Adapter {
	return &Adapter{client: client}
}

func (a *Adapter) VenueID() string { return VenueID }

// RequestCount is attempts made so far, so a cycle can report its own request cost.
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, baseURL+path, out)
}

// FetchSnapshots runs one cycle: the contract list, which carries funding and the multipliers, and
// the tickers, which carry the book and the volumes.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var contracts []Contract
	if err := a.get(ctx, "/contracts", &contracts); err != nil {
		return core.SnapshotBatch{}, err
	}
	var tickers []Ticker
	if err := a.get(ctx, "/tickers", &tickers); err != nil {
		return core.SnapshotBatch{}, err
	}
	return ParseSnapshots(contracts, tickers, now.UnixMilli()), nil
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
	var contracts []Contract
	if err := a.get(ctx, "/contracts", &contracts); err != nil {
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
