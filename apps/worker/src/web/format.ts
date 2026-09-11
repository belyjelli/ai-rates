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

/** Duration in seconds as "42s", "12m", "3h 05m". Mirrored by the page script. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
}

/** `<time>` that the page script keeps ticking as "12s ago". */
export function since(date: Date | null, now: number): string {
  if (!date) return "–";
  const ms = date.getTime();
  return `<time datetime="${date.toISOString()}" data-since="${ms}">${formatDuration((now - ms) / 1000)} ago</time>`;
}

/** `<time>` that the page script keeps counting down to the next settlement. */
export function until(date: Date | null, now: number): string {
  if (!date) return "–";
  const ms = date.getTime();
  const label = ms > now ? formatDuration((ms - now) / 1000) : "settling";
  return `<time datetime="${date.toISOString()}" data-until="${ms}">${label}</time>`;
}

/** CSS class for a funding value: who gets paid (positive: shorts receive, negative: longs receive). */
export function aprTone(apr: number | null): string {
  if (apr === null || apr === 0) return "flat";
  return apr > 0 ? "shorts-paid" : "longs-paid";
}
