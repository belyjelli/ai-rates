// Package apex parses ApeX Omni's perpetual and stock contracts.
//
// Ported from packages/adapters/src/venues/apex.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/apex) and the same expected values as apex.test.ts, so the Go and
// TypeScript parsers cannot drift apart while both are collecting.
//
// FUNDING -- which field. `fundingRate` is the running estimate for the settlement at
// `nextFundingTime`, so it is `predicted`. The docs only call it "Funding rate" and its neighbour
// "Predicted funding rate", so this was measured: sampled every minute on 2026-09-13, BTC's
// `fundingRate` read -0.00001042 at 22:59:31 and `/v3/history-funding` recorded -0.00001020 for the
// 23:00 settlement; ETH read -0.00000722 and settled -0.00000698. `predictedFundingRate` is NOT
// the prediction, whatever its name: it read 0.0000125 on BTC, ETH and SPCX every minute, which is
// the contracts' `fundingInterestRate` of 0.0003 a day over 24 hours -- the interest component
// alone -- and neither settlement was anywhere near it.
//
// FUNDING -- units and period. A fraction for ONE hour, positive = longs pay. "Funding fees will be
// exchanged between long and short position holders every 1 hour" and "Funding Fees = Position
// Value * Index Price * Funding Rate" (https://api-docs.omni.apex.exchange/); history rows are
// exactly 3,600,000ms apart. Against Hyperliquid's 0.0000125/h the same hour BTC read -0.0000103/h:
// the same order of magnitude (a percent reading would be 100x off, an 8h one 8x), with the
// opposite sign because ApeX's BTC was marking 4bp under its index (76,761.71 vs 76,794.20).
package apex

import (
	"sort"
	"strings"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "apex"

// API is the venue's public REST root.
const API = "https://omni.apex.exchange/api/v3"

// FundingHours: ApeX settles every hour and quotes a 1-hour rate. See the package doc for the
// measurement behind both halves of that.
const FundingHours = 1.0

// Contract is one row of `/v3/symbols`, from any of its three lists.
type Contract struct {
	// Symbol ("BTC-USDT") is the venue symbol, because the funding history is keyed by it.
	Symbol string `json:"symbol"`
	// CrossSymbolName ("BTCUSDT") is what `/v3/ticker` is asked for, and what its row echoes back.
	CrossSymbolName string `json:"crossSymbolName"`
	// BaseTokenID is the venue's declared base. NOT read: the symbol parser agrees with it on all
	// 185 perpetual and stock contracts except the four thousand-unit ones (1000PEPE, 1000BONK,
	// 1000SHIB, 1000000MOG), which it reads as PEPE x1000 and so on -- the same reading as every
	// other venue's 1000PEPE, so that reading is kept.
	BaseTokenID string `json:"baseTokenId"`
	// SettleAssetID is the quote currency, USDT on every contract.
	SettleAssetID      string `json:"settleAssetId"`
	EnableTrade        bool   `json:"enableTrade"`
	EnableDisplay      bool   `json:"enableDisplay"`
	EnableOpenPosition bool   `json:"enableOpenPosition"`
	IsPrelaunch        bool   `json:"isPrelaunch"`
	// Category is a sector on perpetuals (L1, DEFI, MEME ...) and a class on stock contracts
	// (STOCK, COMMODITY, INDEX). A JSON null decodes to "", which reads the same as absent -- both
	// fall through to ClassifyNonCrypto, exactly as the TypeScript optional chain does.
	Category           string       `json:"category"`
	DisplayMaxLeverage adapters.Num `json:"displayMaxLeverage"`
}

// ContractConfig holds the three lists `/v3/symbols` publishes. Slices are plain, so an absent list
// is an empty one, which is what the TypeScript `?? []` gives each of them.
type ContractConfig struct {
	PerpetualContract []Contract `json:"perpetualContract"`
	StockContract     []Contract `json:"stockContract"`
	// PredictionContract is decoded but never collected; see TradableContracts.
	PredictionContract []Contract `json:"predictionContract"`
}

// SymbolsData and SymbolsResponse are pointers all the way down so that a body which lost its
// payload is distinguishable from one listing nothing, which is what the TypeScript
// `!body?.data?.contractConfig` guard turns into a thrown error.
type SymbolsData struct {
	ContractConfig *ContractConfig `json:"contractConfig"`
}

type SymbolsResponse struct {
	Data *SymbolsData `json:"data"`
}

// Ticker is one row of `/v3/ticker`, which answers a single symbol at a time.
//
// UNITS, checked 2026-09-13: `openInterest` is base units (BTC 1,578 x 76,737 = $121M), `turnover24h`
// is quote (BTC $565M against `volume24h` 7,337 BTC at ~77k). `nextFundingTime` is ISO-8601.
type Ticker struct {
	Symbol string `json:"symbol"`
	// FundingRate is the running estimate for the settlement at NextFundingTime.
	FundingRate adapters.Num `json:"fundingRate"`
	// PredictedFundingRate is NOT the prediction: it is the interest component alone, constant at
	// 0.0000125 across every contract. Decoded so the test can pin that it is never read; see the
	// package doc for the measurement.
	PredictedFundingRate adapters.Num `json:"predictedFundingRate"`
	NextFundingTime      string       `json:"nextFundingTime"`
	MarkPrice            adapters.Num `json:"markPrice"`
	IndexPrice           adapters.Num `json:"indexPrice"`
	// OpenInterest is BASE units, so it is priced at the mark to reach USD.
	OpenInterest adapters.Num `json:"openInterest"`
	// Turnover24h is already quote currency.
	Turnover24h adapters.Num `json:"turnover24h"`
}

// TickerResponse is the `/v3/ticker` body. Asking without a symbol returns an empty array, and so
// does asking for a symbol the venue does not list.
type TickerResponse struct {
	Data []Ticker `json:"data"`
}

// FundingRow is one settled payment from `/v3/history-funding`.
type FundingRow struct {
	Symbol string       `json:"symbol"`
	Rate   adapters.Num `json:"rate"`
	// Price is NOT documented as the mark (the docs' example gives it no description), so it is not
	// stored as one.
	Price adapters.Num `json:"price"`
	// FundingTime is epoch MILLISECONDS, arriving as a bare JSON number.
	FundingTime adapters.Num `json:"fundingTime"`
}

// HistoryResponse is the `/v3/history-funding` body. A null or absent `historyFunds` decodes to a nil
// slice, which is the TypeScript `?? []`; a value that is not an array fails the decode in the
// client, which is that adapter's "unexpected history-funding response" throw.
type HistoryResponse struct {
	Data struct {
		HistoryFunds []FundingRow `json:"historyFunds"`
	} `json:"data"`
}

// List is which of `/v3/symbols`' lists a contract came from, which is what decides its class.
type List string

const (
	ListPerpetual List = "perpetual"
	ListStock     List = "stock"
)

// Market is a tradable contract with the list it came from.
type Market struct {
	Contract Contract
	List     List
}

// Book is the tradable contracts keyed by `symbol`, in the venue's own order.
//
// Order is kept beside the map because the TypeScript side is a Map, whose insertion order is what
// the rotation sweeps in: ranging a Go map would reshuffle which contracts a cycle reads on every
// run, so the sweep would stop converging.
type Book struct {
	Order   []string
	Markets map[string]Market
}

// isLive is a contract that is actually tradable right now.
func isLive(c Contract) bool {
	return c.EnableTrade && c.EnableDisplay && c.EnableOpenPosition && !c.IsPrelaunch
}

// TradableContracts is the tradable perpetual and stock contracts, by `symbol`.
//
// Kept: `perpetualContract` and `stockContract` rows with `enableTrade`, `enableDisplay` and
// `enableOpenPosition` all true -- 86 of 138 and 39 of 47 on 2026-09-13; the rest are delisted (TON,
// MKR, IWM ...: all three false) or close-only (IO: tradable but not displayed or openable).
// `predictionContract` (184 rows, e.g. `Donald_Trump_win_Presidential_Election_2028`) is left out:
// those are event contracts priced on an outcome, not perpetuals on an asset, and 178 of them are
// not even displayed.
//
// A nil config is an empty book rather than a panic; the adapter rejects a payload-less body before
// it ever gets here, which is where the TypeScript throws.
func TradableContracts(config *ContractConfig) Book {
	book := Book{Markets: map[string]Market{}}
	if config == nil {
		return book
	}
	add := func(contracts []Contract, list List) {
		for _, contract := range contracts {
			if !isLive(contract) {
				continue
			}
			if _, seen := book.Markets[contract.Symbol]; !seen {
				book.Order = append(book.Order, contract.Symbol)
			}
			book.Markets[contract.Symbol] = Market{Contract: contract, List: list}
		}
	}
	add(config.PerpetualContract, ListPerpetual)
	add(config.StockContract, ListStock)
	return book
}

// AssetClassFor is the class ApeX declares for a contract, from the list it came from and, for stock
// contracts, its `category`.
//
// `perpetualContract` rows are crypto (their `category` is a sector: L1, DEFI, MEME ...; PAXG has
// none). `stockContract` rows declare `category` STOCK 28, COMMODITY 6, INDEX 4 or nothing (SOXL).
// INDEX is passed as index and MarketRefFor settles SPY, QQQ, EWY and DRAM as equity; a missing or
// unknown category goes to ClassifyNonCrypto.
func AssetClassFor(market Market, base string) core.AssetClass {
	if market.List == ListPerpetual {
		return core.ClassCrypto
	}
	switch strings.ToUpper(strings.TrimSpace(market.Contract.Category)) {
	case "STOCK":
		return core.ClassEquity
	case "COMMODITY":
		return core.ClassCommodity
	case "INDEX":
		return core.ClassIndex
	default:
		return core.ClassifyNonCrypto(base)
	}
}

// refFor names one market.
//
// The quote is `settleAssetId`, which the venue states outright, so HasQuote is set: the field is
// supplied, exactly as the TypeScript passes `quote:` on every call.
//
// No dex is supplied at all -- ApeX is a DEX but publishes no HIP-3-style sub-dex id -- so HasDex
// stays false and the parsed value (nil for these symbols) survives. Setting HasDex with a nil Dex
// would be the different claim "this venue declares no dex", which the TypeScript does not make.
func refFor(market Market) core.MarketRef {
	parsed := adapters.MarketRefFor(VenueID, market.Contract.Symbol, adapters.Overrides{})
	quote := market.Contract.SettleAssetID
	class := AssetClassFor(market, parsed.Base)
	return adapters.MarketRefFor(VenueID, market.Contract.Symbol, adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseTicker normalises one `/v3/ticker` row into a snapshot, or nil where there is nothing to
// emit: no rate, no mark, or a row for a different symbol than the one asked for.
func ParseTicker(market Market, ticker *Ticker, now int64) *core.FundingSnapshot {
	if ticker == nil || ticker.Symbol != market.Contract.CrossSymbolName || !ticker.FundingRate.OK {
		return nil
	}
	if !ticker.MarkPrice.OK {
		return nil
	}

	basisHours := FundingHours
	markPrice := ticker.MarkPrice.Ptr()
	return &core.FundingSnapshot{
		MarketRef:     refFor(market),
		ObservedAt:    now,
		Rate:          ticker.FundingRate.Val,
		BasisHours:    basisHours,
		IntervalHours: &basisHours,
		NextFundingAt: parseNextFundingTime(ticker.NextFundingTime),
		Kind:          core.KindPredicted,
		MarkPrice:     markPrice,
		IndexPrice:    ticker.IndexPrice.Ptr(),
		// `openInterest` is BASE units, so it is priced at the mark: 1,578 BTC is $121M, not $1,578.
		OpenInterestUSD: adapters.Mul(ticker.OpenInterest.Ptr(), markPrice),
		Volume24hUSD:    ticker.Turnover24h.Ptr(),
		MaxLeverage:     market.Contract.DisplayMaxLeverage.Ptr(),
	}
}

// parseNextFundingTime reads the ISO-8601 settlement instant as epoch milliseconds, or nil when the
// venue sent nothing readable. The nil stands in for the TypeScript `Number.isFinite(Date.parse(...))`
// guard, which keeps an unreadable stamp out rather than filing the settlement at the epoch.
func parseNextFundingTime(value string) *int64 {
	if value == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil
	}
	ms := parsed.UnixMilli()
	return &ms
}

// ParseFunding returns hourly settlements within [fromMs, toMs], oldest first.
func ParseFunding(rows []FundingRow, market Market, fromMs, toMs int64) []core.FundingEvent {
	base := refFor(market)

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		if !row.FundingTime.OK || !row.Rate.OK {
			continue
		}
		settledAt := int64(row.FundingTime.Val)
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  settledAt,
			Rate:       row.Rate.Val,
			BasisHours: FundingHours,
			// `price` is not documented as the mark, so it is not stored as one.
			MarkPrice: nil,
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
