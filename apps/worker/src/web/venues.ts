import { VENUES, type Venue } from "@ai-rates/venues";
import { esc } from "./format";
import { msg, tr } from "./i18n";

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

/**
 * Venue ids as one line grouped by kind, each once, in the order given within a kind:
 * "CEX: Binance, OKX · DEX: Hyperliquid, Lighter · HIP-3: trade[XYZ]". An id the catalog does not
 * know is listed as a DEX under its own id.
 */
export function venuesByKind(ids: readonly string[]): string {
  const groups = new Map<string, string[]>();
  for (const id of new Set(ids)) {
    const kind = VENUE_BY_ID.get(id)?.type ?? "dex";
    groups.set(kind, [...(groups.get(kind) ?? []), venueName(id)]);
  }
  return ["cex", "dex", "hip3"]
    .filter((kind) => groups.has(kind))
    .map((kind) => `${VENUE_TYPE_SHORT[kind]}: ${(groups.get(kind) ?? []).join(", ")}`)
    .join(" · ");
}

/** Every HIP-3 dex the catalog collects: Hyperliquid's builder-deployed markets, each a venue. */
export const HIP3_VENUE_IDS: readonly string[] = VENUES.filter(
  (v) => v.type === "hip3" && v.retired === undefined,
).map((v) => v.id);

/**
 * How many venues, as a span with their names on hover grouped by kind (venuesByKind); the one
 * venue's name when there is one, and nothing for none.
 */
export function venueCountTag(ids: readonly string[], className = "dim"): string {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return "";
  const text =
    unique.length === 1
      ? esc(venueName(unique[0] ?? ""))
      : tr("{count} venues", { count: unique.length });
  const cls = className ? ` class="${className}"` : "";
  return `<span${cls} title="${esc(venuesByKind(unique))}">${text}</span>`;
}
