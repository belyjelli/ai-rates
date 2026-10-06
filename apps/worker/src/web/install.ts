import { APP_ICON_PNG } from "./app-icons.generated";

/**
 * Installing the site as an app, in browsers that offer it (Chrome, and the other Chromium browsers).
 *
 * The browser decides whether a site can be installed from its web app manifest, served here with the
 * icons, and tells the page through `beforeinstallprompt`. The about page offers its own install control
 * only then, so a browser that cannot install (Safari, Firefox, Chrome on iOS) never shows a dead button,
 * and an app that is already installed never asks again. On a phone the offer is a full-width banner that
 * can be dismissed; on anything wider it is one button above the page title.
 *
 * No service worker: Chrome stopped requiring one to install a site, and a cache in front of live funding
 * rates would only ever show old numbers.
 */
export const MANIFEST = {
  name: "airrates · funding carry sheet",
  short_name: "airrates",
  description:
    "Funding-rate screener for perpetual futures: where holding the same asset long on one exchange and short on another collects funding.",
  id: "/",
  // Tagged, so a launch from the installed app counts under its own source (app/visits.ts).
  start_url: "/?ref=app",
  scope: "/",
  display: "standalone",
  background_color: "#000000",
  theme_color: "#000000",
  icons: [
    { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
} as const;

/** In every page's head: the manifest the browser installs from, and the icon an iPhone saves. */
export const INSTALL_HEAD = `<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#000000">
<link rel="apple-touch-icon" href="/icons/192.png">`;

const decoded = new Map<string, Uint8Array<ArrayBuffer>>();
function iconBytes(name: string): Uint8Array<ArrayBuffer> | null {
  const b64 = APP_ICON_PNG[name];
  if (!b64) return null;
  let bytes = decoded.get(name);
  if (!bytes) {
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    decoded.set(name, bytes);
  }
  return bytes;
}

/** The manifest and the icons, or null for any other address. Neither needs the database. */
export function installAsset(path: string): Response | null {
  if (path === "/manifest.webmanifest") {
    return new Response(JSON.stringify(MANIFEST), {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  const icon = /^\/icons\/([a-z0-9-]+)\.png$/.exec(path);
  const bytes = icon?.[1] ? iconBytes(icon[1]) : null;
  if (!bytes) return null;
  return new Response(bytes, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
  });
}

export const INSTALL_CSS = `
.install{margin:0 0 10px}
.install-nag{display:flex;align-items:center;gap:10px}
.install-text,.install-x{display:none}
.install-text{margin:0}
.install-btn{font:700 11px/14px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--bg);background:var(--accent);border:1px solid var(--accent);padding:5px 10px;cursor:pointer;white-space:nowrap}
.install-btn:hover{filter:brightness(1.1)}
@media (max-width:640px){
.install{margin:-12px -10px 12px}
.install-nag{padding:10px;background:#0b1208;border-bottom:1px solid var(--accent)}
.install-text{display:block;flex:1;min-width:0;color:var(--ink);line-height:1.4}
.install-text small{display:block;color:var(--muted);font-size:11px}
.install-btn{padding:8px 12px;min-height:36px}
.install-x{display:block;flex-shrink:0;background:none;border:0;color:var(--muted);font:18px/1 var(--mono);padding:6px 8px;cursor:pointer}
.install-x:hover{color:var(--ink)}
}
`;

/** Days a dismissed banner stays away. */
export const DISMISS_DAYS = 30;

/**
 * Hidden until the browser says it can install the site. Wide screens show the button alone; phones
 * show it inside a full-width banner with a line of explanation and a way to dismiss it (INSTALL_CSS).
 */
export const INSTALL_BLOCK = `<div class="install" data-install hidden>
<div class="install-nag" role="region" aria-label="Install the app">
<p class="install-text"><b>Install airrates</b><small>Opens in its own window, from your home screen.</small></p>
<button type="button" class="install-btn" data-install-go>Install app</button>
<button type="button" class="install-x" data-install-dismiss aria-label="Not now">×</button>
</div>
</div>
<script>${installScript()}</script>`;

function installScript(): string {
  return `(() => {
  const box = document.querySelector("[data-install]");
  if (!box) return;
  const ga = (name, params) => { try { if (window.gtag) window.gtag("event", name, params || {}); } catch (e) {} };
  const KEY = "airrates.install.dismissed";
  const dismissed = () => {
    try { const at = Number(localStorage.getItem(KEY)); return at > 0 && Date.now() - at < ${DISMISS_DAYS} * 864e5; }
    catch (e) { return false; }
  };
  // Already running as the installed app: there is nothing to offer.
  if (matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) return;
  let offer = null;
  addEventListener("beforeinstallprompt", (e) => {
    // The page's own control instead of the browser's mini-infobar.
    e.preventDefault();
    offer = e;
    if (dismissed()) return;
    box.hidden = false;
    ga("app_install_offer", {});
  });
  addEventListener("appinstalled", () => { offer = null; box.hidden = true; ga("app_installed", {}); });
  box.querySelector("[data-install-go]").addEventListener("click", async () => {
    if (!offer) { box.hidden = true; return; }
    const shown = offer;
    offer = null;
    shown.prompt();
    let outcome = "unknown";
    try { outcome = (await shown.userChoice).outcome; } catch (e) {}
    ga("app_install_choice", { outcome });
    // A prompt can be shown once; the browser offers again later if the reader said no.
    box.hidden = true;
  });
  box.querySelector("[data-install-dismiss]").addEventListener("click", () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    box.hidden = true;
    ga("app_install_dismiss", {});
  });
})();`;
}
