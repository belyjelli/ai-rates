import { describe, expect, test } from "bun:test";
import { bestPair, pivot } from "../web/pages";
import { handleApp } from "./app";
import { CLEARANCE_COOKIE, createClearance } from "./clearance";
import type {
  ArbitrageRow,
  DataSource,
  HeatmapCell,
  MarketRow,
  Overview,
  PriceQuote,
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
    leverageTiers: async () => [],
    settlements: async () => [],
    verifiedPairs: async () => [],
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

  test("the verified ranking shows each row's risk, and links its own legs", async () => {
    const verified = {
      run_day: new Date("2026-09-12T00:00:00Z"),
      asset: "IOST",
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

  /** The ONE case as it was actually measured: a wide quoted gap resting on almost nothing. */
  const gap = (overrides: Partial<ArbitrageRow> = {}): ArbitrageRow => ({
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
    ...overrides,
  });

  test("a price gap shows the size it is good for, which is the thinner side", async () => {
    const { data } = fakeData({ arbitrage: async () => [gap()] });
    const html = await (await get("/arbitrage", data)).text();

    expect(html).toContain("269.6");
    // Both sides are rendered, but the figure the row is titled with is the SMALL one: a 269 bps
    // gap against $2k of resting size is a quote, not a trade.
    expect(html).toContain("$2.0k");
    expect(html).toContain("$220k");
    expect(html).toContain("Good for about $2.0k");
    // Buy/sell are their own classes: reusing long/short would borrow a funding meaning that a
    // price gap does not have.
    expect(html).toContain("buy-leg");
    expect(html).toContain("sell-leg");
    expect(html).toContain("quotable gaps at the size shown");
  });

  test("an unknown resting size says so instead of reading as zero", async () => {
    const { data } = fakeData({
      arbitrage: async () => [gap({ buy_depth_usd: null, thinner_depth_usd: null })],
    });
    const html = await (await get("/arbitrage", data)).text();

    // esc() turns the apostrophe into an entity, so the assertion avoids one rather than guessing
    // which form reaches the page.
    expect(html).toContain("resting size is unknown");
    expect(html).not.toContain("Good for about");
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

  test("an empty table explains that most assets quote nothing", async () => {
    const { data } = fakeData({ arbitrage: async () => [] });
    const html = await (await get("/arbitrage", data)).text();
    expect(html).toContain("No asset quotes a gap this wide right now");
  });

  /** Two venues that agree, plus one marked 1375x out -- the KR200 shape. */
  const quote = (overrides: Partial<PriceQuote> = {}): PriceQuote => ({
    venue_id: "gate",
    venue_symbol: "ONE_USDT",
    best_bid: 0.01131,
    best_ask: 0.01133,
    best_bid_size_usd: 50_000,
    best_ask_size_usd: 20_000,
    mark_price: 0.01132,
    median_mark: 0.01132,
    mark_agrees: true,
    observed_at: new Date(NOW - 20_000),
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
    expect(html).toContain("Trading fees are excluded because none were given");
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
    expect(long).toContain('aria-current="true">60d</a>');
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

  test("supplied fees are charged on four fills, and one leg alone charges nothing", async () => {
    const { data } = fakeData({
      settlements: async () => [
        ...settled("gate", "BTC_USDT", -0.0001),
        ...settled("okx", "BTC-USDT-SWAP", 0.0001),
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
    // $6 over 7 days is ~$0.857 a day, so $20 of fees takes ~23 days to repay.
    expect(body.paybackDays).toBeCloseTo(20 / (6 / 7), 6);
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
      settlements: async () => [
        ...settled("gate", "BTC_USDT", -0.0001),
        ...settled("okx", "BTC-USDT-SWAP", 0.0001),
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

  test("an uncached backtest is challenged, and the rejection is never cached", async () => {
    const { data } = fakeData({
      settlements: async () => [
        ...settled("gate", "BTC_USDT", -0.0001),
        ...settled("okx", "BTC-USDT-SWAP", 0.0001),
      ],
    });
    const seen: { token: string | null; remoteip: string | null }[] = [];
    const deps = {
      data,
      now: () => NOW,
      verifyToken: async (token: string | null, remoteip: string | null) => {
        seen.push({ token, remoteip });
        return token === "good" ? { ok: true } : { ok: false, reason: "missing_token" as const };
      },
    };
    const url = "https://airates.test/v1/pairs/BTC/backtest?long=gate&short=okx&size=10k&days=7";

    const refused = await handleApp(new Request(url), deps);
    expect(refused.status).toBe(403);
    // A cached 403 would lock out a legitimate caller for the whole TTL.
    expect(refused.headers.get("cache-control")).toBe("no-store");
    const body = (await refused.json()) as { error: string; reason: string; detail: string };
    expect(body.error).toBe("challenge_required");
    expect(body.reason).toBe("missing_token");
    // The body says how to satisfy the gate, naming the header rather than a query parameter.
    expect(body.detail).toContain("cf-turnstile-response");

    // The token comes from the header: a query parameter would miss cache on every request and
    // bake a 300-second credential into a shareable link.
    const solved = await handleApp(
      new Request(url, {
        headers: { "cf-turnstile-response": "good", "cf-connecting-ip": "203.0.113.9" },
      }),
      deps,
    );
    expect(solved.status).toBe(200);
    expect(seen).toEqual([
      { token: null, remoteip: null },
      { token: "good", remoteip: "203.0.113.9" },
    ]);

    // A token in the query string is not read, precisely so the cache key stays clean.
    const viaQuery = await handleApp(new Request(`${url}&cf-turnstile-response=good`), deps);
    expect(viaQuery.status).toBe(403);
  });

  test("the challenge is skipped entirely when no secret is configured", async () => {
    // What makes `wrangler dev` and these tests work -- and why production must set the secret.
    const { data } = fakeData({
      settlements: async () => [
        ...settled("gate", "BTC_USDT", -0.0001),
        ...settled("okx", "BTC-USDT-SWAP", 0.0001),
      ],
    });
    const res = await get("/v1/pairs/BTC/backtest?long=gate&short=okx&size=10k&days=7", data);
    expect(res.status).toBe(200);
  });

  test("a request that cannot be answered is not challenged, so no token is spent", async () => {
    // Tokens are single-use and last 300 seconds; burning one on a 400 or a 404 would be rude.
    const { data } = fakeData();
    const calls: string[] = [];
    const deps = {
      data,
      now: () => NOW,
      verifyToken: async () => {
        calls.push("verified");
        return { ok: false as const, reason: "missing_token" as const };
      },
    };
    // Same venue twice: rejected as a bad request before the gate.
    expect(
      (
        await handleApp(
          new Request("https://airates.test/v1/pairs/BTC/backtest?long=gate&short=gate"),
          deps,
        )
      ).status,
    ).toBe(400);
    // A venue with no live market for the asset: 404, also before the gate.
    expect(
      (
        await handleApp(
          new Request("https://airates.test/v1/pairs/BTC/backtest?long=gate&short=bybit"),
          deps,
        )
      ).status,
    ).toBe(404);
    expect(calls).toEqual([]);
  });

  test("the pair page challenges an uncached replay, and a cleared cookie runs it", async () => {
    // The real clearance module, not a stub: it is pure crypto, so this exercises the actual
    // cookie end to end rather than a fake that could agree with a broken implementation.
    const clearance = createClearance("test-secret");
    const { data } = fakeData({
      settlements: async () => [
        ...settled("gate", "BTC_USDT", -0.0001),
        ...settled("okx", "BTC-USDT-SWAP", 0.0001),
      ],
    });
    const deps = {
      data,
      now: () => NOW,
      sitekey: "0xTESTSITEKEY",
      clearance,
      verifyToken: async (token: string | null) =>
        token === "good" ? { ok: true } : { ok: false, reason: "invalid_token" as const },
    };
    const url = "https://airates.test/pair/BTC?long=gate&short=okx&size=10k&days=7";

    // No clearance: the challenge page, and crucially NOT a 200 -- index.ts caches 200s by URL, so
    // a 200 here would serve the challenge to everyone in place of the result.
    const challenged = await handleApp(new Request(url), deps);
    expect(challenged.status).toBe(403);
    expect(challenged.headers.get("cache-control")).toBe("no-store");
    const form = await challenged.text();
    expect(form).toContain('data-sitekey="0xTESTSITEKEY"');
    expect(form).toContain('data-action="backtest"');
    expect(form).toContain('action="/pair/BTC/verify"');
    expect(form).toContain("challenges.cloudflare.com/turnstile/v0/api.js");
    // The parameters survive the round trip as hidden fields.
    expect(form).toContain('name="long" value="gate"');
    expect(form).toContain('name="days" value="7"');
    // No result leaked into the challenge page.
    expect(form).not.toContain("net funding over");

    // Solving it: a 303 back to the canonical URL, with the cookie.
    const body = new FormData();
    for (const [k, v] of [
      ["long", "gate"],
      ["short", "okx"],
      ["size", "10000"],
      ["days", "7"],
      ["cf-turnstile-response", "good"],
    ])
      body.set(k as string, v as string);
    const solved = await handleApp(
      new Request("https://airates.test/pair/BTC/verify", { method: "POST", body }),
      deps,
    );
    expect(solved.status).toBe(303);
    expect(solved.headers.get("location")).toBe("/pair/BTC?long=gate&short=okx&days=7");
    const setCookie = solved.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(CLEARANCE_COOKIE);
    expect(setCookie).toContain("HttpOnly");

    // The cookie then buys the real result at the shareable URL.
    const cookie = setCookie.slice(0, setCookie.indexOf(";"));
    const ran = await handleApp(new Request(url, { headers: { cookie } }), deps);
    expect(ran.status).toBe(200);
    expect(await ran.text()).toContain("net funding over");
  });

  test("a refused token returns to the challenge rather than a dead end", async () => {
    const clearance = createClearance("test-secret");
    const { data } = fakeData();
    const body = new FormData();
    body.set("long", "gate");
    body.set("short", "okx");
    body.set("cf-turnstile-response", "stale");
    const res = await handleApp(
      new Request("https://airates.test/pair/BTC/verify", { method: "POST", body }),
      {
        data,
        now: () => NOW,
        sitekey: "0xTESTSITEKEY",
        clearance,
        verifyToken: async () => ({ ok: false, reason: "already_used" as const }),
      },
    );
    expect(res.status).toBe(403);
    // A fresh widget, because the refused token is single-use and already spent.
    expect(await res.text()).toContain("challenges.cloudflare.com/turnstile/v0/api.js");
  });

  test("browsing the pair page without a backtest is never challenged", async () => {
    const { data } = fakeData();
    const res = await handleApp(new Request("https://airates.test/pair/BTC"), {
      data,
      now: () => NOW,
      sitekey: "0xTESTSITEKEY",
      clearance: createClearance("test-secret"),
      verifyToken: async () => ({ ok: false, reason: "missing_token" as const }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Pick two exchanges");
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
    expect((await api.json()) as { error: string }).toMatchObject({ error: "rate_limited" });

    const html = await handleApp(
      new Request("https://airates.test/pair/BTC?long=gate&short=okx", {
        headers: { "cf-connecting-ip": "203.0.113.5" },
      }),
      deps,
    );
    expect(html.status).toBe(429);
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
