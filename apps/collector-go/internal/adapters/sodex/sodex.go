// Package sodex parses SoDEX's perpetual market data.
//
// Ported from packages/adapters/src/venues/sodex.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/sodex) and the same expected values as sodex.test.ts, so the Go
// and TypeScript parsers cannot drift apart while both are collecting.
package sodex

import (
	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "sodex"

// hourlyIntervalSeconds is the only interval whose rate basis has been observed; see Adapter.
const hourlyIntervalSeconds = 3600

// Ticker is one row of markets/tickers.
type Ticker struct {
	Symbol string `json:"symbol"`
	// FundingRate is the "current funding rate": the running 1-hour estimate for NextFundingTime.
	FundingRate adapters.Num `json:"fundingRate"`
	// NextFundingTime is epoch ms.
	NextFundingTime adapters.Num `json:"nextFundingTime"`
	MarkPrice       adapters.Num `json:"markPrice"`
	IndexPrice      adapters.Num `json:"indexPrice"`
	// OpenInterest is base units (the symbol's `stepSize` unit).
	OpenInterest adapters.Num `json:"openInterest"`
	// QuoteVolume is 24h volume in the quote coin (vUSDC).
	QuoteVolume adapters.Num `json:"quoteVolume"`
	BidPx       adapters.Num `json:"bidPx"`
	// BidSz is base units.
	BidSz adapters.Num `json:"bidSz"`
	AskPx adapters.Num `json:"askPx"`
	AskSz adapters.Num `json:"askSz"`
}

// Symbol is one row of markets/symbols.
//
// QuoteCoin is a pointer because absent is a distinct state from the empty string: the TypeScript
// side passes `quoteCoin ?? null` straight through as the market's quote, so a venue that stopped
// declaring one has to reach the database as NULL rather than as "".
type Symbol struct {
	Name string `json:"name"`
	// BaseCoin is the contract code, and is deliberately not read: see ParseSnapshots.
	BaseCoin  *string `json:"baseCoin"`
	QuoteCoin *string `json:"quoteCoin"`
	// Status is "TRADING" or "HALT".
	Status string `json:"status"`
	// FundingInterval is seconds; "must be a multiple of 3600".
	FundingInterval adapters.Num `json:"fundingInterval"`
	MaxLeverage     adapters.Num `json:"maxLeverage"`
}

// Response is SoDEX's uniform wrapper.
type Response[T any] struct {
	Code int `json:"code"`
	Data []T `json:"data"`
}

// Tradable is the TRADING symbols on an hourly funding interval, by name.
func Tradable(symbols []Symbol) map[string]Symbol {
	tradable := make(map[string]Symbol, len(symbols))
	for _, s := range symbols {
		if s.Status == "TRADING" && s.FundingInterval.OK && s.FundingInterval.Val == hourlyIntervalSeconds {
			tradable[s.Name] = s
		}
	}
	return tradable
}

// ParseSnapshots normalizes markets/tickers against the hourly TRADING symbols.
//
// Order follows the tickers response, so a market SoDEX lists first is reported first.
func ParseSnapshots(tickers []Ticker, tradable map[string]Symbol, now int64) []core.FundingSnapshot {
	snapshots := make([]core.FundingSnapshot, 0, len(tickers))
	for _, row := range tickers {
		symbol, ok := tradable[row.Symbol]
		if !ok || !row.FundingRate.OK {
			continue
		}

		markPrice := row.MarkPrice.Ptr()
		bestBid := row.BidPx.Ptr()
		bestAsk := row.AskPx.Ptr()
		// Every market settles hourly and quotes a 1-hour rate; see Adapter for the evidence.
		intervalHours := 1.0

		snapshots = append(snapshots, core.FundingSnapshot{
			// Parsed, not declared: `baseCoin` is the contract code, so 1000PEPE-USD declares
			// "1000PEPE" while the parser gives PEPE x1000, which is right — its mark 0.003369 equals
			// Hyperliquid's kPEPE. XAUt and SILVER reach XAUT and XAG either way.
			MarketRef: adapters.MarketRefFor(VenueID, row.Symbol, adapters.Overrides{
				// Every symbol declares `quoteCoin` vUSDC, SoDEX's own USDC on ValueChain. Kept as
				// spelt.
				Quote:    symbol.QuoteCoin,
				HasQuote: true,
			}),
			ObservedAt:    now,
			Rate:          row.FundingRate.Val,
			BasisHours:    1,
			IntervalHours: &intervalHours,
			NextFundingAt: row.NextFundingTime.PositiveMs(),
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    row.IndexPrice.Ptr(),
			// Base units x mark. BTC 772.14798 x 76,922 = $59.4M, inside its $100M
			// `openInterestCapUSD`.
			OpenInterestUSD: adapters.Mul(row.OpenInterest.Ptr(), markPrice),
			// Quote volume: BTC 1,410.21104 base x vwap 76,937.1968 = 108,497,684, as reported.
			Volume24hUSD:   row.QuoteVolume.Ptr(),
			BestBid:        bestBid,
			BestBidSizeUSD: adapters.Mul(row.BidSz.Ptr(), bestBid),
			BestAsk:        bestAsk,
			BestAskSizeUSD: adapters.Mul(row.AskSz.Ptr(), bestAsk),
			MaxLeverage:    symbol.MaxLeverage.Ptr(),
		})
	}
	return snapshots
}
