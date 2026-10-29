import type { IndexLevelRow } from "../app/data";
import { lazyPlaceholder } from "./chart-skeleton";
import { esc } from "./format";
import { bookName, gammaBookFor } from "./gamma";
import { msg, tr, trMsg } from "./i18n";
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
 * LIVE OR A CLOSE, SAID PER ROW. KRX, Sina and TradingView quote during the session (TradingView up to
 * 20 minutes behind, stamped with the time its level stands for); NSE's file is the day's close, read
 * once in the evening. A close shown as if it were live would read as a frozen market, so the As of
 * column names which it is, in the reader's own time (localtime.ts).
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

const US = msg("United States");
const HONG_KONG = msg("Hong Kong");
const JAPAN = msg("Japan");
const INDIA = msg("India");
const CHINA = msg("China");
const KOREA = msg("Korea");

/** Regions in the order the tab lists them, each with its indexes in order and the market of each. */
const REGIONS: { region: () => string; indexes: [ticker: string, market: string][] }[] = [
  {
    region: () => tr("Americas"),
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
    indexes: [
      ["TA35", msg("Israel")],
      ["TASI", msg("Saudi Arabia")],
    ],
  },
  {
    region: () => tr("Asia-Pacific"),
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
  return `<tr><td>${name}</td><td class="ix-country">${country}</td><td class="num">${level(l.price)}</td>${change}<td class="num dim">${range}</td><td class="ix-spark-cell">${spark(l.closes)}</td><td class="ix-opt">${book}</td><td class="dim">${asOf}</td></tr>`;
}

export function indexesPanel(data: IndexLevelRow[] | null, now: number): string {
  if (data === null)
    return `<p class="empty">${tr("The index levels could not be read right now.")}</p>`;
  if (data.length === 0)
    return `<p class="empty">${tr("No index level has been read yet. The collector reads them every five minutes.")}</p>`;
  const byTicker = new Map(data.map((l) => [l.ticker, l]));
  const listed = new Set<string>();
  const groups = REGIONS.map(({ region, indexes }) => {
    const rows = indexes.flatMap(([t, market]) => {
      const l = byTicker.get(t);
      if (!l) return [];
      listed.add(t);
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
  return `<p class="dim ix-lede">${tr("Stock index levels across the Americas, Europe, the Middle East and Asia-Pacific: the day's change against the previous close, the day's range, and a month of daily closes.")}</p>
<div class="sheet-wrap"><table class="sheet mc-table ix-table"><thead><tr><th>${tr("Index")}</th><th>${tr("Country")}</th><th class="num">${tr("Level")}</th><th class="num">${tr("Change")}</th><th class="num">${tr("Day range")}</th><th>${tr("30 days")}</th><th>${tr("Option book")}</th><th>${tr("As of")}</th></tr></thead><tbody>${groups.join("")}</tbody></table></div>
<p class="notes">${tr("India's Nifty indexes, Nifty Bank and India VIX are NSE's daily closing file, read once each evening. The rest are read every five minutes: KOSPI and KOSPI 200 from the Korea Exchange, the BSE Sensex, Nikkei 225, TOPIX, Straits Times and S&P/ASX 200 from Sina's quotes, and the other indexes from quotes delayed by up to 20 minutes; a market that has closed shows its close. BSE-100, BSE-200 and BSE-500 have no free source we can read.")}</p>`;
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
.ix-name{color:inherit}
.ix-live{color:var(--accent)}
.ix-spark-cell{width:104px}
.ix-spark{display:block}
@media (max-width:640px){.ix-table th:nth-child(5),.ix-table td:nth-child(5),.ix-table th:nth-child(6),.ix-table td:nth-child(6){display:none}}`;
