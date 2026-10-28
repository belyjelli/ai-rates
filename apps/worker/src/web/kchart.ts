import type { CvdBar } from "../app/data";
import { KC_PAGE_BARS, TAKER_FLOW_DAYS } from "../app/params";
import { tr } from "./i18n";
import { icon } from "./icons";
import { LWC_SOURCE, LWC_VERSION } from "./lwc.generated";
import { slotPct, slotPrice, slotUsd, slotWhen, slotWords } from "./slot-chart";

/**
 * The Chart page's trading chart: candles you drag back through history and zoom, drawn by
 * TradingView's Lightweight Charts, with the CVD in panes below them.
 *
 * THE PANES (owner, 2026-10-28): price candles; the perpetuals' CVD; the spot book's CVD, for an
 * asset with one; and the delta, the two nets summed per bar, as a histogram. Spot and futures get a
 * pane each rather than sharing one because their sizes differ by an order of magnitude on most
 * assets, and on one axis the smaller would read as a flat line.
 *
 * WHY. A tester (2026-10-16) wanted what an exchange app gives: candles rather than a line of
 * closes, and every interval scrollable to the left to look back. The SVG chart (cvd.ts) is one
 * window, rendered whole on the server; a window that moves under the pointer needs a canvas and
 * data on demand.
 *
 * THE SVG STAYS. The server still renders it, so a reader without JavaScript, a crawler and the
 * moment before the library arrives all get a chart. This script then loads the library, builds the
 * trading chart in a host beside the figure, and hides the SVG panels (`.kc-on`). If the library
 * fails to load, nothing is hidden.
 *
 * OUTSIDE THE LIVE REGION. live.ts replaces the figure's HTML every 30 seconds, which would destroy
 * a chart built inside it, and the reader's place in it. So the host sits beside the figure, and the
 * figure carries only the data (`.kc-data`): when a refresh swaps in a new copy, the bars in it are
 * merged into the chart where it stands.
 *
 * HOVER READS IN A BOX OVER THE CANVAS, beside the cursor (owner, 2026-10-28): the bar's time, its
 * candle, a small table of the taker flow behind it, and the CVD lines where it stands. It used to be
 * written into the readout line above the chart, which grew and wrapped under the pointer and pushed
 * the chart down. That line now keeps the window's summary and never changes on hover.
 *
 * HISTORY comes from `/data/chart` in pages of KC_PAGE_BARS bars, on a grid of whole pages so every
 * reader asks for the same addresses and the edge cache answers most of them. A page names the
 * reference market the chart already draws, so the price does not jump to another venue's quotes
 * part way back. It stops at taker_flow's retention.
 *
 * TIME is the reader's zone, as on every chart (localtime.ts): the library draws UTC, so each bar is
 * handed to it shifted by the reader's offset, and labelled with the site's own words.
 */

/** Where the library is served: versioned, so it can be cached for a year. */
export const LWC_PATH = `/assets/lightweight-charts-${LWC_VERSION}.js`;

/** The library itself, at LWC_PATH. */
export function lwcAsset(path: string): Response | null {
  if (path !== LWC_PATH) return null;
  return new Response(LWC_SOURCE, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

export { KC_PAGE_BARS, TAKER_FLOW_DAYS };

/**
 * One bar as the chart ships it: start (epoch ms), open, high, low, close, the perpetuals' taker buys
 * and taker sells, and the spot book's (null for a bar without spot flow).
 */
export type KBar = [
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number,
  number,
  number | null,
  number | null,
];

/**
 * The bars in the shipped form. Whole dollars: finer than any readout shows. A bar whose reference
 * market has no close has no candle; a close without the rest stands in for all four.
 */
export function kBars(bars: readonly CvdBar[]): KBar[] {
  return bars.map((bar) => {
    const close = bar.price;
    return [
      bar.bucket_start.getTime(),
      close === null ? null : (bar.open ?? close),
      close === null ? null : (bar.high ?? close),
      close === null ? null : (bar.low ?? close),
      close,
      Math.round(bar.buy_usd),
      Math.round(bar.sell_usd),
      bar.spot_buy_usd == null ? null : Math.round(bar.spot_buy_usd),
      bar.spot_sell_usd == null ? null : Math.round(bar.spot_sell_usd),
    ];
  });
}

/** The reference market as the history address names it: "binance:BTCUSDT". */
export function kRef(bars: readonly CvdBar[]): string | null {
  const bar = bars.find((b) => b.price_venue !== null && b.price_symbol !== null);
  return bar ? `${bar.price_venue}:${bar.price_symbol}` : null;
}

/**
 * The history address for one asset and bar length, without `before`, which the browser adds; with
 * `spot`, the pages carry the spot book's flow too.
 */
export const kSource = (asset: string, assetClass: string, barMinutes: number, spot = false) =>
  `/data/chart?asset=${encodeURIComponent(asset)}&class=${encodeURIComponent(assetClass)}&bar=${barMinutes}${spot ? "&spot=1" : ""}`;

/** What a figure ships for the trading chart. */
export interface KChartPayload {
  /** Bar length, ms; and how many bars the page's window is, which the chart opens on. */
  bar: number;
  count: number;
  /** One history page's length, ms: KC_PAGE_BARS bars. */
  page: number;
  /** The oldest moment worth asking for, epoch ms. */
  floor: number;
  /** The history address (kSource) and the reference market to keep. */
  src: string;
  ref: string | null;
  /** Whether the asset has a spot book, and so a spot CVD pane. */
  spot: boolean;
  bars: KBar[];
  /** The asset's spot ETF flows, pinned on the price; absent for an asset with none read. */
  etf?: KEtf;
}

/**
 * Spot ETF flows as the chart ships them: each trade date as [4 pm New York in epoch ms, the day's
 * net flow, [fund, flow] largest first, the trade date as YYYY-MM-DD], and the funds counted.
 */
export interface KEtf {
  funds: string[];
  days: [number, number, [string, number][], string][];
}

/**
 * The US spot Bitcoin ETFs the collector cannot read, which the pins' total leaves out: their issuers
 * refuse automated reads from the collector's host (profitlock-worker collector/internal/etf).
 */
export const ETF_NOT_READ = ["FBTC", "GBTC", "BTC", "BTCO", "BTCW", "MSBT", "BRRR"];

/** The flows in the shipped form: whole dollars. */
export function kEtf(flows: {
  days: readonly {
    trade_date: string;
    at: number;
    total_usd: number;
    funds: readonly { fund: string; usd: number }[];
  }[];
  funds: readonly string[];
}): KEtf | undefined {
  if (flows.days.length === 0) return undefined;
  return {
    funds: [...flows.funds],
    days: flows.days.map((d) => [
      d.at,
      Math.round(d.total_usd),
      d.funds.map((f) => [f.fund, Math.round(f.usd)] as [string, number]),
      d.trade_date,
    ]),
  };
}

/** The payload as a JSON script tag, `<` escaped, with the readout's words in the render's language. */
export function kchartData(payload: KChartPayload): string {
  const words = {
    ...slotWords(),
    older: tr("Loading older bars…"),
    oldest: tr("Nothing older: taker flow is kept for {days} days.", { days: TAKER_FLOW_DAYS }),
    failed: tr("Older bars did not load. Drag again to retry."),
    hint: tr("drag to look back · wheel or pinch to zoom · hover a candle to read it"),
    paneFutures: tr("Futures CVD"),
    paneSpot: tr("Spot CVD"),
    paneDelta: tr("Delta"),
    tipOpen: tr("Open"),
    tipHigh: tr("High"),
    tipLow: tr("Low"),
    tipClose: tr("Close"),
    tipBuys: tr("taker buys"),
    tipSells: tr("taker sells"),
    tipNet: tr("Net"),
    tipFutures: tr("Futures"),
    tipSpot: tr("Spot (Binance)"),
    etfIn: tr("Spot ETF net inflow"),
    etfOut: tr("Spot ETF net outflow"),
    etfCounted: tr("Counted: {funds}. Not read: {missing}, whose issuers block automated reads.", {
      funds: (payload.etf?.funds ?? []).join(", "),
      missing: ETF_NOT_READ.join(", "),
    }),
    etfKey: tr("pins: spot ETF net flow per trade day, at the 4 pm New York NAV"),
    etfDay: tr("{date}, 4 pm New York close"),
    etfPin: icon("pin"),
  };
  return `<script type="application/json" class="kc-data">${JSON.stringify({ ...payload, words }).replace(/</g, "\\u003c")}</script>`;
}

/** The host the chart is built in: beside the figure, never inside a live region. */
export const KC_HOST = `<div class="kc-host" data-kc hidden></div>`;

/**
 * The browser half, once per page. A MutationObserver both mounts a chart in a host that has just
 * arrived (the page's own, or one an in-place interval switch swapped in) and merges a figure's
 * refreshed data, so neither depends on who changed the page.
 */
export const KCHART_SCRIPT = `(() => {
  if (window.airratesKChart) return;
  window.airratesKChart = true;
  const SRC = ${JSON.stringify(LWC_PATH)};
  const slotWhen = ${slotWhen};
  const usd = ${slotUsd};
  const price = ${slotPrice};
  const pct = ${slotPct};
  const signed = (v) => (v > 0 ? "+" : "") + usd(v);
  const zone = (ms) => (window.airratesZone ? window.airratesZone(ms) : 0);
  let lib = null;
  const load = () => lib || (lib = new Promise((ok, no) => {
    if (window.LightweightCharts) return ok(window.LightweightCharts);
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.LightweightCharts ? ok(window.LightweightCharts) : no(new Error("no library")));
    s.onerror = () => { lib = null; no(new Error("library failed")); };
    document.head.appendChild(s);
  }));
  const charts = new Set();
  const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  // The library draws UTC; a bar is handed to it at its start in the reader's zone. Strictly
  // ascending, which a clock going back an hour would otherwise break.
  const times = (bars) => {
    const out = [];
    let last = -Infinity;
    for (const b of bars) {
      let t = Math.round((b[0] + zone(b[0]) * 60000) / 1000);
      if (t <= last) t = last + 1;
      out.push(t);
      last = t;
    }
    return out;
  };

  // A bar from before the spot book was collected has no spot flow: it adds nothing to the spot
  // line, and the delta is the perpetuals' alone.
  const spotNet = (b) => (b[7] == null || b[8] == null ? 0 : b[7] - b[8]);

  const draw = (st) => {
    const bars = st.bars, at = times(bars);
    st.times = at;
    const candles = [], line = [], spot = [], net = [];
    let run = 0, spotRun = 0;
    st.cvd = [];
    st.spotCvd = [];
    bars.forEach((b, i) => {
      const time = at[i];
      const c = b[4];
      if (c === null) candles.push({ time });
      else {
        const o = b[1] === null ? c : b[1];
        candles.push({ time, open: o, high: Math.max(b[2] === null ? c : b[2], o, c), low: Math.min(b[3] === null ? c : b[3], o, c), close: c });
      }
      run += b[5] - b[6];
      spotRun += spotNet(b);
      st.cvd.push(run);
      st.spotCvd.push(spotRun);
      line.push({ time, value: run });
      spot.push({ time, value: spotRun });
      const delta = b[5] - b[6] + (st.spot ? spotNet(b) : 0);
      net.push({ time, value: delta, color: delta >= 0 ? st.colors.long : st.colors.short });
    });
    st.candles.setData(candles);
    st.line.setData(line);
    if (st.spot) st.spot.setData(spot);
    st.net.setData(net);
    const last = bars.length ? bars[bars.length - 1][4] : null;
    if (last) {
      const step = Math.pow(10, Math.floor(Math.log10(Math.abs(last))) - 5);
      st.candles.applyOptions({ priceFormat: { type: "custom", formatter: price, minMove: step } });
    }
  };

  // Redraw keeping the reader's place: \`added\` bars came in on the left, so the same bars stay in
  // view; at the right edge the chart keeps following the newest bar.
  const redraw = (st, added, appended) => {
    const ts = st.chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    const atEdge = r && r.to >= st.bars.length - appended - 1.5;
    draw(st);
    if (r) ts.setVisibleLogicalRange({ from: r.from + added + (atEdge ? appended : 0), to: r.to + added + (atEdge ? appended : 0) });
    schedulePins(st);
  };

  // The spot ETFs' daily flows (cvd.ts, collector etf_flows): a pin on the candle holding 4 pm New
  // York of each trade date, when the funds strike the NAV their creations and redemptions are priced
  // at. An inflow hangs under the candle's low pointing up at it, an outflow over its high pointing
  // down; the size grows with the flow. Hover or tap one for the day's funds. Placed over the canvas
  // from the library's own coordinates, and placed again whenever the view can have moved.
  const PIN_GAP = 3;
  const pinSize = (usd) => (Math.abs(usd) >= 5e8 ? 22 : Math.abs(usd) >= 1e8 ? 18 : 14);
  const barAt = (st, ms) => {
    const bars = st.bars, len = st.d.bar;
    let lo = 0, hi = bars.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (bars[mid][0] + len <= ms) lo = mid + 1;
      else if (bars[mid][0] > ms) hi = mid - 1;
      else return mid;
    }
    return -1;
  };
  const pinsInit = (st) => {
    const etf = st.d.etf;
    if (!etf || !etf.days.length) return;
    const w = st.d.words;
    st.pins = document.createElement("div");
    st.pins.className = "kc-pins";
    st.canvas.append(st.pins);
    // The trade date as New York has it, not the reader's: 4 pm there is the next morning in Asia.
    const months = w.months.split("|");
    const dayName = (date) => w.etfDay.replace("{date}", () => months[Number(date.slice(5, 7)) - 1] + " " + Number(date.slice(8, 10)));
    st.pinList = etf.days.map(([at, total, funds, date]) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "kc-pin " + (total >= 0 ? "kc-pin-in" : "kc-pin-out");
      el.style.fontSize = pinSize(total) + "px";
      const when = dayName(date);
      const rows = funds.map(([f, v]) => '<tr><th>' + f + '</th><td class="' + (v >= 0 ? "kc-up" : "kc-down") + '">' + signed(v) + "</td></tr>").join("");
      el.innerHTML = w.etfPin + '<span class="kc-pin-tip" role="tooltip"><b>' + (total >= 0 ? w.etfIn : w.etfOut) + ' <span class="' + (total >= 0 ? "kc-up" : "kc-down") + '">' + signed(total) + "</span></b><span class='kc-pin-when'>" + when + "</span><table>" + rows + '</table><span class="kc-pin-note">' + w.etfCounted + "</span></span>";
      el.setAttribute("aria-label", (total >= 0 ? w.etfIn : w.etfOut) + " " + signed(total) + ", " + when);
      el.hidden = true;
      st.pins.append(el);
      return { el, at, total, size: pinSize(total) };
    });
    const key = document.createElement("span");
    key.className = "kc-etf-key";
    key.innerHTML = w.etfPin + " " + w.etfKey;
    st.note.before(key);
    const again = () => schedulePins(st);
    st.chart.timeScale().subscribeVisibleLogicalRangeChange(again);
    st.chart.subscribeCrosshairMove(again);
    if (window.ResizeObserver) new ResizeObserver(again).observe(st.canvas);
    schedulePins(st);
  };
  const schedulePins = (st) => {
    if (!st.pins || st.pinFrame) return;
    st.pinFrame = requestAnimationFrame(() => { st.pinFrame = 0; placePins(st); });
  };
  const placePins = (st) => {
    const ts = st.chart.timeScale();
    const pane = st.chart.panes()[0];
    const height = pane ? pane.getHeight() : 0;
    const width = ts.width();
    for (const p of st.pinList) {
      const i = barAt(st, p.at);
      const b = i < 0 ? null : st.bars[i];
      const c = b ? b[4] : null;
      const x = c === null ? null : ts.timeToCoordinate(st.times[i]);
      if (x === null || x < 0 || x > width) { p.el.hidden = true; continue; }
      const o = b[1] === null ? c : b[1];
      const high = Math.max(b[2] === null ? c : b[2], o, c), low = Math.min(b[3] === null ? c : b[3], o, c);
      const yEdge = st.candles.priceToCoordinate(p.total >= 0 ? low : high);
      if (yEdge === null) { p.el.hidden = true; continue; }
      const y = p.total >= 0 ? yEdge + PIN_GAP : yEdge - PIN_GAP - p.size;
      if (y < 0 || y + p.size > height) { p.el.hidden = true; continue; }
      p.el.hidden = false;
      p.el.style.transform = "translate(" + Math.round(x - p.size / 2) + "px," + Math.round(y) + "px)";
      p.el.classList.toggle("kc-pin-right", x > width * 0.6);
    }
  };

  const note = (st, text) => {
    st.note.textContent = text || "";
    st.note.hidden = !text;
  };

  // One bar, as the hover box shows it. Every word comes from the page's own catalogue and every
  // figure through a formatter, so nothing here is reader-supplied text.
  const tone = (v) => (v > 0 ? "cvd-up" : v < 0 ? "cvd-down" : "");
  const money = (v) => '<b class="' + tone(v) + '">' + signed(v) + "</b>";
  const tipHtml = (st, i) => {
    const d = st.d, w = d.words, b = st.bars[i];
    const when = slotWhen(b[0], w, zone(b[0]), d.bar);
    let html = '<div class="kc-tip-when">' + (b[0] + d.bar > Date.now() ? w.filling.replace("{when}", () => when) : when) + "</div>";
    const c = b[4];
    if (c !== null) {
      const o = b[1] === null ? c : b[1];
      const cell = (label, value) => "<dt>" + label + "</dt><dd>" + value + "</dd>";
      html += '<dl class="kc-tip-ohlc">' + cell(w.tipOpen, price(o)) + cell(w.tipHigh, price(b[2] === null ? c : b[2])) +
        cell(w.tipLow, price(b[3] === null ? c : b[3])) +
        cell(w.tipClose, '<b class="' + tone(c - o) + '">' + price(c) + "</b> " + pct((c / o - 1) * 100, 2)) + "</dl>";
    }
    const row = (label, buy, sell) => "<tr><th>" + label + "</th>" + (buy === null || sell === null
      ? '<td>–</td><td>–</td><td>–</td>'
      : "<td>" + usd(buy) + "</td><td>" + usd(sell) + "</td><td>" + money(buy - sell) + "</td>") + "</tr>";
    html += "<table><thead><tr><th></th><th>" + w.tipBuys + "</th><th>" + w.tipSells + "</th><th>" + w.tipNet + "</th></tr></thead><tbody>" +
      row(w.tipFutures, b[5], b[6]);
    if (st.spot) {
      html += row(w.tipSpot, b[7], b[8]) +
        '<tr class="kc-tip-sum"><th>' + w.paneDelta + "</th><td></td><td></td><td>" + money(b[5] - b[6] + spotNet(b)) + "</td></tr>";
    }
    html += '</tbody></table><dl class="kc-tip-cvd"><dt>' + w.paneFutures + "</dt><dd>" + money(st.cvd[i]) + "</dd>" +
      (st.spot ? "<dt>" + w.paneSpot + "</dt><dd>" + money(st.spotCvd[i]) + "</dd>" : "") + "</dl>";
    return html;
  };

  // Beside the cursor, flipped to its left near the price axis and lifted near the time axis. On a
  // narrow chart a box beside the finger would cover what it is reading, so it sits in the top
  // corner away from it.
  const place = (st) => {
    const tip = st.tip, W = st.canvas.clientWidth, H = st.canvas.clientHeight;
    const tw = tip.offsetWidth, th = tip.offsetHeight, axis = 80, gap = 16;
    let x, y;
    if (W < 560) {
      x = st.at.x < W / 2 ? W - axis - tw : 6;
      y = 6;
    } else {
      x = st.at.x + gap + tw > W - axis ? st.at.x - gap - tw : st.at.x + gap;
      y = Math.min(st.at.y + gap, H - 30 - th);
    }
    tip.style.transform = "translate(" + Math.max(4, Math.round(x)) + "px," + Math.max(4, Math.round(y)) + "px)";
  };

  // Older bars, a page at a time, on the page grid. An empty page that is still inside the
  // retention is skipped past rather than taken for the end.
  const older = async (st) => {
    if (st.loading || st.done) return;
    st.loading = true;
    const w = st.d.words, page = st.d.page;
    note(st, w.older);
    try {
      for (let tries = 0; tries < 4; tries++) {
        if (st.cursor <= st.d.floor) { st.done = true; break; }
        const before = Math.ceil(st.cursor / page) * page;
        const res = await fetch(st.d.src + "&before=" + before + (st.ref ? "&ref=" + encodeURIComponent(st.ref) : ""), { credentials: "same-origin" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const body = await res.json();
        if (!st.host.isConnected) return;
        st.cursor = before - page;
        if (!st.ref && body.ref) st.ref = body.ref;
        const oldest = st.bars.length ? st.bars[0][0] : Infinity;
        // The window's first bar can be part of one (the page asks for the last N hours, not whole
        // bars): the page's whole bar replaces it.
        const whole = new Map(body.bars.map((b) => [b[0], b]));
        if (st.partial !== null && whole.has(st.partial)) {
          const i = st.bars.findIndex((b) => b[0] === st.partial);
          if (i >= 0) st.bars[i] = whole.get(st.partial);
          st.partial = null;
        }
        const fresh = body.bars.filter((b) => b[0] < oldest);
        if (fresh.length) {
          st.bars = fresh.concat(st.bars);
          redraw(st, fresh.length, 0);
          break;
        }
      }
      note(st, st.done ? w.oldest : "");
    } catch (_) {
      note(st, w.failed);
    } finally {
      st.loading = false;
    }
  };

  // A refreshed figure's bars: the newest replace or extend what is drawn. Its first bar is part of
  // one, as above, and never replaces a whole bar already held.
  const merge = (st, d) => {
    const have = new Map(st.bars.map((b, i) => [b[0], i]));
    let appended = 0;
    d.bars.forEach((b, j) => {
      const i = have.get(b[0]);
      if (i === undefined) {
        if (st.bars.length && b[0] < st.bars[st.bars.length - 1][0]) return;
        st.bars.push(b);
        appended++;
      } else if (j > 0) st.bars[i] = b;
    });
    st.d = Object.assign({}, st.d, { words: d.words, floor: d.floor });
    redraw(st, 0, appended);
  };

  const mount = async (host) => {
    host.dataset.kcOn = "1";
    const anchor = host.parentElement;
    const el = anchor && anchor.querySelector(".kc-data");
    if (!el) return;
    const d = JSON.parse(el.textContent);
    let LC;
    try { LC = await load(); } catch (_) { return; }
    if (!host.isConnected) return;
    const colors = { ink: css("--ink", "#d8d8d8"), muted: css("--muted", "#7a7a7a"), rule: css("--rule", "#242424"), band: css("--band", "#0e0e0e"), bg: css("--bg", "#000"), long: css("--long", "#5f87ff"), short: css("--short", "#ff5f5f"), accent: css("--accent", "#c8f5a8"), em: css("--em", "#b69cff") };
    host.hidden = false;
    anchor.classList.add("kc-on");
    // Looked up per label: the library can arrive before localtime.ts's script has run.
    const words = (ms) => {
      const T = window.airratesTime;
      return T ? T.fmt(ms, "md", 0, T.W, 0) : new Date(ms).toISOString().slice(5, 10);
    };
    const hm = (ms) => new Date(ms).toISOString().slice(11, 16);
    // The status line above the canvas, the canvas below it: the library sizes itself to its box.
    const bar = document.createElement("p");
    bar.className = "kc-bar dim";
    const canvas = document.createElement("div");
    canvas.className = "kc-canvas";
    host.append(bar, canvas);
    const chart = LC.createChart(canvas, {
      autoSize: true,
      layout: { background: { type: "solid", color: colors.bg }, textColor: colors.muted, fontSize: 11, fontFamily: css("--mono", "monospace"), panes: { separatorColor: colors.rule, enableResize: false } },
      grid: { vertLines: { color: colors.band }, horzLines: { color: colors.band } },
      leftPriceScale: { visible: false },
      rightPriceScale: { borderColor: colors.rule },
      timeScale: { borderColor: colors.rule, timeVisible: true, secondsVisible: false, rightOffset: 2, fixLeftEdge: true, tickMarkFormatter: (t, type) => (type <= 2 ? (type === 0 ? String(new Date(t * 1000).getUTCFullYear()) : words(t * 1000)) : hm(t * 1000)) },
      crosshair: { mode: LC.CrosshairMode.Normal, vertLine: { color: colors.muted, labelBackgroundColor: colors.rule }, horzLine: { color: colors.muted, labelBackgroundColor: colors.rule } },
      // No priceFormatter here: it would override every series' own, and the CVD is dollars.
      localization: { timeFormatter: (t) => words(t * 1000) + " " + hm(t * 1000) },
      handleScroll: { vertTouchDrag: false },
    });
    const st = {
      host, anchor, el, d, chart, colors,
      bars: d.bars.slice(),
      partial: d.bars.length ? d.bars[0][0] : null,
      cursor: d.bars.length ? d.bars[0][0] : Date.now(),
      ref: d.ref, loading: false, done: false, cvd: [], spotCvd: [], spot: null,
    };
    // Price, then one pane per CVD, then the delta. Each pane's series names itself on its axis
    // label, which is what tells the panes apart.
    const dollars = { type: "custom", formatter: signed, minMove: 1 };
    st.candles = chart.addSeries(LC.CandlestickSeries, { upColor: "rgba(0,0,0,0)", downColor: colors.ink, borderUpColor: colors.ink, borderDownColor: colors.ink, wickUpColor: colors.ink, wickDownColor: colors.ink, priceLineColor: colors.muted });
    st.line = chart.addSeries(LC.LineSeries, { color: colors.accent, lineWidth: 2, title: d.words.paneFutures, priceLineVisible: false, crosshairMarkerVisible: false, priceFormat: dollars }, 1);
    if (d.spot) st.spot = chart.addSeries(LC.LineSeries, { color: colors.em, lineWidth: 2, title: d.words.paneSpot, priceLineVisible: false, crosshairMarkerVisible: false, priceFormat: dollars }, 2);
    st.net = chart.addSeries(LC.HistogramSeries, { title: d.words.paneDelta, priceLineVisible: false, priceFormat: dollars }, d.spot ? 3 : 2);
    const panes = chart.panes();
    panes.forEach((pane, i) => pane.setStretchFactor(i === 0 ? 3 : 1));
    st.note = document.createElement("span");
    st.note.className = "kc-note";
    st.note.hidden = true;
    const hint = document.createElement("span");
    hint.className = "kc-hint";
    hint.textContent = d.words.hint;
    bar.append(st.note, hint);
    draw(st);
    const n = st.bars.length;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - d.count) - 0.5, to: n - 1 + 2 });
    chart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r && r.from < 30) older(st); });
    st.canvas = canvas;
    st.at = { x: 0, y: 0 };
    st.tip = document.createElement("div");
    st.tip.className = "kc-tip";
    st.tip.hidden = true;
    canvas.append(st.tip);
    pinsInit(st);
    // The pointer's place on the canvas, across every pane: the library's own point is per pane.
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      st.at = { x: e.clientX - r.left, y: e.clientY - r.top };
    }, { passive: true });
    chart.subscribeCrosshairMove((p) => {
      const i = p && p.point && p.logical !== undefined ? Math.round(p.logical) : -1;
      if (i < 0 || i >= st.bars.length) { st.tip.hidden = true; return; }
      st.tip.innerHTML = tipHtml(st, i);
      st.tip.hidden = false;
      place(st);
    });
    canvas.addEventListener("pointerleave", () => { st.tip.hidden = true; });
    // The share card's picture of this chart (share.ts): the same bars, panes and scales, drawn at the
    // card's shape (w × h CSS pixels) rather than the screen's, which on a phone is taller than wide.
    // The chart is resized for the one synchronous repaint and handed back to its box straight after,
    // under the share dialog's backdrop; the bars in view are kept across both. Its box clips it
    // (.kc-canvas, overflow:hidden): a phone browser that saw the page grow 980px wide for that moment
    // kept the wider layout, and the share dialog opened half off the screen.
    host.kcShot = (w, h) => {
      const ts = chart.timeScale(), r = ts.getVisibleLogicalRange();
      chart.applyOptions({ autoSize: false });
      chart.resize(Math.round(w), Math.round(h), true);
      if (r) ts.setVisibleLogicalRange(r);
      chart.resize(Math.round(w), Math.round(h), true);
      const shot = chart.takeScreenshot();
      chart.applyOptions({ autoSize: true });
      if (r) ts.setVisibleLogicalRange(r);
      return shot;
    };
    charts.add(st);
  };

  const scan = () => {
    for (const st of charts) {
      if (!st.host.isConnected) { st.chart.remove(); charts.delete(st); continue; }
      const el = st.anchor.querySelector(".kc-data");
      if (el && el !== st.el) { st.el = el; merge(st, JSON.parse(el.textContent)); }
    }
    for (const host of document.querySelectorAll("[data-kc]:not([data-kc-on])")) mount(host);
  };
  scan();
  new MutationObserver(scan).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
  // The masthead clock moved between the reader's zone and UTC: every bar moves with it.
  addEventListener("airrates:clock", () => { for (const st of charts) redraw(st, 0, 0); });
})();`;
