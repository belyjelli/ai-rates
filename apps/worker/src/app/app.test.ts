import { describe, expect, test } from "bun:test";
import { bestPair } from "../web/pages";
import { handleApp } from "./app";
import type { DataSource, MarketRow, Overview, ScreenerFilters, ScreenerPair } from "./data";
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
  short_venue_id: "lighter",
  short_symbol: "BTC",
  short_apr: 10.95,
  short_apr_7d: 9.3,
  short_interval_hours: 1,
  short_open_interest_usd: 1.62e8,
  short_volume_24h_usd: 8.5e8,
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
    ...overrides,
  };
  return { data, calls };
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

  test("robots.txt blocks crawlers before launch", async () => {
    const res = await get("/robots.txt", fakeData().data);
    expect(await res.text()).toBe("User-agent: *\nDisallow: /\n");
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
