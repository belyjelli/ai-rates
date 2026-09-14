// Package htx parses HTX's USDT-margined perpetual swaps.
//
// Ported from packages/adapters/src/venues/htx.ts.
//
// THE ONE THING THAT RUNS THROUGH EVERY FUNCTION HERE: HTX PUBLISHES NO MARK PRICE IN ANY BULK CALL.
// It serves a mark only per contract, as a mark-price kline, so a cycle covering the whole book
// cannot have one. MarkPrice is therefore nil on every snapshot and every event — deliberately, not
// for want of a field to read — rather than the last trade dressed up as a mark.
//
// A MARKET WITH NO MARK IS A REAL STATE ON THIS VENUE, NOT AN ERROR, and the database already knows
// it: migration 020 (020_gate_index_fallback.sql) moved the identity gate to
// coalesce(mark_price, index_price) precisely because of this venue. Under migration 016's gate a
// market with no mark agreed with any anchor by default, which would have let all 337 HTX swaps pass
// unexamined — and a token merely sharing a ticker (the MEME, AI and EDGE shape, 8x to 100x apart)
// would then pair as if it were the same asset. HTX does publish an index price, and mark and index
// differ by the funding basis, a fraction of a percent, far inside the gate's 10% band. So the index
// carries the identity test for this venue, which is why IndexPrice below is load-bearing in a way it
// is not on a venue that publishes both.
package htx

import (
	"sort"
	"strconv"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "htx"

// listing is `contract_status` 1. 3 is suspension (5 swaps on 2026-09-14); the rest are
// delist/delivery.
const listing = 1

// Envelope is HTX's uniform response wrapper. Data is generic because the bulk endpoints answer with
// an array while the history endpoint answers with a paging object.
type Envelope[T any] struct {
	Status string       `json:"status"`
	Data   T            `json:"data"`
	Ts     adapters.Num `json:"ts"`
	// ErrCode arrives as a JSON number (1017 for "Query not supported").
	ErrCode adapters.Num `json:"err_code"`
	// ErrMsg is a pointer so an absent message can fall back to the status, as `err_msg ?? status`
	// does on the TypeScript side; an empty message sent deliberately still prints as empty.
	ErrMsg *string `json:"err_msg"`
}

// MergedEnvelope is the ticker endpoint's wrapper, which carries `ticks` instead of `data`.
type MergedEnvelope struct {
	Status  string       `json:"status"`
	Ticks   []MergedTick `json:"ticks"`
	ErrCode adapters.Num `json:"err_code"`
	ErrMsg  *string      `json:"err_msg"`
}

type ContractInfo struct {
	// Symbol is the declared base, e.g. "BTC".
	Symbol       string `json:"symbol"`
	ContractCode string `json:"contract_code"`
	// ContractSize is base units per contract: 0.001 BTC, 1,000,000 PEPE.
	ContractSize   adapters.Num `json:"contract_size"`
	ContractStatus int          `json:"contract_status"`
	// SettlementPeriod is the settlement interval in hours, as a string: "1", "4" or "8".
	SettlementPeriod adapters.Num `json:"settlement_period"`
	// Labels are free tags. "tradfi" appears on exactly the rows that carry TradfiLabels.
	Labels []string `json:"labels"`
	// TradfiLabels is the declared class: Stocks, Indices, Metals, Commodities, or empty for crypto.
	TradfiLabels []string `json:"tradfi_labels"`
	BusinessType string   `json:"business_type"`
	ContractType string   `json:"contract_type"`
	// TradePartition is the margin and settlement currency of the partition the swap trades in
	// ("USDT").
	TradePartition string `json:"trade_partition"`
}

type FundingRate struct {
	ContractCode string `json:"contract_code"`
	// FundingRate is the rate for the funding period now running, paid at FundingTime. Null on
	// delivery futures.
	FundingRate adapters.Num `json:"funding_rate"`
	FundingTime adapters.Num `json:"funding_time"`
	// EstimatedRate is deprecated by HTX: null on all 346 rows on 2026-09-14.
	EstimatedRate   adapters.Num `json:"estimated_rate"`
	NextFundingTime adapters.Num `json:"next_funding_time"`
}

type OpenInterest struct {
	ContractCode string `json:"contract_code"`
	// Volume is open interest in contracts.
	Volume adapters.Num `json:"volume"`
	// Amount is open interest in base units (Volume x ContractSize).
	Amount adapters.Num `json:"amount"`
	// Value is open interest in the partition's currency (USDT).
	Value adapters.Num `json:"value"`
	// TradeTurnover is 24h turnover in the partition's currency (USDT).
	TradeTurnover adapters.Num `json:"trade_turnover"`
	BusinessType  string       `json:"business_type"`
}

type Index struct {
	ContractCode string       `json:"contract_code"`
	IndexPrice   adapters.Num `json:"index_price"`
}

// MergedTick is one market's top of book. Ask and Bid are [price, size in contracts]; a market with
// no book sends null, which decodes to a nil slice rather than to a pair of zeros.
type MergedTick struct {
	ContractCode string         `json:"contract_code"`
	Ask          []adapters.Num `json:"ask"`
	Bid          []adapters.Num `json:"bid"`
}

type FundingHistoryItem struct {
	ContractCode string       `json:"contract_code"`
	FundingRate  adapters.Num `json:"funding_rate"`
	FundingTime  adapters.Num `json:"funding_time"`
}

type FundingHistoryPage struct {
	TotalPage   int                  `json:"total_page"`
	CurrentPage int                  `json:"current_page"`
	TotalSize   int                  `json:"total_size"`
	Data        []FundingHistoryItem `json:"data"`
}

// errorFor is the error `unwrap` throws on the TypeScript side, with the same text: the code where
// one was sent, then the message, falling back to the status when HTX sends no message.
func (e Envelope[T]) errorFor(what string) error {
	message := e.Status
	if e.ErrMsg != nil {
		message = *e.ErrMsg
	}
	return &Error{What: what, Code: errCode(e.ErrCode), Message: message}
}

// errorFor on the ticker envelope falls back to an EMPTY message rather than to the status, which is
// what htx.ts does for this one endpoint.
func (e MergedEnvelope) errorFor() error {
	message := ""
	if e.ErrMsg != nil {
		message = *e.ErrMsg
	}
	return &Error{What: "batch merged", Code: errCode(e.ErrCode), Message: message}
}

// Error is a refused HTX response.
type Error struct {
	What    string
	Code    string
	Message string
}

func (e *Error) Error() string { return "htx " + e.What + ": " + e.Code + " " + e.Message }

func errCode(code adapters.Num) string {
	if !code.OK {
		return ""
	}
	return strconv.FormatFloat(code.Val, 'f', -1, 64)
}

// unwrapList returns a bulk endpoint's rows, or the venue's own error. A null or absent `data`
// decodes to a nil slice, which is the same refusal the TypeScript checks for.
func unwrapList[T any](envelope Envelope[[]T], what string) ([]T, error) {
	if envelope.Status != "ok" || envelope.Data == nil {
		return nil, envelope.errorFor(what)
	}
	return envelope.Data, nil
}

// unwrapPage is unwrapList for the history endpoint, whose `data` is an object. The pointer is what
// distinguishes a sent page from a null one; a value type would make a refusal look like an empty
// page.
func unwrapPage(envelope Envelope[*FundingHistoryPage], what string) (*FundingHistoryPage, error) {
	if envelope.Status != "ok" || envelope.Data == nil {
		return nil, envelope.errorFor(what)
	}
	return envelope.Data, nil
}

// AssetClassFor is the class HTX declares for a swap, from `tradfi_labels` and, failing that,
// `labels`, both in swap_contract_info.
//
// HTX declares in two places and fills them unevenly. Live 2026-09-14, 342 USDT swaps:
//   - 223 carry `tradfi_labels` (and "tradfi" in `labels`): ["Stocks"] 179, ["Stocks","Indices"] 27
//     (ETFs such as TQQQ, SOXX, XBI), ["Indices"] 7 (SPX500, NASDAQ100, and the ETFs SPY, QQQ, EWY,
//     EWJ, TBT), ["Metals"] 7 (XAU XAG XPT XPD COPPER, and the tokens PAXG and XAUT) and
//     ["Commodities"] 3 (USOIL BRENTOIL NATGAS).
//   - 12 carry only a lowercase `labels` tag: "stock" on GFS BYD ASX DJT GE FCX XOM CIFR APD MRK, and
//     "indices" on the ETFs XLU and XLK. Reading `tradfi_labels` alone filed Exxon as a crypto token.
//   - 107 carry neither and are crypto. EURUSD is among them: HTX declares nothing for it.
//
// `tradfi_labels` wins where both speak, and Stocks wins over Indices, because every row carrying
// both is an ETF, which is equity everywhere; MarketRefFor then moves the real indices (JP225 is
// filed under Stocks) to index. A row flagged tradfi with labels this does not know is still not
// crypto, so the base tables pick the class.
func AssetClassFor(contract ContractInfo, base string) core.AssetClass {
	tradfi := contract.TradfiLabels
	labels := contract.Labels
	switch {
	case has(tradfi, "Metals"), has(tradfi, "Commodities"):
		return core.ClassCommodity
	case has(tradfi, "Stocks"):
		return core.ClassEquity
	case has(tradfi, "Indices"):
		return core.ClassIndex
	case has(labels, "commodities"):
		return core.ClassCommodity
	case has(labels, "stock"):
		return core.ClassEquity
	case has(labels, "indices"):
		return core.ClassIndex
	case len(tradfi) > 0, has(labels, "tradfi"):
		return core.ClassifyNonCrypto(core.CanonicalBase(base))
	default:
		return core.ClassCrypto
	}
}

func has(labels []string, want string) bool {
	for _, label := range labels {
		if label == want {
			return true
		}
	}
	return false
}

// TradableSwaps is the listing USDT-margined perpetual swaps, by contract code. Delivery futures and
// suspended swaps are out.
//
// A plain Go map is safe here where gate needed a parallel order slice: nothing iterates this, it is
// only ever looked up by contract code, and the output order of ParseSnapshots comes from the funding
// array instead.
func TradableSwaps(contracts []ContractInfo) map[string]ContractInfo {
	swaps := make(map[string]ContractInfo, len(contracts))
	for _, contract := range contracts {
		if contract.BusinessType != "swap" || contract.ContractType != "swap" ||
			contract.ContractStatus != listing ||
			!contract.SettlementPeriod.OK || contract.SettlementPeriod.Val <= 0 {
			continue
		}
		swaps[contract.ContractCode] = contract
	}
	return swaps
}

// SnapshotInput is one cycle's four bulk responses, joined onto the cached contract list.
type SnapshotInput struct {
	Contracts    map[string]ContractInfo
	Funding      []FundingRate
	OpenInterest []OpenInterest
	Indices      []Index
	Ticks        []MergedTick
}

// ParseSnapshots joins the bulk funding, open interest, index and ticker responses onto listing
// swaps.
//
// Units, checked against the live responses of 2026-09-14 05:01 UTC:
//   - `funding_rate` is the running period's rate and `funding_time` the settlement it is paid at:
//     BTC-USDT read 0.0000431 and then 0.0000405 two minutes later, both against 00:00 UTC, while
//     swap_historical_funding_rate filed the previous 16:00 settlement under that time. It is a
//     fraction per `settlement_period` hours (JP225, a 1h swap, settles 0.00000625 hourly).
//   - `value` is USDT already: BTC-USDT 2,221,334,022 against amount 28,808.125 BTC x index 77,153.6
//     = 2,222,678,044 (0.06%, mark against index), and PEPE-USDT, at 1,000,000 PEPE a contract,
//     418,429 against 417,888. So no contract size is applied to it.
//   - `trade_turnover` is USDT: BTC-USDT 145,152,803 against trade_amount 1,884.88 BTC x index.
//   - Ticker sizes are contracts: BTC-USDT's bid of 20 is 20 x 0.001 BTC, about $1,542.
//
// HTX publishes mark price only per contract (a mark-price kline), so MarkPrice is nil rather than
// the last trade dressed up as a mark.
func ParseSnapshots(input SnapshotInput, now int64) []core.FundingSnapshot {
	openInterest := make(map[string]OpenInterest, len(input.OpenInterest))
	for _, row := range input.OpenInterest {
		openInterest[row.ContractCode] = row
	}
	indices := make(map[string]adapters.Num, len(input.Indices))
	for _, row := range input.Indices {
		indices[row.ContractCode] = row.IndexPrice
	}
	ticks := make(map[string]MergedTick, len(input.Ticks))
	for _, row := range input.Ticks {
		ticks[row.ContractCode] = row
	}

	// Ranged over the funding ARRAY, so the output keeps the venue's own order rather than a Go map's
	// per-run shuffle.
	snapshots := make([]core.FundingSnapshot, 0, len(input.Funding))
	for _, row := range input.Funding {
		contract, listed := input.Contracts[row.ContractCode]
		hours := contract.SettlementPeriod
		if !listed || !row.FundingRate.OK || !hours.OK || hours.Val <= 0 {
			continue
		}

		base := adapters.MarketRefFor(VenueID, row.ContractCode, adapters.Overrides{}).Base
		class := AssetClassFor(contract, base)
		ref := adapters.MarketRefFor(VenueID, row.ContractCode, contractOverrides(contract, class))

		tick := ticks[row.ContractCode]
		oi := openInterest[row.ContractCode]
		size := contract.ContractSize.Ptr()
		bidPrice := level(tick.Bid, 0)
		askPrice := level(tick.Ask, 0)
		index := indices[row.ContractCode]
		interval := hours.Val

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          row.FundingRate.Val,
			BasisHours:    hours.Val,
			IntervalHours: &interval,
			NextFundingAt: row.FundingTime.PositiveMs(),
			Kind:          core.KindPredicted,
			// Published only per contract, so not faked from the last trade. Migration 020 gates this
			// venue's identity on the index below instead.
			MarkPrice:  nil,
			IndexPrice: index.Ptr(),
			BestBid:    bidPrice,
			// Ticker sizes are CONTRACTS, so the depth is size x contract_size x price: a BTC bid of
			// 20 is 0.02 BTC, about $1,542 — not 20 dollars and not 20 coins.
			BestBidSizeUSD:  adapters.Mul(level(tick.Bid, 1), size, bidPrice),
			BestAsk:         askPrice,
			BestAskSizeUSD:  adapters.Mul(level(tick.Ask, 1), size, askPrice),
			OpenInterestUSD: oi.Value.Ptr(),
			Volume24hUSD:    oi.TradeTurnover.Ptr(),
		})
	}
	return snapshots
}

// contractOverrides is what the venue states outright: the partition it settles in, and the class it
// declares. An empty partition is a market with no quote currency, so it overrides to nil rather than
// letting the symbol supply one.
func contractOverrides(contract ContractInfo, class core.AssetClass) adapters.Overrides {
	overrides := adapters.Overrides{HasQuote: true, AssetClass: &class}
	if contract.TradePartition != "" {
		partition := contract.TradePartition
		overrides.Quote = &partition
	}
	return overrides
}

// level reads one field of a [price, size] book level. A market with an empty book sends null and a
// malformed one could send a short array, so both read as absent rather than as zero.
func level(side []adapters.Num, i int) *float64 {
	if i >= len(side) {
		return nil
	}
	return side[i].Ptr()
}

// ParseFundingHistory returns settlements for one swap in [fromMs, toMs], oldest first.
//
// Each basis is the gap to the nearest neighbouring settlement, measured over every row fetched and
// not only those inside the window: the collector usually asks for a window holding one new
// settlement, and its neighbours just outside are what say how long that period was.
//
// contract is nil when history runs before any snapshot cycle has read the contract list; the events
// then carry the class and quote parsed off the symbol, exactly as the TypeScript does.
func ParseFundingHistory(
	venueSymbol string,
	rows []FundingHistoryItem,
	fromMs, toMs int64,
	fallbackHours *float64,
	contract *ContractInfo,
) []core.FundingEvent {
	byTime := make(map[int64]float64, len(rows))
	for _, row := range rows {
		if !row.FundingTime.OK || !row.FundingRate.OK {
			continue
		}
		// Last row wins for a repeated settlement, as the TypeScript Map does.
		byTime[int64(row.FundingTime.Val)] = row.FundingRate.Val
	}

	times := make([]int64, 0, len(byTime))
	for at := range byTime {
		times = append(times, at)
	}
	// Sorted, so the map's iteration order never reaches the output.
	sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })

	// The family helper htx.ts imports from aster.ts, for the same reason: one settlement missed must
	// not double its neighbour's basis, so each row takes the SMALLER of its two gaps.
	basis := adapters.BasisHoursFromGaps(times, fallbackHours)

	overrides := adapters.Overrides{}
	if contract != nil {
		base := adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{}).Base
		overrides = contractOverrides(*contract, AssetClassFor(*contract, base))
	}
	ref := adapters.MarketRefFor(VenueID, venueSymbol, overrides)

	events := make([]core.FundingEvent, 0, len(times))
	for i, settledAt := range times {
		if settledAt < fromMs || settledAt > toMs || basis[i] == nil {
			continue
		}
		events = append(events, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       byTime[settledAt],
			BasisHours: *basis[i],
			// No bulk mark on this venue; see the package comment.
			MarkPrice: nil,
		})
	}
	return events
}
