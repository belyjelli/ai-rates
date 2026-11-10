import type { IndexLevelRow } from "../app/data";
import { lazyPlaceholder } from "./chart-skeleton";
import { esc } from "./format";
import { bookName, gammaBookFor } from "./gamma";
import { msg, tr, trMsg } from "./i18n";
import {
  type ChartGroup,
  type ChartIndex,
  INDEX_CHARTS_CSS,
  IX_WINDOWS,
  indexCharts,
} from "./indexes-charts";
import { timeTag } from "./localtime";

/**
 * The Rates page's World indexes tab: every stock index level the collector reads (collector
 * internal/indexlevel, migrations 037 and 057), grouped by region with each index's market under its
 * name, with the day's change and range and a month of daily closes.
 *
 * WHY HERE. The Gamma, Greeks and IV tabs carry option books on the S&P 500, Nasdaq-100, Russell
 * 2000, Euro Stoxx 50, DAX, SMI, the Hang Seng and mainland indexes, TAIEX, Nikkei 225, ASX 200, Nifty
 * and Sensex; this is the level those books sit on, and for the indexes with no free options data
 * (the FTSE 100, CAC 40, KOSPI, TOPIX and most of the rest) the only figure the site has. A row whose
 * ticker has a book links to it.
 *
 * LIVE OR A CLOSE, SAID PER ROW. KRX, Sina, Yahoo and TradingView quote during the session
 * (TradingView up to 20 minutes behind, stamped with the time its level stands for); NSE's file is the day's close, read
 * once in the evening. A close shown as if it were live would read as a frozen market, so the As of
 * column names which it is, in the reader's own time (localtime.ts).
 *
 * The BSE Sensex, BSE 100, 200 and 500 are Yahoo's quotes (since 2026-10-29): Sina's codes for the three
 * froze in 2025-09, BSE's own API refuses the collector, and Sina's Sensex gave the wrong previous
 * close after the bell.
 *
 * Loads by itself (`?panel=indexes`), as the macro and prediction tabs do.
 *
 * THREE VIEWS (owner, 2026-11-10): the table, a return map with a bubble per market, and every
 * market's indexes by return (indexes-charts.ts says what each plots). A switch above them, kept by
 * IX_VIEW_SCRIPT; without the script all three show, one under the other.
 */

export const INDEX_PANEL = "indexes" as const;

/** The tab bar's entry, after the prediction tabs. */
export const indexTabs = (): { id: typeof INDEX_PANEL; label: string; shortLabel: string }[] => [
  { id: INDEX_PANEL, label: tr("World indexes"), shortLabel: tr("Indexes") },
];

const US = msg("United States");
const HONG_KONG = msg("Hong Kong");
const JAPAN = msg("Japan");
const INDIA = msg("India");
const CHINA = msg("China");
const KOREA = msg("Korea");

/**
 * Regions in the order the tab lists them, each with its indexes in order and the market of each,
 * and the colour the charts give it (the Middle East rides with Europe there: indexes-charts.ts).
 */
const REGIONS: {
  region: () => string;
  group: ChartGroup;
  indexes: [ticker: string, market: string][];
}[] = [
  {
    region: () => tr("Americas"),
    group: "am",
    indexes: [
      ["SPX", US],
      ["DJI", US],
      ["COMP", US],
      ["NDX", US],
      ["RUT", US],
      ["VIX", US],
      ["SPTSX", msg("Canada")],
      ["IBOV", msg("Brazil")],
      ["MEXBOL", msg("Mexico")],
    ],
  },
  {
    region: () => tr("Europe"),
    group: "eu",
    indexes: [
      ["DAX", msg("Germany")],
      ["UKX", msg("United Kingdom")],
      ["CAC", msg("France")],
      ["SX5E", msg("Euro area")],
      ["AEX", msg("Netherlands")],
      ["IBEX", msg("Spain")],
      ["FTSEMIB", msg("Italy")],
      ["SMI", msg("Switzerland")],
      ["PSI", msg("Portugal")],
      ["BEL20", msg("Belgium")],
      ["ATX", msg("Austria")],
      ["OMXS30", msg("Sweden")],
      ["OMXC25", msg("Denmark")],
      ["WIG20", msg("Poland")],
      ["XU100", msg("Turkey")],
    ],
  },
  {
    region: () => tr("Middle East"),
    group: "eu",
    indexes: [
      ["TA35", msg("Israel")],
      ["TASI", msg("Saudi Arabia")],
    ],
  },
  {
    region: () => tr("Asia-Pacific"),
    group: "ap",
    indexes: [
      ["HSI", HONG_KONG],
      ["HSCEI", HONG_KONG],
      ["HSTECH", HONG_KONG],
      ["NK225", JAPAN],
      ["TOPIX", JAPAN],
      ["XJO", msg("Australia")],
      ["NIFTY", INDIA],
      ["NIFTY100", INDIA],
      ["NIFTY200", INDIA],
      ["NIFTY500", INDIA],
      ["NIFTYMID150", INDIA],
      ["BANKNIFTY", INDIA],
      ["SENSEX", INDIA],
      ["BSE100", INDIA],
      ["BSE200", INDIA],
      ["BSE500", INDIA],
      ["INDIAVIX", INDIA],
      ["SHCOMP", CHINA],
      ["SZI", CHINA],
      ["XIN9", CHINA],
      ["SSE50", CHINA],
      ["CSI300", CHINA],
      ["CSI1000", CHINA],
      ["TAIEX", msg("Taiwan")],
      ["KOSPI", KOREA],
      ["KOSPI200", KOREA],
      ["SET", msg("Thailand")],
      ["JKSE", msg("Indonesia")],
      ["PSEI", msg("Philippines")],
      ["STI", msg("Singapore")],
      ["KLCI", msg("Malaysia")],
      ["VNINDEX", msg("Vietnam")],
    ],
  },
];

/** Whether an index has an option book on the Gamma tab, by the same ticker (SPX, DAX, NIFTY ...). */
export const hasBook = (ticker: string): boolean => gammaBookFor(ticker, "index") !== null;

/**
 * The perpetuals on each index, by the base the collector files them under (core/symbols.go), where
 * it differs from the level's ticker or is the same index under the same name. Only exact matches:
 * HSCHKD and TW88 are left out until someone checks what they track.
 */
export const INDEX_PERPS: Record<string, string> = {
  SPX: "US500",
  NDX: "US100",
  DJI: "US30",
  RUT: "US2000",
  VIX: "VIX",
  DAX: "GER40",
  UKX: "UK100",
  NK225: "JP225",
  XJO: "AUS200",
  HSI: "HK50",
  KOSPI: "KOSPI",
  KOSPI200: "KR200",
  NIFTY: "NIFTY",
};

/** An index's region and market as the tab lists them, or null for one it does not list. */
export function indexPlace(ticker: string): { region: string; market: string } | null {
  for (const { region, indexes } of REGIONS) {
    const found = indexes.find(([t]) => t === ticker);
    if (found) return { region: region(), market: trMsg(found[1]) };
  }
  return null;
}

/** The name an index is shown under: its option book's where it has one, else the collector's. */
export const indexName = (l: { ticker: string; name: string }): string =>
  hasBook(l.ticker) ? bookName(l.ticker) : esc(l.name);

/** An index's page. */
export const indexHref = (ticker: string): string => `/indexes/${encodeURIComponent(ticker)}`;

/** A quote older than this is the market's close, not a live level. */
const LIVE_MS = 30 * 60 * 1000;

const MINUS = "−";
const dash = `<span class="dim">–</span>`;
export const level = (v: number) =>
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

function row(l: IndexLevelRow, now: number, market?: string): string {
  const name = `<a class="ix-name" href="${indexHref(l.ticker)}">${indexName(l)}</a>`;
  const country = market ? esc(trMsg(market)) : dash;
  // The option book, where the Gamma tab has one under the same ticker: the column says which of the
  // 55 indexes can be read for gamma, Greeks and IV walls at all.
  const book = hasBook(l.ticker)
    ? `<a class="ix-book" href="/rates?gex=${encodeURIComponent(l.ticker)}#gamma" title="${esc(tr("Its option book on the Gamma Exposure tab"))}">${tr("Gamma")}</a>`
    : dash;
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
  // On a phone the Country column gives way, and the country rides under the name instead (ix-cm).
  // Narrower still, the Option book column goes too and its link joins that line (ix-cmb).
  const underBook = hasBook(l.ticker)
    ? `<span class="ix-cmb"> · <a href="/rates?gex=${encodeURIComponent(l.ticker)}#gamma">${tr("Gamma")}</a></span>`
    : "";
  const under =
    market || underBook ? `<span class="ix-cm">${market ? country : ""}${underBook}</span>` : "";
  return `<tr><td>${name}${under}</td><td class="ix-country">${country}</td><td class="num">${level(l.price)}</td>${change}<td class="num dim">${range}</td><td class="ix-spark-cell">${spark(l.closes)}</td><td class="ix-opt">${book}</td><td class="dim">${asOf}</td></tr>`;
}

export function indexesPanel(data: IndexLevelRow[] | null, now: number): string {
  if (data === null)
    return `<p class="empty">${tr("The index levels could not be read right now.")}</p>`;
  if (data.length === 0)
    return `<p class="empty">${tr("No index level has been read yet. The collector reads them every five minutes.")}</p>`;
  const byTicker = new Map(data.map((l) => [l.ticker, l]));
  const listed = new Set<string>();
  const charted: ChartIndex[] = [];
  const groups = REGIONS.map(({ region, group, indexes }) => {
    const rows = indexes.flatMap(([t, market]) => {
      const l = byTicker.get(t);
      if (!l) return [];
      listed.add(t);
      charted.push({ ticker: t, name: indexName(l), market: trMsg(market), group, row: l });
      return [row(l, now, market)];
    });
    return rows.length > 0
      ? `<tr class="ix-region"><th colspan="8">${region()}</th></tr>${rows.join("")}`
      : "";
  });
  // An index the collector reads that this list does not know yet still shows, last.
  const others = data.filter((l) => !listed.has(l.ticker)).map((l) => row(l, now));
  if (others.length > 0)
    groups.push(`<tr class="ix-region"><th colspan="8">${tr("Other")}</th></tr>${others.join("")}`);
  const charts = indexCharts(charted);
  const views = (
    [
      ["table", tr("Table")],
      ["map", tr("Return map")],
      ["countries", tr("By country")],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<button type="button" data-ix-view="${id}" aria-pressed="${id === "table"}">${label}</button>`,
    )
    .join("");
  const windows = IX_WINDOWS.map(
    (w) =>
      `<button type="button" data-ix-win="${w.id}" aria-pressed="${w.id === charts.def}">${w.label()}</button>`,
  ).join("");
  return `<div class="ix-wrap"><p class="dim ix-lede">${tr("Stock index levels across the Americas, Europe, the Middle East and Asia-Pacific: the day's change against the previous close, the day's range, and a month of daily closes.")}</p>
<div class="ix-views" data-def-win="${charts.def}" hidden><div class="ix-seg" role="group" aria-label="${tr("View")}">${views}</div><div class="ix-seg ix-wins" role="group" aria-label="${tr("Window")}">${windows}</div></div>
<div class="ix-pane ix-pane-table"><div class="sheet-wrap"><table class="sheet mc-table ix-table"><thead><tr><th>${tr("Index")}</th><th>${tr("Country")}</th><th class="num">${tr("Level")}</th><th class="num">${tr("Change")}</th><th class="num">${tr("Day range")}</th><th>${tr("30 days")}</th><th>${tr("Option book")}</th><th>${tr("As of")}</th></tr></thead><tbody>${groups.join("")}</tbody></table></div></div>
<div class="ix-pane ix-pane-map">${charts.map}</div>
<div class="ix-pane ix-pane-countries">${charts.countries}</div>
<p class="notes">${tr("India's Nifty indexes, Nifty Bank and India VIX are NSE's daily closing file, read once each evening. The rest are read every five minutes: KOSPI and KOSPI 200 from the Korea Exchange, the Nikkei 225, TOPIX, Straits Times and S&P/ASX 200 from Sina's quotes, and the other indexes from quotes delayed by up to 20 minutes; a market that has closed shows its close.")}</p></div>`;
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
.ix-book{white-space:nowrap}
.ix-country{color:var(--muted);white-space:nowrap}
.ix-cm{display:none}
.ix-cmb{display:none}
.ix-name{color:inherit}
.ix-live{color:var(--accent)}
.ix-spark-cell{width:104px}
.ix-spark{display:block}
@media (max-width:640px){.ix-table th:nth-child(2),.ix-table td:nth-child(2),.ix-table th:nth-child(5),.ix-table td:nth-child(5),.ix-table th:nth-child(6),.ix-table td:nth-child(6){display:none}.ix-cm{display:block;font-size:11px;color:var(--muted)}.ix-table td:first-child{white-space:normal}.ix-table td:last-child{white-space:nowrap}}
@media (max-width:460px){.ix-table th:nth-child(7),.ix-table td:nth-child(7){display:none}.ix-cmb{display:inline}}
${INDEX_CHARTS_CSS}`;

/**
 * The World indexes tab's view switch (table, return map, by country) and window (5 days, a month),
 * as GX_VIEW_SCRIPT keeps the gamma chart's: the reader's choice in localStorage "indexes-view" and
 * "indexes-window", on <html> as data-ixview and data-ixwin for the CSS. A window the reader never
 * picked is the one the server opened on (data-def-win), which becomes the month once most indexes
 * have one.
 *
 * It also reads a bubble or a country row into its chart's readout on hover, focus or tap, and lays
 * the map's labels out: most telling bubble first, right of it, else left, above or below, else
 * hidden until hovered. That needs the rendered sizes, so it runs whenever a map's size changes,
 * which includes the tab or the view being shown.
 */
export const IX_VIEW_SCRIPT = `(() => {
  if (window.airratesIndexView) return;
  window.airratesIndexView = true;
  const VIEWS = ["table", "map", "countries"];
  const WINS = ${JSON.stringify(IX_WINDOWS.map((w) => w.id))};
  const root = document.documentElement;
  let view = "table";
  let win = null;
  try {
    const v = localStorage.getItem("indexes-view");
    if (VIEWS.includes(v)) view = v;
    const w = localStorage.getItem("indexes-window");
    if (WINS.includes(w)) win = w;
  } catch (_) {}
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const place = (plot) => {
    const box = plot.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const bubbles = [...plot.querySelectorAll(".ixm-b")];
    const marks = bubbles.map((b) => b.getBoundingClientRect());
    // The axis captions are taken before any label.
    const taken = [...plot.querySelectorAll(".ixm-yt, .ixm-xt")].map((c) => c.getBoundingClientRect());
    bubbles
      .map((b, i) => [Number(b.dataset.p) || 0, i])
      .sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => {
        const label = bubbles[i].querySelector(".ixm-l");
        if (!label) return;
        label.style.visibility = "";
        for (const side of ["r", "l", "t", "b"]) {
          label.dataset.side = side;
          const r = label.getBoundingClientRect();
          if (r.left < box.left || r.right > box.right + 4 || r.top < box.top - 4 || r.bottom > box.bottom + 4) continue;
          if (taken.some((t) => hit(t, r)) || marks.some((m, j) => j !== i && hit(m, r))) continue;
          taken.push(r);
          return;
        }
        label.dataset.side = "r";
        label.style.visibility = "hidden";
      });
  };
  const watched = new WeakSet();
  const sizes = typeof ResizeObserver === "function" ? new ResizeObserver((list) => list.forEach((e) => place(e.target))) : null;
  const sync = () => {
    root.dataset.ixview = view;
    const first = document.querySelector(".ix-views");
    const w = win || (first && WINS.includes(first.dataset.defWin) ? first.dataset.defWin : WINS[0]);
    root.dataset.ixwin = w;
    for (const group of document.querySelectorAll(".ix-views")) {
      group.hidden = false;
      for (const b of group.querySelectorAll("[data-ix-view]")) b.setAttribute("aria-pressed", String(b.dataset.ixView === view));
      for (const b of group.querySelectorAll("[data-ix-win]")) b.setAttribute("aria-pressed", String(b.dataset.ixWin === w));
    }
    for (const plot of document.querySelectorAll(".ixm-plot")) {
      if (sizes && !watched.has(plot)) { watched.add(plot); sizes.observe(plot); }
      place(plot);
    }
  };
  const markOf = (event) => (event.target && event.target.closest ? event.target.closest(".ixm-b, .ixc-row") : null);
  const idle = (figure) => {
    if (!figure) return;
    for (const on of figure.querySelectorAll(".ixm-b.on, .ixc-row.on")) on.classList.remove("on");
    const out = figure.querySelector(".fchart-read");
    if (out && out.dataset.idle) out.textContent = out.dataset.idle;
  };
  const read = (mark) => {
    const figure = mark.closest(".fchart");
    const out = figure && figure.querySelector(".fchart-read");
    if (!out) return;
    for (const on of figure.querySelectorAll(".ixm-b.on, .ixc-row.on")) if (on !== mark) on.classList.remove("on");
    mark.classList.add("on");
    out.textContent = mark.dataset.read || "";
  };
  document.addEventListener("pointerover", (event) => { const mark = markOf(event); if (mark) read(mark); });
  document.addEventListener("focusin", (event) => { const mark = markOf(event); if (mark) read(mark); });
  // A tap keeps its reading: a touch's pointerout follows the tap at once.
  document.addEventListener("pointerout", (event) => {
    const mark = markOf(event);
    if (!mark || event.pointerType === "touch" || (event.relatedTarget && mark.contains(event.relatedTarget))) return;
    idle(mark.closest(".fchart"));
  });
  document.addEventListener("focusout", (event) => { const mark = markOf(event); if (mark) idle(mark.closest(".fchart")); });
  document.addEventListener("click", (event) => {
    const button = event.target && event.target.closest ? event.target.closest("[data-ix-view], [data-ix-win]") : null;
    if (!button) return;
    if (VIEWS.includes(button.dataset.ixView)) {
      view = button.dataset.ixView;
      try { localStorage.setItem("indexes-view", view); } catch (_) {}
    }
    if (WINS.includes(button.dataset.ixWin)) {
      win = button.dataset.ixWin;
      try { localStorage.setItem("indexes-window", win); } catch (_) {}
    }
    sync();
  });
  sync();
  new MutationObserver(() => {
    if (document.querySelector(".ix-views[hidden]")) sync();
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
})();`;
