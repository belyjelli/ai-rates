import type { AssetClass } from "@ai-rates/core";
import type {
  GammaBook,
  GammaData,
  GammaExpiry,
  GammaExposure,
  GammaPoint,
  GammaStrike,
} from "../app/data";
import {
  GAMMA_DEFAULT_BOOK,
  GAMMA_SCOPES,
  type GammaParams,
  type GammaScope,
  type HeatmapParams,
  heatmapToQuery,
} from "../app/params";
import { CHART_SKELETON_JS, lazyPlaceholder } from "./chart-skeleton";
import { type ExpectedMove, expectedMoves, type MoveHorizon } from "./expected-move";
import { ageText, esc, formatDuration, formatPrice, formatUsd } from "./format";
import { helpButton, helpPanel } from "./help";
import { msg, tr, trMsg } from "./i18n";
import {
  type GammaSlots,
  MONTHS,
  SLOT_BAND,
  SLOT_CURSOR,
  SLOT_HAIR,
  slotCursorSwitch,
  slotData,
} from "./slot-chart";

/**
 * The Rates page's Gamma Exposure tab: options as dealer gamma by strike (collector internal/gamma,
 * migrations 034 and 036), for every book the collector stores -- Deribit's BTC and ETH, Cboe's US
 * chains, and index options from the end-of-day files of HKEX, CFFEX, TAIFEX, JPX, ASX, NSE, BSE and
 * Eurex.
 *
 * WHAT THE NUMBERS ARE. Each option's gamma times its open interest times the forward squared times
 * 1%: what a hedger holding that open interest trades of the underlying for a 1% move, in the currency
 * the contract pays (dollars, or HKD for the Hang Seng, EUR for the Euro Stoxx 50: the row's `unit`).
 * Open interest is the exchange's; IV is Deribit's or Cboe's own, or for an end-of-day file backed
 * out of each strike's settlement price; gamma is Black-76, computed by the collector.
 *
 * WHAT THEY ASSUME. Calls count positive and puts negative, the standard reading: dealers long the
 * calls customers sold them and short the puts customers bought. No exchange publishes who holds which
 * side, so every signed figure rests on that, and the help and the note under the chart say so. The
 * unsigned ones -- where open interest and gamma sit -- do not.
 *
 * THE PAGE BINS THE STRIKES. The collector stores every strike with open interest; the chart groups
 * them into bands no narrower than the strikes' own spacing (BTC's are 500 apart near the spot and
 * 1,000 further out, ETH's 20 with 50s between), over the narrowest of RANGES that holds most of the
 * exposure, so a next-expiry view is not lost in a ±30% axis and an all-expiry one is not cut off.
 */

/** Older than this, Deribit's figures are late: it is read every five minutes, around the clock. */
export const GAMMA_STALE_MS = 20 * 60_000;
/** Older than this, Deribit's show none: a crypto book half a day old is not today's positioning. */
export const GAMMA_REFUSE_MS = 6 * 3600_000;
/**
 * A US chain is read every 15 minutes through the US session, so in it this much is late; outside it
 * the figures are the last session's, which a weekend or a holiday leaves days old.
 */
export const GAMMA_SESSION_STALE_MS = 45 * 60_000;
/** An end-of-day book (or a US one) older than this is late even across a weekend and a holiday. */
export const GAMMA_DAYS_STALE_MS = 4 * 86_400_000;
/** And older than this shows none. China's October holiday closes CFFEX for nine days. */
export const GAMMA_DAYS_REFUSE_MS = 14 * 86_400_000;
/** The chart's reach either side of the spot, narrowest first, and the share of exposure it must hold. */
const RANGES = [0.05, 0.1, 0.15, 0.2, 0.3] as const;
const COVER = 0.9;
/** At most this many bands across, before the strikes' own spacing widens them. */
const MAX_BANDS = 60;
const MINUS = "−";
/** The id tabs.ts and the swap script find the tab by. */
export const GAMMA_PANEL_ID = "panel-rates-gamma";

/** "+$29.8M", "−HK$49.8M": exposure always carries its sign. */
export const signedUsd = (usd: number, symbol = "$") =>
  `${usd > 0 ? "+" : ""}${formatUsd(usd, symbol)}`;

/**
 * How each publisher's options are read: "live" around the clock (Deribit), "session" through the US
 * session (Cboe), "daily" from a file published after the close. A publisher the collector adds and
 * this does not know is taken as daily under its own name, the gentlest reading of its age.
 */
type Cadence = "live" | "session" | "daily";
type Region = "crypto" | "us" | "asia" | "europe" | "other";
interface Publisher {
  name: string;
  region: Region;
  cadence: Cadence;
}
const PUBLISHERS: Readonly<Record<string, Publisher>> = {
  deribit: { name: "Deribit", region: "crypto", cadence: "live" },
  cboe: { name: "Cboe", region: "us", cadence: "session" },
  hkex: { name: "HKEX", region: "asia", cadence: "daily" },
  cffex: { name: "CFFEX", region: "asia", cadence: "daily" },
  taifex: { name: "TAIFEX", region: "asia", cadence: "daily" },
  nse: { name: "NSE", region: "asia", cadence: "daily" },
  bse: { name: "BSE", region: "asia", cadence: "daily" },
  jpx: { name: "JPX", region: "asia", cadence: "daily" },
  asx: { name: "ASX", region: "asia", cadence: "daily" },
  eurex: { name: "Eurex", region: "europe", cadence: "daily" },
};
export const publisher = (source: string): Publisher =>
  PUBLISHERS[source] ?? { name: source.toUpperCase(), region: "other", cadence: "daily" };

const REGIONS: readonly [Region, string][] = [
  ["crypto", msg("Crypto")],
  ["us", msg("United States")],
  ["asia", msg("Asia-Pacific")],
  ["europe", msg("Europe")],
  ["other", msg("Other")],
];

/**
 * A reader's name for each book, in the picker's order within its region: the collector's own lists
 * (internal/gamma markets.go), indexes ahead of the ETFs and stocks. A book not here still shows,
 * under its ticker, after these.
 */
const BOOK_NAMES: Readonly<Record<string, string>> = {
  BTC: msg("Bitcoin"),
  ETH: msg("Ether"),
  SPX: msg("S&P 500"),
  NDX: msg("Nasdaq-100"),
  RUT: msg("Russell 2000"),
  SPY: msg("SPDR S&P 500 ETF"),
  QQQ: msg("Invesco QQQ"),
  IWM: msg("iShares Russell 2000 ETF"),
  GLD: msg("SPDR Gold Shares"),
  SLV: msg("iShares Silver Trust"),
  USO: msg("United States Oil Fund"),
  IBIT: msg("iShares Bitcoin Trust"),
  ETHA: msg("iShares Ethereum Trust"),
  MSTR: msg("Strategy"),
  COIN: msg("Coinbase"),
  NVDA: msg("NVIDIA"),
  TSLA: msg("Tesla"),
  MU: msg("Micron"),
  HSI: msg("Hang Seng"),
  HSCEI: msg("Hang Seng China Enterprises"),
  HSTECH: msg("Hang Seng TECH"),
  CSI300: msg("CSI 300"),
  SSE50: msg("SSE 50"),
  CSI1000: msg("CSI 1000"),
  TAIEX: msg("TAIEX"),
  NK225: msg("Nikkei 225"),
  XJO: msg("S&P/ASX 200"),
  NIFTY: msg("Nifty 50"),
  BANKNIFTY: msg("Nifty Bank"),
  SENSEX: msg("BSE Sensex"),
  SX5E: msg("Euro Stoxx 50"),
  DAX: msg("DAX"),
  SMI: msg("Swiss Market Index"),
};
const BOOK_ORDER = Object.keys(BOOK_NAMES);

/** A book's name in the page's language; its ticker when the site has no name for it. */
const rawName = (currency: string): string => {
  const name = BOOK_NAMES[currency];
  return name ? trMsg(name) : currency;
};
/**
 * The option book that prices the same thing as a perp on `base`, or null. Only an exact ticker:
 * BTC and ETH are Deribit's crypto books, every other book is tradfi (NVDA the stock, never an NVDA
 * token), and an ETF never stands in for its commodity -- GLD is not gold's price.
 */
export function gammaBookFor(base: string, assetClass: AssetClass): string | null {
  if (!(base in BOOK_NAMES)) return null;
  return (base === "BTC" || base === "ETH") === (assetClass === "crypto") ? base : null;
}

/** Every book the site has a name for, as [ticker, name in the page's language], for the search. */
export const namedBooks = (): [string, string][] =>
  BOOK_ORDER.map((currency) => [currency, rawName(currency)]);
/** The same, escaped for markup. */
export const bookName = (currency: string): string => esc(rawName(currency));

/** The sign each unit's amounts are written with; an unknown unit leads with its code. */
const SYMBOLS: Readonly<Record<string, string>> = {
  USD: "$",
  HKD: "HK$",
  CNY: "¥",
  TWD: "NT$",
  AUD: "A$",
  INR: "₹",
  EUR: "€",
  CHF: "CHF ",
  GBP: "£",
  JPY: "JP¥",
  KRW: "₩",
};
export const unitSymbol = (unit: string): string => SYMBOLS[unit] ?? `${unit} `;

/** Whether `ms` falls in the US session's core hours, 14:30-20:00 UTC on a weekday, whatever the DST. */
function inUsSession(ms: number): boolean {
  const d = new Date(ms);
  const day = d.getUTCDay();
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return day !== 0 && day !== 6 && minutes >= 14 * 60 + 30 && minutes < 20 * 60;
}

/**
 * How current a book's figures are for its publisher: "fresh", "late" (shown, with a note saying how
 * old), or "dead" (too old to show as positioning).
 */
export function freshness(source: string, at: Date, now: number): "fresh" | "late" | "dead" {
  const age = now - at.getTime();
  const cadence = publisher(source).cadence;
  if (cadence === "live")
    return age > GAMMA_REFUSE_MS ? "dead" : age > GAMMA_STALE_MS ? "late" : "fresh";
  if (age > GAMMA_DAYS_REFUSE_MS) return "dead";
  if (age > GAMMA_DAYS_STALE_MS) return "late";
  if (cadence === "session" && inUsSession(now) && age > GAMMA_SESSION_STALE_MS) return "late";
  return "fresh";
}

/** "3m ago", "6h 01m ago", and from two days on "2d 16h ago": a US weekend, a late file. */
function agoText(at: Date, now: number): string {
  const ms = now - at.getTime();
  if (ms < 2 * 86_400_000) return ageText(at, now);
  return tr("{time} ago", {
    time: tr("{d}d {h}h", {
      d: Math.floor(ms / 86_400_000),
      h: Math.floor((ms % 86_400_000) / 3_600_000),
    }),
  });
}

/** How old a book's figures are, as its publisher makes them: a read's age, or a file's day. */
function asOfText(source: string, at: Date, now: number): string {
  const cadence = publisher(source).cadence;
  if (cadence === "daily") return tr("close {date}", { date: dayLabel(at) });
  return agoText(at, now);
}

/** A modeled price, to the precision it means: whole dollars from $1,000 up, four figures below. */
const level = (price: number) => (price >= 1000 ? Math.round(price) : Number(price.toPrecision(4)));

const tone = (usd: number) => (usd > 0 ? "lq-ink-l" : usd < 0 ? "lq-ink-s" : "");

const signedPct = (fraction: number, digits = 1) => {
  const text = Math.abs(fraction * 100).toFixed(digits);
  if (Number(text) === 0) return `${(0).toFixed(digits)}%`;
  return `${fraction < 0 ? MINUS : "+"}${text}%`;
};

/** "Oct 16" in the page's language. */
const dayLabel = (date: Date) =>
  tr("{month} {day}", {
    month: trMsg(MONTHS[date.getUTCMonth()] as string),
    day: date.getUTCDate(),
  });

export function scopeLabel(scope: GammaScope, next: Date | null): string {
  if (scope === "next")
    return next ? tr("Next: {date}", { date: dayLabel(next) }) : tr("Next expiry");
  if (scope === "7d") return tr("7 days");
  if (scope === "30d") return tr("30 days");
  return tr("All expiries");
}

/** Whether the collector counts an expiry in a scope, by the same rule (internal/gamma inScope). */
export function inScope(scope: GammaScope, expiry: Date, next: Date, at: Date): boolean {
  if (scope === "next") return expiry.getTime() === next.getTime();
  if (scope === "7d") return expiry.getTime() <= at.getTime() + 7 * 86_400_000;
  if (scope === "30d") return expiry.getTime() <= at.getTime() + 30 * 86_400_000;
  return true;
}

/** The smallest of 1, 2, 2.5 and 5 times a power of ten that is at least `value`. */
export function niceStep(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * power >= value - 1e-9 * power) return m * power;
  return 10 * power;
}

/** The narrowest reach in RANGES whose strikes hold COVER of the exposure, either sign counted. */
export function fitRange(strikes: readonly GammaStrike[], spot: number): number {
  const weight = (k: GammaStrike) => Math.abs(k.call_gex_usd) + Math.abs(k.put_gex_usd);
  const total = strikes.reduce((sum, k) => sum + weight(k), 0);
  const widest = RANGES[RANGES.length - 1] as number;
  if (!(total > 0)) return widest;
  for (const range of RANGES) {
    const inside = strikes
      .filter((k) => Math.abs(k.strike / spot - 1) <= range + 1e-9)
      .reduce((sum, k) => sum + weight(k), 0);
    if (inside >= COVER * total) return range;
  }
  return widest;
}

/** The most common gap between neighbouring strikes, the smallest on a tie; 0 with fewer than two. */
export function strikeSpacing(strikes: readonly number[]): number {
  const counts = new Map<number, number>();
  for (let i = 1; i < strikes.length; i++) {
    const gap = Math.round(((strikes[i] as number) - (strikes[i - 1] as number)) * 1e6) / 1e6;
    if (gap > 0) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  }
  let best = 0;
  let seen = 0;
  for (const [gap, n] of counts) {
    if (n > seen || (n === seen && gap < best)) {
      best = gap;
      seen = n;
    }
  }
  return best;
}

export interface GammaBands {
  /** The first band's low price, each band's width, the reach either side of the spot. */
  low: number;
  step: number;
  range: number;
  count: number;
  calls: number[];
  puts: number[];
  callOi: number[];
  putOi: number[];
  /** The strikes in each band, as the readout names them; "" for none. */
  labels: string[];
  /** Exposure beyond the axis, either side. */
  beyond: number;
}

/** Groups the strikes into bands `step` wide, each starting on a multiple of `step`. */
export function bandStrikes(strikes: readonly GammaStrike[], spot: number): GammaBands {
  const range = fitRange(strikes, spot);
  const near = strikes
    .filter((k) => Math.abs(k.strike / spot - 1) <= range + 1e-9)
    .map((k) => k.strike);
  const step = Math.max(niceStep((2 * range * spot) / MAX_BANDS), strikeSpacing(near));
  const low = Math.floor((spot * (1 - range)) / step) * step;
  const high = Math.ceil((spot * (1 + range)) / step) * step;
  const count = Math.max(1, Math.round((high - low) / step));
  const zeros = () => new Array<number>(count).fill(0);
  const bands: GammaBands = {
    low,
    step,
    range,
    count,
    calls: zeros(),
    puts: zeros(),
    callOi: zeros(),
    putOi: zeros(),
    labels: new Array<string>(count).fill(""),
    beyond: 0,
  };
  const members: number[][] = Array.from({ length: count }, () => []);
  for (const k of strikes) {
    const i = Math.floor((k.strike - low) / step + 1e-9);
    if (i < 0 || i >= count) {
      bands.beyond += Math.abs(k.call_gex_usd) + Math.abs(k.put_gex_usd);
      continue;
    }
    bands.calls[i] = (bands.calls[i] ?? 0) + k.call_gex_usd;
    bands.puts[i] = (bands.puts[i] ?? 0) + k.put_gex_usd;
    bands.callOi[i] = (bands.callOi[i] ?? 0) + k.call_oi;
    bands.putOi[i] = (bands.putOi[i] ?? 0) + k.put_oi;
    members[i]?.push(k.strike);
  }
  bands.labels = members.map((list) =>
    list.length === 0
      ? ""
      : list.length === 1
        ? formatPrice(list[0] as number)
        : `${formatPrice(Math.min(...list))}–${formatPrice(Math.max(...list))}`,
  );
  return bands;
}

/** The curve at `price`, interpolated between its points; null outside them. */
export function curveAt(curve: readonly GammaPoint[], price: number): number | null {
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1] as GammaPoint;
    const b = curve[i] as GammaPoint;
    if (price >= a.price && price <= b.price) {
      const t = b.price === a.price ? 0 : (price - a.price) / (b.price - a.price);
      return a.net_gex_usd + t * (b.net_gex_usd - a.net_gex_usd);
    }
  }
  return null;
}

/** A stretch of price where the profile curve keeps one sign: dealers short gamma there, or long it. */
export interface GammaZone {
  from: number;
  to: number;
  short: boolean;
}

/**
 * The curve's stretches of one sign between `low` and `high`, each crossing interpolated between the
 * two points either side of it: where dealers would be short gamma, or long it, were the spot to move
 * there. Nothing where the curve does not reach, since the sign there is unknown.
 */
export function gammaZones(curve: readonly GammaPoint[], low: number, high: number): GammaZone[] {
  const zones: GammaZone[] = [];
  let from: number | null = null;
  let short = false;
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i] as GammaPoint;
    const below = p.net_gex_usd < 0;
    if (from === null) {
      from = p.price;
      short = below;
      continue;
    }
    if (below !== short) {
      const a = curve[i - 1] as GammaPoint;
      const at = a.price + (a.net_gex_usd / (a.net_gex_usd - p.net_gex_usd)) * (p.price - a.price);
      zones.push({ from, to: at, short });
      from = at;
      short = below;
    }
  }
  const last = curve[curve.length - 1];
  if (from !== null && last && curve.length > 1) zones.push({ from, to: last.price, short });
  return zones
    .map((z) => ({ ...z, from: Math.max(z.from, low), to: Math.min(z.to, high) }))
    .filter((z) => z.to > z.from);
}

/**
 * The chart's three ways of drawing the bars, switched beside the cursor (GX_VIEW_SCRIPT): "split",
 * each band's calls above zero and puts below, the view the tab opened with and the one a reader
 * without JavaScript keeps; "net", one bar per band with the two added; and "zones", the net bars
 * over the curve's short- and long-gamma stretches. All three are in the markup and CSS shows one,
 * so switching costs no request and survives every refresh.
 */
const GAMMA_VIEWS = ["split", "net", "zones"] as const;

function gammaViewSwitch(): string {
  const words: Record<(typeof GAMMA_VIEWS)[number], [string, string]> = {
    split: [tr("calls/puts"), tr("Each strike's calls above zero and its puts below")],
    net: [tr("net"), tr("One bar per strike: its calls and puts added")],
    zones: [
      tr("zones"),
      tr("Net bars, with the prices shaded where dealers would be short gamma or long it"),
    ],
  };
  const buttons = GAMMA_VIEWS.map(
    (view) =>
      `<button type="button" class="gx-view" data-gx-view="${view}" aria-pressed="${view === "split"}" title="${esc(words[view][1])}">${words[view][0]}</button>`,
  ).join("");
  return `<div class="slot-modes gx-views" role="group" aria-label="${esc(tr("View"))}" hidden><span>${tr("view")}</span>${buttons}</div>`;
}

function gammaChart(data: {
  currency: string;
  exposure: GammaExposure;
  strikes: readonly GammaStrike[];
  curve: readonly GammaPoint[];
  scopeName: string;
  /** The expected move at the scope's horizon (scopeHorizon), drawn as its walls; null for none. */
  move: ExpectedMove | null;
}): string {
  const { currency, exposure, strikes, curve, scopeName, move } = data;
  const spot = exposure.spot;
  const sym = unitSymbol(exposure.unit);
  const b = bandStrikes(strikes, spot);
  const span = b.count * b.step;
  const x = (price: number) => ((price - b.low) / span) * 1000;
  const peak = Math.max(1, ...b.calls, ...b.puts.map((p) => -p));
  const inRange = curve.filter((p) => p.price >= b.low && p.price <= b.low + span);
  const curvePeak = Math.max(1, ...inRange.map((p) => Math.abs(p.net_gex_usd)));
  const y = (usd: number, top: number) => 500 - (usd / top) * 500;

  const slot = 1000 / b.count;
  const width = slot * 0.78;
  const bars = b.calls
    .map((call, i) => {
      const put = b.puts[i] ?? 0;
      const left = (i * slot + (slot - width) / 2).toFixed(2);
      let out = "";
      if (call > 0) {
        out += `<rect class="gx-call" x="${left}" y="${y(call, peak).toFixed(1)}" width="${width.toFixed(2)}" height="${((call / peak) * 500).toFixed(1)}"></rect>`;
      }
      if (put < 0) {
        out += `<rect class="gx-put" x="${left}" y="500" width="${width.toFixed(2)}" height="${((-put / peak) * 500).toFixed(1)}"></rect>`;
      }
      return out;
    })
    .join("");
  const netBars = b.calls
    .map((call, i) => {
      const net = call + (b.puts[i] ?? 0);
      if (!b.labels[i] || net === 0) return "";
      const left = (i * slot + (slot - width) / 2).toFixed(2);
      const height = ((Math.abs(net) / peak) * 500).toFixed(1);
      return `<rect class="${net > 0 ? "gx-call" : "gx-put"}" x="${left}" y="${net > 0 ? y(net, peak).toFixed(1) : "500"}" width="${width.toFixed(2)}" height="${height}"></rect>`;
    })
    .join("");
  const zones = gammaZones(curve, b.low, b.low + span);
  const zoneRects = zones
    .map(
      (z) =>
        `<rect class="${z.short ? "gx-zone-short" : "gx-zone-long"}" x="${x(z.from).toFixed(1)}" y="0" width="${(x(z.to) - x(z.from)).toFixed(1)}" height="1000"></rect>`,
    )
    .join("");
  // A zone wide enough to hold its name says it at the top; a narrow one is read off the key.
  const zoneLabels = zones
    .filter((z) => x(z.to) - x(z.from) >= 120)
    .map(
      (z) =>
        `<span class="gx-zl gx-v gx-v-zone ${z.short ? "gx-zl-short" : "gx-zl-long"}" style="left:${((x(z.from) + x(z.to)) / 20).toFixed(2)}%">${z.short ? tr("short gamma") : tr("long gamma")}</span>`,
    )
    .join("");
  const line =
    inRange.length > 1
      ? `<polyline class="gx-curve" points="${inRange.map((p) => `${x(p.price).toFixed(1)},${y(p.net_gex_usd, curvePeak).toFixed(1)}`).join(" ")}"></polyline>`
      : "";
  const vertical = (price: number | null, cls: string) =>
    price !== null && price >= b.low && price <= b.low + span
      ? `<line class="${cls}" x1="${x(price).toFixed(1)}" x2="${x(price).toFixed(1)}" y1="0" y2="1000"></line>`
      : "";
  // The expected move's walls, one and two deviations either side of the spot, where they fall.
  const moveLines = move
    ? [
        [move.low2, "gx-em2"],
        [move.low1, "gx-em1"],
        [move.high1, "gx-em1"],
        [move.high2, "gx-em2"],
      ]
        .map(([price, cls]) => vertical(price as number, cls as string))
        .join("")
    : "";
  const levels = [0.25, 0.5, 0.75];
  const grid = levels
    .map((f) => `<line class="cvd-grid" x1="0" x2="1000" y1="${f * 1000}" y2="${f * 1000}"></line>`)
    .join("");
  const axisText = (usd: number) => (usd === 0 ? `${sym}0` : signedUsd(usd, sym));
  const leftLabels = levels
    .map(
      (f) => `<span class="cvd-yl" style="top:${f * 100}%">${axisText(peak * (1 - 2 * f))}</span>`,
    )
    .join("");
  const rightLabels = levels
    .map(
      (f) =>
        `<span class="cvd-yr gx-yr" style="top:${f * 100}%">${axisText(curvePeak * (1 - 2 * f))}</span>`,
    )
    .join("");
  const ticks = [-1, -0.5, 0, 0.5, 1];
  const xLabels = ticks
    .map((t, n) => {
      // Off the spot, a tick sits on the nearest band edge, so it reads as a round price.
      const price = t === 0 ? spot : Math.round((spot * (1 + t * b.range)) / b.step) * b.step;
      const text =
        t === 0
          ? tr("spot {price}", { price: formatPrice(spot) })
          : `${formatPrice(price)} <span class="dim">${signedPct(price / spot - 1, 0)}</span>`;
      // The last tick ends at its mark rather than centring on it, so a wide price ("26,500 +10%")
      // stays inside a phone's width.
      return `<span class="cvd-x${t === 0 ? " wm-x-mark" : ""}${t === 1 ? " gx-x-end" : ""}${n % 2 ? " x-alt" : ""}" style="left:${(x(price) / 10).toFixed(2)}%">${text}</span>`;
    })
    .join("");

  const payload: GammaSlots = {
    kind: "gex",
    low: b.low,
    step: b.step,
    spot,
    // Deribit's open interest reads in coins; a share or an index unit is read by its value instead.
    unit: exposure.source === "deribit" ? currency : "",
    cur: sym,
    slots: b.calls.map((call, i) =>
      b.labels[i]
        ? [
            Math.round(call),
            Math.round(b.puts[i] ?? 0),
            b.callOi[i] ?? 0,
            b.putOi[i] ?? 0,
            b.labels[i] as string,
          ]
        : null,
    ),
    curve: b.calls.map((_, i) => {
      const value = curveAt(curve, b.low + (i + 0.5) * b.step);
      return value === null ? null : Math.round(value);
    }),
  };
  const axes = esc(
    JSON.stringify({ l: ["usd", -peak, peak, sym], r: ["usd", -curvePeak, curvePeak, sym] }),
  );
  const idle = tr(
    "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it",
    {
      net: `<b class="${tone(exposure.net_gex_usd)}">${signedUsd(exposure.net_gex_usd, sym)}</b>`,
      spot: formatPrice(spot),
      bars: `<span class="gx-v gx-v-split">${tr("bars are each strike's calls and puts")}</span><span class="gx-v gx-v-net">${tr("bars are each strike's calls and puts added")}</span>`,
    },
  );
  const beyond =
    b.beyond > 0
      ? `<p class="fchart-note dim">${tr(
          "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.",
          { pct: `${Math.round(b.range * 100)}%`, usd: formatUsd(b.beyond, sym) },
        )}</p>`
      : "";
  const moveKey = move
    ? `<span><i class="gx-key-em"></i>${tr("expected move, 1σ and 2σ, {horizon}", { horizon: horizonName(move) })}</span>`
    : "";
  const flipKey =
    exposure.flip_price !== null
      ? `<span><i class="gx-key-flip"></i>${tr("flip {price}", { price: formatPrice(level(exposure.flip_price)) })}</span>`
      : "";

  return `<figure class="fchart cvd-chart gx-chart" data-live="gamma-chart" data-cursors>
<div class="fchart-head"><p class="fchart-title">${tr("{currency} · {source} options · gamma exposure by strike · {scope}", { currency: esc(currency), source: esc(publisher(exposure.source).name), scope: scopeName })}</p><div class="fchart-keys"><span class="gx-v gx-v-split"><i class="gx-key-call"></i>${tr("Calls")}</span><span class="gx-v gx-v-split"><i class="gx-key-put"></i>${tr("Puts")}</span><span class="gx-v gx-v-net"><i class="gx-key-call"></i>${tr("Net long")}</span><span class="gx-v gx-v-net"><i class="gx-key-put"></i>${tr("Net short")}</span><span class="gx-v gx-v-zone"><i class="gx-key-zs"></i>${tr("short gamma")}</span><span class="gx-v gx-v-zone"><i class="gx-key-zl"></i>${tr("long gamma")}</span><span><i class="gx-key-curve"></i>${tr("Net if the spot moved there")}</span><span><i class="gx-key-spot"></i>${tr("Spot")}</span>${flipKey}${moveKey}${gammaViewSwitch()}${slotCursorSwitch()}</div><p class="fchart-read slot-read" aria-live="polite">${idle}</p></div>
<div class="slot-area" tabindex="0" role="group" aria-label="${esc(tr("{currency} strike bands; arrow keys read one at a time", { currency: esc(currency) }))}">
<div class="fchart-plot gx-plot" data-axes="${axes}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{currency} options gamma exposure by strike", { currency: esc(currency) }))}"><g class="gx-v gx-v-zone">${zoneRects}</g>${grid}${SLOT_BAND}<line class="cvd-zero" x1="0" x2="1000" y1="500" y2="500"></line><g class="gx-v gx-v-split">${bars}</g><g class="gx-v gx-v-net">${netBars}</g>${line}${moveLines}${vertical(exposure.flip_price, "gx-flip")}${vertical(spot, "gx-spot")}${SLOT_CURSOR}${SLOT_HAIR}</svg>${leftLabels}${rightLabels}${xLabels}${zoneLabels}</div>
</div>
${beyond}
${slotData(payload)}
</figure>`;
}

function tiles(e: GammaExposure): string {
  const sym = unitSymbol(e.unit);
  const ratio = e.call_oi > 0 ? (e.put_oi / e.call_oi).toFixed(2) : "–";
  const flip =
    e.flip_price === null
      ? `<p class="cvd-big dim">${tr("none")}</p><p class="dim">${tr("net gamma keeps one sign within ±30% of the spot")}</p>`
      : `<p class="cvd-big"><span data-u="flip">${formatPrice(level(e.flip_price))}</span></p><p class="dim">${tr("{pct} from spot; net gamma changes sign here", { pct: signedPct(e.flip_price / e.spot - 1) })}</p>`;
  const wall = (price: number | null, cls: string, key: string) =>
    price === null
      ? `<span class="dim">–</span>`
      : `<span class="${cls}" data-u="${key}">${formatPrice(price)}</span>`;
  return `<div class="cvd-tiles" data-live="gamma-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Net gamma exposure")}</p><p class="cvd-big ${tone(e.net_gex_usd)}"><span data-u="net">${signedUsd(e.net_gex_usd, sym)}</span></p><p class="dim">${
    e.net_gex_usd >= 0
      ? tr("per 1% move · dealers long gamma: their hedging damps moves")
      : tr("per 1% move · dealers short gamma: their hedging adds to moves")
  }</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Gamma flip")}</p>${flip}</div>
<div class="cvd-tile"><p class="eyebrow">${tr("Call wall / put wall")}</p><p class="cvd-big">${wall(e.call_wall, "lq-ink-l", "call-wall")} / ${wall(e.put_wall, "lq-ink-s", "put-wall")}</p><p class="dim">${tr("the strikes holding the most call and put gamma")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Open interest")}</p><p class="cvd-big"><span class="lq-ink-l" data-u="call-oi">${formatUsd(e.call_oi * e.spot, sym)}</span> / <span class="lq-ink-s" data-u="put-oi">${formatUsd(e.put_oi * e.spot, sym)}</span></p><p class="dim">${
    e.expiries === 1
      ? tr("calls / puts at the spot · put/call {ratio} · {options} options, one expiry", {
          ratio,
          options: e.options,
        })
      : tr("calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries", {
          ratio,
          options: e.options,
          expiries: e.expiries,
        })
  }</p></div>
</div>`;
}

function leftText(expiry: Date, now: number): string {
  const ms = expiry.getTime() - now;
  // An end-of-day file is read the evening after its close, so its nearest expiry may be gone by then.
  if (ms <= 0) return tr("expired");
  if (ms < 86_400_000) return formatDuration(ms / 1000);
  return tr("{d}d {h}h", {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
  });
}

function expiryTable(data: {
  currency: string;
  exposure: GammaExposure;
  expiries: readonly GammaExpiry[];
  scope: GammaScope;
  now: number;
}): string {
  const { currency, exposure, expiries, scope, now } = data;
  if (expiries.length === 0) return "";
  const sym = unitSymbol(exposure.unit);
  // Deribit's open interest is in coins, which a crypto reader counts in; a share or an index unit
  // says little as a count, so the other books give its value at the spot.
  const coins = exposure.source === "deribit";
  const oi = (units: number) =>
    coins ? Math.round(units).toLocaleString("en-US") : formatUsd(units * exposure.spot, sym);
  const total = expiries.reduce(
    (sum, x) => sum + Math.abs(x.call_gex_usd) + Math.abs(x.put_gex_usd),
    0,
  );
  const rows = expiries
    .map((x) => {
      const net = x.call_gex_usd + x.put_gex_usd;
      const share = total > 0 ? (Math.abs(x.call_gex_usd) + Math.abs(x.put_gex_usd)) / total : 0;
      const shown = inScope(scope, x.expiry, exposure.next_expiry, exposure.computed_at);
      return `<tr data-k="${x.expiry.getTime()}"${shown ? "" : ' class="gx-out"'}>
<td>${dayLabel(x.expiry)} <span class="dim">${x.expiry.getUTCFullYear()}</span></td>
<td class="num dim">${leftText(x.expiry, now)}</td>
<td class="num">${x.options}</td>
<td class="num">${x.atm_iv === null ? '<span class="dim">–</span>' : `${(x.atm_iv * 100).toFixed(1)}%`}</td>
<td class="num">${oi(x.call_oi)}</td>
<td class="num">${oi(x.put_oi)}</td>
<td class="num lq-ink-l">${signedUsd(x.call_gex_usd, sym)}</td>
<td class="num lq-ink-s">${signedUsd(x.put_gex_usd, sym)}</td>
<td class="num ${tone(net)}"><span data-u="net">${signedUsd(net, sym)}</span></td>
<td class="num dim">${Math.round(share * 100)}%</td>
</tr>`;
    })
    .join("");
  return `<h2 class="cvd-h2 wm-h2">${tr("By expiry")}</h2>
<div class="sheet-wrap"><table class="sheet gx-table">
<thead><tr><th>${tr("Expiry")}</th><th class="num">${tr("Left")}</th><th class="num">${tr("Options")}</th><th class="num" title="${esc(tr("Implied volatility at the expiry's forward, a year"))}">${tr("ATM IV")}</th><th class="num">${coins ? tr("Call OI ({unit})", { unit: esc(currency) }) : tr("Call OI")}</th><th class="num">${coins ? tr("Put OI ({unit})", { unit: esc(currency) }) : tr("Put OI")}</th><th class="num">${tr("Calls")}</th><th class="num">${tr("Puts")}</th><th class="num">${tr("Net")}</th><th class="num" title="${esc(tr("Of the chain's exposure, either sign counted"))}">${tr("Share")}</th></tr></thead>
<tbody data-live="gamma-expiries">${rows}</tbody>
</table></div>
<p class="notes">${
    coins
      ? tr(
          "Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.",
        )
      : tr(
          "Exposure in {unit} per 1% move; open interest at its value at the spot. Expiries outside the chosen range are dimmed; an option in its last hour is left out.",
          { unit: esc(exposure.unit) },
        )
  }</p>`;
}

/** The horizon the chart draws the expected move for: the scope's own, and 30 days for all expiries. */
const SCOPE_HORIZON: Readonly<Record<GammaScope, MoveHorizon>> = {
  next: "next",
  "7d": "7d",
  "30d": "30d",
  all: "30d",
};

/** "to the 21 Oct expiry", "1 day ahead". */
function horizonName(m: ExpectedMove): string {
  switch (m.horizon) {
    case "next":
      return tr("to the {date} expiry", { date: m.expiry ? dayLabel(m.expiry) : "" });
    case "1d":
      return tr("1 day ahead");
    case "7d":
      return tr("1 week ahead");
    case "30d":
      return tr("30 days ahead");
  }
}

const pctText = (fraction: number) => `${(fraction * 100).toFixed(fraction < 0.1 ? 2 : 1)}%`;

/** One horizon of the mind map: its node (when and the IV) and its leaves (the move and the walls). */
function moveBranch(m: ExpectedMove): string {
  // Prices bare, as the tab's spot, flip and walls are: the book's own currency.
  const price = (v: number) => formatPrice(level(v));
  const hits = m.hits
    ? `<li class="em-hits">${tr("closed inside 1σ on {one} and 2σ on {two} of days since {year}", {
        one: `<b>${Math.round((100 * m.hits.inside_1s) / m.hits.samples)}%</b>`,
        two: `<b>${Math.round((100 * m.hits.inside_2s) / m.hits.samples)}%</b>`,
        year: m.hits.first_day.slice(0, 4),
      })}</li>`
    : "";
  const when =
    m.horizon === "next"
      ? `${tr("Next expiry")} <span class="dim">${m.expiry ? dayLabel(m.expiry) : ""}</span>`
      : horizonName(m);
  return `<li class="em-branch" data-k="${m.horizon}"><div class="em-node"><span class="em-when">${when}</span><span class="em-iv">${tr("IV {iv}", { iv: pctText(m.iv) })}</span></div><ul class="em-leaves" role="list">
<li class="em-move">±${price(m.move)} <span class="dim">±${pctText(m.pct)}</span></li>
<li><i class="em-sw em-sw1"></i>1σ ${price(m.low1)} – ${price(m.high1)}</li>
<li><i class="em-sw em-sw2"></i>2σ ${price(m.low2)} – ${price(m.high2)}</li>
${hits}</ul></li>`;
}

/**
 * The expected move as one mind map: the book and its spot at the centre, a branch per horizon
 * (next expiry and a day ahead to the left, a week and 30 days to the right), each with its leaves --
 * the move, the 1σ and 2σ walls and, for BTC and ETH, how often price really ended inside them.
 * Nested lists, so it reads in order as text; the CSS draws the connectors, and folds it into one
 * column on a phone.
 */
function expectedMoveMap(data: {
  currency: string;
  exposure: GammaExposure;
  moves: readonly ExpectedMove[];
}): string {
  const { currency, exposure, moves } = data;
  if (moves.length === 0) return "";
  const near = moves.filter((m) => m.horizon === "next" || m.horizon === "1d");
  const far = moves.filter((m) => m.horizon === "7d" || m.horizon === "30d");
  const side = (list: readonly ExpectedMove[], cls: string) =>
    list.length
      ? `<ul class="em-side ${cls}" role="list">${list.map((m) => moveBranch(m)).join("")}</ul>`
      : "";
  const checked = moves.some((m) => m.hits !== null);
  return `<section class="em" aria-labelledby="em-h">
<h2 class="cvd-h2 wm-h2" id="em-h">${tr("Expected price move")}</h2>
<div class="em-map${near.length ? " em-has-l" : ""}${far.length ? " em-has-r" : ""}" data-live="gamma-move"><div class="em-root"><span class="em-cur">${esc(currency)}</span><span class="em-spot">${formatPrice(exposure.spot)}</span><span class="dim">${tr("spot · {source} IV", { source: esc(publisher(exposure.source).name) })}</span></div>${side(near, "em-l")}${side(far, "em-r")}</div>
<p class="notes">${tr(
    "One standard deviation is the price × IV × √(days/365), from each expiry's at-the-money implied volatility (between two expiries, their total variance interpolated). The walls are one and two deviations either side of the spot. A normal distribution ends inside them 68% and 95% of the time; real prices have fatter tails, and options usually price in more movement than follows.",
  )}${
    checked
      ? ` ${tr(
          "The last line of a branch is how often it really did, from Deribit's 30-day volatility index (DVOL) and the perpetual's daily settlement: one 30-day IV for every horizon, and overlapping windows, so frequencies rather than independent trials.",
        )}`
      : ""
  }</p>
</section>`;
}

/** The address that switches the tab to other choices. */
const choiceHref = (heatmap: HeatmapParams, next: GammaParams) =>
  `/rates${heatmapToQuery(heatmap, next)}#gamma`;

/** The link that switches the tab to other choices, in place (GX_SWAP_SCRIPT) or as a plain page. */
function choice(
  heatmap: HeatmapParams,
  next: GammaParams,
  label: string,
  on: boolean,
  empty = false,
): string {
  const none = empty ? ` class="gx-none" title="${esc(tr("No expiry in this range"))}"` : "";
  return `<a href="${esc(choiceHref(heatmap, next))}"${none} data-gx-swap${on ? ' aria-current="true"' : ""}>${label}</a>`;
}

/** The books in the picker's order: by region, each region's in BOOK_NAMES order, then by ticker. */
export function sortBooks(books: readonly GammaBook[]): GammaBook[] {
  const region = (b: GammaBook) => REGIONS.findIndex(([r]) => r === publisher(b.source).region);
  const rank = (b: GammaBook) => {
    const at = BOOK_ORDER.indexOf(b.currency);
    return at < 0 ? BOOK_ORDER.length : at;
  };
  return [...books].sort(
    (a, b) =>
      region(a) - region(b) ||
      rank(a) - rank(b) ||
      (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0),
  );
}

/**
 * The book picker (picker.ts's dropdown, as on the whales and CVD pages): the charted book as the
 * button, and under it every book the collector has stored, grouped by region, each row a small
 * reading of its own -- spot, net exposure, how its gamma splits between calls and puts, where its
 * flip sits from the spot, and how old it is -- so a reader can pick one by what it shows. Each row is
 * a plain link that the swap script takes in place; filtering, arrows and Escape are PICK_SCRIPT's.
 */
function bookPicker(data: {
  books: readonly GammaBook[];
  heatmap: HeatmapParams;
  params: GammaParams;
  now: number;
}): string {
  const { heatmap, params, now } = data;
  const books = sortBooks(data.books);
  const row = (b: GammaBook) => {
    const pub = publisher(b.source);
    const sym = unitSymbol(b.unit);
    const on = b.currency === params.currency;
    const gamma = b.call_gex_usd - b.put_gex_usd;
    const callShare = gamma > 0 ? (b.call_gex_usd / gamma) * 100 : 50;
    const flip =
      b.flip_price === null
        ? `<span class="num dim">–</span>`
        : `<span class="num">${signedPct(b.flip_price / b.spot - 1)}</span>`;
    const late = freshness(b.source, b.computed_at, now) !== "fresh";
    // Found by its ticker, its name in English and in the page's language, its exchange and its unit.
    const words = [b.currency, BOOK_NAMES[b.currency] ?? "", rawName(b.currency), pub.name, b.unit]
      .join(" ")
      .toLowerCase();
    return `<a class="wh-pick-row${on ? " on" : ""}" href="${esc(choiceHref(heatmap, { ...params, currency: b.currency }))}" data-gx-swap data-q="${esc(words)}"${on ? ' aria-current="true"' : ""}>
<span class="wh-pick-sym"><b>${esc(b.currency)}</b><small>${bookName(b.currency)}</small></span>
<span class="num">${formatPrice(level(b.spot))}</span>
<span class="num ${tone(b.net_gex_usd)}">${signedUsd(b.net_gex_usd, sym)}</span>
<span class="wh-pick-book"><span class="wh-pick-bar" title="${esc(tr("calls {calls} · puts {puts}", { calls: signedUsd(b.call_gex_usd, sym), puts: signedUsd(b.put_gex_usd, sym) }))}"><i class="wh-pick-bid" style="width:${callShare.toFixed(1)}%"></i><i class="wh-pick-ask" style="width:${(100 - callShare).toFixed(1)}%"></i></span></span>
${flip}
<span class="gx-pick-when${late ? " gx-late" : " dim"}">${esc(pub.name)} · ${asOfText(b.source, b.computed_at, now)}</span>
</a>`;
  };
  const groups = REGIONS.map(([region, label]) => {
    const list = books.filter((b) => publisher(b.source).region === region);
    if (list.length === 0) return "";
    return `<p class="wh-pick-group">${trMsg(label)} <span class="dim">${list.length}</span></p>${list.map(row).join("")}`;
  }).join("");
  const current = books.find((b) => b.currency === params.currency);
  const summary = current
    ? `<b>${esc(current.currency)}</b><span class="gx-pick-name">${bookName(current.currency)}</span><span class="num ${tone(current.net_gex_usd)}">${signedUsd(current.net_gex_usd, unitSymbol(current.unit))}</span>`
    : `<b>${esc(params.currency)}</b>`;
  return `<details class="wh-pick gx-pick">
<summary class="wh-pick-btn" aria-label="${esc(tr("Pick an option book"))}">${summary}<span class="wh-pick-more dim">${tr("{n} books", { n: books.length })}</span></summary>
<div class="wh-pick-panel">
<input class="wh-pick-q" type="search" placeholder="${esc(tr("Filter books"))}" aria-label="${esc(tr("Filter books"))}" autocomplete="off" hidden>
<div class="wh-pick-head" aria-hidden="true"><span>${tr("Book")}</span><span class="num">${tr("Spot")}</span><span class="num" title="${esc(tr("Every expiry, per 1% move, in the currency the contract pays"))}">${tr("Net gamma")}</span><span>${tr("Calls / puts")}</span><span class="num" title="${esc(tr("Where net gamma changes sign, from the spot"))}">${tr("Flip")}</span><span>${tr("As of")}</span></div>
<nav class="wh-pick-list" aria-label="${esc(tr("Option book"))}">${groups}</nav>
<p class="wh-pick-none dim" hidden>${tr("No book matches.")}</p>
</div>
</details>`;
}

/** The tab's body, from its controls down. `data` is null when the read failed. */
export function gammaPanel(view: {
  data: GammaData | null;
  params: GammaParams;
  heatmap: HeatmapParams;
  now: number;
}): string {
  const { data, params, heatmap, now } = view;
  const next = data?.scopes[0]?.next_expiry ?? null;
  const books = data?.books ?? [];
  // Before the collector has stored any book, the one asked for stands alone where the picker goes.
  const picker = books.length
    ? bookPicker({ books, heatmap, params, now })
    : `<nav class="tf" aria-label="${esc(tr("Option book"))}">${choice(heatmap, params, esc(params.currency), true)}</nav>`;
  // A range the book has no expiry in stays a link, dimmed: the tab then says when its nearest is.
  const stored = new Set(data?.scopes.map((e) => e.scope));
  const scopes = GAMMA_SCOPES.map((scope) =>
    choice(
      heatmap,
      { ...params, scope },
      scopeLabel(scope, next),
      scope === params.scope,
      stored.size > 0 && !stored.has(scope),
    ),
  ).join("");
  const controls = `<div class="lq-controls gx-controls" data-loading="${esc(tr("Loading {asset}…"))}">${picker}<nav class="tf" aria-label="${esc(tr("Expiries"))}">${scopes}</nav>${helpButton("rates-gamma")}</div>
${helpPanel(
  "rates-gamma",
  `<p>${tr(
    "Gamma exposure is how much of the underlying the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, per 1% move in the currency the contract pays, added up by strike.",
  )}</p><p>${tr(
    "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.",
  )}</p><p>${tr(
    "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.",
  )}</p><p>${tr(
    "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).",
  )}</p><p>${tr(
    "The expected move is the range the options have priced in: one standard deviation is the price times the at-the-money implied volatility times the square root of the days ahead over 365, and the walls sit one and two deviations either side of the spot. The chart draws them for the chosen expiries (30 days ahead for all of them); the mind map under it gives every horizon. They are not support or resistance, only the market's own estimate of how far price may travel.",
  )}</p><p>${tr(
    "Crypto: Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.",
  )}</p><p>${tr(
    "United States: Cboe's 15-minute delayed chains for the S&amp;P 500, Nasdaq-100 and Russell 2000 indexes and the most traded ETFs and stocks, with Cboe's own volatility and open interest, the spot taken as the forward. Read every 15 minutes through the US session; outside it the figures are the last session's.",
  )}</p><p>${tr(
    "Asia-Pacific and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, its three nearest months), ASX (S&amp;P/ASX 200), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement (for ASX, its closing theoretical price) with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.",
  )}</p>`,
)}`;

  if (data === null) {
    return `${controls}<p class="empty">${tr("The options data could not be read right now.")}</p>`;
  }
  const exposure = data.exposure;
  if (exposure === null) {
    const first = data.scopes[0];
    if (first) {
      return `${controls}<p class="empty">${tr(
        "No {currency} option expires in this range; the nearest expires {date}.",
        { currency: esc(data.currency), date: dayLabel(first.next_expiry) },
      )}</p>`;
    }
    return `${controls}<p class="empty">${tr("No gamma exposure has been computed for {currency} yet.", { currency: esc(data.currency) })}</p>`;
  }
  const pub = publisher(exposure.source);
  const fresh = freshness(exposure.source, exposure.computed_at, now);
  if (fresh === "dead") {
    return `${controls}<p class="empty">${tr(
      "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.",
      {
        source: esc(pub.name),
        currency: esc(data.currency),
        ago: agoText(exposure.computed_at, now),
      },
    )}</p>`;
  }
  const scopeName = scopeLabel(params.scope, exposure.next_expiry);
  const stale =
    fresh !== "late"
      ? ""
      : pub.cadence === "live"
        ? `<p class="notes gx-stale">${tr("Not updated since {ago}: the latest read of {source} failed, so these figures are that old.", { ago: agoText(exposure.computed_at, now), source: esc(pub.name) })}</p>`
        : `<p class="notes gx-stale">${tr("Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.", { ago: agoText(exposure.computed_at, now), source: esc(pub.name) })}</p>`;
  const moves = expectedMoves({
    expiries: data.expiries,
    bands: data.bands,
    spot: exposure.spot,
    at: exposure.computed_at,
    nextExpiry: exposure.next_expiry,
  });
  const chart =
    data.strikes.length === 0
      ? `<p class="empty">${tr("No strike has open interest in this range.")}</p>`
      : gammaChart({
          currency: data.currency,
          exposure,
          strikes: data.strikes,
          curve: data.curve,
          scopeName,
          move: moves.find((m) => m.horizon === SCOPE_HORIZON[params.scope]) ?? null,
        });
  const asOf =
    pub.cadence === "live"
      ? tr("read {ago}", { ago: agoText(exposure.computed_at, now) })
      : pub.cadence === "session"
        ? tr("15-minute delayed, read {ago}", { ago: agoText(exposure.computed_at, now) })
        : tr("from the end-of-day file for {date}", { date: dayLabel(exposure.computed_at) });
  return `${controls}
${stale}${tiles(exposure)}
${chart}
<p class="notes">${tr("Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. {source} options, {asof}.", { source: esc(pub.name), asof: `<span data-live="gamma-asof">${asOf}</span>` })}</p>
${expectedMoveMap({ currency: data.currency, exposure, moves })}
${expiryTable({ currency: data.currency, exposure, expiries: data.expiries, scope: params.scope, now })}`;
}

/**
 * The tab on its own, for `/rates?panel=gamma`: what tabs.ts loads into the placeholder and what the
 * swap script and live.ts read it from. A bare fragment, not a page; `data-rendered` lets live.ts
 * tell a fresh copy from the one it shows.
 */
export function gammaFragment(view: Parameters<typeof gammaPanel>[0]): string {
  return `<div class="lazy-body" data-rendered="${view.now}">${gammaPanel(view)}</div>`;
}

/** Where the tab loads itself from: the page's own address and choices, plus `panel=gamma`. */
export function gammaPanelHref(heatmap: HeatmapParams, params: GammaParams): string {
  return `/rates${heatmapToQuery(heatmap, params)}&panel=gamma`;
}

/** The tab's placeholder, when this render did not read it (chart-skeleton.ts). */
export function gammaPlaceholder(heatmap: HeatmapParams, params: GammaParams): string {
  return lazyPlaceholder(`/rates${heatmapToQuery(heatmap, params)}#gamma`);
}

/**
 * The view switch (gammaViewSwitch): the reader's choice, kept in localStorage "gamma-view", goes on
 * <html> as data-gxview, which the CSS reads, so the figure a refresh or a book switch brings in is
 * drawn the same way. Each new copy of the switch arrives hidden and pressed as the server had it,
 * and is set to the reader's choice as it arrives.
 */
export const GX_VIEW_SCRIPT = `(() => {
  if (window.airratesGammaView) return;
  window.airratesGammaView = true;
  const views = ${JSON.stringify(GAMMA_VIEWS)};
  let view = "split";
  try { const kept = localStorage.getItem("gamma-view"); if (views.includes(kept)) view = kept; } catch (_) {}
  const sync = () => {
    document.documentElement.dataset.gxview = view;
    for (const group of document.querySelectorAll(".gx-views")) {
      group.hidden = false;
      for (const button of group.querySelectorAll(".gx-view")) {
        const on = String(button.dataset.gxView === view);
        if (button.getAttribute("aria-pressed") !== on) button.setAttribute("aria-pressed", on);
      }
    }
  };
  sync();
  new MutationObserver(() => {
    if (document.querySelector('.gx-views[hidden], .gx-view[aria-pressed="true"]:not([data-gx-view="' + view + '"])')) sync();
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    const button = event.target.closest ? event.target.closest(".gx-view") : null;
    if (!button || !views.includes(button.dataset.gxView)) return;
    view = button.dataset.gxView;
    try { localStorage.setItem("gamma-view", view); } catch (_) {}
    sync();
  });
})();`;

/**
 * Switches the tab's book and expiries in place: fetches the choice's `?panel=gamma`, swaps it in,
 * pushes the address, and points the tab's data-lazy at it so tabs.ts and live.ts refresh the copy
 * the reader chose. Anything that goes wrong falls back to loading the link as a page.
 *
 * While it loads, every section says so: the picker closes on the chosen row, the chart (or the
 * empty-tab message) gives way to the loading chart (chart-skeleton.ts), "Loading NK225…", and the
 * tiles, notes and expiry table pulse (layout.ts .chart-switching).
 */
export const GX_SWAP_SCRIPT = `(() => {
  const panel = document.getElementById("${GAMMA_PANEL_ID}");
  if (!panel || !window.fetch || !window.DOMParser || !history.pushState) return;
  let busy = false;
  ${CHART_SKELETON_JS}
  const placehold = (href, link) => {
    const pick = panel.querySelector(".gx-pick");
    if (pick) pick.open = false;
    if (link && link.classList.contains("wh-pick-row")) {
      for (const row of panel.querySelectorAll(".wh-pick-row.on")) row.classList.remove("on");
      link.classList.add("on");
    }
    const controls = panel.querySelector(".gx-controls");
    const book = (new URL(href, location.href).searchParams.get("gex") || "${GAMMA_DEFAULT_BOOK}").toUpperCase();
    const label = ((controls && controls.dataset.loading) || "").replace("{asset}", book);
    const chart = panel.querySelector(".gx-chart");
    const empty = panel.querySelector(".gx-controls ~ .empty");
    if (chart) skeletonInto(chart, label);
    else if (empty) empty.replaceWith(chartSkeleton(label));
  };
  const panelUrl = (href) => {
    const url = new URL(href, location.href);
    url.hash = "";
    url.searchParams.set("panel", "gamma");
    return url.pathname + url.search;
  };
  const load = async (href, push, link) => {
    busy = true;
    placehold(href, link);
    panel.classList.add("chart-switching");
    panel.setAttribute("aria-busy", "true");
    try {
      const url = panelUrl(href);
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const body = new DOMParser().parseFromString(await res.text(), "text/html").querySelector(".lazy-body");
      if (!body) throw new Error("no panel");
      if (push) history.pushState(null, "", href);
      panel.replaceChildren(document.importNode(body, true));
      panel.setAttribute("data-lazy", url);
      panel.dataset.lazyState = "loaded";
      panel.dataset.loadedAt = String(Date.now());
      if (window.airratesHelp) window.airratesHelp(panel);
    } catch (_) {
      location.href = href;
      return;
    }
    panel.classList.remove("chart-switching");
    panel.removeAttribute("aria-busy");
    busy = false;
  };
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || !event.target.closest) return;
    const link = event.target.closest("a[data-gx-swap]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!busy) load(link.href, true, link);
  });
  addEventListener("popstate", () => {
    if (location.pathname !== "/rates") { location.reload(); return; }
    if (!busy && panel.dataset.lazyState === "loaded") load(location.href, false);
  });
})();`;
