import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import { marketRef } from "../parse";
import {
  type BitmartContract,
  bitmartAssetClass,
  createBitmartAdapter,
  isBitmartTradable,
  parseBitmartFundingHistory,
  parseBitmartSnapshots,
} from "./bitmart";

const fixture = (name: string) =>
  Bun.file(new URL(`../../__fixtures__/bitmart/${name}.json`, import.meta.url)).json();

/** Real rows captured 2026-09-13 ~22:00 UTC. */
const NOW = 1_789_336_847_000;

describe("parseBitmartSnapshots", () => {
  test("normalizes BTCUSDT", async () => {
    const { snapshots, settled } = parseBitmartSnapshots(await fixture("details"), NOW);
    expect(settled).toEqual([]);
    expect(snapshots.find((s) => s.venueSymbol === "BTCUSDT")).toEqual({
      venueId: "bitmart",
      venueSymbol: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // expected_funding_rate, not funding_rate ("0.0000778" on this row).
      rate: 0.0000929,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      // No mark price in the bulk response.
      markPrice: null,
      indexPrice: 77296.0726087,
      // Contracts x 0.001 BTC x index: $159.0m, not open_interest_value's entry notional.
      openInterestUsd: 2056722 * 0.001 * 77296.0726087,
      volume24hUsd: 1544041296.4726,
      maxLeverage: 200,
    });
  });

  test("skips delisted rows, dead Trading rows and inverse contracts", async () => {
    const { snapshots } = parseBitmartSnapshots(await fixture("details"), NOW);
    // Dropped: BTCUSD (coin-margined, USD-quoted), THETAUSDT (Trading, delist_time 2026-07-25,
    // empty book), CKBUSDT (Delisted).
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "1000PEPEUSDT",
      "BTCUSDC",
      "ESPORTSUSDT",
      "XAUUSDT",
      "SPX500USDT",
      "OPENAIUSDT",
      "EURUSDT",
      "XCUUSDT",
      "JPN225USDT",
      "KIOXIAUSDT",
      "MEITUANUSDT",
    ]);
  });

  test("carries each contract's declared class and settlement coin", async () => {
    const { snapshots } = parseBitmartSnapshots(await fixture("details"), NOW);
    expect(
      Object.fromEntries(
        snapshots.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}:${s.quote}`]),
      ),
    ).toEqual({
      BTCUSDT: "crypto:BTC:USDT",
      ETHUSDT: "crypto:ETH:USDT",
      "1000PEPEUSDT": "crypto:PEPE:USDT",
      BTCUSDC: "crypto:BTC:USDC",
      ESPORTSUSDT: "crypto:ESPORTS:USDT",
      // No tradfi_info on BitMart's gold, so it is crypto by the venue's own declaration.
      XAUUSDT: "crypto:XAU:USDT",
      // US_MARKET, refined to index by the shared table.
      SPX500USDT: "index:US500:USDT",
      OPENAIUSDT: "equity:OPENAI:USDT",
      EURUSDT: "fx:EUR:USDT",
      XCUUSDT: "commodity:XCU:USDT",
      JPN225USDT: "index:JPN225:USDT",
      // INDEX_JP on a single share, refined back to equity.
      KIOXIAUSDT: "equity:KIOXIA:USDT",
      MEITUANUSDT: "equity:MEITUAN:USDT",
    });
  });

  test("converts contracts through contract_size and reads hourly intervals", async () => {
    const { snapshots } = parseBitmartSnapshots(await fixture("details"), NOW);
    // One contract is one "1000PEPE" unit, priced per 1000PEPE, so no further scaling.
    expect(snapshots.find((s) => s.venueSymbol === "1000PEPEUSDT")).toMatchObject({
      multiplier: 1000,
      openInterestUsd: 8941543290 * 1 * 0.0034103,
      volume24hUsd: 13021377.393464,
    });
    expect(snapshots.find((s) => s.venueSymbol === "ESPORTSUSDT")).toMatchObject({
      rate: 0.0001089,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
    });
  });

  test("throws on an error envelope", () => {
    expect(() =>
      parseBitmartSnapshots(
        { code: 30000, message: "Not found", data: null as unknown as { symbols: [] } },
        NOW,
      ),
    ).toThrow("30000");
  });
});

describe("isBitmartTradable", () => {
  test("a scheduled delisting still trades until it arrives", async () => {
    const rows: BitmartContract[] = (await fixture("details")).data.symbols;
    const theta = rows.find((r) => r.symbol === "THETAUSDT");
    if (!theta) throw new Error("fixture");
    expect(isBitmartTradable(theta, NOW)).toBe(false);
    expect(isBitmartTradable({ ...theta, delist_time: NOW / 1000 + 3600 }, NOW)).toBe(true);
    expect(isBitmartTradable({ ...theta, delist_time: 0, product_type: 2 }, NOW)).toBe(false);
  });
});

describe("bitmartAssetClass", () => {
  test("reads market_group, and an unknown group is still tradfi", () => {
    expect(bitmartAssetClass(null, "BTC")).toBe("crypto");
    expect(bitmartAssetClass(undefined, "XAU")).toBe("crypto");
    expect(bitmartAssetClass({ market_group: "HK_STOCK" }, "TENCENT")).toBe("equity");
    expect(bitmartAssetClass({ market_group: "INDEX_DE" }, "GER40")).toBe("index");
    expect(bitmartAssetClass({ market_group: "COMMODITY_CME" }, "XTI")).toBe("commodity");
    expect(bitmartAssetClass({ market_group: "PRE_LIST" }, "ANDURIL")).toBe("equity");
    expect(bitmartAssetClass({ market_group: "BONDS" }, "US10Y")).toBe("index");
    expect(bitmartAssetClass({}, "XAG")).toBe("commodity");
  });
});

describe("parseBitmartFundingHistory", () => {
  const ref = marketRef("bitmart", "BTCUSDT");

  test("returns events oldest first with the inferred interval", async () => {
    const { list } = (await fixture("funding-rate-history")).data;
    expect(
      parseBitmartFundingHistory(ref, list, 0, NOW, null).map((e) => [
        e.settledAt,
        e.rate,
        e.basisHours,
      ]),
    ).toEqual([
      [1_789_257_600_000, 0.000057618, 8],
      [1_789_286_400_000, 0.000068508, 8],
      [1_789_315_200_000, 0.000077802419, 8],
    ]);
  });

  test("a window older than the page is empty, which the backfill reads as the venue's limit", async () => {
    const { list } = (await fixture("funding-rate-history")).data;
    expect(parseBitmartFundingHistory(ref, list, 0, 1_789_200_000_000, null)).toEqual([]);
    expect(parseBitmartFundingHistory(ref, list.slice(0, 1), 0, NOW, 4)[0]?.basisHours).toBe(4);
  });
});

describe("createBitmartAdapter", () => {
  test("one request a cycle, and history carries the class seen in it", async () => {
    const details = await fixture("details");
    const history = await fixture("funding-rate-history");
    const urls: string[] = [];
    const client = {
      venueId: "bitmart",
      getJson: async (url: string) => {
        urls.push(url);
        return url.includes("/funding-rate-history") ? history : details;
      },
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    } as unknown as HttpClient;

    const adapter = createBitmartAdapter();
    expect(adapter.venueId).toBe("bitmart");
    const batch = await adapter.fetchSnapshots(client, NOW);
    expect(batch.snapshots).toHaveLength(13);
    expect(urls).toEqual(["https://api-cloud-v2.bitmart.com/contract/public/details"]);

    urls.length = 0;
    const events = await adapter.fetchFundingHistory?.(client, "SPX500USDT", 0, NOW);
    expect(urls).toEqual([
      "https://api-cloud-v2.bitmart.com/contract/public/funding-rate-history?symbol=SPX500USDT&limit=100",
    ]);
    expect(events?.[0]).toMatchObject({ venueSymbol: "SPX500USDT", assetClass: "index" });
  });
});
