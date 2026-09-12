/**
 * Turnstile verification, for the one request that costs real work: an uncached backtest.
 *
 * The plan's wording is "Turnstile when the result isn't cached", and that falls out of the
 * architecture rather than needing logic: `index.ts` answers from `caches.default` before
 * `handleApp` is ever called, so anything reaching the gate is already a cache miss. A solved
 * challenge then populates the cache for an hour, so the next caller of the same URL pays nothing.
 *
 * Why it matters here specifically: an uncached backtest reads `funding_events` through Hyperdrive
 * on a Postgres instance shared with 16 other tenants, and the query parameters (size, days, both
 * legs) make the cache trivial to walk past. That is the path worth defending.
 */

/** Injected so the verifier is testable without a network or a global mock. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare caps the token; anything longer is not one and is refused without a round trip. */
const MAX_TOKEN_LENGTH = 2048;

/**
 * The widget's `data-action`. Verified on the server, so a token minted for some other form on the
 * site cannot be spent here.
 */
export const TURNSTILE_ACTION = "backtest";

/**
 * Hosts the widget is legitimately served from, checked against siteverify's `hostname`. A token
 * solved on someone else's page verifies successfully, so this is what makes it non-transferable.
 * Deliberately a constant rather than the request's own Host header, which a caller controls.
 */
export const TURNSTILE_HOSTNAMES: readonly string[] = [
  "airates.jobhesk.workers.dev",
  "localhost",
  "127.0.0.1",
];

/**
 * Cloudflare's name for the field the token arrives in. Used here as a request HEADER rather than a
 * query parameter: the edge cache keys on the full URL, so a token in the query string would make
 * every request a cache miss, and would put a single-use 300-second credential into a URL that this
 * site otherwise expects people to share.
 */
export const TURNSTILE_FIELD = "cf-turnstile-response";

export type TurnstileReason =
  | "missing_token"
  | "invalid_token"
  | "already_used"
  | "wrong_action"
  | "wrong_hostname"
  | "bad_secret"
  | "unavailable";

export interface TurnstileVerdict {
  ok: boolean;
  reason?: TurnstileReason;
  /** Cloudflare's own codes, kept for the log rather than shown to a caller. */
  errorCodes?: string[];
}

export interface VerifyOptions {
  secret: string;
  fetch?: FetchLike;
  /** `cf-connecting-ip`, when there is one. Optional per the API. */
  remoteip?: string | null;
  action?: string;
  hostnames?: readonly string[];
  /** A UUID makes a retry of the same verification safe; tokens are otherwise single-use. */
  idempotencyKey?: string;
}

/** The documented siteverify response. Every field is optional here because a failure omits most. */
interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
}

/**
 * Verifies a Turnstile token. Fails CLOSED: a network fault, a malformed body or an unexpected
 * status all refuse, because the gate exists to keep an expensive query off a shared database and
 * an open gate on error would be the same as no gate.
 *
 * `success` alone is never enough. A token minted for a different action, or solved on a different
 * host, comes back `success: true` and must still be refused -- that is the whole point of
 * verifying `action` and `hostname` as well.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  options: VerifyOptions,
): Promise<TurnstileVerdict> {
  const trimmed = token?.trim();
  // No round trip for an absent token: siteverify would only answer missing-input-response, and a
  // token is single-use, so there is nothing to spend.
  if (!trimmed) return { ok: false, reason: "missing_token" };
  if (trimmed.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "invalid_token" };

  const body = new URLSearchParams({ secret: options.secret, response: trimmed });
  if (options.remoteip) body.set("remoteip", options.remoteip);
  if (options.idempotencyKey) body.set("idempotency_key", options.idempotencyKey);

  const doFetch = options.fetch ?? fetch;
  let payload: SiteverifyResponse;
  try {
    const response = await doFetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    payload = (await response.json()) as SiteverifyResponse;
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const codes = payload["error-codes"] ?? [];
  if (!payload.success) return { ok: false, reason: reasonFor(codes), errorCodes: codes };

  const action = options.action ?? TURNSTILE_ACTION;
  if (action && payload.action !== action) {
    return { ok: false, reason: "wrong_action", errorCodes: codes };
  }

  const hostnames = options.hostnames ?? TURNSTILE_HOSTNAMES;
  if (hostnames.length > 0 && !(payload.hostname && hostnames.includes(payload.hostname))) {
    return { ok: false, reason: "wrong_hostname", errorCodes: codes };
  }

  return { ok: true };
}

/** Cloudflare's codes, narrowed to something a log line can be read from. */
function reasonFor(codes: readonly string[]): TurnstileReason {
  // A replayed or expired token: tokens last 300 seconds and verify exactly once.
  if (codes.includes("timeout-or-duplicate")) return "already_used";
  if (codes.includes("missing-input-response")) return "missing_token";
  if (codes.includes("missing-input-secret") || codes.includes("invalid-input-secret")) {
    return "bad_secret";
  }
  if (codes.includes("internal-error")) return "unavailable";
  return "invalid_token";
}
