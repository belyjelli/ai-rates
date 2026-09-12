/**
 * A short-lived "this visitor solved a challenge" cookie, for the page-side backtest gate.
 *
 * WHY A COOKIE AND NOT A QUERY PARAMETER. The edge cache keys on the full URL, so a token in the
 * query string would miss cache on every request and would bake a single-use, 300-second credential
 * into a link this site expects people to share. A cookie rides alongside the URL without changing
 * it, so `/pair/:asset?long=…` stays both shareable and cacheable — and once one visitor solves the
 * challenge, the cached result serves everyone else for free.
 *
 * WHY AN HMAC AND NOT AN OPAQUE TOKEN. The expiry has to travel in the cookie so the Worker can
 * check it without storage, which makes it attacker-visible: unsigned, anyone could extend their own
 * clearance by editing one number. Signing it with the Turnstile secret (which never leaves the
 * Worker) makes the value unforgeable while keeping the check stateless.
 */

export const CLEARANCE_COOKIE = "airates_clear";

/** Long enough to try several sizes and windows; short enough that a copied cookie is near-worthless. */
export const CLEARANCE_TTL_MS = 30 * 60_000;

export interface Clearance {
  /** A `Set-Cookie` value granting clearance from `nowMs`. */
  issue(nowMs: number): Promise<string>;
  /** True when the request's `Cookie` header carries unexpired, authentic clearance. */
  check(cookieHeader: string | null, nowMs: number): Promise<boolean>;
}

export function createClearance(secret: string, ttlMs: number = CLEARANCE_TTL_MS): Clearance {
  const encoder = new TextEncoder();
  // Imported once; the promise is awaited per call rather than blocking construction.
  const keyPromise = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = async (payload: string): Promise<string> => {
    const signature = await crypto.subtle.sign("HMAC", await keyPromise, encoder.encode(payload));
    return base64url(signature);
  };

  return {
    async issue(nowMs) {
      const expiry = nowMs + ttlMs;
      const value = `${expiry}.${await mac(String(expiry))}`;
      // HttpOnly because no script reads it. SameSite=Lax so it survives the 303 back from the POST
      // while staying absent from cross-site requests.
      return `${CLEARANCE_COOKIE}=${value}; Path=/; Max-Age=${Math.floor(ttlMs / 1000)}; HttpOnly; Secure; SameSite=Lax`;
    },

    async check(cookieHeader, nowMs) {
      const raw = readCookie(cookieHeader, CLEARANCE_COOKIE);
      if (!raw) return false;
      const dot = raw.lastIndexOf(".");
      if (dot <= 0 || dot === raw.length - 1) return false;

      const expiry = Number(raw.slice(0, dot));
      if (!Number.isFinite(expiry) || expiry <= nowMs) return false;

      // The signature is recomputed over the expiry the cookie claims, so editing that number
      // invalidates the MAC rather than buying more time.
      return timingSafeEqual(raw.slice(dot + 1), await mac(String(expiry)));
    },
  };
}

/** One cookie out of a `Cookie` header, without a parser dependency. */
function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function base64url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/**
 * Length-independent comparison. The MACs here are fixed-length so a length check leaks nothing,
 * but comparing with `===` would exit at the first differing byte, which is the shape of a timing
 * oracle and not worth leaving in a signature check.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
