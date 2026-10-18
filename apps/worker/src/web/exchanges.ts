import { VENUES } from "@ai-rates/venues";
import type { BookQualityData, ExchangeReserveRow, ExchangeSummary, Overview } from "../app/data";
import {
  BOOK_BASKET,
  type Grade,
  PILLAR_WEIGHTS,
  PILLARS,
  type Pillar,
  reservesById,
  takerFee,
  UNFILLED_PENALTY_BPS,
  type VenueQuality,
  type VenueReserves,
  venueQualities,
} from "./exchange-grade";
import { esc, formatUsd, since } from "./format";
import { helpButton, helpPanel } from "./help";
import { tr, trMsg } from "./i18n";
import { layout } from "./layout";
import { MONTHS } from "./slot-chart";
import { VENUE_TYPE_SHORT } from "./venues";

/**
 * The Exchanges page: every collected perpetual venue, graded on its reserves, what trading there
 * costs, its activity and the depth of its books, with the open interest and volume it reports. The
 * figures and the grade are exchange-grade.ts's; this file lays them out.
 *
 * Laid out after DefiLlama's exchanges table and REAL ranking (2026-10-17) -- grade, cost to trade
 * $10k, slippage at $10k and $100k, each grade opening its four pillars -- from this site's own
 * measurements of each venue's public book and DefiLlama's reserves. Their markouts and effective
 * spreads need tick data we do not record, so those columns are not here.
 */

export const EXCHANGE_SORTS = [
  "grade",
  "reserves",
  "cost",
  "slippage",
  "depth",
  "oi",
  "volume",
  "markets",
] as const;
export type ExchangeSort = (typeof EXCHANGE_SORTS)[number];

export const parseExchangeSort = (value: string | null): ExchangeSort =>
  (EXCHANGE_SORTS as readonly string[]).includes(value ?? "") ? (value as ExchangeSort) : "grade";

const exchangeHref = (venueId: string) => `/markets/exchange/${encodeURIComponent(venueId)}`;

const usd2 = (v: number) =>
  v >= 1000
    ? formatUsd(v)
    : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dash = `<span class="dim">–</span>`;

const dayLabel = (d: Date) =>
  tr("{month} {day}", { month: trMsg(MONTHS[d.getUTCMonth()] as string), day: d.getUTCDate() });

const GRADE_WORDS: Record<Grade, string> = { S: "S", A: "A", B: "B", C: "C", D: "D" };

const pillarName = (p: Pillar) =>
  p === "reserves"
    ? tr("Reserves")
    : p === "execution"
      ? tr("Execution")
      : p === "activity"
        ? tr("Activity")
        : tr("Liquidity");

/** The line under a pillar's bar: what it was built from, for this venue. */
function pillarWhy(q: VenueQuality, p: Pillar): string {
  switch (p) {
    case "reserves": {
      const r = q.reserves;
      if (q.pillars.reserves === null) return tr("not measured");
      if (!r)
        return q.type === "cex"
          ? tr("no wallets published")
          : tr("collateral not identified: the DEXes' median");
      return r.kind === "wallets"
        ? tr("{clean} clean of {total} in tracked wallets", {
            clean: formatUsd(r.cleanUsd),
            total: formatUsd(r.totalUsd),
          })
        : tr("{usd} protocol collateral", { usd: formatUsd(r.cleanUsd) });
    }
    case "execution":
      return tr("{cost} to trade $10k, {slip} slippage at $100k", {
        cost: usd2(q.cost10kUsd),
        slip: usd2(q.slip100kUsd),
      });
    case "activity":
      if (q.openInterestUsd <= 0)
        return tr("{volume} volume; no open interest published", {
          volume: formatUsd(q.volumeUsd),
        });
      return tr("{oi} open interest, {volume} volume", {
        oi: formatUsd(q.openInterestUsd),
        volume: formatUsd(q.volumeUsd),
      });
    default:
      return tr("{usd} credited within 0.1%; {n} of {total} markets hold $100k", {
        usd: formatUsd(q.depthCreditedUsd),
        n: q.broad,
        total: BOOK_BASKET.length,
      });
  }
}

/** The grade's breakdown: the badge and score, its place, each pillar's bar, and how it is built. */
function card(q: VenueQuality, withMethodLink: boolean): string {
  const place = { rank: q.rank, of: q.of };
  const kind =
    q.type === "cex" ? tr("#{rank} of {of} CEXs", place) : tr("#{rank} of {of} DEXs", place);
  const bars = PILLARS.map((p) => {
    const v = q.pillars[p];
    return `<li><span class="xg-pn">${pillarName(p)} <i>${PILLAR_WEIGHTS[p]}%</i></span><span class="xg-bar"><b style="width:${v === null ? 0 : Math.round(v)}%"></b></span><span class="xg-pv">${v === null ? tr("n/a") : Math.round(v)}</span><span class="xg-why">${pillarWhy(q, p)}</span></li>`;
  }).join("");
  return `<p class="xg-top"><span class="xg xg-${q.grade}">${GRADE_WORDS[q.grade]}</span><b>${q.score.toFixed(1)}</b><span class="dim">/ 100</span><span class="xg-rank">${kind}</span></p>
<ul class="xg-bars">${bars}</ul>
<p class="xg-note">${tr("Built from this site's own reading of the order books and DefiLlama's reserves. n/a never counts as zero; its weight goes to the others. S from 85, A 70, B 55, C 40, else D.")}${
    withMethodLink ? ` <a href="/markets#grade-method">${tr("How the grade is built")}</a>` : ""
  }</p>`;
}

/** The grade in the table: a badge that opens its breakdown (the panel is outside the live rows). */
function gradeButton(q: VenueQuality): string {
  const target = `xg-${q.id}`;
  return `<button type="button" class="xg xg-${q.grade}" popovertarget="${esc(target)}" style="anchor-name:--${esc(target)}" aria-label="${esc(tr("Grade {grade}, score {score}: the breakdown", { grade: q.grade, score: Math.round(q.score) }))}" data-help data-help-float>${GRADE_WORDS[q.grade]}</button>`;
}

function gradePanel(q: VenueQuality, name: string): string {
  const target = `xg-${q.id}`;
  return `<div class="help-pop xg-pop" id="${esc(target)}" popover style="position-anchor:--${esc(target)}"><p class="help-head">${esc(name)}</p>${card(q, true)}</div>`;
}

function reservesCell(r: VenueReserves | undefined): string {
  if (!r) return `<td class="num">${dash}</td>`;
  const sub =
    r.kind === "wallets"
      ? tr("clean, of {total} in wallets", { total: formatUsd(r.totalUsd) })
      : tr("collateral");
  return `<td class="num"><b>${formatUsd(r.cleanUsd)}</b><span class="xc-sub">${sub}</span></td>`;
}

interface Row {
  s: ExchangeSummary;
  q: VenueQuality | null;
  r: VenueReserves | undefined;
}

function sortRows(rows: Row[], sort: ExchangeSort): Row[] {
  const measuredFirst = (key: (q: VenueQuality) => number, asc: boolean) =>
    [...rows].sort((a, b) => {
      if (a.q && !b.q) return -1;
      if (!a.q && b.q) return 1;
      if (a.q && b.q) return asc ? key(a.q) - key(b.q) : key(b.q) - key(a.q);
      return b.s.open_interest_usd - a.s.open_interest_usd;
    });
  switch (sort) {
    case "reserves":
      return [...rows].sort(
        (a, b) =>
          (b.r?.cleanUsd ?? -1) - (a.r?.cleanUsd ?? -1) ||
          b.s.open_interest_usd - a.s.open_interest_usd,
      );
    case "cost":
      return measuredFirst((q) => q.cost10kUsd, true);
    case "slippage":
      return measuredFirst((q) => q.slip100kUsd, true);
    case "depth":
      return measuredFirst((q) => q.depthNearUsd, false);
    case "oi":
      return [...rows].sort((a, b) => b.s.open_interest_usd - a.s.open_interest_usd);
    case "volume":
      return [...rows].sort((a, b) => b.s.volume_24h_usd - a.s.volume_24h_usd);
    case "markets":
      return [...rows].sort((a, b) => b.s.markets - a.s.markets);
    default:
      return measuredFirst((q) => q.score, false);
  }
}

/**
 * The tag on a quarantined exchange's row: its numbers are shown but not ranked by default, and the
 * tag's title is the dated evidence (packages/venues `quarantined`).
 */
function quarantineBadge(venueId: string): string {
  const quarantined = VENUES.find((v) => v.id === venueId)?.quarantined;
  if (!quarantined) return "";
  const evidence = quarantined.replace(/^\d{4}-\d{2}-\d{2}:\s*/, "");
  return ` <abbr class="xc-q" title="${esc(tr("Quarantined: left out of the default rankings. {evidence}", { evidence }))}">${tr("Quarantined")}</abbr>`;
}

function th(sort: ExchangeSort, active: ExchangeSort, label: string, title: string): string {
  const href = sort === "grade" ? "/markets" : `/markets?sort=${sort}`;
  return `<th class="num" title="${esc(title)}"${active === sort ? ' aria-sort="descending"' : ""}><a href="${href}">${label}</a></th>`;
}

/** How the grade is built, under the table: DefiLlama's four pillars as this site measures them. */
function method(): string {
  const pillar = (letter: string, name: string, weight: number, text: string) =>
    `<div class="xg-pillar"><h3><span class="xg-letter">${letter}</span>${name}<i>${tr("{n} points", { n: weight })}</i></h3><p>${text}</p></div>`;
  return `<section class="xg-method" id="grade-method">
<h2 class="cvd-h2">${tr("How the grade is built")}</h2>
<p class="lede">${tr("After DefiLlama's REAL score: a weighted mean of four pillars, each 0 to 100. Sizes are on a log scale, so an exchange a tenth the size of the leader still scores about 70. A pillar this site cannot measure for an exchange hands its weight to the others and never counts as zero. CEXes and DEXes are scored together and ranked within their own kind. Fixed bands, so a new exchange does not reshuffle the rest: S from 85, A from 70, B from 55, C from 40, D below.")}</p>
<div class="xg-pillars">
${pillar("R", tr("Reserves"), PILLAR_WEIGHTS.reserves, tr("What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain, without its own token; a DEX's protocol collateral, a floor, since market makers' money can sit elsewhere. Two thirds is size against the largest; one third is whether its open interest, a day's volume and the book it shows within 1% are sizes it could back, and how much of it is its own token. A CEX publishing no wallets scores 0; a DEX whose collateral is not identified scores the DEXes' median."))}
${pillar("E", tr("Execution"), PILLAR_WEIGHTS.execution, tr("What a market order costs, from each exchange's book every ten minutes over seven days: $10k all in (the published standard taker fee and the walk through the book), and what $10k and $100k pay beyond the mid, each against the cheapest exchange. DefiLlama also scores markouts and fills against the quote; those need trades, which this site does not record, so their weight goes to cost and slippage."))}
${pillar("A", tr("Activity"), PILLAR_WEIGHTS.activity, tr("Open interest, credited up to three times clean reserves, and a day's volume, credited up to five times open interest, each against the leader. An exchange that publishes no open interest is scored on volume alone, credited up to three times clean reserves."))}
${pillar("L", tr("Liquidity"), PILLAR_WEIGHTS.liquidity, tr("Depth within 0.1% of the mid across the twelve majors, credited up to a tenth of each market's open interest, 2% of the exchange's daily volume and 5% of its clean reserves; and breadth, how many of the twelve hold $100k within 0.1%. Halved for a CEX publishing no reserves."))}
</div>
<p class="notes">${tr("These are this site's grades by DefiLlama's method, not DefiLlama's scores. What exchanges report about themselves counts only as far as it can be checked: open interest up to three times reserves, volume up to five times open interest. Reputation, age, brand and listings count not at all.")}</p>
</section>`;
}

export function exchangesPage(data: {
  overview: Overview;
  exchanges: ExchangeSummary[];
  quality: BookQualityData | null;
  reserves: ExchangeReserveRow[] | null;
  sort: ExchangeSort;
  now: number;
}): string {
  const { overview, exchanges, quality, reserves, sort, now } = data;
  const qualities = quality ? venueQualities(quality, exchanges, reserves) : [];
  const byId = new Map(qualities.map((q) => [q.id, q]));
  const held = reserves ? reservesById(reserves) : new Map<string, VenueReserves>();
  const rows = sortRows(
    exchanges.map((s) => ({ s, q: byId.get(s.id) ?? null, r: held.get(s.id) })),
    sort,
  );

  const body = rows
    .map(({ s, q, r }, i) => {
      const cost = q
        ? `<td class="num"><b>${usd2(q.cost10kUsd)}</b><span class="xc-sub">${tr(
            "fee {fee}{mark}",
            {
              fee: usd2(q.feeBps),
              mark: q.feeVerified ? "" : "*",
            },
          )}</span></td>`
        : `<td class="num">${dash}</td>`;
      const slip = q
        ? `<td class="num xc-slip"><span><i>${tr("$10k")}</i> ${usd2(q.slip10kUsd)}</span><span><i>${tr("$100k")}</i> ${usd2(q.slip100kUsd)}${
            q.unfilled
              ? ` <abbr class="xc-warn" title="${esc(tr("$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp", { n: q.unfilled, bps: UNFILLED_PENALTY_BPS }))}">!</abbr>`
              : ""
          }</span></td>`
        : `<td class="num">${dash}</td>`;
      const credited =
        q && q.depthCreditedUsd < q.depthNearUsd * 0.98
          ? ` <abbr class="xc-warn" title="${esc(tr("The grade credits {usd} of it: depth beyond a tenth of a market's open interest, 2% of the exchange's daily volume or 5% of its clean reserves is not counted", { usd: formatUsd(q.depthCreditedUsd) }))}">!</abbr>`
          : "";
      const depth = q
        ? `<td class="num xc-slip"><span><i>±0.1%</i> ${formatUsd(q.depthNearUsd)}${credited}</span><span><i>±1%</i> ${formatUsd(q.depthUsd)}</span>${
            q.assets < BOOK_BASKET.length
              ? `<span class="xc-sub">${tr("{n} of {total} assets", { n: q.assets, total: BOOK_BASKET.length })}</span>`
              : ""
          }</td>`
        : `<td class="num">${dash}</td>`;
      return `<tr data-k="${esc(s.id)}">
<td class="num dim">${i + 1}</td>
<td class="xc-grade">${q ? `${gradeButton(q)}<span class="xc-score">${Math.round(q.score)}</span>` : `<span class="xg xg-none" title="${esc(tr("Not measured: its order book is not read yet"))}">–</span>`}</td>
<td><a href="${exchangeHref(s.id)}">${esc(s.name)}</a> <span class="xc-type">${VENUE_TYPE_SHORT[s.type] ?? esc(s.type)}</span>${quarantineBadge(s.id)}</td>
${reservesCell(r)}
${cost}
${slip}
<td class="num">${q ? tr("{n} bp", { n: q.spreadBps.toFixed(2) }) : dash}</td>
${depth}
<td class="num">${s.open_interest_usd > 0 ? formatUsd(s.open_interest_usd) : dash}</td>
<td class="num">${formatUsd(s.volume_24h_usd)}</td>
<td class="num">${s.markets.toLocaleString("en-US")}</td>
<td class="num dim">${since(s.updated_at, now)}</td>
</tr>`;
    })
    .join("");

  const totalOi = exchanges.reduce((sum, e) => sum + e.open_interest_usd, 0);
  const totalVol = exchanges.reduce((sum, e) => sum + e.volume_24h_usd, 0);
  const cheapest = [...qualities].sort((a, b) => a.cost10kUsd - b.cost10kUsd)[0];
  const deepest = [...qualities].sort((a, b) => b.depthCreditedUsd - a.depthCreditedUsd)[0];
  const oldest = qualities.length
    ? new Date(Math.min(...qualities.map((q) => q.since.getTime())))
    : null;
  const venueName = (id: string) => esc(VENUES.find((v) => v.id === id)?.name ?? id);
  const tiles = `<div class="cvd-tiles xc-tiles" data-live="exchange-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Open interest")}</p><p class="cvd-big">${formatUsd(totalOi)}</p><p class="dim">${tr("across {n} exchanges reporting now", { n: exchanges.length })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("24h volume")}</p><p class="cvd-big">${formatUsd(totalVol)}</p><p class="dim">${tr("as each exchange reports it")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Cheapest $10k")}</p><p class="cvd-big">${cheapest ? usd2(cheapest.cost10kUsd) : "–"}</p><p class="dim">${cheapest ? tr("{venue}: taker fee and slippage, the basket's mix", { venue: venueName(cheapest.id) }) : tr("no book measured yet")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Deepest books")}</p><p class="cvd-big">${deepest ? formatUsd(deepest.depthCreditedUsd) : "–"}</p><p class="dim">${deepest ? tr("{venue}: credited within 0.1% of the mid, 12 majors", { venue: venueName(deepest.id) }) : tr("no book measured yet")}</p></div>
</div>`;

  const live = new Set(exchanges.map((e) => e.id));
  const notCollected = VENUES.filter((v) => !live.has(v.id) && !v.aliasOf && !v.retired).map(
    (v) => v.name,
  );
  const quarantined = VENUES.filter((v) => v.quarantined && live.has(v.id)).map((v) => esc(v.name));
  const unverified = qualities.filter((q) => !q.feeVerified).map((q) => venueName(q.id));
  const names = new Map(exchanges.map((e) => [e.id, e.name]));

  const table =
    exchanges.length === 0
      ? `<div class="sheet-wrap"><p class="empty">${tr("No exchange has reported in the last five minutes.")}</p></div>`
      : `<div class="sheet-wrap"><table class="sheet xc-table"><thead><tr>
<th class="num">#</th>
${th("grade", sort, tr("Grade"), tr("This site's grade after DefiLlama's REAL score: reserves, execution, activity and liquidity. A grade opens its breakdown"))}
<th>${tr("Exchange")}</th>
${th("reserves", sort, tr("Reserves"), tr("What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain without its own token, a DEX's protocol collateral"))}
${th("cost", sort, tr("Cost to trade $10k"), tr("A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid"))}
${th("slippage", sort, tr("Slippage"), tr("What a $10k and a $100k market order pay beyond the mid, from the book, before fees"))}
<th class="num" title="${esc(tr("The gap between the best bid and ask, basis points of the mid"))}">${tr("Spread")}</th>
${th("depth", sort, tr("Depth"), tr("Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them"))}
${th("oi", sort, tr("Open interest"), tr("Summed over the exchange's perpetual markets, as it reports them"))}
${th("volume", sort, tr("24h volume"), tr("Summed over the exchange's perpetual markets, as it reports them"))}
${th("markets", sort, tr("Markets"), tr("Live perpetual markets"))}
<th class="num">${tr("Updated")}</th>
</tr></thead><tbody data-live="exchanges">${body}</tbody></table></div>
<div class="xg-cards">${qualities.map((q) => gradePanel(q, names.get(q.id) ?? q.id)).join("")}</div>`;

  const help = helpPanel(
    "exchanges",
    [
      tr(
        "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.",
      ),
      tr(
        "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.",
      ),
      tr(
        "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that.",
      ),
      tr(
        "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade follows DefiLlama's REAL score: reserves 30, execution 30, activity 20, liquidity 20. A grade opens its breakdown; how each pillar is built is under the table.",
      ),
    ]
      .map((p) => `<p>${p}</p>`)
      .join(""),
  );

  return layout({
    title: tr("Exchanges"),
    description: tr(
      "Every perpetual futures exchange tracked by airrates, graded on reserves, trading cost, activity and liquidity: taker fee and slippage at $10k and $100k, depth, open interest and volume.",
    ),
    path: "/markets",
    overview,
    now,
    body: `<div class="lq-controls mc-head"><h1>${tr("Exchanges")}</h1>${helpButton("exchanges")}</div>
${help}
${tiles}
${table}
<p class="notes">${[
      oldest
        ? tr("Order books measured since {date}; figures are the medians of the last seven days.", {
            date: dayLabel(oldest),
          })
        : tr("Order books are not measured yet."),
      reserves
        ? tr("Reserves: DefiLlama, read every six hours.")
        : tr("Reserves are not available right now; the grade goes on without them."),
      unverified.length
        ? tr(
            "* No published taker fee found for {venues}: the site's default of {bps} bp is used.",
            {
              venues: unverified.join(", "),
              bps: takerFee("").bps,
            },
          )
        : "",
      quarantined.length
        ? tr(
            "Quarantined: {venues}. Their numbers failed the venue review's checks (funding copied from another exchange, or volume and open interest far beyond what their reserves could back), so they are still collected and shown here but left out of the default Screener and Arbitrage rankings; tick them in the exchange picker to rank them.",
            { venues: quarantined.join(", ") },
          )
        : "",
      tr("Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.", {
        venues: esc(notCollected.join(", ")),
      }),
    ]
      .filter(Boolean)
      .join(" ")}</p>
${qualities.length ? method() : ""}`,
  });
}

/**
 * One exchange's grade and trading costs for its own page: the grade's breakdown, its figures, and each
 * basket asset's book on its own. Empty where the exchange's book is not measured.
 */
export function exchangeCosts(
  venueId: string,
  quality: BookQualityData | null,
  summaries: readonly ExchangeSummary[],
  reserves: readonly ExchangeReserveRow[] | null = null,
): string {
  if (!quality) return "";
  const q = venueQualities(quality, summaries, reserves).find((v) => v.id === venueId);
  const rows = quality.rows.filter((r) => r.venue_id === venueId);
  if (!q || rows.length === 0) return "";
  const bp = (v: number | null) => (v === null ? dash : tr("{n} bp", { n: v.toFixed(2) }));
  const body = BOOK_BASKET.map((base) => {
    const r = rows.find((x) => x.base === base);
    if (!r)
      return `<tr><td>${esc(base)}</td><td class="num" colspan="7"><span class="dim">${tr("not listed")}</span></td></tr>`;
    const big =
      r.slip_100k_bps === null || r.unfilled_100k > 0.5
        ? `<span class="xc-warn" title="${esc(tr("$100k did not fill in most snapshots"))}">${tr("did not fill")}</span>`
        : usd2(10 * r.slip_100k_bps);
    return `<tr><td>${esc(base)}</td><td class="num">${bp(r.spread_bps)}</td><td class="num">${r.slip_10k_bps === null ? dash : usd2(r.slip_10k_bps)}</td><td class="num">${big}</td><td class="num">${formatUsd(r.depth_near_usd)}</td><td class="num">${formatUsd(r.depth_usd)}</td><td class="num dim">${tr("{pct}%", { pct: r.reach_pct.toFixed(2) })}</td><td class="num dim">${r.samples}</td></tr>`;
  }).join("");
  return `<h2 class="cvd-h2 wm-h2">${tr("Grade")}</h2>
<div class="xg-card">${card(q, true)}</div>
<h2 class="cvd-h2 wm-h2">${tr("Trading cost")}</h2>
<div class="facts"><span>${tr("{value} to trade $10k", { value: `<b>${usd2(q.cost10kUsd)}</b>` })}</span><span>${tr("taker fee {fee}{mark}", { fee: usd2(q.feeBps), mark: q.feeVerified ? "" : "*" })}</span><span>${tr("{value} slippage at $100k", { value: `<b>${usd2(q.slip100kUsd)}</b>` })}</span><span>${tr("{value} within 0.1%", { value: `<b>${formatUsd(q.depthNearUsd)}</b>` })}</span></div>
<div class="sheet-wrap"><table class="sheet xc-table"><thead><tr><th>${tr("Asset")}</th><th class="num">${tr("Spread")}</th><th class="num" title="${esc(tr("What a $10k market order pays beyond the mid, before fees"))}">${tr("$10k slippage")}</th><th class="num" title="${esc(tr("What a $100k market order pays beyond the mid, before fees"))}">${tr("$100k slippage")}</th><th class="num">${tr("Depth ±0.1%")}</th><th class="num">${tr("Depth ±1%")}</th><th class="num" title="${esc(tr("How far from the mid the published book reached"))}">${tr("Book reach")}</th><th class="num" title="${esc(tr("Snapshots in the last seven days"))}">${tr("Samples")}</th></tr></thead><tbody>${body}</tbody></table></div>
<p class="notes">${tr("Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. Reserves are DefiLlama's.", { venue: esc(VENUES.find((v) => v.id === venueId)?.name ?? venueId) })}</p>`;
}
