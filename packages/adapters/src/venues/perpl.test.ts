import { describe, expect, test } from "bun:test";
import contextFixture from "../../__fixtures__/perpl/context.json";
import type { HttpClient } from "../http";
import { createPerplAdapter, PERPL_API, type PerplContext, parsePerplContext } from "./perpl";

const NOW = 1_789_338_600_000; // 2026-09-13T22:30:00Z
const context = contextFixture as unknown as PerplContext;
const EVENT = 1_789_336_368_000; // funding.at.t on every fixture market
const INTERVAL_HOURS = 2580 / 3600;

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "perpl",
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

function withMarket(
  name: string,
  change: (m: PerplContext["markets"][number]) => void,
): PerplContext {
  const copy = structuredClone(context);
  const market = copy.markets.find((m) => m.name === name);
  if (market) change(market);
  return copy;
}

describe("parsePerplContext", () => {
  const { snapshots, settled } = parsePerplContext(context, NOW);

  test("normalizes BTC: micros per 2580s event, settled, scaled prices and collateral volume", () => {
    expect(snapshots.find((s) => s.venueSymbol === "BTC")).toEqual({
      venueId: "perpl",
      venueSymbol: "BTC",
      base: "BTC",
      quote: "AUSD",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 40 * 1e-6,
      basisHours: INTERVAL_HOURS,
      intervalHours: INTERVAL_HOURS,
      nextFundingAt: EVENT + 2_580_000,
      kind: "settled",
      markPrice: 76773.1,
      indexPrice: 76768,
      openInterestUsd: (1_086_858 / 10 ** 5) * 76773.1,
      volume24hUsd: 291_977_473_222_361 / 10 ** 6,
    });
    expect(settled.find((e) => e.venueSymbol === "BTC")).toEqual({
      venueId: "perpl",
      venueSymbol: "BTC",
      base: "BTC",
      quote: "AUSD",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      settledAt: EVENT,
      rate: 40 * 1e-6,
      basisHours: INTERVAL_HOURS,
      markPrice: null,
    });
  });

  test("rate is micros of the index: the venue's own payment is idx x rate x 1e-6 x div", () => {
    for (const market of context.markets) {
      const f = market.funding as unknown as {
        rate: number;
        idx: number;
        ppl: number;
        div: number;
      };
      // Truncated toward zero on-chain.
      expect(Math.trunc(f.idx * f.rate * 1e-6 * f.div)).toBe(f.ppl);
    }
    expect(snapshots.find((s) => s.venueSymbol === "ETH")?.rate).toBe(-40 * 1e-6);
    // Per hour: 5.6e-5, the same order as Hyperliquid's 1.25e-5 -- not 1e6 away from it.
    const btc = snapshots.find((s) => s.venueSymbol === "BTC");
    expect((btc?.rate ?? 0) / (btc?.basisHours ?? 1)).toBeCloseTo(5.58e-5, 7);
  });

  test("each market's own price and size decimals; volume in the collateral token's decimals", () => {
    const mon = snapshots.find((s) => s.venueSymbol === "MON");
    expect(mon?.markPrice).toBe(0.022618);
    expect(mon?.indexPrice).toBe(0.022633);
    expect(mon?.openInterestUsd).toBeCloseTo(5_386_209 * 0.022618, 6);
    expect(mon?.volume24hUsd).toBeCloseTo(212_988.830788, 6);
    const eth = snapshots.find((s) => s.venueSymbol === "ETH");
    expect(eth?.markPrice).toBe(2479.12);
    expect(eth?.volume24hUsd).toBeCloseTo(2_335_278.22149, 6);
  });

  test("declares no class, so all crypto; quote is the instance's collateral token", () => {
    expect(snapshots.map((s) => [s.venueSymbol, s.base, s.assetClass, s.quote])).toEqual([
      ["BTC", "BTC", "crypto", "AUSD"],
      ["MON", "MON", "crypto", "AUSD"],
      ["ETH", "ETH", "crypto", "AUSD"],
    ]);
    expect(settled).toHaveLength(3);
  });

  test("closed markets and markets without a funding event are skipped", () => {
    const closed = withMarket("MON", (m) => {
      m.config.is_open = false;
    });
    const unfunded = withMarket("ETH", (m) => {
      m.funding = null;
    });
    expect(parsePerplContext(closed, NOW).snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTC",
      "ETH",
    ]);
    expect(parsePerplContext(unfunded, NOW).settled.map((e) => e.venueSymbol)).toEqual([
      "BTC",
      "MON",
    ]);
  });

  test("an event served with milliseconds settles at the same second as without them", () => {
    const withMs = withMarket("BTC", (m) => {
      if (m.funding) m.funding.at.t = 1_789_339_000_946;
    });
    const withoutMs = withMarket("BTC", (m) => {
      if (m.funding) m.funding.at.t = 1_789_339_000_000;
    });
    const a = parsePerplContext(withMs, NOW);
    const b = parsePerplContext(withoutMs, NOW);
    expect(a.settled[0]?.settledAt).toBe(1_789_339_000_000);
    expect(a.settled[0]).toEqual(b.settled[0]);
    expect(a.snapshots[0]?.nextFundingAt).toBe(1_789_339_000_000 + 2_580_000);
  });
});

describe("createPerplAdapter", () => {
  test("one pub/context request per cycle, within ~100 public requests a minute", async () => {
    const { client, urls } = fakeClient(() => context);
    const adapter = createPerplAdapter();
    for (let cycle = 0; cycle < 3; cycle++) {
      const batch = await adapter.fetchSnapshots(client, NOW + cycle * 60_000);
      expect(batch.snapshots).toHaveLength(3);
    }
    expect(urls).toEqual([
      `${PERPL_API}/pub/context`,
      `${PERPL_API}/pub/context`,
      `${PERPL_API}/pub/context`,
    ]);
    expect(adapter.minIntervalMs).toBeGreaterThanOrEqual(600);
    expect(adapter.fetchFundingHistory).toBeUndefined();
  });

  test("an unexpected body fails the cycle rather than emitting nothing", async () => {
    const { client } = fakeClient(() => ({ error: "rate limited" }));
    expect(createPerplAdapter().fetchSnapshots(client, NOW)).rejects.toThrow("perpl");
  });
});
