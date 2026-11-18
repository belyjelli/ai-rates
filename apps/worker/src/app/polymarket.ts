import {
  type BetAnswer,
  type BetEvent,
  type BetLine,
  eventContext,
  featuredAnswers,
  getJson,
  historyFrom,
  list,
  msOrNull,
  num,
  numOrNull,
  orderAnswers,
  text,
} from "./bet-types";

/**
 * Polymarket's public reads, for the homepage's prediction-market section (app/bets.ts,
 * web/bets.ts): the events with the most money traded over the last 24 hours, one event by its slug
 * (a pinned one), and an answer's price history.
 *
 * WHY READ IT HERE, NOT IN THE COLLECTOR. The collector keeps Polymarket's macro questions (Fed,
 * jobs, GDP, the BTC ladders) hourly for the Rates tabs; what is busiest today is a different set
 * every day, and Polymarket keeps every market's own price history (prices-history), so there is
 * nothing to record. Nothing here needs a key or touches the database.
 *
 *   - gamma-api /events, the top EVENTS_READ events by 24-hour volume with sports left out at the
 *     source (`exclude_tag_id=1`, the sports tag, which also carries esports). Each event comes with
 *     every market it holds and their rules, so it is heavy: about 3.2 MB of JSON for 20 events on
 *     2026-11-18, the elections with 128 candidates each being most of it. Above 50 events the API
 *     answers gzip only.
 *   - clob /prices-history, one answer's Yes price since the market opened, about 3 KB.
 */

export const GAMMA_EVENTS_URL = "https://gamma-api.polymarket.com/events";
export const CLOB_HISTORY_URL = "https://clob.polymarket.com/prices-history";
export const POLYMARKET_EVENT_URL = "https://polymarket.com/event/";

/** How many events are asked for: enough that the questions left out below still leave POLY_KEPT. */
export const EVENTS_READ = 20;
/** How many are kept for the section, before Kalshi's join them. */
export const POLY_KEPT = 10;
const EVENTS_TIMEOUT_MS = 8_000;
const HISTORY_TIMEOUT_MS = 5_000;

/** Polymarket's sports tag id: game, match and season questions, esports included. */
const SPORTS_TAG_ID = 1;
/**
 * Tags whose questions are left out after the read: the self-repeating short ones (today's BTC
 * range, tomorrow's high in Seoul, Elon's tweet count this week) whose volume says nothing about
 * what people are paying attention to. Polymarket marks most of them `hide-from-new` itself.
 */
const LEFT_OUT_TAGS = new Set([
  "sports",
  "esports",
  "hide-from-new",
  "daily",
  "weather",
  "tweets-markets",
  "up-or-down",
]);

/**
 * One gamma event as the section shows it, or null when nothing in it is open. An answer whose date
 * has passed is left out: it is waiting to be resolved, not being bet on.
 */
export function parseEvent(raw: Record<string, unknown>, now: number): BetEvent | null {
  const slug = text(raw.slug);
  const title = text(raw.title);
  if (!slug || !title) return null;
  const markets = Array.isArray(raw.markets) ? (raw.markets as Record<string, unknown>[]) : [];
  const answers: BetAnswer[] = [];
  const single = markets.length === 1;
  for (const m of markets) {
    // A negative-risk event lists placeholder answers ("Candidate T") as inactive markets.
    if (m.active !== true || m.closed === true || m.acceptingOrders === false) continue;
    const endMs = msOrNull(m.endDate);
    if (endMs !== null && endMs <= now) continue;
    const outcomes = list(m.outcomes).map(text);
    const prices = list(m.outcomePrices).map(numOrNull);
    const tokens = list(m.clobTokenIds).map(text);
    if (outcomes[0] === "Yes" && outcomes[1] === "No") {
      const price = prices[0];
      if (price === null || price === undefined) continue;
      answers.push({
        label: single ? "Yes" : text(m.groupItemTitle) || text(m.question),
        price,
        change1d: numOrNull(m.oneDayPriceChange),
        ref: tokens[0] || null,
        endMs,
      });
    } else {
      // A market whose outcomes are names, not Yes/No: each outcome is an answer.
      outcomes.forEach((label, i) => {
        const price = prices[i];
        if (!label || price === null || price === undefined) return;
        answers.push({
          label,
          price,
          change1d: i === 0 ? numOrNull(m.oneDayPriceChange) : null,
          ref: tokens[i] || null,
          endMs,
        });
      });
    }
  }
  if (answers.length === 0) return null;
  // Polymarket's negative-risk events are the ones where exactly one answer resolves Yes.
  const ladder = orderAnswers(answers, raw.negRisk === true || raw.enableNegRisk === true);
  return {
    venue: "polymarket",
    id: slug,
    url: `${POLYMARKET_EVENT_URL}${encodeURIComponent(slug)}`,
    series: null,
    title,
    context: eventContext(text(raw.description)),
    volume24h: num(raw.volume24hr),
    volume: num(raw.volume),
    startMs: msOrNull(raw.startDate) ?? msOrNull(raw.creationDate),
    answers,
    ladder,
  };
}

const leftOut = (raw: Record<string, unknown>): boolean => {
  const tags = Array.isArray(raw.tags) ? (raw.tags as Record<string, unknown>[]) : [];
  return tags.some((t) => LEFT_OUT_TAGS.has(text(t.slug)));
};

/** The events kept, busiest first, from one gamma /events answer. */
export function pickEvents(raw: unknown, now: number, kept = POLY_KEPT): BetEvent[] {
  if (!Array.isArray(raw)) return [];
  const picked: BetEvent[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    if (picked.length >= kept) break;
    if (!item || typeof item !== "object" || leftOut(item)) continue;
    const event = parseEvent(item, now);
    if (event && event.volume24h > 0) picked.push(event);
  }
  return picked.sort((a, b) => b.volume24h - a.volume24h);
}

/** Polymarket's busiest events of the last 24 hours, sports and the daily repeats left out. */
export async function polymarketBusiest(get: typeof fetch, now: number): Promise<BetEvent[]> {
  const q = new URLSearchParams({
    active: "true",
    closed: "false",
    order: "volume24hr",
    ascending: "false",
    limit: String(EVENTS_READ),
    exclude_tag_id: String(SPORTS_TAG_ID),
  });
  return pickEvents(await getJson(get, `${GAMMA_EVENTS_URL}?${q}`, EVENTS_TIMEOUT_MS), now);
}

/** One event by its slug (a pinned one), or null when it is gone or closed. */
export async function polymarketEvent(
  get: typeof fetch,
  slug: string,
  now: number,
): Promise<BetEvent | null> {
  const raw = await getJson(
    get,
    `${GAMMA_EVENTS_URL}?${new URLSearchParams({ slug })}`,
    EVENTS_TIMEOUT_MS,
  );
  const first = Array.isArray(raw) ? (raw[0] as Record<string, unknown> | undefined) : undefined;
  return first ? parseEvent(first, now) : null;
}

/**
 * The longest startTs-to-endTs window prices-history accepts: past it the answer is a 400, "'startTs'
 * and 'endTs' interval is too long" (measured 2026-11-18: 14 days answered, 30 refused). A longer
 * history is asked as `interval=1m`, the last month, and cut to the chart's start.
 */
export const HISTORY_WINDOW_MS = 14 * 86_400_000;

/** A prices-history step that keeps a line to a few hundred points: hourly for a week, then coarser. */
export function historyFidelity(spanMs: number): number {
  const days = spanMs / 86_400_000;
  return days <= 8 ? 60 : days <= 16 ? 120 : 240;
}

/** The prices-history query for one answer from `from` to `now`. */
export function historyQuery(token: string, from: number, now: number): URLSearchParams {
  const q = new URLSearchParams({ market: token });
  if (now - from <= HISTORY_WINDOW_MS) {
    q.set("startTs", String(Math.floor(from / 1000)));
    q.set("endTs", String(Math.ceil(now / 1000)));
  } else {
    q.set("interval", "1m");
  }
  q.set("fidelity", String(historyFidelity(now - from)));
  return q;
}

/** One prices-history answer as [ms, price] points, oldest first. */
export function parseHistory(raw: unknown): [number, number][] {
  const history = (raw as { history?: unknown } | null)?.history;
  if (!Array.isArray(history)) return [];
  const points: [number, number][] = [];
  for (const p of history as { t?: unknown; p?: unknown }[]) {
    const t = numOrNull(p?.t);
    const price = numOrNull(p?.p);
    if (t === null || price === null) continue;
    points.push([t * 1000, price]);
  }
  return points.sort((a, b) => a[0] - b[0]);
}

/** A featured event's lines, one an answer; a line that fails is left out. */
export async function polymarketLines(
  get: typeof fetch,
  event: BetEvent,
  now: number,
): Promise<BetLine[]> {
  const from = historyFrom(event, now);
  const lines = await Promise.allSettled(
    featuredAnswers(event).map(async (a) => {
      const q = historyQuery(a.ref as string, from, now);
      const points = parseHistory(
        await getJson(get, `${CLOB_HISTORY_URL}?${q}`, HISTORY_TIMEOUT_MS),
      ).filter((p) => p[0] >= from);
      return { label: a.label, points };
    }),
  );
  return lines.flatMap((l) =>
    l.status === "fulfilled" && l.value.points.length >= 2 ? [l.value] : [],
  );
}
