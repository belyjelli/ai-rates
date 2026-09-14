// Package lighter parses Lighter's perp markets, for both of its deployments.
//
// Ported from packages/adapters/src/venues/lighter.ts. Two things here are easy to get wrong and
// have their own guards below:
//
//  1. `funding-rates` RELAYS OTHER VENUES' RATES. The same response carries binance, bybit and
//     hyperliquid rows beside Lighter's own, so without the exchange filter in ParseSnapshots this
//     adapter would silently republish Binance's funding as Lighter's.
//  2. Lighter pays funding EVERY HOUR but quotes an EIGHT-HOUR rate. `funding-rates` is the 8h rate
//     as a fraction and `fundings` rows are the hourly payment in percent; reading either at the
//     other's basis is an 8x error.
package lighter

import (
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	// VenueID is the Lighter (Ethereum) deployment.
	VenueID = "lighter"
	// VenueIDRH is the Robinhood Chain deployment: the same API, its own markets, book and
	// settlement currency.
	VenueIDRH = "lighter-rh"

	API = "https://mainnet.zklighter.elliot.ai/api/v1"
	// APIRH is the Robinhood Chain deployment: the same API, its own markets, book and settlement
	// currency.
	APIRH = "https://api.rh.lighter.xyz/api/v1"

	hourMS          = 3_600_000
	historyPageSize = 750
)

// quote is what every Lighter perp settles in. The API declares no per-perp quote: `orderBookDetails`
// gives every perp `quote_asset_id` 0, which names no asset (`assetDetails` numbers USDC 3, and spot
// markets do carry 3). The docs name one settlement currency for all perps, as read on 2026-09-14:
//
//   - https://docs.lighter.xyz/trading/pnl-and-total-account-value -- realized PnL is "the difference
//     in USDC value" between entry and exit, and funding payments are applied to realized PnL.
//   - https://docs.lighter.xyz/trading/multi-asset-margin -- "USDC (Lighter) and USDG (Robinhood Chain
//     Lighter) remain the base collateral". ETH and XAUT can back margin, discounted, but PnL and
//     funding still land in USDC.
//
// API is the Lighter (Ethereum) deployment, so USDC. The Robinhood Chain deployment quotes USDG
// instead; see RH.
const quote = "USDC"

// AssetClassEntry is one row of a deployment's declared-class table.
//
// A SLICE, not a map literal, because the order is load-bearing for the test that keeps each table
// sorted and one entry per market — Go map literals have no order to assert. The lookup map is built
// from it once at init and only read afterwards, so both deployments can share their tables across
// goroutines.
type AssetClassEntry struct {
	Symbol string
	Class  core.AssetClass
}

// AssetClasses is the class Lighter declares for each non-crypto market, by Lighter symbol. Absent
// means crypto.
//
// Lighter's API declares no class, so this is transcribed from what the venue publishes elsewhere,
// as it stood on 2026-09-14:
//
//  1. The RWA market-specifications table, whose per-market Type is authoritative for the 73 markets
//     it lists: https://docs.lighter.xyz/trading/real-world-assets-rwas/market-specifications
//     `bond` is filed as index and `pre-ipo equity` as equity.
//  2. For the 34 order-book markets that table omits, the token config bundled in the web app at
//     https://app.lighter.xyz: `asset_type` RWA, then its categories in this order -- STOCK, PRE_IPO
//     and ETF are equity, COMMODITIES commodity, FX and KRW fx, BONDS and COMPUTE index, and an RWA
//     with no category beyond NEW is equity.
//
// Decisions beyond those sources: QNT is Quantinuum stock, whatever the config's name "Quant" says --
// it marked 48.79, against OKX's Quantinuum at 48.85 and the Quant token at 64.3. BB is BlackBerry
// (7.72) and WEN is Wendy's. USDHKD is fx per the docs, though the config calls it CRYPTO. PAXG is
// absent although the config files it under COMMODITIES: it is a gold token, crypto on every venue.
// AI (Artificial Inu) and SPX (SPX6900) are crypto and absent.
//
// A new RWA listing is crypto until it is added here. Meanwhile migration 016's mark gate still keeps
// it out of a crypto pool whose price it does not share.
var AssetClasses = []AssetClassEntry{
	{"AAOI", core.ClassEquity},
	{"AAPL", core.ClassEquity},
	{"AMD", core.ClassEquity},
	{"AMZN", core.ClassEquity},
	{"ANTHROPIC", core.ClassEquity},
	{"ARM", core.ClassEquity},
	{"ASML", core.ClassEquity},
	{"AUDUSD", core.ClassFX},
	{"AVGO", core.ClassEquity},
	{"AXTI", core.ClassEquity},
	{"BABA", core.ClassEquity},
	{"BB", core.ClassEquity},
	{"BE", core.ClassEquity},
	{"BMNR", core.ClassEquity},
	{"BOT", core.ClassEquity},
	{"BOTZ", core.ClassIndex},
	{"BRENTOIL", core.ClassCommodity},
	{"BYD", core.ClassEquity},
	{"CBRS", core.ClassEquity},
	{"COIN", core.ClassEquity},
	{"CRCL", core.ClassEquity},
	{"CRWV", core.ClassEquity},
	{"CXMT", core.ClassEquity},
	{"DELL", core.ClassEquity},
	{"DIA", core.ClassIndex},
	{"DRAM", core.ClassIndex},
	{"EURUSD", core.ClassFX},
	{"EWY", core.ClassIndex},
	{"GBPUSD", core.ClassFX},
	{"GEV", core.ClassEquity},
	{"GME", core.ClassEquity},
	{"GOOGL", core.ClassEquity},
	{"H100", core.ClassIndex},
	{"HANMI", core.ClassEquity},
	{"HOOD", core.ClassEquity},
	{"HYUNDAI", core.ClassEquity},
	{"HYUNDAIUSD", core.ClassEquity},
	{"IBM", core.ClassEquity},
	{"INTC", core.ClassEquity},
	{"IWM", core.ClassIndex},
	{"KIOXIA", core.ClassEquity},
	{"KORU", core.ClassEquity},
	{"KRCOMP", core.ClassEquity},
	{"LITE", core.ClassEquity},
	{"MAGS", core.ClassIndex},
	{"META", core.ClassEquity},
	{"MINIMAX", core.ClassEquity},
	{"MRNA", core.ClassEquity},
	{"MRVL", core.ClassEquity},
	{"MSFT", core.ClassEquity},
	{"MSTR", core.ClassEquity},
	{"MU", core.ClassEquity},
	{"NATGAS", core.ClassCommodity},
	{"NBIS", core.ClassEquity},
	{"NOK", core.ClassEquity},
	{"NOW", core.ClassEquity},
	{"NVDA", core.ClassEquity},
	{"NZDUSD", core.ClassFX},
	{"OPENAI", core.ClassEquity},
	{"ORCL", core.ClassEquity},
	{"PLTR", core.ClassEquity},
	{"POPMART", core.ClassEquity},
	{"QCOM", core.ClassEquity},
	{"QNT", core.ClassEquity},
	{"QQQ", core.ClassIndex},
	{"RKLB", core.ClassEquity},
	{"SAMSUNG", core.ClassEquity},
	{"SAMSUNGUSD", core.ClassEquity},
	{"SHEIN", core.ClassEquity},
	{"SKHY", core.ClassEquity},
	{"SKHYNIX", core.ClassEquity},
	{"SKHYNIXUSD", core.ClassEquity},
	{"SMIC", core.ClassEquity},
	{"SNDK", core.ClassEquity},
	{"SOXL", core.ClassIndex},
	{"SOXS", core.ClassEquity},
	{"SOXX", core.ClassEquity},
	{"SPACEX", core.ClassEquity},
	{"SPCX", core.ClassEquity},
	{"SPY", core.ClassIndex},
	{"STABLECOINX", core.ClassEquity},
	{"STRC", core.ClassEquity},
	{"TENCENT", core.ClassEquity},
	{"TSLA", core.ClassEquity},
	{"TSM", core.ClassEquity},
	{"TTWO", core.ClassEquity},
	{"UNITREE", core.ClassEquity},
	{"URA", core.ClassEquity},
	{"US100", core.ClassIndex},
	{"US10Y", core.ClassIndex},
	{"US500", core.ClassIndex},
	{"USDCAD", core.ClassFX},
	{"USDCHF", core.ClassFX},
	{"USDHKD", core.ClassFX},
	{"USDJPY", core.ClassFX},
	{"USDKRW", core.ClassFX},
	{"WDC", core.ClassEquity},
	{"WEN", core.ClassEquity},
	{"WHEAT", core.ClassCommodity},
	{"WTI", core.ClassCommodity},
	{"XAG", core.ClassCommodity},
	{"XAU", core.ClassCommodity},
	{"XCU", core.ClassCommodity},
	{"XIAOMI", core.ClassEquity},
	{"XPD", core.ClassCommodity},
	{"XPT", core.ClassCommodity},
	{"ZHIPU", core.ClassEquity},
}

// RhAssetClasses is the class declared for each non-crypto market on Robinhood Chain Lighter, by
// symbol. Absent means crypto, or undeclared.
//
// Built for this deployment rather than borrowed from AssetClasses: it lists 57 perps of its own
// (14 of them not on mainnet), and its API declares no class either. Sources, as read 2026-09-14:
//
//  1. The token config bundled in https://app.lighter.xyz, which is also the Robinhood Chain front end
//     (its `robinhood_chain` network switch). It declares 43 of the 57: 29 `asset_type` RWA and 14
//     CRYPTO. Categories map as for mainnet -- STOCK and PRE_IPO equity, COMMODITIES commodity.
//  2. Where https://docs.lighter.xyz/trading/real-world-assets-rwas/market-specifications types the
//     same ticker, its Type is used: SPY, QQQ and SOXL are `index` there (core files them as equity).
//
// The shared tickers are the same underlyings on both deployments: of 43 symbols listed on both, marks
// agreed within 0.6% on 2026-09-14, except the internally priced pre-IPO OPENAI (2.7%) and ANTHROPIC
// (1.9%) and BE (5.2%, both Bloom Energy).
//
// UNDECLARED, so crypto here until Lighter publishes them: ASTS, AMC, CLSK, IREN, LUNR, QBTS, RGTI,
// SGOV, SLV, SMCI, SOFI, USAR, USO and WULF. They are RH-only listings, absent from both the token
// config and the RWA docs. Migration 016's mark gate keeps each out of any crypto pool it does not
// price like.
var RhAssetClasses = []AssetClassEntry{
	{"AAPL", core.ClassEquity},
	{"AMD", core.ClassEquity},
	{"AMZN", core.ClassEquity},
	{"ANTHROPIC", core.ClassEquity},
	{"BABA", core.ClassEquity},
	{"BE", core.ClassEquity},
	{"COIN", core.ClassEquity},
	{"CRCL", core.ClassEquity},
	{"CRWV", core.ClassEquity},
	{"GOOGL", core.ClassEquity},
	{"INTC", core.ClassEquity},
	{"META", core.ClassEquity},
	{"MSFT", core.ClassEquity},
	{"MU", core.ClassEquity},
	{"NVDA", core.ClassEquity},
	{"OPENAI", core.ClassEquity},
	{"ORCL", core.ClassEquity},
	{"PLTR", core.ClassEquity},
	{"QQQ", core.ClassIndex},
	{"SHEIN", core.ClassEquity},
	{"SKHY", core.ClassEquity},
	{"SNDK", core.ClassEquity},
	{"SOXL", core.ClassIndex},
	{"SPCX", core.ClassEquity},
	{"SPY", core.ClassIndex},
	{"TSLA", core.ClassEquity},
	{"TSM", core.ClassEquity},
	{"XAG", core.ClassCommodity},
	{"XAU", core.ClassCommodity},
}

// Deployment is one Lighter deployment: the same API and funding engine, its own book, currency and
// listings.
type Deployment struct {
	VenueID string
	API     string
	// Quote is the settlement currency of every perp on the deployment.
	Quote string
	// AssetClasses is the declared class by Lighter symbol; absent means crypto. Built once at init
	// and never written afterwards, so the two deployments' adapters can read it concurrently.
	AssetClasses map[string]core.AssetClass
}

func classMap(entries []AssetClassEntry) map[string]core.AssetClass {
	out := make(map[string]core.AssetClass, len(entries))
	for _, entry := range entries {
		out[entry.Symbol] = entry.Class
	}
	return out
}

// Mainnet is the Lighter (Ethereum) deployment.
var Mainnet = Deployment{
	VenueID:      VenueID,
	API:          API,
	Quote:        quote,
	AssetClasses: classMap(AssetClasses),
}

// RH is Robinhood Chain Lighter (catalog id `lighter-rh`): the same API, funding engine and rate
// limit.
//
// FUNDING is mainnet's: an 8-hour rate paid 1/8 hourly. The per-market funding parameters are
// identical (BTC and ETH `funding_premium_multiplier` 100, clamps 0.05/4.0, `base_interest_rate` 0.01;
// AAPL 50 and 0.0032), and the units check out live: ETH's `funding-rates` 0.000096 / 8 = 0.000012/h
// equals its hourly `fundings` rows of 0.0012%. Against Hyperliquid, same minute: ETH 0.000012/h here,
// 0.0000125/h there; an hourly misreading would be 8x. BTC read 0.000024-0.000032 (0.000003-0.000004/h)
// while Hyperliquid's BTC was 0.0000117/h -- a lower premium, not a basis factor.
//
// TRADABILITY: 57 perps, all `active`, on 2026-09-14; its 27 spot books (`AAPL/USDG`...) are not perps.
//
// RATE LIMIT: 60 requests per rolling minute for standard accounts
// (https://apidocs.rh.lighter.xyz/docs/rate-limits), as on mainnet.
//
// QUOTE: USDG. "USDC (Lighter) and USDG (Robinhood Chain Lighter) remain the base collateral"
// (https://docs.lighter.xyz/trading/multi-asset-margin), its `assetDetails` lists USDG and no USDC,
// and every spot book is quoted in USDG. Perps again declare `quote_asset_id` 0.
//
// BASE: every symbol is a bare ticker that the parser returns unchanged.
var RH = Deployment{
	VenueID:      VenueIDRH,
	API:          APIRH,
	Quote:        "USDG",
	AssetClasses: classMap(RhAssetClasses),
}

type FundingRate struct {
	MarketID int64 `json:"market_id"`
	// Exchange names who the rate belongs to. It is NOT always "lighter": see ParseSnapshots.
	Exchange string       `json:"exchange"`
	Symbol   string       `json:"symbol"`
	Rate     adapters.Num `json:"rate"`
}

type OrderBookDetail struct {
	MarketID   int64        `json:"market_id"`
	Symbol     string       `json:"symbol"`
	MarketType string       `json:"market_type"`
	Status     string       `json:"status"`
	MarkPrice  adapters.Num `json:"mark_price"`
	IndexPrice adapters.Num `json:"index_price"`
	// OpenInterest is in BASE units, so money needs the mark applied.
	OpenInterest          adapters.Num `json:"open_interest"`
	DailyQuoteTokenVolume adapters.Num `json:"daily_quote_token_volume"`
}

type Funding struct {
	// Timestamp is epoch SECONDS, unlike everything this collector stores.
	Timestamp adapters.Num `json:"timestamp"`
	// Value is the amount paid, which nothing here reads: the rate is what a settlement records.
	Value string `json:"value"`
	// Rate is an UNSIGNED hourly rate in percent; Direction carries the sign.
	Rate      adapters.Num `json:"rate"`
	Direction string       `json:"direction"`
}

type FundingRates struct {
	FundingRates []FundingRate `json:"funding_rates"`
}

type OrderBookDetails struct {
	OrderBookDetails []OrderBookDetail `json:"order_book_details"`
}

type Fundings struct {
	Fundings []Funding `json:"fundings"`
}

// ParseSnapshots normalises `funding-rates` joined with `orderBookDetails`. Lighter pays funding every
// hour; its formula computes an 8-hour rate and pays 1/8 of it each hour, and `funding-rates` reports
// that 8-hour rate as a fraction (the same response's relayed rows are 8h too: Binance's row equals
// Binance's 8h rate and Hyperliquid's is 8x its hourly rate). Relayed rows are dropped.
//
// THE EXCHANGE FILTER IS NOT OPTIONAL. `funding-rates` answers with other venues' rows beside
// Lighter's own — binance, bybit and hyperliquid in both fixtures — keyed on the same market_id and
// symbol. Without `row.Exchange != deployment's own "lighter"` this adapter would publish Binance's
// and Bybit's funding as Lighter's, under Lighter's venue id, and nothing downstream could tell.
func ParseSnapshots(rates FundingRates, details OrderBookDetails, now int64, deployment Deployment) []core.FundingSnapshot {
	live := make(map[int64]OrderBookDetail, len(details.OrderBookDetails))
	for _, detail := range details.OrderBookDetails {
		if detail.MarketType == "perp" && detail.Status == "active" {
			live[detail.MarketID] = detail
		}
	}
	nextFundingAt := (now/hourMS)*hourMS + hourMS

	snapshots := make([]core.FundingSnapshot, 0, len(rates.FundingRates))
	for _, row := range rates.FundingRates {
		detail, listed := live[row.MarketID]
		// "lighter" is the exchange tag on BOTH deployments' own rows: the Robinhood Chain host
		// relays the same three venues and still names itself "lighter".
		if row.Exchange != VenueID || !listed || !row.Rate.OK {
			continue
		}

		class := core.ClassCrypto
		if declared, known := deployment.AssetClasses[row.Symbol]; known {
			class = declared
		}
		quote := deployment.Quote
		intervalHours := 1.0
		next := nextFundingAt
		markPrice := detail.MarkPrice.Ptr()

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef: adapters.MarketRefFor(deployment.VenueID, row.Symbol, adapters.Overrides{
				Quote:      &quote,
				HasQuote:   true,
				AssetClass: &class,
			}),
			ObservedAt: now,
			Rate:       row.Rate.Val,
			// An 8h rate paid one-eighth at a time, every hour: basis and interval genuinely differ.
			BasisHours:    8,
			IntervalHours: &intervalHours,
			NextFundingAt: &next,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    detail.IndexPrice.Ptr(),
			// Open interest is quoted in base units, so it needs the mark to reach money.
			OpenInterestUSD: adapters.Mul(detail.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    detail.DailyQuoteTokenVolume.Ptr(),
		})
	}
	return snapshots
}

// ParseFundings normalises `fundings` (1h resolution) into settled hourly payments, oldest first.
// Unlike `funding-rates`, `rate` here is an unsigned hourly rate in percent, rounded to 4 decimals,
// with `direction` naming the side that paid ("long" means longs paid, i.e. a positive rate).
func ParseFundings(venueSymbol string, payload Fundings, deployment Deployment) []core.FundingEvent {
	events := make([]core.FundingEvent, 0, len(payload.Fundings))
	for _, row := range payload.Fundings {
		// A missing or non-finite timestamp is absent, never epoch zero: Num decodes it as absent,
		// which is what `Number.isFinite` rejects on the TypeScript side.
		if !row.Rate.OK || !row.Timestamp.OK {
			continue
		}
		sign := 1.0
		if row.Direction == "short" {
			sign = -1
		}
		quote := deployment.Quote
		events = append(events, core.FundingEvent{
			MarketRef: adapters.MarketRefFor(deployment.VenueID, venueSymbol, adapters.Overrides{
				Quote:    &quote,
				HasQuote: true,
			}),
			SettledAt:  int64(row.Timestamp.Val * 1000),
			Rate:       sign * row.Rate.Val / 100,
			BasisHours: 1,
			MarkPrice:  nil,
		})
	}
	sort.SliceStable(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
