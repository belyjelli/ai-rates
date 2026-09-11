/** How trustworthy a funding value is: an estimate for the next settlement, or an actual settlement. */
export type FundingRateKind = "predicted" | "settled";

export interface MarketRef {
  venueId: string;
  /** Symbol exactly as the venue names it (e.g. "BTCUSDT", "BTC-USDT-SWAP", "xyz:XYZ100"). */
  venueSymbol: string;
  base: string;
  quote: string | null;
  /** Contracts per unit of `base` implied by the symbol (1000 for "1000PEPE"). */
  multiplier: number;
  /** Hyperliquid HIP-3 dex id, when the market lives on one. */
  dex: string | null;
}

/** One market's funding and stats as observed at a point in time. */
export interface FundingSnapshot extends MarketRef {
  observedAt: number;
  /** Funding rate as a fraction over `basisHours` (venue units already converted). Positive = longs pay. */
  rate: number;
  /** Period the rate is quoted over; not always the settlement interval. */
  basisHours: number;
  /** Settlement interval in hours when the venue reports it. */
  intervalHours: number | null;
  nextFundingAt: number | null;
  kind: FundingRateKind;
  markPrice: number | null;
  indexPrice: number | null;
  openInterestUsd: number | null;
  volume24hUsd: number | null;
}

/** A settled funding payment for one market. */
export interface FundingEvent extends MarketRef {
  settledAt: number;
  rate: number;
  basisHours: number;
  markPrice: number | null;
}
