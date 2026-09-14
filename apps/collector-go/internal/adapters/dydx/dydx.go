// Package dydx parses the dYdX v4 indexer's perpetual market data.
//
// Ported from packages/adapters/src/venues/dydx.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/dydx) and the same expected values as dydx.test.ts, so the Go and
// TypeScript parsers cannot drift apart while both are collecting.
package dydx

import (
	"bytes"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "dydx"

const (
	hourMs = 3_600_000
	// FundingHours: dYdX v4 charges funding every hour and quotes a 1-hour rate.
	FundingHours = 1.0
)

// NonCryptoTickers is the dYdX markets that dYdX's own launch announcements present as something
// other than crypto.
//
// WHY A LIST OF TICKERS, when class is meant to be declared: dYdX declares nothing. Checked on
// 2026-09-14, no class exists in the indexer's `perpetualMarkets` (296 markets, 78 ACTIVE and 218
// FINAL_SETTLEMENT), in the chain's perpetual params, or in the slinky market map. So this is the
// venue's announcement list written down, NOT a rule read off the ticker. PAXG-USD, XAUT-USD and
// TSLAX-USD stay crypto because they are tokens, whatever their marks track.
//
// Only XAG-USD and WTI-USD are ACTIVE; EUR-USD and TRY-USD are in final settlement and listed so
// that their history is not filed as crypto. A new tradfi listing is crypto until it is added here,
// which is the safe direction: migration 016's mark gate still keeps it out of a crypto pool it
// disagrees with.
var NonCryptoTickers = map[string]struct{}{
	"XAG-USD": {},
	"WTI-USD": {},
	"EUR-USD": {},
	"TRY-USD": {},
}

// AssetClassFor is a dYdX market's declared class: crypto unless dYdX announced it as tradfi, in
// which case the commodity, currency and index tables decide which kind. The list above is the only
// "not crypto" signal the venue gives, so it only answers WHETHER a market is crypto.
func AssetClassFor(ticker string) core.AssetClass {
	if _, nonCrypto := NonCryptoTickers[ticker]; nonCrypto {
		return core.ClassifyNonCrypto(core.ParseVenueSymbol(ticker).Base)
	}
	return core.ClassCrypto
}

type PerpetualMarket struct {
	Ticker      string       `json:"ticker"`
	Status      string       `json:"status"`
	OraclePrice adapters.Num `json:"oraclePrice"`
	// NextFundingRate is the predicted 1-hour rate for the upcoming settlement.
	NextFundingRate adapters.Num `json:"nextFundingRate"`
	// OpenInterest is in base units.
	OpenInterest adapters.Num `json:"openInterest"`
	// Volume24H is 24h volume in USD.
	Volume24H adapters.Num `json:"volume24H"`
	// InitialMarginFraction is initial margin as a fraction of notional: 0.02 is 50x. Flat per
	// market, not tiered.
	InitialMarginFraction     adapters.Num `json:"initialMarginFraction"`
	MaintenanceMarginFraction adapters.Num `json:"maintenanceMarginFraction"`
}

// MarketList is the indexer's `markets` object flattened to a slice, in the order the response
// lists it.
//
// The indexer keys markets by ticker, and the TypeScript side reads them with Object.values(), which
// is document order. A Go map would hand back a different order on every cycle for no gain — the key
// is never read, since every row repeats its own ticker — so the decode keeps the document's order
// and drops the keys.
type MarketList []PerpetualMarket

// ErrUnexpectedMarkets and ErrUnexpectedHistory mirror the TypeScript adapter's throws when
// `markets` is missing or is not an object, and when `historicalFunding` is not an array. A response
// that lost its payload has to fail the venue's cycle rather than read as a venue with nothing
// listed and no funding ever settled.
var (
	ErrUnexpectedMarkets = errors.New("dydx: unexpected perpetualMarkets response")
	ErrUnexpectedHistory = errors.New("dydx: unexpected historicalFunding response")
)

func (m *MarketList) UnmarshalJSON(data []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	if delim, ok := token.(json.Delim); !ok || delim != '{' {
		return ErrUnexpectedMarkets
	}

	markets := make(MarketList, 0, 320)
	for decoder.More() {
		// The key is the ticker, which the row repeats; read past it.
		if _, err := decoder.Token(); err != nil {
			return err
		}
		var market PerpetualMarket
		if err := decoder.Decode(&market); err != nil {
			return err
		}
		markets = append(markets, market)
	}
	*m = markets
	return nil
}

// MarketsResponse is the /perpetualMarkets body. Markets is a pointer so that an absent or null
// `markets` is distinguishable from an empty one, which is what the TypeScript `!body?.markets`
// guard turns into a thrown error.
type MarketsResponse struct {
	Markets *MarketList `json:"markets"`
}

type HistoricalFunding struct {
	Ticker      string       `json:"ticker"`
	Rate        adapters.Num `json:"rate"`
	Price       adapters.Num `json:"price"`
	EffectiveAt string       `json:"effectiveAt"`
}

// HistoricalFundingResponse is the /historicalFunding body. The slice is a pointer for the same
// reason MarketsResponse.Markets is: a missing array is a broken response, not an empty page.
type HistoricalFundingResponse struct {
	HistoricalFunding *[]HistoricalFunding `json:"historicalFunding"`
}

// ParseMarkets normalises the indexer's active markets into snapshots.
func ParseMarkets(markets MarketList, now int64) []core.FundingSnapshot {
	nextFundingAt := now/hourMs*hourMs + hourMs
	basisHours := FundingHours

	snapshots := make([]core.FundingSnapshot, 0, len(markets))
	for _, market := range markets {
		rate := market.NextFundingRate
		if market.Status != "ACTIVE" || !rate.OK {
			continue
		}

		// dYdX has no separate mark price in the indexer; positions are marked to the oracle price.
		oracle := market.OraclePrice.Ptr()
		class := AssetClassFor(market.Ticker)
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef: adapters.MarketRefFor(VenueID, market.Ticker, adapters.Overrides{
				AssetClass: &class,
			}),
			ObservedAt:      now,
			Rate:            rate.Val,
			BasisHours:      basisHours,
			IntervalHours:   &basisHours,
			NextFundingAt:   &nextFundingAt,
			Kind:            core.KindPredicted,
			MarkPrice:       oracle,
			IndexPrice:      oracle,
			OpenInterestUSD: adapters.Mul(market.OpenInterest.Ptr(), oracle),
			Volume24hUSD:    market.Volume24H.Ptr(),
		})
	}
	return snapshots
}

// ParseLeverageTiers reads dYdX's flat margins: one rate for a market at any size, so each market
// gets a single unbounded tier rather than a ladder. The rate is not uniform across markets though —
// majors run at 0.02 (50x) while smaller markets sit at 0.1 (10x), so it is read per market, never
// assumed.
func ParseLeverageTiers(markets MarketList) []core.LeverageTier {
	tiers := make([]core.LeverageTier, 0, len(markets))
	for _, market := range markets {
		imr := market.InitialMarginFraction
		if market.Status != "ACTIVE" || !imr.OK || imr.Val <= 0 || imr.Val > 1 {
			continue
		}
		tiers = append(tiers, core.LeverageTier{
			VenueID:          VenueID,
			VenueSymbol:      market.Ticker,
			Tier:             1,
			LowerNotionalUSD: 0,
			// dYdX publishes no maximum position size.
			UpperNotionalUSD: nil,
			IMR:              imr.Val,
			MMR:              market.MaintenanceMarginFraction.Ptr(),
			MaxLeverage:      1 / imr.Val,
		})
	}
	return tiers
}

// ParseHistoricalFunding returns settled hourly payments within [fromMs, toMs], oldest first.
func ParseHistoricalFunding(items []HistoricalFunding, venueSymbol string, fromMs, toMs int64) []core.FundingEvent {
	class := AssetClassFor(venueSymbol)

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(items))
	for _, item := range items {
		settledAt, ok := parseEffectiveAt(item.EffectiveAt)
		if !ok || !item.Rate.OK || settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef: adapters.MarketRefFor(VenueID, venueSymbol, adapters.Overrides{
				AssetClass: &class,
			}),
			SettledAt:  settledAt,
			Rate:       item.Rate.Val,
			BasisHours: FundingHours,
			MarkPrice:  item.Price.Ptr(),
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

// parseEffectiveAt reads the indexer's ISO-8601 settlement instant as epoch milliseconds, reporting
// whether it was readable. The second return stands in for the TypeScript `Number.isFinite` guard on
// Date.parse, which is what keeps an unreadable timestamp out of the series instead of filing it at
// the epoch.
func parseEffectiveAt(effectiveAt string) (int64, bool) {
	parsed, err := time.Parse(time.RFC3339, effectiveAt)
	if err != nil {
		return 0, false
	}
	return parsed.UnixMilli(), true
}
