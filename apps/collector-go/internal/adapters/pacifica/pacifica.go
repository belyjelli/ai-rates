// Package pacifica parses Pacifica's USDC-margined perpetuals.
//
// Ported from packages/adapters/src/venues/pacifica.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/pacifica) and the same expected values as pacifica.test.ts, so the
// Go and TypeScript parsers cannot drift apart while both are collecting.
//
// Measured from this machine on 2026-09-14 and read against https://docs.pacifica.fi (api/rest-api/
// markets get-prices, get-market-info and get-historical-funding; trading-on-pacifica funding-rates;
// api/rate-limits).
//
//   - **One call a cycle**, plus `/info` hourly. `/info/prices` answers all 77 markets.
//   - **Hourly, and both rates are 1-hour rates.** Docs: "At the end of each 1-hour interval, the
//     average funding rate is taken and then applied", the formula divides the 8h premium-plus-interest
//     by 8, and both API fields say "(hour)". History rows are 1h apart (3,990 of 3,999 gaps back to
//     2026-03-30; the other 9 are 2h outages). Quiet markets (XPL, XAU, EURUSD) print 0.0000125, the
//     hourly form of 0.01%/8h and Hyperliquid's hourly floor. Against Hyperliquid at 22:13-22:20 UTC:
//     BTC 0.00000475 vs 0.0000107-0.0000109, ETH 0.00001202 vs 0.0000125 — same scale, not 8x or 24x.
//   - **Which rate is which.** Docs: the rate applied in hour H "is computed from market conditions in
//     the previous hour". History records carry `funding_rate` ("last settled") and `next_funding_rate`
//     ("predicted for next settlement"), and each record's `next_funding_rate` is exactly the following
//     record's `funding_rate` (3,995 of 3,999 BTC pairs; the 4 exceptions are records written seconds
//     late or after a missed hour). At 22:13, 22:15 and 22:20 the prices `funding` for BTC held at
//     0.00000475 — the 22:00 record's `next_funding_rate` — while `next_funding` moved (-0.00000336,
//     -0.00000237, -0.00000219). So `funding` is the rate already fixed for the 23:00 settlement, and
//     `next_funding` is the running estimate for 00:00.
//     **Confirmed across the 23:00 settlement.** Prices read every five minutes from 22:15 to 22:59
//     held BTC `funding` at 0.00000475; the 23:00 history record then settled exactly 0.00000475, and
//     the same held for ETH 0.00001202, SOL -0.00000177, NVDA 0.0000125 and kBONK -0.00000345 (5 of 5).
//     At 23:04 `funding` had become the last estimate, now fixed for 00:00 (BTC 0.00000288 against a
//     22:59 `next_funding` of 0.00000281; ETH 0.00000199 against 0.0000023), and `next_funding` had
//     restarted (BTC 0.0000125). The snapshot carries `funding`, as the rate of the next settlement at
//     the next top of the hour: it has not settled, so it is `predicted`, and it is the same settlement
//     every other hourly venue's snapshot describes. The docs' prices page calls `funding` the rate
//     "paid in the past funding epoch"; the history records contradict that reading (22:00 settled
//     0.00000383, not 0.00000475).
//   - **Open interest is base units, whatever the docs say.** The prices page calls `open_interest`
//     USD, but BTC's is 412.34157 beside $158.6M of daily volume; as base units it is $31.7M. Pacifica's
//     own app renders the Open Interest column as `open_interest x mark`, and so does this.
//   - **Tradable**: `instrument_type` perpetual — 76 of 77 (SOL-USDC is spot). There is no status field.
//   - **Class** from the web app's tag map; see TradfiTags. **Quote** USDC; see settlementQuote.
//     **Bases**: see declaredBase.
//   - **History**: `/funding_rate/history?symbol=&limit=&cursor=`, newest first, no time filter.
//   - **Rate limit**: the docs give unauthenticated IPs 100 credits a minute; this machine is served
//     `ratelimit-policy: "credits";q=1000;w=60`. Measured costs: `/info/prices` and `/info` 10 credits,
//     `/funding_rate/history` 90 at any limit. 6 s spacing holds history paging to ~900 credits a
//     minute — which is what MinInterval is.
package pacifica

import (
	"fmt"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "pacifica"

const hourMs = 3_600_000

// FundingHours: funding settles every hour and both published rates are 1-hour rates; see the
// package header.
const FundingHours = 1.0

// settlementQuote: perps margin and settle in USDC —
// https://docs.pacifica.fi/trading-on-pacifica/unified-margin.md defines cross equity as
// `usdc_balance + unrealized_pnl`, and the deposits page withdraws USDC. The API itself names no
// settlement asset (symbols are bare: "BTC"), so it is supplied here rather than parsed.
const settlementQuote = "USDC"

// Price is one row of `/info/prices`.
type Price struct {
	Symbol string `json:"symbol"`
	// Funding is the rate fixed for the settlement at the next top of the hour; see the header.
	Funding adapters.Num `json:"funding"`
	// NextFunding is the running estimate for the settlement after that.
	NextFunding adapters.Num `json:"next_funding"`
	Mark        adapters.Num `json:"mark"`
	Oracle      adapters.Num `json:"oracle"`
	// OpenInterest is BASE UNITS, although the docs say USD; see the header.
	OpenInterest adapters.Num `json:"open_interest"`
	// Volume24h is USD.
	Volume24h adapters.Num `json:"volume_24h"`
}

// MarketInfo is one row of `/info`.
type MarketInfo struct {
	Symbol string `json:"symbol"`
	// BaseAsset is a pointer because the venue may omit it, and "declared nothing" has to stay
	// distinguishable from a declared empty string: an absent declaration falls back to the symbol
	// parser rather than overriding it with "".
	BaseAsset *string `json:"base_asset"`
	// InstrumentType is "perpetual" or "spot".
	InstrumentType string       `json:"instrument_type"`
	MaxLeverage    adapters.Num `json:"max_leverage"`
}

// FundingRecord is one row of `/funding_rate/history`.
type FundingRecord struct {
	// FundingRate is the "last settled funding rate" as of CreatedAt.
	FundingRate adapters.Num `json:"funding_rate"`
	// NextFundingRate is the prediction for the settlement after this one.
	NextFundingRate adapters.Num `json:"next_funding_rate"`
	// CreatedAt is epoch MILLISECONDS, a few hundred ms after the hour it settled on.
	CreatedAt adapters.Num `json:"created_at"`
}

// Response is Pacifica's envelope. Data is a pointer so that an absent or null `data` stays
// distinguishable from an empty list, which is what the TypeScript `Array.isArray(body.data)` guard
// turns into a thrown error: a response that lost its payload has to fail the venue's cycle rather
// than read as a venue with nothing listed.
type Response[T any] struct {
	Success    bool    `json:"success"`
	Data       *[]T    `json:"data"`
	NextCursor *string `json:"next_cursor"`
	HasMore    bool    `json:"has_more"`
}

// ExpectData unwraps an envelope, mirroring the TypeScript `expectData` throw. A `data` that is
// present but not an array fails earlier still, in the decode, which is the same rejection one step
// sooner.
func ExpectData[T any](body Response[T], what string) ([]T, error) {
	if !body.Success || body.Data == nil {
		return nil, fmt.Errorf("%s: unexpected %s response", VenueID, what)
	}
	return *body.Data, nil
}

// TradfiTag is one of the three non-crypto tags Pacifica's web app carries.
type TradfiTag string

const (
	TagEquities    TradfiTag = "Equities"
	TagCommodities TradfiTag = "Commodities"
	TagFX          TradfiTag = "FX"
)

// TradfiTags is the non-crypto classes Pacifica declares.
//
// WHY A TABLE, when class is meant to be declared: the API declares nothing (`/info` has
// `instrument_type` and no category). Pacifica's web app does: module 77482 of its bundle at
// https://app.pacifica.fi ships a symbol-to-tags map behind the market picker's category tabs (New,
// Majors, L1/L2, DeFi, AI, Meme, Pre-Market, Equities, Commodities, FX). These are its Equities,
// Commodities and FX entries, copied on 2026-09-14 — 38 of its 184, including symbols not yet listed.
// Everything else it tags with a crypto sector, and a symbol it does not tag has declared nothing:
// both are crypto.
//
// Of the 76 live perps the map files 14 as Equities, 8 as Commodities and 2 as FX; 10 recent listings
// (PUMP WLFI ASTER XPL 2Z MON CHIP VVV PONS USELESS) are absent from it. PAXG is filed under
// Commodities but stays crypto through the tokenised table; SP500 reaches US500 and so `index`. URNM,
// a uranium-miners ETF, is filed as a commodity because that is what Pacifica says.
var TradfiTags = map[string]TradfiTag{
	"ANTHROPIC": TagEquities,
	"NVDA":      TagEquities,
	"TSLA":      TagEquities,
	"GOOGL":     TagEquities,
	"MSTR":      TagEquities,
	"PLTR":      TagEquities,
	"MSFT":      TagEquities,
	"AMZN":      TagEquities,
	"COIN":      TagEquities,
	"HOOD":      TagEquities,
	"META":      TagEquities,
	"AAPL":      TagEquities,
	"NFLX":      TagEquities,
	"GME":       TagEquities,
	"CRCL":      TagEquities,
	"SP500":     TagEquities,
	"SPCX":      TagEquities,
	"SKHYNIX":   TagEquities,
	"SAMSUNG":   TagEquities,
	"MU":        TagEquities,
	"DRAM":      TagEquities,
	"SNDK":      TagEquities,
	"PAXG":      TagCommodities,
	"XAU":       TagCommodities,
	"XAG":       TagCommodities,
	"COPPER":    TagCommodities,
	"CL":        TagCommodities,
	"NATGAS":    TagCommodities,
	"URNM":      TagCommodities,
	"PLATINUM":  TagCommodities,
	"EURUSD":    TagFX,
	"USDKRW":    TagFX,
	"NZDUSD":    TagFX,
	"AUDUSD":    TagFX,
	"USDJPY":    TagFX,
	"USDCAD":    TagFX,
	"USDCHF":    TagFX,
	"GBPUSD":    TagFX,
}

// AssetClassFor is the class Pacifica's own app files a symbol under: crypto unless the tag map says
// otherwise. A symbol the map does not carry has declared nothing, and everything undeclared here is
// crypto.
func AssetClassFor(symbol string) core.AssetClass {
	switch TradfiTags[symbol] {
	case TagEquities:
		return core.ClassEquity
	case TagCommodities:
		return core.ClassCommodity
	case TagFX:
		return core.ClassFX
	default:
		return core.ClassCrypto
	}
}

// declaredBase is the declared `base_asset`, where the symbol parser reads the symbol differently,
// and nil where the parser should be left alone.
//
// Checked against all 77 rows on 2026-09-14: 73 agree. kBONK, kPEPE and kSHIB parse as BONK, PEPE and
// SHIB at x1000, which is right (marks 0.002715, 0.00337, 0.005179 against Hyperliquid's kBONK,
// kPEPE, kSHIB), so a scaled parse is kept. EURUSD parses as EUR against USD; the venue says the base
// is EURUSD, which is what it passes.
func declaredBase(symbol string, declared *string) *string {
	if declared == nil || *declared == "" {
		return nil
	}
	parsed := core.ParseVenueSymbol(symbol)
	if parsed.Multiplier == 1 && parsed.Base != core.CanonicalBase(*declared) {
		return declared
	}
	return nil
}

// marketRefFor builds the identity for one Pacifica market: the venue's tag map settles the class,
// USDC is supplied as the quote the API never names, and the declared base overrides the parser only
// where the two disagree at scale 1.
//
// `dex` is deliberately not overridden. The TypeScript adapter supplies no `dex` field at all, so the
// parsed value stands — and Overrides.HasDex stays false, since an absent override and an override to
// nil are different states here.
func marketRefFor(symbol string, info *MarketInfo) core.MarketRef {
	quote := settlementQuote
	class := AssetClassFor(symbol)
	overrides := adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	}
	if info != nil {
		overrides.Base = declaredBase(symbol, info.BaseAsset)
	}
	return adapters.MarketRefFor(VenueID, symbol, overrides)
}

// Perpetuals is the perpetuals from `/info`, by symbol. On 2026-09-14: 76 of 77 (SOL-USDC is spot).
//
// A Go map rather than an ordered structure because the venue's order is never read back: this is
// only ever indexed by symbol, and the snapshot order comes from `/info/prices`, which is a list.
func Perpetuals(info []MarketInfo) map[string]MarketInfo {
	perpetuals := make(map[string]MarketInfo, len(info))
	for _, market := range info {
		if market.InstrumentType == "perpetual" {
			perpetuals[market.Symbol] = market
		}
	}
	return perpetuals
}

// ParseSnapshots normalises one cycle's `/info/prices` response against the cached `/info`.
func ParseSnapshots(prices []Price, perpetuals map[string]MarketInfo, now int64) []core.FundingSnapshot {
	nextFundingAt := now/hourMs*hourMs + hourMs
	basisHours := FundingHours

	snapshots := make([]core.FundingSnapshot, 0, len(prices))
	for _, row := range prices {
		info, listed := perpetuals[row.Symbol]
		// Spot rows and anything `/info` does not call a perpetual are skipped, as is a market with
		// no rate to carry.
		if !listed || !row.Funding.OK {
			continue
		}

		markPrice := row.Mark.Ptr()
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     marketRefFor(row.Symbol, &info),
			ObservedAt:    now,
			Rate:          row.Funding.Val,
			BasisHours:    basisHours,
			IntervalHours: &basisHours,
			NextFundingAt: &nextFundingAt,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    row.Oracle.Ptr(),
			// Base units x mark, as Pacifica's own app computes it; see the header.
			OpenInterestUSD: adapters.Mul(row.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    row.Volume24h.Ptr(),
			MaxLeverage:     info.MaxLeverage.Ptr(),
		})
	}
	return snapshots
}

// ParseFundingHistory returns settled hourly rates within [fromMs, toMs], oldest first, from
// newest-first history records.
func ParseFundingHistory(
	records []FundingRecord,
	venueSymbol string,
	info *MarketInfo,
	fromMs, toMs int64,
) []core.FundingEvent {
	ref := marketRefFor(venueSymbol, info)

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(records))
	for _, record := range records {
		if !record.CreatedAt.OK || !record.FundingRate.OK {
			continue
		}
		// Stamped ~0.4 s after the hour (1789336800497 is 22:00:00.497); the settlement is the hour.
		// Epoch milliseconds are positive, so truncating division is the floor the TypeScript takes.
		settledAt := int64(record.CreatedAt.Val) / hourMs * hourMs
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       record.FundingRate.Val,
			BasisHours: FundingHours,
			MarkPrice:  nil,
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
