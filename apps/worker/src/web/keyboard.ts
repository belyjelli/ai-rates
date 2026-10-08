import type { Overview } from "../app/data";
import { esc, LOCK_ICON } from "./format";
import { helpHeading } from "./help";
import {
  ACTIONS,
  HOTKEYS_API,
  type HotkeyAction,
  keyCap,
  STORE_KEY,
  scriptActions,
  scriptJson,
} from "./hotkeys";
import { msg, scriptStrings, tr, trMsg } from "./i18n";
import { layout, MEMBER_URL } from "./layout";

/**
 * The member login. It always lands a member on its own console afterwards (there is no return-to),
 * so it opens in a new tab and this page asks again when the reader comes back to it.
 */
const MEMBER_LOGIN = `${MEMBER_URL}member/login`;

/**
 * /keys: every shortcut on the site, drawn on a Bloomberg terminal keyboard, and the place a reader
 * remaps them.
 *
 * THE LAYOUT is Wikimedia Commons' "Bloomberg Terminal Keyboard" (Swapnil1101, CC BY-SA 4.0), redrawn
 * as a grid in quarter-key units: every row is 60 quarters (15 keys) wide, which is what the original's
 * rows measure to within a few pixels. Its colours carry over as meanings -- green goes somewhere, amber
 * acts on the page, red cancels, blue is the panel key -- and its top row of Bloomberg-only keys
 * (Search, News, Message...) is drawn dashed: it is the layout's character, not keys a reader has.
 *
 * WHAT IS LIVE. A key that does something is lit in its action's colour. Keys the browser or a form
 * needs (Tab, Enter, Space, Backspace, modifiers, F5/F11/F12) are drawn flat and never take an action.
 * Everything else can be bound, from the drawing or by pressing the key itself.
 *
 * NO JAVASCRIPT still gets the whole map in the default keys, server-drawn from ACTIONS; the script
 * only redraws it for a reader's own profile and adds the editing.
 */

/** One key of the drawing. `row` and `col` are 1-based grid lines; `span` is in quarter keys. */
interface Cap {
  row: number;
  col: number;
  span: number;
  /** The key value it sends, for a key an action can take. */
  key?: string;
  /** The value it sends with Shift, when that is a different printable character. */
  shift?: string;
  /** The printed name of a key no action may take. */
  name?: string;
  /** Bloomberg's own row: drawn, never pressed. */
  bbg?: boolean;
}

/** The function keys the browser keeps: reload, full screen, developer tools. */
const BROWSER_KEYS = new Set(["F5", "F11", "F12"]);

/** Whether an action may take `key`; the page script applies the same rule. */
export function bindable(key: string): boolean {
  if (key.length === 1) return key !== " ";
  return key === "Escape" || (/^F([1-9]|1[0-2])$/.test(key) && !BROWSER_KEYS.has(key));
}

/** A row of 1-wide keys from `col`, each with its shifted character when it has one. */
function run(row: number, col: number, keys: string, shifts = ""): Cap[] {
  return [...keys].map((key, index) => ({
    row,
    col: col + index * 4,
    span: 4,
    key,
    shift: shifts[index] && shifts[index] !== " " ? shifts[index] : undefined,
  }));
}

/** Four function keys from `col`, the way the original groups them. */
function fkeys(col: number, first: number): Cap[] {
  return [0, 1, 2, 3].map((index) => {
    const key = `F${first + index}`;
    return BROWSER_KEYS.has(key)
      ? { row: 2, col: col + index * 4, span: 4, name: key }
      : { row: 2, col: col + index * 4, span: 4, key };
  });
}

/** Row 3 of the grid is the gap between the function row and the main block. */
const CAPS: readonly Cap[] = [
  { row: 1, col: 9, span: 8, name: "Search", bbg: true },
  { row: 1, col: 17, span: 4, name: "Cmnd History", bbg: true },
  { row: 1, col: 21, span: 4, name: "Codes & Favorites", bbg: true },
  { row: 1, col: 27, span: 8, name: "News", bbg: true },
  { row: 1, col: 35, span: 4, name: "Quote Line", bbg: true },
  { row: 1, col: 39, span: 4, name: "Quote Function", bbg: true },
  { row: 1, col: 45, span: 8, name: "Message", bbg: true },
  { row: 1, col: 53, span: 4, name: "IB", bbg: true },
  { row: 1, col: 57, span: 4, name: "Menu", bbg: true },
  { row: 2, col: 1, span: 4, key: "Escape" },
  ...fkeys(9, 1),
  ...fkeys(27, 5),
  ...fkeys(45, 9),
  ...run(4, 1, "`1234567890-=", "~!@#$%^&*()_+"),
  { row: 4, col: 53, span: 8, name: "Backspace" },
  { row: 5, col: 1, span: 6, name: "Tab" },
  ...run(5, 7, "qwertyuiop[]", "          {}"),
  { row: 5, col: 55, span: 6, key: "\\", shift: "|" },
  { row: 6, col: 1, span: 7, name: "Caps Lock" },
  ...run(6, 8, "asdfghjkl;'", '         :"'),
  { row: 6, col: 52, span: 9, name: "Enter GO" },
  { row: 7, col: 1, span: 9, name: "Shift" },
  ...run(7, 10, "zxcvbnm,./", "       <>?"),
  { row: 7, col: 50, span: 11, name: "Shift" },
  { row: 8, col: 1, span: 7, name: "Ctrl" },
  { row: 8, col: 8, span: 4, name: "Win" },
  { row: 8, col: 12, span: 6, name: "Alt" },
  { row: 8, col: 18, span: 24, name: "" },
  { row: 8, col: 42, span: 4, name: "Alt" },
  { row: 8, col: 46, span: 4, name: "Panel" },
  { row: 8, col: 50, span: 4, name: "Menu" },
  { row: 8, col: 54, span: 7, name: "Ctrl" },
];

/** Every key value the drawing can bind, for the test that checks each default key is on it. */
export const DRAWN_KEYS: readonly string[] = CAPS.flatMap((cap) =>
  cap.key ? [cap.key, ...(cap.shift ? [cap.shift] : [])] : [],
);

/** Default key to its action. */
const DEFAULT_BY_KEY = new Map(ACTIONS.filter((a) => a.key).map((a) => [a.key, a]));

const area = (cap: Cap) => `grid-area:${cap.row}/${cap.col}/span 1/span ${cap.span}`;

/** One key of the drawing, lit for its default action. The script redraws it for a profile. */
function capHtml(cap: Cap): string {
  if (!cap.key) {
    const kind = cap.bbg ? "bbg" : "fixed";
    const why = cap.bbg
      ? tr("A Bloomberg terminal key; a standard keyboard has none")
      : tr("Kept for the browser and for typing");
    return `<div class="cap ${kind}" style="${area(cap)}" title="${esc(why)}"><span class="cap-name">${esc(cap.name ?? "")}</span></div>`;
  }
  const base = DEFAULT_BY_KEY.get(cap.key);
  const shifted = cap.shift ? DEFAULT_BY_KEY.get(cap.shift) : undefined;
  const tone = (base ?? shifted)?.group;
  const legend = cap.shift
    ? `<i>${esc(cap.shift)}</i><i>${esc(cap.key)}</i>`
    : esc(keyCap(cap.key));
  return `<button type="button" class="cap${tone ? ` t-${tone}` : ""}${cap.shift ? " two" : ""}" style="${area(cap)}" data-k="${esc(cap.key)}"${cap.shift ? ` data-s="${esc(cap.shift)}"` : ""} aria-label="${esc(keyCap(cap.key))}"><span class="cap-key">${legend}</span><span class="cap-sact">${shifted ? `⇧ ${esc(trMsg(shifted.label))}` : ""}</span><span class="cap-act">${base ? esc(trMsg(base.label)) : ""}</span></button>`;
}

/** Marked here, translated at render: a module-level `tr` would run before any language is set. */
const GROUP_HEADS: Record<HotkeyAction["group"], string> = {
  go: msg("Go to a page"),
  page: msg("On the page"),
  cancel: msg("In a text field"),
  map: msg("This map"),
};

/** The action list: every action, its key, and the buttons that change it. */
function actionRows(): string {
  const groups: HotkeyAction["group"][] = ["go", "page", "cancel", "map"];
  return groups
    .map((group) => {
      const rows = ACTIONS.filter((action) => action.group === group)
        .map(
          (action) =>
            `<tr class="t-${group}" data-act="${action.id}"><td><kbd class="kb-chip">${action.key ? esc(keyCap(action.key)) : "—"}</kbd></td><td>${esc(trMsg(action.label))}</td><td class="dim">${action.href ? esc(action.href) : ""}</td><td class="kb-row-btns"><button type="button" class="kb-ghost" data-change><span class="kb-padlock">${LOCK_ICON}</span><span class="lbl">${tr("change")}</span></button> <button type="button" class="kb-ghost" data-clear><span class="kb-padlock">${LOCK_ICON}</span>${tr("clear")}</button></td></tr>`,
        )
        .join("");
      return `<tbody><tr class="kb-group"><th colspan="4">${trMsg(GROUP_HEADS[group])}</th></tr>${rows}</tbody>`;
    })
    .join("");
}

/**
 * The cable, after the "keyboard with wire" line icon this page took its idea from: it leaves the
 * middle of the chassis and loops off to the right, as a cable on a desk does.
 */
const WIRE = `<svg class="kb-wire" viewBox="0 0 240 64" preserveAspectRatio="xMinYMax meet" aria-hidden="true" focusable="false"><path d="M8 64V40c0-14 10-22 26-22h60c18 0 28-8 28-20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"/><rect x="2" y="56" width="12" height="8" fill="currentColor"/></svg>`;

const CSS = `
.kb-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 16px;margin:0 0 6px;padding:8px 10px;border:1px solid var(--rule)}
.kb-head select,.kb-head input{font:12px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule);padding:2px 4px}
.kb-head select{min-width:160px}
.kb-head input{width:20ch}
.kb-head input::placeholder{color:var(--dim)}
button.kb-ghost{color:var(--ink);background:transparent;border:1px solid var(--rule);padding:2px 8px}
button.kb-ghost:hover{color:var(--accent);background:transparent;border-color:var(--accent)}
button:disabled,button:disabled:hover{opacity:.35;cursor:not-allowed;color:var(--ink);background:transparent;border-color:var(--rule)}
.kb-lock{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:0 0 6px;padding:8px 10px;border:1px solid var(--rule);border-left:2px solid var(--warn);background:var(--panel);color:var(--muted)}
.kb-lock .tf-lock{width:16px;height:16px;color:var(--warn)}
.kb-lock p{flex:1 1 40ch}
.kb-lock b{color:var(--ink)}
.kb-lock.nudge{animation:kb-nudge .35s}
@keyframes kb-nudge{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.kb-padlock{margin-right:4px}
.kb-open .kb-padlock{display:none}
#kb-page:not(.kb-open) .kb-row-btns button{color:var(--dim)}
.kb-msg{min-height:1.35em;margin:0 0 4px;color:var(--muted)}
.kb-msg.warn{color:var(--warn)}
.kb-scroll{overflow-x:auto;padding:58px 2px 6px}
.kb{position:relative;min-width:780px;max-width:1180px;margin:0 auto;padding:14px 16px 20px;background:#141414;border:1px solid #2a2a2a;box-shadow:inset 0 1px 0 #262626,0 18px 40px rgba(0,0,0,.6)}
.kb-wire{position:absolute;left:calc(50% - 8px);bottom:100%;width:240px;height:64px;color:#2e2e2e;overflow:visible}
.kb-grid{--cap:clamp(42px,4.3vw,54px);display:grid;grid-template-columns:repeat(60,minmax(0,1fr));grid-template-rows:var(--cap) var(--cap) 12px repeat(5,var(--cap))}
.kb .cap{margin:2px;min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:1px;padding:4px 5px 3px;overflow:hidden;font:400 10px/1.1 var(--mono);text-align:left;text-transform:none;letter-spacing:0;color:var(--ink);background:#090909;border:1px solid #333;box-shadow:inset 0 -3px 0 #000;cursor:pointer}
.kb .cap:hover{background:#090909;border-color:var(--ink)}
.cap-key{font-size:14px;font-weight:700;line-height:1;display:flex;flex-direction:column}
.cap.two .cap-key{flex-direction:row;gap:7px;font-size:12px}
#kb-page [hidden]{display:none}
.cap-key i{font-style:normal}
.cap-act,.cap-sact{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.cap-act{margin-top:auto}
.cap-sact{opacity:.75}
.cap-name{margin-top:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kb .cap.t-go,.kb .cap.t-go:hover{background:var(--accent);border-color:var(--accent);color:#000}
.kb .cap.t-page,.kb .cap.t-page:hover{background:var(--warn);border-color:var(--warn);color:#000}
.kb .cap.t-cancel,.kb .cap.t-cancel:hover{background:var(--short);border-color:var(--short);color:#000}
.kb .cap.t-map,.kb .cap.t-map:hover{background:var(--long);border-color:var(--long);color:#000}
.kb .cap.fixed{cursor:default;color:var(--dim);background:#0d0d0d;border-color:#222}
.kb .cap.bbg{cursor:default;color:var(--dim);background:transparent;border:1px dashed #2c2c2c;box-shadow:none}
.kb .cap.sel{outline:2px solid var(--ink);outline-offset:1px}
.kb .cap.down{transform:translateY(2px);box-shadow:none;filter:brightness(1.25)}
.kb-read{min-height:1.35em;margin:8px 0 6px;color:var(--muted)}
.kb-read b{color:var(--ink)}
.kb-tones{display:flex;flex-wrap:wrap;gap:4px 16px;margin:0 0 12px;color:var(--muted)}
.kb-tones i{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px}
.kb-tones .t-go{background:var(--accent)}.kb-tones .t-page{background:var(--warn)}.kb-tones .t-cancel{background:var(--short)}.kb-tones .t-map{background:var(--long)}
.kb-tones .t-bbg{border:1px dashed var(--muted)}
.kb-edit{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin:0 0 14px;padding:8px 10px;border:1px solid var(--rule);border-top:2px solid var(--accent);background:var(--panel)}
.kb-edit label{display:flex;align-items:center;gap:6px}
.kb-edit select{font:12px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule);padding:2px 4px}
table.kb-acts{border-collapse:collapse;width:100%;max-width:900px;margin-top:6px}
.kb-acts td{padding:4px 12px 4px 0;border-bottom:1px solid var(--rule);white-space:nowrap}
.kb-acts .kb-group th{padding:14px 0 4px;text-align:left;color:var(--dim);font-weight:400;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--rule)}
.kb-row-btns{text-align:right}
kbd.kb-chip{display:inline-block;min-width:4ch;padding:0 5px;text-align:center;font:700 12px var(--mono);background:var(--dim);color:var(--bg)}
tr.t-go kbd.kb-chip{background:var(--accent)}tr.t-page kbd.kb-chip{background:var(--warn)}tr.t-cancel kbd.kb-chip{background:var(--short)}tr.t-map kbd.kb-chip{background:var(--long)}
tr.unbound kbd.kb-chip{background:transparent;color:var(--dim);outline:1px dashed var(--dim);outline-offset:-1px}
tr.listening td{background:var(--band)}
tr.listening kbd.kb-chip{animation:kb-blink 1s steps(2,start) infinite}
@keyframes kb-blink{to{visibility:hidden}}
@media (prefers-reduced-motion:reduce){tr.listening kbd.kb-chip{animation:none;outline:1px solid var(--ink)}.kb .cap.down{transform:none}.kb-lock.nudge{animation:none}}
@media (max-width:560px){.kb-acts td:nth-child(3){display:none}.kb-acts td{white-space:normal}.kb-row-btns{white-space:nowrap}.kb-row-btns button{padding:2px 5px}}
`;

/** Words the page script shows, in the page's language. */
function scriptText(): Record<string, string> {
  return {
    def: tr("Default"),
    mine: tr("My keys"),
    profile: tr("Profile {n}"),
    started: tr("The default set is fixed, so your change started a new profile: {name}."),
    set: tr("{key} now: {action}."),
    taken: tr("{key} now: {action}, taken from {other}."),
    cleared: tr("{action} has no key now."),
    listen: tr("Press a key for {action}. Esc stops; or click a key above."),
    press: tr("press a key"),
    change: tr("change"),
    does: tr("{key}: {action}"),
    opens: tr("{key}: {action}, opens {href}"),
    nothing: tr("{key} does nothing yet."),
    browser: tr("{key} stays with the browser."),
    exists: tr("There is already a profile called {name}."),
    full: tr("That is as many profiles as an account keeps."),
    created: tr("Saved as {name}; it is the one in use."),
    renamed: tr("Renamed to {name}."),
    deleted: tr("Deleted {name}; back to the default set."),
    reset: tr("{name} is back to the default keys."),
    using: tr("Using {name}."),
    none: tr("nothing"),
    shift: tr("with Shift"),
    keyIs: tr("Key {key}"),
    locked: tr("Log in to change what keys do."),
    signedOut: tr(
      "You were signed out, so that change was not saved. Log in again to keep editing.",
    ),
    notSaved: tr(
      "That change is not saved to your account yet: the member area did not answer. It still works in this browser.",
    ),
    unreachable: tr(
      "The member area did not answer, so your profiles could not be loaded. The keys in use are this browser's last copy.",
    ),
  };
}

/**
 * The page's script. Until the member area says who is reading, the map shows this browser's last
 * copy of the profiles and the editing stays locked; a reader who logs in (in another tab, as the
 * login link opens) is unlocked on returning, with no reload. Edits are saved to the account a moment
 * after the last one, and copied to this browser at once so the next page uses them.
 */
function pageScript(): string {
  return `(() => {
  const A = ${scriptActions()};
  const S = ${scriptStrings(scriptText())};
  const STORE = ${scriptJson(STORE_KEY)}, API = ${scriptJson(HOTKEYS_API)}, MAX = 12;
  const $ = (id) => document.getElementById(id);
  const root = $("kb-page"), kb = $("kb"), msgEl = $("kb-msg"), read = $("kb-read"), sel = $("kb-profile");
  const nameIn = $("kb-name"), edit = $("kb-edit"), head = $("kb-head"), lock = $("kb-lock");
  const ids = Object.keys(A);
  const caps = [...kb.querySelectorAll(".cap[data-k]")];
  const capOf = {};
  for (const c of caps) {
    capOf[c.dataset.k] = c;
    if (c.dataset.s) capOf[c.dataset.s] = c;
  }
  const cap = (k) => (k === "Escape" ? "Esc" : k.length === 1 ? k.toUpperCase() : k);
  const ok = (k) => (k.length === 1 ? k !== " " : k === "Escape" || (/^F([1-9]|1[0-2])$/.test(k) && !/^F(5|11|12)$/.test(k)));
  const fill = (t, v) => t.replace(/\\{(\\w+)\\}/g, (w, n) => (n in v ? v[n] : w));
  const say = (t, warn) => {
    msgEl.textContent = t;
    msgEl.classList.toggle("warn", !!warn);
  };

  // Anything that is not the expected shape reads as "no profiles", never as an error.
  const clean = (v) => {
    const out = { active: "", profiles: {} };
    if (!v || typeof v !== "object" || !v.profiles || typeof v.profiles !== "object") return out;
    for (const name of Object.keys(v.profiles)) {
      const p = v.profiles[name], q = {};
      if (!p || typeof p !== "object") continue;
      for (const id of Object.keys(p)) if (typeof p[id] === "string") q[id] = p[id];
      out.profiles[name] = q;
    }
    if (typeof v.active === "string" && out.profiles[v.active]) out.active = v.active;
    return out;
  };
  const cache = (v) => {
    try {
      if (v) localStorage.setItem(STORE, JSON.stringify(v));
      else localStorage.removeItem(STORE);
    } catch (e) {}
  };
  let st = { active: "", profiles: {} };
  try {
    st = clean(JSON.parse(localStorage.getItem(STORE) || "null"));
  } catch (e) {}

  // null while the member area is asked, then true or false.
  let signed = null;
  let K = {}, listen = "", picked = null;
  // The same resolution as every other page's script: a profile's own keys win over defaults.
  const index = () => {
    const p = st.profiles[st.active];
    K = {};
    for (const id of ids) if (A[id].key && !(p && typeof p[id] === "string")) K[A[id].key] = id;
    if (p) for (const id of ids) if (typeof p[id] === "string" && p[id]) K[p[id]] = id;
  };
  const bound = (id) => {
    const p = st.profiles[st.active];
    const k = p && typeof p[id] === "string" ? p[id] : A[id].key;
    return k && K[k] === id ? k : "";
  };
  const snapshot = () => {
    const m = {};
    for (const id of ids) m[id] = bound(id);
    return m;
  };
  const unique = (t) => {
    if (t.indexOf("{n}") < 0 && !st.profiles[t]) return t;
    for (let n = t.indexOf("{n}") < 0 ? 2 : 1; ; n++) {
      const v = t.indexOf("{n}") < 0 ? t + " " + n : fill(t, { n });
      if (!st.profiles[v]) return v;
    }
  };

  const render = () => {
    index();
    root.classList.toggle("kb-open", signed === true);
    sel.textContent = "";
    sel.add(new Option(S.def, ""));
    for (const n of Object.keys(st.profiles).sort()) sel.add(new Option(n, n));
    sel.value = st.active;
    for (const b of document.querySelectorAll("[data-needs-profile]")) b.disabled = !st.active;
    for (const c of caps) {
      const b = K[c.dataset.k], s = c.dataset.s ? K[c.dataset.s] : "", t = A[b || s];
      c.className = "cap" + (t ? " t-" + t.group : "") + (c.dataset.s ? " two" : "") + (c === picked ? " sel" : "");
      c.querySelector(".cap-act").textContent = b ? A[b].label : "";
      c.querySelector(".cap-sact").textContent = s ? "⇧ " + A[s].label : "";
      c.title = [b && cap(c.dataset.k) + ": " + A[b].label, s && cap(c.dataset.s) + ": " + A[s].label].filter(Boolean).join(" · ");
    }
    for (const r of document.querySelectorAll(".kb-acts tr[data-act]")) {
      const id = r.dataset.act, k = bound(id);
      r.classList.toggle("unbound", !k);
      r.classList.toggle("listening", id === listen);
      r.querySelector("kbd").textContent = id === listen ? "…" : k ? cap(k) : "—";
      r.querySelector("[data-change] .lbl").textContent = id === listen ? S.press : S.change;
    }
    // The status bar's legend, which every other page's script draws for itself.
    for (const s of document.querySelectorAll(".keys [data-act]")) {
      const k = bound(s.dataset.act), b = s.querySelector("b");
      s.hidden = !k;
      if (k && b) b.textContent = k === "Escape" ? "esc" : k;
    }
    if (picked && signed) showPick();
    else edit.hidden = true;
  };

  let timer = 0;
  const push = async () => {
    try {
      const r = await fetch(API, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(st),
      });
      if (r.status === 401) return lockUp(S.signedOut);
      if (!r.ok) say(S.notSaved, true);
    } catch (e) {
      say(S.notSaved, true);
    }
  };
  const save = () => {
    cache(st);
    clearTimeout(timer);
    timer = setTimeout(push, 400);
  };
  const nudge = () => {
    say(S.locked, true);
    lock.classList.remove("nudge");
    void lock.offsetWidth;
    lock.classList.add("nudge");
  };

  // Editing the built-in set starts the reader's own profile from it.
  const editable = () => {
    if (st.active) return true;
    if (Object.keys(st.profiles).length >= MAX) {
      say(S.full, true);
      return false;
    }
    const n = unique(S.mine);
    st.profiles[n] = snapshot();
    st.active = n;
    return n;
  };
  const assign = (id, k) => {
    if (!signed) return nudge();
    const started = editable();
    if (!started) return;
    const p = st.profiles[st.active];
    for (const x of ids) if (typeof p[x] !== "string") p[x] = bound(x);
    let other = "";
    if (k) for (const x of ids) if (x !== id && p[x] === k) { p[x] = ""; other = x; }
    p[id] = k;
    save();
    render();
    if (started !== true) return say(fill(S.started, { name: started }));
    say(!k ? fill(S.cleared, { action: A[id].label })
      : other ? fill(S.taken, { key: cap(k), action: A[id].label, other: A[other].label })
      : fill(S.set, { key: cap(k), action: A[id].label }));
  };
  const stop = () => {
    listen = "";
    render();
  };

  const showPick = () => {
    edit.hidden = false;
    edit.textContent = "";
    const keys = [picked.dataset.k].concat(picked.dataset.s ? [picked.dataset.s] : []);
    for (const k of keys) {
      const l = document.createElement("label"), b = document.createElement("b"), s = document.createElement("select");
      b.textContent = fill(S.keyIs, { key: cap(k) }) + (k === picked.dataset.s ? " (" + S.shift + ")" : "");
      s.add(new Option("— " + S.none, ""));
      for (const id of ids) s.add(new Option(A[id].label + (A[id].href ? "  " + A[id].href : ""), id));
      s.value = K[k] || "";
      s.addEventListener("change", () => {
        if (s.value) assign(s.value, k);
        else if (K[k]) assign(K[k], "");
      });
      l.append(b, s);
      edit.append(l);
    }
  };
  const describe = (k) => {
    const id = K[k];
    read.textContent = "";
    const b = document.createElement("b");
    b.textContent = cap(k);
    read.append(b, document.createTextNode(id ? fill(A[id].href ? S.opens : S.does, { key: "", action: A[id].label, href: A[id].href }) : fill(S.nothing, { key: "" })));
  };

  kb.addEventListener("click", (e) => {
    const c = e.target.closest && e.target.closest(".cap[data-k]");
    if (!c) return;
    if (listen) {
      const id = listen;
      listen = "";
      return assign(id, c.dataset.k);
    }
    describe(c.dataset.k);
    if (!signed) return nudge();
    picked = c === picked ? null : c;
    render();
  });
  for (const r of document.querySelectorAll(".kb-acts tr[data-act]")) {
    const id = r.dataset.act;
    r.querySelector("[data-change]").addEventListener("click", () => {
      if (!signed) return nudge();
      if (listen === id) return stop();
      listen = id;
      say(fill(S.listen, { action: A[id].label }));
      render();
    });
    r.querySelector("[data-clear]").addEventListener("click", () => {
      listen = "";
      assign(id, "");
    });
  }

  // Here a key is shown, not followed: the reader is trying keys, or binding one.
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    let k = e.key;
    if (!k) return;
    if (k.length === 1) k = k.toLowerCase();
    if (listen) {
      if (k === "Tab" || k === "Shift") return;
      e.preventDefault();
      if (k === "Escape") {
        say("");
        return stop();
      }
      if (!ok(k)) return say(fill(S.browser, { key: cap(k) }), true);
      const id = listen;
      listen = "";
      return assign(id, k);
    }
    const t = e.target, n = t && t.tagName;
    if (n === "INPUT" || n === "SELECT" || n === "TEXTAREA") return;
    const c = capOf[k];
    if (!c || !ok(k)) return;
    if (k !== "Escape") e.preventDefault();
    c.classList.add("down");
    setTimeout(() => c.classList.remove("down"), 140);
    describe(k);
  });

  sel.addEventListener("change", () => {
    if (!signed) return nudge();
    st.active = sel.value;
    listen = "";
    save();
    render();
    say(fill(S.using, { name: st.active || S.def }));
  });
  const named = () => nameIn.value.trim().slice(0, 24);
  const taken = (n) => st.profiles[n] || n === S.def || n === "Default";
  $("kb-new").addEventListener("click", () => {
    if (Object.keys(st.profiles).length >= MAX) return say(S.full, true);
    const n = named() || unique(S.profile);
    if (taken(n)) return say(fill(S.exists, { name: n }), true);
    st.profiles[n] = snapshot();
    st.active = n;
    nameIn.value = "";
    save();
    render();
    say(fill(S.created, { name: n }));
  });
  $("kb-rename").addEventListener("click", () => {
    const n = named();
    if (!st.active || !n || n === st.active) return nameIn.focus();
    if (taken(n)) return say(fill(S.exists, { name: n }), true);
    st.profiles[n] = st.profiles[st.active];
    delete st.profiles[st.active];
    st.active = n;
    nameIn.value = "";
    save();
    render();
    say(fill(S.renamed, { name: n }));
  });
  $("kb-delete").addEventListener("click", () => {
    const n = st.active;
    if (!n) return;
    delete st.profiles[n];
    st.active = "";
    save();
    render();
    say(fill(S.deleted, { name: n }));
  });
  $("kb-reset").addEventListener("click", () => {
    const n = st.active;
    if (!n) return;
    st.profiles[n] = {};
    for (const id of ids) st.profiles[n][id] = A[id].key;
    save();
    render();
    say(fill(S.reset, { name: n }));
  });

  const lockUp = (text) => {
    signed = false;
    listen = "";
    picked = null;
    st = { active: "", profiles: {} };
    cache(null);
    head.hidden = true;
    lock.hidden = false;
    say(text || "", !!text);
    render();
  };
  const load = () =>
    fetch(API, { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (r) => {
        if (r.status === 401) return lockUp(signed ? S.signedOut : "");
        if (!r.ok) throw new Error(String(r.status));
        st = clean(await r.json());
        cache(st);
        signed = true;
        head.hidden = false;
        lock.hidden = true;
        say("");
        render();
      })
      .catch(() => {
        if (signed) return;
        signed = false;
        say(S.unreachable, true);
        render();
      });
  // The login link opens a new tab; coming back from it asks again, so no reload is needed.
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !signed) load();
  });
  render();
  load();
})();`;
}

export function keyboard(data: { overview: Overview; now: number }): string {
  const keys = CAPS.map(capHtml).join("");
  return layout({
    title: tr("Keyboard"),
    description: tr(
      "Every keyboard shortcut on airrates, on a Bloomberg terminal layout. Members remap them into their own profiles.",
    ),
    path: "/keys",
    overview: data.overview,
    now: data.now,
    body: `<style>${CSS}</style>
<div id="kb-page">
${helpHeading("h1", tr("Keyboard"), "keys", `<p>${tr("Every shortcut on the site, drawn on the layout of a Bloomberg terminal keyboard. A lit key does something: green goes to a page, amber acts on the page you are on, red leaves a text field, blue opens this map. Press any key here to see what it does.")}</p><p>${tr("Members can remap them: click a key to choose what it does, or press change beside an action and then the key you want. Profiles are kept on your account, so they follow you to every browser you log in on. Ctrl, Alt and Cmd combinations always stay the browser's, and a letter typed in a text field is always typing.")}</p><p>${tr("The dashed top row is Bloomberg's own keys, which a standard keyboard does not have.")}</p>`)}
<div class="kb-lock" id="kb-lock">${LOCK_ICON}<p><b>${tr("Your own keys need a login.")}</b> ${tr("Members remap any key and keep their profiles on their account. Everyone gets the keys below.")}</p><a class="btn" href="${MEMBER_LOGIN}" target="_blank" rel="noopener">${tr("log in")}</a></div>
<div class="kb-head" id="kb-head" hidden>
<label class="field">${tr("profile")}<select id="kb-profile"><option value="">${tr("Default")}</option></select></label>
<label class="field">${tr("name")}<input id="kb-name" maxlength="24" placeholder="${tr("for a new profile")}" autocomplete="off"></label>
<div class="actions"><button type="button" id="kb-new">${tr("save as new")}</button><button type="button" class="kb-ghost" id="kb-rename" data-needs-profile disabled>${tr("rename")}</button><button type="button" class="kb-ghost" id="kb-reset" data-needs-profile disabled>${tr("reset keys")}</button><button type="button" class="kb-ghost" id="kb-delete" data-needs-profile disabled>${tr("delete")}</button></div>
</div>
<p class="kb-msg" id="kb-msg" aria-live="polite"></p>
<div class="kb-scroll"><div class="kb" id="kb">${WIRE}<div class="kb-grid">${keys}</div></div></div>
<p class="kb-read" id="kb-read" aria-live="polite">${tr("Press a key, or click one, to see what it does.")}</p>
<div class="kb-edit" id="kb-edit" hidden></div>
<p class="kb-tones"><span><i class="t-go"></i>${tr("go to a page")}</span><span><i class="t-page"></i>${tr("act on the page")}</span><span><i class="t-cancel"></i>${tr("leave a text field")}</span><span><i class="t-map"></i>${tr("this map")}</span><span><i class="t-bbg"></i>${tr("Bloomberg-only")}</span></p>
<table class="kb-acts">${actionRows()}</table>
<p class="notes">${tr('Layout after <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> by Swapnil1101, CC BY-SA 4.0. Not affiliated with Bloomberg.')}</p>
</div>
<script>${pageScript()}</script>`,
  });
}
