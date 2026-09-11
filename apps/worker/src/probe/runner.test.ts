import { describe, expect, test } from "bun:test";
import { type FetchLike, parseTrace, probeEndpoint, runProbe } from "./runner";

const endpoint = { label: "funding", url: "https://example.test/funding" };

describe("probeEndpoint", () => {
  test("records status, size and verdict", async () => {
    const fetch: FetchLike = async () => new Response('{"ok":true}', { status: 200 });
    const result = await probeEndpoint("demo", endpoint, { fetch });
    expect(result).toMatchObject({ venueId: "demo", verdict: "ok", status: 200, bytes: 11 });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test("sends JSON bodies as POST with a content type and user agent", async () => {
    let seen: RequestInit | undefined;
    const fetch: FetchLike = async (_url, init) => {
      seen = init;
      return new Response("{}");
    };
    await probeEndpoint(
      "hyperliquid",
      { ...endpoint, body: { type: "metaAndAssetCtxs" } },
      { fetch },
    );
    const headers = seen?.headers as Record<string, string>;
    expect(seen?.method).toBe("POST");
    expect(seen?.body).toBe('{"type":"metaAndAssetCtxs"}');
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["user-agent"]).toStartWith("ai-rates-probe/");
  });

  test("reports timeouts", async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const result = await probeEndpoint("slow", endpoint, { fetch, timeoutMs: 20 });
    expect(result.verdict).toBe("timeout");
    expect(result.status).toBeNull();
  });

  test("reports network errors", async () => {
    const fetch: FetchLike = async () => {
      throw new TypeError("connection refused");
    };
    const result = await probeEndpoint("down", endpoint, { fetch });
    expect(result).toMatchObject({ verdict: "network_error", detail: "connection refused" });
  });
});

describe("runProbe", () => {
  test("flattens endpoints and marks venues without endpoints as unconfigured", async () => {
    const fetch: FetchLike = async () => new Response("[]");
    const results = await runProbe(
      [
        { venueId: "a", endpoints: [endpoint, { ...endpoint, label: "tickers" }] },
        { venueId: "b", endpoints: [] },
      ],
      { fetch },
    );
    expect(results.map((r) => [r.venueId, r.label, r.verdict])).toEqual([
      ["a", "funding", "ok"],
      ["a", "tickers", "ok"],
      ["b", "-", "unconfigured"],
    ]);
  });
});

describe("parseTrace", () => {
  test("extracts colo, ip and loc", () => {
    const text = "fl=123\nh=cloudflare.com\nip=2a06:98c0::1\nts=1757600000.1\ncolo=NRT\nloc=JP\n";
    expect(parseTrace(text)).toEqual({ colo: "NRT", ip: "2a06:98c0::1", loc: "JP" });
  });

  test("returns nulls for unexpected output", () => {
    expect(parseTrace("<html>")).toEqual({ colo: null, ip: null, loc: null });
  });
});
