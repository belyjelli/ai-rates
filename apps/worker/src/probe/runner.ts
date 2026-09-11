import { mapPool } from "@ai-rates/core";
import type { VenueProbe } from "@ai-rates/venues";
import { classify, type Verdict } from "./classify";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProbeTarget {
  venueId: string;
  endpoints: readonly VenueProbe[];
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
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const { verdict, detail } = classify({
      status: response.status,
      headers: response.headers,
      body: text,
    });
    return {
      ...base,
      verdict,
      status: response.status,
      latencyMs: Date.now() - started,
      bytes: buffer.byteLength,
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

/** Probes every endpoint of every target; targets without endpoints yield one "unconfigured" row. */
export async function runProbe(
  targets: readonly ProbeTarget[],
  options: ProbeOptions,
): Promise<ProbeResult[]> {
  const jobs = targets.flatMap<{ venueId: string; endpoint: VenueProbe | null }>((target) =>
    target.endpoints.length === 0
      ? [{ venueId: target.venueId, endpoint: null }]
      : target.endpoints.map((endpoint) => ({ venueId: target.venueId, endpoint })),
  );
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
