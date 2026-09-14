// Package binancefapi is the whole binance-fapi family: Aster, Binance, WEEX and Bullet, which
// serve the same /fapi/v1 surface.
//
// Ported from packages/adapters/src/venues/aster.ts, which is the family base in TypeScript for the
// same reason this is one in Go: the members share an API but NOT a declaration. Binance states a
// market's class in `underlyingType`, Aster in tags, Bullet in `contractType`, and WEEX in its own
// `underlyingType` vocabulary. So the parsing is shared and the reading of each venue's declaration
// is a parameter — which is what lets a new member be a configuration rather than a copied adapter.
//
// This file holds the pure parsing. The stateful adapter (hourly exchangeInfo cache, budgeted
// open-interest rotation, paged history) lives beside it.
package binancefapi

import (
	"regexp"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// PremiumIndex is one row of /premiumIndex.
type PremiumIndex struct {
	Symbol     string       `json:"symbol"`
	MarkPrice  adapters.Num `json:"markPrice"`
	IndexPrice adapters.Num `json:"indexPrice"`
	// LastFundingRate is, on Binance and Aster, the CURRENT-PERIOD estimate despite the name. WEEX
	// and Bullet send this same field as the last SETTLED rate and put the estimate elsewhere,
	// which is why PredictedRate is configurable.
	LastFundingRate adapters.Num `json:"lastFundingRate"`
	NextFundingTime adapters.Num `json:"nextFundingTime"`
	// ForecastFundingRate is WEEX's estimate for the period in progress.
	ForecastFundingRate adapters.Num `json:"forecastFundingRate"`
	// EstimatedFundingRate is Bullet's estimate for the hour in progress (its 8h rate / 8).
	EstimatedFundingRate adapters.Num `json:"estimatedFundingRate"`
	// CollectCycle is WEEX's settlement interval, in MINUTES. WEEX serves no fundingInfo.
	CollectCycle adapters.Num `json:"collectCycle"`
}

type FundingInfo struct {
	Symbol               string       `json:"symbol"`
	FundingIntervalHours adapters.Num `json:"fundingIntervalHours"`
}

type Ticker24h struct {
	Symbol      string       `json:"symbol"`
	QuoteVolume adapters.Num `json:"quoteVolume"`
}

// Symbol is one exchangeInfo row, with only the fields this family reads.
type Symbol struct {
	Symbol string `json:"symbol"`
	// Status is absent on every WEEX row, which is why tradability is pluggable rather than fixed.
	Status *string `json:"status"`
	// ContractType is PERPETUAL on Binance and Aster; Bullet's are CryptoPerp, RwaPerpUsEquity...
	ContractType string  `json:"contractType"`
	BaseAsset    *string `json:"baseAsset"`
	QuoteAsset   *string `json:"quoteAsset"`
	// UnderlyingType is Binance's and WEEX's declaration. A nil pointer means the field was absent,
	// which declares nothing; a value the venue's table does not know is NEW, which is a different
	// thing and must not default to crypto.
	UnderlyingType *string `json:"underlyingType"`
	// UnderlyingSubType carries Aster's class tags (STOCK, ETF, Commodities).
	UnderlyingSubType []string `json:"underlyingSubType"`
	// SymbolType is Aster's cross-check: 1 on exactly the rows its tags call tradfi.
	SymbolType int `json:"symbolType"`
}

type ExchangeInfo struct {
	Symbols []Symbol `json:"symbols"`
}

type FundingRate struct {
	Symbol      string       `json:"symbol"`
	FundingTime adapters.Num `json:"fundingTime"`
	FundingRate adapters.Num `json:"fundingRate"`
	MarkPrice   adapters.Num `json:"markPrice"`
}

type OpenInterest struct {
	Symbol string `json:"symbol"`
	// OpenInterest is in CONTRACTS.
	OpenInterest adapters.Num `json:"openInterest"`
	Time         adapters.Num `json:"time"`
}

// TradableSymbol is what exchangeInfo says about a market this family collects.
type TradableSymbol struct {
	QuoteAsset *string
	// AssetClass as the venue declares it; MarketRefFor settles equity against index and tokenised
	// gold from there.
	AssetClass core.AssetClass
	// Base is the venue's declared base where the symbol parser gets it wrong; nil keeps the parsed
	// one.
	Base *string
}

// Classifier reads what a family member declares an exchangeInfo row to be.
type Classifier func(Symbol) core.AssetClass

// Tradability decides which exchangeInfo rows are collected.
type Tradability func(Symbol) bool

// TimeUnit is the epoch unit a member sends. Bullet's history and open interest are microseconds.
type TimeUnit string

const (
	UnitMs TimeUnit = "ms"
	UnitUs TimeUnit = "us"
)

// PerpetualContractTypes are the contract types collected.
//
// TRADIFI_PERPETUAL is Binance's perpetual on a stock, ETF or commodity: 191 TRADING markets on
// 2026-09-14, gold, TSLA, SPY and Caterpillar among them, every one in premiumIndex and fundingInfo
// and funded like any other perpetual. Reading PERPETUAL alone silently dropped all of them.
// Quarterlies have no funding and stay out.
var PerpetualContractTypes = map[string]struct{}{
	"PERPETUAL":         {},
	"TRADIFI_PERPETUAL": {},
}

// IsTradingPerpetual is Binance's and Aster's reading: a perpetual contract type, status TRADING.
func IsTradingPerpetual(s Symbol) bool {
	if s.Status == nil || *s.Status != "TRADING" {
		return false
	}
	_, ok := PerpetualContractTypes[s.ContractType]
	return ok
}

// DeclaredBase is the canonical base from the venue's own baseAsset where it sends one.
//
// The symbol alone does not always split: Aster's CLUSD1 has a USD1 quote the parser does not know,
// which would leave CLUSD1 as the base and file crude oil as a single stock.
func DeclaredBase(s Symbol) string {
	if s.BaseAsset != nil && *s.BaseAsset != "" {
		return core.CanonicalBase(*s.BaseAsset)
	}
	return core.ParseVenueSymbol(s.Symbol).Base
}

// DeclaredMarketBase is the base to override the parsed one with, or nil where the parser already
// agrees with the venue.
//
// The rule and the evidence behind it live in adapters.DeclaredMarketBase, which five venues share.
// This wrapper is the binance-family plumbing: both fields are optional here, and absent is not the
// same as empty, so the nil check happens before the shared rule sees anything.
func DeclaredMarketBase(s Symbol) *string {
	if s.BaseAsset == nil || s.QuoteAsset == nil {
		return nil
	}
	declared := adapters.DeclaredMarketBase(s.Symbol, *s.BaseAsset, *s.QuoteAsset)
	if declared == "" {
		return nil
	}
	return &declared
}

// TradablePerpetuals is the collectable symbols, each with the class its venue declares.
func TradablePerpetuals(info ExchangeInfo, classify Classifier, isTradable Tradability) map[string]TradableSymbol {
	if isTradable == nil {
		isTradable = IsTradingPerpetual
	}
	out := make(map[string]TradableSymbol, len(info.Symbols))
	for _, s := range info.Symbols {
		if !isTradable(s) {
			continue
		}
		out[s.Symbol] = TradableSymbol{
			QuoteAsset: s.QuoteAsset,
			AssetClass: classify(s),
			Base:       DeclaredMarketBase(s),
		}
	}
	return out
}

// EpochMs converts a timestamp in the given unit to epoch milliseconds; nil where it is not a
// number.
func EpochMs(n adapters.Num, unit TimeUnit) *int64 {
	if !n.OK {
		return nil
	}
	ms := int64(n.Val)
	if unit == UnitUs {
		ms = int64(n.Val) / 1000
	}
	return &ms
}

// SnapshotInput is one cycle's bulk responses plus the configuration that reads them.
type SnapshotInput struct {
	Premium     []PremiumIndex
	FundingInfo []FundingInfo
	Tickers     []Ticker24h
	Tradable    map[string]TradableSymbol
	// DefaultIntervalHours is the interval for symbols missing from fundingInfo; nil skips them.
	// Null for every member measured so far: fundingInfo is not an exceptions-only list, and an 8h
	// default would be the wrong guess anyway, since 466 of Binance's 782 symbols settle 4-hourly.
	DefaultIntervalHours *float64
	// PredictedRate says which premiumIndex field holds the estimate for the period in progress.
	// Defaults to LastFundingRate, which is that estimate on Binance and Aster.
	PredictedRate func(PremiumIndex) adapters.Num
	// NextFundingTimeUnit is the unit of premiumIndex nextFundingTime; milliseconds unless given.
	NextFundingTimeUnit TimeUnit
}

// ParseSnapshots normalises one cycle's bulk responses into snapshots.
func ParseSnapshots(venueID string, input SnapshotInput, now int64) []core.FundingSnapshot {
	intervals := make(map[string]float64, len(input.FundingInfo))
	for _, info := range input.FundingInfo {
		if info.FundingIntervalHours.OK {
			intervals[info.Symbol] = info.FundingIntervalHours.Val
		}
	}
	volumes := make(map[string]adapters.Num, len(input.Tickers))
	for _, ticker := range input.Tickers {
		volumes[ticker.Symbol] = ticker.QuoteVolume
	}

	predicted := input.PredictedRate
	if predicted == nil {
		predicted = func(p PremiumIndex) adapters.Num { return p.LastFundingRate }
	}

	snapshots := make([]core.FundingSnapshot, 0, len(input.Premium))
	for _, p := range input.Premium {
		tradable, isTradable := input.Tradable[p.Symbol]
		rate := predicted(p)
		if !isTradable || !rate.OK {
			continue
		}

		interval, known := intervals[p.Symbol]
		if !known {
			if input.DefaultIntervalHours == nil {
				continue
			}
			interval = *input.DefaultIntervalHours
		}
		if interval <= 0 {
			continue
		}

		overrides := adapters.Overrides{AssetClass: &tradable.AssetClass}
		if tradable.QuoteAsset != nil {
			overrides.Quote = tradable.QuoteAsset
			overrides.HasQuote = true
		}
		if tradable.Base != nil {
			overrides.Base = tradable.Base
		}

		next := EpochMs(p.NextFundingTime, input.NextFundingTimeUnit)
		if next != nil && *next <= 0 {
			next = nil
		}
		intervalHours := interval

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     adapters.MarketRefFor(venueID, p.Symbol, overrides),
			ObservedAt:    now,
			Rate:          rate.Val,
			BasisHours:    interval,
			IntervalHours: &intervalHours,
			NextFundingAt: next,
			Kind:          core.KindPredicted,
			MarkPrice:     p.MarkPrice.Ptr(),
			IndexPrice:    p.IndexPrice.Ptr(),
			// Binance-style APIs expose open interest only per symbol, so it is filled by
			// AttachOpenInterest from the rotating cache rather than in the bulk cycle.
			OpenInterestUSD: nil,
			Volume24hUSD:    volumes[p.Symbol].Ptr(),
		})
	}
	return snapshots
}

// IntervalsFromPremiumIndex reads fundingInfo-shaped intervals off premiumIndex rows, for a member
// with no fundingInfo endpoint (WEEX, whose interval is `collectCycle` in minutes).
func IntervalsFromPremiumIndex(premium []PremiumIndex, hours func(PremiumIndex) *float64) []FundingInfo {
	out := make([]FundingInfo, 0, len(premium))
	for _, p := range premium {
		h := hours(p)
		if h == nil || *h <= 0 {
			continue
		}
		out = append(out, FundingInfo{
			Symbol:               p.Symbol,
			FundingIntervalHours: adapters.Num{Val: *h, OK: true},
		})
	}
	return out
}

// OpenInterestEntry is one symbol's place in the rotating sweep: what was read, and when.
//
// One entry, not two maps. The count and the timestamp are read by different things — the pricing
// below and SelectRefreshBatch respectively — and splitting them let a function take a cache it
// never looked at, which compiles silently because Go does not flag unused parameters.
type OpenInterestEntry struct {
	// Contracts is the venue's own figure, in contracts.
	Contracts float64
	FetchedAt int64
}

// AttachOpenInterest fills in open interest from the rotating cache.
//
// A contract covers `multiplier` units of the base asset and the venue quotes its price per
// contract, so contracts x that price is USD either way. This runs before the collector rescales
// prices per base unit, so MarkPrice is still the venue's own.
func AttachOpenInterest(snapshots []core.FundingSnapshot, cache map[string]OpenInterestEntry) []core.FundingSnapshot {
	for i := range snapshots {
		entry, known := cache[snapshots[i].VenueSymbol]
		if !known {
			continue
		}
		// A symbol not yet in the rotation keeps a null rather than a wrong number.
		if usd := adapters.Mul(&entry.Contracts, snapshots[i].MarkPrice); usd != nil {
			snapshots[i].OpenInterestUSD = usd
		}
	}
	return snapshots
}

// BasisHoursFromGaps moved to internal/adapters: three venues need it (this family, htx and
// pionex), and it reads timestamps rather than anything Binance-specific, so a venue package was
// the wrong home. Call adapters.BasisHoursFromGaps.

// HistoryOptions configures how settled rates are read.
type HistoryOptions struct {
	// TimeUnit of fundingTime; milliseconds unless given.
	TimeUnit TimeUnit
	// BasisHours is the period every settled rate is quoted over, where the venue fixes it
	// independently of how often it settles. Bullet settles hourly but quotes each settlement as an
	// 8h rate, so reading the basis off the 1h gaps would overstate its funding eightfold. Nil means
	// the basis is the gap.
	BasisHours *float64
}

// ParseFundingHistory normalises settled rates, oldest first.
func ParseFundingHistory(
	venueID, venueSymbol string,
	rows []FundingRate,
	fromMs, toMs int64,
	fallbackHours *float64,
	assetClass *core.AssetClass,
	options HistoryOptions,
) []core.FundingEvent {
	byTime := make(map[int64]FundingRate, len(rows))
	for _, row := range rows {
		at := EpochMs(row.FundingTime, options.TimeUnit)
		if at == nil || *at < fromMs || *at > toMs || !row.FundingRate.OK {
			continue
		}
		byTime[*at] = row
	}

	times := make([]int64, 0, len(byTime))
	for at := range byTime {
		times = append(times, at)
	}
	sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })

	var basis []*float64
	if options.BasisHours != nil {
		basis = make([]*float64, len(times))
		for i := range basis {
			basis[i] = options.BasisHours
		}
	} else {
		basis = adapters.BasisHoursFromGaps(times, fallbackHours)
	}

	overrides := adapters.Overrides{}
	if assetClass != nil {
		overrides.AssetClass = assetClass
	}
	ref := adapters.MarketRefFor(venueID, venueSymbol, overrides)

	events := make([]core.FundingEvent, 0, len(times))
	for i, at := range times {
		if basis[i] == nil {
			continue
		}
		row := byTime[at]
		events = append(events, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  at,
			Rate:       row.FundingRate.Val,
			BasisHours: *basis[i],
			MarkPrice:  row.MarkPrice.Ptr(),
		})
	}
	return events
}

// ---- per-venue declarations ----

// AsterAssetClass reads Aster's `underlyingSubType` tags.
//
// Aster's underlyingType is COIN on all 574 TRADING perpetuals, stocks and gold included, so the
// field Binance declares in carries nothing here; the tags do. symbolType is the cross-check: it is
// 1 on exactly the 128 rows those tags call tradfi, across all 594 rows. So a row flagged 1 whose
// tags are new to us is tradfi of a kind we cannot read, and goes to ClassifyNonCrypto rather than
// defaulting to crypto. The reverse never happens: a row flagged 0 is crypto whatever its ticker,
// which is what keeps RTXUSDT (RateX) apart from Raytheon.
func AsterAssetClass(s Symbol) core.AssetClass {
	for _, tag := range s.UnderlyingSubType {
		if tag == "Commodities" {
			return core.ClassCommodity
		}
	}
	for _, tag := range s.UnderlyingSubType {
		if tag == "STOCK" || tag == "ETF" {
			return core.ClassEquity
		}
	}
	if s.SymbolType == 1 {
		return core.ClassifyNonCrypto(DeclaredBase(s))
	}
	return core.ClassCrypto
}

// declaredByUnderlyingType is the shape Binance and WEEX share: a table over `underlyingType`, where
// an ABSENT field declares nothing (crypto) and an UNKNOWN value is new and must not default to
// crypto. A TRADIFI_PERPETUAL is never crypto whatever the type says, so a stock index filed as
// INDEX cannot land in a crypto pool.
func declaredByUnderlyingType(s Symbol, table map[string]core.AssetClass) core.AssetClass {
	var declared core.AssetClass
	found := false
	if s.UnderlyingType == nil {
		declared, found = core.ClassCrypto, true
	} else if class, ok := table[*s.UnderlyingType]; ok {
		declared, found = class, true
	}
	tradfi := s.ContractType == "TRADIFI_PERPETUAL"
	if found && !(tradfi && declared == core.ClassCrypto) {
		return declared
	}
	return core.ClassifyNonCrypto(DeclaredBase(s))
}

// binanceUnderlyingTypes: INDEX is crypto — its rows are BTCDOMUSDT and ALLUSDT, baskets of coins,
// not stock indices. PREMARKET is equity: OPENAI and ANTHROPIC, pre-IPO shares. PAXG is COIN.
var binanceUnderlyingTypes = map[string]core.AssetClass{
	"COIN": core.ClassCrypto, "INDEX": core.ClassCrypto,
	"EQUITY": core.ClassEquity, "HK_EQUITY": core.ClassEquity, "KR_EQUITY": core.ClassEquity,
	"CN_EQUITY": core.ClassEquity, "PREMARKET": core.ClassEquity,
	"COMMODITY": core.ClassCommodity,
}

// BinanceAssetClass is how CATUSDT (EQUITY, Caterpillar at 817) and 1000CATUSDT (COIN, a memecoin)
// stay apart under the same CAT base, and how BBUSDT stays BounceBit.
func BinanceAssetClass(s Symbol) core.AssetClass {
	return declaredByUnderlyingType(s, binanceUnderlyingTypes)
}

// weexUnderlyingTypes: "Indices" is WEEX's word for index AND ETF — SP500 and NAS100 sit beside SPY
// and QQQ, and MarketRefFor's refine settles which is which. "Metals" holds PAXG and XAUT, which the
// refine returns to crypto as tokens.
var weexUnderlyingTypes = map[string]core.AssetClass{
	"COIN": core.ClassCrypto, "Stocks": core.ClassEquity, "Pre-IPO": core.ClassEquity,
	"Indices": core.ClassIndex, "Metals": core.ClassCommodity,
	"Commodities": core.ClassCommodity, "Forex": core.ClassFX,
}

func WeexAssetClass(s Symbol) core.AssetClass {
	return declaredByUnderlyingType(s, weexUnderlyingTypes)
}

// IsWeexTradable: WEEX lists no status at all — the key is absent on all 1,016 rows, so Binance's
// TRADING test collects nothing. Nothing else in a row says a market is halted, so the contract type
// is the whole rule. A status WEEX starts sending later is still honoured.
func IsWeexTradable(s Symbol) bool {
	if _, ok := PerpetualContractTypes[s.ContractType]; !ok {
		return false
	}
	return s.Status == nil || *s.Status == "TRADING"
}

var rwaEquityType = regexp.MustCompile(`^RwaPerp[A-Za-z]*Equity$`)

// BulletAssetClass reads `contractType`: underlyingType is COIN on all 19 rows, TSLA and GOLD
// included, so it declares nothing. An RwaPerp type not listed is real-world of a kind we cannot
// read, so ClassifyNonCrypto places it rather than defaulting to crypto.
func BulletAssetClass(s Symbol) core.AssetClass {
	switch {
	case s.ContractType == "CryptoPerp":
		return core.ClassCrypto
	case s.ContractType == "RwaPerpUsEquityIndices":
		return core.ClassIndex
	case s.ContractType == "RwaPerpCommodities":
		return core.ClassCommodity
	case rwaEquityType.MatchString(s.ContractType):
		return core.ClassEquity
	case len(s.ContractType) >= 7 && s.ContractType[:7] == "RwaPerp":
		return core.ClassifyNonCrypto(DeclaredBase(s))
	default:
		return core.ClassCrypto
	}
}

// IsBulletTradable: Bullet's contract types are never PERPETUAL, only CryptoPerp and RwaPerp*.
func IsBulletTradable(s Symbol) bool {
	if s.Status == nil || *s.Status != "TRADING" {
		return false
	}
	return s.ContractType == "CryptoPerp" ||
		(len(s.ContractType) >= 7 && s.ContractType[:7] == "RwaPerp")
}
