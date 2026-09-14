// Package standx parses StandX's perpetuals.
//
// Ported from packages/adapters/src/venues/standx.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/standx) and the same expected values as standx.test.ts, so the Go
// and TypeScript parsers cannot drift apart while both are collecting.
package standx

import (
	"errors"
	"sort"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "standx"

// APIBase is the venue's HTTP root; exported because the tests assert the URLs asked for.
const APIBase = "https://perps.standx.com/api"

const hourMs = 3_600_000

// FundingHours: funding settles every hour and `funding_rate` is a 1-hour rate; see the Adapter
// header for the three measurements that establish it.
const FundingHours = 1.0

// ErrUnexpectedSymbolInfo and ErrUnexpectedOverview mirror the TypeScript adapter's throws when a
// response is not the array (or does not carry the array) it is supposed to be. A body that lost its
// payload has to fail the venue's cycle rather than read as a venue with nothing listed.
var (
	ErrUnexpectedSymbolInfo = errors.New("standx: unexpected query_symbol_info response")
	ErrUnexpectedOverview   = errors.New("standx: unexpected query_market_overview response")
	ErrUnexpectedHistory    = errors.New("standx: unexpected query_funding_rates response")
)

type OverviewSymbol struct {
	Symbol string  `json:"symbol"`
	Base   *string `json:"base"`
	Quote  *string `json:"quote"`

	FundingRate adapters.Num `json:"funding_rate"`
	MarkPrice   adapters.Num `json:"mark_price"`
	// OpenInterest is base units.
	OpenInterest adapters.Num `json:"open_interest"`
	// OpenInterestNotional is open_interest x mark, in the quote (DUSD).
	OpenInterestNotional adapters.Num `json:"open_interest_notional"`
	// VolumeQuote24h is 24h volume in the quote (DUSD).
	VolumeQuote24h adapters.Num `json:"volume_quote_24h"`
}

// Overview is the /query_market_overview body. Symbols is a pointer so an absent or null `symbols`
// stays distinguishable from an empty one, which is what the TypeScript `!Array.isArray` guard turns
// into a thrown error.
type Overview struct {
	Symbols *[]OverviewSymbol `json:"symbols"`
}

type SymbolInfo struct {
	Symbol     string  `json:"symbol"`
	BaseAsset  *string `json:"base_asset"`
	QuoteAsset *string `json:"quote_asset"`
	Status     string  `json:"status"`

	MaxLeverage adapters.Num `json:"max_leverage"`
}

type FundingRateRow struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"funding_rate"`
	MarkPrice   adapters.Num `json:"mark_price"`
	// Time is an ISO-8601 settlement time, on the hour.
	Time string `json:"time"`
}

// AssetTag is the label StandX's own web app puts on a market.
type AssetTag string

const (
	TagCrypto      AssetTag = "Crypto"
	TagCommodities AssetTag = "Commodities"
	TagStocks      AssetTag = "Stocks"
)

// AssetTags is the class StandX declares for each market.
//
// WHY A TABLE, when class is meant to be declared: the API declares nothing (`query_symbol_info` and
// `query_market_overview` carry no category). The venue's own web app does: its bundle at
// https://standx.com/perps ships `SymbolAssetTag`, which labels each market Crypto, Commodities or
// Stocks for the "All Assets / Crypto / Stocks / Commodities" filter, beside a `SymbolKind` that
// calls the same six non-crypto markets "TradFi Perpetual". This is that map, copied on 2026-09-14,
// covering all 13 listed markets: Crypto 7, Commodities 3, Stocks 3.
//
// A market missing from it is crypto — the venue has declared nothing about it — until it is added,
// the same direction dYdX's list takes.
var AssetTags = map[string]AssetTag{
	"BTC-USD":  TagCrypto,
	"ETH-USD":  TagCrypto,
	"HYPE-USD": TagCrypto,
	"BNB-USD":  TagCrypto,
	"SOL-USD":  TagCrypto,
	"ZEC-USD":  TagCrypto,
	"UNI-USD":  TagCrypto,
	"XAU-USD":  TagCommodities,
	"XAG-USD":  TagCommodities,
	"CL-USD":   TagCommodities,
	"TSLA-USD": TagStocks,
	"MU-USD":   TagStocks,
	"SPCX-USD": TagStocks,
}

// AssetClassFor is the class the web app's SymbolAssetTag declares for a market.
func AssetClassFor(symbol string) core.AssetClass {
	switch AssetTags[symbol] {
	case TagCommodities:
		return core.ClassCommodity
	case TagStocks:
		return core.ClassEquity
	default:
		return core.ClassCrypto
	}
}

// refFor builds the market reference for one StandX symbol.
//
// The declared `base` matched the parsed symbol on all 13 markets, so the parser is used. The quote
// is always overridden (HasQuote, even for a nil quote): margin, PnL and funding are DUSD, StandX's
// own dollar, kept as the venue spells it, and a venue that declared no quote must not silently get
// the USD the symbol parses to.
func refFor(symbol string, quote *string) core.MarketRef {
	class := AssetClassFor(symbol)
	return adapters.MarketRefFor(VenueID, symbol, adapters.Overrides{
		Quote:      quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// Tradable indexes the markets `query_symbol_info` lists as status `trading`; a market absent from
// it is not collected.
func Tradable(info []SymbolInfo) map[string]SymbolInfo {
	tradable := make(map[string]SymbolInfo, len(info))
	for _, s := range info {
		if s.Status == "trading" {
			tradable[s.Symbol] = s
		}
	}
	return tradable
}

// ParseSnapshots normalises one cycle's /query_market_overview response.
//
// The overview's own order is kept: the map is only ever looked up by symbol, never ranged over, so
// nothing here depends on Go's map iteration order.
func ParseSnapshots(symbols []OverviewSymbol, tradable map[string]SymbolInfo, now int64) []core.FundingSnapshot {
	// Every market settles on the UTC hour (see the Adapter header); the overview omits the time
	// itself.
	nextFundingAt := now/hourMs*hourMs + hourMs
	basisHours := FundingHours

	snapshots := make([]core.FundingSnapshot, 0, len(symbols))
	for _, row := range symbols {
		info, isTradable := tradable[row.Symbol]
		if !isTradable || !row.FundingRate.OK {
			continue
		}

		// `quote_asset` first, the overview's own `quote` only where the symbol list omits it.
		quote := info.QuoteAsset
		if quote == nil {
			quote = row.Quote
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     refFor(row.Symbol, quote),
			ObservedAt:    now,
			Rate:          row.FundingRate.Val,
			BasisHours:    basisHours,
			IntervalHours: &basisHours,
			NextFundingAt: &nextFundingAt,
			Kind:          core.KindPredicted,
			MarkPrice:     row.MarkPrice.Ptr(),
			// Only the per-symbol `query_symbol_price` carries an index price.
			IndexPrice: nil,
			// Already notional: BTC 384.2412 x 76,938.01 = 29,562,754 against 29,562,753.29 reported.
			OpenInterestUSD: row.OpenInterestNotional.Ptr(),
			// Quote volume: BTC 3,423.82 base at ~77,000 = 263.6M against 264.0M reported.
			Volume24hUSD: row.VolumeQuote24h.Ptr(),
			MaxLeverage:  info.MaxLeverage.Ptr(),
		})
	}
	return snapshots
}

// ParseFundingHistory returns settled hourly rates within [fromMs, toMs], oldest first.
func ParseFundingHistory(rows []FundingRateRow, venueSymbol string, quote *string, fromMs, toMs int64) []core.FundingEvent {
	ref := refFor(venueSymbol, quote)

	// Keyed by settlement so a row repeated across window boundaries lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		settledAt, readable := parseSettlement(row.Time)
		if row.Symbol != venueSymbol || !readable || !row.FundingRate.OK {
			continue
		}
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       row.FundingRate.Val,
			BasisHours: FundingHours,
			MarkPrice:  row.MarkPrice.Ptr(),
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

// parseSettlement reads `time` as epoch milliseconds, reporting whether it was readable. The second
// return stands in for the TypeScript `Number.isFinite(Date.parse(...))` guard, which is what keeps
// an unreadable timestamp out of the series instead of filing it at the epoch.
func parseSettlement(value string) (int64, bool) {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return 0, false
	}
	return parsed.UnixMilli(), true
}
