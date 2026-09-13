import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import { marketRef } from "../parse";
import {
  BLOFIN_API,
  type BlofinEnvelope,
  type BlofinFundingHistoryRow,
  type BlofinFundingRate,
  type BlofinInstrument,
  type BlofinMarkPrice,
  type BlofinOpenInterest,
  type BlofinTicker,
  blofinAssetClass,
  blofinIntervalHours,
  createBlofinAdapter,
  isBlofinTradable,
  parseBlofinFundingHistory,
  parseBlofinSnapshots,
} from "./blofin";

const fixture = <T>(name: string): Promise<BlofinEnvelope<T>> =>
  Bun.file(new URL(`../../__fixtures__/blofin/${name}.json`, import.meta.url)).json();

/** `ts` of BTC-USDT's mark price in the responses the fixtures were trimmed from (2026-09-13 22:28 UTC). */
const NOW = 1_789_338_518_283;
const HOUR = 3_600_000;

async function load() {
  return {
    instruments: (await fixture<BlofinInstrument[]>("instruments")).data,
    funding: (await fixture<BlofinFundingRate[]>("funding-rate")).data,
    marks: (await fixture<BlofinMarkPrice[]>("mark-price")).data,
    tickers: (await fixture<BlofinTicker[]>("tickers")).data,
    openInterest: (await fixture<BlofinOpenInterest[]>("open-interest")).data,
  };
}

describe("parseBlofinSnapshots", () => {
  test("normalizes BTC-USDT", async () => {
    const btc = parseBlofinSnapshots(await load(), NOW).find((s) => s.venueSymbol === "BTC-USDT");
    expect(btc).toEqual({
      venueId: "blofin",
      venueSymbol: "BTC-USDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // As served: "0.00018548000000000002".
      rate: 0.00018548000000000002,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      markPrice: 76750.5,
      indexPrice: 76789.5,
      bestBid: 76741.1,
      // Book sizes are contracts of 0.001 BTC.
      bestBidSizeUsd: 4 * 0.001 * 76741.1,
      bestAsk: 76759.5,
      bestAskSizeUsd: 5251 * 0.001 * 76759.5,
      // 4,455,385 contracts x 0.001 = 4,455.385 BTC, about $342M. Read as coins: $342bn.
      openInterestUsd: 4455385 * 0.001 * 76750.5,
      // volCurrency24h is base coin: 1,879.6 BTC at the last price, about $144M.
      volume24hUsd: 1879.6213 * 76761.8,
      maxLeverage: 150,
    });
  });

  test("open interest in contracts agrees with BloFin's own coin figure", async () => {
    const all = parseBlofinSnapshots(await load(), NOW);
    const pnut = all.find((s) => s.venueSymbol === "PNUT-USDT");
    // contractValue 10: 595,376 contracts are the 5,953,760 PNUT reported beside them.
    expect(pnut?.openInterestUsd).toBeCloseTo(5953760 * 0.04479, 6);
    expect(pnut?.bestBidSizeUsd).toBeCloseTo(71 * 10 * 0.0448, 9);
    expect(pnut?.volume24hUsd).toBeCloseTo(227489 * 0.04466, 6);
  });

  test("keeps live linear USDT and USDC perps only, in funding order", async () => {
    const symbols = parseBlofinSnapshots(await load(), NOW).map((s) => s.venueSymbol);
    expect(symbols).toEqual([
      "BTC-USDT",
      "ETH-USDT",
      "BTC-USDC",
      // BTC-USD is inverse, margined in BTC.
      "PNUT-USDT",
      "1000BONK-USDT",
      "TSLA-USDT",
      "SPY-USDT",
      "CL-USDT",
      "NG-USDT",
      "XAU-USDT",
      "IOST-USDT",
      "OPG-USDT",
    ]);
  });

  test("reads each interval, and a missing funding row means no market", async () => {
    const f = await load();
    const all = parseBlofinSnapshots(f, NOW);
    expect(all.find((s) => s.venueSymbol === "IOST-USDT")).toMatchObject({
      basisHours: 1,
      intervalHours: 1,
    });
    expect(all.find((s) => s.venueSymbol === "PNUT-USDT")).toMatchObject({
      rate: 0.00006653667177854031,
      basisHours: 4,
    });
    const withoutEth = parseBlofinSnapshots(
      { ...f, funding: f.funding.filter((r) => r.instId !== "ETH-USDT") },
      NOW,
    );
    expect(withoutEth.map((s) => s.venueSymbol)).not.toContain("ETH-USDT");
  });

  test("carries the declared class and settlement coin", async () => {
    const all = parseBlofinSnapshots(await load(), NOW);
    expect(
      Object.fromEntries(all.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}:${s.quote}`])),
    ).toEqual({
      "BTC-USDT": "crypto:BTC:USDT",
      "ETH-USDT": "crypto:ETH:USDT",
      "BTC-USDC": "crypto:BTC:USDC",
      "PNUT-USDT": "crypto:PNUT:USDT",
      "1000BONK-USDT": "crypto:BONK:USDT",
      "TSLA-USDT": "equity:TSLA:USDT",
      // Declared Indices; an ETF is equity on every venue.
      "SPY-USDT": "equity:SPY:USDT",
      "CL-USDT": "commodity:CL:USDT",
      "NG-USDT": "commodity:NATGAS:USDT",
      // BloFin files gold as Crypto, and a crypto declaration is never overridden.
      "XAU-USDT": "crypto:XAU:USDT",
      "IOST-USDT": "crypto:IOST:USDT",
      "OPG-USDT": "crypto:OPG:USDT",
    });
    expect(all.find((s) => s.venueSymbol === "1000BONK-USDT")?.multiplier).toBe(1000);
  });
});

describe("isBlofinTradable", () => {
  test("SWAP, linear, live, and settled in the dollar coin it is quoted in", async () => {
    const [btc] = (await load()).instruments;
    if (!btc) throw new Error("fixture");
    expect(isBlofinTradable(btc)).toBe(true);
    expect(isBlofinTradable({ ...btc, state: "suspend" })).toBe(false);
    expect(isBlofinTradable({ ...btc, contractType: "inverse" })).toBe(false);
    expect(isBlofinTradable({ ...btc, settleCurrency: "BTC", quoteCurrency: "USD" })).toBe(false);
    expect(isBlofinTradable({ ...btc, instType: "FUTURES" })).toBe(false);
  });
});

describe("blofinAssetClass", () => {
  test("maps the four declared labels, and never throws on a new one", () => {
    expect(blofinAssetClass("Crypto", "BTC")).toBe("crypto");
    expect(blofinAssetClass(undefined, "BTC")).toBe("crypto");
    expect(blofinAssetClass("", "BTC")).toBe("crypto");
    expect(blofinAssetClass("Stocks", "TSLA")).toBe("equity");
    expect(blofinAssetClass("Indices", "US500")).toBe("index");
    expect(blofinAssetClass("Commodities", "CL")).toBe("commodity");
    expect(blofinAssetClass("Forex", "EUR")).toBe("fx");
    expect(blofinAssetClass("Bonds", "US10Y")).toBe("index");
  });
});

describe("blofinIntervalHours", () => {
  test("converts the declared unit", () => {
    expect(blofinIntervalHours("8", "hour")).toBe(8);
    expect(blofinIntervalHours("30", "minute")).toBe(0.5);
    expect(blofinIntervalHours("1", "day")).toBe(24);
    expect(blofinIntervalHours("1", "week")).toBeNull();
    expect(blofinIntervalHours("0", "hour")).toBeNull();
    expect(blofinIntervalHours("", "hour")).toBeNull();
  });
});

describe("parseBlofinFundingHistory", () => {
  const ref = marketRef("blofin", "BTC-USDT", { quote: "USDT" });

  test("oldest first, basis from the 8h spacing", async () => {
    const { data } = await fixture<BlofinFundingHistoryRow[]>("funding-rate-history");
    expect(
      parseBlofinFundingHistory(ref, data, 0, NOW, null).map((e) => [
        e.settledAt,
        e.rate,
        e.basisHours,
      ]),
    ).toEqual([
      [1_789_200_000_000, 0.000163, 8],
      [1_789_228_800_000, 0.000171, 8],
      [1_789_257_600_000, 0.000167, 8],
      [1_789_286_400_000, 0.000173, 8],
      [1_789_315_200_000, 0.000184, 8],
    ]);
  });

  test("cuts to the window, and a lone row needs the current interval", async () => {
    const { data } = await fixture<BlofinFundingHistoryRow[]>("funding-rate-history");
    expect(parseBlofinFundingHistory(ref, data, 1_789_286_400_000, NOW, null)).toHaveLength(2);
    expect(parseBlofinFundingHistory(ref, data.slice(0, 1), 0, NOW, null)).toEqual([]);
    expect(parseBlofinFundingHistory(ref, data.slice(0, 1), 0, NOW, 8)).toEqual([
      { ...ref, settledAt: 1_789_315_200_000, rate: 0.000184, basisHours: 8, markPrice: null },
    ]);
  });
});

describe("createBlofinAdapter", () => {
  async function fakeClient(history?: (url: string) => unknown) {
    const responses: Record<string, unknown> = {
      "/market/instruments": await fixture("instruments"),
      "/market/funding-rate": await fixture("funding-rate"),
      "/market/mark-price": await fixture("mark-price"),
      "/market/tickers": await fixture("tickers"),
      "/market/open-interest": await fixture("open-interest"),
    };
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "blofin",
      async getJson<T>(url: string): Promise<T> {
        urls.push(url);
        const path = url.slice(BLOFIN_API.length).split("?")[0] as string;
        if (path === "/market/funding-rate-history" && history) return history(url) as T;
        if (!(path in responses)) throw new Error(`unexpected ${url}`);
        return responses[path] as T;
      },
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    };
    return { client, urls };
  }
  const path = (url: string) => url.slice(BLOFIN_API.length);

  test("four bulk requests a cycle, instruments hourly, no per-symbol calls", async () => {
    const { client, urls } = await fakeClient();
    const adapter = createBlofinAdapter();
    expect(adapter.venueId).toBe("blofin");

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls.map(path)).toEqual([
      "/market/instruments",
      "/market/funding-rate",
      "/market/mark-price",
      "/market/tickers",
      "/market/open-interest",
    ]);
    expect(first.snapshots).toHaveLength(12);
    expect(first.settled).toEqual([]);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toHaveLength(4);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + HOUR);
    expect(urls.map(path)[0]).toBe("/market/instruments");
  });

  test("an error envelope fails the cycle", async () => {
    const client: HttpClient = {
      venueId: "blofin",
      getJson: async <T>() => ({ code: "152001", msg: "Parameter error", data: null }) as T,
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => 0,
    };
    await expect(createBlofinAdapter().fetchSnapshots(client, NOW)).rejects.toThrow("152001");
  });

  test("history pages backwards with `after`, 100 at a time", async () => {
    const T = 1_789_315_200_000;
    const { client, urls } = await fakeClient((url) => {
      const after = Number(new URL(url).searchParams.get("after"));
      const count = after > T ? 100 : 3;
      const newest = after > T ? T : after - 8 * HOUR;
      return {
        code: "0",
        msg: "success",
        data: Array.from({ length: count }, (_, i) => ({
          instId: "BTC-USDT",
          fundingRate: "0.0001",
          fundingTime: String(newest - i * 8 * HOUR),
        })),
      };
    });
    const adapter = createBlofinAdapter();
    await adapter.fetchSnapshots(client, NOW);
    urls.length = 0;

    const events = (await adapter.fetchFundingHistory?.(client, "BTC-USDT", 0, T)) ?? [];
    const oldestOfFirstPage = T - 99 * 8 * HOUR;
    expect(urls.map(path)).toEqual([
      `/market/funding-rate-history?instId=BTC-USDT&limit=100&after=${T + 1}`,
      `/market/funding-rate-history?instId=BTC-USDT&limit=100&after=${oldestOfFirstPage}`,
    ]);
    expect(events).toHaveLength(103);
    expect(events[0]?.settledAt).toBeLessThan(events[1]?.settledAt as number);
    expect(events.every((e) => e.basisHours === 8 && e.quote === "USDT")).toBe(true);
  });
});
