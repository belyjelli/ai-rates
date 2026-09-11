import { describe, expect, test } from "bun:test";
import { DEFAULT_FILTERS, filtersToQuery, parseScreenerFilters, parseUsd } from "./params";

describe("parseUsd", () => {
  test("accepts plain numbers and k/m/b suffixes", () => {
    expect(parseUsd("250000")).toBe(250_000);
    expect(parseUsd("250k")).toBe(250_000);
    expect(parseUsd("1.5M")).toBe(1_500_000);
    expect(parseUsd("2b")).toBe(2_000_000_000);
    expect(parseUsd("0")).toBe(0);
  });

  test("rejects missing and malformed values", () => {
    for (const value of [null, "", "-5", "abc", "1e6", "10x"]) expect(parseUsd(value)).toBeNull();
  });
});

describe("parseScreenerFilters", () => {
  test("uses defaults for an empty query", () => {
    expect(parseScreenerFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  test("parses filters, drops unknown venues and types, and clamps the limit", () => {
    const filters = parseScreenerFilters(
      new URLSearchParams(
        "min_oi=1m&min_vol=100k&venues=okx,BYBIT,nope&types=hip3&types=cex,moon&limit=9999",
      ),
    );
    expect(filters).toEqual({
      minOpenInterestUsd: 1_000_000,
      minVolume24hUsd: 100_000,
      venueIds: ["bybit", "okx"],
      venueTypes: ["cex", "hip3"],
      limit: 500,
    });
  });

  test("selecting every venue type means no type filter", () => {
    expect(
      parseScreenerFilters(new URLSearchParams("types=cex&types=dex&types=hip3")).venueTypes,
    ).toBeNull();
  });

  test("falls back to defaults for malformed numbers", () => {
    const filters = parseScreenerFilters(new URLSearchParams("min_oi=lots&limit=zero"));
    expect(filters.minOpenInterestUsd).toBe(DEFAULT_FILTERS.minOpenInterestUsd);
    expect(filters.limit).toBe(DEFAULT_FILTERS.limit);
  });
});

describe("filtersToQuery", () => {
  test("is empty for defaults and stable for equivalent filters", () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
    const a = parseScreenerFilters(new URLSearchParams("types=hip3,cex&min_oi=0"));
    const b = parseScreenerFilters(new URLSearchParams("min_oi=0&types=cex&types=hip3"));
    expect(filtersToQuery(a)).toBe("?min_oi=0&types=cex%2Chip3");
    expect(filtersToQuery(b)).toBe(filtersToQuery(a));
  });
});
