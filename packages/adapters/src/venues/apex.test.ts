import { describe, expect, test } from "bun:test";
import { CircuitOpenError, type HttpClient } from "../http";
import {
  APEX_API,
  type ApexFundingRow,
  type ApexMarket,
  type ApexSymbols,
  type ApexTicker,
  apexAssetClass,
  createApexAdapter,
  parseApexFunding,
  parseApexTicker,
  tradableApexContracts,
} from "./apex";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/apex/${name}`, import.meta.url)).json();

/** Around when the ticker fixtures were fetched, 2026-09-13 22:29 UTC. */
const NOW = 1_789_338_543_000;

const symbols = () => fixture<ApexSymbols>("symbols.json");
const markets = async () => tradableApexContracts(await symbols());
const ticker = async (cross: string) =>
  (await fixture<{ data: ApexTicker[] }>(`ticker_${cross}.json`)).data[0] as ApexTicker;
const market = async (symbol: string) => (await markets()).get(symbol) as ApexMarket;

describe("parseApexTicker", () => {
  test("normalizes BTC-USDT", async () => {
    expect(parseApexTicker(await market("BTC-USDT"), await ticker("BTCUSDT"), NOW)).toEqual({
      venueId: "apex",
      venueSymbol: "BTC-USDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // `fundingRate`, the running estimate; `predictedFundingRate` (0.0000125) is interest alone.
      rate: -0.00002065,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: Date.parse("2026-09-13T23:00:00Z"),
      kind: "predicted",
      markPrice: 76737.49,
      indexPrice: 76776.58,
      // Base units: 1,578 BTC is $121M.
      openInterestUsd: 1578.334 * 76737.49,
      volume24hUsd: 565416965.9734,
      maxLeverage: 100,
    });
  });

  test("reads fundingRate, never predictedFundingRate", async () => {
    const eth = await ticker("ETHUSDT");
    expect(eth.predictedFundingRate).toBe("0.0000125");
    expect(parseApexTicker(await market("ETH-USDT"), eth, NOW)?.rate).toBe(-0.0000148);
  });

  test("nothing is emitted without a rate, a mark, or the ticker it asked for", async () => {
    const btc = await market("BTC-USDT");
    const base = await ticker("BTCUSDT");
    expect(parseApexTicker(btc, { ...base, fundingRate: "" }, NOW)).toBeNull();
    expect(parseApexTicker(btc, { ...base, markPrice: undefined }, NOW)).toBeNull();
    expect(parseApexTicker(btc, { ...base, symbol: "ETHUSDT" }, NOW)).toBeNull();
    expect(parseApexTicker(btc, undefined, NOW)).toBeNull();
  });
});

describe("tradability, class, quote and base", () => {
  test("live perpetual and stock contracts only; prediction contracts never", async () => {
    expect([...(await markets()).keys()]).toEqual([
      "BTC-USDT",
      "ETH-USDT",
      "1000PEPE-USDT",
      "PAXG-USDT",
      // TON-USDT is delisted.
      "SPCX-USDT",
      "XAU-USDT",
      "SPY-USDT",
      "SOXL-USDT",
      // IWM-USDT is delisted; Donald_Trump_win_Presidential_Election_2028-USDT is a prediction
      // contract, live on ApeX but not a perpetual on an asset.
    ]);
    const body = await symbols();
    const btc = body.data.contractConfig.perpetualContract?.[0];
    if (btc) btc.enableOpenPosition = false;
    expect((await tradableApexContracts(body)).has("BTC-USDT")).toBe(false);
  });

  test("class from the list and the stock category", async () => {
    const all = await markets();
    const btc = await ticker("BTCUSDT");
    const rows = [...all.values()].map((m) => {
      const s = parseApexTicker(m, { ...btc, symbol: m.contract.crossSymbolName }, NOW);
      return [s?.venueSymbol, s?.base, s?.multiplier, s?.assetClass, s?.quote];
    });
    expect(rows).toEqual([
      ["BTC-USDT", "BTC", 1, "crypto", "USDT"],
      ["ETH-USDT", "ETH", 1, "crypto", "USDT"],
      ["1000PEPE-USDT", "PEPE", 1000, "crypto", "USDT"],
      ["PAXG-USDT", "PAXG", 1, "crypto", "USDT"],
      ["SPCX-USDT", "SPCX", 1, "equity", "USDT"],
      ["XAU-USDT", "XAU", 1, "commodity", "USDT"],
      // Declared INDEX; SPY is an ETF, which core files as equity.
      ["SPY-USDT", "SPY", 1, "equity", "USDT"],
      // No category at all: classifyNonCrypto.
      ["SOXL-USDT", "SOXL", 1, "equity", "USDT"],
    ]);
    const spcx = await market("SPCX-USDT");
    expect(parseApexTicker(spcx, await ticker("SPCXUSDT"), NOW)?.assetClass).toBe("equity");
    expect(
      apexAssetClass({ ...spcx, contract: { ...spcx.contract, category: "INDEX" } }, "US500"),
    ).toBe("index");
    expect(
      apexAssetClass({ ...spcx, contract: { ...spcx.contract, category: "NEW" } }, "XAG"),
    ).toBe("commodity");
  });
});

describe("parseApexFunding", () => {
  test("hourly, oldest first, no mark", async () => {
    const rows = (
      await fixture<{ data: { historyFunds: ApexFundingRow[] } }>("history-funding_BTC-USDT.json")
    ).data.historyFunds;
    const events = parseApexFunding(rows, await market("BTC-USDT"), 1_789_329_600_000, NOW);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours, e.markPrice])).toEqual([
      [1_789_329_600_000, 0.00000991, 1, null],
      [1_789_333_200_000, 0.00000779, 1, null],
      [1_789_336_800_000, 0.00000748, 1, null],
    ]);
    expect(events[0]).toMatchObject({ venueSymbol: "BTC-USDT", base: "BTC", quote: "USDT" });
  });
});

function fakeClient(route: (url: string) => unknown) {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "apex",
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

async function route() {
  const body = await symbols();
  const tickers: Record<string, ApexTicker> = {
    BTCUSDT: await ticker("BTCUSDT"),
    ETHUSDT: await ticker("ETHUSDT"),
    SPCXUSDT: await ticker("SPCXUSDT"),
  };
  return (url: string): unknown => {
    if (url === `${APEX_API}/symbols`) return body;
    if (url.startsWith(`${APEX_API}/ticker?`)) {
      const cross = new URL(url).searchParams.get("symbol") as string;
      // Symbols without a fixture answer as the venue does for an unknown symbol.
      return { data: tickers[cross] ? [tickers[cross]] : [] };
    }
    throw new Error(`unexpected ${url}`);
  };
}

const tickerUrl = (cross: string) => `${APEX_API}/ticker?symbol=${cross}`;

describe("createApexAdapter", () => {
  test("symbols hourly; a rotating slice of tickers, emitting only what this cycle read", async () => {
    const { client, urls } = fakeClient(await route());
    const adapter = createApexAdapter({ tickerBudget: 3 });

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls).toEqual([
      `${APEX_API}/symbols`,
      tickerUrl("BTCUSDT"),
      tickerUrl("ETHUSDT"),
      tickerUrl("1000PEPEUSDT"),
    ]);
    expect(first.snapshots.map((s) => s.venueSymbol)).toEqual(["BTC-USDT", "ETH-USDT"]);

    urls.length = 0;
    const second = await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toEqual([tickerUrl("PAXGUSDT"), tickerUrl("SPCXUSDT"), tickerUrl("XAUUSDT")]);
    expect(second.snapshots.map((s) => [s.venueSymbol, s.observedAt])).toEqual([
      ["SPCX-USDT", NOW + 60_000],
    ]);

    // Eight contracts at three a cycle: the third cycle finishes the sweep and wraps to BTC.
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 120_000);
    expect(urls).toEqual([tickerUrl("SPYUSDT"), tickerUrl("SOXLUSDT"), tickerUrl("BTCUSDT")]);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 60 * 60_000);
    expect(urls[0]).toBe(`${APEX_API}/symbols`);
  });

  test("the default budget sweeps 125 contracts in two cycles", async () => {
    const contracts = Array.from({ length: 125 }, (_, i) => ({
      symbol: `C${i}-USDT`,
      crossSymbolName: `C${i}USDT`,
      baseTokenId: `C${i}`,
      settleAssetId: "USDT",
      enableTrade: true,
      enableDisplay: true,
      enableOpenPosition: true,
    }));
    const { client, urls } = fakeClient((url) =>
      url.endsWith("/symbols")
        ? { data: { contractConfig: { perpetualContract: contracts } } }
        : { data: [] },
    );
    const adapter = createApexAdapter();
    await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 60_000);
    const tickers = urls.filter((u) => u.includes("/ticker?"));
    expect(tickers).toHaveLength(128);
    expect(new Set(tickers.slice(0, 125)).size).toBe(125);
  });

  test("a cycle whose every ticker fails is an error, not an empty venue", async () => {
    const body = await symbols();
    const { client } = fakeClient((url) => {
      if (url.endsWith("/symbols")) return body;
      throw new CircuitOpenError("apex", NOW + 300_000);
    });
    await expect(createApexAdapter().fetchSnapshots(client, NOW)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
  });

  test("history pages back 100 at a time by endTimeExclusive", async () => {
    const body = await symbols();
    const H = 3_600_000;
    const T = 1_789_336_800_000;
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/symbols")) return body;
      const end = Number(new URL(url).searchParams.get("endTimeExclusive"));
      const newest = Math.floor((end - 1) / H) * H;
      const count = newest === T ? 100 : 3;
      return {
        data: {
          historyFunds: Array.from({ length: count }, (_, i) => ({
            symbol: "BTC-USDT",
            rate: "0.0000125",
            price: "77000",
            fundingTime: newest - i * H,
          })),
        },
      };
    });
    const events =
      (await createApexAdapter().fetchFundingHistory?.(client, "BTC-USDT", 0, T)) ?? [];
    const oldestFirstPage = T - 99 * H;
    expect(urls.slice(1)).toEqual([
      `${APEX_API}/history-funding?symbol=BTC-USDT&limit=100&beginTimeInclusive=0&endTimeExclusive=${T + 1}`,
      `${APEX_API}/history-funding?symbol=BTC-USDT&limit=100&beginTimeInclusive=0&endTimeExclusive=${oldestFirstPage}`,
    ]);
    expect(events).toHaveLength(103);
    expect(events.every((e) => e.basisHours === 1 && e.markPrice === null)).toBe(true);
    expect(await createApexAdapter().fetchFundingHistory?.(client, "NOPE-USDT", 0, T)).toEqual([]);
  });
});
