import { describe, expect, test } from "bun:test";
import historyFixture from "../../__fixtures__/dydx/historicalFunding_LINK-USD.json";
import marketsFixture from "../../__fixtures__/dydx/perpetualMarkets.json";
import tradfiMarketsFixture from "../../__fixtures__/dydx/perpetualMarkets_tradfi.json";
import type { HttpClient } from "../http";
import {
  dydxAdapter,
  dydxAssetClass,
  parseDydxHistoricalFunding,
  parseDydxLeverageTiers,
  parseDydxMarkets,
} from "./dydx";

const NOW = 1_789_147_709_400; // 2026-09-11T17:28:29.400Z
const NEXT_HOUR = Date.parse("2026-09-11T18:00:00Z");

describe("parseDydxMarkets", () => {
  const snapshots = parseDydxMarkets(marketsFixture, NOW);

  test("normalizes LINK-USD as a 1-hour rate marked to the oracle price", () => {
    expect(snapshots.find((s) => s.venueSymbol === "LINK-USD")).toEqual({
      venueId: "dydx",
      venueSymbol: "LINK-USD",
      base: "LINK",
      quote: "USD",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.00001665625,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: NEXT_HOUR,
      kind: "predicted",
      markPrice: 11.775911208,
      indexPrice: 11.775911208,
      openInterestUsd: 28956 * 11.775911208,
      volume24hUsd: 26888.834,
    });
  });

  test("normalizes BTC-USD and ETH-USD", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USD")).toMatchObject({
      base: "BTC",
      assetClass: "crypto",
      rate: 0,
      openInterestUsd: 194.239 * 77862.55687,
      volume24hUsd: 3889329.2462,
    });
    expect(snapshots.find((s) => s.venueSymbol === "ETH-USD")?.rate).toBe(-0.00000022767857142857);
  });

  test("skips markets that aren't ACTIVE", () => {
    expect(snapshots.map((s) => s.venueSymbol).sort()).toEqual(["BTC-USD", "ETH-USD", "LINK-USD"]);
  });

  test("next funding is the next top of the hour", () => {
    expect(parseDydxMarkets(marketsFixture, NEXT_HOUR)[0]?.nextFundingAt).toBe(
      NEXT_HOUR + 3_600_000,
    );
  });
});

describe("dydxAssetClass", () => {
  test("the markets dYdX announced as tradfi take their kind from the tables", () => {
    expect(dydxAssetClass("XAG-USD")).toBe("commodity");
    expect(dydxAssetClass("WTI-USD")).toBe("commodity");
    expect(dydxAssetClass("EUR-USD")).toBe("fx");
    expect(dydxAssetClass("TRY-USD")).toBe("fx");
  });

  test("everything else is crypto, tokens that track tradfi included", () => {
    for (const ticker of ["BTC-USD", "PAXG-USD", "XAUT-USD", "TSLAX-USD"]) {
      expect(dydxAssetClass(ticker)).toBe("crypto");
    }
  });

  test("snapshots carry it, from real rows of the indexer response", () => {
    // EUR-USD is in FINAL_SETTLEMENT and skipped like any other settled market.
    expect(
      parseDydxMarkets(tradfiMarketsFixture, NOW)
        .map((s) => [s.venueSymbol, s.base, s.assetClass])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
      ["PAXG-USD", "PAXG", "crypto"],
      ["WTI-USD", "CL", "commodity"],
      ["XAG-USD", "XAG", "commodity"],
    ]);
  });

  test("history carries it too", () => {
    // LINK rows stand in for WTI's: only the class of the events is under test here.
    const events = parseDydxHistoricalFunding(
      historyFixture.historicalFunding,
      "WTI-USD",
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.assetClass === "commodity" && e.base === "CL")).toBe(true);
  });
});

describe("parseDydxLeverageTiers", () => {
  const tiers = parseDydxLeverageTiers(marketsFixture);

  test("one unbounded tier per active market", () => {
    // MATIC-USD is in FINAL_SETTLEMENT and drops out, exactly as it does for snapshots.
    expect(tiers.map((t) => t.venueSymbol)).toEqual(["BTC-USD", "ETH-USD", "LINK-USD"]);
    expect(tiers[0]).toEqual({
      venueId: "dydx",
      venueSymbol: "BTC-USD",
      tier: 1,
      lowerNotionalUsd: 0,
      upperNotionalUsd: null,
      imr: 0.02,
      mmr: 0.012,
      maxLeverage: 50,
    });
  });

  test("the margin fraction is read per market, not assumed venue-wide", () => {
    // The majors run at 0.02 (50x), but LINK margins at 0.1, which is 10x. Treating dYdX as a
    // flat 50x venue would overstate its leverage fivefold on every smaller market.
    expect(tiers.find((t) => t.venueSymbol === "LINK-USD")).toMatchObject({
      imr: 0.1,
      mmr: 0.05,
      maxLeverage: 10,
    });
  });
});

describe("dYdX funding history", () => {
  test("parses newest-first rows into oldest-first hourly settlements", () => {
    const events = parseDydxHistoricalFunding(
      historyFixture.historicalFunding,
      "LINK-USD",
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(
      events.map((e) => [new Date(e.settledAt).toISOString(), e.rate, e.basisHours, e.markPrice]),
    ).toEqual([
      ["2026-09-11T13:00:00.792Z", 0, 1, 11.682189541],
      ["2026-09-11T14:00:00.541Z", 0, 1, 12.062931827],
      ["2026-09-11T15:00:00.494Z", 0, 1, 11.928672676],
      ["2026-09-11T16:00:00.622Z", 0.000114, 1, 11.709829134],
      ["2026-09-11T17:00:00.234Z", 0.000004125, 1, 11.792210428],
    ]);
    expect(events[0]?.assetClass).toBe("crypto");
  });

  test("fetchFundingHistory filters to the window and stops on a short page", async () => {
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "dydx",
      async getJson<T>(url: string): Promise<T> {
        urls.push(url);
        return historyFixture as T;
      },
      postJson: async () => {
        throw new Error("unused");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    };
    const events = await dydxAdapter.fetchFundingHistory?.(
      client,
      "LINK-USD",
      Date.parse("2026-09-11T14:30:00Z"),
      Date.parse("2026-09-11T17:30:00Z"),
    );
    expect(events?.map((e) => e.rate)).toEqual([0, 0.000114, 0.000004125]);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("effectiveBeforeOrAt=2026-09-11T17:30:00.000Z");
  });
});
