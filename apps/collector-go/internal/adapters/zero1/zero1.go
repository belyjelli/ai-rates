// Package zero1 parses N1 / 01 Exchange (Nord engine, `zo-mainnet.n1.xyz`).
//
// Ported from packages/adapters/src/venues/zero1.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/zero1) and the same expected values as zero1.test.ts, so the Go
// and TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: `GET /markets/live` every cycle, plus `GET /info` once an hour. The catalog probes the
// per-market `/market/{id}/stats`, but the engine's own OpenAPI (`/openapi.json`, "nord" 20.0.0)
// lists `/markets/live` -- "Live market info such as index price, funding rate, and so on" -- for
// every market in one ~20 KB call. No rate limit is documented; two requests a minute at 250ms
// spacing is far below anything the per-market route would have needed (39 calls).
//
// FUNDING -- which field. `perpetuals.projectedFundingRate` is "the projected funding rate for the
// next funding time", so it is `predicted`. The catalog's `perpStats.funding_rate` is NOT that:
// sampled together on 2026-09-13 22:35-22:38 UTC, BTC's stats `funding_rate` read -0.000001 every
// minute and equalled `historical.perpetuals.lastSettledFundingRate`, while the projection read
// +0.000001. Storing the stats value as predicted would label a settled rate predicted.
//
// FUNDING -- units and period. A fraction per ONE hour, positive = longs pay. Settlement is
// "locked to the hour" (`nextFundingTime`), and `/market/{id}/history/PT1H` rows are an hour apart.
// The unit is proved from the funding index, which the spec defines as "basis points numerator x
// market price mantissa" in per-million steps: BTC's `fundingIndex` rose 3,090,324 at the 20:00
// settlement, which is exactly the settled 4e-6 x 1e6 x the index price mantissa 772,581
// (77,258.1 at 1 price decimal). So the published 4e-6 is what a unit of notional paid that hour --
// a fraction, not percent. BTC settles near zero here (-1e-6 at 22:00) against Hyperliquid's
// +0.0000114/h: N1 has no interest-rate floor, so a small book sits on either side of zero.
// ETH's settled 0.00002 (20:00) and 0.000009 (21:00) are Hyperliquid-sized hourly numbers.
//
// The projection is what settles: at 22:59 UTC BTC projected 0.000002 and ETH -0.000006, and the
// 23:00 history rows are exactly 0.000002 and -0.000006. It "becomes null right after funding is
// paid"; by 23:00:32 BTC already projected the next hour again, and at 23:01 the only null among
// 39 markets was frozen IPUSD. A market caught in that gap is skipped for the cycle rather than
// shown with its settled rate under a predicted label.
//
// UNITS: `openInterest` is base units (BTC 3.87 x 76,795 = $297k); `volumeQuote24h` is quote
// (USDC), BTC $1.45M against 18.8 BTC base volume.
//
// TRADABILITY: in `/info` and not `frozen` ("admin can freeze market ... or if market permanently
// delisted"), with a mark and a projection. On 2026-09-13: 39 markets, 26 CLOB and 13 RFQ-mode, all
// regime normal; one frozen (IPUSD, no book since 2026-09-08). RFQ markets trade and accrue funding
// like the rest, so they are kept.
//
// CLASS: N1 declares none; every market is crypto (PAXG is the gold token).
//
// QUOTE: the `quoteTokenId` token from `/info`, which is USDC (token 0) on every market.
//
// BASE: the parser splits two of 39 symbols wrongly -- `ARBUSD` as AR/BUSD and `BNBUSD` as BN/BUSD
// -- because BUSD is a quote it knows. N1 declares no base field (every market's `baseTokenId` is 0,
// the USDC token), so the base comes from its symbol grammar: `<base>USD`, as every one of the 39
// symbols is spelt. The remainder still goes through the parser, so `kPEPE` reads as PEPE x1000,
// as it does on Hyperliquid.
package zero1

import (
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "zero1"

// APIBase is the Nord engine's mainnet host.
const APIBase = "https://zo-mainnet.n1.xyz"

const (
	symbolSuffix = "USD"
	// FundingHours: N1 settles on the hour and quotes a rate for that one hour.
	FundingHours = 1.0
)

// ErrUnexpectedInfo, ErrUnexpectedMarketsLive and ErrUnexpectedHistory mirror the TypeScript
// adapter's throws when `markets`/`tokens`, `markets` or `items` is missing or is not an array. A
// response that lost its payload has to fail the venue's cycle rather than read as a venue with
// nothing listed and no funding ever settled.
var (
	ErrUnexpectedInfo        = errors.New("zero1: unexpected info response")
	ErrUnexpectedMarketsLive = errors.New("zero1: unexpected markets/live response")
	ErrUnexpectedHistory     = errors.New("zero1: unexpected history response")
)

// MarketInfo is one row of `/info`'s market catalog.
//
// Mode is "clob" or "rfq" and Regime is "normal" on every live market; neither gates tradability --
// RFQ markets trade and accrue funding like the rest -- so both are carried for the record only.
type MarketInfo struct {
	MarketID int    `json:"marketId"`
	Symbol   string `json:"symbol"`
	// QuoteTokenID indexes Info.Tokens; it is the USDC token (0) on every market.
	QuoteTokenID int    `json:"quoteTokenId"`
	Mode         string `json:"mode"`
	Regime       string `json:"regime"`
}

// Token is one row of `/info`'s token table.
type Token struct {
	TokenID int    `json:"tokenId"`
	Symbol  string `json:"symbol"`
}

// Info is the `/info` body. The slices are pointers so an absent or null array is distinguishable
// from an empty one, which is what the TypeScript `!Array.isArray(...)` guard turns into a thrown
// error.
type Info struct {
	Markets *[]MarketInfo `json:"markets"`
	Tokens  *[]Token      `json:"tokens"`
}

// MarketList and TokenList read the arrays nil-safely, so a parse over a half-decoded Info yields
// nothing rather than panicking.
func (i Info) MarketList() []MarketInfo {
	if i.Markets == nil {
		return nil
	}
	return *i.Markets
}

func (i Info) TokenList() []Token {
	if i.Tokens == nil {
		return nil
	}
	return *i.Tokens
}

// LivePerpetuals is the perpetual block of one `/markets/live` row.
type LivePerpetuals struct {
	MarkPrice adapters.Num `json:"markPrice"`
	// ProjectedFundingRate is "the projected funding rate for the next funding time", so it is the
	// predicted rate. It goes null right after a settlement is paid; a market caught in that gap is
	// skipped rather than shown with its settled rate under a predicted label.
	ProjectedFundingRate adapters.Num `json:"projectedFundingRate"`
	NextFundingTime      string       `json:"nextFundingTime"`
	// OpenInterest is BASE units, not quote: BTC 3.8737 x 76,795 = $297k.
	OpenInterest adapters.Num `json:"openInterest"`
}

// HistoricalPerpetuals carries the settled rate.
//
// LastSettledFundingRate is decoded but deliberately NOT read: it is what the catalog's
// `perpStats.funding_rate` reports, and storing it as the predicted rate would label a settled rate
// predicted. Sampled 2026-09-13 22:35-22:38 UTC, BTC read -0.000001 here every minute while the
// projection read +0.000001.
type HistoricalPerpetuals struct {
	LastSettledFundingRate adapters.Num `json:"lastSettledFundingRate"`
}

// LiveHistorical is the 24h block of one `/markets/live` row.
type LiveHistorical struct {
	// VolumeQuote24h is QUOTE (USDC) turnover: BTC $1.45M against 18.8 BTC of base volume.
	VolumeQuote24h adapters.Num          `json:"volumeQuote24h"`
	Perpetuals     *HistoricalPerpetuals `json:"perpetuals"`
}

// MarketLive is one row of `/markets/live`.
//
// Perpetuals and Historical are pointers because the venue sends them as null on some markets, and
// an absent block is not one full of zeroes.
type MarketLive struct {
	MarketID int `json:"marketId"`
	// Frozen is what the venue sets when an "admin can freeze market ... or if market permanently
	// delisted". Absent means not frozen, which is the TypeScript falsy reading.
	Frozen     bool            `json:"frozen"`
	IndexPrice adapters.Num    `json:"indexPrice"`
	Perpetuals *LivePerpetuals `json:"perpetuals"`
	Historical *LiveHistorical `json:"historical"`
}

// MarketsLiveResponse is the `/markets/live` body; the slice is a pointer for the same reason
// Info's are.
type MarketsLiveResponse struct {
	Markets *[]MarketLive `json:"markets"`
}

// HistoryRow is one settled hour from `/market/{id}/history/PT1H`.
type HistoryRow struct {
	MarketID int `json:"marketId"`
	// Time carries the settlement run's jitter ("22:00:00.333152Z") and is kept as published, as
	// Extended's and dYdX's are.
	Time        string       `json:"time"`
	FundingRate adapters.Num `json:"fundingRate"`
	MarkPrice   adapters.Num `json:"markPrice"`
}

// HistoryPage is one page of settlements, newest first, cursored by action id.
type HistoryPage struct {
	Items *[]HistoryRow `json:"items"`
	// NextStartInclusive is the cursor for the next page back, absent or null on the last one.
	NextStartInclusive *int64 `json:"nextStartInclusive"`
}

// BaseFor is the base and multiplier from N1's `<base>USD` symbol grammar, reporting false for a
// symbol not in that form.
//
// N1 declares no base field -- every market's `baseTokenId` is 0, the USDC token -- so the grammar
// is the only declaration there is. Going through it first is what keeps `ARBUSD` from splitting as
// AR/BUSD and `BNBUSD` as BN/BUSD, which is what the generic parser does with the BUSD quote it
// knows. The remainder still goes through the parser, so `kPEPE` reads as PEPE x1000.
func BaseFor(symbol string) (base string, multiplier float64, ok bool) {
	if !strings.HasSuffix(symbol, symbolSuffix) || len(symbol) <= len(symbolSuffix) {
		return "", 0, false
	}
	parsed := core.ParseVenueSymbol(symbol[:len(symbol)-len(symbolSuffix)])
	return parsed.Base, parsed.Multiplier, true
}

// TokensByID indexes `/info`'s token table, which is what turns `quoteTokenId` into "USDC".
func TokensByID(tokens []Token) map[int]string {
	byID := make(map[int]string, len(tokens))
	for _, token := range tokens {
		byID[token.TokenID] = token.Symbol
	}
	return byID
}

// refFor builds the market reference for one catalog row, reporting false for a symbol whose base
// the grammar cannot read.
//
// The quote is always OVERRIDDEN, with a nil value when the token id is unknown: the venue states
// the quote outright, so "N1 does not name this token" must reach the database as NULL rather than
// silently falling back to whatever the symbol parser guessed.
func refFor(market MarketInfo, tokens map[int]string) (core.MarketRef, bool) {
	base, multiplier, ok := BaseFor(market.Symbol)
	if !ok {
		return core.MarketRef{}, false
	}
	overrides := adapters.Overrides{Base: &base, Multiplier: &multiplier, HasQuote: true}
	if quote, named := tokens[market.QuoteTokenID]; named {
		overrides.Quote = &quote
	}
	return adapters.MarketRefFor(VenueID, market.Symbol, overrides), true
}

// ParseSnapshots normalises one cycle's `/info` catalog and `/markets/live` response.
//
// A market is skipped when it is not in the catalog, is frozen, publishes no perpetual block, or is
// caught in the gap where the projection is null between settlements.
func ParseSnapshots(info Info, live []MarketLive, now int64) []core.FundingSnapshot {
	catalog := make(map[int]MarketInfo, len(info.MarketList()))
	for _, market := range info.MarketList() {
		catalog[market.MarketID] = market
	}
	tokens := TokensByID(info.TokenList())

	snapshots := make([]core.FundingSnapshot, 0, len(live))
	for _, row := range live {
		market, listed := catalog[row.MarketID]
		if !listed {
			continue
		}
		ref, readable := refFor(market, tokens)
		perp := row.Perpetuals
		if !readable || row.Frozen || perp == nil ||
			!perp.ProjectedFundingRate.OK || !perp.MarkPrice.OK {
			continue
		}

		var nextFundingAt *int64
		if at, dated := parseInstant(perp.NextFundingTime); dated {
			nextFundingAt = &at
		}
		var volume24hUSD *float64
		if row.Historical != nil {
			volume24hUSD = row.Historical.VolumeQuote24h.Ptr()
		}

		markPrice := perp.MarkPrice.Ptr()
		interval := FundingHours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          perp.ProjectedFundingRate.Val,
			BasisHours:    FundingHours,
			IntervalHours: &interval,
			NextFundingAt: nextFundingAt,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    row.IndexPrice.Ptr(),
			// openInterest is base units, so the notional needs the mark beside it.
			OpenInterestUSD: adapters.Mul(perp.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    volume24hUSD,
		})
	}
	return snapshots
}

// ParseFunding returns hourly settlements within [fromMs, toMs], oldest first.
func ParseFunding(rows []HistoryRow, market MarketInfo, info Info, fromMs, toMs int64) []core.FundingEvent {
	ref, readable := refFor(market, TokensByID(info.TokenList()))
	if !readable {
		return nil
	}

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		settledAt, dated := parseInstant(row.Time)
		if !dated || !row.FundingRate.OK || settledAt < fromMs || settledAt > toMs {
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

// parseInstant reads one of N1's ISO-8601 instants as epoch milliseconds, reporting whether it was
// readable. The second return stands in for the TypeScript `Number.isFinite` guard on Date.parse,
// which is what keeps an unreadable timestamp out of the series instead of filing it at the epoch.
// Sub-millisecond jitter truncates rather than rounds, as Date.parse does.
func parseInstant(value string) (int64, bool) {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return 0, false
	}
	return parsed.UnixMilli(), true
}

// oldestSettlement is the earliest readable settlement in a page, and whether the page gave one at
// all. An empty page, or one holding a timestamp the parser cannot read, is not readable -- which is
// what the TypeScript side gets from Math.min() over an empty or NaN-bearing list, where neither
// Infinity nor NaN compares below fromMs and so neither ends the walk early.
func oldestSettlement(rows []HistoryRow) (int64, bool) {
	oldest := int64(0)
	found := false
	for _, row := range rows {
		settledAt, dated := parseInstant(row.Time)
		if !dated {
			return 0, false
		}
		if !found || settledAt < oldest {
			oldest = settledAt
			found = true
		}
	}
	return oldest, found
}
