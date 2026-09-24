// Package gate parses Gate's USDT-margined futures.
//
// Ported from packages/adapters/src/venues/gate.ts. Three venue quirks run through everything here
// and each one is a wrong number if it is dropped in translation:
//
//   - SIZES ARE CONTRACTS, converted by `quanto_multiplier`. BTC_USDT is 0.0001 BTC a contract, so a
//     book size of 2,776 is 0.2776 BTC and a liquidation of 8 is about $62 rather than 8 BTC.
//   - THE FUNDING INTERVAL IS IN SECONDS, not minutes (Bybit) or milliseconds (KuCoin).
//   - THE LIQUIDATED SIDE IS THE SIGN ON `size`, and `order_size` carries the opposite sign because
//     it is the closing order rather than the position. Keying on the wrong field inverts every
//     long and short in the study; see ParseLiquidations.
package gate

import (
	"math"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "gate"

const minuteMs = 60_000

type Contract struct {
	Name string `json:"name"`
	// FundingRate is the rate for the current interval, applied at FundingNextApply.
	FundingRate adapters.Num `json:"funding_rate"`
	// FundingInterval is SECONDS.
	FundingInterval int64 `json:"funding_interval"`
	// FundingNextApply is epoch SECONDS.
	FundingNextApply int64        `json:"funding_next_apply"`
	MarkPrice        adapters.Num `json:"mark_price"`
	IndexPrice       adapters.Num `json:"index_price"`
	// QuantoMultiplier is base units per contract.
	QuantoMultiplier adapters.Num `json:"quanto_multiplier"`
	// LeverageMax is the headline leverage; /risk_limit_tiers is the precise, size-aware source.
	LeverageMax adapters.Num `json:"leverage_max"`
	InDelisting bool         `json:"in_delisting"`
	// Status is a pointer because an absent status is not a non-trading one: gate omits the field on
	// some rows, and collapsing absent into "" would skip every contract that does not declare it.
	Status      *string `json:"status"`
	IsPreMarket bool    `json:"is_pre_market"`
	// ContractType is what the contract tracks: "" for crypto, else "stocks", "indices", "metals",
	// "commodities", "forex".
	ContractType string `json:"contract_type"`
}

// AssetClassFor is the class gate declares for a contract, from `contract_type` on
// /futures/usdt/contracts.
//
// Live 2026-09-14, 981 contracts: "" 565 (crypto), "stocks" 380, "indices" 18, "metals" 12,
// "commodities" 3, "forex" 3. It is what makes CAT_USDT Caterpillar and RTX_USDT Raytheon on gate
// while BB, ON, QNT and STX stay crypto. gate files PAXG and XAUT under metals and USDC under forex;
// MarketRefFor returns those tokens to crypto. A missing field is undeclared, so crypto; a value this
// does not know still says not-crypto, so the base tables settle which class.
func AssetClassFor(contractType, base string) core.AssetClass {
	switch contractType {
	case "":
		return core.ClassCrypto
	case "stocks":
		return core.ClassEquity
	case "indices":
		return core.ClassIndex
	case "metals", "commodities":
		return core.ClassCommodity
	case "forex":
		return core.ClassFX
	default:
		return core.ClassifyNonCrypto(core.CanonicalBase(base))
	}
}

type Ticker struct {
	Contract       string       `json:"contract"`
	Volume24hQuote adapters.Num `json:"volume_24h_quote"`
	// TotalSize is open interest in CONTRACTS.
	TotalSize adapters.Num `json:"total_size"`
	// Top of book. Prices are quote currency; the paired sizes are CONTRACTS.
	HighestBid  adapters.Num `json:"highest_bid"`
	HighestSize adapters.Num `json:"highest_size"`
	LowestAsk   adapters.Num `json:"lowest_ask"`
	LowestSize  adapters.Num `json:"lowest_size"`
	// The per-cycle fields /contracts also carries, so the contract list can be cached (see
	// withLiveFunding). Measured 2026-09-24: funding_rate equal to /contracts' on all 1,013 markets,
	// mark_price within 0.2% on 1,005.
	FundingRate adapters.Num `json:"funding_rate"`
	MarkPrice   adapters.Num `json:"mark_price"`
	IndexPrice  adapters.Num `json:"index_price"`
}

// withLiveFunding overlays one cycle's tickers onto a cached contract list: the funding rate, mark
// and index are taken from the ticker, and the next settlement is rolled forward by whole intervals
// from the cached one, which is the only per-cycle field the tickers do not carry. A contract with no
// ticker keeps its cached values; ParseSnapshots already leaves such a market's book and volume null.
func withLiveFunding(cached []Contract, tickers []Ticker, nowMs int64) []Contract {
	byName := make(map[string]Ticker, len(tickers))
	for _, ticker := range tickers {
		byName[ticker.Contract] = ticker
	}
	nowSec := nowMs / 1000
	out := make([]Contract, len(cached))
	for i, contract := range cached {
		if ticker, ok := byName[contract.Name]; ok {
			if ticker.FundingRate.OK {
				contract.FundingRate = ticker.FundingRate
			}
			if ticker.MarkPrice.OK {
				contract.MarkPrice = ticker.MarkPrice
			}
			if ticker.IndexPrice.OK {
				contract.IndexPrice = ticker.IndexPrice
			}
		}
		if contract.FundingInterval > 0 && contract.FundingNextApply > 0 && contract.FundingNextApply <= nowSec {
			behind := (nowSec-contract.FundingNextApply)/contract.FundingInterval + 1
			contract.FundingNextApply += behind * contract.FundingInterval
		}
		out[i] = contract
	}
	return out
}

type FundingHistoryItem struct {
	// T is epoch SECONDS; Gate stamps settlements a second or two after the hour.
	T int64        `json:"t"`
	R adapters.Num `json:"r"`
}

// ParseSnapshots normalises one cycle's /contracts and /tickers responses.
func ParseSnapshots(contracts []Contract, tickers []Ticker, now int64) core.SnapshotBatch {
	tickerByContract := make(map[string]Ticker, len(tickers))
	for _, ticker := range tickers {
		tickerByContract[ticker.Contract] = ticker
	}

	snapshots := make([]core.FundingSnapshot, 0, len(contracts))
	for _, contract := range contracts {
		if contract.InDelisting || contract.IsPreMarket {
			continue
		}
		if contract.Status != nil && *contract.Status != "trading" {
			continue
		}
		if !contract.FundingRate.OK || !(contract.FundingInterval > 0) {
			continue
		}

		// SECONDS, unlike every venue that reports minutes or milliseconds.
		hours := float64(contract.FundingInterval) / 3600
		markPrice := contract.MarkPrice.Ptr()
		ticker, hasTicker := tickerByContract[contract.Name]
		base := adapters.MarketRefFor(VenueID, contract.Name, adapters.Overrides{}).Base
		class := AssetClassFor(contract.ContractType, base)
		ref := adapters.MarketRefFor(VenueID, contract.Name, adapters.Overrides{AssetClass: &class})

		var nextFundingAt *int64
		if contract.FundingNextApply > 0 {
			at := contract.FundingNextApply * 1000
			nextFundingAt = &at
		}

		var bestBid, bestBidSizeUSD, bestAsk, bestAskSizeUSD, openInterestUSD, volume24hUSD *float64
		if hasTicker {
			bestBid = ticker.HighestBid.Ptr()
			// Sizes are contracts, so they go through `quanto_multiplier` exactly as `total_size`
			// does -- 2,776 BTC contracts is 0.2776 BTC, not 2,776 of anything tradable.
			bestBidSizeUSD = adapters.Mul(ticker.HighestSize.Ptr(), contract.QuantoMultiplier.Ptr(), ticker.HighestBid.Ptr())
			bestAsk = ticker.LowestAsk.Ptr()
			bestAskSizeUSD = adapters.Mul(ticker.LowestSize.Ptr(), contract.QuantoMultiplier.Ptr(), ticker.LowestAsk.Ptr())
			openInterestUSD = adapters.Mul(ticker.TotalSize.Ptr(), contract.QuantoMultiplier.Ptr(), markPrice)
			volume24hUSD = ticker.Volume24hQuote.Ptr()
		}

		interval := hours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       ref,
			ObservedAt:      now,
			Rate:            contract.FundingRate.Val,
			BasisHours:      hours,
			IntervalHours:   &interval,
			NextFundingAt:   nextFundingAt,
			Kind:            core.KindPredicted,
			MarkPrice:       markPrice,
			IndexPrice:      contract.IndexPrice.Ptr(),
			BestBid:         bestBid,
			BestBidSizeUSD:  bestBidSizeUSD,
			BestAsk:         bestAsk,
			BestAskSizeUSD:  bestAskSizeUSD,
			OpenInterestUSD: openInterestUSD,
			Volume24hUSD:    volume24hUSD,
			MaxLeverage:     contract.LeverageMax.Ptr(),
		})
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}
}

// ParseFundingHistory returns settled funding events for one contract, oldest first, with timestamps
// snapped to the minute.
func ParseFundingHistory(contract string, items []FundingHistoryItem, fallbackHours float64) []core.FundingEvent {
	type point struct {
		settledAt int64
		rate      float64
	}
	points := make([]point, 0, len(items))
	for _, item := range items {
		settledAt := int64(math.Round(float64(item.T)*1000/minuteMs) * minuteMs)
		if !item.R.OK || settledAt <= 0 {
			continue
		}
		points = append(points, point{settledAt: settledAt, rate: item.R.Val})
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
			MarketRef:  adapters.MarketRefFor(VenueID, contract, adapters.Overrides{}),
			SettledAt:  p.settledAt,
			Rate:       p.rate,
			BasisHours: basisHours,
			MarkPrice:  nil,
		})
	}
	return events
}

type RiskLimitTier struct {
	// Contract: only the bulk form of the endpoint carries this; the per-contract form omits it.
	Contract string `json:"contract"`
	Tier     int    `json:"tier"`
	// RiskLimit is the cumulative upper bound of the band, in quote notional.
	RiskLimit       adapters.Num `json:"risk_limit"`
	InitialRate     adapters.Num `json:"initial_rate"`
	MaintenanceRate adapters.Num `json:"maintenance_rate"`
	LeverageMax     adapters.Num `json:"leverage_max"`
}

// ParseRiskLimitTiers builds Gate's risk ladders, one per contract.
//
// `risk_limit` is a cumulative upper bound in quote notional — no contract conversion, unlike OKX
// — so each band starts where the previous ended and the top band's bound is a real cap. This
// parses the **bulk** response shape: asking per contract returns the same rows without the
// `contract` field, which would leave every ladder unattributable.
func ParseRiskLimitTiers(rows []RiskLimitTier) []core.LeverageTier {
	// Grouped in the venue's own order rather than by ranging a map, so the output does not
	// reshuffle per run the way Go map iteration would. The TypeScript Map preserves insertion
	// order for free.
	byContract := make(map[string][]RiskLimitTier, len(rows))
	order := make([]string, 0, len(rows))
	for _, row := range rows {
		if row.Contract == "" {
			continue
		}
		if _, seen := byContract[row.Contract]; !seen {
			order = append(order, row.Contract)
		}
		byContract[row.Contract] = append(byContract[row.Contract], row)
	}

	ladders := make([]core.LeverageTier, 0, len(rows))
	for _, contract := range order {
		contractRows := byContract[contract]
		sorted := make([]RiskLimitTier, len(contractRows))
		copy(sorted, contractRows)
		sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Tier < sorted[j].Tier })

		ladder := make([]core.LeverageTier, 0, len(sorted))
		lowerNotionalUSD := 0.0
		usable := true

		for _, row := range sorted {
			upper := row.RiskLimit
			imr := row.InitialRate
			maxLeverage := row.LeverageMax
			if !upper.OK || upper.Val <= lowerNotionalUSD ||
				!imr.OK || imr.Val <= 0 ||
				!maxLeverage.OK || maxLeverage.Val <= 0 {
				usable = false
				break
			}
			upperNotionalUSD := upper.Val
			ladder = append(ladder, core.LeverageTier{
				VenueID:          VenueID,
				VenueSymbol:      contract,
				Tier:             row.Tier,
				LowerNotionalUSD: lowerNotionalUSD,
				UpperNotionalUSD: &upperNotionalUSD,
				IMR:              imr.Val,
				MMR:              row.MaintenanceRate.Ptr(),
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

type LiquidationRow struct {
	Contract string `json:"contract"`
	// Size is the LIQUIDATED POSITION, signed: positive is a long, negative a short.
	Size adapters.Num `json:"size"`
	// OrderSize is the closing order, always the opposite sign to Size. Not the position's side.
	OrderSize adapters.Num `json:"order_size"`
	FillPrice adapters.Num `json:"fill_price"`
	// Time is epoch SECONDS.
	Time  adapters.Num `json:"time"`
	Left  adapters.Num `json:"left"`
	Price adapters.Num `json:"order_price"`
}

// ParseLiquidations normalises Gate's forced closes to the side of the position that was liquidated.
//
// THE SIDE COMES FROM `size`, NOT `order_size`, and getting this backwards would invert every
// long/short figure in the study. Measured across 167 live records on 2026-09-13: the two fields
// are opposite in sign in 167 of 167 cases. `size:"76", order_size:"-76"` is a liquidated LONG
// closed by a sell; `size:"-95", order_size:"95"` is a liquidated SHORT closed by a buy. The sign
// is consumed into `side` and the stored size is absolute, or every short's notional would be
// negative.
//
// The notional needs the per-contract multiplier, which is why the hook fetches `/contracts`
// alongside: Gate quotes size in CONTRACTS, and BTC_USDT is 0.0001 BTC apiece, so a size of 8 is
// about $62 rather than 8 BTC. A contract we have no multiplier for stores a null notional instead
// of a guessed one.
func ParseLiquidations(rows []LiquidationRow, multipliers map[string]float64) []core.Liquidation {
	out := make([]core.Liquidation, 0, len(rows))
	for _, row := range rows {
		if !row.Size.OK || row.Size.Val == 0 || !row.FillPrice.OK || row.FillPrice.Val <= 0 {
			continue
		}
		// Num already treats a non-finite value as absent, which is what Number.isFinite guards on
		// the TypeScript side.
		if !row.Time.OK || row.Time.Val <= 0 {
			continue
		}

		var multiplier *float64
		if m, known := multipliers[row.Contract]; known {
			multiplier = &m
		}
		side := "short"
		if row.Size.Val > 0 {
			side = "long"
		}
		size := math.Abs(row.Size.Val)
		fillPrice := row.FillPrice.Val

		out = append(out, core.Liquidation{
			MarketRef: adapters.MarketRefFor(VenueID, row.Contract, adapters.Overrides{}),
			// SECONDS, unlike OKX's already-millisecond stamps.
			LiquidatedAt:  int64(row.Time.Val) * 1000,
			Side:          side,
			SizeContracts: size,
			FillPrice:     fillPrice,
			NotionalUSD:   adapters.Mul(&size, multiplier, &fillPrice),
		})
	}
	return out
}
