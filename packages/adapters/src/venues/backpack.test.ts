import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import fundingFixture from "../../__fixtures__/backpack/fundingRates-BTC_USDC_PERP.json";
import marketsFixture from "../../__fixtures__/backpack/markets.json";
import markPricesFixture from "../../__fixtures__/backpack/markPrices.json";
import openInterestFixture from "../../__fixtures__/backpack/openInterest.json";
import tickersFixture from "../../__fixtures__/backpack/tickers.json";
import type { HttpClient } from "../http";
import {
  BACKPACK_API,
  type BackpackFundingRate,
  type BackpackMarket,
  type BackpackMarkPrice,
  type BackpackOpenInterest,
  type BackpackTicker,
  backpackAssetClass,
  backpackTimestamp,
  createBackpackAdapter,
  isBackpackTradable,
  parseBackpackFundingRates,
  parseBackpackSnapshots,
} from "./backpack";

const NOW = 1_789_338_401_070; // 2026-09-13T22:26:41Z, the openInterest timestamp
/** When the funding fixture was read: 22:38:55, while the 23:00 interval was still accruing. */
const HISTORY_READ_AT = 1_789_339_135_000;
const markets = marketsFixture as BackpackMarket[];
const markPrices = markPricesFixture as BackpackMarkPrice[];
const openInterest = openInterestFixture as BackpackOpenInterest[];
const tickers = tickersFixture as BackpackTicker[];
const funding = fundingFixture as BackpackFundingRate[];

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "backpack",
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

function respond(url: string): unknown {
  if (url.endsWith("/markets")) return markets;
  if (url.endsWith("/markPrices")) return markPrices;
  if (url.endsWith("/openInterest")) return openInterest;
  if (url.endsWith("/tickers")) return tickers;
  if (url.includes("/fundingRates?")) return funding;
  throw new Error(`unexpected ${url}`);
}

describe("parseBackpackSnapshots", () => {
  const snapshots = parseBackpackSnapshots(markets, markPrices, openInterest, tickers, NOW);

  test("normalizes BTC_USDC_PERP as a predicted hourly rate", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC_USDC_PERP")).toEqual({
      venueId: "backpack",
      venueSymbol: "BTC_USDC_PERP",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: Number("0.0000007945965277712049003927"),
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
      kind: "predicted",
      markPrice: 76746.5,
      indexPrice: 76785.99441873,
      // openInterest is base units, valued at mark.
      openInterestUsd: 412.67346 * 76746.5,
      volume24hUsd: 126024537.212937,
    });
  });

  test("ETH's hourly rate annualizes near Hyperliquid's 10.95% the same minute", () => {
    const eth = snapshots.find((s) => s.venueSymbol === "ETH_USDC_PERP");
    expect(aprFromRate(eth?.rate ?? 0, "fraction", eth?.basisHours ?? 0)).toBeCloseTo(10.57, 2);
  });

  test("only Open perps are collected", () => {
    // Skipped: AMZN.US (PostOnly), IP (Closed, absent from markPrices), SOL_USDC (spot), and the
    // FDVEXTD1B prediction row in openInterest, which has no market.
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "QQQ.US_USDC_PERP",
      "PAXG_USDC_PERP",
      "ETH_USDC_PERP",
      "DRAM.US_USDC_PERP",
      "BTC_USDC_PERP",
      "MU.US_USDC_PERP",
      "kPEPE_USDC_PERP",
    ]);
    expect(
      isBackpackTradable({ symbol: "X", marketType: "PERP", orderBookState: "PostOnly" }),
    ).toBe(false);
  });

  test("class from rwaMarketType, base from the parser", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.multiplier, s.assetClass])).toEqual([
      // INDEX is passed as index; QQQ.US is not in core's index table, so it lands on equity.
      ["QQQ.US_USDC_PERP", "QQQ.US", 1, "equity"],
      ["PAXG_USDC_PERP", "PAXG", 1, "crypto"],
      ["ETH_USDC_PERP", "ETH", 1, "crypto"],
      ["DRAM.US_USDC_PERP", "DRAM.US", 1, "equity"],
      ["BTC_USDC_PERP", "BTC", 1, "crypto"],
      // STOCK. The venue's .US suffix is kept, as declared.
      ["MU.US_USDC_PERP", "MU.US", 1, "equity"],
      ["kPEPE_USDC_PERP", "PEPE", 1000, "crypto"],
    ]);
    expect(new Set(snapshots.map((s) => s.quote))).toEqual(new Set(["USDC"]));
  });
});

describe("backpackAssetClass", () => {
  test("null is crypto; an unknown RWA type falls to the base tables, never throws", () => {
    expect(backpackAssetClass(null, "BTC")).toBe("crypto");
    expect(backpackAssetClass("STOCK", "NVDA.US")).toBe("equity");
    expect(backpackAssetClass("INDEX", "SPY.US")).toBe("index");
    expect(backpackAssetClass("COMMODITY", "XAU")).toBe("commodity");
    expect(backpackAssetClass("SOMETHING", "EURUSD")).toBe("fx");
  });
});

describe("Backpack funding history", () => {
  test("zone-less timestamps are UTC", () => {
    expect(backpackTimestamp("2026-09-13T22:00:00")).toBe(1_789_336_800_000);
    expect(backpackTimestamp("2026-09-13T22:00:00Z")).toBe(1_789_336_800_000);
    expect(backpackTimestamp("")).toBeNull();
  });

  test("the still-accruing interval is not a settlement", () => {
    const btc = markets.find((m) => m.symbol === "BTC_USDC_PERP") as BackpackMarket;
    const events = parseBackpackFundingRates(
      funding,
      btc,
      0,
      Number.MAX_SAFE_INTEGER,
      HISTORY_READ_AT,
    );
    // The 23:00 row (0.000001254) was read at 22:38 and is dropped.
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_322_400_000, 0.00001213, 1],
      [1_789_326_000_000, 0.000007819, 1],
      [1_789_329_600_000, 0.000008029, 1],
      [1_789_333_200_000, 0.000009713, 1],
      [1_789_336_800_000, 0.000008311, 1],
    ]);
    expect(events[0]).toMatchObject({ venueId: "backpack", base: "BTC", quote: "USDC" });
  });

  test("fetchSnapshots: markets once an hour, three bulk calls every cycle", async () => {
    const { client, urls } = fakeClient(respond);
    const adapter = createBackpackAdapter();
    const batch = await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toEqual([
      `${BACKPACK_API}/markets`,
      `${BACKPACK_API}/markPrices`,
      `${BACKPACK_API}/openInterest`,
      `${BACKPACK_API}/tickers`,
      `${BACKPACK_API}/markPrices`,
      `${BACKPACK_API}/openInterest`,
      `${BACKPACK_API}/tickers`,
    ]);
    expect(batch.snapshots).toHaveLength(7);
    expect(batch.settled).toEqual([]);
  });

  test("history is one page for a short window, with the class learned from markets", async () => {
    const { client, urls } = fakeClient(respond);
    const events = await createBackpackAdapter().fetchFundingHistory?.(
      client,
      "BTC_USDC_PERP",
      1_789_329_000_000,
      1_789_337_000_000,
    );
    expect(urls).toEqual([
      `${BACKPACK_API}/markets`,
      `${BACKPACK_API}/fundingRates?symbol=BTC_USDC_PERP&limit=1000&offset=0`,
    ]);
    expect(events?.map((e) => e.settledAt)).toEqual([
      1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000,
    ]);
  });

  test("pages by offset while pages are full and newer than the window", async () => {
    const hour = 3_600_000;
    const top = 1_789_336_800_000;
    const page = (newest: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        symbol: "BTC_USDC_PERP",
        fundingRate: "0.00001",
        intervalEndTimestamp: new Date(newest - i * hour).toISOString().slice(0, 19),
      }));
    let calls = 0;
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/markets")) return markets;
      calls++;
      return calls === 1 ? page(top, 1000) : page(top - 1000 * hour, 5);
    });
    const events = await createBackpackAdapter().fetchFundingHistory?.(
      client,
      "BTC_USDC_PERP",
      top - 1002 * hour,
      top,
    );
    expect(urls[2]).toBe(
      `${BACKPACK_API}/fundingRates?symbol=BTC_USDC_PERP&limit=1000&offset=1000`,
    );
    expect(urls).toHaveLength(3);
    expect(events).toHaveLength(1003);
  });
});
