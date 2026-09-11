export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpClientOptions {
  fetch?: FetchLike;
  userAgent?: string;
  timeoutMs?: number;
  /** Retries after the first attempt for network errors, timeouts, 429/418 and 5xx. */
  maxRetries?: number;
  /** Minimum spacing between request starts for this venue, in ms. */
  minIntervalMs?: number;
  /** Consecutive failed calls (after retries) before the circuit opens, and how long it stays open. */
  breaker?: { failureThreshold: number; cooldownMs: number };
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

export class HttpError extends Error {
  constructor(
    readonly venueId: string,
    readonly url: string,
    readonly status: number | null,
    message: string,
  ) {
    super(`${venueId}: ${message} (${url})`);
    this.name = "HttpError";
  }
}

export class CircuitOpenError extends Error {
  constructor(
    readonly venueId: string,
    readonly retryAt: number,
  ) {
    super(`${venueId}: circuit open until ${new Date(retryAt).toISOString()}`);
    this.name = "CircuitOpenError";
  }
}

export interface HttpClient {
  readonly venueId: string;
  getJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T>;
  postJson<T = unknown>(url: string, body: unknown, headers?: Record<string, string>): Promise<T>;
  circuit(): { open: boolean; consecutiveFailures: number; retryAt: number | null };
  /** Fetch attempts made so far, including retries. */
  requestCount(): number;
}

export const USER_AGENT = "ai-rates-collector/0.1";

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;
const MAX_RETRY_AFTER_MS = 60_000;

/**
 * JSON client for one venue: spaces requests, retries transient failures with jittered exponential
 * backoff (honouring Retry-After), and opens a circuit after repeated failures so a broken venue
 * doesn't burn its rate limit or stall the collector.
 */
export function createHttpClient(venueId: string, options: HttpClientOptions = {}): HttpClient {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const minIntervalMs = options.minIntervalMs ?? 0;
  const breaker = options.breaker ?? { failureThreshold: 5, cooldownMs: 5 * 60_000 };

  let nextSlotAt = 0;
  let requests = 0;
  let consecutiveFailures = 0;
  let openUntil: number | null = null;

  async function waitForSlot(): Promise<void> {
    if (minIntervalMs <= 0) return;
    const start = Math.max(now(), nextSlotAt);
    nextSlotAt = start + minIntervalMs; // reserved synchronously so concurrent callers queue up
    const wait = start - now();
    if (wait > 0) await sleep(wait);
  }

  async function attempt(
    url: string,
    init: RequestInit,
  ): Promise<{ value?: unknown; retryIn?: number; error: HttpError | null }> {
    await waitForSlot();
    requests++;
    let response: Response;
    try {
      response = await doFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const reason = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network error";
      return { error: new HttpError(venueId, url, null, reason), retryIn: -1 };
    }

    if (response.ok) {
      const text = await response.text();
      try {
        return { value: JSON.parse(text), error: null };
      } catch {
        return {
          error: new HttpError(
            venueId,
            url,
            response.status,
            `invalid JSON: ${text.slice(0, 120)}`,
          ),
        };
      }
    }

    const snippet = (await response.text().catch(() => "")).slice(0, 160);
    const error = new HttpError(
      venueId,
      url,
      response.status,
      `HTTP ${response.status} ${snippet}`,
    );
    const transient = response.status === 429 || response.status === 418 || response.status >= 500;
    if (!transient) return { error };
    return { error, retryIn: retryAfterMs(response.headers.get("retry-after"), now()) ?? -1 };
  }

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    if (openUntil !== null) {
      if (now() < openUntil) throw new CircuitOpenError(venueId, openUntil);
      openUntil = null; // half-open: let this call through
    }

    let lastError: HttpError | null = null;
    for (let tryNo = 0; tryNo <= maxRetries; tryNo++) {
      const result = await attempt(url, init);
      if (!result.error) {
        consecutiveFailures = 0;
        return result.value as T;
      }
      lastError = result.error;
      if (result.retryIn === undefined || tryNo === maxRetries) break;
      const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** tryNo) * random();
      await sleep(result.retryIn >= 0 ? result.retryIn : backoff);
    }

    consecutiveFailures++;
    if (consecutiveFailures >= breaker.failureThreshold) openUntil = now() + breaker.cooldownMs;
    throw lastError;
  }

  const baseHeaders = { accept: "application/json", "user-agent": options.userAgent ?? USER_AGENT };

  return {
    venueId,
    getJson: (url, headers) =>
      request(url, { method: "GET", headers: { ...baseHeaders, ...headers } }),
    postJson: (url, body, headers) =>
      request(url, {
        method: "POST",
        headers: { ...baseHeaders, "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    circuit: () => ({
      open: openUntil !== null && now() < openUntil,
      consecutiveFailures,
      retryAt: openUntil,
    }),
    requestCount: () => requests,
  };
}

/** Parses Retry-After (delta-seconds or HTTP date) into ms from `nowMs`, capped at 60s. */
export function retryAfterMs(header: string | null, nowMs: number): number | null {
  if (!header) return null;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - nowMs;
  if (!Number.isFinite(ms)) return null;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, ms));
}
