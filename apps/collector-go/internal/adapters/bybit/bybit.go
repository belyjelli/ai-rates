// Package bybit parses Bybit's v5 linear-perp market data.
//
// Ported from packages/adapters/src/venues/bybit.ts and pinned to the same fixtures
// (packages/adapters/__fixtures__/bybit) and the same expected values as bybit.test.ts, so the Go
// and TypeScript parsers cannot drift apart while both are collecting.
package bybit

import (
	"fmt"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "bybit"

// Envelope is Bybit's uniform response wrapper. retCode 0 is success; anything else carries a
// message and no usable list.
type Envelope[T any] struct {
	RetCode int    `json:"retCode"`
	RetMsg  string `json:"retMsg"`
	Result  struct {
		List           []T    `json:"list"`
		NextPageCursor string `json:"nextPageCursor"`
	} `json:"result"`
}

func (e Envelope[T]) unwrap(what string) error {
	if e.RetCode != 0 {
		return fmt.Errorf("bybit %s: %d %s", what, e.RetCode, e.RetMsg)
	}
	return nil
}

type Ticker struct {
	Symbol            string       `json:"symbol"`
	FundingRate       adapters.Num `json:"fundingRate"`
	NextFundingTime   adapters.Num `json:"nextFundingTime"`
	MarkPrice         adapters.Num `json:"markPrice"`
	IndexPrice        adapters.Num `json:"indexPrice"`
	OpenInterestValue adapters.Num `json:"openInterestValue"`
	Turnover24h       adapters.Num `json:"turnover24h"`
	// Top of book. Prices are quote currency; the paired sizes are BASE COIN on Bybit, which is why
	// the depth conversion below is size x price with no multiplier.
	Bid1Price adapters.Num `json:"bid1Price"`
	Bid1Size  adapters.Num `json:"bid1Size"`
	Ask1Price adapters.Num `json:"ask1Price"`
	Ask1Size  adapters.Num `json:"ask1Size"`
}

type Instrument struct {
	Symbol       string `json:"symbol"`
	ContractType string `json:"contractType"`
	Status       string `json:"status"`
	BaseCoin     string `json:"baseCoin"`
	QuoteCoin    string `json:"quoteCoin"`
	// FundingInterval is MINUTES; 0 for dated futures.
	FundingInterval int `json:"fundingInterval"`
	LeverageFilter  struct {
		MaxLeverage adapters.Num `json:"maxLeverage"`
	} `json:"leverageFilter"`
	// SymbolType is what the contract tracks: "" or "innovation" for crypto, else "stock", "ETF",
	// "commodity", "forex".
	SymbolType string `json:"symbolType"`
}

type RiskLimit struct {
	ID     int    `json:"id"`
	Symbol string `json:"symbol"`
	// RiskLimitValue is the UPPER bound of this tier's position value, in the quote currency.
	RiskLimitValue    adapters.Num `json:"riskLimitValue"`
	MaintenanceMargin adapters.Num `json:"maintenanceMargin"`
	InitialMargin     adapters.Num `json:"initialMargin"`
	IsLowestRisk      int          `json:"isLowestRisk"`
	MaxLeverage       adapters.Num `json:"maxLeverage"`
}

type FundingHistoryItem struct {
	Symbol               string       `json:"symbol"`
	FundingRate          adapters.Num `json:"fundingRate"`
	FundingRateTimestamp adapters.Num `json:"fundingRateTimestamp"`
}

// AssetClassFor is the class Bybit declares for a linear contract, from `symbolType`.
//
// Live 2026-09-14, 869 linear instruments: "" 503 and "innovation" 124 (crypto, the latter Bybit's
// new-listing zone), "stock" 186 and "ETF" 49 (equity), "commodity" 4, "forex" 3. The field is what
// separates BBXUSDT, ONUSDT and PURRUSDT (stocks) from BBUSDT (BounceBit), and XAUUSDT (commodity)
// from XAUTUSDT (Tether Gold, declared crypto). A value this does not know is still a declaration
// that the contract is not crypto, so the base tables settle which class rather than defaulting.
func AssetClassFor(symbolType, base string) core.AssetClass {
	switch symbolType {
	case "", "innovation":
		return core.ClassCrypto
	case "stock", "ETF":
		return core.ClassEquity
	case "commodity":
		return core.ClassCommodity
	case "forex":
		return core.ClassFX
	default:
		return core.ClassifyNonCrypto(core.CanonicalBase(base))
	}
}

// ParseSnapshots joins tickers with perpetual instrument metadata. `fundingRate` is the rate for the
// current interval, so it is predicted rather than settled.
func ParseSnapshots(tickers Envelope[Ticker], instruments []Instrument, now int64) (core.SnapshotBatch, error) {
	if err := tickers.unwrap("tickers"); err != nil {
		return core.SnapshotBatch{}, err
	}

	perps := make(map[string]Instrument, len(instruments))
	for _, i := range instruments {
		if i.ContractType == "LinearPerpetual" && i.Status == "Trading" && i.FundingInterval > 0 {
			perps[i.Symbol] = i
		}
	}

	snapshots := make([]core.FundingSnapshot, 0, len(tickers.Result.List))
	for _, ticker := range tickers.Result.List {
		instrument, ok := perps[ticker.Symbol]
		if !ok || !ticker.FundingRate.OK {
			continue
		}

		// Symbols like "1000BONKPERP" do not parse cleanly; baseCoin/quoteCoin do.
		coin := core.ParseVenueSymbol(instrument.BaseCoin + "-" + instrument.QuoteCoin)
		hours := float64(instrument.FundingInterval) / 60
		class := AssetClassFor(instrument.SymbolType, coin.Base)

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef: adapters.MarketRefFor(VenueID, ticker.Symbol, adapters.Overrides{
				Base:       &coin.Base,
				Quote:      coin.Quote,
				HasQuote:   true,
				Multiplier: &coin.Multiplier,
				AssetClass: &class,
			}),
			ObservedAt:    now,
			Rate:          ticker.FundingRate.Val,
			BasisHours:    hours,
			IntervalHours: &hours,
			NextFundingAt: ticker.NextFundingTime.PositiveMs(),
			Kind:          core.KindPredicted,
			MarkPrice:     ticker.MarkPrice.Ptr(),
			IndexPrice:    ticker.IndexPrice.Ptr(),
			BestBid:       ticker.Bid1Price.Ptr(),
			// Bybit sizes are base coin already, not contracts: openInterestValue / openInterest
			// comes out at exactly the mark price. So the conversion is size x price, no multiplier
			// — unlike gate and okx, which is precisely why the stored column is USD.
			BestBidSizeUSD:  adapters.Mul(ticker.Bid1Size.Ptr(), ticker.Bid1Price.Ptr()),
			BestAsk:         ticker.Ask1Price.Ptr(),
			BestAskSizeUSD:  adapters.Mul(ticker.Ask1Size.Ptr(), ticker.Ask1Price.Ptr()),
			OpenInterestUSD: ticker.OpenInterestValue.Ptr(),
			Volume24hUSD:    ticker.Turnover24h.Ptr(),
			MaxLeverage:     instrument.LeverageFilter.MaxLeverage.Ptr(),
		})
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: nil}, nil
}

// ParseFundingHistory returns settled funding events, oldest first.
//
// Each rate is per settlement interval, inferred from the spacing of the events rather than read
// from current metadata — Bybit shortens 8h to 4h to 1h at the funding cap, so today's metadata is
// the wrong basis for last month's settlements. Falls back to fallbackHours when there are fewer
// than two events to infer from.
func ParseFundingHistory(env Envelope[FundingHistoryItem], fallbackHours float64) ([]core.FundingEvent, error) {
	if err := env.unwrap("funding history"); err != nil {
		return nil, err
	}

	type point struct {
		symbol    string
		settledAt int64
		rate      float64
	}
	points := make([]point, 0, len(env.Result.List))
	for _, item := range env.Result.List {
		if !item.FundingRateTimestamp.OK || !item.FundingRate.OK {
			continue
		}
		points = append(points, point{item.Symbol, int64(item.FundingRateTimestamp.Val), item.FundingRate.Val})
	}
	for i := 1; i < len(points); i++ {
		for j := i; j > 0 && points[j].settledAt < points[j-1].settledAt; j-- {
			points[j], points[j-1] = points[j-1], points[j]
		}
	}

	stamps := make([]int64, len(points))
	for i, p := range points {
		stamps[i] = p.settledAt
	}
	basisHours := fallbackHours
	if inferred := core.InferIntervalHours(stamps); inferred != nil {
		basisHours = *inferred
	}

	events := make([]core.FundingEvent, 0, len(points))
	for _, p := range points {
		events = append(events, core.FundingEvent{
			MarketRef:  adapters.MarketRefFor(VenueID, p.symbol, adapters.Overrides{}),
			SettledAt:  p.settledAt,
			Rate:       p.rate,
			BasisHours: basisHours,
			MarkPrice:  nil,
		})
	}
	return events, nil
}

// ParseRiskLimit normalises /v5/market/risk-limit rows into one ladder per symbol.
//
// Bybit gives each tier an upper bound (riskLimitValue) in the quote currency and numbers them from
// 1, so a tier's lower bound is the previous tier's upper bound. Linear perps quote in USDT, which
// is treated as USD throughout, as open interest already is.
//
// A ladder with an unreadable row is dropped WHOLE rather than in part: skipping one tier would
// silently stretch its neighbour across the gap and quote confident margin for a band nobody
// verified.
func ParseRiskLimit(rows []RiskLimit) []core.LeverageTier {
	order := make([]string, 0)
	bySymbol := make(map[string][]RiskLimit)
	for _, row := range rows {
		if _, seen := bySymbol[row.Symbol]; !seen {
			order = append(order, row.Symbol)
		}
		bySymbol[row.Symbol] = append(bySymbol[row.Symbol], row)
	}

	tiers := make([]core.LeverageTier, 0, len(rows))
	for _, symbol := range order {
		symbolRows := append([]RiskLimit(nil), bySymbol[symbol]...)
		for i := 1; i < len(symbolRows); i++ {
			for j := i; j > 0 && symbolRows[j].ID < symbolRows[j-1].ID; j-- {
				symbolRows[j], symbolRows[j-1] = symbolRows[j-1], symbolRows[j]
			}
		}

		ladder := make([]core.LeverageTier, 0, len(symbolRows))
		lower := 0.0
		usable := true
		for _, row := range symbolRows {
			if !row.RiskLimitValue.OK || row.RiskLimitValue.Val <= lower ||
				!row.InitialMargin.OK || row.InitialMargin.Val <= 0 ||
				!row.MaxLeverage.OK || row.MaxLeverage.Val <= 0 {
				usable = false
				break
			}
			upper := row.RiskLimitValue.Val
			ladder = append(ladder, core.LeverageTier{
				VenueID:          VenueID,
				VenueSymbol:      symbol,
				Tier:             row.ID,
				LowerNotionalUSD: lower,
				UpperNotionalUSD: &upper,
				IMR:              row.InitialMargin.Val,
				MMR:              row.MaintenanceMargin.Ptr(),
				MaxLeverage:      row.MaxLeverage.Val,
			})
			lower = upper
		}
		if usable {
			tiers = append(tiers, ladder...)
		}
	}
	return tiers
}
