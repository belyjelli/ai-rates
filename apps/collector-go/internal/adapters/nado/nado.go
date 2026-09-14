// Package nado parses Nado's perpetuals (the Vertex successor on Ink).
//
// Ported from packages/adapters/src/venues/nado.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/nado) and the same expected values as nado.test.ts, so the Go and
// TypeScript parsers cannot drift apart while both are collecting.
//
// REQUESTS: one per cycle, `GET archive /v2/contracts?edge=false` (every perp with funding, mark,
// index, OI and volume inline), plus `GET gateway /v1/query?type=symbols` once an hour for each
// market's `trading_status`. Queries draw on a per-IP budget of 2,400 weight a minute or 400 every
// 10s (https://docs.nado.xyz/developer-resources/api/rate-limits); symbols weighs 2, funding history
// 2 + limit/100. 100ms spacing cannot approach it. `edge=false` keeps volume and OI to this chain
// ("when turned off, it only returns metrics for the current chain"); on 2026-09-13 both settings
// returned identical BTC figures.
//
// ACCEPT-ENCODING: the gateway answers 403 `{"reason": "Invalid compression headers:
// 'Accept-Encoding' must include 'gzip', 'br' or 'deflate'"}` without it (curl, 2026-09-13); the
// archive did not care. The TypeScript adapter therefore sends `accept-encoding: gzip` explicitly,
// because Bun's fetch otherwise leaves the header off. Go needs no such constant and this port
// carries none: net/http's transport adds `Accept-Encoding: gzip` to every request that does not set
// one itself and transparently decompresses the reply, which is the behaviour the TypeScript header
// was there to restore. httpclient.Client exposes no per-call headers, so an explicit copy could not
// be sent anyway without changing a shared file.
//
// FUNDING: the contracts `funding_rate` is a 24-HOUR rate, and positive means longs pay. The field
// doc (https://docs.nado.xyz/developer-resources/api/v2/contracts) says "Current 24hr funding rate.
// Can compute hourly funding rate dividing by 24"; the funding doc
// (https://docs.nado.xyz/core/funding-rates) computes an 8-hour F, settles F/8 every hour on the
// hour, and reports "the equivalent 24-hour rate -- three times the 8-hour rate (3F)"; non-crypto
// markets settle 1/24 of the same reported daily figure. So the published number is kept over
// BasisHours 24 and IntervalHours is 1. It is `predicted`: the archive's `funding_rate` query calls
// it "the latest predicted 24hr rate", and BTC moved from 0.000110094 at 22:28 to 0.000103965 at
// 22:33 inside one hour. Checked live on 2026-09-13:
//   - quiet markets pin to the formula floor, NEAR and kPEPE 0.0003 = 3 x 0.0001, i.e. 0.0000125/h,
//     Hyperliquid's own floor;
//   - BTC 0.000110/24 = 0.0000046/h (4.0% APR) against Hyperliquid 0.0000116/h (10.1%), ETH
//     0.000145/24 = 0.0000060/h against 0.0000125; read as hourly it would be 96% APR for BTC;
//   - realized hourly settlements from `funding_rate_history` were 0.0000069 (22:00) and 0.0000033
//     (21:00) for BTC, the same order as the predicted figure divided by 24;
//   - predicted against realized across the 23:00 settlement: the last reading at 22:59:33, divided
//     by 24, was BTC 0.00000490 against a realized 0.00000495, WTI -0.000135175 against -0.000134580
//     and ETH 0.00000212 against 0.00000193. At 23:00:30 the predicted figure had restarted for the
//     next hour (BTC -0.000235 per day), so early-hour readings are the noisiest.
//
// UNITS, checked live: `open_interest_usd` is USD and equals `open_interest` (base) x mark
// (BTC 215.3981 x 76,805.68 = $16.54M against 16,540,431). `quote_volume` is 24h volume in the quote
// asset USDT0 (BTC $88.9M = 1,153.8 BTC x ~$77k). `next_funding_rate_timestamp` is unix SECONDS.
//
// TRADABILITY: contracts lists every perp, halted or not (82 on 2026-09-13). The gateway's
// `trading_status` decides: 71 `live` are collected; 5 `post_only` (ANSEM, ARB, CASHCAT, PONS,
// USELESS), 5 `not_tradable` (ADA, AXS, BERA, SKR, VIRTUAL) and 1 `soft_reduce_only` (PENG) are not.
//
// CLASS: the API declares none (contracts, symbols, all_products and v2 assets carry no category),
// but Nado's documentation declares one per market, in the "Feed Reference" table of its oracle page
// (https://docs.nado.xyz/llms-full.txt, "Type: Crypto, FX, Metals, Energy, US Equity, HK Equity,
// xStock"). That declaration is copied into DocumentedClasses as it stood on 2026-09-13. A market
// the table does not list declares nothing and is crypto, like every other venue's undeclared
// listing, so a newly listed equity reads crypto until the table is refreshed. Of the 71 live
// markets on 2026-09-13: crypto 40, equity 26 (25 US Equity with SPY and QQQ among them, plus HK
// Equity ZHIPU), fx 3 (EURUSD, GBPUSD, USDJPY), commodity 2 (XAG Metals, WTI Energy). `premium_x18`
// is NOT a class signal: it is absent on 34 markets, including crypto WLD, MEGA, SKR and CHIP, and
// present on HK equity ZHIPU.
//
// QUOTE: USDT0, the `quote_currency` of every contract and the collateral funding is paid in
// ("impacting a user's unsettled USDT0", https://docs.nado.xyz/core/funding-rates).
//
// BASE: the parser reads `BTC-PERP_USDT0` as BTC and agrees with `base_currency` minus `-PERP` on
// all 82, except that it reads `kPEPE` and `kBONK` as PEPE and BONK x1000, which is what they are
// ("Thousand Pepe Perp" in v2 assets). WTI reaches CL through core's alias, as it does for every
// venue.
package nado

import (
	"bytes"
	"encoding/json"
	"errors"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "nado"

const (
	// quote is USDT0 on every contract, and is passed as an override because the symbol parser does
	// not recognise it: "BTC-PERP_USDT0" splits to a second token of USDT0, which is not one of the
	// quotes core knows, so the parsed quote is nil.
	quote = "USDT0"
	// rateBasisHours: `funding_rate` is the predicted TWENTY-FOUR hour rate. Read as hourly, BTC
	// would annualise at 96% instead of 4%.
	rateBasisHours = 24.0
	// intervalHours: settlement is every hour on the hour, of 1/24 of the reported daily figure.
	intervalHours = 1.0
	// x18Scale is the fixed-point divisor on the history endpoint's `funding_rate_x18`.
	x18Scale = 1e18
)

// Contract is one row of the archive's /v2/contracts object.
type Contract struct {
	ProductID     int    `json:"product_id"`
	TickerID      string `json:"ticker_id"`
	BaseCurrency  string `json:"base_currency"`
	QuoteCurrency string `json:"quote_currency"`
	ProductType   string `json:"product_type"`

	MarkPrice  adapters.Num `json:"mark_price"`
	IndexPrice adapters.Num `json:"index_price"`
	// OpenInterest is BASE units; OpenInterestUSD is the same figure already priced.
	OpenInterest    adapters.Num `json:"open_interest"`
	OpenInterestUSD adapters.Num `json:"open_interest_usd"`
	// QuoteVolume is 24h volume in the quote asset (USDT0).
	QuoteVolume adapters.Num `json:"quote_volume"`
	// FundingRate is the PREDICTED 24-hour rate.
	FundingRate adapters.Num `json:"funding_rate"`
	// NextFundingRateTimestamp is unix SECONDS, not milliseconds.
	NextFundingRateTimestamp adapters.Num `json:"next_funding_rate_timestamp"`
}

// Contracts is the archive's /v2/contracts object flattened to a slice, in the order the response
// lists it.
//
// The archive keys contracts by ticker and the TypeScript side reads them with Object.values(),
// which is document order. A Go map would hand back a different order on every cycle for no gain --
// the key is never read, since every row repeats it as `ticker_id` -- so the decode keeps the
// document's order and drops the keys.
type Contracts []Contract

// Symbol is one entry of the gateway's `symbols` map. `trading_status` is the only thing that says
// whether a listed perp is actually tradable.
type Symbol struct {
	Type          string `json:"type"`
	ProductID     int    `json:"product_id"`
	Symbol        string `json:"symbol"`
	TradingStatus string `json:"trading_status"`
}

// SymbolsResponse is the gateway's /query?type=symbols body. Symbols is a pointer so an absent or
// null `symbols` is distinguishable from an empty one, which is what the TypeScript
// `typeof body.data?.symbols !== "object"` guard turns into a thrown error.
type SymbolsResponse struct {
	Status string `json:"status"`
	Data   struct {
		Symbols *map[string]Symbol `json:"symbols"`
	} `json:"data"`
}

// FundingHistoryRow is one realized hourly settlement. Both numerics arrive as quoted strings:
// `timestamp` in unix SECONDS and `funding_rate_x18` in 1e18 fixed point.
type FundingHistoryRow struct {
	ProductID      int          `json:"product_id"`
	Timestamp      adapters.Num `json:"timestamp"`
	FundingRateX18 adapters.Num `json:"funding_rate_x18"`
}

// FundingHistoryResponse is the archive's `funding_rate_history` reply. The slice is a pointer
// because a missing array is a broken response, not an empty page.
type FundingHistoryResponse struct {
	FundingRates *[]FundingHistoryRow `json:"funding_rates"`
}

// ErrUnexpectedContracts, ErrUnexpectedSymbols and ErrUnexpectedHistory mirror the TypeScript
// adapter's throws. A response that lost its payload has to fail the venue's cycle rather than read
// as a venue with nothing listed and no funding ever settled.
var (
	ErrUnexpectedContracts = errors.New("nado: unexpected contracts response")
	ErrUnexpectedSymbols   = errors.New("nado: unexpected symbols response")
	ErrUnexpectedHistory   = errors.New("nado: unexpected funding_rate_history")
)

// UnmarshalJSON walks the contracts object as tokens, keeping the document's order. A JSON array
// where an object belongs is the TypeScript `Array.isArray(body)` rejection.
func (c *Contracts) UnmarshalJSON(data []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	if delim, ok := token.(json.Delim); !ok || delim != '{' {
		return ErrUnexpectedContracts
	}

	contracts := make(Contracts, 0, 96)
	for decoder.More() {
		// The key is the ticker, which the row repeats as `ticker_id`; read past it.
		if _, err := decoder.Token(); err != nil {
			return err
		}
		var contract Contract
		if err := decoder.Decode(&contract); err != nil {
			return err
		}
		contracts = append(contracts, contract)
	}
	*c = contracts
	return nil
}

// DocumentedClasses is the per-market Type from Nado's oracle Feed Reference
// (https://docs.nado.xyz/llms-full.txt), 2026-09-13, keyed by `base_currency` (the perp symbol,
// "AAPL-PERP"). Only non-crypto rows are listed; the 50 Crypto perps (XAUT among them) need no
// entry.
var DocumentedClasses = map[string]core.AssetClass{
	// US Equity (26)
	"AAPL-PERP":  core.ClassEquity,
	"AMD-PERP":   core.ClassEquity,
	"AMZN-PERP":  core.ClassEquity,
	"AVGO-PERP":  core.ClassEquity,
	"BBX-PERP":   core.ClassEquity,
	"CRCL-PERP":  core.ClassEquity,
	"DELL-PERP":  core.ClassEquity,
	"GOOGL-PERP": core.ClassEquity,
	"HIMS-PERP":  core.ClassEquity,
	"INTC-PERP":  core.ClassEquity,
	"LLY-PERP":   core.ClassEquity,
	"META-PERP":  core.ClassEquity,
	"MRVL-PERP":  core.ClassEquity,
	"MSFT-PERP":  core.ClassEquity,
	"MSTR-PERP":  core.ClassEquity,
	"MU-PERP":    core.ClassEquity,
	"NBIS-PERP":  core.ClassEquity,
	"NVDA-PERP":  core.ClassEquity,
	"ORCL-PERP":  core.ClassEquity,
	"PENG-PERP":  core.ClassEquity,
	"QQQ-PERP":   core.ClassEquity,
	"SKHY-PERP":  core.ClassEquity,
	"SNDK-PERP":  core.ClassEquity,
	"SPCX-PERP":  core.ClassEquity,
	"SPY-PERP":   core.ClassEquity,
	"TSLA-PERP":  core.ClassEquity,
	// HK Equity (1)
	"ZHIPU-PERP": core.ClassEquity,
	// FX (3)
	"EURUSD-PERP": core.ClassFX,
	"GBPUSD-PERP": core.ClassFX,
	"USDJPY-PERP": core.ClassFX,
	// Metals (1) and Energy (1)
	"XAG-PERP": core.ClassCommodity,
	"WTI-PERP": core.ClassCommodity,
}

// AssetClassFor is the class Nado's docs declare for a perp symbol ("AAPL-PERP"); crypto when
// undeclared, like every other venue's undeclared listing.
func AssetClassFor(symbol string) core.AssetClass {
	if class, declared := DocumentedClasses[symbol]; declared {
		return class
	}
	return core.ClassCrypto
}

// refFor builds a market reference from the ticker, with the quote and the documented class the
// venue's own data does not put on the symbol.
func refFor(contract Contract) core.MarketRef {
	class := AssetClassFor(contract.BaseCurrency)
	q := quote
	return adapters.MarketRefFor(VenueID, contract.TickerID, adapters.Overrides{
		Quote:      &q,
		HasQuote:   true,
		AssetClass: &class,
	})
}

// ParseSnapshots normalises one cycle's contracts against the gateway's trading statuses.
//
// A market the gateway does not list, or lists as anything but a `live` perp, is skipped: contracts
// carries halted markets too, and the status is the only signal that separates them.
func ParseSnapshots(contracts Contracts, symbols map[string]Symbol, now int64) []core.FundingSnapshot {
	snapshots := make([]core.FundingSnapshot, 0, len(contracts))
	for _, contract := range contracts {
		status, listed := symbols[contract.BaseCurrency]
		rate := contract.FundingRate
		if contract.ProductType != "perpetual" ||
			!listed || status.Type != "perp" || status.TradingStatus != "live" ||
			!rate.OK {
			continue
		}

		// SECONDS, so a straight copy would file every settlement in 1970.
		var nextFundingAt *int64
		if next := contract.NextFundingRateTimestamp; next.OK && next.Val > 0 {
			at := int64(next.Val) * 1000
			nextFundingAt = &at
		}

		interval := intervalHours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:  refFor(contract),
			ObservedAt: now,
			Rate:       rate.Val,
			// The published figure is a daily rate settled in 24 hourly slices, so the basis is 24
			// and the interval is 1. Collapsing the two would annualise BTC at 96% instead of 4%.
			BasisHours:      rateBasisHours,
			IntervalHours:   &interval,
			NextFundingAt:   nextFundingAt,
			Kind:            core.KindPredicted,
			MarkPrice:       contract.MarkPrice.Ptr(),
			IndexPrice:      contract.IndexPrice.Ptr(),
			OpenInterestUSD: contract.OpenInterestUSD.Ptr(),
			Volume24hUSD:    contract.QuoteVolume.Ptr(),
		})
	}
	return snapshots
}

// ParseFundingHistory returns realized HOURLY settlements (x18 fixed point, unix seconds) within
// [fromMs, toMs], oldest first.
func ParseFundingHistory(rows []FundingHistoryRow, contract Contract, fromMs, toMs int64) []core.FundingEvent {
	base := refFor(contract)

	// Keyed by settlement so a row repeated across a page boundary lands once, the later read
	// winning, exactly as the TypeScript Map does.
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		if !row.Timestamp.OK || !row.FundingRateX18.OK {
			continue
		}
		settledAt := int64(row.Timestamp.Val) * 1000
		if settledAt < fromMs || settledAt > toMs {
			continue
		}
		bySettlement[settledAt] = core.FundingEvent{
			MarketRef: base,
			SettledAt: settledAt,
			// The docs call history "realized hourly rates ... multiply by 24 for the daily
			// equivalent", so unlike the snapshot's daily figure this one's basis is the hour.
			Rate:       row.FundingRateX18.Val / x18Scale,
			BasisHours: intervalHours,
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
