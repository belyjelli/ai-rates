import { esc } from "./format";
import { tr, trMsg } from "./i18n";
import { MONTHS } from "./slot-chart";

/**
 * Chart times in the reader's own time zone.
 *
 * WHY THE BROWSER DOES IT. Every chart used to say "UTC" and mean it, and readers in China compared
 * our "Oct 12 15:00 UTC" with their exchange app's "10-12 15:00" -- Beijing time, eight hours
 * earlier -- and reported the price as wrong (2026-10-16; it was Binance's own 15:00 UTC close to the
 * cent). The server cannot know a reader's zone, and pages are cached per address for everyone, so
 * the server keeps writing UTC and stamps each time with its moment; LOCAL_TIME_SCRIPT rewrites the
 * stamps in the browser, again after live.ts or a tab swaps new markup in, and again when the
 * masthead clock is clicked over to UTC (the choice it keeps in localStorage "clock").
 *
 * THE FORMATS are one function, `formatTime`, run on the server for the UTC text a reader without
 * JavaScript keeps, and in the browser through toString -- so it must not reference anything outside
 * its own body, as live.ts's helpers must not.
 *
 *   tick  an axis label: the date on the day's first tick, else HH:MM (`bucket` = tick spacing, hours)
 *   hm    HH:MM          md    the date          mdhm  the date and HH:MM
 *   when  the date, HH:MM and the zone, in the words' "when" pattern
 *   col   a liquidation grid column: date/HH where the day starts, else HH (`bucket` hours wide)
 *   colt  that column's range with its zone, for its tooltip
 *   zone  the zone alone: UTC, UTC+8, UTC+5:30, UTC-3
 */

export type TimeFormat = "tick" | "hm" | "md" | "mdhm" | "when" | "col" | "colt" | "zone";

/** The words the formats use, in the render's language. */
export interface TimeWords {
  /** The twelve month names, "|"-joined. */
  months: string;
  day: string;
  when: string;
  colDay: string;
  col: string;
}

export const timeWords = (): TimeWords => ({
  months: MONTHS.map((month) => trMsg(month)).join("|"),
  day: tr("{month} {day}"),
  when: tr("{month} {day} {time} {zone}"),
  colDay: tr("{month} {day} {hours} {zone}"),
  col: tr("{hours} {zone}"),
});

/** One moment in one format, `offset` minutes east of UTC. Self-contained: it ships as text. */
export function formatTime(
  ms: number,
  f: string,
  offset: number,
  w: TimeWords,
  bucket: number,
): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const at = (t: number) => new Date(t + offset * 60_000);
  const d = at(ms);
  const a = Math.abs(offset);
  const zone =
    offset === 0
      ? "UTC"
      : `UTC${offset > 0 ? "+" : "-"}${Math.floor(a / 60)}${a % 60 ? `:${p(a % 60)}` : ""}`;
  const month = w.months.split("|")[d.getUTCMonth()] ?? "";
  const date = String(d.getUTCDate());
  const day = w.day.replace("{month}", () => month).replace("{day}", () => date);
  const hm = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  if (f === "zone") return zone;
  // An axis tick names the date on the day's first tick: midnight, or, where the ticks are `bucket`
  // hours apart on UTC hours and the reader's day starts between two, the first tick after it.
  if (f === "tick")
    return d.getUTCHours() * 60 + d.getUTCMinutes() < Math.max(bucket, 0) * 60 ||
      (d.getUTCHours() === 0 && d.getUTCMinutes() === 0)
      ? day
      : hm;
  if (f === "hm") return hm;
  if (f === "md") return day;
  if (f === "when") {
    return w.when
      .replace("{month}", () => month)
      .replace("{day}", () => date)
      .replace("{time}", () => hm)
      .replace("{zone}", () => zone);
  }
  const starts = d.getUTCHours() < bucket && d.getUTCMinutes() === 0;
  if (f === "col") return `${starts ? `${date}/` : ""}${p(d.getUTCHours())}`;
  if (f === "colt") {
    const end = at(ms + bucket * 3_600_000);
    const hours = `${hm}–${p(end.getUTCHours())}:${p(end.getUTCMinutes())}`;
    return (starts ? w.colDay.replace("{month}", () => month).replace("{day}", () => date) : w.col)
      .replace("{hours}", () => hours)
      .replace("{zone}", () => zone);
  }
  return `${day} ${hm}`;
}

/** A time the browser rewrites into the reader's zone: its UTC text until then. */
export function timeTag(ms: number, f: TimeFormat, bucket = 0): string {
  const text = formatTime(ms, f, 0, timeWords(), bucket);
  return `<time datetime="${new Date(ms).toISOString()}" data-t="${ms}" data-tf="${f}"${bucket ? ` data-b="${bucket}"` : ""}>${esc(text)}</time>`;
}

/** The zone's name, "UTC" until the browser names the reader's. For a chart's title. */
export const zoneTag = () => `<span data-tz>UTC</span>`;

/**
 * A tooltip carrying a time, as attributes for the element: `template` is the whole text with
 * "{t}" where the time goes, and the browser fills it in the reader's zone.
 */
export function timeTitle(ms: number, f: TimeFormat, template: string, bucket = 0): string {
  const text = template.replace("{t}", () => formatTime(ms, f, 0, timeWords(), bucket));
  return ` title="${esc(text)}" data-tt="${ms}" data-tf="${f}" data-tpl="${esc(template)}"${bucket ? ` data-b="${bucket}"` : ""}`;
}

/**
 * The browser half, on every page (layout.ts). `window.airratesZone(ms)` is the reader's offset for a
 * moment, in minutes east of UTC, or 0 while the clock is set to UTC: the chart readouts
 * (slot-chart.ts) ask it, and `window.airratesTime` hands the formats and words to the trading chart
 * (kchart.ts), which labels its own time axis. Each element is written only when its text changes, so the observer that
 * re-runs this after a swap never re-triggers itself.
 */
export function localTimeScript(): string {
  return `(() => {
  const W = ${JSON.stringify(timeWords()).replace(/</g, "\\u003c")};
  const fmt = ${formatTime};
  const utc = () => { try { return localStorage.getItem("clock") === "utc"; } catch (_) { return false; } };
  const zone = (ms) => (utc() ? 0 : -new Date(ms).getTimezoneOffset());
  window.airratesZone = zone;
  // The formats and words, for a chart that labels its own axis (kchart.ts).
  window.airratesTime = { fmt, W };
  const set = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const apply = () => {
    for (const el of document.querySelectorAll("[data-t]")) {
      const ms = Number(el.dataset.t);
      set(el, fmt(ms, el.dataset.tf, zone(ms), W, Number(el.dataset.b) || 0));
    }
    for (const el of document.querySelectorAll("[data-tt]")) {
      const ms = Number(el.dataset.tt);
      const text = el.dataset.tpl.replace("{t}", () => fmt(ms, el.dataset.tf, zone(ms), W, Number(el.dataset.b) || 0));
      if (el.getAttribute("title") !== text) el.setAttribute("title", text);
    }
    const name = fmt(0, "zone", zone(Date.now()), W, 0);
    for (const el of document.querySelectorAll("[data-tz]")) set(el, name);
  };
  apply();
  addEventListener("airrates:clock", apply);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
})();`;
}
