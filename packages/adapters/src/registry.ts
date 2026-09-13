import type { VenueAdapter } from "./types";
import { arcusAdapter } from "./venues/arcus";
import { asterAdapter } from "./venues/aster";
import { binanceAdapter } from "./venues/binance";
import { bingxAdapter } from "./venues/bingx";
import { bitgetAdapter } from "./venues/bitget";
import { bitmartAdapter } from "./venues/bitmart";
import { bulletAdapter } from "./venues/bullet";
import { bybitAdapter } from "./venues/bybit";
import { coinwAdapter } from "./venues/coinw";
import { dydxAdapter } from "./venues/dydx";
import { edgexV2Adapter } from "./venues/edgex";
import { extendedAdapter } from "./venues/extended";
import { gateAdapter } from "./venues/gate";
import { hotcoinAdapter } from "./venues/hotcoin";
import { htxAdapter } from "./venues/htx";
import { createHip3Adapter, hyperliquidAdapter } from "./venues/hyperliquid";
import { kucoinAdapter } from "./venues/kucoin";
import { lbankAdapter } from "./venues/lbank";
import { lighterAdapter, lighterRhAdapter } from "./venues/lighter";
import { mexcAdapter } from "./venues/mexc";
import { okxAdapter } from "./venues/okx";
import { ondoAdapter } from "./venues/ondo";
import { orderlyAdapter } from "./venues/orderly";
import { paradexAdapter } from "./venues/paradex";
import { perplAdapter } from "./venues/perpl";
import { phoenixAdapter } from "./venues/phoenix";
import { pionexAdapter } from "./venues/pionex";
import { reyaAdapter } from "./venues/reya";
import { sodexAdapter } from "./venues/sodex";
import { standxAdapter } from "./venues/standx";
import { toobitAdapter } from "./venues/toobit";
import { variationalAdapter } from "./venues/variational";
import { velocityAdapter } from "./venues/velocity";
import { weexAdapter } from "./venues/weex";

/** Phase 1 venues with a dedicated adapter. HIP-3 dexes get one adapter each, from the catalog. */
/**
 * Adapters built but not collected: `blofin` (packages/adapters/src/venues/blofin.ts) answers from a
 * development machine but returns HTTP 403 to the collector's host, measured 2026-09-13 22:53Z on its
 * first production run. It is left out rather than left failing every run on /status; re-add it when
 * the collector can reach openapi.blofin.com.
 */
export const FIXED_ADAPTERS: readonly VenueAdapter[] = [
  bybitAdapter,
  okxAdapter,
  gateAdapter,
  mexcAdapter,
  kucoinAdapter,
  asterAdapter,
  binanceAdapter,
  weexAdapter,
  bulletAdapter,
  hyperliquidAdapter,
  dydxAdapter,
  paradexAdapter,
  lighterAdapter,
  extendedAdapter,
  reyaAdapter,
  arcusAdapter,
  variationalAdapter,
  bitgetAdapter,
  bingxAdapter,
  bitmartAdapter,
  htxAdapter,
  pionexAdapter,
  orderlyAdapter,
  hotcoinAdapter,
  lbankAdapter,
  sodexAdapter,
  ondoAdapter,
  standxAdapter,
  toobitAdapter,
  coinwAdapter,
  edgexV2Adapter,
  lighterRhAdapter,
  velocityAdapter,
  phoenixAdapter,
  perplAdapter,
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
