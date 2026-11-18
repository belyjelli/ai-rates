import { describe, expect, test } from "bun:test";
import type { BetEvent } from "./bet-types";
import {
  findStories,
  freshness,
  MARGIN,
  pinCandidate,
  relevance,
  STORY_MIN,
  weight,
} from "./pin-finder";
import type { StorySignal } from "./polymarket";

const NOW = Date.parse("2026-11-18T05:00:00Z");
const DAY = 86_400_000;

const tag = (slug: string, label: string, ageDays: number) => ({
  slug,
  label,
  createdMs: NOW - ageDays * DAY,
});
const OLD = 900;

const sig = (over: Partial<StorySignal> & { id: string }): StorySignal => ({
  title: over.id,
  volume24h: 1_000_000,
  openedMs: NOW - 5 * DAY,
  featuredOrder: null,
  tags: [tag("business", "Business", OLD)],
  ...over,
});

/** The 50 busiest on 2026-11-18, cut to what decided it. */
const NOV18: StorySignal[] = [
  sig({
    id: "jensen-huang-rejoins-nvidia-byptptpt",
    title: "Jensen Huang rejoins NVIDIA by...?",
    volume24h: 2_043_000,
    openedMs: NOW - 5.4 * DAY,
    featuredOrder: 2,
    tags: [
      tag("tech", "Tech", OLD),
      tag("nvidia", "NVIDIA", OLD),
      tag("big-tech", "Big Tech", OLD),
      tag("jensen-huang", "Jensen Huang", 8),
      tag("nvidia-earnings", "NVIDIA Earnings", 1),
    ],
  }),
  sig({
    id: "fed-decision-in-december",
    title: "Fed Decision in December?",
    volume24h: 1_578_000,
    openedMs: NOW - 111 * DAY,
    featuredOrder: 11,
    tags: [tag("fed", "Fed", OLD), tag("economy", "Economy", OLD)],
  }),
  sig({
    id: "next-ceo-of-nvidia",
    title: "Next CEO of NVIDIA?",
    volume24h: 1_481_000,
    openedMs: NOW - 8.2 * DAY,
    featuredOrder: 1,
    tags: [
      tag("nvidia", "NVIDIA", OLD),
      tag("pop-culture", "Pop Culture", OLD),
      tag("big-tech", "Big Tech", OLD),
      tag("jensen-huang", "Jensen Huang", 8),
      tag("nvidia-earnings", "NVIDIA Earnings", 1),
    ],
  }),
  sig({
    id: "us-x-iran-ceasefire",
    title: "US x Iran Effective Ceasefire begins by...?",
    volume24h: 559_000,
    openedMs: NOW - 10 * DAY,
    tags: [tag("politics", "Politics", OLD), tag("iran", "Iran", OLD)],
  }),
  sig({
    id: "democratic-presidential-nominee-2028",
    title: "Democratic Presidential Nominee 2028",
    volume24h: 542_000,
    openedMs: NOW - 494 * DAY,
    tags: [tag("elections", "Elections", OLD), tag("2028-election", "2028 Election", 14)],
  }),
  sig({
    id: "presidential-election-winner-2028",
    title: "Presidential Election Winner 2028",
    volume24h: 395_000,
    openedMs: NOW - 494 * DAY,
    tags: [tag("elections", "Elections", OLD), tag("2028-election", "2028 Election", 14)],
  }),
];

const kalshi = (id: string, title: string, volume24h: number): BetEvent => ({
  venue: "kalshi",
  id,
  url: `https://kalshi.com/markets/${id.toLowerCase()}`,
  series: id,
  title,
  context: null,
  volume24h,
  volume: null,
  startMs: NOW - 6 * DAY,
  answers: [],
  ladder: false,
});

describe("pin finder", () => {
  test("weights: fresh for a week, a quarter after a month; markets first, celebrities last", () => {
    expect(freshness(3)).toBe(1);
    expect(freshness(7)).toBe(1);
    expect(freshness(18.5)).toBeCloseTo(0.625, 6);
    expect(freshness(30)).toBe(0.25);
    expect(freshness(400)).toBe(0.25);
    expect(relevance(["pop-culture", "nvidia", "big-tech"])).toBe(1);
    expect(relevance(["politics"])).toBe(0.6);
    expect(relevance(["celebrities"])).toBe(0.3);
    // Polymarket's own first three featured count half again.
    const s = sig({ id: "x", volume24h: 100, tags: [tag("tech", "Tech", OLD)] });
    expect(weight({ ...s, featuredOrder: 2 }, NOW)).toBe(150);
    expect(weight({ ...s, featuredOrder: 9 }, NOW)).toBe(120);
  });

  test("2026-11-18: the Jensen Huang story, led by the question the owner pinned by hand", () => {
    const stories = findStories(NOV18, [], NOW);
    const top = stories[0];
    expect(top?.key).toBe("jensen-huang");
    expect(top?.members.map((m) => m.id).sort()).toEqual([
      "jensen-huang-rejoins-nvidia-byptptpt",
      "next-ceo-of-nvidia",
    ]);
    expect(top?.lead.id).toBe("jensen-huang-rejoins-nvidia-byptptpt");
    // An old question gathered under a new tag is still old: the 2028 election is one story, small.
    expect(stories.find((s) => s.key === "2028-election")?.members).toHaveLength(2);
    const pick = pinCandidate(stories, NOW);
    expect(pick).toMatchObject({
      venue: "polymarket",
      id: "jensen-huang-rejoins-nvidia-byptptpt",
      story: "jensen-huang",
      reasons: { questions: 2, venues: ["polymarket"], featuredOrder: 2 },
    });
    expect(pick?.reasons.volume24h).toBe(2_043_000 + 1_481_000);
  });

  test("Kalshi joins the story whose entities its title names, the broad tags aside", () => {
    const stories = findStories(
      NOV18,
      [
        kalshi("KXNVDACEO-29JAN", "Who will be the next CEO of NVIDIA?", 918_000),
        kalshi("KXJOINJENSENHUANG-27JAN", "Where will Jensen Huang work next this year?", 41_000),
        // "Big Tech" and "Tech" are shared by the story too, but say nothing about this one.
        kalshi("KXBIGTECH", "Which big tech company is largest?", 500_000),
      ],
      NOW,
    );
    expect(stories[0]?.kalshi.map((k) => k.id)).toEqual([
      "KXNVDACEO-29JAN",
      "KXJOINJENSENHUANG-27JAN",
    ]);
    const pick = pinCandidate(stories, NOW);
    expect(pick?.reasons.venues).toEqual(["polymarket", "kalshi"]);
    expect(pick?.reasons.questions).toBe(4);
  });

  test("no pin without a clear, big, new winner", () => {
    const fresh = (id: string, volume24h: number, ageDays = 3) =>
      sig({ id, volume24h, openedMs: NOW - ageDays * DAY, tags: [tag("tech", "Tech", OLD)] });
    // Too small.
    expect(pinCandidate(findStories([fresh("a", STORY_MIN * 0.9)], [], NOW), NOW)).toBeNull();
    // Two of a size: a coin toss is not a pin.
    expect(
      pinCandidate(findStories([fresh("a", 3e6), fresh("b", (3e6 / MARGIN) * 1.01)], [], NOW), NOW),
    ).toBeNull();
    // A clear winner.
    expect(pinCandidate(findStories([fresh("a", 3e6), fresh("b", 1e6)], [], NOW), NOW)?.id).toBe(
      "a",
    );
    // An old question is never pinned, however busy; the best new story is, if it is clear of it.
    const old = fresh("old", 9e6, 200);
    expect(pinCandidate(findStories([old], [], NOW), NOW)).toBeNull();
    expect(pinCandidate(findStories([old, fresh("new", 4e6)], [], NOW), NOW)?.id).toBe("new");
  });

  test("grouping is the same every time: ties go to the alphabetically first tag", () => {
    const a = sig({ id: "a", tags: [tag("zeta", "Zeta", 2), tag("alpha", "Alpha", 2)] });
    const b = sig({ id: "b", tags: [tag("zeta", "Zeta", 2), tag("alpha", "Alpha", 2)] });
    expect(findStories([a, b], [], NOW)[0]?.key).toBe("alpha");
    expect(findStories([b, a], [], NOW)[0]?.key).toBe("alpha");
  });
});
