import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import { bybitAdapter, parseBybitFundingHistory, parseBybitSnapshots } from "./bybit";

const fixture = (name: string) =>
  Bun.file(new URL(`../../__fixtures__/bybit/${name}.json`, import.meta.url)).json();

const NOW = 1_789_147_120_000;

describe("parseBybitSnapshots", () => {
  test("normalizes BTCUSDT", async () => {
    const instruments = await fixture("instruments");
    const { snapshots, settled } = parseBybitSnapshots(
      await fixture("tickers"),
      instruments.result.list,
      NOW,
    );
    expect(settled).toEqual([]);
    expect(snapshots.find((s) => s.venueSymbol === "BTCUSDT")).toEqual({
      venueId: "bybit",
      venueSymbol: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      dex: null,
      observedAt: NOW,
      rate: 0.00004936,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_171_200_000,
      kind: "predicted",
      markPrice: 77766.7,
      indexPrice: 77797.59,
      openInterestUsd: 4142076932.53,
      volume24hUsd: 6285417277.3039,
      maxLeverage: 150,
    });
  });

  test("uses the instrument interval, coins for USDC perps, and skips dated futures", async () => {
    const instruments = await fixture("instruments");
    const { snapshots } = parseBybitSnapshots(
      await fixture("tickers"),
      instruments.result.list,
      NOW,
    );
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "0GUSDT",
      "1000BONKPERP",
    ]);
    expect(snapshots.find((s) => s.venueSymbol === "0GUSDT")).toMatchObject({
      base: "0G",
      basisHours: 4,
      intervalHours: 4,
      nextFundingAt: 1_789_156_800_000,
    });
    expect(snapshots.find((s) => s.venueSymbol === "1000BONKPERP")).toMatchObject({
      base: "BONK",
      quote: "USDC",
      multiplier: 1000,
      rate: -0.00022725,
    });
  });

  test("throws on an error envelope", () => {
    expect(() =>
      parseBybitSnapshots({ retCode: 10001, retMsg: "bad", result: { list: [] } }, [], NOW),
    ).toThrow("10001");
  });
});

describe("parseBybitFundingHistory", () => {
  test("returns events oldest first with the inferred interval", async () => {
    const events = parseBybitFundingHistory(await fixture("funding-history"), 4);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_084_800_000, 0.00005091, 8],
      [1_789_113_600_000, 0.00002005, 8],
      [1_789_142_400_000, 0.00005602, 8],
    ]);
    expect(events[0]).toMatchObject({ venueId: "bybit", venueSymbol: "BTCUSDT", base: "BTC" });
  });

  test("falls back to the given interval for a single event", async () => {
    const json = await fixture("funding-history");
    json.result.list = json.result.list.slice(0, 1);
    expect(parseBybitFundingHistory(json, 4)[0]?.basisHours).toBe(4);
  });
});

describe("bybitAdapter", () => {
  test("fetchSnapshots requests tickers and instruments", async () => {
    const tickers = await fixture("tickers");
    const instruments = await fixture("instruments");
    const urls: string[] = [];
    const client = {
      venueId: "bybit",
      getJson: async (url: string) => {
        urls.push(url);
        return url.includes("/tickers") ? tickers : instruments;
      },
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    } as unknown as HttpClient;

    const batch = await bybitAdapter.fetchSnapshots(client, NOW);
    expect(batch.snapshots).toHaveLength(4);
    expect(urls.some((u) => u.includes("category=linear") && u.includes("/tickers"))).toBe(true);
    expect(urls.some((u) => u.includes("/instruments-info"))).toBe(true);
  });
});
