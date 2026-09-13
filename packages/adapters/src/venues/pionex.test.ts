import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import type { HttpClient } from "../http";
import {
  createPionexAdapter,
  PIONEX_API,
  type PionexBookTicker,
  type PionexEnvelope,
  type PionexFundingRate,
  type PionexIndex,
  type PionexIntervalEntry,
  type PionexOpenInterest,
  type PionexSymbol,
  type PionexTicker,
  parsePionexFundingHistory,
  parsePionexSnapshots,
  pionexIntervalHours,
  tradablePionexPerps,
} from "./pionex";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/pionex/${name}`, import.meta.url)).json();

/** `timestamp` of the indexes response the fixtures were trimmed from. */
const NOW = 1_789_336_871_681;
const HOUR = 3_600_000;

async function load() {
  return {
    symbols: await fixture<PionexEnvelope<{ symbols: PionexSymbol[] }>>("symbols.json"),
    indexes: await fixture<PionexEnvelope<{ indexes: PionexIndex[] }>>("indexes.json"),
    tickers: await fixture<PionexEnvelope<{ tickers: PionexTicker[] }>>("tickers.json"),
    openInterests:
      await fixture<PionexEnvelope<{ openInterests: PionexOpenInterest[] }>>("openInterests.json"),
    bookTickers: await fixture<PionexEnvelope<{ tickers: PionexBookTicker[] }>>("bookTickers.json"),
  };
}

const rates = async (symbol: string) =>
  (await fixture<PionexEnvelope<{ rates: PionexFundingRate[] }>>(`fundingRates_${symbol}.json`))
    .data.rates;

async function snapshots(intervals: Map<string, PionexIntervalEntry>) {
  const f = await load();
  return parsePionexSnapshots(
    {
      symbols: tradablePionexPerps(f.symbols.data.symbols),
      indexes: f.indexes.data.indexes,
      tickers: f.tickers.data.tickers,
      openInterests: f.openInterests.data.openInterests,
      bookTickers: f.bookTickers.data.tickers,
      intervals,
    },
    NOW,
  );
}

/** Every fixture symbol at a stand-in 8h, except the three whose interval the history fixtures show. */
async function intervals(): Promise<Map<string, PionexIntervalEntry>> {
  const map = new Map<string, PionexIntervalEntry>(
    (await load()).symbols.data.symbols.map((s) => [s.symbol, { hours: 8, fetchedAt: NOW }]),
  );
  for (const symbol of ["BTC_USDT_PERP", "ACT_USDT_PERP", "AAX_USDT_PERP"]) {
    map.set(symbol, { hours: pionexIntervalHours(await rates(symbol), null), fetchedAt: NOW });
  }
  return map;
}

describe("parsePionexSnapshots", () => {
  test("normalizes BTC_USDT_PERP", async () => {
    const btc = (await snapshots(await intervals())).find((s) => s.venueSymbol === "BTC_USDT_PERP");
    expect(btc).toEqual({
      venueId: "pionex",
      venueSymbol: "BTC_USDT_PERP",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.0000807965,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      markPrice: 77096.44639,
      indexPrice: 77137.4575,
      bestBid: 77102.8,
      bestBidSizeUsd: 10.416 * 77102.8,
      bestAsk: 77102.9,
      bestAskSizeUsd: 10.6274 * 77102.9,
      // Open interest is base units: 1,335 BTC is $102.9M. Read as dollars it would be $1,335.
      openInterestUsd: 1335.1442 * 77096.44639,
      // "1989264906.36774611" as served; a double holds it to 1989264906.367746.
      volume24hUsd: Number("1989264906.36774611"),
    });
    // 0.0000807965 per 8h is 8.85% simple APR.
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 1)).toBeCloseTo(8.8472, 3);
  });

  test("dollar quotes only, and only once the interval is known", async () => {
    const known = await intervals();
    expect((await snapshots(known)).map((s) => s.venueSymbol)).toEqual([
      "BTC_USDT_PERP",
      "ETH_USDT_PERP",
      "0G_USDT_PERP",
      "ACT_USDT_PERP",
      "AAX_USDT_PERP",
      "AAPLX_USDT_PERP",
      "XAU_USDT_PERP",
      // BTC_ETH_PERP prices bitcoin in ether: its open interest is not dollars.
    ]);

    known.delete("ETH_USDT_PERP");
    known.set("XAU_USDT_PERP", { hours: null, fetchedAt: NOW });
    const symbols = (await snapshots(known)).map((s) => s.venueSymbol);
    expect(symbols).not.toContain("ETH_USDT_PERP");
    expect(symbols).not.toContain("XAU_USDT_PERP");
  });

  test("rates are per each perp's own interval", async () => {
    const all = await snapshots(await intervals());
    expect(all.find((s) => s.venueSymbol === "ACT_USDT_PERP")).toMatchObject({
      rate: 0.00005,
      basisHours: 4,
      nextFundingAt: 1_789_344_000_000,
      openInterestUsd: 377367 * 0.009585,
    });
    expect(all.find((s) => s.venueSymbol === "AAX_USDT_PERP")).toMatchObject({
      rate: 0,
      basisHours: 1,
      nextFundingAt: 1_789_340_400_000,
    });
  });

  test("declares no class, so everything is crypto; the symbol's base beats Pionex's coin code", async () => {
    const all = await snapshots(await intervals());
    expect(new Set(all.map((s) => s.assetClass))).toEqual(new Set(["crypto"]));
    // baseCurrency is ZEROG, Pionex's internal code; every other venue lists 0G.
    expect(all.find((s) => s.venueSymbol === "0G_USDT_PERP")).toMatchObject({
      base: "0G",
      quote: "USDT",
    });
    expect(all.find((s) => s.venueSymbol === "AAPLX_USDT_PERP")?.base).toBe("AAPLX");
  });
});

describe("pionexIntervalHours", () => {
  test("reads the spacing of recent settlements", async () => {
    expect(pionexIntervalHours(await rates("BTC_USDT_PERP"), null)).toBe(8);
    expect(pionexIntervalHours(await rates("ACT_USDT_PERP"), null)).toBe(4);
    expect(pionexIntervalHours(await rates("AAX_USDT_PERP"), null)).toBe(1);
  });

  test("a single settlement is measured against the next, and none gives nothing", async () => {
    const [latest] = await rates("BTC_USDT_PERP");
    expect(pionexIntervalHours([latest as PionexFundingRate], 1_789_344_000_000)).toBe(8);
    expect(pionexIntervalHours([latest as PionexFundingRate], null)).toBeNull();
    expect(pionexIntervalHours([], 1_789_344_000_000)).toBeNull();
  });
});

describe("parsePionexFundingHistory", () => {
  test("oldest first, basis from neighbours even outside the window", async () => {
    const btc = await rates("BTC_USDT_PERP");
    expect(
      parsePionexFundingHistory("BTC_USDT_PERP", btc, 0, NOW, null, "USDT").map((e) => [
        e.settledAt,
        e.rate,
        e.basisHours,
      ]),
    ).toEqual([
      [1_789_228_800_000, 0.0000540647, 8],
      [1_789_257_600_000, 0.0000630832, 8],
      [1_789_286_400_000, 0.0000536681, 8],
      [1_789_315_200_000, 0.0000675156, 8],
    ]);
    const lone = parsePionexFundingHistory(
      "AAX_USDT_PERP",
      await rates("AAX_USDT_PERP"),
      1_789_336_800_000,
      NOW,
      null,
    );
    expect(lone).toEqual([
      {
        venueId: "pionex",
        venueSymbol: "AAX_USDT_PERP",
        base: "AAX",
        quote: "USDT",
        multiplier: 1,
        assetClass: "crypto",
        dex: null,
        settledAt: 1_789_336_800_000,
        rate: 0,
        basisHours: 1,
        markPrice: null,
      },
    ]);
  });
});

function fakeClient(route: (url: string) => unknown) {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "pionex",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      return route(url) as T;
    },
    postJson: async () => {
      throw new Error("unexpected POST");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
  return { client, urls };
}

async function bulkRoute() {
  const f = await load();
  const history: Record<string, PionexFundingRate[]> = {
    BTC_USDT_PERP: await rates("BTC_USDT_PERP"),
    ACT_USDT_PERP: await rates("ACT_USDT_PERP"),
    AAX_USDT_PERP: await rates("AAX_USDT_PERP"),
  };
  return (url: string): unknown => {
    const path = url.slice(PIONEX_API.length).split("?")[0];
    if (path === "/common/symbols") return f.symbols;
    if (path === "/market/indexes") return f.indexes;
    if (path === "/market/tickers") return f.tickers;
    if (path === "/market/openInterests") return f.openInterests;
    if (path === "/market/bookTickers") return f.bookTickers;
    if (path === "/market/fundingRates") {
      const symbol = new URL(url).searchParams.get("symbol") as string;
      // Symbols without a history fixture answer as a listing that has not settled yet.
      return { result: true, data: { symbol, rates: history[symbol] ?? [] } };
    }
    throw new Error(`unexpected ${url}`);
  };
}

describe("createPionexAdapter", () => {
  test("four bulk requests a cycle, symbols hourly, intervals a budgeted slice at a time", async () => {
    const { client, urls } = fakeClient(await bulkRoute());
    const adapter = createPionexAdapter();

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls.slice(0, 5)).toEqual([
      `${PIONEX_API}/common/symbols?type=PERP`,
      `${PIONEX_API}/market/indexes`,
      `${PIONEX_API}/market/tickers?type=PERP`,
      `${PIONEX_API}/market/openInterests?type=PERP`,
      `${PIONEX_API}/market/bookTickers?type=PERP`,
    ]);
    // Every tradable symbol lacks an interval, and BTC_ETH_PERP is never asked about.
    expect(urls.slice(5)).toEqual(
      [
        "BTC_USDT_PERP",
        "ETH_USDT_PERP",
        "0G_USDT_PERP",
        "ACT_USDT_PERP",
        "AAX_USDT_PERP",
        "AAPLX_USDT_PERP",
        "XAU_USDT_PERP",
      ].map((s) => `${PIONEX_API}/market/fundingRates?symbol=${s}&limit=4`),
    );
    expect(first.snapshots.map((s) => [s.venueSymbol, s.basisHours])).toEqual([
      ["BTC_USDT_PERP", 8],
      ["ACT_USDT_PERP", 4],
      ["AAX_USDT_PERP", 1],
    ]);

    // Known intervals are not re-read within six hours; unsettled symbols are retried after 30 min.
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toHaveLength(4);
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 31 * 60_000);
    expect(urls.filter((u) => u.includes("fundingRates"))).toHaveLength(4);
    expect(urls.filter((u) => u.includes("common/symbols"))).toHaveLength(0);
  });

  test("honours the budget, and warmUp shows stored markets before their interval is re-read", async () => {
    const { client, urls } = fakeClient(await bulkRoute());
    const adapter = createPionexAdapter({ intervalRefreshBudget: 1 });
    adapter.warmUp?.([
      { venueSymbol: "ETH_USDT_PERP", intervalHours: 8 },
      { venueSymbol: "XAU_USDT_PERP", intervalHours: null },
    ]);

    const batch = await adapter.fetchSnapshots(client, NOW);
    expect(urls.filter((u) => u.includes("fundingRates"))).toEqual([
      `${PIONEX_API}/market/fundingRates?symbol=BTC_USDT_PERP&limit=4`,
    ]);
    expect(batch.snapshots.map((s) => s.venueSymbol)).toEqual(["BTC_USDT_PERP", "ETH_USDT_PERP"]);
  });

  test("history pages backwards by endTime, 100 at a time", async () => {
    const T = 1_789_315_200_000;
    const { client, urls } = fakeClient((url) => {
      const endTime = Number(new URL(url).searchParams.get("endTime"));
      const count = endTime >= T ? 100 : 3;
      const newest = endTime >= T ? T : endTime + 1 - 8 * HOUR;
      return {
        result: true,
        data: {
          rates: Array.from({ length: count }, (_, i) => ({
            fundingRate: "0.0001",
            fundingTime: newest - i * 8 * HOUR,
          })),
        },
      };
    });
    const events =
      (await createPionexAdapter().fetchFundingHistory?.(client, "BTC_USDT_PERP", 0, T)) ?? [];
    const oldestOfFirstPage = T - 99 * 8 * HOUR;
    expect(urls).toEqual([
      `${PIONEX_API}/market/fundingRates?symbol=BTC_USDT_PERP&endTime=${T}&limit=100`,
      `${PIONEX_API}/market/fundingRates?symbol=BTC_USDT_PERP&endTime=${oldestOfFirstPage - 1}&limit=100`,
    ]);
    expect(events).toHaveLength(103);
    expect(events[0]?.settledAt).toBeLessThan(events[1]?.settledAt as number);
    expect(events.every((e) => e.basisHours === 8)).toBe(true);
  });
});
