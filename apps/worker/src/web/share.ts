/**
 * Two ways out of a page and onto X, both in the masthead so every page has them in one place:
 *
 *   ⇪ chart  the chart in view, redrawn onto a 1600×900 card (X's own 16:9, so the timeline shows
 *            it uncropped) with the title, the legend, the axes and the address it came from.
 *   ❝ cite   one line worth quoting, picked from what the page itself says, with a link back to
 *            the exact page, venue and filters it was read on.
 *
 * Modelled on askthetape.com's "Share your line" and "Cite / embed" dialogs, in this site's terms.
 *
 * WHERE THE LINES COME FROM. The server marks each quotable figure with `citeMark`, inside the
 * region that live refresh replaces, so a line is always the page's current number and never one
 * the reader can no longer see. The dialog gathers every mark in document order; a page with none
 * falls back to its own heading and lede, so the button is never dead.
 *
 * WHY THE CHART IS REDRAWN rather than screenshotted: the plots are SVG stretched to their box with
 * HTML labels laid over them, so the script copies each SVG with its computed colours inlined
 * (a standalone SVG cannot read the page's CSS variables), rasterises it into the card, and draws
 * the labels at the same fractions of the box they sat at on screen. No library, no network.
 *
 * With no chart in view -- a table page, or a tab whose panel is hidden -- the chart button is
 * disabled rather than removed, so the masthead does not shift as the reader moves between tabs.
 */

import { esc } from "./format";

/**
 * A quotable line, hidden, for the cite dialog to find. `text` is plain text: it is escaped here,
 * once. `href` is the page the line should link back to when it is not the page it sits on — a
 * table row naming one pair links to that pair's page.
 *
 * Place it INSIDE a `data-live` region, never on one: live refresh swaps the region's children,
 * so a mark on the region itself would keep quoting the number the page loaded with.
 */
export function citeMark(text: string, href?: string): string {
  return `<span hidden data-cite="${esc(text)}"${href ? ` data-cite-href="${esc(href)}"` : ""}></span>`;
}

/** A label rendered as HTML (an asset name with its class tag), back to the words it says. */
export const plainLabel = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** The masthead's two buttons. The chart one starts disabled; the script enables it on a chart. */
export const SHARE_BAR = `<span class="share-acts"><button type="button" class="share-btn" data-share-chart disabled title="Share the chart in view as an image sized for X">⇪ chart</button><button type="button" class="share-btn" data-share-cite title="Quote this page's best line, with a link back to it">❝ cite</button></span>`;

export const SHARE_CSS = `
.share-acts{display:flex;gap:4px;flex-shrink:0}
.share-btn{font:700 11px/14px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--muted);background:transparent;border:1px solid var(--rule);padding:0 6px;cursor:pointer;white-space:nowrap}
.share-btn:hover:not(:disabled){color:var(--accent);border-color:var(--accent)}
.share-btn:disabled{opacity:.35;cursor:not-allowed}
.dlg{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:20;padding:16px}
.dlg .box{width:min(560px,100%);background:var(--panel);border:1px solid var(--rule);padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 18px 50px rgba(0,0,0,.6);max-height:92vh;overflow:auto}
.dlg .hd{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.dlg .hd b{font-size:15px;text-transform:uppercase;letter-spacing:.04em}
.dlg img{width:100%;display:block;background:var(--bg);border:1px solid var(--rule);aspect-ratio:16/9}
.dlg .row{display:flex;gap:8px;align-items:center}
.dlg .url{flex:1 1 auto;min-width:0;padding:6px 8px;background:var(--bg);border:1px solid var(--rule);color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dlg small{color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-size:11px}
.dlg p{color:var(--muted);line-height:1.45}
.dlg .acts{display:flex;flex-wrap:wrap;gap:6px}
.dlg button.btn,.dlg a.btn{font:700 12px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--bg);background:var(--ink);border:1px solid var(--ink);padding:4px 10px;cursor:pointer;text-decoration:none}
.dlg .btn.ghost{background:transparent;color:var(--ink);border-color:var(--rule)}
.dlg .btn.x{background:var(--accent);border-color:var(--accent)}
.dlg .btn:hover{filter:brightness(1.15)}
.dlg .picks{display:flex;flex-direction:column;gap:4px}
.dlg .picks label{display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border:1px solid var(--rule);cursor:pointer;line-height:1.4}
.dlg .picks label:has(input:checked){border-color:var(--accent);color:var(--ink)}
.dlg .picks input{margin:2px 0 0;accent-color:var(--accent)}
.dlg textarea{width:100%;min-height:92px;resize:vertical;background:var(--bg);color:var(--ink);border:1px solid var(--rule);padding:8px;font:13px/1.45 var(--mono)}
.dlg .count{text-align:right}
.dlg .count.over{color:var(--short)}
@media (max-width:560px){.brand small,.clock{display:none}}
`;

/**
 * The browser half. String.raw so the regexes reach the page as written; no template literals
 * inside, so nothing in it is interpolated by accident.
 */
export const SHARE_SCRIPT = String.raw`(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const chartBtn = $("[data-share-chart]");
  const citeBtn = $("[data-share-cite]");
  if (!chartBtn || !citeBtn) return;
  const ga = (name, params) => { try { if (window.gtag) window.gtag("event", name, params || {}); } catch (e) {} };
  const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const shown = (el) => !!el && el.getClientRects().length > 0 && el.offsetWidth > 0;
  const W = 1600, H = 900, PAD = 64;
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  // Every figure in main drawing an SVG and visible now; the one nearest the middle of the viewport
  // is the one the reader is looking at.
  const charts = () => $$("main figure").filter((f) => $("svg", f) && shown(f));
  const pickChart = () => {
    const mid = innerHeight / 2;
    let best = null, gap = Infinity;
    for (const f of charts()) {
      const r = f.getBoundingClientRect();
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < gap) { gap = d; best = f; }
    }
    return best;
  };
  const sync = () => {
    const n = charts().length;
    chartBtn.disabled = n === 0;
    chartBtn.title = n ? "Share the chart in view as an image sized for X" : "No chart on this view";
  };
  let queued = false;
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; sync(); }); } };
  const main = $("main");
  if (main) new MutationObserver(later).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  addEventListener("resize", later);
  addEventListener("hashchange", later);
  sync();

  // The link back: this page, its filters and tab, tagged so a visit from X counts under its source.
  const backLink = (href) => {
    const u = new URL(href || location.href, location.href);
    u.searchParams.set("ref", "x");
    return u.toString();
  };
  const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const dialog = (label, inner) => {
    const old = $(".dlg");
    if (old) old.remove();
    const dlg = document.createElement("div");
    dlg.className = "dlg";
    dlg.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-label="' + escH(label) + '"><div class="hd"><b>' + escH(label) + '</b><button type="button" class="btn ghost" data-x>close</button></div>' + inner + "</div>";
    document.body.appendChild(dlg);
    const close = () => { dlg.remove(); removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", onKey);
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-x]")) close(); });
    const x = $("[data-x]", dlg);
    if (x) x.focus();
    return dlg;
  };
  const copyText = async (button, value, kind) => {
    ga("share_copy", { kind });
    try { await navigator.clipboard.writeText(value); button.textContent = "Copied"; }
    catch (e) {
      const t = button.parentElement.querySelector(".url,textarea");
      if (t) { const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      button.textContent = "Select + copy";
    }
  };
  const postOnX = (line, link, kind) => {
    ga("share_x", { kind });
    open("https://x.com/intent/post?text=" + encodeURIComponent(line) + "&url=" + encodeURIComponent(link), "_blank", "noopener");
  };

  // ---- cite -----------------------------------------------------------------------------------

  const lines = () => {
    const seen = new Set();
    const out = [];
    for (const el of $$("main [data-cite]")) {
      const t = (el.dataset.cite || "").trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ text: t, href: el.dataset.citeHref || "" });
    }
    if (out.length === 0) {
      const h = text($("main h1"));
      const lede = text($("main .lede")).split(/(?<=\.)\s/)[0] || "";
      const t = h && lede ? h + ": " + lede : h || lede || document.title;
      out.push({ text: t, href: "" });
    }
    return out.slice(0, 6);
  };
  // X counts any link as 23 characters, plus the space before it.
  const room = (t) => 280 - 24 - [...t].length;

  citeBtn.addEventListener("click", () => {
    const picks = lines();
    ga("cite_open", { lines: picks.length });
    const list = picks.map((p, i) => '<label><input type="radio" name="cite" value="' + i + '"' + (i === 0 ? " checked" : "") + "><span>" + escH(p.text) + "</span></label>").join("");
    const dlg = dialog("Cite this page",
      (picks.length > 1 ? '<div><small>Pick the line · the page' + "'" + 's own numbers, as they read now</small></div><div class="picks">' + list + "</div>" : "") +
      '<div><small>Your post · edit it freely</small><textarea data-line></textarea><div class="count"><small data-count></small></div></div>' +
      '<div><small>Back-link · this exact page, venue and filters</small><div class="row"><span class="url" data-link></span><button type="button" class="btn ghost" data-copy-link>Copy</button></div></div>' +
      '<div class="acts"><button type="button" class="btn x" data-post>Post on X</button><button type="button" class="btn" data-copy-all>Copy line + link</button></div>' +
      "<p>Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: " + escH(stamp()) + ". Not financial advice.</p>");
    const area = $("[data-line]", dlg), count = $("[data-count]", dlg), linkEl = $("[data-link]", dlg);
    let link = "";
    const choose = (i) => {
      const p = picks[i] || picks[0];
      area.value = p.text;
      link = backLink(p.href);
      linkEl.textContent = link;
      recount();
    };
    const recount = () => {
      const left = room(area.value);
      count.textContent = left + " characters left with the link";
      count.parentElement.classList.toggle("over", left < 0);
    };
    area.addEventListener("input", recount);
    $$("input[name=cite]", dlg).forEach((r) => r.addEventListener("change", () => choose(Number(r.value))));
    choose(0);
    $("[data-copy-link]", dlg).onclick = (e) => copyText(e.currentTarget, link, "cite_link");
    $("[data-copy-all]", dlg).onclick = (e) => copyText(e.currentTarget, area.value.trim() + "\n" + link, "cite_line");
    $("[data-post]", dlg).onclick = () => postOnX(area.value.trim(), link, "cite");
  });

  // ---- chart image ----------------------------------------------------------------------------

  // Colours live in CSS variables a standalone SVG cannot see, so each shape carries its computed
  // paint inline. Hover furniture (cursor, hover band) is dropped: the card is the whole chart.
  const PAINT = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "shape-rendering"];
  const svgImage = (svg, w, h, grow) => {
    const clone = svg.cloneNode(true);
    const src = [svg, ...svg.querySelectorAll("*")];
    const dst = [clone, ...clone.querySelectorAll("*")];
    const drop = [];
    src.forEach((el, i) => {
      const c = dst[i];
      const cs = getComputedStyle(el);
      const cls = el.getAttribute("class") || "";
      if (cs.display === "none" || cs.visibility === "hidden" || /cursor|slot-band|slot-mark/.test(cls)) { if (i) drop.push(c); return; }
      let style = "";
      for (const p of PAINT) {
        let v = cs.getPropertyValue(p);
        if (!v) continue;
        if (p === "stroke-width" && cs.getPropertyValue("vector-effect") === "non-scaling-stroke") v = (parseFloat(v) * grow).toFixed(2) + "px";
        style += p + ":" + v + ";";
      }
      if (cs.getPropertyValue("vector-effect") === "non-scaling-stroke") style += "vector-effect:non-scaling-stroke;";
      c.setAttribute("style", style);
      c.removeAttribute("class");
    });
    drop.forEach((c) => c.remove());
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(Math.round(w)));
    clone.setAttribute("height", String(Math.round(h)));
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    });
  };

  const fit = (g, s, max) => {
    if (g.measureText(s).width <= max) return s;
    while (s.length > 4 && g.measureText(s + "…").width > max) s = s.slice(0, -1);
    return s + "…";
  };

  const render = async (fig) => {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const C = { bg: css("--bg", "#000"), ink: css("--ink", "#d8d8d8"), mut: css("--muted", "#7a7a7a"), dim: css("--dim", "#494949"), rule: css("--rule", "#242424"), acc: css("--accent", "#c8f5a8") };
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = C.acc; g.fillRect(0, 0, W, 6);
    g.textBaseline = "alphabetic";

    // Masthead: the brand left, the moment right.
    g.font = "700 22px " + MONO; g.fillStyle = C.ink; g.fillText("AIRRATES", PAD, 58);
    const bw = g.measureText("AIRRATES").width;
    g.font = "400 18px " + MONO; g.fillStyle = C.mut; g.fillText("funding carry sheet", PAD + bw + 14, 58);
    g.textAlign = "right"; g.fillText(stamp(), W - PAD, 58); g.textAlign = "left";

    // Title: the chart's own, else its caption, else the page heading.
    const title = text($(".fchart-title", fig)) || text($("figcaption", fig)) || text($("main h1")) || document.title;
    g.font = "700 38px " + MONO; g.fillStyle = C.ink;
    g.fillText(fit(g, title, W - 2 * PAD), PAD, 118);

    // Legend: every key still switched on, with its swatch.
    let lx = PAD, ly = 160;
    g.font = "400 18px " + MONO;
    const keys = $$(".fchart-keys > *", fig).filter((k) => { const box = $("input[type=checkbox]", k); return !(box && !box.checked) && text(k); });
    for (let ki = 0; ki < keys.length; ki++) {
      const k = keys[ki];
      const label = text(k);
      const sw = $("i", k);
      const w = g.measureText(label).width + (sw ? 26 : 0);
      if (lx + w > W - PAD) { lx = PAD; ly += 28; }
      // Three rows at most; say how many were left off rather than dropping them silently.
      if (ly > 216 || (ly > 188 && lx + w + g.measureText("+99 more").width + 28 > W - PAD && ki < keys.length - 1)) {
        g.fillStyle = C.dim; g.fillText("+" + (keys.length - ki) + " more", lx, ly);
        break;
      }
      if (sw) {
        const s = getComputedStyle(sw);
        const bg = s.backgroundColor, bc = s.borderTopColor;
        g.fillStyle = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" ? bg : bc || C.mut;
        g.fillRect(lx, ly - 13, 16, 14);
        lx += 24;
      }
      g.fillStyle = C.mut; g.fillText(label, lx, ly);
      lx += g.measureText(label).width + 28;
    }

    // Plots: each stretched SVG and the labels laid over it, stacked by their on-screen heights.
    const plots = $$(".fchart-plot", fig).filter(shown);
    const parts = plots.length ? plots : $$("svg", fig).filter(shown);
    const top = ly + 34, bottom = H - 96;
    const hasLeft = parts.some((p) => $$(":scope > :not(svg)", p).some((l) => { const r = l.getBoundingClientRect(), R = p.getBoundingClientRect(); return shown(l) && r.right <= R.left + 2; }));
    const hasRight = parts.some((p) => $$(":scope > :not(svg)", p).some((l) => { const r = l.getBoundingClientRect(), R = p.getBoundingClientRect(); return shown(l) && r.left >= R.right - 2; }));
    const x0 = PAD + (hasLeft ? 110 : 0), x1 = W - PAD - (hasRight ? 110 : 0);
    const heights = parts.map((p) => p.getBoundingClientRect().height || 1);
    const gaps = 40 * (parts.length - 1) + 30;
    const scale = (bottom - top - gaps) / heights.reduce((a, b) => a + b, 0);
    let y = top;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const R = p.getBoundingClientRect();
      const h = heights[i] * scale, w = x1 - x0;
      const svg = p.tagName.toLowerCase() === "svg" ? p : $("svg", p);
      if (svg) {
        const grow = Math.max(1, Math.min(2.5, Math.min(w / R.width, h / R.height)));
        const img = await svgImage(svg, w, h, grow);
        if (img) g.drawImage(img, x0, y, w, h);
      }
      g.font = "400 16px " + MONO;
      for (const l of $$(":scope > :not(svg)", p)) {
        if (!shown(l)) continue;
        const t = text(l);
        if (!t) continue;
        const r = l.getBoundingClientRect();
        const fx = (r.left + r.width / 2 - R.left) / R.width;
        const fy = (r.top + r.height / 2 - R.top) / R.height;
        g.fillStyle = getComputedStyle(l).color || C.mut;
        if (r.right <= R.left + 2) { g.textAlign = "right"; g.fillText(t, x0 - 12, y + fy * h + 6); }
        else if (r.left >= R.right - 2) { g.textAlign = "left"; g.fillText(t, x1 + 12, y + fy * h + 6); }
        else if (fy > 1) { g.textAlign = "center"; g.fillText(t, x0 + fx * w, y + h + 24); }
        else { g.textAlign = "center"; g.fillText(t, x0 + fx * w, y + fy * h + 6); }
        g.textAlign = "left";
      }
      y += h + 40;
    }

    // Footer: where it came from, and that it is not advice.
    g.fillStyle = C.rule; g.fillRect(PAD, H - 64, W - 2 * PAD, 1);
    g.font = "700 18px " + MONO; g.fillStyle = C.acc;
    g.fillText(fit(g, location.host + location.pathname, W / 2), PAD, H - 30);
    g.font = "400 16px " + MONO; g.fillStyle = C.dim; g.textAlign = "right";
    g.fillText("public venue APIs · not financial advice", W - PAD, H - 30);
    g.textAlign = "left";
    return cv;
  };

  chartBtn.addEventListener("click", async () => {
    const fig = pickChart();
    if (!fig) { sync(); return; }
    ga("share_chart_open", { page: location.pathname });
    const link = backLink();
    const title = text($(".fchart-title", fig)) || text($("main h1")) || document.title;
    const cite = lines()[0];
    const line = cite ? cite.text : title;
    const dlg = dialog("Share your line",
      '<img alt="chart image" data-img>' +
      "<small>Image · 1600 × 900, X" + "'" + "s own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.</small>" +
      '<div class="acts"><button type="button" class="btn x" data-post>Post on X</button><button type="button" class="btn" data-copy-img>Copy image</button><button type="button" class="btn ghost" data-dl>Download PNG</button></div>' +
      '<div><small>Link · this exact view</small><div class="row"><span class="url">' + escH(link) + '</span><button type="button" class="btn ghost" data-copy-link>Copy</button></div></div>' +
      "<p>Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues" + "'" + ", the call is yours.</p>");
    const imgEl = $("[data-img]", dlg);
    let blob = null;
    const cv = await render(fig);
    const ready = new Promise((ok) => cv.toBlob((b) => ok(b), "image/png"));
    ready.then((b) => { blob = b; if (b) imgEl.src = URL.createObjectURL(b); else imgEl.alt = "the image could not be drawn in this browser"; });
    $("[data-copy-link]", dlg).onclick = (e) => copyText(e.currentTarget, link, "chart_link");
    $("[data-post]", dlg).onclick = () => postOnX(line, link, "chart");
    $("[data-dl]", dlg).onclick = async () => {
      const b = blob || (await ready);
      if (!b) return;
      ga("share_chart_download", {});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "airrates-" + (location.pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home") + ".png";
      a.click();
    };
    $("[data-copy-img]", dlg).onclick = async (e) => {
      const button = e.currentTarget;
      ga("share_chart_copy", {});
      try {
        // A promise, not a blob: Safari only allows the write inside the click's own task.
        await navigator.clipboard.write([new ClipboardItem({ "image/png": ready })]);
        button.textContent = "Copied";
      } catch (err) { button.textContent = "Copy blocked — download instead"; }
    };
  });
})();`;
