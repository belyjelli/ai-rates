import { describe, expect, test } from "bun:test";
import {
  barHoursFor,
  type Cascade,
  cascadeReaction,
  cascadeView,
  findCascades,
  type HotMinute,
} from "./cascades";
import type { CvdBar } from "./data";

const T0 = Date.parse("2026-11-14T12:00:00Z");
const MIN = 60_000;

const hot = (minute: number, over: Partial<HotMinute> = {}): HotMinute => ({
  minute: new Date(T0 + minute * MIN),
  long_usd: 200_000,
  short_usd: 0,
  events: 3,
  venues: "binance,okx",
  ...over,
});

describe("findCascades", () => {
  test("hot minutes up to two quiet minutes apart are one cascade; three apart are two", () => {
    const found = findCascades({
      per_minute: 1_000,
      minutes: [hot(0), hot(1), hot(4, { venues: "bybit" }), hot(8), hot(9)],
    });
    // Newest first: 8-9 is its own, three quiet minutes after 4; 0, 1 and 4 are one.
    expect(found.map((c) => [c.start.getTime(), c.minutes])).toEqual([
      [T0 + 8 * MIN, 2],
      [T0, 5],
    ]);
    const first = found[1] as Cascade;
    expect(first.long_usd).toBe(600_000);
    expect(first.events).toBe(9);
    expect(first.venues).toEqual(["binance", "bybit", "okx"]);
    expect(first.last.getTime()).toBe(T0 + 4 * MIN);
  });

  test("minutes handed over newest first fold the same as oldest first", () => {
    const minutes = [hot(0), hot(1), hot(9)];
    expect(findCascades({ per_minute: 1_000, minutes: [...minutes].reverse() })).toEqual(
      findCascades({ per_minute: 1_000, minutes }),
    );
  });

  test("a burst counts only with an hour's worth of the usual pace, and never under $100k", () => {
    // An hour of $5k a minute is $300k: $250k is a burst, not a cascade.
    expect(findCascades({ per_minute: 5_000, minutes: [hot(0, { long_usd: 250_000 })] })).toEqual(
      [],
    );
    expect(
      findCascades({ per_minute: 5_000, minutes: [hot(0, { long_usd: 310_000 })] }),
    ).toHaveLength(1);
    // A quiet asset's hour is small; the floor still holds.
    expect(findCascades({ per_minute: 10, minutes: [hot(0, { long_usd: 90_000 })] })).toEqual([]);
    expect(findCascades({ per_minute: 0, minutes: [] })).toEqual([]);
  });
});

/** A 5-minute bar from `minute` (relative to T0) with a close and, optionally, a candle. */
const bar = (minute: number, price: number, low = price, high = price): CvdBar => ({
  bucket_start: new Date(T0 + minute * MIN),
  buy_usd: 0,
  sell_usd: 0,
  price,
  low,
  high,
  price_venue: "binance",
  price_symbol: "BTCUSDT",
});

describe("cascadeReaction", () => {
  // A long cascade from 12:07 to 12:11: the 12:05 and 12:10 bars hold it.
  const [cascade] = findCascades({ per_minute: 1_000, minutes: [hot(7), hot(9), hot(11)] });
  const bars = [
    bar(0, 100),
    bar(5, 96, 94.5),
    bar(10, 97, 95),
    bar(15, 97.5),
    ...Array.from({ length: 60 }, (_, i) => bar(20 + i * 5, 98 + (i === 11 ? 1 : 0))),
  ];

  test("the price before, the low inside a long cascade, and the moves after it", () => {
    const now = T0 + 6 * 60 * MIN;
    const reaction = cascadeReaction(cascade as Cascade, bars, now);
    // The last close before 12:07 is the 12:00 bar's, at 12:05.
    expect(reaction.before).toBe(100);
    expect(reaction.extreme).toBe(94.5);
    expect(reaction.into).toBeCloseTo(-0.055, 9);
    // The bar holding the last minute (12:11) is 12:10's, which closed at 97.
    expect(reaction.end).toBe(97);
    // An hour after 12:11 falls in the 13:10 bar (98), not the 13:15 one (99).
    expect(reaction.after[0]).toBeCloseTo(98 / 97 - 1, 9);
    // Four hours after falls in the 16:10 bar: 98.
    expect(reaction.after[1]).toBeCloseTo(98 / 97 - 1, 9);
  });

  test("a move whose candle has not closed is later, and a short cascade reads the high", () => {
    const soon = cascadeReaction(cascade as Cascade, bars, T0 + 30 * MIN);
    expect(soon.after).toEqual(["later", "later"]);
    const [up] = findCascades({
      per_minute: 1_000,
      minutes: [hot(7, { long_usd: 0, short_usd: 300_000 })],
    });
    const high = cascadeReaction(up as Cascade, [bar(0, 100), bar(5, 103, 99, 104.2)], T0);
    expect(high.extreme).toBe(104.2);
    expect(high.into).toBeCloseTo(0.042, 9);
  });

  test("no bars, no prices: every move is blank rather than zero", () => {
    const reaction = cascadeReaction(cascade as Cascade, [], T0 + 10 * 60 * MIN);
    expect(reaction).toEqual({
      before: null,
      extreme: null,
      into: null,
      end: null,
      after: [null, null],
    });
  });
});

describe("cascadeView and the bars it needs", () => {
  test("names the priced market, and reads back to an hour before the oldest cascade", () => {
    const read = { per_minute: 1_000, minutes: [hot(0), hot(300)] };
    const found = findCascades(read);
    const now = T0 + 7 * 60 * MIN + 1;
    expect(barHoursFor(found, now)).toBe(9);
    expect(barHoursFor([], now)).toBe(0);
    const view = cascadeView(read, found, [bar(0, 100)], now);
    expect(view.price_venue).toBe("binance");
    expect(view.price_symbol).toBe("BTCUSDT");
    expect(view.rows).toHaveLength(2);
  });
});
