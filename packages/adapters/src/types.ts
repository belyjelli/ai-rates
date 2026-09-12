import type { FundingEvent, FundingSnapshot, LeverageTier } from "@ai-rates/core";
import type { HttpClient } from "./http";

export interface SnapshotBatch {
  snapshots: FundingSnapshot[];
  /** Settled payments visible in the same responses (e.g. OKX settFundingRate, KuCoin lastTimeFundingRate). */
  settled: FundingEvent[];
}

/**
 * One venue's ladders, and whether the sweep actually covered the whole venue.
 *
 * `complete` exists because a venue fetched in many calls can lose some of them to a transient
 * error. The collector upserts whatever arrived but only prunes on a complete sweep, so a rate
 * limit can never delete ladders the sweep merely failed to see.
 */
export interface VenueLeverageTiers {
  tiers: LeverageTier[];
  complete: boolean;
}

/** A market the collector already knows about, for warming an adapter's caches after a restart. */
export interface KnownMarket {
  venueSymbol: string;
  intervalHours: number | null;
}

export interface VenueAdapter {
  readonly venueId: string;
  /** Minimum spacing between request starts for this venue's HTTP client. */
  readonly minIntervalMs: number;
  /**
   * Adapters with the same group share one HTTP client (spacing and circuit breaker), for venues
   * behind one IP-limited API such as Hyperliquid core plus its HIP-3 dexes.
   */
  readonly rateLimitGroup?: string;
  /**
   * Seeds caches that a restart would otherwise rebuild over many cycles, from the markets the
   * collector already has stored. Called once before the first cycle.
   */
  warmUp?(markets: readonly KnownMarket[]): void;
  /** Latest funding and market stats for every live perp market, in as few requests as the venue allows. */
  fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch>;
  /**
   * The venue's entire risk-limit ladder, every market in one sweep.
   *
   * Whole-venue rather than per-symbol on purpose: Bybit returns every symbol from one paginated
   * endpoint, so the full ladder costs ~56 requests instead of one per market. A venue that only
   * answers per-symbol can page internally here and stay within its own budget. Tiers change
   * rarely, so the collector calls this daily, not per cycle.
   */
  fetchLeverageTiers?(client: HttpClient): Promise<VenueLeverageTiers>;
  /** Settled funding payments for one market in [fromMs, toMs], oldest first. */
  fetchFundingHistory?(
    client: HttpClient,
    venueSymbol: string,
    fromMs: number,
    toMs: number,
  ): Promise<FundingEvent[]>;
}
