import { VENUES } from "@ai-rates/venues";
import { ProbeDO } from "./probe/probe-do";
import { renderProbePage } from "./probe/render";
import { ALL_RUNNERS, DEFAULT_RUNNER, runnerStub } from "./probe/runners";

export { ProbeDO };

const MANUAL_RUN_COOLDOWN_MS = 10 * 60_000;

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    switch (`${request.method} ${pathname}`) {
      case "GET /":
        return html(renderProbePage(VENUES, await latestSnapshots(env), Date.now()));
      case "GET /v1/health":
        return json({ ok: true, service: "airates", time: new Date().toISOString() });
      case "GET /v1/venues":
        return json(VENUES);
      case "GET /v1/probe":
        return json(await latestSnapshots(env));
      case "POST /v1/probe/run": {
        const allowed = await runnerStub(env, DEFAULT_RUNNER).claimCooldown(
          "manual-run",
          MANUAL_RUN_COOLDOWN_MS,
        );
        if (!allowed) return json({ error: "cooldown" }, 429);
        return json({ scheduled: await scheduleAll(env) }, 202);
      }
      default:
        return json({ error: "not_found" }, 404);
    }
  },

  async scheduled(_controller, env): Promise<void> {
    await scheduleAll(env);
  },
} satisfies ExportedHandler<Env>;

/** Starts a run on every runner that isn't already mid-run; returns the names that started. */
async function scheduleAll(env: Env): Promise<string[]> {
  const started = await Promise.all(
    ALL_RUNNERS.map((runner) => runnerStub(env, runner).schedule(runner.name)),
  );
  return ALL_RUNNERS.filter((_, i) => started[i]).map((runner) => runner.name);
}

async function latestSnapshots(env: Env) {
  return Promise.all(
    ALL_RUNNERS.map(async (runner) => ({ runner, run: await runnerStub(env, runner).latest() })),
  );
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function html(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
