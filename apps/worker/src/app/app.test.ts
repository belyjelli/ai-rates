import { describe, expect, test } from "bun:test";
import { bestPair, pivot } from "../web/pages";
import { handleApp } from "./app";
import type {
  DataSource,
  HeatmapCell,
  MarketRow,
  Overview,
  ScreenerFilters,
  ScreenerPair,
} from "./data";
import { DEFAULT_FILTERS } from "./params";

const NOW = Date.parse("2026-09-12T12:00:00Z");

const overview: Overview = {
  markets: 4286,
  venues: 20,
  assets: 1200,
  open_interest_usd: 9e10,
  updated_at: new Date(NOW - 12_000),
};

const pair: ScreenerPair = {
  asset: "BTC",
  venue_count: 11,
  spread_apr: 11.5,
  spread_apr_7d: 8.2,
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
    leverageTiers: async () => [],
    settlements: async () => [],
    ...overrides,
  };
  return { data, calls };
}

/** `count` settlements at `everyHours`, ending just before NOW. */
const settled = (venue_id: string, venue_symbol: string, rate: number, count = 3) =>
  Array.from({ length: count }, (_, i) => ({
    venue_id,
    venue_symbol,
    settled_at: new Date(NOW - (count - i) * 8 * 3_600_000),
    rate,
    basis_hours: 8,
  }));

const get = (path: string, data: DataSource) =>
  handleApp(new Request(`https://airates.test${path}`), { data, now: () => NOW });

describe("pages", () => {
  test("home shows the widest pair as the hero and a top-spreads table", async () => {
    const { data, calls } = fakeData();
    const res = await get("/", data);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain('class="hero-asset" href="/markets/asset/BTC">BTC<');
    expect(html).toContain("Long on <a");
    expect(html).toContain("Gate");
    expect(html).toContain("Lighter");
    expect(html).toContain("4,286 markets · 20 venues · updated");
    expect(calls.screener).toEqual([{ ...DEFAULT_FILTERS, limit: 12 }]);
  });

  test("screener passes parsed filters through and reflects them in the form", async () => {
    const { data, calls } = fakeData();
    const html = await (await get("/screener?min_oi=1m&types=cex&limit=50", data)).text();

    expect(calls.screener[0]).toMatchObject({
      minOpenInterestUsd: 1_000_000,
      venueTypes: ["cex"],
      limit: 50,
    });
    expect(html).toContain('<option value="1000000" selected>');
    expect(html).toContain('value="cex" checked');
    expect(html).not.toContain('value="dex" checked');
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
    expect(html).toContain('title="Widest funding gap between two exchanges">Spread</th>');
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
    expect(await okx.text()).toContain("<h1>OKX</h1>");
    expect((await get("/markets/exchange/nope", data)).status).toBe(404);

    const btc = await get("/markets/asset/btc", data);
    expect(btc.status).toBe(200);
    expect(await btc.text()).toContain("Best pair: long on Gate");
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
      settlements: async () => [
        ...settled("gate", "BTC_USDT", -0.0001),
        ...settled("okx", "BTC-USDT-SWAP", 0.0001),
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
    expect(html).toContain("Trading fees are excluded");
  });

  test("pair capital is margined at the lower of the two venues' leverage", async () => {
    const legs = (long: number | null, short: number | null) => ({
      asset: async () => [
        market({ venue_id: "gate", venue_symbol: "BTC_USDT", apr: -0.55, max_leverage: long }),
        market({ max_leverage: short }),
      ],
      settlements: async () => [
        ...settled("gate", "BTC_USDT", -0.0001),
        ...settled("okx", "BTC-USDT-SWAP", 0.0001),
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
        settlements: async () => [
          ...settled("gate", "BTC_USDT", -0.0001),
          ...settled("okx", "BTC-USDT-SWAP", 0.0001),
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

  test("rates renders the matrix, dashes absent markets and escapes asset names", async () => {
    const hcell = (
      base: string,
      venue_id: string,
      apr: number,
      apr_60d: number | null,
      openInterest: number,
      assetOi: number,
    ): HeatmapCell => ({
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
    expect(html).toContain('<td class="none">–</td>');

    // The row's own spread: cheapest to hold long (bybit at -4) against richest to hold short
    // (gate at +12), so 16 points apart. Swapping the legs would be invisible on the page.
    expect(html).toContain("long=bybit&short=gate");
    expect(html).toContain("+16.0%");

    // Asset names reach the page from the database and are escaped like everything else.
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");

    // Nothing to page to, so "next" is inert rather than a link into an empty page.
    expect(html).toContain('<span class="dim">next →</span>');
  });

  test("rates timeframe switches which stored column the cells read", async () => {
    const hcell = (base: string, venue_id: string, apr: number, apr_60d: number | null) => ({
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
    expect(long).toContain("<b>60d</b>");
    expect(long).toContain("+3.00%");
    // The live column must not leak into the 60d view.
    expect(long).not.toContain("+12.0%");
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
    expect(html).toContain('<form class="filters" method="get" action="/pair/BTC">');
    expect(html).not.toContain('class="headline');
    expect((await get("/pair/NOPE", data)).status).toBe(404);
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
    expect(await res.text()).toContain("Market data is unavailable");
    expect(logs).toEqual(["/: connection refused"]);
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
  });

  test("pair backtest replays both legs over the window", async () => {
    const { data } = fakeData({
      settlements: async () => [
        // Both legs are paid: a negative rate pays the long, a positive one pays the short.
        ...settled("gate", "BTC_USDT", -0.0001),
        ...settled("okx", "BTC-USDT-SWAP", 0.0001),
      ],
    });

    const res = await get("/v1/pairs/BTC/backtest?long=gate&short=okx&size=10k&days=7", data);
    expect(res.status).toBe(200);
    // Funding settles hourly at most, so the answer keeps for an hour.
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");

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

  test("pair backtest needs two different exchanges that both list the asset", async () => {
    const { data } = fakeData();
    expect((await get("/v1/pairs/BTC/backtest", data)).status).toBe(400);
    expect((await get("/v1/pairs/BTC/backtest?long=gate&short=gate", data)).status).toBe(400);
    expect((await get("/v1/pairs/BTC/backtest?long=gate&short=nope", data)).status).toBe(400);
    // bybit is a real venue, but the fake has no bybit market for BTC.
    expect((await get("/v1/pairs/BTC/backtest?long=gate&short=bybit", data)).status).toBe(404);
    expect((await get("/v1/pairs/NOPE/backtest?long=gate&short=okx", data)).status).toBe(404);
  });

  test("robots.txt blocks crawlers before launch", async () => {
    const res = await get("/robots.txt", fakeData().data);
    expect(await res.text()).toBe("User-agent: *\nDisallow: /\n");
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
