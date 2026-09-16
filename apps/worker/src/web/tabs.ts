import { esc } from "./format";

/**
 * The tab section header: tab buttons on the left, optional actions on the right, and one absolute
 * underline that slides to the active tab.
 *
 * Ported from Morpheum's `TabLayoutHeaderToolBar`
 * (product-app/packages/mormv1/components/smartlayout/tab-layout-header-toolbar.tsx) into the shape
 * this Worker renders in: strings, no framework, and the behaviour embedded as script text rather
 * than a React hook. The class names that carry meaning are kept — `btn-tab`, `active`, the sliding
 * indicator — so the two implementations stay recognisably the same component, and the measurement
 * is the same as `useSlidingTabIndicator`: the active button's rect against the strip's, offset by
 * the strip's scroll.
 *
 * Four decisions differ from the original, and each follows from where this one runs:
 *
 *   - **Panels render visible.** The script hides the inactive one on init. A reader with no
 *     JavaScript therefore sees every section, exactly as the page read before tabs existed, rather
 *     than one panel and some dead buttons. Nothing is `hidden` in the served HTML.
 *   - **State lives in the hash, never a query parameter.** `?tab=` would be a second edge-cache key
 *     for the same page, where params.ts works to keep exactly one; a fragment is never sent to the
 *     server, so `/status#verification` is shareable and still hits the same cached copy.
 *   - **The bar must sit outside every `[data-live]` region.** live.ts re-swaps those about every
 *     30s; a button inside one would be replaced under the reader's cursor and the active tab would
 *     reset itself. The caller is responsible for that placement, and a test pins it.
 *   - **It carries ARIA.** The original uses none; a tablist costs four attributes here and makes
 *     the control operable by keyboard, which the underline alone does not.
 *
 * The active tab is also underlined without JavaScript, by a static `border-bottom` that the script
 * clears once it takes over the sliding indicator — the same fallback the original reserves for
 * `prefers-reduced-motion`.
 */
export interface Tab {
  id: string;
  label: string;
  /** Shown instead of `label` on a narrow strip, as the original's `shortLabel` is. */
  shortLabel?: string;
  /** Rendered beside the label when above zero, as the original's `badgeCount` is. */
  badge?: number;
}

export interface TabBarOptions {
  /** Names this bar, so one page can hold more than one and the script keeps them apart. */
  name: string;
  tabs: Tab[];
  /** Marked active in the served HTML. The hash overrides it on load, when it names a real tab. */
  activeId: string;
  /** Trailing content, right-aligned in the same row: counts, links, controls. */
  actions?: string;
}

/** The header row. Panels are the caller's own markup, each carrying `data-tab-panel="<id>"`. */
export function tabBar({ name, tabs, activeId, actions }: TabBarOptions): string {
  const buttons = tabs
    .map((tab) => {
      const active = tab.id === activeId;
      const label =
        tab.shortLabel === undefined || tab.shortLabel === tab.label
          ? `<span class="tab-label">${esc(tab.label)}</span>`
          : `<span class="tab-label--full">${esc(tab.label)}</span><span class="tab-label--short" aria-hidden="true">${esc(tab.shortLabel)}</span>`;
      // A badge of zero is absent rather than "0": nothing to see reads better as nothing.
      const badge =
        tab.badge !== undefined && tab.badge > 0
          ? `<span class="tab-badge">${tab.badge.toLocaleString("en-US")}</span>`
          : "";
      return `<button type="button" role="tab" id="tab-${esc(name)}-${esc(tab.id)}" class="btn-tab${
        active ? " active" : ""
      }" data-tab="${esc(tab.id)}" aria-selected="${active}" aria-controls="panel-${esc(name)}-${esc(tab.id)}" tabindex="${
        active ? "0" : "-1"
      }">${label}${badge}</button>`;
    })
    .join("");

  return `<div class="tabbar" data-tabs="${esc(name)}">
<div class="tabbar-tabs" role="tablist" aria-label="Sections">${buttons}<span class="tab-underline" aria-hidden="true"></span></div>${
    actions ? `<div class="tabbar-actions">${actions}</div>` : ""
  }
</div>`;
}

/**
 * Drives every `[data-tabs]` bar on the page: shows one panel, slides the underline to the active
 * button, and keeps the choice in the hash.
 *
 * A template string rather than a serialised real function, for the reason await.ts and live.ts are:
 * this Worker's tsconfig carries no DOM lib, so `document`, `history` and `ResizeObserver` do not
 * typecheck in source here. Only genuinely DOM-free helpers are written as functions and
 * interpolated; anything touching a page is text, checked by the two tests that parse it.
 *
 * It must not throw on a page that has no tab bar, because it ships on all of them.
 */
export const TAB_SCRIPT = `(() => {
  const bars = document.querySelectorAll("[data-tabs]");
  if (!bars.length) return;

  bars.forEach((bar) => {
    const strip = bar.querySelector(".tabbar-tabs");
    const underline = bar.querySelector(".tab-underline");
    const buttons = Array.prototype.slice.call(bar.querySelectorAll("[data-tab]"));
    if (!strip || !buttons.length) return;
    const ids = buttons.map((b) => b.getAttribute("data-tab"));
    // Only the panels this bar owns. Panels are siblings rather than children, so they are found on
    // the document, and a second bar's panels must not be touched by this one.
    const panels = Array.prototype.slice
      .call(document.querySelectorAll("[data-tab-panel]"))
      .filter((p) => ids.indexOf(p.getAttribute("data-tab-panel")) >= 0);

    // Taking over from the no-JS fallback: the static border-bottom gives way to the indicator.
    strip.classList.add("tabbar-tabs--js");

    const move = () => {
      if (!underline) return;
      const active = buttons.filter((b) => b.classList.contains("active"))[0];
      if (!active) { underline.style.opacity = "0"; return; }
      // The same measurement as useSlidingTabIndicator: the button's box against the strip's,
      // corrected for however far the strip has been scrolled.
      const stripBox = strip.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      underline.style.transform = "translateX(" + (box.left - stripBox.left + strip.scrollLeft) + "px)";
      underline.style.width = box.width + "px";
      underline.style.opacity = "1";
    };

    const show = (id, focus) => {
      buttons.forEach((button) => {
        const on = button.getAttribute("data-tab") === id;
        button.classList.toggle("active", on);
        button.setAttribute("aria-selected", String(on));
        button.setAttribute("tabindex", on ? "0" : "-1");
        if (on && focus) button.focus();
      });
      panels.forEach((panel) => {
        panel.hidden = panel.getAttribute("data-tab-panel") !== id;
      });
      move();
    };

    const select = (id, focus) => {
      show(id, focus);
      // replaceState, not pushState: the back button should leave the page rather than walk back
      // through every tab the reader clicked on the way.
      history.replaceState(null, "", "#" + id);
    };

    // A hash naming a real tab wins over the one the server marked, so /status#verification opens
    // on verification without costing a second cache key.
    const fromHash = location.hash.replace(/^#/, "");
    const marked = buttons.filter((b) => b.classList.contains("active"))[0] || buttons[0];
    show(ids.indexOf(fromHash) >= 0 ? fromHash : marked.getAttribute("data-tab"), false);

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-tab");
        if (id) select(id, false);
      });
    });

    // Arrow keys walk the strip, as a tablist is expected to.
    strip.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const at = buttons.map((b) => b.classList.contains("active")).indexOf(true);
      const id = buttons[(at + step + buttons.length) % buttons.length].getAttribute("data-tab");
      if (id) select(id, true);
    });

    // The underline is measured, so anything that changes the strip's geometry re-measures it.
    addEventListener("resize", move, { passive: true });
    strip.addEventListener("scroll", move, { passive: true });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(move).observe(strip);
  });
})();`;
