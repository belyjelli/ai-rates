import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import historyFixture from "../../__fixtures__/risex/funding-rate-history-1.json";
import history21After from "../../__fixtures__/risex/funding-rate-history-21-after-2300.json";
import marketsFixture from "../../__fixtures__/risex/markets.json";
import marketsAfter from "../../__fixtures__/risex/markets-after-2300.json";
import type { HttpClient } from "../http";
import {
  createRisexAdapter,
  isRisexTradable,
  nsToMs,
  parseRisexFundingHistory,
  parseRisexMarkets,
  RISEX_API,
  type RisexFundingHistoryResponse,
  type RisexMarket,
  type RisexMarketsResponse,
  risexAssetClass,
} from "./risex";

const NOW = 1_789_338_400_000; // 2026-09-13T22:26:40Z
const markets = marketsFixture as RisexMarketsResponse;
const history = historyFixture as RisexFundingHistoryResponse;

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "risex",
    getJson: async <T>(url: string) => {
      urls.push(url);
      return respond(url) as T;
    },
    postJson: async () => {
      throw new Error("unexpected POST");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
  return { client, urls };
}

describe("parseRisexMarkets", () => {
  const { snapshots, settled } = parseRisexMarkets(markets, NOW);

  test("normalizes BTC/USDC as the last settled hourly rate", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC/USDC")).toEqual({
      venueId: "risex",
      venueSymbol: "BTC/USDC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.000004719244490803,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
      kind: "settled",
      markPrice: Number("76794.295168791114698431"),
      indexPrice: 76788.95593436477,
      // open_interest is base units, valued at mark.
      openInterestUsd: 145.390106 * Number("76794.295168791114698431"),
      volume24hUsd: 16693624.8241382,
      maxLeverage: 25,
    });
  });

  test("the same rate is the settlement at next_funding_time minus the interval", () => {
    expect(settled.find((e) => e.venueSymbol === "BTC/USDC")).toEqual({
      venueId: "risex",
      venueSymbol: "BTC/USDC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      settledAt: 1_789_336_800_000,
      rate: 0.000004719244490803,
      basisHours: 1,
      markPrice: null,
    });
    // And it is exactly the newest record of funding-rate-history, whose end_time is 22:00.
    const newest = history.data.records[0];
    expect(Number(newest?.funding_rate)).toBe(0.000004719244490803);
    expect(nsToMs(newest?.end_time)).toBe(1_789_336_800_000);
  });

  test("funding_rate_8h is eight hourly rates, so the hourly field is the one on a 1h basis", () => {
    const btc = markets.data.markets.find((m) => m.market_id === "1") as RisexMarket;
    expect(Number(btc.funding_rate_8h)).toBeCloseTo(Number(btc.current_funding_rate) * 8, 18);
    const snap = snapshots.find((s) => s.venueSymbol === "BTC/USDC");
    expect(aprFromRate(snap?.rate ?? 0, "fraction", snap?.basisHours ?? 0)).toBeCloseTo(4.134, 3);
  });

  test("only active, unlocked, non-post-only, non-reduce-only markets", () => {
    // Skipped: ONDO/USDC (inactive, post-only) and the deprecated DOGE duplicate.
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTC/USDC",
      "ETH/USDC",
      "XAU/USDC",
      "CL/USDC",
      "SNDK/USDC",
      "QQQ/USDC",
    ]);
    expect(settled).toHaveLength(6);
    const btc = markets.data.markets[0] as RisexMarket;
    expect(isRisexTradable({ ...btc, reduce_only: true })).toBe(false);
    expect(isRisexTradable({ ...btc, config: { ...btc.config, unlocked: false } })).toBe(false);
  });

  test("class from category, base and quote from the parser and declaration", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.assetClass, s.quote])).toEqual([
      ["BTC/USDC", "BTC", "crypto", "USDC"],
      ["ETH/USDC", "ETH", "crypto", "USDC"],
      ["XAU/USDC", "XAU", "commodity", "USDC"],
      ["CL/USDC", "CL", "commodity", "USDC"],
      // stocks
      ["SNDK/USDC", "SNDK", "equity", "USDC"],
      // index_etf is passed as index; core files the QQQ ETF as equity.
      ["QQQ/USDC", "QQQ", "equity", "USDC"],
    ]);
  });
});

describe("risexAssetClass and nsToMs", () => {
  test("categories, with unknown non-crypto values falling to the base tables", () => {
    expect(risexAssetClass("", "DOGE")).toBe("crypto");
    expect(risexAssetClass("crypto", "BTC")).toBe("crypto");
    expect(risexAssetClass("stocks", "TSLA")).toBe("equity");
    expect(risexAssetClass("index_etf", "US500")).toBe("index");
    expect(risexAssetClass("forex", "EURUSD")).toBe("fx");
  });

  test("nanosecond strings beyond 2^53 convert exactly", () => {
    expect(nsToMs("1789340400000000000")).toBe(1_789_340_400_000);
    expect(nsToMs("3600000000000")).toBe(3_600_000);
    expect(nsToMs("")).toBeNull();
    expect(nsToMs("0")).toBeNull();
    expect(nsToMs("not a number")).toBeNull();
  });
});

describe("RiseX funding history", () => {
  test("records become oldest-first settlements at end_time", () => {
    const btc = markets.data.markets[0] as RisexMarket;
    const events = parseRisexFundingHistory(history.data.records, btc, 0, Number.MAX_SAFE_INTEGER);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_322_400_000, 0.000009333805858142, 1],
      [1_789_326_000_000, 0.000008659095028409, 1],
      [1_789_329_600_000, 0.000008605035537197, 1],
      [1_789_333_200_000, -0.000000339442964322, 1],
      [1_789_336_800_000, 0.000004719244490803, 1],
    ]);
  });

  test("fetchSnapshots is one request per cycle", async () => {
    const { client, urls } = fakeClient(() => markets);
    const batch = await createRisexAdapter().fetchSnapshots(client, NOW);
    expect(urls).toEqual([`${RISEX_API}/markets`]);
    expect(batch.snapshots).toHaveLength(6);
  });

  test("history addresses the market by id, in nanoseconds, and follows has_next_page", async () => {
    const lastPage = { data: { ...history.data, records: [], has_next_page: false } };
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/markets")) return markets;
      return url.includes("page=1&") ? history : lastPage;
    });
    const events = await createRisexAdapter().fetchFundingHistory?.(
      client,
      "BTC/USDC",
      1_789_326_000_000,
      1_789_337_000_000,
    );
    expect(urls).toEqual([
      `${RISEX_API}/markets`,
      `${RISEX_API}/markets/id/1/funding-rate-history?start_time=1789326000000000000&end_time=1789337000001000000&page=1&limit=1000`,
      `${RISEX_API}/markets/id/1/funding-rate-history?start_time=1789326000000000000&end_time=1789337000001000000&page=2&limit=1000`,
    ]);
    // The window drops the 18:00 settlement.
    expect(events?.map((e) => e.settledAt)).toEqual([
      1_789_326_000_000, 1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000,
    ]);
  });

  test("an unknown market returns no history", async () => {
    const { client } = fakeClient(() => markets);
    expect(await createRisexAdapter().fetchFundingHistory?.(client, "NOPE/USDC", 0, 1)).toEqual([]);
  });
});

describe("RiseX across the 23:00 settlement (2026-09-13)", () => {
  const after = marketsAfter as RisexMarketsResponse;
  const records21 = (history21After as RisexFundingHistoryResponse).data.records;

  test("current_funding_rate becomes the new settlement record, so it is never an estimate", () => {
    const { snapshots, settled } = parseRisexMarkets(after, 1_789_340_538_000);
    const sndk = snapshots.find((s) => s.venueSymbol === "SNDK/USDC");
    const sndkSettled = settled.find((e) => e.venueSymbol === "SNDK/USDC");
    // Before the hour (fixture read at 22:26, and still at 22:59:33) SNDK read 0.000290564882876973,
    // which is the 22:00 record; after it, the 23:00 record.
    expect(markets.data.markets.find((m) => m.market_id === "21")?.current_funding_rate).toBe(
      records21[1]?.funding_rate,
    );
    expect(sndk).toMatchObject({
      rate: -0.000195857364862654,
      kind: "settled",
      nextFundingAt: 1_789_344_000_000,
    });
    const [newest] = parseRisexFundingHistory(
      records21.slice(0, 1),
      { config: { name: "SNDK/USDC" }, category: "stocks" },
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(sndkSettled).toEqual(newest);
    expect(sndkSettled?.settledAt).toBe(1_789_340_400_000);
    expect(snapshots.find((s) => s.venueSymbol === "BTC/USDC")?.rate).toBe(0.000018317170082382);
  });
});
