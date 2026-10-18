import { describe, expect, test } from "bun:test";
import { DEFAULT_VENUE_IDS, VENUES } from "@ai-rates/venues";
import { rankedVenues } from "./data";
import {
  arbitrageToQuery,
  type BacktestParams,
  backtestToQuery,
  DEFAULT_ARBITRAGE_LIMIT,
  DEFAULT_BACKTEST_DAYS,
  DEFAULT_BACKTEST_SIZE_USD,
  DEFAULT_FILTERS,
  DEFAULT_HEATMAP_LIMIT,
  DEFAULT_LIQUIDATION_ASSETS,
  DEFAULT_MIN_GAP_BPS,
  filtersToQuery,
  heatmapToQuery,
  liquidationsToQuery,
  MAX_ARBITRAGE_LIMIT,
  MAX_BACKTEST_DAYS,
  MAX_BACKTEST_SIZE_USD,
  MAX_HEATMAP_LIMIT,
  MAX_LIQUIDATION_ASSETS,
  MAX_TAKER_FEE_BPS,
  parseArbitrageParams,
  parseBacktestParams,
  parseHeatmapParams,
  parseLiquidationParams,
  parseScreenerFilters,
  parseUsd,
} from "./params";

describe("parseArbitrageParams", () => {
  test("uses defaults for an empty query", () => {
    expect(parseArbitrageParams(new URLSearchParams())).toEqual({
      minGapBps: DEFAULT_MIN_GAP_BPS,
      maxGapBps: null,
      minDepthUsd: 0,
      venueIds: null,
      assetClass: null,
      minOpenInterestUsd: 0,
      minVolume24hUsd: 0,
      intervalHours: null,
      limit: DEFAULT_ARBITRAGE_LIMIT,
      offset: 0,
    });
  });

  test("the bar's filters parse, a gap band sets both ends, and the query round-trips", () => {
    const p = parseArbitrageParams(
      new URLSearchParams(
        "gap=10-50&min_bps=3&class=tradfi&min_oi=1m&min_vol=100k&interval=4h&venues=okx,bybit",
      ),
    );
    expect(p).toMatchObject({
      minGapBps: 10,
      maxGapBps: 50,
      assetClass: "tradfi",
      minOpenInterestUsd: 1_000_000,
      minVolume24hUsd: 100_000,
      intervalHours: 4,
      venueIds: ["bybit", "okx"],
    });
    expect(arbitrageToQuery(p)).toBe(
      "?gap=10-50&class=tradfi&min_oi=1000000&min_vol=100000&interval=4h&venues=bybit%2Cokx",
    );
    expect(parseArbitrageParams(new URLSearchParams("gap=200-"))).toMatchObject({
      minGapBps: 200,
      maxGapBps: null,
    });
    // A bare floor still works without a band, as links from before the bar do.
    expect(parseArbitrageParams(new URLSearchParams("min_bps=25"))).toMatchObject({
      minGapBps: 25,
      maxGapBps: null,
    });
  });

  test("clamps the limit and keeps an explicit zero floor", () => {
    expect(parseArbitrageParams(new URLSearchParams("limit=9999")).limit).toBe(MAX_ARBITRAGE_LIMIT);
    expect(parseArbitrageParams(new URLSearchParams("limit=0")).limit).toBe(1);
    // Zero is a real choice -- "show me every quote, including the mostly-zero ones" -- and must
    // survive rather than falling back to the default floor.
    expect(parseArbitrageParams(new URLSearchParams("min_bps=0")).minGapBps).toBe(0);
    expect(parseArbitrageParams(new URLSearchParams("min_bps=-5")).minGapBps).toBe(0);
  });

  test("reads depth with the shared k/m/b suffixes and rejects a negative offset", () => {
    expect(parseArbitrageParams(new URLSearchParams("min_depth=25k")).minDepthUsd).toBe(25_000);
    expect(parseArbitrageParams(new URLSearchParams("min_depth=oops")).minDepthUsd).toBe(0);
    expect(parseArbitrageParams(new URLSearchParams("offset=-3")).offset).toBe(0);
  });

  test("round-trips through its canonical query", () => {
    const params = parseArbitrageParams(new URLSearchParams("min_bps=25&min_depth=50k&offset=100"));
    expect(arbitrageToQuery(params)).toBe("?min_bps=25&min_depth=50000&offset=100");
    expect(parseArbitrageParams(new URLSearchParams(arbitrageToQuery(params)))).toEqual(params);
    expect(arbitrageToQuery(parseArbitrageParams(new URLSearchParams()))).toBe("");
  });
});

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
      sameQuote: false,
      assetClass: null,
      minSpreadApr: null,
      maxSpreadApr: null,
      intervalHours: null,
      query: null,
      unit: "apr",
      sort: DEFAULT_FILTERS.sort,
      limit: 500,
    });
  });

  test("the bar's filters parse, reject what they do not know, and survive the round trip", () => {
    const filters = parseScreenerFilters(
      new URLSearchParams(
        "class=TradFi&spread=10-50&interval=8H&q=xyz:SPY&unit=1h&sort=settled_60d",
      ),
    );
    expect(filters).toMatchObject({
      assetClass: "tradfi",
      minSpreadApr: 10,
      maxSpreadApr: 50,
      intervalHours: 8,
      query: "xyz:SPY",
      unit: "1h",
      sort: "settled_60d",
    });
    expect(filtersToQuery(filters)).toBe(
      "?class=tradfi&spread=10-50&interval=8h&q=xyz%3ASPY&unit=1h&sort=settled_60d",
    );
    expect(parseScreenerFilters(new URLSearchParams("spread=200-"))).toMatchObject({
      minSpreadApr: 200,
      maxSpreadApr: null,
    });
    // Unknown values are the default, never an error and never passed on.
    expect(
      parseScreenerFilters(
        new URLSearchParams("class=bonds&spread=5-6&interval=2h&q=a%20b&q2=x&unit=week"),
      ),
    ).toMatchObject({
      assetClass: null,
      minSpreadApr: null,
      maxSpreadApr: null,
      intervalHours: null,
      query: null,
      unit: "apr",
    });
  });

  test("the picker as it opens is no exchange filter; ticking a quarantined one is", () => {
    const listed = VENUES.filter((v) => !v.retired && !v.aliasOf).map((v) => v.id);
    const quarantined = VENUES.filter((v) => v.quarantined).map((v) => v.id);
    const defaults = listed.filter((id) => !quarantined.includes(id));
    expect(quarantined.length).toBeGreaterThan(0);
    expect(DEFAULT_VENUE_IDS).toEqual(defaults);
    expect(
      parseScreenerFilters(new URLSearchParams({ venues: defaults.join(",") })).venueIds,
    ).toBeNull();
    // Every exchange, quarantined too, stays an explicit list: null would rank the default set.
    expect(
      parseScreenerFilters(new URLSearchParams({ venues: listed.join(",") })).venueIds,
    ).toHaveLength(listed.length);
    expect(
      parseArbitrageParams(new URLSearchParams({ venues: listed.join(",") })).venueIds,
    ).toHaveLength(listed.length);
    expect(
      parseScreenerFilters(new URLSearchParams({ venues: defaults.slice(1).join(",") })).venueIds,
    ).toHaveLength(defaults.length - 1);
  });

  test("a ranking with no exchange named reads the default set, never a quarantined one", () => {
    const quarantined = VENUES.filter((v) => v.quarantined).map((v) => v.id);
    const ranked = rankedVenues(null).split(",");
    expect(ranked).toEqual([...DEFAULT_VENUE_IDS]);
    for (const id of quarantined) expect(ranked).not.toContain(id);
    expect(rankedVenues(["okx", "toobit"])).toBe("okx,toobit");
  });

  test("quote=same pairs within one settlement currency, and survives the round trip", () => {
    const filters = parseScreenerFilters(new URLSearchParams("quote=SAME"));
    expect(filters.sameQuote).toBe(true);
    expect(filtersToQuery(filters)).toBe("?quote=same");
    // Anything else is the default, which pairs across quotes and marks them.
    expect(parseScreenerFilters(new URLSearchParams("quote=usdt")).sameQuote).toBe(false);
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

describe("backtestToQuery", () => {
  test("round-trips through parseBacktestParams and omits defaults", () => {
    const parsed = parseBacktestParams(
      new URLSearchParams("long=gate&short=okx&size=25k&days=14&fee_long=4.5&fee_short=5"),
    );
    const query = backtestToQuery(parsed as BacktestParams);
    expect(query).toBe("?long=gate&short=okx&size=25000&days=14&fee_long=4.5&fee_short=5");
    expect(parseBacktestParams(new URLSearchParams(query))).toEqual(parsed);
  });

  test("defaults stay invisible, so the canonical URL is one cache key", () => {
    const parsed = parseBacktestParams(new URLSearchParams("long=gate&short=okx"));
    expect(backtestToQuery(parsed as BacktestParams)).toBe("?long=gate&short=okx");
  });

  test("an explicit zero fee survives, because it is a claim the reader made", () => {
    const parsed = parseBacktestParams(
      new URLSearchParams("long=gate&short=okx&fee_long=0&fee_short=0"),
    );
    expect(backtestToQuery(parsed as BacktestParams)).toContain("fee_long=0");
    expect(backtestToQuery(parsed as BacktestParams)).toContain("fee_short=0");
  });
});

describe("taker fees", () => {
  const parse = (query: string) => parseBacktestParams(new URLSearchParams(query));

  test("are absent unless given, and absent is not zero", () => {
    // Null keeps the engine's "costs unknown" path; zero would assert that trading is free.
    expect(parse("long=gate&short=okx")).toMatchObject({
      longTakerBps: null,
      shortTakerBps: null,
    });
    expect(parse("long=gate&short=okx&fee_long=&fee_short=")).toMatchObject({
      longTakerBps: null,
      shortTakerBps: null,
    });
    // An explicit zero is the reader's claim to make: some venues rebate takers.
    expect(parse("long=gate&short=okx&fee_long=0&fee_short=0")).toMatchObject({
      longTakerBps: 0,
      shortTakerBps: 0,
    });
  });

  test("take fractional bps, clamp absurd ones and refuse nonsense", () => {
    expect(parse("long=gate&short=okx&fee_long=4.5")).toMatchObject({ longTakerBps: 4.5 });
    expect(parse("long=gate&short=okx&fee_long=5000")).toMatchObject({
      longTakerBps: MAX_TAKER_FEE_BPS,
    });
    // Malformed or negative reads as "not supplied" rather than as free.
    expect(parse("long=gate&short=okx&fee_long=-2")).toMatchObject({ longTakerBps: null });
    expect(parse("long=gate&short=okx&fee_long=free")).toMatchObject({ longTakerBps: null });
  });
});

describe("parseBacktestParams", () => {
  const parse = (query: string) => parseBacktestParams(new URLSearchParams(query));

  test("defaults and clamps size and days", () => {
    // toEqual, not toMatchObject: this pins the WHOLE default shape, so a field added later
    // cannot appear unnoticed. Fees default to null rather than 0 -- see the "taker fees" block.
    expect(parse("long=gate&short=okx")).toEqual({
      longVenueId: "gate",
      shortVenueId: "okx",
      sizeUsd: DEFAULT_BACKTEST_SIZE_USD,
      days: DEFAULT_BACKTEST_DAYS,
      longTakerBps: null,
      shortTakerBps: null,
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

    const query = heatmapToQuery({ tf: "60d", limit: 20, offset: 150 });
    expect(query).toBe("?tf=60d&limit=20&offset=150");
    // Round-tripping is what keeps paging links and the edge cache key in agreement.
    expect(parseHeatmapParams(new URLSearchParams(query))).toEqual({
      tf: "60d",
      limit: 20,
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

describe("parseLiquidationParams", () => {
  test("defaults to 24 hours and clamps a nonsense row count instead of rejecting it", () => {
    expect(parseLiquidationParams(new URLSearchParams(""))).toEqual({
      window: "24h",
      assets: DEFAULT_LIQUIDATION_ASSETS,
      venue: "all",
    });
    // The venue is a page-side selector, never SQL, but it is still bounded to a venue-id shape.
    expect(parseLiquidationParams(new URLSearchParams("venue=lighter-rh")).venue).toBe(
      "lighter-rh",
    );
    expect(parseLiquidationParams(new URLSearchParams("venue=DROP TABLE")).venue).toBe("all");
    // A set: sorted and unique, so one selection is one address whatever order it was picked in.
    expect(parseLiquidationParams(new URLSearchParams("venue=okx,GATE,okx")).venue).toBe(
      "gate,okx",
    );
    // A bad id is dropped, not the whole selection.
    expect(parseLiquidationParams(new URLSearchParams("venue=okx,DROP TABLE")).venue).toBe("okx");
    // "all" anywhere means every feed, and so does the retired side-by-side "each".
    expect(parseLiquidationParams(new URLSearchParams("venue=okx,all")).venue).toBe("all");
    expect(parseLiquidationParams(new URLSearchParams("venue=each")).venue).toBe("all");
    // Clamp, never reject: a bad query yields the default view, as every other parser here does.
    expect(parseLiquidationParams(new URLSearchParams("assets=9999")).assets).toBe(
      MAX_LIQUIDATION_ASSETS,
    );
    expect(parseLiquidationParams(new URLSearchParams("assets=0")).assets).toBe(1);
    expect(parseLiquidationParams(new URLSearchParams("assets=banana")).assets).toBe(
      DEFAULT_LIQUIDATION_ASSETS,
    );
  });

  test("matches the window against the allowlist, because it picks an interval", () => {
    expect(parseLiquidationParams(new URLSearchParams("window=7d")).window).toBe("7d");
    expect(parseLiquidationParams(new URLSearchParams("window=7D")).window).toBe("7d");
    // A window is interpolated into a SQL interval, so anything unrecognised falls back rather than
    // reaching the query.
    expect(parseLiquidationParams(new URLSearchParams("window=1 year'--")).window).toBe("24h");
  });

  test("round-trips through its own query string", () => {
    expect(liquidationsToQuery(parseLiquidationParams(new URLSearchParams("")))).toBe("");
    const params = parseLiquidationParams(new URLSearchParams("window=48h&assets=20"));
    expect(liquidationsToQuery(params)).toBe("?window=48h&assets=20");
    expect(parseLiquidationParams(new URLSearchParams(liquidationsToQuery(params)))).toEqual(
      params,
    );
  });
});
