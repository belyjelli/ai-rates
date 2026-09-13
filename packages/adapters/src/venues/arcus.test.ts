import { describe, expect, test } from "bun:test";
import fundingFixture from "../../__fixtures__/arcus/fundingRates-BTC-USD.json";
import marketsFixture from "../../__fixtures__/arcus/markets.json";
import type { HttpClient } from "../http";
import {
  ARCUS_API,
  type ArcusMarket,
  arcusAssetClass,
  createArcusAdapter,
  parseArcusFundingRates,
  parseArcusMarkets,
} from "./arcus";

const NOW = 1_789_337_000_000; // 2026-09-13T22:03:20Z
const NEXT_FUNDING = 1_789_340_400_000; // 23:00Z
const markets = marketsFixture as { markets: ArcusMarket[] };

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "arcus",
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

describe("parseArcusMarkets", () => {
  const { snapshots, settled } = parseArcusMarkets(markets, NOW);

  test("normalizes BTC-USD: the forecast is the snapshot, due at nextFundingAt", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USD")).toEqual({
      venueId: "arcus",
      venueSymbol: "BTC-USD",
      base: "BTC",
      quote: "USDG",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.0000125,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: NEXT_FUNDING,
      kind: "predicted",
      markPrice: 77119.6,
      indexPrice: 77101.9,
      openInterestUsd: 60.0595314 * 77119.6,
      volume24hUsd: 18092181.61,
      maxLeverage: 40,
    });
  });

  test("nextFundingRate is predicted and fundingRate settled an hour before nextFundingAt", () => {
    // CASHCAT is the fixture's one market where the two differ.
    expect(snapshots.find((s) => s.venueSymbol === "CASHCAT-USD")?.rate).toBe(
      Number("0.00009867686245265627"),
    );
    expect(settled.find((e) => e.venueSymbol === "CASHCAT-USD")).toMatchObject({
      settledAt: NEXT_FUNDING - 3_600_000,
      rate: 0.000101068592527558,
      basisHours: 1,
    });
    // The live history's newest BTC row is exactly that settlement.
    expect(fundingFixture.fundingRates[0]?.time).toBe((NEXT_FUNDING - 3_600_000) * 1000);
    expect(settled.find((e) => e.venueSymbol === "BTC-USD")?.rate).toBe(
      Number(fundingFixture.fundingRates[0]?.fundingRate),
    );
  });

  test("open interest is base units converted at mark", () => {
    const eth = snapshots.find((s) => s.venueSymbol === "ETH-USD");
    expect(eth?.openInterestUsd).toBeCloseTo(709.1385169 * 2499.44, 6);
    expect(eth?.maxLeverage).toBe(25);
  });

  test("keeps only ONLINE perpetuals", () => {
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTC-USD",
      "ETH-USD",
      "CASHCAT-USD",
      "AMD-USD",
      "GLD-USD",
      "SPY-USD",
    ]);
    expect(settled).toHaveLength(6);
  });

  test("class from category, with commodity and index ETFs settled by the base tables", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.assetClass, s.quote])).toEqual([
      ["BTC-USD", "BTC", "crypto", "USDG"],
      ["ETH-USD", "ETH", "crypto", "USDG"],
      ["CASHCAT-USD", "CASHCAT", "crypto", "USDG"],
      ["AMD-USD", "AMD", "equity", "USDG"],
      // COMMODITIES holds commodity ETFs, which core files as equity.
      ["GLD-USD", "GLD", "equity", "USDG"],
      // INDICES holds index ETFs.
      ["SPY-USD", "SPY", "equity", "USDG"],
    ]);
  });
});

describe("arcusAssetClass", () => {
  test("every declared category, and unknowns never throw", () => {
    expect(arcusAssetClass("CRYPTO", "BTC")).toBe("crypto");
    expect(arcusAssetClass(null, "XAU")).toBe("crypto");
    expect(arcusAssetClass("EQUITIES", "AMD")).toBe("equity");
    expect(arcusAssetClass("INDICES", "SPY")).toBe("index");
    expect(arcusAssetClass("FOREX", "EUR")).toBe("fx");
    expect(arcusAssetClass("COMMODITIES", "XAU")).toBe("commodity");
    expect(arcusAssetClass("COMMODITIES", "GLD")).toBe("equity");
    expect(arcusAssetClass("BONDS", "US10Y")).toBe("index");
  });
});

describe("Arcus funding history", () => {
  test("microsecond rows become oldest-first hourly settlements in ms", () => {
    const events = parseArcusFundingRates(
      fundingFixture.fundingRates,
      "BTC-USD",
      "CRYPTO",
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_322_400_000, 0.0000125, 1],
      [1_789_326_000_000, 0.0000125, 1],
      [1_789_329_600_000, 0.0000125, 1],
      [1_789_333_200_000, 0.0000125, 1],
      [1_789_336_800_000, 0.0000125, 1],
    ]);
    expect(events[0]).toMatchObject({ base: "BTC", quote: "USDG", assetClass: "crypto" });
  });

  test("snapshots take one request; history asks in microseconds and pages by `to`", async () => {
    const hourUs = 3_600_000_000;
    const newest = 1_789_336_800_000_000;
    const rows = (top: number, count: number) => ({
      fundingRates: Array.from({ length: count }, (_, i) => ({
        marketId: 11,
        marketDisplayName: "AMD-USD",
        fundingRate: "0.000004768518518518",
        time: top - i * hourUs,
      })),
    });
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/markets")) return markets;
      return urls.length === 2 ? rows(newest, 1000) : rows(newest - 1000 * hourUs, 2);
    });
    const adapter = createArcusAdapter();
    const batch = await adapter.fetchSnapshots(client, NOW);
    expect(urls).toEqual([`${ARCUS_API}/markets`]);
    expect(batch.snapshots).toHaveLength(6);

    const from = (newest - 1001 * hourUs) / 1000;
    const to = newest / 1000;
    const events = await adapter.fetchFundingHistory?.(client, "AMD-USD", from, to);
    expect(urls.slice(1)).toEqual([
      `${ARCUS_API}/fundingRates?market=AMD-USD&from=${from * 1000}&to=${to * 1000}&limit=1000`,
      `${ARCUS_API}/fundingRates?market=AMD-USD&from=${from * 1000}&to=${newest - 999 * hourUs - 1}&limit=1000`,
    ]);
    expect(events).toHaveLength(1002);
    // History carries the class the markets call declared.
    expect(events?.every((e) => e.assetClass === "equity")).toBe(true);
  });
});
