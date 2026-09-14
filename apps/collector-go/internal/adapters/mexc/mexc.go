// Package mexc parses MEXC's contract (perpetual swap) market data.
//
// Ported from packages/adapters/src/venues/mexc.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/mexc) and the same expected values as mexc.test.ts, so the Go and
// TypeScript parsers cannot drift apart while both are collecting.
package mexc

import (
	"fmt"
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "mexc"

const hourMs int64 = 3_600_000

const (
	// ContractsMaxAgeMs: contract details are ~2 MB, so they're refreshed at most hourly.
	ContractsMaxAgeMs = hourMs
	// IntervalRefreshBudget is per-symbol funding_rate calls allowed per FetchSnapshots (MEXC allows
	// 20 requests / 2s).
	IntervalRefreshBudget = 40
	// IntervalMaxAgeMs: settlement intervals rarely change; re-check each symbol this often.
	IntervalMaxAgeMs = 6 * hourMs
	// liveState is `state` in contract details: 0 = enabled (1 delivery, 2 delivered, 3 offline,
	// 4 paused).
	liveState = 0
)

// Envelope is MEXC's uniform response wrapper.
//
// Data is a pointer so that an absent or null `data` is distinguishable from an empty one, which is
// what the TypeScript `data === undefined || data === null` guard turns into a thrown error: a
// response that lost its payload must fail the cycle rather than read as a venue with nothing listed.
type Envelope[T any] struct {
	Success bool   `json:"success"`
	Code    int    `json:"code"`
	Data    *T     `json:"data"`
	Message string `json:"message"`
}

func (e Envelope[T]) unwrap(what string) (T, error) {
	if !e.Success || e.Data == nil {
		var zero T
		return zero, fmt.Errorf("%s: %s failed (code %d)", VenueID, what, e.Code)
	}
	return *e.Data, nil
}

type Ticker struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"fundingRate"`
	FairPrice   adapters.Num `json:"fairPrice"`
	IndexPrice  adapters.Num `json:"indexPrice"`
	// HoldVol is open interest in contracts.
	HoldVol adapters.Num `json:"holdVol"`
	// Amount24 is 24h turnover in quote currency.
	Amount24 adapters.Num `json:"amount24"`
}

// RiskLimitLevel is one enumerated band of a CUSTOM contract's risk ladder.
type RiskLimitLevel struct {
	Level       int          `json:"level"`
	MaxVol      adapters.Num `json:"maxVol"`
	MMR         adapters.Num `json:"mmr"`
	IMR         adapters.Num `json:"imr"`
	MaxLeverage adapters.Num `json:"maxLeverage"`
}

type ContractDetail struct {
	Symbol   string `json:"symbol"`
	BaseCoin string `json:"baseCoin"`
	// BaseCoinName is the underlying MEXC displays, where it differs from the contract code:
	// `MUSTOCK` is shown as `MU`, matching its own UI. 383 of 1192 contracts differ. Absent or equal
	// to `baseCoin` means the venue is not offering a different name -- which on the 13 colliding
	// `*STOCK` tickers is a deliberate signal, not a gap. See adapters.ResolveDeclaredBase.
	BaseCoinName string `json:"baseCoinName"`
	QuoteCoin    string `json:"quoteCoin"`
	SettleCoin   string `json:"settleCoin"`
	// ContractSize is base units per contract; USD per contract for coin-settled (inverse) contracts.
	ContractSize adapters.Num `json:"contractSize"`
	State        int          `json:"state"`
	// RiskLimitCustom is the risk ladder, enumerated. Despite `riskLimitType: "BY_VOLUME"`, `maxVol`
	// is quote notional, not contracts: read as contracts, BTC_USDT's first band would be ~$386k at
	// 500x, and its top band a $147m position cap, neither of which any venue offers.
	//
	// Only "CUSTOM" contracts carry this -- 157 of 1192 -- and the rest are "INCREASE".
	RiskLimitCustom []RiskLimitLevel `json:"riskLimitCustom"`
	// RiskLimitMode: "CUSTOM" enumerates RiskLimitCustom; "INCREASE" gives only the base rates below.
	RiskLimitMode string `json:"riskLimitMode"`
	// RiskBaseVol is the largest position the contract carries, in quote notional. Same unit as
	// `maxVol`: on every CUSTOM contract the two are equal (BTC 19,000,000, ETH 4,800,000, DOGE
	// 530,000).
	RiskBaseVol           adapters.Num `json:"riskBaseVol"`
	InitialMarginRate     adapters.Num `json:"initialMarginRate"`
	MaintenanceMarginRate adapters.Num `json:"maintenanceMarginRate"`
	MaxLeverage           adapters.Num `json:"maxLeverage"`
	// ConceptPlate holds trading-zone plates, e.g. "mc-trade-zone-Stock". Carries the asset class;
	// see DeclaredClass.
	ConceptPlate []string `json:"conceptPlate"`
	// Type is the contract type: 2 is tradfi (430 of 1192), 1 everything else, including some tradfi.
	Type int `json:"type"`
}

type FundingRate struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"fundingRate"`
	// CollectCycle is the settlement interval in hours.
	CollectCycle   adapters.Num `json:"collectCycle"`
	NextSettleTime adapters.Num `json:"nextSettleTime"`
}

type FundingHistoryRow struct {
	Symbol       string       `json:"symbol"`
	FundingRate  adapters.Num `json:"fundingRate"`
	SettleTime   adapters.Num `json:"settleTime"`
	CollectCycle adapters.Num `json:"collectCycle"`
}

type FundingHistoryPage struct {
	CurrentPage int                 `json:"currentPage"`
	TotalPage   int                 `json:"totalPage"`
	ResultList  []FundingHistoryRow `json:"resultList"`
}

// IntervalEntry is one symbol's cached settlement interval.
//
// NextSettleTime is a pointer rather than a zero value because the TypeScript side stores
// `num(nextSettleTime)`, which keeps a genuine 0 as 0 and only a missing field as null -- and
// NextSettlementAfter rolls a 0 forward by whole intervals rather than treating it as absent.
type IntervalEntry struct {
	Hours          float64
	NextSettleTime *int64
	FetchedAt      int64
}

// ParseContracts is live contracts by symbol.
func ParseContracts(details []ContractDetail) map[string]ContractDetail {
	live := make(map[string]ContractDetail, len(details))
	for _, detail := range details {
		if detail.State == liveState {
			live[detail.Symbol] = detail
		}
	}
	return live
}

const platePrefix = "mc-trade-zone-"

const tradfiType = 2

var commodityPlates = map[string]struct{}{
	"commodities": {}, "metals": {}, "metalsfutures": {}, "oil": {},
}

var equityPlates = map[string]struct{}{
	"etf": {}, "japanstock": {}, "preipo": {}, "stock": {},
}

// DeclaredClass is the class MEXC declares for a contract, from its trading-zone plates in
// `conceptPlate`.
//
// MEXC puts every tradfi contract on the `tradfi` plate (455 of 1192 live on 2026-09-14) and says
// which kind with another: `OIL`, `Commodities`, `metals` or `metalsfutures` (22 commodity), `Forex`
// (8 fx), `stockindex` without `ETF` (11 index; the other 54 `stockindex` contracts are ETFs), and
// `Stock`, `ETF`, `japanstock` or `preipo` (414 equity). The remaining 737 are crypto. Plates are
// spelt in mixed case, so they are matched without it.
//
// The order matters because plates overlap: SPX500 carries `Stock` and `stockindex`, OPENAI `Stock`
// and `preipo`. A contract that is `tradfi`, or `type` 2, with none of those plates says only "not
// crypto", so the base tables settle it; none did on 2026-09-14.
//
// Neither `robinhood` nor `RWA` is tradfi: they hold Robinhood-chain memecoins (PONS) and RWA-sector
// tokens (ONDO, and QNT the Quant token), all crypto. `base` is the canonical base, used only for
// that fallback.
func DeclaredClass(detail ContractDetail, base string) core.AssetClass {
	plates := make(map[string]struct{}, len(detail.ConceptPlate))
	for _, plate := range detail.ConceptPlate {
		lower := strings.ToLower(strings.TrimSpace(plate))
		plates[strings.TrimPrefix(lower, platePrefix)] = struct{}{}
	}
	onAny := func(names map[string]struct{}) bool {
		for plate := range plates {
			if _, ok := names[plate]; ok {
				return true
			}
		}
		return false
	}
	has := func(name string) bool {
		_, ok := plates[name]
		return ok
	}

	switch {
	case onAny(commodityPlates):
		return core.ClassCommodity
	case has("forex"):
		return core.ClassFX
	case has("stockindex") && !has("etf"):
		return core.ClassIndex
	case onAny(equityPlates):
		return core.ClassEquity
	case has("tradfi") || detail.Type == tradfiType:
		return core.ClassifyNonCrypto(base)
	}
	return core.ClassCrypto
}

// ParseLeverageTiers reads risk ladders from the bulk contract detail, which the snapshot loop
// already fetches hourly.
//
// `maxVol` is a cumulative upper bound in quote notional, so each band starts where the last ended,
// and the top band's bound is a real cap -- it equals the contract's `riskBaseVol`, the largest
// position MEXC will carry.
func ParseLeverageTiers(details []ContractDetail) []core.LeverageTier {
	ladders := make([]core.LeverageTier, 0, len(details))

	for _, detail := range details {
		if detail.State != liveState {
			continue
		}
		levels := detail.RiskLimitCustom

		// "INCREASE" contracts -- 1035 of 1192 -- enumerate nothing. They give a base margin rate and
		// a cap, and `riskLevelLimit: 1` says there is only ever one band, so that is what they become.
		if len(levels) == 0 {
			positionCap := detail.RiskBaseVol
			imr := detail.InitialMarginRate
			maxLeverage := detail.MaxLeverage
			if !positionCap.OK || positionCap.Val <= 0 || !imr.OK || imr.Val <= 0 ||
				!maxLeverage.OK || maxLeverage.Val <= 0 {
				continue
			}
			upper := positionCap.Val
			ladders = append(ladders, core.LeverageTier{
				VenueID:          VenueID,
				VenueSymbol:      detail.Symbol,
				Tier:             1,
				LowerNotionalUSD: 0,
				UpperNotionalUSD: &upper,
				IMR:              imr.Val,
				MMR:              detail.MaintenanceMarginRate.Ptr(),
				MaxLeverage:      maxLeverage.Val,
			})
			continue
		}

		sorted := append([]RiskLimitLevel(nil), levels...)
		sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Level < sorted[j].Level })

		ladder := make([]core.LeverageTier, 0, len(sorted))
		lowerNotionalUSD := 0.0
		usable := true

		for _, level := range sorted {
			upper := level.MaxVol
			imr := level.IMR
			maxLeverage := level.MaxLeverage
			if !upper.OK || upper.Val <= lowerNotionalUSD || !imr.OK || imr.Val <= 0 ||
				!maxLeverage.OK || maxLeverage.Val <= 0 {
				usable = false
				break
			}
			upperNotionalUSD := upper.Val
			ladder = append(ladder, core.LeverageTier{
				VenueID:          VenueID,
				VenueSymbol:      detail.Symbol,
				Tier:             level.Level,
				LowerNotionalUSD: lowerNotionalUSD,
				UpperNotionalUSD: &upperNotionalUSD,
				IMR:              imr.Val,
				MMR:              level.MMR.Ptr(),
				MaxLeverage:      maxLeverage.Val,
			})
			lowerNotionalUSD = upper.Val
		}
		if usable {
			ladders = append(ladders, ladder...)
		}
	}
	return ladders
}

// ParseFundingRate reads one symbol's settlement interval, or nil when the venue does not state one.
func ParseFundingRate(data FundingRate, now int64) *IntervalEntry {
	hours := data.CollectCycle
	if !hours.OK || hours.Val <= 0 {
		return nil
	}
	var nextSettleTime *int64
	if data.NextSettleTime.OK {
		ms := int64(data.NextSettleTime.Val)
		nextSettleTime = &ms
	}
	return &IntervalEntry{Hours: hours.Val, NextSettleTime: nextSettleTime, FetchedAt: now}
}

// SelectIntervalRefreshes is which symbols to fetch funding_rate for this cycle: never-fetched
// symbols first (in the given order), then entries older than maxAgeMs, oldest first, capped at
// budget.
func SelectIntervalRefreshes(
	symbols []string,
	cache map[string]IntervalEntry,
	now int64,
	budget int,
	maxAgeMs int64,
) []string {
	return adapters.SelectRefreshBatch(symbols, func(symbol string) (int64, bool) {
		entry, ok := cache[symbol]
		return entry.FetchedAt, ok
	}, now, budget, maxAgeMs)
}

// NextSettlementAfter is a cached next settlement time rolled forward past `now` by whole intervals.
func NextSettlementAfter(nextSettleTime *int64, hours float64, now int64) *int64 {
	if nextSettleTime == nil {
		return nil
	}
	if *nextSettleTime > now {
		next := *nextSettleTime
		return &next
	}
	step := hours * float64(hourMs)
	steps := float64(int64(float64(now-*nextSettleTime) / step))
	next := *nextSettleTime + int64((steps+1)*step)
	return &next
}

// ParseSnapshots returns snapshots for tickers that are live contracts with a known settlement
// interval.
func ParseSnapshots(
	tickers []Ticker,
	contracts map[string]ContractDetail,
	intervals map[string]IntervalEntry,
	now int64,
) []core.FundingSnapshot {
	snapshots := make([]core.FundingSnapshot, 0, len(tickers))
	for _, ticker := range tickers {
		contract, live := contracts[ticker.Symbol]
		interval, known := intervals[ticker.Symbol]
		if !live || !known || !ticker.FundingRate.OK {
			continue
		}

		mark := ticker.FairPrice.Ptr()
		// Coin-settled contracts (BTC_USD settles in BTC) are sized in USD and report turnover in the
		// coin.
		coinSettled := contract.SettleCoin != "" && contract.SettleCoin == contract.BaseCoin

		quote := contract.QuoteCoin
		declared := adapters.Overrides{Quote: &quote, HasQuote: true}
		// An empty declaration leaves the parsed base in place, so contracts MEXC says nothing about
		// are untouched. MarketRefFor canonicalises whatever lands here, so SP500 reaches US500.
		if base := adapters.ResolveDeclaredBase(contract.BaseCoin, contract.BaseCoinName); base != "" {
			declared.Base = &base
		}
		// The class fallback needs the canonical base (MOONSHOT, NATGAS), which only MarketRefFor
		// settles.
		class := DeclaredClass(contract, adapters.MarketRefFor(VenueID, ticker.Symbol, declared).Base)
		withClass := declared
		withClass.AssetClass = &class

		hours := interval.Hours
		var openInterestUSD, volume24hUSD *float64
		if coinSettled {
			openInterestUSD = adapters.Mul(ticker.HoldVol.Ptr(), contract.ContractSize.Ptr())
			volume24hUSD = adapters.Mul(ticker.Amount24.Ptr(), mark)
		} else {
			openInterestUSD = adapters.Mul(ticker.HoldVol.Ptr(), contract.ContractSize.Ptr(), mark)
			volume24hUSD = ticker.Amount24.Ptr()
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       adapters.MarketRefFor(VenueID, ticker.Symbol, withClass),
			ObservedAt:      now,
			Rate:            ticker.FundingRate.Val,
			BasisHours:      hours,
			IntervalHours:   &hours,
			NextFundingAt:   NextSettlementAfter(interval.NextSettleTime, hours, now),
			Kind:            core.KindPredicted,
			MarkPrice:       mark,
			IndexPrice:      ticker.IndexPrice.Ptr(),
			OpenInterestUSD: openInterestUSD,
			Volume24hUSD:    volume24hUSD,
		})
	}
	return snapshots
}

// ParseFundingHistory returns settled payments within [fromMs, toMs], oldest first, one per
// settlement time.
func ParseFundingHistory(
	items []FundingHistoryRow,
	venueSymbol string,
	fromMs, toMs int64,
) []core.FundingEvent {
	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(items))
	for _, item := range items {
		if !item.SettleTime.OK || !item.FundingRate.OK || !item.CollectCycle.OK || item.CollectCycle.Val <= 0 {
			continue
		}
		settledAt := int64(item.SettleTime.Val)
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{}),
			SettledAt:  settledAt,
			Rate:       item.FundingRate.Val,
			BasisHours: item.CollectCycle.Val,
			MarkPrice:  nil,
		}
	}

	settlements := make([]int64, 0, len(bySettlement))
	for settledAt := range bySettlement {
		settlements = append(settlements, settledAt)
	}
	sort.Slice(settlements, func(i, j int) bool { return settlements[i] < settlements[j] })

	events := make([]core.FundingEvent, 0, len(settlements))
	for _, settledAt := range settlements {
		events = append(events, bySettlement[settledAt])
	}
	return events
}
