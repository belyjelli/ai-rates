import { describe, expect, test } from "bun:test";
import {
  DEFAULT_BACKTEST_DAYS,
  DEFAULT_BACKTEST_SIZE_USD,
  DEFAULT_FILTERS,
  filtersToQuery,
  MAX_BACKTEST_DAYS,
  MAX_BACKTEST_SIZE_USD,
  parseBacktestParams,
  parseScreenerFilters,
  parseUsd,
} from "./params";

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
      maxAbsApr: DEFAULT_FILTERS.maxAbsApr,
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

  test("only an explicit extremes flag lifts the funding cap", () => {
    for (const query of ["extremes=1", "extremes=on", "extremes=yes"]) {
      expect(parseScreenerFilters(new URLSearchParams(query)).maxAbsApr).toBeNull();
    }
    for (const query of ["", "extremes=0", "extremes=false", "extremes="]) {
      expect(parseScreenerFilters(new URLSearchParams(query)).maxAbsApr).toBe(
        DEFAULT_FILTERS.maxAbsApr,
      );
    }
  });
});

describe("parseBacktestParams", () => {
  const parse = (query: string) => parseBacktestParams(new URLSearchParams(query));

  test("defaults and clamps size and days", () => {
    expect(parse("long=gate&short=okx")).toEqual({
      longVenueId: "gate",
      shortVenueId: "okx",
      sizeUsd: DEFAULT_BACKTEST_SIZE_USD,
      days: DEFAULT_BACKTEST_DAYS,
    });
    expect(parse("long=gate&short=okx&size=1b")?.sizeUsd).toBe(MAX_BACKTEST_SIZE_USD);
    expect(parse("long=gate&short=okx&size=25k")?.sizeUsd).toBe(25_000);
    // History only reaches 90 days, so a longer window would quietly return less.
    expect(parse("long=gate&short=okx&days=999")?.days).toBe(MAX_BACKTEST_DAYS);
    expect(parse("long=gate&short=okx&days=0")?.days).toBe(1);
    expect(parse("long=gate&short=okx&days=zero")?.days).toBe(DEFAULT_BACKTEST_DAYS);
    expect(parse("long=GATE&short=OKX")?.longVenueId).toBe("gate");
  });

  test("insists on two different known exchanges", () => {
    expect(parse("")).toBeNull();
    expect(parse("long=gate")).toBeNull();
    expect(parse("long=gate&short=gate")).toBeNull();
    expect(parse("long=gate&short=nope")).toBeNull();
  });
});

describe("filtersToQuery", () => {
  test("round-trips the extremes flag", () => {
    const filters = parseScreenerFilters(new URLSearchParams("extremes=1"));
    expect(filtersToQuery(filters)).toBe("?extremes=1");
    expect(parseScreenerFilters(new URLSearchParams(filtersToQuery(filters)))).toEqual(filters);
  });

  test("is empty for defaults and stable for equivalent filters", () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
    const a = parseScreenerFilters(new URLSearchParams("types=hip3,cex&min_oi=0"));
    const b = parseScreenerFilters(new URLSearchParams("min_oi=0&types=cex&types=hip3"));
    expect(filtersToQuery(a)).toBe("?min_oi=0&types=cex%2Chip3");
    expect(filtersToQuery(b)).toBe(filtersToQuery(a));
  });
});
