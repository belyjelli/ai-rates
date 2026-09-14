// Package bitmart parses BitMart's USDT- and USDC-margined perpetuals.
//
// Ported from packages/adapters/src/venues/bitmart.ts. Two venue facts run through everything here:
//
//   - THERE IS NO MARK PRICE IN ANY BULK CALL. /details does not carry one and no other bulk endpoint
//     does either (only a per-symbol mark kline), so every snapshot's MarkPrice is nil and open
//     interest is priced at the index instead. A market with no mark is a ROUTINE state on this
//     venue, not an error, which is why migration 020 made the identity gate fall back to the index
//     price for it. Absent must stay nil: decoding it as 0 would claim a free market.
//   - THE RATE IS `expected_funding_rate`, NOT `funding_rate`. The row's `funding_rate` is neither
//     the estimate for the next settlement nor the last one paid; see ParseSnapshots.
package bitmart

import (
	"fmt"
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "bitmart"

// okCode is the envelope code BitMart answers a successful call with.
const okCode = 1000

// perpetual is `product_type` 1 (2 would be a dated future); every row was 1 on 2026-09-14.
const perpetual = 1

// Envelope is BitMart's uniform response wrapper.
//
// Data is a POINTER so that `"data": null` on an error envelope stays absent instead of decoding to
// a zero-valued payload — the Go equivalent of the TypeScript `data === null` guard, and the same
// absent-is-not-empty rule the numerics follow.
type Envelope[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    *T     `json:"data"`
}

func (e Envelope[T]) unwrap(what string) (*T, error) {
	if e.Code != okCode || e.Data == nil {
		return nil, fmt.Errorf("bitmart %s: %d %s", what, e.Code, e.Message)
	}
	return e.Data, nil
}

// TradfiInfo is the block BitMart attaches to a contract that tracks something off-chain.
type TradfiInfo struct {
	// MarketGroup is the market a tradfi contract follows: US_MARKET, HK_STOCK, FOREX,
	// INDEX_{JP,HK,KR,UK,AU,TW,DE}, METAL_LME, COMMODITY_{CME,ICE} and PRE_LIST on 2026-09-14.
	MarketGroup string `json:"market_group"`
}

type Contract struct {
	Symbol       string `json:"symbol"`
	ProductType  int    `json:"product_type"`
	BaseCurrency string `json:"base_currency"`
	// QuoteCurrency is the settlement currency: USDT, USDC, or USD on the coin-margined inverse
	// contracts.
	QuoteCurrency string       `json:"quote_currency"`
	IndexPrice    adapters.Num `json:"index_price"`
	// ContractSize is base units per contract.
	ContractSize adapters.Num `json:"contract_size"`
	// OpenInterest is open interest in CONTRACTS.
	OpenInterest adapters.Num `json:"open_interest"`
	// Turnover24h is quote currency.
	Turnover24h adapters.Num `json:"turnover_24h"`
	// ExpectedFundingRate is the estimate for the settlement at FundingTime.
	ExpectedFundingRate adapters.Num `json:"expected_funding_rate"`
	// FundingTime is epoch ms of the next settlement.
	FundingTime          adapters.Num `json:"funding_time"`
	FundingIntervalHours adapters.Num `json:"funding_interval_hours"`
	MaxLeverage          adapters.Num `json:"max_leverage"`
	Status               string       `json:"status"`
	// DelistTime is epoch SECONDS; 0 when none is scheduled.
	DelistTime int64 `json:"delist_time"`
	// TradfiInfo is null on crypto contracts.
	TradfiInfo *TradfiInfo `json:"tradfi_info"`
}

// Details is the payload of /details.
type Details struct {
	Symbols []Contract `json:"symbols"`
}

type FundingHistoryItem struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"funding_rate"`
	// FundingTime is epoch ms of the settlement, quoted as a string here and as a number on /details.
	FundingTime adapters.Num `json:"funding_time"`
}

// FundingHistory is the payload of /funding-rate-history.
type FundingHistory struct {
	List []FundingHistoryItem `json:"list"`
}

// AssetClassFor is the class BitMart declares for a contract, from `tradfi_info.market_group` on
// /details.
//
// `tradfi_info` is null on every crypto contract and set on every tradfi one. Live 2026-09-14, of
// 228 tradable contracts: none on 151; US_MARKET 49 (shares, ETFs, and SPX500, NAS100, US30 and
// US2000, which MarketRefFor refines to index); HK_STOCK 14; FOREX 5 (EUR, JPY, GBP, TRY, BRL);
// INDEX_JP 2, INDEX_KR 2, INDEX_HK 1, INDEX_TW 1 (JPN225 and TW88 stay index; KIOXIA, SKHYNIX, HPSP
// and TRAHK are single names and refine to equity); METAL_LME 3 (XNI, XCU, XAL). That comes out as
// crypto 151, equity 63, index 6, fx 5, commodity 3.
//
// BitMart attaches no tradfi_info to XAUUSDT, XAGUSDT, PAXGUSDT, XAUTUSDT or CLUSDT, so gold, silver
// and crude are crypto here, by the venue's own declaration. A group this does not know is still
// tradfi.
func AssetClassFor(tradfi *TradfiInfo, base string) core.AssetClass {
	if tradfi == nil {
		return core.ClassCrypto
	}
	group := tradfi.MarketGroup
	if group == "US_MARKET" || group == "HK_STOCK" {
		return core.ClassEquity
	}
	if group == "FOREX" {
		return core.ClassFX
	}
	if strings.HasPrefix(group, "INDEX_") {
		return core.ClassIndex
	}
	if strings.HasPrefix(group, "METAL_") || strings.HasPrefix(group, "COMMODITY_") {
		return core.ClassCommodity
	}
	return core.ClassifyNonCrypto(core.CanonicalBase(base))
}

// IsTradable reports whether a /details row is a live USDT- or USDC-margined perpetual.
//
// Live 2026-09-14, 1,215 rows: 856 Delisted and 359 Trading. Of the Trading ones, 127 carry a
// `delist_time` in the past (all 2026-07-25) and are dead: zero turnover on every one, and empty
// books on THETAUSDT, ARBUSDT, HK50USDT and TENCENTUSDT. Four more are coin-margined inverse
// contracts quoted in USD (BTCUSD, ETHUSD, XRPUSD, SOLUSD, 10-100 USD a contract). That leaves 228:
// 227 USDT and BTCUSDC. A future `delist_time` is still trading and stays in.
func IsTradable(contract Contract, now int64) bool {
	return contract.Status == "Trading" &&
		contract.ProductType == perpetual &&
		(contract.QuoteCurrency == "USDT" || contract.QuoteCurrency == "USDC") &&
		!(contract.DelistTime > 0 && contract.DelistTime*1000 <= now)
}

// ParseSnapshots normalises every tradable contract from the one bulk /details response.
//
// The rate is `expected_funding_rate`, the estimate for `funding_time`. The row's `funding_rate` is
// not used: it is neither that estimate nor the last settlement. Measured 2026-09-14 against the
// per-symbol /funding-rate, whose `expected_rate` matches `expected_funding_rate` (SOL 0.0000725,
// DOGE 0.0000631, AXS 0.00005) and whose `rate_value` matches the newest /funding-rate-history row
// (SOL 0.0001, DOGE 0.0004), `funding_rate` read -0.0000111 for SOL and -0.0000034 for DOGE.
//
// /details carries no mark price and there is no bulk endpoint that does (only a per-symbol mark
// kline), so MarkPrice is nil and open interest is priced at the index.
func ParseSnapshots(env Envelope[Details], now int64) (core.SnapshotBatch, error) {
	details, err := env.unwrap("details")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	// An absent `symbols` is not an empty book: `"symbols": []` decodes to a non-nil empty slice,
	// while a missing or null field leaves it nil, which is the Go reading of the TypeScript
	// Array.isArray guard.
	if details.Symbols == nil {
		return core.SnapshotBatch{}, fmt.Errorf("bitmart details: expected a symbol list")
	}

	snapshots := make([]core.FundingSnapshot, 0, len(details.Symbols))
	for _, contract := range details.Symbols {
		if !IsTradable(contract, now) {
			continue
		}
		rate := contract.ExpectedFundingRate
		hours := contract.FundingIntervalHours
		if !rate.OK || !hours.OK || hours.Val <= 0 {
			continue
		}

		base := adapters.MarketRefFor(VenueID, contract.Symbol, adapters.Overrides{}).Base
		class := AssetClassFor(contract.TradfiInfo, base)
		quote := contract.QuoteCurrency
		ref := adapters.MarketRefFor(VenueID, contract.Symbol, adapters.Overrides{
			Quote:      &quote,
			HasQuote:   true,
			AssetClass: &class,
		})

		indexPrice := contract.IndexPrice.Ptr()
		interval := hours.Val
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          rate.Val,
			BasisHours:    hours.Val,
			IntervalHours: &interval,
			NextFundingAt: contract.FundingTime.PositiveMs(),
			Kind:          core.KindPredicted,
			// Nil, never zero: BitMart publishes no mark in any bulk call, so "no mark" is a routine
			// state here and the identity gate falls back to the index price (migration 020).
			MarkPrice:  nil,
			IndexPrice: indexPrice,
			// Contracts x base units per contract x price. BTCUSDT: 2,056,722 x 0.001 BTC x 77,296 =
			// $159.0m. `open_interest_value` ($155.0m there) is not used: on 179 contracts it sits 0.68x
			// to 1.55x off contracts x size x price -- BCHUSDT implies $329 a coin at a $224 price -- which
			// reads as entry notional, not the value of the open positions now.
			OpenInterestUSD: adapters.Mul(contract.OpenInterest.Ptr(), contract.ContractSize.Ptr(), indexPrice),
			// Quote turnover: BTCUSDT's 1,544,041,296 is 20,047,458 contracts x 0.001 x ~77,250.
			Volume24hUSD: contract.Turnover24h.Ptr(),
			MaxLeverage:  contract.MaxLeverage.Ptr(),
		})
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: []core.FundingEvent{}}, nil
}

// ParseFundingHistory returns settled funding inside [fromMs, toMs], oldest first, with the interval
// inferred from every row fetched so a one-event window still gets a basis.
//
// fallbackHours is nil where nothing has ever reported an interval for the market; an event with no
// basis is dropped rather than given an invented one.
func ParseFundingHistory(
	ref core.MarketRef,
	items []FundingHistoryItem,
	fromMs, toMs int64,
	fallbackHours *float64,
) []core.FundingEvent {
	// One rate per settlement timestamp, keeping the venue's own ordering: the first occurrence keeps
	// its position and the last wins on value, exactly as the TypeScript Map does. A bare Go map would
	// reshuffle the inference input per run.
	rates := make(map[int64]float64, len(items))
	order := make([]int64, 0, len(items))
	for _, item := range items {
		settledAt := item.FundingTime.PositiveMs()
		if settledAt == nil || !item.FundingRate.OK {
			continue
		}
		if _, seen := rates[*settledAt]; !seen {
			order = append(order, *settledAt)
		}
		rates[*settledAt] = item.FundingRate.Val
	}

	basisHours := fallbackHours
	if inferred := core.InferIntervalHours(order); inferred != nil {
		basisHours = inferred
	}
	if basisHours == nil {
		return []core.FundingEvent{}
	}

	events := make([]core.FundingEvent, 0, len(order))
	for _, settledAt := range order {
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		events = append(events, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       rates[settledAt],
			BasisHours: *basisHours,
			MarkPrice:  nil,
		})
	}
	sort.SliceStable(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
