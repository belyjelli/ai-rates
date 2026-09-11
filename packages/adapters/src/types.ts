import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "./http";

export interface SnapshotBatch {
  snapshots: FundingSnapshot[];
  /** Settled payments visible in the same responses (e.g. OKX settFundingRate, KuCoin lastTimeFundingRate). */
  settled: FundingEvent[];
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
  /** Settled funding payments for one market in [fromMs, toMs], oldest first. */
  fetchFundingHistory?(
    client: HttpClient,
    venueSymbol: string,
    fromMs: number,
    toMs: number,
  ): Promise<FundingEvent[]>;
}
