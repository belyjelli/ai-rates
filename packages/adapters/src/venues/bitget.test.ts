import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import { marketRef } from "../parse";
import {
  type BitgetInstrument,
  bitgetAssetClass,
  bitgetMarketRef,
  createBitgetAdapter,
  isBitgetTradable,
  parseBitgetFundingHistory,
  parseBitgetSnapshots,
} from "./bitget";

const fixture = (name: string) =>
  Bun.file(new URL(`../../__fixtures__/bitget/${name}.json`, import.meta.url)).json();

/** Real rows captured 2026-09-13 ~22:06 UTC. */
const NOW = 1_789_337_181_000;

async function book(category: "usdt" | "usdc") {
  return parseBitgetSnapshots(
    (await fixture(`instruments-${category}`)).data,
    await fixture(`tickers-${category}`),
    await fixture(`current-fund-rate-${category}`),
    NOW,
  );
}

describe("parseBitgetSnapshots", () => {
  test("normalizes BTCUSDT", async () => {
    const { snapshots, settled } = await book("usdt");
    expect(settled).toEqual([]);
    expect(snapshots.find((s) => s.venueSymbol === "BTCUSDT")).toEqual({
      venueId: "bitget",
      venueSymbol: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.00005,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      markPrice: 76967.7,
      indexPrice: 76999.899,
      bestBid: 76945.7,
      // Sizes are base coin, so depth is size x price: 1.5424 BTC is about $119k.
      bestBidSizeUsd: 1.5424 * 76945.7,
      bestAsk: 76945.8,
      bestAskSizeUsd: 2.2675 * 76945.8,
      // Base coin x mark: 35,917 BTC is $2.76bn.
      openInterestUsd: 35917.05359999992 * 76967.7,
      volume24hUsd: 1051194916.75318,
      maxLeverage: 150,
    });
  });

  test("keeps online perpetuals that have a funding row, and nothing else", async () => {
    const { snapshots } = await book("usdt");
    // BGTESTMEUSDT is in current-fund-rate but has no instrument, so it never appears.
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SHIBUSDT",
      "PKXUSDT",
      "TSLAUSDT",
      "SP500USDT",
      "XAUUSDT",
      "PAXGUSDT",
      "CLUSDT",
      "EURUSDUSDT",
      "H100USDT",
    ]);
  });

  test("open interest is base coin whatever the contract size", async () => {
    const { snapshots } = await book("usdt");
    // SHIBUSDT's quantityMultiplier is 10,000. Read as contracts this would be $96bn, not $9.6m.
    expect(snapshots.find((s) => s.venueSymbol === "SHIBUSDT")).toMatchObject({
      multiplier: 1,
      openInterestUsd: 1860174806655 * 0.000005184,
      volume24hUsd: 5659113.22571,
    });
  });

  test("reads the USDC book's base, contract size and quote off the declaration", async () => {
    const { snapshots } = await book("usdc");
    expect(snapshots.find((s) => s.venueSymbol === "BTCPERP")).toMatchObject({
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      rate: 0.00004,
      basisHours: 8,
      // The venue's own string, since the literal does not survive as a double.
      openInterestUsd: Number("1361.4079000000003") * 77015.2,
    });
    expect(snapshots.find((s) => s.venueSymbol === "1000BONKPERP")).toMatchObject({
      base: "BONK",
      quote: "USDC",
      multiplier: 1000,
      rate: -0.000015,
      basisHours: 4,
      intervalHours: 4,
    });
  });

  test("carries each instrument's declared class onto its snapshot", async () => {
    const { snapshots } = await book("usdt");
    expect(
      Object.fromEntries(snapshots.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}`])),
    ).toEqual({
      BTCUSDT: "crypto:BTC",
      ETHUSDT: "crypto:ETH",
      SHIBUSDT: "crypto:SHIB",
      PKXUSDT: "equity:PKX",
      TSLAUSDT: "equity:TSLA",
      // Declared stock; the S&P 500 is an index by the shared table.
      SP500USDT: "index:US500",
      XAUUSDT: "commodity:XAU",
      // Declared metal; a token, so marketRef returns it to crypto.
      PAXGUSDT: "crypto:PAXG",
      CLUSDT: "commodity:CL",
      // symbolType says crypto, isRwa says otherwise: the base tables settle which.
      EURUSDUSDT: "fx:EURUSD",
      H100USDT: "index:H100",
    });
  });

  test("throws on an error envelope", () => {
    expect(() =>
      parseBitgetSnapshots(
        [],
        { code: "40034", msg: "bad", data: [] },
        { code: "00000", msg: "success", data: [] },
        NOW,
      ),
    ).toThrow("40034");
  });
});

describe("isBitgetTradable", () => {
  test("rejects anything that is not an online linear perpetual", async () => {
    const [btc] = (await fixture("instruments-usdt")).data as BitgetInstrument[];
    if (!btc) throw new Error("fixture");
    expect(isBitgetTradable(btc)).toBe(true);
    expect(isBitgetTradable({ ...btc, status: "offline" })).toBe(false);
    expect(isBitgetTradable({ ...btc, status: "limit_open" })).toBe(false);
    expect(isBitgetTradable({ ...btc, type: "delivery" })).toBe(false);
    expect(isBitgetTradable({ ...btc, quoteCoin: "USD" })).toBe(false);
  });
});

describe("bitgetAssetClass", () => {
  test("isRwa decides whether, symbolType or the base tables decide which", () => {
    expect(bitgetAssetClass({ symbolType: "crypto", isRwa: "NO" }, "STX")).toBe("crypto");
    expect(bitgetAssetClass({}, "BTC")).toBe("crypto");
    expect(bitgetAssetClass({ symbolType: "stock", isRwa: "YES" }, "CAT")).toBe("equity");
    expect(bitgetAssetClass({ symbolType: "metal", isRwa: "YES" }, "XAU")).toBe("commodity");
    expect(bitgetAssetClass({ symbolType: "crypto", isRwa: "YES" }, "USDJPY")).toBe("fx");
    expect(bitgetAssetClass({ symbolType: "crypto", isRwa: "YES" }, "BHP")).toBe("equity");
  });

  test("an unknown symbolType is still not crypto, so the base tables pick the class", () => {
    expect(bitgetAssetClass({ symbolType: "bond", isRwa: "YES" }, "US10Y")).toBe("index");
    expect(bitgetAssetClass({ symbolType: "forex", isRwa: "NO" }, "EURUSD")).toBe("fx");
  });
});

describe("bitgetMarketRef", () => {
  test("keeps the parser's reading wherever it agrees with the declared base", async () => {
    const rows: BitgetInstrument[] = (await fixture("instruments-usdt")).data;
    for (const row of rows) {
      const { venueId, venueSymbol, base, multiplier, dex } = bitgetMarketRef(row);
      expect({ venueId, venueSymbol, base, multiplier, dex }).toMatchObject({
        venueId: "bitget",
        venueSymbol: row.symbol,
        base: marketRef("bitget", row.symbol).base,
        multiplier: marketRef("bitget", row.symbol).multiplier,
      });
    }
  });
});

describe("parseBitgetFundingHistory", () => {
  const ref = marketRef("bitget", "BTCUSDT");

  test("returns events oldest first with the inferred interval", async () => {
    const { data } = await fixture("history-fund-rate");
    expect(
      parseBitgetFundingHistory(ref, data, 0, NOW, null).map((e) => [
        e.settledAt,
        e.rate,
        e.basisHours,
      ]),
    ).toEqual([
      [1_789_257_600_000, 0.000091, 8],
      [1_789_286_400_000, 0.000082, 8],
      [1_789_315_200_000, 0.000076, 8],
    ]);
  });

  test("cuts to the window but infers the interval from every row", async () => {
    const { data } = await fixture("history-fund-rate");
    const events = parseBitgetFundingHistory(ref, data, 1_789_315_200_000, NOW, null);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ venueSymbol: "BTCUSDT", base: "BTC", basisHours: 8 });
  });

  test("a lone settlement needs a fallback interval", async () => {
    const { data } = await fixture("history-fund-rate");
    expect(parseBitgetFundingHistory(ref, data.slice(0, 1), 0, NOW, null)).toEqual([]);
    expect(parseBitgetFundingHistory(ref, data.slice(0, 1), 0, NOW, 4)[0]?.basisHours).toBe(4);
  });
});

describe("createBitgetAdapter", () => {
  async function fakeClient() {
    const responses: Record<string, unknown> = {
      "instruments?category=USDT-FUTURES": await fixture("instruments-usdt"),
      "instruments?category=USDC-FUTURES": await fixture("instruments-usdc"),
      "tickers?category=USDT-FUTURES": await fixture("tickers-usdt"),
      "tickers?category=USDC-FUTURES": await fixture("tickers-usdc"),
      "current-fund-rate?category=USDT-FUTURES": await fixture("current-fund-rate-usdt"),
      "current-fund-rate?category=USDC-FUTURES": await fixture("current-fund-rate-usdc"),
      "history-fund-rate": await fixture("history-fund-rate"),
    };
    const urls: string[] = [];
    const client = {
      venueId: "bitget",
      getJson: async (url: string) => {
        urls.push(url);
        const key = Object.keys(responses).find((k) => url.includes(k));
        if (!key) throw new Error(`unexpected ${url}`);
        return responses[key];
      },
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    } as unknown as HttpClient;
    return { client, urls };
  }

  test("reads both books in bulk and refreshes instruments hourly", async () => {
    const { client, urls } = await fakeClient();
    const adapter = createBitgetAdapter();
    expect(adapter.venueId).toBe("bitget");

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(first.snapshots).toHaveLength(13);
    expect(urls.map((u) => u.replace("https://api.bitget.com/api/v3/market/", "")).sort()).toEqual([
      "current-fund-rate?category=USDC-FUTURES",
      "current-fund-rate?category=USDT-FUTURES",
      "instruments?category=USDC-FUTURES",
      "instruments?category=USDT-FUTURES",
      "tickers?category=USDC-FUTURES",
      "tickers?category=USDT-FUTURES",
    ]);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    expect(urls.filter((u) => u.includes("instruments"))).toHaveLength(0);
    expect(urls).toHaveLength(4);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 60 * 60_000);
    expect(urls.filter((u) => u.includes("instruments"))).toHaveLength(2);
  });

  test("history asks the book the market was seen in and carries its identity", async () => {
    const { client, urls } = await fakeClient();
    const adapter = createBitgetAdapter();
    await adapter.fetchSnapshots(client, NOW);
    urls.length = 0;

    const events = await adapter.fetchFundingHistory?.(client, "BTCPERP", 0, NOW);
    // A short page is the last page.
    expect(urls).toEqual([
      "https://api.bitget.com/api/v2/mix/market/history-fund-rate?symbol=BTCPERP&productType=usdc-futures&pageSize=100&pageNo=1",
    ]);
    // The fixture rows are BTCUSDT's; the identity comes from the snapshot cycle, not the parser.
    expect(events?.[0]).toMatchObject({ venueSymbol: "BTCPERP", base: "BTC", quote: "USDC" });
  });
});
