import type { BetEvent, BetVenue } from "./bet-types";
import { DAY_MS } from "./bet-types";
import type { StorySignal } from "./polymarket";

/**
 * Finds what the homepage's prediction-market section should pin (web/bets.ts) when the owner has
 * pinned nothing by hand (app/bets.ts PINS): the biggest NEW story on the prediction markets.
 *
 * WHY STORIES, NOT QUESTIONS. Owner, 2026-11-18, after pinning "Jensen Huang rejoins NVIDIA by...?"
 * by hand: "develop a pinning to find what should pin", and chose to let it pin by itself. What made
 * that question worth pinning was not its volume alone (the Fed's December decision trades as much,
 * every day, for months) but that it was a new story that the money was piling into from several
 * sides at once. So questions are grouped into stories first, and the story is scored:
 *
 *   - A STORY is the questions sharing a topic tag Polymarket made in the last STORY_TAG_DAYS days
 *     (it makes one when news breaks: `jensen-huang` on 2026-11-09, then on six of the fifty busiest
 *     questions by 11-18). A question with no such tag is a story of its own. Kalshi's questions join
 *     a story when their title names one of its entities (NVIDIA, Jensen Huang), as Kalshi has no
 *     tags to share.
 *   - Each question counts its dollars traded over 24 hours, times
 *       freshness: full for a question opened in the last FRESH_DAYS days, falling to a quarter by
 *         STALE_DAYS, so a long-running question (an election, the Fed) does not pin itself forever;
 *       relevance: full for markets, companies, the economy, crypto and tech, a little over half for
 *         politics and the world, under a third for celebrities, games and films;
 *       Polymarket's own editors: half again for its first three featured, a fifth for the rest.
 *   - The CANDIDATE is the best story whose lead (its question with the most fresh dollars) opened in
 *     the last LEAD_MAX_AGE_DAYS days, when it scores at least STORY_MIN and at least MARGIN times the
 *     best other story of any age: a clear winner, not a coin toss.
 *
 * Measured 2026-11-18 on the 50 busiest: the Jensen Huang story scored $5.5M against $0.6M for the
 * next (the Fed's December decision), and its lead was "Jensen Huang rejoins NVIDIA by...?", the
 * question the owner had pinned by hand.
 *
 * How long a candidate stays pinned, and when a new one may take over, is app/pin-store.ts.
 */

export const STORY_TAG_DAYS = 30;
export const FRESH_DAYS = 7;
export const STALE_DAYS = 30;
export const LEAD_MAX_AGE_DAYS = 14;
/** Fresh, relevance-weighted dollars over 24 hours a story needs to be pinned. */
export const STORY_MIN = 1_000_000;
/** How many times the next story's score the top one needs. */
export const MARGIN = 1.5;

/** Topic tags of what this site's readers trade on. */
const RELEVANT = new Set([
  "finance",
  "business",
  "economy",
  "fed",
  "fomc",
  "fed-rates",
  "crypto",
  "bitcoin",
  "ethereum",
  "tech",
  "big-tech",
  "ai",
  "ipo",
  "ipos",
  "stocks",
  "equities",
  "earnings",
  "companies",
  "tariffs",
  "commodities",
  "oil",
]);
/** Topic tags of what they do not. */
const AFIELD = new Set([
  "pop-culture",
  "celebrities",
  "culture",
  "games",
  "video-games",
  "movies",
  "music",
  "awards",
  "tv",
  "aliens",
]);
/** Tag labels too broad to say two venues' questions are the same story. */
const BROAD_LABELS = new Set(
  [
    "tech",
    "big tech",
    "business",
    "finance",
    "economy",
    "crypto",
    "ai",
    "politics",
    "world",
    "geopolitics",
    "elections",
    "pop culture",
    "celebrities",
    "trump",
    "us politics",
    "united states",
  ].map((l) => l.toLowerCase()),
);

/** Why a story was pinned, for the card to say. */
export interface PinReasons {
  /** Questions in the story, both venues. */
  questions: number;
  venues: BetVenue[];
  /** Dollars traded on the story over 24 hours, both venues. */
  volume24h: number;
  /** The lead's place among Polymarket's featured events; null when not featured. */
  featuredOrder: number | null;
  /** When the lead question opened, epoch ms. */
  openedMs: number | null;
}

export interface Story {
  /** The shared tag's slug, or the question's own id for a story of one. */
  key: string;
  score: number;
  lead: StorySignal;
  members: StorySignal[];
  kalshi: BetEvent[];
}

/** What the finder proposes to pin; app/pin-store.ts decides whether it does. */
export interface PinCandidate {
  venue: BetVenue;
  id: string;
  title: string;
  story: string;
  score: number;
  reasons: PinReasons;
}

const ageDays = (openedMs: number | null, now: number) =>
  openedMs === null ? STALE_DAYS : Math.max(0, (now - openedMs) / DAY_MS);

/** A question's freshness: 1 for its first week, down to 0.25 by its first month and after. */
export function freshness(days: number): number {
  if (days <= FRESH_DAYS) return 1;
  if (days >= STALE_DAYS) return 0.25;
  return 1 - (0.75 * (days - FRESH_DAYS)) / (STALE_DAYS - FRESH_DAYS);
}

/** How much a question's topic matters to this site's readers. */
export function relevance(slugs: readonly string[]): number {
  if (slugs.some((s) => RELEVANT.has(s))) return 1;
  if (slugs.some((s) => AFIELD.has(s))) return 0.3;
  return 0.6;
}

const featuredBoost = (order: number | null) => (order === null ? 1 : order <= 3 ? 1.5 : 1.2);

/** One question's weight in its story. */
export function weight(s: StorySignal, now: number): number {
  return (
    s.volume24h *
    freshness(ageDays(s.openedMs, now)) *
    relevance(s.tags.map((t) => t.slug)) *
    featuredBoost(s.featuredOrder)
  );
}

/** A label as a whole word or phrase in a title, any case. */
const names = (title: string, label: string) =>
  new RegExp(
    `(^|[^\\p{L}\\p{N}])${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`,
    "iu",
  ).test(title);

/** The busiest questions grouped into stories, best first. */
export function findStories(
  signals: readonly StorySignal[],
  kalshi: readonly BetEvent[],
  now: number,
): Story[] {
  // How many questions carry each new tag: a new tag on two or more is a story.
  const carried = new Map<string, number>();
  for (const s of signals)
    for (const t of s.tags)
      if (t.createdMs !== null && now - t.createdMs <= STORY_TAG_DAYS * DAY_MS)
        carried.set(t.slug, (carried.get(t.slug) ?? 0) + 1);
  const stories = new Map<string, Story>();
  for (const s of signals) {
    // The question's most widely carried new tag; ties go to the alphabetically first, so every
    // location groups the same way.
    const key =
      s.tags
        .map((t) => t.slug)
        .filter((slug) => (carried.get(slug) ?? 0) >= 2)
        .sort((a, b) => (carried.get(b) ?? 0) - (carried.get(a) ?? 0) || a.localeCompare(b))[0] ??
      `event:${s.id}`;
    const story = stories.get(key) ?? { key, score: 0, lead: s, members: [], kalshi: [] };
    story.members.push(s);
    story.score += weight(s, now);
    const lead = (x: StorySignal) => x.volume24h * freshness(ageDays(x.openedMs, now));
    if (lead(s) > lead(story.lead)) story.lead = s;
    stories.set(key, story);
  }
  // Kalshi's questions join the story whose entities their titles name: the labels of the tags that
  // two or more of its questions share, the broad ones aside. A Kalshi question joins one story at most.
  const ranked = [...stories.values()].sort((a, b) => b.score - a.score);
  const joined = new Set<string>();
  for (const story of ranked) {
    if (story.members.length < 2) continue;
    const shared = new Map<string, { label: string; n: number }>();
    for (const m of story.members)
      for (const t of m.tags) {
        const label = t.label.trim();
        if (label.length < 3 || BROAD_LABELS.has(label.toLowerCase())) continue;
        const entry = shared.get(t.slug) ?? { label, n: 0 };
        entry.n += 1;
        shared.set(t.slug, entry);
      }
    const labels = [...shared.values()].filter((e) => e.n >= 2).map((e) => e.label);
    if (labels.length === 0) continue;
    const rel = relevance(story.lead.tags.map((t) => t.slug));
    for (const k of kalshi) {
      if (joined.has(k.id) || !labels.some((l) => names(k.title, l))) continue;
      joined.add(k.id);
      story.kalshi.push(k);
      story.score += k.volume24h * freshness(ageDays(k.startMs, now)) * rel;
    }
  }
  return ranked.sort((a, b) => b.score - a.score);
}

/**
 * The story to pin, as its lead question, or null when none is a clear winner: the best story whose
 * lead is new, against the best other story of any age.
 */
export function pinCandidate(stories: readonly Story[], now: number): PinCandidate | null {
  const top = stories.find((s) => ageDays(s.lead.openedMs, now) <= LEAD_MAX_AGE_DAYS);
  if (!top || top.score < STORY_MIN) return null;
  const next = stories.find((s) => s !== top);
  if (next && top.score < MARGIN * next.score) return null;
  return {
    venue: "polymarket",
    id: top.lead.id,
    title: top.lead.title,
    story: top.key,
    score: top.score,
    reasons: {
      questions: top.members.length + top.kalshi.length,
      venues: top.kalshi.length > 0 ? ["polymarket", "kalshi"] : ["polymarket"],
      volume24h:
        top.members.reduce((sum, m) => sum + m.volume24h, 0) +
        top.kalshi.reduce((sum, k) => sum + k.volume24h, 0),
      featuredOrder: top.lead.featuredOrder,
      openedMs: top.lead.openedMs,
    },
  };
}
