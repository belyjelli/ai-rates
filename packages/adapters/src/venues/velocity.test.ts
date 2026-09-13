import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import fundingFixture from "../../__fixtures__/velocity/fundingRates-BTC-PERP.json";
import marketsFixture from "../../__fixtures__/velocity/stats-markets.json";
import type { HttpClient } from "../http";
import {
  createVelocityAdapter,
  parseVelocityFundingRates,
  parseVelocityMarkets,
  VELOCITY_API,
  type VelocityFundingRatesResponse,
  type VelocityMarketsResponse,
} from "./velocity";

const NOW = 1_789_338_714_000; // 2026-09-13T22:31:54Z, when the fixture was read
const NEXT_HOUR = 1_789_340_400_000; // 23:00Z
const markets = marketsFixture as VelocityMarketsResponse;
const funding = fundingFixture as VelocityFundingRatesResponse;

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "velocity",
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

describe("parseVelocityMarkets", () => {
  const snapshots = parseVelocityMarkets(markets, NOW);

  test("normalizes BTC-PERP: percent per hour from the long side's P&L, as a fraction longs pay", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC-PERP")).toEqual({
      venueId: "velocity",
      venueSymbol: "BTC-PERP",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // `fundingRate` {long: "-0.008181", short: "0.008181"}: longs pay 0.008181% an hour.
      rate: 0.008181 / 100,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: NEXT_HOUR,
      kind: "predicted",
      markPrice: 76908.6,
      indexPrice: 76753.471975,
      // The larger side in base units (0.335 long against -0.0206 short; the AMM holds the rest).
      openInterestUsd: 0.335 * 76908.6,
      volume24hUsd: 354.474212,
      maxLeverage: 20,
    });
  });

  test("the hourly basis matches the premium, not a basis error", () => {
    const btc = snapshots.find((s) => s.venueSymbol === "BTC-PERP");
    // 0.008181% an hour is 71.7% APR. The mark sat 0.20% over the oracle, and the docs charge
    // that gap / 24 an hour -- 0.0084% -- so this is premium. An 8h or 24h misreading would be 9% or 3%.
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(71.67, 1);
    const premium = ((btc?.markPrice ?? 0) - (btc?.indexPrice ?? 0)) / (btc?.indexPrice ?? 1);
    expect(premium / 24).toBeCloseTo(btc?.rate ?? 0, 5);
  });

  test("keeps only active, visible perps; spot rows and closing markets are dropped", () => {
    expect(snapshots.map((s) => s.venueSymbol)).toEqual(["SOL-PERP", "BTC-PERP", "ETH-PERP"]);

    const eth = markets.markets.find((m) => m.symbol === "ETH-PERP");
    const sol = markets.markets.find((m) => m.symbol === "SOL-PERP");
    if (!eth || !sol) throw new Error("fixture changed");
    const closing = {
      success: true,
      markets: [
        { ...eth, status: "reduceonly" },
        { ...sol, uiStatus: "hidden" },
      ],
    };
    expect(parseVelocityMarkets(closing, NOW)).toEqual([]);
  });

  test("every market settles in USDT and the API declares no class", () => {
    expect(snapshots.map((s) => [s.base, s.assetClass, s.quote])).toEqual([
      ["SOL", "crypto", "USDT"],
      ["BTC", "crypto", "USDT"],
      ["ETH", "crypto", "USDT"],
    ]);
  });
});

describe("parseVelocityFundingRates", () => {
  test("quote-per-unit records become fractions over the oracle TWAP, oldest first", () => {
    const events = parseVelocityFundingRates(
      funding.records,
      "BTC-PERP",
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(events.map((e) => e.settledAt)).toEqual([
      1_789_329_660_000, 1_789_333_259_000, 1_789_336_860_000,
    ]);
    expect(events[2]).toEqual({
      venueId: "velocity",
      venueSymbol: "BTC-PERP",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      settledAt: 1_789_336_860_000,
      rate: 6.399237833 / 77333.726817,
      basisHours: 1,
      markPrice: null,
    });
    // 0.0083% an hour, the same order as the live estimate above.
    expect(events[2]?.rate).toBeCloseTo(0.0000827, 7);
  });

  test("rows outside the window are dropped", () => {
    const events = parseVelocityFundingRates(
      funding.records,
      "BTC-PERP",
      1_789_333_000_000,
      1_789_336_000_000,
    );
    expect(events.map((e) => e.settledAt)).toEqual([1_789_333_259_000]);
  });
});

describe("velocityAdapter", () => {
  test("snapshots take one request", async () => {
    const { client, urls } = fakeClient(() => markets);
    const batch = await createVelocityAdapter().fetchSnapshots(client, NOW);
    expect(urls).toEqual([`${VELOCITY_API}/stats/markets`]);
    expect(batch.snapshots).toHaveLength(3);
    expect(batch.settled).toEqual([]);
  });

  test("history pages with the cursor until it passes the window start", async () => {
    const token = funding.meta?.nextPage ?? "";
    const older = {
      success: true,
      meta: { nextPage: "more" },
      records: [{ ...funding.records[2], ts: 1_789_300_000 }],
    };
    const { client, urls } = fakeClient((url) => (url.includes("page=") ? older : funding));
    const from = 1_789_310_000_000;
    const events = await createVelocityAdapter().fetchFundingHistory?.(
      client,
      "BTC-PERP",
      from,
      NOW,
    );
    expect(urls).toEqual([
      `${VELOCITY_API}/market/BTC-PERP/fundingRates?limit=750`,
      `${VELOCITY_API}/market/BTC-PERP/fundingRates?limit=750&page=${encodeURIComponent(token)}`,
    ]);
    // The older page's row falls before `from`, so only the first page's three survive.
    expect(events).toHaveLength(3);
  });
});
