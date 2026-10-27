import { describe, expect, test } from "bun:test";
import type { BookQualityRow, ExchangeReserveRow, ExchangeSummary } from "../app/data";
import { BOOK_BASKET, gradeOf, scoreOf, venueQualities } from "./exchange-grade";

const at = new Date("2026-10-17T00:00:00Z");
const book = (
  venue_id: string,
  base: string,
  slip10: number,
  slip100: number,
  near: number,
): BookQualityRow => ({
  venue_id,
  base,
  samples: 100,
  first_at: at,
  last_at: at,
  spread_bps: 0.2,
  slip_10k_bps: slip10,
  slip_100k_bps: slip100,
  unfilled_100k: 0,
  depth_usd: near * 5,
  depth_near_usd: near,
  open_interest_usd: 5e9,
  reach_pct: 0.5,
});
const summary = (id: string, type: string, oi: number, volume: number): ExchangeSummary => ({
  id,
  name: id,
  type,
  markets: 100,
  open_interest_usd: oi,
  volume_24h_usd: volume,
  updated_at: at,
});
const reserve = (
  venue_id: string,
  kind: "wallets" | "collateral",
  total: number,
  clean = total,
): ExchangeReserveRow => ({
  venue_id,
  day: at,
  kind,
  source: venue_id,
  total_usd: total,
  clean_usd: clean,
});

// Two CEXes and two DEXes from the catalog, each with the whole basket at the same book.
const ids = { binance: "cex", okx: "cex", hyperliquid: "dex", lighter: "dex" } as const;
const data = {
  rows: Object.keys(ids).flatMap((id) => BOOK_BASKET.map((b) => book(id, b, 0.3, 1, 2e6))),
  weights: Object.fromEntries(BOOK_BASKET.map((b) => [b, 1e9])),
};
const summaries = Object.entries(ids).map(([id, type]) => summary(id, type, 5e9, 10e9));

describe("the grade", () => {
  test("a pillar not measured hands its weight to the others", () => {
    expect(scoreOf({ reserves: null, execution: 80, activity: 60, liquidity: 60 })).toBeCloseTo(
      (30 * 80 + 20 * 60 + 20 * 60) / 70,
    );
    expect(scoreOf({ reserves: 0, execution: 80, activity: 60, liquidity: 60 })).toBeCloseTo(
      (30 * 80 + 20 * 60 + 20 * 60) / 100,
    );
  });

  test("S needs execution measured", () => {
    expect(gradeOf(90)).toBe("S");
    expect(gradeOf(90, false)).toBe("A");
    expect(gradeOf(40)).toBe("C");
    expect(gradeOf(39.9)).toBe("D");
  });

  test("the largest balance sheet scores highest; a tenth of it about 30 points less on magnitude", () => {
    const q = venueQualities(data, summaries, [
      reserve("binance", "wallets", 100e9),
      reserve("okx", "wallets", 10e9),
      reserve("hyperliquid", "collateral", 5e9),
      reserve("lighter", "collateral", 0.5e9),
    ]);
    const r = (id: string) => q.find((v) => v.id === id)?.pillars.reserves ?? Number.NaN;
    // Identical books and activity: only reserves separate them, magnitude two thirds of the pillar.
    expect(r("binance") - r("okx")).toBeCloseTo((2 / 3) * 30, 0);
    expect(q[0]?.id).toBe("binance");
    expect(q.find((v) => v.id === "binance")?.rank).toBe(1);
    expect(q.find((v) => v.id === "hyperliquid")?.rank).toBe(1);
    expect(q.find((v) => v.id === "hyperliquid")?.of).toBe(2);
  });

  test("a CEX with no wallets scores 0; a DEX with no collateral the measured DEXes' median", () => {
    const q = venueQualities(data, summaries, [
      reserve("binance", "wallets", 100e9),
      reserve("hyperliquid", "collateral", 5e9),
    ]);
    const get = (id: string) => q.find((v) => v.id === id);
    expect(get("okx")?.pillars.reserves).toBe(0);
    expect(get("lighter")?.pillars.reserves).toBeCloseTo(get("hyperliquid")?.pillars.reserves ?? 0);
    // And the CEX's liquidity is halved.
    expect(get("okx")?.pillars.liquidity).toBeCloseTo((get("binance")?.pillars.liquidity ?? 0) / 2);
  });

  test("without the reserves read, nobody has the pillar and nobody is marked down for it", () => {
    const q = venueQualities(data, summaries, null);
    for (const v of q) expect(v.pillars.reserves).toBeNull();
    for (const v of q) {
      const { execution, activity, liquidity } = v.pillars;
      expect(v.score).toBeCloseTo(
        (30 * (execution ?? 0) + 20 * (activity ?? 0) + 20 * (liquidity ?? 0)) / 70,
      );
    }
  });

  test("a venue publishing no open interest is scored on volume alone, capped by its reserves", () => {
    // okx's markets report no open interest: the summary sums them to 0.
    const noOi = summaries.map((s) => (s.id === "okx" ? { ...s, open_interest_usd: 0 } : s));
    const rows = [reserve("binance", "wallets", 100e9), reserve("okx", "wallets", 2e9)];
    const q = venueQualities(data, noOi, rows);
    const okx = q.find((v) => v.id === "okx");
    const binance = q.find((v) => v.id === "binance");
    // Not zeroed through the 5x-OI cap: $10B of volume credited up to 3x its $2B, so $6B.
    expect(okx?.volumeCreditedUsd).toBeCloseTo(6e9);
    // Volume alone against the leader's $10B credited: 100 - 30 * log10(10 / 6).
    expect(okx?.pillars.activity).toBeCloseTo(100 - 30 * Math.log10(10 / 6), 1);
    expect(binance?.pillars.activity).toBeCloseTo(100);
  });

  test("a book bigger than the balance sheet behind it loses on backing and its depth credit", () => {
    const small = [reserve("binance", "wallets", 100e9), reserve("okx", "wallets", 0.05e9)];
    const q = venueQualities(data, summaries, small);
    const okx = q.find((v) => v.id === "okx");
    // 5% of $50M is $2.5M of the basket's $24M near depth.
    expect(okx?.depthCreditedUsd).toBeCloseTo(2.5e6);
    // Open interest credited up to three times clean reserves.
    expect(okx?.oiCreditedUsd).toBeCloseTo(0.15e9);
  });

  test("a quarantined venue's book is not graded, and does not become the best to mark others against", () => {
    // WEEX (quarantined in the catalog) with a book far cheaper and deeper than anyone's.
    const weex = BOOK_BASKET.map((b) => book("weex", b, 0.01, 0.01, 2e9));
    const q = venueQualities(
      { ...data, rows: [...data.rows, ...weex] },
      [...summaries, summary("weex", "cex", 5e9, 10e9)],
      null,
    );
    expect(q.find((v) => v.id === "weex")).toBeUndefined();
    expect(q.map((v) => v.score)).toEqual(
      venueQualities(data, summaries, null).map((v) => v.score),
    );
  });
});
