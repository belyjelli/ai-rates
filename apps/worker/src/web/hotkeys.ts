/**
 * The site's keyboard shortcuts: what each one does, the key it has out of the box, and the script
 * every page runs to answer them.
 *
 * ONE LIST. The status-bar legend, the keyboard page (/keys) and the script all read ACTIONS, so a key
 * cannot be advertised and do nothing, or work without being shown. An action with no `key` exists
 * but is unbound until a reader binds it on /keys.
 *
 * PROFILES belong to a member. Anyone may read the map on /keys and use the default keys; remapping
 * them needs a login, and the profiles are kept on the member's account in the member area
 * (HOTKEYS_API), so they follow the member to any browser. /keys loads them from there and copies the
 * active set into this browser's localStorage under STORE_KEY, which is all the other pages read: a
 * page view never waits on the member area. The copy is refreshed whenever /keys is opened, and
 * dropped when /keys finds the reader signed out. The shape, there and here, is
 * `{ active: "<name>", profiles: { "<name>": { "<action id>": "<key>" } } }`; an empty `active` means
 * the built-in default set below.
 *
 * KEYS ARE `KeyboardEvent.key` VALUES, letters folded to lower case, so Shift+R is R and "?" is its own
 * key. That follows the character a reader sees on their own keycap, which suits a non-US layout
 * better than physical key codes would.
 */

import { msg, trMsg } from "./i18n";

/**
 * What an action is for, which is also its colour on the keyboard page -- Bloomberg's own scheme:
 * green to go somewhere, amber to act on the page, red to cancel, blue for the keyboard map itself.
 */
export type HotkeyGroup = "go" | "page" | "cancel" | "map";

export interface HotkeyAction {
  id: string;
  /** Marked with `msg`; shown through `trMsg`. */
  label: string;
  group: HotkeyGroup;
  /** Where a "go" action leads. */
  href?: string;
  /** The default key, or "" for an action that ships unbound. */
  key: string;
  /** Shown in the status bar, as the destinations and the filter always were. */
  legend?: boolean;
}

export const ACTIONS: readonly HotkeyAction[] = [
  { id: "spreads", label: msg("spreads"), group: "go", href: "/", key: "h", legend: true },
  {
    id: "screener",
    label: msg("screener"),
    group: "go",
    href: "/screener",
    key: "s",
    legend: true,
  },
  { id: "rates", label: msg("rates"), group: "go", href: "/rates", key: "r", legend: true },
  {
    id: "arbitrage",
    label: msg("arbitrage"),
    group: "go",
    href: "/arbitrage",
    key: "a",
    legend: true,
  },
  {
    id: "liquidations",
    label: msg("liquidations"),
    group: "go",
    href: "/liquidations",
    key: "l",
    legend: true,
  },
  { id: "cvd", label: msg("cvd"), group: "go", href: "/cvd", key: "c", legend: true },
  { id: "whales", label: msg("whales"), group: "go", href: "/whales", key: "w", legend: true },
  {
    id: "exchanges",
    label: msg("exchanges"),
    group: "go",
    href: "/markets",
    key: "e",
    legend: true,
  },
  { id: "sentiment", label: msg("sentiment"), group: "go", href: "/sentiment", key: "" },
  { id: "status", label: msg("status"), group: "go", href: "/status", key: "" },
  { id: "docs", label: msg("API docs"), group: "go", href: "/docs", key: "" },
  { id: "about", label: msg("about"), group: "go", href: "/about", key: "" },
  { id: "filter", label: msg("filter"), group: "page", key: "/", legend: true },
  { id: "prev-tab", label: msg("previous tab"), group: "page", key: "[" },
  { id: "next-tab", label: msg("next tab"), group: "page", key: "]" },
  { id: "top", label: msg("back to top"), group: "page", key: "" },
  { id: "cancel", label: msg("leave field"), group: "cancel", key: "Escape" },
  { id: "keys", label: msg("keyboard map"), group: "map", href: "/keys", key: "?", legend: true },
];

/** This browser's copy of a member's profiles. */
export const STORE_KEY = "airrates:keys";

/** Where a member's profiles live: the member area, which knows who is signed in. */
export const HOTKEYS_API = "https://member.airrates.net/api/hotkeys";

/** A key as a keycap prints it: "R", "Esc", "F2", "/". */
export function keyCap(key: string): string {
  if (key === "Escape") return "Esc";
  return key.length === 1 ? key.toUpperCase() : key;
}

/** A value as a literal that is safe inside `<script>`, escaped as i18n's scriptStrings is. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

/** The fields of ACTIONS a browser script needs, by id, with labels in the page's language. */
export function scriptActions(): string {
  return scriptJson(
    Object.fromEntries(
      ACTIONS.map((action) => [
        action.id,
        {
          key: action.key,
          href: action.href ?? "",
          group: action.group,
          label: trMsg(action.label),
        },
      ]),
    ),
  );
}

/** The status-bar legend, in the default keys; the page script redraws it for a custom profile. */
export function hotkeyLegend(): string {
  return ACTIONS.filter((action) => action.legend)
    .map(
      (action) => `<span data-act="${action.id}"><b>${action.key}</b>${trMsg(action.label)}</span>`,
    )
    .join("");
}

/**
 * The fields a page's filter key focuses, first match wins: the screener-style filter form, else the
 * CVD search box.
 */
const FILTER_TARGET = "form.filters select,form.filters input,form.cvd-search input[type=search]";

/**
 * The script every page runs: read the reader's active profile, redraw the legend if it is not the
 * default, and answer the keys. Ctrl, Alt and Cmd combinations are always the browser's. In a text
 * field only the cancel action is heard, and only when it sits on a named key (Escape, F2), since a
 * letter there is typing. The keyboard page (#kb) answers keys itself, so a reader trying a key there
 * is shown what it does instead of being taken away.
 */
export function hotkeyScript(): string {
  return `(()=>{if(document.getElementById("kb"))return;const A=${scriptActions()};let P=null;try{const s=JSON.parse(localStorage.getItem(${JSON.stringify(STORE_KEY)})||"null");P=s&&s.profiles&&s.profiles[s.active]||null}catch(e){}const K={};for(const id in A)if(A[id].key&&!(P&&typeof P[id]==="string"))K[A[id].key]=id;if(P)for(const id in A)if(typeof P[id]==="string"&&P[id])K[P[id]]=id;const cap=k=>k==="Escape"?"esc":k;if(P)for(const s of document.querySelectorAll(".keys [data-act]")){const id=s.dataset.act,k=typeof P[id]==="string"?P[id]:A[id].key,b=s.querySelector("b");if(!k||K[k]!==id)s.hidden=true;else if(b)b.textContent=cap(k)}addEventListener("keydown",e=>{if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;let k=e.key;if(!k)return;if(k.length===1)k=k.toLowerCase();const id=K[k],t=e.target,n=t&&t.tagName;if(n==="INPUT"||n==="SELECT"||n==="TEXTAREA"||t&&t.isContentEditable){if(id==="cancel"&&k.length>1)t.blur();return}if(!id)return;if(id==="cancel"){const f=document.activeElement;if(f&&f!==document.body&&f.blur)f.blur();return}if(id==="filter"){const q=document.querySelector(${JSON.stringify(FILTER_TARGET)});if(q){e.preventDefault();q.focus()}return}if(id==="prev-tab"||id==="next-tab"){const s=document.querySelector(".tabbar-tabs");const b=s?[...s.querySelectorAll(".btn-tab")]:[];if(b.length<2)return;e.preventDefault();const i=b.findIndex(x=>x.classList.contains("active")),j=b[(i+(id==="next-tab"?1:-1)+b.length)%b.length];j.click();j.focus();return}if(id==="top"){e.preventDefault();scrollTo({top:0});return}if(A[id].href){e.preventDefault();location.href=A[id].href}})})();`;
}

/**
 * A keyboard with its cable, after the line icon the page took its idea from: drawn here rather than
 * fetched, square-cornered like the rest of the site, in the text colour around it.
 */
export function keyboardIcon(size = 14): string {
  return `<svg class="kb-icon" viewBox="0 0 32 24" width="${Math.round((size * 32) / 24)}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M16 9V6.5c0-1.5.8-2.5 2.5-2.5h5c1.7 0 2.5-.8 2.5-2.5V1"/><rect x="1.5" y="9" width="29" height="13.5"/><path d="M5.5 13h2M10.5 13h2M15.5 13h2M20.5 13h2M25.5 13h1M5.5 18h2M10.5 18h11M25.5 18h1"/></svg>`;
}
