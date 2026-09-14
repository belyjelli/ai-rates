import postgres from "postgres";
import { handleApp } from "./app/app";
import { createDataSource } from "./app/data";
import { visitPoint } from "./app/visits";
import { ProbeDO } from "./probe/probe-do";
import { handleProbe } from "./probe/routes";

export { ProbeDO };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const probe = await handleProbe(request, env);
    if (probe) return probe;

    // Ahead of the cache: a page served from it never reaches the app, and would go uncounted.
    const visit = visitPoint(request, request.cf?.country);
    if (visit) env.ANAL.writeDataPoint(visit);

    const cache = caches.default;
    if (request.method === "GET") {
      const hit = await cache.match(request);
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
      });
      if (request.method === "GET" && response.status === 200) {
        ctx.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } finally {
      const open = sql as postgres.Sql | null;
      if (open) ctx.waitUntil(open.end());
    }
  },
} satisfies ExportedHandler<Env>;
