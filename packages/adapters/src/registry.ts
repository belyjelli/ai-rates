import type { VenueAdapter } from "./types";
import { asterAdapter } from "./venues/aster";
import { bybitAdapter } from "./venues/bybit";
import { dydxAdapter } from "./venues/dydx";
import { gateAdapter } from "./venues/gate";
import { createHip3Adapter, hyperliquidAdapter } from "./venues/hyperliquid";
import { kucoinAdapter } from "./venues/kucoin";
import { lighterAdapter } from "./venues/lighter";
import { mexcAdapter } from "./venues/mexc";
import { okxAdapter } from "./venues/okx";
import { paradexAdapter } from "./venues/paradex";

/** Phase 1 venues with a dedicated adapter. HIP-3 dexes get one adapter each, from the catalog. */
export const FIXED_ADAPTERS: readonly VenueAdapter[] = [
  bybitAdapter,
  okxAdapter,
  gateAdapter,
  mexcAdapter,
  kucoinAdapter,
  asterAdapter,
  hyperliquidAdapter,
  dydxAdapter,
  paradexAdapter,
  lighterAdapter,
];

/** Structural subset of a catalog venue, so this package doesn't depend on @ai-rates/venues. */
export interface AdapterCatalogEntry {
  id: string;
  type: string;
  hip3Dex?: string;
}

/** Adapters for every catalog venue that can be collected, in catalog order. */
export function createAdapters(venues: readonly AdapterCatalogEntry[]): VenueAdapter[] {
  const fixed = new Map(FIXED_ADAPTERS.map((adapter) => [adapter.venueId, adapter]));
  const adapters: VenueAdapter[] = [];
  for (const venue of venues) {
    const adapter = fixed.get(venue.id);
    if (adapter) adapters.push(adapter);
    else if (venue.type === "hip3" && venue.hip3Dex)
      adapters.push(createHip3Adapter(venue.hip3Dex));
  }
  return adapters;
}
