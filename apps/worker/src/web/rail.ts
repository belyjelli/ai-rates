import { esc, formatApr } from "./format";

/**
 * "linear" suits one asset's markets. "log" is a signed log scale for tables mixing assets, where funding runs from
 * a few percent to ±900%: roughly linear inside ±LOG_KNEE percent, logarithmic beyond, so both stay readable.
 */
export type RailMode = "linear" | "log";

export interface RailScale {
  /** Axis bounds in transformed units (percent for linear, log units for log). */
  min: number;
  max: number;
  mode?: RailMode;
}

export interface RailMark {
  apr: number;
  tone: "long" | "short" | "venue";
  label: string;
}

const LOG_KNEE = 10;

function transform(apr: number, mode: RailMode): number {
  return mode === "log" ? Math.sign(apr) * Math.log1p(Math.abs(apr) / LOG_KNEE) : apr;
}

/**
 * A shared axis that always includes zero, with a little padding. Linear scales with 20+ values clip the outer 5%
 * at each end so one outlier doesn't flatten every other rail; log scales keep every value on the axis.
 */
export function railScale(
  values: readonly (number | null)[],
  mode: RailMode = "linear",
): RailScale {
  const sorted = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .map((v) => transform(v, mode))
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    const edge = transform(10, mode);
    return { min: -edge, max: edge, mode };
  }

  const at = (q: number) => sorted[Math.round(q * (sorted.length - 1))] as number;
  const robust = mode === "linear" && sorted.length >= 20;
  const lo = Math.min(0, robust ? at(0.05) : at(0));
  const hi = Math.max(0, robust ? at(0.95) : at(1));
  const pad = Math.max(hi - lo, transform(1, mode)) * 0.06;
  return { min: lo - pad, max: hi + pad, mode };
}

export function railPosition(apr: number, scale: RailScale): { pct: number; clipped: boolean } {
  const value = transform(apr, scale.mode ?? "linear");
  const clamped = Math.min(scale.max, Math.max(scale.min, value));
  return {
    pct: ((clamped - scale.min) / (scale.max - scale.min)) * 100,
    clipped: clamped !== value,
  };
}

/**
 * The spread rail: an APR axis with a zero tick, one mark per leg or venue, and optionally a bar spanning the
 * gap between the long and short legs, which is the spread itself.
 */
export function renderRail(options: {
  scale: RailScale;
  marks: readonly RailMark[];
  bar?: readonly [number, number];
  size?: "row" | "big";
}): string {
  const { scale, marks, bar, size = "row" } = options;
  const label = marks.map((m) => `${m.label} ${formatApr(m.apr)}`).join(", ");
  const zero = railPosition(0, scale).pct;
  let html = `<span class="rail rail-${size}" role="img" aria-label="${esc(label)}"><i class="rail-zero" style="left:${zero.toFixed(2)}%"></i>`;

  if (bar) {
    const from = railPosition(Math.min(...bar), scale).pct;
    const to = railPosition(Math.max(...bar), scale).pct;
    html += `<i class="rail-bar" style="left:${from.toFixed(2)}%;width:${(to - from).toFixed(2)}%"></i>`;
  }
  for (const mark of marks) {
    const { pct, clipped } = railPosition(mark.apr, scale);
    html += `<i class="rail-mark ${mark.tone}${clipped ? " clipped" : ""}" style="left:${pct.toFixed(2)}%" title="${esc(`${mark.label} ${formatApr(mark.apr)}`)}"></i>`;
  }
  return `${html}</span>`;
}
