import { describe, expect, test } from "bun:test";
import { CircuitOpenError, type HttpClient } from "../http";
import {
  createGrvtAdapter,
  GRVT_API,
  type GrvtFundingRow,
  type GrvtInstrument,
  type GrvtTicker,
  grvtAssetClass,
  grvtRate,
  parseGrvtFunding,
  parseGrvtTicker,
  tradableGrvtPerps,
} from "./grvt";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/grvt/${name}`, import.meta.url)).json();

/** `event_time` of the BTC ticker fixture, 2026-09-13 22:29:03 UTC. */
const NOW = 1_789_338_543_560;

const instruments = async () =>
  (await fixture<{ result: GrvtInstrument[] }>("all_instruments.json")).result;
const ticker = async (name: string) =>
  (await fixture<{ result: GrvtTicker }>(`ticker_${name}.json`)).result;
const byName = async () => tradableGrvtPerps(await instruments());

describe("parseGrvtTicker", () => {
  test("normalizes BTC_USDT_Perp", async () => {
    const btc = (await byName()).get("BTC_USDT_Perp") as GrvtInstrument;
    expect(parseGrvtTicker(btc, await ticker("BTC_USDT_Perp"), NOW)).toEqual({
      venueId: "grvt",
      venueSymbol: "BTC_USDT_Perp",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // "0.0031" percentage points per 8h: 0.000031 as a fraction.
      rate: 0.0031 / 100,
      basisHours: 8,
      intervalHours: 8,
      // Unix nanoseconds 1789344000000000000.
      nextFundingAt: 1_789_344_000_000,
      kind: "predicted",
      markPrice: 76747.199999999,
      indexPrice: 76786.925652169,
      bestBid: 76737.6,
      bestBidSizeUsd: 3.311 * 76737.6,
      bestAsk: 76737.7,
      bestAskSizeUsd: 7.319 * 76737.7,
      // Base units: 2,523 BTC is $194M.
      openInterestUsd: 2523.388873277 * 76747.199999999,
      // Taker buy plus taker sell, both in quote.
      volume24hUsd: 49048179.0772 + 49518153.3347,
    });
  });

  test("a 4h perp's rate is over its own 4 hours", async () => {
    const ena = (await byName()).get("ENA_USDT_Perp") as GrvtInstrument;
    const snapshot = parseGrvtTicker(ena, await ticker("ENA_USDT_Perp"), NOW);
    // The resting 0.005 on a 4h perp is the 0.01%-per-8h floor over four hours: 0.0000125 an hour.
    expect(snapshot).toMatchObject({ rate: 0.005 / 100, basisHours: 4, intervalHours: 4 });
    expect((snapshot?.rate ?? 0) / (snapshot?.basisHours ?? 1)).toBeCloseTo(0.0000125, 12);
  });

  test("nothing is emitted without a rate, a mark, an interval or a matching instrument", async () => {
    const btc = (await byName()).get("BTC_USDT_Perp") as GrvtInstrument;
    const base = await ticker("BTC_USDT_Perp");
    expect(
      parseGrvtTicker(btc, { ...base, funding_rate: "", funding_rate_8h_curr: "" }, NOW),
    ).toBeNull();
    expect(parseGrvtTicker(btc, { ...base, mark_price: undefined }, NOW)).toBeNull();
    expect(parseGrvtTicker(btc, { ...base, instrument: "ETH_USDT_Perp" }, NOW)).toBeNull();
    expect(parseGrvtTicker({ ...btc, funding_interval_hours: 0 }, base, NOW)).toBeNull();
    expect(parseGrvtTicker(btc, undefined, NOW)).toBeNull();
    expect(grvtRate("0.0061")).toBeCloseTo(0.000061, 12);
  });
});

describe("tradability, class and base", () => {
  test("perpetuals with an interval only", async () => {
    const rows = await instruments();
    expect([...tradableGrvtPerps(rows).keys()]).toEqual([
      "BTC_USDT_Perp",
      "ETH_USDT_Perp",
      "ENA_USDT_Perp",
      "XAU_USDT_Perp",
      "AAPL_USDT_Perp",
      "KBONK_USDT_Perp",
    ]);
    const [btc, eth] = rows as [GrvtInstrument, GrvtInstrument];
    const filtered = tradableGrvtPerps([
      { ...btc, kind: "FUTURE" },
      { ...eth, funding_interval_hours: undefined },
    ]);
    expect(filtered.size).toBe(0);
  });

  test("UNSPECIFIED is crypto, even for AAPL; declared values would be honoured", async () => {
    const aapl = (await byName()).get("AAPL_USDT_Perp") as GrvtInstrument;
    expect(parseGrvtTicker(aapl, await ticker("AAPL_USDT_Perp"), NOW)).toMatchObject({
      base: "AAPL",
      quote: "USDT",
      assetClass: "crypto",
      rate: 0,
      basisHours: 8,
    });
    expect(grvtAssetClass("UNSPECIFIED", "AAPL")).toBe("crypto");
    expect(grvtAssetClass(undefined, "XAU")).toBe("crypto");
    expect(grvtAssetClass("EQUITY", "AAPL")).toBe("equity");
    expect(grvtAssetClass("SOMETHING_NEW", "XAU")).toBe("commodity");
  });

  test("the K prefix is not read as a multiplier", async () => {
    const kbonk = (await byName()).get("KBONK_USDT_Perp") as GrvtInstrument;
    const snapshot = parseGrvtTicker(
      kbonk,
      { ...(await ticker("BTC_USDT_Perp")), instrument: "KBONK_USDT_Perp" },
      NOW,
    );
    expect(snapshot).toMatchObject({ base: "KBONK", multiplier: 1, basisHours: 4 });
  });
});

describe("parseGrvtFunding", () => {
  test("oldest first, percent to fraction, nanoseconds to ms, basis per row", async () => {
    const { result } = await fixture<{ result: GrvtFundingRow[] }>("funding_BTC_USDT_Perp.json");
    const btc = (await byName()).get("BTC_USDT_Perp") as GrvtInstrument;
    const events = parseGrvtFunding(result, btc, 1_789_257_600_000, NOW);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours, e.markPrice])).toEqual([
      [1_789_257_600_000, 0.0066 / 100, 8, 77255.165038271],
      [1_789_286_400_000, 0.0077 / 100, 8, 77094.330596662],
      // Binance settled BTCUSDT at 0.0000645 at this instant.
      [1_789_315_200_000, 0.0061 / 100, 8, 77098.400057842],
    ]);
    expect(events[0]).toMatchObject({ base: "BTC", quote: "USDT", assetClass: "crypto" });
  });
});

type Post = { url: string; body: Record<string, unknown> };

function fakeClient(route: (url: string, body: Record<string, unknown>) => unknown) {
  const posts: Post[] = [];
  const client: HttpClient = {
    venueId: "grvt",
    getJson: async () => {
      throw new Error("unexpected GET");
    },
    async postJson<T>(url: string, body: unknown): Promise<T> {
      posts.push({ url, body: body as Record<string, unknown> });
      return route(url, body as Record<string, unknown>) as T;
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => posts.length,
  };
  return { client, posts };
}

async function route() {
  const all = await instruments();
  const tickers: Record<string, GrvtTicker> = {
    BTC_USDT_Perp: await ticker("BTC_USDT_Perp"),
    ENA_USDT_Perp: await ticker("ENA_USDT_Perp"),
    AAPL_USDT_Perp: await ticker("AAPL_USDT_Perp"),
  };
  return (url: string, body: Record<string, unknown>): unknown => {
    if (url === `${GRVT_API}/all_instruments`) return { result: all };
    // Instruments without a ticker fixture answer with no result.
    if (url === `${GRVT_API}/ticker`) return { result: tickers[body.instrument as string] };
    throw new Error(`unexpected ${url}`);
  };
}

const tickerNames = (posts: Post[]) =>
  posts.filter((p) => p.url.endsWith("/ticker")).map((p) => p.body.instrument);

describe("createGrvtAdapter", () => {
  test("instruments hourly; a rotating slice of tickers, emitting only what this cycle read", async () => {
    const { client, posts } = fakeClient(await route());
    const adapter = createGrvtAdapter({ tickerBudget: 2 });

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(posts.slice(0, 1)).toEqual([
      { url: `${GRVT_API}/all_instruments`, body: { is_active: true } },
    ]);
    expect(posts.slice(1)).toEqual([
      { url: `${GRVT_API}/ticker`, body: { instrument: "BTC_USDT_Perp" } },
      { url: `${GRVT_API}/ticker`, body: { instrument: "ETH_USDT_Perp" } },
    ]);
    expect(first.snapshots.map((s) => s.venueSymbol)).toEqual(["BTC_USDT_Perp"]);

    posts.length = 0;
    const second = await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(posts.some((p) => p.url.endsWith("/all_instruments"))).toBe(false);
    expect(tickerNames(posts)).toEqual(["ENA_USDT_Perp", "XAU_USDT_Perp"]);
    expect(second.snapshots.map((s) => [s.venueSymbol, s.observedAt])).toEqual([
      ["ENA_USDT_Perp", NOW + 60_000],
    ]);

    posts.length = 0;
    await adapter.fetchSnapshots(client, NOW + 120_000);
    expect(tickerNames(posts)).toEqual(["AAPL_USDT_Perp", "KBONK_USDT_Perp"]);

    // A full sweep of six took three cycles; the fourth starts over with the oldest.
    posts.length = 0;
    await adapter.fetchSnapshots(client, NOW + 180_000);
    expect(tickerNames(posts)).toEqual(["BTC_USDT_Perp", "ETH_USDT_Perp"]);

    posts.length = 0;
    await adapter.fetchSnapshots(client, NOW + 60 * 60_000);
    expect(posts[0]?.url).toBe(`${GRVT_API}/all_instruments`);
  });

  test("the default budget sweeps 194 perps in two cycles, then wraps to the oldest", async () => {
    const names = Array.from({ length: 194 }, (_, i) => `C${i}_USDT_Perp`);
    const { client, posts } = fakeClient((url) =>
      url.endsWith("/all_instruments")
        ? {
            result: names.map((instrument) => ({
              instrument,
              base: instrument.split("_")[0],
              quote: "USDT",
              kind: "PERPETUAL",
              funding_interval_hours: 8,
            })),
          }
        : { result: null },
    );
    const adapter = createGrvtAdapter();
    await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 60_000);
    const seen = tickerNames(posts);
    // 100 then 100: the last 94 unseen, then the 6 read longest ago.
    expect(seen).toHaveLength(200);
    expect(new Set(seen.slice(0, 194)).size).toBe(194);
    expect(seen.slice(194)).toEqual(names.slice(0, 6));
  });

  test("a cycle whose every ticker fails is an error, not an empty venue", async () => {
    const all = await instruments();
    const { client } = fakeClient((url) => {
      if (url.endsWith("/all_instruments")) return { result: all };
      throw new CircuitOpenError("grvt", NOW + 300_000);
    });
    await expect(createGrvtAdapter().fetchSnapshots(client, NOW)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
  });

  test("history pages by cursor, 1,000 at a time, in nanoseconds", async () => {
    const all = await instruments();
    const H = 3_600_000;
    const T = 1_789_315_200_000;
    const { client, posts } = fakeClient((url, body) => {
      if (url.endsWith("/all_instruments")) return { result: all };
      const count = body.cursor ? 3 : 1000;
      const offset = body.cursor ? 1000 : 0;
      return {
        result: Array.from({ length: count }, (_, i) => ({
          instrument: "BTC_USDT_Perp",
          funding_rate: "0.01",
          funding_time: `${BigInt(T - (offset + i) * 8 * H) * 1_000_000n}`,
          mark_price: "77000",
          funding_interval_hours: 8,
        })),
        next: body.cursor ? undefined : "c1",
      };
    });
    const events =
      (await createGrvtAdapter().fetchFundingHistory?.(client, "BTC_USDT_Perp", 0, T)) ?? [];
    expect(posts.slice(1).map((p) => p.body)).toEqual([
      {
        instrument: "BTC_USDT_Perp",
        start_time: "0",
        end_time: `${BigInt(T) * 1_000_000n}`,
        limit: 1000,
      },
      {
        instrument: "BTC_USDT_Perp",
        start_time: "0",
        end_time: `${BigInt(T) * 1_000_000n}`,
        limit: 1000,
        cursor: "c1",
      },
    ]);
    expect(events).toHaveLength(1003);
    expect(events.every((e) => e.rate === 0.0001 && e.basisHours === 8)).toBe(true);
    expect(await createGrvtAdapter().fetchFundingHistory?.(client, "NOPE_USDT_Perp", 0, T)).toEqual(
      [],
    );
  });
});
