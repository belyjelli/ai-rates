import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import type { HttpClient } from "../http";
import {
  createParadexAdapter,
  PARADEX_API,
  type ParadexMarket,
  type ParadexResults,
  type ParadexSummary,
  paradexDeclaredClass,
  parseParadexSnapshots,
} from "./paradex";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/paradex/${name}`, import.meta.url)).json();

const NOW = 1_789_147_120_000;

describe("parseParadexSnapshots", () => {
  test("normalizes BTC perps and skips options", async () => {
    const summary = await fixture<ParadexResults<ParadexSummary>>("markets-summary.json");
    const markets = await fixture<ParadexResults<ParadexMarket>>("markets.json");
    const snapshots = parseParadexSnapshots(summary, markets, NOW);

    expect(snapshots.map((s) => s.venueSymbol)).toEqual(["BTC-USD-PERP", "ETH-USD-PERP"]);
    const btc = snapshots[0];
    expect(btc).toMatchObject({
      venueId: "paradex",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.00007688102642,
      basisHours: 8,
      intervalHours: null,
      nextFundingAt: null,
      kind: "predicted",
      markPrice: 77804.85141726,
      indexPrice: 77788.24195927,
    });
    expect(btc?.openInterestUsd).toBeCloseTo(50.4599 * 77804.85141726, 4);
    expect(btc?.volume24hUsd).toBeCloseTo(4273947.632803999, 6);
    // 0.00007688102642 over 8h -> 8.4185% simple APR.
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 1)).toBeCloseTo(
      8.418472393,
      6,
    );
  });

  test("skips perps without a known funding period", async () => {
    const summary = await fixture<ParadexResults<ParadexSummary>>("markets-summary.json");
    const markets = await fixture<ParadexResults<ParadexMarket>>("markets.json");
    const withoutPeriod = {
      results: markets.results.map((m) =>
        m.symbol === "ETH-USD-PERP" ? { ...m, funding_period_hours: 0 } : m,
      ),
    };
    expect(parseParadexSnapshots(summary, withoutPeriod, NOW).map((s) => s.venueSymbol)).toEqual([
      "BTC-USD-PERP",
    ]);
  });
});

describe("asset class", () => {
  test("the RWA tag declares not-crypto, and the base tables settle which kind", () => {
    // Symbol, tags, mark and funding rate as /v1/markets and its summary returned them on 2026-09-14.
    const rows: [string, string[], string, string][] = [
      ["XAU-USD-PERP", ["RWA"], "4347.40965101", "0.00008486771875"],
      ["NG-USD-PERP", ["RWA"], "2.96534246", "0.00003794032754"],
      ["US500-USD-PERP", ["RWA"], "7613.60043367", "0.00004992814582"],
      ["MSTR-USD-PERP", ["RWA"], "130.06003982", "-0.00005212287882"],
      ["DRAM-USD-PERP", ["RWA"], "56.72746065", "0.00001660279227"],
      ["PAXG-USD-PERP", ["DEFI"], "4344.66416924", "0.0000866282175"],
      ["BTC-USD-PERP", ["LAYER-1"], "77352.23249441", "0.000088284432"],
    ];
    const markets = {
      results: rows.map(([symbol, tags]) => ({
        symbol,
        asset_kind: "PERP",
        funding_period_hours: 8,
        quote_currency: "USD",
        settlement_currency: "USDC",
        tags,
      })),
    };
    const summary = {
      results: rows.map(([symbol, , mark_price, funding_rate]) => ({
        symbol,
        mark_price,
        funding_rate,
      })),
    };

    const classes = parseParadexSnapshots(summary, markets, NOW).map((s) => [
      s.venueSymbol,
      s.base,
      s.assetClass,
    ]);
    expect(classes).toEqual([
      ["XAU-USD-PERP", "XAU", "commodity"],
      // The alias reaches NATGAS before the commodity table is consulted.
      ["NG-USD-PERP", "NATGAS", "commodity"],
      ["US500-USD-PERP", "US500", "index"],
      ["MSTR-USD-PERP", "MSTR", "equity"],
      // An ETF, which the tables file as equity.
      ["DRAM-USD-PERP", "DRAM", "equity"],
      // Tagged DEFI by Paradex: a gold token, and crypto on the venue's own word.
      ["PAXG-USD-PERP", "PAXG", "crypto"],
      ["BTC-USD-PERP", "BTC", "crypto"],
    ]);
  });

  test("paradexDeclaredClass never reads a class off an untagged ticker", () => {
    expect(paradexDeclaredClass(undefined, "XAU")).toBe("crypto");
    expect(paradexDeclaredClass([], "US500")).toBe("crypto");
    expect(paradexDeclaredClass(["rwa"], "XAG")).toBe("commodity");
  });
});

describe("paradexAdapter", () => {
  test("caches /markets for an hour and has no funding history", async () => {
    const summary = await fixture<ParadexResults<ParadexSummary>>("markets-summary.json");
    const markets = await fixture<ParadexResults<ParadexMarket>>("markets.json");
    const urls: string[] = [];
    const client: HttpClient = {
      venueId: "paradex",
      getJson: async (url) => {
        urls.push(url);
        return (url.endsWith("/markets") ? markets : summary) as never;
      },
      postJson: async () => {
        throw new Error("unexpected POST");
      },
      circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
      requestCount: () => urls.length,
    };
    const adapter = createParadexAdapter();

    await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 59 * 60_000);
    const batch = await adapter.fetchSnapshots(client, NOW + 60 * 60_000);

    const marketsUrl = `${PARADEX_API}/markets`;
    const summaryUrl = `${PARADEX_API}/markets/summary?market=ALL`;
    expect(urls).toEqual([marketsUrl, summaryUrl, summaryUrl, marketsUrl, summaryUrl]);
    expect(batch.snapshots).toHaveLength(2);
    expect(adapter.fetchFundingHistory).toBeUndefined();
  });
});
