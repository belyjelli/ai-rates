package bitget

// Taker flow for Bitget, from /api/v2/mix/market/taker-buy-sell at period=5m, priced by
// /api/v2/mix/market/candles at the same granularity.
//
// taker-buy-sell reports buyVolume and sellVolume in BASE COIN, so each bucket needs a price. The
// candle for the same bucket supplies it: buy_usd = buyVolume x that candle's close.
//
// Measured 2026-09-17 against the live API, BTCUSDT:
//
//   - STAMPED AT THE START, and exactly the candle's bucket. buyVolume + sellVolume equals the
//     candle's baseVol for the same ts to the fourth decimal on every completed bucket compared
//     (e.g. 1789659300000: 71.2925 + 51.5424 = 122.8349 on both), and the bucket in progress is
//     already listed with a partial figure. Candle ts is the bucket start: the in-progress candle
//     opens at the previous one's close. Across 26 buckets, buy imbalance against Binance klines
//     correlated +0.56 aligned by openTime, against -0.40 and +0.31 a bucket off.
//   - ONLY THE LAST 30 BUCKETS, WHATEVER IS ASKED. limit=2, 500 and 1000, startTime, endTime, and
//     both together, even a window a week back, all returned the same newest 30 rows (2.5 hours),
//     oldest first. There is NO backfill on Bitget: a market's history starts when this collector
//     first polls it, and an outage longer than 2.5 hours leaves a gap nothing can fill.
//   - RATE LIMIT. Bitget's public market endpoints allow 20 a second (see MinInterval), but a burst
//     on taker-buy-sell at ~4.3 a second got HTTP 429 {"code":"429"} on the 8th request, so this
//     endpoint is limited far more tightly than the headers suggest (x-mbx-used-remain-limit read 0
//     throughout, so it is no guide here).
//   - USDC BOOKS HAVE NO DATA. BTCPERP and ETHPERP answer code 40054 "The data fetched by BTCPERP
//     is empty".
//   - CANDLE BOUNDS. startTime is exclusive of a bucket stamped exactly on it and endTime is
//     inclusive: startTime=1789651200000 began at 1789651500000, startTime=1789651199999 at
//     1789651200000.

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	// TakerFlowPace spaces taker-buy-sell requests at one a second, a quarter of the rate that drew
	// a 429. Since no history is reachable, a sweep is one taker call and one candle call a market:
	// ~100 markets in under two minutes, inside the 5-minute cadence and the 30-bucket window.
	TakerFlowPace = time.Second

	// takerCandlesLimit covers the 30 buckets taker-buy-sell returns, with room.
	takerCandlesLimit = 100
)

// TakerBuySell is one taker-buy-sell row. Volumes are BASE COIN.
type TakerBuySell struct {
	BuyVolume  adapters.Num `json:"buyVolume"`
	SellVolume adapters.Num `json:"sellVolume"`
	TS         adapters.Num `json:"ts"`
}

// Candle is one candles row: [ts, open, high, low, close, baseVol, quoteVol].
type Candle []adapters.Num

const (
	candleTS    = 0
	candleClose = 4
)

func (c Candle) field(i int) adapters.Num {
	if i >= len(c) {
		return adapters.Num{}
	}
	return c[i]
}

// FetchTakerFlow returns taker buy and sell per 5-minute bucket for buckets starting in
// [fromMs, toMs]. Whatever fromMs asks for, only the last 30 buckets exist; see above.
//
// A USDC book (a `…PERP` symbol) returns nothing without a request, since the venue has no data for
// it and asking would log the same error every five minutes.
func (a *Adapter) FetchTakerFlow(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.TakerFlow, error) {
	if strings.HasSuffix(venueSymbol, "PERP") {
		return nil, nil
	}

	if err := a.takerPace.Wait(ctx); err != nil {
		return nil, err
	}
	var taker Envelope[TakerBuySell]
	if err := a.get(ctx, fmt.Sprintf("/api/v2/mix/market/taker-buy-sell?symbol=%s&period=5m",
		url.QueryEscape(venueSymbol)), &taker); err != nil {
		return nil, err
	}
	rows, err := taker.unwrap("taker buy sell")
	if err != nil {
		return nil, err
	}

	first, last := int64(0), int64(0)
	for _, row := range rows {
		at := row.TS.PositiveMs()
		if at == nil {
			continue
		}
		bucket := core.TakerFlowBucketStart(*at)
		if bucket < core.TakerFlowBucketStart(fromMs) || bucket > toMs {
			continue
		}
		if first == 0 || bucket < first {
			first = bucket
		}
		last = max(last, bucket)
	}
	if first == 0 {
		return nil, nil
	}

	var candles Envelope[Candle]
	if err := a.get(ctx, fmt.Sprintf(
		"/api/v2/mix/market/candles?symbol=%s&productType=usdt-futures&granularity=5m&startTime=%d&endTime=%d&limit=%d",
		url.QueryEscape(venueSymbol), first-1, last, takerCandlesLimit), &candles); err != nil {
		return nil, err
	}
	candleRows, err := candles.unwrap("candles")
	if err != nil {
		return nil, err
	}
	return ParseTakerBuySell(venueSymbol, rows, candleRows, fromMs, toMs), nil
}

// ParseTakerBuySell prices taker-buy-sell rows with the candle of the same bucket, for buckets
// starting in [fromMs, toMs].
//
// A bucket with no candle, or a candle without a positive close, is SKIPPED rather than priced from
// a neighbour: the next sweep re-reads it, and a guessed price would be indistinguishable from a real
// one once stored.
func ParseTakerBuySell(venueSymbol string, rows []TakerBuySell, candles []Candle, fromMs, toMs int64) []core.TakerFlow {
	closes := make(map[int64]float64, len(candles))
	for _, candle := range candles {
		at, closePrice := candle.field(candleTS).PositiveMs(), candle.field(candleClose)
		if at == nil || !closePrice.OK || closePrice.Val <= 0 {
			continue
		}
		closes[core.TakerFlowBucketStart(*at)] = closePrice.Val
	}

	flows := make([]core.TakerFlow, 0, len(rows))
	for _, row := range rows {
		at := row.TS.PositiveMs()
		if at == nil || !row.BuyVolume.OK || !row.SellVolume.OK || row.BuyVolume.Val < 0 || row.SellVolume.Val < 0 {
			continue
		}
		bucket := core.TakerFlowBucketStart(*at)
		if bucket < core.TakerFlowBucketStart(fromMs) || bucket > toMs {
			continue
		}
		price, priced := closes[bucket]
		if !priced {
			continue
		}
		flows = append(flows, core.TakerFlow{
			VenueID:     VenueID,
			VenueSymbol: venueSymbol,
			BucketStart: bucket,
			BuyUSD:      row.BuyVolume.Val * price,
			SellUSD:     row.SellVolume.Val * price,
			ClosePrice:  &price,
		})
	}
	return flows
}
