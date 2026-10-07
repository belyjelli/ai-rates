/**
 * WebMCP: tells an agent-capable browser what this page can do, through navigator.modelContext.
 * Each tool reads the same-origin JSON API or navigates to a page; none writes anything. Where the
 * browser has no modelContext (nearly all of them today) the script does nothing. One AbortController
 * unregisters every tool when the page is hidden for good (pagehide).
 */
export const WEBMCP_SCRIPT = `(() => {
  const mc = navigator.modelContext;
  if (!mc || typeof mc.registerTool !== "function") return;
  const ctrl = new AbortController();
  const out = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });
  const read = async (path) => {
    const res = await fetch(path, { headers: { accept: "application/json" } });
    if (!res.ok) return out("airrates answered " + res.status + " for " + path);
    return out(await res.json());
  };
  const tools = [
    {
      name: "get_top_spreads",
      description: "Widest annualised funding-rate spreads between exchanges for the same perpetual asset, before fees and slippage.",
      inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50, description: "Pairs to return." } } },
      execute: async ({ limit } = {}) => read("/v1/screener?limit=" + encodeURIComponent(limit || 10)),
    },
    {
      name: "get_asset_funding",
      description: "Funding rate of one asset on every exchange that lists it.",
      inputSchema: { type: "object", properties: { asset: { type: "string", description: "Ticker, for example BTC." } }, required: ["asset"] },
      execute: async ({ asset }) => read("/v1/assets/" + encodeURIComponent(String(asset || "").toUpperCase())),
    },
    {
      name: "get_data_status",
      description: "Whether airrates data is fresh, and how many markets it tracks.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => read("/v1/health"),
    },
    {
      name: "open_page",
      description: "Open one of the site's pages in this tab.",
      inputSchema: {
        type: "object",
        properties: { page: { type: "string", enum: ["screener", "rates", "arbitrage", "liquidations", "cvd", "sentiment", "markets", "status", "docs"] } },
        required: ["page"],
      },
      execute: async ({ page }) => {
        const pages = ["screener", "rates", "arbitrage", "liquidations", "cvd", "sentiment", "markets", "status", "docs"];
        if (!pages.includes(page)) return out("Unknown page: " + page);
        location.assign("/" + page);
        return out("Opening /" + page);
      },
    },
  ];
  try {
    for (const tool of tools) mc.registerTool(tool, { signal: ctrl.signal });
  } catch (e) {
    return;
  }
  addEventListener("pagehide", () => ctrl.abort(), { once: true });
})();`;
