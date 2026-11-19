/**
 * An address for every language (owner, 2026-11-19: "improve Google search SEO").
 *
 * The page's language used to come only from the reader's cookie or Accept-Language, on one address
 * per page. A crawler sends neither, so search engines only ever saw English, and the seven
 * translations could not be found by anyone searching in Russian, Korean or Thai. Each translated page
 * now also lives under its language's prefix: /ru/liquidations/BTC is /liquidations/BTC in Russian,
 * /zh is the homepage in Chinese. English keeps the bare address, and /en/... is sent there.
 *
 * The prefix is taken off before anything else reads the request (index.ts), so routes, caches and
 * renders never see it: a prefixed page is the same render as a reader who chose that language by
 * cookie, from the same cache copy. On the way out, `localizeHtml` points that copy's canonical
 * address and its links at the prefixed addresses, and every page names its versions in the other
 * languages (hreflang), so a search engine shows each reader the page in their language.
 *
 * Only translated pages get prefixes. The legal pages, the changelog, the API docs and the agent pages
 * stay in English, so their prefixed addresses are sent to the English one.
 */
import { DEFAULT_LOCALE, LOCALE_INFO, LOCALES, type Locale, parseLocale } from "./i18n";
import { SITE_ORIGIN } from "./layout";

/** First path segments of the translated pages ("" is the homepage). */
const LOCALIZED_SECTIONS: ReadonlySet<string> = new Set([
  "",
  "screener",
  "rates",
  "arbitrage",
  "chart",
  "whales",
  "holdings",
  "indexes",
  "liquidations",
  "markets",
  "pair",
  "price-pair",
  "sentiment",
  "glossary",
  "status",
  "keys",
  "settings",
]);

const PREFIX = /^\/([a-z]{2})(?=\/|$)(.*)$/;

/** Whether a site path (no query) is a translated page, so it has an address per language. */
export function isLocalizable(path: string): boolean {
  if (!path.startsWith("/")) return false;
  return LOCALIZED_SECTIONS.has(path.split("/")[1] ?? "");
}

/** A path's language prefix and the path without it, or null when it has none. */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } | null {
  const match = PREFIX.exec(pathname);
  if (!match) return null;
  const locale = parseLocale(match[1]);
  if (!locale || locale !== match[1]) return null;
  return { locale, path: match[2] || "/" };
}

/** The address of `path` in `locale`: English is the bare path, the others are prefixed. */
export function localizedPath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE || !isLocalizable(path)) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export type LocaleRoute =
  | { kind: "redirect"; response: Response }
  | { kind: "localized"; locale: Locale; request: Request; incoming: Request };

/**
 * What a prefixed address means: the page in that language, with the prefix taken off the request,
 * or a permanent redirect for /en/... and for pages that are not translated. Null for any address
 * without a prefix.
 */
export function routeLocale(request: Request): LocaleRoute | null {
  const url = new URL(request.url);
  const split = splitLocalePath(url.pathname);
  if (!split) return null;
  if (split.locale === DEFAULT_LOCALE || !isLocalizable(split.path)) {
    const location = `${split.path}${url.search}`;
    return {
      kind: "redirect",
      response: new Response(null, {
        status: 301,
        headers: { location, "cache-control": "public, max-age=86400" },
      }),
    };
  }
  const inner = new URL(url);
  inner.pathname = split.path;
  return {
    kind: "localized",
    locale: split.locale,
    request: new Request(inner.toString(), request),
    incoming: request,
  };
}

/**
 * The language switch (/lang/<code>?back=...) lands on the page's address in the chosen language,
 * so the switch is also a link a crawler can follow between versions. The page script fills `back`
 * from the address bar, which may carry the old prefix: it is dropped first.
 */
export function localizeSwitch(response: Response, request: Request): Response {
  const location = response.headers.get("location");
  const locale = parseLocale(new URL(request.url).pathname.split("/")[2]);
  if (!location || !locale || !location.startsWith("/")) return response;
  const [pathAndQuery = "/", hash = ""] = location.split("#", 2);
  const queryAt = pathAndQuery.indexOf("?");
  const pathname = queryAt === -1 ? pathAndQuery : pathAndQuery.slice(0, queryAt);
  const query = queryAt === -1 ? "" : pathAndQuery.slice(queryAt);
  const bare = splitLocalePath(pathname)?.path ?? pathname;
  const next = `${localizedPath(locale, bare)}${query}${hash ? `#${hash}` : ""}`;
  const headers = new Headers(response.headers);
  headers.set("location", next);
  return new Response(null, { status: response.status, headers });
}

/** The <link rel="alternate" hreflang> set for a translated page's canonical path. */
export function hreflangLinks(path: string): string {
  const links = LOCALES.map(
    (locale) =>
      `<link rel="alternate" hreflang="${LOCALE_INFO[locale].htmlLang}" href="${SITE_ORIGIN}${localizedPath(locale, path)}">`,
  );
  links.push(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${path}">`);
  return `\n${links.join("\n")}`;
}

/** A site-relative href ("/rates?x=1#y") with its translated path prefixed; anything else unchanged. */
export function prefixHref(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/\\")) return href;
  const cut = href.search(/[?#]/);
  const pathname = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? "" : href.slice(cut);
  if (splitLocalePath(pathname)) return href;
  if (!isLocalizable(pathname)) return href;
  return `${localizedPath(locale, pathname)}${rest}`;
}

/** What `localizeHtml` reads and writes on an element (the Workers and Bun rewriters both have it). */
interface AttributeElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): unknown;
}

/** The path of an absolute address on this site, or null. */
function sitePath(href: string | null): string | null {
  if (!href?.startsWith(`${SITE_ORIGIN}/`)) return null;
  return href.slice(SITE_ORIGIN.length) || "/";
}

/**
 * A rendered page on its way out: on every translated page, the hreflang set after its canonical
 * link; on a prefixed address, the canonical, og:url and every link to a translated page pointed at
 * that language's addresses. Fragments (a lazily loaded tab) have no <head> and only get their links
 * prefixed. Anything that is not a 200 HTML response is returned as it is.
 */
export function localizeHtml(response: Response, locale: Locale | null): Response {
  if (response.status !== 200) return response;
  if (!response.headers.get("content-type")?.startsWith("text/html")) return response;
  const prefix = locale && locale !== DEFAULT_LOCALE ? locale : null;
  let canonical: string | null = null;
  const rewriteSelf = (element: AttributeElement, attribute: string) => {
    const path = sitePath(element.getAttribute(attribute));
    if (path === null) return null;
    if (prefix && isLocalizable(path)) {
      element.setAttribute(attribute, `${SITE_ORIGIN}${localizedPath(prefix, path)}`);
    }
    return path;
  };
  let rewriter = new HTMLRewriter()
    .on('link[rel="canonical"]', {
      element(element) {
        canonical = rewriteSelf(element, "href");
      },
    })
    .on('meta[property="og:url"]', {
      element(element) {
        rewriteSelf(element, "content");
      },
    })
    .on("head", {
      element(element) {
        element.onEndTag((end) => {
          if (canonical !== null && isLocalizable(canonical)) {
            end.before(hreflangLinks(canonical), { html: true });
          }
        });
      },
    });
  if (prefix) {
    rewriter = rewriter.on("a[href], form[action]", {
      element(element) {
        const attribute = element.tagName === "form" ? "action" : "href";
        const value = element.getAttribute(attribute);
        if (value === null) return;
        const next = prefixHref(prefix, value);
        if (next !== value) element.setAttribute(attribute, next);
      },
    });
  }
  return rewriter.transform(response);
}
