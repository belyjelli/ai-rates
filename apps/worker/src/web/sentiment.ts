import type { Overview, SentimentPoint } from "../app/data";
import { SENTIMENT_WINDOW_KEYS, type SentimentParams, sentimentToQuery } from "../app/params";
import { ageText, esc, formatApr, sentimentLabel, sentimentTone, since } from "./format";
import { helpButton, helpPanel } from "./help";
import { tr } from "./i18n";
import { layout } from "./layout";

/**
 * The score line, 0-100, banded. Rendered server-side like the backtest's equity curve
 * (pages.ts's equityCurve): the site has no chart library and the Free plan allows 10ms of CPU.
 */
function sentimentChart(points: readonly SentimentPoint[], now: number): string {
  if (points.length === 0) {
    return `<p class="muted">${tr("No readings yet in this window.")}</p>`;
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
  // What the masthead's chart button draws onto its card (share.ts): a title that names the reading, since
  // the caption is only a count, and the score axis, at the heights the band lines sit at in the plot.
  // The label is translated without escaping first, since the whole title is escaped below.
  const shareTitle = tr("Fear & greed: {score}, {label}", {
    score: latest.score.toFixed(0),
    label: sentimentLabel(latest.label),
  });
  const shareY = [100, 75, 55, 45, 25, 0]
    .map((score) => `${(y(score) / height).toFixed(4)}:${score}`)
    .join("|");
  return `<figure class="curve ${tone === "long" ? "up" : tone === "short" ? "down" : ""}" data-share-title="${esc(shareTitle)}" data-share-y="${shareY}">
<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${tr("Fear and greed score reaches {score} ({label})", { score: latest.score.toFixed(0), label: sentimentLabel(latest.label) })}">
${guides}
<polygon class="curve-area" points="${area}"></polygon>
<polyline class="curve-line" points="${line}"></polyline>
</svg>
<figcaption>${tr("{n} readings, every 30 minutes · {age} to now", { n: points.length, age: esc(ageText(first.computed_at, now)) })}</figcaption>
</figure>`;
}

function componentRow(
  label: string,
  raw: number | null,
  component: number | null,
  rawFmt: (value: number) => string,
): string {
  if (raw === null || component === null) {
    return `<tr><td>${esc(label)}</td><td class="muted">${tr("no data in window")}</td><td class="muted">–</td></tr>`;
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
    ? `<div class="hero-head"><div><p class="eyebrow has-help">${tr("Fear &amp; greed · updated {ago}", { ago: since(latest.computed_at, now) })}${helpButton("sentiment")}</p>
<div class="hero-asset sent-${sentimentTone(latest.score)}">${latest.score.toFixed(0)} <span class="sent-label">${sentimentLabel(latest.label)}</span></div></div></div>`
    : `<div class="hero-head"><div><p class="eyebrow has-help">${tr("Fear &amp; greed")}${helpButton("sentiment")}</p><div class="hero-asset">–</div></div></div>`;

  const table = latest
    ? `<table class="sent-table"><thead><tr><th>${tr("component")}</th><th>${tr("reading")}</th><th>${tr("percentile (30d, greed direction)")}</th></tr></thead><tbody>
${componentRow(tr("funding (OI-weighted APR)"), latest.funding_raw, latest.funding_component, formatApr)}
${componentRow(tr("open interest"), latest.oi_raw, latest.oi_component, (v) => `$${(v / 1e9).toFixed(2)}B`)}
${componentRow(tr("liquidation skew (24h)"), latest.liquidation_raw, latest.liquidation_component, (v) => tr("{pct} long-heavy", { pct: formatApr(v) }))}
${componentRow(tr("taker flow (24h)"), latest.taker_flow_raw, latest.taker_flow_component, (v) => tr("{pct} net buy", { pct: formatApr(v) }))}
</tbody></table>`
    : "";

  // How the score is built, behind the "?" beside the eyebrow: the figures stay on the page.
  const body = `<div class="hero">
${head}
${helpPanel("sentiment", `<p>${tr("Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.")}</p>`)}
<nav class="tf" aria-label="${tr("Window")}">${links}</nav>
${sentimentChart(history, now)}
</div>
${table}`;

  return layout({
    title: tr("Fear & Greed"),
    description: tr(
      "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.",
    ),
    path: "/sentiment",
    body,
    overview,
    now,
  });
}
