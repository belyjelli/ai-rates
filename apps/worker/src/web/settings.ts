import type { Overview } from "../app/data";
import { esc } from "./format";
import { helpHeading } from "./help";
import { keyboardIcon } from "./hotkeys";
import { currentLocale, LOCALE_INFO, LOCALES, switchHref, tr, trMsg } from "./i18n";
import { layout } from "./layout";
import { SYSTEM_THEME, THEMES } from "./themes";

/**
 * /settings, from the footer menu (owner, 2026-10-28): every choice a reader makes on the site, in one
 * list. The choices live in this browser's localStorage, not on an account, so they need no login and
 * apply from the next page's first paint (the theme through THEME_HEAD_SCRIPT, the others where each
 * page reads them). The page lists what the site already remembers -- the clock's zone, the chart
 * cursor -- beside the new theme, so none of it is a hidden toggle any more.
 */
const CSS = `
.set-list{display:grid;gap:22px;max-width:880px;margin:6px 0 20px}
.set-row{border:1px solid var(--rule);background:var(--panel);padding:12px 14px}
.set-row h2{margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink)}
.set-row>p{margin:0 0 10px;color:var(--muted);font-size:12px}
.set-themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.set-theme{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;text-align:left;padding:8px 10px;border:1px solid var(--rule);background:var(--bg);color:var(--ink);font:inherit;cursor:pointer}
.set-theme:hover{border-color:var(--muted)}
.set-theme[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.set-theme b{font-weight:700}
.set-theme small{grid-column:2;color:var(--muted);font-size:11px;line-height:1.4;text-transform:none;letter-spacing:0}
.set-swatch{grid-row:span 2;display:grid;grid-template-columns:repeat(2,9px);grid-template-rows:repeat(2,9px);gap:2px;padding:4px;border:1px solid var(--rule)}
.set-swatch i{display:block}
.set-choice{display:flex;flex-wrap:wrap;gap:6px}
.set-choice button,.set-choice a{padding:5px 12px;border:1px solid var(--rule);background:var(--bg);color:var(--muted);font:inherit;cursor:pointer}
.set-choice button[aria-pressed=true],.set-choice a[aria-current]{color:var(--bg);background:var(--ink);border-color:var(--ink)}
.set-choice button:hover,.set-choice a:hover{color:var(--accent);border-color:var(--accent)}
.set-choice button[aria-pressed=true]:hover{color:var(--bg)}
.set-msg{min-height:1.4em;color:var(--accent);font-size:12px;margin:8px 0 0}
`;

/** A theme's swatch: its ground with its ink, accent, long and short on it. */
function swatch(vars: Record<string, string>): string {
  const bg = vars["--bg"] ?? "#000";
  const dots = ["--ink", "--accent", "--long", "--short"].map((k) => vars[k] ?? "#888");
  return `<span class="set-swatch" style="background:${bg}" aria-hidden="true">${dots.map((c) => `<i style="background:${c}"></i>`).join("")}</span>`;
}

// Applies a choice as the head script would and keeps it, and the other rows' buttons likewise. A
// storage error (private mode) still applies the choice to this page.
const SCRIPT = `(()=>{const st=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch{}};const get=k=>{try{return localStorage.getItem(k)}catch{return null}};const msg=document.getElementById("set-msg");const say=t=>{msg.textContent=t};const press=(sel,on)=>{for(const b of document.querySelectorAll(sel))b.setAttribute("aria-pressed",String(on(b)))};const theme=get("theme")||"night";press(".set-theme",b=>b.dataset.theme===theme);for(const b of document.querySelectorAll(".set-theme"))b.addEventListener("click",()=>{const t=b.dataset.theme;st("theme",t==="night"?null:t);window.airratesTheme&&window.airratesTheme(t);press(".set-theme",x=>x===b);say(msg.dataset.saved)});const clock=get("clock")==="utc"?"utc":"local";press("[data-clock]",b=>b.dataset.clock===clock);for(const b of document.querySelectorAll("[data-clock]"))b.addEventListener("click",()=>{st("clock",b.dataset.clock);press("[data-clock]",x=>x===b);dispatchEvent(new Event("airrates:clock"));say(msg.dataset.saved)});const cur=get("chart-cursor")==="bar"?"bar":"cross";press("[data-cursor-mode]",b=>b.dataset.cursorMode===cur);for(const b of document.querySelectorAll("[data-cursor-mode]"))b.addEventListener("click",()=>{st("chart-cursor",b.dataset.cursorMode);press("[data-cursor-mode]",x=>x===b);say(msg.dataset.saved)});document.getElementById("set-reset").addEventListener("click",()=>{for(const k of ["theme","clock","chart-cursor","gamma-view","gamma-expiry-view","whale-gex"])st(k,null);window.airratesTheme&&window.airratesTheme("night");press(".set-theme",b=>b.dataset.theme==="night");press("[data-clock]",b=>b.dataset.clock==="local");press("[data-cursor-mode]",b=>b.dataset.cursorMode==="cross");dispatchEvent(new Event("airrates:clock"));say(msg.dataset.reset)})})();`;

export function settings(data: { overview: Overview; now: number }): string {
  const themes = [
    ...THEMES.map(
      (t) =>
        `<button type="button" class="set-theme" data-theme="${t.id}" aria-pressed="false">${swatch(t.vars)}<b>${trMsg(t.name)}</b><small>${trMsg(t.note)}</small></button>`,
    ),
    `<button type="button" class="set-theme" data-theme="${SYSTEM_THEME}" aria-pressed="false"><span class="set-swatch" aria-hidden="true" style="background:linear-gradient(135deg,${THEMES[1]?.vars["--bg"]} 50%,${THEMES[0]?.vars["--bg"]} 50%)"></span><b>${tr("System")}</b><small>${tr("Day or Night, as your device is set")}</small></button>`,
  ].join("");
  const languages = LOCALES.map(
    (locale) =>
      `<a href="${switchHref(locale, "/settings")}" hreflang="${LOCALE_INFO[locale].htmlLang}" lang="${LOCALE_INFO[locale].htmlLang}"${locale === currentLocale() ? ' aria-current="true"' : ""}>${esc(LOCALE_INFO[locale].name)}</a>`,
  ).join("");
  return layout({
    title: tr("Settings"),
    description: tr(
      "Your settings on airrates: theme, clock, chart cursor, language and keyboard.",
    ),
    path: "/settings",
    overview: data.overview,
    now: data.now,
    body: `<style>${CSS}</style>
${helpHeading("h1", tr("Settings"), "settings", `<p>${tr("Each choice is kept in this browser, not on an account: it needs no login, and another browser or device starts from the defaults. Clearing the site's data resets them.")}</p>`)}
<div class="set-list">
<section class="set-row"><h2>${tr("Theme")}</h2><p>${tr("The colours of every page. Charts take the new colours from the next page you open.")}</p><div class="set-themes">${themes}</div></section>
<section class="set-row"><h2>${tr("Clock")}</h2><p>${tr("The clock in the header, and the times on charts and tables.")}</p><div class="set-choice"><button type="button" data-clock="local" aria-pressed="false">${tr("Local time")}</button><button type="button" data-clock="utc" aria-pressed="false">UTC</button></div></section>
<section class="set-row"><h2>${tr("Chart cursor")}</h2><p>${tr("What follows the pointer on a chart: a crosshair with the value on each axis, or the whole bar lit.")}</p><div class="set-choice"><button type="button" data-cursor-mode="cross" aria-pressed="false">${tr("cross")}</button><button type="button" data-cursor-mode="bar" aria-pressed="false">${tr("bar")}</button></div></section>
<section class="set-row"><h2>${tr("Language")}</h2><p>${tr("The site's language, kept for this browser.")}</p><div class="set-choice">${languages}</div></section>
<section class="set-row"><h2>${tr("Keyboard")}</h2><p>${tr("Every shortcut on the site. Members remap them into profiles kept on their account.")}</p><div class="set-choice"><a href="/keys">${keyboardIcon()} ${tr("keyboard shortcuts")}</a></div></section>
<section class="set-row"><h2>${tr("Reset")}</h2><p>${tr("Back to the defaults: Night, local time, the crosshair, and every chart's own view.")}</p><div class="set-choice"><button type="button" id="set-reset">${tr("reset settings")}</button></div></section>
</div>
<p class="set-msg" id="set-msg" aria-live="polite" data-saved="${esc(tr("Saved in this browser."))}" data-reset="${esc(tr("Back to the defaults."))}"></p>
<script>${SCRIPT}</script>`,
  });
}
