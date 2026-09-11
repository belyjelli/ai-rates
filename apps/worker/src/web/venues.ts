import { VENUES, type Venue } from "@ai-rates/venues";

export const VENUE_BY_ID: ReadonlyMap<string, Venue> = new Map(VENUES.map((v) => [v.id, v]));

export function venueName(id: string): string {
  return VENUE_BY_ID.get(id)?.name ?? id;
}

export const VENUE_TYPE_LABEL: Record<string, string> = {
  cex: "Centralized exchange",
  dex: "Onchain perp exchange",
  hip3: "Hyperliquid HIP-3 dex",
};

export const VENUE_TYPE_SHORT: Record<string, string> = { cex: "CEX", dex: "DEX", hip3: "HIP-3" };
