/**
 * Hover reading for the bar charts that divide a window into equal time slots: the CVD chart and the
 * liquidations longs-vs-shorts chart.
 *
 * WHY THIS REPLACED A NATIVE <title> PER BAR. The title was the only readout, and it answered badly:
 * it appears after a delay, only over the bar's own hit box, never on a phone, and it covers the bars
 * beside the one being read. Here the pointer anywhere over the plot picks the slot under it, a
 * cursor line and a band mark that slot on every panel, and its figures replace the header readout,
 * so nothing floats over the chart. The same slot's numbers stay readable while the pointer scrubs.
 *
 * ONE DELEGATED LISTENER ON THE DOCUMENT, not a binding per chart. live.ts refreshes a chart by
 * swapping its figure's innerHTML, and scripts set through innerHTML never run, so a per-figure
 * binding would go dead on the first refresh. The document outlives every swap; each event finds its
 * figure with closest() and reads that figure's own payload, which is also what keeps two charts on
 * one page (the liquidations tabs) apart.
 *
 * THE TEXT IS WRITTEN ONCE. `cvdText` and `sidesText` build the readout both on the server, for the
 * whole-window line a reader sees before hovering (and all a reader without JavaScript gets), and in
 * the browser, for one slot. They reach the page through toString, as live.ts's helpers do, so they
 * must not reference anything outside their own bodies and must not declare inner named functions,
 * which a bundler's keep-names pass would wrap in a helper the page does not have.
 */

/** The formatters the readout uses, handed in so the text functions stay self-contained. */
export interface SlotFormat {
  usd: (value: number) => string;
  price: (value: number) => string;
  pct: (value: number, digits: number) => string;
  when: (ms: number) => string;
}

/** Compact dollars, identical to format.ts's `formatUsd` for any finite number (a test holds them). */
export function slotUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const size = abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
  if (size === 1) return `${sign}$${abs.toFixed(0)}`;
  const scaled = abs / size;
  const suffix = size === 1e9 ? "B" : size === 1e6 ? "M" : "k";
  return `${sign}$${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)}${suffix}`;
}

/** Prices, identical to format.ts's `formatPrice` for any finite number. */
export function slotPrice(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (abs >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return value.toPrecision(4);
}

/** Signed percent with the site's minus: "+0.12%", "−42.9%", and an unsigned zero. */
export function slotPct(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return `${(0).toFixed(digits)}%`;
  return `${value < 0 ? "−" : "+"}${text}%`;
}

/** "Sep 17 14:15 UTC". */
export function slotWhen(ms: number): string {
  const d = new Date(ms);
  const month = "JanFebMarAprMayJunJulAugSepOctNovDec".slice(
    d.getUTCMonth() * 3,
    d.getUTCMonth() * 3 + 3,
  );
  return `${month} ${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export const SLOT_FORMAT: SlotFormat = {
  usd: slotUsd,
  price: slotPrice,
  pct: slotPct,
  when: slotWhen,
};

/**
 * One CVD reading: a slot's bar, or the whole window's sums. `bar` is [bought, sold, price or null],
 * or null for a slot with no recorded flow. `cvd` is the running total at that point, or null to
 * leave it out -- over the whole window it would only repeat the net. `open` is the window's first
 * price, the base for the change.
 */
export function cvdText(
  head: string,
  bar: readonly [number, number, number | null] | null,
  cvd: number | null,
  open: number | null,
  f: SlotFormat,
): string {
  const tail =
    cvd === null
      ? ""
      : ` · CVD <b class="${cvd > 0 ? "cvd-up" : cvd < 0 ? "cvd-down" : ""}">${cvd > 0 ? "+" : ""}${f.usd(cvd)}</b>`;
  if (bar === null) return `${head} · no flow recorded${tail}`;
  const [bought, sold, price] = bar;
  const net = bought - sold;
  const volume = bought + sold;
  const parts = [head];
  if (price !== null) {
    parts.push(
      `price ${f.price(price)}${open ? ` (${f.pct((price / open - 1) * 100, 2)} since start)` : ""}`,
    );
  }
  parts.push(`bought ${f.usd(bought)}`, `sold ${f.usd(sold)}`);
  parts.push(
    `net <b class="${net > 0 ? "cvd-up" : net < 0 ? "cvd-down" : ""}">${net > 0 ? "+" : ""}${f.usd(net)}</b>${
      volume > 0 ? ` (${f.pct((net / volume) * 100, 1)} of volume)` : ""
    }`,
  );
  return parts.join(" · ") + tail;
}

/**
 * One longs-vs-shorts reading: [longs closed, shorts closed, events] for a slot or the window, or
 * null for a slot where nothing was force-closed. The difference is longs less shorts, so its sign
 * says which side the move ran against, in that side's colour.
 */
export function sidesText(
  head: string,
  sides: readonly [number, number, number] | null,
  f: SlotFormat,
): string {
  if (sides === null) return `${head} · nothing force-closed`;
  const [longs, shorts, events] = sides;
  const diff = longs - shorts;
  const heavier =
    diff === 0
      ? "even"
      : `${diff > 0 ? "longs" : "shorts"} heavier, ${Math.round((Math.max(longs, shorts) / (longs + shorts)) * 100)}%`;
  return [
    head,
    `longs closed ${f.usd(longs)}`,
    `shorts closed ${f.usd(shorts)}`,
    `longs − shorts <b class="${diff > 0 ? "lq-ink-l" : diff < 0 ? "lq-ink-s" : ""}">${diff > 0 ? "+" : ""}${f.usd(diff)}</b>`,
    heavier,
    `${events.toLocaleString("en-US")} liquidation${events === 1 ? "" : "s"}`,
  ].join(" · ");
}

/** What a CVD figure ships: one entry per slot, oldest first, [bought, sold, CVD so far, price]. */
export interface CvdSlots {
  kind: "cvd";
  /** First slot's start, epoch ms, and the slot length. */
  from: number;
  unit: number;
  /** The window's first price, or null when no slot has one. */
  open: number | null;
  slots: ([number, number, number, number | null] | null)[];
}

/** What a longs-vs-shorts figure ships: one entry per slot, [longs closed, shorts closed, events]. */
export interface SidesSlots {
  kind: "lqc";
  from: number;
  unit: number;
  slots: ([number, number, number] | null)[];
}

/** The payload as a JSON script tag, `<` escaped so no value can close it. */
export function slotData(payload: CvdSlots | SidesSlots): string {
  return `<script type="application/json" class="slot-data">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>`;
}

/**
 * The two marks each panel carries, hidden until a slot is read: a band behind the bars, which goes
 * first in the SVG, and a cursor line through the slot's centre, which goes last so it draws on top.
 */
export const SLOT_BAND = `<rect class="slot-mark slot-band off" x="0" y="0" width="0" height="1000"></rect>`;
export const SLOT_CURSOR = `<line class="slot-mark fchart-cursor off" x1="0" x2="0" y1="0" y2="1000"></line>`;

/**
 * The browser half. Included once per page, outside every live region, so a chart that only appears
 * on a later refresh is still read. The guard makes a second copy harmless.
 *
 * The slot is picked by where the pointer is across the plot, not by which element it is over, so a
 * gap between bars, an empty slot and the space between the CVD chart's two panels all read. A touch
 * sets the reading on a tap and holds it, since a finger lifting is not a reader leaving; scrubbing
 * sideways works because the area allows only vertical panning. Arrow keys step through the slots
 * once the area has focus.
 */
export const SLOT_SCRIPT = `(() => {
  if (window.airratesSlots) return;
  window.airratesSlots = true;
  const f = { usd: ${slotUsd}, price: ${slotPrice}, pct: ${slotPct}, when: ${slotWhen} };
  const cvdText = ${cvdText};
  const sidesText = ${sidesText};
  const parsed = new WeakMap();
  const idle = new WeakMap();
  let held = null, heldRead = null, heldIndex = -1;

  const payload = (figure) => {
    const el = figure.querySelector(".slot-data");
    if (!el) return null;
    if (!parsed.has(el)) parsed.set(el, JSON.parse(el.textContent));
    return parsed.get(el);
  };
  const reading = (d, i) => {
    const head = f.when(d.from + i * d.unit) + (i === d.slots.length - 1 ? " (still filling)" : "");
    const slot = d.slots[i];
    if (d.kind === "lqc") return sidesText(head, slot, f);
    let cvd = 0;
    for (let j = i; j >= 0; j--) if (d.slots[j]) { cvd = d.slots[j][2]; break; }
    return cvdText(head, slot && [slot[0], slot[1], slot[3]], cvd, d.open, f);
  };
  const clear = () => {
    if (!held) return;
    for (const el of held.querySelectorAll(".slot-mark")) el.classList.add("off");
    const read = held.querySelector(".slot-read");
    if (read && idle.has(read)) read.innerHTML = idle.get(read);
    const tip = held.querySelector(".slot-tip");
    if (tip) tip.hidden = true;
    held = heldRead = null;
    heldIndex = -1;
  };
  // A mouse on a device that really hovers gets the reading beside the cursor; a finger, a pen
  // without hover, or the keyboard gets it in the header line, where a hand cannot cover it.
  const fine = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : null;
  const floating = (pointer) => !!pointer && pointer.type === "mouse" && !!fine && fine.matches;
  const place = (figure, html, pointer) => {
    let tip = figure.querySelector(".slot-tip");
    if (!tip) {
      // Created on first use rather than rendered, so a refresh that swaps the figure's HTML simply
      // takes it away and the next hover makes a new one.
      tip = document.createElement("div");
      tip.className = "slot-tip";
      tip.setAttribute("aria-hidden", "true");
      figure.appendChild(tip);
    }
    // The text functions join their parts with " · "; the tooltip puts each part on its own line.
    tip.innerHTML = html.split(" · ").map((part) => "<div>" + part + "</div>").join("");
    tip.hidden = false;
    const box = figure.getBoundingClientRect();
    const gap = 14;
    let left = pointer.x - box.left + gap;
    // Flip to the cursor's left when the right side would run out of the figure.
    if (left + tip.offsetWidth > box.width - 4) left = pointer.x - box.left - gap - tip.offsetWidth;
    let top = pointer.y - box.top + gap;
    if (top + tip.offsetHeight > box.height - 4) top = pointer.y - box.top - gap - tip.offsetHeight;
    tip.style.left = Math.max(4, left) + "px";
    tip.style.top = Math.max(4, top) + "px";
  };
  const show = (area, i, pointer) => {
    const figure = area.closest("figure");
    const d = figure && payload(figure);
    const read = figure && figure.querySelector(".slot-read");
    if (!d || !read || !d.slots.length) return;
    i = Math.min(d.slots.length - 1, Math.max(0, i));
    const float = floating(pointer);
    // A refresh swaps the readout for a new element, so an unchanged slot still redraws after one.
    // The tooltip still follows the cursor within a slot, so only its text is spared.
    if (figure === held && read === heldRead && i === heldIndex) {
      if (float) place(figure, reading(d, i), pointer);
      return;
    }
    if (held !== figure) clear();
    if (!idle.has(read)) idle.set(read, read.innerHTML);
    const w = 1000 / d.slots.length;
    for (const el of figure.querySelectorAll(".slot-mark")) {
      if (el.tagName === "line") {
        el.setAttribute("x1", ((i + 0.5) * w).toFixed(2));
        el.setAttribute("x2", ((i + 0.5) * w).toFixed(2));
      } else {
        el.setAttribute("x", (i * w).toFixed(2));
        el.setAttribute("width", w.toFixed(2));
      }
      el.classList.remove("off");
    }
    const text = reading(d, i);
    if (float) {
      // Beside the cursor, the header keeps the window's totals rather than repeating the tooltip.
      read.innerHTML = idle.get(read);
      place(figure, text, pointer);
    } else {
      read.innerHTML = text;
      const tip = figure.querySelector(".slot-tip");
      if (tip) tip.hidden = true;
    }
    held = figure;
    heldRead = read;
    heldIndex = i;
  };
  const indexAt = (area, clientX) => {
    const plot = area.matches(".fchart-plot") ? area : area.querySelector(".fchart-plot");
    const d = payload(area.closest("figure"));
    if (!plot || !d) return 0;
    const rect = plot.getBoundingClientRect();
    return Math.floor(((clientX - rect.left) / rect.width) * d.slots.length);
  };
  const track = (event) => {
    const area = event.target.closest ? event.target.closest(".slot-area") : null;
    if (area) {
      return show(area, indexAt(area, event.clientX), {
        type: event.pointerType,
        x: event.clientX,
        y: event.clientY,
      });
    }
    if (held && (event.pointerType !== "touch" || event.type === "pointerdown")) clear();
  };
  document.addEventListener("pointermove", track, { passive: true });
  document.addEventListener("pointerdown", track, { passive: true });
  // The pointer left the window straight from a plot, so no move outside it will ever arrive.
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget && event.pointerType === "mouse") clear();
  });
  document.addEventListener("keydown", (event) => {
    const area = event.target.closest ? event.target.closest(".slot-area") : null;
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -1e9, End: 1e9 }[event.key];
    if (!area || !step) return;
    const d = payload(area.closest("figure"));
    if (!d) return;
    event.preventDefault();
    const from = held === area.closest("figure") && heldIndex >= 0 ? heldIndex : step < 0 ? d.slots.length : -1;
    show(area, from + step);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest && event.target.closest(".slot-area") && held && !held.matches(":hover")) clear();
  });
})();`;
