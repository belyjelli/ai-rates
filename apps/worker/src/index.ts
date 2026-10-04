import postgres from "postgres";
import { handleApp, unavailableResponse } from "./app/app";
import { createDataSource } from "./app/data";
import { EdgeCache } from "./app/edge-cache";
import { geoCacheBucket, requestGeo } from "./app/geo";
import { visitPoint } from "./app/visits";
import { ProbeDO } from "./probe/probe-do";
import { handleProbe } from "./probe/routes";
import { handleAdmin } from "./referrals/admin";
import { adminCredentials } from "./referrals/auth";
import { forgetReferrals, loadReferrals } from "./referrals/load";
import { ReferralStoreDO, referralStore } from "./referrals/store-do";

export { ProbeDO, ReferralStoreDO };

// Module scope, so the renders in flight and the cooldowns are shared by every request this isolate
// serves. That sharing is the point: it is what stops N readers of one cold page becoming N renders.
const edge = new EdgeCache();

export default {
  async fetch(request, env, ctx): Promise<Response> {
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

    // Ahead of the cache: a page served from it never reaches the app, and would go uncounted.
    const visit = visitPoint(request, request.cf?.country);
    if (visit) env.ANAL.writeDataPoint(visit);

    // Entered at /admin/referrals and kept in ReferralStoreDO. Affiliate IDs are configuration, never
    // code; with none saved, no page renders a referral CTA.
    const referrals = await loadReferrals(referralStore(env), Date.now(), console.error);

    // Keyed by the visitor's CTA bucket as well as the URL once referral links exist, or a page
    // rendered with a CTA for one country would be served from cache to a visitor where it is barred.
    // While none is configured the bucket is constant and the key stays the bare URL.
    const cache = caches.default;
    const bucket = geoCacheBucket(requestGeo(request), Object.keys(referrals).length > 0);
    let cacheKey: Request = request;
    if (bucket !== "any") {
      const keyed = new URL(request.url);
      keyed.searchParams.set("__cta", bucket);
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
        return await handleApp(request, {
          data,
          now: Date.now,
          log: console.error,
          // Per-colo, so a blunt filter against one client hammering one location. Backtests read
          // the collector's daily rollup, so nothing behind it is expensive enough to need more.
          rateLimit: async (key: string) => (await env.BACKTEST_LIMITER.limit({ key })).success,
          referrals,
        });
      } finally {
        const open = sql as postgres.Sql | null;
        // A render that outlived its readers can leave a query running: give it five seconds to
        // finish and then cut the connections, rather than wait on it for as long as it takes.
        if (open) ctx.waitUntil(open.end({ timeout: 5 }));
      }
    };

    return edge.serve({
      cache,
      key: cacheKey,
      request,
      waitUntil: (promise) => ctx.waitUntil(promise),
      render,
      unavailable: () => unavailableResponse(new URL(request.url).pathname, Date.now()),
      log: console.error,
    });
  },
} satisfies ExportedHandler<Env>;
