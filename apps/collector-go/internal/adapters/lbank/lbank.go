// Package lbank parses LBank's USDT-margined perpetuals (`productGroup=SwapU`).
//
// Ported from packages/adapters/src/venues/lbank.ts. Measured from this machine on 2026-09-13
// 22:10-22:20 UTC (docs: lbank.com/docs/contract.html):
//
//   - TWO ENDPOINTS. `marketData` (300 KB) every cycle for funding, prices and volume; `instrument`
//     (350 KB) hourly for the settle coin, declared base and `needSuspend`. The same 834 symbols on
//     both. `openInterest`, `fundingRate` and anything else under `/pub` answer 403, and the docs
//     list only getTime, instrument, marketData and marketOrder: NO OPEN INTEREST AND NO FUNDING
//     HISTORY, so OpenInterestUSD is nil and this package has no history fetcher at all.
//   - `fundingRate` IS THE ESTIMATE FOR THE PERIOD IN PROGRESS, so Kind is predicted. It moved on
//     126 of 834 symbols between reads a minute apart (BTCUSDT 0.00007692 then 0.00007709), which a
//     settled rate never does; that second BTC read equals WEEX's live `forecastFundingRate`
//     exactly, and 444 of 609 shared symbols equal Binance's current estimate. Binance's 16:00
//     settlement for BTCUSDT was 0.0000645, which LBank showed nowhere. Polled every 5 minutes up to
//     settlement, 198 to 266 symbols moved on every read, and BTCUSDT's 23:55 read, 0.00007157, is
//     exactly what Binance settled at 00:00. `positionFeeRate` equals `fundingRate` on every row.
//     BTCUSDT 0.00007709 over 8h is 8.4% APR; Binance's estimate was 0.00007727.
//   - INTERVAL: `positionFeeTime` in SECONDS -- {28800: 338, 14400: 492, 3600: 4}. The four 3600s
//     (VRT, STORJ, B3, IOST) are exactly the four whose `nextFeeTime` (epoch ms) was 23:00 UTC
//     rather than 00:00, so it is the settlement interval.
//   - UNITS: `volume` is base units and `turnover` its USDT value: `turnover` / (`volume` x last)
//     has median 1.010 over all traded rows. BTCUSDT turned over $240M against Binance's $4.71bn.
//     `volumeMultiple` is 1 on every instrument. `underlyingPrice` is the index: median 0.0bp from
//     `instrument.indexPrice`, where `markedPrice` sits 14.9bp away.
//   - TRADABILITY: `instrumentStatus` is "2" on all 834 (undocumented; every one of them traded in
//     the eight minutes before the read), and "2" is required. `clearCurrency` is USDT on all 834.
//     Seven rows send no `fundingRate` or `positionFeeRate` at all (10TAUSDT, CRTUSDT, GUSDTUSDT,
//     JMP, TICS, OBOL, 10001000SATS, all untraded in 24h) and are skipped: 827 markets collected.
//   - CLASS: LBank declares no category. `needSuspend` is 1 on nine instruments -- CEG, FIG, SUGAR,
//     COCOA, COTTON, WHEAT, SOYBEAN, XZN, XAL -- every one a share or a commodity, and on no crypto,
//     so it is read as "this market keeps trading hours: not crypto", with the class left to
//     core.ClassifyNonCrypto. The other 825 declare nothing and are crypto, INCLUDING the tradfi
//     names LBank lists without that flag: GOLDUSDT, SILVERUSDT, XPTUSDT, XCUUSDT, XTIUSDT,
//     MUSTOCKUSDT, METASTOCKUSDT and others. That is LBank's declaration, not ours to correct from
//     the ticker.
//   - BASE: `baseCurrency` is declared. The parser agrees with it on all 834 except six
//     contract-size prefixes (1000BTTC, 1000000BABYDOGE...), which it reads as multipliers.
//     `symbolAlias` is a display name (`GOLD(XAU)`, CROSS shown as `ONE`) and is not used.
//   - RATE LIMIT: undocumented; ccxt costs these endpoints 2.5 against a 20ms unit, i.e. 20/s. Two
//     requests a cycle, spaced at 100ms.
package lbank

import (
	"fmt"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "lbank"

const (
	// APIBase is the public contract API. Everything collected here lives under it.
	APIBase = "https://lbkperp.lbank.com/cfd/openApi/v1/pub"
	// productGroup selects the USDT-margined book, the only one collected.
	productGroup = "SwapU"

	// InstrumentsMaxAgeMs: the instrument list is 350 KB and only says what trades, so hourly.
	InstrumentsMaxAgeMs int64 = 60 * 60_000

	// tradingStatus is the only `instrumentStatus` observed, on all 834 live instruments.
	tradingStatus = "2"
)

// settleCoins are the dollar settlement currencies collected. `clearCurrency` was USDT on all 834
// live instruments; USDC is carried because the field is the venue's own declaration of what a
// position settles in, and a coin-settled contract does not belong in a USD pool.
var settleCoins = map[string]struct{}{"USDT": {}, "USDC": {}}

// Envelope is LBank's uniform response wrapper.
type Envelope[T any] struct {
	Data      []T    `json:"data"`
	ErrorCode int    `json:"error_code"`
	Msg       string `json:"msg"`
	Success   bool   `json:"success"`
}

// unwrap rejects anything that is not a success envelope carrying a list. A null or missing `data`
// is a malformed body rather than an empty book, exactly as the TypeScript's Array.isArray guard
// reads it; `[]` decodes to a non-nil empty slice and passes.
func (e Envelope[T]) unwrap(what string) ([]T, error) {
	if !e.Success || e.ErrorCode != 0 || e.Data == nil {
		return nil, fmt.Errorf("lbank: unexpected %s response: %d %s", what, e.ErrorCode, e.Msg)
	}
	return e.Data, nil
}

// Instrument is one row of `/instrument`, the hourly list of what trades.
type Instrument struct {
	Symbol       string `json:"symbol"`
	BaseCurrency string `json:"baseCurrency"`
	// PriceCurrency is what the contract is priced in; ClearCurrency is what it settles in.
	PriceCurrency string `json:"priceCurrency"`
	ClearCurrency string `json:"clearCurrency"`
	// NeedSuspend is 1 on the instruments that keep trading hours; see the package header. A Num
	// rather than an int so an absent flag stays absent instead of decoding as a declared 0 -- both
	// take the not-crypto branch's `false`, but only one of them is something the venue said.
	NeedSuspend adapters.Num `json:"needSuspend"`
	MaxLeverage adapters.Num `json:"maxLeverage"`
}

// MarketData is one row of `/marketData`, read every cycle.
type MarketData struct {
	Symbol string `json:"symbol"`
	// FundingRate is the estimate for the period in progress, a fraction per PositionFeeTime.
	FundingRate adapters.Num `json:"fundingRate"`
	// PositionFeeRate equalled FundingRate on every row; it is the fallback, not a second figure.
	PositionFeeRate adapters.Num `json:"positionFeeRate"`
	// PositionFeeTime is the settlement interval in SECONDS.
	PositionFeeTime adapters.Num `json:"positionFeeTime"`
	// NextFeeTime is the next settlement, epoch MILLISECONDS.
	NextFeeTime adapters.Num `json:"nextFeeTime"`
	MarkedPrice adapters.Num `json:"markedPrice"`
	// UnderlyingPrice is the index price: median 0.0bp from `instrument.indexPrice`, where
	// `markedPrice` sits 14.9bp away.
	UnderlyingPrice adapters.Num `json:"underlyingPrice"`
	// Turnover is 24h volume in the QUOTE currency; the sibling `volume` field is base units.
	Turnover         adapters.Num `json:"turnover"`
	InstrumentStatus string       `json:"instrumentStatus"`
}

// Tradable is what the hourly instrument list says about one collectable market.
type Tradable struct {
	Quote      string
	AssetClass core.AssetClass
	// Base is the declared base where the parser disagrees with it; "" keeps the parsed base, which
	// is the TypeScript's null.
	Base string
	// MaxLeverage is nil where the venue declares no usable figure.
	MaxLeverage *float64
}

// AssetClassFor is LBank's declared class: `needSuspend` 1 is not crypto, and nothing else is
// declared.
func AssetClassFor(instrument Instrument) core.AssetClass {
	if instrument.NeedSuspend.OK && instrument.NeedSuspend.Val == 1 {
		return core.ClassifyNonCrypto(core.CanonicalBase(instrument.BaseCurrency))
	}
	return core.ClassCrypto
}

// declaredBase is the base to override the parsed one with, or "" where the parser already agrees
// with the venue. 1000BTTC is the case that reaches it here: a contract-size prefix is the parser's
// to read, and it reads it, so the declaration is dropped.
//
// LBank prices and settles in different currencies, so the screen is on priceCurrency — the one the
// base is actually quoted against. The shared rule carries the rest.
func declaredBase(symbol, baseCurrency, priceCurrency string) string {
	return adapters.DeclaredMarketBase(symbol, baseCurrency, priceCurrency)
}

// TradableInstruments is the instruments settled in a dollar stablecoin, by symbol.
func TradableInstruments(instruments []Instrument) map[string]Tradable {
	out := make(map[string]Tradable, len(instruments))
	for _, instrument := range instruments {
		if _, settled := settleCoins[instrument.ClearCurrency]; !settled {
			continue
		}
		// 10TAUSDT, which has not traded in 24h, declares a max leverage of 0: no figure at all.
		var maxLeverage *float64
		if instrument.MaxLeverage.OK && instrument.MaxLeverage.Val > 0 {
			maxLeverage = instrument.MaxLeverage.Ptr()
		}
		out[instrument.Symbol] = Tradable{
			Quote:       instrument.ClearCurrency,
			AssetClass:  AssetClassFor(instrument),
			Base:        declaredBase(instrument.Symbol, instrument.BaseCurrency, instrument.PriceCurrency),
			MaxLeverage: maxLeverage,
		}
	}
	return out
}

// ParseSnapshots normalises one cycle's `/marketData` response against the hourly instrument list.
//
// Ranged over the ROW SLICE, so the output keeps the venue's own order; the instrument map is only
// ever looked up, never iterated, so no Go map ordering reaches the result.
func ParseSnapshots(rows []MarketData, tradable map[string]Tradable, now int64) []core.FundingSnapshot {
	snapshots := make([]core.FundingSnapshot, 0, len(rows))
	for _, row := range rows {
		instrument, listed := tradable[row.Symbol]
		rate := row.FundingRate
		if !rate.OK {
			rate = row.PositionFeeRate
		}
		seconds := row.PositionFeeTime
		if !listed || row.InstrumentStatus != tradingStatus {
			continue
		}
		// Seven rows send no rate of either kind and are skipped rather than collected at zero: a
		// market that publishes nothing has not told us it is paying nothing.
		if !rate.OK || !seconds.OK || seconds.Val <= 0 {
			continue
		}

		// SECONDS, unlike the venues that report minutes or milliseconds.
		hours := seconds.Val / 3600
		interval := hours
		quote := instrument.Quote
		class := instrument.AssetClass
		overrides := adapters.Overrides{Quote: &quote, HasQuote: true, AssetClass: &class}
		if instrument.Base != "" {
			base := instrument.Base
			overrides.Base = &base
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     adapters.MarketRefFor(VenueID, row.Symbol, overrides),
			ObservedAt:    now,
			Rate:          rate.Val,
			BasisHours:    hours,
			IntervalHours: &interval,
			NextFundingAt: row.NextFeeTime.PositiveMs(),
			// The rate moves between reads and lands on the next settlement, never on the last one.
			Kind:       core.KindPredicted,
			MarkPrice:  row.MarkedPrice.Ptr(),
			IndexPrice: row.UnderlyingPrice.Ptr(),
			// LBank publishes no open interest anywhere under /pub, so this is absent, not zero.
			OpenInterestUSD: nil,
			Volume24hUSD:    row.Turnover.Ptr(),
			MaxLeverage:     instrument.MaxLeverage,
		})
	}
	return snapshots
}
