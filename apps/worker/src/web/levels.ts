import type { GammaExposure, GammaWallDay, GammaWallStats, LevelsData } from "../app/data";
import { type GammaParams, type HeatmapParams, heatmapToQuery } from "../app/params";
import { lazyPlaceholder } from "./chart-skeleton";
import { horizonIv, termStructure, YEAR_MS } from "./expected-move";
import { esc, formatPrice, formatUsd } from "./format";
import {
  agoText,
  type BookTab,
  bookPicker,
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
  /** "day": fixed by the day's first read; "next": an end-of-day book's next session, from its file. */
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
  method: "dvol" | "vix1d" | "theory";
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

/** The walls for a reference, a day IV and a 90% multiple. */
function walls(ref: number, iv: number | null, k90: number, sigma90: number | null) {
  const move1 = iv !== null && iv > 0 ? ref * iv * Math.sqrt(DAY_YEARS) : null;
  const scale = sigma90 ?? iv;
  const move90 = scale !== null && scale > 0 ? ref * scale * Math.sqrt(DAY_YEARS) * k90 : null;
  return {
    move1,
    upper1: move1 === null ? null : ref + move1,
    lower1: move1 === null ? null : ref - move1,
    move90,
    upper90: move90 === null ? null : ref + move90,
    lower90: move90 === null ? null : Math.max(0, ref - move90),
  };
}

/** The nearest expiry's gamma ceiling and floor from its strikes, for a book with no day row. */
function strikeLevels(data: LevelsData["gamma"], spot: number) {
  let ceiling: number | null = null;
  let floor: number | null = null;
  let bestCall = 0;
  let bestPut = 0;
  for (const k of data.strikes) {
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
  const { ceiling, floor } = strikeLevels(data.gamma, e.spot);
  return {
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
  return `<div class="lv-ladder" aria-hidden="true">${bands}${lines}${range}${last}</div>`;
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

/** "Oct 20, from 08:00 UTC" for a Deribit day, "Oct 20 session" for a US one, or the next session. */
function dayName(l: Levels): string {
  if (l.day === null) return tr("the next session");
  const date = dayLabel(new Date(`${l.day}T00:00:00Z`));
  return l.source === "deribit"
    ? tr("{date}, from 08:00 UTC", { date })
    : tr("{date} session", { date });
}

/** The tab's controls: the book picker (opening this tab) and the help. */
function controls(view: PanelView, tab: BookTab, helpId: string, help: string): string {
  const books = view.data?.gamma.books ?? [];
  const picker = books.length
    ? bookPicker({ books, heatmap: view.heatmap, params: view.params, now: view.now, tab })
    : `<nav class="tf" aria-label="${esc(tr("Option book"))}"><a href="#${tab}" aria-current="true">${esc(view.params.currency)}</a></nav>`;
  return `<div class="lq-controls gx-controls" data-loading="${esc(tr("Loading {asset}…"))}">${picker}${helpButton(helpId)}</div>
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
<div class="cvd-tile"><p class="eyebrow">${tr("IV wall, 1σ")}</p><p class="cvd-big lv-span lv-ink-iv">${price(l.lower1)} – ${price(l.upper1)}</p><p class="dim">${tr("±{move} (±{pct}) from IV {iv} a day ahead", { move: price(l.move1), pct: `${((l.move1 / l.ref) * 100).toFixed(2)}%`, iv: `${((l.iv ?? 0) * 100).toFixed(1)}%` })}</p></div>
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
<h2 class="cvd-h2 wm-h2">${tr("How price has behaved at the walls")}</h2>
<p class="notes">${historyText(data.stats)}</p>
${record}
<p class="notes dim">${tr("Prices in {unit}. {source} options, read {ago}.", { unit: esc(e.unit), source: esc(publisher(e.source).name), ago: agoText(e.computed_at, view.now) })}</p>`;
}

/** The Ceiling & Floor tab's body, from its controls down. */
export function levelsPanel(view: PanelView): string {
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
    )}</p>`,
  );
  const missing = unavailable(view);
  if (missing !== null) return `${head}${missing}`;
  const data = view.data as LevelsData;
  const e = data.gamma.exposure as GammaExposure;
  const l = todayLevels(data, view.now);
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
<div class="cvd-tile"><p class="eyebrow">${tr("Gamma ceiling / floor")}</p><p class="cvd-big lv-span"><span class="lq-ink-l">${price(l.gammaCeiling)}</span> / <span class="lq-ink-s">${price(l.gammaFloor)}</span></p><p class="dim">${tr("the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}", { expiry })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Dealer ceiling / floor")}</p><p class="cvd-big lv-span lv-ink-be">${price(l.beCeiling)} / ${price(l.beFloor)}</p><p class="dim">${tr("where dealers who sold every option of that expiry break even; max pain {pain}", { pain: price(l.maxPain) })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Lined up with an IV wall")}</p><p class="cvd-big lv-span${alignedNames.length ? " lv-ink-on" : " dim"}">${alignedNames.length ? alignedNames.join(", ") : tr("none")}</p><p class="dim">${tr("within a quarter of the day's 1σ move ({band}) of an IV wall or a 90% wall", { band: price(l.move1 === null ? null : l.move1 * ALIGN_SHARE) })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${l.basis === "day" ? tr("The day so far") : tr("Reference")}</p><p class="cvd-big">${price(l.last ?? l.ref)}</p><p class="dim">${l.basis === "day" ? tr("high {high} · low {low}", { high: price(l.high), low: price(l.low) }) : tr("the latest close, for the next session")}</p></div>
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
    [tr("Reference close"), l.ref, dayName(l)],
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
  const days = finishedDays(data, l);
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
    l.basis === "next"
      ? `<p class="notes">${tr("{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.", { currency: book })}</p>`
      : days.length === 0
        ? `<p class="notes">${tr("{currency}'s own record starts with today; each finished day is added here.", { currency: book })}</p>`
        : `<div class="sheet-wrap"><table class="sheet lv-table"><thead><tr><th>${tr("Level")}</th><th class="num">${tr("Days")}</th><th class="num">${tr("Reached")}</th><th class="num">${tr("Closed back inside")}</th></tr></thead><tbody data-live="levels-record">${rows
            .map(([name, pick]) => {
              const t = tally(days, pick);
              return `<tr><td>${name}</td><td class="num">${t.days}</td><td class="num">${t.reached}</td><td class="num">${t.held} <span class="dim">${pct(t.held, t.reached)}</span></td></tr>`;
            })
            .join("")}</tbody></table></div>
<p class="notes">${tr("Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.", { days: days.length, since: recordDay(days.at(-1)?.day as string) })}</p>`;
  return `${head}
${tiles}
${figure}
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
