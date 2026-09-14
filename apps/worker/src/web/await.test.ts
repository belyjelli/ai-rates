import { describe, expect, test } from "bun:test";
import { AWAIT_SCRIPT, retryDelay } from "./await";

describe("retryDelay", () => {
  test("a ready report, or an answer waiting cannot change, is shown now", () => {
    expect(retryDelay(200, 0, null)).toBeNull();
    expect(retryDelay(404, 0, null)).toBeNull();
    expect(retryDelay(400, 3, "5")).toBeNull();
    expect(retryDelay(500, 0, null)).toBeNull();
  });

  test("a limited or unavailable answer, or no answer, is asked again with backoff", () => {
    expect(retryDelay(0, 0, null)).toBe(1e3);
    expect(retryDelay(503, 1, null)).toBe(2e3);
    expect(retryDelay(502, 2, null)).toBe(4e3);
    expect(retryDelay(504, 10, null)).toBe(8e3);
    expect(retryDelay(429, 0, null)).toBe(1e3);
  });

  test("Retry-After in seconds wins, kept between one second and a minute", () => {
    expect(retryDelay(429, 0, "60")).toBe(60e3);
    expect(retryDelay(429, 5, "0")).toBe(1e3);
    expect(retryDelay(503, 0, "3600")).toBe(60e3);
  });

  test("a Retry-After that is not a number of seconds falls back to the backoff", () => {
    expect(retryDelay(429, 1, "Wed, 21 Oct 2026 07:28:00 GMT")).toBe(2e3);
    expect(retryDelay(429, 1, "")).toBe(2e3);
  });
});

describe("AWAIT_SCRIPT", () => {
  test("is valid JavaScript once the helper is embedded", () => {
    expect(() => new Function(AWAIT_SCRIPT)).not.toThrow();
  });

  test("cannot close its own script tag", () => {
    expect(AWAIT_SCRIPT.toLowerCase()).not.toContain("</script");
  });
});
