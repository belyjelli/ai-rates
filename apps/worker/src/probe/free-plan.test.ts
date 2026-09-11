import { describe, expect, test } from "bun:test";
import { classify } from "./classify";
import { type FetchLike, FULL_PARSE_BYTES, planJobs, probeEndpoint, runJobs } from "./runner";

// Behaviour added to keep each probe invocation inside the Free plan's CPU and subrequest limits.

const endpoint = { label: "all", url: "https://example.test/all" };
const bigJsonArray = () =>
  `[${Array.from({ length: 4000 }, (_, i) => `{"s":"M${i}","r":0.0001}`).join(",")}]`;

describe("classify with truncated bodies", () => {
  const headers = new Headers();

  test("balanced JSON brackets are ok without parsing", () => {
    expect(
      classify({ status: 200, headers, body: '[{"a":1},', truncated: true, lastChar: "]" }),
    ).toEqual({ verdict: "ok", detail: null });
  });

  test("HTML is bad_body", () => {
    const result = classify({
      status: 200,
      headers,
      body: "<html><body>maintenance",
      truncated: true,
      lastChar: ">",
    });
    expect(result.verdict).toBe("bad_body");
    expect(result.detail).toBe("maintenance");
  });

  test("error bodies are still pattern-matched from the head", () => {
    const body =
      "<HTML>The Amazon CloudFront distribution is configured to block access from your country.";
    expect(classify({ status: 403, headers, body, truncated: true, lastChar: ">" }).verdict).toBe(
      "geo_blocked",
    );
  });
});

describe("probeEndpoint with large bodies", () => {
  test("large JSON is ok and reports the full byte size", async () => {
    const payload = `${bigJsonArray()}\n`;
    expect(payload.length).toBeGreaterThan(FULL_PARSE_BYTES);
    const fetch: FetchLike = async () => new Response(payload);
    const result = await probeEndpoint("big", endpoint, { fetch });
    expect(result).toMatchObject({ verdict: "ok", bytes: payload.length, detail: null });
  });

  test("large non-JSON is bad_body", async () => {
    const fetch: FetchLike = async () =>
      new Response(`<html>${"x".repeat(FULL_PARSE_BYTES)}</html>`);
    expect((await probeEndpoint("big", endpoint, { fetch })).verdict).toBe("bad_body");
  });
});

describe("planJobs / runJobs", () => {
  test("jobs can be run in resumable slices", async () => {
    const jobs = planJobs([
      {
        venueId: "a",
        endpoints: [endpoint, { ...endpoint, label: "two" }, { ...endpoint, label: "three" }],
      },
      { venueId: "b", endpoints: [] },
    ]);
    expect(jobs.map((j) => [j.venueId, j.endpoint?.label ?? null])).toEqual([
      ["a", "all"],
      ["a", "two"],
      ["a", "three"],
      ["b", null],
    ]);

    let calls = 0;
    const fetch: FetchLike = async () => {
      calls++;
      return new Response("{}");
    };
    const first = await runJobs(jobs.slice(0, 2), { fetch });
    const second = await runJobs(jobs.slice(2), { fetch });
    expect([...first, ...second].map((r) => r.verdict)).toEqual(["ok", "ok", "ok", "unconfigured"]);
    expect(calls).toBe(3);
  });
});
