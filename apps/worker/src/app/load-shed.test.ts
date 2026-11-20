import { describe, expect, test } from "bun:test";
import type { CacheLike } from "./edge-cache";
import { isSearchCrawler, isSheddable, Pressure } from "./load-shed";

/** One location's cache, shared by the isolates under test. */
class FakeCache implements CacheLike {
  readonly entries = new Map<string, Response>();
  async match(request: Request): Promise<Response | undefined> {
    return this.entries.get(request.url)?.clone();
  }
  async put(request: Request, response: Response): Promise<void> {
    this.entries.set(request.url, response);
  }
}

const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://airrates.net${path}`, { headers });

describe("isSheddable", () => {
  const HOME_BROADBAND = 4713; // NTT, Japan
  const ALIBABA = 45102;

  test("the API, MCP, A2A and Markdown callers are shed, whoever they are", () => {
    expect(isSheddable(get("/v1/rates"), HOME_BROADBAND)).toBe(true);
    expect(isSheddable(get("/v1"), HOME_BROADBAND)).toBe(true);
    expect(
      isSheddable(new Request("https://airrates.net/mcp", { method: "POST" }), undefined),
    ).toBe(true);
    expect(
      isSheddable(new Request("https://airrates.net/a2a", { method: "POST" }), undefined),
    ).toBe(true);
    expect(isSheddable(get("/liquidations/BTC", { accept: "text/markdown" }), HOME_BROADBAND)).toBe(
      true,
    );
  });

  test("a page is shed only for a cloud network: the 2026-10 scraper's, not a reader's", () => {
    expect(isSheddable(get("/liquidations/BNB"), ALIBABA)).toBe(true);
    expect(isSheddable(get("/liquidations/BNB"), HOME_BROADBAND)).toBe(false);
    expect(isSheddable(get("/"), undefined)).toBe(false);
    // Cloudflare's own network is WARP's too, so its readers keep the pages.
    expect(isSheddable(get("/"), 13335)).toBe(false);
    // A browser's ordinary Accept still gets the page.
    expect(
      isSheddable(
        get("/whales", { accept: "text/html,application/xhtml+xml,*/*" }),
        HOME_BROADBAND,
      ),
    ).toBe(false);
    // A path that merely starts with the letters is not the API.
    expect(isSheddable(get("/v1x"), HOME_BROADBAND)).toBe(false);
  });

  test("a search engine's crawler from its own network keeps the pages; the name alone does not", () => {
    const GOOGLE = 15169;
    const MICROSOFT = 8075;
    const googlebot = {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.52 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    };
    const bingbot = {
      "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    };
    expect(isSearchCrawler(get("/liquidations/BTC", googlebot), GOOGLE)).toBe(true);
    expect(isSheddable(get("/liquidations/BTC", googlebot), GOOGLE)).toBe(false);
    expect(isSheddable(get("/chart/ETH", bingbot), MICROSOFT)).toBe(false);
    // The same agent from a scraper's network is the scraper.
    expect(isSheddable(get("/liquidations/BTC", googlebot), ALIBABA)).toBe(true);
    // Google's network without Googlebot's name is a customer's script.
    const appsScript = {
      "user-agent":
        "Mozilla/5.0 (compatible; Google-Apps-Script; beanserver; +https://script.google.com)",
    };
    expect(isSheddable(get("/liquidations/BTC", appsScript), GOOGLE)).toBe(true);
    // The API is shed for a crawler too: it is a program's door, not a page.
    expect(isSheddable(get("/v1/liquidations", googlebot), GOOGLE)).toBe(true);
  });

  test("an assistant's search crawler and fetcher keep the pages from their own networks only", () => {
    const MICROSOFT = 8075;
    const AMAZON = 14618;
    const agent = (name: string) => ({
      "user-agent": `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ${name}; +https://example.com/bot`,
    });
    const oaiSearch = agent("OAI-SearchBot/1.0");
    const chatgptUser = agent("ChatGPT-User/1.0");
    const perplexityBot = agent("PerplexityBot/1.0");
    const perplexityUser = agent("Perplexity-User/1.0");
    expect(isSheddable(get("/rates", oaiSearch), MICROSOFT)).toBe(false);
    expect(isSheddable(get("/chart/BTC", chatgptUser), MICROSOFT)).toBe(false);
    expect(isSheddable(get("/rates", perplexityBot), AMAZON)).toBe(false);
    expect(isSheddable(get("/liquidations/BTC", perplexityUser), AMAZON)).toBe(false);
    // Each name from another cloud is a script wearing it.
    expect(isSheddable(get("/rates", chatgptUser), ALIBABA)).toBe(true);
    expect(isSheddable(get("/rates", perplexityBot), MICROSOFT)).toBe(true);
    expect(isSheddable(get("/rates", oaiSearch), AMAZON)).toBe(true);
    // A training crawler from the same network is not exempt.
    expect(isSheddable(get("/rates", agent("GPTBot/1.2")), MICROSOFT)).toBe(true);
    // Unverifiable: Anthropic publishes no ranges, so Claude-User from a cloud is shed with the rest.
    expect(isSheddable(get("/rates", agent("Claude-User/1.0")), AMAZON)).toBe(true);
    // Still no API under pressure.
    expect(isSheddable(get("/v1/rates", chatgptUser), MICROSOFT)).toBe(true);
  });

  test("a desktop Chrome months out of date is shed from a home connection too: the 2026-11-20 scraper", () => {
    const day = Date.UTC(2026, 10, 20, 16);
    const mac = (v: number) => ({
      "user-agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`,
    });
    const windows = (v: number) => ({
      "user-agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`,
    });
    // The scraper's agents, from 123 up to 146.
    for (const v of [123, 131, 136, 142, 145, 146]) {
      expect([
        v,
        isSheddable(get("/liquidations/equity/SOXL", mac(v)), HOME_BROADBAND, day),
      ]).toEqual([v, true]);
    }
    // Readers that day ran 150 to 158, on any desktop.
    for (const v of [150, 153, 154, 158]) {
      expect([v, isSheddable(get("/liquidations/BTC", mac(v)), HOME_BROADBAND, day)]).toEqual([
        v,
        false,
      ]);
      expect(isSheddable(get("/rates", windows(v)), HOME_BROADBAND, day)).toBe(false);
    }
    // A phone's Chrome can lag on purpose (Samsung Internet, in-app browsers): never by version.
    const samsung = {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
    };
    expect(isSheddable(get("/liquidations/BTC", samsung), HOME_BROADBAND, day)).toBe(false);
    // Not Chrome at all.
    const safari = {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    };
    expect(isSheddable(get("/liquidations/BTC", safari), HOME_BROADBAND, day)).toBe(false);
    // The line moves with time: a year on, 150 is as stale as 142 was.
    expect(isSheddable(get("/rates", mac(150)), HOME_BROADBAND, Date.UTC(2027, 10, 20))).toBe(true);
  });
});

describe("Pressure", () => {
  const harness = () => {
    let now = 1_000_000;
    const cache = new FakeCache();
    const options = { now: () => now };
    return {
      cache,
      pressure: new Pressure(options),
      another: () => new Pressure(options),
      advance: (ms: number) => {
        now += ms;
      },
    };
  };

  test("quick renders never put the location under pressure, nor do heavy pages far from the database", async () => {
    const h = harness();
    for (let i = 0; i < 50; i++)
      expect(h.pressure.observe({ ms: 300, ok: true }, h.cache)).toBeNull();
    // /liquidations/BTC uncached from Bangkok on a healthy path, 2026-10-11.
    for (let i = 0; i < 10; i++)
      expect(h.pressure.observe({ ms: 4_400, ok: true }, h.cache)).toBeNull();
    expect(await h.pressure.underPressure(h.cache)).toBe(false);
  });

  test("one slow render is bad luck; a second within the minute is pressure", async () => {
    const h = harness();
    expect(h.pressure.observe({ ms: 9_000, ok: true }, h.cache)).toBeNull();
    expect(await h.pressure.underPressure(h.cache)).toBe(false);
    h.advance(20_000);
    const pressed = h.pressure.observe({ ms: 0, ok: false }, h.cache);
    expect(pressed?.tipped).toBe(true);
    await pressed?.share;
    expect(await h.pressure.underPressure(h.cache)).toBe(true);
    // Strikes a minute apart are not a pattern.
    const spaced = harness();
    spaced.pressure.observe({ ms: 9_000, ok: true }, spaced.cache);
    spaced.advance(61_000);
    expect(spaced.pressure.observe({ ms: 9_000, ok: true }, spaced.cache)).toBeNull();
  });

  test("it lifts a minute after the last bad render, and further strikes extend it without re-tipping", async () => {
    const h = harness();
    h.pressure.observe({ ms: 0, ok: false }, h.cache);
    h.pressure.observe({ ms: 0, ok: false }, h.cache);
    h.advance(40_000);
    expect(h.pressure.observe({ ms: 9_000, ok: true }, h.cache)?.tipped).toBe(false);
    h.advance(40_000);
    expect(await h.pressure.underPressure(h.cache)).toBe(true);
    h.advance(21_000);
    expect(await h.pressure.underPressure(h.cache)).toBe(false);
  });

  test("the location's other isolates hear of it through the shared cache within seconds", async () => {
    const h = harness();
    const other = h.another();
    expect(await other.underPressure(h.cache)).toBe(false);
    h.pressure.observe({ ms: 0, ok: false }, h.cache);
    await h.pressure.observe({ ms: 0, ok: false }, h.cache)?.share;
    // It rereads the shared verdict at most every five seconds...
    expect(await other.underPressure(h.cache)).toBe(false);
    h.advance(5_000);
    // ...and then shares it, with the same end.
    expect(await other.underPressure(h.cache)).toBe(true);
    h.advance(60_000);
    expect(await other.underPressure(h.cache)).toBe(false);
  });

  test("a cache that throws leaves the location unpressured rather than failing the request", async () => {
    const broken: CacheLike = {
      match: async () => {
        throw new Error("cache down");
      },
      put: async () => {
        throw new Error("cache down");
      },
    };
    const pressure = new Pressure();
    expect(await pressure.underPressure(broken)).toBe(false);
    pressure.observe({ ms: 0, ok: false }, broken);
    const pressed = pressure.observe({ ms: 0, ok: false }, broken);
    await pressed?.share;
    // Its own verdict still holds in the isolate that saw the failures.
    expect(await pressure.underPressure(broken)).toBe(true);
  });
});
