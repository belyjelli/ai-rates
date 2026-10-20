import type { GammaData, GammaExposure, GammaWallStats, LevelsData } from "../app/data";
import { esc, formatPrice } from "./format";
import { dayLabel, level, signedPct, signedUsd, unitSymbol } from "./gamma";
import { tr } from "./i18n";
import { icon } from "./icons";
import { type DayRecord, finishedDays, type Levels, linedUp, outcome, todayLevels } from "./levels";

/**
 * Reaction zones: where an IV wall and a market maker's level meet, shown above every option tab's
 * chart (the owner's ask of 2026-10-21, after a framework that reads IV walls and gamma walls together).
 *
 * THE IDEA, AND ITS LIMIT. An IV wall is a statistical edge of the day's range; a gamma ceiling or floor
 * is where dealers' hedging trades most, and the dealer ceiling and floor are where option sellers start
 * losing. Where one of each lie within a quarter of the day's 1σ move (levels.ts linedUp, the same rule
 * the Ceiling & Floor tab marks), the two pressures act at one price: a place to watch for a rejection.
 * It is not a promise. The measured record (gamma_wall_stats) is that a touch of BTC's 1σ wall closes back
 * inside about half the time, so the strip quotes that record rather than the framework's 90%.
 *
 * THE YARDSTICK. Distances are in points, percent and the day's 1σ move (the week's on the Week view):
 * the framework's ATR, read from the options instead of past candles, so every book has one.
 *
 * THE REGIME. Net gamma over every expiry: dealers long gamma sell rises and buy dips, which is what
 * makes a wall hold; short gamma, their hedging chases price and walls give way more easily.
 *
 * THE RECORD. The framework's real claim is that a lined-up wall holds more often than a wall alone, so
 * the strip counts it on the book's own stored days (gamma_wall_days, from 2026-10-20): each finished
 * day's zones, how often price reached one and closed back on its near side, against the same count for
 * that day's plain IV walls. Thin for weeks; it is there so the claim can fail in plain sight.
 *
 * WHERE. In full on IV Walls and Ceiling & Floor, whose subject the levels are; folded to one line that
 * opens into it on Gamma Exposure, Delta, Vega and Theta, whose charts come first.
 */

export type ZoneKind = "iv" | "iv90" | "gamma" | "dealer";

export interface ZoneMark {
  kind: ZoneKind;
  price: number;
}

export interface ReactionZone {
  /** 1: an upper wall with a ceiling; -1: a lower wall with a floor. */
  side: 1 | -1;
  from: number;
  to: number;
  marks: ZoneMark[];
}

/** What zones are read from: a day's (or week's) walls and market maker's levels. */
export type ZoneLevels = Pick<
  Levels,
  | "move1"
  | "upper1"
  | "lower1"
  | "upper90"
  | "lower90"
  | "gammaCeiling"
  | "gammaFloor"
  | "beCeiling"
  | "beFloor"
>;

/** Every IV wall paired with every market maker's level on its side, those lined up merged into zones. */
export function reactionZones(l: ZoneLevels): ReactionZone[] {
  const out: ReactionZone[] = [];
  for (const side of [1, -1] as const) {
    const walls: ZoneMark[] = [];
    const makers: ZoneMark[] = [];
    const add = (list: ZoneMark[], kind: ZoneKind, price: number | null) => {
      if (price !== null && price > 0) list.push({ kind, price });
    };
    add(walls, "iv", side === 1 ? l.upper1 : l.lower1);
    add(walls, "iv90", side === 1 ? l.upper90 : l.lower90);
    add(makers, "gamma", side === 1 ? l.gammaCeiling : l.gammaFloor);
    add(makers, "dealer", side === 1 ? l.beCeiling : l.beFloor);
    const pairs: ReactionZone[] = [];
    for (const w of walls) {
      for (const m of makers) {
        if (!linedUp(m.price, w.price, l.move1)) continue;
        pairs.push({
          side,
          from: Math.min(w.price, m.price),
          to: Math.max(w.price, m.price),
          marks: [w, m],
        });
      }
    }
    // Overlapping pairs are one zone: the 1σ and 90% walls both near one ceiling, say.
    pairs.sort((a, b) => a.from - b.from);
    const merged: ReactionZone[] = [];
    for (const p of pairs) {
      const last = merged.at(-1);
      if (last && p.from <= last.to) {
        last.to = Math.max(last.to, p.to);
        for (const m of p.marks) if (!last.marks.some((x) => x.kind === m.kind)) last.marks.push(m);
      } else merged.push({ ...p, marks: [...p.marks] });
    }
    out.push(...merged);
  }
  return out.sort((a, b) => b.to - a.to);
}

/** A book's gamma read as the levels tabs read a book: its stored days and its daily history. */
const asLevelsData = (data: GammaData): LevelsData => ({
  gamma: data,
  days: data.wall?.days ?? [],
  stats: data.wall?.stats ?? null,
  weekStats: null,
  weekStrikes: [],
});

/** The levels a book's gamma read gives for its day: the stored day's while it is current, else its own. */
export function bookLevels(data: GammaData, now: number): Levels | null {
  return todayLevels(asLevelsData(data), now);
}

/** The zones' record from a book's gamma read, or null for a book whose days are not kept. */
export function bookRecord(data: GammaData, today: Levels | null): ZoneRecord | null {
  if (today?.basis !== "day") return null;
  return zoneRecord(finishedDays(asLevelsData(data), today), "day");
}

/** How the zones did on a book's finished days (or weeks), against its plain IV walls on the same ones. */
export interface ZoneRecord {
  period: "day" | "week";
  /** Finished days (or weeks) counted, and the first of them. */
  days: number;
  since: string | null;
  zones: number;
  /** Zones price reached, and of those, how many it closed back on the near side of. */
  reached: number;
  held: number;
  /** The same for the 1σ IV walls on those days, each side counted. */
  wallReached: number;
  wallHeld: number;
}

/** Tallies `records` (finishedDays or finishedWeeks, newest first): every zone each held, and its walls. */
export function zoneRecord(records: readonly DayRecord[], period: "day" | "week"): ZoneRecord {
  const out: ZoneRecord = {
    period,
    days: records.length,
    since: records.at(-1)?.day ?? null,
    zones: 0,
    reached: 0,
    held: 0,
    wallReached: 0,
    wallHeld: 0,
  };
  for (const d of records) {
    const r = d.row;
    const zones = reactionZones({
      ...d.w,
      gammaCeiling: r.gamma_ceiling,
      gammaFloor: r.gamma_floor,
      beCeiling: r.be_ceiling,
      beFloor: r.be_floor,
    });
    for (const z of zones) {
      out.zones++;
      // Reached at its near edge; held when the day closed back on the near side of it.
      const o = outcome(z.side, z.side === 1 ? z.from : z.to, r.day_high, r.day_low, r.last_price);
      if (o === "held" || o === "broke") out.reached++;
      if (o === "held") out.held++;
    }
    for (const [side, wall] of [
      [1, d.w.upper1],
      [-1, d.w.lower1],
    ] as const) {
      const o = outcome(side, wall, r.day_high, r.day_low, r.last_price);
      if (o === "held" || o === "broke") out.wallReached++;
      if (o === "held") out.wallHeld++;
    }
  }
  return out;
}

/** The exposure the regime is read from: every expiry's, else the one shown. */
export const regimeExposure = (data: GammaData): GammaExposure | null =>
  data.scopes.find((s) => s.scope === "all") ?? data.exposure;

const KIND_NAME = (): Record<ZoneKind, string> => ({
  iv: tr("IV wall"),
  iv90: tr("90% wall"),
  gamma: tr("gamma wall"),
  dealer: tr("dealer break-even"),
});

const price = (v: number) => formatPrice(level(v));
const sigmas = (gap: number, move1: number) => `${(Math.abs(gap) / move1).toFixed(2)}σ`;
/** A distance in points, to the precision the spot is quoted at: whole points from 1,000 up. */
const points = (gap: number, spot: number) => {
  const digits = spot >= 1000 ? 0 : spot >= 10 ? 2 : 4;
  const text = Math.abs(gap).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${gap > 0 ? "+" : gap < 0 ? "−" : ""}${text}`;
};

interface Row {
  name: string;
  cls: string;
  price: number;
  zone: boolean;
}

/** The levels around the spot, each with its ink, nearest first on each side. */
function rows(l: Levels, zones: readonly ReactionZone[], flip: number | null): Row[] {
  const inZone = (v: number) => zones.some((z) => v >= z.from - 1e-9 && v <= z.to + 1e-9);
  const list: Row[] = [];
  const add = (v: number | null, name: string, cls: string) => {
    if (v !== null && v > 0) list.push({ name, cls, price: v, zone: inZone(v) });
  };
  add(l.upper90, tr("90% wall"), "cz-90");
  add(l.upper1, tr("IV wall"), "cz-iv");
  add(l.gammaCeiling, tr("gamma ceiling"), "cz-gc");
  add(l.beCeiling, tr("dealer ceiling"), "cz-be");
  add(l.beFloor, tr("dealer floor"), "cz-be");
  add(l.gammaFloor, tr("gamma floor"), "cz-gf");
  add(l.lower1, tr("IV wall"), "cz-iv");
  add(l.lower90, tr("90% wall"), "cz-90");
  add(flip, tr("gamma flip"), "cz-flip");
  return list;
}

/** One side of the spot: its zone (or that it has none) and its levels, nearest first. */
function sideCard(input: {
  side: 1 | -1;
  spot: number;
  move1: number;
  zones: readonly ReactionZone[];
  rows: readonly Row[];
}): string {
  const { side, spot, move1 } = input;
  const mine = input.rows
    .filter((r) => (side === 1 ? r.price > spot : r.price <= spot))
    .sort((a, b) => Math.abs(a.price - spot) - Math.abs(b.price - spot));
  const zone = input.zones
    .filter((z) => z.side === side)
    .sort((a, b) => Math.abs(a.from - spot) - Math.abs(b.from - spot))[0];
  const names = KIND_NAME();
  let head: string;
  if (zone) {
    const inside = spot >= zone.from && spot <= zone.to;
    const near = side === 1 ? zone.from : zone.to;
    const gap = near - spot;
    head = `<p class="cz-zone"><b>${price(zone.from)} – ${price(zone.to)}</b> <span>${zone.marks.map((m) => names[m.kind]).join(" + ")}</span></p><p class="dim">${
      inside
        ? tr("the spot is inside it now")
        : tr("{points} ({pct}) away, {sigmas} of the day's move", {
            points: points(gap, spot),
            pct: signedPct(gap / spot, 2),
            sigmas: sigmas(gap, move1),
          })
    }</p>`;
  } else {
    head = `<p class="cz-zone cz-none">${side === 1 ? tr("No zone above") : tr("No zone below")}</p><p class="dim">${
      side === 1 ? tr("no IV wall lines up with a ceiling") : tr("no IV wall lines up with a floor")
    }</p>`;
  }
  const list = mine
    .map((r) => {
      const gap = r.price - spot;
      return `<li${r.zone ? ' class="cz-in"' : ""}><b class="${r.cls}"><i class="cz-sw ${r.cls}" aria-hidden="true"></i>${r.name}</b><span class="num">${price(r.price)}</span><span class="num dim">${points(gap, spot)}</span><span class="num dim">${sigmas(gap, move1)}</span></li>`;
    })
    .join("");
  return `<div class="cz-side"><p class="eyebrow">${side === 1 ? tr("Above the spot") : tr("Below the spot")}</p>${head}${
    list ? `<ol class="cz-list">${list}</ol>` : ""
  }</div>`;
}

/**
 * The rail: the levels across one horizontal price axis, the zones shaded, the spot marked. Only the
 * spot and the zones are labelled; the side cards under it name every level, each with its line's
 * mark, and a key under the rail names the shading. Hidden from screen readers, which read the cards.
 */
function rail(
  l: Levels,
  spot: number,
  zones: readonly ReactionZone[],
  list: readonly Row[],
): string {
  const near = list.filter((r) => r.cls !== "cz-flip").map((r) => r.price);
  const top = Math.max(spot, ...near);
  const bottom = Math.min(spot, ...near);
  const half = Math.max(top - spot, spot - bottom, (l.move1 ?? spot * 0.01) * 1.2);
  // The flip joins the axis when it is not far beyond the walls; else an arrow at the edge names it.
  const flip = list.find((r) => r.cls === "cz-flip");
  const reach = flip && Math.abs(flip.price - spot) <= half * 1.6 ? Math.abs(flip.price - spot) : 0;
  const span = Math.max(half, reach) * 1.08;
  const lo = spot - span;
  const hi = spot + span;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const clamp = (v: number) => Math.min(100, Math.max(0, x(v)));
  const bands = [
    l.lower90 !== null && l.upper90 !== null
      ? `<i class="cz-band cz-band-90" style="left:${clamp(l.lower90).toFixed(2)}%;width:${(clamp(l.upper90) - clamp(l.lower90)).toFixed(2)}%"></i>`
      : "",
    l.lower1 !== null && l.upper1 !== null
      ? `<i class="cz-band cz-band-iv" style="left:${clamp(l.lower1).toFixed(2)}%;width:${(clamp(l.upper1) - clamp(l.lower1)).toFixed(2)}%"></i>`
      : "",
  ].join("");
  const zoneBoxes = zones
    .map((z) => {
      const left = clamp(z.from);
      const width = Math.max(0.6, clamp(z.to) - left);
      return `<i class="cz-hot" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></i><span class="cz-hot-t" style="left:${(left + width / 2).toFixed(2)}%">${tr("zone")}</span>`;
    })
    .join("");
  const ticks = list
    .filter((r) => r.price >= lo && r.price <= hi)
    .map(
      (r) =>
        `<i class="cz-tick ${r.cls}" style="left:${x(r.price).toFixed(2)}%" title="${esc(`${r.name} ${price(r.price)}`)}"></i>`,
    )
    .join("");
  const edge =
    flip && (flip.price < lo || flip.price > hi)
      ? `<span class="cz-edge ${flip.price < lo ? "cz-edge-l" : "cz-edge-r"}">${flip.price < lo ? "← " : ""}${tr("flip {price}", { price: price(flip.price) })}${flip.price > hi ? " →" : ""}</span>`
      : "";
  return `<div class="cz-rail" aria-hidden="true">${bands}${zoneBoxes}${ticks}<i class="cz-spot" style="left:${x(spot).toFixed(2)}%"></i><span class="cz-spot-t" style="left:${x(spot).toFixed(2)}%">${tr("spot {price}", { price: price(spot) })}</span>${edge}</div>
<p class="cz-key" aria-hidden="true">${[
    l.lower1 !== null && l.upper1 !== null
      ? `<span><i class="cz-k-iv"></i>${tr("between the IV walls")}</span>`
      : "",
    l.lower90 !== null && l.upper90 !== null
      ? `<span><i class="cz-k-90"></i>${tr("between the 90% walls")}</span>`
      : "",
    zones.length ? `<span><i class="cz-k-hot"></i>${tr("reaction zone, today")}</span>` : "",
    `<span>${tr("each line's mark is beside its name below")}</span>`,
  ].join("")}</p>`;
}

/** The regime in one line: whose hedging damps moves and whose adds to them, and where it flips. */
function regimeLine(e: GammaExposure, spot: number, move1: number): string {
  const sym = unitSymbol(e.unit);
  const net = `<b class="${e.net_gex_usd >= 0 ? "lq-ink-l" : "lq-ink-s"}">${signedUsd(e.net_gex_usd, sym)}</b>`;
  const words =
    e.net_gex_usd >= 0
      ? tr(
          "Dealers long gamma ({net} per 1% move, every expiry): their hedging sells rises and buys dips, which is what lets a wall hold.",
          { net },
        )
      : tr(
          "Dealers short gamma ({net} per 1% move, every expiry): their hedging chases the price, so walls give way more easily and fading them is riskier.",
          { net },
        );
  const flip =
    e.flip_price === null
      ? ""
      : ` ${tr("Flip {price}, {pct} ({sigmas}).", {
          price: price(e.flip_price),
          pct: signedPct(e.flip_price / spot - 1, 2),
          sigmas: sigmas(e.flip_price - spot, move1),
        })}`;
  return `<p class="cz-regime ${e.net_gex_usd >= 0 ? "cz-long" : "cz-short"}">${words}${flip}</p>`;
}

/** The book's own zone record over its finished days in a sentence, or that it starts today. */
function recordText(r: ZoneRecord): string {
  if (r.days === 0 || r.since === null) {
    return tr(
      "This book's zone record starts with today: each finished day adds whether price reached a zone and turned there.",
    );
  }
  return tr(
    "Its own zone record, {days} finished days since {since}: {zones} zones, price reached {reached} and closed back on the near side of {held}; its IV walls on those days were reached {wallReached} times and held {wallHeld}.",
    {
      days: r.days,
      since: dayLabel(new Date(`${r.since}T00:00:00Z`)),
      zones: r.zones,
      reached: r.reached,
      held: r.held,
      wallReached: r.wallReached,
      wallHeld: r.wallHeld,
    },
  );
}

/** What the record says, in place of the framework's 90%. */
function oddsLine(stats: GammaWallStats | null | undefined, record: ZoneRecord | null): string {
  const pct = (n: number | null, of: number | null) =>
    n !== null && of !== null && of > 0 ? `${Math.round((100 * n) / of)}%` : null;
  const rev1 = pct(stats?.rev1 ?? null, stats?.touch1 ?? null);
  const rev90 = pct(stats?.rev90 ?? null, stats?.touch90 ?? null);
  const history =
    stats && rev1 && rev90
      ? `${tr(
          "Since {year}, a touch of this book's 1σ wall closed back inside {rev1} of {touch1} times, of its 90% wall {rev90} of {touch90}: better than a coin toss, not nine in ten.",
          {
            year: stats.first_day.slice(0, 4),
            rev1,
            touch1: (stats.touch1 ?? 0).toLocaleString("en-US"),
            rev90,
            touch90: (stats.touch90 ?? 0).toLocaleString("en-US"),
          },
        )} `
      : "";
  return `<p class="notes dim cz-odds">${history}${tr(
    "A zone is where an IV wall and a market maker's level fall within a quarter of the day's 1σ move of each other: a place to wait for a rejection, not a trade on its own, and least reliable when dealers are short gamma.",
  )}</p>${record ? `<p class="notes cz-record" data-zone-record>${recordText(record)}</p>` : ""}`;
}

/** The folded strip's one line: the zone each side, or none, and the regime. */
function brief(
  zones: readonly ReactionZone[],
  spot: number,
  move1: number,
  regime: GammaExposure | null,
) {
  const side = (s: 1 | -1) => {
    const zone = zones
      .filter((z) => z.side === s)
      .sort((a, b) => Math.abs(a.from - spot) - Math.abs(b.from - spot))[0];
    if (!zone)
      return `<span class="dim">${s === 1 ? tr("no zone above") : tr("no zone below")}</span>`;
    const range = `${price(zone.from)} – ${price(zone.to)}`;
    if (spot >= zone.from && spot <= zone.to)
      return `<b class="cz-hot-ink">${tr("the spot is in the zone {range}", { range })}</b>`;
    const gap = (s === 1 ? zone.from : zone.to) - spot;
    return `<b class="cz-hot-ink">${
      s === 1
        ? tr("zone above {range}, {sigmas} away", { range, sigmas: sigmas(gap, move1) })
        : tr("zone below {range}, {sigmas} away", { range, sigmas: sigmas(gap, move1) })
    }</b>`;
  };
  const mode = regime
    ? `<span class="${regime.net_gex_usd >= 0 ? "lq-ink-l" : "lq-ink-s"}">${regime.net_gex_usd >= 0 ? tr("dealers long gamma") : tr("dealers short gamma")}</span>`
    : "";
  return [side(1), side(-1), mode].filter(Boolean).join(" · ");
}

/**
 * The strip: the regime, the rail, the two sides and the record. `l` is the day's levels (or the
 * week's), `spot` the price now, `regime` the exposure the regime is read from, `record` the zones' own
 * record (null where the book's days are not kept). `fold` draws it as one line that opens into the
 * rest; live.ts refreshes the line and the body, never the <details>, so an open strip stays open.
 */
export function reactionStrip(input: {
  l: Levels | null;
  spot: number;
  regime: GammaExposure | null;
  stats: GammaWallStats | null | undefined;
  record: ZoneRecord | null;
  live: string;
  fold?: boolean;
}): string {
  const { l, spot, regime } = input;
  if (l === null || l.move1 === null || !(l.move1 > 0) || !(spot > 0)) return "";
  const zones = reactionZones(l);
  const list = rows(l, zones, regime?.flip_price ?? null);
  const unit = l.period === "week" ? tr("the week's 1σ move") : tr("the day's 1σ move");
  const scale = `<p class="dim">${tr("σ is {unit}, {move}", { unit, move: price(l.move1) })}</p>`;
  const body = `${regime ? regimeLine(regime, spot, l.move1) : ""}
${rail(l, spot, zones, list)}
<div class="cz-sides">${sideCard({ side: 1, spot, move1: l.move1, zones, rows: list })}${sideCard({ side: -1, spot, move1: l.move1, zones, rows: list })}</div>
${oddsLine(input.stats, input.record)}`;
  if (input.fold) {
    return `<details class="cz cz-fold">
<summary class="cz-sum"><span class="cz-title">${tr("Reaction zones")}</span><span class="cz-brief" data-live="${esc(input.live)}-brief">${brief(zones, spot, l.move1, regime)}</span><span class="cz-open">${icon("caret")}</span></summary>
<div class="cz-body" data-live="${esc(input.live)}">${scale}
${body}</div>
</details>`;
  }
  return `<div class="cz" role="group" data-live="${esc(input.live)}" aria-label="${esc(tr("Reaction zones"))}">
<div class="cz-head"><h3 class="cz-title">${tr("Reaction zones")}</h3>${scale}</div>
${body}
</div>`;
}

/** The zones for a strike chart: shaded where they fall, named in its key. */
export function zoneShades(
  zones: readonly ReactionZone[],
  x: (price: number) => number,
  low: number,
  high: number,
): string {
  return zones
    .filter((z) => z.to >= low && z.from <= high)
    .map((z) => {
      const from = x(Math.max(low, z.from));
      const to = x(Math.min(high, z.to));
      return `<rect class="gx-cz" x="${from.toFixed(1)}" y="0" width="${Math.max(4, to - from).toFixed(1)}" height="1000"></rect>`;
    })
    .join("");
}
