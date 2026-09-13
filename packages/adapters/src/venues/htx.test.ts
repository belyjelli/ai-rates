import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import {
  createHtxAdapter,
  HTX_API,
  type HtxContractInfo,
  type HtxEnvelope,
  type HtxFundingHistoryItem,
  type HtxFundingHistoryPage,
  type HtxFundingRate,
  type HtxIndex,
  type HtxMergedEnvelope,
  type HtxOpenInterest,
  htxAssetClass,
  parseHtxFundingHistory,
  parseHtxSnapshots,
  tradableHtxSwaps,
} from "./htx";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/htx/${name}`, import.meta.url)).json();

/** `ts` of the batch funding response the fixtures were trimmed from. */
const NOW = 1_789_336_869_034;
const HOUR = 3_600_000;

async function load() {
  const info = await fixture<HtxEnvelope<HtxContractInfo[]>>("contract_info.json");
  const funding = await fixture<HtxEnvelope<HtxFundingRate[]>>("batch_funding_rate.json");
  const openInterest = await fixture<HtxEnvelope<HtxOpenInterest[]>>("open_interest.json");
  const indices = await fixture<HtxEnvelope<HtxIndex[]>>("swap_index.json");
  const merged = await fixture<HtxMergedEnvelope>("batch_merged.json");
  return { info, funding, openInterest, indices, merged };
}

async function snapshots() {
  const f = await load();
  return parseHtxSnapshots(
    {
      contracts: tradableHtxSwaps(f.info.data),
      funding: f.funding.data,
      openInterest: f.openInterest.data,
      indices: f.indices.data,
      ticks: f.merged.ticks,
    },
    NOW,
  );
}

describe("parseHtxSnapshots", () => {
  test("normalizes BTC-USDT", async () => {
    expect((await snapshots()).find((s) => s.venueSymbol === "BTC-USDT")).toEqual({
      venueId: "htx",
      venueSymbol: "BTC-USDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.00004317342907712,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      // Published only per contract, so not faked from the last trade.
      markPrice: null,
      indexPrice: 77154.55428571429,
      bestBid: 77105,
      // Ticker sizes are contracts of 0.001 BTC: a bid of 20 is 0.02 BTC, about $1,542.
      bestBidSizeUsd: 20 * 0.001 * 77105,
      bestAsk: 77105.1,
      bestAskSizeUsd: 7980 * 0.001 * 77105.1,
      // `value` is USDT already: 28,808.125 BTC x index 77,154.55 is within 0.06% of it.
      openInterestUsd: 2221334021.6875,
      volume24hUsd: 145152802.919,
    });
  });

  test("keeps listing swaps only: no suspended swap, no delivery future, no delisted OI row", async () => {
    const symbols = (await snapshots()).map((s) => s.venueSymbol);
    expect(symbols).toEqual([
      "BTC-USDT",
      "ETH-USDT",
      "PEPE-USDT",
      "BOME-USDT",
      "XAU-USDT",
      "PAXG-USDT",
      "USOIL-USDT",
      "META-USDT",
      "JP225-USDT",
      "TQQQ-USDT",
      "SPX500-USDT",
      "XOM-USDT",
    ]);
    // CYBER-USDT is contract_status 3 (suspended) with a funding_time from January.
    expect(symbols).not.toContain("CYBER-USDT");
    expect(symbols).not.toContain("BTC-USDT-260918");
    expect(symbols).not.toContain("CVX-USDT");
  });

  test("uses each swap's own settlement period and does not rescale a huge contract size", async () => {
    const all = await snapshots();
    expect(all.find((s) => s.venueSymbol === "BOME-USDT")).toMatchObject({
      basisHours: 4,
      intervalHours: 4,
    });
    expect(all.find((s) => s.venueSymbol === "JP225-USDT")).toMatchObject({
      basisHours: 1,
      intervalHours: 1,
    });

    // PEPE-USDT is 1,000,000 PEPE a contract. The price is per PEPE, the symbol carries no prefix,
    // and `value` is already dollars, so only the book sizes need the contract size.
    const f = await load();
    const pepe = all.find((s) => s.venueSymbol === "PEPE-USDT");
    const tick = f.merged.ticks.find((t) => t.contract_code === "PEPE-USDT");
    const oi = f.openInterest.data.find((o) => o.contract_code === "PEPE-USDT");
    expect(pepe).toMatchObject({ base: "PEPE", multiplier: 1, openInterestUsd: oi?.value });
    const bid = (tick?.bid ?? []) as number[];
    expect(pepe?.bestBidSizeUsd).toBeCloseTo(
      (bid[1] as number) * 1_000_000 * (bid[0] as number),
      6,
    );
  });

  test("carries the declared class, refined by marketRef, and the partition as quote", async () => {
    const all = await snapshots();
    expect(
      Object.fromEntries(all.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}`])),
    ).toEqual({
      "BTC-USDT": "crypto:BTC",
      "ETH-USDT": "crypto:ETH",
      "PEPE-USDT": "crypto:PEPE",
      "BOME-USDT": "crypto:BOME",
      "XAU-USDT": "commodity:XAU", // ["Metals"]
      "PAXG-USDT": "crypto:PAXG", // ["Metals"], returned to crypto as a gold token
      "USOIL-USDT": "commodity:USOIL", // ["Commodities"]
      "META-USDT": "equity:META", // ["Stocks"]
      "JP225-USDT": "index:JP225", // ["Stocks"], an index by the base table
      "TQQQ-USDT": "equity:TQQQ", // ["Stocks","Indices"], an ETF
      "SPX500-USDT": "index:US500", // ["Indices"]
      "XOM-USDT": "equity:XOM", // no tradfi_labels; labels ["stock"]
    });
    expect(new Set(all.map((s) => s.quote))).toEqual(new Set(["USDT"]));
  });
});

describe("htxAssetClass", () => {
  test("reads tradfi_labels first, then the lowercase labels", () => {
    expect(htxAssetClass({ labels: ["hot", "common"], tradfi_labels: [] }, "BTC")).toBe("crypto");
    expect(htxAssetClass({ labels: ["stock"], tradfi_labels: [] }, "XOM")).toBe("equity");
    expect(htxAssetClass({ labels: ["indices"], tradfi_labels: [] }, "XLK")).toBe("index");
    expect(
      htxAssetClass({ labels: ["tradfi", "indices"], tradfi_labels: ["Stocks"] }, "JP225"),
    ).toBe("equity");
  });

  test("never reads a class off an undeclared ticker", () => {
    // EURUSD-USDT carries neither field on HTX.
    expect(htxAssetClass({ labels: ["common"], tradfi_labels: [] }, "EURUSD")).toBe("crypto");
    expect(htxAssetClass({}, "XAU")).toBe("crypto");
  });

  test("a tradfi flag with labels new to us goes to the base tables, not to crypto", () => {
    expect(htxAssetClass({ labels: ["tradfi"], tradfi_labels: ["Bonds"] }, "US10Y")).toBe("index");
    expect(htxAssetClass({ labels: ["tradfi"], tradfi_labels: [] }, "XAG")).toBe("commodity");
    expect(htxAssetClass({ labels: ["tradfi"], tradfi_labels: ["Crypto?"] }, "NVDA")).toBe(
      "equity",
    );
  });
});

describe("parseHtxFundingHistory", () => {
  test("returns BTC-USDT settlements oldest first with an 8h basis", async () => {
    const page = await fixture<HtxEnvelope<HtxFundingHistoryPage>>(
      "historical_funding_rate_BTC-USDT.json",
    );
    const events = parseHtxFundingHistory(
      "BTC-USDT",
      page.data.data,
      0,
      Number.MAX_SAFE_INTEGER,
      null,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_200_000_000, 0.0001, 8],
      [1_789_228_800_000, Number("0.000050684203575903"), 8],
      [1_789_257_600_000, 0.0001, 8],
      [1_789_286_400_000, 0.0001, 8],
      [1_789_315_200_000, 0.0001, 8],
    ]);
    expect(events[0]).toMatchObject({ venueId: "htx", base: "BTC", markPrice: null });
  });

  test("measures a lone in-window settlement against its neighbours outside the window", async () => {
    const page = await fixture<HtxEnvelope<HtxFundingHistoryPage>>(
      "historical_funding_rate_JP225-USDT.json",
    );
    const info = await fixture<HtxEnvelope<HtxContractInfo[]>>("contract_info.json");
    const jp225 = info.data.find((c) => c.contract_code === "JP225-USDT");
    const events = parseHtxFundingHistory(
      "JP225-USDT",
      page.data.data,
      1_789_336_800_000,
      1_789_336_800_000,
      null,
      jp225,
    );
    expect(events).toEqual([
      {
        venueId: "htx",
        venueSymbol: "JP225-USDT",
        base: "JP225",
        quote: "USDT",
        multiplier: 1,
        assetClass: "index",
        dex: null,
        settledAt: 1_789_336_800_000,
        rate: 0.00000625,
        basisHours: 1,
        markPrice: null,
      },
    ]);
  });
});

function fakeClient(route: (url: string) => unknown) {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "htx",
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

describe("createHtxAdapter", () => {
  async function bulkRoute() {
    const f = await load();
    const history = await fixture<unknown>("historical_funding_rate_BTC-USDT.json");
    return (url: string): unknown => {
      if (url.includes("/swap_contract_info")) return f.info;
      if (url.includes("/swap_batch_funding_rate")) return f.funding;
      if (url.includes("/swap_open_interest")) return f.openInterest;
      if (url.includes("/swap_index")) return f.indices;
      if (url.includes("/batch_merged")) return f.merged;
      if (url.includes("/swap_historical_funding_rate")) return history;
      throw new Error(`unexpected ${url}`);
    };
  }

  test("makes four bulk requests a cycle and reads contract info hourly", async () => {
    const { client, urls } = fakeClient(await bulkRoute());
    const adapter = createHtxAdapter();

    const batch = await adapter.fetchSnapshots(client, NOW);
    expect(batch.snapshots).toHaveLength(12);
    expect(batch.settled).toEqual([]);
    expect(urls).toEqual([
      `${HTX_API}/linear-swap-api/v1/swap_contract_info?business_type=swap`,
      `${HTX_API}/linear-swap-api/v1/swap_batch_funding_rate`,
      `${HTX_API}/linear-swap-api/v1/swap_open_interest?business_type=swap`,
      `${HTX_API}/linear-swap-api/v1/swap_index`,
      `${HTX_API}/linear-swap-ex/market/detail/batch_merged?business_type=swap`,
    ]);

    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    expect(urls.filter((u) => u.includes("swap_contract_info"))).toHaveLength(1);
    await adapter.fetchSnapshots(client, NOW + HOUR);
    expect(urls.filter((u) => u.includes("swap_contract_info"))).toHaveLength(2);
    // 5 + 4 + 5: contract info on the first cycle and again once an hour has passed.
    expect(urls).toHaveLength(14);
  });

  test("throws on an error envelope", async () => {
    const route = await bulkRoute();
    const { client } = fakeClient((url) =>
      url.includes("/swap_index")
        ? { status: "error", err_code: 1017, err_msg: "Query not supported" }
        : route(url),
    );
    await expect(createHtxAdapter().fetchSnapshots(client, NOW)).rejects.toThrow("1017");
  });

  test("history loads contract info when no cycle has run, and stops paging past fromMs", async () => {
    const T = 1_789_315_200_000;
    const page = (index: number): HtxEnvelope<HtxFundingHistoryPage> => ({
      status: "ok",
      data: {
        total_page: 65,
        current_page: index,
        total_size: 6460,
        data: Array.from(
          { length: 100 },
          (_, i): HtxFundingHistoryItem => ({
            contract_code: "BTC-USDT",
            funding_rate: "0.0001",
            funding_time: String(T - ((index - 1) * 100 + i) * 8 * HOUR),
          }),
        ),
      },
    });
    const info = (await load()).info;
    const { client, urls } = fakeClient((url) => {
      if (url.includes("/swap_contract_info")) return info;
      return page(Number(new URL(url).searchParams.get("page_index")));
    });

    const fromMs = T - 150 * 8 * HOUR;
    const events =
      (await createHtxAdapter().fetchFundingHistory?.(client, "BTC-USDT", fromMs, T)) ?? [];
    expect(urls[0]).toContain("swap_contract_info");
    expect(urls.slice(1)).toEqual(
      [1, 2].map(
        (n) =>
          `${HTX_API}/linear-swap-api/v1/swap_historical_funding_rate?contract_code=BTC-USDT&page_index=${n}&page_size=100`,
      ),
    );
    expect(events).toHaveLength(151);
    expect(events[0]?.settledAt).toBe(fromMs);
    expect(events.at(-1)?.settledAt).toBe(T);
    expect(events.every((e) => e.basisHours === 8 && e.quote === "USDT")).toBe(true);
  });
});
