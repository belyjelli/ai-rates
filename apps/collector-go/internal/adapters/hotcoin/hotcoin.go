// Package hotcoin parses Hotcoin's perpetuals.
//
// Ported from packages/adapters/src/venues/hotcoin.ts. ONLY THE LAST SETTLED RATE IS AVAILABLE IN
// BULK, so every snapshot is core.KindSettled.
//
// Measured from this machine on 2026-09-13 22:10-22:20 UTC (docs: hotcoinex.github.io/en/swap):
//
//   - `fund` ON THE BULK /perpetual/public IS THE LAST SETTLED RATE. It equals
//     `premiumIndex.lastFeeRate` for every contract checked (BTC 0.0000645, ETH 0.00004585, BTCUSDC
//     0.00003907), and the newest row of `fee-rate` history, stamped 16:00:53 for BTCUSDT. It equals
//     Binance's own 16:00 settled rate on 173 of 316 shared symbols, and not one of 558 values moved
//     between reads a minute apart. Polled every 5 minutes from 22:14 to 00:10, nothing moved until
//     the 00:00 settlement; by 00:05 358 had, BTCUSDT to 0.0001143464450483, which is the fee-rate
//     row then written at 00:01:46. Binance settled BTCUSDT at 0.00007157, so this is Hotcoin's own
//     rate. The estimate lives only in per-contract `/{code}/premiumIndex.estimateFeeRate` (BTC
//     0.00007737 at the same moment), and 549 of those per minute would blow the 10/s budget, so it
//     is not collected.
//   - NO INTERVAL ANYWHERE IN BULK. `nextLiquidationInterval` is 0 and `countDownTimeInterval` ""
//     on every row, and `liquidationTime` (the next settlement, epoch ms) was 00:00 UTC on 557 rows,
//     which a 1h, 4h and 8h market all share. The interval is therefore read per contract from the
//     spacing of its last settlements in `/{code}/fee-rate`, a few per cycle, cached for six hours.
//     A full sweep of all 549 (550 requests in 101s, no 429) read 8h on 291, 4h on 257 and 1h on
//     one, IOSTUSDT, the one row whose `liquidationTime` was 23:00. WarmUp skips the cold-start
//     sweep.
//   - HISTORY: `/{code}/fee-rate?page=&pageSize=`, newest first, `pageSize` capped at 100 (500
//     returns 100), `total` 7,139 for BTCUSDT. Rows are stamped up to three minutes after the hour
//     (16:02:48, 21:02:17), so settlement times are snapped back to the hour; see SettlementTime.
//   - UNITS: `unitAmount` is base units per contract (BTCUSDT 0.001). `size24` is quote turnover:
//     `amount24` contracts x `unitAmount` x mark gives it to a median ratio of 1.009 over all linear
//     rows (1st-99th percentile 0.97-1.07). BTCUSDT: $1.54bn volume against Binance's $4.71bn, and
//     `totalPosition` 7,262,189 contracts = $559M open interest against Binance's $8.04bn. Rates are
//     fractions per interval: BTCUSDT 0.0000645 over 8h is 7.1% APR, Binance settled the same.
//   - OPEN INTEREST OF "0" IS NOT REPORTED, NOT ZERO. 70 of 558 rows say 0, all nine USDC markets
//     among them: BTCUSDC turned over $126.6M in the same 24h. A book that trades that much with
//     nothing open is not a figure, so zero becomes nil.
//   - TRADABILITY: 558 rows. 9 are inverse (`direction` 1, margined in the coin, quoted in USD:
//     BTCUSD, ETHUSD...) and are dropped; the rest are linear with `base` (the MARGIN coin, despite
//     the name) equal to `quote`: 540 USDT and 9 USDC, 549 collected. Every row has `env` 0
//     ("listing"; 1 is testing) and `tradeStatus` 0, both required.
//   - CLASS: Hotcoin lists tradfi (NAS100, US30, KR200, SKHYNIX, SAMSUNG, COPPER, SOFTBANK,
//     HYUNDAI) but DECLARES NOTHING: `assetCategory` 0, `isPushTradfi` 0, `tradfiTagName` and
//     `tradfiTagNameEn` "", `tags` [] on all 558 rows, and query parameters on those names change
//     nothing. So all 549 are crypto today; see AssetClassFor for when those fields fill.
//   - BASE: `indexBaseDisplayName` is declared. The parser agrees with it on all 558 symbols except
//     seven contract-size prefixes (1000PEPE, 1000000MOG, 10000NEX...), which it reads as
//     multipliers.
//   - RATE LIMIT: public market endpoints are documented at 10 requests/s per IP, 429 beyond it and
//     an IP ban for continued violation, hence 150ms spacing.
package hotcoin

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "hotcoin"

// API is the bulk endpoint, and the prefix every per-contract path hangs off.
const API = "https://api-ct.hotcoin.fit/api/v1/perpetual/public"

const (
	// IntervalRefreshBudget is per-contract fee-rate calls allowed per cycle. At this budget a cold
	// start covers the 549 collected contracts in 14 cycles.
	IntervalRefreshBudget = 40
	// IntervalMaxAgeMs: re-read each contract's interval this often.
	IntervalMaxAgeMs int64 = 6 * 60 * 60_000
	// intervalRetryMs: a contract with no settlement yet has no interval to read; look again after
	// this long.
	intervalRetryMs int64 = 30 * 60_000
	// intervalSample: four settlements give three gaps, so one missed or late settlement cannot move
	// the median.
	intervalSample = 4

	// HistoryPageSize: `pageSize` above 100 is served as 100 (measured 2026-09-13).
	HistoryPageSize = 100
	// historyMaxPages: BTCUSDT's 7,139 settlements are 72 pages; the collector asks for far shorter
	// windows.
	historyMaxPages = 80

	hourMs   = 3_600_000.0
	minuteMs = 60_000.0
	// settlementLagMs: settlement stamps land this far after the hour at most; anything later is
	// kept to the minute.
	settlementLagMs = 10 * minuteMs
)

// marginCoins are the margin coins collected. Hotcoin's linear book is margined in one of these and
// quoted in the same coin.
var marginCoins = map[string]struct{}{"USDT": {}, "USDC": {}}

// Envelope is Hotcoin's uniform response wrapper.
//
// Data is a pointer so that a `data: null` body -- which is what a non-200 code sends -- is
// distinguishable from an empty list, exactly as the TypeScript's `data === null` check is.
type Envelope[T any] struct {
	Code int    `json:"code"`
	Data *T     `json:"data"`
	Msg  string `json:"msg"`
}

// unwrap fails the call on anything but a 200 envelope carrying data, so a venue-side error reads as
// a failure rather than as an empty venue. A body whose `data` is not the shape asked for fails in
// the decoder, which is where the TypeScript's Array.isArray guard lands.
func (e Envelope[T]) unwrap(what string) (T, error) {
	if e.Code != 200 || e.Data == nil {
		var zero T
		return zero, fmt.Errorf("hotcoin: unexpected %s response: %d %s", what, e.Code, e.Msg)
	}
	return *e.Data, nil
}

// Ticker is one /perpetual/public row, with only the fields this adapter reads.
//
// Direction, Env and TradeStatus are Num rather than int because 0 is the collectable value for all
// three: decoding an absent field to 0 would promote a row that declares nothing into a live linear
// listing. The TypeScript drops such a row (`undefined !== 0`), and so does MarginCoin.
//
// BaseDisplayName, QuoteDisplayName and IndexBaseDisplayName are pointers for the same reason one
// layer up: the TypeScript falls back to `base`/`quote` only when the display name is ABSENT, while
// a present empty string drops the row. "" and absent must stay distinguishable to keep that.
type Ticker struct {
	// Code is the lowercase contract code, the identifier every per-contract path takes: "btcusdt".
	Code            string  `json:"code"`
	CodeDisplayName string  `json:"codeDisplayName"`
	Base            string  `json:"base"`
	BaseDisplayName *string `json:"baseDisplayName"`
	Quote           string  `json:"quote"`
	// QuoteDisplayName is the MARGIN coin's display name; `base` is the margin coin too, despite the
	// name, on every linear contract.
	QuoteDisplayName *string `json:"quoteDisplayName"`
	// IndexBaseDisplayName is the underlying as declared: "BTC", "1000PEPE", "NAS100".
	IndexBaseDisplayName *string `json:"indexBaseDisplayName"`
	// Direction is 0 linear, 1 inverse.
	Direction adapters.Num `json:"direction"`
	// Env is 0 listing, 1 testing.
	Env         adapters.Num `json:"env"`
	TradeStatus adapters.Num `json:"tradeStatus"`
	// Fund is the last SETTLED rate, a fraction per settlement interval.
	Fund       adapters.Num `json:"fund"`
	MarkPrice  adapters.Num `json:"markPrice"`
	IndexPrice adapters.Num `json:"indexPrice"`
	// LiquidationTime is the next settlement, epoch ms.
	LiquidationTime adapters.Num `json:"liquidationTime"`
	// TotalPosition is open interest in CONTRACTS; "0" where Hotcoin does not report it.
	TotalPosition adapters.Num `json:"totalPosition"`
	// Size24 is 24h turnover in the margin coin.
	Size24 adapters.Num `json:"size24"`
	// UnitAmount is base units per contract.
	UnitAmount adapters.Num `json:"unitAmount"`
	MaxLever   adapters.Num `json:"maxLever"`

	AssetCategory   adapters.Num `json:"assetCategory"`
	IsPushTradfi    adapters.Num `json:"isPushTradfi"`
	TradfiTagName   string       `json:"tradfiTagName"`
	TradfiTagNameEn string       `json:"tradfiTagNameEn"`
}

// FeeRate is one settlement row of `/{code}/fee-rate`.
type FeeRate struct {
	ContractCode string `json:"contractCode"`
	// FeeRate is the settled rate, a fraction per interval. Served as a JSON number.
	FeeRate adapters.Num `json:"feeRate"`
	// CreatedDate is epoch ms, up to a few minutes after the settlement it records.
	CreatedDate adapters.Num `json:"createdDate"`
}

// FeeRatePage is one page of settlement history.
type FeeRatePage struct {
	Rows  []FeeRate    `json:"rows"`
	Total adapters.Num `json:"total"`
}

// IntervalEntry is one contract's cached settlement interval.
//
// Hours is a pointer because a contract that has not settled yet has no interval to cache, and that
// is different from having no entry at all: an entry with nil hours is what holds the retry
// back-dating, so the contract is re-read in 30 minutes rather than immediately every cycle.
type IntervalEntry struct {
	Hours     *float64
	FetchedAt int64
}

// upperOr is `primary?.toUpperCase() ?? fallback.toUpperCase()`: the fallback is taken only when the
// display name is ABSENT, never when it is present and empty.
func upperOr(primary *string, fallback string) string {
	if primary != nil {
		return strings.ToUpper(*primary)
	}
	return strings.ToUpper(fallback)
}

// MarginCoin is the margin coin, upper-cased, for a linear USDT or USDC contract Hotcoin lists as
// live; "" otherwise, which is the TypeScript's null.
func MarginCoin(ticker Ticker) string {
	if !ticker.Direction.OK || ticker.Direction.Val != 0 ||
		!ticker.Env.OK || ticker.Env.Val != 0 ||
		!ticker.TradeStatus.OK || ticker.TradeStatus.Val != 0 {
		return ""
	}
	margin := upperOr(ticker.BaseDisplayName, ticker.Base)
	quote := upperOr(ticker.QuoteDisplayName, ticker.Quote)
	if margin == "" || margin != quote {
		return ""
	}
	if _, collected := marginCoins[margin]; !collected {
		return ""
	}
	return margin
}

// TradableTickers is the collected contracts, in the venue's own order, with a lookup by code.
//
// The order slice is carried alongside the map rather than ranging the map, because Go map iteration
// is randomised while the TypeScript Map preserves insertion order -- and that order decides which
// contracts a budgeted refresh batch spends itself on.
func TradableTickers(rows []Ticker) ([]string, map[string]Ticker) {
	codes := make([]string, 0, len(rows))
	byCode := make(map[string]Ticker, len(rows))
	for _, row := range rows {
		if MarginCoin(row) == "" {
			continue
		}
		if _, seen := byCode[row.Code]; !seen {
			codes = append(codes, row.Code)
		}
		byCode[row.Code] = row
	}
	return codes, byCode
}

// AssetClassFor is Hotcoin's declared class. It declares nothing today (see the package comment), so
// every market is crypto.
//
// Its payload does carry tradfi fields -- `assetCategory`, `isPushTradfi`, `tradfiTagName` -- and a
// row that fills any of them is saying "not crypto" in a vocabulary we have never seen, so the base
// tables settle which class rather than a guess at what the tag means.
func AssetClassFor(ticker Ticker, base string) core.AssetClass {
	flagged := (ticker.AssetCategory.OK && ticker.AssetCategory.Val != 0) ||
		(ticker.IsPushTradfi.OK && ticker.IsPushTradfi.Val != 0) ||
		ticker.TradfiTagName != "" ||
		ticker.TradfiTagNameEn != ""
	if flagged {
		return core.ClassifyNonCrypto(base)
	}
	return core.ClassCrypto
}

// declaredBase is the base to override the parsed one with, or "" where the parser already agrees
// with the venue. 1000PEPE and NAS100 are what reach it here.
//
// The declaration arrives behind a pointer, and absent is not the same as empty: the nil check is
// Hotcoin's own plumbing, done before the shared rule sees anything. The margin coin is the quote
// on every linear contract here, which is why it is what gets screened.
func declaredBase(symbol string, indexBaseDisplayName *string, marginCoin string) string {
	if indexBaseDisplayName == nil {
		return ""
	}
	return adapters.DeclaredMarketBase(symbol, *indexBaseDisplayName, marginCoin)
}

// SettlementTime is when a settlement happened, from the stamp on its history row.
//
// Hotcoin writes the row up to three minutes after the hour (BTCUSDT 16:02:48, IOSTUSDT 21:02:17),
// and every interval it runs is whole hours, so a stamp within ten minutes of an hour is that hour.
// Anything else is kept to the minute rather than forced onto a boundary it may not belong to.
func SettlementTime(createdDate int64) int64 {
	hour := int64(math.Round(float64(createdDate)/hourMs) * hourMs)
	if diff := createdDate - hour; diff <= settlementLagMs && diff >= -settlementLagMs {
		return hour
	}
	return int64(math.Round(float64(createdDate)/minuteMs) * minuteMs)
}

// IntervalHours is the settlement interval from a contract's newest settlements, or from its only
// one and the next.
func IntervalHours(rows []FeeRate, nextFundingAt *int64) *float64 {
	times := make([]int64, 0, len(rows))
	seen := make(map[int64]struct{}, len(rows))
	for _, row := range rows {
		if !row.CreatedDate.OK || row.CreatedDate.Val <= 0 {
			continue
		}
		// Deduplicated AFTER snapping, as the TypeScript Set is: two rows written either side of a
		// minute boundary record one settlement, not two.
		at := SettlementTime(int64(row.CreatedDate.Val))
		if _, repeat := seen[at]; repeat {
			continue
		}
		seen[at] = struct{}{}
		times = append(times, at)
	}
	if len(times) >= 2 {
		return core.InferIntervalHours(times)
	}
	if len(times) == 1 {
		return adapters.HoursBetween(&times[0], nextFundingAt)
	}
	return nil
}

// ParseSnapshots normalises one cycle's /perpetual/public rows.
//
// A contract appears once its interval is known: a settled rate means nothing without its basis.
// Ranged over the ROW SLICE, so the output keeps the venue's own order; the interval map is only
// ever looked up, never iterated, so no Go map ordering reaches the result.
func ParseSnapshots(rows []Ticker, intervals map[string]IntervalEntry, now int64) []core.FundingSnapshot {
	snapshots := make([]core.FundingSnapshot, 0, len(rows))
	for _, row := range rows {
		margin := MarginCoin(row)
		if margin == "" || !row.Fund.OK {
			continue
		}
		hours := intervals[row.Code].Hours
		if hours == nil || !(*hours > 0) {
			continue
		}

		symbol := row.CodeDisplayName
		if symbol == "" {
			symbol = row.Code
		}
		overrides := adapters.Overrides{Quote: &margin, HasQuote: true}
		if declared := declaredBase(symbol, row.IndexBaseDisplayName, margin); declared != "" {
			overrides.Base = &declared
		}

		base := adapters.MarketRefFor(VenueID, row.Code, overrides).Base
		class := AssetClassFor(row, base)
		classed := overrides
		classed.AssetClass = &class

		markPrice := row.MarkPrice.Ptr()
		// An open interest of 0 is unreported, not zero: BTCUSDC turned over $126.6M in the same 24h.
		var openInterestUSD *float64
		if row.TotalPosition.OK && row.TotalPosition.Val != 0 {
			openInterestUSD = adapters.Mul(row.TotalPosition.Ptr(), row.UnitAmount.Ptr(), markPrice)
		}

		basisHours := *hours
		intervalHours := *hours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     adapters.MarketRefFor(VenueID, row.Code, classed),
			ObservedAt:    now,
			Rate:          row.Fund.Val,
			BasisHours:    basisHours,
			IntervalHours: &intervalHours,
			NextFundingAt: row.LiquidationTime.PositiveMs(),
			// The bulk `fund` is the LAST SETTLED rate, never an estimate; see the package comment.
			Kind:            core.KindSettled,
			MarkPrice:       markPrice,
			IndexPrice:      row.IndexPrice.Ptr(),
			OpenInterestUSD: openInterestUSD,
			Volume24hUSD:    row.Size24.Ptr(),
			MaxLeverage:     row.MaxLever.Ptr(),
		})
	}
	return snapshots
}

// ParseFundingHistory returns settled events in [fromMs, toMs], oldest first, one per settlement
// time.
func ParseFundingHistory(
	venueSymbol string,
	rows []FeeRate,
	fromMs, toMs int64,
	fallbackHours *float64,
	assetClass *core.AssetClass,
) []core.FundingEvent {
	byTime := make(map[int64]float64, len(rows))
	times := make([]int64, 0, len(rows))
	for _, row := range rows {
		if !row.CreatedDate.OK || row.CreatedDate.Val <= 0 || !row.FeeRate.OK {
			continue
		}
		at := SettlementTime(int64(row.CreatedDate.Val))
		if at < fromMs || at > toMs {
			continue
		}
		// FIRST write wins, as the TypeScript's `!byTime.has(time)` does: pages overlap, and the
		// newest page is the one asked for first.
		if _, repeat := byTime[at]; repeat {
			continue
		}
		byTime[at] = row.FeeRate.Val
		times = append(times, at)
	}
	sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })

	basis := adapters.BasisHoursFromGaps(times, fallbackHours)
	ref := adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{AssetClass: assetClass})

	events := make([]core.FundingEvent, 0, len(times))
	for i, settledAt := range times {
		basisHours := basis[i]
		if basisHours == nil {
			continue
		}
		events = append(events, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       byTime[settledAt],
			BasisHours: *basisHours,
			MarkPrice:  nil,
		})
	}
	return events
}
