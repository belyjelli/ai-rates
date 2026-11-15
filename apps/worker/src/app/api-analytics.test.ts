import { describe, expect, test } from "bun:test";
import {
  apiCallEvent,
  apiEndpoint,
  clientName,
  GA_MEASUREMENT_ID,
  reportApiCall,
  rpcOf,
} from "./api-analytics";

describe("API calls in Google Analytics", () => {
  test("only the API counts: /v1, MCP and A2A", () => {
    const at = (path: string) => apiEndpoint(new URL(`https://airrates.net${path}`));
    expect(at("/v1/rates?asset=BTC")).toBe("/v1/rates");
    expect(at("/mcp")).toBe("/mcp");
    expect(at("/a2a")).toBe("/a2a");
    expect(at("/liquidations")).toBeNull();
    expect(at("/data/narrator")).toBeNull();
  });

  test("the caller is a program's name, never its whole User-Agent", () => {
    expect(clientName("python-requests/2.31.0")).toBe("python-requests");
    expect(clientName("curl/8.4.0")).toBe("curl");
    expect(clientName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130")).toBe(
      "browser",
    );
    expect(clientName("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe("crawler");
    expect(clientName(null)).toBe("none");
  });

  test("an MCP call names its method and tool; a body that is not JSON-RPC names nothing", () => {
    expect(
      rpcOf('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_top_spreads"}}'),
    ).toEqual({ rpc: "tools/call", tool: "get_top_spreads" });
    expect(rpcOf('[{"method":"tools/list"}]')).toEqual({ rpc: "tools/list" });
    expect(rpcOf("not json")).toEqual({});
  });

  test("one event per call, one GA user per calling program, sent to the owner's property", async () => {
    const call = { endpoint: "/mcp", method: "POST", client: "node", rpc: "tools/call", tool: "x" };
    expect(apiCallEvent(call, 200)).toEqual({
      client_id: "api.node",
      non_personalized_ads: true,
      events: [
        {
          name: "api_call",
          params: {
            api_endpoint: "/mcp",
            api_method: "POST",
            api_status: 200,
            api_client: "node",
            api_rpc: "tools/call",
            api_tool: "x",
          },
        },
      ],
    });
    const asked: string[] = [];
    await reportApiCall({
      secret: "s e",
      call,
      status: 200,
      fetch: (async (url: string) => {
        asked.push(url);
        return new Response(null, { status: 204 });
      }) as unknown as typeof fetch,
    });
    expect(asked).toEqual([
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=s%20e`,
    ]);
  });

  test("Google down is not an error", async () => {
    const call = { endpoint: "/v1/rates", method: "GET", client: "curl" };
    const down = (async () => {
      throw new Error("unreachable");
    }) as unknown as typeof fetch;
    await expect(
      reportApiCall({ secret: "s", call, status: 200, fetch: down }),
    ).resolves.toBeUndefined();
  });
});
