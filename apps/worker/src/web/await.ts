/**
 * Links and forms that start a report the server builds on request (the pair backtest): the button
 * shows that it is working, and the page stays put until the report is ready, instead of the reader
 * staring at a frozen page wondering whether the click took.
 *
 * "Ready" is the report URL answering 200. The script polls that URL and only then navigates, so the
 * wait happens on the button and not on a blank tab. The worker caches every 200 at the edge before
 * it touches the rate limiter or the database (index.ts), so the navigation that follows is served
 * that same copy: one build, not two. A rate-limited or unavailable answer is polled again after a
 * pause; anything else (a 404, say) navigates at once, so the server's own page explains it.
 *
 * Markup contract, set by pages.ts:
 *   a[data-await]     a link to such a report; its own box carries the spinner
 *   form[data-await]  a GET form building one; the submit button carries the spinner
 */

/**
 * Milliseconds to wait before asking again, or null when the page should be shown now: either it is
 * ready, or waiting would not change the answer. Status 0 is a request that failed or timed out.
 *
 * Embedded in the page via toString, so it must not reference anything outside its own body.
 */
export function retryDelay(
  status: number,
  attempt: number,
  retryAfter: string | null,
): number | null {
  if (status !== 0 && status !== 429 && status !== 502 && status !== 503 && status !== 504)
    return null;
  // Seconds only; an HTTP-date Retry-After falls back to the backoff below.
  const asked = retryAfter === null || retryAfter.trim() === "" ? Number.NaN : Number(retryAfter);
  if (Number.isFinite(asked) && asked >= 0) return Math.min(60, Math.max(1, asked)) * 1e3;
  return Math.min(8e3, 1e3 * 2 ** attempt);
}

/** The browser half. No escapes or regexes, so unlike LIVE_SCRIPT it needs no String.raw. */
export const AWAIT_SCRIPT = `(() => {
  const retryDelay = ${retryDelay};
  if (!window.fetch || !window.AbortController) return;

  const GIVE_UP = 90e3; // past this, show whatever the server has, its error page included
  const ATTEMPT = 30e3; // a request still unanswered after this is abandoned and asked again
  // run identifies the current wait: a page restored from the back-forward cache resets it, so a wait
  // frozen mid-poll cannot wake up and navigate away from the page the reader came back to.
  let run = 0, busy = null;

  const label = (el, text) => {
    const spin = document.createElement("span");
    spin.className = "spin";
    spin.setAttribute("aria-hidden", "true");
    el.replaceChildren(spin, text);
  };
  const reset = () => {
    run++;
    if (!busy) return;
    const { el, children, width } = busy;
    busy = null;
    el.replaceChildren(...children);
    el.style.minWidth = width;
    el.removeAttribute("aria-busy");
  };

  const wait = async (el, url) => {
    const token = ++run;
    busy = { el, children: [...el.childNodes], width: el.style.minWidth };
    // Held at its current width so the row beside it does not jump as the label changes.
    el.style.minWidth = el.offsetWidth + "px";
    el.setAttribute("aria-busy", "true");
    label(el, "Building report");
    const started = Date.now();
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ATTEMPT);
      let status = 0, retryAfter = null;
      try {
        const res = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
        retryAfter = res.headers.get("retry-after");
        // Read to the end, so the copy the navigation reuses is a whole one.
        await res.arrayBuffer();
        status = res.status;
      } catch {
        status = 0;
      } finally {
        clearTimeout(timeout);
      }
      if (token !== run) return;
      const delay = retryDelay(status, attempt, retryAfter);
      if (delay === null || Date.now() - started + delay > GIVE_UP) return void location.assign(url);
      label(el, "Still building");
      await new Promise((done) => setTimeout(done, delay));
      if (token !== run) return;
    }
  };

  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[data-await]") : null;
    if (!link || event.defaultPrevented) return;
    // A new tab or window is the reader's own choice of how to wait.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
    event.preventDefault();
    if (!busy) wait(link, link.href);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-await") || event.defaultPrevented) return;
    if (form.method !== "get") return;
    event.preventDefault();
    if (busy) return;
    // What the browser would have built itself: the form's fields replace the action's query.
    const url = new URL(form.action);
    url.search = new URLSearchParams(new FormData(form)).toString();
    const button = event.submitter || form.querySelector("button[type=submit], button:not([type])");
    if (button) wait(button, url.href);
    else location.assign(url.href);
  });

  addEventListener("pageshow", (event) => event.persisted && reset());
})();`;
