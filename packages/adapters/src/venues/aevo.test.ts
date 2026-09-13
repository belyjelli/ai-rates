import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import {
  AEVO_API,
  type AevoFundingRow,
  type AevoMarket,
  type AevoStatistic,
  aevoAssetClass,
  createAevoAdapter,
  nsToMs,
  parseAevoFunding,
  parseAevoSnapshots,
} from "./aevo";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/aevo/${name}`, import.meta.url)).json();

/** Around when the fixtures were fetched, 2026-09-13 22:30 UTC. */
const NOW = 1_789_338_600_000;

const markets = () => fixture<AevoMarket[]>("markets.json");
const statistics = () => fixture<AevoStatistic[]>("coingecko-statistics.json");

describe("parseAevoSnapshots", () => {
  test("normalizes BTC-PERP", async () => {
    const btc = parseAevoSnapshots(await markets(), await statistics(), NOW).find(
      (s) => s.venueSymbol === "BTC-PERP",
    );
    expect(btc).toEqual({
      venueId: "aevo",
      venueSymbol: "BTC-PERP",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // One hour: the 8h formula divided by the funding interval. 0.000008/h is 7.0% APR.
      rate: 0.000008,
      basisHours: 1,
      intervalHours: 1,
      // Epoch seconds in the statistics call.
      nextFundingAt: 1_789_340_400_000,
      kind: "predicted",
      markPrice: 76729.48536,
      indexPrice: 76759.462906,
      // Contracts, whatever the spec says: 26.2 BTC is $2.0M.
      openInterestUsd: 26.235999 * 76729.48536,
      volume24hUsd: 1889388.228,
      maxLeverage: 20,
    });
  });

  test("active perps that have statistics only", async () => {
    const all = parseAevoSnapshots(await markets(), await statistics(), NOW);
    // BEAMX-PERP is in the statistics (delisted) but not among active markets.
    expect(all.map((s) => s.venueSymbol)).not.toContain("BEAMX-PERP");
    expect(all).toHaveLength(9);

    const rows = await markets();
    const [btc, eth] = rows;
    if (btc) btc.is_active = false;
    if (eth) eth.instrument_type = "OPTION";
    const symbols = parseAevoSnapshots(rows, await statistics(), NOW).map((s) => s.venueSymbol);
    expect(symbols).not.toContain("BTC-PERP");
    expect(symbols).not.toContain("ETH-PERP");

    const stats = await statistics();
    const mstr = stats.find((s) => s.ticker_id === "MSTR-PERP");
    if (mstr) mstr.funding_rate = "";
    expect(parseAevoSnapshots(await markets(), stats, NOW).map((s) => s.venueSymbol)).not.toContain(
      "MSTR-PERP",
    );
  });

  test("class from market_type, quote from quote_asset, multiplier from the symbol", async () => {
    const all = parseAevoSnapshots(await markets(), await statistics(), NOW);
    expect(all.map((s) => [s.venueSymbol, s.base, s.multiplier, s.assetClass, s.quote])).toEqual([
      ["BTC-PERP", "BTC", 1, "crypto", "USDC"],
      ["ETH-PERP", "ETH", 1, "crypto", "USDC"],
      ["MSTR-PERP", "MSTR", 1, "equity", "USDC"],
      ["XAU-PERP", "XAU", 1, "commodity", "USDC"],
      ["USDJPY-PERP", "USDJPY", 1, "fx", "USDC"],
      // `compute` has no class of its own; H100 is in the index table.
      ["H100-PERP", "H100", 1, "index", "USDC"],
      ["ANTHROPIC-PERP", "ANTHROPIC", 1, "equity", "USDC"],
      ["SPY-PERP", "SPY", 1, "equity", "USDC"],
      ["1000PEPE-PERP", "PEPE", 1000, "crypto", "USDC"],
    ]);
    expect(aevoAssetClass("something_new", false, "FOO")).toBe("crypto");
    expect(aevoAssetClass("something_new", true, "XAG")).toBe("commodity");
    expect(aevoAssetClass(undefined, true, "NVDA")).toBe("equity");
  });
});

describe("parseAevoFunding", () => {
  test("nanosecond times, oldest first, hourly basis, mark kept", async () => {
    const { funding_history } = await fixture<{ funding_history: AevoFundingRow[] }>(
      "funding-history_BTC-PERP.json",
    );
    const btc = (await markets())[0] as AevoMarket;
    const events = parseAevoFunding(funding_history, btc, 1_789_329_600_000, NOW);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours, e.markPrice])).toEqual([
      [1_789_329_600_000, 0.00001, 1, 77264.648569],
      [1_789_333_200_000, 0.000012, 1, 77326.214489],
      [1_789_336_800_000, 0.00001, 1, 77294.556299],
    ]);
    expect(events[0]).toMatchObject({ base: "BTC", quote: "USDC", assetClass: "crypto" });
  });

  test("nsToMs is exact and rejects non-integers", () => {
    expect(nsToMs("1789336800000000000")).toBe(1_789_336_800_000);
    expect(nsToMs("1789336800123456789")).toBe(1_789_336_800_123);
    expect(nsToMs("1.5e18")).toBeNull();
    expect(nsToMs(undefined)).toBeNull();
  });
});

function fakeClient(route: (url: string) => unknown) {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "aevo",
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

describe("createAevoAdapter", () => {
  test("two bulk requests a cycle", async () => {
    const m = await markets();
    const s = await statistics();
    const { client, urls } = fakeClient((url) => (url.includes("/markets") ? m : s));
    const batch = await createAevoAdapter().fetchSnapshots(client, NOW);
    expect(urls).toEqual([
      `${AEVO_API}/markets?instrument_type=PERPETUAL`,
      `${AEVO_API}/coingecko-statistics`,
    ]);
    expect(batch.snapshots).toHaveLength(9);
  });

  test("history pages 50 at a time, stepping end_time past the oldest row", async () => {
    const H = 3_600_000;
    const T = 1_789_336_800_000;
    const ns = (ms: number) => BigInt(ms) * 1_000_000n;
    const { client, urls } = fakeClient((url) => {
      const end = BigInt(new URL(url).searchParams.get("end_time") as string);
      const newestMs = Number(end / 1_000_000n / BigInt(H)) * H;
      const count = newestMs === T ? 50 : 4;
      return {
        funding_history: Array.from({ length: count }, (_, i) => [
          "ETH-PERP",
          `${ns(newestMs - i * H)}`,
          "0.000012",
          "2480.5",
        ]),
      };
    });
    const events =
      (await createAevoAdapter().fetchFundingHistory?.(client, "ETH-PERP", 0, T)) ?? [];
    const oldestFirstPage = ns(T - 49 * H);
    expect(urls).toEqual([
      `${AEVO_API}/funding-history?instrument_name=ETH-PERP&start_time=0&end_time=${ns(T) + 999_999n}&limit=50`,
      `${AEVO_API}/funding-history?instrument_name=ETH-PERP&start_time=0&end_time=${oldestFirstPage - 1n}&limit=50`,
    ]);
    expect(events).toHaveLength(54);
    expect(events[0]?.settledAt).toBe(T - 53 * H);
    expect(events.every((e) => e.basisHours === 1 && e.quote === "USDC")).toBe(true);
  });
});
