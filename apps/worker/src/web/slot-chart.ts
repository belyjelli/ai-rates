/**
 * Hover reading for the bar charts that divide an axis into equal slots: the CVD chart and the
 * liquidations longs-vs-shorts chart over time, and the whale map and Gamma Exposure chart over price.
 *
 * WHY THIS REPLACED A NATIVE <title> PER BAR. The title was the only readout, and it answered badly:
 * it appears after a delay, only over the bar's own hit box, never on a phone, and it covers the bars
 * beside the one being read. Here the pointer anywhere over the plot picks the slot under it, a
 * cursor line and a band mark that slot on every panel, and its figures replace the header readout,
 * so nothing floats over the chart. The same slot's numbers stay readable while the pointer scrubs.
 *
 * ONE DELEGATED LISTENER ON THE DOCUMENT, not a binding per chart. live.ts refreshes a chart by
 * swapping its figure's innerHTML, and scripts set through innerHTML never run, so a per-figure
 * binding would go dead on the first refresh. The document outlives every swap; each event finds its
 * figure with closest() and reads that figure's own payload, which is also what keeps two charts on
 * one page (the liquidations tabs) apart.
 *
 * THE TEXT IS WRITTEN ONCE. `cvdText` and `sidesText` build the readout both on the server, for the
 * whole-window line a reader sees before hovering (and all a reader without JavaScript gets), and in
 * the browser, for one slot. They reach the page through toString, as live.ts's helpers do, so they
 * must not reference anything outside their own bodies and must not declare inner named functions,
 * which a bundler's keep-names pass would wrap in a helper the page does not have.
 *
 * THE WORDS ARE HANDED IN TOO, for the same reason: the browser copy cannot call `tr`. `slotWords`
 * builds them in the page's language on the server; the server's readout gets them through
 * SLOT_FORMAT, the browser's through the payload `slotData` writes, so both read in one language.
 */

import { msg, tr, trMsg } from "./i18n";

/** Month names for every chart's date labels, marked once so each language translates them once. */
export const MONTHS = [
  msg("Jan"),
  msg("Feb"),
  msg("Mar"),
  msg("Apr"),
  msg("May"),
  msg("Jun"),
  msg("Jul"),
  msg("Aug"),
  msg("Sep"),
  msg("Oct"),
  msg("Nov"),
  msg("Dec"),
];

/** The formatters and words the readout uses, handed in so the text functions stay self-contained. */
export interface SlotFormat {
  usd: (value: number, symbol?: string) => string;
  price: (value: number) => string;
  pct: (value: number, digits: number) => string;
  when: (ms: number, words?: SlotWords, offset?: number, unit?: number) => string;
  words: SlotWords;
}

/** The readout's words, as patterns whose `{name}` placeholders the text functions fill. */
export interface SlotWords {
  noFlow: string;
  price: string;
  priceSince: string;
  bought: string;
  sold: string;
  net: string;
  netShare: string;
  nothing: string;
  longsClosed: string;
  shortsClosed: string;
  diff: string;
  even: string;
  longsHeavier: string;
  shortsHeavier: string;
  liquidation: string;
  liquidations: string;
  filling: string;
  /** The twelve month names, "|"-joined, and the slot's date pattern, alone and as a range. */
  months: string;
  when: string;
  whenRange: string;
  /** The whale map's: a price band, what liquidates in it, and what liquidates on the way to it. */
  band: string;
  longsHere: string;
  shortsHere: string;
  position: string;
  positions: string;
  noneHere: string;
  longsToMark: string;
  shortsToMark: string;
  /** The Gamma Exposure chart's: a strike band, its calls and puts, and the net were the spot there. */
  gexStrike: string;
  gexBand: string;
  gexNone: string;
  gexCalls: string;
  gexPuts: string;
  gexNet: string;
  gexIf: string;
  /** The whale chart's: one candle. */
  ohlc: string;
  volume: string;
  burstBuys: string;
  burstSells: string;
  noCandle: string;
  /** The macro charts': a slot's month, quarter or week. */
  macroMonth: string;
  macroQuarter: string;
  macroWeek: string;
}

/** The words in the current render's language. */
export const slotWords = (): SlotWords => ({
  noFlow: tr("no flow recorded"),
  price: tr("close {price}"),
  priceSince: tr("close {price} ({pct} since start)"),
  bought: tr("bought {usd}"),
  sold: tr("sold {usd}"),
  net: tr("net {net}"),
  netShare: tr("net {net} ({pct} of volume)"),
  nothing: tr("nothing force-closed"),
  longsClosed: tr("longs closed {usd}"),
  shortsClosed: tr("shorts closed {usd}"),
  diff: tr("longs − shorts {diff}"),
  even: tr("even"),
  longsHeavier: tr("longs heavier, {pct}%"),
  shortsHeavier: tr("shorts heavier, {pct}%"),
  liquidation: tr("{n} liquidation"),
  liquidations: tr("{n} liquidations"),
  filling: tr("{when} (still filling)"),
  months: MONTHS.map((month) => trMsg(month)).join("|"),
  when: tr("{month} {day} {time} {zone}"),
  whenRange: tr("{month} {day} {time}–{end} {zone}"),
  band: tr("{low} – {high} ({pct} from the mark)"),
  longsHere: tr("longs liquidate here: {usd} ({n})"),
  shortsHere: tr("shorts liquidate here: {usd} ({n})"),
  position: tr("{n} position"),
  positions: tr("{n} positions"),
  noneHere: tr("no whale liquidates here"),
  longsToMark: tr("{usd} of longs liquidate between here and the mark"),
  shortsToMark: tr("{usd} of shorts liquidate between the mark and here"),
  gexStrike: tr("strike {strikes} ({pct} from spot)"),
  gexBand: tr("{low} – {high} ({pct} from spot)"),
  gexNone: tr("no open interest here"),
  gexCalls: tr("calls {usd} ({oi} open)"),
  gexPuts: tr("puts {usd} ({oi} open)"),
  gexNet: tr("net {usd}"),
  gexIf: tr("if the spot were here: net {usd}"),
  ohlc: tr("open {open} · high {high} · low {low} · close {close}"),
  volume: tr("volume {usd}"),
  burstBuys: tr("large taker buys {usd} ({n})"),
  burstSells: tr("large taker sells {usd} ({n})"),
  noCandle: tr("no candle"),
  macroMonth: tr("{month} {year}"),
  macroQuarter: tr("Q{q} {year}"),
  macroWeek: tr("week of {month} {day}, {year}"),
});

/**
 * Compact dollars, or another currency by its `symbol`, identical to format.ts's `formatUsd` for any
 * finite number (a test holds them).
 */
export function slotUsd(value: number, symbol = "$"): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const size = abs >= 1e12 ? 1e12 : abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
  if (size === 1) return `${sign}${symbol}${abs.toFixed(0)}`;
  const scaled = abs / size;
  const suffix = size === 1e12 ? "T" : size === 1e9 ? "B" : size === 1e6 ? "M" : "k";
  return `${sign}${symbol}${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)}${suffix}`;
}

/** Prices, identical to format.ts's `formatPrice` for any finite number. */
export function slotPrice(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (abs >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return value.toPrecision(4);
}

/** Signed percent with the site's minus: "+0.12%", "−42.9%", and an unsigned zero. */
export function slotPct(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return `${(0).toFixed(digits)}%`;
  return `${value < 0 ? "−" : "+"}${text}%`;
}

/**
 * "Sep 17 14:15 UTC", or the same moment in the words' language when they are handed in, `offset`
 * minutes east of UTC (the reader's zone, from localtime.ts, in the browser), and as the slot's whole
 * range -- "Sep 17 14:15–14:30 UTC+8" -- when its length `unit` is given.
 */
export function slotWhen(
  ms: number,
  words?: { months: string; when: string; whenRange: string },
  offset = 0,
  unit = 0,
): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const d = new Date(ms + offset * 60_000);
  const e = new Date(ms + unit + offset * 60_000);
  const a = Math.abs(offset);
  const zone =
    offset === 0
      ? "UTC"
      : `UTC${offset > 0 ? "+" : "-"}${Math.floor(a / 60)}${a % 60 ? `:${p(a % 60)}` : ""}`;
  const month = (words ? words.months : "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec").split(
    "|",
  )[d.getUTCMonth()];
  const time = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  const end = `${p(e.getUTCHours())}:${p(e.getUTCMinutes())}`;
  const pattern = unit
    ? words
      ? words.whenRange
      : "{month} {day} {time}–{end} {zone}"
    : words
      ? words.when
      : "{month} {day} {time} {zone}";
  return pattern
    .replace("{month}", () => month ?? "")
    .replace("{day}", () => String(d.getUTCDate()))
    .replace("{time}", () => time)
    .replace("{end}", () => end)
    .replace("{zone}", () => zone);
}

export const SLOT_FORMAT: SlotFormat = {
  usd: slotUsd,
  price: slotPrice,
  pct: slotPct,
  when: slotWhen,
  // A getter, so a readout built inside a render reads that render's language, not the one the
  // module happened to load in.
  get words() {
    return slotWords();
  },
};

/**
 * One CVD reading: a slot's bar, or the whole window's sums. `bar` is [bought, sold, price or null],
 * or null for a slot with no recorded flow. `cvd` is the running total at that point, or null to
 * leave it out -- over the whole window it would only repeat the net. `open` is the window's first
 * price, the base for the change.
 */
export function cvdText(
  head: string,
  bar: readonly [number, number, number | null] | null,
  cvd: number | null,
  open: number | null,
  f: SlotFormat,
): string {
  const w = f.words;
  // Values go in through a function, so a "$" in a dollar figure is never read as a replace pattern.
  const tail =
    cvd === null
      ? ""
      : ` · CVD <b class="${cvd > 0 ? "cvd-up" : cvd < 0 ? "cvd-down" : ""}">${cvd > 0 ? "+" : ""}${f.usd(cvd)}</b>`;
  if (bar === null) return `${head} · ${w.noFlow}${tail}`;
  const [bought, sold, price] = bar;
  const net = bought - sold;
  const volume = bought + sold;
  const parts = [head];
  if (price !== null) {
    parts.push(
      (open ? w.priceSince : w.price)
        .replace("{price}", () => f.price(price))
        .replace("{pct}", () => (open ? f.pct((price / open - 1) * 100, 2) : "")),
    );
  }
  parts.push(
    w.bought.replace("{usd}", () => f.usd(bought)),
    w.sold.replace("{usd}", () => f.usd(sold)),
  );
  parts.push(
    (volume > 0 ? w.netShare : w.net)
      .replace(
        "{net}",
        () =>
          `<b class="${net > 0 ? "cvd-up" : net < 0 ? "cvd-down" : ""}">${net > 0 ? "+" : ""}${f.usd(net)}</b>`,
      )
      .replace("{pct}", () => (volume > 0 ? f.pct((net / volume) * 100, 1) : "")),
  );
  return parts.join(" · ") + tail;
}

/**
 * One longs-vs-shorts reading: [longs closed, shorts closed, events] for a slot or the window, or
 * null for a slot where nothing was force-closed. The difference is longs less shorts, so its sign
 * says which side the move ran against, in that side's colour.
 */
export function sidesText(
  head: string,
  sides: readonly [number, number, number] | null,
  f: SlotFormat,
  totals = true,
): string {
  const w = f.words;
  if (sides === null) return `${head} · ${w.nothing}`;
  const [longs, shorts, events] = sides;
  const diff = longs - shorts;
  const heavier =
    diff === 0
      ? w.even
      : (diff > 0 ? w.longsHeavier : w.shortsHeavier).replace("{pct}", () =>
          String(Math.round((Math.max(longs, shorts) / (longs + shorts)) * 100)),
        );
  return [
    head,
    // The idle readout skips both: the legend above already shows them.
    totals ? w.longsClosed.replace("{usd}", () => f.usd(longs)) : "",
    totals ? w.shortsClosed.replace("{usd}", () => f.usd(shorts)) : "",
    w.diff.replace(
      "{diff}",
      () =>
        `<b class="${diff > 0 ? "lq-ink-l" : diff < 0 ? "lq-ink-s" : ""}">${diff > 0 ? "+" : ""}${f.usd(diff)}</b>`,
    ),
    heavier,
    (events === 1 ? w.liquidation : w.liquidations).replace("{n}", () =>
      events.toLocaleString("en-US"),
    ),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * One whale-map reading: price band i of d, what liquidates in it, and everything that liquidates
 * between the mark and it -- longs on the way down to a band under the mark, shorts on the way up to
 * one over it.
 */
export function whaleText(d: WhaleSlots, i: number, f: SlotFormat): string {
  const w = f.words;
  const low = d.low + i * d.step;
  const mid = low + d.step / 2;
  const parts = [
    w.band
      .replace("{low}", () => f.price(low))
      .replace("{high}", () => f.price(low + d.step))
      .replace("{pct}", () => f.pct((mid / d.mark - 1) * 100, 1)),
  ];
  const slot = d.slots[i];
  const count = (n: number) => (n === 1 ? w.position : w.positions).replace("{n}", () => String(n));
  if (slot === null || slot === undefined) parts.push(w.noneHere);
  else {
    if (slot[0] > 0) {
      parts.push(
        w.longsHere
          .replace("{usd}", () => `<b class="lq-ink-l">${f.usd(slot[0])}</b>`)
          .replace("{n}", () => count(slot[2])),
      );
    }
    if (slot[1] > 0) {
      parts.push(
        w.shortsHere
          .replace("{usd}", () => `<b class="lq-ink-s">${f.usd(slot[1])}</b>`)
          .replace("{n}", () => count(slot[3])),
      );
    }
  }
  const toMark = d.cumulative[i] ?? 0;
  if (toMark > 0) {
    parts.push(
      (mid < d.mark ? w.longsToMark : w.shortsToMark).replace("{usd}", () => f.usd(toMark)),
    );
  }
  return parts.join(" · ");
}

/**
 * One Gamma Exposure reading: strike band i of d, the exposure of its calls and puts, the net, and
 * the net exposure of the whole chain were the spot at the band's middle (the profile curve).
 */
export function gammaText(d: GammaSlots, i: number, f: SlotFormat): string {
  const w = f.words;
  const low = d.low + i * d.step;
  const pct = f.pct(((low + d.step / 2) / d.spot - 1) * 100, 1);
  const signed = (usd: number) =>
    `<b class="${usd > 0 ? "lq-ink-l" : usd < 0 ? "lq-ink-s" : ""}">${usd > 0 ? "+" : ""}${f.usd(usd, d.cur)}</b>`;
  const coins = (oi: number) =>
    d.unit ? `${Math.round(oi).toLocaleString("en-US")} ${d.unit}` : f.usd(oi * d.spot, d.cur);
  const slot = d.slots[i];
  const parts: string[] = [];
  if (slot === null || slot === undefined) {
    parts.push(
      w.gexBand
        .replace("{low}", () => f.price(low))
        .replace("{high}", () => f.price(low + d.step))
        .replace("{pct}", () => pct),
      w.gexNone,
    );
  } else {
    parts.push(
      w.gexStrike.replace("{strikes}", () => slot[4]).replace("{pct}", () => pct),
      w.gexCalls.replace("{usd}", () => signed(slot[0])).replace("{oi}", () => coins(slot[2])),
      w.gexPuts.replace("{usd}", () => signed(slot[1])).replace("{oi}", () => coins(slot[3])),
      w.gexNet.replace("{usd}", () => signed(slot[0] + slot[1])),
    );
  }
  const curve = d.curve[i];
  if (curve !== null && curve !== undefined)
    parts.push(w.gexIf.replace("{usd}", () => signed(curve)));
  return parts.join(" · ");
}

/**
 * The price the crosshair's vertical line stands on, for a chart whose x-axis is a price, tagged at
 * the line's foot: a Gamma band's own strikes where it has any (a band starts on its strike, so its
 * middle would name a price nobody trades), else the band's middle, where the line is drawn. Null for
 * a chart across time. Self-contained: it ships as text.
 */
export function slotXPrice(
  d: CvdSlots | SidesSlots | WhaleSlots | GammaSlots | WhaleCandleSlots | MacroSlots,
  i: number,
  price: (value: number) => string,
): string | null {
  if (d.kind !== "gex" && d.kind !== "wmap") return null;
  const slot = d.kind === "gex" ? d.slots[i] : null;
  if (slot?.[4]) return slot[4];
  return price(d.low + (i + 0.5) * d.step);
}

/**
 * What a Gamma Exposure figure ships: one entry per strike band, low to high, [calls' exposure, puts'
 * exposure (negative), calls' open interest, puts' open interest, the strikes in the band as text],
 * or null for a band with no open interest; and for every band the profile curve at its middle, or
 * null beyond the curve's reach. Exposure is per 1% move in the currency whose symbol is `cur`; open
 * interest is in `unit` coins, or, where `unit` is empty, read as its value at the spot.
 */
export interface GammaSlots {
  kind: "gex";
  low: number;
  step: number;
  spot: number;
  unit: string;
  cur: string;
  slots: ([number, number, number, number, string] | null)[];
  curve: (number | null)[];
}

/**
 * One whale-chart candle: its range, open, high, low and close with the move inside it, the venue's
 * volume, and the large taker bursts that fell in it.
 */
export function candleText(d: WhaleCandleSlots, i: number, f: SlotFormat): string {
  const w = f.words;
  const head = f.when(d.from + i * d.unit, w, 0, d.unit);
  const slot = d.slots[i];
  if (slot === null || slot === undefined) return `${head} · ${w.noCandle}`;
  const [open, high, low, close, volume, buys, sells, nBuys, nSells] = slot;
  const move = open ? ((close - open) / open) * 100 : 0;
  const parts = [
    head,
    w.ohlc
      .replace("{open}", () => f.price(open))
      .replace("{high}", () => f.price(high))
      .replace("{low}", () => f.price(low))
      .replace(
        "{close}",
        () =>
          `<b class="${close >= open ? "cvd-up" : "cvd-down"}">${f.price(close)}</b> (${f.pct(move, 2)})`,
      ),
  ];
  if (volume > 0) parts.push(w.volume.replace("{usd}", () => f.usd(volume)));
  if (nBuys > 0) {
    parts.push(
      w.burstBuys
        .replace("{usd}", () => `<b class="cvd-up">${f.usd(buys)}</b>`)
        .replace("{n}", () => String(nBuys)),
    );
  }
  if (nSells > 0) {
    parts.push(
      w.burstSells
        .replace("{usd}", () => `<b class="cvd-down">${f.usd(sells)}</b>`)
        .replace("{n}", () => String(nSells)),
    );
  }
  return parts.join(" · ");
}

/**
 * What a whale-chart figure ships: one entry per candle slot, oldest first, [open, high, low, close,
 * volume, large taker buys, large taker sells, how many of each], or null for a slot with no candle.
 */
export interface WhaleCandleSlots {
  kind: "wcandle";
  from: number;
  unit: number;
  slots: ([number, number, number, number, number, number, number, number, number] | null)[];
}

/**
 * What a macro chart ships (web/macro.ts): each slot's start, epoch milliseconds UTC, and its grain --
 * "m" a month, "q" a quarter, "w" a week -- and each line's label, values (null where the series has
 * none), the suffix its values read with ("%", " pp", "k"; "$" reads as compact dollars instead) and
 * its decimals, and whether it reads signed.
 */
export interface MacroSlots {
  kind: "macro";
  g: "m" | "q" | "w";
  slots: number[];
  lines: { l: string; v: (number | null)[]; u: string; d: number; s: boolean }[];
}

/** One macro reading: slot i's period, and every line's value there. */
export function macroText(d: MacroSlots, i: number, f: SlotFormat): string {
  const w = f.words;
  const at = new Date(d.slots[i] ?? 0);
  const month = w.months.split("|")[at.getUTCMonth()] ?? "";
  const year = String(at.getUTCFullYear());
  const head =
    d.g === "q"
      ? w.macroQuarter
          .replace("{q}", () => String(Math.floor(at.getUTCMonth() / 3) + 1))
          .replace("{year}", () => year)
      : d.g === "w"
        ? w.macroWeek
            .replace("{month}", () => month)
            .replace("{day}", () => String(at.getUTCDate()))
            .replace("{year}", () => year)
        : w.macroMonth.replace("{month}", () => month).replace("{year}", () => year);
  const parts = [head];
  for (const line of d.lines) {
    const v = line.v[i];
    if (v === null || v === undefined) continue;
    const sign = v < 0 ? "−" : line.s && v > 0 ? "+" : "";
    const text =
      line.u === "$"
        ? sign + f.usd(Math.abs(v))
        : sign +
          Math.abs(v).toLocaleString("en-US", {
            minimumFractionDigits: line.d,
            maximumFractionDigits: line.d,
          }) +
          line.u;
    parts.push(`${line.l} <b>${text}</b>`);
  }
  return parts.join(" · ");
}

/**
 * What a whale-map figure ships: one entry per price band, low to high, [longs liquidating in it,
 * shorts liquidating in it, how many of each], or null for a band where none does; and for every
 * band, empty or not, everything that liquidates between the mark and it.
 */
export interface WhaleSlots {
  kind: "wmap";
  /** The lowest band's low price, each band's width, and the mark the distances are from. */
  low: number;
  step: number;
  mark: number;
  slots: ([number, number, number, number] | null)[];
  cumulative: number[];
}

/** What a CVD figure ships: one entry per slot, oldest first, [bought, sold, CVD so far, price]. */
export interface CvdSlots {
  kind: "cvd";
  /** First slot's start, epoch ms, and the slot length. */
  from: number;
  unit: number;
  /** The window's first price, or null when no slot has one. */
  open: number | null;
  slots: ([number, number, number, number | null] | null)[];
}

/** What a longs-vs-shorts figure ships: one entry per slot, [longs closed, shorts closed, events]. */
export interface SidesSlots {
  kind: "lqc";
  from: number;
  unit: number;
  slots: ([number, number, number] | null)[];
}

/**
 * The payload as a JSON script tag, `<` escaped so no value can close it. It carries the readout's
 * words in the render's language, which the browser copy of the text functions reads them from.
 */
export function slotData(
  payload: CvdSlots | SidesSlots | WhaleSlots | GammaSlots | WhaleCandleSlots | MacroSlots,
): string {
  return `<script type="application/json" class="slot-data">${JSON.stringify({ ...payload, words: slotWords() }).replace(/</g, "\\u003c")}</script>`;
}

/**
 * The two marks each panel carries, hidden until a slot is read: a band behind the bars, which goes
 * first in the SVG, and a cursor line through the slot's centre, which goes last so it draws on top.
 */
export const SLOT_BAND = `<rect class="slot-mark slot-band off" x="0" y="0" width="0" height="1000"></rect>`;
export const SLOT_CURSOR = `<line class="slot-mark fchart-cursor off" x1="0" x2="0" y1="0" y2="1000"></line>`;

/**
 * The crosshair's level line, for a chart that offers the crosshair (a figure marked data-cursors):
 * one per panel, last in its SVG, drawn at the pointer's height in the panel the pointer is over. It
 * is not a .slot-mark, so it is never placed as the cursor line is.
 */
export const SLOT_HAIR = `<line class="slot-hair off" x1="0" x2="1000" y1="0" y2="0"></line>`;

/**
 * The switch between the two cursors, for the chart's head: "bar", the band behind the bar under the
 * pointer, and "cross", a dashed crosshair with the value at the pointer on each axis. It needs the
 * script, so it is hidden until the script shows it; the choice is the reader's, kept in their browser.
 */
export function slotCursorSwitch(): string {
  return `<div class="slot-modes" role="group" aria-label="${tr("Cursor")}" hidden><span>${tr("cursor")}</span><button type="button" class="slot-mode" data-cursor="bar" aria-pressed="false" title="${tr("Light up the bar under the pointer")}">${tr("bar")}</button><button type="button" class="slot-mode" data-cursor="cross" aria-pressed="true" title="${tr("Dashed crosshair at the pointer, with the value there on each axis")}">${tr("cross")}</button></div>`;
}

/**
 * The browser half. Included once per page, outside every live region, so a chart that only appears
 * on a later refresh is still read. The guard makes a second copy harmless.
 *
 * The slot is picked by where the pointer is across the plot, not by which element it is over, so a
 * gap between bars, an empty slot and the space between the CVD chart's two panels all read. A touch
 * sets the reading on a tap and holds it, since a finger lifting is not a reader leaving; scrubbing
 * sideways works because the area allows only vertical panning. Arrow keys step through the slots
 * once the area has focus.
 *
 * THE CROSSHAIR. A figure marked data-cursors offers two cursors (slotCursorSwitch): the band, and a
 * crosshair whose level line follows the pointer's height in the panel it is over, with that height
 * read on each axis in a tag. A panel's axes come in its data-axes, {"l"|"r": [kind, bottom, top]},
 * the values at the bottom and top edges of the plot, since the SVG maps them linearly; kind is
 * "price", "usd" (signed) or "amount" (dollars that have no sign), and an optional fourth entry is
 * the currency symbol for those two, "$" when absent; or "num", a plain figure, whose fourth entry
 * is its suffix ("%") and fifth its decimals. The vertical
 * line still snaps to the slot being read. A keyboard step has no height, so it draws no level line.
 * The choice is kept on <html> (data-cursor), not on the figure, which a refresh replaces.
 */
export const SLOT_SCRIPT = `(() => {
  if (window.airratesSlots) return;
  window.airratesSlots = true;
  const slotWhen = ${slotWhen};
  // The reader's zone, from localtime.ts's script (0 while the clock is set to UTC).
  const f = { usd: ${slotUsd}, price: ${slotPrice}, pct: ${slotPct}, when: (ms, w, offset, unit) => slotWhen(ms, w, window.airratesZone ? window.airratesZone(ms) : 0, unit) };
  const cvdText = ${cvdText};
  const sidesText = ${sidesText};
  const whaleText = ${whaleText};
  const gammaText = ${gammaText};
  const candleText = ${candleText};
  const macroText = ${macroText};
  const xPrice = ${slotXPrice};
  const parsed = new WeakMap();
  const idle = new WeakMap();
  let held = null, heldRead = null, heldIndex = -1;
  let mode = "cross";
  try { if (localStorage.getItem("chart-cursor") === "bar") mode = "bar"; } catch (_) {}
  document.documentElement.dataset.cursor = mode;

  const payload = (figure) => {
    const el = figure.querySelector(".slot-data");
    if (!el) return null;
    if (!parsed.has(el)) parsed.set(el, JSON.parse(el.textContent));
    return parsed.get(el);
  };
  const reading = (d, i) => {
    const fw = Object.assign({ words: d.words }, f);
    if (d.kind === "wmap") return whaleText(d, i, fw);
    if (d.kind === "gex") return gammaText(d, i, fw);
    if (d.kind === "wcandle") return candleText(d, i, fw);
    if (d.kind === "macro") return macroText(d, i, fw);
    const when = f.when(d.from + i * d.unit, d.words, 0, d.unit);
    const head = i === d.slots.length - 1 ? d.words.filling.replace("{when}", () => when) : when;
    const slot = d.slots[i];
    if (d.kind === "lqc") return sidesText(head, slot, fw);
    let cvd = 0;
    for (let j = i; j >= 0; j--) if (d.slots[j]) { cvd = d.slots[j][2]; break; }
    return cvdText(head, slot && [slot[0], slot[1], slot[3]], cvd, d.open, fw);
  };
  const clear = () => {
    if (!held) return;
    for (const el of held.querySelectorAll(".slot-mark, .slot-hair")) el.classList.add("off");
    for (const el of held.querySelectorAll(".slot-tag")) el.hidden = true;
    const read = held.querySelector(".slot-read");
    if (read && idle.has(read)) read.innerHTML = idle.get(read);
    const tip = held.querySelector(".slot-tip");
    if (tip) tip.hidden = true;
    held = heldRead = null;
    heldIndex = -1;
  };
  // A mouse on a device that really hovers gets the reading beside the cursor; a finger, a pen
  // without hover, or the keyboard gets it in the header line, where a hand cannot cover it.
  const fine = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : null;
  const floating = (pointer) => !!pointer && pointer.type === "mouse" && !!fine && fine.matches;
  const place = (figure, html, pointer) => {
    let tip = figure.querySelector(".slot-tip");
    if (!tip) {
      // Created on first use rather than rendered, so a refresh that swaps the figure's HTML simply
      // takes it away and the next hover makes a new one.
      tip = document.createElement("div");
      tip.className = "slot-tip";
      tip.setAttribute("aria-hidden", "true");
      figure.appendChild(tip);
    }
    // The text functions join their parts with " · "; the tooltip puts each part on its own line.
    tip.innerHTML = html.split(" · ").map((part) => "<div>" + part + "</div>").join("");
    tip.hidden = false;
    const box = figure.getBoundingClientRect();
    const gap = 14;
    let left = pointer.x - box.left + gap;
    // Flip to the cursor's left when the right side would run out of the figure.
    if (left + tip.offsetWidth > box.width - 4) left = pointer.x - box.left - gap - tip.offsetWidth;
    let top = pointer.y - box.top + gap;
    if (top + tip.offsetHeight > box.height - 4) top = pointer.y - box.top - gap - tip.offsetHeight;
    tip.style.left = Math.max(4, left) + "px";
    tip.style.top = Math.max(4, top) + "px";
  };
  // The crosshair's level line and axis tags, in the panel under the pointer, at its height; and where
  // the x-axis is a price, that price at the foot of the vertical line, over the axis labels.
  const level = (figure, pointer, d, i) => {
    for (const el of figure.querySelectorAll(".slot-hair")) el.classList.add("off");
    for (const el of figure.querySelectorAll(".slot-tag")) el.hidden = true;
    if (!pointer || mode !== "cross" || !figure.hasAttribute("data-cursors")) return;
    const x = xPrice(d, i, f.price);
    const plots = figure.querySelectorAll(".fchart-plot[data-axes]");
    const foot = plots[plots.length - 1];
    if (x !== null && foot) {
      let tag = foot.querySelector(".slot-tag-x");
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "slot-tag slot-tag-x";
        tag.setAttribute("aria-hidden", "true");
        foot.appendChild(tag);
      }
      tag.textContent = x;
      tag.style.left = (((i + 0.5) / d.slots.length) * 100).toFixed(2) + "%";
      tag.hidden = false;
    }
    for (const plot of figure.querySelectorAll(".fchart-plot[data-axes]")) {
      const box = plot.getBoundingClientRect();
      if (pointer.y < box.top || pointer.y > box.bottom || !box.height) continue;
      const t = (pointer.y - box.top) / box.height;
      const line = plot.querySelector(".slot-hair");
      if (line) {
        line.setAttribute("y1", (t * 1000).toFixed(1));
        line.setAttribute("y2", (t * 1000).toFixed(1));
        line.classList.remove("off");
      }
      const axes = JSON.parse(plot.dataset.axes);
      for (const side of ["l", "r"]) {
        const axis = axes[side];
        if (!axis) continue;
        let tag = plot.querySelector(".slot-tag-" + side);
        if (!tag) {
          tag = document.createElement("span");
          tag.className = "slot-tag slot-tag-" + side;
          tag.setAttribute("aria-hidden", "true");
          plot.appendChild(tag);
        }
        const value = axis[2] - t * (axis[2] - axis[1]);
        tag.textContent =
          axis[0] === "num" ? (value < 0 ? "−" : "") + Math.abs(value).toFixed(axis[4] || 0) + (axis[3] || "") : axis[0] === "price" ? f.price(value) : axis[0] === "amount" ? f.usd(Math.max(0, value), axis[3]) : (value > 0 ? "+" : "") + f.usd(value, axis[3]);
        tag.style.top = (t * 100).toFixed(2) + "%";
        tag.hidden = false;
      }
    }
  };
  const show = (area, i, pointer) => {
    const figure = area.closest("figure");
    const d = figure && payload(figure);
    const read = figure && figure.querySelector(".slot-read");
    if (!d || !read || !d.slots.length) return;
    i = Math.min(d.slots.length - 1, Math.max(0, i));
    const float = floating(pointer);
    level(figure, pointer, d, i);
    // A refresh swaps the readout for a new element, so an unchanged slot still redraws after one.
    // The tooltip still follows the cursor within a slot, so only its text is spared.
    if (figure === held && read === heldRead && i === heldIndex) {
      if (float) place(figure, reading(d, i), pointer);
      return;
    }
    if (held !== figure) clear();
    if (!idle.has(read)) idle.set(read, read.innerHTML);
    const w = 1000 / d.slots.length;
    for (const el of figure.querySelectorAll(".slot-mark")) {
      if (el.tagName === "line") {
        el.setAttribute("x1", ((i + 0.5) * w).toFixed(2));
        el.setAttribute("x2", ((i + 0.5) * w).toFixed(2));
      } else {
        el.setAttribute("x", (i * w).toFixed(2));
        el.setAttribute("width", w.toFixed(2));
      }
      el.classList.remove("off");
    }
    const text = reading(d, i);
    if (float) {
      // Beside the cursor, the header keeps the window's totals rather than repeating the tooltip.
      read.innerHTML = idle.get(read);
      place(figure, text, pointer);
    } else {
      read.innerHTML = text;
      const tip = figure.querySelector(".slot-tip");
      if (tip) tip.hidden = true;
    }
    held = figure;
    heldRead = read;
    heldIndex = i;
  };
  const indexAt = (area, clientX) => {
    const plot = area.matches(".fchart-plot") ? area : area.querySelector(".fchart-plot");
    const d = payload(area.closest("figure"));
    if (!plot || !d) return 0;
    const rect = plot.getBoundingClientRect();
    return Math.floor(((clientX - rect.left) / rect.width) * d.slots.length);
  };
  const track = (event) => {
    // A pending row reads from its own data-read, in the same header line a bar's reading uses.
    const row = event.target.closest ? event.target.closest(".lqp-row") : null;
    if (row) {
      const figure = row.closest("figure");
      const read = figure && figure.querySelector(".slot-read");
      if (!read) return;
      if (held !== figure) clear();
      if (!idle.has(read)) idle.set(read, read.innerHTML);
      for (const el of figure.querySelectorAll(".slot-mark")) el.classList.add("off");
      const tip = figure.querySelector(".slot-tip");
      if (tip) tip.hidden = true;
      read.innerHTML = row.dataset.read;
      held = figure;
      heldRead = read;
      heldIndex = -1;
      return;
    }
    const area = event.target.closest ? event.target.closest(".slot-area") : null;
    if (area) {
      return show(area, indexAt(area, event.clientX), {
        type: event.pointerType,
        x: event.clientX,
        y: event.clientY,
      });
    }
    if (held && (event.pointerType !== "touch" || event.type === "pointerdown")) clear();
  };
  document.addEventListener("pointermove", track, { passive: true });
  document.addEventListener("pointerdown", track, { passive: true });
  // The pointer left the window straight from a plot, so no move outside it will ever arrive.
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget && event.pointerType === "mouse") clear();
  });
  document.addEventListener("keydown", (event) => {
    const area = event.target.closest ? event.target.closest(".slot-area") : null;
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -1e9, End: 1e9 }[event.key];
    if (!area || !step) return;
    const d = payload(area.closest("figure"));
    if (!d) return;
    event.preventDefault();
    const from = held === area.closest("figure") && heldIndex >= 0 ? heldIndex : step < 0 ? d.slots.length : -1;
    show(area, from + step);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest && event.target.closest(".slot-area") && held && !held.matches(":hover")) clear();
  });

  // The cursor switch. A refresh or an in-place switch brings a new copy of it, hidden and pressed as
  // the server had it, so every new copy is set to the reader's choice as it arrives.
  const sync = () => {
    for (const group of document.querySelectorAll(".slot-modes")) {
      group.hidden = false;
      for (const button of group.querySelectorAll(".slot-mode")) button.setAttribute("aria-pressed", String(button.dataset.cursor === mode));
    }
  };
  sync();
  new MutationObserver(() => {
    if (document.querySelector(".slot-modes[hidden]")) sync();
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    const button = event.target.closest ? event.target.closest(".slot-mode") : null;
    if (!button) return;
    mode = button.dataset.cursor === "bar" ? "bar" : "cross";
    try { localStorage.setItem("chart-cursor", mode); } catch (_) {}
    document.documentElement.dataset.cursor = mode;
    clear();
    sync();
  });
})();`;
