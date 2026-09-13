import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import funding6 from "../../__fixtures__/polymarket/funding-6.json";
import instrumentsFixture from "../../__fixtures__/polymarket/instruments.json";
import statisticsFixture from "../../__fixtures__/polymarket/statistics.json";
import tickersFixture from "../../__fixtures__/polymarket/tickers.json";
import type { HttpClient } from "../http";
import {
  createPolymarketAdapter,
  POLYMARKET_API,
  type PolymarketFundingPage,
  type PolymarketInstrument,
  type PolymarketStatistic,
  type PolymarketTicker,
  parsePolymarketFunding,
  parsePolymarketSnapshots,
  polymarketAssetClass,
  polymarketIntervalHours,
} from "./polymarket";

const NOW = 1_789_338_398_739; // 2026-09-13T22:26:38Z, the tickers' own timestamp
const instruments = instrumentsFixture as PolymarketInstrument[];
const tickers = tickersFixture as PolymarketTicker[];
const statistics = statisticsFixture as PolymarketStatistic[];

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "polymarket",
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
  if (url.endsWith("/instruments")) return instruments;
  if (url.endsWith("/tickers")) return tickers;
  if (url.endsWith("/statistics")) return statistics;
  if (url.includes("/funding?")) return funding6;
  throw new Error(`unexpected ${url}`);
}

describe("parsePolymarketSnapshots", () => {
  const snapshots = parsePolymarketSnapshots(instruments, tickers, statistics, NOW);

  test("normalizes BTC-USD as a predicted hourly rate settling in pUSD", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USD")).toEqual({
      venueId: "polymarket",
      venueSymbol: "BTC-USD",
      base: "BTC",
      quote: "PUSD",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.0000125,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
      kind: "predicted",
      markPrice: 76770,
      indexPrice: 76793,
      // open_interest is contracts of one BTC each, valued at mark.
      openInterestUsd: 114.13806 * 76770,
      volume24hUsd: 1853965.1945999996,
      maxLeverage: 20,
    });
  });

  test("BTC at the 0.01%/8h floor per hour is ~10.95% APR, where Hyperliquid read 10.1%", () => {
    const btc = snapshots.find((s) => s.venueSymbol === "BTC-USD");
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(10.95, 2);
  });

  test("every instrument in both lists is collected", () => {
    expect(snapshots.map((s) => s.venueSymbol)).toEqual(tickers.map((t) => t.symbol));
  });

  test("an instrument that is not a perpetual, or has no ticker, is skipped", () => {
    const btc = instruments.find((i) => i.symbol === "BTC-USD") as PolymarketInstrument;
    const notPerp = { ...btc, instrument_type: "future" };
    expect(parsePolymarketSnapshots([notPerp], tickers, statistics, NOW)).toEqual([]);
    expect(parsePolymarketSnapshots(instruments, [], statistics, NOW)).toEqual([]);
  });

  test("class from category, base from the declaration where the parser disagrees", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.assetClass, s.quote])).toEqual([
      // index: core's table keeps SP500 (aliased to US500) an index.
      ["SP500-USD", "US500", "index", "PUSD"],
      // GOLD reaches XAU through core's alias.
      ["GOLD-USD", "XAU", "commodity", "PUSD"],
      ["WTIOIL-USD", "CL", "commodity", "PUSD"],
      ["BTC-USD", "BTC", "crypto", "PUSD"],
      ["ETH-USD", "ETH", "crypto", "PUSD"],
      // Declared base_asset GOOGL, parsed GOOG: the declaration wins.
      ["GOOG-USD", "GOOGL", "equity", "PUSD"],
      // Declared index; DRAM is an ETF, so core's table files it as equity.
      ["DRAM-USD", "DRAM", "equity", "PUSD"],
      // Uppercase K is not a multiplier to the parser, and the venue declares none.
      ["KPEPE-USD", "KPEPE", "crypto", "PUSD"],
      ["MSTR-USD", "MSTR", "equity", "PUSD"],
      // A memecoin Polymarket declares as equity; the declaration is kept (see header).
      ["PONS-USD", "PONS", "equity", "PUSD"],
    ]);
  });

  test("non-crypto quiet markets sit on half the crypto floor", () => {
    const gold = snapshots.find((s) => s.venueSymbol === "GOLD-USD");
    expect(gold?.rate).toBe(0.00000625);
  });
});

describe("polymarketAssetClass and interval", () => {
  test("unknown non-crypto categories fall to the base tables, never throw", () => {
    expect(polymarketAssetClass("crypto", "BTC")).toBe("crypto");
    expect(polymarketAssetClass(null, "BTC")).toBe("crypto");
    expect(polymarketAssetClass("forex", "EURUSD")).toBe("fx");
    expect(polymarketAssetClass("something-new", "XAG")).toBe("commodity");
  });

  test("funding_interval strings", () => {
    expect(polymarketIntervalHours("1h")).toBe(1);
    expect(polymarketIntervalHours("8h")).toBe(8);
    expect(polymarketIntervalHours("30m")).toBeNull();
    expect(polymarketIntervalHours(undefined)).toBeNull();
  });
});

describe("Polymarket funding history", () => {
  const btc = instruments.find((i) => i.symbol === "BTC-USD") as PolymarketInstrument;

  test("newest-first rows become oldest-first hourly settlements", () => {
    const events = parsePolymarketFunding(
      (funding6 as PolymarketFundingPage).data,
      btc,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_322_400_060, 0.0000125, 1],
      [1_789_326_000_052, 0.0000125, 1],
      [1_789_329_600_027, 0.0000125, 1],
      [1_789_333_200_084, 0.0000125, 1],
      [1_789_336_800_106, 0.0000125, 1],
    ]);
    expect(events[0]).toMatchObject({ venueId: "polymarket", base: "BTC", quote: "PUSD" });
  });

  test("fetchSnapshots asks for instruments once an hour, tickers and statistics every cycle", async () => {
    const { client, urls } = fakeClient(respond);
    const adapter = createPolymarketAdapter();
    const first = await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toEqual([
      `${POLYMARKET_API}/instruments`,
      `${POLYMARKET_API}/tickers`,
      `${POLYMARKET_API}/statistics`,
      `${POLYMARKET_API}/tickers`,
      `${POLYMARKET_API}/statistics`,
    ]);
    expect(first.snapshots).toHaveLength(10);
    expect(first.settled).toEqual([]);
  });

  test("history addresses the instrument by id and stops when `more` is false", async () => {
    const { client, urls } = fakeClient(respond);
    const events = await createPolymarketAdapter().fetchFundingHistory?.(
      client,
      "BTC-USD",
      1_789_322_000_000,
      1_789_337_000_000,
    );
    expect(urls).toEqual([
      `${POLYMARKET_API}/instruments`,
      `${POLYMARKET_API}/funding?instrument_id=6&start_timestamp=1789322000000&end_timestamp=1789337000000`,
    ]);
    expect(events).toHaveLength(5);
  });

  test("pages back by end_timestamp while `more` is true", async () => {
    const hour = 3_600_000;
    const top = 1_789_336_800_000;
    const page = (newest: number, count: number, more: boolean) => ({
      data: Array.from({ length: count }, (_, i) => ({
        funding_rate: "0.00001",
        timestamp: newest - i * hour,
      })),
      more,
    });
    let calls = 0;
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/instruments")) return instruments;
      calls++;
      return calls === 1 ? page(top, 100, true) : page(top - 100 * hour, 3, false);
    });
    const events = await createPolymarketAdapter().fetchFundingHistory?.(
      client,
      "BTC-USD",
      top - 102 * hour,
      top,
    );
    expect(urls).toHaveLength(3);
    expect(urls[2]).toContain(`end_timestamp=${top - 99 * hour - 1}`);
    expect(events).toHaveLength(103);
  });

  test("an unknown symbol returns no history", async () => {
    const { client } = fakeClient(respond);
    expect(await createPolymarketAdapter().fetchFundingHistory?.(client, "NOPE-USD", 0, 1)).toEqual(
      [],
    );
  });
});
