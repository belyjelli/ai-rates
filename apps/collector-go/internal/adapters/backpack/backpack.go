// Package backpack parses Backpack Exchange's perpetual market data.
//
// Ported from packages/adapters/src/venues/backpack.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/backpack) and the same expected values as backpack.test.ts, so the
// Go and TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: three per cycle, all bulk: `GET /api/v1/markPrices` (funding, mark, index, next funding
// for every perp), `GET /api/v1/openInterest` (every perp) and `GET /api/v1/tickers` (24h volume, spot
// rows included), plus `GET /api/v1/markets` once an hour for type, order-book state, class and
// interval. No per-symbol call exists or is needed. Limits are "2000 requests per minute across
// standard REST endpoints" and "30 requests per minute" for historical market data
// (https://support.backpack.exchange/exchange/api-and-developer-docs/faqs). Funding history is
// time-range data, so the client is spaced at 2s: a cycle costs ~6s, and a history backfill cannot
// breach the 30/minute bucket.
//
// FUNDING: hourly, as a fraction, positive means longs pay. All perps moved to hourly settlement on
// 2025-08-20 and the daily rate is divided "by 24 instead of 3"
// (https://support.backpack.exchange/technical-docs/trading/futures-specs,
// https://learn.backpack.exchange/articles/hourly-funding-and-real-time-yield); `fundingInterval` is
// 3,600,000 ms on every live perp. `markPrices.fundingRate` is the rate accruing for the current hour,
// so `predicted`: BTC read 0.00000080694 at 22:28 and 0.00000089745 at 22:33, and the history row for
// the 23:00 interval, already present at 22:28, moved from 0.000000724 to 0.000001254 before it ended.
// The last `markPrices` reading before the hour (22:59:33) against the settled 23:00 row: BTC
// 0.00000214 against 0.00000216, ETH 0.00001238 against 0.000012403, KMNO -0.00025959 against
// -0.000259381. By 23:02 the history's newest row was already the 00:00 interval.
// The rates are hourly and not 8- or 24-hour: quiet perps sit on 0.0000125 (the 0.01%/8h floor, per
// hour) and equities on 0.00000625; ETH 0.0000121/h matched Hyperliquid's 0.0000125 the same minute,
// BTC's 0.0000008 was below Hyperliquid's 0.0000116 while its 22:00 settlement was 0.0000083.
//
// UNITS, checked live 2026-09-13: `openInterest` is base units (BTC 412.67 x mark 76,746 = $31.7M; ETH
// 4,989.66 x 2,478 = $12.4M), so OI USD = OI x mark. `tickers.quoteVolume` is 24h volume in USDC (BTC
// $126.0M = 1,634.9 BTC x ~$77k). `nextFundingTimestamp` is epoch ms.
//
// TRADABILITY: `marketType` PERP and `orderBookState` Open. On 2026-09-13, of 102 perps: 89 Open, 11
// Closed (IP, TON, FLOCK, ...) and 2 PostOnly (AMZN.US, AMD.US, which the specs say "use the index
// price as the mark price" and which are not visible). `/openInterest` also returns 6
// `*_USDC_PREDICTION` rows (FDVEXTD1B, ...): prediction contracts with no market entry, never collected.
//
// CLASS, declared by `rwaMarketType`: null on the 74 Open crypto perps, STOCK on 12 and INDEX on 3
// (QQQ.US, SPY.US, DRAM.US). INDEX goes to MarketRefFor as index and core's table files those three ETFs
// as equity. Any other non-null value is tradfi of an unknown kind, placed by ClassifyNonCrypto.
//
// QUOTE: USDC. `quoteSymbol` is USDC on every perp, and "markets are denominated and settled in USDC"
// (futures specs).
//
// BASE: the parser agrees with `baseSymbol` on all 102 perps. It reads `kPEPE`, `kBONK` and `kSHIB` as
// x1000 contracts, which is what they are. Equities keep the venue's `.US` suffix (`MU.US`), as declared
// in both the symbol and `baseSymbol`; they therefore do not pool with MU elsewhere until core aliases
// them, which is core's decision and not this adapter's.
package backpack

import (
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "backpack"

const (
	hourMS = 3_600_000.0
	// fundingBasisHours is 1: the rate published on markPrices is the one accruing for the current
	// hour, not an 8h-normalised figure.
	fundingBasisHours = 1.0
	quote             = "USDC"
)

// Market is one row of /api/v1/markets.
//
// BaseSymbol, QuoteSymbol and RwaMarketType are pointers because absent is a distinct state from the
// empty string on this venue: `rwaMarketType` is null on crypto perps and a string on tradfi ones,
// and AssetClassFor reads exactly that difference.
type Market struct {
	Symbol      string  `json:"symbol"`
	BaseSymbol  *string `json:"baseSymbol"`
	QuoteSymbol *string `json:"quoteSymbol"`
	// MarketType is SPOT or PERP; OrderBookState is Open, Closed or PostOnly.
	MarketType     string `json:"marketType"`
	OrderBookState string `json:"orderBookState"`
	// FundingInterval is milliseconds, and null on spot rows.
	FundingInterval adapters.Num `json:"fundingInterval"`
	RwaMarketType   *string      `json:"rwaMarketType"`
	// Visible is declared but unread: the two PostOnly equities are invisible, and OrderBookState
	// already excludes them. Kept so the wire shape stays legible beside the venue's docs.
	Visible *bool `json:"visible"`
}

// MarkPrice is one row of /api/v1/markPrices: the funding accruing for the current hour, with the
// marks it is computed from.
type MarkPrice struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"fundingRate"`
	IndexPrice  adapters.Num `json:"indexPrice"`
	MarkPrice   adapters.Num `json:"markPrice"`
	// NextFundingTimestamp is epoch ms.
	NextFundingTimestamp adapters.Num `json:"nextFundingTimestamp"`
}

// OpenInterest is one row of /api/v1/openInterest, in BASE units.
type OpenInterest struct {
	Symbol       string       `json:"symbol"`
	OpenInterest adapters.Num `json:"openInterest"`
}

// Ticker is one row of /api/v1/tickers. QuoteVolume is 24h volume in the quote asset.
type Ticker struct {
	Symbol      string       `json:"symbol"`
	QuoteVolume adapters.Num `json:"quoteVolume"`
}

// FundingRate is one row of /api/v1/fundingRates.
type FundingRate struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"fundingRate"`
	// IntervalEndTimestamp is UTC without a zone designator, e.g. "2026-09-13T22:00:00".
	IntervalEndTimestamp string `json:"intervalEndTimestamp"`
}

// AssetClassFor is the class Backpack declares in `rwaMarketType`: null for crypto, STOCK or INDEX
// otherwise. Anything else non-null is tradfi of an unknown kind, which the base tables place.
func AssetClassFor(rwaMarketType *string, base string) core.AssetClass {
	declared := ""
	if rwaMarketType != nil {
		declared = strings.ToUpper(strings.TrimSpace(*rwaMarketType))
	}
	switch declared {
	case "":
		return core.ClassCrypto
	case "STOCK":
		return core.ClassEquity
	case "INDEX":
		return core.ClassIndex
	}
	return core.ClassifyNonCrypto(base)
}

// IsTradable is a perp with an Open order book.
func IsTradable(market Market) bool {
	return market.MarketType == "PERP" && market.OrderBookState == "Open"
}

// refFor builds the market reference, taking the class from what the venue declares and the quote
// from the futures specs rather than from the symbol.
func refFor(market Market) core.MarketRef {
	class := AssetClassFor(market.RwaMarketType, core.ParseVenueSymbol(market.Symbol).Base)
	q := quote
	return adapters.MarketRefFor(VenueID, market.Symbol, adapters.Overrides{
		Quote:      &q,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// zoneSuffix matches a zone designator: a Z anywhere, or a numeric offset at the end.
var zoneSuffix = regexp.MustCompile(`[zZ]|[+-]\d\d:?\d\d$`)

// ParseTimestamp reads Backpack's zone-less UTC timestamp as epoch ms, or nil.
//
// The venue writes "2026-09-13T22:00:00" with no designator, which is UTC; a bare Go or JS parse of
// that would read it as local time and shift every settlement by the machine's offset.
func ParseTimestamp(value string) *int64 {
	if value == "" {
		return nil
	}
	text := value
	if !zoneSuffix.MatchString(text) {
		text += "Z"
	}
	at, err := time.Parse(time.RFC3339, text)
	if err != nil {
		return nil
	}
	ms := at.UnixMilli()
	return &ms
}

// ParseSnapshots normalizes the three bulk endpoints into one snapshot per tradable perp, in the
// order markPrices lists them.
//
// The join is driven by markPrices because that is the only response that carries funding; markets
// supplies the interval, the order-book state and the declared class, and the other two supply size.
// A symbol missing from openInterest or tickers leaves those fields ABSENT rather than zero: the
// prediction contracts prove the two lists do not agree on membership.
func ParseSnapshots(
	markets []Market,
	markPrices []MarkPrice,
	openInterest []OpenInterest,
	tickers []Ticker,
	now int64,
) []core.FundingSnapshot {
	bySymbol := make(map[string]Market, len(markets))
	for _, m := range markets {
		bySymbol[m.Symbol] = m
	}
	oi := make(map[string]adapters.Num, len(openInterest))
	for _, r := range openInterest {
		oi[r.Symbol] = r.OpenInterest
	}
	volume := make(map[string]adapters.Num, len(tickers))
	for _, t := range tickers {
		volume[t.Symbol] = t.QuoteVolume
	}

	snapshots := make([]core.FundingSnapshot, 0, len(markPrices))
	for _, row := range markPrices {
		market, ok := bySymbol[row.Symbol]
		if !ok || !IsTradable(market) || !row.FundingRate.OK {
			continue
		}

		markPrice := row.MarkPrice.Ptr()
		var intervalHours *float64
		if interval := market.FundingInterval; interval.OK && interval.Val > 0 {
			hours := interval.Val / hourMS
			intervalHours = &hours
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     refFor(market),
			ObservedAt:    now,
			Rate:          row.FundingRate.Val,
			BasisHours:    fundingBasisHours,
			IntervalHours: intervalHours,
			NextFundingAt: row.NextFundingTimestamp.PositiveMs(),
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    row.IndexPrice.Ptr(),
			// Open interest is base units, valued at the venue's own mark.
			OpenInterestUSD: adapters.Mul(oi[row.Symbol].Ptr(), markPrice),
			Volume24hUSD:    volume[row.Symbol].Ptr(),
		})
	}
	return snapshots
}

// ParseFundingRates returns settled hourly payments within [fromMs, toMs], oldest first.
//
// The newest row is the interval still accruing (its IntervalEndTimestamp is in the future and its
// rate moves until then), so rows ending after `now` are not settlements and are dropped.
//
// Keyed by settlement so a row repeated across a page boundary is counted once.
func ParseFundingRates(
	rows []FundingRate,
	market Market,
	fromMs, toMs, now int64,
) []core.FundingEvent {
	base := refFor(market)
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		settledAt := ParseTimestamp(row.IntervalEndTimestamp)
		if settledAt == nil || !row.FundingRate.OK || *settledAt > now {
			continue
		}
		if *settledAt < fromMs || *settledAt > toMs {
			continue
		}
		bySettlement[*settledAt] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  *settledAt,
			Rate:       row.FundingRate.Val,
			BasisHours: fundingBasisHours,
			MarkPrice:  nil,
		}
	}

	events := make([]core.FundingEvent, 0, len(bySettlement))
	for _, event := range bySettlement {
		events = append(events, event)
	}
	sort.Slice(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
