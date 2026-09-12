import { backtestPair } from "@ai-rates/core";
import { VENUES } from "@ai-rates/venues";
import * as pages from "../web/pages";
import { VENUE_BY_ID } from "../web/venues";
import type { DataSource, MarketRow } from "./data";
import {
  type BacktestParams,
  DEFAULT_FILTERS,
  filtersToQuery,
  HEATMAP_MIN_VENUES,
  heatmapToQuery,
  parseBacktestParams,
  parseHeatmapParams,
  parseScreenerFilters,
} from "./params";
import { TURNSTILE_FIELD, type TurnstileVerdict } from "./turnstile";

export interface AppDeps {
  data: DataSource;
  now: () => number;
  log?: (message: string) => void;
  /**
   * Verifies a Turnstile token. Absent means the challenge is not configured -- local development,
   * and the tests -- and the gate is skipped. Production must set TURNSTILE_SECRET, or the
   * expensive path is open.
   */
  verifyToken?: (token: string | null, remoteip: string | null) => Promise<TurnstileVerdict>;
}

/** Health reports stale when the newest market update is older than this. */
const STALE_MS = 5 * 60_000;
const PAGE_MAX_AGE = 30;
const API_MAX_AGE = 15;
const ASSET_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;
/** Rows in the homepage's verified ranking, and in /v1/verified. The original plan asked for ten. */
const VERIFIED_LIMIT = 10;

/** Public site and JSON API. Probe routes are handled before this in index.ts. */
export async function handleApp(request: Request, deps: AppDeps): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405, 0);
  }
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  const now = deps.now();
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);

  try {
    if (path === "/") {
      const [overview, pairs, verified] = await Promise.all([
        deps.data.overview(),
        deps.data.screener({ ...DEFAULT_FILTERS, limit: 12 }),
        // Precomputed nightly, so this is one indexed read rather than ~650 replays per request.
        deps.data.verifiedPairs(VERIFIED_LIMIT),
      ]);
      return page(pages.home({ overview, pairs, verified, now }));
    }

    if (path === "/screener") {
      const filters = parseScreenerFilters(url.searchParams);
      const [overview, pairs] = await Promise.all([
        deps.data.overview(),
        deps.data.screener(filters),
      ]);
      return page(pages.screener({ overview, pairs, filters, now }));
    }

    // Renamed from /heatmap: every other nav item is a plain noun naming its contents, and
    // "heatmap" in perp trading means a liquidation heatmap, which Phase 4 may yet build. The old
    // paths redirect rather than 404, and the internal identifiers keep the heatmap spelling
    // because the rendering genuinely is one.
    if (path === "/heatmap") return redirect(`/rates${url.search}`);
    if (path === "/v1/heatmap") return redirect(`/v1/rates${url.search}`);

    if (path === "/rates") {
      const params = parseHeatmapParams(url.searchParams);
      const [overview, cells] = await Promise.all([
        deps.data.overview(),
        deps.data.heatmap({
          limit: params.limit,
          offset: params.offset,
          minVenues: HEATMAP_MIN_VENUES,
        }),
      ]);
      return page(pages.heatmap({ overview, cells, params, now }));
    }

    if (path === "/markets") {
      const [overview, exchanges] = await Promise.all([
        deps.data.overview(),
        deps.data.exchanges(),
      ]);
      return page(pages.exchanges({ overview, exchanges, now }));
    }

    if (segments[0] === "markets" && segments[1] === "exchange" && segments.length === 3) {
      const venue = VENUE_BY_ID.get((segments[2] as string).toLowerCase());
      if (!venue)
        return page(pages.notFound(path, now, "There's no exchange with that name."), 404);
      return page(pages.exchange({ venue, markets: await deps.data.exchange(venue.id), now }));
    }

    if (segments[0] === "markets" && segments[1] === "asset" && segments.length === 3) {
      const asset = (segments[2] as string).toUpperCase();
      const markets = ASSET_PATTERN.test(asset) ? await deps.data.asset(asset) : [];
      if (markets.length === 0) {
        return page(
          pages.notFound(path, now, `No exchange has a live ${asset} perpetual right now.`),
          404,
        );
      }
      return page(pages.asset({ asset, markets, now }));
    }

    if (path === "/v1/health") {
      const overview = await deps.data.overview();
      const updatedAt = overview.updated_at?.getTime() ?? null;
      const ok = updatedAt !== null && now - updatedAt < STALE_MS;
      return json(
        {
          ok,
          service: "airates",
          time: new Date(now).toISOString(),
          markets: overview.markets,
          updatedAt: overview.updated_at,
        },
        ok ? 200 : 503,
        0,
      );
    }

    if (path === "/v1/venues") return json(VENUES);

    if (path === "/v1/screener") {
      const filters = parseScreenerFilters(url.searchParams);
      const pairs = await deps.data.screener(filters);
      return json({ filters, query: filtersToQuery(filters), count: pairs.length, pairs });
    }

    if (path === "/v1/exchanges") return json({ exchanges: await deps.data.exchanges() });

    if (path === "/v1/verified") {
      const pairs = await deps.data.verifiedPairs(VERIFIED_LIMIT);
      return json({ count: pairs.length, runDay: pairs[0]?.run_day ?? null, pairs });
    }

    if (path === "/v1/rates") {
      const params = parseHeatmapParams(url.searchParams);
      const cells = await deps.data.heatmap({
        limit: params.limit,
        offset: params.offset,
        minVenues: HEATMAP_MIN_VENUES,
      });
      return json({ params, query: heatmapToQuery(params), count: cells.length, cells });
    }

    if (segments[0] === "v1" && segments[1] === "exchanges" && segments.length === 3) {
      const venue = VENUE_BY_ID.get((segments[2] as string).toLowerCase());
      if (!venue) return json({ error: "unknown_exchange" }, 404);
      const markets = await deps.data.exchange(venue.id);
      return json({ exchange: { id: venue.id, name: venue.name, type: venue.type }, markets });
    }

    if (segments[0] === "v1" && segments[1] === "assets" && segments.length === 3) {
      const asset = (segments[2] as string).toUpperCase();
      const markets = ASSET_PATTERN.test(asset) ? await deps.data.asset(asset) : [];
      if (markets.length === 0) return json({ error: "no_live_markets", asset }, 404);
      return json({ asset, markets });
    }

    if (
      segments[0] === "v1" &&
      segments[1] === "pairs" &&
      segments[3] === "backtest" &&
      segments.length === 4
    ) {
      const asset = (segments[2] as string).toUpperCase();
      const params = parseBacktestParams(url.searchParams);
      if (!params) {
        return json(
          { error: "bad_request", detail: "long and short must name two different exchanges" },
          400,
          0,
        );
      }
      const markets = ASSET_PATTERN.test(asset) ? await deps.data.asset(asset) : [];
      const long = pickMarket(markets, params.longVenueId);
      const short = pickMarket(markets, params.shortVenueId);
      if (!long || !short) {
        return json(
          {
            error: "no_live_market",
            asset,
            missing: [long ? null : params.longVenueId, short ? null : params.shortVenueId].filter(
              Boolean,
            ),
          },
          404,
        );
      }

      // The challenge goes here: after the request is known to be answerable, and before the only
      // expensive call. Challenging a request that was about to 400 or 404 would burn a
      // single-use token on an error. Anything reaching this line is already a cache miss, because
      // index.ts answers from the edge cache before handleApp runs.
      if (deps.verifyToken) {
        // A header, never a query parameter: the cache keys on the full URL, so a token in the
        // query string would miss cache on every request and would bake a 300-second credential
        // into a shareable link.
        const verdict = await deps.verifyToken(
          request.headers.get(TURNSTILE_FIELD),
          request.headers.get("cf-connecting-ip"),
        );
        if (!verdict.ok) {
          deps.log?.(
            `turnstile refused ${asset}: ${verdict.reason}${verdict.errorCodes?.length ? ` (${verdict.errorCodes.join(", ")})` : ""}`,
          );
          // Never cached: a cached rejection would lock out a legitimate caller for the whole TTL.
          return json(
            {
              error: "challenge_required",
              reason: verdict.reason,
              detail: `Solve the Turnstile challenge and send the token in the ${TURNSTILE_FIELD} header. Results already cached are served without one.`,
            },
            403,
            0,
          );
        }
      }

      const result = await runBacktest(deps, long, short, params, now);
      // Funding settles hourly at most, so an hour-old answer is still the same answer.
      return json({ asset, request: params, ...result }, 200, 3600);
    }

    if (segments[0] === "pair" && segments.length === 2) {
      const asset = (segments[1] as string).toUpperCase();
      const markets = ASSET_PATTERN.test(asset) ? await deps.data.asset(asset) : [];
      if (markets.length === 0) {
        return page(
          pages.notFound(path, now, `No exchange has a live ${asset} perpetual right now.`),
          404,
        );
      }
      const params = parseBacktestParams(url.searchParams);
      const long = params ? pickMarket(markets, params.longVenueId) : undefined;
      const short = params ? pickMarket(markets, params.shortVenueId) : undefined;
      // Only the two chosen legs need ladders, and only when there is a pair to price at all.
      const [result, tiers] = await Promise.all([
        params && long && short ? runBacktest(deps, long, short, params, now) : null,
        long && short ? deps.data.leverageTiers([long, short]) : [],
      ]);
      return page(pages.pair({ asset, markets, params, result, tiers, now }));
    }

    if (path === "/robots.txt") {
      // Pre-launch: keep the site out of search engines until the legal checklist is done.
      return new Response("User-agent: *\nDisallow: /\n", {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      });
    }

    if (segments[0] === "v1") return json({ error: "not_found" }, 404);
    return page(pages.notFound(path, now), 404);
  } catch (error) {
    deps.log?.(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    return segments[0] === "v1"
      ? json({ error: "data_unavailable" }, 503, 0)
      : page(pages.unavailable(path, now), 503);
  }
}

/**
 * A permanent move, cached like a page: the rename is settled, so there is no reason to ask the
 * edge or a browser to re-check it. Query strings are carried through so a shared
 * /heatmap?tf=60d link lands on the same view it named.
 */
function redirect(location: string): Response {
  return new Response(null, {
    status: 301,
    headers: { location, "cache-control": `public, max-age=${PAGE_MAX_AGE}` },
  });
}

/** Shared by the JSON endpoint and the page, so the two can't drift apart. */
async function runBacktest(
  deps: AppDeps,
  long: MarketRow,
  short: MarketRow,
  params: BacktestParams,
  now: number,
) {
  const toMs = now;
  const fromMs = now - params.days * 86_400_000;
  const rows = await deps.data.settlements([long, short], fromMs, toMs);
  const leg = (market: MarketRow) => ({
    venueId: market.venue_id,
    venueSymbol: market.venue_symbol,
    settlements: rows
      .filter((r) => r.venue_id === market.venue_id && r.venue_symbol === market.venue_symbol)
      .map((r) => ({
        settledAt: r.settled_at.getTime(),
        rate: r.rate,
        basisHours: r.basis_hours,
      })),
  });
  // Both legs must carry a fee before costs mean anything: charging one leg and not the other
  // would understate a round trip by half, which is worse than reporting nothing.
  const fees =
    params.longTakerBps !== null && params.shortTakerBps !== null
      ? { longTakerBps: params.longTakerBps, shortTakerBps: params.shortTakerBps }
      : undefined;
  return backtestPair({
    long: leg(long),
    short: leg(short),
    sizeUsd: params.sizeUsd,
    fromMs,
    toMs,
    ...(fees ? { fees } : {}),
  });
}

/**
 * One venue can list the same asset more than once (MEXC carries BTC_USDT and BTC_USDC), so pick
 * the deepest market rather than whichever happened to sort first.
 */
function pickMarket(markets: readonly MarketRow[], venueId: string): MarketRow | undefined {
  return markets
    .filter((market) => market.venue_id === venueId)
    .sort((a, b) => (b.open_interest_usd ?? 0) - (a.open_interest_usd ?? 0))[0];
}

function page(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": status === 200 ? `public, max-age=${PAGE_MAX_AGE}` : "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function json(body: unknown, status = 200, maxAge = API_MAX_AGE): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": status === 200 && maxAge > 0 ? `public, max-age=${maxAge}` : "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
