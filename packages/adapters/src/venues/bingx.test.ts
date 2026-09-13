import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import { marketRef } from "../parse";
import {
  type BingxContract,
  type BingxOpenInterestEntry,
  bingxAssetClass,
  createBingxAdapter,
  isBingxTradable,
  parseBingxFundingHistory,
  parseBingxOpenInterest,
  parseBingxSnapshots,
} from "./bingx";

const fixture = (name: string) =>
  Bun.file(new URL(`../../__fixtures__/bingx/${name}.json`, import.meta.url)).json();

/** Real rows captured 2026-09-13 ~22:00 UTC. */
const NOW = 1_789_336_846_000;

async function snapshotsWith(openInterest: ReadonlyMap<string, BingxOpenInterestEntry>) {
  return parseBingxSnapshots(
    (await fixture("contracts")).data,
    (await fixture("premiumIndex")).data,
    (await fixture("ticker")).data,
    openInterest,
    NOW,
  );
}

describe("parseBingxSnapshots", () => {
  test("normalizes BTC-USDT", async () => {
    const valueUsd = parseBingxOpenInterest(await fixture("openInterest"));
    if (valueUsd === null) throw new Error("fixture");
    const snapshots = await snapshotsWith(new Map([["BTC-USDT", { valueUsd, fetchedAt: NOW }]]));
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USDT")).toEqual({
      venueId: "bingx",
      venueSymbol: "BTC-USDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.000094,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      markPrice: 77190.5,
      indexPrice: 77225.4,
      bestBid: 77186.1,
      // Quantities are base coin: 14.76 BTC, about $1.14m.
      bestBidSizeUsd: 14.7593 * 77186.1,
      bestAsk: 77186.2,
      bestAskSizeUsd: 52.3119 * 77186.2,
      // Already USD: 287m is 3,719 BTC at this mark.
      openInterestUsd: 287039550.4,
      volume24hUsd: 337831456.71,
    });
  });

  test("keeps listed contracts only, in premiumIndex order", async () => {
    const snapshots = await snapshotsWith(new Map());
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTC-USDT",
      "ETH-USDT",
      "1000PEPE-USDT",
      "BTC-USDC",
      "NCSKTSLA2USD-USDT",
      "NCCOGOLD2USD-USDT",
      "NCFXEUR2USD-USDT",
      "NCSISP5002USD-USDT",
      "PAXG-USDT",
      "IOST-USDT",
    ]);
    // Without a cached open interest the field is null, never a guess.
    expect(snapshots.every((s) => s.openInterestUsd === null)).toBe(true);
  });

  test("skips a premium row whose contract is suspended", async () => {
    const contracts: BingxContract[] = (await fixture("contracts")).data;
    const suspended = contracts.map((c) => (c.symbol === "ETH-USDT" ? { ...c, status: 25 } : c));
    const snapshots = parseBingxSnapshots(
      suspended,
      (await fixture("premiumIndex")).data,
      [],
      new Map(),
      NOW,
    );
    expect(snapshots.map((s) => s.venueSymbol)).not.toContain("ETH-USDT");
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USDT")?.volume24hUsd).toBeNull();
  });

  test("carries class and settlement coin, with the contract code left as the base", async () => {
    const snapshots = await snapshotsWith(new Map());
    expect(
      Object.fromEntries(
        snapshots.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}:${s.quote}`]),
      ),
    ).toEqual({
      "BTC-USDT": "crypto:BTC:USDT",
      "ETH-USDT": "crypto:ETH:USDT",
      "1000PEPE-USDT": "crypto:PEPE:USDT",
      "BTC-USDC": "crypto:BTC:USDC",
      "NCSKTSLA2USD-USDT": "equity:NCSKTSLA2USD:USDT",
      "NCCOGOLD2USD-USDT": "commodity:NCCOGOLD2USD:USDT",
      "NCFXEUR2USD-USDT": "fx:NCFXEUR2USD:USDT",
      // Declared index, but its base is not a canonical index ticker, so marketRef refines it.
      "NCSISP5002USD-USDT": "equity:NCSISP5002USD:USDT",
      // Displayed as PAXG(GOLD); declared crypto by having no tradfi code.
      "PAXG-USDT": "crypto:PAXG:USDT",
      "IOST-USDT": "crypto:IOST:USDT",
    });
  });

  test("reads hourly intervals, contract-size prefixes and base-coin depth", async () => {
    const snapshots = await snapshotsWith(new Map());
    expect(snapshots.find((s) => s.venueSymbol === "IOST-USDT")).toMatchObject({
      rate: -0.000529,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
    });
    expect(snapshots.find((s) => s.venueSymbol === "1000PEPE-USDT")).toMatchObject({
      base: "PEPE",
      multiplier: 1000,
      bestBidSizeUsd: 7586 * 0.003403,
      volume24hUsd: 14962111.26,
    });
  });
});

describe("isBingxTradable", () => {
  test("status 1 and a USDT or USDC settlement", async () => {
    const contracts: BingxContract[] = (await fixture("contracts")).data;
    const coffee = contracts.find((c) => c.symbol === "NCCOCOFFEE2USD-USDT");
    const btc = contracts.find((c) => c.symbol === "BTC-USDT");
    if (!coffee || !btc) throw new Error("fixture");
    expect(isBingxTradable(btc)).toBe(true);
    expect(isBingxTradable(coffee)).toBe(false); // status 25
    expect(isBingxTradable({ ...btc, currency: "USD" })).toBe(false);
  });
});

describe("bingxAssetClass", () => {
  test("reads the tradfi namespace of the contract code", () => {
    expect(bingxAssetClass("BTC")).toBe("crypto");
    expect(bingxAssetClass("NCSKTSLA2USD")).toBe("equity");
    expect(bingxAssetClass("NCSKTMFUSDT")).toBe("equity");
    expect(bingxAssetClass("NCSISP5002USD")).toBe("index");
    expect(bingxAssetClass("NCCOGOLD2USD")).toBe("commodity");
    expect(bingxAssetClass("NCFXEUR2USD")).toBe("fx");
  });

  test("an unknown namespace is tradfi only with the scheme's pricing tail", () => {
    expect(bingxAssetClass("NCBDUS10Y2USD")).toBe("equity");
    expect(bingxAssetClass("NCT")).toBe("crypto");
    expect(bingxAssetClass("NCASH")).toBe("crypto");
  });
});

describe("parseBingxOpenInterest", () => {
  test("returns the quote value and throws on an error envelope", async () => {
    expect(parseBingxOpenInterest(await fixture("openInterest"))).toBe(287039550.4);
    expect(() =>
      parseBingxOpenInterest({
        code: 109400,
        msg: "bad symbol",
        data: { symbol: "", openInterest: "", time: 0 },
      }),
    ).toThrow("109400");
  });
});

describe("parseBingxFundingHistory", () => {
  const ref = marketRef("bingx", "BTC-USDT");

  test("returns events oldest first with the inferred interval and each mark", async () => {
    const { data } = await fixture("fundingRate");
    const events = parseBingxFundingHistory(ref, data, 0, NOW, null);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_257_600_000, 0.000092, 8],
      [1_789_286_400_000, 0.000082, 8],
      [1_789_315_200_000, 0.000078, 8],
    ]);
    expect(events.at(-1)).toMatchObject({ base: "BTC", quote: "USDT", markPrice: 77100.3 });
  });

  test("cuts to the window, and a lone settlement needs a fallback", async () => {
    const { data } = await fixture("fundingRate");
    expect(parseBingxFundingHistory(ref, data, 1_789_286_400_000, NOW, null)).toHaveLength(2);
    expect(parseBingxFundingHistory(ref, data.slice(0, 1), 0, NOW, null)).toEqual([]);
    expect(parseBingxFundingHistory(ref, data.slice(0, 1), 0, NOW, 4)[0]?.basisHours).toBe(4);
  });
});

describe("createBingxAdapter", () => {
  async function fakeClient(history?: (url: string) => unknown) {
    const responses: Record<string, unknown> = {
      "/quote/contracts": await fixture("contracts"),
      "/quote/premiumIndex": await fixture("premiumIndex"),
      "/quote/ticker": await fixture("ticker"),
      "/quote/openInterest": await fixture("openInterest"),
    };
    const urls: string[] = [];
    const client = {
      venueId: "bingx",
      getJson: async (url: string) => {
        urls.push(url);
        if (url.includes("/quote/fundingRate") && history) return history(url);
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
  const path = (url: string) => url.replace("https://open-api.bingx.com/openApi/swap/v2", "");

  test("bulk requests, then open interest a slice at a time, contracts hourly", async () => {
    const { client, urls } = await fakeClient();
    const adapter = createBingxAdapter({ openInterestBudget: 2 });
    expect(adapter.venueId).toBe("bingx");

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls.map(path)).toEqual([
      "/quote/contracts",
      "/quote/premiumIndex",
      "/quote/ticker",
      "/quote/openInterest?symbol=BTC-USDT",
      "/quote/openInterest?symbol=ETH-USDT",
    ]);
    expect(first.snapshots).toHaveLength(10);
    expect(first.snapshots.filter((s) => s.openInterestUsd !== null)).toHaveLength(2);

    urls.length = 0;
    const second = await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls.map(path)).toEqual([
      "/quote/premiumIndex",
      "/quote/ticker",
      "/quote/openInterest?symbol=1000PEPE-USDT",
      "/quote/openInterest?symbol=BTC-USDC",
    ]);
    // The first slice is still cached, so four markets carry open interest now.
    expect(second.snapshots.filter((s) => s.openInterestUsd !== null)).toHaveLength(4);
  });

  test("history pages backwards from the end of the window", async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({
      symbol: "BTC-USDT",
      fundingRate: "0.0001",
      fundingTime: 1_789_315_200_000 - i * 28_800_000,
    }));
    const { data: tail } = await fixture("fundingRate");
    const { client, urls } = await fakeClient((url) =>
      url.includes(`endTime=${NOW}`)
        ? { code: 0, msg: "", data: page }
        : { code: 0, msg: "", data: null },
    );
    const adapter = createBingxAdapter();
    const oldest = Math.min(...page.map((r) => r.fundingTime));
    const events = await adapter.fetchFundingHistory?.(client, "BTC-USDT", 0, NOW);

    expect(urls.map(path)).toEqual([
      `/quote/fundingRate?symbol=BTC-USDT&startTime=0&endTime=${NOW}&limit=1000`,
      `/quote/fundingRate?symbol=BTC-USDT&startTime=0&endTime=${oldest - 1}&limit=1000`,
    ]);
    // An empty window answers `data: null`, which is an empty page, not an error.
    expect(events).toHaveLength(1000);
    expect(events?.[0]?.settledAt).toBe(oldest);
    expect(tail).toHaveLength(3);
  });
});
