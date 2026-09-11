import { describe, expect, test } from "bun:test";
import detailFixture from "../../__fixtures__/mexc/detail.json";
import btcRateFixture from "../../__fixtures__/mexc/funding_rate_BTC_USDT.json";
import ethRateFixture from "../../__fixtures__/mexc/funding_rate_ETH_USDT.json";
import historyFixture from "../../__fixtures__/mexc/funding_rate_history_BTC_USDT.json";
import xauRateFixture from "../../__fixtures__/mexc/funding_rate_XAU_USDT.json";
import tickerFixture from "../../__fixtures__/mexc/ticker.json";
import type { HttpClient } from "../http";
import {
  createMexcAdapter,
  type IntervalEntry,
  type MexcContractDetail,
  type MexcTicker,
  nextSettlementAfter,
  parseMexcContracts,
  parseMexcFundingHistory,
  parseMexcFundingRate,
  parseMexcSnapshots,
  selectIntervalRefreshes,
} from "./mexc";

const NOW = 1_789_147_709_400; // shortly after the fixtures were recorded
const HOUR = 3_600_000;
const tickers = tickerFixture.data as MexcTicker[];
const contracts = parseMexcContracts(detailFixture.data as MexcContractDetail[]);
const rates = { BTC_USDT: btcRateFixture, ETH_USDT: ethRateFixture, XAU_USDT: xauRateFixture };

function intervalsFor(symbols: (keyof typeof rates)[]): Map<string, IntervalEntry> {
  return new Map(
    symbols.map((s) => [s, parseMexcFundingRate(rates[s].data, NOW) as IntervalEntry]),
  );
}

describe("parseMexcSnapshots", () => {
  const snapshots = parseMexcSnapshots(
    tickers,
    contracts,
    intervalsFor(["BTC_USDT", "ETH_USDT", "XAU_USDT"]),
    NOW,
  );

  test("normalizes BTC_USDT", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC_USDT")).toEqual({
      venueId: "mexc",
      venueSymbol: "BTC_USDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      dex: null,
      observedAt: NOW,
      rate: 0.000029,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_171_200_000,
      kind: "predicted",
      markPrice: 77825.6,
      indexPrice: 77863.3,
      openInterestUsd: 417583841 * 0.0001 * 77825.6,
      volume24hUsd: 4750304885.22576,
    });
  });

  test("uses the per-symbol 4h interval for XAU_USDT", () => {
    expect(snapshots.find((s) => s.venueSymbol === "XAU_USDT")).toMatchObject({
      rate: 0.000147,
      basisHours: 4,
      intervalHours: 4,
      nextFundingAt: 1_789_156_800_000,
      openInterestUsd: 63412274 * 0.001 * 4372.15,
    });
  });

  test("skips tickers without a live contract (TON_USDT) or without a known interval", () => {
    expect(snapshots.map((s) => s.venueSymbol).sort()).toEqual([
      "BTC_USDT",
      "ETH_USDT",
      "XAU_USDT",
    ]);
    const partial = parseMexcSnapshots(tickers, contracts, intervalsFor(["BTC_USDT"]), NOW);
    expect(partial.map((s) => s.venueSymbol)).toEqual(["BTC_USDT"]);
  });

  test("skips contracts that aren't in the live state", () => {
    const offline = parseMexcContracts([
      ...(detailFixture.data as MexcContractDetail[]).filter((d) => d.symbol !== "ETH_USDT"),
      { ...(detailFixture.data[1] as MexcContractDetail), state: 3 },
    ]);
    expect(offline.has("ETH_USDT")).toBe(false);
  });

  test("sizes coin-settled contracts in USD and converts coin turnover to USD", () => {
    // Values from the live BTC_USD contract: 100 USD per contract, settles and reports turnover in BTC.
    const [inverse] = parseMexcSnapshots(
      [
        {
          symbol: "BTC_USD",
          fundingRate: 0.0001,
          fairPrice: 77736.9,
          indexPrice: 77740,
          holdVol: 972359,
          amount24: 226.0459835749633,
        },
      ],
      new Map([
        [
          "BTC_USD",
          {
            symbol: "BTC_USD",
            baseCoin: "BTC",
            quoteCoin: "USD",
            settleCoin: "BTC",
            contractSize: 100,
            state: 0,
          },
        ],
      ]),
      new Map([["BTC_USD", { hours: 8, nextSettleTime: null, fetchedAt: NOW }]]),
      NOW,
    );
    expect(inverse?.openInterestUsd).toBe(972359 * 100);
    expect(inverse?.volume24hUsd).toBeCloseTo(226.0459835749633 * 77736.9, 6);
  });
});

describe("interval cache", () => {
  test("parseMexcFundingRate reads collectCycle hours and rejects missing cycles", () => {
    expect(parseMexcFundingRate(xauRateFixture.data, NOW)).toEqual({
      hours: 4,
      nextSettleTime: 1_789_156_800_000,
      fetchedAt: NOW,
    });
    expect(parseMexcFundingRate({ ...xauRateFixture.data, collectCycle: 0 }, NOW)).toBeNull();
  });

  test("selectIntervalRefreshes takes never-fetched symbols first, then the stalest, within budget", () => {
    const cache = new Map<string, IntervalEntry>([
      ["A", { hours: 8, nextSettleTime: null, fetchedAt: NOW - 7 * HOUR }],
      ["B", { hours: 8, nextSettleTime: null, fetchedAt: NOW - 9 * HOUR }],
      ["C", { hours: 8, nextSettleTime: null, fetchedAt: NOW - HOUR }],
    ]);
    const symbols = ["A", "B", "C", "D", "E"];
    expect(selectIntervalRefreshes(symbols, cache, NOW, 3)).toEqual(["D", "E", "B"]);
    expect(selectIntervalRefreshes(symbols, cache, NOW, 10)).toEqual(["D", "E", "B", "A"]);
    expect(selectIntervalRefreshes(symbols, cache, NOW, 0)).toEqual([]);
  });

  test("nextSettlementAfter rolls a stale cached settlement forward by whole intervals", () => {
    expect(nextSettlementAfter(NOW + HOUR, 8, NOW)).toBe(NOW + HOUR);
    expect(nextSettlementAfter(NOW - HOUR, 4, NOW)).toBe(NOW + 3 * HOUR);
    expect(nextSettlementAfter(NOW - 9 * HOUR, 4, NOW)).toBe(NOW + 3 * HOUR);
    expect(nextSettlementAfter(null, 8, NOW)).toBeNull();
  });
});

function fakeClient() {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "mexc",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      if (url.endsWith("/detail")) return detailFixture as T;
      if (url.endsWith("/ticker")) return tickerFixture as T;
      const symbol = url.split("/funding_rate/")[1] as keyof typeof rates;
      if (rates[symbol]) return rates[symbol] as T;
      if (url.includes("/funding_rate/history")) return historyFixture as T;
      throw new Error(`unexpected url ${url}`);
    },
    postJson: async () => {
      throw new Error("unused");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
  return { client, urls };
}

describe("createMexcAdapter", () => {
  test("fills intervals within the per-cycle budget and caches contract details", async () => {
    const adapter = createMexcAdapter({ intervalRefreshBudget: 2 });
    const { client, urls } = fakeClient();

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(first.snapshots.map((s) => s.venueSymbol)).toEqual(["BTC_USDT", "ETH_USDT"]);
    expect(urls.filter((u) => u.includes("/funding_rate/"))).toHaveLength(2);

    const second = await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(second.snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTC_USDT",
      "ETH_USDT",
      "XAU_USDT",
    ]);
    expect(urls.filter((u) => u.endsWith("/detail"))).toHaveLength(1);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 7 * HOUR);
    expect(urls.filter((u) => u.endsWith("/detail"))).toHaveLength(1); // details older than 1h refetched
    expect(urls.filter((u) => u.includes("/funding_rate/"))).toHaveLength(2); // two stalest intervals refreshed
  });

  test("warmUp emits known markets on the first cycle, without spending the budget", async () => {
    const adapter = createMexcAdapter({ intervalRefreshBudget: 0 });
    const { client, urls } = fakeClient();
    adapter.warmUp?.([
      { venueSymbol: "BTC_USDT", intervalHours: 8 },
      { venueSymbol: "ETH_USDT", intervalHours: 8 },
      { venueSymbol: "XAU_USDT", intervalHours: 4 },
      { venueSymbol: "DELISTED_USDT", intervalHours: 8 },
      { venueSymbol: "NO_INTERVAL_USDT", intervalHours: null },
    ]);

    const batch = await adapter.fetchSnapshots(client, NOW);

    // All three live markets appear immediately, with no per-symbol funding_rate calls at all.
    expect(batch.snapshots.map((s) => s.venueSymbol).sort()).toEqual([
      "BTC_USDT",
      "ETH_USDT",
      "XAU_USDT",
    ]);
    expect(urls.filter((u) => u.includes("/funding_rate/"))).toHaveLength(0);
    // The warmed interval is used, not a guess.
    expect(batch.snapshots.find((s) => s.venueSymbol === "XAU_USDT")?.basisHours).toBe(4);
    // A market MEXC no longer lists is dropped rather than kept alive by the warm-up.
    expect(batch.snapshots.map((s) => s.venueSymbol)).not.toContain("DELISTED_USDT");
  });

  test("fetchFundingHistory returns settlements oldest first", async () => {
    const { client } = fakeClient();
    const events = await createMexcAdapter().fetchFundingHistory?.(
      client,
      "BTC_USDT",
      1_789_056_000_000,
      1_789_142_400_000,
    );
    expect(events?.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_056_000_000, 0.000071, 8],
      [1_789_084_800_000, 0.00003, 8],
      [1_789_113_600_000, 0.000061, 8],
      [1_789_142_400_000, 0.000036, 8],
    ]);
  });
});

describe("parseMexcFundingHistory", () => {
  test("filters the window and dedupes settlements", () => {
    const rows = historyFixture.data.resultList;
    const events = parseMexcFundingHistory(
      [...rows, rows[0] as (typeof rows)[number]],
      "BTC_USDT",
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({
      venueId: "mexc",
      base: "BTC",
      settledAt: 1_789_027_200_000,
      rate: 0.000079,
    });
  });
});
