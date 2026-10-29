import type { Overview } from "../app/data";
import type { PortfolioHolding, PortfolioPage, PortfolioPeriod } from "../app/holdings-data";
import { esc, formatUsd } from "./format";
import {
  addressRule,
  COPY_SCRIPT,
  changeCell,
  chartHref,
  copyButton,
  dayText,
  HOLDINGS_CSS,
  pctCell,
  portfolioHref,
  stockHref,
  walletTable,
} from "./holdings";
import { bars, histogram, pullbackChart } from "./holdings-charts";
import {
  fairValueName,
  RANK_SORTS,
  type RankSort,
  rank,
  signedPct,
  UPSIDE_VIEWS,
  upsideBins,
} from "./holdings-rank";
import { tr } from "./i18n";
import { layout } from "./layout";

/**
 * One investor's page, /holdings/<slug> (owner, 2026-10-29): the overview (name, X account,
 * companies in control, the filing's reporting period and date, its SEC documents), the holdings
 * summary, price performance against the S&P 500, the fourteen ranking tables with a top-10 chart,
 * the pullback chart, the upside histogram in three views, the wallets on chain and the filing
 * history. The switches are radio inputs read by :has() (see web/holdings.ts), so no script.
 */

/** Rows a ranking table shows; its chart takes the first ten. */
const TABLE_ROWS = 20;

const ROLE_LABELS = () =>
  ({
    chair: tr("chair"),
    ceo: tr("CEO"),
    founder: tr("founder"),
    controlling_holder: tr("controlling holder"),
  }) as Readonly<Record<string, string>>;

const followersText = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);

/** The SEC's list of a filer's 13Fs. */
const edgarHref = (cik: string) =>
  `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(cik)}&type=13F&dateb=&owner=include&count=40`;

/** The link for a holding: its page among the tracked stocks, or its chart for a coin. */
function holdingLink(h: PortfolioHolding): string {
  if (h.security.startsWith("CRYPTO:")) {
    const chart = chartHref(h.site_base, h.site_class);
    return chart ? `<a href="${chart}">${esc(h.ticker)}</a>` : esc(h.ticker);
  }
  return `<a href="${stockHref(h.ticker)}">${esc(h.ticker)}</a>`;
}

function overviewSection(p: PortfolioPage): string {
  const rows: [string, string][] = [];
  for (const s of p.socials.filter((s) => s.platform === "x")) {
    const parts = [
      `<a href="${esc(s.url)}" rel="noopener" target="_blank">@${esc(s.handle)}</a>`,
      s.account_id ? `<span class="dim">${tr("id {id}", { id: esc(s.account_id) })}</span>` : "",
      s.followers !== null
        ? `${tr("{n} followers", { n: followersText(s.followers) })}${s.as_of ? ` <span class="dim">(${dayText(s.as_of)})</span>` : ""}`
        : "",
    ].filter((x) => x);
    rows.push([tr("X account"), parts.join(" · ")]);
  }
  if (p.companies.length) {
    const roles = ROLE_LABELS();
    rows.push([
      tr("Companies in control"),
      p.companies
        .map((c) => {
          const name = c.portfolio
            ? `<a href="${portfolioHref(c.portfolio)}">${esc(c.name)}</a>`
            : esc(c.name);
          const listing = c.security ? ` <span class="dim">${esc(c.security)}</span>` : "";
          const stake = c.stake_pct !== null ? ` · ${c.stake_pct.toFixed(1)}%` : "";
          return `${name} <span class="dim">(${esc(roles[c.role] ?? c.role)}${stake})</span>${listing}`;
        })
        .join("<br>"),
    ]);
  }
  const s = p.summary;
  if (s && p.ciks.length) {
    rows.push([tr("Reporting period"), dayText(s.period)]);
    rows.push([tr("Filing date"), dayText(s.filed_on)]);
    const latest = p.history.find((h) => h.period === s.period);
    const docs = (latest?.filings ?? []).map(
      (f) =>
        `<a href="${esc(f.url)}" rel="noopener" target="_blank">${esc(f.form)}${f.amendment_type ? ` (${esc(amendmentLabel(f.amendment_type))})` : ""}</a> <span class="dim">${dayText(f.filed_on)}</span>`,
    );
    const edgar = p.ciks.map(
      (cik) =>
        `<a href="${esc(edgarHref(cik))}" rel="noopener" target="_blank">${tr("every 13F on EDGAR (CIK {cik})", { cik: esc(cik) })}</a>`,
    );
    rows.push([tr("SEC reporting"), [...docs, ...edgar].join(" · ")]);
  } else if (s) {
    rows.push([tr("Read on"), dayText(s.period)]);
    rows.push([tr("Source"), tr("their wallets on chain")]);
  }
  if (!rows.length) return "";
  return `<section class="hd-sec"><h2>${tr("Investor overview")}</h2>
<dl class="hd-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></section>`;
}

const amendmentLabel = (type: string) =>
  type === "RESTATEMENT" ? tr("restatement") : type === "NEW HOLDINGS" ? tr("new holdings") : type;

function summarySection(p: PortfolioPage): string {
  const s = p.summary;
  if (!s) return "";
  const tile = (label: string, big: string, note: string) =>
    `<div class="cvd-tile"><p class="eyebrow">${label}</p><p class="cvd-big">${big}</p><p class="dim">${note}</p></div>`;
  const tiles = [
    tile(
      tr("Holdings value (USD)"),
      formatUsd(s.value_usd),
      s.value_now_usd !== null
        ? tr("{usd} at today's prices", { usd: formatUsd(s.value_now_usd) })
        : dayText(s.period),
    ),
    tile(
      tr("QoQ value change"),
      s.value_change_pct === null ? "–" : pctCell(s.value_change_pct),
      s.value_change_pct === null ? tr("no earlier quarter") : tr("against the quarter before"),
    ),
    tile(
      tr("QoQ turnover"),
      s.turnover_pct === null ? "–" : `${s.turnover_pct.toFixed(1)}%`,
      tr("the smaller of bought and sold, over the average value"),
    ),
    tile(
      tr("Holdings count"),
      s.positions.toLocaleString("en-US"),
      tr("{crypto} crypto · {new} new · {closed} sold out", {
        crypto: s.crypto_positions,
        new: s.new_positions,
        closed: s.closed_positions,
      }),
    ),
  ];
  if (s.dividend_income_usd !== null && s.dividend_income_usd > 0)
    tiles.push(
      tile(
        tr("Dividend income"),
        formatUsd(s.dividend_income_usd),
        tr("a year, at last fiscal year's dividends"),
      ),
    );
  if (s.look_through_earnings_usd !== null && s.look_through_earnings_usd !== 0)
    tiles.push(
      tile(
        tr("Look-through earnings"),
        formatUsd(s.look_through_earnings_usd),
        tr("its share of the companies' earnings (TTM)"),
      ),
    );
  if (s.top10_weight_pct > 0 && s.positions > 10)
    tiles.push(
      tile(tr("Top 10"), `${s.top10_weight_pct.toFixed(1)}%`, tr("of the value in ten holdings")),
    );
  // The value is shares only; a 13F also lists options, at the underlying shares' value, and bonds.
  if (s.options_usd + s.debt_usd > 0)
    tiles.push(
      tile(
        tr("Also in the 13F"),
        formatUsd(s.options_usd + s.debt_usd),
        tr("{options} in options at the shares' value · {bonds} in bonds and notes", {
          options: formatUsd(s.options_usd),
          bonds: formatUsd(s.debt_usd),
        }),
      ),
    );
  // Real tickers only: a company with no listing today keeps its CUSIP as its ticker.
  const tickers = p.holdings
    .filter(
      (h) => h.amount > 0 && !(h.security.startsWith("CUSIP:") && h.ticker === h.security.slice(6)),
    )
    .sort((a, b) => b.weight_pct - a.weight_pct)
    .map((h) => h.ticker);
  return `<section class="hd-sec"><div class="hd-sec-head"><h2>${tr("Holdings summary")}</h2>${tickers.length ? copyButton(tickers.join(" "), tickers.length) : ""}</div>
<div class="cvd-tiles hd-tiles">${tiles.join("")}</div></section>`;
}

function performanceSection(p: PortfolioPage): string {
  if (!p.performance.length) return "";
  const names = { "1y": tr("1 year"), "3y": tr("3 years"), "5y": tr("5 years") } as const;
  const rows = p.performance
    .map(
      (r) =>
        `<tr><td>${names[r.horizon]}</td><td class="num">${pctCell(r.portfolio_pct)}</td><td class="num">${pctCell(r.benchmark_pct)}</td><td class="num">${pctCell(r.relative_pct)}</td><td class="dim">${dayText(r.from_day)} – ${dayText(r.to_day)}</td></tr>`,
    )
    .join("");
  return `<section class="hd-sec"><h2>${tr("Price performance history")}</h2>
<div class="sheet-wrap hd-narrow"><table class="sheet"><thead><tr><th></th><th class="num">${tr("portfolio")}</th><th class="num">${tr("S&amp;P 500")}</th><th class="num">${tr("ratio")}</th><th>${tr("from – to")}</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="notes">${tr("The portfolio is its holdings as filed, rebalanced on each quarter's last day and held to the next. The ratio is how far it beat the S&amp;P 500 (above 0) or trailed it: (1 + portfolio) / (1 + S&amp;P 500) − 1.")}</p></section>`;
}

/**
 * Whether the portfolio has a period before its latest. A first read (a wallet the worker has just
 * started following) compares with nothing, so every coin would read "new" and Satoshi's 2009 coins
 * would top the biggest buys: with no earlier period the page shows no changes at all.
 */
const hasEarlierPeriod = (p: PortfolioPage) => p.history.length > 1;

/** One ranking's pane: the top-10 bars and the table. */
function rankPane(p: PortfolioPage, sort: RankSort): string {
  const rows = rank(p.holdings, sort);
  const changes = hasEarlierPeriod(p);
  const figureColumn = !["largest", "buys", "sells"].includes(sort.id);
  const chart = bars(
    rows.slice(0, 10).map((r) => ({
      label: r.holding.ticker,
      href: r.holding.security.startsWith("CRYPTO:") ? undefined : stockHref(r.holding.ticker),
      value: r.figure,
      text: sort.format(r.figure),
    })),
    tr("Top 10 by {figure}", { figure: sort.figure() }),
  );
  const body = rows
    .slice(0, TABLE_ROWS)
    .map(
      (r, i) =>
        `<tr><td class="num dim">${i + 1}</td><td>${holdingLink(r.holding)}</td><td class="hd-name">${esc(r.holding.name)}</td><td class="num">${r.holding.weight_pct.toFixed(2)}%</td><td class="num">${formatUsd(r.holding.value_usd)}</td>${changes ? `<td>${changeCell(r.holding.change, r.holding.change_usd)}</td>` : ""}${figureColumn ? `<td class="num">${esc(sort.format(r.figure))}</td>` : ""}</tr>`,
    )
    .join("");
  const more =
    rows.length > TABLE_ROWS
      ? `<p class="dim">${tr("{shown} of {n} holdings with this figure.", { shown: TABLE_ROWS, n: rows.length })}</p>`
      : "";
  return `<div class="hd-rank-pane" data-rank="${sort.id}"><h3 class="hd-h3">${sort.label()}</h3>
${chart}
<div class="sheet-wrap"><table class="sheet"><thead><tr><th class="num">#</th><th>${tr("ticker")}</th><th class="hd-name">${tr("name")}</th><th class="num">${tr("weight")}</th><th class="num">${tr("value")}</th>${changes ? `<th>${tr("last quarter")}</th>` : ""}${figureColumn ? `<th class="num">${esc(sort.figure())}</th>` : ""}</tr></thead><tbody>${body}</tbody></table></div>${more}</div>`;
}

function rankingSection(p: PortfolioPage): string {
  const sorts = RANK_SORTS.filter(
    (s) =>
      (hasEarlierPeriod(p) || (s.id !== "buys" && s.id !== "sells")) &&
      rank(p.holdings, s).length > 0,
  );
  if (!sorts.length) return "";
  const first = sorts[0] as RankSort;
  const chips = sorts
    .map(
      (s) =>
        `<label><input type="radio" name="hd-rank" id="hd-rank-${s.id}"${s === first ? " checked" : ""}><span>${s.label()}</span></label>`,
    )
    .join("");
  // Without :has() every pane shows, one under another, as with no CSS at all.
  const css = `.hd-rank .hd-rank-pane{display:none}
${sorts.map((s) => `.hd-rank:has(#hd-rank-${s.id}:checked) .hd-rank-pane[data-rank="${s.id}"]{display:block}`).join("\n")}
@supports not selector(:has(*)){.hd-rank .hd-rank-pane{display:block}}`;
  return `<section class="hd-sec hd-rank" id="rank"><h2>${tr("Ranking tables")}</h2>
<div class="hd-chips" role="radiogroup" aria-label="${tr("Sort the holdings by")}">${chips}</div>
${sorts.map((s) => rankPane(p, s)).join("\n")}
<style>${css}</style></section>`;
}

function pullbackSection(p: PortfolioPage): string {
  const chart = pullbackChart(p.pullback, stockHref);
  if (!chart) return "";
  return `<section class="hd-sec"><h2>${tr("Recent price pullbacks")}</h2>
<p class="dim">${tr("The ten holdings furthest below their 1-month high: a month of daily closes, the high dashed.")}</p>
${chart}</section>`;
}

function upsideSection(p: PortfolioPage): string {
  const held = p.holdings.filter((h) => h.amount > 0 && !h.security.startsWith("CRYPTO:"));
  if (!held.length) return "";
  const views = UPSIDE_VIEWS.map((v) => ({ view: v, ...upsideBins(held, v) }));
  if (views.every((v) => v.counted === 0)) return "";
  const radios = views
    .map(
      (v, i) =>
        `<label><input type="radio" name="hd-up" id="hd-up-${v.view.id}"${i === 0 ? " checked" : ""}><span>${v.view.label()}</span></label>`,
    )
    .join("");
  const panes = views
    .map((v) => {
      const note = v.counted
        ? tr("{n} holdings with a value, median {median}; {missing} without.", {
            n: v.counted,
            median: v.median === null ? "–" : signedPct(v.median),
            missing: v.missing,
          })
        : tr("No holding has a value for this view.");
      return `<div class="hd-up-pane" data-view="${v.view.id}">${histogram(v.bins, v.view.label())}<p class="dim hd-up-note">${note}</p></div>`;
    })
    .join("");
  const css = `.hd-upside .hd-up-pane{display:none}
${views.map((v) => `.hd-upside:has(#hd-up-${v.view.id}:checked) .hd-up-pane[data-view="${v.view.id}"]{display:block}`).join("\n")}
@supports not selector(:has(*)){.hd-upside .hd-up-pane{display:block}}`;
  return `<section class="hd-sec hd-upside"><h2>${tr("Upside distribution")}</h2>
<div class="seg hd-views" role="radiogroup" aria-label="${tr("Upside to")}">${radios}</div>
${panes}
<p class="notes">${tr("Each holding's upside is a value per share over today's price, less one, in bins of 10 points. {fv} is the median of the analyst target, Graham's formula and the sector's median P/E and P/B applied to the company, when at least two exist. Analyst price targets are the average target. Ben Graham's formula is EPS × (8.5 + 2g) × 4.4 / Y, with g the expected EPS growth held to 0–15% and Y Moody's Aaa yield.", { fv: fairValueName() })}</p>
<style>${css}</style></section>`;
}

function walletSection(p: PortfolioPage): string {
  if (!p.wallets.length) return "";
  return `<section class="hd-sec"><h2>${tr("On chain")}</h2>
${walletTable(p.wallets)}
<p class="notes">${addressRule()}</p></section>`;
}

function historySection(history: readonly PortfolioPeriod[]): string {
  const filed = history.filter((h) => h.filed_on !== null);
  if (!filed.length) return "";
  const rows = filed
    .map((h) => {
      const docs = h.filings
        .map(
          (f) =>
            `<a href="${esc(f.url)}" rel="noopener" target="_blank">${esc(f.form)}</a>${f.amendment_type ? ` <span class="dim">${esc(amendmentLabel(f.amendment_type))}</span>` : ""}`,
        )
        .join(" · ");
      return `<tr><td>${dayText(h.period)}</td><td>${dayText(h.filed_on)}</td><td>${docs || '<span class="dim">–</span>'}</td><td class="num">${formatUsd(h.value_usd)}</td><td class="num">${pctCell(h.value_change_pct)}</td><td class="num">${h.turnover_pct === null ? '<span class="dim">–</span>' : `${h.turnover_pct.toFixed(1)}%`}</td><td class="num">${h.positions}</td><td class="num">${h.new_positions}</td><td class="num">${h.closed_positions}</td></tr>`;
    })
    .join("");
  return `<section class="hd-sec"><h2>${tr("Filing history")}</h2>
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>${tr("quarter")}</th><th>${tr("filed")}</th><th>${tr("SEC documents")}</th><th class="num">${tr("value")}</th><th class="num">${tr("QoQ")}</th><th class="num">${tr("turnover")}</th><th class="num">${tr("positions")}</th><th class="num">${tr("opened")}</th><th class="num">${tr("closed")}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

/** The page. */
export function investorPage(options: {
  page: PortfolioPage;
  overview: Overview | null;
  now: number;
}): string {
  const { page: p, overview, now } = options;
  const sections = [
    overviewSection(p),
    summarySection(p),
    performanceSection(p),
    rankingSection(p),
    pullbackSection(p),
    upsideSection(p),
    walletSection(p),
    historySection(p.history),
  ].filter((s) => s);
  const empty = p.summary
    ? ""
    : `<p class="empty">${tr("Nothing read for this portfolio yet: its filings or wallets are still being collected.")}</p>`;
  return layout({
    title: tr("{name}: holdings and performance", { name: p.name }),
    description: tr(
      "What {name} holds ({title}): holdings value, quarter-on-quarter changes and turnover, returns against the S&P 500, rankings and upside, from their latest filing.",
      { name: p.name, title: p.title },
    ),
    path: portfolioHref(p.portfolio),
    overview,
    now,
    body: `<p class="dim hd-crumb"><a href="/holdings">${tr("Holdings")}</a></p>
<h1>${esc(p.name)}${p.title && p.title !== p.name ? ` <span class="dim hd-sub">${esc(p.title)}</span>` : ""}</h1>
${p.summary_text ? `<p class="lede">${esc(p.summary_text)}</p>` : ""}
${empty}
${sections.join("\n")}
<style>${HOLDINGS_CSS}${INVESTOR_CSS}</style>
<script>${COPY_SCRIPT}</script>`,
  });
}

const INVESTOR_CSS = `
.hd-sec{margin:18px 0 6px}
.hd-sec>h2{margin:0 0 8px}
.hd-sec-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 8px}
.hd-sec-head h2{margin:0}
.hd-h3{margin:10px 0 6px;font:700 12px/1.2 var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.hd-dl{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 18px;margin:0}
.hd-dl dt{color:var(--muted)}
.hd-dl dd{margin:0;overflow-wrap:anywhere}
@media (max-width:560px){.hd-dl{grid-template-columns:minmax(0,1fr)}.hd-dl dd{margin-bottom:6px}}
.hd-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}
@media (max-width:860px){.hd-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
.hd-narrow{max-width:720px}
.hd-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px}
.hd-chips label{position:relative}
.hd-chips input{position:absolute;opacity:0;width:1px;height:1px;margin:0}
.hd-chips span{display:block;padding:2px 8px;color:var(--muted);background:var(--band);border:1px solid var(--rule);cursor:pointer;white-space:nowrap}
.hd-chips label:hover span{color:var(--ink)}
.hd-chips input:checked+span{color:var(--ink);border-color:var(--accent)}
.hd-chips input:focus-visible+span{outline:1px solid var(--accent);outline-offset:1px}
.hd-upside .seg{width:max-content;max-width:100%;flex-wrap:wrap;margin:0 0 10px}
.hd-up-note{margin:6px 0 0}`;
