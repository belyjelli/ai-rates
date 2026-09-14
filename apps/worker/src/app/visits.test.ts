import { describe, expect, test } from "bun:test";
import { visitPoint } from "./visits";

/** A browser opening a page: the only request that sends Sec-Fetch-Mode: navigate. */
const open = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  new Request(`https://airates.test${path}`, {
    method,
    headers: { "sec-fetch-mode": "navigate", ...headers },
  });

describe("visitPoint", () => {
  test("a page opened from a post counts under the post's ref", () => {
    expect(visitPoint(open("/pair/BTC?long=gate&short=okx&ref=X"), "SG")).toEqual({
      indexes: ["x"],
      blobs: ["x", "/pair/BTC", "SG"],
      doubles: [1],
    });
  });

  test("without a ref, the referring site names the source, and the site's own pages read as internal", () => {
    expect(visitPoint(open("/", { referer: "https://t.co/abc" }))?.blobs[0]).toBe("t.co");
    expect(visitPoint(open("/", { referer: "https://www.google.com/" }))?.blobs[0]).toBe(
      "google.com",
    );
    expect(visitPoint(open("/screener", { referer: "https://airates.test/" }))?.blobs[0]).toBe(
      "internal",
    );
    expect(visitPoint(open("/"))?.blobs[0]).toBe("direct");
    // Unknown country is empty rather than a guess.
    expect(visitPoint(open("/"))?.blobs[2]).toBe("");
  });

  test("the live refresh, the backtest button's polling, crawlers and the API are not readers", () => {
    expect(visitPoint(open("/", { "sec-fetch-mode": "cors" }))).toBeNull();
    expect(visitPoint(new Request("https://airates.test/"))).toBeNull();
    expect(visitPoint(open("/v1/screener"))).toBeNull();
    expect(visitPoint(open("/probe"))).toBeNull();
    expect(visitPoint(open("/", {}, "POST"))).toBeNull();
  });

  test("a ref that is not a short slug is dropped rather than stored", () => {
    expect(visitPoint(open("/?ref=%3Cscript%3E"))?.blobs[0]).toBe("direct");
    expect(visitPoint(open(`/?ref=${"a".repeat(33)}`))?.blobs[0]).toBe("direct");
  });
});
