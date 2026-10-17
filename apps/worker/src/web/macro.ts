import type {
  CotRow,
  MacroData,
  MacroNeeds,
  MacroOdds,
  MacroPoint,
  MacroRelease,
} from "../app/data";
import { lazyPlaceholder } from "./chart-skeleton";
import { esc, formatDuration, formatUsd, since } from "./format";
import { helpButton, helpPanel } from "./help";
import { tr, trMsg } from "./i18n";
import { timeTag } from "./localtime";
import {
  type MacroSlots,
  MONTHS,
  macroText,
  SLOT_BAND,
  SLOT_CURSOR,
  SLOT_FORMAT,
  SLOT_HAIR,
  slotCursorSwitch,
  slotData,
} from "./slot-chart";

/**
 * The Rates page's macro tabs: inflation, Fed policy, employment, growth, the market's policy signals,
 * and positioning and flows. What a crypto desk watches beside funding: the prints that move rates,
 * what the Fed is expected to do about them, and who holds the futures.
 *
 * WHERE IT COMES FROM. The collector (internal/macro, migration 038) reads FRED for the government
 * series -- BLS's CPI and payrolls, BEA's GDP and PCE, the Fed's rates, balance sheet and projections,
 * Treasury's yields -- with each release's date from FRED's calendar and each FOMC meeting from the
 * Fed's; Kalshi's prices for the odds of each FOMC decision and of the next prints; the CFTC's
 * Commitments of Traders; and DefiLlama's stablecoin supply. No licensed series: credit spreads and
 * consumer sentiment, which FRED carries under their owners' terms, are left out.
 *
 * WHAT IT WORKS OUT. The levels are as published; changes (year on year, annualized), the market's
 * middle estimate from Kalshi's ladder of "above X" prices, the rate path implied by each meeting's
 * odds, net liquidity and each market's positioning rank are computed here, and each says so.
 *
 * Every tab loads by itself (`?panel=<tab>`, tabs.ts), so the funding grid's readers pay nothing for
 * them, and `?macro=<tab>` serves the page with that tab filled, for a reader without JavaScript.
 */

export const MACRO_PANELS = ["inflation", "fed", "jobs", "growth", "signals", "flows"] as const;
export type MacroPanel = (typeof MACRO_PANELS)[number];

export const isMacroPanel = (value: string | null): value is MacroPanel =>
  value !== null && (MACRO_PANELS as readonly string[]).includes(value);

/** The tab bar's entries, after the funding grid and Gamma Exposure. */
export const macroTabs = (): { id: MacroPanel; label: string; shortLabel: string }[] => [
  { id: "inflation", label: tr("Inflation (CPI)"), shortLabel: tr("CPI") },
  { id: "fed", label: tr("Fed policy"), shortLabel: tr("Fed") },
  { id: "jobs", label: tr("Employment"), shortLabel: tr("Jobs") },
  { id: "growth", label: tr("Growth"), shortLabel: tr("Growth") },
  { id: "signals", label: tr("Policy signals"), shortLabel: tr("Signals") },
  { id: "flows", label: tr("Positioning and flows"), shortLabel: tr("Flows") },
];

/** What each tab reads: FRED ids with the years each needs, releases, Kalshi series, the COT. */
export const MACRO_NEEDS: Readonly<Record<MacroPanel, MacroNeeds>> = {
  inflation: {
    series: { CPIAUCSL: 9, CPILFESL: 9, PCEPI: 9, PCEPILFE: 9, T5YIE: 3, T10YIE: 3, T5YIFR: 3 },
    releases: ["cpi", "pce"],
    odds: ["KXCPI", "KXCPICORE", "KXCPIYOY"],
    cot: false,
  },
  fed: {
    series: {
      DFEDTARU: 6,
      DFEDTARL: 6,
      EFFR: 6,
      SOFR: 1,
      IORB: 1,
      WALCL: 6,
      FEDTARMD: 6,
      FEDTARMDLR: 6,
      PCECTPIMD: 6,
      JCXFEMD: 6,
      UNRATEMD: 6,
      GDPC1MD: 6,
    },
    releases: ["fomc"],
    odds: ["KXFEDDECISION"],
    cot: false,
  },
  jobs: {
    series: {
      PAYEMS: 5,
      UNRATE: 5,
      ICSA: 3,
      CCSA: 3,
      JTSJOL: 3,
      CES0500000003: 3,
      SAHMREALTIME: 3,
    },
    releases: ["jobs", "claims", "jolts"],
    odds: ["KXPAYROLLS", "KXU3"],
    cot: false,
  },
  growth: {
    series: { A191RL1Q225SBEA: 6, GDPNOW: 2, INDPRO: 6, RSAFS: 6, RECPROUSM156N: 2 },
    releases: ["gdp", "retail", "indpro"],
    odds: ["KXGDP"],
    cot: false,
  },
  signals: {
    series: {
      DGS3MO: 3,
      DGS2: 3,
      DGS10: 3,
      DGS30: 3,
      T10Y2Y: 6,
      T10Y3M: 6,
      DFII10: 3,
      DTWEXBGS: 2,
      NFCI: 2,
      EFFR: 1,
      WALCL: 3,
      WTREGEN: 3,
      RRPONTSYD: 3,
      M2SL: 2,
    },
    releases: ["fomc"],
    odds: [],
    cot: false,
  },
  flows: { series: { STABLECOINS: 4 }, releases: [], odds: [], cot: true },
};

const DAY_MS = 86_400_000;
const MINUS = "−";

// ---- Formatting ----

/** A figure with its sign, decimals and suffix: "3.9%", "+0.3%", "−12k". */
const fig = (v: number, digits: number, suffix = "", signed = false) =>
  `${v < 0 && Number(Math.abs(v).toFixed(digits)) !== 0 ? MINUS : signed && v > 0 && Number(v.toFixed(digits)) !== 0 ? "+" : ""}${Math.abs(v).toFixed(digits)}${suffix}`;
const pct = (v: number, digits = 1) => fig(v, digits, "%");
const spct = (v: number, digits = 1) => fig(v, digits, "%", true);
/** Percentage points and basis points, in the page's language. */
const ppSuffix = () => tr("{n} pp", { n: "" });
const bpSuffix = () => tr("{n} bp", { n: "" });
const pp = (v: number, digits = 2) => fig(v, digits, ppSuffix(), true);
const bp = (v: number) => fig(v, 0, bpSuffix(), true);
/** Thousands, signed: payrolls' monthly change. */
const kSigned = (v: number) => fig(v, 0, "k", true);
/** A count with thousands separators: contracts. */
const count = (v: number, signed = false) =>
  `${v < 0 ? MINUS : signed && v > 0 ? "+" : ""}${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
const dash = `<span class="dim">–</span>`;
/** The colour of a figure's sign, as shown: a move that rounds to zero has none. */
const tone = (v: number, digits = 0) => {
  const shown = Number(v.toFixed(digits));
  return shown > 0 ? "mc-up" : shown < 0 ? "mc-down" : "";
};

const monthName = (m: number) => trMsg(MONTHS[m] as string);
const monthLabel = (ms: number) => {
  const d = new Date(ms);
  return tr("{month} {year}", { month: monthName(d.getUTCMonth()), year: d.getUTCFullYear() });
};
const quarterLabel = (ms: number) => {
  const d = new Date(ms);
  return tr("Q{q} {year}", { q: Math.floor(d.getUTCMonth() / 3) + 1, year: d.getUTCFullYear() });
};
/** A full date, "Sep 16, 2026", in the page's language's order. */
const dateLabel = (ms: number) => {
  const d = new Date(ms);
  return tr("{month} {day}, {year}", {
    month: monthName(d.getUTCMonth()),
    day: d.getUTCDate(),
    year: d.getUTCFullYear(),
  });
};
const dayLabel = (ms: number) => {
  const d = new Date(ms);
  return tr("{month} {day}", { month: monthName(d.getUTCMonth()), day: d.getUTCDate() });
};

/** How long until a moment: "in 11d 4h", "in 3h 05m". */
function inText(ms: number, now: number): string {
  const left = ms - now;
  if (left <= 0) return tr("now");
  if (left < DAY_MS) return tr("in {time}", { time: formatDuration(left / 1000) });
  return tr("in {time}", {
    time: tr("{d}d {h}h", {
      d: Math.floor(left / DAY_MS),
      h: Math.floor((left % DAY_MS) / 3_600_000),
    }),
  });
}

// ---- Series on a calendar ----

/** A month's index, year * 12 + month, which is what monthly series are keyed by. */
const monthKey = (ms: number) => {
  const d = new Date(ms);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};
const keyMs = (key: number) => Date.UTC(Math.floor(key / 12), key % 12, 1);
/** The Monday (UTC) a moment's week starts on. */
const weekStart = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
};

/** A series by month: each month's observation (a monthly series is dated on its first). */
function byMonth(points: readonly MacroPoint[] | undefined): Map<number, number> {
  const out = new Map<number, number>();
  for (const [ms, v] of points ?? []) out.set(monthKey(ms), v);
  return out;
}

/** A series by week: the last observation in each week. */
function byWeek(points: readonly MacroPoint[] | undefined): Map<number, number> {
  const out = new Map<number, number>();
  for (const [ms, v] of points ?? []) out.set(weekStart(ms), v);
  return out;
}

const lastOf = (points: readonly MacroPoint[] | undefined): MacroPoint | null =>
  points?.length ? (points[points.length - 1] as MacroPoint) : null;

/** The value `back` observations before the last one. */
const backOf = (points: readonly MacroPoint[] | undefined, back: number): number | null =>
  points && points.length > back ? (points[points.length - 1 - back] as MacroPoint)[1] : null;

/** The observation on or before a moment. */
function at(points: readonly MacroPoint[] | undefined, ms: number): number | null {
  let found: number | null = null;
  for (const [t, v] of points ?? []) {
    if (t > ms) break;
    found = v;
  }
  return found;
}

const lastKey = (map: Map<number, number>) => Math.max(...map.keys());

/** The change in percent over `n` months, annualized when `annualize` is set. */
function change(
  map: Map<number, number>,
  key: number,
  n: number,
  annualize = false,
): number | null {
  const now = map.get(key);
  const then = map.get(key - n);
  if (now === undefined || then === undefined || then === 0) return null;
  return annualize ? ((now / then) ** (12 / n) - 1) * 100 : (now / then - 1) * 100;
}

/** Month keys from `from` to `to`, inclusive. */
const months = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Week starts from `from` on, through the week of `to`. */
function weeks(from: number, to: number): number[] {
  const out: number[] = [];
  for (let w = weekStart(from); w <= to; w += 7 * DAY_MS) out.push(w);
  return out;
}

/** A weekly series across the given weeks, each week's last value carried into weeks that have none. */
function weekly(
  map: Map<number, number>,
  slots: readonly number[],
  carry = true,
): (number | null)[] {
  let held: number | null = null;
  const first = Math.min(...map.keys());
  return slots.map((w) => {
    const v = map.get(w);
    if (v !== undefined) held = v;
    else if (!carry || w < first) return null;
    return held;
  });
}

// ---- Charts ----

interface Line {
  label: string;
  /** mc-a … mc-e: the line's colour. */
  cls: string;
  values: (number | null)[];
  bars?: boolean;
  dashed?: boolean;
  /** The readout's suffix ("$" reads as compact dollars), decimals and sign. */
  unit: string;
  digits: number;
  signed?: boolean;
}

interface Chart {
  title: string;
  grain: "m" | "q" | "w";
  slots: number[];
  lines: Line[];
  refs?: { value: number; label: string }[];
  /** The axis labels' text, with as many decimals as the step between them needs. */
  axis: (v: number, digits: number) => string;
  /** The crosshair's axis: a plain figure with this suffix and decimals, or compact dollars. */
  axisKind: { suffix: string; digits: number } | "usd";
  note?: string;
}

/** The decimals a step's multiples need: 2.5 needs one, 0.25 two, 5 none. */
function stepDigits(step: number): number {
  let d = 0;
  while (d < 4 && Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) > 1e-6) d++;
  return d;
}

/** A round step near `raw`: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * power) return m * power;
  return 10 * power;
}

function chart(spec: Chart): string {
  const n = spec.slots.length;
  if (n === 0) return "";
  const values = spec.lines.flatMap((l) => l.values.filter((v): v is number => v !== null));
  if (values.length === 0) return "";
  const refs = spec.refs ?? [];
  let lo = Math.min(...values, ...refs.map((r) => r.value));
  let hi = Math.max(...values, ...refs.map((r) => r.value));
  if (spec.lines.some((l) => l.bars)) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (hi === lo) {
    hi += Math.abs(hi) * 0.1 || 1;
    lo -= Math.abs(lo) * 0.1 || 1;
  }
  const step = niceStep((hi - lo) / 5);
  const pad = (hi - lo) * 0.06;
  const top = hi + pad;
  const bottom = lo - pad;
  const y = (v: number) => ((top - v) / (top - bottom)) * 1000;
  const slot = 1000 / n;
  const cx = (i: number) => (i + 0.5) * slot;

  const ticks: number[] = [];
  for (let t = Math.ceil(bottom / step) * step; t <= top; t += step) ticks.push(t);
  const grid = ticks
    .map(
      (t) =>
        `<line class="cvd-grid" x1="0" x2="1000" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"></line>`,
    )
    .join("");
  const yLabels = ticks
    .map(
      (t) =>
        `<span class="cvd-yl" style="top:${(y(t) / 10).toFixed(2)}%">${spec.axis(Math.abs(t) < step / 1e6 ? 0 : t, stepDigits(step))}</span>`,
    )
    .join("");
  const zero =
    bottom < 0 && top > 0
      ? `<line class="cvd-zero" x1="0" x2="1000" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"></line>`
      : "";
  const refLines = refs
    .map(
      (r) =>
        `<line class="mc-ref" x1="0" x2="1000" y1="${y(r.value).toFixed(1)}" y2="${y(r.value).toFixed(1)}"></line>`,
    )
    .join("");
  const refLabels = refs
    .map(
      (r) =>
        `<span class="mc-ref-l" style="top:${(y(r.value) / 10).toFixed(2)}%">${esc(r.label)}</span>`,
    )
    .join("");

  const bars = spec.lines
    .filter((l) => l.bars)
    .map((l, k, all) => {
      const width = (slot * 0.74) / all.length;
      return l.values
        .map((v, i) => {
          if (v === null) return "";
          const left = i * slot + slot * 0.13 + k * width;
          const y0 = y(Math.max(v, 0));
          const h = Math.abs(y(v) - y(0));
          return `<rect class="mc-bar ${l.cls}${v < 0 ? " mc-neg" : ""}" x="${left.toFixed(2)}" y="${y0.toFixed(1)}" width="${width.toFixed(2)}" height="${Math.max(h, 1).toFixed(1)}"></rect>`;
        })
        .join("");
    })
    .join("");
  const lines = spec.lines
    .filter((l) => !l.bars)
    .map((l) => {
      const segments: string[][] = [[]];
      l.values.forEach((v, i) => {
        if (v === null) {
          if ((segments[segments.length - 1] as string[]).length) segments.push([]);
          return;
        }
        (segments[segments.length - 1] as string[]).push(`${cx(i).toFixed(1)},${y(v).toFixed(1)}`);
      });
      return segments
        .filter((s) => s.length > 1)
        .map(
          (s) =>
            `<polyline class="mc-line ${l.cls}${l.dashed ? " mc-dashed" : ""}" points="${s.join(" ")}"></polyline>`,
        )
        .join("");
    })
    .join("");

  // A label on each year's first slot (every other year over a long span); over two years or less,
  // each quarter's too. The last stops at its mark and the first starts at it, so neither overflows.
  const years = (spec.slots[n - 1] as number) - (spec.slots[0] as number) > 2.2 * 365 * DAY_MS;
  const every =
    (spec.slots[n - 1] as number) - (spec.slots[0] as number) > 7 * 365 * DAY_MS ? 2 : 1;
  const xLabels: string[] = [];
  let lastMonth = -1;
  spec.slots.forEach((ms, i) => {
    const d = new Date(ms);
    const m = d.getUTCMonth();
    const quarterStart = m % 3 === 0;
    const newPeriod = spec.grain === "w" ? m !== lastMonth : true;
    lastMonth = m;
    if (!newPeriod) return;
    const yearStart = m === 0 && (spec.grain !== "w" || d.getUTCDate() <= 7);
    if (yearStart && d.getUTCFullYear() % every === 0) {
      xLabels.push(`${i}|${d.getUTCFullYear()}`);
    } else if (!years && quarterStart && (spec.grain !== "w" || d.getUTCDate() <= 7)) {
      xLabels.push(`${i}|${spec.grain === "q" ? `Q${m / 3 + 1}` : monthName(m)}`);
    }
  });
  const xMarkup = xLabels
    .map((entry, k) => {
      const [i, text] = entry.split("|") as [string, string];
      const left = cx(Number(i)) / 10;
      const edge = left > 94 ? " gx-x-end" : left < 5 ? " mc-x-start" : "";
      return `<span class="cvd-x${edge}${k % 2 ? " x-alt" : ""}" style="left:${left.toFixed(2)}%">${esc(text)}</span>`;
    })
    .join("");

  const payload: MacroSlots = {
    kind: "macro",
    g: spec.grain,
    slots: spec.slots,
    lines: spec.lines.map((l) => ({
      l: l.label,
      v: l.values.map((v) => (v === null ? null : Number(v.toPrecision(8)))),
      u: l.unit,
      d: l.digits,
      s: l.signed ?? false,
    })),
  };
  // The latest slot any line has a value in reads before the pointer does.
  let latest = n - 1;
  while (
    latest > 0 &&
    spec.lines.every((l) => l.values[latest] === null || l.values[latest] === undefined)
  )
    latest--;
  const idle = `${macroText(payload, latest, SLOT_FORMAT)} · <span class="dim">${tr("hover or tap the chart to read any point")}</span>`;
  const axes = esc(
    JSON.stringify({
      l:
        spec.axisKind === "usd"
          ? ["amount", bottom, top, "$"]
          : ["num", bottom, top, spec.axisKind.suffix, spec.axisKind.digits],
    }),
  );
  const keys = spec.lines
    .map(
      (l) =>
        `<span><i class="mc-key ${l.cls}${l.bars ? " mc-key-bar" : ""}${l.dashed ? " mc-key-dash" : ""}"></i>${esc(l.label)}</span>`,
    )
    .join("");
  return `<figure class="fchart cvd-chart mc-chart" data-cursors>
<div class="fchart-head"><p class="fchart-title">${esc(spec.title)}</p><div class="fchart-keys">${keys}${slotCursorSwitch()}</div><p class="fchart-read slot-read" aria-live="polite">${idle}</p></div>
<div class="slot-area" tabindex="0" role="group" aria-label="${esc(tr("{chart}; arrow keys read one point at a time", { chart: spec.title }))}">
<div class="fchart-plot mc-plot" data-axes="${axes}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(spec.title)}">${grid}${SLOT_BAND}${zero}${refLines}${bars}${lines}${SLOT_CURSOR}${SLOT_HAIR}</svg>${yLabels}${refLabels}${xMarkup}</div>
</div>
${spec.note ? `<p class="fchart-note dim">${spec.note}</p>` : ""}
${slotData(payload)}
</figure>`;
}

/** An inline trend line for a table cell: the values, oldest first, and a zero line where they cross it. */
function sparkline(values: readonly number[]): string {
  if (values.length < 2) return "";
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 0);
  const span = hi - lo || 1;
  const y = (v: number) => (((hi - v) / span) * 18 + 1).toFixed(1);
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${y(v)}`)
    .join(" ");
  const zero =
    lo < 0 && hi > 0
      ? `<line class="cvd-zero" x1="0" x2="100" y1="${y(0)}" y2="${y(0)}"></line>`
      : "";
  return `<svg class="mc-spark" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">${zero}<polyline class="mc-line mc-a" points="${points}"></polyline></svg>`;
}

// ---- Tiles, releases and odds ----

interface Tile {
  eyebrow: string;
  big: string;
  dim: string;
  cls?: string;
}

const tiles = (panel: MacroPanel, list: readonly Tile[]) =>
  `<div class="cvd-tiles mc-tiles" data-live="macro-tiles-${panel}">${list
    .map(
      (t) =>
        `<div class="cvd-tile"><p class="eyebrow">${t.eyebrow}</p><p class="cvd-big${t.cls ? ` ${t.cls}` : ""}">${t.big}</p><p class="dim">${t.dim}</p></div>`,
    )
    .join("")}</div>`;

const releaseName = (key: string): string =>
  ({
    cpi: tr("CPI"),
    pce: tr("PCE prices"),
    jobs: tr("Jobs report"),
    claims: tr("Jobless claims"),
    jolts: tr("Job openings (JOLTS)"),
    gdp: tr("GDP"),
    retail: tr("Retail sales"),
    indpro: tr("Industrial production"),
    fomc: tr("FOMC decision"),
  })[key] ?? esc(key);

const nextRelease = (releases: readonly MacroRelease[], key: string, now: number) =>
  releases.find((r) => r.release === key && r.at.getTime() > now) ?? null;

/** The tab's coming releases, soonest first, each in the reader's own time. */
function calendar(releases: readonly MacroRelease[], keys: readonly string[], now: number): string {
  const next = keys
    .map((key) => nextRelease(releases, key, now))
    .filter((r): r is MacroRelease => r !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (next.length === 0) return "";
  return `<p class="mc-cal"><span class="eyebrow">${tr("Coming up")}</span>${next
    .map(
      (r) =>
        `<span class="mc-cal-item"><b>${releaseName(r.release)}</b> ${timeTag(r.at.getTime(), "when")} <span class="dim">${inText(r.at.getTime(), now)}</span></span>`,
    )
    .join("")}</p>`;
}

/**
 * A threshold event's ladder ("above 0.2%", "above 0.3%"), its prices made to fall as the strike
 * rises (a quote can be stale on one rung), and the market's middle: where the chance of "above"
 * crosses one half, by straight-line interpolation between the two rungs either side.
 */
export function ladder(odds: readonly MacroOdds[]): {
  rungs: { strike: number; p: number }[];
  middle: number | null;
  below: boolean;
  above: boolean;
} {
  const sorted = odds
    .filter((o) => o.strike !== null)
    .map((o) => ({ strike: o.strike as number, p: o.probability }))
    .sort((a, b) => a.strike - b.strike);
  let held = 1;
  const rungs = sorted.map((r) => {
    held = Math.min(held, r.p);
    return { strike: r.strike, p: held };
  });
  if (rungs.length === 0) return { rungs, middle: null, below: false, above: false };
  const first = rungs[0] as { strike: number; p: number };
  const last = rungs[rungs.length - 1] as { strike: number; p: number };
  if (first.p < 0.5) return { rungs, middle: first.strike, below: true, above: false };
  if (last.p >= 0.5) return { rungs, middle: last.strike, below: false, above: true };
  for (let i = 1; i < rungs.length; i++) {
    const a = rungs[i - 1] as { strike: number; p: number };
    const b = rungs[i] as { strike: number; p: number };
    if (b.p < 0.5) {
      const t = a.p === b.p ? 0.5 : (a.p - 0.5) / (a.p - b.p);
      return { rungs, middle: a.strike + t * (b.strike - a.strike), below: false, above: false };
    }
  }
  return { rungs, middle: null, below: false, above: false };
}

/** Each event of a series, soonest first, with its markets. */
function events(
  odds: readonly MacroOdds[],
  series: string,
): { event: string; period: string; closes: Date; markets: MacroOdds[] }[] {
  const out = new Map<
    string,
    { event: string; period: string; closes: Date; markets: MacroOdds[] }
  >();
  for (const o of odds) {
    if (o.series !== series) continue;
    let e = out.get(o.event);
    if (!e) {
      e = { event: o.event, period: o.period, closes: o.closes_at, markets: [] };
      out.set(o.event, e);
    }
    e.markets.push(o);
  }
  return [...out.values()].sort((a, b) => a.closes.getTime() - b.closes.getTime());
}

/** What a period ("2026-10", "2026-Q3") reads as. */
function periodLabel(period: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(period);
  if (q) return tr("Q{q} {year}", { q: q[2] as string, year: q[1] as string });
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return tr("{month} {year}", { month: monthName(Number(m[2]) - 1), year: m[1] as string });
  return esc(period);
}

/**
 * The market's middle estimate for the next print of a series, as text ("+0.24%"), or null when the
 * series has no open event. `show` formats a strike.
 */
function expectation(
  odds: readonly MacroOdds[],
  series: string,
  show: (v: number) => string,
): { text: string; period: string; closes: Date } | null {
  const next = events(odds, series)[0];
  if (!next) return null;
  const l = ladder(next.markets);
  if (l.middle === null) return null;
  const text = l.below
    ? tr("below {value}", { value: show(l.middle) })
    : l.above
      ? tr("above {value}", { value: show(l.middle) })
      : show(l.middle);
  return { text, period: next.period, closes: next.closes };
}

/** A ladder as a small table: the rungs either side of the middle, each with its chance as a bar. */
function ladderTable(
  odds: readonly MacroOdds[],
  series: string,
  title: string,
  show: (v: number) => string,
): string {
  const next = events(odds, series)[0];
  if (!next) return "";
  const l = ladder(next.markets);
  if (l.rungs.length === 0) return "";
  // Six rungs around the middle: the ones a reader would bet between.
  const mid = l.rungs.findIndex((r) => r.p < 0.5);
  const centre = mid < 0 ? l.rungs.length - 1 : mid;
  const from = Math.max(0, Math.min(centre - 3, l.rungs.length - 6));
  const rows = l.rungs
    .slice(from, from + 6)
    .map(
      (r) =>
        `<tr><td>${tr("above {value}", { value: show(r.strike) })}</td><td class="num">${Math.round(r.p * 100)}%</td><td class="mc-bar-cell"><span class="mc-p" style="width:${(r.p * 100).toFixed(1)}%"></span></td></tr>`,
    )
    .join("");
  const middle =
    l.middle === null
      ? ""
      : `<p class="dim mc-mid">${tr("middle estimate {value}", {
          value: `<b>${l.below ? tr("below {value}", { value: show(l.middle) }) : l.above ? tr("above {value}", { value: show(l.middle) }) : show(l.middle)}</b>`,
        })}</p>`;
  return `<div class="mc-ladder"><p class="mc-ladder-t">${title} <span class="dim">${periodLabel(next.period)}</span></p>${middle}<table class="sheet mc-odds-table"><tbody>${rows}</tbody></table></div>`;
}

/** The latest time any of the tab's series was read, and how long ago, for its footnote. */
function readNote(data: MacroData, ids: readonly string[], now: number, sources: string): string {
  const times = ids.map((id) => data.readAt[id]?.getTime() ?? 0).filter((t) => t > 0);
  if (times.length === 0) return `<p class="notes">${sources}</p>`;
  const latest = new Date(Math.max(...times));
  const stale =
    now - latest.getTime() > 6 * 3_600_000
      ? `<p class="notes gx-stale">${tr("Not updated since {ago}: the latest reads of these sources failed, so the figures are that old.", { ago: since(latest, now) })}</p>`
      : "";
  return `${stale}<p class="notes">${tr("{sources} Last read {ago}.", { sources, ago: since(latest, now) })}</p>`;
}

const help = (panel: MacroPanel, paragraphs: readonly string[]) =>
  helpPanel(`rates-${panel}`, paragraphs.map((p) => `<p>${p}</p>`).join(""));

const head = (panel: MacroPanel, title: string) =>
  `<div class="lq-controls mc-head"><h2 class="cvd-h2">${title}</h2>${helpButton(`rates-${panel}`)}</div>`;

const h3 = (text: string) => `<h3 class="cvd-h2 wm-h2">${text}</h3>`;

const empty = (text: string) => `<p class="empty">${text}</p>`;

// ---- Inflation ----

function inflation(data: MacroData, now: number): string {
  const cpi = byMonth(data.series.CPIAUCSL);
  const core = byMonth(data.series.CPILFESL);
  const pce = byMonth(data.series.PCEPI);
  const corePce = byMonth(data.series.PCEPILFE);
  if (cpi.size < 13) return empty(tr("No inflation figures have been read yet."));
  const last = lastKey(cpi);
  const pceLast = pce.size ? lastKey(pce) : last;
  const cpiYoY = change(cpi, last, 12);
  const coreYoY = change(core, last, 12);
  const corePceYoY = change(corePce, pceLast, 12);
  const be5 = lastOf(data.series.T5YIE);
  const fwd = lastOf(data.series.T5YIFR);
  const next = nextRelease(data.releases, "cpi", now);
  const showPct = (v: number) => spct(v, 2);
  const headline = expectation(data.odds, "KXCPI", showPct);
  const coreExp = expectation(data.odds, "KXCPICORE", showPct);
  const list: Tile[] = [
    {
      eyebrow: tr("CPI, year on year"),
      big: cpiYoY === null ? "–" : pct(cpiYoY),
      dim: tr("{month}: {mom} on the month · core {core}", {
        month: monthLabel(keyMs(last)),
        mom: spct(change(cpi, last, 1) ?? 0, 1),
        core: coreYoY === null ? "–" : pct(coreYoY),
      }),
    },
    {
      eyebrow: tr("Core PCE, year on year"),
      big: corePceYoY === null ? "–" : pct(corePceYoY),
      dim: tr("{month} · the measure the Fed's 2% target is set in", {
        month: monthLabel(keyMs(pceLast)),
      }),
    },
    {
      eyebrow: tr("Next CPI"),
      big: next ? dayLabel(next.at.getTime()) : "–",
      dim: next
        ? `${timeTag(next.at.getTime(), "when")}${
            headline
              ? ` · ${tr("Kalshi: {headline} on the month, core {core}", { headline: headline.text, core: coreExp?.text ?? "–" })}`
              : ""
          }`
        : tr("no date published yet"),
    },
    {
      eyebrow: tr("5-year breakeven"),
      big: be5 ? pct(be5[1], 2) : "–",
      dim: tr("the inflation Treasuries price in · 5y5y forward {fwd}", {
        fwd: fwd ? pct(fwd[1], 2) : "–",
      }),
    },
  ];

  const from = monthKey(Date.UTC(2019, 0, 1));
  const keys = months(from, last);
  const yoyLine = (map: Map<number, number>, label: string, cls: string): Line => ({
    label,
    cls,
    values: keys.map((k) => change(map, k, 12)),
    unit: "%",
    digits: 1,
  });
  const yoyChart = chart({
    title: tr("Inflation, year on year"),
    grain: "m",
    slots: keys.map(keyMs),
    lines: [
      yoyLine(cpi, tr("CPI"), "mc-a"),
      yoyLine(core, tr("Core CPI"), "mc-b"),
      yoyLine(pce, tr("PCE"), "mc-c"),
      yoyLine(corePce, tr("Core PCE"), "mc-d"),
    ],
    refs: [{ value: 2, label: tr("Fed's 2% target") }],
    axis: (v, d) => pct(v, d),
    axisKind: { suffix: "%", digits: 1 },
  });

  const be = [byWeek(data.series.T5YIE), byWeek(data.series.T10YIE), byWeek(data.series.T5YIFR)];
  const beLast = be[0]?.size ? lastKey(be[0]) : now;
  const wk = weeks(now - 3 * 365 * DAY_MS, beLast);
  const beChart = chart({
    title: tr("Inflation the bond market prices in"),
    grain: "w",
    slots: wk,
    lines: [
      {
        label: tr("5-year breakeven"),
        cls: "mc-a",
        values: weekly(be[0] as Map<number, number>, wk),
        unit: "%",
        digits: 2,
      },
      {
        label: tr("10-year breakeven"),
        cls: "mc-b",
        values: weekly(be[1] as Map<number, number>, wk),
        unit: "%",
        digits: 2,
      },
      {
        label: tr("5y5y forward"),
        cls: "mc-c",
        values: weekly(be[2] as Map<number, number>, wk),
        unit: "%",
        digits: 2,
      },
    ],
    refs: [{ value: 2, label: tr("Fed's 2% target") }],
    axis: (v, d) => pct(v, d),
    axisKind: { suffix: "%", digits: 2 },
    note: tr(
      "Breakeven: the gap between a nominal Treasury's yield and an inflation-protected one's of the same term. Weekly, each week's last close.",
    ),
  });

  const row = (label: string, map: Map<number, number>) => {
    if (map.size < 13) return "";
    const k = lastKey(map);
    const cell = (v: number | null, signed = false) =>
      v === null
        ? `<td class="num">${dash}</td>`
        : `<td class="num">${signed ? spct(v, 1) : pct(v, 1)}</td>`;
    return `<tr><td>${label}</td><td>${monthLabel(keyMs(k))}</td>${cell(change(map, k, 1), true)}${cell(change(map, k, 3, true))}${cell(change(map, k, 6, true))}${cell(change(map, k, 12))}${cell(change(map, k - 12, 12))}</tr>`;
  };
  const table = `${h3(tr("Latest prints"))}<div class="sheet-wrap"><table class="sheet mc-table">
<thead><tr><th>${tr("Measure")}</th><th>${tr("Month")}</th><th class="num">${tr("On the month")}</th><th class="num">${tr("3 months, annualized")}</th><th class="num">${tr("6 months, annualized")}</th><th class="num">${tr("Year on year")}</th><th class="num">${tr("A year earlier")}</th></tr></thead>
<tbody>${row(tr("CPI"), cpi)}${row(tr("Core CPI"), core)}${row(tr("PCE"), pce)}${row(tr("Core PCE"), corePce)}</tbody></table></div>`;

  const ladders = [
    ladderTable(data.odds, "KXCPI", tr("CPI, on the month"), showPct),
    ladderTable(data.odds, "KXCPICORE", tr("Core CPI, on the month"), showPct),
    ladderTable(data.odds, "KXCPIYOY", tr("CPI, year on year"), (v) => pct(v, 1)),
  ].join("");

  return `${head("inflation", tr("Inflation"))}
${help("inflation", [
  tr(
    "CPI is the Bureau of Labor Statistics' consumer price index, published monthly; core leaves out food and energy. PCE is the Bureau of Economic Analysis' price index for personal consumption, published about two weeks after CPI; the Fed's 2% target is set in it, and core PCE is the figure it watches most.",
  ),
  tr(
    "The changes are worked out here from the seasonally adjusted indexes: on the month, over three and six months annualized (the recent pace, which the year-on-year figure is slow to show), and on the year.",
  ),
  tr(
    "The breakevens are the inflation the Treasury market prices in, from the Fed's daily yields: 5-year and 10-year, and the 5-year rate starting five years from now (5y5y), which the Fed reads as long-run expectations.",
  ),
  tr(
    "Kalshi, a CFTC-regulated exchange, lists contracts that pay if the next print is above a level. Their prices read as the market's chances; the middle estimate is where the chance of above crosses one half.",
  ),
])}
${tiles("inflation", list)}
${calendar(data.releases, ["cpi", "pce"], now)}
${yoyChart}
${ladders ? `${h3(tr("What Kalshi's traders expect"))}<div class="mc-ladders">${ladders}</div>` : ""}
${beChart}
${table}
${readNote(data, Object.keys(MACRO_NEEDS.inflation.series), now, tr("Sources: BLS and BEA through FRED; breakevens from the Fed's Treasury yields; odds from Kalshi."))}`;
}

// ---- Fed policy ----

/** A decision event's outcomes as the five buckets, and the move they imply on average, in basis points. */
function decision(markets: readonly MacroOdds[]): {
  buckets: number[];
  expected: number;
  likely: MacroOdds | null;
} {
  const order = [-50, -25, 0, 25, 50];
  const buckets = order.map((bps) => markets.find((m) => m.strike === bps)?.probability ?? 0);
  const expected = markets.reduce((sum, m) => sum + (m.strike ?? 0) * m.probability, 0);
  const likely = markets.reduce<MacroOdds | null>(
    (best, m) => (!best || m.probability > best.probability ? m : best),
    null,
  );
  return { buckets, expected, likely };
}

const decisionName = (bps: number): string =>
  bps <= -50
    ? tr("cut more than 25 bp")
    : bps === -25
      ? tr("cut 25 bp")
      : bps === 0
        ? tr("hold")
        : bps === 25
          ? tr("hike 25 bp")
          : tr("hike more than 25 bp");

function fed(data: MacroData, now: number): string {
  const upper = lastOf(data.series.DFEDTARU);
  const lower = lastOf(data.series.DFEDTARL);
  if (!upper || !lower) return empty(tr("No Fed policy figures have been read yet."));
  const mid = (upper[1] + lower[1]) / 2;
  const effr = lastOf(data.series.EFFR);
  const sofr = lastOf(data.series.SOFR);
  const iorb = lastOf(data.series.IORB);
  const meetings = data.releases.filter((r) => r.release === "fomc");
  const next = meetings.find((m) => m.at.getTime() > now) ?? null;
  const decisions = events(data.odds, "KXFEDDECISION");
  const walcl = data.series.WALCL;
  const sheet = lastOf(walcl);
  const sheet4w = backOf(walcl, 4);

  // The path: each meeting's expected move, added up from today's midpoint.
  let cumulative = 0;
  const path = decisions.map((e) => {
    const d = decision(e.markets);
    cumulative += d.expected;
    return { ...e, ...d, cumulative, rate: mid + cumulative / 100 };
  });
  const nextDecision =
    path.find((p) => next && Math.abs(p.closes.getTime() - next.at.getTime()) < 2 * DAY_MS) ??
    path[0] ??
    null;
  const end = path[path.length - 1];
  const list: Tile[] = [
    {
      eyebrow: tr("Target range"),
      big: `${pct(lower[1], 2)}–${pct(upper[1], 2)}`,
      dim: tr("effective {effr} · SOFR {sofr} · interest on reserves {iorb}", {
        effr: effr ? pct(effr[1], 2) : "–",
        sofr: sofr ? pct(sofr[1], 2) : "–",
        iorb: iorb ? pct(iorb[1], 2) : "–",
      }),
    },
    {
      eyebrow: tr("Next FOMC decision"),
      big: next ? dayLabel(next.at.getTime()) : "–",
      dim: next
        ? `${timeTag(next.at.getTime(), "when")}${next.projections ? ` · ${tr("with projections")}` : ""}${
            nextDecision?.likely
              ? ` · ${tr("Kalshi: {outcome} {p}", { outcome: decisionName(nextDecision.likely.strike ?? 0), p: `${Math.round(nextDecision.likely.probability * 100)}%` })}`
              : ""
          }`
        : tr("no date published yet"),
    },
    {
      eyebrow: tr("Rate path the market prices"),
      big: end ? pct(end.rate, 2) : "–",
      dim: end
        ? tr("midpoint after {meeting}: {move} from today's {mid}", {
            meeting: monthLabel(end.closes.getTime()),
            move: bp(end.cumulative),
            mid: pct(mid, 3),
          })
        : tr("no Kalshi odds read yet"),
      cls: end ? tone(end.cumulative) : "",
    },
    {
      eyebrow: tr("Fed balance sheet"),
      big: sheet ? formatUsd(sheet[1] * 1e6) : "–",
      dim:
        sheet && sheet4w !== null
          ? tr("{change} over four weeks · week of {date}", {
              change: `${sheet[1] >= sheet4w ? "+" : MINUS}${formatUsd(Math.abs(sheet[1] - sheet4w) * 1e6)}`,
              date: dayLabel(sheet[0]),
            })
          : "",
    },
  ];

  const oddsRows = path
    .map((p) => {
      const meeting = meetings.find(
        (m) => Math.abs(m.at.getTime() - p.closes.getTime()) < 2 * DAY_MS,
      );
      const cells = p.buckets
        .map(
          (b) =>
            `<td class="num${b >= 0.5 ? " mc-hi" : ""}">${b >= 0.005 ? `${Math.round(b * 100)}%` : `<span class="dim">0%</span>`}</td>`,
        )
        .join("");
      const bar = p.buckets
        .map((b, i) =>
          b > 0
            ? `<span class="mc-dec mc-dec-${i}" style="width:${(b * 100).toFixed(1)}%"></span>`
            : "",
        )
        .join("");
      return `<tr><td>${dateLabel((meeting?.at ?? p.closes).getTime())}${meeting?.projections ? ` <span class="mc-tag" title="${esc(tr("A meeting with a Summary of Economic Projections"))}">${tr("SEP")}</span>` : ""}</td>${cells}<td class="mc-bar-cell"><span class="mc-stack">${bar}</span></td><td class="num ${tone(p.expected)}">${bp(p.expected)}</td><td class="num ${tone(p.cumulative)}">${pct(p.rate, 2)}</td></tr>`;
    })
    .join("");
  const oddsTable = path.length
    ? `${h3(tr("Each meeting's odds, from Kalshi"))}<div class="sheet-wrap"><table class="sheet mc-table mc-fed">
<thead><tr><th>${tr("Meeting")}</th><th class="num">${tr("Cut &gt;25")}</th><th class="num">${tr("Cut 25")}</th><th class="num">${tr("Hold")}</th><th class="num">${tr("Hike 25")}</th><th class="num">${tr("Hike &gt;25")}</th><th></th><th class="num" title="${esc(tr("Each outcome's move times its chance, added up"))}">${tr("Expected move")}</th><th class="num" title="${esc(tr("Today's midpoint plus every expected move to this meeting"))}">${tr("Implied midpoint")}</th></tr></thead>
<tbody data-live="macro-fed-odds">${oddsRows}</tbody></table></div>`
    : "";

  // The committee's own medians, from its latest Summary of Economic Projections.
  const sepDate = lastOf(data.series.FEDTARMDLR);
  const sepRow = (label: string, id: string) => {
    const pts = data.series[id] ?? [];
    if (pts.length === 0) return "";
    return `<tr><td>${label}</td>${pts.map(([, v]) => `<td class="num">${pct(v, 1)}</td>`).join("")}${id === "FEDTARMD" ? `<td class="num">${sepDate ? pct(sepDate[1], 1) : dash}</td>` : `<td class="num">${dash}</td>`}</tr>`;
  };
  const sepYears = (data.series.FEDTARMD ?? []).map(([ms]) => new Date(ms).getUTCFullYear());
  const sep =
    sepYears.length && sepDate
      ? `${h3(tr("The Fed's own projections"))}<div class="sheet-wrap"><table class="sheet mc-table">
<thead><tr><th>${tr("Median, end of year")}</th>${sepYears.map((y) => `<th class="num">${y}</th>`).join("")}<th class="num">${tr("Longer run")}</th></tr></thead>
<tbody>${sepRow(tr("Fed funds rate"), "FEDTARMD")}${sepRow(tr("PCE inflation"), "PCECTPIMD")}${sepRow(tr("Core PCE inflation"), "JCXFEMD")}${sepRow(tr("Unemployment rate"), "UNRATEMD")}${sepRow(tr("Real GDP growth"), "GDPC1MD")}</tbody></table></div>
<p class="notes">${tr("From the Summary of Economic Projections of {date}: the median of the committee's forecasts (the dot plot's middle dot for the rate). Inflation and growth are fourth quarter on fourth quarter; unemployment is the fourth quarter's average.", { date: dateLabel(sepDate[0]) })}</p>`
      : "";

  const wk = weeks(Date.UTC(2021, 0, 4), now);
  const rateChart = chart({
    title: tr("Policy rate"),
    grain: "w",
    slots: wk,
    lines: [
      {
        label: tr("Top of the range"),
        cls: "mc-b",
        values: weekly(byWeek(data.series.DFEDTARU), wk),
        unit: "%",
        digits: 2,
      },
      {
        label: tr("Bottom of the range"),
        cls: "mc-b",
        dashed: true,
        values: weekly(byWeek(data.series.DFEDTARL), wk),
        unit: "%",
        digits: 2,
      },
      {
        label: tr("Effective rate"),
        cls: "mc-a",
        values: weekly(byWeek(data.series.EFFR), wk),
        unit: "%",
        digits: 2,
      },
    ],
    axis: (v, d) => pct(v, d),
    axisKind: { suffix: "%", digits: 2 },
  });
  const bsChart = chart({
    title: tr("Fed balance sheet, total assets"),
    grain: "w",
    slots: wk,
    lines: [
      {
        label: tr("Total assets"),
        cls: "mc-c",
        values: weekly(byWeek(walcl), wk).map((v) => (v === null ? null : v * 1e6)),
        unit: "$",
        digits: 0,
      },
    ],
    axis: (v) => formatUsd(v),
    axisKind: "usd",
  });

  return `${head("fed", tr("Fed policy"))}
${help("fed", [
  tr(
    "The target range is the Federal Open Market Committee's range for the federal funds rate; the effective rate is where overnight fed funds actually trade, SOFR is the overnight Treasury repo rate, and interest on reserves is what the Fed pays banks, which holds the effective rate inside the range.",
  ),
  tr(
    "The odds are Kalshi's: for each meeting, contracts that pay on a cut of more than 25 basis points, a 25 bp cut, a hold, a 25 bp hike or a larger hike. Each meeting's prices are scaled to add up to 100%. The expected move is each outcome's size times its chance; the implied midpoint adds every expected move from today's midpoint, a path in the way CME's FedWatch draws one from fed funds futures.",
  ),
  tr(
    "The projections are the committee's own, published four times a year with the meeting's statement; the dot plot is each member's view of where the rate should be at the end of each year.",
  ),
  tr(
    "The balance sheet is the Fed's total assets, weekly, as of Wednesday. It grows when the Fed buys bonds and shrinks as they run off.",
  ),
])}
${tiles("fed", list)}
${calendar(data.releases, ["fomc"], now)}
${oddsTable}
${rateChart}
${sep}
${bsChart}
${readNote(data, Object.keys(MACRO_NEEDS.fed.series), now, tr("Sources: the Federal Reserve and the New York Fed through FRED; the FOMC calendar from the Federal Reserve; odds from Kalshi."))}`;
}

// ---- Employment ----

function jobs(data: MacroData, now: number): string {
  const pay = byMonth(data.series.PAYEMS);
  const unrate = byMonth(data.series.UNRATE);
  if (pay.size < 4 || unrate.size < 2)
    return empty(tr("No employment figures have been read yet."));
  const last = lastKey(pay);
  const diff = (k: number) => {
    const a = pay.get(k);
    const b = pay.get(k - 1);
    return a === undefined || b === undefined ? null : a - b;
  };
  const avg3 = (k: number) => {
    const d = [diff(k), diff(k - 1), diff(k - 2)];
    return d.some((v) => v === null) ? null : (d as number[]).reduce((s, v) => s + v, 0) / 3;
  };
  const uLast = lastKey(unrate);
  const sahm = lastOf(data.series.SAHMREALTIME);
  const claims = data.series.ICSA;
  const claim = lastOf(claims);
  const claims4 =
    claims && claims.length >= 4 ? claims.slice(-4).reduce((s, [, v]) => s + v, 0) / 4 : null;
  const continuing = lastOf(data.series.CCSA);
  const next = nextRelease(data.releases, "jobs", now);
  const payExp = expectation(data.odds, "KXPAYROLLS", (v) => kSigned(v / 1000));
  const uExp = expectation(data.odds, "KXU3", (v) => pct(v, 1));
  const lastDiff = diff(last);
  const list: Tile[] = [
    {
      eyebrow: tr("Payrolls, {month}", { month: monthLabel(keyMs(last)) }),
      big: lastDiff === null ? "–" : kSigned(lastDiff),
      dim: tr("jobs added on the month · three-month average {avg}", {
        avg: avg3(last) === null ? "–" : kSigned(avg3(last) as number),
      }),
      cls: lastDiff === null ? "" : tone(lastDiff),
    },
    {
      eyebrow: tr("Unemployment rate"),
      big: pct(unrate.get(uLast) as number, 1),
      dim: tr("{month} · Sahm rule {sahm} (a recession signal from 0.50)", {
        month: monthLabel(keyMs(uLast)),
        sahm: sahm ? pp(sahm[1], 2) : "–",
      }),
    },
    {
      eyebrow: tr("Initial jobless claims"),
      big: claim ? `${Math.round(claim[1] / 1000)}k` : "–",
      dim: tr("week to {date} · four-week average {avg} · continuing {cont}", {
        date: claim ? dayLabel(claim[0] + 6 * DAY_MS) : "–",
        avg: claims4 === null ? "–" : `${Math.round(claims4 / 1000)}k`,
        cont: continuing ? `${(continuing[1] / 1e6).toFixed(2)}M` : "–",
      }),
    },
    {
      eyebrow: tr("Next jobs report"),
      big: next ? dayLabel(next.at.getTime()) : "–",
      dim: next
        ? `${timeTag(next.at.getTime(), "when")}${
            payExp
              ? ` · ${tr("Kalshi: payrolls {pay}, unemployment {u}", { pay: payExp.text, u: uExp?.text ?? "–" })}`
              : ""
          }`
        : tr("no date published yet"),
    },
  ];

  const keys = months(monthKey(Date.UTC(2023, 0, 1)), last);
  const payChart = chart({
    title: tr("Jobs added each month"),
    grain: "m",
    slots: keys.map(keyMs),
    lines: [
      {
        label: tr("Payrolls, change on the month"),
        cls: "mc-a",
        bars: true,
        values: keys.map(diff),
        unit: "k",
        digits: 0,
        signed: true,
      },
      {
        label: tr("Three-month average"),
        cls: "mc-c",
        values: keys.map(avg3),
        unit: "k",
        digits: 0,
        signed: true,
      },
    ],
    axis: (v, d) => fig(v, d, "k", true),
    axisKind: { suffix: "k", digits: 0 },
    note: tr(
      "Nonfarm payrolls, thousands, seasonally adjusted. The latest two months are revised with each report.",
    ),
  });
  const uKeys = months(monthKey(Date.UTC(2022, 0, 1)), uLast);
  const uChart = chart({
    title: tr("Unemployment rate"),
    grain: "m",
    slots: uKeys.map(keyMs),
    lines: [
      {
        label: tr("Unemployment rate"),
        cls: "mc-b",
        values: uKeys.map((k) => unrate.get(k) ?? null),
        unit: "%",
        digits: 1,
      },
    ],
    axis: (v, d) => pct(v, d),
    axisKind: { suffix: "%", digits: 2 },
    note: tr(
      "The Sahm rule is the three-month average unemployment rate less its low of the past twelve months, in percentage points; every US recession since 1970 began with it at 0.50 or more. A gap is a month with no household survey.",
    ),
  });
  const cw = weeks(now - 3 * 365 * DAY_MS, claim ? claim[0] : now);
  const cMap = byWeek(claims);
  const cValues = weekly(cMap, cw, false);
  const cAvg = cValues.map((_, i) => {
    const four = cValues.slice(Math.max(0, i - 3), i + 1);
    return four.length === 4 && four.every((v) => v !== null)
      ? (four as number[]).reduce((s, v) => s + v, 0) / 4
      : null;
  });
  const claimsChart = chart({
    title: tr("Initial jobless claims"),
    grain: "w",
    slots: cw,
    lines: [
      {
        label: tr("Initial claims"),
        cls: "mc-a",
        values: cValues.map((v) => (v === null ? null : v / 1000)),
        unit: "k",
        digits: 0,
      },
      {
        label: tr("Four-week average"),
        cls: "mc-c",
        values: cAvg.map((v) => (v === null ? null : v / 1000)),
        unit: "k",
        digits: 0,
      },
    ],
    axis: (v, d) => `${fig(v, d)}k`,
    axisKind: { suffix: "k", digits: 0 },
  });

  const wages = byMonth(data.series.CES0500000003);
  const wLast = wages.size ? lastKey(wages) : null;
  const openings = lastOf(data.series.JTSJOL);
  const openingsYear = backOf(data.series.JTSJOL, 12);
  const row = (label: string, value: string, note: string) =>
    `<tr><td>${label}</td><td class="num">${value}</td><td class="dim">${note}</td></tr>`;
  const table = `${h3(tr("Latest figures"))}<div class="sheet-wrap"><table class="sheet mc-table">
<thead><tr><th>${tr("Measure")}</th><th class="num">${tr("Latest")}</th><th>${tr("Context")}</th></tr></thead><tbody>
${row(tr("Average hourly earnings"), wLast === null ? dash : spct(change(wages, wLast, 12) ?? 0, 1), wLast === null ? "" : tr("{month}, year on year · {mom} on the month", { month: monthLabel(keyMs(wLast)), mom: spct(change(wages, wLast, 1) ?? 0, 1) }))}
${row(tr("Job openings"), openings ? `${(openings[1] / 1000).toFixed(2)}M` : dash, openings ? tr("{month} · {before} a year earlier", { month: monthLabel(openings[0]), before: openingsYear === null ? "–" : `${(openingsYear / 1000).toFixed(2)}M` }) : "")}
${row(tr("Continuing claims"), continuing ? `${(continuing[1] / 1e6).toFixed(2)}M` : dash, continuing ? tr("week to {date}", { date: dayLabel(continuing[0] + 6 * DAY_MS) }) : "")}
</tbody></table></div>`;
  const ladders = [
    ladderTable(data.odds, "KXPAYROLLS", tr("Payrolls"), (v) => kSigned(v / 1000)),
    ladderTable(data.odds, "KXU3", tr("Unemployment rate"), (v) => pct(v, 1)),
  ].join("");

  return `${head("jobs", tr("Employment"))}
${help("jobs", [
  tr(
    "Payrolls and the unemployment rate come from the Bureau of Labor Statistics' monthly jobs report, usually the first Friday of the month: payrolls from a survey of employers, unemployment from a survey of households. Jobless claims are the Labor Department's weekly count of new filings for unemployment insurance, the most timely read on layoffs.",
  ),
  tr(
    "Job openings are from the JOLTS survey, a month behind the jobs report. Average hourly earnings are private employers' pay, a gauge of wage inflation.",
  ),
  tr(
    "The odds are Kalshi's contracts on the next report's payrolls and unemployment rate; the middle estimate is where the chance of above crosses one half.",
  ),
])}
${tiles("jobs", list)}
${calendar(data.releases, ["jobs", "claims", "jolts"], now)}
${payChart}
${ladders ? `${h3(tr("What Kalshi's traders expect"))}<div class="mc-ladders">${ladders}</div>` : ""}
${uChart}
${claimsChart}
${table}
${readNote(data, Object.keys(MACRO_NEEDS.jobs.series), now, tr("Sources: BLS and the Labor Department through FRED; odds from Kalshi."))}`;
}

// ---- Growth ----

function growth(data: MacroData, now: number): string {
  const gdp = data.series.A191RL1Q225SBEA ?? [];
  if (gdp.length === 0) return empty(tr("No growth figures have been read yet."));
  const gdpLast = gdp[gdp.length - 1] as MacroPoint;
  const now_ = lastOf(data.series.GDPNOW);
  // GDPNow is the quarter GDP has not yet been published for.
  const nowcast = now_ && now_[0] > gdpLast[0] ? now_ : null;
  const ip = byMonth(data.series.INDPRO);
  const retail = byMonth(data.series.RSAFS);
  const ipLast = ip.size ? lastKey(ip) : null;
  const rLast = retail.size ? lastKey(retail) : null;
  const next = nextRelease(data.releases, "gdp", now);
  const gdpExp = expectation(data.odds, "KXGDP", (v) => pct(v, 1));
  const recession = lastOf(data.series.RECPROUSM156N);
  const list: Tile[] = [
    {
      eyebrow: tr("Real GDP, {quarter}", { quarter: quarterLabel(gdpLast[0]) }),
      big: spct(gdpLast[1], 1),
      dim: tr("on the quarter, annualized · recession probability {p}", {
        p: recession ? pct(recession[1], 1) : "–",
      }),
      cls: tone(gdpLast[1], 1),
    },
    {
      eyebrow: tr("GDPNow, {quarter}", { quarter: nowcast ? quarterLabel(nowcast[0]) : "–" }),
      big: nowcast ? spct(nowcast[1], 1) : "–",
      dim: tr("the Atlanta Fed's running estimate of the quarter not yet published"),
    },
    {
      eyebrow: tr("Industrial production"),
      big: ipLast === null ? "–" : spct(change(ip, ipLast, 12) ?? 0, 1),
      dim:
        ipLast === null
          ? ""
          : tr("{month}, year on year · {mom} on the month", {
              month: monthLabel(keyMs(ipLast)),
              mom: spct(change(ip, ipLast, 1) ?? 0, 1),
            }),
    },
    {
      eyebrow: tr("Next GDP estimate"),
      big: next ? dayLabel(next.at.getTime()) : "–",
      dim: next
        ? `${timeTag(next.at.getTime(), "when")}${gdpExp ? ` · ${tr("Kalshi: {value} for {quarter}", { value: gdpExp.text, quarter: periodLabel(gdpExp.period) })}` : ""}`
        : tr("no date published yet"),
    },
  ];

  const quarterKey = (ms: number) => Math.floor(monthKey(ms) / 3);
  const qFrom = quarterKey(Date.UTC(2022, 0, 1));
  const qTo = Math.max(quarterKey(gdpLast[0]), nowcast ? quarterKey(nowcast[0]) : 0);
  const qKeys = Array.from({ length: qTo - qFrom + 1 }, (_, i) => qFrom + i);
  const gdpMap = new Map(gdp.map(([ms, v]) => [quarterKey(ms), v]));
  const gdpChart = chart({
    title: tr("Real GDP growth, annualized"),
    grain: "q",
    slots: qKeys.map((q) => keyMs(q * 3)),
    lines: [
      {
        label: tr("Real GDP"),
        cls: "mc-a",
        bars: true,
        values: qKeys.map((q) => gdpMap.get(q) ?? null),
        unit: "%",
        digits: 1,
        signed: true,
      },
      {
        label: tr("GDPNow estimate"),
        cls: "mc-e",
        bars: true,
        values: qKeys.map((q) => (nowcast && q === quarterKey(nowcast[0]) ? nowcast[1] : null)),
        unit: "%",
        digits: 1,
        signed: true,
      },
    ],
    axis: (v, d) => pct(v, d),
    axisKind: { suffix: "%", digits: 1 },
    note: tr(
      "Quarter on quarter at an annual rate, as the Bureau of Economic Analysis publishes it; the latest figure is revised twice.",
    ),
  });
  const mFrom = monthKey(Date.UTC(2023, 0, 1));
  const mKeys = months(mFrom, Math.max(ipLast ?? 0, rLast ?? 0));
  const activityChart = chart({
    title: tr("Activity, year on year"),
    grain: "m",
    slots: mKeys.map(keyMs),
    lines: [
      {
        label: tr("Industrial production"),
        cls: "mc-b",
        values: mKeys.map((k) => change(ip, k, 12)),
        unit: "%",
        digits: 1,
        signed: true,
      },
      {
        label: tr("Retail sales"),
        cls: "mc-c",
        values: mKeys.map((k) => change(retail, k, 12)),
        unit: "%",
        digits: 1,
        signed: true,
      },
    ],
    axis: (v, d) => pct(v, d),
    axisKind: { suffix: "%", digits: 1 },
    note: tr(
      "Retail sales are in dollars, so they include price rises; industrial production is a volume index.",
    ),
  });
  const ladders = ladderTable(data.odds, "KXGDP", tr("Real GDP growth"), (v) => pct(v, 1));
  const retailRow =
    rLast === null
      ? ""
      : `<tr><td>${tr("Retail sales")}</td><td>${monthLabel(keyMs(rLast))}</td><td class="num">${spct(change(retail, rLast, 1) ?? 0, 1)}</td><td class="num">${spct(change(retail, rLast, 12) ?? 0, 1)}</td></tr>`;
  const ipRow =
    ipLast === null
      ? ""
      : `<tr><td>${tr("Industrial production")}</td><td>${monthLabel(keyMs(ipLast))}</td><td class="num">${spct(change(ip, ipLast, 1) ?? 0, 1)}</td><td class="num">${spct(change(ip, ipLast, 12) ?? 0, 1)}</td></tr>`;
  const table = `${h3(tr("Latest prints"))}<div class="sheet-wrap"><table class="sheet mc-table">
<thead><tr><th>${tr("Measure")}</th><th>${tr("Month")}</th><th class="num">${tr("On the month")}</th><th class="num">${tr("Year on year")}</th></tr></thead>
<tbody>${retailRow}${ipRow}</tbody></table></div>`;

  return `${head("growth", tr("Growth"))}
${help("growth", [
  tr(
    "Real GDP is the Bureau of Economic Analysis' measure of the economy's output after inflation, quarter on quarter at an annual rate. Each quarter is first estimated about a month after it ends and revised twice.",
  ),
  tr(
    "GDPNow is the Atlanta Fed's model estimate of the quarter not yet published, updated as each month's data come in; it is a model, not a forecast by the Fed.",
  ),
  tr(
    "Industrial production (the Fed's index of factory, mining and utility output) and retail sales (the Census Bureau's) are monthly. The recession probability is the Chauvet and Piger model's, from four monthly indicators, as FRED publishes it.",
  ),
  tr("The odds are Kalshi's contracts on the next GDP estimate."),
])}
${tiles("growth", list)}
${calendar(data.releases, ["gdp", "retail", "indpro"], now)}
${gdpChart}
${ladders ? `${h3(tr("What Kalshi's traders expect"))}<div class="mc-ladders">${ladders}</div>` : ""}
${activityChart}
${table}
${readNote(data, Object.keys(MACRO_NEEDS.growth.series), now, tr("Sources: BEA, the Federal Reserve, the Census Bureau and the Atlanta Fed through FRED; odds from Kalshi."))}`;
}

// ---- Policy signals ----

function signals(data: MacroData, now: number): string {
  const two = lastOf(data.series.DGS2);
  const effr = lastOf(data.series.EFFR);
  const s210 = lastOf(data.series.T10Y2Y);
  const s3m10 = lastOf(data.series.T10Y3M);
  const real = lastOf(data.series.DFII10);
  const ten = lastOf(data.series.DGS10);
  if (!two || !s210) return empty(tr("No market signals have been read yet."));
  // Net liquidity, weekly: the Fed's assets less the Treasury's cash at the Fed and the reverse repo
  // facility's balance, each in millions (the reverse repo is published in billions).
  const walcl = byWeek(data.series.WALCL);
  const tga = byWeek(data.series.WTREGEN);
  const rrp = byWeek(data.series.RRPONTSYD);
  const lw = weeks(now - 3 * 365 * DAY_MS, now);
  const wv = weekly(walcl, lw);
  const tv = weekly(tga, lw);
  const rv = weekly(rrp, lw);
  const liquidity = lw.map((_, i) => {
    const a = wv[i];
    const b = tv[i];
    const c = rv[i];
    return a === null ||
      a === undefined ||
      b === null ||
      b === undefined ||
      c === null ||
      c === undefined
      ? null
      : (a - b - c * 1000) * 1e6;
  });
  let li = liquidity.length - 1;
  while (li > 0 && liquidity[li] === null) li--;
  const liq = liquidity[li] ?? null;
  const liq4 = li >= 4 ? (liquidity[li - 4] ?? null) : null;
  const gap = effr ? (two[1] - effr[1]) * 100 : null;
  const list: Tile[] = [
    {
      eyebrow: tr("2-year yield less fed funds"),
      big: gap === null ? "–" : bp(gap),
      dim:
        gap === null
          ? ""
          : gap >= 0
            ? tr(
                "2-year {two} above the effective rate: the market prices rates higher over two years",
                { two: pct(two[1], 2) },
              )
            : tr("2-year {two} below the effective rate: the market prices cuts over two years", {
                two: pct(two[1], 2),
              }),
      cls: gap === null ? "" : tone(gap),
    },
    {
      eyebrow: tr("Yield curve, 10-year less 2-year"),
      big: pp(s210[1], 2),
      dim: tr("10-year less 3-month {s} · below zero the curve is inverted", {
        s: s3m10 ? pp(s3m10[1], 2) : "–",
      }),
      cls: tone(s210[1], 2),
    },
    {
      eyebrow: tr("10-year real yield"),
      big: real ? pct(real[1], 2) : "–",
      dim: tr("inflation-protected Treasury · nominal 10-year {ten}", {
        ten: ten ? pct(ten[1], 2) : "–",
      }),
    },
    {
      eyebrow: tr("Net liquidity"),
      big: liq === null ? "–" : formatUsd(liq),
      dim:
        liq === null || liq4 === null
          ? tr("Fed assets less the Treasury's account and reverse repos")
          : tr(
              "{change} over four weeks · Fed assets less the Treasury's account and reverse repos",
              {
                change: `${liq >= liq4 ? "+" : MINUS}${formatUsd(Math.abs(liq - liq4))}`,
              },
            ),
    },
  ];

  const yw = weeks(now - 3 * 365 * DAY_MS, two[0]);
  const yieldsChart = chart({
    title: tr("Treasury yields"),
    grain: "w",
    slots: yw,
    lines: [
      {
        label: tr("3-month"),
        cls: "mc-d",
        values: weekly(byWeek(data.series.DGS3MO), yw),
        unit: "%",
        digits: 2,
      },
      {
        label: tr("2-year"),
        cls: "mc-a",
        values: weekly(byWeek(data.series.DGS2), yw),
        unit: "%",
        digits: 2,
      },
      {
        label: tr("10-year"),
        cls: "mc-b",
        values: weekly(byWeek(data.series.DGS10), yw),
        unit: "%",
        digits: 2,
      },
      {
        label: tr("30-year"),
        cls: "mc-c",
        values: weekly(byWeek(data.series.DGS30), yw),
        unit: "%",
        digits: 2,
      },
    ],
    axis: (v, d) => pct(v, d),
    axisKind: { suffix: "%", digits: 2 },
  });
  const sw = weeks(Date.UTC(2021, 0, 4), s210[0]);
  const curveChart = chart({
    title: tr("Yield curve"),
    grain: "w",
    slots: sw,
    lines: [
      {
        label: tr("10-year less 2-year"),
        cls: "mc-a",
        values: weekly(byWeek(data.series.T10Y2Y), sw),
        unit: ppSuffix(),
        digits: 2,
        signed: true,
      },
      {
        label: tr("10-year less 3-month"),
        cls: "mc-c",
        values: weekly(byWeek(data.series.T10Y3M), sw),
        unit: ppSuffix(),
        digits: 2,
        signed: true,
      },
    ],
    axis: (v, d) => fig(v, d, "", true),
    axisKind: { suffix: "", digits: 2 },
    note: tr(
      "An inverted curve, long yields below short ones, has come before every US recession since the 1970s, often by a year or more; the turn back above zero has often come closer to it.",
    ),
  });
  const liqChart = chart({
    title: tr("Net liquidity"),
    grain: "w",
    slots: lw,
    lines: [{ label: tr("Net liquidity"), cls: "mc-b", values: liquidity, unit: "$", digits: 0 }],
    axis: (v) => formatUsd(v),
    axisKind: "usd",
    note: tr(
      "The Fed's total assets less the Treasury General Account and the overnight reverse repo facility: a rough count of the dollars the Fed's balance sheet leaves in the market, which many crypto traders watch against prices.",
    ),
  });

  const dollar = data.series.DTWEXBGS;
  const d = lastOf(dollar);
  const d4 = d ? at(dollar, d[0] - 28 * DAY_MS) : null;
  const d52 = d ? at(dollar, d[0] - 365 * DAY_MS) : null;
  const nfci = data.series.NFCI;
  const n = lastOf(nfci);
  const n4 = backOf(nfci, 4);
  const m2 = byMonth(data.series.M2SL);
  const m2Last = m2.size ? lastKey(m2) : null;
  const row = (label: string, value: string, a: string, b: string, note: string) =>
    `<tr><td>${label}</td><td class="num">${value}</td><td class="num">${a}</td><td class="num">${b}</td><td class="dim">${note}</td></tr>`;
  const table = `${h3(tr("Other signals"))}<div class="sheet-wrap"><table class="sheet mc-table">
<thead><tr><th>${tr("Measure")}</th><th class="num">${tr("Latest")}</th><th class="num">${tr("4 weeks")}</th><th class="num">${tr("1 year")}</th><th>${tr("Reading")}</th></tr></thead><tbody>
${d ? row(tr("Dollar, broad index"), d[1].toFixed(2), d4 ? spct((d[1] / d4 - 1) * 100, 1) : dash, d52 ? spct((d[1] / d52 - 1) * 100, 1) : dash, tr("the Fed's trade-weighted dollar; a rising dollar tightens conditions worldwide")) : ""}
${n ? row(tr("Financial conditions (NFCI)"), fig(n[1], 2, "", true), n4 === null ? dash : fig(n[1] - n4, 2, "", true), dash, n[1] < 0 ? tr("below zero: looser than average") : tr("above zero: tighter than average")) : ""}
${m2Last !== null ? row(tr("Money supply (M2)"), formatUsd((m2.get(m2Last) as number) * 1e9), dash, spct(change(m2, m2Last, 12) ?? 0, 1), tr("{month}, year on year", { month: monthLabel(keyMs(m2Last)) })) : ""}
</tbody></table></div>`;

  return `${head("signals", tr("Policy signals"))}
${help("signals", [
  tr(
    "What the bond market says about policy before the Fed does. The 2-year Treasury yield tracks where traders expect the policy rate over the next two years: well above the effective rate, they expect it higher; well below, they expect cuts.",
  ),
  tr(
    "The yield curve is the 10-year yield less the 2-year, and less the 3-month bill. Real yields are inflation-protected Treasuries' (TIPS); a high real yield is a high cost of holding assets that pay nothing, crypto among them.",
  ),
  tr(
    "Net liquidity is the Fed's balance sheet less the Treasury's cash at the Fed and the reverse repo facility, worked out here from the weekly figures; it is a rule of thumb, not an official measure. The NFCI is the Chicago Fed's index of financial conditions, zero at its long-run average.",
  ),
])}
${tiles("signals", list)}
${calendar(data.releases, ["fomc"], now)}
${yieldsChart}
${curveChart}
${liqChart}
${table}
${readNote(data, Object.keys(MACRO_NEEDS.signals.series), now, tr("Sources: Treasury yields, the Federal Reserve and the Chicago Fed through FRED."))}`;
}

// ---- Positioning and flows ----

/** A futures market's name, in the page's language. */
const cotName = (key: string): string =>
  ({
    BTC: tr("Bitcoin (CME)"),
    ETH: tr("Ether (CME)"),
    ES: esc(tr("S&P 500 E-mini")),
    NQ: tr("Nasdaq-100 E-mini"),
    RTY: tr("Russell 2000 E-mini"),
    VX: tr("VIX futures"),
    ZT: tr("2-year Treasury note"),
    ZN: tr("10-year Treasury note"),
    ZB: tr("Treasury bond"),
    SR3: tr("3-month SOFR"),
    ZQ: tr("30-day fed funds"),
    DX: tr("US dollar index"),
    "6E": tr("Euro"),
    "6J": tr("Japanese yen"),
    GC: tr("Gold"),
    SI: tr("Silver"),
    CL: tr("WTI crude oil"),
    HG: tr("Copper"),
  })[key] ?? esc(key);

const COT_ORDER = [
  "BTC",
  "ETH",
  "ES",
  "NQ",
  "RTY",
  "VX",
  "ZT",
  "ZN",
  "ZB",
  "SR3",
  "ZQ",
  "DX",
  "6E",
  "6J",
  "GC",
  "SI",
  "CL",
  "HG",
];

interface CotMarket {
  key: string;
  report: string;
  /** Each report date's open interest, and each group's net, oldest first. */
  dates: number[];
  oi: number[];
  groups: Record<string, (number | null)[]>;
}

function cotMarkets(rows: readonly CotRow[]): CotMarket[] {
  const byKey = new Map<
    string,
    { report: string; dates: Map<number, { oi: number; groups: Record<string, number> }> }
  >();
  for (const r of rows) {
    let m = byKey.get(r.key);
    if (!m) {
      m = { report: r.report, dates: new Map() };
      byKey.set(r.key, m);
    }
    let d = m.dates.get(r.ms);
    if (!d) {
      d = { oi: r.open_interest, groups: {} };
      m.dates.set(r.ms, d);
    }
    d.groups[r.trader_group] = r.net;
  }
  return COT_ORDER.filter((key) => byKey.has(key)).map((key) => {
    const m = byKey.get(key) as {
      report: string;
      dates: Map<number, { oi: number; groups: Record<string, number> }>;
    };
    const dates = [...m.dates.keys()].sort((a, b) => a - b);
    const names =
      m.report === "tff"
        ? ["leveraged", "asset_manager", "dealer"]
        : ["managed_money", "producer", "swap_dealer"];
    const groups: Record<string, (number | null)[]> = {};
    for (const g of names) groups[g] = dates.map((ms) => m.dates.get(ms)?.groups[g] ?? null);
    return {
      key,
      report: m.report,
      dates,
      oi: dates.map((ms) => m.dates.get(ms)?.oi ?? 0),
      groups,
    };
  });
}

/** Where the latest value sits among the series' values: 0 the lowest of them, 100 the highest. */
function rank(values: readonly (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 10) return null;
  const latest = v[v.length - 1] as number;
  const below = v.filter((x) => x < latest).length;
  return Math.round((below / (v.length - 1)) * 100);
}

function cotTable(markets: readonly CotMarket[], report: "tff" | "disagg"): string {
  const list = markets.filter((m) => m.report === report);
  if (list.length === 0) return "";
  const [spec, other, dealer] =
    report === "tff"
      ? ["leveraged", "asset_manager", "dealer"]
      : ["managed_money", "producer", "swap_dealer"];
  const cell = (m: CotMarket, g: string, withChange: boolean) => {
    const values = m.groups[g] ?? [];
    const v = values[values.length - 1];
    const prev = values[values.length - 2];
    const oi = m.oi[m.oi.length - 1] ?? 0;
    if (v === null || v === undefined)
      return `<td class="num">${dash}</td>${withChange ? `<td class="num">${dash}</td>` : ""}`;
    const share = oi > 0 ? ` <span class="dim">${spct((v / oi) * 100, 0)}</span>` : "";
    const delta =
      withChange && prev !== null && prev !== undefined
        ? `<td class="num ${tone(v - prev)}">${count(v - prev, true)}</td>`
        : withChange
          ? `<td class="num">${dash}</td>`
          : "";
    return `<td class="num ${tone(v)}">${count(v, true)}${share}</td>${delta}`;
  };
  const rows = list
    .map((m) => {
      const specValues = m.groups[spec] ?? [];
      const r = rank(specValues);
      const last = m.dates[m.dates.length - 1] as number;
      return `<tr><td>${cotName(m.key)}</td><td class="num dim">${dayLabel(last)}</td><td class="num">${count(m.oi[m.oi.length - 1] ?? 0)}</td>${cell(m, spec, true)}<td class="num">${r === null ? dash : `${r}%`}</td><td>${sparkline(specValues.filter((x): x is number => x !== null))}</td>${cell(m, other, false)}${cell(m, dealer, false)}</tr>`;
    })
    .join("");
  const names =
    report === "tff"
      ? [tr("Leveraged funds"), tr("Asset managers"), tr("Dealers")]
      : [tr("Managed money"), tr("Producers and merchants"), tr("Swap dealers")];
  return `${h3(report === "tff" ? tr("Financial futures: who holds them") : tr("Commodity futures: who holds them"))}<div class="sheet-wrap"><table class="sheet mc-table mc-cot">
<thead><tr><th>${tr("Market")}</th><th class="num">${tr("As of")}</th><th class="num">${tr("Open interest")}</th><th class="num">${tr("{group}, net", { group: names[0] as string })}</th><th class="num">${tr("Week")}</th><th class="num" title="${esc(tr("Where this week's net sits among the last three years' weeks: 0% the shortest, 100% the longest"))}">${tr("3-year rank")}</th><th>${tr("3 years")}</th><th class="num">${tr("{group}, net", { group: names[1] as string })}</th><th class="num">${tr("{group}, net", { group: names[2] as string })}</th></tr></thead>
<tbody>${rows}</tbody></table></div>`;
}

function flows(data: MacroData, now: number): string {
  const markets = cotMarkets(data.cot);
  const stable = data.series.STABLECOINS ?? [];
  if (markets.length === 0 && stable.length === 0)
    return empty(tr("No positioning data has been read yet."));
  const s = lastOf(stable);
  const s30 = s ? at(stable, s[0] - 30 * DAY_MS) : null;
  const s90 = s ? at(stable, s[0] - 90 * DAY_MS) : null;
  const btc = markets.find((m) => m.key === "BTC");
  const eth = markets.find((m) => m.key === "ETH");
  const gold = markets.find((m) => m.key === "GC");
  const netTile = (
    m: CotMarket | undefined,
    group: string,
    eyebrow: string,
    otherGroup: string,
    otherName: string,
  ): Tile => {
    if (!m) return { eyebrow, big: "–", dim: "" };
    const v = m.groups[group] ?? [];
    const latest = v[v.length - 1] ?? null;
    const oi = m.oi[m.oi.length - 1] ?? 0;
    const r = rank(v);
    const o = m.groups[otherGroup] ?? [];
    const other = o[o.length - 1] ?? null;
    return {
      eyebrow,
      big: latest === null ? "–" : count(latest, true),
      cls: latest === null ? "" : tone(latest),
      dim: tr("contracts net, {share} of open interest · 3-year rank {rank} · {other} {otherNet}", {
        share: latest === null || oi <= 0 ? "–" : spct((latest / oi) * 100, 0),
        rank: r === null ? "–" : `${r}%`,
        other: otherName,
        otherNet: other === null ? "–" : count(other, true),
      }),
    };
  };
  const list: Tile[] = [
    {
      eyebrow: tr("Stablecoin supply"),
      big: s ? formatUsd(s[1]) : "–",
      dim:
        s && s30 !== null && s90 !== null
          ? tr("{d30} in 30 days · {d90} in 90 days", {
              d30: `${s[1] >= s30 ? "+" : MINUS}${formatUsd(Math.abs(s[1] - s30))}`,
              d90: `${s[1] >= s90 ? "+" : MINUS}${formatUsd(Math.abs(s[1] - s90))}`,
            })
          : "",
    },
    netTile(
      btc,
      "leveraged",
      tr("CME Bitcoin, leveraged funds"),
      "asset_manager",
      tr("asset managers"),
    ),
    netTile(
      eth,
      "leveraged",
      tr("CME Ether, leveraged funds"),
      "asset_manager",
      tr("asset managers"),
    ),
    netTile(gold, "managed_money", tr("Gold, managed money"), "producer", tr("producers")),
  ];

  const btcChart =
    btc && btc.dates.length > 1
      ? chart({
          title: tr("Who holds CME Bitcoin futures"),
          grain: "w",
          slots: btc.dates.map(weekStart),
          lines: [
            {
              label: tr("Leveraged funds"),
              cls: "mc-d",
              values: btc.groups.leveraged ?? [],
              unit: "",
              digits: 0,
              signed: true,
            },
            {
              label: tr("Asset managers"),
              cls: "mc-a",
              values: btc.groups.asset_manager ?? [],
              unit: "",
              digits: 0,
              signed: true,
            },
            {
              label: tr("Dealers"),
              cls: "mc-c",
              values: btc.groups.dealer ?? [],
              unit: "",
              digits: 0,
              signed: true,
            },
          ],
          axis: (v) => count(v, true),
          axisKind: { suffix: "", digits: 0 },
          note: tr(
            "Net contracts (longs less shorts) of five bitcoin each, as of each Tuesday. Leveraged funds are hedge funds and trading firms; much of their short is the futures leg of a cash-and-carry trade against spot ETFs, not a bet on a fall.",
          ),
        })
      : "";
  const sw = weeks(now - 3 * 365 * DAY_MS, s ? s[0] : now);
  const stableChart = s
    ? chart({
        title: tr("Dollar stablecoins in circulation"),
        grain: "w",
        slots: sw,
        lines: [
          {
            label: tr("Stablecoin supply"),
            cls: "mc-b",
            values: weekly(byWeek(stable), sw),
            unit: "$",
            digits: 0,
          },
        ],
        axis: (v) => formatUsd(v),
        axisKind: "usd",
        note: tr(
          "Every dollar-pegged stablecoin's supply, added up by DefiLlama: dollars already on-chain, the first money to reach crypto prices.",
        ),
      })
    : "";
  const report = markets[0]?.dates[markets[0].dates.length - 1];

  return `${head("flows", tr("Positioning and flows"))}
${help("flows", [
  tr(
    "Who actually holds the futures, from the CFTC's weekly Commitments of Traders: positions as of Tuesday, published the Friday after. For financial futures the CFTC splits traders into dealers (the banks that make markets), asset managers (pension funds, insurers, mutual funds: slower, real money) and leveraged funds (hedge funds and trading firms: faster, speculative). For commodities it splits producers and merchants (hedgers), swap dealers and managed money (the speculators).",
  ),
  tr(
    "Net is longs less shorts, in contracts; its share is of the market's open interest. The 3-year rank says where this week's net sits among every week of the last three years: near 0% the speculators are as short as they have been, near 100% as long, which is when positioning tends to unwind.",
  ),
  tr(
    "Stablecoin supply is the dollars already on-chain, from DefiLlama: when it grows, new money is arriving in crypto.",
  ),
])}
${tiles("flows", list)}
${stableChart}
${btcChart}
${cotTable(markets, "tff")}
${cotTable(markets, "disagg")}
<p class="notes">${tr("Sources: the CFTC's Commitments of Traders, futures only{date}; DefiLlama for stablecoins.", { date: report ? tr(", report of {date}", { date: dateLabel(report) }) : "" })}</p>`;
}

// ---- The tab ----

const RENDER: Record<MacroPanel, (data: MacroData, now: number) => string> = {
  inflation,
  fed,
  jobs,
  growth,
  signals,
  flows,
};

/** One macro tab, or the note that its data could not be read. */
export function macroPanel(panel: MacroPanel, data: MacroData | null, now: number): string {
  if (data === null) return empty(tr("The macro data could not be read right now."));
  return RENDER[panel](data, now);
}

/** The tab on its own, for `/rates?panel=<tab>`: what tabs.ts loads into its placeholder. */
export function macroFragment(panel: MacroPanel, data: MacroData | null, now: number): string {
  return `<div class="lazy-body" data-rendered="${now}">${macroPanel(panel, data, now)}</div>`;
}

/** The placeholder for a tab this render did not read (chart-skeleton.ts). */
export function macroPlaceholder(panel: MacroPanel): string {
  return lazyPlaceholder(`/rates?macro=${panel}#${panel}`);
}
