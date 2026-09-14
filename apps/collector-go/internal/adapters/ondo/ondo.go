// Package ondo parses Ondo Perps, a tokenised-equity venue.
//
// Ported from packages/adapters/src/venues/ondo.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/ondo) and the same expected values as ondo.test.ts, so the Go and
// TypeScript parsers cannot drift apart while both are collecting.
//
// Two venue quirks run through everything here, and each one is a wrong number if it is dropped in
// translation:
//
//   - MOST OF THIS BOOK IS NOT CRYPTO. On 2026-09-14, 51 of 81 contracts were stocks and only 11
//     were crypto. The class comes from the declared `tags` and from nowhere else; see AssetClassFor,
//     which refuses to guess rather than defaulting an unknown tag to crypto.
//   - FUNDING IS HOURLY AND THE PUBLISHED RATES ARE 1-HOUR RATES, not the 8h convention most venues
//     quote. Reading them as 8h would understate every Ondo APR by 8x; see the Adapter doc comment
//     for the measurements that settle it.
package ondo

import (
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "ondo"

const hourMs = 3_600_000

// FundingHours: funding settles every hour and the published rates are 1-hour rates; see the
// Adapter doc comment.
const FundingHours = 1.0

// SettlementQuote: perps settle in USDC. The contracts endpoint says `quoteCurrency: "USD"`, which
// is the pricing unit; https://docs.ondoperps.xyz/settlement.md says losses, fees and funding move
// the USDC balance, and the funding-fee schema describes `amount` as "the actual amount of USDC
// transferred".
const SettlementQuote = "USDC"

type Contract struct {
	Market      string `json:"market"`
	ProductType string `json:"productType"`
	// BaseCurrency and QuoteCurrency are what the venue declares. Neither is read: BaseCurrency
	// matched the parsed symbol on all 81 contracts, and the quote is overridden to the settlement
	// currency. Kept so the wire shape stays legible beside the TypeScript interface.
	BaseCurrency  string `json:"baseCurrency"`
	QuoteCurrency string `json:"quoteCurrency"`
	// Disabled: "If true, the market is currently unavailable for trading."
	Disabled bool `json:"disabled"`
	// IsClosed: the underlying's session is closed (equities outside hours); the perp still trades
	// and funds.
	IsClosed   bool         `json:"isClosed"`
	IndexPrice adapters.Num `json:"indexPrice"`
	// OpenInterest is in base currency.
	OpenInterest    adapters.Num `json:"openInterest"`
	OpenInterestUsd adapters.Num `json:"openInterestUsd"`
	UsdVolume       adapters.Num `json:"usdVolume"`
	// FundingRate: "Funding rate at the last completed funding interval."
	FundingRate adapters.Num `json:"fundingRate"`
	// NextFundingRate: "Estimated funding rate at the end of the current funding interval."
	NextFundingRate adapters.Num `json:"nextFundingRate"`
	// NextFundingRateTimestamp is ISO-8601; when the next funding payment occurs.
	NextFundingRateTimestamp string `json:"nextFundingRateTimestamp"`
	// Tags are category labels: Crypto, Stock, ETF, Commodity, Index, FX.
	Tags []string `json:"tags"`
}

type MarkPrice struct {
	Market    string       `json:"market"`
	MarkPrice adapters.Num `json:"markPrice"`
}

type FundingRateValue struct {
	Market string `json:"market"`
	// Time is ISO-8601 with nanoseconds: "The time funding was paid".
	Time        string       `json:"time"`
	FundingRate adapters.Num `json:"fundingRate"`
}

// response is Ondo's envelope. Result is a pointer so that an absent or null `result` stays
// distinguishable from an empty one, which is what the TypeScript `body.result === null ||
// undefined` guard turns into a thrown error: a response that lost its payload has to fail the
// venue's cycle rather than read as a venue with nothing listed.
type response[T any] struct {
	Success  bool `json:"success"`
	Result   *T   `json:"result"`
	PageInfo *struct {
		NextCursor string `json:"nextCursor"`
	} `json:"pageInfo"`
}

// nanosecondFraction trims a sub-second fraction to milliseconds.
var nanosecondFraction = regexp.MustCompile(`(\.\d{3})\d+`)

// ParseTime reads epoch ms from Ondo's ISO timestamps, which carry nanoseconds
// ("2026-09-13T22:00:00.037237665Z"), reporting whether the stamp was readable at all.
//
// The fraction is cut to milliseconds first rather than trusting every runtime to accept nine
// digits. The second return stands in for the TypeScript `Number.isFinite` guard on Date.parse,
// which is what keeps an unreadable timestamp out of the series instead of filing it at the epoch.
//
// time.RFC3339 is stricter than Date.parse, which also accepts a bare date and other loose shapes.
// Every stamp this venue emits is a full RFC 3339 instant, and the strictness only narrows what is
// accepted, so an unreadable value still reports unreadable rather than landing at a wrong instant.
func ParseTime(value string) (int64, bool) {
	if value == "" {
		return 0, false
	}
	parsed, err := time.Parse(time.RFC3339, nanosecondFraction.ReplaceAllString(value, "$1"))
	if err != nil {
		return 0, false
	}
	return parsed.UnixMilli(), true
}

// AssetClassFor is the class Ondo declares in `tags`.
//
// On 2026-09-14 every one of the 81 contracts carried exactly one tag: Stock 51, Crypto 11, ETF 9,
// Commodity 6, Index 2, FX 2. ETFs are equity (see core's indexBases: QQQ, SPY and friends are filed
// as equity by five venues against two), and MarketRefFor still lifts an index-listed base to index.
// A tag we do not know is still a statement that the market is not crypto, so ClassifyNonCrypto
// places it rather than defaulting it to crypto; no tag at all declares nothing, which is crypto.
func AssetClassFor(tags []string, base string) core.AssetClass {
	tag := ""
	for _, candidate := range tags {
		if trimmed := strings.TrimSpace(candidate); trimmed != "" {
			tag = strings.ToLower(trimmed)
			break
		}
	}
	switch tag {
	// The empty string is the Go stand-in for TypeScript's `undefined` here: no tags at all, and a
	// tag list holding only blanks, both declare nothing.
	case "", "crypto":
		return core.ClassCrypto
	case "stock", "etf":
		return core.ClassEquity
	case "commodity":
		return core.ClassCommodity
	case "index":
		return core.ClassIndex
	case "fx":
		return core.ClassFX
	default:
		return core.ClassifyNonCrypto(base)
	}
}

// IsTradable reports a perpetual Ondo has not disabled. Closed-session equities stay in: they trade
// and fund hourly.
func IsTradable(contract Contract) bool {
	return contract.ProductType == "perpetual" && !contract.Disabled
}

// refFor builds the market reference for one contract.
func refFor(market string, tags []string) core.MarketRef {
	// `baseCurrency` matched the parsed symbol on all 81 contracts (BTC-USD.P -> BTC, WTI-USD.P -> CL
	// through the alias), so the parser is used and the declared base is not needed.
	base := core.ParseVenueSymbol(market).Base
	class := AssetClassFor(tags, base)
	quote := SettlementQuote
	return adapters.MarketRefFor(VenueID, market, adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseSnapshots normalises one cycle's /perps/contracts and /perps/mark_prices responses, plus the
// settlement each contract reports as its last completed interval.
//
// markPrices is a lookup only — the venue keys it by market and every row repeats its own market —
// so Go's map iteration order never reaches the output, which follows the contracts array.
func ParseSnapshots(contracts []Contract, markPrices map[string]MarkPrice, now int64) core.SnapshotBatch {
	snapshots := make([]core.FundingSnapshot, 0, len(contracts))
	settled := make([]core.FundingEvent, 0, len(contracts))

	for _, contract := range contracts {
		rate := contract.NextFundingRate
		if !IsTradable(contract) || !rate.OK {
			continue
		}

		ref := refFor(contract.Market, contract.Tags)
		nextFundingAt, hasNextFunding := ParseTime(contract.NextFundingRateTimestamp)

		var markPrice *float64
		if mark, known := markPrices[contract.Market]; known {
			markPrice = mark.MarkPrice.Ptr()
		}
		var nextFundingAtPtr *int64
		if hasNextFunding {
			at := nextFundingAt
			nextFundingAtPtr = &at
		}
		basisHours := FundingHours
		intervalHours := FundingHours

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          rate.Val,
			BasisHours:    basisHours,
			IntervalHours: &intervalHours,
			NextFundingAt: nextFundingAtPtr,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    contract.IndexPrice.Ptr(),
			// Ondo reports both; the USD figure is used as given. Checked on BTC: 55.4663 x 76,886 =
			// 4,264,582 against openInterestUsd 4,264,581.94.
			OpenInterestUSD: contract.OpenInterestUsd.Ptr(),
			Volume24hUSD:    contract.UsdVolume.Ptr(),
		})

		lastRate := contract.FundingRate
		if lastRate.OK && hasNextFunding {
			settled = append(settled, core.FundingEvent{
				MarketRef:  ref,
				SettledAt:  nextFundingAt - FundingHours*hourMs,
				Rate:       lastRate.Val,
				BasisHours: FundingHours,
				MarkPrice:  nil,
			})
		}
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}
}

// ParseFundingHistory returns settled hourly payments within [fromMs, toMs], oldest first, from
// newest-first history rows.
//
// tags come from the contract list, because history rows carry none; nil tags declare nothing, which
// AssetClassFor reads as crypto.
func ParseFundingHistory(rows []FundingRateValue, market string, tags []string, fromMs, toMs int64) []core.FundingEvent {
	ref := refFor(market, tags)

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		// Rows are stamped a few ms to tens of ms after the hour ("22:00:00.037237665Z"). Settlements
		// align to UTC hours per the docs, and the contracts endpoint's settlement is derived on the
		// hour, so the stamp is floored: otherwise one payment would be stored twice, 37 ms apart.
		stamped, readable := ParseTime(row.Time)
		if !readable || !row.FundingRate.OK {
			continue
		}
		settledAt := floorToHour(stamped)
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       row.FundingRate.Val,
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

// floorToHour snaps an epoch-ms instant down to the UTC hour. Go's integer division truncates
// toward zero rather than toward minus infinity, so a pre-epoch instant is corrected explicitly:
// Math.floor on the TypeScript side does not need the distinction and neither does any stamp this
// venue emits, but silently rounding the wrong way is not a difference worth leaving in a port.
func floorToHour(ms int64) int64 {
	floored := ms / hourMs * hourMs
	if ms < 0 && ms%hourMs != 0 {
		floored -= hourMs
	}
	return floored
}
