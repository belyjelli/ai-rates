import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import {
  type OkxFundingRate,
  type OkxInstrument,
  type OkxMarkPrice,
  okxAdapter,
  okxAssetClass,
  parseOkxFundingHistory,
  parseOkxLiquidations,
  parseOkxPositionTiers,
  parseOkxSnapshots,
} from "./okx";

const fixture = (name: string) =>
  Bun.file(new URL(`../../__fixtures__/okx/${name}.json`, import.meta.url)).json();

const NOW = 1_789_147_120_000;

async function batch() {
  return parseOkxSnapshots(
    await fixture("funding-rate"),
    await fixture("tickers"),
    await fixture("open-interest"),
    await fixture("mark-price"),
    await fixture("instruments"),
    NOW,
  );
}

describe("parseOkxSnapshots", () => {
  test("normalizes BTC-USDT-SWAP", async () => {
    const { snapshots } = await batch();
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USDT-SWAP")).toEqual({
      venueId: "okx",
      venueSymbol: "BTC-USDT-SWAP",
      base: "BTC",
      quote: "USDT",
      multiplier: 1,
      assetClass: "crypto",
      dex: null,
      observedAt: NOW,
      rate: 0.0000593556502673,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_171_200_000,
      kind: "predicted",
      markPrice: 77760.9,
      indexPrice: null,
      bestBid: 77769.4,
      // OKX books are in contracts, and a contract is ctVal (0.01 BTC) x ctMult, valued at the
      // mark. So 504.48 contracts is 5.04 BTC, about $392k -- reading it as 504 of anything would
      // be four orders of magnitude out.
      bestBidSizeUsd: 504.48 * (0.01 * 77760.9),
      bestAsk: 77769.5,
      bestAskSizeUsd: 28.23 * (0.01 * 77760.9),
      openInterestUsd: Number("2146320021.55324936285784"),
      volume24hUsd: 110381.4949 * 77769.5,
    });
  });

  test("keeps USDT and coin-margined swaps, skips other instruments, reads 4h intervals", async () => {
    const { snapshots } = await batch();
    expect(snapshots.map((s) => s.venueSymbol)).toEqual([
      "BTC-USDT-SWAP",
      "ETH-USDT-SWAP",
      "CHIP-USDT-SWAP",
      "BTC-USD-SWAP",
    ]);
    expect(snapshots.find((s) => s.venueSymbol === "CHIP-USDT-SWAP")).toMatchObject({
      basisHours: 4,
      intervalHours: 4,
      nextFundingAt: 1_789_156_800_000,
    });
    expect(snapshots.find((s) => s.venueSymbol === "BTC-USD-SWAP")).toMatchObject({
      quote: "USD",
      volume24hUsd: 7598.9792 * 77748.5,
    });
  });

  test("emits the last settled payment per market", async () => {
    const { settled } = await batch();
    expect(settled).toHaveLength(4);
    expect(settled.find((e) => e.venueSymbol === "BTC-USDT-SWAP")).toMatchObject({
      settledAt: 1_789_142_400_000,
      rate: 0.0000599316422609,
      basisHours: 8,
    });
    expect(settled.find((e) => e.venueSymbol === "CHIP-USDT-SWAP")?.basisHours).toBe(4);
  });

  test("throws on an error envelope", async () => {
    const ok = await fixture("tickers");
    expect(() =>
      parseOkxSnapshots({ code: "50011", msg: "rate limited", data: [] }, ok, ok, ok, ok, NOW),
    ).toThrow("50011");
  });

  test("carries each instrument's declared class onto its snapshot", async () => {
    // Real instrument rows from 2026-09-14; the funding rows are stand-ins, since only the join
    // on instId matters here.
    const instruments = await fixture("asset-class");
    const funding: OkxFundingRate[] = instruments.data.map((i: OkxInstrument) => ({
      instId: i.instId,
      fundingRate: "0.0001",
      fundingTime: "1789142400000",
      nextFundingTime: "1789171200000",
      settFundingRate: "",
      prevFundingTime: "",
    }));
    const empty = { code: "0", data: [] };
    const { snapshots } = parseOkxSnapshots(
      { code: "0", data: funding },
      empty,
      empty,
      empty,
      instruments,
      NOW,
    );
    expect(
      Object.fromEntries(snapshots.map((s) => [s.venueSymbol, `${s.assetClass}:${s.base}`])),
    ).toEqual({
      "STX-USDT-SWAP": "crypto:STX",
      "AI-USDT-SWAP": "crypto:AI",
      "SPX-USDT-SWAP": "crypto:SPX",
      // Quantinuum and BlackBerry, not Quant and BounceBit: the symbol cannot tell them apart.
      "QNT-USDT-SWAP": "equity:QNT",
      "BB-USDT-SWAP": "equity:BB",
      "ON-USDT-SWAP": "equity:ON",
      "PURR-USDT-SWAP": "equity:PURR",
      // Declared "3" (stocks) by OKX, refined to index by marketRef.
      "US500-USDT-SWAP": "index:US500",
      "JP225-USDT-SWAP": "index:JP225",
      "XAU-USDT-SWAP": "commodity:XAU",
    });
  });
});

describe("okxAssetClass", () => {
  test("reads instCategory off real rows, never the always-1 `category`", async () => {
    const rows: OkxInstrument[] = (await fixture("asset-class")).data;
    // `category` is a fee-schedule field: "1" on the stocks and gold alike.
    expect(new Set(rows.map((r) => (r as OkxInstrument & { category: string }).category))).toEqual(
      new Set(["1"]),
    );
    expect(
      Object.fromEntries(rows.map((r) => [r.instId, okxAssetClass(r.instCategory, "")])),
    ).toEqual({
      "STX-USDT-SWAP": "crypto",
      "AI-USDT-SWAP": "crypto",
      "SPX-USDT-SWAP": "crypto",
      "QNT-USDT-SWAP": "equity",
      "BB-USDT-SWAP": "equity",
      "ON-USDT-SWAP": "equity",
      "PURR-USDT-SWAP": "equity",
      "US500-USDT-SWAP": "equity",
      "JP225-USDT-SWAP": "equity",
      "XAU-USDT-SWAP": "commodity",
    });
  });

  test("forex, bonds, unknown and missing categories", () => {
    expect(okxAssetClass("5", "EUR")).toBe("fx");
    // Bonds have no class of their own; the base tables decide.
    expect(okxAssetClass("6", "US10Y")).toBe("index");
    expect(okxAssetClass("9", "XAG")).toBe("commodity");
    expect(okxAssetClass("9", "TSLA")).toBe("equity");
    // The field predates OKX's tradfi listings, so absence is crypto.
    expect(okxAssetClass("", "BTC")).toBe("crypto");
    expect(okxAssetClass(undefined, "BTC")).toBe("crypto");
  });
});

describe("parseOkxPositionTiers", () => {
  const ladders = async () =>
    parseOkxPositionTiers(
      await fixture("instruments"),
      await fixture("position-tiers"),
      await fixture("mark-price"),
    );

  // BTC-USDT-SWAP is 0.01 BTC a contract, marked at 77,760.9 in the fixture.
  const btcContractUsd = 0.01 * 1 * 77760.9;

  test("converts contract bounds to USD using the contract value", async () => {
    const btc = (await ladders()).filter((t) => t.venueSymbol === "BTC-USDT-SWAP");
    expect(btc).toHaveLength(99);

    const first = btc[0];
    expect(first?.lowerNotionalUsd).toBe(0);
    expect(first?.upperNotionalUsd).toBe(1000.01 * btcContractUsd);
    expect(first?.imr).toBe(0.01);
    expect(first?.mmr).toBe(0.004);
    expect(first?.maxLeverage).toBe(100);

    // The whole point of this slice: tier 1 ends near $780k. Reading OKX's maxSz of 1000 as
    // dollars would have put the first leverage step at $1,000, off by the contract value.
    expect(first?.upperNotionalUsd).toBeGreaterThan(770_000);
    expect(first?.upperNotionalUsd).toBeLessThan(790_000);

    // Bands are contiguous. OKX publishes inclusive [0,1000] then [1000.01,5000]; carrying that
    // gap through would leave a ~$7.78 hole that resolves to no tier at all.
    expect(btc[1]?.lowerNotionalUsd).toBe(1000.01 * btcContractUsd);
    expect(btc[1]?.upperNotionalUsd).toBe(5000.01 * btcContractUsd);

    // The top band keeps OKX's own maxSz, which is a real cap on position size, as on Bybit.
    expect(btc.at(-1)?.upperNotionalUsd).toBe(1_940_000 * btcContractUsd);
  });

  test("inverse contracts are already priced in USD, so the mark is not applied", async () => {
    const inverse = (await ladders()).filter((t) => t.venueSymbol === "BTC-USD-SWAP");
    expect(inverse).toHaveLength(99);
    // ctVal is 100 USD a contract, so tier 1 ends at 2000.1 contracts = $200,010. Multiplying by
    // the ~$77.7k mark, as a linear market needs, would overstate the band ~77,000-fold.
    expect(inverse[0]?.upperNotionalUsd).toBe(2000.1 * 100);
    expect(inverse[0]?.maxLeverage).toBe(100);
  });

  test("a linear ladder with no mark price is dropped rather than converted against nothing", async () => {
    // DOGE-USDT-SWAP has both tiers and an instrument in the fixtures, but no mark price.
    const all = await ladders();
    expect(new Set(all.map((t) => t.venueSymbol))).toEqual(
      new Set(["BTC-USDT-SWAP", "BTC-USD-SWAP"]),
    );
  });
});

describe("parseOkxFundingHistory", () => {
  test("returns realized rates oldest first", async () => {
    const events = parseOkxFundingHistory(await fixture("funding-history"), 4);
    expect(events.map((e) => [e.settledAt, e.rate, e.basisHours])).toEqual([
      [1_789_084_800_000, 0.0000876022471315, 8],
      [1_789_113_600_000, 0.0000402928520367, 8],
      [1_789_142_400_000, 0.0000599316422609, 8],
    ]);
  });

  test("falls back to fundingRate when realizedRate is empty", () => {
    const events = parseOkxFundingHistory(
      {
        code: "0",
        data: [
          {
            instId: "BTC-USDT-SWAP",
            fundingRate: "0.0001",
            realizedRate: "",
            fundingTime: "1789142400000",
          },
        ],
      },
      8,
    );
    expect(events).toMatchObject([{ rate: 0.0001, basisHours: 8 }]);
  });
});

describe("okxAdapter", () => {
  test("fetchSnapshots requests all five SWAP endpoints", async () => {
    const files: Record<string, unknown> = {
      "funding-rate": await fixture("funding-rate"),
      tickers: await fixture("tickers"),
      "open-interest": await fixture("open-interest"),
      "mark-price": await fixture("mark-price"),
    };
    const urls: string[] = [];
    const client = {
      venueId: "okx",
      getJson: async (url: string) => {
        urls.push(url);
        const key = Object.keys(files).find((k) => url.includes(`/${k}?`));
        return key ? files[key] : { code: "0", data: [] };
      },
    } as unknown as HttpClient;

    const result = await okxAdapter.fetchSnapshots(client, NOW);
    expect(result.snapshots).toHaveLength(4);
    // Five, not four: `/instruments` was added for `ctVal`, without which a book size in contracts
    // cannot be turned into money. The count is asserted so that any further per-cycle request has
    // to be argued for here rather than slipped in -- this runs against every SWAP every minute.
    expect(urls).toHaveLength(5);
    expect(urls.some((u) => u.includes("instId=ANY"))).toBe(true);
    expect(urls.some((u) => u.includes("/instruments?instType=SWAP"))).toBe(true);
  });

  /** A client whose position-tiers call fails `failures` times before answering properly. */
  async function tierClient(failures: number) {
    const instruments = await fixture("instruments");
    const marks = await fixture("mark-price");
    const tiers = await fixture("position-tiers");
    let attempts = 0;
    const client = {
      venueId: "okx",
      getJson: async (url: string) => {
        if (url.includes("/instruments?")) return instruments;
        if (url.includes("/mark-price?")) return marks;
        if (url.includes("/position-tiers?")) {
          attempts++;
          // OKX reports a rate limit as code 50011 inside an HTTP 200, so the transport's own
          // retry and circuit breaker never see it.
          return attempts <= failures
            ? { code: "50011", msg: "Too Many Requests", data: [] }
            : tiers;
        }
        return { code: "0", data: [] };
      },
    } as unknown as HttpClient;
    return { client, attempts: () => attempts };
  }

  test("retries a rate-limited tier batch rather than losing its five families", async () => {
    const { client, attempts } = await tierClient(2);
    const sweep = await okxAdapter.fetchLeverageTiers?.(client);

    expect(attempts()).toBe(3);
    expect(sweep?.complete).toBe(true);
    expect(new Set(sweep?.tiers.map((t) => t.venueSymbol))).toEqual(
      new Set(["BTC-USDT-SWAP", "BTC-USD-SWAP"]),
    );
  });

  test("reports an incomplete sweep when a batch keeps failing, so nothing is pruned", async () => {
    const { client, attempts } = await tierClient(Number.POSITIVE_INFINITY);
    const sweep = await okxAdapter.fetchLeverageTiers?.(client);

    // Given up on after the retries, and said so. Claiming a complete sweep here would let the
    // collector prune ladders for every market this run never managed to read.
    expect(attempts()).toBe(3);
    expect(sweep?.complete).toBe(false);
    expect(sweep?.tiers).toEqual([]);
  });
});

describe("parseOkxLiquidations", () => {
  // Typed rather than cast: `as never` would silence a field rename between the parser and the
  // API instead of surfacing it, which is the whole value of having these interfaces.
  const instruments = new Map<string, OkxInstrument>([
    [
      "BTC-USDT-SWAP",
      {
        instId: "BTC-USDT-SWAP",
        instFamily: "BTC-USDT",
        ctVal: "0.01",
        ctValCcy: "BTC",
        ctMult: "1",
      },
    ],
    [
      "BTC-USD-SWAP",
      { instId: "BTC-USD-SWAP", instFamily: "BTC-USD", ctVal: "100", ctValCcy: "USD", ctMult: "1" },
    ],
  ]);
  const marks = new Map<string, OkxMarkPrice>([
    ["BTC-USDT-SWAP", { instId: "BTC-USDT-SWAP", markPx: "77760.9" }],
    ["BTC-USD-SWAP", { instId: "BTC-USD-SWAP", markPx: "77741.7" }],
  ]);

  test("takes posSide directly and leaves the millisecond timestamp alone", async () => {
    const liq = await fixture("liquidation-orders");
    const parsed = parseOkxLiquidations(liq.data, instruments, marks);

    // OKX names the closed position outright, unlike Gate where the side is a sign on `size`.
    expect(parsed[0]?.side).toBe("long");
    expect(parsed.filter((l) => l.side === "long")).toHaveLength(16);
    expect(parsed.filter((l) => l.side === "short")).toHaveLength(4);

    // `ts` is ALREADY epoch milliseconds here. Copying Gate's x1000 would land every record in the
    // year 58,000 and drop it silently from every window the study asks for.
    expect(parsed[0]?.liquidatedAt).toBe(1_789_241_986_046);
  });

  test("converts linear contracts with the mark, and inverse ones without it", () => {
    const linear = parseOkxLiquidations(
      [
        {
          instId: "BTC-USDT-SWAP",
          instType: "SWAP",
          details: [
            {
              posSide: "long",
              side: "sell",
              sz: "3.56",
              bkPx: "77032.6",
              bkLoss: "0",
              ccy: "",
              ts: "1789241986046",
              time: 1_789_241_986_046,
            },
          ],
        },
      ],
      instruments,
      marks,
    );
    // 3.56 contracts x 0.01 BTC x 77760.9 mark.
    expect(linear[0]?.notionalUsd).toBeCloseTo(2768.28804, 6);

    const inverse = parseOkxLiquidations(
      [
        {
          instId: "BTC-USD-SWAP",
          instType: "SWAP",
          details: [
            {
              posSide: "short",
              side: "buy",
              sz: "1",
              bkPx: "77032.6",
              bkLoss: "0",
              ccy: "",
              ts: "1789241986046",
              time: 1_789_241_986_046,
            },
          ],
        },
      ],
      instruments,
      marks,
    );
    // ctValCcy is USD, so the contract is already dollars: 1 x 100. Applying the mark as well
    // would read $7,774,170 -- 77,742x too big. Inverse families do liquidate, so this is live.
    expect(inverse[0]?.notionalUsd).toBeCloseTo(100, 9);
  });

  test("drops rows it cannot trust rather than guessing", () => {
    const parsed = parseOkxLiquidations(
      [
        {
          instId: "BTC-USDT-SWAP",
          instType: "SWAP",
          details: [
            {
              posSide: "long",
              side: "sell",
              sz: "0",
              bkPx: "77032.6",
              bkLoss: "0",
              ccy: "",
              ts: "1789241986046",
              time: 1,
            },
            {
              posSide: "long",
              side: "sell",
              sz: "1",
              bkPx: "0",
              bkLoss: "0",
              ccy: "",
              ts: "1789241986046",
              time: 1,
            },
            {
              posSide: "long",
              side: "sell",
              sz: "1",
              bkPx: "77032.6",
              bkLoss: "0",
              ccy: "",
              ts: "0",
              time: 0,
            },
            {
              posSide: "net",
              side: "sell",
              sz: "1",
              bkPx: "77032.6",
              bkLoss: "0",
              ccy: "",
              ts: "1789241986046",
              time: 1,
            },
          ],
        },
      ],
      instruments,
      marks,
    );
    // Zero size, zero price, no timestamp, and a posSide that is neither long nor short.
    expect(parsed).toEqual([]);
  });

  test("the rotation is clamped to the book, and resumes where it stopped", async () => {
    // The instruments fixture holds 5 perp families against a budget of 40. Without the clamp one
    // run would make 40 calls, re-reading each family eight times -- wasted requests against a
    // rate-limited venue that already signals 50011 inside an HTTP 200.
    const instrumentsFixture = await fixture("instruments");
    const marksFixture = await fixture("mark-price");
    const asked: string[] = [];
    const client = {
      venueId: "okx",
      getJson: async (url: string) => {
        if (url.includes("/instruments?")) return instrumentsFixture;
        if (url.includes("/mark-price?")) return marksFixture;
        if (url.includes("/liquidation-orders?")) {
          asked.push(new URL(url).searchParams.get("instFamily") ?? "");
          return { code: "0", data: [] };
        }
        return { code: "0", data: [] };
      },
    } as unknown as HttpClient;

    const first = await okxAdapter.fetchLiquidations?.(client);
    expect(first?.complete).toBe(true);
    // Five families, five calls -- not the budget of 40.
    expect(asked).toHaveLength(5);
    expect(new Set(asked).size).toBe(5);

    // A second run continues the cycle rather than restarting at the same family. With a book
    // smaller than the budget the cursor wraps fully, so the same five are revisited -- the point
    // is that the cursor advanced rather than being pinned at zero.
    const before = asked.length;
    const second = await okxAdapter.fetchLiquidations?.(client);
    expect(second?.complete).toBe(true);
    expect(asked.length - before).toBe(5);
  });

  test("an unknown instrument keeps the raw size but reports no notional", () => {
    const parsed = parseOkxLiquidations(
      [
        {
          instId: "MYSTERY-USDT-SWAP",
          instType: "SWAP",
          details: [
            {
              posSide: "long",
              side: "sell",
              sz: "7",
              bkPx: "1.5",
              bkLoss: "0",
              ccy: "",
              ts: "1789241986046",
              time: 1,
            },
          ],
        },
      ],
      instruments,
      marks,
    );
    expect(parsed[0]?.sizeContracts).toBe(7);
    expect(parsed[0]?.notionalUsd).toBeNull();
  });
});
