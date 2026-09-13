import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import type { HttpClient } from "../http";
import {
  ANNOTATIONS_MAX_AGE_MS,
  ANNOTATIONS_RETRY_MS,
  createAnnotationCache,
  createHip3Adapter,
  type HlFundingHistoryRow,
  type HlMetaAndAssetCtxs,
  type HlPerpConciseAnnotations,
  type HlPerpDexs,
  HYPERLIQUID_INFO_URL,
  hip3DeclaredClass,
  hyperliquidAdapter,
  parseHyperliquidFundingHistory,
  parseHyperliquidMarginTables,
  parseHyperliquidSnapshots,
  parsePerpAnnotations,
  parsePerpDexs,
} from "./hyperliquid";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/hyperliquid/${name}`, import.meta.url)).json();

function fakeClient(handler: (body: Record<string, unknown>) => unknown) {
  const bodies: Record<string, unknown>[] = [];
  const client: HttpClient = {
    venueId: "test",
    getJson: async () => {
      throw new Error("unexpected GET");
    },
    postJson: async (url, body) => {
      expect(url).toBe(HYPERLIQUID_INFO_URL);
      bodies.push(body as Record<string, unknown>);
      return handler(body as Record<string, unknown>) as never;
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => bodies.length,
  };
  return { client, bodies };
}

/** A metaAndAssetCtxs payload for these coins; the ctx numbers are not what the caller tests. */
function payloadFor(coins: readonly string[]): HlMetaAndAssetCtxs {
  return [
    { universe: coins.map((name) => ({ name })) },
    coins.map(() => ({ funding: "0.0000125", markPx: "1" })),
  ];
}

// 2026-09-11T16:38:40Z; the next hourly settlement is 17:00:00Z.
const NOW = 1_789_147_120_000;
const NEXT_HOUR = 1_789_149_600_000;

describe("parseHyperliquidSnapshots (core)", () => {
  test("normalizes BTC and skips delisted coins", async () => {
    const payload = await fixture<HlMetaAndAssetCtxs>("meta-and-asset-ctxs.json");
    const snapshots = parseHyperliquidSnapshots("hyperliquid", payload, NOW, "USDC");

    expect(snapshots.map((s) => s.venueSymbol)).toEqual(["BTC", "ETH"]);
    const btc = snapshots[0];
    expect(btc).toMatchObject({
      venueId: "hyperliquid",
      venueSymbol: "BTC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.0000083651,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: NEXT_HOUR,
      kind: "predicted",
      markPrice: 77748,
      indexPrice: 77783.3,
      maxLeverage: 40,
    });
    expect(btc?.openInterestUsd).toBeCloseTo(35818.6831799999 * 77748, 2);
    expect(btc?.volume24hUsd).toBeCloseTo(3571973656.4438381, 4);
    // 0.0000083651 per hour -> 7.3278% simple APR.
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 1)).toBeCloseTo(7.3278276, 6);
  });
});

describe("parseHyperliquidSnapshots (HIP-3)", () => {
  test("sets the dex, keeps the multiplier-adjusted funding and skips delisted assets", async () => {
    const payload = await fixture<HlMetaAndAssetCtxs>("xyz-meta-and-asset-ctxs.json");
    const snapshots = parseHyperliquidSnapshots("hl-xyz", payload, NOW);

    expect(snapshots.map((s) => s.venueSymbol)).toEqual(["xyz:XYZ100", "xyz:AAPL"]);
    expect(snapshots[0]).toMatchObject({
      venueId: "hl-xyz",
      base: "XYZ100",
      quote: null,
      dex: "xyz",
      // Half the 0.0000125 hourly baseline: xyz's 0.5 funding multiplier is already applied.
      rate: 0.00000625,
      basisHours: 1,
    });
    expect(snapshots[0]?.openInterestUsd).toBeCloseTo(8837.92 * 29432, 2);
    expect(snapshots[1]?.rate).toBe(-0.0000178177);
  });
});

describe("asset class", () => {
  test("a HIP-3 market takes its deployer's category, refined by the base tables", async () => {
    const categories = parsePerpAnnotations(
      await fixture<HlPerpConciseAnnotations>("perp-concise-annotations.json"),
    );
    // Coin names as meta.universe spelt them on 2026-09-14. hyna:GOLD has no annotation.
    const coins = [
      "xyz:BB",
      "xyz:QNT",
      "para:STX",
      "xyz:SP500",
      "xyz:GOLD",
      "xyz:JPY",
      "km:EUR",
      "para:10Y",
      "para:AAOI",
      "io:ANTH",
      "flx:BTC",
      "hyna:GOLD",
    ];
    const snapshots = parseHyperliquidSnapshots(
      "hl-test",
      payloadFor(coins),
      NOW,
      null,
      categories,
    );

    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.assetClass])).toEqual([
      // BlackBerry, Quantinuum and Seagate: named like crypto tickers, declared stocks.
      ["xyz:BB", "BB", "equity"],
      ["xyz:QNT", "QNT", "equity"],
      ["para:STX", "STX", "equity"],
      ["xyz:SP500", "US500", "index"],
      ["xyz:GOLD", "XAU", "commodity"],
      ["xyz:JPY", "JPY", "fx"],
      // Deployers spell freely: "FX" and "stock".
      ["km:EUR", "EUR", "fx"],
      // "rates" is outside the table, so the base tables settle it.
      ["para:10Y", "10Y", "index"],
      ["para:AAOI", "AAOI", "equity"],
      ["io:ANTH", "ANTH", "equity"],
      ["flx:BTC", "BTC", "crypto"],
      // No annotation: read as not crypto, never defaulted to crypto.
      ["hyna:GOLD", "XAU", "commodity"],
    ]);
  });

  test("the core dex is crypto, with no annotations to consult", () => {
    const snapshots = parseHyperliquidSnapshots(
      "hyperliquid",
      payloadFor(["STX", "PURR", "SPX"]),
      NOW,
      "USDC",
    );
    expect(snapshots.map((s) => s.assetClass)).toEqual(["crypto", "crypto", "crypto"]);
  });

  test("hip3DeclaredClass ignores case and never consults the object prototype", () => {
    expect(hip3DeclaredClass("Stocks", "AAPL")).toBe("equity");
    expect(hip3DeclaredClass("CRYPTO", "USDE")).toBe("crypto");
    expect(hip3DeclaredClass("constructor", "NVDA")).toBe("equity");
    expect(hip3DeclaredClass(null, "EURUSD")).toBe("fx");
  });

  test("parsePerpAnnotations skips malformed entries and rejects a non-list", () => {
    const parsed = parsePerpAnnotations([
      ["xyz:BB", { category: "stocks" }],
      ["xyz:NOCATEGORY", {}],
      "garbage",
    ] as unknown as HlPerpConciseAnnotations);
    expect([...parsed]).toEqual([["xyz:BB", "stocks"]]);
    expect(() => parsePerpAnnotations({} as unknown as HlPerpConciseAnnotations)).toThrow();
  });
});

describe("createAnnotationCache", () => {
  const annotated: HlPerpConciseAnnotations = [["flx:BTC", { category: "crypto" }]];

  test("one request serves every caller until the copy is due", async () => {
    const cache = createAnnotationCache();
    const { client, bodies } = fakeClient(() => annotated);

    const [first, second] = await Promise.all([
      cache.categories(client, NOW),
      cache.categories(client, NOW),
    ]);
    expect(bodies).toEqual([{ type: "perpConciseAnnotations" }]);
    expect(first.get("flx:BTC")).toBe("crypto");
    expect(second).toBe(first);

    await cache.categories(client, NOW + ANNOTATIONS_MAX_AGE_MS - 1);
    expect(bodies).toHaveLength(1);
    await cache.categories(client, NOW + ANNOTATIONS_MAX_AGE_MS);
    expect(bodies).toHaveLength(2);
  });

  test("a failed or empty refresh keeps the last good copy and retries sooner", async () => {
    const cache = createAnnotationCache();
    let respond: () => unknown = () => annotated;
    const { client, bodies } = fakeClient(() => respond());
    await cache.categories(client, NOW);

    respond = () => {
      throw new Error("HTTP 500");
    };
    const due = NOW + ANNOTATIONS_MAX_AGE_MS;
    expect((await cache.categories(client, due)).get("flx:BTC")).toBe("crypto");
    await cache.categories(client, due + ANNOTATIONS_RETRY_MS - 1);
    expect(bodies).toHaveLength(2);

    respond = () => [];
    expect((await cache.categories(client, due + ANNOTATIONS_RETRY_MS)).get("flx:BTC")).toBe(
      "crypto",
    );
    expect(bodies).toHaveLength(3);
  });
});

describe("parseHyperliquidMarginTables", () => {
  test("expands each asset's shared table into a ladder", async () => {
    const [meta] = await fixture<HlMetaAndAssetCtxs>("meta-and-asset-ctxs.json");
    const tiers = parseHyperliquidMarginTables("hyperliquid", meta);

    expect(tiers.map((t) => `${t.venueSymbol}:${t.tier}`)).toEqual([
      "BTC:1",
      "BTC:2",
      "ETH:1",
      "ETH:2",
    ]);
    // No margin rate is published, so it is the reciprocal of the leverage cap.
    expect(tiers[0]).toEqual({
      venueId: "hyperliquid",
      venueSymbol: "BTC",
      tier: 1,
      lowerNotionalUsd: 0,
      upperNotionalUsd: 150_000_000,
      imr: 1 / 40,
      mmr: null,
      maxLeverage: 40,
    });
    // The top step is genuinely unbounded: Hyperliquid publishes no maximum position size, so a
    // null here means "no cap", not "cap unknown".
    expect(tiers[1]).toMatchObject({
      tier: 2,
      lowerNotionalUsd: 150_000_000,
      upperNotionalUsd: null,
      imr: 1 / 20,
      maxLeverage: 20,
    });
    // Tables are shared, so ETH reads a different one: 25x stepping to 15x at $100m.
    expect(tiers[2]).toMatchObject({
      venueSymbol: "ETH",
      tier: 1,
      upperNotionalUsd: 100_000_000,
      maxLeverage: 25,
    });
  });

  test("an asset whose table the response omits gets no ladder rather than a guess", async () => {
    const [meta] = await fixture<HlMetaAndAssetCtxs>("meta-and-asset-ctxs.json");
    // MATIC names table 20, which this payload does not carry (and is delisted besides).
    expect(meta.universe.some((u) => u.marginTableId === 20)).toBe(true);
    expect(
      parseHyperliquidMarginTables("hyperliquid", meta).some((t) => t.venueSymbol === "MATIC"),
    ).toBe(false);
  });
});

describe("parsePerpDexs", () => {
  test("lists HIP-3 dex names without the core entry", async () => {
    expect(parsePerpDexs(await fixture<HlPerpDexs>("perp-dexs.json"))).toEqual(["xyz", "flx"]);
  });
});

describe("parseHyperliquidFundingHistory", () => {
  test("snaps settlements to the hour, dedupes and sorts oldest first", async () => {
    const rows = await fixture<HlFundingHistoryRow[]>("funding-history-btc.json");
    const events = parseHyperliquidFundingHistory(
      "hyperliquid",
      [...rows].reverse().concat(rows),
      "USDC",
    );

    expect(events.map((e) => e.settledAt)).toEqual([
      1_789_138_800_000, 1_789_142_400_000, 1_789_146_000_000,
    ]);
    expect(events[0]).toMatchObject({
      venueId: "hyperliquid",
      venueSymbol: "BTC",
      quote: "USDC",
      rate: 0.0000125,
      basisHours: 1,
      markPrice: null,
    });
  });

  test("HIP-3 coins keep their dex", async () => {
    const rows = await fixture<HlFundingHistoryRow[]>("funding-history-xyz.json");
    const events = parseHyperliquidFundingHistory("hl-xyz", rows);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      venueId: "hl-xyz",
      base: "XYZ100",
      dex: "xyz",
      rate: 0.00000625,
    });
  });
});

describe("adapters", () => {
  test("core adapter requests metaAndAssetCtxs without a dex, and no annotations", async () => {
    const payload = await fixture<HlMetaAndAssetCtxs>("meta-and-asset-ctxs.json");
    const { client, bodies } = fakeClient(() => payload);
    const batch = await hyperliquidAdapter.fetchSnapshots(client, NOW);
    expect(bodies).toEqual([{ type: "metaAndAssetCtxs" }]);
    expect(batch.snapshots[0]?.quote).toBe("USDC");
    expect(batch.settled).toEqual([]);
  });

  test("HIP-3 adapter passes the dex, uses venue id hl-<dex> and classes from annotations", async () => {
    const payload = await fixture<HlMetaAndAssetCtxs>("xyz-meta-and-asset-ctxs.json");
    const annotations = await fixture<HlPerpConciseAnnotations>("perp-concise-annotations.json");
    const { client, bodies } = fakeClient((body) =>
      body.type === "perpConciseAnnotations" ? annotations : payload,
    );
    const adapter = createHip3Adapter("xyz", createAnnotationCache());
    const batch = await adapter.fetchSnapshots(client, NOW);
    expect(adapter.venueId).toBe("hl-xyz");
    expect(bodies).toEqual([
      { type: "metaAndAssetCtxs", dex: "xyz" },
      { type: "perpConciseAnnotations" },
    ]);
    expect(batch.snapshots.every((s) => s.venueId === "hl-xyz")).toBe(true);
    expect(batch.snapshots.map((s) => [s.venueSymbol, s.assetClass])).toEqual([
      ["xyz:XYZ100", "index"],
      ["xyz:AAPL", "equity"],
    ]);
  });

  test("HIP-3 adapters share one annotations request, and its failure never fails a sweep", async () => {
    const payload = await fixture<HlMetaAndAssetCtxs>("xyz-meta-and-asset-ctxs.json");
    const { client, bodies } = fakeClient((body) => {
      if (body.type === "perpConciseAnnotations") throw new Error("HTTP 500");
      return payload;
    });
    const annotations = createAnnotationCache();

    const batch = await createHip3Adapter("xyz", annotations).fetchSnapshots(client, NOW);
    // Nothing loaded yet, so the missing-annotation rule classes both markets.
    expect(batch.snapshots.map((s) => [s.venueSymbol, s.assetClass])).toEqual([
      ["xyz:XYZ100", "index"],
      ["xyz:AAPL", "equity"],
    ]);

    await createHip3Adapter("flx", annotations).fetchSnapshots(client, NOW + 1_000);
    expect(bodies.filter((b) => b.type === "perpConciseAnnotations")).toHaveLength(1);
  });

  test("history paginates by the last row's time until a short page", async () => {
    const hour = 3_600_000;
    const start = 1_789_000_000_000 - (1_789_000_000_000 % hour);
    const fullPage = Array.from({ length: 500 }, (_, i) => ({
      coin: "BTC",
      fundingRate: "0.0000125",
      time: start + i * hour + 47,
    }));
    const lastPage = [{ coin: "BTC", fundingRate: "0.00001", time: start + 500 * hour + 30 }];
    const { client, bodies } = fakeClient((body) =>
      body.startTime === start ? fullPage : lastPage,
    );

    const events = await hyperliquidAdapter.fetchFundingHistory?.(
      client,
      "BTC",
      start,
      start + 600 * hour,
    );

    expect(bodies.map((b) => b.startTime)).toEqual([start, start + 499 * hour + 48]);
    expect(bodies[0]).toMatchObject({
      type: "fundingHistory",
      coin: "BTC",
      endTime: start + 600 * hour,
    });
    expect(events).toHaveLength(501);
    expect(events?.at(-1)).toMatchObject({ settledAt: start + 500 * hour, rate: 0.00001 });
  });
});
