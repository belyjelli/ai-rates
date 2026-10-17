import type { AssetClass } from "@ai-rates/core";
import type {
  GammaData,
  Overview,
  WhaleCandle,
  WhaleData,
  WhaleMarket,
  WhaleTrade,
  WhaleWall,
} from "../app/data";
import {
  WHALE_INTERVAL_KEYS,
  WHALE_INTERVALS,
  WHALE_VENUES,
  type WhaleParams,
  type WhaleVenue,
  whaleToQuery,
} from "../app/params";
import { ageText, esc, formatPrice, formatUsd, since } from "./format";
import { freshness, gammaZones, publisher, signedUsd, unitSymbol } from "./gamma";
import { helpButton, helpHeading, helpPanel } from "./help";
import { tr } from "./i18n";
import { icon } from "./icons";
import { layout } from "./layout";
import { timeTag, timeTitle, zoneTag } from "./localtime";
import { assetKey, assetName } from "./pages";
import { PICK_SCRIPT } from "./picker";
import {
  SLOT_BAND,
  SLOT_CURSOR,
  SLOT_HAIR,
  SLOT_SCRIPT,
  slotCursorSwitch,
  slotData,
  type WhaleCandleSlots,
} from "./slot-chart";

/**
 * /whales: large resting limit orders ("walls") drawn as lines over the price, and the large taker
 * trades in the same markets drawn as circles, on Binance USD-M or Hyperliquid (?venue=).
 *
 * WHAT A LINE IS. One price level in Binance's book that held at least the market's floor for at
 * least a minute, from when the collector first saw it to when it went (or now). The collector keeps
 * live books for the top 40 markets by worldwide open interest and writes walls, never books
 * (profitlock-worker collector/internal/walls, migration 029). Thickness is size; a line that ends
 * is filled (the market reached it) or pulled (cancelled while the market was elsewhere).
 *
 * WHAT A CIRCLE IS. One taker burst: every fill on one side in the same millisecond, so a market
 * order that sweeps several levels is one circle (collector internal/walls/trades.go, migration
 * 030). Only bursts of at least the market's wall floor are kept; the page draws the 200 largest in
 * the window. Area is size, blue a buy and red a sell, by the taker's side.
 *
 * ON HYPERLIQUID a line is a rounded price BUCKET proven to hold a whale order: Hyperliquid publishes
 * only its 20 nearest buckets a side, each with an order count, and a bucket whose average order is at
 * least the floor has one order at least that big (collector internal/walls/buckets.go, migration
 * 031). Its trades name their taker, so a circle there is one account's order, address shown.
 *
 * WHAT IT IS NOT. A forecast, or a floor or ceiling: a wall can be pulled the moment price nears it,
 * and the page says so. It is one venue's book, not the market's. And it starts blind to far levels
 * after every collector restart, until they change; the help panel says that too.
 */

const MINUS = "−";

/** Each venue's name as the page shows it. */
const VENUE_NAMES: Record<WhaleVenue, string> = { binance: "Binance", hyperliquid: "Hyperliquid" };

export function whaleVenueName(venue: WhaleVenue): string {
  return VENUE_NAMES[venue];
}

/** Hyperliquid's own explorer, for a taker's address. */
export const explorerAddress = (address: string) =>
  `https://app.hyperliquid.xyz/explorer/address/${encodeURIComponent(address)}`;

/** "0x2025…840e". */
export const shortAddress = (address: string) =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

/** Drops float noise from a bucket edge (0.0853 + 0.0001 is 0.08539999999999999). */
const edge = (value: number) => Number(value.toPrecision(12));

/**
 * A wall's price as the page writes it: the level on an exact book, the bucket's range on a rounded
 * one (bids round down, so a bid at P covers P to P + step; asks round up, P - step to P).
 */
function wallPrice(wall: WhaleWall, step: number | null): string {
  if (!step) return formatPrice(wall.price);
  return wall.side === "bid"
    ? `${formatPrice(wall.price)}–${formatPrice(edge(wall.price + step))}`
    : `${formatPrice(edge(wall.price - step))}–${formatPrice(wall.price)}`;
}

/** A bucket's width as prose: "$100", "$0.0001". */
const stepText = (step: number | null) =>
  step === null
    ? "–"
    : `$${step.toLocaleString("en-US", { maximumSignificantDigits: 6, maximumFractionDigits: 12 })}`;

/** Where a wall is drawn: its level, or the middle of its bucket. */
function wallY(wall: WhaleWall, step: number | null): number {
  if (!step) return wall.price;
  return wall.side === "bid" ? wall.price + step / 2 : wall.price - step / 2;
}

/** The least the largest order in a rounded bucket holds: its average. */
const provenUsd = (wall: WhaleWall) =>
  wall.orders && wall.orders > 0 ? wall.current_usd / wall.orders : null;

/** The page's address for an asset: the bare /whales for BTC, else /whales/<asset> (or its class). */
export function whalesPath(asset: string, assetClass: AssetClass): string {
  if (asset === "BTC" && assetClass === "crypto") return "/whales";
  return assetClass === "crypto"
    ? `/whales/${encodeURIComponent(asset)}`
    : `/whales/${assetClass}/${encodeURIComponent(asset)}`;
}

function signedPct(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "–";
  return `${value < 0 ? MINUS : "+"}${Math.abs(value).toFixed(digits)}%`;
}

const sideLabel = (side: WhaleWall["side"]) => (side === "bid" ? tr("bid") : tr("ask"));

function statusLabel(status: WhaleWall["status"]): string {
  switch (status) {
    case "open":
      return tr("resting");
    case "filled":
      return tr("filled");
    case "pulled":
      return tr("pulled");
    default:
      return tr("lost track");
  }
}

/** A wall's size for drawing and ranking: what it holds now if open, its peak if it ended. */
const wallUsd = (wall: WhaleWall) => (wall.status === "open" ? wall.current_usd : wall.peak_usd);

const takerLabel = (side: WhaleTrade["side"]) =>
  side === "buy" ? tr("taker buy") : tr("taker sell");

const fillsText = (fills: number) => (fills === 1 ? tr("one fill") : tr("{n} fills", { n: fills }));

function durationText(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return tr("{n}m", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return tr("{h}h {m}m", { h: hours, m: String(minutes % 60).padStart(2, "0") });
  return tr("{d}d {h}h", { d: Math.floor(hours / 24), h: hours % 24 });
}

/**
 * THE GEX SWITCH (2026-10-18): the asset's option book drawn over the candles, off until a reader
 * turns it on -- the Gamma Exposure tab's three views (web/gamma.ts) laid on the price axis. Bars at
 * the right edge are each strike's gamma exposure, calls and puts or the two netted; zones shade the
 * prices where dealers would be short gamma or long it were the price to move there; the flip and
 * the call and put walls are lines across. All expiries, as the tab opens.
 *
 * ONLY WHERE IT FITS. A ticker with a book of its own (gammaBookFor: BTC, ETH, NVDA, MU among the
 * tracked markets on 2026-10-18), not too old to show (gamma.ts freshness), and with the book's spot
 * within GEX_SPOT_GAP of the perp's last price: a book quoting some other unit would put every strike
 * at the wrong height, so it is left out rather than drawn wrong.
 */
const GEX_SPOT_GAP = 0.05;
const GEX_MODES = ["off", "split", "net", "zones"] as const;
/** The widest bar, in the plot's thousandths: the right quarter or so, clear of the candles' middle. */
const GEX_BAR_REACH = 280;

export function gexFits(gamma: GammaData, last: number | null, now: number): boolean {
  const e = gamma.exposure;
  return (
    e !== null &&
    gamma.strikes.length > 0 &&
    last !== null &&
    last > 0 &&
    Math.abs(e.spot / last - 1) <= GEX_SPOT_GAP &&
    freshness(e.source, e.computed_at, now) !== "dead"
  );
}

function gexSwitch(): string {
  const words: Record<(typeof GEX_MODES)[number], [string, string]> = {
    off: [tr("off"), tr("Hide the options book")],
    split: [tr("calls/puts"), tr("Each strike's call and put gamma, as bars at the right edge")],
    net: [tr("net"), tr("One bar per strike: its calls and puts added")],
    zones: [
      tr("zones"),
      tr("Net bars, with the prices shaded where dealers would be short gamma or long it"),
    ],
  };
  const buttons = GEX_MODES.map(
    (mode) =>
      `<button type="button" class="whx-mode" data-whgex="${mode}" aria-pressed="${mode === "off"}" title="${esc(words[mode][1])}">${words[mode][0]}</button>`,
  ).join("");
  return `<div class="slot-modes whx-modes" role="group" aria-label="${esc(tr("Gamma Exposure"))}" hidden><span>GEX</span>${buttons}</div>`;
}

function gexOverlay(
  gamma: GammaData,
  y: (price: number) => number,
  lo: number,
  hi: number,
  now: number,
): { under: string; over: string; labels: string; keys: string } {
  const e = gamma.exposure as NonNullable<GammaData["exposure"]>;
  const sym = unitSymbol(e.unit);
  const money = (usd: number) => (usd === 0 ? `${sym}0` : signedUsd(usd, sym));
  const visible = gamma.strikes.filter((k) => k.strike >= lo && k.strike <= hi);
  // Bar thickness from the tightest gap between drawn strikes, so neighbours never overlap.
  const ys = visible.map((k) => y(k.strike)).sort((a, b) => a - b);
  let gap = 60;
  for (let i = 1; i < ys.length; i++)
    gap = Math.min(gap, (ys[i] as number) - (ys[i - 1] as number));
  const thick = Math.min(40, Math.max(3, gap * 0.7));
  const peakSide = Math.max(
    1,
    ...visible.map((k) => Math.max(Math.abs(k.call_gex_usd), Math.abs(k.put_gex_usd))),
  );
  const peakNet = Math.max(1, ...visible.map((k) => Math.abs(k.call_gex_usd + k.put_gex_usd)));
  const bar = (
    cls: string,
    top: number,
    height: number,
    usd: number,
    peak: number,
    tip: string,
  ) => {
    const width = Math.max(2, (Math.abs(usd) / peak) * GEX_BAR_REACH);
    return `<rect class="${cls}" x="${(1000 - width).toFixed(1)}" y="${top.toFixed(2)}" width="${width.toFixed(1)}" height="${height.toFixed(2)}"><title>${esc(tip)}</title></rect>`;
  };
  const split: string[] = [];
  const net: string[] = [];
  for (const k of visible) {
    const sy = y(k.strike);
    const sum = k.call_gex_usd + k.put_gex_usd;
    const tip = tr("Strike {strike} · calls {calls} · puts {puts} · net {net} per 1% move", {
      strike: formatPrice(k.strike),
      calls: money(k.call_gex_usd),
      puts: money(k.put_gex_usd),
      net: money(sum),
    });
    split.push(bar("whx-call", sy - thick / 2, thick / 2, k.call_gex_usd, peakSide, tip));
    split.push(bar("whx-put", sy, thick / 2, k.put_gex_usd, peakSide, tip));
    net.push(bar(sum >= 0 ? "whx-call" : "whx-put", sy - thick / 2, thick, sum, peakNet, tip));
  }
  const zones = gammaZones(gamma.curve, lo, hi)
    .map(
      (z) =>
        `<rect class="${z.short ? "whx-zs" : "whx-zl"}" x="0" width="1000" y="${y(z.to).toFixed(2)}" height="${(y(z.from) - y(z.to)).toFixed(2)}"><title>${esc(z.short ? tr("short gamma") : tr("long gamma"))}</title></rect>`,
    )
    .join("");
  // The three levels the tab names, as lines across where they fall on the chart.
  const levels: [number | null, string, string][] = [
    [e.flip_price, "whx-flip", tr("flip {price}")],
    [e.call_wall, "whx-cw", tr("call wall {price}")],
    [e.put_wall, "whx-pw", tr("put wall {price}")],
  ];
  const marks = levels.flatMap(([price, cls, text]) =>
    price !== null && price >= lo && price <= hi ? [[price, cls, text] as const] : [],
  );
  const markLines = marks
    .map(
      ([price, cls]) =>
        `<line class="${cls}" x1="0" x2="1000" y1="${y(price).toFixed(2)}" y2="${y(price).toFixed(2)}"></line>`,
    )
    .join("");
  const labels = marks
    .map(
      ([price, cls, text]) =>
        `<span class="whx whx-on whx-lbl ${cls}-t" style="top:${(y(price) / 10).toFixed(2)}%">${text.replace("{price}", formatPrice(price))}</span>`,
    )
    .join("");
  const level = (price: number | null) => (price === null ? "–" : formatPrice(price));
  const keys = `<span class="whx whx-split"><i class="whx-key-call"></i>${tr("call gamma")}</span><span class="whx whx-split"><i class="whx-key-put"></i>${tr("put gamma")}</span><span class="whx whx-net"><i class="whx-key-call"></i>${tr("Net long")}</span><span class="whx whx-net"><i class="whx-key-put"></i>${tr("Net short")}</span><span class="whx whx-zone"><i class="whx-key-zs"></i>${tr("short gamma")}</span><span class="whx whx-zone"><i class="whx-key-zl"></i>${tr("long gamma")}</span><span class="whx whx-on dim">${tr("{source} options, all expiries, {age}", { source: esc(publisher(e.source).name), age: ageText(e.computed_at, now) })} · ${tr("flip {flip} · call wall {call} · put wall {put}", { flip: level(e.flip_price), call: level(e.call_wall), put: level(e.put_wall) })}</span>`;
  return {
    under: `<g class="whx whx-zone">${zones}</g>`,
    over: `<g class="whx whx-split">${split.join("")}</g><g class="whx whx-net">${net.join("")}</g><g class="whx whx-on">${markLines}</g>`,
    labels,
    keys,
  };
}

/**
 * The GEX switch's browser half, as gamma.ts GX_VIEW_SCRIPT: the choice is kept in localStorage and
 * set on <html> as data-whgex, which the CSS reads, so the chart a live refresh brings in is drawn the
 * same way; each new copy of the switch arrives hidden and is set to the reader's choice.
 */
export const GEX_SCRIPT = `(() => {
  if (window.airratesWhaleGex) return;
  window.airratesWhaleGex = true;
  const modes = ${JSON.stringify(GEX_MODES)};
  let mode = "off";
  try { const kept = localStorage.getItem("whale-gex"); if (modes.includes(kept)) mode = kept; } catch (_) {}
  const sync = () => {
    document.documentElement.dataset.whgex = mode;
    for (const group of document.querySelectorAll(".whx-modes")) {
      group.hidden = false;
      for (const button of group.querySelectorAll(".whx-mode")) {
        const on = String(button.dataset.whgex === mode);
        if (button.getAttribute("aria-pressed") !== on) button.setAttribute("aria-pressed", on);
      }
    }
  };
  sync();
  new MutationObserver(() => {
    if (document.querySelector('.whx-modes[hidden], .whx-mode[aria-pressed="true"]:not([data-whgex="' + mode + '"])')) sync();
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    const button = event.target.closest ? event.target.closest(".whx-mode") : null;
    if (!button || !modes.includes(button.dataset.whgex)) return;
    mode = button.dataset.whgex;
    try { localStorage.setItem("whale-gex", mode); } catch (_) {}
    sync();
  });
})();`;

function whaleChart(data: {
  label: string;
  /** "Binance", or "Hyperliquid xyz:GOLD" for a HIP-3 market. */
  venueLabel: string;
  step: number | null;
  candles: readonly WhaleCandle[];
  walls: readonly WhaleWall[];
  trades: readonly WhaleTrade[];
  params: WhaleParams;
  /** The asset's option book, when it has one fit to draw (see gexFits); null leaves the switch out. */
  gamma: GammaData | null;
  now: number;
}): string {
  const { label, venueLabel, step, candles, walls, trades, params, gamma, now } = data;
  const { hours, barMinutes } = WHALE_INTERVALS[params.interval];
  // Bars on whole multiples of their length, as the query folds them, the last one still filling:
  // the same slots the hover reads, so a slot is always one candle.
  const barMs = barMinutes * 60_000;
  const count = Math.round((hours * 60) / barMinutes);
  const current = Math.floor(now / barMs) * barMs;
  const fromMs = current - (count - 1) * barMs;
  const toMs = current + barMs;
  const span = toMs - fromMs;
  const x = (ms: number) => ((Math.min(Math.max(ms, fromMs), toMs) - fromMs) / span) * 1000;
  const slotOf = (ms: number) => Math.floor((ms - fromMs) / barMs);

  // THE CANDLES SET THE PRICE AXIS (2026-10-16). It used to stretch to take in walls up to half the
  // candles' range away, which left the candles a strip along one edge and the chart reading as a
  // stack of lines (a reader's words: "the bars do little, give it a K-line"). Now the axis is the
  // candles' own range with a margin, walls inside it are drawn over them, and the largest beyond it
  // are named at the top and bottom edges instead.
  const inView = candles.filter((c) => c.open_time.getTime() >= fromMs);
  let lo = Math.min(...inView.map((c) => c.low));
  let hi = Math.max(...inView.map((c) => c.high));
  const lastClose = inView.at(-1)?.close ?? hi;
  const pad = Math.max((hi - lo) * 0.08, lastClose * 0.002);
  lo -= pad;
  hi += pad;
  const y = (price: number) => 1000 - ((price - lo) / (hi - lo)) * 1000;
  const live = walls.filter((w) => params.pulled || w.status !== "pulled");
  const drawn = live.filter((w) => wallY(w, step) >= lo && wallY(w, step) <= hi);
  const beyond = live.filter(
    (w) => w.status === "open" && (wallY(w, step) < lo || wallY(w, step) > hi),
  );

  const slot = 1000 / count;
  const volumes = new Array<number>(count).fill(0);
  const body = inView
    .map((c) => {
      const i = slotOf(c.open_time.getTime());
      volumes[i] = c.volume_usd ?? 0;
      const cx = (i + 0.5) * slot;
      const up = c.close >= c.open;
      const top = y(Math.max(c.open, c.close));
      const height = Math.max(Math.abs(y(c.open) - y(c.close)), 1.5);
      return `<line class="wh-wick" x1="${cx.toFixed(2)}" x2="${cx.toFixed(2)}" y1="${y(c.high).toFixed(2)}" y2="${y(c.low).toFixed(2)}"></line><rect class="${up ? "wh-up" : "wh-down"}" x="${(cx - slot * 0.36).toFixed(2)}" y="${top.toFixed(2)}" width="${(slot * 0.72).toFixed(2)}" height="${height.toFixed(2)}"></rect>`;
    })
    .join("");

  const biggest = Math.max(...drawn.map(wallUsd), 1);
  const lines = drawn
    .map((w) => {
      const start = w.first_seen.getTime();
      const end = w.status === "open" ? toMs : (w.ended_at?.getTime() ?? w.last_seen.getTime());
      if (end < fromMs) return "";
      const usd = wallUsd(w);
      // Width in screen pixels (non-scaling stroke): 1px for the smallest drawn, 5px for the largest.
      const width = 1 + 4 * Math.sqrt(usd / biggest);
      const proven = provenUsd(w);
      const tip = tr("{side} wall {price} · {size} · {status} · {lived}", {
        side: sideLabel(w.side),
        price: wallPrice(w, step),
        size:
          w.orders && proven !== null
            ? tr("{size} in {n} orders, one at least {proven}", {
                size: formatUsd(usd),
                n: w.orders,
                proven: formatUsd(proven),
              })
            : formatUsd(usd),
        status: statusLabel(w.status),
        lived: durationText(end - start),
      });
      const py = y(wallY(w, step)).toFixed(2);
      return `<line class="wh-wall wh-${w.side} wh-${w.status}" x1="${x(start).toFixed(2)}" x2="${x(end).toFixed(2)}" y1="${py}" y2="${py}" style="stroke-width:${width.toFixed(2)}px"><title>${esc(tip)}</title></line>`;
    })
    .join("");

  // Taker bursts as circles, in HTML rather than the SVG: the plot stretches to its box
  // (preserveAspectRatio none), which would draw an SVG circle as an ellipse. Area is size, the
  // biggest in view 22px across; the biggest are laid first so smaller ones stay on top to hover.
  // Each is also counted into its candle, for the hover reading.
  const bursts = Array.from({ length: count }, () => [0, 0, 0, 0]);
  for (const t of trades) {
    const i = slotOf(t.traded_at.getTime());
    const tally = bursts[i];
    if (!tally) continue;
    if (t.side === "buy") {
      tally[0] = (tally[0] ?? 0) + t.notional_usd;
      tally[2] = (tally[2] ?? 0) + 1;
    } else {
      tally[1] = (tally[1] ?? 0) + t.notional_usd;
      tally[3] = (tally[3] ?? 0) + 1;
    }
  }
  const shown = trades.filter(
    (t) => t.traded_at.getTime() >= fromMs && t.price >= lo && t.price <= hi,
  );
  const biggestTrade = Math.max(...shown.map((t) => t.notional_usd), 1);
  const circles = [...shown]
    .sort((a, b) => b.notional_usd - a.notional_usd)
    .map((t) => {
      const across = 5 + 17 * Math.sqrt(t.notional_usd / biggestTrade);
      const template =
        tr("{side} {size} at {price} · {fills} · {time}", {
          side: takerLabel(t.side),
          size: formatUsd(t.notional_usd),
          price: formatPrice(t.price),
          fills: fillsText(t.fills),
          time: "{t}",
        }) + (t.taker ? ` · ${tr("taker {address}", { address: shortAddress(t.taker) })}` : "");
      return `<span class="wh-trade wh-${t.side}" style="left:${(x(t.traded_at.getTime()) / 10).toFixed(2)}%;top:${(y(t.price) / 10).toFixed(2)}%;width:${across.toFixed(1)}px;height:${across.toFixed(1)}px"${timeTitle(t.traded_at.getTime(), "when", template)}></span>`;
    })
    .join("");

  const last = inView.at(-1)?.close ?? null;
  const lastLine =
    last === null
      ? ""
      : `<line class="wh-last" x1="0" x2="1000" y1="${y(last).toFixed(2)}" y2="${y(last).toFixed(2)}"></line>`;

  // Labels for the biggest open walls on the chart, at the right edge, nearest-first so they do not
  // overlap; and the biggest beyond it, named at the edge they lie past.
  const labelled: number[] = [];
  const rightLabels = drawn
    .filter((w) => w.status === "open")
    .sort((a, b) => wallUsd(b) - wallUsd(a))
    .slice(0, 8)
    .map((w) => {
      const top = (y(wallY(w, step)) / 1000) * 100;
      if (labelled.some((t) => Math.abs(t - top) < 4.5)) return "";
      labelled.push(top);
      // A bucket is labelled at its middle, marked approximate: its range is in the tooltip.
      const at = step ? `~${formatPrice(wallY(w, step))}` : formatPrice(w.price);
      return `<span class="wh-yr wh-${w.side}-t" style="top:${top.toFixed(2)}%">${formatUsd(wallUsd(w))} ${at}</span>`;
    })
    .join("");
  const edge = (above: boolean) => {
    const list = beyond
      .filter((w) => wallY(w, step) > hi === above)
      .sort((a, b) => wallUsd(b) - wallUsd(a))
      .slice(0, 3)
      .map((w) => {
        const price = wallY(w, step);
        const pct = last
          ? ` <span class="dim">${signedPct((price / last - 1) * 100, 1)}</span>`
          : "";
        return `<span class="wh-${w.side}-t">${formatUsd(wallUsd(w))} ${step ? "~" : ""}${formatPrice(price)}${pct}</span>`;
      });
    return list.length === 0
      ? ""
      : `<p class="wh-edge wh-edge-${above ? "top" : "bottom"}">${icon(above ? "up" : "down")} ${tr("off the chart:")} ${list.join(" · ")}</p>`;
  };

  const gex = gamma ? gexOverlay(gamma, y, lo, hi, now) : null;

  const gridLines = [0.1, 0.37, 0.63, 0.9];
  const grid = gridLines
    .map((f) => `<line class="cvd-grid" x1="0" x2="1000" y1="${f * 1000}" y2="${f * 1000}"></line>`)
    .join("");
  const leftLabels = gridLines
    .map(
      (f) =>
        `<span class="cvd-yl" style="top:${(f * 100).toFixed(2)}%">${formatPrice(Number((hi - f * (hi - lo)).toPrecision(5)))}</span>`,
    )
    .join("");

  const tickHours = hours <= 8 ? 1 : hours <= 24 ? 4 : hours <= 96 ? 24 : 48;
  const tickMs = tickHours * 3_600_000;
  const xLabels: string[] = [];
  for (let ms = Math.ceil(fromMs / tickMs) * tickMs; ms < toMs; ms += tickMs) {
    const midnight = new Date(ms).getUTCHours() === 0;
    // In the reader's zone once the page script has run (localtime.ts); UTC until then.
    xLabels.push(
      `<span class="cvd-x${midnight ? " cvd-day" : ""}${xLabels.length % 2 ? " x-alt" : ""}" style="left:${(((ms - fromMs) / span) * 100).toFixed(2)}%">${timeTag(ms, "tick", tickHours)}</span>`,
    );
  }

  // The volume strip under the candles, in the venue's own quote volume, coloured by the candle.
  const volPeak = Math.max(1, ...volumes);
  const volBars = inView
    .map((c) => {
      const i = slotOf(c.open_time.getTime());
      const v = c.volume_usd ?? 0;
      if (!(v > 0)) return "";
      const h = (v / volPeak) * 1000;
      return `<rect class="${c.close >= c.open ? "wh-up" : "wh-down"} wh-vol" x="${(i * slot + slot * 0.14).toFixed(2)}" y="${(1000 - h).toFixed(1)}" width="${(slot * 0.72).toFixed(2)}" height="${h.toFixed(1)}"></rect>`;
    })
    .join("");

  const title =
    barMinutes >= 60
      ? tr("{asset} · {venue} perp · {n}-hour candles, {zone}", {
          asset: label,
          venue: venueLabel,
          n: barMinutes / 60,
          zone: zoneTag(),
        })
      : tr("{asset} · {venue} perp · {n}-minute candles, {zone}", {
          asset: label,
          venue: venueLabel,
          n: barMinutes,
          zone: zoneTag(),
        });
  const keys = `<div class="fchart-keys wh-keys"><span><i class="wh-key-bid"></i>${tr("bid wall (buy orders)")}</span><span><i class="wh-key-ask"></i>${tr("ask wall (sell orders)")}</span><span><i class="wh-key-ended"></i>${tr("faded: filled or pulled")}</span><span><i class="wh-key-buy"></i>${tr("large taker buy")}</span><span><i class="wh-key-sell"></i>${tr("large taker sell")}</span><span><i class="wh-key-last"></i>${tr("last price")}</span>${gex?.keys ?? ""}${gex ? gexSwitch() : ""}${slotCursorSwitch()}</div>`;

  // The hover reading: one candle's open, high, low and close, its volume, and the large taker
  // bursts inside it (slot-chart.ts, kind "wcandle").
  const candleSlots: WhaleCandleSlots["slots"] = new Array(count).fill(null);
  for (const c of inView) {
    const i = slotOf(c.open_time.getTime());
    const b = bursts[i] ?? [0, 0, 0, 0];
    candleSlots[i] = [
      c.open,
      c.high,
      c.low,
      c.close,
      Math.round(c.volume_usd ?? 0),
      Math.round(b[0] ?? 0),
      Math.round(b[1] ?? 0),
      b[2] ?? 0,
      b[3] ?? 0,
    ];
  }
  const payload = slotData({ kind: "wcandle", from: fromMs, unit: barMs, slots: candleSlots });
  const lastCandle = inView.at(-1);
  const idle = lastCandle
    ? `${tr("last {price}", { price: formatPrice(lastCandle.close) })} · ${tr("hover or tap a candle to read it")}`
    : tr("hover or tap a candle to read it");
  const axes = esc(JSON.stringify({ l: ["price", lo, hi] }));

  return `<figure class="fchart cvd-chart wh-chart" data-live="wh-chart" data-cursors>
<div class="fchart-head"><p class="fchart-title">${title}</p>${keys}<p class="fchart-read slot-read" aria-live="polite">${idle}</p></div>
${edge(true)}
<div class="slot-area" tabindex="0" role="group" aria-label="${esc(tr("{asset} candles; arrow keys read one at a time", { asset: label.replace(/<[^>]+>/g, "") }))}">
<div class="fchart-plot wh-plot" data-axes="${axes}">
<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(title.replace(/<[^>]+>/g, ""))}">${gex?.under ?? ""}${grid}${SLOT_BAND}${lines}${body}${gex?.over ?? ""}${lastLine}${SLOT_CURSOR}${SLOT_HAIR}</svg>
${circles}${leftLabels}${rightLabels}${gex?.labels ?? ""}
</div>
<div class="fchart-plot wh-volume" data-axes="${esc(JSON.stringify({ l: ["amount", 0, volPeak] }))}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{asset} volume per candle", { asset: label.replace(/<[^>]+>/g, "") }))}">${SLOT_BAND}${volBars}${SLOT_CURSOR}${SLOT_HAIR}</svg><span class="cvd-yl" style="top:0%">${formatUsd(volPeak)}</span>${xLabels.join("")}</div>
</div>
${edge(false)}
${payload}
</figure>`;
}

/**
 * The market picker: the current market as a button, and every tracked market in a panel under it,
 * each with what a reader picks one by: price and its day, the walls resting each side (and which
 * outweighs the other), and the last day's large-trade flow. Plain links in a <details>, so it works
 * without the script; PICK_SCRIPT (picker.ts) adds the filter box, arrow keys, Escape and click-away.
 */
function marketPicker(data: {
  markets: readonly WhaleMarket[];
  current: WhaleMarket | null;
  asset: string;
  assetClass: AssetClass;
  params: WhaleParams;
}): string {
  const { markets, current, asset, assetClass, params } = data;
  if (markets.length === 0) return "";
  const change = (pct: number | null) =>
    pct === null
      ? `<span class="num dim">–</span>`
      : `<span class="num ${pct >= 0 ? "cvd-up" : "cvd-down"}">${signedPct(pct)}</span>`;
  const flow = (m: WhaleMarket) => {
    const net = m.buy_usd_24h - m.sell_usd_24h;
    if (m.buy_usd_24h + m.sell_usd_24h === 0) return `<span class="num dim">–</span>`;
    return `<span class="num ${net >= 0 ? "cvd-up" : "cvd-down"}">${net < 0 ? MINUS : "+"}${formatUsd(Math.abs(net))}</span>`;
  };
  const book = (m: WhaleMarket) => {
    const total = m.bid_walls_usd + m.ask_walls_usd;
    if (total === 0) return `<span class="wh-pick-book dim">${tr("no walls")}</span>`;
    const bidShare = (m.bid_walls_usd / total) * 100;
    return `<span class="wh-pick-book"><span class="wh-pick-bar" title="${esc(tr("{bid} bid · {ask} ask", { bid: formatUsd(m.bid_walls_usd), ask: formatUsd(m.ask_walls_usd) }))}"><i class="wh-pick-bid" style="width:${bidShare.toFixed(1)}%"></i><i class="wh-pick-ask" style="width:${(100 - bidShare).toFixed(1)}%"></i></span><span class="wh-pick-sum"><span class="cvd-up">${formatUsd(m.bid_walls_usd)}</span> / <span class="cvd-down">${formatUsd(m.ask_walls_usd)}</span></span></span>`;
  };
  // assetName tags a non-crypto class itself; a HIP-3 market also shows its own name (xyz:GOLD).
  const name = (m: WhaleMarket) => {
    const native = m.venue_symbol.includes(":") ? `<small>${esc(m.venue_symbol)}</small>` : "";
    return `<b>${assetName(m.base, m.asset_class)}</b>${native}`;
  };
  const rows = markets
    .map((m) => {
      const on = m.base === asset && m.asset_class === assetClass;
      const href = esc(whalesPath(m.base, m.asset_class) + whaleToQuery(params));
      const words = `${m.base} ${m.venue_symbol} ${m.asset_class}`.toLowerCase();
      return `<a class="wh-pick-row${on ? " on" : ""}" href="${href}" data-q="${esc(words)}" data-k="${esc(assetKey(m.base, m.asset_class))}"${on ? ' aria-current="page"' : ""}>
<span class="wh-pick-sym"><span class="dim">${m.rank}</span>${name(m)}</span>
<span class="num">${formatPrice(m.last_price)}</span>
${change(m.change_24h_pct)}
${book(m)}
${flow(m)}
</a>`;
    })
    .join("");
  const label = assetName(asset, assetClass);
  const summary = current
    ? `<b>${label}</b><span class="num">${formatPrice(current.last_price)}</span>${change(current.change_24h_pct)}`
    : `<b>${label}</b>`;
  return `<details class="wh-pick">
<summary class="wh-pick-btn" aria-label="${esc(tr("Pick a market"))}">${summary}<span class="wh-pick-more dim">${tr("{n} markets", { n: markets.length })}</span></summary>
<div class="wh-pick-panel">
<input class="wh-pick-q" type="search" placeholder="${esc(tr("Filter markets"))}" aria-label="${esc(tr("Filter markets"))}" autocomplete="off" hidden>
<div class="wh-pick-head" aria-hidden="true"><span>${tr("Market")}</span><span class="num">${tr("Price")}</span><span class="num">24h</span><span>${tr("Walls resting, bid / ask")}</span><span class="num" title="${esc(tr("Large taker buys minus sells, last 24 hours"))}">${tr("Whale flow 24h")}</span></div>
<nav class="wh-pick-list" aria-label="${tr("Markets")}">${rows}</nav>
<p class="wh-pick-none dim" hidden>${tr("No market matches.")}</p>
</div>
</details>`;
}

/**
 * The three tables (resting now, ended, largest trades) are ONE element with two shapes. On a phone
 * it is what it always was: three headed tables in the page, under the chart. On a desktop it is a
 * wide panel that drops from a button beside the market picker, the tables side by side and each
 * scrolling on its own, so sixty rows no longer push the page three screens long under the chart.
 *
 * One copy of the rows, not one per shape: live refresh matches regions by name and would have two
 * of each to write. The panel is a `popover`, which the button opens with no script and which CSS is
 * free to leave in the page instead: layout.ts shows it in place under 861px, and wherever the
 * browser has no popovers. This script only puts the open panel under the controls row, as wide as
 * the row and no taller than the screen below it. It is absolute rather than fixed, so it scrolls
 * with the page like the picker's panel beside it.
 */
export const BOOK_SCRIPT = `(() => {
  if (!("popover" in HTMLElement.prototype)) return;
  const wide = matchMedia("(min-width: 861px)");
  const book = () => document.getElementById("wh-book");
  const place = (p) => {
    const row = document.querySelector(".wh-controls");
    if (!row) return;
    const r = row.getBoundingClientRect();
    p.style.setProperty("--wh-pos", "absolute");
    p.style.setProperty("--wh-top", r.bottom + scrollY + 4 + "px");
    p.style.setProperty("--wh-left", r.left + scrollX + "px");
    p.style.setProperty("--wh-width", r.width + "px");
    p.style.setProperty("--wh-max", Math.max(260, innerHeight - Math.max(r.bottom, 0) - 16) + "px");
  };
  // Delegated, and before the panel shows: a refresh that replaces the page's main keeps it working,
  // and the panel never paints where the stylesheet alone would have put it.
  document.addEventListener("beforetoggle", (e) => {
    if (e.target instanceof HTMLElement && e.target.id === "wh-book" && e.newState === "open") place(e.target);
  }, true);
  addEventListener("resize", () => {
    const p = book();
    if (p && p.matches(":popover-open")) place(p);
  });
  // Narrowed to a phone's width, the tables belong in the page again, not floating over it.
  wide.addEventListener("change", () => {
    const p = book();
    if (!wide.matches && p && p.matches(":popover-open")) p.hidePopover();
  });
})();`;

export function whales(data: {
  overview: Overview;
  whales: WhaleData;
  asset: string;
  assetClass: AssetClass;
  params: WhaleParams;
  /** The asset's option book (app.ts reads it only for a ticker gammaBookFor names). */
  gamma?: GammaData | null;
  now: number;
}): string {
  const { overview, whales: book, asset, assetClass, params, now } = data;
  const label = assetName(asset, assetClass);
  const selfPath = whalesPath(asset, assetClass);
  const window = WHALE_INTERVALS[params.interval].span;
  const venue = whaleVenueName(params.venue);
  const step = book.market?.price_step ?? null;
  const rounded = step !== null;

  // --- venue switch, market picker, window strip -------------------------------------------------
  // The switch keeps the asset where the other venue tracks it, and falls back to that venue's BTC
  // where it does not.
  const venueStrip = `<nav class="tf wh-venues" aria-label="${tr("Venue")}">${WHALE_VENUES.map(
    (v) => {
      const keep = book.venues.includes(v);
      const href = esc(
        (keep ? selfPath : whalesPath("BTC", "crypto")) +
          whaleToQuery({ ...params, venue: v, pulled: keep && params.pulled }),
      );
      return v === params.venue
        ? `<a class="on" href="${href}" aria-current="page">${whaleVenueName(v)}</a>`
        : `<a href="${href}">${whaleVenueName(v)}</a>`;
    },
  ).join("")}</nav>`;
  const picker = marketPicker({
    markets: book.markets,
    current: book.market,
    asset,
    assetClass,
    params,
  });
  const windowStrip = `<nav class="tf" aria-label="${tr("Interval")}">${WHALE_INTERVAL_KEYS.map(
    (key) => {
      const href = esc(selfPath + whaleToQuery({ ...params, interval: key }));
      return key === params.interval
        ? `<a class="on" href="${href}" aria-current="page">${key}</a>`
        : `<a href="${href}">${key}</a>`;
    },
  ).join("")}</nav>`;
  const pulledToggle = `<a class="wh-toggle${params.pulled ? " on" : ""}" href="${esc(selfPath + whaleToQuery({ ...params, pulled: !params.pulled }))}">${params.pulled ? tr("hide pulled walls") : tr("show pulled walls")}</a>`;

  // --- tiles --------------------------------------------------------------------------------------
  const open = book.walls.filter((w) => w.status === "open");
  const bids = open.filter((w) => w.side === "bid");
  const asks = open.filter((w) => w.side === "ask");
  const sum = (list: readonly WhaleWall[]) => list.reduce((total, w) => total + w.current_usd, 0);
  const largest = [...open].sort((a, b) => b.current_usd - a.current_usd)[0] ?? null;
  const { tally } = book;
  const floor = book.market ? formatUsd(book.market.floor_usd) : "–";
  const last = book.candles.at(-1)?.close ?? null;
  // The desktop's way into the tables (BOOK_SCRIPT); a phone has them in the page and no button.
  const bookButton =
    book.market === null
      ? ""
      : `<button type="button" class="wh-book-btn" popovertarget="wh-book"><b>${tr("Orders and trades")}</b><span class="dim" data-live="wh-book-n">${tr("{n} resting", { n: `<span data-u="open">${open.length}</span>` })}</span></button>`;

  const tiles = `<div class="cvd-tiles wh-tiles" data-live="wh-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Bid walls resting")}</p><p class="cvd-big cvd-up"><span data-u="bids">${formatUsd(sum(bids))}</span></p><p class="dim">${tr("{n} buy walls below the price", { n: bids.length })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Ask walls resting")}</p><p class="cvd-big cvd-down"><span data-u="asks">${formatUsd(sum(asks))}</span></p><p class="dim">${tr("{n} sell walls above the price", { n: asks.length })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Largest wall")}</p><p class="cvd-big${largest ? (largest.side === "bid" ? " cvd-up" : " cvd-down") : ""}"><span data-u="largest">${largest ? formatUsd(largest.current_usd) : "–"}</span></p><p class="dim">${largest ? tr("{side} at {price}", { side: sideLabel(largest.side), price: wallPrice(largest, step) }) : tr("none resting")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Large buys in {window}", { window })}</p><p class="cvd-big cvd-up"><span data-u="buys">${formatUsd(tally.buy_usd)}</span></p><p class="dim">${tr("{n} taker bursts of {floor} or more", { n: tally.buys, floor })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Large sells in {window}", { window })}</p><p class="cvd-big cvd-down"><span data-u="sells">${formatUsd(tally.sell_usd)}</span></p><p class="dim">${tr("{n} taker bursts of {floor} or more", { n: tally.sells, floor })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Pulled in {window}", { window })}</p><p class="cvd-big"><span data-u="pulled">${tally.pulled}</span></p><p class="dim">${tr("cancelled before the price reached them; {n} filled", { n: tally.filled })}</p></div>
</div>`;

  // --- chart --------------------------------------------------------------------------------------
  const chart =
    book.candles.length === 0
      ? `<p class="empty">${tr("No candles for {asset} yet. The collector backfills three days within a minute of a market joining the set.", { asset: label })}</p>`
      : whaleChart({
          label,
          venueLabel: book.market?.venue_symbol.includes(":")
            ? `${venue} ${esc(book.market.venue_symbol)}`
            : venue,
          step,
          candles: book.candles,
          walls: book.walls,
          trades: book.trades,
          params,
          gamma:
            data.gamma && gexFits(data.gamma, book.candles.at(-1)?.close ?? null, now)
              ? data.gamma
              : null,
          now,
        });

  // --- tables -------------------------------------------------------------------------------------
  const dist = (price: number) => (last === null ? "–" : signedPct(((price - last) / last) * 100));
  // A rounded book's walls also say how many orders share the bucket and how big the largest is at
  // least; distance is to the bucket's middle.
  const orderCells = (w: WhaleWall) => {
    if (!rounded) return "";
    const proven = provenUsd(w);
    return `<td class="num dim">${w.orders ?? "–"}</td><td class="num">${proven === null ? "–" : formatUsd(proven)}</td>`;
  };
  const orderHeads = rounded
    ? `<th class="num" title="${esc(tr("Orders in the bucket at the last look"))}">${tr("Orders")}</th><th class="num" title="${esc(tr("The bucket's average order: its largest holds at least this"))}">${tr("Largest ≥")}</th>`
    : "";
  const openRows = [...open]
    .sort((a, b) => b.current_usd - a.current_usd)
    .map(
      (w) => `<tr data-k="${esc(`${w.side}:${w.price}:${w.first_seen.getTime()}`)}">
<td class="${w.side === "bid" ? "cvd-up" : "cvd-down"}">${sideLabel(w.side)}</td>
<td class="num">${wallPrice(w, step)}</td>
<td class="num dim">${dist(wallY(w, step))}</td>
<td class="num"><span data-u="size">${formatUsd(w.current_usd)}</span></td>
${orderCells(w)}
<td class="num dim">${formatUsd(w.peak_usd)}</td>
<td class="num dim">${since(w.first_seen, now)}</td>
</tr>`,
    )
    .join("");
  const openTable = open.length
    ? `<div class="sheet-wrap"><table class="sheet wh-table">
<thead><tr><th>${tr("Side")}</th><th class="num">${tr("Price")}</th><th class="num" title="${tr("From the last price")}">${tr("Distance")}</th><th class="num">${tr("Size")}</th>${orderHeads}<th class="num" title="${tr("The most it has held")}">${tr("Peak")}</th><th class="num" title="${tr("Since the collector first saw it")}">${tr("Resting since")}</th></tr></thead>
<tbody data-live="wh-open">${openRows}</tbody>
</table></div>`
    : `<p class="empty">${tr("No wall is resting in {asset}'s book right now.", { asset: label })}</p>`;

  const ended = book.walls
    .filter((w) => w.status !== "open" && (params.pulled || w.status !== "pulled"))
    .sort((a, b) => (b.ended_at?.getTime() ?? 0) - (a.ended_at?.getTime() ?? 0))
    .slice(0, 25);
  const endedRows = ended
    .map((w) => {
      const endMs = w.ended_at?.getTime() ?? w.last_seen.getTime();
      return `<tr data-k="${esc(`${w.side}:${w.price}:${w.first_seen.getTime()}`)}">
<td class="${w.side === "bid" ? "cvd-up" : "cvd-down"}">${sideLabel(w.side)}</td>
<td class="num">${wallPrice(w, step)}</td>
<td class="num">${formatUsd(w.peak_usd)}</td>
<td class="num dim">${durationText(endMs - w.first_seen.getTime())}</td>
<td class="num dim">${since(w.ended_at ?? w.last_seen, now)}</td>
<td class="wh-${w.status}-t">${statusLabel(w.status)}</td>
</tr>`;
    })
    .join("");
  const endedTable = ended.length
    ? `<div class="sheet-wrap"><table class="sheet wh-table">
<thead><tr><th>${tr("Side")}</th><th class="num">${tr("Price")}</th><th class="num">${tr("Peak")}</th><th class="num">${tr("Lived")}</th><th class="num">${tr("Ended")}</th><th>${tr("How")}</th></tr></thead>
<tbody data-live="wh-ended">${endedRows}</tbody>
</table></div>`
    : `<p class="empty">${tr("No wall ended in the last {window}.", { window })}</p>`;

  // A venue that names its takers (Hyperliquid) gets their address, linked to its explorer.
  const named = book.trades.some((t) => t.taker);
  const takerCell = (t: WhaleTrade) =>
    !named
      ? ""
      : t.taker
        ? `<td><a class="wh-addr" href="${esc(explorerAddress(t.taker))}" target="_blank" rel="noopener" title="${esc(t.taker)}">${esc(shortAddress(t.taker))}</a></td>`
        : `<td class="dim">–</td>`;
  const tradeRows = book.trades
    .slice(0, 25)
    .map(
      (t) => `<tr data-k="${esc(`${t.side}:${t.traded_at.getTime()}:${t.price}`)}">
<td class="${t.side === "buy" ? "cvd-up" : "cvd-down"}">${takerLabel(t.side)}</td>
<td class="num">${formatPrice(t.price)}</td>
<td class="num dim">${dist(t.price)}</td>
<td class="num">${formatUsd(t.notional_usd)}</td>
<td class="num dim">${t.fills}</td>
${takerCell(t)}
<td class="num dim">${since(t.traded_at, now)}</td>
</tr>`,
    )
    .join("");
  const tradeTable = book.trades.length
    ? `<div class="sheet-wrap"><table class="sheet wh-table">
<thead><tr><th>${tr("Side")}</th><th class="num">${tr("Price")}</th><th class="num" title="${tr("From the last price")}">${tr("Distance")}</th><th class="num">${tr("Size")}</th><th class="num" title="${tr("Aggregate trades in the burst: roughly the price levels it took")}">${tr("Fills")}</th>${named ? `<th>${tr("Taker")}</th>` : ""}<th class="num">${tr("When")}</th></tr></thead>
<tbody data-live="wh-trades">${tradeRows}</tbody>
</table></div>`
    : `<p class="empty">${tr("No taker burst of {floor} or more in the last {window}.", { floor, window })}</p>`;

  const help = rounded
    ? `<p>${tr("Proven whale orders in {venue}'s book for {asset}. {venue} publishes only its 20 nearest price buckets a side, here {step} wide, each with how many orders it holds. A wall is a bucket whose average order is at least {floor}, so at least one order in it is that big; a {bid} sits below the price, an {ask} above it. It stays a wall while the bucket still holds what that order was proven to. A whale order sharing a bucket with many small ones cannot be proven, and is not drawn.", { venue, asset: label, step: stepText(step), floor, bid: `<span class="cvd-up">${tr("bid wall")}</span>`, ask: `<span class="cvd-down">${tr("ask wall")}</span>` })}</p><p>${tr("Each circle is one account's market order in one block, of at least the same {floor}; the table names the account. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the order. The chart draws the 200 largest in the window.", { floor })}</p><p>${tr("A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.")}</p><p>${tr("The markets are the top forty by open interest summed across every exchange we collect, among those {venue} lists, its HIP-3 markets included (gold is xyz:GOLD). The floor scales with that open interest.", { venue })}</p>`
    : `<p>${tr("Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.", { asset: label, floor, bid: `<span class="cvd-up">${tr("bid wall")}</span>`, ask: `<span class="cvd-down">${tr("ask wall")}</span>` })}</p><p>${tr("Each circle is a large market order: every fill on one side in the same millisecond, counted as one burst, of at least the same {floor}. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the burst. The chart draws the 200 largest in the window.", { floor })}</p><p>${tr("A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.")}</p><p>${tr("The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.")}</p>`;

  return layout({
    title:
      asset === "BTC" && assetClass === "crypto"
        ? tr("Whale orders")
        : `${asset} ${tr("whale orders")}`,
    description: tr(
      "Large resting limit orders and large market orders on Binance and Hyperliquid futures, drawn over the price: where the walls sit, how big, whether they were filled or pulled, and who hit them.",
    ),
    path: "/whales",
    overview,
    now,
    body: `${helpHeading("h1", tr("Whale orders"), "whales", help)}
<div class="lq-controls wh-controls">${picker}${bookButton}${venueStrip}${windowStrip}${pulledToggle}</div>
${
  book.market === null
    ? `<p class="empty">${book.markets.length ? tr("{asset} is not one of the markets tracked on {venue}.", { asset: label, venue }) : tr("The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.")}</p>`
    : `${tiles}
<div id="wh-chart" class="cvd-anchor">${chart}</div>
<section class="wh-book${rounded ? " wh-book-wide" : ""}" id="wh-book" popover aria-label="${esc(tr("Orders and trades"))}">
<div class="wh-book-col">
<h2 class="cvd-h2 has-help">${tr("Resting now")}${helpButton("wh-open")}</h2>
${helpPanel("wh-open", `<p>${tr("Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.")}</p>`)}
${openTable}
</div>
<div class="wh-book-side">
<div class="wh-book-col">
<h2 class="cvd-h2">${tr("Ended in the last {window}", { window })}</h2>
${endedTable}
</div>
<div class="wh-book-col">
<h2 class="cvd-h2">${tr("Largest trades in the last {window}", { window })}</h2>
${tradeTable}
</div>
</div>
</section>`
}
<script>${PICK_SCRIPT}</script>
<script>${BOOK_SCRIPT}</script>
<script>${SLOT_SCRIPT}</script>
<script>${GEX_SCRIPT}</script>`,
  });
}
