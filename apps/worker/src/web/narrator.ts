import type { GammaRead } from "../app/data";
import { esc, formatPrice, formatUsd } from "./format";
import { currentLocale, scriptStrings, tr } from "./i18n";
import { icon } from "./icons";
import { timeTag } from "./localtime";

/**
 * The market narrator (owner, 2026-11-10): a running commentary on an option book, in the masthead
 * between the first bar and the menu, each new line typing itself out.
 *
 * NO LANGUAGE MODEL. Every line is computed: the gamma job's five-minute reads of a book
 * (gamma_history, scope "all": spot, net gamma at the spot, the flip, the call and put walls) are
 * compared one with the next, the changes that matter become events, and each event has a sentence
 * written here and translated in the catalogs. So a line can only say what the numbers say, it reads
 * the same in a replay, and it is in the reader's language like the rest of the page. What makes a
 * line sound attentive -- "for the first time today", "test 3 today" -- is a counter kept for the
 * UTC day, not wording.
 *
 * THE EVENTS, from one read to the next (all distances are fractions of the price):
 *   - the price against the flip, with a band of BAND either side so a price sitting on the flip does
 *     not cross it every five minutes: onto the flip, and through it;
 *   - a wall that moved (confirmed by two reads in a row, so a near-tie between two strikes does
 *     not flap), a wall the price broke through, and each new test of a wall in the day;
 *   - the flip itself moving by more than FLIP_MOVE (confirmed the same way);
 *   - net gamma at the price grown or thinned by half over the hour (not near the flip, where it is
 *     near zero and any change is a big percentage);
 *   - a new low or high for the UTC day that breaks one at least an hour old;
 *   - and a quiet line when nothing has been said for an hour.
 * A read with any of them becomes one entry: its three weightiest sentences, then the levels.
 *
 * THE PAGE HALF. /data/narrator?book= answers the list as markup, cached a minute at the edge; the
 * strip fetches it after the page has loaded (so no page waits on it), then every minute while the
 * tab is visible. The newest entry the reader has not seen types itself out (a port of the
 * Typewriter of morpheumlabs' mormv1 kit: the text measured into its wrapped lines, each line revealed
 * by a stepped width animation behind a block cursor, the cursor held a moment on the last line). The
 * list scrolls inside the strip; each new line pushes the ones above it up, unless the reader has
 * scrolled back to read. Expanded, collapsed or off is a /settings choice, kept in localStorage
 * "narrator" and applied in the head before the page paints (NARRATOR_HEAD_SCRIPT), expanded by
 * default; typing can be switched off there too ("narrator-typing").
 */

/** The books narrated: option books read every five minutes, around the clock. */
export const NARRATOR_BOOKS = ["BTC", "ETH"] as const;
export type NarratorBook = (typeof NARRATOR_BOOKS)[number];

export const NARRATOR_PATH = "/data/narrator";
/** Entries in the list: the screenshot the owner showed kept 200. */
export const NARRATOR_KEEP = 200;

/** One read of the book (app/data.ts gammaReads). */
export type NarratorRow = GammaRead;

export type NarratorEvent =
  | { kind: "cross-down" | "cross-up"; flip: number; short: boolean }
  | { kind: "onto-from-above" | "onto-from-below"; flip: number }
  | { kind: "floor-break" | "ceiling-break"; wall: number }
  | { kind: "floor-test" | "ceiling-test"; wall: number; n: number }
  | {
      kind: "floor-up" | "floor-down" | "ceiling-up" | "ceiling-down" | "flip-up" | "flip-down";
      from: number;
      to: number;
    }
  | { kind: "net-grow" | "net-shrink"; pct: number; net: number }
  | { kind: "day-low" | "day-high"; price: number }
  | { kind: "quiet"; spot: number; flip: number | null };

export type NarratorTone = "calm" | "edge" | "short";

export interface NarratorEntry {
  at: number;
  /** At most MAX_EVENTS, weightiest first. */
  events: NarratorEvent[];
  /** On the flip (edge), dealers short gamma (short), else calm. */
  tone: NarratorTone;
  marks: ("jolt" | "alert")[];
  /** A line that changes the picture: through the flip or a wall. */
  strong: boolean;
  putWall: number | null;
  flip: number | null;
  callWall: number | null;
}

const MIN = 60_000;
const DAY = 86_400_000;
/** Within this of the flip, the price is on it. */
const BAND = 0.002;
/** A wall is being tested within TEST_IN of it, and the test is over past TEST_OUT. */
const TEST_IN = 0.004;
const TEST_OUT = 0.008;
/** Past a wall by this, the price has broken it. */
const BREAK = 0.002;
const FLIP_MOVE = 0.0075;
/** Net gamma grown to 1.5 times, or thinned to two thirds, over the hour. */
const NET_CHANGE = 0.5;
const NET_LOOKBACK = 60 * MIN;
const NET_COOLDOWN = 120 * MIN;
/** A day's new low or high is news once the day is two hours old and the old one an hour old. */
const EXTREME_SETTLED = 120 * MIN;
const EXTREME_FRESH = 60 * MIN;
const QUIET_AFTER = 60 * MIN;
/** A longer hole in the reads (the collector down) starts the comparison over. */
const GAP = 30 * MIN;
const MAX_EVENTS = 3;

const PRIORITY: Readonly<Record<NarratorEvent["kind"], number>> = {
  "cross-down": 3,
  "cross-up": 3,
  "floor-break": 3,
  "ceiling-break": 3,
  "onto-from-above": 2,
  "onto-from-below": 2,
  "floor-test": 2,
  "ceiling-test": 2,
  "net-grow": 1,
  "net-shrink": 1,
  "floor-up": 1,
  "floor-down": 1,
  "ceiling-up": 1,
  "ceiling-down": 1,
  "flip-up": 1,
  "flip-down": 1,
  "day-low": 1,
  "day-high": 1,
  quiet: 0,
};
const ALERT = new Set<NarratorEvent["kind"]>([
  "cross-down",
  "cross-up",
  "floor-break",
  "ceiling-break",
]);
const JOLT = new Set<NarratorEvent["kind"]>(["net-grow", "net-shrink"]);

interface WallState {
  /** The wall as last told, or null when the book has none. */
  at: number | null;
  /** A different strike seen once, waiting for a second read to confirm it. */
  candidate: number | null | undefined;
  near: boolean;
  broken: boolean;
  tests: number;
}

interface State {
  day: number;
  dayStart: number;
  /** The last side of the flip the price was clearly on. */
  side: "above" | "below" | null;
  on: boolean;
  floor: WallState;
  ceiling: WallState;
  flip: number | null;
  flipCandidate: number | null | undefined;
  low: number;
  lowAt: number;
  lowSaid: number;
  high: number;
  highAt: number;
  highSaid: number;
  grewSaid: number;
  thinnedSaid: number;
  lastEntry: number;
}

const utcDay = (ms: number) => Math.floor(ms / DAY);

/** How far the price is above a floor (positive) or below a ceiling (positive), as a fraction. */
const clearance = (spot: number, wall: number, floor: boolean) =>
  floor ? spot / wall - 1 : 1 - spot / wall;

function wallAt(spot: number, wall: number | null, floor: boolean, tests: number): WallState {
  const d = wall === null ? 0 : clearance(spot, wall, floor);
  return {
    at: wall,
    candidate: undefined,
    near: wall !== null && d >= -BREAK && d <= TEST_IN,
    broken: wall !== null && d < -BREAK,
    tests,
  };
}

function sideOf(row: NarratorRow): { side: "above" | "below" | null; on: boolean } {
  if (row.flip === null) return { side: null, on: false };
  const d = row.spot / row.flip - 1;
  return { side: d > BAND ? "above" : d < -BAND ? "below" : null, on: Math.abs(d) <= BAND };
}

/** The state a read starts from, without a word: the first read, or the first after a gap. */
function baseline(row: NarratorRow, sameDay: State | null): State {
  const { side, on } = sideOf(row);
  return {
    day: utcDay(row.at),
    dayStart: sameDay?.dayStart ?? row.at,
    side,
    on,
    floor: wallAt(
      row.spot,
      row.putWall,
      true,
      sameDay?.floor.at === row.putWall ? sameDay.floor.tests : 0,
    ),
    ceiling: wallAt(
      row.spot,
      row.callWall,
      false,
      sameDay?.ceiling.at === row.callWall ? sameDay.ceiling.tests : 0,
    ),
    flip: row.flip,
    flipCandidate: undefined,
    low: sameDay ? Math.min(sameDay.low, row.spot) : row.spot,
    lowAt: sameDay && sameDay.low <= row.spot ? sameDay.lowAt : row.at,
    lowSaid: sameDay?.lowSaid ?? 0,
    high: sameDay ? Math.max(sameDay.high, row.spot) : row.spot,
    highAt: sameDay && sameDay.high >= row.spot ? sameDay.highAt : row.at,
    highSaid: sameDay?.highSaid ?? 0,
    grewSaid: sameDay?.grewSaid ?? 0,
    thinnedSaid: sameDay?.thinnedSaid ?? 0,
    lastEntry: sameDay?.lastEntry ?? row.at,
  };
}

function regime(st: State, row: NarratorRow, events: NarratorEvent[]): void {
  const { side, on } = sideOf(row);
  if (row.flip !== null) {
    if (side && st.side && side !== st.side) {
      events.push({
        kind: side === "below" ? "cross-down" : "cross-up",
        flip: row.flip,
        short: row.net < 0,
      });
    } else if (on && !st.on && st.side) {
      events.push({
        kind: st.side === "above" ? "onto-from-above" : "onto-from-below",
        flip: row.flip,
      });
    }
  }
  if (side) st.side = side;
  st.on = on;
}

function wall(
  w: WallState,
  strike: number | null,
  spot: number,
  floor: boolean,
  events: NarratorEvent[],
): void {
  if (strike !== w.at) {
    if (w.candidate !== undefined && strike === w.candidate) {
      if (w.at !== null && strike !== null) {
        const up = strike > w.at;
        events.push({
          kind: floor ? (up ? "floor-up" : "floor-down") : up ? "ceiling-up" : "ceiling-down",
          from: w.at,
          to: strike,
        });
      }
      Object.assign(w, wallAt(spot, strike, floor, 0));
      return;
    }
    w.candidate = strike;
  } else {
    w.candidate = undefined;
  }
  if (w.at === null) return;
  const d = clearance(spot, w.at, floor);
  if (!w.broken && d < -BREAK) {
    w.broken = true;
    w.near = false;
    events.push({ kind: floor ? "floor-break" : "ceiling-break", wall: w.at });
    return;
  }
  if (w.broken) {
    if (d > BREAK) w.broken = false;
    else return;
  }
  if (!w.near && d <= TEST_IN) {
    w.near = true;
    w.tests += 1;
    events.push({ kind: floor ? "floor-test" : "ceiling-test", wall: w.at, n: w.tests });
  } else if (w.near && d > TEST_OUT) {
    w.near = false;
  }
}

function flipMove(st: State, row: NarratorRow, events: NarratorEvent[]): void {
  const f = row.flip;
  if (f === null) return;
  if (st.flip === null) {
    st.flip = f;
    return;
  }
  if (Math.abs(f - st.flip) / row.spot < FLIP_MOVE) {
    st.flipCandidate = undefined;
    return;
  }
  const c = st.flipCandidate;
  if (c !== undefined && c !== null && Math.abs(f - c) / row.spot < FLIP_MOVE / 3) {
    events.push({ kind: f > st.flip ? "flip-up" : "flip-down", from: st.flip, to: f });
    st.flip = f;
    st.flipCandidate = undefined;
  } else {
    st.flipCandidate = f;
  }
}

function netChange(
  st: State,
  row: NarratorRow,
  hour: readonly NarratorRow[],
  events: NarratorEvent[],
): void {
  // Near the flip net gamma is near zero, and any change there is a big percentage of nothing.
  if (row.flip !== null && Math.abs(row.spot / row.flip - 1) < 3 * BAND) return;
  const then = hour.find((r) => r.at >= row.at - NET_LOOKBACK - 2.5 * MIN);
  if (!then || row.at - then.at < NET_LOOKBACK - 5 * MIN) return;
  if (then.net === 0 || Math.sign(then.net) !== Math.sign(row.net)) return;
  const ratio = Math.abs(row.net) / Math.abs(then.net);
  if (ratio >= 1 + NET_CHANGE && row.at - st.grewSaid >= NET_COOLDOWN) {
    events.push({ kind: "net-grow", pct: ratio - 1, net: row.net });
    st.grewSaid = row.at;
  } else if (ratio <= 1 / (1 + NET_CHANGE) && row.at - st.thinnedSaid >= NET_COOLDOWN) {
    events.push({ kind: "net-shrink", pct: 1 - ratio, net: row.net });
    st.thinnedSaid = row.at;
  }
}

function extremes(st: State, row: NarratorRow, events: NarratorEvent[]): void {
  const settled = row.at - st.dayStart >= EXTREME_SETTLED;
  if (row.spot < st.low) {
    if (settled && row.at - st.lowAt >= EXTREME_FRESH && row.at - st.lowSaid >= EXTREME_FRESH) {
      events.push({ kind: "day-low", price: row.spot });
      st.lowSaid = row.at;
    }
    st.low = row.spot;
    st.lowAt = row.at;
  }
  if (row.spot > st.high) {
    if (settled && row.at - st.highAt >= EXTREME_FRESH && row.at - st.highSaid >= EXTREME_FRESH) {
      events.push({ kind: "day-high", price: row.spot });
      st.highSaid = row.at;
    }
    st.high = row.spot;
    st.highAt = row.at;
  }
}

function newDay(st: State, row: NarratorRow): void {
  st.day = utcDay(row.at);
  st.dayStart = row.at;
  st.floor.tests = 0;
  st.ceiling.tests = 0;
  st.low = row.spot;
  st.lowAt = row.at;
  st.high = row.spot;
  st.highAt = row.at;
}

function entryFor(row: NarratorRow, events: readonly NarratorEvent[]): NarratorEntry {
  const ranked = events
    .map((event, i) => ({ event, i }))
    .sort((a, b) => PRIORITY[b.event.kind] - PRIORITY[a.event.kind] || a.i - b.i)
    .slice(0, MAX_EVENTS)
    .map((x) => x.event);
  const marks: NarratorEntry["marks"] = [];
  if (ranked.some((e) => JOLT.has(e.kind))) marks.push("jolt");
  if (ranked.some((e) => ALERT.has(e.kind))) marks.push("alert");
  return {
    at: row.at,
    events: ranked,
    tone: sideOf(row).on ? "edge" : row.net < 0 ? "short" : "calm",
    marks,
    strong: PRIORITY[ranked[0]?.kind ?? "quiet"] >= 3,
    putWall: row.putWall,
    flip: row.flip,
    callWall: row.callWall,
  };
}

/** A book's reads, oldest first, as the entries they make, oldest first. */
export function narrate(rows: readonly NarratorRow[]): NarratorEntry[] {
  const out: NarratorEntry[] = [];
  let st: State | null = null;
  let prev: NarratorRow | null = null;
  const hour: NarratorRow[] = [];
  for (const row of rows) {
    if (!(row.spot > 0) || !Number.isFinite(row.net)) continue;
    if (!st || !prev || row.at - prev.at > GAP) {
      st = baseline(row, st && st.day === utcDay(row.at) ? st : null);
      hour.length = 0;
      hour.push(row);
      prev = row;
      continue;
    }
    if (utcDay(row.at) !== st.day) newDay(st, row);
    const events: NarratorEvent[] = [];
    regime(st, row, events);
    wall(st.floor, row.putWall, row.spot, true, events);
    wall(st.ceiling, row.callWall, row.spot, false, events);
    flipMove(st, row, events);
    netChange(st, row, hour, events);
    extremes(st, row, events);
    if (events.length === 0 && row.at - st.lastEntry >= QUIET_AFTER) {
      events.push({ kind: "quiet", spot: row.spot, flip: row.flip });
    }
    if (events.length > 0) {
      out.push(entryFor(row, events));
      st.lastEntry = row.at;
    }
    hour.push(row);
    while (hour.length > 0 && (hour[0]?.at ?? 0) < row.at - NET_LOOKBACK - 30 * MIN) hour.shift();
    prev = row;
  }
  return out;
}

/** The first read the list needs: yesterday's UTC midnight, so today's counters start at the day. */
export const narratorSince = (now: number) => (utcDay(now) - 1) * DAY;

/** A `?book=` value, or null for one the narrator does not read. */
export function parseNarratorBook(value: string | null): NarratorBook | null {
  const book = (value ?? "").toUpperCase();
  return NARRATOR_BOOKS.find((b) => b === book) ?? null;
}

const price = (v: number) => formatPrice(v);
/** "43%", and "0.5%" under ten, where a whole number would round a distance from the flip to 0%. */
const pct = (fraction: number) => {
  const p = fraction * 100;
  return `${p < 9.95 ? p.toFixed(1) : Math.round(p).toString()}%`;
};

function sentence(e: NarratorEvent): string {
  switch (e.kind) {
    case "cross-down":
      return e.short
        ? tr(
            "Price is now below the gamma flip at {flip}: dealers are short gamma here, so their hedging adds to moves.",
            { flip: price(e.flip) },
          )
        : tr("Price is now below the gamma flip at {flip}.", { flip: price(e.flip) });
    case "cross-up":
      return e.short
        ? tr("Price is now above the gamma flip at {flip}.", { flip: price(e.flip) })
        : tr(
            "Price is back above the gamma flip at {flip}: dealers are long gamma here, so their hedging damps moves.",
            { flip: price(e.flip) },
          );
    case "onto-from-above":
      return tr(
        "Price has slipped onto the gamma flip at {flip}: nothing resolves until it holds or gives.",
        { flip: price(e.flip) },
      );
    case "onto-from-below":
      return tr("Price has climbed back to the gamma flip at {flip} from below.", {
        flip: price(e.flip),
      });
    case "floor-break":
      return tr("Price has broken below the put wall at {wall}: no floor left underneath.", {
        wall: price(e.wall),
      });
    case "ceiling-break":
      return tr("Price has broken above the call wall at {wall}: no ceiling left overhead.", {
        wall: price(e.wall),
      });
    case "floor-test":
      return e.n === 1
        ? tr("Price is testing the put wall at {wall} for the first time today.", {
            wall: price(e.wall),
          })
        : tr("Price is back at the put wall at {wall}: test {n} today.", {
            wall: price(e.wall),
            n: e.n,
          });
    case "ceiling-test":
      return e.n === 1
        ? tr("Price is testing the call wall at {wall} for the first time today.", {
            wall: price(e.wall),
          })
        : tr("Price is back at the call wall at {wall}: test {n} today.", {
            wall: price(e.wall),
            n: e.n,
          });
    case "floor-up":
      return tr("The put wall has moved up to {to} from {from}.", {
        to: price(e.to),
        from: price(e.from),
      });
    case "floor-down":
      return tr("The put wall has moved down to {to} from {from}.", {
        to: price(e.to),
        from: price(e.from),
      });
    case "ceiling-up":
      return tr("The call wall has moved up to {to} from {from}.", {
        to: price(e.to),
        from: price(e.from),
      });
    case "ceiling-down":
      return tr("The call wall has come down to {to} from {from}.", {
        to: price(e.to),
        from: price(e.from),
      });
    case "flip-up":
      return tr("The gamma flip has moved up to {to} from {from}.", {
        to: price(e.to),
        from: price(e.from),
      });
    case "flip-down":
      return tr("The gamma flip has moved down to {to} from {from}.", {
        to: price(e.to),
        from: price(e.from),
      });
    case "net-grow":
      return tr("Dealers' gamma at this price has grown {pct} in the hour, to {net} per 1% move.", {
        pct: pct(e.pct),
        net: formatUsd(e.net),
      });
    case "net-shrink":
      return tr(
        "Dealers' gamma at this price has thinned {pct} in the hour, to {net} per 1% move.",
        {
          pct: pct(e.pct),
          net: formatUsd(e.net),
        },
      );
    case "day-low":
      return tr("A new low for the UTC day at {price}.", { price: price(e.price) });
    case "day-high":
      return tr("A new high for the UTC day at {price}.", { price: price(e.price) });
    case "quiet": {
      if (e.flip === null) {
        return tr("Quiet hour: price {spot}, with no gamma flip within 30% either way.", {
          spot: price(e.spot),
        });
      }
      const d = e.spot / e.flip - 1;
      const values = { spot: price(e.spot), flip: price(e.flip), pct: pct(Math.abs(d)) };
      if (Math.abs(d) <= BAND) {
        return tr("Quiet hour: price {spot} sits right on the gamma flip at {flip}.", values);
      }
      return d > 0
        ? tr("Quiet hour: price {spot} holds {pct} above the gamma flip at {flip}.", values)
        : tr("Quiet hour: price {spot} sits {pct} below the gamma flip at {flip}.", values);
    }
  }
}

/** An entry's whole line: its sentences, then the levels it was read at. */
export function entryText(e: NarratorEntry): string {
  const level = (v: number | null) => (v === null ? tr("none") : price(v));
  const levels = tr("Levels: put wall {put} · flip {flip} · call wall {call}.", {
    put: level(e.putWall),
    flip: level(e.flip),
    call: level(e.callWall),
  });
  // Chinese and Japanese run their sentences together; the others leave a space.
  const gap = currentLocale() === "zh" || currentLocale() === "ja" ? "" : " ";
  return [...e.events.map(sentence), levels].join(gap);
}

function entryItem(e: NarratorEntry): string {
  const marks = e.marks
    .map((m) => `<span class="narr-${m}">${icon(m === "jolt" ? "zap" : "alert")}</span>`)
    .join("");
  return `<li class="narr-e narr-${e.tone}${e.strong ? " narr-strong" : ""}" data-at="${e.at}"><span class="narr-when">${timeTag(e.at, "hm")}<i class="narr-dot"></i>${marks}</span><span class="narr-text">${esc(entryText(e))}</span></li>`;
}

/** The answer of /data/narrator: the list as markup, oldest first. */
export function narratorFeed(book: NarratorBook, entries: readonly NarratorEntry[]): string {
  return `<ol class="narr-feed" data-book="${book}">${entries.map(entryItem).join("")}</ol>`;
}

export function narratorResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

/** The strip, between the masthead's first bar and the menu (layout.ts). Filled by narratorScript. */
export function narratorStrip(): string {
  const books = NARRATOR_BOOKS.map(
    (b, i) => `<button type="button" data-narr-book="${b}" aria-pressed="${i === 0}">${b}</button>`,
  ).join("");
  return `<section class="narr" id="narr" aria-label="${tr("Market narrator")}">
<div class="wrap narr-head"><button type="button" class="narr-toggle" aria-expanded="true" aria-controls="narr-body">${icon("signal")}<b>${tr("Market narrator")}</b><span class="narr-caret">${icon("caret")}</span></button><span class="narr-books" role="group" aria-label="${tr("Option book")}">${books}</span><span class="narr-peek" aria-hidden="true"></span><span class="narr-count"></span></div>
<div class="narr-body" id="narr-body"><div class="narr-clip"><ol class="wrap narr-list"><li class="narr-note">${tr("Loading…")}</li></ol></div></div>
</section>`;
}

/**
 * In the head, before the body paints: expanded, collapsed or off on <html>, so the masthead is its
 * final height from the first frame. Without JavaScript nothing is set and the strip stays hidden: it
 * has nothing to show without the script.
 */
export const NARRATOR_HEAD_SCRIPT = `(()=>{let v=null;try{v=localStorage.getItem("narrator")}catch(_){}document.documentElement.dataset.narr=v==="collapsed"||v==="off"?v:"expanded"})();`;

/**
 * The strip's styles. The masthead grows with it, and --mast (its height, which sticky table heads
 * and anchors use) follows: the page script measures the masthead and watches it resize (layout.ts).
 */
export const NARRATOR_CSS = `
:root{--narr-h:100px}
.narr{display:none;border-top:1px solid var(--rule)}
:root[data-narr=expanded] .narr,:root[data-narr=collapsed] .narr{display:block}
.narr-head{display:flex;align-items:center;gap:0 12px;height:22px;white-space:nowrap;overflow:hidden}
.narr-toggle{display:flex;align-items:center;gap:6px;flex-shrink:0;padding:0;border:0;background:none;color:var(--muted);font:inherit;text-transform:uppercase;letter-spacing:.08em;cursor:pointer}
.narr-toggle b{color:var(--ink)}
.narr-toggle:hover,.narr-toggle:hover b{color:var(--accent)}
.narr-caret{display:inline-flex;transition:transform .28s ease}
:root[data-narr=collapsed] .narr-caret{transform:rotate(-90deg)}
.narr-books{display:flex;gap:2px;flex-shrink:0}
.narr-books button{padding:0 6px;border:0;background:none;color:var(--muted);font:inherit;cursor:pointer}
.narr-books button[aria-pressed=true]{background:var(--ink);color:var(--bg)}
.narr-books button:hover{color:var(--accent)}
.narr-books button[aria-pressed=true]:hover{color:var(--bg)}
.narr-peek{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--muted)}
:root[data-narr=expanded] .narr-peek{visibility:hidden}
.narr-count{flex-shrink:0;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.narr-body{display:grid;grid-template-rows:1fr;transition:grid-template-rows .28s ease,opacity .28s ease}
:root[data-narr=collapsed] .narr-body{grid-template-rows:0fr;opacity:0}
.narr-clip{min-height:0;overflow:hidden}
.narr-list{list-style:none;margin:0 auto;height:var(--narr-h);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;border-top:1px solid var(--rule)}
.narr-e{display:grid;grid-template-columns:auto minmax(0,1fr);gap:0 8px;padding:3px 0;border-bottom:1px solid var(--rule)}
.narr-e:last-child{border-bottom:0}
.narr-when{display:flex;align-items:center;gap:5px;height:16px;color:var(--muted);white-space:nowrap}
.narr-when .ico{font-size:12px}
.narr-dot{display:inline-block;width:7px;height:7px;background:var(--muted)}
.narr-edge .narr-dot{background:var(--warn)}
.narr-short .narr-dot{background:var(--orange)}
.narr-jolt{display:inline-flex;color:var(--warn)}
.narr-alert{display:inline-flex;color:var(--orange)}
.narr-text{display:block;line-height:16px;color:var(--ink);overflow-wrap:anywhere}
.narr-edge .narr-text{color:var(--warn)}
.narr-short .narr-text{color:var(--orange)}
.narr-strong .narr-text{font-weight:700}
.narr-day{padding:5px 0 2px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.narr-note{padding:6px 0;color:var(--muted)}
.tw-host{position:relative;overflow:hidden}
.tw-ghost{visibility:hidden}
.tw-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:flex-start}
.tw-line{position:relative;display:inline-block;flex-shrink:0;max-width:100%;width:0;overflow:hidden;white-space:nowrap;vertical-align:top}
.tw-line.tw-on{animation:tw-reveal var(--tw-d,1s) steps(var(--tw-s,1),end) forwards}
.tw-line.tw-on::after,.tw-line.tw-hold::after{content:"";position:absolute;right:0;bottom:0;width:5px;height:16px;background:var(--accent);animation:tw-blink .75s step-end infinite;pointer-events:none}
@keyframes tw-reveal{from{width:0}to{width:var(--tw-w)}}
@keyframes tw-blink{0%,100%{opacity:1}50%{opacity:0}}
@media (max-width:560px){:root{--narr-h:68px}.narr-count{display:none}}
@media (prefers-reduced-motion:reduce){.narr-body,.narr-caret{transition:none}.tw-line{width:auto;animation:none}.tw-line::after{display:none}}
`;

/** The browser half, on every page with the strip. Plain functions, nothing from outside its text. */
export function narratorScript(): string {
  const words = scriptStrings({
    entries: tr("{n} entries"),
    empty: tr("Nothing to say yet: the narrator writes when the {book} option book moves."),
    failed: tr("The narrator could not be read just now."),
    loading: tr("Loading…"),
  });
  return `(()=>{
const root=document.getElementById("narr");
if(!root)return;
const de=document.documentElement;
const W=${words};
const BOOKS=${JSON.stringify(NARRATOR_BOOKS)};
const PATH=${JSON.stringify(NARRATOR_PATH)};
// The Typewriter's pace: 40 characters a second, the cursor held 1-4 s on the last line.
const SPEED=40,HOLD_MIN=1000,HOLD_MAX=4000,POLL=60000,KEEP=${NARRATOR_KEEP};
const get=(k,ses)=>{try{return (ses?sessionStorage:localStorage).getItem(k)}catch(_){return null}};
const put=(k,v,ses)=>{try{const s=ses?sessionStorage:localStorage;v===null?s.removeItem(k):s.setItem(k,v)}catch(_){}};
const list=root.querySelector(".narr-list"),peek=root.querySelector(".narr-peek"),count=root.querySelector(".narr-count"),toggle=root.querySelector(".narr-toggle");
const picks=[...root.querySelectorAll("[data-narr-book]")];
let book=get("narrator-book");if(BOOKS.indexOf(book)<0)book=BOOKS[0];
let gen=0,queue=[],typing=false,pinned=true,newest=0,lastDay="",loaded=false;
const state=()=>de.dataset.narr||"expanded";
const reduced=()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(_){return false}};
const fmt=(ms,f)=>{const T=window.airratesTime,Z=window.airratesZone;return T&&Z?T.fmt(ms,f,Z(ms),T.W,0):""};
const stick=()=>{if(pinned)list.scrollTop=list.scrollHeight};
list.addEventListener("scroll",()=>{pinned=list.scrollHeight-list.scrollTop-list.clientHeight<24},{passive:true});
const meta=()=>{const all=list.querySelectorAll("li.narr-e");count.textContent=all.length?W.entries.replace("{n}",String(all.length)):"";const last=all[all.length-1];peek.textContent=last?last.querySelector(".narr-text").textContent:""};
const note=t=>{list.textContent="";lastDay="";const li=document.createElement("li");li.className="narr-note";li.textContent=t;list.append(li);meta()};
// One entry into the list: a day line first where the reader's date changes, its time in their zone.
const add=li=>{
  const at=Number(li.dataset.at),day=fmt(at,"md");
  if(day&&day!==lastDay){const d=document.createElement("li");d.className="narr-day";d.textContent=day;list.append(d);lastDay=day}
  const t=li.querySelector("time[data-t]");if(t){const s=fmt(at,"hm");if(s)t.textContent=s}
  list.append(li);
  let extra=list.querySelectorAll("li.narr-e").length-KEEP;
  while(extra>0&&list.firstElementChild){if(list.firstElementChild.classList.contains("narr-e"))extra--;list.firstElementChild.remove()}
  meta();
};
// The Typewriter: the text measured into the lines it wraps to where it stands, then each line
// revealed by a stepped width animation behind a block cursor. The entry grows a line at a time as
// each line starts, so every new line pushes what is above it up.
const type=(el,done)=>{
  const text=el.textContent,node=el.firstChild;
  if(!text||!node||node.nodeType!==3||reduced()||get("narrator-typing")==="off"||state()!=="expanded"||document.hidden){stick();done();return}
  const r=document.createRange(),lines=[];let start=0,top=null;
  for(let i=0;i<text.length;i++){if(text[i]===" ")continue;r.setStart(node,i);r.setEnd(node,i+1);const b=r.getBoundingClientRect();if(top===null){top=b.top;continue}if(b.top>top+2){lines.push(text.slice(start,i));start=i;top=b.top}}
  lines.push(text.slice(start));
  const lh=parseFloat(getComputedStyle(el).lineHeight)||16;
  const ghost=document.createElement("span"),over=document.createElement("span");
  ghost.className="tw-ghost";ghost.textContent=text;over.className="tw-over";over.setAttribute("aria-hidden","true");
  el.textContent="";el.append(ghost,over);el.classList.add("tw-host");
  let k=0;
  const finish=()=>{el.textContent=text;el.classList.remove("tw-host");el.style.height="";stick();done()};
  const next=()=>{
    if(!el.isConnected){done();return}
    const s=document.createElement("span");s.className="tw-line";s.textContent=lines[k];over.append(s);
    el.style.height=(k+1)*lh+"px";stick();
    s.style.width="auto";const w=Math.min(s.scrollWidth,el.clientWidth);s.style.width="0";
    const n=Math.max(lines[k].length,1);
    s.style.setProperty("--tw-d",Math.max(n/SPEED*1000,120)+"ms");s.style.setProperty("--tw-w",w+"px");s.style.setProperty("--tw-s",String(n));
    void s.offsetWidth;s.classList.add("tw-on");
    const end=e=>{if(e.animationName!=="tw-reveal")return;s.removeEventListener("animationend",end);s.style.width=w+"px";s.classList.remove("tw-on");k++;if(k<lines.length){next();return}s.classList.add("tw-hold");setTimeout(finish,HOLD_MIN+Math.random()*(HOLD_MAX-HOLD_MIN))};
    s.addEventListener("animationend",end);
  };
  next();
};
const run=()=>{
  if(typing||!queue.length)return;
  const li=queue.shift(),g=gen;
  typing=true;add(li);put("narr-seen-"+book,li.dataset.at,1);
  const text=li.querySelector(".narr-text");
  if(!text){typing=false;run();return}
  type(text,()=>{if(g!==gen)return;typing=false;run()});
};
const parse=html=>[...new DOMParser().parseFromString(html,"text/html").querySelectorAll("li.narr-e")];
const load=async first=>{
  const g=gen;let html;
  try{const r=await fetch(PATH+"?book="+encodeURIComponent(book));if(!r.ok)throw new Error(String(r.status));html=await r.text()}catch(_){if(g===gen&&first)note(W.failed);return}
  if(g!==gen)return;
  loaded=true;
  const items=parse(html);
  if(first){
    queue=[];
    if(!items.length){note(W.empty.replace("{book}",book));return}
    list.textContent="";lastDay="";
    const last=items[items.length-1],fresh=Number(last.dataset.at)>Number(get("narr-seen-"+book,1)||0);
    for(const li of items)if(li!==last||!fresh)add(li);
    newest=Number(last.dataset.at);
    pinned=true;list.scrollTop=list.scrollHeight;
    if(fresh){queue.push(last);run()}
    return;
  }
  const added=items.filter(li=>Number(li.dataset.at)>newest);
  if(!added.length)return;
  if(list.querySelector(".narr-note")){list.textContent="";lastDay=""}
  newest=Number(added[added.length-1].dataset.at);
  // A reader back after a while sees the backlog at once, and the last three type.
  for(const li of added.slice(0,-3))add(li);
  stick();
  queue.push(...added.slice(-3));run();
};
const setBook=b=>{
  book=b;put("narrator-book",b===BOOKS[0]?null:b);
  for(const p of picks)p.setAttribute("aria-pressed",String(p.dataset.narrBook===b));
  gen++;typing=false;queue=[];newest=0;note(W.loading);load(true);
};
for(const p of picks){p.setAttribute("aria-pressed",String(p.dataset.narrBook===book));p.addEventListener("click",()=>{if(p.dataset.narrBook!==book)setBook(p.dataset.narrBook)})}
const show=v=>{
  de.dataset.narr=v;toggle.setAttribute("aria-expanded",String(v==="expanded"));
  if(v==="expanded")requestAnimationFrame(()=>{pinned=true;list.scrollTop=list.scrollHeight});
  if(v!=="off"&&!loaded)load(true);
};
toggle.addEventListener("click",()=>{const v=state()==="expanded"?"collapsed":"expanded";put("narrator",v==="expanded"?null:v);show(v)});
// The settings page changes the choice on this same page.
addEventListener("airrates:narrator",()=>{const v=get("narrator");show(v==="collapsed"||v==="off"?v:"expanded")});
// The clock switched between local and UTC: the list again, with its days and times in the new zone.
addEventListener("airrates:clock",()=>{const all=[...list.querySelectorAll("li.narr-e")];if(!all.length)return;list.textContent="";lastDay="";for(const li of all)add(li);stick()});
show(state());
const tick=()=>{if(!document.hidden&&state()!=="off")load(!loaded)};
setInterval(tick,POLL);
document.addEventListener("visibilitychange",tick);
})();`;
}
