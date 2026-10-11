/**
 * Load shedding: when the road to the database is weak, the database is kept for the people reading
 * the pages, and everything else is answered from the page cache or turned away.
 *
 * WHY. On 2026-10-11 the site served "data center busy" twice, 08:00-09:25 and the night before
 * 23:00-01:00 UTC, with the database idle. The path to it had slowed after two crashes of the
 * collector's box -- Hyperdrive measured 1.4 to 6.5 s a query and up to 3.4 s to open a connection,
 * where 25 ms and 0 are normal -- and at that speed its 20 connections were all held at once and
 * every render waited 10 s for one. Three quarters of what held them was one scraper on Alibaba Cloud
 * in Singapore, walking the liquidation pages in a burst at the top of every hour. Readers lost the
 * site to a bot. The owner's order (2026-10-11): when the network is weak, cut the API and the
 * machines first; the pages that show the data are what must keep working.
 *
 * WHAT IS SHED, only while this location is degraded (`Pressure` below):
 *   - the API (`/v1/*`), the MCP and A2A endpoints, and pages asked for as Markdown: callers are
 *     programs, which retry;
 *   - any request from a cloud provider's network (DATACENTER_ASNS): where scrapers run, and where a
 *     person browsing almost never is.
 * They get the page cache's copy if it has one, however stale (up to its keep-for hour), or the
 * render with the database refused, which answers 503 with a Retry-After without touching it. Routes
 * that read nothing still answer. Nothing a shed request renders is stored.
 *
 * WHAT IS NOT: everyone else's pages, which render as always, with the cache's own fallbacks
 * (app/edge-cache.ts). Shedding frees the database for them; it does not ration them.
 */

import { wantsMarkdown } from "../web/markdown";
import { A2A_PATH } from "./a2a";
import type { CacheLike } from "./edge-cache";
import { MCP_PATH } from "./mcp";

/**
 * Cloud and hosting networks, by autonomous system number. A request from one is a program until
 * proven otherwise; under pressure it is answered from the cache. Cloudflare's own (13335) is left
 * out on purpose: WARP puts real readers there.
 */
export const DATACENTER_ASNS: ReadonlySet<number> = new Set([
  45102, // Alibaba Cloud, international: the 2026-10 scraper (47.79.x.x, Singapore)
  37963, // Alibaba Cloud, China
  132203, // Tencent Cloud
  45090, // Tencent Cloud
  136907, // Huawei Cloud
  16509, // Amazon AWS
  14618, // Amazon AWS
  396982, // Google Cloud
  15169, // Google
  8075, // Microsoft Azure
  14061, // DigitalOcean
  24940, // Hetzner
  16276, // OVH
  63949, // Akamai Linode
  20473, // Vultr
  31898, // Oracle Cloud
  51167, // Contabo
  12876, // Scaleway
]);

/** Whether a request is one to answer from the cache while the database is under pressure. */
export function isSheddable(request: Request, asn: number | undefined): boolean {
  const path = new URL(request.url).pathname;
  if (path === "/v1" || path.startsWith("/v1/") || path === MCP_PATH || path === A2A_PATH) {
    return true;
  }
  if (wantsMarkdown(request.headers.get("accept"))) return true;
  return asn !== undefined && DATACENTER_ASNS.has(asn);
}

/** The error a shed render's database refuses with. */
export const SHED_REFUSAL = "load shedding: the database is reserved for page readers";

export interface PressureOptions {
  /** A render at least this slow counts against the database path, as a failed one does. */
  slowMs: number;
  /** This many such renders inside `windowMs` put the location under pressure... */
  strikes: number;
  windowMs: number;
  /** ...until this long after the last of them. */
  holdMs: number;
  /** How often an isolate rereads the location's shared verdict. */
  shareEveryMs: number;
  now: () => number;
}

export const PRESSURE_DEFAULTS: PressureOptions = {
  // A page is five or so queries of ~25 ms each; four seconds is a sick path, not a heavy page.
  slowMs: 4_000,
  // Two, so one unlucky render does not cut the API for a minute.
  strikes: 2,
  windowMs: 60_000,
  holdMs: 60_000,
  shareEveryMs: 5_000,
  now: Date.now,
};

/**
 * The location's shared verdict, kept in its page cache: every isolate in a Cloudflare location
 * reads the same `caches.default`, so one that sees the database struggle tells the rest. It expires
 * by itself, and its header says until when.
 */
const MARKER = "https://airrates.net/__pressure";
const UNTIL = "x-airrates-pressure-until";

/**
 * Whether the database path is too weak to spend on sheddable callers, judged from this location's
 * own renders: failed ones, and ones slower than `slowMs`. Recovers by itself once renders are quick
 * again for `holdMs`.
 */
export class Pressure {
  private readonly options: PressureOptions;
  private strikesAt: number[] = [];
  private until = 0;
  private checkedAt = Number.NEGATIVE_INFINITY;

  constructor(options: Partial<PressureOptions> = {}) {
    this.options = { ...PRESSURE_DEFAULTS, ...options };
  }

  /** Whether this location is under pressure now. Reads the shared verdict at most every few seconds. */
  async underPressure(cache: CacheLike): Promise<boolean> {
    const now = this.options.now();
    if (now - this.checkedAt >= this.options.shareEveryMs) {
      this.checkedAt = now;
      const marker = await cache.match(new Request(MARKER)).catch(() => undefined);
      const shared = Number(marker?.headers.get(UNTIL));
      if (Number.isFinite(shared)) this.until = Math.max(this.until, shared);
    }
    return now < this.until;
  }

  /**
   * One render's outcome. When it puts (or keeps) the location under pressure, returns the write
   * that tells the location's other isolates, for the caller to hand to waitUntil, and whether this
   * render is the one that tipped it, for a single log line. Otherwise null.
   */
  observe(
    outcome: { ms: number; ok: boolean },
    cache: CacheLike,
  ): { share: Promise<void>; tipped: boolean } | null {
    const o = this.options;
    if (outcome.ok && outcome.ms < o.slowMs) return null;
    const now = o.now();
    this.strikesAt = this.strikesAt.filter((at) => now - at < o.windowMs);
    this.strikesAt.push(now);
    if (this.strikesAt.length < o.strikes) return null;
    const tipped = now >= this.until;
    this.until = now + o.holdMs;
    const marker = new Response("", {
      headers: {
        "cache-control": `public, max-age=${Math.ceil(o.holdMs / 1000)}`,
        [UNTIL]: String(this.until),
      },
    });
    return { share: cache.put(new Request(MARKER), marker).catch(() => undefined), tipped };
  }
}
