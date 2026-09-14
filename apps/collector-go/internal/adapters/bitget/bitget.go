// Package bitget parses Bitget's USDT- and USDC-margined linear perpetuals.
//
// Ported from packages/adapters/src/venues/bitget.ts. Three venue facts run through everything here:
//
//   - THE FUNDING INTERVAL IS IN HOURS, not seconds (gate), minutes (Bybit) or milliseconds (KuCoin).
//     `fundingRateInterval` and `fundInterval` are both plain hour counts.
//   - `openInterest` IS BASE COIN, not contracts, whatever the contract size. SHIBUSDT carries a
//     10,000 `quantityMultiplier`, and reading its open interest as contracts overstates it 10,000x.
//   - THE CLASS IS DECLARED BY TWO FIELDS, `symbolType` and `isRwa`, and neither is enough alone;
//     see AssetClassFor.
package bitget

import (
	"fmt"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "bitget"

// okCode is the envelope code every successful Bitget response carries.
const okCode = "00000"

// Category is one of the two linear perpetual books. COIN-FUTURES is inverse -- 9 perpetuals and 2
// deliveries on 2026-09-14, margined in the base coin -- and is not collected.
type Category string

const (
	CategoryUSDT Category = "USDT-FUTURES"
	CategoryUSDC Category = "USDC-FUTURES"
)

// Categories is the fixed pair of books collected, in request order. A table, not state.
var Categories = []Category{CategoryUSDT, CategoryUSDC}

// Envelope is Bitget's uniform response wrapper.
type Envelope[T any] struct {
	Code string `json:"code"`
	Msg  string `json:"msg"`
	Data []T    `json:"data"`
}

// unwrap rejects anything that is not a success envelope carrying a list. A null or missing `data`
// is a malformed body rather than an empty book, exactly as the TypeScript's Array.isArray guard
// reads it; `[]` decodes to a non-nil empty slice and passes.
func (e Envelope[T]) unwrap(what string) ([]T, error) {
	if e.Code != okCode || e.Data == nil {
		return nil, fmt.Errorf("bitget %s: %s %s", what, e.Code, e.Msg)
	}
	return e.Data, nil
}

// Instrument is one row of `/api/v3/market/instruments`, which declares class where v2 `/contracts`
// does not.
//
// SymbolType and IsRwa are optional on the wire but are plain strings here rather than pointers:
// the TypeScript coalesces an absent `symbolType` to "" and compares an absent `isRwa` against
// "YES", so absent and empty take the same branch in both fields. Nothing downstream can tell them
// apart, so nothing is lost by collapsing them.
type Instrument struct {
	Symbol   string `json:"symbol"`
	BaseCoin string `json:"baseCoin"`
	// QuoteCoin is the settlement coin: USDT on every USDT-FUTURES row, USDC on every USDC-FUTURES row.
	QuoteCoin string `json:"quoteCoin"`
	// SymbolType is "crypto", "stock", "metal" or "commodity" on 2026-09-14.
	SymbolType string `json:"symbolType"`
	// IsRwa is "YES" on every real-world asset, including the FX pairs and indices `symbolType`
	// calls crypto.
	IsRwa string `json:"isRwa"`
	// Type is "perpetual" on all 836 rows of both books.
	Type string `json:"type"`
	// Status is "online" on all 836 rows of both books.
	Status string `json:"status"`
	// FundInterval is HOURS.
	FundInterval adapters.Num `json:"fundInterval"`
	// MaxLeverage is the headline leverage; the tiered ladder is the precise source.
	MaxLeverage adapters.Num `json:"maxLeverage"`
}

type Ticker struct {
	Symbol     string       `json:"symbol"`
	MarkPrice  adapters.Num `json:"markPrice"`
	IndexPrice adapters.Num `json:"indexPrice"`
	// OpenInterest is BASE COIN, not contracts.
	OpenInterest adapters.Num `json:"openInterest"`
	// Turnover24h is quote currency.
	Turnover24h adapters.Num `json:"turnover24h"`
	// Top of book. Prices are quote currency; the paired sizes are base coin.
	Bid1Price adapters.Num `json:"bid1Price"`
	Bid1Size  adapters.Num `json:"bid1Size"`
	Ask1Price adapters.Num `json:"ask1Price"`
	Ask1Size  adapters.Num `json:"ask1Size"`
}

type CurrentFundRate struct {
	Symbol string `json:"symbol"`
	// FundingRate is the estimate for the settlement at NextUpdate, over FundingRateInterval HOURS.
	FundingRate         adapters.Num `json:"fundingRate"`
	FundingRateInterval adapters.Num `json:"fundingRateInterval"`
	// NextUpdate is epoch ms.
	NextUpdate adapters.Num `json:"nextUpdate"`
}

type FundingHistoryItem struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"fundingRate"`
	// FundingTime is epoch ms of the settlement.
	FundingTime adapters.Num `json:"fundingTime"`
}

// AssetClassFor is the class Bitget declares for a contract, from `symbolType` and `isRwa` on v3
// instruments.
//
// Neither field is enough alone. Live 2026-09-14, 787 USDT-FUTURES perpetuals: `symbolType` crypto
// 477, stock 300, metal 7 (PAXG, XAUT, XAU, XAG, XPT, XPD, COPPER), commodity 3 (CL, BZ, NATGAS);
// `isRwa` YES on 321. The 11 rows that are `isRwa` YES yet `symbolType` crypto are EURUSD, USDJPY,
// GBPUSD, H100, B200, KUAISHOU, HPQ, FCX, BHP, RIO and VALE -- currencies, indices and shares with
// no class of their own in `symbolType` -- so `isRwa` says whether, and the base tables say which.
// No row is `isRwa` NO with a non-crypto `symbolType`. All 49 USDC-FUTURES rows are crypto and NO.
//
// PAXG and XAUT arrive as metal and leave MarketRefFor as crypto, as on every venue. A `symbolType`
// this does not know is still a declaration that the contract is not crypto.
func AssetClassFor(symbolType, isRwa, base string) core.AssetClass {
	if isRwa != "YES" && (symbolType == "" || symbolType == "crypto") {
		return core.ClassCrypto
	}
	switch symbolType {
	case "stock":
		return core.ClassEquity
	case "metal", "commodity":
		return core.ClassCommodity
	default:
		return core.ClassifyNonCrypto(core.CanonicalBase(base))
	}
}

// MarketRefFor is the market identity for an instrument: the parser's reading of the symbol, unless
// the declared `baseCoin` disagrees with it.
//
// Checked across all 836 live instruments on 2026-09-14: the parser agrees on every USDT-FUTURES
// row (STXSTOCK, NOKSTOCK and friends included -- the venue declares those bases too) and on none
// of the 49 USDC-FUTURES rows, which are named `BTCPERP`, `1000BONKPERP`: with no quote in the
// symbol the whole name became the base. The declaration is read through the parser as
// `BASE-QUOTE`, so `1000BONK` still becomes BONK at a 1000x multiplier.
func MarketRefFor(instrument Instrument) core.MarketRef {
	parsed := core.ParseVenueSymbol(instrument.Symbol)
	declared := parsed
	if instrument.BaseCoin != "" {
		declared = core.ParseVenueSymbol(instrument.BaseCoin + "-" + instrument.QuoteCoin)
	}
	agrees := parsed.Base == declared.Base && parsed.Multiplier == declared.Multiplier

	quote := instrument.QuoteCoin
	class := AssetClassFor(instrument.SymbolType, instrument.IsRwa, declared.Base)
	overrides := adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	}
	if !agrees {
		base := declared.Base
		multiplier := declared.Multiplier
		overrides.Base = &base
		overrides.Multiplier = &multiplier
	}
	return adapters.MarketRefFor(VenueID, instrument.Symbol, overrides)
}

// IsTradable keeps online linear perpetuals.
//
// On 2026-09-14 every instrument in both books passes (787 USDT, 49 USDC): the filter is for the
// statuses Bitget documents but was not using -- `listed`, `limit_open`, `limit_close`, `offline` --
// and for the delivery contracts it lists only in COIN-FUTURES. `current-fund-rate` also answers for
// 11 symbols with no instrument (BGTESTMEUSDT, RWATESTMEUSDT and pre-launch names); the join through
// instruments drops them.
func IsTradable(instrument Instrument) bool {
	return instrument.Type == "perpetual" &&
		instrument.Status == "online" &&
		(instrument.QuoteCoin == "USDT" || instrument.QuoteCoin == "USDC")
}

// ParseSnapshots builds one book's snapshots: instruments joined to tickers (prices, stats) and
// current funding.
func ParseSnapshots(
	instruments []Instrument,
	tickers Envelope[Ticker],
	fundRates Envelope[CurrentFundRate],
	now int64,
) (core.SnapshotBatch, error) {
	tickerRows, err := tickers.unwrap("tickers")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	fundingRows, err := fundRates.unwrap("current-fund-rate")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	tickerBySymbol := make(map[string]Ticker, len(tickerRows))
	for _, ticker := range tickerRows {
		tickerBySymbol[ticker.Symbol] = ticker
	}
	fundingBySymbol := make(map[string]CurrentFundRate, len(fundingRows))
	for _, funding := range fundingRows {
		fundingBySymbol[funding.Symbol] = funding
	}

	// Ranged over the instrument SLICE, so the output keeps the venue's own order rather than a
	// Go map's per-run shuffle.
	snapshots := make([]core.FundingSnapshot, 0, len(instruments))
	for _, instrument := range instruments {
		if !IsTradable(instrument) {
			continue
		}
		funding, hasFunding := fundingBySymbol[instrument.Symbol]
		if !hasFunding {
			continue
		}
		rate := funding.FundingRate
		hours := funding.FundingRateInterval
		if !hours.OK {
			hours = instrument.FundInterval
		}
		if !rate.OK || !hours.OK || hours.Val <= 0 {
			continue
		}

		ticker, hasTicker := tickerBySymbol[instrument.Symbol]
		var markPrice, indexPrice *float64
		var bestBid, bestBidSizeUSD, bestAsk, bestAskSizeUSD, openInterestUSD, volume24hUSD *float64
		if hasTicker {
			markPrice = ticker.MarkPrice.Ptr()
			indexPrice = ticker.IndexPrice.Ptr()
			// Sizes are base coin, the same unit as open interest below, so depth is size x price.
			bestBid = ticker.Bid1Price.Ptr()
			bestBidSizeUSD = adapters.Mul(ticker.Bid1Size.Ptr(), ticker.Bid1Price.Ptr())
			bestAsk = ticker.Ask1Price.Ptr()
			bestAskSizeUSD = adapters.Mul(ticker.Ask1Size.Ptr(), ticker.Ask1Price.Ptr())
			// `openInterest` is base coin, not contracts, whatever the contract size: BTCUSDT's
			// 35,917 at a 76,968 mark is $2.76bn, and SHIBUSDT's 1.86e12 at 0.000005184 is $9.6m --
			// read as contracts at its 10,000 `quantityMultiplier` it would be $96bn. It matches v2
			// `open-interest` `size`, which ccxt reads as an amount in base coin.
			openInterestUSD = adapters.Mul(ticker.OpenInterest.Ptr(), markPrice)
			// Quote turnover: BTCUSDT's 1,051,194,917 is its 13,655.88 BTC volume x the last price.
			volume24hUSD = ticker.Turnover24h.Ptr()
		}

		interval := hours.Val
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:  MarketRefFor(instrument),
			ObservedAt: now,
			// Predicted, not settled: at 22:06 UTC on 2026-09-13 BTCUSDT read 0.00005 here, for the
			// 00:00 settlement, while the 16:00 settlement in history-fund-rate was 0.000076.
			Rate:            rate.Val,
			BasisHours:      hours.Val,
			IntervalHours:   &interval,
			NextFundingAt:   funding.NextUpdate.PositiveMs(),
			Kind:            core.KindPredicted,
			MarkPrice:       markPrice,
			IndexPrice:      indexPrice,
			BestBid:         bestBid,
			BestBidSizeUSD:  bestBidSizeUSD,
			BestAsk:         bestAsk,
			BestAskSizeUSD:  bestAskSizeUSD,
			OpenInterestUSD: openInterestUSD,
			Volume24hUSD:    volume24hUSD,
			MaxLeverage:     instrument.MaxLeverage.Ptr(),
		})
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// ParseFundingHistory returns settled funding for one market inside [fromMs, toMs], oldest first.
//
// The interval is inferred from every row fetched, including those outside the window, so a
// one-event window still gets a basis; fallbackHours covers a market with a single settlement ever.
func ParseFundingHistory(
	ref core.MarketRef,
	items []FundingHistoryItem,
	fromMs, toMs int64,
	fallbackHours *float64,
) []core.FundingEvent {
	// One rate per settlement timestamp, last write winning, as the TypeScript Map does. The output
	// is sorted by that unique timestamp below, so insertion order never reaches the result and a Go
	// map's shuffle cannot show through.
	rates := make(map[int64]float64, len(items))
	stamps := make([]int64, 0, len(items))
	for _, item := range items {
		settledAt := item.FundingTime
		rate := item.FundingRate
		if !settledAt.OK || settledAt.Val <= 0 || !rate.OK {
			continue
		}
		at := int64(settledAt.Val)
		if _, seen := rates[at]; !seen {
			stamps = append(stamps, at)
		}
		rates[at] = rate.Val
	}

	basisHours := fallbackHours
	if inferred := core.InferIntervalHours(stamps); inferred != nil {
		basisHours = inferred
	}
	if basisHours == nil {
		return []core.FundingEvent{}
	}

	sort.Slice(stamps, func(i, j int) bool { return stamps[i] < stamps[j] })
	events := make([]core.FundingEvent, 0, len(stamps))
	for _, at := range stamps {
		if at < fromMs || at > toMs {
			continue
		}
		events = append(events, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  at,
			Rate:       rates[at],
			BasisHours: *basisHours,
			MarkPrice:  nil,
		})
	}
	return events
}
