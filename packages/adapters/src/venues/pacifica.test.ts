import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import historyFixture from "../../__fixtures__/pacifica/funding_rate_history_BTC.json";
import infoFixture from "../../__fixtures__/pacifica/info.json";
import pricesFixture from "../../__fixtures__/pacifica/info_prices.json";
import type { HttpClient } from "../http";
import {
  createPacificaAdapter,
  PACIFICA_API,
  PACIFICA_TRADFI_TAGS,
  type PacificaFundingRecord,
  type PacificaMarketInfo,
  type PacificaPrice,
  pacificaAssetClass,
  pacificaPerpetuals,
  parsePacificaFundingHistory,
  parsePacificaSnapshots,
} from "./pacifica";

/** Real responses from Pacifica on 2026-09-14 (22:12 UTC), trimmed to ten markets, one of them spot. */
const prices: PacificaPrice[] = pricesFixture.data;
const info: PacificaMarketInfo[] = infoFixture.data;
const history: PacificaFundingRecord[] = historyFixture.data;
/** The `timestamp` every prices row carries. */
const NOW = 1_789_337_551_583;
const HOUR = 3_600_000;
const NEXT = 1_789_340_400_000;

describe("parsePacificaSnapshots", () => {
  test("normalizes BTC fully: the fixed next-hour rate, USDC, base OI at the mark", () => {
    const snapshots = parsePacificaSnapshots(prices, pacificaPerpetuals(info), NOW);
    expect(snapshots.find((s) => s.venueSymbol === "BTC")).toEqual({
      venueId: "pacifica",
      venueSymbol: "BTC",
      base: "BTC",
      assetClass: "crypto",
      quote: "USDC",
      multiplier: 1,
      dex: null,
      observedAt: NOW,
      rate: 0.00000475,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: NEXT,
      kind: "predicted",
      markPrice: 76922.3,
      indexPrice: 76956.945987,
      openInterestUsd: 412.34157 * 76922.3,
      volume24hUsd: 158617298.66148,
      maxLeverage: 50,
    });
  });

  test("`funding` is the rate the latest history record predicted for the coming settlement", () => {
    const btc = prices.find((p) => p.symbol === "BTC");
    // The 22:00 record settled 0.00000383 and fixed 0.00000475 for 23:00; prices carry the latter.
    expect(history[0]).toMatchObject({
      funding_rate: "0.00000383",
      next_funding_rate: "0.00000475",
    });
    expect(btc?.funding).toBe(history[0]?.next_funding_rate);
    // Each record's prediction is the next record's settlement.
    expect(history[1]?.next_funding_rate).toBe(history[0]?.funding_rate);
    expect(history[2]?.next_funding_rate).toBe(history[1]?.funding_rate);
  });

  test("across the 23:00 settlement, the fixed `funding` is what settled and `next_funding` took its place", () => {
    // Read live on 2026-09-14: prices at 22:59:08 UTC, then prices and each market's newest history
    // record at 23:04 UTC. [symbol, funding before, next_funding before, settled at 23:00, funding after].
    // Recorded evidence, pinned here so the decision cannot drift from what was observed.
    const roll: [string, string, string, string, string][] = [
      ["BTC", "0.00000475", "0.00000281", "0.00000475", "0.00000288"],
      ["ETH", "0.00001202", "0.0000023", "0.00001202", "0.00000199"],
      ["SOL", "-0.00000177", "-0.00002731", "-0.00000177", "-0.00002716"],
      ["NVDA", "0.0000125", "-0.00001397", "0.0000125", "-0.00001297"],
      ["kBONK", "-0.00000345", "0.0000068", "-0.00000345", "0.00000633"],
    ];
    // The rate a snapshot carried all hour is the rate the settlement it pointed at paid: 5 of 5.
    expect(roll.filter(([, before, , settled]) => before === settled)).toHaveLength(5);
    // `next_funding` kept moving until the roll and became the new fixed `funding` within one final
    // minute of averaging: never more than 0.0000011 from its last pre-roll read.
    for (const [, , estimateBefore, , fundingAfter] of roll) {
      expect(Math.abs(Number(fundingAfter) - Number(estimateBefore))).toBeLessThan(0.0000011);
    }
  });

  test("open interest is base units: BTC's 412 contracts are $31.7M, not $412", () => {
    const btc = parsePacificaSnapshots(prices, pacificaPerpetuals(info), NOW).find(
      (s) => s.venueSymbol === "BTC",
    );
    expect(btc?.openInterestUsd).toBeCloseTo(31_718_262, 0);
    expect(btc?.volume24hUsd).toBeGreaterThan(100_000_000);
  });

  test("an hourly rate annualises over one hour: 0.00000475 is 4.161% APR", () => {
    const btc = parsePacificaSnapshots(prices, pacificaPerpetuals(info), NOW).find(
      (s) => s.venueSymbol === "BTC",
    );
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(4.161, 3);
  });

  test("perpetuals only: the spot SOL-USDC row is skipped", () => {
    const symbols = parsePacificaSnapshots(prices, pacificaPerpetuals(info), NOW).map(
      (s) => s.venueSymbol,
    );
    expect(symbols).toEqual([
      "XPL",
      "XAU",
      "ETH",
      "EURUSD",
      "NVDA",
      "kBONK",
      "BTC",
      "PAXG",
      "SP500",
    ]);
  });
});

describe("asset class and base", () => {
  test("classes from the web app's tag map, bases from the parser except where the venue differs", () => {
    const rows = parsePacificaSnapshots(prices, pacificaPerpetuals(info), NOW).map((s) => [
      s.venueSymbol,
      s.base,
      s.multiplier,
      s.assetClass,
    ]);
    expect(rows).toEqual([
      // Absent from the tag map: declared nothing, so crypto.
      ["XPL", "XPL", 1, "crypto"],
      ["XAU", "XAU", 1, "commodity"],
      ["ETH", "ETH", 1, "crypto"],
      // The parser would read EUR against USD; the declared base is EURUSD.
      ["EURUSD", "EURUSD", 1, "fx"],
      ["NVDA", "NVDA", 1, "equity"],
      // Declared "kBONK"; the parsed x1000 is right, so it is kept.
      ["kBONK", "BONK", 1000, "crypto"],
      ["BTC", "BTC", 1, "crypto"],
      // Tagged Commodities, but a gold token stays crypto.
      ["PAXG", "PAXG", 1, "crypto"],
      // Tagged Equities; the alias reaches US500, which is an index.
      ["SP500", "US500", 1, "index"],
    ]);
  });

  test("the table holds the bundle's 38 tradfi entries, and anything else is crypto", () => {
    const counts = Object.values(PACIFICA_TRADFI_TAGS).reduce<Record<string, number>>(
      (acc, tag) => {
        acc[tag] = (acc[tag] ?? 0) + 1;
        return acc;
      },
      {},
    );
    expect(counts).toEqual({ Equities: 22, Commodities: 8, FX: 8 });
    expect(pacificaAssetClass("USDJPY")).toBe("fx");
    expect(pacificaAssetClass("CHIP")).toBe("crypto");
  });
});

describe("parsePacificaFundingHistory", () => {
  test("records become hourly settlements on the hour, oldest first, inside the window", () => {
    const btc = pacificaPerpetuals(info).get("BTC");
    const events = parsePacificaFundingHistory(
      history,
      "BTC",
      btc,
      NEXT - 3 * HOUR,
      NEXT - HOUR - 1,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours, e.quote])).toEqual([
      [NEXT - 3 * HOUR, 0.00000466, 1, "USDC"],
      [NEXT - 2 * HOUR, 0.00000632, 1, "USDC"],
    ]);
  });
});

function fakeClient(urls: string[]): HttpClient {
  return {
    venueId: "pacifica",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      const path = url.slice(PACIFICA_API.length).split("?")[0];
      if (path === "/info") return infoFixture as T;
      if (path === "/info/prices") return pricesFixture as T;
      if (path === "/funding_rate/history") return historyFixture as T;
      throw new Error(`unexpected ${url}`);
    },
    postJson: async () => {
      throw new Error("unexpected POST");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
}

describe("pacificaAdapter", () => {
  test("prices every cycle, info hourly", async () => {
    const urls: string[] = [];
    const client = fakeClient(urls);
    const adapter = createPacificaAdapter();

    await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    const batch = await adapter.fetchSnapshots(client, NOW + HOUR);

    const infoUrl = `${PACIFICA_API}/info`;
    const pricesUrl = `${PACIFICA_API}/info/prices`;
    expect(urls).toEqual([infoUrl, pricesUrl, pricesUrl, infoUrl, pricesUrl]);
    expect(adapter.venueId).toBe("pacifica");
    expect(batch.snapshots).toHaveLength(9);
    expect(batch.settled).toEqual([]);
  });

  test("history asks for the largest page and stops on a short one", async () => {
    const urls: string[] = [];
    const adapter = createPacificaAdapter();
    const events = await adapter.fetchFundingHistory?.(
      fakeClient(urls),
      "BTC",
      NEXT - 3 * HOUR,
      NEXT - HOUR,
    );
    expect(urls).toEqual([
      `${PACIFICA_API}/info`,
      `${PACIFICA_API}/funding_rate/history?symbol=BTC&limit=4000`,
    ]);
    expect(events?.map((e) => e.rate)).toEqual([0.00000466, 0.00000632, 0.00000383]);
  });
});
