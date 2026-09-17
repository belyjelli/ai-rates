package binancefapi

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
	// exchangeInfoMaxAge: the endpoint only says which symbols trade, and it is large (Binance's is
	// 1.1 MB), so it is cached rather than fetched every cycle.
	exchangeInfoMaxAge = time.Hour
	// openInterestMaxAge with the default budget re-reads every symbol about every five minutes,
	// which open interest changes far more slowly than.
	openInterestMaxAge = 5 * time.Minute
	defaultOIBudget    = 120
	historyLimit       = 1000
	historyMaxPages    = 20

	// Spacing per member, for the caller that builds the HTTP client. WEEX allows 500 weight per
	// 10s and is the only one needing more room than the family default.
	DefaultSpacing = 100 * time.Millisecond
	WeexSpacing    = 250 * time.Millisecond

	// openInterestWindow bounds the whole per-symbol phase, and openInterestMaxFailures abandons it
	// early when the endpoint is plainly down.
	//
	// WHY BOTH, with the arithmetic that forced them. A 5xx is transient to the HTTP client, so each
	// failed read retries three times with 500ms, 1s and 2s of backoff — about 3.5 seconds per
	// symbol. At the default budget of 120 that is roughly SEVEN MINUTES inside a 60-second cycle,
	// against a VenueLoop timeout of 45 seconds. The cycle would be killed every time, discarding
	// the funding data that had already arrived — the exact opposite of what this phase promises.
	// Measured as a 3.94s test against 0.00s for every other one, on three symbols.
	openInterestWindow      = 20 * time.Second
	openInterestMaxFailures = 3
)

// OpenInterestMode is how a member reports open interest.
//
//   - PerSymbol: openInterest?symbol= for a budgeted slice each cycle (Binance, Aster).
//   - Bulk: one symbol-less call returning every market (Bullet).
//   - None: not collected, where the venue's figure cannot be read as a quantity we trust. WEEX's
//     fits neither reading — as base units BTCUSDT is $10.8B, above Binance's $8B; as contracts the
//     OI/volume ratio swings from 0.0004 to 1,609 — and a number we cannot put a unit on would
//     mislead the capital figures that read it.
type OpenInterestMode string

const (
	PerSymbol OpenInterestMode = "perSymbol"
	Bulk      OpenInterestMode = "bulk"
	None      OpenInterestMode = "none"
)

// IntervalSource is where the settlement interval comes from: the fundingInfo endpoint, or read off
// each premiumIndex row for a member that serves no fundingInfo (WEEX, whose collectCycle is in
// minutes).
type IntervalSource struct {
	FromPremiumIndex func(PremiumIndex) *float64
}

// Options configures one member of the family. The venue id and base URL are parameters rather than
// module constants, which is what makes a new member a configuration instead of a copied adapter.
type Options struct {
	VenueID string
	// BaseURL up to and including the path prefix, with no trailing slash.
	BaseURL string
	// Classify is required, so a new member has to say where its declaration lives instead of
	// inheriting another venue's reading of a field it may not fill.
	Classify Classifier
	// DefaultIntervalHours for symbols absent from fundingInfo; nil skips them.
	//
	// Request SPACING is deliberately not here: it belongs to the HTTP client, which the caller
	// builds before the adapter. An earlier version carried a MinInterval field that nothing read,
	// so WEEX's 250ms was silently ignored — dead configuration that lies is worse than none.
	DefaultIntervalHours *float64
	IsTradable           Tradability
	IntervalSource       *IntervalSource
	PredictedRate        func(PremiumIndex) adapters.Num
	// PremiumIndexTimeUnit and FundingRateTimeUnit default to milliseconds.
	PremiumIndexTimeUnit TimeUnit
	FundingRateTimeUnit  TimeUnit
	HistoryBasisHours    *float64
	// HistoryMaxWindow is the widest span one fundingRate request may cover. WEEX refuses more than
	// 7 days, so a longer window is walked in slices.
	HistoryMaxWindow   time.Duration
	OpenInterest       OpenInterestMode
	OpenInterestBudget int
}

// Adapter is one venue in the family.
//
// The mutable caches are guarded because a venue's snapshot loop and its history loop share one
// adapter: VenueLoop guarantees its own cycles never overlap, but it makes no such promise against
// the history sweep running beside it.
type Adapter struct {
	client *httpclient.Client
	opts   Options

	mu           sync.Mutex
	tradable     map[string]TradableSymbol
	tradableAt   time.Time
	intervals    map[string]float64
	openInterest map[string]OpenInterestEntry
}

func NewAdapter(client *httpclient.Client, opts Options) *Adapter {
	if opts.OpenInterest == "" {
		opts.OpenInterest = PerSymbol
	}
	if opts.OpenInterestBudget <= 0 {
		opts.OpenInterestBudget = defaultOIBudget
	}
	return &Adapter{
		client:       client,
		opts:         opts,
		intervals:    map[string]float64{},
		openInterest: map[string]OpenInterestEntry{},
	}
}

func (a *Adapter) VenueID() string   { return a.opts.VenueID }
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) get(ctx context.Context, path string, out any) error {
	return a.client.GetJSON(ctx, a.opts.BaseURL+path, out)
}

// FetchSnapshots runs one cycle: the cached exchangeInfo, then the bulk trio, then the open-interest
// slice.
func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	if err := a.refreshExchangeInfo(ctx, now); err != nil {
		return core.SnapshotBatch{}, err
	}

	var premium []PremiumIndex
	if err := a.get(ctx, "/premiumIndex", &premium); err != nil {
		return core.SnapshotBatch{}, err
	}

	var fundingInfo []FundingInfo
	if a.opts.IntervalSource != nil && a.opts.IntervalSource.FromPremiumIndex != nil {
		fundingInfo = IntervalsFromPremiumIndex(premium, a.opts.IntervalSource.FromPremiumIndex)
	} else if err := a.get(ctx, "/fundingInfo", &fundingInfo); err != nil {
		return core.SnapshotBatch{}, err
	}

	var tickers []Ticker24h
	if err := a.get(ctx, "/ticker/24hr", &tickers); err != nil {
		return core.SnapshotBatch{}, err
	}

	a.mu.Lock()
	intervals := make(map[string]float64, len(fundingInfo))
	for _, info := range fundingInfo {
		if info.FundingIntervalHours.OK && info.FundingIntervalHours.Val > 0 {
			intervals[info.Symbol] = info.FundingIntervalHours.Val
		}
	}
	a.intervals = intervals
	tradable := a.tradable
	a.mu.Unlock()

	snapshots := ParseSnapshots(a.opts.VenueID, SnapshotInput{
		Premium:              premium,
		FundingInfo:          fundingInfo,
		Tickers:              tickers,
		Tradable:             tradable,
		DefaultIntervalHours: a.opts.DefaultIntervalHours,
		PredictedRate:        a.opts.PredictedRate,
		NextFundingTimeUnit:  a.opts.PremiumIndexTimeUnit,
	}, now.UnixMilli())

	a.refreshOpenInterest(ctx, now, snapshots, tradable)

	a.mu.Lock()
	cache := make(map[string]OpenInterestEntry, len(a.openInterest))
	for symbol, entry := range a.openInterest {
		cache[symbol] = entry
	}
	a.mu.Unlock()

	return core.SnapshotBatch{Snapshots: AttachOpenInterest(snapshots, cache)}, nil
}

func (a *Adapter) refreshExchangeInfo(ctx context.Context, now time.Time) error {
	a.mu.Lock()
	fresh := a.tradable != nil && now.Sub(a.tradableAt) < exchangeInfoMaxAge
	a.mu.Unlock()
	if fresh {
		return nil
	}

	var info ExchangeInfo
	if err := a.get(ctx, "/exchangeInfo", &info); err != nil {
		return err
	}
	if info.Symbols == nil {
		return fmt.Errorf("%s: unexpected exchangeInfo response", a.opts.VenueID)
	}

	a.mu.Lock()
	a.tradable = TradablePerpetuals(info, a.opts.Classify, a.opts.IsTradable)
	a.tradableAt = now
	a.mu.Unlock()
	return nil
}

// refreshOpenInterest never fails a cycle. Funding has already arrived by this point, and a missing
// open interest renders as "unknown" rather than as zero, so losing it is strictly better than
// discarding the whole cycle.
func (a *Adapter) refreshOpenInterest(ctx context.Context, now time.Time, snapshots []core.FundingSnapshot, tradable map[string]TradableSymbol) {
	if a.opts.OpenInterest == None {
		return
	}

	// Drop symbols the venue has delisted, so the cache cannot grow without bound.
	a.mu.Lock()
	for symbol := range a.openInterest {
		if _, live := tradable[symbol]; !live {
			delete(a.openInterest, symbol)
		}
	}
	a.mu.Unlock()

	if a.opts.OpenInterest == Bulk {
		var rows []OpenInterest
		if err := a.get(ctx, "/openInterest", &rows); err != nil {
			return // Keep the last known figures for this cycle.
		}
		a.mu.Lock()
		for _, row := range rows {
			if _, live := tradable[row.Symbol]; live && row.OpenInterest.OK {
				a.openInterest[row.Symbol] = OpenInterestEntry{Contracts: row.OpenInterest.Val, FetchedAt: now.UnixMilli()}
			}
		}
		a.mu.Unlock()
		return
	}

	symbols := make([]string, 0, len(snapshots))
	for i := range snapshots {
		symbols = append(symbols, snapshots[i].VenueSymbol)
	}

	a.mu.Lock()
	lookup := func(symbol string) (int64, bool) {
		entry, ok := a.openInterest[symbol]
		return entry.FetchedAt, ok
	}
	batch := adapters.SelectRefreshBatch(symbols, lookup, now.UnixMilli(), a.opts.OpenInterestBudget, openInterestMaxAge.Milliseconds())
	a.mu.Unlock()

	// The phase gets its own deadline so it can never consume the cycle that funding already
	// succeeded in; see the constants above for the arithmetic.
	phaseCtx, cancel := context.WithTimeout(ctx, openInterestWindow)
	defer cancel()

	consecutiveFailures := 0
	for _, symbol := range batch {
		if phaseCtx.Err() != nil {
			return
		}
		var row OpenInterest
		err := a.get(phaseCtx, "/openInterest?symbol="+url.QueryEscape(symbol), &row)
		if err != nil {
			// An open circuit means the venue is refusing everything; the rest of the batch would
			// only burn the breaker's cooldown.
			var open *httpclient.CircuitOpenError
			if errors.As(err, &open) {
				return
			}
			// One bad symbol is left for a later cycle. A run of them is the endpoint being down,
			// and continuing would spend the whole cycle on backoff.
			consecutiveFailures++
			if consecutiveFailures >= openInterestMaxFailures {
				return
			}
			continue
		}
		consecutiveFailures = 0
		if row.OpenInterest.OK {
			a.mu.Lock()
			a.openInterest[symbol] = OpenInterestEntry{Contracts: row.OpenInterest.Val, FetchedAt: now.UnixMilli()}
			a.mu.Unlock()
		}
	}
}

// FetchFundingHistory pages forward from fromMs, in slices of at most HistoryMaxWindow.
//
// The query always speaks milliseconds; only the rows' fundingTime is scaled, because Bullet reports
// microseconds there while its premiumIndex stays in milliseconds.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	windowMs := int64(1<<62 - 1)
	if a.opts.HistoryMaxWindow > 0 {
		windowMs = a.opts.HistoryMaxWindow.Milliseconds()
	}

	rows := make([]FundingRate, 0, historyLimit)
	for windowStart := fromMs; windowStart <= toMs; {
		windowEnd := toMs
		if windowStart+windowMs < windowEnd {
			windowEnd = windowStart + windowMs
		}
		startTime := windowStart
		for page := 0; page < historyMaxPages && startTime <= windowEnd; page++ {
			endpoint := fmt.Sprintf("/fundingRate?symbol=%s&startTime=%d&endTime=%d&limit=%d",
				url.QueryEscape(venueSymbol), startTime, windowEnd, historyLimit)
			var batch []FundingRate
			if err := a.get(ctx, endpoint, &batch); err != nil {
				return nil, err
			}
			rows = append(rows, batch...)
			if len(batch) < historyLimit {
				break
			}
			newest := int64(0)
			for _, row := range batch {
				if at := EpochMs(row.FundingTime, a.opts.FundingRateTimeUnit); at != nil && *at > newest {
					newest = *at
				}
			}
			startTime = newest + 1
		}
		windowStart = windowEnd + 1
	}

	// The class and the interval both come from the last snapshot cycle. History requested before
	// any cycle has run finds neither, and its events default to crypto as its interval does to nil.
	a.mu.Lock()
	fallback, hasFallback := a.intervals[venueSymbol]
	declared, known := a.tradable[venueSymbol]
	a.mu.Unlock()

	var fallbackHours *float64
	if hasFallback {
		fallbackHours = &fallback
	}
	var class *core.AssetClass
	if known {
		class = &declared.AssetClass
	}

	return ParseFundingHistory(a.opts.VenueID, venueSymbol, rows, fromMs, toMs, fallbackHours, class,
		HistoryOptions{TimeUnit: a.opts.FundingRateTimeUnit, BasisHours: a.opts.HistoryBasisHours}), nil
}

// ---- the four members ----

// Aster: the family base's original venue. Its tags carry the class; underlyingType is COIN on all
// 574 TRADING perpetuals, gold included.
func Aster(client *httpclient.Client) *Adapter {
	return NewAdapter(client, Options{
		VenueID:  "aster",
		BaseURL:  "https://fapi.asterdex.com/fapi/v1",
		Classify: AsterAssetClass,
	})
}

// Binance: the largest venue on the site. Reachable from the hklab collector (measured 2026-09-13,
// 0.12-0.21s); the catalog's "HTTP 451 from US IPs" warning applies to where a collector runs, not
// to the venue, which is why it is recorded rather than assumed stable.
//
// It is the one member returned as a *BinanceAdapter, which adds taker flow; see takerflow.go.
func Binance(client *httpclient.Client) *BinanceAdapter {
	return newBinanceAdapter(client, Options{
		VenueID:  "binance",
		BaseURL:  "https://fapi.binance.com/fapi/v1",
		Classify: BinanceAssetClass,
	})
}

// WEEX: a family member under /capi/v3/market. fundingInfo is 404, so the interval comes from
// premiumIndex `collectCycle` (minutes); lastFundingRate is the last SETTLED rate, so the estimate
// is forecastFundingRate; history windows are capped at 7 days; open interest is not collected.
func Weex(client *httpclient.Client) *Adapter {
	return NewAdapter(client, Options{
		VenueID:    "weex",
		BaseURL:    "https://api-contract.weex.com/capi/v3/market",
		Classify:   WeexAssetClass,
		IsTradable: IsWeexTradable,
		IntervalSource: &IntervalSource{FromPremiumIndex: func(p PremiumIndex) *float64 {
			if !p.CollectCycle.OK || p.CollectCycle.Val <= 0 {
				return nil
			}
			hours := p.CollectCycle.Val / 60
			return &hours
		}},
		PredictedRate:    func(p PremiumIndex) adapters.Num { return p.ForecastFundingRate },
		HistoryMaxWindow: 7 * 24 * time.Hour,
		OpenInterest:     None,
	})
}

// Bullet: rates are 8h rates settled hourly at one-eighth. Snapshots carry estimatedFundingRate over
// its 1h interval; history carries each settled 8h rate at an 8h basis, never the 1h gap between
// settlements — reading the basis off the gaps would overstate its funding eightfold.
func Bullet(client *httpclient.Client) *Adapter {
	eight := 8.0
	return NewAdapter(client, Options{
		VenueID:             "bullet",
		BaseURL:             "https://tradingapi.bullet.xyz/fapi/v1",
		Classify:            BulletAssetClass,
		IsTradable:          IsBulletTradable,
		PredictedRate:       func(p PremiumIndex) adapters.Num { return p.EstimatedFundingRate },
		FundingRateTimeUnit: UnitUs,
		HistoryBasisHours:   &eight,
		OpenInterest:        Bulk,
	})
}
