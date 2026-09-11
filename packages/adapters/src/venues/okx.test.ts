import { describe, expect, test } from "bun:test";
import type { HttpClient } from "../http";
import { okxAdapter, parseOkxFundingHistory, parseOkxSnapshots } from "./okx";

const fixture = (name: string) =>
  Bun.file(new URL(`../../__fixtures__/okx/${name}.json`, import.meta.url)).json();

const NOW = 1_789_147_120_000;

async function batch() {
  return parseOkxSnapshots(
    await fixture("funding-rate"),
    await fixture("tickers"),
    await fixture("open-interest"),
    await fixture("mark-price"),
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
      dex: null,
      observedAt: NOW,
      rate: 0.0000593556502673,
      basisHours: 8,
      intervalHours: 8,
      nextFundingAt: 1_789_171_200_000,
      kind: "predicted",
      markPrice: 77760.9,
      indexPrice: null,
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
      parseOkxSnapshots({ code: "50011", msg: "rate limited", data: [] }, ok, ok, ok, NOW),
    ).toThrow("50011");
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
  test("fetchSnapshots requests all four SWAP endpoints", async () => {
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
    expect(urls).toHaveLength(4);
    expect(urls.some((u) => u.includes("instId=ANY"))).toBe(true);
  });
});
