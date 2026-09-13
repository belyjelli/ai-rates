import { describe, expect, test } from "bun:test";
import exchangeInfoFixture from "../../__fixtures__/bullet/exchangeInfo.json";
import fundingInfoFixture from "../../__fixtures__/bullet/fundingInfo.json";
import fundingRateFixture from "../../__fixtures__/bullet/fundingRate.json";
import openInterestFixture from "../../__fixtures__/bullet/openInterest.json";
import premiumFixture from "../../__fixtures__/bullet/premiumIndex.json";
import tickerFixture from "../../__fixtures__/bullet/ticker24hr.json";
import type { HttpClient } from "../http";
import {
  type BinanceStyleExchangeInfo,
  parseBinanceStyleFundingHistory,
  parseBinanceStyleSnapshots,
  tradablePerpetuals,
} from "./aster";
import { bulletAdapter, bulletAssetClass, createBulletAdapter, isBulletTradable } from "./bullet";

const BASE = "https://tradingapi.bullet.xyz/fapi/v1";
const AT = 1_789_334_077_065;
const HOUR = 3_600_000;
/** 1789333200020994 microseconds, the settlement every fixture row shares. */
const SETTLED_MS = 1_789_333_200_020;

/** Real responses from Bullet on 2026-09-14: all 19 markets, trimmed to the fields the family reads. */
const info: BinanceStyleExchangeInfo = exchangeInfoFixture;
const tradable = tradablePerpetuals(info, bulletAssetClass, isBulletTradable);

function fixtureClient(
  bodies: Record<string, unknown>,
  urls: string[],
  fail: Set<string> = new Set(),
): HttpClient {
  return {
    venueId: "bullet",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      const key = url.slice(BASE.length + 1).split("?")[0] as string;
      if (fail.has(key)) throw new Error(`HTTP 502 ${url}`);
      if (!(key in bodies)) throw new Error(`unexpected ${url}`);
      if (key === "fundingRate") {
        // The live endpoint answers one row per market, filtered by symbol when given.
        const symbol = new URL(url).searchParams.get("symbol");
        return (bodies[key] as { symbol: string }[]).filter(
          (r) => !symbol || r.symbol === symbol,
        ) as T;
      }
      return bodies[key] as T;
    },
    postJson: async () => {
      throw new Error("unused");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
}

const bodies = {
  exchangeInfo: exchangeInfoFixture,
  premiumIndex: premiumFixture,
  fundingInfo: fundingInfoFixture,
  "ticker/24hr": tickerFixture,
  openInterest: openInterestFixture,
  fundingRate: fundingRateFixture,
};

describe("bulletAssetClass", () => {
  test("reads contractType, since underlyingType is COIN on every row, gold and Tesla included", () => {
    expect(info.symbols.every((s) => s.underlyingType === "COIN")).toBe(true);
    const counts = new Map<string, number>();
    for (const t of tradable.values())
      counts.set(t.assetClass, (counts.get(t.assetClass) ?? 0) + 1);
    expect(Object.fromEntries([...counts].sort())).toEqual({
      commodity: 3,
      crypto: 8,
      equity: 6,
      index: 2,
    });
  });

  test("an RwaPerp type it does not know is placed by the tables, never crypto", () => {
    const gold = info.symbols.find((s) => s.symbol === "GOLD-USD") as (typeof info.symbols)[0];
    expect(bulletAssetClass({ ...gold, contractType: "RwaPerpMetals" })).toBe("commodity");
    expect(bulletAssetClass({ ...gold, contractType: "RwaPerpJpEquity" })).toBe("equity");
    const tsla = info.symbols.find((s) => s.symbol === "TSLA-USD") as (typeof info.symbols)[0];
    expect(bulletAssetClass({ ...tsla, contractType: "RwaPerpEtf" })).toBe("equity");
  });
});

describe("bullet tradability", () => {
  test("its contract types are never PERPETUAL, so the default test would collect nothing", () => {
    expect(tradablePerpetuals(info, bulletAssetClass).size).toBe(0);
    expect(tradable.size).toBe(19);
    const btc = info.symbols.find((s) => s.symbol === "BTC-USD") as (typeof info.symbols)[0];
    expect(isBulletTradable({ ...btc, status: "HALT" })).toBe(false);
    expect(isBulletTradable({ ...btc, contractType: "CryptoFuture" })).toBe(false);
  });
});

describe("bullet snapshots", () => {
  const snapshots = parseBinanceStyleSnapshots(
    "bullet",
    {
      premium: premiumFixture,
      fundingInfo: fundingInfoFixture,
      tickers: tickerFixture,
      tradable,
      defaultIntervalHours: null,
      predictedRate: (r) => r.estimatedFundingRate,
    },
    AT,
  );
  const bySymbol = new Map(snapshots.map((s) => [s.venueSymbol, s]));

  test("carry the estimated 1h rate, not the settled 8h one, at the 1h interval", () => {
    expect(bySymbol.get("BTC-USD")).toMatchObject({
      base: "BTC",
      quote: "USD",
      assetClass: "crypto",
      rate: 0.0000125,
      basisHours: 1,
      intervalHours: 1,
      kind: "predicted",
      nextFundingAt: 1_789_336_800_000,
    });
    // lastFundingRate, 0.0001, is the settlement fundingRate reports: eight times the hourly rate.
    expect(premiumFixture.find((p) => p.symbol === "BTC-USD")?.lastFundingRate).toBe(
      fundingRateFixture.find((r) => r.symbol === "BTC-USD")?.fundingRate,
    );
  });

  test("every market produces a snapshot, with its class and canonical base", () => {
    expect(snapshots).toHaveLength(19);
    const of = (symbol: string) => [bySymbol.get(symbol)?.base, bySymbol.get(symbol)?.assetClass];
    expect(of("GOLD-USD")).toEqual(["XAU", "commodity"]);
    expect(of("SILVER-USD")).toEqual(["XAG", "commodity"]);
    // No alias to CL without price evidence.
    expect(of("WTIOIL-USD")).toEqual(["WTIOIL", "commodity"]);
    expect(of("US500-USD")).toEqual(["US500", "index"]);
    expect(of("SKHYNIX-USD")).toEqual(["SKHYNIX", "equity"]);
  });
});

describe("bullet funding history", () => {
  const btcRows = fundingRateFixture.filter((r) => r.symbol === "BTC-USD");

  test("fundingTime is microseconds, normalised to milliseconds on parse", () => {
    expect(String(btcRows[0]?.fundingTime)).toHaveLength(16);
    const events = parseBinanceStyleFundingHistory(
      "bullet",
      "BTC-USD",
      btcRows,
      SETTLED_MS - HOUR,
      SETTLED_MS + HOUR,
      1,
      "crypto",
      { timeUnit: "us", basisHours: 8 },
    );
    expect(events).toEqual([
      expect.objectContaining({
        venueId: "bullet",
        base: "BTC",
        settledAt: SETTLED_MS,
        rate: 0.0001,
        basisHours: 8,
      }),
    ]);
    // Read as milliseconds, the same row lands in the year 58,670 and outside any real window.
    expect(
      parseBinanceStyleFundingHistory("bullet", "BTC-USD", btcRows, 0, Date.UTC(3000, 0), 1),
    ).toEqual([]);
  });

  test("the adapter quotes settled rates over 8h, though they settle hourly", async () => {
    const urls: string[] = [];
    const client = fixtureClient(bodies, urls);
    await bulletAdapter.fetchSnapshots(client, AT);
    const events = await bulletAdapter.fetchFundingHistory?.(
      client,
      "GOLD-USD",
      SETTLED_MS - 7 * 24 * HOUR,
      AT,
    );
    expect(events?.map((e) => [e.settledAt, e.base, e.assetClass, e.basisHours])).toEqual([
      [SETTLED_MS, "XAU", "commodity", 8],
    ]);
  });
});

describe("bulletAdapter", () => {
  test("reads open interest for every market in one call, priced at the mark", async () => {
    expect(bulletAdapter.venueId).toBe("bullet");
    const urls: string[] = [];
    // A fresh adapter, so the exchangeInfo cache from an earlier test cannot hide a request.
    const batch = await createBulletAdapter().fetchSnapshots(fixtureClient(bodies, urls), AT);

    // exchangeInfo, premiumIndex, fundingInfo, ticker/24hr and one openInterest: five in all.
    expect(urls.every((u) => u.startsWith(`${BASE}/`))).toBe(true);
    expect(urls.filter((u) => u.includes("/openInterest"))).toEqual([`${BASE}/openInterest`]);
    expect(urls).toHaveLength(5);
    expect(batch.snapshots.every((s) => s.openInterestUsd !== null)).toBe(true);
    const btc = batch.snapshots.find((s) => s.venueSymbol === "BTC-USD");
    expect(btc?.openInterestUsd).toBeCloseTo(3.0926 * (btc?.markPrice as number), 6);
  });

  test("a failed open-interest call keeps the last figures and does not fail the cycle", async () => {
    const adapter = createBulletAdapter();
    const urls: string[] = [];
    const first = await adapter.fetchSnapshots(fixtureClient(bodies, urls), AT);
    urls.length = 0;
    const second = await adapter.fetchSnapshots(
      fixtureClient(bodies, urls, new Set(["openInterest"])),
      AT + 60_000,
    );
    // exchangeInfo is cached, so a later cycle is premiumIndex, fundingInfo, ticker and openInterest.
    expect(urls).toHaveLength(4);
    expect(second.snapshots).toHaveLength(19);
    expect(second.snapshots.map((s) => s.openInterestUsd)).toEqual(
      first.snapshots.map((s) => s.openInterestUsd),
    );
  });
});
