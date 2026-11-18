import {
  type BetAnswer,
  type BetEvent,
  type BetLine,
  DAY_MS,
  featuredAnswers,
  getJson,
  historyFrom,
  msOrNull,
  num,
  numOrNull,
  orderAnswers,
  text,
} from "./bet-types";

/**
 * Kalshi's public reads, for the homepage's prediction-market section (app/bets.ts, web/bets.ts),
 * beside Polymarket's (app/polymarket.ts). No key, no database.
 *
 * FINDING THE BUSIEST TAKES KALSHI'S OWN SEARCH. The documented API (trade-api/v2) lists open events
 * in pages of 200 with no order: measured 2026-11-18, 80 pages held 16,000 events and 137,000 markets
 * (316 MB) and still had more, two thirds of them elections and sports. The search kalshi.com itself
 * uses (v1/search/series) ranks events by recent trading and can leave sports out
 * (`excluded_categories=Sports`): 25 events are about 0.8 MB. It is not a documented API, so it is
 * only used to pick which events to read; a failure leaves the section with Polymarket's alone.
 *
 * THE FIGURES ARE THE DOCUMENTED API'S. Each picked event is read from trade-api/v2/events/<ticker>
 * (about 30 KB): its answers, their last prices and the prices a day before, and each market's
 * contracts traded over 24 hours. Kalshi counts volume in contracts, which pay $1; Polymarket counts
 * dollars paid. Contracts times their last price puts Kalshi's in Polymarket's terms, so the two
 * venues rank together (Kalshi's "Next CEO of NVIDIA?": 10.4M contracts, about $0.9M).
 * A featured answer's history is trade-api/v2 candlesticks.
 */

export const KALSHI_SEARCH_URL = "https://api.elections.kalshi.com/v1/search/series";
export const KALSHI_API_URL = "https://api.elections.kalshi.com/trade-api/v2";
export const KALSHI_MARKETS_URL = "https://kalshi.com/markets/";

/** How many events the search is asked for: sports are left out at the source. */
export const SEARCH_READ = 25;
/**
 * How many of them are read in full: the busiest by contracts, after the repeats are dropped. Ten,
 * because contracts are a poor guide to dollars (a field of long shots trades millions of contracts
 * at a cent or two), so the dollar ranking is made from more than the table needs.
 */
export const KALSHI_KEPT = 10;
const SEARCH_TIMEOUT_MS = 8_000;
const EVENT_TIMEOUT_MS = 5_000;
const CANDLES_TIMEOUT_MS = 5_000;

/** Categories left out as Polymarket's tags are: games, the weather, what someone will say. */
const LEFT_OUT_CATEGORIES = new Set(["Sports", "Climate and Weather", "Mentions"]);
/** Series that repeat every quarter hour, hour, day or week (BTC at 5 pm, gas this week). */
const LEFT_OUT_FREQUENCIES = new Set(["fifteen_min", "hourly", "daily", "weekly"]);

/** The tickers of the events worth reading, busiest first, from one search answer. */
export function pickTickers(raw: unknown, kept = KALSHI_KEPT): string[] {
  const page = (raw as { current_page?: unknown } | null)?.current_page;
  if (!Array.isArray(page)) return [];
  const rows = (page as Record<string, unknown>[]).filter((e) => {
    if (!e || typeof e !== "object" || !text(e.event_ticker)) return false;
    if (LEFT_OUT_CATEGORIES.has(text(e.category))) return false;
    const meta = e.product_metadata as Record<string, unknown> | undefined;
    return !LEFT_OUT_FREQUENCIES.has(text(meta?.series_frequency));
  });
  rows.sort((a, b) => num(b.recent_volume) - num(a.recent_volume));
  return [...new Set(rows.map((e) => text(e.event_ticker)))].slice(0, kept);
}

/**
 * One trade-api/v2 event, its markets nested, as the section shows it; null when nothing in it is
 * open. A market's chance is its last price, or the middle of its book when it has not traded.
 */
export function parseKalshiEvent(raw: unknown, now: number): BetEvent | null {
  const body = raw as { event?: Record<string, unknown>; markets?: unknown } | null;
  const event = body?.event;
  if (!event) return null;
  const ticker = text(event.event_ticker);
  const series = text(event.series_ticker);
  const title = text(event.title);
  if (!ticker || !series || !title) return null;
  const markets = (
    Array.isArray(event.markets) ? event.markets : Array.isArray(body.markets) ? body.markets : []
  ) as Record<string, unknown>[];
  const answers: BetAnswer[] = [];
  let volume24h = 0;
  let startMs: number | null = null;
  for (const m of markets) {
    const open = msOrNull(m.open_time);
    if (open !== null) startMs = startMs === null ? open : Math.min(startMs, open);
    if (text(m.status) !== "active") continue;
    const endMs = msOrNull(m.close_time);
    if (endMs !== null && endMs <= now) continue;
    const bid = numOrNull(m.yes_bid_dollars);
    const ask = numOrNull(m.yes_ask_dollars);
    const last = numOrNull(m.last_price_dollars);
    const price = last !== null && last > 0 ? last : bid !== null && ask ? (bid + ask) / 2 : null;
    if (price === null) continue;
    const before = numOrNull(m.previous_price_dollars);
    volume24h += num(m.volume_24h_fp) * price;
    answers.push({
      label: markets.length === 1 ? "Yes" : text(m.yes_sub_title) || text(m.title),
      price,
      change1d: before !== null && before > 0 ? price - before : null,
      ref: text(m.ticker) || null,
      endMs,
    });
  }
  if (answers.length === 0) return null;
  const ladder = orderAnswers(answers, event.mutually_exclusive === true);
  return {
    venue: "kalshi",
    id: ticker,
    url: `${KALSHI_MARKETS_URL}${encodeURIComponent(series.toLowerCase())}`,
    series,
    title,
    context: null,
    volume24h,
    volume: null,
    startMs,
    answers,
    ladder,
  };
}

/** One event by its ticker, or null when it is closed. */
export async function kalshiEvent(
  get: typeof fetch,
  ticker: string,
  now: number,
): Promise<BetEvent | null> {
  const url = `${KALSHI_API_URL}/events/${encodeURIComponent(ticker)}?with_nested_markets=true`;
  return parseKalshiEvent(await getJson(get, url, EVENT_TIMEOUT_MS), now);
}

/** Kalshi's busiest events of the last 24 hours; one that fails to read is left out. */
export async function kalshiBusiest(get: typeof fetch, now: number): Promise<BetEvent[]> {
  const q = new URLSearchParams({
    order_by: "trending",
    page_size: String(SEARCH_READ),
    excluded_categories: "Sports",
  });
  const tickers = pickTickers(await getJson(get, `${KALSHI_SEARCH_URL}?${q}`, SEARCH_TIMEOUT_MS));
  const read = await Promise.allSettled(tickers.map((t) => kalshiEvent(get, t, now)));
  return read
    .flatMap((r) => (r.status === "fulfilled" && r.value && r.value.volume24h > 0 ? [r.value] : []))
    .sort((a, b) => b.volume24h - a.volume24h);
}

/**
 * One market's candlesticks as [ms, price] points, oldest first: the hour's last trade, or the
 * middle of the book at the hour's end when nothing traded.
 */
export function parseCandles(raw: unknown): [number, number][] {
  const candles = (raw as { candlesticks?: unknown } | null)?.candlesticks;
  if (!Array.isArray(candles)) return [];
  const points: [number, number][] = [];
  for (const c of candles as Record<string, unknown>[]) {
    const t = numOrNull(c?.end_period_ts);
    if (t === null) continue;
    const price = (c.price ?? {}) as Record<string, unknown>;
    const bid = numOrNull((c.yes_bid as Record<string, unknown> | undefined)?.close_dollars);
    const ask = numOrNull((c.yes_ask as Record<string, unknown> | undefined)?.close_dollars);
    const close = numOrNull(price.close_dollars);
    const p = close !== null ? close : bid !== null && ask ? (bid + ask) / 2 : null;
    if (p !== null) points.push([t * 1000, p]);
  }
  return points.sort((a, b) => a[0] - b[0]);
}

/** A featured event's lines, one an answer: hourly over a week or less, daily beyond. */
export async function kalshiLines(
  get: typeof fetch,
  event: BetEvent,
  now: number,
): Promise<BetLine[]> {
  if (!event.series) return [];
  const from = historyFrom(event, now);
  const q = new URLSearchParams({
    start_ts: String(Math.floor(from / 1000)),
    end_ts: String(Math.ceil(now / 1000)),
    period_interval: String(now - from <= 8 * DAY_MS ? 60 : 1440),
  });
  const series = encodeURIComponent(event.series);
  const lines = await Promise.allSettled(
    featuredAnswers(event).map(async (a) => {
      const url = `${KALSHI_API_URL}/series/${series}/markets/${encodeURIComponent(a.ref as string)}/candlesticks?${q}`;
      return { label: a.label, points: parseCandles(await getJson(get, url, CANDLES_TIMEOUT_MS)) };
    }),
  );
  return lines.flatMap((l) =>
    l.status === "fulfilled" && l.value.points.length >= 2 ? [l.value] : [],
  );
}
