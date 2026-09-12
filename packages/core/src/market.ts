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
  /**
   * Headline max leverage for this market, when the venue publishes it in a call we already make.
   * A property of the market rather than the tick, carried here only as transport to `markets`.
   * Optional because six of ten venues never report it, and a required null would touch every
   * adapter and fixture for a field they cannot fill. It is the headline figure, so it holds only
   * at small size: the tiered ladder is the precise source.
   */
  maxLeverage?: number | null;
}

/**
 * One step of a venue's risk-limit ladder: the larger the position, the less leverage it may use.
 *
 * Bounds are USD notional for a position on that market, half-open `[lower, upper)`, so the tier a
 * size falls into is unambiguous at a boundary. A null upper bound means the venue publishes no
 * cap; where it publishes one (Bybit caps BTCUSDT at $1.2bn) that bound is real, and a size above
 * every tier has no tier at all because the venue would not open the position.
 */
export interface LeverageTier {
  venueId: string;
  venueSymbol: string;
  /** 1-based, ascending with notional, numbered as the venue numbers it. */
  tier: number;
  lowerNotionalUsd: number;
  upperNotionalUsd: number | null;
  /** Initial margin rate as a fraction: 0.0066 is 150x. */
  imr: number;
  /** Maintenance margin rate, null where the venue doesn't publish one. */
  mmr: number | null;
  maxLeverage: number;
}

/**
 * One forced close, as a venue reported it.
 *
 * `sizeContracts` is kept alongside `notionalUsd` on purpose. Venues quote liquidation size in
 * CONTRACTS, and the multiplier that converts it differs per market — Gate's BTC_USDT is 0.0001
 * BTC per contract, so a size of 8 is $62 and not 8 BTC. Storing the raw figure means a conversion
 * mistake stays recoverable instead of being baked irreversibly into the only column we kept.
 *
 * `side` is the side of the POSITION that was closed, not the side of the order that closed it: a
 * liquidated long is sold. Venues report one or the other and the adapters normalise to the
 * position, because "longs were liquidated" is the claim an analysis actually makes.
 */
export interface Liquidation extends MarketRef {
  /** Epoch ms of the forced close. */
  liquidatedAt: number;
  side: "long" | "short";
  sizeContracts: number;
  /** Price the forced close filled at. */
  fillPrice: number;
  /** sizeContracts x contract multiplier x fillPrice, or null when the multiplier is unknown. */
  notionalUsd: number | null;
}

/** A settled funding payment for one market. */
export interface FundingEvent extends MarketRef {
  settledAt: number;
  rate: number;
  basisHours: number;
  markPrice: number | null;
}
