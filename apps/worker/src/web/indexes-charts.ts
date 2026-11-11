import type { IndexLevelRow } from "../app/data";
import { esc } from "./format";
import { niceStep } from "./gamma";
import { tr } from "./i18n";
import { THEMES } from "./themes";

/**
 * The World indexes tab's two charts, beside its table (owner, 2026-11-10, after a "who moved the
 * Nasdaq" bubble chart): a return map with one bubble per market, and every market's indexes by
 * return, one row per market.
 *
 * WHAT THE MAP PLOTS. The reference chart put each stock's return against its contribution to the
 * index, sized by its weight. The site has no weights for the world's markets, and inventing them
 * would be a figure it cannot source, so the map keeps the form and plots what the collector reads:
 * up the side the return over the window, along the bottom the latest session's change, both crossing
 * at zero so the quadrants read (up on the window but down today, and so on), and the bubble sized by
 * the market's typical daily move over the window -- a -2% day means less in a market that moves 2%
 * a day. One bubble per market, its first index in the table's order that has the history (the
 * headline: the S&P 500, the Nikkei 225, the Nifty 50 ...); the country chart shows the rest.
 *
 * SESSIONS, NOT CALENDAR DAYS. The closes are each UTC day's last quote, so a weekend or a holiday
 * is no close at all and "5 sessions" means the same span of trading everywhere. An index with too
 * little history for a window is left out of it and counted in a note -- most of the 58 were first
 * read on 2026-10-29, so the month fills in at the end of November. The tab opens on the month once
 * three in four have it.
 *
 * THREE COLOURS. Three hues are what a scatter can hold apart for every reader (the dataviz palette
 * validates three, not four, against each other on both surfaces), so the Middle East's two markets
 * ride with Europe: the Americas, Europe and the Middle East, Asia-Pacific.
 *
 * Volatility indexes (VIX, India VIX) stay out: their moves are not returns, and a VIX day of +15%
 * would set every axis.
 *
 * Server-rendered; IX_VIEW_SCRIPT (indexes.ts) switches the views, reads a mark on hover or tap and
 * places the map's labels where they do not collide, which only the browser can measure.
 */

export type ChartGroup = "am" | "eu" | "ap";

/** One index as the charts take it, in the table's order: a market's first index is its headline. */
export interface ChartIndex {
  ticker: string;
  /** Escaped HTML, as the table shows it. */
  name: string;
  /** The market, translated, plain text. */
  market: string;
  group: ChartGroup;
  row: IndexLevelRow;
}

export const VOLATILITY_INDEXES: ReadonlySet<string> = new Set(["VIX", "INDIAVIX"]);

export const IX_WINDOWS = [
  { id: "5d", sessions: 5, label: () => tr("5 days"), span: () => tr("the last 5 sessions") },
  { id: "1m", sessions: 21, label: () => tr("1 month"), span: () => tr("the last 21 sessions") },
] as const;
export type IxWindowId = (typeof IX_WINDOWS)[number]["id"];
type IxWindow = (typeof IX_WINDOWS)[number];

const GROUPS: { id: ChartGroup; label: () => string }[] = [
  { id: "am", label: () => tr("Americas") },
  { id: "eu", label: () => tr("Europe and the Middle East") },
  { id: "ap", label: () => tr("Asia-Pacific") },
];

/** An index over a window: its return, the latest session's change, its typical daily move. */
export interface IndexMove {
  /** Percent, the latest level against the close `sessions` sessions back. */
  ret: number;
  /** Percent, the latest level against the previous close; null without one. */
  day: number | null;
  /** Percent, the mean absolute daily change over the window. */
  swing: number;
}

export function indexMove(row: IndexLevelRow, sessions: number): IndexMove | null {
  const closes = row.closes;
  if (closes.length < sessions + 1) return null;
  const base = closes[closes.length - 1 - sessions] as number;
  if (!(base > 0) || !(row.price > 0)) return null;
  let sum = 0;
  let n = 0;
  for (let i = closes.length - sessions; i < closes.length; i++) {
    const before = closes[i - 1] as number;
    const after = closes[i] as number;
    if (before > 0 && after > 0) {
      sum += Math.abs(after / before - 1) * 100;
      n++;
    }
  }
  return {
    ret: (row.price / base - 1) * 100,
    day:
      row.prev_close !== null && row.prev_close > 0 ? (row.price / row.prev_close - 1) * 100 : null,
    swing: n > 0 ? sum / n : 0,
  };
}

/** The month once three equity indexes in four have a month of closes, the five days until then. */
export function defaultWindow(entries: readonly ChartIndex[]): IxWindowId {
  const equity = entries.filter((e) => !VOLATILITY_INDEXES.has(e.ticker));
  const month = IX_WINDOWS[1].sessions;
  const covered = equity.filter((e) => e.row.closes.length >= month + 1).length;
  return equity.length > 0 && covered >= 0.75 * equity.length ? "1m" : "5d";
}

const MINUS = "−";
const signed = (v: number, digits = 1): string =>
  `${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(v).toFixed(digits)}%`;
const tone = (v: number): string => (v > 0 ? " mc-up" : v < 0 ? " mc-down" : "");

/**
 * A zero-including axis over the values, padded so no mark sits on the frame, on round steps: of the
 * steps that give five to ten intervals, the one that wastes the least of the plot.
 */
export function axis(values: number[]): { from: number; to: number; ticks: number[] } {
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.06;
  lo -= lo < 0 ? pad : 0;
  hi += hi > 0 ? pad : 0;
  let best: { from: number; to: number; step: number } | null = null;
  for (let target = 5; target <= 10; target++) {
    const step = niceStep((hi - lo) / target);
    const from = Math.floor(lo / step) * step;
    const to = Math.ceil(hi / step) * step;
    if ((to - from) / step > 10) continue;
    if (!best || to - from < best.to - best.from - 1e-9) best = { from, to, step };
  }
  const { from, to, step } = best ?? { from: lo, to: hi, step: hi - lo };
  const ticks: number[] = [];
  for (let k = Math.round(from / step); k <= Math.round(to / step); k++) ticks.push(k * step);
  return { from, to, ticks };
}

const tickText = (v: number, ticks: number[]): string => {
  const step = ticks.length > 1 ? Math.abs((ticks[1] as number) - (ticks[0] as number)) : 1;
  const digits = Number.isInteger(step) ? 0 : Number.isInteger(step * 2) ? 1 : 2;
  return Math.abs(v) < 1e-9 ? "0" : signed(v, digits);
};

const legend = (extra: string): string =>
  `${GROUPS.map((g) => `<span class="fchart-key"><i class="ix-key ix-${g.id}"></i>${g.label()}</span>`).join("")}${extra}`;

/** The markets a window leaves out for want of history, as a note; nothing when none is. */
function missingNote(missing: number): string {
  return missing > 0
    ? `<p class="notes ix-missing">${tr("Markets with too little history for this window yet, left out: {n}.", { n: missing })}</p>`
    : "";
}

function marketsOf(entries: readonly ChartIndex[]): Set<string> {
  return new Set(entries.filter((e) => !VOLATILITY_INDEXES.has(e.ticker)).map((e) => e.market));
}

/** The return map for one window: one bubble per market. */
function returnMap(entries: readonly ChartIndex[], w: IxWindow): string {
  const points: { e: ChartIndex; m: IndexMove & { day: number } }[] = [];
  const shown = new Set<string>();
  for (const e of entries) {
    if (VOLATILITY_INDEXES.has(e.ticker) || shown.has(e.market)) continue;
    const m = indexMove(e.row, w.sessions);
    if (!m || m.day === null) continue;
    shown.add(e.market);
    points.push({ e, m: { ...m, day: m.day } });
  }
  const missing = marketsOf(entries).size - shown.size;
  if (points.length < 3)
    return `<p class="empty">${tr("Too little history for this window yet.")}</p>${missingNote(missing)}`;

  const x = axis(points.map((p) => p.m.day));
  const y = axis(points.map((p) => p.m.ret));
  const left = (v: number) => ((v - x.from) / (x.to - x.from)) * 100;
  const top = (v: number) => ((y.to - v) / (y.to - y.from)) * 100;
  const maxSwing = Math.max(...points.map((p) => p.m.swing)) || 1;
  const maxX = Math.max(...points.map((p) => Math.abs(p.m.day))) || 1;
  const maxY = Math.max(...points.map((p) => Math.abs(p.m.ret))) || 1;

  const grid = [
    ...x.ticks.map((v) => {
      const at = (left(v) * 10).toFixed(1);
      return `<line class="ixm-grid${Math.abs(v) < 1e-9 ? " ixm-zero" : ""}" x1="${at}" x2="${at}" y1="0" y2="1000"></line>`;
    }),
    ...y.ticks.map((v) => {
      const at = (top(v) * 10).toFixed(1);
      return `<line class="ixm-grid${Math.abs(v) < 1e-9 ? " ixm-zero" : ""}" x1="0" x2="1000" y1="${at}" y2="${at}"></line>`;
    }),
  ].join("");
  const yLabels = y.ticks
    .map(
      (v) => `<span class="ixm-y" style="top:${top(v).toFixed(2)}%">${tickText(v, y.ticks)}</span>`,
    )
    .join("");
  const xLabels = x.ticks
    .map(
      (v, i) =>
        `<span class="ixm-x${i % 2 ? " x-alt" : ""}" style="left:${left(v).toFixed(2)}%">${tickText(v, x.ticks)}</span>`,
    )
    .join("");

  // The biggest drawn first, so a small market on top of a big one stays visible.
  const bubbles = points
    .map((p) => ({ ...p, r: 3 + 13 * Math.sqrt(p.m.swing / maxSwing) }))
    .sort((a, b) => b.r - a.r)
    .map(({ e, m, r }) => {
      const read = tr(
        "{market} · {name}: {ret} over {span}, {day} in the latest session, {swing} on a typical day",
        {
          market: esc(e.market),
          name: e.name,
          ret: signed(m.ret),
          span: w.span(),
          day: signed(m.day, 2),
          swing: `${m.swing.toFixed(2)}%`,
        },
      );
      // Labels are placed most-telling first: the furthest from the middle, then the most restless.
      const priority = Math.abs(m.day) / maxX + Math.abs(m.ret) / maxY + (0.5 * m.swing) / maxSwing;
      return `<span class="ixm-b ix-${e.group}" style="left:${left(m.day).toFixed(2)}%;top:${top(m.ret).toFixed(2)}%;--r:${r.toFixed(1)}px" tabindex="0" role="img" aria-label="${read}" data-read="${read}" data-p="${priority.toFixed(3)}"><span class="ixm-l" aria-hidden="true">${esc(e.market)}</span></span>`;
    })
    .join("");

  const up = points.filter((p) => p.m.ret > 0).length;
  const idle = tr("{n} markets, {up} up over {span} · hover or tap a bubble to read it", {
    n: points.length,
    up,
    span: w.span(),
  });
  return `<figure class="fchart ixm">
<div class="fchart-head"><p class="fchart-title">${tr("Return over {span} against the latest session, one index per market", { span: w.span() })}</p><div class="fchart-keys">${legend(`<span class="fchart-key dim">${tr("bubble size: the typical daily move")}</span>`)}</div><p class="fchart-read" aria-live="polite" data-idle="${idle}">${idle}</p></div>
<div class="ixm-plot" role="group" aria-label="${tr("Markets by return over {span} and the latest session", { span: w.span() })}"><span class="ixm-yt">${tr("Return over {span}", { span: w.span() })}</span><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${grid}</svg>${yLabels}${xLabels}${bubbles}<span class="ixm-xt">${tr("Change in the latest session")}</span></div>
${missingNote(missing)}
</figure>`;
}

/** Every market's indexes by return over one window: a bar for the headline, a dot for each other. */
function countryChart(entries: readonly ChartIndex[], w: IxWindow): string {
  const markets = new Map<
    string,
    { group: ChartGroup; items: { e: ChartIndex; m: IndexMove }[] }
  >();
  for (const e of entries) {
    if (VOLATILITY_INDEXES.has(e.ticker)) continue;
    const m = indexMove(e.row, w.sessions);
    if (!m) continue;
    const market = markets.get(e.market) ?? { group: e.group, items: [] };
    market.items.push({ e, m });
    markets.set(e.market, market);
  }
  const missing = marketsOf(entries).size - markets.size;
  if (markets.size === 0)
    return `<p class="empty">${tr("Too little history for this window yet.")}</p>${missingNote(missing)}`;

  const rows = [...markets].map(([market, { group, items }]) => ({
    market,
    group,
    head: items[0] as { e: ChartIndex; m: IndexMove },
    rest: items.slice(1),
  }));
  rows.sort((a, b) => b.head.m.ret - a.head.m.ret);
  const x = axis(rows.flatMap((r) => [r.head.m.ret, ...r.rest.map((o) => o.m.ret)]));
  const at = (v: number) => ((v - x.from) / (x.to - x.from)) * 100;
  const zero = at(0);

  const body = rows
    .map(({ market, group, head, rest }) => {
      const v = at(head.m.ret);
      const neg = head.m.ret < 0;
      const bar = `<span class="ixc-bar ix-${group}${neg ? " ixc-neg" : ""}" style="left:${Math.min(v, zero).toFixed(2)}%;width:${Math.abs(v - zero).toFixed(2)}%"></span>`;
      const dots = rest
        .map((o) => `<i class="ixc-dot" style="left:${at(o.m.ret).toFixed(2)}%"></i>`)
        .join("");
      const read = tr("{market} over {span}: {list}", {
        market: esc(market),
        span: w.span(),
        list: [head, ...rest].map((o) => `${o.e.name} ${signed(o.m.ret)}`).join(" · "),
      });
      return `<div class="ixc-row" tabindex="0" role="img" aria-label="${read}" data-read="${read}"><span class="ixc-name">${esc(market)}</span><span class="ixc-track">${bar}${dots}</span><span class="ixc-val num${tone(head.m.ret)}">${signed(head.m.ret)}</span></div>`;
    })
    .join("");
  const grid = x.ticks
    .map(
      (v) =>
        `<i class="ixc-tick${Math.abs(v) < 1e-9 ? " ixc-zero" : ""}" style="left:${at(v).toFixed(2)}%"></i>`,
    )
    .join("");
  const ticks = x.ticks
    .map(
      (v, i) =>
        `<span class="ixc-x${i % 2 ? " x-alt" : ""}" style="left:${at(v).toFixed(2)}%">${tickText(v, x.ticks)}</span>`,
    )
    .join("");
  const idle = tr("{n} markets · hover or tap a row to read it", { n: rows.length });
  return `<figure class="fchart ixc">
<div class="fchart-head"><p class="fchart-title">${tr("Each market's indexes by return over {span}: the bar is its first index in the table, a dot each of its others", { span: w.span() })}</p><div class="fchart-keys">${legend(`<span class="fchart-key"><i class="ixc-key-dot"></i>${tr("other indexes")}</span>`)}</div><p class="fchart-read" aria-live="polite" data-idle="${idle}">${idle}</p></div>
<div class="ixc-rows"><div class="ixc-grid" aria-hidden="true">${grid}</div>${body}</div>
<div class="ixc-axis" aria-hidden="true"><span class="ixc-axis-track">${ticks}</span><span class="ixc-xt">${tr("Return over {span}", { span: w.span() })}</span></div>
${missingNote(missing)}
</figure>`;
}

/** Both charts for every window, each window's in its own block for the switch to show. */
export function indexCharts(entries: readonly ChartIndex[]): {
  map: string;
  countries: string;
  def: IxWindowId;
} {
  const def = defaultWindow(entries);
  const block = (draw: (e: readonly ChartIndex[], w: IxWindow) => string) =>
    IX_WINDOWS.map(
      (w) =>
        `<div class="ix-w ix-w-${w.id}${w.id === def ? " ix-w-def" : ""}">${draw(entries, w)}</div>`,
    ).join("");
  const vol = `<p class="notes">${tr("Volatility indexes (VIX, India VIX) are left out of the charts: their moves are not returns.")}</p>`;
  return { map: block(returnMap) + vol, countries: block(countryChart) + vol, def };
}

/** The region colours: the dataviz palette's first three slots, stepped for dark and for light. */
const DARK = { am: "#3987e5", eu: "#d95926", ap: "#199e70" };
const LIGHT = { am: "#2a78d6", eu: "#eb6834", ap: "#1baf7a" };
const lightThemes = THEMES.filter((t) => t.light)
  .map((t) => `:root[data-theme="${t.id}"] .ix-wrap`)
  .join(",");
const vars = (c: Record<ChartGroup, string>) => `--ix-am:${c.am};--ix-eu:${c.eu};--ix-ap:${c.ap}`;

export const INDEX_CHARTS_CSS = `.ix-wrap{${vars(DARK)}}
${lightThemes}{${vars(LIGHT)}}
.ix-am{--ixc:var(--ix-am)}.ix-eu{--ixc:var(--ix-eu)}.ix-ap{--ixc:var(--ix-ap)}
.ix-views{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 0 10px}
.ix-views[hidden]{display:none}
.ix-seg{display:inline-flex;border:1px solid var(--rule)}
.ix-seg button{font:inherit;color:var(--muted);background:none;border:0;padding:4px 10px;cursor:pointer}
.ix-seg button+button{border-left:1px solid var(--rule)}
.ix-seg button:hover{color:var(--ink);background:var(--hover)}
.ix-seg button[aria-pressed="true"]{color:var(--ink);background:var(--hover);box-shadow:inset 0 -2px 0 var(--ink)}
html[data-ixview="table"] .ix-pane-map,html[data-ixview="table"] .ix-pane-countries,html[data-ixview="map"] .ix-pane-table,html[data-ixview="map"] .ix-pane-countries,html[data-ixview="countries"] .ix-pane-table,html[data-ixview="countries"] .ix-pane-map,html[data-ixview="table"] .ix-wins{display:none}
html[data-ixwin="5d"] .ix-w-1m,html[data-ixwin="1m"] .ix-w-5d,html:not([data-ixwin]) .ix-w:not(.ix-w-def){display:none}
.fchart-keys i.ix-key{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--ixc)}
.ixm .fchart-read,.ixc .fchart-read{min-height:1.4em}
.ixm-plot{position:relative;height:440px;margin:8px 6px 46px 78px}
.ixm-plot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ixm-grid{stroke:var(--rule);stroke-width:1;vector-effect:non-scaling-stroke}
.ixm-zero{stroke:var(--muted)}
.ixm-y,.ixm-x,.ixm-yt,.ixm-xt{position:absolute;color:var(--dim);white-space:nowrap;pointer-events:none;font-size:11px}
.ixm-y{left:-52px;width:46px;text-align:right;transform:translateY(-50%)}
.ixm-x{top:100%;padding-top:3px;transform:translateX(-50%)}
.ixm-yt,.ixm-xt{color:var(--ink);font-size:12px}
.ixm-yt{left:-66px;top:50%;transform:translate(-50%,-50%) rotate(-90deg)}
.ixm-xt{left:50%;top:calc(100% + 22px);transform:translateX(-50%)}
.ixm-b{position:absolute;width:calc(var(--r) * 2);height:calc(var(--r) * 2);margin:calc(var(--r) * -1) 0 0 calc(var(--r) * -1);border-radius:50%;background:var(--ixc);box-shadow:0 0 0 1.5px var(--panel);outline:none}
.ixm-b:hover,.ixm-b:focus-visible,.ixm-b.on{box-shadow:0 0 0 1.5px var(--panel),0 0 0 3px var(--ink);z-index:2}
.ixm-l{position:absolute;left:calc(100% + 4px);top:50%;transform:translateY(-50%);white-space:nowrap;color:var(--muted);font-size:11px;line-height:1.1;pointer-events:none}
.ixm-l[data-side="l"]{left:auto;right:calc(100% + 4px)}
.ixm-l[data-side="t"]{left:50%;top:auto;bottom:calc(100% + 3px);transform:translateX(-50%)}
.ixm-l[data-side="b"]{left:50%;top:calc(100% + 3px);transform:translateX(-50%)}
.ixm-b:hover .ixm-l,.ixm-b.on .ixm-l,.ixm-b:focus-visible .ixm-l{color:var(--ink);visibility:visible!important;z-index:3}
.ixc{--ixc-n:128px;--ixc-v:64px;--ixc-gap:8px}
.ixc-rows{position:relative;margin-top:6px}
.ixc-grid{position:absolute;top:0;bottom:0;left:calc(var(--ixc-n) + var(--ixc-gap));right:calc(var(--ixc-v) + var(--ixc-gap));pointer-events:none}
.ixc-tick{position:absolute;top:0;bottom:0;width:0;border-left:1px solid var(--rule)}
.ixc-tick.ixc-zero{border-left-color:var(--muted)}
.ixc-row{position:relative;display:grid;grid-template-columns:var(--ixc-n) 1fr var(--ixc-v);gap:var(--ixc-gap);align-items:center;height:20px;outline:none}
.ixc-row:hover,.ixc-row:focus-visible,.ixc-row.on{background:var(--hover)}
.ixc-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);text-align:right}
.ixc-row:hover .ixc-name,.ixc-row.on .ixc-name{color:var(--ink)}
.ixc-track{position:relative;height:100%}
.ixc-bar{position:absolute;top:5px;bottom:5px;background:var(--ixc);border-radius:0 3px 3px 0}
.ixc-bar.ixc-neg{border-radius:3px 0 0 3px}
.ixc-dot,.ixc-key-dot{width:8px;height:8px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 1.5px var(--panel)}
.ixc-dot{position:absolute;top:50%;margin:-4px 0 0 -4px}
.fchart-keys i.ixc-key-dot{display:inline-block;width:8px;height:8px}
.ixc-val{text-align:left}
.ixc-axis{display:grid;grid-template-columns:var(--ixc-n) 1fr var(--ixc-v);grid-template-rows:20px auto;column-gap:var(--ixc-gap);margin-bottom:4px}
.ixc-xt{grid-column:2;padding-top:4px;text-align:center;color:var(--ink);font-size:12px}
.ixc-axis-track{grid-column:2;position:relative}
.ixc-x{position:absolute;top:3px;transform:translateX(-50%);color:var(--dim);font-size:11px;white-space:nowrap}
@media (max-width:640px){.ixm-plot{height:360px;margin-left:64px}.ixm-y{left:-44px;width:40px}.ixm-yt{left:-54px}.ixc{--ixc-n:92px;--ixc-v:52px;--ixc-gap:6px}.ixm-x.x-alt,.ixc-x.x-alt{display:none}}`;
