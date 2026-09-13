import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import type { HttpClient } from "../http";
import {
  createLighterAdapter,
  LIGHTER_API,
  LIGHTER_ASSET_CLASSES,
  type LighterFundingRates,
  type LighterFundings,
  type LighterOrderBookDetails,
  parseLighterFundings,
  parseLighterSnapshots,
} from "./lighter";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/lighter/${name}`, import.meta.url)).json();

// 2026-09-11T16:38:40Z; the next hourly settlement is 17:00:00Z.
const NOW = 1_789_147_120_000;
const NEXT_HOUR = 1_789_149_600_000;

function fakeClient(handler: (url: string) => unknown) {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "lighter",
    getJson: async (url) => {
      urls.push(url);
      return handler(url) as never;
    },
    postJson: async () => {
      throw new Error("unexpected POST");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
  return { client, urls };
}

describe("parseLighterSnapshots", () => {
  test("keeps Lighter's own 8h rates joined with market details", async () => {
    const rates = await fixture<LighterFundingRates>("funding-rates.json");
    const details = await fixture<LighterOrderBookDetails>("order-book-details.json");
    const snapshots = parseLighterSnapshots(rates, details, NOW);

    // Relayed binance/bybit/hyperliquid rows are dropped.
    expect(snapshots.map((s) => s.venueSymbol)).toEqual(["ETH", "BTC"]);
    const btc = snapshots[1];
    expect(btc).toMatchObject({
      venueId: "lighter",
      base: "BTC",
      assetClass: "crypto",
      // Declared by the docs for every perp; the API's perp quote_asset_id is 0 (no asset).
      quote: "USDC",
      dex: null,
      observedAt: NOW,
      rate: 0.00009599999999999999,
      basisHours: 8,
      intervalHours: 1,
      nextFundingAt: NEXT_HOUR,
      kind: "predicted",
      markPrice: 77758.9,
      indexPrice: 77791.3,
    });
    expect(btc?.openInterestUsd).toBeCloseTo(2092.76507 * 77758.9, 4);
    expect(btc?.volume24hUsd).toBeCloseTo(850015955.986308, 6);
    // 0.000096 over 8h -> 10.512% simple APR.
    expect(aprFromRate(btc?.rate ?? 0, "fraction", btc?.basisHours ?? 1)).toBeCloseTo(10.512, 6);
  });

  test("skips markets that aren't active", async () => {
    const rates = await fixture<LighterFundingRates>("funding-rates.json");
    const details = await fixture<LighterOrderBookDetails>("order-book-details.json");
    const withInactive = {
      funding_rates: [
        ...rates.funding_rates,
        { market_id: 135, exchange: "lighter", symbol: "PIPPIN", rate: 0.0001 },
      ],
    };
    expect(
      parseLighterSnapshots(withInactive, details, NOW).map((s) => s.venueSymbol),
    ).not.toContain("PIPPIN");
  });
});

describe("asset class", () => {
  test("markets take the class Lighter publishes for them, and anything unlisted is crypto", () => {
    // market_id, symbol and mark_price as orderBookDetails returned them on 2026-09-14.
    const markets: [number, string, string][] = [
      [190, "QNT", "48.794"],
      [211, "BB", "7.7244"],
      [214, "WEN", "7.6081"],
      [198, "USDHKD", "7.8423"],
      [92, "XAU", "4345.03"],
      [180, "US500", "7610.6"],
      [227, "US10Y", "98.26"],
      [48, "PAXG", "4344.45"],
      [232, "AI", "0.27601"],
      [42, "SPX", "0.49561"],
      [1, "BTC", "77317.8"],
    ];
    const details = {
      order_book_details: markets.map(([market_id, symbol, mark_price]) => ({
        market_id,
        symbol,
        market_type: "perp",
        status: "active",
        mark_price,
      })),
    };
    const rates = {
      funding_rates: markets.map(([market_id, symbol]) => ({
        market_id,
        exchange: "lighter",
        symbol,
        rate: 0.000032,
      })),
    };

    const snapshots = parseLighterSnapshots(rates, details, NOW);
    // Every market settles in USDC, whatever its class, and a symbol like USDHKD lends it no quote.
    expect(new Set(snapshots.map((s) => s.quote))).toEqual(new Set(["USDC"]));
    const classes = new Map(snapshots.map((s) => [s.venueSymbol, s.assetClass]));
    expect(Object.fromEntries(classes)).toEqual({
      // Quantinuum stock at 48.79, not the Quant token at 64.3, whatever the app config calls it.
      QNT: "equity",
      // BlackBerry and Wendy's, not BounceBit and the memecoin.
      BB: "equity",
      WEN: "equity",
      // Typed fx by the docs, although the app config says CRYPTO.
      USDHKD: "fx",
      XAU: "commodity",
      US500: "index",
      // A bond, filed with yields as an index.
      US10Y: "index",
      // A gold token: the config's COMMODITIES label is not taken.
      PAXG: "crypto",
      // Artificial Inu and SPX6900, not tradfi however they are spelt.
      AI: "crypto",
      SPX: "crypto",
      BTC: "crypto",
    });
  });

  test("the table stays sorted, one entry per market", () => {
    const symbols = [...LIGHTER_ASSET_CLASSES.keys()];
    expect(symbols).toEqual([...symbols].sort());
  });
});

describe("parseLighterFundings", () => {
  test("converts unsigned hourly percent into signed fractions, oldest first", async () => {
    const payload = await fixture<LighterFundings>("fundings-btc.json");
    const shuffled = {
      fundings: [
        ...[...payload.fundings].reverse(),
        { timestamp: 1_789_149_600, value: "0.08", rate: "0.0001", direction: "short" },
      ],
    };
    const events = parseLighterFundings("BTC", shuffled);

    expect(events.map((e) => e.settledAt)).toEqual([
      1_789_135_200_000, 1_789_138_800_000, 1_789_142_400_000, 1_789_146_000_000, 1_789_149_600_000,
    ]);
    expect(events[0]).toMatchObject({
      venueId: "lighter",
      venueSymbol: "BTC",
      base: "BTC",
      quote: "USDC",
      basisHours: 1,
      markPrice: null,
    });
    expect(events[0]?.rate).toBeCloseTo(0.00001, 12); // 0.0010% paid by longs
    expect(events[1]?.rate).toBeCloseTo(0.000001, 12);
    expect(events[4]?.rate).toBeCloseTo(-0.000001, 12); // shorts paid
  });
});

describe("lighterAdapter", () => {
  test("snapshots fetch rates and details", async () => {
    const rates = await fixture<LighterFundingRates>("funding-rates.json");
    const details = await fixture<LighterOrderBookDetails>("order-book-details.json");
    const { client, urls } = fakeClient((url) => (url.includes("funding-rates") ? rates : details));
    const batch = await createLighterAdapter().fetchSnapshots(client, NOW);
    expect(urls).toEqual([`${LIGHTER_API}/funding-rates`, `${LIGHTER_API}/orderBookDetails`]);
    expect(batch.snapshots).toHaveLength(2);
    expect(batch.snapshots.map((s) => s.quote)).toEqual(["USDC", "USDC"]);
  });

  test("history resolves the market id and paginates in seconds", async () => {
    const details = await fixture<LighterOrderBookDetails>("order-book-details.json");
    const from = 1_789_000_000_000;
    const fromSec = from / 1000;
    const fullPage = {
      fundings: Array.from({ length: 750 }, (_, i) => ({
        timestamp: fromSec + i * 3600,
        rate: "0.0010",
        direction: "long",
      })),
    };
    const lastPage = {
      fundings: [{ timestamp: fromSec + 750 * 3600, rate: "0.0002", direction: "short" }],
    };
    const { client, urls } = fakeClient((url) => {
      if (url.endsWith("/orderBookDetails")) return details;
      return url.includes(`start_timestamp=${fromSec}&`) ? fullPage : lastPage;
    });

    const events = await createLighterAdapter().fetchFundingHistory?.(
      client,
      "BTC",
      from,
      from + 800 * 3_600_000,
    );

    expect(urls).toEqual([
      `${LIGHTER_API}/orderBookDetails`,
      `${LIGHTER_API}/fundings?market_id=1&resolution=1h&start_timestamp=${fromSec}&end_timestamp=${fromSec + 800 * 3600}&count_back=0`,
      `${LIGHTER_API}/fundings?market_id=1&resolution=1h&start_timestamp=${fromSec + 749 * 3600 + 1}&end_timestamp=${fromSec + 800 * 3600}&count_back=0`,
    ]);
    expect(events).toHaveLength(751);
    expect(events?.at(-1)?.rate).toBeCloseTo(-0.000002, 12);
  });

  test("history for an unknown symbol returns nothing", async () => {
    const details = await fixture<LighterOrderBookDetails>("order-book-details.json");
    const { client } = fakeClient(() => details);
    expect(await createLighterAdapter().fetchFundingHistory?.(client, "NOPE", 0, 1)).toEqual([]);
  });
});
