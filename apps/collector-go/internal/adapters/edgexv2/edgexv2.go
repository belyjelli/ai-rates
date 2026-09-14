// Package edgexv2 parses edgeX V2 (catalog id `edgex-v2`).
//
// Ported from packages/adapters/src/venues/edgex.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/edgex-v2) and the same expected values as edgex.test.ts, so the
// Go and TypeScript parsers cannot drift apart while both are collecting. The TypeScript file is
// named edgex.ts while the venue id is "edgex-v2"; the id is what the catalog and the database key
// on, so it is the name this package carries.
//
// WHY ONLY V2: edgeX V1 (`pro.edgex.exchange/api/v1`, catalog id `edgex`) is not collected. On
// 2026-09-13 its `getMetaData` still listed 189 tradeable contracts, but every data call came back
// empty: `getLatestFundingRate` with and without `contractId=10000001`, `getTicker`, `getKline`,
// `getDepth` and `getFundingRatePage` all returned `data: []`. The docs describe V2 as "transitioning
// from our successful V1 foundation" (https://edgex-1.gitbook.io/edgeX-documentation/edgex-v2), and
// the web app at pro.edgex.exchange now trades the V2 `*USDC` contracts. There is no V1 book left.
//
// REQUESTS per cycle: one `getLatestFundingRate` carrying every live contract id, plus up to
// TickerBudget per-contract `getTicker` calls for open interest and volume, plus `getMetaData` and
// `contract-labels` once an hour.
//   - The funding call takes `contractId` as an array (https://edgex-1.gitbook.io/edgeX-documentation/
//     api-v2/public-api/funding-api) with no documented maximum; all 173 ids comma-joined answered 173
//     rows in one call (115 KB). Ids are still chunked at 200 so a larger listing cannot build one URL.
//   - `getTicker` is the only public source of open interest, and it answers one contract at a time:
//     comma-joined ids and no id both return `data: []`, and the `getTickerSummary` the docs show is
//     404. So tickers refresh round-robin, TickerBudget per cycle, and a value older than
//     TickerMaxAge is dropped rather than shown.
//   - No rate limit is published ("Rate Limits Apply"); 80 sequential `getTicker` calls at ~4.4/s all
//     returned 200 on 2026-09-13, so 300ms spacing leaves headroom.
//
// FUNDING, decided from the docs and successive live reads on 2026-09-13:
//   - Interval 4h. `fundingRateIntervalMin` is 240 on all 173 contracts, the settlement-only history
//     (`filterSettlementFundingRate=true`) has BTC rows at 12:00, 16:00 and 20:00Z, and the ticker's
//     `nextFundingTime` is `fundingTime` + 4h. The docs' "settlement occurs every 8 hours" (history
//     filter) and "exchanged every hour" (Funding Fees page) are V1 text.
//   - Basis = the interval: rates are per 4h. ETH read 0.00005, the interest floor
//     (`predictedFundingRate`, "interestRate/frequency" = 0.0003 / 6), which is 0.0000125/h and 10.95%
//     APR -- Hyperliquid's ETH read exactly 0.0000125/h the same minute. An hourly reading would be
//     43.8%. BTC -0.00005233/4h is -0.0000131/h against Hyperliquid's +0.0000117/h: the same size, and
//     the sign is edgeX's own discount (impact bid 76,690.6 under index 76,740.8).
//   - `forecastFundingRate` is the snapshot, `predicted`, due at `fundingTime` + interval. It moved
//     -0.00005233 -> -0.00005234 -> -0.00005592 over three reads while `fundingTime` stayed 20:00Z,
//     and the ticker (the app's own field) shows that same value against `nextFundingTime`.
//   - `fundingRate` is the last settlement, emitted as `settled` at `fundingTime`: it held at
//     -0.00005067 across the same reads and equals the history row flagged `isSettlement: true` at
//     20:00Z. The field doc's example ("finalized at 08:00, and used for settlement at 09:00") could
//     be read as paying it one interval later; the venue's own settlement flag is what is followed.
//
// UNITS, checked live: the funding row carries `markPrice` and `indexPrice`. Ticker `openInterest` is
// base units (BTC 3,284.957 x 76,773.6 = $252M) and `value` is the 24h quote volume (BTC 211,555,185
// over `size` 2,748.205 averages 76,979, inside that day's 76,453-77,404 range).
//
// TRADABILITY: `enableTrade`, `enableOpenPosition` and `enableDisplay`. 170 of 173 on 2026-09-13; the
// three tradeable but hidden contracts are ZROUSDC, JPYUSDC and EURUSDC.
//
// QUOTE: the settlement coin the metadata declares, `coinList` entry `quoteCoinId` 1000, which is
// USDC for every V2 contract (and `global.collateralCoinId` is 1000). V1 named the same id "USD".
//
// BASE: the parser's reading of `contractName` matched the declared base coin (`baseCoinId`, with
// `1000PEPE` read as PEPE x1000) on 171 of 173. The two that differ are named in CJK: 哈基米USDC
// declares HAJIMI and 牛来USDC declares NIULAI, and the declaration is passed.
package edgexv2

import (
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// VenueID is the catalog id. The TypeScript file is edgex.ts; the venue it collects is edgex-v2.
const VenueID = "edgex-v2"

const minuteMs = 60_000

// TickerMaxAge is how stale a cached ticker may be and still be shown. Past it the open interest and
// volume read as absent rather than as a reading from another hour: tickers refresh round-robin, so
// a contract at the back of the queue would otherwise carry a figure three sweeps old.
const TickerMaxAge = 45 * time.Minute

// successCode is the envelope code every successful edgeX response carries.
const successCode = "SUCCESS"

// Response is edgeX's uniform wrapper.
//
// Data is a POINTER so that an absent or null `data` is distinguishable from an empty one, which is
// the `body.data === undefined || body.data === null` half of the TypeScript's unwrap guard. Code is
// a string on this venue ("SUCCESS"), so an absent code reads as "" and never as a numeric zero that
// some other venue's success code could collide with.
type Response[T any] struct {
	Code string  `json:"code"`
	Data *T      `json:"data"`
	Msg  *string `json:"msg"`
}

// unwrap is the TypeScript `unwrap`: anything that is not a success envelope carrying data is an
// error, never an empty result. Ported as a THROW, not a skip — a venue answering with an error
// envelope has told us nothing about its book, and treating that as "no markets" would delist every
// contract it lists.
func (r Response[T]) unwrap(what string) (T, error) {
	var zero T
	if r.Code != successCode || r.Data == nil {
		code := r.Code
		if code == "" {
			// `body?.code ?? "no body"`: an envelope with no code at all.
			code = "no body"
		}
		msg := ""
		if r.Msg != nil {
			msg = *r.Msg
		}
		return zero, fmt.Errorf("%s: %s failed: %s %s", VenueID, what, code, msg)
	}
	return *r.Data, nil
}

type Coin struct {
	CoinID   string `json:"coinId"`
	CoinName string `json:"coinName"`
}

// Contract is one row of `meta/getMetaData`'s contractList.
//
// IsStock and IsFx are plain bools rather than pointers: the TypeScript reads them as `if
// (contract.isFx)`, so an absent flag and a false one take the same branch and nothing downstream
// can tell them apart.
type Contract struct {
	ContractID         string `json:"contractId"`
	ContractName       string `json:"contractName"`
	BaseCoinID         string `json:"baseCoinId"`
	QuoteCoinID        string `json:"quoteCoinId"`
	EnableTrade        bool   `json:"enableTrade"`
	EnableDisplay      bool   `json:"enableDisplay"`
	EnableOpenPosition bool   `json:"enableOpenPosition"`
	IsStock            bool   `json:"isStock"`
	IsFx               bool   `json:"isFx"`
	// FundingRateIntervalMin is MINUTES: 240 on all 173 contracts on 2026-09-13.
	FundingRateIntervalMin adapters.Num `json:"fundingRateIntervalMin"`
	// DisplayMaxLeverage is the headline figure; it holds only at small size.
	DisplayMaxLeverage adapters.Num `json:"displayMaxLeverage"`
}

// MetaData is `meta/getMetaData`'s payload.
//
// ContractList is a POINTER to a slice so that a missing list is distinguishable from an empty one,
// which is what the TypeScript's `Array.isArray(meta.contractList)` guard turns into a thrown
// "unexpected metadata".
type MetaData struct {
	CoinList     []Coin      `json:"coinList"`
	ContractList *[]Contract `json:"contractList"`
}

// FundingRate is one row of `funding/getLatestFundingRate` or of a `getFundingRatePage` page.
type FundingRate struct {
	ContractID string `json:"contractId"`
	// FundingTime is epoch MILLISECONDS of the latest settlement.
	FundingTime      adapters.Num `json:"fundingTime"`
	FundingTimestamp adapters.Num `json:"fundingTimestamp"`
	MarkPrice        adapters.Num `json:"markPrice"`
	IndexPrice       adapters.Num `json:"indexPrice"`
	// FundingRate is the rate settled at FundingTime.
	FundingRate adapters.Num `json:"fundingRate"`
	// ForecastFundingRate is the running estimate for the next settlement; an empty string on history
	// rows, which adapters.Num already reads as absent.
	ForecastFundingRate adapters.Num `json:"forecastFundingRate"`
	// IsSettlement is compared against true in the TypeScript (`!== true`), so absent and false take
	// the same branch and a plain bool loses nothing.
	IsSettlement           bool         `json:"isSettlement"`
	FundingRateIntervalMin adapters.Num `json:"fundingRateIntervalMin"`
}

// Ticker is one row of `quote/getTicker`, the only public source of open interest.
type Ticker struct {
	ContractID string `json:"contractId"`
	// OpenInterest is BASE UNITS, not contracts and not quote: BTC 3,284.957 x 76,773.6 = $252M.
	OpenInterest adapters.Num `json:"openInterest"`
	// Value is the 24h QUOTE volume; `size` beside it is the base volume.
	Value adapters.Num `json:"value"`
}

type LabelContract struct {
	ContractID   string `json:"contractId"`
	ContractName string `json:"contractName"`
}

type ContractLabel struct {
	Name             string          `json:"name"`
	MultiLanguageKey string          `json:"multiLanguageKey"`
	ProductCategory  string          `json:"productCategory"`
	Contracts        []LabelContract `json:"contracts"`
}

type FundingPage struct {
	DataList           []FundingRate `json:"dataList"`
	NextPageOffsetData string        `json:"nextPageOffsetData"`
}

// v2Labels is the label set the V2 app files its markets under; `AppTradFi` is another app's, and
// puts JPM under Commodities.
const v2Labels = "PrepV2"

var labelClasses = map[string]core.AssetClass{
	"tabs.commodities": core.ClassCommodity,
	"tabs.stocks":      core.ClassEquity,
	"tabs.etf":         core.ClassEquity,
	"tabs.pre-ipo":     core.ClassEquity,
}

// LabelClasses is the classes declared by the app's market tabs (`/api/v2/public/contract-labels`,
// undocumented, read by the web app at pro.edgex.exchange), keyed by contract id. Only the tradfi
// tabs are kept; Layer 1, Meme, AI and the like say nothing about class.
func LabelClasses(labels []ContractLabel) map[string]core.AssetClass {
	classes := make(map[string]core.AssetClass, len(labels))
	for _, label := range labels {
		assetClass, declared := labelClasses[label.MultiLanguageKey]
		if label.ProductCategory != v2Labels || !declared {
			continue
		}
		for _, contract := range label.Contracts {
			classes[contract.ContractID] = assetClass
		}
	}
	return classes
}

// AssetClassFor is the class edgeX declares for a contract. labelled is what the app's tabs declare,
// or "" for a contract no tradfi tab lists.
//
// `isFx` and `isStock` are flags on the contract itself; on 2026-09-13 they marked 2 and 93 of 173.
// Commodities carry neither flag -- XAU, XAG, CL, BZ, COPPER, NATGAS, XPD and XPT are all
// `isStock: false, isFx: false` -- so their only declaration is the app's Commodities tab. The flags
// win over a tab. ETFs (SPY, QQQ, SOXL) are `isStock` and pass as equity. Anything else is crypto.
func AssetClassFor(isStock, isFx bool, labelled core.AssetClass) core.AssetClass {
	if isFx {
		return core.ClassFX
	}
	if isStock {
		return core.ClassEquity
	}
	if labelled != "" {
		return labelled
	}
	return core.ClassCrypto
}

// IsLive is a contract that trades, opens positions and is shown.
func IsLive(contract Contract) bool {
	return contract.EnableTrade && contract.EnableOpenPosition && contract.EnableDisplay
}

// Markets is metadata indexed for parsing: contracts, coin names by id, and label-declared classes.
//
// Contracts is a SLICE in the venue's own contractList order, with byID only a lookup beside it. The
// TypeScript keeps a Map, which iterates in insertion order for free; ranging a Go map instead would
// reshuffle the funding call's comma-joined id list on every cycle and make the request unreviewable.
type Markets struct {
	Contracts []Contract
	// Coins maps coinId to coinName.
	Coins map[string]string
	// Labels maps contractId to the class the app's tradfi tabs declare.
	Labels map[string]core.AssetClass

	byID map[string]int
}

// IndexMarkets indexes one metadata read. A missing contractList yields no contracts; the caller is
// what rejects that, since only it can tell a malformed body from a venue with nothing listed.
func IndexMarkets(meta MetaData, labels []ContractLabel) Markets {
	var contracts []Contract
	if meta.ContractList != nil {
		contracts = *meta.ContractList
	}
	byID := make(map[string]int, len(contracts))
	for i, contract := range contracts {
		byID[contract.ContractID] = i
	}
	coins := make(map[string]string, len(meta.CoinList))
	for _, coin := range meta.CoinList {
		coins[coin.CoinID] = coin.CoinName
	}
	return Markets{Contracts: contracts, Coins: coins, Labels: LabelClasses(labels), byID: byID}
}

// Contract is the contract with this id, as the TypeScript's `contracts.get` reads it.
func (m Markets) Contract(contractID string) (Contract, bool) {
	i, known := m.byID[contractID]
	if !known {
		return Contract{}, false
	}
	return m.Contracts[i], true
}

// ContractByName is the contract the venue names this way, scanned in listing order like the
// TypeScript's `.find`.
func (m Markets) ContractByName(contractName string) (Contract, bool) {
	for _, contract := range m.Contracts {
		if contract.ContractName == contractName {
			return contract, true
		}
	}
	return Contract{}, false
}

// LiveIDs is every live contract's id, in the venue's own listing order — the order the funding
// call's id list is built in.
func (m Markets) LiveIDs() []string {
	ids := make([]string, 0, len(m.Contracts))
	for _, contract := range m.Contracts {
		if IsLive(contract) {
			ids = append(ids, contract.ContractID)
		}
	}
	return ids
}

// marketRef names one contract, preferring the base coin the metadata declares over the reading of
// the contract name.
//
// The declaration is only taken where it DIFFERS from what the name parses to, so 1000PEPEUSDC keeps
// its x1000 multiplier: the parser reads PEPE x1000, which recomposes to the declared "1000PEPE" and
// so overrides nothing. The two contracts that genuinely differ are named in CJK -- 哈基米USDC
// declares HAJIMI -- and there the declaration is what reaches the pool.
func marketRef(contract Contract, markets Markets) core.MarketRef {
	declared := markets.Coins[contract.BaseCoinID]
	parsed := core.ParseVenueSymbol(contract.ContractName)
	parsedCode := parsed.Base
	if parsed.Multiplier != 1 {
		// `${parsed.multiplier}${parsed.base}`: 1000 renders as "1000", matching the coin name.
		parsedCode = strconv.FormatFloat(parsed.Multiplier, 'f', -1, 64) + parsed.Base
	}

	class := AssetClassFor(contract.IsStock, contract.IsFx, markets.Labels[contract.ContractID])
	// The quote is always the declared settlement coin, so HasQuote is always set: an unknown
	// quoteCoinId means "this market has no known quote", not "read one off the symbol".
	overrides := adapters.Overrides{HasQuote: true, AssetClass: &class}
	if quote, known := markets.Coins[contract.QuoteCoinID]; known {
		overrides.Quote = &quote
	}
	if declared != "" && declared != parsedCode {
		overrides.Base = &declared
	}
	return adapters.MarketRefFor(VenueID, contract.ContractName, overrides)
}

// intervalMinutes is the funding interval the row states, else the one the contract states.
func intervalMinutes(row FundingRate, contract Contract) (float64, bool) {
	minutes := row.FundingRateIntervalMin
	if !minutes.OK {
		minutes = contract.FundingRateIntervalMin
	}
	if minutes.OK && minutes.Val > 0 {
		return minutes.Val, true
	}
	return 0, false
}

// TickerEntry is one round of the ticker rotation. A nil Ticker is a real answer that carried no row
// for the contract, cached so it waits its turn instead of jumping the queue each cycle.
type TickerEntry struct {
	Ticker    *Ticker
	FetchedAt int64
}

// ParseSnapshots normalises one cycle's `getLatestFundingRate` rows against the cached tickers.
//
// The published rate is the FORECAST over the 4h interval, and the row's `fundingRate` is the last
// settlement, emitted beside it as a settled event at `fundingTime`.
func ParseSnapshots(markets Markets, rates []FundingRate, tickers map[string]TickerEntry, now int64) core.SnapshotBatch {
	snapshots := make([]core.FundingSnapshot, 0, len(rates))
	settled := make([]core.FundingEvent, 0, len(rates))

	for _, row := range rates {
		contract, listed := markets.Contract(row.ContractID)
		if !listed || !IsLive(contract) {
			continue
		}
		minutes, stated := intervalMinutes(row, contract)
		rate := row.ForecastFundingRate
		if !stated || !rate.OK {
			continue
		}

		hours := minutes / 60
		base := marketRef(contract, markets)
		markPrice := row.MarkPrice.Ptr()

		// A reading older than TickerMaxAge is dropped rather than shown: open interest from three
		// sweeps ago is a different hour's book.
		var ticker *Ticker
		if cached, seen := tickers[row.ContractID]; seen && now-cached.FetchedAt <= TickerMaxAge.Milliseconds() {
			ticker = cached.Ticker
		}
		var openInterestUSD, volume24hUSD *float64
		if ticker != nil {
			// `openInterest` is base units, so the notional is size x mark.
			openInterestUSD = adapters.Mul(ticker.OpenInterest.Ptr(), markPrice)
			volume24hUSD = ticker.Value.Ptr()
		}

		var nextFundingAt *int64
		if row.FundingTime.OK {
			at := int64(row.FundingTime.Val) + int64(minutes)*minuteMs
			nextFundingAt = &at
		}

		interval := hours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       base,
			ObservedAt:      now,
			Rate:            rate.Val,
			BasisHours:      hours,
			IntervalHours:   &interval,
			NextFundingAt:   nextFundingAt,
			Kind:            core.KindPredicted,
			MarkPrice:       markPrice,
			IndexPrice:      row.IndexPrice.Ptr(),
			OpenInterestUSD: openInterestUSD,
			Volume24hUSD:    volume24hUSD,
			MaxLeverage:     contract.DisplayMaxLeverage.Ptr(),
		})

		if row.FundingRate.OK && row.FundingTime.OK {
			settled = append(settled, core.FundingEvent{
				MarketRef:  base,
				SettledAt:  int64(row.FundingTime.Val),
				Rate:       row.FundingRate.Val,
				BasisHours: hours,
				MarkPrice:  nil,
			})
		}
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}
}

// ParseFundingHistory returns the settlement rows within [fromMs, toMs], oldest first; the mark is
// the one recorded at settlement.
func ParseFundingHistory(rows []FundingRate, contract Contract, markets Markets, fromMs, toMs int64) []core.FundingEvent {
	base := marketRef(contract, markets)

	// One event per settlement timestamp, last value winning, as the TypeScript Map does. The order
	// slice keeps the pre-sort sequence the venue's own rather than Go's map iteration order.
	bySettlement := make(map[int64]core.FundingEvent, len(rows))
	order := make([]int64, 0, len(rows))

	for _, row := range rows {
		settledAt := row.FundingTime
		rate := row.FundingRate
		minutes, stated := intervalMinutes(row, contract)
		if !row.IsSettlement || !settledAt.OK || !rate.OK || !stated {
			continue
		}
		at := int64(settledAt.Val)
		if at < fromMs || at > toMs {
			continue
		}
		if _, seen := bySettlement[at]; !seen {
			order = append(order, at)
		}
		bySettlement[at] = core.FundingEvent{
			MarketRef:  base,
			SettledAt:  at,
			Rate:       rate.Val,
			BasisHours: minutes / 60,
			MarkPrice:  row.MarkPrice.Ptr(),
		}
	}

	events := make([]core.FundingEvent, 0, len(order))
	for _, at := range order {
		events = append(events, bySettlement[at])
	}
	sort.SliceStable(events, func(i, j int) bool { return events[i].SettledAt < events[j].SettledAt })
	return events
}
