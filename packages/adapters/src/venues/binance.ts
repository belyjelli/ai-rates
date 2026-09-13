import type { VenueAdapter } from "../types";
import { createBinanceStyleAdapter } from "./aster";

/**
 * Binance USDⓈ-M futures: the first member of the binance-fapi family that is not Aster.
 *
 * Everything here is configuration. The parsing, the hourly exchangeInfo cache, the rotating
 * open-interest sweep and the paged funding history all live in `aster.ts`, which is the family
 * base; adding Binance required generalising two constants, not a second adapter.
 *
 * Measured from the collector host on 2026-09-13 before any of this was written:
 *
 * - **Reachable.** premiumIndex, fundingInfo, exchangeInfo and ticker/24hr all returned HTTP 200 in
 *   0.12–0.21s. The catalog's warning is "HTTP 451 from US IPs"; hklab is not one, so the documented
 *   blocker does not apply to where the collector actually runs. It would apply to a US-hosted
 *   collector, which is why this is written down rather than assumed stable.
 * - **571 tradable perpetuals**, roughly doubling the site's live market count on its own.
 * - **`defaultIntervalHours` is null.** fundingInfo is not the exceptions-only list the catalog note
 *   claims: 782 entries, 312 of them at the default 8h, against 900 symbols in premiumIndex. Of the
 *   138 missing, zero are TRADING perpetuals, so `tradablePerpetuals` filters them before the
 *   interval lookup matters. An 8h default would also have been the wrong guess: 466 of 782 settle
 *   4-hourly.
 * - **Weight fits.** A symbol-less premiumIndex reported `x-mbx-used-weight-1m: 50` against a
 *   2400/min ceiling, so the bulk trio plus a 120-symbol open-interest slice has ample headroom.
 *   `exchangeInfo` is 1.1 MB, which is why it is cached hourly rather than fetched per cycle.
 */
export const binanceAdapter: VenueAdapter = createBinanceStyleAdapter({
  venueId: "binance",
  baseUrl: "https://fapi.binance.com/fapi/v1",
  defaultIntervalHours: null,
});
