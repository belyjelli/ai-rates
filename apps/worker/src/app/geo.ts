/**
 * Where a referral call-to-action may be shown, decided from the visitor's location.
 *
 * The rules come from plans/phase0-referrals-legal.md §3, and they are an engineering reading for
 * counsel to review, not legal advice. The design is fail-closed at every step, because a CTA shown
 * where it is barred can be a criminal promotion (UK FSMA s21) or a sanctions breach, while a CTA
 * hidden where it was allowed costs a commission:
 *   - an unknown location (no country, Tor, "XX") shows nothing;
 *   - a venue whose restrictions nobody has written down shows nothing;
 *   - EEA visitors see a CTA only for a venue marked MiCA-authorised, and none is marked yet.
 */

export interface Geo {
  /** ISO 3166-1 alpha-2, or null when Cloudflare could not place the request. */
  country: string | null;
  /** The ISO 3166-2 subdivision without its country prefix ("ON" for Ontario), or null. */
  region: string | null;
}

/** Nobody in these places sees a referral CTA for any venue. Codes are ISO 3166-1, or 3166-2 for a region. */
export const GLOBAL_CTA_BLOCKLIST: readonly string[] = [
  // Derivatives and securities promotion: the US, Canada (Ontario acts against unregistered
  // platforms), and the UK, where an unapproved cryptoasset promotion is an offence under FSMA s21.
  "US",
  "CA",
  "GB",
  // Comprehensive sanctions.
  "IR",
  "KP",
  "CU",
  "SY",
  // EU Reg. 833/2014 Art. 5b and allied measures.
  "RU",
  "BY",
  // Crimea, Sevastopol, Donetsk, Luhansk.
  "UA-43",
  "UA-40",
  "UA-14",
  "UA-09",
];

/** The European Economic Area, where MiCA governs solicitation by crypto-asset service providers. */
export const EEA: readonly string[] = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
];

export interface VenueCtaRules {
  /** Places the venue's own terms exclude, beyond the global list. */
  restricted: readonly string[];
  /** Set only for an entity with a MiCA authorisation; it is what allows a CTA to EEA visitors. */
  micaAuthorised?: boolean;
}

/**
 * Per-venue exclusions, from each venue's terms as the checklist records them. Several are marked
 * "incl." there, so these are minimums: extend a list from the venue's current terms before giving
 * it a referral link. A venue absent from this table cannot show a CTA at all.
 */
export const VENUE_CTA_RULES: Readonly<Record<string, VenueCtaRules>> = {
  hyperliquid: { restricted: ["US", "CA-ON"] },
  kucoin: { restricted: ["US", "SG", "CN", "HK", "MY", "KZ", "UZ", "CA-ON", "CA-BC", "FR", "NL"] },
  bitget: { restricted: ["AT", "CA", "FR", "DE", "HK", "JP", "SG", "US"] },
  gate: { restricted: ["US", "GB", "CA", "FR", "DE", "NL", "ES", "JP", "IN", "RU"] },
  mexc: { restricted: ["US", "GB", "CA", "SG"] },
  okx: { restricted: ["CA", "HK", "IN", "JP", "US", "GB"] },
  dydx: { restricted: ["US", "CA", "GB"] },
  lighter: { restricted: ["US", "CA", "GB"] },
  aster: { restricted: ["US", "CA", "GB"] },
};

/** Venues that trade under another venue's terms: HIP-3 dexes and Bullpen on Hyperliquid, Lighter RH. */
function rulesKey(venueId: string): string {
  if (venueId.startsWith("hl-") || venueId === "bullpen") return "hyperliquid";
  if (venueId === "lighter-rh") return "lighter";
  return venueId;
}

/** Countries where a rule names a region, so the region changes the answer and the cache must split on it. */
const REGION_SENSITIVE = new Set(
  [...GLOBAL_CTA_BLOCKLIST, ...Object.values(VENUE_CTA_RULES).flatMap((rules) => rules.restricted)]
    .filter((code) => code.includes("-"))
    .map((code) => code.split("-")[0] as string),
);

function matches(codes: readonly string[], geo: Geo): boolean {
  return codes.some((code) => {
    const [country, region] = code.split("-");
    return country === geo.country && (region === undefined || region === geo.region);
  });
}

/** The visitor's location as Cloudflare reports it. Outside Workers (tests, local dev) it is unknown. */
export function requestGeo(request: Request): Geo {
  const cf = (request as { cf?: { country?: unknown; regionCode?: unknown } }).cf;
  // "XX" is Cloudflare's "no country"; "T1" is Tor, which the pattern rejects by its digit.
  const country =
    typeof cf?.country === "string" && /^[A-Z]{2}$/.test(cf.country) && cf.country !== "XX"
      ? cf.country
      : null;
  const region =
    typeof cf?.regionCode === "string" && cf.regionCode.trim() !== ""
      ? cf.regionCode.trim().toUpperCase()
      : null;
  return { country, region };
}

/** Whether a referral CTA for this venue may be shown to this visitor. */
export function referralAllowed(
  venueId: string,
  geo: Geo,
  rules: Readonly<Record<string, VenueCtaRules>> = VENUE_CTA_RULES,
): boolean {
  if (geo.country === null) return false;
  if (matches(GLOBAL_CTA_BLOCKLIST, geo)) return false;
  const venue = rules[rulesKey(venueId)];
  if (!venue) return false;
  if (EEA.includes(geo.country) && !venue.micaAuthorised) return false;
  return !matches(venue.restricted, geo);
}

/**
 * Referral links from configuration: a JSON object of venue id to https URL, in the REFERRAL_LINKS
 * variable. Affiliate IDs are configuration, never code (checklist §4 item 9). Anything malformed is
 * dropped rather than thrown, because a typo in a link must not take the site down.
 */
export function parseReferralLinks(raw: string | undefined): Readonly<Record<string, string>> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const links: Record<string, string> = {};
  for (const [venueId, url] of Object.entries(parsed)) {
    if (typeof url !== "string") continue;
    try {
      if (new URL(url).protocol === "https:") links[venueId] = url;
    } catch {
      // Not a URL; dropped.
    }
  }
  return links;
}

/**
 * The part of the visitor's location a rendered page can depend on, for the edge cache key.
 *
 * The cache is keyed by URL, so without this a page rendered with a CTA for a visitor in Singapore
 * would be served from cache to the next visitor from the US. While no referral link is configured
 * no page differs by location, so everything shares one bucket and caching is unchanged.
 */
export function geoCacheBucket(geo: Geo, referralsConfigured: boolean): string {
  if (!referralsConfigured) return "any";
  if (geo.country === null || matches(GLOBAL_CTA_BLOCKLIST, geo)) return "none";
  return REGION_SENSITIVE.has(geo.country) && geo.region
    ? `${geo.country}-${geo.region}`
    : geo.country;
}
