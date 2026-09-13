import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import statsFixture from "../../__fixtures__/variational/metadata-stats.json";
import type { HttpClient } from "../http";
import {
  createVariationalAdapter,
  parseVariationalStats,
  VARIATIONAL_API,
  variationalDeclaredBase,
  variationalIntervalRate,
} from "./variational";

const NOW = 1_789_337_000_000; // 2026-09-13T22:03:20Z

describe("parseVariationalStats", () => {
  const snapshots = parseVariationalStats(statsFixture, NOW);

  test("normalizes BTC: the annualised rate becomes the rate for one 8h payment", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC")).toEqual({
      venueId: "variational",
      venueSymbol: "BTC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: (0.091241 * 8) / 8760,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: null,
      kind: "predicted",
      markPrice: 77229.3565140889,
      indexPrice: null,
      openInterestUsd:
        Number("79488330.90156663078909270000") + Number("70056049.647245814573357420000"),
      volume24hUsd: 245987215.191356,
    });
  });

  test("the conversion round-trips to the published annual figure", () => {
    for (const s of snapshots) {
      const listing = statsFixture.listings.find((l) => l.ticker === s.venueSymbol);
      expect(aprFromRate(s.rate, "fraction", s.basisHours)).toBeCloseTo(
        Number(listing?.funding_rate) * 100,
        8,
      );
    }
  });

  test("the documented constants pin the unit as annual", () => {
    // Interest component 0.00125%/h, the crypto default: 0.1095 annualised.
    expect(variationalIntervalRate(0.1095, 1)).toBeCloseTo(0.0000125, 12);
    // Pre-IPO is "fixed at 0.005% every 8 hours"; OPENAI publishes 0.05475.
    expect(snapshots.find((s) => s.venueSymbol === "OPENAI")?.rate).toBeCloseTo(0.00005, 12);
    // STORJ's -85.54 on a 1h interval is -0.98%/h annualised, inside the 2%/h cap.
    const storj = snapshots.find((s) => s.venueSymbol === "STORJ");
    expect(storj).toMatchObject({ basisHours: 1, intervalHours: 1 });
    expect(storj?.rate).toBeCloseTo(-0.0097644547, 9);
  });

  test("each listing keeps its own interval", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.intervalHours])).toEqual([
      ["BTC", 8],
      ["ETH", 8],
      ["HYPER", 4],
      ["STORJ", 1],
      ["1000PEPE", 8],
      ["OPN_OPINION", 4],
      ["OPENAI", 8],
      ["TSLA", 8],
      ["CAT", 8],
    ]);
  });

  test("swaps, with no funding interval, are skipped", () => {
    expect(statsFixture.listings.find((l) => l.ticker === "XAUS")?.funding_interval_s).toBe(0);
    expect(snapshots.some((s) => s.venueSymbol === "XAUS")).toBe(false);
  });

  test("the declared ticker is the base where the parser disagrees; prefixes stay multipliers", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.multiplier])).toEqual([
      ["BTC", "BTC", 1],
      ["ETH", "ETH", 1],
      ["HYPER", "HYPER", 1],
      ["STORJ", "STORJ", 1],
      ["1000PEPE", "PEPE", 1000],
      ["OPN_OPINION", "OPN_OPINION", 1],
      ["OPENAI", "OPENAI", 1],
      ["TSLA", "TSLA", 1],
      ["CAT", "CAT", 1],
    ]);
    expect(variationalDeclaredBase("RE_ETH")).toBe("RE_ETH");
    expect(variationalDeclaredBase("1000000MOG")).toBeNull();
    expect(variationalDeclaredBase("BTC")).toBeNull();
  });

  test("Variational declares no class, so everything is crypto -- tradfi names included", () => {
    expect(new Set(snapshots.map((s) => s.assetClass))).toEqual(new Set(["crypto"]));
    expect(new Set(snapshots.map((s) => s.quote))).toEqual(new Set(["USDC"]));
  });
});

describe("variationalAdapter", () => {
  test("one request per cycle and no funding history", async () => {
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "variational",
      getJson: async <T>(url: string) => {
        urls.push(url);
        return statsFixture as T;
      },
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    };
    const adapter = createVariationalAdapter();
    const batch = await adapter.fetchSnapshots(client, NOW);
    expect(urls).toEqual([`${VARIATIONAL_API}/metadata/stats`]);
    expect(batch.snapshots).toHaveLength(9);
    expect(adapter.minIntervalMs).toBe(1000);
    expect(adapter.fetchFundingHistory).toBeUndefined();
  });
});
