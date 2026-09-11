import { describe, expect, test } from "bun:test";
import type { FundingSnapshot } from "@ai-rates/core";
import exchangeInfoFixture from "../../__fixtures__/aster/exchangeInfo.json";
import fundingInfoFixture from "../../__fixtures__/aster/fundingInfo.json";
import historyFixture from "../../__fixtures__/aster/fundingRate_BTCUSDT.json";
import premiumFixture from "../../__fixtures__/aster/premiumIndex.json";
import tickerFixture from "../../__fixtures__/aster/ticker24hr.json";
import type { HttpClient } from "../http";
import {
  attachOpenInterest,
  basisHoursFromGaps,
  createAsterAdapter,
  type OpenInterestEntry,
  parseBinanceStyleFundingHistory,
  parseBinanceStyleSnapshots,
  tradablePerpetuals,
} from "./aster";

const NOW = 1_789_147_709_400;
const HOUR = 3_600_000;
const tradable = tradablePerpetuals(exchangeInfoFixture);
const input = {
  premium: premiumFixture,
  fundingInfo: fundingInfoFixture,
  tickers: tickerFixture,
  tradable,
  defaultIntervalHours: null,
};

describe("parseBinanceStyleSnapshots (aster)", () => {
  const snapshots = parseBinanceStyleSnapshots("aster", input, NOW);

  test("normalizes BTCUSDT", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTCUSDT")).toEqual({
      venueId: "aster",
      venueSymbol: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      dex: null,
      observedAt: NOW,
      rate: 0.00003274,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_171_200_000,
      kind: "predicted",
      markPrice: 77852.06061232,
      indexPrice: 77866.89217391,
      openInterestUsd: null,
      volume24hUsd: 1059790811.37,
    });
  });

  test("uses the 1h interval from fundingInfo for SUSHIUSDT", () => {
    expect(snapshots.find((s) => s.venueSymbol === "SUSHIUSDT")).toMatchObject({
      rate: -0.00000112,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_149_600_000,
      volume24hUsd: 12455.67,
    });
  });

  test("skips symbols that aren't TRADING perpetuals in exchangeInfo (BTCUSD, GNSUSD)", () => {
    expect(snapshots.map((s) => s.venueSymbol).sort()).toEqual(["BTCUSDT", "ETHUSDT", "SUSHIUSDT"]);
    const settling = tradablePerpetuals({
      symbols: [{ symbol: "TONUSDT", status: "SETTLING", contractType: "PERPETUAL" }],
    });
    expect(settling.size).toBe(0);
  });

  test("skips symbols missing from fundingInfo unless a default interval is given", () => {
    const withoutEth = {
      ...input,
      fundingInfo: fundingInfoFixture.filter((i) => i.symbol !== "ETHUSDT"),
    };
    expect(
      parseBinanceStyleSnapshots("aster", withoutEth, NOW).map((s) => s.venueSymbol),
    ).not.toContain("ETHUSDT");
    const binanceLike = parseBinanceStyleSnapshots(
      "binance",
      { ...withoutEth, defaultIntervalHours: 8 },
      NOW,
    );
    expect(binanceLike.find((s) => s.venueSymbol === "ETHUSDT")).toMatchObject({
      venueId: "binance",
      basisHours: 8,
    });
  });
});

describe("funding history", () => {
  test("basisHoursFromGaps uses the nearest neighbour and survives a missed settlement", () => {
    const t0 = 1_789_027_200_000;
    expect(basisHoursFromGaps([t0, t0 + 8 * HOUR, t0 + 24 * HOUR, t0 + 32 * HOUR], null)).toEqual([
      8, 8, 8, 8,
    ]);
    expect(basisHoursFromGaps([t0, t0 + 8 * HOUR, t0 + 12 * HOUR, t0 + 16 * HOUR], null)).toEqual([
      8, 4, 4, 4,
    ]);
    expect(basisHoursFromGaps([t0], 4)).toEqual([4]);
    expect(basisHoursFromGaps([t0], null)).toEqual([null]);
  });

  test("parses BTCUSDT settlements oldest first with 8h basis", () => {
    const shuffled = [...historyFixture].reverse();
    const events = parseBinanceStyleFundingHistory(
      "aster",
      "BTCUSDT",
      shuffled,
      0,
      Number.MAX_SAFE_INTEGER,
      null,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_027_200_000, 0.00008093, 8],
      [1_789_056_000_000, 0.00006482, 8],
      [1_789_084_800_000, 0.00004447, 8],
      [1_789_113_600_000, 0.00004761, 8],
      [1_789_142_400_000, 0.00002863, 8],
    ]);
    expect(events[0]).toMatchObject({
      venueId: "aster",
      base: "BTC",
      quote: "USDT",
      markPrice: null,
    });
  });
});

describe("attachOpenInterest", () => {
  const snapshots = parseBinanceStyleSnapshots("aster", input, NOW);

  test("prices contracts with the venue's own per-contract mark", () => {
    const cache = new Map<string, OpenInterestEntry>([
      ["BTCUSDT", { contracts: 6052.531, fetchedAt: NOW }],
    ]);
    const attached = attachOpenInterest(snapshots, cache);
    expect(attached.find((s) => s.venueSymbol === "BTCUSDT")?.openInterestUsd).toBeCloseTo(
      6052.531 * 77852.06061232,
      4,
    );
    // Symbols not yet in the rotation keep a null rather than a wrong number.
    expect(attached.find((s) => s.venueSymbol === "ETHUSDT")?.openInterestUsd).toBeNull();
  });
});

describe("createAsterAdapter", () => {
  test("fetches bulk endpoints and caches exchangeInfo for an hour", async () => {
    const urls: string[] = [];
    const bodies: Record<string, unknown> = {
      exchangeInfo: exchangeInfoFixture,
      premiumIndex: premiumFixture,
      fundingInfo: fundingInfoFixture,
      "ticker/24hr": tickerFixture,
    };
    const client: HttpClient = {
      venueId: "aster",
      async getJson<T>(url: string): Promise<T> {
        urls.push(url);
        const key = url.split("/fapi/v1/")[1]?.split("?")[0] as string;
        if (key === "fundingRate") return historyFixture as T;
        if (key === "openInterest") {
          const symbol = new URL(url).searchParams.get("symbol") as string;
          return { symbol, openInterest: "1000", time: NOW } as T;
        }
        if (!(key in bodies)) throw new Error(`unexpected ${url}`);
        return bodies[key] as T;
      },
      postJson: async () => {
        throw new Error("unused");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    };
    const adapter = createAsterAdapter();

    const batch = await adapter.fetchSnapshots(client, NOW);
    expect(batch.snapshots).toHaveLength(3);
    await adapter.fetchSnapshots(client, NOW + 30 * 60_000);
    expect(urls.filter((u) => u.endsWith("/exchangeInfo"))).toHaveLength(1);
    await adapter.fetchSnapshots(client, NOW + HOUR);
    expect(urls.filter((u) => u.endsWith("/exchangeInfo"))).toHaveLength(2);

    const events = await adapter.fetchFundingHistory?.(
      client,
      "BTCUSDT",
      1_789_027_200_000,
      1_789_142_400_000,
    );
    expect(events?.map((e) => e.settledAt)).toEqual(historyFixture.map((r) => r.fundingTime));
  });

  test("fills open interest a slice at a time and reuses it between refreshes", async () => {
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "aster",
      async getJson<T>(url: string): Promise<T> {
        urls.push(url);
        const key = url.split("/fapi/v1/")[1]?.split("?")[0] as string;
        if (key === "openInterest") {
          const symbol = new URL(url).searchParams.get("symbol") as string;
          return { symbol, openInterest: "1000", time: NOW } as T;
        }
        const bodies: Record<string, unknown> = {
          exchangeInfo: exchangeInfoFixture,
          premiumIndex: premiumFixture,
          fundingInfo: fundingInfoFixture,
          "ticker/24hr": tickerFixture,
        };
        return bodies[key] as T;
      },
      postJson: async () => {
        throw new Error("unused");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    };
    const adapter = createAsterAdapter({ openInterestBudget: 1 });

    const oiCalls = () => urls.filter((u) => u.includes("/openInterest"));
    const symbolOf = (url: string) => new URL(url).searchParams.get("symbol") as string;
    const withOi = (batch: { snapshots: FundingSnapshot[] }) =>
      batch.snapshots.filter((s) => s.openInterestUsd !== null);

    // One symbol per cycle, in the order the venue lists them.
    const first = await adapter.fetchSnapshots(client, NOW);
    expect(oiCalls()).toHaveLength(1);
    const firstSymbol = symbolOf(oiCalls()[0] as string);
    const filled = withOi(first);
    expect(filled.map((s) => s.venueSymbol)).toEqual([firstSymbol]);
    expect(filled[0]?.openInterestUsd).toBeCloseTo(1000 * (filled[0]?.markPrice as number), 4);

    // Later cycles take the next never-fetched symbol and keep what is already known.
    expect(withOi(await adapter.fetchSnapshots(client, NOW + 60_000))).toHaveLength(2);
    expect(withOi(await adapter.fetchSnapshots(client, NOW + 2 * 60_000))).toHaveLength(3);
    expect(oiCalls()).toHaveLength(3);

    // Nothing is re-read inside the max age; past it the stalest symbol goes first.
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 3 * 60_000);
    expect(oiCalls()).toHaveLength(0);
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 6 * 60_000);
    expect(oiCalls().map(symbolOf)).toEqual([firstSymbol]);
  });
});
