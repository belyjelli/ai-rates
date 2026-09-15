// Package adapters holds what every venue adapter shares: the number decoder, the small nullable
// helpers, and the market-reference builder.
//
// This is a port of packages/adapters/src/parse.ts, and the one place it deliberately diverges is
// the number type. The TypeScript side models venue numerics as `string` fields and converts with
// `num()`, which allocates a JS string for every field of every market on every cycle — the shape
// that, with `response.text()` + `JSON.parse` holding each bulk body twice, put the Bun collector at
// 537 MB against a 512 MB cap at 56 venues. Num decodes straight from the JSON token to a float64,
// so no intermediate string survives the decode.
package adapters

import (
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const msPerHour = 3_600_000.0

// Num is a venue number that may arrive as a JSON number, a quoted string, null, or an empty
// string, and may be absent entirely. It mirrors `num()` exactly: missing, empty and non-finite all
// read as absent rather than as zero.
//
// That distinction is not pedantry. Zero is a legitimate reading — 85 markets settle exactly zero
// funding across a whole month — so decoding an absent field to 0 would turn "this venue does not
// publish open interest" into "this market has no open interest", which is how Aster's entire book
// once vanished behind the default OI filter.
type Num struct {
	Val float64
	OK  bool
}

// UnmarshalJSON accepts 0.001, "0.001", "", and null. An unparseable or non-finite value is absent,
// never an error: one malformed field must not fail a whole venue's cycle, which is the same
// tolerance `num()` has.
func (n *Num) UnmarshalJSON(data []byte) error {
	s := string(data)
	if s == "null" {
		*n = Num{}
		return nil
	}
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		s = s[1 : len(s)-1]
	}
	if s == "" {
		*n = Num{}
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil || math.IsInf(v, 0) || math.IsNaN(v) {
		*n = Num{}
		return nil
	}
	*n = Num{Val: v, OK: true}
	return nil
}

// Ptr converts to the nullable float the domain types carry.
func (n Num) Ptr() *float64 {
	if !n.OK {
		return nil
	}
	v := n.Val
	return &v
}

// PositiveMs reads a millisecond timestamp, treating zero and negative as absent. Venues use 0 for
// "no next funding" rather than omitting the field.
func (n Num) PositiveMs() *int64 {
	if !n.OK || n.Val <= 0 {
		return nil
	}
	ms := int64(n.Val)
	return &ms
}

// Mul is the product of nullable factors, absent if any factor is absent. Used where a depth or a
// notional is size x price and either side may be unpublished — reporting the known half would be
// worse than reporting nothing, because a size column exists precisely to say how thin a quote is.
//
// Takes *float64 rather than Num so it composes with values that are already nullable floats:
// Hyperliquid multiplies open interest (a Num) by a mark price that has already been decoded.
// Call it as Mul(a.Ptr(), b.Ptr()) where both sides are still Num.
func Mul(factors ...*float64) *float64 {
	product := 1.0
	for _, f := range factors {
		if f == nil {
			return nil
		}
		product *= *f
	}
	return &product
}

// SelectRefreshBatch picks which symbols to refresh this cycle when a venue exposes something only
// per symbol: never-fetched symbols first in the given order, then entries older than maxAgeMs,
// oldest first, capped at budget.
//
// This is what spreads an expensive sweep across cycles instead of stalling one on hundreds of
// calls. Binance-style APIs expose open interest one symbol at a time, so a full sweep of ~570
// perps cannot fit in a 60-second cycle; at a budget of 120 every symbol is re-read about every
// five minutes, which open interest changes far more slowly than.
//
// Takes a LOOKUP rather than a map, because the caller's cache holds more than a timestamp — the
// binance-fapi family stores the contract count beside it, and that one cache has to serve both the
// rotation and the pricing. TypeScript gets this from structural typing over `{fetchedAt}`; in Go a
// function is the equivalent, and it avoids copying a map per cycle purely to change its value type.
func SelectRefreshBatch(
	symbols []string,
	fetchedAt func(string) (int64, bool),
	now int64,
	budget int,
	maxAgeMs int64,
) []string {
	if budget <= 0 {
		return nil
	}

	type staleSymbol struct {
		symbol string
		at     int64
	}
	missing := make([]string, 0, len(symbols))
	stale := make([]staleSymbol, 0, len(symbols))
	for _, symbol := range symbols {
		at, known := fetchedAt(symbol)
		switch {
		case !known:
			missing = append(missing, symbol)
		case now-at >= maxAgeMs:
			stale = append(stale, staleSymbol{symbol, at})
		}
	}

	// Oldest first among the stale, so the sweep converges rather than revisiting the same few.
	// Stable, so symbols fetched in the same millisecond keep the venue's own ordering.
	sort.SliceStable(stale, func(i, j int) bool { return stale[i].at < stale[j].at })

	selected := missing
	for _, s := range stale {
		selected = append(selected, s.symbol)
	}
	if len(selected) > budget {
		selected = selected[:budget]
	}
	return selected
}

// BasisHoursFromGaps gives each settlement a basis from the gap to its NEAREST neighbour, snapped
// to standard intervals.
//
// Using the smaller of the two adjacent gaps is what stops one missed settlement doubling its
// neighbour's basis: in a run of 8-hourly payments with one absent, the survivor either side would
// otherwise read as 16h and overstate what it paid.  A lone settlement has no gap to measure and
// falls back to fallbackHours, which is nil where the venue states no interval — better an event
// with no basis than one with an invented one.
//
// Lives here rather than in a venue package because three venues need it (binancefapi, htx and
// pionex) and it is generic: it reads timestamps, not anything Binance-specific.  It was originally
// written inside the binance-fapi family because that is where the TypeScript keeps it — aster.ts
// is that family's base and htx.ts imports from it — but carrying that layout into Go meant two
// unrelated venues importing a venue package, which two separate reviews flagged.
func BasisHoursFromGaps(times []int64, fallbackHours *float64) []*float64 {
	out := make([]*float64, len(times))
	for i, t := range times {
		var gaps []int64
		if i > 0 {
			if gap := t - times[i-1]; gap > 0 {
				gaps = append(gaps, gap)
			}
		}
		if i < len(times)-1 {
			if gap := times[i+1] - t; gap > 0 {
				gaps = append(gaps, gap)
			}
		}
		if len(gaps) == 0 {
			out[i] = fallbackHours
			continue
		}
		smallest := gaps[0]
		for _, gap := range gaps[1:] {
			if gap < smallest {
				smallest = gap
			}
		}
		out[i] = core.InferIntervalHours([]int64{t, t + smallest})
	}
	return out
}

var plainTicker = regexp.MustCompile(`^[A-Z0-9]{1,15}$`)
var parenthesisedTicker = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9 .&-]*\(([A-Z0-9]{1,15})\)$`)

// ResolveDeclaredBase is the base a venue declares for a contract, or "" to fall back to parsing
// the symbol.
//
// MEXC states both: baseCoin is the contract code (MUSTOCK) and baseCoinName the underlying (MU).
// Reading the declaration beats any suffix rule — 356 of its contracts rename, landing on pools six
// to nine venues deep at a price ratio of 1.0 — and it cannot be replaced by stripping "STOCK",
// because MEXC deliberately withholds the rename on exactly the 13 contracts whose stripped name
// would collide with a crypto ticker: CATSTOCK, STXSTOCK, RTXSTOCK, BBSTOCK, PURRSTOCK and friends,
// which differ by 387,440,758x, 2,963x, 139x and 955x respectively. The venue is protecting us
// there, and a regex would override it.
//
// baseCoinName is a DISPLAY name, so it is a candidate rather than an answer. Of 383 that differ,
// 356 are clean tickers and 27 are prose: GOLD(XAU), OIL(WTI), SILVER(XAG), COPPER(XCU), plus CJK
// names. The parenthetical holds the canonical ticker we already use, so it is preferred; anything
// else that is not a plain ticker falls back to baseCoin.
func ResolveDeclaredBase(baseCoin, baseCoinName string) string {
	code := strings.TrimSpace(baseCoin)
	declared := strings.TrimSpace(baseCoinName)
	if declared == "" || declared == code {
		return code
	}
	if m := parenthesisedTicker.FindStringSubmatch(declared); m != nil {
		return m[1]
	}
	if plainTicker.MatchString(declared) {
		return declared
	}
	return code
}

// dollarQuotes are settlement assets worth a US dollar, so a market quoted in one belongs in its
// base's USD pool. This is aster.ts's DOLLAR_QUOTES, the one set every venue below screens on.
var dollarQuotes = map[string]struct{}{
	"USDT": {}, "USDC": {}, "USD1": {}, "U": {}, "USDE": {}, "FDUSD": {}, "BUSD": {}, "USD": {},
}

// DeclaredMarketBase is the base to override the parsed one with, or "" where the parser already
// agrees with the venue. It is the port of aster.ts's `declaredMarketBase`.
//
// NOT ResolveDeclaredBase, directly above, despite the names. That one picks BETWEEN two things the
// venue states (MEXC's baseCoin and baseCoinName) and always answers with a base. This one asks
// whether the venue's declaration DISAGREES with what the symbol parses to, and answers "" — keep
// what you parsed — whenever it does not.
//
// Why it exists, measured on 2026-09-14: the parser splits a symbol by the quotes it knows and by
// hyphens, and 20 of the binance-family venues' 1,336 TRADING perpetuals defeated it. A quote it
// does not know left the whole symbol as the base — BTCUSD1, CLUSD1, XAUUSD1, MUUSD1, BTCU — so a
// USD1-margined BTC perpetual sat in a pool of its own and never paired with BTC. A hyphen inside
// the base cut B-MONEYUSDT down to B, filing a 0.0043 token in the pool of the 0.217 one, a 51x
// mismatch the gate had to keep excluding.
//
// Only for dollar quotes. ETHBTC also defeats the parser, but it prices ETH in bitcoin, so joining
// the ETH pool would swap a lonely market for a permanent mark mismatch.
//
// Callers pass already-extracted strings because each venue carries the declaration on a different
// field and normalises it differently (CoinW upper-cases both sides; Hotcoin's arrives behind a
// pointer). Keeping that plumbing at the call site is what lets one rule serve all of them.
//
// The declaration is trimmed. binancefapi's copy did not trim before this was shared; no venue in
// the fixtures pads the field, so the merge is a widening rather than a change of answer.
func DeclaredMarketBase(venueSymbol, declared, quote string) string {
	declared = strings.TrimSpace(declared)
	if declared == "" {
		return ""
	}
	if _, isDollar := dollarQuotes[quote]; !isDollar {
		return ""
	}
	parsed := core.ParseVenueSymbol(venueSymbol)
	// A contract-size prefix (1000PEPE) is the parser's to read, and it reads it: not a
	// disagreement.
	if parsed.Multiplier != 1 || parsed.Base == core.CanonicalBase(declared) {
		return ""
	}
	return declared
}

// HoursBetween is whole-ish hours between two epoch-ms instants, or nil if the span is not
// positive.
func HoursBetween(fromMs, toMs *int64) *float64 {
	if fromMs == nil || toMs == nil || *toMs <= *fromMs {
		return nil
	}
	hours := math.Round(float64(*toMs-*fromMs)/msPerHour*1e6) / 1e6
	return &hours
}

// Overrides lets an adapter replace fields that its venue reports explicitly, rather than letting
// them be parsed off the symbol.
//
// Quote and Dex need an explicit Has flag because nil is a meaningful VALUE for them — "this market
// has no quote currency" — and so cannot also mean "I am not overriding this". The TypeScript side
// gets this free from undefined-versus-null; Go does not, and collapsing the two would silently
// restore a parsed quote onto a venue that declared it unknown.
type Overrides struct {
	Base       *string
	Quote      *string
	HasQuote   bool
	Multiplier *float64
	AssetClass *core.AssetClass
	Dex        *string
	HasDex     bool
}

// MarketRefFor builds a MarketRef from a venue symbol, letting adapters override what the venue
// states outright.
//
// A declared base skips ParseVenueSymbol entirely, so it would also skip the alias map and re-split
// the pools that map exists to join — MEXC declares the S&P 500 as SP500, which has to reach US500
// the same way gate's SPX500 does. So an overridden base is still canonicalised. Only the base:
// Quote is a settlement currency, not an asset, and has no alias table.
//
// The class is refined here rather than in each adapter, so every venue settles equity-versus-index
// and tokenised gold by the same table. A venue's crypto declaration passes through untouched.
func MarketRefFor(venueID, venueSymbol string, o Overrides) core.MarketRef {
	parsed := core.ParseVenueSymbol(venueSymbol)

	ref := core.MarketRef{
		VenueID:     venueID,
		VenueSymbol: venueSymbol,
		Base:        parsed.Base,
		// Crypto unless the adapter passes what its venue declares. Never read off the symbol: CAT
		// is a memecoin on five venues and Caterpillar on gate, under the same correct ticker.
		AssetClass: core.ClassCrypto,
		Quote:      parsed.Quote,
		Multiplier: parsed.Multiplier,
		Dex:        parsed.Dex,
	}
	if o.HasQuote {
		ref.Quote = o.Quote
	}
	if o.Multiplier != nil {
		ref.Multiplier = *o.Multiplier
	}
	// On top of whatever the symbol or the venue said: a scale override exists precisely because
	// neither reports this market's contract size (see scale.go for the evidence behind each entry).
	if scale, ok := ScaleOverride(venueID, venueSymbol); ok {
		ref.Multiplier *= scale
	}
	if o.AssetClass != nil {
		ref.AssetClass = *o.AssetClass
	}
	if o.HasDex {
		ref.Dex = o.Dex
	}
	if o.Base != nil {
		ref.Base = core.CanonicalBase(*o.Base)
	}
	ref.AssetClass = core.RefineAssetClass(ref.AssetClass, ref.Base)
	return ref
}
