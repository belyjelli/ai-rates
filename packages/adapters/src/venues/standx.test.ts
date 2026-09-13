import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import historyFixture from "../../__fixtures__/standx/query_funding_rates_BTC-USD.json";
import overviewFixture from "../../__fixtures__/standx/query_market_overview.json";
import symbolInfoFixture from "../../__fixtures__/standx/query_symbol_info.json";
import type { HttpClient } from "../http";
import {
  createStandxAdapter,
  parseStandxFundingHistory,
  parseStandxSnapshots,
  STANDX_API,
  STANDX_ASSET_TAGS,
  type StandxOverview,
  type StandxSymbolInfo,
  standxAssetClass,
  standxTradable,
} from "./standx";

/** Real responses from StandX on 2026-09-14 (22:12 UTC), trimmed to six markets. */
const overview: StandxOverview = overviewFixture;
const symbolInfo: StandxSymbolInfo[] = symbolInfoFixture;
const NOW = Date.parse("2026-09-13T22:12:33Z");
const HOUR = 3_600_000;
const NEXT = Date.parse("2026-09-13T23:00:00Z");

describe("parseStandxSnapshots", () => {
  test("normalizes BTC fully: hourly predicted rate, DUSD quote, notional OI", () => {
    const snapshots = parseStandxSnapshots(overview, standxTradable(symbolInfo), NOW);
    expect(snapshots[0]).toEqual({
      venueId: "standx",
      venueSymbol: "BTC-USD",
      base: "BTC",
      assetClass: "crypto",
      quote: "DUSD",
      multiplier: 1,
      dex: null,
      observedAt: NOW,
      rate: 0.00000838,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: NEXT,
      kind: "predicted",
      markPrice: 76938.01,
      indexPrice: null,
      openInterestUsd: 29562753.288012,
      volume24hUsd: Number("264001802.08615624904632568357"),
      maxLeverage: 40,
    });
  });

  test("the notional OI is base x mark, so no conversion is applied", () => {
    const btc = overview.symbols[0];
    expect(Number(btc?.open_interest) * Number(btc?.mark_price)).toBeCloseTo(
      Number(btc?.open_interest_notional),
      0,
    );
  });

  test("an hourly rate annualises over one hour: 0.00000838 is 7.34% APR", () => {
    const btc = parseStandxSnapshots(overview, standxTradable(symbolInfo), NOW)[0];
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(7.34088, 5);
  });

  test("next funding is the next top of the hour, even exactly on one", () => {
    const tradable = standxTradable(symbolInfo);
    expect(parseStandxSnapshots(overview, tradable, NEXT - 1)[0]?.nextFundingAt).toBe(NEXT);
    expect(parseStandxSnapshots(overview, tradable, NEXT)[0]?.nextFundingAt).toBe(NEXT + HOUR);
  });

  test("only markets `query_symbol_info` lists as trading", () => {
    const halted = symbolInfo.map((s) => (s.symbol === "UNI-USD" ? { ...s, status: "halted" } : s));
    const withoutEth = halted.filter((s) => s.symbol !== "ETH-USD");
    expect(
      parseStandxSnapshots(overview, standxTradable(withoutEth), NOW).map((s) => s.venueSymbol),
    ).toEqual(["BTC-USD", "XAU-USD", "CL-USD", "TSLA-USD"]);
  });
});

describe("asset class", () => {
  test("from the web app's SymbolAssetTag declaration", () => {
    const classes = parseStandxSnapshots(overview, standxTradable(symbolInfo), NOW).map((s) => [
      s.venueSymbol,
      s.base,
      s.assetClass,
    ]);
    expect(classes).toEqual([
      ["BTC-USD", "BTC", "crypto"],
      ["ETH-USD", "ETH", "crypto"],
      ["XAU-USD", "XAU", "commodity"],
      ["UNI-USD", "UNI", "crypto"],
      ["CL-USD", "CL", "commodity"],
      ["TSLA-USD", "TSLA", "equity"],
    ]);
  });

  test("covers all 13 markets as the bundle had them, and an unlisted market declares nothing", () => {
    const counts = Object.values(STANDX_ASSET_TAGS).reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ Crypto: 7, Commodities: 3, Stocks: 3 });
    expect(standxAssetClass("MU-USD")).toBe("equity");
    expect(standxAssetClass("NVDA-USD")).toBe("crypto");
  });
});

describe("parseStandxFundingHistory", () => {
  test("hourly settlements inside the window, oldest first, at a 1-hour basis", () => {
    const events = parseStandxFundingHistory(
      historyFixture,
      "BTC-USD",
      "DUSD",
      NEXT - 3 * HOUR,
      NEXT - 2 * HOUR,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours, e.markPrice, e.quote])).toEqual([
      [NEXT - 3 * HOUR, 0.00001222, 1, 77244.46, "DUSD"],
      [NEXT - 2 * HOUR, 0.0000125, 1, 77324.79, "DUSD"],
    ]);
  });

  test("the settled 22:00 rate differs from the live estimate read twelve minutes later", () => {
    expect(historyFixture.at(-1)?.funding_rate).toBe("0.00000873");
    expect(overview.symbols[0]?.funding_rate).toBe("0.00000838");
  });
});

function fakeClient(urls: string[]): HttpClient {
  return {
    venueId: "standx",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      const path = url.slice(STANDX_API.length).split("?")[0];
      if (path === "/query_symbol_info") return symbolInfoFixture as T;
      if (path === "/query_market_overview") return overviewFixture as T;
      if (path === "/query_funding_rates") return historyFixture as T;
      throw new Error(`unexpected ${url}`);
    },
    postJson: async () => {
      throw new Error("unexpected POST");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
}

describe("standxAdapter", () => {
  test("one call a cycle, with symbol info refreshed hourly", async () => {
    const urls: string[] = [];
    const client = fakeClient(urls);
    const adapter = createStandxAdapter();

    await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    const batch = await adapter.fetchSnapshots(client, NOW + HOUR);

    const info = `${STANDX_API}/query_symbol_info`;
    const ov = `${STANDX_API}/query_market_overview`;
    expect(urls).toEqual([info, ov, ov, info, ov]);
    expect(adapter.venueId).toBe("standx");
    expect(batch.snapshots).toHaveLength(6);
    expect(batch.settled).toEqual([]);
  });

  test("history walks the range in 30-day windows of millisecond bounds", async () => {
    const urls: string[] = [];
    const adapter = createStandxAdapter();
    const from = NEXT - 45 * 24 * HOUR;
    const to = NEXT - HOUR;
    const events = await adapter.fetchFundingHistory?.(fakeClient(urls), "BTC-USD", from, to);

    const windowEnd = from + 30 * 24 * HOUR - 1;
    expect(urls).toEqual([
      `${STANDX_API}/query_symbol_info`,
      `${STANDX_API}/query_funding_rates?symbol=BTC-USD&start_time=${from}&end_time=${windowEnd}`,
      `${STANDX_API}/query_funding_rates?symbol=BTC-USD&start_time=${windowEnd + 1}&end_time=${to}`,
    ]);
    // Both windows answered the same three rows; each settlement is kept once.
    expect(events?.map((e) => e.settledAt)).toEqual([
      NEXT - 3 * HOUR,
      NEXT - 2 * HOUR,
      NEXT - HOUR,
    ]);
    expect(events?.[0]?.quote).toBe("DUSD");
  });
});
