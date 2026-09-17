import { ASSET_CLASSES, type AssetClass, backtestDaily, dailyWindowStart } from "@ai-rates/core";
import { VENUES } from "@ai-rates/venues";
import { about } from "../web/about";
import type { FundingHistory } from "../web/funding-chart";
import { legal } from "../web/legal";
import { liquidations } from "../web/liquidations";
import * as pages from "../web/pages";
import { referralCta } from "../web/referral";
import { referralLinks } from "../web/referral-links";
import { tos } from "../web/tos";
import { VENUE_BY_ID } from "../web/venues";
import { type DataSource, type MarketRow, STALE_MS } from "./data";
import { type Referral, requestGeo } from "./geo";
import {
  arbitrageToQuery,
  type BacktestParams,
  DEFAULT_FILTERS,
  filtersToQuery,
  HEATMAP_MIN_VENUES,
  heatmapToQuery,
  LIQUIDATION_WINDOWS,
  liquidationsToQuery,
  parseArbitrageParams,
  parseBacktestDays,
  parseBacktestParams,
  parseHeatmapParams,
  parseLiquidationParams,
  parseScreenerFilters,
} from "./params";

export interface AppDeps {
  data: DataSource;
  now: () => number;
  log?: (message: string) => void;
  /**
   * Per-colo rate limit: resolves true when the request may proceed. Absent means no limit, which
   * is the case in tests and in local dev.
   */
  rateLimit?: (key: string) => Promise<boolean>;
  /** Venue id to referral link and code, from REFERRAL_LINKS. Absent or empty means no page shows a CTA. */
  referrals?: Readonly<Record<string, Referral>>;
}

const PAGE_MAX_AGE = 30;
const API_MAX_AGE = 15;
const ASSET_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;

interface AssetAddress {
  asset: string;
  /** Null when the URL names no class: the data layer resolves it (crypto first, else deepest). */
  assetClass: AssetClass | null;
}

/**
 * Reads an asset address from the path segments after the route name: `BB`, or `equity/BB`.
 *
 * The class is a path segment rather than a query parameter so that the pages' existing
 * `?long=&short=` links keep working unchanged. Null for anything malformed, which each route
 * answers exactly as it answers an asset nobody lists.
 */
function assetAddress(parts: readonly string[]): AssetAddress | null {
  const [first, second] = parts;
  if (parts.length === 1 && first !== undefined) {
    return ASSET_PATTERN.test(first) ? { asset: first.toUpperCase(), assetClass: null } : null;
  }
  if (parts.length === 2 && first !== undefined && second !== undefined) {
    const assetClass = ASSET_CLASSES.find((c) => c === first.toLowerCase());
    return assetClass && ASSET_PATTERN.test(second)
      ? { asset: second.toUpperCase(), assetClass }
      : null;
  }
  return null;
}

/** The asset's name for a not-found message, even when the address did not parse. */
const askedAsset = (parts: readonly string[]) => (parts.at(-1) ?? "").toUpperCase();
/** Rows in the homepage's verified ranking, and in /v1/verified. The original plan asked for ten. */
const VERIFIED_LIMIT = 10;

/** Public site and JSON API. Probe routes are handled before this in index.ts. */
export async function handleApp(request: Request, deps: AppDeps): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  const now = deps.now();
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);

  // Read-only: nothing on the site or the API accepts a write.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405, 0);
  }

  try {
    if (path === "/") {
      const [overview, pairs, verified, best] = await Promise.all([
        deps.data.overview(),
        deps.data.screener({ ...DEFAULT_FILTERS, limit: 12 }),
        // Precomputed nightly, so this is one indexed read rather than ~650 replays per request.
        //
        // Fail-soft, and ONLY here. The ranking is an extra section; the overview and the spreads
        // table are the page itself, so those still fail loudly. Without this catch a missing
        // market_pair_backtests -- the state of any deployment where the worker ships before the
        // collector has applied migration 011 -- would 503 the whole homepage over an optional
        // block, and would make the deploy order a correctness requirement rather than a preference.
        deps.data.verifiedPairs(VERIFIED_LIMIT).catch((error) => {
          deps.log?.(
            `verified ranking unavailable: ${error instanceof Error ? error.message : String(error)}`,
          );
          return [];
        }),
        // Fail-soft for the same reason: without it the page falls back to the live widest spread.
        deps.data.bestVerifiedPair().catch((error) => {
          deps.log?.(
            `headline pair unavailable: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        }),
      ]);
      return page(pages.home({ overview, pairs, verified, best, now }));
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

    // The phase's actual title: where one venue's bid sits above another's ask. Only three venues
    // publish top of book, so this reads far fewer rows than the rates grid.
    if (path === "/arbitrage") {
      const params = parseArbitrageParams(url.searchParams);
      const [overview, rows] = await Promise.all([
        deps.data.overview(),
        deps.data.arbitrage(params),
      ]);
      return page(pages.arbitrage({ overview, rows, params, now }));
    }

    if (path === "/liquidations") {
      const params = parseLiquidationParams(url.searchParams);
      const { hours, bucketHours } = LIQUIDATION_WINDOWS[params.window];
      const [overview, map] = await Promise.all([
        deps.data.overview(),
        deps.data.liquidationMap({ windowHours: hours, bucketHours, assets: params.assets }),
      ]);
      return page(liquidations({ overview, map, params, now }));
    }

    if (segments[0] === "price-pair" && (segments.length === 2 || segments.length === 3)) {
      const address = assetAddress(segments.slice(1));
      const asset = address?.asset ?? askedAsset(segments);
      const [overview, quotes] = await Promise.all([
        deps.data.overview(),
        address ? deps.data.priceQuotes(address.asset, address.assetClass) : [],
      ]);
      const [first] = quotes;
      if (!first) {
        return page(
          pages.notFound(path, now, `No exchange is quoting a ${asset} book right now.`),
          404,
        );
      }
      return page(pages.pricePair({ asset, assetClass: first.asset_class, quotes, overview, now }));
    }

    if (path === "/about") {
      return page(about({ overview: await deps.data.overview(), now }));
    }

    if (path === "/legal") {
      return page(legal({ overview: await deps.data.overview(), now }));
    }

    if (path === "/tos") {
      return page(tos({ overview: await deps.data.overview(), now }));
    }

    if (path === "/referrals") {
      return page(
        referralLinks({
          overview: await deps.data.overview(),
          now,
          geo: requestGeo(request),
          links: deps.referrals ?? {},
        }),
      );
    }

    if (path === "/status") {
      const [overview, venues, checks] = await Promise.all([
        deps.data.overview(),
        deps.data.venueStatus(),
        // Fail-soft, for the reason the homepage's verified ranking is: a missing
        // market_identity_checks is the state of any deployment where the worker ships before
        // migration 015 has been applied. Verification is a section of this page; collector health
        // is the page itself. And a 503 here would be the worst possible one -- /status is where a
        // reader goes to diagnose exactly the sort of half-finished deploy that caused it.
        // Null, not an empty array: "no market diverges" and "we have not checked" are different
        // claims, and only one of them is reassuring. The page must not report a clean bill of
        // health it never actually took.
        deps.data.identityChecks().catch((error) => {
          deps.log?.(
            `identity checks unavailable: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        }),
      ]);
      return page(pages.status({ overview, venues, checks, now }));
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
      // The status line reads the overview; without it the page claimed no venue had reported.
      const [overview, markets] = await Promise.all([
        deps.data.overview(),
        deps.data.exchange(venue.id),
      ]);
      const cta = referralCta(venue, deps.referrals?.[venue.id], requestGeo(request));
      return page(pages.exchange({ venue, markets, overview, now, cta }));
    }

    if (
      segments[0] === "markets" &&
      segments[1] === "asset" &&
      (segments.length === 3 || segments.length === 4)
    ) {
      const address = assetAddress(segments.slice(2));
      const asset = address?.asset ?? askedAsset(segments);
      const [overview, markets] = await Promise.all([
        deps.data.overview(),
        address ? deps.data.asset(address.asset, address.assetClass) : [],
      ]);
      const [first] = markets;
      if (!first) {
        return page(
          pages.notFound(path, now, `No exchange has a live ${asset} perpetual right now.`),
          404,
        );
      }
      return page(pages.asset({ asset, assetClass: first.asset_class, markets, overview, now }));
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

    if (path === "/v1/status") {
      const [venues, checks] = await Promise.all([
        deps.data.venueStatus(),
        // Fail-soft for the same reason as the page above; a consumer polling venue health must not
        // lose it because the verification table is not there yet.
        deps.data.identityChecks().catch(() => null),
      ]);
      return json({ count: venues.length, venues, identity_checks: checks });
    }

    if (path === "/v1/liquidations") {
      const params = parseLiquidationParams(url.searchParams);
      const { hours, bucketHours } = LIQUIDATION_WINDOWS[params.window];
      const map = await deps.data.liquidationMap({
        windowHours: hours,
        bucketHours,
        assets: params.assets,
      });
      return json({
        params,
        query: liquidationsToQuery(params),
        count: map.cells.length,
        venues: map.totals,
        assets: map.assets,
        cells: map.cells,
      });
    }

    if (path === "/v1/arbitrage") {
      const params = parseArbitrageParams(url.searchParams);
      const rows = await deps.data.arbitrage(params);
      return json({ params, query: arbitrageToQuery(params), count: rows.length, rows });
    }

    if (
      segments[0] === "v1" &&
      segments[1] === "price-pair" &&
      (segments.length === 3 || segments.length === 4)
    ) {
      const address = assetAddress(segments.slice(2));
      const asset = address?.asset ?? askedAsset(segments);
      const quotes = address ? await deps.data.priceQuotes(address.asset, address.assetClass) : [];
      return json({
        asset,
        asset_class: quotes[0]?.asset_class ?? address?.assetClass ?? null,
        count: quotes.length,
        quotes,
      });
    }

    if (segments[0] === "v1" && segments[1] === "exchanges" && segments.length === 3) {
      const venue = VENUE_BY_ID.get((segments[2] as string).toLowerCase());
      if (!venue) return json({ error: "unknown_exchange" }, 404);
      const markets = await deps.data.exchange(venue.id);
      return json({ exchange: { id: venue.id, name: venue.name, type: venue.type }, markets });
    }

    if (
      segments[0] === "v1" &&
      segments[1] === "assets" &&
      (segments.length === 3 || segments.length === 4)
    ) {
      const address = assetAddress(segments.slice(2));
      const asset = address?.asset ?? askedAsset(segments);
      const markets = address ? await deps.data.asset(address.asset, address.assetClass) : [];
      const [first] = markets;
      if (!first) return json({ error: "no_live_markets", asset }, 404);
      return json({ asset, asset_class: first.asset_class, markets });
    }

    if (
      segments[0] === "v1" &&
      segments[1] === "pairs" &&
      segments.at(-1) === "backtest" &&
      (segments.length === 4 || segments.length === 5)
    ) {
      const address = assetAddress(segments.slice(2, -1));
      const asset = address?.asset ?? askedAsset(segments.slice(0, -1));
      // Ahead of everything, including validation: the point is to bound volume, and the limiter
      // costs far less than the database read below.
      if (!(await withinRate(deps, request, "backtest"))) {
        return retryLater(
          json({ error: "rate_limited", detail: "Too many backtests from this address." }, 429, 0),
        );
      }
      const params = parseBacktestParams(url.searchParams);
      if (!params) {
        return json(
          { error: "bad_request", detail: "long and short must name two different exchanges" },
          400,
          0,
        );
      }
      const markets = address ? await deps.data.asset(address.asset, address.assetClass) : [];
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

      const result = await runBacktest(deps, long, short, params, now);
      // The rollup refreshes hourly, so an hour-old answer is still the same answer.
      return json({ asset, request: params, ...result }, 200, 3600);
    }

    if (segments[0] === "pair" && (segments.length === 2 || segments.length === 3)) {
      const address = assetAddress(segments.slice(1));
      const asset = address?.asset ?? askedAsset(segments);
      const requested = parseBacktestParams(url.searchParams);
      const days = requested?.days ?? parseBacktestDays(url.searchParams);
      // Only a request that computes a backtest is limited; browsing /pair/:asset to pick two legs
      // stays free.
      if (requested && !(await withinRate(deps, request, "pair"))) {
        return retryLater(page(pages.tooMany(path, now), 429));
      }
      const markets = address ? await deps.data.asset(address.asset, address.assetClass) : [];
      const [first] = markets;
      if (!first) {
        return page(
          pages.notFound(path, now, `No exchange has a live ${asset} perpetual right now.`),
          404,
        );
      }
      const assetClass = first.asset_class;
      const params = requested;
      const long = params ? pickMarket(markets, params.longVenueId) : undefined;
      const short = params ? pickMarket(markets, params.shortVenueId) : undefined;
      // Only the two chosen legs need ladders, and only when there is a pair to price at all. The
      // chart reads every listed market, legs or not.
      const [result, tiers, history, overview] = await Promise.all([
        params && long && short ? runBacktest(deps, long, short, params, now) : null,
        long && short ? deps.data.leverageTiers([long, short]) : [],
        fundingHistory(deps, markets, days, now),
        // The status line reads it; without it the page claimed no venue had reported.
        deps.data.overview(),
      ]);
      return page(
        pages.pair({
          asset,
          assetClass,
          markets,
          params,
          days,
          result,
          tiers,
          history,
          overview,
          origin: url.origin,
          now,
        }),
      );
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
 * Per-colo rate limit, when a binding is present.
 *
 * Cloudflare's limiter is per-location, so this bounds one client hammering one colo, which is what
 * a scraper looks like. A distributed caller gets past it, and that is now acceptable: a backtest is
 * a read of two markets' daily rollup, not a replay. Keyed on the connecting IP within a named
 * bucket, so the page and the API do not share an allowance.
 */
async function withinRate(deps: AppDeps, request: Request, bucket: string): Promise<boolean> {
  if (!deps.rateLimit) return true;
  const ip = request.headers.get("cf-connecting-ip") ?? "anonymous";
  return deps.rateLimit(`${bucket}:${ip}`);
}

/** The limiter's window, as BACKTEST_LIMITER declares it in wrangler.jsonc. */
const RATE_PERIOD_SECONDS = 60;

/**
 * Says when a limited caller may ask again. The page's backtest button polls until its report is
 * ready (web/await.ts) and waits this long rather than spending more of the allowance on retries.
 */
function retryLater(response: Response): Response {
  response.headers.set("retry-after", String(RATE_PERIOD_SECONDS));
  return response;
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

/**
 * Shared by the JSON endpoint and the page, so the two can't drift apart.
 *
 * Reads the collector's daily rollup instead of replaying settlements: two markets times at most 60
 * small rows, where the replay walked every settlement in the window. That is what let the
 * Turnstile gate go -- there is no expensive path left for it to protect.
 */
async function runBacktest(
  deps: AppDeps,
  long: MarketRow,
  short: MarketRow,
  params: BacktestParams,
  now: number,
) {
  const fromMs = dailyWindowStart(now, params.days);
  const rows = await deps.data.dailyFunding(
    [long, short],
    new Date(fromMs).toISOString().slice(0, 10),
  );
  const leg = (market: MarketRow) => ({
    venueId: market.venue_id,
    venueSymbol: market.venue_symbol,
    days: rows
      .filter((r) => r.venue_id === market.venue_id && r.venue_symbol === market.venue_symbol)
      .map((r) => ({
        date: r.day,
        rateSum: r.rate_sum,
        basisHoursSum: r.basis_hours_sum,
        settlements: r.settlements,
      })),
  });
  // Both legs must carry a fee before costs mean anything: charging one leg and not the other
  // would understate a round trip by half, which is worse than reporting nothing.
  const fees =
    params.longTakerBps !== null && params.shortTakerBps !== null
      ? { longTakerBps: params.longTakerBps, shortTakerBps: params.shortTakerBps }
      : undefined;
  return backtestDaily({
    long: leg(long),
    short: leg(short),
    sizeUsd: params.sizeUsd,
    fromMs,
    toMs: now,
    ...(fees ? { fees } : {}),
  });
}

/** The longest window the chart draws from the hourly rollup; beyond it the grain is a day. */
const HOURLY_CHART_MAX_DAYS = 7;

/**
 * Every listed market's funding over the window, for the pair page's comparison chart: hourly up to
 * a week, daily beyond. Fail-soft, like the verified ranking: the chart is one section of the page,
 * and the hourly rollup exists only once the collector has applied migration 014, so a missing table
 * must cost the chart and never the backtest beside it.
 */
async function fundingHistory(
  deps: AppDeps,
  markets: readonly MarketRow[],
  days: number,
  now: number,
): Promise<FundingHistory | null> {
  const fromMs = dailyWindowStart(now, days);
  try {
    if (days <= HOURLY_CHART_MAX_DAYS) {
      const rows = await deps.data.hourlyFunding(markets, fromMs);
      return {
        grain: "hour",
        fromMs,
        toMs: now,
        buckets: rows.map((row) => ({
          venue_id: row.venue_id,
          venue_symbol: row.venue_symbol,
          atMs: row.hour_ms,
          rate_sum: row.rate_sum,
          basis_hours_sum: row.basis_hours_sum,
        })),
      };
    }
    const rows = await deps.data.dailyFunding(markets, new Date(fromMs).toISOString().slice(0, 10));
    return {
      grain: "day",
      fromMs,
      toMs: now,
      buckets: rows.map((row) => ({
        venue_id: row.venue_id,
        venue_symbol: row.venue_symbol,
        atMs: Date.parse(`${row.day}T00:00:00Z`),
        rate_sum: row.rate_sum,
        basis_hours_sum: row.basis_hours_sum,
      })),
    };
  } catch (error) {
    deps.log?.(
      `funding chart unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
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
