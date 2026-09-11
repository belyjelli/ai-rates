import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  test("applies defaults", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://x" })).toEqual({
      databaseUrl: "postgres://x",
      intervalMs: 60_000,
      healthPort: 8080,
      venues: null,
      alertWebhookUrl: null,
    });
  });

  test("takes an alert webhook, and insists it is a URL", () => {
    const url = (ALERT_WEBHOOK_URL: string) =>
      loadConfig({ DATABASE_URL: "postgres://x", ALERT_WEBHOOK_URL }).alertWebhookUrl;
    expect(url(" https://hooks.example/abc ")).toBe("https://hooks.example/abc");
    expect(url("")).toBeNull();
    expect(() => url("hooks.example/abc")).toThrow("http(s) URL");
  });

  test("parses overrides and the venue list", () => {
    expect(
      loadConfig({
        DATABASE_URL: "postgres://x",
        COLLECT_INTERVAL_MS: "30000",
        HEALTH_PORT: "9000",
        COLLECT_VENUES: " bybit, okx ,,hyperliquid ",
      }),
    ).toMatchObject({
      intervalMs: 30_000,
      healthPort: 9000,
      venues: ["bybit", "okx", "hyperliquid"],
    });
  });

  test("rejects missing or invalid values", () => {
    expect(() => loadConfig({})).toThrow("DATABASE_URL is required");
    expect(() => loadConfig({ DATABASE_URL: "x", COLLECT_INTERVAL_MS: "5000" })).toThrow(
      "at least 10000",
    );
    expect(() => loadConfig({ DATABASE_URL: "x", HEALTH_PORT: "abc" })).toThrow("positive integer");
  });
});
