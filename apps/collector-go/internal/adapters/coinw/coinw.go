// Package coinw parses CoinW's USDT-margined perpetuals.
//
// Ported from packages/adapters/src/venues/coinw.ts. ONLY THE LAST SETTLED RATE IS PUBLISHED, and
// only per contract, so every snapshot is Kind settled and funding is refreshed on a rotating
// budget.
//
// Measured from this machine on 2026-09-13 22:28-22:40 UTC (docs: coinw.com/api-doc):
//
//   - SETTLED, NOT PREDICTED. /v1/perpum/fundingRate?instrument= is documented as "Get Last
//     Settlement Funding Fee Rate" and answers {ts, value} with ts the settlement: BTC 0.0000645 at
//     16:00 UTC and ETH -0.00004585 at 16:00, which are Binance's 16:00 settlements to the digit;
//     TRB (4h) 0.00000463 at 20:00, Binance's 20:00. Binance's estimate for 00:00 was 0.00006548 at
//     the same moment. No REST endpoint carries an estimate: /perpumPublic/fundingRate, /index,
//     /openInterest and /fundingRateHistory are 404, and /perpum/openInterest and
//     /perpum/fundingRateHistory answer 402 "param required" whatever the instrument (signed). The
//     estimate exists only on the websocket funding channel, which a polling collector doesn't hold.
//   - INTERVAL is declared per instrument in settledPeriod (239 at 8h, 174 at 4h) and a settled value
//     covers that period: BTC's 0.0000645 over 8h is Binance's own 8h rate. settledAt on the
//     instrument is the NEXT settlement (00:00 UTC on all 413).
//   - BUDGET. 8 requests a second per IP on this endpoint, and the collector abandons a cycle at 45s.
//     FundingRefreshBudget 120 calls at 150ms is 18s a cycle and 6.7 requests a second. A settled
//     rate is stale the moment the next settlement passes, so entries whose settlement period has
//     elapsed are refreshed first and hidden until they are; everything else is re-read every 10
//     minutes regardless. 411 contracts is four cycles from cold, or after every 00:00/08:00/16:00
//     boundary, and about 41 requests a cycle between boundaries. Restoring the stored interval would
//     show nothing sooner, since the rate itself is what's missing, so there is no WarmUp.
//   - PRICES AND UNITS. /perpumPublic/tickers is bulk. Its fair_price is documented as an "index
//     price reference", but sampled three times against Binance's premiumIndex over 354 shared
//     symbols it sat a median 2.5e-4 from Binance's mark and 1.0e-3 from its index, and BTCUSDT and
//     BTCUSDC share one value: a mark, which is how it is published. There is no index price.
//     total_volume is not a 24h figure (BTCUSDT 0.19, then 0.349 two minutes later), and nothing
//     public reports open interest, so both are nil.
//   - TRADABILITY. 413 instruments: 401 online USDT, 10 preOffline USDT (stocks such as LRCX and
//     SMCI, closing at closeTime; still settling, collected until then) and 2 USDC. The USDC pair has
//     no public funding: BTC_USDC, btc_usdc, BTCUSDC and BTC-USDC all answer 9001 "Contract not
//     found", and instrument=BTC&quote=usdc silently answers the USDT contract. So 411 are collected.
//     The ticker also lists 15 ...PROPWUSDT contracts with no instrument; the join is on contract id,
//     which keeps them out.
//   - CLASS. tradfiTag is "" on all 413, stocks and SP500 included, and partitionIds are unlabelled
//     numbers that don't track them (2033 is SHELL, MUBARAK, CAKE). CoinW declares nothing, so
//     everything is crypto.
//   - BASE. The venue symbol is the ticker's name (BTCUSDT). The declared base agrees with the parser
//     on all 411 except six contract-size prefixes (1000PEPE...), read as multipliers, and SP500,
//     which both sides canonicalise to US500.
//   - HISTORY. None public, so no FetchFundingHistory; each newly seen settlement is returned in
//     Settled instead.
package coinw

import (
	"fmt"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "coinw"

const hourMs = 3_600_000.0

const (
	// codeOK and codeContractNotFound are the two envelope codes this adapter reads. Anything else is
	// an error, so a venue-side failure is never mistaken for an empty book.
	codeOK               = 0
	codeContractNotFound = 9001
)

// Envelope is CoinW's response wrapper. Every endpoint here answers {code, data, msg}.
type Envelope[T any] struct {
	Code int    `json:"code"`
	Data T      `json:"data"`
	Msg  string `json:"msg"`
}

type Instrument struct {
	ID int64 `json:"id"`
	// Name is what the funding endpoint takes: BTC, 1000PEPE, BTC_USDC.
	Name   string `json:"name"`
	Base   string `json:"base"`
	Quote  string `json:"quote"`
	Status string `json:"status"`
	// SettledPeriod is the settlement interval, HOURS.
	SettledPeriod adapters.Num `json:"settledPeriod"`
	// SettledAt is the NEXT settlement, epoch ms. Carried for fidelity with the venue's shape; the
	// settlement a rate was paid at comes from the funding endpoint's own ts.
	SettledAt   adapters.Num `json:"settledAt"`
	MaxLeverage adapters.Num `json:"maxLeverage"`
	// TradfiTag is "" on every instrument today.
	TradfiTag string `json:"tradfiTag"`
	// CloseTime is present on preOffline instruments: when trading stops.
	CloseTime adapters.Num `json:"closeTime"`
}

type Ticker struct {
	ContractID int64 `json:"contract_id"`
	// Name is the venue symbol, BTCUSDT.
	Name string `json:"name"`
	// FairPrice is a MARK price; see the package header for the measurement.
	FairPrice adapters.Num `json:"fair_price"`
	LastPrice adapters.Num `json:"last_price"`
	QuoteCoin string       `json:"quote_coin"`
}

type FundingRate struct {
	// TS is the settlement this rate was paid at, epoch ms.
	TS    adapters.Num `json:"ts"`
	Value adapters.Num `json:"value"`
}

// FundingEntry is one contract's last-read settlement. Rate and SettledAt are pointers because a
// contract CoinW does not know, or one with nothing settled yet, is a real state that must not read
// as a zero rate settled at the epoch.
type FundingEntry struct {
	Rate      *float64
	SettledAt *int64
	FetchedAt int64
}

// ParsedFunding is one funding answer: the rate and the settlement it was paid at, either of which
// the venue may leave out.
type ParsedFunding struct {
	Rate      *float64
	SettledAt *int64
}

// IsCollectable says which contracts are collected: USDT-margined and either online or winding down
// before their closeTime. USDC contracts have no public funding endpoint (see the package header).
func IsCollectable(instrument Instrument, now int64) bool {
	if !strings.EqualFold(instrument.Quote, "usdt") {
		return false
	}
	if !instrument.SettledPeriod.OK || instrument.SettledPeriod.Val <= 0 {
		return false
	}
	if instrument.Status == "online" {
		return true
	}
	return instrument.Status == "preOffline" &&
		instrument.CloseTime.OK && int64(instrument.CloseTime.Val) > now
}

// AssetClassFor is the class CoinW declares. It declares none today, so everything is crypto; a tag
// would be tradfi of a kind we can't read, and the base tables would settle which kind.
func AssetClassFor(instrument Instrument, base string) core.AssetClass {
	if strings.TrimSpace(instrument.TradfiTag) != "" {
		return core.ClassifyNonCrypto(base)
	}
	return core.ClassCrypto
}

// declaredBase is the base to override the parsed one with, or nil where the parser already agrees
// with what CoinW declares.
//
// It returns nil throughout today's book: the declared base agrees with the parser on all 411
// collected contracts except the six contract-size prefixes (1000PEPE...), which are the parser's to
// read and which it reads, and SP500, which both sides canonicalise to US500. It is carried anyway
// because it is the venue's own declaration, and a contract whose symbol the parser cannot split
// would otherwise sit in a pool of its own.
//
// CoinW is the venue that upper-cases: it sends mixed case on both fields, and the shared rule
// compares against an upper-case quote set and a canonical base. That normalisation is this
// package's, which is why it happens here rather than inside the shared helper.
func declaredBase(instrument Instrument, venueSymbol string) *string {
	declared := adapters.DeclaredMarketBase(
		venueSymbol,
		strings.ToUpper(instrument.Base),
		strings.ToUpper(instrument.Quote),
	)
	if declared == "" {
		return nil
	}
	return &declared
}

// RefFor builds the market reference for one contract, under the ticker's own symbol.
func RefFor(instrument Instrument, venueSymbol string) core.MarketRef {
	quote := strings.ToUpper(instrument.Quote)
	overrides := adapters.Overrides{
		Quote:    &quote,
		HasQuote: true,
		Base:     declaredBase(instrument, venueSymbol),
	}
	// The class needs the canonical base, which only the first pass can give: SP500 reaches US500
	// through the alias map, and the class tables are keyed on the canonical spelling.
	class := AssetClassFor(instrument, adapters.MarketRefFor(VenueID, venueSymbol, overrides).Base)
	overrides.AssetClass = &class
	return adapters.MarketRefFor(VenueID, venueSymbol, overrides)
}

// IsEntryOverdue is true once the settlement after entry should have happened, so its rate is no
// longer the latest.
func IsEntryOverdue(entry FundingEntry, periodHours float64, now int64) bool {
	return entry.SettledAt != nil && *entry.SettledAt+int64(periodHours*hourMs) <= now
}

// ParseFundingRate reads one funding answer; a nil result is a contract CoinW doesn't know. Any
// other non-zero code is an error.
func ParseFundingRate(env Envelope[*FundingRate]) (*ParsedFunding, error) {
	if env.Code == codeContractNotFound {
		return nil, nil
	}
	if env.Code != codeOK {
		return nil, fmt.Errorf("coinw funding rate: %d %s", env.Code, env.Msg)
	}
	parsed := ParsedFunding{}
	if env.Data != nil {
		parsed.Rate = env.Data.Value.Ptr()
		parsed.SettledAt = env.Data.TS.PositiveMs()
	}
	return &parsed, nil
}

// SnapshotInput is one cycle's decoded responses plus the funding cache, keyed by instrument Name.
type SnapshotInput struct {
	Instruments []Instrument
	Tickers     []Ticker
	Funding     map[string]FundingEntry
}

// ParseSnapshots returns collectable contracts whose latest settlement is known and still the
// latest, with a mark price.
//
// Output order is the venue's instrument order, so it does not reshuffle per run: the tickers are
// indexed by contract id for lookup only, never ranged over.
func ParseSnapshots(input SnapshotInput, now int64) []core.FundingSnapshot {
	tickers := make(map[int64]Ticker, len(input.Tickers))
	for _, ticker := range input.Tickers {
		tickers[ticker.ContractID] = ticker
	}

	snapshots := make([]core.FundingSnapshot, 0, len(input.Instruments))
	for _, instrument := range input.Instruments {
		if !IsCollectable(instrument, now) {
			continue
		}
		// Guaranteed present and positive by IsCollectable.
		hours := instrument.SettledPeriod.Val

		entry, hasEntry := input.Funding[instrument.Name]
		ticker, hasTicker := tickers[instrument.ID]
		if !hasEntry || !hasTicker {
			continue
		}
		markPrice := ticker.FairPrice.Ptr()
		if entry.Rate == nil || entry.SettledAt == nil ||
			IsEntryOverdue(entry, hours, now) || markPrice == nil {
			continue
		}

		interval := hours
		nextFundingAt := *entry.SettledAt + int64(hours*hourMs)
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     RefFor(instrument, ticker.Name),
			ObservedAt:    now,
			Rate:          *entry.Rate,
			BasisHours:    hours,
			IntervalHours: &interval,
			NextFundingAt: &nextFundingAt,
			Kind:          core.KindSettled,
			MarkPrice:     markPrice,
			// No index price, no open interest, and total_volume is not a 24h figure; see the header.
			IndexPrice:      nil,
			OpenInterestUSD: nil,
			Volume24hUSD:    nil,
			MaxLeverage:     instrument.MaxLeverage.Ptr(),
		})
	}
	return snapshots
}
