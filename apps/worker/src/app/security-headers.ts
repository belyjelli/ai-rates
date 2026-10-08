/**
 * Response headers that harden every page and API response.
 *
 * WHY THESE, AND WHY HERE. Until 2026-10-07 the public site sent none: any other site could frame a
 * page (clickjacking), the browser was free to guess content types, and nothing limited which
 * scripts a page may run. The pages hold no secrets -- the member area with the API keys is its own
 * app -- so the aim is narrow: a page here should only ever run the scripts this Worker wrote, plus
 * Google Analytics, and should never be framed.
 *
 * SCRIPTS ARE ALLOWED BY HASH, not by 'unsafe-inline' and not by nonce. Each page carries a handful of
 * inline scripts (layout.ts, the charts, the tabs) and is served from the edge cache, so a per-request
 * nonce would be baked into a cached copy and reused anyway. A hash of each script's exact text is
 * computed once per render, from the HTML that is about to be cached, and stored with it: a cached
 * copy carries the policy that matches its own scripts. JSON data blocks (`type="application/json"`,
 * `application/ld+json`) are never executed, so they need no hash.
 *
 * STYLES KEEP 'unsafe-inline'. Bar widths, chart positions and heat colours are style attributes on
 * thousands of elements, which a hash cannot cover. An injected style can restyle a page but cannot
 * run code, and every value that reaches markup goes through `esc` already.
 */

/** The headers every response gets, page or API, unless the handler set its own. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  // A year, no includeSubDomains: a subdomain this Worker does not serve should not be pinned by it.
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  // For browsers that predate frame-ancestors; the CSP says the same for the rest.
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
};

// Google Analytics 4, as Google documents its CSP: the loader from googletagmanager, beacons to
// google-analytics and analytics.google.com, and pixels from either.
const GA_SCRIPT = "https://*.googletagmanager.com";
const GA_CONNECT =
  "https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com";
const GA_IMG = "https://*.google-analytics.com https://*.googletagmanager.com";
// Cloudflare Web Analytics: the zone injects this beacon at the edge, after the Worker, so it is the
// one script on the page this code never sees. Found by the first live check on 2026-10-07: every
// page refused it. Cloudflare documents exactly these two origins for it.
const CF_BEACON_SCRIPT = "https://static.cloudflareinsights.com";
const CF_BEACON_CONNECT = "https://cloudflareinsights.com";
// The member area, for the one call a page makes to it: /keys reads and saves a signed-in member's
// keyboard profiles there (web/keyboard.ts). Its session cookie is its own; this only lets the call go.
const MEMBER_CONNECT = "https://member.airrates.net";

/**
 * The policy for one page, given the hashes of its inline scripts ('sha256-...' tokens).
 *
 * After changing it, load the live pages in a browser and read the console, not just these tests:
 * scripts the edge adds are invisible from here.
 */
export function contentSecurityPolicy(scriptHashes: readonly string[]): string {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...scriptHashes, GA_SCRIPT, CF_BEACON_SCRIPT].join(" "),
    "style-src 'self' 'unsafe-inline'",
    // data: and blob: for the share card, which draws to a canvas and shows the PNG it made.
    `img-src 'self' data: blob: ${GA_IMG}`,
    `connect-src 'self' ${GA_CONNECT} ${CF_BEACON_CONNECT} ${MEMBER_CONNECT}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Types a browser executes; anything else in a <script> tag is a data block. */
const EXECUTABLE = /^(|text\/javascript|application\/javascript|module)$/i;

/**
 * The exact text of every executable inline script in `html`, in order. A script with a `src` is
 * loaded, not inline, and is covered by the source list instead.
 */
export function inlineScripts(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = match[1] ?? "";
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1] ?? "";
    if (!EXECUTABLE.test(type)) continue;
    found.push(match[2] ?? "");
  }
  return found;
}

/** 'sha256-<base64>' for one script's text, hashed as the browser hashes it: its UTF-8 bytes. */
export async function scriptHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return `'sha256-${btoa(binary)}'`;
}

/**
 * The response with the security headers it lacks, and, for an HTML page without one, the CSP that
 * matches its own inline scripts. Headers a handler set itself (the admin form's) are left alone.
 */
export async function withSecurityHeaders(response: Response): Promise<Response> {
  const html = (response.headers.get("content-type") ?? "").startsWith("text/html");
  const needsPolicy = html && !response.headers.has("content-security-policy");
  const missing = Object.entries(SECURITY_HEADERS).filter(([name]) => !response.headers.has(name));
  if (!needsPolicy && missing.length === 0) return response;

  let body: BodyInit | null = response.body;
  let policy: string | null = null;
  if (needsPolicy) {
    const text = await response.text();
    const hashes = [...new Set(await Promise.all(inlineScripts(text).map(scriptHash)))];
    policy = contentSecurityPolicy(hashes);
    body = text;
  }
  const out = new Response(body, response);
  for (const [name, value] of missing) out.headers.set(name, value);
  if (policy) out.headers.set("content-security-policy", policy);
  return out;
}
