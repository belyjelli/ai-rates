/**
 * What the homepage's prediction-market section (web/bets.ts) reads, whichever venue it came from:
 * Polymarket (app/polymarket.ts) or Kalshi (app/kalshi.ts). app/bets.ts puts the two together.
 */

export type BetVenue = "polymarket" | "kalshi";

/** One answer to an event's question: a market's Yes, or one outcome of a single market. */
export interface BetAnswer {
  /** The venue's own words ("December 31, 2026", "Rene Haas", "Hike 25bps", "Yes"): escape it. */
  label: string;
  /** The Yes price, 0 to 1: the crowd's chance. */
  price: number;
  /** The price's change over the last 24 hours, in the same units; null when the venue gives none. */
  change1d: number | null;
  /** What the venue's price history is asked for: a Polymarket CLOB token, a Kalshi market ticker. */
  ref: string | null;
  /** When the answer's market closes, epoch ms; null if unknown. */
  endMs: number | null;
}

export interface BetEvent {
  venue: BetVenue;
  /** Polymarket's event slug, Kalshi's event ticker. */
  id: string;
  /** The event's page on the venue. */
  url: string;
  /** Kalshi's series ticker, which its price history is asked under; null on Polymarket. */
  series: string | null;
  /** The venue's question: escape it. */
  title: string;
  /** The first sentence of the rules when it says what happened, not how it resolves; else null. */
  context: string | null;
  /** Dollars traded over the last 24 hours. */
  volume24h: number;
  /** Dollars traded since the event opened; null where the venue does not say (Kalshi). */
  volume: number | null;
  /** When the event opened, epoch ms. */
  startMs: number | null;
  /**
   * The open answers: by closing date for a "by when" ladder, likeliest first when exactly one can
   * happen, else closest to even odds first (orderAnswers).
   */
  answers: BetAnswer[];
  /** True for a "by when" ladder: the answers are dates, nearest first. */
  ladder: boolean;
}

/** One line of a featured chart: [epoch ms, price] points, oldest first. */
export interface BetLine {
  label: string;
  points: [number, number][];
}

/** An event shown with its chart. */
export interface FeaturedBet {
  event: BetEvent;
  /** Its answers' odds since it opened (at most HISTORY_DAYS); empty when none could be read. */
  lines: BetLine[];
}

export interface BetsRead {
  readAt: number;
  /** The event the owner pinned, while the pin lasts (PINS in app/bets.ts). */
  pinned: (FeaturedBet & { untilMs: number }) | null;
  /** The most traded event of the last 24 hours on either venue, the pinned one aside. */
  busiest: FeaturedBet | null;
  /** The next most traded, both venues together. */
  events: BetEvent[];
}

/** A featured chart's lines at most: an event with more answers shows its first few. */
export const FEATURED_LINES = 4;
/** The longest history a featured chart draws. */
export const HISTORY_DAYS = 30;
export const DAY_MS = 86_400_000;

export const num = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};
export const numOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};
export const msOrNull = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};
export const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Polymarket sends outcomes, prices and token ids as JSON text inside the JSON. */
export const list = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * The rules' first sentence, when it is news ("On November 12, 2026, NVIDIA announced that ...")
 * rather than the resolution boilerplate ("This market will resolve to Yes if ...").
 */
export function eventContext(description: string): string | null {
  const first = description.trim().split(/\n/)[0] ?? "";
  const sentence = /^(.+?[.!?])(\s|$)/.exec(first)?.[1] ?? first;
  if (sentence.length < 20 || sentence.length > 260) return null;
  if (/\bthis (market|question|event)\b|resolv|^if\b/i.test(sentence)) return null;
  return sentence;
}

/**
 * Puts answers in reading order, and says whether they are a ladder of dates ("rejoins by Nov 30 /
 * Dec 31 / next Dec 31"), which reads in date order. Answers of which exactly one will happen
 * (candidates, ranges, Fed moves: `exclusive`) read likeliest first. The rest are levels that can all
 * come true together ("Bitcoin hits $X", "score above 45 / 60 / 75"), whose likeliest is always the
 * lowest bar at 99%: they read closest to even odds first, the level the crowd is actually split on.
 */
export function orderAnswers(answers: BetAnswer[], exclusive: boolean): boolean {
  const ends = answers.map((a) => a.endMs);
  const ladder =
    answers.length > 1 && ends.every((e) => e !== null) && new Set(ends).size === answers.length;
  answers.sort(
    ladder
      ? (a, b) => (a.endMs ?? 0) - (b.endMs ?? 0)
      : exclusive || answers.length === 1
        ? (a, b) => b.price - a.price
        : (a, b) => Math.abs(a.price - 0.5) - Math.abs(b.price - 0.5),
  );
  return ladder;
}

/** A featured chart's answers: the first few in reading order (orderAnswers). */
export function featuredAnswers(event: BetEvent): BetAnswer[] {
  return event.answers.filter((a) => a.ref !== null).slice(0, FEATURED_LINES);
}

/** Where a featured chart starts: when the event opened, or HISTORY_DAYS back if that is later. */
export function historyFrom(event: BetEvent, now: number): number {
  const floor = now - HISTORY_DAYS * DAY_MS;
  return Math.max(event.startMs ?? floor, floor);
}

/** A GET of JSON, failing on a non-2xx answer or the timeout. */
export async function getJson(get: typeof fetch, url: string, timeoutMs: number): Promise<unknown> {
  const res = await get(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}${new URL(url).pathname}`);
  return res.json();
}
