import { describe, expect, test } from "bun:test";
import asterExchangeInfo from "../../__fixtures__/aster/exchangeInfo.json";
import asterFundingInfo from "../../__fixtures__/aster/fundingInfo.json";
import asterHistory from "../../__fixtures__/aster/fundingRate_BTCUSDT.json";
import asterPremium from "../../__fixtures__/aster/premiumIndex.json";
import asterTicker from "../../__fixtures__/aster/ticker24hr.json";
import exchangeInfoFixture from "../../__fixtures__/weex/exchangeInfo.json";
import historyFixture from "../../__fixtures__/weex/fundingRate_BTCUSDT.json";
import premiumFixture from "../../__fixtures__/weex/premiumIndex.json";
import tickerFixture from "../../__fixtures__/weex/ticker24hr.json";
import type { HttpClient } from "../http";
import {
  asterAssetClass,
  type BinanceStyleExchangeInfo,
  createBinanceStyleAdapter,
  intervalsFromPremiumIndex,
  parseBinanceStyleSnapshots,
  tradablePerpetuals,
} from "./aster";
import { isWeexTradable, weexAdapter, weexAssetClass } from "./weex";

const BASE = "https://api-contract.weex.com/capi/v3/market";
const AT = 1_789_334_076_303;
const DAY = 24 * 3_600_000;

/** Real rows from WEEX on 2026-09-14: one of each declared type, and all three collect cycles. */
const info: BinanceStyleExchangeInfo = exchangeInfoFixture;
const tradable = tradablePerpetuals(info, weexAssetClass, isWeexTradable);
const snapshots = parseBinanceStyleSnapshots(
  "weex",
  {
    premium: premiumFixture,
    fundingInfo: intervalsFromPremiumIndex(premiumFixture, (r) =>
      r.collectCycle ? r.collectCycle / 60 : null,
    ),
    tickers: tickerFixture,
    tradable,
    defaultIntervalHours: null,
    predictedRate: (r) => r.forecastFundingRate,
  },
  AT,
);
const bySymbol = new Map(snapshots.map((s) => [s.venueSymbol, s]));

function fixtureClient(base: string, bodies: Record<string, unknown>, urls: string[]): HttpClient {
  return {
    venueId: "weex",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      const key = url.slice(base.length + 1).split("?")[0] as string;
      if (key === "openInterest") {
        const symbol = new URL(url).searchParams.get("symbol") as string;
        return { symbol, openInterest: "1000", time: AT } as T;
      }
      // WEEX answers fundingInfo with a 404; any request for it is the bug under test.
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

describe("weex tradability", () => {
  test("no row carries status, so the TRADING test alone would collect nothing", () => {
    expect(info.symbols.every((s) => s.status === undefined)).toBe(true);
    expect(tradablePerpetuals(info, weexAssetClass).size).toBe(0);
    expect(tradable.size).toBe(info.symbols.length);
  });

  test("the contract type decides, and a status WEEX may send later is still honoured", () => {
    const btc = info.symbols.find((s) => s.symbol === "BTCUSDT");
    expect(isWeexTradable({ symbol: "BTCUSDT_261225", contractType: "NEXT_QUARTER" })).toBe(false);
    expect(isWeexTradable({ ...(btc as (typeof info.symbols)[0]), status: "SETTLING" })).toBe(
      false,
    );
  });
});

describe("weex snapshots", () => {
  test("take the interval from collectCycle, which is in minutes", () => {
    expect(
      ["BTCUSDT", "CATUSDT", "JP225USDT"].map((s) => [s, bySymbol.get(s)?.intervalHours]),
    ).toEqual([
      ["BTCUSDT", 8], // 480
      ["CATUSDT", 4], // 240
      ["JP225USDT", 1], // 60
    ]);
    expect(bySymbol.get("CATUSDT")?.basisHours).toBe(4);
  });

  test("carry forecastFundingRate, because lastFundingRate is the rate already settled", () => {
    // 0.0000645 is BTCUSDT's 16:00 settlement in fundingRate_BTCUSDT.json.
    expect(premiumFixture.find((p) => p.symbol === "BTCUSDT")?.lastFundingRate).toBe(
      historyFixture[0]?.fundingRate,
    );
    expect(bySymbol.get("BTCUSDT")).toMatchObject({
      venueId: "weex",
      base: "BTC",
      quote: "USDT",
      assetClass: "crypto",
      rate: 0.00009018,
      kind: "predicted",
      nextFundingAt: 1_789_344_000_000,
      markPrice: 77312.9,
      volume24hUsd: 503416154.40409,
      openInterestUsd: null,
    });
  });

  test("every fixture market produces a snapshot", () => {
    expect(snapshots).toHaveLength(info.symbols.length);
  });
});

describe("weexAssetClass", () => {
  test("class counts on the fixture rows, as declared and after marketRef's refine", () => {
    const count = (classes: string[]) =>
      Object.fromEntries(
        [...new Set(classes)].sort().map((c) => [c, classes.filter((x) => x === c).length]),
      );
    expect(count([...tradable.values()].map((t) => t.assetClass))).toEqual({
      commodity: 3,
      crypto: 7,
      equity: 3,
      fx: 1,
      index: 3,
    });
    // PAXG returns to crypto as a token; SPY is an ETF and so equity; SP500 is US500, an index.
    expect(count(snapshots.map((s) => s.assetClass))).toEqual({
      commodity: 2,
      crypto: 8,
      equity: 4,
      fx: 1,
      index: 2,
    });
  });

  test("reads underlyingType for each declared kind", () => {
    const of = (symbol: string) => [bySymbol.get(symbol)?.base, bySymbol.get(symbol)?.assetClass];
    expect(of("OPENAIUSDT")).toEqual(["OPENAI", "equity"]); // Pre-IPO
    expect(of("SP500USDT")).toEqual(["US500", "index"]); // Indices
    expect(of("KOSPIUSDT")).toEqual(["KOSPI", "index"]); // Indices
    expect(of("SPYUSDT")).toEqual(["SPY", "equity"]); // Indices, but an ETF
    expect(of("XAUUSDT")).toEqual(["XAU", "commodity"]); // Metals
    expect(of("PAXGUSDT")).toEqual(["PAXG", "crypto"]); // Metals, but a token
    expect(of("CLUSDT")).toEqual(["CL", "commodity"]); // Commodities
    expect(of("EURUSDT")).toEqual(["EUR", "fx"]); // Forex
    // Declared COIN on a PERPETUAL. WEEX's word, and crypto is never overridden from the ticker.
    expect(of("JP225USDT")).toEqual(["JP225", "crypto"]);
  });

  test("keeps the STOCK suffix as declared, so Caterpillar never meets the memecoin", () => {
    expect(bySymbol.get("CATSTOCKUSDT")).toMatchObject({ base: "CATSTOCK", assetClass: "equity" });
    expect(bySymbol.get("CATUSDT")).toMatchObject({ base: "CAT", assetClass: "crypto" });
    expect(bySymbol.get("TSLAUSDT")).toMatchObject({ base: "TSLA", assetClass: "equity" });
  });

  test("uses symbol, not the prose displaySymbol", () => {
    const cl = info.symbols.find((s) => s.symbol === "CLUSDT") as { displaySymbol?: string };
    expect(cl.displaySymbol).toBe("OIL(CL)USDT");
    expect(bySymbol.get("CLUSDT")?.venueSymbol).toBe("CLUSDT");
  });

  test("an unknown underlyingType on a TradFi row is not defaulted to crypto", () => {
    const xau = info.symbols.find((s) => s.symbol === "XAUUSDT") as (typeof info.symbols)[0];
    expect(weexAssetClass({ ...xau, underlyingType: "Energy" })).toBe("commodity");
    expect(weexAssetClass({ ...xau, underlyingType: "COIN" })).toBe("commodity");
  });
});

describe("weexAdapter", () => {
  const bodies = {
    exchangeInfo: exchangeInfoFixture,
    premiumIndex: premiumFixture,
    "ticker/24hr": tickerFixture,
    fundingRate: historyFixture,
  };

  test("never asks for fundingInfo or open interest, and stays on WEEX's host", async () => {
    const urls: string[] = [];
    const client = fixtureClient(BASE, bodies, urls);
    expect(weexAdapter.venueId).toBe("weex");
    const batch = await weexAdapter.fetchSnapshots(client, AT);
    expect(batch.snapshots).toHaveLength(17);
    expect(batch.snapshots.every((s) => s.openInterestUsd === null)).toBe(true);
    expect(urls.map((u) => u.slice(BASE.length + 1)).sort()).toEqual([
      "exchangeInfo",
      "premiumIndex",
      "ticker/24hr",
    ]);
  });

  test("walks history in slices of at most 7 days, and infers the 8h basis", async () => {
    const urls: string[] = [];
    const client = fixtureClient(BASE, bodies, urls);
    await weexAdapter.fetchSnapshots(client, AT);
    urls.length = 0;
    const to = 1_789_315_200_000;
    const events = await weexAdapter.fetchFundingHistory?.(client, "BTCUSDT", to - 20 * DAY, to);

    expect(urls).toHaveLength(3);
    const spans = urls.map((u) => {
      const params = new URL(u).searchParams;
      return [Number(params.get("startTime")), Number(params.get("endTime"))] as const;
    });
    for (const [start, end] of spans) expect(end - start).toBeLessThanOrEqual(7 * DAY);
    expect(spans[0]?.[0]).toBe(to - 20 * DAY);
    expect(spans.at(-1)?.[1]).toBe(to);

    expect(events?.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_200_000_000, 0.00004368, 8],
      [1_789_228_800_000, 0.00005153, 8],
      [1_789_257_600_000, 0.00004794, 8],
      [1_789_286_400_000, 0.0000539, 8],
      [1_789_315_200_000, 0.0000645, 8],
    ]);
  });
});

describe("binance-fapi family defaults", () => {
  test("a member configured without hooks reads fundingInfo, per-symbol open interest, one history chain", async () => {
    const base = "https://fapi.asterdex.com/fapi/v1";
    const urls: string[] = [];
    const client = fixtureClient(
      base,
      {
        exchangeInfo: asterExchangeInfo,
        premiumIndex: asterPremium,
        fundingInfo: asterFundingInfo,
        "ticker/24hr": asterTicker,
        fundingRate: asterHistory,
      },
      urls,
    );
    const adapter = createBinanceStyleAdapter({
      venueId: "aster",
      baseUrl: base,
      classify: asterAssetClass,
    });
    const batch = await adapter.fetchSnapshots(client, 1_789_147_709_400);
    const paths = urls.map((u) => u.slice(base.length + 1).split("?")[0]);
    expect(paths.filter((p) => p !== "openInterest")).toEqual([
      "exchangeInfo",
      "premiumIndex",
      "fundingInfo",
      "ticker/24hr",
    ]);
    expect(urls.filter((u) => u.includes("/openInterest?symbol="))).toHaveLength(3);
    // lastFundingRate is still the estimate for these venues.
    expect(batch.snapshots.find((s) => s.venueSymbol === "BTCUSDT")?.rate).toBe(0.00003274);

    urls.length = 0;
    await adapter.fetchFundingHistory?.(client, "BTCUSDT", 1_700_000_000_000, 1_789_142_400_000);
    expect(urls).toEqual([
      `${base}/fundingRate?symbol=BTCUSDT&startTime=1700000000000&endTime=1789142400000&limit=1000`,
    ]);
  });
});
