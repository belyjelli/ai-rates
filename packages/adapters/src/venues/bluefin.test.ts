import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import infoFixture from "../../__fixtures__/bluefin/exchange-info.json";
import historyFixture from "../../__fixtures__/bluefin/fundingRateHistory-BTC-PERP.json";
import ethHistoryAfter from "../../__fixtures__/bluefin/fundingRateHistory-ETH-PERP-after-2300.json";
import tickersFixture from "../../__fixtures__/bluefin/tickers.json";
import tickersAfter from "../../__fixtures__/bluefin/tickers-after-2300.json";
import type { HttpClient } from "../http";
import {
  BLUEFIN_API,
  type BluefinExchangeInfo,
  type BluefinFundingRow,
  type BluefinTicker,
  createBluefinAdapter,
  e9,
  parseBluefinFundingHistory,
  parseBluefinTickers,
} from "./bluefin";

const NOW = 1_789_339_040_000; // 2026-09-13T22:37:20Z, just after the tickers' updatedAtMillis
const info = infoFixture as BluefinExchangeInfo;
const tickers = tickersFixture as BluefinTicker[];
const history = historyFixture as BluefinFundingRow[];

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "bluefin",
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
  if (url.endsWith("/exchange/info")) return info;
  if (url.endsWith("/exchange/tickers")) return tickers;
  if (url.includes("/exchange/fundingRateHistory?")) return history;
  throw new Error(`unexpected ${url}`);
}

describe("parseBluefinTickers", () => {
  const { snapshots, settled } = parseBluefinTickers(tickers, info.markets, NOW);

  test("normalizes BTC-PERP from e9 fixed point: the running estimate, predicted", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC-PERP")).toEqual({
      venueId: "bluefin",
      venueSymbol: "BTC-PERP",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.000014466,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
      kind: "predicted",
      markPrice: 76784.5,
      indexPrice: 76813.3,
      // openInterestE9 is USD notional already.
      openInterestUsd: 101969.816,
      volume24hUsd: 226540.5836,
    });
  });

  test("the last settled rate rides along at the top of the previous hour", () => {
    expect(settled.find((e) => e.venueSymbol === "BTC-PERP")).toEqual({
      venueId: "bluefin",
      venueSymbol: "BTC-PERP",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      settledAt: 1_789_336_800_000,
      rate: 0.0000125,
      basisHours: 1,
      markPrice: null,
    });
    // The same settlement as history's newest row, stamped 51ms past the hour.
    expect(history[0]).toMatchObject({
      fundingRateE9: "12500",
      fundingTimeAtMillis: 1_789_336_800_051,
    });
  });

  test("an hourly 0.0000125 settlement is 10.95% APR, Hyperliquid's floor", () => {
    const btc = settled.find((e) => e.venueSymbol === "BTC-PERP");
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(10.95, 2);
  });

  test("only ACTIVE markets from exchange info; class crypto, GOLD reaching XAU", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.assetClass])).toEqual([
      ["BTC-PERP", "BTC", "crypto"],
      ["DEEP-PERP", "DEEP", "crypto"],
      ["ETH-PERP", "ETH", "crypto"],
      // Bluefin declares no class, so GOLD stays crypto (and out of the commodity XAU pool).
      ["GOLD-PERP", "XAU", "crypto"],
    ]);
    const halted = info.markets.map((m) =>
      m.symbol === "DEEP-PERP" ? { ...m, status: "DELISTED" } : m,
    );
    expect(
      parseBluefinTickers(tickers, halted, NOW).snapshots.map((s) => s.venueSymbol),
    ).not.toContain("DEEP-PERP");
    expect(parseBluefinTickers(tickers, [], NOW).snapshots).toEqual([]);
  });

  test("e9 fixed point", () => {
    expect(e9("76784500000000")).toBe(76784.5);
    expect(e9("-17938")).toBe(-0.000017938);
    expect(e9(null)).toBeNull();
  });
});

describe("Bluefin funding history", () => {
  test("newest-first rows become oldest-first settlements snapped to the hour", () => {
    const events = parseBluefinFundingHistory(history, "BTC-PERP", 0, Number.MAX_SAFE_INTEGER);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_322_400_000, 0.0000125, 1],
      [1_789_326_000_000, 0.0000125, 1],
      [1_789_329_600_000, 0.0000125, 1],
      [1_789_333_200_000, 0.0000125, 1],
      [1_789_336_800_000, 0.0000125, 1],
    ]);
  });

  test("fetchSnapshots: exchange info once an hour, tickers every cycle", async () => {
    const { client, urls } = fakeClient(respond);
    const adapter = createBluefinAdapter();
    const batch = await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toEqual([
      `${BLUEFIN_API}/exchange/info`,
      `${BLUEFIN_API}/exchange/tickers`,
      `${BLUEFIN_API}/exchange/tickers`,
    ]);
    expect(batch.snapshots).toHaveLength(4);
    expect(batch.settled).toHaveLength(4);
  });

  test("history widens the window by an hour each side and filters back to it", async () => {
    const { client, urls } = fakeClient(respond);
    const events = await createBluefinAdapter().fetchFundingHistory?.(
      client,
      "BTC-PERP",
      1_789_326_000_000,
      1_789_337_000_000,
    );
    expect(urls).toEqual([
      `${BLUEFIN_API}/exchange/fundingRateHistory?symbol=BTC-PERP&startTimeAtMillis=1789322400000&endTimeAtMillis=1789340600000&limit=1000&page=1`,
    ]);
    expect(events?.map((e) => e.settledAt)).toEqual([
      1_789_326_000_000, 1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000,
    ]);
  });

  test("pages while pages are full", async () => {
    const hour = 3_600_000;
    const top = 1_789_336_800_000;
    const page = (newest: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        symbol: "BTC-PERP",
        fundingRateE9: "12500",
        fundingTimeAtMillis: newest - i * hour + 51,
      }));
    const { client, urls } = fakeClient((url) =>
      url.endsWith("page=1") ? page(top, 1000) : page(top - 1000 * hour, 4),
    );
    const events = await createBluefinAdapter().fetchFundingHistory?.(
      client,
      "BTC-PERP",
      top - 1003 * hour,
      top,
    );
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain("page=2");
    expect(events).toHaveLength(1004);
  });
});

describe("Bluefin across the 23:00 settlement (2026-09-13)", () => {
  /** estimatedFundingRateE9 read at 22:59:33, the last poll before the hour. */
  const ESTIMATE_AT_2259 = { "ETH-PERP": 143739, "DEEP-PERP": 428114, "GOLD-PERP": 241585 };

  test("what settles is the estimate, so the estimate is the predicted rate", () => {
    const { settled } = parseBluefinTickers(
      tickersAfter as BluefinTicker[],
      info.markets,
      1_789_340_538_000,
    );
    for (const [symbol, estimate] of Object.entries(ESTIMATE_AT_2259)) {
      const event = settled.find((e) => e.venueSymbol === symbol);
      expect(event?.settledAt).toBe(1_789_340_400_000);
      // Within 2% of the estimate one minute earlier: ETH 142061, DEEP 426068, GOLD 238732.
      expect(Math.abs((event?.rate ?? 0) * 1e9 - estimate) / estimate).toBeLessThan(0.02);
    }
  });

  test("the ticker's settled event and history's row 2.48s past the hour are one settlement", () => {
    const { settled } = parseBluefinTickers(
      tickersAfter as BluefinTicker[],
      info.markets,
      1_789_340_538_000,
    );
    const fromHistory = parseBluefinFundingHistory(
      ethHistoryAfter as BluefinFundingRow[],
      "ETH-PERP",
      1_789_340_000_000,
      1_789_341_000_000,
    );
    expect(fromHistory).toEqual(settled.filter((e) => e.venueSymbol === "ETH-PERP"));
    expect(fromHistory[0]?.rate).toBe(0.000142061);
  });
});
