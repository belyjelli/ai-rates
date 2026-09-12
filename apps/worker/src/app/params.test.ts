import { describe, expect, test } from "bun:test";
import {
  DEFAULT_BACKTEST_DAYS,
  DEFAULT_BACKTEST_SIZE_USD,
  DEFAULT_FILTERS,
  DEFAULT_HEATMAP_LIMIT,
  filtersToQuery,
  heatmapToQuery,
  MAX_BACKTEST_DAYS,
  MAX_BACKTEST_SIZE_USD,
  MAX_HEATMAP_LIMIT,
  parseBacktestParams,
  parseHeatmapParams,
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
      sort: DEFAULT_FILTERS.sort,
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

describe("parseHeatmapParams", () => {
  const parse = (query: string) => parseHeatmapParams(new URLSearchParams(query));

  test("defaults to the live timeframe and the first page", () => {
    expect(parse("")).toEqual({ tf: "now", limit: DEFAULT_HEATMAP_LIMIT, offset: 0 });
  });

  test("accepts only the four known timeframes", () => {
    expect(parse("tf=60d").tf).toBe("60d");
    expect(parse("tf=30D").tf).toBe("30d");
    // The timeframe chooses which column is read, so anything unrecognised falls back here rather
    // than travelling any further.
    expect(parse("tf=90d").tf).toBe("now");
    expect(parse("tf=apr_60d, x").tf).toBe("now");
  });

  test("clamps the page size and never pages backwards", () => {
    expect(parse("limit=10").limit).toBe(10);
    // The cap equals the default on purpose: fewer rows can be asked for, more cannot.
    expect(parse(`limit=${MAX_HEATMAP_LIMIT + 500}`).limit).toBe(MAX_HEATMAP_LIMIT);
    expect(parse("limit=0").limit).toBe(1);
    expect(parse("limit=nonsense").limit).toBe(DEFAULT_HEATMAP_LIMIT);
    expect(parse("offset=-5").offset).toBe(0);
    expect(parse("offset=300").offset).toBe(300);
  });
});

describe("heatmapToQuery", () => {
  test("omits defaults and round-trips through parseHeatmapParams", () => {
    expect(heatmapToQuery({ tf: "now", limit: DEFAULT_HEATMAP_LIMIT, offset: 0 })).toBe("");

    const query = heatmapToQuery({ tf: "60d", limit: 50, offset: 150 });
    expect(query).toBe("?tf=60d&limit=50&offset=150");
    // Round-tripping is what keeps paging links and the edge cache key in agreement.
    expect(parseHeatmapParams(new URLSearchParams(query))).toEqual({
      tf: "60d",
      limit: 50,
      offset: 150,
    });
  });
});

describe("screener sort", () => {
  const sortOf = (query: string) => parseScreenerFilters(new URLSearchParams(query)).sort;

  test("defaults to spread and accepts only the backed keys", () => {
    expect(sortOf("")).toBe("spread");
    expect(sortOf("sort=settled_7d")).toBe("settled_7d");
    expect(sortOf("sort=VENUES")).toBe("venues");
    // Backed by pair_stability since migration 010; it was refused before that existed.
    expect(sortOf("sort=stability")).toBe("stability");
    // The key picks an ORDER BY fragment, so anything unrecognised falls back rather than
    // travelling further. "oi" is still refused: open interest is returned per leg only, and
    // summing the winning pair's legs would rank by pair-selection artefact rather than depth.
    expect(sortOf("sort=oi")).toBe("spread");
    expect(sortOf("sort=spread_apr; drop table")).toBe("spread");
  });

  test("round-trips through the canonical query, and the default stays invisible", () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
    const filters = parseScreenerFilters(new URLSearchParams("sort=venues"));
    expect(filtersToQuery(filters)).toBe("?sort=venues");
    expect(parseScreenerFilters(new URLSearchParams(filtersToQuery(filters)))).toEqual(filters);
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
