import { describe, expect, test } from "bun:test";
import candlesFixture from "../../__fixtures__/phoenix/candles-BTC-1h.json";
import overviewFixture from "../../__fixtures__/phoenix/funding-overview.json";
import marketsFixture from "../../__fixtures__/phoenix/markets.json";
import ratesFixture from "../../__fixtures__/phoenix/rates-BTC.json";
import type { HttpClient } from "../http";
import {
  createPhoenixAdapter,
  OVERVIEW_LOOKBACK_MS,
  PHOENIX_API,
  type PhoenixMarket,
  type PhoenixOverviewSeries,
  type PhoenixVolumeEntry,
  parsePhoenixRates,
  parsePhoenixSnapshots,
  phoenixAssetClass,
  phoenixPointRate,
  phoenixTimeMs,
  phoenixVolume24h,
  VOLUME_MAX_AGE_MS,
} from "./phoenix";

const NOW = 1_789_338_960_000; // 2026-09-13T22:36:00Z
const SETTLED_AT = 1_789_336_801_000; // 22:00:01Z, the newest hourly point
const markets = marketsFixture as PhoenixMarket[];
const series = overviewFixture.series as PhoenixOverviewSeries[];
const btcMarket = markets.find((m) => m.symbol === "BTC") as PhoenixMarket;

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "phoenix",
    getJson: async <T>(url: string) => {
      urls.push(url);
      return respond(url) as T;
    },
    postJson: async () => {
      throw new Error("unexpected POST");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
  return { client, urls };
}

const overviewUrl = (now: number) =>
  `${PHOENIX_API}/funding/overview?startTime=${now - OVERVIEW_LOOKBACK_MS}&endTime=${now}&perMarketLimit=1`;
const candlesUrl = (symbol: string) => `${PHOENIX_API}/candles/${symbol}?timeframe=1h&limit=24`;

describe("parsePhoenixSnapshots", () => {
  const volumes = new Map<string, PhoenixVolumeEntry>([
    ["BTC", { volumeUsd: 1_721_084.7171, fetchedAt: NOW }],
  ]);
  const { snapshots, settled } = parsePhoenixSnapshots(markets, series, volumes, NOW);

  test("normalizes BTC: the hour just settled, amount over mark, OI from base lots", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC")).toEqual({
      venueId: "phoenix",
      venueSymbol: "BTC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.42 / 77334,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000, // 23:00Z, one interval after fundingStartIntervalTimestamp
      kind: "settled",
      markPrice: 77334,
      indexPrice: null,
      openInterestUsd: (298_911 / 10 ** 4) * 77334,
      volume24hUsd: 1_721_084.7171,
      maxLeverage: 40,
    });
    expect(settled.find((e) => e.venueSymbol === "BTC")).toEqual({
      venueId: "phoenix",
      venueSymbol: "BTC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      settledAt: SETTLED_AT,
      rate: 0.42 / 77334,
      basisHours: 1,
      markPrice: 77334,
    });
  });

  test("scale: 1/100 of the rates history's percentage, never the overview's fundingRate", () => {
    const btc = snapshots.find((s) => s.venueSymbol === "BTC");
    const history = ratesFixture.rates.find((r) => r.timestamp === SETTLED_AT / 1000);
    expect(btc?.rate).toBeCloseTo(Number(history?.fundingRatePercentage) / 100, 8);
    // fundingRate is 1e4x the rate here (tick 100) and 100x on AAPL (tick 10).
    const point = (symbol: string) => series.find((s) => s.symbol === symbol)?.points[0];
    expect(Number(point("BTC")?.fundingRate) / (btc?.rate ?? 1)).toBeCloseTo(1e4, 0);
    const aapl = snapshots.find((s) => s.venueSymbol === "AAPL");
    expect(Number(point("AAPL")?.fundingRate) / (aapl?.rate ?? 1)).toBeCloseTo(100, 1);
    // Hourly, and the same order as Hyperliquid's 1.25e-5/h for BTC that hour.
    expect(btc?.rate).toBeGreaterThan(1e-6);
    expect(btc?.rate).toBeLessThan(1e-4);
  });

  test("class from the real-world flag and trading calendar; quote USDC; GOLD reaches XAU", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.assetClass, s.quote])).toEqual([
      ["AAPL", "AAPL", "equity", "USDC"],
      ["XRP", "XRP", "crypto", "USDC"],
      ["SPY", "SPY", "equity", "USDC"],
      ["ETH", "ETH", "crypto", "USDC"],
      ["BTC", "BTC", "crypto", "USDC"],
      ["GOLD", "XAU", "commodity", "USDC"],
    ]);
    expect(settled).toHaveLength(6);
    // Every market publishes a mark for the identity gate.
    expect(snapshots.every((s) => s.markPrice !== null && s.markPrice > 0)).toBe(true);
    // A zero payment is a zero rate, not a missing one.
    expect(snapshots.find((s) => s.venueSymbol === "XRP")?.rate).toBe(0);
  });

  test("inactive markets, markets with no recent point and marks of zero are skipped", () => {
    const paused = markets.map((m) => (m.symbol === "ETH" ? { ...m, marketStatus: "paused" } : m));
    const noPoint = series.filter((s) => s.symbol !== "SPY");
    const zeroMark = series.map((s) =>
      s.symbol === "AAPL" ? { ...s, points: [{ ...s.points[0], markPrice: "0" }] } : s,
    ) as PhoenixOverviewSeries[];
    const symbols = (m: PhoenixMarket[], s: PhoenixOverviewSeries[]) =>
      parsePhoenixSnapshots(m, s, new Map(), NOW).snapshots.map((x) => x.venueSymbol);
    expect(symbols(paused, series)).not.toContain("ETH");
    expect(symbols(markets, noPoint)).not.toContain("SPY");
    expect(symbols(markets, zeroMark)).not.toContain("AAPL");
  });

  test("negative base-lot decimals multiply", () => {
    const pumpLike = { ...btcMarket, baseLotsDecimals: -2 };
    const btc = parsePhoenixSnapshots([pumpLike], series, new Map(), NOW).snapshots[0];
    expect(btc?.openInterestUsd).toBe(298_911 * 100 * 77334);
    expect(btc?.volume24hUsd).toBeNull();
  });
});

describe("phoenix helpers", () => {
  test("timestamps are unix seconds, as numbers or strings, or ISO date-times", () => {
    expect(phoenixTimeMs(1_789_336_801)).toBe(SETTLED_AT);
    expect(phoenixTimeMs("1789336800")).toBe(1_789_336_800_000);
    expect(phoenixTimeMs("2026-09-13T22:00:01Z")).toBe(SETTLED_AT);
    expect(phoenixTimeMs(null)).toBeNull();
    expect(phoenixTimeMs("not a time")).toBeNull();
  });

  test("point rate needs a positive mark", () => {
    expect(
      phoenixPointRate({ timestamp: 1, fundingAmountPerUnit: "-0.041", markPrice: "4345.8" }),
    ).toBe(-0.041 / 4345.8);
    expect(phoenixPointRate({ timestamp: 1, fundingAmountPerUnit: "1", markPrice: "0" })).toBe(
      null,
    );
  });

  test("24h volume sums the 24 closed hours before the current one", () => {
    expect(phoenixVolume24h(candlesFixture, NOW)).toBeCloseTo(1_721_084.7171, 3);
    // An hour later the oldest candle falls out and nothing replaces it in this response.
    const oldest = candlesFixture[0]?.volumeQuote ?? 0;
    expect(phoenixVolume24h(candlesFixture, NOW + 3_600_000)).toBeCloseTo(
      1_721_084.7171 - oldest,
      3,
    );
    expect(phoenixVolume24h([], NOW)).toBe(0);
  });

  test("declared class: crypto without the flag, calendar decides, unknown calendars by table", () => {
    const rwa = (calendar: string | null) =>
      ({
        ...btcMarket,
        commodityMetadata: { isCommodity: true },
        metadata: { calendar: calendar === null ? null : { id: calendar } },
      }) as PhoenixMarket;
    expect(phoenixAssetClass(btcMarket, "BTC")).toBe("crypto");
    expect(
      phoenixAssetClass({ ...btcMarket, commodityMetadata: { isCommodity: false } }, "X"),
    ).toBe("crypto");
    expect(phoenixAssetClass(rwa("us_equities_extended"), "AAPL")).toBe("equity");
    expect(phoenixAssetClass(rwa("cme_commodities"), "WTIOIL")).toBe("commodity");
    expect(phoenixAssetClass(rwa("fx_24_5"), "EUR")).toBe("fx");
    expect(phoenixAssetClass(rwa(null), "US500")).toBe("index");
  });
});

describe("parsePhoenixRates", () => {
  test("percent per hour becomes a fraction, oldest first, within the window", () => {
    const events = parsePhoenixRates(
      btcMarket,
      [...ratesFixture.rates].reverse(),
      1_789_322_400_000,
      SETTLED_AT,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual(
      ratesFixture.rates
        .filter((r) => r.timestamp * 1000 >= 1_789_322_400_000)
        .map((r) => [r.timestamp * 1000, Number(r.fundingRatePercentage) / 100, 1]),
    );
    expect(events[0]).toMatchObject({ base: "BTC", quote: "USDC", assetClass: "crypto" });
  });
});

describe("createPhoenixAdapter", () => {
  const respond = (url: string) => {
    if (url.endsWith("/view/exchange/markets")) return markets;
    if (url.includes("/funding/overview")) return overviewFixture;
    if (url.includes("/candles/")) return candlesFixture;
    throw new Error(`unexpected ${url}`);
  };

  test("two bulk calls a cycle, then a budgeted slice of candles until every volume is fresh", async () => {
    const { client, urls } = fakeClient(respond);
    const adapter = createPhoenixAdapter({ volumeRefreshBudget: 4 });

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls).toEqual([
      `${PHOENIX_API}/view/exchange/markets`,
      overviewUrl(NOW),
      candlesUrl("AAPL"),
      candlesUrl("XRP"),
      candlesUrl("SPY"),
      candlesUrl("ETH"),
    ]);
    expect(first.snapshots).toHaveLength(6);
    expect(first.snapshots.find((s) => s.venueSymbol === "ETH")?.volume24hUsd).toBeCloseTo(
      1_721_084.7171,
      3,
    );
    expect(first.snapshots.find((s) => s.venueSymbol === "BTC")?.volume24hUsd).toBeNull();

    urls.length = 0;
    const next = NOW + 60_000;
    await adapter.fetchSnapshots(client, next);
    expect(urls).toEqual([
      `${PHOENIX_API}/view/exchange/markets`,
      overviewUrl(next),
      candlesUrl("BTC"),
      candlesUrl("GOLD"),
    ]);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 120_000);
    expect(urls).toHaveLength(2);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + VOLUME_MAX_AGE_MS);
    expect(urls.slice(2)).toEqual([
      candlesUrl("AAPL"),
      candlesUrl("XRP"),
      candlesUrl("SPY"),
      candlesUrl("ETH"),
    ]);
    expect(adapter.minIntervalMs).toBeGreaterThanOrEqual(1000);
  });

  test("a throttled bulk call fails the cycle; a failed candle call only loses that volume", async () => {
    const throttled = fakeClient((url) =>
      url.includes("/funding/overview") ? { error: "rate_limited" } : respond(url),
    );
    expect(createPhoenixAdapter().fetchSnapshots(throttled.client, NOW)).rejects.toThrow(
      "rate_limited",
    );

    const flaky = fakeClient((url) =>
      url.includes("/candles/") ? { error: "rate_limited" } : respond(url),
    );
    const batch = await createPhoenixAdapter().fetchSnapshots(flaky.client, NOW);
    expect(batch.snapshots).toHaveLength(6);
    expect(batch.snapshots.every((s) => s.volume24hUsd === null)).toBe(true);
  });

  test("history reads the market once for its class, then rates in windows under a year", async () => {
    const day = 24 * 3_600_000;
    const { client, urls } = fakeClient((url) => {
      if (url.includes("/view/exchange/market/")) {
        return markets.find((m) => m.symbol === "GOLD");
      }
      return {
        marketId: 65556,
        symbol: "GOLD",
        rates: [{ timestamp: 1_789_336_801, fundingRatePercentage: "-0.000943" }],
      };
    });
    const adapter = createPhoenixAdapter();
    const from = SETTLED_AT - 400 * day;
    const events = await adapter.fetchFundingHistory?.(client, "GOLD", from, SETTLED_AT);
    const split = from + 300 * day;
    expect(urls).toEqual([
      `${PHOENIX_API}/view/exchange/market/GOLD`,
      `${PHOENIX_API}/funding/GOLD/rates?startTime=${from}&endTime=${split}&limit=10000`,
      `${PHOENIX_API}/funding/GOLD/rates?startTime=${split + 1}&endTime=${SETTLED_AT}&limit=10000`,
    ]);
    // The same settlement served by both windows is one event.
    expect(events).toHaveLength(1);
    expect(events?.[0]).toMatchObject({
      venueSymbol: "GOLD",
      base: "XAU",
      assetClass: "commodity",
      quote: "USDC",
      settledAt: SETTLED_AT,
      basisHours: 1,
      markPrice: null,
    });
    expect(events?.[0]?.rate).toBeCloseTo(-0.00000943, 12);

    urls.length = 0;
    await adapter.fetchFundingHistory?.(client, "GOLD", SETTLED_AT - day, SETTLED_AT);
    expect(urls).toEqual([
      `${PHOENIX_API}/funding/GOLD/rates?startTime=${SETTLED_AT - day}&endTime=${SETTLED_AT}&limit=10000`,
    ]);
  });
});
