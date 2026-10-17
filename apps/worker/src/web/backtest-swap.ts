import { retryDelay } from "./await";
import { CHART_SKELETON_JS } from "./chart-skeleton";

/**
 * The backtest page without page loads. Changing a leg, the size, a fee or the window, or swapping
 * the legs, fetches the page for the new address and swaps in its form and its view (the window
 * strip, the chart and the result), with the site's one chart placeholder over the chart meanwhile
 * (chart-skeleton.ts) and the figures around it pulsing. The address follows, so back and forward
 * work and every result is still a link.
 *
 * A pick runs at once, with no button to press: each is one request, and the worker caches each
 * result for an hour. A rate-limited or busy answer is asked again after the pause it names (the
 * same rule as await.ts); anything else that is not a page navigates there, so the server's own page
 * explains it. Changes made while one is loading are kept, and only the last one runs next.
 *
 * The chart's exchange picker ([data-bt-lines]) only shows and hides lines. Once the reader has used
 * it, their set is kept across swaps, with the two legs always added back: a newly picked leg is
 * never hidden by an older choice.
 *
 * Markup contract, set by pages.ts: form[data-bt] (data-loading: the placeholder's words),
 * [data-bt-view], a[data-bt-swap] for links that change the backtest, [data-bt-lines] with a
 * data-leg on each leg's tile, and data-venue on the chart's own line toggles (funding-chart.ts).
 * No backticks or dollar-brace in the script's own code: it is a template literal's text.
 */
export const BT_SCRIPT = `(() => {
  const form = () => document.querySelector("form[data-bt]");
  const view = () => document.querySelector("[data-bt-view]");
  if (!form() || !view() || !window.fetch || !window.DOMParser || !history.pushState) return;
  const retryDelay = ${retryDelay};
  ${CHART_SKELETON_JS}
  let busy = false, next = null, lines = null;

  const addressOf = (f) => {
    const url = new URL(f.action, location.href);
    const fields = new URLSearchParams();
    for (const [k, v] of new FormData(f)) if (String(v).trim() !== "") fields.append(k, v);
    url.search = fields.toString();
    return url.href;
  };

  // The reader's chart lines onto a view: its picker's tiles and the chart's own toggles.
  const showLines = (root) => {
    if (!lines) return;
    const picker = root.querySelector("[data-bt-lines]");
    const want = new Set(lines);
    if (picker) for (const tile of picker.querySelectorAll(".sx-tile input[data-leg]")) want.add(tile.value);
    let changed = null;
    if (picker) for (const tile of picker.querySelectorAll(".sx-tile input")) {
      if (tile.checked !== want.has(tile.value)) { tile.checked = want.has(tile.value); changed = changed || tile; }
    }
    if (changed) changed.dispatchEvent(new Event("change", { bubbles: true }));
    for (const box of root.querySelectorAll(".fchart-keys input[data-venue]")) {
      const on = want.has(box.dataset.venue);
      if (box.checked !== on) { box.checked = on; box.dispatchEvent(new Event("change")); }
    }
  };

  const page = async (url) => {
    const started = Date.now();
    for (let attempt = 0; ; attempt++) {
      let status = 0, after = null, text = null;
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        status = res.status;
        after = res.headers.get("retry-after");
        text = await res.text();
      } catch (_) {}
      if (status === 200) return text;
      const delay = retryDelay(status, attempt, after);
      if (delay === null || Date.now() - started + delay > 90e3) return null;
      await new Promise((done) => setTimeout(done, delay));
    }
  };

  const load = async (url, push) => {
    if (busy) { next = [url, push]; return; }
    busy = true;
    const v = view(), f = form();
    for (const p of document.querySelectorAll(".sx-pop[open]")) p.open = false;
    const chart = v.querySelector(".fchart");
    if (chart) skeletonInto(chart, f.dataset.loading);
    else v.querySelector(".bt-bar").after(chartSkeleton(f.dataset.loading));
    v.classList.add("chart-switching");
    v.setAttribute("aria-busy", "true");
    const html = await page(url);
    const doc = html === null ? null : new DOMParser().parseFromString(html, "text/html");
    const nv = doc && doc.querySelector("[data-bt-view]");
    const nf = doc && doc.querySelector("form[data-bt]");
    if (!nv || !nf) return void location.assign(url);
    if (push) history.pushState(null, "", url);
    document.title = doc.title;
    const iv = document.importNode(nv, true);
    const iff = document.importNode(nf, true);
    f.replaceWith(iff);
    v.replaceWith(iv);
    if (window.airratesFchart) window.airratesFchart(iv);
    if (window.airratesPicker) { window.airratesPicker(iv); window.airratesPicker(iff); }
    if (window.airratesHelp) window.airratesHelp(iv);
    showLines(iv);
    busy = false;
    if (next) { const [u, p] = next; next = null; load(u, p); }
  };

  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (!f.matches || !f.matches("form[data-bt]") || e.defaultPrevented) return;
    e.preventDefault();
    load(addressOf(f), true);
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    const picker = t.closest && t.closest("[data-bt-lines]");
    if (picker) {
      if (!t.matches(".sx-tile input")) return;
      lines = new Set([...picker.querySelectorAll(".sx-tile input")].filter((b) => b.checked).map((b) => b.value));
      for (const box of document.querySelectorAll("[data-bt-view] .fchart-keys input[data-venue]")) {
        const on = lines.has(box.dataset.venue);
        if (box.checked !== on) { box.checked = on; box.dispatchEvent(new Event("change")); }
      }
      return;
    }
    const f = t.form;
    if (!f || !f.matches("form[data-bt]") || t.matches("[data-vp-preset-name]")) return;
    if (f.requestSubmit) f.requestSubmit();
    else load(addressOf(f), true);
  });
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || !e.target.closest) return;
    const link = e.target.closest("a[data-bt-swap]");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    load(link.href, true);
  });
  const here = location.pathname;
  addEventListener("popstate", () => {
    if (location.pathname !== here) return void location.reload();
    load(location.href, false);
  });
})();`;
