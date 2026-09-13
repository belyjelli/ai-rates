import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import {
  COINW_API,
  type CoinwEnvelope,
  type CoinwFundingEntry,
  type CoinwFundingRate,
  type CoinwInstrument,
  type CoinwTicker,
  coinwAssetClass,
  createCoinwAdapter,
  FUNDING_MAX_AGE_MS,
  isCoinwCollectable,
  isCoinwEntryOverdue,
  parseCoinwFundingRate,
  parseCoinwSnapshots,
} from "./coinw";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/coinw/${name}.json`, import.meta.url)).json();

/** `ts` of BTCUSDT in the tickers response the fixtures were trimmed from (2026-09-13 22:29 UTC). */
const NOW = 1_789_338_572_228;
const HOUR = 3_600_000;
/** The 00:00 UTC settlement every fixture contract is next due at. */
const MIDNIGHT = 1_789_344_000_000;
const FUNDED = ["BTC", "ETH", "TRB", "ORDER", "1000PEPE", "SP500"];

async function load() {
  return {
    instruments: (await fixture<CoinwEnvelope<CoinwInstrument[]>>("instruments")).data,
    tickers: (await fixture<CoinwEnvelope<CoinwTicker[]>>("tickers")).data,
  };
}

const fundingFixture = (name: string) =>
  fixture<CoinwEnvelope<CoinwFundingRate | null>>(`fundingRate_${name}`);

async function fundingMap(fetchedAt = NOW): Promise<Map<string, CoinwFundingEntry>> {
  const map = new Map<string, CoinwFundingEntry>();
  for (const name of FUNDED) {
    const parsed = parseCoinwFundingRate(await fundingFixture(name));
    if (parsed) map.set(name, { ...parsed, fetchedAt });
  }
  return map;
}

describe("parseCoinwSnapshots", () => {
  test("normalizes BTCUSDT as a settled rate", async () => {
    const btc = parseCoinwSnapshots({ ...(await load()), funding: await fundingMap() }, NOW).find(
      (s) => s.venueSymbol === "BTCUSDT",
    );
    expect(btc).toEqual({
      venueId: "coinw",
      venueSymbol: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // The 16:00 UTC settlement: Binance settled 0.00006450 at the same instant.
      rate: 0.0000645,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: MIDNIGHT,
      kind: "settled",
      // fair_price; see the adapter header for why it is a mark.
      markPrice: 76768.6,
      indexPrice: null,
      openInterestUsd: null,
      volume24hUsd: null,
      maxLeverage: 200,
    });
  });

  test("USDT contracts with a known, current settlement; USDC and PROPW stay out", async () => {
    const all = parseCoinwSnapshots({ ...(await load()), funding: await fundingMap() }, NOW);
    expect(
      Object.fromEntries(
        all.map((s) => [
          s.venueSymbol,
          `${s.assetClass}:${s.base}:${s.quote}:x${s.multiplier}:${s.rate}/${s.basisHours}h`,
        ]),
      ),
    ).toEqual({
      BTCUSDT: "crypto:BTC:USDT:x1:0.0000645/8h",
      ETHUSDT: "crypto:ETH:USDT:x1:-0.00004585/8h",
      // 4h: the 20:00 settlement, Binance's 0.00000463.
      TRBUSDT: "crypto:TRB:USDT:x1:0.00000463/4h",
      // preOffline, but trading until closeTime.
      ORDERUSDT: "crypto:ORDER:USDT:x1:0.00005/4h",
      "1000PEPEUSDT": "crypto:PEPE:USDT:x1000:0.0001/8h",
      // CoinW declares nothing, so its S&P 500 contract is crypto by rule.
      SP500USDT: "crypto:US500:USDT:x1:0/8h",
    });
    expect(all.every((s) => s.nextFundingAt === MIDNIGHT && s.markPrice !== null)).toBe(true);
  });

  test("a contract is hidden while its rate is missing or a newer settlement is due", async () => {
    const f = await load();
    const funding = await fundingMap();
    funding.delete("ETH");
    funding.set("TRB", { rate: null, settledAt: null, fetchedAt: NOW });
    const symbols = parseCoinwSnapshots({ ...f, funding }, NOW).map((s) => s.venueSymbol);
    expect(symbols).not.toContain("ETHUSDT");
    expect(symbols).not.toContain("TRBUSDT");

    // After 00:00 every cached rate is the previous period's.
    expect(parseCoinwSnapshots({ ...f, funding }, MIDNIGHT)).toEqual([]);
    // And without a ticker there is no price for the identity gate.
    const noBtcTicker = f.tickers.filter((t) => t.name !== "BTCUSDT");
    expect(
      parseCoinwSnapshots({ ...f, tickers: noBtcTicker, funding }, NOW).map((s) => s.venueSymbol),
    ).not.toContain("BTCUSDT");
  });
});

describe("isCoinwCollectable", () => {
  test("USDT, online or before its close, with an interval", async () => {
    const { instruments } = await load();
    const byName = (name: string) => instruments.find((i) => i.name === name) as CoinwInstrument;
    expect(isCoinwCollectable(byName("BTC"), NOW)).toBe(true);
    expect(isCoinwCollectable(byName("BTC_USDC"), NOW)).toBe(false);
    const order = byName("ORDER");
    expect(isCoinwCollectable(order, NOW)).toBe(true);
    expect(isCoinwCollectable(order, order.closeTime as number)).toBe(false);
    expect(isCoinwCollectable({ ...order, closeTime: undefined }, NOW)).toBe(false);
    expect(isCoinwCollectable({ ...byName("BTC"), status: "offline" }, NOW)).toBe(false);
    expect(isCoinwCollectable({ ...byName("BTC"), settledPeriod: 0 }, NOW)).toBe(false);
  });
});

describe("coinwAssetClass", () => {
  test("crypto unless a tradfi tag appears, and then the base tables decide", async () => {
    const [btc] = (await load()).instruments;
    if (!btc) throw new Error("fixture");
    expect(coinwAssetClass(btc, "BTC")).toBe("crypto");
    expect(coinwAssetClass({ ...btc, tradfiTag: undefined }, "BTC")).toBe("crypto");
    expect(coinwAssetClass({ ...btc, tradfiTag: "Stocks" }, "AAPL")).toBe("equity");
    expect(coinwAssetClass({ ...btc, tradfiTag: "美股" }, "XAU")).toBe("commodity");
  });
});

describe("parseCoinwFundingRate and isCoinwEntryOverdue", () => {
  test("reads the settlement, null for an unknown contract, throws otherwise", async () => {
    expect(parseCoinwFundingRate(await fundingFixture("BTC"))).toEqual({
      rate: 0.0000645,
      settledAt: 1_789_315_200_000,
    });
    expect(parseCoinwFundingRate(await fundingFixture("notfound"))).toBeNull();
    expect(() => parseCoinwFundingRate({ code: 500, msg: "Internal", data: null })).toThrow("500");
  });

  test("overdue exactly when the next settlement time has arrived", () => {
    const entry = { rate: 0.0000645, settledAt: 1_789_315_200_000, fetchedAt: NOW };
    expect(isCoinwEntryOverdue(entry, 8, MIDNIGHT - 1)).toBe(false);
    expect(isCoinwEntryOverdue(entry, 8, MIDNIGHT)).toBe(true);
    expect(isCoinwEntryOverdue(entry, 4, NOW)).toBe(true);
    expect(isCoinwEntryOverdue({ ...entry, settledAt: null }, 8, MIDNIGHT)).toBe(false);
  });
});

describe("createCoinwAdapter", () => {
  async function fakeClient(overrides: Map<string, unknown> = new Map()) {
    const responses: Record<string, unknown> = {
      "/perpum/instruments": await fixture("instruments"),
      "/perpumPublic/tickers": await fixture("tickers"),
    };
    const funding = new Map<string, unknown>();
    for (const name of FUNDED) funding.set(name, await fundingFixture(name));
    const notFound = await fundingFixture("notfound");
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "coinw",
      async getJson<T>(url: string): Promise<T> {
        urls.push(url);
        const path = url.slice(COINW_API.length).split("?")[0] as string;
        if (path === "/perpum/fundingRate") {
          const name = new URL(url).searchParams.get("instrument") as string;
          return (overrides.get(name) ?? funding.get(name) ?? notFound) as T;
        }
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
  const fundingCalls = (urls: string[]) =>
    urls
      .filter((u) => u.includes("/perpum/fundingRate"))
      .map((u) => new URL(u).searchParams.get("instrument"));

  test("tickers each cycle, then funding a budgeted slice at a time", async () => {
    const { client, urls } = await fakeClient();
    const adapter = createCoinwAdapter({ fundingRefreshBudget: 3 });
    expect(adapter.venueId).toBe("coinw");
    expect(adapter.fetchFundingHistory).toBeUndefined();

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls.map((u) => u.slice(COINW_API.length))).toEqual([
      "/perpum/instruments",
      "/perpumPublic/tickers",
      "/perpum/fundingRate?instrument=BTC",
      "/perpum/fundingRate?instrument=ETH",
      "/perpum/fundingRate?instrument=TRB",
    ]);
    // A market appears once its rate is known, never before.
    expect(first.snapshots.map((s) => s.venueSymbol)).toEqual(["BTCUSDT", "ETHUSDT", "TRBUSDT"]);
    expect(first.settled.find((e) => e.venueSymbol === "BTCUSDT")).toEqual({
      venueId: "coinw",
      venueSymbol: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      settledAt: 1_789_315_200_000,
      rate: 0.0000645,
      basisHours: 8,
      markPrice: null,
    });

    urls.length = 0;
    const second = await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(fundingCalls(urls)).toEqual(["ORDER", "1000PEPE", "SP500"]);
    expect(second.snapshots).toHaveLength(6);
    expect(second.settled).toHaveLength(3);

    // Everything is fresh: one request, and settlements already reported are not reported again.
    urls.length = 0;
    const third = await adapter.fetchSnapshots(client, NOW + 120_000);
    expect(urls).toHaveLength(1);
    expect(third.snapshots).toHaveLength(6);
    expect(third.settled).toEqual([]);

    // After the max age the oldest slice is re-read, and an unchanged settlement stays unreported.
    urls.length = 0;
    const fourth = await adapter.fetchSnapshots(client, NOW + FUNDING_MAX_AGE_MS);
    expect(fundingCalls(urls)).toEqual(["BTC", "ETH", "TRB"]);
    expect(fourth.settled).toEqual([]);
  });

  test("after a settlement, overdue contracts go first and stay hidden until the new rate lands", async () => {
    const overrides = new Map<string, unknown>();
    const { client, urls } = await fakeClient(overrides);
    const adapter = createCoinwAdapter({ fundingRefreshBudget: 6 });
    await adapter.fetchSnapshots(client, NOW);

    // 00:00 has passed but CoinW still serves the 16:00 settlement: nothing is emitted stale.
    urls.length = 0;
    const lagging = await adapter.fetchSnapshots(client, MIDNIGHT + 30_000);
    expect(fundingCalls(urls)).toEqual(FUNDED);
    expect(lagging.snapshots).toEqual([]);

    overrides.set("BTC", { code: 0, data: { ts: MIDNIGHT, value: 0.000071 }, msg: "" });
    urls.length = 0;
    const landed = await adapter.fetchSnapshots(client, MIDNIGHT + 90_000);
    expect(fundingCalls(urls)).toEqual(FUNDED);
    expect(landed.snapshots.map((s) => [s.venueSymbol, s.rate, s.nextFundingAt])).toEqual([
      ["BTCUSDT", 0.000071, MIDNIGHT + 8 * HOUR],
    ]);
    expect(landed.settled.map((e) => [e.venueSymbol, e.settledAt, e.rate])).toEqual([
      ["BTCUSDT", MIDNIGHT, 0.000071],
    ]);
  });

  test("a contract CoinW doesn't know is retried after 30 minutes, not every cycle", async () => {
    const overrides = new Map<string, unknown>([["TRB", await fundingFixture("notfound")]]);
    const { client, urls } = await fakeClient(overrides);
    const adapter = createCoinwAdapter({ fundingRefreshBudget: 50 });

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(first.snapshots.map((s) => s.venueSymbol)).not.toContain("TRBUSDT");
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(fundingCalls(urls)).toEqual([]);
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 30 * 60_000);
    expect(fundingCalls(urls)).toContain("TRB");
  });
});
