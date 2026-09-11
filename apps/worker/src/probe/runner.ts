import { mapPool } from "@ai-rates/core";
import type { VenueProbe } from "@ai-rates/venues";
import { classify, type Verdict } from "./classify";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProbeTarget {
  venueId: string;
  endpoints: readonly VenueProbe[];
}

/** One fetch to make, or a placeholder row for a venue without endpoints. */
export interface ProbeJob {
  venueId: string;
  endpoint: VenueProbe | null;
}

export interface ProbeResult {
  venueId: string;
  label: string;
  url: string | null;
  verdict: Verdict;
  status: number | null;
  latencyMs: number | null;
  bytes: number | null;
  detail: string | null;
}

export interface ProbeOptions {
  fetch: FetchLike;
  /** Keep at 5 or below: Workers cap simultaneous outbound connections at 6. */
  concurrency?: number;
  timeoutMs?: number;
  userAgent?: string;
}

export interface EgressTrace {
  colo: string | null;
  ip: string | null;
  loc: string | null;
}

export const USER_AGENT = "ai-rates-probe/0.1";

/** Bodies up to this size are fully decoded and JSON-parsed; larger ones only have their head decoded. */
export const FULL_PARSE_BYTES = 16 * 1024;
const HEAD_BYTES = 4096;

const decoder = new TextDecoder();

export async function probeEndpoint(
  venueId: string,
  endpoint: VenueProbe,
  options: ProbeOptions,
): Promise<ProbeResult> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": options.userAgent ?? USER_AGENT,
    ...endpoint.headers,
  };
  let body: string | undefined;
  if (endpoint.body !== undefined) {
    body = JSON.stringify(endpoint.body);
    headers["content-type"] = "application/json";
  }

  const base = { venueId, label: endpoint.label, url: endpoint.url };
  const started = Date.now();
  try {
    const response = await options.fetch(endpoint.url, {
      method: endpoint.method ?? (body === undefined ? "GET" : "POST"),
      headers,
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const truncated = bytes.byteLength > FULL_PARSE_BYTES;
    const { verdict, detail } = classify({
      status: response.status,
      headers: response.headers,
      body: decoder.decode(truncated ? bytes.subarray(0, HEAD_BYTES) : bytes),
      truncated,
      lastChar: lastNonWhitespace(bytes),
    });
    return {
      ...base,
      verdict,
      status: response.status,
      latencyMs: Date.now() - started,
      bytes: bytes.byteLength,
      detail,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return {
      ...base,
      verdict: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error",
      status: null,
      latencyMs: Date.now() - started,
      bytes: null,
      detail: (error instanceof Error ? error.message : String(error)).slice(0, 240),
    };
  }
}

/** Flattens targets into one job per endpoint; targets without endpoints get one placeholder job. */
export function planJobs(targets: readonly ProbeTarget[]): ProbeJob[] {
  return targets.flatMap<ProbeJob>((target) =>
    target.endpoints.length === 0
      ? [{ venueId: target.venueId, endpoint: null }]
      : target.endpoints.map((endpoint) => ({ venueId: target.venueId, endpoint })),
  );
}

export function runJobs(jobs: readonly ProbeJob[], options: ProbeOptions): Promise<ProbeResult[]> {
  return mapPool(
    jobs,
    options.concurrency ?? 5,
    async ({ venueId, endpoint }): Promise<ProbeResult> =>
      endpoint
        ? probeEndpoint(venueId, endpoint, options)
        : {
            venueId,
            label: "-",
            url: null,
            verdict: "unconfigured",
            status: null,
            latencyMs: null,
            bytes: null,
            detail: null,
          },
  );
}

export function runProbe(
  targets: readonly ProbeTarget[],
  options: ProbeOptions,
): Promise<ProbeResult[]> {
  return runJobs(planJobs(targets), options);
}

/** Parses Cloudflare's /cdn-cgi/trace output, which reports where a request egressed from. */
export function parseTrace(text: string): EgressTrace {
  const fields = new Map(
    text
      .split("\n")
      .map((line) => line.split("=", 2) as [string, string | undefined])
      .filter((pair): pair is [string, string] => pair[1] !== undefined),
  );
  return {
    colo: fields.get("colo") ?? null,
    ip: fields.get("ip") ?? null,
    loc: fields.get("loc") ?? null,
  };
}

export async function fetchEgressTrace(fetch: FetchLike, timeoutMs = 5_000): Promise<EgressTrace> {
  try {
    const response = await fetch("https://cloudflare.com/cdn-cgi/trace", {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return parseTrace(await response.text());
  } catch {
    return { colo: null, ip: null, loc: null };
  }
}

function lastNonWhitespace(bytes: Uint8Array): string | null {
  for (let i = bytes.byteLength - 1; i >= 0; i--) {
    const byte = bytes[i] as number;
    if (byte !== 0x20 && byte !== 0x0a && byte !== 0x0d && byte !== 0x09) {
      return String.fromCharCode(byte);
    }
  }
  return null;
}
