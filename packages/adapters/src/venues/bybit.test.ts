import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import {
  type BybitInstrument,
  type BybitTicker,
  bybitAdapter,
  bybitAssetClass,
  parseBybitFundingHistory,
  parseBybitRiskLimit,
  parseBybitSnapshots,
} from "./bybit";

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
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.00004936,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_171_200_000,
      kind: "predicted",
      markPrice: 77766.7,
      indexPrice: 77797.59,
      bestBid: 77766.7,
      // Bybit sizes are base coin, so depth is just size x price -- 0.181 BTC, about $14k. No
      // multiplier, unlike gate and okx, which is precisely why the stored column is USD.
      bestBidSizeUsd: 0.181 * 77766.7,
      bestAsk: 77766.8,
      bestAskSizeUsd: 2.763 * 77766.8,
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
      assetClass: "crypto",
      rate: -0.00022725,
    });
  });

  test("throws on an error envelope", () => {
    expect(() =>
      parseBybitSnapshots({ retCode: 10001, retMsg: "bad", result: { list: [] } }, [], NOW),
    ).toThrow("10001");
  });

  test("carries each instrument's declared class onto its snapshot", async () => {
    // Real instrument rows from 2026-09-14; the tickers are stand-ins, since only the join matters.
    const instruments: BybitInstrument[] = (await fixture("asset-class")).result.list;
    const list: BybitTicker[] = instruments.map((i) => ({
      symbol: i.symbol,
      fundingRate: "0.0001",
      nextFundingTime: "0",
      markPrice: "1",
      indexPrice: "1",
      openInterestValue: "0",
      turnover24h: "0",
    }));
    const { snapshots } = parseBybitSnapshots(
      { retCode: 0, retMsg: "OK", result: { list } },
      instruments,
      NOW,
    );
    expect(
      Object.fromEntries(snapshots.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}`])),
    ).toEqual({
      // Same tickers, different assets: BB is BounceBit, BBX is a stock; XAUT is a token, XAU gold.
      BBUSDT: "crypto:BB",
      SPXUSDT: "crypto:SPX",
      XAUTUSDT: "crypto:XAUT",
      AVNTUSDT: "crypto:AVNT",
      ONUSDT: "equity:ON",
      PURRUSDT: "equity:PURR",
      BBXUSDT: "equity:BBX",
      SPYUSDT: "equity:SPY",
      XAUUSDT: "commodity:XAU",
      EURUSDUSDT: "fx:EURUSD",
    });
  });
});

describe("bybitAssetClass", () => {
  test("reads symbolType, and nothing else, off real instrument rows", async () => {
    const rows: BybitInstrument[] = (await fixture("asset-class")).result.list;
    expect(
      Object.fromEntries(rows.map((r) => [r.symbol, bybitAssetClass(r.symbolType, r.baseCoin)])),
    ).toEqual({
      BBUSDT: "crypto",
      SPXUSDT: "crypto",
      XAUTUSDT: "crypto",
      // "innovation" is Bybit's new-listing zone, not a tradfi class.
      AVNTUSDT: "crypto",
      ONUSDT: "equity",
      PURRUSDT: "equity",
      BBXUSDT: "equity",
      SPYUSDT: "equity",
      XAUUSDT: "commodity",
      EURUSDUSDT: "fx",
    });
  });

  test("an unknown symbolType is still not crypto, so the base tables pick the class", () => {
    expect(bybitAssetClass("bond", "XAU")).toBe("commodity");
    expect(bybitAssetClass("bond", "US10Y")).toBe("index");
    expect(bybitAssetClass("bond", "BB")).toBe("equity");
    expect(bybitAssetClass(undefined, "BTC")).toBe("crypto");
  });
});

describe("parseBybitRiskLimit", () => {
  test("builds one ladder per symbol, each tier starting where the one below ends", async () => {
    const tiers = parseBybitRiskLimit((await fixture("risk-limit")).result.list);

    expect(tiers).toHaveLength(60);
    expect(new Set(tiers.map((t) => t.venueSymbol))).toEqual(
      new Set(["0GUSDT", "1000000BABYDOGEUSDT"]),
    );

    const ladder = tiers.filter((t) => t.venueSymbol === "0GUSDT");
    expect(ladder[0]).toEqual({
      venueId: "bybit",
      venueSymbol: "0GUSDT",
      tier: 1,
      lowerNotionalUsd: 0,
      upperNotionalUsd: 10_000,
      imr: 0.02,
      mmr: 0.015,
      maxLeverage: 50,
    });
    // Bybit publishes only an upper bound, so tier 2 has to inherit its floor from tier 1.
    expect(ladder[1]).toMatchObject({
      tier: 2,
      lowerNotionalUsd: 10_000,
      upperNotionalUsd: 25_000,
      imr: 0.04,
      maxLeverage: 25,
    });
    // The top bound is a real cap, not infinity: Bybit will not open 0GUSDT above $5M at all.
    expect(ladder.at(-1)).toMatchObject({
      tier: 30,
      upperNotionalUsd: 5_000_000,
      imr: 1,
      maxLeverage: 1,
    });
  });

  test("drops a ladder whole when one of its tiers is unreadable", () => {
    const tier = (id: number, symbol: string, riskLimitValue: string) => ({
      id,
      symbol,
      riskLimitValue,
      maintenanceMargin: "0.02",
      initialMargin: "0.04",
      isLowestRisk: id === 1 ? 1 : 0,
      maxLeverage: "25",
    });
    // Keeping AAA's tier 1 would silently stretch it across the band tier 2 should have covered,
    // quoting confident margin for a range nothing verified.
    expect(
      parseBybitRiskLimit([
        tier(1, "AAA", "10000"),
        tier(2, "AAA", ""),
        tier(1, "BBB", "25000"),
      ]).map((t) => t.venueSymbol),
    ).toEqual(["BBB"]);
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
