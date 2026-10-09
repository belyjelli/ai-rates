import { rankedLanguages } from "../web/i18n";

/**
 * One page view as an Analytics Engine data point, or null for anything that is not a person opening
 * a page. No cookies and no address: the questions are which posts bring readers, which pages they
 * land on, and which languages they read, and none of them needs to know who the reader is.
 *
 * Counted in index.ts ahead of the edge cache, because a page served from the cache never reaches the
 * app. Read back with apps/worker/scripts/visits.ts.
 */
export interface VisitPoint {
  /** The source again, as the sampling key: Analytics Engine samples within an index. */
  indexes: [string];
  /** source, path, country, language. */
  blobs: [string, string, string, string];
  doubles: [number];
}

/** What a post's link may carry as `ref`: a short slug such as `x` or `tg`. Anything else is dropped. */
const REF_PATTERN = /^[a-z0-9_-]{1,32}$/;
/** Analytics Engine refuses an index past 96 bytes. */
const MAX_SOURCE = 96;
const MAX_PATH = 256;
/**
 * A language and at most one subtag after it, cut at a subtag boundary: `ja`, `en-us`, `zh-tw`, and
 * `zh-hant` from `zh-Hant-TW`. Anything else (`english`, `x-klingon`) is stored as unknown.
 */
const LANGUAGE_PATTERN = /^[a-z]{2,3}(-[a-z0-9]{2,8})?(?=-|$)/;

export function visitPoint(request: Request, country?: string): VisitPoint | null {
  if (request.method !== "GET") return null;
  // A page load only. The live refresh and the backtest button's polling fetch() the same address
  // every few seconds, and link-preview crawlers (X's card fetch among them) send no Sec-Fetch headers
  // at all, so none of them count as a reader.
  if (request.headers.get("sec-fetch-mode") !== "navigate") return null;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/probe")) return null;

  const from = source(url, request.headers.get("referer"));
  return {
    indexes: [from],
    blobs: [
      from,
      url.pathname.slice(0, MAX_PATH),
      country ?? "",
      language(request.headers.get("accept-language")),
    ],
    doubles: [1],
  };
}

/**
 * The language the reader's browser asks for first, whether or not the site has it: the count is
 * there to show which translation readers are missing (2026-10-09, when Japan looked like a market
 * and turned out to be ~60 page loads a day). Empty when the browser sends none.
 */
function language(header: string | null): string {
  const first = rankedLanguages(header).find((tag) => tag !== "*");
  return LANGUAGE_PATTERN.exec(first?.toLowerCase() ?? "")?.[0] ?? "";
}

/**
 * A post's own `ref` first, since it names the post; then the referring site; "internal" for a click
 * between the site's own pages, so arrivals and browsing can be told apart; "direct" for none.
 */
function source(url: URL, referer: string | null): string {
  const ref = (url.searchParams.get("ref") ?? "").toLowerCase();
  if (REF_PATTERN.test(ref)) return ref;
  if (!referer) return "direct";
  try {
    const host = new URL(referer).hostname.toLowerCase();
    return host === url.hostname ? "internal" : host.replace(/^www\./, "").slice(0, MAX_SOURCE);
  } catch {
    return "direct";
  }
}
