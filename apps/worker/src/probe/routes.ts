import { VENUES } from "@ai-rates/venues";
import { renderProbePage } from "./render";
import { ALL_RUNNERS, DEFAULT_RUNNER, runnerStub } from "./runners";

const MANUAL_RUN_COOLDOWN_MS = 10 * 60_000;

/** Phase 0 geo-probe routes; returns null for anything else. */
export async function handleProbe(request: Request, env: Env): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  switch (`${request.method} ${pathname}`) {
    case "GET /probe":
      return new Response(renderProbePage(VENUES, await latestSnapshots(env), Date.now()), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow",
        },
      });
    case "GET /v1/probe":
      return noStore(await latestSnapshots(env));
    case "POST /v1/probe/run": {
      const allowed = await runnerStub(env, DEFAULT_RUNNER).claimCooldown(
        "manual-run",
        MANUAL_RUN_COOLDOWN_MS,
      );
      if (!allowed) return noStore({ error: "cooldown" }, 429);
      return noStore({ scheduled: await scheduleAllProbes(env) }, 202);
    }
    default:
      return null;
  }
}

/** Starts a run on every runner that isn't already mid-run; returns the names that started. */
export async function scheduleAllProbes(env: Env): Promise<string[]> {
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

function noStore(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
