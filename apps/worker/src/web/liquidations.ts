import type { AssetClass } from "@ai-rates/core";
import type { LiquidationAssetMap, LiquidationMap, Overview } from "../app/data";
import {
  DEFAULT_LIQUIDATION_ASSETS,
  LIQUIDATION_BAND_REACH,
  LIQUIDATION_BANDS,
  LIQUIDATION_WINDOW_KEYS,
  LIQUIDATION_WINDOWS,
  type LiquidationAssetParams,
  type LiquidationBand,
  type LiquidationParams,
  type LiquidationWindow,
  liquidationsToQuery,
} from "../app/params";
import { ageText, esc, formatPrice, formatUsd, since } from "./format";
import { layout } from "./layout";
import { assetKey, assetName } from "./pages";
import { tabBar } from "./tabs";

/** The address form every asset page uses: crypto unmarked, every other class in the path. */
const assetPathFor = (asset: string, assetClass: AssetClass | null) =>
  assetClass === null || assetClass === "crypto"
    ? encodeURIComponent(asset)
    : `${assetClass}/${encodeURIComponent(asset)}`;

import { venueName } from "./venues";

/**
 * The liquidation map: what each venue force-closed, by asset and by hour.
 *
 * WHY A GRID AND NOT A FEED. A liquidation list is a stream of individual closes, which reads as
 * noise -- 24,058 of them in a day, measured. What a reader actually wants to see is where the
 * forced flow CLUSTERED: which asset, which hour, on which venue, and in which direction. A grid
 * answers that at a glance and a list never does.
 *
 * TWO PANELS, ONE PER VENUE, and that is the page's whole point. Only gate and okx publish a
 * liquidation feed the collector ingests (migration 012), so the venue is not a column with two
 * values -- it is the split. Putting them side by side on shared rows and shared columns makes the
 * comparison the page exists for: the same asset, the same hour, two different books.
 *
 * WHAT A CELL ENCODES, and it is two things at once:
 *   - INTENSITY is money, on a log scale. Measured over 24 hours: the median populated cell is
 *     $1,466 and the busiest is $12.9M, four orders of magnitude apart. A linear ramp would paint
 *     one cell and leave the rest black.
 *   - HUE is which side was closed -- blue for longs, red for shorts, the same tokens the rest of
 *     the site uses for a long and a short leg. A long liquidation is a forced SELL into a falling
 *     book and a short liquidation a forced BUY into a rising one, so the colour is the direction
 *     of the pressure, not decoration. Measured: 1,777 of 2,382 cells are entirely one-sided, so
 *     the hue is usually a clean signal rather than a blend.
 *
 * An empty cell is empty, never a zero. Nothing happening and $0 happening look identical in a
 * table and are not the same claim -- the same reason the rates grid dashes an absent market.
 */

/** Cell colour steps, in dollars. Chosen from the measured distribution, not from round numbers. */
const STEPS = [1_000, 10_000, 100_000, 1_000_000, 5_000_000] as const;

/** The step a cell's notional falls in, 1..6. */
function step(usd: number): number {
  let index = 1;
  for (const bound of STEPS) {
    if (usd < bound) return index;
    index++;
  }
  return index;
}

function cellClass(usd: number, longUsd: number, shortUsd: number): string {
  // Ties go to neither: a cell that closed as much long as short is a squeeze in both directions and
  // colouring it one of them would be a coin flip presented as a finding.
  const side = longUsd === shortUsd ? "b" : longUsd > shortUsd ? "l" : "s";
  return `lq-${side}${step(usd)}`;
}

function money(usd: number): string {
  // formatUsd renders a dash for nothing, which is right in a column of figures and wrong inside a
  // cell that only exists because something happened.
  return usd > 0 ? formatUsd(usd) : "$0";
}

interface Column {
  start: Date;
  /** The bucket in progress: it covers less time than the others and must not be read as a drop. */
  partial: boolean;
}

/**
 * Every column in the window, including the ones nothing landed in.
 *
 * Built from the window rather than from the rows, because a quiet hour is a fact about the market
 * and a grid that silently omitted it would compress two distant hours into neighbours.
 */
function columns(params: LiquidationParams, now: number): Column[] {
  const { hours, bucketHours } = LIQUIDATION_WINDOWS[params.window];
  const bucketMs = bucketHours * 3_600_000;
  const current = Math.floor(now / bucketMs) * bucketMs;
  const out: Column[] = [];
  for (let i = hours / bucketHours - 1; i >= 0; i--) {
    out.push({ start: new Date(current - i * bucketMs), partial: i === 0 });
  }
  return out;
}

function columnLabel(column: Column, bucketHours: number): string {
  const hour = column.start.getUTCHours();
  const label = `${String(hour).padStart(2, "0")}`;
  // A day boundary is the one place a bare hour is ambiguous across a 48-hour or 7-day window.
  const day = hour < bucketHours ? `${column.start.getUTCDate()}/` : "";
  return `${day}${label}`;
}

/**
 * Every control on the page builds its href through here.
 *
 * The window strip sits above the tabs and applies to both panels, the band strip lives inside the
 * priced one, and the address carries the asset. Each control changes ONE of those and must preserve
 * the rest: the first version had the window strip pointing at /liquidations, so changing the window
 * while reading ETH's prices dropped both the asset and the band and bounced the reader to the map.
 *
 * The fragment is carried too, because the server picks the active tab from the address: without it,
 * a band link from the priced tab of /liquidations (where no asset is named) would land back on the
 * map, which is not where the reader was.
 */
function controlHref(
  state: {
    /** The asset the ADDRESS names, which is not always the one the priced tab is showing. */
    addressed: string | null;
    assetClass: AssetClass | null;
    params: LiquidationParams;
    assetParams: LiquidationAssetParams;
  },
  overrides: {
    window?: LiquidationWindow;
    band?: LiquidationBand | null;
    /** Swap the asset the address names. Null returns to the all-assets address. */
    asset?: { name: string; assetClass: AssetClass } | null;
  } = {},
  hash = "",
): string {
  // The ADDRESSED asset, never the primed one: /liquidations primes the busiest asset behind the
  // second tab, and building the window links off that would send a reader changing the window on
  // the map tab to /liquidations/ETH -- a different address, and a different active tab.
  const addressed =
    overrides.asset === undefined
      ? state.addressed === null
        ? null
        : { name: state.addressed, assetClass: state.assetClass }
      : overrides.asset;
  const base =
    addressed === null
      ? "/liquidations"
      : `/liquidations/${assetPathFor(addressed.name, addressed.assetClass)}`;
  const query = new URLSearchParams();
  const window = overrides.window ?? state.params.window;
  if (window !== "24h") query.set("window", window);
  if (state.params.assets !== DEFAULT_LIQUIDATION_ASSETS) {
    query.set("assets", String(state.params.assets));
  }
  const band = overrides.band === undefined ? state.assetParams.band : overrides.band;
  if (band !== null) query.set("band", String(band));
  const encoded = query.toString();
  return `${base}${encoded ? `?${encoded}` : ""}${hash}`;
}

/** The window strip, mirroring the rates page's timeframe control. It governs both panels. */
function windowStrip(state: {
  addressed: string | null;
  assetClass: AssetClass | null;
  params: LiquidationParams;
  assetParams: LiquidationAssetParams;
}): string {
  const links = LIQUIDATION_WINDOW_KEYS.map((key) => {
    const href = controlHref(state, { window: key });
    const label = esc(key);
    return key === state.params.window
      ? `<a class="on" href="${esc(href)}" aria-current="page">${label}</a>`
      : `<a href="${esc(href)}">${label}</a>`;
  }).join("");
  return `<nav class="tf" aria-label="Window">${links}</nav>`;
}

function legend(): string {
  const bounds = ["&lt;$1k", "$1k–10k", "$10k–100k", "$100k–1M", "$1M–5M", "≥$5M"];
  const swatches = bounds
    .map(
      (label, i) =>
        `<span class="lq-key"><i class="lq-l${i + 1}"></i><i class="lq-s${i + 1}"></i>${label}</span>`,
    )
    .join("");
  return `<div class="lq-legend"><span class="lq-legend-title">Cell</span>${swatches}
<span class="lq-key lq-hue"><i class="lq-l5"></i>longs closed</span>
<span class="lq-key lq-hue"><i class="lq-s5"></i>shorts closed</span></div>`;
}

function mapPanel(data: { map: LiquidationMap; params: LiquidationParams; now: number }): string {
  const { map, params, now } = data;
  const { bucketHours } = LIQUIDATION_WINDOWS[params.window];
  const cols = columns(params, now);
  const query = liquidationsToQuery(params);

  // Index once: the grid reads every (venue, asset, bucket) and a scan per cell would be quadratic
  // in a page that is already 2 x 13 x 12 cells.
  //
  // The key separator is NUL, written as the escape \0 and never as a raw byte: an asset can be
  // named almost anything a venue lists, so the separator has to be a character that cannot appear
  // in one -- but a raw U+0000 in a source file makes `file` call it binary and grep return nothing
  // for any pattern in it, which is why the same separator was rewritten this way in
  // packages/core/src/ranking-eval.ts.
  const byCell = new Map<string, { usd: number; events: number; long: number; short: number }>();
  for (const cell of map.cells) {
    byCell.set(
      `${cell.venue_id}\0${cell.asset}\0${cell.asset_class}\0${cell.bucket_start.getTime()}`,
      {
        usd: cell.notional_usd,
        events: cell.events,
        long: cell.long_usd,
        short: cell.short_usd,
      },
    );
  }
  const byColumnTotal = new Map<
    string,
    { usd: number; events: number; long: number; short: number }
  >();
  for (const total of map.columnTotals) {
    byColumnTotal.set(`${total.venue_id}\0${total.bucket_start.getTime()}`, {
      usd: total.notional_usd,
      events: total.events,
      long: total.long_usd,
      short: total.short_usd,
    });
  }

  const venues = map.totals.map((total) => total.venue_id);

  const panel = (venueId: string): string => {
    const totals = map.totals.find((total) => total.venue_id === venueId);
    const head = cols
      .map(
        (column) =>
          `<th class="num${column.partial ? " lq-now" : ""}" scope="col"${
            column.partial ? ' title="This column is still filling"' : ""
          }>${esc(columnLabel(column, bucketHours))}</th>`,
      )
      .join("");

    const rows = map.assets
      .map((asset) => {
        const key = assetKey(asset.asset, asset.asset_class);
        const cells = cols
          .map((column) => {
            const cell = byCell.get(
              `${venueId}\0${asset.asset}\0${asset.asset_class}\0${column.start.getTime()}`,
            );
            if (!cell) return `<td class="num none" data-c="${column.start.getTime()}">·</td>`;
            const title = `${money(cell.usd)} across ${cell.events.toLocaleString("en-US")} liquidation${
              cell.events === 1 ? "" : "s"
            } — ${money(cell.long)} long, ${money(cell.short)} short`;
            return `<td class="num ${cellClass(cell.usd, cell.long, cell.short)}" data-c="${column.start.getTime()}" title="${esc(
              title,
            )}"><span data-u="usd">${money(cell.usd)}</span><span class="lq-n">${cell.events.toLocaleString(
              "en-US",
            )}</span></td>`;
          })
          .join("");
        // The row links to the asset's OWN grid, where the axis becomes the price a position died
        // at -- the one view this page cannot show, because a price band means nothing across
        // twelve different assets.
        return `<tr data-k="${esc(key)}"><th class="asset" scope="row"><a href="/liquidations/${assetPathFor(
          asset.asset,
          asset.asset_class,
        )}">${assetName(asset.asset, asset.asset_class)}</a></th>${cells}</tr>`;
      })
      .join("");

    // The tail, so the column totals below are checkable against the rows above rather than merely
    // larger than them.
    const other = cols
      .map((column) => {
        const total = byColumnTotal.get(`${venueId}\0${column.start.getTime()}`);
        if (!total) return `<td class="num none">·</td>`;
        let shown = 0;
        for (const asset of map.assets) {
          const cell = byCell.get(
            `${venueId}\0${asset.asset}\0${asset.asset_class}\0${column.start.getTime()}`,
          );
          if (cell) shown += cell.usd;
        }
        const rest = total.usd - shown;
        // Floating point, not a data problem: a sum of doubles that should be zero often is not.
        return rest > 1 ? `<td class="num dim">${money(rest)}</td>` : `<td class="num none">·</td>`;
      })
      .join("");

    const totalRow = cols
      .map((column) => {
        const total = byColumnTotal.get(`${venueId}\0${column.start.getTime()}`);
        if (!total) return `<td class="num none">·</td>`;
        return `<td class="num"><span data-u="total">${money(total.usd)}</span><span class="lq-n">${total.events.toLocaleString(
          "en-US",
        )}</span></td>`;
      })
      .join("");

    const heading = totals
      ? `<b>${money(totals.notional_usd)}</b> · ${totals.events.toLocaleString(
          "en-US",
        )} liquidations · ${totals.markets.toLocaleString("en-US")} markets`
      : "no liquidations in this window";

    return `<section class="lq-panel">
<h2 class="lq-venue"><a href="/markets/${esc(venueId)}">${esc(venueName(venueId))}</a></h2>
<p class="lq-sum" data-live="lq-sum-${esc(venueId)}">${heading}</p>
<div class="heat-wrap"><table class="heat lq">
<thead><tr><th class="asset" scope="col">Asset</th>${head}</tr></thead>
<tbody data-live="lq-${esc(venueId)}">${rows}
<tr class="lq-other"><th class="asset" scope="row">other markets</th>${other}</tr>
<tr class="lq-total"><th class="asset" scope="row">total</th>${totalRow}</tr></tbody>
</table></div>
</section>`;
  };

  const body =
    venues.length === 0
      ? `<p class="empty">No liquidations recorded in the last ${esc(params.window)}. Only gate and okx publish a feed the collector reads, so a quiet window here is not a quiet market.</p>`
      : `<div class="lq-grid">${venues.map(panel).join("")}</div>`;

  const newest = map.cells.reduce<Date | null>(
    (latest, cell) => (latest === null || cell.bucket_start > latest ? cell.bucket_start : latest),
    null,
  );

  return `<p class="notes" data-live="lq-asof">Columns are ${bucketHours}-hour buckets in UTC, newest
on the right; the last one is still filling. ${
    newest ? `Newest liquidation ${esc(ageText(newest, now))}.` : ""
  } Rows are the ${map.assets.length} busiest assets by notional across both venues, and the rest are
summed into “other markets”, so the totals below the grid are the venue's real totals and add up.
Any row opens that asset at the price it died at. <a href="/v1/liquidations${esc(query)}">JSON</a>.</p>
${body}`;
}

/**
 * One asset's liquidation grid: price on the y-axis, time on the x, one panel per venue.
 *
 * THE ROW AXIS IS THE PRICE A POSITION DIED AT, which the map cannot show -- there, rows are assets
 * and a price band would mean nothing across them. Here every row is a band of the asset's own
 * price, measured from its mark, and that is the view the layout was designed for: you can see the
 * level where the forced selling started, and whether it started at the same level on both venues.
 *
 * BANDS ARE FIXED-WIDTH WITH CATCH-ALL TAILS, which is not a detail. Measured over 24 hours:
 * liquidation fill prices spread 2.88% of the mark on XAU and 43.24% on ZEC, and ETH's widest fill
 * was 12.9% out while 99% of its closes sat inside 3%. Bands cut linearly from the raw range put
 * every ETH liquidation into three rows of twelve. Fixed bands around the mark keep the middle
 * readable, and the two tails hold the outliers rather than dropping them -- a liquidation 13% from
 * the mark is the most interesting one of the day, not noise to trim.
 *
 * ONE ANCHOR FOR BOTH PANELS: the asset's deepest market by open interest, the reference the
 * arbitrage guard already uses. Rows that meant different prices on the left and the right would
 * not be comparable, and comparing the venues is the point.
 */
function assetPanel(data: {
  asset: string;
  map: LiquidationAssetMap;
  params: LiquidationAssetParams;
  /** Pre-rendered by the caller, the only place that knows the whole address and query. */
  bandStrip: string;
  picker: string;
  now: number;
}): string {
  const { asset, map, params, bandStrip, picker, now } = data;
  const { bucketHours } = LIQUIDATION_WINDOWS[params.window];
  const cols = columns({ window: params.window, assets: 0 }, now);
  const reach = LIQUIDATION_BAND_REACH;
  const mark = map.mark;
  // The width the data layer actually used, which is the fitted one unless the reader picked.
  // NOT named `band`: bandLabel's parameter is a row INDEX also called band, and the first version
  // of this shadowed the width with it, so every row label was computed off its own row number.
  const bandPct = map.band_pct;
  const label = assetName(asset, map.asset_class ?? "crypto");

  const byCell = new Map<string, { usd: number; events: number; long: number; short: number }>();
  for (const cell of map.cells) {
    byCell.set(`${cell.venue_id} ${cell.band} ${cell.bucket_start.getTime()}`, {
      usd: cell.notional_usd,
      events: cell.events,
      long: cell.long_usd,
      short: cell.short_usd,
    });
  }

  /** A band's price range, rendered the way the reference does: tails as >= and <. */
  const bands = bandRows(reach);

  const panel = (venueId: string): string => {
    const totals = map.totals.find((total) => total.venue_id === venueId);
    const head = cols
      .map(
        (column) =>
          `<th class="num${column.partial ? " lq-now" : ""}" scope="col">${esc(
            columnLabel(column, bucketHours),
          )}</th>`,
      )
      .join("");

    const rows = bands
      .map((band) => {
        const cells = cols
          .map((column) => {
            const cell = byCell.get(`${venueId} ${band} ${column.start.getTime()}`);
            if (!cell) return `<td class="num none">·</td>`;
            const title = `${money(cell.usd)} across ${cell.events.toLocaleString("en-US")} liquidation${
              cell.events === 1 ? "" : "s"
            } — ${money(cell.long)} long, ${money(cell.short)} short`;
            return `<td class="num ${cellClass(cell.usd, cell.long, cell.short)}" title="${esc(
              title,
            )}"><span data-u="usd">${money(cell.usd)}</span><span class="lq-n">${cell.events.toLocaleString(
              "en-US",
            )}</span></td>`;
          })
          .join("");
        // The mark sits at the bottom edge of band 0, so the line is drawn under that row -- the
        // dotted reference-price rule the layout uses, in the one place it is meaningful.
        const atMark = band === 0 ? ' class="lq-mark"' : "";
        return `<tr${atMark} data-k="${band}"><th class="asset" scope="row">${bandLabel(
          mark,
          bandPct,
          reach,
          band,
        )}</th>${cells}</tr>`;
      })
      .join("");

    const heading = totals
      ? `<b>${money(totals.notional_usd)}</b> · ${totals.events.toLocaleString(
          "en-US",
        )} liquidations · ${money(totals.long_usd)} long / ${money(totals.short_usd)} short`
      : "nothing force-closed here in this window";

    return `<section class="lq-panel">
<h2 class="lq-venue"><a href="/markets/${esc(venueId)}">${esc(venueName(venueId))}</a></h2>
<p class="lq-sum">${heading}</p>
<div class="heat-wrap"><table class="heat lq lq-asset">
<thead><tr><th class="asset" scope="col">Fill price</th>${head}</tr></thead>
<tbody data-live="lqa-${esc(venueId)}">${rows}</tbody>
</table></div>
</section>`;
  };

  const venues = map.totals.map((total) => total.venue_id);
  const body =
    mark === null
      ? `<p class="empty">No live market for ${label} is publishing a mark, so there is no price to band liquidations against.</p>`
      : venues.length === 0
        ? `<p class="empty">No liquidations recorded for ${label} in the last ${esc(
            params.window,
          )}. Only gate and okx publish a feed the collector reads.</p>`
        : `<div class="lq-grid">${venues.map(panel).join("")}</div>`;

  return `<p class="notes">Showing <b>${label}</b>, priced in bands of ${bandPct}% around the mark${
    map.band_fitted ? ", fitted to where this asset's closes actually landed" : ""
  }; the outer rows hold everything further out. ${
    mark === null
      ? ""
      : `Banded from <b>${formatPrice(mark)}</b>, the deepest market's mark — the same anchor the
arbitrage guard uses, so both venues share rows.`
  }</p>
<div class="lq-controls">${picker}<nav class="tf" aria-label="Band width">${bandStrip}</nav></div>
${body}`;
}

/**
 * The asset picker the two per-asset tabs carry.
 *
 * Plain links, not a select: it needs no JavaScript, it is the same `.tf` strip the window and band
 * controls already use, and every entry is a real address a reader can copy or open in a new tab.
 * The cost is that it offers the busiest assets rather than all of them -- 724 markets liquidated in
 * the last day, measured, and a picker holding all of them would be a scrollbar, not a control. The
 * map tab is the way to any asset outside this list, and the note beside the strip says so.
 *
 * The fragment keeps the reader on the tab they are reading: without it, following a link from the
 * sides tab would land on the priced one, because the server picks the tab from the address.
 */
function assetStrip(
  state: {
    addressed: string | null;
    assetClass: AssetClass | null;
    params: LiquidationParams;
    assetParams: LiquidationAssetParams;
  },
  assets: readonly { asset: string; asset_class: AssetClass }[],
  current: string | null,
  hash: string,
): string {
  if (assets.length === 0) return "";
  const links = assets
    .map((entry) => {
      const href = esc(
        controlHref(state, { asset: { name: entry.asset, assetClass: entry.asset_class } }, hash),
      );
      const label = assetName(entry.asset, entry.asset_class);
      return entry.asset === current
        ? `<a class="on" href="${href}" aria-current="page">${label}</a>`
        : `<a href="${href}">${label}</a>`;
    })
    .join("");
  return `<nav class="tf lq-assets" aria-label="Asset">${links}</nav>`;
}

/**
 * A band's price range, rendered as the reference layout renders it: fixed ranges in the middle and
 * the two extremes as ">=" and "<".
 *
 * Module-level because two tabs draw these rows now -- the priced grid and the long/short split --
 * and a page whose two views disagreed about what row 3 meant would be contradicting itself.
 */
function bandLabel(mark: number | null, bandPct: number, reach: number, band: number): string {
  if (mark === null) return "";
  const edge = (n: number) => formatPrice(mark * (1 + (n * bandPct) / 100));
  if (band === reach) return `≥ ${edge(reach)}`;
  if (band === -reach) return `&lt; ${edge(-reach + 1)}`;
  return `${edge(band)} – ${edge(band + 1)}`;
}

/** Bands from the top catch-all down to the bottom one, which is the order the rows read in. */
function bandRows(reach: number): number[] {
  const bands: number[] = [];
  for (let band = reach; band >= -reach; band--) bands.push(band);
  return bands;
}

/**
 * One asset, longs on the left and shorts on the right, every exchange aggregated.
 *
 * This is the reference layout at its closest: price bands down the side, the two sides as two
 * panels on shared rows, and the hue carried by the panel so only intensity varies within it.
 *
 * ONE ASSET, NOT ALL OF THEM, because the rows are prices. A price band across twelve different
 * assets is meaningless -- that view is the map, one tab to the left, where the rows are the assets
 * themselves. Here the question is narrower and better: for THIS asset, at which levels did each
 * side get taken out.
 *
 * EVERY EXCHANGE MERGED, which is what separates this from the priced tab beside it. That one keeps
 * the venues apart to ask whether they broke at the same level; this one adds them up to ask what
 * happened to the asset. A reader wanting one venue's share of a band has the other tab.
 *
 * NO EXTRA QUERY: liquidationAsset already returns long_usd and short_usd per venue per band, so
 * merging the exchanges is a sum over what the page has.
 */
function sidesPanel(data: {
  asset: string;
  map: LiquidationAssetMap;
  params: LiquidationParams;
  /** Pre-rendered by the caller, which is the only place that knows the whole address and query. */
  picker: string;
  now: number;
}): string {
  const { asset, map, params, picker, now } = data;
  const { bucketHours } = LIQUIDATION_WINDOWS[params.window];
  const cols = columns(params, now);
  const reach = LIQUIDATION_BAND_REACH;
  const mark = map.mark;
  const bandPct = map.band_pct;
  const label = assetName(asset, map.asset_class ?? "crypto");

  // (band, bucket) -> the two sides, summed over every venue.
  const byCell = new Map<string, { long: number; short: number; events: number }>();
  for (const cell of map.cells) {
    const key = `${cell.band}\0${cell.bucket_start.getTime()}`;
    const held = byCell.get(key) ?? { long: 0, short: 0, events: 0 };
    held.long += cell.long_usd;
    held.short += cell.short_usd;
    held.events += cell.events;
    byCell.set(key, held);
  }

  const totals = map.totals.reduce(
    (sum, venue) => ({
      long: sum.long + venue.long_usd,
      short: sum.short + venue.short_usd,
      events: sum.events + venue.events,
    }),
    { long: 0, short: 0, events: 0 },
  );
  const both = totals.long + totals.short;

  const panel = (side: "long" | "short"): string => {
    const head = cols
      .map(
        (column) =>
          `<th class="num${column.partial ? " lq-now" : ""}" scope="col">${esc(
            columnLabel(column, bucketHours),
          )}</th>`,
      )
      .join("");

    const rows = bandRows(reach)
      .map((band) => {
        let rowTotal = 0;
        const cells = cols
          .map((column) => {
            const cell = byCell.get(`${band}\0${column.start.getTime()}`);
            const usd = side === "long" ? (cell?.long ?? 0) : (cell?.short ?? 0);
            if (!cell || usd <= 0) return `<td class="num none">·</td>`;
            rowTotal += usd;
            // The hue is the panel, not the cell: within one grid every fill means the same side,
            // so intensity alone carries the money and the two grids compare directly.
            return `<td class="num lq-${side === "long" ? "l" : "s"}${step(usd)}" title="${esc(
              `${money(usd)} of ${side}s closed between ${bandLabel(mark, bandPct, reach, band).replace("&lt;", "<")}`,
            )}"><span data-u="usd">${money(usd)}</span></td>`;
          })
          .join("");
        const atMark = band === 0 ? ' class="lq-mark"' : "";
        return `<tr${atMark} data-k="${band}"><th class="asset" scope="row">${bandLabel(
          mark,
          bandPct,
          reach,
          band,
        )}</th>${cells}<td class="num lq-rowsum">${rowTotal > 0 ? money(rowTotal) : "·"}</td></tr>`;
      })
      .join("");

    const totalRow = cols
      .map((column) => {
        let usd = 0;
        for (const band of bandRows(reach)) {
          const cell = byCell.get(`${band}\0${column.start.getTime()}`);
          if (cell) usd += side === "long" ? cell.long : cell.short;
        }
        return usd > 0
          ? `<td class="num"><span data-u="total">${money(usd)}</span></td>`
          : `<td class="num none">·</td>`;
      })
      .join("");

    const sum = side === "long" ? totals.long : totals.short;
    const share = both > 0 ? (sum / both) * 100 : 0;

    return `<section class="lq-panel">
<h2 class="lq-venue lq-side-${side}">${side === "long" ? "Longs closed" : "Shorts closed"}</h2>
<p class="lq-sum"><b>${money(sum)}</b> · ${share.toFixed(0)}% of this asset's forced flow</p>
<div class="heat-wrap"><table class="heat lq lq-asset lq-sides">
<thead><tr><th class="asset" scope="col">Fill price</th>${head}<th class="num">All</th></tr></thead>
<tbody data-live="lq-side-${side}">${rows}
<tr class="lq-total"><th class="asset" scope="row">total</th>${totalRow}<td class="num lq-rowsum">${
      sum > 0 ? money(sum) : "·"
    }</td></tr></tbody>
</table></div>
</section>`;
  };

  if (mark === null) {
    return `<p class="empty">No live market for ${label} is publishing a mark, so there is no price to band liquidations against.</p>`;
  }
  if (map.totals.length === 0) {
    return `<p class="empty">Nothing was force-closed in ${label} in the last ${esc(
      params.window,
    )}, on either side.</p>`;
  }

  return `<div class="lq-controls">${picker}</div>
<p class="notes">Showing <b>${label}</b>, every exchange added together — the split by exchange is one
tab along. Rows are the same ${bandPct}% price bands, banded from <b>${formatPrice(mark)}</b>. A long
close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran
against. Any asset outside this list opens from a row on the map tab.</p>
<div class="lq-grid">${panel("long")}${panel("short")}</div>`;
}

/**
 * /liquidations: both views of the same subject, behind one tab bar.
 *
 * They are one category and one page. The map answers "which asset, which hour, which venue" and
 * the priced grid answers "at what level" for one of them -- the second is the first one's
 * drill-down, not a separate destination, and splitting them across two addresses put the same
 * subject in two places in the nav.
 *
 * BOTH PANELS SHIP IN EVERY RESPONSE, because that is how tabs.ts works: nothing is `hidden` in the
 * served HTML and the script hides the inactive panel on load, so a reader without JavaScript sees
 * both sections instead of one panel and a dead button. The cost is the asset query on every
 * request, which is one asset over one window -- and in exchange the tab switch is instant and the
 * hash keeps the choice without adding a second edge-cache key.
 *
 * WHICH ASSET the priced panel shows: the one in the address, or the busiest by notional when the
 * address names none. `/liquidations` therefore opens on the map with the day's biggest asset
 * already primed behind the second tab, and `/liquidations/ETH` opens on ETH's prices directly.
 */
export function liquidations(data: {
  overview: Overview;
  map: LiquidationMap;
  /** The asset the priced tab shows: the addressed one, or the busiest when none was addressed. */
  asset: string | null;
  /** True when the ADDRESS named that asset, which is what every control link is built from. */
  addressed: boolean;
  assetMap: LiquidationAssetMap | null;
  params: LiquidationParams;
  assetParams: LiquidationAssetParams;
  /** Which tab the server marks active. A hash in the URL still overrides it. */
  active: "map" | "sides" | "price";
  now: number;
}): string {
  const { overview, map, asset, addressed, assetMap, params, assetParams, active, now } = data;
  const state = {
    addressed: addressed ? asset : null,
    assetClass: assetMap?.asset_class ?? null,
    params,
    assetParams,
  };

  // "fit" is offered explicitly beside the widths, so a reader who has clicked one can get back to
  // the width chosen from the asset's own data. Every link keeps the #price fragment, or following
  // one from /liquidations would land back on the map tab.
  const bandStrip = [
    `<a${
      assetParams.band === null ? ' class="on" aria-current="page"' : ""
    } href="${esc(controlHref(state, { band: null }, "#price"))}">fit</a>`,
    ...LIQUIDATION_BANDS.map((choice) => {
      const href = esc(controlHref(state, { band: choice }, "#price"));
      return choice === assetParams.band
        ? `<a class="on" href="${href}" aria-current="page">${choice}%</a>`
        : `<a href="${href}">${choice}%</a>`;
    }),
  ].join("");

  const priced =
    asset === null || assetMap === null
      ? `<p class="empty">Nothing has been force-closed in this window, so there is no asset to price.</p>`
      : assetPanel({
          asset,
          map: assetMap,
          params: assetParams,
          bandStrip,
          picker: assetStrip(state, map.assets, asset, "#price"),
          now,
        });

  const totalEvents = map.totals.reduce((sum, venue) => sum + venue.events, 0);

  return layout({
    title: "Liquidations",
    description:
      "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.",
    path: "/liquidations",
    overview,
    now,
    body: `<h1>Liquidations</h1>
<p class="lede">Where positions were force-closed, by exchange. Colour is the side that was closed —
<span class="lq-ink-l">blue for longs</span>, <span class="lq-ink-s">red for shorts</span> — and
intensity is the money, on a log scale. Two venues publish a liquidation feed the collector reads,
so this is gate and okx, not the whole market.</p>
<div class="lq-controls">${windowStrip(state)}${legend()}</div>
${tabBar({
  name: "liq",
  tabs: [
    { id: "map", label: "By asset and hour", shortLabel: "Assets", badge: totalEvents },
    {
      id: "sides",
      label: asset === null ? "Longs vs shorts" : `${asset} longs vs shorts`,
      shortLabel: "Sides",
    },
    {
      id: "price",
      label: asset === null ? "By price level" : `${asset} price levels`,
      shortLabel: "Prices",
    },
  ],
  activeId: active,
})}
<div class="tabpanel" role="tabpanel" id="panel-liq-map" data-tab-panel="map" aria-labelledby="tab-liq-map">
${mapPanel({ map, params, now })}
</div>
<div class="tabpanel" role="tabpanel" id="panel-liq-sides" data-tab-panel="sides" aria-labelledby="tab-liq-sides">
${
  asset === null || assetMap === null
    ? `<p class="empty">Nothing has been force-closed in this window, so there is no asset to split.</p>`
    : sidesPanel({
        asset,
        map: assetMap,
        params,
        picker: assetStrip(state, map.assets, asset, "#sides"),
        now,
      })
}
</div>
<div class="tabpanel" role="tabpanel" id="panel-liq-price" data-tab-panel="price" aria-labelledby="tab-liq-price">
${priced}
</div>
<p class="notes">Updated ${since(overview.updated_at, now)}.</p>`,
  });
}
