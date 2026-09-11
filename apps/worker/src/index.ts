import postgres from "postgres";
import { handleApp } from "./app/app";
import { createDataSource } from "./app/data";
import { ProbeDO } from "./probe/probe-do";
import { handleProbe, scheduleAllProbes } from "./probe/routes";

export { ProbeDO };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const probe = await handleProbe(request, env);
    if (probe) return probe;

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
      const response = await handleApp(request, { data, now: Date.now, log: console.error });
      if (request.method === "GET" && response.status === 200) {
        ctx.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } finally {
      const open = sql as postgres.Sql | null;
      if (open) ctx.waitUntil(open.end());
    }
  },

  async scheduled(_controller, env): Promise<void> {
    await scheduleAllProbes(env);
  },
} satisfies ExportedHandler<Env>;
