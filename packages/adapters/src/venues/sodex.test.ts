import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import symbolsFixture from "../../__fixtures__/sodex/markets_symbols.json";
import tickersFixture from "../../__fixtures__/sodex/markets_tickers.json";
import type { HttpClient } from "../http";
import {
  createSodexAdapter,
  parseSodexSnapshots,
  SODEX_API,
  type SodexSymbol,
  type SodexTicker,
  sodexTradable,
} from "./sodex";

/** Real responses from SoDEX on 2026-09-14 (22:12 UTC), trimmed to nine markets, two of them HALT. */
const tickers: SodexTicker[] = tickersFixture.data;
const symbols: SodexSymbol[] = symbolsFixture.data;
const NOW = 1_789_337_554_584;
const NEXT = 1_789_340_400_000;

describe("parseSodexSnapshots", () => {
  test("normalizes BTC fully: hourly predicted rate, vUSDC quote, base OI at the mark", () => {
    const snapshots = parseSodexSnapshots(tickers, sodexTradable(symbols), NOW);
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USD")).toEqual({
      venueId: "sodex",
      venueSymbol: "BTC-USD",
      base: "BTC",
      assetClass: "crypto",
      quote: "vUSDC",
      multiplier: 1,
      dex: null,
      observedAt: NOW,
      rate: 0.0000074662435927,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: NEXT,
      kind: "predicted",
      markPrice: 76922,
      indexPrice: 76955,
      openInterestUsd: 772.14798 * 76922,
      volume24hUsd: 108497684.26855,
      bestBid: 76929,
      bestBidSizeUsd: 1.87019 * 76929,
      bestAsk: 76930,
      bestAskSizeUsd: 1.92897 * 76930,
      maxLeverage: 40,
    });
  });

  test("an hourly rate annualises over one hour: 0.0000074662 is 6.54% APR", () => {
    const btc = parseSodexSnapshots(tickers, sodexTradable(symbols), NOW).find(
      (s) => s.venueSymbol === "BTC-USD",
    );
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(6.54043, 5);
  });

  test("skips HALT markets, even those still in tickers with a stale funding time", () => {
    const halted = tickers.filter((t) => t.symbol === "TON-USD" || t.symbol === "BASED-USD");
    expect(halted.map((t) => t.nextFundingTime)).toEqual([1_781_769_600_000, 1_782_576_000_000]);
    expect(
      parseSodexSnapshots(tickers, sodexTradable(symbols), NOW).map((s) => s.venueSymbol),
    ).toEqual([
      "ENA-USD",
      "BTC-USD",
      "1000PEPE-USD",
      "XAUT-USD",
      "SILVER-USD",
      "TSLA-USD",
      "ETH-USD",
    ]);
  });

  test("a market off the hourly interval is not collected rather than given a guessed basis", () => {
    const fourHourly = symbols.map((s) =>
      s.name === "BTC-USD" ? { ...s, fundingInterval: 14_400 } : s,
    );
    const collected = parseSodexSnapshots(tickers, sodexTradable(fourHourly), NOW);
    expect(collected.map((s) => s.venueSymbol)).not.toContain("BTC-USD");
    expect(collected).toHaveLength(6);
  });

  test("bases come from the parser: scaled contracts keep their multiplier, aliases apply", () => {
    const bases = parseSodexSnapshots(tickers, sodexTradable(symbols), NOW).map((s) => [
      s.venueSymbol,
      s.base,
      s.multiplier,
      s.assetClass,
    ]);
    expect(bases).toEqual([
      ["ENA-USD", "ENA", 1, "crypto"],
      ["BTC-USD", "BTC", 1, "crypto"],
      // Declared `baseCoin` is "1000PEPE"; the mark 0.003369 is Hyperliquid's kPEPE, so x1000 is right.
      ["1000PEPE-USD", "PEPE", 1000, "crypto"],
      // Declared "XAUt".
      ["XAUT-USD", "XAUT", 1, "crypto"],
      ["SILVER-USD", "XAG", 1, "crypto"],
      // SoDEX declares no class anywhere, so its tradfi listings are crypto.
      ["TSLA-USD", "TSLA", 1, "crypto"],
      ["ETH-USD", "ETH", 1, "crypto"],
    ]);
    const pepe = tickers.find((t) => t.symbol === "1000PEPE-USD");
    expect(pepe?.openInterest).toBe("240000");
  });
});

describe("sodexAdapter", () => {
  test("tickers every cycle, symbols hourly, no funding history", async () => {
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "sodex",
      async getJson<T>(url: string): Promise<T> {
        urls.push(url);
        if (url === `${SODEX_API}/markets/symbols`) return symbolsFixture as T;
        if (url === `${SODEX_API}/markets/tickers`) return tickersFixture as T;
        throw new Error(`unexpected ${url}`);
      },
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    };
    const adapter = createSodexAdapter();

    await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    const batch = await adapter.fetchSnapshots(client, NOW + 60 * 60_000);

    const sym = `${SODEX_API}/markets/symbols`;
    const tick = `${SODEX_API}/markets/tickers`;
    expect(urls).toEqual([sym, tick, tick, sym, tick]);
    expect(adapter.venueId).toBe("sodex");
    expect(batch.snapshots).toHaveLength(7);
    expect(adapter.fetchFundingHistory).toBeUndefined();
  });
});
