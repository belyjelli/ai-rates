import { describe, expect, test } from "bun:test";
import { withLocale } from "./i18n";
import { layout } from "./layout";
import {
  entryText,
  NARRATOR_HEAD_SCRIPT,
  type NarratorRow,
  narrate,
  narratorFeed,
  narratorSince,
  parseNarratorBook,
} from "./narrator";

const T0 = Date.parse("2026-11-10T00:00:00Z");
const MIN = 60_000;

/** Reads every five minutes from T0, each one overriding a calm default. */
function reads(changes: Partial<NarratorRow>[], start = T0): NarratorRow[] {
  return changes.map((c, i) => ({
    at: start + i * 5 * MIN,
    spot: 100_000,
    net: 50e6,
    flip: 95_000,
    callWall: 110_000,
    putWall: 90_000,
    ...c,
  }));
}

const kinds = (rows: NarratorRow[]) => narrate(rows).map((e) => e.events.map((x) => x.kind));
const allKinds = (rows: NarratorRow[]) => kinds(rows).flat();

describe("narrate", () => {
  test("the first read says nothing; a calm hour says one quiet line", () => {
    const rows = reads(Array.from({ length: 13 }, () => ({})));
    expect(kinds(rows)).toEqual([["quiet"]]);
    expect(narrate(rows)[0]?.at).toBe(T0 + 60 * MIN);
  });

  test("through the flip and back, with the regime the net gamma gives", () => {
    const rows = reads([
      { spot: 100_000, flip: 99_000 },
      { spot: 98_500, flip: 99_000, net: -20e6 },
      { spot: 99_800, flip: 99_000, net: 10e6 },
    ]);
    const entries = narrate(rows);
    expect(entries.map((e) => e.events[0])).toEqual([
      { kind: "cross-down", flip: 99_000, short: true },
      { kind: "cross-up", flip: 99_000, short: false },
    ]);
    expect(entries[0]?.tone).toBe("short");
    expect(entries[0]?.strong).toBe(true);
    expect(entries[0]?.marks).toEqual(["alert"]);
  });

  test("a price sitting on the flip is on it once, not crossing it every read", () => {
    // ±0.1% around a flip of 100,000: inside the 0.2% band throughout.
    const rows = reads([
      { spot: 101_000, flip: 100_000 },
      { spot: 100_100, flip: 100_000 },
      { spot: 99_900, flip: 100_000 },
      { spot: 100_100, flip: 100_000 },
      { spot: 99_900, flip: 100_000 },
    ]);
    expect(kinds(rows)).toEqual([["onto-from-above"]]);
    expect(narrate(rows)[0]?.tone).toBe("edge");
  });

  test("a wall moves only when two reads in a row agree", () => {
    const flap = reads([{}, { putWall: 92_000 }, { putWall: 90_000 }, { putWall: 92_000 }]);
    expect(allKinds(flap)).toEqual([]);
    const moved = reads([{}, { callWall: 105_000 }, { callWall: 105_000 }]);
    expect(narrate(moved).map((e) => e.events[0])).toEqual([
      { kind: "ceiling-down", from: 110_000, to: 105_000 },
    ]);
  });

  test("each new approach to a wall is a test of the day, and a break says so once", () => {
    const rows = reads([
      { spot: 95_000 },
      { spot: 90_200 }, // within 0.4% above the put wall: test 1
      { spot: 92_000 }, // 2.2% away: the test is over
      { spot: 90_300 }, // test 2
      { spot: 89_000 }, // 1.1% below: broken
      { spot: 88_500 },
    ]);
    const events = narrate(rows).flatMap((e) => e.events);
    expect(events).toEqual([
      { kind: "floor-test", wall: 90_000, n: 1 },
      { kind: "floor-test", wall: 90_000, n: 2 },
      { kind: "floor-break", wall: 90_000 },
    ]);
  });

  test("tests start again at UTC midnight", () => {
    const start = T0 - 15 * MIN;
    const rows = reads(
      [{ spot: 95_000 }, { spot: 90_200 }, { spot: 92_000 }, { spot: 92_000 }, { spot: 90_200 }],
      start,
    );
    const tests = narrate(rows)
      .flatMap((e) => e.events)
      .flatMap((e) => (e.kind === "floor-test" ? [e.n] : []));
    expect(tests).toEqual([1, 1]);
  });

  test("a hole in the reads starts the comparison over instead of reporting across it", () => {
    const rows = [
      ...reads([{ spot: 100_000, flip: 99_000 }]),
      ...reads([{ spot: 98_000, flip: 99_000, net: -1e6 }], T0 + 45 * MIN),
    ];
    expect(allKinds(rows)).toEqual([]);
  });

  test("net gamma grown by half over the hour, away from the flip", () => {
    const rows = reads(Array.from({ length: 14 }, (_, i) => ({ net: i < 13 ? 40e6 : 70e6 })));
    const grow = narrate(rows)
      .flatMap((e) => e.events)
      .find((e) => e.kind === "net-grow");
    expect(grow).toEqual({ kind: "net-grow", pct: 0.75, net: 70e6 });
  });

  test("a new day low is news only once the day has settled and the old low has stood an hour", () => {
    const early = reads([{}, { spot: 99_000 }, { spot: 98_000 }]);
    expect(allKinds(early)).toEqual([]);
    // Two and a half hours at 100,000, then three lower reads in a row: the first is news, the next
    // two only extend it.
    const later = reads([
      ...Array.from({ length: 30 }, () => ({ spot: 100_000 })),
      { spot: 99_500 },
      { spot: 99_300 },
      { spot: 99_200 },
    ]);
    expect(allKinds(later).filter((k) => k === "day-low")).toEqual(["day-low"]);
  });

  test("weightiest first: a broken wall before the moves of the same read", () => {
    const rows = reads([
      { callWall: 101_000 },
      { callWall: 101_000, putWall: 95_000, flip: 97_000 },
      { spot: 101_500, callWall: 101_000, putWall: 95_000, flip: 97_000 },
    ]);
    expect(kinds(rows)).toEqual([["ceiling-break", "floor-up", "flip-up"]]);
  });
});

describe("words", () => {
  const entry = narrate(
    reads([
      { spot: 100_000, flip: 99_000 },
      { spot: 98_500, flip: 99_000, net: -20e6, callWall: null },
    ]),
  )[0];

  test("a line is its sentences, then the levels it was read at", () => {
    expect(entry && entryText(entry)).toBe(
      "Price is now below the gamma flip at 99,000: dealers are short gamma here, so their hedging adds to moves. Levels: put wall 90,000 · flip 99,000 · call wall none.",
    );
  });

  test("in Chinese the sentences run on without a space", () => {
    const text = withLocale("zh", () => (entry ? entryText(entry) : ""));
    expect(text).toBe(
      "价格已跌破 99,000 的 gamma 翻转点：此处做市商为负 Gamma，对冲会放大波动。关键价位：看跌墙 90,000 · 翻转点 99,000 · 看涨墙 无。",
    );
  });

  test("the feed is one item per entry, its time in the reader's zone, its text escaped", () => {
    const html = narratorFeed("BTC", entry ? [entry] : []);
    expect(html).toStartWith('<ol class="narr-feed" data-book="BTC">');
    expect(html).toContain(`<li class="narr-e narr-short narr-strong" data-at="${entry?.at}">`);
    expect(html).toContain(`data-t="${entry?.at}" data-tf="hm"`);
    expect(html).toContain('<span class="narr-alert"><svg class="ico"');
    expect(html).not.toContain("<script");
  });
});

describe("plumbing", () => {
  test("the reads start at yesterday's UTC midnight", () => {
    expect(narratorSince(Date.parse("2026-11-10T13:45:00Z"))).toBe(
      Date.parse("2026-11-09T00:00:00Z"),
    );
  });

  test("only the narrated books are asked for", () => {
    expect(parseNarratorBook("eth")).toBe("ETH");
    expect(parseNarratorBook("SOL")).toBeNull();
    expect(parseNarratorBook(null)).toBeNull();
  });

  const page = (overview: Parameters<typeof layout>[0]["overview"]) =>
    layout({ title: "t", description: "d", path: "/", overview, now: T0, body: "" });
  const overview = {
    markets: 1,
    venues: 1,
    updated_at: new Date(T0),
    sentiment_score: null,
    sentiment_label: null,
  } as unknown as Parameters<typeof layout>[0]["overview"];

  test("a page that reads the data carries the strip between the bars, set before it paints", () => {
    const html = page(overview);
    expect(html).toContain(NARRATOR_HEAD_SCRIPT);
    expect(html.indexOf('<section class="narr" id="narr"')).toBeGreaterThan(
      html.indexOf('id="clock"'),
    );
    expect(html.indexOf('<section class="narr" id="narr"')).toBeLessThan(
      html.indexOf('<div class="wrap bar bar2">'),
    );
    expect(html.match(/const PATH="\/data\/narrator"/g)).toHaveLength(1);
  });

  test("a page that reads nothing has no strip", () => {
    const html = page(undefined);
    expect(html).not.toContain('id="narr"');
    expect(html).not.toContain(NARRATOR_HEAD_SCRIPT);
  });
});
