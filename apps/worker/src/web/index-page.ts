import type { IndexDetail, Overview } from "../app/data";
import { esc, formatUsd } from "./format";
import { tr, trMsg } from "./i18n";
import { hasBook, INDEX_PANEL, indexName, indexPlace, level } from "./indexes";
import { layout } from "./layout";
import { timeTag } from "./localtime";
import { MONTHS } from "./slot-chart";

/**
 * One index's page, /indexes/<ticker>: the level with the day's change and range, whether it is live
 * or a close and where it comes from, its daily closes over the history the collector keeps (400
 * days, from when each source was added: 2026-10-17 for KRX and Sina, 10-29 for NSE and TradingView),
 * the last day and a half of quotes, and what trades on it here: the perpetuals on the same index and
 * its option book.
 *
 * WHY A PAGE. The World indexes tab is one row an index; most of its 55 indexes have no perpetual and
 * no option book, so before this page a row was all the site could show of them (owner, 2026-10-29:
 * "check if the ticker detail can be seen in a page").
 */

/** A quote older than this is the market's close, not a live level (as on the tab). */
const LIVE_MS = 30 * 60 * 1000;
const MINUS = "−";
const DAY_MS = 86_400_000;

/** Where each source's level comes from, said on the page. */
const SOURCES: Record<string, () => string> = {
  krx: () => tr("the Korea Exchange's own index charts, every five minutes"),
  sina: () => tr("Sina's quote feed, every five minutes"),
  nse: () => tr("NSE's daily closing file, read once each evening"),
  tv: () => tr("TradingView's quotes, up to 20 minutes behind, every five minutes"),
};

const signedPct = (pct: number) =>
  `${pct > 0 ? "+" : pct < 0 ? MINUS : ""}${Math.abs(pct).toFixed(2)}%`;
const tone = (v: number) => (v > 0 ? " mc-up" : v < 0 ? " mc-down" : "");

/** A round step near `raw`: 1, 2 or 5 times a power of ten. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (raw <= m * power) return m * power;
  return 10 * power;
}

/**
 * A line of [epoch ms, level] points in the funding chart's frame (.fchart in layout.ts), its readout
 * following the pointer (INDEX_PAGE_SCRIPT). `daily` labels the x axis by date, else by hour.
 */
function lineChart(title: string, points: [number, number][], daily: boolean): string {
  const first = points[0] as [number, number];
  const last = points[points.length - 1] as [number, number];
  const from = first[0];
  const to = last[0];
  let lo = Math.min(...points.map((p) => p[1]));
  let hi = Math.max(...points.map((p) => p[1]));
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.005 || 1;
  lo -= pad;
  hi += pad;
  const step = niceStep((hi - lo) / 4);
  const x = (ms: number) => ((ms - from) / (to - from || 1)) * 1000;
  const y = (v: number) => 1000 - ((v - lo) / (hi - lo)) * 1000;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const grid = ticks
    .map(
      (v) =>
        `<line class="fchart-grid" x1="0" x2="1000" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"></line>`,
    )
    .join("");
  const yLabels = ticks
    .map(
      (v) =>
        `<span class="fchart-y" style="top:${(y(v) / 10).toFixed(2)}%">${v.toLocaleString("en-US", { maximumFractionDigits: step < 1 ? 2 : 0 })}</span>`,
    )
    .join("");
  // About five labels across: dates for the daily line (UTC days, which is what a close is filed
  // under), hours in the reader's own time for the intraday one.
  const spanMs = to - from || 1;
  const every = daily
    ? Math.max(1, Math.round(spanMs / DAY_MS / 5)) * DAY_MS
    : Math.max(1, Math.round(spanMs / 3_600_000 / 5)) * 3_600_000;
  const xLabels: string[] = [];
  for (let ms = Math.ceil(from / every) * every; ms <= to; ms += every) {
    const d = new Date(ms);
    const text = daily
      ? `${trMsg(MONTHS[d.getUTCMonth()] ?? "")} ${d.getUTCDate()}`
      : timeTag(ms, "hm");
    xLabels.push(`<span class="fchart-x" style="left:${(x(ms) / 10).toFixed(2)}%">${text}</span>`);
  }
  const path = points
    .map(([ms, v], i) => `${i === 0 ? "M" : "L"}${x(ms).toFixed(1)} ${y(v).toFixed(1)}`)
    .join("");
  const change = last[1] / first[1] - 1;
  const payload = JSON.stringify({ daily, from, to, points }).replace(/</g, "\\u003c");
  return `<figure class="fchart ixp-chart">
<div class="fchart-head"><p class="fchart-title">${title}</p><p class="dim${tone(change)}">${signedPct(change * 100)}</p></div>
<div class="fchart-plot ixp-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(title)}">${grid}<path class="fchart-line ixp-line${tone(change)}" d="${path}"></path><line class="fchart-cursor off" x1="0" x2="0" y1="0" y2="1000"></line></svg>${yLabels}${xLabels.join("")}</div>
<p class="fchart-read">${tr("Hover or tap the chart to read a point.")}</p>
<script type="application/json" class="ixp-data">${payload}</script>
</figure>`;
}

/** The page. */
export function indexPage(options: {
  detail: IndexDetail;
  overview: Overview | null;
  now: number;
}): string {
  const { detail, overview, now } = options;
  const l = detail.level;
  const name = indexName(l);
  const place = indexPlace(l.ticker);
  const live = l.source !== "nse" && now - l.at_ms < LIVE_MS;
  const asOf = live
    ? `<span class="ix-live">${tr("live")}</span> ${timeTag(l.at_ms, "mdhm")}`
    : `${tr("closing")} ${timeTag(l.at_ms, "md")}`;
  const facts: string[] = [];
  if (l.prev_close !== null && l.prev_close > 0) {
    const pct = (l.price / l.prev_close - 1) * 100;
    facts.push(
      `<span>${tr("Change")} <b class="${tone(pct).trim()}">${signedPct(pct)}</b> ${tr("from {prev}", { prev: level(l.prev_close) })}</span>`,
    );
  }
  if (l.day_low !== null && l.day_high !== null)
    facts.push(`<span>${tr("Day range")} <b>${level(l.day_low)}–${level(l.day_high)}</b></span>`);
  facts.push(`<span>${tr("As of")} <b>${asOf}</b></span>`);

  const charts: string[] = [];
  if (detail.daily.length >= 2) charts.push(lineChart(tr("Daily closes"), detail.daily, true));
  // The last day and a half moves through a session only for a live source; NSE's is one close a day.
  if (l.source !== "nse" && detail.intraday.length >= 3)
    charts.push(lineChart(tr("The last 36 hours"), detail.intraday, false));
  const since = detail.daily[0];
  const history =
    detail.daily.length < 30
      ? `<p class="dim ixp-thin">${
          since
            ? tr(
                "The collector has kept this index since {date}: {n} daily closes so far. The chart fills in a close a day.",
                { date: timeTag(since[0], "md"), n: detail.daily.length },
              )
            : tr("No close kept yet.")
        }</p>`
      : "";

  const links: string[] = [];
  if (detail.perps) {
    const path = `index/${encodeURIComponent(detail.perps.base)}`;
    links.push(
      `<li><a href="/markets/asset/${path}">${tr("Perpetuals on it: {base}", { base: esc(detail.perps.base) })}</a> <span class="dim">${tr("{n} markets, {oi} open interest", { n: detail.perps.markets, oi: formatUsd(detail.perps.open_interest_usd) })}</span></li>`,
      `<li><a href="/chart/${path}">${tr("Its chart and order flow (CVD)")}</a></li>`,
      `<li><a href="/liquidations/${path}">${tr("Its liquidations")}</a></li>`,
    );
  }
  if (hasBook(l.ticker))
    links.push(
      `<li><a href="/rates?gex=${encodeURIComponent(l.ticker)}#gamma">${tr("Its option book: gamma exposure, Greeks and IV walls")}</a></li>`,
    );
  links.push(
    `<li><a href="/rates?panel=${INDEX_PANEL}#${INDEX_PANEL}">${tr("Every index on the World indexes tab")}</a></li>`,
  );

  const source = SOURCES[l.source];
  return layout({
    title: tr("{name} index level", { name: l.name }),
    description: tr(
      "{name}: the level now, the day's change and range, and the daily closes kept since the site began reading it.",
      { name: l.name },
    ),
    path: `/indexes/${encodeURIComponent(l.ticker)}`,
    overview,
    now,
    body: `<p class="dim ixp-crumb"><a href="/rates?panel=${INDEX_PANEL}#${INDEX_PANEL}">${tr("World indexes")}</a>${place ? ` · ${esc(place.region)} · ${esc(place.market)}` : ""}</p>
<h1>${name} <span class="dim ixp-ticker">${esc(l.ticker)}</span></h1>
<p class="ixp-level">${level(l.price)}</p>
<p class="facts">${facts.join("")}</p>
${charts.join("\n")}
${history}
<h2 class="ixp-h2">${tr("On this site")}</h2>
<ul class="ixp-links">${links.join("")}</ul>
<p class="notes">${source ? tr("The level is from {source}.", { source: source() }) : ""} ${tr("A close is the session's last level; a market that is shut shows its close until it opens again. Daily closes are each UTC day's last level.")}</p>
<style>${INDEX_PAGE_CSS}</style>
<script>${INDEX_PAGE_SCRIPT}</script>`,
  });
}

const INDEX_PAGE_CSS = `.ixp-crumb{margin:4px 0 6px}
.ixp-ticker{font-size:.6em;font-weight:400}
.ixp-level{font-size:28px;font-weight:700;margin:2px 0 6px;font-variant-numeric:tabular-nums}
.ixp-chart .ixp-plot{margin-left:64px}
.ixp-chart .fchart-y{left:-64px;width:58px}
.ixp-line{stroke:var(--ink);stroke-width:1.6}
.ixp-line.mc-up{stroke:var(--accent)}.ixp-line.mc-down{stroke:var(--orange)}
.ixp-thin{margin:4px 0 12px}
.ixp-h2{margin:18px 0 6px;font-size:14px}
.ixp-links{margin:0;padding-left:18px;line-height:1.7}`;

/**
 * The charts' pointer readout: the nearest point's level and its day (a daily chart) or its time in
 * the reader's zone (the intraday one).
 */
export const INDEX_PAGE_SCRIPT = `(() => {
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  for (const chart of document.querySelectorAll(".ixp-chart")) {
    const data = JSON.parse(chart.querySelector(".ixp-data").textContent);
    const plot = chart.querySelector(".fchart-plot");
    const read = chart.querySelector(".fchart-read");
    const cursor = chart.querySelector(".fchart-cursor");
    const idle = read.textContent;
    const show = (clientX) => {
      const rect = plot.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const at = data.from + f * (data.to - data.from);
      let best = data.points[0];
      for (const p of data.points) if (Math.abs(p[0] - at) < Math.abs(best[0] - at)) best = p;
      const fx = (best[0] - data.from) / (data.to - data.from || 1) * 1000;
      cursor.setAttribute("x1", String(fx));
      cursor.setAttribute("x2", String(fx));
      cursor.classList.remove("off");
      const d = new Date(best[0]);
      const when = data.daily
        ? months[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear()
        : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      read.textContent = when + " · " + best[1].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    plot.addEventListener("pointermove", (e) => show(e.clientX));
    plot.addEventListener("pointerdown", (e) => show(e.clientX));
    plot.addEventListener("pointerleave", () => { cursor.classList.add("off"); read.textContent = idle; });
  }
})();`;
