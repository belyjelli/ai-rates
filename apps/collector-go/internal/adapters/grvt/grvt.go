// Package grvt parses GRVT (Gravity Markets), a DEX whose market data API is POST-only.
//
// Ported from packages/adapters/src/venues/grvt.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/grvt) and the same expected values as grvt.test.ts, so the Go and
// TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: GRVT's market data API answers per instrument only -- `POST /full/v1/ticker` takes one
// `instrument` and there is no all-tickers call -- so each cycle refreshes a rotating slice:
// `POST /full/v1/all_instruments` once an hour, plus TickerBudget tickers, the least recently
// fetched first. With 194 perps on 2026-09-13 that is 100 requests a cycle and every perp is
// re-read every 2 cycles (~2 minutes), inside the screener's 5-minute freshness window. Responses
// carry `x-ratelimit-limit: 1500` (the window is not documented and the docs site answers 403 to
// non-browsers); 100 a minute is far inside any reading of it. Tickers answered in ~130ms from here.
//
// WHY ONLY THIS CYCLE'S SLICE IS EMITTED: the collector appends every snapshot to
// `funding_snapshots` without a conflict key, so re-emitting a ticker read two minutes ago would
// write the same observation twice. An instrument shows up in the cycles that refresh it, which
// keeps it in `market_latest` because the sweep is shorter than the 5-minute window. There is no
// warm-up hook to implement: the rate itself is the per-instrument read, and a stored market stays
// visible for those five minutes after a restart while the first sweep runs.
//
// FUNDING -- units. `funding_rate` (equal to `funding_rate_8h_curr` on every ticker read) is in
// PERCENT: the SDK's schema says "The current funding rate of the instrument, expressed in
// percentage points" (https://github.com/gravity-technologies/grvt-pysdk, `grvt_raw_types.py`).
// Checked against Binance, whose BTC settlement at 2026-09-13 16:00 UTC was 0.0000645 per 8h:
// GRVT settled 0.0061 at the same instant, i.e. 0.000061 as a fraction. Read as a fraction it
// would be 100x every other venue (Hyperliquid 0.0000114/h, i.e. 0.000091 per 8h, that evening).
//
// FUNDING -- period. Despite the `8h` in the field name, the rate is per the instrument's own
// `funding_interval_hours` (8 on 125 perps, 4 on 69). The resting rate shows it: 8h perps that
// are not trading away from index sit at 0.01 (SOL, every settlement), and 4h perps sit at 0.005
// (ENA, HYPE, every settlement) -- exactly the 0.01%-per-8h interest floor paid over four hours.
// An 8h-normalised field would read 0.01 on both. So BasisHours = `funding_interval_hours`, and
// 0.005 per 4h is 0.0000125/h, Hyperliquid's own resting rate.
//
// FUNDING -- kind. The ticker rate is the running estimate for `next_funding_time`: at 22:29 UTC
// BTC read 0.0031 while its last settlement (16:00) was 0.0061, so it is predicted.
//
// UNITS: `open_interest` is "expressed in base asset decimal units" (BTC 2,523 x 76,747 = $194M);
// `buy_volume_24h_q` and `sell_volume_24h_q` are the 24h TAKER buy and sell volume in quote, so
// their sum is total volume (BTC $98.6M, which matches 637 + 643 BTC base volume at ~77k). Book
// sizes are base units. Timestamps are unix NANOSECONDS, converted exactly with math/big.
//
// TRADABILITY: `all_instruments` with `is_active: true`, `kind` PERPETUAL. On 2026-09-13 that was
// 194 instruments, all perpetual and all quoted in USDT; the request without the flag returned the
// same 194.
//
// CLASS: every instrument declares `asset_class: "UNSPECIFIED"` -- AAPL, XAU and NATGAS included --
// so all are crypto, as the rule for a venue that declares nothing requires. Should GRVT fill the
// field, a crypto value stays crypto and any other value goes to core.ClassifyNonCrypto.
//
// QUOTE: the instrument's `quote` (USDT). BASE: the parser agrees with the declared `base` on all
// 194 symbols (`BTC_USDT_Perp`). One disagreement with other venues remains: GRVT spells its
// thousand-unit contracts with a capital K, which the parser does not read as a multiplier. Measured
// 2026-09-13, KPEPE marked 0.003348 against Binance 1000PEPE 0.003349, KBONK 0.002696 against
// 0.002694 and KSHIB 0.005130 against 0.005131. They stay under the declared bases KPEPE, KBONK and
// KSHIB (multiplier 1, so they pool with nothing rather than with PEPE at a 1000x price); reading
// `K` as a multiplier is the parser's decision, not this adapter's.
//
// DEX: GRVT is an exchange of its own rather than a market hosted on someone else's, so nothing
// here overrides `dex` -- the symbol carries no dex prefix and the field stays absent, which is
// what the TypeScript adapter's untouched `dex` reaches the database as.
package grvt

import (
	"errors"
	"math/big"
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "grvt"

// nsPerMs is the divisor for GRVT's nanosecond stamps. A big.Int rather than an int64 constant
// because the division itself is done in arbitrary precision; see nsToMs.
var nsPerMs = big.NewInt(1_000_000)

// ErrUnexpectedInstruments and ErrUnexpectedFunding mirror the TypeScript adapter's throws when
// `result` is missing or is not an array. A response that lost its payload has to fail the venue's
// cycle rather than read as a venue with nothing listed and no funding ever settled.
var (
	ErrUnexpectedInstruments = errors.New("grvt: unexpected all_instruments response")
	ErrUnexpectedFunding     = errors.New("grvt: unexpected funding response")
)

// Instrument is one row of `all_instruments`.
type Instrument struct {
	Instrument string `json:"instrument"`
	Base       string `json:"base"`
	Quote      string `json:"quote"`
	Kind       string `json:"kind"`
	// FundingIntervalHours is the instrument's OWN settlement period (8 on 125 perps, 4 on 69), and
	// the period its rate is quoted over. A Num rather than a float64 so an absent field is absent
	// rather than an interval of zero: the two differ in ParseFunding, where a row without its own
	// interval falls back to this one.
	FundingIntervalHours adapters.Num `json:"funding_interval_hours"`
	AssetClass           string       `json:"asset_class"`
}

// Ticker is one `ticker` response's `result`.
type Ticker struct {
	EventTime     string       `json:"event_time"`
	Instrument    string       `json:"instrument"`
	MarkPrice     adapters.Num `json:"mark_price"`
	IndexPrice    adapters.Num `json:"index_price"`
	BestBidPrice  adapters.Num `json:"best_bid_price"`
	BestBidSize   adapters.Num `json:"best_bid_size"`
	BestAskPrice  adapters.Num `json:"best_ask_price"`
	BestAskSize   adapters.Num `json:"best_ask_size"`
	BuyVolume24hQ adapters.Num `json:"buy_volume_24h_q"`
	// SellVolume24hQ, with BuyVolume24hQ, is TAKER volume in quote: their sum is the 24h total.
	SellVolume24hQ adapters.Num `json:"sell_volume_24h_q"`
	// OpenInterest is in BASE units, so it is priced at the mark.
	OpenInterest adapters.Num `json:"open_interest"`
	// NextFundingTime is epoch NANOSECONDS as a string.
	NextFundingTime string `json:"next_funding_time"`

	// FundingRate is PERCENT, over FundingIntervalHours. Both rate fields are POINTERS so that an
	// absent or null `funding_rate` falls through to `funding_rate_8h_curr` while a present but
	// EMPTY one does not -- which is exactly what `funding_rate ?? funding_rate_8h_curr` does, and
	// what a plain Num could not express, since "" and absent both decode as not-OK.
	FundingRate *adapters.Num `json:"funding_rate"`
	// FundingRate8hCurr equals FundingRate on every ticker read seen; it is the fallback, not an
	// 8h-normalised figure. See the package comment.
	FundingRate8hCurr *adapters.Num `json:"funding_rate_8h_curr"`
}

// FundingPercent is the rate the ticker reports, preferring `funding_rate` and falling back to
// `funding_rate_8h_curr` only when the first is absent or null.
func (t *Ticker) FundingPercent() adapters.Num {
	if t.FundingRate != nil {
		return *t.FundingRate
	}
	if t.FundingRate8hCurr != nil {
		return *t.FundingRate8hCurr
	}
	return adapters.Num{}
}

// FundingRow is one settled payment from `funding`.
type FundingRow struct {
	Instrument string `json:"instrument"`
	// FundingRate is PERCENT.
	FundingRate adapters.Num `json:"funding_rate"`
	// FundingTime is epoch NANOSECONDS as a string.
	FundingTime string       `json:"funding_time"`
	MarkPrice   adapters.Num `json:"mark_price"`
	// FundingIntervalHours is the period THIS settlement covered, which wins over the instrument's
	// current one. A Num so that an absent field falls back rather than reading as zero hours.
	FundingIntervalHours adapters.Num `json:"funding_interval_hours"`
}

// nsToMs is a nanosecond epoch string in milliseconds, exactly; nil if it isn't a positive integer.
//
// math/big rather than a float64 divide, which is what BigInt is doing on the TypeScript side:
// 1789344000000000000 is past 2^53, so converting to a float first would round the instant before
// the division ever happened. Everything stored is epoch MILLISECONDS as an int64.
func nsToMs(ns string) *int64 {
	if ns == "" || !digitsOnly(ns) || zerosOnly(ns) {
		return nil
	}
	value, ok := new(big.Int).SetString(ns, 10)
	if !ok {
		return nil
	}
	value.Div(value, nsPerMs)
	// Unreachable for any real stamp (an int64 of milliseconds runs to the year 292,278,994); kept
	// so an absurd value is absent rather than silently truncated.
	if !value.IsInt64() {
		return nil
	}
	ms := value.Int64()
	return &ms
}

// digitsOnly and zerosOnly stand in for the TypeScript /^\d+$/ and /^0+$/ guards.
func digitsOnly(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

func zerosOnly(s string) bool {
	return strings.Trim(s, "0") == ""
}

// Rate is GRVT's percentage-point rate as a fraction. See the package comment: read as a fraction
// it would be 100x every other venue.
func Rate(percent adapters.Num) *float64 {
	if !percent.OK {
		return nil
	}
	fraction := percent.Val / 100
	return &fraction
}

// AssetClassFor is the class GRVT declares for an instrument.
//
// Every instrument reads "UNSPECIFIED" today -- AAPL, XAU and NATGAS included -- so everything is
// crypto, which is the rule for a venue that declares nothing. Should GRVT start filling the field,
// a crypto value stays crypto, the named classes map straight across, and anything else is a real
// not-crypto signal that the base tables settle.
func AssetClassFor(declared, base string) core.AssetClass {
	switch strings.ToUpper(strings.TrimSpace(declared)) {
	case "", "UNSPECIFIED", "CRYPTO":
		return core.ClassCrypto
	case "EQUITY", "STOCK":
		return core.ClassEquity
	case "COMMODITY":
		return core.ClassCommodity
	case "FX", "FOREX":
		return core.ClassFX
	case "INDEX":
		return core.ClassIndex
	default:
		return core.ClassifyNonCrypto(base)
	}
}

// Perps is the tradable instrument set: keyed by name, and KEEPING the venue's own order.
//
// The order is load-bearing, which is why this is not a bare map. The rotation feeds Names to
// SelectRefreshBatch, so a Go map's per-run iteration order would reshuffle the sweep every cycle
// and never converge on "least recently fetched first". The TypeScript Map preserves insertion
// order for free.
type Perps struct {
	Names  []string
	ByName map[string]Instrument
}

func (p Perps) Get(name string) (Instrument, bool) {
	instrument, listed := p.ByName[name]
	return instrument, listed
}

func (p Perps) Len() int { return len(p.Names) }

// TradablePerps is the active perpetuals that publish a funding interval, in the venue's order.
func TradablePerps(instruments []Instrument) Perps {
	perps := Perps{
		Names:  make([]string, 0, len(instruments)),
		ByName: make(map[string]Instrument, len(instruments)),
	}
	for _, instrument := range instruments {
		if instrument.Kind != "PERPETUAL" {
			continue
		}
		if !instrument.FundingIntervalHours.OK || instrument.FundingIntervalHours.Val <= 0 {
			continue
		}
		if _, seen := perps.ByName[instrument.Instrument]; !seen {
			perps.Names = append(perps.Names, instrument.Instrument)
		}
		perps.ByName[instrument.Instrument] = instrument
	}
	return perps
}

// refFor names one instrument, taking the quote GRVT declares and the class it declares.
//
// The declared quote is passed with HasQuote set even when it is empty: a venue that names no
// settlement currency has an unknown quote, not a quote read back off the symbol. That is what the
// TypeScript object spread does with `quote: undefined`.
func refFor(instrument Instrument) core.MarketRef {
	parsed := adapters.MarketRefFor(VenueID, instrument.Instrument, adapters.Overrides{})
	class := AssetClassFor(instrument.AssetClass, parsed.Base)

	var quote *string
	if instrument.Quote != "" {
		declared := instrument.Quote
		quote = &declared
	}
	return adapters.MarketRefFor(VenueID, instrument.Instrument, adapters.Overrides{
		Quote:      quote,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseTicker normalises one instrument's ticker read, or returns nil when there is nothing to
// report: no rate, no mark, no interval, or a response for a different instrument.
func ParseTicker(instrument Instrument, ticker *Ticker, now int64) *core.FundingSnapshot {
	hours := instrument.FundingIntervalHours
	if ticker == nil || ticker.Instrument != instrument.Instrument {
		return nil
	}
	rate := Rate(ticker.FundingPercent())
	markPrice := ticker.MarkPrice.Ptr()
	if rate == nil {
		return nil
	}
	if !hours.OK || hours.Val <= 0 || markPrice == nil {
		return nil
	}

	buy := ticker.BuyVolume24hQ
	sell := ticker.SellVolume24hQ
	var volume24hUSD *float64
	if buy.OK || sell.OK {
		total := 0.0
		if buy.OK {
			total += buy.Val
		}
		if sell.OK {
			total += sell.Val
		}
		volume24hUSD = &total
	}

	bestBid := ticker.BestBidPrice.Ptr()
	bestAsk := ticker.BestAskPrice.Ptr()
	interval := hours.Val
	return &core.FundingSnapshot{
		MarketRef:     refFor(instrument),
		ObservedAt:    now,
		Rate:          *rate,
		BasisHours:    hours.Val,
		IntervalHours: &interval,
		NextFundingAt: nsToMs(ticker.NextFundingTime),
		Kind:          core.KindPredicted,
		MarkPrice:     markPrice,
		IndexPrice:    ticker.IndexPrice.Ptr(),
		BestBid:       bestBid,
		// Book sizes are BASE units, so the depth is size x price with no contract conversion.
		BestBidSizeUSD: adapters.Mul(ticker.BestBidSize.Ptr(), bestBid),
		BestAsk:        bestAsk,
		BestAskSizeUSD: adapters.Mul(ticker.BestAskSize.Ptr(), bestAsk),
		// Open interest is base units too, priced at the mark.
		OpenInterestUSD: adapters.Mul(ticker.OpenInterest.Ptr(), markPrice),
		Volume24hUSD:    volume24hUSD,
	}
}

// ParseFunding returns settlements within [fromMs, toMs], oldest first, each over its own interval.
func ParseFunding(rows []FundingRow, instrument Instrument, fromMs, toMs int64) []core.FundingEvent {
	base := refFor(instrument)

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		settledAt := nsToMs(row.FundingTime)
		rate := Rate(row.FundingRate)
		basisHours := row.FundingIntervalHours
		if !basisHours.OK {
			basisHours = instrument.FundingIntervalHours
		}
		if settledAt == nil || rate == nil || !basisHours.OK || basisHours.Val <= 0 {
			continue
		}
		if *settledAt < fromMs || *settledAt > toMs {
			continue
		}
		bySettlement[*settledAt] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  *settledAt,
			Rate:       *rate,
			BasisHours: basisHours.Val,
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
