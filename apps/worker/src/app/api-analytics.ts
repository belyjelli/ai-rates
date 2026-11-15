/**
 * Calls to the API, reported to Google Analytics from the Worker (owner, 2026-11-15: "what api is
 * being called the most").
 *
 * The API's callers are scripts, agents and MCP clients. They load no page and run no gtag, so the
 * browser tag (web/analytics.ts) never sees them, and app/visits.ts leaves them out of the page count
 * on purpose. This sends one `api_call` event per call through GA4's Measurement Protocol, after the
 * response has left (waitUntil), so a slow or refused send costs the caller nothing.
 *
 * It does nothing until GA_API_SECRET is set: the property's Measurement Protocol secret, created in
 * GA (Admin > Data streams > airrates.net > Measurement Protocol API secrets) and kept as a Worker
 * secret in the dashboard, like ADMIN_PASSWORD.
 *
 * What is sent: the endpoint, the HTTP method and status, the MCP or A2A method and tool for those, and
 * the calling program's name from its User-Agent (python-requests, curl, a browser). No address, no
 * query string, no body beyond the method and tool name. GA wants a client id per "user": each calling
 * program's name is one, so a thousand calls from one script count as one user, not a thousand, and
 * the property's user counts for people stay what they were.
 */
import { A2A_PATH } from "./a2a";
import { MCP_PATH } from "./mcp";

export const GA_MEASUREMENT_ID = "G-PJNK8JFLTQ";
const COLLECT = "https://www.google-analytics.com/mp/collect";

export interface ApiCall {
  endpoint: string;
  method: string;
  /** A browser, or the first product in the User-Agent: curl, python-requests, Go-http-client. */
  client: string;
  /** For MCP and A2A: the JSON-RPC method, and the tool for tools/call. */
  rpc?: string;
  tool?: string;
}

/** The endpoint a request is a call to, or null for anything that is not the API. */
export function apiEndpoint(url: URL): string | null {
  const path = url.pathname;
  if (path.startsWith("/v1/")) return path.slice(0, 100);
  if (path === MCP_PATH || path === A2A_PATH) return path;
  return null;
}

/** The calling program, as a short stable name. Never the full User-Agent: that is a fingerprint. */
export function clientName(userAgent: string | null): string {
  const ua = (userAgent ?? "").trim();
  if (ua === "") return "none";
  if (/^Mozilla\/\d/.test(ua)) return /bot|crawler|spider/i.test(ua) ? "crawler" : "browser";
  const product = /^[A-Za-z][\w.-]{0,39}/.exec(ua)?.[0];
  return product ? product.toLowerCase() : "other";
}

/** MCP and A2A are JSON-RPC: the method, and for a tool call the tool's name. A batch is its first. */
export function rpcOf(body: string): { rpc?: string; tool?: string } {
  try {
    const parsed: unknown = JSON.parse(body);
    const first = (Array.isArray(parsed) ? parsed[0] : parsed) as {
      method?: unknown;
      params?: { name?: unknown };
    } | null;
    const rpc = typeof first?.method === "string" ? first.method.slice(0, 60) : undefined;
    const tool =
      typeof first?.params?.name === "string" ? first.params.name.slice(0, 60) : undefined;
    return { ...(rpc ? { rpc } : {}), ...(tool ? { tool } : {}) };
  } catch {
    return {};
  }
}

/** The Measurement Protocol body for one call. */
export function apiCallEvent(call: ApiCall, status: number) {
  return {
    client_id: `api.${call.client}`,
    non_personalized_ads: true,
    events: [
      {
        name: "api_call",
        params: {
          api_endpoint: call.endpoint,
          api_method: call.method,
          api_status: status,
          api_client: call.client,
          ...(call.rpc ? { api_rpc: call.rpc } : {}),
          ...(call.tool ? { api_tool: call.tool } : {}),
        },
      },
    ],
  };
}

/** Sends one call. Never throws: analytics must not turn into an error in the log or the response. */
export async function reportApiCall(o: {
  secret: string;
  call: ApiCall;
  status: number;
  fetch: typeof fetch;
}): Promise<void> {
  const url = `${COLLECT}?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${encodeURIComponent(o.secret)}`;
  try {
    await o.fetch(url, {
      method: "POST",
      body: JSON.stringify(apiCallEvent(o.call, o.status)),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Google unreachable or slow: the call is simply not counted.
  }
}
