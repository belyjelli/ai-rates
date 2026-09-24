package velocity

import (
	"context"
	"math"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Liquidations come from GET /stats/liquidations: public, newest first, up to 20 per page with 31 days
// behind it (Drift's records, under the Velocity name). Captured 2026-09-24:
//
//	{"ts":1790172693,"liquidationType":"liquidatePerp","liquidatePerp_marketIndex":0,
//	 "liquidatePerp_oraclePrice":"114.594873","liquidatePerp_baseAssetAmount":"-15.740000000",
//	 "liquidatePerp_quoteAssetAmount":"1803.723301", ...}
//
// SIDE: baseAssetAmount IS THE CHANGE TO THE LIQUIDATED POSITION, the closing trade: negative closed a
// LONG, positive a SHORT. Confirmed on the record above: its fill (fillRecordId 1782) shows the
// liquidated user as the taker with takerOrderDirection "short" and an existing long entry.
//
// Only liquidatePerp rows are perp liquidations; spot and perp market indexes overlap, so the type is
// checked before the index is read. The venue is quiet — 13 liquidations in 30 days — so each poll
// reads the newest page and lets the store's key absorb what it has already seen.
type LiquidationRecord struct {
	Ts              int64        `json:"ts"`
	LiquidationType string       `json:"liquidationType"`
	MarketIndex     *int         `json:"liquidatePerp_marketIndex"`
	OraclePrice     adapters.Num `json:"liquidatePerp_oraclePrice"`
	BaseAmount      adapters.Num `json:"liquidatePerp_baseAssetAmount"`
	QuoteAmount     adapters.Num `json:"liquidatePerp_quoteAssetAmount"`
}

type LiquidationsResponse struct {
	Success bool                `json:"success"`
	Records []LiquidationRecord `json:"records"`
}

// ParseLiquidations names each perp liquidation by its market's symbol, as the funding snapshots do.
func ParseLiquidations(records []LiquidationRecord, markets []Market) []core.Liquidation {
	perp := map[int]string{}
	for _, market := range markets {
		if strings.EqualFold(market.MarketType, "perp") && market.Symbol != "" {
			perp[market.MarketIndex] = market.Symbol
		}
	}
	out := make([]core.Liquidation, 0, len(records))
	for _, record := range records {
		if record.LiquidationType != "liquidatePerp" || record.MarketIndex == nil || record.Ts <= 0 {
			continue
		}
		symbol, known := perp[*record.MarketIndex]
		if !known || !record.BaseAmount.OK || record.BaseAmount.Val == 0 {
			continue
		}
		size := math.Abs(record.BaseAmount.Val)
		notional := math.Abs(record.QuoteAmount.Val)
		price := notional / size
		if !record.QuoteAmount.OK || notional == 0 {
			if !record.OraclePrice.OK || record.OraclePrice.Val <= 0 {
				continue
			}
			price = record.OraclePrice.Val
			notional = size * price
		}
		side := "long" // the position was reduced by selling
		if record.BaseAmount.Val > 0 {
			side = "short"
		}
		out = append(out, core.Liquidation{
			MarketRef:     ref(symbol),
			LiquidatedAt:  record.Ts * 1000,
			Side:          side,
			SizeContracts: size,
			FillPrice:     price,
			NotionalUSD:   &notional,
		})
	}
	return out
}

// FetchLiquidations reads the newest page of liquidations and the market list that names them.
func (a *Adapter) FetchLiquidations(ctx context.Context) ([]core.Liquidation, bool, error) {
	var markets MarketsResponse
	if err := a.client.GetJSON(ctx, baseURL+"/stats/markets", &markets); err != nil {
		return nil, false, err
	}
	if markets.Markets == nil {
		return nil, false, ErrUnexpectedMarkets
	}
	var body LiquidationsResponse
	if err := a.client.GetJSON(ctx, baseURL+"/stats/liquidations", &body); err != nil {
		return nil, false, err
	}
	return ParseLiquidations(body.Records, *markets.Markets), true, nil
}
