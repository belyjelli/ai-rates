import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import {
  gateAdapter,
  parseGateFundingHistory,
  parseGateLiquidations,
  parseGateRiskLimitTiers,
  parseGateSnapshots,
} from "./gate";

const fixture = (name: string) =>
  Bun.file(new URL(`../../__fixtures__/gate/${name}.json`, import.meta.url)).json();

const NOW = 1_789_147_120_000;

describe("parseGateSnapshots", () => {
  test("normalizes BTC_USDT", async () => {
    const { snapshots, settled } = parseGateSnapshots(
      await fixture("contracts"),
      await fixture("tickers"),
      NOW,
    );
    expect(settled).toEqual([]);
    expect(snapshots.find((s) => s.venueSymbol === "BTC_USDT")).toEqual({
      venueId: "gate",
      venueSymbol: "BTC_USDT",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      dex: null,
      observedAt: NOW,
      rate: 0.000016,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_171_200_000,
      kind: "predicted",
      markPrice: 77762.8,
      indexPrice: 77790.63,
      openInterestUsd: 640887002 * 0.0001 * 77762.8,
      volume24hUsd: 7031702789,
      maxLeverage: 200,
    });
  });

  test("reads 4h intervals and skips pre-market contracts", async () => {
    const { snapshots } = parseGateSnapshots(
      await fixture("contracts"),
      await fixture("tickers"),
      NOW,
    );
    expect(snapshots.map((s) => s.venueSymbol)).toEqual(["BTC_USDT", "ETH_USDT", "2Z_USDT"]);
    expect(snapshots.find((s) => s.venueSymbol === "2Z_USDT")).toMatchObject({
      basisHours: 4,
      intervalHours: 4,
      nextFundingAt: 1_789_156_800_000,
      openInterestUsd: 17296 * 100 * 0.04671,
    });
  });

  test("skips delisting contracts and leaves stats null without a ticker", async () => {
    const [btc] = await fixture("contracts");
    const { snapshots } = parseGateSnapshots(
      [
        { ...btc, name: "OLD_USDT", in_delisting: true },
        { ...btc, name: "NEW_USDT" },
      ],
      [],
      NOW,
    );
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      venueSymbol: "NEW_USDT",
      openInterestUsd: null,
      volume24hUsd: null,
    });
  });
});

describe("parseGateRiskLimitTiers", () => {
  test("builds a cumulative ladder per contract from the bulk shape", async () => {
    const tiers = parseGateRiskLimitTiers(await fixture("risk-limit-tiers"));
    const btc = tiers.filter((t) => t.venueSymbol === "BTC_USDT");
    expect(btc).toHaveLength(19);

    // risk_limit is quote notional, so unlike OKX there is no contract conversion to get wrong.
    expect(btc[0]).toEqual({
      venueId: "gate",
      venueSymbol: "BTC_USDT",
      tier: 1,
      lowerNotionalUsd: 0,
      upperNotionalUsd: 500_000,
      imr: 0.005,
      mmr: 0.003,
      maxLeverage: 200,
    });
    // Gate publishes only the ceiling, so each band inherits its floor from the one below.
    expect(btc[1]).toMatchObject({
      tier: 2,
      lowerNotionalUsd: 500_000,
      upperNotionalUsd: 1_000_000,
      imr: 0.006666,
      maxLeverage: 150.01,
    });
    // The top band's bound is a real cap on position size, as on Bybit.
    expect(btc.at(-1)).toMatchObject({
      tier: 19,
      upperNotionalUsd: 1_500_000_000,
      maxLeverage: 1.05,
    });

    // Every contract keeps its own ladder: ETH's first band ends lower than BTC's.
    const eth = tiers.filter((t) => t.venueSymbol === "ETH_USDT");
    expect(eth).toHaveLength(19);
    expect(eth[0]).toMatchObject({ tier: 1, upperNotionalUsd: 300_000 });
  });

  test("ignores rows with no contract, which the per-contract endpoint returns", () => {
    // Asking Gate for one contract returns the same rows without the `contract` field, leaving
    // every ladder unattributable; those rows are dropped rather than merged under one key.
    expect(
      parseGateRiskLimitTiers([
        {
          contract: "",
          tier: 1,
          risk_limit: "500000",
          initial_rate: "0.005",
          maintenance_rate: "0.003",
          leverage_max: "200",
        },
      ]),
    ).toEqual([]);
  });
});

describe("parseGateFundingHistory", () => {
  test("returns events oldest first, snapped to the minute", async () => {
    const events = parseGateFundingHistory("BTC_USDT", await fixture("funding-history"), 4);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_084_800_000, 0.000058, 8],
      [1_789_113_600_000, 0.000002, 8],
      [1_789_142_400_000, 0.000024, 8],
    ]);
    expect(events[0]).toMatchObject({ venueSymbol: "BTC_USDT", base: "BTC" });
  });

  test("falls back to the given interval for a single event", () => {
    expect(
      parseGateFundingHistory("2Z_USDT", [{ t: 1789142402, r: "0.00005" }], 4)[0]?.basisHours,
    ).toBe(4);
  });
});

describe("parseGateLiquidations", () => {
  const multipliers = new Map([
    ["H_USDT", 1],
    ["LSK_USDT", 1],
  ]);

  test("takes the side from `size`, not `order_size`", async () => {
    // The two fields are always opposite in sign -- 167 of 167 live records on 2026-09-13 -- so
    // reading the side off `order_size` would invert every long and short in the study.
    const rows = await fixture("liq-orders");
    const parsed = parseGateLiquidations(rows, multipliers);

    const long = parsed.find((l) => l.venueSymbol === "H_USDT");
    expect(long?.side).toBe("long"); // fixture has size:"76", order_size:"-76"
    const short = parsed.find((l) => l.venueSymbol === "LSK_USDT");
    expect(short?.side).toBe("short"); // fixture has size:"-95", order_size:"95"

    // The sign is consumed into `side`, so the stored size is absolute for both.
    expect(long?.sizeContracts).toBe(76);
    expect(short?.sizeContracts).toBe(95);
    expect(parsed.every((l) => l.sizeContracts > 0)).toBe(true);
  });

  test("converts contracts to a notional, and stores null rather than a guess", async () => {
    const rows = await fixture("liq-orders");
    // 95 contracts x 1 base unit x 0.2544 = 24.168.
    const known = parseGateLiquidations(rows, multipliers).find(
      (l) => l.venueSymbol === "LSK_USDT",
    );
    expect(known?.notionalUsd).toBeCloseTo(95 * 1 * 0.2544, 9);

    // A contract with no multiplier gets no invented notional -- the B2 unit trap, one layer down.
    const unknown = parseGateLiquidations(rows, new Map()).find(
      (l) => l.venueSymbol === "LSK_USDT",
    );
    expect(unknown?.notionalUsd).toBeNull();
    expect(unknown?.sizeContracts).toBe(95); // the raw figure survives either way
  });

  test("seconds become milliseconds, and degenerate rows are dropped", async () => {
    const parsed = parseGateLiquidations(
      [
        {
          contract: "A_USDT",
          size: "10",
          order_size: "-10",
          fill_price: "2",
          order_price: "2",
          time: 1_789_242_803,
          left: "0",
        },
        // Dropped: no size, no price, no timestamp.
        {
          contract: "B_USDT",
          size: "0",
          order_size: "0",
          fill_price: "2",
          order_price: "2",
          time: 1_789_242_803,
          left: "0",
        },
        {
          contract: "C_USDT",
          size: "10",
          order_size: "-10",
          fill_price: "0",
          order_price: "2",
          time: 1_789_242_803,
          left: "0",
        },
        {
          contract: "D_USDT",
          size: "10",
          order_size: "-10",
          fill_price: "2",
          order_price: "2",
          time: 0,
          left: "0",
        },
      ],
      new Map([["A_USDT", 1]]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.liquidatedAt).toBe(1_789_242_803_000);
  });

  test("a non-ASCII contract name survives", async () => {
    const rows = await fixture("liq-orders");
    const parsed = parseGateLiquidations(rows, new Map());
    // Asserted by NAME and by code point, with no character class. Earlier attempts wrote
    // \x20-\x7E escapes that landed as raw NUL and DEL bytes in the file -- the same hazard as
    // the NUL that once made grep blind to store.ts -- and Biome rejected the result.
    expect(parsed.map((l) => l.venueSymbol)).toContain("龙虾_USDT");
    expect(
      parsed.some((l) => [...l.venueSymbol].some((ch) => (ch.codePointAt(0) ?? 0) > 127)),
    ).toBe(true);
  });
});

describe("gateAdapter", () => {
  test("fetchSnapshots requests contracts and tickers", async () => {
    const contracts = await fixture("contracts");
    const tickers = await fixture("tickers");
    const urls: string[] = [];
    const client = {
      venueId: "gate",
      getJson: async (url: string) => {
        urls.push(url);
        return url.endsWith("/tickers") ? tickers : contracts;
      },
    } as unknown as HttpClient;

    const result = await gateAdapter.fetchSnapshots(client, NOW);
    expect(result.snapshots).toHaveLength(3);
    expect(urls.map((u) => u.split("/").pop())).toEqual(["contracts", "tickers"]);
  });
});
