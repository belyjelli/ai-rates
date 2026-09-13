import { describe, expect, test } from "bun:test";
import exchangeInfoFixture from "../../__fixtures__/binance/exchangeInfo.json";
import tradfiExchangeInfo from "../../__fixtures__/binance/exchangeInfo_tradfi.json";
import fundingInfoFixture from "../../__fixtures__/binance/fundingInfo.json";
import tradfiFundingInfo from "../../__fixtures__/binance/fundingInfo_tradfi.json";
import historyFixture from "../../__fixtures__/binance/fundingRate_BTCUSDT.json";
import premiumFixture from "../../__fixtures__/binance/premiumIndex.json";
import tradfiPremium from "../../__fixtures__/binance/premiumIndex_tradfi.json";
import tickerFixture from "../../__fixtures__/binance/ticker24hr.json";
import type { HttpClient } from "../http";
import {
  type BinanceStyleSymbol,
  createBinanceStyleAdapter,
  parseBinanceStyleSnapshots,
  tradablePerpetuals,
} from "./aster";
import { binanceAdapter, binanceAssetClass } from "./binance";

const NOW = 1_789_308_849_000;
const tradable = tradablePerpetuals(exchangeInfoFixture, binanceAssetClass);

/** Fixtures are real responses, trimmed to three symbols captured from the collector host. */
const input = {
  premium: premiumFixture,
  fundingInfo: fundingInfoFixture,
  tickers: tickerFixture,
  tradable,
  defaultIntervalHours: null,
};

function fixtureClient(bodies: Record<string, unknown>, urls: string[], at: number): HttpClient {
  return {
    venueId: "binance",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      const key = url.split("/fapi/v1/")[1]?.split("?")[0] as string;
      if (key === "openInterest") {
        const symbol = new URL(url).searchParams.get("symbol") as string;
        return { symbol, openInterest: "1000", time: at } as T;
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
}

describe("binance snapshots", () => {
  const snapshots = parseBinanceStyleSnapshots("binance", input, NOW);
  const bySymbol = new Map(snapshots.map((s) => [s.venueSymbol, s]));

  test("normalizes BTCUSDT at the venue's own 8h interval", () => {
    const btc = bySymbol.get("BTCUSDT");
    expect(btc?.venueId).toBe("binance");
    expect(btc?.base).toBe("BTC");
    expect(btc?.quote).toBe("USDT");
    expect(btc?.assetClass).toBe("crypto");
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

describe("binanceAssetClass", () => {
  /** Real rows from Binance's exchangeInfo on 2026-09-14, trimmed to the fields the family reads. */
  const rows: BinanceStyleSymbol[] = tradfiExchangeInfo.symbols;
  const row = (symbol: string) => rows.find((r) => r.symbol === symbol) as BinanceStyleSymbol;

  test("reads underlyingType", () => {
    expect(asClasses(["CATUSDT", "1000CATUSDT", "BBUSDT", "XAUUSDT", "PAXGUSDT"])).toEqual([
      ["CATUSDT", "equity"], // EQUITY: Caterpillar, at 817
      ["1000CATUSDT", "crypto"], // COIN: the memecoin under the same CAT base
      ["BBUSDT", "crypto"], // COIN: BounceBit, not BlackBerry
      ["XAUUSDT", "commodity"], // COMMODITY
      ["PAXGUSDT", "crypto"], // COIN: a gold token
    ]);
    expect(asClasses(["TSLAUSDT", "SPYUSDT", "OPENAIUSDT", "BTCDOMUSDT"])).toEqual([
      ["TSLAUSDT", "equity"],
      ["SPYUSDT", "equity"], // an ETF is equity
      ["OPENAIUSDT", "equity"], // PREMARKET
      ["BTCDOMUSDT", "crypto"], // INDEX, but an index of coins
    ]);

    function asClasses(symbols: string[]) {
      return symbols.map((s) => [s, binanceAssetClass(row(s))]);
    }
  });

  test("an underlyingType it does not know is tradfi of the kind the tables say, never crypto", () => {
    expect(binanceAssetClass({ ...row("XAUUSDT"), underlyingType: "METAL" })).toBe("commodity");
    expect(binanceAssetClass({ ...row("TSLAUSDT"), underlyingType: "US_EQUITY" })).toBe("equity");
    expect(binanceAssetClass({ ...row("1000CATUSDT"), underlyingType: "BASKET" })).not.toBe(
      "crypto",
    );
  });

  test("a TRADIFI_PERPETUAL is never crypto, whatever its underlyingType says", () => {
    expect(binanceAssetClass({ ...row("SPYUSDT"), underlyingType: "COIN" })).toBe("equity");
    expect(binanceAssetClass({ ...row("XAUUSDT"), underlyingType: undefined })).toBe("commodity");
  });

  test("a perpetual that declares nothing is crypto", () => {
    expect(
      binanceAssetClass({ symbol: "BTCUSDT", status: "TRADING", contractType: "PERPETUAL" }),
    ).toBe("crypto");
  });
});

describe("binance TradFi perpetuals", () => {
  const AT = 1_789_334_213_000;
  const snapshots = parseBinanceStyleSnapshots(
    "binance",
    {
      premium: tradfiPremium,
      fundingInfo: tradfiFundingInfo,
      tickers: [],
      tradable: tradablePerpetuals(tradfiExchangeInfo, binanceAssetClass),
      defaultIntervalHours: null,
    },
    AT,
  );
  const bySymbol = new Map(snapshots.map((s) => [s.venueSymbol, s]));

  test("TRADIFI_PERPETUAL markets are collected with their class; quarterlies are not", () => {
    expect(
      snapshots
        .map((s) => [s.venueSymbol, s.base, s.assetClass])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
      ["1000CATUSDT", "CAT", "crypto"],
      ["BBUSDT", "BB", "crypto"],
      ["BTCDOMUSDT", "BTCDOM", "crypto"],
      ["CATUSDT", "CAT", "equity"],
      ["OPENAIUSDT", "OPENAI", "equity"],
      ["PAXGUSDT", "PAXG", "crypto"],
      ["SPYUSDT", "SPY", "equity"],
      ["TSLAUSDT", "TSLA", "equity"],
      ["XAUUSDT", "XAU", "commodity"],
      // BTCUSDT_260925 is a CURRENT_QUARTER future: in premiumIndex, but not a perpetual.
    ]);
  });

  test("the two CATs share a base and differ in class, so they never pool", () => {
    expect(bySymbol.get("CATUSDT")).toMatchObject({
      base: "CAT",
      multiplier: 1,
      assetClass: "equity",
      markPrice: 817.85228986,
      intervalHours: 8,
    });
    expect(bySymbol.get("1000CATUSDT")).toMatchObject({
      base: "CAT",
      multiplier: 1000,
      assetClass: "crypto",
    });
    expect(bySymbol.get("XAUUSDT")?.intervalHours).toBe(4);
  });

  test("the adapter classifies with underlyingType, in snapshots and in history", async () => {
    const urls: string[] = [];
    const client = fixtureClient(
      {
        exchangeInfo: tradfiExchangeInfo,
        premiumIndex: tradfiPremium,
        fundingInfo: tradfiFundingInfo,
        "ticker/24hr": [],
        // Rows from the BTCUSDT fixture: only the class of the events is under test here.
        fundingRate: historyFixture,
      },
      urls,
      AT,
    );
    const adapter = createBinanceStyleAdapter({
      venueId: "binance",
      baseUrl: "https://fapi.binance.com/fapi/v1",
      classify: binanceAssetClass,
    });
    const batch = await adapter.fetchSnapshots(client, AT);
    expect(batch.snapshots).toHaveLength(9);
    expect(batch.snapshots.find((s) => s.venueSymbol === "TSLAUSDT")?.assetClass).toBe("equity");

    const events = await adapter.fetchFundingHistory?.(client, "TSLAUSDT", 0, AT);
    expect(events?.length).toBeGreaterThan(0);
    expect(events?.every((e) => e.assetClass === "equity" && e.base === "TSLA")).toBe(true);
  });
});

describe("binanceAdapter", () => {
  test("is configuration of the family base, pointed at Binance's own host", async () => {
    const urls: string[] = [];
    const client = fixtureClient(
      {
        exchangeInfo: exchangeInfoFixture,
        premiumIndex: premiumFixture,
        fundingInfo: fundingInfoFixture,
        "ticker/24hr": tickerFixture,
        fundingRate: historyFixture,
      },
      urls,
      NOW,
    );

    expect(binanceAdapter.venueId).toBe("binance");
    const batch = await binanceAdapter.fetchSnapshots(client, NOW);
    expect(batch.snapshots).toHaveLength(3);
    expect(batch.snapshots.every((s) => s.assetClass === "crypto")).toBe(true);
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
