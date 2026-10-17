import { VENUES } from "@ai-rates/venues";
import type { BookQualityData, ExchangeSummary, Overview } from "../app/data";
import {
  BOOK_BASKET,
  type Grade,
  takerFee,
  UNFILLED_PENALTY_BPS,
  type VenueQuality,
  venueQualities,
} from "./exchange-grade";
import { esc, formatUsd, since } from "./format";
import { helpButton, helpPanel } from "./help";
import { tr, trMsg } from "./i18n";
import { layout } from "./layout";
import { MONTHS } from "./slot-chart";
import { VENUE_TYPE_SHORT } from "./venues";

/**
 * The Exchanges page: every collected perpetual venue, ranked by what trading there costs and how
 * deep its books are, with the open interest and volume it reports. The figures and the grade are
 * exchange-grade.ts's; this file lays them out.
 *
 * Laid out after DefiLlama's exchanges table (2026-10-17) -- grade, cost to trade $10k, slippage at
 * $10k and $100k -- from this site's own measurements of each venue's public book. Their markouts and
 * effective spreads need tick data we do not record, so those columns are not here.
 */

export const EXCHANGE_SORTS = [
  "grade",
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

/** The grade as a badge, its score and pillars in the tooltip. */
function badge(q: VenueQuality): string {
  const title = tr(
    "score {score}: execution {execution}, liquidity {liquidity}, activity {activity}",
    {
      score: Math.round(q.score),
      execution: Math.round(q.execution),
      liquidity: Math.round(q.liquidity),
      activity: Math.round(q.activity),
    },
  );
  return `<span class="xg xg-${q.grade}" title="${esc(title)}">${GRADE_WORDS[q.grade]}</span>`;
}

interface Row {
  s: ExchangeSummary;
  q: VenueQuality | null;
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

function th(sort: ExchangeSort, active: ExchangeSort, label: string, title: string): string {
  const href = sort === "grade" ? "/markets" : `/markets?sort=${sort}`;
  return `<th class="num" title="${esc(title)}"${active === sort ? ' aria-sort="descending"' : ""}><a href="${href}">${label}</a></th>`;
}

export function exchangesPage(data: {
  overview: Overview;
  exchanges: ExchangeSummary[];
  quality: BookQualityData | null;
  sort: ExchangeSort;
  now: number;
}): string {
  const { overview, exchanges, quality, sort, now } = data;
  const qualities = quality ? venueQualities(quality, exchanges) : [];
  const byId = new Map(qualities.map((q) => [q.id, q]));
  const rows = sortRows(
    exchanges.map((s) => ({ s, q: byId.get(s.id) ?? null })),
    sort,
  );

  const body = rows
    .map(({ s, q }, i) => {
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
          ? ` <abbr class="xc-warn" title="${esc(tr("The grade credits {usd} of it: depth beyond a tenth of a market's open interest, or 2% of the exchange's daily volume, is not counted", { usd: formatUsd(q.depthCreditedUsd) }))}">!</abbr>`
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
<td class="xc-grade">${q ? badge(q) : `<span class="xg xg-none" title="${esc(tr("Not measured: its order book is not read yet"))}">–</span>`}</td>
<td><a href="${exchangeHref(s.id)}">${esc(s.name)}</a> <span class="xc-type">${VENUE_TYPE_SHORT[s.type] ?? esc(s.type)}</span></td>
${cost}
${slip}
<td class="num">${q ? tr("{n} bp", { n: q.spreadBps.toFixed(2) }) : dash}</td>
${depth}
<td class="num">${formatUsd(s.open_interest_usd)}</td>
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
  const unverified = qualities.filter((q) => !q.feeVerified).map((q) => venueName(q.id));

  const table =
    exchanges.length === 0
      ? `<div class="sheet-wrap"><p class="empty">${tr("No exchange has reported in the last five minutes.")}</p></div>`
      : `<div class="sheet-wrap"><table class="sheet xc-table"><thead><tr>
<th class="num">#</th>
${th("grade", sort, tr("Grade"), tr("This site's grade from its own measurements: S, A, B, C, D"))}
<th>${tr("Exchange")}</th>
${th("cost", sort, tr("Cost to trade $10k"), tr("A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid"))}
${th("slippage", sort, tr("Slippage"), tr("What a $10k and a $100k market order pay beyond the mid, from the book, before fees"))}
<th class="num" title="${esc(tr("The gap between the best bid and ask, basis points of the mid"))}">${tr("Spread")}</th>
${th("depth", sort, tr("Depth"), tr("Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them"))}
${th("oi", sort, tr("Open interest"), tr("Summed over the exchange's perpetual markets, as it reports them"))}
${th("volume", sort, tr("24h volume"), tr("Summed over the exchange's perpetual markets, as it reports them"))}
${th("markets", sort, tr("Markets"), tr("Live perpetual markets"))}
<th class="num">${tr("Updated")}</th>
</tr></thead><tbody data-live="exchanges">${body}</tbody></table></div>`;

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
        "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that, and the grade credits a market's depth up to a tenth of its open interest and an exchange's up to 2% of its daily volume: displayed size beyond that rarely fills.",
      ),
      tr(
        "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade is this site's: half execution (cost and $100k slippage against the cheapest), three tenths liquidity (credited depth within 0.1% against the deepest), a fifth activity (open interest, and volume up to five times it). S from 85, A from 70, B from 55, C from 40, D below.",
      ),
    ]
      .map((p) => `<p>${p}</p>`)
      .join(""),
  );

  return layout({
    title: tr("Exchanges"),
    description: tr(
      "Every perpetual futures exchange tracked by airrates, graded on what trading there costs: taker fee and slippage at $10k and $100k, depth, open interest and volume.",
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
      unverified.length
        ? tr(
            "* No published taker fee found for {venues}: the site's default of {bps} bp is used.",
            {
              venues: unverified.join(", "),
              bps: takerFee("").bps,
            },
          )
        : "",
      tr("Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.", {
        venues: esc(notCollected.join(", ")),
      }),
    ]
      .filter(Boolean)
      .join(" ")}</p>`,
  });
}

/**
 * One exchange's trading costs for its own page: its grade and figures, and each basket asset's book
 * on its own. Empty where the exchange's book is not measured.
 */
export function exchangeCosts(
  venueId: string,
  quality: BookQualityData | null,
  summaries: readonly ExchangeSummary[],
): string {
  if (!quality) return "";
  const q = venueQualities(quality, summaries).find((v) => v.id === venueId);
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
  return `<h2 class="cvd-h2 wm-h2">${tr("Trading cost")} ${badge(q)}</h2>
<div class="facts"><span>${tr("{value} to trade $10k", { value: `<b>${usd2(q.cost10kUsd)}</b>` })}</span><span>${tr("taker fee {fee}{mark}", { fee: usd2(q.feeBps), mark: q.feeVerified ? "" : "*" })}</span><span>${tr("{value} slippage at $100k", { value: `<b>${usd2(q.slip100kUsd)}</b>` })}</span><span>${tr("{value} within 0.1%", { value: `<b>${formatUsd(q.depthNearUsd)}</b>` })}</span></div>
<div class="sheet-wrap"><table class="sheet xc-table"><thead><tr><th>${tr("Asset")}</th><th class="num">${tr("Spread")}</th><th class="num" title="${esc(tr("What a $10k market order pays beyond the mid, before fees"))}">${tr("$10k slippage")}</th><th class="num" title="${esc(tr("What a $100k market order pays beyond the mid, before fees"))}">${tr("$100k slippage")}</th><th class="num">${tr("Depth ±0.1%")}</th><th class="num">${tr("Depth ±1%")}</th><th class="num" title="${esc(tr("How far from the mid the published book reached"))}">${tr("Book reach")}</th><th class="num" title="${esc(tr("Snapshots in the last seven days"))}">${tr("Samples")}</th></tr></thead><tbody>${body}</tbody></table></div>
<p class="notes">${tr("Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. How the grade is built: the Exchanges page.", { venue: esc(VENUES.find((v) => v.id === venueId)?.name ?? venueId) })}</p>`;
}
