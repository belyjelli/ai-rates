/** Durable Object location hints (mirrors DurableObjectLocationHint in the Workers runtime types). */
export type LocationHint =
  | "wnam"
  | "enam"
  | "sam"
  | "weur"
  | "eeur"
  | "apac"
  | "apac-ne"
  | "apac-se"
  | "oc"
  | "afr"
  | "me";

/** Geo-probe runners: the six hinted Durable Objects plus the un-hinted "default" one. */
export type ProbeRunner = LocationHint | "default";

/** Egress fallback ladder from plans/development-plan.md (rung 2, Containers, is unavailable on Workers Free). */
export type EgressRung =
  /** Rung 1: fetch directly from a collector DO created with `recommendedHint`. */
  | "direct"
  /** Rung 3: rates only, relayed via Hyperliquid predictedFundings or Lighter funding-rates. */
  | "relayed"
  /** Rung 4: a non-Cloudflare egress proxy (needs owner approval). */
  | "proxy"
  /** Blocked from every Cloudflare location tested; waiting on a decision. */
  | "undecided";

export interface GeoFinding {
  /** Runners that were blocked, challenged, rate limited or timed out in every sample. */
  blockedFrom: readonly ProbeRunner[];
  /** Location hint for this venue's collector DO, or null when no Cloudflare location works. */
  recommendedHint: LocationHint | null;
  rung: EgressRung;
  evidence: string;
}

const EVERY_RUNNER: readonly ProbeRunner[] = [
  "default",
  "wnam",
  "enam",
  "weur",
  "eeur",
  "apac-ne",
  "apac-se",
];

/**
 * Deployed geo-probe results from two runs on 2026-09-11 (16:22 and 16:33 UTC) on Workers Free.
 * Runners landed in SIN (default), LAX, ORD, MRS, PRG, NRT and SIN. Venues not listed here were
 * reachable from every runner. Re-run the probe before relying on this for a new venue.
 */
export const GEO_FINDINGS: Readonly<Record<string, GeoFinding>> = {
  binance: {
    blockedFrom: EVERY_RUNNER,
    recommendedHint: null,
    rung: "undecided",
    evidence: "HTTP 403 CloudFront 'Request blocked' from all 7 runners in both runs.",
  },
  blofin: {
    blockedFrom: EVERY_RUNNER,
    recommendedHint: null,
    rung: "undecided",
    evidence: "HTTP 403 with an HTML page instead of JSON from all 7 runners in both runs.",
  },
  pionex: {
    blockedFrom: EVERY_RUNNER,
    recommendedHint: null,
    rung: "undecided",
    evidence: "HTTP 429 'Too Many Requests' on the first request from all 7 runners in both runs.",
  },
  bitget: {
    blockedFrom: ["wnam", "enam", "weur", "eeur", "apac-ne", "apac-se"],
    recommendedHint: null,
    rung: "undecided",
    evidence:
      'HTTP 403 {"cloudflare":"block"} from every hinted runner; only the un-hinted SIN runner got through, so treat it as blocked.',
  },
  bybit: {
    blockedFrom: ["wnam", "enam"],
    recommendedHint: "apac-ne",
    rung: "direct",
    evidence: "CloudFront 403 'block access from your country' from the US runners only.",
  },
  mexc: {
    blockedFrom: ["wnam"],
    recommendedHint: "apac-ne",
    rung: "direct",
    evidence: "Akamai 403 'Access Denied' from the LAX runner only.",
  },
  orderly: {
    blockedFrom: ["default", "wnam"],
    recommendedHint: "apac-ne",
    rung: "direct",
    evidence: "HTTP 403 from the un-hinted SIN and LAX runners; ok from the other five.",
  },
  extended: {
    blockedFrom: ["weur"],
    recommendedHint: "apac-ne",
    rung: "direct",
    evidence: "Timed out from MRS in both runs; the venue runs in AWS Tokyo.",
  },
};
