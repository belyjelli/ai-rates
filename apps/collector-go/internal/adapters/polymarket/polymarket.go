// Package polymarket parses Polymarket Perps (https://docs.polymarket.com/perps/overview).
//
// Ported from packages/adapters/src/venues/polymarket.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/polymarket) and the same expected values as polymarket.test.ts, so
// the Go and TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: two per cycle, `GET /v1/info/tickers` (funding, mark, index, open interest) and
// `GET /v1/info/statistics` (24h volume, ~115 KB with its hourly klines), plus
// `GET /v1/info/instruments` once an hour for type, category, base and quote. The OpenAPI document
// (https://docs.polymarket.com/api-spec/perps-openapi.json) weighs tickers, statistics and instruments
// at 2 and funding history at 10 against a per-IP token bucket whose size it does not publish; 429s
// carry Retry-After, which httpclient honours. 250ms spacing keeps a cycle well under any sane bucket.
//
// FUNDING: hourly, as a fraction, positive means longs pay. The funding doc
// (https://docs.polymarket.com/perps/learn-about-trading/funding) samples a premium every 5s, averages
// it over the 1-hour charge window, runs it through an 8-hour formula and divides by 8: "FR_hour =
// clamp(F_8h / 8, +/-0.04)", settled "once at the end" of the hour. The ticker's `funding_rate` is the
// rolling rate for the open window, so it is `predicted` over a 1-hour basis. Measured 2026-09-13:
// WTIOIL read -0.00012782 at 22:28 and -0.00012987 at 22:33 (SOL -0.00001224 then -0.00001029), while
// the 22:00 settlement in `/v1/info/funding` was -0.000006. Quiet crypto markets sit on the formula's
// floor, 0.0001 / 8 = 0.0000125, and non-crypto on half of it (scale 0.5): 0.00000625, exactly what
// SP500, GOLD and MSFT read. Across the 23:00 settlement the last ticker reading (22:59:33) against the
// realized 23:00 row: WTIOIL -0.00012019 against -0.00011994, MSTR -0.00029609 against -0.00029526,
// SOL -0.00000513 against -0.00000512. Cross-checked against Hyperliquid the same minute: BTC 0.0000125/h
// (10.95% APR) against 0.0000115667, ETH 0.0000125 against 0.0000125. A 24x basis error would show
// as 263% APR on a flat book.
//
// INTERVAL: `funding_interval` is "1h" on all 83 instruments, and `next_funding` (epoch ms) was the
// top of the next hour on every ticker.
//
// UNITS: `open_interest` is in contracts ("Open interest in number of contracts", OpenAPI; the prose
// doc's "total notional" is wrong, BTC reads 114.138), and a contract is one unit of base: the hourly
// kline quantities in `statistics` times their prices sum to the reported USD volume (SILVER 11,396.5
// x ~$64.1 = $730k against 730,943; ETH 2,677.6 x ~$2,500 against $6.97M). So OI USD = contracts x
// mark (BTC 114.138 x 76,770 = $8.76M). `statistics.volume` is described as "volume in contracts" but
// is USD notional by that same check (BTC 1,853,965 against 20.0 BTC traded), so it is taken as USD.
// Tickers carry no volume field despite the prose doc listing an optional `volume_24h`.
//
// WHAT INSTRUMENTS TRACK: every instrument is `instrument_type` "perpetual" with category crypto,
// index, equity or commodity. The FAQ is explicit that perps are not prediction markets: "there is no
// event resolution and no $0/$1 settlement ... your position's value moves with the underlying asset's
// price". None of the 83 is an event contract, so none is excluded on that ground. `/v1/info/index`
// publishes no constituents (empty for all 18 assets queried), so the tracked asset is read from the
// instrument and the price: SPCX (SpaceX, pre-IPO), CXMT, KIOXIA are private or foreign equities.
//
// CLASS, declared by `category`. On 2026-09-13 the 83 declared crypto 37, equity 39, commodity 4 (GOLD,
// SILVER, WTIOIL, BRENTOIL) and index 3 (SP500, NAS100, DRAM); after core's index table files the DRAM
// ETF as equity, snapshots carry crypto 37, equity 40, commodity 4, index 2. Three of the "equity" rows
// are memecoins:
// PONS (Pons launchpad token) at 0.5553, CASHCAT (Cash Cat) at 0.1624 and USELESS (Useless Coin) at
// 0.2167, matching their Robinhood Chain / Solana DEX prices and listed as crypto by Hyperliquid and by
// Nado's own oracle table. They are kept with the class Polymarket declares, because the rule is the
// declaration and not the ticker; the consequence is that they do not pool with crypto PONS elsewhere.
//
// TRADABILITY: `instrument_type` perpetual, present in both instruments and tickers, with a numeric
// rate. Polymarket publishes no status; `ui_live_time` is documented as "advisory display timestamp".
// On 2026-09-13 all 83 instruments had a ticker and all were collected.
//
// QUOTE: PUSD. Every instrument declares `quote_asset` "pUSD", `/v1/info/assets` lists pUSD as the sole
// collateral, and fees and funding settle in it (https://docs.polymarket.com/perps/fund-your-account).
//
// BASE: `base_asset` is declared. The parser agrees with it on 82 of 83; GOOG-USD declares GOOGL
// (index 337.62, the Class A line), so the declaration is passed there. KPEPE-USD and KSHIB-USD are
// thousand-unit contracts (0.003347 against PEPE ~0.0000033) whose uppercase K the parser does not read
// as a multiplier and the venue does not declare as one; they are left as KPEPE and KSHIB.
package polymarket

import (
	"errors"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "polymarket"

const (
	// FundingBasisHours: the ticker's rolling rate covers the open 1-hour charge window, so it is
	// quoted over one hour and not over the 8-hour formula it is divided out of.
	FundingBasisHours = 1.0

	// QuoteAsset is the settlement currency, uppercased from the venue's "pUSD". pUSD is the sole
	// collateral on the venue, so it is stated rather than parsed off the "-USD" symbol suffix.
	QuoteAsset = "PUSD"
)

// ErrUnexpected* mirror the TypeScript adapter's throws when a bulk list, or a funding page's `data`,
// comes back as something other than an array. A response that lost its payload has to fail the
// venue's cycle rather than read as a venue with nothing listed and no funding ever settled.
var (
	ErrUnexpectedInstruments = errors.New("polymarket: unexpected instruments response")
	ErrUnexpectedTickers     = errors.New("polymarket: unexpected tickers response")
	ErrUnexpectedStatistics  = errors.New("polymarket: unexpected statistics response")
	ErrUnexpectedFunding     = errors.New("polymarket: unexpected funding response")
)

// Instrument is one row of /v1/info/instruments.
//
// Category, BaseAsset and FundingInterval are plain strings rather than pointers even though the venue
// types them nullable: the TypeScript reads all three through a trim-or-default, so an absent field and
// an empty one already take the same branch there. Only the NUMERICS are nullable here, where absent
// and zero are different readings.
type Instrument struct {
	InstrumentID   int64  `json:"instrument_id"`
	InstrumentType string `json:"instrument_type"`
	// Category is the declared class: crypto, index, equity or commodity (OpenAPI enum).
	Category   string `json:"category"`
	Symbol     string `json:"symbol"`
	BaseAsset  string `json:"base_asset"`
	QuoteAsset string `json:"quote_asset"`
	// FundingInterval is e.g. "1h". All 83 instruments read "1h" on 2026-09-13.
	FundingInterval string       `json:"funding_interval"`
	MaxLeverage     adapters.Num `json:"max_leverage"`
	// UILiveTime is documented as an "advisory display timestamp", so it is carried but never used as
	// a tradability gate: the gate is instrument_type plus the presence of a ticker with a rate.
	UILiveTime adapters.Num `json:"ui_live_time"`
}

// Ticker is one row of /v1/info/tickers.
type Ticker struct {
	InstrumentID int64        `json:"instrument_id"`
	Symbol       string       `json:"symbol"`
	IndexPrice   adapters.Num `json:"index_price"`
	MarkPrice    adapters.Num `json:"mark_price"`
	// OpenInterest is CONTRACTS, one base unit each -- not the notional the prose doc claims. BTC
	// reads 114.138, so the USD figure is contracts x mark.
	OpenInterest adapters.Num `json:"open_interest"`
	// FundingRate is the rolling hourly rate for the open charge window.
	FundingRate adapters.Num `json:"funding_rate"`
	// NextFunding is epoch MILLISECONDS of the next settlement.
	NextFunding adapters.Num `json:"next_funding"`
}

// Statistic is one row of /v1/info/statistics.
type Statistic struct {
	InstrumentID int64  `json:"instrument_id"`
	Symbol       string `json:"symbol"`
	// Volume is 24h USD notional. The schema calls it contracts and is wrong: BTC's 1,853,965 against
	// 20.0 BTC traded is dollars, not coins (see the package header).
	Volume adapters.Num `json:"volume"`
}

// FundingRow is one settled payment in /v1/info/funding.
type FundingRow struct {
	FundingRate adapters.Num `json:"funding_rate"`
	// Timestamp is epoch MILLISECONDS, carrying the venue's ~100ms settlement-run jitter.
	Timestamp adapters.Num `json:"timestamp"`
}

// FundingPage is one page of /v1/info/funding: at most 100 rows, newest first, with a `more` flag.
//
// Data is a pointer so an absent or null `data` is distinguishable from an empty page, which is what
// the TypeScript `!Array.isArray(body?.data)` guard turns into a thrown error.
type FundingPage struct {
	Data *[]FundingRow `json:"data"`
	More bool          `json:"more"`
}

// AssetClassFor is the class Polymarket declares in `category`: crypto, index, equity or commodity
// (OpenAPI enum).
//
// `index` is passed as index for MarketRefFor to settle against core's table, so DRAM (an ETF) lands on
// equity while SP500 and NAS100 stay index. A future non-crypto value falls to ClassifyNonCrypto.
func AssetClassFor(category, base string) core.AssetClass {
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "", "crypto":
		return core.ClassCrypto
	case "equity":
		return core.ClassEquity
	case "index":
		return core.ClassIndex
	case "commodity":
		return core.ClassCommodity
	default:
		return core.ClassifyNonCrypto(base)
	}
}

var intervalPattern = regexp.MustCompile(`^(\d+)h$`)

// IntervalHours reads `funding_interval`: "1h" -> 1, "8h" -> 8; nil for anything else.
func IntervalHours(interval string) *float64 {
	match := intervalPattern.FindStringSubmatch(strings.TrimSpace(interval))
	if match == nil {
		return nil
	}
	// ParseFloat reports ErrRange, and returns an infinity, for a digit string too large to hold --
	// which is the same rejection Number.isFinite makes on the TypeScript side.
	hours, err := strconv.ParseFloat(match[1], 64)
	if err != nil || math.IsInf(hours, 0) || math.IsNaN(hours) || !(hours > 0) {
		return nil
	}
	return &hours
}

// ref is the market reference for one instrument: the declared base where the parser disagrees with
// it, the declared quote always, and the declared class.
//
// The base is resolved in two passes because the class has to be decided against the CANONICAL base
// while the override itself is the venue's raw spelling. Pass one parses the symbol; the declaration
// wins only where it canonicalises to something else, which on 2026-09-13 was GOOG-USD alone (declared
// GOOGL, the Class A line at 337.62). Pass two canonicalises that base so AssetClassFor sees what the
// base tables see -- SP500 has to reach US500 before core's index table can keep it an index.
func ref(instrument Instrument) core.MarketRef {
	parsed := adapters.MarketRefFor(VenueID, instrument.Symbol, adapters.Overrides{})
	base := parsed.Base
	if declared := strings.TrimSpace(instrument.BaseAsset); declared != "" && core.CanonicalBase(declared) != parsed.Base {
		base = declared
	}
	resolved := adapters.MarketRefFor(VenueID, instrument.Symbol, adapters.Overrides{Base: &base})

	class := AssetClassFor(instrument.Category, resolved.Base)
	quote := QuoteAsset
	return adapters.MarketRefFor(VenueID, instrument.Symbol, adapters.Overrides{
		Base:       &base,
		Quote:      &quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseSnapshots normalises one cycle's /instruments, /tickers and /statistics responses.
//
// Driven by the TICKERS, in their own order: an instrument with no ticker has no reading, and a ticker
// whose instrument is not a "perpetual" is not one of this venue's markets.
func ParseSnapshots(instruments []Instrument, tickers []Ticker, statistics []Statistic, now int64) []core.FundingSnapshot {
	byID := make(map[int64]Instrument, len(instruments))
	for _, instrument := range instruments {
		byID[instrument.InstrumentID] = instrument
	}
	// A missing key gives the zero Num, whose Ptr() is nil -- the same null the TypeScript `?? null`
	// produces, and distinct from a venue reporting zero volume.
	volumes := make(map[int64]adapters.Num, len(statistics))
	for _, statistic := range statistics {
		volumes[statistic.InstrumentID] = statistic.Volume
	}

	snapshots := make([]core.FundingSnapshot, 0, len(tickers))
	for _, ticker := range tickers {
		instrument, listed := byID[ticker.InstrumentID]
		rate := ticker.FundingRate
		if !listed || instrument.InstrumentType != "perpetual" || !rate.OK {
			continue
		}

		markPrice := ticker.MarkPrice.Ptr()
		volume := volumes[ticker.InstrumentID]
		basisHours := FundingBasisHours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref(instrument),
			ObservedAt:    now,
			Rate:          rate.Val,
			BasisHours:    basisHours,
			IntervalHours: IntervalHours(instrument.FundingInterval),
			// Zero means "no next settlement" rather than the epoch, which PositiveMs is exactly the
			// `next !== null && next > 0` guard for.
			NextFundingAt: ticker.NextFunding.PositiveMs(),
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    ticker.IndexPrice.Ptr(),
			// Contracts of one base unit each, valued at mark.
			OpenInterestUSD: adapters.Mul(ticker.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    volume.Ptr(),
			MaxLeverage:     instrument.MaxLeverage.Ptr(),
		})
	}
	return snapshots
}

// ParseFundingHistory returns hourly settlements within [fromMs, toMs], oldest first. Timestamps keep
// their ~100ms run jitter.
func ParseFundingHistory(rows []FundingRow, instrument Instrument, fromMs, toMs int64) []core.FundingEvent {
	base := ref(instrument)

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read winning,
	// exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		if !row.Timestamp.OK || !row.FundingRate.OK {
			continue
		}
		settledAt := int64(row.Timestamp.Val)
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  settledAt,
			Rate:       row.FundingRate.Val,
			BasisHours: FundingBasisHours,
			MarkPrice:  nil,
		}
	}

	// A Go map has no iteration order, so the settlements are sorted explicitly rather than relying on
	// the insertion order a JS Map hands back before its own sort.
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

// oldestTimestamp is the earliest readable settlement in a funding page, and whether the page gave a
// finite one at all.
//
// An empty page, or one holding a timestamp the parser cannot read, is not readable -- which is what
// the TypeScript side gets from Math.min() over an empty or NaN-bearing list and then rejects with
// Number.isFinite. It stops the walk rather than stepping to an invented end_timestamp.
func oldestTimestamp(rows []FundingRow) (int64, bool) {
	oldest := int64(0)
	found := false
	for _, row := range rows {
		if !row.Timestamp.OK {
			return 0, false
		}
		at := int64(row.Timestamp.Val)
		if !found || at < oldest {
			oldest, found = at, true
		}
	}
	return oldest, found
}
