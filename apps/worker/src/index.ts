import postgres from "postgres";
import { handleApp } from "./app/app";
import { createClearance } from "./app/clearance";
import { createDataSource } from "./app/data";
import { verifyTurnstile } from "./app/turnstile";
import { ProbeDO } from "./probe/probe-do";
import { handleProbe } from "./probe/routes";

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
      // A narrow cast at the one boundary that needs it. Worker secrets are not in wrangler.jsonc,
      // so `wrangler types` cannot know about them, and declaring TURNSTILE_SECRET as a var to get
      // the type would overwrite the real secret with that value on deploy.
      const secret = (env as { TURNSTILE_SECRET?: string }).TURNSTILE_SECRET?.trim();
      const response = await handleApp(request, {
        data,
        now: Date.now,
        log: console.error,
        sitekey: env.TURNSTILE_SITEKEY,
        // Per-colo, so a blunt first filter rather than a real bound; Turnstile carries the load.
        rateLimit: async (key: string) => (await env.BACKTEST_LIMITER.limit({ key })).success,
        // No secret configured means no challenge, which is what lets `wrangler dev` work. It also
        // means production is ungated until the secret is set. The clearance cookie is keyed on the
        // same secret, so both halves of the gate appear and disappear together.
        ...(secret
          ? {
              verifyToken: (token: string | null, remoteip: string | null) =>
                verifyTurnstile(token, { secret, remoteip }),
              clearance: createClearance(secret),
            }
          : {}),
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
