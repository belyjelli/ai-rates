/** How a venue expresses a funding rate value. */
export type RateUnit = "fraction" | "percent" | "bps";

/** How a venue expresses a funding interval. */
export type DurationUnit = "ms" | "s" | "min" | "h";

const HOURS_PER_YEAR = 24 * 365;
const MS_PER_HOUR = 3_600_000;

/** Settlement intervals seen in the wild; inferred intervals within 5% snap to these. */
const STANDARD_INTERVALS_H = [0.5, 1, 2, 4, 8, 12, 24];

export function toFraction(value: number, unit: RateUnit): number {
  switch (unit) {
    case "fraction":
      return value;
    case "percent":
      return value / 100;
    case "bps":
      return value / 10_000;
  }
}

export function durationToHours(value: number, unit: DurationUnit): number {
  switch (unit) {
    case "ms":
      return value / MS_PER_HOUR;
    case "s":
      return value / 3_600;
    case "min":
      return value / 60;
    case "h":
      return value;
  }
}

/**
 * Converts a rate quoted over `basisHours` into a rate per hour.
 * The basis is the period the rate is quoted over, which is not always the settlement interval
 * (e.g. GRVT and Paradex quote an 8h-normalized rate for markets that settle hourly).
 */
export function ratePerHour(rateFraction: number, basisHours: number): number {
  if (!(basisHours > 0)) {
    throw new RangeError(`basisHours must be > 0, got ${basisHours}`);
  }
  return rateFraction / basisHours;
}

/** Simple (non-compounded) annualized rate in percent. Positive means longs pay shorts. */
export function aprPercent(ratePerHourFraction: number): number {
  return ratePerHourFraction * HOURS_PER_YEAR * 100;
}

export function aprFromRate(value: number, unit: RateUnit, basisHours: number): number {
  return aprPercent(ratePerHour(toFraction(value, unit), basisHours));
}

/**
 * Infers the settlement interval in hours from settlement timestamps (ms) using the median gap,
 * so a single missed settlement or an interval change early in the window doesn't skew it.
 * Returns null when there are fewer than two distinct timestamps.
 */
export function inferIntervalHours(timestampsMs: readonly number[]): number | null {
  const sorted = [...timestampsMs].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i] as number) - (sorted[i - 1] as number);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return null;

  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const medianMs =
    gaps.length % 2 === 1
      ? (gaps[mid] as number)
      : ((gaps[mid - 1] as number) + (gaps[mid] as number)) / 2;
  const hours = medianMs / MS_PER_HOUR;
  return STANDARD_INTERVALS_H.find((h) => Math.abs(hours - h) / h < 0.05) ?? hours;
}
