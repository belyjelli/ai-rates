import postgres from "postgres";
import { handleApp, unavailableResponse } from "./app/app";
import { createDataSource } from "./app/data";
import { EdgeCache } from "./app/edge-cache";
import { geoCacheBucket, requestGeo } from "./app/geo";
import { withSecurityHeaders } from "./app/security-headers";
import { visitPoint } from "./app/visits";
import { ProbeDO } from "./probe/probe-do";
import { handleProbe } from "./probe/routes";
import { handleAdmin } from "./referrals/admin";
import { adminCredentials } from "./referrals/auth";
import { forgetReferrals, loadReferrals } from "./referrals/load";
import { ReferralStoreDO, referralStore } from "./referrals/store-do";
import { DEFAULT_LOCALE, languageSwitch, requestLocale } from "./web/i18n";
import { htmlToMarkdown, wantsMarkdown } from "./web/markdown";

export { ProbeDO, ReferralStoreDO };

// Module scope, so the renders in flight and the cooldowns are shared by every request this isolate
// serves. That sharing is the point: it is what stops N readers of one cold page becoming N renders.
const edge = new EdgeCache();

export default {
  // Every response leaves through withSecurityHeaders (app/security-headers.ts). Rendered pages carry
  // their CSP already -- it is computed in `render` so the cached copy stores it -- so for them this
  // only adds what is missing; the probe, admin and language-switch responses, the unavailable page,
  // and copies cached before the headers existed get theirs here.
  async fetch(request, env, ctx): Promise<Response> {
    return withSecurityHeaders(await handle(request, env, ctx));
  },
} satisfies ExportedHandler<Env>;

async function handle(
  request: Request<unknown, IncomingRequestCfProperties>,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const probe = await handleProbe(request, env);
  if (probe) return probe;

  // Before the page cache and the visit count: the admin form is private, never cached, never counted.
  const admin = await handleAdmin(request, {
    store: referralStore(env),
    credentials: adminCredentials(env.ADMIN_USER, env.ADMIN_PASSWORD),
    // The same per-location limiter the backtest uses, under its own key: a password on a public
    // URL needs guessing to be slow, and 20 attempts a minute per colo is not a guessing rate.
    rateLimit: async (key: string) => (await env.BACKTEST_LIMITER.limit({ key })).success,
    clientKey: request.headers.get("cf-connecting-ip") ?? "anonymous",
    onSaved: forgetReferrals,
  });
  if (admin) return admin;

  // The footer's language switch sets a cookie and goes back: never cached, and not a page view.
  const switched = languageSwitch(request);
  if (switched) return switched;

  // Ahead of the cache: a page served from it never reaches the app, and would go uncounted.
  const visit = visitPoint(request, request.cf?.country);
  if (visit) env.ANAL.writeDataPoint(visit);

  // Entered at /admin/referrals and kept in ReferralStoreDO. Affiliate IDs are configuration, never
  // code; with none saved, no page renders a referral CTA.
  const referrals = await loadReferrals(referralStore(env), Date.now(), console.error);

  // Keyed by the visitor's CTA bucket as well as the URL once referral links exist, or a page
  // rendered with a CTA for one country would be served from cache to a visitor where it is barred.
  // While none is configured the bucket is constant and the key stays the bare URL.
  //
  // Keyed by language for the same reason: a page rendered in Chinese must never reach a reader who
  // chose English. English keeps the bare URL, so its existing copies stay valid across this change.
  const cache = caches.default;
  const bucket = geoCacheBucket(requestGeo(request), Object.keys(referrals).length > 0);
  const locale = requestLocale(request);
  let cacheKey: Request = request;
  if (bucket !== "any" || locale !== DEFAULT_LOCALE) {
    const keyed = new URL(request.url);
    if (bucket !== "any") keyed.searchParams.set("__cta", bucket);
    if (locale !== DEFAULT_LOCALE) keyed.searchParams.set("__lang", locale);
    cacheKey = new Request(keyed.toString(), request);
  }
  // What the page needs from the database is rendered at most once per URL at a time, served stale
  // while it refreshes, and replaced by the last good copy if it fails (app/edge-cache.ts).
  const render = async (): Promise<Response> => {
    // One connection per render, opened only if a route needs data; Hyperdrive pools the real ones.
    let sql: postgres.Sql | null = null;
    const data = createDataSource(() => {
      sql ??= postgres(env.HYPERDRIVE.connectionString, {
        // ONE connection per render. A page runs three to five queries at once, and with `max: 5`
        // each took a pooled connection of its own. The Hyperdrive config allows only
        // `origin_connection_limit` of them -- 5 when this was written, the minimum; the plan allows
        // about 20 -- so one page load could take the whole pool, and the next waited 15 s for a
        // connection and answered "data center busy". Measured 2026-10-04 with five concurrent
        // requests and no slow query in sight. Over one connection the queries are pipelined and
        // run back to back (each is tens of milliseconds now), a failing one still leaves the
        // others alone (the homepage's fail-soft sections rely on that), and a render costs one
        // slot of the pool instead of five.
        max: 1,
        // Under Hyperdrive's own 15 s: a pool that cannot hand out a connection fails here.
        connect_timeout: 10,
        fetch_types: false,
        prepare: true,
      });
      return sql;
    });
    try {
      // The policy is hashed from this render's own inline scripts and cached with it.
      return await withSecurityHeaders(
        await handleApp(request, {
          data,
          now: Date.now,
          log: console.error,
          // Per-colo, so a blunt filter against one client hammering one location. Backtests read
          // the collector's daily rollup, so nothing behind it is expensive enough to need more.
          rateLimit: async (key: string) => (await env.BACKTEST_LIMITER.limit({ key })).success,
          referrals,
          locale,
        }),
      );
    } finally {
      const open = sql as postgres.Sql | null;
      // A render that outlived its readers can leave a query running: give it five seconds to
      // finish and then cut the connections, rather than wait on it for as long as it takes.
      if (open) ctx.waitUntil(open.end({ timeout: 5 }));
    }
  };

  const response = await edge.serve({
    cache,
    key: cacheKey,
    request,
    waitUntil: (promise) => ctx.waitUntil(promise),
    render,
    unavailable: () => unavailableResponse(new URL(request.url).pathname, Date.now(), locale),
    log: console.error,
  });
  return varyByLanguage(await asMarkdown(request, response));
}

/**
 * Tells the BROWSER that a page depends on the language cookie and Accept-Language. A page may sit in
 * the browser's cache for its max-age; without this, switching language and landing back on the same
 * address could show the copy from before the switch. Added here, after the edge cache, so the copies
 * that cache stores never carry it -- that cache is keyed by language explicitly (above). Pages only:
 * the JSON API reads the same in every language.
 */
function varyByLanguage(response: Response): Response {
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("text/html") && !type.startsWith("text/markdown")) return response;
  const out = new Response(response.body, response);
  out.headers.append("vary", "Cookie, Accept-Language, Accept");
  return out;
}

/**
 * The page as Markdown for a caller that asked for it (`Accept: text/markdown`). Done after the edge
 * cache, so the cache keeps one HTML copy per URL and the conversion is cheap string work on it.
 * Anything that is not a 200 page with a <main> goes out unchanged.
 */
async function asMarkdown(request: Request, response: Response): Promise<Response> {
  if (
    request.method !== "GET" ||
    response.status !== 200 ||
    !wantsMarkdown(request.headers.get("accept")) ||
    !response.headers.get("content-type")?.startsWith("text/html")
  ) {
    return response;
  }
  const markdown = htmlToMarkdown(await response.clone().text(), request.url);
  if (markdown === null) return response;
  const out = new Response(markdown, response);
  out.headers.set("content-type", "text/markdown; charset=utf-8");
  out.headers.delete("content-length");
  out.headers.set("x-markdown-tokens", String(Math.ceil(markdown.length / 4)));
  return out;
}
