import type { GammaData, GammaExpiry, GammaExposure, GammaPoint, GammaStrike } from "../app/data";
import {
  GAMMA_CURRENCIES,
  GAMMA_SCOPES,
  type GammaParams,
  type GammaScope,
  type HeatmapParams,
  heatmapToQuery,
} from "../app/params";
import { ageText, esc, formatDuration, formatPrice, formatUsd } from "./format";
import { helpButton, helpPanel } from "./help";
import { tr, trMsg } from "./i18n";
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
 * The Rates page's Gamma Exposure tab: Deribit's BTC and ETH options as dealer gamma by strike
 * (collector internal/gamma, migration 034).
 *
 * WHAT THE NUMBERS ARE. Each option's gamma times its open interest times the forward squared times
 * 1%: the dollars of the coin a hedger holding that open interest trades for a 1% move. Open interest,
 * mark IV and the forward are Deribit's; gamma is Black-76 on them, computed by the collector.
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

/** Older than this, the tab says the figures are as old as they are. */
export const GAMMA_STALE_MS = 20 * 60_000;
/** Older than this, it shows none: an options book half a day old is not today's positioning. */
export const GAMMA_REFUSE_MS = 6 * 3600_000;
/** The chart's reach either side of the spot, narrowest first, and the share of exposure it must hold. */
const RANGES = [0.05, 0.1, 0.15, 0.2, 0.3] as const;
const COVER = 0.9;
/** At most this many bands across, before the strikes' own spacing widens them. */
const MAX_BANDS = 60;
const MINUS = "−";
/** The id tabs.ts and the swap script find the tab by. */
export const GAMMA_PANEL_ID = "panel-rates-gamma";

/** "+$29.8M", "−$49.8M": exposure always carries its sign. */
export const signedUsd = (usd: number) => `${usd > 0 ? "+" : ""}${formatUsd(usd)}`;

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
}): string {
  const { currency, exposure, strikes, curve, scopeName } = data;
  const spot = exposure.spot;
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
  const levels = [0.25, 0.5, 0.75];
  const grid = levels
    .map((f) => `<line class="cvd-grid" x1="0" x2="1000" y1="${f * 1000}" y2="${f * 1000}"></line>`)
    .join("");
  const axisText = (usd: number) => (usd === 0 ? "$0" : signedUsd(usd));
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
      return `<span class="cvd-x${t === 0 ? " wm-x-mark" : ""}${n % 2 ? " x-alt" : ""}" style="left:${(x(price) / 10).toFixed(2)}%">${text}</span>`;
    })
    .join("");

  const payload: GammaSlots = {
    kind: "gex",
    low: b.low,
    step: b.step,
    spot,
    unit: currency,
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
  const axes = esc(JSON.stringify({ l: ["usd", -peak, peak], r: ["usd", -curvePeak, curvePeak] }));
  const idle = tr(
    "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it",
    {
      net: `<b class="${tone(exposure.net_gex_usd)}">${signedUsd(exposure.net_gex_usd)}</b>`,
      spot: formatPrice(spot),
      bars: `<span class="gx-v gx-v-split">${tr("bars are each strike's calls and puts")}</span><span class="gx-v gx-v-net">${tr("bars are each strike's calls and puts added")}</span>`,
    },
  );
  const beyond =
    b.beyond > 0
      ? `<p class="fchart-note dim">${tr(
          "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.",
          { pct: `${Math.round(b.range * 100)}%`, usd: formatUsd(b.beyond) },
        )}</p>`
      : "";
  const flipKey =
    exposure.flip_price !== null
      ? `<span><i class="gx-key-flip"></i>${tr("flip {price}", { price: formatPrice(level(exposure.flip_price)) })}</span>`
      : "";

  return `<figure class="fchart cvd-chart gx-chart" data-live="gamma-chart" data-cursors>
<div class="fchart-head"><p class="fchart-title">${tr("{currency} · Deribit options · gamma exposure by strike · {scope}", { currency, scope: scopeName })}</p><div class="fchart-keys"><span class="gx-v gx-v-split"><i class="gx-key-call"></i>${tr("Calls")}</span><span class="gx-v gx-v-split"><i class="gx-key-put"></i>${tr("Puts")}</span><span class="gx-v gx-v-net"><i class="gx-key-call"></i>${tr("Net long")}</span><span class="gx-v gx-v-net"><i class="gx-key-put"></i>${tr("Net short")}</span><span class="gx-v gx-v-zone"><i class="gx-key-zs"></i>${tr("short gamma")}</span><span class="gx-v gx-v-zone"><i class="gx-key-zl"></i>${tr("long gamma")}</span><span><i class="gx-key-curve"></i>${tr("Net if the spot moved there")}</span><span><i class="gx-key-spot"></i>${tr("Spot")}</span>${flipKey}${gammaViewSwitch()}${slotCursorSwitch()}</div><p class="fchart-read slot-read" aria-live="polite">${idle}</p></div>
<div class="slot-area" tabindex="0" role="group" aria-label="${esc(tr("{currency} strike bands; arrow keys read one at a time", { currency }))}">
<div class="fchart-plot gx-plot" data-axes="${axes}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{currency} options gamma exposure by strike", { currency }))}"><g class="gx-v gx-v-zone">${zoneRects}</g>${grid}${SLOT_BAND}<line class="cvd-zero" x1="0" x2="1000" y1="500" y2="500"></line><g class="gx-v gx-v-split">${bars}</g><g class="gx-v gx-v-net">${netBars}</g>${line}${vertical(exposure.flip_price, "gx-flip")}${vertical(spot, "gx-spot")}${SLOT_CURSOR}${SLOT_HAIR}</svg>${leftLabels}${rightLabels}${xLabels}${zoneLabels}</div>
</div>
${beyond}
${slotData(payload)}
</figure>`;
}

function tiles(e: GammaExposure): string {
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
<div class="cvd-tile"><p class="eyebrow">${tr("Net gamma exposure")}</p><p class="cvd-big ${tone(e.net_gex_usd)}"><span data-u="net">${signedUsd(e.net_gex_usd)}</span></p><p class="dim">${
    e.net_gex_usd >= 0
      ? tr("per 1% move · dealers long gamma: their hedging damps moves")
      : tr("per 1% move · dealers short gamma: their hedging adds to moves")
  }</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Gamma flip")}</p>${flip}</div>
<div class="cvd-tile"><p class="eyebrow">${tr("Call wall / put wall")}</p><p class="cvd-big">${wall(e.call_wall, "lq-ink-l", "call-wall")} / ${wall(e.put_wall, "lq-ink-s", "put-wall")}</p><p class="dim">${tr("the strikes holding the most call and put gamma")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Open interest")}</p><p class="cvd-big"><span class="lq-ink-l" data-u="call-oi">${formatUsd(e.call_oi * e.spot)}</span> / <span class="lq-ink-s" data-u="put-oi">${formatUsd(e.put_oi * e.spot)}</span></p><p class="dim">${
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
<td class="num">${Math.round(x.call_oi).toLocaleString("en-US")}</td>
<td class="num">${Math.round(x.put_oi).toLocaleString("en-US")}</td>
<td class="num lq-ink-l">${signedUsd(x.call_gex_usd)}</td>
<td class="num lq-ink-s">${signedUsd(x.put_gex_usd)}</td>
<td class="num ${tone(net)}"><span data-u="net">${signedUsd(net)}</span></td>
<td class="num dim">${Math.round(share * 100)}%</td>
</tr>`;
    })
    .join("");
  return `<h2 class="cvd-h2 wm-h2">${tr("By expiry")}</h2>
<div class="sheet-wrap"><table class="sheet gx-table">
<thead><tr><th>${tr("Expiry")}</th><th class="num">${tr("Left")}</th><th class="num">${tr("Options")}</th><th class="num">${tr("Call OI ({unit})", { unit: esc(currency) })}</th><th class="num">${tr("Put OI ({unit})", { unit: esc(currency) })}</th><th class="num">${tr("Calls")}</th><th class="num">${tr("Puts")}</th><th class="num">${tr("Net")}</th><th class="num" title="${esc(tr("Of the chain's exposure, either sign counted"))}">${tr("Share")}</th></tr></thead>
<tbody data-live="gamma-expiries">${rows}</tbody>
</table></div>
<p class="notes">${tr("Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.")}</p>`;
}

/** The link that switches the tab to other choices, in place (GX_SWAP_SCRIPT) or as a plain page. */
function choice(heatmap: HeatmapParams, next: GammaParams, label: string, on: boolean): string {
  return `<a href="/rates${heatmapToQuery(heatmap, next)}#gamma" data-gx-swap${on ? ' aria-current="true"' : ""}>${label}</a>`;
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
  const currencies = GAMMA_CURRENCIES.map((currency) =>
    choice(heatmap, { ...params, currency }, currency, currency === params.currency),
  ).join("");
  const scopes = GAMMA_SCOPES.map((scope) =>
    choice(heatmap, { ...params, scope }, scopeLabel(scope, next), scope === params.scope),
  ).join("");
  const controls = `<div class="lq-controls gx-controls"><nav class="tf" aria-label="${esc(tr("Option book"))}">${currencies}</nav><nav class="tf" aria-label="${esc(tr("Expiries"))}">${scopes}</nav>${helpButton("rates-gamma")}</div>
${helpPanel(
  "rates-gamma",
  `<p>${tr(
    "Gamma exposure is how much of the coin the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, in dollars per 1% move, added up by strike.",
  )}</p><p>${tr(
    "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.",
  )}</p><p>${tr(
    "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.",
  )}</p><p>${tr(
    "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).",
  )}</p><p>${tr(
    "The options are Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.",
  )}</p>`,
)}`;

  if (data === null) {
    return `${controls}<p class="empty">${tr("The options data could not be read right now.")}</p>`;
  }
  const exposure = data.exposure;
  if (exposure === null) {
    return `${controls}<p class="empty">${tr("No gamma exposure has been computed for {currency} yet.", { currency: esc(data.currency) })}</p>`;
  }
  const age = now - exposure.computed_at.getTime();
  if (age > GAMMA_REFUSE_MS) {
    return `${controls}<p class="empty">${tr(
      "Deribit's {currency} options were last read {ago}, too long ago to show as current positioning.",
      { currency: esc(data.currency), ago: ageText(exposure.computed_at, now) },
    )}</p>`;
  }
  const scopeName = scopeLabel(params.scope, exposure.next_expiry);
  const stale =
    age > GAMMA_STALE_MS
      ? `<p class="notes gx-stale">${tr("Not updated since {ago}: the latest read of Deribit failed, so these figures are that old.", { ago: ageText(exposure.computed_at, now) })}</p>`
      : "";
  const chart =
    data.strikes.length === 0
      ? `<p class="empty">${tr("No strike has open interest in this range.")}</p>`
      : gammaChart({
          currency: data.currency,
          exposure,
          strikes: data.strikes,
          curve: data.curve,
          scopeName,
        });
  return `${controls}
${stale}${tiles(exposure)}
${chart}
<p class="notes">${tr("Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. Deribit only. Read {ago}.", { ago: `<span data-live="gamma-asof">${ageText(exposure.computed_at, now)}</span>` })}</p>
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

/**
 * The tab's placeholder, when this render did not read it: a spinner tabs.ts replaces with the tab
 * the first time it is shown, and a plain link for a reader without JavaScript.
 */
export function gammaPlaceholder(heatmap: HeatmapParams, params: GammaParams): string {
  const href = `/rates${heatmapToQuery(heatmap, params)}#gamma`;
  return `<div class="lazy-wait" role="status" data-fail="${esc(tr("This tab did not load."))}" data-retry="${esc(tr("Try again"))}"><span class="spin" aria-hidden="true"></span><span class="lazy-msg">${tr("Loading…")}</span><noscript><a href="${esc(href)}">${tr("Open this tab")}</a></noscript></div>`;
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
 */
export const GX_SWAP_SCRIPT = `(() => {
  const panel = document.getElementById("${GAMMA_PANEL_ID}");
  if (!panel || !window.fetch || !window.DOMParser || !history.pushState) return;
  let busy = false;
  const panelUrl = (href) => {
    const url = new URL(href, location.href);
    url.hash = "";
    url.searchParams.set("panel", "gamma");
    return url.pathname + url.search;
  };
  const load = async (href, push) => {
    busy = true;
    panel.classList.add("gx-switching");
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
    panel.classList.remove("gx-switching");
    panel.removeAttribute("aria-busy");
    busy = false;
  };
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || !event.target.closest) return;
    const link = event.target.closest("a[data-gx-swap]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!busy) load(link.href, true);
  });
  addEventListener("popstate", () => {
    if (location.pathname !== "/rates") { location.reload(); return; }
    if (!busy && panel.dataset.lazyState === "loaded") load(location.href, false);
  });
})();`;
