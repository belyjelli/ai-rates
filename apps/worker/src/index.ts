import postgres from "postgres";
import { handleApp } from "./app/app";
import { createDataSource } from "./app/data";
import { geoCacheBucket, requestGeo } from "./app/geo";
import { visitPoint } from "./app/visits";
import { ProbeDO } from "./probe/probe-do";
import { handleProbe } from "./probe/routes";
import { handleAdmin } from "./referrals/admin";
import { adminCredentials } from "./referrals/auth";
import { forgetReferrals, loadReferrals } from "./referrals/load";
import { ReferralStoreDO, referralStore } from "./referrals/store-do";

export { ProbeDO, ReferralStoreDO };

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
    if (request.method === "GET") {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    // One connection per request, opened only if a route needs data; Hyperdrive pools the real ones.
    let sql: postgres.Sql | null = null;
    const data = createDataSource(() => {
      sql ??= postgres(env.HYPERDRIVE.connectionString, {
        max: 5,
        fetch_types: false,
        prepare: true,
      });
      return sql;
    });

    try {
      const response = await handleApp(request, {
        data,
        now: Date.now,
        log: console.error,
        // Per-colo, so a blunt filter against one client hammering one location. Backtests read
        // the collector's daily rollup, so nothing behind it is expensive enough to need more.
        rateLimit: async (key: string) => (await env.BACKTEST_LIMITER.limit({ key })).success,
        referrals,
      });
      if (request.method === "GET" && response.status === 200) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    } finally {
      const open = sql as postgres.Sql | null;
      if (open) ctx.waitUntil(open.end());
    }
  },
} satisfies ExportedHandler<Env>;
