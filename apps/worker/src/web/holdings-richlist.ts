import {
  RICH_CHAINS,
  type RichChain,
  type RichList,
  type RichListCategoryDay,
  type RichListRow,
} from "../app/holdings-data";
import { CHART_SKELETON_JS } from "./chart-skeleton";
import { esc, formatUsd } from "./format";
import { dayText, evidenceLabel, portfolioHref } from "./holdings";
import { tr } from "./i18n";
import { icon } from "./icons";

/**
 * The Holdings section's Rich list topic (/holdings?panel=richlist&chain=): the 500 largest addresses
 * on Bitcoin, Ethereum and Tron, read once a day by the holdings worker (collector migration 059), with
 * a name only where a published source gives one (the owner's address-book rule, 2026-10-30). Most of
 * the list is unlabelled, and stays so: nothing here traces who owns an address.
 *
 * The chain switch is three links to /holdings?chain=<chain>#richlist, which the hub honours. On the
 * hub RICH_SWAP_SCRIPT swaps the tab in place instead, as the Rates page's Gamma book picker does, and
 * points the tab's data-lazy at the chosen chain so tabs.ts reloads that one. The tab's markup sits in
 * .rl-body rather than .lazy-body: the list changes once a day, so live.ts has no reason to poll it.
 */

const COIN: Readonly<Record<RichChain, string>> = { bitcoin: "BTC", ethereum: "ETH", tron: "TRX" };
const CHAIN_LABEL: Readonly<Record<RichChain, string>> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  tron: "Tron",
};

/** The categories, in the order the chart stacks them from the bottom and the legend lists them. */
export const RICH_CATEGORIES = [
  "exchange",
  "fund",
  "government",
  "bridge",
  "staking",
  "contract",
  "holder",
  "other",
  "unlabelled",
] as const;
type RichCategory = (typeof RICH_CATEGORIES)[number];
const asCategory = (value: string): RichCategory =>
  RICH_CATEGORIES.find((c) => c === value) ?? "other";

export function categoryLabel(category: string): string {
  const labels: Readonly<Record<RichCategory, string>> = {
    exchange: tr("exchange"),
    fund: tr("fund"),
    government: tr("government"),
    bridge: tr("bridge"),
    staking: tr("staking"),
    contract: tr("contract"),
    holder: tr("known holder"),
    other: tr("other named"),
    unlabelled: tr("unlabelled"),
  };
  return labels[asCategory(category)];
}

/**
 * What a name's evidence is called. A holder's comes from the address book, whose words are the On
 * chain topic's; a label's from the rich list's own files, where "official" is a project's own page.
 */
function richEvidenceLabel(row: RichListRow): string {
  const evidence = row.evidence ?? "";
  if (row.category === "holder") return evidenceLabel(evidence);
  const labels: Readonly<Record<string, string>> = {
    reserves: tr("proof of reserves"),
    official: tr("official page"),
    court_filing: tr("court filing"),
    news: tr("news report"),
    explorer: tr("explorer label"),
  };
  return labels[evidence] ?? evidence;
}

/** An address's page on the explorer the list credits for that chain. */
export function richExplorerHref(chain: RichChain, address: string): string {
  const a = encodeURIComponent(address);
  return {
    bitcoin: `https://mempool.space/address/${a}`,
    ethereum: `https://eth.blockscout.com/address/${a}`,
    tron: `https://tronscan.org/#/address/${a}`,
  }[chain];
}

/** The hub's address for one chain's list: the bare hub for Bitcoin. */
export const richHref = (chain: RichChain) =>
  `/holdings${chain === "bitcoin" ? "" : `?chain=${chain}`}#richlist`;

/** The tab's own address, for its data-lazy. */
export const richPanelHref = (chain: RichChain) =>
  `/holdings?panel=richlist${chain === "bitcoin" ? "" : `&chain=${chain}`}`;

/** Coins as the table prints them: whole above a thousand, two decimals below. */
const coins = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 });

/** Coins for a tile, where 83,479,978,726 TRX would not fit a phone's half-width: 83.48B from a billion. */
const tileCoins = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : coins(n));

/** A change in coins, with a real minus and no sign at zero. */
function signedCoins(n: number): string {
  const text = coins(Math.abs(n));
  return n > 0 ? `+${text}` : n < 0 ? `−${text}` : text;
}

const pct = (share: number, digits = 1) => `${(share * 100).toFixed(digits)}%`;

/** A coin's price: whole dollars from $100, cents from $1, four places below (TRX at $0.3316). */
const coinPrice = (usd: number) =>
  `$${usd.toLocaleString("en-US", { maximumFractionDigits: usd >= 100 ? 0 : usd >= 1 ? 2 : 4 })}`;

/** "Oct 30, 2026 00:28 UTC" from the read's YYYY-MM-DDTHH:MMZ. */
function utcText(iso: string): string {
  return `${dayText(iso.slice(0, 10))} ${iso.slice(11, 16)} UTC`;
}

/** A balance's change since a stored day: blank before any, "new" for an address not listed then. */
function changeCell(row: RichListRow, then: number | null): string {
  if (then === null) return `<span class="rl-new">${tr("new")}</span>`;
  const delta = row.balance - then;
  if (Math.abs(delta) < 0.005) return '<span class="dim">0</span>';
  return `<span class="${delta > 0 ? "hd-up" : "hd-down"}">${signedCoins(delta)}</span>`;
}

/** The name cell: the name (a known holder's links to their card), its category and its source. */
function whoCell(chain: RichChain, row: RichListRow): string {
  const category = asCategory(row.category);
  const chip = `<span class="rl-chip rl-c-${category}">${esc(categoryLabel(category))}</span>`;
  if (category === "unlabelled" || !row.entity) return chip;
  const name = row.portfolio
    ? `<a href="${portfolioHref(row.portfolio)}">${esc(row.entity)}</a>`
    : esc(row.entity);
  const url =
    row.evidence_url && /^https?:\/\//.test(row.evidence_url)
      ? row.evidence_url
      : row.evidence === "explorer"
        ? richExplorerHref(chain, row.address)
        : null;
  const label = row.evidence ? esc(richEvidenceLabel(row)) : "";
  const evidence = !label
    ? ""
    : url
      ? ` <a class="rl-ev" href="${esc(url)}" rel="noopener" target="_blank">${label}</a>`
      : ` <span class="rl-ev dim">${label}</span>`;
  return `<span class="rl-name">${name}</span> ${chip}${evidence}`;
}

/** An address shortened for the table, whole in its title and on the clipboard. */
function addressCell(chain: RichChain, address: string): string {
  const short = address.length > 18 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
  return `<a href="${esc(richExplorerHref(chain, address))}" rel="noopener" target="_blank" title="${esc(address)}">${esc(short)}</a><button type="button" class="rl-copy" data-copy="${esc(address)}" data-copied="${esc(tr("Copied"))}" title="${esc(tr("Copy the address"))}" aria-label="${esc(tr("Copy the address"))}">${icon("copy")}<span></span></button>`;
}

/**
 * Each category's share of the listed coins over time, stacked. One day of history draws as a single
 * split bar, since an area needs two; the legend gives the newest day's shares either way.
 */
export function richShareChart(days: readonly RichListCategoryDay[], chain: RichChain): string {
  const byDay = new Map<string, Map<string, number>>();
  for (const d of days) {
    if (!(d.balance > 0)) continue;
    const day = byDay.get(d.day) ?? new Map<string, number>();
    day.set(asCategory(d.category), (day.get(asCategory(d.category)) ?? 0) + d.balance);
    byDay.set(d.day, day);
  }
  const dayKeys = [...byDay.keys()].sort();
  if (!dayKeys.length) return "";
  const present = RICH_CATEGORIES.filter((c) => [...byDay.values()].some((m) => m.has(c)));
  const shares = dayKeys.map((day) => {
    const m = byDay.get(day) as Map<string, number>;
    const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    return present.map((c) => (m.get(c) ?? 0) / total);
  });
  const last = shares[shares.length - 1] as number[];
  const title = tr("What each kind of holder has of the top 500's {coin}", { coin: COIN[chain] });
  const legend = present
    .map(
      (c, i) =>
        `<li class="rl-c-${c}"><i></i>${esc(categoryLabel(c))} <b>${pct(last[i] as number)}</b></li>`,
    )
    .join("");
  let plot: string;
  if (dayKeys.length === 1) {
    const parts = present
      .map((c, i) => {
        const share = last[i] as number;
        return share > 0
          ? `<i class="rl-c-${c}" style="width:${(share * 100).toFixed(2)}%" title="${esc(`${categoryLabel(c)}: ${pct(share)}`)}"></i>`
          : "";
      })
      .join("");
    plot = `<div class="rl-split" role="img" aria-label="${esc(`${title}, ${dayText(dayKeys[0] as string)}`)}">${parts}</div>
<p class="dim rl-split-day">${tr("{day}: the list's history starts here, one point a day from now.", { day: dayText(dayKeys[0] as string) })}</p>`;
  } else {
    const t0 = Date.parse(dayKeys[0] as string);
    const span = Date.parse(dayKeys[dayKeys.length - 1] as string) - t0 || 1;
    const xs = dayKeys.map((d) => ((Date.parse(d) - t0) / span) * 1000);
    const y = (cum: number) => (300 * (1 - cum)).toFixed(1);
    let below = shares.map(() => 0);
    const areas = present
      .map((c, i) => {
        const above = below.map((b, k) => b + ((shares[k] as number[])[i] as number));
        const top = xs
          .map((x, k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y(above[k] as number)}`)
          .join("");
        const bottom = xs
          .map((x, k) => `L${x.toFixed(1)} ${y(below[k] as number)}`)
          .reverse()
          .join("");
        below = above;
        return `<path class="rl-c-${c}" d="${top}${bottom}Z"><title>${esc(`${categoryLabel(c)}: ${pct(last[i] as number)}`)}</title></path>`;
      })
      .join("");
    const grid = [0.25, 0.5, 0.75]
      .map((g) => `<line class="rl-grid" x1="0" x2="1000" y1="${y(g)}" y2="${y(g)}"></line>`)
      .join("");
    const yLabels = [0.5, 1]
      .map(
        (g) => `<span class="rl-y" style="top:${((1 - g) * 100).toFixed(1)}%">${pct(g, 0)}</span>`,
      )
      .join("");
    plot = `<div class="rl-plot"><svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label="${esc(title)}">${areas}${grid}</svg>${yLabels}<span class="rl-x" style="left:0">${dayText(dayKeys[0] as string)}</span><span class="rl-x rl-x-end">${dayText(dayKeys[dayKeys.length - 1] as string)}</span></div>`;
  }
  return `<figure class="rl-chart"><figcaption class="dim">${esc(title)}</figcaption>${plot}<ul class="rl-legend">${legend}</ul></figure>`;
}

/** The note under the list: where the names come from, and the sources. */
const richNote = () =>
  `<p class="notes">${tr(
    "A name is shown only where a published source gives one: the holder's own address in the address book, an exchange's own proof-of-reserves list, a project's own page, or the explorer's name for a contract or an account. Every other address stays unlabelled; we never trace who owns one. A balance is one address's own, so an exchange or a fund that splits its coins over many addresses ranks each one apart.",
  )}</p>
<p class="notes">${tr(
    "Sources: Bitcoin's list from {blockchair}'s daily dump of every address, Ethereum's from {blockscout}, Tron's from {tronscan}; exchanges' wallets from their proof-of-reserves lists and {defillama}'s exchange adapters; prices from DefiLlama.",
    {
      blockchair: '<a href="https://blockchair.com" rel="noopener" target="_blank">Blockchair</a>',
      blockscout:
        '<a href="https://eth.blockscout.com" rel="noopener" target="_blank">Blockscout</a>',
      tronscan: '<a href="https://tronscan.org" rel="noopener" target="_blank">Tronscan</a>',
      defillama: '<a href="https://defillama.com" rel="noopener" target="_blank">DefiLlama</a>',
    },
  )}</p>`;

/** The chain switch: links the hub honours, which RICH_SWAP_SCRIPT turns into an in-place swap. */
function chainSwitch(active: RichChain): string {
  const links = RICH_CHAINS.map(
    (c) =>
      `<a href="${richHref(c)}" data-rl-swap="${c}"${c === active ? ' aria-current="page"' : ""}>${esc(CHAIN_LABEL[c])}</a>`,
  ).join("");
  return `<nav class="seg rl-chains" aria-label="${esc(tr("chain"))}" data-loading="${esc(tr("Loading {asset}…"))}">${links}</nav>`;
}

/** The Rich list topic for one chain. */
export function richListPanel(list: RichList): string {
  const { chain, day } = list;
  const coin = COIN[chain];
  if (!day || !list.rows.length)
    return `<div class="rl-body">${chainSwitch(chain)}<p class="empty">${tr("No list read yet for {chain}: the holdings worker reads it once a day.", { chain: CHAIN_LABEL[chain] })}</p>${richNote()}</div>`;
  const listed = list.rows.reduce((a, r) => a + r.balance, 0);
  const named = list.rows.filter((r) => r.category !== "unlabelled");
  const namedCoins = named.reduce((a, r) => a + r.balance, 0);
  const tile = (label: string, big: string, note: string) =>
    `<div class="cvd-tile"><p class="eyebrow">${label}</p><p class="cvd-big">${big}</p><p class="dim">${note}</p></div>`;
  const tiles = [
    tile(
      tr("Top {n} hold", { n: list.rows.length }),
      `${tileCoins(listed)} <span class="rl-coin">${coin}</span>`,
      day.price_usd
        ? tr("{usd} at {price} a coin", {
            usd: formatUsd(listed * day.price_usd),
            price: coinPrice(day.price_usd),
          })
        : tr("no price read"),
    ),
    day.supply
      ? tile(
          chain === "bitcoin" ? tr("Share of issued bitcoin") : tr("Share of supply"),
          pct(listed / day.supply),
          supplyNote(chain, coins(day.supply)),
        )
      : "",
    tile(
      tr("Named"),
      pct(listed ? namedCoins / listed : 0),
      tr("of the coins, in {n} of {total} addresses; the rest are unlabelled", {
        n: named.length,
        total: list.rows.length,
      }),
    ),
    tile(
      tr("Numbers from"),
      dayText(day.day),
      day.source === "blockchair-dump" && day.as_of
        ? tr("Blockchair's dump of {time}", { time: utcText(day.as_of) })
        : tr("read {time}", { time: utcText(day.as_of ?? day.read_at) }),
    ),
  ].join("");
  const supply = day.supply;
  const has7 = list.back_7d !== null;
  const has30 = list.back_30d !== null;
  const body = list.rows
    .map((r) => {
      const cells = [
        `<td class="num dim">${r.rank}</td>`,
        `<td class="rl-addr">${addressCell(chain, r.address)}</td>`,
        `<td class="rl-who">${whoCell(chain, r)}</td>`,
        `<td class="num">${coins(r.balance)}</td>`,
        `<td class="num">${r.value_usd === null ? '<span class="dim">–</span>' : formatUsd(r.value_usd)}</td>`,
        supply ? `<td class="num rl-sup">${pct(r.balance / supply, 2)}</td>` : "",
        has7 ? `<td class="num">${changeCell(r, r.balance_7d)}</td>` : "",
        has30 ? `<td class="num rl-30">${changeCell(r, r.balance_30d)}</td>` : "",
      ];
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");
  const head = [
    '<th class="num">#</th>',
    `<th>${tr("address")}</th>`,
    `<th>${tr("name")}</th>`,
    `<th class="num">${coin}</th>`,
    `<th class="num">${tr("value")}</th>`,
    supply ? `<th class="num rl-sup">${tr("of supply")}</th>` : "",
    has7 ? `<th class="num">${tr("7 days")}</th>` : "",
    has30 ? `<th class="num rl-30">${tr("30 days")}</th>` : "",
  ].join("");
  const history =
    has7 && has30
      ? ""
      : `<p class="dim rl-hist">${has7 ? tr("The 30-day change shows once the list has a month of history.") : tr("The 7- and 30-day changes show once the list has a week and a month of history.")}</p>`;
  // The worker leaves the beacon chain's deposit contract out of Ethereum's list (collector 059).
  const leftOut =
    chain === "ethereum"
      ? `<p class="dim rl-hist">${tr("The staking deposit contract is left out: every ETH deposited to it since 2020 stays there for good (withdrawals are paid in new ETH), so its balance is no one's holding, and counting it would put the top 500 above the whole supply.")}</p>`
      : "";
  return `<div class="rl-body">${chainSwitch(chain)}
<p class="lede">${tr("The {n} largest {chain} addresses by {coin} held, read once a day, each with a name where a published source gives one.", { n: list.rows.length, chain: CHAIN_LABEL[chain], coin })}</p>
<div class="cvd-tiles rl-tiles">${tiles}</div>
${richShareChart(list.categories, chain)}
<div class="sheet-wrap"><table class="sheet rl-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
${leftOut}${history}${richNote()}</div>`;
}

/** What the supply a share is of means, for each chain's source. */
function supplyNote(chain: RichChain, supply: string): string {
  switch (chain) {
    case "bitcoin":
      return tr("of {supply} BTC issued to date, lost coins included", { supply });
    case "ethereum":
      return tr("of {supply} ETH, Blockscout's total supply", { supply });
    case "tron":
      return tr("of {supply} TRX in circulation, by Tronscan", { supply });
  }
}

/**
 * Swaps the Rich list tab to another chain in place: fetches the chain's `?panel=richlist`, swaps its
 * .rl-body in, keeps the address in the bar, and points the tab's data-lazy at it so tabs.ts reloads
 * the chain the reader chose. While it loads the chart gives way to the loading chart and the tiles
 * and table pulse (.chart-switching); anything that goes wrong loads the link as a page.
 */
export const RICH_SWAP_SCRIPT = `(() => {
  const panel = document.getElementById("panel-holdings-richlist");
  if (!panel || !window.fetch || !window.DOMParser || !history.replaceState) return;
  let busy = false;
  ${CHART_SKELETON_JS}
  const panelUrl = (href) => {
    const url = new URL(href, location.href);
    const chain = url.searchParams.get("chain");
    return "/holdings?panel=richlist" + (chain ? "&chain=" + encodeURIComponent(chain) : "");
  };
  const load = async (link) => {
    busy = true;
    for (const a of panel.querySelectorAll("a[data-rl-swap]")) a.removeAttribute("aria-current");
    link.setAttribute("aria-current", "page");
    const nav = link.closest("[data-loading]");
    const label = ((nav && nav.dataset.loading) || "").replace("{asset}", link.textContent || "");
    const chart = panel.querySelector(".rl-chart");
    if (chart) skeletonInto(chart, label);
    panel.classList.add("chart-switching");
    panel.setAttribute("aria-busy", "true");
    try {
      const url = panelUrl(link.href);
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const body = new DOMParser().parseFromString(await res.text(), "text/html").querySelector(".rl-body");
      if (!body) throw new Error("no panel");
      history.replaceState(null, "", link.href);
      panel.replaceChildren(document.importNode(body, true));
      panel.setAttribute("data-lazy", url);
      panel.dataset.lazyState = "loaded";
      panel.dataset.loadedAt = String(Date.now());
    } catch (_) {
      location.href = link.href;
      return;
    }
    panel.classList.remove("chart-switching");
    panel.removeAttribute("aria-busy");
    busy = false;
  };
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || !event.target.closest) return;
    const link = event.target.closest("a[data-rl-swap]");
    if (!link || !panel.contains(link) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!busy && link.getAttribute("aria-current") !== "page") load(link);
  });
})();`;

/** The topic's styles, theme variables only; each category's colour is --rl on its element. */
export const RICH_LIST_CSS = `.rl-c-exchange{--rl:var(--long)}.rl-c-fund{--rl:var(--warn)}.rl-c-government{--rl:var(--short)}
.rl-c-bridge{--rl:var(--cyan)}.rl-c-staking{--rl:var(--accent)}.rl-c-contract{--rl:var(--orange)}
.rl-c-holder{--rl:var(--em)}.rl-c-other{--rl:var(--muted)}.rl-c-unlabelled{--rl:var(--dim)}
.seg.rl-chains{width:max-content;max-width:100%;flex-wrap:wrap;margin:0 0 12px}
.rl-coin{font-size:.55em;color:var(--muted)}
.rl-chart{margin:0 0 12px;padding:10px;border:1px solid var(--rule);background:var(--panel)}
.rl-plot{position:relative;height:200px;margin:10px 0 24px}
.rl-plot svg{position:absolute;inset:0;width:100%;height:100%}
.rl-plot path{fill:var(--rl);fill-opacity:.8;stroke:none}
.rl-grid{stroke:var(--rule);stroke-width:1;vector-effect:non-scaling-stroke}
.rl-y{position:absolute;left:4px;transform:translateY(-50%);font-size:11px;color:var(--ink);pointer-events:none}
.rl-y:first-of-type{transform:translateY(-50%)}
.rl-x{position:absolute;top:100%;left:0;padding-top:4px;font-size:11px;color:var(--dim);white-space:nowrap}
.rl-x-end{left:auto;right:0}
.rl-split{display:flex;height:24px;margin:10px 0 6px;border:1px solid var(--rule);background:var(--band)}
.rl-split i{display:block;height:100%;background:var(--rl);min-width:1px}
.rl-split-day{margin:0 0 8px;font-size:11px}
.rl-legend{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px}
.rl-legend li{display:inline-flex;align-items:center;gap:6px;color:var(--muted);white-space:nowrap}
.rl-legend i{display:inline-block;width:10px;height:10px;background:var(--rl)}
.rl-legend b{color:var(--ink);font-weight:700}
.rl-table td{vertical-align:middle}
.rl-addr{white-space:nowrap;font-family:var(--mono)}
.rl-copy{position:relative;margin-left:4px;padding:0 2px;background:none;border:0;color:var(--muted);cursor:pointer;font:11px var(--mono);vertical-align:middle}
.rl-copy:hover{color:var(--accent)}
.rl-copy span:not(:empty){position:absolute;left:100%;top:0;padding:0 4px;background:var(--band);color:var(--accent);white-space:nowrap}
.rl-who{min-width:18ch}
.rl-name{color:var(--ink)}
.rl-chip{display:inline-block;padding:0 5px;font-size:11px;line-height:1.5;border:1px solid var(--rl);color:var(--rl);white-space:nowrap}
.rl-ev{font-size:11px;white-space:nowrap}
.rl-new{color:var(--accent)}
.rl-hist{margin:8px 0 0;font-size:12px}
@media (max-width:560px){.rl-sup,.rl-30{display:none}}`;
