/**
 * Verifies a Cloudflare Access token, so a route can trust who is asking.
 *
 * Cloudflare Access sits in front of /admin. It signs the visitor in and forwards the request with a
 * signed JWT in the `Cf-Access-Jwt-Assertion` header. Access is configured in the dashboard, not
 * here, so the Worker cannot assume it is actually in front of a request: a policy left off one
 * hostname would reach the route with no Access at all. Checking the token's signature, audience,
 * issuer and expiry here is what keeps the route safe either way.
 *
 * RS256 through WebCrypto, with keys from the team's /cdn-cgi/access/certs. No library: the check
 * is small, and a dependency would be one more place that could quietly accept a bad token.
 */

export interface AccessConfig {
  /** `https://<team>.cloudflareaccess.com`, the token's expected issuer. */
  teamDomain: string;
  /** The Access application's Audience (AUD) tag. */
  aud: string;
}

export interface AccessIdentity {
  email: string | null;
  subject: string;
}

export type FetchLike = (url: string) => Promise<Response>;

const KEYS_TTL_MS = 10 * 60_000;
const CLOCK_SKEW_S = 60;
const keyCache = new Map<string, { keys: JsonWebKey[]; fetchedAt: number }>();

/**
 * The Access settings from configuration, or null when either is missing or malformed. Null means the
 * admin area refuses every request; it never means "skip the check".
 */
export function accessConfig(
  teamDomain: string | undefined,
  aud: string | undefined,
): AccessConfig | null {
  const host = teamDomain
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  const audience = aud?.trim();
  if (!host || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(host)) return null;
  return { teamDomain: `https://${host}`, aud: audience };
}

/** Test hook: signing keys are cached per isolate. */
export function resetAccessKeyCache(): void {
  keyCache.clear();
}

// Uint8Array<ArrayBuffer> rather than the default ArrayBufferLike, which WebCrypto's BufferSource refuses.
function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const decodeJson = (part: string): unknown =>
  JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));

async function signingKeys(
  config: AccessConfig,
  fetchImpl: FetchLike,
  nowMs: number,
  refresh: boolean,
): Promise<JsonWebKey[]> {
  const cached = keyCache.get(config.teamDomain);
  if (cached && !refresh && nowMs - cached.fetchedAt < KEYS_TTL_MS) return cached.keys;
  const response = await fetchImpl(`${config.teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs returned HTTP ${response.status}`);
  const body = (await response.json()) as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? (body.keys as JsonWebKey[]) : [];
  keyCache.set(config.teamDomain, { keys, fetchedAt: nowMs });
  return keys;
}

/** The identity in a valid token, or null for anything missing, malformed, expired or not ours. */
export async function verifyAccessToken(
  token: string | null,
  config: AccessConfig,
  options: { fetch?: FetchLike; now?: () => number } = {},
): Promise<AccessIdentity | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const fetchImpl: FetchLike = options.fetch ?? ((url) => fetch(url));
  const nowMs = (options.now ?? Date.now)();

  try {
    const header = decodeJson(headerPart) as { alg?: unknown; kid?: unknown };
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

    const byKid = (keys: JsonWebKey[]) =>
      keys.find((key) => (key as { kid?: unknown }).kid === header.kid);
    // An unknown kid can be a rotated key the cache has not seen yet, so look once more before refusing.
    const jwk =
      byKid(await signingKeys(config, fetchImpl, nowMs, false)) ??
      byKid(await signingKeys(config, fetchImpl, nowMs, true));
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
    if (
      !(await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        base64UrlDecode(signaturePart),
        signed,
      ))
    ) {
      return null;
    }

    const claims = decodeJson(payloadPart) as {
      aud?: unknown;
      iss?: unknown;
      exp?: unknown;
      nbf?: unknown;
      email?: unknown;
      sub?: unknown;
    };
    const nowS = nowMs / 1000;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(config.aud)) return null;
    if (claims.iss !== config.teamDomain) return null;
    if (typeof claims.exp !== "number" || claims.exp <= nowS - CLOCK_SKEW_S) return null;
    if (typeof claims.nbf === "number" && claims.nbf > nowS + CLOCK_SKEW_S) return null;

    return {
      email: typeof claims.email === "string" ? claims.email : null,
      subject: typeof claims.sub === "string" ? claims.sub : "",
    };
  } catch {
    return null;
  }
}
