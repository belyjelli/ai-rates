import type { VenueAdapter } from "./types";
import { aevoAdapter } from "./venues/aevo";
import { apexAdapter } from "./venues/apex";
import { arcusAdapter } from "./venues/arcus";
import { asterAdapter } from "./venues/aster";
import { backpackAdapter } from "./venues/backpack";
import { binanceAdapter } from "./venues/binance";
import { bingxAdapter } from "./venues/bingx";
import { bitgetAdapter } from "./venues/bitget";
import { bitmartAdapter } from "./venues/bitmart";
import { bluefinAdapter } from "./venues/bluefin";
import { bulletAdapter } from "./venues/bullet";
import { bybitAdapter } from "./venues/bybit";
import { coinwAdapter } from "./venues/coinw";
import { dydxAdapter } from "./venues/dydx";
import { edgexV2Adapter } from "./venues/edgex";
import { extendedAdapter } from "./venues/extended";
import { gateAdapter } from "./venues/gate";
import { grvtAdapter } from "./venues/grvt";
import { hibachiAdapter } from "./venues/hibachi";
import { hotcoinAdapter } from "./venues/hotcoin";
import { htxAdapter } from "./venues/htx";
import { createHip3Adapter, hyperliquidAdapter } from "./venues/hyperliquid";
import { kucoinAdapter } from "./venues/kucoin";
import { lbankAdapter } from "./venues/lbank";
import { lighterAdapter, lighterRhAdapter } from "./venues/lighter";
import { mexcAdapter } from "./venues/mexc";
import { nadoAdapter } from "./venues/nado";
import { okxAdapter } from "./venues/okx";
import { ondoAdapter } from "./venues/ondo";
import { orderlyAdapter } from "./venues/orderly";
import { pacificaAdapter } from "./venues/pacifica";
import { paradexAdapter } from "./venues/paradex";
import { perplAdapter } from "./venues/perpl";
import { phoenixAdapter } from "./venues/phoenix";
import { pionexAdapter } from "./venues/pionex";
import { polymarketAdapter } from "./venues/polymarket";
import { reyaAdapter } from "./venues/reya";
import { risexAdapter } from "./venues/risex";
import { sodexAdapter } from "./venues/sodex";
import { standxAdapter } from "./venues/standx";
import { toobitAdapter } from "./venues/toobit";
import { variationalAdapter } from "./venues/variational";
import { velocityAdapter } from "./venues/velocity";
import { weexAdapter } from "./venues/weex";
import { zero1Adapter } from "./venues/zero1";

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
  apexAdapter,
  grvtAdapter,
  hibachiAdapter,
  zero1Adapter,
  aevoAdapter,
  nadoAdapter,
  risexAdapter,
  polymarketAdapter,
  backpackAdapter,
  bluefinAdapter,
  pacificaAdapter,
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
