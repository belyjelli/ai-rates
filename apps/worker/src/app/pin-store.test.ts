import { describe, expect, test } from "bun:test";
import type { PinCandidate } from "./pin-finder";
import { AUTO_PIN_MS, decidePin } from "./pin-store";

const NOW = Date.parse("2026-11-18T05:00:00Z");
const HOUR = 3_600_000;

const candidate = (story: string, score: number, id = `${story}-lead`): PinCandidate => ({
  venue: "polymarket",
  id,
  title: id,
  story,
  score,
  reasons: {
    questions: 2,
    venues: ["polymarket"],
    volume24h: score,
    featuredOrder: null,
    openedMs: NOW,
  },
});

describe("automatic pin rules", () => {
  test("a candidate is pinned for three days when nothing is", () => {
    const { pin, changed } = decidePin(null, candidate("jensen", 5e6), NOW);
    expect(changed).toBe(true);
    expect(pin).toMatchObject({ story: "jensen", since: NOW, until: NOW + AUTO_PIN_MS });
    expect(decidePin(null, null, NOW)).toEqual({ pin: null, changed: false });
  });

  test("the same story refreshes its figures but keeps its question and its time", () => {
    const first = decidePin(null, candidate("jensen", 5e6, "rejoins"), NOW).pin;
    const { pin } = decidePin(first, candidate("jensen", 6e6, "next-ceo"), NOW + HOUR);
    expect(pin).toMatchObject({ id: "rejoins", score: 6e6, since: NOW, until: NOW + AUTO_PIN_MS });
  });

  test("another story takes the pin early only at twice the score", () => {
    const first = decidePin(null, candidate("jensen", 5e6), NOW).pin;
    expect(decidePin(first, candidate("fed", 9e6), NOW + HOUR).pin?.story).toBe("jensen");
    const taken = decidePin(first, candidate("fed", 1e7), NOW + HOUR).pin;
    expect(taken).toMatchObject({ story: "fed", since: NOW + HOUR });
  });

  test("a read with no clear winner leaves the pin standing until its time, then ends it", () => {
    const first = decidePin(null, candidate("jensen", 5e6), NOW).pin;
    expect(decidePin(first, null, NOW + HOUR)).toEqual({ pin: first, changed: false });
    expect(decidePin(first, null, NOW + AUTO_PIN_MS)).toEqual({ pin: null, changed: true });
    // Still the winner when its time is up: pinned again, from then.
    const again = decidePin(first, candidate("jensen", 5e6), NOW + AUTO_PIN_MS).pin;
    expect(again?.since).toBe(NOW + AUTO_PIN_MS);
  });
});
