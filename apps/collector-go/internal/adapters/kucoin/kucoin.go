// Package kucoin parses KuCoin Futures' perpetual market data.
//
// Ported from packages/adapters/src/venues/kucoin.ts. Two things about this venue differ from every
// other adapter here and are easy to get wrong:
//
//   - Symbols carry a trailing M (XBTUSDTM), and XBT is KuCoin's spelling of BTC. Both are handled
//     by core.ParseVenueSymbol and core.CanonicalBase, so the symbol is never split here.
//   - The funding interval is reported in MILLISECONDS (28,800,000 for 8h), not minutes as Bybit
//     does or hours as Bitget does.
package kucoin

import (
	"fmt"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "kucoin"

const (
	msPerHour = 3_600_000.0

	// ok is KuCoin's success code. Anything else carries a message and no usable data, including
	// rate limits, which arrive as 429000 inside an HTTP 200.
	ok = "200000"

	// perpetual is KuCoin's type code for perpetual swaps; "FFICSX" is dated futures.
	perpetual = "FFWCSX"
)

// Envelope is KuCoin's uniform response wrapper.
type Envelope[T any] struct {
	Code string `json:"code"`
	Msg  string `json:"msg"`
	Data T      `json:"data"`
}

// unwrap returns the payload, or an error when KuCoin reported a failure code.
//
// A list payload needs no separate accessor the way the TypeScript's `unwrapList` does: KuCoin
// answers `data: null` rather than `[]` when a window holds no rows, which the backfill hits
// constantly — a symbol listed last week has nothing 90 days back — and JSON null decodes to a nil
// slice, which ranges as empty. That is an empty result, not a failure, and returning it lets the
// caller mark the market exhausted instead of retrying forever. On the TypeScript side the same null
// threw "Spread syntax requires ...iterable" in production until it was handled.
func (e Envelope[T]) unwrap(what string) (T, error) {
	if e.Code != ok {
		var zero T
		return zero, fmt.Errorf("kucoin %s: %s %s", what, e.Code, e.Msg)
	}
	return e.Data, nil
}

type Contract struct {
	Symbol string `json:"symbol"`
	Type   string `json:"type"`
	Status string `json:"status"`
	// IsInverse marks the coin-margined contracts, which this adapter skips.
	IsInverse bool `json:"isInverse"`
	// FundingFeeRate is the rate for the current funding period.
	FundingFeeRate adapters.Num `json:"fundingFeeRate"`
	// CurrentFundingRateGranularity is the interval in MILLISECONDS; absent on some symbols, where
	// FundingRateGranularity still holds it.
	CurrentFundingRateGranularity adapters.Num `json:"currentFundingRateGranularity"`
	FundingRateGranularity        adapters.Num `json:"fundingRateGranularity"`
	NextFundingRateDateTime       adapters.Num `json:"nextFundingRateDateTime"`
	// LastTimeFundingRate is the rate settled at the previous funding time.
	LastTimeFundingRate adapters.Num `json:"lastTimeFundingRate"`
	MarkPrice           adapters.Num `json:"markPrice"`
	IndexPrice          adapters.Num `json:"indexPrice"`
	// OpenInterest is LOTS, quoted as a string. Multiplier converts a lot to base units.
	OpenInterest adapters.Num `json:"openInterest"`
	// Multiplier is base units per lot for linear contracts.
	Multiplier adapters.Num `json:"multiplier"`
	// MaxLeverage is the headline figure; /contracts/risk-limit/{symbol} is the precise, size-aware
	// source.
	MaxLeverage   adapters.Num `json:"maxLeverage"`
	TurnoverOf24h adapters.Num `json:"turnoverOf24h"`
	// AssetClass is what the contract tracks: "CRYPTO", "STOCK", "METAL" or "COMMODITY".
	AssetClass string `json:"assetClass"`
}

// AssetClassFor is the class KuCoin declares for a contract, from `assetClass` on
// /api/v1/contracts/active.
//
// Live 2026-09-14, 687 contracts: CRYPTO 532, STOCK 146, METAL 6, COMMODITY 3. It separates
// BBXUSDTM and QNTXUSDTM (stocks) from BBUSDTM and QNTUSDTM (crypto), and files CL, BZ and NATGAS
// as commodities. `marketType` is NOT a substitute: it reads CRYPTO on every METAL and COMMODITY
// row. PAXG and XAUT are declared METAL and returned to crypto by MarketRefFor. A missing field is
// undeclared, so crypto; a value this does not know still says not-crypto, so the base tables
// settle which class.
//
// Go cannot tell an absent string from an empty one, so "" is read as undeclared. The TypeScript's
// `?? "CRYPTO"` would send a literal empty string down the unknown branch instead; KuCoin publishes
// no such value, and reading a field it does not send as crypto is the same default every other
// undeclared venue gets.
func AssetClassFor(declared, base string) core.AssetClass {
	switch declared {
	case "", "CRYPTO":
		return core.ClassCrypto
	case "STOCK":
		return core.ClassEquity
	case "METAL", "COMMODITY":
		return core.ClassCommodity
	default:
		return core.ClassifyNonCrypto(core.CanonicalBase(base))
	}
}

type RiskLimit struct {
	Symbol string       `json:"symbol"`
	Level  adapters.Num `json:"level"`
	// MaxRiskLimit is quote notional, the inclusive upper bound of the band.
	MaxRiskLimit adapters.Num `json:"maxRiskLimit"`
	// MinRiskLimit is quote notional; it equals the previous level's MaxRiskLimit, so bands are
	// already contiguous.
	MinRiskLimit   adapters.Num `json:"minRiskLimit"`
	MaxLeverage    adapters.Num `json:"maxLeverage"`
	InitialMargin  adapters.Num `json:"initialMargin"`
	MaintainMargin adapters.Num `json:"maintainMargin"`
}

type FundingHistoryItem struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"fundingRate"`
	Timepoint   adapters.Num `json:"timepoint"`
}

// granularityMs is the funding interval in MILLISECONDS, or nil when the contract publishes none.
func granularityMs(contract Contract) *float64 {
	ms := contract.CurrentFundingRateGranularity
	if !ms.OK {
		ms = contract.FundingRateGranularity
	}
	if !ms.OK || ms.Val <= 0 {
		return nil
	}
	v := ms.Val
	return &v
}

// ParseSnapshots normalises one /contracts/active response into snapshots and the settlements that
// arrive free with it.
func ParseSnapshots(env Envelope[[]Contract], now int64) (core.SnapshotBatch, error) {
	contracts, err := env.unwrap("contracts")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	snapshots := make([]core.FundingSnapshot, 0, len(contracts))
	settled := make([]core.FundingEvent, 0, len(contracts))

	for _, contract := range contracts {
		if contract.Type != perpetual || contract.IsInverse || contract.Status != "Open" {
			continue
		}
		intervalMs := granularityMs(contract)
		if intervalMs == nil || !contract.FundingFeeRate.OK {
			continue
		}

		hours := *intervalMs / msPerHour
		base := adapters.MarketRefFor(VenueID, contract.Symbol, adapters.Overrides{}).Base
		class := AssetClassFor(contract.AssetClass, base)
		ref := adapters.MarketRefFor(VenueID, contract.Symbol, adapters.Overrides{AssetClass: &class})

		// PositiveMs rather than a plain number, so a venue reporting 0 for "no next funding" is read
		// as absent. Carrying a zero through would date the settlement below at minus one interval.
		nextFundingAt := contract.NextFundingRateDateTime.PositiveMs()
		markPrice := contract.MarkPrice.Ptr()

		interval := hours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          contract.FundingFeeRate.Val,
			BasisHours:    hours,
			IntervalHours: &interval,
			NextFundingAt: nextFundingAt,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    contract.IndexPrice.Ptr(),
			// Open interest is LOTS: 11,784,994 lots of XBTUSDTM at 0.001 BTC a lot is 11,785 BTC.
			// Reading the lot count as coin would be three orders of magnitude out.
			OpenInterestUSD: adapters.Mul(contract.OpenInterest.Ptr(), contract.Multiplier.Ptr(), markPrice),
			Volume24hUSD:    contract.TurnoverOf24h.Ptr(),
			MaxLeverage:     contract.MaxLeverage.Ptr(),
		})

		if contract.LastTimeFundingRate.OK && nextFundingAt != nil {
			settled = append(settled, core.FundingEvent{
				MarketRef:  ref,
				SettledAt:  *nextFundingAt - int64(*intervalMs),
				Rate:       contract.LastTimeFundingRate.Val,
				BasisHours: hours,
				MarkPrice:  nil,
			})
		}
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}, nil
}

// ParseRiskLimits converts KuCoin's risk ladders, one per symbol.
//
// KuCoin publishes BOTH bounds, and level n's MinRiskLimit equals level n-1's MaxRiskLimit, so no
// floor has to be inferred the way Bybit's and Gate's do. Bounds are quote notional, not lots:
// InitialMargin 0.008 is exactly 1/125, matching MaxLeverage, and read as lots XBTUSDTM's first band
// would be a $19m position at 125x, which no venue offers.
//
// Symbols keep the order they first appear in, which a Go map would not: the TypeScript walks a Map
// in insertion order, and a ladder's position in the output is the venue's own ordering.
func ParseRiskLimits(rows []RiskLimit) []core.LeverageTier {
	order := make([]string, 0, len(rows))
	bySymbol := make(map[string][]RiskLimit, len(rows))
	for _, row := range rows {
		if _, seen := bySymbol[row.Symbol]; !seen {
			order = append(order, row.Symbol)
		}
		bySymbol[row.Symbol] = append(bySymbol[row.Symbol], row)
	}

	ladders := make([]core.LeverageTier, 0, len(rows))
	for _, symbol := range order {
		symbolRows := make([]RiskLimit, len(bySymbol[symbol]))
		copy(symbolRows, bySymbol[symbol])
		sort.SliceStable(symbolRows, func(i, j int) bool { return symbolRows[i].Level.Val < symbolRows[j].Level.Val })

		ladder := make([]core.LeverageTier, 0, len(symbolRows))
		usable := true
		for _, row := range symbolRows {
			if !row.MinRiskLimit.OK || !row.MaxRiskLimit.OK || row.MaxRiskLimit.Val <= row.MinRiskLimit.Val ||
				!row.InitialMargin.OK || row.InitialMargin.Val <= 0 ||
				!row.MaxLeverage.OK || row.MaxLeverage.Val <= 0 {
				// An unreadable tier drops the WHOLE ladder, as on Bybit and OKX: keeping the rest
				// would stretch a neighbouring band across the gap and quote confident margin for a
				// range nothing verified.
				usable = false
				break
			}
			upper := row.MaxRiskLimit.Val
			ladder = append(ladder, core.LeverageTier{
				VenueID:          VenueID,
				VenueSymbol:      symbol,
				Tier:             int(row.Level.Val),
				LowerNotionalUSD: row.MinRiskLimit.Val,
				UpperNotionalUSD: &upper,
				IMR:              row.InitialMargin.Val,
				MMR:              row.MaintainMargin.Ptr(),
				MaxLeverage:      row.MaxLeverage.Val,
			})
		}
		if usable {
			ladders = append(ladders, ladder...)
		}
	}
	return ladders
}

// ParseFundingHistory returns settled funding events for one symbol, oldest first.
func ParseFundingHistory(env Envelope[[]FundingHistoryItem], fallbackHours float64) ([]core.FundingEvent, error) {
	rows, err := env.unwrap("funding history")
	if err != nil {
		return nil, err
	}

	type point struct {
		symbol    string
		settledAt int64
		rate      float64
	}
	points := make([]point, 0, len(rows))
	for _, item := range rows {
		at := item.Timepoint.PositiveMs()
		if at == nil || !item.FundingRate.OK {
			continue
		}
		points = append(points, point{item.Symbol, *at, item.FundingRate.Val})
	}
	sort.SliceStable(points, func(i, j int) bool { return points[i].settledAt < points[j].settledAt })

	stamps := make([]int64, len(points))
	for i, p := range points {
		stamps[i] = p.settledAt
	}
	basisHours := fallbackHours
	if inferred := core.InferIntervalHours(stamps); inferred != nil {
		basisHours = *inferred
	}

	events := make([]core.FundingEvent, 0, len(points))
	for _, p := range points {
		events = append(events, core.FundingEvent{
			MarketRef:  adapters.MarketRefFor(VenueID, p.symbol, adapters.Overrides{}),
			SettledAt:  p.settledAt,
			Rate:       p.rate,
			BasisHours: basisHours,
			MarkPrice:  nil,
		})
	}
	return events, nil
}
