import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import type { HttpClient } from "../http";
import {
  createOrderlyAdapter,
  ORDERLY_API,
  type OrderlyEnvelope,
  type OrderlyFundingHistoryPage,
  type OrderlyFundingRate,
  type OrderlyFuture,
  type OrderlyInfo,
  type OrderlyRows,
  parseOrderlyFundingHistory,
  parseOrderlySnapshots,
  tradableOrderlyPerps,
} from "./orderly";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/orderly/${name}`, import.meta.url)).json();

/** `timestamp` of the futures response the fixtures were trimmed from. */
const NOW = 1_789_336_872_547;
const HOUR = 3_600_000;

async function load() {
  return {
    info: await fixture<OrderlyEnvelope<OrderlyRows<OrderlyInfo>>>("info.json"),
    futures: await fixture<OrderlyEnvelope<OrderlyRows<OrderlyFuture>>>("futures.json"),
    fundingRates:
      await fixture<OrderlyEnvelope<OrderlyRows<OrderlyFundingRate>>>("funding_rates.json"),
  };
}

async function batch() {
  const f = await load();
  return parseOrderlySnapshots(
    {
      markets: tradableOrderlyPerps(f.info.data.rows),
      futures: f.futures.data.rows,
      fundingRates: f.fundingRates.data.rows,
    },
    NOW,
  );
}

describe("parseOrderlySnapshots", () => {
  test("normalizes PERP_BTC_USDC", async () => {
    expect((await batch()).snapshots.find((s) => s.venueSymbol === "PERP_BTC_USDC")).toEqual({
      venueId: "orderly",
      venueSymbol: "PERP_BTC_USDC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // est_funding_rate, the forward-looking one; last_funding_rate (0.00009988) is a settlement.
      rate: 0.0001,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      markPrice: 77090.2,
      indexPrice: 77116.1,
      // open_interest is base units: 26.43846 BTC.
      openInterestUsd: 26.43846 * 77090.2,
      volume24hUsd: 2461419.108083,
    });
  });

  test("emits the last settlement from /funding_rates at its own timestamp", async () => {
    const { settled } = await batch();
    expect(settled.find((e) => e.venueSymbol === "PERP_BTC_USDC")).toEqual({
      venueId: "orderly",
      venueSymbol: "PERP_BTC_USDC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      settledAt: 1_789_315_200_000,
      rate: 0.00009988,
      basisHours: 8,
      markPrice: null,
    });
    expect(settled.find((e) => e.venueSymbol === "PERP_HYPE_USDC")).toMatchObject({
      settledAt: 1_789_329_600_000,
      rate: 0.00004991,
      basisHours: 4,
    });
  });

  test("rates on 4h markets are per 4h, not per 8h", async () => {
    const hype = (await batch()).snapshots.find((s) => s.venueSymbol === "PERP_HYPE_USDC");
    // The resting rate is 0.01% per 8h; a 4h market quotes half of it, so it is a per-period rate.
    expect(hype).toMatchObject({ rate: 0.00005, basisHours: 4, intervalHours: 4 });
    expect(aprFromRate(hype?.rate ?? 0, "fraction", hype?.basisHours ?? 1)).toBeCloseTo(10.95, 6);
  });

  test("parses every symbol shape, broker suffixes and size prefixes included", async () => {
    const { snapshots } = await batch();
    expect(
      snapshots.map((s) => [s.venueSymbol, s.base, s.quote, s.multiplier, s.assetClass]),
    ).toEqual([
      ["PERP_BTC_USDC", "BTC", "USDC", 1, "crypto"],
      ["PERP_ETH_USDC", "ETH", "USDC", 1, "crypto"],
      ["PERP_1000PEPE_USDC", "PEPE", "USDC", 1000, "crypto"],
      ["PERP_HYPE_USDC", "HYPE", "USDC", 1, "crypto"],
      // Orderly's public API declares no class, so these are crypto by the rule, not by choice.
      ["PERP_XAU_USDC", "XAU", "USDC", 1, "crypto"],
      ["PERP_SPX500_USDC", "US500", "USDC", 1, "crypto"],
      ["PERP_EURUSD_USDC", "EURUSD", "USDC", 1, "crypto"],
      // A broker-listed market on the shared book.
      ["PERP_AAPL_USDC_mythos", "AAPL", "USDC", 1, "crypto"],
    ]);
  });

  test("skips markets that are not ACTIVE or not in /info", async () => {
    const f = await load();
    const info = f.info.data.rows.map((m) =>
      m.symbol === "PERP_ETH_USDC" ? { ...m, status: "SUSPENDED" } : m,
    );
    const { snapshots, settled } = parseOrderlySnapshots(
      {
        markets: tradableOrderlyPerps(info.filter((m) => m.symbol !== "PERP_XAU_USDC")),
        futures: f.futures.data.rows,
        fundingRates: f.fundingRates.data.rows,
      },
      NOW,
    );
    for (const list of [snapshots, settled]) {
      const symbols = list.map((s) => s.venueSymbol);
      expect(symbols).not.toContain("PERP_ETH_USDC");
      expect(symbols).not.toContain("PERP_XAU_USDC");
      expect(symbols).toHaveLength(6);
    }
  });
});

describe("parseOrderlyFundingHistory", () => {
  test("oldest first, each basis from the row's own next funding time", async () => {
    const btc = await fixture<OrderlyEnvelope<OrderlyFundingHistoryPage>>(
      "funding_rate_history_PERP_BTC_USDC.json",
    );
    expect(
      parseOrderlyFundingHistory("PERP_BTC_USDC", btc.data.rows, 0, NOW, null).map((e) => [
        e.settledAt,
        e.rate,
        e.basisHours,
      ]),
    ).toEqual([
      [1_789_200_000_000, 0.00009968, 8],
      [1_789_228_800_000, 0.00009955, 8],
      [1_789_257_600_000, 0.00009966, 8],
      [1_789_286_400_000, 0.00009988, 8],
      [1_789_315_200_000, 0.00009988, 8],
    ]);

    const hype = await fixture<OrderlyEnvelope<OrderlyFundingHistoryPage>>(
      "funding_rate_history_PERP_HYPE_USDC.json",
    );
    const events = parseOrderlyFundingHistory("PERP_HYPE_USDC", hype.data.rows, 0, NOW, 8);
    expect(events.map((e) => e.basisHours)).toEqual([4, 4, 4, 4]);
  });

  test("falls back to the funding period for a row without a next funding time", () => {
    const rows = [
      {
        symbol: "PERP_HYPE_USDC",
        funding_rate: 0.00005,
        funding_rate_timestamp: 1,
        next_funding_time: null,
      },
    ];
    expect(parseOrderlyFundingHistory("PERP_HYPE_USDC", rows, 0, NOW, 4)[0]?.basisHours).toBe(4);
    expect(parseOrderlyFundingHistory("PERP_HYPE_USDC", rows, 0, NOW, null)).toEqual([]);
  });
});

function fakeClient(route: (url: string) => unknown) {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "orderly",
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

describe("createOrderlyAdapter", () => {
  test("two requests a cycle, /info hourly", async () => {
    const f = await load();
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/info")) return f.info;
      if (url.endsWith("/futures")) return f.futures;
      if (url.endsWith("/funding_rates")) return f.fundingRates;
      throw new Error(`unexpected ${url}`);
    });
    const adapter = createOrderlyAdapter();

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(first.snapshots).toHaveLength(8);
    expect(first.settled).toHaveLength(8);
    expect(urls).toEqual([
      `${ORDERLY_API}/info`,
      `${ORDERLY_API}/futures`,
      `${ORDERLY_API}/funding_rates`,
    ]);
    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    await adapter.fetchSnapshots(client, NOW + HOUR);
    expect(urls.filter((u) => u.endsWith("/info"))).toHaveLength(2);
    // 3 + 2 + 3: /info on the first cycle and again once an hour has passed.
    expect(urls).toHaveLength(8);
  });

  test("throws on an unsuccessful envelope", async () => {
    const f = await load();
    const { client } = fakeClient((url) =>
      url.endsWith("/futures") ? { success: false, code: -1003, message: "rate limited" } : f.info,
    );
    await expect(createOrderlyAdapter().fetchSnapshots(client, NOW)).rejects.toThrow("-1003");
  });

  test("history sends ms bounds, pages by meta, and loads /info when no cycle has run", async () => {
    const f = await load();
    const T = 1_789_315_200_000;
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/info")) return f.info;
      const page = Number(new URL(url).searchParams.get("page"));
      const count = page === 1 ? 500 : 100;
      const offset = page === 1 ? 0 : 500;
      return {
        success: true,
        data: {
          rows: Array.from({ length: count }, (_, i) => ({
            symbol: "PERP_HYPE_USDC",
            funding_rate: 0.00005,
            funding_rate_timestamp: T - (offset + i) * 4 * HOUR,
            next_funding_time: null,
          })),
          meta: { total: 600, records_per_page: 500, current_page: page },
        },
      };
    });
    const fromMs = T - 599 * 4 * HOUR;
    const events =
      (await createOrderlyAdapter().fetchFundingHistory?.(client, "PERP_HYPE_USDC", fromMs, T)) ??
      [];
    expect(urls).toEqual([
      `${ORDERLY_API}/info`,
      `${ORDERLY_API}/funding_rate_history?symbol=PERP_HYPE_USDC&start_t=${fromMs}&end_t=${T}&page=1&size=500`,
      `${ORDERLY_API}/funding_rate_history?symbol=PERP_HYPE_USDC&start_t=${fromMs}&end_t=${T}&page=2&size=500`,
    ]);
    // No next_funding_time on these rows, so every basis is HYPE's declared 4h period.
    expect(events).toHaveLength(600);
    expect(events.every((e) => e.basisHours === 4)).toBe(true);
    expect(events[0]?.settledAt).toBe(fromMs);
  });
});
