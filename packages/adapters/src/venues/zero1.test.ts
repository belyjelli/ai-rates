import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import { marketRef } from "../parse";
import {
  createZero1Adapter,
  parseZero1Funding,
  parseZero1Snapshots,
  ZERO1_API,
  type Zero1HistoryPage,
  type Zero1Info,
  type Zero1MarketLive,
  zero1Base,
} from "./zero1";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/zero1/${name}`, import.meta.url)).json();

/** When `markets_live.json` was fetched, 2026-09-13 22:33:55 UTC. */
const NOW = 1_789_338_835_000;

const info = () => fixture<Zero1Info>("info.json");
const live = async () =>
  (await fixture<{ markets: Zero1MarketLive[] }>("markets_live.json")).markets;

describe("parseZero1Snapshots", () => {
  test("normalizes BTCUSD", async () => {
    const btc = parseZero1Snapshots(await info(), await live(), NOW).find(
      (s) => s.venueSymbol === "BTCUSD",
    );
    expect(btc).toEqual({
      venueId: "zero1",
      venueSymbol: "BTCUSD",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // The projection, not `lastSettledFundingRate` (-0.000001), which is what perpStats reports.
      rate: 0.000001,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: Date.parse("2026-09-13T23:00:00Z"),
      kind: "predicted",
      markPrice: 76795.1,
      indexPrice: 76788.81150574,
      openInterestUsd: 3.8737 * 76795.1,
      volume24hUsd: 1449689.884611,
    });
  });

  test("frozen markets and markets without a projection are skipped; RFQ markets are kept", async () => {
    expect(parseZero1Snapshots(await info(), await live(), NOW).map((s) => s.venueSymbol)).toEqual([
      "BTCUSD",
      "ETHUSD",
      // IPUSD (8) is frozen.
      "SUSD",
      "ARBUSD",
      "TAOUSD",
      "BNBUSD",
      "kPEPEUSD",
    ]);

    const rows = await live();
    const eth = rows.find((m) => m.marketId === 1);
    if (eth?.perpetuals) eth.perpetuals.projectedFundingRate = null;
    expect(parseZero1Snapshots(await info(), rows, NOW).map((s) => s.venueSymbol)).not.toContain(
      "ETHUSD",
    );
  });

  test("the base comes from the <base>USD grammar where the parser splits on BUSD", async () => {
    // What the parser alone would say.
    expect(marketRef("zero1", "ARBUSD")).toMatchObject({ base: "AR", quote: "BUSD" });
    expect(marketRef("zero1", "BNBUSD")).toMatchObject({ base: "BN", quote: "BUSD" });

    const all = parseZero1Snapshots(await info(), await live(), NOW);
    expect(all.map((s) => [s.venueSymbol, s.base, s.multiplier, s.quote, s.assetClass])).toEqual([
      ["BTCUSD", "BTC", 1, "USDC", "crypto"],
      ["ETHUSD", "ETH", 1, "USDC", "crypto"],
      ["SUSD", "S", 1, "USDC", "crypto"],
      ["ARBUSD", "ARB", 1, "USDC", "crypto"],
      ["TAOUSD", "TAO", 1, "USDC", "crypto"],
      ["BNBUSD", "BNB", 1, "USDC", "crypto"],
      ["kPEPEUSD", "PEPE", 1000, "USDC", "crypto"],
    ]);
    expect(zero1Base("BTC-PERP")).toBeNull();
    expect(zero1Base("USD")).toBeNull();
  });
});

describe("parseZero1Funding", () => {
  test("hourly settlements oldest first, with the published jitter and mark", async () => {
    const page = await fixture<Zero1HistoryPage>("history_PT1H_0.json");
    const btc = (await info()).markets[0];
    if (!btc) throw new Error("fixture");
    const events = parseZero1Funding(page.items, btc, await info(), 0, NOW);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours, e.markPrice])).toEqual([
      [Date.parse("2026-09-13T19:00:00.522Z"), -0.000007, 1, 77314.6],
      [Date.parse("2026-09-13T20:00:00.292Z"), 0.000004, 1, 77297.3],
      [Date.parse("2026-09-13T21:00:00.266Z"), 0, 1, 77313.4],
      [Date.parse("2026-09-13T22:00:00.333Z"), -0.000001, 1, 77285],
    ]);
    expect(events[0]).toMatchObject({ venueSymbol: "BTCUSD", base: "BTC", quote: "USDC" });
  });
});

function fakeClient(route: (url: string) => unknown) {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "zero1",
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

describe("createZero1Adapter", () => {
  test("markets/live every cycle, info hourly", async () => {
    const i = await info();
    const l = { markets: await live() };
    const { client, urls } = fakeClient((url) => (url.endsWith("/info") ? i : l));
    const adapter = createZero1Adapter();

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls).toEqual([`${ZERO1_API}/info`, `${ZERO1_API}/markets/live`]);
    expect(first.snapshots).toHaveLength(7);

    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    expect(urls).toEqual([`${ZERO1_API}/markets/live`]);
    urls.length = 0;
    await adapter.fetchSnapshots(client, NOW + 60 * 60_000);
    expect(urls).toEqual([`${ZERO1_API}/info`, `${ZERO1_API}/markets/live`]);
  });

  test("history follows the cursor back until a page passes fromMs", async () => {
    const i = await info();
    const H = 3_600_000;
    const T = Date.parse("2026-09-13T22:00:00Z");
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/info")) return i;
      const cursor = new URL(url).searchParams.get("startInclusive");
      const start = cursor === null ? 0 : Number(cursor);
      return {
        items: Array.from({ length: 255 }, (_, k) => ({
          marketId: 1,
          time: new Date(T - (start + k) * H).toISOString(),
          actionId: 1_000_000 - start - k,
          fundingRate: 0.00001,
          markPrice: 2500,
        })),
        nextStartInclusive: start + 255,
      };
    });
    const adapter = createZero1Adapter();
    const events = (await adapter.fetchFundingHistory?.(client, "ETHUSD", T - 300 * H, T)) ?? [];
    expect(urls).toEqual([
      `${ZERO1_API}/info`,
      `${ZERO1_API}/market/1/history/PT1H?pageSize=255`,
      `${ZERO1_API}/market/1/history/PT1H?pageSize=255&startInclusive=255`,
    ]);
    expect(events).toHaveLength(301);
    expect(events[0]?.settledAt).toBe(T - 300 * H);
    expect(events.at(-1)?.settledAt).toBe(T);
    expect(await adapter.fetchFundingHistory?.(client, "NOPEUSD", 0, T)).toEqual([]);
  });
});
