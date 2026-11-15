import type { TraderHolding } from "../app/data";
import {
  coinResults,
  type Leader,
  type LeaderBoard,
  PNL_WINDOWS,
  type PnlWindow,
  type TraderOrder,
  type TraderRead,
  tradesOf,
} from "../app/hyperliquid";
import { TRADER_WINDOWS, type TraderWindow } from "../app/params";
import { esc, formatPrice, formatUsd, since } from "./format";
import { timeTicks } from "./funding-chart";
import { msg, tr, trMsg } from "./i18n";
import { timeTag } from "./localtime";

/**
 * The member "Top traders" tab on /liquidations: Hyperliquid's biggest winners over a day, a week, a
 * month or all time, and any one of them opened -- what they hold, their profit over time, and their
 * recent fills and orders (app/hyperliquid.ts reads them all from Hyperliquid itself).
 *
 * WHY ON THE LIQUIDATIONS PAGE. The page shows who was forced out; this shows who was on the other
 * side and won, and how they trade: the size they hold, where they would be liquidated, and whether
 * they scale in with limit orders or take the market.
 */

/** Rows the list shows: the board keeps more, so an opened trader can still name their rank. */
export const WINNERS_ROWS = 25;
/** Trades and orders the opened trader's tables show, newest first. */
export const TRADER_ROWS = 60;
/** Coins in the opened trader's coin strip, by how much they traded them. */
const COIN_CHOICES = 10;

export const PNL_WINDOW_OF: Record<TraderWindow, PnlWindow> = {
  day: "day",
  week: "week",
  month: "month",
  all: "allTime",
};

const WINDOW_LABEL: Record<TraderWindow, string> = {
  day: msg("24h"),
  week: msg("7d"),
  month: msg("30d"),
  all: msg("All time"),
};

const WINDOW_WORDS: Record<TraderWindow, string> = {
  day: msg("over the last day"),
  week: msg("over the last week"),
  month: msg("over the last month"),
  all: msg("over all time"),
};

/** "0x218a…7da2". */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** "+$1.2M", "−$340k": a profit, signed. */
function signedUsd(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return value > 0 ? `+${formatUsd(value)}` : value === 0 ? "$0" : formatUsd(value);
}

function tone(value: number): string {
  return value > 0 ? "cvd-up" : value < 0 ? "cvd-down" : "";
}

/** "+12.3%". */
function signedPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return "–";
  const a = Math.abs(fraction * 100);
  const text = a >= 1000 ? a.toFixed(0) : a >= 100 ? a.toFixed(0) : a.toFixed(1);
  if (Number(text) === 0) return "0.0%";
  return `${fraction < 0 ? "−" : "+"}${text}%`;
}

/** A size in coins: four significant figures, grouped. */
function units(value: number): string {
  const a = Math.abs(value);
  const digits = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 3 : 5;
  return a.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function windowStrip(
  current: TraderWindow,
  hrefFor: (window: TraderWindow) => string,
  label: string,
): string {
  const links = TRADER_WINDOWS.map((w) => {
    const text = trMsg(WINDOW_LABEL[w]);
    return w === current
      ? `<a class="on" href="${esc(hrefFor(w))}" aria-current="true" data-lq-swap="winners">${text}</a>`
      : `<a href="${esc(hrefFor(w))}" data-lq-swap="winners">${text}</a>`;
  }).join("");
  return `<nav class="tf" aria-label="${esc(label)}">${links}</nav>`;
}

/** A position held now, in a cell: side, coin and size, coloured by side. */
function holdingText(h: { coin: string; size: number; value: number }): string {
  const long = h.size > 0;
  return `<span class="${long ? "lq-ink-l" : "lq-ink-s"}">${long ? tr("Long {coin}", { coin: esc(h.coin) }) : tr("Short {coin}", { coin: esc(h.coin) })}</span> ${formatUsd(h.value)}`;
}

/** The list: the window's biggest winners on Hyperliquid's leaderboard, each one a link to open. */
export function winnersPanel(data: {
  board: LeaderBoard | null;
  holdings: readonly TraderHolding[] | null;
  window: TraderWindow;
  now: number;
  hrefFor: (to: { top?: TraderWindow; trader?: string | null }) => string;
}): string {
  const { board, holdings, window, now, hrefFor } = data;
  const strip = windowStrip(
    window,
    (w) => `${hrefFor({ top: w, trader: null })}#winners`,
    tr("Rank by profit over"),
  );
  const controls = `<div class="lq-controls">${strip}</div>`;
  if (board === null) {
    return `${controls}<p class="empty">${tr("Hyperliquid's leaderboard could not be read right now. Try again in a minute.")}</p>`;
  }
  const at = PNL_WINDOWS.indexOf(PNL_WINDOW_OF[window]);
  const rows = board.top[PNL_WINDOW_OF[window]].slice(0, WINNERS_ROWS);
  const held = new Map<string, TraderHolding[]>();
  for (const h of holdings ?? []) {
    const list = held.get(h.address) ?? [];
    list.push(h);
    held.set(h.address, list);
  }
  const body = rows
    .map((leader, i) => {
      const pnl = leader.pnl[at] as number;
      const roi = leader.roi[at] as number;
      const volume = leader.volume[at] as number;
      const mine = held.get(leader.address) ?? [];
      const now2 = mine
        .slice(0, 2)
        .map((h) => holdingText({ coin: h.coin, size: h.size, value: h.position_usd }))
        .join("<br>");
      const more =
        mine.length > 2
          ? ` <span class="dim">${tr("+{n} more", { n: mine.length - 2 })}</span>`
          : "";
      const who = leader.name
        ? `${esc(leader.name)} <span class="dim">${shortAddress(leader.address)}</span>`
        : shortAddress(leader.address);
      return `<tr><td class="num dim">${i + 1}</td><td><a class="tr-who" href="${esc(hrefFor({ trader: leader.address }))}#winners" data-lq-swap="winners">${who}</a></td><td class="num ${tone(pnl)}"><b>${signedUsd(pnl)}</b></td><td class="num ${tone(roi)}">${signedPct(roi)}</td><td class="num">${formatUsd(leader.accountValue)}</td><td class="num dim">${formatUsd(volume)}</td><td>${holdings === null ? `<span class="dim">–</span>` : mine.length === 0 ? `<span class="dim">${tr("nothing over $100k")}</span>` : `${now2}${more}`}</td></tr>`;
    })
    .join("");
  return `${controls}
<div class="sheet-wrap"><table class="sheet tr-list">
<thead><tr><th class="num">#</th><th>${tr("Trader")}</th><th class="num">${tr("Profit")}</th><th class="num" title="${esc(tr("Profit over the account's value, as Hyperliquid's leaderboard computes it"))}">${tr("Return")}</th><th class="num">${tr("Account value")}</th><th class="num">${tr("Volume")}</th><th>${tr("Holding now")}</th></tr></thead>
<tbody>${body}</tbody></table></div>
<p class="notes">${tr(
    "Hyperliquid's own leaderboard, every one of its {ranked} accounts ranked by profit {window}, read {ago}. Hyperliquid is the large perp exchange where every account is public, so any of them opens on its positions, fills and orders. Holdings are the whale tracker's: positions of $100k and up, read within three hours.",
    {
      ranked: board.ranked.toLocaleString("en-US"),
      window: trMsg(WINDOW_WORDS[window]),
      ago: since(new Date(board.readAt), now),
    },
  )}</p>`;
}

/** The opened trader's profit over the window, as Hyperliquid's portfolio records it. */
function pnlChart(points: readonly [number, number][], title: string): string {
  if (points.length < 2) {
    return `<p class="empty">${tr("Too little history in this window to draw.")}</p>`;
  }
  const fromMs = (points[0] as [number, number])[0];
  const toMs = (points[points.length - 1] as [number, number])[0];
  let lo = Math.min(0, ...points.map((p) => p[1]));
  let hi = Math.max(0, ...points.map((p) => p[1]));
  const pad = (hi - lo) * 0.06 || 1;
  lo -= pad;
  hi += pad;
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const x = (ms: number) => ((ms - fromMs) / (toMs - fromMs || 1)) * 1000;
  const y = (v: number) => 1000 - ((v - lo) / (hi - lo)) * 1000;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const grid = ticks
    .map(
      (v) =>
        `<line class="fchart-grid${Math.abs(v) < step / 1e6 ? " fchart-zero" : ""}" x1="0" x2="1000" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"></line>`,
    )
    .join("");
  const yLabels = ticks
    .map(
      (v) =>
        `<span class="fchart-y" style="top:${(y(v) / 10).toFixed(2)}%">${formatUsd(Math.abs(v) < step / 1e6 ? 0 : v)}</span>`,
    )
    .join("");
  const xLabels = timeTicks(fromMs, toMs)
    .map(
      ({ ms, label }) =>
        `<span class="fchart-x" style="left:${(x(ms) / 10).toFixed(2)}%">${label}</span>`,
    )
    .join("");
  const path = points
    .map(([ms, v], i) => `${i === 0 ? "M" : "L"}${x(ms).toFixed(1)} ${y(v).toFixed(1)}`)
    .join("");
  const last = (points[points.length - 1] as [number, number])[1];
  return `<figure class="fchart">
<div class="fchart-head"><p class="fchart-title">${title}</p><div class="fchart-keys"><span class="fchart-key"><b class="${tone(last)}">${signedUsd(last)}</b></span></div></div>
<div class="fchart-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(title)}">${grid}<path class="fchart-line ${last >= 0 ? "long" : "short"}" d="${path}"></path></svg>${yLabels}${xLabels}</div>
</figure>`;
}

const DIRECTIONS: Record<string, string> = {
  "Open Long": msg("Open long"),
  "Close Long": msg("Close long"),
  "Open Short": msg("Open short"),
  "Close Short": msg("Close short"),
  "Long > Short": msg("Long to short"),
  "Short > Long": msg("Short to long"),
  Buy: msg("Buy"),
  Sell: msg("Sell"),
};

function direction(dir: string, side: "B" | "A"): string {
  const words = DIRECTIONS[dir];
  const text = words ? trMsg(words) : esc(dir);
  return `<span class="${side === "B" ? "lq-ink-l" : "lq-ink-s"}">${text}</span>`;
}

const ORDER_TYPES: Record<string, string> = {
  Limit: msg("Limit"),
  Market: msg("Market"),
  "Stop Market": msg("Stop market"),
  "Stop Limit": msg("Stop limit"),
  "Take Profit Market": msg("Take profit market"),
  "Take Profit Limit": msg("Take profit limit"),
};

function orderType(order: TraderOrder): string {
  const words = ORDER_TYPES[order.type];
  const text = words ? trMsg(words) : esc(order.type);
  const extras = [
    order.tif && order.tif !== "Gtc" ? esc(order.tif) : "",
    order.reduceOnly ? tr("reduce only") : "",
    order.tpsl ? tr("position TP/SL") : "",
  ].filter(Boolean);
  return extras.length ? `${text} <span class="dim">${extras.join(" · ")}</span>` : text;
}

function orderStatus(status: string): string {
  const named: Record<string, string> = {
    filled: tr("Filled"),
    open: tr("Open"),
    canceled: tr("Canceled"),
    triggered: tr("Triggered"),
    rejected: tr("Rejected"),
    marginCanceled: tr("Canceled: margin"),
  };
  const text =
    named[status] ??
    (/Canceled$|^scheduledCancel$/.test(status)
      ? tr("Canceled")
      : /Rejected$/.test(status)
        ? tr("Rejected")
        : esc(status));
  const cls = status === "filled" ? "" : status === "open" || status === "triggered" ? "" : "dim";
  return `<span class="${cls}" title="${esc(status)}">${text}</span>`;
}

/** One trader, opened: what Hyperliquid answered for the address, laid out like an exchange account. */
export function traderPanel(data: {
  read: TraderRead;
  /**
   * Where the trader stands on the leaderboard in the list's window (place 0 when they are only in
   * another window's top, which still gives their name), or null when in none.
   */
  rank: { place: number; window: TraderWindow; leader: Leader } | null;
  pnlWindow: TraderWindow;
  coin: string | null;
  now: number;
  hrefFor: (to: { trader?: string | null; pnl?: TraderWindow; coin?: string | null }) => string;
}): string {
  const { read, rank, pnlWindow, coin, now, hrefFor } = data;
  const back = `<p class="tr-back"><a href="${esc(hrefFor({ trader: null }))}#winners" data-lq-swap="winners">${tr("All top traders")}</a></p>`;
  const name = rank?.leader.name ?? null;
  const head = `<div class="tr-head">
<h2 class="cvd-h2">${name ? esc(name) : shortAddress(read.address)}</h2>
<p class="tr-addr">${esc(read.address)} · <a href="${esc(`https://hypurrscan.io/address/${read.address}`)}" rel="noopener" target="_blank">Hypurrscan</a></p>
${rank && rank.place > 0 ? `<p class="dim">${tr("#{place} on Hyperliquid's leaderboard by profit {window}.", { place: rank.place, window: trMsg(WINDOW_WORDS[rank.window]) })}</p>` : ""}
</div>`;
  if (!read.state && !read.portfolio && !read.fills && !read.orders) {
    return `${back}${head}<p class="empty">${
      read.busy
        ? tr("Hyperliquid is answering too many requests right now. Try again in a minute.")
        : tr("Hyperliquid did not answer for this account right now. Try again in a minute.")
    }</p>`;
  }
  const state = read.state;
  const window = read.portfolio?.[PNL_WINDOW_OF[pnlWindow]] ?? null;
  const windowPnl =
    window && window.pnl.length > 0 ? (window.pnl.at(-1) as [number, number])[1] : null;
  const upnl = state ? state.positions.reduce((sum, p) => sum + p.upnl, 0) : null;
  const tiles = `<div class="cvd-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Account value")}</p><p class="cvd-big">${state ? formatUsd(state.accountValue) : "–"}</p><p class="dim">${state?.withdrawable !== null && state?.withdrawable !== undefined ? tr("{usd} free to withdraw", { usd: formatUsd(state.withdrawable) }) : "&nbsp;"}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Profit {window}", { window: trMsg(WINDOW_WORDS[pnlWindow]) })}</p><p class="cvd-big ${windowPnl === null ? "" : tone(windowPnl)}">${windowPnl === null ? "–" : signedUsd(windowPnl)}</p><p class="dim">${window ? tr("{usd} traded", { usd: formatUsd(window.volume) }) : "&nbsp;"}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Open positions")}</p><p class="cvd-big">${state ? formatUsd(state.notional) : "–"}</p><p class="dim">${state ? tr("{lev}x the account's value", { lev: state.accountValue > 0 ? (state.notional / state.accountValue).toFixed(1) : "–" }) : "&nbsp;"}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Unrealized")}</p><p class="cvd-big ${upnl === null ? "" : tone(upnl)}">${upnl === null ? "–" : signedUsd(upnl)}</p><p class="dim">${tr("on the open positions")}</p></div>
</div>`;

  const chartStrip = windowStrip(
    pnlWindow,
    (w) => `${hrefFor({ pnl: w })}#winners`,
    tr("Profit chart window"),
  );
  const chart = window
    ? pnlChart(
        window.pnl,
        tr("Profit and loss {window}", { window: trMsg(WINDOW_WORDS[pnlWindow]) }),
      )
    : `<p class="empty">${tr("The profit history could not be read right now.")}</p>`;

  const positions = state
    ? state.positions.length === 0
      ? `<p class="empty">${tr("No open positions.")}</p>`
      : `<div class="sheet-wrap"><table class="sheet tr-pos">
<thead><tr><th>${tr("Coin")}</th><th class="num">${tr("Size")}</th><th class="num">${tr("Value")}</th><th class="num">${tr("Entry")}</th><th class="num">${tr("Mark")}</th><th class="num">${tr("Unrealized")}</th><th class="num" title="${esc(tr("Unrealized profit over the margin the position holds"))}">${tr("ROE")}</th><th class="num">${tr("Leverage")}</th><th class="num">${tr("Liq. price")}</th><th class="num" title="${esc(tr("Funding the position has paid since it opened; a minus is funding received"))}">${tr("Funding")}</th></tr></thead>
<tbody>${state.positions
          .map((p) => {
            const long = p.size > 0;
            const lev =
              p.leverage === null
                ? "–"
                : `${p.leverage}x <span class="dim">${p.leverageType === "isolated" ? tr("isolated") : tr("cross")}</span>`;
            return `<tr><td><span class="${long ? "lq-ink-l" : "lq-ink-s"}">${long ? tr("Long {coin}", { coin: esc(p.coin) }) : tr("Short {coin}", { coin: esc(p.coin) })}</span></td><td class="num">${units(p.size)}</td><td class="num"><b>${formatUsd(p.value)}</b></td><td class="num">${p.entry === null ? "–" : formatPrice(p.entry)}</td><td class="num">${p.mark === null ? "–" : formatPrice(p.mark)}</td><td class="num ${tone(p.upnl)}">${signedUsd(p.upnl)}</td><td class="num ${p.roe === null ? "" : tone(p.roe)}">${p.roe === null ? "–" : signedPct(p.roe)}</td><td class="num">${lev}</td><td class="num">${p.liquidation === null ? `<span class="dim">${tr("none")}</span>` : formatPrice(p.liquidation)}</td><td class="num dim">${p.fundingSinceOpen === null ? "–" : signedUsd(p.fundingSinceOpen)}</td></tr>`;
          })
          .join("")}</tbody></table></div>`
    : `<p class="empty">${tr("The positions could not be read right now.")}</p>`;

  const openOrders = (read.open ?? []).filter((o) => coin === null || o.coin === coin);
  const openTable =
    openOrders.length === 0
      ? ""
      : `<h3 class="tr-h3">${tr("Resting orders")}</h3>
<div class="sheet-wrap"><table class="sheet tr-orders">
<thead><tr><th>${tr("Placed")}</th><th>${tr("Coin")}</th><th>${tr("Side")}</th><th>${tr("Type")}</th><th class="num">${tr("Size")}</th><th class="num">${tr("Price")}</th><th class="num">${tr("Trigger")}</th></tr></thead>
<tbody>${openOrders
          .slice(0, TRADER_ROWS)
          .map(
            (o) =>
              `<tr><td class="dim">${timeTag(o.placed, "mdhm")}</td><td>${esc(o.coin)}</td><td class="${o.side === "B" ? "lq-ink-l" : "lq-ink-s"}">${o.side === "B" ? tr("Buy") : tr("Sell")}</td><td>${orderType(o)}</td><td class="num">${units(o.size)}</td><td class="num">${o.price === null ? "–" : formatPrice(o.price)}</td><td class="num">${o.trigger === null ? "–" : formatPrice(o.trigger)}</td></tr>`,
          )
          .join("")}</tbody></table></div>`;

  // The coins this trader trades, busiest first, for the strip that narrows the history to one.
  const activity = new Map<string, number>();
  for (const f of read.fills ?? [])
    activity.set(f.coin, (activity.get(f.coin) ?? 0) + f.price * f.size);
  for (const o of read.orders ?? []) if (!activity.has(o.coin)) activity.set(o.coin, 0);
  const coins = [...activity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, COIN_CHOICES)
    .map(([c]) => c);
  if (coin !== null && !coins.includes(coin)) coins.push(coin);
  const coinLink = (c: string | null, text: string) =>
    c === coin
      ? `<a class="on" href="${esc(hrefFor({ coin: c }))}#winners" aria-current="true" data-lq-swap="winners">${text}</a>`
      : `<a href="${esc(hrefFor({ coin: c }))}#winners" data-lq-swap="winners">${text}</a>`;
  const coinStrip =
    coins.length > 1 || coin !== null
      ? `<div class="lq-controls"><nav class="tf" aria-label="${esc(tr("Coin"))}">${coinLink(null, tr("All"))}${coins.map((c) => coinLink(c, esc(c))).join("")}</nav></div>`
      : "";

  const fills = read.fills;
  let fillsPart: string;
  if (fills === null) {
    fillsPart = `<p class="empty">${tr("The fills could not be read right now.")}</p>`;
  } else if (fills.length === 0) {
    fillsPart = `<p class="empty">${tr("No fills on record.")}</p>`;
  } else {
    const oldest = (fills[fills.length - 1] as { time: number }).time;
    const results = coinResults(fills);
    const resultRows = results
      .slice(0, 12)
      .map((r) => {
        const net = r.closedPnl - r.fees;
        return `<tr${r.coin === coin ? ` class="on"` : ""}><td>${esc(r.coin)}</td><td class="num">${r.trades}</td><td class="num dim">${formatUsd(r.volume)}</td><td class="num ${tone(r.closedPnl)}">${signedUsd(r.closedPnl)}</td><td class="num dim">${formatUsd(r.fees)}</td><td class="num ${tone(net)}"><b>${signedUsd(net)}</b></td></tr>`;
      })
      .join("");
    const trades = tradesOf(coin === null ? fills : fills.filter((f) => f.coin === coin));
    const tradeRows = trades
      .slice(0, TRADER_ROWS)
      .map(
        (t) =>
          `<tr><td class="dim">${timeTag(t.time, "mdhm")}</td><td>${esc(t.coin)}</td><td>${direction(t.dir, t.side)}${t.liquidation ? ` <span class="lq-ink-s" title="${esc(tr("This account was liquidated in this fill"))}">${tr("liquidated")}</span>` : ""}</td><td class="num">${formatPrice(t.price)}</td><td class="num">${units(t.size)}</td><td class="num"><b>${formatUsd(t.value)}</b></td><td class="num ${t.closedPnl === 0 ? "dim" : tone(t.closedPnl)}">${t.closedPnl === 0 ? "–" : signedUsd(t.closedPnl)}</td><td class="num dim">${formatUsd(t.fee)}</td><td class="num dim">${t.fills}</td></tr>`,
      )
      .join("");
    fillsPart = `<h3 class="tr-h3">${tr("Results by coin")}</h3>
<div class="sheet-wrap"><table class="sheet tr-coins">
<thead><tr><th>${tr("Coin")}</th><th class="num" title="${esc(tr("Orders that filled"))}">${tr("Trades")}</th><th class="num">${tr("Volume")}</th><th class="num" title="${esc(tr("Profit realized by closing, before fees"))}">${tr("Closed P&amp;L")}</th><th class="num">${tr("Fees")}</th><th class="num">${tr("Net")}</th></tr></thead>
<tbody>${resultRows}</tbody></table></div>
<h3 class="tr-h3">${tr("Trades")}</h3>
${
  tradeRows
    ? `<div class="sheet-wrap"><table class="sheet tr-trades">
<thead><tr><th>${tr("Time")}</th><th>${tr("Coin")}</th><th>${tr("Direction")}</th><th class="num" title="${esc(tr("Size-weighted over the order's fills"))}">${tr("Price")}</th><th class="num">${tr("Size")}</th><th class="num">${tr("Value")}</th><th class="num">${tr("Closed P&amp;L")}</th><th class="num">${tr("Fee")}</th><th class="num" title="${esc(tr("Fills the order took"))}">${tr("Fills")}</th></tr></thead>
<tbody>${tradeRows}</tbody></table></div>`
    : `<p class="empty">${tr("No trades in {coin} among these fills.", { coin: esc(coin ?? "") })}</p>`
}
<p class="notes">${tr(
      "Hyperliquid answers an account's last {n} fills, here from {date}; results by coin are over those fills only. Each trade is one order's fills taken together.",
      { n: fills.length.toLocaleString("en-US"), date: timeTag(oldest, "md") },
    )}</p>`;
  }

  const orders = read.orders;
  let ordersPart: string;
  if (orders === null) {
    ordersPart = `<p class="empty">${tr("The order history could not be read right now.")}</p>`;
  } else {
    const shown = (coin === null ? orders : orders.filter((o) => o.coin === coin)).slice(
      0,
      TRADER_ROWS,
    );
    const rows = shown
      .map((o) => {
        const filled = o.status === "filled" ? o.size : Math.max(0, o.size - o.left);
        return `<tr><td class="dim">${timeTag(o.time, "mdhm")}</td><td>${esc(o.coin)}</td><td class="${o.side === "B" ? "lq-ink-l" : "lq-ink-s"}">${o.side === "B" ? tr("Buy") : tr("Sell")}</td><td>${orderType(o)}</td><td class="num">${units(o.size)}</td><td class="num ${filled === 0 ? "dim" : ""}">${filled === 0 ? "–" : units(filled)}</td><td class="num">${o.price === null ? `<span class="dim">${tr("market")}</span>` : formatPrice(o.price)}</td><td class="num">${o.trigger === null ? "–" : formatPrice(o.trigger)}</td><td>${orderStatus(o.status)}</td></tr>`;
      })
      .join("");
    ordersPart =
      rows === ""
        ? `<p class="empty">${tr("No orders on record.")}</p>`
        : `<div class="sheet-wrap"><table class="sheet tr-orders">
<thead><tr><th>${tr("Time")}</th><th>${tr("Coin")}</th><th>${tr("Side")}</th><th>${tr("Type")}</th><th class="num">${tr("Size")}</th><th class="num">${tr("Filled")}</th><th class="num">${tr("Price")}</th><th class="num">${tr("Trigger")}</th><th>${tr("Status")}</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="notes">${tr("Hyperliquid answers an account's last {n} orders, each shown once at its latest status.", { n: orders.length.toLocaleString("en-US") })}</p>`;
  }

  return `${back}
${head}
${read.busy ? `<p class="notes">${tr("Hyperliquid throttled part of this read; what is missing says so. Try again in a minute.")}</p>` : ""}
${tiles}
<div class="lq-controls">${chartStrip}</div>
${chart}
<h3 class="tr-h3">${tr("Positions")}</h3>
${positions}
${openTable}
${coinStrip}
${fillsPart}
<h3 class="tr-h3">${tr("Order history")}</h3>
${ordersPart}
<p class="notes">${tr("Read from Hyperliquid {ago}.", { ago: since(new Date(read.readAt), now) })}</p>`;
}

/** The tab's own few rules; theme variables only (themes.ts). */
export const TRADER_CSS = `.tr-head{margin:4px 0 12px}
.tr-head .cvd-h2{margin:0 0 2px}
.tr-addr{color:var(--muted);font-family:var(--mono, ui-monospace, monospace);word-break:break-all}
.tr-back{margin:6px 0 4px}
.tr-h3{margin:18px 0 6px;font-size:inherit;font-weight:600}
.tr-who{white-space:nowrap}
.tr-coins tr.on td{background:var(--hover)}`;
