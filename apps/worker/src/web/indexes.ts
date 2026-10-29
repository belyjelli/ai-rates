import type { IndexLevelRow } from "../app/data";
import { lazyPlaceholder } from "./chart-skeleton";
import { esc } from "./format";
import { bookName } from "./gamma";
import { tr } from "./i18n";
import { timeTag } from "./localtime";

/**
 * The Rates page's World indexes tab: every stock index level the collector reads (collector
 * internal/indexlevel, migrations 037 and 057), grouped by market, with the day's change and range and
 * a month of daily closes.
 *
 * WHY HERE. The Gamma, Greeks and IV tabs already carry option books on the Nifty 50, Sensex, Nikkei
 * 225 and ASX 200; this is the level those books sit on, and for the indexes with no free options
 * data (KOSPI, TOPIX, the Straits Times, the broader Nifty indexes) the only figure the site has.
 * Rows with a book link to it.
 *
 * LIVE OR A CLOSE, SAID PER ROW. KRX and Sina quote during the session; NSE's file is the day's close,
 * read once in the evening. A close shown as if it were live would read as a frozen market, so the
 * As of column names which it is, in the reader's own time (localtime.ts).
 *
 * BSE-100, BSE-200 and BSE-500 are not here: Sina's codes for them froze in 2025-09 and BSE's own API
 * refuses the collector, so there is no source (checked 2026-10-29).
 *
 * Loads by itself (`?panel=indexes`), as the macro and prediction tabs do.
 */

export const INDEX_PANEL = "indexes" as const;

/** The tab bar's entry, after the prediction tabs. */
export const indexTabs = (): { id: typeof INDEX_PANEL; label: string; shortLabel: string }[] => [
  { id: INDEX_PANEL, label: tr("World indexes"), shortLabel: tr("Indexes") },
];

/** Markets in the order the tab lists them, each with its indexes in order. */
const MARKETS: { region: () => string; tickers: string[] }[] = [
  {
    region: () => tr("India"),
    tickers: ["NIFTY", "NIFTY100", "NIFTY200", "NIFTY500", "NIFTYMID150", "SENSEX", "INDIAVIX"],
  },
  { region: () => tr("Japan"), tickers: ["NK225", "TOPIX"] },
  { region: () => tr("Korea"), tickers: ["KOSPI", "KOSPI200"] },
  { region: () => tr("Singapore"), tickers: ["STI"] },
  { region: () => tr("Australia"), tickers: ["XJO"] },
];

/** Indexes with an option book on the Gamma tab, by the same ticker. */
const BOOKS = new Set(["NIFTY", "SENSEX", "NK225", "XJO"]);

/** A quote older than this is the market's close, not a live level. */
const LIVE_MS = 30 * 60 * 1000;

const MINUS = "−";
const dash = `<span class="dim">–</span>`;
const level = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A month of daily closes as a line, toned by the month's direction. */
function spark(closes: number[]): string {
  if (closes.length < 2) return dash;
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo || 1;
  const w = 96;
  const h = 22;
  const points = closes
    .map(
      (c, i) =>
        `${((i / (closes.length - 1)) * w).toFixed(1)},${(h - 1 - ((c - lo) / span) * (h - 2)).toFixed(1)}`,
    )
    .join(" ");
  const first = closes[0] as number;
  const last = closes[closes.length - 1] as number;
  const tone = last > first ? "mc-up" : last < first ? "mc-down" : "dim";
  const change = ((last / first - 1) * 100).toFixed(1);
  return `<svg class="ix-spark ${tone}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(tr("{n} daily closes, {change}%", { n: closes.length, change }))}"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}

function row(l: IndexLevelRow, now: number): string {
  const name = BOOKS.has(l.ticker) ? bookName(l.ticker) : esc(l.name);
  const book = BOOKS.has(l.ticker)
    ? ` <a class="ix-book" href="/rates?gex=${encodeURIComponent(l.ticker)}#gamma" title="${esc(tr("Its option book on the Gamma Exposure tab"))}">${tr("options")}</a>`
    : "";
  let change = `<td class="num">${dash}</td>`;
  if (l.prev_close !== null && l.prev_close > 0) {
    const pct = (l.price / l.prev_close - 1) * 100;
    const cls = pct > 0 ? " mc-up" : pct < 0 ? " mc-down" : "";
    change = `<td class="num${cls}">${pct > 0 ? "+" : pct < 0 ? MINUS : ""}${Math.abs(pct).toFixed(2)}%</td>`;
  }
  const range =
    l.day_low !== null && l.day_high !== null ? `${level(l.day_low)}–${level(l.day_high)}` : dash;
  const live = l.source !== "nse" && now - l.at_ms < LIVE_MS;
  const asOf = live
    ? `<span class="ix-live">${tr("live")}</span> ${timeTag(l.at_ms, "hm")}`
    : `${tr("closing")} ${timeTag(l.at_ms, "md")}`;
  return `<tr><td>${name}${book}</td><td class="num">${level(l.price)}</td>${change}<td class="num dim">${range}</td><td class="ix-spark-cell">${spark(l.closes)}</td><td class="dim">${asOf}</td></tr>`;
}

export function indexesPanel(data: IndexLevelRow[] | null, now: number): string {
  if (data === null)
    return `<p class="empty">${tr("The index levels could not be read right now.")}</p>`;
  if (data.length === 0)
    return `<p class="empty">${tr("No index level has been read yet. The collector reads them every five minutes.")}</p>`;
  const byTicker = new Map(data.map((l) => [l.ticker, l]));
  const listed = new Set<string>();
  const groups = MARKETS.map(({ region, tickers }) => {
    const rows = tickers.flatMap((t) => {
      const l = byTicker.get(t);
      if (!l) return [];
      listed.add(t);
      return [row(l, now)];
    });
    return rows.length > 0
      ? `<tr class="ix-region"><th colspan="6">${region()}</th></tr>${rows.join("")}`
      : "";
  });
  // An index the collector reads that this list does not know yet still shows, last.
  const others = data.filter((l) => !listed.has(l.ticker)).map((l) => row(l, now));
  if (others.length > 0)
    groups.push(`<tr class="ix-region"><th colspan="6">${tr("Other")}</th></tr>${others.join("")}`);
  return `<p class="dim ix-lede">${tr("Stock index levels from each exchange's own data: the day's change against the previous close, the day's range, and a month of daily closes.")}</p>
<div class="sheet-wrap"><table class="sheet mc-table ix-table"><thead><tr><th>${tr("Index")}</th><th class="num">${tr("Level")}</th><th class="num">${tr("Change")}</th><th class="num">${tr("Day range")}</th><th>${tr("30 days")}</th><th>${tr("As of")}</th></tr></thead><tbody>${groups.join("")}</tbody></table></div>
<p class="notes">${tr("India's Nifty indexes and India VIX are NSE's daily closing file, read once each evening; the BSE Sensex, Nikkei 225, TOPIX, Straits Times and S&P/ASX 200 are Sina's quotes and KOSPI and KOSPI 200 the Korea Exchange's, read every five minutes during the session. BSE-100, BSE-200 and BSE-500 have no free source we can read.")}</p>`;
}

export function indexesFragment(data: IndexLevelRow[] | null, now: number): string {
  return `<div class="lazy-body" data-rendered="${now}">${indexesPanel(data, now)}</div>`;
}

/** The placeholder for the tab when this render did not read it. */
export function indexesPlaceholder(): string {
  return lazyPlaceholder(`/rates?panel=${INDEX_PANEL}#${INDEX_PANEL}`);
}

export const INDEXES_CSS = `.ix-lede{margin:2px 0 10px}
.ix-table{width:100%}
.ix-table .ix-region th{text-align:left;padding-top:12px;font-weight:600;color:var(--muted)}
.ix-table td:first-child{white-space:nowrap}
.ix-book{margin-left:6px;font-size:11px}
.ix-live{color:var(--accent)}
.ix-spark-cell{width:104px}
.ix-spark{display:block}
@media (max-width:640px){.ix-table th:nth-child(4),.ix-table td:nth-child(4),.ix-table th:nth-child(5),.ix-table td:nth-child(5){display:none}}`;
