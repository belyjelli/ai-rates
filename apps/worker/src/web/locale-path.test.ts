import { describe, expect, test } from "bun:test";
import {
  hreflangLinks,
  isLocalizable,
  localizedPath,
  localizeHtml,
  localizeSwitch,
  prefixHref,
  routeLocale,
  splitLocalePath,
} from "./locale-path";

describe("language addresses", () => {
  test("translated pages have a prefixed address; the rest stay English", () => {
    expect(isLocalizable("/")).toBe(true);
    expect(isLocalizable("/liquidations/BTC")).toBe(true);
    expect(isLocalizable("/chart/fx/USDHKD")).toBe(true);
    expect(isLocalizable("/about")).toBe(false);
    expect(isLocalizable("/legal")).toBe(false);
    expect(isLocalizable("/v1/rates")).toBe(false);
    expect(isLocalizable("/lang/ru")).toBe(false);
    expect(localizedPath("ru", "/")).toBe("/ru");
    expect(localizedPath("ru", "/rates")).toBe("/ru/rates");
    expect(localizedPath("en", "/rates")).toBe("/rates");
    expect(localizedPath("ko", "/about")).toBe("/about");
  });

  test("a prefix is read only when it names a language", () => {
    expect(splitLocalePath("/ru/liquidations/BTC")).toEqual({
      locale: "ru",
      path: "/liquidations/BTC",
    });
    expect(splitLocalePath("/zh")).toEqual({ locale: "zh", path: "/" });
    expect(splitLocalePath("/zh/")).toEqual({ locale: "zh", path: "/" });
    expect(splitLocalePath("/rates")).toBeNull();
    expect(splitLocalePath("/xx/rates")).toBeNull();
    expect(splitLocalePath("/ruby")).toBeNull();
  });

  test("a prefixed request is the bare page in that language; /en and untranslated pages redirect", () => {
    const route = routeLocale(new Request("https://airrates.net/ko/liquidations/BTC?wlist=band"));
    expect(route?.kind).toBe("localized");
    if (route?.kind !== "localized") throw new Error("not localized");
    expect(route.locale).toBe("ko");
    expect(route.request.url).toBe("https://airrates.net/liquidations/BTC?wlist=band");
    const english = routeLocale(new Request("https://airrates.net/en/rates?tab=gamma"));
    expect(english?.kind).toBe("redirect");
    if (english?.kind !== "redirect") throw new Error("no redirect");
    expect(english.response.status).toBe(301);
    expect(english.response.headers.get("location")).toBe("/rates?tab=gamma");
    const legal = routeLocale(new Request("https://airrates.net/ru/legal"));
    expect(legal?.kind === "redirect" && legal.response.headers.get("location")).toBe("/legal");
    expect(routeLocale(new Request("https://airrates.net/rates"))).toBeNull();
  });

  test("the language switch lands on the page's address in the new language", () => {
    const switched = (to: string, back: string) =>
      localizeSwitch(
        new Response(null, { status: 303, headers: { location: back } }),
        new Request(`https://airrates.net/lang/${to}?back=${encodeURIComponent(back)}`),
      ).headers.get("location");
    expect(switched("ru", "/liquidations/BTC?wlist=band")).toBe("/ru/liquidations/BTC?wlist=band");
    // The address bar of a prefixed page: the old prefix goes first.
    expect(switched("ko", "/ru/liquidations/BTC")).toBe("/ko/liquidations/BTC");
    expect(switched("en", "/ru/rates")).toBe("/rates");
    expect(switched("ja", "/")).toBe("/ja");
    expect(switched("de", "/about")).toBe("/about");
  });

  test("links to translated pages take the prefix; others, and absolute links, do not", () => {
    expect(prefixHref("ru", "/rates?tab=gamma#x")).toBe("/ru/rates?tab=gamma#x");
    expect(prefixHref("ru", "/")).toBe("/ru");
    expect(prefixHref("ru", "/?ref=app")).toBe("/ru?ref=app");
    expect(prefixHref("ru", "/ru/rates")).toBe("/ru/rates");
    expect(prefixHref("ru", "/lang/ko?back=%2F")).toBe("/lang/ko?back=%2F");
    expect(prefixHref("ru", "/v1/rates")).toBe("/v1/rates");
    expect(prefixHref("ru", "/about")).toBe("/about");
    expect(prefixHref("ru", "//evil.example/rates")).toBe("//evil.example/rates");
    expect(prefixHref("ru", "https://x.com/airrates")).toBe("https://x.com/airrates");
    expect(prefixHref("ru", "#cvd-chart")).toBe("#cvd-chart");
  });

  test("every version is named, with English as the default", () => {
    const links = hreflangLinks("/liquidations/BTC");
    expect(links).toContain('hreflang="en" href="https://airrates.net/liquidations/BTC"');
    expect(links).toContain('hreflang="ru" href="https://airrates.net/ru/liquidations/BTC"');
    expect(links).toContain('hreflang="zh-Hans" href="https://airrates.net/zh/liquidations/BTC"');
    expect(links).toContain('hreflang="pt-BR" href="https://airrates.net/pt/liquidations/BTC"');
    expect(links).toContain('hreflang="x-default" href="https://airrates.net/liquidations/BTC"');
    expect(links.match(/hreflang=/g)).toHaveLength(9);
    expect(hreflangLinks("/")).toContain('hreflang="ko" href="https://airrates.net/ko"');
  });
});

describe("localizeHtml", () => {
  const page = (
    body: string,
    head = '<link rel="canonical" href="https://airrates.net/chart"><meta property="og:url" content="https://airrates.net/chart">',
  ) =>
    new Response(
      `<!doctype html><html><head><title>x</title>${head}</head><body>${body}</body></html>`,
      {
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    );

  test("an English page gets the hreflang set after its canonical, links untouched", async () => {
    const html = await localizeHtml(page('<a href="/rates">r</a>'), null).text();
    expect(html).toContain('<link rel="canonical" href="https://airrates.net/chart">');
    expect(html).toContain('hreflang="ru" href="https://airrates.net/ru/chart"');
    expect(html.indexOf("hreflang")).toBeLessThan(html.indexOf("</head>"));
    expect(html).toContain('<a href="/rates">');
  });

  test("a prefixed page points its canonical, og:url and links at that language", async () => {
    const html = await localizeHtml(
      page(
        '<a href="/chart/ETH?tf=1h">e</a><a href="/about">a</a><a href="/lang/ko?back=%2Fchart" data-lang>ko</a><form action="/screener"></form>',
      ),
      "ru",
    ).text();
    expect(html).toContain('<link rel="canonical" href="https://airrates.net/ru/chart">');
    expect(html).toContain('<meta property="og:url" content="https://airrates.net/ru/chart">');
    expect(html).toContain('<a href="/ru/chart/ETH?tf=1h">');
    expect(html).toContain('<a href="/about">');
    expect(html).toContain('<a href="/lang/ko?back=%2Fchart" data-lang>');
    expect(html).toContain('<form action="/ru/screener">');
    // The set is the same on every version: it names English as English.
    expect(html).toContain('hreflang="en" href="https://airrates.net/chart"');
  });

  test("an untranslated page, an error page and anything not HTML pass through", async () => {
    const about = await localizeHtml(
      page("", '<link rel="canonical" href="https://airrates.net/about">'),
      "ru",
    ).text();
    expect(about).not.toContain("hreflang");
    const missing = new Response("<html><head></head></html>", {
      status: 404,
      headers: { "content-type": "text/html" },
    });
    expect(localizeHtml(missing, "ru")).toBe(missing);
    const json = new Response("{}", { headers: { "content-type": "application/json" } });
    expect(localizeHtml(json, "ru")).toBe(json);
  });
});
