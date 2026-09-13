import { describe, expect, test } from "bun:test";
import btcFeeRate from "../../__fixtures__/hotcoin/fee-rate_btcusdt.json";
import iostFeeRate from "../../__fixtures__/hotcoin/fee-rate_iostusdt.json";
import publicFixture from "../../__fixtures__/hotcoin/perpetual_public.json";
import type { HttpClient } from "../http";
import {
  createHotcoinAdapter,
  HOTCOIN_API,
  type HotcoinFeeRate,
  type HotcoinIntervalEntry,
  type HotcoinTicker,
  hotcoinAssetClass,
  hotcoinIntervalHours,
  hotcoinSettlementTime,
  parseHotcoinFundingHistory,
  parseHotcoinSnapshots,
  tradableHotcoinTickers,
} from "./hotcoin";

/** Real rows from Hotcoin on 2026-09-13 22:12 UTC: BTC, ETH, a small cap, a 1h market, USDC, tradfi, inverse. */
const rows: HotcoinTicker[] = publicFixture.data;
const AT = 1_789_337_577_000;
const HOUR = 3_600_000;
const row = (code: string) => rows.find((r) => r.code === code) as HotcoinTicker;

const eightHourly = (codes: string[], hours = 8): Map<string, HotcoinIntervalEntry> =>
  new Map(codes.map((c) => [c, { hours, fetchedAt: AT }]));
const allCodes = [...tradableHotcoinTickers(rows).keys()];
const intervals = eightHourly(allCodes);
intervals.set("iostusdt", { hours: 1, fetchedAt: AT });
const snapshots = parseHotcoinSnapshots(rows, intervals, AT);
const byCode = new Map(snapshots.map((s) => [s.venueSymbol, s]));

function fakeClient(urls: string[], pages?: (code: string, page: number) => unknown): HttpClient {
  return {
    venueId: "hotcoin",
    async getJson<T>(url: string): Promise<T> {
      urls.push(url);
      if (url === HOTCOIN_API) return publicFixture as T;
      const match = /\/perpetual\/public\/([^/]+)\/fee-rate\?page=(\d+)&pageSize=(\d+)$/.exec(url);
      if (!match) throw new Error(`unexpected ${url}`);
      const code = decodeURIComponent(match[1] as string);
      if (pages) return pages(code, Number(match[2])) as T;
      return (code === "iostusdt" ? iostFeeRate : btcFeeRate) as T;
    },
    postJson: async () => {
      throw new Error("unused");
    },
    circuit: () => ({ open: false, consecutiveFailures: 0, retryAt: null }),
    requestCount: () => urls.length,
  };
}

describe("parseHotcoinSnapshots", () => {
  test("normalizes btcusdt", () => {
    expect(byCode.get("btcusdt")).toEqual({
      venueId: "hotcoin",
      venueSymbol: "btcusdt",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: AT,
      rate: 0.0000645,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_344_000_000,
      kind: "settled",
      markPrice: 76911.7,
      indexPrice: 76918.8,
      // 7,262,189 contracts of 0.001 BTC at the mark: $559M, against Binance's $8.04bn.
      openInterestUsd: 7262189 * 0.001 * 76911.7,
      volume24hUsd: 1537797191,
      maxLeverage: 200,
    });
  });

  test("fund is the settled rate: it is the newest fee-rate row, stamped 16:00:53", () => {
    const newest = btcFeeRate.data.rows[0] as HotcoinFeeRate;
    expect(byCode.get("btcusdt")?.rate).toBe(Number(newest.feeRate));
    expect(hotcoinSettlementTime(newest.createdDate)).toBe(1_789_315_200_000);
    expect(snapshots.every((s) => s.kind === "settled")).toBe(true);
  });

  test("open interest is contracts x unitAmount x mark, in the contract's own price unit", () => {
    // 1000PEPE: 1,371,559 contracts of 1,000 "1000PEPE" at 0.003369 each.
    expect(byCode.get("1000pepeusdt")).toMatchObject({
      base: "PEPE",
      multiplier: 1000,
      openInterestUsd: 1371559 * 1000 * 0.003369,
    });
  });

  test("an open interest of 0 is unreported, not zero: BTCUSDC turned over $126.6M", () => {
    expect(row("btcusdc").totalPosition).toBe("0");
    expect(byCode.get("btcusdc")).toMatchObject({
      quote: "USDC",
      openInterestUsd: null,
      volume24hUsd: 126554683,
    });
  });

  test("a contract whose interval is not known yet is left out", () => {
    const partial = parseHotcoinSnapshots(rows, eightHourly(["btcusdt"]), AT);
    expect(partial.map((s) => s.venueSymbol)).toEqual(["btcusdt"]);
  });

  test("each basis is the contract's own interval", () => {
    expect(byCode.get("iostusdt")).toMatchObject({
      basisHours: 1,
      intervalHours: 1,
      nextFundingAt: 1_789_340_400_000,
    });
  });
});

describe("hotcoin tradability and quote", () => {
  test("linear USDT and USDC contracts only; inverse BTCUSD is dropped", () => {
    const live = tradableHotcoinTickers(rows);
    expect([...live.keys()]).toEqual([
      "btcusdt",
      "ethusdt",
      "sophusdt",
      "iostusdt",
      "1000pepeusdt",
      "btcusdc",
      "nas100usdt",
      "skhynixusdt",
    ]);
    expect(row("btcusd")).toMatchObject({ direction: 1, base: "btc", quote: "usd" });
    expect(snapshots).toHaveLength(8);
  });

  test("testing, non-trading and mismatched-margin rows are dropped", () => {
    const btc = row("btcusdt");
    const variants: HotcoinTicker[] = [
      { ...btc, code: "a", env: 1 },
      { ...btc, code: "b", tradeStatus: 1 },
      { ...btc, code: "c", baseDisplayName: "BTC" },
      { ...btc, code: "d", baseDisplayName: "USDE", quoteDisplayName: "USDE" },
    ];
    expect(tradableHotcoinTickers(variants).size).toBe(0);
  });

  test("every quote is the declared margin coin", () => {
    expect([...new Set(snapshots.map((s) => s.quote))].sort()).toEqual(["USDC", "USDT"]);
  });
});

describe("hotcoinAssetClass", () => {
  test("Hotcoin declares nothing, so NAS100 and SK Hynix are crypto as listed", () => {
    expect(byCode.get("nas100usdt")).toMatchObject({ base: "NAS100", assetClass: "crypto" });
    expect(byCode.get("skhynixusdt")).toMatchObject({ base: "SKHYNIX", assetClass: "crypto" });
    expect(snapshots.every((s) => s.assetClass === "crypto")).toBe(true);
  });

  test("any filled tradfi field is a not-crypto declaration, and the base tables pick the class", () => {
    expect(hotcoinAssetClass({ ...row("nas100usdt"), isPushTradfi: 1 }, "NAS100")).toBe("index");
    expect(hotcoinAssetClass({ ...row("skhynixusdt"), tradfiTagNameEn: "Stocks" }, "SKHYNIX")).toBe(
      "equity",
    );
    expect(hotcoinAssetClass({ ...row("btcusdt"), assetCategory: 3 }, "COPPER")).toBe("commodity");
  });
});

describe("hotcoin intervals", () => {
  test("snaps stamps written minutes after the hour back onto it", () => {
    expect(hotcoinSettlementTime(1_789_228_968_000)).toBe(1_789_228_800_000); // 16:02:48
    expect(hotcoinSettlementTime(1_789_333_337_000)).toBe(1_789_333_200_000); // 21:02:17
    // 20:40:30 is twenty minutes from any hour, so it is kept, to the minute.
    expect(hotcoinSettlementTime(1_789_332_030_000)).toBe(1_789_332_060_000);
  });

  test("reads 8h for BTCUSDT and 1h for IOSTUSDT from their last settlements", () => {
    expect(hotcoinIntervalHours(btcFeeRate.data.rows, null)).toBe(8);
    expect(hotcoinIntervalHours(iostFeeRate.data.rows, null)).toBe(1);
  });

  test("a single settlement is measured against the next one", () => {
    const [newest] = iostFeeRate.data.rows;
    expect(hotcoinIntervalHours([newest as HotcoinFeeRate], 1_789_340_400_000)).toBe(1);
    expect(hotcoinIntervalHours([], 1_789_340_400_000)).toBeNull();
  });
});

describe("parseHotcoinFundingHistory", () => {
  test("oldest first, on the hour, with the 8h basis from the gaps", () => {
    const events = parseHotcoinFundingHistory("btcusdt", btcFeeRate.data.rows, 0, AT, null);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_200_000_000, 0.0001290088921301, 8],
      [1_789_228_800_000, 0.0001087301061988, 8],
      [1_789_257_600_000, 0.00004794, 8],
      [1_789_286_400_000, 0.000110132201253, 8],
      [1_789_315_200_000, 0.0000645, 8],
    ]);
    expect(events[0]).toMatchObject({ venueId: "hotcoin", base: "BTC", markPrice: null });
  });
});

describe("hotcoinAdapter", () => {
  test("one bulk call, then fee-rate samples for contracts without an interval, within budget", async () => {
    const urls: string[] = [];
    const adapter = createHotcoinAdapter({ intervalRefreshBudget: 3 });
    expect(adapter.venueId).toBe("hotcoin");
    const first = await adapter.fetchSnapshots(fakeClient(urls), AT);
    expect(urls).toEqual([
      HOTCOIN_API,
      `${HOTCOIN_API}/btcusdt/fee-rate?page=1&pageSize=4`,
      `${HOTCOIN_API}/ethusdt/fee-rate?page=1&pageSize=4`,
      `${HOTCOIN_API}/sophusdt/fee-rate?page=1&pageSize=4`,
    ]);
    expect(first.snapshots.map((s) => s.venueSymbol)).toEqual(["btcusdt", "ethusdt", "sophusdt"]);
    expect(first.settled).toEqual([]);
  });

  test("covers every contract, and only re-reads the bulk list while intervals are fresh", async () => {
    const urls: string[] = [];
    const adapter = createHotcoinAdapter();
    const client = fakeClient(urls);
    const first = await adapter.fetchSnapshots(client, AT);
    expect(urls).toHaveLength(9);
    expect(first.snapshots).toHaveLength(8);
    expect(first.snapshots.find((s) => s.venueSymbol === "iostusdt")?.basisHours).toBe(1);

    urls.length = 0;
    await adapter.fetchSnapshots(client, AT + 60_000);
    expect(urls).toEqual([HOTCOIN_API]);
  });

  test("warmUp seeds intervals so a restart collects everything from the first cycle", async () => {
    const urls: string[] = [];
    const adapter = createHotcoinAdapter({ intervalRefreshBudget: 0 });
    adapter.warmUp?.(allCodes.map((venueSymbol) => ({ venueSymbol, intervalHours: 8 })));
    const batch = await adapter.fetchSnapshots(fakeClient(urls), AT);
    expect(urls).toEqual([HOTCOIN_API]);
    expect(batch.snapshots).toHaveLength(8);
  });

  test("a non-200 envelope fails the cycle", async () => {
    const adapter = createHotcoinAdapter();
    const client: HttpClient = {
      ...fakeClient([]),
      getJson: async <T>() => ({ code: 500, data: null, msg: "服务器内部错误" }) as T,
    };
    await expect(adapter.fetchSnapshots(client, AT)).rejects.toThrow("hotcoin");
  });

  test("history pages back until a short page, newest first", async () => {
    const urls: string[] = [];
    const newest = 1_789_315_253_000;
    const page = (n: number, count: number) => ({
      code: 200,
      msg: "success",
      data: {
        total: 110,
        rows: Array.from({ length: count }, (_, i) => ({
          contractCode: "btcusdt",
          feeRate: 0.0001,
          createdDate: newest - ((n - 1) * 100 + i) * 8 * HOUR,
        })),
      },
    });
    const client = fakeClient(urls, (_code, n) => (n === 1 ? page(1, 100) : page(2, 10)));
    const events = await createHotcoinAdapter().fetchFundingHistory?.(client, "btcusdt", 0, AT);
    expect(urls).toEqual([
      `${HOTCOIN_API}/btcusdt/fee-rate?page=1&pageSize=100`,
      `${HOTCOIN_API}/btcusdt/fee-rate?page=2&pageSize=100`,
    ]);
    expect(events).toHaveLength(110);
    expect(events?.[0]?.settledAt).toBeLessThan(events?.at(-1)?.settledAt as number);
  });

  test("history stops paging once a page reaches past the window", async () => {
    const urls: string[] = [];
    const client = fakeClient(urls, () => ({
      code: 200,
      msg: "success",
      data: {
        rows: Array.from({ length: 100 }, (_, i) => ({
          feeRate: 0.0001,
          createdDate: 1_789_315_253_000 - i * 8 * HOUR,
        })),
      },
    }));
    const from = 1_789_315_200_000 - 3 * 24 * HOUR;
    const events = await createHotcoinAdapter().fetchFundingHistory?.(client, "btcusdt", from, AT);
    expect(urls).toHaveLength(1);
    expect(events).toHaveLength(10);
  });
});
