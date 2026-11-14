import { describe, expect, test } from "bun:test";
import { wwwRedirect } from "./canonical-host";

describe("wwwRedirect", () => {
  test("www goes to the same address on the bare host, for good", () => {
    const res = wwwRedirect(new Request("https://www.airrates.net/liquidations/BTC?window=7d"));
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe("https://airrates.net/liquidations/BTC?window=7d");
  });

  test("a POST keeps its method on the way over", () => {
    const res = wwwRedirect(
      new Request("https://www.airrates.net/mcp", { method: "POST", body: "{}" }),
    );
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe("https://airrates.net/mcp");
  });

  test("the bare host and the other subdomains are left alone", () => {
    expect(wwwRedirect(new Request("https://airrates.net/"))).toBeNull();
    expect(wwwRedirect(new Request("https://mcp.airrates.net/mcp"))).toBeNull();
    expect(wwwRedirect(new Request("https://perf.airrates.net/probe"))).toBeNull();
  });
});
