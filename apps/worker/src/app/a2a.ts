import { SITE_ORIGIN } from "../web/layout";
import { VENUE_BY_ID } from "../web/venues";
import { type DataSource, type MarketRow, STALE_MS } from "./data";
import { DEFAULT_FILTERS } from "./params";

/** Where A2A messages are posted. */
export const A2A_PATH = "/a2a";

/** What the agent can do, as skills on the card. Each is answered by `reply` below. */
const SKILLS = [
  {
    id: "top-spreads",
    name: "Widest funding spreads",
    description:
      'The widest funding-rate spreads between exchanges for the same perpetual asset, with the long and short venue. Ask: "what are the best spreads?"',
    tags: ["funding", "arbitrage", "perpetuals"],
    examples: ["What are the widest funding spreads right now?"],
  },
  {
    id: "asset-funding",
    name: "Funding for one asset",
    description:
      'Annualised funding rate of one asset on each exchange that lists it. Ask: "funding for BTC".',
    tags: ["funding", "perpetuals"],
    examples: ["Funding for ETH", "BTC funding rates"],
  },
  {
    id: "data-status",
    name: "Data freshness",
    description: "How many markets and venues are tracked and whether the data is fresh.",
    tags: ["status"],
    examples: ["Is the data fresh?"],
  },
];

/** The A2A Agent Card served at /.well-known/agent-card.json. */
export function agentCard(): Record<string, unknown> {
  return {
    name: "airrates",
    description:
      "Answers questions about perpetual-futures funding rates and cross-exchange spreads from airrates.net data. Read-only; not financial advice.",
    version: "1.0.0",
    provider: { organization: "airrates", url: SITE_ORIGIN },
    documentationUrl: `${SITE_ORIGIN}/docs`,
    // v1.0 shape; the v0.3 fields below it let an older client find the same endpoint.
    supportedInterfaces: [
      { url: `${SITE_ORIGIN}${A2A_PATH}`, protocolBinding: "JSONRPC", protocolVersion: "1.0" },
    ],
    url: `${SITE_ORIGIN}${A2A_PATH}`,
    preferredTransport: "JSONRPC",
    protocolVersion: "0.3.0",
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: SKILLS,
  };
}

const apr = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const venueName = (id: string) => VENUE_BY_ID.get(id)?.name ?? id;

const FILLER = new Set(
  "FUNDING RATE RATES WHAT SHOW GIVE TELL ME MY ABOUT FOR THE ARE IS ON OF IN TO AND ALL CURRENT NOW RIGHT PLEASE CAN YOU DATA PERP PERPS PERPETUAL APR".split(
    " ",
  ),
);

/** The asset the text names: an upper-case word as typed (BTC), else the last word that is not filler. */
function askedTicker(text: string): string | null {
  const words = text.match(/[A-Za-z0-9]{2,12}/g) ?? [];
  const candidates = words.filter((w) => /[A-Za-z]/.test(w) && !FILLER.has(w.toUpperCase()));
  const typed = candidates.find((w) => w === w.toUpperCase());
  const pick = typed ?? candidates.at(-1);
  return pick ? pick.toUpperCase() : null;
}

/** A plain-text answer for a plain-text question: keyword routing over the existing data reads. */
export async function reply(text: string, data: DataSource, now: number): Promise<string> {
  const lower = text.toLowerCase();
  if (/fresh|status|health|stale|how many/.test(lower)) {
    const overview = await data.overview();
    const at = overview.updated_at?.getTime() ?? null;
    const fresh = at !== null && now - at < STALE_MS;
    return `${overview.markets} markets across ${overview.venues} venues and ${overview.assets} assets. Data is ${fresh ? "fresh" : "stale or unavailable"}${at ? `, last updated ${new Date(at).toISOString()}` : ""}.`;
  }
  const ticker = /spread|best|widest|top|arbitrage/.test(lower) ? null : askedTicker(text);
  if (ticker) {
    const markets: MarketRow[] = await data.asset(ticker, null);
    if (markets.length === 0) return `No exchange has a live ${ticker} perpetual right now.`;
    const rows = [...markets]
      .sort((a, b) => b.apr - a.apr)
      .slice(0, 8)
      .map((m) => `${venueName(m.venue_id)} ${apr(m.apr)} APR`);
    return `${ticker} funding, annualised, highest first: ${rows.join("; ")}. Source: ${SITE_ORIGIN}/markets/asset/${ticker}`;
  }
  const pairs = await data.screener({ ...DEFAULT_FILTERS, limit: 5 });
  if (pairs.length === 0) return "No pair clears the default filters right now.";
  const rows = pairs.map(
    (p) =>
      `${p.asset}: long ${venueName(p.long_venue_id)} ${apr(p.long_apr)}, short ${venueName(p.short_venue_id)} ${apr(p.short_apr)}, spread ${apr(p.spread_apr)} APR`,
  );
  return `Widest funding spreads (before fees and slippage; not advice): ${rows.join(" | ")}. Source: ${SITE_ORIGIN}/screener`;
}

interface RpcRequest {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

const MAX_BODY_CHARS = 16_384;
const rpc = (id: unknown, body: Record<string, unknown>) =>
  Response.json(
    { jsonrpc: "2.0", id: id ?? null, ...body },
    { headers: { "cache-control": "no-store" } },
  );

/** The text of the first text part of a message, v1.0 ({text}) or v0.3 ({kind:"text", text}). */
function messageText(params: unknown): string | null {
  const message = (params as { message?: { parts?: unknown } } | null)?.message;
  const parts = Array.isArray(message?.parts) ? (message.parts as { text?: unknown }[]) : [];
  const text = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join(" ")
    .trim();
  return text || null;
}

/**
 * A2A JSON-RPC endpoint. Answers `SendMessage` (v1.0) and `message/send` (v0.3) with one Message and
 * no task: every answer is a read, so there is nothing to wait for. Streaming, tasks and push
 * notifications are not offered, and the card says so.
 */
export async function handleA2a(
  request: Request,
  data: DataSource,
  now: number,
): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS)
    return rpc(null, { error: { code: -32600, message: "Request too large" } });
  let call: RpcRequest;
  try {
    call = JSON.parse(raw) as RpcRequest;
  } catch {
    return rpc(null, { error: { code: -32700, message: "Parse error" } });
  }
  if (
    call === null ||
    typeof call !== "object" ||
    call.jsonrpc !== "2.0" ||
    typeof call.method !== "string"
  ) {
    return rpc(null, { error: { code: -32600, message: "Invalid request" } });
  }
  const legacy = call.method === "message/send";
  if (call.method !== "SendMessage" && !legacy) {
    return rpc(call.id, { error: { code: -32601, message: "Method not found" } });
  }
  const text = messageText(call.params);
  if (!text) {
    return rpc(call.id, {
      error: { code: -32602, message: "params.message needs a text part" },
    });
  }
  const answer = await reply(text, data, now);
  const messageId = crypto.randomUUID();
  return rpc(
    call.id,
    legacy
      ? {
          result: {
            kind: "message",
            messageId,
            role: "agent",
            parts: [{ kind: "text", text: answer }],
          },
        }
      : { result: { message: { messageId, role: "ROLE_AGENT", parts: [{ text: answer }] } } },
  );
}
