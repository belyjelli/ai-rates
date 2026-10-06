import { VENUES, type Venue } from "@ai-rates/venues";
import { msg } from "./i18n";

export const VENUE_BY_ID: ReadonlyMap<string, Venue> = new Map(VENUES.map((v) => [v.id, v]));

export function venueName(id: string): string {
  return VENUE_BY_ID.get(id)?.name ?? id;
}

/** Marked for translation; a page shows them through `trMsg`. */
export const VENUE_TYPE_LABEL: Record<string, string> = {
  cex: msg("Centralized exchange"),
  dex: msg("Onchain perp exchange"),
  hip3: msg("Hyperliquid HIP-3 dex"),
};

export const VENUE_TYPE_SHORT: Record<string, string> = { cex: "CEX", dex: "DEX", hip3: "HIP-3" };
