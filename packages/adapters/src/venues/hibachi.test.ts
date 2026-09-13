import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import {
  createHibachiAdapter,
  HIBACHI_API,
  type HibachiFundingRow,
  type HibachiInventory,
  hibachiAssetClass,
  parseHibachiFunding,
  parseHibachiInventory,
} from "./hibachi";

const fixture = <T>(name: string): Promise<T> =>
  Bun.file(new URL(`../../__fixtures__/hibachi/${name}`, import.meta.url)).json();

/** Around when the inventory fixture was fetched, 2026-09-13 22:29 UTC. */
const NOW = 1_789_338_544_000;

const inventory = () => fixture<HibachiInventory>("inventory.json");
const fundingRows = async () =>
  (await fixture<{ data: HibachiFundingRow[] }>("funding-rates_BTC.json")).data;

describe("parseHibachiInventory", () => {
  test("normalizes BTC/USDT-P", async () => {
    const btc = parseHibachiInventory(await inventory(), NOW).find(
      (s) => s.venueSymbol === "BTC/USDT-P",
    );
    expect(btc).toEqual({
      venueId: "hibachi",
      venueSymbol: "BTC/USDT-P",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      // A one-hour fraction: 0.000006/h is 5.3% APR, beside Hyperliquid's 0.0000114/h that minute.
      rate: 0.000006,
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: null,
      kind: "predicted",
      markPrice: 76763.73316,
      indexPrice: 76758.93936,
      // Base units: 9.11 BTC is $699k.
      openInterestUsd: 9.1104214497 * 76763.73316,
      volume24hUsd: 7503062.407919,
    });
  });

  test("LIVE contracts only", async () => {
    expect(parseHibachiInventory(await inventory(), NOW).map((s) => s.venueSymbol)).toEqual([
      "BTC/USDT-P",
      "ETH/USDT-P",
      "XAG/USDT-P",
      "EUR/USDT-P",
      "PAXG/USDT-P",
      // FARTCOIN/USDT-P is CLOSED.
    ]);
  });

  test("a market without an estimate or a mark is not emitted", async () => {
    const body = await inventory();
    const [btc, eth] = body.markets;
    if (btc?.info) btc.info.estimatedFundingRate = "";
    if (eth?.info) delete eth.info.markPrice;
    const symbols = parseHibachiInventory(body, NOW).map((s) => s.venueSymbol);
    expect(symbols).not.toContain("BTC/USDT-P");
    expect(symbols).not.toContain("ETH/USDT-P");
  });

  test("class from the declared category, commodity from the tag; quote from settlement", async () => {
    const all = parseHibachiInventory(await inventory(), NOW);
    expect(all.map((s) => [s.venueSymbol, s.base, s.assetClass, s.quote])).toEqual([
      ["BTC/USDT-P", "BTC", "crypto", "USDT"],
      ["ETH/USDT-P", "ETH", "crypto", "USDT"],
      ["XAG/USDT-P", "XAG", "commodity", "USDT"],
      ["EUR/USDT-P", "EUR", "fx", "USDT"],
      ["PAXG/USDT-P", "PAXG", "crypto", "USDT"],
    ]);
    expect(hibachiAssetClass("FX", ["major"], "NZD")).toBe("fx");
    expect(hibachiAssetClass("STOCK", [], "AAPL")).toBe("equity");
    expect(hibachiAssetClass(undefined, undefined, "XAU")).toBe("commodity");
  });
});

describe("parseHibachiFunding", () => {
  test("hourly, oldest first, seconds to ms, window inclusive", async () => {
    const btc = (await inventory()).markets[0];
    if (!btc) throw new Error("fixture");
    const events = parseHibachiFunding(
      await fundingRows(),
      btc.contract,
      [],
      1_789_329_600_000,
      1_789_336_800_000,
    );
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_329_600_000, 0.00001, 1],
      [1_789_333_200_000, 0.000008, 1],
      [1_789_336_800_000, 0.000019, 1],
    ]);
    expect(events[0]).toMatchObject({ base: "BTC", quote: "USDT", markPrice: null });
  });
});

function fakeClient(route: (url: string) => unknown) {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "hibachi",
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

describe("createHibachiAdapter", () => {
  test("one inventory request a cycle", async () => {
    const body = await inventory();
    const { client, urls } = fakeClient(() => body);
    const adapter = createHibachiAdapter();
    const batch = await adapter.fetchSnapshots(client, NOW);
    await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toEqual([`${HIBACHI_API}/market/inventory`, `${HIBACHI_API}/market/inventory`]);
    expect(batch.snapshots).toHaveLength(5);
    expect(batch.settled).toEqual([]);
  });

  test("history pages by offset 100 at a time within the window", async () => {
    const T0 = 1_789_000_000_000;
    const { client, urls } = fakeClient((url) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      const count = offset === 0 ? 100 : 3;
      return {
        data: Array.from({ length: count }, (_, i) => ({
          fundingTimestamp: T0 / 1000 + (offset + i) * 3600,
          fundingRate: "0.00001",
          indexPrice: "77000",
        })),
      };
    });
    const adapter = createHibachiAdapter();
    const toMs = T0 + 200 * 3_600_000;
    const events = (await adapter.fetchFundingHistory?.(client, "BTC/USDT-P", T0, toMs)) ?? [];
    expect(urls).toEqual([
      `${HIBACHI_API}/market/data/funding-rates?symbol=BTC%2FUSDT-P&startTime=${T0 / 1000}&endTime=${toMs / 1000}&limit=100&offset=0`,
      `${HIBACHI_API}/market/data/funding-rates?symbol=BTC%2FUSDT-P&startTime=${T0 / 1000}&endTime=${toMs / 1000}&limit=100&offset=100`,
    ]);
    expect(events).toHaveLength(103);
    expect(events[0]).toMatchObject({ base: "BTC", quote: "USDT", assetClass: "crypto" });
  });
});
