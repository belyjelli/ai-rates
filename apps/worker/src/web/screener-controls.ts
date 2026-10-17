import { VENUES, type Venue } from "@ai-rates/venues";
import type { RateUnit, ScreenerFilters, ScreenerSort } from "../app/data";
import {
  DEFAULT_FILTERS,
  filtersToQuery,
  SPREAD_BANDS,
  spreadBand,
  VENUE_TYPES,
} from "../app/params";
import { esc } from "./format";
import { tr } from "./i18n";
import { icon } from "./icons";
import { VENUE_TYPE_SHORT } from "./venues";

/**
 * The screener's controls: a bar with the asset search, the period and the unit, and three dropdowns
 * (exchanges, filters, the steadiness key). One GET form, so every control works without the script
 * and every view is an address to share; SCREENER_SCRIPT adds presets, select-all, the dollar chips,
 * typing-to-filter and a clean address.
 *
 * The period and unit are links rather than inputs: one click is the whole choice, and the filters
 * already in the address travel with them.
 */

/** The periods the bar offers, each a sort: the spread now, or the same two markets averaged over N days. */
export const PERIODS: readonly { sort: ScreenerSort; label: string; days: number | null }[] = [
  { sort: "spread", label: "Now", days: null },
  { sort: "settled_7d", label: "7D", days: 7 },
  { sort: "settled_30d", label: "30D", days: 30 },
  { sort: "settled_60d", label: "60D", days: 60 },
];

/** The averaged period a view shows: the one it sorts by, else the week. */
export function shownPeriod(sort: ScreenerSort): {
  sort: ScreenerSort;
  label: string;
  days: number;
} {
  const period = PERIODS.find((p) => p.sort === sort && p.days !== null) ?? PERIODS[1];
  return period as { sort: ScreenerSort; label: string; days: number };
}

const UNITS: readonly RateUnit[] = ["apr", "day", "8h", "1h"];

/** The unit's short name on the bar and in a column header. */
export function unitLabel(unit: RateUnit): string {
  return unit === "apr" ? "APR" : unit === "day" ? tr("Day") : unit.toUpperCase();
}

/**
 * Steadiness bands over the stability score (migration 009): how often a market's funding held its
 * direction over 30 days, 0.50 a coin flip and 0.878 the most a month can score. Cut where the live
 * book splits about half, a quarter and a quarter (2026-10-17: 52% at 0.80 or more, 27% from 0.65).
 *
 * Not the coefficient of variation other screeners colour by: migration 009 measured it and threw it
 * out, because it explodes when a market's mean funding sits near zero, which is common, and ranks a
 * market that flips two days in three close to one that never does.
 */
export const STEADY_FROM = 0.8;
export const MIXED_FROM = 0.65;

export type Steadiness = "steady" | "mixed" | "erratic";

export function steadiness(score: number | null): Steadiness | null {
  if (score === null || !Number.isFinite(score)) return null;
  return score >= STEADY_FROM ? "steady" : score >= MIXED_FROM ? "mixed" : "erratic";
}

/** A leg's steadiness as a dot beside its exchange; hollow where there is no month to score. */
export function steadyDot(score: number | null, days: number | null): string {
  const band = steadiness(score);
  const title =
    band === null
      ? tr("No settled funding to score yet")
      : tr("Funding held its direction on {days} of its charging days in the last 30: {band}", {
          days: days ?? "–",
          band: bandName(band),
        });
  return `<i class="sd sd-${band ?? "none"}" title="${esc(title)}"></i>`;
}

function bandName(band: Steadiness): string {
  return band === "steady" ? tr("steady") : band === "mixed" ? tr("mixed") : tr("erratic");
}

/** Exchanges the picker lists: every one collected, by type (CEX, DEX, HIP-3), in name order. */
function listedVenues(): Map<string, Venue[]> {
  const groups = new Map<string, Venue[]>(VENUE_TYPES.map((type) => [type, []]));
  for (const venue of [...VENUES]
    .filter((v) => !v.retired && !v.aliasOf)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))) {
    const group = groups.get(venue.type) ?? [];
    group.push(venue);
    groups.set(venue.type, group);
  }
  for (const [type, venues] of groups) if (venues.length === 0) groups.delete(type);
  return groups;
}

const LISTED = listedVenues();
const LISTED_COUNT = [...LISTED.values()].reduce((n, g) => n + g.length, 0);

const selected = (f: ScreenerFilters, v: Venue) =>
  (f.venueIds === null || f.venueIds.includes(v.id)) &&
  (f.venueTypes === null || f.venueTypes.includes(v.type));

/** How many of the filters panel's settings differ from the defaults, for its button. */
function activeFilters(f: ScreenerFilters): number {
  return [
    f.assetClass !== null,
    f.minSpreadApr !== null || f.maxSpreadApr !== null,
    f.minOpenInterestUsd !== DEFAULT_FILTERS.minOpenInterestUsd,
    f.minVolume24hUsd !== DEFAULT_FILTERS.minVolume24hUsd,
    f.intervalHours !== null,
    f.sameQuote,
    f.maxAbsApr !== DEFAULT_FILTERS.maxAbsApr,
    f.limit !== DEFAULT_FILTERS.limit,
  ].filter(Boolean).length;
}

/** A set of radio buttons drawn as one segmented strip. `fallback` is the value the address leaves out. */
function segment(
  name: string,
  current: string,
  fallback: string,
  options: readonly [string, string][],
): string {
  return `<div class="seg">${options
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="${name}" value="${esc(value)}" data-default="${esc(fallback)}"${value === current ? " checked" : ""}><span>${label}</span></label>`,
    )
    .join("")}</div>`;
}

/** Dollars as the box shows them and parseUsd reads them back: "250k", "1m", "1.5m", "0". */
function shortUsd(value: number): string {
  for (const [size, suffix] of [
    [1e9, "b"],
    [1e6, "m"],
    [1e3, "k"],
  ] as const) {
    if (value >= size && Number.isInteger((value / size) * 1000)) return `${value / size}${suffix}`;
  }
  return String(value);
}

/** A dollar floor: typed, or set by a chip ("$1M+"). The box is the field; the chips only fill it. */
function dollarField(name: string, label: string, value: number, fallback: number): string {
  const chips = (
    [
      [100_000, "$100k+"],
      [1_000_000, "$1M+"],
      [10_000_000, "$10M+"],
      [100_000_000, "$100M+"],
    ] as const
  )
    .map(
      ([v, text]) =>
        `<button type="button" class="chip${v === value ? " on" : ""}" data-sx-set="${name}" value="${shortUsd(v)}">${text}</button>`,
    )
    .join("");
  return `<div class="sx-sect"><p class="sx-h">${label}</p>
<input class="sx-num" type="text" inputmode="decimal" name="${name}" value="${shortUsd(value)}" data-default="${shortUsd(fallback)}" aria-label="${esc(label)}" pattern="[0-9]+(\\.[0-9]+)?[kKmMbB]?">
<span class="sx-note">${tr("dollars, or 250k, 1.5m")}</span>
<div class="chips" data-js-only hidden>${chips}</div></div>`;
}

function venuesPanel(f: ScreenerFilters): string {
  let ticked = 0;
  const groups = [...LISTED.entries()]
    .map(([type, venues]) => {
      const on = venues.filter((v) => selected(f, v)).length;
      ticked += on;
      const tiles = venues
        .map(
          (v) =>
            `<label class="sx-tile"><input type="checkbox" name="venues" value="${esc(v.id)}"${selected(f, v) ? " checked" : ""}><span class="mono">${esc(v.name.slice(0, 1).toUpperCase())}</span><span class="nm">${esc(v.name)}</span></label>`,
        )
        .join("");
      return `<div class="sx-group" data-sx-group="${type}"><p class="sx-gh"><span>${VENUE_TYPE_SHORT[type] ?? esc(type)} (<b data-sx-n>${on}</b>/${venues.length})</span><span data-js-only hidden><button type="button" class="lnk" data-sx-tick="${type}">${tr("all")}</button> <button type="button" class="lnk" data-sx-untick="${type}">${tr("clear")}</button></span></p><div class="sx-tiles">${tiles}</div></div>`;
    })
    .join("");
  return `<details class="sx-pop" data-sx-venues><summary class="sx-btn">${icon("stack")} ${tr("Exchanges")} <b data-sx-total>${ticked}/${LISTED_COUNT}</b>${icon("caret")}</summary>
<div class="sx-panel sx-wide">
<div class="sx-sect" data-js-only hidden><p class="sx-h">${tr("Presets")}</p><div class="sx-presets" data-sx-presets data-drop-label="${esc(tr("Delete preset"))}"><span class="sx-note">${tr("No presets yet.")}</span></div>
<div class="sx-save"><input type="text" maxlength="32" placeholder="${esc(tr("Preset name…"))}" data-sx-preset-name aria-label="${esc(tr("Preset name"))}"><button type="button" class="ghost" data-sx-preset-save>${icon("plus")} ${tr("Save")}</button></div></div>
<p class="sx-all"><span data-js-only hidden><button type="button" class="lnk" data-sx-tick="">${tr("Select all")}</button> / <button type="button" class="lnk" data-sx-untick="">${tr("Clear all")}</button></span><span class="sx-note">${tr("{n} selected", { n: `<b data-sx-count>${ticked}/${LISTED_COUNT}</b>` })}</span></p>
${groups}
<div class="sx-foot"><a class="btn ghost" href="/screener${esc(filtersToQuery({ ...f, venueIds: null, venueTypes: null }))}">${tr("Every exchange")}</a><button type="submit">${tr("Apply")}</button></div>
</div></details>`;
}

function filtersPanel(f: ScreenerFilters): string {
  const n = activeFilters(f);
  const bands = Object.keys(SPREAD_BANDS).map(
    (id) => [id, id === "200-" ? "200%+" : `${id.replace("-", "–")}%`] as [string, string],
  );
  const reset = filtersToQuery({
    ...DEFAULT_FILTERS,
    venueIds: f.venueIds,
    venueTypes: f.venueTypes,
    query: f.query,
    unit: f.unit,
    sort: f.sort,
  });
  return `<details class="sx-pop"><summary class="sx-btn">${icon("sliders")} ${tr("Filters")}${n > 0 ? ` <b class="sx-badge">${n}</b>` : ""}${icon("caret")}</summary>
<div class="sx-panel">
<div class="sx-sect"><p class="sx-h">${tr("Asset class")}</p>${segment(
    "class",
    f.assetClass ?? "",
    "",
    [
      ["crypto", tr("Crypto")],
      ["tradfi", tr("TradFi")],
      ["", tr("All")],
    ],
  )}</div>
<div class="sx-sect"><p class="sx-h">${tr("Spread now (APR %)")}</p>${segment("spread", spreadBand(f) ?? "", "", [["", tr("Any")], ...bands])}</div>
${dollarField("min_oi", tr("Min open interest, each leg"), f.minOpenInterestUsd, DEFAULT_FILTERS.minOpenInterestUsd)}
${dollarField("min_vol", tr("Min 24h volume, each leg"), f.minVolume24hUsd, DEFAULT_FILTERS.minVolume24hUsd)}
<div class="sx-sect"><p class="sx-h" title="${esc(tr("Both legs settle at this interval"))}">${tr("Funding interval")}</p>${segment(
    "interval",
    f.intervalHours ? `${f.intervalHours}h` : "",
    "",
    [
      ["", tr("All")],
      ["1h", "1H"],
      ["4h", "4H"],
      ["8h", "8H"],
    ],
  )}</div>
<div class="sx-sect sx-toggles">
<label class="sx-toggle" title="${tr("A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency")}"><span><b>${tr("Same quote currency on both legs")}</b><small>${tr("No USDT leg against a USDC one")}</small></span><input type="checkbox" name="quote" value="same"${f.sameQuote ? " checked" : ""}></label>
<label class="sx-toggle" title="${tr("Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads")}"><span><b>${tr("Include beyond ±1000% APR")}</b><small>${tr("Distressed and delisting markets")}</small></span><input type="checkbox" name="extremes" value="1"${f.maxAbsApr === null ? " checked" : ""}></label>
</div>
<div class="sx-sect"><p class="sx-h">${tr("Rows")}</p>${segment(
    "limit",
    String(f.limit),
    String(DEFAULT_FILTERS.limit),
    [50, 100, 250, 500].map((v) => [String(v), String(v)] as [string, string]),
  )}</div>
<div class="sx-foot"><a class="btn ghost" href="/screener${esc(reset)}">${tr("Reset all")}</a><button type="submit">${tr("Apply")}</button></div>
</div></details>`;
}

function steadinessKey(): string {
  const card = (band: Steadiness, range: string, text: string) =>
    `<div class="sx-card"><p><i class="sd sd-${band}"></i><b class="sd-t-${band}">${bandName(band)}</b> <span class="sx-note">${range}</span></p><p>${text}</p></div>`;
  return `<details class="sx-pop sx-key"><summary class="sx-btn">${tr("Steadiness")} ${icon("info")} <span class="sx-dots"><i class="sd sd-steady"></i>${tr("steady")} <i class="sd sd-mixed"></i>${tr("mixed")} <i class="sd sd-erratic"></i>${tr("erratic")}</span></summary>
<div class="sx-panel sx-right">
<p class="sx-h">${tr("Funding steadiness")}</p>
<p>${tr("How often a leg's funding kept its direction over the last 30 days: the dot beside each exchange in the Long and Short columns. The Stability column is the weaker leg's score.")}</p>
${card("steady", `≥ ${STEADY_FROM.toFixed(2)}`, tr("Holds its direction almost every day. Income you can plan on."))}
${card("mixed", `${MIXED_FROM.toFixed(2)}–${STEADY_FROM.toFixed(2)}`, tr("Flips now and then. Usable for a carry, but size for the days it pays the other way."))}
${card("erratic", `< ${MIXED_FROM.toFixed(2)}`, tr("Flips often. Today's rate says little about next week's, and a backtest of it says less."))}
<p class="sx-note">${tr("Scored by direction, not by the coefficient of variation: that explodes whenever the average rate sits near zero. 0.50 is a coin flip; 0.88 is the most a full month can score.")}</p>
</div></details>`;
}

/**
 * The screener's control bar, above its table. `f` is the view the page shows; every link and the
 * form carry it, so changing one control keeps the others.
 */
export function screenerControls(f: ScreenerFilters): string {
  const periods = PERIODS.map(
    (p) =>
      `<a href="/screener${esc(filtersToQuery({ ...f, sort: p.sort }))}"${p.sort === f.sort ? ' aria-current="true"' : ""}>${p.label === "Now" ? tr("Now") : p.label}</a>`,
  ).join("");
  const units = UNITS.map(
    (u) =>
      `<a href="/screener${esc(filtersToQuery({ ...f, unit: u }))}"${u === f.unit ? ' aria-current="true"' : ""}>${unitLabel(u)}</a>`,
  ).join("");
  return `<form class="sx" method="get" action="/screener" data-sx>
<div class="sx-bar">
<label class="sx-search">${icon("search")}<input type="search" name="q" value="${esc(f.query ?? "")}" data-default="" placeholder="${esc(tr("Search asset…"))}" aria-label="${esc(tr("Search asset"))}" autocomplete="off" spellcheck="false"></label>
<nav class="seg seg-links" aria-label="${esc(tr("Period"))}">${periods}</nav>
<nav class="seg seg-links" aria-label="${esc(tr("Rate unit"))}">${units}</nav>
${venuesPanel(f)}
${filtersPanel(f)}
${steadinessKey()}
</div>
<input type="hidden" name="sort" value="${esc(f.sort)}" data-default="${DEFAULT_FILTERS.sort}">
<input type="hidden" name="unit" value="${esc(f.unit)}" data-default="${DEFAULT_FILTERS.unit}">
</form>`;
}

/**
 * The bar's script. Without it every control still submits; with it:
 *   - one dropdown open at a time, closed by a click elsewhere or Escape;
 *   - select all / clear, for every exchange or one type, and the counts that follow them;
 *   - presets: named sets of exchanges, kept in this browser only (a convenience, not an account);
 *   - the dollar chips fill their box;
 *   - typing in the search hides rows that do not match at once; Enter asks the server;
 *   - on submit, a value at its default is left out, and the exchanges go as one list (or none when
 *     every one is ticked), so the address stays short enough to share.
 * No backticks or dollar-brace in the script's own code: it is a template literal's text. The one
 * interpolation is the close icon's markup, put in at build time.
 */
export const SCREENER_SCRIPT = `(() => {
  const form = document.querySelector("form[data-sx]");
  if (!form) return;
  for (const el of form.querySelectorAll("[data-js-only]")) el.hidden = false;
  const pops = () => [...form.querySelectorAll(".sx-pop")];
  form.addEventListener("toggle", (e) => {
    if (e.target.open) for (const p of pops()) if (p !== e.target) p.open = false;
  }, true);
  document.addEventListener("click", (e) => {
    for (const p of pops()) if (p.open && !p.contains(e.target)) p.open = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const p of pops()) if (p.open) { p.open = false; p.querySelector("summary").focus(); }
  });

  const boxes = (type) => [...form.querySelectorAll(type ? "[data-sx-group='" + type + "'] input[name=venues]" : "input[name=venues]")];
  const count = () => {
    const all = boxes("");
    const on = all.filter((b) => b.checked).length;
    const text = on + "/" + all.length;
    for (const el of form.querySelectorAll("[data-sx-total],[data-sx-count]")) el.textContent = text;
    for (const g of form.querySelectorAll("[data-sx-group]")) {
      g.querySelector("[data-sx-n]").textContent = boxes(g.dataset.sxGroup).filter((b) => b.checked).length;
    }
  };
  form.addEventListener("change", (e) => { if (e.target.name === "venues") count(); });

  const KEY = "airrates.venuePresets";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch { return []; } };
  const store = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };
  const shelf = form.querySelector("[data-sx-presets]");
  const draw = () => {
    if (!shelf) return;
    const list = load();
    const none = shelf.querySelector(".sx-note");
    for (const el of shelf.querySelectorAll(".sx-preset")) el.remove();
    none.hidden = list.length > 0;
    for (const p of list) {
      const wrap = document.createElement("span");
      wrap.className = "sx-preset";
      const use = document.createElement("button");
      use.type = "button"; use.className = "chip"; use.textContent = p.name + " (" + p.venues.length + ")";
      use.addEventListener("click", () => {
        const want = new Set(p.venues);
        for (const b of boxes("")) b.checked = want.has(b.value);
        count();
      });
      const drop = document.createElement("button");
      drop.type = "button"; drop.className = "lnk sx-drop"; drop.innerHTML = '${icon("close")}';
      drop.setAttribute("aria-label", drop.title = shelf.dataset.dropLabel || "Delete");
      drop.addEventListener("click", () => { store(load().filter((q) => q.name !== p.name)); draw(); });
      wrap.append(use, drop);
      shelf.append(wrap);
    }
  };
  draw();
  const name = form.querySelector("[data-sx-preset-name]");
  const save = () => {
    const label = (name.value || "").trim().slice(0, 32);
    if (!label) return name.focus();
    const venues = boxes("").filter((b) => b.checked).map((b) => b.value);
    store([...load().filter((q) => q.name !== label), { name: label, venues }].slice(-12));
    name.value = "";
    draw();
  };
  form.querySelector("[data-sx-preset-save]")?.addEventListener("click", save);
  name?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } });

  form.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.sxTick !== undefined || t.dataset.sxUntick !== undefined) {
      const on = t.dataset.sxTick !== undefined;
      for (const b of boxes(on ? t.dataset.sxTick : t.dataset.sxUntick)) b.checked = on;
      count();
    } else if (t.dataset.sxSet) {
      const box = form.querySelector("input[name='" + t.dataset.sxSet + "']");
      box.value = t.value;
      for (const c of t.parentNode.children) c.classList.toggle("on", c === t);
    }
  });

  const rows = () => [...document.querySelectorAll("tbody[data-live=pairs] tr[data-k]")];
  const search = form.querySelector("input[name=q]");
  const sift = () => {
    const words = search.value.trim().toLowerCase();
    // A row's key is "equity:SPY" for anything but crypto; match the asset, never the class.
    for (const r of rows()) r.hidden = words !== "" && !r.dataset.k.replace(/^[a-z]+:/, "").toLowerCase().includes(words);
  };
  search.addEventListener("input", sift);
  // The live refresh swaps the table's rows every so often; a search still typed keeps them sifted.
  const table = document.querySelector("tbody[data-live=pairs]")?.closest("table");
  if (table && window.MutationObserver) new MutationObserver(sift).observe(table, { childList: true, subtree: true });

  form.addEventListener("submit", () => {
    const all = boxes("");
    const on = all.filter((b) => b.checked).map((b) => b.value);
    for (const b of all) b.disabled = true;
    if (on.length > 0 && on.length < all.length) {
      const list = document.createElement("input");
      list.type = "hidden"; list.name = "venues"; list.value = on.join(",");
      form.append(list);
    }
    for (const el of form.elements) {
      if (!el.name || el.disabled || el.dataset.default === undefined) continue;
      if ((el.type === "radio" && el.checked) || (el.type !== "radio" && el.type !== "checkbox")) {
        if (el.value.trim() === el.dataset.default) el.disabled = true;
      }
    }
    // Disabled controls are not sent; re-enable them if the page is restored from the back cache.
    addEventListener("pageshow", () => { for (const el of form.elements) el.disabled = false; }, { once: true });
  });
})();`;
