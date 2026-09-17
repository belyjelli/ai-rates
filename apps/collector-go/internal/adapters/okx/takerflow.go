package okx

// Taker flow for OKX, from /api/v5/rubik/stat/taker-volume-contract at period=5m, unit=2 (USD).
//
// Rows are [ts, sellVol, buyVol], NEWEST FIRST, already in USD. The response carries no price, so
// close_price is NULL for OKX (migration 023).
//
// Measured 2026-09-17 against the live API, BTC-USDT-SWAP:
//
//   - STAMPED AT THE START. At 15:42:45Z the newest row was ts 15:40:00Z holding $21.4M; by 15:46Z
//     the same row had grown to $50.6M and a row for 15:45:00Z had appeared. A row that keeps growing
//     for the five minutes after its ts is the bucket starting at ts. Its volume profile lines up
//     with Binance klines by openTime and not shifted by one: the 15:35 bucket is the spike on both
//     ($35.5M here, $72.9M on Binance) and the quiet 15:25 bucket is quiet on both. Over 97
//     buckets, volume correlated with Binance's at 0.936 aligned, against 0.568 and 0.600 a bucket
//     off, and buy imbalance at +0.61 aligned, which also confirms the third column is the BUY.
//   - IT PUBLISHES LATE AND IN STEPS. Sampled every 30 seconds for 12 minutes, a new row first
//     appeared 150-170 seconds into its bucket, the row grew about every 90 seconds, and the previous
//     row took its last update when the next one appeared, ~7.5 minutes after its own start. That is
//     why the sweep re-reads two buckets behind the newest stored.
//   - LIMIT IS 100 AND SILENTLY CAPPED. limit=300, 1000 and 1440 all returned exactly 100 rows, no
//     error. With no bounds, the newest 100 (8h20m).
//   - `begin` AND `end` ARE BOTH EXCLUSIVE. end=1789629900000 (exactly a bucket) returned newest
//     1789629600000; begin=1789629900000 returned oldest 1789630200000. With both set, the newest
//     100 inside the open interval come back, so paging walks backwards: end = oldest ts seen.
//   - DEPTH IS FIVE DAYS. The oldest row served was exactly 120 hours before the newest; an `end`
//     further back returns an empty list with code "0". The 7-day backfill therefore gets five days
//     on OKX, in 15 pages.
//   - RATE LIMIT 5 PER 2 SECONDS, per IP. A burst of nine got five HTTP 200s and then HTTP 429 with
//     {"code":"50011","msg":"Too Many Requests"}. Those failures would count toward the venue
//     client's circuit breaker and could stop the OKX snapshot loop, so the pace below is the guard.
//   - ONLY -USDT-SWAP. BTC-USDC-SWAP answers code 51001 "Instrument ID doesn't exist"; BTC-USD-SWAP
//     answers, but inverse contracts are out of scope for taker_flow.

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
	// takerVolumePage is the venue's cap; see above.
	takerVolumePage = 100
	// takerVolumeMaxPages bounds one market: five days is 15 pages, seven would be 21.
	takerVolumeMaxPages = 25

	// TakerFlowPace spaces rubik requests: 5 per 2 seconds is one per 400ms, and 500ms leaves room
	// for the venue's window not lining up with ours. A cold backfill of ~100 markets x 15 pages is
	// then about 12.5 minutes, once; every later sweep is one request a market.
	TakerFlowPace = 500 * time.Millisecond
)

// TakerVolumeRow is one [ts, sellVol, buyVol] row.
type TakerVolumeRow []adapters.Num

// FetchTakerFlow returns taker buy and sell per 5-minute bucket for buckets starting in
// [fromMs, toMs], paging backwards from toMs.
//
// A market that is not a USDT swap returns nothing without a request: rubik has no USDC swaps and
// inverse swaps are out of scope, so asking would only turn a known absence into a logged error
// every five minutes.
func (a *Adapter) FetchTakerFlow(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.TakerFlow, error) {
	if !strings.HasSuffix(venueSymbol, "-USDT-SWAP") {
		return nil, nil
	}
	from := core.TakerFlowBucketStart(fromMs)
	// Both bounds are exclusive, so step one millisecond outside each.
	begin, end := from-1, toMs+1

	flows := make([]core.TakerFlow, 0, 16)
	for page := 0; page < takerVolumeMaxPages && end > from; page++ {
		if err := a.takerPace.Wait(ctx); err != nil {
			return nil, err
		}
		var env Envelope[TakerVolumeRow]
		if err := a.get(ctx, fmt.Sprintf(
			"/api/v5/rubik/stat/taker-volume-contract?instId=%s&period=5m&unit=2&begin=%d&end=%d&limit=%d",
			url.QueryEscape(venueSymbol), begin, end, takerVolumePage), &env); err != nil {
			return nil, err
		}
		rows, err := env.unwrap("taker volume")
		if err != nil {
			return nil, err
		}
		flows = append(flows, ParseTakerVolume(venueSymbol, rows, fromMs, toMs)...)
		if len(rows) < takerVolumePage {
			break
		}
		oldest := end
		for _, row := range rows {
			if at := row.ts(); at > 0 && at < oldest {
				oldest = at
			}
		}
		if oldest >= end {
			break // a page that does not move backwards would loop forever
		}
		end = oldest
	}
	return flows, nil
}

func (r TakerVolumeRow) field(i int) adapters.Num {
	if i >= len(r) {
		return adapters.Num{}
	}
	return r[i]
}

func (r TakerVolumeRow) ts() int64 {
	at := r.field(0).PositiveMs()
	if at == nil {
		return 0
	}
	return *at
}

// ParseTakerVolume converts rubik rows to taker flow for buckets starting in [fromMs, toMs]. The
// columns are SELL then BUY, the reverse of what the endpoint's name suggests; swapping them would
// invert every delta. A row missing either figure, or carrying a negative one, is skipped rather
// than guessed.
func ParseTakerVolume(venueSymbol string, rows []TakerVolumeRow, fromMs, toMs int64) []core.TakerFlow {
	flows := make([]core.TakerFlow, 0, len(rows))
	for _, row := range rows {
		at := row.ts()
		sell, buy := row.field(1), row.field(2)
		if at == 0 || !sell.OK || !buy.OK || sell.Val < 0 || buy.Val < 0 {
			continue
		}
		bucket := core.TakerFlowBucketStart(at)
		if bucket < core.TakerFlowBucketStart(fromMs) || bucket > toMs {
			continue
		}
		flows = append(flows, core.TakerFlow{
			VenueID:     VenueID,
			VenueSymbol: venueSymbol,
			BucketStart: bucket,
			BuyUSD:      buy.Val,
			SellUSD:     sell.Val,
		})
	}
	return flows
}
