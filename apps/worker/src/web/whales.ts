import type { AssetClass } from "@ai-rates/core";
import type { Overview, WhaleCandle, WhaleData, WhaleTrade, WhaleWall } from "../app/data";
import { WHALE_WINDOW_KEYS, WHALE_WINDOWS, type WhaleParams, whaleToQuery } from "../app/params";
import { esc, formatPrice, formatUsd, since } from "./format";
import { helpButton, helpHeading, helpPanel } from "./help";
import { tr, trMsg } from "./i18n";
import { layout } from "./layout";
import { assetKey, assetName } from "./pages";
import { MONTHS } from "./slot-chart";

/**
 * /whales: large resting limit orders ("walls") in Binance USD-M books, drawn as lines over the price,
 * and the large taker trades in the same markets, drawn as circles.
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
 * WHAT IT IS NOT. A forecast, or a floor or ceiling: a wall can be pulled the moment price nears it,
 * and the page says so. It is one venue's book, not the market's. And it starts blind to far levels
 * after every collector restart, until they change; the help panel says that too.
 */

const MINUS = "−";

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

/** "Oct 10 21:10", UTC. */
function stamp(date: Date): string {
  const day = tr("{month} {day}", {
    month: trMsg(MONTHS[date.getUTCMonth()] ?? ""),
    day: date.getUTCDate(),
  });
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

function durationText(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return tr("{n}m", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return tr("{h}h {m}m", { h: hours, m: String(minutes % 60).padStart(2, "0") });
  return tr("{d}d {h}h", { d: Math.floor(hours / 24), h: hours % 24 });
}

function whaleChart(data: {
  label: string;
  candles: readonly WhaleCandle[];
  walls: readonly WhaleWall[];
  trades: readonly WhaleTrade[];
  params: WhaleParams;
  now: number;
}): string {
  const { label, candles, walls, trades, params, now } = data;
  const { hours, barMinutes } = WHALE_WINDOWS[params.window];
  const toMs = now;
  const fromMs = now - hours * 3_600_000;
  const span = toMs - fromMs;
  const x = (ms: number) => ((Math.min(Math.max(ms, fromMs), toMs) - fromMs) / span) * 1000;

  // The price range is the candles' own, widened to take in the walls near them: within half the
  // candles' range, and never less than 1.5% of the last price, so a calm day (BTC moving 0.3%) still
  // shows the walls a percent away, while one 9% out cannot flatten the candles into a line.
  let lo = Math.min(...candles.map((c) => c.low));
  let hi = Math.max(...candles.map((c) => c.high));
  const lastClose = candles.at(-1)?.close ?? hi;
  const reach = Math.max((hi - lo) * 0.5, lastClose * 0.015);
  const drawn = walls.filter(
    (w) =>
      (params.pulled || w.status !== "pulled") && w.price >= lo - reach && w.price <= hi + reach,
  );
  for (const w of drawn) {
    lo = Math.min(lo, w.price);
    hi = Math.max(hi, w.price);
  }
  const pad = (hi - lo) * 0.06 || hi * 0.005;
  lo -= pad;
  hi += pad;
  const y = (price: number) => 1000 - ((price - lo) / (hi - lo)) * 1000;

  const slot = ((barMinutes * 60_000) / span) * 1000;
  const body = candles
    .map((c) => {
      const cx = x(c.open_time.getTime()) + slot / 2;
      const up = c.close >= c.open;
      const top = y(Math.max(c.open, c.close));
      const height = Math.max(Math.abs(y(c.open) - y(c.close)), 1.5);
      return `<line class="wh-wick" x1="${cx.toFixed(2)}" x2="${cx.toFixed(2)}" y1="${y(c.high).toFixed(2)}" y2="${y(c.low).toFixed(2)}"></line><rect class="${up ? "wh-up" : "wh-down"}" x="${(cx - slot * 0.35).toFixed(2)}" y="${top.toFixed(2)}" width="${(slot * 0.7).toFixed(2)}" height="${height.toFixed(2)}"></rect>`;
    })
    .join("");

  const biggest = Math.max(...drawn.map(wallUsd), 1);
  const lines = drawn
    .map((w) => {
      const start = w.first_seen.getTime();
      const end = w.status === "open" ? toMs : (w.ended_at?.getTime() ?? w.last_seen.getTime());
      if (end < fromMs) return "";
      const usd = wallUsd(w);
      // Width in screen pixels (non-scaling stroke): 1px for the smallest drawn, 6px for the largest.
      const width = 1 + 5 * Math.sqrt(usd / biggest);
      const tip = tr("{side} wall {price} · {size} · {status} · {lived}", {
        side: sideLabel(w.side),
        price: formatPrice(w.price),
        size: formatUsd(usd),
        status: statusLabel(w.status),
        lived: durationText(end - start),
      });
      const py = y(w.price).toFixed(2);
      return `<line class="wh-wall wh-${w.side} wh-${w.status}" x1="${x(start).toFixed(2)}" x2="${x(end).toFixed(2)}" y1="${py}" y2="${py}" style="stroke-width:${width.toFixed(2)}px"><title>${esc(tip)}</title></line>`;
    })
    .join("");

  // Taker bursts as circles, in HTML rather than the SVG: the plot stretches to its box
  // (preserveAspectRatio none), which would draw an SVG circle as an ellipse. Area is size, the
  // biggest in view 24px across; the biggest are laid first so smaller ones stay on top to hover.
  const shown = trades.filter(
    (t) => t.traded_at.getTime() >= fromMs && t.price >= lo && t.price <= hi,
  );
  const biggestTrade = Math.max(...shown.map((t) => t.notional_usd), 1);
  const circles = [...shown]
    .sort((a, b) => b.notional_usd - a.notional_usd)
    .map((t) => {
      const across = 5 + 19 * Math.sqrt(t.notional_usd / biggestTrade);
      const tip = tr("{side} {size} at {price} · {fills} · {time} UTC", {
        side: takerLabel(t.side),
        size: formatUsd(t.notional_usd),
        price: formatPrice(t.price),
        fills: fillsText(t.fills),
        time: stamp(t.traded_at),
      });
      return `<span class="wh-trade wh-${t.side}" style="left:${(x(t.traded_at.getTime()) / 10).toFixed(2)}%;top:${(y(t.price) / 10).toFixed(2)}%;width:${across.toFixed(1)}px;height:${across.toFixed(1)}px" title="${esc(tip)}"></span>`;
    })
    .join("");

  const last = candles.at(-1)?.close ?? null;
  const lastLine =
    last === null
      ? ""
      : `<line class="wh-last" x1="0" x2="1000" y1="${y(last).toFixed(2)}" y2="${y(last).toFixed(2)}"></line>`;

  // Labels for the biggest open walls on the right edge, nearest-first so they do not overlap.
  const labelled: number[] = [];
  const rightLabels = drawn
    .filter((w) => w.status === "open")
    .sort((a, b) => wallUsd(b) - wallUsd(a))
    .slice(0, 10)
    .map((w) => {
      const top = (y(w.price) / 1000) * 100;
      if (labelled.some((t) => Math.abs(t - top) < 4.5)) return "";
      labelled.push(top);
      return `<span class="wh-yr wh-${w.side}-t" style="top:${top.toFixed(2)}%">${formatUsd(wallUsd(w))} ${formatPrice(w.price)}</span>`;
    })
    .join("");

  const gridLines = [0.1, 0.37, 0.63, 0.9];
  const grid = gridLines
    .map((f) => `<line class="cvd-grid" x1="0" x2="1000" y1="${f * 1000}" y2="${f * 1000}"></line>`)
    .join("");
  const leftLabels = gridLines
    .map(
      (f) =>
        `<span class="cvd-yl" style="top:${(f * 100).toFixed(2)}%">${formatPrice(hi - f * (hi - lo))}</span>`,
    )
    .join("");

  const tickHours = hours <= 6 ? 1 : hours <= 24 ? 4 : 12;
  const tickMs = tickHours * 3_600_000;
  const xLabels: string[] = [];
  for (let ms = Math.ceil(fromMs / tickMs) * tickMs; ms < toMs; ms += tickMs) {
    const d = new Date(ms);
    const midnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
    const text = midnight
      ? tr("{month} {day}", { month: trMsg(MONTHS[d.getUTCMonth()] ?? ""), day: d.getUTCDate() })
      : `${String(d.getUTCHours()).padStart(2, "0")}:00`;
    xLabels.push(
      `<span class="cvd-x${midnight ? " cvd-day" : ""}${xLabels.length % 2 ? " x-alt" : ""}" style="left:${(((ms - fromMs) / span) * 100).toFixed(2)}%">${text}</span>`,
    );
  }

  const title =
    barMinutes >= 60
      ? tr("{asset} · Binance perp · {n}-hour bars, UTC", { asset: label, n: barMinutes / 60 })
      : tr("{asset} · Binance perp · {n}-minute bars, UTC", { asset: label, n: barMinutes });
  const keys = `<p class="fchart-keys wh-keys"><span><i class="wh-key-bid"></i>${tr("bid wall (buy orders)")}</span><span><i class="wh-key-ask"></i>${tr("ask wall (sell orders)")}</span><span><i class="wh-key-ended"></i>${tr("faded: filled or pulled")}</span><span><i class="wh-key-buy"></i>${tr("large taker buy")}</span><span><i class="wh-key-sell"></i>${tr("large taker sell")}</span><span><i class="wh-key-last"></i>${tr("last price")}</span></p>`;

  return `<figure class="fchart cvd-chart wh-chart">
<figcaption class="fchart-title">${title}</figcaption>
${keys}
<div class="fchart-plot wh-plot">
<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(title.replace(/<[^>]+>/g, ""))}">${grid}${body}${lines}${lastLine}</svg>
${circles}${leftLabels}${rightLabels}${xLabels.join("")}
</div>
</figure>`;
}

export function whales(data: {
  overview: Overview;
  whales: WhaleData;
  asset: string;
  assetClass: AssetClass;
  params: WhaleParams;
  now: number;
}): string {
  const { overview, whales: book, asset, assetClass, params, now } = data;
  const label = assetName(asset, assetClass);
  const selfPath = whalesPath(asset, assetClass);
  const window = params.window;

  // --- market strip and window strip -----------------------------------------------------------
  const marketStrip = book.markets.length
    ? `<nav class="wh-markets" aria-label="${tr("Markets")}">${book.markets
        .map((m) => {
          const on = m.base === asset && m.asset_class === assetClass;
          const href = esc(whalesPath(m.base, m.asset_class) + whaleToQuery(params));
          return `<a href="${href}" data-k="${esc(assetKey(m.base, m.asset_class))}"${on ? ' class="on" aria-current="page"' : ""}>${assetName(m.base, m.asset_class)}</a>`;
        })
        .join("")}</nav>`
    : "";
  const windowStrip = `<nav class="tf" aria-label="${tr("Window")}">${WHALE_WINDOW_KEYS.map(
    (key) => {
      const href = esc(selfPath + whaleToQuery({ ...params, window: key }));
      return key === window
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

  const tiles = `<div class="cvd-tiles wh-tiles" data-live="wh-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Bid walls resting")}</p><p class="cvd-big cvd-up"><span data-u="bids">${formatUsd(sum(bids))}</span></p><p class="dim">${tr("{n} buy walls below the price", { n: bids.length })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Ask walls resting")}</p><p class="cvd-big cvd-down"><span data-u="asks">${formatUsd(sum(asks))}</span></p><p class="dim">${tr("{n} sell walls above the price", { n: asks.length })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Largest wall")}</p><p class="cvd-big${largest ? (largest.side === "bid" ? " cvd-up" : " cvd-down") : ""}"><span data-u="largest">${largest ? formatUsd(largest.current_usd) : "–"}</span></p><p class="dim">${largest ? tr("{side} at {price}", { side: sideLabel(largest.side), price: formatPrice(largest.price) }) : tr("none resting")}</p></div>
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
          candles: book.candles,
          walls: book.walls,
          trades: book.trades,
          params,
          now,
        });

  // --- tables -------------------------------------------------------------------------------------
  const dist = (price: number) => (last === null ? "–" : signedPct(((price - last) / last) * 100));
  const openRows = [...open]
    .sort((a, b) => b.current_usd - a.current_usd)
    .map(
      (w) => `<tr data-k="${esc(`${w.side}:${w.price}:${w.first_seen.getTime()}`)}">
<td class="${w.side === "bid" ? "cvd-up" : "cvd-down"}">${sideLabel(w.side)}</td>
<td class="num">${formatPrice(w.price)}</td>
<td class="num dim">${dist(w.price)}</td>
<td class="num"><span data-u="size">${formatUsd(w.current_usd)}</span></td>
<td class="num dim">${formatUsd(w.peak_usd)}</td>
<td class="num dim">${since(w.first_seen, now)}</td>
</tr>`,
    )
    .join("");
  const openTable = open.length
    ? `<div class="sheet-wrap"><table class="sheet wh-table">
<thead><tr><th>${tr("Side")}</th><th class="num">${tr("Price")}</th><th class="num" title="${tr("From the last price")}">${tr("Distance")}</th><th class="num">${tr("Size")}</th><th class="num" title="${tr("The most it has held")}">${tr("Peak")}</th><th class="num" title="${tr("Since the collector first saw it")}">${tr("Resting since")}</th></tr></thead>
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
<td class="num">${formatPrice(w.price)}</td>
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

  const tradeRows = book.trades
    .slice(0, 25)
    .map(
      (t) => `<tr data-k="${esc(`${t.side}:${t.traded_at.getTime()}:${t.price}`)}">
<td class="${t.side === "buy" ? "cvd-up" : "cvd-down"}">${takerLabel(t.side)}</td>
<td class="num">${formatPrice(t.price)}</td>
<td class="num dim">${dist(t.price)}</td>
<td class="num">${formatUsd(t.notional_usd)}</td>
<td class="num dim">${t.fills}</td>
<td class="num dim">${since(t.traded_at, now)}</td>
</tr>`,
    )
    .join("");
  const tradeTable = book.trades.length
    ? `<div class="sheet-wrap"><table class="sheet wh-table">
<thead><tr><th>${tr("Side")}</th><th class="num">${tr("Price")}</th><th class="num" title="${tr("From the last price")}">${tr("Distance")}</th><th class="num">${tr("Size")}</th><th class="num" title="${tr("Aggregate trades in the burst: roughly the price levels it took")}">${tr("Fills")}</th><th class="num">${tr("When")}</th></tr></thead>
<tbody data-live="wh-trades">${tradeRows}</tbody>
</table></div>`
    : `<p class="empty">${tr("No taker burst of {floor} or more in the last {window}.", { floor, window })}</p>`;

  const help = `<p>${tr("Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.", { asset: label, floor, bid: `<span class="cvd-up">${tr("bid wall")}</span>`, ask: `<span class="cvd-down">${tr("ask wall")}</span>` })}</p><p>${tr("Each circle is a large market order: every fill on one side in the same millisecond, counted as one burst, of at least the same {floor}. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the burst. The chart draws the 200 largest in the window.", { floor })}</p><p>${tr("A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.")}</p><p>${tr("The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.")}</p>`;

  return layout({
    title:
      asset === "BTC" && assetClass === "crypto"
        ? tr("Whale orders")
        : `${asset} ${tr("whale orders")}`,
    description: tr(
      "Large resting limit orders and large market orders in Binance futures, drawn over the price: where the walls sit, how big, whether they were filled or pulled, and who hit them.",
    ),
    path: "/whales",
    overview,
    now,
    body: `${helpHeading("h1", tr("Whale orders"), "whales", help)}
${marketStrip}
<div class="lq-controls">${windowStrip}${pulledToggle}</div>
${
  book.market === null
    ? `<p class="empty">${book.markets.length ? tr("{asset} is not one of the forty markets tracked.", { asset: label }) : tr("The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.")}</p>`
    : `${tiles}
<div id="wh-chart" class="cvd-anchor">${chart}</div>
<h2 class="cvd-h2 has-help">${tr("Resting now")}${helpButton("wh-open")}</h2>
${helpPanel("wh-open", `<p>${tr("Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.")}</p>`)}
${openTable}
<h2 class="cvd-h2">${tr("Ended in the last {window}", { window })}</h2>
${endedTable}
<h2 class="cvd-h2">${tr("Largest trades in the last {window}", { window })}</h2>
${tradeTable}`
}`,
  });
}
