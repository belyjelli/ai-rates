import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import {
  type KucoinContract,
  kucoinAdapter,
  kucoinAssetClass,
  parseKucoinFundingHistory,
  parseKucoinRiskLimits,
  parseKucoinSnapshots,
} from "./kucoin";

const fixture = (name: string) =>
  Bun.file(new URL(`../../__fixtures__/kucoin/${name}.json`, import.meta.url)).json();

const NOW = 1_789_147_120_000;

describe("parseKucoinSnapshots", () => {
  test("normalizes XBTUSDTM", async () => {
    const { snapshots } = parseKucoinSnapshots(await fixture("contracts-active"), NOW);
    expect(snapshots.find((s) => s.venueSymbol === "XBTUSDTM")).toEqual({
      venueId: "kucoin",
      venueSymbol: "XBTUSDTM",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.000037,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_171_200_000,
      kind: "predicted",
      markPrice: 77754.7,
      indexPrice: 77783.14,
      openInterestUsd: 11784994 * 0.001 * 77754.7,
      volume24hUsd: 511004312.1306,
      maxLeverage: 125,
    });
  });

  test("skips inverse and dated contracts; handles 4h and a missing current granularity", async () => {
    const { snapshots } = parseKucoinSnapshots(await fixture("contracts-active"), NOW);
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "XBTUSDTM",
      "ETHUSDTM",
      "WIFUSDTM",
      "DOGEUSDTM",
    ]);
    expect(snapshots.find((s) => s.venueSymbol === "WIFUSDTM")).toMatchObject({
      basisHours: 4,
      nextFundingAt: 1_789_156_800_000,
      openInterestUsd: 1858612 * 10 * 0.1946,
    });
    expect(snapshots.find((s) => s.venueSymbol === "DOGEUSDTM")?.basisHours).toBe(8);
  });

  test("emits the previous settlement from lastTimeFundingRate", async () => {
    const { settled } = parseKucoinSnapshots(await fixture("contracts-active"), NOW);
    expect(settled.find((e) => e.venueSymbol === "XBTUSDTM")).toMatchObject({
      settledAt: 1_789_142_400_000,
      rate: 0.000044,
      basisHours: 8,
    });
    expect(settled.find((e) => e.venueSymbol === "WIFUSDTM")).toMatchObject({
      settledAt: 1_789_142_400_000,
      basisHours: 4,
    });
  });

  test("throws on an error envelope", () => {
    expect(() => parseKucoinSnapshots({ code: "429000", msg: "too many", data: [] }, NOW)).toThrow(
      "429000",
    );
  });

  test("reads a null payload as no contracts", () => {
    expect(parseKucoinSnapshots({ code: "200000", data: null }, NOW)).toEqual({
      snapshots: [],
      settled: [],
    });
  });

  test("carries each contract's declared class onto its snapshot", async () => {
    // Real /contracts/active rows from 2026-09-14.
    const { snapshots, settled } = parseKucoinSnapshots(await fixture("asset-class"), NOW);
    const expected = {
      BBUSDTM: "crypto:BB",
      ONUSDTM: "crypto:ON",
      QNTUSDTM: "crypto:QNT",
      STXUSDTM: "crypto:STX",
      BBXUSDTM: "equity:BBX",
      QNTXUSDTM: "equity:QNTX",
      // Declared METAL; tokens, so marketRef returns them to crypto.
      XAUTUSDTM: "crypto:XAUT",
      PAXGUSDTM: "crypto:PAXG",
      XAGUSDTM: "commodity:XAG",
      CLUSDTM: "commodity:CL",
      NATGASUSDTM: "commodity:NATGAS",
    };
    expect(
      Object.fromEntries(snapshots.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}`])),
    ).toEqual(expected);
    expect(
      Object.fromEntries(settled.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}`])),
    ).toEqual(expected);
  });
});

describe("kucoinAssetClass", () => {
  test("reads assetClass off real rows, where marketType says CRYPTO for metals", async () => {
    const rows: (KucoinContract & { marketType: string })[] = (await fixture("asset-class")).data;
    // Why `marketType` cannot be used: every METAL and COMMODITY row calls itself CRYPTO there.
    expect(
      rows
        .filter((r) => r.assetClass === "METAL" || r.assetClass === "COMMODITY")
        .map((r) => r.marketType),
    ).toEqual(["CRYPTO", "CRYPTO", "CRYPTO", "CRYPTO", "CRYPTO"]);
    expect(
      Object.fromEntries(rows.map((r) => [r.symbol, kucoinAssetClass(r.assetClass, "")])),
    ).toEqual({
      BBUSDTM: "crypto",
      ONUSDTM: "crypto",
      QNTUSDTM: "crypto",
      STXUSDTM: "crypto",
      BBXUSDTM: "equity",
      QNTXUSDTM: "equity",
      XAUTUSDTM: "commodity",
      PAXGUSDTM: "commodity",
      XAGUSDTM: "commodity",
      CLUSDTM: "commodity",
      NATGASUSDTM: "commodity",
    });
  });

  test("an unknown assetClass is still not crypto; a missing one is", () => {
    expect(kucoinAssetClass("FOREX", "EURUSD")).toBe("fx");
    expect(kucoinAssetClass("INDEX", "US500")).toBe("index");
    expect(kucoinAssetClass("ETF", "SPY")).toBe("equity");
    expect(kucoinAssetClass(undefined, "XBT")).toBe("crypto");
  });
});

describe("parseKucoinRiskLimits", () => {
  test("uses the published floor and ceiling, which are already contiguous", async () => {
    const tiers = parseKucoinRiskLimits((await fixture("risk-limit")).data);
    const btc = tiers.filter((t) => t.venueSymbol === "XBTUSDTM");
    expect(btc).toHaveLength(12);

    // initialMargin 0.008 is exactly 1/125, which is how the bounds are known to be quote
    // notional rather than lots: as lots this first band would be a $19m position at 125x.
    expect(btc[0]).toEqual({
      venueId: "kucoin",
      venueSymbol: "XBTUSDTM",
      tier: 1,
      lowerNotionalUsd: 0,
      upperNotionalUsd: 250_000,
      imr: 0.008,
      mmr: 0.004,
      maxLeverage: 125,
    });
    // Unlike Bybit and Gate, KuCoin gives minRiskLimit, so no floor is ever inferred.
    expect(btc[1]).toMatchObject({
      tier: 2,
      lowerNotionalUsd: 250_000,
      upperNotionalUsd: 600_000,
      imr: 0.01,
      maxLeverage: 100,
    });

    const doge = tiers.filter((t) => t.venueSymbol === "DOGEUSDTM");
    expect(doge).toHaveLength(8);
    expect(doge[0]).toMatchObject({ tier: 1, upperNotionalUsd: 60_000, maxLeverage: 75 });
  });
});

describe("parseKucoinFundingHistory", () => {
  test("returns events oldest first with the inferred interval", async () => {
    const events = parseKucoinFundingHistory(await fixture("funding-history"), 4);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_084_800_000, 0.000072, 8],
      [1_789_113_600_000, 0.00005, 8],
      [1_789_142_400_000, 0.000044, 8],
    ]);
    expect(events[0]).toMatchObject({ venueSymbol: "XBTUSDTM", base: "BTC" });
  });

  test("reads a null payload as no settlements", () => {
    expect(parseKucoinFundingHistory({ code: "200000", data: null }, 8)).toEqual([]);
  });
});

describe("kucoinAdapter", () => {
  test("fetchSnapshots makes one bulk request", async () => {
    const active = await fixture("contracts-active");
    const urls: string[] = [];
    const client = {
      venueId: "kucoin",
      getJson: async (url: string) => {
        urls.push(url);
        return active;
      },
    } as unknown as HttpClient;

    const result = await kucoinAdapter.fetchSnapshots(client, NOW);
    expect(result.snapshots).toHaveLength(4);
    expect(urls).toEqual(["https://api-futures.kucoin.com/api/v1/contracts/active"]);
  });

  test("fetchFundingHistory survives the null payload the backfill keeps hitting", async () => {
    const urls: string[] = [];
    const client = {
      venueId: "kucoin",
      getJson: async (url: string) => {
        urls.push(url);
        // KuCoin returns data: null for a window predating the listing, which is most symbols when
        // the backfill reaches 90 days back.
        return url.includes("/funding-rates")
          ? { code: "200000", data: null }
          : { code: "200000", data: { symbol: "NEWUSDTM", fundingRateGranularity: 28_800_000 } };
      },
    } as unknown as HttpClient;

    // This threw "Spread syntax requires ...iterable" in production, so the market errored every
    // sweep instead of being marked exhausted and left alone.
    const events = await kucoinAdapter.fetchFundingHistory?.(
      client,
      "NEWUSDTM",
      NOW - 90 * 86_400_000,
      NOW,
    );
    expect(events).toEqual([]);
    expect(urls.some((url) => url.includes("/funding-rates"))).toBe(true);
  });
});
