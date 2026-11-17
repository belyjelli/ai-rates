import { describe, expect, test } from "bun:test";
import { AGENT_PAGES, agentPageFor, filled, llmsTxt, markdownPath } from "./agent-index";

describe("agentPageFor", () => {
  test("finds a page, and the pattern an asset or exchange page fills in", () => {
    expect(agentPageFor("/")?.title).toBe("Funding spreads");
    expect(agentPageFor("/liquidations")?.path).toBe("/liquidations");
    expect(agentPageFor("/liquidations/BTC")?.path).toBe("/liquidations/<asset>");
    expect(agentPageFor("/liquidations/equity/SNDK")?.path).toBe("/liquidations/<asset>");
    expect(agentPageFor("/markets/exchange/binance")?.path).toBe("/markets/exchange/<exchange>");
    expect(agentPageFor("/markets/asset/equity/NVDA")?.path).toBe("/markets/asset/<asset>");
    expect(agentPageFor("/legal")).toBeUndefined();
  });

  test("fills the endpoint with the page's own asset or exchange", () => {
    expect(filled("/v1/liquidations?assets=<asset>", "/liquidations/equity/SNDK")).toBe(
      "/v1/liquidations?assets=SNDK",
    );
    expect(filled("/v1/exchanges/<exchange>", "/markets/exchange/binance")).toBe(
      "/v1/exchanges/binance",
    );
    expect(filled("/v1/pairs/<asset>/backtest", "/pair/BTC")).toBe("/v1/pairs/BTC/backtest");
  });
});

describe("llms.txt", () => {
  const text = llmsTxt();

  test("lists every data page once, with a Markdown copy for each concrete page", () => {
    for (const page of AGENT_PAGES.filter((p) => !["/glossary", "/agents"].includes(p.path))) {
      expect(text.split(page.answers).length).toBe(2);
      if (!page.path.includes("<")) {
        expect(text).toContain(`(https://airrates.net${markdownPath(page.path)})`);
      }
    }
  });

  test("every endpoint it names is in the OpenAPI description", async () => {
    const { ENDPOINTS } = await import("../app/openapi");
    const paths = new Set(ENDPOINTS.map((e: { path: string }) => e.path));
    for (const page of AGENT_PAGES) {
      if (!page.api) continue;
      const path = page.api.split("?")[0]?.replace(/<(asset|exchange)>/g, "{$1}");
      expect(paths.has(path ?? "")).toBe(true);
    }
  });

  test("every MCP tool it names exists", async () => {
    const { TOOLS } = await import("../app/mcp");
    const names = new Set(TOOLS.map((tool) => tool.name));
    for (const page of AGENT_PAGES) if (page.mcp) expect(names.has(page.mcp)).toBe(true);
  });
});
