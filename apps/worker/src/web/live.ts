/**
 * Live refresh for the data pages: re-fetch the page's own URL, swap in the regions that changed,
 * and flash the cells whose displayed value moved.
 *
 * The page itself rather than a JSON feed, because the server stays the only place a number is
 * formatted: a refreshed cell can never read differently from a reload. The edge cache absorbs the
 * polling, so a thousand open tabs still cost one query per URL per 30 s, and on the wire the pages
 * are 5–15 kB brotli — a bespoke diff feed would barely beat that and would duplicate every format.
 *
 * Markup contract, set by pages.ts and layout.ts:
 *   body[data-rendered]  render time; an unchanged stamp means the edge served the same copy
 *   [data-live="name"]   a region replaced wholesale on refresh (a tbody, the hero, the status line)
 *   tr[data-k]           a row's identity, so a re-sorted table still matches row to row
 *   td[data-c]           a column's identity where columns can move (the rates grid's venues)
 *   [data-u]             one figure flashed on its own: inside a row it is scoped to that row, and
 *                        its text is left out of the enclosing cell's or unit's comparison
 */

export type Change = "up" | "down" | "text" | "new";

/**
 * The number a cell shows, read back from its text, or null when the text is not a single figure.
 * Reading what is displayed rather than a raw attribute keeps the flash honest: it fires only when
 * the reader can see the value move, never on drift below the displayed precision.
 *
 * Embedded in the page via toString, so it must not reference anything outside its own body.
 */
export function parseShown(text: string): number | null {
  const shown = text.replace(/,/g, "").trim();
  if (shown === "flat") return 0;
  const match = /^([+−↑↓-])?\s*\$?(\d+(?:\.\d+)?)\s*([kMB])?[%h×m]?$/.exec(shown);
  if (!match) return null;
  const scale = match[3] === "B" ? 1e9 : match[3] === "M" ? 1e6 : match[3] === "k" ? 1e3 : 1;
  const value = Number(match[2]) * scale;
  return match[1] === "−" || match[1] === "-" || match[1] === "↓" ? -value : value;
}

/**
 * Which units changed between two renders, and which way. A key present only after the refresh is
 * "new"; a key that vanished needs nothing, since its element is already gone. An empty `before`
 * reports nothing, so a region that was empty never lights up wholesale.
 *
 * `parse` is a parameter rather than an import for the same reason as above: the page script gets
 * this function's source, not its module.
 */
export function changes(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
  parse: (text: string) => number | null,
): [string, Change][] {
  const found: [string, Change][] = [];
  if (before.size === 0) return found;
  for (const [key, text] of after) {
    const previous = before.get(key);
    if (previous === undefined) {
      found.push([key, "new"]);
      continue;
    }
    if (previous === text) continue;
    const from = parse(previous);
    const to = parse(text);
    found.push([
      key,
      from === null || to === null || from === to ? "text" : to > from ? "up" : "down",
    ]);
  }
  return found;
}

/**
 * The browser half. String.raw so the regexes and escapes reach the page exactly as written.
 *
 * Direction colours: a rise flashes green, a fall red, both at the same ~58% alpha so neither reads
 * louder. The flash is brief and fades back to the cell's own tone. On the rates grid it is a
 * border in the same colours, solid, because that grid's fills already mean funding. A change that
 * is not a comparable figure (a leg moving venue, say) flashes a faint neutral white instead.
 */
export const LIVE_SCRIPT = String.raw`(() => {
  const parseShown = ${parseShown};
  const changes = ${changes};
  if (!document.querySelector("main [data-live]") || !window.DOMParser) return;

  const PERIOD = 30e3; // the pages' edge max-age
  const TINT = { up: "#00ff8893", down: "#ff475793", text: "rgba(216,216,216,.16)", new: "rgba(216,216,216,.1)" };
  const EDGE = { up: "#00ff88", down: "#ff4757", text: "rgba(216,216,216,.6)", new: "rgba(216,216,216,.4)" };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let rendered = document.body.dataset.rendered;
  let pending = null, heldSince = 0, timer = 0, controller = null, lastPoll = 0, failures = 0;

  // Clocks tick every second on their own, so their text is never evidence of new data. A nested
  // [data-u] is its own unit, so it is left out too: an open-interest figure moving inside a leg
  // cell flashes that figure with a direction, not the whole cell as neutral text.
  const signature = (el) => {
    if (!el.querySelector("time, [data-u]")) return el.textContent.replace(/\s+/g, " ").trim();
    const copy = el.cloneNode(true);
    for (const t of copy.querySelectorAll("time, [data-u]")) t.remove();
    return copy.textContent.replace(/\s+/g, " ").trim();
  };
  const units = (region) => {
    const found = new Map();
    for (const row of region.querySelectorAll("tr[data-k]")) {
      let i = 0;
      for (const cell of row.children) found.set(row.dataset.k + "\t" + (cell.dataset.c ?? i), cell), i++;
      // Scoped to the row, since every row carries the same unit names.
      for (const el of row.querySelectorAll("[data-u]")) found.set(row.dataset.k + "\tu\t" + el.dataset.u, el);
    }
    for (const el of region.querySelectorAll("[data-u]")) if (!el.closest("tr[data-k]")) found.set("u\t" + el.dataset.u, el);
    return found;
  };
  const texts = (map) => new Map([...map].map(([key, el]) => [key, signature(el)]));

  // Rail parts keyed by their rail (its row, then its place among that row's rails) and their role:
  // the zero tick, the spread bar, or a mark by its data-m.
  const railParts = (region) => {
    const found = new Map();
    for (const rail of region.querySelectorAll(".rail")) {
      const row = rail.closest("tr[data-k]");
      const id = (row ? row.dataset.k : "") + "\t" + [...(row ?? region).querySelectorAll(".rail")].indexOf(rail) + "\t";
      for (const part of rail.children) found.set(id + (part.dataset.m ? "m\t" + part.dataset.m : part.className), part);
    }
    return found;
  };
  // A mark's colour comes from its tone class, so it is read computed: once the old element is
  // replaced there is nothing left to ask what blue or red it was.
  const positions = (region) =>
    new Map([...railParts(region)].map(([key, part]) => {
      const was = { left: part.style.left, width: part.style.width, tone: part.className };
      if (part.dataset.m) {
        const style = getComputedStyle(part);
        was.fill = style.backgroundColor;
        was.edge = style.borderColor;
      }
      return [key, was];
    }));

  // Indicators ease out from where they were to where they are, alongside the flash, instead of
  // jumping. When a rate crosses zero its mark changes tone, and the colour travels with it on the
  // same curve: blue passes through violet into red just as the rail's own gradient does. A mark
  // with no previous position (a venue newly listed) fades in.
  const slide = (before, region) => {
    if (still.matches || before.size === 0) return;
    for (const [key, part] of railParts(region)) {
      const was = before.get(key);
      if (!was) {
        if (part.dataset.m) part.animate([{ offset: 0, opacity: 0 }], { duration: 600 });
        continue;
      }
      const from = { offset: 0 };
      if (was.left !== part.style.left) from.left = was.left;
      if (was.width !== part.style.width && was.width) from.width = was.width;
      if (was.fill !== undefined && was.tone !== part.className) {
        from.backgroundColor = was.fill;
        from.borderColor = was.edge;
      }
      if (Object.keys(from).length > 1) part.animate([from], { duration: 700, easing: "cubic-bezier(.2,0,.2,1)" });
    }
  };

  // One starting value that eases back to whatever the cell already had. The rates grid already
  // speaks in red and blue fills, so there the flash is an inset border instead: a red fill would
  // be indistinguishable from a cell that is red because funding is high.
  const flash = (el, change) => {
    if (!el) return;
    if (still.matches) return el.classList.add("chg", "chg-" + change);
    const from = el.closest("table.heat") ? { boxShadow: "inset 0 0 0 2px " + EDGE[change] } : { backgroundColor: TINT[change] };
    el.animate([{ offset: 0, ...from }], { duration: change === "new" ? 1800 : 1400, easing: "cubic-bezier(.2,0,.2,1)" });
  };

  const apply = (doc) => {
    for (const el of document.querySelectorAll(".chg")) el.classList.remove("chg", "chg-up", "chg-down", "chg-text", "chg-new");
    const here = [...document.querySelectorAll("[data-live]")];
    const there = [...doc.querySelectorAll("[data-live]")];
    const aligned = here.length === there.length && here.every((el, i) => el.dataset.live === there[i].dataset.live);
    if (!aligned) {
      // An empty state became a table, or the reverse: nothing lines up to compare, so take the page.
      const main = doc.querySelector("main"), status = doc.querySelector(".mast .status");
      if (main) document.querySelector("main").innerHTML = main.innerHTML;
      if (status) document.querySelector(".mast .status").replaceWith(document.importNode(status, true));
      return;
    }
    here.forEach((el, i) => {
      const before = texts(units(el));
      const rails = positions(el);
      el.innerHTML = there[i].innerHTML;
      const after = units(el);
      for (const [key, change] of changes(before, texts(after), parseShown)) flash(after.get(key), change);
      slide(rails, el);
    });
  };

  // Rows never move under a pointer or an open filter; the hold lasts one period at most.
  const engaged = () => document.querySelector("main [data-live]:hover, form.filters:focus-within") !== null;
  const settle = () => {
    if (!pending) return;
    if (engaged() && Date.now() - heldSince < PERIOD) return void setTimeout(settle, 1e3);
    const doc = pending;
    pending = null;
    apply(doc);
  };

  const markStale = () => {
    const status = document.querySelector(".mast .status");
    if (!status) return;
    const since = status.querySelector("time[data-since]");
    const old = since !== null && Date.now() - Number(since.dataset.since) > 180e3;
    status.classList.toggle("stale", failures >= 3 || old);
  };

  const schedule = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  };
  const poll = async () => {
    if (document.hidden) return;
    controller?.abort();
    controller = new AbortController();
    lastPoll = Date.now();
    let next = PERIOD + 1e3;
    try {
      const res = await fetch(location.href, { signal: controller.signal, cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      // Land just after the edge copy expires, so the next request is a fresh render rather than
      // a second read of the copy this one got. Jitter spreads tabs that loaded together.
      const age = Number(res.headers.get("age")) || 0;
      next = Math.min(60, Math.max(5, 30 - age)) * 1e3 + 500 + Math.random() * 1500;
      const html = await res.text();
      failures = 0;
      const stamp = /data-rendered="(\d+)"/.exec(html);
      if (stamp && stamp[1] !== rendered) {
        rendered = stamp[1];
        const doc = new DOMParser().parseFromString(html, "text/html");
        if (pending) pending = doc;
        else {
          pending = doc;
          heldSince = Date.now();
          settle();
        }
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      failures++;
    }
    markStale();
    schedule(next);
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer);
      controller?.abort();
      return;
    }
    const elapsed = Date.now() - lastPoll;
    schedule(elapsed >= PERIOD ? 0 : PERIOD - elapsed);
  });
  addEventListener("pageshow", (event) => event.persisted && schedule(0));

  lastPoll = Date.now();
  const loaded = Number(rendered) || Date.now();
  schedule(Math.min(PERIOD, Math.max(5e3, loaded + PERIOD + 1e3 - Date.now())));
  markStale();
  setInterval(markStale, 5e3);
})();`;
