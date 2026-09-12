import type { HttpClient, VenueAdapter } from "@ai-rates/adapters";
import type { LeverageTier } from "@ai-rates/core";

export interface LeverageTierStore {
  replaceLeverageTiers(
    venueId: string,
    tiers: readonly LeverageTier[],
    fetchedAt?: Date,
  ): Promise<number>;
}

export interface LeverageTierSweep {
  markets: number;
  tiers: number;
}

/**
 * Pulls a venue's entire risk-limit ladder and replaces what is stored for it.
 *
 * This is a whole-venue sweep, not the budgeted per-symbol rotation the history backfill and the
 * Aster open-interest refresh use. Bybit answers for every symbol from one paginated endpoint, so
 * the full ladder costs about 56 requests rather than one per market, and there is nothing to
 * spread across cycles. Ladders change only when a venue relists or rebalances risk, so this runs
 * daily and stays well clear of the live collection loop's rate limit.
 */
export async function refreshVenueLeverageTiers(
  adapter: VenueAdapter,
  client: HttpClient,
  store: LeverageTierStore,
  options: { now?: () => number } = {},
): Promise<LeverageTierSweep> {
  if (!adapter.fetchLeverageTiers) return { markets: 0, tiers: 0 };

  const tiers = await adapter.fetchLeverageTiers(client);
  if (tiers.length === 0) return { markets: 0, tiers: 0 };

  await store.replaceLeverageTiers(adapter.venueId, tiers, new Date(options.now?.() ?? Date.now()));
  return { markets: new Set(tiers.map((tier) => tier.venueSymbol)).size, tiers: tiers.length };
}
