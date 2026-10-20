import type {
  GammaExpiry,
  GammaExposure,
  GammaStrike,
  GammaWallDay,
  GammaWallStats,
  LevelsData,
} from "../app/data";
import {
  type GammaParams,
  type HeatmapParams,
  heatmapToQuery,
  type LevelBasis,
} from "../app/params";
import { lazyPlaceholder } from "./chart-skeleton";
import { horizonIv, termStructure, YEAR_MS } from "./expected-move";
import { esc, formatPrice, formatUsd } from "./format";
import {
  agoText,
  type BookTab,
  bookPicker,
  choiceHref,
  dayLabel,
  freshness,
  leftText,
  level,
  publisher,
  signedPct,
  unitSymbol,
} from "./gamma";
import { helpButton, helpPanel } from "./help";
import { tr } from "./i18n";

/**
 * The Rates page's IV Walls and Ceiling & Floor tabs: the levels a book's options set for the day, and
 * how price has behaved at them (collector migration 045).
 *
 * IV WALLS. The IV wall is the move the options price for the day, the reference close plus and minus
 * one standard deviation, ref x IV x sqrt(1/365), from the IV a day ahead. The 90% wall is the multiple
 * of a day's deviation that price stayed within on 90% of past days: measured for BTC and ETH (every
 * Deribit day since 2021 against DVOL, the whole day's range) and the S&P 500 (every session since 2022
 * against VIX1D, closes only), the normal distribution's 1.645 for a book with no history. The owner's
 * framework says price stays inside 90% of the time and reverses off the wall; the tab shows what the
 * record says instead, which is a little over half for a touch of the wall.
 *
 * CEILING & FLOOR, two readings side by side, as the owner chose: the gamma ceiling and floor (the
 * strike above the spot holding the most call gamma, the one below it the most put gamma, in the
 * nearest expiry) and the dealer range (every option read as sold by dealers who keep the premium: max
 * pain, and the break-evens either side where they start losing). A level within a quarter of the
 * day's move of an IV wall is marked as lined up with it.
 *
 * THE DAY. A book with a day of its own (BTC and ETH from Deribit's 08:00 UTC, the US books by session)
 * has its levels fixed by the day's first read, so they do not drift with the IV through the day. A book
 * without one (an end-of-day index) gets them from its latest file, for its next session, untracked.
 */

export const IVWALLS_PANEL_ID = "panel-rates-ivwalls";
export const LEVELS_PANEL_ID = "panel-rates-levels";
/** A day row older than this is not today's: a long weekend at most. */
const CURRENT_MS = 4 * 86_400_000;
/** A ceiling or floor this close to an IV wall, in shares of the day's 1σ move, lines up with it. */
export const ALIGN_SHARE = 0.25;
const DAY_YEARS = 86_400_000 / YEAR_MS;

export interface Levels {
  /** The day's levels, or the week's expiry's (Ceiling & Floor's week view). */
  period: LevelBasis;
  /**
   * "day": fixed by the first read of the day (or of the week); "next": read from the book now, for an
   * end-of-day book's next session or a week whose levels no row holds yet.
   */
  basis: "day" | "next";
  /** The row's day, or null for an untracked book. */
  day: string | null;
  source: string;
  ref: number;
  iv: number | null;
  move1: number | null;
  upper1: number | null;
  lower1: number | null;
  k90: number;
  method: "dvol" | "vix1d" | "vix9d" | "theory";
  /** The IV the 90% wall scales: the history method's, else the options' own. */
  sigma90: number | null;
  move90: number | null;
  upper90: number | null;
  lower90: number | null;
  expiry: Date | null;
  gammaCeiling: number | null;
  gammaFloor: number | null;
  beCeiling: number | null;
  beFloor: number | null;
  maxPain: number | null;
  high: number | null;
  low: number | null;
  last: number | null;
}

/** The walls for a reference, an IV, a 90% multiple and the years they span (a day, or to the week's expiry). */
function walls(
  ref: number,
  iv: number | null,
  k90: number,
  sigma90: number | null,
  years: number = DAY_YEARS,
) {
  const root = Math.sqrt(Math.max(0, years));
  const move1 = iv !== null && iv > 0 && root > 0 ? ref * iv * root : null;
  const scale = sigma90 ?? iv;
  const move90 = scale !== null && scale > 0 && root > 0 ? ref * scale * root * k90 : null;
  return {
    move1,
    upper1: move1 === null ? null : ref + move1,
    lower1: move1 === null ? null : ref - move1,
    move90,
    upper90: move90 === null ? null : ref + move90,
    lower90: move90 === null ? null : Math.max(0, ref - move90),
  };
}

/** The gamma ceiling and floor from a scope's strikes, for a book with no row to read them from. */
function strikeLevels(strikes: readonly GammaStrike[], spot: number) {
  let ceiling: number | null = null;
  let floor: number | null = null;
  let bestCall = 0;
  let bestPut = 0;
  for (const k of strikes) {
    if (k.strike > spot && k.call_gex_usd > bestCall) {
      bestCall = k.call_gex_usd;
      ceiling = k.strike;
    }
    if (k.strike < spot && -k.put_gex_usd > bestPut) {
      bestPut = -k.put_gex_usd;
      floor = k.strike;
    }
  }
  return { ceiling, floor };
}

/** Today's levels: the day's row while it is current, else the book's next session from its file. */
export function todayLevels(data: LevelsData, now: number): Levels | null {
  const e = data.gamma.exposure;
  const row = data.days[0];
  if (row && now - row.set_at.getTime() < CURRENT_MS) {
    return {
      period: "day",
      basis: "day",
      day: row.day,
      source: row.source,
      ref: row.ref_price,
      iv: row.iv_day,
      k90: row.k90,
      method: row.method,
      sigma90: row.hist_sigma,
      ...walls(row.ref_price, row.iv_day, row.k90, row.hist_sigma),
      expiry: row.expiry,
      gammaCeiling: row.gamma_ceiling,
      gammaFloor: row.gamma_floor,
      beCeiling: row.be_ceiling,
      beFloor: row.be_floor,
      maxPain: row.max_pain,
      high: row.day_high,
      low: row.day_low,
      last: row.last_price,
    };
  }
  if (e === null || !(e.spot > 0)) return null;
  const at = e.computed_at.getTime();
  const iv = horizonIv(termStructure(data.gamma.expiries, at), DAY_YEARS);
  const k90 = 1.6448536269514722;
  const next = data.gamma.expiries.find((x) => x.expiry.getTime() === e.next_expiry.getTime());
  const { ceiling, floor } = strikeLevels(data.gamma.strikes, e.spot);
  return {
    period: "day",
    basis: "next",
    day: null,
    source: e.source,
    ref: e.spot,
    iv,
    k90,
    method: "theory",
    sigma90: null,
    ...walls(e.spot, iv, k90, null),
    expiry: e.next_expiry,
    gammaCeiling: ceiling,
    gammaFloor: floor,
    beCeiling: next?.be_high ?? null,
    beFloor: next?.be_low ?? null,
    maxPain: next?.max_pain ?? null,
    high: null,
    low: null,
    last: null,
  };
}

const DAY_MS = 86_400_000;

/** A week's key: Deribit's week (08:00 UTC Friday to Friday) by its Friday, a US week by its Monday. */
export function weekKey(day: string, source: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = source === "deribit" ? (d.getUTCDay() - 5 + 7) % 7 : (d.getUTCDay() - 1 + 7) % 7;
  return new Date(d.getTime() - back * DAY_MS).toISOString().slice(0, 10);
}

/**
 * A week as a day-shaped row, so the ladder and the record read it as they read a day: its levels from
 * its first row that holds them (rows written before migration 046 hold none), its range from all its
 * rows, its close from the newest. `rows` is newest first. Null when no row holds the week's levels.
 */
export function weekRow(rows: readonly GammaWallDay[]): GammaWallDay | null {
  const first = [...rows].reverse().find((r) => r.wk_expiry !== null);
  if (!first) return null;
  const highs = rows.flatMap((r) => (r.day_high === null ? [] : [r.day_high]));
  const lows = rows.flatMap((r) => (r.day_low === null ? [] : [r.day_low]));
  return {
    ...first,
    iv_day: first.wk_iv,
    hist_sigma: first.wk_hist_sigma,
    k90: first.wk_k90 ?? 1.6448536269514722,
    method: (first.wk_method ?? "theory") as GammaWallDay["method"],
    expiry: first.wk_expiry,
    gamma_ceiling: first.wk_gamma_ceiling,
    gamma_floor: first.wk_gamma_floor,
    be_ceiling: first.wk_be_ceiling,
    be_floor: first.wk_be_floor,
    max_pain: first.wk_max_pain,
    day_high: highs.length ? Math.max(...highs) : null,
    day_low: lows.length ? Math.min(...lows) : null,
    last_price: (rows[0] as GammaWallDay).last_price,
  };
}

/** The years a week row's walls span: from its reference close to the week's expiry. */
const weekYears = (r: GammaWallDay) =>
  r.wk_years ?? (r.expiry ? Math.max(0, r.expiry.getTime() - r.set_at.getTime()) / YEAR_MS : 0);

/** When the week holding `at` ends: Deribit's next Friday 08:00 UTC, a US week's Friday. */
export function weekEnd(at: number, source: string): number {
  const d = new Date(at);
  const wd = d.getUTCDay();
  if (source === "deribit") {
    const friday = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + ((5 - wd + 7) % 7),
      8,
    );
    return friday > at ? friday : friday + 7 * DAY_MS;
  }
  const ahead = wd === 6 ? 6 : wd === 0 ? 5 : 5 - wd;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ahead, 23, 59, 59);
}

/** The week's expiry: the last one ahead on or before the week's end, else the next one. */
export function weekExpiry(
  expiries: readonly GammaExpiry[],
  at: number,
  end: number,
): GammaExpiry | null {
  const ahead = expiries.filter((x) => x.expiry.getTime() > at);
  const inWeek = ahead.filter((x) => x.expiry.getTime() <= end);
  if (inWeek.length) return inWeek.reduce((a, b) => (b.expiry > a.expiry ? b : a));
  return ahead.reduce<GammaExpiry | null>(
    (a, b) => (a === null || b.expiry < a.expiry ? b : a),
    null,
  );
}

/** The levels of a day-shaped row (a day's, or a week's from weekRow) as the tabs draw them. */
function rowLevels(r: GammaWallDay, period: LevelBasis, years: number): Levels {
  return {
    period,
    basis: "day",
    day: r.day,
    source: r.source,
    ref: r.ref_price,
    iv: r.iv_day,
    k90: r.k90,
    method: r.method,
    sigma90: r.hist_sigma,
    ...walls(r.ref_price, r.iv_day, r.k90, r.hist_sigma, years),
    expiry: r.expiry,
    gammaCeiling: r.gamma_ceiling,
    gammaFloor: r.gamma_floor,
    beCeiling: r.be_ceiling,
    beFloor: r.be_floor,
    maxPain: r.max_pain,
    high: r.day_high,
    low: r.day_low,
    last: r.last_price,
  };
}

/**
 * This week's levels for its expiry: from the week's rows while they are current and hold them, else
 * read from the book now (the week's expiry and its IV, the gamma levels of everything within seven
 * days, the spot as the reference), with the week's range so far where the book keeps days.
 */
export function weekLevels(data: LevelsData, now: number): Levels | null {
  const row = data.days[0];
  const current = row && now - row.set_at.getTime() < CURRENT_MS ? row : null;
  const thisWeek = current
    ? data.days.filter((r) => weekKey(r.day, r.source) === weekKey(current.day, current.source))
    : [];
  const week = weekRow(thisWeek);
  if (week) return rowLevels(week, "week", weekYears(week));
  const e = data.gamma.exposure;
  if (e === null || !(e.spot > 0)) return null;
  const at = e.computed_at.getTime();
  const x = weekExpiry(data.gamma.expiries, at, weekEnd(at, e.source));
  if (x === null) return null;
  const years = (x.expiry.getTime() - at) / YEAR_MS;
  const stats = data.weekStats;
  const k90 = stats?.k90 ?? 1.6448536269514722;
  const { ceiling, floor } = strikeLevels(data.weekStrikes, e.spot);
  const highs = thisWeek.flatMap((r) => (r.day_high === null ? [] : [r.day_high]));
  const lows = thisWeek.flatMap((r) => (r.day_low === null ? [] : [r.day_low]));
  return {
    period: "week",
    basis: "next",
    day: null,
    source: e.source,
    ref: e.spot,
    iv: x.atm_iv,
    k90,
    method: stats?.method ?? "theory",
    sigma90: stats?.sigma ?? null,
    ...walls(e.spot, x.atm_iv, k90, stats?.sigma ?? null, years),
    expiry: x.expiry,
    gammaCeiling: ceiling,
    gammaFloor: floor,
    beCeiling: x.be_high,
    beFloor: x.be_low,
    maxPain: x.max_pain,
    high: highs.length ? Math.max(...highs) : null,
    low: lows.length ? Math.min(...lows) : null,
    last: current?.last_price ?? null,
  };
}

/** Whether a level lines up with a wall: within ALIGN_SHARE of the day's 1σ move. */
export function linedUp(level: number | null, wall: number | null, move1: number | null): boolean {
  return (
    level !== null &&
    wall !== null &&
    move1 !== null &&
    Math.abs(level - wall) <= ALIGN_SHARE * move1
  );
}

/** What a finished day did at a level above the price (side 1) or below it (side -1). */
export type Outcome = "clear" | "held" | "broke";

/** "clear": never reached; "held": reached and closed back on the near side; "broke": closed beyond. */
export function outcome(
  side: 1 | -1,
  level: number | null,
  high: number | null,
  low: number | null,
  close: number | null,
): Outcome | null {
  if (level === null || high === null || low === null || close === null) return null;
  const reached = side === 1 ? high >= level : low <= level;
  if (!reached) return "clear";
  const beyond = side === 1 ? close >= level : close <= level;
  return beyond ? "broke" : "held";
}

/** A finished day's levels and what price did at each, for the record tables. */
export interface DayRecord {
  day: string;
  row: GammaWallDay;
  w: ReturnType<typeof walls>;
}

/** The book's finished days, newest first: every row but a current one, with prices to judge. */
export function finishedDays(data: LevelsData, today: Levels | null): DayRecord[] {
  return data.days
    .filter((row) => row.day !== today?.day && row.day_high !== null && row.day_low !== null)
    .map((row) => ({
      day: row.day,
      row,
      w: walls(row.ref_price, row.iv_day, row.k90, row.hist_sigma),
    }));
}

/** The book's finished weeks, newest first, each as a day-shaped row (weekRow) with its walls. */
export function finishedWeeks(data: LevelsData, current: Levels | null): DayRecord[] {
  const keys: string[] = [];
  const byWeek = new Map<string, GammaWallDay[]>();
  for (const r of data.days) {
    const k = weekKey(r.day, r.source);
    if (!byWeek.has(k)) {
      byWeek.set(k, []);
      keys.push(k);
    }
    byWeek.get(k)?.push(r);
  }
  const now = current?.day ? weekKey(current.day, current.source) : null;
  return keys.flatMap((k) => {
    const week = k === now ? null : weekRow(byWeek.get(k) ?? []);
    if (week === null || week.day_high === null || week.day_low === null) return [];
    return [
      {
        day: k,
        row: week,
        w: walls(week.ref_price, week.iv_day, week.k90, week.hist_sigma, weekYears(week)),
      },
    ];
  });
}

/** How often each side's level was reached, and of those how often it held: counts over the days. */
export function tally(
  days: readonly DayRecord[],
  pick: (d: DayRecord) => [number | null, number | null],
): { days: number; reached: number; held: number } {
  let n = 0;
  let reached = 0;
  let held = 0;
  for (const d of days) {
    const [up, down] = pick(d);
    const r = d.row;
    for (const [side, level] of [
      [1, up],
      [-1, down],
    ] as const) {
      const o = outcome(side, level, r.day_high, r.day_low, r.last_price);
      if (o === null) continue;
      if (side === 1) n++;
      if (o !== "clear") reached++;
      if (o === "held") held++;
    }
  }
  return { days: n, reached, held };
}

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((100 * n) / of)}%` : "–");
const price = (v: number | null) => (v === null ? "–" : formatPrice(level(v)));
const from = (v: number, ref: number) => signedPct(v / ref - 1, 2);

interface Mark {
  price: number;
  name: string;
  cls: string;
  /** Marked as lined up with an IV wall. */
  aligned?: boolean;
}

/**
 * The price ladder: the levels as lines across a vertical price axis, the walls' ranges shaded, the
 * day's range as a bar and its last price. HTML, not SVG, so the lines stay crisp and the labels sit
 * where they can be read; labels closer than a line's height are spread apart, each still ruled at
 * its own price. Hidden from screen readers: the table under it says the same.
 */
function ladder(input: {
  ref: number;
  marks: readonly Mark[];
  bands: readonly { from: number; to: number; cls: string }[];
  high: number | null;
  low: number | null;
  last: number | null;
}): string {
  const prices = [
    ...input.marks.map((m) => m.price),
    input.ref,
    ...[input.high, input.low, input.last].filter((v): v is number => v !== null),
  ];
  const top = Math.max(...prices);
  const bottom = Math.min(...prices);
  const pad = Math.max((top - bottom) * 0.08, input.ref * 0.002);
  const hi = top + pad;
  const lo = bottom - pad;
  const y = (v: number) => ((hi - v) / (hi - lo)) * 100;
  const rows = [...input.marks, { price: input.ref, name: tr("reference"), cls: "lv-ref" }].sort(
    (a, b) => b.price - a.price,
  );
  const GAP = 4.6;
  const placed: number[] = [];
  for (const [i, m] of rows.entries()) {
    const want = y(m.price);
    placed[i] = i === 0 ? want : Math.max(want, (placed[i - 1] as number) + GAP);
  }
  // Pushed off the bottom: spread back up from it.
  for (let i = rows.length - 1; i >= 0; i--) {
    const limit = i === rows.length - 1 ? 97 : (placed[i + 1] as number) - GAP;
    if ((placed[i] as number) > limit) placed[i] = limit;
  }
  const lines = rows
    .map(
      (m, i) =>
        `<i class="lv-line ${m.cls}" style="top:${y(m.price).toFixed(2)}%"></i><span class="lv-tag ${m.cls
          .split(" ")
          .map((c) => `${c}-t`)
          .join(
            " ",
          )}${m.aligned ? " lv-on" : ""}" style="top:${(placed[i] as number).toFixed(2)}%"><b>${m.name}</b> ${price(m.price)} <small>${from(m.price, input.ref)}</small></span>`,
    )
    .join("");
  const bands = input.bands
    .filter((b) => b.to > b.from)
    .map(
      (b) =>
        `<i class="lv-band ${b.cls}" style="top:${y(b.to).toFixed(2)}%;height:${(y(b.from) - y(b.to)).toFixed(2)}%"></i>`,
    )
    .join("");
  const range =
    input.high !== null && input.low !== null
      ? `<i class="lv-range" style="top:${y(input.high).toFixed(2)}%;height:${Math.max(0.4, y(input.low) - y(input.high)).toFixed(2)}%"></i>`
      : "";
  const last =
    input.last !== null
      ? `<i class="lv-last" style="top:${y(input.last).toFixed(2)}%"></i><span class="lv-last-t" style="top:${y(input.last).toFixed(2)}%">${tr("last {price}", { price: price(input.last) })}</span>`
      : "";
  // Marked for the share button (share.ts), which paints an HTML plot from its boxes.
  return `<div class="lv-ladder" aria-hidden="true" data-share-plot>${bands}${lines}${range}${last}</div>`;
}

/** The table under a ladder: every level by name, price and distance from the reference. */
function levelTable(rows: readonly [string, number | null, string][], ref: number): string {
  const body = rows
    .filter(([, v]) => v !== null)
    .map(
      ([name, v, note]) =>
        `<tr><td>${name}</td><td class="num">${price(v)}</td><td class="num dim">${from(v as number, ref)}</td><td class="dim">${note}</td></tr>`,
    )
    .join("");
  return `<div class="sheet-wrap"><table class="sheet lv-table"><thead><tr><th>${tr("Level")}</th><th class="num">${tr("Price")}</th><th class="num">${tr("From the reference")}</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`;
}

/** One level across the timeline: a value per day, oldest first, null where the day holds none. */
interface Step {
  cls: string;
  values: readonly (number | null)[];
}

/** A range shaded across the timeline, a pair of values per day. */
interface Shade {
  cls: string;
  lo: readonly (number | null)[];
  hi: readonly (number | null)[];
}

/**
 * THE DAY TIMELINE (2026-10-21, the owner's ask): the levels day by day over each day's candle, so a
 * reader sees how often they move. The ladder above shows one day; every level on it is fixed by its
 * day's first read (or its week's), so here each one is a step: flat across its day, moving only at
 * the next. One slot per stored day, at most LEVEL_DAYS, the newest at the right.
 *
 * SVG on the whale chart's conventions (whales.ts): the candles in ink, rising hollow and falling
 * filled, so the coloured levels read first; the price axis takes in the candles and every level
 * drawn, since the levels are the subject. Each day's figures are in a native title over its slot.
 * `weeks` draws a dotted rule where a week's expiry falls between two days: where a week view's
 * levels step, and where a day view's nearest expiry rolls past a weekly one.
 */
function timeline(input: {
  title: string;
  keys: string;
  live: string;
  days: readonly GammaWallDay[];
  shades: readonly Shade[];
  steps: readonly Step[];
  weeks: boolean;
  tip: (r: GammaWallDay, i: number) => string;
}): string {
  const { days } = input;
  const n = days.length;
  const candle = (r: GammaWallDay) =>
    r.day_high === null || r.day_low === null || r.last_price === null
      ? null
      : {
          open: r.day_open ?? r.ref_price,
          high: r.day_high,
          low: r.day_low,
          close: r.last_price,
        };
  const prices = [
    ...days.flatMap((r) => {
      const c = candle(r);
      return c ? [c.high, c.low] : [];
    }),
    ...input.steps.flatMap((s) => s.values),
    ...input.shades.flatMap((s) => [...s.lo, ...s.hi]),
  ].filter((v): v is number => v !== null && v > 0);
  if (n === 0 || prices.length === 0) return "";
  const top = Math.max(...prices);
  const bottom = Math.min(...prices);
  const pad = Math.max((top - bottom) * 0.06, (days.at(-1) as GammaWallDay).ref_price * 0.002);
  const hi = top + pad;
  const lo = bottom - pad;
  const y = (v: number) => 1000 - ((v - lo) / (hi - lo)) * 1000;
  const slot = 1000 / n;
  const sx = (i: number) => (i * slot).toFixed(2);

  const shades = input.shades
    .flatMap((s) =>
      days.map((_, i) => {
        const a = s.lo[i] ?? null;
        const b = s.hi[i] ?? null;
        if (a === null || b === null || !(b > a)) return "";
        return `<rect class="${s.cls}" x="${sx(i)}" width="${slot.toFixed(2)}" y="${y(b).toFixed(2)}" height="${(y(a) - y(b)).toFixed(2)}"></rect>`;
      }),
    )
    .join("");
  // Each level as one path: flat across a day, a vertical join to the next day's value, lifted
  // where a day has none so a gap is not drawn as a level.
  const steps = input.steps
    .map((s) => {
      let d = "";
      let down = false;
      for (let i = 0; i < n; i++) {
        const v = s.values[i] ?? null;
        if (v === null) {
          down = false;
          continue;
        }
        d += `${down ? "V" : `M${sx(i)} `}${y(v).toFixed(2)}H${sx(i + 1)}`;
        down = true;
      }
      return d ? `<path class="lv-tl ${s.cls}" d="${d}"></path>` : "";
    })
    .join("");
  const weeks = input.weeks
    ? days
        .map((r, i) => {
          const prev = days[i - 1];
          if (!prev || weekKey(prev.day, prev.source) === weekKey(r.day, r.source)) return "";
          return `<line class="lv-tl-wk" x1="${sx(i)}" x2="${sx(i)}" y1="0" y2="1000"></line>`;
        })
        .join("")
    : "";
  const candles = days
    .map((r, i) => {
      const c = candle(r);
      if (c === null) return "";
      const cx = ((i + 0.5) * slot).toFixed(2);
      const up = c.close >= c.open;
      const bodyTop = y(Math.max(c.open, c.close));
      const height = Math.max(Math.abs(y(c.open) - y(c.close)), 1.5);
      return `<line class="wh-wick" x1="${cx}" x2="${cx}" y1="${y(c.high).toFixed(2)}" y2="${y(c.low).toFixed(2)}"></line><rect class="${up ? "wh-up" : "wh-down"}" x="${((i + 0.5) * slot - Math.min(slot * 0.3, 14)).toFixed(2)}" y="${bodyTop.toFixed(2)}" width="${Math.min(slot * 0.6, 28).toFixed(2)}" height="${height.toFixed(2)}"></rect>`;
    })
    .join("");
  // Over everything, one slot per day carrying that day's figures.
  const hits = days
    .map(
      (r, i) =>
        `<rect class="lv-tl-hit" x="${sx(i)}" y="0" width="${slot.toFixed(2)}" height="1000"><title>${esc(input.tip(r, i))}</title></rect>`,
    )
    .join("");

  const gridLines = [0.1, 0.37, 0.63, 0.9];
  const grid = gridLines
    .map((f) => `<line class="cvd-grid" x1="0" x2="1000" y1="${f * 1000}" y2="${f * 1000}"></line>`)
    .join("");
  const leftLabels = gridLines
    .map(
      (f) =>
        `<span class="cvd-yl" style="top:${(f * 100).toFixed(2)}%">${formatPrice(Number((hi - f * (hi - lo)).toPrecision(5)))}</span>`,
    )
    .join("");
  // The newest day's value of each level at the right edge, in its colour; one that would sit on
  // a label already placed is left to the key and the tooltip.
  const placed: number[] = [];
  const rightLabels = input.steps
    .map((s) => {
      const v = s.values[n - 1] ?? null;
      if (v === null) return "";
      const at = y(v) / 10;
      if (placed.some((p) => Math.abs(p - at) < 4.5)) return "";
      placed.push(at);
      return `<span class="cvd-yr ${s.cls.split(" ")[0]}-t" style="top:${at.toFixed(2)}%"><b>${price(v)}</b></span>`;
    })
    .join("");
  // Day labels counted back from the newest, so the newest is always named and the gaps are even.
  const every = Math.max(1, Math.ceil(n / 8));
  const xLabels = days
    .map((r, i) => {
      const back = n - 1 - i;
      if (back % every !== 0) return "";
      return `<span class="cvd-x${(back / every) % 2 ? " x-alt" : ""}" style="left:${(((i + 0.5) / n) * 100).toFixed(2)}%">${recordDay(r.day)}</span>`;
    })
    .join("");
  const plain = input.title.replace(/<[^>]+>/g, "");
  return `<figure class="fchart cvd-chart lv-chart lv-tl-chart" data-live="${input.live}">
<div class="fchart-head"><p class="fchart-title">${input.title}</p>${input.keys}</div>
<div class="fchart-plot lv-tl-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(plain)}">${shades}${grid}${weeks}${steps}${candles}${hits}</svg>${leftLabels}${rightLabels}${xLabels}</div>
</figure>`;
}

/** A day's candle in words, for its slot's title; "no trade yet today" for a day not yet traded. */
function candleWords(r: GammaWallDay): string {
  if (r.day_high === null || r.day_low === null || r.last_price === null) {
    return tr("no trade yet today");
  }
  return tr("open {open} · high {high} · low {low} · close {close}", {
    open: price(r.day_open ?? r.ref_price),
    high: price(r.day_high),
    low: price(r.day_low),
    close: price(r.last_price),
  });
}

const timelineKeys = (keys: string) =>
  `<div class="fchart-keys"><span><i class="lv-key-candle"></i>${tr("daily candle")}</span>${keys}</div>`;

/** "Oct 20, from 08:00 UTC" for a Deribit day, "Oct 20 session" for a US one, or the next session. */
function dayName(l: Levels): string {
  if (l.day === null) return tr("the next session");
  const date = dayLabel(new Date(`${l.day}T00:00:00Z`));
  return l.source === "deribit"
    ? tr("{date}, from 08:00 UTC", { date })
    : tr("{date} session", { date });
}

/** "week from Oct 20" for a week fixed by a row, or "the spot now" for one read from the book. */
function weekName(l: Levels): string {
  if (l.day === null) return tr("the spot now");
  return tr("week from {date}", { date: dayLabel(new Date(`${l.day}T00:00:00Z`)) });
}

/** The tab's controls: the book picker (opening this tab) and the help. */
function controls(view: PanelView, tab: BookTab, helpId: string, help: string, extra = ""): string {
  const books = view.data?.gamma.books ?? [];
  const picker = books.length
    ? bookPicker({ books, heatmap: view.heatmap, params: view.params, now: view.now, tab })
    : `<nav class="tf" aria-label="${esc(tr("Option book"))}"><a href="#${tab}" aria-current="true">${esc(view.params.currency)}</a></nav>`;
  return `<div class="lq-controls gx-controls" data-loading="${esc(tr("Loading {asset}…"))}">${picker}${extra}${helpButton(helpId)}</div>
${helpPanel(helpId, help)}`;
}

interface PanelView {
  data: LevelsData | null;
  params: GammaParams;
  heatmap: HeatmapParams;
  now: number;
}

/** What stands in for the tab when it has nothing to draw, or null when it has. */
function unavailable(view: PanelView): string | null {
  const { data, now } = view;
  if (data === null)
    return `<p class="empty">${tr("The options data could not be read right now.")}</p>`;
  const e = data.gamma.exposure;
  if (e === null) {
    return `<p class="empty">${tr("No gamma exposure has been computed for {currency} yet.", { currency: esc(data.gamma.currency) })}</p>`;
  }
  if (freshness(e.source, e.computed_at, now) === "dead") {
    return `<p class="empty">${tr(
      "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.",
      {
        source: esc(publisher(e.source).name),
        currency: esc(data.gamma.currency),
        ago: agoText(e.computed_at, now),
      },
    )}</p>`;
  }
  return null;
}

/** Where the day stands against two walls: still inside, reached one and back, or beyond. */
function dayStatus(l: Levels, upper: number | null, lower: number | null): string {
  if (l.high === null || l.low === null || l.last === null || upper === null || lower === null) {
    return tr("no trade yet today");
  }
  if (l.last > upper) return tr("above it now");
  if (l.last < lower) return tr("below it now");
  if (l.high >= upper || l.low <= lower) return tr("reached it today and back inside");
  return tr("inside all day so far");
}

/** The measured history in words, from gamma_wall_stats. */
function historyText(stats: GammaWallStats | null): string {
  if (stats === null) {
    return tr(
      "No history is kept for this book's walls yet, so its 90% wall is the normal distribution's 1.645 standard deviations of the options' own IV, not a measured one. Its record starts with its first day below.",
    );
  }
  const since = dayLabel(new Date(`${stats.first_day}T00:00:00Z`));
  const year = stats.first_day.slice(0, 4);
  if (stats.method === "vix1d") {
    return tr(
      "Measured on {days} sessions since {since} {year}, against Cboe's 1-day VIX: the S&amp;P 500 closed inside one standard deviation on {inside1}, and within {k90} of them on 90%, so that is where the 90% wall sits. Cboe's free history has the index's closes only, so touches of a wall during the day are not counted here; this book's own record below counts them.",
      {
        days: stats.days.toLocaleString("en-US"),
        since,
        year,
        inside1: pct(stats.inside1_close, stats.days),
        k90: stats.k90.toFixed(2),
      },
    );
  }
  return tr(
    "Measured on {days} Deribit days since {since} {year}, against the 30-day volatility index (DVOL) as each day began: the whole day stayed within {k90} standard deviations on 90% of days, so that is where the 90% wall sits. Within one, the whole day stayed on {inside1} and the close on {close1}. A touch of the 1σ wall closed back inside {rev1} of {touch1} times; a touch of the 90% wall, {rev90} of {touch90} times.",
    {
      days: stats.days.toLocaleString("en-US"),
      since,
      year,
      k90: stats.k90.toFixed(2),
      inside1: pct(stats.inside1_range ?? 0, stats.days),
      close1: pct(stats.inside1_close, stats.days),
      rev1: pct(stats.rev1 ?? 0, stats.touch1 ?? 0),
      touch1: (stats.touch1 ?? 0).toLocaleString("en-US"),
      rev90: pct(stats.rev90 ?? 0, stats.touch90 ?? 0),
      touch90: (stats.touch90 ?? 0).toLocaleString("en-US"),
    },
  );
}

const OUTCOME_WORDS = (): Record<Outcome, string> => ({
  clear: tr("not reached"),
  held: tr("reached, closed back inside"),
  broke: tr("closed beyond"),
});

/** One finished day's verdict at a pair of levels: the side reached, or "not reached". */
function verdict(r: GammaWallDay, up: number | null, down: number | null): string {
  const words = OUTCOME_WORDS();
  const above = outcome(1, up, r.day_high, r.day_low, r.last_price);
  const below = outcome(-1, down, r.day_high, r.day_low, r.last_price);
  if (above === null || below === null) return `<span class="dim">–</span>`;
  const parts: string[] = [];
  if (above !== "clear") {
    parts.push(
      `<span class="${above === "held" ? "lv-held" : "lv-broke"}">${tr("above: {what}", { what: words[above] })}</span>`,
    );
  }
  if (below !== "clear") {
    parts.push(
      `<span class="${below === "held" ? "lv-held" : "lv-broke"}">${tr("below: {what}", { what: words[below] })}</span>`,
    );
  }
  return parts.length ? parts.join("<br>") : `<span class="dim">${words.clear}</span>`;
}

const recordDay = (day: string) => dayLabel(new Date(`${day}T00:00:00Z`));

/** The IV Walls tab's body, from its controls down. */
export function ivWallsPanel(view: PanelView): string {
  const head = controls(
    view,
    "ivwalls",
    "rates-ivwalls",
    `<p>${tr(
      "The IV wall is the move the options price for the day: the reference close plus and minus one standard deviation, the close times the options' implied volatility a day ahead times the square root of 1/365. The levels are fixed when the day begins (Deribit's day at 08:00 UTC, a US session at its first read) so they do not drift through the day.",
    )}</p><p>${tr(
      "The 90% wall is where history says price stayed: the multiple of a day's standard deviation that held on 90% of past days. BTC and ETH are measured on every Deribit day since 2021 against DVOL, their whole day's range; the S&amp;P 500 on every session since 2022 against Cboe's 1-day VIX, closes only. A book with no history uses the normal distribution's 1.645.",
    )}</p><p>${tr(
      "A wall is a probability, not a promise: a touch of the IV wall has closed back inside a little over half the time, not nine times in ten. The record under the ladder shows each day's outcome for this book.",
    )}</p>`,
  );
  const missing = unavailable(view);
  if (missing !== null) return `${head}${missing}`;
  const data = view.data as LevelsData;
  const e = data.gamma.exposure as GammaExposure;
  const l = todayLevels(data, view.now);
  if (l === null || l.move1 === null) {
    return `${head}<p class="empty">${tr("{currency}'s options carry no implied volatility to draw walls from yet.", { currency: esc(data.gamma.currency) })}</p>`;
  }
  const book = esc(data.gamma.currency);
  const ninety =
    l.method === "theory"
      ? tr("1.645 standard deviations of the options' IV (normal distribution)")
      : tr("{k90} standard deviations of {method} {sigma}, measured", {
          k90: l.k90.toFixed(2),
          method: l.method === "dvol" ? "DVOL" : "VIX1D",
          sigma: `${((l.sigma90 ?? 0) * 100).toFixed(1)}%`,
        });
  const tiles = `<div class="cvd-tiles" data-live="ivwalls-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("IV wall")}</p><p class="cvd-big lv-span lv-ink-iv">${price(l.lower1)} – ${price(l.upper1)}</p><p class="dim">${tr("±{move} (±{pct}) from IV {iv} a day ahead", { move: price(l.move1), pct: `${((l.move1 / l.ref) * 100).toFixed(2)}%`, iv: `${((l.iv ?? 0) * 100).toFixed(1)}%` })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("90% wall")}</p><p class="cvd-big lv-span lv-ink-90">${price(l.lower90)} – ${price(l.upper90)}</p><p class="dim">${ninety}</p></div>
<div class="cvd-tile"><p class="eyebrow">${l.basis === "day" ? tr("The day so far") : tr("Reference")}</p><p class="cvd-big">${l.basis === "day" && l.last !== null ? price(l.last) : price(l.ref)}</p><p class="dim">${
    l.basis === "day"
      ? `${tr("high {high} · low {low}", { high: price(l.high), low: price(l.low) })} · ${tr("IV wall: {status}", { status: dayStatus(l, l.upper1, l.lower1) })}`
      : tr("the latest close, for the next session")
  }</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Reference close")}</p><p class="cvd-big">${price(l.ref)}</p><p class="dim">${dayName(l)}</p></div>
</div>`;
  const figure = `<figure class="fchart lv-chart" data-gx-chart data-live="ivwalls-ladder">
<div class="fchart-head"><p class="fchart-title">${tr("{currency} · {source} options · IV walls · {day}", { currency: book, source: esc(publisher(l.source).name), day: dayName(l) })}</p><div class="fchart-keys"><span><i class="lv-key-iv"></i>${tr("IV wall, 1σ")}</span><span><i class="lv-key-90"></i>${tr("90% wall")}</span><span><i class="lv-key-ref"></i>${tr("Reference close")}</span>${l.high !== null ? `<span><i class="lv-key-range"></i>${tr("The day's range")}</span>` : ""}</div></div>
${ladder({
  ref: l.ref,
  marks: [
    { price: l.upper90 as number, name: tr("90% wall"), cls: "lv-90" },
    { price: l.upper1 as number, name: tr("IV wall"), cls: "lv-iv" },
    { price: l.lower1 as number, name: tr("IV wall"), cls: "lv-iv" },
    { price: l.lower90 as number, name: tr("90% wall"), cls: "lv-90" },
  ],
  bands: [
    { from: l.lower90 as number, to: l.upper90 as number, cls: "lv-band-90" },
    { from: l.lower1 as number, to: l.upper1 as number, cls: "lv-band-iv" },
  ],
  high: l.high,
  low: l.low,
  last: l.last,
})}
</figure>
${levelTable(
  [
    [tr("90% wall, above"), l.upper90, ninety],
    [tr("IV wall, above"), l.upper1, tr("1σ of the options' IV")],
    [tr("Reference close"), l.ref, dayName(l)],
    [tr("IV wall, below"), l.lower1, tr("1σ of the options' IV")],
    [tr("90% wall, below"), l.lower90, ninety],
  ],
  l.ref,
)}`;
  const series = [...data.days].reverse();
  const dayWalls = series.map((r) => walls(r.ref_price, r.iv_day, r.k90, r.hist_sigma));
  const drawn = timeline({
    title: tr("{currency} · {source} options · IV walls day by day", {
      currency: book,
      source: esc(publisher(l.source).name),
    }),
    keys: timelineKeys(
      `<span><i class="lv-key-iv"></i>${tr("IV wall, 1σ")}</span><span><i class="lv-key-90"></i>${tr("90% wall")}</span>`,
    ),
    live: "ivwalls-timeline",
    days: series,
    shades: [
      {
        cls: "lv-tl-b-90",
        lo: dayWalls.map((w) => w.lower90),
        hi: dayWalls.map((w) => w.upper90),
      },
      { cls: "lv-tl-b-iv", lo: dayWalls.map((w) => w.lower1), hi: dayWalls.map((w) => w.upper1) },
    ],
    steps: [
      { cls: "lv-iv", values: dayWalls.map((w) => w.upper1) },
      { cls: "lv-iv", values: dayWalls.map((w) => w.lower1) },
      { cls: "lv-90", values: dayWalls.map((w) => w.upper90) },
      { cls: "lv-90", values: dayWalls.map((w) => w.lower90) },
    ],
    weeks: false,
    tip: (r, i) => {
      const w = dayWalls[i] as ReturnType<typeof walls>;
      return `${recordDay(r.day)} · ${candleWords(r)} · ${tr("IV wall")} ${price(w.lower1)} – ${price(w.upper1)} · ${tr("90% wall")} ${price(w.lower90)} – ${price(w.upper90)}`;
    },
  });
  const chart = drawn
    ? `${drawn}
<p class="notes">${tr("Each day's candle under the walls it opened with. The walls are fixed by the day's first read, so they move only from one day to the next.")}</p>`
    : "";
  const days = finishedDays(data, l);
  const iv = tally(days, (d) => [d.w.upper1, d.w.lower1]);
  const n90 = tally(days, (d) => [d.w.upper90, d.w.lower90]);
  const record =
    l.basis === "next"
      ? `<p class="notes">${tr("{currency} comes from an end-of-day file, so its walls are for the next session and are not kept day by day.", { currency: book })}</p>`
      : days.length === 0
        ? `<p class="notes">${tr("{currency}'s own record starts with today; each finished day is added here.", { currency: book })}</p>`
        : `<p class="notes">${tr(
            "{currency}'s own record, {days} finished days since {since}. IV wall: touched {reached}, closed back inside {held}. 90% wall: touched {reached90}, closed back inside {held90}.",
            {
              currency: book,
              days: iv.days,
              since: recordDay(days.at(-1)?.day as string),
              reached: iv.reached,
              held: iv.held,
              reached90: n90.reached,
              held90: n90.held,
            },
          )}</p>
<div class="sheet-wrap"><table class="sheet lv-table"><thead><tr><th>${tr("Day")}</th><th class="num">${tr("Reference")}</th><th class="num">${tr("IV wall")}</th><th class="num">${tr("High / low")}</th><th class="num">${tr("Close")}</th><th>${tr("At the IV wall")}</th><th>${tr("At the 90% wall")}</th></tr></thead><tbody data-live="ivwalls-record">${days
            .slice(0, 30)
            .map(
              (d) =>
                `<tr><td>${recordDay(d.day)}</td><td class="num">${price(d.row.ref_price)}</td><td class="num">${price(d.w.lower1)} – ${price(d.w.upper1)}</td><td class="num">${price(d.row.day_high)} / ${price(d.row.day_low)}</td><td class="num">${price(d.row.last_price)}</td><td>${verdict(d.row, d.w.upper1, d.w.lower1)}</td><td>${verdict(d.row, d.w.upper90, d.w.lower90)}</td></tr>`,
            )
            .join("")}</tbody></table></div>`;
  return `${head}
${tiles}
${figure}
${chart}
<h2 class="cvd-h2 wm-h2">${tr("How price has behaved at the walls")}</h2>
<p class="notes">${historyText(data.stats)}</p>
${record}
<p class="notes dim">${tr("Prices in {unit}. {source} options, read {ago}.", { unit: esc(e.unit), source: esc(publisher(e.source).name), ago: agoText(e.computed_at, view.now) })}</p>`;
}

/** The Ceiling & Floor tab's body, from its controls down. */
/** The Day / Week switch: each a link that reloads the tab in place with the other basis. */
function basisSwitch(view: PanelView, basis: LevelBasis): string {
  const link = (b: LevelBasis, label: string) => {
    const { basis: _, ...rest } = view.params;
    const next: GammaParams = b === "week" ? { ...rest, basis: "week" } : rest;
    return `<a href="${esc(choiceHref(view.heatmap, next, "levels"))}" data-gx-swap${b === basis ? ' aria-current="true"' : ""}>${label}</a>`;
  };
  return `<nav class="tf" aria-label="${esc(tr("Levels for"))}">${link("day", tr("Day"))}${link("week", tr("Week"))}</nav>`;
}

export function levelsPanel(view: PanelView): string {
  const basis: LevelBasis = view.params.basis ?? "day";
  const week = basis === "week";
  const head = controls(
    view,
    "levels",
    "rates-levels",
    `<p>${tr(
      "Two readings of where the market makers stand, side by side, for the nearest expiry. The gamma ceiling is the strike above the spot holding the most call gamma, and the gamma floor the strike below it holding the most put gamma: where hedging flows are largest.",
    )}</p><p>${tr(
      "The dealer range reads every option as sold by dealers who keep the premium, as max pain does: at expiry they pay out what the options are worth, so they earn most at the max pain strike and start losing beyond the break-evens either side, the dealer ceiling and floor. No exchange publishes who sold what, so this rests on that assumption, and the Gamma Exposure tab's sign assumes the opposite for calls.",
    )}</p><p>${tr(
      "A ceiling or floor within a quarter of the day's move of an IV wall is marked as lined up with it. Whether price turns there more often than elsewhere is what the record under the ladder is for: it starts with this tab and grows a day at a time.",
    )}</p><p>${tr(
      "The Day and Week switch reads the same levels for the nearest expiry or for the week's: Deribit's Friday 08:00 UTC weekly, or a US book's last expiry of the week. The week's levels are fixed by its first read, its IV walls span the time to that expiry, and its 90% wall is measured on whole past weeks where there is history.",
    )}</p>`,
    basisSwitch(view, basis),
  );
  const missing = unavailable(view);
  if (missing !== null) return `${head}${missing}`;
  const data = view.data as LevelsData;
  const e = data.gamma.exposure as GammaExposure;
  const l = week ? weekLevels(data, view.now) : todayLevels(data, view.now);
  if (l === null)
    return `${head}<p class="empty">${tr("The options data could not be read right now.")}</p>`;
  const book = esc(data.gamma.currency);
  const align = {
    gammaCeiling:
      linedUp(l.gammaCeiling, l.upper1, l.move1) || linedUp(l.gammaCeiling, l.upper90, l.move1),
    gammaFloor:
      linedUp(l.gammaFloor, l.lower1, l.move1) || linedUp(l.gammaFloor, l.lower90, l.move1),
    beCeiling: linedUp(l.beCeiling, l.upper1, l.move1) || linedUp(l.beCeiling, l.upper90, l.move1),
    beFloor: linedUp(l.beFloor, l.lower1, l.move1) || linedUp(l.beFloor, l.lower90, l.move1),
  };
  const alignedNames = [
    align.gammaCeiling ? tr("gamma ceiling") : "",
    align.beCeiling ? tr("dealer ceiling") : "",
    align.gammaFloor ? tr("gamma floor") : "",
    align.beFloor ? tr("dealer floor") : "",
  ].filter(Boolean);
  const expiry = l.expiry ? `${dayLabel(l.expiry)} (${leftText(l.expiry, view.now)})` : "–";
  const tiles = `<div class="cvd-tiles" data-live="levels-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Gamma ceiling / floor")}</p><p class="cvd-big lv-span"><span class="lq-ink-l">${price(l.gammaCeiling)}</span> / <span class="lq-ink-s">${price(l.gammaFloor)}</span></p><p class="dim">${week ? tr("the strikes holding the most call gamma above the spot and put gamma below it, in everything expiring by {expiry}", { expiry }) : tr("the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}", { expiry })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Dealer ceiling / floor")}</p><p class="cvd-big lv-span lv-ink-be">${price(l.beCeiling)} / ${price(l.beFloor)}</p><p class="dim">${tr("where dealers who sold every option of that expiry break even; max pain {pain}", { pain: price(l.maxPain) })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Lined up with an IV wall")}</p><p class="cvd-big lv-span${alignedNames.length ? " lv-ink-on" : " dim"}">${alignedNames.length ? alignedNames.join(", ") : tr("none")}</p><p class="dim">${week ? tr("within a quarter of the week's 1σ move ({band}) of an IV wall or a 90% wall", { band: price(l.move1 === null ? null : l.move1 * ALIGN_SHARE) }) : tr("within a quarter of the day's 1σ move ({band}) of an IV wall or a 90% wall", { band: price(l.move1 === null ? null : l.move1 * ALIGN_SHARE) })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${week ? tr("The week so far") : l.basis === "day" ? tr("The day so far") : tr("Reference")}</p><p class="cvd-big">${price(l.last ?? l.ref)}</p><p class="dim">${
    l.high !== null && l.low !== null
      ? tr("high {high} · low {low}", { high: price(l.high), low: price(l.low) })
      : week
        ? tr("the spot now; this week's levels are fixed by its first read")
        : tr("the latest close, for the next session")
  }</p></div>
</div>`;
  const marks: Mark[] = [];
  const add = (v: number | null, name: string, cls: string, aligned = false) => {
    if (v !== null && v > 0) marks.push({ price: v, name, cls, aligned });
  };
  add(l.gammaCeiling, tr("gamma ceiling"), "lv-gc", align.gammaCeiling);
  add(l.beCeiling, tr("dealer ceiling"), "lv-be", align.beCeiling);
  add(l.maxPain, tr("max pain"), "lv-mp");
  add(l.beFloor, tr("dealer floor"), "lv-be", align.beFloor);
  add(l.gammaFloor, tr("gamma floor"), "lv-gf", align.gammaFloor);
  add(l.upper1, tr("IV wall"), "lv-iv lv-faint");
  add(l.lower1, tr("IV wall"), "lv-iv lv-faint");
  add(l.upper90, tr("90% wall"), "lv-90 lv-faint");
  add(l.lower90, tr("90% wall"), "lv-90 lv-faint");
  const figure = `<figure class="fchart lv-chart" data-gx-chart data-live="levels-ladder">
<div class="fchart-head"><p class="fchart-title">${tr("{currency} · {source} options · ceiling and floor · expiring {expiry}", { currency: book, source: esc(publisher(l.source).name), expiry })}</p><div class="fchart-keys"><span><i class="lv-key-gc"></i>${tr("gamma ceiling")}</span><span><i class="lv-key-gf"></i>${tr("gamma floor")}</span><span><i class="lv-key-be"></i>${tr("dealer ceiling and floor")}</span><span><i class="lv-key-mp"></i>${tr("max pain")}</span><span><i class="lv-key-iv"></i>${tr("IV wall, 1σ")}</span><span><i class="lv-key-90"></i>${tr("90% wall")}</span><span><i class="lv-key-on"></i>${tr("lined up with a wall")}</span></div></div>
${ladder({
  ref: l.ref,
  marks,
  bands:
    l.lower1 !== null && l.upper1 !== null
      ? [{ from: l.lower1, to: l.upper1, cls: "lv-band-iv lv-band-faint" }]
      : [],
  high: l.high,
  low: l.low,
  last: l.last,
})}
</figure>
${levelTable(
  [
    [tr("gamma ceiling"), l.gammaCeiling, align.gammaCeiling ? tr("lined up with a wall") : ""],
    [tr("dealer ceiling"), l.beCeiling, align.beCeiling ? tr("lined up with a wall") : ""],
    [tr("max pain"), l.maxPain, ""],
    [tr("Reference close"), l.ref, week ? weekName(l) : dayName(l)],
    [tr("dealer floor"), l.beFloor, align.beFloor ? tr("lined up with a wall") : ""],
    [tr("gamma floor"), l.gammaFloor, align.gammaFloor ? tr("lined up with a wall") : ""],
  ],
  l.ref,
)}`;
  const sym = unitSymbol(e.unit);
  const expiries = data.gamma.expiries
    .filter((x) => x.expiry.getTime() > e.computed_at.getTime() && x.be_high !== null)
    .slice(0, 8)
    .map(
      (x) =>
        `<tr><td>${dayLabel(x.expiry)} <span class="dim">${x.expiry.getUTCFullYear()}</span></td><td class="num dim">${leftText(x.expiry, view.now)}</td><td class="num">${x.premium === null ? "–" : formatUsd(x.premium, sym)}</td><td class="num lv-ink-be">${price(x.be_low)}</td><td class="num">${price(x.max_pain)}</td><td class="num lv-ink-be">${price(x.be_high)}</td><td class="num dim">${x.be_low !== null && x.be_high !== null ? `${from(x.be_low, e.spot)} / ${from(x.be_high, e.spot)}` : "–"}</td></tr>`,
    )
    .join("");
  const table = expiries
    ? `<h2 class="cvd-h2 wm-h2">${tr("Dealer range by expiry")}</h2>
<div class="sheet-wrap"><table class="sheet lv-table"><thead><tr><th>${tr("Expiry")}</th><th class="num">${tr("Left")}</th><th class="num">${tr("Premium")}</th><th class="num">${tr("Dealer floor")}</th><th class="num">${tr("Max pain")}</th><th class="num">${tr("Dealer ceiling")}</th><th class="num">${tr("From the spot")}</th></tr></thead><tbody data-live="levels-expiries">${expiries}</tbody></table></div>`
    : "";
  // Each day under the levels it was read against: its own, or in the week view its week's, fixed by
  // the week's first row, so those step only where a week's expiry falls.
  const series = [...data.days].reverse();
  const weekOf = new Map<string, GammaWallDay | null>();
  if (week) {
    for (const r of series) {
      const k = weekKey(r.day, r.source);
      if (!weekOf.has(k)) {
        weekOf.set(k, weekRow(data.days.filter((x) => weekKey(x.day, x.source) === k)));
      }
    }
  }
  const read = series.map((r) => (week ? (weekOf.get(weekKey(r.day, r.source)) ?? null) : r));
  const readWalls = read.map((x) =>
    x === null
      ? null
      : walls(x.ref_price, x.iv_day, x.k90, x.hist_sigma, week ? weekYears(x) : DAY_YEARS),
  );
  const levelOf = (f: (x: GammaWallDay) => number | null) =>
    read.map((x) => (x === null ? null : f(x)));
  const drawn = timeline({
    title: tr("{currency} · {source} options · ceiling and floor day by day", {
      currency: book,
      source: esc(publisher(l.source).name),
    }),
    keys: timelineKeys(
      `<span><i class="lv-key-gc"></i>${tr("gamma ceiling")}</span><span><i class="lv-key-gf"></i>${tr("gamma floor")}</span><span><i class="lv-key-be"></i>${tr("dealer ceiling and floor")}</span><span><i class="lv-key-mp"></i>${tr("max pain")}</span><span><i class="lv-key-iv"></i>${tr("IV wall, 1σ")}</span><span><i class="lv-key-wk"></i>${tr("week's expiry")}</span>`,
    ),
    live: "levels-timeline",
    days: series,
    shades: [
      {
        cls: "lv-tl-b-iv lv-tl-faint",
        lo: readWalls.map((w) => w?.lower1 ?? null),
        hi: readWalls.map((w) => w?.upper1 ?? null),
      },
    ],
    steps: [
      { cls: "lv-gc", values: levelOf((x) => x.gamma_ceiling) },
      { cls: "lv-gf", values: levelOf((x) => x.gamma_floor) },
      { cls: "lv-be", values: levelOf((x) => x.be_ceiling) },
      { cls: "lv-be", values: levelOf((x) => x.be_floor) },
      { cls: "lv-mp", values: levelOf((x) => x.max_pain) },
    ],
    weeks: true,
    tip: (r, i) => {
      const x = read[i] ?? null;
      const head = `${recordDay(r.day)} · ${candleWords(r)}`;
      if (x === null) return head;
      return `${head} · ${tr("gamma ceiling")} ${price(x.gamma_ceiling)} · ${tr("gamma floor")} ${price(x.gamma_floor)} · ${tr("dealer ceiling")} ${price(x.be_ceiling)} · ${tr("dealer floor")} ${price(x.be_floor)} · ${tr("max pain")} ${price(x.max_pain)}`;
    },
  });
  const chart = drawn
    ? `${drawn}
<p class="notes">${
        week
          ? tr(
              "Each day's candle under its week's levels. They are fixed by the week's first read, so they move only at a week's expiry, the dotted rule.",
            )
          : tr(
              "Each day's candle under the levels it opened with. They are fixed by the day's first read, so they move only from one day to the next; the dotted rule marks each week's expiry.",
            )
      }</p>`
    : "";
  const days = week ? finishedWeeks(data, l) : finishedDays(data, l);
  const rows: [string, (d: DayRecord) => [number | null, number | null]][] = [
    [tr("Gamma ceiling / floor"), (d) => [d.row.gamma_ceiling, d.row.gamma_floor]],
    [tr("Dealer ceiling / floor"), (d) => [d.row.be_ceiling, d.row.be_floor]],
    [tr("IV wall"), (d) => [d.w.upper1, d.w.lower1]],
  ];
  const alignedOnly = (d: DayRecord): [number | null, number | null] => {
    const r = d.row;
    const up = [r.gamma_ceiling, r.be_ceiling].find(
      (v) => linedUp(v, d.w.upper1, d.w.move1) || linedUp(v, d.w.upper90, d.w.move1),
    );
    const down = [r.gamma_floor, r.be_floor].find(
      (v) => linedUp(v, d.w.lower1, d.w.move1) || linedUp(v, d.w.lower90, d.w.move1),
    );
    return [up ?? null, down ?? null];
  };
  rows.push([tr("Lined up with a wall"), alignedOnly]);
  const record =
    data.days.length === 0
      ? `<p class="notes">${tr("{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.", { currency: book })}</p>`
      : days.length === 0
        ? `<p class="notes">${week ? tr("{currency}'s weekly record starts with this week; each finished week is added here.", { currency: book }) : tr("{currency}'s own record starts with today; each finished day is added here.", { currency: book })}</p>`
        : `<div class="sheet-wrap"><table class="sheet lv-table"><thead><tr><th>${tr("Level")}</th><th class="num">${week ? tr("Weeks") : tr("Days")}</th><th class="num">${tr("Reached")}</th><th class="num">${tr("Closed back inside")}</th></tr></thead><tbody data-live="levels-record">${rows
            .map(([name, pick]) => {
              const t = tally(days, pick);
              return `<tr><td>${name}</td><td class="num">${t.days}</td><td class="num">${t.reached}</td><td class="num">${t.held} <span class="dim">${pct(t.held, t.reached)}</span></td></tr>`;
            })
            .join("")}</tbody></table></div>
<p class="notes">${
            week
              ? tr(
                  "Over {weeks} finished weeks since {since}, both sides counted; a level is reached when the week's high (or low) touches it, and held when the week closes back inside it.",
                  { weeks: days.length, since: recordDay(days.at(-1)?.day as string) },
                )
              : tr(
                  "Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.",
                  { days: days.length, since: recordDay(days.at(-1)?.day as string) },
                )
          }</p>`;
  return `${head}
${tiles}
${figure}
${chart}
${table}
<h2 class="cvd-h2 wm-h2">${tr("How price has behaved at these levels")}</h2>
${record}
<p class="notes dim">${tr("Prices in {unit}. {source} options, read {ago}.", { unit: esc(e.unit), source: esc(publisher(e.source).name), ago: agoText(e.computed_at, view.now) })}</p>`;
}

/** The tab's own address and placeholder, as the Gamma Exposure tab's. */
export function levelsPanelHref(
  heatmap: HeatmapParams,
  params: GammaParams,
  tab: "ivwalls" | "levels",
): string {
  return `/rates${heatmapToQuery(heatmap, params)}&panel=${tab}`;
}

export function levelsPlaceholder(
  heatmap: HeatmapParams,
  params: GammaParams,
  tab: "ivwalls" | "levels",
): string {
  return lazyPlaceholder(`/rates${heatmapToQuery(heatmap, params)}#${tab}`);
}

/** The tab on its own, for `/rates?panel=ivwalls|levels`. */
export function levelsFragment(tab: "ivwalls" | "levels", view: PanelView): string {
  const body = tab === "ivwalls" ? ivWallsPanel(view) : levelsPanel(view);
  return `<div class="lazy-body" data-rendered="${view.now}">${body}</div>`;
}
