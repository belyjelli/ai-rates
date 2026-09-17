package binancefapi

// Taker flow for Binance, from /fapi/v1/klines at 5m.
//
// A kline row is [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades,
// takerBuyBase, takerBuyQuote, ignore]. Taker BUY is published directly in quote (USDT or USDC);
// taker SELL is the rest of the bar's quote volume, because every fill has exactly one aggressor.
//
// Measured 2026-09-17 against the live API:
//
//   - STAMPED AT THE START. openTime is the bucket start and closeTime is start+299,999ms; the bar
//     for the bucket in progress is already listed (at 15:42:35Z the newest openTime was 15:40:00Z
//     with part of its volume). `startTime` is inclusive: startTime=1789658100000 returns that bar
//     first.
//   - DEPTH. A 5m request from 2026-08-07 (41 days back) answered, so the 7-day backfill is well
//     inside what the venue keeps.
//   - WEIGHT GROWS WITH `limit`, read off x-mbx-used-weight-1m: limit 99 cost 1, 500 cost 2,
//     1000 cost 5, 1001 and 1500 cost 10. Seven days is 2,016 bars, so pages of 1000 (3 pages,
//     weight 15) are cheaper than pages of 1500 (2 pages, weight 20), and the steady-state request
//     for the last few bars asks for exactly what it needs and costs 1.

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// klinesPage is the widest page before the weight doubles; see above.
	klinesPage = 1000
	// klinesMaxPages bounds one market's fetch: 7 days is 3 pages, so this is headroom only.
	klinesMaxPages = 12

	// TakerFlowPace spaces kline requests. Binance allows 2,400 weight a minute per IP. The snapshot
	// loop spends roughly 170 of it (premiumIndex, ticker/24hr, fundingInfo and ~120 single-symbol
	// openInterest reads). At 300ms a backfill running flat out on weight-5 pages spends
	// 200 x 5 = 1,000 a minute, so the two together stay near half the allowance, and a cold start of
	// ~150 markets x 3 pages finishes in a little over two minutes.
	TakerFlowPace = 300 * time.Millisecond
)

// BinanceAdapter is the Binance member with the one endpoint the rest of the family is not known to
// serve correctly: taker flow from klines.
//
// A separate type rather than a method on Adapter because the collector discovers side tasks by
// type assertion. A method on the shared Adapter would hand Aster, WEEX and Bullet a taker-flow task
// too, polling endpoints nobody has verified against migration 023 -- and taker_flow only has a
// contract for four venues.
type BinanceAdapter struct {
	*Adapter
	takerPacer *adapters.Pacer
}

// FetchTakerFlow returns taker buy and sell per 5-minute bucket for buckets starting in
// [fromMs, toMs], paging forward.
func (b *BinanceAdapter) FetchTakerFlow(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.TakerFlow, error) {
	start := core.TakerFlowBucketStart(fromMs)
	flows := make([]core.TakerFlow, 0, 16)

	for page := 0; page < klinesMaxPages && start <= toMs; page++ {
		limit := int((toMs-start)/core.TakerFlowBucketMs) + 1
		limit = max(1, min(limit, klinesPage))

		if err := b.takerPacer.Wait(ctx); err != nil {
			return nil, err
		}
		var rows []KlineRow
		endpoint := fmt.Sprintf("/klines?symbol=%s&interval=5m&startTime=%d&limit=%d",
			url.QueryEscape(venueSymbol), start, limit)
		if err := b.get(ctx, endpoint, &rows); err != nil {
			return nil, err
		}
		batch := ParseKlineTakerFlow(b.opts.VenueID, venueSymbol, rows, fromMs, toMs)
		flows = append(flows, batch...)
		if len(rows) < limit {
			break
		}
		newest := int64(0)
		for _, row := range rows {
			if at := row.openTime(); at > newest {
				newest = at
			}
		}
		if newest < start {
			break // a page that does not advance would loop forever
		}
		start = newest + core.TakerFlowBucketMs
	}
	return flows, nil
}

// KlineRow is one /klines array. Elements are numbers or quoted numbers; Num reads both, and a
// field Binance appends later is simply an element nobody indexes.
type KlineRow []adapters.Num

const (
	klineOpenTime      = 0
	klineClose         = 4
	klineQuoteVolume   = 7
	klineTakerBuyQuote = 10
)

func (r KlineRow) field(i int) adapters.Num {
	if i >= len(r) {
		return adapters.Num{}
	}
	return r[i]
}

func (r KlineRow) openTime() int64 {
	at := r.field(klineOpenTime).PositiveMs()
	if at == nil {
		return 0
	}
	return *at
}

// ParseKlineTakerFlow converts kline rows to taker flow for buckets starting in [fromMs, toMs].
//
// sell = quoteVolume - takerBuyQuote, clamped at zero: the two are rounded independently, and on a
// bar where every fill was a taker buy the difference can come out a hair negative, which the
// table's CHECK would reject along with the whole batch. A row missing either volume is skipped
// rather than read as zero -- zero is a real reading of a quiet bar, and a guessed one would draw a
// flat line through a gap.
func ParseKlineTakerFlow(venueID, venueSymbol string, rows []KlineRow, fromMs, toMs int64) []core.TakerFlow {
	flows := make([]core.TakerFlow, 0, len(rows))
	for _, row := range rows {
		at := row.openTime()
		quote, takerBuy := row.field(klineQuoteVolume), row.field(klineTakerBuyQuote)
		if at == 0 || !quote.OK || !takerBuy.OK {
			continue
		}
		bucket := core.TakerFlowBucketStart(at)
		if bucket < core.TakerFlowBucketStart(fromMs) || bucket > toMs {
			continue
		}
		var closePrice *float64
		if c := row.field(klineClose); c.OK && c.Val > 0 {
			closePrice = c.Ptr()
		}
		flows = append(flows, core.TakerFlow{
			VenueID:     venueID,
			VenueSymbol: venueSymbol,
			BucketStart: bucket,
			BuyUSD:      max(0, takerBuy.Val),
			SellUSD:     max(0, quote.Val-takerBuy.Val),
			ClosePrice:  closePrice,
		})
	}
	return flows
}

// newBinanceAdapter wires the Binance member. Kept beside the taker-flow code so the pacer's
// construction and its constant are read together.
func newBinanceAdapter(client *httpclient.Client, opts Options) *BinanceAdapter {
	return &BinanceAdapter{Adapter: NewAdapter(client, opts), takerPacer: adapters.NewPacer(TakerFlowPace)}
}
