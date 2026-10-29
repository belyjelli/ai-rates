import type { PortfolioPullback } from "../app/holdings-data";
import { esc } from "./format";
import { signedPct, type UpsideBin } from "./holdings-rank";
import { tr } from "./i18n";

/**
 * The Holdings section's charts, drawn on the server as SVG or plain bars so they need no script and
 * show inside a tab loaded later (tabs.ts sets innerHTML, which runs no script). Colours are the
 * theme's: --accent up, --orange down, as .mc-up/.mc-down everywhere else.
 */

/**
 * A card's three-year sparkline: the portfolio's index, one point a week, as a line over a faint
 * area. Stretched to its box (preserveAspectRatio none); the stroke keeps its width.
 */
export function sparkline(points: readonly [string, number][]): string {
  if (points.length < 2) return "";
  const values = points.map((p) => p[1]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => ((i / (points.length - 1)) * 300).toFixed(1);
  const y = (v: number) => (6 + (1 - (v - lo) / span) * 68).toFixed(1);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(v)}`).join("");
  const first = values[0] as number;
  const last = values[values.length - 1] as number;
  return `<svg class="hd-spark${last < first ? " hd-spark-down" : ""}" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="hd-spark-area" d="${line}L300 80L0 80Z"></path><path class="hd-spark-line" d="${line}"></path></svg>`;
}

/** One row of a bar chart: its label (a link when `href`), its figure and the figure as text. */
export interface BarRow {
  label: string;
  href?: string;
  value: number;
  text: string;
}

/**
 * A ranking's top ten as horizontal bars, each as long as its figure against the largest; a negative
 * figure (a sale, a fall) draws in the down colour. Plain markup: the bars are widths.
 */
export function bars(rows: readonly BarRow[], title: string): string {
  if (!rows.length) return "";
  const max = Math.max(...rows.map((r) => Math.abs(r.value))) || 1;
  const items = rows
    .map((r) => {
      const width = Math.max(1, (Math.abs(r.value) / max) * 100).toFixed(1);
      const label = r.href ? `<a href="${esc(r.href)}">${esc(r.label)}</a>` : esc(r.label);
      return `<li class="hd-bar${r.value < 0 ? " hd-bar-neg" : ""}"><span class="hd-bar-t">${label}</span><span class="hd-bar-track"><i style="width:${width}%"></i></span><span class="hd-bar-v">${esc(r.text)}</span></li>`;
    })
    .join("");
  return `<figure class="hd-bars"><figcaption class="dim">${esc(title)}</figcaption><ol>${items}</ol></figure>`;
}

/** The histogram's label for one bin's edge. */
const edge = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}%`;

/**
 * The upside histogram: a bar per bin, its height the number of holdings in it; each bar's title says
 * the range, the count, the share of the portfolio and the tickers. Bins below zero in the down
 * colour. The x axis is labelled every 50 points and at the open ends.
 */
export function histogram(bins: readonly UpsideBin[], label: string): string {
  const max = Math.max(1, ...bins.map((b) => b.count));
  const width = 1000 / bins.length;
  const rects = bins
    .map((b, i) => {
      const h = (b.count / max) * 900;
      const range =
        b.from === null
          ? tr("below {edge}", { edge: edge(b.to ?? -50) })
          : b.to === null
            ? tr("{edge} and above", { edge: edge(b.from) })
            : `${edge(b.from)} – ${edge(b.to)}`;
      const title = tr("{range}: {n} holdings, {weight} of the value", {
        range,
        n: b.count,
        weight: `${b.weight_pct.toFixed(1)}%`,
      });
      const tickers = b.tickers.length ? ` · ${b.tickers.slice(0, 12).join(" ")}` : "";
      const side = (b.to ?? 101) <= 0 ? "neg" : "pos";
      return `<rect class="hd-hist-bar hd-hist-${side}" x="${(i * width + 4).toFixed(1)}" y="${(1000 - h).toFixed(1)}" width="${(width - 8).toFixed(1)}" height="${h.toFixed(1)}"><title>${esc(title + tickers)}</title></rect>`;
    })
    .join("");
  const counts = bins
    .map((b, i) =>
      b.count
        ? `<span class="hd-hist-n" style="left:${((i + 0.5) * (100 / bins.length)).toFixed(2)}%;bottom:${((b.count / max) * 90).toFixed(1)}%">${b.count}</span>`
        : "",
    )
    .join("");
  // Labels sit on the bins' edges: bin 1 starts at −50%, every fifth edge after it is 50 points on.
  const ticks = [
    { at: 1, text: "−50%" },
    { at: 6, text: "0%" },
    { at: 11, text: "+50%" },
    { at: 16, text: "+100%" },
  ]
    .map(
      (t) =>
        `<span class="hd-hist-x" style="left:${((t.at * 100) / bins.length).toFixed(2)}%">${t.text}</span>`,
    )
    .join("");
  return `<div class="hd-hist"><div class="hd-hist-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><line class="fchart-grid" x1="${((6 * 1000) / bins.length).toFixed(1)}" x2="${((6 * 1000) / bins.length).toFixed(1)}" y1="0" y2="1000"></line>${rects}</svg>${counts}${ticks}</div></div>`;
}

/**
 * The pullback chart: a small chart for each of the ten holdings furthest below their 1-month high,
 * its month of daily closes and the high as a dashed line, with how far the last close sits below it.
 */
export function pullbackChart(
  items: readonly PortfolioPullback[],
  href: (ticker: string) => string,
): string {
  const cells = items
    .filter((p) => p.closes.length >= 2)
    .map((p) => {
      const values = p.closes.map((c) => c[1]);
      const lo = Math.min(...values);
      const hi = Math.max(p.high_1m, ...values);
      const span = hi - lo || 1;
      const x = (i: number) => ((i / (values.length - 1)) * 200).toFixed(1);
      const y = (v: number) => (4 + (1 - (v - lo) / span) * 52).toFixed(1);
      const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(v)}`).join("");
      const first = p.closes[0] as [string, number];
      const last = p.closes[p.closes.length - 1] as [string, number];
      const label = tr("{ticker}: {pct} from its 1-month high of {high}, {from} to {to}", {
        ticker: p.ticker,
        pct: signedPct(p.pullback_1m_pct),
        high: p.high_1m.toLocaleString("en-US", { maximumFractionDigits: 2 }),
        from: first[0],
        to: last[0],
      });
      return `<li class="hd-pb"><p class="hd-pb-head"><a href="${esc(href(p.ticker))}">${esc(p.ticker)}</a><b class="hd-down">${signedPct(p.pullback_1m_pct)}</b></p><svg viewBox="0 0 200 60" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><line class="hd-pb-high" x1="0" x2="200" y1="${y(p.high_1m)}" y2="${y(p.high_1m)}"></line><path class="hd-pb-line" d="${line}"></path></svg><p class="hd-pb-foot dim">${tr("high {high} · now {close}", { high: p.high_1m.toLocaleString("en-US", { maximumFractionDigits: 2 }), close: p.close.toLocaleString("en-US", { maximumFractionDigits: 2 }) })}</p></li>`;
    })
    .join("");
  return cells ? `<ol class="hd-pbs">${cells}</ol>` : "";
}

/** The charts' styles, theme variables only. */
export const HOLDINGS_CHART_CSS = `.hd-spark{display:block;width:100%;height:64px;overflow:visible}
.hd-spark-line{fill:none;stroke:var(--accent);stroke-width:1.5;vector-effect:non-scaling-stroke}
.hd-spark-area{fill:color-mix(in srgb,var(--accent) 9%,transparent);stroke:none}
.hd-spark-down .hd-spark-line{stroke:var(--orange)}.hd-spark-down .hd-spark-area{fill:color-mix(in srgb,var(--orange) 9%,transparent)}
.hd-bars{margin:0 0 12px;padding:8px 10px;border:1px solid var(--rule);background:var(--panel)}
.hd-bars figcaption{margin-bottom:6px}
.hd-bars ol{list-style:none;margin:0;padding:0;display:grid;gap:3px}
.hd-bar{display:grid;grid-template-columns:minmax(52px,9ch) 1fr minmax(64px,11ch);align-items:center;gap:8px}
.hd-bar-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hd-bar-track{height:10px;background:var(--band)}
.hd-bar-track i{display:block;height:100%;background:var(--accent)}
.hd-bar-neg .hd-bar-track i{background:var(--orange)}
.hd-bar-v{text-align:right;white-space:nowrap}
.hd-hist{padding:10px 10px 24px;border:1px solid var(--rule);background:var(--panel)}
.hd-hist-plot{position:relative;height:180px;margin-top:16px}
.hd-hist-plot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.hd-hist-pos{fill:var(--accent)}.hd-hist-neg{fill:var(--orange)}
.hd-hist-n{position:absolute;transform:translate(-50%,-2px);font-size:11px;color:var(--muted);pointer-events:none}
.hd-hist-x{position:absolute;top:100%;padding-top:4px;transform:translateX(-50%);color:var(--dim);white-space:nowrap;pointer-events:none}
.hd-pbs{list-style:none;margin:0 0 12px;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
@media (max-width:860px){.hd-pbs{grid-template-columns:repeat(2,minmax(0,1fr))}}
.hd-pb{padding:6px 8px;border:1px solid var(--rule);background:var(--panel)}
.hd-pb-head{display:flex;justify-content:space-between;gap:6px;margin:0 0 4px}
.hd-pb svg{display:block;width:100%;height:48px;overflow:visible}
.hd-pb-line{fill:none;stroke:var(--ink);stroke-width:1.3;vector-effect:non-scaling-stroke}
.hd-pb-high{stroke:var(--orange);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.hd-pb-foot{margin:4px 0 0;font-size:11px}
.hd-up{color:var(--accent)}.hd-down{color:var(--orange)}`;
