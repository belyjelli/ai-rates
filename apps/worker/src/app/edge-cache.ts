/**
 * The page cache in front of the database: fresh copies are served as they are, a copy a little
 * past fresh is served at once while one request refreshes it, a slow or failing database falls
 * back to the last good copy, and N identical misses cost one render rather than N.
 *
 * WHY IT IS MORE THAN `cache.match` + `cache.put`. That was the whole cache until 2026-10-04, and it
 * failed exactly when it was needed. Every copy expired 30 s after it was stored, and the next
 * request to arrive had to wait for the database; so did every other request that arrived before
 * that one finished. One slow render therefore became a pile of them, each holding a Hyperdrive
 * connection (the config allows 5), and once the pool was full every page -- including the
 * ones that read nothing heavy -- waited 15 s and answered "data center busy". A failed render
 * stored nothing, so the reader got the busy page even when a good copy from 31 seconds earlier had
 * just expired from the cache.
 *
 * Four rules, in the order a request meets them:
 *
 *   1. FRESH (younger than `freshMs`): serve it. No render, no database.
 *   2. STALE-WHILE-REVALIDATE (younger than `swrMs`): serve it now, and start ONE refresh behind the
 *      reader. Nobody waits on the database for a page that is merely a little old.
 *   3. SINGLE FLIGHT: a render already running for this URL is joined, never repeated. The count of
 *      renders is bounded by the number of distinct URLs in flight, not by the traffic.
 *   4. STALE-IF-ERROR: when the render fails, or takes longer than `slowMs` while a copy exists, the
 *      reader gets the copy (up to `maxStaleMs` old) rather than a 503. Only a reader with no copy
 *      at all waits for the render, up to `budgetMs`, and then gets the busy page. After a failure
 *      the URL cools off for `cooldownMs`, so a sick database sees one probe, not every request.
 *
 * A render that outlives its readers' patience is NOT abandoned: it stays registered as the URL's
 * flight until it settles, so the next request joins it instead of starting a second one, and its
 * result still lands in the cache for whoever asks next.
 *
 * Copies are per Cloudflare location (`caches.default`), as before. A location that has never
 * rendered the page has no copy to fall back to; it gets the busy page, as before.
 */

export interface EdgeCacheOptions {
  /**
   * Serve a copy younger than this at once, and refresh it behind the reader. How long a copy is
   * FRESH is not an option: it is the `max-age` the app put on that response (30 s for a page, 15 s
   * for the API), so a response the app marked `no-store` is never stored at all.
   */
  swrMs: number;
  /** Keep a copy this long, for the days the database is down. Older copies are never served. */
  maxStaleMs: number;
  /** With a copy in hand, stop waiting for a render after this long and serve the copy. */
  slowMs: number;
  /** With nothing to fall back on, stop waiting after this long. Under Hyperdrive's own 15 s. */
  budgetMs: number;
  /** After a failed render, serve the copy (or the failure) for this long instead of rendering again. */
  cooldownMs: number;
  /**
   * A render still unfinished after this long is no longer joined: the next request starts a new
   * one. Workers stops a request's background work 30 s after its response, and a render stopped
   * that way never settles -- without this bound every later reader in the isolate would wait on a
   * promise that will not resolve, and be answered from the stale copy or the busy page forever.
   */
  flightMs: number;
  now: () => number;
}

export const EDGE_CACHE_DEFAULTS: EdgeCacheOptions = {
  swrMs: 120_000,
  // An hour: long enough to ride out a database restart or a bad deploy, short enough that a copy
  // is never mistaken for the market. The page's own status line goes stale after three minutes.
  maxStaleMs: 3_600_000,
  slowMs: 2_500,
  budgetMs: 12_000,
  cooldownMs: 5_000,
  flightMs: 30_000,
  now: Date.now,
};

/** The part of the Cache API this uses, so a test can supply a Map. */
export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface ServeArgs {
  cache: CacheLike;
  /** The cache key: the request, or the request with its call-to-action bucket in the URL. */
  key: Request;
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
  /** Produces the page. Called at most once per URL at a time, however many requests want it. */
  render: () => Promise<Response>;
  /** The busy page, for a reader who has no copy and whose render did not finish in time. */
  unavailable: () => Response;
  log?: (message: string) => void;
}

/** A rendered response held as plain data, so any number of readers can each be given their own. */
interface Rendered {
  status: number;
  headers: [string, string][];
  body: ArrayBuffer;
}

/** Set on every stored copy: when it was rendered, in epoch milliseconds. */
const RENDERED_AT = "x-airrates-rendered-at";
/** Set on every stored copy: how many seconds the app said it stays fresh. */
const FRESH_FOR = "x-airrates-fresh-for";
/** Which of the rules above answered, for `curl -I` and for the logs. */
export const CACHE_STATE = "x-airrates-cache";

const TIMED_OUT = Symbol("timed out");

export class EdgeCache {
  private readonly options: EdgeCacheOptions;
  private readonly flights = new Map<string, { promise: Promise<Rendered>; startedAt: number }>();
  private readonly failures = new Map<string, { at: number; rendered: Rendered }>();

  constructor(options: Partial<EdgeCacheOptions> = {}) {
    this.options = { ...EDGE_CACHE_DEFAULTS, ...options };
  }

  async serve(args: ServeArgs): Promise<Response> {
    const { cache, key, request, render, unavailable } = args;
    const o = this.options;
    // Only a GET is ever stored or answered from a stored copy.
    if (request.method !== "GET") return render();

    const hit = await cache.match(key).catch(() => undefined);
    // A copy with no stamps (stored by the build before this one, for 30 s) is ignored outright.
    const renderedAt = number(hit?.headers.get(RENDERED_AT));
    const freshFor = number(hit?.headers.get(FRESH_FOR));
    const age = renderedAt === null ? null : Math.max(0, o.now() - renderedAt);
    const freshMs = freshFor === null ? 0 : freshFor * 1000;
    const copy = hit && age !== null && age <= o.maxStaleMs ? hit : undefined;

    if (copy && age !== null && age < freshMs) {
      return this.fromCopy(copy, "hit", age, freshMs - age);
    }
    if (copy && age !== null && age < Math.max(o.swrMs, freshMs)) {
      // Hand over what is here; the next reader gets the refreshed one. A refresh already running
      // (or cooling off after a failure) is joined or skipped inside `flight`.
      this.flight(args);
      return this.fromCopy(copy, "stale", age, 0);
    }

    // Nothing stored, or a copy too old to serve without trying first.
    const flight = this.flight(args);
    if (flight === null) {
      // Cooling off after a failure: do not touch the database again yet.
      const failed = this.failures.get(key.url);
      if (copy) return this.fromCopy(copy, "stale-error", age ?? 0, 0);
      return failed ? this.fromRendered(failed.rendered, "failed") : unavailable();
    }

    const outcome = await settleWithin(flight, copy ? o.slowMs : o.budgetMs);
    if (outcome !== TIMED_OUT && outcome.status < 500) return this.fromRendered(outcome, "miss");
    if (copy) {
      return this.fromCopy(copy, outcome === TIMED_OUT ? "stale-slow" : "stale-error", age ?? 0, 0);
    }
    return outcome === TIMED_OUT ? unavailable() : this.fromRendered(outcome, "failed");
  }

  /**
   * The render for this URL: the one already running, a new one, or null while the URL is cooling
   * off after a failure. The promise never rejects -- a failure is a Rendered with status 503.
   */
  private flight(args: ServeArgs): Promise<Rendered> | null {
    const { cache, key, waitUntil, render, log } = args;
    const o = this.options;
    const id = key.url;
    const running = this.flights.get(id);
    if (running && o.now() - running.startedAt < o.flightMs) return running.promise;
    const failure = this.failures.get(id);
    if (failure && o.now() - failure.at < o.cooldownMs) return null;

    const flight = (async (): Promise<Rendered> => {
      let rendered: Rendered;
      try {
        rendered = await snapshot(await render());
      } catch (error) {
        log?.(`${new URL(id).pathname}: render failed: ${message(error)}`);
        rendered = unavailableSnapshot();
      }
      if (rendered.status >= 500) {
        this.failures.set(id, { at: o.now(), rendered });
        this.pruneFailures();
      } else {
        this.failures.delete(id);
        // Stored only if the app said it may be: a response it marked no-store (the health check,
        // a rate-limit answer) is a fact about this moment, and a copy of it would be a lie.
        const freshFor = cacheableFor(rendered);
        if (rendered.status === 200 && freshFor !== null) {
          waitUntil(
            cache
              .put(key, this.stored(rendered, freshFor))
              .catch((error) => log?.(`cache put failed: ${message(error)}`)),
          );
        }
      }
      return rendered;
    })();
    const entry = { promise: flight, startedAt: o.now() };
    this.flights.set(id, entry);
    // Registered until it settles, not until a reader gives up, so a slow render is joined and
    // never doubled. `waitUntil` keeps it running after the readers have been answered.
    waitUntil(
      flight.finally(() => {
        if (this.flights.get(id) === entry) this.flights.delete(id);
      }),
    );
    return flight;
  }

  /**
   * A copy as Cloudflare's cache will keep it: long-lived whatever the app said, stamped with when it
   * was rendered and how long the app said it stays fresh. Both are read back by `serve`.
   */
  private stored(rendered: Rendered, freshFor: number): Response {
    const response = build(rendered);
    response.headers.set(
      "cache-control",
      `public, max-age=${Math.ceil(this.options.maxStaleMs / 1000)}`,
    );
    response.headers.set(RENDERED_AT, String(this.options.now()));
    response.headers.set(FRESH_FOR, String(freshFor));
    return response;
  }

  /**
   * A stored copy, re-headed for the browser: its remaining freshness as `max-age` (zero once it is
   * stale, so the browser asks again), and its age in `Age`, which the page's live script reads to
   * time its next poll.
   */
  private fromCopy(copy: Response, state: string, ageMs: number, freshLeftMs: number): Response {
    const response = new Response(copy.body, copy);
    response.headers.set(
      "cache-control",
      `public, max-age=${Math.max(0, Math.ceil(freshLeftMs / 1000))}`,
    );
    response.headers.set("age", String(Math.floor(Number.isFinite(ageMs) ? ageMs / 1000 : 0)));
    response.headers.set(CACHE_STATE, state);
    return response;
  }

  private fromRendered(rendered: Rendered, state: string): Response {
    const response = build(rendered);
    response.headers.set(CACHE_STATE, state);
    return response;
  }

  /** A failure per distinct URL is remembered for its cooldown; an unbounded map is not. */
  private pruneFailures(): void {
    if (this.failures.size <= 500) return;
    const now = this.options.now();
    for (const [id, failure] of this.failures) {
      if (now - failure.at >= this.options.cooldownMs) this.failures.delete(id);
    }
  }
}

async function snapshot(response: Response): Promise<Rendered> {
  return {
    status: response.status,
    headers: [...response.headers],
    body: await response.arrayBuffer(),
  };
}

function build(rendered: Rendered): Response {
  // A null body for the statuses that forbid one; the Response constructor throws otherwise.
  const bodiless = rendered.status === 204 || rendered.status === 304;
  return new Response(bodiless ? null : rendered.body, {
    status: rendered.status,
    headers: rendered.headers,
  });
}

/** What a reader sees when the render threw rather than answered: plain, and told to come back. */
function unavailableSnapshot(): Rendered {
  return {
    status: 503,
    headers: [
      ["content-type", "text/plain; charset=utf-8"],
      ["cache-control", "no-store"],
      ["retry-after", "10"],
    ],
    body: new TextEncoder().encode("Temporarily unavailable. Try again shortly.")
      .buffer as ArrayBuffer,
  };
}

/** The promise's value, or TIMED_OUT if it takes longer than `ms`. The promise itself carries on. */
async function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** How long the app said this response stays fresh, or null if it did not say it may be stored. */
function cacheableFor(rendered: Rendered): number | null {
  const control = rendered.headers.find(([name]) => name.toLowerCase() === "cache-control")?.[1];
  if (control === undefined || /\b(no-store|no-cache|private)\b/i.test(control)) return null;
  const seconds = Number(/\bmax-age=(\d+)/i.exec(control)?.[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** A header's numeric value, or null when it is absent or not a number. */
function number(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
