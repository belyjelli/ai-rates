import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import contractsFixture from "../../__fixtures__/ondo/contracts.json";
import historyFixture from "../../__fixtures__/ondo/funding_rate_history_BTC.json";
import markPricesFixture from "../../__fixtures__/ondo/mark_prices.json";
import type { HttpClient } from "../http";
import {
  createOndoAdapter,
  ONDO_API,
  type OndoContract,
  type OndoFundingRateValue,
  type OndoMarkPrice,
  ondoAssetClass,
  parseOndoFundingHistory,
  parseOndoSnapshots,
  parseOndoTime,
} from "./ondo";

/** Real rows from Ondo on 2026-09-14 (22:13 UTC), trimmed to eleven contracts. */
const contracts: OndoContract[] = contractsFixture.result;
const markPrices: Record<string, OndoMarkPrice> = markPricesFixture.result;
const history: OndoFundingRateValue[] = historyFixture.result;
const NOW = 1_789_337_600_000;
const HOUR = 3_600_000;
const NEXT = Date.parse("2026-09-13T23:00:00Z");

describe("parseOndoSnapshots", () => {
  test("normalizes BTC fully: hourly predicted rate, USDC settlement, mark from mark_prices", () => {
    const { snapshots } = parseOndoSnapshots(contracts, markPrices, NOW);
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USD.P")).toEqual({
      venueId: "ondo",
      venueSymbol: "BTC-USD.P",
      base: "BTC",
      assetClass: "crypto",
      quote: "USDC",
      multiplier: 1,
      dex: null,
      observedAt: NOW,
      rate: -0.0000359,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: NEXT,
      kind: "predicted",
      markPrice: 76717.784222,
      indexPrice: Number("77281.17631550499899555"),
      openInterestUsd: 4264581.94,
      volume24hUsd: 3500014.55,
    });
  });

  test("the last completed interval's rate is a settlement an hour before the next one", () => {
    const { settled } = parseOndoSnapshots(contracts, markPrices, NOW);
    const btc = settled.find((e) => e.venueSymbol === "BTC-USD.P");
    expect(btc).toMatchObject({ settledAt: NEXT - HOUR, rate: -0.0000338, basisHours: 1 });
    // The same figure the history endpoint files at 22:00.
    expect(history[0]).toMatchObject({ market: "BTC-USD.P", fundingRate: "-0.0000338" });
    expect(parseOndoTime(history[0]?.time)).toBe(NEXT - HOUR + 37);
  });

  test("keeps enabled perps, closed equity sessions included, and skips disabled ones", () => {
    const { snapshots } = parseOndoSnapshots(contracts, markPrices, NOW);
    const symbols = snapshots.map((s) => s.venueSymbol);
    expect(symbols).not.toContain("PUMP-USD.P");
    expect(symbols).not.toContain("EURUSD-USD.P");
    // AAPL is `isClosed` on a Sunday evening yet enabled, and funds every hour through the closure.
    expect(contracts.find((c) => c.market === "AAPL-USD.P")?.isClosed).toBe(true);
    expect(symbols).toContain("AAPL-USD.P");
    expect(symbols).toHaveLength(9);
  });

  test("a missing mark leaves the mark null without dropping the market", () => {
    const { snapshots } = parseOndoSnapshots(contracts, {}, NOW);
    expect(snapshots).toHaveLength(9);
    expect(snapshots.every((s) => s.markPrice === null)).toBe(true);
  });

  test("an hourly rate annualises over one hour: -0.0000359 is -31.45% APR", () => {
    const btc = parseOndoSnapshots(contracts, markPrices, NOW).snapshots[0];
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 0)).toBeCloseTo(-31.4484, 4);
  });
});

describe("asset class", () => {
  test("taken from the declared tag, with bases settling equity versus index", () => {
    const classes = parseOndoSnapshots(contracts, markPrices, NOW).snapshots.map((s) => [
      s.venueSymbol,
      s.base,
      s.assetClass,
    ]);
    expect(classes).toEqual([
      ["BTC-USD.P", "BTC", "crypto"],
      ["ETH-USD.P", "ETH", "crypto"],
      ["ZEC-USD.P", "ZEC", "crypto"],
      ["AAPL-USD.P", "AAPL", "equity"],
      ["XAU-USD.P", "XAU", "commodity"],
      // WTI reaches CL through the core alias.
      ["WTI-USD.P", "CL", "commodity"],
      // Tagged ETF: equity, as five venues file SPY.
      ["SPY-USD.P", "SPY", "equity"],
      ["US500-USD.P", "US500", "index"],
      ["USDJPY-USD.P", "USDJPY", "fx"],
    ]);
  });

  test("an unknown tag is still not crypto, and no tag declares nothing", () => {
    expect(ondoAssetClass(["Bond"], "XAG")).toBe("commodity");
    expect(ondoAssetClass(["Bond"], "TLT")).toBe("equity");
    expect(ondoAssetClass([], "XAU")).toBe("crypto");
    expect(ondoAssetClass(undefined, "AAPL")).toBe("crypto");
    expect(ondoAssetClass(["ETF"], "QQQ")).toBe("equity");
    expect(ondoAssetClass(["Index"], "US100")).toBe("index");
  });
});

describe("parseOndoTime", () => {
  test("accepts nanosecond fractions and plain seconds", () => {
    expect(parseOndoTime("2026-09-13T22:00:00.037237665Z")).toBe(NEXT - HOUR + 37);
    expect(parseOndoTime("2026-09-13T23:00:00Z")).toBe(NEXT);
    expect(parseOndoTime("")).toBeNull();
    expect(parseOndoTime("not a time")).toBeNull();
  });
});

describe("parseOndoFundingHistory", () => {
  test("newest-first rows become oldest-first settlements on the hour, inside the window", () => {
    const btc = contracts.find((c) => c.market === "BTC-USD.P") as OndoContract;
    // The rows are stamped 20:00:00.011, 21:00:00.038 and 22:00:00.037; the window stops short of 22:00.
    const events = parseOndoFundingHistory(history, btc, NEXT - 3 * HOUR, NEXT - HOUR - 1);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours, e.quote])).toEqual([
      [NEXT - 3 * HOUR, -0.0000177, 1, "USDC"],
      [NEXT - 2 * HOUR, -0.000054, 1, "USDC"],
    ]);
  });

  test("history lands on the same instant as the settlement the contracts endpoint reports", () => {
    const btc = contracts.find((c) => c.market === "BTC-USD.P") as OndoContract;
    const fromHistory = parseOndoFundingHistory(history, btc, 0, NEXT).at(-1);
    const fromContracts = parseOndoSnapshots(contracts, markPrices, NOW).settled[0];
    expect(fromHistory?.settledAt).toBe(NEXT - HOUR);
    expect(fromHistory?.settledAt).toBe(fromContracts?.settledAt);
    expect(fromHistory?.rate).toBe(fromContracts?.rate);
  });
});

function fakeClient(bodies: Record<string, unknown>, urls: string[]): HttpClient {
  return {
    venueId: "ondo",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      const path = url.slice(ONDO_API.length).split("?")[0] as string;
      const body = bodies[path];
      if (body instanceof Error) throw body;
      if (body === undefined) throw new Error(`unexpected ${url}`);
      return body as T;
    },
    postJson: async () => {
      throw new Error("unexpected POST");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
}

describe("ondoAdapter", () => {
  test("two calls a cycle, and a failed mark read keeps the funding", async () => {
    const urls: string[] = [];
    const adapter = createOndoAdapter();
    const batch = await adapter.fetchSnapshots(
      fakeClient(
        { "/perps/contracts": contractsFixture, "/perps/mark_prices": markPricesFixture },
        urls,
      ),
      NOW,
    );
    expect(adapter.venueId).toBe("ondo");
    expect(urls.sort()).toEqual([`${ONDO_API}/perps/contracts`, `${ONDO_API}/perps/mark_prices`]);
    expect(batch.snapshots).toHaveLength(9);
    expect(batch.settled).toHaveLength(9);

    const degraded = await adapter.fetchSnapshots(
      fakeClient(
        { "/perps/contracts": contractsFixture, "/perps/mark_prices": new Error("HTTP 502") },
        [],
      ),
      NOW,
    );
    expect(degraded.snapshots).toHaveLength(9);
    expect(degraded.snapshots[0]?.markPrice).toBeNull();
  });

  test("history asks for the window, stops on a short page, and takes the class from contracts", async () => {
    const urls: string[] = [];
    const adapter = createOndoAdapter();
    const from = NEXT - 3 * HOUR;
    const to = NEXT - HOUR - 1;
    const events = await adapter.fetchFundingHistory?.(
      fakeClient(
        {
          "/perps/funding_rate_history": historyFixture,
          "/perps/contracts": contractsFixture,
        },
        urls,
      ),
      "BTC-USD.P",
      from,
      to,
    );
    expect(urls).toEqual([
      `${ONDO_API}/perps/funding_rate_history?market=BTC-USD.P&startTime=${from}&endTime=${to}&limit=1000`,
      `${ONDO_API}/perps/contracts`,
    ]);
    expect(events?.map((e) => e.rate)).toEqual([-0.0000177, -0.000054]);
    expect(events?.[0]?.assetClass).toBe("crypto");
  });
});
