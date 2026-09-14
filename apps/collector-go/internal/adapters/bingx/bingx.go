// Package bingx parses BingX's USDT- and USDC-margined perpetuals.
//
// Ported from packages/adapters/src/venues/bingx.ts. Three venue quirks run through everything here,
// and each one is a wrong number if it is dropped in translation:
//
//   - THE CLASS IS ENCODED IN THE CONTRACT CODE, nowhere else. BingX has no class field anywhere in
//     /quote/contracts, so `NCSKTSLA2USD` is the only thing that says Tesla is not a token; see
//     AssetClassFor.
//   - BOOK QUANTITIES ARE BASE COIN, not contracts. The ticker's 13.84 BTC at the best bid sat beside
//     19.24 BTC at the same price in /quote/depth moments earlier; contract counts would be 10,000x
//     that.
//   - OPEN INTEREST IS ALREADY A QUOTE-CURRENCY VALUE, not coins and not contracts; see
//     ParseOpenInterest.
package bingx

import (
	"fmt"
	"regexp"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "bingx"

// okCode is the `code` every successful BingX envelope carries.
const okCode = 0

// liveStatus is `status` on /quote/contracts: 1 is listed and funded; 25 is suspended (see
// IsTradable).
const liveStatus = 1

// Envelope is BingX's uniform response wrapper. Code 0 is success; anything else carries a message
// and no usable data.
//
// Generic over the whole `data` value rather than over its element type, because BingX answers a
// LIST on every bulk endpoint and an OBJECT on /quote/openInterest. A list endpoint with an empty
// window answers `data: null`, which decodes to a nil slice and ranges as empty — the same reading
// the TypeScript `unwrapList` gives it, and not an error.
type Envelope[T any] struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data T      `json:"data"`
}

func (e Envelope[T]) unwrap(what string) (T, error) {
	if e.Code != okCode {
		var zero T
		return zero, fmt.Errorf("bingx %s: %d %s", what, e.Code, e.Msg)
	}
	return e.Data, nil
}

type Contract struct {
	Symbol string `json:"symbol"`
	// Asset is the contract's base code: `BTC`, or `NCSKTSLA2USD` for a tradfi contract.
	Asset string `json:"asset"`
	// Currency is the settlement coin, USDT or USDC.
	Currency string `json:"currency"`
	Status   int    `json:"status"`
	// DisplayName is a display name, e.g. `TSLA-USDT` for `NCSKTSLA2USD-USDT`. Not read; see
	// AssetClassFor.
	DisplayName string `json:"displayName"`
}

type PremiumIndex struct {
	Symbol     string       `json:"symbol"`
	MarkPrice  adapters.Num `json:"markPrice"`
	IndexPrice adapters.Num `json:"indexPrice"`
	// LastFundingRate is the estimate for the settlement at NextFundingTime, despite the name.
	LastFundingRate      adapters.Num `json:"lastFundingRate"`
	NextFundingTime      adapters.Num `json:"nextFundingTime"`
	FundingIntervalHours adapters.Num `json:"fundingIntervalHours"`
}

type Ticker struct {
	Symbol string `json:"symbol"`
	// QuoteVolume is quote currency.
	QuoteVolume adapters.Num `json:"quoteVolume"`
	// Top of book. Prices are quote currency; quantities are BASE COIN.
	BidPrice adapters.Num `json:"bidPrice"`
	BidQty   adapters.Num `json:"bidQty"`
	AskPrice adapters.Num `json:"askPrice"`
	AskQty   adapters.Num `json:"askQty"`
}

type OpenInterest struct {
	Symbol string `json:"symbol"`
	// OpenInterest is the quote-currency VALUE for linear contracts, not contracts or coins.
	OpenInterest adapters.Num `json:"openInterest"`
	Time         int64        `json:"time"`
}

type FundingRate struct {
	Symbol      string       `json:"symbol"`
	FundingRate adapters.Num `json:"fundingRate"`
	FundingTime adapters.Num `json:"fundingTime"`
	MarkPrice   adapters.Num `json:"markPrice"`
}

// OpenInterestEntry is one symbol's cached open interest reading.
type OpenInterestEntry struct {
	ValueUSD  float64
	FetchedAt int64
}

// tradfiCode matches a tradfi contract code: `NC`, a two-letter namespace, then the underlying.
var tradfiCode = regexp.MustCompile(`^NC([A-Z]{2})[A-Z0-9]+$`)

// pricingTail is the scheme's `2XXX` pricing suffix, e.g. the `2USD` of `NCSKTSLA2USD`.
var pricingTail = regexp.MustCompile(`2[A-Z]{3}$`)

// AssetClassFor is the class BingX declares for a contract, from the namespace of its contract code.
//
// BingX has no class field anywhere in /quote/contracts (v2 and v3 carry the same 22 keys). What it
// does have is a code scheme for every tradfi contract it lists: `NC` then SK (stock), SI (stock
// index), CO (commodity) or FX (forex), then the underlying and its pricing currency, so Tesla is
// `NCSKTSLA2USD`, gold `NCCOGOLD2USD`, EUR/USD `NCFXEUR2USD`, the S&P 500 `NCSISP5002USD`. That is a
// venue-assigned product code rather than a ticker, and it is the only declaration there is.
//
// Live 2026-09-14, 1,002 listed contracts: NCSK 323, NCFX 34, NCCO 10, NCSI 8, and 627 without the
// scheme. No crypto contract's code starts with `NC`. A namespace this does not know counts only
// when it also carries the scheme's `2XXX` pricing tail, so a future crypto token spelt NC… stays
// crypto; with the tail it is tradfi of a kind we cannot read, and the base tables pick the class.
//
// NOTE the base is not resolved from the display name, so MarketRefFor sees `NCSISP5002USD` rather
// than US500: the SI rows refine to equity, and none of these contracts pools with another venue.
func AssetClassFor(asset string) core.AssetClass {
	match := tradfiCode.FindStringSubmatch(asset)
	if match == nil {
		return core.ClassCrypto
	}
	switch match[1] {
	case "SK":
		return core.ClassEquity
	case "SI":
		return core.ClassIndex
	case "CO":
		return core.ClassCommodity
	case "FX":
		return core.ClassFX
	default:
		if pricingTail.MatchString(asset) {
			return core.ClassifyNonCrypto(core.CanonicalBase(asset))
		}
		return core.ClassCrypto
	}
}

// IsTradable reports whether a contract is a listed USDT- or USDC-margined perpetual.
//
// Live 2026-09-14, 1,216 contracts: status 1 on 1,002 (953 USDT, 49 USDC), exactly the set
// premiumIndex answers for; status 25 on 214 (coffee, Nikkei, zinc, delisted names), none of them
// in premiumIndex. BingX lists no delivery or inverse contracts on this API. `apiStateOpen` is
// false on 169 status-1 contracts -- orders from the API are paused, not the market -- and they
// keep publishing funding, so they are kept.
func IsTradable(contract Contract) bool {
	return contract.Status == liveStatus &&
		(contract.Currency == "USDT" || contract.Currency == "USDC")
}

// ParseSnapshots joins the premium index to the listed contracts and the tickers. Open interest
// comes from the rotating cache.
//
// Output order is the premium index's own, which a Go map would not preserve — so the premium rows
// are ranged over directly and the contracts and tickers are only ever looked up by symbol.
func ParseSnapshots(
	contracts []Contract,
	premium []PremiumIndex,
	tickers []Ticker,
	openInterest map[string]OpenInterestEntry,
	now int64,
) []core.FundingSnapshot {
	tradable := make(map[string]Contract, len(contracts))
	for _, contract := range contracts {
		if IsTradable(contract) {
			tradable[contract.Symbol] = contract
		}
	}
	tickerBySymbol := make(map[string]Ticker, len(tickers))
	for _, ticker := range tickers {
		tickerBySymbol[ticker.Symbol] = ticker
	}

	snapshots := make([]core.FundingSnapshot, 0, len(premium))
	for _, p := range premium {
		contract, listed := tradable[p.Symbol]
		if !listed || !p.LastFundingRate.OK || !p.FundingIntervalHours.OK || p.FundingIntervalHours.Val <= 0 {
			continue
		}

		hours := p.FundingIntervalHours.Val
		interval := hours
		quote := contract.Currency
		class := AssetClassFor(contract.Asset)
		ref := adapters.MarketRefFor(VenueID, p.Symbol, adapters.Overrides{
			Quote:      &quote,
			HasQuote:   true,
			AssetClass: &class,
		})

		var bestBid, bestBidSizeUSD, bestAsk, bestAskSizeUSD, volume24hUSD *float64
		if ticker, hasTicker := tickerBySymbol[p.Symbol]; hasTicker {
			bestBid = ticker.BidPrice.Ptr()
			// Quantities are base coin: the ticker's 13.84 BTC at the best bid sat beside 19.24 BTC at
			// the same price in /quote/depth moments earlier. Contract counts would be 10,000x that.
			bestBidSizeUSD = adapters.Mul(ticker.BidQty.Ptr(), ticker.BidPrice.Ptr())
			bestAsk = ticker.AskPrice.Ptr()
			bestAskSizeUSD = adapters.Mul(ticker.AskQty.Ptr(), ticker.AskPrice.Ptr())
			// Quote turnover: BTC-USDT's 337,831,457 is its 4,386.85 BTC volume x a ~77,000 price.
			volume24hUSD = ticker.QuoteVolume.Ptr()
		}

		var openInterestUSD *float64
		if entry, cached := openInterest[p.Symbol]; cached {
			value := entry.ValueUSD
			openInterestUSD = &value
		}

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:  ref,
			ObservedAt: now,
			// Predicted: at 22:00 UTC on 2026-09-13 BTC-USDT read 0.000094 here, for the 00:00
			// settlement, while the 16:00 settlement in /quote/fundingRate was 0.000078.
			Rate:            p.LastFundingRate.Val,
			BasisHours:      hours,
			IntervalHours:   &interval,
			NextFundingAt:   p.NextFundingTime.PositiveMs(),
			Kind:            core.KindPredicted,
			MarkPrice:       p.MarkPrice.Ptr(),
			IndexPrice:      p.IndexPrice.Ptr(),
			BestBid:         bestBid,
			BestBidSizeUSD:  bestBidSizeUSD,
			BestAsk:         bestAsk,
			BestAskSizeUSD:  bestAskSizeUSD,
			OpenInterestUSD: openInterestUSD,
			Volume24hUSD:    volume24hUSD,
		})
	}
	return snapshots
}

// ParseOpenInterest reads one /quote/openInterest answer as USD.
//
// The figure is already a quote-currency value: BTC-USDT answered 287,039,550.4 at a 77,190 mark,
// which is 3,719 BTC. Read as coins it would be $22 trillion; as 0.0001-BTC contracts, $2.2bn on a
// venue that traded $338m of BTC that day. ccxt files it as `openInterestValue` for linear swaps.
func ParseOpenInterest(env Envelope[OpenInterest]) (*float64, error) {
	data, err := env.unwrap("open interest")
	if err != nil {
		return nil, err
	}
	return data.OpenInterest.Ptr(), nil
}

// ParseFundingHistory returns settled funding inside [fromMs, toMs], oldest first, carrying the mark
// BingX stamps on each.
//
// fallbackHours is nil when the caller has no declared interval to fall back on, which is a real
// state and not a zero: a window holding one settlement can infer nothing, and inventing a basis
// there would mis-weight the only payment in it. Such a window returns no events at all.
func ParseFundingHistory(
	ref core.MarketRef,
	rows []FundingRate,
	fromMs, toMs int64,
	fallbackHours *float64,
) []core.FundingEvent {
	// One row per settlement timestamp, the last seen winning, as the TypeScript Map does. The
	// insertion order is kept only so the stamps handed to InferIntervalHours do not depend on Go's
	// map iteration; the events themselves are sorted below.
	byTime := make(map[int64]FundingRate, len(rows))
	stamps := make([]int64, 0, len(rows))
	for _, row := range rows {
		settledAt := row.FundingTime.PositiveMs()
		if settledAt == nil || !row.FundingRate.OK {
			continue
		}
		if _, seen := byTime[*settledAt]; !seen {
			stamps = append(stamps, *settledAt)
		}
		byTime[*settledAt] = row
	}

	basisHours := fallbackHours
	if inferred := core.InferIntervalHours(stamps); inferred != nil {
		basisHours = inferred
	}
	if basisHours == nil {
		return []core.FundingEvent{}
	}

	// The interval is inferred from every settlement read, then the window is applied — a window
	// holding two settlements of a four-hourly market still gets 4, not the gap between its ends.
	selected := make([]int64, 0, len(stamps))
	for _, settledAt := range stamps {
		if settledAt >= fromMs && settledAt <= toMs {
			selected = append(selected, settledAt)
		}
	}
	sort.Slice(selected, func(i, j int) bool { return selected[i] < selected[j] })

	events := make([]core.FundingEvent, 0, len(selected))
	for _, settledAt := range selected {
		row := byTime[settledAt]
		events = append(events, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       row.FundingRate.Val,
			BasisHours: *basisHours,
			MarkPrice:  row.MarkPrice.Ptr(),
		})
	}
	return events
}
