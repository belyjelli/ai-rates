import type { AssetClass } from "@ai-rates/core";
import {
  CASCADE_FLOOR,
  CASCADE_GAP_MINUTES,
  CASCADE_PACE,
  type CascadeView,
  longLed,
} from "../app/cascades";
import type {
  AssetOpenInterest,
  LiquidationAssetMap,
  LiquidationAssetSummary,
  LiquidationDay,
  LiquidationEvent,
  LiquidationMap,
  LiquidationTotals,
  Overview,
  StoredCascade,
  TraderHolding,
  WhalePosition,
} from "../app/data";
import type { LeaderBoard, TraderRead } from "../app/hyperliquid";
import { MEMBER_PANELS, type MemberPanel } from "../app/live-pass";
import type { Outlook } from "../app/outlook";
import {
  DEFAULT_LARGEST_FLOOR,
  DEFAULT_LIQUIDATION_ASSETS,
  DEFAULT_PNL_WINDOW,
  DEFAULT_TOP_WINDOW,
  DEFAULT_WHALE_LIST,
  DEFAULT_WHALE_ZOOM,
  HISTORY_SPANS,
  type HistorySpan,
  LARGEST_FLOORS,
  LARGEST_ROWS,
  type LargestFloor,
  type LargestOrder,
  LIQUIDATION_BAND_REACH,
  LIQUIDATION_BANDS,
  LIQUIDATION_VENUE_ALL,
  LIQUIDATION_WINDOW_KEYS,
  LIQUIDATION_WINDOWS,
  type LiquidationAssetParams,
  type LiquidationBand,
  type LiquidationParams,
  type LiquidationWindow,
  liquidationsToQuery,
  liquidationVenueParam,
  liquidationVenues,
  readableQuery,
  type TraderWindow,
  WHALE_FLOORS,
  WHALE_ZOOMS,
  type WhaleFloor,
  type WhaleList,
  type WhaleZoom,
} from "../app/params";
import { PENDING_ROWS, PENDING_ZOOMS, type PendingZoom } from "../app/pending";
import { agentBrief, agentTable, share, utcMinute } from "./agent-brief";
import { CHART_SKELETON_JS, lazyPlaceholder } from "./chart-skeleton";
import { ageText, esc, formatPrice, formatUsd, LOCK_ICON, since } from "./format";
import { helpButton, helpHeading, helpPanel } from "./help";
import { currentLocale, msg, tr, trMsg } from "./i18n";
import { layout, MEMBER_URL } from "./layout";
import { timeTag, timeTitle, zoneTag } from "./localtime";
import { outlookPanel } from "./outlook";
import { assetKey, assetName, assetTitle } from "./pages";
import { PICK_SCRIPT } from "./picker";
import { ASSET_GROUPS, assetGroup } from "./sectors";
import { citeMark, plainLabel } from "./share";
import {
  type SidesSlots,
  SLOT_BAND,
  SLOT_CURSOR,
  SLOT_FORMAT,
  SLOT_SCRIPT,
  sidesText,
  slotData,
} from "./slot-chart";
import { tabBar } from "./tabs";
import { PNL_WINDOW_OF, TRADER_CSS, traderPanel, winnersPanel } from "./trader";
import { floorLabel, whalePanel, whalesNearMark } from "./whale-map";

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

/** A cell's tooltip: its money, how many closes made it, and how much of each side. Plain text. */
function cellTitle(cell: { usd: number; events: number; long: number; short: number }): string {
  const values = {
    usd: money(cell.usd),
    count: cell.events.toLocaleString("en-US"),
    long: money(cell.long),
    short: money(cell.short),
  };
  return cell.events === 1
    ? tr("{usd} across {count} liquidation — {long} long, {short} short", values)
    : tr("{usd} across {count} liquidations — {long} long, {short} short", values);
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

/**
 * A column's header: its start hour, with the date where the day changes ("7/00"), in the reader's
 * zone once localtime.ts's script has run -- the grid's blocks start on UTC hours, which are whole
 * hours in nearly every zone, so the labels stay round. UTC until then.
 */
function columnLabel(column: Column, bucketHours: number): string {
  return timeTag(column.start.getTime(), "col", bucketHours);
}

/**
 * A column header's full range, for its tooltip, as attributes: "16:00–18:00 UTC+8", with the date
 * where the label shows one ("Oct 7 00:00–02:00 UTC+8"), and said to be filling on the column still
 * in progress.
 */
function columnTitle(column: Column, bucketHours: number): string {
  const template = column.partial ? tr("{range}, still filling", { range: "{t}" }) : "{t}";
  return timeTitle(column.start.getTime(), "colt", template, bucketHours);
}

/**
 * The "?" paragraph that reads the time columns, for the two per-asset grids that have them.
 *
 * The worked example follows the window's own block length, so it stays true on 48h (4-hour blocks)
 * and 7d (12-hour blocks): the start hour is the last block start at or before 16:00. Only the Sides
 * grid has an "All" column, so only it gets that sentence.
 */
function columnsHelp(bucketHours: number, withAll: boolean): string {
  return `<p>${tr(
    "Columns are time, in your time zone ({zone}; click the clock at the top for UTC). Each is a {hours}-hour block named by its start hour. Where the day changes, the column shows date/hour (7/00 = the 7th at 00:00). The yellow column is the block in progress and still filling.",
    { hours: bucketHours, zone: zoneTag() },
  )}${withAll ? ` ${tr("'All' is that price row's total over the whole window.")}` : ""}</p>`;
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
    venue?: string;
    band?: LiquidationBand | null;
    pending?: boolean;
    zoom?: PendingZoom;
    whale?: WhaleFloor;
    wzoom?: WhaleZoom;
    wlist?: WhaleList;
    order?: LargestOrder;
    min?: LargestFloor;
    span?: HistorySpan;
    top?: TraderWindow;
    /** Open a trader on the Top traders tab; null returns to its list. */
    trader?: string | null;
    pnl?: TraderWindow;
    coin?: string | null;
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
  const venue = overrides.venue ?? state.params.venue;
  if (venue !== LIQUIDATION_VENUE_ALL) query.set("venue", venue);
  if (state.params.assets !== DEFAULT_LIQUIDATION_ASSETS) {
    query.set("assets", String(state.params.assets));
  }
  const band = overrides.band === undefined ? state.assetParams.band : overrides.band;
  if (band !== null) query.set("band", String(band));
  if (!(overrides.pending ?? state.assetParams.pending)) query.set("pending", "0");
  if ((overrides.zoom ?? state.assetParams.zoom) === "wide") query.set("zoom", "out");
  const whale = overrides.whale ?? state.assetParams.whale;
  if (whale !== "1m") query.set("whale", whale);
  const wzoom = overrides.wzoom ?? state.assetParams.wzoom;
  if (wzoom !== DEFAULT_WHALE_ZOOM) query.set("wzoom", String(wzoom));
  const wlist = overrides.wlist ?? state.assetParams.wlist;
  if (wlist !== DEFAULT_WHALE_LIST) query.set("wlist", wlist);
  if ((overrides.order ?? state.assetParams.order) === "newest") {
    query.set("order", "newest");
    const min = overrides.min ?? state.assetParams.min;
    if (min !== DEFAULT_LARGEST_FLOOR) query.set("min", min);
  }
  const span = overrides.span ?? state.assetParams.span;
  if (span !== 30) query.set("span", String(span));
  const top = overrides.top ?? state.assetParams.top;
  if (top !== DEFAULT_TOP_WINDOW) query.set("top", top);
  const trader = overrides.trader === undefined ? state.assetParams.trader : overrides.trader;
  if (trader !== null) {
    query.set("trader", trader);
    // The chart window and the coin belong to the trader they were picked on.
    const sameTrader = trader === state.assetParams.trader;
    const pnl = overrides.pnl ?? (sameTrader ? state.assetParams.pnl : DEFAULT_PNL_WINDOW);
    if (pnl !== DEFAULT_PNL_WINDOW) query.set("pnl", pnl);
    const coin =
      overrides.coin === undefined ? (sameTrader ? state.assetParams.coin : null) : overrides.coin;
    if (coin !== null) query.set("coin", coin);
  }
  const encoded = readableQuery(query);
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
  return `<nav class="tf" aria-label="${tr("Window")}">${links}</nav>`;
}

/**
 * The venues a view is narrowed to, among the feeds this window actually has: empty means every
 * feed. A named venue with nothing in the window is dropped, so a selection that names only quiet
 * venues reads as "all" rather than as an empty grid the reader did not ask for.
 */
function pickedFeeds(params: Pick<LiquidationParams, "venue">, feeds: readonly string[]): string[] {
  const named = liquidationVenues(params);
  return named ? feeds.filter((venueId) => named.includes(venueId)) : [];
}

/**
 * Which venues the map adds up: every feed, or any combination of them.
 *
 * A strip of links rather than checkboxes, like every other control here: no JavaScript, each entry
 * is an address. A venue is a toggle -- its link is the current selection with that venue added or
 * taken away -- and the selected ones are highlighted. "all" clears the selection, and picking every
 * feed is the same grid as picking none, so it is the same address. The strip disappears on a
 * single-feed window, where a chooser would be a control with one choice. The venues come from the
 * data, so a feed added to the collector appears here without this page being edited.
 */
function venueStrip(
  state: {
    addressed: string | null;
    assetClass: AssetClass | null;
    params: LiquidationParams;
    assetParams: LiquidationAssetParams;
  },
  feeds: readonly string[],
  /** The tab the strip sits in, which a click reloads: the map, or the Largest list. */
  tab: "map" | "largest" = "map",
): string {
  if (feeds.length < 2) return "";
  const picked = pickedFeeds(state.params, feeds);
  const href = (ids: readonly string[]) =>
    esc(
      controlHref(
        state,
        { venue: ids.length === feeds.length ? LIQUIDATION_VENUE_ALL : liquidationVenueParam(ids) },
        `#${tab}`,
      ),
    );
  // data-lq-swap="<tab>" makes the link an in-place reload of this tab (LQ_SWAP_SCRIPT), and
  // data-lq-venue says what it toggles: "all", or one venue.
  const all =
    picked.length === 0
      ? `<a class="on" href="${href([])}" aria-current="true" data-lq-swap="${tab}" data-lq-venue="${LIQUIDATION_VENUE_ALL}">${tr("all")}</a>`
      : `<a href="${href([])}" data-lq-swap="${tab}" data-lq-venue="${LIQUIDATION_VENUE_ALL}">${tr("all")}</a>`;
  const venues = feeds
    .map((venueId) => {
      const label = esc(venueName(venueId).toLowerCase());
      return picked.includes(venueId)
        ? `<a class="on" href="${href(picked.filter((id) => id !== venueId))}" aria-current="true" data-lq-swap="${tab}" data-lq-venue="${esc(venueId)}">${label}</a>`
        : `<a href="${href([...picked, venueId])}" data-lq-swap="${tab}" data-lq-venue="${esc(venueId)}">${label}</a>`;
    })
    .join("");
  return `<nav class="tf" aria-label="${tr("Venue")}"><span class="tf-label">${tr("Venue")}</span>${all}${venues}</nav>`;
}

/**
 * Every control inside a liquidation tab works in place: a click reloads only that tab, the way a
 * lazy tab loads itself, instead of the whole page. Links opt in with `data-lq-swap="<tab>"`: the
 * venue strip on the map, the asset picker on Sides, Prices and Odds, Pending on/off and Zoom on
 * Sides, and the band widths on Prices.
 *
 * The links stay real addresses, so this is an enhancement and never the only way: without the
 * script, or on any failure, the link is simply followed. With it, the clicked choice lights up at
 * once, the tab's charts and grids give way to the loading chart (chart-skeleton.ts), and the tab's own fragment (`?panel=<tab>`,
 * the address a lazy tab loads from) replaces it. The address moves with pushState, and Back walks
 * the choices.
 *
 * Everything else on the page was built for the old address, so it is pointed at the new one: the
 * window strip's links, the language switch, the per-asset tab labels (the fragment carries them in
 * data-labels), and every tab's `data-lazy` address. Each tab becomes one tabs.ts manages: the one
 * just loaded keeps its fragment, `.lazy-body` and all, so live.ts refreshes it from its own address;
 * the others are marked stale, so they are fetched again when next shown -- the Prices tab draws only
 * the selected venues, and none of them may keep showing an asset the reader moved away from.
 */
const LQ_SWAP_SCRIPT = `(() => {
  if (!document.getElementById("panel-liq-map") || !window.fetch || !window.DOMParser || !history.pushState) return;
  let shown = location.href.split("#")[0];
  let busy = false;
  ${CHART_SKELETON_JS}
  const panelOf = (id) => document.getElementById("panel-liq-" + id);
  const panelUrl = (base, id) => base + (base.indexOf("?") >= 0 ? "&" : "?") + "panel=" + id;
  const readable = (search) => search.replace(/%2C/g, ",");

  const light = (link, on) => {
    link.classList.toggle("on", on);
    if (on) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
  };
  // The clicked choice answers at once, before the tab does. A venue toggles within a set; every
  // other strip picks one.
  const mark = (link) => {
    const nav = link.closest("nav");
    if (!nav) return;
    const links = Array.prototype.slice.call(nav.querySelectorAll("a[data-lq-swap]"));
    if (link.dataset.lqVenue) {
      const all = links.filter((a) => a.dataset.lqVenue === "all")[0];
      if (link === all) links.forEach((a) => light(a, a === all));
      else {
        light(link, !link.classList.contains("on"));
        if (all) light(all, !links.some((a) => a !== all && a.classList.contains("on")));
      }
    } else links.forEach((a) => light(a, a === link));
  };

  const follow = (base, labels) => {
    const here = new URL(base, location.href);
    for (const a of document.querySelectorAll(".lq-controls nav.tf a")) {
      if (a.closest("[data-tab-panel]")) continue;
      // The window strip: this address with that link's window, first, as the server orders it.
      const win = new URL(a.href).searchParams.get("window");
      const rest = new URLSearchParams(here.search);
      rest.delete("window");
      const query = new URLSearchParams();
      if (win) query.set("window", win);
      rest.forEach((value, key) => query.append(key, value));
      const text = query.toString();
      a.setAttribute("href", here.pathname + (text ? "?" + readable(text) : ""));
    }
    for (const a of document.querySelectorAll("a[data-lang]")) {
      a.href = a.pathname + "?back=" + encodeURIComponent(location.pathname + location.search);
    }
    // The summary speaks for the address it was rendered for, not one a tab swapped to in place.
    const brief = document.querySelector("[data-lq-brief]");
    if (brief) brief.hidden = brief.getAttribute("data-lq-brief") !== here.pathname;
    for (const id in labels) {
      const label = document.querySelector('[data-tab="' + id + '"] .tab-label--full, [data-tab="' + id + '"] .tab-label');
      if (label) label.textContent = labels[id];
    }
    for (const panel of document.querySelectorAll("[data-tab-panel]")) {
      panel.setAttribute("data-lazy", panelUrl(base, panel.getAttribute("data-tab-panel")));
      if (panel.dataset.lazyState === "loaded" || (!panel.dataset.lazyState && !panel.querySelector(".lazy-wait"))) {
        panel.dataset.lazyState = "stale";
      }
    }
  };

  const load = async (tab, href, push) => {
    const panel = panelOf(tab);
    if (!panel) { location.href = href; return; }
    busy = true;
    const base = href.split("#")[0];
    for (const chart of panel.querySelectorAll(".lqc-body, .heat-wrap")) skeletonInto(chart);
    panel.classList.add("chart-switching");
    panel.setAttribute("aria-busy", "true");
    try {
      const headers = panel.hasAttribute("data-member-tab") && window.airratesPanelHeaders ? await window.airratesPanelHeaders() : {};
      const res = await fetch(panelUrl(base, tab), { credentials: "same-origin", headers });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const body = new DOMParser().parseFromString(await res.text(), "text/html").querySelector(".lazy-body");
      if (!body) throw new Error("no panel");
      if (push) history.pushState(null, "", href);
      shown = base;
      follow(base, JSON.parse(body.getAttribute("data-labels") || "{}"));
      panel.replaceChildren(document.importNode(body, true));
      panel.dataset.lazyState = "loaded";
      panel.dataset.loadedAt = String(Date.now());
      if (window.airratesHelp) window.airratesHelp(panel);
    } catch (_) {
      location.href = href;
      return;
    }
    panel.classList.remove("chart-switching");
    panel.removeAttribute("aria-busy");
    busy = false;
  };

  // Delegated, because every strip is replaced with the rest of its tab on every switch.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || !event.target.closest) return;
    const link = event.target.closest("a[data-lq-swap]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // A lit single choice is already showing; a lit venue is a toggle and still acts, unless it is "all".
    if (busy || (link.classList.contains("on") && (!link.dataset.lqVenue || link.dataset.lqVenue === "all"))) return;
    mark(link);
    load(link.dataset.lqSwap, link.href, true);
  });
  addEventListener("popstate", () => {
    if (location.pathname.indexOf("/liquidations") !== 0) { location.reload(); return; }
    if (busy || location.href.split("#")[0] === shown) return;
    const tab = location.hash.slice(1);
    load(panelOf(tab) ? tab : "map", location.href, false);
  });
})();`;

function legend(): string {
  const bounds = ["&lt;$1k", "$1k–10k", "$10k–100k", "$100k–1M", "$1M–5M", "≥$5M"];
  const swatches = bounds
    .map(
      (label, i) =>
        `<span class="lq-key"><i class="lq-l${i + 1}"></i><i class="lq-s${i + 1}"></i>${label}</span>`,
    )
    .join("");
  return `<div class="lq-legend"><span class="lq-legend-title">${tr("Cell")}</span>${swatches}
<span class="lq-key lq-hue"><i class="lq-l5"></i>${tr("longs closed")}</span>
<span class="lq-key lq-hue"><i class="lq-s5"></i>${tr("shorts closed")}</span></div>`;
}

function mapPanel(data: {
  map: LiquidationMap;
  params: LiquidationParams;
  /** The control state, so the venue strip keeps the window and the address. */
  strip: {
    addressed: string | null;
    assetClass: AssetClass | null;
    params: LiquidationParams;
    assetParams: LiquidationAssetParams;
  };
  now: number;
}): string {
  const { map, params, strip, now } = data;
  const { bucketHours } = LIQUIDATION_WINDOWS[params.window];
  const cols = columns(params, now);

  const feeds = map.totals.map((total) => total.venue_id);
  const picked = pickedFeeds(params, feeds);
  const counted = (venueId: string) => picked.length === 0 || picked.includes(venueId);

  // One grid, summed over the selected venues -- every feed when none is selected. The cells are
  // already per venue, per asset, per bucket, so the sum is one pass over them here rather than a
  // second query, and one arithmetic for every selection.
  //
  // Indexed once: the grid reads every (asset, bucket) and a scan per cell would be quadratic. The
  // key separator is NUL, written as the escape \0 and never as a raw byte: an asset can be named
  // almost anything a venue lists, so the separator has to be a character that cannot appear in one
  // -- but a raw U+0000 in a source file makes `file` call it binary and grep return nothing for any
  // pattern in it, which is why the same separator was rewritten this way in
  // packages/core/src/ranking-eval.ts.
  type Tally = { usd: number; events: number; long: number; short: number };
  const add = (
    into: Map<string, Tally>,
    key: string,
    row: { notional_usd: number; events: number; long_usd: number; short_usd: number },
  ) => {
    const held = into.get(key) ?? { usd: 0, events: 0, long: 0, short: 0 };
    held.usd += row.notional_usd;
    held.events += row.events;
    held.long += row.long_usd;
    held.short += row.short_usd;
    into.set(key, held);
  };
  const byCell = new Map<string, Tally>();
  for (const cell of map.cells) {
    if (counted(cell.venue_id)) {
      add(byCell, `${cell.asset}\0${cell.asset_class}\0${cell.bucket_start.getTime()}`, cell);
    }
  }
  const byColumnTotal = new Map<string, Tally>();
  for (const total of map.columnTotals) {
    if (counted(total.venue_id)) add(byColumnTotal, String(total.bucket_start.getTime()), total);
  }
  // Markets are summed rather than counted distinctly: a market is one venue's own listing, so the
  // same asset on two venues is two markets.
  const totals = map.totals
    .filter((total) => counted(total.venue_id))
    .reduce(
      (sum, total) => ({
        notional_usd: sum.notional_usd + total.notional_usd,
        events: sum.events + total.events,
        markets: sum.markets + total.markets,
      }),
      { notional_usd: 0, events: 0, markets: 0 },
    );

  const head = cols
    .map(
      (column) =>
        `<th class="num${column.partial ? " lq-now" : ""}" scope="col"${
          column.partial ? ` title="${tr("This column is still filling")}"` : ""
        }>${columnLabel(column, bucketHours)}</th>`,
    )
    .join("");

  const cellAt = (asset: { asset: string; asset_class: AssetClass }, column: Column) =>
    byCell.get(`${asset.asset}\0${asset.asset_class}\0${column.start.getTime()}`);

  const rows = map.assets
    .map((asset) => {
      const key = assetKey(asset.asset, asset.asset_class);
      const cells = cols
        .map((column) => {
          const cell = cellAt(asset, column);
          if (!cell) return `<td class="num none" data-c="${column.start.getTime()}">·</td>`;
          return `<td class="num ${cellClass(cell.usd, cell.long, cell.short)}" data-c="${column.start.getTime()}" title="${esc(
            cellTitle(cell),
          )}"><span data-u="usd">${money(cell.usd)}</span><span class="lq-n">${cell.events.toLocaleString(
            "en-US",
          )}</span></td>`;
        })
        .join("");
      // The row links to the asset's OWN grid, where the axis becomes the price a position died at
      // -- the one view this page cannot show, because a price band means nothing across twelve
      // different assets.
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
      const total = byColumnTotal.get(String(column.start.getTime()));
      if (!total) return `<td class="num none">·</td>`;
      let shown = 0;
      for (const asset of map.assets) shown += cellAt(asset, column)?.usd ?? 0;
      const rest = total.usd - shown;
      // Floating point, not a data problem: a sum of doubles that should be zero often is not.
      return rest > 1 ? `<td class="num dim">${money(rest)}</td>` : `<td class="num none">·</td>`;
    })
    .join("");

  const totalRow = cols
    .map((column) => {
      const total = byColumnTotal.get(String(column.start.getTime()));
      if (!total) return `<td class="num none">·</td>`;
      return `<td class="num"><span data-u="total">${money(total.usd)}</span><span class="lq-n">${total.events.toLocaleString(
        "en-US",
      )}</span></td>`;
    })
    .join("");

  const heading =
    totals.events > 0
      ? tr("<b>{usd}</b> · {events} liquidations · {markets} markets", {
          usd: money(totals.notional_usd),
          events: totals.events.toLocaleString("en-US"),
          markets: totals.markets.toLocaleString("en-US"),
        })
      : tr("no liquidations in this window");

  // No heading naming the venues: the strip above already shows which ones are added up. The live
  // keys stay "all" whatever the selection, since a refresh re-reads the same address.
  const body =
    feeds.length === 0
      ? `<p class="empty">${tr(
          "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.",
          { window: esc(params.window) },
        )}</p>`
      : `<div class="lq-grid"><section class="lq-panel">
<p class="lq-sum" data-live="lq-sum-${LIQUIDATION_VENUE_ALL}">${heading}</p>
<div class="heat-wrap"><table class="heat lq">
<thead><tr><th class="asset" scope="col">${tr("Asset")}</th>${head}</tr></thead>
<tbody data-live="lq-${LIQUIDATION_VENUE_ALL}">${rows}
<tr class="lq-other"><th class="asset" scope="row">${tr("other markets")}</th>${other}</tr>
<tr class="lq-total"><th class="asset" scope="row">${tr("total")}</th>${totalRow}</tr></tbody>
</table></div>
</section></div>`;

  return `${venueStrip(strip, feeds)}
${body}`;
}

/**
 * The line under the whole page: how fresh the feed is, and the JSON behind the map. It used to sit
 * between the venue strip and the grid, where it pushed the grid down on every tab.
 */
function mapFootnote(data: {
  map: LiquidationMap;
  params: LiquidationParams;
  now: number;
}): string {
  const { map, params, now } = data;
  const { bucketHours } = LIQUIDATION_WINDOWS[params.window];
  const query = liquidationsToQuery(params);

  // The newest forced close itself, from the per-venue totals. This used to be the newest CELL's
  // bucket_start, i.e. the start of the last 2-hour column, so it read "1h 11m ago" while a feed had
  // closed something 16 seconds earlier.
  const newest = map.totals.reduce<Date | null>(
    (latest, total) =>
      total.last_at && (latest === null || total.last_at > latest) ? total.last_at : latest,
    null,
  );

  // The explanation sits behind the badge; the line beside it keeps only what refreshes (help.ts).
  return `<p class="notes lq-note">${helpButton("liq-map")} <span data-live="lq-asof">${newest ? tr("Newest liquidation {age}.", { age: esc(ageText(newest, now)) }) : ""}</span> <a href="/v1/liquidations${esc(query)}">JSON</a></p>
${helpPanel(
  "liq-map",
  `<p>${tr(
    "Columns are {hours}-hour buckets in {zone}, newest on the right; the last one is still filling.",
    { hours: bucketHours, zone: zoneTag() },
  )}</p><p>${tr(
    "Rows are the {count} busiest assets by notional across every feed, and the rest are summed into “other markets”, so the totals below the grid are real totals and add up.",
    { count: map.assets.length },
  )} ${tr("Any row opens that asset at the price it died at.")}</p>`,
)}`;
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
  params: LiquidationAssetParams & { venue: string };
  /** Pre-rendered by the caller, the only place that knows the whole address and query. */
  bandStrip: string;
  picker: string;
  now: number;
}): string {
  const { asset, map, params, bandStrip, picker, now } = data;
  const { bucketHours } = LIQUIDATION_WINDOWS[params.window];
  const cols = columns({ window: params.window, assets: 0, venue: LIQUIDATION_VENUE_ALL }, now);
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
          `<th class="num${column.partial ? " lq-now" : ""}" scope="col"${columnTitle(
            column,
            bucketHours,
          )}>${columnLabel(column, bucketHours)}</th>`,
      )
      .join("");

    const rows = bands
      .map((band) => {
        const cells = cols
          .map((column) => {
            const cell = byCell.get(`${venueId} ${band} ${column.start.getTime()}`);
            if (!cell) return `<td class="num none">·</td>`;
            const title = cellTitle(cell);
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
      ? tr("<b>{usd}</b> · {events} liquidations · {long} long / {short} short", {
          usd: money(totals.notional_usd),
          events: totals.events.toLocaleString("en-US"),
          long: money(totals.long_usd),
          short: money(totals.short_usd),
        })
      : tr("nothing force-closed here in this window");

    return `<section class="lq-panel">
<h2 class="lq-venue"><a href="/markets/${esc(venueId)}">${esc(venueName(venueId))}</a></h2>
<p class="lq-sum">${heading}</p>
<div class="heat-wrap"><table class="heat lq lq-asset">
<thead><tr><th class="asset" scope="col">${tr("Fill price")}</th>${head}</tr></thead>
<tbody data-live="lqa-${esc(venueId)}">${rows}</tbody>
</table></div>
</section>`;
  };

  // The priced grid cannot sum venues -- comparing where each book broke is the tab's whole question
  // -- so it draws a panel per venue: the ones selected on the map tab's strip, or every one when none
  // is, which is what makes the strip mean the same thing on this tab.
  const all = map.totals.map((total) => total.venue_id);
  const picked = pickedFeeds(params, all);
  const venues = picked.length > 0 ? picked : all;
  const body =
    mark === null
      ? `<p class="empty">${tr(
          "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.",
          { asset: label },
        )}</p>`
      : venues.length === 0
        ? `<p class="empty">${tr(
            "No liquidations recorded for {asset} in the last {window}. Only the venues publishing a feed the collector reads appear here.",
            { asset: label, window: esc(params.window) },
          )}</p>`
        : `<div class="lq-grid">${venues.map(panel).join("")}</div>`;

  const showing = { asset: label, pct: bandPct };
  const explained = `<p>${
    map.band_fitted
      ? tr(
          "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark, fitted to where this asset's closes actually landed; the outer rows hold everything further out.",
          showing,
        )
      : tr(
          "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark; the outer rows hold everything further out.",
          showing,
        )
  } ${
    mark === null
      ? ""
      : tr(
          "Banded from <b>{mark}</b>, the deepest market's mark — the same anchor the arbitrage guard uses, so both venues share rows.",
          { mark: formatPrice(mark) },
        )
  }</p>`;
  return `<div class="lq-controls">${picker}<nav class="tf" aria-label="${tr("Band width")}">${bandStrip}</nav>${helpButton("liq-price")}</div>
${helpPanel("liq-price", `${explained}${columnsHelp(bucketHours, false)}`)}
${body}`;
}

/**
 * The asset picker the per-asset tabs carry: picker.ts's dropdown (as on the whales, CVD and option
 * tabs), listing EVERY asset force-closed in the window, grouped by sector (sectors.ts: crypto,
 * indexes, chips and memory, biotech and health, metals and mining, other stocks, energy and other
 * commodities, FX) and busiest first within each. The owner asked for it on 2026-10-27 in place of a
 * strip of the dozen busiest, which hid every smaller market behind the map tab.
 *
 * Each row is a plain link, so it works without a script, and carries data-lq-swap, so LQ_SWAP_SCRIPT
 * reloads the tab in place. The fragment keeps the reader on the tab they are reading: without it,
 * following a link from the sides tab would land on the priced one, because the server picks the tab
 * from the address. Filtering, arrow keys and Escape are PICK_SCRIPT's.
 */
function assetPicker(
  state: {
    addressed: string | null;
    assetClass: AssetClass | null;
    params: LiquidationParams;
    assetParams: LiquidationAssetParams;
  },
  every: readonly LiquidationAssetSummary[],
  current: string | null,
  hash: string,
): string {
  if (every.length === 0) return "";
  const swap = esc(hash.slice(1));
  const row = (entry: LiquidationAssetSummary, group: string) => {
    const href = esc(
      controlHref(state, { asset: { name: entry.asset, assetClass: entry.asset_class } }, hash),
    );
    const on =
      entry.asset === current &&
      (state.assetClass === null || state.assetClass === entry.asset_class);
    const sides = entry.long_usd + entry.short_usd;
    const longShare = sides > 0 ? (entry.long_usd / sides) * 100 : 50;
    // Found by its ticker, its class and its group in English and in the page's language, each once.
    const words = [
      ...new Set([entry.asset, entry.asset_class, group, trMsg(group)].map((w) => w.toLowerCase())),
    ].join(" ");
    return `<a class="wh-pick-row${on ? " on" : ""}" href="${href}" data-lq-swap="${swap}" data-q="${esc(words)}"${on ? ' aria-current="page"' : ""}>
<span class="wh-pick-sym"><b>${assetName(entry.asset, entry.asset_class)}</b></span>
<span class="num" data-u="usd">${money(entry.notional_usd)}</span>
<span class="wh-pick-book"><span class="wh-pick-bar" title="${esc(tr("{long} long · {short} short", { long: money(entry.long_usd), short: money(entry.short_usd) }))}"><i class="wh-pick-bid" style="width:${longShare.toFixed(1)}%"></i><i class="wh-pick-ask" style="width:${(100 - longShare).toFixed(1)}%"></i></span></span>
<span class="num">${entry.events.toLocaleString("en-US")}</span>
<span class="num dim">${entry.venues}</span>
</a>`;
  };
  const groups = ASSET_GROUPS.map(([group, label]) => {
    const list = every.filter((entry) => assetGroup(entry.asset, entry.asset_class) === group);
    if (list.length === 0) return "";
    return `<p class="wh-pick-group">${trMsg(label)} <span class="dim">${list.length}</span></p>${list
      .map((entry) => row(entry, label))
      .join("")}`;
  }).join("");
  const shown = every.find((entry) => entry.asset === current);
  const summary = shown
    ? `<b>${assetName(shown.asset, shown.asset_class)}</b><span class="num" data-u="usd">${money(shown.notional_usd)}</span>`
    : current === null
      ? `<b>${tr("All assets")}</b>`
      : `<b>${esc(current)}</b>`;
  return `<details class="wh-pick lq-pick">
<summary class="wh-pick-btn" aria-label="${esc(tr("Pick an asset"))}">${summary}<span class="wh-pick-more dim">${tr("{n} assets", { n: every.length })}</span></summary>
<div class="wh-pick-panel">
<input class="wh-pick-q" type="search" placeholder="${esc(tr("Filter assets"))}" aria-label="${esc(tr("Filter assets"))}" autocomplete="off" hidden>
<div class="wh-pick-head" aria-hidden="true"><span>${tr("Asset")}</span><span class="num">${tr("Liquidated")}</span><span>${tr("Longs / shorts")}</span><span class="num">${tr("Events")}</span><span class="num">${tr("Venues")}</span></div>
<nav class="wh-pick-list" aria-label="${esc(tr("Asset"))}">${groups}</nav>
<p class="wh-pick-none dim" hidden>${tr("No asset matches.")}</p>
</div>
</details>`;
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
 * The modeled pending side panel: shorts at risk above the price, longs below, ten rows a side.
 *
 * TWO ZOOMS, both prepared by the collector. Near is ±10% in 1% rows, where the high-leverage money
 * sits. Zoomed out is ±50% in 5% rows both ways: the 2-5x positions only
 * appear there, and it answers "what would a crash or a squeeze take out", which ±10% cannot.
 *
 * ITS OWN SCALE, NOT THE BARS'. The first design shared one axis so a $3M row was as long as a $3M
 * flush was tall. Honest numbers broke it: a day's worth of pending in one 1% row is tens of times a
 * 15-minute flush, so sharing the axis flattened every realized bar to a sliver. The widest row
 * fills the strip instead, and the legend and the readout carry the dollars.
 *
 * Rows are divs, not SVG, so the hatching is not stretched by the chart's non-uniform scaling. On a
 * phone the strip drops under the bars at full width with the same rows rather than shrinking
 * beside them: at 360px it would leave the history under 100px, a sliver. Nothing is removed.
 *
 * Each row carries its reading in data-read; slot-chart.ts puts it in the header line on hover or tap.
 */
function pendingModel(map: LiquidationAssetMap): {
  longs: number[];
  shorts: number[];
  longTotal: number;
  shortTotal: number;
} | null {
  const pending = map.pending;
  if (map.mark === null || pending === null) return null;
  if (pending.longs.length !== PENDING_ROWS || pending.shorts.length !== PENDING_ROWS) return null;
  const sum = (rows: number[]) => rows.reduce((total, usd) => total + usd, 0);
  const model = {
    longs: pending.longs,
    shorts: pending.shorts,
    longTotal: sum(pending.longs),
    shortTotal: sum(pending.shorts),
  };
  return model.longTotal + model.shortTotal > 0 ? model : null;
}

function pendingPanel(
  map: LiquidationAssetMap,
  model: NonNullable<ReturnType<typeof pendingModel>>,
  zoom: PendingZoom,
): { keys: string; html: string } {
  const mark = map.mark as number;
  const steps = PENDING_ZOOMS[zoom];
  const top = Math.max(...model.longs, ...model.shorts);
  const row = (side: "long" | "short", usd: number, index: number): string => {
    const step = side === "long" ? steps.below : steps.above;
    const near = (index * step) / 100;
    const far = ((index + 1) * step) / 100;
    const lo = formatPrice(mark * (side === "long" ? 1 - far : 1 + near));
    const hi = formatPrice(mark * (side === "long" ? 1 - near : 1 + far));
    const values = {
      pct: `${index * step}–${(index + 1) * step}%`,
      range: `${lo}–${hi}`,
      usd: money(usd),
    };
    const read =
      side === "long"
        ? tr(
            "Longs at risk, modeled · price falls <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated",
            values,
          )
        : tr(
            "Shorts at risk, modeled · price rises <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated",
            values,
          );
    return `<div class="lqp-row" data-read="${esc(read)}"><i class="lqp-${side}" style="width:${((usd / top) * 100).toFixed(1)}%"></i></div>`;
  };
  const rows = [
    ...model.shorts.map((usd, i) => row("short", usd, i)).reverse(),
    ...model.longs.map((usd, i) => row("long", usd, i)),
  ].join("");
  // The money axis along the bottom: a row's length is its dollars against the widest row, so the
  // widest row's figure sits at the right edge and half of it in the middle. Zero is the strip's own
  // left edge, which is also "now", so it carries no label of its own.
  const axis = (fraction: number) => formatUsd(top * fraction).replace(".0", "");
  const xAxis = `<div class="lqp-x" aria-hidden="true"><span style="left:50%">${axis(0.5)}</span><span style="left:100%">${axis(1)}</span></div>`;
  // A label every second row, centred on it and naming its outer edge: +2% sits on the row 1-2%
  // above, as in the design; zoomed out, +20% on the row 10-20% above and −10% on 5-10% below.
  const ticks: string[] = [];
  for (let k = 2; k <= PENDING_ROWS; k += 2) {
    const offset = ((k - 0.5) / PENDING_ROWS) * 50;
    ticks.push(
      `<span class="lqp-y" style="top:${(50 - offset).toFixed(1)}%">+${k * steps.above}%</span><span class="lqp-y" style="top:${(50 + offset).toFixed(1)}%">−${k * steps.below}%</span>`,
    );
  }
  return {
    keys: `<span><i class="lqp-key-short"></i>${tr("Shorts at risk above")} <b>≈${money(model.shortTotal)}</b></span><span><i class="lqp-key-long"></i>${tr("Longs at risk below")} <b>≈${money(model.longTotal)}</b></span>`,
    html: `<div class="lqp" role="img" aria-label="${esc(
      tr(
        "Modeled pending liquidations between {low} and {high}, around {mark}: about {shorts} of shorts above and {longs} of longs below",
        {
          low: formatPrice(mark * (1 - (steps.below * PENDING_ROWS) / 100)),
          high: formatPrice(mark * (1 + (steps.above * PENDING_ROWS) / 100)),
          mark: formatPrice(mark),
          shorts: money(model.shortTotal),
          longs: money(model.longTotal),
        },
      ),
    )}"><span class="lqp-now">${tr("now")}</span><div class="lqp-rows">${rows}<span class="lqp-mark"><b>${formatPrice(mark)}</b></span>${ticks.join("")}<span class="lqp-cap lqp-cap-s">${tr("shorts liquidate if price rises")}</span><span class="lqp-cap lqp-cap-l">${tr("longs liquidate if price falls")}</span>${xAxis}</div></div>`,
  };
}

/**
 * Longs and shorts on one axis over the window: longs closed rise above zero, shorts closed fall
 * below it, one bar per `sideMinutes`.
 *
 * WHY A CHART ABOVE THE GRIDS. The grids say at which PRICE each side died, in two-hour columns.
 * What they cannot show is the shape in time -- whether a $30M flush was one quarter hour or a slow
 * bleed, and whether the shorts got squeezed straight after. Mirroring the two sides around one
 * zero line makes that the first thing a reader sees, and the bars are finer than the grid's
 * columns because a bar carries no text.
 *
 * LINEAR, NOT LOG, unlike the grid's intensity: here the height IS the comparison, and a log axis
 * would make a $30M bar look like three times a $30k one.
 *
 * BUT LINEAR IN TWO PIECES when a few bars tower over the rest (owner, 2026-11-10). One flush set
 * the whole axis: on the live 24h chart a $22M bar put nine bars in ten under 3% of the height, a
 * row of flat lines. So the axis runs linear up to where nine bars in ten end (`sidesScale`), and
 * that takes nine tenths of each side; the bars above it share the last tenth on their own, squeezed
 * scale. The labels say where it changes, a gap cuts every bar that crosses it, and the title says
 * the axis is squeezed. A window without such a tower keeps the one straight scale.
 *
 * THE AXIS SPANS THE WHOLE WINDOW, empty buckets included, for the same reason `columns` does: a
 * quiet stretch is a fact, and dropping it would put two distant flushes side by side.
 *
 * Server-rendered SVG. The header line reads the whole window without a script; hovering or tapping
 * a slot reads that slot there instead, through slot-chart.ts, which says why that replaced a native
 * <title> per bar.
 */
/** The share of bars drawn on the full scale, and the share of each side's height they get. */
const SIDES_KNEE_SHARE = 0.9;
const SIDES_KNEE_HEIGHT = 0.9;
/** Fewer bars than this and "nine in ten" is one or two bars: keep the straight scale. */
const SIDES_KNEE_MIN_BARS = 10;
/** Round steps for the knee, so its label and the one at half of it read as round money. */
const SIDES_KNEE_STEPS = [1, 2, 3, 4, 5, 6, 8, 10];

/**
 * The axis of the longs vs shorts chart: `top` is the tallest bar, and `knee` the round amount
 * nine bars in ten stay under, or null when the axis needs no break -- too few bars, or the tallest
 * not even twice the knee, where squeezing would distort more than it shows.
 *
 * Both sides pooled into one ranking, because they share one scale: a long bar and a short bar of
 * equal height must stay equal money. Only bars that exist count; an empty slot is not a short bar.
 */
export function sidesScale(values: readonly number[]): { top: number; knee: number | null } {
  const bars = values.filter((usd) => usd > 0).sort((a, b) => a - b);
  const peak = bars.at(-1) ?? 0;
  const top = peak > 0 ? peak : 1_000;
  if (bars.length < SIDES_KNEE_MIN_BARS) return { top, knee: null };
  // Nearest rank: the bar at or above which the tallest tenth starts.
  const p90 = bars[Math.ceil(SIDES_KNEE_SHARE * bars.length) - 1] ?? peak;
  const power = 10 ** Math.floor(Math.log10(p90));
  const step = SIDES_KNEE_STEPS.find((n) => n * power >= p90) ?? 10;
  const knee = step * power;
  return { top, knee: knee * 2 <= top ? knee : null };
}

function sidesChart(data: {
  label: string;
  points: LiquidationAssetMap["sides"];
  params: LiquidationParams;
  now: number;
  /** The pending panel and its toggle, or null when the asset has no price or no open interest. */
  pending: { show: boolean; zoom: PendingZoom; strip: string; map: LiquidationAssetMap } | null;
  /**
   * The span and bar width, when not the page window's: the member History tab draws days over 30 or
   * 90 of them. `label` is how the span is named ("30d").
   */
  frame?: { hours: number; minutes: number; label: string };
}): string {
  const { label, points, params, now, pending } = data;
  const model = pending?.show ? pendingModel(pending.map) : null;
  const frame = data.frame ?? {
    hours: LIQUIDATION_WINDOWS[params.window].hours,
    minutes: LIQUIDATION_WINDOWS[params.window].sideMinutes,
    label: params.window,
  };
  const { hours } = frame;
  const sideMinutes = frame.minutes;
  const bucketMs = sideMinutes * 60_000;
  const current = Math.floor(now / bucketMs) * bucketMs;
  const count = Math.round((hours * 60) / sideMinutes);
  const fromMs = current - (count - 1) * bucketMs;
  const toMs = current + bucketMs;
  const span = toMs - fromMs;

  const byBucket = new Map(points.map((point) => [point.bucket_start.getTime(), point]));
  // The axis ends at the tallest bar, not at a round number above it: rounding up wasted up to half
  // the plot (a $5.1M peak got a $10M axis) and flattened every other bar.
  const { top, knee } = sidesScale(points.flatMap((point) => [point.long_usd, point.short_usd]));
  const pend = pending && model ? pendingPanel(pending.map, model, pending.zoom) : null;

  // viewBox 1000 x 1000 with zero at 500: each side gets half the height and the same scale, so a
  // long bar and a short bar of equal height are equal money.
  const slot = 1000 / count;
  const barWidth = Math.max(slot * 0.72, 1);
  const kneeAt = SIDES_KNEE_HEIGHT * 500;
  const height = (usd: number) => {
    const abs = Math.abs(usd);
    const h =
      knee === null
        ? (abs / top) * 500
        : abs <= knee
          ? (abs / knee) * kneeAt
          : kneeAt + ((abs - knee) / (top - knee)) * (500 - kneeAt);
    return usd < 0 ? -h : h;
  };
  // The gap that cuts a bar where the scale changes, in viewBox units (about 2px on a 260px plot).
  const cut = 8;
  // One side's bar, from zero outwards; `up` for longs. A bar past the knee is two pieces with the
  // cut between them, so the squeezed part never reads as the same scale as the rest.
  const sideBar = (cls: string, x: string, usd: number, up: boolean): string => {
    const h = height(usd);
    const rect = (from: number, to: number) => {
      const y = up ? 500 - to : 500 + from;
      return `<rect class="${cls}" x="${x}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${(to - from).toFixed(2)}"></rect>`;
    };
    if (knee === null || usd <= knee) return rect(0, h);
    // A bar a hair over the knee still shows its cut, with a sliver above it (about 1px).
    return rect(0, kneeAt - cut / 2) + rect(kneeAt + cut / 2, Math.max(h, kneeAt + cut / 2 + 4));
  };

  const bars: string[] = [];
  const slots: SidesSlots["slots"] = [];
  for (let i = 0; i < count; i++) {
    const start = fromMs + i * bucketMs;
    const point = byBucket.get(start);
    slots.push(
      point ? [Math.round(point.long_usd), Math.round(point.short_usd), point.events] : null,
    );
    if (!point) continue;
    const x = (i * slot + (slot - barWidth) / 2).toFixed(2);
    const partial = start === current ? " lqc-now" : "";
    bars.push(
      `<g class="lqc-bar${partial}">${
        point.long_usd > 0 ? sideBar("lqc-long", x, point.long_usd, true) : ""
      }${point.short_usd > 0 ? sideBar("lqc-short", x, point.short_usd, false) : ""}</g>`,
    );
  }

  // A broken axis labels both pieces: half the knee and the knee on the straight part, the tallest
  // bar at the end of the squeezed one.
  const levels =
    knee === null
      ? [top, top / 2, 0, -top / 2, -top]
      : [top, knee, knee / 2, 0, -knee / 2, -knee, -top];
  const levelClass = (usd: number) =>
    usd === 0 ? " lqc-zero" : knee !== null && Math.abs(usd) === knee ? " lqc-knee" : "";
  const grid = levels
    .map((usd) => {
      const y = (500 - height(usd)).toFixed(1);
      return `<line class="lqc-grid${levelClass(usd)}" x1="0" x2="1000" y1="${y}" y2="${y}"></line>`;
    })
    .join("");
  // The ends sit just outside the plot when the axis is broken, so the tallest bar's label clears
  // the knee's, a tenth of a side away.
  const yLabels = levels
    .map((usd) => {
      const end =
        knee !== null && Math.abs(usd) === top ? (usd > 0 ? " lqc-y-top" : " lqc-y-bottom") : "";
      return `<span class="lqc-y${levelClass(usd)}${end}" style="top:${((500 - height(usd)) / 10).toFixed(2)}%">${usd === 0 ? "0" : formatUsd(usd).replace(".0", "")}</span>`;
    })
    .join("");

  // Ticks on round UTC hours: every 4h over a day, 8h over two, midnight over a week, and every
  // seventh midnight over a month or more.
  const tickHours = hours <= 24 ? 4 : hours <= 48 ? 8 : hours <= 168 ? 24 : 24 * 7;
  const tickMs = tickHours * 3_600_000;
  const xLabels: string[] = [];
  for (let ms = Math.ceil(fromMs / tickMs) * tickMs; ms < toMs; ms += tickMs) {
    const hour = new Date(ms).getUTCHours();
    // In the reader's zone once the page script has run (localtime.ts); UTC until then.
    const text = timeTag(ms, "tick", tickHours);
    // Alternate labels drop on a phone, as on the CVD chart, where they otherwise run together.
    xLabels.push(
      `<span class="lqc-x${hour === 0 ? " lqc-day" : ""}${xLabels.length % 2 ? " x-alt" : ""}" style="left:${(((ms - fromMs) / span) * 100).toFixed(2)}%">${text}</span>`,
    );
  }

  const longSum = points.reduce((sum, point) => sum + point.long_usd, 0);
  const shortSum = points.reduce((sum, point) => sum + point.short_usd, 0);
  const events = points.reduce((sum, point) => sum + point.events, 0);
  // Before a hover the readout is the whole window, in the words a slot is read in.
  const idle = sidesText(
    tr("Last {window}", { window: esc(frame.label) }),
    [longSum, shortSum, events],
    SLOT_FORMAT,
    false,
  ).concat(pend ? ` · ${tr("pending is modeled")}` : "");
  const summary = {
    asset: plainLabel(label),
    window: frame.label,
    long: money(longSum),
    short: money(shortSum),
    events: events.toLocaleString("en-US"),
  };
  const cite = citeMark(
    longSum >= shortSum
      ? tr(
          "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Longs took the beating.",
          summary,
        )
      : tr(
          "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Shorts took the beating.",
          summary,
        ),
  );
  const chartTitle =
    sideMinutes >= 1440
      ? tr("{asset} longs vs shorts by day · UTC days", { asset: label })
      : sideMinutes >= 60
        ? tr("{asset} longs vs shorts over time · {hours}-hour bars, {zone}", {
            asset: label,
            hours: sideMinutes / 60,
            zone: zoneTag(),
          })
        : tr("{asset} longs vs shorts over time · {minutes}-minute bars, {zone}", {
            asset: label,
            minutes: sideMinutes,
            zone: zoneTag(),
          });

  return `<figure class="fchart lqc" data-live="lq-side-chart">${cite}
<div class="fchart-head"><p class="fchart-title">${chartTitle}${knee !== null ? ` · ${tr("axis squeezed above {usd}", { usd: formatUsd(knee).replace(".0", "") })}` : ""}${pend ? ` · ${tr("pending by price band")}` : ""}</p><div class="fchart-keys"><span><i class="lqc-key-long"></i>${tr("Longs closed")} <b data-u="lqc-long">${money(longSum)}</b></span><span><i class="lqc-key-short"></i>${tr("Shorts closed")} <b data-u="lqc-short">${money(shortSum)}</b></span>${pend ? pend.keys : ""}</div><p class="fchart-read slot-read" aria-live="polite">${idle} · ${tr("hover or tap a bar to read it")}</p></div>
<div class="lqc-body"><div class="fchart-plot lqc-plot slot-area" tabindex="0" role="group" aria-label="${esc(tr("{asset} bars; arrow keys read one at a time", { asset: label.replace(/<[^>]+>/g, "") }))}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{asset} longs closed above zero and shorts closed below, over the last {window}", { asset: label, window: frame.label }))}">${grid}${SLOT_BAND}${bars.join("")}${SLOT_CURSOR}</svg>${yLabels}${xLabels.join("")}</div>${pend ? pend.html : ""}</div>
${slotData({ kind: "lqc", from: fromMs, unit: bucketMs, slots })}
${pending ? `<div class="lqc-foot">${pending.strip}${pend ? `<p class="lqc-warn">${tr("Modeled from 30 days of open interest and price on each market and its leverage limits, not reported by venues.")}</p>` : ""}</div>` : ""}
</figure>`;
}

/**
 * One asset, longs on the left and shorts on the right, every exchange aggregated.
 *
 * This is the reference layout at its closest: price bands down the side, the two sides as two
 * halves of one table on shared rows, and the hue carried by the half so only intensity varies
 * within it.
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
  /** The Pending on/off and zoom strips, pre-rendered for the same reason. */
  pendingStrip: string;
  showPending: boolean;
  pendingZoom: PendingZoom;
  now: number;
}): string {
  const { asset, map, params, picker, pendingStrip, showPending, pendingZoom, now } = data;
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
  const sides = ["long", "short"] as const;

  // ONE TABLE, ONE PRICE COLUMN. The two sides share their rows -- the same bands from the same
  // anchor -- so they used to be two grids that each repeated the price labels, and at 12 columns a
  // side the pair did not fit beside each other: the shorts grid was drawn over the longs grid's
  // newest columns. As one table the labels are printed once, a row is one price level read across
  // both sides, and a grid wider than the screen scrolls with the price column stuck to the left.
  //
  // The first column of the short half carries `lq-split`, the rule that divides the two halves.
  const head = (side: "long" | "short") =>
    `${cols
      .map(
        (column, i) =>
          `<th class="num${column.partial ? " lq-now" : ""}${
            side === "short" && i === 0 ? " lq-split" : ""
          }" scope="col"${columnTitle(column, bucketHours)}>${columnLabel(column, bucketHours)}</th>`,
      )
      .join("")}<th class="num lq-rowsum" scope="col">${tr("All")}</th>`;

  const sideCells = (side: "long" | "short", band: number): string => {
    let rowTotal = 0;
    const cells = cols
      .map((column, i) => {
        const split = side === "short" && i === 0 ? " lq-split" : "";
        const cell = byCell.get(`${band}\0${column.start.getTime()}`);
        const usd = side === "long" ? (cell?.long ?? 0) : (cell?.short ?? 0);
        if (!cell || usd <= 0) return `<td class="num none${split}">·</td>`;
        rowTotal += usd;
        // The hue is the half, not the cell: within one half every fill means the same side, so
        // intensity alone carries the money and the two halves compare directly.
        const range = {
          usd: money(usd),
          band: bandLabel(mark, bandPct, reach, band).replace("&lt;", "<"),
        };
        return `<td class="num lq-${side === "long" ? "l" : "s"}${step(usd)}${split}" title="${esc(
          side === "long"
            ? tr("{usd} of longs closed between {band}", range)
            : tr("{usd} of shorts closed between {band}", range),
        )}"><span data-u="usd">${money(usd)}</span></td>`;
      })
      .join("");
    return `${cells}<td class="num lq-rowsum">${rowTotal > 0 ? money(rowTotal) : "·"}</td>`;
  };

  const sideTotals = (side: "long" | "short"): string => {
    const cells = cols
      .map((column, i) => {
        const split = side === "short" && i === 0 ? " lq-split" : "";
        let usd = 0;
        for (const band of bandRows(reach)) {
          const cell = byCell.get(`${band}\0${column.start.getTime()}`);
          if (cell) usd += side === "long" ? cell.long : cell.short;
        }
        return usd > 0
          ? `<td class="num${split}"><span data-u="total">${money(usd)}</span></td>`
          : `<td class="num none${split}">·</td>`;
      })
      .join("");
    const sum = side === "long" ? totals.long : totals.short;
    return `${cells}<td class="num lq-rowsum">${sum > 0 ? money(sum) : "·"}</td>`;
  };

  // Each half's heading spans its columns: the side, its money, and its share of both.
  const group = (side: "long" | "short"): string => {
    const sum = side === "long" ? totals.long : totals.short;
    const share = both > 0 ? (sum / both) * 100 : 0;
    const values = { usd: money(sum), share: share.toFixed(0) };
    return `<th class="lq-side lq-side-${side}${side === "short" ? " lq-split" : ""}" scope="colgroup" colspan="${
      cols.length + 1
    }">${
      side === "long"
        ? tr("Longs closed <b>{usd}</b> · {share}%", values)
        : tr("Shorts closed <b>{usd}</b> · {share}%", values)
    }</th>`;
  };

  const rows = bandRows(reach)
    .map((band) => {
      const atMark = band === 0 ? ' class="lq-mark"' : "";
      return `<tr${atMark} data-k="${band}"><th class="asset" scope="row">${bandLabel(
        mark,
        bandPct,
        reach,
        band,
      )}</th>${sides.map((side) => sideCells(side, band)).join("")}</tr>`;
    })
    .join("");

  const table = `<div class="heat-wrap lq-box"><table class="heat lq lq-asset lq-sides">
<thead data-live="lq-sides-head"><tr class="lq-grp"><th class="asset"></th>${sides.map(group).join("")}</tr>
<tr><th class="asset" scope="col">${tr("Fill price")}</th>${sides.map(head).join("")}</tr></thead>
<tbody data-live="lq-sides">${rows}
<tr class="lq-total"><th class="asset" scope="row">${tr("total")}</th>${sides.map(sideTotals).join("")}</tr></tbody>
</table></div>`;

  if (mark === null) {
    return `<p class="empty">${tr(
      "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.",
      { asset: label },
    )}</p>`;
  }
  if (map.totals.length === 0) {
    return `<p class="empty">${tr(
      "Nothing was force-closed in {asset} in the last {window}, on either side.",
      { asset: label, window: esc(params.window) },
    )}</p>`;
  }

  // The chart's own note joins the panel's: the figure refreshes live, so no panel may sit in it.
  return `<div class="lq-controls">${picker}${helpButton("liq-sides")}</div>
${helpPanel(
  "liq-sides",
  `<p>${tr(
    "Showing <b>{asset}</b>, every exchange added together — the split by exchange is one tab along. Rows are the same {pct}% price bands, banded from <b>{mark}</b>. A long close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran against. Any asset outside this list opens from a row on the map tab.",
    { asset: label, pct: bandPct, mark: formatPrice(mark) },
  )}</p><p>${tr("Longs closed above the line, shorts closed below, on the same linear scale. Hover a bar to read it beside the cursor; on a phone, tap and it reads in the line above the chart. The last bar is still filling.")}</p>${columnsHelp(bucketHours, true)}`,
)}
${sidesChart({ label, points: map.sides, params, now, pending: { show: showPending, zoom: pendingZoom, strip: pendingStrip, map } })}
${table}`;
}

/** What each member tab is, for its locked copy: a title and what a member sees in it. */
function memberPitch(id: MemberPanel, asset: string | null): { title: string; text: string } {
  if (id === "odds") {
    return {
      title:
        asset === null
          ? tr("The odds of reaching each price")
          : tr("{asset}: the odds of reaching each price", { asset }),
      text: tr(
        "How far the price can plausibly get in 4 hours, 6 hours, a day and a week: the chance it touches each level, sized from its own measured volatility, beside the levels where positions were liquidated and what each liquidation theory reads.",
      ),
    };
  }
  if (id === "feed") {
    return {
      title: tr("Every cascade, in every asset"),
      text: tr(
        "Every liquidation cascade in every asset, found each minute as it happens, with the price an hour and four hours after. Members can also have them sent to Telegram the moment they start.",
      ),
    };
  }
  if (id === "winners") {
    return {
      title: tr("Top traders, and every order they place"),
      text: tr(
        "Hyperliquid's biggest winners over a day, a week, a month or all time, with what they hold now. Open any of them for their positions and liquidation prices, profit over time, and their recent trades and orders, coin by coin.",
      ),
    };
  }
  if (id === "history") {
    return {
      title:
        asset === null
          ? tr("30- and 90-day history")
          : tr("{asset} over 30 and 90 days", { asset }),
      text: tr(
        "Every day's longs and shorts liquidated over the last 30 or 90 days, each day as a share of the open interest on the same exchanges, and the heaviest days ranked.",
      ),
    };
  }
  return {
    title: tr("Liquidations against open interest"),
    text: tr(
      "Which markets were really flushed rather than just big: every asset's liquidations in the window as a share of its open interest, and the same for crypto, stocks, commodities and indices.",
    ),
  };
}

/**
 * The Odds tab's body: how likely the asset is to reach each price band, from its own closes. A member
 * tab since 2026-11-19, so tabBody reaches it only for a member's own request.
 */
function oddsBody(view: LiquidationView): string | null {
  const { map, asset, params } = view;
  const state = controlState(view);
  if (asset === null) {
    return `<p class="empty">${tr("Nothing has been force-closed in this window, so there is no asset to size.")}</p>`;
  }
  if (view.outlook === undefined || view.assetMap === undefined) return null;
  if (view.assetMap === null) {
    return `<p class="empty">${tr("Nothing has been force-closed in this window, so there is no asset to size.")}</p>`;
  }
  return outlookPanel({
    label: assetName(asset, view.assetMap.asset_class ?? "crypto"),
    outlook: view.outlook,
    window: params.window,
    picker: assetPicker(state, map.every, asset, "#odds"),
  });
}

/**
 * A member tab as everyone but a signed-in member gets it: what is behind it, and the way in. Rendered
 * by the server for every reader and crawler; MEMBER_TAB_SCRIPT swaps the data in for a member.
 */
function memberLock(id: MemberPanel, asset: string | null): string {
  const pitch = memberPitch(id, asset);
  return `<div class="member-lock" data-member-lock>
<p class="eyebrow">${LOCK_ICON} ${tr("For members")}</p>
<p class="member-lock-title">${pitch.title}</p>
<p class="dim">${pitch.text}</p>
<p class="member-lock-ways"><a class="btn" href="${esc(`${MEMBER_URL}member/signup`)}">${tr("Create a free account")}</a> <a href="${esc(`${MEMBER_URL}member/login`)}">${tr("Log in")}</a></p>
<p class="notes member-lock-wait" hidden>${tr("Loading the member view…")}</p>
</div>`;
}

/**
 * The member History tab: one asset's liquidations by UTC day over 30 or 90 days, against the open
 * interest on the exchanges whose feeds reported them.
 *
 * WHY AGAINST OPEN INTEREST. A $50M day means one thing for BTC and another for a stock perp; as a
 * share of the positions open, the days compare across assets and across months. The open interest
 * is the venues' whose liquidation feeds the history reads: a venue with no feed holds positions this
 * page never sees close, and counting them would only shrink the share.
 *
 * EARLY DAYS UNDERCOUNT, which is said, not smoothed: the collector added liquidation feeds over
 * time, so a day from September holds fewer exchanges than one from November. The table shows how
 * many reported each day.
 */
function historyPanel(data: {
  label: string;
  days: readonly LiquidationDay[] | null;
  span: HistorySpan;
  spanStrip: string;
  picker: string;
  params: LiquidationParams;
  now: number;
}): string {
  const { label, days, span, spanStrip, picker, params, now } = data;
  const controls = `<div class="lq-controls">${picker}${spanStrip}</div>`;
  if (days === null) {
    return `${controls}<p class="empty">${tr("The history could not be read right now.")}</p>`;
  }
  if (days.length === 0) {
    return `${controls}<p class="empty">${tr("Nothing was force-closed in {asset} over this span.", { asset: label })}</p>`;
  }
  const points = days.map((day) => ({
    bucket_start: day.day,
    long_usd: day.long_usd,
    short_usd: day.short_usd,
    events: day.events,
  }));
  const chart = sidesChart({
    label,
    points,
    params,
    now,
    pending: null,
    frame: { hours: span * 24, minutes: 1440, label: `${span}d` },
  });
  const total = (day: LiquidationDay) => day.long_usd + day.short_usd;
  const share = (day: LiquidationDay) =>
    day.oi_usd !== null && day.oi_usd > 0 ? total(day) / day.oi_usd : null;
  const sum = days.reduce((acc, day) => acc + total(day), 0);
  const longs = days.reduce((acc, day) => acc + day.long_usd, 0);
  const shares = days.map(share).filter((value): value is number => value !== null);
  const meanShare = shares.length > 0 ? shares.reduce((a, b) => a + b, 0) / shares.length : null;
  const ranked = [...days]
    .sort((a, b) => (share(b) ?? -1) - (share(a) ?? -1) || total(b) - total(a))
    .slice(0, 10);
  const pct = (value: number | null) =>
    value === null ? "–" : `${(value * 100).toFixed(value < 0.001 ? 3 : 2)}%`;
  const first = days[0] as LiquidationDay;
  const feeds = days.map((day) => day.venues);
  const tiles = `<div class="cvd-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Liquidated over {span} days", { span })}</p><p class="cvd-big">${money(sum)}</p><p class="dim">${sideShare(longs, sum - longs)}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("A typical day")}</p><p class="cvd-big">${pct(meanShare)}</p><p class="dim">${tr("of open interest, on average")}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("The heaviest day")}</p><p class="cvd-big">${pct(ranked[0] ? share(ranked[0]) : null)}</p><p class="dim">${ranked[0] ? `${timeTag(ranked[0].day.getTime(), "md")} · ${money(total(ranked[0]))}` : "–"}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Days with data")}</p><p class="cvd-big">${days.length}</p><p class="dim">${tr("from {date}", { date: timeTag(first.day.getTime(), "md") })}</p></div>
</div>`;
  const rows = ranked
    .map(
      (day) =>
        `<tr><td>${timeTag(day.day.getTime(), "md")}</td><td class="num"><b>${money(total(day))}</b></td><td>${sideShare(day.long_usd, day.short_usd)}</td><td class="num">${day.oi_usd === null ? "–" : money(day.oi_usd)}</td><td class="num">${pct(share(day))}</td><td class="num dim">${day.venues}</td></tr>`,
    )
    .join("");
  return `${controls}
${tiles}
${chart}
<h2 class="cvd-h2">${tr("The heaviest days, as a share of open interest")}</h2>
<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>${tr("Day (UTC)")}</th><th class="num">${tr("Liquidated")}</th><th>${tr("Side")}</th><th class="num">${tr("Open interest")}</th><th class="num">${tr("Share")}</th><th class="num" title="${esc(tr("Exchanges that reported a liquidation that day"))}">${tr("Venues")}</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="notes">${tr(
    "Open interest is the day's average on the exchanges whose liquidation feeds reported {asset}, so the share compares like with like.",
    { asset: label },
  )}${
    Math.min(...feeds) < Math.max(...feeds)
      ? ` ${tr("Liquidation feeds were added over time: from {least} to {most} exchanges a day here, so early days undercount.", { least: Math.min(...feeds), most: Math.max(...feeds) })}`
      : ""
  }</p>`;
}

/** The asset classes as the OI tab groups them, in this order; anything else is "other". */
const OI_CLASSES: readonly [string, string][] = [
  ["crypto", msg("Crypto")],
  ["equity", msg("Stocks")],
  ["commodity", msg("Commodities")],
  ["index", msg("Indices")],
];

/**
 * The member OI tab: every asset's liquidations in the window as a share of its open interest now, on
 * the exchanges whose liquidation feeds reported closes in the window.
 *
 * A SHARE, NOT A SIZE, is the point: BTC tops every list of liquidated dollars because it tops every
 * list of open interest. Divided by the positions open, a $3M flush in a $20M stock perp outranks a
 * $300M one in BTC, which is the market that was actually cleared out. Markets under OI_FLOOR of open
 * interest are left out of the ranking: on a few thousand dollars a single close is "50% of OI".
 */
const OI_FLOOR = 1_000_000;
const OI_ROWS = 40;

function oiPanel(data: {
  every: readonly LiquidationAssetSummary[];
  openInterest: readonly AssetOpenInterest[] | null;
  feeds: number;
  window: LiquidationWindow;
  hrefFor: (entry: LiquidationAssetSummary) => string;
}): string {
  const { every, openInterest, feeds, window, hrefFor } = data;
  if (openInterest === null) {
    return `<p class="empty">${tr("The open interest could not be read right now.")}</p>`;
  }
  const oi = new Map(openInterest.map((row) => [`${row.asset}|${row.asset_class}`, row.oi_usd]));
  const rows = every.map((entry) => {
    const open = oi.get(`${entry.asset}|${entry.asset_class}`) ?? null;
    return { entry, open, share: open !== null && open > 0 ? entry.notional_usd / open : null };
  });
  const pct = (value: number | null) =>
    value === null ? "–" : `${(value * 100).toFixed(value < 0.001 ? 3 : 2)}%`;
  const tiles = OI_CLASSES.map(([cls, name]) => {
    const inClass = rows.filter((row) => row.entry.asset_class === cls && row.open !== null);
    if (inClass.length === 0) return "";
    const liq = inClass.reduce((acc, row) => acc + row.entry.notional_usd, 0);
    const open = inClass.reduce((acc, row) => acc + (row.open ?? 0), 0);
    return `<div class="cvd-tile"><p class="eyebrow">${trMsg(name)}</p><p class="cvd-big">${pct(open > 0 ? liq / open : null)}</p><p class="dim">${tr("{liq} of {oi} open", { liq: money(liq), oi: money(open) })}</p></div>`;
  }).join("");
  const ranked = rows
    .filter((row) => row.open !== null && row.open >= OI_FLOOR && row.share !== null)
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
    .slice(0, OI_ROWS);
  const className = (cls: string) => {
    const known = OI_CLASSES.find(([id]) => id === cls);
    return known ? trMsg(known[1]) : esc(cls);
  };
  const table = ranked
    .map(
      ({ entry, open, share }) =>
        `<tr><td><a href="${esc(hrefFor(entry))}">${assetName(entry.asset, entry.asset_class)}</a></td><td class="dim">${className(entry.asset_class)}</td><td class="num"><b>${money(entry.notional_usd)}</b></td><td>${sideShare(entry.long_usd, entry.short_usd)}</td><td class="num">${money(open ?? 0)}</td><td class="num"><b>${pct(share)}</b></td></tr>`,
    )
    .join("");
  return `<div class="cvd-tiles">${tiles}</div>
<h2 class="cvd-h2">${tr("The markets most flushed for their size")}</h2>
${
  ranked.length === 0
    ? `<p class="empty">${tr("No market with $1M of open interest had a liquidation in this window.")}</p>`
    : `<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>${tr("Asset")}</th><th>${tr("Class")}</th><th class="num">${tr("Liquidated")}</th><th>${tr("Side")}</th><th class="num">${tr("Open interest")}</th><th class="num">${tr("Share")}</th></tr></thead>
<tbody>${table}</tbody></table></div>`
}
<p class="notes">${tr(
    "Liquidations over the last {window} against the open interest now, both on the {feeds} exchanges whose liquidation feeds reported closes in that window. Markets under $1M of open interest are left out of the ranking.",
    { window: esc(window), feeds },
  )}</p>`;
}

/**
 * The member tabs, in the browser. Each ships locked (memberLock); on a page with one, this asks the
 * member site for a member pass (scope "member") and, while it has one, loads the shown member tab
 * with it in X-Live-Pass, which index.ts checks before serving the member copy. Signed out -- or the
 * member site not answering -- the tabs stay locked, which is also what a page without JavaScript shows.
 *
 * It also answers tabs.ts and LQ_SWAP_SCRIPT, which reload a tab in place, through
 * window.airratesPanelHeaders: their reload of a member tab carries the pass, so a member is never
 * handed the locked copy back. live.ts's 30 s refresh, which sends no pass, leaves member tabs alone;
 * one holding member data is marked data-member-view="on".
 */
/** The locked copy and the padlock on member tabs; theme variables only (themes.ts). */
const MEMBER_TAB_CSS = `.member-lock{border:1px solid var(--rule);background:var(--panel);padding:16px 18px;margin:12px 0;max-width:72ch}
.member-lock .eyebrow{display:flex;align-items:center;gap:6px}
.member-lock-title{font-weight:600;margin:4px 0 6px}
.member-lock-ways{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:12px}
.tab-lock{display:inline-flex;margin-right:5px;opacity:.7}`;

const MEMBER_TAB_SCRIPT = `(() => {
  const tabs = [...document.querySelectorAll("[data-member-tab]")];
  if (!tabs.length || !window.fetch || !window.DOMParser) return;
  const PASS_URL = "https://member.airrates.net/api/live-pass";
  const RENEW = 120e3;
  let pass = null, asking = null, signedOut = false;
  const getPass = () => {
    if (signedOut) return Promise.resolve(null);
    if (pass && Date.now() < pass.renewAt) return Promise.resolve(pass);
    if (asking) return asking;
    asking = fetch(PASS_URL, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "member", replaces: pass ? pass.token : null }),
    })
      .then((res) => {
        if (res.status === 401) { signedOut = true; return (pass = null); }
        if (!res.ok) return (pass = null);
        return res.json().then((body) => (pass = { token: body.pass, renewAt: Date.now() + RENEW }));
      })
      .catch(() => (pass = null))
      .finally(() => { asking = null; });
    return asking;
  };
  window.airratesPanelHeaders = () => getPass().then((held) => (held ? { "X-Live-Pass": held.token } : {}));

  const address = (panel) => {
    const lazy = panel.getAttribute("data-lazy");
    if (lazy) return lazy;
    const url = new URL(location.href);
    url.hash = "";
    url.searchParams.set("panel", panel.dataset.tabPanel);
    return url.pathname + url.search;
  };
  const busy = new Set();
  const upgrade = async (panel, retried) => {
    if (panel.hidden || busy.has(panel) || !panel.querySelector("[data-member-lock]")) return;
    busy.add(panel);
    const wait = panel.querySelector(".member-lock-wait");
    try {
      const held = await getPass();
      if (!held) return;
      if (wait) wait.hidden = false;
      const res = await fetch(address(panel), { cache: "no-store", credentials: "same-origin", headers: { "X-Live-Pass": held.token } });
      if (res.status === 401 && !retried) {
        pass = null;
        busy.delete(panel);
        return upgrade(panel, true);
      }
      if (!res.ok) return;
      const body = new DOMParser().parseFromString(await res.text(), "text/html").querySelector(".lazy-body");
      if (!body || body.querySelector("[data-member-lock]")) return;
      panel.replaceChildren(document.importNode(body, true));
      panel.dataset.memberView = "on";
      panel.dataset.lazyState = "loaded";
      panel.dataset.loadedAt = String(Date.now());
      if (window.airratesHelp) window.airratesHelp(panel);
    } catch (_) {
    } finally {
      if (wait && wait.isConnected) wait.hidden = true;
      busy.delete(panel);
    }
  };
  // Whenever a member tab is shown, or something (tabs.ts, a control) put its locked copy back.
  const watch = new MutationObserver((records) => {
    for (const record of records) {
      const panel = record.target.closest ? record.target.closest("[data-member-tab]") : null;
      if (panel) upgrade(panel, false);
    }
  });
  for (const panel of tabs) {
    watch.observe(panel, { attributes: true, attributeFilter: ["hidden"], childList: true });
    upgrade(panel, false);
  }
})();`;

/**
 * The member "All cascades" tab: every cascade the member site's minute watch found in every asset
 * over the window (profitlock-member src/cascades/), newest first, with what the price did after.
 *
 * WHY STORED, NOT FOUND HERE. The asset's own Cascades tab finds them for one asset when it is opened;
 * doing that for every asset would read a week of every market on each view. The watch does it once a
 * minute for everyone, which is also what lets it send alerts, and this reads what it kept.
 *
 * THE PRICES ARE MARKS, not the candles the asset's own tab uses: the asset's deepest market's mark
 * when the watch first saw the cascade (a minute or two in), and an hour and four hours after its last
 * minute, taken as they happened.
 */
function feedPanel(data: {
  feed: readonly StoredCascade[] | null;
  window: LiquidationWindow;
  now: number;
  hrefFor: (entry: StoredCascade) => string;
}): string {
  const { feed, window, now, hrefFor } = data;
  if (feed === null) {
    return `<p class="empty">${tr("The cascades could not be read right now.")}</p>`;
  }
  if (feed.length === 0) {
    return `<p class="empty">${tr("No cascade in any asset in the last {window}.", { window: esc(window) })}</p>`;
  }
  const rows = feed.map((c) => {
    const down = c.long_usd >= c.short_usd;
    const after = (mark: number | null, minutes: number) =>
      mark !== null && c.mark_detected !== null && c.mark_detected > 0
        ? mark / c.mark_detected - 1
        : c.last_minute.getTime() + minutes * 60_000 > now
          ? ("later" as const)
          : null;
    return { c, down, after1h: after(c.mark_1h, 60), after4h: after(c.mark_4h, 240) };
  });
  const longs = rows.filter((row) => row.down);
  const shorts = rows.filter((row) => !row.down);
  const usd = (list: typeof rows) =>
    list.reduce((sum, row) => sum + row.c.long_usd + row.c.short_usd, 0);
  const hourTile = (title: string, list: typeof rows) => {
    const moves = list.map((row) => row.after1h).filter((v): v is number => typeof v === "number");
    if (moves.length === 0) {
      return `<div class="cvd-tile"><p class="eyebrow">${title}</p><p class="cvd-big dim">–</p><p class="dim">${list.length === 0 ? tr("none in this window") : tr("none an hour old yet")}</p></div>`;
    }
    const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
    const up = moves.filter((move) => move > 0).length;
    return `<div class="cvd-tile"><p class="eyebrow">${title}</p><p class="cvd-big ${mean > 0 ? "cvd-up" : mean < 0 ? "cvd-down" : ""}">${movePct(mean)}</p><p class="dim">${tr("higher in {up} of {n}", { up, n: moves.length })}</p></div>`;
  };
  const assets = new Set(feed.map((c) => `${c.asset_class}|${c.base}`)).size;
  const tiles = `<div class="cvd-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Cascades")}</p><p class="cvd-big">${feed.length}</p><p class="dim">${tr("in {n} assets", { n: assets })}</p></div>
<div class="cvd-tile"><p class="eyebrow">${tr("Longs and shorts")}</p><p class="cvd-big"><span class="lq-ink-l">${money(usd(longs))}</span> / <span class="lq-ink-s">${money(usd(shorts))}</span></p><p class="dim">${tr("{longs} long cascades, {shorts} short", { longs: longs.length, shorts: shorts.length })}</p></div>
${hourTile(tr("An hour after long cascades"), longs)}
${hourTile(tr("An hour after short cascades"), shorts)}
</div>`;
  const table = rows
    .map(({ c, down, after1h, after4h }) => {
      const total = c.long_usd + c.short_usd;
      const share = `${Math.round(((down ? c.long_usd : c.short_usd) / total) * 100)}%`;
      const venues = c.venues.split(",").filter(Boolean);
      const minutes = Math.round((c.last_minute.getTime() - c.started_at.getTime()) / 60_000) + 1;
      return `<tr><td class="dim">${timeTag(c.started_at.getTime(), "mdhm")}</td><td><a href="${esc(hrefFor(c))}">${assetName(c.base, c.asset_class)}</a></td><td class="num">${tr("{n} min", { n: minutes })}</td><td class="num"><b>${money(total)}</b></td><td class="${down ? "lq-ink-l" : "lq-ink-s"}">${down ? tr("longs {share}", { share }) : tr("shorts {share}", { share })}</td><td class="num" title="${esc(venues.map((id) => venueName(id)).join(", "))}">${venues.length}</td><td class="num">${c.mark_detected === null ? "–" : formatPrice(c.mark_detected)}</td>${moveCell(after1h)}${moveCell(after4h)}</tr>`;
    })
    .join("");
  return `${tiles}
<div class="sheet-wrap"><table class="sheet lq-cascades">
<thead><tr><th>${tr("Start")}</th><th>${tr("Asset")}</th><th class="num">${tr("Length")}</th><th class="num">${tr("Liquidated")}</th><th>${tr("Side")}</th><th class="num">${tr("Venues")}</th><th class="num" title="${esc(tr("The deepest market's mark when the watch first saw it, a minute or two in"))}">${tr("Price when seen")}</th><th class="num" title="${esc(tr("From the price when seen to the mark an hour after the cascade ended"))}">${tr("1h after")}</th><th class="num" title="${esc(tr("From the price when seen to the mark four hours after the cascade ended"))}">${tr("4h after")}</th></tr></thead>
<tbody>${table}</tbody></table></div>
<p class="notes">${tr(
    "Every asset, found each minute as it happens, by the rule of each asset's Cascades tab. Prices are the asset's deepest market's mark when the watch saw it and an hour and four hours after it ended. Members can have them sent to Telegram from {alerts}.",
    { alerts: `<a href="${esc(`${MEMBER_URL}member/alerts`)}">${tr("the alerts page")}</a>` },
  )}</p>`;
}

/** "+1.2%", "−3.4%": a move as the cascade table and tiles show it, with a real minus sign. */
function movePct(fraction: number): string {
  const text = Math.abs(fraction * 100).toFixed(1);
  if (Number(text) === 0) return "0.0%";
  return `${fraction < 0 ? "−" : "+"}${text}%`;
}

/** One move in a cell: coloured by its direction, a dash for none, "later" for one still to come. */
function moveCell(value: number | "later" | null): string {
  if (value === "later") return `<td class="num dim">${tr("later")}</td>`;
  if (value === null) return `<td class="num dim">–</td>`;
  return `<td class="num ${value > 0 ? "cvd-up" : value < 0 ? "cvd-down" : ""}">${movePct(value)}</td>`;
}

/**
 * The Cascades tab: the bursts in which one asset's forced closes piled up within minutes
 * (app/cascades.ts), and what its price did into each one and in the hours after.
 *
 * THE QUESTION IT ANSWERS is the one a trader asks of a flush: was that the bottom? Each row says how
 * far the price went while the closes landed and where it stood one and four hours after they
 * stopped, and the tiles add those up by side over the window -- how often a long cascade was followed
 * by a higher price an hour later. A handful of cascades is a handful of cases, not a law, and the
 * tiles give the count beside every average so it reads that way.
 */
function cascadesPanel(data: {
  asset: string;
  label: string;
  view: CascadeView | null;
  picker: string;
}): string {
  const { label, view, picker } = data;
  const controls = `<div class="lq-controls">${picker}${helpButton("liq-cascades")}</div>
${helpPanel(
  "liq-cascades",
  `<p>${tr(
    "A cascade is a burst in which one asset's liquidations piled up within minutes: consecutive minutes each running at {pace} times its 7-day average pace or more, with no more than {gap} quiet minutes between them, and at least an hour's worth of that average pace, and {floor}, in all. Every exchange whose liquidation feed the collector reads is counted; the venue choices on the other tabs do not narrow it.",
    { pace: CASCADE_PACE, gap: CASCADE_GAP_MINUTES, floor: formatUsd(CASCADE_FLOOR) },
  )}</p><p>${tr(
    "Prices are the asset's busiest market in 5-minute candles. Into it is the move from the last close before the cascade to the furthest the price went inside it: the low when mostly longs were closed, the high when mostly shorts were. 1h and 4h after run from the close at its end to the close an hour and four hours later, and say later until that candle has closed.",
  )}</p>`,
)}`;
  if (view === null) {
    return `${controls}<p class="empty">${tr("The cascades could not be read right now.")}</p>`;
  }
  const pace = `${money(view.per_minute)}`;
  if (view.rows.length === 0) {
    return `${controls}<p class="empty">${tr(
      "No cascade in {asset} in this window: no burst reached {pace} times its usual pace with an hour's worth of it. Its usual pace is {usd} a minute, the 7-day average.",
      { asset: label, pace: CASCADE_PACE, usd: pace },
    )}</p>`;
  }

  const longs = view.rows.filter((row) => longLed(row.cascade));
  const shorts = view.rows.filter((row) => !longLed(row.cascade));
  const total = (rows: typeof view.rows) =>
    rows.reduce((sum, row) => sum + row.cascade.long_usd + row.cascade.short_usd, 0);
  // The hour after, by side: only the cascades with an hour behind them and a price to read.
  const hourAfter = (rows: typeof view.rows) =>
    rows
      .map((row) => row.reaction.after[0])
      .filter((value): value is number => typeof value === "number");
  const afterTile = (title: string, rows: typeof view.rows, ink: string) => {
    const moves = hourAfter(rows);
    if (moves.length === 0) {
      return `<div class="cvd-tile"><p class="eyebrow">${title}</p><p class="cvd-big dim">–</p><p class="dim">${
        rows.length === 0 ? tr("none in this window") : tr("none an hour old yet")
      }</p></div>`;
    }
    const mean = moves.reduce((sum, move) => sum + move, 0) / moves.length;
    const up = moves.filter((move) => move > 0).length;
    return `<div class="cvd-tile"><p class="eyebrow">${title}</p><p class="cvd-big ${
      mean > 0 ? "cvd-up" : mean < 0 ? "cvd-down" : ""
    }">${movePct(mean)}</p><p class="dim"><span class="${ink}">${tr("higher in {up} of {n}", {
      up,
      n: moves.length,
    })}</span></p></div>`;
  };
  const tiles = `<div class="cvd-tiles">
<div class="cvd-tile"><p class="eyebrow">${tr("Cascades")}</p><p class="cvd-big">${view.rows.length}</p><p class="dim"><span class="lq-ink-l">${tr("{usd} longs", { usd: money(total(longs)) })}</span> · <span class="lq-ink-s">${tr("{usd} shorts", { usd: money(total(shorts)) })}</span></p></div>
${afterTile(tr("An hour after long cascades"), longs, "lq-ink-l")}
${afterTile(tr("An hour after short cascades"), shorts, "lq-ink-s")}
<div class="cvd-tile"><p class="eyebrow">${tr("Usual pace")}</p><p class="cvd-big">${pace}</p><p class="dim">${tr("a minute, the 7-day average")}</p></div>
</div>`;

  const rows = view.rows
    .map(({ cascade, reaction }) => {
      const sum = cascade.long_usd + cascade.short_usd;
      const down = longLed(cascade);
      const share = `${Math.round(((down ? cascade.long_usd : cascade.short_usd) / sum) * 100)}%`;
      const names = cascade.venues.map((venueId) => venueName(venueId)).join(", ");
      return `<tr><td class="dim">${timeTag(cascade.start.getTime(), "mdhm")}</td><td class="num">${tr("{n} min", { n: cascade.minutes })}</td><td class="num" title="${esc(liquidationCount(cascade.events))}"><b>${money(sum)}</b></td><td class="${down ? "lq-ink-l" : "lq-ink-s"}">${
        down ? tr("longs {share}", { share }) : tr("shorts {share}", { share })
      }</td><td class="num" title="${esc(names)}">${cascade.venues.length}</td><td class="num">${
        reaction.before === null ? "–" : formatPrice(reaction.before)
      }</td>${moveCell(reaction.into)}${reaction.after.map(moveCell).join("")}</tr>`;
    })
    .join("");
  const source =
    view.price_venue !== null && view.price_symbol !== null
      ? tr("Prices: {market} on {venue}, in 5-minute candles.", {
          market: esc(view.price_symbol),
          venue: esc(venueName(view.price_venue)),
        })
      : tr("No price history for {asset}, so the moves are blank.", { asset: label });
  return `${controls}
${tiles}
<div class="sheet-wrap"><table class="sheet lq-cascades">
<thead><tr><th>${tr("Start")}</th><th class="num">${tr("Length")}</th><th class="num">${tr("Liquidated")}</th><th>${tr("Side")}</th><th class="num" title="${esc(tr("Exchanges with a liquidation in it"))}">${tr("Venues")}</th><th class="num" title="${esc(tr("The last close before the cascade began"))}">${tr("Price before")}</th><th class="num" title="${esc(tr("From the price before to the furthest it went inside the cascade"))}">${tr("Into it")}</th><th class="num" title="${esc(tr("From the close at its end to the close an hour later"))}">${tr("1h after")}</th><th class="num" title="${esc(tr("From the close at its end to the close four hours later"))}">${tr("4h after")}</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="notes">${tr("Newest first.")} ${source} ${tr("Times are in {zone}.", { zone: zoneTag() })}</p>`;
}

/** A count with its noun, singular for one. */
const liquidationCount = (n: number) =>
  n === 1
    ? tr("{n} liquidation", { n: n.toLocaleString("en-US") })
    : tr("{n} liquidations", { n: n.toLocaleString("en-US") });
const exchangeCount = (n: number) =>
  n === 1 ? tr("{n} exchange", { n }) : tr("{n} exchanges", { n });

/**
 * The whole market's last 24 hours of liquidations as one plain-text line, for the market narrator
 * (web/narrator.ts) rather than the page: what was force-closed, across how many assets and exchanges,
 * which side took most, the three most liquidated assets and the single biggest close. Null when
 * nothing was. Plain text because the narrator types its lines out character by character; the same
 * sentences as the asset pages' summary, so they share their translations, but for the biggest close.
 *
 * The line states the facts of one hour, never of "now" (owner, 2026-11-15: it must be the truth, not a
 * frozen line). The narrator stamps it with an hour and the reader's strip keeps it for hours, so the
 * map and the biggest close are read for the 24 hours up to that hour (app.ts), and the biggest close
 * gives its own time in UTC where the asset pages, which refresh, say how long ago it was.
 */
export function marketLiquidationText(
  map: LiquidationMap,
  biggest: LiquidationEvent | null,
): string | null {
  const sum = (pick: (total: (typeof map.totals)[number]) => number) =>
    map.totals.reduce((total, venue) => total + pick(venue), 0);
  const total = sum((venue) => venue.notional_usd);
  if (!(total > 0)) return null;
  const longs = sum((venue) => venue.long_usd);
  const shorts = sum((venue) => venue.short_usd);
  const share = (part: number) => `${Math.round((part / (longs + shorts)) * 100)}%`;
  const sentences = [
    tr("{window}, {total} of positions were force-closed across {assets} on {venues}, {sides}.", {
      window: windowWords("24h"),
      total: money(total),
      assets:
        map.every.length === 1
          ? tr("{n} asset", { n: 1 })
          : tr("{n} assets", { n: map.every.length.toLocaleString("en-US") }),
      venues: exchangeCount(map.totals.length),
      sides:
        longs >= shorts
          ? tr("{share} of it longs", { share: share(longs) })
          : tr("{share} of it shorts", { share: share(shorts) }),
    }),
  ];
  const top = map.every.slice(0, 3).map((entry) => `${entry.asset} ${money(entry.notional_usd)}`);
  if (top.length > 0) {
    sentences.push(
      tr("The most liquidated: {list}.", {
        list:
          top.length === 1
            ? (top[0] as string)
            : tr("{first} and {last}", {
                first: top.slice(0, -1).join(tr(", ")),
                last: top[top.length - 1] as string,
              }),
      }),
    );
  }
  if (biggest) {
    // When, as a time of day in UTC, not "15h ago": the line stays in a reader's feed for hours, and
    // an age is only true at the moment it is written.
    const values = {
      usd: money(biggest.notional_usd),
      asset: biggest.asset,
      venue: venueName(biggest.venue_id),
      price: formatPrice(biggest.fill_price),
      when: biggest.liquidated_at.toISOString().slice(5, 16).replace("T", " "),
    };
    sentences.push(
      biggest.side === "long"
        ? tr(
            "The largest single liquidation was a {usd} {asset} long on {venue} at {price} ({when} UTC).",
            values,
          )
        : tr(
            "The largest single liquidation was a {usd} {asset} short on {venue} at {price} ({when} UTC).",
            values,
          ),
    );
  }
  // Chinese and Japanese run their sentences together; the others leave a space (as entryText does).
  return sentences.join(currentLocale() === "zh" || currentLocale() === "ja" ? "" : " ");
}

/** How the summary opens, by window. */
function windowWords(window: LiquidationWindow): string {
  if (window === "7d") return tr("In the last 7 days");
  if (window === "48h") return tr("In the last 48 hours");
  return tr("In the last 24 hours");
}

/** "71% of it longs": the side that took most of the money, never a 50/50 coin flip as a finding. */
function sideShare(longUsd: number, shortUsd: number): string {
  const total = longUsd + shortUsd;
  if (!(total > 0)) return "";
  const share = (part: number) => `${Math.round((part / total) * 100)}%`;
  return longUsd >= shortUsd
    ? tr("{share} of it longs", { share: `<b class="lq-ink-l">${share(longUsd)}</b>` })
    : tr("{share} of it shorts", { share: `<b class="lq-ink-s">${share(shortUsd)}</b>` });
}

/**
 * The page in words, above the tabs: what was force-closed in the window, which side took it, the
 * biggest single close and -- on an asset's own page -- how much of the watched whale book sits within
 * 5% of the price.
 *
 * WHY WORDS (2026-11-15). The tabs are charts and grids, which a reader scans and a search engine does
 * not read; the per-asset pages had nothing in them a search result could quote, or a reader could
 * paste. Every figure here is one the tabs below show too -- the totals are the map's, the biggest is
 * the Largest tab's first row, the whale figure is the whale map's "Within 5% of the mark" tile -- so
 * the sentence is a reading of the page, never a second source that could disagree with it.
 *
 * The figures are the whole market's, whatever the venue strip narrows a tab to: this sits above the
 * tabs and speaks for the window, as the window strip beside it does.
 *
 * ONLY ON AN ASSET'S OWN PAGE since 2026-11-15 (owner): the whole market's line moved to the masthead's
 * market narrator (marketLiquidationText), where it reads on every page; the hub opens on its tabs.
 */
function liquidationBrief(view: LiquidationView): string {
  const { map, asset, params, now } = view;
  // The whole market's line is the narrator's now (marketLiquidationText); an asset's page keeps its own.
  if (!view.addressed || asset === null) return "";
  const biggest = view.biggest ?? null;
  const opening = windowWords(params.window);
  const sentences: string[] = [];

  const assetClass = view.assetMap?.asset_class ?? view.assetClass ?? "crypto";
  const entry = map.every.find(
    (candidate) => candidate.asset === asset && candidate.asset_class === assetClass,
  );
  const name = `<b>${esc(asset)}</b>`;
  if (!entry || !(entry.notional_usd > 0)) {
    sentences.push(
      tr(
        "{window}, no {asset} position was force-closed on the exchanges whose liquidation feeds the collector reads.",
        { window: opening, asset: name },
      ),
    );
  } else {
    sentences.push(
      tr(
        "{window}, {total} of {asset} positions were force-closed in {events} on {venues}, {sides}.",
        {
          window: opening,
          total: `<b>${money(entry.notional_usd)}</b>`,
          asset: name,
          events: liquidationCount(entry.events),
          venues: exchangeCount(entry.venues),
          sides: sideShare(entry.long_usd, entry.short_usd),
        },
      ),
    );
    if (biggest) {
      const values = {
        usd: `<b>${money(biggest.notional_usd)}</b>`,
        venue: esc(venueName(biggest.venue_id)),
        price: formatPrice(biggest.fill_price),
        ago: since(biggest.liquidated_at, now),
      };
      sentences.push(
        biggest.side === "long"
          ? tr("The largest single one was a {usd} long on {venue} at {price}, {ago}.", values)
          : tr("The largest single one was a {usd} short on {venue} at {price}, {ago}.", values),
      );
    }
  }
  if (view.whales) {
    const near = whalesNearMark(view.whales, "1m");
    if (near.positions > 0 && near.longs === 0 && near.shorts === 0) {
      // "$0 of longs ... $0 of shorts" is a sum of nothing dressed as a finding.
      sentences.push(
        tr(
          "None of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX would be liquidated within 5% of the price.",
        ),
      );
    } else if (near.positions > 0) {
      sentences.push(
        tr(
          "Of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX, {longs} of longs would be liquidated within 5% below the price and {shorts} of shorts within 5% above.",
          {
            longs: `<b class="lq-ink-l">${money(near.longs)}</b>`,
            shorts: `<b class="lq-ink-s">${money(near.shorts)}</b>`,
          },
        ),
      );
    }
  }
  // Which address the words describe: a tab that swaps the asset in place hides them (LQ_SWAP_SCRIPT),
  // rather than leave one asset's figures above another's tabs.
  const path = esc(controlHref(controlState(view)).split("?")[0] as string);
  return `<p class="lede lq-brief" data-lq-brief="${path}">${sentences.join(" ")}</p>`;
}

/**
 * The Largest tab: single forced closes, the biggest in the window or the newest above a floor, in
 * every asset on /liquidations and in the asset on its own page.
 *
 * WHY A LIST HERE, when the page's own docblock argues against one. A list of every close is noise --
 * a day holds over a hundred thousand of them. A list of the fifty biggest is the opposite: it is
 * the handful a reader asks about ("who got taken out for $8M?"), which the grids sum away into a
 * cell. Newest first above a floor is the running tape of big closes.
 */
/** The floors as their buttons and sentences name them: "$10k", not formatUsd's "$10.0k". */
const LARGEST_FLOOR_LABEL: Record<LargestFloor, string> = {
  "10k": "$10k",
  "100k": "$100k",
  "1m": "$1M",
};

function largestPanel(view: LiquidationView, list: readonly LiquidationEvent[] | null): string {
  const { map, assetParams } = view;
  const state = controlState(view);
  const scoped = view.addressed ? view.asset : null;
  const swap = (href: string, on: boolean, text: string) =>
    on
      ? `<a class="on" href="${esc(href)}" aria-current="page" data-lq-swap="largest">${text}</a>`
      : `<a href="${esc(href)}" data-lq-swap="largest">${text}</a>`;
  const orderStrip = `<nav class="tf" aria-label="${tr("Order")}">${swap(
    controlHref(state, { order: "size" }, "#largest"),
    assetParams.order === "size",
    tr("Largest first"),
  )}${swap(
    controlHref(state, { order: "newest" }, "#largest"),
    assetParams.order === "newest",
    tr("Newest first"),
  )}</nav>`;
  // The floor only means something on the newest-first list: the biggest-first one is ranked by it.
  const floorStrip =
    assetParams.order === "newest"
      ? `<nav class="tf" aria-label="${tr("Smallest close")}">${(
          Object.keys(LARGEST_FLOORS) as LargestFloor[]
        )
          .map((floor) =>
            swap(
              controlHref(state, { min: floor }, "#largest"),
              floor === assetParams.min,
              `${LARGEST_FLOOR_LABEL[floor]}+`,
            ),
          )
          .join("")}</nav>`
      : "";
  // Every asset, or one: the picker moves to an asset's page, and from one "all assets" comes back.
  const scope = `${assetPicker(state, map.every, scoped, "#largest")}${
    scoped === null
      ? ""
      : `<nav class="tf" aria-label="${tr("Assets")}">${swap(controlHref(state, { asset: null }, "#largest"), false, tr("All assets"))}</nav>`
  }`;
  const feeds = map.totals.map((total) => total.venue_id);
  const controls = `<div class="lq-controls">${scope}${orderStrip}${floorStrip}${venueStrip(state, feeds, "largest")}</div>`;

  if (list === null) {
    return `${controls}<p class="empty">${tr("The largest liquidations could not be read right now.")}</p>`;
  }
  if (list.length === 0) {
    return `${controls}<p class="empty">${
      assetParams.order === "newest"
        ? tr("No single liquidation of {floor} or more in this window.", {
            floor: LARGEST_FLOOR_LABEL[assetParams.min],
          })
        : tr("Nothing has been force-closed in this window.")
    }</p>`;
  }

  const rows = list
    .map((event) => {
      const long = event.side === "long";
      const assetCell =
        scoped === null
          ? `<td><a href="${esc(
              controlHref(
                state,
                { asset: { name: event.asset, assetClass: event.asset_class } },
                "#largest",
              ),
            )}">${assetName(event.asset, event.asset_class)}</a></td>`
          : "";
      return `<tr><td class="dim">${timeTag(event.liquidated_at.getTime(), "mdhm")}</td>${assetCell}<td title="${esc(event.venue_symbol)}">${esc(venueName(event.venue_id))}</td><td class="${long ? "lq-ink-l" : "lq-ink-s"}">${long ? tr("long") : tr("short")}</td><td class="num"><b>${money(event.notional_usd)}</b></td><td class="num">${formatPrice(event.fill_price)}</td></tr>`;
    })
    .join("");
  const full = list.length >= LARGEST_ROWS;
  const note =
    assetParams.order === "newest"
      ? full
        ? tr("The {n} newest liquidations of {floor} or more in this window.", {
            n: list.length,
            floor: LARGEST_FLOOR_LABEL[assetParams.min],
          })
        : tr("Every liquidation of {floor} or more in this window.", {
            floor: LARGEST_FLOOR_LABEL[assetParams.min],
          })
      : full
        ? tr("The {n} largest single liquidations in this window.", { n: list.length })
        : tr("Every liquidation in this window, largest first.");
  return `${controls}
<div class="sheet-wrap"><table class="sheet lq-big">
<thead><tr><th>${tr("Time")}</th>${scoped === null ? `<th>${tr("Asset")}</th>` : ""}<th>${tr("Venue")}</th><th>${tr("Side")}</th><th class="num" title="${esc(tr("The position's value at the fill price"))}">${tr("Size")}</th><th class="num">${tr("Fill price")}</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="notes">${note} ${tr("Each row is one forced close as its exchange reported it: the side is the position that was closed, the size its value at the fill price. Times are in {zone}.", { zone: zoneTag() })}</p>`;
}

/**
 * The tabs of /liquidations, in order (owner, 2026-11-10: the whale map first, the asset timeline --
 * the map by asset and hour -- last; the Largest list, 2026-11-15, beside it, the other tab that reads
 * every asset). The map and the tab the page opens on ship filled; the rest may
 * load themselves.
 */
export const LIQUIDATION_TABS = [
  "whales",
  "sides",
  "price",
  "odds",
  "cascades",
  "feed",
  "history",
  "largest",
  "winners",
  "oi",
  "map",
] as const;
export type LiquidationTab = (typeof LIQUIDATION_TABS)[number];

/** What a render of /liquidations read. A field left undefined was not read by THIS render. */
export interface LiquidationView {
  map: LiquidationMap;
  /** The asset the per-asset tabs show: the addressed one, or the busiest when none was addressed. */
  asset: string | null;
  /** True when the ADDRESS named that asset, which is what every control link is built from. */
  addressed: boolean;
  /** The addressed asset's class, for the control links; null when the address names none. */
  assetClass: AssetClass | null;
  /**
   * The per-asset read the Sides and Prices tabs draw, null when there is no asset to read, and
   * undefined when this render skipped it: those two tabs then ship as placeholders that load
   * themselves (see `lazyPanel`).
   */
  assetMap?: LiquidationAssetMap | null;
  /** The Odds tab's model; null when there is too little history, undefined when not read. */
  outlook?: Outlook | null;
  /**
   * The whale map's Hyperliquid positions in the asset, $100k and up; null when the read failed,
   * undefined when this render skipped it (the tab then loads itself).
   */
  whales?: readonly WhalePosition[] | null;
  /**
   * The Largest tab's list, as its order, floor and venues ask; null when the read failed, undefined
   * when this render skipped it (the tab then loads itself).
   */
  largest?: readonly LiquidationEvent[] | null;
  /** The Cascades tab's read; null when it failed, undefined when this render skipped it. */
  cascades?: CascadeView | null;
  /** True when this render is a member's request for a member tab (index.ts checked the pass). */
  member?: boolean;
  /** The member History tab's days; null when the read failed, undefined when not read. */
  history?: readonly LiquidationDay[] | null;
  /** The member OI tab's open interest by asset; null when the read failed, undefined when not read. */
  openInterest?: readonly AssetOpenInterest[] | null;
  /** The member "All cascades" tab's cascades; null when the read failed, undefined when not read. */
  feed?: readonly StoredCascade[] | null;
  /**
   * The member Top traders list: Hyperliquid's leaderboard top (null when it could not be read) and
   * the whale tracker's big positions for them (null when that read failed). Undefined when not read.
   */
  winners?: { board: LeaderBoard | null; holdings: readonly TraderHolding[] | null };
  /** The trader that tab opened (`?trader=`), with their leaderboard place; undefined when not read. */
  trader?: { read: TraderRead; board: LeaderBoard | null };
  /**
   * The window's single biggest close in the page's scope, every venue, for the summary; null when
   * there is none or the read failed, undefined when not read (a tab rendered on its own).
   */
  biggest?: LiquidationEvent | null;
  params: LiquidationParams;
  assetParams: LiquidationAssetParams;
  now: number;
}

const controlState = (view: LiquidationView) => ({
  addressed: view.addressed ? view.asset : null,
  assetClass: view.assetMap?.asset_class ?? view.assetClass,
  params: view.params,
  assetParams: view.assetParams,
});

/**
 * One tab's markup, or null when this render did not read what that tab needs.
 *
 * The "nothing to show" sentences stay here, not in the placeholder: an asset-less window is an
 * answer, and it is the same answer whether the tab rendered with the page or on its own.
 */
function tabBody(view: LiquidationView, id: LiquidationTab): string | null {
  const { map, asset, params, assetParams, now } = view;
  const state = controlState(view);
  if (id === "map") return mapPanel({ map, params, strip: state, now });
  if (id === "largest") return view.largest === undefined ? null : largestPanel(view, view.largest);
  if ((MEMBER_PANELS as readonly string[]).includes(id)) {
    const memberId = id as MemberPanel;
    // Locked for everyone but a member's own request for the tab, whatever else this render read.
    if (!view.member)
      return memberLock(memberId, memberId === "history" || memberId === "odds" ? asset : null);
    if (memberId === "odds") return oddsBody(view);
    if (memberId === "winners") {
      const traderHref = (to: {
        top?: TraderWindow;
        trader?: string | null;
        pnl?: TraderWindow;
        coin?: string | null;
      }) => controlHref(state, to);
      if (view.trader) {
        const listWindow = assetParams.top;
        const board = view.trader.board;
        const ranked = board ? board.top[PNL_WINDOW_OF[listWindow]] : [];
        const place = ranked.findIndex((leader) => leader.address === view.trader?.read.address);
        // Named from whichever window holds them, for a trader opened outside the list's window.
        const named =
          place >= 0
            ? ranked[place]
            : board
              ? Object.values(board.top)
                  .flat()
                  .find((leader) => leader.address === view.trader?.read.address)
              : undefined;
        return traderPanel({
          read: view.trader.read,
          rank:
            place >= 0 && named
              ? { place: place + 1, window: listWindow, leader: named }
              : named
                ? { place: 0, window: listWindow, leader: named }
                : null,
          pnlWindow: assetParams.pnl,
          coin: assetParams.coin,
          now,
          hrefFor: traderHref,
        });
      }
      if (!view.winners) return null;
      return winnersPanel({
        board: view.winners.board,
        holdings: view.winners.holdings,
        window: assetParams.top,
        now,
        hrefFor: traderHref,
      });
    }
    if (memberId === "feed") {
      return feedPanel({
        feed: view.feed ?? null,
        window: params.window,
        now,
        hrefFor: (entry) =>
          controlHref(
            state,
            { asset: { name: entry.base, assetClass: entry.asset_class } },
            "#cascades",
          ),
      });
    }
    if (memberId === "oi") {
      return oiPanel({
        every: map.every,
        openInterest: view.openInterest ?? null,
        feeds: map.totals.length,
        window: params.window,
        hrefFor: (entry) =>
          controlHref(
            state,
            { asset: { name: entry.asset, assetClass: entry.asset_class } },
            "#history",
          ),
      });
    }
    if (asset === null) {
      return `<p class="empty">${tr("Nothing has been force-closed in this window, so there is no asset to read.")}</p>`;
    }
    const assetClass = view.assetMap?.asset_class ?? view.assetClass ?? "crypto";
    return historyPanel({
      label: assetName(asset, assetClass),
      days: view.history ?? null,
      span: assetParams.span,
      spanStrip: `<nav class="tf" aria-label="${tr("Span")}">${HISTORY_SPANS.map((span) => {
        const href = esc(controlHref(state, { span }, "#history"));
        return span === assetParams.span
          ? `<a class="on" href="${href}" aria-current="page" data-lq-swap="history">${span}d</a>`
          : `<a href="${href}" data-lq-swap="history">${span}d</a>`;
      }).join("")}</nav>`,
      picker: assetPicker(state, map.every, asset, "#history"),
      params,
      now,
    });
  }
  if (id === "cascades") {
    if (asset === null) {
      return `<p class="empty">${tr("Nothing has been force-closed in this window, so there is no asset to read.")}</p>`;
    }
    if (view.cascades === undefined) return null;
    const assetClass = view.assetMap?.asset_class ?? view.assetClass ?? "crypto";
    return cascadesPanel({
      asset,
      label: assetName(asset, assetClass),
      view: view.cascades,
      picker: assetPicker(state, map.every, asset, "#cascades"),
    });
  }

  if (id === "whales") {
    if (asset === null) {
      return `<p class="empty">${tr("Nothing has been force-closed in this window, so there is no asset to map.")}</p>`;
    }
    if (view.whales === undefined) return null;
    const assetClass = view.assetMap?.asset_class ?? view.assetClass ?? "crypto";
    return whalePanel({
      asset,
      label: assetName(asset, assetClass),
      positions: view.whales,
      floor: assetParams.whale,
      zoom: assetParams.wzoom,
      list: assetParams.wlist,
      listHref: (list) => esc(controlHref(state, { wlist: list }, "#whales")),
      picker: assetPicker(state, map.every, asset, "#whales"),
      floorStrip: `<nav class="tf" aria-label="${tr("Position size")}">${(
        Object.keys(WHALE_FLOORS) as WhaleFloor[]
      )
        .map((floor) => {
          const href = esc(controlHref(state, { whale: floor }, "#whales"));
          const text = `${floorLabel(floor)}+`;
          return floor === assetParams.whale
            ? `<a class="on" href="${href}" aria-current="page" data-lq-swap="whales">${text}</a>`
            : `<a href="${href}" data-lq-swap="whales">${text}</a>`;
        })
        .join("")}</nav><nav class="tf" aria-label="${tr("Price range")}">${WHALE_ZOOMS.map(
        (zoom) => {
          const href = esc(controlHref(state, { wzoom: zoom }, "#whales"));
          const text = `±${zoom}%`;
          return zoom === assetParams.wzoom
            ? `<a class="on" href="${href}" aria-current="page" data-lq-swap="whales">${text}</a>`
            : `<a href="${href}" data-lq-swap="whales">${text}</a>`;
        },
      ).join("")}</nav>`,
      now,
    });
  }

  if (id === "price") {
    if (asset !== null && view.assetMap === undefined) return null;
    if (asset === null || !view.assetMap) {
      return `<p class="empty">${tr("Nothing has been force-closed in this window, so there is no asset to price.")}</p>`;
    }
    // "fit" is offered explicitly beside the widths, so a reader who has clicked one can get back to
    // the width chosen from the asset's own data. Every link keeps the #price fragment, or following
    // one from /liquidations would land back on the map tab.
    const bandStrip = [
      `<a${
        assetParams.band === null ? ' class="on" aria-current="page"' : ""
      } href="${esc(controlHref(state, { band: null }, "#price"))}" data-lq-swap="price">${tr("fit")}</a>`,
      ...LIQUIDATION_BANDS.map((choice) => {
        const href = esc(controlHref(state, { band: choice }, "#price"));
        return choice === assetParams.band
          ? `<a class="on" href="${href}" aria-current="page" data-lq-swap="price">${choice}%</a>`
          : `<a href="${href}" data-lq-swap="price">${choice}%</a>`;
      }),
    ].join("");
    return assetPanel({
      asset,
      map: view.assetMap,
      params: { ...assetParams, venue: params.venue },
      bandStrip,
      picker: assetPicker(state, map.every, asset, "#price"),
      now,
    });
  }

  // sides
  if (asset !== null && view.assetMap === undefined) return null;
  if (asset === null || !view.assetMap) {
    return `<p class="empty">${tr("Nothing has been force-closed in this window, so there is no asset to split.")}</p>`;
  }
  return sidesPanel({
    asset,
    map: view.assetMap,
    params,
    picker: assetPicker(state, map.every, asset, "#sides"),
    pendingStrip: `<nav class="tf" aria-label="${tr("Pending")}">${[true, false]
      .map((on) => {
        const href = esc(controlHref(state, { pending: on }, "#sides"));
        const text = on ? tr("Pending on") : tr("Pending off");
        return on === assetParams.pending
          ? `<a class="on" href="${href}" aria-current="page" data-lq-swap="sides">${text}</a>`
          : `<a href="${href}" data-lq-swap="sides">${text}</a>`;
      })
      .join("")}</nav>${
      // The zoom only means something while the strip is drawn, so it goes with it.
      assetParams.pending
        ? `<nav class="tf" aria-label="${tr("Pending range")}">${(["near", "wide"] as const)
            .map((zoom) => {
              const href = esc(controlHref(state, { zoom }, "#sides"));
              // Plain words: the strip's own tick labels already say the range each one covers.
              const text = zoom === "near" ? tr("Zoom in") : tr("Zoom out");
              return zoom === assetParams.zoom
                ? `<a class="on" href="${href}" aria-current="page" data-lq-swap="sides">${text}</a>`
                : `<a href="${href}" data-lq-swap="sides">${text}</a>`;
            })
            .join("")}</nav>`
        : ""
    }`,
    showPending: assetParams.pending,
    pendingZoom: assetParams.zoom,
    now,
  });
}

/** The address one tab loads itself from: this page's own address and query, plus `panel=<tab>`. */
export function panelHref(view: LiquidationView, id: LiquidationTab): string {
  const href = controlHref(controlState(view));
  return `${href}${href.includes("?") ? "&" : "?"}panel=${id}`;
}

/** A tab this render did not fill (chart-skeleton.ts), until tabs.ts loads it. */
function lazyPanel(view: LiquidationView, id: LiquidationTab): string {
  return lazyPlaceholder(panelHref(view, id));
}

/**
 * One tab on its own, for `?panel=<tab>`: what tabs.ts fetches into a placeholder. A bare fragment,
 * not a page -- it is only ever read into a page that already has the layout, the styles and the
 * scripts. `data-rendered` lets live.ts tell a fresh copy from the one it already shows.
 */
export function liquidationsPanel(view: LiquidationView, id: LiquidationTab): string {
  const body =
    tabBody(view, id) ?? `<p class="empty">${tr("This tab has nothing to show right now.")}</p>`;
  // The per-asset tab labels ride along, for a tab loaded in place after the asset changed: the
  // tab bar is outside every panel, so LQ_SWAP_SCRIPT relabels it from these.
  return `<div class="lazy-body" data-rendered="${view.now}" data-labels="${esc(
    JSON.stringify(assetTabLabels(view.asset, view.addressed)),
  )}">${body}</div>`;
}

/**
 * The per-asset tabs' full labels, which name the asset they show. The Largest list names one only on
 * that asset's own page: on /liquidations it is every asset's, whichever one the other tabs prime.
 */
function assetTabLabels(
  asset: string | null,
  addressed: boolean,
): Record<"sides" | "price" | "odds" | "whales" | "largest" | "cascades" | "history", string> {
  return {
    history: asset === null ? tr("History") : tr("{asset} history", { asset }),
    cascades: asset === null ? tr("Cascades") : tr("{asset} cascades", { asset }),
    largest:
      addressed && asset !== null
        ? tr("{asset} largest liquidations", { asset })
        : tr("Largest liquidations"),
    sides: asset === null ? tr("Longs vs shorts") : tr("{asset} longs vs shorts", { asset }),
    price: asset === null ? tr("By price level") : tr("{asset} price levels", { asset }),
    odds: asset === null ? tr("Odds") : tr("{asset} odds", { asset }),
    whales: asset === null ? tr("Whale map") : tr("{asset} whale map", { asset }),
  };
}

/**
 * /liquidations: both views of the same subject, behind one tab bar.
 *
 * They are one category and one page. The map answers "which asset, which hour, which venue" and
 * the priced grid answers "at what level" for one of them -- the second is the first one's
 * drill-down, not a separate destination, and splitting them across two addresses put the same
 * subject in two places in the nav.
 *
 * TABS THIS RENDER DID NOT READ LOAD THEMSELVES (2026-10-07). Every tab used to ship in every
 * response, so /liquidations paid for the per-asset read and a week of price bars on each render
 * although most readers only look at the map. Now a tab ships filled only when its data was read
 * anyway -- the map always; Sides and Prices when the address or the query is about one asset; Odds
 * never -- and the others ship as `lazyPanel` placeholders. The tab bar, the hash and the edge cache
 * work as before: each placeholder's address is an ordinary cached URL.
 *
 * WHICH ASSET the per-asset tabs show: the one in the address, or the busiest by notional when the
 * address names none. `/liquidations` therefore opens on the day's biggest asset's whale map, its
 * other tabs behind (owner, 2026-11-10; it opened on the map by asset and hour before, which is now
 * the last tab, Asset Timeline), and `/liquidations/ETH` opens on ETH's prices directly.
 */
/** The window as a model should quote it. */
const AGENT_WINDOW: Record<LiquidationWindow, string> = {
  "24h": "24 hours",
  "48h": "48 hours",
  "7d": "7 days",
};

/**
 * The page's figures for an AI assistant (web/agent-brief.ts): what was liquidated in the window, on
 * which exchanges, longs against shorts, the most liquidated assets and each exchange's total, all
 * labelled. The hub lists every asset; an asset's page adds that asset's own figures by exchange. The
 * visible page carries these in the picker and the heat grid, which read as bare numbers to a model.
 */
export function liquidationsAgentBrief(data: LiquidationView & { overview: Overview }): string {
  return agentBrief(() => {
    const { map, params, asset, addressed } = data;
    const window = AGENT_WINDOW[params.window];
    const sum = (pick: (venue: LiquidationTotals) => number) =>
      map.totals.reduce((total, venue) => total + pick(venue), 0);
    const total = sum((venue) => venue.notional_usd);
    const longs = sum((venue) => venue.long_usd);
    const shorts = sum((venue) => venue.short_usd);
    const feeds = map.totals.map((venue) => esc(venueName(venue.venue_id))).join(", ");
    const parts: string[] = [];
    const link = (entry: LiquidationAssetSummary) =>
      `<a href="/liquidations/${assetPathFor(entry.asset, entry.asset_class)}.md">${esc(entry.asset)}</a>`;
    const one = addressed && asset !== null ? map.every.find((e) => e.asset === asset) : undefined;
    const count = (n: number, noun: string) =>
      `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`;

    parts.push(`<h2>In figures</h2>`);
    if (!(total > 0)) {
      parts.push(`<p>No liquidation was reported in the last ${window}.</p>`);
    } else {
      parts.push(
        `<p>In the last ${window}, ${money(total)} of perpetual futures positions were liquidated across ${count(map.every.length, "asset")} on ${count(map.totals.length, "exchange")}, in ${count(
          sum((v) => v.events),
          "liquidation",
        )}: longs ${money(longs)} (${share(longs, longs + shorts)}), shorts ${money(shorts)} (${share(shorts, longs + shorts)}). These are the exchanges whose liquidation feeds airrates reads (${feeds}), not the whole market.</p>`,
      );
    }
    if (one) {
      parts.push(
        `<p>${esc(one.asset)} (${one.asset_class}) in the last ${window}: ${money(one.notional_usd)} liquidated on ${count(one.venues, "exchange")} in ${count(one.events, "liquidation")}, longs ${money(one.long_usd)} (${share(one.long_usd, one.long_usd + one.short_usd)}), shorts ${money(one.short_usd)} (${share(one.short_usd, one.long_usd + one.short_usd)}).</p>`,
      );
    }
    if (data.whales && data.whales.length > 0) {
      const near = whalesNearMark(data.whales, "1m");
      if (near.positions > 0) {
        parts.push(
          `<p>Whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX${one ? ` in ${esc(one.asset)}` : ""}: ${count(near.positions, "position")}; ${money(near.longs)} of longs would be liquidated within 5% below the price and ${money(near.shorts)} of shorts within 5% above.</p>`,
        );
      }
    }
    const assetTotals = one ? data.assetMap?.totals : undefined;
    if (one && assetTotals && assetTotals.length > 0) {
      // The asset read carries no time per exchange today; the column shows only when it does.
      const timed = assetTotals.some((venue) => venue.last_at !== null);
      parts.push(`<h2>${esc(one.asset)} by exchange, last ${window}</h2>`);
      parts.push(
        agentTable(
          ["Exchange", "Liquidated", "Longs", "Shorts", "Liquidations"].concat(
            timed ? ["Last liquidation"] : [],
          ),
          [...assetTotals]
            .sort((a, b) => b.notional_usd - a.notional_usd)
            .map((venue) =>
              [
                esc(venueName(venue.venue_id)),
                money(venue.notional_usd),
                money(venue.long_usd),
                money(venue.short_usd),
                venue.events.toLocaleString("en-US"),
              ].concat(timed ? [utcMinute(venue.last_at)] : []),
            ),
        ),
      );
    }
    if (map.every.length > 0) {
      const top = map.every.slice(0, 25);
      parts.push(`<h2>Most liquidated assets, last ${window}</h2>`);
      parts.push(
        agentTable(
          ["Asset", "Class", "Liquidated", "Longs", "Shorts", "Liquidations", "Exchanges"],
          top.map((entry) => [
            link(entry),
            entry.asset_class,
            money(entry.notional_usd),
            money(entry.long_usd),
            money(entry.short_usd),
            entry.events.toLocaleString("en-US"),
            String(entry.venues),
          ]),
        ),
      );
    }
    if (map.totals.length > 0) {
      parts.push(`<h2>Every asset by exchange, last ${window}</h2>`);
      parts.push(
        agentTable(
          [
            "Exchange",
            "Liquidated",
            "Longs",
            "Shorts",
            "Liquidations",
            "Markets",
            "Last liquidation",
          ],
          [...map.totals]
            .sort((a, b) => b.notional_usd - a.notional_usd)
            .map((venue) => [
              esc(venueName(venue.venue_id)),
              money(venue.notional_usd),
              money(venue.long_usd),
              money(venue.short_usd),
              venue.events.toLocaleString("en-US"),
              String(venue.markets),
              utcMinute(venue.last_at),
            ]),
        ),
      );
    }
    const all = `window=${params.window}`;
    const own = one ? `assets=${encodeURIComponent(one.asset)}&${all}` : null;
    const ownLine = own
      ? `${esc(one?.asset ?? "")} as JSON: <a href="/v1/liquidations?${own}">/v1/liquidations?${own}</a>. `
      : "";
    parts.push(
      `<p>${ownLine}Every asset as JSON: <a href="/v1/liquidations?${all}">/v1/liquidations?${all}</a>. The tabs below are the page as people see it.</p>`,
    );
    return parts.join("\n");
  });
}

export function liquidations(
  data: LiquidationView & {
    overview: Overview;
    /** Which tab the server marks active. A hash in the URL still overrides it. */
    active: LiquidationTab;
  },
): string {
  const { overview, map, asset, params, active, now } = data;
  const state = controlState(data);
  const labels = assetTabLabels(asset, data.addressed);

  const panels = LIQUIDATION_TABS.map((id) => {
    // A member tab ships locked and loaded, with its own address, so tabs.ts does not fetch it bare,
    // live.ts leaves it out of the page's poll, and MEMBER_TAB_SCRIPT knows where to ask with a pass.
    if ((MEMBER_PANELS as readonly string[]).includes(id)) {
      return `<div class="tabpanel" role="tabpanel" id="panel-liq-${id}" data-tab-panel="${id}" aria-labelledby="tab-liq-${id}" data-lazy="${esc(panelHref(data, id))}" data-lazy-state="loaded" data-member-tab>
${liquidationsPanel(data, id)}
</div>`;
    }
    const body = tabBody(data, id);
    const lazy = body === null ? ` data-lazy="${esc(panelHref(data, id))}"` : "";
    // The whale table refreshes faster for members once the tab is open (live.ts, MEMBER LIVE).
    const member = id === "whales" ? " data-member-live-tab" : "";
    return `<div class="tabpanel" role="tabpanel" id="panel-liq-${id}" data-tab-panel="${id}" aria-labelledby="tab-liq-${id}"${lazy}${member}>
${body ?? lazyPanel(data, id)}
</div>`;
  }).join("\n");

  const totalEvents = map.totals.reduce((sum, venue) => sum + venue.events, 0);
  // Named from the data rather than written into the copy: the page used to say "gate and okx" in
  // three places, which is a sentence that goes quietly wrong the day a feed is added.
  const feeds = map.totals.map((total) => total.venue_id);
  const feedNames =
    feeds.length > 1
      ? tr("{first} and {last}", {
          first: feeds
            .slice(0, -1)
            .map((venueId) => esc(venueName(venueId)))
            .join(tr(", ")),
          last: esc(venueName(feeds[feeds.length - 1] as string)),
        })
      : feeds.map((venueId) => esc(venueName(venueId))).join("");

  // An asset's own address is its own page to a search engine, with the asset in its title. Until
  // 2026-11-14 every /liquidations/<asset> named /liquidations as its canonical address, which told
  // Google they were all copies of the hub -- and the per-asset pages are what people search for.
  // The bare page, which primes the busiest asset behind its tabs, stays the hub.
  const addressedClass = data.assetMap?.asset_class ?? data.assetClass ?? "crypto";
  const named = data.addressed && asset !== null ? assetTitle(asset, addressedClass) : null;
  return layout({
    title: named ? tr("{asset} liquidations", { asset: named }) : tr("Liquidations"),
    description: named
      ? tr(
          "{asset} liquidations across exchanges: longs against shorts by the hour, the price levels positions were closed at, and where large open positions would be liquidated.",
          { asset: named },
        )
      : tr(
          "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.",
        ),
    path:
      named && asset !== null
        ? `/liquidations/${assetPathFor(asset, addressedClass)}`
        : "/liquidations",
    overview,
    now,
    body: `${helpHeading(
      "h1",
      tr("Liquidations"),
      "liq",
      `<p>${tr(
        "Where positions were force-closed, by exchange. Colour is the side that was closed — {longs}, {shorts} — and intensity is the money, on a log scale.",
        {
          longs: `<span class="lq-ink-l">${tr("blue for longs")}</span>`,
          shorts: `<span class="lq-ink-s">${tr("red for shorts")}</span>`,
        },
      )} ${
        feeds.length === 0
          ? tr("No venue has reported a liquidation in this window.")
          : feeds.length === 1
            ? tr(
                "This is {venues}, the one venue whose liquidation feed the collector reads — not the whole market.",
                { venues: feedNames },
              )
            : tr(
                "This is {venues}, the {count} venues whose liquidation feed the collector reads — not the whole market.",
                { venues: feedNames, count: feeds.length },
              )
      }</p>`,
    )}
${liquidationsAgentBrief(data)}
${liquidationBrief(data)}
<div class="lq-controls">${windowStrip(state)}${legend()}</div>
${tabBar({
  name: "liq",
  tabs: [
    { id: "whales", label: labels.whales, shortLabel: tr("Whales") },
    { id: "sides", label: labels.sides, shortLabel: tr("Sides") },
    { id: "price", label: labels.price, shortLabel: tr("Prices") },
    { id: "odds", label: labels.odds, shortLabel: tr("Odds"), member: true },
    { id: "cascades", label: labels.cascades, shortLabel: tr("Cascades") },
    { id: "feed", label: tr("All cascades"), shortLabel: tr("All cascades"), member: true },
    { id: "history", label: labels.history, shortLabel: tr("History"), member: true },
    { id: "largest", label: labels.largest, shortLabel: tr("Largest") },
    { id: "winners", label: tr("Top traders"), shortLabel: tr("Winners"), member: true },
    {
      id: "oi",
      label: tr("Liquidations vs open interest"),
      shortLabel: tr("vs OI"),
      member: true,
    },
    {
      id: "map",
      label: tr("Asset Timeline"),
      shortLabel: tr("Timeline"),
      badge: totalEvents,
    },
  ],
  activeId: active,
})}
${panels}
${mapFootnote({ map, params, now })}
<p class="notes">${tr("Updated {ago}.", { ago: since(overview.updated_at, now) })}</p>
<style>${MEMBER_TAB_CSS}
${TRADER_CSS}</style>
<script>${SLOT_SCRIPT}</script>
<script>${LQ_SWAP_SCRIPT}</script>
<script>${MEMBER_TAB_SCRIPT}</script>
<script>${PICK_SCRIPT}</script>`,
  });
}
