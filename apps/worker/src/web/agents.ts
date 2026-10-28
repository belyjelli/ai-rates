import { A2A_PATH, SKILLS } from "../app/a2a";
import type { Overview } from "../app/data";
import { MCP_PATH, PROTOCOLS, TOOLS } from "../app/mcp";
import { SKILL_PATH } from "../app/openapi";
import { esc } from "./format";
import { layout, SITE_ORIGIN } from "./layout";
import { englishOnly } from "./legal";

/** The page's address. Not /mcp: that is the server itself, and a GET there must stay a 405. */
export const AGENTS_PATH = "/agents";

const MCP_URL = `${SITE_ORIGIN}${MCP_PATH}`;
const A2A_URL = `${SITE_ORIGIN}${A2A_PATH}`;

/** A block to copy from: the text as served, and a button that copies it. */
const block = (text: string) =>
  `<div class="ag-code"><pre><code>${esc(text)}</code></pre><button type="button" class="ag-copy">copy</button></div>`;

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** One client's setup: where it goes and what to paste. */
interface Client {
  id: string;
  name: string;
  steps: string;
  code: string;
}

const CLIENTS: Client[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    steps:
      "Run this once in a terminal. <code>--scope user</code> makes it available in every project; leave it out to add it to the current project only. Then type <code>/mcp</code> in Claude Code: airrates should be listed as connected, with three tools.",
    code: `claude mcp add --transport http --scope user airrates ${MCP_URL}`,
  },
  {
    id: "claude",
    name: "Claude (web, desktop and mobile)",
    steps: `Open <b>Settings → Connectors → Add custom connector</b>. Name it <code>airrates</code> and paste the URL below. Leave the OAuth client ID and secret empty: there is nothing to sign in to. Then turn the connector on for a chat from the tools menu under the message box.`,
    code: MCP_URL,
  },
  {
    id: "claude-desktop-config",
    name: "Claude Desktop, by config file",
    steps:
      "For a version without custom connectors, or if you keep servers in the config file. The file is <code>claude_desktop_config.json</code> (Settings → Developer → Edit Config). This runs <code>mcp-remote</code>, a small bridge for clients that only start local servers, so it needs Node.js. Restart Claude Desktop afterwards.",
    code: json({
      mcpServers: { airrates: { command: "npx", args: ["-y", "mcp-remote", MCP_URL] } },
    }),
  },
  {
    id: "cursor",
    name: "Cursor",
    steps:
      "Add this to <code>~/.cursor/mcp.json</code> for every project, or <code>.cursor/mcp.json</code> in one project. Cursor lists airrates under Settings → MCP; switch it on there.",
    code: json({ mcpServers: { airrates: { url: MCP_URL } } }),
  },
  {
    id: "vscode",
    name: "VS Code (Copilot agent mode)",
    steps:
      "Add this to <code>.vscode/mcp.json</code> in your workspace, or run <b>MCP: Add Server</b> from the command palette and choose HTTP. Start the server from the file's code lens, then pick its tools in agent mode.",
    code: json({ servers: { airrates: { type: "http", url: MCP_URL } } }),
  },
  {
    id: "windsurf",
    name: "Windsurf",
    steps:
      "Add this to <code>~/.codeium/windsurf/mcp_config.json</code>, then refresh the MCP list in Cascade.",
    code: json({ mcpServers: { airrates: { serverUrl: MCP_URL } } }),
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    steps:
      "Add this to <code>~/.gemini/settings.json</code>. <code>/mcp</code> in the CLI lists the tools.",
    code: json({ mcpServers: { airrates: { httpUrl: MCP_URL } } }),
  },
  {
    id: "codex",
    name: "OpenAI Codex CLI",
    steps: "Add this to <code>~/.codex/config.toml</code>.",
    code: `[mcp_servers.airrates]\nurl = "${MCP_URL}"`,
  },
  {
    id: "other",
    name: "Any other client",
    steps:
      "If it speaks Streamable HTTP, give it the URL and choose no authentication. If it can only start a local (stdio) server, have it run the bridge below.",
    code: `npx -y mcp-remote ${MCP_URL}`,
  },
];

const curl = (body: unknown, url = MCP_URL) =>
  `curl -s ${url} \\\n  -H 'content-type: application/json' \\\n  -d '${JSON.stringify(body)}'`;

/** The documents an agent can find the site by, in the order one would read them. */
const INDEX: { path: string; what: string; spec: string }[] = [
  {
    path: "/.well-known/ai-catalog.json",
    what: "The agent index: one entry for each way an agent can use the site (the MCP server, the A2A agent, the API catalog, the OpenAPI description and the skill), with example questions each one answers. Start here to find everything else.",
    spec: "ARD AI catalog 1.0",
  },
  {
    path: "/.well-known/mcp/server-card.json",
    what: "The MCP server card: the server's name, version, endpoint, transport, that it needs no authentication, and its tools. A client or registry reads this to learn about the server without connecting to it.",
    spec: "MCP server card",
  },
  {
    path: "/.well-known/agent-card.json",
    what: "The A2A agent card: who runs the agent, where to send messages, what it accepts and returns, and its skills with example questions.",
    spec: "A2A 1.0, with 0.3 fields",
  },
  {
    path: "/.well-known/agent-skills/index.json",
    what: "The skills index: one skill, airrates-api, with a SHA-256 digest of the exact file served, so an agent can check it has not changed.",
    spec: "Agent Skills Discovery 0.2",
  },
  {
    path: SKILL_PATH,
    what: "The skill itself: a Markdown file an agent loads to learn every API endpoint and how to use the data fairly.",
    spec: "SKILL.md",
  },
  {
    path: "/.well-known/api-catalog",
    what: "The API catalog: where the JSON API's description, docs and health check are. Every page also points here in its HTTP Link header.",
    spec: "RFC 9727",
  },
  {
    path: "/v1/openapi.json",
    what: "The JSON API, described endpoint by endpoint with every parameter.",
    spec: "OpenAPI 3.1",
  },
  {
    path: "/auth.md",
    what: "How an agent gets access: it needs no key and no registration. Also says which member-area service needs credentials, and where its own file is.",
    spec: "auth.md",
  },
  {
    path: "/.well-known/oauth-protected-resource",
    what: "Says the public site accepts no bearer token and names no authorization server, so a client that checks before connecting knows not to start a sign-in.",
    spec: "RFC 9728",
  },
  {
    path: "/robots.txt",
    what: "Content signals: search and answering questions with the data are welcome; training models on it is not.",
    spec: "Content Signals",
  },
];

/** A tool's input schema, as far as the table reads it. */
interface Schema {
  properties?: Record<string, { type?: string; description?: string } | undefined>;
  required?: string[];
}

const toolRows = TOOLS.map((tool) => {
  const schema: Schema = tool.inputSchema;
  const props = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  const inputs = props.length
    ? props
        .map(
          ([name, p]) =>
            `<code>${esc(name)}</code> (${esc(p?.type ?? "any")}${required.has(name) ? ", required" : ""}) ${esc(p?.description ?? "")}`,
        )
        .join("<br>")
    : "none";
  return `<tr><td><code>${esc(tool.name)}</code></td><td>${esc(tool.description)}</td><td>${inputs}</td></tr>`;
}).join("");

const skillRows = SKILLS.map(
  (s) =>
    `<tr><td><code>${esc(s.id)}</code></td><td>${esc(s.description)}</td><td>${s.examples.map((e) => `“${esc(e)}”`).join("<br>")}</td></tr>`,
).join("");

const CSS = `.ag{max-width:96ch}
.ag nav.ag-toc{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0 0 18px;font-size:12px}
.ag h2{margin:28px 0 8px;scroll-margin-top:calc(var(--mast) + 12px)}
.ag h3{margin:18px 0 6px;font-size:13px;scroll-margin-top:calc(var(--mast) + 12px)}
.ag p,.ag li{line-height:1.55}
.ag ol,.ag ul{padding-left:18px}
.ag dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:8px 0}
.ag dt{color:var(--muted)}
.ag dd{margin:0}
.ag-code{position:relative;margin:8px 0 12px}
.ag-code pre{margin:0;padding:10px 12px;padding-right:64px;background:var(--panel);border:1px solid var(--rule);overflow-x:auto;font:12px/1.5 var(--mono);color:var(--ink);white-space:pre}
.ag-copy{position:absolute;top:6px;right:6px;font-size:11px;padding:2px 8px}
.ag table{border-collapse:collapse;width:100%;margin:8px 0 12px;font-size:12px}
.ag th,.ag td{border-top:1px solid var(--rule);padding:6px 8px 6px 0;text-align:left;vertical-align:top}
.ag th{color:var(--muted);font-weight:normal}
.ag .ag-wrap{overflow-x:auto}
@media (max-width:560px){.ag dl{grid-template-columns:1fr}.ag dd{margin-bottom:6px}}`;

/** Copies a block's text; says so on the button for a moment. */
const SCRIPT = `document.addEventListener("click",(e)=>{const b=e.target.closest(".ag-copy");if(!b)return;const t=b.parentElement.querySelector("code").textContent;navigator.clipboard&&navigator.clipboard.writeText(t).then(()=>{b.textContent="copied";setTimeout(()=>{b.textContent="copy"},1500)},()=>{})});`;

/**
 * How to connect an AI agent to airrates: the MCP server, client by client, then the A2A agent and
 * the discovery files. The tools, skills and protocol versions are read from app/mcp.ts and
 * app/a2a.ts, so the page lists what the server answers.
 */
export function agents(data: { overview: Overview; now: number }): string {
  const clients = CLIENTS.map(
    (c) => `<h3 id="${c.id}">${esc(c.name)}</h3>
<p>${c.steps}</p>
${block(c.code)}`,
  ).join("\n");
  const toc = [
    ["start", "Quick start"],
    ["clients", "Set up your client"],
    ["tools", "Tools"],
    ["test", "Test it by hand"],
    ["a2a", "Agent card (A2A)"],
    ["index", "Agent index"],
    ["webmcp", "In the browser"],
    ["limits", "Limits and terms"],
    ["trouble", "Troubleshooting"],
  ]
    .map(([id, label]) => `<a href="#${id}">${label}</a>`)
    .join("");

  return layout({
    title: "MCP and agents",
    description:
      "Connect Claude, Cursor, VS Code or any MCP client to airrates: live funding rates and cross-exchange spreads as tools. No key needed.",
    path: AGENTS_PATH,
    overview: data.overview,
    now: data.now,
    body: `<style>${CSS}</style>
${englishOnly(`<div class="ag">
<h1>MCP and agents</h1>
<p class="lede">airrates runs a public <a href="https://modelcontextprotocol.io" rel="noopener">Model Context Protocol</a> server, so an AI assistant can read live funding rates and cross-exchange spreads while it answers you. It needs no account, no key and no sign-in, and it only reads. This page shows how to add it to your client, what it can do, and the agent card and index other agents find it by.</p>
<nav class="ag-toc" aria-label="On this page">${toc}</nav>

<h2 id="start">Quick start</h2>
<dl>
<dt>Server URL</dt><dd><code>${MCP_URL}</code></dd>
<dt>Transport</dt><dd>Streamable HTTP (JSON responses; no SSE stream, no session)</dd>
<dt>Authentication</dt><dd>None. Choose “no auth”, and leave any OAuth fields empty.</dd>
<dt>Protocol versions</dt><dd>${PROTOCOLS.map((p) => `<code>${p}</code>`).join(", ")}</dd>
<dt>Tools</dt><dd>${TOOLS.length}, all read-only</dd>
</dl>
${block(MCP_URL)}
<p>Once it is added, ask in plain words, for example: “Which perpetuals have the widest funding spread right now?”, “What is BTC funding on each exchange?” or “Is the airrates data fresh?” The assistant picks the tool itself.</p>

<h2 id="clients">Set up your client</h2>
${clients}

<h2 id="tools">Tools</h2>
<p>Every tool reads data the site's pages already show, marked <code>readOnlyHint</code>. Answers are JSON text with an <code>attribution</code> field. Rates are annualised (APR, in percent); venues are given by id, as in <a href="/v1/venues">/v1/venues</a>.</p>
<div class="ag-wrap"><table><thead><tr><th>Tool</th><th>What it returns</th><th>Inputs</th></tr></thead><tbody>${toolRows}</tbody></table></div>
<p>For more than these three (liquidations, the rates grid, arbitrage, backtests, exchange grades), use the <a href="/docs">JSON API</a>: an agent that can fetch URLs can read it directly, and the <a href="${SKILL_PATH}">skill</a> teaches it how.</p>

<h2 id="test">Test it by hand</h2>
<p>The server answers single JSON-RPC requests over POST, so <code>curl</code> is enough to see what a client sees. Start the conversation:</p>
${block(curl({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOLS[0], capabilities: {}, clientInfo: { name: "curl", version: "1" } } }))}
<p>It answers with the server's name, the protocol version it agreed and its capabilities:</p>
${block(json({ jsonrpc: "2.0", id: 1, result: { protocolVersion: PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: "airrates", title: "airrates", version: "1.0.0" }, instructions: "Read-only funding-rate data. Not financial advice. …" } }))}
<p>List the tools, then call one:</p>
${block(curl({ jsonrpc: "2.0", id: 2, method: "tools/list" }))}
${block(curl({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_asset_funding", arguments: { asset: "BTC" } } }))}
<p>A tool's answer is one text item holding JSON:</p>
${block(json({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: '{"attribution":"…","asset":"BTC","markets":[{"venue":"…","apr":…,"apr_7d":…,"open_interest_usd":…}, …]}' }] } }))}
<p>The server keeps no session, so each request stands alone, and a <code>GET</code> on the URL answers 405: there is no stream to open.</p>

<h2 id="a2a">Agent card (A2A)</h2>
<p>For agents that talk to other agents with the <a href="https://a2a-protocol.org" rel="noopener">Agent2Agent protocol</a>, airrates is also an agent you can message in plain text. Its card is at <a href="/.well-known/agent-card.json"><code>/.well-known/agent-card.json</code></a>.</p>
<dl>
<dt>Endpoint</dt><dd><code>${A2A_URL}</code></dd>
<dt>Binding</dt><dd>JSON-RPC over HTTP POST</dd>
<dt>Methods</dt><dd><code>SendMessage</code> (A2A 1.0) and <code>message/send</code> (0.3)</dd>
<dt>Modes</dt><dd>text in, text out; one message back, no tasks, no streaming, no push notifications</dd>
<dt>Authentication</dt><dd>None</dd>
</dl>
<div class="ag-wrap"><table><thead><tr><th>Skill</th><th>What it answers</th><th>Ask</th></tr></thead><tbody>${skillRows}</tbody></table></div>
<p>Send a question:</p>
${block(curl({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: "1", role: "ROLE_USER", parts: [{ text: "Funding for ETH" }] } } }, A2A_URL))}
<p>The answer is one agent message, with the page the figures come from:</p>
${block(json({ jsonrpc: "2.0", id: 1, result: { message: { messageId: "…", role: "ROLE_AGENT", parts: [{ text: "ETH funding, annualised, highest first: … Source: https://airrates.net/markets/asset/ETH" }] } } }))}
<p>An A2A 0.3 client sends <code>message/send</code> with <code>{"kind":"text","text":"…"}</code> parts and gets a <code>{"kind":"message"}</code> back. The card carries both versions' fields, so either kind of client finds the endpoint.</p>

<h2 id="index">Agent index</h2>
<p>An agent that knows only the domain can find everything above from these files. They are plain GETs and are cached for an hour.</p>
<div class="ag-wrap"><table><thead><tr><th>File</th><th>What it says</th><th>Standard</th></tr></thead><tbody>${INDEX.map((f) => `<tr><td><a href="${esc(f.path)}"><code>${esc(f.path)}</code></a></td><td>${esc(f.what)}</td><td>${esc(f.spec)}</td></tr>`).join("")}</tbody></table></div>
<p>Every page also sends an HTTP <code>Link</code> header pointing at the API catalog and the OpenAPI description, so a crawler that lands anywhere on the site can find them.</p>

<h2 id="webmcp">In the browser</h2>
<p>In a browser that lets an assistant use the page (WebMCP, <code>navigator.modelContext</code>), every airrates page offers the same three tools plus <code>open_page</code>, which moves the tab to a page of the site. The page's tools read the same JSON API and change nothing. In other browsers the script does nothing.</p>

<h2 id="limits">Limits and terms</h2>
<ul>
<li>About 20 requests a minute from one address to the MCP server, and separately 20 to the A2A agent. Past that the answer is a 429 with <code>Retry-After: 60</code>.</li>
<li>A 503 means the data could not be read just then; wait for <code>Retry-After</code> and try again. <code>get_data_status</code> says whether the figures are fresh.</li>
<li>Spreads and rates are before fees and slippage, and nothing here is financial advice. Please credit and link airrates.net when you reuse the data; see the <a href="/tos">terms</a>.</li>
</ul>

<h2 id="trouble">Troubleshooting</h2>
<ul>
<li><b>The client asks you to sign in, or to register an OAuth app.</b> Choose no authentication, or leave the fields empty: the server takes none.</li>
<li><b>The client only runs local servers</b> (a <code>command</code> rather than a <code>url</code>). Use <code>npx -y mcp-remote ${MCP_URL}</code> as the command, as in <a href="#claude-desktop-config">the Claude Desktop config</a>.</li>
<li><b>“Failed to connect” in a client that offers SSE or HTTP.</b> Pick HTTP (Streamable HTTP). The older SSE transport is not offered.</li>
<li><b>Tools show up but the assistant does not use them.</b> Make sure the connector is switched on for the chat, and name airrates in the question.</li>
<li><b>Opening the URL in a browser shows an error.</b> That is expected: the URL is for MCP clients, which POST to it.</li>
</ul>
</div>`)}
<script>${SCRIPT}</script>`,
  });
}
