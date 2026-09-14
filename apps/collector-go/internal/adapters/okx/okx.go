// Package okx parses OKX's SWAP market data.
//
// Ported from packages/adapters/src/venues/okx.ts. This is the most unit-sensitive adapter in the
// set: OKX quotes SIZES IN CONTRACTS everywhere — book depth, position-tier bounds, liquidation
// size — and `ctVal` is the only field that says what a contract is worth. Reading those numbers as
// anything else has produced two recorded errors in this project: a tier-1 leverage band placed at
// $1,000 instead of ~$780k (three orders of magnitude), and an inverse-swap notional read 77,742x
// too large by applying the mark to a contract already denominated in dollars.
package okx

import (
	"fmt"
	"regexp"
	"sort"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "okx"

// perpInstID matches perpetual swaps margined in USDT, USDC or coin (USD). It excludes dated and
// exotic instruments such as "XAU-USD_UM_XPERP-310502".
var perpInstID = regexp.MustCompile(`^[A-Z0-9]+-(USDT|USDC|USD)-SWAP$`)

// Envelope is OKX's uniform response wrapper. Code "0" is success; anything else carries a message
// and no usable data — including rate limits, which arrive as code 50011 inside an HTTP 200.
type Envelope[T any] struct {
	Code string `json:"code"`
	Msg  string `json:"msg"`
	Data []T    `json:"data"`
}

func (e Envelope[T]) unwrap(what string) ([]T, error) {
	if e.Code != "0" {
		return nil, fmt.Errorf("okx %s: %s %s", what, e.Code, e.Msg)
	}
	return e.Data, nil
}

type FundingRate struct {
	InstID string `json:"instId"`
	// FundingRate is the rate for the current period, charged at FundingTime.
	FundingRate     adapters.Num `json:"fundingRate"`
	FundingTime     adapters.Num `json:"fundingTime"`
	NextFundingTime adapters.Num `json:"nextFundingTime"`
	// SettFundingRate is the rate actually settled at PrevFundingTime.
	SettFundingRate adapters.Num `json:"settFundingRate"`
	PrevFundingTime adapters.Num `json:"prevFundingTime"`
	SettState       string       `json:"settState"`
}

type Ticker struct {
	InstID string       `json:"instId"`
	Last   adapters.Num `json:"last"`
	// VolCcy24h is 24h volume in the BASE currency, so money needs the last price applied.
	VolCcy24h adapters.Num `json:"volCcy24h"`
	// Top of book. Prices are quote currency; the paired sizes are CONTRACTS.
	BidPx adapters.Num `json:"bidPx"`
	BidSz adapters.Num `json:"bidSz"`
	AskPx adapters.Num `json:"askPx"`
	AskSz adapters.Num `json:"askSz"`
}

type OpenInterest struct {
	InstID string       `json:"instId"`
	OiUsd  adapters.Num `json:"oiUsd"`
}

type MarkPrice struct {
	InstID string       `json:"instId"`
	MarkPx adapters.Num `json:"markPx"`
}

type Instrument struct {
	InstID string `json:"instId"`
	// InstFamily is what tier ladders are published per ("BTC-USDT"), not per instrument.
	InstFamily string `json:"instFamily"`
	// CtVal is the size of one contract, denominated in CtValCcy.
	CtVal adapters.Num `json:"ctVal"`
	// CtValCcy is the base coin for linear swaps; "USD" for inverse ones, which are already quoted
	// in dollars.
	CtValCcy string       `json:"ctValCcy"`
	CtMult   adapters.Num `json:"ctMult"`
	// InstCategory is what the swap tracks: "1" crypto, "3" stocks, "4" commodities, "5" forex,
	// "6" bonds. NOT to be confused with `category`, a fee-schedule field that reads "1" on every
	// swap, stocks included.
	InstCategory string `json:"instCategory"`
}

type PositionTier struct {
	InstFamily string       `json:"instFamily"`
	Tier       adapters.Num `json:"tier"`
	// MinSz and MaxSz are CONTRACTS, not notional. Inclusive bounds.
	MinSz    adapters.Num `json:"minSz"`
	MaxSz    adapters.Num `json:"maxSz"`
	IMR      adapters.Num `json:"imr"`
	MMR      adapters.Num `json:"mmr"`
	MaxLever adapters.Num `json:"maxLever"`
}

type FundingHistoryItem struct {
	InstID      string       `json:"instId"`
	FundingRate adapters.Num `json:"fundingRate"`
	// RealizedRate is what was actually charged, and is preferred where present.
	RealizedRate adapters.Num `json:"realizedRate"`
	FundingTime  adapters.Num `json:"fundingTime"`
}

type LiquidationDetail struct {
	// PosSide is the side of the POSITION that was closed. OKX states it directly, unlike Gate
	// where the side is a sign on the size.
	PosSide string `json:"posSide"`
	// Side is the closing order's side; "sell" closes a long. Not used — PosSide is authoritative.
	Side string `json:"side"`
	// Sz is size in CONTRACTS, as everywhere else in this API.
	Sz adapters.Num `json:"sz"`
	// BkPx is the bankruptcy price: what the forced close filled at.
	BkPx   adapters.Num `json:"bkPx"`
	BkLoss adapters.Num `json:"bkLoss"`
	Ccy    string       `json:"ccy"`
	// Ts is epoch MILLISECONDS — unlike Gate's seconds.
	Ts adapters.Num `json:"ts"`
}

type LiquidationRow struct {
	InstID     string              `json:"instId"`
	InstType   string              `json:"instType"`
	InstFamily string              `json:"instFamily"`
	Details    []LiquidationDetail `json:"details"`
}

// AssetClassFor is the class OKX declares for a swap, from `instCategory`.
//
// Live 2026-09-14, 479 swaps: "1" 297 (crypto), "3" 174 (stocks), "4" 8 (commodities); no "5" or
// "6" listed yet. It is the only thing that says QNT-USDT-SWAP is Quantinuum and BB-USDT-SWAP is
// BlackBerry, while STX, AI and SPX stay crypto. OKX files US500, US100, JP225 and KR200 under "3"
// too, which MarketRefFor refines to index. An empty or missing value is crypto: the field predates
// OKX's non-crypto listings. Bonds, and any category added later, are a declaration of not-crypto
// with no class of their own, so the base tables decide.
func AssetClassFor(instCategory, base string) core.AssetClass {
	switch instCategory {
	case "", "1":
		return core.ClassCrypto
	case "3":
		return core.ClassEquity
	case "4":
		return core.ClassCommodity
	case "5":
		return core.ClassFX
	default:
		return core.ClassifyNonCrypto(core.CanonicalBase(base))
	}
}

// ContractNotionalUSD is the USD notional of a SINGLE contract, or nil when it cannot be
// established.
//
// Inverse swaps (CtValCcy "USD", settled in the base coin) already size a contract in dollars, so
// the mark plays no part. Linear swaps size it in the base coin and need the mark to reach USD;
// without one the ladder cannot be converted at all, and a guess would be worse than nothing.
func ContractNotionalUSD(instrument Instrument, marks map[string]MarkPrice) *float64 {
	if !instrument.CtVal.OK || instrument.CtVal.Val <= 0 {
		return nil
	}
	ctMult := 1.0
	if instrument.CtMult.OK {
		ctMult = instrument.CtMult.Val
	}
	if instrument.CtValCcy == "USD" {
		usd := instrument.CtVal.Val * ctMult
		return &usd
	}
	mark, known := marks[instrument.InstID]
	if !known || !mark.MarkPx.OK || mark.MarkPx.Val <= 0 {
		return nil
	}
	usd := instrument.CtVal.Val * ctMult * mark.MarkPx.Val
	return &usd
}

func byInstID[T any](rows []T, id func(T) string) map[string]T {
	out := make(map[string]T, len(rows))
	for _, row := range rows {
		out[id(row)] = row
	}
	return out
}

// ParseSnapshots normalises one cycle's five bulk responses.
func ParseSnapshots(
	funding Envelope[FundingRate],
	tickers Envelope[Ticker],
	openInterest Envelope[OpenInterest],
	markPrices Envelope[MarkPrice],
	instruments Envelope[Instrument],
	now int64,
) (core.SnapshotBatch, error) {
	fundingRows, err := funding.unwrap("funding rate")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	tickerRows, err := tickers.unwrap("tickers")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	oiRows, err := openInterest.unwrap("open interest")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	markRows, err := markPrices.unwrap("mark price")
	if err != nil {
		return core.SnapshotBatch{}, err
	}
	// Only for turning book sizes into money: OKX quotes them in contracts, and ctVal is the only
	// thing that says what a contract is worth. Fifteen swaps are inverse (ctValCcy "USD"), which
	// ContractNotionalUSD already handles — reading those as coin was a 77,742x error once.
	instrumentRows, err := instruments.unwrap("instruments")
	if err != nil {
		return core.SnapshotBatch{}, err
	}

	tickerByID := byInstID(tickerRows, func(t Ticker) string { return t.InstID })
	oiByID := byInstID(oiRows, func(o OpenInterest) string { return o.InstID })
	markByID := byInstID(markRows, func(m MarkPrice) string { return m.InstID })
	instrumentByID := byInstID(instrumentRows, func(i Instrument) string { return i.InstID })

	snapshots := make([]core.FundingSnapshot, 0, len(fundingRows))
	settled := make([]core.FundingEvent, 0, len(fundingRows))

	for _, row := range fundingRows {
		if !perpInstID.MatchString(row.InstID) {
			continue
		}
		fundingTime := row.FundingTime.PositiveMs()
		intervalHours := adapters.HoursBetween(fundingTime, row.NextFundingTime.PositiveMs())
		if intervalHours == nil || !row.FundingRate.OK {
			continue
		}

		// No instrument row means no declaration, which is crypto like every other undeclared
		// market.
		instrument, hasInstrument := instrumentByID[row.InstID]
		base := adapters.MarketRefFor(VenueID, row.InstID, adapters.Overrides{}).Base
		class := AssetClassFor(instrument.InstCategory, base)
		ref := adapters.MarketRefFor(VenueID, row.InstID, adapters.Overrides{AssetClass: &class})

		var contractUSD *float64
		if hasInstrument {
			contractUSD = ContractNotionalUSD(instrument, markByID)
		}
		ticker := tickerByID[row.InstID]

		var markPrice *float64
		if mark, known := markByID[row.InstID]; known {
			markPrice = mark.MarkPx.Ptr()
		}
		var volume *float64
		if _, known := tickerByID[row.InstID]; known {
			volume = adapters.Mul(ticker.VolCcy24h.Ptr(), ticker.Last.Ptr())
		}
		var openInterestUSD *float64
		if oi, known := oiByID[row.InstID]; known {
			openInterestUSD = oi.OiUsd.Ptr()
		}

		interval := *intervalHours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:     ref,
			ObservedAt:    now,
			Rate:          row.FundingRate.Val,
			BasisHours:    interval,
			IntervalHours: &interval,
			NextFundingAt: fundingTime,
			Kind:          core.KindPredicted,
			MarkPrice:     markPrice,
			IndexPrice:    nil,
			BestBid:       ticker.BidPx.Ptr(),
			// Sizes are CONTRACTS: 504.48 contracts of BTC-USDT is 5.04 BTC, about $392k. Reading
			// it as 504 of anything would be four orders of magnitude out.
			BestBidSizeUSD:  adapters.Mul(ticker.BidSz.Ptr(), contractUSD),
			BestAsk:         ticker.AskPx.Ptr(),
			BestAskSizeUSD:  adapters.Mul(ticker.AskSz.Ptr(), contractUSD),
			OpenInterestUSD: openInterestUSD,
			Volume24hUSD:    volume,
		})

		settledAt := row.PrevFundingTime.PositiveMs()
		state := row.SettState
		if state == "" {
			state = "settled"
		}
		if settledAt != nil && row.SettFundingRate.OK && state == "settled" {
			basis := interval
			if measured := adapters.HoursBetween(settledAt, fundingTime); measured != nil {
				basis = *measured
			}
			settled = append(settled, core.FundingEvent{
				MarketRef:  ref,
				SettledAt:  *settledAt,
				Rate:       row.SettFundingRate.Val,
				BasisHours: basis,
				MarkPrice:  nil,
			})
		}
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}, nil
}

// ParseFundingHistory returns settled events oldest first, preferring RealizedRate — what was
// actually charged — over the period's quoted rate.
func ParseFundingHistory(env Envelope[FundingHistoryItem], fallbackHours float64) ([]core.FundingEvent, error) {
	rows, err := env.unwrap("funding history")
	if err != nil {
		return nil, err
	}

	type point struct {
		instID    string
		settledAt int64
		rate      float64
	}
	points := make([]point, 0, len(rows))
	for _, item := range rows {
		at := item.FundingTime.PositiveMs()
		rate := item.RealizedRate
		if !rate.OK {
			rate = item.FundingRate
		}
		if at == nil || !rate.OK {
			continue
		}
		points = append(points, point{item.InstID, *at, rate.Val})
	}
	sort.SliceStable(points, func(i, j int) bool { return points[i].settledAt < points[j].settledAt })

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
			MarketRef:  adapters.MarketRefFor(VenueID, p.instID, adapters.Overrides{}),
			SettledAt:  p.settledAt,
			Rate:       p.rate,
			BasisHours: basisHours,
			MarkPrice:  nil,
		})
	}
	return events, nil
}

// ParsePositionTiers converts OKX position tiers into USD-bounded ladders, one per instrument.
//
// OKX BOUNDS TIERS IN CONTRACTS, NOT NOTIONAL. BTC-USDT-SWAP is 0.01 BTC a contract, so tier 1's
// maxSz of 1000 is 10 BTC — about $780k — and not $1,000. Reading those numbers as dollars would
// put the first leverage step three orders of magnitude too low.
//
// Ladders are published per FAMILY, so every instrument in a family shares one ladder but converts
// it with its own contract value. Bounds become half-open: each band ends where the next begins,
// since OKX's inclusive [0, 1000] then [1000.01, 5000] would otherwise leave a gap that resolves to
// no tier. The last band keeps its own maxSz, a real cap on position size.
func ParsePositionTiers(
	instruments Envelope[Instrument],
	tiers Envelope[PositionTier],
	markPrices Envelope[MarkPrice],
) ([]core.LeverageTier, error) {
	markRows, err := markPrices.unwrap("mark price")
	if err != nil {
		return nil, err
	}
	tierRows, err := tiers.unwrap("position tiers")
	if err != nil {
		return nil, err
	}
	instrumentRows, err := instruments.unwrap("instruments")
	if err != nil {
		return nil, err
	}

	markByID := byInstID(markRows, func(m MarkPrice) string { return m.InstID })
	rowsByFamily := make(map[string][]PositionTier, len(tierRows))
	for _, row := range tierRows {
		rowsByFamily[row.InstFamily] = append(rowsByFamily[row.InstFamily], row)
	}

	ladders := make([]core.LeverageTier, 0, len(tierRows))
	for _, instrument := range instrumentRows {
		if !perpInstID.MatchString(instrument.InstID) {
			continue
		}
		rows := rowsByFamily[instrument.InstFamily]
		if len(rows) == 0 {
			continue
		}
		// A linear ladder with no mark is dropped rather than converted against nothing.
		contractUSD := ContractNotionalUSD(instrument, markByID)
		if contractUSD == nil {
			continue
		}

		sorted := make([]PositionTier, len(rows))
		copy(sorted, rows)
		sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Tier.Val < sorted[j].Tier.Val })

		ladder := make([]core.LeverageTier, 0, len(sorted))
		usable := true
		for i, row := range sorted {
			// The band ends where the next begins; the top band keeps the venue's own cap.
			upper := row.MaxSz
			if i+1 < len(sorted) {
				upper = sorted[i+1].MinSz
			}
			if !row.Tier.OK || !row.MinSz.OK || !upper.OK || upper.Val <= row.MinSz.Val ||
				!row.IMR.OK || row.IMR.Val <= 0 || !row.MaxLever.OK || row.MaxLever.Val <= 0 {
				// As on Bybit, an unreadable tier drops the WHOLE ladder: keeping the rest would
				// stretch a neighbouring band across the gap and quote confident margin for a range
				// nothing verified.
				usable = false
				break
			}
			upperUSD := upper.Val * *contractUSD
			ladder = append(ladder, core.LeverageTier{
				VenueID:          VenueID,
				VenueSymbol:      instrument.InstID,
				Tier:             int(row.Tier.Val),
				LowerNotionalUSD: row.MinSz.Val * *contractUSD,
				UpperNotionalUSD: &upperUSD,
				IMR:              row.IMR.Val,
				MMR:              row.MMR.Ptr(),
				MaxLeverage:      row.MaxLever.Val,
			})
		}
		if usable {
			ladders = append(ladders, ladder...)
		}
	}
	return ladders, nil
}

// ParseLiquidations normalises OKX's forced closes.
//
// Three differences from Gate, each of which would be a bug if carried across:
//   - PosSide names the liquidated position outright, so there is no sign to interpret.
//   - Ts is ALREADY epoch milliseconds; multiplying by 1000 would place every record in the year
//     58,000 and silently drop it from every window the study asks for.
//   - Sz is contracts, converted with the instrument's own ctVal — and for inverse swaps
//     (CtValCcy "USD") the contract is already dollars, so the mark must NOT be applied. Inverse
//     families do produce liquidations, so that branch is live.
func ParseLiquidations(
	rows []LiquidationRow,
	instruments map[string]Instrument,
	marks map[string]MarkPrice,
) []core.Liquidation {
	out := make([]core.Liquidation, 0, len(rows))
	for _, row := range rows {
		var contractUSD *float64
		if instrument, known := instruments[row.InstID]; known {
			contractUSD = ContractNotionalUSD(instrument, marks)
		}

		for _, detail := range row.Details {
			at := detail.Ts.PositiveMs()
			if !detail.Sz.OK || detail.Sz.Val <= 0 || !detail.BkPx.OK || detail.BkPx.Val <= 0 || at == nil {
				continue
			}
			if detail.PosSide != "long" && detail.PosSide != "short" {
				continue
			}

			var notional *float64
			if contractUSD != nil {
				// contractUSD already folds in ctVal, ctMult and the inverse/linear distinction.
				usd := detail.Sz.Val * *contractUSD
				notional = &usd
			}
			out = append(out, core.Liquidation{
				MarketRef:     adapters.MarketRefFor(VenueID, row.InstID, adapters.Overrides{}),
				LiquidatedAt:  *at,
				Side:          detail.PosSide,
				SizeContracts: detail.Sz.Val,
				FillPrice:     detail.BkPx.Val,
				NotionalUSD:   notional,
			})
		}
	}
	return out
}
