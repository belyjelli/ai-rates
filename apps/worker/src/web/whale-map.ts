import type { WhalePosition } from "../app/data";
import { WHALE_FLOORS, type WhaleFloor, type WhaleZoom } from "../app/params";
import { ageText, esc, formatPrice, formatUsd } from "./format";
import { helpButton, helpPanel } from "./help";
import { tr } from "./i18n";
import {
  SLOT_BAND,
  SLOT_CURSOR,
  SLOT_HAIR,
  slotCursorSwitch,
  slotData,
  type WhaleSlots,
} from "./slot-chart";
import { explorerAddress, shortAddress } from "./whales";

/**
 * The /liquidations whale map: Hyperliquid's large positions in one asset and the price each one
 * liquidates at, as the exchange reports it for each account (collector migration 032).
 *
 * REPORTED, NOT MODELED. The Sides tab's pending strip estimates where positions might sit from
 * open interest and a leverage mix; nothing there is anyone's actual position. Here every bar is
 * positions Hyperliquid reported for named accounts, each with Hyperliquid's own liquidation price,
 * so the map is exact for what it covers -- and it covers only the accounts the collector watches
 * (the leaderboard's larger ones and the large traders it has seen), on one exchange. The help says
 * both, and the table names every account so a reader can check one on Hyperliquid's explorer.
 *
 * DISTANCES ARE PER MARKET. An asset can trade on several of Hyperliquid's dexes (gold on more than
 * one HIP-3 dex), each with its own mark, so a position's distance to liquidation is measured from
 * its own market's mark and drawn at that distance from the main market's mark.
 */

/** Price bands across the axis, and the table's length. */
const BANDS = 80;
const TABLE_ROWS = 100;
const MINUS = "−";

/** A position with what the map needs: its side, and its distance to liquidation from its mark. */
interface Placed {
  p: WhalePosition;
  long: boolean;
  /** Liquidation price over the position's own mark, less one; null when either is missing. */
  distance: number | null;
}

/** "$1M", "$100k": the floors as the switch and the sentences name them. */
export const floorLabel = (floor: WhaleFloor) => (floor === "1m" ? "$1M" : "$100k");

const positionCount = (n: number) =>
  n === 1 ? tr("{n} position", { n }) : tr("{n} positions", { n });

const signedPct = (fraction: number, digits = 1) => {
  const text = Math.abs(fraction * 100).toFixed(digits);
  if (Number(text) === 0) return `${(0).toFixed(digits)}%`;
  return `${fraction < 0 ? MINUS : "+"}${text}%`;
};

/** The main market's mark: the one holding the most of the positions shown. */
function mainMark(placed: readonly Placed[]): number | null {
  const byMarket = new Map<string, { usd: number; mark: number }>();
  for (const { p } of placed) {
    if (p.mark_price === null || p.mark_price <= 0) continue;
    const entry = byMarket.get(p.coin) ?? { usd: 0, mark: p.mark_price };
    entry.usd += p.position_usd;
    byMarket.set(p.coin, entry);
  }
  let best: { usd: number; mark: number } | null = null;
  for (const entry of byMarket.values()) if (!best || entry.usd > best.usd) best = entry;
  return best?.mark ?? null;
}

function whaleChart(data: {
  label: string;
  placed: readonly Placed[];
  mark: number;
  floor: WhaleFloor;
  zoom: WhaleZoom;
}): string {
  const { label, placed, mark, floor, zoom } = data;
  const range = zoom / 100;
  const low = mark * (1 - range);
  const step = (2 * range * mark) / BANDS;
  const longs = new Array<number>(BANDS).fill(0);
  const shorts = new Array<number>(BANDS).fill(0);
  const nLongs = new Array<number>(BANDS).fill(0);
  const nShorts = new Array<number>(BANDS).fill(0);
  let beyondLong = 0;
  let beyondShort = 0;
  for (const x of placed) {
    if (x.distance === null) continue;
    const at = Math.floor((mark * (1 + x.distance) - low) / step);
    if (at < 0 || at >= BANDS) {
      if (x.long) beyondLong += x.p.position_usd;
      else beyondShort += x.p.position_usd;
      continue;
    }
    if (x.long) {
      longs[at] = (longs[at] ?? 0) + x.p.position_usd;
      nLongs[at] = (nLongs[at] ?? 0) + 1;
    } else {
      shorts[at] = (shorts[at] ?? 0) + x.p.position_usd;
      nShorts[at] = (nShorts[at] ?? 0) + 1;
    }
  }
  // Everything that liquidates between the mark and each band: longs on the way down, shorts up.
  const mid = (i: number) => low + (i + 0.5) * step;
  const cumulative = new Array<number>(BANDS).fill(0);
  let run = 0;
  for (let i = BANDS - 1; i >= 0; i--) {
    if (mid(i) >= mark) continue;
    run += longs[i] ?? 0;
    cumulative[i] = run;
  }
  run = 0;
  for (let i = 0; i < BANDS; i++) {
    if (mid(i) < mark) continue;
    run += shorts[i] ?? 0;
    cumulative[i] = run;
  }

  const peak = Math.max(1, ...longs.map((l, i) => l + (shorts[i] ?? 0)));
  const cumPeak = Math.max(1, ...cumulative);
  const slot = 1000 / BANDS;
  const barWidth = slot * 0.78;
  const y = (usd: number, top: number) => 1000 - (usd / top) * 1000;
  const bars = longs
    .map((l, i) => {
      const x = (i * slot + (slot - barWidth) / 2).toFixed(2);
      const s = shorts[i] ?? 0;
      let out = "";
      if (l > 0) {
        out += `<rect class="wm-long" x="${x}" y="${y(l, peak).toFixed(1)}" width="${barWidth.toFixed(2)}" height="${((l / peak) * 1000).toFixed(1)}"></rect>`;
      }
      if (s > 0) {
        out += `<rect class="wm-short" x="${x}" y="${y(l + s, peak).toFixed(1)}" width="${barWidth.toFixed(2)}" height="${((s / peak) * 1000).toFixed(1)}"></rect>`;
      }
      return out;
    })
    .join("");
  const line = (side: "l" | "s") => {
    const points: string[] = [];
    for (let i = 0; i < BANDS; i++) {
      if (side === "l" ? mid(i) >= mark : mid(i) < mark) continue;
      points.push(`${((i + 0.5) * slot).toFixed(1)},${y(cumulative[i] ?? 0, cumPeak).toFixed(1)}`);
    }
    return points.length > 1
      ? `<polyline class="wm-cum-${side}" points="${points.join(" ")}"></polyline>`
      : "";
  };
  const levels = [0.25, 0.5, 0.75];
  const grid = levels
    .map((f) => `<line class="cvd-grid" x1="0" x2="1000" y1="${f * 1000}" y2="${f * 1000}"></line>`)
    .join("");
  const leftLabels = levels
    .map((f) => `<span class="cvd-yl" style="top:${f * 100}%">${formatUsd(peak * (1 - f))}</span>`)
    .join("");
  const rightLabels = levels
    .map(
      (f) => `<span class="cvd-yr" style="top:${f * 100}%">${formatUsd(cumPeak * (1 - f))}</span>`,
    )
    .join("");
  const ticks = [-1, -0.5, 0, 0.5, 1];
  const xLabels = ticks
    .map((t, n) => {
      const price = mark * (1 + t * range);
      const text =
        t === 0
          ? tr("mark {price}", { price: formatPrice(mark) })
          : `${formatPrice(price)} <span class="dim">${signedPct(t * range, 0)}</span>`;
      return `<span class="cvd-x${t === 0 ? " wm-x-mark" : ""}${n % 2 ? " x-alt" : ""}" style="left:${((t + 1) * 50).toFixed(2)}%">${text}</span>`;
    })
    .join("");

  const totalLong = placed.filter((x) => x.long).reduce((sum, x) => sum + x.p.position_usd, 0);
  const totalShort = placed.filter((x) => !x.long).reduce((sum, x) => sum + x.p.position_usd, 0);
  const idle = tr(
    "{n} positions of {floor} or more · {longs} of longs, {shorts} of shorts · hover or tap a bar to read it",
    {
      n: placed.length,
      floor: floorLabel(floor),
      longs: `<b class="lq-ink-l">${formatUsd(totalLong)}</b>`,
      shorts: `<b class="lq-ink-s">${formatUsd(totalShort)}</b>`,
    },
  );
  const payload: WhaleSlots = {
    kind: "wmap",
    low,
    step,
    mark,
    slots: longs.map((l, i) =>
      l > 0 || (shorts[i] ?? 0) > 0
        ? [Math.round(l), Math.round(shorts[i] ?? 0), nLongs[i] ?? 0, nShorts[i] ?? 0]
        : null,
    ),
    cumulative: cumulative.map(Math.round),
  };
  const axes = esc(JSON.stringify({ l: ["amount", 0, peak], r: ["amount", 0, cumPeak] }));
  const beyond =
    beyondLong + beyondShort > 0
      ? `<p class="fchart-note dim">${tr(
          "Beyond ±{pct} of the mark, off the chart: {longs} of longs and {shorts} of shorts.",
          {
            pct: `${Math.round(range * 100)}%`,
            longs: formatUsd(beyondLong),
            shorts: formatUsd(beyondShort),
          },
        )}</p>`
      : "";

  return `<figure class="fchart cvd-chart wm-chart" data-live="whale-chart" data-cursors>
<div class="fchart-head"><p class="fchart-title">${tr("{asset} · whale positions on Hyperliquid by liquidation price", { asset: label })}</p><div class="fchart-keys"><span><i class="wm-key-l"></i>${tr("Longs liquidate")}</span><span><i class="wm-key-s"></i>${tr("Shorts liquidate")}</span><span><i class="wm-key-cum"></i>${tr("Total to the mark")}</span>${slotCursorSwitch()}</div><p class="fchart-read slot-read" aria-live="polite">${idle}</p></div>
<div class="slot-area" tabindex="0" role="group" aria-label="${esc(tr("{asset} price bands; arrow keys read one at a time", { asset: label.replace(/<[^>]+>/g, "") }))}">
<div class="fchart-plot wm-plot" data-axes="${axes}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{asset} whale positions by the price they liquidate at", { asset: label.replace(/<[^>]+>/g, "") }))}">${grid}${SLOT_BAND}${bars}${line("l")}${line("s")}<line class="wm-mark" x1="500" x2="500" y1="0" y2="1000"></line>${SLOT_CURSOR}${SLOT_HAIR}</svg>${leftLabels}${rightLabels}${xLabels}</div>
</div>
${beyond}
${slotData(payload)}
</figure>`;
}

/** The whale map's tab body, below its controls. */
export function whalePanel(data: {
  asset: string;
  label: string;
  /** Every stored position of $100k or more in the asset; null when the read failed. */
  positions: readonly WhalePosition[] | null;
  floor: WhaleFloor;
  zoom: WhaleZoom;
  picker: string;
  floorStrip: string;
  now: number;
}): string {
  const { label, positions, floor, zoom, picker, floorStrip, now } = data;
  const controls = `<div class="lq-controls">${picker}${floorStrip}${helpButton("liq-whales")}</div>
${helpPanel(
  "liq-whales",
  `<p>${tr(
    "Every position here is one Hyperliquid reports for a named account, with the exchange's own liquidation price: reported, not modeled. Hyperliquid is the one exchange that publishes every account's positions; no other venue is in this map.",
  )}</p><p>${tr(
    "The collector watches the accounts on Hyperliquid's leaderboard worth $100k or more, and any account it sees in a large trade on Hyperliquid's busiest markets. It re-reads each one every few minutes while it holds $1M or more, hourly while it holds $100k, and sooner whenever it trades. So the map covers the largest traders, not every account.",
  )}</p><p>${tr(
    "A cross-margin position's liquidation price moves with the rest of its account: its other positions' profit and loss, deposits and withdrawals. Each one is as of its account's last read, shown in the table. Bars are the money that liquidates in each price band, longs below the mark and shorts above; the lines add up everything between the mark and that price.",
  )}</p>`,
)}`;
  if (positions === null) {
    return `${controls}<p class="empty">${tr("The whale positions could not be read right now.")}</p>`;
  }

  const floorUsd = WHALE_FLOORS[floor];
  const shown = positions.filter((p) => p.position_usd >= floorUsd);
  if (shown.length === 0) {
    const smaller = positions.length;
    return `${controls}<p class="empty">${tr(
      "No Hyperliquid position of {floor} or more in {asset} among the accounts watched.",
      { floor: floorLabel(floor), asset: label },
    )}${
      floor === "1m" && smaller > 0
        ? ` ${tr("There are {n} of $100k or more: switch to $100k+.", { n: smaller })}`
        : ""
    }</p>`;
  }

  const placed: Placed[] = shown.map((p) => ({
    p,
    long: p.size > 0,
    distance:
      p.liquidation_price !== null && p.mark_price !== null && p.mark_price > 0
        ? p.liquidation_price / p.mark_price - 1
        : null,
  }));
  const mark = mainMark(placed);
  const longs = placed.filter((x) => x.long);
  const shorts = placed.filter((x) => !x.long);
  const sum = (xs: readonly Placed[]) => xs.reduce((total, x) => total + x.p.position_usd, 0);
  const nearest = (xs: readonly Placed[]) =>
    xs
      .filter((x) => x.distance !== null)
      .sort((a, b) => Math.abs(a.distance as number) - Math.abs(b.distance as number))[0];
  const within = (xs: readonly Placed[]) =>
    sum(xs.filter((x) => x.distance !== null && Math.abs(x.distance) <= 0.05 + 1e-9));
  const nearestLine = (x: Placed | undefined) =>
    x
      ? tr("nearest at {price} ({pct})", {
          price: formatPrice(x.p.liquidation_price),
          pct: signedPct(x.distance as number),
        })
      : tr("none with a liquidation price");
  const accounts = new Set(shown.map((p) => p.address)).size;
  const ages = shown.map((p) => now - p.read_at.getTime()).sort((a, b) => a - b);
  const medianRead = new Date(now - (ages[Math.floor(ages.length / 2)] ?? 0));

  const tiles = `<div class="cvd-tiles" data-live="whale-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Whale longs")}</p><p class="cvd-big lq-ink-l"><span data-u="longs">${formatUsd(sum(longs))}</span></p><p class="dim">${positionCount(longs.length)} · ${nearestLine(nearest(longs))}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Whale shorts")}</p><p class="cvd-big lq-ink-s"><span data-u="shorts">${formatUsd(sum(shorts))}</span></p><p class="dim">${positionCount(shorts.length)} · ${nearestLine(nearest(shorts))}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Within 5% of the mark")}</p><p class="cvd-big"><span data-u="near-l" class="lq-ink-l">${formatUsd(within(longs))}</span> / <span data-u="near-s" class="lq-ink-s">${formatUsd(within(shorts))}</span></p><p class="dim">${tr("longs below / shorts above")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Accounts")}</p><p class="cvd-big"><span data-u="accounts">${accounts}</span></p><p class="dim">${tr("read a median {age}", { age: ageText(medianRead, now) })}</p></div>
</div>`;

  const chart =
    mark === null
      ? `<p class="empty">${tr("No live mark for {asset}, so the positions cannot be placed on a price axis.", { asset: label })}</p>`
      : whaleChart({ label, placed, mark, floor, zoom });

  // Nearest to liquidation first; those with none (margin covers any move) after, largest first.
  const ordered = [...placed].sort((a, b) => {
    if (a.distance === null || b.distance === null) {
      return a.distance === null && b.distance === null
        ? b.p.position_usd - a.p.position_usd
        : a.distance === null
          ? 1
          : -1;
    }
    return Math.abs(a.distance) - Math.abs(b.distance);
  });
  const markets = new Set(shown.map((p) => p.coin));
  const showMarket = markets.size > 1 || [...markets].some((coin) => coin.includes(":"));
  const rows = ordered
    .slice(0, TABLE_ROWS)
    .map(({ p, long, distance }) => {
      const pnl = p.unrealized_pnl_usd;
      return `<tr data-k="${esc(`${p.address}|${p.coin}`)}">
<td><a class="wh-addr" href="${esc(explorerAddress(p.address))}" target="_blank" rel="noopener" title="${esc(p.address)}">${esc(shortAddress(p.address))}</a></td>
${showMarket ? `<td class="dim">${esc(p.coin)}</td>` : ""}<td class="${long ? "lq-ink-l" : "lq-ink-s"}">${long ? tr("long") : tr("short")}</td>
<td class="num"><span data-u="value">${formatUsd(p.position_usd)}</span></td>
<td class="num">${formatPrice(p.entry_price)}</td>
<td class="num">${p.liquidation_price === null ? `<span class="dim" title="${esc(tr("Hyperliquid reports no liquidation price: the account's margin covers any move"))}">${tr("none")}</span>` : formatPrice(p.liquidation_price)}</td>
<td class="num">${distance === null ? "–" : `<span data-u="distance">${signedPct(distance)}</span>`}</td>
<td class="num">${p.leverage === null ? "–" : `${p.leverage}× ${p.leverage_type === "isolated" ? tr("isolated") : tr("cross")}`}</td>
<td class="num${pnl === null ? "" : pnl > 0 ? " cvd-up" : pnl < 0 ? " cvd-down" : ""}">${pnl === null ? "–" : `${pnl > 0 ? "+" : ""}${formatUsd(pnl)}`}</td>
<td class="num">${p.account_value_usd === null ? "–" : formatUsd(p.account_value_usd)}</td>
<td class="num dim">${ageText(p.read_at, now)}</td>
</tr>`;
    })
    .join("");
  const more =
    ordered.length > TABLE_ROWS
      ? `<p class="notes">${tr("The {n} nearest to liquidation of {total}.", { n: TABLE_ROWS, total: ordered.length })}</p>`
      : "";
  const table = `<h2 class="cvd-h2 wm-h2">${tr("Positions by distance to liquidation")}</h2>
<div class="sheet-wrap"><table class="sheet wm-table">
<thead><tr><th>${tr("Trader")}</th>${showMarket ? `<th>${tr("Market")}</th>` : ""}<th>${tr("Side")}</th><th class="num">${tr("Value")}</th><th class="num">${tr("Entry")}</th><th class="num">${tr("Liquidates at")}</th><th class="num" title="${esc(tr("From the market's mark to the liquidation price"))}">${tr("Distance")}</th><th class="num">${tr("Leverage")}</th><th class="num">${tr("Unrealized")}</th><th class="num" title="${esc(tr("The whole account's value on that dex"))}">${tr("Account")}</th><th class="num">${tr("Read")}</th></tr></thead>
<tbody data-live="whale-rows">${rows}</tbody>
</table></div>
${more}`;

  return `${controls}
${tiles}
${chart}
${table}`;
}
