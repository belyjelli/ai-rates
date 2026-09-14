// Package arcus parses Arcus (dYdX Labs, Robinhood Chain).
//
// Ported from packages/adapters/src/venues/arcus.ts, with the measured evidence kept because a
// reader must not have to go find out why a rule exists before they are allowed to keep it.
//
// REQUESTS: one per cycle, `GET /v1/markets`. Every public call draws from a per-IP bucket of 1,500
// weight refilling at 1,500/minute; `markets` and `fundingRates` cost 20 plus floor(rows / 20)
// (https://docs.arcus.xyz/api-reference/rate-limits.md). A full 1,000-row history page is 70, so 3s
// spacing (20 calls/minute, 1,400 weight at worst) cannot exhaust the bucket.
//
// FUNDING: hourly, as a fraction, positive means longs pay
// (https://docs.arcus.xyz/concepts/perpetuals/funding.md: "charged once an hour", capped at ±4%/h).
// The markets doc defines `fundingRate` as the "most recently applied funding rate" and
// `nextFundingRate` as the "forecast for the next funding rate", so:
//   - the snapshot's rate is `nextFundingRate`, `predicted`, due at `nextFundingAt` (unix SECONDS);
//   - `fundingRate` is also returned as a `settled` event one hour before `nextFundingAt`. Verified
//     live 2026-09-14: `/v1/fundingRates` for BTC-USD and AMD-USD had its newest row at exactly
//     `nextFundingAt - 3600s`, with the same rate as `fundingRate` (0.0000125 and
//     0.000004768518518518).
//
// Checked against other venues: BTC 0.0000125/h is 10.95% APR, Extended 11.4% the same afternoon.
//
// UNITS, per the markets doc and checked live: `openInterest` is "total size of all open long
// positions ... in base asset units" (BTC 60.06 x 77,119.6 = $4.63M, a tenth of Extended's $44.8M for
// a venue launched in May), and `volume24hNotional` is USD (BTC $18.09M, and 229.32 BTC x mark agrees).
//
// TRADABILITY: `type` PERPETUAL and `status` ONLINE. On 2026-09-14: 58 ONLINE, 6 OFFLINE (F, BAC, CCL,
// RVI, VT, SGOV, all at zero price). Equities outside regular hours stay ONLINE: "RWA perps trade 24/7"
// with funding locked to SOFR + 0.5% off-hours, so they are kept.
//
// QUOTE: USDG. `quoteAsset` is "USD" on every market, the price unit, but "Arcus settles in USDG, a
// regulated stablecoin issued by Paxos" (https://docs.arcus.xyz/concepts/onboarding.md). So the
// venue's own `quoteAsset` is deliberately not decoded: the quote is overridden outright.
//
// BASE: `baseAsset` agreed with the parsed `marketDisplayName` on all 58 live markets, so the parser
// is used as for every other venue, and `baseAsset` is likewise not decoded.
package arcus

import (
	"math"
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "arcus"

const (
	hourMs = 3_600_000
	// fundingHours: hourly, per the funding doc, for both the forecast and the settlement.
	fundingHours = 1.0
	// Quote is what Arcus settles in, which is not the `quoteAsset` it prices in.
	Quote = "USDG"
)

// Market is one row of `GET /v1/markets`.
type Market struct {
	MarketDisplayName string `json:"marketDisplayName"`
	Status            string `json:"status"`
	Type              string `json:"type"`
	// Category is the class Arcus declares. Absent, null and "" all read as crypto, which is why
	// this is a plain string rather than a pointer: unlike a numeric, the three states are not
	// distinguishable in behaviour here.
	Category    string       `json:"category"`
	MarkPrice   adapters.Num `json:"markPrice"`
	OraclePrice adapters.Num `json:"oraclePrice"`
	// FundingRate is the most recently applied hourly rate.
	FundingRate adapters.Num `json:"fundingRate"`
	// NextFundingRate is the forecast for the next hourly payment.
	NextFundingRate adapters.Num `json:"nextFundingRate"`
	// NextFundingAt is unix SECONDS, unlike the milliseconds everything else here carries.
	NextFundingAt adapters.Num `json:"nextFundingAt"`
	// OpenInterest is BASE UNITS, long side, so it needs the mark to become a notional.
	OpenInterest          adapters.Num `json:"openInterest"`
	Volume24hNotional     adapters.Num `json:"volume24hNotional"`
	InitialMarginFraction adapters.Num `json:"initialMarginFraction"`
}

// MarketsResponse is the envelope `GET /v1/markets` answers with. Markets is a pointer so an
// absent array is told apart from an empty one, which is what the TypeScript side gets from its
// Array.isArray guard before it will trust the body.
type MarketsResponse struct {
	Markets *[]Market `json:"markets"`
}

// FundingRate is one settled payment from `GET /v1/fundingRates`.
type FundingRate struct {
	MarketDisplayName string       `json:"marketDisplayName"`
	FundingRate       adapters.Num `json:"fundingRate"`
	// Time is epoch MICROSECONDS, three digits wider than every other venue's stamp.
	Time adapters.Num `json:"time"`
}

// FundingRatesResponse is the envelope `GET /v1/fundingRates` answers with.
type FundingRatesResponse struct {
	FundingRates *[]FundingRate `json:"fundingRates"`
}

// AssetClassFor is the class Arcus declares in `category`: CRYPTO, EQUITIES, INDICES, FOREX or
// COMMODITIES.
//
// On 2026-09-14 the 58 live perps were CRYPTO 22, EQUITIES 30, COMMODITIES 4 and INDICES 2.
//
// COMMODITIES is not taken literally. Its four markets are GLD, SLV, USO and CPER, which the RWA doc
// describes as "commodity ETFs" (https://docs.arcus.xyz/concepts/perpetuals/real-world-assets.md),
// and core files ETFs as equity whatever a venue calls them. So the category says "not crypto" and
// the base tables say which kind: the four ETFs become equity, while a spot-gold XAU perp listed
// there later would still become commodity. INDICES (SPY, QQQ, also ETFs) is passed as index for
// MarketRefFor to settle the same way. Anything unrecognised that is not CRYPTO is tradfi of an
// unknown kind.
func AssetClassFor(category, base string) core.AssetClass {
	switch strings.ToUpper(strings.TrimSpace(category)) {
	case "", "CRYPTO":
		return core.ClassCrypto
	case "EQUITIES":
		return core.ClassEquity
	case "INDICES":
		return core.ClassIndex
	case "FOREX":
		return core.ClassFX
	default:
		return core.ClassifyNonCrypto(base)
	}
}

// refFor builds the market reference: the quote is always overridden to what Arcus settles in, and
// the class is the declared category refined by the base tables.
func refFor(venueSymbol, category string) core.MarketRef {
	parsed := adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{})
	class := AssetClassFor(category, parsed.Base)
	quote := Quote
	return adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseMarkets normalises one cycle's `/markets` response.
//
// Each tradable market yields a predicted snapshot from `nextFundingRate` and, where the venue also
// states the applied rate, a settled event one hour before the next settlement.
func ParseMarkets(markets []Market, now int64) core.SnapshotBatch {
	snapshots := make([]core.FundingSnapshot, 0, len(markets))
	settled := make([]core.FundingEvent, 0, len(markets))

	for _, market := range markets {
		rate := market.NextFundingRate
		if market.Type != "PERPETUAL" || market.Status != "ONLINE" || !rate.OK {
			continue
		}

		ref := refFor(market.MarketDisplayName, market.Category)

		// SECONDS, so a plain PositiveMs would be out by a factor of a thousand.
		var nextFundingAt *int64
		if seconds := market.NextFundingAt; seconds.OK && seconds.Val > 0 {
			at := int64(seconds.Val) * 1000
			nextFundingAt = &at
		}

		markPrice := market.MarkPrice.Ptr()
		interval := fundingHours

		var maxLeverage *float64
		if imf := market.InitialMarginFraction; imf.OK && imf.Val > 0 && imf.Val <= 1 {
			leverage := 1 / imf.Val
			maxLeverage = &leverage
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          rate.Val,
			BasisHours:    fundingHours,
			IntervalHours: &interval,
			NextFundingAt: nextFundingAt,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    market.OraclePrice.Ptr(),
			// Base units, long side: without the mark this would report 60 where $4.63M is meant.
			OpenInterestUSD: adapters.Mul(market.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    market.Volume24hNotional.Ptr(),
			MaxLeverage:     maxLeverage,
		})

		// The applied rate was paid at the settlement one hour before the next one, which the live
		// history confirms to the millisecond.
		if applied := market.FundingRate; applied.OK && nextFundingAt != nil {
			settled = append(settled, core.FundingEvent{
				MarketRef:  ref,
				SettledAt:  *nextFundingAt - hourMs,
				Rate:       applied.Val,
				BasisHours: fundingHours,
				MarkPrice:  nil,
			})
		}
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}
}

// ParseFundingRates returns the hourly settlements within [fromMs, toMs], oldest first.
//
// One event per settlement timestamp, because paging by `to` can repeat a row across a boundary;
// the last occurrence wins, as the TypeScript Map's set does. The output is sorted by settlement,
// so the order does not depend on Go's map iteration.
func ParseFundingRates(rows []FundingRate, venueSymbol, category string, fromMs, toMs int64) []core.FundingEvent {
	ref := refFor(venueSymbol, category)

	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		if !row.Time.OK || !row.FundingRate.OK {
			continue
		}
		// MICROSECONDS to milliseconds.
		settledAt := int64(math.Floor(row.Time.Val / 1000))
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       row.FundingRate.Val,
			BasisHours: fundingHours,
			MarkPrice:  nil,
		}
	}

	stamps := make([]int64, 0, len(bySettlement))
	for settledAt := range bySettlement {
		stamps = append(stamps, settledAt)
	}
	sort.Slice(stamps, func(i, j int) bool { return stamps[i] < stamps[j] })

	events := make([]core.FundingEvent, 0, len(stamps))
	for _, settledAt := range stamps {
		events = append(events, bySettlement[settledAt])
	}
	return events
}
