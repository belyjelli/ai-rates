import type { HttpClient, VenueAdapter } from "@ai-rates/adapters";
import type { Liquidation } from "@ai-rates/core";

export interface LiquidationStore {
  recordLiquidations(venueId: string, liquidations: readonly Liquidation[]): Promise<number>;
}

export interface LiquidationSweep {
  /** Records the venue returned, before de-duplication. */
  fetched: number;
  /** Rows actually new to the database. Most of a page repeats on every poll. */
  stored: number;
  markets: number;
  /** False when part of the venue was missed; nothing is ever deleted, so this is lost coverage. */
  complete: boolean;
}

/**
 * Polls one venue's forced closes and stores whatever is new.
 *
 * Unlike the leverage-tier sweep this never prunes, so `complete` does not guard a delete — it
 * reports lost coverage instead. That distinction matters more than it looks: a missing hour of
 * liquidations reads as "no liquidations happened" to any later regression, which is a silently
 * wrong regressor rather than an obviously absent one.
 *
 * Re-reading is normal, not waste. Gate accepts `from`/`to` and ignores them, so each poll returns
 * the same ~58-minute page and the store's composite primary key absorbs the repeats; `stored`
 * being far below `fetched` is the expected steady state.
 */
export async function refreshVenueLiquidations(
  adapter: VenueAdapter,
  client: HttpClient,
  store: LiquidationStore,
): Promise<LiquidationSweep> {
  if (!adapter.fetchLiquidations) {
    return { fetched: 0, stored: 0, markets: 0, complete: true };
  }

  const { liquidations, complete } = await adapter.fetchLiquidations(client);
  if (liquidations.length === 0) return { fetched: 0, stored: 0, markets: 0, complete };

  const stored = await store.recordLiquidations(adapter.venueId, liquidations);
  return {
    fetched: liquidations.length,
    stored,
    markets: new Set(liquidations.map((l) => l.venueSymbol)).size,
    complete,
  };
}
