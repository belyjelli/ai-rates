import { ASSET_CLASSES, type AssetClass } from "@ai-rates/core";
import { VENUES } from "@ai-rates/venues";
import type { SearchAsset } from "../app/data";
import { namedBooks } from "./gamma";
import { ACTIONS, scriptJson } from "./hotkeys";
import { msg, scriptStrings, tr, trMsg } from "./i18n";
import { icon, iconMask } from "./icons";
import { VENUE_TYPE_SHORT } from "./venues";

/**
 * The site-wide search: Cmd+K (Ctrl+K elsewhere), the K key, or the masthead's button opens an
 * overlay that finds a ticker, an exchange, an index or a page.
 *
 * A TICKER is the point of it. The best match opens out into every page the site has for that asset
 * -- its funding rates, the spread backtest, the screener, the price gaps, CVD, whale orders,
 * liquidations, gamma -- leaving out the ones with nothing to show (no top of book means no price
 * gaps; whale orders only for the eighty tracked markets). Any other match is one press away from
 * opening out the same way.
 *
 * THE ASSET LIST is fetched from SEARCH_PATH the first time the overlay opens, not shipped with every
 * page: ~2,500 assets is ~80 kB of JSON, which a page view should not carry for a search it may never
 * use. The edge keeps it five minutes and the tab keeps it as long. Exchanges, option books and pages
 * are short and static, so they are in the script itself and match before the list arrives.
 *
 * NO JAVASCRIPT, no search: the button is drawn hidden and the script reveals it, so a reader without
 * the script is never offered a button that does nothing.
 */

export const SEARCH_PATH = "/data/search";

/**
 * The asset list as SEARCH_PATH serves it, a row per asset in the data layer's order (deepest first):
 * [ticker, class index into ASSET_CLASSES, venues, open interest in whole dollars (0 unknown),
 * 1 if quoted a top of book, whale page venue or 0].
 */
export function searchJson(
  rows: readonly SearchAsset[],
  levels: readonly { ticker: string; name: string }[] = [],
): string {
  return JSON.stringify({
    // Every index level the collector reads, [ticker, name]: each has a page (web/index-page.ts),
    // most of them with no perpetual to find them by.
    i: levels.map((l) => [l.ticker, l.name]),
    a: rows.map((r) => [
      r.base,
      ASSET_CLASSES.indexOf(r.asset_class),
      r.venues,
      r.open_interest_usd === null ? 0 : Math.round(r.open_interest_usd),
      r.quoted ? 1 : 0,
      r.whale_venue ?? 0,
    ]),
  });
}

const CLASS_LABELS: Readonly<Record<AssetClass, string>> = {
  crypto: msg("crypto"),
  equity: msg("equity"),
  commodity: msg("commodity"),
  fx: msg("fx"),
  index: msg("index"),
};

/** The masthead's button: hidden until the script runs, and its key printed for the reader's system. */
export function searchButton(): string {
  return `<button type="button" class="cmdk-btn" data-cmdk-open hidden title="${tr("Search tickers, exchanges and indices")}">${icon("search")}<span>${tr("Search")}</span><kbd data-cmdk-kbd>Ctrl K</kbd></button>`;
}

/** The overlay itself, empty: the script fills the list. */
export function searchDialog(): string {
  return `<div class="cmdk" id="cmdk" hidden>
<div class="cmdk-back" data-cmdk-close></div>
<div class="cmdk-box" role="dialog" aria-modal="true" aria-label="${tr("Search")}">
<label class="cmdk-in">${icon("search")}<input type="text" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${tr("Ticker, exchange or index")}"><button type="button" class="cmdk-esc" data-cmdk-close>esc</button></label>
<div class="cmdk-list" id="cmdk-list" role="listbox" aria-label="${tr("Results")}"></div>
<p class="cmdk-foot"><span><kbd>${icon("up")}</kbd><kbd>${icon("down")}</kbd> ${tr("move")}</span><span><kbd>enter</kbd> ${tr("open")}</span><span><kbd>esc</kbd> ${tr("close")}</span></p>
</div></div>`;
}

export const SEARCH_CSS = `
.cmdk-btn{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;height:18px;padding:0 6px;border:1px solid var(--rule);background:none;color:var(--muted);font:inherit;cursor:pointer}
.cmdk-btn:hover{color:var(--accent);border-color:var(--accent)}
.cmdk-btn[hidden]{display:none}
.cmdk-btn kbd,.cmdk kbd{font:inherit;font-size:10px;color:var(--dim);border:1px solid var(--rule);padding:0 3px;line-height:14px;display:inline-flex;align-items:center}
@media (max-width:560px){.cmdk-btn span,.cmdk-btn kbd{display:none}}
html.cmdk-open{overflow:hidden}
.cmdk{position:fixed;inset:0;z-index:60}
.cmdk[hidden]{display:none}
.cmdk-back{position:absolute;inset:0;background:rgba(0,0,0,.7)}
.cmdk-box{position:relative;margin:min(12vh,96px) auto 0;width:min(640px,calc(100vw - 32px));max-height:calc(100vh - min(12vh,96px) - 24px);display:flex;flex-direction:column;border:1px solid var(--muted);background:var(--bg);box-shadow:0 16px 48px rgba(0,0,0,.8)}
.cmdk-in{display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid var(--rule);color:var(--muted);font-size:15px}
.cmdk-in input{flex:1;min-width:0;height:46px;border:0;outline:0;background:none;color:var(--ink);font:inherit;font-size:16px}
.cmdk-in input::placeholder{color:var(--dim)}
.cmdk-esc{font:inherit;font-size:10px;color:var(--dim);background:none;border:1px solid var(--rule);padding:0 4px;cursor:pointer}
.cmdk-list{overflow-y:auto;padding:4px 0 8px;overscroll-behavior:contain}
.cmdk-h{margin:10px 12px 4px;color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.cmdk-item{display:flex;align-items:baseline;gap:10px;width:100%;padding:6px 12px;border:0;border-left:2px solid transparent;background:none;color:var(--ink);font:inherit;text-align:left;text-transform:none;letter-spacing:normal;cursor:pointer}
.cmdk-item:hover{color:var(--ink);background:none;border-bottom:0;border-top:0;border-right:0}
.cmdk-item.on{background:var(--band);border-left-color:var(--accent)}
.cmdk-t{font-weight:700;white-space:nowrap}
.cmdk-m{color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmdk-item::after{content:"";margin-left:auto;align-self:center;flex-shrink:0;width:12px;height:12px;background:var(--dim);-webkit-mask:${iconMask("right")} center/contain no-repeat;mask:${iconMask("right")} center/contain no-repeat;opacity:0}
.cmdk-item.on::after{opacity:1;background:var(--accent)}
.cmdk-sec{padding-left:28px}
.cmdk-sec .cmdk-t{font-weight:400;min-width:150px}
.cmdk-focus{display:flex;align-items:baseline;gap:10px;margin:8px 12px 2px;flex-wrap:wrap}
.cmdk-focus b{font-size:18px;color:var(--accent)}
.cmdk-focus span{color:var(--muted)}
.cmdk-note{margin:14px 12px;color:var(--muted)}
.cmdk-foot{display:flex;gap:16px;margin:0;padding:6px 12px;border-top:1px solid var(--rule);color:var(--dim);font-size:11px}
.cmdk-foot span{display:inline-flex;align-items:center;gap:4px}
@media (max-width:560px){.cmdk-box{margin-top:8px;max-height:calc(100vh - 16px)}.cmdk-foot{display:none}.cmdk-sec .cmdk-t{min-width:0}}
`;

/** What the script prints, in the page's language. */
const searchStrings = () => ({
  rates: tr("Funding rates"),
  ratesNote: tr("every exchange's rate and open interest"),
  spreads: tr("Funding spreads"),
  spreadsNote: tr("backtest a long/short pair"),
  screener: tr("Screener"),
  screenerNote: tr("its spreads, ranked"),
  arbitrage: tr("Arbitrage"),
  arbitrageNote: tr("price gaps between exchanges"),
  cvd: tr("Chart"),
  cvdNote: tr("price, spot and futures CVD"),
  whales: tr("Whale orders"),
  whalesNote: tr("large resting orders and trades"),
  liquidations: tr("Liquidations"),
  liquidationsNote: tr("where positions are liquidated"),
  gamma: tr("Gamma Exposure"),
  gammaNote: tr("options gamma by strike"),
  venue: tr("1 exchange"),
  venues: tr("{n} exchanges"),
  oi: tr("OI {usd}"),
  assets: tr("Tickers"),
  others: tr("Other tickers"),
  exchanges: tr("Exchanges"),
  exchangePage: tr("markets, costs and grade"),
  indices: tr("Indices and option books"),
  levels: tr("Index levels"),
  levelNote: tr("the level, its daily closes and what trades on it"),
  pages: tr("Pages"),
  recent: tr("Recent"),
  loading: tr("Loading tickers…"),
  failed: tr("The ticker list did not load. Exchanges and pages still match."),
  none: tr("Nothing matches {q}."),
});

/**
 * The overlay's script. Rows are built with DOM calls and textContent, never markup, since the list
 * carries venue-chosen tickers (龙虾, 币安人生) that must print as text. One linear list: arrows (or
 * Tab) move, Enter opens, Cmd/Ctrl+Enter opens a page in a new tab.
 */
export function searchScript(): string {
  const classes = ASSET_CLASSES.map((c) => [c, trMsg(CLASS_LABELS[c])]);
  // The exchanges the screener's picker lists: no retired venue, no alias of another.
  const venues = VENUES.filter((v) => !v.retired && !v.aliasOf).map((v) => [
    v.id,
    v.name,
    VENUE_TYPE_SHORT[v.type] ?? "",
  ]);
  const pages = ACTIONS.filter((a) => a.href).map((a) => [trMsg(a.label), a.href]);
  return `(() => {
  const root = document.getElementById("cmdk");
  if (!root || window.airratesSearch) return;
  const S = ${scriptStrings(searchStrings())};
  const CL = ${scriptJson(classes)}, V = ${scriptJson(venues)}, B = ${scriptJson(namedBooks())}, P = ${scriptJson(pages)};
  const input = root.querySelector("input"), list = root.querySelector(".cmdk-list");
  const CACHE = "airrates.search.v2", RECENT = "airrates.search.recent";
  let assets = null, levels = [], loading = null, failed = false, items = [], at = 0, pick = null, back = null;

  const load = () => {
    if (assets || loading) return;
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE) || "null");
      if (c && Date.now() - c.t < 300000 && Array.isArray(c.a)) { assets = c.a; levels = c.i || []; return; }
    } catch (e) {}
    failed = false;
    loading = fetch(${JSON.stringify(SEARCH_PATH)})
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        assets = j.a;
        levels = j.i || [];
        try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), a: assets, i: levels })); } catch (e) {}
      })
      .catch(() => { failed = true; })
      .then(() => { loading = null; if (!root.hidden) render(); });
  };

  const usd = (n) => n >= 1e9 ? "$" + (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "K" : "$" + n;
  const where = (a) => CL[a[1]][0] === "crypto" ? encodeURIComponent(a[0]) : CL[a[1]][0] + "/" + encodeURIComponent(a[0]);
  const meta = (a) => {
    const out = [CL[a[1]][1], a[2] === 1 ? S.venue : S.venues.replace("{n}", a[2])];
    if (a[3] > 0) out.push(S.oi.replace("{usd}", usd(a[3])));
    return out.join(" · ");
  };
  // The option book for an asset: BTC and ETH are Deribit's crypto books, the rest are tradfi.
  const bookFor = (a) => {
    const b = B.find((x) => x[0] === a[0]);
    return b && ((a[0] === "BTC" || a[0] === "ETH") === (CL[a[1]][0] === "crypto")) ? b : null;
  };
  const sections = (a) => {
    const w = where(a), out = [
      [S.rates, S.ratesNote, "/markets/asset/" + w],
      [S.spreads, S.spreadsNote, "/pair/" + w],
      [S.screener, S.screenerNote, "/screener?q=" + encodeURIComponent(a[0])],
    ];
    if (a[4]) out.push([S.arbitrage, S.arbitrageNote, "/price-pair/" + w]);
    out.push([S.cvd, S.cvdNote, "/chart/" + w]);
    if (a[5]) out.push([S.whales, S.whalesNote, "/whales/" + w + (a[5] === "binance" ? "" : "?venue=" + encodeURIComponent(a[5]))]);
    out.push([S.liquidations, S.liquidationsNote, "/liquidations/" + w]);
    if (bookFor(a)) out.push([S.gamma, S.gammaNote, "/rates?gex=" + encodeURIComponent(a[0])]);
    return out;
  };

  // What the reader typed, as a ticker: "$btc", "BTCUSDT", "BTC-USDT-SWAP" and "equity:AAPL" all
  // find their asset. The stripped form only counts as an exact match; prefixes use what was typed.
  const parse = (v) => {
    let q = v.trim().toUpperCase().replace(/^\\$/, ""), cls = -1;
    const m = q.match(/^([A-Z]+)[:\\/](.+)$/);
    if (m) {
      const i = CL.findIndex((c) => c[0] === m[1].toLowerCase());
      if (i >= 0) { cls = i; q = m[2]; }
    }
    let bare = q;
    for (let n = 0; n < 3; n++) {
      const s = bare.replace(/[-_\\/ ]?(USDT|USDC|USD|PERP|SWAP)$/, "");
      if (!s || s === bare) break;
      bare = s;
    }
    return { q, bare, cls };
  };
  const rank = (t, q) => t === q ? 0 : t.startsWith(q) ? 1 : q.length > 1 && t.includes(q) ? 2 : -1;
  const best = (rows, score, n) => rows
    .map((r, i) => [score(r), i, r])
    .filter((x) => x[0] >= 0)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1])
    .slice(0, n)
    .map((x) => x[2]);
  const findAssets = (p) => !assets ? [] : best(assets, (a) => {
    if (p.cls >= 0 && a[1] !== p.cls) return -1;
    if (a[0] === p.bare && p.bare !== p.q) return 0.5;
    return rank(a[0], p.q);
  }, 9);

  const recent = () => { try { const r = JSON.parse(localStorage.getItem(RECENT) || "[]"); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
  const remember = (a) => {
    const r = recent().filter((x) => !(x[0] === a[0] && x[1] === a[1]));
    r.unshift([a[0], a[1]]);
    try { localStorage.setItem(RECENT, JSON.stringify(r.slice(0, 6))); } catch (e) {}
  };

  const mark = (i) => {
    if (!items.length) { input.removeAttribute("aria-activedescendant"); return; }
    at = (i + items.length) % items.length;
    items.forEach((el, j) => { el.classList.toggle("on", j === at); el.setAttribute("aria-selected", j === at ? "true" : "false"); });
    input.setAttribute("aria-activedescendant", items[at].id);
    items[at].scrollIntoView({ block: "nearest" });
  };
  const head = (text) => {
    const h = document.createElement("p");
    h.className = "cmdk-h";
    h.textContent = text;
    list.appendChild(h);
  };
  const note = (text) => {
    const p = document.createElement("p");
    p.className = "cmdk-note";
    p.textContent = text;
    list.appendChild(p);
  };
  // One row: a link when it goes somewhere, a button when it opens out an asset in place.
  const row = (title, sub, href, cls, onPick) => {
    const el = document.createElement(href ? "a" : "button");
    if (href) el.href = href; else el.type = "button";
    el.className = "cmdk-item" + (cls ? " " + cls : "");
    el.id = "cmdk-i" + items.length;
    el.setAttribute("role", "option");
    const t = document.createElement("span");
    t.className = "cmdk-t";
    t.textContent = title;
    el.appendChild(t);
    if (sub) {
      const m = document.createElement("span");
      m.className = "cmdk-m";
      m.textContent = sub;
      el.appendChild(m);
    }
    const i = items.length;
    el.addEventListener("mousemove", () => { if (at !== i) mark(i); });
    if (onPick) { el.onPick = onPick; el.addEventListener("click", onPick); }
    items.push(el);
    list.appendChild(el);
  };
  const openOut = (a) => () => {
    pick = a;
    input.value = (CL[a[1]][0] === "crypto" ? "" : CL[a[1]][0] + ":") + a[0];
    render();
    input.focus();
  };
  const assetRow = (a) => row(a[0], meta(a), null, "", openOut(a));
  const focusOn = (a) => {
    const f = document.createElement("div");
    f.className = "cmdk-focus";
    const b = document.createElement("b");
    b.textContent = a[0];
    const s = document.createElement("span");
    s.textContent = meta(a);
    f.append(b, s);
    list.appendChild(f);
    for (const x of sections(a)) row(x[0], x[1], x[2], "cmdk-sec", () => remember(a));
  };

  function render() {
    list.textContent = "";
    items = [];
    const p = parse(input.value);
    const lower = p.q.toLowerCase();
    if (!p.q) {
      if (!assets && !failed) load();
      const r = recent().map((x) => (assets && assets.find((a) => a[0] === x[0] && a[1] === x[1])) || null).filter(Boolean);
      if (r.length) { head(S.recent); r.forEach(assetRow); }
      head(S.pages);
      for (const x of P) row(x[0], "", x[1]);
      mark(0);
      return;
    }
    const found = findAssets(p);
    const top = pick && found.some((a) => a === pick) ? pick : found[0];
    if (top) {
      head(S.assets);
      focusOn(top);
      const rest = found.filter((a) => a !== top).slice(0, 8);
      if (rest.length) { head(S.others); rest.forEach(assetRow); }
    } else if (loading) note(S.loading);
    else if (failed) note(S.failed);
    const ven = best(V, (v) => { const a = rank(v[0], lower), b = rank(v[1].toLowerCase(), lower); return a < 0 ? b : b < 0 ? a : Math.min(a, b); }, 5);
    if (ven.length) {
      head(S.exchanges);
      for (const v of ven) row(v[1], v[2] + " · " + S.exchangePage, "/markets/exchange/" + encodeURIComponent(v[0]));
    }
    const books = best(B, (b) => {
      if (top && b === bookFor(top)) return -1;
      const a = rank(b[0], p.q), n = b[1].toLowerCase().includes(lower) && lower.length > 1 ? 2 : -1;
      return a < 0 ? n : a;
    }, 5);
    if (books.length) {
      head(S.indices);
      for (const b of books) row(b[0], b[1] + " · " + S.gammaNote, "/rates?gex=" + encodeURIComponent(b[0]));
    }
    // Index levels by ticker or name: "nifty", "nikkei", "SENSEX".
    const lv = best(levels, (l) => {
      const a = rank(l[0], p.q), n = l[1].toLowerCase().includes(lower) && lower.length > 1 ? 2 : -1;
      return a < 0 ? n : a;
    }, 5);
    if (lv.length) {
      head(S.levels);
      for (const l of lv) row(l[1], l[0] + " · " + S.levelNote, "/indexes/" + encodeURIComponent(l[0]));
    }
    const pages = best(P, (x) => rank(x[0].toLowerCase(), lower), 3);
    if (pages.length) {
      head(S.pages);
      for (const x of pages) row(x[0], "", x[1]);
    }
    if (!items.length && !loading && assets) note(S.none.replace("{q}", input.value.trim()));
    mark(0);
  }

  const open = () => {
    if (!root.hidden) { input.focus(); input.select(); return; }
    back = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("cmdk-open");
    load();
    render();
    input.focus();
    input.select();
  };
  const close = () => {
    if (root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove("cmdk-open");
    if (back && back.focus) back.focus();
  };
  window.airratesSearch = open;

  input.addEventListener("input", () => { pick = null; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) { e.preventDefault(); mark(at + 1); }
    else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) { e.preventDefault(); mark(at - 1); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Enter") {
      const el = items[at];
      if (!el) return;
      e.preventDefault();
      if (el.href && (e.metaKey || e.ctrlKey)) { if (el.onPick) el.onPick(); window.open(el.href, "_blank", "noopener"); }
      else el.click();
    }
  });
  root.addEventListener("click", (e) => { if (e.target.closest("[data-cmdk-close]")) close(); });
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (root.hidden) open(); else close();
    } else if (e.key === "Escape" && !root.hidden) close();
  });
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  for (const k of document.querySelectorAll("[data-cmdk-kbd]")) k.textContent = mac ? "\\u2318K" : "Ctrl K";
  for (const b of document.querySelectorAll("[data-cmdk-open]")) {
    b.hidden = false;
    b.addEventListener("click", open);
    b.addEventListener("pointerenter", load, { once: true });
  }
})();`;
}
