// Package perpl parses Perpl (Monad), the public REST at https://app.perpl.xyz/api/v1.
//
// Ported from packages/adapters/src/venues/perpl.ts and pinned to the same fixture
// (packages/adapters/__fixtures__/perpl) and the same expected values as perpl.test.ts, so the Go
// and TypeScript parsers cannot drift apart while both are collecting.
//
// Measured from this machine on 2026-09-13 22:29-22:45 UTC, against https://docs.perpl.xyz/llms-full.txt
// and the app's own bundle (https://app.perpl.xyz/assets/index-*.js).
//
// REQUESTS: one per cycle, `GET /pub/context` (11.6 KB). It carries every market's config, live state
// (mark, oracle, OI, 24h volume) and latest funding event, so nothing else is needed. The catalog's
// "10 req/min" is the WebSocket; the REST reference gives "REST public ~100 req/min" for `/api/v1/pub/*`
// and the response is served `cache-control: max-age=10`. One call a minute is a hundredth of the
// budget, so there is no skipping of cycles. No REST endpoint publishes market funding history (the
// only funding history is the signed, per-account `/trading/account-history`), so there is no
// FetchFundingHistory: history accrues forward from the settled events below.
//
// FUNDING — what `funding` is. The docs define no REST or WebSocket shape for it ("MarketFundingUpdate
// ... payload shapes are not defined"), so the fields are read the way the app reads them:
// `fundingRateValue: rate, fundingIndexPrice: idx, fundingSum: sum, fundingSumDivider: div,
// fundingBlock: feb`, with the next event at `feb + funding_interval_blocks`. `funding.at.b` equals
// `feb`, and the object describes one event, with `sum` already including it. Polled every 20s
// across the 22:36:40 UTC event, the object switched once, at the event, and was then constant; it
// first showed while the chain head was 16 blocks (~5s) short of the event block. The docs say the
// rate is "set at a fixed time prior to the funding event" and "can be set up to 143 blocks in advance
// (1 minute)", so a forecast is visible for at most a minute before each event. What REST shows is
// the applied rate: snapshots are KindSettled, and each is also returned as a settled event.
// `funding.at.t` read 1789339000946 once and 1789339000000 afterwards for the same event, so the
// settlement time is floored to whole seconds, or one event would be stored twice.
//
// FUNDING — the scale. `rate` is micros (1e-6) of the index price per funding event:
//   - the contract's `FundingEventCompleted` carries `actualRatePct100k`, `fundingPricePNS` and
//     `fundingPaymentPNS`, and `ppl` is that payment: on every market `ppl = idx x rate x 1e-6 x div`,
//     truncated (BTC 773,036 x 40e-6 = 30.9 -> 30; ETH 250,899 x -40e-6 = -10.0 -> -10, then
//     248,018 x -20e-6 = -4.96 -> -4; LIT x div 10 -> -170; MON x div 100 -> 92);
//   - the app values premium PnL as (entry sum - current sum) x size / div, in price units, and across
//     the 22:36 event `sum` moved by that event's `ppl` (BTC -40,179 -> -40,149, ETH 1,013 -> 1,009).
//     So a BTC long paid 3.0 USD per BTC at an index of 76,801.7: 3.9e-5, i.e. 40 micros.
//
// Positive means longs pay: a positive rate gives a positive `ppl`, `sum` rises by it, and a rising sum
// is a loss to longs in the app's formula. The rate moves in coarse steps of 10 micros: across 24
// reads on 2026-09-13 every market read -40, -20, 0, +10 or +40.
// Cross-check with Hyperliquid at 22:39 UTC: BTC +40 micros per 43 min is 5.6e-5/h here against
// 1.25e-5/h there, ETH -5.6e-5/h against +1.25e-5/h. The same order of magnitude, with Perpl's rate
// sitting at its clamp; a 1e6 error would read 40 (4,000%) or 4e-11.
//
// FUNDING — the interval. `funding_interval_sec` is 2580 on every market and is what the app counts
// down. Events are really 8,571 blocks apart (`funding_interval_blocks`; the docs' "approximately once
// per hour" assumes 0.42s blocks, Monad runs ~0.31s): the 22:36:40 event came 8,571 blocks and 2,632s
// after the one before, 2% longer than declared. The declared 2580s = 0.7167h is used as basis and
// interval, and NextFundingAt is one declared interval after the last event, so it runs about a
// minute early.
//
// UNITS. Prices are integers over 10^`price_decimals`; `oi` and `dv` over 10^`size_decimals`
// (BTC oi 1,086,858 = 10.87 BTC). `dva`, the day's volume "amount", is in the collateral token's own
// decimals: BTC 291,977,473,222,361 / 1e6 = $291.98M against dv 3,786.23 BTC x ~77,000, and ETH
// 2,335,278,221,490 / 1e6 = $2.34M against 936 ETH x 2,480, where price+size decimals would be 1e5.
// Mark is `mrk`, index is `orl` (the oracle), and OI x mark is USD.
//
// TRADABILITY: `config.is_open`. QUOTE: the instance's collateral token, AUSD. CLASS: Perpl declares
// none, and its eight markets are crypto. BASE: `name` (BTC, MON, ETH ...) parses as itself; `symbol`
// is empty on BTC and MON.
package perpl

import (
	"math"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const VenueID = "perpl"

const (
	// micros is the unit `rate` is quoted in: 1e-6 of the index price per funding event.
	micros = 1e-6
	hourMs = 3_600_000.0
)

// Timestamp is Perpl's "when", which it states both as a block and as a wall clock.
type Timestamp struct {
	// B is the block number.
	B int64 `json:"b"`
	// T is epoch MILLISECONDS, and is served with and without its milliseconds for the same event;
	// see the package header.
	T adapters.Num `json:"t"`
}

type Token struct {
	ID       int    `json:"id"`
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
}

type Instance struct {
	ID                int `json:"id"`
	CollateralTokenID int `json:"collateral_token_id"`
}

// MarketConfig carries tradability and the per-market scales. A market that omits it decodes to
// IsOpen false and is skipped, which is what `!market.config?.is_open` does on the TypeScript side.
type MarketConfig struct {
	IsOpen bool `json:"is_open"`
	// PriceDecimals scales `orl` and `mrk`; SizeDecimals scales `oi` and `dv`. They differ per
	// market: BTC is 1 and 5, MON is 6 and 0.
	PriceDecimals int `json:"price_decimals"`
	SizeDecimals  int `json:"size_decimals"`
}

type MarketState struct {
	At Timestamp `json:"at"`
	// Orl is the oracle (index) price, price-scaled.
	Orl adapters.Num `json:"orl"`
	// Mrk is the mark price, price-scaled.
	Mrk adapters.Num `json:"mrk"`
	// Oi is open interest, size-scaled.
	Oi adapters.Num `json:"oi"`
	// Dva is 24h volume in the COLLATERAL TOKEN's decimals, not this market's: BTC's
	// 291,977,473,222,361 is $291.98M over AUSD's 1e6, where price+size decimals would be 1e5.
	Dva adapters.Num `json:"dva"`
}

type Funding struct {
	At Timestamp `json:"at"`
	// Feb is the block of the funding event this describes; it equals At.B.
	Feb int64 `json:"feb"`
	// Rate is MICROS (1e-6) of the index price per funding event, not a fraction.
	Rate adapters.Num `json:"rate"`
	// Idx is the index price at the event, price-scaled.
	Idx adapters.Num `json:"idx"`
}

type Market struct {
	ID         int    `json:"id"`
	InstanceID int    `json:"instance_id"`
	Name       string `json:"name"`
	// FundingIntervalSec is 2580 on every market and is what the app counts down.
	FundingIntervalSec adapters.Num `json:"funding_interval_sec"`
	// FundingIntervalBlocks is the real spacing (8,571 blocks); a pointer because it is optional in
	// the venue's shape and an absent one is not a zero-block interval.
	FundingIntervalBlocks *int64       `json:"funding_interval_blocks"`
	Config                MarketConfig `json:"config"`
	State                 MarketState  `json:"state"`
	// Funding is a pointer because a market can be listed with no funding event yet, and that is
	// not an event with a zero rate.
	Funding *Funding `json:"funding"`
}

// Context is the whole of `GET /pub/context` that this adapter reads.
//
// The three lists are POINTERS to slices so that absent and empty stay distinguishable: an error
// body ({"error":"rate limited"}) leaves them nil and must fail the cycle, while a venue that really
// lists no markets yet is an empty page and not a failure. That is what `Array.isArray` guards on the
// TypeScript side.
type Context struct {
	Instances *[]Instance `json:"instances"`
	Tokens    *[]Token    `json:"tokens"`
	Markets   *[]Market   `json:"markets"`
}

// scaled divides an integer field by 10^decimals, keeping absent absent.
func scaled(value adapters.Num, decimals int) *float64 {
	if !value.OK {
		return nil
	}
	v := value.Val / math.Pow(10, float64(decimals))
	return &v
}

// ParseContext normalises one `/pub/context` body.
//
// Every snapshot is KindSettled and is also emitted as a settled event: what REST publishes is the
// rate already applied at the last event, never a forecast for the next one.
func ParseContext(ctx Context, now int64) core.SnapshotBatch {
	tokens := map[int]Token{}
	if ctx.Tokens != nil {
		for _, token := range *ctx.Tokens {
			tokens[token.ID] = token
		}
	}
	// Instance -> its collateral token, which is the quote currency and the decimals `dva` is in.
	collateral := map[int]*Token{}
	if ctx.Instances != nil {
		for _, instance := range *ctx.Instances {
			if token, known := tokens[instance.CollateralTokenID]; known {
				copied := token
				collateral[instance.ID] = &copied
				continue
			}
			collateral[instance.ID] = nil
		}
	}

	var markets []Market
	if ctx.Markets != nil {
		markets = *ctx.Markets
	}
	snapshots := make([]core.FundingSnapshot, 0, len(markets))
	settled := make([]core.FundingEvent, 0, len(markets))

	for _, market := range markets {
		funding := market.Funding
		var rateMicros, eventMs adapters.Num
		if funding != nil {
			rateMicros = funding.Rate
			eventMs = funding.At.T
		}
		// The same event is served with and without its milliseconds; see the header.
		settledAt := int64(0)
		if eventMs.OK {
			settledAt = int64(math.Floor(eventMs.Val/1000)) * 1000
		}
		intervalSec := market.FundingIntervalSec
		if !market.Config.IsOpen ||
			funding == nil ||
			!rateMicros.OK ||
			!eventMs.OK ||
			settledAt <= 0 ||
			!intervalSec.OK ||
			intervalSec.Val <= 0 {
			continue
		}

		token := collateral[market.InstanceID]
		// Perpl declares no asset class; every market it lists is crypto. It also declares no dex,
		// so the dex field is left to the symbol parser rather than overridden here.
		var quote *string
		if token != nil {
			symbol := token.Symbol
			quote = &symbol
		}
		ref := adapters.MarketRefFor(VenueID, market.Name, adapters.Overrides{Quote: quote, HasQuote: true})

		markPrice := scaled(market.State.Mrk, market.Config.PriceDecimals)
		openInterest := scaled(market.State.Oi, market.Config.SizeDecimals)
		hours := intervalSec.Val / 3600
		rate := rateMicros.Val * micros

		var volume24hUSD *float64
		if token != nil {
			volume24hUSD = scaled(market.State.Dva, token.Decimals)
		}

		// One declared interval after the last event. Rounded because the domain type is
		// milliseconds as an integer while the product is a float; 2580s lands exactly on
		// 2,580,000 ms either way.
		nextFundingAt := settledAt + int64(math.Round(hours*hourMs))
		interval := hours
		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       ref,
			ObservedAt:      now,
			Rate:            rate,
			BasisHours:      hours,
			IntervalHours:   &interval,
			NextFundingAt:   &nextFundingAt,
			Kind:            core.KindSettled,
			MarkPrice:       markPrice,
			IndexPrice:      scaled(market.State.Orl, market.Config.PriceDecimals),
			OpenInterestUSD: adapters.Mul(openInterest, markPrice),
			Volume24hUSD:    volume24hUSD,
		})
		settled = append(settled, core.FundingEvent{
			MarketRef:  ref,
			SettledAt:  settledAt,
			Rate:       rate,
			BasisHours: hours,
			MarkPrice:  nil,
		})
	}
	return core.SnapshotBatch{Snapshots: snapshots, Settled: settled}
}
