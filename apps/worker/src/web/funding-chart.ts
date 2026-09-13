import { esc } from "./format";
import { railPosition, railScale } from "./rail";
import { venueName } from "./venues";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const HOURS_PER_YEAR = 8_760;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Colours for the exchanges that are not a leg. Long and short keep the site's blue and red, and
 * nothing here is either, so a toggled-on venue can never be read as a leg.
 */
const PALETTE = [
  "#c8f5a8",
  "#e5e500",
  "#b69cff",
  "#5fd7ff",
  "#ff9f43",
  "#4cc38a",
  "#ff79c6",
  "#a8b3bf",
];

/** One market's funding for one bucket of the chart's grain, as the rollups hold it. */
export interface FundingBucket {
  venue_id: string;
  venue_symbol: string;
  /** Start of the bucket, epoch milliseconds. */
  atMs: number;
  rate_sum: number;
  basis_hours_sum: number;
}

export interface FundingHistory {
  /** Hourly from market_funding_hourly for short windows, daily from market_funding_daily beyond. */
  grain: "hour" | "day";
  fromMs: number;
  toMs: number;
  buckets: FundingBucket[];
}

export type SeriesRole = "long" | "short" | "other" | "spread";

export interface FundingSeries {
  key: string;
  label: string;
  role: SeriesRole;
  /** [bucket start ms, APR percent], oldest first. */
  points: [number, number][];
}

interface MarketKey {
  venue_id: string;
  venue_symbol: string;
}

const keyOf = (market: MarketKey) => `${market.venue_id}|${market.venue_symbol}`;

/**
 * One series per market, as APR per bucket. Within a bucket the rate is time-weighted,
 * sum(rate) / sum(basis_hours) divided once, for the reason migration 008 gives. The legs come
 * first and the rest follow by name. A venue's symbol joins its label only where the venue lists
 * the asset twice, since "Gate BTC_USDT" says nothing "Gate" does not unless there is a second.
 */
export function fundingSeries(
  history: FundingHistory,
  legs: { long?: MarketKey; short?: MarketKey },
): FundingSeries[] {
  const marketsPerVenue = new Map<string, Set<string>>();
  for (const bucket of history.buckets) {
    const symbols = marketsPerVenue.get(bucket.venue_id) ?? new Set<string>();
    symbols.add(bucket.venue_symbol);
    marketsPerVenue.set(bucket.venue_id, symbols);
  }

  const byKey = new Map<string, FundingSeries>();
  for (const bucket of history.buckets) {
    if (!(bucket.basis_hours_sum > 0)) continue;
    const key = keyOf(bucket);
    let series = byKey.get(key);
    if (!series) {
      const role: SeriesRole =
        legs.long && keyOf(legs.long) === key
          ? "long"
          : legs.short && keyOf(legs.short) === key
            ? "short"
            : "other";
      const shared = (marketsPerVenue.get(bucket.venue_id)?.size ?? 0) > 1;
      const label = `${venueName(bucket.venue_id)}${shared ? ` ${bucket.venue_symbol}` : ""}`;
      series = { key, label, role, points: [] };
      byKey.set(key, series);
    }
    series.points.push([
      bucket.atMs,
      (bucket.rate_sum / bucket.basis_hours_sum) * HOURS_PER_YEAR * 100,
    ]);
  }

  const rank: Record<SeriesRole, number> = { long: 0, short: 1, spread: 2, other: 3 };
  return [...byKey.values()]
    .map((series) => ({ ...series, points: series.points.sort((a, b) => a[0] - b[0]) }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.label.localeCompare(b.label));
}

/**
 * Short minus long at every moment either leg settles. Legs rarely share a cadence, so each holds its
 * last rate until its next settlement, which is how funding accrues; nothing is interpolated.
 */
export function spreadPoints(long: FundingSeries, short: FundingSeries): [number, number][] {
  const times = [...new Set([...long.points, ...short.points].map((point) => point[0]))].sort(
    (a, b) => a - b,
  );
  const spread: [number, number][] = [];
  let i = 0;
  let j = 0;
  let longApr: number | undefined;
  let shortApr: number | undefined;
  for (const time of times) {
    while (i < long.points.length && (long.points[i] as [number, number])[0] <= time) {
      longApr = (long.points[i++] as [number, number])[1];
    }
    while (j < short.points.length && (short.points[j] as [number, number])[0] <= time) {
      shortApr = (short.points[j++] as [number, number])[1];
    }
    if (longApr !== undefined && shortApr !== undefined) spread.push([time, shortApr - longApr]);
  }
  return spread;
}

/**
 * A step line: each rate holds until the next bucket, and the line breaks where the record has a
 * hole rather than drawing a flat rate across data that is not there. A day without an hourly row
 * is a hole, since even an 8-hourly venue settles three times in one; for the daily grain, three.
 */
function stepPath(
  points: readonly [number, number][],
  x: (ms: number) => number,
  y: (apr: number) => number,
  grainMs: number,
  toMs: number,
): string {
  const hole = grainMs === HOUR_MS ? DAY_MS : 3 * DAY_MS;
  let path = "";
  points.forEach(([time, apr], i) => {
    const next = points[i + 1]?.[0];
    const joinsNext = next !== undefined && next - time <= hole;
    const end = joinsNext ? next : Math.min(time + (next === undefined ? hole : grainMs), toMs);
    const previous = points[i - 1]?.[0];
    const joinsPrevious = previous !== undefined && time - previous <= hole;
    const yy = y(apr).toFixed(1);
    path += joinsPrevious
      ? `V${yy}H${x(end).toFixed(1)}`
      : `M${x(time).toFixed(1)} ${yy}H${x(end).toFixed(1)}`;
  });
  return path;
}

const tickLabel = (apr: number) =>
  apr === 0 ? "0%" : `${apr > 0 ? "+" : "−"}${Math.abs(apr).toLocaleString("en-US")}%`;

function dayLabel(ms: number): string {
  const date = new Date(ms);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Time labels along the bottom: hours across a single day, whole days otherwise. */
function timeTicks(fromMs: number, toMs: number): { ms: number; label: string }[] {
  const span = toMs - fromMs;
  if (span <= 1.5 * DAY_MS) {
    const ticks = [];
    for (let ms = Math.ceil(fromMs / (6 * HOUR_MS)) * 6 * HOUR_MS; ms <= toMs; ms += 6 * HOUR_MS) {
      ticks.push({ ms, label: `${String(new Date(ms).getUTCHours()).padStart(2, "0")}:00` });
    }
    return ticks;
  }
  const step = Math.max(1, Math.ceil(span / DAY_MS / 7)) * DAY_MS;
  const ticks = [];
  for (let ms = Math.ceil(fromMs / DAY_MS) * DAY_MS; ms <= toMs; ms += step) {
    ticks.push({ ms, label: dayLabel(ms) });
  }
  return ticks;
}

/**
 * Hover readout and toggles. Points travel as [bucket offset, APR] so the payload stays small, and
 * each visible line reports the rate it holds at the cursor, the same hold-last rule the lines use.
 */
const CHART_SCRIPT = `(() => {
  const MINUS = "−";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pct = (v) => {
    const a = Math.abs(v), d = a >= 100 ? 0 : a >= 10 ? 1 : 2;
    return Number(a.toFixed(d)) === 0 ? "0." + "0".repeat(d) + "%" : (v < 0 ? MINUS : "+") + a.toFixed(d) + "%";
  };
  const when = (ms, hourly) => {
    const d = new Date(ms), day = MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
    return hourly ? day + " " + String(d.getUTCHours()).padStart(2, "0") + ":00 UTC" : day;
  };
  const holding = (points, offset) => {
    let lo = 0, hi = points.length - 1, found;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid][0] <= offset) { found = points[mid]; lo = mid + 1; } else hi = mid - 1;
    }
    return found;
  };
  for (const chart of document.querySelectorAll(".fchart")) {
    const data = JSON.parse(chart.querySelector(".fchart-data").textContent);
    const plot = chart.querySelector(".fchart-plot");
    const read = chart.querySelector(".fchart-read");
    const cursor = chart.querySelector(".fchart-cursor");
    const idle = read.textContent;
    const boxes = new Map([...chart.querySelectorAll("input[data-series]")].map((box) => [box.dataset.series, box]));
    for (const [key, box] of boxes) {
      box.addEventListener("change", () => {
        for (const line of chart.querySelectorAll("path[data-series]")) {
          if (line.dataset.series === key) line.classList.toggle("off", !box.checked);
        }
      });
    }
    plot.addEventListener("pointermove", (event) => {
      const rect = plot.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const offset = Math.floor((f * (data.to - data.from)) / data.unit);
      cursor.setAttribute("x1", String(f * 1000));
      cursor.setAttribute("x2", String(f * 1000));
      cursor.classList.remove("off");
      const parts = [when(data.from + offset * data.unit, data.grain === "hour")];
      for (const series of data.series) {
        if (boxes.get(series.key) && !boxes.get(series.key).checked) continue;
        const point = holding(series.points, offset);
        if (point) parts.push(series.label + " " + pct(point[1]));
      }
      read.textContent = parts.join(" · ");
    });
    plot.addEventListener("pointerleave", () => {
      cursor.classList.add("off");
      read.textContent = idle;
    });
  }
})();`;

/**
 * The pair page's funding comparison: every listed market's funding over the window on one signed
 * log scale, the scale the rails use, so an ordinary 10% and a distressed 2,500% stay readable
 * together. With a pair chosen, its legs and their spread are drawn and every other exchange is a
 * toggle away; without one, every exchange is drawn.
 *
 * The scale spans every market, visible or not, so switching a venue on never rescales the lines
 * already being read.
 */
export function renderFundingChart(
  history: FundingHistory | null,
  legs: { long?: MarketKey; short?: MarketKey },
): string {
  if (!history) {
    return `<p class="notes">The funding chart is unavailable right now. The backtest below is unaffected.</p>`;
  }
  const markets = fundingSeries(history, legs);
  if (markets.length === 0) {
    return `<p class="notes">No stored funding for this window yet.</p>`;
  }

  const long = markets.find((series) => series.role === "long");
  const short = markets.find((series) => series.role === "short");
  const spread: FundingSeries | null =
    long && short
      ? { key: "spread", label: "Spread", role: "spread", points: spreadPoints(long, short) }
      : null;
  const all = spread ? [...markets, spread] : markets;
  const paired = Boolean(long && short);

  const { fromMs, toMs, grain } = history;
  const grainMs = grain === "hour" ? HOUR_MS : DAY_MS;
  const span = toMs - fromMs || 1;
  const scale = railScale(
    all.flatMap((series) => series.points.map((point) => point[1])),
    "log",
  );
  const x = (ms: number) => ((ms - fromMs) / span) * 1000;
  const y = (apr: number) => 1000 - railPosition(apr, scale).pct * 10;

  const colour = new Map<string, string>();
  for (const series of markets.filter((s) => s.role === "other")) {
    colour.set(series.key, PALETTE[colour.size % PALETTE.length] as string);
  }
  const swatch = (series: FundingSeries) =>
    series.role === "long"
      ? "var(--long)"
      : series.role === "short"
        ? "var(--short)"
        : series.role === "spread"
          ? "var(--ink)"
          : (colour.get(series.key) as string);
  const on = (series: FundingSeries) => series.role !== "other" || !paired;

  // Later elements draw on top, so the legs and their spread go last.
  const drawOrder = [
    ...all.filter((s) => s.role === "other"),
    ...all.filter((s) => s.role === "short"),
    ...all.filter((s) => s.role === "long"),
    ...all.filter((s) => s.role === "spread"),
  ];
  const lines = drawOrder
    .map(
      (series) =>
        `<path class="fchart-line ${series.role}${on(series) ? "" : " off"}" data-series="${esc(series.key)}"${series.role === "other" ? ` style="stroke:${swatch(series)}"` : ""} d="${stepPath(series.points, x, y, grainMs, toMs)}"></path>`,
    )
    .join("");

  // Ticks on the scale's own values, thinned so labels never overlap on a narrow range.
  const ticks: { apr: number; pct: number }[] = [];
  // No ±3%: on the signed log scale it sits beside zero, and zero's line is never thinned away.
  for (const apr of [-1000, -300, -100, -30, -10, 0, 10, 30, 100, 300, 1000]) {
    const position = railPosition(apr, scale);
    if (position.clipped) continue;
    const last = ticks.at(-1);
    // 9% of a 220px plot is ~20px, a little more than one label line.
    if (last && Math.abs(position.pct - last.pct) < 9 && apr !== 0) continue;
    ticks.push({ apr, pct: position.pct });
  }
  const grid = ticks
    .map(
      ({ apr, pct }) =>
        `<line class="fchart-grid${apr === 0 ? " fchart-zero" : ""}" x1="0" x2="1000" y1="${(1000 - pct * 10).toFixed(1)}" y2="${(1000 - pct * 10).toFixed(1)}"></line>`,
    )
    .join("");
  const yLabels = ticks
    .map(
      ({ apr, pct }) =>
        `<span class="fchart-y" style="top:${(100 - pct).toFixed(2)}%">${tickLabel(apr)}</span>`,
    )
    .join("");
  const xLabels = timeTicks(fromMs, toMs)
    .map(
      ({ ms, label }) =>
        `<span class="fchart-x" style="left:${(x(ms) / 10).toFixed(2)}%">${label}</span>`,
    )
    .join("");

  const keys = all
    .map(
      (series) =>
        `<label><input type="checkbox" data-series="${esc(series.key)}"${on(series) ? " checked" : ""}><i style="background:${swatch(series)}"></i>${esc(series.label)}</label>`,
    )
    .join("");

  const payload = JSON.stringify({
    from: fromMs,
    to: toMs,
    unit: grainMs,
    grain,
    series: all.map((series) => ({
      key: series.key,
      label: series.label,
      points: series.points.map(([ms, apr]) => [
        Math.round((ms - fromMs) / grainMs),
        Math.round(apr * 100) / 100,
      ]),
    })),
  }).replace(/</g, "\\u003c");

  return `<figure class="fchart">
<div class="fchart-head"><p class="fchart-title">Funding by exchange, annualized · ${grain === "hour" ? "hourly" : "daily"}</p><div class="fchart-keys">${keys}</div></div>
<div class="fchart-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="Funding APR by exchange over the window">${grid}${lines}<line class="fchart-cursor off" x1="0" x2="0" y1="0" y2="1000"></line></svg>${yLabels}${xLabels}</div>
<p class="fchart-read">Hover the chart to read every visible line at one moment.</p>
<p class="fchart-note">Signed log scale, so ordinary rates keep room beside extreme ones. Each line holds a rate until that exchange's next settlement; a break is time with no recorded funding, not a zero.</p>
<script type="application/json" class="fchart-data">${payload}</script>
<script>${CHART_SCRIPT}</script>
</figure>`;
}
