/**
 * Query parameters that only analytics reads: campaign tags (utm_*) and the click ids ad and social
 * networks add (gclid, fbclid, ...). No page reads them, and Google Analytics takes them from the
 * address in the browser, not from anything the Worker renders.
 *
 * Left in the page cache's key they would cost renders: a campaign link is a few extra copies, but a
 * click id is different on every click, so each such visitor would miss the cache and render the page
 * against the database. With them taken out of the key, `/liquidations?utm_source=x` is served the
 * cached `/liquidations`. The address the reader sees keeps them, so GA still counts the campaign.
 *
 * `ref` is not here: app/visits.ts counts it, and the CVD history page reads a `ref` of its own.
 */
const TRACKING =
  /^(utm_[a-z_]+|gclid|gbraid|wbraid|dclid|fbclid|msclkid|twclid|ttclid|li_fat_id|igshid|mc_cid|mc_eid|_ga|_gl)$/i;

/**
 * The address without its tracking parameters, or null when it carries none. The rest of the query is
 * kept byte for byte, as the reader without a campaign tag would send it, so both land on one cached
 * copy (URLSearchParams would re-encode it: `a=BTC/USDT` back as `a=BTC%2FUSDT`, a different key).
 */
export function withoutTracking(url: URL): URL | null {
  const parts = url.search.replace(/^\?/, "").split("&");
  const kept = parts.filter((part) => {
    const name = part.split("=")[0] ?? "";
    let decoded = name;
    try {
      decoded = decodeURIComponent(name.replace(/\+/g, " "));
    } catch {
      // A malformed escape is not a tracking parameter's name.
    }
    return !TRACKING.test(decoded);
  });
  if (kept.length === parts.length) return null;
  const plain = new URL(url);
  plain.search = kept.filter((part) => part !== "").join("&");
  return plain;
}
