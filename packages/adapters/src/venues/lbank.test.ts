import { describe, expect, test } from "bun:test";
import instrumentFixture from "../../__fixtures__/lbank/instrument.json";
import marketDataFixture from "../../__fixtures__/lbank/marketData.json";
import type { HttpClient } from "../http";
import {
  createLbankAdapter,
  LBANK_API,
  type LbankInstrument,
  type LbankMarketData,
  lbankAssetClass,
  parseLbankSnapshots,
  tradableLbankInstruments,
} from "./lbank";

/** Real rows from LBank on 2026-09-13 22:12 UTC: BTC, ETH, 4h and 1h small caps, tradfi, and a dead market. */
const instruments: LbankInstrument[] = instrumentFixture.data;
const rows = marketDataFixture.data as LbankMarketData[];
const AT = 1_789_337_579_000;
const tradable = tradableLbankInstruments(instruments);
const snapshots = parseLbankSnapshots(rows, tradable, AT);
const bySymbol = new Map(snapshots.map((s) => [s.venueSymbol, s]));
const instrument = (symbol: string) =>
  instruments.find((i) => i.symbol === symbol) as LbankInstrument;

const MARKET_DATA = `${LBANK_API}/marketData?productGroup=SwapU`;
const INSTRUMENT = `${LBANK_API}/instrument?productGroup=SwapU`;

function fakeClient(urls: string[]): HttpClient {
  return {
    venueId: "lbank",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      if (url === MARKET_DATA) return marketDataFixture as T;
      if (url === INSTRUMENT) return instrumentFixture as T;
      throw new Error(`unexpected ${url}`);
    },
    postJson: async () => {
      throw new Error("unused");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
}

describe("parseLbankSnapshots", () => {
  test("normalizes BTCUSDT", () => {
    expect(bySymbol.get("BTCUSDT")).toEqual({
      venueId: "lbank",
      venueSymbol: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: AT,
      rate: 0.00007709,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      markPrice: 76926.6,
      indexPrice: 76955.1,
      openInterestUsd: null,
      volume24hUsd: 240366999.2035792, // "240366999.20357918" as served
      maxLeverage: 200,
    });
  });

  test("positionFeeTime is seconds: 28800 is 8h, 14400 is 4h, 3600 is 1h", () => {
    expect(
      ["BTCUSDT", "PUMPUSDT", "VRTUSDT"].map((s) => [
        s,
        bySymbol.get(s)?.basisHours,
        bySymbol.get(s)?.nextFundingAt,
      ]),
    ).toEqual([
      ["BTCUSDT", 8, 1_789_344_000_000],
      ["PUMPUSDT", 4, 1_789_344_000_000],
      // The only hourly markets are the ones settling at 23:00 rather than 00:00.
      ["VRTUSDT", 1, 1_789_340_400_000],
    ]);
  });

  test("the rate is the running estimate, and volume is quote turnover, not base volume", () => {
    expect(snapshots.every((s) => s.kind === "predicted")).toBe(true);
    const eth = rows.find((r) => r.symbol === "ETHUSDT") as LbankMarketData & { volume: string };
    expect(eth.volume).toBe("67957.612");
    expect(bySymbol.get("ETHUSDT")).toMatchObject({
      rate: 0.00006659,
      volume24hUsd: 169322755.99390146, // "169322755.99390147" as served
    });
    expect(snapshots.every((s) => s.openInterestUsd === null)).toBe(true);
  });

  test("reads the contract-size prefix as a multiplier", () => {
    expect(bySymbol.get("1000BTTCUSDT")).toMatchObject({ base: "BTTC", multiplier: 1000 });
  });

  test("a row with no funding rate at all is skipped (10TAUSDT, untraded for 24h)", () => {
    expect(bySymbol.has("10TAUSDT")).toBe(false);
    expect(snapshots).toHaveLength(9);
  });
});

describe("lbank tradability and quote", () => {
  test("only instrumentStatus 2, only listed instruments, only dollar settlement", () => {
    const btc = rows.find((r) => r.symbol === "BTCUSDT") as LbankMarketData;
    expect(parseLbankSnapshots([{ ...btc, instrumentStatus: "1" }], tradable, AT)).toEqual([]);
    expect(parseLbankSnapshots([{ ...btc, symbol: "NEWUSDT" }], tradable, AT)).toEqual([]);
    const coinSettled = tradableLbankInstruments([
      { ...instrument("BTCUSDT"), clearCurrency: "BTC" },
    ]);
    expect(coinSettled.size).toBe(0);
  });

  test("quote is the declared clearCurrency", () => {
    const usdc = tradableLbankInstruments([{ ...instrument("BTCUSDT"), clearCurrency: "USDC" }]);
    expect(parseLbankSnapshots(rows, usdc, AT)[0]?.quote).toBe("USDC");
    expect([...new Set(snapshots.map((s) => s.quote))]).toEqual(["USDT"]);
  });

  test("a declared max leverage of 0 is no figure", () => {
    expect(tradable.get("10TAUSDT")?.maxLeverage).toBeNull();
    expect(tradable.get("GOLDUSDT")?.maxLeverage).toBe(500);
  });
});

describe("lbankAssetClass", () => {
  test("needSuspend 1 is not crypto, and the base tables pick the class", () => {
    expect(instrument("CEGUSDT").needSuspend).toBe(1);
    expect(lbankAssetClass(instrument("CEGUSDT"))).toBe("equity");
    expect(bySymbol.get("SUGARUSDT")?.assetClass).toBe("equity");
    expect(lbankAssetClass({ ...instrument("CEGUSDT"), baseCurrency: "XAL" })).toBe("commodity");
  });

  test("everything else declares nothing and is crypto, gold and Micron included", () => {
    // The alias table files GOLD under XAU; the class stays LBank's, so it never meets commodity:XAU.
    expect(bySymbol.get("GOLDUSDT")).toMatchObject({ base: "XAU", assetClass: "crypto" });
    expect(bySymbol.get("MUSTOCKUSDT")).toMatchObject({ base: "MUSTOCK", assetClass: "crypto" });
    const counts = Object.fromEntries(
      ["crypto", "equity"].map((c) => [c, snapshots.filter((s) => s.assetClass === c).length]),
    );
    expect(counts).toEqual({ crypto: 7, equity: 2 });
  });
});

describe("lbankAdapter", () => {
  test("instrument once an hour, marketData every cycle", async () => {
    const urls: string[] = [];
    const adapter = createLbankAdapter();
    const client = fakeClient(urls);
    expect(adapter.venueId).toBe("lbank");
    expect(adapter.fetchFundingHistory).toBeUndefined();

    const first = await adapter.fetchSnapshots(client, AT);
    expect(urls).toEqual([INSTRUMENT, MARKET_DATA]);
    expect(first).toEqual({ snapshots, settled: [] });

    urls.length = 0;
    await adapter.fetchSnapshots(client, AT + 60_000);
    expect(urls).toEqual([MARKET_DATA]);

    urls.length = 0;
    await adapter.fetchSnapshots(client, AT + 60 * 60_000);
    expect(urls).toEqual([INSTRUMENT, MARKET_DATA]);
  });

  test("an error envelope fails the cycle", async () => {
    const client: HttpClient = {
      ...fakeClient([]),
      getJson: async <T>() =>
        ({ data: null, error_code: 10004, msg: "limit", success: false }) as T,
    };
    await expect(createLbankAdapter().fetchSnapshots(client, AT)).rejects.toThrow("lbank");
  });
});
