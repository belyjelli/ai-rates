import type { Venue } from "@ai-rates/venues";
import { VENUE_TYPES } from "../app/params";
import { esc } from "./format";
import { tr } from "./i18n";
import { icon } from "./icons";
import { VENUE_TYPE_SHORT } from "./venues";

/**
 * The exchange picker the screener and the backtest share: a dropdown (details.sx-pop) of exchange
 * tiles grouped CEX / DEX / HIP-3, each group with "all" and "clear", a running count and, for a
 * multiple choice, named presets kept in the browser. Styled by .sx-* in layout.ts.
 *
 * A checkbox picker chooses a set (the screener's exchanges, the backtest chart's lines); a radio
 * picker chooses one (a backtest leg), and shows that one on its button. The inputs carry `name`
 * only where a form should send them: the chart filter's are the page's own business.
 *
 * Markup contract with PICKER_SCRIPT: details[data-vp] holds the tiles' inputs, each group is
 * [data-vp-group=<type>] with its count in [data-vp-n], the totals are [data-vp-count], the presets
 * shelf is [data-vp-presets], and a radio picker's chosen name is [data-vp-current].
 */
export interface VenuePickerOptions {
  /** What the button says before the count or choice: "Exchanges", "Long". */
  label: string;
  /** The icon before it, if any. */
  lead?: string;
  venues: readonly Venue[];
  type: "checkbox" | "radio";
  /** The form field the inputs send, or none for a picker the page reads itself. */
  name?: string;
  checked: (venue: Venue) => boolean;
  /** Extra attributes on a tile's input: the chart picker marks the legs' with data-leg. */
  inputAttrs?: (venue: Venue) => string;
  /** Markup at the tile's right edge: a leg picker shows each exchange's funding now. */
  meta?: (venue: Venue) => string;
  /** A line above the tiles, plain text: the screener's says quarantined exchanges are left out. */
  note?: string;
  /** Markup closing the panel: Apply, a link. */
  foot?: string;
  /** Extra attributes on the details element. */
  attrs?: string;
  /** Extra classes on the panel (sx-right to open leftwards). */
  panelClass?: string;
}

/**
 * A quarantined exchange's tag on its tile: still listed and pickable, but left out of the default
 * rankings, with the dated evidence (packages/venues `quarantined`) as the tag's title.
 */
function quarantineTag(v: Venue): string {
  if (!v.quarantined) return "";
  const evidence = v.quarantined.replace(/^\d{4}-\d{2}-\d{2}:\s*/, "");
  return `<span class="vp-q" title="${esc(evidence)}">${tr("quarantined")}</span>`;
}

/** The venues by type, CEX then DEX then HIP-3, each in name order; empty groups left out. */
export function groupVenues(venues: readonly Venue[]): [string, Venue[]][] {
  const sorted = [...venues].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
  return VENUE_TYPES.map(
    (type) => [type, sorted.filter((v) => v.type === type)] as [string, Venue[]],
  ).filter(([, group]) => group.length > 0);
}

export function venuePicker(o: VenuePickerOptions): string {
  const multiple = o.type === "checkbox";
  const groups = groupVenues(o.venues);
  const total = o.venues.length;
  const ticked = o.venues.filter(o.checked).length;
  const name = o.name ? ` name="${esc(o.name)}"` : "";
  const body = groups
    .map(([type, venues]) => {
      const tiles = venues
        .map(
          (v) =>
            `<label class="sx-tile"><input type="${o.type}"${name} value="${esc(v.id)}" data-vp-name="${esc(v.name)}"${o.inputAttrs?.(v) ?? ""}${o.checked(v) ? " checked" : ""}><span class="mono">${esc(v.name.slice(0, 1).toUpperCase())}</span><span class="nm">${esc(v.name)}</span>${quarantineTag(v)}${o.meta ? `<span class="vp-meta">${o.meta(v)}</span>` : ""}</label>`,
        )
        .join("");
      const counts = multiple
        ? ` (<b data-vp-n>${venues.filter(o.checked).length}</b>/${venues.length})`
        : "";
      const bulk = multiple
        ? `<span data-js-only hidden><button type="button" class="lnk" data-vp-tick="${type}">${tr("all")}</button> <button type="button" class="lnk" data-vp-untick="${type}">${tr("clear")}</button></span>`
        : "";
      return `<div class="sx-group" data-vp-group="${type}"><p class="sx-gh"><span>${VENUE_TYPE_SHORT[type] ?? esc(type)}${counts}</span>${bulk}</p><div class="sx-tiles">${tiles}</div></div>`;
    })
    .join("");
  const chosen = o.venues.find(o.checked);
  const summary = multiple
    ? `<b data-vp-count>${ticked}/${total}</b>`
    : `<b data-vp-current>${chosen ? esc(chosen.name) : tr("pick one")}</b>`;
  const head = multiple
    ? `<div class="sx-sect" data-js-only hidden><p class="sx-h">${tr("Presets")}</p><div class="sx-presets" data-vp-presets data-drop-label="${esc(tr("Delete preset"))}"><span class="sx-note">${tr("No presets yet.")}</span></div>
<div class="sx-save"><input type="text" maxlength="32" placeholder="${esc(tr("Preset name…"))}" data-vp-preset-name aria-label="${esc(tr("Preset name"))}"><button type="button" class="ghost" data-vp-preset-save>${icon("plus")} ${tr("Save")}</button></div></div>
<p class="sx-all"><span data-js-only hidden><button type="button" class="lnk" data-vp-tick="">${tr("Select all")}</button> / <button type="button" class="lnk" data-vp-untick="">${tr("Clear all")}</button></span><span class="sx-note">${tr("{n} selected", { n: `<b data-vp-count>${ticked}/${total}</b>` })}</span></p>`
    : "";
  const note = o.note ? `<p class="sx-note vp-note">${esc(o.note)}</p>` : "";
  return `<details class="sx-pop" data-vp="${o.type}"${o.attrs ?? ""}><summary class="sx-btn">${[o.lead, o.label, summary].filter(Boolean).join(" ")}${icon("caret")}</summary>
<div class="sx-panel sx-wide${o.panelClass ? ` ${o.panelClass}` : ""}">
${head}${note}${body}${o.foot ? `\n<div class="sx-foot">${o.foot}</div>` : ""}
</div></details>`;
}

/**
 * Every picker's behaviour, delegated from the document so a picker swapped in later (the backtest
 * replaces its view in place) works without binding again; `window.airratesPicker(root)` draws the
 * presets shelf of a picker that arrives later. Once per page, however many pickers.
 *   - one dropdown open at a time, closed by a click elsewhere or Escape;
 *   - "all" / "clear" for every exchange or one type, and the counts that follow;
 *   - a radio picker shows its choice on its button and closes;
 *   - presets: named sets of exchanges, in this browser only (a convenience, not an account), shared
 *     by every multiple picker on the site.
 * Each change is an ordinary `change` event on the input, which the page's own script reads.
 * No backticks or dollar-brace in the script's own code; the close icon is put in at build time.
 */
export const PICKER_SCRIPT = `(() => {
  if (window.airratesPicker) return;
  for (const el of document.querySelectorAll("[data-js-only]")) el.hidden = false;
  const pops = () => [...document.querySelectorAll(".sx-pop")];
  document.addEventListener("toggle", (e) => {
    if (e.target.classList && e.target.classList.contains("sx-pop") && e.target.open) {
      for (const p of pops()) if (p !== e.target) p.open = false;
    }
  }, true);
  document.addEventListener("click", (e) => {
    for (const p of pops()) if (p.open && !p.contains(e.target)) p.open = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const p of pops()) if (p.open) { p.open = false; p.querySelector("summary").focus(); }
  });

  const boxes = (picker, type) => [...picker.querySelectorAll(type ? "[data-vp-group='" + type + "'] .sx-tile input" : ".sx-tile input")];
  const count = (picker) => {
    const all = boxes(picker, "");
    const text = all.filter((b) => b.checked).length + "/" + all.length;
    for (const el of picker.querySelectorAll("[data-vp-count]")) el.textContent = text;
    for (const g of picker.querySelectorAll("[data-vp-group]")) {
      const n = g.querySelector("[data-vp-n]");
      if (n) n.textContent = boxes(picker, g.dataset.vpGroup).filter((b) => b.checked).length;
    }
  };
  const announce = (input) => input.dispatchEvent(new Event("change", { bubbles: true }));
  document.addEventListener("change", (e) => {
    const picker = e.target.closest && e.target.closest("[data-vp]");
    if (!picker || !e.target.matches(".sx-tile input")) return;
    if (picker.dataset.vp === "radio") {
      const current = picker.querySelector("[data-vp-current]");
      if (current) current.textContent = e.target.dataset.vpName;
      picker.open = false;
    } else count(picker);
  });

  const KEY = "airrates.venuePresets";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch { return []; } };
  const store = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };
  const apply = (picker, ids) => {
    const want = new Set(ids);
    let first = null;
    for (const b of boxes(picker, "")) {
      if (b.checked !== want.has(b.value)) { b.checked = want.has(b.value); first = first || b; }
    }
    count(picker);
    if (first) announce(first);
  };
  const draw = (picker) => {
    const shelf = picker.querySelector("[data-vp-presets]");
    if (!shelf) return;
    const none = shelf.querySelector(".sx-note");
    for (const el of shelf.querySelectorAll(".sx-preset")) el.remove();
    const list = load();
    none.hidden = list.length > 0;
    for (const p of list) {
      const wrap = document.createElement("span");
      wrap.className = "sx-preset";
      const use = document.createElement("button");
      use.type = "button"; use.className = "chip"; use.textContent = p.name + " (" + p.venues.length + ")";
      use.addEventListener("click", () => apply(picker, p.venues));
      const drop = document.createElement("button");
      drop.type = "button"; drop.className = "lnk sx-drop"; drop.innerHTML = '${icon("close")}';
      drop.setAttribute("aria-label", drop.title = shelf.dataset.dropLabel || "Delete");
      drop.addEventListener("click", () => { store(load().filter((q) => q.name !== p.name)); drawAll(); });
      wrap.append(use, drop);
      shelf.append(wrap);
    }
  };
  const drawAll = () => { for (const picker of document.querySelectorAll("[data-vp=checkbox]")) draw(picker); };
  const save = (picker) => {
    const name = picker.querySelector("[data-vp-preset-name]");
    const label = (name.value || "").trim().slice(0, 32);
    if (!label) return name.focus();
    const venues = boxes(picker, "").filter((b) => b.checked).map((b) => b.value);
    store([...load().filter((q) => q.name !== label), { name: label, venues }].slice(-12));
    name.value = "";
    drawAll();
  };
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("button");
    const picker = t && t.closest("[data-vp]");
    if (!picker) return;
    if (t.dataset.vpTick !== undefined || t.dataset.vpUntick !== undefined) {
      const on = t.dataset.vpTick !== undefined;
      const changed = boxes(picker, on ? t.dataset.vpTick : t.dataset.vpUntick).filter((b) => b.checked !== on);
      for (const b of changed) b.checked = on;
      count(picker);
      if (changed[0]) announce(changed[0]);
    } else if (t.hasAttribute("data-vp-preset-save")) save(picker);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.matches || !e.target.matches("[data-vp-preset-name]")) return;
    e.preventDefault();
    save(e.target.closest("[data-vp]"));
  });

  window.airratesPicker = (root) => {
    for (const el of root.querySelectorAll("[data-js-only]")) el.hidden = false;
    for (const picker of root.querySelectorAll("[data-vp=checkbox]")) draw(picker);
  };
  drawAll();
})();`;
