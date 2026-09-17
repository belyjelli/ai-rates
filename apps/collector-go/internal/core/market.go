// Package core holds the domain types and the normalisation rules every adapter shares.
//
// It is a port of packages/core in the TypeScript collector, and it is deliberately a PORT rather
// than a reimplementation: the rules here were derived from measured venue behaviour over months,
// and each one exists because getting it wrong produced a specific, recorded wrong number. Every
// function in this package is pinned to the same fixtures and the same expected values as its
// TypeScript twin (packages/adapters/__fixtures__), so the two cannot silently diverge.
//
// Where a comment says a figure was measured, the figure and its date come from the TypeScript
// source and the plans; it is repeated here because a reader of the Go code must not have to go
// find out why a rule exists before they are allowed to keep it.
package core

// FundingRateKind says how trustworthy a funding value is: an estimate for the next settlement, or
// an actual settlement that has been paid.
type FundingRateKind string

const (
	KindPredicted FundingRateKind = "predicted"
	KindSettled   FundingRateKind = "settled"
)

// AssetClass is what kind of underlying a market tracks. It is half of an asset's identity, with
// Base the other half: equity:STX (Seagate) and crypto:STX (Stacks) are different assets that must
// never pair, and no ticker rule can tell them apart because both are named correctly.
//
// Taken from what the venue declares, never inferred from the ticker. A venue that declares nothing
// is crypto, because that is what every such venue lists. Mirrored by the CHECK in migration 017.
type AssetClass string

const (
	ClassCrypto    AssetClass = "crypto"
	ClassEquity    AssetClass = "equity"
	ClassCommodity AssetClass = "commodity"
	ClassFX        AssetClass = "fx"
	ClassIndex     AssetClass = "index"
)

// MarketRef identifies one market on one venue.
//
// Quote and Dex are pointers because "no quote currency" and "not on a HIP-3 dex" are real, distinct
// states that must reach the database as NULL rather than as an empty string: migration 019 measured
// 350 live markets whose quote is genuinely unknown (Hyperliquid HIP-3 dexes and Lighter never set
// one), and pairing only within a known quote has to be able to exclude them.
type MarketRef struct {
	VenueID string
	// VenueSymbol is the symbol exactly as the venue names it ("BTCUSDT", "BTC-USDT-SWAP",
	// "xyz:XYZ100").
	VenueSymbol string
	Base        string
	AssetClass  AssetClass
	Quote       *string
	// Multiplier is contracts per unit of Base implied by the symbol (1000 for "1000PEPE").
	Multiplier float64
	// Dex is the Hyperliquid HIP-3 dex id, when the market lives on one.
	Dex *string
}

// FundingSnapshot is one market's funding and stats as observed at a point in time.
//
// The nullable numerics are pointers rather than zero values on purpose. Zero is a legitimate
// reading for several of these — a venue really can quote a zero funding rate, and migration 009
// found 85 markets settling exactly zero across a whole month — so conflating "absent" with "zero"
// would turn a missing field into a confident claim. That is the same distinction the TypeScript
// side draws with null, and the database draws with NULL.
type FundingSnapshot struct {
	MarketRef
	// ObservedAt is epoch milliseconds, matching the TypeScript collector's clock.
	ObservedAt int64
	// Rate is a fraction over BasisHours, with venue units already converted. Positive = longs pay.
	Rate float64
	// BasisHours is the period the rate is quoted over, which is not always the settlement
	// interval: GRVT and Paradex quote an 8h-normalised rate for markets that settle hourly.
	BasisHours float64
	// IntervalHours is the settlement interval when the venue reports it.
	IntervalHours *float64
	NextFundingAt *int64
	Kind          FundingRateKind
	MarkPrice     *float64
	IndexPrice    *float64

	// Best bid and ask, with the USD notional resting at each, when the venue publishes them in a
	// call we already make.
	//
	// Price and size travel together deliberately. Level 1 gives a spread quotable only at the size
	// shown, and a gap without the depth beside it reads as profit when it is a loss: ONE quoted
	// 269.6 bps against an OKX ask of two units.
	//
	// Depth is USD, not the venue's own size, because the venues do not agree on what a size is:
	// gate quotes contracts, okx quotes contracts against ctVal (15 of its swaps are inverse and
	// priced in USD), bybit quotes base coin. One BTC book reads 2776, 504.48 and 0.181 across the
	// three — printing those side by side is a 10,000x error on the one page whose purpose is
	// showing that a spread is too thin to trade. Each adapter converts where it already holds the
	// multiplier.
	BestBid         *float64
	BestBidSizeUSD  *float64
	BestAsk         *float64
	BestAskSizeUSD  *float64
	OpenInterestUSD *float64
	Volume24hUSD    *float64

	// MaxLeverage is the headline figure, so it holds only at small size; the tiered ladder is the
	// precise source. Carried on the snapshot only as transport to the markets table.
	MaxLeverage *float64
}

// FundingEvent is a settled funding payment for one market.
type FundingEvent struct {
	MarketRef
	// SettledAt is epoch milliseconds.
	SettledAt  int64
	Rate       float64
	BasisHours float64
	MarkPrice  *float64
}

// LeverageTier is one step of a venue's risk-limit ladder: the larger the position, the less
// leverage it may use.
//
// Bounds are USD notional, half-open [lower, upper), so the tier a size falls into is unambiguous
// at a boundary. A nil UpperNotionalUSD means the venue publishes no cap; where it publishes one
// (Bybit caps BTCUSDT at $1.2bn) that bound is real, and a size above every tier has no tier at
// all, because the venue would not open the position.
type LeverageTier struct {
	VenueID     string
	VenueSymbol string
	// Tier is 1-based, ascending with notional, numbered as the venue numbers it.
	Tier             int
	LowerNotionalUSD float64
	UpperNotionalUSD *float64
	// IMR is the initial margin rate as a fraction: 0.0066 is 150x.
	IMR float64
	// MMR is the maintenance margin rate, nil where the venue does not publish one.
	MMR         *float64
	MaxLeverage float64
}

// Liquidation is one forced close, as a venue reported it.
//
// SizeContracts is kept alongside NotionalUSD on purpose. Venues quote liquidation size in
// CONTRACTS, and the multiplier that converts it differs per market — Gate's BTC_USDT is 0.0001 BTC
// per contract, so a size of 8 is $62 and not 8 BTC. Storing the raw figure means a conversion
// mistake stays recoverable instead of being baked irreversibly into the only column we kept.
//
// Side is the side of the POSITION that was closed, not of the order that closed it: a liquidated
// long is sold. Gate's size and order_size are opposite in sign in 167 of 167 live records, and
// keying on the wrong one would have inverted every long and short in the Phase 4 study.
type Liquidation struct {
	MarketRef
	LiquidatedAt  int64
	Side          string // "long" or "short"
	SizeContracts float64
	FillPrice     float64
	NotionalUSD   *float64
}

// TakerFlowBucketMs is the grain of taker_flow: five minutes, the finest grain all four publishing
// venues share (migration 023).
const TakerFlowBucketMs int64 = 5 * 60_000

// TakerFlowBucketStart floors an epoch-millisecond instant to the start of its 5-minute bucket.
func TakerFlowBucketStart(ms int64) int64 {
	return ms - ((ms%TakerFlowBucketMs)+TakerFlowBucketMs)%TakerFlowBucketMs
}

// TakerFlow is one market's aggressor volume for one 5-minute bucket, already in dollars.
//
// Dollars rather than the venue's unit because the venues disagree (quote, USD, contracts, base
// coin) and only the adapter holds the contract scale and the bucket's price that convert them.
// BucketStart is the START of the bucket in epoch milliseconds, whatever the venue stamps: every
// adapter normalises, so one bucket_start means the same five minutes on every venue.
type TakerFlow struct {
	VenueID     string
	VenueSymbol string
	BucketStart int64
	BuyUSD      float64
	SellUSD     float64
	// ClosePrice is the venue's own last price for the bucket, nil where the response carries none
	// (okx). Never a zero.
	ClosePrice *float64
}

// SnapshotBatch is what one collection cycle of a venue produced.
type SnapshotBatch struct {
	Snapshots []FundingSnapshot
	// Settled holds payments visible in the same responses (OKX settFundingRate, KuCoin
	// lastTimeFundingRate), which arrive free with the snapshot call.
	Settled []FundingEvent
}
