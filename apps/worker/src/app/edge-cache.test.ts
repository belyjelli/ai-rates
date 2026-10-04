import { describe, expect, test } from "bun:test";
import { CACHE_STATE, type CacheLike, EdgeCache, type EdgeCacheOptions } from "./edge-cache";

/** Cloudflare's cache as far as the code under test can tell: put keeps a copy, match hands out a new one. */
class FakeCache implements CacheLike {
  readonly entries = new Map<
    string,
    { status: number; headers: [string, string][]; body: string }
  >();
  puts = 0;
  async match(request: Request): Promise<Response | undefined> {
    const entry = this.entries.get(request.url);
    return entry
      ? new Response(entry.body, { status: entry.status, headers: entry.headers })
      : undefined;
  }
  async put(request: Request, response: Response): Promise<void> {
    this.puts++;
    this.entries.set(request.url, {
      status: response.status,
      headers: [...response.headers],
      body: await response.text(),
    });
  }
}

const URL_A = "https://www.airrates.net/cvd";

function harness(options: Partial<EdgeCacheOptions> = {}) {
  let now = 1_000_000;
  const cache = new FakeCache();
  const edge = new EdgeCache({ now: () => now, ...options });
  const background: Promise<unknown>[] = [];
  const logs: string[] = [];
  let renders = 0;
  const page = (
    body: string,
    headers: Record<string, string> = { "cache-control": "public, max-age=30" },
  ) => new Response(body, { status: 200, headers });

  const get = (render: () => Promise<Response>, url = URL_A, method = "GET") => {
    const request = new Request(url, { method });
    return edge.serve({
      cache,
      key: request,
      request,
      waitUntil: (promise) => void background.push(promise),
      render: () => {
        renders++;
        return render();
      },
      unavailable: () => new Response("busy", { status: 503 }),
      log: (line) => logs.push(line),
    });
  };
  return {
    cache,
    get,
    page,
    logs,
    renders: () => renders,
    advance: (ms: number) => {
      now += ms;
    },
    /** Lets every render and cache write that was handed to waitUntil finish. */
    settle: async () => {
      await Promise.all(background);
    },
  };
}

const state = (response: Response) => response.headers.get(CACHE_STATE);

describe("EdgeCache", () => {
  test("a miss renders, answers, and stores a copy that outlives its freshness", async () => {
    const h = harness();
    const response = await h.get(async () => h.page("one"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("one");
    expect(state(response)).toBe("miss");
    // The app's own max-age still reaches the browser on the render that made the copy.
    expect(response.headers.get("cache-control")).toBe("public, max-age=30");
    await h.settle();
    const stored = h.cache.entries.get(URL_A);
    expect(stored).toBeDefined();
    // The edge keeps it for an hour, so a database outage has something to fall back on.
    expect(Object.fromEntries(stored?.headers ?? [])["cache-control"]).toBe("public, max-age=3600");
  });

  test("a fresh copy is served without rendering, with its remaining freshness and its age", async () => {
    const h = harness();
    await h.get(async () => h.page("one"));
    await h.settle();
    h.advance(12_000);
    const response = await h.get(async () => h.page("two"));
    expect(await response.text()).toBe("one");
    expect(state(response)).toBe("hit");
    expect(h.renders()).toBe(1);
    // The page's live script times its next poll from Age, and the browser from max-age.
    expect(response.headers.get("age")).toBe("12");
    expect(response.headers.get("cache-control")).toBe("public, max-age=18");
  });

  test("a copy a little past fresh is served at once and refreshed behind the reader", async () => {
    const h = harness();
    await h.get(async () => h.page("one"));
    await h.settle();
    h.advance(45_000);
    const response = await h.get(async () => h.page("two"));
    expect(await response.text()).toBe("one");
    expect(state(response)).toBe("stale");
    // Stale copies tell the browser to ask again straight away, and the script to poll in a few seconds.
    expect(response.headers.get("cache-control")).toBe("public, max-age=0");
    expect(response.headers.get("age")).toBe("45");
    await h.settle();
    expect(h.renders()).toBe(2);
    const next = await h.get(async () => h.page("three"));
    expect(await next.text()).toBe("two");
    expect(state(next)).toBe("hit");
  });

  test("a stale reader never waits for the refresh, however slow it is", async () => {
    const h = harness();
    await h.get(async () => h.page("one"));
    await h.settle();
    h.advance(45_000);
    let release: (response: Response) => void = () => {};
    const slow = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const started = Date.now();
    const response = await h.get(() => slow);
    expect(await response.text()).toBe("one");
    expect(Date.now() - started).toBeLessThan(500);
    release(h.page("two"));
    await h.settle();
    expect((await h.get(async () => h.page("x"))).headers.get(CACHE_STATE)).toBe("hit");
  });

  test("simultaneous misses share one render", async () => {
    const h = harness();
    let release: (response: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const readers = Array.from({ length: 25 }, () => h.get(() => gate));
    release(h.page("shared"));
    const responses = await Promise.all(readers);
    expect(h.renders()).toBe(1);
    for (const response of responses) expect(await response.text()).toBe("shared");
    await h.settle();
    expect(h.cache.puts).toBe(1);
  });

  test("stale refreshes also share one render", async () => {
    const h = harness();
    await h.get(async () => h.page("one"));
    await h.settle();
    h.advance(60_000);
    let release: (response: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const readers = await Promise.all(Array.from({ length: 10 }, () => h.get(() => gate)));
    expect(readers.every((r) => state(r) === "stale")).toBe(true);
    release(h.page("two"));
    await h.settle();
    expect(h.renders()).toBe(2);
  });

  test("when the render fails, the last good copy is served instead of the busy page", async () => {
    const h = harness();
    await h.get(async () => h.page("good"));
    await h.settle();
    // Past the refresh window, so the reader has to wait on the render -- which fails.
    h.advance(10 * 60_000);
    const response = await h.get(async () => new Response("busy", { status: 503 }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("good");
    expect(state(response)).toBe("stale-error");
  });

  test("a render that throws is a failure, not a crash", async () => {
    const h = harness();
    await h.get(async () => h.page("good"));
    await h.settle();
    h.advance(10 * 60_000);
    const response = await h.get(async () => {
      throw new Error("connection refused");
    });
    expect(await response.text()).toBe("good");
    await h.settle();
    expect(h.logs.some((line) => line.includes("connection refused"))).toBe(true);
  });

  test("a slow render with a copy in hand is not waited for, and still lands in the cache", async () => {
    const h = harness({ slowMs: 20 });
    await h.get(async () => h.page("good"));
    await h.settle();
    h.advance(10 * 60_000);
    let release: (response: Response) => void = () => {};
    const slow = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const response = await h.get(() => slow);
    expect(await response.text()).toBe("good");
    expect(state(response)).toBe("stale-slow");
    // The slow render is still the URL's flight: the next reader joins it rather than starting another.
    const joined = h.get(async () => h.page("never rendered"));
    release(h.page("late"));
    await joined;
    await h.settle();
    expect(h.renders()).toBe(2);
    expect(await (await h.get(async () => h.page("x"))).text()).toBe("late");
  });

  test("a render that never settles stops being joined, so one lost render cannot wedge a URL", async () => {
    const h = harness({ slowMs: 10 });
    await h.get(async () => h.page("good"));
    await h.settle();
    h.advance(10 * 60_000);
    // This render is lost: its promise never settles, as when the runtime stops a request's background work.
    const lost = await h.get(() => new Promise<Response>(() => {}));
    expect(state(lost)).toBe("stale-slow");
    // Within the flight window the next reader joins it rather than starting a second render...
    h.advance(10_000);
    await h.get(async () => h.page("never rendered"));
    expect(h.renders()).toBe(2);
    // ...and once the window has passed, a new render starts and the URL recovers.
    h.advance(21_000);
    const recovered = await h.get(async () => h.page("recovered"));
    expect(h.renders()).toBe(3);
    expect(await recovered.text()).toBe("recovered");
  });

  test("a copy older than the keep-for window is not served, even when the render fails", async () => {
    const h = harness();
    await h.get(async () => h.page("old"));
    await h.settle();
    h.advance(2 * 3_600_000);
    const response = await h.get(async () => new Response("busy page", { status: 503 }));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("busy page");
  });

  test("with no copy, a failed render is the answer, and the URL cools off before the next try", async () => {
    const h = harness({ cooldownMs: 5_000 });
    const first = await h.get(async () => new Response("busy page", { status: 503 }));
    expect(first.status).toBe(503);
    await h.settle();
    // Inside the cooldown the database is not asked again: the same answer, at once.
    const second = await h.get(async () => h.page("recovered"));
    expect(second.status).toBe(503);
    expect(await second.text()).toBe("busy page");
    expect(state(second)).toBe("failed");
    expect(h.renders()).toBe(1);
    // After it, one probe goes through, and a success clears the failure.
    h.advance(5_001);
    const third = await h.get(async () => h.page("recovered"));
    expect(await third.text()).toBe("recovered");
    expect(h.renders()).toBe(2);
  });

  test("with no copy and a render that never finishes, the reader gets the busy page at the budget", async () => {
    const h = harness({ budgetMs: 20 });
    const response = await h.get(() => new Promise<Response>(() => {}));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("busy");
  });

  test("a response the app marked no-store is never stored or served stale", async () => {
    const h = harness();
    // Contradictory on purpose: no-store wins over a max-age sitting beside it.
    const health = () =>
      new Response('{"ok":true}', { headers: { "cache-control": "max-age=30, no-store" } });
    const first = await h.get(async () => health(), "https://www.airrates.net/v1/health");
    expect(first.status).toBe(200);
    await h.settle();
    expect(h.cache.entries.size).toBe(0);
    await h.get(async () => health(), "https://www.airrates.net/v1/health");
    expect(h.renders()).toBe(2);
  });

  test("each response keeps the freshness the app gave it", async () => {
    const h = harness();
    const api = () => new Response("{}", { headers: { "cache-control": "public, max-age=15" } });
    await h.get(async () => api(), "https://www.airrates.net/v1/screener");
    await h.settle();
    h.advance(10_000);
    expect(state(await h.get(async () => api(), "https://www.airrates.net/v1/screener"))).toBe(
      "hit",
    );
    h.advance(10_000);
    expect(state(await h.get(async () => api(), "https://www.airrates.net/v1/screener"))).toBe(
      "stale",
    );
  });

  test("answers that are neither success nor failure pass through unstored", async () => {
    const h = harness();
    const response = await h.get(async () => new Response("no such asset", { status: 404 }));
    expect(response.status).toBe(404);
    await h.settle();
    expect(h.cache.entries.size).toBe(0);
    // And a 404 is not a failure: the next reader is not held off by a cooldown.
    await h.get(async () => new Response("no such asset", { status: 404 }));
    expect(h.renders()).toBe(2);
  });

  test("only a GET is stored or answered from a copy", async () => {
    const h = harness();
    await h.get(async () => h.page("one"));
    await h.settle();
    const head = await h.get(async () => new Response(null, { status: 200 }), URL_A, "HEAD");
    expect(head.status).toBe(200);
    expect(h.renders()).toBe(2);
  });

  test("a copy from before the stamps existed is ignored", async () => {
    const h = harness();
    h.cache.entries.set(URL_A, {
      status: 200,
      headers: [["cache-control", "public, max-age=30"]],
      body: "from the previous build",
    });
    const response = await h.get(async () => h.page("fresh render"));
    expect(await response.text()).toBe("fresh render");
  });

  test("a cache that throws does not take the page down", async () => {
    const h = harness();
    h.cache.match = async () => {
      throw new Error("cache unavailable");
    };
    const response = await h.get(async () => h.page("rendered anyway"));
    expect(await response.text()).toBe("rendered anyway");
  });

  test("distinct URLs are independent", async () => {
    const h = harness();
    await h.get(async () => h.page("a"), "https://www.airrates.net/cvd");
    await h.get(async () => h.page("b"), "https://www.airrates.net/liquidations");
    await h.settle();
    expect(h.renders()).toBe(2);
    expect(
      await (await h.get(async () => h.page("x"), "https://www.airrates.net/cvd")).text(),
    ).toBe("a");
  });
});
