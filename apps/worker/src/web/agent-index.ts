/**
 * What an AI assistant or agent can read on this site, page by page: what each page answers, the
 * Markdown copy of it (`<page>.md`, or `Accept: text/markdown`), and the JSON API endpoint or MCP tool
 * that returns the same figures. One list, read by two things: /llms.txt, the index an assistant
 * looks for first (llmstxt.org), and the header on every Markdown page (web/markdown.ts), so a model
 * that lands on one page can cite it and knows where the structured copy is.
 *
 * WHY (owner, 2026-11-18: "allow AI to use the app's data points"). Answers in ChatGPT, Claude,
 * Perplexity and Gemini come from pages their fetchers read at question time. A page that reads as
 * unlabelled numbers, with no time and no source line, is one they skip or misquote.
 */

import { SITE_ORIGIN } from "./layout";

export interface AgentPage {
  /** The page's address, or its prefix with `<asset>` / `<exchange>` standing for the variable part. */
  path: string;
  title: string;
  /** The questions the page answers, in a reader's words. */
  answers: string;
  /** JSON API endpoint with the same figures, relative to the site. */
  api?: string;
  /** MCP tool (at /mcp) that returns them. */
  mcp?: string;
}

/** In the order a reader would want them: the data pages first, then the reference pages. */
export const AGENT_PAGES: readonly AgentPage[] = [
  {
    path: "/",
    title: "Funding spreads",
    answers:
      "The best funding-rate carry that actually settled over the last 7 days (long one exchange, short another, per $10,000 a leg), and the widest funding spreads across perpetual futures exchanges right now.",
    api: "/v1/screener",
    mcp: "get_top_spreads",
  },
  {
    path: "/screener",
    title: "Funding spread screener",
    answers:
      "Every cross-exchange funding spread for the same asset, filtered by exchange, open interest, period (now, 7d, 30d, 60d) and steadiness.",
    api: "/v1/screener",
    mcp: "get_top_spreads",
  },
  {
    path: "/rates",
    title: "Rates",
    answers:
      "Annualised funding rate of each asset on each exchange; option books (gamma exposure, gamma flip, call and put walls, delta, vega, theta, IV walls, expected move); US macro (CPI, Fed path, jobs, growth, signals, fund flows); prediction markets; world stock indexes.",
    api: "/v1/rates",
    mcp: "get_asset_funding",
  },
  {
    path: "/arbitrage",
    title: "Price arbitrage",
    answers: "Where one exchange's bid sits above another exchange's ask for the same asset.",
    api: "/v1/arbitrage",
  },
  {
    path: "/liquidations",
    title: "Liquidations",
    answers:
      "How much was liquidated in the last 24 hours, 48 hours or 7 days, by asset and by exchange, longs against shorts; the largest single liquidations; liquidation cascades; where tracked whale positions would be liquidated.",
    api: "/v1/liquidations",
  },
  {
    path: "/liquidations/<asset>",
    title: "One asset's liquidations",
    answers:
      "One asset's liquidations over time and by exchange, its whale positions and their liquidation prices, and the odds of reaching a price.",
    api: "/v1/liquidations?assets=<asset>",
  },
  {
    path: "/chart",
    title: "Price and CVD",
    answers:
      "Cumulative volume delta (taker buying minus selling) of every polled asset's perpetuals, which assets are net bought or sold, price-flow divergences, and BTC's price with its futures and spot CVD.",
    api: "/v1/cvd",
    mcp: "get_cvd",
  },
  {
    path: "/chart/<asset>",
    title: "One asset's price and CVD",
    answers:
      "An asset's price with cumulative volume delta summed over its futures and spot markets on many exchanges, its divergences between price and flow, and its spot and futures fund flows.",
    api: "/v1/cvd?asset=<asset>",
    mcp: "get_cvd",
  },
  {
    path: "/whales/<asset>",
    title: "Whale orders",
    answers:
      "Large resting orders (walls) and large market orders in the order books of Binance and Hyperliquid, drawn over price.",
  },
  {
    path: "/holdings",
    title: "Holdings",
    answers:
      "What well-known investors and funds hold, from their latest SEC 13F filings, and the largest crypto holders.",
  },
  {
    path: "/markets",
    title: "Exchanges",
    answers:
      "Every perpetual futures exchange tracked, graded on reserves, trading cost, activity and liquidity; taker fees and slippage at $10k and $100k.",
    api: "/v1/exchanges",
  },
  {
    path: "/markets/exchange/<exchange>",
    title: "One exchange's markets",
    answers: "Every live market on one exchange with its funding rate, open interest and volume.",
    api: "/v1/exchanges/<exchange>",
  },
  {
    path: "/markets/asset/<asset>",
    title: "One asset's markets",
    answers:
      "Every live market for one asset across exchanges, with funding, open interest and price.",
    api: "/v1/assets/<asset>",
    mcp: "get_asset_funding",
  },
  {
    path: "/pair/<asset>",
    title: "Funding carry backtest",
    answers:
      "What holding long on one exchange and short on another would have paid in funding over past days, after fees.",
    api: "/v1/pairs/<asset>/backtest",
  },
  {
    path: "/price-pair/<asset>",
    title: "Price convergence",
    answers: "The price gap for one asset between two exchanges over time.",
    api: "/v1/price-pair/<asset>",
  },
  {
    path: "/sentiment",
    title: "Fear and greed",
    answers: "The crypto fear and greed index and its history.",
  },
  {
    path: "/glossary",
    title: "Terminology",
    answers:
      "Plain definitions of funding, open interest, liquidations, CVD, gamma and the other terms used on the site.",
  },
  {
    path: "/agents",
    title: "MCP and agents",
    answers: "How to use the airrates API and MCP server from an AI agent.",
  },
];

/** The entry for a path: the exact page, else the pattern it fills in (`/chart/SOL` → `/chart/<asset>`). */
export function agentPageFor(path: string): AgentPage | undefined {
  const exact = AGENT_PAGES.find((page) => page.path === path);
  if (exact) return exact;
  const segments = path.split("/").filter(Boolean);
  return AGENT_PAGES.find((page) => {
    const pattern = page.path.split("/").filter(Boolean);
    // Only a pattern ends in a variable part, and that part may be one segment (BTC) or two
    // (equity/NVDA); a plain page matches only itself, above.
    if (!pattern.at(-1)?.startsWith("<")) return false;
    if (segments.length !== pattern.length && segments.length !== pattern.length + 1) return false;
    return pattern.every((part, i) => part.startsWith("<") || part === segments[i]);
  });
}

/** The API or MCP reference with the page's own asset or exchange put in. */
export function filled(template: string, path: string): string {
  const segments = path.split("/").filter(Boolean);
  const variable = segments.slice(template.includes("<exchange>") ? 2 : 1).join("/");
  // `/liquidations/BTC` → BTC; `/markets/asset/equity/NVDA` → NVDA (the API takes the base alone).
  const last = segments.at(-1) ?? "";
  return template.replace("<asset>", last).replace("<exchange>", variable || last);
}

/** The Markdown copy's address: `/liquidations` → `/liquidations.md`, and the home page `/index.md`. */
export const markdownPath = (path: string): string =>
  path === "/" ? "/index.md" : `${path.replace(/\/$/, "")}.md`;

/** /llms.txt: the site, its pages with their Markdown copies, and the API and MCP behind them. */
export function llmsTxt(): string {
  const page = (p: AgentPage) => {
    const concrete = !p.path.includes("<");
    const link = concrete
      ? `[${p.title}](${SITE_ORIGIN}${markdownPath(p.path)})`
      : `${p.title} (${SITE_ORIGIN}${p.path}, Markdown at ${p.path}.md)`;
    const extra = [
      p.api ? `JSON: ${SITE_ORIGIN}${p.api}` : null,
      p.mcp ? `MCP tool: ${p.mcp}` : null,
    ].filter(Boolean);
    return `- ${link}: ${p.answers}${extra.length ? ` ${extra.join("; ")}.` : ""}`;
  };
  const data = AGENT_PAGES.filter((p) => !["/glossary", "/agents"].includes(p.path));
  return `# airrates

> Live data on perpetual futures across about 60 exchanges (centralised and on-chain): funding rates and cross-exchange funding spreads that actually settled, liquidations, cumulative volume delta, whale orders, option gamma levels, and US macro. Free to read; no account needed. Data from airrates.net: please cite and link the page you used.

Every page below has a Markdown copy: add \`.md\` to its address (\`/index.md\` for the home page), or send \`Accept: text/markdown\`. Each Markdown copy starts with the time its data was read and the API call that returns the same figures. Figures are what exchanges reported; not financial advice.

## Data pages

${data.map(page).join("\n")}

## API and MCP

- [OpenAPI description](${SITE_ORIGIN}/v1/openapi.json): the JSON API. No key and no sign-up; only the backtest endpoint is rate limited per address. [How access works](${SITE_ORIGIN}/auth.md).
- MCP server (streamable HTTP, no auth): ${SITE_ORIGIN}/mcp. [Server card](${SITE_ORIGIN}/.well-known/mcp/server-card.json).
- [API skill for agents](${SITE_ORIGIN}/.well-known/agent-skills/airrates-api/SKILL.md)
- [MCP and agents guide](${SITE_ORIGIN}/agents.md)

## Reference

- [Terminology](${SITE_ORIGIN}/glossary.md): ${AGENT_PAGES.find((p) => p.path === "/glossary")?.answers}
- [Data status](${SITE_ORIGIN}/v1/status): whether each exchange's data is fresh.
- [Sitemap](${SITE_ORIGIN}/sitemap.xml)
`;
}
