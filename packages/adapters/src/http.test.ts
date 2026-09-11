import { describe, expect, test } from "bun:test";
import {
  CircuitOpenError,
  createHttpClient,
  type FetchLike,
  HttpError,
  retryAfterMs,
} from "./http";

function harness(responses: (Response | Error)[]) {
  const calls: RequestInit[] = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const fetch: FetchLike = async (_url, init) => {
    calls.push(init ?? {});
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  };
  return {
    calls,
    sleeps,
    advance: (ms: number) => {
      clock += ms;
    },
    options: {
      fetch,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
      now: () => clock,
      random: () => 1,
    },
  };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe("createHttpClient", () => {
  test("returns parsed JSON and sends the user agent", async () => {
    const h = harness([json({ ok: 1 })]);
    const client = createHttpClient("demo", h.options);
    expect(await client.getJson<{ ok: number }>("https://x.test/a")).toEqual({ ok: 1 });
    const headers = new Headers(h.calls[0]?.headers);
    expect(headers.get("user-agent")).toStartWith("ai-rates-collector/");
  });

  test("posts JSON bodies", async () => {
    const h = harness([json([1])]);
    await createHttpClient("hl", h.options).postJson("https://x.test/info", { type: "meta" });
    expect(h.calls[0]?.method).toBe("POST");
    expect(h.calls[0]?.body).toBe('{"type":"meta"}');
  });

  test("honours Retry-After on 429, then succeeds", async () => {
    const h = harness([json({}, 429, { "retry-after": "2" }), json({ ok: true })]);
    expect(
      await createHttpClient("demo", h.options).getJson<{ ok: boolean }>("https://x.test"),
    ).toEqual({ ok: true });
    expect(h.sleeps).toEqual([2000]);
  });

  test("backs off exponentially on 5xx and network errors", async () => {
    const h = harness([json({}, 502), new TypeError("reset"), json({}, 503), json({ ok: true })]);
    await createHttpClient("demo", h.options).getJson("https://x.test");
    expect(h.sleeps).toEqual([500, 1000, 2000]);
  });

  test("does not retry other 4xx", async () => {
    const h = harness([json({ msg: "bad symbol" }, 400)]);
    const error = (await createHttpClient("demo", h.options)
      .getJson("https://x.test")
      .catch((e: unknown) => e)) as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(400);
    expect(h.calls).toHaveLength(1);
  });

  test("gives up after maxRetries", async () => {
    const h = harness([json({}, 500), json({}, 500), json({}, 500)]);
    const client = createHttpClient("demo", { ...h.options, maxRetries: 2 });
    await expect(client.getJson("https://x.test")).rejects.toBeInstanceOf(HttpError);
    expect(h.calls).toHaveLength(3);
  });

  test("invalid JSON is an error without retry", async () => {
    const h = harness([new Response("<html>")]);
    await expect(createHttpClient("demo", h.options).getJson("https://x.test")).rejects.toThrow(
      "invalid JSON",
    );
    expect(h.calls).toHaveLength(1);
  });

  test("spaces request starts by minIntervalMs, including concurrent calls", async () => {
    // Real timers: a fake clock that jumps on sleep() can't show when fetches actually start.
    const starts: number[] = [];
    const client = createHttpClient("demo", {
      minIntervalMs: 40,
      fetch: async () => {
        starts.push(performance.now());
        return json({});
      },
    });
    await Promise.all([client.getJson("u1"), client.getJson("u2"), client.getJson("u3")]);
    const [a = 0, b = 0, c = 0] = starts;
    expect(b - a).toBeGreaterThanOrEqual(35);
    expect(c - b).toBeGreaterThanOrEqual(35);
  });

  test("opens the circuit after repeated failures and half-opens after the cooldown", async () => {
    const h = harness([json({}, 400), json({}, 400), json({ ok: true })]);
    const client = createHttpClient("demo", {
      ...h.options,
      breaker: { failureThreshold: 2, cooldownMs: 60_000 },
    });
    await client.getJson("u").catch(() => {});
    await client.getJson("u").catch(() => {});
    expect(client.circuit().open).toBe(true);
    await expect(client.getJson("u")).rejects.toBeInstanceOf(CircuitOpenError);
    expect(h.calls).toHaveLength(2);

    h.advance(60_000);
    expect(await client.getJson<{ ok: boolean }>("u")).toEqual({ ok: true });
    expect(client.circuit()).toMatchObject({ open: false, consecutiveFailures: 0 });
  });
});

describe("retryAfterMs", () => {
  test("parses seconds and HTTP dates, capped at 60s", () => {
    const now = Date.parse("2026-09-12T00:00:00Z");
    expect(retryAfterMs("3", now)).toBe(3000);
    expect(retryAfterMs("Sat, 12 Sep 2026 00:00:10 GMT", now)).toBe(10_000);
    expect(retryAfterMs("600", now)).toBe(60_000);
    expect(retryAfterMs(null, now)).toBeNull();
    expect(retryAfterMs("soon", now)).toBeNull();
  });
});
