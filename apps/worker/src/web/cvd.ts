import { ASSET_CLASSES, type AssetClass } from "@ai-rates/core";
import {
  type CvdAssetRow,
  type CvdBar,
  type CvdData,
  type CvdDetail,
  type CvdRate,
  type CvdSpan,
  type CvdVenueFlow,
  type EtfFlows,
  FUTURES_TAKER_VENUES,
  type MarketRow,
  type Overview,
  RATE_VENUE,
  SPOT_TAKER_VENUES,
} from "../app/data";
import {
  CVD_DEFAULT_INTERVAL,
  CVD_INTERVAL_KEYS,
  CVD_INTERVALS,
  CVD_SORTS,
  CVD_STRIP,
  type CvdInterval,
  type CvdParams,
  type CvdSort,
  type CvdView,
  cvdToQuery,
  isCvdLockedInterval,
} from "../app/params";
import { agentBrief, agentTable, utcMinute } from "./agent-brief";
import { CHART_SKELETON_JS } from "./chart-skeleton";
import { ageText, aprTone, esc, formatApr, formatPrice, formatUsd, LOCK_ICON } from "./format";
import { FUND_CSS, FUND_SCRIPT, fundPanel } from "./fund-flow";
import { helpHeading } from "./help";
import { msg, tr, trMsg } from "./i18n";
import { icon } from "./icons";
import {
  KC_HOST,
  KC_PAGE_BARS,
  KCHART_SCRIPT,
  kBars,
  kchartData,
  kEtf,
  kRef,
  kSource,
  TAKER_FLOW_DAYS,
} from "./kchart";
import { layout } from "./layout";
import { timeTag, zoneTag } from "./localtime";
import { assetClassLabel, assetHref, assetKey, assetName, exchangeHref, pairHref } from "./pages";
import { PICK_SCRIPT } from "./picker";
import { citeMark, plainLabel } from "./share";
import {
  cvdText,
  SLOT_BAND,
  SLOT_CURSOR,
  SLOT_FORMAT,
  SLOT_HAIR,
  SLOT_SCRIPT,
  slotCursorSwitch,
  slotData,
} from "./slot-chart";
import { HIP3_VENUE_IDS, venueCountTag, venueName, venuesByKind } from "./venues";

/**
 * /chart (until 2026-10-28 /cvd): price, and cumulative volume delta under it -- who initiated the
 * volume, taker buys against taker sells -- split into the perpetuals' and the spot book's, with
 * their sum per bar, the delta, as a histogram.
 *
 * EVERY COLLECTED EXCHANGE THAT LISTS THE ASSET, SUMMED (owner, 2026-10-28), centralized, onchain and
 * HIP-3, spot and futures alike: FUTURES_TAKER_VENUES with every HIP-3 dex, and SPOT_TAKER_VENUES,
 * Hyperliquid's onchain spot books among them. Binance, OKX, Gate, Bitget and Aster publish their
 * perpetuals' taker split as 5-minute statistics (migration 023), and Binance its spot books' in its
 * klines (051); the rest publish none, so the collector counts their flow trade by trade from the live
 * tape (its stream.TapeFeed), from 2026-10-28 on. An asset's USDT, USDC and USD markets count as one,
 * spot and futures alike (owner, 2026-10-28): the reads sum by asset, whatever the quote. Spot is
 * crypto's and stocks', a stock's spot books being its tokenized shares (xStocks, Ondo's, Binance's)
 * held to the stock's price (collector migration 054); commodities and indices chart perpetuals
 * only. The assets are the ~500 deepest by open interest on the four REST venues, plus every
 * commodity, index and currency pair. Nothing is finer than five minutes. The lede says all of it, and
 * the keys name the venues a given asset's bars actually hold.
 *
 * A DIVERGENCE IS A FLAG, NOT A CALL. "Price up while takers sold" is a description of the window,
 * not a prediction of the next one, and the page words it as one. The thresholds are written down
 * below and in the notes so a reader can disagree with them rather than trust a badge.
 */

/** The venues whose open interest picks the ~500 assets polled: the four REST venues. */
export const CVD_VENUES = ["binance", "okx", "gate", "bitget"] as const;

/**
 * A key's venue tag: the one venue's name, or how many, with their names on hover grouped as
 * centralized, onchain and HIP-3 venues. Each HIP-3 dex counts as a venue of its own, as the catalog
 * lists it.
 */
function venueTag(ids: readonly string[]): string {
  const tag = venueCountTag(ids);
  return tag ? ` ${tag}` : "";
}

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
/** The spot book's net over a bar, zero for a bar without spot flow. */
const spotNet = (bar: CvdBar) => (bar.spot_buy_usd ?? 0) - (bar.spot_sell_usd ?? 0);

/** CVD as a share of the window's volume, in percent. Null on no volume. */
export function flowRatio(row: { buy_usd: number; sell_usd: number }): number | null {
  const total = volume(row);
  return total > 0 ? (net(row) / total) * 100 : null;
}

/**
 * Bullish: price fell while takers net bought -- someone absorbing the selling. Bearish: price rose
 * while takers net sold -- someone unloading into the bid.
 */
export function divergence(
  row: Pick<CvdAssetRow, "buy_usd" | "sell_usd" | "change_pct">,
): Divergence {
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

/** The page's own address, before an asset is named. */
export const CHART_PATH = "/chart";

/** The address form every asset page uses: crypto unmarked, every other class in the path. */
const cvdPath = (asset: string, assetClass: AssetClass) =>
  assetClass === "crypto"
    ? `${CHART_PATH}/${encodeURIComponent(asset)}`
    : `${CHART_PATH}/${assetClass}/${encodeURIComponent(asset)}`;

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
 * The time axis's labels: about four to eight at every span, hourly over 8h, daily over 4 days,
 * weekly over 30.
 */
function timeTicks(fromMs: number, toMs: number, hours: number): string[] {
  const span = toMs - fromMs;
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
    // In the reader's zone once the page script has run (localtime.ts); UTC until then.
    const text = timeTag(ms, "tick", tickHours);
    // Every other label is marked so a phone can drop it: at 390px the plot is ~220px wide and six
    // "HH:MM" labels ran into one string ("16:0020:00Sep 17").
    xLabels.push(
      `<span class="cvd-x${midnight ? " cvd-day" : ""}${xLabels.length % 2 ? " x-alt" : ""}" style="left:${(((ms - fromMs) / span) * 100).toFixed(2)}%">${text}</span>`,
    );
  }
  return xLabels;
}

/**
 * A rate-only pair's chart (RATE_PAIRS: USDCNY, USDHKD, the crosses): its interbank rate over the window, and
 * nothing under it, since no exchange trades it and there is no flow to sum. The same figure and
 * trading chart as an asset's, with the CVD panes left out and a line saying why.
 */
function rateChart(data: {
  label: string;
  asset: string;
  bars: readonly CvdBar[];
  rate: CvdRate;
  params: CvdParams;
  now: number;
}): string {
  const { label, asset, bars, rate, params, now } = data;
  const { hours, barMinutes, span: window } = CVD_INTERVALS[params.interval];
  const bucketMs = barMinutes * 60_000;
  const current = Math.floor(now / bucketMs) * bucketMs;
  const count = Math.round((hours * 60) / barMinutes);
  const fromMs = current - (count - 1) * bucketMs;
  const toMs = current + bucketMs;
  const slot = 1000 / count;
  const byBucket = new Map(bars.map((bar) => [bar.bucket_start.getTime(), bar]));
  const points: { i: number; price: number }[] = [];
  for (let i = 0; i < count; i++) {
    const price = byBucket.get(fromMs + i * bucketMs)?.price ?? null;
    if (price !== null) points.push({ i, price });
  }
  const prices = points.map((p) => p.price);
  const pLo = prices.length ? Math.min(...prices) : 0;
  const pHi = prices.length ? Math.max(...prices) : 1;
  const pPad = (pHi - pLo || pHi * 0.001 || 1) * 0.08;
  const priceY = (price: number) => 1000 - ((price - (pLo - pPad)) / (pHi - pLo + 2 * pPad)) * 1000;
  const levels = [0.1, 0.37, 0.63, 0.9];
  const priceAt = (frac: number) => pLo - pPad + (1 - frac) * (pHi - pLo + 2 * pPad);
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
  const path = points
    .map((p) => `${((p.i + 0.5) * slot).toFixed(1)},${priceY(p.price).toFixed(1)}`)
    .join(" ");
  const title =
    barMinutes >= 60
      ? tr("{asset} · interbank rate · {n}-hour bars, {zone}", {
          asset: label,
          n: barMinutes / 60,
          zone: zoneTag(),
        })
      : tr("{asset} · interbank rate · {n}-minute bars, {zone}", {
          asset: label,
          n: barMinutes,
          zone: zoneTag(),
        });
  const first = prices[0] ?? null;
  const last = prices.at(-1) ?? null;
  const moved =
    first !== null && last !== null
      ? tr("Last {window}: {from} to {to}", {
          window: esc(window),
          from: formatPrice(first),
          to: `${formatPrice(last)} <span class="${tone(last - first).trim()}">${signedPct(first > 0 ? (last / first - 1) * 100 : null)}</span>`,
        })
      : "";
  const why = rate.legs
    ? tr(
        "No exchange trades {asset}, so it has no taker flow to sum: this is its interbank rate, worked out from {first} and {second}, each quoted every five minutes. Older quote {age}.",
        {
          asset: esc(asset),
          first: esc(rate.legs[0]),
          second: esc(rate.legs[1]),
          age: esc(ageText(rate.at, now)),
        },
      )
    : tr(
        "No exchange trades {asset}, so it has no taker flow to sum: this is its interbank rate, quoted every five minutes. Last quote {age}.",
        { asset: esc(asset), age: esc(ageText(rate.at, now)) },
      );
  const trading = kchartData({
    bar: bucketMs,
    count,
    page: KC_PAGE_BARS * bucketMs,
    floor: now - TAKER_FLOW_DAYS * 86_400_000,
    src: kSource(asset, "fx", barMinutes),
    ref: kRef(bars) ?? `${RATE_VENUE}:${asset}`,
    spot: false,
    rate: true,
    bars: kBars(bars),
  });
  return `<figure class="fchart cvd-chart cvd-rate" data-live="cvd-chart">
<div class="fchart-head"><p class="fchart-title">${title}</p><div class="fchart-keys"><span><i class="cvd-key-price"></i>${tr("Price")} <span class="dim">${tr("interbank rate")}</span></span></div><p class="fchart-read">${moved}</p><p class="dim cvd-rate-why">${why}</p></div>
<div class="cvd-rate-area"><div class="fchart-plot cvd-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{asset} interbank rate over the last {window}", { asset: plainLabel(label), window }))}">${grid}${points.length > 1 ? `<polyline class="cvd-price" points="${path}"></polyline>` : ""}</svg>${leftLabels}${timeTicks(fromMs, toMs, hours).join("")}</div></div>
${trading}
</figure>`;
}

/**
 * The chart: price and CVD on one time axis above, the net flow per bar below. This is the version
 * drawn on the server, for a reader without JavaScript and the moment before the trading chart
 * (kchart.ts) loads; that one gives spot and futures a pane each.
 *
 * WITH A SPOT BOOK the top panel draws two CVD lines, the perpetuals' and the spot book's, on the one
 * dollar axis, and the strip is the delta: both nets summed per bar.
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
  asset: string;
  assetClass: AssetClass;
  bars: readonly CvdBar[];
  /** Whether the bars carry a spot book's flow. */
  spot: boolean;
  /** The venues in the bars, busiest first: CvdData's lists. */
  futuresVenues: readonly string[];
  spotVenues: readonly string[];
  params: CvdParams;
  now: number;
  /** The asset's spot ETF flows, for the trading chart's pins. */
  etf?: EtfFlows | null;
}): string {
  const { label, asset, assetClass, bars, spot, futuresVenues, spotVenues, params, now } = data;
  const { hours, barMinutes, span: window } = CVD_INTERVALS[params.interval];
  const bucketMs = barMinutes * 60_000;
  const current = Math.floor(now / bucketMs) * bucketMs;
  const count = Math.round((hours * 60) / barMinutes);
  const fromMs = current - (count - 1) * bucketMs;
  const toMs = current + bucketMs;
  const slot = 1000 / count;

  const byBucket = new Map(bars.map((bar) => [bar.bucket_start.getTime(), bar]));
  type Slot = {
    start: number;
    bar: CvdBar | undefined;
    cvd: number;
    spotCvd: number;
    price: number | null;
  };
  const slots: Slot[] = [];
  let running = 0;
  let spotRunning = 0;
  for (let i = 0; i < count; i++) {
    const start = fromMs + i * bucketMs;
    const bar = byBucket.get(start);
    if (bar) {
      running += net(bar);
      spotRunning += spotNet(bar);
    }
    slots.push({ start, bar, cvd: running, spotCvd: spotRunning, price: bar?.price ?? null });
  }
  // The price line joins only the bars that have a close: a slot with none is skipped rather than
  // drawn at zero, and nothing is held backwards to fill the start.

  const prices = slots.flatMap((s) => (s.price === null ? [] : [s.price]));
  const cvds = slots.flatMap((s) => (spot ? [s.cvd, s.spotCvd] : [s.cvd]));
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
  const spotPoints = spot
    ? slots.map((s, i) => `${xMid(i).toFixed(1)},${cvdY(s.spotCvd).toFixed(1)}`)
    : [];
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

  // Each panel's axes for the crosshair's tags: the values at the plot's bottom and top edges.
  const priceAxes = esc(
    JSON.stringify({
      ...(prices.length ? { l: ["price", pLo - pPad, pHi + pPad] } : {}),
      r: ["usd", cLo - cPad, cHi + cPad],
    }),
  );

  // The net strip: one bar per slot around its own zero, on its own symmetric scale. With a spot
  // book it is the delta, both nets summed.
  const delta = (bar: CvdBar) => net(bar) + (spot ? spotNet(bar) : 0);
  const peak = niceCeil(Math.max(0, ...slots.map((s) => (s.bar ? Math.abs(delta(s.bar)) : 0))));
  const barWidth = Math.max(slot * 0.72, 1);
  const netBars = slots
    .map((s, i) => {
      if (!s.bar) return "";
      const flow = delta(s.bar);
      if (flow === 0) return "";
      const h = (Math.abs(flow) / peak) * 500;
      const x = (i * slot + (slot - barWidth) / 2).toFixed(2);
      return `<rect class="${flow > 0 ? "cvd-buy" : "cvd-sell"}${s.start === current ? " cvd-now" : ""}" x="${x}" y="${(flow > 0 ? 500 - h : 500).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}"></rect>`;
    })
    .join("");

  const xLabels = timeTicks(fromMs, toMs, hours);

  const total = running;
  const spotTotal = spotRunning;
  // Where the price line comes from: one market, the busiest that publishes a price in the window.
  // Named, so a reader checking it against an exchange app checks it against the same market.
  const reference = bars.find((bar) => bar.price_venue !== null);
  const market = reference?.price_venue
    ? `${venueName(reference.price_venue)} ${reference.price_symbol ?? ""}`.trim()
    : null;
  const title =
    barMinutes >= 60
      ? tr("{asset} · cumulative volume delta · {n}-hour bars, {zone}", {
          asset: label,
          n: barMinutes / 60,
          zone: zoneTag(),
        })
      : tr("{asset} · cumulative volume delta · {n}-minute bars, {zone}", {
          asset: label,
          n: barMinutes,
          zone: zoneTag(),
        });

  // The readout before any hover is the whole window in the same words a bar is read in, so the line
  // does not change shape under the pointer, and a reader without JavaScript still gets the sums.
  const open = prices[0] ?? null;
  const bought = slots.reduce((sum, s) => sum + (s.bar?.buy_usd ?? 0), 0);
  const sold = slots.reduce((sum, s) => sum + (s.bar?.sell_usd ?? 0), 0);
  const spotBought = slots.reduce((sum, s) => sum + (s.bar?.spot_buy_usd ?? 0), 0);
  const spotSold = slots.reduce((sum, s) => sum + (s.bar?.spot_sell_usd ?? 0), 0);
  // What the cite button offers: with a spot book, the three lines in one sentence first; then the
  // perpetuals' flow on its own, named as futures so it is not read as the whole of it.
  const cite = `${
    spot
      ? citeMark(
          tr("{asset}, last {window}: futures CVD {futures}, spot CVD {spot}, delta {delta}.", {
            asset: plainLabel(label),
            window,
            futures: signedUsd(total),
            spot: signedUsd(spotTotal),
            delta: signedUsd(total + spotTotal),
          }),
        )
      : ""
  }${citeMark(
    tr(
      "{asset} futures taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.",
      {
        asset: plainLabel(label),
        window,
        cvd: signedUsd(total),
        bought: formatUsd(bought),
        sold: formatUsd(sold),
      },
    ),
  )}`;
  const idle = cvdText(
    tr("Last {window}", { window: esc(window) }),
    [bought, sold, prices.at(-1) ?? null],
    null,
    open,
    SLOT_FORMAT,
    spot ? [spotBought, spotSold, null] : undefined,
  );
  // Whole dollars are finer than any readout shows; the price keeps its own precision.
  const payload = slotData({
    kind: "cvd",
    from: fromMs,
    unit: bucketMs,
    open,
    ...(spot ? { spot: true } : {}),
    slots: slots.map((s) => {
      if (!s.bar) return null;
      const perps = [
        Math.round(s.bar.buy_usd),
        Math.round(s.bar.sell_usd),
        Math.round(s.cvd),
        s.price,
      ] as const;
      if (!spot) return [...perps];
      const own = (usd: number | null | undefined) => (usd == null ? null : Math.round(usd));
      return [...perps, own(s.bar.spot_buy_usd), own(s.bar.spot_sell_usd), Math.round(s.spotCvd)];
    }),
  });

  // The same bars for the trading chart that replaces the panels below once its library loads
  // (kchart.ts), with where to ask for older ones.
  const trading = kchartData({
    bar: bucketMs,
    count,
    page: KC_PAGE_BARS * bucketMs,
    floor: now - TAKER_FLOW_DAYS * 86_400_000,
    src: kSource(asset, assetClass, barMinutes, spot),
    ref: kRef(bars),
    spot,
    bars: kBars(bars),
    ...(data.etf ? { etf: kEtf(data.etf) } : {}),
  });

  return `<figure class="fchart cvd-chart" data-live="cvd-chart" data-cursors>${cite}
<div class="fchart-head"><p class="fchart-title">${title}</p><div class="fchart-keys"><span><i class="cvd-key-price"></i>${tr("Price")}${market ? ` <span class="dim">${tr("close, {market}", { market: esc(market) })}</span>` : ""}</span><span><i class="cvd-key-cvd"></i>${spot ? tr("Futures CVD") : "CVD"} <b data-u="cvd-total" class="${tone(total).trim()}">${signedUsd(total)}</b>${venueTag(futuresVenues)}</span>${spot ? `<span><i class="cvd-key-spot"></i>${tr("Spot CVD")} <b data-u="spot-total" class="${tone(spotTotal).trim()}">${signedUsd(spotTotal)}</b>${venueTag(spotVenues)}</span>` : ""}<span><i class="cvd-key-buy"></i>${spot ? tr("Delta buy") : tr("Net buy")}</span><span><i class="cvd-key-sell"></i>${spot ? tr("Delta sell") : tr("Net sell")}</span>${slotCursorSwitch()}</div><p class="fchart-read slot-read" aria-live="polite">${idle} · ${tr("hover or tap a bar to read it")}</p></div>
<div class="slot-area" tabindex="0" role="group" aria-label="${esc(tr("{asset} bars; arrow keys read one at a time", { asset: label.replace(/<[^>]+>/g, "") }))}">
<div class="fchart-plot cvd-plot" data-axes="${priceAxes}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{asset} price and cumulative volume delta over the last {window}", { asset: label, window }))}">${grid}${SLOT_BAND}<line class="cvd-zero" x1="0" x2="1000" y1="${zeroY}" y2="${zeroY}"></line><path class="cvd-area" d="${cvdArea}"></path><polyline class="cvd-line" points="${cvdPoints.join(" ")}"></polyline>${spot ? `<polyline class="cvd-spot" points="${spotPoints.join(" ")}"></polyline>` : ""}${
    pricePath.length > 1
      ? `<polyline class="cvd-price" points="${pricePath.join(" ")}"></polyline>`
      : ""
  }${SLOT_CURSOR}${SLOT_HAIR}</svg>${leftLabels}${rightLabels}</div>
<div class="fchart-plot cvd-strip" data-axes="${esc(JSON.stringify({ r: ["usd", -peak, peak] }))}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(spot ? tr("{asset} delta per bar, spot and futures net taker flow summed", { asset: label }) : tr("{asset} net taker flow per bar", { asset: label }))}">${SLOT_BAND}<line class="cvd-zero" x1="0" x2="1000" y1="500" y2="500"></line>${netBars}${SLOT_CURSOR}${SLOT_HAIR}</svg><span class="cvd-yr" style="top:0%">${signedUsd(peak)}</span><span class="cvd-yr" style="top:100%">${signedUsd(-peak)}</span>${xLabels.join("")}</div>
</div>
${payload}${trading}
</figure>`;
}

const SORT_LABELS: Record<CvdSort, string> = {
  volume: msg("Volume"),
  cvd: msg("CVD"),
  ratio: msg("CVD / volume"),
  change: msg("Change"),
};

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
 *
 * SORTING needs no trip at all. A heading in the asset picker re-sorts its rows where they are: each
 * row carries the server's own sort keys (data-keys, in CVD_SORTS order) and ties break by name as
 * they do in sortKey's caller, so the order is the one a reload would give. The address takes the
 * sort with replaceState, and so does every link on the page that keeps it, so the next live
 * refresh, an interval or a picked asset all agree with what is shown.
 */
export const CVD_SWITCH_SCRIPT = `(() => {
  if (!document.querySelector(".cvd-intervals") || !window.fetch || !window.DOMParser || !history.pushState) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let busy = false;
  ${CHART_SKELETON_JS}

  const toChart = () => {
    const chart = document.getElementById("cvd-chart");
    if (!chart) return;
    const box = chart.getBoundingClientRect();
    // Only when the chart is out of sight: a reader picking an interval is already looking at it.
    if (box.top < 0 || box.top > innerHeight * 0.5) chart.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  };

  // link: an interval (data-cvd-switch), an asset to chart (data-cvd-select), or the Detail button
  // and its way back (data-cvd-view).
  const go = async (link) => {
    if (busy) return;
    busy = true;
    const href = link.href;
    const main = document.querySelector("main");
    const chart = document.getElementById("cvd-chart");
    // Looked up per click: the strip is replaced with the rest of <main> on every switch.
    const nav = document.querySelector(".cvd-intervals");
    let label = "";
    if (link.dataset.cvdView) {
      label = (nav.dataset.loadingAsset || "").replace("{asset}", link.dataset.cvdAsset || "");
    } else if (link.dataset.cvdSwitch) {
      // By interval rather than by element: the Detail view's window table links to them too.
      for (const a of nav.querySelectorAll("a")) {
        const on = a.dataset.cvdSwitch === link.dataset.cvdSwitch;
        a.classList.toggle("on", on);
        if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      }
      label = (nav.dataset.loading || "").replace("{interval}", link.dataset.cvdSwitch);
    } else {
      // The chosen row lights up and the list closes at once, before the chart arrives.
      for (const row of document.querySelectorAll(".cvd-pick .wh-pick-row.on")) row.classList.remove("on");
      link.classList.add("on");
      const pick = link.closest(".wh-pick");
      if (pick) pick.open = false;
      label = (nav.dataset.loadingAsset || "").replace("{asset}", link.dataset.cvdSelect || "");
      toChart();
    }
    main.classList.add("chart-switching");
    main.setAttribute("aria-busy", "true");
    if (chart) skeletonInto(chart, label);
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
      main.classList.remove("chart-switching");
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

  const SORTS = ${JSON.stringify(CVD_SORTS)};
  const withSort = (href, sort, asc) => {
    const url = new URL(href, location.href);
    if (sort === "volume") url.searchParams.delete("sort");
    else url.searchParams.set("sort", sort);
    if (asc) url.searchParams.set("dir", "asc");
    else url.searchParams.delete("dir");
    return url.pathname + url.search + url.hash;
  };
  const sortBy = (link) => {
    const head = link.closest(".wh-pick-head");
    const list = head && head.parentElement.querySelector(".wh-pick-list");
    if (!list) return;
    const sort = link.dataset.cvdSort;
    const asc = head.dataset.sort === sort ? head.dataset.dir !== "asc" : false;
    head.dataset.sort = sort;
    head.dataset.dir = asc ? "asc" : "desc";
    const at = SORTS.indexOf(sort);
    const key = (row) => Number(row.dataset.keys.split(",")[at]);
    const rows = [...list.querySelectorAll(".wh-pick-row")].sort((a, b) => {
      const diff = key(a) - key(b);
      return (asc ? diff : -diff) || a.dataset.a.localeCompare(b.dataset.a);
    });
    rows.forEach((row, i) => {
      list.append(row);
      const rank = row.querySelector(".wh-pick-rank");
      if (rank) rank.textContent = i + 1;
    });
    for (const a of head.querySelectorAll("a[data-cvd-sort]")) {
      const on = a.dataset.cvdSort === sort;
      a.classList.toggle("on", on);
      const mark = a.querySelector("i");
      mark.classList.toggle("srt-up", on && asc);
      mark.classList.toggle("srt-down", on && !asc);
      a.setAttribute("href", withSort(a.getAttribute("href"), a.dataset.cvdSort, on && !asc));
    }
    history.replaceState(null, "", withSort(location.href, sort, asc));
    for (const a of document.querySelectorAll('main a[href^="/chart"]:not([data-cvd-sort])')) a.setAttribute("href", withSort(a.getAttribute("href"), sort, asc));
  };

  // An asset-class button filters the rows where they are, as a heading sorts them: PICK_SCRIPT
  // hides the rows of other classes once the picker's data-kind names one (the input event is its
  // cue to filter again), and the address and every link that keeps it take ?type=.
  // A currency button under FX narrows the FX rows the same way, by the rows' data-ccy.
  const withFilter = (href, type, ccy) => {
    const url = new URL(href, location.href);
    if (type) url.searchParams.set("type", type);
    else url.searchParams.delete("type");
    if (type === "fx" && ccy) url.searchParams.set("ccy", ccy);
    else url.searchParams.delete("ccy");
    return url.pathname + url.search + url.hash;
  };
  const light = (pick, attr, value) => {
    for (const b of pick.querySelectorAll("a[" + attr + "]")) {
      if (b.getAttribute(attr) === value) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    }
  };
  const filterBy = (pick, type, ccy) => {
    pick.dataset.kind = type;
    pick.dataset.ccy = ccy;
    light(pick, "data-cvd-type", type);
    light(pick, "data-cvd-ccy", ccy);
    const row = pick.querySelector(".wh-pick-ccys");
    if (row) row.hidden = type !== "fx";
    pick.querySelector(".wh-pick-q").dispatchEvent(new Event("input", { bubbles: true }));
    history.replaceState(null, "", withFilter(location.href, type, ccy));
    for (const a of document.querySelectorAll('main a[href^="/chart"]:not([data-cvd-type]):not([data-cvd-ccy])')) a.setAttribute("href", withFilter(a.getAttribute("href"), type, ccy));
  };
  const byType = (button) => {
    const pick = button.closest(".wh-pick");
    if (pick) filterBy(pick, button.dataset.cvdType, "");
  };
  const byCcy = (button) => {
    const pick = button.closest(".wh-pick");
    if (pick) filterBy(pick, "fx", button.dataset.cvdCcy);
  };

  const modified = (event) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

  // Delegated, because the strip and the picker are replaced with the rest of <main> on every switch,
  // and live.ts swaps the picker's rows every 30 seconds.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || !event.target.closest) return;
    const kind = event.target.closest("a[data-cvd-type]");
    if (kind) {
      if (modified(event)) return;
      event.preventDefault();
      byType(kind);
      return;
    }
    const ccy = event.target.closest("a[data-cvd-ccy]");
    if (ccy) {
      if (modified(event)) return;
      event.preventDefault();
      byCcy(ccy);
      return;
    }
    const heading = event.target.closest("a[data-cvd-sort]");
    if (heading) {
      if (modified(event)) return;
      event.preventDefault();
      sortBy(heading);
      return;
    }
    const link = event.target.closest("a[data-cvd-switch], a[data-cvd-select], a[data-cvd-view]");
    if (!link || modified(event)) return;
    event.preventDefault();
    if (link.getAttribute("aria-current")) {
      if (link.dataset.cvdSelect) {
        const pick = link.closest(".wh-pick");
        if (pick) pick.open = false;
        toChart();
      }
      return;
    }
    go(link);
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

/**
 * The screener, as a picker like the whales page's: the charted asset as a button, and under it every
 * polled asset with its window's flow, a box to find a ticker, and headings to sort by. A row charts
 * its asset in place and a heading re-sorts the rows where they are (CVD_SWITCH_SCRIPT); filtering,
 * keys and closing are PICK_SCRIPT's. Without a script every row and heading is a plain link and the
 * box a search form, as the table was.
 */
function assetPicker(data: {
  rows: readonly CvdAssetRow[];
  asset: string;
  assetClass: AssetClass;
  label: string;
  params: CvdParams;
  /** This page's own path, which the headings and the search form keep. */
  base: string;
}): string {
  const { rows, asset, assetClass, label, params, base } = data;
  const sorted = [...rows].sort((a, b) => {
    const diff = sortKey(a, params.sort) - sortKey(b, params.sort);
    return (params.asc ? diff : -diff) || a.asset.localeCompare(b.asset);
  });
  // ?q= is the search without a script, or an old link to one, and ?type= an asset-class button.
  // The rows they leave out are hidden rather than dropped, so emptying the box or pressing All in
  // the browser brings them back.
  // What a row is found by: its ticker and class, and RMB, CNH and yuan for the yuan's pairs (CNY,
  // the site's yuan).
  const words = (row: CvdAssetRow) =>
    `${row.asset} ${row.asset_class}${row.asset_class === "fx" && row.asset.includes("CNY") ? " rmb cnh yuan" : ""}`.toLowerCase();
  const matches = (row: CvdAssetRow) =>
    (!params.q || words(row).includes(params.q.toLowerCase())) &&
    (params.type === null || row.asset_class === params.type) &&
    (params.ccy === null || fxCurrencies(row).includes(params.ccy));

  const list = sorted
    .map((row, index) => {
      const signal = divergence(row);
      const ratio = flowRatio(row);
      const on = row.asset === asset && row.asset_class === assetClass;
      const href = esc(
        `${cvdPath(row.asset, row.asset_class)}${cvdToQuery({ ...params, q: "" })}#cvd-chart`,
      );
      const keys = CVD_SORTS.map((sort) => sortKey(row, sort)).join(",");
      return `<a class="wh-pick-row${on ? " on" : ""}" href="${href}" data-cvd-select="${esc(row.asset)}" data-k="${esc(assetKey(row.asset, row.asset_class))}" data-q="${esc(words(row))}" data-kind="${row.asset_class}"${row.asset_class === "fx" ? ` data-ccy="${esc(fxCurrencies(row).join(" "))}"` : ""} data-a="${esc(row.asset)}" data-keys="${keys}"${on ? ' aria-current="true"' : ""}${matches(row) ? "" : " hidden"}>
<span class="wh-pick-sym"><span class="dim wh-pick-rank">${index + 1}</span><b>${assetName(row.asset, row.asset_class)}</b></span>
<span class="num"><span data-u="price">${formatPrice(row.price)}</span></span>
<span class="num${tone(row.change_pct)}"><span data-u="change">${signedPct(row.change_pct)}</span></span>
${
  row.rate
    ? // A rate-only pair: no exchange trades it, so it has no flow to show, only its rate.
      `<span class="num dim">–</span><span class="num dim">–</span><span class="num dim">–</span><span class="num dim">–</span>
<span><span class="cvd-badge cvd-badge-rate" title="${esc(tr("No exchange trades it: its interbank rate, with no taker flow"))}">${tr("rate only")}</span></span>`
    : `<span class="num${tone(net(row))}"><span data-u="cvd">${signedUsd(net(row))}</span></span>
<span class="num${tone(ratio)}"><span data-u="ratio">${signedPct(ratio)}</span></span>
<span class="num"><span data-u="volume">${formatUsd(volume(row))}</span></span>
<span class="num dim">${row.venues}</span>
<span>${signal === null ? "" : `<span class="cvd-badge cvd-badge-${signal}">${signal === "bullish" ? tr("bullish div") : tr("bearish div")}</span>`}</span>`
}
</a>`;
    })
    .join("");

  const heading = (sort: CvdSort, title: string) => {
    const on = params.sort === sort;
    const href = esc(base + cvdToQuery({ ...params, sort, asc: on && !params.asc }));
    return `<a class="num wh-pick-sort${on ? " on" : ""}" href="${href}" data-cvd-sort="${sort}" title="${esc(title)}">${trMsg(SORT_LABELS[sort])}<i class="srt${on ? (params.asc ? " srt-up" : " srt-down") : ""}"></i></a>`;
  };
  const kept = `${
    params.interval !== CVD_DEFAULT_INTERVAL
      ? `<input type="hidden" name="interval" value="${esc(params.interval)}">`
      : ""
  }${params.sort !== "volume" ? `<input type="hidden" name="sort" value="${esc(params.sort)}">` : ""}${
    params.asc ? '<input type="hidden" name="dir" value="asc">' : ""
  }${params.type ? `<input type="hidden" name="type" value="${params.type}">` : ""}${
    params.ccy ? `<input type="hidden" name="ccy" value="${esc(params.ccy)}">` : ""
  }${params.view === "detail" ? '<input type="hidden" name="view" value="detail">' : ""}`;
  const current = rows.find((row) => row.asset === asset && row.asset_class === assetClass);
  const summary = current
    ? `<b>${label}</b><span class="num">${formatPrice(current.price)}</span><span class="num${tone(current.change_pct)}">${signedPct(current.change_pct)}</span>`
    : `<b>${label}</b>`;

  return `<details class="wh-pick cvd-pick"${params.q ? " open data-searched" : ""}${params.type ? ` data-kind="${params.type}"` : ""}${params.ccy ? ` data-ccy="${esc(params.ccy)}"` : ""}>
<summary class="wh-pick-btn" aria-label="${esc(tr("Pick an asset to chart"))}">${summary}<span class="wh-pick-more dim">${tr("{n} assets", { n: rows.length })}</span></summary>
<div class="wh-pick-panel">
<form class="wh-pick-find" method="get" action="${esc(base)}">${kept}<input class="wh-pick-q" type="search" name="q" value="${esc(params.q)}" placeholder="${esc(tr("Search symbol"))}" aria-label="${esc(tr("Search symbol"))}" autocomplete="off"><button type="submit">${tr("Find")}</button></form>
${classButtons(rows, params, base)}
${currencyButtons(rows, params, base)}
<div class="wh-pick-head" data-sort="${params.sort}" data-dir="${params.asc ? "asc" : "desc"}"><span>${tr("Asset")}</span><span class="num">${tr("Price")}</span>${heading("change", tr("Reference market's first close to last close in the window"))}${heading("cvd", tr("Taker buys less taker sells, in dollars, summed over the polled venues"))}${heading("ratio", tr("CVD as a share of the window's taker volume"))}${heading("volume", tr("Taker buys plus taker sells, in dollars"))}<span class="num" title="${esc(tr("Polled venues with flow for this asset"))}">${tr("Venues")}</span><span title="${esc(tr("Price and flow disagreeing by more than the divergence thresholds in the tiles"))}">${tr("Signal")}</span></div>
<nav class="wh-pick-list" data-live="cvd-rows" aria-label="${esc(tr("Assets"))}">${list}</nav>
<p class="wh-pick-none dim"${sorted.some(matches) ? " hidden" : ""}>${tr("No asset matches.")}</p>
</div>
</details>`;
}

/**
 * The picker's asset-class buttons (owner, 2026-11-18): All, then each class the rows hold, in
 * ASSET_CLASSES order, each with its count, so a reader can list only the stocks, the commodities
 * or the currency pairs. Each is a plain link to the same page with `?type=`; CVD_SWITCH_SCRIPT
 * turns a click into a filter in place, as it does a heading's sort. Nothing when every row is one
 * class, as a button that leaves the list as it is offers nothing.
 */
function classButtons(rows: readonly CvdAssetRow[], params: CvdParams, base: string): string {
  const counts = new Map<AssetClass, number>();
  for (const row of rows) counts.set(row.asset_class, (counts.get(row.asset_class) ?? 0) + 1);
  if (counts.size < 2) return "";
  const button = (type: AssetClass | null, label: string, n: number) => {
    const on = params.type === type;
    const href = esc(base + cvdToQuery({ ...params, type, ccy: null }));
    return `<a class="wh-pick-kind" href="${href}" data-cvd-type="${type ?? ""}"${on ? ' aria-current="true"' : ""}>${label}<small class="num">${n}</small></a>`;
  };
  const classes = ASSET_CLASSES.filter((type) => counts.has(type)).map((type) =>
    button(type, assetClassLabel(type), counts.get(type) ?? 0),
  );
  return `<nav class="wh-pick-kinds" aria-label="${esc(tr("Asset class"))}">${button(null, tr("All"), rows.length)}${classes.join("")}</nav>`;
}

/** An FX pair's two currencies (USDHKD: USD and HKD); none for any other row or name. */
const fxCurrencies = (row: CvdAssetRow): string[] =>
  row.asset_class === "fx" && /^[A-Z]{6}$/.test(row.asset)
    ? [row.asset.slice(0, 3), row.asset.slice(3)]
    : [];

/**
 * The FX button's second row (owner, 2026-11-19): every currency the FX pairs hold, each with how
 * many pairs it is in, most first, so HKD lists every Hong Kong dollar pair and nothing else. Shown
 * only while the FX button is on; CVD_SWITCH_SCRIPT shows it, hides it and filters in place.
 */
function currencyButtons(rows: readonly CvdAssetRow[], params: CvdParams, base: string): string {
  const counts = new Map<string, number>();
  let pairs = 0;
  for (const row of rows) {
    const both = fxCurrencies(row);
    if (both.length) pairs++;
    for (const code of both) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size < 2) return "";
  const button = (ccy: string | null, label: string, n: number) => {
    const on = params.type === "fx" && params.ccy === ccy;
    const href = esc(base + cvdToQuery({ ...params, type: "fx", ccy }));
    return `<a class="wh-pick-kind" href="${href}" data-cvd-ccy="${ccy ?? ""}"${on ? ' aria-current="true"' : ""}>${label}<small class="num">${n}</small></a>`;
  };
  const codes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, n]) => button(code, esc(code), n));
  return `<nav class="wh-pick-kinds wh-pick-ccys" aria-label="${esc(tr("Currency"))}"${params.type === "fx" ? "" : " hidden"}>${button(null, tr("All"), pairs)}${codes.join("")}</nav>`;
}

/** A path segment for an asset on the other asset pages: crypto unmarked, every other class named. */
const assetSegment = (asset: string, assetClass: AssetClass) =>
  assetClass === "crypto"
    ? encodeURIComponent(asset)
    : `${assetClass}/${encodeURIComponent(asset)}`;

/**
 * The Detail view (owner, 2026-10-29): the Detail button beside the asset picker puts the charted
 * asset's own figures where the chart and the all-asset tiles were, over the same window as the
 * interval strip's, so the two views agree on every figure they share.
 *
 * WHAT TAKES THE PLACE OF WHAT. The chart view's tiles are the market's: breadth, how many assets
 * diverged each way, the largest flows. Here they are the asset's: its futures and spot CVD, whether
 * it diverged and by how much, which exchanges bought and sold it most, and beside them its price,
 * open interest, funding and market cap. Under them its signal over every interval's span, so a
 * reader sees whether a divergence is a day's or a month's, and its flow by exchange, each perpetual
 * with its own price, funding and open interest.
 *
 * THE SIGNAL IS THE PICKER'S. A span's row is the figure the asset's picker row shows under that
 * interval: perpetuals only, change on the span's busiest priced market. Spot sits beside it.
 */
function detailView(data: {
  label: string;
  asset: string;
  assetClass: AssetClass;
  detail: CvdDetail;
  /** The asset's live perpetual markets (the funding page's rows), for price, funding and OI. */
  markets: readonly MarketRow[];
  params: CvdParams;
  /** The address the interval links keep. */
  base: string;
}): string {
  const { label, asset, assetClass, detail, markets, params, base } = data;
  const { hours, span: window } = CVD_INTERVALS[params.interval];
  const now = detail.spans.find((s) => s.hours === hours) ?? null;
  const futures = now && now.buy_usd + now.sell_usd > 0 ? now : null;
  const spotSide = (s: CvdSpan | null) =>
    s && s.spot_buy_usd !== null && s.spot_sell_usd !== null
      ? { buy_usd: s.spot_buy_usd, sell_usd: s.spot_sell_usd }
      : null;
  const spot = spotSide(now);
  const tile = (eyebrow: string, big: string, dim: string, cls = "") =>
    `<div class="cvd-tile"><p class="eyebrow">${eyebrow}</p><p class="cvd-big${cls}">${big}</p><p class="dim">${dim}</p></div>`;
  const dash = '<span class="dim">–</span>';

  // --- the asset's tiles ------------------------------------------------------------------------
  const market = now?.price_venue
    ? `${venueName(now.price_venue)} ${now.price_symbol ?? ""}`.trim()
    : null;
  const priceTile = tile(
    tr("Price"),
    now?.price == null
      ? dash
      : `<span data-u="price">${formatPrice(now.price)}</span> <small class="cvd-dt-move${tone(now.change_pct)}"><span data-u="change">${signedPct(now.change_pct)}</span></small>`,
    `${tr("Last {window}", { window: esc(window) })}${market ? ` · ${tr("close, {market}", { market: esc(market) })}` : ""}`,
  );
  const flowTile = (
    eyebrow: string,
    side: { buy_usd: number; sell_usd: number } | null,
    venues: readonly string[],
    none: string,
    unit: string,
  ) =>
    side
      ? tile(
          eyebrow,
          `<span data-u="${unit}">${signedUsd(net(side))}</span>`,
          tr("{ratio} of {volume} taker volume, {venues}", {
            ratio: signedPct(flowRatio(side), 1),
            volume: formatUsd(volume(side)),
            venues: venueCountTag(venues, ""),
          }),
          tone(net(side)),
        )
      : tile(eyebrow, dash, none);
  const futuresTile = flowTile(
    tr("Futures CVD"),
    futures,
    detail.futures.map((m) => m.venue_id),
    tr("No futures flow for this asset yet."),
    "futures-cvd",
  );
  const spotTile = flowTile(
    tr("Spot CVD"),
    spot,
    detail.spot.map((v) => v.venue_id),
    tr("No spot book for this asset on the collected exchanges."),
    "spot-cvd",
  );
  const signal = futures ? divergence(futures) : null;
  const signalTile = tile(
    tr("Signal"),
    signal === "bullish"
      ? tr("Bullish divergence")
      : signal === "bearish"
        ? tr("Bearish divergence")
        : tr("No divergence"),
    futures
      ? tr(
          "price {change}, futures flow {ratio} of volume; a flag needs both past {price}% and {flow}%",
          {
            change: signedPct(futures.change_pct),
            ratio: signedPct(flowRatio(futures), 1),
            price: DIVERGENCE_PRICE_PCT,
            flow: DIVERGENCE_FLOW_PCT,
          },
        )
      : tr("No futures flow for this asset yet."),
    ` cvd-dt-word${signal === "bullish" ? " cvd-up" : signal === "bearish" ? " cvd-down" : ""}`,
  );

  // The exchanges that bought and sold it most over the window, perpetuals and spot books alike.
  const venueLabel = (v: CvdVenueFlow) =>
    v.venue_symbol === null
      ? tr("{venue} spot", { venue: esc(venueName(v.venue_id)) })
      : `${esc(venueName(v.venue_id))} <span class="dim">${esc(v.venue_symbol)}</span>`;
  const byNet = [...detail.futures, ...detail.spot].sort((a, b) => net(b) - net(a));
  const topBuy = byNet[0] && net(byNet[0]) > 0 ? byNet[0] : null;
  const last = byNet.at(-1);
  const topSell = last && net(last) < 0 ? last : null;
  const topLine = (v: CvdVenueFlow | null) =>
    v ? `<span class="${tone(net(v)).trim()}">${venueLabel(v)} ${signedUsd(net(v))}</span>` : dash;
  const topTile = `<div class="cvd-tile"><p class="eyebrow">${tr("Top CVD flows")}</p><p class="cvd-flows">${topLine(topBuy)}<br>${topLine(topSell)}</p><p class="dim">${tr("largest net buy and net sell by exchange")}</p></div>`;

  const oi = markets.reduce((sum, m) => sum + (m.open_interest_usd ?? 0), 0);
  const traded = markets.reduce((sum, m) => sum + (m.volume_24h_usd ?? 0), 0);
  const oiTile = tile(
    tr("Open interest"),
    oi > 0 ? formatUsd(oi) : dash,
    tr("{n} markets, 24h volume {volume}", { n: markets.length, volume: formatUsd(traded) }),
  );
  // Funding weighted by open interest, so a thin market's extreme rate does not set the asset's.
  const weighted = markets.filter((m) => (m.open_interest_usd ?? 0) > 0);
  const weight = weighted.reduce((sum, m) => sum + (m.open_interest_usd ?? 0), 0);
  const funding =
    weight > 0
      ? weighted.reduce((sum, m) => sum + m.apr * (m.open_interest_usd ?? 0), 0) / weight
      : null;
  const aprs = markets.map((m) => m.apr);
  const fundingTile = tile(
    tr("Funding"),
    funding === null ? dash : `<span class="${aprTone(funding)}">${formatApr(funding)}</span>`,
    aprs.length
      ? tr("weighted by open interest; {low} to {high} across markets", {
          low: formatApr(Math.min(...aprs)),
          high: formatApr(Math.max(...aprs)),
        })
      : tr("No futures flow for this asset yet."),
  );
  const capTile = tile(
    tr("Market cap"),
    detail.market_cap_usd === null ? dash : formatUsd(detail.market_cap_usd),
    tr("CoinGecko's, read hourly; crypto only"),
  );
  const tiles = `<div class="cvd-tiles cvd-dt-tiles" data-live="cvd-detail-tiles">
${priceTile}${futuresTile}${spotTile}${signalTile}
${topTile}${oiTile}${fundingTile}${capTile}
</div>`;

  // --- the signal over every interval's span ----------------------------------------------------
  const spanRows = CVD_INTERVAL_KEYS.map((key) => {
    const { hours: h, span } = CVD_INTERVALS[key];
    const s = detail.spans.find((row) => row.hours === h) ?? null;
    const perps = s && s.buy_usd + s.sell_usd > 0 ? s : null;
    const book = spotSide(s);
    const flag = perps ? divergence(perps) : null;
    const href = esc(base + cvdToQuery({ ...params, q: "", interval: key }));
    const on = key === params.interval;
    const cell = (value: number | null, text: string) =>
      `<td class="num${tone(value)}">${text}</td>`;
    const delta = perps || book ? (perps ? net(perps) : 0) + (book ? net(book) : 0) : null;
    return `<tr data-k="${key}"${on ? ' class="on"' : ""}><th scope="row"><a href="${href}" data-cvd-switch="${key}"${on ? ' aria-current="page"' : ""}>${esc(span)}</a> <span class="dim">${tr("{interval} bars", { interval: key })}</span></th>${cell(perps?.change_pct ?? null, `<span data-u="change">${signedPct(perps?.change_pct ?? null)}</span>`)}${cell(perps ? net(perps) : null, `<span data-u="cvd">${perps ? signedUsd(net(perps)) : "–"}</span>`)}${cell(perps ? flowRatio(perps) : null, `<span data-u="ratio">${perps ? signedPct(flowRatio(perps)) : "–"}</span>`)}${cell(book ? net(book) : null, `<span data-u="spot">${book ? signedUsd(net(book)) : "–"}</span>`)}${cell(delta, `<span data-u="delta">${delta === null ? "–" : signedUsd(delta)}</span>`)}<td>${flag === null ? "" : `<span class="cvd-badge cvd-badge-${flag}">${flag === "bullish" ? tr("bullish div") : tr("bearish div")}</span>`}</td></tr>`;
  }).join("");
  const spans = `<section class="cvd-dt-sec">
<h2 class="cvd-h2">${tr("Signal by window")}</h2>
<div class="sheet-wrap"><table class="sheet cvd-dt-table">
<thead><tr><th>${tr("Window")}</th><th class="num">${tr("Change")}</th><th class="num">${tr("Futures CVD")}</th><th class="num">${tr("CVD / volume")}</th><th class="num">${tr("Spot CVD")}</th><th class="num">${tr("Delta")}</th><th>${tr("Signal")}</th></tr></thead>
<tbody data-live="cvd-spans">${spanRows}</tbody>
</table></div>
</section>`;

  // --- flow by exchange -------------------------------------------------------------------------
  const byMarket = new Map(markets.map((m) => [`${m.venue_id} ${m.venue_symbol}`, m]));
  const flowCells = (v: CvdVenueFlow) =>
    `<td class="num"><span data-u="buy">${formatUsd(v.buy_usd)}</span></td><td class="num"><span data-u="sell">${formatUsd(v.sell_usd)}</span></td><td class="num${tone(net(v))}"><span data-u="net">${signedUsd(net(v))}</span></td><td class="num${tone(flowRatio(v))}"><span data-u="ratio">${signedPct(flowRatio(v))}</span></td>`;
  const exchange = (id: string) =>
    `<td><a href="${esc(exchangeHref(id))}">${esc(venueName(id))}</a></td>`;
  const futuresRows = detail.futures
    .map((v) => {
      const m = byMarket.get(`${v.venue_id} ${v.venue_symbol}`);
      return `<tr data-k="${esc(`${v.venue_id}:${v.venue_symbol}`)}">${exchange(v.venue_id)}<td class="dim">${esc(v.venue_symbol ?? "")}</td><td class="num">${formatPrice(m?.mark_price ?? null)}</td><td class="num"><span class="${aprTone(m?.apr ?? null)}">${m ? formatApr(m.apr) : "–"}</span></td><td class="num">${formatUsd(m?.open_interest_usd ?? null)}</td>${flowCells(v)}</tr>`;
    })
    .join("");
  const spotTotal = detail.spot.reduce((sum, v) => sum + volume(v), 0);
  const spotRows = detail.spot
    .map(
      (v) =>
        `<tr data-k="${esc(v.venue_id)}">${exchange(v.venue_id)}${flowCells(v)}<td class="num dim">${spotTotal > 0 ? `${((volume(v) / spotTotal) * 100).toFixed(1)}%` : "–"}</td></tr>`,
    )
    .join("");
  const flowHeads = `<th class="num">${tr("taker buys")}</th><th class="num">${tr("taker sells")}</th><th class="num">${tr("Net")}</th><th class="num">${tr("CVD / volume")}</th>`;
  const futuresTable = detail.futures.length
    ? `<div class="sheet-wrap"><table class="sheet cvd-dt-table">
<thead><tr><th>${tr("Exchange")}</th><th>${tr("Market")}</th><th class="num">${tr("Price")}</th><th class="num">${tr("Funding APR")}</th><th class="num">${tr("Open interest")}</th>${flowHeads}</tr></thead>
<tbody data-live="cvd-venues">${futuresRows}</tbody>
</table></div>`
    : `<p class="empty">${tr("No futures flow for this asset yet.")}</p>`;
  const spotTable = detail.spot.length
    ? `<div class="sheet-wrap"><table class="sheet cvd-dt-table">
<thead><tr><th>${tr("Exchange")}</th>${flowHeads}<th class="num">${tr("Share")}</th></tr></thead>
<tbody data-live="cvd-spot-venues">${spotRows}</tbody>
</table></div>`
    : `<p class="empty">${tr("No spot book for this asset on the collected exchanges.")}</p>`;
  const where = assetSegment(asset, assetClass);
  const more = `<p class="notes cvd-dt-more">${tr("More on {asset}:", { asset: label })} <a href="${esc(assetHref(asset, assetClass))}">${tr("Funding rates")}</a> · <a href="${esc(pairHref(asset, assetClass))}">${tr("Funding spreads")}</a> · <a href="${esc(`/liquidations/${where}`)}">${tr("Liquidations")}</a></p>`;

  return `${tiles}
${spans}
<section class="cvd-dt-sec">
<h2 class="cvd-h2">${tr("By exchange")} <small class="dim">${tr("Last {window}", { window: esc(window) })}</small></h2>
<h3 class="cvd-dt-h3">${tr("Futures CVD")}</h3>
${futuresTable}
${
  assetClass === "crypto" || assetClass === "equity"
    ? `<h3 class="cvd-dt-h3">${tr("Spot CVD")}</h3>
${spotTable}`
    : ""
}
</section>
${more}`;
}

/** The Detail view's own styles. */
/** A rate-only pair's figure (rateChart): the time labels kept inside it, and the drawn plot hidden
 *  once the trading chart is up, as an asset's slot area is. */
const RATE_CSS = `.cvd-rate-area{padding-bottom:20px}
.kc-on .cvd-rate-area{display:none!important}
.cvd-rate-why{margin:2px 0 0;font-size:11px}
.cvd-badge-rate{color:var(--muted);border-color:var(--rule)}
`;

/** The picker's asset-class buttons (classButtons): a wrapping row under the search box, the
 *  chosen one inked like the interval strip's, each with its count. */
const KIND_CSS = `.wh-pick-kinds{display:flex;flex-wrap:wrap;flex-shrink:0;gap:4px;margin:0 8px 8px}
.wh-pick-kind{display:inline-flex;align-items:baseline;gap:5px;padding:2px 8px;border:1px solid var(--rule);color:var(--muted);font-size:11px;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;white-space:nowrap}
.wh-pick-kind:hover,.wh-pick-kind:focus-visible{border-color:var(--muted);color:var(--ink);outline:none}
.wh-pick-kind[aria-current]{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.wh-pick-kind small{font-size:10px;opacity:.7}
.wh-pick-ccys{margin-top:-4px;padding-left:8px;border-left:2px solid var(--rule)}
.wh-pick-ccys[hidden]{display:none}
`;

const DETAIL_CSS = `.cvd-view-btn{min-width:0;align-items:center;text-decoration:none;color:inherit}
.cvd-view-btn::after{display:none}
.cvd-view-btn .ico{color:var(--muted)}
.cvd-view-btn b{font-size:13px}
.cvd-view-btn:hover{border-color:var(--muted)}
.cvd-dt-move{font-size:.55em;font-weight:400}
.cvd-dt-sec{margin:0 0 14px}
.cvd-dt-sec>.cvd-h2{margin:0 0 6px}
.cvd-dt-sec>.cvd-h2 small{font-weight:400;text-transform:none;letter-spacing:0;font-size:11px}
.cvd-dt-h3{margin:10px 0 4px;font-size:12px;font-weight:400;color:var(--muted)}
.cvd-dt-table td,.cvd-dt-table th{padding:3px 8px}
.cvd-dt-table tbody tr.on{outline:1px solid var(--muted);outline-offset:-1px}
.cvd-dt-table tbody th{font-weight:400;text-align:left;white-space:nowrap;text-transform:none;color:inherit;border-bottom:0}
.cvd-dt-word{font-size:clamp(18px,2.2vw,22px);line-height:1.45}
.cvd-dt-table tbody th a{font-weight:700}
.cvd-dt-more{margin-top:0}`;

/** One asset's taker flow as the API, the MCP tool and the page's brief give it. */
export interface CvdRowSummary {
  asset: string;
  asset_class: AssetClass;
  /** The reference market's last close in the window. */
  price: number | null;
  change_pct: number | null;
  buy_usd: number;
  sell_usd: number;
  /** Taker buys less taker sells over the window: the asset's futures CVD. */
  net_usd: number;
  /** net_usd as a share of the window's taker volume, in percent. */
  net_pct_of_volume: number | null;
  venues: number;
  divergence: Divergence;
  /** Set on a currency pair no exchange trades: price and change are its interbank rate, no flow. */
  rate_only?: true;
}

/**
 * The Chart page's figures as data (owner, 2026-11-18: let AI use the site's data points): every
 * polled asset's futures taker flow over the interval's span, busiest first, the market's breadth and
 * divergences, and the charted asset's futures and spot CVD with the exchanges summed. What /v1/cvd
 * returns, what the MCP tool get_cvd returns, and what the page's brief for assistants says.
 */
export function cvdSummary(flow: CvdData, asset: string, interval: CvdInterval) {
  const rows: CvdRowSummary[] = [...flow.rows]
    .sort((a, b) => volume(b) - volume(a))
    .map((row) => ({
      asset: row.asset,
      asset_class: row.asset_class,
      price: row.price,
      change_pct: row.change_pct,
      buy_usd: row.buy_usd,
      sell_usd: row.sell_usd,
      net_usd: net(row),
      net_pct_of_volume: flowRatio(row),
      venues: row.venues,
      divergence: divergence(row),
      ...(row.rate ? { rate_only: true as const } : {}),
    }));
  // The market's figures are the traded assets': a rate-only pair has no flow to count.
  const traded = rows.filter((row) => !row.rate_only);
  const buying = traded.filter((row) => row.net_usd > 0).length;
  const priced = flow.bars.filter((bar) => bar.price !== null);
  const futuresBuy = flow.bars.reduce((sum, bar) => sum + bar.buy_usd, 0);
  const futuresSell = flow.bars.reduce((sum, bar) => sum + bar.sell_usd, 0);
  const spotBuy = flow.bars.reduce((sum, bar) => sum + (bar.spot_buy_usd ?? 0), 0);
  const spotSell = flow.bars.reduce((sum, bar) => sum + (bar.spot_sell_usd ?? 0), 0);
  const own = rows.find((row) => row.asset === asset && row.asset_class === flow.asset_class);
  return {
    interval,
    span: CVD_INTERVALS[interval].span,
    bar_minutes: CVD_INTERVALS[interval].barMinutes,
    newest_bucket: flow.newest,
    market: {
      assets: traded.length,
      net_buying_pct: traded.length > 0 ? Math.round((buying / traded.length) * 1000) / 10 : null,
      bullish_divergences: traded.filter((row) => row.divergence === "bullish").length,
      bearish_divergences: traded.filter((row) => row.divergence === "bearish").length,
    },
    asset:
      flow.asset_class === null || flow.bars.length === 0
        ? null
        : {
            asset,
            asset_class: flow.asset_class,
            price_market: flow.rate
              ? "interbank rate"
              : priced[0]?.price_venue
                ? `${priced[0].price_venue} ${priced[0].price_symbol ?? ""}`.trim()
                : null,
            ...(flow.rate ? { rate_only: true as const, quoted_at: flow.rate.at } : {}),
            price_first: priced[0]?.price ?? null,
            price_last: priced.at(-1)?.price ?? null,
            change_pct: own?.change_pct ?? null,
            divergence: own?.divergence ?? null,
            futures: {
              buy_usd: futuresBuy,
              sell_usd: futuresSell,
              net_usd: futuresBuy - futuresSell,
              venues: flow.futures_venues,
            },
            spot: flow.spot
              ? {
                  buy_usd: spotBuy,
                  sell_usd: spotSell,
                  net_usd: spotBuy - spotSell,
                  venues: flow.spot_venues,
                }
              : null,
            bars: flow.bars.slice(-12).map((bar) => ({
              start: bar.bucket_start,
              close: bar.price,
              futures_net_usd: net(bar),
              spot_net_usd: flow.spot ? spotNet(bar) : null,
            })),
          },
    rows,
  };
}

/** The page's figures for an AI assistant (web/agent-brief.ts), from the same summary as /v1/cvd. */
function cvdAgentBrief(flow: CvdData, asset: string, params: CvdParams): string {
  return agentBrief(() => {
    const summary = cvdSummary(flow, asset, params.interval);
    const { market, span } = summary;
    const parts: string[] = ["<h2>In figures</h2>"];
    const one = summary.asset;
    if (one && flow.rate) {
      const price =
        one.price_first !== null && one.price_last !== null
          ? `its interbank rate went from ${formatPrice(one.price_first)} to ${formatPrice(one.price_last)}${one.change_pct === null ? "" : ` (${signedPct(one.change_pct)})`}`
          : `its interbank rate is ${formatPrice(one.price_last)}`;
      parts.push(
        `<p>${esc(asset)} (fx) over the last ${span}: ${price}, last quoted ${utcMinute(flow.rate.at)}. No exchange the site collects trades ${esc(asset)}, so it has no taker flow and no CVD.</p>`,
      );
    } else if (one) {
      const flowLine = (side: {
        net_usd: number;
        buy_usd: number;
        sell_usd: number;
        venues: readonly string[];
      }) =>
        `${signedUsd(side.net_usd)} (taker buys ${formatUsd(side.buy_usd)}, taker sells ${formatUsd(side.sell_usd)}, ${side.venues.length} exchanges)`;
      const price =
        one.price_first !== null && one.price_last !== null
          ? `price ${formatPrice(one.price_first)} to ${formatPrice(one.price_last)}${one.change_pct === null ? "" : ` (${signedPct(one.change_pct)})`}${one.price_market ? ` on ${esc(one.price_market.replace(/^\S+/, (id) => venueName(id)))}` : ""}`
          : "no price";
      const diverged =
        one.divergence === "bullish"
          ? " A bullish divergence: price fell while takers net bought."
          : one.divergence === "bearish"
            ? " A bearish divergence: price rose while takers net sold."
            : "";
      parts.push(
        `<p>${esc(asset)} (${one.asset_class}) over the last ${span}, in ${params.interval} bars: ${price}; futures CVD ${flowLine(one.futures)}${one.spot ? `; spot CVD ${flowLine(one.spot)}` : "; no spot flow collected"}.${diverged}</p>`,
      );
    }
    if (market.assets > 0) {
      parts.push(
        `<p>Across the ${market.assets} assets polled over the last ${span}: ${market.net_buying_pct}% had net taker buying in futures; ${market.bullish_divergences} bullish and ${market.bearish_divergences} bearish divergences (price moved at least ${DIVERGENCE_PRICE_PCT}% against takers netting at least ${DIVERGENCE_FLOW_PCT}% of volume).</p>`,
      );
    }
    if (one && one.bars.length > 0) {
      parts.push(`<h2>${esc(asset)}, last ${one.bars.length} bars of ${params.interval}</h2>`);
      parts.push(
        agentTable(
          flow.rate
            ? ["Bar start", "Close"]
            : one.spot
              ? ["Bar start", "Close", "Futures net", "Spot net"]
              : ["Bar start", "Close", "Futures net"],
          one.bars.map((bar) => {
            const cells = [utcMinute(bar.start), bar.close === null ? "" : formatPrice(bar.close)];
            if (flow.rate) return cells;
            cells.push(signedUsd(bar.futures_net_usd));
            if (one.spot) cells.push(signedUsd(bar.spot_net_usd ?? 0));
            return cells;
          }),
        ),
      );
    }
    if (summary.rows.length > 0) {
      parts.push(`<h2>Futures taker flow by asset, last ${span}, busiest first</h2>`);
      parts.push(
        agentTable(
          [
            "Asset",
            "Class",
            "Price",
            "Change",
            "CVD",
            "CVD / volume",
            "Taker volume",
            "Exchanges",
            "Divergence",
          ],
          summary.rows
            .slice(0, 30)
            .map((row) => [
              `<a href="${esc(cvdPath(row.asset, row.asset_class))}.md">${esc(row.asset)}</a>`,
              row.asset_class,
              row.price === null ? "" : formatPrice(row.price),
              signedPct(row.change_pct),
              signedUsd(row.net_usd),
              signedPct(row.net_pct_of_volume),
              formatUsd(row.buy_usd + row.sell_usd),
              String(row.venues),
              row.divergence ?? "",
            ]),
        ),
      );
    }
    const query = `asset=${encodeURIComponent(asset)}${flow.asset_class && flow.asset_class !== "crypto" ? `&class=${flow.asset_class}` : ""}&interval=${params.interval}`;
    parts.push(
      `<p>All ${summary.rows.length} assets and this asset's bars as JSON: <a href="/v1/cvd?${query}">/v1/cvd?${query}</a> (MCP tool get_cvd). CVD is taker buys less taker sells in dollars, summed over the exchanges named; it describes what happened, not what happens next.</p>`,
    );
    return parts.join("\n");
  });
}

export function cvd(data: {
  overview: Overview;
  cvd: CvdData;
  /** The charted asset. */
  asset: string;
  params: CvdParams;
  now: number;
  /** Spot ETF flows for the charted asset, pinned on its price; null when none are read. */
  etf?: EtfFlows | null;
  /** The Detail view's figures and the asset's live markets, read only when it is asked for. */
  detail?: { flow: CvdDetail; markets: readonly MarketRow[] } | null;
}): string {
  const { overview, cvd: flow, asset, params, now } = data;
  const rows = flow.rows;
  const chartClass = flow.asset_class ?? "crypto";
  const label = assetName(asset, chartClass);
  const selfPath = cvdPath(asset, chartClass);
  const assetInAddress = asset !== "BTC" || chartClass !== "crypto";

  // --- the four tiles ---------------------------------------------------------------------------
  // Over the traded assets: a rate-only pair has no flow, so it is neither buying nor selling.
  const traded = rows.filter((row) => !row.rate);
  const netBuying = traded.filter((row) => net(row) > 0).length;
  const breadth = traded.length > 0 ? (netBuying / traded.length) * 100 : null;
  const divergences = traded.map(divergence);
  const bullish = divergences.filter((d) => d === "bullish").length;
  const bearish = divergences.filter((d) => d === "bearish").length;
  const byNet = [...traded].sort((a, b) => net(b) - net(a));
  const topBuy = byNet[0] && net(byNet[0]) > 0 ? byNet[0] : null;
  const topSell = byNet.at(-1) && net(byNet.at(-1) as CvdAssetRow) < 0 ? byNet.at(-1) : null;

  const topLine = (row: CvdAssetRow | null | undefined) =>
    row
      ? `<a class="${tone(net(row)).trim()}" href="${esc(`${cvdPath(row.asset, row.asset_class)}${cvdToQuery({ ...params, q: "" })}#cvd-chart`)}">${assetName(row.asset, row.asset_class)} ${signedUsd(net(row))}</a>`
      : `<span class="dim">–</span>`;

  const tiles = `<div class="cvd-tiles" data-live="cvd-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("CVD breadth")}</p><p class="cvd-big"><span data-u="breadth">${breadth === null ? "–" : `${breadth.toFixed(1)}%`}</span></p><p class="dim">${tr("of {n} assets with net taker buying", { n: traded.length })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Bullish divergences")}</p><p class="cvd-big cvd-up"><span data-u="bullish">${bullish}</span></p><p class="dim">${tr("price down ≥{price}%, takers net buying ≥{flow}% of volume", { price: DIVERGENCE_PRICE_PCT, flow: DIVERGENCE_FLOW_PCT })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Bearish divergences")}</p><p class="cvd-big cvd-down"><span data-u="bearish">${bearish}</span></p><p class="dim">${tr("price up ≥{price}%, takers net selling ≥{flow}% of volume", { price: DIVERGENCE_PRICE_PCT, flow: DIVERGENCE_FLOW_PCT })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Top CVD flows")}</p><p class="cvd-flows">${topLine(topBuy)}<br>${topLine(topSell)}</p><p class="dim">${tr("largest net buy / net sell")}</p></div>
</div>`;

  // --- controls ---------------------------------------------------------------------------------
  // The interval strip, in CVD_STRIP's order of duration. Each link is an ordinary address (the page
  // works without the script), and CVD_SWITCH_SCRIPT turns a click into an in-place swap behind a
  // loading placeholder. A locked interval is not a link at all: there is nowhere for it to go yet.
  const intervalStrip = `<nav class="tf cvd-intervals" aria-label="${tr("Interval")}" data-loading="${esc(tr("Loading {interval} bars…"))}" data-loading-asset="${esc(tr("Loading {asset}…"))}">${CVD_STRIP.map(
    (key) => {
      if (isCvdLockedInterval(key)) {
        // Only 7d is held back by history; 2h is simply not offered yet, and saying "not enough
        // history" for a bar that needs a week of the month we keep would be untrue.
        const why =
          key === "7d"
            ? tr("Not available yet: there is not enough history for {interval} bars", {
                interval: key,
              })
            : tr("Not available yet");
        return `<span class="tf-locked" aria-disabled="true" title="${esc(why)}">${key}${LOCK_ICON}</span>`;
      }
      const href = esc(
        (assetInAddress ? selfPath : CHART_PATH) + cvdToQuery({ ...params, interval: key }),
      );
      return key === params.interval
        ? `<a class="on" href="${href}" aria-current="page" data-cvd-switch="${key}">${key}</a>`
        : `<a href="${href}" data-cvd-switch="${key}">${key}</a>`;
    },
  ).join("")}</nav>`;

  // --- the Detail button: the asset's own figures in place of the chart and the tiles, and back ---
  // A rate-only pair has no flow by window or by exchange, and no fund flow: its chart is all there is.
  const rateOnly = Boolean(flow.rate);
  const detailShown =
    params.view === "detail" && Boolean(data.detail) && flow.asset_class !== null && !rateOnly;
  const viewTo = (view: CvdView) =>
    esc((assetInAddress ? selfPath : CHART_PATH) + cvdToQuery({ ...params, q: "", view }));
  const plain = label.replace(/<[^>]+>/g, "");
  const viewButton =
    flow.asset_class === null || rateOnly
      ? ""
      : detailShown
        ? `<a class="wh-pick-btn cvd-view-btn" href="${viewTo("chart")}" data-cvd-view="chart" data-cvd-asset="${esc(plain)}" title="${esc(tr("Back to the chart"))}">${icon("left")}<b>${tr("Chart")}</b></a>`
        : `<a class="wh-pick-btn cvd-view-btn" href="${viewTo("detail")}" data-cvd-view="detail" data-cvd-asset="${esc(plain)}" title="${esc(tr("{asset}'s flow by window and by exchange, with its open interest and funding", { asset: plain }))}">${icon("info")}<b>${tr("Detail")}</b></a>`;

  // --- the screener, as the asset picker beside the intervals -------------------------------------
  const picker =
    rows.length === 0
      ? ""
      : assetPicker({
          rows,
          asset,
          assetClass: chartClass,
          label,
          params,
          base: assetInAddress ? selfPath : CHART_PATH,
        });
  const empty =
    rows.length === 0
      ? `<p class="empty">${tr("No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.", { window: esc(CVD_INTERVALS[params.interval].span) })}</p>`
      : "";

  const chart =
    flow.asset_class === null
      ? `<p class="empty">${tr("No live market lists {asset}, so there is no flow to chart.", { asset: esc(asset) })}</p>`
      : flow.rate
        ? rateChart({ label, asset, bars: flow.bars, rate: flow.rate, params, now })
        : flow.bars.length === 0
          ? `<p class="empty">${tr("No taker flow for {asset} in the last {window}. Only the ~500 assets deepest on {venues} are polled; pick one from the asset list above.", { asset: label, window: esc(CVD_INTERVALS[params.interval].span), venues: CVD_VENUES.map(venueName).join(", ") })}</p>`
          : cvdChart({
              label,
              asset,
              assetClass: chartClass,
              bars: flow.bars,
              spot: flow.spot,
              futuresVenues: flow.futures_venues,
              spotVenues: flow.spot_venues,
              params,
              now,
              etf: data.etf,
            });

  const lag = flow.newest
    ? tr("Newest bucket {age}.", { age: esc(ageText(flow.newest, now)) })
    : "";

  // In the Detail view the asset's own figures take the place of the tiles and the chart.
  const shown =
    detailShown && data.detail
      ? `<div id="cvd-chart" class="cvd-anchor cvd-detail">${detailView({
          label,
          asset,
          assetClass: chartClass,
          detail: data.detail.flow,
          markets: data.detail.markets,
          params,
          base: assetInAddress ? selfPath : CHART_PATH,
        })}</div>`
      : `${tiles}
<div id="cvd-chart" class="cvd-anchor">${chart}${flow.bars.length ? KC_HOST : ""}</div>`;

  // An asset's chart is its own page to a search engine (until 2026-11-14 every /chart/<asset> named
  // /chart as its canonical address). BTC is the bare /chart, so it stays the hub.
  return layout({
    title: detailShown
      ? `${plain} ${tr("Detail")}`
      : rateOnly
        ? tr("{asset} chart: interbank rate", { asset: plain })
        : assetInAddress
          ? tr("{asset} chart: price and CVD", { asset: plain })
          : tr("Chart"),
    description: rateOnly
      ? tr(
          "{asset} interbank rate, quoted every five minutes. No exchange trades it, so it has no taker flow or CVD.",
          { asset: plain },
        )
      : assetInAddress
        ? tr(
            "{asset} price with cumulative volume delta under it: spot and futures taker buying against taker selling across exchanges, and where price and order flow disagree.",
            { asset: plain },
          )
        : tr(
            "Price with cumulative volume delta under it: spot and futures taker buying against taker selling, their combined delta per bar, and where price and order flow disagree.",
          ),
    path: assetInAddress ? selfPath : CHART_PATH,
    overview,
    now,
    body: `${helpHeading(
      "h1",
      tr("Chart"),
      "cvd",
      `<p>${tr(
        "Price, with cumulative volume delta (CVD) under it: {buys} less {sells}, in dollars, summed over every exchange we collect that lists the asset, with its USDT, USDC and USD markets counted as one. Futures CVD adds up the perpetuals on <b>{futures}</b>; spot CVD the spot books on <b>{spot}</b>. It covers the ~500 assets deepest by open interest and every commodity, index and currency pair, in 5-minute buckets. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.",
        {
          buys: `<span class="cvd-up">${tr("taker buys")}</span>`,
          sells: `<span class="cvd-down">${tr("taker sells")}</span>`,
          futures: esc(venuesByKind([...FUTURES_TAKER_VENUES, ...HIP3_VENUE_IDS])),
          spot: esc(venuesByKind(SPOT_TAKER_VENUES)),
        },
      )}</p><p>${tr("A currency pair that no exchange trades, USD/CNY and USD/HKD among them, is listed with its interbank rate instead: quoted every five minutes, with no taker flow, so its row has no CVD and its chart is the rate alone.")}</p><p>${tr("Each key above the chart says how many venues its line sums for this asset; hover it for their names. Spot covers crypto and stocks: a stock's spot books are its tokenized shares (xStocks, Ondo and the like) on the collected exchanges, counted only while they trade at the stock's own price. Commodities and indices show futures only. Spot and futures each have a pane, because their sizes differ by an order of magnitude on most assets. The histogram under them is the delta: each bar's spot and futures net summed.")}</p><p>${tr("Price is the busiest polled market's own candle. Each pane has its own scale, so where lines cross means nothing. Drag to look back, wheel or pinch to zoom, and hover a candle to read it in the box beside it; on a phone, tap.")}</p><p>${tr("The asset button beside the intervals opens the screener: every polled asset's taker flow over the window. Pick one to chart it, find a ticker in its box, or sort by a heading. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance, Aster, Gate and Bitget publish weeks of it and OKX five days, while every other venue, spot books other than Binance's included, is counted from its live trades since 28 October 2026, so older bars sum fewer venues.")}</p><p>${tr("Detail, beside Fund flow, puts the asset's own figures where the chart and the market's tiles are, over the same window: its futures and spot CVD, whether it diverged, the exchanges that bought and sold it most, its open interest, funding and market cap; then its signal over every interval's span, and its flow exchange by exchange. Chart brings the chart back.")}</p><p>${tr("The venues that publish statistics release each 5-minute bucket after it closes, so the newest bar holds only the live tapes for a few minutes.")}</p>`,
    )}
<style>${FUND_CSS}${DETAIL_CSS}${KIND_CSS}${RATE_CSS}</style>
${cvdAgentBrief(flow, asset, params)}
<div class="lq-controls wh-controls">${picker}${flow.asset_class === null || rateOnly ? "" : fundPanel(asset, chartClass)}${viewButton}${intervalStrip}</div>
${shown}
<script>${SLOT_SCRIPT}</script>
<script>${KCHART_SCRIPT}</script>
<script>${PICK_SCRIPT}</script>
<script>${CVD_SWITCH_SCRIPT}</script>
<script>${FUND_SCRIPT}</script>
<p class="notes" data-live="cvd-asof">${lag}</p>
${empty}`,
  });
}
