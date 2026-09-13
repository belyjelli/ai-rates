import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import fundingFixture from "../../__fixtures__/extended/funding-BTC-USD.json";
import marketsFixture from "../../__fixtures__/extended/info-markets.json";
import type { HttpClient } from "../http";
import {
  createExtendedAdapter,
  EXTENDED_API,
  type ExtendedFundingRow,
  type ExtendedMarket,
  type ExtendedResponse,
  extendedAssetClass,
  parseExtendedFunding,
  parseExtendedMarkets,
} from "./extended";

const NOW = 1_789_337_000_000; // 2026-09-13T22:03:20Z
const markets = marketsFixture as ExtendedResponse<ExtendedMarket[]>;

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "extended",
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

describe("parseExtendedMarkets", () => {
  const snapshots = parseExtendedMarkets(markets, NOW);

  test("normalizes BTC-USD as an hourly rate settling in USDC", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USD")).toEqual({
      venueId: "extended",
      venueSymbol: "BTC-USD",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.000013,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
      kind: "predicted",
      markPrice: Number("77060.427881750001"),
      indexPrice: 77100.406683774985,
      openInterestUsd: 44808704.907173,
      volume24hUsd: 72466662.2649,
      maxLeverage: 50,
    });
  });

  test("the hourly rate annualizes to the venue's ~11% APR", () => {
    const btc = snapshots.find((s) => s.venueSymbol === "BTC-USD");
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(11.388, 3);
  });

  test("open interest is already USD: base OI times mark lands within the mark's drift", () => {
    const btc = snapshots.find((s) => s.venueSymbol === "BTC-USD");
    expect((btc?.openInterestUsd ?? 0) / (579.7751 * Number("77060.427881750001"))).toBeCloseTo(
      1,
      2,
    );
  });

  test("keeps only ACTIVE perpetuals", () => {
    // Skipped from the fixture: GILD (PRELISTED), MKR (REDUCE_ONLY), NOW_24_5 (DELISTED), BTCSPOT (SPOT).
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTC-USD",
      "ETH-USD",
      "1000PEPE-USD",
      "PAXG-USD",
      "XAU-USD",
      "MU_24_5-USD",
      "SPX500m-USD",
      "JP225-USD",
      "EUR-USD",
      "OPENAI-USD",
    ]);
  });

  test("class comes from category and subCategory, base from the parser", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.multiplier, s.assetClass])).toEqual([
      ["BTC-USD", "BTC", 1, "crypto"],
      ["ETH-USD", "ETH", 1, "crypto"],
      ["1000PEPE-USD", "PEPE", 1000, "crypto"],
      // Crypto / Commodity: a gold token, crypto on the venue's own word.
      ["PAXG-USD", "PAXG", 1, "crypto"],
      ["XAU-USD", "XAU", 1, "commodity"],
      // assetName is MU_24_5; uiName MU-USD and the parser agree on MU.
      ["MU_24_5-USD", "MU", 1, "equity"],
      // Declared ETF/Index; aliased SPX500M -> US500 on price evidence, which the index table keeps index.
      ["SPX500m-USD", "US500", 1, "index"],
      ["JP225-USD", "JP225", 1, "index"],
      ["EUR-USD", "EUR", 1, "fx"],
      // Pre-market is pre-IPO shares.
      ["OPENAI-USD", "OPENAI", 1, "equity"],
    ]);
  });

  test("every market quotes USDC, whatever collateralAssetName says", () => {
    expect(markets.data.every((m) => m.collateralAssetName === "USD")).toBe(true);
    expect(new Set(snapshots.map((s) => s.quote))).toEqual(new Set(["USDC"]));
  });
});

describe("extendedAssetClass", () => {
  test("crypto unless the category is RWA", () => {
    expect(extendedAssetClass("Crypto", "Commodity", "XAUT")).toBe("crypto");
    expect(extendedAssetClass("L1", "L1", "FTM")).toBe("crypto");
    expect(extendedAssetClass(undefined, undefined, "XAU")).toBe("crypto");
  });

  test("an RWA sub-category it does not know falls to the base tables, never throws", () => {
    expect(extendedAssetClass("RWA", "TradFi", "USDJPY")).toBe("fx");
    expect(extendedAssetClass("RWA", "Something New", "XAG")).toBe("commodity");
    expect(extendedAssetClass("RWA", null, "NVDA")).toBe("equity");
  });
});

describe("Extended funding history", () => {
  test("parses newest-first rows into oldest-first hourly settlements", () => {
    const events = parseExtendedFunding(
      fundingFixture.data as ExtendedFundingRow[],
      { name: "BTC-USD", category: "Crypto", subCategory: "L1" },
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_326_000_772, 0.000013, 1],
      [1_789_329_600_932, 0.000013, 1],
      [1_789_333_200_772, 0.000013, 1],
      [1_789_336_801_693, 0.000013, 1],
    ]);
    expect(events[0]).toMatchObject({ venueId: "extended", base: "BTC", quote: "USDC" });
  });

  test("one request for a short window, carrying the class learned from snapshots", async () => {
    const { client, urls } = fakeClient((url) =>
      url.endsWith("/info/markets") ? markets : fundingFixture,
    );
    const adapter = createExtendedAdapter();
    await adapter.fetchSnapshots(client, NOW);
    const events = await adapter.fetchFundingHistory?.(
      client,
      "XAU-USD",
      1_789_329_000_000,
      1_789_337_000_000,
    );
    expect(urls).toEqual([
      `${EXTENDED_API}/info/markets`,
      `${EXTENDED_API}/info/XAU-USD/funding?startTime=1789329000000&endTime=1789337000000`,
    ]);
    // The window drops the oldest fixture row.
    expect(events?.map((e) => e.settledAt)).toEqual([
      1_789_329_600_932, 1_789_333_200_772, 1_789_336_801_693,
    ]);
    expect(events?.every((e) => e.assetClass === "commodity")).toBe(true);
  });

  test("pages back by endTime when a page is full", async () => {
    const hour = 3_600_000;
    const top = 1_789_336_800_000;
    const page = (newest: number, count: number) => ({
      status: "OK",
      data: Array.from({ length: count }, (_, i) => ({
        m: "BTC-USD",
        f: "0.00001",
        T: newest - i * hour,
      })),
    });
    const { client, urls } = fakeClient(() =>
      urls.length === 1 ? page(top, 1000) : page(top - 1000 * hour, 3),
    );
    const from = top - 1002 * hour;
    const events = await createExtendedAdapter().fetchFundingHistory?.(
      client,
      "BTC-USD",
      from,
      top,
    );
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain(`endTime=${top - 999 * hour - 1}`);
    expect(events).toHaveLength(1003);
  });

  test("fetchSnapshots makes exactly one request and sends no extra headers", async () => {
    const headers: (Record<string, string> | undefined)[] = [];
    const { client, urls } = fakeClient(() => markets);
    const recording: HttpClient = {
      ...client,
      getJson: (url, h) => {
        headers.push(h);
        return client.getJson(url, h);
      },
    };
    const batch = await createExtendedAdapter().fetchSnapshots(recording, NOW);
    expect(urls).toEqual([`${EXTENDED_API}/info/markets`]);
    // http.ts sends its own User-Agent on every request, which is what Extended requires.
    expect(headers).toEqual([undefined]);
    expect(batch.snapshots).toHaveLength(10);
    expect(batch.settled).toEqual([]);
  });
});
