import { msg, tr, trMsg } from "./i18n";

const MINUS = "−";

export function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** APR in percent: "+12.3%", "−0.55%", "+120%". Fewer decimals as the magnitude grows. */
export function formatApr(apr: number | null): string {
  if (apr === null || !Number.isFinite(apr)) return "–";
  const abs = Math.abs(apr);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const text = `${abs.toFixed(digits)}%`;
  if (Number(abs.toFixed(digits)) === 0) return `0.${"0".repeat(digits)}%`;
  return `${apr < 0 ? MINUS : "+"}${text}`;
}

/** Compact dollars: "$4.1B", "$912M", "$25.0k", "$640". */
export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : "";
  for (const [size, suffix] of [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ] as const) {
    if (abs >= size) {
      const scaled = abs / size;
      return `${sign}$${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)}${suffix}`;
    }
  }
  return `${sign}$${abs.toFixed(0)}`;
}

/** Prices with precision that suits their size: "77,766.7", "2.573", "0.0001234". */
export function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (abs >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return value.toPrecision(4);
}

/** Settlement interval: "8h", "1h", "30m"; "–" when unknown. */
export function formatInterval(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours) || hours <= 0) return "–";
  return hours >= 1 ? `${Number(hours.toFixed(2))}h` : `${Math.round(hours * 60)}m`;
}

/**
 * Duration in seconds as "42s", "12m", "3h 05m", in the current language. Mirrored by the page
 * script, which is handed these same patterns (`durationStrings`) so the two never read differently.
 */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return tr("{s}s", { s });
  if (s < 3600) return tr("{m}m", { m: Math.floor(s / 60) });
  return tr("{h}h {m}m", {
    h: Math.floor(s / 3600),
    m: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
  });
}

/** The patterns `formatDuration`, `since` and `until` use, for the page script that keeps them ticking. */
export const durationStrings = () => ({
  s: tr("{s}s"),
  m: tr("{m}m"),
  hm: tr("{h}h {m}m"),
  ago: tr("{time} ago"),
  settling: tr("settling"),
});

/** `<time>` that the page script keeps ticking as "12s ago". */
export function since(date: Date | null, now: number): string {
  if (!date) return "–";
  const ms = date.getTime();
  return `<time datetime="${date.toISOString()}" data-since="${ms}">${tr("{time} ago", { time: formatDuration((now - ms) / 1000) })}</time>`;
}

/**
 * The same age as `since`, as PLAIN TEXT: "42s ago", "3h 05m ago", "never".
 *
 * `since` returns a `<time>` element so the page script can keep it counting, and putting an element
 * inside a `title=` attribute renders the markup as literal text in the tooltip — which is what
 * shipped on /arbitrage for one deploy. A tooltip is text, so it gets a text function.
 */
export function ageText(date: Date | null, now: number): string {
  if (!date) return tr("never");
  return tr("{time} ago", { time: formatDuration((now - date.getTime()) / 1000) });
}

/** `<time>` that the page script keeps counting down to the next settlement. */
export function until(date: Date | null, now: number): string {
  if (!date) return "–";
  const ms = date.getTime();
  const label = ms > now ? formatDuration((ms - now) / 1000) : tr("settling");
  return `<time datetime="${date.toISOString()}" data-until="${ms}">${label}</time>`;
}

/**
 * A price gap in basis points, for a column: "269.6", "0.0", "−283.5", "–".
 *
 * Untinted, unlike `formatApr`: a funding figure says who pays whom and carries a colour for it,
 * while a price gap is just a distance. Signed only because the pair table shows every direction,
 * and most directions lose — a gap that reads "−283.5" is saying plainly that this way round does
 * not work. One decimal ALWAYS, because the whole distribution lives near zero — the median
 * comparable asset is 0.0 bps — so trimming decimals would erase the only distinction that matters
 * at the bottom of the table, and a bare "0" would read as no quote at all.
 *
 * Distinct from `pages.ts`'s own `formatBps`, which trims for prose ("5 bps long" in the backtest
 * note). Same unit, opposite rounding, because a sentence and a column want different things.
 */
export function formatGapBps(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  const text = Math.abs(value).toFixed(1);
  // The site's minus is U+2212, not a hyphen, everywhere a number can go negative. `toFixed` would
  // emit a hyphen, which reads narrower and inconsistently beside every other signed figure.
  return value < 0 && Number(text) !== 0 ? `${MINUS}${text}` : text;
}

/**
 * The basis between two quotes, `sell` less `buy`, in the asset's own price units: the gap
 * `formatGapBps` states relatively, stated absolutely. Rounded to the finer of the two prices as
 * `formatPrice` shows them, so 0.01162 against 0.01133 reads "0.00029" rather than float noise, and
 * a 0.1 move on a 65,000 price reads "0.1" rather than "0.1000".
 */
export function formatPriceGap(sell: number, buy: number): string {
  if (!Number.isFinite(sell) || !Number.isFinite(buy)) return "–";
  const shown = (price: number) => {
    const abs = Math.abs(price);
    // Below 1 formatPrice keeps four significant figures, trailing zeros and all.
    if (abs < 1) return abs > 0 ? 3 - Math.floor(Math.log10(abs)) : 0;
    return formatPrice(price).split(".")[1]?.length ?? 0;
  };
  const decimals = Math.max(shown(sell), shown(buy));
  const value = sell - buy;
  const text = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 && Number(text.replace(/,/g, "")) !== 0 ? `${MINUS}${text}` : text;
}

/** A small padlock in the text colour, for something shown but not available yet. */
export const LOCK_ICON =
  '<svg class="tf-lock" viewBox="0 0 12 12" width="9" height="9" aria-hidden="true"><rect x="2" y="5" width="8" height="6.5" rx="1" fill="currentColor"></rect><path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" stroke-width="1.4"></path></svg>';

/** CSS class for a funding value: who gets paid (positive: shorts receive, negative: longs receive). */
export function aprTone(apr: number | null): string {
  if (apr === null || apr === 0) return "flat";
  return apr > 0 ? "shorts-paid" : "longs-paid";
}

/**
 * "long"/"short"/"ink" for a fear/greed score, 0-100 -- shared between layout.ts's header badge and
 * sentiment.ts's page so the two never drift onto different band cuts. The cuts themselves match the
 * collector's CASE in migration 026 exactly: <25 extreme fear, <45 fear, <=55 neutral, <=75 greed,
 * else extreme greed.
 */
export function sentimentTone(score: number): string {
  if (score < 45) return "short";
  if (score > 55) return "long";
  return "ink";
}

/** The five labels migration 026's CHECK allows, marked here so each language translates them. */
const SENTIMENT_LABELS = new Set([
  msg("extreme fear"),
  msg("fear"),
  msg("neutral"),
  msg("greed"),
  msg("extreme greed"),
]);

/** A fear/greed label from the database, in the current language. Escaped: it is read from a table. */
export function sentimentLabel(label: string | null): string {
  if (!label) return "";
  return esc(SENTIMENT_LABELS.has(label) ? trMsg(label) : label);
}
