import type { Overview } from "../app/data";
import type {
  HeldStock,
  OnchainHolder,
  PortfolioCard,
  PortfolioMove,
  PortfolioWallet,
  RichChain,
  RichList,
  StockPage,
} from "../app/holdings-data";
import { lazyPlaceholder } from "./chart-skeleton";
import { esc, formatUsd } from "./format";
import { HOLDINGS_CHART_CSS, sparkline } from "./holdings-charts";
import { signedPct, signedUsd } from "./holdings-rank";
import { RICH_LIST_CSS, RICH_SWAP_SCRIPT, richListPanel, richPanelHref } from "./holdings-richlist";
import { msg, tr, trMsg } from "./i18n";
import { icon } from "./icons";
import { layout } from "./layout";
import { MONTHS } from "./slot-chart";
import { tabBar } from "./tabs";

/**
 * The Holdings section, /holdings: what well-known investors hold, as on Investing.com's Pro Ideas
 * (owner, 2026-10-29). Five topics as tabs, the first rendered and the rest loaded when shown:
 *
 *   Investors  the idea grid, a card per portfolio (13F filers and holders with traced wallets)
 *   Stocks     what the tracked investors hold most, and per stock who holds it
 *   Moves      each new filing with its biggest buy and sell
 *   On chain   the holders with traced wallets, their evidence and balances
 *   Rich list  the 500 largest addresses on Bitcoin, Ethereum and Tron (web/holdings-richlist.ts)
 *
 * Each investor has a page of their own (web/holdings-investor.ts). The tables are the holdings
 * worker's (collector migration 058); before they exist every topic says so.
 *
 * NO SCRIPT DOES THE SWITCHING. The style filter, the ranking sorts and the histogram views are radio
 * inputs read by :has() selectors, so they work in a tab tabs.ts loads later (whose markup arrives as
 * innerHTML and runs no script) and with JavaScript off. The one script is the Copy button's.
 */

export const HOLDINGS_PANELS = ["investors", "stocks", "moves", "onchain", "richlist"] as const;
export type HoldingsPanel = (typeof HOLDINGS_PANELS)[number];
export const isHoldingsPanel = (value: string | null): value is HoldingsPanel =>
  HOLDINGS_PANELS.some((p) => p === value);

/** "Jun 30, 2026" from YYYY-MM-DD, in the page's language. */
export function dayText(iso: string | null): string {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  return `${trMsg(MONTHS[Number(m) - 1] ?? "")} ${Number(d)}, ${y}`;
}

export const portfolioHref = (slug: string) => `/holdings/${encodeURIComponent(slug)}`;
export const stockHref = (ticker: string) => `/holdings/stock/${encodeURIComponent(ticker)}`;

/** The site's own chart for a holding, when the site has the asset. */
export function chartHref(base: string | null, assetClass: string | null): string | null {
  if (!base || !assetClass) return null;
  return assetClass === "crypto"
    ? `/chart/${encodeURIComponent(base)}`
    : `/chart/${encodeURIComponent(assetClass)}/${encodeURIComponent(base)}`;
}

/** The ticker without its CRYPTO: prefix or exchange. */
export const securityTicker = (security: string) => security.replace(/^[A-Z]+:/, "");

/** A percentage in the up or down colour; "–" when unknown. */
export function pctCell(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '<span class="dim">–</span>';
  return `<span class="${value > 0 ? "hd-up" : value < 0 ? "hd-down" : ""}">${signedPct(value, digits)}</span>`;
}

const STYLE_LABELS: Readonly<Record<string, string>> = {
  value: msg("value"),
  growth: msg("growth"),
  activist: msg("activist"),
  macro: msg("macro"),
  crypto: msg("crypto"),
  government: msg("government"),
};
const styleLabel = (style: string) => {
  const key = STYLE_LABELS[style];
  return key ? trMsg(key) : style;
};

/** What a position did over the period, as a word and the dollars moved. */
export function changeCell(change: string, usd: number): string {
  const words: Readonly<Record<string, string>> = {
    new: tr("new"),
    added: tr("added"),
    reduced: tr("reduced"),
    closed: tr("sold out"),
  };
  const word = words[change];
  if (!word) return '<span class="dim">–</span>';
  const cls = usd > 0 ? "hd-up" : usd < 0 ? "hd-down" : "";
  return `<span class="hd-chg ${cls}">${word}${usd ? ` ${signedUsd(usd)}` : ""}</span>`;
}

/** The Copy button: puts `tickers` on the clipboard (COPY_SCRIPT). */
export function copyButton(tickers: string, count: number): string {
  return `<button type="button" class="hd-copy" data-copy="${esc(tickers)}" data-copied="${esc(tr("Copied"))}" title="${esc(count === 1 ? tr("Copy the ticker") : tr("Copy the {n} tickers", { n: count }))}">${icon("copy")}<span>${tr("Copy")}</span></button>`;
}

/** One card on the idea grid. */
function card(c: PortfolioCard): string {
  const tickers = c.tickers ?? "";
  const count = tickers ? tickers.split(" ").length : 0;
  const holdings =
    c.positions === null
      ? ""
      : c.positions === 1
        ? tr("1 holding")
        : tr("{n} holdings", { n: c.positions.toLocaleString("en-US") });
  const head =
    c.return_3y_pct !== null
      ? `<b class="hd-big ${c.return_3y_pct >= 0 ? "hd-up" : "hd-down"}">${signedPct(c.return_3y_pct)}</b><span class="hd-tag">${tr("3 year return")}</span>`
      : `<b class="hd-big">${formatUsd(c.value_usd)}</b><span class="hd-tag">${c.style === "crypto" ? tr("on chain") : tr("holdings value")}</span>`;
  const foot = [
    c.return_3y_pct !== null ? formatUsd(c.value_usd) : null,
    c.value_change_pct !== null ? `${tr("QoQ")} ${pctCell(c.value_change_pct)}` : null,
    c.return_1y_pct !== null ? `${tr("1Y")} ${pctCell(c.return_1y_pct)}` : null,
    count ? esc(tickers.split(" ").slice(0, 3).join(" ")) : null,
  ].filter((x) => x !== null);
  return `<article class="hd-card" data-style="${esc(c.style)}">
<header class="hd-card-head"><div><h2 class="hd-card-name"><a href="${portfolioHref(c.portfolio)}">${esc(c.name)}</a></h2><p class="dim">${holdings}${c.title && c.title !== c.name ? ` · ${esc(c.title)}` : ""}</p></div>${count ? copyButton(tickers, count) : ""}</header>
<div class="hd-card-mid"><div class="hd-card-ret">${head}</div><div class="hd-card-spark">${sparkline(c.sparkline ?? [])}</div></div>
${c.summary ? `<p class="hd-card-sum">${esc(c.summary)}</p>` : ""}
<p class="hd-card-foot dim">${foot.join(" · ")}</p>
</article>`;
}

/** The Investors topic: the style filter and the cards. */
export function investorsPanel(cards: readonly PortfolioCard[]): string {
  if (!cards.length)
    return `<p class="empty">${tr("No investor is listed yet: the holdings worker reads their filings and wallets first.")}</p>`;
  // A style is a slug the worker writes (value, activist, crypto); one that is not stays unfiltered,
  // since it is spliced into the selectors below.
  const styles = [...new Set(cards.map((c) => c.style).filter((s) => /^[a-z0-9-]{1,24}$/.test(s)))];
  const radios =
    styles.length > 1
      ? `<div class="seg hd-styles" role="radiogroup" aria-label="${tr("Style")}"><label><input type="radio" name="hd-style" id="hd-style-all" checked><span>${tr("all")}</span></label>${styles
          .map(
            (s) =>
              `<label><input type="radio" name="hd-style" id="hd-style-${esc(s)}"><span>${esc(styleLabel(s))}</span></label>`,
          )
          .join("")}</div>
<style>${styles.map((s) => `.hd-grid:has(#hd-style-${s}:checked) .hd-card:not([data-style="${s}"]){display:none}`).join("\n")}</style>`
      : "";
  return `<div class="hd-grid">${radios}
<div class="hd-cards">${cards.map(card).join("\n")}</div>
</div>
<p class="notes">${tr("A card's return is its portfolio as filed, rebalanced to each quarter's holdings on the quarter's last day, in price terms like the S&amp;P 500. A card with no return yet holds coins on chain, whose history the worker is still building.")}</p>`;
}

/** The Stocks topic: the most held. */
export function stocksPanel(rows: readonly HeldStock[]): string {
  if (!rows.length) return `<p class="empty">${tr("No holdings read yet.")}</p>`;
  const body = rows
    .map((r, i) => {
      const chart = chartHref(r.site_base, r.site_class);
      return `<tr><td class="num dim">${i + 1}</td><td><a href="${stockHref(r.ticker)}">${esc(r.ticker)}</a></td><td class="hd-name">${esc(r.name)}</td><td class="num">${r.holders}</td><td class="num">${r.buyers || '<span class="dim">0</span>'}</td><td class="num">${r.sellers || '<span class="dim">0</span>'}</td><td class="num">${formatUsd(r.value_usd)}</td><td class="num">${r.net_change_usd ? `<span class="${r.net_change_usd > 0 ? "hd-up" : "hd-down"}">${signedUsd(r.net_change_usd)}</span>` : '<span class="dim">–</span>'}</td><td>${chart ? `<a href="${chart}">${tr("chart")}</a>` : ""}</td></tr>`;
    })
    .join("");
  return `<p class="lede">${tr("What the tracked investors hold most, by how many hold it, from each one's latest filing. A stock's page shows who holds it.")}</p>
<div class="sheet-wrap"><table class="sheet"><thead><tr><th class="num">#</th><th>${tr("ticker")}</th><th class="hd-name">${tr("name")}</th><th class="num">${tr("held by")}</th><th class="num">${tr("buyers")}</th><th class="num">${tr("sellers")}</th><th class="num">${tr("value held")}</th><th class="num">${tr("net bought")}</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`;
}

/** The Moves topic: the newest filings. */
export function movesPanel(rows: readonly PortfolioMove[]): string {
  if (!rows.length) return `<p class="empty">${tr("No filing read yet.")}</p>`;
  const move = (ticker: string | null, usd: number | null) =>
    ticker && usd
      ? `<a href="${stockHref(ticker)}">${esc(ticker)}</a> <span class="${usd > 0 ? "hd-up" : "hd-down"}">${signedUsd(usd)}</span>`
      : '<span class="dim">–</span>';
  const body = rows
    .map(
      (r) =>
        `<tr><td>${dayText(r.filed_on)}</td><td><a href="${portfolioHref(r.portfolio)}">${esc(r.name)}</a></td><td>${dayText(r.period)}</td><td class="num">${formatUsd(r.value_usd)}</td><td class="num">${pctCell(r.value_change_pct)}</td><td class="num">${r.turnover_pct === null ? '<span class="dim">–</span>' : `${r.turnover_pct.toFixed(1)}%`}</td><td>${move(r.top_buy, r.top_buy_usd)}</td><td>${move(r.top_sell, r.top_sell_usd)}</td></tr>`,
    )
    .join("");
  return `<p class="lede">${tr("Each 13F as it lands, newest first, with the quarter's biggest buy and sell in dollars.")}</p>
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>${tr("filed")}</th><th>${tr("investor")}</th><th>${tr("quarter")}</th><th class="num">${tr("value")}</th><th class="num">${tr("QoQ")}</th><th class="num">${tr("turnover")}</th><th>${tr("biggest buy")}</th><th>${tr("biggest sell")}</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

/** What each kind of evidence is called on the page. */
export function evidenceLabel(evidence: string): string {
  const labels: Readonly<Record<string, string>> = {
    self_declared: tr("their own post"),
    ens: tr("ENS name"),
    court_filing: tr("court filing"),
    sec_filing: tr("SEC filing"),
    reserves: tr("proof of reserves"),
    news: tr("news report"),
    cluster: tr("on-chain trace"),
    arkham: "Arkham",
    research: tr("published research"),
    explorer: tr("explorer label"),
    official: tr("government record"),
  };
  return labels[evidence] ?? evidence;
}

const CHAIN_NAMES: Readonly<Record<string, string>> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
  tron: "Tron",
  hyperliquid: "Hyperliquid",
  base: "Base",
  arbitrum: "Arbitrum",
  bsc: "BNB Chain",
  polygon: "Polygon",
  ton: "TON",
  optimism: "Optimism",
  avalanche: "Avalanche",
  xrp: "XRP Ledger",
};
export const chainName = (chain: string) => CHAIN_NAMES[chain] ?? chain;

/** A block explorer's page for an address, for every chain the worker reads. */
export function explorerHref(chain: string, address: string): string | null {
  if (address.startsWith("set:")) return null;
  const a = encodeURIComponent(address);
  const pages: Readonly<Record<string, string>> = {
    bitcoin: `https://mempool.space/address/${a}`,
    ethereum: `https://etherscan.io/address/${a}`,
    base: `https://basescan.org/address/${a}`,
    arbitrum: `https://arbiscan.io/address/${a}`,
    bsc: `https://bscscan.com/address/${a}`,
    polygon: `https://polygonscan.com/address/${a}`,
    optimism: `https://optimistic.etherscan.io/address/${a}`,
    avalanche: `https://snowtrace.io/address/${a}`,
    solana: `https://solscan.io/account/${a}`,
    tron: `https://tronscan.org/#/address/${a}`,
    xrp: `https://xrpscan.com/account/${a}`,
    hyperliquid: `https://hypurrscan.io/address/${a}`,
    ton: `https://tonviewer.com/${a}`,
  };
  return pages[chain] ?? null;
}

/** An address shortened for a table, whole in its title. */
const shortAddress = (address: string) =>
  address.length > 16 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;

/**
 * A holder's wallets as a table: each address (or set of outputs) with its evidence and confidence,
 * and its newest balances. Shared by the On chain topic and the investor page.
 */
export function walletTable(wallets: readonly PortfolioWallet[]): string {
  const body = wallets
    .map((w) => {
      const href = explorerHref(w.chain, w.address);
      const where = w.address.startsWith("set:")
        ? `<span title="${esc(w.address)}">${
            w.outputs > 0
              ? tr("a set of {n} coinbase outputs", { n: w.outputs.toLocaleString("en-US") })
              : tr("a set of coinbase outputs")
          }</span>`
        : href
          ? `<a href="${esc(href)}" rel="noopener" target="_blank" title="${esc(w.address)}">${esc(shortAddress(w.address))}</a>`
          : `<span title="${esc(w.address)}">${esc(shortAddress(w.address))}</span>`;
      const coins = w.coins
        .filter((c) => c.value_usd >= 1)
        .slice(0, 4)
        .map((c) => `${esc(securityTicker(c.security))} ${formatUsd(c.value_usd)}`)
        .join(" · ");
      return `<tr><td>${esc(chainName(w.chain))}</td><td>${where}</td><td>${esc(w.label)}</td><td><a href="${esc(w.evidence_url)}" rel="noopener" target="_blank">${esc(evidenceLabel(w.evidence))}</a></td><td>${esc(confidenceLabel(w.confidence))}</td><td class="num">${formatUsd(w.value_usd)}</td><td class="hd-coins">${coins || '<span class="dim">–</span>'}</td></tr>`;
    })
    .join("");
  return `<div class="sheet-wrap"><table class="sheet"><thead><tr><th>${tr("chain")}</th><th>${tr("address")}</th><th>${tr("label")}</th><th>${tr("evidence")}</th><th>${tr("confidence")}</th><th class="num">${tr("value")}</th><th>${tr("largest coins")}</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function confidenceLabel(confidence: string): string {
  const labels: Readonly<Record<string, string>> = {
    confirmed: tr("confirmed"),
    likely: tr("likely"),
    possible: tr("possible"),
  };
  return labels[confidence] ?? confidence;
}

/** The rule the address book follows, said wherever wallets are shown. */
export const addressRule = () =>
  tr(
    "An address is shown only when the holder published it, an official record names it (a sanctions list, a court or seizure filing, a financial disclosure), or established news outlets or explorers attribute it to a public figure. Guessed or AI-predicted attributions are left out: tying a named person to a large wallet can put them in danger.",
  );

/** The On chain topic: the holders with traced wallets. */
export function onchainPanel(rows: readonly OnchainHolder[]): string {
  if (!rows.length) return `<p class="empty">${tr("No wallet traced yet.")}</p>`;
  const body = rows
    .map((r) => {
      const name = r.portfolio
        ? `<a href="${portfolioHref(r.portfolio)}">${esc(r.name)}</a>`
        : esc(r.name);
      const chains = r.chains.split(" ").map(chainName).join(", ");
      const evidence = r.evidence.split(" ").map(evidenceLabel).join(", ");
      const coins = r.coins
        .filter((c) => c.value_usd >= 1)
        .map((c) => `${esc(securityTicker(c.security))} ${formatUsd(c.value_usd)}`)
        .join(" · ");
      return `<tr><td>${name}</td><td class="num">${r.addresses}</td><td>${esc(chains)}</td><td>${esc(evidence)}</td><td class="num">${formatUsd(r.value_usd)}</td><td class="hd-coins">${coins || '<span class="dim">–</span>'}</td></tr>`;
    })
    .join("");
  return `<p class="lede">${tr("Holders whose wallets are known from public evidence, with what those wallets hold now. Each holder's page lists every address with its source.")}</p>
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>${tr("holder")}</th><th class="num">${tr("addresses")}</th><th>${tr("chains")}</th><th>${tr("evidence")}</th><th class="num">${tr("value")}</th><th>${tr("largest coins")}</th></tr></thead><tbody>${body}</tbody></table></div>
<p class="notes">${addressRule()}</p>`;
}

/** A topic loaded on its own (`?panel=`), for tabs.ts. */
export function holdingsFragment(
  panel: HoldingsPanel,
  data: {
    cards?: readonly PortfolioCard[];
    stocks?: readonly HeldStock[];
    moves?: readonly PortfolioMove[];
    onchain?: readonly OnchainHolder[];
    richlist?: RichList;
  } | null,
): string {
  if (data === null)
    return `<p class="empty">${tr("This tab could not be read. Try again shortly.")}</p>`;
  switch (panel) {
    case "investors":
      return investorsPanel(data.cards ?? []);
    case "stocks":
      return stocksPanel(data.stocks ?? []);
    case "moves":
      return movesPanel(data.moves ?? []);
    case "onchain":
      return onchainPanel(data.onchain ?? []);
    case "richlist":
      return data.richlist
        ? richListPanel(data.richlist)
        : `<p class="empty">${tr("No holdings read yet.")}</p>`;
  }
}

const panelLabel = (panel: HoldingsPanel) =>
  ({
    investors: tr("Investors"),
    stocks: tr("Stocks"),
    moves: tr("Moves"),
    onchain: tr("On chain"),
    richlist: tr("Rich list"),
  })[panel];

/**
 * /holdings: the Investors topic filled, the others loaded when shown. `chain` is the Rich list's
 * (/holdings?chain=tron#richlist), which its tab loads.
 */
export function holdingsPage(options: {
  cards: readonly PortfolioCard[];
  overview: Overview | null;
  now: number;
  chain?: RichChain;
}): string {
  const { cards, overview, now } = options;
  const panels = HOLDINGS_PANELS.map((id) => {
    const filled = id === "investors";
    const href =
      id === "richlist" ? richPanelHref(options.chain ?? "bitcoin") : `/holdings?panel=${id}`;
    return `<div class="tabpanel" role="tabpanel" id="panel-holdings-${id}" data-tab-panel="${id}" aria-labelledby="tab-holdings-${id}"${filled ? "" : ` data-lazy="${esc(href)}"`}>
${filled ? investorsPanel(cards) : lazyPlaceholder(href)}
</div>`;
  }).join("\n");
  return layout({
    title: tr("Holdings: what well-known investors hold"),
    description: tr(
      "The portfolios of well-known investors from their SEC 13F filings and their wallets on chain: holdings value, quarter-on-quarter changes and turnover, returns against the S&P 500, rankings and upside.",
    ),
    path: "/holdings",
    overview,
    now,
    body: `<h1>${tr("Holdings")}</h1>
<p class="lede">${tr("What well-known investors hold: each one's latest 13F filing with the SEC, or their wallets on chain, with how the portfolio has done against the S&amp;P 500.")}</p>
${tabBar({ name: "holdings", tabs: HOLDINGS_PANELS.map((id) => ({ id, label: panelLabel(id) })), activeId: "investors" })}
${panels}
<style>${HOLDINGS_CSS}
${RICH_LIST_CSS}</style>
<script>${COPY_SCRIPT}</script>
<script>${RICH_SWAP_SCRIPT}</script>`,
  });
}

/** /holdings/stock/<ticker>: who among the tracked investors holds it. */
export function stockPageView(options: {
  stock: StockPage;
  overview: Overview | null;
  now: number;
}): string {
  const { stock, overview, now } = options;
  const chart = chartHref(stock.site_base, stock.site_class);
  const facts = [
    stock.close !== null
      ? `<span>${tr("Price")} <b>${stock.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b></span>`
      : "",
    stock.market_cap_usd !== null
      ? `<span>${tr("Market cap")} <b>${formatUsd(stock.market_cap_usd)}</b></span>`
      : "",
    stock.pe_ttm !== null && stock.pe_ttm > 0
      ? `<span>${tr("P/E")} <b>${stock.pe_ttm.toFixed(1)}</b></span>`
      : "",
    stock.dividend_yield_pct !== null && stock.dividend_yield_pct > 0
      ? `<span>${tr("Yield")} <b>${stock.dividend_yield_pct.toFixed(2)}%</b></span>`
      : "",
    stock.perf_1m_pct !== null
      ? `<span>${tr("1 month")} <b>${pctCell(stock.perf_1m_pct)}</b></span>`
      : "",
  ].join("");
  const body = stock.holders
    .map(
      (h) =>
        `<tr><td><a href="${portfolioHref(h.portfolio)}">${esc(h.name)}</a></td><td class="dim">${esc(h.title)}</td><td>${dayText(h.period)}</td><td class="num">${h.amount > 0 ? h.amount.toLocaleString("en-US", { maximumFractionDigits: 0 }) : '<span class="dim">0</span>'}</td><td class="num">${formatUsd(h.value_usd)}</td><td class="num">${h.weight_pct.toFixed(2)}%</td><td>${changeCell(h.change, h.change_usd)}</td></tr>`,
    )
    .join("");
  return layout({
    title: tr("Who holds {ticker}", { ticker: stock.ticker }),
    description: tr(
      "{name} ({ticker}): which well-known investors hold it, how much, and what they did last quarter.",
      { name: stock.name, ticker: stock.ticker },
    ),
    path: stockHref(stock.ticker),
    overview,
    now,
    body: `<p class="dim hd-crumb"><a href="/holdings">${tr("Holdings")}</a> · <a href="/holdings?panel=stocks#stocks">${tr("Stocks")}</a></p>
<h1>${esc(stock.ticker)} <span class="dim hd-sub">${esc(stock.name)}</span></h1>
<p class="dim">${[stock.sector, stock.industry]
      .filter((x) => x)
      .map((x) => esc(x as string))
      .join(" · ")}</p>
<p class="facts">${facts}</p>
${stock.holders.length ? `<div class="sheet-wrap"><table class="sheet"><thead><tr><th>${tr("investor")}</th><th>${tr("portfolio")}</th><th>${tr("quarter")}</th><th class="num">${tr("shares")}</th><th class="num">${tr("value")}</th><th class="num">${tr("weight")}</th><th>${tr("last quarter")}</th></tr></thead><tbody>${body}</tbody></table></div>` : `<p class="empty">${tr("No tracked investor holds it now.")}</p>`}
${chart ? `<p class="hd-more"><a href="${chart}">${tr("Its chart and order flow (CVD)")}</a></p>` : ""}
<p class="notes">${tr("From each investor's latest 13F; a position sold out of in the quarter still shows, with no shares.")}</p>
<style>${HOLDINGS_CSS}</style>`,
  });
}

/**
 * The Copy button. One listener on the document, so a button in a tab loaded later works too; the
 * label says "Copied" for a moment.
 */
export const COPY_SCRIPT = `(() => {
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-copy]") : null;
    if (!button) return;
    event.preventDefault();
    const text = button.getAttribute("data-copy") || "";
    const label = button.querySelector("span");
    const done = () => {
      if (!label) return;
      const before = label.textContent;
      label.textContent = button.getAttribute("data-copied") || before;
      setTimeout(() => { label.textContent = before; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
  });
})();`;

/** The section's styles, theme variables only. */
export const HOLDINGS_CSS = `${HOLDINGS_CHART_CSS}
.hd-crumb{margin:4px 0 6px}
.hd-sub{font-size:.7em;font-weight:400;text-transform:none;letter-spacing:0}
.hd-grid .seg.hd-styles{width:max-content;max-width:100%;flex-wrap:wrap;margin:0 0 12px}
.hd-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
@media (max-width:520px){.hd-cards{grid-template-columns:minmax(0,1fr)}}
.hd-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--rule);background:var(--panel)}
.hd-card:hover{border-color:var(--muted)}
.hd-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.hd-card-head p{margin:2px 0 0}
.hd-card-name{font-size:14px;text-transform:none;letter-spacing:0}
.hd-card-name a{border:0}
.hd-card-name a::after{content:"";position:absolute;inset:0}
.hd-copy{position:relative;z-index:1;display:inline-flex;align-items:center;gap:5px;padding:3px 8px;font:12px var(--mono);color:var(--accent);background:none;border:1px solid var(--rule);cursor:pointer;white-space:nowrap}
.hd-copy:hover{border-color:var(--accent)}
.hd-card-mid{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px}
.hd-card-ret{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.hd-big{font:700 clamp(24px,3.2vw,30px)/1 var(--mono)}
.hd-tag{padding:2px 8px;background:var(--band);color:var(--muted);font-size:11px;white-space:nowrap}
.hd-card-sum{margin:0;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hd-card-foot{margin:auto 0 0}
.hd-name{max-width:28ch;overflow:hidden;text-overflow:ellipsis}
@media (max-width:560px){.sheet .hd-name,.sheet th.hd-name{display:none}}
.hd-coins{white-space:normal;min-width:180px}
.hd-chg{white-space:nowrap}
.hd-more{margin:12px 0}`;
