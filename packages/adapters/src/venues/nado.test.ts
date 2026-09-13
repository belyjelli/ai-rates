import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import contractsFixture from "../../__fixtures__/nado/contracts.json";
import historyFixture from "../../__fixtures__/nado/funding_rate_history-2.json";
import symbolsFixture from "../../__fixtures__/nado/symbols.json";
import type { HttpClient } from "../http";
import {
  createNadoAdapter,
  NADO_ARCHIVE,
  NADO_GATEWAY,
  NADO_HEADERS,
  type NadoContract,
  type NadoFundingHistoryResponse,
  type NadoSymbolsResponse,
  nadoAssetClass,
  parseNadoFundingHistory,
  parseNadoSnapshots,
} from "./nado";

const NOW = 1_789_338_400_000; // 2026-09-13T22:26:40Z
const contracts = contractsFixture as Record<string, NadoContract>;
const symbols = (symbolsFixture as NadoSymbolsResponse).data.symbols;

interface Call {
  method: "GET" | "POST";
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function fakeClient(respond: (call: Call) => unknown): { client: HttpClient; calls: Call[] } {
  const calls: Call[] = [];
  const client: HttpClient = {
    venueId: "nado",
    getJson: async <T>(url: string, headers?: Record<string, string>) => {
      const call: Call = { method: "GET", url, headers };
      calls.push(call);
      return respond(call) as T;
    },
    postJson: async <T>(url: string, body: unknown, headers?: Record<string, string>) => {
      const call: Call = { method: "POST", url, body, headers };
      calls.push(call);
      return respond(call) as T;
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => calls.length,
  };
  return { client, calls };
}

function respond(call: Call): unknown {
  if (call.url.includes("type=symbols")) return symbolsFixture;
  if (call.url.includes("/v2/contracts")) return contracts;
  if (call.method === "POST") return historyFixture;
  throw new Error(`unexpected ${call.url}`);
}

describe("parseNadoSnapshots", () => {
  const snapshots = parseNadoSnapshots(contracts, symbols, NOW);

  test("normalizes BTC as a predicted 24-hour rate settled hourly in USDT0", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC-PERP_USDT0")).toEqual({
      venueId: "nado",
      venueSymbol: "BTC-PERP_USDT0",
      base: "BTC",
      quote: "USDT0",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.00010991167139984,
      basisHours: 24,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
      kind: "predicted",
      markPrice: 76805.68219579448,
      indexPrice: 76796.975,
      openInterestUsd: 16540430.868905,
      volume24hUsd: 88844499.99528772,
    });
  });

  test("the 24h basis annualizes BTC to ~4% APR, not the 96% an hourly reading would give", () => {
    const btc = snapshots.find((s) => s.venueSymbol === "BTC-PERP_USDT0");
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(4.012, 3);
  });

  test("a quiet market's 0.0003 per day is the 0.0000125/h floor", () => {
    const kpepe = snapshots.find((s) => s.venueSymbol === "kPEPE-PERP_USDT0");
    expect((kpepe?.rate ?? 0) / 24).toBeCloseTo(0.0000125, 12);
  });

  test("open interest is already USD: base OI times mark", () => {
    const btc = snapshots.find((s) => s.venueSymbol === "BTC-PERP_USDT0");
    expect((btc?.openInterestUsd ?? 0) / (215.3981 * 76805.68219579448)).toBeCloseTo(1, 3);
  });

  test("only `live` perps are collected", () => {
    // Skipped from the fixture: USELESS (post_only), ADA (not_tradable), PENG (soft_reduce_only).
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "kPEPE-PERP_USDT0",
      "XAUT-PERP_USDT0",
      "WTI-PERP_USDT0",
      "EURUSD-PERP_USDT0",
      "SPY-PERP_USDT0",
      "ETH-PERP_USDT0",
      "BTC-PERP_USDT0",
      "XAG-PERP_USDT0",
      "ZHIPU-PERP_USDT0",
      "AAPL-PERP_USDT0",
    ]);
  });

  test("a market missing from symbols is not collected", () => {
    expect(parseNadoSnapshots(contracts, {}, NOW)).toEqual([]);
  });

  test("class from the documented Feed Reference, base from the parser", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.multiplier, s.assetClass])).toEqual([
      ["kPEPE-PERP_USDT0", "PEPE", 1000, "crypto"],
      // Documented Crypto: the gold token.
      ["XAUT-PERP_USDT0", "XAUT", 1, "crypto"],
      // Energy; WTI reaches CL through core's alias.
      ["WTI-PERP_USDT0", "CL", 1, "commodity"],
      ["EURUSD-PERP_USDT0", "EURUSD", 1, "fx"],
      // US Equity.
      ["SPY-PERP_USDT0", "SPY", 1, "equity"],
      ["ETH-PERP_USDT0", "ETH", 1, "crypto"],
      ["BTC-PERP_USDT0", "BTC", 1, "crypto"],
      // Metals.
      ["XAG-PERP_USDT0", "XAG", 1, "commodity"],
      // HK Equity.
      ["ZHIPU-PERP_USDT0", "ZHIPU", 1, "equity"],
      ["AAPL-PERP_USDT0", "AAPL", 1, "equity"],
    ]);
    expect(new Set(snapshots.map((s) => s.quote))).toEqual(new Set(["USDT0"]));
  });
});

describe("nadoAssetClass", () => {
  test("a market the docs do not list declares nothing, so crypto", () => {
    expect(nadoAssetClass("BTC-PERP")).toBe("crypto");
    expect(nadoAssetClass("NEWTHING-PERP")).toBe("crypto");
    expect(nadoAssetClass("GBPUSD-PERP")).toBe("fx");
  });
});

describe("Nado funding history", () => {
  const btc = contracts["BTC-PERP_USDT0"] as NadoContract;

  test("x18 hourly realized rates with unix-second timestamps", () => {
    const events = parseNadoFundingHistory(
      (historyFixture as NadoFundingHistoryResponse).funding_rates,
      btc,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_318_800_000, 0.000010519664719234, 1],
      [1_789_322_400_000, 0.000012504446974278, 1],
      [1_789_326_000_000, 0.00001250493289169, 1],
      [1_789_329_600_000, 0.00001241919134208, 1],
      [1_789_333_200_000, 0.000003274864692546, 1],
      [1_789_336_800_000, 0.000006943496312518, 1],
    ]);
    expect(events[0]).toMatchObject({ venueId: "nado", base: "BTC", quote: "USDT0" });
  });

  test("fetchSnapshots: symbols once an hour, contracts every cycle, Accept-Encoding on both", async () => {
    const { client, calls } = fakeClient(respond);
    const adapter = createNadoAdapter();
    const batch = await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(calls).toEqual([
      { method: "GET", url: `${NADO_GATEWAY}/query?type=symbols`, headers: NADO_HEADERS },
      { method: "GET", url: `${NADO_ARCHIVE}/v2/contracts?edge=false`, headers: NADO_HEADERS },
      { method: "GET", url: `${NADO_ARCHIVE}/v2/contracts?edge=false`, headers: NADO_HEADERS },
    ]);
    expect(NADO_HEADERS).toEqual({ "accept-encoding": "gzip" });
    expect(batch.snapshots).toHaveLength(10);
    expect(batch.settled).toEqual([]);
  });

  test("history POSTs by product_id in seconds, loading contracts when cold", async () => {
    const { client, calls } = fakeClient(respond);
    const events = await createNadoAdapter().fetchFundingHistory?.(
      client,
      "BTC-PERP_USDT0",
      1_789_322_000_000,
      1_789_337_000_000,
    );
    expect(calls).toEqual([
      { method: "GET", url: `${NADO_ARCHIVE}/v2/contracts?edge=false`, headers: NADO_HEADERS },
      {
        method: "POST",
        url: `${NADO_ARCHIVE}/v1`,
        body: {
          funding_rate_history: {
            product_id: 2,
            start_time: 1_789_322_000,
            end_time: 1_789_337_000,
            limit: 1000,
          },
        },
        headers: NADO_HEADERS,
      },
    ]);
    // The window drops the 17:00 settlement.
    expect(events?.map((e) => e.settledAt)).toEqual([
      1_789_322_400_000, 1_789_326_000_000, 1_789_329_600_000, 1_789_333_200_000, 1_789_336_800_000,
    ]);
  });

  test("pages forward from the newest timestamp + 1 when a page is full", async () => {
    const hour = 3600;
    const start = 1_785_000_000;
    const page = (first: number, count: number) => ({
      funding_rates: Array.from({ length: count }, (_, i) => ({
        product_id: 2,
        timestamp: String(first + i * hour),
        funding_rate_x18: "12500000000000",
      })),
    });
    const { client, calls } = fakeClient((call) => {
      if (call.method === "GET") return contracts;
      const posts = calls.filter((c) => c.method === "POST").length;
      return posts === 1 ? page(start, 1000) : page(start + 1000 * hour, 2);
    });
    const events = await createNadoAdapter().fetchFundingHistory?.(
      client,
      "BTC-PERP_USDT0",
      start * 1000,
      (start + 1001 * hour) * 1000,
    );
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[1]?.body).toMatchObject({
      funding_rate_history: { start_time: start + 999 * hour + 1 },
    });
    expect(events).toHaveLength(1002);
  });
});
