// Package pionex parses Pionex's perpetual futures.
//
// Ported from packages/adapters/src/venues/pionex.ts. Two venue quirks shape every function here:
//
//   - PIONEX PUBLISHES NO SETTLEMENT INTERVAL in any bulk response, and the interval varies (1h, 4h
//     and 8h all trade), so it is read per symbol from the spacing of its last settlements. A perp
//     appears only once its interval is known, which is why the adapter's cache -- and WarmUp, which
//     seeds it -- is load-bearing rather than an optimisation.
//   - SIZES AND OPEN INTEREST ARE BASE UNITS, not dollars and not contracts. BTC_USDT_PERP's
//     openInterest of 1,335.1442 x mark 77,096 is $102.9M, against 24h turnover of $1.99bn; read as
//     dollars it would be $1,335 of open interest on a market doing two billion a day.
package pionex

import (
	"fmt"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "pionex"

// API is the versioned REST root every endpoint hangs off.
const API = "https://api.pionex.com/api/v1"

const (
	// SymbolsMaxAgeMs: the PERP symbol list is 250 KB and weight 5 of a 10-per-second budget, so
	// hourly.
	SymbolsMaxAgeMs int64 = 60 * 60_000

	// IntervalRefreshBudget is per-symbol fundingRates calls allowed per cycle. At this budget a cold
	// start covers the ~570 dollar perps in about 19 cycles; WarmUp skips that.
	IntervalRefreshBudget = 30
	// IntervalMaxAgeMs: re-read each symbol's interval this often.
	IntervalMaxAgeMs int64 = 6 * 60 * 60_000
	// intervalRetryMs: a symbol with no settlement yet has no interval to read; look again after this
	// long, which is done by back-dating its cache entry rather than by a second timestamp.
	intervalRetryMs int64 = 30 * 60_000
	// intervalSample is how many settlements are enough to read the spacing from.
	intervalSample = 4

	// historyPageSize: `limit` above 100 is refused with MARKET_PARAMETER_ERROR (measured
	// 2026-09-14).
	historyPageSize = 100
	historyMaxPages = 50
)

// dollarQuotes are the quotes collected. 43 of Pionex's 610 perps on 2026-09-14 price one coin in
// another (BTC_ETH_PERP, PAXG_BTC_PERP, QQQX_SPYX_PERP), so their open interest and volume are not
// dollars and their mark belongs in no USD pool.
var dollarQuotes = map[string]struct{}{"USDT": {}, "USDC": {}}

// Envelope is Pionex's uniform response wrapper.
//
// Data is a pointer so an absent or null `data` is distinguishable from an empty one, which is what
// the TypeScript `data === undefined || data === null` guard turns into a thrown error: a response
// that lost its payload must fail the cycle rather than read as a venue with nothing listed.
type Envelope[T any] struct {
	Result    bool   `json:"result"`
	Data      *T     `json:"data"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Timestamp int64  `json:"timestamp"`
}

func (e Envelope[T]) unwrap(what string) (T, error) {
	if !e.Result || e.Data == nil {
		var zero T
		return zero, fmt.Errorf("pionex %s: %s %s", what, e.Code, e.Message)
	}
	return *e.Data, nil
}

// The payload shapes, one per endpoint. Pionex nests every list under its own key, and the book
// endpoint reuses `tickers` for a different row shape than the ticker endpoint does.
type (
	SymbolList struct {
		Symbols []Symbol `json:"symbols"`
	}
	IndexList struct {
		Indexes []Index `json:"indexes"`
	}
	TickerList struct {
		Tickers []Ticker `json:"tickers"`
	}
	OpenInterestList struct {
		OpenInterests []OpenInterest `json:"openInterests"`
	}
	BookTickerList struct {
		Tickers []BookTicker `json:"tickers"`
	}
	FundingRateList struct {
		Symbol string        `json:"symbol"`
		Rates  []FundingRate `json:"rates"`
	}
)

type Symbol struct {
	Symbol string `json:"symbol"`
	Type   string `json:"type"`
	// BaseCurrency is Pionex's own coin code, which is not always the ticker: ZEROG for 0G, LIGHTER
	// for LIT. The symbol's own base is preferred, so this is read only for the quote's sake.
	BaseCurrency  string `json:"baseCurrency"`
	QuoteCurrency string `json:"quoteCurrency"`
	Status        string `json:"status"`
}

type Index struct {
	Symbol     string       `json:"symbol"`
	IndexPrice adapters.Num `json:"indexPrice"`
	MarkPrice  adapters.Num `json:"markPrice"`
	// NextFundingRate is the rate to be paid at NextFundingTime, per settlement interval.
	NextFundingRate adapters.Num `json:"nextFundingRate"`
	NextFundingTime adapters.Num `json:"nextFundingTime"`
}

type Ticker struct {
	Symbol string `json:"symbol"`
	// Volume is 24h volume in BASE units.
	Volume adapters.Num `json:"volume"`
	// Amount is 24h turnover in the QUOTE currency.
	Amount adapters.Num `json:"amount"`
}

type OpenInterest struct {
	Symbol string `json:"symbol"`
	// OpenInterest is BASE units.
	OpenInterest adapters.Num `json:"openInterest"`
}

type BookTicker struct {
	Symbol   string       `json:"symbol"`
	BidPrice adapters.Num `json:"bidPrice"`
	// BidSize and AskSize are BASE units, like order sizes (`minSizeLimit` 0.0001 BTC).
	BidSize  adapters.Num `json:"bidSize"`
	AskPrice adapters.Num `json:"askPrice"`
	AskSize  adapters.Num `json:"askSize"`
}

type FundingRate struct {
	FundingRate adapters.Num `json:"fundingRate"`
	FundingTime adapters.Num `json:"fundingTime"`
}

// IntervalEntry is one symbol's cached settlement interval.
//
// Hours is a pointer because a listing that has not settled yet has no interval to cache, and that
// is different from having no entry at all: an entry with nil hours is what holds the retry
// back-dating, so the symbol is re-read in 30 minutes rather than immediately every cycle.
type IntervalEntry struct {
	Hours     *float64
	FetchedAt int64
}

// TradablePerps is the dollar-quoted perps Pionex lists as TRADING, by symbol.
func TradablePerps(symbols []Symbol) map[string]Symbol {
	live := make(map[string]Symbol, len(symbols))
	for _, symbol := range symbols {
		if symbol.Type != "PERP" || symbol.Status != "TRADING" {
			continue
		}
		if _, dollar := dollarQuotes[symbol.QuoteCurrency]; !dollar {
			continue
		}
		live[symbol.Symbol] = symbol
	}
	return live
}

// IntervalHours is the settlement interval from a symbol's most recent settlements (newest first, as
// served).
//
// The median gap when there are two or more: ACT_USDT_PERP settled every 4h, ACH_USDT_PERP every 8h
// and AAX_USDT_PERP every hour on 2026-09-14. A listing with a single settlement so far is measured
// against its next one instead.
func IntervalHours(rates []FundingRate, nextFundingTime *int64) *float64 {
	times := make([]int64, 0, len(rates))
	for _, rate := range rates {
		if rate.FundingTime.OK {
			times = append(times, int64(rate.FundingTime.Val))
		}
	}
	if len(times) >= 2 {
		return core.InferIntervalHours(times)
	}
	if len(times) == 1 {
		return adapters.HoursBetween(&times[0], nextFundingTime)
	}
	return nil
}

// SnapshotInput is one cycle's bulk responses plus the interval cache they are joined against.
type SnapshotInput struct {
	Symbols       map[string]Symbol
	Indexes       []Index
	Tickers       []Ticker
	OpenInterests []OpenInterest
	BookTickers   []BookTicker
	Intervals     map[string]IntervalEntry
}

// ParseSnapshots joins the bulk index, ticker, open-interest and book responses onto tradable perps
// whose interval is known. A perp appears once its interval has been read.
//
// Units, checked against the live responses of 2026-09-14 22:01 UTC:
//   - `nextFundingRate` is a fraction per settlement interval: the resting rate is 0.0001 on 8h perps
//     (ACH), 0.00005 on 4h perps (ACT), and each of those settled at exactly that in the history.
//   - `openInterest` is base units: BTC_USDT_PERP 1,335.1442 x mark 77,096 = $102.9M, against 24h
//     turnover of $1.99bn. Read as dollars it would be $1,335 of BTC open interest.
//   - `amount` is quote turnover: BTC volume 25,822.66 x the day's range 76,463-77,423 brackets
//     1,989,264,906 (average 77,036).
//   - Book sizes are base units, like order sizes (`minSizeLimit` 0.0001 BTC).
//
// Pionex declares no asset class anywhere in its public API, so every perp is crypto. Its AAPLX,
// TSLAX and friends are xStocks tokens in any case.
//
// The output follows the index response's own order, so it does not reshuffle per run the way
// ranging a Go map would.
func ParseSnapshots(input SnapshotInput, now int64) []core.FundingSnapshot {
	tickers := make(map[string]Ticker, len(input.Tickers))
	for _, ticker := range input.Tickers {
		tickers[ticker.Symbol] = ticker
	}
	openInterest := make(map[string]adapters.Num, len(input.OpenInterests))
	for _, entry := range input.OpenInterests {
		openInterest[entry.Symbol] = entry.OpenInterest
	}
	books := make(map[string]BookTicker, len(input.BookTickers))
	for _, book := range input.BookTickers {
		books[book.Symbol] = book
	}

	snapshots := make([]core.FundingSnapshot, 0, len(input.Indexes))
	for _, index := range input.Indexes {
		symbol, listed := input.Symbols[index.Symbol]
		hours := input.Intervals[index.Symbol].Hours
		if !listed || !index.NextFundingRate.OK || hours == nil || *hours <= 0 {
			continue
		}

		markPrice := index.MarkPrice.Ptr()
		book := books[index.Symbol]
		bestBid := book.BidPrice.Ptr()
		bestAsk := book.AskPrice.Ptr()
		// The quote is what the venue lists, not what the symbol implies: Pionex's coin-quoted perps
		// are excluded upstream precisely because that distinction is real money.
		quote := symbol.QuoteCurrency
		basisHours := *hours
		intervalHours := *hours

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       adapters.MarketRefFor(VenueID, index.Symbol, adapters.Overrides{Quote: &quote, HasQuote: true}),
			ObservedAt:      now,
			Rate:            index.NextFundingRate.Val,
			BasisHours:      basisHours,
			IntervalHours:   &intervalHours,
			NextFundingAt:   index.NextFundingTime.PositiveMs(),
			Kind:            core.KindPredicted,
			MarkPrice:       markPrice,
			IndexPrice:      index.IndexPrice.Ptr(),
			BestBid:         bestBid,
			BestBidSizeUSD:  adapters.Mul(book.BidSize.Ptr(), bestBid),
			BestAsk:         bestAsk,
			BestAskSizeUSD:  adapters.Mul(book.AskSize.Ptr(), bestAsk),
			OpenInterestUSD: adapters.Mul(openInterest[index.Symbol].Ptr(), markPrice),
			Volume24hUSD:    tickers[index.Symbol].Amount.Ptr(),
		})
	}
	return snapshots
}

// ParseFundingHistory returns settlements for one perp in [fromMs, toMs], oldest first. Basis hours
// come from the gaps between every fetched settlement, including the neighbours just outside the
// window -- which is why the window is applied after the basis is computed, not before.
//
// quote is what the venue lists for the symbol, when the adapter still has its symbol cache; nil
// falls back to parsing the symbol.
func ParseFundingHistory(
	venueSymbol string,
	rows []FundingRate,
	fromMs, toMs int64,
	fallbackHours *float64,
	quote *string,
) []core.FundingEvent {
	byTime := make(map[int64]float64, len(rows))
	for _, row := range rows {
		if row.FundingTime.OK && row.FundingRate.OK {
			byTime[int64(row.FundingTime.Val)] = row.FundingRate.Val
		}
	}
	times := make([]int64, 0, len(byTime))
	for at := range byTime {
		times = append(times, at)
	}
	sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })

	basis := adapters.BasisHoursFromGaps(times, fallbackHours)
	ref := adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{Quote: quote, HasQuote: quote != nil})

	events := make([]core.FundingEvent, 0, len(times))
	for i, settledAt := range times {
		basisHours := basis[i]
		if settledAt < fromMs || settledAt > toMs || basisHours == nil {
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
