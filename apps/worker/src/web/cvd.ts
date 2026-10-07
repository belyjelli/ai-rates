import type { AssetClass } from "@ai-rates/core";
import type { CvdAssetRow, CvdBar, CvdData, Overview } from "../app/data";
import {
  CVD_DEFAULT_INTERVAL,
  CVD_INTERVAL_KEYS,
  CVD_INTERVALS,
  CVD_LOCKED_INTERVALS,
  type CvdParams,
  type CvdSort,
  cvdToQuery,
} from "../app/params";
import { ageText, esc, formatPrice, formatUsd } from "./format";
import { helpButton, helpHeading, helpPanel } from "./help";
import { msg, tr, trMsg } from "./i18n";
import { layout } from "./layout";
import { assetKey, assetName } from "./pages";
import { citeMark, plainLabel } from "./share";
import {
  cvdText,
  MONTHS,
  SLOT_BAND,
  SLOT_CURSOR,
  SLOT_FORMAT,
  SLOT_SCRIPT,
  slotData,
} from "./slot-chart";
import { venueName } from "./venues";

/**
 * /cvd: cumulative volume delta -- who initiated the volume, taker buys against taker sells.
 *
 * WHAT THE NUMBER IS, and it is narrower than the name suggests. Every figure is the venues' OWN
 * 5-minute taker statistics (migration 023), summed across the venues polled: binance, okx and gate
 * (bitget too, until its retirement on 2026-09-27), for the ~100 assets deepest by open interest on them. It is not every exchange, it is not
 * finer than five minutes, and it is not our count of trades. The lede says all three.
 *
 * A DIVERGENCE IS A FLAG, NOT A CALL. "Price up while takers sold" is a description of the window,
 * not a prediction of the next one, and the page words it as one. The thresholds are written down
 * below and in the notes so a reader can disagree with them rather than trust a badge.
 */

/** The venues whose taker statistics are collected. Listed in the lede, so it cannot drift. */
export const CVD_VENUES = ["binance", "okx", "gate"] as const;

/**
 * A divergence needs both a real price move and a real flow imbalance. Below these, "price up 0.02%
 * while flow was 1% net selling" is two rounding errors pointing different ways, and flagging it
 * would put a badge on most of the table.
 */
export const DIVERGENCE_PRICE_PCT = 0.5;
export const DIVERGENCE_FLOW_PCT = 5;

const MINUS = "−";

export type Divergence = "bullish" | "bearish" | null;

const net = (row: { buy_usd: number; sell_usd: number }) => row.buy_usd - row.sell_usd;
const volume = (row: { buy_usd: number; sell_usd: number }) => row.buy_usd + row.sell_usd;

/** CVD as a share of the window's volume, in percent. Null on no volume. */
export function flowRatio(row: { buy_usd: number; sell_usd: number }): number | null {
  const total = volume(row);
  return total > 0 ? (net(row) / total) * 100 : null;
}

/**
 * Bullish: price fell while takers net bought -- someone absorbing the selling. Bearish: price rose
 * while takers net sold -- someone unloading into the bid.
 */
export function divergence(row: CvdAssetRow): Divergence {
  const ratio = flowRatio(row);
  if (row.change_pct === null || ratio === null) return null;
  if (row.change_pct <= -DIVERGENCE_PRICE_PCT && ratio >= DIVERGENCE_FLOW_PCT) return "bullish";
  if (row.change_pct >= DIVERGENCE_PRICE_PCT && ratio <= -DIVERGENCE_FLOW_PCT) return "bearish";
  return null;
}

/** Signed dollars: "+$74.4M", "−$8.7M". formatUsd leaves positives unsigned, which a flow cannot be. */
function signedUsd(usd: number): string {
  if (usd === 0) return "$0";
  return usd > 0 ? `+${formatUsd(usd)}` : formatUsd(usd);
}

function signedPct(pct: number | null, digits = 2): string {
  if (pct === null || !Number.isFinite(pct)) return "–";
  const text = Math.abs(pct).toFixed(digits);
  if (Number(text) === 0) return `${(0).toFixed(digits)}%`;
  return `${pct < 0 ? MINUS : "+"}${text}%`;
}

const tone = (value: number | null) =>
  value === null || value === 0 ? "" : value > 0 ? " cvd-up" : " cvd-down";

/** The address form every asset page uses: crypto unmarked, every other class in the path. */
const cvdPath = (asset: string, assetClass: AssetClass) =>
  assetClass === "crypto"
    ? `/cvd/${encodeURIComponent(asset)}`
    : `/cvd/${assetClass}/${encodeURIComponent(asset)}`;

/** The smallest 1-2-2.5-5 step at or above `value`, so an axis reads $300M rather than $283M. */
function niceCeil(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const multiple of [1, 2, 2.5, 5, 10]) {
    if (value <= multiple * power) return multiple * power;
  }
  return 10 * power;
}

/**
 * The chart: price and CVD on one time axis above, the net flow per bar below.
 *
 * TWO PANELS, NOT ONE, which is where this departs from the usual CVD chart. There the per-bar net
 * flow is drawn on the CVD's own axis, where a window's cumulative total dwarfs any single bar and
 * the bars flatten to a line of ticks along zero. Giving them their own strip keeps both readable:
 * the top answers "did flow and price move together", the bottom "which bars did it".
 *
 * TWO Y-AXES ON THE TOP PANEL, price left and CVD right, because they are different units. Each is
 * scaled to its own range; the lines crossing means nothing and the note says so.
 *
 * THE AXIS SPANS THE WHOLE WINDOW, empty bars included, as the liquidation charts do. CVD holds flat
 * across a gap rather than skipping it, since no recorded flow adds nothing to a running sum.
 */
function cvdChart(data: {
  label: string;
  bars: readonly CvdBar[];
  params: CvdParams;
  now: number;
}): string {
  const { label, bars, params, now } = data;
  const { hours, barMinutes, span: window } = CVD_INTERVALS[params.interval];
  const bucketMs = barMinutes * 60_000;
  const current = Math.floor(now / bucketMs) * bucketMs;
  const count = Math.round((hours * 60) / barMinutes);
  const fromMs = current - (count - 1) * bucketMs;
  const toMs = current + bucketMs;
  const span = toMs - fromMs;
  const slot = 1000 / count;

  const byBucket = new Map(bars.map((bar) => [bar.bucket_start.getTime(), bar]));
  type Slot = { start: number; bar: CvdBar | undefined; cvd: number; price: number | null };
  const slots: Slot[] = [];
  let running = 0;
  for (let i = 0; i < count; i++) {
    const start = fromMs + i * bucketMs;
    const bar = byBucket.get(start);
    if (bar) running += net(bar);
    slots.push({ start, bar, cvd: running, price: bar?.price ?? null });
  }
  // The price line joins only the bars that have a close: a slot with none is skipped rather than
  // drawn at zero, and nothing is held backwards to fill the start.

  const prices = slots.flatMap((s) => (s.price === null ? [] : [s.price]));
  const cvds = slots.map((s) => s.cvd);
  const pLo = prices.length ? Math.min(...prices) : 0;
  const pHi = prices.length ? Math.max(...prices) : 1;
  const pPad = (pHi - pLo || pHi * 0.01 || 1) * 0.08;
  const priceY = (price: number) => 1000 - ((price - (pLo - pPad)) / (pHi - pLo + 2 * pPad)) * 1000;

  const cLo = Math.min(0, ...cvds);
  const cHi = Math.max(0, ...cvds);
  const cPad = (cHi - cLo || 1) * 0.08;
  const cvdY = (usd: number) => 1000 - ((usd - (cLo - cPad)) / (cHi - cLo + 2 * cPad)) * 1000;

  const xMid = (i: number) => (i + 0.5) * slot;

  const pricePath = slots
    .map((s, i) =>
      s.price === null ? null : `${xMid(i).toFixed(1)},${priceY(s.price).toFixed(1)}`,
    )
    .filter((p): p is string => p !== null);
  const cvdPoints = slots.map((s, i) => `${xMid(i).toFixed(1)},${cvdY(s.cvd).toFixed(1)}`);
  const zeroY = cvdY(0).toFixed(1);
  const cvdArea = `M${xMid(0).toFixed(1)},${zeroY} L${cvdPoints.join(" L")} L${xMid(count - 1).toFixed(1)},${zeroY} Z`;

  // Price ticks: four evenly spaced levels across the padded range, labelled at the price's own
  // precision. CVD ticks: the same four positions, so both axes share gridlines.
  const levels = [0.1, 0.37, 0.63, 0.9];
  const priceAt = (frac: number) => pLo - pPad + (1 - frac) * (pHi - pLo + 2 * pPad);
  const cvdAt = (frac: number) => cLo - cPad + (1 - frac) * (cHi - cLo + 2 * cPad);
  const grid = levels
    .map((f) => `<line class="cvd-grid" x1="0" x2="1000" y1="${f * 1000}" y2="${f * 1000}"></line>`)
    .join("");
  const leftLabels = prices.length
    ? levels
        .map(
          (f) => `<span class="cvd-yl" style="top:${f * 100}%">${formatPrice(priceAt(f))}</span>`,
        )
        .join("")
    : "";
  const rightLabels = levels
    .map((f) => `<span class="cvd-yr" style="top:${f * 100}%">${signedUsd(cvdAt(f))}</span>`)
    .join("");

  // The net strip: one bar per slot around its own zero, on its own symmetric scale.
  const peak = niceCeil(Math.max(0, ...slots.map((s) => (s.bar ? Math.abs(net(s.bar)) : 0))));
  const barWidth = Math.max(slot * 0.72, 1);
  const netBars = slots
    .map((s, i) => {
      if (!s.bar) return "";
      const flow = net(s.bar);
      if (flow === 0) return "";
      const h = (Math.abs(flow) / peak) * 500;
      const x = (i * slot + (slot - barWidth) / 2).toFixed(2);
      return `<rect class="${flow > 0 ? "cvd-buy" : "cvd-sell"}${s.start === current ? " cvd-now" : ""}" x="${x}" y="${(flow > 0 ? 500 - h : 500).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}"></rect>`;
    })
    .join("");

  // About four to eight labels at every span: hourly over 8h, daily over 4 days, weekly over 30.
  const tickHours =
    hours <= 1
      ? 0.25
      : hours <= 8
        ? 1
        : hours <= 24
          ? 4
          : hours <= 96
            ? 24
            : hours <= 384
              ? 96
              : 168;
  const tickMs = tickHours * 3_600_000;
  const xLabels: string[] = [];
  for (let ms = Math.ceil(fromMs / tickMs) * tickMs; ms < toMs; ms += tickMs) {
    const d = new Date(ms);
    const midnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
    const text = midnight
      ? tr("{month} {day}", { month: trMsg(MONTHS[d.getUTCMonth()] ?? ""), day: d.getUTCDate() })
      : `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    // Every other label is marked so a phone can drop it: at 390px the plot is ~220px wide and six
    // "HH:MM" labels ran into one string ("16:0020:00Sep 17").
    xLabels.push(
      `<span class="cvd-x${midnight ? " cvd-day" : ""}${xLabels.length % 2 ? " x-alt" : ""}" style="left:${(((ms - fromMs) / span) * 100).toFixed(2)}%">${text}</span>`,
    );
  }

  const total = running;
  const title =
    barMinutes >= 60
      ? tr("{asset} · cumulative volume delta · {n}-hour bars, UTC", {
          asset: label,
          n: barMinutes / 60,
        })
      : tr("{asset} · cumulative volume delta · {n}-minute bars, UTC", {
          asset: label,
          n: barMinutes,
        });

  // The readout before any hover is the whole window in the same words a bar is read in, so the line
  // does not change shape under the pointer, and a reader without JavaScript still gets the sums.
  const open = prices[0] ?? null;
  const bought = slots.reduce((sum, s) => sum + (s.bar?.buy_usd ?? 0), 0);
  const sold = slots.reduce((sum, s) => sum + (s.bar?.sell_usd ?? 0), 0);
  const cite = citeMark(
    tr("{asset} taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.", {
      asset: plainLabel(label),
      window,
      cvd: signedUsd(total),
      bought: formatUsd(bought),
      sold: formatUsd(sold),
    }),
  );
  const idle = cvdText(
    tr("Last {window}", { window: esc(window) }),
    [bought, sold, prices.at(-1) ?? null],
    null,
    open,
    SLOT_FORMAT,
  );
  // Whole dollars are finer than any readout shows; the price keeps its own precision.
  const payload = slotData({
    kind: "cvd",
    from: fromMs,
    unit: bucketMs,
    open,
    slots: slots.map((s) =>
      s.bar
        ? [Math.round(s.bar.buy_usd), Math.round(s.bar.sell_usd), Math.round(s.cvd), s.price]
        : null,
    ),
  });

  return `<figure class="fchart cvd-chart" data-live="cvd-chart">${cite}
<div class="fchart-head"><p class="fchart-title">${title}</p><div class="fchart-keys"><span><i class="cvd-key-price"></i>${tr("Price")}</span><span><i class="cvd-key-cvd"></i>CVD <b data-u="cvd-total" class="${tone(total).trim()}">${signedUsd(total)}</b></span><span><i class="cvd-key-buy"></i>${tr("Net buy")}</span><span><i class="cvd-key-sell"></i>${tr("Net sell")}</span></div><p class="fchart-read slot-read" aria-live="polite">${idle} · ${tr("hover or tap a bar to read it")}</p></div>
<div class="slot-area" tabindex="0" role="group" aria-label="${esc(tr("{asset} bars; arrow keys read one at a time", { asset: label.replace(/<[^>]+>/g, "") }))}">
<div class="fchart-plot cvd-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{asset} price and cumulative volume delta over the last {window}", { asset: label, window }))}">${grid}${SLOT_BAND}<line class="cvd-zero" x1="0" x2="1000" y1="${zeroY}" y2="${zeroY}"></line><path class="cvd-area" d="${cvdArea}"></path><polyline class="cvd-line" points="${cvdPoints.join(" ")}"></polyline>${
    pricePath.length > 1
      ? `<polyline class="cvd-price" points="${pricePath.join(" ")}"></polyline>`
      : ""
  }${SLOT_CURSOR}</svg>${leftLabels}${rightLabels}</div>
<div class="fchart-plot cvd-strip"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{asset} net taker flow per bar", { asset: label }))}">${SLOT_BAND}<line class="cvd-zero" x1="0" x2="1000" y1="500" y2="500"></line>${netBars}${SLOT_CURSOR}</svg><span class="cvd-yr" style="top:0%">${signedUsd(peak)}</span><span class="cvd-yr" style="top:100%">${signedUsd(-peak)}</span>${xLabels.join("")}</div>
</div>
${payload}
</figure>`;
}

const SORT_LABELS: Record<CvdSort, string> = {
  volume: msg("Volume"),
  cvd: msg("CVD"),
  ratio: msg("CVD / volume"),
  change: msg("Change"),
};

/** A small padlock in the text colour, for an interval that is shown but cannot be picked yet. */
const LOCK_ICON =
  '<svg class="tf-lock" viewBox="0 0 12 12" width="9" height="9" aria-hidden="true"><rect x="2" y="5" width="8" height="6.5" rx="1" fill="currentColor"></rect><path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" stroke-width="1.4"></path></svg>';

/**
 * Switching the interval, or the charted asset, in place.
 *
 * WHY NOT A PLAIN LINK. A full navigation repaints the header, the nav and the screener before the
 * new chart arrives, and for the longer spans a cold render takes a second or two: the page goes
 * blank and jumps. So a click on an interval keeps the page, puts an animated placeholder where the
 * chart is (bars rising and falling in the chart's own colours, a spinner and "Loading 1h bars…"),
 * dims the tiles and the table, and fetches the SAME address a plain click would have opened -- the
 * edge cache treats it as any other visit -- then swaps the new page's <main> in and moves the
 * address bar with pushState.
 *
 * It falls back to a real navigation on any failure, a modified click (new tab, new window), or a
 * browser without fetch. Back and forward reload, which is plain and always right. live.ts keeps
 * working across a swap because it polls location.href, which pushState has already moved.
 */
export const CVD_SWITCH_SCRIPT = `(() => {
  if (!document.querySelector(".cvd-intervals") || !window.fetch || !window.DOMParser || !history.pushState) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let busy = false;

  const placeholder = (label) => {
    const wrap = document.createElement("div");
    wrap.className = "cvd-skel" + (still ? " cvd-skel-still" : "");
    wrap.setAttribute("role", "status");
    let bars = "";
    for (let i = 0; i < 48; i++) {
      // A fixed wave, not random: the same placeholder every time, so it reads as "loading", not data.
      const h = 18 + Math.round(30 * Math.abs(Math.sin(i * 0.55)) + 12 * Math.abs(Math.cos(i * 1.7)));
      bars += '<i class="' + (i % 3 === 0 ? "cvd-skel-sell" : "cvd-skel-buy") + '" style="height:' + h + '%;animation-delay:' + (i * 40) + 'ms"></i>';
    }
    wrap.innerHTML = '<div class="cvd-skel-bars">' + bars + '</div><p class="cvd-skel-msg"><span class="spin" aria-hidden="true"></span></p>';
    wrap.querySelector(".cvd-skel-msg").append(label);
    return wrap;
  };

  const toChart = () => {
    const chart = document.getElementById("cvd-chart");
    if (!chart) return;
    const box = chart.getBoundingClientRect();
    // Only when the chart is out of sight: a reader picking an interval is already looking at it.
    if (box.top < 0 || box.top > innerHeight * 0.5) chart.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  };

  // link: an interval in the strip (data-cvd-switch) or an asset to chart (data-cvd-select).
  const go = async (link) => {
    if (busy) return;
    busy = true;
    const href = link.href;
    const main = document.querySelector("main");
    const chart = document.getElementById("cvd-chart");
    // Looked up per click: the strip is replaced with the rest of <main> on every switch.
    const nav = document.querySelector(".cvd-intervals");
    let label = "";
    if (link.dataset.cvdSwitch) {
      for (const a of nav.querySelectorAll("a")) {
        const on = a === link;
        a.classList.toggle("on", on);
        if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      }
      label = (nav.dataset.loading || "").replace("{interval}", link.dataset.cvdSwitch);
    } else {
      // The chosen row lights up at once, before the chart arrives.
      for (const tr of document.querySelectorAll(".cvd-table tr.cvd-on")) tr.classList.remove("cvd-on");
      const row = link.closest("tr");
      if (row) row.classList.add("cvd-on");
      label = (nav.dataset.loadingAsset || "").replace("{asset}", link.dataset.cvdSelect || "");
      toChart();
    }
    main.classList.add("cvd-switching");
    main.setAttribute("aria-busy", "true");
    if (chart) {
      chart.style.minHeight = chart.offsetHeight + "px";
      chart.replaceChildren(placeholder(label));
    }
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const fresh = doc.querySelector("main");
      if (!fresh) throw new Error("no main");
      history.pushState(null, "", href);
      main.innerHTML = fresh.innerHTML;
      // The tab's title names the charted asset ("ETH CVD"), so it moves with the chart.
      if (doc.title) document.title = doc.title;
      main.classList.remove("cvd-switching");
      main.removeAttribute("aria-busy");
      if (window.airratesHelp) window.airratesHelp(main);
      // Replacing <main> cuts a smooth scroll short; land it on the chart for a newly picked asset.
      if (link.dataset.cvdSelect) {
        const chart = document.getElementById("cvd-chart");
        if (chart) chart.scrollIntoView({ block: "start" });
      }
      busy = false;
    } catch (_) {
      location.href = href;
    }
  };

  const modified = (event) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

  // Delegated, because the strip and the table are replaced with the rest of <main> on every switch,
  // and live.ts swaps the table's rows every 30 seconds.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || !event.target.closest) return;
    const link = event.target.closest("a[data-cvd-switch], a[data-cvd-select]");
    if (link) {
      if (modified(event)) return;
      event.preventDefault();
      if (link.getAttribute("aria-current")) {
        if (link.dataset.cvdSelect) toChart();
        return;
      }
      go(link);
      return;
    }
    // Anywhere on a screener row selects it, not just the symbol: the row is the target. The symbol
    // stays the real link, for the keyboard and for opening in a new tab. A click on anything else
    // that acts, or one that ends a text selection, is left alone.
    const row = event.target.closest(".cvd-table tbody tr");
    if (!row || event.target.closest("a, button, input, select, textarea, label, summary")) return;
    if (String(getSelection && getSelection()).trim()) return;
    const select = row.querySelector("a[data-cvd-select]");
    if (!select) return;
    if (modified(event)) { window.open(select.href, "_blank", "noopener"); return; }
    if (select.getAttribute("aria-current")) { toChart(); return; }
    go(select);
  });
  addEventListener("popstate", () => location.reload());
})();`;

function sortKey(row: CvdAssetRow, sort: CvdSort): number {
  switch (sort) {
    case "cvd":
      return net(row);
    case "ratio":
      return flowRatio(row) ?? Number.NEGATIVE_INFINITY;
    case "change":
      return row.change_pct ?? Number.NEGATIVE_INFINITY;
    default:
      return volume(row);
  }
}

export function cvd(data: {
  overview: Overview;
  cvd: CvdData;
  /** The charted asset. */
  asset: string;
  params: CvdParams;
  now: number;
}): string {
  const { overview, cvd: flow, asset, params, now } = data;
  const rows = flow.rows;
  const chartClass = flow.asset_class ?? "crypto";
  const label = assetName(asset, chartClass);
  const selfPath = cvdPath(asset, chartClass);
  const assetInAddress = asset !== "BTC" || chartClass !== "crypto";

  // --- the four tiles ---------------------------------------------------------------------------
  const netBuying = rows.filter((row) => net(row) > 0).length;
  const breadth = rows.length > 0 ? (netBuying / rows.length) * 100 : null;
  const divergences = rows.map(divergence);
  const bullish = divergences.filter((d) => d === "bullish").length;
  const bearish = divergences.filter((d) => d === "bearish").length;
  const byNet = [...rows].sort((a, b) => net(b) - net(a));
  const topBuy = byNet[0] && net(byNet[0]) > 0 ? byNet[0] : null;
  const topSell = byNet.at(-1) && net(byNet.at(-1) as CvdAssetRow) < 0 ? byNet.at(-1) : null;

  const topLine = (row: CvdAssetRow | null | undefined) =>
    row
      ? `<a class="${tone(net(row)).trim()}" href="${esc(`${cvdPath(row.asset, row.asset_class)}${cvdToQuery({ ...params, q: "" })}#cvd-chart`)}">${assetName(row.asset, row.asset_class)} ${signedUsd(net(row))}</a>`
      : `<span class="dim">–</span>`;

  const tiles = `<div class="cvd-tiles" data-live="cvd-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("CVD breadth")}</p><p class="cvd-big"><span data-u="breadth">${breadth === null ? "–" : `${breadth.toFixed(1)}%`}</span></p><p class="dim">${tr("of {n} assets with net taker buying", { n: rows.length })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Bullish divergences")}</p><p class="cvd-big cvd-up"><span data-u="bullish">${bullish}</span></p><p class="dim">${tr("price down ≥{price}%, takers net buying ≥{flow}% of volume", { price: DIVERGENCE_PRICE_PCT, flow: DIVERGENCE_FLOW_PCT })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Bearish divergences")}</p><p class="cvd-big cvd-down"><span data-u="bearish">${bearish}</span></p><p class="dim">${tr("price up ≥{price}%, takers net selling ≥{flow}% of volume", { price: DIVERGENCE_PRICE_PCT, flow: DIVERGENCE_FLOW_PCT })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Top CVD flows")}</p><p class="cvd-flows">${topLine(topBuy)}<br>${topLine(topSell)}</p><p class="dim">${tr("largest net buy / net sell")}</p></div>
</div>`;

  // --- controls ---------------------------------------------------------------------------------
  // The interval strip. Each link is an ordinary address (the page works without the script), and
  // CVD_SWITCH_SCRIPT turns a click into an in-place swap behind a loading placeholder. The locked
  // interval is not a link at all: there is nowhere for it to go yet.
  const intervalStrip = `<nav class="tf cvd-intervals" aria-label="${tr("Interval")}" data-loading="${esc(tr("Loading {interval} bars…"))}" data-loading-asset="${esc(tr("Loading {asset}…"))}">${CVD_INTERVAL_KEYS.map(
    (key) => {
      const href = esc(
        (assetInAddress ? selfPath : "/cvd") + cvdToQuery({ ...params, interval: key }),
      );
      return key === params.interval
        ? `<a class="on" href="${href}" aria-current="page" data-cvd-switch="${key}">${key}</a>`
        : `<a href="${href}" data-cvd-switch="${key}">${key}</a>`;
    },
  ).join("")}${CVD_LOCKED_INTERVALS.map(
    (key) =>
      `<span class="tf-locked" aria-disabled="true" title="${esc(tr("Not available yet: there is not enough history for {interval} bars", { interval: key }))}">${key}${LOCK_ICON}</span>`,
  ).join("")}</nav>`;

  // --- the screener table -----------------------------------------------------------------------
  const filtered = params.q ? rows.filter((row) => row.asset.includes(params.q)) : rows;
  const sorted = [...filtered].sort((a, b) => {
    const diff = sortKey(a, params.sort) - sortKey(b, params.sort);
    return (params.asc ? diff : -diff) || a.asset.localeCompare(b.asset);
  });

  const sortTh = (sort: CvdSort, title: string) => {
    const active = params.sort === sort;
    const next = { ...params, sort, asc: active ? !params.asc : false };
    const href = esc((assetInAddress ? selfPath : "/cvd") + cvdToQuery(next));
    return `<th class="num" title="${esc(title)}"${active ? ` aria-sort="${params.asc ? "ascending" : "descending"}"` : ""}><a href="${href}">${trMsg(SORT_LABELS[sort])}${active && params.asc ? " ↑" : ""}</a></th>`;
  };

  const body = sorted
    .map((row, index) => {
      const signal = divergence(row);
      const ratio = flowRatio(row);
      const selected = row.asset === asset && row.asset_class === chartClass;
      return `<tr data-k="${esc(assetKey(row.asset, row.asset_class))}"${selected ? ' class="cvd-on"' : ""}>
<td class="num dim">${index + 1}</td>
<td class="asset"><a href="${esc(`${cvdPath(row.asset, row.asset_class)}${cvdToQuery({ ...params, q: "" })}#cvd-chart`)}" data-cvd-select="${esc(row.asset)}"${selected ? ' aria-current="true"' : ""}>${assetName(row.asset, row.asset_class)}</a></td>
<td class="num"><span data-u="price">${formatPrice(row.price)}</span></td>
<td class="num${tone(row.change_pct)}"><span data-u="change">${signedPct(row.change_pct)}</span></td>
<td class="num${tone(net(row))}"><span data-u="cvd">${signedUsd(net(row))}</span></td>
<td class="num${tone(ratio)}"><span data-u="ratio">${signedPct(ratio)}</span></td>
<td class="num"><span data-u="volume">${formatUsd(volume(row))}</span></td>
<td class="num dim">${row.venues}</td>
<td>${signal === null ? "" : `<span class="cvd-badge cvd-badge-${signal}">${signal === "bullish" ? tr("bullish div") : tr("bearish div")}</span>`}</td>
</tr>`;
    })
    .join("");

  const search = `<form class="cvd-search" method="get" action="${esc(assetInAddress ? selfPath : "/cvd")}">${
    params.interval !== CVD_DEFAULT_INTERVAL
      ? `<input type="hidden" name="interval" value="${esc(params.interval)}">`
      : ""
  }${params.sort !== "volume" ? `<input type="hidden" name="sort" value="${esc(params.sort)}">` : ""}${
    params.asc ? '<input type="hidden" name="dir" value="asc">' : ""
  }<input type="search" name="q" value="${esc(params.q)}" placeholder="${tr("Search symbol")}" aria-label="${tr("Search symbol")}"><button type="submit">${tr("Find")}</button>${
    params.q
      ? `<a href="${esc((assetInAddress ? selfPath : "/cvd") + cvdToQuery({ ...params, q: "" }))}">${tr("clear")}</a>`
      : ""
  }</form>`;

  const table =
    rows.length === 0
      ? `<p class="empty">${tr("No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.", { window: esc(CVD_INTERVALS[params.interval].span) })}</p>`
      : `<div class="sheet-wrap"><table class="sheet cvd-table">
<thead><tr><th class="num">#</th><th>${tr("Asset")}</th><th class="num">${tr("Price")}</th>${sortTh("change", tr("Reference market's first close to last close in the window"))}${sortTh("cvd", tr("Taker buys less taker sells, in dollars, summed over the polled venues"))}${sortTh("ratio", tr("CVD as a share of the window's taker volume"))}${sortTh("volume", tr("Taker buys plus taker sells, in dollars"))}<th class="num" title="${tr("Polled venues with flow for this asset")}">${tr("Venues")}</th><th title="${tr("Price and flow disagreeing by more than the thresholds above the table")}">${tr("Signal")}</th></tr></thead>
<tbody data-live="cvd-rows">${body || `<tr><td colspan="9" class="dim">${tr("No asset matches “{q}”.", { q: esc(params.q) })}</td></tr>`}</tbody>
</table></div>`;

  const chart =
    flow.asset_class === null
      ? `<p class="empty">${tr("No live market lists {asset}, so there is no flow to chart.", { asset: esc(asset) })}</p>`
      : flow.bars.length === 0
        ? `<p class="empty">${tr("No taker flow for {asset} in the last {window}. Only the ~100 assets deepest on {venues} are polled; pick one from the table below.", { asset: label, window: esc(CVD_INTERVALS[params.interval].span), venues: CVD_VENUES.map(venueName).join(", ") })}</p>`
        : cvdChart({ label, bars: flow.bars, params, now });

  const lag = flow.newest
    ? tr("Newest bucket {age}.", { age: esc(ageText(flow.newest, now)) })
    : "";

  return layout({
    title: assetInAddress ? `${label.replace(/<[^>]+>/g, "")} CVD` : "CVD",
    description: tr(
      "Cumulative volume delta: taker buying against taker selling across exchanges, and where price and order flow disagree.",
    ),
    path: "/cvd",
    overview,
    now,
    body: `${helpHeading(
      "h1",
      "CVD",
      "cvd",
      `<p>${tr(
        "Cumulative volume delta: {buys} less {sells}, in dollars. These are the exchanges' own 5-minute taker statistics from <b>{venues}</b>, summed, for the ~100 assets deepest on them — not every venue, and nothing finer than five minutes. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.",
        {
          buys: `<span class="cvd-up">${tr("taker buys")}</span>`,
          sells: `<span class="cvd-down">${tr("taker sells")}</span>`,
          venues: CVD_VENUES.map(venueName).join(", "),
        },
      )}</p><p>${tr("Price is the busiest polled market's own close, left axis; CVD is taker buys less taker sells from the start of the window, right axis. The two are scaled separately, so where the lines cross means nothing. Hover either panel to read one bar beside the cursor; on a phone, tap and it reads in the line above the chart.")}</p>`,
    )}
<div class="lq-controls">${intervalStrip}</div>
${tiles}
<div id="cvd-chart" class="cvd-anchor">${chart}</div>
<script>${SLOT_SCRIPT}</script>
<script>${CVD_SWITCH_SCRIPT}</script>
<div class="cvd-head"><h2 class="cvd-h2 has-help">${tr("CVD screener · net buying and selling by asset")}${helpButton("cvd-screener")}</h2>${search}</div>
${helpPanel("cvd-screener", `<p>${tr("Click an asset to chart it above. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance and Gate publish weeks of it and OKX five days, so the oldest bars of a new 7-day window sum fewer venues.")}</p><p>${tr("Venues publish each 5-minute bucket after it closes, so the right edge runs a few minutes behind.")}</p>`)}
<p class="notes" data-live="cvd-asof">${lag}</p>
${table}`,
  });
}
