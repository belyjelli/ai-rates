import type { AssetClass } from "@ai-rates/core";
import type { Venue } from "@ai-rates/venues";
import type { MarketRow, Overview, PriceHourRow, PriceQuote } from "../app/data";
import {
  CONVERGENCE_WINDOWS,
  type ConvergenceParams,
  type ConvergenceWindow,
  convergenceToQuery,
} from "../app/params";
import { RETAIL_TAKER_BPS, retailSchedule } from "../app/retail-fees";
import {
  breakevenPct,
  holdTime,
  type PriceHour,
  type Scenario,
  type SpreadPoint,
  scenarios,
  spreadSeries,
  spreadStats,
} from "./convergence";
import {
  ageText,
  aprTone,
  esc,
  formatApr,
  formatInterval,
  formatPrice,
  formatUsd,
  since,
} from "./format";
import { timeTicks } from "./funding-chart";
import { helpButton, helpHeading, helpPanel } from "./help";
import { tr } from "./i18n";
import { icon } from "./icons";
import { layout } from "./layout";
import { assetName, exchangeHref, priceHref } from "./pages";
import { PICKER_SCRIPT, venuePicker } from "./venue-picker";
import { VENUE_BY_ID, venueName } from "./venues";

/**
 * One price-convergence pair: long an asset on the exchange where it is cheaper, short it where it is
 * dearer, and close when the two marks meet. Reached from the price page's every-pair table and the
 * arbitrage page's expanded rows (/price-pair/:asset?long=&short=).
 *
 * Everything a reader needs to decide whether the gap is worth taking, in the order they would ask:
 * how wide is it now and how unusual is that; what it would make after fees, the books and funding;
 * how long such a gap has taken to close; and the history behind those answers. Every figure says
 * what it is drawn from, because the honest caveats are most of the value: marks are not fills, the
 * history is hourly averages, and the top of the book is all that is known of depth.
 */

/** Where the exchange's account can be opened, through a public referral link this visitor may see. */
export type TradeLinks = Readonly<Record<string, string | undefined>>;

const pct = (value: number | null, digits = 3) =>
  value === null || !Number.isFinite(value)
    ? "–"
    : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;
const money = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const tone = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : "");

function hoursText(hours: number): string {
  if (hours < 1.5) return tr("~1h");
  if (hours < 48) return tr("~{n}h", { n: Math.round(hours) });
  return tr("~{n} days", { n: (hours / 24).toFixed(1) });
}

/** The quote each leg trades on: the exchange's first market that agrees with the asset's price. */
const quoteFor = (quotes: readonly PriceQuote[], venueId: string) =>
  quotes.find((q) => q.venue_id === venueId && q.mark_agrees);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length === 0
    ? null
    : sorted.length % 2
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/**
 * A small line chart in the funding chart's frame (.fchart in layout.ts): hourly points on a linear
 * scale, dashed reference lines, and a readout that follows the pointer (CONVERGENCE_SCRIPT).
 */
function lineChart(o: {
  title: string;
  help: string;
  series: { label: string; tone: "long" | "short" | "spread"; points: [number, number][] }[];
  refs?: { label: string; value: number }[];
  format: "price" | "pct";
}): string {
  const all = o.series.flatMap((s) => s.points);
  if (all.length < 2) return "";
  const fromMs = Math.min(...all.map((p) => p[0]));
  const toMs = Math.max(...all.map((p) => p[0]));
  const values = [...all.map((p) => p[1]), ...(o.refs ?? []).map((r) => r.value)];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.01 || 1;
  lo -= pad;
  hi += pad;
  const step = (() => {
    const raw = (hi - lo) / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return ([1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw) as number;
  })();
  const x = (ms: number) => ((ms - fromMs) / (toMs - fromMs || 1)) * 1000;
  const y = (v: number) => 1000 - ((v - lo) / (hi - lo)) * 1000;
  const label = (v: number) => (o.format === "price" ? formatPrice(v) : pct(v, 2));
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const grid = ticks
    .map(
      (v) =>
        `<line class="fchart-grid${v === 0 ? " fchart-zero" : ""}" x1="0" x2="1000" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"></line>`,
    )
    .join("");
  const yLabels = ticks
    .map((v) => `<span class="fchart-y" style="top:${(y(v) / 10).toFixed(2)}%">${label(v)}</span>`)
    .join("");
  const xLabels = timeTicks(fromMs, toMs)
    .map(
      ({ ms, label: text }) =>
        `<span class="fchart-x" style="left:${(x(ms) / 10).toFixed(2)}%">${text}</span>`,
    )
    .join("");
  // A gap of more than an hour is drawn as a break, not a line across time with no data.
  const path = (points: [number, number][]) =>
    points
      .map(
        ([ms, v], i) =>
          `${i === 0 || ms - (points[i - 1] as [number, number])[0] > 3_600_000 ? "M" : "L"}${x(ms).toFixed(1)} ${y(v).toFixed(1)}`,
      )
      .join("");
  const lines = o.series
    .map((s) => `<path class="fchart-line ${s.tone}" d="${path(s.points)}"></path>`)
    .join("");
  const refs = (o.refs ?? [])
    .map(
      (r) =>
        `<line class="pc-ref" x1="0" x2="1000" y1="${y(r.value).toFixed(1)}" y2="${y(r.value).toFixed(1)}"></line>`,
    )
    .join("");
  const refLabels = (o.refs ?? [])
    .map(
      (r) =>
        `<span class="pc-ref-label" style="top:${(y(r.value) / 10).toFixed(2)}%">${esc(r.label)} ${label(r.value)}</span>`,
    )
    .join("");
  const keys = o.series
    .map((s) => `<span class="fchart-key"><i class="pc-key-${s.tone}"></i>${esc(s.label)}</span>`)
    .join("");
  const payload = JSON.stringify({
    format: o.format,
    from: fromMs,
    to: toMs,
    series: o.series.map((s) => ({ label: s.label, points: s.points })),
  }).replace(/</g, "\\u003c");
  return `<figure class="fchart pc-chart">
<div class="fchart-head"><div class="has-help"><p class="fchart-title">${o.title}</p>${helpButton(`pc-${o.format}`)}</div><div class="fchart-keys">${keys}</div></div>
${helpPanel(`pc-${o.format}`, `<p>${o.help}</p>`)}
<div class="fchart-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(o.title)}">${grid}${refs}${lines}<line class="fchart-cursor off" x1="0" x2="0" y1="0" y2="1000"></line></svg>${yLabels}${refLabels}${xLabels}</div>
<p class="fchart-read">${tr("Hover the chart to read every line at one hour.")}</p>
<script type="application/json" class="pc-data">${payload}</script>
</figure>`;
}

/**
 * The charts' pointer readout and the form's pick-and-go: a leg, the size or the window applies as
 * soon as it changes. Formats a price the way formatPrice does (significant figures by magnitude).
 */
export const CONVERGENCE_SCRIPT = `(() => {
  const form = document.querySelector("form[data-pc]");
  if (form) form.addEventListener("change", (e) => {
    if (e.target.matches("[data-vp-preset-name]")) return;
    if (form.requestSubmit) form.requestSubmit(); else form.submit();
  });
  const price = (v) => {
    const a = Math.abs(v), d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
    return "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const pct = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(3) + "%";
  for (const chart of document.querySelectorAll(".pc-chart")) {
    const data = JSON.parse(chart.querySelector(".pc-data").textContent);
    const plot = chart.querySelector(".fchart-plot");
    const read = chart.querySelector(".fchart-read");
    const cursor = chart.querySelector(".fchart-cursor");
    const idle = read.textContent;
    const fmt = data.format === "price" ? price : pct;
    plot.addEventListener("pointermove", (event) => {
      const rect = plot.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const at = data.from + f * (data.to - data.from);
      cursor.setAttribute("x1", String(f * 1000));
      cursor.setAttribute("x2", String(f * 1000));
      cursor.classList.remove("off");
      const parts = [new Date(Math.floor(at / 3600000) * 3600000).toISOString().slice(5, 13).replace("T", " ") + ":00 UTC"];
      for (const s of data.series) {
        let near = null;
        for (const p of s.points) { if (p[0] <= at) near = p; else break; }
        if (near) parts.push(s.label + " " + fmt(near[1]));
      }
      read.textContent = parts.join(" · ");
    });
    plot.addEventListener("pointerleave", () => { cursor.classList.add("off"); read.textContent = idle; });
  }
})();`;

function tradeButton(side: "long" | "short", venueId: string, links: TradeLinks): string {
  const name = esc(venueName(venueId));
  const url = links[venueId];
  return url
    ? `<a class="btn pc-trade pc-${side}" href="${esc(url)}" rel="sponsored noopener noreferrer" target="_blank">${side === "long" ? tr("Trade long · {venue}", { venue: name }) : tr("Trade short · {venue}", { venue: name })} ${icon("external")}</a>`
    : `<a class="btn pc-trade pc-${side}" href="${exchangeHref(venueId)}">${side === "long" ? tr("Long leg · {venue}", { venue: name }) : tr("Short leg · {venue}", { venue: name })} ${icon("right")}</a>`;
}

function legCard(o: {
  side: "long" | "short";
  quote: PriceQuote;
  market: MarketRow | undefined;
  takerBps: number;
  takerKnown: boolean;
  links: TradeLinks;
  medianMark: number | null;
  now: number;
}): string {
  const { side, quote: q, market: m } = o;
  const venue = VENUE_BY_ID.get(q.venue_id);
  const bookBps = ((q.best_ask - q.best_bid) / q.best_bid) * 10_000;
  const off =
    o.medianMark && q.mark_price ? ((q.mark_price - o.medianMark) / o.medianMark) * 100 : null;
  const row = (label: string, value: string, title = "") =>
    `<div class="pc-row"${title ? ` title="${esc(title)}"` : ""}><span>${label}</span><b>${value}</b></div>`;
  return `<section class="pc-leg pc-${side}">
<p class="pc-leg-head"><span class="pc-side">${side === "long" ? tr("Long") : tr("Short")}</span> <a href="${exchangeHref(q.venue_id)}">${esc(venueName(q.venue_id))}</a> <span class="dim">${esc(venue?.type ?? "")}</span></p>
${row(tr("Mark price"), formatPrice(q.mark_price), tr("Seen {age}", { age: ageText(q.observed_at, o.now) }))}
${row(tr("Best bid / ask"), `${formatPrice(q.best_bid)} / ${formatPrice(q.best_ask)}`, tr("Seen {age}", { age: ageText(q.quotes_at, o.now) }))}
${row(tr("Top of book"), `${formatUsd(q.best_bid_size_usd)} / ${formatUsd(q.best_ask_size_usd)}`, tr("Dollars resting at the best bid and the best ask"))}
${row(tr("Own bid-ask"), `${bookBps.toFixed(1)} bps`)}
${row(tr("Off the market median"), pct(off, 2), tr("This leg's mark against the median mark of every exchange quoting the asset"))}
${row(tr("Ticker"), esc(q.venue_symbol))}
${row(tr("Taker fee"), `${(o.takerBps / 100).toFixed(3)}%${o.takerKnown ? "" : "*"}`, o.takerKnown ? tr("The exchange's published standard taker fee") : tr("Not verified for this exchange: the site's retail assumption of {bps} bps", { bps: RETAIL_TAKER_BPS }))}
${row(tr("Funding APR"), m ? `<span class="${aprTone(m.apr)}">${formatApr(m.apr)}</span> <span class="dim">${formatInterval(m.interval_hours)}</span>` : "–")}
${row(tr("Open interest"), formatUsd(m?.open_interest_usd ?? null))}
${row(tr("24h volume"), formatUsd(m?.volume_24h_usd ?? null))}
${tradeButton(side, q.venue_id, o.links)}
</section>`;
}

export function convergencePage(data: {
  asset: string;
  assetClass: AssetClass;
  quotes: PriceQuote[];
  markets: MarketRow[];
  params: ConvergenceParams;
  /** Hourly prices for the two legs over the window; null when the history could not be read. */
  history: PriceHourRow[] | null;
  links: TradeLinks;
  overview: Overview;
  now: number;
}): string {
  const { asset, assetClass, quotes, markets, params, history, links, now } = data;
  const base = priceHref(asset, assetClass);
  const href = (next: Partial<ConvergenceParams>) =>
    `${base}${convergenceToQuery({ ...params, ...next })}`;
  const agreeing = quotes.filter((q) => q.mark_agrees);
  const venues: Venue[] = [...new Set(agreeing.map((q) => q.venue_id))].map(
    (id) => VENUE_BY_ID.get(id) ?? ({ id, name: id, type: "cex" } as Venue),
  );
  const long = quoteFor(quotes, params.longVenueId);
  const short = quoteFor(quotes, params.shortVenueId);
  const markOf = (id: string) => quoteFor(quotes, id)?.mark_price ?? null;

  const picker = (side: "long" | "short") =>
    `<div class="pc-pick pc-${side}"><span class="pc-side">${side === "long" ? tr("Long") : tr("Short")}</span>${venuePicker(
      {
        label: "",
        venues,
        type: "radio",
        name: side,
        checked: (v) => v.id === (side === "long" ? params.longVenueId : params.shortVenueId),
        meta: (v) => formatPrice(markOf(v.id)),
      },
    )}</div>`;
  const windows = (Object.keys(CONVERGENCE_WINDOWS) as ConvergenceWindow[])
    .map(
      (w) =>
        `<a href="${href({ window: w })}"${w === params.window ? ' aria-current="true"' : ""}>${w.toUpperCase()}</a>`,
    )
    .join("");
  const controls = `<form class="pc-form" method="get" action="${base}" data-pc>
${picker("long")}
<a class="btn ghost pc-swap" href="${href({ longVenueId: params.shortVenueId, shortVenueId: params.longVenueId })}" title="${esc(tr("Swap legs"))}" aria-label="${esc(tr("Swap legs"))}">${icon("swap")}</a>
${picker("short")}
<label class="pc-size">${tr("Size per leg")} $<input type="text" inputmode="decimal" name="size" value="${params.sizeUsd}" pattern="[0-9]+(\\.[0-9]+)?[kKmM]?" aria-label="${esc(tr("Size per leg"))}"></label>
<input type="hidden" name="w" value="${params.window}">
<noscript><button type="submit">${tr("Apply")}</button></noscript>
<nav class="seg seg-links pc-window" aria-label="${esc(tr("Window"))}">${windows}</nav>
</form>`;

  const head = `<p class="eyebrow"><a href="/arbitrage">${tr("Price gaps")}</a> / <a href="${base}">${assetName(asset, assetClass)}</a> / ${tr("pair")}</p>
${helpHeading(
  "h1",
  tr("{asset} · convergence trade", { asset: assetName(asset, assetClass) }),
  "convergence",
  `<p>${tr("Long the exchange where the asset is cheaper, short the one where it is dearer, and close when the two prices meet. Price moves cancel between the legs; what is left is the gap closing, less fees, the books and funding. Marks are the exchanges' own fair prices, not fills, and the history is hourly averages.")}</p>`,
)}
${controls}`;

  if (!long || !short) {
    const missing = [long ? null : params.longVenueId, short ? null : params.shortVenueId]
      .filter(Boolean)
      .map((id) => venueName(id as string))
      .join(", ");
    return layout({
      title: tr("{asset} convergence trade", { asset }),
      description: tr("A price-convergence pair across two exchanges."),
      path: base,
      overview: data.overview,
      now,
      body: `${head}
<p class="lede">${tr("{venues} has no comparable {asset} book right now. Pick another exchange above.", { venues: esc(missing), asset: esc(asset) })}</p>
<script>${PICKER_SCRIPT}</script><script>${CONVERGENCE_SCRIPT}</script>`,
    });
  }

  const longMarket = markets.find(
    (m) => m.venue_id === long.venue_id && m.venue_symbol === long.venue_symbol,
  );
  const shortMarket = markets.find(
    (m) => m.venue_id === short.venue_id && m.venue_symbol === short.venue_symbol,
  );
  const schedule = retailSchedule([long.venue_id, short.venue_id]);
  const takerOf = (id: string) => schedule[id]?.takerBps ?? RETAIL_TAKER_BPS;
  const takerKnown = (id: string) => typeof VENUE_BY_ID.get(id)?.takerBps === "number";

  // History: each leg's hours, the spread between them, and how much of the window they cover.
  const days = CONVERGENCE_WINDOWS[params.window];
  const windowHours = days * 24;
  const legHours = (q: PriceQuote): PriceHour[] =>
    (history ?? [])
      .filter((h) => h.venue_id === q.venue_id && h.venue_symbol === q.venue_symbol)
      .map((h) => ({ hourMs: h.hour.getTime(), price: h.price, samples: h.samples }));
  const longHours = legHours(long);
  const shortHours = legHours(short);
  const series: SpreadPoint[] = spreadSeries(longHours, shortHours);
  const samplesAt = new Map(shortHours.map((h) => [h.hourMs, h.samples]));
  const coverage =
    longHours.reduce((sum, h) => sum + Math.min(h.samples, samplesAt.get(h.hourMs) ?? 0) / 60, 0) /
    windowHours;

  const lastHour = (hours: PriceHour[]) =>
    [...hours].reverse().find((h) => h.price !== null)?.price;
  const longMark = long.mark_price ?? lastHour(longHours) ?? null;
  const shortMark = short.mark_price ?? lastHour(shortHours) ?? null;
  const current =
    longMark && shortMark !== null && longMark > 0
      ? ((shortMark - longMark) / longMark) * 100
      : null;
  const stats = spreadStats(series, windowHours, current);
  const entry = ((short.best_bid - long.best_ask) / long.best_ask) * 100;
  const goodFor =
    long.best_ask_size_usd === null || short.best_bid_size_usd === null
      ? null
      : Math.min(long.best_ask_size_usd, short.best_bid_size_usd);
  const medianMark = median(agreeing.flatMap((q) => (q.mark_price ? [q.mark_price] : [])));
  const hold = current !== null && stats ? holdTime(series, current, stats.median) : null;

  const warning =
    history === null
      ? `<div class="pc-warn">${tr("Price history is unavailable right now. The live figures below are unaffected.")}</div>`
      : coverage < 0.6
        ? `<div class="pc-warn"><b>${tr("Sparse history ({share}% of expected samples): statistics may be unreliable.", { share: Math.round(coverage * 100) })}</b> ${tr("One leg was listed recently or reported unevenly. The spread now is more trustworthy than the window's statistics.")}</div>`
        : "";

  const rankText =
    stats?.rank == null
      ? ""
      : tr("wider than {share}% of the last {window}'s hours", {
          share: `<b>${Math.round(stats.rank * 100)}</b>`,
          window: params.window.toUpperCase(),
        });
  const thin = goodFor !== null && goodFor < params.sizeUsd;
  const spreadNow = `<section class="pc-card">
<p class="pc-label has-help">${tr("Spread now (mark)")}${helpButton("pc-now")}</p>
${helpPanel("pc-now", `<p>${tr("The short leg's mark less the long leg's, as a share of the long leg's. Marks are each exchange's fair price, not a price anyone traded at; the entry below is what the books offer.")}</p>`)}
<p class="pc-big ${tone(current ?? 0)}">${pct(current)} <span class="pc-sub">${rankText}</span></p>
<p class="dim">${tr("long {long} · short {short}", { long: formatPrice(longMark), short: formatPrice(shortMark) })} (${tr("seen {long} / {short}", { long: since(long.observed_at, now), short: since(short.observed_at, now) })})</p>
<div class="pc-inner"><p><span class="pc-label">${tr("Entry at the top of the book")}</span> <b class="${tone(entry)}">${pct(entry)}</b> ${tr("buying {venue}'s ask, selling {other}'s bid", { venue: esc(venueName(long.venue_id)), other: esc(venueName(short.venue_id)) })}${thin ? ` <span class="pc-flag">${tr("thin book: only {size} rests at those prices", { size: formatUsd(goodFor) })}</span>` : ""}</p>
<p class="dim">${tr("long {long} · short {short}, good for {size}; deeper fills cost more and are not shown", { long: formatPrice(long.best_ask), short: formatPrice(short.best_bid), size: formatUsd(goodFor) })}</p></div>
${medianMark ? `<p class="dim">${tr("market median {price} · long {long} · short {short}", { price: formatPrice(medianMark), long: pct(long.mark_price ? ((long.mark_price - medianMark) / medianMark) * 100 : null, 2), short: pct(short.mark_price ? ((short.mark_price - medianMark) / medianMark) * 100 : null, 2) })}</p>` : ""}
</section>`;

  const trade = `<div class="pc-trades">${tradeButton("long", long.venue_id, links)}${tradeButton("short", short.venue_id, links)}</div>${
    links[long.venue_id] || links[short.venue_id]
      ? `<p class="notes">${tr("Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}", { how: `<a href="/legal#affiliate">${tr("How this works")}</a>` })}</p>`
      : ""
  }`;

  // The calculator: three exits below the spread now, held for the history's typical time.
  const holdHours = hold?.medianHours ?? 8;
  const targets = [0, 0.5, 1].filter((t) => current !== null && t < current);
  const rows: Scenario[] =
    current === null
      ? []
      : scenarios(
          {
            sizeUsd: params.sizeUsd,
            current,
            longTakerBps: takerOf(long.venue_id),
            shortTakerBps: takerOf(short.venue_id),
            longBookBps: ((long.best_ask - long.best_bid) / long.best_bid) * 10_000,
            shortBookBps: ((short.best_ask - short.best_bid) / short.best_bid) * 10_000,
            longApr: longMarket?.apr ?? null,
            shortApr: shortMarket?.apr ?? null,
            holdHours,
          },
          targets,
        );
  const calculator =
    rows.length === 0
      ? `<section class="pc-card"><h2>${tr("Profit calculator")}</h2><p class="lede">${tr("The short leg is not the dearer one right now, so there is no gap to close in this direction.")} <a href="${href({ longVenueId: params.shortVenueId, shortVenueId: params.longVenueId })}">${tr("Swap legs")}</a></p></section>`
      : (() => {
          const first = rows[0] as Scenario;
          const cost = first.fees + (first.crossing ?? 0);
          const line = (label: string, cells: string[], help = "") =>
            `<tr><th scope="row"${help ? ` title="${esc(help)}"` : ""}>${label}</th>${cells.map((c) => `<td class="num">${c}</td>`).join("")}</tr>`;
          return `<section class="pc-card">
<h2 class="has-help">${tr("Profit calculator")} <span class="pc-chip">${tr("sized at {size} a leg", { size: formatUsd(params.sizeUsd) })}</span>${helpButton("pc-calc")}</h2>
${helpPanel("pc-calc", `<p>${tr("If the spread closes from where it is now to each target. Fees are four taker fills, in and out of both legs. The books are each exchange's own bid-ask, crossed half on the way in and half on the way out, at the top of the book only. Funding is the short leg's rate less the long leg's over the hold, which can pay or cost.")}</p>`)}
<div class="sheet-wrap"><table class="sheet pc-calc">
<thead><tr><th>${tr("If the spread closes to")}</th>${rows.map((r) => `<th class="num">${pct(r.target, 2)}</th>`).join("")}</tr></thead>
<tbody>
${line(
  tr("Gross"),
  rows.map((r) => `<span class="${tone(r.gross)}">${money(r.gross)}</span>`),
)}
${line(
  tr("Fees, four taker fills"),
  rows.map((r) => `<span class="down">${money(-r.fees)}</span>`),
  tr("{long} bps on the long leg and {short} bps on the short, in and out", {
    long: takerOf(long.venue_id),
    short: takerOf(short.venue_id),
  }),
)}
${line(
  tr("Bid-ask, both books"),
  rows.map((r) => (r.crossing === null ? "–" : `<span class="down">${money(-r.crossing)}</span>`)),
)}
${line(
  tr("Funding, est. {hold} hold", { hold: hoursText(holdHours) }),
  rows.map((r) => `<span class="${tone(r.funding)}">${money(r.funding)}</span>`),
)}
<tr class="pc-net"><th scope="row">${tr("Net")}</th>${rows.map((r) => `<td class="num"><b class="${tone(r.net)}">${money(r.net)}</b></td>`).join("")}</tr>
</tbody></table></div>
<p class="dim">${tr("Breakeven move {pct}", { pct: `<b>${pct(breakevenPct(first, params.sizeUsd))}</b>` })} · ${tr("full convergence pays {times}× the round trip", { times: `<b>${cost > 0 ? (first.gross / cost).toFixed(1) : "–"}</b>` })}${thin ? ` · <span class="pc-flag">${tr("the book is thinner than this size")}</span>` : ""}</p>
</section>`;
        })();

  const holdSection =
    stats === null || current === null
      ? ""
      : `<section class="pc-card">
<h2 class="has-help">${tr("Hold time, from history")}${helpButton("pc-hold")}</h2>
${helpPanel("pc-hold", `<p>${tr("Every time in the window the spread rose to at least today's width, the hours until it next fell to the window's median. Hourly averages, so nothing shorter than an hour is seen, and the past is not a promise.")}</p>`)}
${
  hold
    ? `<p class="pc-big">${hoursText(hold.medianHours)} <span class="pc-sub">${tr("typical time to close (middle half {from} to {to})", { from: hoursText(hold.p25Hours), to: hoursText(hold.p75Hours) })}</span></p>
<p>${tr("Exit target: the window's median spread, {median}. Full convergence to zero is rare, and waiting for it usually makes no sense.", { median: pct(stats.median) })}</p>
<p class="dim">${tr("From {n} comparable episodes in the last {window}; {open} had not closed by the end.", { n: hold.episodes, window: params.window.toUpperCase(), open: hold.unfinished })}</p>`
    : `<p class="lede">${
        current <= stats.median
          ? tr(
              "The spread is already at or below its median for the window ({median}): nothing to wait for.",
              { median: pct(stats.median) },
            )
          : tr(
              "Too few comparable episodes in the last {window} to estimate how long this takes. Try a longer window.",
              { window: params.window.toUpperCase() },
            )
      }</p>`
}
</section>`;

  const statsSection =
    stats === null
      ? ""
      : `<section class="pc-card">
<h2 class="has-help">${tr("Spread statistics")}${helpButton("pc-stats")}</h2>
${helpPanel("pc-stats", `<p>${tr("Over the window's hours in which both legs reported a price, from each hour's average mark.")}</p>`)}
<p class="dim">${tr("Window {window} · {n} hours of {expected}", { window: params.window.toUpperCase(), n: stats.samples, expected: stats.expected })}</p>
<div class="pc-tiles">
<div><span>${tr("Now")}</span><b>${pct(current)}</b>${stats.rank === null ? "" : `<small>${tr("{n}th percentile", { n: Math.round(stats.rank * 100) })}</small>`}</div>
<div><span>${tr("Median")}</span><b>${pct(stats.median)}</b></div>
<div><span>${tr("Average")}</span><b>${pct(stats.mean)}</b></div>
<div><span>P25 – P75</span><b>${pct(stats.p25)} … ${pct(stats.p75)}</b></div>
<div><span>${tr("Range")}</span><b>${pct(stats.min)} … ${pct(stats.max)}</b></div>
<div><span>${tr("Std dev")}</span><b>±${stats.std.toFixed(3)}%</b></div>
</div>
</section>`;

  const longName = venueName(long.venue_id);
  const shortName = venueName(short.venue_id);
  const charts = `${lineChart({
    title: tr("Mark prices, hourly"),
    help: tr(
      "Each hour's average mark on the two exchanges. Where a venue publishes no mark, its index stands in.",
    ),
    format: "price",
    series: [
      {
        label: tr("Long {venue}", { venue: longName }),
        tone: "long",
        points: longHours.flatMap((h) =>
          h.price === null ? [] : [[h.hourMs, h.price] as [number, number]],
        ),
      },
      {
        label: tr("Short {venue}", { venue: shortName }),
        tone: "short",
        points: shortHours.flatMap((h) =>
          h.price === null ? [] : [[h.hourMs, h.price] as [number, number]],
        ),
      },
    ],
  })}
${lineChart({
  title: tr("Price spread, hourly"),
  help: tr(
    "The short leg's hourly mark less the long leg's, as a share of the long leg's. The dashed lines are the spread now and the window's median.",
  ),
  format: "pct",
  series: [{ label: tr("Spread"), tone: "spread", points: series.map((p) => [p.atMs, p.pct]) }],
  refs: [
    ...(current === null ? [] : [{ label: tr("now"), value: current }]),
    ...(stats ? [{ label: tr("median"), value: stats.median }] : []),
  ],
})}`;

  const legs = `<div class="pc-legs">${legCard({ side: "long", quote: long, market: longMarket, takerBps: takerOf(long.venue_id), takerKnown: takerKnown(long.venue_id), links, medianMark, now })}${legCard({ side: "short", quote: short, market: shortMarket, takerBps: takerOf(short.venue_id), takerKnown: takerKnown(short.venue_id), links, medianMark, now })}</div>`;

  return layout({
    title: tr("{asset} convergence trade: long {long}, short {short}", {
      asset,
      long: longName,
      short: shortName,
    }),
    description: tr(
      "The price gap between {long} and {short} for {asset}: now, after costs, and over its history.",
      { asset, long: longName, short: shortName },
    ),
    path: base,
    overview: data.overview,
    now,
    body: `${head}
${warning}
${spreadNow}
${trade}
${calculator}
${holdSection}
${statsSection}
${charts}
${legs}
<script>${PICKER_SCRIPT}</script><script>${CONVERGENCE_SCRIPT}</script>`,
  });
}
