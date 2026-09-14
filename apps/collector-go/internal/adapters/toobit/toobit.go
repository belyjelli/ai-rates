// Package toobit parses Toobit's USDT- and USDC-margined perpetuals.
//
// Ported from packages/adapters/src/venues/toobit.ts. Measured from that machine on 2026-09-13
// 22:28-22:36 UTC (docs: api-docs.toobit.com):
//
//   - FUNDING IS NOT PER-SYMBOL ONLY. `/api/v1/futures/fundingRate` without `symbol` answers for all
//     804 perpetuals in one call (358 at 8H, 441 at 4H, 5 at 1H), 45 of them `TBV_` shadow books that
//     exchangeInfo does not list. Mark (`/quote/v1/markPrice`), index (`/quote/v1/index`, keyed by the
//     contract's `indexToken`), 24h ticker and book ticker are bulk too, so a cycle is five requests
//     and exchangeInfo once an hour. Nothing is budgeted per symbol.
//   - `rate` IS THE ESTIMATE FOR THE NEXT SETTLEMENT, PER `period`. BTC-SWAP-USDT read 0.00006548 and
//     ETH 0.00006435 for the 00:00 UTC settlement: Binance's own estimates at the same second, to
//     every digit. The 16:00 settlements in history, 0.0000645 and -0.00004585 (from coinw's matching
//     feed), are Binance's 16:00 settlements. So Toobit mirrors Binance's funding; the basis is the
//     declared period, as Binance's is.
//   - UNITS. `contractMultiplier` is base coin per contract. The bulk ticker's `v` is CONTRACTS
//     despite the docs' "base asset volume": BTC's `qv` 4,275,918,831 / `v` 55,588,153.5 = 76.92,
//     which is price x 0.001, and ETH's gives 2,493 x 0.01. `qv` is quote turnover. `op` is open
//     interest in contracts: BTC's 797,290.398 x 0.001 is exactly the 797.290398 BTC that
//     `/quote/v1/openInterest?symbol=` returned in the same second, $61M at a 76,805 mark. Book
//     quantities are contracts too (BTC 11,595 at the bid is 11.6 BTC, not $890M).
//   - TRADABILITY. 759 contracts in exchangeInfo, all TRADING and none inverse: 749 margined in USDT
//     and 10 in USDC, all collected. The ticker also serves 242 books exchangeInfo does not list
//     (`TBV_` duplicates, delisted REN and WAVES); only listed contracts are joined.
//   - CLASS. `isRwa` is true on 237 contracts, and their `rwaType` is `STOCK` on every one of them,
//     gold, EUR, VIX and the Dow included. So `rwaType` says "not crypto" rather than which class, and
//     the class comes from ClassifyNonCrypto.
//   - BASE. `underlying` is declared. Checked against the parser on all 759: they agree except eleven
//     contract-size prefixes (1000PEPE, 1000000MOG...), which the parser reads as multipliers, SPX500
//     and NG, which both sides canonicalise to US500 and NATGAS, and ID2-SWAP-USDT, whose underlying
//     and index are ID. That one takes the declared base.
//   - HISTORY: `/api/v1/futures/historyFundingRate?symbol=&limit=&fromId=`, newest first, `limit` at
//     most 1,000 (1,500 is rejected). `endTime` is ignored; `fromId` returns rows with a smaller id.
//   - RATE LIMIT: 3,000 request weight a minute per IP (exchangeInfo `rateLimits`). The bulk 24h
//     ticker weighs 40 and the rest 1, so a cycle is about 45.
package toobit

import (
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "toobit"

// dollarQuotes are the settlement coins a collected contract may be margined and quoted in. Toobit's
// own list, and narrower than the one declaredBase screens on: this decides what is COLLECTED.
var dollarQuotes = map[string]struct{}{"USDT": {}, "USDC": {}}

// Contract is one row of exchangeInfo.
type Contract struct {
	Symbol  string `json:"symbol"`
	Status  string `json:"status"`
	Inverse bool   `json:"inverse"`
	// Underlying is the base asset Toobit declares: `ID` for ID2-SWAP-USDT.
	Underlying string `json:"underlying"`
	// IndexToken is the key into /quote/v1/index.
	IndexToken  string `json:"indexToken"`
	MarginToken string `json:"marginToken"`
	QuoteAsset  string `json:"quoteAsset"`
	// ContractMultiplier is base coin per contract.
	ContractMultiplier adapters.Num `json:"contractMultiplier"`
	// IsRwa is Toobit's only class signal. Absent reads as false, which is the `=== true` the
	// TypeScript tests: a row that does not declare itself an RWA is crypto.
	IsRwa bool `json:"isRwa"`
	// RwaType is `STOCK` on every RWA contract, commodities and currencies included. Carried because
	// the venue sends it, and deliberately NOT read; see AssetClassFor.
	RwaType    string   `json:"rwaType"`
	Categories []string `json:"categories"`
}

// ExchangeInfo is /api/v1/exchangeInfo.
//
// Contracts is a slice rather than a count because absent and empty have to stay apart: JSON `[]`
// decodes to a non-nil empty slice and a missing or null field to nil, which is the `Array.isArray`
// refusal the TypeScript makes.
type ExchangeInfo struct {
	Contracts []Contract `json:"contracts"`
}

// FundingRate is one row of the bulk /api/v1/futures/fundingRate.
type FundingRate struct {
	Symbol string `json:"symbol"`
	// Rate is the estimate for the settlement at NextFundingTime, over Period.
	Rate            adapters.Num `json:"rate"`
	Period          string       `json:"period"`
	NextFundingTime adapters.Num `json:"nextFundingTime"`
}

// Ticker is one row of the bulk 24h ticker.
type Ticker struct {
	S string `json:"s"`
	// C is the last price.
	C adapters.Num `json:"c"`
	// Qv is quote turnover.
	Qv adapters.Num `json:"qv"`
	// Op is open interest, in CONTRACTS.
	Op adapters.Num `json:"op"`
}

type MarkPrice struct {
	SymbolID string       `json:"symbolId"`
	Price    adapters.Num `json:"price"`
}

// Index is /quote/v1/index, keyed by each contract's `indexToken` rather than by its symbol.
type Index struct {
	Index map[string]adapters.Num `json:"index"`
}

type BookTicker struct {
	S string       `json:"s"`
	B adapters.Num `json:"b"`
	// Bq and Aq are CONTRACTS, not base units.
	Bq adapters.Num `json:"bq"`
	A  adapters.Num `json:"a"`
	Aq adapters.Num `json:"aq"`
}

type FundingHistoryRow struct {
	// ID is the paging cursor, kept as the venue spelt it: it goes back out in `fromId`.
	ID         string       `json:"id"`
	Symbol     string       `json:"symbol"`
	SettleTime adapters.Num `json:"settleTime"`
	SettleRate adapters.Num `json:"settleRate"`
	Period     string       `json:"period"`
}

// IsTradable is a listed, trading, linear perpetual margined and quoted in USDT or USDC.
func IsTradable(contract Contract) bool {
	if contract.Status != "TRADING" || contract.Inverse {
		return false
	}
	if _, isDollar := dollarQuotes[contract.MarginToken]; !isDollar {
		return false
	}
	return contract.QuoteAsset == contract.MarginToken
}

// AssetClassFor is the class Toobit implies for a contract.
//
// `isRwa` is its only class signal; its `rwaType` is STOCK even for gold, so it cannot pick the
// class and the base tables do. That is also why XTI and XBR sit in core's commodity table rather
// than falling through to the equity `rwaType` would otherwise imply: measured 2026-09-13, XTI marks
// 98.78 against CL's 98.74 and XBR 103.15 against BZ's 103.10.
//
// base is expected already canonical, as it is in Ref, which reads it back off MarketRefFor.
func AssetClassFor(contract Contract, base string) core.AssetClass {
	if contract.IsRwa {
		return core.ClassifyNonCrypto(base)
	}
	return core.ClassCrypto
}

// periodPattern reads `8H`, `4h`, `1H`. Anything else -- a bare `8`, a minute period -- is not an
// hour period this can state, and states nothing rather than guessing.
var periodPattern = regexp.MustCompile(`(?i)^(\d+(?:\.\d+)?)H$`)

// PeriodHours is `8H`, `4H`, `1H` as hours; nil for anything else, zero included.
func PeriodHours(period string) *float64 {
	match := periodPattern.FindStringSubmatch(strings.TrimSpace(period))
	if match == nil {
		return nil
	}
	hours, err := strconv.ParseFloat(match[1], 64)
	if err != nil || !(hours > 0) {
		return nil
	}
	return &hours
}

// declaredBase is the base to override the parsed one with, or nil where the parser already agrees
// with what Toobit declares.
//
// ID2-SWAP-USDT is the case that needs it: the parser reads ID2, while `underlying` and the index
// token are both ID. A contract-size prefix (1000PEPE) is the parser's to read, and it reads it, so
// that is not a disagreement and the declaration is dropped.
//
// The shared rule screens on the WIDE dollar-quote set, not this package's `dollarQuotes`, which is
// narrower on purpose: that one decides what is COLLECTED, and Ref is exported and answers for a
// USD1-margined contract that IsTradable would never admit.
func declaredBase(contract Contract) *string {
	declared := adapters.DeclaredMarketBase(contract.Symbol, contract.Underlying, contract.MarginToken)
	if declared == "" {
		return nil
	}
	return &declared
}

// Ref is a contract's market reference: the quote from the margin coin, the base from the declared
// underlying where the parser disagrees, and the class from `isRwa`.
//
// Built in two passes because the class is a function of the canonical base, which only MarketRefFor
// can state -- it applies the alias map, so SPX500 has reached US500 before the index table sees it.
func Ref(contract Contract) core.MarketRef {
	quote := contract.MarginToken
	overrides := adapters.Overrides{
		Quote:    &quote,
		HasQuote: true,
		Base:     declaredBase(contract),
	}
	base := adapters.MarketRefFor(VenueID, contract.Symbol, overrides).Base
	class := AssetClassFor(contract, base)
	overrides.AssetClass = &class
	return adapters.MarketRefFor(VenueID, contract.Symbol, overrides)
}

// SnapshotInput is one cycle's five bulk responses plus the cached contract list.
type SnapshotInput struct {
	Contracts []Contract
	Funding   []FundingRate
	Tickers   []Ticker
	Marks     []MarkPrice
	Index     map[string]adapters.Num
	Books     []BookTicker
}

// ParseSnapshots joins the bulk responses onto listed contracts, in FUNDING-RATE order.
//
// The order is the funding response's own, not a map's: the funding call is the only one that covers
// every perpetual, and ranging a Go map here would reshuffle the venue's output on every cycle.
// Books the ticker serves but exchangeInfo does not list -- the `TBV_` shadow books, delisted REN and
// WAVES -- have no contract and are skipped.
func ParseSnapshots(input SnapshotInput, now int64) []core.FundingSnapshot {
	tradable := make(map[string]Contract, len(input.Contracts))
	for _, contract := range input.Contracts {
		if IsTradable(contract) {
			tradable[contract.Symbol] = contract
		}
	}
	tickers := make(map[string]Ticker, len(input.Tickers))
	for _, ticker := range input.Tickers {
		tickers[ticker.S] = ticker
	}
	marks := make(map[string]adapters.Num, len(input.Marks))
	for _, mark := range input.Marks {
		marks[mark.SymbolID] = mark.Price
	}
	books := make(map[string]BookTicker, len(input.Books))
	for _, book := range input.Books {
		books[book.S] = book
	}

	snapshots := make([]core.FundingSnapshot, 0, len(input.Funding))
	for _, row := range input.Funding {
		contract, listed := tradable[row.Symbol]
		hours := PeriodHours(row.Period)
		if !listed || !row.Rate.OK || hours == nil {
			continue
		}

		// A missing ticker or book leaves a zero value whose every Num is absent, so each figure is
		// nil rather than a confident zero -- the same reading `num(book?.b)` gives.
		ticker := tickers[row.Symbol]
		book := books[row.Symbol]
		multiplier := contract.ContractMultiplier.Ptr()
		markPrice := marks[row.Symbol].Ptr()
		bestBid := book.B.Ptr()
		bestAsk := book.A.Ptr()

		basisHours := *hours
		intervalHours := *hours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     Ref(contract),
			ObservedAt:    now,
			Rate:          row.Rate.Val,
			BasisHours:    basisHours,
			IntervalHours: &intervalHours,
			NextFundingAt: row.NextFundingTime.PositiveMs(),
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    input.Index[contract.IndexToken].Ptr(),
			BestBid:       bestBid,
			// Book quantities are CONTRACTS, so they go through contractMultiplier: BTC's 11,595 at
			// the bid is 11.6 BTC and about $890k, not $890M.
			BestBidSizeUSD:  adapters.Mul(book.Bq.Ptr(), multiplier, bestBid),
			BestAsk:         bestAsk,
			BestAskSizeUSD:  adapters.Mul(book.Aq.Ptr(), multiplier, bestAsk),
			OpenInterestUSD: adapters.Mul(ticker.Op.Ptr(), multiplier, markPrice),
			Volume24hUSD:    ticker.Qv.Ptr(),
		})
	}
	return snapshots
}

// ParseFundingHistory returns the settlements in [fromMs, toMs], oldest first, each over its own
// declared period.
//
// A row that states no period falls back to the gap to its nearest neighbour, and a lone unlabelled
// row with no fallback is dropped rather than given an invented basis.
func ParseFundingHistory(
	ref core.MarketRef,
	rows []FundingHistoryRow,
	fromMs, toMs int64,
	fallbackHours *float64,
) []core.FundingEvent {
	byTime := make(map[int64]FundingHistoryRow, len(rows))
	for _, row := range rows {
		at := row.SettleTime.PositiveMs()
		if at == nil || !row.SettleRate.OK {
			continue
		}
		byTime[*at] = row
	}

	times := make([]int64, 0, len(byTime))
	for at := range byTime {
		times = append(times, at)
	}
	sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })
	gaps := adapters.BasisHoursFromGaps(times, fallbackHours)

	events := make([]core.FundingEvent, 0, len(times))
	for i, settledAt := range times {
		row := byTime[settledAt]
		basisHours := PeriodHours(row.Period)
		if basisHours == nil {
			basisHours = gaps[i]
		}
		if settledAt < fromMs || settledAt > toMs || basisHours == nil {
			continue
		}
		events = append(events, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       row.SettleRate.Val,
			BasisHours: *basisHours,
			MarkPrice:  nil,
		})
	}
	return events
}
