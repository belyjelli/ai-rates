import { describe, expect, test } from "bun:test";
import { VENUES } from "@ai-rates/venues";
import { divergence, flowRatio } from "../web/cvd";
import type { Locale } from "../web/i18n";
import { icon } from "../web/icons";
import { bestPair, pivot } from "../web/pages";
import { BOOK_SCRIPT } from "../web/whales";
import { handleApp, unavailableResponse } from "./app";
import type {
  ArbitrageRow,
  CvdAssetRow,
  CvdBar,
  CvdData,
  CvdOptions,
  DailyFundingRow,
  DataSource,
  GammaData,
  HeatmapCell,
  LiquidationAssetMap,
  LiquidationMap,
  MacroData,
  MacroNeeds,
  MacroOdds,
  MacroPoint,
  MarketRow,
  Overview,
  PriceQuote,
  ScreenerFilters,
  ScreenerPair,
  VenueStatus,
  WhalePosition,
} from "./data";
import { EMPTY_TALLY } from "./data";
import type { Referral } from "./geo";
import { DEFAULT_FILTERS } from "./params";

const NO_GREEKS = {
  call_delta: null,
  put_delta: null,
  call_vega: null,
  put_vega: null,
  call_theta: null,
  put_theta: null,
};

const NOW = Date.parse("2026-09-12T12:00:00Z");

const overview: Overview = {
  markets: 4286,
  venues: 20,
  assets: 1200,
  open_interest_usd: 9e10,
  updated_at: new Date(NOW - 12_000),
  sentiment_score: 62,
  sentiment_label: "greed",
};

const pair: ScreenerPair = {
  asset_class: "crypto" as const,
  long_quote: "USDT",
  short_quote: "USDT",
  asset: "BTC",
  venue_count: 11,
  spread_apr: 11.5,
  spread_apr_7d: 8.2,
  spread_apr_30d: null,
  spread_apr_60d: null,
  long_venue_id: "gate",
  long_symbol: "BTC_USDT",
  long_apr: -0.55,
  long_apr_7d: 1.1,
  long_interval_hours: 8,
  long_open_interest_usd: 4.97e9,
  long_volume_24h_usd: 7e9,
  long_stability: 0.82,
  long_stability_days: 30,
  short_venue_id: "lighter",
  short_symbol: "BTC",
  short_apr: 10.95,
  short_apr_7d: 9.3,
  short_interval_hours: 1,
  short_open_interest_usd: 1.62e8,
  short_volume_24h_usd: 8.5e8,
  short_stability: 0.64,
  short_stability_days: 24,
  // The weaker leg, not an average of the two: a pair is only as persistent as the leg that keeps
  // handing back what the steady one earns.
  pair_stability: 0.64,
  oldest_observed_at: new Date(NOW - 30_000),
};

const market = (overrides: Partial<MarketRow>): MarketRow => ({
  asset_class: "crypto" as const,
  venue_id: "okx",
  venue_symbol: "BTC-USDT-SWAP",
  base: "BTC",
  quote: "USDT",
  apr: 7.4,
  apr_24h: 6.9,
  apr_7d: 7.1,
  interval_hours: 8,
  next_funding_at: new Date(NOW + 3_600_000),
  mark_price: 77766.7,
  open_interest_usd: 2.1e9,
  volume_24h_usd: 8.5e9,
  observed_at: new Date(NOW - 20_000),
  max_leverage: null,
  stability_30d: 0.82,
  stability_days: 30,
  momentum_30d: -2.8,
  ...overrides,
});

function fakeData(overrides: Partial<DataSource> = {}) {
  const calls: { screener: ScreenerFilters[] } = { screener: [] };
  const data: DataSource = {
    overview: async () => overview,
    screener: async (filters) => {
      calls.screener.push(filters);
      return [pair];
    },
    asset: async (base) =>
      base === "BTC"
        ? [market({ venue_id: "gate", venue_symbol: "BTC_USDT", apr: -0.55 }), market({})]
        : [],
    exchanges: async () => [
      {
        id: "okx",
        name: "OKX",
        type: "cex",
        markets: 478,
        open_interest_usd: 2e10,
        volume_24h_usd: 3e10,
        updated_at: new Date(NOW - 5_000),
      },
    ],
    exchange: async (venueId) => (venueId === "okx" ? [market({})] : []),
    heatmap: async () => [],
    arbitrage: async () => [],
    priceQuotes: async () => [],
    priceHistory: async () => [],
    venueStatus: async () => [],
    identityChecks: async () => [],
    leverageTiers: async () => [],
    dailyFunding: async () => [],
    hourlyFunding: async () => [],
    verifiedPairs: async () => [],
    bestVerifiedPair: async () => null,
    liquidationMap: async () => ({ cells: [], columnTotals: [], totals: [], assets: [] }),
    cvd: async () => ({ rows: [], asset_class: "crypto" as const, bars: [], newest: null }),
    assetBars: async () => [],
    cvdHistory: async () => [],
    liquidationFeeds: async () => [],
    whalePositions: async () => [],
    macro: async () => ({ series: {}, readAt: {}, releases: [], odds: [], cot: [] }),
    bookQuality: async () => ({ rows: [], weights: {} }),
    exchangeReserves: async () => [],
    searchIndex: async () => [
      {
        base: "BTC",
        asset_class: "crypto",
        venues: 24,
        open_interest_usd: 3.2e10,
        quoted: true,
        whale_venue: "binance",
      },
      {
        base: "AAPL",
        asset_class: "equity",
        venues: 6,
        open_interest_usd: null,
        quoted: false,
        whale_venue: null,
      },
    ],
    gamma: async ({ currency }) => ({
      currency,
      books: [],
      scopes: [],
      exposure: null,
      strikes: [],
      curve: [],
      expiries: [],
      bands: [],
    }),
    levels: async ({ currency }) => ({
      gamma: {
        currency,
        books: [],
        scopes: [],
        exposure: null,
        strikes: [],
        curve: [],
        expiries: [],
        bands: [],
      },
      days: [],
      stats: null,
      weekStats: null,
      weekStrikes: [],
    }),
    whales: async () => ({
      markets: [],
      venues: [],
      market: null,
      candles: [],
      walls: [],
      trades: [],
      tally: EMPTY_TALLY,
    }),
    sentimentHistory: async () => [],
    liquidationAsset: async () => ({
      asset_class: "crypto" as const,
      mark: 2434.7,
      pending: null,
      band_pct: 1,
      band_fitted: true,
      cells: [],
      totals: [],
      sides: [],
    }),
    ...overrides,
  };
  return { data, calls };
}

/**
 * `count` 8-hourly settlements ending just before NOW, folded the way the daily rollup holds them.
 * The default three span two UTC days: two on 2026-09-11 and one on 2026-09-12.
 */
const dailied = (venue_id: string, venue_symbol: string, rate: number, count = 3) => {
  const days = new Map<string, DailyFundingRow>();
  for (let i = 0; i < count; i++) {
    const day = new Date(NOW - (count - i) * 8 * 3_600_000).toISOString().slice(0, 10);
    const row = days.get(day) ?? {
      venue_id,
      venue_symbol,
      day,
      rate_sum: 0,
      basis_hours_sum: 0,
      settlements: 0,
    };
    row.rate_sum += rate;
    row.basis_hours_sum += 8;
    row.settlements += 1;
    days.set(day, row);
  }
  return [...days.values()];
};

const DAY_MS = 86_400_000;

/**
 * A macro tab's data, made up but shaped like the collector's (migration 038): every series a tab
 * asks for, monthly, quarterly, weekly or daily up to NOW, with releases and Kalshi odds after it and
 * twenty weeks of the Commitments of Traders.
 */
function synthMacro(needs: MacroNeeds): MacroData {
  const end = NOW;
  const monthly = (base: number, step: number, last = 0): MacroPoint[] => {
    const out: MacroPoint[] = [];
    // January 2017 to August 2026, or `last` months earlier.
    for (let k = 2017 * 12; k <= 2026 * 12 + 7 - last; k++)
      out.push([Date.UTC(Math.floor(k / 12), k % 12, 1), base * (1 + step) ** out.length]);
    return out;
  };
  const daily = (base: number, wiggle: number): MacroPoint[] => {
    const out: MacroPoint[] = [];
    for (let t = end - 7 * 365 * DAY_MS, i = 0; t <= end; t += DAY_MS, i++)
      if (new Date(t).getUTCDay() % 6 !== 0)
        out.push([t - (t % DAY_MS), base + wiggle * Math.sin(i / 20)]);
    return out;
  };
  const weekly = (base: number, wiggle: number): MacroPoint[] =>
    daily(base, wiggle).filter(([t]) => new Date(t).getUTCDay() === 3);
  const quarterly = (values: number[], from: number): MacroPoint[] =>
    values.map((v, i) => [Date.UTC(from + Math.floor(i / 4), (i % 4) * 3, 1), v]);
  const sep = (values: number[]): MacroPoint[] =>
    values.map((v, i) => [Date.UTC(2026 + i, 0, 1), v]);
  const all: Record<string, MacroPoint[]> = {
    CPIAUCSL: monthly(245, 0.003),
    CPILFESL: monthly(250, 0.0027),
    PCEPI: monthly(108, 0.0022, 1),
    PCEPILFE: monthly(109, 0.002, 1),
    T5YIE: daily(2.35, 0.1),
    T10YIE: daily(2.3, 0.08),
    T5YIFR: daily(2.25, 0.06),
    DFEDTARU: daily(4, 0),
    DFEDTARL: daily(3.75, 0),
    EFFR: daily(3.88, 0),
    SOFR: daily(3.89, 0.01),
    IORB: daily(3.9, 0),
    WALCL: weekly(6.7e6, 1e5),
    WTREGEN: weekly(8e5, 5e4),
    RRPONTSYD: daily(80, 40),
    FEDTARMD: sep([4.1, 4.1, 3.9, 3.6]),
    FEDTARMDLR: [
      [Date.UTC(2026, 5, 17), 3.1],
      [Date.UTC(2026, 8, 16), 3.2],
    ],
    PCECTPIMD: sep([3.7, 2.3, 2.1, 2]),
    JCXFEMD: sep([3.4, 2.5, 2.2, 2]),
    UNRATEMD: sep([4.1, 4.1, 4.1, 4.1]),
    GDPC1MD: sep([2.3, 2.4, 2.2, 2.1]),
    PAYEMS: monthly(150000, 0.0006),
    UNRATE: monthly(4, 0.0005),
    ICSA: weekly(220000, 15000),
    CCSA: weekly(1.8e6, 5e4),
    JTSJOL: monthly(7500, -0.002, 1),
    CES0500000003: monthly(30, 0.003),
    SAHMREALTIME: monthly(0.1, 0),
    A191RL1Q225SBEA: quarterly([1.2, -0.5, 2.8, 3.1, 2.2, 1.6, 3, 2.4, 0.4, 3.9, 2.1], 2024),
    GDPNOW: [[Date.UTC(2026, 6, 1), 3.6]],
    INDPRO: monthly(100, 0.001),
    RSAFS: monthly(620000, 0.004),
    RECPROUSM156N: monthly(1, 0, 1),
    DGS3MO: daily(4.2, 0.1),
    DGS2: daily(4.7, 0.2),
    DGS10: daily(5, 0.2),
    DGS30: daily(5.3, 0.2),
    T10Y2Y: daily(0.3, 0.6),
    T10Y3M: daily(0.8, 0.9),
    DFII10: daily(2.7, 0.1),
    DTWEXBGS: daily(120, 2),
    NFCI: weekly(-0.5, 0.05),
    M2SL: monthly(21000, 0.004),
    STABLECOINS: daily(2.8e11, 1e10),
  };
  const series: Record<string, MacroPoint[]> = {};
  const readAt: Record<string, Date> = {};
  for (const id of Object.keys(needs.series)) {
    const points = all[id];
    if (!points) continue;
    series[id] = points;
    readAt[id] = new Date(NOW - 20 * 60_000);
  }
  const release = (key: string, days: number, projections = false) => ({
    release: key,
    at: new Date(NOW + days * DAY_MS),
    projections,
  });
  const releases = [
    release("fomc", -45),
    release("claims", 5),
    release("fomc", 4, true),
    release("pce", 10),
    release("gdp", 10),
    release("jolts", 15),
    release("jobs", 20),
    release("cpi", 24),
    release("retail", 30),
    release("indpro", 30),
  ].filter((r) => needs.releases.includes(r.release));
  const market = (
    series: string,
    event: string,
    period: string,
    label: string,
    strike: number,
    p: number,
    days: number,
  ): MacroOdds => ({
    market: `${event}-${strike}`,
    series,
    event,
    period,
    label,
    strike,
    strike_type: series === "KXFEDDECISION" ? "decision" : "greater",
    closes_at: new Date(NOW + days * DAY_MS),
    probability: p,
    volume: 1000,
    fetched_at: new Date(NOW - 5 * 60_000),
  });
  const decisionEvent = (event: string, period: string, days: number, ps: number[]) =>
    [-50, -25, 0, 25, 50].map((bps, i) =>
      market("KXFEDDECISION", event, period, `move ${bps}`, bps, ps[i] ?? 0, days),
    );
  const ladderEvent = (
    series: string,
    period: string,
    strikes: number[],
    ps: number[],
    days: number,
  ) =>
    strikes.map((k, i) =>
      market(series, `${series}-${period}`, period, `Above ${k}`, k, ps[i] ?? 0, days),
    );
  const odds = [
    ...decisionEvent("KXFEDDECISION-26SEP", "2026-09", 4, [0.01, 0.01, 0.84, 0.13, 0.01]),
    ...decisionEvent("KXFEDDECISION-26OCT", "2026-10", 45, [0.01, 0.02, 0.21, 0.72, 0.04]),
    ...ladderEvent(
      "KXCPI",
      "2026-09",
      [0, 0.1, 0.2, 0.3, 0.4],
      [0.97, 0.86, 0.645, 0.29, 0.15],
      24,
    ),
    ...ladderEvent("KXCPICORE", "2026-09", [0, 0.1, 0.2, 0.3], [0.95, 0.82, 0.48, 0.15], 24),
    ...ladderEvent(
      "KXCPIYOY",
      "2026-09",
      [3.6, 3.7, 3.8, 3.9, 4],
      [0.91, 0.83, 0.7, 0.44, 0.29],
      24,
    ),
    ...ladderEvent(
      "KXPAYROLLS",
      "2026-09",
      [0, 50000, 100000, 150000],
      [0.87, 0.56, 0.31, 0.1],
      20,
    ),
    ...ladderEvent("KXU3", "2026-09", [4, 4.1, 4.2, 4.3], [0.92, 0.64, 0.3, 0.07], 20),
    ...ladderEvent("KXGDP", "2026-Q3", [1, 2, 3, 4], [0.97, 0.92, 0.68, 0.22], 10),
  ].filter((o) => needs.odds.includes(o.series));
  const cot = needs.cot
    ? ["BTC", "GC"].flatMap((key) =>
        Array.from({ length: 20 }, (_, w) => {
          const ms = Date.UTC(2026, 3, 28) + w * 7 * DAY_MS;
          const groups =
            key === "BTC"
              ? { leveraged: -6000 + w * 10, asset_manager: 3600 - w * 5, dealer: 1800 }
              : { managed_money: 100000 + w * 300, producer: -18000, swap_dealer: -220000 };
          return Object.entries(groups).map(([trader_group, net]) => ({
            key,
            ms,
            report: key === "BTC" ? "tff" : "disagg",
            open_interest: key === "BTC" ? 20752 : 396345,
            trader_group,
            net,
          }));
        }).flat(),
      )
    : [];
  return { series, readAt, releases, odds, cot };
}

const get = (path: string, data: DataSource) =>
  handleApp(new Request(`https://airates.test${path}`), { data, now: () => NOW });

describe("pages", () => {
  test("home shows the widest pair as the hero and a top-spreads table", async () => {
    const { data, calls } = fakeData();
    const res = await get("/", data);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-robots-tag")).toBeNull();
    expect(html).toContain('class="hero-asset" href="/markets/asset/BTC">BTC<');
    expect(html).toContain("Long on <a");
    expect(html).toContain("Gate");
    expect(html).toContain("Lighter");
    expect(html).toContain("4,286 markets · 20 venues · updated");
    expect(calls.screener).toEqual([{ ...DEFAULT_FILTERS, limit: 12 }]);
  });

  test("same-quote filter reaches the query, and a mixed pair names each leg's currency", async () => {
    const { data, calls } = fakeData({
      screener: async (filters) => {
        calls.screener.push(filters);
        return [{ ...pair, asset: "ETH", long_quote: "USDT", short_quote: "USDC" }, pair];
      },
    });

    const html = await (await get("/screener?quote=same", data)).text();
    expect(calls.screener.at(-1)?.sameQuote).toBe(true);
    expect(html).toContain('name="quote" value="same" checked');
    // Sorting links keep the filter, so a reader never loses it by re-sorting.
    expect(html).toContain("quote=same&sort=venues");

    // Only the mixed row is marked, on both legs; BTC settles both legs in USDT and stays quiet.
    expect(html.match(/class="qmix"/g)).toHaveLength(2);
    expect(html).toContain(">USDC</span>");
    expect((await get("/screener", data)).status).toBe(200);
    expect(calls.screener.at(-1)?.sameQuote).toBe(false);
  });

  test("every page carries its build, so open tabs can tell a deploy landed", async () => {
    const { data } = fakeData();
    const html = await (await get("/rates", data)).text();
    // BUILD.commit is null outside Workers Builds, so tests see an empty stamp and live.ts never reloads.
    expect(html).toMatch(/<body data-rendered="\d+" data-build="">/);
  });

  test("the asset page offers its best pair's backtest as a button, not a link in the sentence", async () => {
    const { data } = fakeData();
    const html = await (await get("/markets/asset/BTC", data)).text();
    const lede = html.match(/<p class="lede" data-live="asset-lede">[\s\S]*?<\/p>/)?.[0] ?? "";
    expect(lede).not.toContain("Backtest this pair");
    expect(html).toMatch(
      /<div class="cta" data-live="asset-cta"><a class="btn" href="\/pair\/BTC\?long=[a-z-]+&short=[a-z-]+" data-await>Backtest this pair/,
    );
  });

  test("one ticker in two asset classes gets two addresses, two labels and two row keys", async () => {
    const asked: [string, string | null][] = [];
    const { data } = fakeData({
      asset: async (base, assetClass) => {
        asked.push([base, assetClass]);
        return assetClass === "equity"
          ? [
              market({
                base: "BB",
                asset_class: "equity",
                venue_id: "okx",
                venue_symbol: "BB-USDT-SWAP",
              }),
            ]
          : [];
      },
      screener: async () => [
        { ...pair, asset: "BB", asset_class: "equity" },
        { ...pair, asset: "BB", asset_class: "crypto" },
      ],
    });

    const page = await get("/markets/asset/equity/bb", data);
    expect(page.status).toBe(200);
    expect(asked).toEqual([["BB", "equity"]]);
    expect(await page.text()).toContain('BB <span class="cls">equity</span>');

    // BlackBerry is addressed by its class; BounceBit keeps the plain crypto address.
    const home = await (await get("/", data)).text();
    expect(home).toContain('href="/markets/asset/equity/BB"');
    expect(home).toContain('href="/markets/asset/BB"');
    expect(home).toContain('data-k="equity:BB"');
    expect(home).toContain('data-k="BB"');

    // An unknown class is an unknown asset, and never reaches the database.
    expect((await get("/markets/asset/bond/BB", data)).status).toBe(404);
    expect(asked).toHaveLength(1);
  });

  test("the verified ranking shows each row's risk, and links its own legs", async () => {
    const verified = {
      run_day: new Date("2026-09-12T00:00:00Z"),
      asset: "IOST",
      asset_class: "crypto" as const,
      long_venue_id: "gate",
      long_symbol: "IOST_USDT",
      short_venue_id: "bybit",
      short_symbol: "IOSTUSDT",
      size_usd: 10_000,
      days: 7,
      net_funding_usd: 835.35,
      net_funding_apr_percent: 435.6,
      win_rate_days: 1,
      avg_daily_usd: 119.34,
      long_settlements: 21,
      short_settlements: 21,
      missed_settlements: 0,
      // The disclosure that earns the ungated ranking: a huge figure on a shallow, distressed leg.
      thinner_leg_oi_usd: 680_000,
      worst_leg_abs_apr: 962.7,
      pair_stability: 0.732,
      long_charge_days: 7,
      short_charge_days: 7,
    };
    const { data } = fakeData({ verifiedPairs: async () => [verified] });
    const html = await (await get("/", data)).text();

    expect(html).toContain("What actually paid, last 7 days");
    expect(html).toContain("$835.35");
    // The row must open ITS pair, not whichever pair the asset page picks by spread.
    expect(html).toContain("/pair/IOST?long=gate&short=bybit");
    // Both risk figures are rendered, because nothing was filtered out of the ranking.
    expect(html).toContain("$680k");
    // formatApr drops decimals past 100, so 962.7 renders as +963% — checked against the
    // formatter rather than assumed.
    expect(html).toContain("+963%");
    expect(html).toContain("replayed 2026-09-12");
  });

  test("the headline is the best pair someone could hold, net of a retail round trip", async () => {
    const best = {
      run_day: new Date("2026-09-13T00:00:00Z"),
      asset: "ETH",
      asset_class: "crypto" as const,
      long_venue_id: "gate",
      long_symbol: "ETH_USDT",
      short_venue_id: "okx",
      short_symbol: "ETH-USDT-SWAP",
      size_usd: 10_000,
      days: 7,
      net_funding_usd: 61.2,
      net_funding_apr_percent: 31.9,
      win_rate_days: 0.857,
      avg_daily_usd: 8.74,
      long_settlements: 21,
      short_settlements: 21,
      missed_settlements: 0,
      thinner_leg_oi_usd: 25_000_000,
      worst_leg_abs_apr: 48.2,
      pair_stability: 0.81,
      long_charge_days: 7,
      short_charge_days: 7,
    };
    const { data } = fakeData({ bestVerifiedPair: async () => best });
    const html = await (await get("/", data)).text();

    // What it settled, not the live widest spread, which is the outlier-prone figure.
    expect(html).toContain("Best verified carry, last 7 days");
    expect(html).not.toContain("Widest funding spread right now");
    expect(html).toContain('<p class="hero-spread up"><b>$61.20</b>');
    // Four fills at 5 bps on $10,000 is $20, charged before the net is shown.
    expect(html).toContain('after retail fees <b class="up">$41.20</b>');
    expect(html).toContain("Long on <a");
    expect(html).toContain("ETH-USDT-SWAP");
    // The backtest opens with the same fees, so its net agrees with the headline's.
    expect(html).toContain(
      'href="/pair/ETH?long=gate&short=okx&days=7&fee_long=5&fee_short=5" data-await>Open this backtest',
    );
    // The bar it cleared is stated, not implied.
    expect(html).toContain("no missed settlements");
  });

  test("the homepage keeps the live spread as its headline when the verified one is unavailable", async () => {
    const logged: string[] = [];
    const { data } = fakeData({
      bestVerifiedPair: async () => {
        throw new Error("connection reset");
      },
    });
    const res = await handleApp(new Request("https://airates.test/"), {
      data,
      now: () => NOW,
      log: (message: string) => logged.push(message),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Widest funding spread right now");
    expect(logged.join("\n")).toContain("headline pair unavailable");
  });

  /** The ONE case as it was actually measured: a wide quoted gap resting on almost nothing. */
  const gap = (overrides: Partial<ArbitrageRow> = {}): ArbitrageRow => ({
    asset_class: "crypto" as const,
    asset: "ONE",
    venue_count: 2,
    gap_bps: 269.64,
    buy_venue_id: "okx",
    buy_symbol: "ONE-USDT-SWAP",
    buy_price: 0.01131,
    buy_depth_usd: 2_000,
    sell_venue_id: "gate",
    sell_symbol: "ONE_USDT",
    sell_price: 0.01162,
    sell_depth_usd: 220_004,
    thinner_depth_usd: 2_000,
    oldest_observed_at: new Date(NOW - 20_000),
    // Newer than observed_at, which is the ordinary case once a feed is running: the book is
    // refreshed continuously while the funding row behind it is refreshed once a cycle.
    oldest_quoted_at: new Date(NOW - 2_000),
    buy_quoted_at: new Date(NOW - 2_000),
    sell_quoted_at: new Date(NOW - 1_000),
    buy_volume_24h_usd: 5_000_000,
    sell_volume_24h_usd: 9_000_000,
    ...overrides,
  });

  /**
   * The liquidation map. Every test below is a way the grid could lie: a zero that was really
   * silence, a total that does not match its rows, a colour that says the wrong side was squeezed.
   */
  const liqMap = (overrides: Partial<LiquidationMap> = {}): LiquidationMap => {
    const bucket = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000);
    return {
      assets: [
        { asset: "ETH", asset_class: "crypto", notional_usd: 34_780_000 },
        { asset: "SNDK", asset_class: "equity", notional_usd: 2_740_000 },
      ],
      cells: [
        {
          venue_id: "gate",
          asset: "ETH",
          asset_class: "crypto",
          bucket_start: bucket(2),
          notional_usd: 26_610_000,
          events: 1_681,
          long_usd: 26_000_000,
          short_usd: 610_000,
        },
        {
          venue_id: "okx",
          asset: "SNDK",
          asset_class: "equity",
          bucket_start: bucket(2),
          notional_usd: 2_130_000,
          events: 395,
          long_usd: 130_000,
          short_usd: 2_000_000,
        },
      ],
      columnTotals: [
        {
          venue_id: "gate",
          bucket_start: bucket(2),
          notional_usd: 30_000_000,
          events: 2_000,
          long_usd: 29_000_000,
          short_usd: 1_000_000,
        },
      ],
      totals: [
        {
          venue_id: "gate",
          notional_usd: 39_760_000,
          events: 8_701,
          long_usd: 30_000_000,
          short_usd: 9_760_000,
          markets: 312,
          last_at: new Date(NOW - 3_600_000),
        },
        {
          venue_id: "okx",
          notional_usd: 64_080_000,
          events: 15_357,
          long_usd: 30_000_000,
          short_usd: 34_080_000,
          markets: 412,
          last_at: new Date(NOW - 16_000),
        },
      ],
      ...overrides,
    };
  };

  test("the map's freshness is the newest close itself, not the start of its column", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations", data)).text();
    // okx closed something 16 seconds ago; the newest cell's bucket_start is two hours back, which
    // is what the line used to report.
    expect(html).toContain("Newest liquidation 16s ago.");
  });

  test("/v1/liquidations applies the named venues instead of only echoing them", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const body = (await (await get("/v1/liquidations?venue=okx", data)).json()) as {
      count: number;
      venues: { venue_id: string }[];
      assets: { asset: string }[];
      cells: { venue_id: string }[];
    };
    expect(body.cells.map((cell) => cell.venue_id)).toEqual(["okx"]);
    expect(body.count).toBe(1);
    expect(body.venues.map((venue) => venue.venue_id)).toEqual(["okx"]);
    // Only the rows okx has a cell in: gate's ETH is not okx's.
    expect(body.assets.map((asset) => asset.asset)).toEqual(["SNDK"]);

    // A combination, in whatever order it was asked for, comes back as one canonical selection.
    const both = (await (await get("/v1/liquidations?venue=okx,gate", data)).json()) as {
      params: { venue: string };
      query: string;
      cells: unknown[];
    };
    expect(both.params.venue).toBe("gate,okx");
    expect(both.query).toBe("?venue=gate,okx");
    expect(both.cells).toHaveLength(2);

    const all = (await (await get("/v1/liquidations", data)).json()) as { cells: unknown[] };
    expect(all.cells).toHaveLength(2);
  });

  test("the liquidation map adds the feeds up by default, and names them", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations", data)).text();

    // One grid, summed over the feeds: "what happened to this asset" is the question the page opens
    // on.
    expect(html).toContain('data-live="lq-all"');
    expect(html).not.toContain('data-live="lq-gate"');
    // The feeds' own totals, added: the fixture's $39.8M on gate and $64.1M on okx.
    expect(html).toContain('data-live="lq-sum-all"><b>$104M</b>');
    // The venues are named from the data, not written into the copy.
    expect(html).toContain("This is Gate and OKX, the 2 venues whose liquidation feed");
    // "all" is the lit entry, and each venue's link selects it alone.
    expect(html).toContain(
      'class="on" href="/liquidations#map" aria-current="true" data-lq-swap="map" data-lq-venue="all">all<',
    );
    expect(html).toContain(
      'href="/liquidations?venue=gate#map" data-lq-swap="map" data-lq-venue="gate">gate<',
    );
    expect(html).toContain(
      'href="/liquidations?venue=okx#map" data-lq-swap="map" data-lq-venue="okx">okx<',
    );
    // No heading over the grid naming the venues: the strip already shows which are added up.
    expect(html).not.toContain('class="lq-venue"');
    expect(html).not.toContain("Every feed");
  });

  test("one venue can be picked, and an unknown one falls back to the sum", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const okx = await (await get("/liquidations?venue=okx", data)).text();
    // The same one grid, now okx's alone, and okx lit while "all" is not.
    expect(okx).toContain('data-live="lq-sum-all"><b>$64.1M</b>');
    expect(okx).toContain('aria-current="true" data-lq-swap="map" data-lq-venue="okx">okx<');
    expect(okx).not.toContain('aria-current="true" data-lq-swap="map" data-lq-venue="all"');
    // Clicking okx again takes it away, which leaves every feed. Clicking gate adds it, which with
    // two feeds is every feed too, so it is the plain address.
    expect(okx).toContain(
      'href="/liquidations#map" aria-current="true" data-lq-swap="map" data-lq-venue="okx"',
    );
    expect(okx).toContain('href="/liquidations#map" data-lq-swap="map" data-lq-venue="gate"');

    // A venue with no rows in this window is not an empty grid: it reads as the combined one.
    const gone = await (await get("/liquidations?venue=bybit", data)).text();
    expect(gone).toContain('data-live="lq-sum-all"><b>$104M</b>');
    expect(gone).toContain('aria-current="true" data-lq-swap="map" data-lq-venue="all"');
  });

  test("a combination of venues is added up into the one grid, each of them lit", async () => {
    const liq3 = liqMap({
      totals: [
        ...liqMap().totals,
        {
          venue_id: "binance",
          notional_usd: 10_000_000,
          events: 1_000,
          long_usd: 5_000_000,
          short_usd: 5_000_000,
          markets: 200,
          last_at: new Date(NOW - 60_000),
        },
      ],
    });
    const { data } = fakeData({ liquidationMap: async () => liq3 });
    const html = await (await get("/liquidations?venue=okx,gate", data)).text();

    // gate's $39.76M and okx's $64.08M, binance's $10M left out.
    expect(html).toContain('data-live="lq-sum-all"><b>$104M</b>');
    expect(html).toContain("24,058 liquidations");
    expect(html).toContain('aria-current="true" data-lq-swap="map" data-lq-venue="gate">gate<');
    expect(html).toContain('aria-current="true" data-lq-swap="map" data-lq-venue="okx">okx<');
    // Picking the last one left is every feed, so it is the plain address.
    expect(html).not.toContain("venue=binance,gate,okx");
    expect(html).toContain(
      'href="/liquidations#map" data-lq-swap="map" data-lq-venue="binance">binance<',
    );
    // Shared rows: ETH is gate's and SNDK okx's, both in the one grid.
    expect(html).toContain("$26.6M");
    expect(html).toContain("$2.1M");
  });

  test("the old side-by-side view reads as every feed", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations?venue=each", data)).text();
    expect(html).toContain('data-live="lq-sum-all"><b>$104M</b>');
    expect(html).not.toContain(">each<");
  });

  test("picking venues reloads only the map tab, in place", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations", data)).text();
    // The script ships with the page and reloads the tab from its own fragment address.
    expect(html).toContain("a[data-lq-swap]");
    expect(html).toContain("panelUrl(base, tab)");
    // And that fragment is the map tab alone, strip and grid, for the selection asked for.
    const fragment = await (await get("/liquidations?venue=okx&panel=map", data)).text();
    expect(fragment).toContain('<div class="lazy-body"');
    expect(fragment).toContain('data-live="lq-sum-all"><b>$64.1M</b>');
    expect(fragment).toContain('aria-current="true" data-lq-swap="map" data-lq-venue="okx"');
    expect(fragment).not.toContain("<main");
  });

  test("a long liquidation and a short liquidation are different colours", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations", data)).text();

    // ETH on gate closed mostly longs, SNDK on okx mostly shorts. Step 6 both: over $5M.
    expect(html).toContain("lq-l6");
    expect(html).toContain("lq-s6");
  });

  test("a quiet bucket renders as silence, never as a zero", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations", data)).text();

    // Nothing happening and $0 happening are different claims; the grid must not conflate them.
    expect(html).toContain('class="num none"');
    expect(html).not.toContain(">$0<");
  });

  test("the rows that did not fit are summed, so the venue total adds up", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations?venue=gate", data)).text();

    // gate's column total is $30M and its one visible row is $26.61M, so the tail is $3.39M.
    expect(html).toContain("other markets");
    expect(html).toContain("$3.4M");
  });

  test("a tradfi ticker keeps its class, so SNDK the stock is not SNDK the token", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations", data)).text();

    expect(html).toContain("SNDK");
    expect(html).toContain('class="cls">equity');
  });

  test("the liquidation map escapes an asset that arrives as markup", async () => {
    const { data } = fakeData({
      liquidationMap: async () =>
        liqMap({
          assets: [{ asset: "<script>", asset_class: "crypto", notional_usd: 1 }],
          cells: [],
          columnTotals: [],
        }),
    });
    const html = await (await get("/liquidations", data)).text();

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  test("a window with no liquidations says which venues even report them", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap({ totals: [], cells: [], columnTotals: [], assets: [] }),
    });
    const html = await (await get("/liquidations", data)).text();

    expect(html).toContain("No liquidations recorded");
    // The honest caveat: a quiet grid here is two venues being quiet, not the market.
    expect(html).toContain("not a quiet market");
    expect(html).not.toContain('<table class="heat lq">');
  });

  test("the window strip selects the interval and the page states the bucket width", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const html = await (await get("/liquidations?window=7d", data)).text();

    expect(html).toContain("are 12-hour buckets");
    expect(html).toContain('href="/liquidations?window=7d"');
    // A 7-day window must not still claim the 24-hour default's columns. Anchored on the preceding
    // word because "12-hour buckets" CONTAINS "2-hour buckets" -- the first version of this
    // assertion failed on exactly that.
    expect(html).not.toContain("are 2-hour buckets");
  });

  /**
   * The per-asset grid, where the row axis becomes the price a position died at. Its failure modes
   * are different from the map's: a band that means the wrong dollars, a tail that silently drops
   * the most interesting close of the day, or a mark line drawn in the wrong place.
   */
  const liqAsset = (overrides: Partial<LiquidationAssetMap> = {}): LiquidationAssetMap => ({
    asset_class: "crypto",
    mark: 2_400,
    pending: null,
    band_pct: 1,
    band_fitted: false,
    cells: [
      {
        venue_id: "gate",
        band: 0,
        bucket_start: new Date(NOW - 2 * 3_600_000),
        notional_usd: 9_490_000,
        events: 835,
        long_usd: 7_974_000,
        short_usd: 1_516_000,
      },
      {
        venue_id: "okx",
        band: 4,
        bucket_start: new Date(NOW - 2 * 3_600_000),
        notional_usd: 12_000,
        events: 3,
        long_usd: 0,
        short_usd: 12_000,
      },
    ],
    totals: [
      {
        venue_id: "gate",
        notional_usd: 9_490_000,
        events: 835,
        long_usd: 7_974_000,
        short_usd: 1_516_000,
        markets: 1,
        last_at: new Date(NOW - 2 * 3_600_000),
      },
      {
        venue_id: "okx",
        notional_usd: 12_000,
        events: 3,
        long_usd: 0,
        short_usd: 12_000,
        markets: 1,
        last_at: new Date(NOW - 2 * 3_600_000),
      },
    ],
    sides: [
      {
        bucket_start: new Date(Math.floor((NOW - 2 * 3_600_000) / 900_000) * 900_000),
        long_usd: 7_974_000,
        short_usd: 1_516_000,
        events: 835,
      },
      {
        bucket_start: new Date(Math.floor((NOW - 3_600_000) / 900_000) * 900_000),
        long_usd: 0,
        short_usd: 12_000,
        events: 3,
      },
    ],
    ...overrides,
  });

  /** One tab on its own, as tabs.ts loads it into a placeholder: the page's address plus ?panel=. */
  const tab = async (path: string, id: string, data: DataSource) =>
    (await get(`${path}${path.includes("?") ? "&" : "?"}panel=${id}`, data)).text();

  test("liquidations is one page in two tabs, both panels served and neither hidden", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const html = await (await get("/liquidations", data)).text();

    expect(html).toContain('data-tabs="liq"');
    expect(html).toContain('data-tab="map"');
    expect(html).toContain('data-tab="price"');
    // Both panels ship, and neither is hidden in the HTML: the script hides the inactive one, so a
    // reader without JavaScript gets both grids rather than one and a dead button.
    expect(html).toContain('data-tab-panel="map"');
    expect(html).toContain('data-tab-panel="price"');
    expect(html).not.toContain('<div class="tabpanel" hidden');

    // The bar must sit ahead of every live-swapped region, or live.ts replaces a button under the
    // reader's cursor about every 30 seconds and the active tab resets itself.
    const bar = html.indexOf('data-tabs="liq"');
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeLessThan(html.indexOf('data-live="lq-asof"'));
    expect(bar).toBeLessThan(html.indexOf('<tbody data-live="lq-all"'));
  });

  test("the address picks the tab: the map by default, prices when an asset is named", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });

    const list = await (await get("/liquidations", data)).text();
    expect(list).toContain('id="tab-liq-map" class="btn-tab active"');
    expect(list).not.toContain('id="tab-liq-price" class="btn-tab active"');

    const one = await (await get("/liquidations/ETH", data)).text();
    expect(one).toContain('id="tab-liq-price" class="btn-tab active"');
    expect(one).not.toContain('id="tab-liq-map" class="btn-tab active"');
  });

  test("with no asset named, the priced tab is primed with the busiest one", async () => {
    const calls: string[] = [];
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async (options) => {
        calls.push(options.base);
        return liqAsset();
      },
    });
    const html = await (await get("/liquidations", data)).text();

    // The map page reads nothing per asset: the other tabs ship as placeholders that load
    // themselves, named for the busiest asset (ETH in liqMap) so the tab bar already says what
    // they hold.
    expect(calls).toEqual([]);
    expect(html).toContain("ETH price levels");
    expect(html).toContain('data-lazy="/liquidations?panel=price"');
    expect(html).toContain('class="chart-skel lazy-wait"');
    // Opening one reads that asset, once.
    const price = await tab("/liquidations", "price", data);
    expect(calls).toEqual(["ETH"]);
    expect(price).toContain('class="lazy-body"');
    expect(price).toContain("Fill price");
    // A bare fragment, never a second copy of the page around it.
    expect(price).not.toContain("<html");
  });

  test("a tab that loads itself carries the page's query, and an address that names an asset fills its tabs", async () => {
    const calls: string[] = [];
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async (options) => {
        calls.push(options.base);
        return liqAsset();
      },
      assetBars: async () => {
        calls.push("bars");
        return [];
      },
    });
    const week = await (await get("/liquidations?window=7d", data)).text();
    expect(week).toContain('data-lazy="/liquidations?window=7d&amp;panel=sides"');
    expect(calls).toEqual([]);

    // /liquidations/ETH opens on its prices, so the per-asset read is made anyway: Sides and Prices
    // ship filled, and only Odds -- a week of bars more -- waits to be opened.
    const eth = await (await get("/liquidations/ETH", data)).text();
    expect(calls).toEqual(["ETH"]);
    expect(eth).not.toContain('data-lazy="/liquidations/ETH?panel=sides"');
    expect(eth).not.toContain('data-lazy="/liquidations/ETH?panel=price"');
    expect(eth).toContain('data-lazy="/liquidations/ETH?panel=odds"');
    // A query that is about one tab's own controls fills that tab, so a click lands on a drawn tab.
    calls.length = 0;
    const zoomed = await (await get("/liquidations?zoom=out", data)).text();
    expect(calls).toEqual(["ETH"]);
    expect(zoomed).not.toContain('data-lazy="/liquidations?zoom=out&amp;panel=sides"');
    // An unknown panel is the page, not an error.
    expect((await get("/liquidations?panel=nope", data)).status).toBe(200);
  });

  describe("whale map", () => {
    const whale = (overrides: Partial<WhalePosition>): WhalePosition => ({
      address: "0x7c4b00000000000000000000000000000000e00b",
      coin: "ETH",
      venue_id: "hyperliquid",
      asset_class: "crypto",
      size: 500,
      entry_price: 4_000,
      position_usd: 2_000_000,
      liquidation_price: 3_800,
      liquidation_reported: true,
      leverage: 20,
      leverage_type: "cross",
      unrealized_pnl_usd: -1_000,
      account_value_usd: 5_000_000,
      mark_price: 4_000,
      read_at: new Date(NOW - 60_000),
      ...overrides,
    });
    // ETH at 4,000: a $2M long 5% from liquidation, a $3M short 10% away, a $400k long 1% away (under
    // the $1M floor), and a $1.5M long with no liquidation price at all.
    const book = [
      whale({}),
      whale({
        address: "0x5b5d00000000000000000000000000000000c060",
        size: -750,
        position_usd: 3_000_000,
        liquidation_price: 4_400,
        leverage: 5,
        leverage_type: "isolated",
      }),
      whale({
        address: "0x0000000000000000000000000000000000000001",
        position_usd: 400_000,
        liquidation_price: 3_960,
      }),
      whale({
        address: "0x0000000000000000000000000000000000000002",
        position_usd: 1_500_000,
        liquidation_price: null,
      }),
    ];

    test("the whale tab loads itself and lists the busiest asset's positions, nearest liquidation first", async () => {
      const calls: string[] = [];
      const { data } = fakeData({
        liquidationMap: async () => liqMap(),
        whalePositions: async ({ base }) => {
          calls.push(base);
          return book;
        },
      });
      const page = await (await get("/liquidations", data)).text();
      // A fifth tab, named for the busiest asset, read only when opened.
      expect(page).toContain('data-tab="whales"');
      expect(page).toContain("ETH whale map");
      expect(page).toContain('data-lazy="/liquidations?panel=whales"');
      expect(calls).toEqual([]);

      const html = await tab("/liquidations", "whales", data);
      expect(calls).toEqual(["ETH"]);
      // $1M and up by default: the $400k long is left out.
      const rows = [...html.matchAll(/<tr data-k="hyperliquid\|([^|]+)\|ETH">/g)].map((m) => m[1]);
      expect(rows).toEqual([
        "0x7c4b00000000000000000000000000000000e00b",
        "0x5b5d00000000000000000000000000000000c060",
        "0x0000000000000000000000000000000000000002",
      ]);
      expect(html).toContain('href="https://hl.eco/0x7c4b00000000000000000000000000000000e00b"');
      expect(html).toContain(">0x7c4b…e00b<");
      expect(html).toContain("−5.0%");
      expect(html).toContain("+10.0%");
      expect(html).toContain("5× isolated");
      // The long and short tiles, and the money within 5% of the mark on each side.
      expect(html).toContain('data-u="longs">$3.5M<');
      expect(html).toContain('data-u="shorts">$3.0M<');
      expect(html).toContain('data-u="near-l" class="lq-ink-l">$2.0M<');
      // The chart, with the crosshair and the hover payload; the switches reload the tab in place.
      expect(html).toContain(
        'class="fchart cvd-chart wm-chart" data-live="whale-chart" data-cursors',
      );
      expect(html).toContain('"kind":"wmap"');
      expect(html).toContain(
        'href="/liquidations?whale=100k#whales" data-lq-swap="whales">$100k+<',
      );
      expect(html).toContain('href="/liquidations?wzoom=50#whales" data-lq-swap="whales">±50%<');
      expect(html).toContain('aria-current="page" data-lq-swap="whales">±25%<');
      // What a member's live pass names (live.ts), and the line each reader sees until it has one.
      expect(page).toContain(
        'data-tab-panel="whales" aria-labelledby="tab-liq-whales" data-lazy="/liquidations?panel=whales" data-member-live-tab',
      );
      expect(html).toContain(
        'data-member-live data-base="ETH" data-class="crypto" data-floor="1m"',
      );
      expect(html).toContain(
        '<span data-live-off>Refreshes every 30 s. <a href="https://member.airrates.net/member/login">Log in</a> to refresh every 10 s',
      );
      expect(html).toContain("data-live-on hidden>Live for members");
    });

    test("the $100k switch shows the smaller positions, and its address opens on a drawn tab", async () => {
      const calls: string[] = [];
      const { data } = fakeData({
        liquidationMap: async () => liqMap(),
        whalePositions: async ({ base }) => {
          calls.push(base);
          return book;
        },
      });
      const html = await (await get("/liquidations?whale=100k", data)).text();
      expect(calls).toEqual(["ETH"]);
      expect(html).not.toContain('data-lazy="/liquidations?whale=100k&amp;panel=whales"');
      // The $400k long, 1% from liquidation, now leads the table.
      expect(html.match(/<tr data-k="hyperliquid\|([^|]+)\|ETH">/)?.[1]).toBe(
        "0x0000000000000000000000000000000000000001",
      );
      // The other tabs' links keep the switch.
      expect(html).toContain('data-lazy="/liquidations?whale=100k&amp;panel=sides"');
    });

    test("a failed read says so in the tab, and an empty $1M view points at the $100k one", async () => {
      const broken = fakeData({
        liquidationMap: async () => liqMap(),
        whalePositions: async () => {
          throw new Error("hl_positions does not exist");
        },
      });
      const res = await get("/liquidations?panel=whales", broken.data);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("The whale positions could not be read right now.");

      const small = fakeData({
        liquidationMap: async () => liqMap(),
        whalePositions: async () => [book[2] as WhalePosition],
      });
      const html = await tab("/liquidations", "whales", small.data);
      expect(html).toContain("No position of $1M or more in");
      expect(html).toContain("There are 1 of $100k or more: switch to $100k+.");
    });

    test("Lighter's and dYdX's positions sit beside Hyperliquid's, each linked to its own venue", async () => {
      const { data } = fakeData({
        liquidationMap: async () => liqMap(),
        whalePositions: async () => [
          whale({}),
          // Lighter's own mark is 4,010: its 2% is measured from there, not from Hyperliquid's.
          whale({
            venue_id: "lighter",
            address: "714710",
            size: -300,
            position_usd: 1_203_000,
            liquidation_price: 4_090.2,
            mark_price: 4_010,
          }),
          whale({
            venue_id: "dydx",
            coin: "ETH-USD",
            address: "dydx1fjeassd5ljdfwy5elpqn3pfzdccmwzz706v97e/2",
            size: -400,
            entry_price: null,
            position_usd: 1_600_000,
            liquidation_price: 4_800,
            liquidation_reported: false,
            leverage: 3.4,
          }),
        ],
      });
      const html = await tab("/liquidations", "whales", data);
      expect(html).toContain('<tr data-k="lighter|714710|ETH">');
      expect(html).toContain('href="https://app.lighter.xyz/explorer/accounts/714710"');
      expect(html).toContain(">#714710<");
      expect(html).toContain(
        'href="https://www.mintscan.io/dydx/address/dydx1fjeassd5ljdfwy5elpqn3pfzdccmwzz706v97e"',
      );
      expect(html).toContain(">dydx1f…v97e/2<");
      expect(html).toContain("+2.0%");
      // dYdX's price is computed, and says so; its unknown entry is a dash, not a zero.
      expect(html).toContain('4,800<span class="dim">*</span>');
      expect(html).toContain("dYdX publishes no liquidation price");
      expect(html).toContain("3.4× cross");
      expect(html).toContain('<td class="dim">Lighter</td>');
      expect(html).toContain("whale positions by liquidation price · Hyperliquid, dYdX, Lighter");
      expect(html).toMatch(/data-live="whale-venues">By venue: <span>Hyperliquid <b>\$2\.0M<\/b>/);
      expect(html).toContain('data-u="accounts">3<');
    });
  });

  test("an address that is not an asset is a 404, not the map with a stray tab", async () => {
    const { data } = fakeData({ liquidationMap: async () => liqMap() });
    const res = await get("/liquidations/not%20an%20asset", data);

    expect(res.status).toBe(404);
  });

  test("changing the window keeps the asset, the band and the tab", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const html = await (await get("/liquidations/ETH?band=2", data)).text();

    // The window strip sits above the tabs and governs both panels, so its links have to carry the
    // address and the band with them. The first version pointed every one at /liquidations, which
    // dropped the asset and bounced the reader to the map.
    // &amp;, because esc() escapes the attribute -- asserting a raw & would be asserting a bug.
    expect(html).toContain('href="/liquidations/ETH?window=48h&amp;band=2"');
    // And the band strip keeps the fragment, or following it from the priced tab of /liquidations
    // would land back on the map.
    expect(html).toContain("#price");
  });

  test("longs and shorts share one table, for one asset, with the exchanges added up", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const html = await (await get("/liquidations", data)).text();

    expect(html).toContain('data-tab="sides"');
    expect(html).toContain('data-tab-panel="sides"');

    const sides = await tab("/liquidations", "sides", data);
    expect(sides).toContain("Longs closed <b>$8.0M</b>");
    expect(sides).toContain("Shorts closed <b>$1.5M</b>");
    expect(sides).toContain('data-live="lq-sides"');
    // ONE price column: the two sides share their rows, so the labels are printed once. Two grids
    // that each repeated them did not fit side by side and were drawn over each other.
    expect(sides.split("<table").length - 1).toBe(1);
    expect(sides.split("Fill price").length - 1).toBe(1);
    expect(sides.split('scope="row">2,400 – 2,424<').length - 1).toBe(1);
    // The rows are PRICE bands, not assets: this view is one asset drilled down, so it carries the
    // same row vocabulary as the priced tab rather than the map's.
    expect(sides).toContain("Fill price");
    expect(sides).toContain("2,400 – 2,424");
    // liqAsset has gate at band 0 ($7.974M long, $1.516M short) and okx at band 4 ($12k short).
    // Merged across exchanges the long panel shows $8.0M and the short panel $1.5M and $12.0k.
    expect(sides).toContain("$8.0M");
    expect(sides).toContain("$1.5M");
    expect(sides).toContain("$12.0k");
    // Never the cell total: a view that forgot to split would print gate's $9.49M.
    expect(sides).not.toContain("$9.5M");
  });

  /** A week of half-hour closes that wobble around ETH's mark: enough history for the odds tab. */
  const weekOfCloses = () =>
    Array.from({ length: 336 }, (_, i) => ({
      bucket_start: new Date(NOW - (336 - i) * 1_800_000),
      buy_usd: 1_000_000,
      sell_usd: 900_000,
      price: 2434.7 * (1 + 0.004 * Math.sin(i * 1.7) + 0.002 * Math.cos(i * 0.31)),
      price_venue: "binance",
      price_symbol: "ETHUSDT",
    }));

  test("the odds tab sizes moves from a week of closes and keeps direction at a coin flip", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
      assetBars: async () => weekOfCloses(),
    });
    const html = await (await get("/liquidations/ETH", data)).text();

    expect(html).toContain('data-tab="odds"');
    const odds = await tab("/liquidations/ETH", "odds", data);
    expect(odds).toBeDefined();
    // Four horizons as columns.
    for (const label of ["4 hours", "6 hours", "1 day", "1 week"]) expect(odds).toContain(label);
    // No theory has passed its test, so the direction row is exactly even at every horizon.
    const row = odds.split("Closes higher than now")[1].split("</tr>")[0];
    expect(row.split("50%").length - 1).toBe(4);
    // Each reading says it is not moving the odds, and the magnet says why it cannot be read.
    expect(odds).toContain("Not yet tested, so it carries no weight");
    expect(odds).toContain("Liquidation magnet");
    expect(odds).toContain("cannot be read yet");
    // The heaviest levels come from the same cells the priced tab draws.
    expect(odds).toContain("Reaches the heaviest forced-close level");
    // Never a bare 100% or 0% for a model output.
    expect(odds).not.toContain(">100%<");
  });

  test("the odds tab says so when there is too little price, and a failed read does not 500", async () => {
    const thin = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
      assetBars: async () => weekOfCloses().slice(0, 6),
    });
    expect(await tab("/liquidations/ETH", "odds", thin.data)).toContain(
      "not yet enough price history",
    );

    const broken = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
      assetBars: async () => {
        throw new Error("hyperdrive busy");
      },
      asset: async () => {
        throw new Error("hyperdrive busy");
      },
    });
    const res = await get("/liquidations/ETH?panel=odds", broken.data);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("not yet enough price history");
  });

  test("a side with nothing closed is silence, not a zero beside the other side", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const sides = await tab("/liquidations", "sides", data);

    // okx's band-4 cell closed $12k of shorts and no longs. The long panel's band 4 has to read as
    // nothing, in a panel whose entire subject is one side -- which is a narrower claim than "$0",
    // because the same band was busy on the other side.
    expect(sides).toContain('class="num none"');
    expect(sides).not.toContain(">$0<");
  });

  test("the sides tab charts both sides on one zero line across the whole window", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const sides = await tab("/liquidations", "sides", data);

    expect(sides).toContain('class="fchart lqc"');
    // Longs rise and shorts fall from the same line; a bucket with no longs draws no long bar.
    expect(sides.match(/class="lqc-long"/g)?.length).toBe(1);
    expect(sides.match(/class="lqc-short"/g)?.length).toBe(2);
    // Equal scales above and below, ending at the tallest bar ($7.97M) rather than a round number.
    expect(sides).toContain(">$8M<");
    expect(sides).toContain(">−$8M<");
    expect(sides).toContain('class="lqc-long" x="907.71" y="0.00"');
    // The legend totals the window.
    expect(sides).toContain('data-u="lqc-long">$8.0M<');
  });

  // What the collector would have written for roughly $2B of open interest.
  const PENDING = {
    longs: [4e6, 9e6, 11e6, 16e6, 24e6, 31e6, 20e6, 7e6, 3e6, 1e6],
    shorts: [3e6, 8e6, 10e6, 13e6, 19e6, 22e6, 15e6, 6e6, 2e6, 1e6],
  };

  test("the sides chart draws the modeled pending strip, and Pending off removes it", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset({ pending: PENDING }),
    });
    const sides = await tab("/liquidations", "sides", data);

    // Twenty rows, shorts above the price and longs below, and the legend totals both sides.
    expect(sides.match(/class="lqp-row"/g)?.length).toBe(20);
    expect(sides).toContain("Shorts at risk above");
    expect(sides).toContain("Longs at risk below");
    expect(sides).toContain("pending by price band");
    expect(sides).toContain("pending is modeled");
    // It is an estimate, and the page says so beside the chart.
    expect(sides).toContain(
      "Modeled from open interest and leverage tiers, not reported by venues.",
    );
    // Each row reads itself in the header line, and the price line carries the mark.
    expect(sides).toContain("Longs at risk, modeled");
    expect(sides).toContain('class="lqp-mark"><b>2,400</b>');
    // The toggle keeps the tab, and off drops the strip and the note.
    expect(sides).toContain('href="/liquidations?pending=0#sides"');
    const offSides = await tab("/liquidations?pending=0", "sides", data);
    expect(offSides).not.toContain("lqp-row");
    expect(offSides).not.toContain("Modeled from open interest");
    expect(offSides).toContain('href="/liquidations#sides"');
  });

  test("the pending strip zooms out to half the price and double it, reading the wide rows", async () => {
    const asked: boolean[] = [];
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async (options) => {
        asked.push(options.pendingWide ?? false);
        return liqAsset({ pending: PENDING });
      },
    });
    const nearSides = await tab("/liquidations", "sides", data);
    expect(nearSides).toContain(">+10%<");
    expect(nearSides).toContain(">−10%<");
    expect(nearSides).toContain('href="/liquidations?zoom=out#sides"');

    const sides = await tab("/liquidations?zoom=out", "sides", data);
    expect(asked).toEqual([false, true]);
    // 10% rows above to +100% (double), 5% rows below to −50% (half), both ticked at the outer edge.
    expect(sides).toContain(">+100%<");
    expect(sides).toContain(">+20%<");
    expect(sides).toContain(">−50%<");
    expect(sides).toContain(">−10%<");
    expect(sides).not.toContain(">+10%<");
    // A row reads its own range: the first one below spans 0-5%, from 2,280 to the 2,400 mark.
    expect(sides).toContain("price falls &lt;b&gt;0–5%&lt;/b&gt; to 2,280–2,400");
    expect(sides).toContain("price rises &lt;b&gt;90–100%&lt;/b&gt; to 4,560–4,800");
    // The switch keeps the tab and drops back to ±10%; turning pending off drops the zoom with it.
    expect(sides).toContain('href="/liquidations#sides"');
    expect(sides).toContain('href="/liquidations?pending=0&amp;zoom=out#sides"');
    const offSides = await tab("/liquidations?pending=0", "sides", data);
    expect(offSides).not.toContain("Zoom out");
    expect(sides).toContain(">Zoom in<");
    expect(sides).toContain('aria-current="page" data-lq-swap="sides">Zoom out<');
  });

  test("the pending strip reads its money along the bottom, against its widest row", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset({ pending: PENDING }),
    });
    const sides = await tab("/liquidations", "sides", data);
    // The widest row is the longs' $31M, so half of it sits in the middle and all of it at the edge.
    expect(sides).toContain(
      '<div class="lqp-x" aria-hidden="true"><span style="left:50%">$15.5M</span><span style="left:100%">$31M</span></div>',
    );
  });

  test("every control in the per-asset tabs reloads its own tab in place", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset({ pending: PENDING }),
    });
    const sides = await tab("/liquidations", "sides", data);
    const price = await tab("/liquidations", "price", data);
    // Pending on/off and the zoom, on Sides.
    expect(sides).toContain(
      'href="/liquidations?pending=0#sides" data-lq-swap="sides">Pending off<',
    );
    expect(sides).toContain('href="/liquidations?zoom=out#sides" data-lq-swap="sides">Zoom out<');
    // The asset picker, on each tab it sits in, reloading that tab.
    expect(sides).toMatch(
      /<a class="on" href="\/liquidations\/ETH#sides" aria-current="page" data-lq-swap="sides">/,
    );
    expect(price).toMatch(/href="\/liquidations\/[^"]+#price"[^>]* data-lq-swap="price">/);
    // The band widths, on Prices.
    expect(price).toMatch(/href="[^"]*band=[^"]*#price" data-lq-swap="price">/);
    // A fragment carries the tab labels, so the bar can be relabelled when the asset changes.
    expect(sides).toContain("data-labels=");
    expect(sides).toContain("ETH longs vs shorts");
  });

  test("the per-asset grids explain their time columns, and each header names its full range", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const sides = await tab("/liquidations", "sides", data);
    const price = await tab("/liquidations", "price", data);

    // The columns are in the reader's zone: UTC as served, renamed by localtime.ts in the browser.
    for (const html of [sides, price]) {
      expect(html).toContain(
        "Columns are time, in your time zone (<span data-tz>UTC</span>; click the clock at the top for UTC). Each is a 2-hour block named by its start hour.",
      );
    }
    // Only Sides has an "All" column, so only Sides explains it.
    expect(sides).toContain("'All' is that price row's total over the whole window.");
    expect(price).not.toContain("is that price row");

    // NOW is 12:00 UTC on Sep 12: a plain block, the block that starts the day, and the one filling,
    // each stamped with its moment and its bucket for the browser to redraw in the reader's zone.
    const at = (iso: string) => Date.parse(iso);
    for (const html of [sides, price]) {
      expect(html).toContain(
        `title="16:00–18:00 UTC" data-tt="${at("2026-09-11T16:00:00Z")}" data-tf="colt" data-tpl="{t}" data-b="2"><time datetime="2026-09-11T16:00:00.000Z" data-t="${at("2026-09-11T16:00:00Z")}" data-tf="col" data-b="2">16</time>`,
      );
      expect(html).toContain('title="Sep 12 00:00–02:00 UTC"');
      expect(html).toContain('data-tf="col" data-b="2">12/00</time>');
      expect(html).toContain('title="12:00–14:00 UTC, still filling"');
    }

    // Longer windows have longer blocks.
    expect(await tab("/liquidations?window=48h", "sides", data)).toContain(
      'title="16:00–20:00 UTC"',
    );
  });

  test("the time-column help and tooltips read in Chinese", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const sides = await (
      await handleApp(new Request("https://airates.test/liquidations?panel=sides"), {
        data,
        now: () => NOW,
        locale: "zh",
      })
    ).text();
    expect(sides).toContain(
      "列表示时间，按你的时区（<span data-tz>UTC</span>；点击顶部时钟可切换为 UTC）。每列为 2 小时，以开始时刻标注。",
    );
    expect(sides).toContain("「全部」为该价格行在整个时间窗口内的合计。");
    expect(sides).toContain('title="9月12日 00:00–02:00 UTC"');
    expect(sides).toContain('title="12:00–14:00 UTC，仍在累计"');
  });

  test("the sides chart has no pending strip when the collector has no fresh model", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const sides = await tab("/liquidations", "sides", data);
    expect(sides).not.toContain("lqp-row");
    expect(sides).not.toContain("Modeled from open interest");
  });

  test("the sides chart ships every slot's figures for the hover readout, and no native tooltips", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const html = await (await get("/liquidations", data)).text();
    const sides = await tab("/liquidations", "sides", data);
    const figure = sides.slice(
      sides.indexOf('<figure class="fchart lqc"'),
      sides.indexOf("</figure>"),
    );

    // 24 hours of 15-minute slots ending in the one holding NOW (12:00), so slot 0 starts at 12:15 the
    // day before, liqAsset's 10:00 bucket is slot 87 and its 11:00 bucket slot 91.
    const payload = JSON.parse(
      figure.match(
        /<script type="application\/json" class="slot-data">([\s\S]*?)<\/script>/,
      )?.[1] ?? "{}",
    );
    expect(payload.kind).toBe("lqc");
    expect(payload.from).toBe(Date.parse("2026-09-11T12:15:00Z"));
    expect(payload.unit).toBe(900_000);
    expect(payload.slots).toHaveLength(96);
    expect(payload.slots[87]).toEqual([7_974_000, 1_516_000, 835]);
    expect(payload.slots[91]).toEqual([0, 12_000, 3]);
    expect(payload.slots.filter((slot: unknown) => slot !== null)).toHaveLength(2);

    // The marks the script moves, hidden until a slot is read, inside the area it listens on.
    expect(figure).toContain('class="fchart-plot lqc-plot slot-area" tabindex="0"');
    expect(figure).toContain('<line class="slot-mark fchart-cursor off"');
    expect(figure).toContain('<rect class="slot-mark slot-band off"');
    // Before a hover the readout is the window: $7.974M less $1.528M of shorts, 838 events.
    expect(figure).toContain(
      '<p class="fchart-read slot-read" aria-live="polite">Last 24h · longs − shorts <b class="lq-ink-l">+$6.4M</b> · longs heavier, 84% · 838 liquidations · hover or tap a bar to read it</p>',
    );
    // The readout replaces the per-bar tooltips; both would show the same figures twice.
    expect(figure).not.toContain("<title>");
    // One copy of the script for the page, outside the live region so a refresh cannot strand it.
    expect(html.match(/window\.airratesSlots = true/g)).toHaveLength(1);
    expect(figure).not.toContain("airratesSlots");
  });

  test("the sides tab follows the addressed asset, not the busiest one", async () => {
    const seen: string[] = [];
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async (options) => {
        seen.push(options.base);
        return liqAsset();
      },
    });
    const html = await (await get("/liquidations/SOL", data)).text();

    expect(seen).toEqual(["SOL"]);
    expect(html).toContain("SOL longs vs shorts");
  });

  test("the sides tab carries an asset picker that keeps the tab and the window", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const html = await (await get("/liquidations/ETH?window=48h", data)).text();
    const sides = html.split('data-tab-panel="sides"')[1].split('data-tab-panel="price"')[0];

    // Every asset the map lists is offered, as a real address rather than a scripted control.
    expect(sides).toContain('href="/liquidations/equity/SNDK?window=48h#sides"');
    // The one being shown is marked, and the fragment keeps a reader on the tab they are reading --
    // without it the server would pick the tab from the address and land them on the priced one.
    expect(sides).toContain('aria-current="page"');
    expect(sides).toContain("#sides");
    // A tradfi ticker keeps its class in the picker, so SNDK the stock is not SNDK the token.
    expect(sides).toContain('class="cls">equity');
  });

  test("the picker on the priced tab points back at the priced tab", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const html = await (await get("/liquidations/ETH", data)).text();
    const price = html.split('data-tab-panel="price"')[1];

    expect(price).toContain('href="/liquidations/equity/SNDK#price"');
  });

  test("with no asset addressed, the window strip stays on the map's own address", async () => {
    const { data } = fakeData({
      liquidationMap: async () => liqMap(),
      liquidationAsset: async () => liqAsset(),
    });
    const html = await (await get("/liquidations", data)).text();

    // The priced tab is primed with ETH, but the address names no asset, so changing the window
    // must not navigate to /liquidations/ETH and land the reader on a different tab.
    expect(html).toContain('href="/liquidations?window=48h"');
    expect(html).not.toContain('href="/liquidations/ETH?window=48h"');
  });

  test("an asset's grid puts the price it died at on the row axis", async () => {
    const { data } = fakeData({ liquidationAsset: async () => liqAsset() });
    const html = await (await get("/liquidations/ETH", data)).text();

    // Bands are 1% of a 2,400 mark by default, so the band at the mark runs 2,400 to 2,424. No
    // currency symbol: formatPrice never asserts one, because these markets settle in USDT, USDC
    // and USD and the page does not know which.
    expect(html).toContain("2,400 – 2,424");
    expect(html).toContain("Banded from");
    // Both venues get a panel, banded off the same anchor.
    expect(html).toContain('data-live="lqa-gate"');
    expect(html).toContain('data-live="lqa-okx"');
  });

  test("the outer rows are catch-alls, so a far-out liquidation is not dropped", async () => {
    const { data } = fakeData({ liquidationAsset: async () => liqAsset() });
    const html = await (await get("/liquidations/ETH", data)).text();

    // The okx cell sits in band 4, the top catch-all: ">= 2,496" at 1% bands off 2,400.
    expect(html).toContain("≥ 2,496");
    expect(html).toContain("$12.0k");
  });

  test("the mark line marks the band the current price sits in", async () => {
    const { data } = fakeData({ liquidationAsset: async () => liqAsset() });
    const html = await (await get("/liquidations/ETH", data)).text();

    expect(html).toContain('class="lq-mark"');
  });

  test("the band width changes what a row means", async () => {
    // The width the DATA LAYER used is what the rows mean, so the fixture reports the one the query
    // was run with -- the page never re-derives it from the query string.
    const { data } = fakeData({ liquidationAsset: async () => liqAsset({ band_pct: 5 }) });
    const html = await (await get("/liquidations/ETH?band=5", data)).text();

    // At 5% off 2,400 the band at the mark runs to 2,520, not 2,424.
    expect(html).toContain("2,400 – 2,520");
    expect(html).not.toContain("2,400 – 2,424");
  });

  test("an asset with no mark says so rather than banding against a guess", async () => {
    const { data } = fakeData({
      liquidationAsset: async () => liqAsset({ mark: null, cells: [], totals: [] }),
    });
    const html = await (await get("/liquidations/ETH", data)).text();

    expect(html).toContain("no price to band liquidations against");
  });

  test("an asset with no live market at all is a 404, not an empty grid", async () => {
    const { data } = fakeData({
      liquidationAsset: async () =>
        liqAsset({ asset_class: null, mark: null, cells: [], totals: [] }),
    });
    const res = await get("/liquidations/NOTATHING", data);

    expect(res.status).toBe(404);
  });

  // Migration 041: MEXC's JPY_USDT quotes the yen in dollars, so in a USDJPY pair its long leg is a
  // short of that contract. Only the pages that say so ask for it; the API never gets such a row.
  test("the screener's payback repays four retail taker fills from the 7-day spread, or says it cannot", async () => {
    const { data } = fakeData({
      screener: async () => [
        // Gate 5 bps + Lighter 0, in and out: 10 bps, repaid at 8.2% a year in 4.45 days.
        pair,
        // No week of settlements: from the spread now, dimmed, 0.10% at 0.5% a year is 73 days.
        { ...pair, asset: "ETH", spread_apr: 0.5, spread_apr_7d: null },
        // A week that paid the wrong way never repays, whatever the spread now.
        { ...pair, asset: "SOL", spread_apr_7d: -3 },
      ],
    });
    const html = await (await get("/screener", data)).text();
    const cells = [...html.matchAll(/<td class="num" title="([^"]*repay[^"]*)">(.*?)<\/td>/g)];
    expect(cells.map((m) => m[2])).toEqual([
      "<span>4</span>",
      '<span class="dim">73</span>',
      '<span class="never">never</span>',
    ]);
    expect(cells[0]?.[1]).toContain("Days of the 7-day spread it takes to repay 10 bps of fees");
    expect(cells[1]?.[1]).toContain("from the spread now");
    expect(html).toContain(">Payback, days</th>");
  });

  test("an FX leg quoted the other way round names its contract's own side, on the pages that ask", async () => {
    const asked: { screener: unknown[]; arbitrage: unknown[] } = { screener: [], arbitrage: [] };
    const fx = {
      ...pair,
      asset: "USDJPY",
      asset_class: "fx" as const,
      long_venue_id: "mexc",
      long_symbol: "JPY_USDT",
      long_apr: -43.8,
      long_inverted: true,
      short_venue_id: "bybit",
      short_symbol: "USDJPYUSDT",
      short_apr: 5,
      short_inverted: false,
      spread_apr: 48.8,
    };
    const { data } = fakeData({
      screener: async (_filters, options) => {
        asked.screener.push(options?.crossFx ?? false);
        return [fx];
      },
      arbitrage: async (_params, pairing) => {
        asked.arbitrage.push(pairing?.crossFx ?? false);
        return [
          gap({
            asset: "USDJPY",
            asset_class: "fx",
            buy_venue_id: "mexc",
            buy_symbol: "JPY_USDT",
            buy_inverted: true,
          }),
        ];
      },
    });

    const screener = await (await get("/screener", data)).text();
    expect(screener).toContain('<span class="leg-inv"');
    expect(screener).toContain("short this contract");
    expect(screener).toContain("JPY_USDT quotes this pair the other way round");
    // The quotable "long X, short Y" sentence would be wrong for this row, so there is none.
    expect(screener).not.toContain("Same coin, two exchanges");
    const arbitrage = await (await get("/arbitrage", data)).text();
    expect(arbitrage).toContain("sell this contract");
    expect(arbitrage).not.toContain("A 269.6 bps gap at the top of the book");

    await get("/v1/screener", data);
    await get("/v1/arbitrage", data);
    expect(asked).toEqual({ screener: [true, false], arbitrage: [true, false] });
  });

  test("the size a gap is good for is a locked column, with no figure anywhere on the page", async () => {
    const { data } = fakeData({ arbitrage: async () => [gap()] });
    const html = await (await get("/arbitrage", data)).text();

    expect(html).toContain("269.6");
    // The column is there, third from last, but each cell is a padlock: the $2.0k thinner side and
    // the $220k deeper one appear nowhere, not in a cell, a title or the hidden share text.
    expect(html).toContain('<td class="num locked" title="Not available yet"><svg class="tf-lock"');
    expect(html).not.toContain("$2.0k");
    expect(html).not.toContain("$220k");
    expect(html).not.toContain("Good for about");
    // Buy/sell are their own classes: reusing long/short would borrow a funding meaning that a
    // price gap does not have.
    expect(html).toContain("buy-leg");
    expect(html).toContain("sell-leg");
    expect(html).toContain("quotable gaps");
  });

  test("each side reads price first, then the venue it was quoted on", async () => {
    const { data } = fakeData({ arbitrage: async () => [gap()] });
    const html = await (await get("/arbitrage", data)).text();

    expect(html).toContain(
      `<th>Asset</th><th class="num" title="Highest bid against lowest ask, across two different exchanges">Gap, bps</th><th class="num" title="The sell price less the buy price, in the asset's own price units">Basis</th><th class="num">Buy price</th><th>Buy at</th><th class="num">Sell price</th><th>Sell at</th><th class="num" title="The smaller of the two resting sizes: what the gap is actually good for">Good for</th><th class="num" title="Exchanges quoting this asset that survived the mark-agreement check">Venues</th><th>Quoted</th>`,
    );
    expect(html).toMatch(
      /<td class="num"><span data-u="buy-price">[^<]+<\/span><\/td>\n<td><div class="leg buy-leg">/,
    );
    expect(html).toMatch(
      /<td class="num"><span data-u="sell-price">[^<]+<\/span><\/td>\n<td><div class="leg sell-leg">/,
    );
    // The profit and per-side size columns are gone.
    expect(html).not.toContain("Net, bps");
    expect(html).not.toContain('data-u="net"');
    expect(html).not.toContain("Ask size");
    expect(html).not.toContain("Bid size");
  });

  test("Chinese labels the locked column 利用量", async () => {
    const { data } = fakeData({ arbitrage: async () => [gap()] });
    const html = await (
      await handleApp(new Request("https://airates.test/arbitrage"), {
        data,
        now: () => NOW,
        locale: "zh",
      })
    ).text();
    expect(html).toContain(">利用量</th>");
    expect(html).toContain('<td class="num locked" title="暂不可用">');
  });

  test("the basis is the sell price less the buy price, in price units", async () => {
    const { data } = fakeData({ arbitrage: async () => [gap()] });
    const html = await (await get("/arbitrage", data)).text();

    // 0.01162 less 0.01131, toned like the gap it restates.
    expect(html).toContain('<span data-u="basis" class="gap-pos">0.00031</span>');
  });

  test("with no net column, the lede says fees and transfers are not counted", async () => {
    const { data } = fakeData({ arbitrage: async () => [gap()] });
    const html = await (await get("/arbitrage", data)).text();

    expect(html).toContain("the taker fees, or the two transfers a real position needs");
  });

  test("the arbitrage bar's filters reach the query, and the picker and panel show them", async () => {
    const asked: unknown[] = [];
    const { data } = fakeData({
      arbitrage: async (params) => {
        asked.push(params);
        return [gap()];
      },
    });
    const html = await (
      await get(
        "/arbitrage?gap=50-200&class=crypto&interval=8h&venues=gate,okx&min_depth=10k",
        data,
      )
    ).text();
    expect(asked[0]).toMatchObject({
      minGapBps: 50,
      maxGapBps: 200,
      assetClass: "crypto",
      intervalHours: 8,
      venueIds: ["gate", "okx"],
      minDepthUsd: 10_000,
    });
    expect(html).toContain('<form class="sx" method="get" action="/arbitrage" data-sx>');
    expect(html).toContain('name="venues" value="gate" data-vp-name="Gate" checked>');
    expect(html).toContain('name="venues" value="bybit" data-vp-name="Bybit">');
    expect(html).toContain(
      '<input type="radio" name="gap" value="50-200" data-default="" checked>',
    );
    expect(html).toContain('name="min_depth" value="10k"');
    // "Default exchanges" drops only the exchange choice and keeps every other filter.
    expect(html).toContain(
      'href="/arbitrage?gap=50-200&amp;min_depth=10000&amp;class=crypto&amp;interval=8h">Default exchanges',
    );
  });

  test("the pickers open on the default set: a quarantined exchange is listed, tagged and unticked", async () => {
    const asked: unknown[] = [];
    const { data } = fakeData({
      arbitrage: async (params) => {
        asked.push(params);
        return [gap()];
      },
    });
    for (const path of ["/arbitrage", "/screener"]) {
      const html = await (await get(path, data)).text();
      // Toobit is quarantined in the catalog; OKX is not.
      expect(html).toContain('name="venues" value="okx" data-vp-name="OKX" checked>');
      expect(html).toMatch(
        /name="venues" value="toobit" data-vp-name="Toobit"><span class="mono">T<\/span><span class="nm">Toobit<\/span><span class="vp-q" title="relays Binance/,
      );
      expect(html).toContain("Quarantined exchanges are left out unless you tick them");
    }
    // No exchange named reaches the query as null, which data.ts ranks as the default set.
    expect(asked[0]).toMatchObject({ venueIds: null });
  });

  test("each leg's ticker carries its badges: its side, and only the context that applies", async () => {
    const { data } = fakeData({
      arbitrage: async () => [
        // The buy leg trades $3k a day and was quoted 90 s before the sell leg, on a HIP-3 dex.
        gap({
          buy_venue_id: "hl-xyz",
          buy_symbol: "xyz:ONE",
          buy_volume_24h_usd: 3_000,
          buy_quoted_at: new Date(NOW - 91_000),
          sell_quoted_at: new Date(NOW - 1_000),
        }),
        // Unknown turnover is not "no liquidity", and 30 s apart is in sync.
        gap({ asset: "TWO", buy_volume_24h_usd: null, buy_quoted_at: new Date(NOW - 31_000) }),
      ],
    });
    const html = await (await get("/arbitrage", data)).text();
    const [one, two] = html.split('<tr data-k="').slice(1, 3);
    expect(one).toContain(
      'xyz:ONE <span class="bdg bdg-long">LONG</span><span class="bdg bdg-noliq"',
    );
    expect(one).toContain(
      '<span class="bdg bdg-offsync" title="Quoted 90s before the price it is compared with">',
    );
    expect(one).toContain('<span class="bdg bdg-viahl"');
    expect(one).toContain('ONE_USDT <span class="bdg bdg-short">SHORT</span></span>');
    expect(two).not.toContain("bdg-noliq");
    expect(two).not.toContain("bdg-offsync");
    expect(html).toContain("What the badges mean");
  });

  test("the quotes page badges its outliers beside the ticker, with the reason", async () => {
    const { data } = fakeData({
      priceQuotes: async () => [
        quote({ venue_id: "gate", best_bid: 0.0113, best_ask: 0.01131 }),
        quote({
          venue_id: "okx",
          venue_symbol: "ONE-USDT-SWAP",
          best_bid: 0.01135,
          best_ask: 0.01136,
        }),
        quote({ venue_id: "bybit", venue_symbol: "ONEUSDT", mark_price: 15.6, mark_agrees: false }),
      ],
    });
    const html = await (await get("/price-pair/ONE", data)).text();
    expect(html).toContain('ONE_USDT <span class="bdg bdg-long">LONG</span>');
    expect(html).toContain('ONE-USDT-SWAP <span class="bdg bdg-short">SHORT</span>');
    expect(html).toMatch(/ONEUSDT <span class="bdg bdg-outlier" title="Marked [0-9.]+× above/);
  });

  test("an arbitrage row opens a strip: every pair for the asset, and this pair's own page", async () => {
    const { data } = fakeData({ arbitrage: async () => [gap()] });
    const html = await (await get("/arbitrage", data)).text();
    // The row, not its asset link, is the target now: a click opens the strip beneath it.
    expect(html).toMatch(
      /<tr data-k="[^"]+" data-arb data-pairs="\/price-pair\/[^"]+" data-best="\/price-pair\/[^"]+\?long=[a-z-]+&amp;short=[a-z-]+"/,
    );
    expect(html).not.toMatch(/<td class="asset"><a [^>]*data-row-link/);
    expect(html).toContain('<template id="arb-more">');
    expect(html).toContain("data-arb-pairs");
  });

  test("the price page's every-pair rows open each pair's convergence page", async () => {
    const { data } = fakeData({
      priceQuotes: async () => [
        quote({ venue_id: "gate", best_bid: 100, best_ask: 100.1 }),
        quote({ venue_id: "okx", best_bid: 100.5, best_ask: 100.6 }),
      ],
    });
    const html = await (await get("/price-pair/BTC", data)).text();
    expect(html).toContain("<div data-pairs-table>");
    expect(html).toContain('href="/price-pair/BTC?long=gate&short=okx" data-row-link>details');
  });

  test("a pair in the address is its convergence page: spread now, costs, history and both legs", async () => {
    const H = 3_600_000;
    const top = Math.floor(NOW / H) * H;
    const history = Array.from({ length: 48 }, (_, i) => [
      {
        venue_id: "gate",
        venue_symbol: "BTC_USDT",
        hour: new Date(top - (47 - i) * H),
        samples: 60,
        price: 100,
      },
      {
        venue_id: "okx",
        venue_symbol: "BTC-USDT-SWAP",
        hour: new Date(top - (47 - i) * H),
        samples: 60,
        price: 100 + (i % 6) * 0.2,
      },
    ]).flat();
    const asked: unknown[] = [];
    const { data } = fakeData({
      priceQuotes: async () => [
        quote({
          venue_id: "gate",
          venue_symbol: "BTC_USDT",
          best_bid: 99.95,
          best_ask: 100.05,
          mark_price: 100,
        }),
        quote({
          venue_id: "okx",
          venue_symbol: "BTC-USDT-SWAP",
          best_bid: 101.45,
          best_ask: 101.55,
          mark_price: 101.5,
        }),
      ],
      priceHistory: async (markets, days) => {
        asked.push({ markets, days });
        return history;
      },
    });
    const html = await (await get("/price-pair/BTC?long=gate&short=okx&w=3d&size=5k", data)).text();
    expect(asked).toEqual([
      {
        markets: [
          { venue_id: "gate", venue_symbol: "BTC_USDT" },
          { venue_id: "okx", venue_symbol: "BTC-USDT-SWAP" },
        ],
        days: 3,
      },
    ]);
    // 101.5 against 100: +1.500%, wider than every hour of the window.
    expect(html).toContain('<p class="pc-big up">+1.500%');
    expect(html).toContain("wider than <b>100</b>% of the last 3D's hours");
    expect(html).toContain("sized at $5.0k a leg");
    expect(html).toContain('<a href="/price-pair/BTC?long=gate&short=okx&size=5000&w=3d"');
    expect(html).toContain(
      '<input type="radio" name="long" value="gate" data-vp-name="Gate" checked>',
    );
    expect(html).toContain('class="fchart pc-chart"');
    expect(html).toContain("Spread statistics");
  });

  test("a pair the history cannot be read for still prices the gap now", async () => {
    const { data } = fakeData({
      priceQuotes: async () => [
        quote({ venue_id: "gate", best_bid: 99.95, best_ask: 100.05, mark_price: 100 }),
        quote({ venue_id: "okx", best_bid: 101.45, best_ask: 101.55, mark_price: 101.5 }),
      ],
      priceHistory: async () => {
        throw new Error("permission denied for table market_price_hourly");
      },
    });
    const res = await get("/price-pair/BTC?long=gate&short=okx", data);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Price history is unavailable right now.");
    expect(html).toContain("+1.500%");
  });

  test("/v1/arbitrage echoes the parsed params and their canonical query", async () => {
    const { data } = fakeData({ arbitrage: async () => [] });
    const res = await get("/v1/arbitrage?min_bps=25&min_depth=10k", data);
    const body = (await res.json()) as {
      params: { minGapBps: number; minDepthUsd: number };
      query: string;
      count: number;
    };

    expect(res.status).toBe(200);
    expect(body.params.minGapBps).toBe(25);
    expect(body.params.minDepthUsd).toBe(10_000);
    expect(body.query).toBe("?min_bps=25&min_depth=10000");
    expect(body.count).toBe(0);
  });

  test("/v1/arbitrage leaves out the size a gap is good for, which is the paid version's", async () => {
    const { data } = fakeData({ arbitrage: async () => [gap()] });
    const body = (await (await get("/v1/arbitrage", data)).json()) as {
      rows: Record<string, unknown>[];
    };
    const [row] = body.rows;

    expect(row?.gap_bps).toBe(269.64);
    expect(row?.buy_price).toBe(0.01131);
    // Neither the thinner side nor the two depths it is the smaller of.
    expect(row).not.toHaveProperty("thinner_depth_usd");
    expect(row).not.toHaveProperty("buy_depth_usd");
    expect(row).not.toHaveProperty("sell_depth_usd");
  });

  test("every page footer links to both status pages, distinctly labelled", async () => {
    const { data } = fakeData();
    const html = await (await get("/", data)).text();
    // Exactly "/probe": the route is an exact match and "/probe/" 404s.
    expect(html).toContain('<a href="/probe">geo-probe</a>');
    expect(html).toContain('<a href="/status">status</a>');
  });

  test("every page footer links to the member area as login, off-origin and in a new tab", async () => {
    const { data } = fakeData();
    const html = await (await get("/", data)).text();
    // The member area is a different subdomain this Worker does not serve, so the href is absolute
    // and carries target/rel. Pinned whole: dropping rel="noopener" on a target="_blank" link hands
    // the opened page a window.opener handle back to ours.
    expect(html).toContain(
      '<a href="https://member.airrates.net/" target="_blank" rel="noopener">login</a>',
    );
    // Reachable from anywhere, as the other footer links are.
    expect(await (await get("/screener", data)).text()).toContain(">login</a>");
  });

  test("every page footer links to the Telegram group, off-origin and in a new tab", async () => {
    const { data } = fakeData();
    for (const path of ["/", "/whales"]) {
      expect(await (await get(path, data)).text()).toContain(
        '<a href="https://t.me/airratesnet" target="_blank" rel="noopener" title="Join the airrates group on Telegram: @airratesnet">telegram</a>',
      );
    }
  });

  const vstatus = (overrides: Partial<VenueStatus> = {}): VenueStatus => ({
    venue_id: "gate",
    name: "Gate",
    type: "cex",
    last_run_at: new Date(NOW - 30_000),
    last_run_ever: new Date(NOW - 30_000),
    last_success_at: new Date(NOW - 30_000),
    duration_ms: 306,
    requests: 2,
    last_run_markets: 970,
    last_error: null,
    runs_24h: 1440,
    failures_24h: 0,
    live_markets: 970,
    freshest: new Date(NOW - 20_000),
    ...overrides,
  });

  test("the liquidation tab lists the feeds we read and the venues that publish nothing", async () => {
    const { data } = fakeData({
      venueStatus: async () => [
        vstatus({ venue_id: "htx:liq", name: "htx:liq", last_error: "connection cycling" }),
      ],
      liquidationFeeds: async () => [
        {
          venue_id: "okx",
          events_24h: 16_513,
          events_1h: 260,
          markets_24h: 412,
          notional_24h: 88_400_000,
          longs_24h: 5_417,
          last_at: new Date(NOW - 30_000),
        },
        {
          venue_id: "aster",
          events_24h: 138,
          events_1h: 0,
          markets_24h: 9,
          notional_24h: 1_200_000,
          longs_24h: 28,
          last_at: new Date(NOW - 9 * 3_600_000),
        },
      ],
    });
    const html = await (await get("/status", data)).text();
    const panel = html.split('data-tab-panel="liquidations"')[1]?.split("</div>")[0] ?? html;

    // A feed delivering now, with its own figures.
    expect(html).toContain('data-k="okx"');
    expect(html).toContain("16,513");
    // 5,417 of 16,513 closed a long.
    expect(html).toContain(">33%<");
    // Nine hours since the last one on a feed that averages one every twelve minutes: quiet, and a
    // quiet feed is not a failing one — the states have to differ or the table says nothing.
    expect(html).toContain("st-quiet");
    // A venue that was probed and publishes nothing is a row, not an omission, and carries why.
    expect(html).toContain("st-none");
    expect(html).toContain("No liquidation channel answers at all");
    // The feed's own run health decides the fault, not the count: htx:liq is cycling.
    expect(html).toContain("st-failing");
    expect(panel).not.toContain('data-k="htx:liq"');
    // And that pseudo-venue is kept out of the collector table, where it would read as an exchange
    // listing no markets.
    expect(html).not.toContain('<tr data-k="htx:liq">');
  });

  test("the whale feeds are not listed as exchanges catalogued but not collected", async () => {
    const never = {
      last_run_ever: null,
      last_run_at: null,
      last_success_at: null,
      live_markets: 0,
    };
    const { data } = fakeData({
      venueStatus: async () => [
        vstatus({ venue_id: "binance:walls", name: "Binance (whale orders)", ...never }),
        vstatus({ venue_id: "binance:trades", name: "Binance (whale trades)", ...never }),
        vstatus({ venue_id: "hyperliquid:walls", name: "Hyperliquid (whale orders)", ...never }),
        vstatus({ venue_id: "txflow", name: "TxFlow", ...never }),
      ],
    });
    const html = await (await get("/status", data)).text();
    // A real exchange without an adapter is still the backlog; the socket feeds that run are not.
    expect(html).toContain("<b>1</b> more exchanges are catalogued");
    expect(html).toContain("TxFlow");
    expect(html).not.toContain("whale orders");
    expect(html).not.toContain("whale trades");
  });

  test("the liquidation tab says the counts are missing when the table cannot be read", async () => {
    const { data } = fakeData({
      liquidationFeeds: async () => Promise.reject(new Error("no table")),
    });
    const response = await get("/status", data);

    // /status is where a reader diagnoses a half-finished deploy, so it must not 503 over one panel.
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("could not be read");
    expect(html).toContain("st-none");
  });

  test("status splits its two sections into tabs, and serves both panels for a reader without JS", async () => {
    const { data } = fakeData();
    const html = await (await get("/status", data)).text();

    // The bar, in the shape the Morpheum component uses.
    expect(html).toContain('data-tabs="status"');
    expect(html).toContain('data-tab="collector"');
    expect(html).toContain('data-tab="verification"');
    expect(html).toContain('class="tab-underline"');
    expect(html).toContain('role="tablist"');

    // Both panels are served, and NEITHER is hidden in the HTML: the script hides the inactive one,
    // so with no JavaScript the page reads exactly as it did before it had tabs.
    expect(html).toContain('data-tab-panel="collector"');
    expect(html).toContain('data-tab-panel="verification"');
    expect(html).not.toContain('data-tab-panel="verification" hidden');
    expect(html).not.toContain('<div class="tabpanel" hidden');

    // The bar has to sit ahead of every live-swapped region: live.ts replaces those about every 30s,
    // and a button inside one would be swapped out under the reader and reset the active tab.
    const bar = html.indexOf('data-tabs="status"');
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeLessThan(html.indexOf('data-live="status-facts"'));
    // The tbody specifically: the masthead carries a data-live="status" of its own, which sits
    // above the bar and is not what this is about.
    expect(bar).toBeLessThan(html.indexOf('<tbody data-live="status">'));
  });

  test("status separates a venue that answers cleanly from one that delivers data", async () => {
    const { data } = fakeData({
      venueStatus: async () => [
        vstatus(),
        // The state that earns the page: no error, running, and zero markets.
        vstatus({
          venue_id: "hl-cash",
          name: "dreamcash",
          type: "hip3",
          live_markets: 0,
          last_run_markets: 0,
        }),
        vstatus({
          venue_id: "okx",
          name: "OKX",
          last_error: "HTTP 429 rate limited",
          failures_24h: 12,
        }),
      ],
    });
    const html = await (await get("/status", data)).text();
    // Scoped to the tbody, NOT the whole page, and anchored on the full opening tag.
    //
    // Two traps here, both hit while writing this. The stylesheet is inlined, so every st-* class
    // name also appears in the CSS and a position check against the whole document measures the
    // order the RULES were written in. And `data-live="status"` is not unique: the masthead's own
    // status line in layout.ts carries it, so splitting on the attribute alone captured the gap
    // between the masthead and the table, which holds no rows at all.
    const rows = html.split('<tbody data-live="status">')[1]?.split("</tbody>")[0] ?? "";

    expect(rows).toContain("st-empty");
    expect(rows).toContain("st-failing");
    expect(rows).toContain("st-live");
    // Problems sort above healthy venues.
    expect(rows.indexOf("st-failing")).toBeLessThan(rows.indexOf("st-live"));
    // The failure count is what separates one blip from a venue that is down.
    expect(rows).toContain("12 of 1440 runs");
    expect(rows).toContain("HTTP 429 rate limited");
    // Cost is readable rather than raw milliseconds.
    expect(rows).toContain("306ms");
  });

  test("planned venues are counted and named, never listed as table rows", async () => {
    const { data } = fakeData({
      venueStatus: async () => [
        vstatus(),
        vstatus({ venue_id: "binance", name: "Binance", last_run_at: null, last_run_ever: null }),
        vstatus({ venue_id: "txflow", name: "TxFlow", last_run_at: null, last_run_ever: null }),
        // Retired in the catalog: its `venues` row survives for the foreign keys, but it is no backlog.
        vstatus({ venue_id: "ethereal", name: "Ethereal", last_run_at: null, last_run_ever: null }),
      ],
    });
    const html = await (await get("/status", data)).text();
    const rows = html.split('<tbody data-live="status">')[1]?.split("</tbody>")[0] ?? "";

    // 41 of 61 catalogued venues are unbuilt; as rows they would bury the ones that can break.
    expect(rows).not.toContain("Binance");
    expect(rows).not.toContain("TxFlow");
    expect(rows).toContain("Gate");
    // Still visible, as a backlog rather than an alarm.
    expect(html).toContain("<b>2</b> more exchanges are catalogued but not collected yet");
    expect(html).toContain("Binance, TxFlow");
    expect(html).not.toContain("Ethereal");
    // One collected venue, so the summary counts what is collected rather than the catalog.
    expect(html).toContain("<b>1</b> collected");
  });

  test("price verification names the collision above the merely rescaled", async () => {
    const { data } = fakeData({
      // The three live shapes from migration 015, in the order they were measured.
      identityChecks: async () => [
        {
          base: "US500",
          asset_class: "index" as const,
          venue_id: "hl-mkts",
          venue_symbol: "mkts:US500",
          anchor_venue_id: "lighter",
          anchor_venue_symbol: "US500",
          verdict: "scale",
          price_ratio: 0.09988,
          scale_exponent: -1,
          return_corr: 0.842,
          ratio_sd: 0.00009,
          shared_minutes: 358,
          member_moves: 226,
          anchor_moves: 263,
          member_oi_usd: 1_600_000,
          anchor_oi_usd: 2_640_000,
          checked_at: new Date(NOW - 60_000),
        },
        {
          base: "PURR",
          asset_class: "crypto" as const,
          venue_id: "gate",
          venue_symbol: "PURR_USDT",
          anchor_venue_id: "hyperliquid",
          anchor_venue_symbol: "PURR",
          verdict: "mismatch",
          price_ratio: 104.64991,
          scale_exponent: null,
          return_corr: 0.005,
          ratio_sd: 0.00176,
          shared_minutes: 360,
          member_moves: 241,
          anchor_moves: 262,
          member_oi_usd: 4_000,
          anchor_oi_usd: 11_140_000,
          checked_at: new Date(NOW - 60_000),
        },
        {
          base: "BYD",
          asset_class: "equity" as const,
          venue_id: "lighter",
          venue_symbol: "BYD",
          anchor_venue_id: "bybit",
          anchor_venue_symbol: "BYDUSDT",
          verdict: "unverified",
          price_ratio: 0.29526,
          scale_exponent: null,
          return_corr: null,
          ratio_sd: 0.0006,
          shared_minutes: 360,
          member_moves: 0,
          anchor_moves: 20,
          member_oi_usd: 1_000,
          anchor_oi_usd: 90_000,
          checked_at: new Date(NOW - 60_000),
        },
      ],
    });
    const html = await (await get("/status", data)).text();
    // Scoped to this table's own tbody, for the reason the venue test above documents: every vd-*
    // class name also appears in the inlined stylesheet, so a position check against the whole
    // document would measure the order the CSS rules were written in, not the order of the rows.
    const rows = html.split('<tbody data-checks="identity">')[1]?.split("</tbody>")[0] ?? "";

    expect(rows).toContain("vd-mismatch");
    expect(rows).toContain("vd-scale");
    expect(rows).toContain("vd-unverified");
    // A collision means two unrelated assets share a ticker, which is worse than a market quoted in
    // different units, so it sorts first however the rows arrive.
    expect(rows.indexOf("vd-mismatch")).toBeLessThan(rows.indexOf("vd-scale"));
    expect(rows.indexOf("vd-scale")).toBeLessThan(rows.indexOf("vd-unverified"));

    // Ratios span nine orders of magnitude and still have to read as numbers.
    expect(rows).toContain("104.650×");
    expect(rows).toContain("0.100×");
    // The anchor travels with the row: which market was the reference is part of the verdict.
    expect(rows).toContain("hyperliquid");

    // A frozen market shows a dash, never 0.00. "Nothing to correlate against" and "does not
    // correlate" are different claims, and only one of them is an accusation.
    expect(rows).toContain('<span class="dim">–</span>');
    expect(rows).toContain("0.84");

    expect(html).toContain("<b>3</b> diverging");
    expect(html).toContain("<b>1</b> mismatch");
  });

  test("status survives a verification table that does not exist yet", async () => {
    // The deploy this protects against: the worker ships before migration 015 has been applied.
    // Collector health IS this page; verification is a section of it. And a 503 here would be the
    // worst possible one, because /status is where a reader goes to diagnose a half-finished deploy.
    const { data } = fakeData({
      venueStatus: async () => [vstatus()],
      identityChecks: async () => {
        throw new Error('relation "market_identity_checks" does not exist');
      },
    });
    const response = await get("/status", data);
    expect(response.status).toBe(200);

    const html = await response.text();
    // The venue table, the thing this page exists for, still renders.
    expect(html).toContain("Gate");
    // And it must NOT claim a clean bill of health it never took.
    expect(html).toContain("Verification has not run yet");
    expect(html).not.toContain("Every market agrees");
  });

  test("status lists every catalogued exchange as unknown when the database cannot be read", async () => {
    // The collector's host reset six times on 2026-10-12, and each time /status -- the page a reader
    // opens to find out what is wrong -- answered with the busy page.
    const down = async () => {
      throw new Error("connection refused");
    };
    const { data } = fakeData({
      overview: down,
      venueStatus: down,
      liquidationFeeds: down,
      identityChecks: down,
    });
    const logs: string[] = [];
    const response = await handleApp(new Request("https://airates.test/status"), {
      data,
      now: () => NOW,
      log: (m) => logs.push(m),
    });
    // Still a 503: the edge cache keeps serving its last good copy where it has one, a crawler comes
    // back later, and nothing stores this as the state of the collector.
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("10");
    expect(logs).toContain("/status: connection refused");

    const html = await response.text();
    expect(html).not.toContain("The data center is getting too busy");
    expect(html).toContain("The collector's database could not be read just now");

    // One row per exchange the site catalogues, from the Worker's own copy of the list.
    const listed = VENUES.filter((v) => !v.aliasOf && !v.retired);
    const table = html.slice(html.indexOf('<tbody data-live="status">'));
    const rows = table.slice(0, table.indexOf("</tbody>"));
    expect(rows.match(/<tr data-k=/g)?.length).toBe(listed.length);
    expect(rows.match(/class="st st-unknown"/g)?.length).toBe(listed.length);
    for (const venue of listed) expect(rows).toContain(`<tr data-k="${venue.id}">`);
    expect(html).toContain(`<b>${listed.length}</b> catalogued`);

    // Nothing unread is reported as a finding, good or bad.
    expect(html).not.toContain("Every collected exchange is live and current");
    expect(html).not.toContain("Verification has not run yet");
    expect(html).not.toContain('class="st st-silent"');
    expect(html).not.toContain("failed runs of");
    // A measured verdict on a venue with no liquidation feed was never read from the database.
    expect(html).toContain('class="st st-none"');
  });

  test("status goes back to the collector's own rows once the database answers", async () => {
    const { data } = fakeData({ venueStatus: async () => [vstatus()] });
    const html = await (await get("/status", data)).text();
    expect(html).not.toContain('data-live="status-outage"');
    expect(html).not.toContain('class="st st-unknown"');
    expect(html).toContain("<b>1</b> collected");
  });

  test("price verification says so plainly when every market agrees", async () => {
    const { data } = fakeData({ identityChecks: async () => [] });
    const html = await (await get("/status", data)).text();
    expect(html).toContain("Every market agrees with the deepest market in its asset pool");
    expect(html).not.toContain('<tbody data-checks="identity">');
  });

  test("/v1/status returns every venue as JSON", async () => {
    const { data } = fakeData({ venueStatus: async () => [vstatus()] });
    const body = (await (await get("/v1/status", data)).json()) as { count: number };
    expect(body.count).toBe(1);
  });

  test("a positive quoted gap is green, and a negative or zero one is not", async () => {
    const { data } = fakeData({
      arbitrage: async () => [
        gap(),
        gap({ asset: "TWO", gap_bps: -3.2 }),
        gap({ asset: "THREE", gap_bps: 0.04 }),
      ],
    });
    const html = await (await get("/arbitrage", data)).text();
    expect(html).toContain('<span data-u="gap" class="gap-pos">269.6</span>');
    expect(html).toContain('<span data-u="gap">−3.2</span>');
    expect(html).toContain('<span data-u="gap">0.0</span>');
  });

  test("an empty table explains that most assets quote nothing", async () => {
    const { data } = fakeData({ arbitrage: async () => [] });
    const html = await (await get("/arbitrage", data)).text();
    expect(html).toContain("No asset quotes a gap this wide right now");
  });

  /** Two venues that agree, plus one marked 1375x out -- the KR200 shape. */
  const quote = (overrides: Partial<PriceQuote> = {}): PriceQuote => ({
    asset_class: "crypto" as const,
    venue_id: "gate",
    venue_symbol: "ONE_USDT",
    volume_24h_usd: null,
    best_bid: 0.01131,
    best_ask: 0.01133,
    best_bid_size_usd: 50_000,
    best_ask_size_usd: 20_000,
    mark_price: 0.01132,
    anchor_mark: 0.01132,
    mark_agrees: true,
    observed_at: new Date(NOW - 20_000),
    quotes_at: new Date(NOW - 2_000),
    ...overrides,
  });

  test("price-pair marks the best bid and ask and quotes the gap between them", async () => {
    const { data } = fakeData({
      priceQuotes: async () => [
        quote(),
        quote({
          venue_id: "bybit",
          venue_symbol: "ONEUSDT",
          best_bid: 0.01162,
          best_ask: 0.01164,
          best_bid_size_usd: 80_000,
          best_ask_size_usd: 90_000,
        }),
      ],
    });
    const html = await (await get("/price-pair/ONE", data)).text();

    expect(html).toContain("Gate");
    expect(html).toContain("Bybit");
    // Buy the cheapest ask (Gate, 0.01133), sell the highest bid (Bybit, 0.01162): 256.0 bps.
    expect(html).toContain("256.0 bps");
    // Good for the thinner of Gate's ask ($20k) and Bybit's bid ($80k).
    expect(html).toContain("$20.0k");
    expect(html).toContain("quote at the size shown");
  });

  test("a mismatched instrument is shown with its reason, not silently dropped", async () => {
    const { data } = fakeData({
      priceQuotes: async () => [
        quote(),
        quote({ venue_id: "bybit", venue_symbol: "ONEUSDT", best_bid: 0.01162, best_ask: 0.01164 }),
        // 1375x out: the KR200 case that would otherwise publish a 13,660,780 bps "gap".
        quote({
          venue_id: "okx",
          venue_symbol: "ONE-USDT-SWAP",
          best_bid: 15.5,
          best_ask: 15.6,
          mark_price: 15.565,
          mark_agrees: false,
        }),
      ],
    });
    const html = await (await get("/price-pair/ONE", data)).text();

    // Present, but dimmed and explained -- the list page hides it, the detail page teaches it.
    expect(html).toContain("OKX");
    expect(html).toContain("left out of the gap");
    expect(html).toContain("1375.0×");
    // The mismatch must NOT set the price: the gap is still the honest 256 bps.
    expect(html).toContain("256.0 bps");
  });

  test("every direction is listed, and the widest gap is not the deepest", async () => {
    const { data } = fakeData({
      priceQuotes: async () => [
        // Cheapest ask, but only $2k rests on it.
        quote({ best_ask_size_usd: 2_000 }),
        quote({
          venue_id: "bybit",
          venue_symbol: "ONEUSDT",
          best_bid: 0.01162,
          best_ask: 0.01164,
          best_bid_size_usd: 80_000,
          best_ask_size_usd: 90_000,
        }),
        quote({
          venue_id: "okx",
          venue_symbol: "ONE-USDT-SWAP",
          best_bid: 0.0115,
          best_ask: 0.01152,
          best_bid_size_usd: 5_000,
          best_ask_size_usd: 7_000,
        }),
        // Excluded by the guard: it must not appear in ANY direction.
        quote({
          venue_id: "gate",
          venue_symbol: "ONE-MISMATCH",
          best_bid: 15.5,
          best_ask: 15.6,
          mark_price: 15.565,
          mark_agrees: false,
        }),
      ],
    });
    const html = await (await get("/price-pair/ONE", data)).text();

    expect(html).toContain('data-live="pp-pairs"');
    // Three agreeing venues give six ordered directions.
    const pairRows = html.split('data-live="pp-pairs"')[1]?.split("</tbody>")[0] ?? "";
    expect(pairRows.match(/<tr data-k="pair:/g)).toHaveLength(6);
    // Widest: buy Gate at 0.01133, sell Bybit at 0.01162 -- but good for only $2.0k.
    expect(pairRows).toContain("256.0");
    expect(pairRows).toContain("$2.0k");
    // A narrower direction rests three and a half times more: OKX -> Bybit at 86.8 bps, $7.0k.
    expect(pairRows).toContain("86.8");
    expect(pairRows).toContain("$7.0k");
    // Losing directions are shown rather than hidden, with the site's minus sign.
    expect(pairRows).toContain("−283.5");
    // The mismatched instrument never sets a price in any direction.
    expect(pairRows).not.toContain("ONE-MISMATCH");
  });

  test("price-pair 404s for an asset nobody quotes", async () => {
    const { data } = fakeData({ priceQuotes: async () => [] });
    const res = await get("/price-pair/NOSUCH", data);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("No exchange is quoting a NOSUCH book right now");
  });

  test("/v1/price-pair returns the quotes as JSON", async () => {
    const { data } = fakeData({ priceQuotes: async () => [quote()] });
    const body = (await (await get("/v1/price-pair/one", data)).json()) as {
      asset: string;
      count: number;
    };
    // The path segment is uppercased before it reaches the query, as the asset page does.
    expect(body.asset).toBe("ONE");
    expect(body.count).toBe(1);
  });

  test("the verified ranking says so before the first nightly run", async () => {
    const { data } = fakeData();
    const html = await (await get("/", data)).text();
    expect(html).toContain("No replay yet");
    expect(html).not.toContain("replayed 20");
  });

  test("the homepage survives the verified ranking being unavailable", async () => {
    // The worker can ship before the collector has applied migration 011, so the table may not
    // exist yet. An optional section must not take down a page whose substance is the spreads
    // table -- but the failure is logged rather than swallowed.
    const logged: string[] = [];
    const { data } = fakeData({
      verifiedPairs: async () => {
        throw new Error('relation "market_pair_backtests" does not exist');
      },
    });
    const res = await handleApp(new Request("https://airates.test/"), {
      data,
      now: () => NOW,
      log: (message: string) => logged.push(message),
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Widest spreads");
    expect(html).toContain("No replay yet");
    expect(logged.join("\n")).toContain("verified ranking unavailable");
    expect(logged.join("\n")).toContain("market_pair_backtests");
  });

  test("the homepage still fails loudly when its own data is missing", async () => {
    // The counterpart to the test above: fail-soft is scoped to the optional section, so a broken
    // screener query must still surface rather than rendering a page that looks fine and is empty.
    const { data } = fakeData({
      screener: async () => {
        throw new Error("connection terminated");
      },
    });
    const res = await handleApp(new Request("https://airates.test/"), { data, now: () => NOW });
    expect(res.status).toBe(503);
  });

  test("screener passes parsed filters through and reflects them in the form", async () => {
    const { data, calls } = fakeData();
    const html = await (await get("/screener?min_oi=1m&types=cex&limit=50", data)).text();

    expect(calls.screener[0]).toMatchObject({
      minOpenInterestUsd: 1_000_000,
      venueTypes: ["cex"],
      limit: 50,
    });
    expect(html).toContain('name="min_oi" value="1m"');
    // The exchange picker ticks the CEXs the address kept, and none of the rest.
    expect(html).toContain('name="venues" value="binance" data-vp-name="Binance" checked>');
    expect(html).toContain('name="venues" value="hyperliquid" data-vp-name="Hyperliquid">');
    expect(html).toContain(
      '<input type="radio" name="limit" value="50" data-default="100" checked>',
    );
  });

  test("the bar's period and unit restate the table: 30-day spreads per 8 hours, payback on 30 days", async () => {
    const { data } = fakeData({
      screener: async () => [{ ...pair, spread_apr_30d: 10.95, spread_apr_60d: null }],
    });
    const html = await (await get("/screener?sort=settled_30d&unit=8h", data)).text();
    // 11.5% a year is 0.0105% an 8-hour period; 10.95% is 0.0100%.
    expect(html).toContain('<td class="num spread">+0.0105%</td>');
    expect(html).toContain('<td class="num">+0.0100%</td>');
    expect(html).toMatch(/>30D per 8H<\/a><\/th>/);
    // Gate 5 bps + Lighter 0, in and out, at 10.95% a year: 3.3 days.
    expect(html).toContain("Days of the 30-day spread it takes to repay 10 bps of fees");
    expect(html).toContain(
      '<a href="/screener?unit=8h&amp;sort=settled_30d" aria-current="true">30D</a>',
    );
    expect(html).toMatch(/<a href="\/screener\?sort=settled_30d" ?>APR<\/a>/);
  });

  test("each leg carries its steadiness dot, hollow where it has no month to score", async () => {
    const { data } = fakeData({
      screener: async () => [{ ...pair, long_stability: 0.82, short_stability: null }],
    });
    const html = await (await get("/screener", data)).text();
    expect(html).toContain('<i class="sd sd-steady" title="Funding held its direction on 30 of');
    expect(html).toContain('<i class="sd sd-none" title="No settled funding to score yet"></i>');
  });

  test("screener column headers sort, and the active one says which", async () => {
    const { data, calls } = fakeData();
    const html = await (await get("/screener?sort=venues", data)).text();

    expect(calls.screener[0]?.sort).toBe("venues");
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain('href="/screener?sort=settled_7d"');
    // Linking back to the default sort leaves the query clean rather than pinning ?sort=spread,
    // so the canonical URL and the edge cache key stay the same as an unsorted visit.
    expect(html).toContain('href="/screener"');
  });

  test("stability renders the weaker leg, with the day count as its title", async () => {
    const { data, calls } = fakeData();
    const html = await (await get("/screener?sort=stability", data)).text();

    expect(calls.screener[0]?.sort).toBe("stability");
    // 0.64 is the short (weaker) leg. Only pair_stability is rendered today, so the two negatives
    // guard against a later change that starts printing per-leg scores or an average of them.
    expect(html).toContain(">0.64<");
    expect(html).not.toContain(">0.82<");
    expect(html).not.toContain(">0.73<");
    // Not a percentage: the scale tops out at 0.88, so a "%" would invite reading it as a rate.
    expect(html).not.toContain("0.64%");
    expect(html).toContain("24 of its charging days");
  });

  test("the homepage teaser keeps plain headers rather than sort links", async () => {
    const { data } = fakeData();
    const html = await (await get("/", data)).text();
    // Re-sorting a fixed top-twelve means nothing, and a link there would navigate off the page.
    // Matched on the full attribute: the bare word also appears in the inlined stylesheet.
    expect(html).not.toContain('aria-sort="descending"');
    expect(html).toMatch(/<th class="num" title="The funding spread now[^"]*">Now<\/th>/);
  });

  test("long tables stick their header to the page; the homepage teaser does not", async () => {
    const { data } = fakeData();
    // One page scroll for the screener and the exchange page: the header sticks, no inner box.
    expect(await (await get("/screener", data)).text()).toContain('<div class="sheet-wrap stick">');
    expect(await (await get("/markets/exchange/okx", data)).text()).toContain(
      '<div class="sheet-wrap stick">',
    );
    // Twelve rows have nothing to stick through.
    const home = await (await get("/", data)).text();
    expect(home).not.toContain("sheet-wrap stick");
    // The masthead's real height is measured, so the sticky offset follows a wrapped masthead.
    expect(home).toContain('setProperty("--mast"');
  });

  test("screener shows an empty state", async () => {
    const { data } = fakeData({ screener: async () => [] });
    expect(await (await get("/screener", data)).text()).toContain("No pairs match these filters");
  });

  test("exchange and asset pages, with 404s for unknown ones", async () => {
    const { data } = fakeData();
    expect((await get("/markets", data)).status).toBe(200);
    const okx = await get("/markets/exchange/okx", data);
    expect(okx.status).toBe(200);
    const okxHtml = await okx.text();
    expect(okxHtml).toContain("<h1>OKX</h1>");
    // Both pages once rendered without the overview, so their status line said nothing had reported.
    expect(okxHtml).toContain("4,286 markets");
    expect(okxHtml).not.toContain("no venue has reported");
    expect((await get("/markets/exchange/nope", data)).status).toBe(404);

    const btc = await get("/markets/asset/btc", data);
    expect(btc.status).toBe(200);
    const btcHtml = await btc.text();
    expect(btcHtml).toContain("Best pair: long on Gate");
    expect(btcHtml).toContain("4,286 markets");
    expect(btcHtml).not.toContain("no venue has reported");

    // Stability and momentum are per market, which is this page's grain. Momentum carries an
    // arrow rather than a colour: aprTone means "who pays" everywhere else, and a market fading
    // from +200% to +150% has negative momentum while still paying shorts.
    const withStats = await (await get("/markets/asset/BTC", data)).text();
    expect(withStats).toContain("0.82");
    expect(withStats).toContain("30 charging days in the last 30");
    expect(withStats).toContain("↓</span> 2.8");
    expect(withStats).toContain(">30d trend</th>");
    // Not tinted long/short, which would invert the site's colour meaning.
    expect(withStats).not.toContain('class="longs-paid">↓');
    expect((await get("/markets/asset/DOGEX", data)).status).toBe(404);
    expect((await get("/no/such/page", data)).status).toBe(404);
  });

  test("escapes data from the database", async () => {
    const { data } = fakeData({
      screener: async () => [{ ...pair, asset: "<script>", long_symbol: '"><img>' }],
    });
    const html = await (await get("/", data)).text();
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain('"><img>');
    expect(html).toContain("&lt;script&gt;");
  });

  test("pair page runs the backtest and states what it excludes", async () => {
    const { data } = fakeData({
      dailyFunding: async () => [
        ...dailied("gate", "BTC_USDT", -0.0001),
        ...dailied("okx", "BTC-USDT-SWAP", 0.0001),
      ],
    });
    const res = await get("/pair/BTC?long=gate&short=okx&size=10k&days=7", data);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    // Both legs are paid $3, so the headline is exact to the cent.
    expect(html).toContain('<p class="headline up">$6.00</p>');
    expect(html).toContain("Long Gate");
    expect(html).toContain("Short OKX");
    // Sizes the reader picked from a menu carry no cents. Neither venue publishes a leverage here,
    // so the pair is priced unleveraged rather than borrowing a figure from somewhere else.
    expect(html).toContain("capital <b>$20,000</b> across both legs, unleveraged");
    expect(html).toContain("kept at $10,000 per leg");
    // Three 8-hourly settlements do not fill a 7-day window, and the page says so.
    expect(html).toContain("of the 7 days asked for have stored settlements");
    expect(html).toContain("Trading fees are excluded because none were given");
    // Each leg pays $1 a settlement: two on 2026-09-11 across both legs make $4, one each on the
    // 12th makes $2, and cumulative funding only ever rises.
    expect(html).toContain("best day <b>$4.00</b> Sep 11");
    expect(html).toContain("worst day <b>$2.00</b> Sep 12");
    expect(html).toContain("max drawdown <b>$0.00</b>");
    // Both legs set their rate now against their own average over the window.
    expect(html.match(/, 7d avg <span/g)).toHaveLength(2);
    // Entry and exit at the books is the price-pair page's question, one link away.
    expect(html).toContain('href="/price-pair/BTC"');
    // Sharing posts the page's own figure, before fees since none were entered, and links back with
    // where the visit came from.
    expect(html).toContain('<a class="btn" href="https://x.com/intent/post?text=');
    expect(html).toContain(
      encodeURIComponent("$6.00 on $10,000 per leg over the last 7 days, before fees"),
    );
    expect(html).toContain(
      `url=${encodeURIComponent("https://airates.test/pair/BTC?long=gate&short=okx&days=7&ref=x")}`,
    );
  });

  test("pair capital is margined at the lower of the two venues' leverage", async () => {
    const legs = (long: number | null, short: number | null) => ({
      asset: async () => [
        market({ venue_id: "gate", venue_symbol: "BTC_USDT", apr: -0.55, max_leverage: long }),
        market({ max_leverage: short }),
      ],
      dailyFunding: async () => [
        ...dailied("gate", "BTC_USDT", -0.0001),
        ...dailied("okx", "BTC-USDT-SWAP", 0.0001),
      ],
    });
    const capital = async (long: number | null, short: number | null, size = "10k") => {
      const res = await get(
        `/pair/BTC?long=gate&short=okx&size=${size}&days=7`,
        fakeData(legs(long, short)).data,
      );
      return (await res.text()).match(/capital [^<]*<b>[^<]*<\/b>[^<]*/)?.[0];
    };

    // 50x and 20x: the pair can only run at 20x, so $20,000 of notional needs $1,000 of margin.
    expect(await capital(50, 20)).toBe(
      "capital <b>$1,000</b> across both legs at 20× (small size)",
    );
    // A venue that publishes nothing drops the whole pair to unleveraged, rather than assuming the
    // partner's 50x applies to a leg we know nothing about.
    expect(await capital(50, null)).toBe("capital <b>$20,000</b> across both legs, unleveraged");
    // $1M a leg is far past where any venue's headline leverage holds, so the figure is a floor:
    // quoting $100,000 flat would understate what the position actually needs.
    expect(await capital(50, 20, "1m")).toBe(
      "capital at least <b>$100,000</b> across both legs — 20× is the small-size maximum",
    );
  });

  test("pair capital comes from the venues' own ladders when both legs have one", async () => {
    const band = (
      venue_id: string,
      venue_symbol: string,
      tier: number,
      lower: number,
      upper: number | null,
      imr: number,
    ) => ({
      venue_id,
      venue_symbol,
      tier,
      lower_notional_usd: lower,
      upper_notional_usd: upper,
      imr,
      mmr: imr / 2,
      max_leverage: 1 / imr,
    });
    const ladders = [
      band("gate", "BTC_USDT", 1, 0, 300_000, 0.01),
      band("gate", "BTC_USDT", 2, 300_000, 1_000_000, 0.02),
      band("okx", "BTC-USDT-SWAP", 1, 0, 300_000, 0.01),
      band("okx", "BTC-USDT-SWAP", 2, 300_000, 1_000_000, 0.05),
    ];
    const line = async (size: string) => {
      const { data } = fakeData({
        leverageTiers: async () => ladders,
        dailyFunding: async () => [
          ...dailied("gate", "BTC_USDT", -0.0001),
          ...dailied("okx", "BTC-USDT-SWAP", 0.0001),
        ],
      });
      const res = await get(`/pair/BTC?long=gate&short=okx&size=${size}&days=7`, data);
      return (await res.text()).match(/capital [^<]*<b>[^<]*<\/b>[^<]*/)?.[0];
    };

    // $10k a leg sits in tier 1 on both sides: 10,000 x (0.01 + 0.01) = $200. No "(small size)"
    // caveat, because this came from the venues' own bands for exactly this size.
    expect(await line("10k")).toBe("capital <b>$200</b> across both legs at 100×");
    // $500k a leg lands in tier 2 on both, where the ladders diverge: gate wants 2% and okx 5%,
    // so 500,000 x 0.07 = $35,000. Neither venue's headline number would have produced this.
    expect(await line("500k")).toBe("capital <b>$35,000</b> across both legs at 28.6×");
    // $1M a leg is past the top of both ladders, so the position cannot be opened at all. Rounding
    // down into the top band would quote capital for a trade the venue would refuse.
    expect(await line("1m")).toBe(
      "capital <b>–</b> — Gate will not open a position above $1,000,000 on BTC_USDT",
    );
  });

  test("an unscored market shows a dash rather than a flattering number", async () => {
    const { data } = fakeData({
      asset: async () => [
        market({ venue_id: "gate", stability_30d: null, stability_days: null, momentum_30d: null }),
        market({ venue_id: "okx", stability_30d: 0.5, stability_days: 3, momentum_30d: 0 }),
      ],
    });
    const html = await (await get("/markets/asset/BTC", data)).text();

    // 85 markets genuinely charge nothing; a naive sign test would score them a perfect 1.00.
    expect(html).toContain('<span class="dim">–</span>');
    // Exactly zero momentum is "flat", not an arrow pointing nowhere.
    expect(html).toContain('<span class="dim">flat</span>');
    // A thin window still says how thin it is.
    expect(html).toContain("3 charging days in the last 30");
  });

  test("rates renders the matrix, dashes absent markets and escapes asset names", async () => {
    const hcell = (
      base: string,
      venue_id: string,
      apr: number,
      apr_60d: number | null,
      openInterest: number,
      assetOi: number,
    ): HeatmapCell => ({
      asset_class: "crypto" as const,
      base,
      venue_id,
      venue_symbol: `${base}-${venue_id}`,
      apr,
      apr_7d: null,
      apr_30d: null,
      apr_60d,
      open_interest_usd: openInterest,
      asset_oi_usd: assetOi,
    });

    const { data } = fakeData({
      heatmap: async () => [
        hcell("BTC", "gate", 12, 3, 5_000, 9_000),
        hcell("BTC", "bybit", -4, -1, 4_000, 9_000),
        // Only on gate, so its bybit column has to render as absent, not as zero.
        hcell("<script>", "gate", 1, null, 1_000, 1_000),
      ],
    });

    const html = await (await get("/rates", data)).text();
    expect(html).toContain('<table class="heat">');
    expect(html).toContain('<td class="none" data-c="bybit">–</td>');

    // The row's own spread: cheapest to hold long (bybit at -4) against richest to hold short
    // (gate at +12), so 16 points apart. Swapping the legs would be invisible on the page.
    expect(html).toContain("long=bybit&short=gate");
    expect(html).toContain("+16.0%");

    // Asset names reach the page from the database and are escaped like everything else.
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");

    // Nothing to page to, so "next" is inert rather than a link into an empty page.
    expect(html).toContain(`<span class="dim">next ${icon("right")}</span>`);
  });

  test("rates timeframe switches which stored column the cells read", async () => {
    const hcell = (base: string, venue_id: string, apr: number, apr_60d: number | null) => ({
      asset_class: "crypto" as const,
      base,
      venue_id,
      venue_symbol: `${base}-${venue_id}`,
      apr,
      apr_7d: null,
      apr_30d: null,
      apr_60d,
      open_interest_usd: 1_000,
      asset_oi_usd: 2_000,
    });
    const { data } = fakeData({
      heatmap: async () => [hcell("BTC", "gate", 12, 3), hcell("BTC", "bybit", -4, -1)],
    });

    const live = await (await get("/rates", data)).text();
    expect(live).toContain("+12.0%");

    const long = await (await get("/rates?tf=60d", data)).text();
    expect(long).toContain('aria-current="true">60d</a>');
    expect(long).toContain("+3.00%");
    // The live column must not leak into the 60d view.
    expect(long).not.toContain("+12.0%");
  });

  describe("rates gamma exposure tab", () => {
    const gammaRow = (scope: string) => ({
      ...NO_GREEKS,
      scope,
      computed_at: new Date(NOW - 2 * 60_000),
      source: "deribit",
      unit: "USD",
      spot: 2_400,
      options: 660,
      expiries: 12,
      first_expiry: new Date(NOW + 20 * 3600_000),
      last_expiry: new Date(NOW + 300 * 86_400_000),
      next_expiry: new Date(NOW + 20 * 3600_000),
      call_oi: 974_124,
      put_oi: 510_741,
      call_gex_usd: 26.1e6,
      put_gex_usd: -23.5e6,
      net_gex_usd: 2.6e6,
      flip_price: 2_327,
      call_wall: 2_500,
      put_wall: 2_300,
    });
    const gammaSource = (calls: { currency: string; scope: string }[]) =>
      fakeData({
        gamma: async (options) => {
          calls.push(options);
          const book = (currency: string) => ({ ...gammaRow("all"), currency });
          return {
            currency: options.currency,
            books: [book("BTC"), book("ETH"), { ...book("HSI"), source: "hkex", unit: "HKD" }],
            scopes: [gammaRow("all"), gammaRow("next")],
            exposure: gammaRow(options.scope),
            strikes: [
              {
                ...NO_GREEKS,
                strike: 2_300,
                call_oi: 1_000,
                put_oi: 9_000,
                call_gex_usd: 1.7e6,
                put_gex_usd: -5.2e6,
              },
              {
                ...NO_GREEKS,
                strike: 2_500,
                call_oi: 9_000,
                put_oi: 2_000,
                call_gex_usd: 2.6e6,
                put_gex_usd: -1.5e6,
              },
            ],
            curve: [
              { price: 2_200, net_gex_usd: -3e6 },
              { price: 2_600, net_gex_usd: 9e6 },
            ],
            expiries: [],
            bands: [],
          };
        },
      }).data;

    test("the grid's page carries the tab as a placeholder it does not read", async () => {
      const calls: { currency: string; scope: string }[] = [];
      const html = await (await get("/rates", gammaSource(calls))).text();
      expect(html).toContain('data-tab="gamma"');
      expect(html).toContain("Gamma Exposure");
      expect(html).toContain('class="btn-tab active" data-tab="rates"');
      expect(html).toContain('data-lazy="/rates?gex=BTC&amp;panel=gamma"');
      // The tab bar sits ahead of both panels, so none of the regions live.ts swaps holds it.
      const bar = html.indexOf('data-tabs="rates"');
      expect(bar).toBeGreaterThan(html.indexOf("</h1>"));
      expect(bar).toBeLessThan(html.indexOf('id="panel-rates-rates"'));
      expect(calls).toEqual([]);
    });

    test("its own address returns a bare fragment for the asked book and expiries", async () => {
      const calls: { currency: string; scope: string }[] = [];
      const res = await get("/rates?panel=gamma&gex=eth&gexp=next", gammaSource(calls));
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(calls).toEqual([{ currency: "ETH", scope: "next" }]);
      expect(html.startsWith('<div class="lazy-body"')).toBe(true);
      expect(html).not.toContain("<html");
      expect(html).toContain('"kind":"gex"');
      expect(html).toContain(
        'href="/rates?gex=ETH&amp;gexp=next#gamma" data-gx-swap aria-current="true">',
      );
      // Every stored book in the picker, the asked one marked.
      expect(html).toContain('class="wh-pick-row on" href="/rates?gex=ETH&amp;gexp=next#gamma"');
      expect(html).toContain('href="/rates?gex=HSI&amp;gexp=next#gamma" data-gx-swap');
    });

    test("an address naming its choices opens the page on the tab, filled, keeping the grid's", async () => {
      const calls: { currency: string; scope: string }[] = [];
      const html = await (await get("/rates?tf=7d&gex=ETH&gexp=7d", gammaSource(calls))).text();
      expect(calls).toEqual([{ currency: "ETH", scope: "7d" }]);
      expect(html).toContain('class="btn-tab active" data-tab="gamma"');
      expect(html).not.toContain("panel=gamma");
      expect(html).toContain('href="/rates?tf=7d&amp;gex=BTC&amp;gexp=7d#gamma" data-gx-swap');
      expect(html).toContain("<script>(() => {\n  const rows = (pick)");
      // Any ticker-shaped book is asked for, since the collector may store it; anything else is BTC.
      const odd: { currency: string; scope: string }[] = [];
      await get("/rates?gex=hstech&gexp=99d", gammaSource(odd));
      await get("/rates?gex=%3Cb%3E&gexp=7d", gammaSource(odd));
      await get("/rates?gex=TOOLONGATICKER", gammaSource(odd));
      expect(odd).toEqual([
        { currency: "HSTECH", scope: "all" },
        { currency: "BTC", scope: "7d" },
        { currency: "BTC", scope: "all" },
      ]);
    });

    test("a failed read says so in the tab and leaves the grid standing", async () => {
      const { data } = fakeData({
        gamma: async () => {
          throw new Error('relation "gamma_exposure" does not exist');
        },
      });
      const tab = await get("/rates?panel=gamma", data);
      expect(tab.status).toBe(200);
      expect(await tab.text()).toContain("The options data could not be read right now.");
      const page = await get("/rates?gex=BTC", data);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("The options data could not be read right now.");
    });

    test("Delta, Vega and Theta: three lazy tabs, each a fragment of the asked book and expiries", async () => {
      const calls: { currency: string; scope: string }[] = [];
      const html = await (await get("/rates", gammaSource(calls))).text();
      for (const greek of ["delta", "vega", "theta"]) {
        expect(html).toContain(`id="tab-rates-${greek}"`);
        expect(html).toContain(`data-lazy="/rates?gex=BTC&amp;panel=${greek}"`);
      }
      // After Gamma Exposure, before IV Walls.
      expect(html.indexOf('id="tab-rates-gamma"')).toBeLessThan(
        html.indexOf('id="tab-rates-delta"'),
      );
      expect(html.indexOf('id="tab-rates-theta"')).toBeLessThan(
        html.indexOf('id="tab-rates-ivwalls"'),
      );
      expect(calls).toEqual([]);
      for (const greek of ["delta", "vega", "theta"]) {
        const res = await get(`/rates?panel=${greek}&gex=eth&gexp=next`, gammaSource(calls));
        const tab = await res.text();
        expect(res.status).toBe(200);
        expect(tab.startsWith('<div class="lazy-body"')).toBe(true);
        expect(tab).toContain(
          `class="wh-pick-row on" href="/rates?gex=ETH&amp;gexp=next#${greek}"`,
        );
      }
      expect(calls).toEqual([
        { currency: "ETH", scope: "next" },
        { currency: "ETH", scope: "next" },
        { currency: "ETH", scope: "next" },
      ]);
    });

    test("IV Walls and Ceiling & Floor: two lazy tabs, each read for its own panel with the book picked", async () => {
      const calls: string[] = [];
      const { data } = fakeData({
        levels: async ({ currency }) => {
          calls.push(currency);
          throw new Error('relation "gamma_wall_days" does not exist');
        },
      });
      const html = await (await get("/rates?gex=SPX", data)).text();
      expect(html).toContain('id="tab-rates-ivwalls"');
      expect(html).toContain('id="tab-rates-levels"');
      expect(html).toContain('data-lazy="/rates?gex=SPX&amp;panel=ivwalls"');
      expect(html).toContain('data-lazy="/rates?gex=SPX&amp;panel=levels"');
      // The page itself reads neither: only the tab's own address does, and a failed read says so.
      expect(calls).toEqual([]);
      for (const panel of ["ivwalls", "levels"]) {
        const tab = await get(`/rates?panel=${panel}&gex=spx`, data);
        expect(tab.status).toBe(200);
        expect(await tab.text()).toContain("The options data could not be read right now.");
      }
      expect(calls).toEqual(["SPX", "SPX"]);
    });
  });

  describe("exchanges page grades", () => {
    const at = new Date(NOW - 3 * 86_400_000);
    const book = (
      venue_id: string,
      base: string,
      slip10: number,
      slip100: number | null,
      near: number,
    ) => ({
      venue_id,
      base,
      samples: 400,
      first_at: at,
      last_at: new Date(NOW - 600_000),
      spread_bps: 0.2,
      slip_10k_bps: slip10,
      slip_100k_bps: slip100,
      unfilled_100k: slip100 === null ? 1 : 0,
      depth_usd: near * 4,
      depth_near_usd: near,
      open_interest_usd: 1e9,
      reach_pct: 0.5,
    });
    const summary = (id: string, name: string, oi: number, volume: number) => ({
      id,
      name,
      type: "cex",
      markets: 300,
      open_interest_usd: oi,
      volume_24h_usd: volume,
      updated_at: new Date(NOW - 5_000),
    });
    const source = () =>
      fakeData({
        exchanges: async () => [
          summary("okx", "OKX", 6.7e9, 16e9),
          summary("binance", "Binance", 26e9, 37e9),
          summary("gate", "Gate", 11e9, 10e9),
        ],
        bookQuality: async () => ({
          rows: [
            book("binance", "BTC", 0.02, 0.2, 60e6),
            book("binance", "ETH", 0.05, 0.6, 30e6),
            book("okx", "BTC", 0.03, 1.5, 20e6),
            book("okx", "ETH", 0.4, null, 5e6),
          ],
          weights: { BTC: 60e9, ETH: 30e9 },
        }),
        exchangeReserves: async () => [
          reserve("binance", 169e9, 143.6e9),
          reserve("okx", 34.2e9, 32.8e9),
          reserve("gate", 7.2e9, 6.1e9),
        ],
      });
    const reserve = (venue_id: string, total: number, clean: number) => ({
      venue_id,
      day: new Date(NOW - 3_600_000),
      kind: "wallets" as const,
      source: venue_id,
      total_usd: total,
      clean_usd: clean,
    });

    test("measured exchanges rank first with a grade, cost and slippage; the rest are ungraded", async () => {
      const { data } = source();
      const html = await (await get("/markets", data)).text();
      expect(html.indexOf(">Binance<")).toBeLessThan(html.indexOf(">OKX<"));
      expect(html.indexOf(">OKX<")).toBeLessThan(html.indexOf(">Gate<"));
      expect(html).toMatch(/class="xg xg-[SABCD]"/);
      // Binance: a 5 bp taker fee ($5.00 on $10k) plus the BTC/ETH mix's slippage, weighted 2:1.
      expect(html).toContain("$5.03");
      expect(html).toContain("fee $5.00");
      // OKX's ETH book could not hold $100k: it is priced at the penalty and flagged.
      expect(html).toContain('class="xc-warn"');
      expect(html).toContain("Not measured: its order book is not read yet");
    });

    test("a quarantined exchange is shown with its tag, evidence and what quarantine means", async () => {
      const { data } = fakeData({
        exchanges: async () => [
          summary("okx", "OKX", 6.7e9, 16e9),
          summary("toobit", "Toobit", 1.9e8, 9.5e9),
        ],
      });
      const html = await (await get("/markets", data)).text();
      expect(html).toMatch(
        />Toobit<\/a> <span class="xc-type">CEX<\/span> <abbr class="xc-q" title="Quarantined: left out of the default rankings\. relays Binance/,
      );
      expect(html).not.toMatch(/>OKX<\/a> <span class="xc-type">CEX<\/span> <abbr/);
      expect(html).toContain("Quarantined: Toobit. Their numbers failed the venue review");
      const page = await (await get("/markets/exchange/toobit", data)).text();
      expect(page).toContain('<p class="lede xq-lede">Quarantined on 2026-10-18: relays Binance');
      expect(await (await get("/markets/exchange/okx", data)).text()).not.toContain(
        '<p class="lede xq-lede">',
      );
    });

    test("sorting by cost puts the cheapest measured exchange first", async () => {
      const { data } = source();
      const html = await (await get("/markets?sort=cost", data)).text();
      expect(html.indexOf(">Binance<")).toBeLessThan(html.indexOf(">OKX<"));
      expect(html).toContain('aria-sort="descending"><a href="/markets?sort=cost">');
    });

    test("an exchange's own page shows its grade and each asset's book", async () => {
      const { data } = source();
      const html = await (await get("/markets/exchange/okx", data)).text();
      expect(html).toContain("Trading cost");
      expect(html).toContain("did not fill");
      expect(html).toContain("not listed");
    });

    test("each grade opens its four pillars, from a panel outside the live rows", async () => {
      const { data } = source();
      const html = await (await get("/markets", data)).text();
      expect(html).toContain('popovertarget="xg-binance"');
      expect(html).toContain('id="xg-binance" popover');
      // Live refresh swaps the tbody; a panel inside it would close under the reader.
      expect(html.indexOf('id="xg-binance"')).toBeGreaterThan(html.indexOf("</tbody>"));
      for (const pillar of ["Reserves", "Execution", "Activity", "Liquidity"])
        expect(html).toContain(`${pillar} <i>`);
      expect(html).toContain("#1 of 2 CEXs");
      expect(html).toContain('href="/markets#grade-method"');
      expect(html).toContain('id="grade-method"');
      // The reserves column, every exchange's, graded or not: Gate's book is not read, its wallets are.
      expect(html).toContain("clean, of $169B in wallets");
      expect(html).toContain("$144B clean of $169B in tracked wallets");
      expect(html).toContain("$6.1B");
    });

    test("sorting by reserves puts the largest balance sheet first", async () => {
      const { data } = source();
      const html = await (await get("/markets?sort=reserves", data)).text();
      expect(html.indexOf(">Binance<")).toBeLessThan(html.indexOf(">OKX<"));
      expect(html.indexOf(">OKX<")).toBeLessThan(html.indexOf(">Gate<"));
    });

    test("a CEX with no published wallets scores zero on reserves", async () => {
      const { data } = fakeData({
        ...source().data,
        exchangeReserves: async () => [reserve("binance", 169e9, 143.6e9)],
      });
      const html = await (await get("/markets", data)).text();
      const okx = html.slice(html.indexOf('id="xg-okx"'));
      expect(okx).toContain("no wallets published");
      expect(okx).toMatch(
        /Reserves <i>30%<\/i><\/span><span class="xg-bar"><b style="width:0%"><\/b><\/span><span class="xg-pv">0</,
      );
    });

    test("a failed reserves read grades on the other three pillars", async () => {
      const { data } = fakeData({
        ...source().data,
        exchangeReserves: async () => {
          throw new Error("relation exchange_reserves does not exist");
        },
      });
      const res = await get("/markets", data);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Reserves are not available right now");
      expect(html).toMatch(/class="xg xg-[SABCD]"/);
      expect(html).toContain("not measured");
      expect((await get("/markets/exchange/binance", data)).status).toBe(200);
    });

    test("a failed read leaves every exchange ungraded and the page up", async () => {
      const { data } = fakeData({
        bookQuality: async () => {
          throw new Error("relation book_quality does not exist");
        },
      });
      const res = await get("/markets", data);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Order books are not measured yet.");
      expect(html).not.toMatch(/class="xg xg-[SABCD]"/);
      expect((await get("/markets/exchange/okx", data)).status).toBe(200);
    });
  });

  describe("rates macro tabs", () => {
    const panels = ["inflation", "fed", "jobs", "growth", "signals", "flows"];

    test("the page lists every macro tab after gamma, each a placeholder that loads itself", async () => {
      const asked: MacroNeeds[] = [];
      const { data } = fakeData({
        macro: async (needs) => {
          asked.push(needs);
          return synthMacro(needs);
        },
      });
      const html = await (await get("/rates", data)).text();
      for (const id of panels) {
        expect(html).toContain(`data-tab="${id}"`);
        expect(html).toContain(`data-lazy="/rates?panel=${id}"`);
        expect(html).toContain(`href="/rates?macro=${id}#${id}"`);
      }
      expect(html.indexOf('data-tab="gamma"')).toBeLessThan(html.indexOf('data-tab="inflation"'));
      // The grid's readers pay nothing for the macro tabs.
      expect(asked).toEqual([]);
    });

    for (const id of panels) {
      test(`${id}: the tab on its own renders its figures, chart and sources`, async () => {
        const { data } = fakeData({ macro: async (needs) => synthMacro(needs) });
        const res = await get(`/rates?panel=${id}`, data);
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain('<div class="lazy-body"');
        expect(html).toContain('class="cvd-tiles mc-tiles"');
        expect(html).toContain('class="fchart cvd-chart mc-chart"');
        expect(html).toContain('"kind":"macro"');
        expect(html).toContain("Sources:");
        expect(html).not.toContain("NaN");
        expect(html).not.toContain("undefined");
        expect(html).not.toContain("Infinity");
        expect(html).not.toContain("<html");
      });
    }

    test("?macro= serves the page with that tab filled and open", async () => {
      const { data } = fakeData({ macro: async (needs) => synthMacro(needs) });
      const html = await (await get("/rates?macro=fed", data)).text();
      expect(html).toContain("<html");
      expect(html).toContain('id="tab-rates-fed"');
      expect(html).toMatch(/data-tab="fed"[^>]*aria-selected="true"/);
      expect(html).not.toContain('data-lazy="/rates?panel=fed"');
      expect(html).toContain('data-lazy="/rates?panel=jobs"');
      expect(html).toContain("Each meeting's odds, from Kalshi");
    });

    test("the Fed tab reads the next meeting's odds and the path they imply", async () => {
      const { data } = fakeData({ macro: async (needs) => synthMacro(needs) });
      const html = await (await get("/rates?panel=fed", data)).text();
      expect(html).toContain("3.75%–4.00%");
      expect(html).toContain("Kalshi: hold 84%");
      // +3 bp expected at the first meeting (13% of +25, 1% of +50, 2% of cuts), +19 bp at the second:
      // 22 bp on today's 3.875% midpoint.
      expect(html).toContain("+3 bp");
      expect(html).toContain("+19 bp");
      expect(html).toContain("+22 bp from today's 3.875%");
      expect(html).toContain("The Fed's own projections");
    });

    test("the inflation tab's middle estimate is where the chance of above crosses one half", async () => {
      const { data } = fakeData({ macro: async (needs) => synthMacro(needs) });
      const html = await (await get("/rates?panel=inflation", data)).text();
      // 64.5% above 0.2%, 29% above 0.3%: the half falls 41% of the way between them.
      expect(html).toContain("Kalshi: +0.24% on the month");
      expect(html).toContain("middle estimate <b>+0.24%</b>");
      expect(html).toContain("Fed&#39;s 2% target");
    });

    test("the positioning tab ranks speculators against their own history", async () => {
      const { data } = fakeData({ macro: async (needs) => synthMacro(needs) });
      const html = await (await get("/rates?panel=flows", data)).text();
      expect(html).toContain("Bitcoin (CME)");
      expect(html).toContain("Gold");
      // Leveraged funds' short shrinks every week, so this week's is the least short: rank 100%.
      expect(html).toContain("3-year rank 100%");
      expect(html).toContain("Stablecoin supply");
    });

    test("a failed read says so in the tab and leaves the page up", async () => {
      const { data } = fakeData({
        macro: async () => {
          throw new Error("relation macro_observations does not exist");
        },
      });
      const tab = await get("/rates?panel=signals", data);
      expect(tab.status).toBe(200);
      expect(await tab.text()).toContain("The macro data could not be read right now.");
      const page = await get("/rates?macro=signals", data);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("The macro data could not be read right now.");
    });

    test("an empty store says no figures have been read yet", async () => {
      const { data } = fakeData();
      for (const id of panels) {
        const html = await (await get(`/rates?panel=${id}`, data)).text();
        expect(html).toContain("yet.");
      }
    });

    test("an unknown panel is the page, not a fragment", async () => {
      const { data } = fakeData();
      const html = await (await get("/rates?panel=cpi", data)).text();
      expect(html).toContain("<html");
    });
  });

  test("rates says so when no asset spans two venues", async () => {
    const { data } = fakeData();
    const html = await (await get("/rates", data)).text();
    expect(html).toContain("No asset has live markets on two or more venues");
    expect(html).not.toContain('<table class="heat">');
  });

  test("the old /heatmap paths redirect permanently, carrying the query", async () => {
    const { data } = fakeData();

    // A shared /heatmap?tf=60d link must land on the view it named, not the default one.
    const moved = await get("/heatmap?tf=60d&limit=50", data);
    expect(moved.status).toBe(301);
    expect(moved.headers.get("location")).toBe("/rates?tf=60d&limit=50");

    // The JSON endpoint moved too, so a script pinned to the old path keeps working.
    const api = await get("/v1/heatmap?tf=30d", data);
    expect(api.status).toBe(301);
    expect(api.headers.get("location")).toBe("/v1/rates?tf=30d");

    // No query means no trailing "?", so the canonical URL stays one cache key.
    expect((await get("/heatmap", data)).headers.get("location")).toBe("/rates");
  });

  test("pair page without legs offers the picker instead of a result", async () => {
    const { data } = fakeData();
    const html = await (await get("/pair/BTC", data)).text();

    expect(html).toContain("Pick two exchanges to hold against each other.");
    expect(html).toContain(
      '<form class="filters bt-form" method="get" action="/pair/BTC" data-bt ',
    );
    // No leg is picked yet, so both pickers say so, and the chart's lines are every exchange.
    expect(html.match(/<b data-vp-current>pick one<\/b>/g)).toHaveLength(2);
    expect(html).not.toContain('class="headline');
    // The window is chosen before any legs: the default 30 days is marked and carries no query.
    expect(html).toContain('href="/pair/BTC" data-bt-swap aria-current="true">30d</a>');
    expect(html).toContain('href="/pair/BTC?days=7" data-bt-swap>7d</a>');
    expect(html).toContain("No stored funding for this window yet");
    expect((await get("/pair/NOPE", data)).status).toBe(404);
  });

  test("pair page charts every exchange's funding, legs on and the rest a toggle away", async () => {
    const top = Math.floor(NOW / 3_600_000) * 3_600_000;
    const hour = (venue_id: string, venue_symbol: string, hoursAgo: number, rate: number) => ({
      venue_id,
      venue_symbol,
      hour_ms: top - hoursAgo * 3_600_000,
      rate_sum: rate,
      basis_hours_sum: 8,
      settlements: 1,
    });
    const asked: number[] = [];
    const { data } = fakeData({
      asset: async () => [
        market({ venue_id: "gate", venue_symbol: "BTC_USDT", apr: -0.55 }),
        market({}),
        market({ venue_id: "bybit", venue_symbol: "BTCUSDT", apr: 3, interval_hours: 8 }),
      ],
      dailyFunding: async () => [
        ...dailied("gate", "BTC_USDT", -0.0001),
        ...dailied("okx", "BTC-USDT-SWAP", 0.0001),
      ],
      hourlyFunding: async (_markets, fromMs) => {
        asked.push(fromMs);
        return [
          hour("gate", "BTC_USDT", 16, -0.0001),
          hour("gate", "BTC_USDT", 8, -0.0002),
          hour("okx", "BTC-USDT-SWAP", 8, 0.0001),
          hour("bybit", "BTCUSDT", 8, 0.00005),
        ];
      },
    });

    const html = await (await get("/pair/BTC?long=gate&short=okx&days=7", data)).text();

    // Seven days is inside the hourly rollup, read from the start of the window's first day.
    expect(asked).toEqual([Date.parse("2026-09-06T00:00:00Z")]);
    expect(html).toContain('class="fchart"');
    // The legs and their spread draw; a third exchange is listed but starts switched off.
    expect(html).toContain('<path class="fchart-line long" data-series="gate|BTC_USDT"');
    expect(html).toContain('<path class="fchart-line short" data-series="okx|BTC-USDT-SWAP"');
    expect(html).toContain('<path class="fchart-line spread" data-series="spread"');
    expect(html).toContain(
      '<path class="fchart-line other off" data-series="bybit|BTCUSDT" data-venue="bybit"',
    );
    // The key names the lines drawn and has no checkboxes: the exchange picker shows and hides them.
    expect(html).toContain(
      '<span class="fchart-key" data-series="gate|BTC_USDT" data-venue="gate"><i',
    );
    expect(html).toContain(
      '<span class="fchart-key off" data-series="bybit|BTCUSDT" data-venue="bybit"><i',
    );
    expect(html).not.toContain('<input type="checkbox" data-series=');
    // The legs are picked in their pickers, and the chart's exchange picker starts on just them.
    expect(html).toContain(
      '<input type="radio" name="long" value="gate" data-vp-name="Gate" checked>',
    );
    expect(html).toContain(
      '<input type="radio" name="short" value="okx" data-vp-name="OKX" checked>',
    );
    expect(html).toContain(
      '<input type="checkbox" value="gate" data-vp-name="Gate" data-leg checked>',
    );
    expect(html).toContain('<input type="checkbox" value="bybit" data-vp-name="Bybit">');
    // The window strip keeps the legs and marks the current window; swapping reverses the legs.
    expect(html).toContain(
      'href="/pair/BTC?long=gate&short=okx&days=7" data-bt-swap aria-current="true">7d</a>',
    );
    expect(html).toContain('href="/pair/BTC?long=gate&short=okx" data-bt-swap>30d</a>');
    expect(html).toContain(
      `<a class="btn" href="/pair/BTC?long=okx&short=gate&days=7" data-bt-swap>${icon("swap")} swap legs</a>`,
    );
    // The way back to the asset is the breadcrumb, not a button among the form's actions.
    expect(html).not.toContain("Back to BTC");
    // Each leg carries what it charges now beside what it settled.
    expect(html).toContain("now <span");
    expect(html).toContain(", every 8h");
    // The status line has the overview, as the asset and exchange pages do.
    expect(html).toContain("4,286 markets");
    expect(html).not.toContain("no venue has reported");
  });

  test("the chart fails soft without its table, and long windows read the daily rollup", async () => {
    const logs: string[] = [];
    const { data } = fakeData({
      dailyFunding: async () => [
        ...dailied("gate", "BTC_USDT", -0.0001),
        ...dailied("okx", "BTC-USDT-SWAP", 0.0001),
      ],
      hourlyFunding: async () => {
        throw new Error('relation "market_funding_hourly" does not exist');
      },
    });
    const deps = { data, now: () => NOW, log: (m: string) => logs.push(m) };

    // The collector has not applied 014 yet: the chart says so, and the backtest still renders.
    const short = await handleApp(
      new Request("https://airates.test/pair/BTC?long=gate&short=okx&days=7"),
      deps,
    );
    expect(short.status).toBe(200);
    const html = await short.text();
    expect(html).toContain("The funding chart is unavailable right now");
    expect(html).toContain('<p class="headline up">$6.00</p>');
    expect(logs.some((line) => line.includes("funding chart unavailable"))).toBe(true);

    // Thirty days is past the hourly rollup, so the chart draws daily and never asks for hours.
    const long = await (
      await handleApp(
        new Request("https://airates.test/pair/BTC?long=gate&short=okx&days=30"),
        deps,
      )
    ).text();
    expect(long).toContain("annualized · daily");
  });

  test("about is linked from every footer and names the project and its version", async () => {
    const { data } = fakeData();
    const res = await get("/about", data);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('<h1 class="has-help">About airrates<');
    expect(html).toContain("Recent changes");
    // The tests run on the committed placeholder, which says so rather than inventing a commit.
    expect(html).toContain("commit <b>not recorded</b>");
    expect(html).toContain("4,286 markets");
    // Every page's footer links it, so it is reachable from anywhere.
    expect(await (await get("/", data)).text()).toContain('<a href="/about">about</a>');
  });

  test("the keyboard page draws every shortcut and is linked from every footer", async () => {
    const { data } = fakeData();
    const res = await get("/keys", data);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('<h1 class="has-help">Keyboard<');
    // The default keys are lit for a reader with no script: R goes to rates, / filters.
    expect(html).toMatch(/class="cap t-go" [^>]*data-k="r"/);
    expect(html).toMatch(/class="cap t-page two" [^>]*data-k="\/" data-s="\?"/);
    // Editing is behind a login: the lock is shown and the editor hidden until the member area says so.
    expect(html).toContain('id="kb-lock"');
    expect(html).toContain('<div class="kb-head" id="kb-head" hidden>');
    expect(await (await get("/", data)).text()).toContain('href="/keys"');
  });

  test("terms of service is reachable from the legal page and scopes itself to this site", async () => {
    const { data } = fakeData();
    const res = await get("/tos", data);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("<h1>Terms of service</h1>");
    for (const id of [
      "acceptance",
      "service",
      "data",
      "use",
      "ip",
      "third-party",
      "availability",
      "liability",
      "changes",
      "law",
      "contact",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    // The claims most likely to drift from the code, pinned so a change has to touch this test.
    expect(html).toContain("20 requests a minute");
    expect(html).toContain("holds no funds, places no orders");
    // The member area is a separate service on its own subdomain, and these terms say so rather
    // than silently covering something this Worker does not serve.
    expect(html).toContain("separate service");
    // Counsel still owes the jurisdiction; the page must say so rather than name one.
    expect(html).toContain("To be completed before launch");
    // Asked for as reachable from /legal, so that link is the contract.
    expect(await (await get("/legal", data)).text()).toContain(
      '<a href="/tos">Terms of service</a>',
    );
    // And from every footer, as the other standing pages are.
    expect(await (await get("/", data)).text()).toContain('<a href="/tos">terms</a>');
  });

  test("legal and privacy is linked from every footer and says what is and is not recorded", async () => {
    const { data } = fakeData();
    const res = await get("/legal", data);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("<h1>Legal and privacy</h1>");
    for (const id of ["disclaimer", "affiliate", "independence", "privacy", "storage"]) {
      expect(html).toContain(`id="${id}"`);
    }
    // The claims most likely to drift from the code, pinned so a change has to touch this test.
    expect(html).toContain("Google Analytics");
    expect(html).toContain("<code>_ga</code>");
    expect(html).toContain("it does not record your IP address");
    expect(html).toContain("keeps them for three months");
    expect(await (await get("/", data)).text()).toContain(
      '<a href="/legal">legal &amp; privacy</a>',
    );
  });

  test("an exchange page shows a referral CTA only with a configured link and an allowed location", async () => {
    const { data } = fakeData();
    const url = "https://app.hyperliquid.xyz/join/AIRRATES";
    const at = (country?: string) => {
      const request = new Request("https://airates.test/markets/exchange/hyperliquid");
      if (country) Object.defineProperty(request, "cf", { value: { country } });
      return request;
    };
    const render = async (request: Request, referrals?: Record<string, Referral>) => {
      const res = await handleApp(request, { data, now: () => NOW, referrals });
      expect(res.status).toBe(200);
      return res.text();
    };
    const links: Record<string, Referral> = {
      hyperliquid: { url, code: null, audience: "public" },
    };

    expect(await render(at("SG"))).not.toContain("Referral link:");
    // A code reserved for the member area never reaches the open site.
    expect(
      await render(at("SG"), { hyperliquid: { url, code: null, audience: "member" } }),
    ).not.toContain("Referral link:");
    // Unknown location, as outside Cloudflare, and a barred country: no CTA even with a link.
    expect(await render(at(), links)).not.toContain("Referral link:");
    expect(await render(at("GB"), links)).not.toContain("Referral link:");

    const shown = await render(at("SG"), links);
    expect(shown).toContain(`href="${url}"`);
    expect(shown).toContain('rel="sponsored noopener noreferrer"');
    expect(shown).toContain("may earn a commission");
  });

  test("the referral links page shows only what the visitor's location allows, disclosed and sorted by name", async () => {
    const { data } = fakeData();
    const links: Record<string, Referral> = {
      hyperliquid: {
        url: "https://app.hyperliquid.xyz/join/AIRRATES",
        code: "AIRRATES",
        audience: "public",
      },
      kucoin: { url: "https://www.kucoin.com/r/af/AIR", code: null, audience: "public" },
      // No written restrictions for bybit, so it is never shown anywhere.
      bybit: { url: "https://www.bybit.com/invite?ref=AIR", code: "AIR", audience: "public" },
    };
    const at = (country?: string) => {
      const request = new Request("https://airates.test/referrals");
      if (country) Object.defineProperty(request, "cf", { value: { country } });
      return request;
    };
    const render = async (request: Request, referrals?: Record<string, Referral>) => {
      const res = await handleApp(request, { data, now: () => NOW, referrals });
      expect(res.status).toBe(200);
      return res.text();
    };

    expect(await render(at("SG"))).toContain("No referral links yet.");
    expect(await render(at(), links)).toContain("Referral links are not shown in your location.");
    const barred = await render(at("GB"), links);
    expect(barred).toContain("Referral links are not shown in your location.");
    expect(barred).not.toContain('rel="sponsored');

    // KuCoin bars Singapore, so only Hyperliquid shows there.
    const singapore = await render(at("SG"), links);
    expect(singapore).toContain("<b>Disclosure.</b>");
    expect(singapore).toContain('href="https://app.hyperliquid.xyz/join/AIRRATES"');
    expect(singapore).toContain("<code>AIRRATES</code>");
    expect(singapore).not.toContain("kucoin.com");
    expect(singapore).not.toContain("bybit.com");
    expect(singapore).toContain("2 more exchanges' links are not available in your location.");

    const thailand = await render(at("TH"), links);
    expect(thailand.indexOf('data-k="hyperliquid"')).toBeGreaterThan(-1);
    expect(thailand.indexOf('data-k="hyperliquid"')).toBeLessThan(
      thailand.indexOf('data-k="kucoin"'),
    );
    expect(thailand).toContain("1 more exchange's link is not available in your location.");

    // A members-only offer is not a public row, and is not counted as one hidden by location either.
    const members = await render(at("TH"), {
      ...links,
      kucoin: { ...(links.kucoin as Referral), audience: "member" },
    });
    expect(members).not.toContain("kucoin.com");
    expect(members).toContain("1 more exchange's link is not available in your location.");

    expect(await (await get("/", data)).text()).toContain(
      '<a href="/referrals">referral links</a>',
    );
  });

  test("database failures render a 503 page, not an exception", async () => {
    const logs: string[] = [];
    const { data } = fakeData({
      overview: async () => {
        throw new Error("connection refused");
      },
    });
    const res = await handleApp(new Request("https://airates.test/"), {
      data,
      now: () => NOW,
      log: (m) => logs.push(m),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    // Told when to come back, so a client does not retry in a loop against a database that is down.
    expect(res.headers.get("retry-after")).toBe("10");
    expect(await res.text()).toContain("The data center is getting too busy");
    expect(logs).toEqual(["/: connection refused"]);
  });

  test("the API answers a database failure with JSON and the same retry hint", async () => {
    const { data } = fakeData({
      overview: async () => {
        throw new Error("connection refused");
      },
    });
    const res = await handleApp(new Request("https://airates.test/v1/health"), {
      data,
      now: () => NOW,
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("10");
    expect(await res.json()).toEqual({ error: "data_unavailable" });
  });

  test("the answer for a reader whose render timed out is the same busy page, by path", async () => {
    const page = unavailableResponse("/cvd", NOW);
    expect(page.status).toBe(503);
    expect(page.headers.get("retry-after")).toBe("10");
    // Temporary, so never "noindex": Googlebot read that as "drop this page" through the outage.
    expect(page.headers.get("x-robots-tag")).toBeNull();
    expect(await page.text()).toContain("The data center is getting too busy");
    const api = unavailableResponse("/v1/screener", NOW);
    expect(api.headers.get("content-type")).toContain("application/json");
    // "/v1x" is a page, not the API: the prefix is a path segment, not a string prefix.
    expect((await unavailableResponse("/v1x", NOW).text()).startsWith("<!doctype html>")).toBe(
      true,
    );
  });
});

describe("cvd", () => {
  const BUCKET = 15 * 60_000;
  const bucket = (ago: number) => new Date(Math.floor(NOW / BUCKET) * BUCKET - ago * BUCKET);
  const flow = (overrides: Partial<CvdData> = {}): CvdData => ({
    rows: [
      // Price up 2% while takers sold 20% of volume: bearish.
      {
        asset: "ZEC",
        asset_class: "crypto",
        buy_usd: 40e6,
        sell_usd: 60e6,
        venues: 4,
        price: 51,
        change_pct: 2,
      },
      // Price down 1% while takers bought 30%: bullish.
      {
        asset: "BTC",
        asset_class: "crypto",
        buy_usd: 65e6,
        sell_usd: 35e6,
        venues: 4,
        price: 76_000,
        change_pct: -1,
      },
      // Price down 0.2%, flow −40%: too small a move to flag.
      {
        asset: "SOL",
        asset_class: "crypto",
        buy_usd: 3e6,
        sell_usd: 7e6,
        venues: 3,
        price: 140,
        change_pct: -0.2,
      },
      // No price at all: never flagged, and the change reads as a dash rather than 0.00%.
      {
        asset: "SNDK",
        asset_class: "equity",
        buy_usd: 1e6,
        sell_usd: 0.5e6,
        venues: 1,
        price: null,
        change_pct: null,
      },
    ],
    asset_class: "crypto",
    bars: [
      {
        bucket_start: bucket(3),
        buy_usd: 5e6,
        sell_usd: 2e6,
        price: 76_100,
        price_venue: "binance",
        price_symbol: "BTCUSDT",
      },
      {
        bucket_start: bucket(1),
        buy_usd: 1e6,
        sell_usd: 4e6,
        price: 75_900,
        price_venue: "binance",
        price_symbol: "BTCUSDT",
      },
    ],
    newest: bucket(1),
    ...overrides,
  });

  test("divergence needs both a real price move and a real flow imbalance", () => {
    const [zec, btc, sol, sndk] = flow().rows as CvdAssetRow[];
    expect(divergence(zec as CvdAssetRow)).toBe("bearish");
    expect(divergence(btc as CvdAssetRow)).toBe("bullish");
    expect(divergence(sol as CvdAssetRow)).toBeNull();
    expect(divergence(sndk as CvdAssetRow)).toBeNull();
    expect(flowRatio({ buy_usd: 0, sell_usd: 0 })).toBeNull();
  });

  test("/cvd charts BTC by default and counts breadth and divergences over every row", async () => {
    const seen: CvdOptions[] = [];
    const { data } = fakeData({
      cvd: async (options) => {
        seen.push(options);
        return flow();
      },
    });
    const response = await get("/cvd", data);
    expect(response.status).toBe(200);
    const html = await response.text();

    expect(seen).toEqual([{ windowHours: 24, barMinutes: 15, base: "BTC", assetClass: null }]);
    // Two of four assets net bought.
    expect(html).toContain('data-u="breadth">50.0%<');
    expect(html).toContain('data-u="bullish">1<');
    expect(html).toContain('data-u="bearish">1<');
    // Largest net buy and net sell, signed.
    expect(html).toContain("BTC +$30.0M");
    expect(html).toContain("ZEC −$20.0M");
    expect(html).toContain('class="cvd-badge cvd-badge-bearish"');
    // The running CVD over the two bars: +3M then −3M.
    expect(html).toContain('data-u="cvd-total" class="">$0<');
    // An asset with no price shows a dash, not a zero change.
    expect(html).toContain('<span data-u="change">–</span>');
  });

  test("the chart ships every slot's figures for the hover readout, with a cursor on both panels", async () => {
    const { data } = fakeData({ cvd: async () => flow() });
    const html = await (await get("/cvd", data)).text();
    const figure = html.slice(
      html.indexOf('<figure class="fchart cvd-chart"'),
      html.indexOf("</figure>"),
    );

    // 96 slots of 15 minutes ending in the one holding NOW (12:00): bucket(3), 11:15, is slot 92 and
    // bucket(1), 11:45, slot 94. Each is [bought, sold, CVD so far, price].
    const payload = JSON.parse(
      figure.match(
        /<script type="application\/json" class="slot-data">([\s\S]*?)<\/script>/,
      )?.[1] ?? "{}",
    );
    expect(payload.kind).toBe("cvd");
    expect(payload.from).toBe(Date.parse("2026-09-11T12:15:00Z"));
    expect(payload.unit).toBe(900_000);
    expect(payload.open).toBe(76_100);
    expect(payload.slots).toHaveLength(96);
    expect(payload.slots[92]).toEqual([5e6, 2e6, 3e6, 76_100]);
    expect(payload.slots[93]).toBeNull();
    expect(payload.slots[94]).toEqual([1e6, 4e6, 0, 75_900]);

    // One cursor and one band per panel, so the line runs through the price chart and the strip.
    expect(figure.match(/<line class="slot-mark fchart-cursor off"/g)).toHaveLength(2);
    expect(figure.match(/<rect class="slot-mark slot-band off"/g)).toHaveLength(2);
    expect(figure).toContain('<div class="slot-area" tabindex="0"');
    // Before a hover the header reads the window: 75,900 is 0.26% under the first close of 76,100.
    expect(figure).toContain(
      '<p class="fchart-read slot-read" aria-live="polite">Last 24h · close 75,900 (−0.26% since start) · bought $6.0M · sold $6.0M · net <b class="">$0</b> (0.0% of volume) · hover or tap a bar to read it</p>',
    );
    // The readout replaces the per-bar tooltips.
    expect(figure).not.toContain("<title>");
    expect(figure).not.toContain("cvd-hit");
    expect(html.match(/window\.airratesSlots = true/g)).toHaveLength(1);
  });

  test("the trading chart gets the same bars as candles, where to find older ones, and a host outside the live figure", async () => {
    const { data } = fakeData({
      cvd: async () => {
        const base = flow();
        const [first, second] = base.bars as [CvdBar, CvdBar];
        return { ...base, bars: [{ ...first, open: 76_000, high: 76_300, low: 75_950 }, second] };
      },
    });
    const html = await (await get("/cvd", data)).text();
    const figure = html.slice(
      html.indexOf('<figure class="fchart cvd-chart"'),
      html.indexOf("</figure>"),
    );
    const payload = JSON.parse(
      figure.match(/<script type="application\/json" class="kc-data">([\s\S]*?)<\/script>/)?.[1] ??
        "{}",
    );
    expect(payload.bar).toBe(900_000);
    expect(payload.count).toBe(96);
    expect(payload.page).toBe(500 * 900_000);
    expect(payload.floor).toBe(NOW - 35 * 86_400_000);
    expect(payload.src).toBe("/data/cvd?asset=BTC&class=crypto&bar=15");
    expect(payload.ref).toBe("binance:BTCUSDT");
    // [start, open, high, low, close, bought, sold]; a bar with only a close stands in for all four.
    expect(payload.bars).toEqual([
      [Date.parse("2026-09-12T11:15:00Z"), 76_000, 76_300, 75_950, 76_100, 5e6, 2e6],
      [Date.parse("2026-09-12T11:45:00Z"), 75_900, 75_900, 75_900, 75_900, 1e6, 4e6],
    ]);
    expect(payload.words.older).toBe("Loading older bars…");
    // The host follows the figure inside the anchor: live.ts replaces the figure, never the host.
    expect(html).toMatch(/<\/figure>\s*<div class="kc-host" data-kc hidden><\/div><\/div>/);
    expect(html.match(/window\.airratesKChart = true/g)).toHaveLength(1);
  });

  test("/data/cvd answers one page of history on the page grid, and nothing else", async () => {
    const asked: unknown[] = [];
    const { data } = fakeData({
      cvdHistory: async (options) => {
        asked.push(options);
        return [
          {
            bucket_start: new Date(Date.parse("2026-09-01T00:00:00Z")),
            buy_usd: 1.4e6,
            sell_usd: 2.6e6,
            price: 70_000,
            open: 69_000,
            high: 70_500,
            low: 68_800,
            price_venue: "binance",
            price_symbol: "BTCUSDT",
          },
        ];
      },
    });
    const page = 500 * 3_600_000;
    const before = Math.ceil((NOW - 10 * 86_400_000) / page) * page;
    const response = await get(
      `/data/cvd?asset=BTC&class=crypto&bar=60&before=${before}&ref=binance:BTCUSDT`,
      data,
    );
    expect(response.status).toBe(200);
    // Long past: final, so kept an hour.
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(asked).toEqual([
      {
        base: "BTC",
        assetClass: "crypto",
        barMinutes: 60,
        fromMs: before - page,
        toMs: before,
        ref: { venue: "binance", symbol: "BTCUSDT" },
      },
    ]);
    expect(await response.json()).toEqual({
      from: before - page,
      to: before,
      ref: "binance:BTCUSDT",
      bars: [
        [Date.parse("2026-09-01T00:00:00Z"), 69_000, 70_500, 68_800, 70_000, 1_400_000, 2_600_000],
      ],
    });

    // The page holding now is still filling: a minute.
    const newest = Math.ceil(NOW / page) * page;
    const fresh = await get(`/data/cvd?asset=BTC&class=crypto&bar=60&before=${newest}`, data);
    expect(fresh.headers.get("cache-control")).toBe("public, max-age=60");

    for (const bad of [
      `asset=BTC&class=crypto&bar=60&before=${before + 3_600_000}`, // off the page grid
      `asset=BTC&class=crypto&bar=7&before=${before}`, // not an interval's bar
      `asset=BTC&class=bonds&bar=60&before=${before}`, // not a class
      `asset=BTC&class=crypto&bar=60&before=${before - 20 * page}`, // past the retention
      `asset=BTC&class=crypto&bar=60&before=${newest + page}`, // the future
      `asset=BTC&class=crypto&bar=60&before=${before}&ref=binance`, // a ref without a symbol
      `asset=B%20TC&class=crypto&bar=60&before=${before}`,
    ]) {
      expect((await get(`/data/cvd?${bad}`, data)).status).toBe(400);
    }
    expect(asked).toHaveLength(2);
  });

  test("the chart offers a crosshair: a level line per panel, each panel's axes, and a switch", async () => {
    const { data } = fakeData({ cvd: async () => flow() });
    const html = await (await get("/cvd", data)).text();
    const figure = html.slice(
      html.indexOf('<figure class="fchart cvd-chart"'),
      html.indexOf("</figure>"),
    );
    expect(figure).toContain('data-live="cvd-chart" data-cursors>');
    expect(figure.match(/<line class="slot-hair off"/g)).toHaveLength(2);
    // The switch needs the script, so it starts hidden; the crosshair is the default.
    expect(figure).toContain('<div class="slot-modes" role="group" aria-label="Cursor" hidden>');
    expect(figure).toContain('data-cursor="cross" aria-pressed="true"');
    expect(figure).toContain('data-cursor="bar" aria-pressed="false"');
    // Each panel's axes, as the values at the plot's bottom and top edges: price on the left and CVD
    // on the right of the chart (75,900–76,100 and 0–+$3M, each padded 8%), net flow on the strip.
    const axes = [...figure.matchAll(/data-axes="([^"]+)"/g)].map((m) =>
      JSON.parse((m[1] ?? "").replaceAll("&quot;", '"')),
    );
    expect(axes).toHaveLength(2);
    expect(axes[0].l[0]).toBe("price");
    expect(axes[0].l[1]).toBeCloseTo(75_884);
    expect(axes[0].l[2]).toBeCloseTo(76_116);
    expect(axes[0].r[0]).toBe("usd");
    expect(axes[0].r[1]).toBeCloseTo(-240_000);
    expect(axes[0].r[2]).toBeCloseTo(3_240_000);
    expect(axes[1].l).toBeUndefined();
    expect(axes[1].r[0]).toBe("usd");
    expect(axes[1].r[1]).toBe(-axes[1].r[2]);
    // The reader's choice is kept in their browser.
    expect(html).toContain('localStorage.getItem("chart-cursor")');
  });

  test("the address picks the charted asset and the interval picks the bar width", async () => {
    const seen: CvdOptions[] = [];
    const { data } = fakeData({
      cvd: async (options) => {
        seen.push(options);
        return flow({ asset_class: "equity", bars: [] });
      },
    });
    const html = await (await get("/cvd/equity/SNDK?interval=4h&sort=cvd&dir=asc", data)).text();
    // 4-hour bars over 16 days: about 96 of them.
    expect(seen).toEqual([
      { windowHours: 384, barMinutes: 240, base: "SNDK", assetClass: "equity" },
    ]);
    // Links keep the interval and the sort, and land on the chart, not the top of the page.
    expect(html).toContain('href="/cvd/ZEC?interval=4h&amp;sort=cvd&amp;dir=asc#cvd-chart"');
    expect(html).toContain('id="cvd-chart"');
    expect(html).toContain('aria-current="true"');
    // Sorted ascending by CVD, the heaviest net selling comes first.
    expect(html.indexOf('data-k="ZEC"')).toBeLessThan(html.indexOf('data-k="BTC"'));
  });

  test("the interval strip offers five bar sizes and shows 2h and 7d locked, in order of duration", async () => {
    const seen: CvdOptions[] = [];
    const { data } = fakeData({
      cvd: async (options) => {
        seen.push(options);
        return flow();
      },
    });
    const html = await (await get("/cvd", data)).text();
    const strip = html.split('class="tf cvd-intervals"')[1]?.split("</nav>")[0] ?? "";
    for (const key of ["5m", "15m", "1h", "4h", "24h"]) {
      expect(strip).toContain(`data-cvd-switch="${key}">${key}<`);
    }
    // Shortest bar first, the locked ones in their place rather than trailing at the end.
    const entries = [
      ...strip.matchAll(/<a [^>]*data-cvd-switch="([^"]+)"|<span class="tf-locked"[^>]*>([^<]+)</g),
    ].map((m) => (m[1] ? m[1] : `${m[2]} locked`));
    expect(entries).toEqual(["5m", "15m", "1h", "2h locked", "4h", "24h", "7d locked"]);
    // 15m is the default: the bare address, marked current, and it reads a day of 15-minute bars.
    expect(strip).toContain('href="/cvd" aria-current="page" data-cvd-switch="15m"');
    expect(strip).toContain('href="/cvd?interval=24h" data-cvd-switch="24h"');
    expect(seen[0]).toMatchObject({ windowHours: 24, barMinutes: 15 });
    // 2h and 7d are shown with a lock and are not links anywhere.
    expect(strip.match(/<span class="tf-locked" aria-disabled="true"/g)).toHaveLength(2);
    expect(strip).toContain("2h<svg");
    expect(strip).toContain("7d<svg");
    expect(html).not.toContain("interval=2h");
    expect(html).not.toContain("interval=7d");
    // Each lock says why truthfully: 7d lacks history, 2h is simply not offered yet.
    expect(strip).toContain('title="Not available yet">2h<svg');
    expect(strip).toContain(
      'title="Not available yet: there is not enough history for 7d bars">7d<svg',
    );
    // The switch script ships with the page (and is allowed by its CSP hash like any other).
    expect(html).toContain("a[data-cvd-switch]");

    // Every interval reads the span it charts.
    seen.length = 0;
    for (const key of ["5m", "1h", "24h"]) await get(`/cvd?interval=${key}`, data);
    expect(seen.map((o) => [o.barMinutes, o.windowHours])).toEqual([
      [5, 8],
      [60, 96],
      [1440, 720],
    ]);
    // A locked or unknown interval is the default, not an error.
    seen.length = 0;
    for (const key of ["2h", "7d", "3m"]) await get(`/cvd?interval=${key}`, data);
    expect(seen.map((o) => [o.barMinutes, o.windowHours])).toEqual([
      [15, 24],
      [15, 24],
      [15, 24],
    ]);
  });

  test("the screener is a picker beside the intervals: a row charts its asset, the box finds a ticker", async () => {
    const { data } = fakeData({ cvd: async () => flow() });
    const html = await (await get("/cvd?interval=1h", data)).text();
    const controls =
      html.split('<div class="lq-controls wh-controls">')[1]?.split('<div class="cvd-tiles"')[0] ??
      "";
    // The charted asset is the button; every polled asset is a row in its panel, a real link
    // (keyboard, new tab) that the script turns into an in-place switch.
    expect(controls).toContain('<details class="wh-pick cvd-pick">');
    expect(controls).toContain("4 assets");
    expect(controls).toContain(
      '<a class="wh-pick-row on" href="/cvd/BTC?interval=1h#cvd-chart" data-cvd-select="BTC"',
    );
    expect(controls).toContain('href="/cvd/ZEC?interval=1h#cvd-chart" data-cvd-select="ZEC"');
    expect(controls).toContain('data-live="cvd-rows"');
    expect(controls).toContain('class="tf cvd-intervals"');
    // The ticker search is in the panel: a form, so it still works without the script.
    expect(controls).toContain(
      '<div class="wh-pick-panel">\n<form class="wh-pick-find" method="get" action="/cvd"><input type="hidden" name="interval" value="1h"><input class="wh-pick-q" type="search" name="q" value=""',
    );
    expect(html).toContain('data-loading-asset="Loading {asset}…"');
    expect(html).not.toContain("cvd-table");
    expect(html).not.toContain("cvd-search");
  });

  test("a heading sorts the picker's rows in place, by the keys the server sorted with", async () => {
    const { data } = fakeData({ cvd: async () => flow() });
    const html = await (await get("/cvd?sort=cvd", data)).text();
    // By CVD, heaviest net buying first: BTC +$30M, SNDK +$0.5M, SOL −$4M, ZEC −$20M.
    const order = [
      ...html.matchAll(/class="wh-pick-row[^"]*" href="[^"]*" data-cvd-select="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(order).toEqual(["BTC", "SNDK", "SOL", "ZEC"]);
    // Each row carries its keys in CVD_SORTS order (volume, CVD, ratio, change); no price sorts last.
    expect(html).toContain(
      `data-a="SNDK" data-keys="1500000,500000,${flowRatio({ buy_usd: 1e6, sell_usd: 0.5e6 })},-Infinity"`,
    );
    // The active heading says which way, and its link flips it; any other starts descending.
    expect(html).toContain('<div class="wh-pick-head" data-sort="cvd" data-dir="desc">');
    expect(html).toContain('href="/cvd?sort=cvd&amp;dir=asc" data-cvd-sort="cvd"');
    expect(html).toContain('data-cvd-sort="cvd" title="');
    expect(html).toContain('href="/cvd?sort=ratio" data-cvd-sort="ratio"');
    expect(html).toContain('href="/cvd" data-cvd-sort="volume"');
    // The script sorts by the same keys and moves the address with it.
    expect(html).toContain('const SORTS = ["volume","cvd","ratio","change"];');
    expect(html).toContain("history.replaceState(null");
  });

  test("old ?window= addresses land on the nearest interval", async () => {
    const seen: CvdOptions[] = [];
    const { data } = fakeData({
      cvd: async (options) => {
        seen.push(options);
        return flow();
      },
    });
    for (const window of ["1h", "4h", "24h", "7d"]) await get(`/cvd?window=${window}`, data);
    expect(seen.map((o) => o.barMinutes)).toEqual([5, 5, 15, 60]);
  });

  test("an asset named in another script has a working address", async () => {
    const seen: CvdOptions[] = [];
    const { data } = fakeData({
      cvd: async (options) => {
        seen.push(options);
        return flow();
      },
    });
    // 龙虾 is listed by hotcoin and aster; the ASCII-only address pattern answered it with a 404.
    const response = await get(`/cvd/${encodeURIComponent("龙虾")}`, data);
    expect(response.status).toBe(200);
    expect(seen[0]?.base).toBe("龙虾");
    // Still one segment of letters and digits: a slash or a space is not an asset.
    expect((await get(`/cvd/${encodeURIComponent("a b")}`, data)).status).toBe(404);
  });

  test("the top-flow links drop the search, as the rows do", async () => {
    const { data } = fakeData({ cvd: async () => flow() });
    const html = await (await get("/cvd?q=ze", data)).text();
    const tiles = html.split('data-live="cvd-tiles"')[1]?.split("</div>\n</div>")[0] ?? "";
    expect(tiles).toContain('href="/cvd/BTC#cvd-chart"');
    expect(tiles).not.toContain("q=");
  });

  test("?q= opens the picker on its search, hiding the other rows without changing the tiles", async () => {
    const { data } = fakeData({ cvd: async () => flow() });
    const html = await (await get("/cvd?q=ze", data)).text();
    expect(html).toContain('<details class="wh-pick cvd-pick" open data-searched>');
    expect(html).toContain('name="q" value="ZE"');
    // Hidden, not dropped: emptying the box in the browser brings BTC back.
    expect(html).toMatch(/data-k="ZEC"[^>]*data-keys="[^"]*">/);
    expect(html).toMatch(/data-k="BTC"[^>]*aria-current="true" hidden>/);
    expect(html).toContain('<p class="wh-pick-none dim" hidden>');
    expect(html).toContain('data-u="breadth">50.0%<');
  });

  test("an asset nothing lists is a 404, and an empty window says why", async () => {
    const { data } = fakeData({ cvd: async () => flow({ asset_class: null, rows: [], bars: [] }) });
    expect((await get("/cvd/NOSUCH", data)).status).toBe(404);
    const html = await (
      await get("/cvd", fakeData({ cvd: async () => flow({ rows: [], bars: [] }) }).data)
    ).text();
    expect(html).toContain("No taker flow has been collected");
  });
});

describe("api", () => {
  test("screener JSON includes the canonical query", async () => {
    const { data } = fakeData();
    const body = (await (await get("/v1/screener?types=hip3,cex", data)).json()) as {
      query: string;
      count: number;
    };
    expect(body).toMatchObject({ query: "?types=cex%2Chip3", count: 1 });
  });

  test("health is ok while data is fresh and 503 when stale", async () => {
    const fresh = await get("/v1/health", fakeData().data);
    expect(fresh.status).toBe(200);
    const { data } = fakeData({
      overview: async () => ({ ...overview, updated_at: new Date(NOW - 10 * 60_000) }),
    });
    expect((await get("/v1/health", data)).status).toBe(503);
  });

  test("exchange and asset JSON, unknown routes and methods", async () => {
    const { data } = fakeData();
    expect((await get("/v1/exchanges/okx", data)).status).toBe(200);
    expect((await get("/v1/exchanges/nope", data)).status).toBe(404);
    expect((await get("/v1/assets/BTC", data)).status).toBe(200);
    expect((await get("/v1/assets/NOPE", data)).status).toBe(404);
    expect((await get("/v1/nothing", data)).status).toBe(404);
    const post = await handleApp(
      new Request("https://airates.test/v1/screener", { method: "POST" }),
      { data, now: () => NOW },
    );
    expect(post.status).toBe(405);
    // The challenge's verify route went with the gate, so it is as read-only as everything else.
    const verify = await handleApp(
      new Request("https://airates.test/pair/BTC/verify", { method: "POST" }),
      { data, now: () => NOW },
    );
    expect(verify.status).toBe(405);
  });

  test("pair backtest reads both legs' daily rollup over the window", async () => {
    const asked: string[] = [];
    const { data } = fakeData({
      dailyFunding: async (_markets, fromDay) => {
        asked.push(fromDay);
        return [
          // Both legs are paid: a negative rate pays the long, a positive one pays the short.
          ...dailied("gate", "BTC_USDT", -0.0001),
          ...dailied("okx", "BTC-USDT-SWAP", 0.0001),
        ];
      },
    });

    const res = await get("/v1/pairs/BTC/backtest?long=gate&short=okx&size=10k&days=7", data);
    expect(res.status).toBe(200);
    // The rollup refreshes hourly, so the answer keeps for an hour.
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    // Seven calendar days ending with today: 2026-09-06 through 2026-09-12.
    expect(asked).toEqual(["2026-09-06"]);

    const body = (await res.json()) as {
      asset: string;
      netFundingUsd: number;
      long: { venueId: string; venueSymbol: string; fundingUsd: number; settlements: number };
      short: { venueId: string; fundingUsd: number };
      request: { sizeUsd: number; days: number };
      costsUsd: number | null;
    };

    expect(body.asset).toBe("BTC");
    expect(body.long).toMatchObject({ venueId: "gate", venueSymbol: "BTC_USDT", settlements: 3 });
    expect(body.short.venueId).toBe("okx");
    // 3 settlements x $10,000 x 0.01% on each leg.
    expect(body.long.fundingUsd).toBeCloseTo(3, 9);
    expect(body.short.fundingUsd).toBeCloseTo(3, 9);
    expect(body.netFundingUsd).toBeCloseTo(6, 9);
    expect(body.request).toMatchObject({ sizeUsd: 10_000, days: 7 });
    // No fees were given, so costs stay absent rather than invented.
    expect(body.costsUsd).toBeNull();
  });

  test("supplied fees are charged on four fills, and one leg alone charges nothing", async () => {
    const { data } = fakeData({
      dailyFunding: async () => [
        ...dailied("gate", "BTC_USDT", -0.0001),
        ...dailied("okx", "BTC-USDT-SWAP", 0.0001),
      ],
    });

    const res = await get(
      "/v1/pairs/BTC/backtest?long=gate&short=okx&size=10k&days=7&fee_long=5&fee_short=5",
      data,
    );
    const body = (await res.json()) as {
      costsUsd: number | null;
      netAfterCostsUsd: number | null;
      paybackDays: number | null;
      request: { longTakerBps: number | null; shortTakerBps: number | null };
    };

    // $10,000 x (5 + 5) bps x 2 fills per leg = $20, against $6 of funding.
    expect(body.costsUsd).toBeCloseTo(20, 9);
    expect(body.netAfterCostsUsd).toBeCloseTo(-14, 9);
    // The window runs from 2026-09-06 to noon on the 12th, 6.5 days, so $6 is ~$0.923 a day and $20
    // of fees takes ~22 days to repay.
    expect(body.paybackDays).toBeCloseTo(20 / (6 / 6.5), 6);
    expect(body.request).toMatchObject({ longTakerBps: 5, shortTakerBps: 5 });

    // One leg priced and the other blank would understate a round trip by half, so nothing is
    // charged at all rather than half of it.
    const half = await get(
      "/v1/pairs/BTC/backtest?long=gate&short=okx&size=10k&days=7&fee_long=5",
      data,
    );
    expect(((await half.json()) as { costsUsd: number | null }).costsUsd).toBeNull();
  });

  test("the pair page reports costs, payback and what it assumes", async () => {
    const { data } = fakeData({
      dailyFunding: async () => [
        ...dailied("gate", "BTC_USDT", -0.0001),
        ...dailied("okx", "BTC-USDT-SWAP", 0.0001),
      ],
    });
    const html = await (
      await get("/pair/BTC?long=gate&short=okx&size=10k&days=7&fee_long=4.5&fee_short=5", data)
    ).text();

    // $10,000 x (4.5 + 5) bps x 2 = $19, so $6 of funding nets -$13. Matched against the real
    // markup: the </b> closes the net figure, not the fee total, and money() renders a Unicode
    // minus (U+2212) rather than an ASCII hyphen.
    expect(html).toContain("on $19.00 of fees");
    expect(html).toContain("−$13.00");
    // The typed fees are echoed back without trailing zeros, and the four-fill rule is stated.
    expect(html).toContain("4.5 bps long and 5 bps short");
    expect(html).toContain("four fills");
    expect(html).not.toContain("Trading fees are excluded");
    // The inputs keep what was typed, so the form round-trips.
    expect(html).toContain('name="fee_long" value="4.5"');
  });

  test("the rate limiter refuses before any database read, on both the page and the API", async () => {
    const reads: string[] = [];
    const keys: string[] = [];
    const { data } = fakeData({
      asset: async (base) => {
        reads.push(base);
        return [];
      },
    });
    const deps = {
      data,
      now: () => NOW,
      rateLimit: async (key: string) => {
        keys.push(key);
        return false;
      },
    };

    const api = await handleApp(
      new Request("https://airates.test/v1/pairs/BTC/backtest?long=gate&short=okx", {
        headers: { "cf-connecting-ip": "203.0.113.5" },
      }),
      deps,
    );
    expect(api.status).toBe(429);
    // The page's backtest button polls until its report is ready, and waits out this window.
    expect(api.headers.get("retry-after")).toBe("60");
    expect((await api.json()) as { error: string }).toMatchObject({ error: "rate_limited" });

    const html = await handleApp(
      new Request("https://airates.test/pair/BTC?long=gate&short=okx", {
        headers: { "cf-connecting-ip": "203.0.113.5" },
      }),
      deps,
    );
    expect(html.status).toBe(429);
    expect(html.headers.get("retry-after")).toBe("60");
    expect(await html.text()).toContain("Too many requests");

    // Nothing touched the database, and the page and API use separate buckets so one cannot
    // exhaust the other's allowance.
    expect(reads).toEqual([]);
    expect(keys).toEqual(["backtest:203.0.113.5", "pair:203.0.113.5"]);
  });

  test("pair backtest needs two different exchanges that both list the asset", async () => {
    const { data } = fakeData();
    expect((await get("/v1/pairs/BTC/backtest", data)).status).toBe(400);
    expect((await get("/v1/pairs/BTC/backtest?long=gate&short=gate", data)).status).toBe(400);
    expect((await get("/v1/pairs/BTC/backtest?long=gate&short=nope", data)).status).toBe(400);
    // bybit is a real venue, but the fake has no bybit market for BTC.
    expect((await get("/v1/pairs/BTC/backtest?long=gate&short=bybit", data)).status).toBe(404);
    expect((await get("/v1/pairs/NOPE/backtest?long=gate&short=okx", data)).status).toBe(404);
  });

  test("robots.txt allows crawlers and names the sitemap", async () => {
    const res = await get("/robots.txt", fakeData().data);
    expect(await res.text()).toBe(
      "User-agent: *\nContent-Signal: ai-train=no, search=yes, ai-input=yes\nAllow: /\n\nSitemap: https://airrates.net/sitemap.xml\n",
    );
  });

  test("pages name their canonical address and publisher, and API answers credit the source", async () => {
    const { data } = fakeData();
    const html = await (await get("/rates?tf=60d", data)).text();
    expect(html).toContain('<link rel="canonical" href="https://airrates.net/rates">');
    expect(html).toContain('"@type":"Dataset"');
    expect(html).toContain('<meta property="og:url" content="https://airrates.net/rates">');
    const api = await get("/v1/venues", data);
    expect(api.headers.get("x-attribution")).toContain("airrates.net");
    const body = (await (await get("/v1/health", data)).json()) as Record<string, unknown>;
    expect(body.source).toBe("https://airrates.net");
  });

  test("the API catalog, OpenAPI spec and docs page are served for discovery", async () => {
    const { data } = fakeData();
    const catalog = await get("/.well-known/api-catalog", data);
    expect(catalog.status).toBe(200);
    expect(catalog.headers.get("content-type")).toContain("application/linkset+json");
    const { linkset } = (await catalog.json()) as { linkset: Record<string, unknown>[] };
    expect(linkset[0]).toMatchObject({ anchor: "https://airrates.net/v1" });
    for (const rel of ["service-desc", "service-doc", "status"])
      expect(linkset[0]).toHaveProperty(rel);
    const spec = (await (await get("/v1/openapi.json", data)).json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths)).toContain("/v1/rates");
    const home = (await get("/", data)).headers.get("link") ?? "";
    for (const rel of ["api-catalog", "service-desc", "service-doc", "describedby"]) {
      expect(home).toContain(`rel="${rel}"`);
    }
    const auth = await get("/auth.md", data);
    expect(auth.headers.get("content-type")).toContain("text/markdown");
    expect(await auth.text()).toMatch(/^# .*auth\.md/);
    const index = (await (await get("/.well-known/agent-skills/index.json", data)).json()) as {
      $schema: string;
      skills: { name: string; type: string; url: string; digest: string }[];
    };
    expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
    const [skill] = index.skills;
    expect(skill?.type).toBe("skill-md");
    const served = await get(new URL(skill?.url ?? "").pathname, data);
    const bytes = await crypto.subtle.digest("SHA-256", await served.arrayBuffer());
    const hex = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(skill?.digest).toBe(`sha256:${hex}`);
    expect(home).toContain("rel=");
    expect(await (await get("/", data)).text()).toContain("navigator.modelContext");
    const ard = await get("/.well-known/ai-catalog.json", data);
    expect(ard.headers.get("access-control-allow-origin")).toBe("*");
    const catalogue = (await ard.json()) as {
      specVersion: string;
      host: { displayName: string; identifier: string };
      entries: {
        identifier: string;
        displayName: string;
        type: string;
        url?: string;
        data?: unknown;
      }[];
    };
    expect(catalogue.specVersion).toBe("1.0");
    expect(catalogue.host.identifier).toBe("did:web:airrates.net");
    for (const e of catalogue.entries) {
      expect(e.identifier).toStartWith("urn:air:airrates.net:");
      expect(e.type).toBeTruthy();
      expect(e.url !== undefined && e.data === undefined).toBe(true);
    }
    const prm = (await (await get("/.well-known/oauth-protected-resource", data)).json()) as Record<
      string,
      unknown
    >;
    expect(prm.resource).toBe("https://airrates.net");
    expect(prm).not.toHaveProperty("authorization_servers");
    expect(await (await get("/auth.md", data)).text()).toContain("member.airrates.net/auth.md");
    const page = await (await get("/docs", data)).text();
    expect(page).toContain("GET /v1/rates");
  });

  test("the A2A card is served and the endpoint answers SendMessage and message/send", async () => {
    const { data } = fakeData();
    const card = (await (await get("/.well-known/agent-card.json", data)).json()) as {
      supportedInterfaces: { url: string; protocolBinding: string }[];
      skills: { id: string; name: string; description: string }[];
    };
    expect(card.supportedInterfaces[0]?.url).toBe("https://airrates.net/a2a");
    expect(card.skills.length).toBeGreaterThan(0);

    const post = (body: unknown) =>
      handleApp(
        new Request("https://airates.test/a2a", { method: "POST", body: JSON.stringify(body) }),
        { data, now: () => NOW },
      );
    const ask = (method: string, text: string) =>
      post({
        jsonrpc: "2.0",
        id: 7,
        method,
        params: { message: { messageId: "m1", role: "ROLE_USER", parts: [{ text }] } },
      });
    const v1 = (await (await ask("SendMessage", "is the data fresh?")).json()) as {
      id: number;
      result: { message: { role: string; parts: { text: string }[] } };
    };
    expect(v1.id).toBe(7);
    expect(v1.result.message.role).toBe("ROLE_AGENT");
    expect(v1.result.message.parts[0]?.text).toContain("markets");
    const v03 = (await (await ask("message/send", "best spreads")).json()) as {
      result: { kind: string };
    };
    expect(v03.result.kind).toBe("message");
    const unknown = (await (await post({ jsonrpc: "2.0", id: 1, method: "nope" })).json()) as {
      error: { code: number };
    };
    expect(unknown.error.code).toBe(-32601);
    expect(
      (
        await handleApp(new Request("https://airates.test/rates", { method: "POST" }), {
          data,
          now: () => NOW,
        })
      ).status,
    ).toBe(405);
  });

  test("the MCP server card is served and /mcp speaks initialize, tools/list and tools/call", async () => {
    const { data } = fakeData();
    const card = (await (await get("/.well-known/mcp/server-card.json", data)).json()) as {
      serverInfo: { name: string; version: string };
      endpoint: string;
      capabilities: { tools: unknown };
    };
    expect(card.serverInfo.name).toBe("airrates");
    expect(card.endpoint).toBe("https://airrates.net/mcp");
    expect(card.capabilities.tools).toBeDefined();

    const post = (body: unknown) =>
      handleApp(
        new Request("https://airates.test/mcp", { method: "POST", body: JSON.stringify(body) }),
        {
          data,
          now: () => NOW,
        },
      );
    const rpc = async (method: string, params?: unknown) =>
      (await (await post({ jsonrpc: "2.0", id: 1, method, params })).json()) as {
        result?: {
          protocolVersion: string;
          serverInfo: { name: string };
          tools: { name: string }[];
          content: { text: string }[];
        };
        error?: { code: number };
      };
    const init = await rpc("initialize", { protocolVersion: "2025-06-18" });
    expect(init.result?.protocolVersion).toBe("2025-06-18");
    expect(init.result?.serverInfo.name).toBe("airrates");
    expect((await rpc("tools/list")).result?.tools.map((t) => t.name)).toContain("get_top_spreads");
    const status = await rpc("tools/call", { name: "get_data_status", arguments: {} });
    expect(status.result?.content[0]?.text).toContain("markets");
    expect((await rpc("tools/call", { name: "nope" })).error?.code).toBe(-32602);
    expect((await rpc("resources/list")).error?.code).toBe(-32601);
    const note = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(note.status).toBe(202);
  });

  test("sitemap.xml lists canonical page URLs as XML", async () => {
    const res = await get("/sitemap.xml", fakeData().data);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const body = await res.text();
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(body).toContain("<loc>https://airrates.net/</loc>");
    expect(body).toContain("<loc>https://airrates.net/about</loc>");
    expect(body).not.toContain("/markets/asset/");
    const cell = (venue_id: string) => ({
      asset_class: "crypto" as const,
      base: "BTC",
      venue_id,
      venue_symbol: `BTC-${venue_id}`,
      apr: 1,
      apr_7d: null,
      apr_30d: null,
      apr_60d: null,
      open_interest_usd: 1_000,
      asset_oi_usd: 2_000,
    });
    const withAssets = await get(
      "/sitemap.xml",
      fakeData({ heatmap: async () => [cell("gate"), cell("bybit")] }).data,
    );
    const listed = await withAssets.text();
    expect(listed).toContain("<loc>https://airrates.net/markets/asset/BTC</loc>");
    expect(listed.match(/markets\/asset\/BTC/g)).toHaveLength(1);
    const broken = await get(
      "/sitemap.xml",
      fakeData({
        heatmap: async () => {
          throw new Error("down");
        },
      }).data,
    );
    expect(broken.status).toBe(200);
  });
});

describe("pivot", () => {
  const cell = (
    base: string,
    venue_id: string,
    apr: number,
    openInterest: number | null,
    assetOi: number,
  ): HeatmapCell => ({
    asset_class: "crypto" as const,
    base,
    venue_id,
    venue_symbol: `${base}-${venue_id}`,
    apr,
    apr_7d: null,
    apr_30d: null,
    apr_60d: null,
    open_interest_usd: openInterest,
    asset_oi_usd: assetOi,
  });

  test("groups by asset, keeps the query's row order, and orders columns by depth", () => {
    const { rows, venueIds } = pivot([
      cell("BTC", "gate", 10, 5_000, 9_000),
      cell("BTC", "bybit", -2, 4_000, 9_000),
      cell("ETH", "bybit", 3, 8_000, 8_000),
    ]);

    // The query already ranks assets by depth, so the pivot must not re-order them.
    expect(rows.map((r) => r.base)).toEqual(["BTC", "ETH"]);
    expect(rows[0]?.assetOiUsd).toBe(9_000);
    // bybit totals 12,000 across the grid against gate's 5,000, so it takes the first column.
    expect(venueIds).toEqual(["bybit", "gate"]);
    expect(rows[0]?.byVenue.get("gate")?.apr).toBe(10);
  });

  test("a combination that does not exist stays absent rather than becoming zero", () => {
    const { rows } = pivot([cell("BTC", "gate", 10, 1, 1), cell("ETH", "bybit", 3, 1, 1)]);
    // ~62% of the grid is empty, so "no market here" must never be readable as "0% funding".
    expect(rows[0]?.byVenue.has("bybit")).toBe(false);
    expect(rows[0]?.byVenue.get("bybit")).toBeUndefined();
  });
});

describe("bestPair", () => {
  test("picks the widest cross-venue spread and never pairs a venue with itself", () => {
    const rows = [
      market({ venue_id: "okx", venue_symbol: "A", apr: -20 }),
      market({ venue_id: "okx", venue_symbol: "B", apr: 50 }),
      market({ venue_id: "gate", venue_symbol: "C", apr: 10 }),
    ];
    // A→B would be 70 points but both are on OKX; A→C is 30 and C→B is 40, so C→B wins.
    const best = bestPair(rows);
    expect(best?.long.venue_symbol).toBe("C");
    expect(best?.short.venue_symbol).toBe("B");
    expect(bestPair([rows[0] as MarketRow])).toBeNull();
  });
});

describe("language", () => {
  const getIn = (path: string, locale: Locale) =>
    handleApp(new Request(`https://airates.test${path}`), {
      data: fakeData().data,
      now: () => NOW,
      locale,
    });

  test("a page renders in the reader's language, frame and all", async () => {
    const html = await (await getIn("/", "zh")).text();
    expect(html).toContain('<html lang="zh-Hans">');
    expect(html).toContain('aria-current="true">中文</a>');
    expect(html).toContain(">筛选器</a>");
  });

  test("Japanese pages are Japanese, glyphs and all", async () => {
    const html = await (await getIn("/", "ja")).text();
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('aria-current="true">日本語</a>');
    expect(html).toContain(">スクリーナー</a>");
    expect(html).toContain('<meta property="og:locale" content="ja_JP">');
  });

  test("Korean pages are Korean", async () => {
    const html = await (await getIn("/", "ko")).text();
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain('aria-current="true">한국어</a>');
    expect(html).toContain('<meta property="og:locale" content="ko_KR">');
  });

  test("Russian pages are Russian", async () => {
    const html = await (await getIn("/", "ru")).text();
    expect(html).toContain('<html lang="ru">');
    expect(html).toContain('aria-current="true">Русский</a>');
    expect(html).toContain('<meta property="og:locale" content="ru_RU">');
  });

  test("English is the default, and its switch points back at the page", async () => {
    const html = await (await get("/screener", fakeData().data)).text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('aria-current="true">English</a>');
    expect(html).toContain('href="/lang/zh?back=%2Fscreener"');
    expect(html).toContain('href="/lang/ja?back=%2Fscreener"');
    expect(html).toContain('href="/lang/ko?back=%2Fscreener"');
    expect(html).toContain('href="/lang/ru?back=%2Fscreener"');
  });

  test("a not-found message is translated too", async () => {
    const res = await getIn("/markets/exchange/nope", "zh");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("没有这个名称的交易所。");
  });

  test("the JSON API reads the same in every language", async () => {
    const en = await (await getIn("/v1/venues", "en")).text();
    const zh = await (await getIn("/v1/venues", "zh")).text();
    expect(zh).toBe(en);
  });

  test("the busy page follows the language", async () => {
    expect(await unavailableResponse("/rates", NOW, "zh").text()).toContain(
      '<html lang="zh-Hans">',
    );
  });
});

describe("link previews", () => {
  test("every page names the share card for Facebook and X, and the card is a 1200x630 PNG", async () => {
    const { data } = fakeData();
    const html = await (await get("/", data)).text();
    // Absolute: Facebook and X fetch the card from their own servers.
    expect(html).toContain(
      '<meta property="og:image" content="https://airrates.net/share-card.png">',
    );
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
    expect(html).toContain('<meta property="og:image:alt" content="airrates: what settled');
    expect(html).toContain('<meta property="og:locale" content="en_US">');
    expect(html).toContain('<meta property="og:locale:alternate" content="zh_CN">');
    expect(html).toContain('<meta property="og:locale:alternate" content="ja_JP">');
    expect(html).toContain('<meta property="og:locale:alternate" content="ko_KR">');
    expect(html).toContain('<meta property="og:locale:alternate" content="ru_RU">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');

    // The size the tags claim is the size served: a mismatch makes Facebook crop or refuse it.
    const card = await get("/share-card.png", data);
    expect(card.status).toBe(200);
    expect(card.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await card.arrayBuffer());
    expect(String.fromCharCode(...bytes.subarray(1, 4))).toBe("PNG");
    const header = new DataView(bytes.buffer, bytes.byteOffset);
    expect(header.getUint32(16)).toBe(1200);
    expect(header.getUint32(20)).toBe(630);
  });

  test("a Chinese page tells Facebook it is Chinese, with English as the alternate", async () => {
    const { data } = fakeData();
    const html = await (
      await handleApp(new Request("https://airates.test/"), { data, now: () => NOW, locale: "zh" })
    ).text();
    expect(html).toContain('<meta property="og:locale" content="zh_CN">');
    expect(html).toContain('<meta property="og:locale:alternate" content="en_US">');
  });

  test("a not-found page stays out of search, unlike the busy page", async () => {
    const { data } = fakeData();
    const res = await get("/liquidations/not%20an%20asset", data);
    expect(res.status).toBe(404);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });
});

describe("whales", () => {
  const T = NOW;
  const minutes = (n: number) => new Date(T - n * 60_000);
  const btc = {
    venue_symbol: "BTCUSDT",
    asset_class: "crypto" as const,
    base: "BTC",
    rank: 1,
    global_open_interest_usd: 34e9,
    floor_usd: 1.02e6,
    price_step: null,
    updated_at: minutes(5),
    last_price: 83050,
    change_24h_pct: 0.52,
    bid_walls_usd: 156.7e6,
    ask_walls_usd: 166.8e6,
    buy_usd_24h: 9e6,
    sell_usd_24h: 9.7e6,
  };
  const eth = {
    ...btc,
    venue_symbol: "ETHUSDT",
    base: "ETH",
    rank: 2,
    floor_usd: 690_000,
    last_price: 2506.6,
    change_24h_pct: -0.71,
    buy_usd_24h: 0,
    sell_usd_24h: 0,
  };
  const candles = [0, 1, 2, 3].map((i) => ({
    open_time: minutes(60 - i * 15),
    open: 83000 + i * 10,
    high: 83100 + i * 10,
    low: 82900 + i * 10,
    close: 83020 + i * 10,
    volume_usd: 1_000_000 * (i + 1),
  }));
  const wall = (over: Partial<import("./data").WhaleWall>) => ({
    side: "bid" as const,
    price: 82000,
    first_seen: minutes(50),
    last_seen: minutes(1),
    start_usd: 18e6,
    peak_usd: 19e6,
    current_usd: 18.86e6,
    status: "open" as const,
    ended_at: null,
    orders: null,
    ...over,
  });
  const trade = (over: Partial<import("./data").WhaleTrade>) => ({
    side: "buy" as const,
    price: 83030,
    traded_at: minutes(20),
    notional_usd: 1.69e6,
    fills: 1,
    taker: null,
    ...over,
  });
  const book = {
    markets: [btc, eth],
    venues: ["binance", "hyperliquid"],
    market: btc,
    candles,
    trades: [
      trade({}),
      trade({
        side: "sell",
        price: 82990,
        traded_at: minutes(40),
        notional_usd: 1.17e6,
        fills: 26,
      }),
    ],
    tally: { filled: 1, pulled: 1, buys: 3, buy_usd: 4.2e6, sells: 1, sell_usd: 1.17e6 },
    walls: [
      wall({}),
      wall({ side: "ask", price: 84000, current_usd: 17.3e6, peak_usd: 17.3e6 }),
      // On the chart: the candles run 82,900-83,130, and the axis is their range with a margin.
      wall({ price: 82950, current_usd: 3e6, peak_usd: 3e6 }),
      wall({
        price: 82960,
        status: "filled",
        current_usd: 0,
        peak_usd: 4e6,
        ended_at: minutes(10),
      }),
      wall({
        price: 83090,
        side: "ask",
        status: "pulled",
        current_usd: 0,
        peak_usd: 6e6,
        ended_at: minutes(5),
      }),
    ],
  };

  test("/whales charts BTC's walls over its candles, with the tiles and both tables", async () => {
    const seen: unknown[] = [];
    const { data } = fakeData({
      whales: async (opts) => {
        seen.push(opts);
        return book;
      },
    });
    const res = await get("/whales", data);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(seen).toEqual([
      {
        venue: "binance",
        base: "BTC",
        assetClass: null,
        windowHours: 24,
        barMinutes: 15,
        pulled: false,
      },
    ]);
    // Candles set the axis; walls inside it are lines with a hover title, the largest beyond it are
    // named at the edge they lie past.
    expect(html).toContain('class="wh-up"');
    expect(html).toContain('class="wh-wall wh-bid wh-open"');
    expect(html).toContain('class="wh-wall wh-bid wh-filled"');
    expect(html).toContain("bid wall 82,950 · $3.0M · resting");
    expect(html).not.toContain("bid wall 82,000");
    expect(html).toContain(
      `${icon("up")} off the chart: <span class="wh-ask-t">$17.3M 84,000 <span class="dim">+1.1%</span></span>`,
    );
    expect(html).toContain(`${icon("down")} off the chart: <span class="wh-bid-t">$18.9M 82,000`);
    // A volume strip and the hover reading of each candle.
    expect(html).toContain('class="fchart-plot wh-volume"');
    expect(html).toContain('"kind":"wcandle"');
    // Pulled walls are hidden by default, from the chart and the ended table alike.
    expect(html).not.toContain("wh-wall wh-ask wh-pulled");
    expect(html).not.toContain(">pulled<");
    // Tiles: the resting totals and the largest wall.
    expect(html).toContain('<span data-u="bids">$21.9M</span>');
    expect(html).toContain('<span data-u="asks">$17.3M</span>');
    expect(html).toContain("bid at 82,000");
    // The market strip links every tracked market; BTC is the current one.
    expect(html).toContain('href="/whales/ETH"');
    expect(html).toContain('<a class="wh-pick-row on" href="/whales"');
  });

  test("large trades draw as circles, with their tiles and table", async () => {
    const html = await (await get("/whales", fakeData({ whales: async () => book }).data)).text();
    // One round HTML circle per burst, sized by notional, the biggest 24px across.
    expect(html).toContain('class="wh-trade wh-buy"');
    expect(html).toContain('class="wh-trade wh-sell"');
    expect(html).toContain("width:22.0px;height:22.0px");
    expect(html).toContain('title="taker buy $1.7M at 83,030 · one fill ·');
    expect(html).toContain('title="taker sell $1.2M at 82,990 · 26 fills ·');
    // The tiles count the whole window from the tally, not from the capped lists.
    expect(html).toContain('<span data-u="buys">$4.2M</span>');
    expect(html).toContain("3 taker bursts of $1.0M or more");
    expect(html).toContain('<span data-u="sells">$1.2M</span>');
    expect(html).toContain('<span data-u="pulled">1</span>');
    expect(html).toContain("Largest trades in the last 24h");
    expect(html).toContain('<tbody data-live="wh-trades">');
  });

  test("the three tables are one panel: a button opens it on a desktop, a phone has it in the page", async () => {
    const html = await (await get("/whales", fakeData({ whales: async () => book }).data)).text();
    // The button sits beside the market picker and counts the walls resting.
    expect(html).toContain(
      '</details></div><button type="button" class="wh-book-btn" popovertarget="wh-book">',
    );
    expect(html).toContain('data-live="wh-book-n"><span data-u="open">3</span> resting</span>');
    // One copy of every table, all of them inside the panel: live refresh matches regions by name.
    const panel =
      html.split('<section class="wh-book" id="wh-book" popover')[1]?.split("</section>")[0] ?? "";
    for (const region of ["wh-open", "wh-ended", "wh-trades"]) {
      expect(panel).toContain(`<tbody data-live="${region}">`);
      expect(html.split(`<tbody data-live="${region}">`)).toHaveLength(2);
    }
    for (const heading of [
      "Resting now",
      "Ended in the last 24h",
      "Largest trades in the last 24h",
    ])
      expect(panel).toContain(heading);
    // The help panel is inside it too: a popover opened from outside would close the one it explains.
    expect(panel).toContain('id="help-wh-open" popover');
    // The script only places the panel; the button opens it without one.
    expect(html).toContain('getElementById("wh-book")');
    expect(() => new Function(BOOK_SCRIPT)).not.toThrow();
    expect(BOOK_SCRIPT.toLowerCase()).not.toContain("</script");
  });

  test("a window with no large trade says so", async () => {
    const quiet = { ...book, trades: [], tally: { ...book.tally, buys: 0, sells: 0 } };
    const html = await (await get("/whales", fakeData({ whales: async () => quiet }).data)).text();
    expect(html).not.toContain("wh-trade wh-");
    expect(html).toContain("No taker burst of $1.0M or more in the last 24h.");
  });

  test("the market picker lists every market with what a reader picks one by", async () => {
    const html = await (await get("/whales", fakeData({ whales: async () => book }).data)).text();
    // The current market as the button, with its price and day.
    expect(html).toContain('<summary class="wh-pick-btn"');
    expect(html).toContain("2 markets");
    // A row per market: a plain link, so the picker works without its script.
    expect(html).toContain('<a class="wh-pick-row on" href="/whales"');
    expect(html).toContain('<a class="wh-pick-row" href="/whales/ETH"');
    expect(html).toContain('data-q="eth ethusdt crypto"');
    expect(html).toContain("+0.52%");
    expect(html).toContain(`${"−"}0.71%`);
    // Walls each side as a split bar with both totals, and the day's whale flow, net.
    expect(html).toContain('class="wh-pick-bid" style="width:48.4%"');
    expect(html).toContain(
      '<span class="cvd-up">$157M</span> / <span class="cvd-down">$167M</span>',
    );
    expect(html).toMatch(/class="num cvd-down">−\$700k<\/span>/);
    // The filter box is revealed by the script.
    expect(html).toContain('class="wh-pick-q" type="search"');
    expect(html).toContain('closest(".wh-pick")');
    // The filter splits on whitespace: a template literal would turn a bare \s into a plain "s".
    expect(html).toContain("split(/\\s+/)");
    expect(html).not.toContain('class="wh-markets"');
  });

  test("the venue switch keeps the asset where the other venue tracks it", async () => {
    const both = await (
      await get("/whales/ETH", fakeData({ whales: async () => ({ ...book, market: eth }) }).data)
    ).text();
    expect(both).toContain('href="/whales/ETH?venue=hyperliquid">Hyperliquid</a>');
    const binanceOnly = await (
      await get(
        "/whales/ETH",
        fakeData({ whales: async () => ({ ...book, market: eth, venues: ["binance"] }) }).data,
      )
    ).text();
    expect(binanceOnly).toContain('href="/whales?venue=hyperliquid">Hyperliquid</a>');
    expect(binanceOnly).toContain('aria-current="page">Binance</a>');
  });

  test("on Hyperliquid a wall is a bucket with its orders, and a trade names its taker", async () => {
    const hlBtc = { ...btc, venue_symbol: "BTC", price_step: 100 };
    const gold = {
      ...btc,
      venue_symbol: "xyz:GOLD",
      base: "XAU",
      asset_class: "commodity" as const,
      rank: 5,
      price_step: 10,
    };
    const taker = "0x2025137a136bea7446deba681cbfc7cf1970840e";
    const hl = {
      ...book,
      markets: [hlBtc, gold],
      market: hlBtc,
      walls: [wall({ price: 82900, current_usd: 2.6e6, peak_usd: 2.6e6, orders: 2 })],
      trades: [trade({ taker })],
    };
    const seen: { venue: string }[] = [];
    const html = await (
      await get(
        "/whales?venue=hyperliquid",
        fakeData({
          whales: async (opts) => {
            seen.push(opts);
            return hl;
          },
        }).data,
      )
    ).text();
    expect(seen[0]?.venue).toBe("hyperliquid");
    expect(html).toContain("BTC · Hyperliquid perp · 15-minute candles, <span data-tz>UTC</span>");
    // The bucket's range, how many orders share it, and the least its largest holds.
    expect(html).toContain("82,900–83,000");
    expect(html).toContain("bid wall 82,900–83,000 · $2.6M in 2 orders, one at least $1.3M");
    expect(html).toContain(">Largest ≥</th>");
    // Two more columns a table: too wide for three side by side, so it stays two across (layout.ts).
    expect(html).toContain('<section class="wh-book wh-book-wide" id="wh-book" popover');
    expect(html).toContain("$100 wide");
    // Drawn and labelled at the bucket's middle.
    expect(html).toContain("$2.6M ~82,950");
    // The taker, linked to Hyperliquid's explorer.
    expect(html).toContain(
      `<a class="wh-addr" href="https://app.hyperliquid.xyz/explorer/address/${taker}" target="_blank" rel="noopener" title="${taker}">0x2025…840e</a>`,
    );
    expect(html).toContain("taker 0x2025…840e");
    // A HIP-3 market shows its own name in the picker.
    expect(html).toContain("<small>xyz:GOLD</small>");
    expect(html).toContain('href="/whales/commodity/XAU?venue=hyperliquid"');
  });

  test("the interval and the pulled toggle are read from the address, old windows too", async () => {
    const seen: unknown[] = [];
    const { data } = fakeData({
      whales: async (opts) => {
        seen.push(opts);
        return { ...book, market: eth };
      },
    });
    const html = await (await get("/whales/ETH?window=6h&pulled=1", data)).text();
    expect(seen).toEqual([
      {
        venue: "binance",
        base: "ETH",
        assetClass: null,
        windowHours: 8,
        barMinutes: 5,
        pulled: true,
      },
    ]);
    expect(html).toContain("wh-wall wh-ask wh-pulled");
    expect(html).toContain(">pulled<");
    // The old 6h window lands on 5-minute candles, and the toggle keeps that interval.
    expect(html).toContain('href="/whales/ETH?interval=5m">hide pulled walls');
    const hourly = await (await get("/whales/ETH?interval=4h", data)).text();
    expect(seen.at(-1)).toMatchObject({ windowHours: 336, barMinutes: 240 });
    expect(hourly).toContain('aria-current="page">4h<');
  });

  test("an asset outside the forty is a 404 that says so", async () => {
    const { data } = fakeData({
      whales: async () => ({ ...book, market: null, candles: [], walls: [], trades: [] }),
    });
    const res = await get("/whales/DOGE", data);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("DOGE is not one of the markets tracked on Binance.");
    // No tables to open, so no button for them.
    expect(html).not.toContain('class="wh-book-btn"');
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  test("before the feed has ranked any market the page explains rather than 404s", async () => {
    const res = await get("/whales", fakeData().data);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("The whale-order feed has not ranked its markets yet.");
  });

  test("the nav and the sitemap carry the page", async () => {
    const html = await (await get("/whales", fakeData({ whales: async () => book }).data)).text();
    expect(html).toContain('href="/whales"');
    const sitemap = await (await get("/sitemap.xml", fakeData().data)).text();
    expect(sitemap).toContain("<loc>https://airrates.net/whales</loc>");
  });

  describe("the GEX switch over the chart", () => {
    const exposure = (spot: number, computedAgoMs = 2 * 60_000) => ({
      ...NO_GREEKS,
      scope: "all",
      computed_at: new Date(T - computedAgoMs),
      source: "deribit",
      unit: "USD",
      spot,
      options: 900,
      expiries: 12,
      first_expiry: new Date(T + 20 * 3600_000),
      last_expiry: new Date(T + 300 * 86_400_000),
      next_expiry: new Date(T + 20 * 3600_000),
      call_oi: 1,
      put_oi: 1,
      call_gex_usd: 26e6,
      put_gex_usd: -23e6,
      net_gex_usd: 3e6,
      flip_price: 83_100,
      call_wall: 90_000,
      put_wall: 80_000,
    });
    const gammaFor = (
      spot: number,
      computedAgoMs?: number,
      expiries: GammaData["expiries"] = [],
    ) => {
      const calls: string[] = [];
      const { data } = fakeData({
        whales: async () => book,
        gamma: async ({ currency }) => {
          calls.push(currency);
          return {
            currency,
            books: [],
            scopes: [],
            exposure: exposure(spot, computedAgoMs),
            strikes: [
              {
                ...NO_GREEKS,
                strike: 83_000,
                call_oi: 1,
                put_oi: 1,
                call_gex_usd: 4.2e6,
                put_gex_usd: -1.1e6,
              },
              {
                ...NO_GREEKS,
                strike: 70_000,
                call_oi: 1,
                put_oi: 1,
                call_gex_usd: 1e6,
                put_gex_usd: -9e6,
              },
            ],
            curve: [
              { price: 82_000, net_gex_usd: -2e6 },
              { price: 84_000, net_gex_usd: 5e6 },
            ],
            expiries,
            bands: [],
          };
        },
      });
      return { data, calls };
    };

    test("a ticker with its own book gets the switch, off until the reader picks a view", async () => {
      const { data, calls } = gammaFor(83_000);
      const html = await (await get("/whales", data)).text();
      expect(calls).toEqual(["BTC"]);
      expect(html).toContain('<div class="slot-modes whx-modes" role="group"');
      expect(html).toContain('data-whgex="off" aria-pressed="true"');
      // The switch sits under the market picker, not among the chart's keys.
      expect(html).toMatch(
        /<div class="wh-pick-stack"><details class="wh-pick">[\s\S]*?<\/details><div class="slot-modes whx-modes"/,
      );
      expect(html).not.toMatch(/class="fchart-keys wh-keys">[^\n]*whx-modes/);
      // The strike on the chart is drawn, with its reading; the one far below the candles is not.
      expect(html).toContain("Strike 83,000 · calls +$4.2M · puts −$1.1M · net +$3.1M per 1% move");
      expect(html).not.toContain("Strike 70,000");
      // The flip falls inside the candles' range, so it is a line with its label; the walls do not.
      expect(html).toContain('class="whx-flip"');
      expect(html).toContain("flip 83,100</span>");
      expect(html).not.toContain("call wall 90,000</span>");
      expect(html).toContain("Deribit options, all expiries");
      expect(html.match(/window\.airratesWhaleGex = true/g)).toHaveLength(1);
    });

    test("a book with its IVs adds the expected move a day ahead, as bands across the candles", async () => {
      const expiry = (ms: number, atm_iv: number) => ({
        ...NO_GREEKS,
        expiry: new Date(T + ms),
        options: 10,
        call_oi: 1,
        put_oi: 1,
        call_gex_usd: 1,
        put_gex_usd: -1,
        atm_iv,
        forward: 83_000,
        premium: null,
        max_pain: null,
        be_low: null,
        be_high: null,
      });
      const { data } = gammaFor(83_000, undefined, [
        expiry(20 * 3600_000, 0.05),
        expiry(300 * 86_400_000, 0.05),
      ]);
      const html = await (await get("/whales", data)).text();
      expect(html).toContain('data-whgex="move" aria-pressed="false"');
      expect(html).toContain('<g class="whx whx-move"><rect class="whx-em2"');
      expect(html).toContain('<rect class="whx-em1"');
      // One flat IV: the move is 83,000 x 5% x sqrt(1/365) either side.
      expect(html).toContain("expected move, 1σ and 2σ, 1 day ahead · IV 5.0%");
      const move = 83_000 * 0.05 * Math.sqrt(1 / 365);
      expect(html).toContain(`1σ ${Math.round(83_000 + move).toLocaleString("en-US")}</span>`);
      // Without IVs (a book read before the collector kept them), the bands are left out.
      const bare = await (await get("/whales", gammaFor(83_000).data)).text();
      expect(bare).not.toContain('<rect class="whx-em1"');
      expect(bare).not.toContain("expected move, 1σ and 2σ");
    });

    test("no switch where the book would sit wrong on the axis, is too old, or does not exist", async () => {
      // A book quoting another unit: its spot 20% from the perp's price.
      const far = await (await get("/whales", gammaFor(100_000).data)).text();
      expect(far).not.toContain('class="slot-modes whx-modes"');
      // Deribit is live: a read six hours old is too old to show as positioning.
      const old = await (await get("/whales", gammaFor(83_000, 7 * 3600_000).data)).text();
      expect(old).not.toContain('class="slot-modes whx-modes"');
      // SOL has no option book, so nothing is read at all.
      const { data, calls } = gammaFor(83_000);
      const sol = await (await get("/whales/SOL", data)).text();
      expect(calls).toEqual([]);
      expect(sol).not.toContain('class="slot-modes whx-modes"');
    });
  });
});

describe("load shedding", () => {
  // What a shed render's data source is (index.ts): every query refused before a connection is asked for.
  const refused = new Proxy({} as DataSource, {
    get: () => async () => {
      throw new Error("load shedding: the database is reserved for page readers");
    },
  });

  test("a shed render answers busy at once for the API and for pages that read data", async () => {
    const api = await get("/v1/rates", refused);
    expect(api.status).toBe(503);
    expect(await api.json()).toEqual({ error: "data_unavailable" });
    // Even the homepage, whose sections fail soft one by one: its header reads the database too.
    for (const path of ["/liquidations/BTC", "/whales", "/"]) {
      const res = await get(path, refused);
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  test("routes that read nothing still answer a shed caller", async () => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/v1/openapi.json", "/v1/venues"]) {
      expect((await get(path, refused)).status).toBe(200);
    }
  });
});

describe("site-wide search", () => {
  test("/data/search lists every asset compactly, deepest first, cached five minutes", async () => {
    const { data } = fakeData();
    const response = await get("/data/search", data);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    // [ticker, class index, venues, open interest (0 unknown), quoted, whale venue or 0]
    expect(await response.json()).toEqual({
      a: [
        ["BTC", 0, 24, 32_000_000_000, 1, "binance"],
        ["AAPL", 1, 6, 0, 0, 0],
      ],
    });
  });

  test("every page carries the overlay, its button hidden until the script reveals it", async () => {
    const { data } = fakeData();
    const html = await (await get("/screener", data)).text();
    expect(html).toContain('<div class="cmdk" id="cmdk" hidden>');
    expect(html).toMatch(/<button type="button" class="cmdk-btn" data-cmdk-open hidden/);
    expect(html.match(/window\.airratesSearch = open/g)).toHaveLength(1);
    // The plain K key is one of the site's shortcuts, so /keys lists it.
    expect(html).toContain('"search":{"key":"k"');
  });
});
