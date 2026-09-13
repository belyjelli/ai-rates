import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import definitionsFixture from "../../__fixtures__/reya/marketDefinitions.json";
import summaryFixture from "../../__fixtures__/reya/perpMarkets-summary.json";
import earlierFixture from "../../__fixtures__/reya/perpMarkets-summary-earlier.json";
import type { HttpClient } from "../http";
import {
  createReyaAdapter,
  parseReyaSnapshots,
  REYA_API,
  type ReyaMarketSummary,
  reyaHourlyRate,
  reyaPerpBase,
} from "./reya";

const NOW = 1_789_337_089_204; // the later summary's updatedAt
const summary = summaryFixture as ReyaMarketSummary[];
const earlier = earlierFixture as ReyaMarketSummary[];

describe("parseReyaSnapshots", () => {
  const snapshots = parseReyaSnapshots(summary, definitionsFixture, NOW);

  test("normalizes BTCRUSDPERP: percent per hour, continuous, marked to the oracle", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTCRUSDPERP")).toEqual({
      venueId: "reya",
      venueSymbol: "BTCRUSDPERP",
      base: "BTC",
      quote: "RUSD",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.001013625959372885 / 100,
      basisHours: 1,
      intervalHours: null,
      nextFundingAt: null,
      kind: "predicted",
      markPrice: 77013.0411011947,
      indexPrice: 77013.0411011947,
      openInterestUsd: 39.3619 * 77013.0411011947,
      volume24hUsd: 91245457.2703056,
      maxLeverage: 40,
    });
  });

  test("BTC's rate annualizes to ~8.9%, the same order as every other venue", () => {
    const btc = snapshots.find((s) => s.venueSymbol === "BTCRUSDPERP");
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(8.879, 3);
  });

  test("only markets listed in marketDefinitions are live", () => {
    // MKRRUSDPERP is still in the summary, with zero OI and volume, but no longer defined.
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTCRUSDPERP",
      "ETHRUSDPERP",
      "kPEPERUSDPERP",
      "LINKRUSDPERP",
      "HYPERUSDPERP",
      "PAXGRUSDPERP",
    ]);
  });

  test("bases come from the symbol grammar, with the k prefix read as a multiplier", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.multiplier, s.quote])).toEqual([
      ["BTCRUSDPERP", "BTC", 1, "RUSD"],
      ["ETHRUSDPERP", "ETH", 1, "RUSD"],
      ["kPEPERUSDPERP", "PEPE", 1000, "RUSD"],
      ["LINKRUSDPERP", "LINK", 1, "RUSD"],
      ["HYPERUSDPERP", "HYPE", 1, "RUSD"],
      ["PAXGRUSDPERP", "PAXG", 1, "RUSD"],
    ]);
    expect(snapshots.every((s) => s.assetClass === "crypto")).toBe(true);
  });

  test("a negative rate stays negative: shorts pay", () => {
    const hype = snapshots.find((s) => s.venueSymbol === "HYPERUSDPERP");
    const row = summary.find((r) => r.symbol === "HYPERUSDPERP");
    expect(hype?.rate).toBe(Number(row?.fundingRate) / 100);
    expect(hype?.rate).toBeLessThan(0);
  });
});

describe("Reya funding semantics", () => {
  const hours = (a: ReyaMarketSummary, b: ReyaMarketSummary) =>
    ((b.updatedAt ?? 0) - (a.updatedAt ?? 0)) / 3_600_000;
  const pair = (symbol: string) => {
    const a = earlier.find((r) => r.symbol === symbol) as ReyaMarketSummary;
    const b = summary.find((r) => r.symbol === symbol) as ReyaMarketSummary;
    return { a, b, dt: hours(a, b), price: Number(b.throttledOraclePrice) };
  };

  test("fundingRate is percent: the long accumulator grows by fundingRate / 100 per $ per hour", () => {
    const { a, b, dt, price } = pair("BTCRUSDPERP");
    const perDollarHour = (Number(b.longFundingValue) - Number(a.longFundingValue)) / (price * dt);
    const meanRate =
      ((reyaHourlyRate(a.fundingRate) ?? 0) + (reyaHourlyRate(b.fundingRate) ?? 0)) / 2;
    // 204s apart on 2026-09-14: 1.0074e-5 against 1.0070e-5. Read as a fraction it would be 100x off.
    expect(perDollarHour / meanRate).toBeGreaterThan(0.98);
    expect(perDollarHour / meanRate).toBeLessThan(1.02);
  });

  test("long and short values are per-direction accumulators that can drift apart, not rates", () => {
    const { a, b } = pair("LINKRUSDPERP");
    const longMove = Number(b.longFundingValue) - Number(a.longFundingValue);
    const shortMove = Number(b.shortFundingValue) - Number(a.shortFundingValue);
    // Over the same 204s LINK's shorts were credited about a third of what its longs were charged.
    expect(shortMove / longMove).toBeCloseTo(0.31, 2);
  });

  test("the stored rate is fundingRate alone: the funding values never enter it", () => {
    const skewed = summary.map((r) => ({
      ...r,
      longFundingValue: "999999",
      shortFundingValue: "-999999",
    }));
    expect(parseReyaSnapshots(skewed, definitionsFixture, NOW).map((s) => s.rate)).toEqual(
      parseReyaSnapshots(summary, definitionsFixture, NOW).map((s) => s.rate),
    );
  });

  test("reyaHourlyRate converts percent to fraction and rejects junk", () => {
    expect(reyaHourlyRate("0.001")).toBeCloseTo(0.00001, 12);
    expect(reyaHourlyRate("-0.5")).toBe(-0.005);
    expect(reyaHourlyRate("")).toBeNull();
    expect(reyaHourlyRate(undefined)).toBeNull();
  });

  test("reyaPerpBase reads the documented <base>RUSDPERP grammar and nothing else", () => {
    expect(reyaPerpBase("SRUSDPERP")).toEqual({ base: "S", multiplier: 1 });
    expect(reyaPerpBase("kBONKRUSDPERP")).toEqual({ base: "BONK", multiplier: 1000 });
    expect(reyaPerpBase("WETHRUSD")).toBeNull();
    expect(reyaPerpBase("RUSDPERP")).toBeNull();
  });
});

describe("reyaAdapter", () => {
  test("caches marketDefinitions for an hour and has no funding history", async () => {
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "reya",
      getJson: async <T>(url: string) => {
        urls.push(url);
        return (url.endsWith("/marketDefinitions") ? definitionsFixture : summary) as T;
      },
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    };
    const adapter = createReyaAdapter();
    await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    const batch = await adapter.fetchSnapshots(client, NOW + 60 * 60_000);

    const defs = `${REYA_API}/marketDefinitions`;
    const sum = `${REYA_API}/perpMarkets/summary`;
    expect(urls).toEqual([defs, sum, sum, defs, sum]);
    expect(batch.snapshots).toHaveLength(6);
    expect(adapter.fetchFundingHistory).toBeUndefined();
  });
});
