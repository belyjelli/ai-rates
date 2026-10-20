import type { GammaData, GammaExpiry, GammaExposure, GammaStrike, OptionGreeks } from "../app/data";
import {
  GAMMA_SCOPES,
  type GammaParams,
  type GammaScope,
  type HeatmapParams,
  heatmapToQuery,
} from "../app/params";
import { lazyPlaceholder } from "./chart-skeleton";
import {
  bookLevels,
  bookRecord,
  type ReactionZone,
  reactionStrip,
  reactionZones,
  regimeExposure,
  zoneShades,
} from "./confluence";
import { esc, formatPrice, formatUsd } from "./format";
import {
  agoText,
  bandStrikes,
  bookPicker,
  choiceHref,
  dayLabel,
  type ExpiryMeasure,
  expiryChart,
  freshness,
  inScope,
  leftText,
  publisher,
  type StrikeSides,
  scopeLabel,
  signedPct,
  signedUsd,
  tone,
  unitSymbol,
} from "./gamma";
import { helpButton, helpPanel } from "./help";
import { tr } from "./i18n";
import {
  type GammaSlots,
  SLOT_BAND,
  SLOT_CURSOR,
  SLOT_HAIR,
  slotCursorSwitch,
  slotData,
} from "./slot-chart";

/**
 * The Rates page's Delta, Vega and Theta tabs: the other Greeks of the option books the Gamma Exposure
 * tab reads (collector internal/gamma greeks.go, migration 047), one tab each, with the same book
 * picker and expiry ranges.
 *
 * WHAT THE NUMBERS ARE. Each option's Black-76 Greek, at a zero rate, on its own open interest, IV and
 * forward, in the currency the contract pays: delta as the value of the underlying the open options
 * move like (delta x open interest x forward), vega per point of IV, theta per day. They reproduce
 * Deribit's own greeks to within 0.03%.
 *
 * WHOSE SIDE. Unlike gamma exposure, these are read from the side of whoever bought the options, so
 * nothing is assumed about who holds them: calls' delta positive and puts' negative, every option's
 * vega positive and its theta negative. Whoever wrote the options holds exactly the opposite.
 *
 * THE CHART. The strikes banded as the Gamma chart bands them (gamma.ts bandStrikes), by each Greek's
 * own weight. Delta, which has a sign, draws calls above zero and puts below; vega and theta, which
 * have one sign, stack each band's calls and puts, vega up from the floor and theta down from the top.
 */

export type Greek = "delta" | "vega" | "theta";
export const GREEKS: readonly Greek[] = ["delta", "vega", "theta"];
export const isGreek = (value: string | null): value is Greek =>
  value === "delta" || value === "vega" || value === "theta";
/** The id tabs.ts and the swap script find each tab by. */
export const greekPanelId = (greek: Greek) => `panel-rates-${greek}`;

/** Each Greek's columns: its calls' and its puts'. */
const FIELDS: Readonly<Record<Greek, readonly [keyof OptionGreeks, keyof OptionGreeks]>> = {
  delta: ["call_delta", "put_delta"],
  vega: ["call_vega", "put_vega"],
  theta: ["call_theta", "put_theta"],
};
const callOf = (greek: Greek, row: OptionGreeks) => row[FIELDS[greek][0]] ?? 0;
const putOf = (greek: Greek, row: OptionGreeks) => row[FIELDS[greek][1]] ?? 0;
const sides = (greek: Greek): StrikeSides => ({
  call: (k: GammaStrike) => callOf(greek, k),
  put: (k: GammaStrike) => putOf(greek, k),
});
/** How the chart draws a Greek: around zero, stacked up from it, or stacked down from it. */
const SHAPE: Readonly<Record<Greek, "split" | "up" | "down">> = {
  delta: "split",
  vega: "up",
  theta: "down",
};
/** A row's size for shares: delta's two sides counted whatever their sign, the others' total. */
const weight = (greek: Greek, row: OptionGreeks) =>
  Math.abs(callOf(greek, row)) + Math.abs(putOf(greek, row));

function chartTitle(greek: Greek, words: { currency: string; source: string; scope: string }) {
  if (greek === "delta")
    return tr("{currency} · {source} options · delta by strike · {scope}", words);
  if (greek === "vega")
    return tr("{currency} · {source} options · vega by strike · {scope}", words);
  return tr("{currency} · {source} options · theta by strike · {scope}", words);
}

function idleText(greek: Greek, total: string, spot: string): string {
  if (greek === "delta")
    return tr(
      "net {net} at spot {spot} · calls above zero, puts below · hover or tap a strike to read it",
      {
        net: total,
        spot,
      },
    );
  if (greek === "vega")
    return tr(
      "{total} per IV point at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it",
      {
        total,
        spot,
      },
    );
  return tr(
    "{total} a day at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it",
    {
      total,
      spot,
    },
  );
}

function greekChart(
  greek: Greek,
  data: {
    currency: string;
    exposure: GammaExposure;
    strikes: readonly GammaStrike[];
    scopeName: string;
    /** The day's reaction zones (confluence.ts), shaded where they fall. */
    zones: readonly ReactionZone[];
  },
): string {
  const { currency, exposure, strikes, scopeName } = data;
  const spot = exposure.spot;
  const sym = unitSymbol(exposure.unit);
  const shape = SHAPE[greek];
  const b = bandStrikes(strikes, spot, sides(greek));
  const span = b.count * b.step;
  const x = (price: number) => ((price - b.low) / span) * 1000;
  const hot = zoneShades(data.zones, x, b.low, b.low + span);
  const slot = 1000 / b.count;
  const width = slot * 0.78;
  const totals = b.calls.map((call, i) => call + (b.puts[i] ?? 0));
  const peak =
    shape === "split"
      ? Math.max(1, ...b.calls.map(Math.abs), ...b.puts.map(Math.abs))
      : Math.max(1, ...totals.map(Math.abs));
  const rect = (cls: string, i: number, top: number, height: number) =>
    height > 0
      ? `<rect class="${cls}" x="${(i * slot + (slot - width) / 2).toFixed(2)}" y="${top.toFixed(1)}" width="${width.toFixed(2)}" height="${height.toFixed(1)}"></rect>`
      : "";
  const bars = b.calls
    .map((call, i) => {
      const put = b.puts[i] ?? 0;
      if (shape === "split") {
        // A side above zero rises from the middle, one below it hangs from it.
        const draw = (cls: string, v: number) => {
          const h = (Math.abs(v) / peak) * 500;
          return rect(cls, i, v > 0 ? 500 - h : 500, h);
        };
        return draw("gx-call", call) + draw("gx-put", put);
      }
      const c = (Math.abs(call) / peak) * 1000;
      const p = (Math.abs(put) / peak) * 1000;
      // Calls nearest zero, puts beyond them: up from the floor, or down from the top for theta.
      return shape === "up"
        ? rect("gx-call", i, 1000 - c, c) + rect("gx-put", i, 1000 - c - p, p)
        : rect("gx-call", i, 0, c) + rect("gx-put", i, c, p);
    })
    .join("");
  const levels = [0.25, 0.5, 0.75];
  const grid = levels
    .map((f) => `<line class="cvd-grid" x1="0" x2="1000" y1="${f * 1000}" y2="${f * 1000}"></line>`)
    .join("");
  // The value at height f down the plot, and the plot's range for the crosshair.
  const at = (f: number) =>
    shape === "split" ? peak * (1 - 2 * f) : shape === "up" ? peak * (1 - f) : -peak * f;
  const [bottom, top] = shape === "split" ? [-peak, peak] : shape === "up" ? [0, peak] : [-peak, 0];
  const zeroY = shape === "split" ? 500 : shape === "up" ? 999 : 1;
  const axisText = (v: number) =>
    Math.abs(v) < 0.5 ? `${sym}0` : shape === "split" ? signedUsd(v, sym) : formatUsd(v, sym);
  const leftLabels = levels
    .map((f) => `<span class="cvd-yl" style="top:${f * 100}%">${axisText(at(f))}</span>`)
    .join("");
  const xLabels = [-1, -0.5, 0, 0.5, 1]
    .map((t, n) => {
      const price = t === 0 ? spot : Math.round((spot * (1 + t * b.range)) / b.step) * b.step;
      const text =
        t === 0
          ? tr("spot {price}", { price: formatPrice(spot) })
          : `${formatPrice(price)} <span class="dim">${signedPct(price / spot - 1, 0)}</span>`;
      return `<span class="cvd-x${t === 0 ? " wm-x-mark" : ""}${t === 1 ? " gx-x-end" : ""}${n % 2 ? " x-alt" : ""}" style="left:${(x(price) / 10).toFixed(2)}%">${text}</span>`;
    })
    .join("");
  const spotLine =
    spot >= b.low && spot <= b.low + span
      ? `<line class="gx-spot" x1="${x(spot).toFixed(1)}" x2="${x(spot).toFixed(1)}" y1="0" y2="1000"></line>`
      : "";

  const payload: GammaSlots = {
    kind: "gex",
    low: b.low,
    step: b.step,
    spot,
    unit: exposure.source === "deribit" ? currency : "",
    cur: sym,
    slots: b.calls.map((call, i) =>
      b.labels[i]
        ? [
            Math.round(call),
            Math.round(b.puts[i] ?? 0),
            b.callOi[i] ?? 0,
            b.putOi[i] ?? 0,
            b.labels[i] as string,
          ]
        : null,
    ),
    curve: b.calls.map(() => null),
  };
  const axes = esc(JSON.stringify({ l: ["usd", bottom, top, sym] }));
  const net = callOf(greek, exposure) + putOf(greek, exposure);
  const total =
    greek === "delta"
      ? `<b class="${tone(net)}">${signedUsd(net, sym)}</b>`
      : `<b>${formatUsd(net, sym)}</b>`;
  const beyond =
    b.beyond > 0
      ? `<p class="fchart-note dim">${
          greek === "delta"
            ? tr(
                "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.",
                {
                  pct: `${Math.round(b.range * 100)}%`,
                  usd: formatUsd(b.beyond, sym),
                },
              )
            : tr("Strikes beyond ±{pct} of the spot are off the chart: {usd} of the total.", {
                pct: `${Math.round(b.range * 100)}%`,
                usd: formatUsd(b.beyond, sym),
              })
        }</p>`
      : "";
  const title = chartTitle(greek, {
    currency: esc(currency),
    source: esc(publisher(exposure.source).name),
    scope: scopeName,
  });
  // A Greek with one sign reads its band's total where the Gamma chart reads a net.
  const words = greek === "delta" ? {} : { gexNet: tr("total {usd}") };
  return `<figure class="fchart cvd-chart gk-chart gk-${greek}" data-gx-chart data-live="greek-chart" data-cursors>
<div class="fchart-head"><p class="fchart-title">${title}</p><div class="fchart-keys"><span><i class="gx-key-call"></i>${tr("Calls")}</span><span><i class="gx-key-put"></i>${tr("Puts")}</span><span><i class="gx-key-spot"></i>${tr("Spot")}</span>${hot ? `<span><i class="gx-key-cz"></i>${tr("reaction zone, today")}</span>` : ""}${slotCursorSwitch()}</div><p class="fchart-read slot-read" aria-live="polite">${idleText(greek, total, formatPrice(spot))}</p></div>
<div class="slot-area" tabindex="0" role="group" aria-label="${esc(tr("{currency} strike bands; arrow keys read one at a time", { currency: esc(currency) }))}">
<div class="fchart-plot gx-plot" data-axes="${axes}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(title)}">${hot}${grid}${SLOT_BAND}<line class="cvd-zero" x1="0" x2="1000" y1="${zeroY}" y2="${zeroY}"></line><g class="gk-bars${shape === "split" ? "" : " gk-stack"}">${bars}</g>${spotLine}${SLOT_CURSOR}${SLOT_HAIR}</svg>${leftLabels}${xLabels}</div>
</div>
${beyond}
${slotData(payload, words)}
</figure>`;
}

/** The expiries in the tab's range, and the one holding the most of the Greek. */
function largest(greek: Greek, expiries: readonly GammaExpiry[], exposure: GammaExposure) {
  const shown = expiries.filter((x) =>
    inScope(exposure.scope as GammaScope, x.expiry, exposure.next_expiry, exposure.computed_at),
  );
  const sum = shown.reduce((acc, x) => acc + weight(greek, x), 0);
  let best: GammaExpiry | null = null;
  for (const x of shown) if (!best || weight(greek, x) > weight(greek, best)) best = x;
  return { shown, best, share: best && sum > 0 ? weight(greek, best) / sum : 0 };
}

function openInterestTile(e: GammaExposure): string {
  const sym = unitSymbol(e.unit);
  const ratio = e.call_oi > 0 ? (e.put_oi / e.call_oi).toFixed(2) : "–";
  return `<div class="cvd-tile"><p class="eyebrow">${tr("Open interest")}</p><p class="cvd-big"><span class="lq-ink-l" data-u="call-oi">${formatUsd(e.call_oi * e.spot, sym)}</span> / <span class="lq-ink-s" data-u="put-oi">${formatUsd(e.put_oi * e.spot, sym)}</span></p><p class="dim">${
    e.expiries === 1
      ? tr("calls / puts at the spot · put/call {ratio} · {options} options, one expiry", {
          ratio,
          options: e.options,
        })
      : tr("calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries", {
          ratio,
          options: e.options,
          expiries: e.expiries,
        })
  }</p></div>`;
}

function tiles(
  greek: Greek,
  data: {
    currency: string;
    exposure: GammaExposure;
    expiries: readonly GammaExpiry[];
    now: number;
  },
): string {
  const { currency, exposure: e, expiries, now } = data;
  const sym = unitSymbol(e.unit);
  const call = callOf(greek, e);
  const put = putOf(greek, e);
  const net = call + put;
  const sides = `<p class="cvd-big"><span class="lq-ink-l" data-u="calls">${greek === "delta" ? signedUsd(call, sym) : formatUsd(call, sym)}</span> / <span class="lq-ink-s" data-u="puts">${greek === "delta" ? signedUsd(put, sym) : formatUsd(put, sym)}</span></p>`;
  const { shown, best, share } = largest(greek, expiries, e);
  const most = best
    ? `<p class="cvd-big"><span data-u="most">${dayLabel(best.expiry)}</span></p><p class="dim">${tr("{share} of it in that expiry, {left} left", { share: `${Math.round(share * 100)}%`, left: leftText(best.expiry, now) })}</p>`
    : `<p class="cvd-big dim">–</p>`;
  if (greek === "delta") {
    // Deribit's books read in coins too: the net as the coins it moves like.
    const reading =
      e.source === "deribit" && e.spot > 0
        ? tr("≈ {coins} at the spot; what the open options move like, as their buyers hold them", {
            coins: `${Math.round(net / e.spot).toLocaleString("en-US")} ${esc(currency)}`,
          })
        : tr("what the open options move like, as their buyers hold them");
    return `<div class="cvd-tiles gk-tiles" data-live="greek-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Net delta")}</p><p class="cvd-big ${tone(net)}"><span data-u="net">${signedUsd(net, sym)}</span></p><p class="dim">${reading}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Calls / puts")}</p>${sides}<p class="dim">${tr("calls' delta is positive, puts' negative")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Most delta")}</p>${most}</div>
${openInterestTile(e)}
</div>`;
  }
  if (greek === "vega") {
    return `<div class="cvd-tiles gk-tiles" data-live="greek-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Vega")}</p><p class="cvd-big"><span data-u="net">${formatUsd(net, sym)}</span></p><p class="dim">${tr("per IV point: what the open options gain if implied volatility rises one point, and their writers lose")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Calls / puts")}</p>${sides}<p class="dim">${tr("every option gains as implied volatility rises")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Most vega")}</p>${most}</div>
${openInterestTile(e)}
</div>`;
  }
  // The day's theta against what the options in range are worth: how fast their value is going.
  const premium = shown.reduce((acc, x) => acc + (x.premium ?? 0), 0);
  const rate =
    premium > 0
      ? `<p class="cvd-big"><span data-u="rate">${((-net / premium) * 100).toFixed(2)}%</span></p><p class="dim">${tr("of the options' value a day, {premium} in all", { premium: formatUsd(premium, sym) })}</p>`
      : `<p class="cvd-big dim">–</p>`;
  return `<div class="cvd-tiles gk-tiles" data-live="greek-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Theta")}</p><p class="cvd-big lq-ink-s"><span data-u="net">${formatUsd(net, sym)}</span></p><p class="dim">${tr("a day: what the open options lose to time with price and IV unchanged, paid by their buyers to their writers")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Calls / puts")}</p>${sides}<p class="dim">${tr("every option loses value as expiry nears, faster the closer it is")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Most theta")}</p>${most}</div>
<div class="cvd-tile"><p class="eyebrow">${tr("Decay rate")}</p>${rate}</div>
</div>`;
}

/** The By expiry chart's Greek view for a tab (gamma.ts expiryChart), drawn as its strike chart is. */
function expiryMeasure(greek: Greek): ExpiryMeasure {
  const base = {
    call: (x: GammaExpiry) => callOf(greek, x),
    put: (x: GammaExpiry) => putOf(greek, x),
    shape: SHAPE[greek],
  };
  if (greek === "delta")
    return {
      ...base,
      label: tr("delta"),
      title: tr("Each expiry's delta: calls above zero, puts below"),
      readout: tr("delta {calls} / {puts}, net {net}"),
    };
  if (greek === "vega")
    return {
      ...base,
      label: tr("vega"),
      title: tr("Each expiry's vega, its calls and puts stacked"),
      readout: tr("vega {calls} / {puts}, total {net}"),
    };
  return {
    ...base,
    label: tr("theta"),
    title: tr("Each expiry's theta a day, its calls and puts stacked down from the top"),
    readout: tr("theta {calls} / {puts} a day, total {net}"),
  };
}

function expiryTable(
  greek: Greek,
  data: {
    currency: string;
    exposure: GammaExposure;
    expiries: readonly GammaExpiry[];
    now: number;
  },
): string {
  const { exposure, expiries, now } = data;
  const rows = expiries.filter((x) => x[FIELDS[greek][0]] !== null);
  if (rows.length === 0) return "";
  const sym = unitSymbol(exposure.unit);
  const total = rows.reduce((sum, x) => sum + weight(greek, x), 0);
  const money = (v: number) => (greek === "delta" ? signedUsd(v, sym) : formatUsd(v, sym));
  const body = rows
    .map((x) => {
      const call = callOf(greek, x);
      const put = putOf(greek, x);
      const net = call + put;
      const share = total > 0 ? weight(greek, x) / total : 0;
      const shown = inScope(
        exposure.scope as GammaScope,
        x.expiry,
        exposure.next_expiry,
        exposure.computed_at,
      );
      return `<tr data-k="${x.expiry.getTime()}"${shown ? "" : ' class="gx-out"'}>
<td>${dayLabel(x.expiry)} <span class="dim">${x.expiry.getUTCFullYear()}</span></td>
<td class="num dim">${leftText(x.expiry, now)}</td>
<td class="num">${x.atm_iv === null ? '<span class="dim">–</span>' : `${(x.atm_iv * 100).toFixed(1)}%`}</td>
<td class="num lq-ink-l">${money(call)}</td>
<td class="num lq-ink-s">${money(put)}</td>
<td class="num ${greek === "delta" ? tone(net) : ""}"><span data-u="net">${money(net)}</span></td>
<td class="num dim">${Math.round(share * 100)}%</td>
</tr>`;
    })
    .join("");
  const unitNote =
    greek === "delta"
      ? tr(
          "Delta in {unit}: the value of the underlying each expiry's open options move like. Expiries outside the chosen range are dimmed; an option in its last hour is left out.",
          { unit: esc(exposure.unit) },
        )
      : greek === "vega"
        ? tr(
            "Vega in {unit} per IV point. Expiries outside the chosen range are dimmed; an option in its last hour is left out.",
            { unit: esc(exposure.unit) },
          )
        : tr(
            "Theta in {unit} a day. Expiries outside the chosen range are dimmed; an option in its last hour is left out.",
            { unit: esc(exposure.unit) },
          );
  const chart = expiryChart(
    {
      currency: data.currency,
      exposure,
      expiries: rows,
      scope: exposure.scope as GammaScope,
      now,
    },
    expiryMeasure(greek),
    `${greek}-expiry-chart`,
  );
  return `<h2 class="cvd-h2 wm-h2">${tr("By expiry")}</h2>
${chart}
<div class="sheet-wrap"><table class="sheet gx-table">
<thead><tr><th>${tr("Expiry")}</th><th class="num">${tr("Left")}</th><th class="num" title="${esc(tr("Implied volatility at the expiry's forward, a year"))}">${tr("ATM IV")}</th><th class="num">${tr("Calls")}</th><th class="num">${tr("Puts")}</th><th class="num">${greek === "delta" ? tr("Net") : tr("Total")}</th><th class="num" title="${esc(tr("Of the chain's total, either side counted"))}">${tr("Share")}</th></tr></thead>
<tbody data-live="greek-expiries">${body}</tbody>
</table></div>
<p class="notes">${unitNote}</p>`;
}

function help(greek: Greek): string {
  const what =
    greek === "delta"
      ? `<p>${tr(
          "Delta is how much an option's value moves with the underlying: about a half at the money, near 1 deep in the money and near 0 far out of it, negative for puts. Times open interest and the forward, it is the value of the underlying the open options move like, added up by strike.",
        )}</p><p>${tr(
          "It is read from the side of whoever bought the options: calls positive, puts negative. Whoever wrote them holds exactly the opposite, so were every writer hedged, their hedges would hold this much of the underlying. Nothing here assumes who is on which side, unlike gamma exposure.",
        )}</p><p>${tr(
          "Most delta sits in options already in the money, away from the spot, so this chart often reaches wider than the gamma chart.",
        )}</p>`
      : greek === "vega"
        ? `<p>${tr(
            "Vega is how much an option's value moves when implied volatility moves one point, say from 40% to 41%: largest at the money and for options with long to run. Times open interest, it is what the open options gain if IV rises a point, added up by strike.",
          )}</p><p>${tr(
            "Every option carries positive vega for whoever bought it and the same amount negative for whoever wrote it, so the total is what option writers stand to lose if IV rises a point, and gain if it falls one.",
          )}</p>`
        : `<p>${tr(
            "Theta is how much an option's value falls in a day with price and implied volatility unchanged: largest at the money and in an option's last days. Times open interest, it is what the open options lose in a day, added up by strike.",
          )}</p><p>${tr(
            "Buyers pay it and writers collect it: the total is roughly what option writers earn in a quiet day, the carry they are paid for taking on gamma. The decay rate divides it by what the options in range are worth.",
          )}</p>`;
  return `${what}<p>${tr(
    "The same books and reads as Gamma Exposure: Deribit's BTC and ETH every five minutes, Cboe's US chains every 15 minutes through the session, and the exchanges' end-of-day files for Asia-Pacific and Europe. Each option's Greeks are Black-76 at a zero rate on its own open interest, implied volatility and forward, in the currency the contract pays; they reproduce Deribit's own to within 0.03%.",
  )}</p>`;
}

function notes(greek: Greek, words: { source: string; asof: string }): string {
  if (greek === "delta")
    return tr(
      "Delta as the options' buyers hold it: calls positive, puts negative; whoever wrote them holds the opposite. {source} options, {asof}.",
      words,
    );
  if (greek === "vega")
    return tr(
      "Vega as the options' buyers hold it, per point of implied volatility; whoever wrote them holds the opposite. {source} options, {asof}.",
      words,
    );
  return tr(
    "Theta as the options' buyers hold it, per day; whoever wrote them collects it. {source} options, {asof}.",
    words,
  );
}

/** One Greek's tab, from its controls down. `data` is null when the read failed. */
export function greekPanel(
  greek: Greek,
  view: { data: GammaData | null; params: GammaParams; heatmap: HeatmapParams; now: number },
): string {
  const { data, params, heatmap, now } = view;
  const next = data?.scopes[0]?.next_expiry ?? null;
  const books = data?.books ?? [];
  const picker = books.length
    ? bookPicker({ books, heatmap, params, now, tab: greek })
    : `<nav class="tf" aria-label="${esc(tr("Option book"))}"><a href="${esc(choiceHref(heatmap, params, greek))}" data-gx-swap aria-current="true">${esc(params.currency)}</a></nav>`;
  const stored = new Set(data?.scopes.map((e) => e.scope));
  const scopes = GAMMA_SCOPES.map((scope) => {
    const on = scope === params.scope;
    const none =
      stored.size > 0 && !stored.has(scope)
        ? ` class="gx-none" title="${esc(tr("No expiry in this range"))}"`
        : "";
    return `<a href="${esc(choiceHref(heatmap, { ...params, scope }, greek))}"${none} data-gx-swap${on ? ' aria-current="true"' : ""}>${scopeLabel(scope, next)}</a>`;
  }).join("");
  const controls = `<div class="lq-controls gx-controls" data-loading="${esc(tr("Loading {asset}…"))}">${picker}<nav class="tf" aria-label="${esc(tr("Expiries"))}">${scopes}</nav>${helpButton(`rates-${greek}`)}</div>
${helpPanel(`rates-${greek}`, help(greek))}`;

  if (data === null) {
    return `${controls}<p class="empty">${tr("The options data could not be read right now.")}</p>`;
  }
  const exposure = data.exposure;
  if (exposure === null) {
    const first = data.scopes[0];
    if (first) {
      return `${controls}<p class="empty">${tr(
        "No {currency} option expires in this range; the nearest expires {date}.",
        { currency: esc(data.currency), date: dayLabel(first.next_expiry) },
      )}</p>`;
    }
    return `${controls}<p class="empty">${tr("No gamma exposure has been computed for {currency} yet.", { currency: esc(data.currency) })}</p>`;
  }
  const pub = publisher(exposure.source);
  const fresh = freshness(exposure.source, exposure.computed_at, now);
  if (fresh === "dead") {
    return `${controls}<p class="empty">${tr(
      "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.",
      {
        source: esc(pub.name),
        currency: esc(data.currency),
        ago: agoText(exposure.computed_at, now),
      },
    )}</p>`;
  }
  // A book last read before the collector kept the other Greeks (migration 047) has none yet.
  if (exposure[FIELDS[greek][0]] === null) {
    return `${controls}<p class="empty">${tr(
      "Delta, vega and theta have not been computed for {currency} yet; they arrive with its next read.",
      { currency: esc(data.currency) },
    )}</p>`;
  }
  const scopeName = scopeLabel(params.scope, exposure.next_expiry);
  const stale =
    fresh !== "late"
      ? ""
      : pub.cadence === "live"
        ? `<p class="notes gx-stale">${tr("Not updated since {ago}: the latest read of {source} failed, so these figures are that old.", { ago: agoText(exposure.computed_at, now), source: esc(pub.name) })}</p>`
        : `<p class="notes gx-stale">${tr("Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.", { ago: agoText(exposure.computed_at, now), source: esc(pub.name) })}</p>`;
  // The day's reaction zones, as on the Gamma Exposure tab: the same levels whichever Greek is shown.
  const today = bookLevels(data, now);
  const strip = reactionStrip({
    l: today,
    spot: exposure.spot,
    regime: regimeExposure(data),
    stats: data.wall?.stats,
    record: bookRecord(data, today),
    live: "greek-zones",
    fold: true,
  });
  const chart =
    data.strikes.length === 0
      ? `<p class="empty">${tr("No strike has open interest in this range.")}</p>`
      : greekChart(greek, {
          currency: data.currency,
          exposure,
          strikes: data.strikes,
          scopeName,
          zones: today ? reactionZones(today) : [],
        });
  const asOf =
    pub.cadence === "live"
      ? tr("read {ago}", { ago: agoText(exposure.computed_at, now) })
      : pub.cadence === "session"
        ? tr("15-minute delayed, read {ago}", { ago: agoText(exposure.computed_at, now) })
        : tr("from the end-of-day file for {date}", { date: dayLabel(exposure.computed_at) });
  return `${controls}
${stale}${tiles(greek, { currency: data.currency, exposure, expiries: data.expiries, now })}
${strip}
${chart}
<p class="notes">${notes(greek, { source: esc(pub.name), asof: `<span data-live="greek-asof">${asOf}</span>` })}</p>
${expiryTable(greek, { currency: data.currency, exposure, expiries: data.expiries, now })}`;
}

/** The tab on its own, for `/rates?panel=delta|vega|theta`. */
export function greekFragment(greek: Greek, view: Parameters<typeof greekPanel>[1]): string {
  return `<div class="lazy-body" data-rendered="${view.now}">${greekPanel(greek, view)}</div>`;
}

/** Where a tab loads itself from: the page's own address and choices, plus its `panel=`. */
export function greekPanelHref(heatmap: HeatmapParams, params: GammaParams, greek: Greek): string {
  return `/rates${heatmapToQuery(heatmap, params)}&panel=${greek}`;
}

/** A tab's placeholder, until tabs.ts loads it (chart-skeleton.ts). */
export function greekPlaceholder(
  heatmap: HeatmapParams,
  params: GammaParams,
  greek: Greek,
): string {
  return lazyPlaceholder(`/rates${heatmapToQuery(heatmap, params)}#${greek}`);
}
