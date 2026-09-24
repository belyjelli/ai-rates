import type { Overview, SentimentPoint } from "../app/data";
import { SENTIMENT_WINDOW_KEYS, type SentimentParams, sentimentToQuery } from "../app/params";
import { ageText, esc, formatApr, sentimentTone, since } from "./format";
import { layout } from "./layout";

/**
 * The score line, 0-100, banded. Rendered server-side like the backtest's equity curve
 * (pages.ts's equityCurve): the site has no chart library and the Free plan allows 10ms of CPU.
 */
function sentimentChart(points: readonly SentimentPoint[], now: number): string {
  if (points.length === 0) {
    return `<p class="muted">No readings yet in this window.</p>`;
  }
  const width = 720;
  const height = 160;
  const pad = 8;
  const x = (i: number) =>
    points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * (width - 2 * pad);
  const y = (score: number) => height - pad - (score / 100) * (height - 2 * pad);

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const zero = y(0).toFixed(1);
  const area = `${x(0).toFixed(1)},${zero} ${line} ${x(points.length - 1).toFixed(1)},${zero}`;
  const latest = points[points.length - 1] as SentimentPoint;
  const tone = sentimentTone(latest.score);

  // Band reference lines at the same 25/45/55/75 cuts the label itself changes on, dashed and dim
  // so they read as guides rather than data.
  const guides = [25, 45, 55, 75]
    .map(
      (score) =>
        `<line class="sent-guide" x1="${pad}" x2="${width - pad}" y1="${y(score)}" y2="${y(score)}"></line>`,
    )
    .join("");

  const first = points[0] as SentimentPoint;
  return `<figure class="curve ${tone === "long" ? "up" : tone === "short" ? "down" : ""}">
<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Fear and greed score reaches ${latest.score.toFixed(0)} (${esc(latest.label)})">
${guides}
<polygon class="curve-area" points="${area}"></polygon>
<polyline class="curve-line" points="${line}"></polyline>
</svg>
<figcaption>${points.length} readings, every 30 minutes · ${esc(ageText(first.computed_at, now))} to now</figcaption>
</figure>`;
}

function componentRow(
  label: string,
  raw: number | null,
  component: number | null,
  rawFmt: (value: number) => string,
): string {
  if (raw === null || component === null) {
    return `<tr><td>${esc(label)}</td><td class="muted">no data in window</td><td class="muted">–</td></tr>`;
  }
  return `<tr><td>${esc(label)}</td><td>${esc(rawFmt(raw))}</td><td>${component.toFixed(0)}<span class="muted">/100</span></td></tr>`;
}

export function sentiment(data: {
  overview: Overview;
  history: readonly SentimentPoint[];
  params: SentimentParams;
  now: number;
}): string {
  const { overview, history, params, now } = data;
  const latest = history.length > 0 ? history[history.length - 1] : null;

  const links = SENTIMENT_WINDOW_KEYS.map((key) => {
    const href = `/sentiment${sentimentToQuery({ window: key })}`;
    return key === params.window
      ? `<a class="on" href="${esc(href)}" aria-current="page">${esc(key)}</a>`
      : `<a href="${esc(href)}">${esc(key)}</a>`;
  }).join("");

  const head = latest
    ? `<div class="hero-head"><div><p class="eyebrow">Fear &amp; greed · updated ${since(latest.computed_at, now)}</p>
<div class="hero-asset sent-${sentimentTone(latest.score)}">${latest.score.toFixed(0)} <span class="sent-label">${esc(latest.label)}</span></div></div></div>`
    : `<div class="hero-head"><div><p class="eyebrow">Fear &amp; greed</p><div class="hero-asset">–</div></div></div>`;

  const table = latest
    ? `<table class="sent-table"><thead><tr><th>component</th><th>reading</th><th>percentile (30d, greed direction)</th></tr></thead><tbody>
${componentRow("funding (OI-weighted APR)", latest.funding_raw, latest.funding_component, formatApr)}
${componentRow("open interest", latest.oi_raw, latest.oi_component, (v) => `$${(v / 1e9).toFixed(2)}B`)}
${componentRow("liquidation skew (24h)", latest.liquidation_raw, latest.liquidation_component, (v) => `${formatApr(v)} long-heavy`)}
${componentRow("taker flow (24h)", latest.taker_flow_raw, latest.taker_flow_component, (v) => `${formatApr(v)} net buy`)}
</tbody></table>`
    : "";

  const body = `<div class="hero">
${head}
<nav class="tf" aria-label="Window">${links}</nav>
${sentimentChart(history, now)}
</div>
${table}
<p class="notes">Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.</p>`;

  return layout({
    title: "Fear & Greed",
    description:
      "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.",
    path: "/sentiment",
    body,
    overview,
    now,
  });
}
