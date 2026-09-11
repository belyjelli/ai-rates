import { describe, expect, test } from "bun:test";
import { classify } from "./classify";

const respond = (status: number, body: string, headers: Record<string, string> = {}) =>
  classify({ status, body, headers: new Headers(headers) });

describe("classify", () => {
  test("2xx JSON is ok", () => {
    expect(respond(200, '[{"symbol":"BTCUSDT","lastFundingRate":"0.0001"}]').verdict).toBe("ok");
  });

  test("Binance 451 restricted location is geo_blocked", () => {
    const body =
      '{"code":0,"msg":"Service unavailable from a restricted location according to \'b. Eligibility\' in https://www.binance.com/en/terms."}';
    expect(respond(451, body).verdict).toBe("geo_blocked");
  });

  test("CloudFront country block (Bybit) is geo_blocked", () => {
    const body =
      "<HTML><BODY><H1>403 ERROR</H1>The Amazon CloudFront distribution is configured to block access from your country.</BODY></HTML>";
    const result = respond(403, body);
    expect(result.verdict).toBe("geo_blocked");
    expect(result.detail).not.toContain("<");
  });

  test("dYdX jurisdiction block is geo_blocked", () => {
    const body =
      '{"errors":[{"msg":"Because you appear to be a resident of, or using this application from, a jurisdiction that violates our terms of use"}]}';
    expect(respond(403, body).verdict).toBe("geo_blocked");
  });

  test("Cloudflare challenge is waf_challenge", () => {
    expect(respond(403, "", { "cf-mitigated": "challenge" }).verdict).toBe("waf_challenge");
    expect(respond(403, "<title>Just a moment...</title>").verdict).toBe("waf_challenge");
  });

  test("429 and 418 are rate_limited", () => {
    expect(respond(429, "Too Many Requests").verdict).toBe("rate_limited");
    expect(respond(418, "").verdict).toBe("rate_limited");
  });

  test("404 is not_found, other errors are http_error", () => {
    expect(respond(404, "").verdict).toBe("not_found");
    expect(respond(500, "oops").verdict).toBe("http_error");
    expect(respond(403, "Forbidden").verdict).toBe("http_error");
  });

  test("2xx non-JSON is bad_body", () => {
    expect(respond(200, "<html>maintenance</html>").verdict).toBe("bad_body");
  });

  test("large ok bodies are not pattern-matched or kept", () => {
    const body = JSON.stringify({ note: "restricted location", pad: "x".repeat(10_000) });
    expect(respond(200, body)).toEqual({ verdict: "ok", detail: null });
  });
});
