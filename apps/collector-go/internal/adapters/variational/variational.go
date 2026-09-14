// Package variational parses Variational Omni's per-listing market stats.
//
// Ported from packages/adapters/src/venues/variational.ts and pinned to the same fixture
// (packages/adapters/__fixtures__/variational) and the same expected values as variational.test.ts,
// so the Go and TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: one per cycle, `GET /metadata/stats`, which carries every listing. The API allows 10
// requests per 10s per IP (https://docs.variational.io/technical-documentation/api), so 1s spacing.
// There is no funding history endpoint.
//
// RFQ: Omni has no order book; every trade is quoted by its single maker, OLP. The stats still
// publish one funding rate, interval, mark and open interest PER LISTING, so this is a per-market
// rate like any other venue's, and the adapter can be built honestly. The RFQ quotes
// ($1k/$100k/$1m) have no resting size, so they are not mapped to BestBid/BestAsk.
//
// FUNDING: `funding_rate` is an ANNUALISED fraction ("decimal; multiply by 100 for percentage"),
// not the rate per `funding_interval_s`. The docs never say "annual", so this was established from
// values:
//   - Crypto perps default to 0.1095, and the docs fix the interest component at 0.00125% per hour:
//     0.0000125 x 8760 = 0.1095 exactly (286 listings read 0.1095 on 2026-09-14).
//   - Pre-IPO funding "is fixed at 0.005% every 8 hours"; OPENAI and ANTHROPIC read 0.05475, which
//     is 0.00005 x 1095 intervals a year.
//   - STORJ read -85.54 on a 1h interval. Per interval that is -8,554% an hour; annualised it is
//     -0.98% an hour, inside the documented 2%/h cap.
//   - BTC read 0.0912 (9.1% APR) against Extended's 11.4% and Arcus's 10.95% the same afternoon.
//
// So the stored rate is `funding_rate x intervalHours / 8760` over `intervalHours`: the per-payment
// rate, like every other adapter's. Positive means longs pay (docs, Funding Rates). The interval is
// per market, copied from Bybit or Binance where the asset lists there, else 1h: on 2026-09-14, 304
// at 4h, 238 at 8h, 5 at 1h. No next funding time is published. The rate is "current", so
// predicted.
//
// SWAPS are skipped: the 6 `funding_interval_s` 0 listings (XAUS, XAGS, USOILP, UKOILP, US500S,
// US100S, all named "Swap on ..."). Swaps "accrue funding once per day" at the 17:00 ET close, with
// "long and short rates published separately and generally asymmetric" -- and neither is in the
// stats, which read 0 for all six. There is no rate here to store.
//
// UNITS: "prices and volumes are denominated in USDC", and the per-listing open interest is quoted
// per side. OI is long + short: every position faces OLP, so each user long and each user short is
// a separate open contract, the order-book meaning of open interest. (The top-level
// `open_interest`, $1.61B, is exactly twice the listings' long + short sum of $806M, i.e. it counts
// OLP's side too.) Checked live: BTC $79.5M long + $70.1M short = $149.5M, against Extended's
// $44.8M; ETH long is $96.3M, 38.4k ETH at mark.
//
// TRADABILITY: the stats have no status field, and `num_markets` equals the listing count (553).
// Every listing had a quote under 20 minutes old. All 547 non-swap listings are kept.
//
// ASSET CLASS: Variational declares none. A listing has only `ticker` and a prose `name`, and the
// docs' TradFi page lists underlyings for 11 special symbols, not a class for every market. So
// every listing is crypto, which WILL mislabel tradfi here: TSLA "Tesla, Inc.", XAU "Gold", and CAT
// "Caterpillar Inc." at $817.81, which as crypto:CAT shares a base with the CAT memecoin on other
// venues. Migration 016's mark gate is what keeps those apart until Variational declares a class.
//
// QUOTE: USDC, the "Settlement Asset" for both perpetuals and swaps
// (the Swaps comparison table in https://docs.variational.io/llms-full.txt).
//
// BASE: `ticker` is the declared base. The parser agreed on 551 of 553 (the `1000`/`1000000`
// prefixes are its multiplier, not a disagreement); it cut `OPN_OPINION` to OPN and `RE_ETH` to RE,
// so those two pass the ticker as declared.
package variational

import (
	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	VenueID = "variational"
	// APIBase is VARIATIONAL_API on the TypeScript side.
	APIBase = "https://omni-client-api.prod.ap-northeast-1.variational.io"
	quote   = "USDC"
	// hoursPerYear is the divisor that turns the annualised funding_rate into a per-payment rate.
	// Kept local rather than taken from core, because it is the venue's own annualisation basis: it
	// is the 8760 that makes the documented 0.00125%/h interest component come to exactly 0.1095.
	hoursPerYear = 8760
)

// Listing is one market in the /metadata/stats response.
type Listing struct {
	Ticker string `json:"ticker"`
	Name   string `json:"name"`

	MarkPrice adapters.Num `json:"mark_price"`
	// Volume24h is USDC.
	Volume24h adapters.Num `json:"volume_24h"`
	// OpenInterest is USDC notional PER SIDE.
	OpenInterest struct {
		Long  adapters.Num `json:"long_open_interest"`
		Short adapters.Num `json:"short_open_interest"`
	} `json:"open_interest"`
	// FundingRate is an annualised fraction.
	FundingRate adapters.Num `json:"funding_rate"`
	// FundingIntervalS is 0 for swaps, which have no perp funding.
	FundingIntervalS adapters.Num `json:"funding_interval_s"`
}

type Stats struct {
	NumMarkets int `json:"num_markets"`
	// Listings is nil only when the field is absent or null; an empty JSON array decodes to an
	// empty non-nil slice, which is how the adapter tells "no listings field" from "no listings".
	Listings []Listing `json:"listings"`
}

// DeclaredBase is the ticker to pass as base where the parser reads it differently, else "".
func DeclaredBase(ticker string) string {
	parsed := core.ParseVenueSymbol(ticker)
	if parsed.Multiplier != 1 || parsed.Base == core.CanonicalBase(ticker) {
		return ""
	}
	return ticker
}

// IntervalRate is an annualised funding_rate as the rate for one payment of intervalHours.
func IntervalRate(annualised, intervalHours float64) float64 {
	return annualised * intervalHours / hoursPerYear
}

// ParseStats turns the per-listing stats into snapshots, skipping the swaps.
func ParseStats(body Stats, now int64) []core.FundingSnapshot {
	snapshots := make([]core.FundingSnapshot, 0, len(body.Listings))
	for _, listing := range body.Listings {
		annualised := listing.FundingRate
		intervalSeconds := listing.FundingIntervalS
		if !annualised.OK || !intervalSeconds.OK || intervalSeconds.Val <= 0 {
			continue
		}

		intervalHours := intervalSeconds.Val / 3600
		long := listing.OpenInterest.Long
		short := listing.OpenInterest.Short

		// The sides are added only when BOTH are published: reporting one side alone would be a
		// silent halving of the market's open interest rather than an absent reading.
		var openInterestUSD *float64
		if long.OK && short.OK {
			total := long.Val + short.Val
			openInterestUSD = &total
		}

		overrides := adapters.Overrides{Quote: ptr(quote), HasQuote: true}
		if declared := DeclaredBase(listing.Ticker); declared != "" {
			overrides.Base = &declared
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       adapters.MarketRefFor(VenueID, listing.Ticker, overrides),
			ObservedAt:      now,
			Rate:            IntervalRate(annualised.Val, intervalHours),
			BasisHours:      intervalHours,
			IntervalHours:   &intervalHours,
			NextFundingAt:   nil,
			Kind:            core.KindPredicted,
			MarkPrice:       listing.MarkPrice.Ptr(),
			IndexPrice:      nil,
			OpenInterestUSD: openInterestUSD,
			Volume24hUSD:    listing.Volume24h.Ptr(),
		})
	}
	return snapshots
}

func ptr[T any](v T) *T { return &v }
