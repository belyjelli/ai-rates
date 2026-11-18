import { beforeEach, describe, expect, test } from "bun:test";
import type { BetEvent } from "./bet-types";
import { eventContext } from "./bet-types";
import { activePin, arrange, betsSource, forgetBets, type Pin, tableRows } from "./bets";
import { parseCandles, parseKalshiEvent, pickTickers } from "./kalshi";
import type { PinCandidate } from "./pin-finder";
import { AUTO_PIN_MS, type AutoPin, type AutoPinStore, decidePin } from "./pin-store";
import {
  HISTORY_WINDOW_MS,
  historyQuery,
  parseEvent,
  parseHistory,
  pickEvents,
} from "./polymarket";

const NOW = Date.parse("2026-11-18T05:00:00Z");
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** A gamma market: Yes/No, its Yes price, open unless said otherwise. */
const polyMarket = (over: Record<string, unknown>) => ({
  active: true,
  closed: false,
  acceptingOrders: true,
  outcomes: '["Yes", "No"]',
  outcomePrices: '["0.5", "0.5"]',
  clobTokenIds: '["yes-token", "no-token"]',
  endDate: iso(NOW + 30 * DAY),
  oneDayPriceChange: 0.01,
  ...over,
});

const JENSEN = {
  slug: "jensen-huang-rejoins-nvidia-byptptpt",
  title: "Jensen Huang rejoins NVIDIA by...?",
  description:
    "On November 12, 2026, NVIDIA announced that Jensen Huang had resigned as its President, Chief Executive Officer, and a member of its Board of Directors, effective immediately.\n\nThis market will resolve to Yes if ...",
  volume24hr: 2_036_206,
  volume: 5_153_149,
  startDate: "2026-11-12T21:17:08Z",
  negRisk: false,
  tags: [{ slug: "tech" }, { slug: "nvidia" }],
  markets: [
    polyMarket({
      groupItemTitle: "December 31, 2027",
      outcomePrices: '["0.335", "0.665"]',
      endDate: "2028-01-01T04:59:00Z",
      clobTokenIds: '["t2027", "n"]',
    }),
    polyMarket({
      groupItemTitle: "November 30, 2026",
      outcomePrices: '["0.0285", "0.9715"]',
      endDate: "2026-12-01T04:59:00Z",
      oneDayPriceChange: -0.021,
      clobTokenIds: '["t1130", "n"]',
    }),
    polyMarket({
      groupItemTitle: "December 31, 2026",
      outcomePrices: '["0.0855", "0.9145"]',
      endDate: "2027-01-01T04:59:00Z",
      clobTokenIds: '["t1231", "n"]',
    }),
  ],
};

describe("Polymarket events", () => {
  test("a ladder of dates reads nearest first, with the rules' news as context", () => {
    const e = parseEvent(JENSEN, NOW) as BetEvent;
    expect(e.venue).toBe("polymarket");
    expect(e.url).toBe("https://polymarket.com/event/jensen-huang-rejoins-nvidia-byptptpt");
    expect(e.ladder).toBe(true);
    expect(e.answers.map((a) => a.label)).toEqual([
      "November 30, 2026",
      "December 31, 2026",
      "December 31, 2027",
    ]);
    expect(e.answers[0]).toMatchObject({ price: 0.0285, change1d: -0.021, ref: "t1130" });
    expect(e.context).toStartWith("On November 12, 2026, NVIDIA announced");
    expect(e.volume24h).toBe(2_036_206);
  });

  test("placeholders, closed markets and passed dates are left out", () => {
    const e = parseEvent(
      {
        ...JENSEN,
        markets: [
          polyMarket({ groupItemTitle: "Candidate T", active: false }),
          polyMarket({ groupItemTitle: "Gone", closed: true }),
          polyMarket({ groupItemTitle: "Passed", endDate: iso(NOW - 1000) }),
          polyMarket({ groupItemTitle: "Open" }),
        ],
      },
      NOW,
    ) as BetEvent;
    expect(e.answers.map((a) => a.label)).toEqual(["Open"]);
    expect(parseEvent({ ...JENSEN, markets: [polyMarket({ closed: true })] }, NOW)).toBeNull();
  });

  test("exactly-one-of answers read likeliest first; levels closest to even odds first", () => {
    const end = iso(NOW + 30 * DAY);
    const answers = (negRisk: boolean) =>
      (
        parseEvent(
          {
            ...JENSEN,
            negRisk,
            markets: [
              polyMarket({ groupItemTitle: "A", outcomePrices: '["0.97", "0.03"]', endDate: end }),
              polyMarket({ groupItemTitle: "B", outcomePrices: '["0.45", "0.55"]', endDate: end }),
              polyMarket({ groupItemTitle: "C", outcomePrices: '["0.02", "0.98"]', endDate: end }),
            ],
          },
          NOW,
        ) as BetEvent
      ).answers.map((a) => a.label);
    expect(answers(true)).toEqual(["A", "B", "C"]);
    expect(answers(false)).toEqual(["B", "A", "C"]);
  });

  test("a single Yes/No market's answer is Yes", () => {
    const e = parseEvent({ ...JENSEN, markets: [polyMarket({ question: "Will it?" })] }, NOW);
    expect(e?.answers.map((a) => a.label)).toEqual(["Yes"]);
  });

  test("sports, daily repeats and weather are left out of the busiest", () => {
    const picked = pickEvents(
      [
        { ...JENSEN, slug: "btc-today", volume24hr: 9e6, tags: [{ slug: "hide-from-new" }] },
        { ...JENSEN, slug: "seoul-high", volume24hr: 8e6, tags: [{ slug: "weather" }] },
        { ...JENSEN, slug: "game", volume24hr: 7e6, tags: [{ slug: "sports" }] },
        JENSEN,
      ],
      NOW,
    );
    expect(picked.map((e) => e.id)).toEqual(["jensen-huang-rejoins-nvidia-byptptpt"]);
  });

  test("the rules' boilerplate is not context", () => {
    expect(eventContext("This market will resolve to Yes if it happens.")).toBeNull();
    expect(
      eventContext("The FED interest rates are defined in this market by the upper bound."),
    ).toBeNull();
    expect(eventContext("On May 1, the company announced a merger with its rival.")).toBe(
      "On May 1, the company announced a merger with its rival.",
    );
  });

  test("price history: a window up to two weeks by start and end, a longer one as the last month", () => {
    const short = historyQuery("tok", NOW - 5 * DAY, NOW);
    expect(short.get("startTs")).toBe(String((NOW - 5 * DAY) / 1000));
    expect(short.get("fidelity")).toBe("60");
    const long = historyQuery("tok", NOW - HISTORY_WINDOW_MS - DAY, NOW);
    expect(long.get("startTs")).toBeNull();
    expect(long.get("interval")).toBe("1m");
    expect(parseHistory({ history: [{ t: 2, p: 0.3 }, { t: 1, p: "0.2" }, { p: 1 }] })).toEqual([
      [1000, 0.2],
      [2000, 0.3],
    ]);
  });
});

const kalshiMarket = (over: Record<string, unknown>) => ({
  ticker: "KX-A",
  status: "active",
  yes_sub_title: "A",
  last_price_dollars: "0.2300",
  previous_price_dollars: "0.1900",
  yes_bid_dollars: "0.2200",
  yes_ask_dollars: "0.2400",
  volume_24h_fp: "1000.00",
  close_time: iso(NOW + 60 * DAY),
  open_time: "2026-11-12T22:00:00Z",
  ...over,
});

describe("Kalshi events", () => {
  test("the search keeps the busiest, without sports, weather or the hourly repeats", () => {
    const row = (event_ticker: string, recent_volume: number, extra = {}) => ({
      event_ticker,
      recent_volume,
      category: "Financials",
      product_metadata: { series_frequency: "one_off" },
      ...extra,
    });
    expect(
      pickTickers({
        current_page: [
          row("KXGAME", 9e6, { category: "Sports" }),
          row("KXBTCD", 8e6, { product_metadata: { series_frequency: "hourly" } }),
          row("KXHIGH", 7e6, { category: "Climate and Weather" }),
          row("KXSMALL", 10),
          row("KXNVDACEO", 1e7),
        ],
      }),
    ).toEqual(["KXNVDACEO", "KXSMALL"]);
  });

  test("an event: answers, the day's change, and contracts priced into dollars", () => {
    const e = parseKalshiEvent(
      {
        event: {
          event_ticker: "KXNVDACEO-29JAN",
          series_ticker: "KXNVDACEO",
          title: "Who will be the next CEO of NVIDIA?",
          mutually_exclusive: true,
          markets: [
            kalshiMarket({}),
            kalshiMarket({
              ticker: "KX-B",
              yes_sub_title: "B",
              last_price_dollars: "0.0000",
              volume_24h_fp: "500.00",
            }),
            kalshiMarket({ ticker: "KX-C", yes_sub_title: "C", status: "finalized" }),
          ],
        },
      },
      NOW,
    ) as BetEvent;
    expect(e.venue).toBe("kalshi");
    expect(e.url).toBe("https://kalshi.com/markets/kxnvdaceo");
    expect(e.series).toBe("KXNVDACEO");
    expect(e.volume).toBeNull();
    // A: last trade 23¢; B never traded, so the middle of its 22-24¢ book.
    expect(e.answers.map((a) => [a.label, Math.round(a.price * 1e6) / 1e6])).toEqual([
      ["A", 0.23],
      ["B", 0.23],
    ]);
    expect(e.answers[0]?.change1d).toBeCloseTo(0.04, 10);
    expect(e.volume24h).toBeCloseTo(1000 * 0.23 + 500 * 0.23, 6);
  });

  test("candlesticks: the hour's last trade, else the middle of the book", () => {
    const points = parseCandles({
      candlesticks: [
        {
          end_period_ts: 3,
          price: { close_dollars: null },
          yes_bid: { close_dollars: "0.10" },
          yes_ask: { close_dollars: "0.14" },
        },
        { end_period_ts: 1, price: { close_dollars: "0.0900" } },
        {
          end_period_ts: 2,
          price: {},
          yes_bid: { close_dollars: "0.0000" },
          yes_ask: { close_dollars: "0.0000" },
        },
      ],
    });
    expect(points.map(([t, p]) => [t, Math.round(p * 1e6) / 1e6])).toEqual([
      [1000, 0.09],
      [3000, 0.12],
    ]);
  });
});

const ev = (venue: "polymarket" | "kalshi", id: string, volume24h: number): BetEvent => ({
  venue,
  id,
  url: `https://example.com/${id}`,
  series: venue === "kalshi" ? "KXS" : null,
  title: id,
  context: null,
  volume24h,
  volume: null,
  startMs: NOW - 3 * DAY,
  answers: [{ label: "Yes", price: 0.4, change1d: 0.02, ref: `${id}-ref`, endMs: null }],
  ladder: false,
});

describe("arranging both venues", () => {
  const pin: Pin = { venue: "polymarket", id: "pinned", untilMs: NOW + DAY };

  test("a pin lasts until its time", () => {
    expect(activePin(NOW, [pin])).toBe(pin);
    expect(activePin(NOW + 2 * DAY, [pin])).toBeNull();
  });

  test("the pinned event leads, the busiest other one follows, the rest make the table", () => {
    const ranked = [
      ev("polymarket", "pinned", 9),
      ev("polymarket", "fed", 8),
      ev("kalshi", "k", 7),
    ];
    const out = arrange(ranked, pin, null);
    expect(out.pinned?.id).toBe("pinned");
    expect(out.busiest?.id).toBe("fed");
    expect(out.table.map((e) => e.id)).toEqual(["k"]);
    // Read on its own, the pinned event is shown even when it is not among the busiest.
    expect(arrange(ranked.slice(1), pin, ev("polymarket", "pinned", 1)).pinned?.volume24h).toBe(1);
    expect(arrange(ranked, null, null).busiest?.id).toBe("pinned");
  });

  test("the table keeps three from each venue, in order of dollars", () => {
    const poly = Array.from({ length: 9 }, (_, i) => ev("polymarket", `p${i}`, 100 - i));
    const kalshi = Array.from({ length: 4 }, (_, i) => ev("kalshi", `k${i}`, 50 - i));
    const rows = tableRows([...poly, ...kalshi].sort((a, b) => b.volume24h - a.volume24h));
    expect(rows).toHaveLength(8);
    expect(rows.filter((e) => e.venue === "kalshi").map((e) => e.id)).toEqual(["k0", "k1", "k2"]);
    expect(rows.map((e) => e.volume24h)).toEqual(
      [...rows.map((e) => e.volume24h)].sort((a, b) => b - a),
    );
    // A venue with fewer than three keeps all it has; the other fills the rest.
    const few = tableRows(
      [...poly, kalshi[0] as BetEvent].sort((a, b) => b.volume24h - a.volume24h),
    );
    expect(few.filter((e) => e.venue === "kalshi")).toHaveLength(1);
    expect(few).toHaveLength(8);
  });
});

describe("the source", () => {
  beforeEach(() => forgetBets());

  /** Answers each venue's URLs from fixtures and counts the requests. */
  const fakeFetch = () => {
    const calls: string[] = [];
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    const get = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(`${url.host}${url.pathname}`);
      if (url.host === "gamma-api.polymarket.com") {
        const list = [
          {
            ...JENSEN,
            slug: "fed",
            title: "Fed decision?",
            volume24hr: 1_600_000,
            // Open since July: busy, but not news.
            startDate: "2026-07-29T23:28:08Z",
            creationDate: "2026-07-29T23:28:08Z",
          },
          { ...JENSEN, featured: true, featuredOrder: 2 },
        ];
        const slug = url.searchParams.get("slug");
        return json(slug ? list.filter((e) => e.slug === slug) : list);
      }
      if (url.pathname === "/prices-history")
        return json({
          history: [
            { t: (NOW - 2 * DAY) / 1000, p: 0.1 },
            { t: NOW / 1000, p: 0.2 },
          ],
        });
      if (url.pathname === "/v1/search/series")
        return json({
          current_page: [
            { event_ticker: "KXNVDACEO-29JAN", recent_volume: 1e7, category: "Financials" },
          ],
        });
      if (url.pathname.startsWith("/trade-api/v2/events/"))
        return json({
          event: {
            event_ticker: "KXNVDACEO-29JAN",
            series_ticker: "KXNVDACEO",
            title: "Who will be the next CEO of NVIDIA?",
            mutually_exclusive: true,
            markets: [kalshiMarket({})],
          },
        });
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    return { get, calls };
  };

  test("reads the pin, both venues and two charts, then serves the kept read", async () => {
    const { get, calls } = fakeFetch();
    let now = NOW;
    const pins: Pin[] = [
      { venue: "polymarket", id: "jensen-huang-rejoins-nvidia-byptptpt", untilMs: NOW + DAY },
    ];
    const source = betsSource({ fetch: get, now: () => now, pins });
    const read = await source.bets();
    expect(read?.pinned?.event.title).toBe("Jensen Huang rejoins NVIDIA by...?");
    expect(read?.pinned?.lines).toHaveLength(3);
    expect(read?.busiest?.event.id).toBe("fed");
    expect(read?.busiest?.lines.length).toBeGreaterThan(0);
    expect(read?.events.map((e) => e.venue)).toEqual(["kalshi"]);
    const first = calls.length;
    now += 60_000;
    await source.bets();
    expect(calls.length).toBe(first);
  });

  test("once the pin is over, the kept read is not served and the busiest leads", async () => {
    const { get } = fakeFetch();
    let now = NOW;
    const pins: Pin[] = [
      { venue: "polymarket", id: "jensen-huang-rejoins-nvidia-byptptpt", untilMs: NOW + 60_000 },
    ];
    const source = betsSource({ fetch: get, now: () => now, pins });
    expect((await source.bets())?.pinned).not.toBeNull();
    now += 120_000;
    const after = await source.bets();
    expect(after?.pinned).toBeNull();
    expect(after?.busiest?.event.id).toBe("jensen-huang-rejoins-nvidia-byptptpt");
  });

  test("one venue failing leaves the other's", async () => {
    const { get } = fakeFetch();
    const kalshiDown = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("kalshi")
        ? new Response("down", { status: 503 })
        : get(input, init)) as typeof fetch;
    const read = await betsSource({ fetch: kalshiDown, now: () => NOW, pins: [] }).bets();
    expect(read?.busiest?.event.venue).toBe("polymarket");
    expect(read?.events.every((e) => e.venue === "polymarket")).toBe(true);
  });

  /** The automatic pin's store, in memory, under the same rules as the Durable Object. */
  const memoryPins = () => {
    let held: AutoPin | null = null;
    const asked: (PinCandidate | null)[] = [];
    const store: AutoPinStore = {
      decide: async (candidate, at) => {
        asked.push(candidate);
        held = decidePin(held, candidate, at).pin;
        return held;
      },
    };
    return { store, asked };
  };

  test("with no pin by hand, the pin finder's story is pinned, with its reasons", async () => {
    const { get } = fakeFetch();
    const { store, asked } = memoryPins();
    const read = await betsSource({ fetch: get, now: () => NOW, pins: [], autoPins: store }).bets();
    expect(asked[0]?.id).toBe("jensen-huang-rejoins-nvidia-byptptpt");
    expect(read?.pinned?.event.id).toBe("jensen-huang-rejoins-nvidia-byptptpt");
    expect(read?.pinned?.untilMs).toBe(NOW + AUTO_PIN_MS);
    expect(read?.pinned?.auto).toMatchObject({ featuredOrder: 2, volume24h: 2_036_206 });
    expect(read?.busiest?.event.id).toBe("fed");
  });

  test("a pin by hand wins, and the finder is still asked so its pin is current after", async () => {
    const { get } = fakeFetch();
    const { store, asked } = memoryPins();
    const pins: Pin[] = [{ venue: "polymarket", id: "fed", untilMs: NOW + 86_400_000 }];
    const read = await betsSource({ fetch: get, now: () => NOW, pins, autoPins: store }).bets();
    expect(read?.pinned?.event.id).toBe("fed");
    expect(read?.pinned?.auto).toBeNull();
    expect(read?.busiest?.event.id).toBe("jensen-huang-rejoins-nvidia-byptptpt");
    expect(asked).toHaveLength(1);
  });

  test("a store that fails leaves the section without an automatic pin", async () => {
    const { get } = fakeFetch();
    const broken: AutoPinStore = { decide: () => Promise.reject(new Error("down")) };
    const read = await betsSource({
      fetch: get,
      now: () => NOW,
      pins: [],
      autoPins: broken,
    }).bets();
    expect(read?.pinned).toBeNull();
    expect(read?.busiest?.event.id).toBe("jensen-huang-rejoins-nvidia-byptptpt");
  });

  test("nothing read and nothing kept is null", async () => {
    const down = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    expect(await betsSource({ fetch: down, now: () => NOW, pins: [] }).bets()).toBeNull();
  });
});
