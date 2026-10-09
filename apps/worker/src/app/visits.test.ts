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
    expect(
      visitPoint(open("/pair/BTC?long=gate&short=okx&ref=X", { "accept-language": "ja" }), "SG"),
    ).toEqual({
      indexes: ["x"],
      blobs: ["x", "/pair/BTC", "SG", "ja"],
      doubles: [1],
    });
  });

  test("the language is the browser's first choice, whether or not the site has it", () => {
    const lang = (header?: string) =>
      visitPoint(open("/", header === undefined ? {} : { "accept-language": header }))?.blobs[3];
    // The point of counting it: a Japanese reader is seen as one, though the site has no Japanese.
    expect(lang("ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("ja-jp");
    // Quality decides, not position.
    expect(lang("en;q=0.5,zh-TW")).toBe("zh-tw");
    // One subtag kept, so simplified and traditional Chinese stay apart without a third level.
    expect(lang("zh-Hant-TW,zh;q=0.9")).toBe("zh-hant");
    // A wildcard is no answer; the next tag is.
    expect(lang("*,ko;q=0.5")).toBe("ko");
    // Nothing usable is stored as unknown rather than as whatever was sent.
    expect(lang()).toBe("");
    expect(lang("*")).toBe("");
    expect(lang("english")).toBe("");
    expect(lang(`${"a".repeat(300)}`)).toBe("");
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
