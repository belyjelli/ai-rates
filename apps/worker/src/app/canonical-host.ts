/**
 * One host for the site: www.airrates.net is sent, permanently, to the same address on airrates.net.
 *
 * WHY (2026-11-14). Both hosts served every page, so search engines and scrapers crawled the site
 * twice over -- www was 6.1M of the 11M requests in the 30 days before -- while the pages' canonical
 * links already named the bare host. And the member site answers CORS for the bare origin only, so a
 * reader who came in on www could not use a member's live table or saved shortcuts.
 *
 * Done first in index.ts, before anything is read, cached or counted: the redirect is the whole answer.
 */
export const CANONICAL_HOST = "airrates.net";
const WWW_HOST = `www.${CANONICAL_HOST}`;

export function wwwRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== WWW_HOST) return null;
  url.hostname = CANONICAL_HOST;
  // 301 for what a browser or a crawler opens; 308 for anything else (an agent's POST to /mcp), which
  // keeps its method and body on the way over.
  const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
  return new Response(null, {
    status,
    headers: { location: url.toString(), "cache-control": "public, max-age=86400" },
  });
}
