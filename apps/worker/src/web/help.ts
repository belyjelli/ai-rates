/**
 * The "?" beside a heading, and the panel it opens: where a page keeps the paragraph that explains it.
 *
 * WHY. Every page opened on a lede of two to six sentences between its title and its controls, so the
 * first screen was mostly prose a returning reader had already read. The text is still worth having,
 * so it moves rather than goes: one badge beside the title, and the same words a hover or a tap away.
 *
 * HOW IT OPENS. The browser's own popover: `popovertarget` on the button, `popover` on the panel. That
 * gives, with no script at all, a tap to open on a phone, light dismiss (a click elsewhere, Escape),
 * one open panel at a time, the top layer above the sticky masthead, and `aria-expanded` kept on the
 * button. HELP_SCRIPT adds what the platform lacks: hover for a mouse, placement beside the badge in
 * browsers without CSS anchor positioning, and on a phone a full-width box in the page instead.
 *
 * WHERE IT MAY GO. Never inside a `data-live` region: live refresh swaps a region's children, which
 * would close an open panel under the reader's cursor and replace the text they were reading. The
 * text inside is the page's own explanation, so it is static by nature; a figure that refreshes stays
 * outside, in the page.
 *
 * The panel is outside the heading on purpose: a heading may hold only phrasing content, and the
 * panel holds paragraphs. `helpHeading` writes both; `helpButton` and `helpPanel` are the parts, for
 * a badge that sits beside something other than a heading (a chart title, an eyebrow).
 */

import { esc } from "./format";
import { tr } from "./i18n";

/** The badge. `id` names its panel, and must be unique on the page. */
export function helpButton(id: string): string {
  const target = `help-${id}`;
  return `<button type="button" class="help" popovertarget="${esc(target)}" style="anchor-name:--${esc(target)}" aria-label="${tr("What is this?")}" data-help>?</button>`;
}

/** The panel. `content` is markup -- the paragraphs the page used to show under its title. */
export function helpPanel(id: string, content: string): string {
  const target = `help-${id}`;
  return `<div class="help-pop" id="${esc(target)}" popover style="position-anchor:--${esc(target)}"><p class="help-head">${tr("About this page")}</p><div class="help-body">${content}</div></div>`;
}

/** A heading with its badge, and the panel after it. `heading` is markup, as the caller wrote it. */
export function helpHeading(
  tag: "h1" | "h2",
  heading: string,
  id: string,
  content: string,
  attrs = "",
): string {
  return `<${tag}${attrs} class="has-help">${heading}${helpButton(id)}</${tag}>${helpPanel(id, content)}`;
}

/**
 * Square, like everything else on the site. The panel is a terminal pane: the accent rule across its
 * top that the masthead's share card also uses, a deep shadow to lift it off the sheet below, and a
 * measure narrow enough to read in one glance. It fades and drops in, unless motion is reduced.
 */
export const HELP_CSS = `
.has-help{display:flex;align-items:center;gap:8px}
.help{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:16px;height:16px;padding:0;font:700 11px/1 var(--mono);letter-spacing:0;text-transform:none;color:var(--muted);background:transparent;border:1px solid var(--dim);cursor:help;vertical-align:middle}
.help:hover,.help:focus-visible{color:var(--accent);border-color:var(--accent);background:transparent}
.help[aria-expanded=true]{color:var(--bg);background:var(--accent);border-color:var(--accent)}
.help-pop{width:min(46ch,calc(100vw - 24px));max-height:min(70vh,520px);overflow:auto;margin:auto;padding:10px 14px 12px;color:var(--ink);background:linear-gradient(180deg,#121212,#0a0a0a);border:1px solid var(--rule);border-top:2px solid var(--accent);box-shadow:0 14px 44px rgba(0,0,0,.75),0 0 0 1px rgba(200,245,168,.06);font:12px/1.55 var(--mono);text-transform:none;letter-spacing:0;text-align:left;
opacity:0;transform:translateY(-4px);transition:opacity .14s ease-out,transform .14s ease-out,overlay .14s allow-discrete,display .14s allow-discrete}
.help-pop:popover-open{opacity:1;transform:none}
@starting-style{.help-pop:popover-open{opacity:0;transform:translateY(-4px)}}
.help-pop::backdrop{background:transparent}
.help-head{margin:0 0 6px;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.help-head::before{content:"? ";color:var(--accent)}
.help-body p{margin:0}
/* What stays in the page beside a panel is a live line (an age, an as-of), empty until there is one. */
.notes:empty{display:none}
.help-body p+p{margin-top:8px}
.help-body .lede,.help-body .notes,.help-body .fchart-note{max-width:none;margin:0;color:var(--ink)}
@supports (anchor-name:--a){.help-pop{margin:0;inset:auto;top:anchor(bottom);left:anchor(left);margin-top:6px;position-try-fallbacks:flip-inline,flip-block,flip-block flip-inline}}
/* Phones and narrow screens: the same panel, opened in the page as a full-width box (HELP_SCRIPT). */
.help-pop.help-inline{position:static;display:block;width:auto;max-width:none;max-height:none;overflow:visible;margin:4px 0 12px;inset:auto;opacity:1;transform:none;transition:none;box-shadow:0 8px 24px rgba(0,0,0,.5);animation:help-open .16s ease-out}
.help-pop.help-inline[hidden]{display:none}
@keyframes help-open{from{opacity:0;transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.help-pop{transition:none;transform:none}.help-pop.help-inline{animation:none}}
`;

/**
 * Two shapes, one markup. With a mouse on a wide screen the panel FLOATS beside its badge: hover opens
 * it, and a click on a panel hover opened pins it instead of closing it, so the gestures never fight.
 * On a phone, a tablet or any screen at or under the site's 860px breakpoint it EXPANDS instead: the
 * script takes the panel out of the popover layer and opens it in the page as a full-width box under
 * the heading, pushing the page down, because a floating pane on a phone covers the very table it
 * explains and has nowhere to sit. Without the script a floating popover still opens on a tap.
 *
 * The browser's own popover keeps light dismiss and one-at-a-time for the float; the expanded box
 * stays open until its badge is tapped again, like any disclosure.
 */
export const HELP_SCRIPT = `(() => {
  const desktop = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 861px)").matches;
  const panelOf = (b) => document.getElementById(b.dataset.helpFor || b.getAttribute("popovertarget"));

  if (!desktop) {
    for (const b of document.querySelectorAll("[data-help]")) {
      const p = panelOf(b);
      if (!p) continue;
      b.dataset.helpFor = p.id;
      b.removeAttribute("popovertarget");
      b.setAttribute("aria-controls", p.id);
      b.setAttribute("aria-expanded", "false");
      p.removeAttribute("popover");
      p.classList.add("help-inline");
      p.hidden = true;
    }
    document.addEventListener("click", (e) => {
      const b = e.target instanceof Element && e.target.closest("[data-help]");
      if (!b) return;
      const p = panelOf(b);
      if (!p) return;
      p.hidden = !p.hidden;
      b.setAttribute("aria-expanded", String(!p.hidden));
    });
    return;
  }

  const anchored = CSS.supports("anchor-name", "--a");
  const place = (b, p) => {
    if (anchored) return;
    const r = b.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
    const x = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    let y = r.bottom + 6;
    if (y + h > innerHeight - 8 && r.top - h - 6 > 8) y = r.top - h - 6;
    p.style.margin = "0"; p.style.inset = "auto"; p.style.left = x + "px"; p.style.top = y + "px";
  };
  const pinned = new WeakSet(), timers = new WeakMap();
  const after = (p, f, ms) => { clearTimeout(timers.get(p)); timers.set(p, setTimeout(f, ms)); };

  document.addEventListener("toggle", (e) => {
    const p = e.target;
    if (!(p instanceof HTMLElement) || !p.classList.contains("help-pop")) return;
    if (e.newState === "open") {
      const b = document.querySelector('[popovertarget="' + p.id + '"]');
      if (b) place(b, p);
    } else pinned.delete(p);
  }, true);

  document.addEventListener("click", (e) => {
    const b = e.target instanceof Element && e.target.closest("[data-help]");
    if (!b) return;
    const p = panelOf(b);
    if (p && p.matches(":popover-open") && !pinned.has(p)) { e.preventDefault(); pinned.add(p); }
  });

  document.addEventListener("mouseover", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const b = t.closest("[data-help]");
    if (b) {
      const p = panelOf(b);
      if (p) after(p, () => { if (!p.matches(":popover-open")) p.showPopover(); }, 120);
      return;
    }
    const p = t.closest(".help-pop");
    if (p) clearTimeout(timers.get(p));
  });

  document.addEventListener("mouseout", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const b = t.closest("[data-help]");
    const p = b ? panelOf(b) : t.closest(".help-pop");
    if (!p) return;
    const to = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    if (to && (p.contains(to) || (b && b.contains(to)))) return;
    after(p, () => {
      if (!pinned.has(p) && p.matches(":popover-open") && !p.matches(":hover")) p.hidePopover();
    }, 220);
  });
})();`;
