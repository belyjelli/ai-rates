import { describe, expect, test } from "bun:test";
import { aprFromRate } from "@ai-rates/core";
import labelsFixture from "../../__fixtures__/edgex-v2/contract-labels.json";
import historyFixture from "../../__fixtures__/edgex-v2/getFundingRatePage-30000001.json";
import fundingFixture from "../../__fixtures__/edgex-v2/getLatestFundingRate.json";
import metaFixture from "../../__fixtures__/edgex-v2/getMetaData.json";
import tickerFixture from "../../__fixtures__/edgex-v2/getTicker-30000001.json";
import type { HttpClient } from "../http";
import {
  createEdgexV2Adapter,
  EDGEX_V2_API,
  type EdgexContractLabel,
  type EdgexFundingPage,
  type EdgexFundingRate,
  type EdgexMetaData,
  type EdgexResponse,
  type EdgexTicker,
  edgexAssetClass,
  edgexLabelClasses,
  indexEdgexMarkets,
  parseEdgexFundingHistory,
  parseEdgexSnapshots,
} from "./edgex";

const NOW = 1_789_339_200_000; // 2026-09-13T22:40:00Z, minutes after the fixtures were read
const FUNDING_TIME = 1_789_329_600_000; // 20:00Z, the latest settlement
const NEXT_FUNDING = 1_789_344_000_000; // 00:00Z, as the ticker's nextFundingTime says
const meta = metaFixture as EdgexResponse<EdgexMetaData>;
const labels = labelsFixture as EdgexResponse<EdgexContractLabel[]>;
const rates = (fundingFixture as EdgexResponse<EdgexFundingRate[]>).data;
const btcTicker = (tickerFixture as EdgexResponse<EdgexTicker[]>).data[0] as EdgexTicker;
const history = historyFixture as EdgexResponse<EdgexFundingPage>;
const markets = indexEdgexMarkets(meta.data, labels.data);
const LIVE_IDS = "30000001,30000002,30000005,30000010,30000046,30000169";

function fakeClient(respond: (url: string) => unknown): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    venueId: "edgex-v2",
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

function respond(url: string): unknown {
  if (url.endsWith("/meta/getMetaData")) return meta;
  if (url.endsWith("/contract-labels")) return labels;
  if (url.includes("/funding/getLatestFundingRate")) return fundingFixture;
  if (url.endsWith("getTicker?contractId=30000001")) return tickerFixture;
  if (url.includes("/quote/getTicker")) return { code: "SUCCESS", data: [] };
  throw new Error(`unexpected ${url}`);
}

describe("parseEdgexSnapshots", () => {
  const tickers = new Map([["30000001", { ticker: btcTicker, fetchedAt: NOW }]]);
  const { snapshots, settled } = parseEdgexSnapshots(markets, rates, tickers, NOW);

  test("normalizes BTCUSDC: the forecast over 4h, due one interval after the last settlement", () => {
    const mark = Number("76767.044808407373464849");
    expect(snapshots.find((s) => s.venueSymbol === "BTCUSDC")).toEqual({
      venueId: "edgex-v2",
      venueSymbol: "BTCUSDC",
      base: "BTC",
      quote: "USDC",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: -0.00005592,
      basisHours: 4,
      intervalHours: 4,
      nextFundingAt: NEXT_FUNDING,
      kind: "predicted",
      markPrice: mark,
      indexPrice: 76799.6329068953,
      openInterestUsd: 3284.957 * mark,
      volume24hUsd: 210414016.4312,
      maxLeverage: 100,
    });
  });

  test("the published rate is per 4h: ETH at the floor matches Hyperliquid's hourly rate", () => {
    const eth = snapshots.find((s) => s.venueSymbol === "ETHUSDC");
    // 0.00005 over 4h is 0.0000125/h, the 10.95% floor Hyperliquid's ETH read the same minute.
    expect(eth?.rate).toBe(0.00005);
    expect((eth?.rate ?? 0) / (eth?.basisHours ?? 1)).toBeCloseTo(0.0000125, 12);
    expect(aprFromRate(eth?.rate ?? 0, "fraction", eth?.basisHours ?? 1)).toBeCloseTo(10.95, 2);
  });

  test("fundingRate is the settlement at fundingTime, matching the flagged history row", () => {
    const btc = settled.find((e) => e.venueSymbol === "BTCUSDC");
    expect(btc).toMatchObject({ settledAt: FUNDING_TIME, rate: -0.00005067, basisHours: 4 });
    const newest = history.data.dataList[0];
    expect(newest).toMatchObject({ isSettlement: true, fundingRate: "-0.00005067" });
    expect(Number(newest?.fundingTime)).toBe(FUNDING_TIME);
  });

  test("keeps displayed, tradeable contracts; hidden ZRO and EUR are dropped", () => {
    expect(snapshots.map((s) => s.venueSymbol).sort()).toEqual([
      "1000PEPEUSDC",
      "BTCUSDC",
      "ETHUSDC",
      "SPYUSDC",
      "XAUUSDC",
      "哈基米USDC",
    ]);
    expect(settled).toHaveLength(6);
  });

  test("a ticker too old to trust leaves OI and volume empty rather than stale", () => {
    const old = new Map([["30000001", { ticker: btcTicker, fetchedAt: NOW - 46 * 60_000 }]]);
    const btc = parseEdgexSnapshots(markets, rates, old, NOW).snapshots.find(
      (s) => s.venueSymbol === "BTCUSDC",
    );
    expect(btc).toMatchObject({ openInterestUsd: null, volume24hUsd: null });
  });

  test("class, base and quote as declared", () => {
    const rows = snapshots
      .map((s) => [s.venueSymbol, s.base, s.multiplier, s.assetClass, s.quote])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(rows).toEqual([
      ["1000PEPEUSDC", "PEPE", 1000, "crypto", "USDC"],
      ["BTCUSDC", "BTC", 1, "crypto", "USDC"],
      ["ETHUSDC", "ETH", 1, "crypto", "USDC"],
      // isStock: an ETF, which core files as equity.
      ["SPYUSDC", "SPY", 1, "equity", "USDC"],
      // No flag; the Commodities V2 tab is the declaration.
      ["XAUUSDC", "XAU", 1, "commodity", "USDC"],
      // The parser would keep the CJK name; the declared base coin is HAJIMI.
      ["哈基米USDC", "HAJIMI", 1, "crypto", "USDC"],
    ]);
  });
});

describe("edgeX asset class", () => {
  test("only the V2 app's tradfi tabs declare a class", () => {
    const classes = edgexLabelClasses(labels.data);
    expect(Object.fromEntries(classes)).toEqual({
      "30000005": "commodity", // XAUUSDC
      "30000006": "commodity", // XAGUSDC
      "30000010": "equity", // SPYUSDC
      "30000011": "equity", // QQQUSDC
    });
    // The AppTradFi tabs file JPM under Commodities; they are not this app's, and are ignored.
    expect(classes.has("30000128")).toBe(false);
  });

  test("flags win over tabs, and nothing declared is crypto", () => {
    expect(edgexAssetClass({ isFx: true }, undefined)).toBe("fx");
    expect(edgexAssetClass({ isStock: true }, "commodity")).toBe("equity");
    expect(edgexAssetClass({ isStock: false, isFx: false }, "commodity")).toBe("commodity");
    expect(edgexAssetClass({ isStock: false, isFx: false }, undefined)).toBe("crypto");
  });
});

describe("parseEdgexFundingHistory", () => {
  test("settlement rows become oldest-first 4h events with the mark at settlement", () => {
    const btc = markets.contracts.get("30000001");
    if (!btc) throw new Error("fixture changed");
    const events = parseEdgexFundingHistory(history.data.dataList, btc, markets, 0, NOW);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_300_800_000, -0.00005842, 4],
      [1_789_315_200_000, -0.0000522, 4],
      [FUNDING_TIME, -0.00005067, 4],
    ]);
    expect(events[2]).toMatchObject({ base: "BTC", quote: "USDC", assetClass: "crypto" });
    expect(events[2]?.markPrice).toBeGreaterThan(70_000);
  });
});

describe("edgexV2Adapter", () => {
  test("one funding call for every live id; metadata and tickers are cached across cycles", async () => {
    const { client, urls } = fakeClient(respond);
    const adapter = createEdgexV2Adapter();

    const first = await adapter.fetchSnapshots(client, NOW);
    expect(urls).toEqual([
      `${EDGEX_V2_API}/meta/getMetaData`,
      `${EDGEX_V2_API}/contract-labels`,
      `${EDGEX_V2_API}/funding/getLatestFundingRate?contractId=${LIVE_IDS}`,
      ...LIVE_IDS.split(",").map((id) => `${EDGEX_V2_API}/quote/getTicker?contractId=${id}`),
    ]);
    expect(first.snapshots).toHaveLength(6);
    expect(first.snapshots.find((s) => s.venueSymbol === "BTCUSDC")?.volume24hUsd).toBe(
      210414016.4312,
    );

    urls.length = 0;
    const second = await adapter.fetchSnapshots(client, NOW + 60_000);
    expect(urls).toEqual([`${EDGEX_V2_API}/funding/getLatestFundingRate?contractId=${LIVE_IDS}`]);
    // The BTC ticker fetched a minute ago still stands.
    expect(
      second.snapshots.find((s) => s.venueSymbol === "BTCUSDC")?.openInterestUsd,
    ).not.toBeNull();
  });

  test("a failing ticker does not cost the cycle its funding rates", async () => {
    const { client } = fakeClient((url) => {
      if (url.includes("/quote/getTicker")) throw new Error("HTTP 500");
      return respond(url);
    });
    const batch = await createEdgexV2Adapter().fetchSnapshots(client, NOW);
    expect(batch.snapshots).toHaveLength(6);
    expect(batch.snapshots.every((s) => s.openInterestUsd === null)).toBe(true);
  });

  test("history resolves the contract id and pages with offsetData", async () => {
    const page2 = { code: "SUCCESS", data: { dataList: [], nextPageOffsetData: "" } };
    const { client, urls } = fakeClient((url) => {
      if (url.includes("getFundingRatePage")) return url.includes("offsetData=") ? page2 : history;
      return respond(url);
    });
    const from = 1_789_200_000_000;
    const events = await createEdgexV2Adapter().fetchFundingHistory?.(client, "BTCUSDC", from, NOW);
    const offset = encodeURIComponent(history.data.nextPageOffsetData);
    const base = `${EDGEX_V2_API}/funding/getFundingRatePage?contractId=30000001&size=100&filterSettlementFundingRate=true&filterBeginTimeInclusive=${from}&filterEndTimeExclusive=${NOW + 1}`;
    expect(urls.slice(2)).toEqual([base, `${base}&offsetData=${offset}`]);
    expect(events).toHaveLength(3);
  });

  test("history for an unknown contract returns nothing", async () => {
    const { client } = fakeClient(respond);
    expect(await createEdgexV2Adapter().fetchFundingHistory?.(client, "NOPEUSDC", 0, 1)).toEqual(
      [],
    );
  });
});
