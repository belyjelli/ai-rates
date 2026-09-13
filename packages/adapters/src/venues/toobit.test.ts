import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import { marketRef } from "../parse";
import {
  createToobitAdapter,
  isToobitTradable,
  parseToobitFundingHistory,
  parseToobitSnapshots,
  TOOBIT_API,
  type ToobitBookTicker,
  type ToobitContract,
  type ToobitExchangeInfo,
  type ToobitFundingHistoryRow,
  type ToobitFundingRate,
  type ToobitIndex,
  type ToobitMarkPrice,
  type ToobitTicker,
  toobitAssetClass,
  toobitPeriodHours,
} from "./toobit";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/toobit/${name}.json`, import.meta.url)).json();

/** `t` of BTC-SWAP-USDT's 24h ticker the fixtures were trimmed from (2026-09-13 22:29 UTC). */
const NOW = 1_789_338_570_215;
const HOUR = 3_600_000;

async function load() {
  return {
    contracts: (await fixture<ToobitExchangeInfo>("exchangeInfo")).contracts,
    funding: await fixture<ToobitFundingRate[]>("fundingRate"),
    tickers: await fixture<ToobitTicker[]>("ticker24hr"),
    marks: await fixture<ToobitMarkPrice[]>("markPrice"),
    index: (await fixture<ToobitIndex>("index")).index,
    books: await fixture<ToobitBookTicker[]>("bookTicker"),
  };
}

describe("parseToobitSnapshots", () => {
  test("normalizes BTC-SWAP-USDT", async () => {
    const btc = parseToobitSnapshots(await load(), NOW).find(
      (s) => s.venueSymbol === "BTC-SWAP-USDT",
    );
    expect(btc).toEqual({
      venueId: "toobit",
      venueSymbol: "BTC-SWAP-USDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // Binance's own estimate for the 00:00 settlement at the same second.
      rate: 0.00006548,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      markPrice: 76768.7,
      // Looked up by `indexToken` BTCUSDT.
      indexPrice: 76797.5476087,
      bestBid: 76768.5,
      // Contracts of 0.001 BTC: 11.6 BTC at the bid, not 11,595.
      bestBidSizeUsd: 11595 * 0.001 * 76768.5,
      bestAsk: 76768.6,
      bestAskSizeUsd: 91131 * 0.001 * 76768.6,
      // `op` is contracts: 796.4 BTC, about $61M, matching /quote/v1/openInterest.
      openInterestUsd: 796404.198 * 0.001 * 76768.7,
      volume24hUsd: 4275918831.73709,
    });
  });

  test("the 24h volume is contracts, so turnover is qv and not v", async () => {
    const { tickers, contracts } = await load();
    for (const symbol of ["BTC-SWAP-USDT", "ETH-SWAP-USDT"]) {
      const t = tickers.find((x) => x.s === symbol) as ToobitTicker & { v: string };
      const c = contracts.find((x) => x.symbol === symbol) as ToobitContract;
      const impliedPrice = Number(t.qv) / (Number(t.v) * Number(c.contractMultiplier));
      expect(Math.abs(impliedPrice / Number(t.c) - 1)).toBeLessThan(0.01);
    }
  });

  test("keeps listed contracts only, in funding order", async () => {
    expect(parseToobitSnapshots(await load(), NOW).map((s) => s.venueSymbol)).toEqual([
      "BTC-SWAP-USDT",
      "ETH-SWAP-USDT",
      "BTC-SWAP-USDC",
      "ID2-SWAP-USDT",
      "1000PEPE-SWAP-USDT",
      "XAU-SWAP-USDT",
      "TSLA-SWAP-USDT",
      "SPX500-SWAP-USDT",
      "EUR-SWAP-USDT",
      "XAUT-SWAP-USDT",
      "IOST-SWAP-USDT",
      "AXS-SWAP-USDT",
      // TBV_BTC-SWAP-TBV_USDT has funding but is not in exchangeInfo.
    ]);
  });

  test("each contract's own period is its basis", async () => {
    const all = parseToobitSnapshots(await load(), NOW);
    expect(all.find((s) => s.venueSymbol === "IOST-SWAP-USDT")).toMatchObject({
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
    });
    expect(all.find((s) => s.venueSymbol === "AXS-SWAP-USDT")).toMatchObject({
      rate: 0.00005,
      basisHours: 4,
    });
  });

  test("class from isRwa, quote from the margin coin, base from the declared underlying", async () => {
    const all = parseToobitSnapshots(await load(), NOW);
    expect(
      Object.fromEntries(all.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}:${s.quote}`])),
    ).toEqual({
      "BTC-SWAP-USDT": "crypto:BTC:USDT",
      "ETH-SWAP-USDT": "crypto:ETH:USDT",
      "BTC-SWAP-USDC": "crypto:BTC:USDC",
      // The parser reads ID2; Toobit declares underlying ID and index IDUSDT.
      "ID2-SWAP-USDT": "crypto:ID:USDT",
      "1000PEPE-SWAP-USDT": "crypto:PEPE:USDT",
      // rwaType is STOCK on all four of these; the base tables pick the class.
      "XAU-SWAP-USDT": "commodity:XAU:USDT",
      "TSLA-SWAP-USDT": "equity:TSLA:USDT",
      "SPX500-SWAP-USDT": "index:US500:USDT",
      "EUR-SWAP-USDT": "fx:EUR:USDT",
      // Categorised TradFi but not RWA.
      "XAUT-SWAP-USDT": "crypto:XAUT:USDT",
      "IOST-SWAP-USDT": "crypto:IOST:USDT",
      "AXS-SWAP-USDT": "crypto:AXS:USDT",
    });
    expect(all.find((s) => s.venueSymbol === "1000PEPE-SWAP-USDT")?.multiplier).toBe(1000);
  });
});

describe("isToobitTradable", () => {
  test("TRADING, linear, and margined in the dollar coin it is quoted in", async () => {
    const [btc] = (await load()).contracts;
    if (!btc) throw new Error("fixture");
    expect(isToobitTradable(btc)).toBe(true);
    expect(isToobitTradable({ ...btc, status: "HALT" })).toBe(false);
    expect(isToobitTradable({ ...btc, inverse: true })).toBe(false);
    expect(isToobitTradable({ ...btc, marginToken: "BTC", quoteAsset: "USD" })).toBe(false);
  });
});

describe("toobitAssetClass", () => {
  test("isRwa decides crypto or not; the base decides which tradfi class", async () => {
    const [btc] = (await load()).contracts;
    if (!btc) throw new Error("fixture");
    expect(toobitAssetClass(btc, "BTC")).toBe("crypto");
    expect(toobitAssetClass({ ...btc, isRwa: undefined }, "BTC")).toBe("crypto");
    const rwa = { ...btc, isRwa: true, rwaType: "STOCK" };
    expect(toobitAssetClass(rwa, "NVDA")).toBe("equity");
    expect(toobitAssetClass(rwa, "XAG")).toBe("commodity");
    expect(toobitAssetClass({ ...rwa, rwaType: "SOMETHING_NEW" }, "US30")).toBe("index");
  });
});

describe("toobitPeriodHours", () => {
  test("reads hour periods only", () => {
    expect(toobitPeriodHours("8H")).toBe(8);
    expect(toobitPeriodHours("4h")).toBe(4);
    expect(toobitPeriodHours("1H")).toBe(1);
    expect(toobitPeriodHours("0H")).toBeNull();
    expect(toobitPeriodHours("8")).toBeNull();
    expect(toobitPeriodHours("")).toBeNull();
    expect(toobitPeriodHours(undefined)).toBeNull();
  });
});

describe("parseToobitFundingHistory", () => {
  const ref = marketRef("toobit", "BTC-SWAP-USDT", { quote: "USDT" });

  test("oldest first, each over its declared period", async () => {
    const rows = await fixture<ToobitFundingHistoryRow[]>("historyFundingRate");
    expect(
      parseToobitFundingHistory(ref, rows, 0, NOW, null).map((e) => [
        e.settledAt,
        e.rate,
        e.basisHours,
      ]),
    ).toEqual([
      [1_789_200_000_000, 0.00004368, 8],
      [1_789_228_800_000, 0.00005153, 8],
      [1_789_257_600_000, 0.00004794, 8],
      [1_789_286_400_000, 0.0000539, 8],
      // Binance settled 0.00006450 at the same instant.
      [1_789_315_200_000, 0.0000645, 8],
    ]);
  });

  test("cuts to the window; a row without a period falls back to the gaps", async () => {
    const rows = await fixture<ToobitFundingHistoryRow[]>("historyFundingRate");
    expect(parseToobitFundingHistory(ref, rows, 1_789_286_400_000, NOW, null)).toHaveLength(2);
    const unlabelled = rows.map((r) => ({ ...r, period: "" }));
    expect(
      parseToobitFundingHistory(ref, unlabelled, 0, NOW, null).every((e) => e.basisHours === 8),
    ).toBe(true);
    expect(parseToobitFundingHistory(ref, unlabelled.slice(0, 1), 0, NOW, null)).toEqual([]);
  });
});

describe("createToobitAdapter", () => {
  async function fakeClient(history?: (url: string) => unknown) {
    const responses: Record<string, unknown> = {
      "/api/v1/exchangeInfo": await fixture("exchangeInfo"),
      "/api/v1/futures/fundingRate": await fixture("fundingRate"),
      "/quote/v1/contract/ticker/24hr": await fixture("ticker24hr"),
      "/quote/v1/markPrice": await fixture("markPrice"),
      "/quote/v1/index": await fixture("index"),
      "/quote/v1/contract/ticker/bookTicker": await fixture("bookTicker"),
    };
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "toobit",
      async getJson<T>(url: string): Promise<T> {
        urls.push(url);
        const path = url.slice(TOOBIT_API.length).split("?")[0] as string;
        if (path === "/api/v1/futures/historyFundingRate" && history) return history(url) as T;
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
  const path = (url: string) => url.slice(TOOBIT_API.length);

  test("five bulk requests a cycle, exchangeInfo hourly, no per-symbol calls", async () => {
    const { client, urls } = await fakeClient();
    const adapter = createToobitAdapter();
    expect(adapter.venueId).toBe("toobit");

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls.map(path)).toEqual([
      "/api/v1/exchangeInfo",
      "/api/v1/futures/fundingRate",
      "/quote/v1/contract/ticker/24hr",
      "/quote/v1/markPrice",
      "/quote/v1/index",
      "/quote/v1/contract/ticker/bookTicker",
    ]);
    expect(first.snapshots).toHaveLength(12);
    expect(first.snapshots.every((s) => s.markPrice !== null && s.indexPrice !== null)).toBe(true);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toHaveLength(5);
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + HOUR);
    expect(urls.map(path)[0]).toBe("/api/v1/exchangeInfo");
  });

  test("an error object where a list belongs fails the cycle", async () => {
    const { client } = await fakeClient();
    const failing: HttpClient = {
      ...client,
      getJson: async <T>(url: string) =>
        (url.includes("fundingRate")
          ? { code: -1130, msg: "Data sent for paramter 'limit' is not valid." }
          : client.getJson(url)) as T,
    };
    await expect(createToobitAdapter().fetchSnapshots(failing, NOW)).rejects.toThrow("-1130");
  });

  test("history walks back with fromId, 1000 at a time, until it passes fromMs", async () => {
    const T = 1_789_315_200_000;
    const page = (fromId: number | null) =>
      Array.from({ length: 1000 }, (_, i) => {
        const offset = (fromId === null ? 0 : 3_000_000 - fromId) + i;
        return {
          id: String(3_000_000 - offset - (fromId === null ? 0 : 1)),
          symbol: "BTC-SWAP-USDT",
          settleTime: String(T - (offset + (fromId === null ? 0 : 1)) * 8 * HOUR),
          settleRate: "0.0001",
          period: "8H",
        };
      });
    const { client, urls } = await fakeClient((url) => {
      const fromId = new URL(url).searchParams.get("fromId");
      return page(fromId === null ? null : Number(fromId));
    });
    const adapter = createToobitAdapter();
    const fromMs = T - 1500 * 8 * HOUR;
    const events = (await adapter.fetchFundingHistory?.(client, "BTC-SWAP-USDT", fromMs, T)) ?? [];

    expect(urls.map(path)).toEqual([
      "/api/v1/futures/historyFundingRate?symbol=BTC-SWAP-USDT&limit=1000",
      "/api/v1/futures/historyFundingRate?symbol=BTC-SWAP-USDT&limit=1000&fromId=2999001",
    ]);
    // 2,000 rows fetched; the second page reaches back past fromMs, so paging stops there.
    expect(events).toHaveLength(1501);
    expect(events[0]?.settledAt).toBe(fromMs);
    expect(events.at(-1)?.settledAt).toBe(T);
  });
});
