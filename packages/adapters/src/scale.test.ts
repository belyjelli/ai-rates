import { describe, expect, test } from "bun:test";
import { perUnitPrice } from "@ai-rates/core";
import { marketRef } from "./parse";

describe("scale overrides", () => {
  test("a listed market is stored at the asset's scale", () => {
    expect(marketRef("hl-mkts", "mkts:US500")).toMatchObject({ base: "US500", multiplier: 0.1 });
    expect(marketRef("okx", "OPENAI-USDT-SWAP")).toMatchObject({ base: "OPENAI", multiplier: 0.1 });
    // The per-unit price the store writes is what joins the market to its pool.
    expect(perUnitPrice(759.89, marketRef("hl-mkts", "mkts:US500").multiplier)).toBeCloseTo(
      7598.9,
      6,
    );
  });

  test("the table is keyed by exact market, never by base or venue", () => {
    expect(marketRef("hl-xyz", "xyz:SP500").multiplier).toBe(1);
    expect(marketRef("okx", "ANTHROPIC-USDT-SWAP").multiplier).toBe(1);
    expect(marketRef("okx", "BTC-USDT-SWAP").multiplier).toBe(1);
  });

  test("a scale applies on top of a multiplier the venue declares", () => {
    expect(marketRef("okx", "OPENAI-USDT-SWAP", { multiplier: 10 }).multiplier).toBeCloseTo(1, 12);
  });
});
