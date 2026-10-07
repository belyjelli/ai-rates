import { SITE_ORIGIN } from "../web/layout";
import { type DataSource, STALE_MS } from "./data";
import { DEFAULT_FILTERS } from "./params";

/** Where MCP requests are posted (Streamable HTTP, JSON responses only, no sessions). */
export const MCP_PATH = "/mcp";
const SERVER = { name: "airrates", title: "airrates", version: "1.0.0" };
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const ATTRIBUTION = `Data from airrates.net. Please credit and link ${SITE_ORIGIN}.`;

const TOOLS = [
  {
    name: "get_top_spreads",
    description:
      "Widest annualised funding-rate spreads between exchanges for the same perpetual asset, with the long and short venue. Before fees and slippage; not financial advice.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 25,
          description: "Pairs to return (default 10).",
        },
      },
    },
  },
  {
    name: "get_asset_funding",
    description:
      "Annualised funding rate (APR) of one asset on every exchange that lists it, highest first.",
    inputSchema: {
      type: "object",
      properties: { asset: { type: "string", description: "Base asset, for example BTC." } },
      required: ["asset"],
    },
  },
  {
    name: "get_data_status",
    description:
      "How many markets, venues and assets airrates tracks, and whether the data is fresh.",
    inputSchema: { type: "object", properties: {} },
  },
].map((tool) => ({ ...tool, annotations: { readOnlyHint: true, openWorldHint: false } }));

/** The MCP Server Card served at /.well-known/mcp/server-card.json. */
export function mcpServerCard(): Record<string, unknown> {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
    serverInfo: SERVER,
    description:
      "Read-only perpetual-futures funding rates and cross-exchange spreads from airrates.net.",
    documentationUrl: `${SITE_ORIGIN}/docs`,
    protocolVersion: PROTOCOLS[0],
    transport: { type: "streamable-http", endpoint: `${SITE_ORIGIN}${MCP_PATH}` },
    endpoint: `${SITE_ORIGIN}${MCP_PATH}`,
    authentication: { required: false },
    capabilities: { tools: { listChanged: false } },
    tools: TOOLS.map(({ name, description }) => ({ name, description })),
  };
}

const MAX_BODY_CHARS = 16_384;
const reply = (id: unknown, body: Record<string, unknown>) =>
  Response.json(
    { jsonrpc: "2.0", id: id ?? null, ...body },
    { headers: { "cache-control": "no-store" } },
  );
const fail = (id: unknown, code: number, message: string) =>
  reply(id, { error: { code, message } });
const text = (value: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

async function callTool(
  name: string,
  args: Record<string, unknown>,
  data: DataSource,
  now: number,
) {
  if (name === "get_top_spreads") {
    const asked = Number(args.limit);
    const limit = Number.isFinite(asked) ? Math.min(Math.max(Math.trunc(asked), 1), 25) : 10;
    const pairs = await data.screener({ ...DEFAULT_FILTERS, limit });
    return text({
      attribution: ATTRIBUTION,
      pairs: pairs.map((p) => ({
        asset: p.asset,
        asset_class: p.asset_class,
        spread_apr: p.spread_apr,
        long: { venue: p.long_venue_id, apr: p.long_apr },
        short: { venue: p.short_venue_id, apr: p.short_apr },
        venue_count: p.venue_count,
      })),
    });
  }
  if (name === "get_asset_funding") {
    const asset = typeof args.asset === "string" ? args.asset.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{1,24}$/.test(asset)) return text("asset must be a ticker such as BTC", true);
    const markets = await data.asset(asset, null);
    if (markets.length === 0)
      return text(`No exchange has a live ${asset} perpetual right now.`, true);
    return text({
      attribution: ATTRIBUTION,
      asset,
      markets: [...markets]
        .sort((a, b) => b.apr - a.apr)
        .map((m) => ({
          venue: m.venue_id,
          apr: m.apr,
          apr_7d: m.apr_7d,
          open_interest_usd: m.open_interest_usd,
        })),
    });
  }
  if (name === "get_data_status") {
    const o = await data.overview();
    const at = o.updated_at?.getTime() ?? null;
    return text({
      attribution: ATTRIBUTION,
      markets: o.markets,
      venues: o.venues,
      assets: o.assets,
      updated_at: o.updated_at,
      fresh: at !== null && now - at < STALE_MS,
    });
  }
  return null;
}

/**
 * Minimal stateless MCP server over Streamable HTTP: initialize, ping, tools/list, tools/call, and
 * the notifications a client sends. Every tool is a read of data the pages already show.
 */
export async function handleMcp(
  request: Request,
  data: DataSource,
  now: number,
): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return fail(null, -32600, "Request too large");
  let call: { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: Record<string, unknown> };
  try {
    call = JSON.parse(raw);
  } catch {
    return fail(null, -32700, "Parse error");
  }
  if (
    !call ||
    typeof call !== "object" ||
    Array.isArray(call) ||
    call.jsonrpc !== "2.0" ||
    typeof call.method !== "string"
  ) {
    return fail(null, -32600, "Invalid request");
  }
  // A notification has no id and gets no body.
  if (call.id === undefined) return new Response(null, { status: 202 });

  const params = call.params ?? {};
  switch (call.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return reply(call.id, {
        result: {
          protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions: `Read-only funding-rate data. Not financial advice. ${ATTRIBUTION}`,
        },
      });
    }
    case "ping":
      return reply(call.id, { result: {} });
    case "tools/list":
      return reply(call.id, { result: { tools: TOOLS } });
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const result = await callTool(name, args, data, now);
      return result ? reply(call.id, { result }) : fail(call.id, -32602, `Unknown tool: ${name}`);
    }
    default:
      return fail(call.id, -32601, "Method not found");
  }
}
