// Package hibachi parses Hibachi's perp market data.
//
// Ported from packages/adapters/src/venues/hibachi.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/hibachi) and the same expected values as hibachi.test.ts, so the
// Go and TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: one per cycle, `GET /market/inventory` (~60 KB). The catalog's probe is the per-symbol
// `/market/data/prices`, but inventory carries every market's contract spec together with its live
// `info` (estimated funding, mark, spot, open interest, 24h volume), so nothing here is per symbol.
// Hibachi publishes no REST rate limit (https://api-doc.hibachi.xyz, and none in the SDK); at one
// request a minute that does not matter, and 250ms spacing covers history paging.
//
// FUNDING: `info.estimatedFundingRate` is a fraction for ONE hour, positive = longs pay, and
// `predicted` -- it is the same number `/market/data/prices` names `fundingRateEstimation`, for the
// settlement at its `nextFundingTimestamp` (the next top of the hour). Evidence, 2026-09-13:
//   - Settlements in `/market/data/funding-rates` are exactly 3,600s apart.
//   - BTC estimated 0.000006-0.000008 against Hyperliquid's 0.0000114/h the same minute, and ETH
//     -0.000008 against 0.0000125/h. Read as 8h rates they would be 8-12x below every other venue.
//   - Sampled every minute from 22:35 UTC, the inventory value moved with the prices value
//     (0.000007 -> 0.000013 on BTC) -- one estimate, not a settled figure -- and the last reading
//     before the hour is what settled: BTC 0.000013 and ETH -0.000017 at 22:59, and exactly those two
//     rates in `/market/data/funding-rates` for 23:00.
//
// Inventory has no next-funding time, so `NextFundingAt` is nil rather than a guessed hour.
//
// UNITS: `openInterestQuantity` is base units (BTC 9.11 x 76,764 = $699k). `volume24h` is USDT
// notional: the 24 hourly `volumeNotional` klines summed to 7,566,008 for BTC against 7,503,062
// reported, and 1,027.68 for XAG against 1,017.89 (read as base units XAG would be $65k).
// `spotPrice` is the underlying's spot reference, published as the index.
//
// TRADABILITY: `contract.status` LIVE. On 2026-09-13 inventory listed 67 markets: 15 LIVE (8 CRYPTO,
// 7 FX) and 52 CLOSED delistings. FX markets close at weekends (`nextCloseTimestamp`) but stay LIVE
// and are kept, like other venues' off-hours equities.
//
// CLASS: `contract.category` is CRYPTO or FX. Hibachi files silver under FX but tags it `commodity`,
// so FX becomes fx unless tagged commodity. Anything else not CRYPTO goes to ClassifyNonCrypto.
//
// QUOTE: `contract.settlementSymbol` (USDT on every market). BASE: the parser reads every one of the
// 67 symbols (`BTC/USDT-P`) as the declared `underlyingSymbol`, so it is used unchanged.
package hibachi

import (
	"math"
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	VenueID = "hibachi"
	// fundingHours is both the basis and the settlement interval: the estimate is a one-hour
	// fraction, and settlements are exactly 3,600s apart.
	fundingHours = 1.0
)

// Contract is a market's spec, as inventory states it.
type Contract struct {
	Symbol           string `json:"symbol"`
	Category         string `json:"category"`
	Status           string `json:"status"`
	SettlementSymbol string `json:"settlementSymbol"`
	UnderlyingSymbol string `json:"underlyingSymbol"`
}

// MarketInfo is the live half of an inventory row. Every numeric is nullable: a CLOSED market
// carries the keys with null values, which must not read as zero.
type MarketInfo struct {
	// Category is the info-level label ("fx", "Crypto", "FxMajor"), kept for fidelity with the
	// TypeScript shape. The class is taken from the CONTRACT's category, which is the declared one.
	Category             *string      `json:"category"`
	EstimatedFundingRate adapters.Num `json:"estimatedFundingRate"`
	MarkPrice            adapters.Num `json:"markPrice"`
	SpotPrice            adapters.Num `json:"spotPrice"`
	OpenInterestQuantity adapters.Num `json:"openInterestQuantity"`
	Volume24h            adapters.Num `json:"volume24h"`
	Tags                 []string     `json:"tags"`
}

// InventoryMarket pairs a contract with its live info. Info is a pointer because a row may omit it
// entirely, which is not the same as one whose fields are all null.
type InventoryMarket struct {
	Contract Contract    `json:"contract"`
	Info     *MarketInfo `json:"info"`
}

type Inventory struct {
	Markets []InventoryMarket `json:"markets"`
}

// FundingRow is one settlement from /market/data/funding-rates. `fundingTimestamp` is epoch SECONDS.
type FundingRow struct {
	FundingTimestamp adapters.Num `json:"fundingTimestamp"`
	FundingRate      adapters.Num `json:"fundingRate"`
	IndexPrice       adapters.Num `json:"indexPrice"`
}

// AssetClassFor is the class Hibachi declares for a contract.
//
// `contract.category` is CRYPTO or FX. Hibachi files silver under FX but tags it `commodity`, so FX
// becomes fx unless tagged commodity. Anything else not CRYPTO goes to ClassifyNonCrypto, which is
// the venue saying only "this is not crypto" and letting the base tables settle which kind.
func AssetClassFor(category string, tags []string, base string) core.AssetClass {
	switch strings.ToUpper(strings.TrimSpace(category)) {
	case "CRYPTO":
		return core.ClassCrypto
	case "FX":
		for _, t := range tags {
			if strings.ToLower(t) == "commodity" {
				return core.ClassCommodity
			}
		}
		return core.ClassFX
	default:
		return core.ClassifyNonCrypto(base)
	}
}

// ref builds the market reference for a contract: the quote is the declared settlement currency, and
// the class the declared category refined by the tags.
func ref(contract Contract, tags []string) core.MarketRef {
	parsed := core.ParseVenueSymbol(contract.Symbol)
	class := AssetClassFor(contract.Category, tags, parsed.Base)
	quote := contract.SettlementSymbol
	return adapters.MarketRefFor(VenueID, contract.Symbol, adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseInventory turns one inventory body into snapshots for every LIVE market that quotes both an
// estimate and a mark.
func ParseInventory(body Inventory, now int64) []core.FundingSnapshot {
	snapshots := make([]core.FundingSnapshot, 0, len(body.Markets))
	for _, market := range body.Markets {
		info := market.Info
		if market.Contract.Status != "LIVE" || info == nil ||
			!info.EstimatedFundingRate.OK || !info.MarkPrice.OK {
			continue
		}
		markPrice := info.MarkPrice.Ptr()
		hours := fundingHours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref(market.Contract, info.Tags),
			ObservedAt:    now,
			Rate:          info.EstimatedFundingRate.Val,
			BasisHours:    fundingHours,
			IntervalHours: &hours,
			NextFundingAt: nil,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    info.SpotPrice.Ptr(),
			// Base units, so the notional is quantity x mark.
			OpenInterestUSD: adapters.Mul(info.OpenInterestQuantity.Ptr(), markPrice),
			Volume24hUSD:    info.Volume24h.Ptr(),
		})
	}
	return snapshots
}

// ParseFunding returns hourly settlements within [fromMs, toMs], oldest first. `fundingTimestamp` is
// epoch seconds.
//
// Deduplicated by settlement timestamp, because paging by offset can repeat a row across a page
// boundary; the last reading of a timestamp wins, as it does on the TypeScript side.
func ParseFunding(rows []FundingRow, contract Contract, tags []string, fromMs, toMs int64) []core.FundingEvent {
	base := ref(contract, tags)
	index := make(map[int64]int, len(rows))
	events := make([]core.FundingEvent, 0, len(rows))
	for _, row := range rows {
		if !row.FundingTimestamp.OK || !row.FundingRate.OK {
			continue
		}
		settledAt := int64(math.Round(row.FundingTimestamp.Val * 1000))
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		event := core.FundingEvent{
			MarketRef:  base,
			SettledAt:  settledAt,
			Rate:       row.FundingRate.Val,
			BasisHours: fundingHours,
			// The row's price is the index, not the mark, so it is not stored as one.
			MarkPrice: nil,
		}
		if at, seen := index[settledAt]; seen {
			events[at] = event
			continue
		}
		index[settledAt] = len(events)
		events = append(events, event)
	}
	sort.SliceStable(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
