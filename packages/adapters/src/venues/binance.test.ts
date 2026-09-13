import { describe, expect, test } from "bun:test";
import exchangeInfoFixture from "../../__fixtures__/binance/exchangeInfo.json";
import fundingInfoFixture from "../../__fixtures__/binance/fundingInfo.json";
import historyFixture from "../../__fixtures__/binance/fundingRate_BTCUSDT.json";
import premiumFixture from "../../__fixtures__/binance/premiumIndex.json";
import tickerFixture from "../../__fixtures__/binance/ticker24hr.json";
import type { HttpClient } from "../http";
import { parseBinanceStyleSnapshots, tradablePerpetuals } from "./aster";
import { binanceAdapter } from "./binance";

const NOW = 1_789_308_849_000;
const tradable = tradablePerpetuals(exchangeInfoFixture);

/** Fixtures are real responses, trimmed to three symbols captured from the collector host. */
const input = {
  premium: premiumFixture,
  fundingInfo: fundingInfoFixture,
  tickers: tickerFixture,
  tradable,
  defaultIntervalHours: null,
};

describe("binance snapshots", () => {
  const snapshots = parseBinanceStyleSnapshots("binance", input, NOW);
  const bySymbol = new Map(snapshots.map((s) => [s.venueSymbol, s]));

  test("normalizes BTCUSDT at the venue's own 8h interval", () => {
    const btc = bySymbol.get("BTCUSDT");
    expect(btc?.venueId).toBe("binance");
    expect(btc?.base).toBe("BTC");
    expect(btc?.quote).toBe("USDT");
    expect(btc?.basisHours).toBe(8);
    expect(btc?.intervalHours).toBe(8);
    expect(btc?.kind).toBe("predicted");
    // lastFundingRate is the CURRENT period's estimate despite the name, so it is a prediction.
    expect(btc?.rate).toBeCloseTo(0.0000668, 10);
  });

  test("reads a 4-hourly symbol from fundingInfo rather than defaulting it", () => {
    // 466 of Binance's 782 fundingInfo entries settle 4-hourly, so a fixture covering only 8h
    // would leave the majority of the venue untested. apr = rate / basisHours * 876000, so a wrong
    // interval mis-annualises the headline figure directly.
    const lpt = bySymbol.get("LPTUSDT");
    expect(lpt?.basisHours).toBe(4);
    expect(lpt?.intervalHours).toBe(4);
  });

  test("carries volume and both prices, and leaves open interest for the rotating sweep", () => {
    const btc = bySymbol.get("BTCUSDT");
    expect(btc?.markPrice).toBeGreaterThan(0);
    expect(btc?.indexPrice).toBeGreaterThan(0);
    expect(btc?.volume24hUsd).toBeGreaterThan(0);
    // Binance-style APIs expose open interest per symbol only; the bulk cycle cannot fill it.
    expect(btc?.openInterestUsd).toBeNull();
  });

  test("a symbol absent from fundingInfo is skipped, never given an invented interval", () => {
    const withoutIntervals = parseBinanceStyleSnapshots(
      "binance",
      { ...input, fundingInfo: [] },
      NOW,
    );
    expect(withoutIntervals).toHaveLength(0);
  });
});

describe("binanceAdapter", () => {
  test("is configuration of the family base, pointed at Binance's own host", async () => {
    const urls: string[] = [];
    const bodies: Record<string, unknown> = {
      exchangeInfo: exchangeInfoFixture,
      premiumIndex: premiumFixture,
      fundingInfo: fundingInfoFixture,
      "ticker/24hr": tickerFixture,
    };
    const client: HttpClient = {
      venueId: "binance",
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

    expect(binanceAdapter.venueId).toBe("binance");
    const batch = await binanceAdapter.fetchSnapshots(client, NOW);
    expect(batch.snapshots).toHaveLength(3);
    // Every request must go to Binance, not to the base venue this factory was extracted from.
    expect(urls.every((u) => u.startsWith("https://fapi.binance.com/fapi/v1/"))).toBe(true);
    expect(urls.some((u) => u.includes("asterdex"))).toBe(false);

    const events = await binanceAdapter.fetchFundingHistory?.(
      client,
      "BTCUSDT",
      1_789_200_000_000,
      1_789_300_000_000,
    );
    expect(events?.every((e) => e.venueId === "binance")).toBe(true);
  });
});
